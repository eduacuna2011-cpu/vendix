// ══════════════════════════════════════════════════════════════════════════════
// Vendix Telegram Bot — roles: Super Admin / Business Admin / Seller
// ══════════════════════════════════════════════════════════════════════════════
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { neon } = require('@neondatabase/serverless');

// HTTP-based Neon client — no WebSocket, no cold start issues
function getSQL() {
    return neon(process.env.DATABASE_URL);
}

// Wrap to match pg Pool result shape { rows: [...] }
async function q(text, params) {
    const sql = getSQL();
    const rows = await sql.query(text, params || []);
    return { rows: Array.isArray(rows) ? rows : [] };
}

// For transactions we still need the pool
const db = require('../db');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API   = `https://api.telegram.org/bot${TOKEN}`;

// ─── Telegram helpers ─────────────────────────────────────────────────────────
async function tg(method, body) {
    const res = await fetch(`${API}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return res.json();
}
const send = (chatId, text, extra = {}) =>
    tg('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...extra });
const answerCb = (id) => tg('answerCallbackQuery', { callback_query_id: id });

// ─── DB session ───────────────────────────────────────────────────────────────
async function getSession(chatId) {
    try {
        await q(`
            CREATE TABLE IF NOT EXISTS telegram_sessions (
                chat_id    BIGINT PRIMARY KEY,
                user_id    INTEGER,
                state      TEXT DEFAULT 'idle',
                data       JSONB DEFAULT '{}',
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )`);
    } catch (_) {}
    const { rows: [s] } = await q('SELECT * FROM telegram_sessions WHERE chat_id=$1', [chatId]);
    return s || { chat_id: chatId, user_id: null, state: 'idle', data: {} };
}
async function saveSession(chatId, patch) {
    const s = await getSession(chatId);
    const merged = { ...s, ...patch, data: { ...(s.data || {}), ...(patch.data || {}) } };
    await q(`
        INSERT INTO telegram_sessions (chat_id,user_id,state,data,updated_at)
        VALUES ($1,$2,$3,$4,NOW())
        ON CONFLICT (chat_id) DO UPDATE SET user_id=$2,state=$3,data=$4,updated_at=NOW()
    `, [chatId, merged.user_id, merged.state, JSON.stringify(merged.data)]);
    return merged;
}
async function resetSession(chatId, keepUser = true) {
    const s = await getSession(chatId);
    await q(`UPDATE telegram_sessions SET state='idle',data='{}',updated_at=NOW() WHERE chat_id=$1`, [chatId]);
    return keepUser ? s.user_id : null;
}

// ─── User lookup ──────────────────────────────────────────────────────────────
async function getUser(session) {
    if (!session.user_id) return null;
    const { rows: [u] } = await q('SELECT * FROM users WHERE id=$1', [session.user_id]);
    return u || null;
}

const BASE_URL = 'https://inventory-sales-dashboard-postgres.vercel.app';
const magicLink = (username, pw) => {
    const token = Buffer.from(JSON.stringify({ u: username, p: pw })).toString('base64');
    return `${BASE_URL}/login.html?auto=${token}`;
};

const isSA    = u => u.role === 'Super Admin';
const isAdmin = u => u.role === 'Business Admin' || isSA(u);
const isSeller= u => u.role === 'Seller';
const sol     = n => `S/. ${parseFloat(n || 0).toFixed(2)}`;

const CANCEL_KB = { inline_keyboard: [[{ text: '❌ Cancelar', callback_data: 'cancel' }]] };

// ══════════════════════════════════════════════════════════════════════════════
// MENUS POR ROL
// ══════════════════════════════════════════════════════════════════════════════
function getMenu(user) {
    if (isSA(user)) return {
        text: `👋 <b>${user.full_name}</b> — Super Admin\n\n¿Qué deseas hacer?`,
        reply_markup: { inline_keyboard: [
            [{ text: '📊 Stats de la plataforma', callback_data: 'sa_stats'   }],
            [{ text: '📋 Solicitudes pendientes', callback_data: 'sa_leads'   }],
            [{ text: '➕ Crear negocio/usuario',  callback_data: 'sa_create'  }],
            [{ text: '👥 Gestionar usuarios',     callback_data: 'sa_manage'  }],
            [{ text: '🚪 Cerrar sesión',          callback_data: 'logout'     }],
        ]}
    };
    if (isAdmin(user)) return {
        text: `👋 <b>${user.full_name}</b>\n🏢 ${user.business_name || ''}\n\n¿Qué deseas hacer?`,
        reply_markup: { inline_keyboard: [
            [{ text: '📊 Estadísticas del día',  callback_data: 'stats_today'  }],
            [{ text: '📦 Inventario',            callback_data: 'inventory'    },
             { text: '⚠️ Stock bajo',            callback_data: 'low_stock'    }],
            [{ text: '💰 Registrar venta',       callback_data: 'new_sale'     }],
            [{ text: '🕐 Ventas recientes',      callback_data: 'recent_sales' }],
            [{ text: '➕ Agregar producto',      callback_data: 'add_product'  },
             { text: '👥 Agregar vendedor',      callback_data: 'add_seller'   }],
            [{ text: '🏆 Top vendedores',        callback_data: 'top_sellers'  }],
            [{ text: '🚪 Cerrar sesión',         callback_data: 'logout'       }],
        ]}
    };
    // Seller
    return {
        text: `👋 <b>${user.full_name}</b> — Vendedor\n🏢 ${user.business_name || ''}\n\n¿Qué deseas hacer?`,
        reply_markup: { inline_keyboard: [
            [{ text: '💰 Registrar venta',      callback_data: 'new_sale'     }],
            [{ text: '📦 Ver inventario',        callback_data: 'inventory'    }],
            [{ text: '📊 Mis ventas del día',    callback_data: 'my_sales'     }],
            [{ text: '🚪 Cerrar sesión',         callback_data: 'logout'       }],
        ]}
    };
}

async function showMenu(chatId, user) {
    const m = getMenu(user);
    await send(chatId, m.text, { reply_markup: m.reply_markup });
}

// ══════════════════════════════════════════════════════════════════════════════
// LOGIN FLOW
// ══════════════════════════════════════════════════════════════════════════════
async function handleLogin(chatId, text, session) {
    if (!session.state || session.state === 'idle' || session.state === 'login_start') {
        await saveSession(chatId, { state: 'login_user' });
        return send(chatId, `👋 <b>Bienvenido a Vendix Bot!</b>\n\nEscribe tu <b>usuario</b>:`, { reply_markup: CANCEL_KB });
    }
    if (session.state === 'login_user') {
        await saveSession(chatId, { state: 'login_pass', data: { username: text } });
        return send(chatId, `🔑 Ahora escribe tu <b>contraseña</b>:`, { reply_markup: CANCEL_KB });
    }
    if (session.state === 'login_pass') {
        const { rows: [u] } = await q(
            `SELECT * FROM users WHERE LOWER(username)=LOWER($1) AND status='Active'`, [session.data.username]
        );
        if (!u || !(await bcrypt.compare(text, u.password_hash))) {
            await saveSession(chatId, { state: 'login_user', data: {} });
            return send(chatId, `❌ Usuario o contraseña incorrectos.\n\nEscribe tu <b>usuario</b>:`);
        }
        await saveSession(chatId, { state: 'idle', user_id: u.id, data: {} });
        await q('UPDATE users SET telegram_chat_id=$1 WHERE id=$2', [chatId, u.id]);
        return showMenu(chatId, u);
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// SUPER ADMIN HANDLERS
// ══════════════════════════════════════════════════════════════════════════════
async function handleSAStats(chatId) {
    const { rows: [tx] } = await q(`
        SELECT COUNT(*)::int AS orders,
               COALESCE(SUM(total),0) AS revenue,
               COUNT(DISTINCT business_id)::int AS businesses
        FROM transactions
        WHERE DATE(date AT TIME ZONE 'America/Lima')=CURRENT_DATE AT TIME ZONE 'America/Lima'
    `);
    const { rows: [biz] } = await q(`SELECT COUNT(*)::int AS total FROM businesses`);
    const { rows: [users] } = await q(`SELECT COUNT(*)::int AS total FROM users WHERE role!='Super Admin'`);
    await send(chatId,
        `📊 <b>Plataforma — Hoy</b>\n\n` +
        `💰 Ventas: <b>${sol(tx.revenue)}</b>\n` +
        `🛒 Órdenes: <b>${tx.orders}</b>\n` +
        `🏢 Negocios activos hoy: <b>${tx.businesses}</b>\n\n` +
        `<b>Total en plataforma:</b>\n` +
        `🏢 Negocios: ${biz.total}\n` +
        `👤 Usuarios: ${users.total}`,
        { reply_markup: { inline_keyboard: [[{ text: '🏠 Menú', callback_data: 'menu' }]] } }
    );
}

async function handleSALeads(chatId) {
    const { rows } = await q(
        `SELECT * FROM leads WHERE account_created=FALSE ORDER BY created_at DESC LIMIT 8`
    ).catch(() => ({ rows: [] }));
    if (!rows.length) {
        return send(chatId, '📋 No hay solicitudes pendientes.',
            { reply_markup: { inline_keyboard: [[{ text: '🏠 Menú', callback_data: 'menu' }]] } });
    }
    const btns = rows.map(l => ([{
        text: `${l.paid ? '✅' : '⏳'} ${l.business_name} — ${l.full_name}`,
        callback_data: `lead_${l.id}`
    }]));
    btns.push([{ text: '🏠 Menú', callback_data: 'menu' }]);
    await send(chatId, `📋 <b>Solicitudes pendientes</b> (${rows.length})\n\n✅ = pagado · ⏳ = pendiente pago`,
        { reply_markup: { inline_keyboard: btns } });
}

async function handleLeadDetail(chatId, leadId) {
    const { rows: [l] } = await q('SELECT * FROM leads WHERE id=$1', [leadId]);
    if (!l) return send(chatId, '❌ Solicitud no encontrada.');
    await send(chatId,
        `📋 <b>Solicitud #${l.id}</b>\n\n` +
        `🏢 Negocio: <b>${l.business_name}</b>\n` +
        `👤 Contacto: ${l.full_name}\n` +
        `📱 Teléfono: ${l.phone}\n` +
        `📧 Email: ${l.email || '—'}\n` +
        `💳 Pago: ${l.paid ? '✅ Confirmado' : '⏳ Pendiente'}\n` +
        `📅 Fecha: ${new Date(l.created_at).toLocaleDateString('es-PE')}`,
        { reply_markup: { inline_keyboard: [
            [{ text: '✅ Crear cuenta ahora', callback_data: `create_lead_${l.id}` }],
            [{ text: '📋 Ver todas', callback_data: 'sa_leads' }, { text: '🏠 Menú', callback_data: 'menu' }]
        ]}}
    );
}

