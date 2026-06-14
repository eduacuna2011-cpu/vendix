require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));  // 10mb for product images (base64)
app.use(express.urlencoded({ extended: true }));

// ─── API Routes ───────────────────────────────────────────────────────────────
const { trialCheck } = require('./middleware/trialCheck');

app.use('/api/auth',         require('./routes/auth'));
app.use('/api/users',        require('./routes/users'));
app.use('/api/businesses',   require('./routes/businesses'));
app.use('/api/leads',        require('./routes/leads'));

// Business routes — protected by trial check
app.use('/api/sellers',      trialCheck, require('./routes/sellers'));
app.use('/api/products',     trialCheck, require('./routes/products'));
app.use('/api/transactions', trialCheck, require('./routes/transactions'));
app.use('/api/settings',     trialCheck, require('./routes/settings'));
app.use('/api/tax',          trialCheck, require('./routes/tax'));

// Public receipt endpoint — no auth
const { publicRouter: receiptPublic } = require('./routes/transactions');
app.use('/api/receipt', receiptPublic);

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
