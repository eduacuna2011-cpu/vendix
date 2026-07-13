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

## Storefronts (tiendas online) — el "edificio" `latiendota-tiendas`

Cada negocio Premium puede tener una **tienda online pública** que lee su catálogo en vivo desde Vendix vía `/api/integration` (auth por `X-Store-Key` = `businesses.sync_api_key`, hardcodeado en el `CONFIG` de cada tienda). Las tiendas leen productos/precios reales pero **nunca** `cost_price`/`profit`.

**Diseño por tienda = 100% libre.** No hay plantilla/molde compartido: cada tienda tiene su `index.html` totalmente a medida (Urban Masters streetwear oscuro, HypePods azul claro, etc.). La decisión de producto es que cada tienda se vea como quiera.

### Arquitectura "edificio" (carpeta/repo aparte `latiendota-tiendas`)
Un **único** proyecto Vercel aloja a **TODAS** las tiendas, cada una en su subcarpeta con su diseño propio:
```
latiendota-tiendas/
  vercel.json            <- el "portero": rewrites por Host
  index.html             <- portada de la plataforma (noindex)
  hypepods-peru/index.html
  urban-masters/index.html   (+ logo.png y assets)
  olivia-dips/index.html
  peru-waterpolo/index.html
```
El **portero** (`vercel.json` → `rewrites` con `has: [{type:"host"}]`) reparte según la dirección con que entró el visitante. **⚠️ Config CRÍTICA (jul 2026 — costó horas de debug, NO cambiar sin entender):**

```json
{ "rewrites": [
  { "source": "/", "has": [{"type":"host","value":"^(?<sub>[^.]+)\\.latiendota\\.com$"}], "destination": "/:sub/index.html" },
  { "source": "/:path+", "has": [{"type":"host","value":"^(?<sub>[^.]+)\\.latiendota\\.com$"}], "destination": "/:sub/:path+" }
] }
```

Tres reglas de oro que hacen que funcione (si faltan, el subdominio muestra 404 o la portada, NO la tienda):
1. **La raíz va SEPARADA** (`source:"/"` → `/:sub/index.html`) de las subrutas (`source:"/:path+"` → `/:sub/:path+`). Un solo `/:path*` → `/:sub/:path*` **NO funciona**: en la raíz genera `/:sub/` (con `/` final) y Vercel no resuelve el `index.html` de esa carpeta al venir de un rewrite → 404.
2. **NADA de `index.html` en la raíz del edificio.** Vercel sirve los archivos existentes ANTES que los rewrites, así que un `index.html` raíz TAPA el ruteo de todos los subdominios (cada `<sub>.latiendota.com/` mostraría esa portada). Por eso la portada se renombró a `_portada.html`.
3. **NADA de `cleanUrls: true`** en el edificio — rompe los rewrites por host (mismo bug que rompió el `/api` de la app principal).

Se puede probar el ruteo sin cert por **ruta**: `latiendota-tiendas.vercel.app/urban-masters/`, o por host ignorando cert: `curl -k --resolve sub.latiendota.com:443:76.76.21.21 https://sub.latiendota.com/`.

### Pasos para tienda nueva

**Común a ambos casos:**
1. En Vendix: crear el negocio (Premium, con `sync_api_key`) y cargar sus productos.
2. Crear la carpeta `latiendota-tiendas/<slug>/index.html` con su diseño a medida (patrón: copiar una tienda existente y cambiar `CONFIG` — `brandName`, `whatsapp`, `storeKey`, colores/diseño).
3. `vercel --prod --yes` para redeploy del edificio.

