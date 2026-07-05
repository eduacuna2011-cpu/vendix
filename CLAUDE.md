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
- `auth`, `users`, `businesses`, `leads`, `payments`, `telegram`, `integration` — mounted *without* `trialCheck` (auth, public signup/payment pages, Super Admin tools, external-store sync).
- `sellers`, `products`, `transactions`, `settings`, `tax` — mounted as `app.use(path, authMiddleware, trialCheck, router)`. **`authMiddleware` runs before `trialCheck`** so `req.user` exists when the trial check resolves the business (the routers also `router.use(authMiddleware)` internally — redundant but harmless cache hit).

Writes are gated with `requireBusinessAdmin` / `requireSuperAdmin` (`server/middleware/auth.js`).
- `authMiddleware` verifies the JWT, then loads fresh `{role, business_id, status}` from the DB (60s cache) and **overwrites `req.user.role`/`req.user.businessId`** with those values — so a Super Admin changing a user's role/business takes effect within ≤60s instead of waiting for the 7-day JWT to expire. A deleted account → `401 account_deleted`; a non-`Active` account → `401 account_disabled`.
- `trialCheck` (`server/middleware/trialCheck.js`) blocks non-paid businesses whose `trial_ends_at` passed or whose status is `Suspended` (→ `403 trial_expired`). `is_paid = TRUE` bypasses it. Both middleware **fail open on DB errors** by design — a DB hiccup must not lock everyone out.

### Multi-tenancy
Every business-scoped table has a `business_id`. Routes enforce isolation with a `bizScope(req)` helper (see `products.js`): Super Admin sees everything (empty WHERE clause); everyone else is filtered to their own `business_id`. **Any new query against a business-scoped table — including single-row `/:id` GET/PUT/DELETE — must apply this scoping** or it leaks cross-tenant data (this was a real IDOR bug on `products/:id`).

> The JWT payload carries `businessId` (camelCase, set in `routes/auth.js`). `authMiddleware` refreshes and sets `req.user.businessId` from the DB. Some older code still reads `req.user.business_id` (snake_case); `trialCheck` accepts both (`user.businessId ?? user.business_id`). Prefer `businessId`.

### Roles & plans
Three roles in one `users` table: `Super Admin` (platform owner — `platform-sa.html`, `settings-sa.html`, `users.html`), `Business Admin` (per-tenant owner), `Seller` (sales only). Role string comparisons are exact — match the capitalization.

`businesses.plan` is `'basico'` (S/.15.99) or `'premium'` (S/.31.99). **Premium is gated automatically**: the external-store integration (`/api/integration`, `X-Store-Key` auth in `integration.js` `storeAuth`) returns `403 plan_not_premium` unless the business is `premium`. The SA sets the plan via **mark-paid** (`PATCH /users/:id/mark-paid` → `is_paid=TRUE`, sets plan, `status='Active'`) and can **deactivate** (`PATCH /users/:id/deactivate` → `is_paid=FALSE`, `status='Suspended'`, blocks the app). A business with a `sync_api_key` is grandfathered to premium+paid+active in migrations.

### Payments
Signup flow: `landing.html` → `checkout.html` (plan selector, `?plan=premium`) → `payment.html`. **Payment is Yape QR + manual verification** — `payment.html` shows a QR (`yape-qr.png`); "Ya pagué" posts a `lead` with `paid:false` for the SA to verify and then create the account. Culqi is integrated but **disabled** (commented `initCulqi`). Password recovery and plan activation are handled over WhatsApp (`wa.me` links) — there is **no email sending anywhere** in the project.

### Schema & migrations
`schema.sql` is the canonical, **complete** source of truth (run via `npm run db:push`). **All idempotent migrations are centralized in `server/migrations.js`** — `ensureMigrated()` is a memoized (once-per-instance) promise that runs every `ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS`; it is kicked off at startup in `app.js` and awaited by handlers that need a fresh column. **Do not add DDL inside request handlers** — add it to both `schema.sql` and `server/migrations.js`. Core tables: `businesses`, `users`, `products`, `transactions` + `transaction_items`, `settings`, `leads`, `telegram_sessions`, `audit_logs`.

### Product images & lazy loading
Product images are base64 in `products.image`. The list endpoint `GET /api/products` **does not return the image by default** — it returns a `has_image` flag; thumbnails are fetched per-id and lazily via `GET /api/products/:id/image` (`lazyThumb()` / `observeLazyImages()` in `api-client.js`). Pass `?images=1` to include images inline (e.g. label printing), and `?limit=&offset=` for pagination / infinite scroll. The public receipt (`/api/receipt/:id`, no auth) deliberately omits `profit`/cost.

## Conventions

- UI text, comments, and user-facing messages are in **Spanish** — keep them Spanish.
- `express.json` uses a `10mb` limit to accept base64 product images.
- Stock decrement on a sale must stay **atomic** (`UPDATE ... SET stock = stock - $1 WHERE id = $2 AND stock >= $1` + check `rowCount`) to avoid overselling under concurrency — see `transactions.js`.
- After editing `server/` code, restart `npm run dev`. After committing, deploy with `vercel --prod --yes` (git push does **not** auto-deploy).
- The `.pptx` files and `make-ppt*.js` / `vendix-ppt.js` scripts generate onboarding guides via `pptxgenjs` — unrelated to the running app.
