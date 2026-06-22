// ── Labels Page ───────────────────────────────────────────────────────────────

let _labelsProducts = [];  // all products with barcodes
let _filtered       = [];  // after search filter
let _selected       = new Set();
const _qtyMap       = {};  // id → qty, persists across re-renders

// DOM refs
const labelsTableBody   = document.getElementById('labelsTableBody');
const emptyLabels       = document.getElementById('emptyLabels');
const checkAll          = document.getElementById('checkAll');
const selectAllBtn      = document.getElementById('selectAllBtn');
const clearSelBtn       = document.getElementById('clearSelBtn');
const previewBtn        = document.getElementById('previewBtn');
const bottomBar         = document.getElementById('bottomBar');
const selCountText      = document.getElementById('selCountText');
const selLabelText      = document.getElementById('selLabelText');
const labelsSearch      = document.getElementById('labelsSearch');
const stepSelection     = document.getElementById('stepSelection');
const stepPreview       = document.getElementById('stepPreview');
const step1Indicator    = document.getElementById('step1Indicator');
const step2Indicator    = document.getElementById('step2Indicator');
const labelsPreviewGrid = document.getElementById('labelsPreviewGrid');
const previewCountText  = document.getElementById('previewCountText');
const backBtn           = document.getElementById('backBtn');
const printBtn          = document.getElementById('printBtn');
const pdfBtn            = document.getElementById('pdfBtn');
const showPrice         = document.getElementById('showPrice');
const showSku           = document.getElementById('showSku');
const printArea         = document.getElementById('printArea');
const notifContainer    = document.getElementById('notificationContainer');

function showNotification(msg, isError = false) {
    const el = document.createElement('div');
    el.style.cssText = [
        'position:relative', 'pointer-events:auto',
        'background:' + (isError ? 'var(--danger)' : 'var(--primary)'),
        'color:' + (isError ? '#fff' : '#03120a'),
        'padding:12px 18px', 'border-radius:10px',
        'font-size:13px', 'font-weight:600',
        'box-shadow:var(--shadow-md)',
        'animation:slideUp .2s ease',
        'max-width:320px'
    ].join(';');
    el.textContent = msg;
    notifContainer.appendChild(el);
    setTimeout(() => el.remove(), 3200);
}

// ── helpers ──────────────────────────────────────────────────────────────────
function escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function getLabelSize() {
    return document.querySelector('input[name="labelSize"]:checked')?.value || 'md';
}

function getTotalLabels() {
    let n = 0;
    _selected.forEach(id => { n += _qtyMap[id] || 1; });
    return n;
}

function updateBottomBar() {
    const count = _selected.size;
    const total = getTotalLabels();
    if (count === 0) {
        bottomBar.style.display = 'none';
        clearSelBtn.style.display = 'none';
    } else {
        bottomBar.style.display = 'flex';
        clearSelBtn.style.display = '';
        selCountText.textContent = `${count} producto${count !== 1 ? 's' : ''} seleccionado${count !== 1 ? 's' : ''}`;
        selLabelText.textContent = `${total} etiqueta${total !== 1 ? 's' : ''}`;
    }
}

function syncCheckAll() {
    const visibleIds = _filtered.map(p => p.id);
    const selVisible = visibleIds.filter(id => _selected.has(id)).length;
    checkAll.indeterminate = selVisible > 0 && selVisible < visibleIds.length;
    checkAll.checked       = selVisible > 0 && selVisible === visibleIds.length;
}

// ── Load ─────────────────────────────────────────────────────────────────────
async function loadLabelProducts() {
    try {
        const all = await getProducts();
        _labelsProducts = (all || []).filter(p => p.barcode && p.barcode.trim());

        if (_labelsProducts.length === 0) {
            labelsTableBody.innerHTML = '';
            emptyLabels.style.display = 'flex';
            return;
        }

        emptyLabels.style.display = 'none';
        _filtered = [..._labelsProducts];
        renderTable();
    } catch (err) {
        labelsTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--danger)">Error: ${err.message}</td></tr>`;
    }
}

