const jwt = require('jsonwebtoken');
const db  = require('../db');

// Cache fresh user data for 60 s — avoids a DB hit on every API request while
// keeping role/business/status changes near-immediate (vs. waiting 7d for the
// JWT to expire). Value: { row: {id, role, business_id, status} } or null.
const _userCache = new Map();
const USER_CACHE_TTL = 60_000;
function _userCached(id) {
    const e = _userCache.get(id);
    if (!e) return undefined;                 // no cacheado → hay que consultar
    if (Date.now() - e.ts > USER_CACHE_TTL) { _userCache.delete(id); return undefined; }
    return e.row;                             // null = no existe; objeto = datos frescos
}
function _cacheUser(id, row) {
    _userCache.set(id, { row: row || null, ts: Date.now() });
}

async function authMiddleware(req, res, next) {
    const header = req.headers['authorization'];
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }
    const token = header.slice(7);
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Datos frescos del usuario (rol/negocio/estado) — así los cambios del SA
    // surten efecto en ≤60s sin esperar a que expire el JWT.
    let fresh = _userCached(req.user.id);
    if (fresh === undefined) {
        try {
            const { rows: [u] } = await db.query(
                'SELECT id, role, business_id, status FROM users WHERE id = $1', [req.user.id]
            );
            _cacheUser(req.user.id, u);
            fresh = u || null;
        } catch {
            // DB error — fail open so a DB hiccup doesn't lock everyone out
            return next();
        }
    }

    if (fresh === null) return res.status(401).json({ error: 'account_deleted' });
    // Cuenta deshabilitada a media sesión → 401 inmediato.
    if (fresh.status && fresh.status !== 'Active') {
        return res.status(401).json({ error: 'account_disabled' });
    }
    // Sobrescribe con los valores frescos de la DB (rol/negocio pueden haber cambiado).
    req.user.role       = fresh.role;
    req.user.businessId = fresh.business_id;

    next();
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        next();
    };
}

const requireSuperAdmin   = requireRole('Super Admin');
const requireBusinessAdmin = requireRole('Business Admin', 'Super Admin');
const requireAnyAuth      = (req, res, next) => authMiddleware(req, res, next);

module.exports = { authMiddleware, requireRole, requireSuperAdmin, requireBusinessAdmin, requireAnyAuth };
