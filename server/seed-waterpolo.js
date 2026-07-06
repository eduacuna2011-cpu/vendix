// ═══════════════════════════════════════════════════════════════════════════════
// Seed: crea el negocio "Perú Water Polo" (Premium, pagado, sync activo) con su
// usuario Business Admin, su sync_api_key (X-Store-Key) y productos de muestra.
// Idempotente: si el username ya existe, reutiliza el negocio y solo asegura
// plan/pago/sync/key y hace upsert de los productos por SKU.
//   node server/seed-waterpolo.js
// ═══════════════════════════════════════════════════════════════════════════════
const bcrypt = require('bcryptjs');
const db     = require('./db');
const { generateSyncKey } = require('./routes/integration');

const BIZ_NAME  = 'Perú Water Polo';
const USERNAME  = 'peruwaterpolo';
const PASSWORD  = 'waterpolo123';
const FULL_NAME = 'Admin Perú Water Polo';
const PHONE     = '51999999999';

// Productos de muestra (indumentaria / equipamiento de waterpolo)
const PRODUCTS = [
    { sku:'WP-POLO-BL', name:'Polo Oficial Selección Perú',   category:'Más vendido', color:'Blanco/Rojo', size:'M', model:'Polo de juego, poliéster secado rápido', stock:40, cost:38, price:79.90, emoji:'👕' },
    { sku:'WP-POLO-AZ', name:'Polo Entrenamiento Aqua',        category:'Nuevo',       color:'Azul',        size:'L', model:'Tela técnica anti-cloro, corte deportivo', stock:35, cost:32, price:64.90, emoji:'👕' },
    { sku:'WP-GORRO-R', name:'Gorro de Waterpolo Rojo (par)',  category:null,          color:'Rojo',        size:'Único', model:'Set 2 gorros con protección de orejas', stock:60, cost:22, price:49.90, emoji:'🤽' },
    { sku:'WP-MALLA',   name:'Malla Competencia Anti-Cloro',   category:'Popular',     color:'Negro',       size:'32', model:'Poliéster PBT, alta durabilidad', stock:28, cost:45, price:89.90, emoji:'🩳' },
    { sku:'WP-PELOTA',  name:'Pelota de Waterpolo Oficial #5', category:null,          color:'Amarillo',    size:'#5', model:'Reglamentaria, agarre antideslizante', stock:20, cost:70, price:139.90, emoji:'🏐' },
    { sku:'WP-KIT',     name:'Kit Iniciación Waterpolo',       category:'Pack',        color:'Surtido',     size:'Único', model:'Gorro + malla + pelota mini', stock:15, cost:120, price:219.90, emoji:'🎽' },
];

async function main() {
    // 1) ¿Existe ya el usuario? (idempotencia)
    const { rows: existingUser } = await db.query(
        'SELECT id, business_id FROM users WHERE username = $1', [USERNAME]
    );

    let bizId;
    const trialEnds = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // +1 año, irrelevante porque is_paid

    if (existingUser.length) {
        bizId = existingUser[0].business_id;
        console.log(`• Usuario "${USERNAME}" ya existe (business_id=${bizId}), reutilizando.`);
    } else {
        // 2) Crear negocio Premium + pagado + sync activo + key
        const key = generateSyncKey();
        const { rows: [biz] } = await db.query(
            `INSERT INTO businesses
               (name, status, trial_ends_at, is_paid, plan, sync_api_key, sync_enabled)
             VALUES ($1, 'Active', $2, TRUE, 'premium', $3, TRUE)
             RETURNING id`,
            [BIZ_NAME, trialEnds, key]
        );
        bizId = biz.id;

        // 3) Crear usuario Business Admin
        const hash = await bcrypt.hash(PASSWORD, 10);
        await db.query(
            `INSERT INTO users
               (business_id, business_name, full_name, username, phone, password_hash, role, status)
             VALUES ($1, $2, $3, $4, $5, $6, 'Business Admin', 'Active')`,
            [bizId, BIZ_NAME, FULL_NAME, USERNAME, PHONE, hash]
        );
        console.log(`• Negocio "${BIZ_NAME}" creado (business_id=${bizId}) + admin "${USERNAME}".`);
    }

    // 4) Asegurar plan/pago/sync + key (por si el negocio ya existía sin ellos)
    let { rows: [b] } = await db.query('SELECT sync_api_key FROM businesses WHERE id = $1', [bizId]);
    let key = b.sync_api_key;
    if (!key) key = generateSyncKey();
    await db.query(
        `UPDATE businesses
            SET is_paid=TRUE, plan='premium', status='Active',
                sync_enabled=TRUE, sync_api_key=$2
          WHERE id=$1`,
        [bizId, key]
    );

    // 5) Upsert de productos por SKU dentro del negocio
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
    console.log('  TIENDA CONECTADA — datos para la storefront y el login');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  Negocio:     ${BIZ_NAME}  (business_id=${bizId})`);
    console.log(`  Login admin: ${USERNAME} / ${PASSWORD}`);
    console.log(`  Store Key:   ${key}`);
    console.log('═══════════════════════════════════════════════════════\n');

    await db.pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