// ── Table render ─────────────────────────────────────────────────────────────
function renderTable() {
    if (_filtered.length === 0) {
        labelsTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-3);font-size:13px">Sin resultados para esa búsqueda</td></tr>`;
        syncCheckAll();
        return;
    }

    labelsTableBody.innerHTML = _filtered.map(p => `
        <tr data-id="${p.id}" class="${_selected.has(p.id) ? 'selected-row' : ''}">
            <td><input type="checkbox" class="lbl-check row-check" data-id="${p.id}" ${_selected.has(p.id) ? 'checked' : ''}></td>
            <td>
                <div class="product-thumb-cell">
                    ${p.image
                        ? `<img src="${p.image}" alt="" class="product-thumb">`
                        : `<div class="product-thumb-placeholder"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>`
                    }
                    <div>
                        <div class="product-cell-name">${escapeHtml(p.name)}</div>
                        ${p.category ? `<div class="product-cell-cat">${escapeHtml(p.category)}</div>` : ''}
                    </div>
                </div>
            </td>
            <td><span style="font-size:12px;color:var(--text-2);font-family:monospace">${escapeHtml(p.sku || '—')}</span></td>
            <td><span class="bc-mono">${escapeHtml(p.barcode)}</span></td>
            <td><span class="lbl-price">S/. ${parseFloat(p.sale_price || 0).toFixed(2)}</span></td>
            <td>
                <div class="qty-stepper">
                    <button type="button" class="qty-dec" data-id="${p.id}">−</button>
                    <input type="number" class="qty-input" data-id="${p.id}" value="${_qtyMap[p.id] || 1}" min="1" max="999">
                    <button type="button" class="qty-inc" data-id="${p.id}">+</button>
                </div>
            </td>
        </tr>
    `).join('');

    // checkbox events
    labelsTableBody.querySelectorAll('.row-check').forEach(cb => {
        cb.addEventListener('change', () => {
            const id = parseInt(cb.dataset.id);
            if (cb.checked) _selected.add(id); else _selected.delete(id);
            cb.closest('tr').classList.toggle('selected-row', cb.checked);
            syncCheckAll();
            updateBottomBar();
        });
    });

    // qty input events — persist and update bottom bar
    labelsTableBody.querySelectorAll('.qty-input').forEach(input => {
        input.addEventListener('input', () => {
            const id = parseInt(input.dataset.id);
            _qtyMap[id] = Math.max(1, parseInt(input.value) || 1);
            input.value = _qtyMap[id];
            if (_selected.has(id)) updateBottomBar();
        });
    });

    // ± buttons
    labelsTableBody.querySelectorAll('.qty-dec').forEach(btn => {
        btn.addEventListener('click', () => {
            const id  = parseInt(btn.dataset.id);
            const cur = _qtyMap[id] || 1;
            const val = Math.max(1, cur - 1);
            _qtyMap[id] = val;
            const inp = labelsTableBody.querySelector(`.qty-input[data-id="${id}"]`);
            if (inp) inp.value = val;
            if (_selected.has(id)) updateBottomBar();
        });
    });

    labelsTableBody.querySelectorAll('.qty-inc').forEach(btn => {
        btn.addEventListener('click', () => {
            const id  = parseInt(btn.dataset.id);
            const cur = _qtyMap[id] || 1;
            const val = Math.min(999, cur + 1);
            _qtyMap[id] = val;
            const inp = labelsTableBody.querySelector(`.qty-input[data-id="${id}"]`);
            if (inp) inp.value = val;
            if (_selected.has(id)) updateBottomBar();
        });
    });

    syncCheckAll();
    updateBottomBar();
}

// ── Search ────────────────────────────────────────────────────────────────────
labelsSearch.addEventListener('input', () => {
    const q = labelsSearch.value.trim().toLowerCase();
    _filtered = q
        ? _labelsProducts.filter(p =>
            p.name.toLowerCase().includes(q) ||
            (p.sku  && p.sku.toLowerCase().includes(q)) ||
            (p.barcode && p.barcode.includes(q))
          )
        : [..._labelsProducts];
    renderTable();
});

// ── Checkbox header ───────────────────────────────────────────────────────────
checkAll.addEventListener('change', () => {
    _filtered.forEach(p => {
        if (checkAll.checked) _selected.add(p.id); else _selected.delete(p.id);
    });
    renderTable();
});

selectAllBtn.addEventListener('click', () => {
    _labelsProducts.forEach(p => _selected.add(p.id));
    _filtered = [..._labelsProducts];
    labelsSearch.value = '';
    renderTable();
});

clearSelBtn.addEventListener('click', () => {
    _selected.clear();
    renderTable();
});