**🅱️ SIN dominio propio (subdominio — el camino normal):**
- El nombre de la carpeta (`<slug>`) **debe** ser el subdominio deseado.
- **Colgar el subdominio al edificio para su certificado:** `cd latiendota-tiendas && vercel domains add <slug>.latiendota.com`. ⚠️ Esto SÍ es necesario (la doc vieja decía "no se toca Vercel domains" — era FALSO). El wildcard DNS `A * 76.76.21.21` solo hace que el subdominio *resuelva*, pero con el DNS en GoDaddy **Vercel NO emite el certificado wildcard automáticamente** (necesitaría un TXT de validación DNS-01 que no está puesto). Sin `vercel domains add`, el subdominio falla por SSL. Al agregarlo explícito, Vercel le emite cert por HTTP-01 usando el registro A (sin tocar GoDaddy). Es escalable: son dominios sobre UN solo proyecto, no cuenta contra el límite de proyectos.
- No se toca el registrador. El `vercel.json` solo se toca si agregas un dominio propio (caso 🅰️); para subdominios la regla genérica ya los cubre a todos.
- **Alternativa "cero config"** (si algún día quieres que baste crear carpeta + deploy): emitir el cert **wildcard** `*.latiendota.com` agregando en GoDaddy el TXT de validación que pida Vercel (`_acme-challenge...`). Una vez emitido, ningún subdominio necesita `vercel domains add`. Hoy NO está hecho.

**🅰️ CON dominio propio (ej. `tienda.com`) — pasos extra:**
4. Agregar en `vercel.json` una regla `has host` para `tienda\.com` (y `www\.tienda\.com`) → `/<slug>/:path*`.
5. Colgar el dominio al proyecto `latiendota-tiendas` en Vercel.
6. Configurar el dominio en su registrador (una vez), con el registro que indique Vercel (`A 76.76.21.21` o cambiar nameservers).

| Paso | SIN dominio (subdominio) | CON dominio propio |
|---|---|---|
| Carpeta `latiendota-tiendas/<slug>/index.html` | ✅ | ✅ |
| `vercel domains add <host>` (para el cert) | ✅ (`<slug>.latiendota.com`) | ✅ (el dominio propio) |
| Regla en `vercel.json` | ❌ (la genérica ya cubre) | ✅ (1 línea `has host`) |
| `vercel --prod --yes` (deploy edificio) | ✅ | ✅ |
| Config en registrador | ❌ (ya está el `A * 76.76.21.21`) | ✅ (1 vez) |

### DNS / dominios (infra, fuera del código — lo hace el dueño)
- **Wildcard** `*.latiendota.com` está colgado del proyecto `latiendota-tiendas` y el registro `A * 76.76.21.21` está en GoDaddy (hecho jul 2026). Eso hace que **todos los subdominios RESUELVAN** a Vercel. ⚠️ PERO **no emite certificado SSL**: con el DNS en GoDaddy (no en Vercel), el cert wildcard necesitaría un TXT de validación que no está puesto. Por eso hoy **cada subdominio necesita `vercel domains add <slug>.latiendota.com`** para obtener su propio cert (HTTP-01, sin tocar GoDaddy). Subdominios ya activos con cert: `sabores`, `hypepods-peru`, `peru-waterpolo` (jul 2026).
- **Dominios propios** (ej. `urbanmasters.co`): colgar el dominio a este proyecto y configurarlo en su registrador (uno por dominio). Los links `<proyecto>.vercel.app` no se pueden borrar; para "matarlos" se usa un rewrite/redirect al dominio real o Deployment Protection.

### Directorio automático de tiendas — `tiendas.latiendota.com`
Página que lista TODAS las tiendas del edificio con tarjetas (link + botón copiar). Vive en `latiendota-tiendas/tiendas/index.html` y se **auto-genera**: `build-stores.js` escanea las carpetas del edificio, saca nombre/descripción del `<title>` de cada tienda, y escribe `tiendas/stores.json` (que el directorio lee vía fetch). Corre en cada deploy vía `package.json` → `"build": "node build-stores.js"`. ⚠️ **Como el edificio ahora tiene build, el `vercel.json` DEBE tener `"outputDirectory": "."`** (si no, el deploy falla con "No Output Directory named public"). Overrides opcionales (dominio propio, emoji, color de acento) van en el objeto `OVERRIDES` de `build-stores.js`; carpetas a NO listar (ej. `tienda-demo`) van en `SKIP`. **Flujo tienda nueva:** crear carpeta + `vercel domains add <sub>.latiendota.com` + `vercel --prod` → aparece sola en el directorio (con emoji/color por defecto; para personalizar, 1 línea en OVERRIDES).

