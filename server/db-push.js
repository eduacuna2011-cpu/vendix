// Run schema + seed super admin
// Usage: node server/db-push.js
require('dotenv').config();
const fs     = require('fs');
const path   = require('path');
const bcrypt = require('bcryptjs');
const db     = require('./db');

async function main() {
    console.log('Running schema...');
    const schema = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');
    await db.query(schema);
    console.log('Schema OK');

    const username = process.env.SEED_SUPERADMIN_USERNAME || 'superadmin';
    const password = process.env.SEED_SUPERADMIN_PASSWORD || 'superadmin123';

    const { rows } = await db.query('SELECT id FROM users WHERE username = $1', [username]);
    if (rows.length) {
        console.log(`Super admin "${username}" already exists — skipping seed`);
    } else {
        const hash = await bcrypt.hash(password, 10);
        await db.query(
            `INSERT INTO users (full_name, username, password_hash, role, status)
             VALUES ('Super Administrator', $1, $2, 'Super Admin', 'Active')`,
            [username, hash]
        );
        console.log(`Super admin "${username}" created`);
    }

    console.log('\nDone! Database is ready.\n');
    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
