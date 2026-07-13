// ═══════════════════════════════════════════════════════════════════════════════
// Tallas por producto (opcional).
//
// Un producto SIN tallas funciona como siempre: `size_mode` = NULL y su stock vive
// en products.stock. Cuando el admin ACTIVA tallas, hay dos modos:
//   'shared'   → un solo pote de stock (products.stock) para todas las tallas;
//                `sizes` guarda solo los nombres [{size}].
//   'per_size' → cada talla su propio stock; `sizes` = [{size,stock}] y
//                products.stock se mantiene como la SUMA (para stats/filtros/orden).
// ═══════════════════════════════════════════════════════════════════════════════

// Normaliza lo que llega del formulario a los campos que se guardan en products.
// Devuelve { sizes, sizeMode, stock } listos para el INSERT/UPDATE.
function computeSizeFields(body) {
    const mode = body.sizeMode === 'shared' || body.sizeMode === 'per_size' ? body.sizeMode : null;
    let sizes = Array.isArray(body.sizes) ? body.sizes : null;

    // Sin modo o sin tallas → producto de una sola talla (comportamiento clásico).
    if (!mode || !sizes || !sizes.length) {
        return { sizes: null, sizeMode: null, stock: parseInt(body.stock) || 0 };
    }

    sizes = sizes
        .map(s => ({ size: String(s && s.size != null ? s.size : '').trim(),
                     stock: Math.max(0, parseInt(s && s.stock) || 0) }))
        .filter(s => s.size);

    if (!sizes.length) {
        return { sizes: null, sizeMode: null, stock: parseInt(body.stock) || 0 };
    }

    if (mode === 'per_size') {
        const stock = sizes.reduce((a, s) => a + s.stock, 0);
        return { sizes, sizeMode: 'per_size', stock };
    }

    // shared: el pote es products.stock; en `sizes` solo guardamos nombres.
    const pool = Math.max(0, parseInt(body.stock) || 0);
    return { sizes: sizes.map(s => ({ size: s.size })), sizeMode: 'shared', stock: pool };
}

// Descuenta stock de un producto DENTRO de una transacción (usa FOR UPDATE para
// evitar sobreventa). Maneja los 3 casos. Devuelve { ok, product?, error?, missing? }.
// `size` es la talla elegida (requerida solo en modo per_size).
async function decrementStock(client, productId, qty, size) {
    const { rows: [p] } = await client.query(
        `SELECT id, name, stock, sizes, size_mode, cost_price, sale_price
         FROM products WHERE id = $1 FOR UPDATE`,
        [productId]
    );
    if (!p) return { ok: false, missing: true };
    const n = parseInt(qty) || 0;

    if (p.size_mode === 'per_size') {
        const arr = Array.isArray(p.sizes) ? p.sizes : [];
        const idx = arr.findIndex(s => String(s.size).toLowerCase() === String(size || '').toLowerCase());
        if (idx < 0) return { ok: false, error: `Falta elegir talla para "${p.name}"`, product: p };
        if ((arr[idx].stock || 0) < n)
            return { ok: false, error: `Stock insuficiente de talla ${arr[idx].size} en "${p.name}"`, product: p };
        arr[idx].stock -= n;
        const total = arr.reduce((a, s) => a + (parseInt(s.stock) || 0), 0);
        await client.query('UPDATE products SET sizes = $1, stock = $2 WHERE id = $3',
            [JSON.stringify(arr), total, p.id]);
        return { ok: true, product: p };
    }

    // shared o sin tallas: un solo pote (products.stock)
    if (p.stock < n) return { ok: false, error: `Stock insuficiente para "${p.name}"`, product: p };
    await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [n, p.id]);
    return { ok: true, product: p };
}

module.exports = { computeSizeFields, decrementStock };
