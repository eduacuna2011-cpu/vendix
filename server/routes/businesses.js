const router = require('express').Router();
const db     = require('../db');
const { authMiddleware, requireSuperAdmin } = require('../middleware/auth');

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

module.exports = router;
