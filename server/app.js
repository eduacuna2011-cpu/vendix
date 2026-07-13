require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app = express();

// En Vercel/proxy el IP real del cliente viene en X-Forwarded-For. Confiar en 1
// salto para que req.ip (y el rate-limit) usen el IP real y no agrupen a todos
// en un solo bucket.
app.set('trust proxy', 1);

// ─── Middleware ───────────────────────────────────────────────────────────────
// CORS de tiendas externas (/api/integration): cualquier origen, sin cookies —
// se autentican con el header X-Store-Key, así que cada storefront (su propio
// dominio *.vercel.app o custom) puede leer productos y registrar ventas.
app.use('/api/integration', cors());
// CORS del panel/app: restringido a FRONTEND_URL y con credenciales (JWT).
const corsAdmin = cors({ origin: process.env.FRONTEND_URL || '*', credentials: true });
app.use((req, res, next) =>
    req.path.startsWith('/api/integration') ? next() : corsAdmin(req, res, next));
app.use(express.json({ limit: '10mb' }));  // 10mb for product images (base64)
app.use(express.urlencoded({ extended: true }));

// ─── Migraciones idempotentes (autoreparación en cada arranque de instancia) ──
require('./migrations').ensureMigrated().catch(err => console.error('migrations:', err));

// ─── API Routes ───────────────────────────────────────────────────────────────
const { trialCheck } = require('./middleware/trialCheck');
const { authMiddleware } = require('./middleware/auth');

app.use('/api/auth',         require('./routes/auth'));
app.use('/api/users',        require('./routes/users'));
app.use('/api/businesses',   require('./routes/businesses'));
app.use('/api/leads',        require('./routes/leads'));

// Business routes — auth ANTES de trialCheck para que req.user exista (el
// trialCheck lo necesita para resolver el negocio). Los routers repiten
// authMiddleware internamente (cache hit, sin costo real).
app.use('/api/sellers',      authMiddleware, trialCheck, require('./routes/sellers'));
app.use('/api/products',     authMiddleware, trialCheck, require('./routes/products'));
app.use('/api/transactions', authMiddleware, trialCheck, require('./routes/transactions'));
app.use('/api/settings',     authMiddleware, trialCheck, require('./routes/settings'));
app.use('/api/tax',          authMiddleware, trialCheck, require('./routes/tax'));

// Public receipt endpoint — no auth
const { publicRouter: receiptPublic } = require('./routes/transactions');
app.use('/api/receipt', receiptPublic);

// ─── Integración tiendas externas (Vercel) — sin JWT, auth por X-Store-Key ────
app.use('/api/integration', require('./routes/integration'));

// ─── Payments (Culqi) — sin auth ni trial check, es la página pública de pago ─
app.use('/api/payments', require('./routes/payments'));

// ─── Telegram bot ─────────────────────────────────────────────────────────────
app.use('/api/telegram', require('./routes/telegram'));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
