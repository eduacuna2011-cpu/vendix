const jwt = require('jsonwebtoken');
const db  = require('../db');

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

    // Verify user still exists in DB (catches deleted accounts)
    try {
        const { rows: [u] } = await db.query(
            'SELECT id FROM users WHERE id = $1', [req.user.id]
        );
        if (!u) return res.status(401).json({ error: 'account_deleted' });
    } catch {
        // DB error — fail open so a DB hiccup doesn't lock everyone out
    }

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