async function handleCreateFromLead(chatId, leadId) {
    const { rows: [lead] } = await q('SELECT * FROM leads WHERE id=$1', [leadId]);
    if (!lead) return send(chatId, '❌ Solicitud no encontrada.');
    if (lead.account_created) return send(chatId, '⚠️ Esta cuenta ya fue creada.');

    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        await client.query(`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ`).catch(() => {});
        await client.query(`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE`).catch(() => {});

        const trialEnd = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
        const { rows: [biz] } = await client.query(
            `INSERT INTO businesses (name, status, trial_ends_at, is_paid) VALUES ($1,'Active',$2,FALSE) RETURNING *`,
            [lead.business_name, trialEnd]
        );
        const base     = lead.business_name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15) || 'biz';
        const username = `${base}${Math.floor(Math.random() * 1000)}`;
        const tempPw   = Math.random().toString(36).slice(-8) + 'A1!';
        const hash     = await bcrypt.hash(tempPw, 10);
        const { rows: [user] } = await client.query(
            `INSERT INTO users (business_id, business_name, full_name, username, email, phone, password_hash, role, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,'Business Admin','Active') RETURNING id`,
            [biz.id, lead.business_name, lead.full_name, username, lead.email || null, lead.phone || null, hash]
        );
        await client.query(`UPDATE leads SET account_created=TRUE, status='created', created_user_id=$1 WHERE id=$2`,
            [user.id, lead.id]);
        await client.query('COMMIT');

        await send(chatId,
            `✅ <b>Cuenta creada!</b>\n\n` +
            `🏢 ${lead.business_name}\n` +
            `👤 ${lead.full_name}\n\n` +
            `<b>Credenciales (comparte esto):</b>\n` +
            `🔗 <a href="${magicLink(username, tempPw)}">Entrar directo →</a>\n\n` +
            `👤 Usuario: <code>${username}</code>\n` +
            `🔑 Contraseña: <code>${tempPw}</code>\n\n` +
            `⏳ Trial: 3 días`,
            { reply_markup: { inline_keyboard: [[{ text: '📋 Ver solicitudes', callback_data: 'sa_leads' }, { text: '🏠 Menú', callback_data: 'menu' }]] } }
        );
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        await send(chatId, '❌ Error al crear la cuenta: ' + err.message);
    } finally {
        client.release();
    }
}

