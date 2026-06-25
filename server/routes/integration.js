// ═══════════════════════════════════════════════════════════════════════════════
// Integración con tiendas externas (Vercel)
// Sincroniza productos y ventas desde una tienda online hacia Vendix.
// NO usa JWT: la tienda se autentica con su llave secreta (header X-Store-Key),
// que el Super Admin genera al conectar la tienda. El business_id se deduce
// de esa llave, así que el aislamiento multi-tenant se mantiene.
// ═══════════════════════════════════════════════════════════════════════════════
const router = require('express').Router();
const crypto = require('crypto');
const db     = require('../db');

// ── Columnas de sincronización (idempotente, se autorepara en cada arranque) ──
let _columnsReady = false;
async function ensureSyncColumns() {
    if (_columnsReady) return;
    await db.query(`
        ALTER TABLE businesses
            ADD COLUMN IF NOT EXISTS vercel_store_id VARCHAR(255),
            ADD COLUMN IF NOT EXISTS sync_api_key    VARCHAR(64),
            ADD COLUMN IF NOT EXISTS sync_enabled    BOOLEAN NOT NULL DEFAULT TRUE
    `);
    await db.query(
        'CREATE INDEX IF NOT EXISTS idx_businesses_sync_key ON businesses(sync_api_key)'
    );
    _columnsReady = true;
}
ensureSyncColumns().catch(console.error);

function generateSyncKey() {
    return 'vx_' + crypto.randomBytes(24).toString('hex'); // 51 chars, cabe en VARCHAR(64)
}

// ── Auth por llave de tienda — resuelve el business desde X-Store-Key ──────────
async function storeAuth(req, res, next) {
    try {
        await ensureSyncColumns();
        const key = req.headers['x-store-key'] || req.query.key;
        if (!key) return res.status(401).json({ error: 'missing_store_key' });

        const { rows: [biz] } = await db.query(
            'SELECT id, name, sync_enabled FROM businesses WHERE sync_api_key = $1',
            [key]
        );
        if (!biz) return res.status(401).json({ error: 'invalid_store_key' });
        if (!biz.sync_enabled) return res.status(403).json({ error: 'sync_disabled' });

        req.business = biz;
        next();
    } catch (err) {
        console.error('storeAuth error:', err);
        res.status(500).json({ error: 'Server error' });
    }
}

router.use(storeAuth);

// ── Ping de prueba para verificar la conexión de la tienda ────────────────────
// GET /api/integration/ping
router.get('/ping', (req, res) => {
    res.json({ ok: true, business: req.business.name });
});