### Migración COMPLETADA (jul 2026)
Todas las tiendas que antes eran proyectos Vercel sueltos (`hypepods-peru`, `urban-masters`, `olivia-dips`/`sabores-de-la-abuela`, `peru-waterpolo`) ya están **consolidadas** dentro de `latiendota-tiendas/` y sus proyectos sueltos fueron **BORRADOS** (sus `.vercel.app` dan 404 a propósito). Activas: `sabores.latiendota.com`, `hypepods-peru.latiendota.com`, `peru-waterpolo.latiendota.com`, y `urbanmasters.co`(+www, dominio propio servido desde la carpeta `urban-masters/`). Ya NO queda ningún proyecto Vercel suelto de tiendas. **Al mover un dominio propio que ya está en otro proyecto Vercel: `--force` no basta — hay que borrar el proyecto viejo (eso libera el dominio) y luego `vercel domains add <dominio>` al edificio. Antes de mover, sincroniza la carpeta del edificio a la versión EXACTA que el cliente ve en vivo (descargar el HTML live) para que no vea ningún cambio.**

## Pagos con Culqi por tienda (función Premium)

Hoy el pago es **manual** (Yape QR + captura + el admin marca pagado en Vendix). Culqi está integrado pero **apagado** (`initCulqi` comentado). Activarlo permite **pago con tarjeta/Yape en la propia página**, con confirmación **automática** — buen gancho para el plan Premium.

### Modelo: llaves POR tienda (el dinero cae a la cuenta del dueño)
Culqi liquida a **una cuenta bancaria**. Cada tienda usa **sus propias llaves** (no las del operador de la plataforma), así HypePods cobra a HypePods y Lumé a Lumé. Se guardan **por negocio** (columnas nuevas en `businesses` o filas en `settings`, ej. `culqi_public_key`; la **secreta** solo en lugar seguro — ver abajo).

### Qué pide cada dueño de tienda
1. Cuenta **Culqi verificada** (RUC + datos del negocio).
2. **Llave pública** `pk_live_...` → **no es secreta**, va en el frontend de su tienda.
3. **Llave secreta** `sk_live_...` → es como una **contraseña**. NUNCA hardcodear en el `index.html` ni pegar en el chat. Va como **variable de entorno / config privada del servidor** (por tienda) y se lee **solo en el backend**.

### Flujo de confirmación (por qué es confiable)
1. El cliente paga con `Culqi.js` en la página (usa la **llave pública**) → Culqi devuelve un **token** + código de operación.
2. El **backend** de Vendix recibe ese token y **cobra/verifica contra Culqi con la llave secreta** de ESA tienda. La confirmación válida viene del **servidor↔Culqi**, no del navegador (no se puede falsear).
3. Si Culqi aprueba → marcar la `transaction` como `paid` (equivalente al `mark-paid` manual) y **descontar stock atómicamente** (mismo patrón que `transactions.js`).
4. Respaldo: **webhook** de Culqi → endpoint en Vendix que confirma aunque el cliente cierre la página. Idempotente (no duplicar por código de operación).

### Seguridad (obligatorio)
- La **secreta** solo en env/config del servidor, por tienda; jamás en el repo del storefront ni en el cliente.
- Validar el pago **siempre** en el backend (monto y estado); nunca confiar en lo que reporta el navegador.
- Casos borde: pago rechazado, cliente cierra la página (lo cubre el webhook), devoluciones (refund vía API con la secreta → revertir estado/stock).
