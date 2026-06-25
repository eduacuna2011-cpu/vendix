const router = require('express').Router();
const db     = require('../db');
const { authMiddleware, requireSuperAdmin } = require('../middleware/auth');
const { ensureSyncColumns, generateSyncKey } = require('./integration');

router.use(authMiddleware, requireSuperAdmin);

// GET /api/businesses
router.get('/', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM businesses ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ── Integración con tienda Vercel (solo Super Admin) ──────────────────────────

// GET /api/businesses/:id/integration — estado de la conexión de la tienda
router.get('/:id/integration', async (req, res) => {
    try {
        await ensureSyncColumns();
        const { rows: [b] } = await db.query(
            'SELECT id, name, vercel_store_id, sync_api_key, sync_enabled FROM businesses WHERE id = $1',
            [req.params.id]
        );
        if (!b) return res.status(404).json({ error: 'Not found' });
        res.json(b);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/businesses/:id/integration — guarda el store id y (re)genera la llave
// body: { vercelStoreId, sync_enabled?, regenerateKey? }
router.put('/:id/integration', async (req, res) => {
    try {
        await ensureSyncColumns();
        const { vercelStoreId, sync_enabled, regenerateKey } = req.body;

        const { rows: [cur] } = await db.query(
            'SELECT sync_api_key FROM businesses WHERE id = $1', [req.params.id]
        );
        if (!cur) return res.status(404).json({ error: 'Not found' });

        // Genera una llave si no hay, o si piden regenerarla
        const key = (regenerateKey || !cur.sync_api_key) ? generateSyncKey() : cur.sync_api_key;

        const { rows: [b] } = await db.query(
            `UPDATE businesses SET
                 vercel_store_id = COALESCE($1, vercel_store_id),
                 sync_api_key    = $2,
                 sync_enabled    = COALESCE($3, sync_enabled)
             WHERE id = $4
             RETURNING id, name, vercel_store_id, sync_api_key, sync_enabled`,
            [vercelStoreId !== undefined ? (vercelStoreId || null) : null,
             key,
             sync_enabled !== undefined ? !!sync_enabled : null,
             req.params.id]
        );
        res.json(b);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
