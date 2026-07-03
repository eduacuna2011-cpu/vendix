// ═══════════════════════════════════════════════════════════════════════════════
// Migraciones idempotentes — un solo lugar.
//
// `schema.sql` (vía `npm run db:push`) es la FUENTE DE VERDAD del esquema. Este
// módulo repite las mismas sentencias `ADD COLUMN IF NOT EXISTS` / `CREATE TABLE
// IF NOT EXISTS` para AUTOREPARAR entornos/instancias que aún no corrieron el
// push (p.ej. un deploy nuevo contra una DB vieja).
//
// Se ejecuta UNA sola vez por instancia: memoizamos la promesa. El primer request
// que lo necesite la dispara; los demás reutilizan el resultado ya resuelto. Esto
// reemplaza a los antiguos `ensureX()` dispersos por los handlers (y a los ALTER
// que corrían en cada request). Si falla, se resetea para permitir reintento.
// ═══════════════════════════════════════════════════════════════════════════════
const db = require('./db');

let _migrationPromise = null;

function ensureMigrated() {
    if (!_migrationPromise) {
        _migrationPromise = _runMigrations().catch(err => {
            _migrationPromise = null; // permite reintento en el próximo request
            throw err;
        });
    }
    return _migrationPromise;
}

async function _runMigrations() {
    // businesses — trial/plan, integración de tienda e IGV
    await db.query(`
        ALTER TABLE businesses
            ADD COLUMN IF NOT EXISTS trial_ends_at   TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS is_paid         BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS plan            VARCHAR(20) NOT NULL DEFAULT 'basico',
            ADD COLUMN IF NOT EXISTS vercel_store_id VARCHAR(255),
            ADD COLUMN IF NOT EXISTS sync_api_key    VARCHAR(64),
            ADD COLUMN IF NOT EXISTS sync_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
            ADD COLUMN IF NOT EXISTS igv_enabled     BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS igv_rate        NUMERIC(5,2) DEFAULT 18
    `);
    await db.query('CREATE INDEX IF NOT EXISTS idx_businesses_sync_key ON businesses(sync_api_key)');

    // Grandfathering: un negocio que YA tiene tienda conectada (sync_api_key) es
    // Premium por definición — la tienda online es la función del plan Premium.
    // Evita que el gateo Premium bloquee tiendas que ya estaban en producción.
    await db.query(`UPDATE businesses SET plan = 'premium'
        WHERE sync_api_key IS NOT NULL AND plan <> 'premium'`);

    // transactions — estado de pago de pedidos web (pending/paid/cancelled)
    await db.query(`ALTER TABLE transactions
        ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) NOT NULL DEFAULT 'paid'`);

    // products — código de barras (histórico)
    await db.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode VARCHAR(100)');

    // leads — embudo del checkout de la landing
    await db.query(`
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
    `);

    // telegram_sessions — estado conversacional del bot
    await db.query(`
        CREATE TABLE IF NOT EXISTS telegram_sessions (
            chat_id    BIGINT PRIMARY KEY,
            user_id    INTEGER,
            state      TEXT DEFAULT 'idle',
            data       JSONB DEFAULT '{}',
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);
}

module.exports = { ensureMigrated };
