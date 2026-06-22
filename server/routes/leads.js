// Leads — solicitudes de clientes desde el checkout de la landing page
const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const db      = require('../db');
const { authMiddleware, requireSuperAdmin } = require('../middleware/auth');

// ─── Ensure leads table exists ───────────────────────────────────────────────
const CREATE_SQL = `
    CREATE TABLE IF NOT EXISTS leads (
        id              SERIAL PRIMARY KEY,
        full_name       TEXT NOT NULL,
        business_name   TEXT NOT NULL,
        email           TEXT NOT NULL,
        phone           TEXT NOT NULL,
        plan            TEXT NOT NULL DEFAULT 'negocio',
        biz_type        TEXT,
        status          TEXT NOT NULL DEFAULT 'pending',
        paid            BOOLEAN NOT NULL DEFAULT FALSE,
        account_created BOOLEAN NOT NULL DEFAULT FALSE,
        created_user_id INTEGER,
        notes           TEXT,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
`;

async function ensureTable() {
    await db.query(CREATE_SQL);
}

// POST /api/leads  — PUBLIC, no auth (called from checkout.html)
router.post('/', async (req, res) => {
    try {
        // Always ensure table before first write — handles cold starts safely
        await ensureTable();

        const { fullName, businessName, email, phone, plan, bizType, paid } = req.body;
        if (!fullName || !businessName || !email || !phone) {
            return res.status(400).json({ error: 'fullName, businessName, email and phone are required' });
        }
        const isPaid = paid === true || paid === 'true' || paid === 1 || paid === '1';
        const { rows: [lead] } = await db.query(
            `INSERT INTO leads (full_name, business_name, email, phone, plan, biz_type, paid)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [fullName, businessName, email, phone, plan || 'negocio', bizType || null, isPaid]
        );
        res.status(201).json({ ok: true, id: lead.id });
    } catch (err) {
        console.error('POST /leads error:', err);
        res.status(500).json({ error: 'Server error', detail: err.message });
    }
});

// Everything below requires SuperAdmin
router.use(authMiddleware, requireSuperAdmin);

// GET /api/leads  — list all leads
router.get('/', async (req, res) => {
    try {
        await ensureTable();
        const { rows } = await db.query(
            `SELECT * FROM leads ORDER BY created_at DESC`
        );
        res.json(rows);
    } catch (err) {
        console.error('GET /leads error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/leads/count  — count of unread (not account_created) leads for badge
router.get('/count', async (req, res) => {
    try {
        await ensureTable();
        const { rows: [r] } = await db.query(
            `SELECT COUNT(*) AS count FROM leads WHERE account_created = FALSE`
        );
        res.json({ count: parseInt(r.count) });
    } catch (err) {
        res.json({ count: 0 });
    }
});

// PATCH /api/leads/:id/mark-paid  — toggle paid status
router.patch('/:id/mark-paid', async (req, res) => {
    try {
        const { rows: [lead] } = await db.query(
            `UPDATE leads SET paid = NOT paid WHERE id = $1 RETURNING *`,
            [req.params.id]
        );
        if (!lead) return res.status(404).json({ error: 'Not found' });
        res.json(lead);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PATCH /api/leads/:id/notes  — save notes
router.patch('/:id/notes', async (req, res) => {
    try {
        const { notes } = req.body;
        const { rows: [lead] } = await db.query(
            `UPDATE leads SET notes = $1 WHERE id = $2 RETURNING *`,
            [notes, req.params.id]
        );
        if (!lead) return res.status(404).json({ error: 'Not found' });
        res.json(lead);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/leads/:id/create-account  — create business + admin user from lead
router.post('/:id/create-account', async (req, res) => {
    const client = await db.getClient();
    try {
        const { rows: [lead] } = await db.query('SELECT * FROM leads WHERE id = $1', [req.params.id]);
        if (!lead) return res.status(404).json({ error: 'Lead not found' });
        if (lead.account_created) return res.status(400).json({ error: 'Account already created' });

        await client.query('BEGIN');

        // Ensure trial columns exist
        await client.query(`
            ALTER TABLE businesses
                ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
                ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT FALSE
        `);

        // Solicitud pagada → cuenta activa sin trial (trial 0).
        // Solicitud no pagada → 3 días de prueba.
        let biz;
        if (lead.paid) {
            ({ rows: [biz] } = await client.query(
                `INSERT INTO businesses (name, status, trial_ends_at, is_paid)
                 VALUES ($1, 'Active', NULL, TRUE) RETURNING *`,
                [lead.business_name]
            ));
        } else {
            const trialEnd = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
            ({ rows: [biz] } = await client.query(
                `INSERT INTO businesses (name, status, trial_ends_at, is_paid)
                 VALUES ($1, 'Active', $2, FALSE) RETURNING *`,
                [lead.business_name, trialEnd]
            ));
        }

        // Generate username + temp password
        const base = lead.business_name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15) || 'biz';
        const username = `${base}${Math.floor(Math.random() * 1000)}`;
        const tempPassword = generatePassword();
        const hash = await bcrypt.hash(tempPassword, 10);

        const { rows: [user] } = await client.query(
            `INSERT INTO users
               (business_id, business_name, full_name, username, email, phone,
                password_hash, role, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,'Business Admin','Active')
             RETURNING id, username, full_name, email, business_id, business_name, status`,
            [biz.id, lead.business_name, lead.full_name, username,
             lead.email || null, lead.phone || null, hash]
        );

        // Mark lead as created
        await client.query(
            `UPDATE leads SET account_created = TRUE, status = 'created', created_user_id = $1 WHERE id = $2`,
            [user.id, lead.id]
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

function generatePassword(length = 12) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
    let pw = '';
    for (let i = 0; i < length; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    return pw;
}

module.exports = router;
