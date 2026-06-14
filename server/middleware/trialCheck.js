const db = require('../db');

// Run once at startup to add columns if missing
let columnsReady = false;
async function ensureTrialColumns() {
    if (columnsReady) return;
    await db.query(`
        ALTER TABLE businesses
            ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT FALSE
    `);
    columnsReady = true;
}
ensureTrialColumns().catch(console.error);

// Middleware — blocks expired trials for non-SuperAdmin users
async function trialCheck(req, res, next) {
    const user = req.user;
    if (!user) return next();
    if (user.role === 'Super Admin') return next();
    if (!user.business_id) return next();

    try {
        await ensureTrialColumns();
        const { rows: [biz] } = await db.query(
            'SELECT trial_ends_at, is_paid, status FROM businesses WHERE id = $1',
            [user.business_id]
        );
        if (!biz) return next();
        if (biz.is_paid) return next();

        // Suspended by cron (expired trial)
        if (biz.status === 'Suspended') {
            return res.status(403).json({
                error:   'trial_expired',
                message: 'Tu período de prueba ha terminado. Contacta a soporte para continuar.',
            });
        }

        if (!biz.trial_ends_at) return next(); // no trial set = unrestricted

        if (new Date(biz.trial_ends_at) < new Date()) {
            return res.status(403).json({
                error:   'trial_expired',
                message: 'Tu período de prueba ha terminado. Contacta a soporte para continuar.',
                trialEndsAt: biz.trial_ends_at
            });
        }
        next();
    } catch (err) {
        console.error('trialCheck error:', err);
        next(); // fail open — don't block on DB error
    }
}

module.exports = { trialCheck, ensureTrialColumns };
