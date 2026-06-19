const router = require('express').Router();
const db     = require('../db');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/settings  — get all settings for current user
// Uses DISTINCT ON to return the most recent value per key (safe even with duplicate rows)
router.get('/', async (req, res) => {
    try {
        const { rows } = await db.query(
            `SELECT DISTINCT ON (key) key, value
             FROM settings
             WHERE user_id = $1
             ORDER BY key, updated_at DESC`,
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

// PUT /api/settings  — update existing key or insert if new
// Does UPDATE first, then INSERT only if no row existed.
// Works correctly whether or not the UNIQUE constraint exists on the table.
router.put('/', async (req, res) => {
    try {
        const entries = Object.entries(req.body);
        for (const [key, value] of entries) {
            const { rowCount } = await db.query(
                `UPDATE settings SET value = $3, updated_at = NOW()
                 WHERE user_id = $1 AND key = $2`,
                [req.user.id, key, String(value)]
            );
            if (rowCount === 0) {
                await db.query(
                    `INSERT INTO settings (user_id, key, value, updated_at)
                     VALUES ($1, $2, $3, NOW())`,
                    [req.user.id, key, String(value)]
                );
            }
        }
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
