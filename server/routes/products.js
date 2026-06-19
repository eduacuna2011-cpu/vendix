const router = require('express').Router();
const db     = require('../db');
const { authMiddleware, requireBusinessAdmin } = require('../middleware/auth');

router.use(authMiddleware);

function bizScope(req) {
    if (req.user.role === 'Super Admin') return { where: '', params: [] };
    return { where: 'AND p.business_id = $1', params: [req.user.businessId] };
}

// GET /api/products
router.get('/', async (req, res) => {
    try {
        const { q, category, color, size } = req.query;
        const scope = bizScope(req);
        const params = [...scope.params];

        let sql = `SELECT * FROM products p WHERE 1=1 ${scope.where}`;

        if (q) {
            params.push(`%${q}%`);
            const n = params.length;
            sql += ` AND (p.name ILIKE $${n} OR p.sku ILIKE $${n} OR p.barcode ILIKE $${n})`;
        }
        if (category && category !== 'all') {
            params.push(category);
            sql += ` AND p.category = $${params.length}`;
        }
        if (color && color !== 'all') {
            params.push(color);
            sql += ` AND p.color = $${params.length}`;
        }
        if (size && size !== 'all') {
            params.push(size);
            sql += ` AND p.size = $${params.length}`;
        }
        sql += ' ORDER BY p.created_at DESC';

        const { rows } = await db.query(sql, params);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/products/stats
router.get('/stats', async (req, res) => {
    try {
        const scope = bizScope(req);
        const { rows: [r] } = await db.query(
            `SELECT COUNT(*) AS total,
                    COUNT(*) FILTER (WHERE stock = 0)          AS out_of_stock,
                    COUNT(*) FILTER (WHERE stock > 0 AND stock < 5) AS low_stock,
                    COALESCE(SUM(cost_price * stock), 0)       AS total_value
             FROM products p WHERE 1=1 ${scope.where}`,
            scope.params
        );
        res.json({
            totalProducts: parseInt(r.total),
            outOfStock:    parseInt(r.out_of_stock),
            lowStock:      parseInt(r.low_stock),
            totalValue:    parseFloat(r.total_value)
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/products/filters  — unique values for dropdowns
router.get('/filters', async (req, res) => {
    try {
        const scope = bizScope(req);
        const { rows } = await db.query(
            `SELECT DISTINCT category, color, size FROM products p WHERE 1=1 ${scope.where}`,
            scope.params
        );
        const categories = [...new Set(rows.map(r => r.category).filter(Boolean))].sort();
        const colors     = [...new Set(rows.map(r => r.color).filter(Boolean))].sort();
        const sizes      = [...new Set(rows.map(r => r.size).filter(Boolean))].sort();
        res.json({ categories, colors, sizes });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/products/generate-barcode — generate a unique barcode for this business
router.get('/generate-barcode', async (req, res) => {
    try {
        const bizId = req.user.role === 'Super Admin' ? 0 : (req.user.businessId || 0);
        const prefix = String(bizId).padStart(4, '0');
        let code, attempts = 0;
        do {
            const rand = Math.floor(Math.random() * 9999999).toString().padStart(7, '0');
            code = `2${prefix}${rand}`;
            const { rows } = await db.query(
                'SELECT id FROM products WHERE barcode = $1 LIMIT 1', [code]
            );
            if (!rows.length) break;
            attempts++;
        } while (attempts < 10);
        res.json({ barcode: code });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/products/barcode/:code — exact barcode lookup (for scanner)
router.get('/barcode/:code', async (req, res) => {
    try {
        const scope = bizScope(req);
        const params = [...scope.params, req.params.code];
        const n = params.length;
        const { rows } = await db.query(
            `SELECT * FROM products p WHERE barcode = $${n} ${scope.where} LIMIT 1`,
            params
        );
        if (!rows[0]) return res.status(404).json({ error: 'No product found with that barcode' });
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
    try {
        const { rows: [p] } = await db.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
        if (!p) return res.status(404).json({ error: 'Not found' });
        res.json(p);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/products
router.post('/', requireBusinessAdmin, async (req, res) => {
    try {
        const { sku, name, category, color, size, model, stock, costPrice, salePrice, image, barcode } = req.body;
        if (!name) return res.status(400).json({ error: 'name required' });

        const bizId = req.user.role === 'Super Admin' ? (req.body.businessId || null) : req.user.businessId;

        // Check SKU uniqueness within business
        if (sku) {
            const { rows } = await db.query(
                'SELECT id FROM products WHERE LOWER(sku) = LOWER($1) AND business_id = $2',
                [sku, bizId]
            );
            if (rows.length) return res.status(409).json({ error: 'SKU already exists' });
        }

        // Check barcode uniqueness within business
        if (barcode) {
            const { rows } = await db.query(
                'SELECT id FROM products WHERE barcode = $1 AND business_id = $2',
                [barcode, bizId]
            );
            if (rows.length) return res.status(409).json({ error: 'Barcode already exists for another product' });
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
        res.status(201).json(p);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/products/:id
router.put('/:id', requireBusinessAdmin, async (req, res) => {
    try {
        const { sku, name, category, color, size, model, stock, costPrice, salePrice, image, barcode } = req.body;
        const { rows: [p] } = await db.query(
            `UPDATE products
             SET sku        = COALESCE($1,  sku),
                 name       = COALESCE($2,  name),
                 category   = COALESCE($3,  category),
                 color      = COALESCE($4,  color),
                 size       = COALESCE($5,  size),
                 model      = COALESCE($6,  model),
                 stock      = COALESCE($7,  stock),
                 cost_price = COALESCE($8,  cost_price),
                 sale_price = COALESCE($9,  sale_price),
                 image      = COALESCE($10, image),
                 barcode    = $11
             WHERE id = $12
             RETURNING *`,
            [sku, name, category, color, size, model,
             stock !== undefined ? parseInt(stock) : null,
             costPrice !== undefined ? parseFloat(costPrice) : null,
             salePrice !== undefined ? parseFloat(salePrice) : null,
             image,
             barcode !== undefined ? (barcode || null) : null,
             req.params.id]
        );
        if (!p) return res.status(404).json({ error: 'Not found' });
        res.json(p);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/products/:id
router.delete('/:id', requireBusinessAdmin, async (req, res) => {
    try {
        const { rowCount } = await db.query('DELETE FROM products WHERE id = $1', [req.params.id]);
        if (!rowCount) return res.status(404).json({ error: 'Not found' });
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/products/wipe-all  — SA only
router.delete('/wipe-all', async (req, res) => {
    if (req.user.role !== 'Super Admin') return res.status(403).json({ error: 'Forbidden' });
    try {
        await db.query('DELETE FROM products');
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
