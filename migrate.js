// ═══════════════════════════════════════════════════════════════════════════════
// Migration script: localStorage (exported JSON) → PostgreSQL
//
// HOW TO USE:
//   1. En el browser, abre la app antigua y corre en la consola:
//        copy(JSON.stringify({ products: JSON.parse(localStorage.inventory_products||'[]'), sellers: JSON.parse(localStorage.inventory_sellers||'[]'), businesses: JSON.parse(localStorage.inventory_businesses||'[]'), adminUsers: JSON.parse(localStorage.inventory_admin_users||'[]'), transactions: JSON.parse(localStorage.inventory_transactions||'[]') }))
//   2. Pega el resultado en un archivo llamado  migration-data.json
//   3. Corre:  node migrate.js
// ═══════════════════════════════════════════════════════════════════════════════

require('dotenv').config();
const fs     = require('fs');
const path   = require('path');
const bcrypt = require('bcryptjs');
const db     = require('./server/db');

const DATA_FILE = path.join(__dirname, 'migration-data.json');

async function main() {
    if (!fs.existsSync(DATA_FILE)) {
        console.error(`\nERROR: ${DATA_FILE} not found.\nFollow the HOW TO USE instructions at the top of this file.\n`);
        process.exit(1);
    }

    const raw  = fs.readFileSync(DATA_FILE, 'utf8');
    const data = JSON.parse(raw);
    const { products = [], sellers = [], businesses = [], adminUsers = [], transactions = [] } = data;

    console.log(`\nFound: ${businesses.length} businesses, ${adminUsers.length} admin users, ${sellers.length} sellers, ${products.length} products, ${transactions.length} transactions\n`);

    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        // ── Businesses ────────────────────────────────────────────────────────
        const bizIdMap = {}; // old id → new id
        for (const biz of businesses) {
            const { rows: [existing] } = await client.query(
                'SELECT id FROM businesses WHERE LOWER(name) = LOWER($1)', [biz.name]
            );
            if (existing) {
                bizIdMap[biz.id] = existing.id;
                console.log(`  Business "${biz.name}" already exists → id ${existing.id}`);
            } else {
                const { rows: [nb] } = await client.query(
                    `INSERT INTO businesses (name, status, created_at)
                     VALUES ($1, $2, $3) RETURNING id`,
                    [biz.name, biz.status || 'Active', biz.createdAt || new Date()]
                );
                bizIdMap[biz.id] = nb.id;
                console.log(`  ✓ Business "${biz.name}" → id ${nb.id}`);
            }
        }

        // ── Admin Users (Business Admins) ─────────────────────────────────────
        const adminIdMap = {}; // old id → new id
        for (const u of adminUsers) {
            const newBizId = bizIdMap[u.businessId] || null;
            const { rows: [existing] } = await client.query(
                'SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [u.username]
            );
            if (existing) {
                adminIdMap[u.id] = existing.id;
                console.log(`  Admin "${u.username}" already exists → skipped`);
            } else {
                const hash = await bcrypt.hash(u.password || 'changeme123', 10);
                const { rows: [nu] } = await client.query(
                    `INSERT INTO users (business_id, business_name, full_name, username, email, phone,
                                        password_hash, role, status, created_at)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
                    [newBizId, u.businessName || null, u.fullName, u.username,
                     u.email || null, u.phone || null, hash,
                     u.role || 'Business Admin', u.status || 'Active',
                     u.createdAt || new Date()]
                );
                adminIdMap[u.id] = nu.id;
                console.log(`  ✓ Admin "${u.username}" → id ${nu.id}`);
            }
        }

        // ── Sellers ───────────────────────────────────────────────────────────
        const sellerIdMap = {}; // old id → new id
        for (const s of sellers) {
            const newBizId = bizIdMap[s.businessId] || null;
            const { rows: [existing] } = await client.query(
                'SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [s.username]
            );
            if (existing) {
                sellerIdMap[s.id] = existing.id;
                console.log(`  Seller "${s.username}" already exists → skipped`);
            } else {
                const hash = await bcrypt.hash(s.password || 'changeme123', 10);
                const { rows: [ns] } = await client.query(
                    `INSERT INTO users (business_id, business_name, full_name, username, email, phone,
                                        password_hash, role, status, commission_percentage, join_date)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,'Seller',$8,$9,$10) RETURNING id`,
                    [newBizId, null, s.fullName, s.username,
                     s.email || null, s.phone || null, hash,
                     s.status || 'Active',
                     parseFloat(s.commissionPercentage) || 0,
                     s.joinDate || new Date()]
                );
                sellerIdMap[s.id] = ns.id;
                console.log(`  ✓ Seller "${s.username}" → id ${ns.id}`);
            }
        }

        // ── Products ──────────────────────────────────────────────────────────
        const productIdMap = {};
        for (const p of products) {
            const newBizId = bizIdMap[p.businessId] || null;
            const { rows: [existing] } = await client.query(
                'SELECT id FROM products WHERE business_id = $1 AND LOWER(sku) = LOWER($2)',
                [newBizId, p.sku || '']
            );
            if (existing && p.sku) {
                productIdMap[p.id] = existing.id;
                console.log(`  Product SKU "${p.sku}" already exists → skipped`);
            } else {
                const { rows: [np] } = await client.query(
                    `INSERT INTO products (business_id, sku, name, category, color, size, model,
                                           stock, cost_price, sale_price, image)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
                    [newBizId, p.sku || null, p.name, p.category || null,
                     p.color || null, p.size || null, p.model || null,
                     parseInt(p.stock) || 0,
                     parseFloat(p.costPrice || p.price || 0),
                     parseFloat(p.salePrice || p.price || 0),
                     p.image || null]
                );
                productIdMap[p.id] = np.id;
                console.log(`  ✓ Product "${p.name}" → id ${np.id}`);
            }
        }

        // ── Transactions ──────────────────────────────────────────────────────
        let txCount = 0;
        for (const t of transactions) {
            const newBizId = bizIdMap[t.businessId] || null;

            // Find seller by name
            let sellerId = null;
            if (t.seller) {
                const { rows: [su] } = await client.query(
                    'SELECT id FROM users WHERE full_name = $1 AND role = $2 LIMIT 1',
                    [t.seller, 'Seller']
                );
                if (su) sellerId = su.id;
            }

            const { rows: [nt] } = await client.query(
                `INSERT INTO transactions (business_id, seller_id, seller_name, customer,
                                           payment_method, total, profit, date)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
                [newBizId, sellerId, t.seller || null, t.customer || null,
                 t.paymentMethod || 'Cash',
                 parseFloat(t.total || 0), parseFloat(t.profit || 0),
                 t.date || new Date()]
            );

            // Items
            if (t.items && t.items.length) {
                for (const item of t.items) {
                    const newProductId = productIdMap[item.id] || item.productId || null;
                    await client.query(
                        `INSERT INTO transaction_items (transaction_id, product_id, product_name, quantity, unit_price, total)
                         VALUES ($1,$2,$3,$4,$5,$6)`,
                        [nt.id, newProductId, item.name || item.product_name || null,
                         item.quantity || 1,
                         parseFloat(item.price || item.unitPrice || 0),
                         parseFloat((item.price || item.unitPrice || 0) * (item.quantity || 1))]
                    );
                }
            }
            txCount++;
        }
        console.log(`  ✓ ${txCount} transactions migrated`);

        await client.query('COMMIT');
        console.log('\n✅ Migration complete!\n');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('\n❌ Migration failed:', err);
        process.exit(1);
    } finally {
        client.release();
        process.exit(0);
    }
}

main();
