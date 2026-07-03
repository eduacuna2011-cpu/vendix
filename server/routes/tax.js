const router = require('express').Router();
const db     = require('../db');
const { authMiddleware, requireBusinessAdmin } = require('../middleware/auth');
const { ensureMigrated } = require('../migrations');

// Las columnas IGV (igv_enabled, igv_rate) las crea server/migrations.js.
ensureMigrated().catch(() => {});

router.use(authMiddleware);

// GET /api/tax — return IGV settings for the caller's business
router.get('/', async (req, res) => {
    try {
        if (!req.user.businessId) return res.json({ igv_enabled: false, igv_rate: 18 });
        const { rows } = await db.query(
            'SELECT igv_enabled, igv_rate FROM businesses WHERE id = $1',
            [req.user.businessId]
        );
        const row = rows[0] || {};
        res.json({ igv_enabled: !!row.igv_enabled, igv_rate: parseFloat(row.igv_rate ?? 18) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/tax — update IGV settings (admin only)
router.put('/', requireBusinessAdmin, async (req, res) => {
    try {
        const { igv_enabled, igv_rate } = req.body;
        if (!req.user.businessId) return res.status(400).json({ error: 'No business' });
        await db.query(
            'UPDATE businesses SET igv_enabled = $1, igv_rate = $2 WHERE id = $3',
            [!!igv_enabled, parseFloat(igv_rate ?? 18), req.user.businessId]
        );
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
