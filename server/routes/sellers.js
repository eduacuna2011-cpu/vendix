const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db     = require('../db');
const { authMiddleware, requireBusinessAdmin } = require('../middleware/auth');

router.use(authMiddleware);

function generatePassword(length = 12) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
    let pw = '';
    for (let i = 0; i < length; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    return pw;
}

function scopeFilter(req) {
    // Super Admin sees all, Business Admin sees own business
    if (req.user.role === 'Super Admin') return { where: '', params: [] };
    return { where: 'AND u.business_id = $1', params: [req.user.businessId] };
}

// GET /api/sellers
router.get('/', async (req, res) => {
    try {
        const { q, status } = req.query;
        const scope = scopeFilter(req);
        const params = [...scope.params];

        let sql = `
            SELECT u.id, u.full_name, u.username, u.email, u.phone,
                   u.status, u.commission_percentage, u.join_date, u.business_id,
                   u.business_name,
                   COALESCE(tx.total_orders,0) AS total_orders,
                   COALESCE(tx.total_sales,0)  AS total_sales,
                   COALESCE(tx.total_profit,0) AS total_profit
            FROM users u
            LEFT JOIN (
                SELECT seller_id,
                       COUNT(*)         AS total_orders,
                       SUM(total)       AS total_sales,
                       SUM(profit)      AS total_profit
                FROM transactions
                GROUP BY seller_id
            ) tx ON tx.seller_id = u.id
            WHERE u.role = 'Seller' ${scope.where}
        `;

        if (status && status !== 'all') {
            params.push(status);
            sql += ` AND u.status = $${params.length}`;
        }
        if (q) {
            params.push(`%${q}%`);
            const n = params.length;
            sql += ` AND (u.full_name ILIKE $${n} OR u.username ILIKE $${n} OR u.email ILIKE $${n})`;
        }
        sql += ' ORDER BY u.join_date DESC';

        const { rows } = await db.query(sql, params);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/sellers/stats
router.get('/stats', async (req, res) => {
    try {
        const scope = scopeFilter(req);
        const { rows: [r] } = await db.query(
            `SELECT COUNT(*) AS total,
                    COUNT(*) FILTER (WHERE u.status = 'Active') AS active,
                    COALESCE(SUM(tx.total),0) AS total_sales,
                    COALESCE(SUM(tx.total * u.commission_percentage / 100),0) AS total_commission
             FROM users u
             LEFT JOIN transactions tx ON tx.seller_id = u.id
             WHERE u.role = 'Seller' ${scope.where}`,
            scope.params
        );
        res.json({
            totalSellers:     parseInt(r.total),
            activeSellers:    parseInt(r.active),
            totalSales:       parseFloat(r.total_sales),
            totalCommission:  parseFloat(r.total_commission)
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/sellers/:id
router.get('/:id', async (req, res) => {
    try {
        const { rows: [u] } = await db.query(
            'SELECT * FROM users WHERE id = $1 AND role = $2',
            [req.params.id, 'Seller']
        );
        if (!u) return res.status(404).json({ error: 'Not found' });
        res.json(u);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/sellers
router.post('/', requireBusinessAdmin, async (req, res) => {
    try {
        const { fullName, username, email, phone, commissionPercentage, status } = req.body;
        if (!fullName || !username) return res.status(400).json({ error: 'fullName and username required' });

        // Check duplicate username
        const { rows: existing } = await db.query(
            'SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [username]
        );
        if (existing.length) return res.status(409).json({ error: 'Username already exists' });

        const tempPassword = generatePassword();
        const hash = await bcrypt.hash(tempPassword, 10);

        const bizId   = req.user.role === 'Super Admin' ? (req.body.businessId || null) : req.user.businessId;
        const bizName = req.user.businessName || null;

        const { rows: [seller] } = await db.query(
            `INSERT INTO users
               (business_id, business_name, full_name, username, email, phone,
                password_hash, role, status, commission_percentage, join_date)
             VALUES ($1,$2,$3,$4,$5,$6,$7,'Seller',$8,$9,NOW())
             RETURNING id, full_name, username, email, phone, status,
                       commission_percentage, join_date, business_id`,
            [bizId, bizName, fullName, username, email || null, phone || null,
             hash, status || 'Active', parseFloat(commissionPercentage) || 0]
        );

        res.status(201).json({ seller, temporaryPassword: tempPassword });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/sellers/:id
router.put('/:id', requireBusinessAdmin, async (req, res) => {
    try {
        const { fullName, email, phone, commissionPercentage, status } = req.body;
        const { rows: [u] } = await db.query(
            `UPDATE users
             SET full_name             = COALESCE($1, full_name),
                 email                 = COALESCE($2, email),
                 phone                 = COALESCE($3, phone),
                 commission_percentage = COALESCE($4, commission_percentage),
                 status                = COALESCE($5, status)
             WHERE id = $6 AND role = 'Seller'
             RETURNING id, full_name, username, email, phone, status, commission_percentage, join_date`,
            [fullName, email, phone,
             commissionPercentage !== undefined ? parseFloat(commissionPercentage) : null,
             status, req.params.id]
        );
        if (!u) return res.status(404).json({ error: 'Not found' });
        res.json(u);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/sellers/:id
router.delete('/:id', requireBusinessAdmin, async (req, res) => {
    try {
        const { rowCount } = await db.query(
            'DELETE FROM users WHERE id = $1 AND role = $2', [req.params.id, 'Seller']
        );
        if (!rowCount) return res.status(404).json({ error: 'Not found' });
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/sellers/:id/reset-password
router.post('/:id/reset-password', requireBusinessAdmin, async (req, res) => {
    try {
        const newPassword = generatePassword();
        const hash = await bcrypt.hash(newPassword, 10);
        const { rows: [u] } = await db.query(
            'UPDATE users SET password_hash = $1 WHERE id = $2 AND role = $3 RETURNING username, full_name',
            [hash, req.params.id, 'Seller']
        );
        if (!u) return res.status(404).json({ error: 'Not found' });
        res.json({ fullName: u.full_name, username: u.username, temporaryPassword: newPassword });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
