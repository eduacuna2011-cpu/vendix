const router = require('express').Router();
const db     = require('../db');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

function bizScope(req) {
    if (req.user.role === 'Super Admin') return { where: '', params: [] };
    return { where: 'AND t.business_id = $1', params: [req.user.businessId] };
}

// GET /api/transactions
router.get('/', async (req, res) => {
    try {
        const scope = bizScope(req);
        const params = [...scope.params];
        let sql = `
            SELECT t.*,
                   json_agg(json_build_object(
                       'id', ti.id, 'product_id', ti.product_id,
                       'product_name', ti.product_name, 'quantity', ti.quantity,
                       'unit_price', ti.unit_price, 'total', ti.total
                   ) ORDER BY ti.id) AS items
            FROM transactions t
            LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
            WHERE 1=1 ${scope.where}
        `;
        sql += ' GROUP BY t.id ORDER BY t.date DESC';

        if (req.query.limit) {
            const lim = parseInt(req.query.limit);
            if (!isNaN(lim) && lim > 0) {
                params.push(lim);
                sql += ` LIMIT $${params.length}`;
            }
        }

        const { rows } = await db.query(sql, params);
        // Clean up null items array from LEFT JOIN with no items
        rows.forEach(r => {
            if (r.items && r.items[0] && r.items[0].id === null) r.items = [];
        });
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/transactions/stats  — dashboard numbers
router.get('/stats', async (req, res) => {
    try {
        const scope = bizScope(req);
        const params = [...scope.params];

        // Apply seller filter if role is Seller
        let sellerWhere = '';
        if (req.user.role === 'Seller') {
            params.push(req.user.id);
            sellerWhere = ` AND t.seller_id = $${params.length}`;
        }

        const { rows: [r] } = await db.query(
            `SELECT
                COALESCE(SUM(total) FILTER (WHERE DATE(date AT TIME ZONE 'America/Lima') = DATE(NOW() AT TIME ZONE 'America/Lima')), 0)  AS sales_today,
                COALESCE(SUM(total) FILTER (WHERE date_trunc('month', date AT TIME ZONE 'America/Lima') = date_trunc('month', NOW() AT TIME ZONE 'America/Lima')), 0) AS sales_month,
                COUNT(*) FILTER (WHERE date_trunc('month', date AT TIME ZONE 'America/Lima') = date_trunc('month', NOW() AT TIME ZONE 'America/Lima'))               AS orders_month,
                COUNT(*)                                                                                           AS total_orders
             FROM transactions t WHERE 1=1 ${scope.where}${sellerWhere}`,
            params
        );
        res.json({
            salesToday:   parseFloat(r.sales_today),
            salesMonth:   parseFloat(r.sales_month),
            ordersMonth:  parseInt(r.orders_month),
            totalOrders:  parseInt(r.total_orders)
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/transactions/recent
router.get('/recent', async (req, res) => {
    try {
        const scope = bizScope(req);
        const params = [...scope.params];
        let sellerWhere = '';
        if (req.user.role === 'Seller') {
            params.push(req.user.id);
            sellerWhere = ` AND t.seller_id = $${params.length}`;
        }
        params.push(parseInt(req.query.limit) || 5);
        const { rows } = await db.query(
            `SELECT t.id, t.date, t.total, t.profit, t.payment_method, t.seller_name,
                    json_agg(json_build_object(
                        'product_name', ti.product_name,
                        'quantity', ti.quantity,
                        'unit_price', ti.unit_price,
                        'total', ti.total
                    ) ORDER BY ti.id) AS items
             FROM transactions t
             LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
             WHERE 1=1 ${scope.where}${sellerWhere}
             GROUP BY t.id ORDER BY t.date DESC
             LIMIT $${params.length}`,
            params
        );
        rows.forEach(r => {
            if (r.items && r.items[0] && r.items[0].product_name === null) r.items = [];
        });
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/transactions  — create a sale
router.post('/', async (req, res) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        const { customer, paymentMethod, items } = req.body;
        if (!items || !items.length) return res.status(400).json({ error: 'items required' });

        const bizId = req.user.role === 'Super Admin' ? (req.body.businessId || null) : req.user.businessId;
        let subtotal = 0, total = 0, profit = 0;

        // Validate stock and compute totals
        for (const item of items) {
            const { rows: [p] } = await client.query(
                'SELECT id, name, stock, cost_price, sale_price FROM products WHERE id = $1',
                [item.productId]
            );
            if (!p) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: `Product ${item.productId} not found` });
            }
            if (p.stock < item.quantity) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: `Insufficient stock for "${p.name}"` });
            }
            item._product = p;
            const lineTotal = item.unitPrice * item.quantity;
            subtotal += lineTotal;
            total    += lineTotal;
            profit   += (item.unitPrice - p.cost_price) * item.quantity;
        }

        // Deduct stock FIRST
        for (const item of items) {
            await client.query(
                'UPDATE products SET stock = stock - $1 WHERE id = $2',
                [item.quantity, item.productId]
            );
        }

        // Insert transaction
        const { rows: [tx] } = await client.query(
            `INSERT INTO transactions
               (business_id, seller_id, seller_name, customer, payment_method, subtotal, total, profit, date)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
             RETURNING *`,
            [bizId, req.user.id, req.user.fullName,
             customer || null, paymentMethod || 'Cash',
             subtotal, total, profit]
        );

        // Insert items
        for (const item of items) {
            await client.query(
                `INSERT INTO transaction_items
                   (transaction_id, product_id, product_name, quantity, unit_price, cost_price, total)
                 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                [tx.id, item.productId, item._product.name,
                 item.quantity, item.unitPrice, item._product.cost_price,
                 item.unitPrice * item.quantity]
            );
        }

        await client.query('COMMIT');
        res.status(201).json(tx);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
});

// DELETE /api/transactions/wipe-all  — SA only
router.delete('/wipe-all', async (req, res) => {
    if (req.user.role !== 'Super Admin') return res.status(403).json({ error: 'Forbidden' });
    try {
        await db.query('DELETE FROM transaction_items');
        await db.query('DELETE FROM transactions');
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;

// ── Public receipt endpoint (no auth required) ────────────────────────────────
const publicRouter = require('express').Router();
publicRouter.get('/:id', async (req, res) => {
    try {
        const { rows: [tx] } = await db.query(`
            SELECT t.id, t.date, t.total, t.subtotal, t.profit,
                   t.payment_method, t.seller_name, t.customer,
                   b.name AS business_name,
                   json_agg(json_build_object(
                       'name', ti.product_name,
                       'quantity', ti.quantity,
                       'unit_price', ti.unit_price,
                       'total', ti.total
                   )) AS items
            FROM transactions t
            JOIN businesses b ON b.id = t.business_id
            LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
            WHERE t.id = $1
            GROUP BY t.id, t.date, t.total, t.subtotal, t.profit,
                     t.payment_method, t.seller_name, t.customer, b.name
        `, [req.params.id]);
        if (!tx) return res.status(404).json({ error: 'Not found' });
        res.json(tx);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});
module.exports.publicRouter = publicRouter;
