// ═══════════════════════════════════════════════════════════════════════════════
// Seed HypePods Perú — negocio + Business Admin + catálogo inicial.
// Idempotente: se puede correr varias veces sin duplicar.
// Uso: node server/seed-hypepods.js
// ═══════════════════════════════════════════════════════════════════════════════
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db     = require('./db');
const { ensureMigrated } = require('./migrations');

// Llave de tienda (X-Store-Key) que usa el storefront en Vercel para leer el
// catálogo vía /api/integration. Debe coincidir con CONFIG.vendix.storeKey del
// index.html de hypepods-peru.
const STORE_KEY = 'vx_6628902ca8c1262bcef16b5d8fbd773fbe8859885822837c';

const BIZ_NAME   = 'HypePods Perú';
const ADMIN_USER = 'hypepods';
const ADMIN_PASS = process.env.HYPEPODS_ADMIN_PASS || 'hypepods123'; // cambiar luego
const ADMIN_NAME = 'HypePods Perú';

// Catálogo inicial (basado en el contenido de su TikTok @hypepods_peru1).
// Precios en soles. cost_price es referencial para el margen.
const PRODUCTS = [
    { sku:'HP-APP2',  name:'AirPods Pro 2da Gen',            category:'Audio',       color:'Blanco', size:null,   model:'Cancelación de ruido, estuche MagSafe', stock:40, cost:55,  price:99.90 },
    { sku:'HP-AP3',   name:'AirPods 3ra Gen',               category:'Audio',       color:'Blanco', size:null,   model:'Audio espacial, estuche de carga',      stock:35, cost:45,  price:84.90 },
    { sku:'HP-AP2',   name:'AirPods 2da Gen',               category:'Audio',       color:'Blanco', size:null,   model:'Clásicos, estuche de carga',            stock:50, cost:35,  price:64.90 },
    { sku:'HP-BUDS',  name:'Audífonos Inalámbricos Pro',    category:'Audio',       color:'Negro',  size:null,   model:'Bluetooth 5.3, touch control',          stock:60, cost:22,  price:44.90 },
    { sku:'HP-HOOD',  name:'Hoodie Essentials',             category:'Ropa',        color:'Beige',  size:'M',    model:'Oversize, felpa premium',               stock:20, cost:60,  price:129.90 },
    { sku:'HP-POLO',  name:'Polo Essentials',               category:'Ropa',        color:'Negro',  size:'M',    model:'Algodón pesado, logo bordado',          stock:30, cost:32,  price:69.90 },
    { sku:'HP-GG',    name:'Zapatillas Golden Goose',       category:'Diseñador',   color:'Blanco', size:'42',   model:'Estilo vintage, edición exclusiva',     stock:12, cost:120, price:249.90 },
    { sku:'HP-CAP',   name:'Gorra Trucker Hype',            category:'Accesorios',  color:'Negro',  size:null,   model:'Snapback, diseño exclusivo',            stock:45, cost:14,  price:34.90 },
];

async function main() {
    await ensureMigrated();

    // ── 1) Negocio (Premium, pagado, activo) ──────────────────────────────────
    let bizId;
    const { rows: existBiz } = await db.query('SELECT id FROM businesses WHERE name = $1', [BIZ_NAME]);
    if (existBiz.length) {
        bizId = existBiz[0].id;
        await db.query(
            `UPDATE businesses
                SET plan='premium', is_paid=TRUE, status='Active',
                    sync_api_key=$1, sync_enabled=TRUE
              WHERE id=$2`,
            [STORE_KEY, bizId]
        );
        console.log(`Negocio "${BIZ_NAME}" ya existía (id=${bizId}) — actualizado a Premium.`);
    } else {
        const { rows: [biz] } = await db.query(
            `INSERT INTO businesses (name, status, is_paid, plan, sync_api_key, sync_enabled)
             VALUES ($1, 'Active', TRUE, 'premium', $2, TRUE)
             RETURNING id`,
            [BIZ_NAME, STORE_KEY]
        );
        bizId = biz.id;
        console.log(`Negocio "${BIZ_NAME}" creado (id=${bizId}).`);
    }

    // ── 2) Business Admin ─────────────────────────────────────────────────────
    const { rows: existUser } = await db.query('SELECT id FROM users WHERE username = $1', [ADMIN_USER]);
    if (existUser.length) {
        await db.query(
            `UPDATE users SET business_id=$1, business_name=$2, role='Business Admin', status='Active'
              WHERE id=$3`,
            [bizId, BIZ_NAME, existUser[0].id]
        );
        console.log(`Usuario "${ADMIN_USER}" ya existía — reasignado al negocio.`);
    } else {
        const hash = await bcrypt.hash(ADMIN_PASS, 10);
        await db.query(
            `INSERT INTO users (business_id, business_name, full_name, username, password_hash, role, status)
             VALUES ($1, $2, $3, $4, $5, 'Business Admin', 'Active')`,
            [bizId, BIZ_NAME, ADMIN_NAME, ADMIN_USER, hash]
        );
        console.log(`Usuario Business Admin "${ADMIN_USER}" creado.`);
    }

    // ── 3) Catálogo (upsert por SKU dentro del negocio) ───────────────────────
    for (const p of PRODUCTS) {
        const { rows } = await db.query(
            'SELECT id FROM products WHERE LOWER(sku)=LOWER($1) AND business_id=$2 LIMIT 1',
            [p.sku, bizId]
        );
        if (rows.length) {
            await db.query(
                `UPDATE products SET name=$1, category=$2, color=$3, size=$4, model=$5,
                                     stock=$6, cost_price=$7, sale_price=$8
                  WHERE id=$9 AND business_id=$10`,
                [p.name, p.category, p.color, p.size, p.model, p.stock, p.cost, p.price, rows[0].id, bizId]
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
    console.log(`Catálogo cargado: ${PRODUCTS.length} productos.`);

    console.log('\n─────────────────────────────────────────────');
    console.log(`  Negocio:    ${BIZ_NAME} (Premium)`);
    console.log(`  Usuario:    ${ADMIN_USER}`);
    console.log(`  Password:   ${ADMIN_PASS}  (cámbiala luego)`);
    console.log(`  Store Key:  ${STORE_KEY}`);
    console.log('─────────────────────────────────────────────\n');
    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
