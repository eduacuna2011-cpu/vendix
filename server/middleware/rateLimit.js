// ─── Rate limiting (anti fuerza bruta) ───────────────────────────────────────
// Solo se aplica a endpoints sensibles (login y cambio de credenciales), NUNCA
// global: el panel hace muchos GET por página (miniaturas lazy, listas) y un
// límite global lo rompería.
//
// ⚠️ En Vercel (serverless) el store por defecto es EN MEMORIA y por-instancia:
// cada instancia caliente tiene su propio contador, no se comparte en toda la
// flota. Es una primera capa real contra fuerza bruta desde una IP, pero para
// protección fuerte a escala haría falta un store compartido (ej. Upstash Redis
// con `rate-limit-redis`). Documentado a propósito.
const { rateLimit } = require('express-rate-limit');

// Login: cuenta solo los intentos FALLIDOS (skipSuccessfulRequests) para no
// penalizar a quien entra bien. 10 fallos por IP cada 15 min.
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Demasiados intentos. Espera 15 minutos e inténtalo de nuevo.' },
});

// Cambio de credenciales (ya autenticado, pero verifica la contraseña actual):
// evita que un token robado/sesión abierta pruebe contraseñas por fuerza bruta.
const credentialsLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 15,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' },
});

module.exports = { loginLimiter, credentialsLimiter };
