// Vercel Cron Job — runs daily at 8 AM Lima time (13:00 UTC)
// Suspends businesses whose trial expired and haven't paid
// Notifies SA via Telegram bot

const { neon } = require('@neondatabase/serverless');

function getSQL() { return neon(process.env.DATABASE_URL); }
async function q(text, params) {
    const sql = getSQL();
    const rows = await sql.query(text, params || []);
    return { rows: Array.isArray(rows) ? rows : [] };
}

async function notifyTelegram(message) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return;
    // Find all Super Admin telegram_chat_ids
    const { rows } = await q(`
        SELECT u.telegram_chat_id FROM users u
        WHERE u.role = 'Super Admin' AND u.telegram_chat_id IS NOT NULL
    `);
    for (const row of rows) {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: row.telegram_chat_id, text: message, parse_mode: 'HTML' }),
        }).catch(() => {});
    }
}

module.exports = async function handler(req, res) {
    // Protect: only Vercel cron or internal calls
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        // Find newly expired trials (expired in last 25h to avoid missing any)
        const { rows: expired } = await q(`
            SELECT b.id, b.name, u.full_name, u.email, u.phone
            FROM businesses b
            LEFT JOIN users u ON u.business_id = b.id AND u.role = 'Business Admin'
            WHERE b.is_paid = FALSE
              AND b.trial_ends_at IS NOT NULL
              AND b.trial_ends_at < NOW()
              AND b.status != 'Suspended'
        `);

        if (expired.length === 0) {
            return res.json({ ok: true, suspended: 0, message: 'No expired trials found' });
        }

        // Mark them as Suspended
        const ids = expired.map(b => b.id);
        await q(
            `UPDATE businesses SET status = 'Suspended' WHERE id = ANY($1::int[])`,
            [ids]
        );

        // Notify SA
        const list = expired.map(b => `• <b>${b.name}</b> — ${b.full_name || '—'}`).join('\n');
        await notifyTelegram(
            `⚠️ <b>Trials vencidos — ${expired.length} negocio(s) suspendido(s)</b>\n\n${list}\n\n` +
            `Usa /start en el bot para gestionar sus cuentas.`
        );

        return res.json({ ok: true, suspended: expired.length, businesses: expired.map(b => b.name) });
    } catch (err) {
        console.error('Cron error:', err);
        return res.status(500).json({ error: err.message });
    }
};