// ── Step navigation ───────────────────────────────────────────────────────────
previewBtn.addEventListener('click', () => {
    if (_selected.size === 0) return;
    stepSelection.style.display = 'none';
    stepPreview.style.display   = '';
    step1Indicator.classList.remove('active');
    step1Indicator.classList.add('done');
    step2Indicator.classList.add('active');
    renderPreview();
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

backBtn.addEventListener('click', () => {
    stepPreview.style.display   = 'none';
    stepSelection.style.display = '';
    step2Indicator.classList.remove('active');
    step1Indicator.classList.remove('done');
    step1Indicator.classList.add('active');
});

// ── Asegurar JsBarcode (en modo SPA el <head> no carga el CDN) ────────────────
let _jsBarcodePromise = null;
function ensureJsBarcode() {
    if (typeof JsBarcode !== 'undefined') return Promise.resolve();
    if (_jsBarcodePromise) return _jsBarcodePromise;
    _jsBarcodePromise = new Promise((resolve) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js';
        s.onload = resolve;
        s.onerror = resolve;
        document.head.appendChild(s);
    });
    return _jsBarcodePromise;
}

// ── Barcode SVG builder ───────────────────────────────────────────────────────
function makeBarcodeEl(code, size) {
    const heights = { sm: 28, md: 42, lg: 58 };
    const widths  = { sm: 1.1, md: 1.6, lg: 2.1 };
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    try {
        JsBarcode(svg, code, {
            format: 'CODE128',
            displayValue: false,
            width: widths[size] || 1.6,
            height: heights[size] || 42,
            margin: 0,
            background: '#ffffff',
            lineColor: '#000000'
        });
    } catch {
        svg.innerHTML = `<text y="18" font-size="9" fill="red">Código inválido</text>`;
    }
    return svg;
}

// ── Preview render — 1 card per product + qty badge ──────────────────────────
async function renderPreview() {
    await ensureJsBarcode();
    const size    = getLabelSize();
    const withPx  = showPrice.checked;
    const withSku = showSku.checked;

    const items = _labelsProducts.filter(p => _selected.has(p.id));
    let totalCount = 0;

    labelsPreviewGrid.innerHTML = '';

    items.forEach(p => {
        const qty = _qtyMap[p.id] || 1;
        totalCount += qty;

        const wrap = document.createElement('div');
        wrap.className = 'label-card-wrap';

        const card = document.createElement('div');
        card.className = `label-card size-${size}`;

        card.appendChild(makeBarcodeEl(p.barcode, size));

        const name = document.createElement('div');
        name.className = 'label-name';
        name.textContent = p.name;
        card.appendChild(name);

        const code = document.createElement('div');
        code.className = 'label-code';
        code.textContent = p.barcode;
        card.appendChild(code);

        if (withSku && p.sku) {
            const el = document.createElement('div');
            el.className = 'label-sku';
            el.textContent = `SKU: ${p.sku}`;
            card.appendChild(el);
        }

        if (withPx) {
            const el = document.createElement('div');
            el.className = 'label-price';
            el.textContent = `S/. ${parseFloat(p.sale_price || 0).toFixed(2)}`;
            card.appendChild(el);
        }

        if (qty > 1) {
            const badge = document.createElement('div');
            badge.className = 'lbl-qty-badge';
            badge.textContent = `×${qty}`;
            wrap.appendChild(badge);
        }

        wrap.appendChild(card);
        labelsPreviewGrid.appendChild(wrap);
    });

    const pText = `${items.length} producto${items.length !== 1 ? 's' : ''} · ${totalCount} etiqueta${totalCount !== 1 ? 's' : ''} en total`;
    previewCountText.textContent = pText;
}

// Re-render on option changes
document.querySelectorAll('input[name="labelSize"]').forEach(r => r.addEventListener('change', renderPreview));
showPrice.addEventListener('change', renderPreview);
showSku.addEventListener('change', renderPreview);

// ── Print area builder ────────────────────────────────────────────────────────
async function buildPrintArea() {
    await ensureJsBarcode();
    const size    = getLabelSize();
    const withPx  = showPrice.checked;
    const withSku = showSku.checked;
    const items   = _labelsProducts.filter(p => _selected.has(p.id));

    const grid = document.createElement('div');
    grid.className = 'print-labels-grid';

    items.forEach(p => {
        const qty = _qtyMap[p.id] || 1;
        for (let i = 0; i < qty; i++) {
            const lbl = document.createElement('div');
            lbl.className = `print-label size-${size}`;

            lbl.appendChild(makeBarcodeEl(p.barcode, size));

            const name = document.createElement('div');
            name.className = 'label-name';
            name.textContent = p.name;
            lbl.appendChild(name);

            const code = document.createElement('div');
            code.className = 'label-code';
            code.textContent = p.barcode;
            lbl.appendChild(code);

            if (withSku && p.sku) {
                const el = document.createElement('div');
                el.className = 'label-sku';
                el.textContent = `SKU: ${p.sku}`;
                lbl.appendChild(el);
            }
            if (withPx) {
                const el = document.createElement('div');
                el.className = 'label-price';
                el.textContent = `S/. ${parseFloat(p.sale_price || 0).toFixed(2)}`;
                lbl.appendChild(el);
            }

            grid.appendChild(lbl);
        }
    });

    printArea.innerHTML = '';
    printArea.appendChild(grid);
}

// ── Print / PDF ───────────────────────────────────────────────────────────────
printBtn.addEventListener('click', async () => {
    await buildPrintArea();
    window.print();
});

pdfBtn.addEventListener('click', async () => {
    await buildPrintArea();
    showNotification('En el diálogo de impresión elige "Guardar como PDF"');
    setTimeout(() => window.print(), 280);
});

// ── Init ──────────────────────────────────────────────────────────────────────
ensureJsBarcode();  // precargar el lib temprano (modo SPA)
const _labelsUser = initPage({ requireStore: true });
if (_labelsUser) {
    loadLabelProducts();
}
