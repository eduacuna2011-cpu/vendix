-- ═══════════════════════════════════════════════════════════════════════════════
-- Inventory & Sales Management — PostgreSQL Schema
-- Run this once against your Neon database
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── Extension ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Businesses ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS businesses (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    status          VARCHAR(50)  NOT NULL DEFAULT 'Active',
    trial_ends_at   TIMESTAMPTZ,
    is_paid         BOOLEAN      NOT NULL DEFAULT FALSE,
    is_demo         BOOLEAN      NOT NULL DEFAULT FALSE,  -- tienda de vitrina/demo, NO cuenta en el MRR
    next_payment_at TIMESTAMPTZ,                          -- próxima fecha de pago (cuenta regresiva en el panel)
    plan            VARCHAR(20)  NOT NULL DEFAULT 'basico',  -- 'basico' | 'premium'
    vercel_store_id VARCHAR(255),                            -- integración tienda online
    sync_api_key    VARCHAR(64),                             -- llave X-Store-Key (solo Premium)
    sync_enabled    BOOLEAN      NOT NULL DEFAULT TRUE,
    igv_enabled     BOOLEAN      DEFAULT FALSE,
    igv_rate        NUMERIC(5,2) DEFAULT 18,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── Users (Super Admin + Business Admin + Sellers) ───────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id                    SERIAL PRIMARY KEY,
    business_id           INTEGER REFERENCES businesses(id) ON DELETE SET NULL,
    business_name         VARCHAR(255),
    full_name             VARCHAR(255) NOT NULL,
    username              VARCHAR(100) NOT NULL UNIQUE,
    email                 VARCHAR(255),
    phone                 VARCHAR(50),
    password_hash         VARCHAR(255) NOT NULL,
    role                  VARCHAR(50)  NOT NULL,   -- 'Super Admin' | 'Business Admin' | 'Seller'
    status                VARCHAR(50)  NOT NULL DEFAULT 'Active',
    commission_percentage NUMERIC(5,2)         DEFAULT 0,
    join_date             TIMESTAMPTZ          DEFAULT NOW(),
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── Products ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
    id          SERIAL PRIMARY KEY,
    business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
    sku         VARCHAR(100),
    name        VARCHAR(255) NOT NULL,
    category    VARCHAR(100),
    color       VARCHAR(100),
    size        VARCHAR(50),
    model       VARCHAR(100),
    stock       INTEGER      NOT NULL DEFAULT 0,
    sizes       JSONB,                       -- tallas opcionales: [{size,stock}]  (ver size_mode)
    size_mode   VARCHAR(12),                 -- NULL=una talla | 'shared'=pote único | 'per_size'=stock por talla
    cost_price  NUMERIC(10,2)        DEFAULT 0,
    sale_price  NUMERIC(10,2)        DEFAULT 0,
    image       TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── Transactions (sales orders) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
    id             SERIAL PRIMARY KEY,
    business_id    INTEGER REFERENCES businesses(id) ON DELETE SET NULL,
    seller_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    seller_name    VARCHAR(255),
    customer       VARCHAR(255),
    payment_method VARCHAR(50)   DEFAULT 'Cash',
    subtotal       NUMERIC(10,2) DEFAULT 0,
    total          NUMERIC(10,2) DEFAULT 0,
    profit         NUMERIC(10,2) DEFAULT 0,
    payment_status VARCHAR(20)   NOT NULL DEFAULT 'paid',  -- 'paid' | 'pending' | 'cancelled'
    shipping       JSONB,                                  -- datos de envío del pedido online
    date           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ─── Transaction Items ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transaction_items (
    id             SERIAL PRIMARY KEY,
    transaction_id INTEGER       NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    product_id     INTEGER       REFERENCES products(id) ON DELETE SET NULL,
    product_name   VARCHAR(255),
    quantity       INTEGER       NOT NULL DEFAULT 1,
    unit_price     NUMERIC(10,2) NOT NULL DEFAULT 0,
    cost_price     NUMERIC(10,2)          DEFAULT 0,
    total          NUMERIC(10,2) NOT NULL DEFAULT 0,
    size           VARCHAR(50)                          -- talla vendida (NULL si el producto no maneja tallas)
);

-- ─── Settings (per-user key/value store) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key        VARCHAR(100) NOT NULL,
    value      TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, key)
);

-- ─── Leads (embudo del checkout de la landing) ───────────────────────────────
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
);

-- ─── Telegram bot sessions ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS telegram_sessions (
    chat_id    BIGINT PRIMARY KEY,
    user_id    INTEGER,
    state      TEXT DEFAULT 'idle',
    data       JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Audit Log ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
    id        SERIAL PRIMARY KEY,
    user_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action    VARCHAR(100) NOT NULL,
    entity    VARCHAR(100),
    entity_id INTEGER,
    detail    JSONB,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_username      ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_business_id   ON users(business_id);
CREATE INDEX IF NOT EXISTS idx_users_role          ON users(role);
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_products_business   ON products(business_id);
CREATE INDEX IF NOT EXISTS idx_products_sku        ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode    ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_transactions_biz    ON transactions(business_id);
CREATE INDEX IF NOT EXISTS idx_transactions_seller ON transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date   ON transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_tx_items_tx         ON transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_settings_user       ON settings(user_id);
CREATE INDEX IF NOT EXISTS idx_businesses_sync_key  ON businesses(sync_api_key);

-- ─── Updated_at trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_users_updated_at') THEN
        CREATE TRIGGER trg_users_updated_at
            BEFORE UPDATE ON users
            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_products_updated_at') THEN
        CREATE TRIGGER trg_products_updated_at
            BEFORE UPDATE ON products
            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
END;
$$;

-- ─── Super Admin seed (idempotent) ────────────────────────────────────────────
-- Password will be replaced by the app's seed script using bcrypt.
-- This plain INSERT is just a placeholder — run `npm run db:push` instead.
