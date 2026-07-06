// ═══════════════════════════════════════════════════════════════════════════════
// Seed: crea el negocio "Urban Masters" (streetwear, Premium, pagado, sync activo)
// con su usuario Business Admin, su sync_api_key (X-Store-Key) y productos.
// Idempotente: si el username ya existe, reutiliza el negocio.
//   node server/seed-urbanmasters.js
// ═══════════════════════════════════════════════════════════════════════════════
const bcrypt = require('bcryptjs');
const db     = require('./db');
const { generateSyncKey } = require('./routes/integration');

const BIZ_NAME  = 'Urban Masters';
const USERNAME  = 'urbanmasters';
const PASSWORD  = 'urban123';
const FULL_NAME = 'Admin Urban Masters';
const PHONE     = '51999999999';

// Productos streetwear (sin imagen por ahora)
const PRODUCTS = [
    { sku:'UM-HOOD-BLK', name:'Hoodie Oversize "Concrete"',  category:'Más vendido', color:'Negro',   size:'M', model:'Algodón french terry 400gsm, corte oversize', stock:40, cost:60, price:129.90 },
    { sku:'UM-TEE-BOX',  name:'Tee Boxy "Static"',           category:'Nuevo',       color:'Hueso',   size:'L', model:'Jersey pesado 240gsm, caída boxy', stock:60, cost:28, price:69.90 },
    { sku:'UM-CARGO',    name:'Cargo Pants "Grid"',          category:null,          color:'Verde militar', size:'32', model:'Ripstop táctico, 6 bolsillos', stock:30, cost:75, price:159.90 },
    { sku:'UM-CAP',      name:'Gorra Trucker "Mono"',        category:null,          color:'Negro',   size:'Único', model:'Snapback estructurada, logo bordado', stock:80, cost:22, price:54.90 },
    { sku:'UM-BOMBER',   name:'Bomber "Nightshift"',         category:'Drop',        color:'Negro',   size:'L', model:'Nylon acolchado, cierre YKK', stock:18, cost:120, price:239.90 },
    { sku:'UM-JOGGER',   name:'Jogger "Fog"',                category:'Popular',     color:'Gris',    size:'M', model:'French terry, puño elástico, corte tapered', stock:35, cost:50, price:109.90 },
];

async function main() {
    const { rows: existingUser } = await db.query(
        'SELECT id, business_id FROM users WHERE username = $1', [USERNAME]
    );

    let bizId;
    const trialEnds = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    if (existingUser.length) {
        bizId = existingUser[0].business_id;
        console.log(`• Usuario "${USERNAME}" ya existe (business_id=${bizId}), reutilizando.`);
    } else {
        const key = generateSyncKey();
        const { rows: [biz] } = await db.query(
            `INSERT INTO businesses
               (name, status, trial_ends_at, is_paid, plan, sync_api_key, sync_enabled)
             VALUES ($1, 'Active', $2, TRUE, 'premium', $3, TRUE)
             RETURNING id`,
            [BIZ_NAME, trialEnds, key]
        );
        bizId = biz.id;
        const hash = await bcrypt.hash(PASSWORD, 10);
        await db.query(
            `INSERT INTO users
               (business_id, business_name, full_name, username, phone, password_hash, role, status)
             VALUES ($1, $2, $3, $4, $5, $6, 'Business Admin', 'Active')`,
            [bizId, BIZ_NAME, FULL_NAME, USERNAME, PHONE, hash]
        );
        console.log(`• Negocio "${BIZ_NAME}" creado (business_id=${bizId}) + admin "${USERNAME}".`);
    }

    let { rows: [b] } = await db.query('SELECT sync_api_key FROM businesses WHERE id = $1', [bizId]);
    let key = b.sync_api_key || generateSyncKey();
    await db.query(
        `UPDATE businesses SET is_paid=TRUE, plan='premium', status='Active',
                sync_enabled=TRUE, sync_api_key=$2 WHERE id=$1`,
        [bizId, key]
    );

    for (const p of PRODUCTS) {
        const { rows: found } = await db.query(
            'SELECT id FROM products WHERE LOWER(sku)=LOWER($1) AND business_id=$2 LIMIT 1',
            [p.sku, bizId]
        );
        if (found.length) {
            await db.query(
                `UPDATE products SET name=$1, category=$2, color=$3, size=$4, model=$5,
                        stock=$6, cost_price=$7, sale_price=$8 WHERE id=$9`,
                [p.name, p.category, p.color, p.size, p.model, p.stock, p.cost, p.price, found[0].id]
            );
        } else {
            await db.query(
                `INSERT INTO products
                   (business_id, sku, name, category, color, size, model, stock, cost_price, sale_price)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
                [bizId, p.sku, p.name, p.category, p.color, p.size, p.model, p.stock, p.cost, p.price]
            );
        }
    }
    console.log(`• ${PRODUCTS.length} productos asegurados (upsert por SKU).`);

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  URBAN MASTERS — datos de conexión');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  Negocio:     ${BIZ_NAME}  (business_id=${bizId})`);
    console.log(`  Login admin: ${USERNAME} / ${PASSWORD}`);
    console.log(`  Store Key:   ${key}`);
    console.log('═══════════════════════════════════════════════════════\n');

    await db.pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
