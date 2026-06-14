const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const db     = require('../db');

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        const { rows } = await db.query(
            `SELECT u.*, b.name AS business_name_from_biz
             FROM users u
             LEFT JOIN businesses b ON b.id = u.business_id
             WHERE LOWER(u.username) = LOWER($1)
             LIMIT 1`,
            [username.trim()]
        );

        const user = rows[0];
        if (!user) return res.status(401).json({ error: 'Invalid username or password' });

        if (user.status !== 'Active') {
            return res.status(403).json({ error: 'Account is disabled' });
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(401).json({ error: 'Invalid username or password' });

        const payload = {
            id:           user.id,
            username:     user.username,
            fullName:     user.full_name,
            role:         user.role,
            businessId:   user.business_id,
            businessName: user.business_name || user.business_name_from_biz
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRES_IN || '7d'
        });

        res.json({ token, user: payload });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/auth/logout  (client just drops the token, but we log it)
router.post('/logout', (req, res) => {
    res.json({ ok: true });
});

// PUT /api/auth/profile  — update own full_name / email (any authenticated user)
router.put('/profile', async (req, res) => {
    const header = req.headers['authorization'];
    if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
    try {
        const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
        const { fullName, email } = req.body;
        if (!fullName || !fullName.trim()) return res.status(400).json({ error: 'Full name required' });
        await db.query(
            'UPDATE users SET full_name = $1, email = $2 WHERE id = $3',
            [fullName.trim(), email ? email.trim() : null, payload.id]
        );
        res.json({ ok: true });
    } catch {
        res.status(401).json({ error: 'Invalid token' });
    }
});

// POST /api/auth/change-password  — verify current password, set new one
router.post('/change-password', async (req, res) => {
    const header = req.headers['authorization'];
    if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
    try {
        const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });

        const { rows } = await db.query('SELECT password_hash FROM users WHERE id = $1', [payload.id]);
        if (!rows[0]) return res.status(404).json({ error: 'User not found' });

        const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
        if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });

        const hash = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, payload.id]);
        res.json({ ok: true });
    } catch {
        res.status(401).json({ error: 'Invalid token' });
    }
});

// POST /api/auth/change-username  — verify password, set new username
router.post('/change-username', async (req, res) => {
    const header = req.headers['authorization'];
    if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
    try {
        const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
        const { newUsername, currentPassword } = req.body;
        if (!newUsername || !currentPassword) return res.status(400).json({ error: 'Username and password required' });
        if (newUsername.length < 3 || !/^[a-zA-Z0-9_]+$/.test(newUsername)) {
            return res.status(400).json({ error: 'Invalid username format' });
        }

        const { rows } = await db.query('SELECT password_hash FROM users WHERE id = $1', [payload.id]);
        if (!rows[0]) return res.status(404).json({ error: 'User not found' });

        const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
        if (!valid) return res.status(400).json({ error: 'Incorrect password' });

        const { rows: existing } = await db.query(
            'SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND id != $2', [newUsername, payload.id]
        );
        if (existing.length) return res.status(400).json({ error: 'Username already taken' });

        await db.query('UPDATE users SET username = $1 WHERE id = $2', [newUsername, payload.id]);
        res.json({ ok: true });
    } catch {
        res.status(401).json({ error: 'Invalid token' });
    }
});

// GET /api/auth/me  — verify token & return fresh user data
router.get('/me', async (req, res) => {
    const header = req.headers['authorization'];
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token' });
    }
    try {
        const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
        const { rows } = await db.query(
            'SELECT id, username, full_name, role, business_id, status FROM users WHERE id = $1',
            [payload.id]
        );
        if (!rows[0]) return res.status(404).json({ error: 'User not found' });
        res.json(rows[0]);
    } catch {
        res.status(401).json({ error: 'Invalid token' });
    }
});

module.exports = router;
