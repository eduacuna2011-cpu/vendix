// Local dev server — serves static files + API from the same port
require('dotenv').config();
const express = require('express');
const path    = require('path');
const app     = require('./app');

const PORT = process.env.PORT || 3000;

// Serve static frontend files in dev
app.use(express.static(path.join(__dirname, '..')));

// SPA fallback: unknown routes serve index.html
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, '..', req.path.replace(/^\//, '') || 'index.html'));
    }
});

app.listen(PORT, async () => {
    console.log(`\n  Dev server running at http://localhost:${PORT}\n`);
    // Keep Neon WebSocket connection warm — prevents cold-start latency between requests
    const db = require('./db');
    await db.query('SELECT 1').catch(() => {});
    setInterval(() => db.query('SELECT 1').catch(() => {}), 9000);
});
