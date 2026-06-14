// Super Admin — manage Business Admin accounts + businesses
const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const db      = require('../db');
const { authMiddleware, requireSuperAdmin } = require('../middleware/auth');

router.use(authMiddleware, requireSuperAdmin);

// GET /api/users  — list all Business Admins with their business
router.get('/', async (req, res) => {
    try {
        const { q, status } = req.query;
        let sql = `
            SELECT u.id, u.username, u.full_name, u.email, u.phone,
                   u.role, u.status, u.business_id, u.business_name,
                   u.created_at, b.name AS biz_name, b.status AS biz_status,
                   b.trial_ends_at, b.is_paid
            FROM users u
            LEFT JOIN businesses b ON b.id = u.business_id
            WHERE u.role = 'Business Admin'
        `;
        const params = [];
        if (status && status !== 'all') {
            params.push(status);
            sql += ` AND u.status = $${params.length}`;
        }
        if (q) {
            params.push(`%${q}%`);
            const n = params.length;
            sql += ` AND (u.full_name ILIKE $${n} OR u.username ILIKE $${n} OR u.email ILIKE $${n} OR u.business_name ILIKE $${n})`;
        }
        sql += ' ORDER BY u.created_at DESC';
        const { rows } = await db.query(sql, params);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/users/stats
router.get('/stats', async (req, res) => {
    try {
        const [bizR, txR, monthR] = await Promise.all([
            db.query(`SELECT COUNT(*) AS total,
                             COUNT(*) FILTER (WHERE status = 'Active') AS active
                      FROM users WHERE role = 'Business Admin'`),
            db.query(`SELECT COALESCE(SUM(total), 0) AS revenue FROM transactions`),
            db.query(`SELECT COUNT(*) AS count FROM users
                      WHERE role = 'Business Admin'
                        AND date_trunc('month', created_at) = date_trunc('month', NOW())`)
        ]);
        res.json({
            totalBusinesses:    parseInt(bizR.rows[0].total),
            activeBusinesses:   parseInt(bizR.rows[0].active),
            totalRevenue:       parseFloat(txR.rows[0].revenue),
            createdThisMonth:   parseInt(monthR.rows[0].count)
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/users/:id/profile  — business profile + stats for modal
router.get('/:id/profile', async (req, res) => {
    try {
        const { rows: [u] } = await db.query(
            'SELECT * FROM users WHERE id = $1 AND role = $2',
            [req.params.id, 'Business Admin']
        );
        if (!u) return res.status(404).json({ error: 'Not found' });

        const [prodR, txR, sellerR] = await Promise.all([
            db.query('SELECT COUNT(*) AS c FROM products WHERE business_id = $1', [u.business_id]),
            db.query('SELECT COUNT(*) AS c, COALESCE(SUM(total),0) AS rev, COALESCE(SUM(profit),0) AS prof FROM transactions WHERE business_id = $1', [u.business_id]),
            db.query(`SELECT id, full_name, username, email, phone, status
                      FROM users WHERE business_id = $1 AND role = 'Seller'`, [u.business_id])
        ]);

        res.json({
            user: u,
            stats: {
                totalProducts: parseInt(prodR.rows[0].c),
                totalOrders:   parseInt(txR.rows[0].c),
                totalSales:    parseFloat(txR.rows[0].rev),
                totalProfit:   parseFloat(txR.rows[0].prof),
                totalSellers:  sellerR.rows.length,
                activeSellers: sellerR.rows.filter(s => s.status === 'Active').length
            },
            sellers: sellerR.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/users  — create business + admin user
router.post('/', async (req, res) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        const { businessName, fullName, email, phone } = req.body;
        if (!businessName || !fullName) {
            return res.status(400).json({ error: 'businessName and fullName required' });
        }

        // Create business
        const { rows: [biz] } = await client.query(
            `INSERT INTO businesses (name, status) VALUES ($1, 'Active') RETURNING *`,
            [businessName]
        );

        // Generate username + password
        const base = businessName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15) || 'biz';
        const username = `${base}${Math.floor(Math.random() * 1000)}`;
        const tempPassword = generatePassword();
        const hash = await bcrypt.hash(tempPassword, 10);

        const { rows: [user] } = await client.query(
            `INSERT INTO users
               (business_id, business_name, full_name, username, email, phone,
                password_hash, role, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,'Business Admin','Active')
             RETURNING id, username, full_name, email, business_id, business_name, status, created_at`,
            [biz.id, businessName, fullName, username, email || null, phone || null, hash]
        );

        await client.query('COMMIT');
        res.status(201).json({ user, business: biz, temporaryPassword: tempPassword });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
});

// PUT /api/users/:id
router.put('/:id', async (req, res) => {
    try {
        const { businessName, fullName, email, phone, status } = req.body;
        const { rows: [u] } = await db.query(
            `UPDATE users
             SET business_name = COALESCE($1, business_name),
                 full_name     = COALESCE($2, full_name),
                 email         = COALESCE($3, email),
                 phone         = COALESCE($4, phone),
                 status        = COALESCE($5, status)
             WHERE id = $6 AND role = 'Business Admin'
             RETURNING *`,
            [businessName, fullName, email, phone, status, req.params.id]
        );
        if (!u) return res.status(404).json({ error: 'Not found' });

        // Sync business name
        if (businessName && u.business_id) {
            await db.query('UPDATE businesses SET name = $1 WHERE id = $2', [businessName, u.business_id]);
        }
        res.json(u);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PATCH /api/users/:id/toggle-status
router.patch('/:id/toggle-status', async (req, res) => {
    try {
        const { rows: [current] } = await db.query('SELECT status FROM users WHERE id = $1', [req.params.id]);
        if (!current) return res.status(404).json({ error: 'Not found' });
        const newStatus = current.status === 'Active' ? 'Disabled' : 'Active';
        await db.query('UPDATE users SET status = $1 WHERE id = $2', [newStatus, req.params.id]);
        res.json({ status: newStatus });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/users/:id
router.delete('/:id', async (req, res) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        const { rows: [u] } = await client.query('SELECT business_id FROM users WHERE id = $1', [req.params.id]);
        if (!u) return res.status(404).json({ error: 'Not found' });
        await client.query('DELETE FROM users WHERE id = $1', [req.params.id]);
        if (u.business_id) {
            await client.query('DELETE FROM businesses WHERE id = $1', [u.business_id]);
        }
        await client.query('COMMIT');
        res.json({ ok: true });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
});

// GET /api/users/:id/credentials  — return plaintext password (stored at creation only)
// In production you'd email them instead. This matches the current UX.
router.get('/:id/credentials', async (req, res) => {
    res.status(410).json({ error: 'Passwords are hashed — use reset-password instead' });
});

// POST /api/users/:id/reset-password
router.post('/:id/reset-password', async (req, res) => {
    try {
        const newPassword = generatePassword();
        const hash = await bcrypt.hash(newPassword, 10);
        const { rows: [u] } = await db.query(
            'UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING username, full_name',
            [hash, req.params.id]
        );
        if (!u) return res.status(404).json({ error: 'Not found' });
        res.json({ username: u.username, temporaryPassword: newPassword });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PATCH /api/users/:id/mark-paid  — mark business as paid (unlocks after trial)
router.patch('/:id/mark-paid', async (req, res) => {
    try {
        const { rows: [u] } = await db.query(
            'SELECT business_id FROM users WHERE id = $1 AND role = $2',
            [req.params.id, 'Business Admin']
        );
        if (!u || !u.business_id) return res.status(404).json({ error: 'Not found' });
        await db.query(
            'UPDATE businesses SET is_paid = TRUE WHERE id = $1',
            [u.business_id]
        );
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PATCH /api/users/:id/extend-trial  — extend trial by N days
router.patch('/:id/extend-trial', async (req, res) => {
    try {
        const days = parseInt(req.body.days) || 7;
        const { rows: [u] } = await db.query(
            'SELECT business_id FROM users WHERE id = $1 AND role = $2',
            [req.params.id, 'Business Admin']
        );
        if (!u || !u.business_id) return res.status(404).json({ error: 'Not found' });
        await db.query(
            `UPDATE businesses
             SET trial_ends_at = GREATEST(NOW(), COALESCE(trial_ends_at, NOW())) + ($1 || ' days')::INTERVAL
             WHERE id = $2`,
            [days, u.business_id]
        );
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

function generatePassword(length = 12) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
    let pw = '';
    for (let i = 0; i < length; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    return pw;
}

// DELETE /api/users/factory-reset  — wipe everything except super admin
router.delete('/factory-reset', async (req, res) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM transaction_items');
        await client.query('DELETE FROM transactions');
        await client.query('DELETE FROM products');
        await client.query("DELETE FROM users WHERE role != 'Super Admin'");
        await client.query('DELETE FROM businesses');
        await client.query('COMMIT');
        res.json({ ok: true });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
});

module.exports = router;