// ── GET /api/integration/products ─────────────────────────────────────────────
// La tienda jala su catálogo desde Vendix (fuente de verdad del inventario).
// Solo devuelve productos del negocio dueño de la llave. Opcional: ?inStock=1
// para ocultar agotados.
router.get('/products', async (req, res) => {
    try {
        const bizId = req.business.id;
        const onlyInStock = req.query.inStock === '1' || req.query.inStock === 'true';
        const { rows } = await db.query(
            `SELECT id, sku, name, category, color, size, model,
                    stock, sale_price, image, barcode
             FROM products
             WHERE business_id = $1 ${onlyInStock ? 'AND stock > 0' : ''}
             ORDER BY name`,
            [bizId]
        );
        res.json(rows);
    } catch (err) {
        console.error('integration GET/products error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ── POST /api/integration/products ────────────────────────────────────────────
// La tienda manda un producto. Si ya existe (por SKU dentro del negocio) se
// actualiza; si no, se inserta. Aparece en el inventario del admin sin que él
// haga nada.
router.post('/products', async (req, res) => {
    try {
        const bizId = req.business.id;
        const { sku, name, category, color, size, model,
                stock, costPrice, salePrice, image, barcode } = req.body;
        if (!name) return res.status(400).json({ error: 'name required' });

        // ¿Existe ya por SKU dentro de este negocio?
        let existing = null;
        if (sku) {
            const { rows } = await db.query(
                'SELECT id FROM products WHERE LOWER(sku) = LOWER($1) AND business_id = $2 LIMIT 1',
                [sku, bizId]
            );
            existing = rows[0] || null;
        }

        if (existing) {
            const { rows: [p] } = await db.query(
                `UPDATE products SET
                     name       = COALESCE($1, name),
                     category   = COALESCE($2, category),
                     color      = COALESCE($3, color),
                     size       = COALESCE($4, size),
                     model      = COALESCE($5, model),
                     stock      = COALESCE($6, stock),
                     cost_price = COALESCE($7, cost_price),
                     sale_price = COALESCE($8, sale_price),
                     image      = COALESCE($9, image),
                     barcode    = COALESCE($10, barcode)
                 WHERE id = $11 AND business_id = $12
                 RETURNING *`,
                [name, category || null, color || null, size || null, model || null,
                 stock !== undefined ? parseInt(stock) : null,
                 costPrice !== undefined ? parseFloat(costPrice) : null,
                 salePrice !== undefined ? parseFloat(salePrice) : null,
                 image || null,
                 barcode || null,
                 existing.id, bizId]
            );
            return res.json({ action: 'updated', product: p });
        }

        const { rows: [p] } = await db.query(
            `INSERT INTO products
               (business_id, sku, name, category, color, size, model, stock, cost_price, sale_price, image, barcode)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
             RETURNING *`,
            [bizId, sku || null, name, category || null, color || null,
             size || null, model || null,
             parseInt(stock) || 0,
             parseFloat(costPrice) || 0,
             parseFloat(salePrice) || 0,
             image || null, barcode || null]
        );
        res.status(201).json({ action: 'created', product: p });
    } catch (err) {
        console.error('integration/products error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ── POST /api/integration/sales ───────────────────────────────────────────────
// La tienda registra una venta. Descuenta stock e inserta la transacción + items.
// El admin la ve en sus ventas marcada como "Tienda Online".
router.post('/sales', async (req, res) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        const bizId = req.business.id;
        const { customer, paymentMethod, items } = req.body;
        if (!items || !items.length) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'items required' });
        }

        let subtotal = 0, total = 0, profit = 0;

        // Resolver cada item por SKU (o por id directo) dentro del negocio
        for (const item of items) {
            let p = null;
            if (item.sku) {
                const { rows } = await client.query(
                    'SELECT id, name, stock, cost_price, sale_price FROM products WHERE LOWER(sku) = LOWER($1) AND business_id = $2 LIMIT 1',
                    [item.sku, bizId]
                );
                p = rows[0] || null;
            } else if (item.productId) {
                const { rows } = await client.query(
                    'SELECT id, name, stock, cost_price, sale_price FROM products WHERE id = $1 AND business_id = $2',
                    [item.productId, bizId]
                );
                p = rows[0] || null;
            }
            if (!p) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: `Producto no encontrado: ${item.sku || item.productId}` });
            }
            if (p.stock < item.quantity) {
                await client.query('ROLLBACK');
                return res.status(409).json({ error: `Stock insuficiente para "${p.name}"` });
            }
            item._product  = p;
            item._unitPrice = item.unitPrice != null ? parseFloat(item.unitPrice) : parseFloat(p.sale_price);
            const lineTotal = item._unitPrice * item.quantity;
            subtotal += lineTotal;
            total    += lineTotal;
            profit   += (item._unitPrice - parseFloat(p.cost_price)) * item.quantity;
        }

        // Descontar stock
        for (const item of items) {
            await client.query(
                'UPDATE products SET stock = stock - $1 WHERE id = $2',
                [item.quantity, item._product.id]
            );
        }

        // Insertar transacción (seller_id null = venta online, no la hizo un vendedor)
        const { rows: [tx] } = await client.query(
            `INSERT INTO transactions
               (business_id, seller_id, seller_name, customer, payment_method, subtotal, total, profit, date)
             VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, NOW())
             RETURNING *`,
            [bizId, 'Tienda Online', customer || null, paymentMethod || 'Online',
             subtotal, total, profit]
        );

        for (const item of items) {
            await client.query(
                `INSERT INTO transaction_items
                   (transaction_id, product_id, product_name, quantity, unit_price, cost_price, total)
                 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                [tx.id, item._product.id, item._product.name,
                 item.quantity, item._unitPrice, item._product.cost_price,
                 item._unitPrice * item.quantity]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({ action: 'created', transaction: tx });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('integration/sales error:', err);
        res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
});

module.exports = router;
module.exports.ensureSyncColumns = ensureSyncColumns;
module.exports.generateSyncKey   = generateSyncKey;
