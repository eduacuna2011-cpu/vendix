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
const { ensureMigrated } = require('../migrations');

// Las columnas de sincronización las crea server/migrations.js. Se mantiene el
// nombre `ensureSyncColumns` por compatibilidad con businesses.js.
const ensureSyncColumns = ensureMigrated;

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
            `SELECT id, name, sync_enabled, COALESCE(plan, 'basico') AS plan
             FROM businesses WHERE sync_api_key = $1`,
            [key]
        );
        if (!biz) return res.status(401).json({ error: 'invalid_store_key' });
        // La tienda online es una función del plan Premium. Un negocio Básico
        // (aunque tenga llave de una época anterior) no puede sincronizar.
        if (biz.plan !== 'premium') return res.status(403).json({ error: 'plan_not_premium' });
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
                    stock, sizes, size_mode, sale_price, image, barcode
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
// La tienda registra un PEDIDO. Entra como 'pending' (por confirmar) y NO
// descuenta stock todavía: el admin decide en Vendix si se pagó o no. Al
// confirmar el pago se descuenta el stock; al cancelar, no se toca nada.
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

        // Resolver cada item por SKU (o por id directo) dentro del negocio.
        // No se valida ni descuenta stock aquí: es solo un pedido por confirmar.
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
            item._product  = p;
            item._unitPrice = item.unitPrice != null ? parseFloat(item.unitPrice) : parseFloat(p.sale_price);
            const lineTotal = item._unitPrice * item.quantity;
            subtotal += lineTotal;
            total    += lineTotal;
            profit   += (item._unitPrice - parseFloat(p.cost_price)) * item.quantity;
        }

        // Insertar el pedido como pendiente (seller_id null = pedido online)
        const { rows: [tx] } = await client.query(
            `INSERT INTO transactions
               (business_id, seller_id, seller_name, customer, payment_method, subtotal, total, profit, date, payment_status)
             VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, NOW(), 'pending')
             RETURNING *`,
            [bizId, 'Tienda Online', customer || null, paymentMethod || 'Online',
             subtotal, total, profit]
        );

        for (const item of items) {
            await client.query(
                `INSERT INTO transaction_items
                   (transaction_id, product_id, product_name, quantity, unit_price, cost_price, total, size)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
                [tx.id, item._product.id, item._product.name,
                 item.quantity, item._unitPrice, item._product.cost_price,
                 item._unitPrice * item.quantity, item.size || null]
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

// ── GET /api/integration/culqi/config ─────────────────────────────────────────
// La tienda pide la llave PÚBLICA de Culqi para abrir el formulario de tarjeta.
// (Por ahora, una sola cuenta Culqi a nivel plataforma vía env. Cuando sea por
// tienda, aquí se devolvería la pública guardada en el negocio.)
router.get('/culqi/config', (req, res) => {
    res.json({ publicKey: process.env.CULQI_PUBLIC_KEY || '' });
});

// ── POST /api/integration/culqi/charge ────────────────────────────────────────
// La tienda manda el TOKEN de Culqi (generado en el navegador con la llave
// pública) + los items. El servidor calcula el monto (NO confía en el navegador),
// cobra con la llave SECRETA, y si aprueba: registra la venta como PAGADA y
// descuenta stock atómicamente. Devuelve el id del cargo y de la transacción.
router.post('/culqi/charge', async (req, res) => {
    const sk = process.env.CULQI_SECRET_KEY;
    if (!sk || sk === 'sk_test_REEMPLAZAR') {
        return res.status(503).json({ error: 'Culqi no configurado.' });
    }
    const { token, email, items, customer, shipping } = req.body;
    if (!token || !email) return res.status(400).json({ error: 'Faltan token o email.' });
    if (!items || !items.length) return res.status(400).json({ error: 'Carrito vacío.' });

    const bizId = req.business.id;
    // Nombre del cliente: el explícito, o el del envío.
    const custName = customer || (shipping && shipping.name) || null;
    const shipJson = shipping ? JSON.stringify(shipping) : null;
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        // 1) Resolver items y calcular el monto en el SERVIDOR (precio real de la BD).
        let total = 0, profit = 0;
        for (const it of items) {
            let p = null;
            if (it.sku) {
                const { rows } = await client.query(
                    'SELECT id, name, stock, cost_price, sale_price FROM products WHERE LOWER(sku)=LOWER($1) AND business_id=$2 LIMIT 1',
                    [it.sku, bizId]);
                p = rows[0] || null;
            } else if (it.productId) {
                const { rows } = await client.query(
                    'SELECT id, name, stock, cost_price, sale_price FROM products WHERE id=$1 AND business_id=$2',
                    [it.productId, bizId]);
                p = rows[0] || null;
            }
            if (!p) { await client.query('ROLLBACK'); return res.status(400).json({ error: `Producto no encontrado: ${it.sku || it.productId}` }); }
            const qty = parseInt(it.quantity) || 1;
            it._p = p; it._qty = qty; it._unit = parseFloat(p.sale_price);
            total  += it._unit * qty;
            profit += (it._unit - parseFloat(p.cost_price)) * qty;
        }
        const amountCents = Math.round(total * 100);
        if (amountCents < 300) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Monto mínimo S/. 3.00' }); }

        // 2) Cobrar en Culqi con la llave secreta (server↔Culqi, no falseable).
        let desc = `Pedido ${req.business.name}`.slice(0, 80);
        if (desc.length < 5) desc = 'Pedido tienda online';
        const resp = await fetch('https://api.culqi.com/v2/charges', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${sk}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: amountCents, currency_code: 'PEN', email, source_id: token, description: desc })
        });
        const charge = await resp.json();
        if (!resp.ok) {
            await client.query('ROLLBACK');
            const msg = charge?.user_message || charge?.merchant_message || 'Pago rechazado';
            return res.status(400).json({ error: msg });
        }

        // 3) Pago aprobado → registrar venta PAGADA + descontar stock atómico.
        const { rows: [tx] } = await client.query(
            `INSERT INTO transactions
               (business_id, seller_id, seller_name, customer, payment_method, subtotal, total, profit, date, payment_status, shipping)
             VALUES ($1, NULL, 'Tienda Online', $2, 'Culqi', $3, $3, $4, NOW(), 'paid', $5)
             RETURNING id`,
            [bizId, custName, total, profit, shipJson]);

        for (const it of items) {
            const upd = await client.query(
                'UPDATE products SET stock = stock - $1 WHERE id = $2 AND business_id = $3 AND stock >= $1',
                [it._qty, it._p.id, bizId]);
            if (!upd.rowCount) { // stock insuficiente: se revierte TODO (incluido evitar registrar pagado sin stock)
                await client.query('ROLLBACK');
                return res.status(409).json({ error: `Sin stock suficiente de ${it._p.name}`, chargeId: charge.id, refundNeeded: true });
            }
            await client.query(
                `INSERT INTO transaction_items (transaction_id, product_id, product_name, quantity, unit_price, cost_price, total)
                 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                [tx.id, it._p.id, it._p.name, it._qty, it._unit, it._p.cost_price, it._unit * it._qty]);
        }

        await client.query('COMMIT');
        res.json({ success: true, chargeId: charge.id, transactionId: tx.id, total });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('culqi/charge error:', err);
        res.status(500).json({ error: 'Error interno al procesar el pago.' });
    } finally {
        client.release();
    }
});

module.exports = router;
module.exports.ensureSyncColumns = ensureSyncColumns;
module.exports.generateSyncKey   = generateSyncKey;
