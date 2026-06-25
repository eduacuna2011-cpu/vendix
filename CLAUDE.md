# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Vendix** — a multi-tenant SaaS for inventory & point-of-sale. Spanish-language UI (Peru market: prices in soles, IGV tax, Yape/Culqi payments). Vanilla HTML/CSS/JS frontend (no framework, no build step) + Express API + Neon (serverless PostgreSQL). Deployed on Vercel.

## Commands

```bash
npm run dev       # local dev server on :3000 (server/dev.js) — serves static files + API from one port
npm start         # production server (server/app.js) — API only, no static serving
npm run db:push   # seed/migrate the database (server/db-push.js), incl. bcrypt Super Admin seed
npm run migrate   # standalone migration runner (migrate.js)
```

There is **no build, no lint, and no test suite.** Edit a file and reload the browser. `nodemon` is a devDependency but `npm run dev` runs plain `node`, so restart it manually after editing `server/` code.

Requires a `.env` (see `.env.example`): `DATABASE_URL` (Neon), `JWT_SECRET`, optional `FRONTEND_URL`, `PORT`, Telegram/Culqi keys.

## Architecture

### Two runtime entry points, one Express app
`server/app.js` defines the app (routes + middleware) and is shared by both:
- **Local:** `server/dev.js` wraps it, adds `express.static` for the frontend, and keeps the Neon WebSocket warm by pinging `SELECT 1` every 9s (avoids cold-start latency).
- **Production:** `api/index.js` re-exports the app as a Vercel serverless function. `vercel.json` routes `/api/*` to it and serves the HTML/CSS/JS as static assets.

### Frontend: file-per-page + custom SPA router
Each screen is a standalone `*.html` + matching `*.js` + `*.css` (e.g. `inventory.html`/`inventory.js`/`inventory.css`). They work as plain pages **and** as SPA fragments:
- `router.js` keeps the sidebar/navbar persistent and swaps only the `<main>` element on navigation. The `ROUTES` manifest in `router.js` maps each page to its CSS/JS/title — **when you add a page, register it there** or navigation falls back to a full reload.
- The router fetches a page's HTML, extracts its `<main>`, loads the page's CSS *before* swapping (no flash of unstyled content), then injects the page JS wrapped in an `(async function(){…})()` IIFE. **Consequence:** page scripts get a fresh scope each navigation, so top-level `let/const` won't collide across pages — but you cannot rely on globals persisting between pages except those defined in the always-loaded shell scripts.
- Sidebar links are prefetched on hover.

### Frontend data layer: `api-client.js`
This is the **only** thing the frontend uses to talk to the backend — never `fetch` the API directly from page scripts. Notable behavior baked in:
- JWT stored in `localStorage` as `authToken`; sent as `Bearer` by `authHeaders()`.
- `apiFetch` auto-redirects on auth failures: `401 account_deleted` → `account-deleted.html`, other `401` → `login.html`, `403 trial_expired` → `trial-expired.html`. Page code does not handle these.
- 15s in-memory GET cache. **Mutations must call `_bust(...)` for the affected prefixes** — every existing `add/update/delete` helper already does; follow that pattern or stale data will render.
- Pings `/api/health` every 4 min to keep Neon awake (frontend-side warm-up, complementing dev.js).
- `data.js` is the legacy localStorage data layer that `api-client.js` replaced; treat it as dead unless a page still references it.

### Backend: routes + two middleware layers
`server/db.js` is a single Neon `Pool` (WebSocket transport via `ws`); all queries go through `db.query(text, params)` — **always parameterized**.

Route mounting in `server/app.js` defines the two protection tiers:
- `auth`, `users`, `businesses`, `leads`, `payments`, `telegram` — mounted *without* `trialCheck` (auth, public signup/payment pages, Super Admin tools).
- `sellers`, `products`, `transactions`, `settings`, `tax` — mounted *behind* `trialCheck`.

Each route file additionally `router.use(authMiddleware)` and gates writes with `requireBusinessAdmin` / `requireSuperAdmin` (`server/middleware/auth.js`).
- `authMiddleware` verifies the JWT, then confirms the user still exists in the DB (60s cache; a deleted account → `401 account_deleted`).
- `trialCheck` (`server/middleware/trialCheck.js`) blocks non-paid businesses whose `trial_ends_at` passed or whose status is `Suspended`. Both middleware **fail open on DB errors** by design — a DB hiccup must not lock everyone out.

### Multi-tenancy
Every business-scoped table has a `business_id`. Routes enforce isolation with a `bizScope(req)` helper (see `products.js`): Super Admin sees everything (empty WHERE clause); everyone else is filtered to their own `business_id`. **Any new query against a business-scoped table must apply this scoping** or it leaks cross-tenant data.

> Note the JWT payload field naming is inconsistent across the codebase: some code reads `req.user.businessId` (camelCase, e.g. `products.js`), other code reads `req.user.business_id` (snake_case, e.g. `trialCheck.js`). Check what the token actually carries (`routes/auth.js`) before relying on either.

### Roles
Three roles live in one `users` table: `Super Admin` (platform owner — `platform-sa.html`, `settings-sa.html`, `users.html`), `Business Admin` (per-tenant owner — inventory/sales/sellers/settings), `Seller` (sales only). Role string comparisons are exact — match the capitalization above.

### Schema
`schema.sql` is the canonical schema (run once against Neon). Migrations are applied incrementally and idempotently with `ALTER TABLE … ADD COLUMN IF NOT EXISTS` either in `schema.sql`, `migrate.js`, or lazily at startup (e.g. `trialCheck.ensureTrialColumns` adds `trial_ends_at`/`is_paid` to `businesses`). When adding a column, prefer the same idempotent pattern so it self-heals on deploy. Core tables: `businesses`, `users`, `products`, `transactions` + `transaction_items`, `settings` (per-user key/value), `audit_logs`.

## Conventions

- UI text, comments, and user-facing messages are in **Spanish** — keep them Spanish.
- Product images are base64 stored in the `products.image` TEXT column; `express.json` is configured with a `10mb` limit to accept them.
- The `.pptx` files and `make-ppt*.js` / `vendix-ppt.js` scripts generate client/seller onboarding guides via `pptxgenjs` — unrelated to the running app.