// SA crear usuario manual — flow
async function handleSACreate(chatId, text, session) {
    const state = session.state;
    const d = session.data || {};

    if (state === 'sa_create_bizname') {
        await saveSession(chatId, { state: 'sa_create_name', data: { bizName: text } });
        return send(chatId, `👤 ¿Nombre completo del administrador?`, { reply_markup: CANCEL_KB });
    }
    if (state === 'sa_create_name') {
        await saveSession(chatId, { state: 'sa_create_email', data: { ...d, fullName: text } });
        return send(chatId, `📧 ¿Email? (o escribe <code>no</code>)`, { reply_markup: CANCEL_KB });
    }
    if (state === 'sa_create_email') {
        const email = ['no', '-', ''].includes(text.toLowerCase()) ? null : text;
        await saveSession(chatId, { state: 'sa_create_phone', data: { ...d, email } });
        return send(chatId, `📱 ¿Número de teléfono? (o escribe <code>no</code>)`, { reply_markup: CANCEL_KB });
    }
    if (state === 'sa_create_phone') {
        const phone = ['no', '-', ''].includes(text.toLowerCase()) ? null : text;
        await saveSession(chatId, { state: 'sa_create_trial', data: { ...d, phone } });
        return send(chatId, `⏳ ¿Le das trial?`, {
            reply_markup: { inline_keyboard: [
                [{ text: '✅ Sí, con trial', callback_data: 'trial_yes' }],
                [{ text: '🚀 No, acceso completo', callback_data: 'trial_no' }],
                [{ text: '❌ Cancelar', callback_data: 'cancel' }],
            ]}
        });
    }
    if (state === 'sa_create_trial_days') {
        const days = parseInt(text);
        if (isNaN(days) || days < 1) return send(chatId, '❌ Número inválido. ¿Cuántos días de trial?');
        await saveSession(chatId, { state: 'sa_create_user', data: { ...d, trialDays: days } });
        return send(chatId, `🔤 ¿Username para login?\nEjemplo: <code>mibodega</code>`, { reply_markup: CANCEL_KB });
    }
    if (state === 'sa_create_user') {
        const username = text.toLowerCase().replace(/\s+/g, '.');
        const { rows: [ex] } = await q('SELECT id FROM users WHERE LOWER(username)=$1', [username]);
        if (ex) return send(chatId, '❌ Ese usuario ya existe. Elige otro:');

        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            const hasTrial = d.trialDays > 0;
            const trialEnd = hasTrial ? new Date(Date.now() + d.trialDays * 24 * 60 * 60 * 1000) : null;
            const { rows: [biz] } = await client.query(
                `INSERT INTO businesses (name, status, trial_ends_at, is_paid) VALUES ($1,'Active',$2,$3) RETURNING *`,
                [d.bizName, trialEnd, !hasTrial]
            );
            const tempPw = Math.random().toString(36).slice(-8) + 'A1!';
            const hash   = await bcrypt.hash(tempPw, 10);
            await client.query(
                `INSERT INTO users (business_id, business_name, full_name, username, email, phone, password_hash, role, status)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,'Business Admin','Active')`,
                [biz.id, d.bizName, d.fullName, username, d.email || null, d.phone || null, hash]
            );
            await client.query('COMMIT');
            await resetSession(chatId);
            await send(chatId,
                `✅ <b>Negocio creado!</b>\n\n` +
                `🏢 ${d.bizName}\n` +
                `👤 ${d.fullName}\n` +
                (d.email ? `📧 ${d.email}\n` : '') +
                (d.phone ? `📱 ${d.phone}\n` : '') +
                (hasTrial ? `⏳ Trial: ${d.trialDays} días\n` : `🚀 Acceso completo\n`) +
                `\n<b>Credenciales:</b>\n` +
                `🔗 <a href="${magicLink(username, tempPw)}">Entrar directo →</a>\n\n` +
                `👤 Usuario: <code>${username}</code>\n` +
                `🔑 Contraseña: <code>${tempPw}</code>`,
                { reply_markup: { inline_keyboard: [[{ text: '🏠 Menú', callback_data: 'menu' }]] } }
            );
        } catch (err) {
            await client.query('ROLLBACK');
            await send(chatId, '❌ Error: ' + err.message);
        } finally {
            client.release();
        }
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN + SELLER HANDLERS
// ══════════════════════════════════════════════════════════════════════════════
async function handleStatsToday(chatId, user) {
    const bizWhere = isSA(user) ? '' : 'WHERE t.business_id=$1';
    const params   = isSA(user) ? [] : [user.business_id];
    const { rows: [tx] } = await q(
        `SELECT COUNT(*)::int AS orders, COALESCE(SUM(total),0) AS revenue
         FROM transactions t ${bizWhere} ${bizWhere ? 'AND' : 'WHERE'} DATE(date AT TIME ZONE 'America/Lima')=CURRENT_DATE AT TIME ZONE 'America/Lima'`
            .replace('WHERE AND', 'WHERE'),
        params
    );
    // simpler query
    const p2 = isSA(user) ? [] : [user.business_id];
    const w2 = isSA(user) ? "WHERE DATE(t.date AT TIME ZONE 'America/Lima')=CURRENT_DATE AT TIME ZONE 'America/Lima'"
                           : "WHERE t.business_id=$1 AND DATE(t.date AT TIME ZONE 'America/Lima')=CURRENT_DATE AT TIME ZONE 'America/Lima'";
    const { rows: sellers } = await q(
        `SELECT u.full_name, COALESCE(SUM(t.total),0) AS total, COUNT(t.id)::int AS orders
         FROM transactions t JOIN users u ON u.id=t.seller_id
         ${w2} GROUP BY u.full_name ORDER BY total DESC LIMIT 3`, p2
    );
    const sText = sellers.length
        ? sellers.map((s, i) => `  ${['🥇','🥈','🥉'][i]} ${s.full_name} — ${sol(s.total)}`).join('\n')
        : '  Sin ventas aún';
    await send(chatId,
        `📊 <b>Estadísticas de hoy</b>\n\n💰 ${sol(tx.revenue)}\n🛒 ${tx.orders} órdenes\n\n<b>Top vendedores:</b>\n${sText}`,
        { reply_markup: { inline_keyboard: [[{ text: '🏠 Menú', callback_data: 'menu' }]] } }
    );
}

async function handleMyStats(chatId, user) {
    const { rows: [r] } = await q(
        `SELECT COUNT(*)::int AS orders, COALESCE(SUM(total),0) AS revenue
         FROM transactions
         WHERE seller_id=$1 AND DATE(date AT TIME ZONE 'America/Lima')=CURRENT_DATE AT TIME ZONE 'America/Lima'`,
        [user.id]
    );
    await send(chatId,
        `📊 <b>Mis ventas de hoy</b>\n\n💰 ${sol(r.revenue)}\n🛒 ${r.orders} órdenes`,
        { reply_markup: { inline_keyboard: [[{ text: '🏠 Menú', callback_data: 'menu' }]] } }
    );
}

async function handleInventory(chatId, user) {
    const { rows } = await q(
        `SELECT name, stock, sale_price FROM products WHERE business_id=$1 ORDER BY stock ASC LIMIT 12`,
        [user.business_id]
    );
    if (!rows.length) return send(chatId, '📦 No hay productos aún.',
        { reply_markup: { inline_keyboard: [[{ text: '🏠 Menú', callback_data: 'menu' }]] } });
    const lines = rows.map(p => {
        const icon = p.stock === 0 ? '🔴' : p.stock < 5 ? '🟡' : '🟢';
        return `${icon} ${p.name} — ${p.stock} uds · ${sol(p.sale_price)}`;
    }).join('\n');
    await send(chatId, `📦 <b>Inventario</b>\n\n${lines}`,
        { reply_markup: { inline_keyboard: [[{ text: '🏠 Menú', callback_data: 'menu' }]] } });
}

async function handleLowStock(chatId, user) {
    const { rows } = await q(
        `SELECT name, stock FROM products WHERE business_id=$1 AND stock<=5 ORDER BY stock ASC`,
        [user.business_id]
    );
    if (!rows.length) return send(chatId, '✅ Todo el stock está bien.',
        { reply_markup: { inline_keyboard: [[{ text: '🏠 Menú', callback_data: 'menu' }]] } });
    const lines = rows.map(p => `${p.stock === 0 ? '🔴 AGOTADO' : '🟡 BAJO'} ${p.name} — ${p.stock} uds`).join('\n');
    await send(chatId, `⚠️ <b>Stock bajo</b>\n\n${lines}`,
        { reply_markup: { inline_keyboard: [[{ text: '🏠 Menú', callback_data: 'menu' }]] } });
}

async function handleRecentSales(chatId, user) {
    const { rows } = await q(
        `SELECT t.total, t.date, u.full_name AS seller
         FROM transactions t JOIN users u ON u.id=t.seller_id
         WHERE t.business_id=$1 ORDER BY t.date DESC LIMIT 8`,
        [user.business_id]
    );
    if (!rows.length) return send(chatId, '💰 No hay ventas aún.',
        { reply_markup: { inline_keyboard: [[{ text: '🏠 Menú', callback_data: 'menu' }]] } });
    const lines = rows.map(t => {
        const d = new Date(t.date).toLocaleString('es-PE', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
        return `• ${sol(t.total)} — ${t.seller} · ${d}`;
    }).join('\n');
    await send(chatId, `💰 <b>Ventas recientes</b>\n\n${lines}`,
        { reply_markup: { inline_keyboard: [[{ text: '🏠 Menú', callback_data: 'menu' }]] } });
}

async function handleTopSellers(chatId, user) {
    const { rows } = await q(
        `SELECT u.full_name, COUNT(t.id)::int AS orders, COALESCE(SUM(t.total),0) AS total
         FROM transactions t JOIN users u ON u.id=t.seller_id
         WHERE t.business_id=$1 AND t.date>=NOW()-INTERVAL '30 days'
         GROUP BY u.full_name ORDER BY total DESC LIMIT 5`,
        [user.business_id]
    );
    if (!rows.length) return send(chatId, '🏆 Sin datos aún.',
        { reply_markup: { inline_keyboard: [[{ text: '🏠 Menú', callback_data: 'menu' }]] } });
    const medals = ['🥇','🥈','🥉','4️⃣','5️⃣'];
    const lines = rows.map((s, i) => `${medals[i]} <b>${s.full_name}</b> — ${sol(s.total)} (${s.orders} órd.)`).join('\n');
    await send(chatId, `🏆 <b>Top vendedores — 30 días</b>\n\n${lines}`,
        { reply_markup: { inline_keyboard: [[{ text: '🏠 Menú', callback_data: 'menu' }]] } });
}

// ─── Add product flow ─────────────────────────────────────────────────────────
async function handleAddProduct(chatId, text, session, update) {
    const state = session.state;
    const d = session.data || {};

    if (state === 'prod_name') {
        await saveSession(chatId, { state: 'prod_price', data: { name: text } });
        return send(chatId, `💵 ¿Precio de venta (S/.)?\nEj: <code>35.50</code>`, { reply_markup: CANCEL_KB });
    }
    if (state === 'prod_price') {
        const price = parseFloat(text.replace(',', '.'));
        if (isNaN(price) || price <= 0) return send(chatId, '❌ Precio inválido. Ej: <code>35.50</code>');
        await saveSession(chatId, { state: 'prod_stock', data: { ...d, price } });
        return send(chatId, `📦 ¿Cuántas unidades en stock?`, { reply_markup: CANCEL_KB });
    }
    if (state === 'prod_stock') {
        const stock = parseInt(text);
        if (isNaN(stock) || stock < 0) return send(chatId, '❌ Número inválido.');
        await saveSession(chatId, { state: 'prod_category', data: { ...d, stock } });
        return send(chatId, `🏷️ ¿Categoría? (escribe o pon <code>no</code>)`, { reply_markup: CANCEL_KB });
    }
    if (state === 'prod_category') {
        const category = ['no', '-', ''].includes(text.toLowerCase()) ? null : text;
        await saveSession(chatId, { state: 'prod_cost', data: { ...d, category } });
        return send(chatId, `💲 ¿Costo del producto (precio que pagaste)?\nEj: <code>20.00</code> o <code>no</code>`, { reply_markup: CANCEL_KB });
    }
    if (state === 'prod_cost') {
        const cost = ['no', '-', ''].includes(text.toLowerCase()) ? 0 : parseFloat(text.replace(',', '.'));
        if (isNaN(cost) || cost < 0) return send(chatId, '❌ Costo inválido. Ej: <code>20.00</code>');
        await saveSession(chatId, { state: 'prod_photo', data: { ...d, cost } });
        return send(chatId, `📸 ¿Foto del producto? Mándala o escribe <code>no</code>`, { reply_markup: CANCEL_KB });
    }
    if (state === 'prod_photo') {
        const user = await getUser(session);
        let imageUrl = null;
        if (update.message?.photo) {
            const photo   = update.message.photo[update.message.photo.length - 1];
            const fileRes = await tg('getFile', { file_id: photo.file_id });
            if (fileRes.ok) imageUrl = `https://api.telegram.org/file/bot${TOKEN}/${fileRes.result.file_path}`;
        }
        await q(
            `INSERT INTO products (business_id, name, sale_price, cost_price, stock, category, image)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [user.business_id, d.name, d.price, d.cost || 0, d.stock, d.category || null, imageUrl]
        );
        await resetSession(chatId);
        await send(chatId,
            `✅ <b>Producto agregado!</b>\n\n📦 ${d.name}\n💵 ${sol(d.price)}\n🔢 ${d.stock} uds` +
            (d.category ? `\n🏷️ ${d.category}` : '') + (imageUrl ? '\n📸 Con imagen' : ''),
            { reply_markup: { inline_keyboard: [[{ text: '➕ Otro', callback_data: 'add_product' }, { text: '🏠 Menú', callback_data: 'menu' }]] } }
        );
    }
}

// ─── Add seller flow ──────────────────────────────────────────────────────────
async function handleAddSeller(chatId, text, session) {
    const state = session.state;
    const d = session.data || {};

    if (state === 'seller_name') {
        await saveSession(chatId, { state: 'seller_user', data: { fullName: text } });
        return send(chatId, `👤 ¿Username para login?\nEj: <code>ana.torres</code>`, { reply_markup: CANCEL_KB });
    }
    if (state === 'seller_user') {
        const username = text.toLowerCase().replace(/\s+/g, '.');
        const { rows: [ex] } = await q('SELECT id FROM users WHERE LOWER(username)=$1', [username]);
        if (ex) return send(chatId, '❌ Ese usuario ya existe. Elige otro:');
        const user = await getUser(session);
        const tempPw = Math.random().toString(36).slice(-8) + 'A1!';
        const hash   = await bcrypt.hash(tempPw, 10);
        await q(
            `INSERT INTO users (business_id, business_name, full_name, username, password_hash, role, status)
             VALUES ($1,$2,$3,$4,$5,'Seller','Active')`,
            [user.business_id, user.business_name, d.fullName, username, hash]
        );
        await resetSession(chatId);
        await send(chatId,
            `✅ <b>Vendedor creado!</b>\n\n👤 <b>${d.fullName}</b>\n\n` +
            `<b>Credenciales (comparte esto):</b>\n` +
            `🔗 <a href="${magicLink(username, tempPw)}">Entrar directo →</a>\n\n` +
            `👤 Usuario: <code>${username}</code>\n` +
            `🔑 Contraseña: <code>${tempPw}</code>`,
            { reply_markup: { inline_keyboard: [[{ text: '➕ Otro', callback_data: 'add_seller' }, { text: '🏠 Menú', callback_data: 'menu' }]] } }
        );
    }
}

// ─── New sale flow ────────────────────────────────────────────────────────────
async function startNewSale(chatId, user) {
    const { rows } = await q(
        `SELECT id, name, sale_price, stock FROM products WHERE business_id=$1 AND stock>0 ORDER BY name LIMIT 20`,
        [user.business_id]
    );
    if (!rows.length) return send(chatId, '📦 No hay productos con stock disponible.',
        { reply_markup: { inline_keyboard: [[{ text: '🏠 Menú', callback_data: 'menu' }]] } });

    const btns = rows.map(p => ([{
        text: `${p.name} — ${sol(p.sale_price)} (${p.stock} uds)`,
        callback_data: `sale_prod_${p.id}`
    }]));
    btns.push([{ text: '❌ Cancelar', callback_data: 'cancel' }]);
    await saveSession(chatId, { state: 'sale_pick_product', data: { items: [] } });
    await send(chatId, `💰 <b>Nueva venta</b>\n\n¿Qué producto quieres vender?`, { reply_markup: { inline_keyboard: btns } });
}

async function handleSaleProductPick(chatId, productId, session, user) {
    const { rows: [p] } = await q('SELECT * FROM products WHERE id=$1', [productId]);
    if (!p) return send(chatId, '❌ Producto no encontrado.');
    await saveSession(chatId, { state: 'sale_qty', data: { ...session.data, currentProductId: p.id, currentProductName: p.name, currentPrice: parseFloat(p.sale_price) } });
    await send(chatId,
        `📦 <b>${p.name}</b>\n💵 ${sol(p.sale_price)} c/u\n📦 ${p.stock} en stock\n\n¿Cuántas unidades?`,
        { reply_markup: CANCEL_KB }
    );
}

async function handleSaleQty(chatId, text, session, user) {
    const qty = parseInt(text);
    if (isNaN(qty) || qty <= 0) return send(chatId, '❌ Cantidad inválida.');
    const d = session.data;
    const { rows: [p] } = await q('SELECT stock FROM products WHERE id=$1', [d.currentProductId]);
    if (qty > p.stock) return send(chatId, `❌ Solo hay ${p.stock} unidades disponibles.`);

    const item = { productId: d.currentProductId, name: d.currentProductName, unitPrice: d.currentPrice, quantity: qty };
    const items = [...(d.items || []), item];
    const subtotal = items.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0);

    const cartLines = items.map(i => `• ${i.name} x${i.quantity} = ${sol(i.unitPrice * i.quantity)}`).join('\n');
    await saveSession(chatId, { state: 'sale_payment', data: { ...d, items, currentProductId: null } });
    await send(chatId,
        `🛒 <b>Carrito</b>\n\n${cartLines}\n\n💰 Total: <b>${sol(subtotal)}</b>\n\n¿Método de pago?`,
        { reply_markup: { inline_keyboard: [
            [{ text: '💵 Efectivo', callback_data: 'pay_Efectivo' }, { text: '💳 Tarjeta', callback_data: 'pay_Tarjeta' }],
            [{ text: '📱 Yape/Plin', callback_data: 'pay_Yape' },   { text: '🏦 Transferencia', callback_data: 'pay_Transferencia' }],
            [{ text: '➕ Agregar otro producto', callback_data: 'sale_add_more' }],
            [{ text: '❌ Cancelar', callback_data: 'cancel' }],
        ]}}
    );
}

async function handleSaleConfirm(chatId, session, user) {
    const items = session.data?.items || [];
    if (!items.length) return send(chatId, '❌ Carrito vacío.');

    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        let subtotal = 0, profit = 0;

        for (const item of items) {
            const { rows: [p] } = await client.query('SELECT * FROM products WHERE id=$1', [item.productId]);
            if (!p || p.stock < item.quantity) {
                await client.query('ROLLBACK');
                return send(chatId, `❌ Stock insuficiente para "${item.name}".`);
            }
            item._cost = parseFloat(p.cost_price) || 0;
            subtotal += item.unitPrice * item.quantity;
            profit   += (item.unitPrice - item._cost) * item.quantity;
            await client.query('UPDATE products SET stock=stock-$1 WHERE id=$2', [item.quantity, item.productId]);
        }

        const paymentMethod = session.data?.paymentMethod || 'Efectivo';
        const { rows: [tx] } = await client.query(
            `INSERT INTO transactions (business_id, seller_id, seller_name, payment_method, subtotal, total, profit, date)
             VALUES ($1,$2,$3,$4,$5,$6,$7,NOW()) RETURNING id`,
            [user.business_id, user.id, user.full_name, paymentMethod, subtotal, subtotal, profit]
        );
        for (const item of items) {
            await client.query(
                `INSERT INTO transaction_items (transaction_id, product_id, product_name, quantity, unit_price, cost_price, total)
                 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                [tx.id, item.productId, item.name, item.quantity, item.unitPrice, item._cost, item.unitPrice * item.quantity]
            );
        }
        await client.query('COMMIT');
        await resetSession(chatId);

        const lines = items.map(i => `• ${i.name} x${i.quantity} = ${sol(i.unitPrice * i.quantity)}`).join('\n');
        const receiptUrl = `${BASE_URL}/receipt.html?id=${tx.id}`;
        await send(chatId,
            `✅ <b>Venta registrada!</b>\n\n${lines}\n\n💰 Total: <b>${sol(subtotal)}</b>\n💳 ${paymentMethod}\n\n🧾 <a href="${receiptUrl}">Ver recibo →</a>`,
            { reply_markup: { inline_keyboard: [[{ text: '💰 Nueva venta', callback_data: 'new_sale' }, { text: '🏠 Menú', callback_data: 'menu' }]] } }
        );
    } catch (err) {
        await client.query('ROLLBACK');
        await send(chatId, '❌ Error al registrar la venta: ' + err.message);
    } finally {
        client.release();
    }
}

// ─── SA Delete handlers ───────────────────────────────────────────────────────
async function handleSADeleteList(chatId) {
    const { rows } = await q(
        `SELECT b.id, b.name, u.username, u.full_name
         FROM businesses b
         LEFT JOIN users u ON u.business_id=b.id AND u.role='Business Admin'
         ORDER BY b.name LIMIT 20`
    );
    if (!rows.length) return send(chatId, '📭 No hay negocios.',
        { reply_markup: { inline_keyboard: [[{ text: '🏠 Menú', callback_data: 'menu' }]] } });
    const btns = rows.map(b => ([{
        text: `🏢 ${b.name}${b.username ? ` — @${b.username}` : ''}`,
        callback_data: `del_biz_${b.id}`
    }]));
    btns.push([{ text: '🏠 Menú', callback_data: 'menu' }]);
    await send(chatId, `🗑️ <b>¿Qué negocio quieres borrar?</b>`, { reply_markup: { inline_keyboard: btns } });
}

async function handleSADeleteConfirm(chatId, bizId) {
    const { rows: [b] } = await q(`SELECT name FROM businesses WHERE id=$1`, [bizId]);
    if (!b) return send(chatId, '❌ Negocio no encontrado.');
    await send(chatId,
        `⚠️ <b>¿Seguro que quieres borrar "${b.name}"?</b>\n\nEsto eliminará el negocio y todos sus usuarios.`,
        { reply_markup: { inline_keyboard: [
            [{ text: `🗑️ Sí, borrar "${b.name}"`, callback_data: `del_confirm_${bizId}` }],
            [{ text: '❌ Cancelar', callback_data: 'menu' }],
        ]}}
    );
}

async function handleSADeleteExecute(chatId, bizId) {
    const { rows: [b] } = await q(`SELECT name FROM businesses WHERE id=$1`, [bizId]);
    if (!b) return send(chatId, '❌ Negocio no encontrado.');
    try {
        await q(`DELETE FROM transaction_items WHERE transaction_id IN (SELECT id FROM transactions WHERE business_id=$1)`, [bizId]);
        await q(`DELETE FROM transactions WHERE business_id=$1`, [bizId]);
        await q(`DELETE FROM products WHERE business_id=$1`, [bizId]);
        await q(`DELETE FROM users WHERE business_id=$1`, [bizId]);
        await q(`DELETE FROM businesses WHERE id=$1`, [bizId]);
        await send(chatId, `✅ <b>"${b.name}"</b> eliminado correctamente.`,
            { reply_markup: { inline_keyboard: [[{ text: '🗑️ Borrar otro', callback_data: 'sa_delete' }, { text: '🏠 Menú', callback_data: 'menu' }]] } }
        );
    } catch (err) {
        await send(chatId, '❌ Error al borrar: ' + err.message);
    }
}

// ── SA Manage handlers ────────────────────────────────────────────────────────
async function handleSAManageList(chatId) {
    const { rows } = await q(`
        SELECT u.id, u.full_name, u.username, u.status,
               b.name AS biz_name, b.is_paid, b.trial_ends_at
        FROM users u
        JOIN businesses b ON b.id = u.business_id
        WHERE u.role = 'Business Admin'
        ORDER BY b.name LIMIT 20
    `);
    if (!rows.length) return send(chatId, '📭 No hay negocios registrados.',
        { reply_markup: { inline_keyboard: [[{ text: '🏠 Menú', callback_data: 'menu' }]] } });

    const btns = rows.map(u => {
        const badge = u.status === 'Active' ? '🟢' : '🔴';
        const plan  = u.is_paid ? '✅' : (u.trial_ends_at ? '⏳' : '⚠️');
        return [{ text: `${badge} ${plan} ${u.biz_name} — @${u.username || '?'}`, callback_data: `mgr_user_${u.id}` }];
    });
    btns.push([{ text: '🏠 Menú', callback_data: 'menu' }]);
    await send(chatId,
        `👥 <b>Gestionar usuarios</b>\n\n🟢 Activo · 🔴 Desactivado · ✅ Pagado · ⏳ Trial · ⚠️ Sin plan`,
        { reply_markup: { inline_keyboard: btns } }
    );
}

async function handleSAUserActions(chatId, userId) {
    const { rows: [u] } = await q(`
        SELECT u.*, b.name AS biz_name, b.is_paid, b.trial_ends_at, b.status AS biz_status
        FROM users u JOIN businesses b ON b.id = u.business_id
        WHERE u.id = $1`, [userId]);
    if (!u) return send(chatId, '❌ Usuario no encontrado.');

    const trialInfo = u.is_paid ? '✅ Pagado' : (u.trial_ends_at ? `⏳ Trial hasta ${new Date(u.trial_ends_at).toLocaleDateString('es-PE')}` : '⚠️ Sin plan');
    const toggleLabel = u.status === 'Active' ? '🔴 Desactivar' : '🟢 Activar';

    await send(chatId,
        `👤 <b>${u.full_name}</b>\n🏢 ${u.biz_name}\n👤 @${u.username}\n📧 ${u.email || '—'}\n📱 ${u.phone || '—'}\n${trialInfo}\nEstado: <b>${u.status}</b>`,
        { reply_markup: { inline_keyboard: [
            [{ text: '🔑 Reset contraseña',       callback_data: `usr_reset_${userId}` }],
            [{ text: '👁️ Ver perfil/stats',       callback_data: `usr_profile_${userId}` }],
            [{ text: '✏️ Editar datos',            callback_data: `usr_edit_${userId}` }],
            [{ text: '💬 Enviar por WhatsApp',    callback_data: `usr_wa_${userId}` }],
            [{ text: '✅ Marcar pagado',           callback_data: `usr_paid_${userId}` }],
            [{ text: '⏳ Extender trial',          callback_data: `usr_trial_${userId}` }],
            [{ text: toggleLabel,                  callback_data: `usr_toggle_${userId}` }],
            [{ text: '🗑️ Eliminar negocio',        callback_data: `usr_del_${userId}` }],
            [{ text: '◀️ Volver a lista',          callback_data: 'sa_manage' }, { text: '🏠 Menú', callback_data: 'menu' }],
        ]}}
    );
}

async function handleSAResetPw(chatId, userId) {
    const { rows: [u] } = await q('SELECT * FROM users WHERE id=$1', [userId]);
    if (!u) return send(chatId, '❌ Usuario no encontrado.');
    const tempPw = Math.random().toString(36).slice(-8) + 'A1!';
    const hash   = await bcrypt.hash(tempPw, 10);
    await q('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, userId]);
    const link = magicLink(u.username, tempPw);
    await send(chatId,
        `🔑 <b>Contraseña reseteada</b>\n\n👤 ${u.full_name} (@${u.username})\n\n` +
        `🔗 <a href="${link}">Entrar directo →</a>\n\n` +
        `Usuario: <code>${u.username}</code>\nContraseña: <code>${tempPw}</code>`,
        { reply_markup: { inline_keyboard: [
            [{ text: '◀️ Volver', callback_data: `mgr_user_${userId}` }],
        ]}}
    );
}

async function handleSAProfile(chatId, userId) {
    const { rows: [u] } = await q(`
        SELECT u.full_name, u.username, u.email, u.phone, u.status,
               b.name AS biz_name, b.is_paid, b.trial_ends_at
        FROM users u JOIN businesses b ON b.id=u.business_id WHERE u.id=$1`, [userId]);
    if (!u) return send(chatId, '❌ Usuario no encontrado.');

    const { rows: stats } = await q(`
        SELECT COUNT(*)::int AS orders, COALESCE(SUM(total),0) AS revenue,
               COALESCE(SUM(profit),0) AS profit
        FROM transactions t JOIN users uu ON uu.id=t.seller_id
        WHERE uu.business_id=(SELECT business_id FROM users WHERE id=$1)`, [userId]);
    const { rows: [pcount] } = await q(`
        SELECT COUNT(*)::int AS total FROM products
        WHERE business_id=(SELECT business_id FROM users WHERE id=$1)`, [userId]);
    const { rows: sellers } = await q(`
        SELECT COUNT(*)::int AS total FROM users
        WHERE business_id=(SELECT business_id FROM users WHERE id=$1) AND role='Seller'`, [userId]);

    const st = stats[0] || {};
    await send(chatId,
        `📊 <b>${u.biz_name}</b>\n👤 ${u.full_name} (@${u.username})\n\n` +
        `📦 Productos: ${pcount?.total || 0}\n` +
        `👥 Vendedores: ${sellers[0]?.total || 0}\n` +
        `🛒 Órdenes totales: ${st.orders || 0}\n` +
        `💰 Ventas totales: ${sol(st.revenue)}\n` +
        `📈 Ganancia total: ${sol(st.profit)}\n\n` +
        `Plan: ${u.is_paid ? '✅ Pagado' : (u.trial_ends_at ? `⏳ Trial hasta ${new Date(u.trial_ends_at).toLocaleDateString('es-PE')}` : '⚠️ Sin plan')}\n` +
        `Estado: <b>${u.status}</b>`,
        { reply_markup: { inline_keyboard: [[{ text: '◀️ Volver', callback_data: `mgr_user_${userId}` }]] } }
    );
}

async function handleSAMarkPaid(chatId, userId) {
    const { rows: [u] } = await q('SELECT business_id, full_name FROM users WHERE id=$1', [userId]);
    if (!u) return send(chatId, '❌ Usuario no encontrado.');
    await q('UPDATE businesses SET is_paid=TRUE, trial_ends_at=NULL WHERE id=$1', [u.business_id]);
    await send(chatId, `✅ <b>${u.full_name}</b> marcado como pagado.`,
        { reply_markup: { inline_keyboard: [[{ text: '◀️ Volver', callback_data: `mgr_user_${userId}` }]] } });
}

async function handleSAToggleStatus(chatId, userId) {
    const { rows: [u] } = await q('SELECT full_name, status FROM users WHERE id=$1', [userId]);
    if (!u) return send(chatId, '❌ Usuario no encontrado.');
    const newStatus = u.status === 'Active' ? 'Disabled' : 'Active';
    await q('UPDATE users SET status=$1 WHERE id=$2', [newStatus, userId]);
    const icon = newStatus === 'Active' ? '🟢' : '🔴';
    await send(chatId, `${icon} <b>${u.full_name}</b> → ${newStatus}`,
        { reply_markup: { inline_keyboard: [[{ text: '◀️ Volver', callback_data: `mgr_user_${userId}` }]] } });
}

async function handleSAWhatsApp(chatId, userId) {
    const { rows: [u] } = await q('SELECT * FROM users WHERE id=$1', [userId]);
    if (!u) return send(chatId, '❌ Usuario no encontrado.');
    const tempPw = Math.random().toString(36).slice(-8) + 'A1!';
    const hash   = await bcrypt.hash(tempPw, 10);
    await q('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, userId]);
    const link = magicLink(u.username, tempPw);
    const msg = encodeURIComponent(
        `Hola ${u.full_name}! 👋\n\nAquí están tus credenciales de Vendix:\n\n` +
        `🔗 Acceso directo: ${link}\n\n` +
        `👤 Usuario: ${u.username}\n🔑 Contraseña: ${tempPw}\n\n` +
        `¡Bienvenido! 🚀`
    );
    const phone = (u.phone || '').replace(/\D/g, '');
    const waUrl = phone ? `https://wa.me/${phone}?text=${msg}` : `https://wa.me/?text=${msg}`;
    await send(chatId,
        `💬 <b>Enlace de WhatsApp listo</b>\n\n` +
        `Se generó nueva contraseña para <b>${u.full_name}</b>.\n\n` +
        `<a href="${waUrl}">📲 Abrir WhatsApp →</a>`,
        { reply_markup: { inline_keyboard: [[{ text: '◀️ Volver', callback_data: `mgr_user_${userId}` }]] } }
    );
}

async function handleSADeleteUserConfirm(chatId, userId) {
    const { rows: [u] } = await q('SELECT full_name, business_id FROM users WHERE id=$1', [userId]);
    if (!u) return send(chatId, '❌ Usuario no encontrado.');
    const { rows: [b] } = await q('SELECT name FROM businesses WHERE id=$1', [u.business_id]);
    await send(chatId,
        `⚠️ <b>¿Eliminar "${b?.name}"?</b>\n\nSe borrarán todos los usuarios, productos y ventas de este negocio.`,
        { reply_markup: { inline_keyboard: [
            [{ text: `🗑️ Sí, eliminar "${b?.name}"`, callback_data: `usr_del_confirm_${userId}` }],
            [{ text: '❌ Cancelar', callback_data: `mgr_user_${userId}` }],
        ]}}
    );
}

async function handleSADeleteUserExecute(chatId, userId) {
    const { rows: [u] } = await q('SELECT full_name, business_id FROM users WHERE id=$1', [userId]);
    if (!u) return send(chatId, '❌ Usuario no encontrado.');
    const bizId = u.business_id;
    const { rows: [b] } = await q('SELECT name FROM businesses WHERE id=$1', [bizId]);
    try {
        await q(`DELETE FROM transaction_items WHERE transaction_id IN (SELECT id FROM transactions WHERE business_id=$1)`, [bizId]);
        await q(`DELETE FROM transactions WHERE business_id=$1`, [bizId]);
        await q(`DELETE FROM products WHERE business_id=$1`, [bizId]);
        await q(`DELETE FROM users WHERE business_id=$1`, [bizId]);
        await q(`DELETE FROM businesses WHERE id=$1`, [bizId]);
        await send(chatId, `✅ <b>"${b?.name}"</b> eliminado.`,
            { reply_markup: { inline_keyboard: [[{ text: '👥 Ver lista', callback_data: 'sa_manage' }, { text: '🏠 Menú', callback_data: 'menu' }]] } });
    } catch (err) {
        await send(chatId, '❌ Error al eliminar: ' + err.message);
    }
}

async function handleSAEditFlow(chatId, text, session) {
    const d = session.data || {};
    const state = session.state;
    const uid = d.editUserId;

    if (state === 'sa_edit_bizname') {
        await q('UPDATE businesses SET name=$1 WHERE id=(SELECT business_id FROM users WHERE id=$2)', [text, uid]);
        await q('UPDATE users SET business_name=$1 WHERE id=$2', [text, uid]);
        await resetSession(chatId);
        return send(chatId, `✅ Nombre de negocio actualizado: <b>${text}</b>`,
            { reply_markup: { inline_keyboard: [[{ text: '◀️ Volver', callback_data: `mgr_user_${uid}` }]] } });
    }
    if (state === 'sa_edit_fullname') {
        await q('UPDATE users SET full_name=$1 WHERE id=$2', [text, uid]);
        await resetSession(chatId);
        return send(chatId, `✅ Nombre actualizado: <b>${text}</b>`,
            { reply_markup: { inline_keyboard: [[{ text: '◀️ Volver', callback_data: `mgr_user_${uid}` }]] } });
    }
    if (state === 'sa_edit_email') {
        const email = ['no', '-', ''].includes(text.toLowerCase()) ? null : text;
        await q('UPDATE users SET email=$1 WHERE id=$2', [email, uid]);
        await resetSession(chatId);
        return send(chatId, `✅ Email actualizado: <b>${email || '—'}</b>`,
            { reply_markup: { inline_keyboard: [[{ text: '◀️ Volver', callback_data: `mgr_user_${uid}` }]] } });
    }
    if (state === 'sa_edit_phone') {
        const phone = ['no', '-', ''].includes(text.toLowerCase()) ? null : text;
        await q('UPDATE users SET phone=$1 WHERE id=$2', [phone, uid]);
        await resetSession(chatId);
        return send(chatId, `✅ Teléfono actualizado: <b>${phone || '—'}</b>`,
            { reply_markup: { inline_keyboard: [[{ text: '◀️ Volver', callback_data: `mgr_user_${uid}` }]] } });
    }
    if (state === 'sa_extend_trial') {
        const days = parseInt(text);
        if (isNaN(days) || days < 1) return send(chatId, '❌ Número inválido. ¿Cuántos días?');
        await q(`UPDATE businesses SET trial_ends_at=NOW()+($1 || ' days')::INTERVAL, is_paid=FALSE
                 WHERE id=(SELECT business_id FROM users WHERE id=$2)`, [days, uid]);
        await resetSession(chatId);
        return send(chatId, `✅ Trial extendido <b>${days} días</b> más.`,
            { reply_markup: { inline_keyboard: [[{ text: '◀️ Volver', callback_data: `mgr_user_${uid}` }]] } });
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// WEBHOOK PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
router.post('/webhook', async (req, res) => {
    // Process FIRST, then respond — Vercel kills the function after res.send()
    try {
        const update = req.body;
        let chatId, text = '', callbackData = null;

        if (update.message) {
            chatId = update.message.chat.id;
            text   = update.message.text || '';
        } else if (update.callback_query) {
            chatId       = update.callback_query.message.chat.id;
            callbackData = update.callback_query.data;
            await answerCb(update.callback_query.id);
        } else {
            return res.sendStatus(200);
        }

        // /start siempre resetea la sesión para empezar limpio
        if (text === '/start') {
            await q(`DELETE FROM telegram_sessions WHERE chat_id=$1`, [chatId]).catch(() => {});
        }

        const session = await getSession(chatId);
        const user    = await getUser(session);

        // ── No logueado ──
        if (!user) {
            await handleLogin(chatId, text, session);
            return res.sendStatus(200);
        }

        // ── Logout ──
        if (callbackData === 'logout' || text === '/logout') {
            await q(`DELETE FROM telegram_sessions WHERE chat_id=$1`, [chatId]);
            await send(chatId, `👋 Sesión cerrada. Escribe /start para volver a entrar.`);
            return res.sendStatus(200);
        }

        // ── Cancelar ──
        if (callbackData === 'cancel' || text === '/cancel') {
            await resetSession(chatId);
            await showMenu(chatId, user);
            return res.sendStatus(200);
        }

        // ── Menú ──
        if (text === '/start' || text === '/menu' || callbackData === 'menu') {
            await resetSession(chatId);
            await showMenu(chatId, user);
            return res.sendStatus(200);
        }

        // ── Super Admin callbacks ──
        if (isSA(user)) {
            if (callbackData === 'sa_stats') { await handleSAStats(chatId); return res.sendStatus(200); }
            if (callbackData === 'sa_leads') { await handleSALeads(chatId); return res.sendStatus(200); }
            if (callbackData === 'sa_create') {
                await saveSession(chatId, { state: 'sa_create_bizname' });
                await send(chatId, `🏢 ¿Nombre del negocio?`, { reply_markup: CANCEL_KB });
                return res.sendStatus(200);
            }
            if (callbackData?.startsWith('lead_')) {
                await handleLeadDetail(chatId, callbackData.split('_')[1]);
                return res.sendStatus(200);
            }
            if (callbackData?.startsWith('create_lead_')) {
                await handleCreateFromLead(chatId, callbackData.replace('create_lead_', ''));
                return res.sendStatus(200);
            }
            if (callbackData === 'trial_yes') {
                await saveSession(chatId, { state: 'sa_create_trial_days' });
                await send(chatId, `📅 ¿Cuántos días de trial?`, { reply_markup: CANCEL_KB });
                return res.sendStatus(200);
            }
            if (callbackData === 'trial_no') {
                await saveSession(chatId, { state: 'sa_create_user', data: { trialDays: 0 } });
                await send(chatId, `🔤 ¿Username para login?\nEjemplo: <code>mibodega</code>`, { reply_markup: CANCEL_KB });
                return res.sendStatus(200);
            }
            if (callbackData === 'sa_delete') {
                await handleSADeleteList(chatId);
                return res.sendStatus(200);
            }
            if (callbackData?.startsWith('del_biz_')) {
                await handleSADeleteConfirm(chatId, callbackData.replace('del_biz_', ''));
                return res.sendStatus(200);
            }
            if (callbackData?.startsWith('del_confirm_')) {
                await handleSADeleteExecute(chatId, callbackData.replace('del_confirm_', ''));
                return res.sendStatus(200);
            }
            // ── Gestionar usuarios ──
            if (callbackData === 'sa_manage') {
                await handleSAManageList(chatId);
                return res.sendStatus(200);
            }
            if (callbackData?.startsWith('mgr_user_')) {
                await handleSAUserActions(chatId, callbackData.replace('mgr_user_', ''));
                return res.sendStatus(200);
            }
            if (callbackData?.startsWith('usr_reset_')) {
                await handleSAResetPw(chatId, callbackData.replace('usr_reset_', ''));
                return res.sendStatus(200);
            }
            if (callbackData?.startsWith('usr_profile_')) {
                await handleSAProfile(chatId, callbackData.replace('usr_profile_', ''));
                return res.sendStatus(200);
            }
            if (callbackData?.startsWith('usr_paid_')) {
                await handleSAMarkPaid(chatId, callbackData.replace('usr_paid_', ''));
                return res.sendStatus(200);
            }
            if (callbackData?.startsWith('usr_toggle_')) {
                await handleSAToggleStatus(chatId, callbackData.replace('usr_toggle_', ''));
                return res.sendStatus(200);
            }
            if (callbackData?.startsWith('usr_wa_')) {
                await handleSAWhatsApp(chatId, callbackData.replace('usr_wa_', ''));
                return res.sendStatus(200);
            }
            if (callbackData?.startsWith('usr_del_confirm_')) {
                await handleSADeleteUserExecute(chatId, callbackData.replace('usr_del_confirm_', ''));
                return res.sendStatus(200);
            }
            if (callbackData?.startsWith('usr_del_')) {
                await handleSADeleteUserConfirm(chatId, callbackData.replace('usr_del_', ''));
                return res.sendStatus(200);
            }
            if (callbackData?.startsWith('usr_edit_')) {
                const uid = callbackData.replace('usr_edit_', '');
                await send(chatId, `✏️ <b>¿Qué deseas editar?</b>`, {
                    reply_markup: { inline_keyboard: [
                        [{ text: '🏢 Nombre del negocio', callback_data: `ued_bizname_${uid}` }],
                        [{ text: '👤 Nombre del admin',   callback_data: `ued_fullname_${uid}` }],
                        [{ text: '📧 Email',              callback_data: `ued_email_${uid}` }],
                        [{ text: '📱 Teléfono',           callback_data: `ued_phone_${uid}` }],
                        [{ text: '◀️ Cancelar',           callback_data: `mgr_user_${uid}` }],
                    ]}
                });
                return res.sendStatus(200);
            }
            if (callbackData?.startsWith('usr_trial_')) {
                const uid = callbackData.replace('usr_trial_', '');
                await saveSession(chatId, { state: 'sa_extend_trial', data: { editUserId: uid } });
                await send(chatId, `⏳ ¿Cuántos días de trial agregar?`, { reply_markup: CANCEL_KB });
                return res.sendStatus(200);
            }
            if (callbackData?.startsWith('ued_bizname_')) {
                const uid = callbackData.replace('ued_bizname_', '');
                await saveSession(chatId, { state: 'sa_edit_bizname', data: { editUserId: uid } });
                await send(chatId, `🏢 ¿Nuevo nombre del negocio?`, { reply_markup: CANCEL_KB });
                return res.sendStatus(200);
            }
            if (callbackData?.startsWith('ued_fullname_')) {
                const uid = callbackData.replace('ued_fullname_', '');
                await saveSession(chatId, { state: 'sa_edit_fullname', data: { editUserId: uid } });
                await send(chatId, `👤 ¿Nuevo nombre del administrador?`, { reply_markup: CANCEL_KB });
                return res.sendStatus(200);
            }
            if (callbackData?.startsWith('ued_email_')) {
                const uid = callbackData.replace('ued_email_', '');
                await saveSession(chatId, { state: 'sa_edit_email', data: { editUserId: uid } });
                await send(chatId, `📧 ¿Nuevo email? (o escribe <code>no</code>)`, { reply_markup: CANCEL_KB });
                return res.sendStatus(200);
            }
            if (callbackData?.startsWith('ued_phone_')) {
                const uid = callbackData.replace('ued_phone_', '');
                await saveSession(chatId, { state: 'sa_edit_phone', data: { editUserId: uid } });
                await send(chatId, `📱 ¿Nuevo teléfono? (o escribe <code>no</code>)`, { reply_markup: CANCEL_KB });
                return res.sendStatus(200);
            }
        }

        // ── Callbacks compartidos Admin + Seller ──
        if (callbackData === 'stats_today')  { await handleStatsToday(chatId, user);  return res.sendStatus(200); }
        if (callbackData === 'my_sales')     { await handleMyStats(chatId, user);      return res.sendStatus(200); }
        if (callbackData === 'inventory')    { await handleInventory(chatId, user);    return res.sendStatus(200); }
        if (callbackData === 'low_stock')    { await handleLowStock(chatId, user);     return res.sendStatus(200); }
        if (callbackData === 'recent_sales') { await handleRecentSales(chatId, user);  return res.sendStatus(200); }
        if (callbackData === 'top_sellers')  { await handleTopSellers(chatId, user);   return res.sendStatus(200); }

        if (callbackData === 'add_product' && isAdmin(user)) {
            await saveSession(chatId, { state: 'prod_name' });
            await send(chatId, `➕ <b>Agregar producto</b>\n\n¿Nombre del producto?`, { reply_markup: CANCEL_KB });
            return res.sendStatus(200);
        }
        if (callbackData === 'add_seller' && isAdmin(user)) {
            await saveSession(chatId, { state: 'seller_name' });
            await send(chatId, `👥 <b>Agregar vendedor</b>\n\n¿Nombre completo?`, { reply_markup: CANCEL_KB });
            return res.sendStatus(200);
        }
        if (callbackData === 'new_sale')     { await startNewSale(chatId, user);                          return res.sendStatus(200); }
        if (callbackData?.startsWith('pay_')) {
            const method = callbackData.replace('pay_', '');
            const s = await getSession(chatId);
            await saveSession(chatId, { state: 'sale_confirm', data: { paymentMethod: method } });
            const freshSession = await getSession(chatId);
            await handleSaleConfirm(chatId, freshSession, user);
            return res.sendStatus(200);
        }
        if (callbackData === 'sale_confirm') { await handleSaleConfirm(chatId, session, user);             return res.sendStatus(200); }
        if (callbackData === 'sale_add_more') {
            await saveSession(chatId, { state: 'sale_pick_product' });
            await startNewSale(chatId, user);
            return res.sendStatus(200);
        }
        if (callbackData?.startsWith('sale_prod_')) {
            await handleSaleProductPick(chatId, callbackData.replace('sale_prod_', ''), session, user);
            return res.sendStatus(200);
        }

        // ── Estados de conversación ──
        const state = session.state;
        if (state.startsWith('prod_'))                         await handleAddProduct(chatId, text, session, update);
        else if (state.startsWith('seller_'))                  await handleAddSeller(chatId, text, session);
        else if (state.startsWith('sa_create_'))               await handleSACreate(chatId, text, session);
        else if (state.startsWith('sa_edit_') || state === 'sa_extend_trial') await handleSAEditFlow(chatId, text, session);
        else if (state === 'sale_qty')                         await handleSaleQty(chatId, text, session, user);
        else if (state === 'login_user' || state === 'login_pass') await handleLogin(chatId, text, session);
        else                                                   await showMenu(chatId, user);

    } catch (err) {
        console.error('Bot error:', err);
    }
    res.sendStatus(200);
});

// ─── Setup webhook ────────────────────────────────────────────────────────────
router.get('/setup', async (req, res) => {
    const host = process.env.VERCEL_URL || req.headers.host;
    const url  = `https://${host}/api/telegram/webhook`;
    const r    = await tg('setWebhook', { url, allowed_updates: ['message', 'callback_query'] });
    res.json({ url, result: r });
});

module.exports = router;
