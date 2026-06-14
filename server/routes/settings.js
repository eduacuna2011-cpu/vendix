const router = require('express').Router();
const db     = require('../db');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/settings  — get all settings for current user
router.get('/', async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT key, value FROM settings WHERE user_id = $1',
            [req.user.id]
        );
        const result = {};
        rows.forEach(r => { result[r.key] = r.value; });
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/settings  — upsert one or more keys
router.put('/', async (req, res) => {
    try {
        const entries = Object.entries(req.body);
        for (const [key, value] of entries) {
            await db.query(
                `INSERT INTO settings (user_id, key, value, updated_at)
                 VALUES ($1, $2, $3, NOW())
                 ON CONFLICT (user_id, key) DO UPDATE
                   SET value = EXCLUDED.value, updated_at = NOW()`,
                [req.user.id, key, String(value)]
            );
        }
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
