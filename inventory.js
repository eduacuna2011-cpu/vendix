// Inventory Page — async API version

const addProductBtn    = document.getElementById('addProductBtn');
const productModal     = document.getElementById('productModal');
const modalClose       = document.getElementById('modalClose');
const cancelBtn        = document.getElementById('cancelBtn');
const productForm      = document.getElementById('productForm');
const modalTitle       = document.getElementById('modalTitle');
const productsTableBody = document.getElementById('productsTableBody');
const emptyState       = document.getElementById('emptyState');
const searchInput      = document.getElementById('searchInput');
const categoryFilter   = document.getElementById('categoryFilter');
const colorFilter      = document.getElementById('colorFilter');
const sizeFilter       = document.getElementById('sizeFilter');
const productImageInput = document.getElementById('productImage');
const imagePreview     = document.getElementById('imagePreview');
const removeImageBtn   = document.getElementById('removeImageBtn');

const totalProductsEl  = document.getElementById('totalProducts');
const lowStockEl       = document.getElementById('lowStock');
const outOfStockEl     = document.getElementById('outOfStock');
const totalValueEl     = document.getElementById('totalValue');

let currentImageData = null;
let _productsCache  = []; // in-memory list for instant edit modal open

productImageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        currentImageData = ev.target.result;
        imagePreview.innerHTML = `<img src="${currentImageData}" alt="Product image">`;
        removeImageBtn.style.display = 'block';
    };
    reader.readAsDataURL(file);
});

removeImageBtn.addEventListener('click', () => {
    currentImageData = null;
    productImageInput.value = '';
    imagePreview.innerHTML = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span>No image selected</span>`;
    removeImageBtn.style.display = 'none';
});

// "Generar Código" — genera localmente, sin llamada al servidor (instantáneo)
function _localBarcode() {
    const user = getCurrentUser();
    const bizId = (user && user.businessId) ? user.businessId : 0;
    const prefix = String(bizId).padStart(4, '0');
    const rand   = Math.floor(Math.random() * 9999999).toString().padStart(7, '0');
    return `2${prefix}${rand}`;
}

// Directo (no DOMContentLoaded) para funcionar también en modo SPA
(function wireGenerateBarcode() {
    const genBtn = document.getElementById('generateBarcodeBtn');
    if (!genBtn) return;
    genBtn.addEventListener('click', () => {
        const field = document.getElementById('barcode');
        if (field.value.trim()) {
            showNotification('Ya hay un código. Bórralo primero para generar uno nuevo.', true);
            return;
        }
        field.value = _localBarcode();
        field.focus();
    });
})();

function openModal(mode, product = null) {
    productModal.classList.add('show');
    if (mode === 'add') {
        modalTitle.textContent = 'Add New Product';
        productForm.reset();
        document.getElementById('productId').value = '';
        resetSizesUI();
        currentImageData = null;
        imagePreview.innerHTML = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span>No image selected</span>`;
        removeImageBtn.style.display = 'none';
    } else if (mode === 'edit' && product) {
        modalTitle.textContent = 'Edit Product';
        document.getElementById('productId').value    = product.id;
        document.getElementById('sku').value          = product.sku || '';
        document.getElementById('name').value         = product.name || '';
        document.getElementById('category').value     = product.category || '';
        document.getElementById('color').value        = product.color || '';
        document.getElementById('size').value         = product.size || '';
        document.getElementById('stock').value        = product.stock ?? 0;
        document.getElementById('costPrice').value    = product.cost_price ?? 0;
        document.getElementById('salePrice').value    = product.sale_price ?? 0;
        document.getElementById('barcode').value      = product.barcode || '';
        populateSizesUI(product);
        if (product.image) {
            currentImageData = product.image;
            imagePreview.innerHTML = `<img src="${product.image}" alt="Product image">`;
            removeImageBtn.style.display = 'block';
        } else {
            currentImageData = null;
            imagePreview.innerHTML = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span>No image selected</span>`;
            removeImageBtn.style.display = 'none';
        }
    }
}

function closeModal() { productModal.classList.remove('show'); productForm.reset(); }

// ── Tallas por producto ───────────────────────────────────────────────────────
const hasSizesCb       = document.getElementById('hasSizes');
const singleSizeRow    = document.getElementById('singleSizeRow');
const sizesBlock       = document.getElementById('sizesBlock');
const sizeRowsEl       = document.getElementById('sizeRows');
const addSizeRowBtn    = document.getElementById('addSizeRow');
const sharedStockGroup = document.getElementById('sharedStockGroup');
const sizeModeHintEl   = document.getElementById('sizeModeHint');

function currentSizeMode() {
    const r = document.querySelector('input[name="sizeMode"]:checked');
    return r ? r.value : 'per_size';
}
function addSizeRow(size = '', stock = '') {
    const perSize = currentSizeMode() === 'per_size';
    const row = document.createElement('div');
    row.className = 'size-row';
    row.style.cssText = 'display:flex;gap:8px;align-items:center';
    const name = document.createElement('input');
    name.type = 'text'; name.className = 'sz-name'; name.placeholder = 'Talla (ej. M)';
    name.setAttribute('list', 'sizeList'); name.style.flex = '1'; name.value = size;
    const st = document.createElement('input');
    st.type = 'number'; st.className = 'sz-stock'; st.min = '0'; st.placeholder = 'Stock';
    st.style.width = '90px'; st.value = stock === '' ? '' : stock;
    st.style.display = perSize ? '' : 'none';
    const del = document.createElement('button');
    del.type = 'button'; del.className = 'sz-del'; del.textContent = '✕';
    del.style.cssText = 'width:34px;height:34px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text-3);cursor:pointer;flex-shrink:0';
    del.addEventListener('click', () => row.remove());
    row.append(name, st, del);
    sizeRowsEl.appendChild(row);
}
function updateSizeModeUI() {
    const perSize = currentSizeMode() === 'per_size';
    sharedStockGroup.style.display = perSize ? 'none' : 'block';
    sizeModeHintEl.textContent = perSize
        ? 'Cada talla tiene su propio stock (ej. XS: 5, S: 10).'
        : 'Un solo pote de stock para todas las tallas (ej. 20 de cualquier talla).';
    sizeRowsEl.querySelectorAll('.sz-stock').forEach(i => i.style.display = perSize ? '' : 'none');
}
function updateHasSizesUI() {
    const on = hasSizesCb.checked;
    sizesBlock.style.display = on ? 'block' : 'none';
    singleSizeRow.style.display = on ? 'none' : 'flex';
    document.getElementById('size').required  = !on;
    document.getElementById('stock').required = !on;
    if (on && !sizeRowsEl.children.length) addSizeRow('', '');
}
function resetSizesUI() {
    hasSizesCb.checked = false;
    sizeRowsEl.innerHTML = '';
    const perSizeRadio = document.querySelector('input[name="sizeMode"][value="per_size"]');
    if (perSizeRadio) perSizeRadio.checked = true;
    document.getElementById('sharedStock').value = '';
    updateSizeModeUI(); updateHasSizesUI();
}
function populateSizesUI(product) {
    resetSizesUI();
    if (product && product.size_mode && Array.isArray(product.sizes) && product.sizes.length) {
        hasSizesCb.checked = true;
        const radio = document.querySelector(`input[name="sizeMode"][value="${product.size_mode}"]`);
        if (radio) radio.checked = true;
        if (product.size_mode === 'shared') document.getElementById('sharedStock').value = product.stock ?? 0;
        sizeRowsEl.innerHTML = '';
        product.sizes.forEach(s => addSizeRow(s.size || '', s.stock ?? ''));
        updateSizeModeUI(); updateHasSizesUI();
    }
}
function collectSizes() {
    if (!hasSizesCb.checked) return { sizeMode: null, sizes: null };
    const rows = [...sizeRowsEl.querySelectorAll('.size-row')].map(r => ({
        size: (r.querySelector('.sz-name').value || '').trim(),
        stock: parseInt(r.querySelector('.sz-stock').value) || 0
    })).filter(s => s.size);
    return { sizeMode: currentSizeMode(), sizes: rows };
}
if (hasSizesCb) {
    hasSizesCb.addEventListener('change', updateHasSizesUI);
    document.querySelectorAll('input[name="sizeMode"]').forEach(r => r.addEventListener('change', updateSizeModeUI));
    addSizeRowBtn.addEventListener('click', () => addSizeRow('', ''));
}

addProductBtn.addEventListener('click', () => openModal('add'));
modalClose.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);
productModal.addEventListener('click', e => { if (e.target === productModal) closeModal(); });

productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('productId').value;
    const sd = collectSizes();
    // Validación en modo tallas
    if (sd.sizeMode) {
        if (!sd.sizes.length) { showNotification('Agrega al menos una talla.', true); return; }
        if (sd.sizeMode === 'shared' && !(parseInt(document.getElementById('sharedStock').value) >= 0)) {
            showNotification('Ingresa el stock total (compartido).', true); return;
        }
    }
    const productData = {
        sku:       document.getElementById('sku').value,
        name:      document.getElementById('name').value,
        category:  document.getElementById('category').value,
        color:     document.getElementById('color').value,
        size:      sd.sizeMode ? null : document.getElementById('size').value,
        stock:     sd.sizeMode === 'shared'
                     ? (parseInt(document.getElementById('sharedStock').value) || 0)
                     : (parseInt(document.getElementById('stock').value) || 0),
        sizeMode:  sd.sizeMode,   // null = una sola talla (clásico)
        sizes:     sd.sizes,      // null o [{size,stock}]
        costPrice: parseFloat(document.getElementById('costPrice').value) || 0,
        salePrice: parseFloat(document.getElementById('salePrice').value) || 0,
        image:     currentImageData,
        barcode:   document.getElementById('barcode').value.trim() || null
    };
    const submitBtn = e.target.querySelector('[type=submit]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Guardando…'; }
    try {
        if (id) {
            await updateProduct(parseInt(id), productData);
        } else {
            await addProduct(productData);
        }
        closeModal();
        await Promise.all([loadProducts(), updateStats()]);
    } catch (err) {
        showNotification('Error: ' + err.message, true);
    } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = id ? 'Actualizar' : 'Agregar producto'; }
    }
});

function getStockBadge(stock) {
    if (stock === 0)  return '<span class="stock-badge out-of-stock">Sin stock</span>';
    if (stock < 5)    return `<span class="stock-badge low-stock">${stock} (Bajo)</span>`;
    return `<span class="stock-badge in-stock">${stock}</span>`;
}

// Etiqueta de tallas para la tabla. Producto con tallas → nombres (con desglose de
// stock en el tooltip si es por talla); producto clásico → su única talla.
function sizesLabel(p) {
    if (p.size_mode && Array.isArray(p.sizes) && p.sizes.length) {
        const names = p.sizes.map(s => escapeHtml(s.size)).join(' · ');
        const title = p.size_mode === 'per_size'
            ? p.sizes.map(s => `${s.size}: ${s.stock ?? 0}`).join(', ')
            : 'Stock compartido';
        return `<span title="${escapeHtml(title)}" style="cursor:help">${names}</span>`;
    }
    return escapeHtml(p.size || '—');
}

let _invLoaded = false, _invLimit = 50, _invLoadingMore = false, _invScrollWired = false;

function _invRowHtml(p, isUserSeller) {
    return `
            <tr>
                <td><strong>${escapeHtml(p.sku || '')}</strong></td>
                <td>
                    <div class="product-cell-with-image">
                        ${p.has_image ? lazyThumb(p.id, 'product-thumbnail', p.name) : ''}
                        <span>${escapeHtml(p.name)}</span>
                    </div>
                </td>
                <td>${escapeHtml(p.category || '—')}</td>
                <td>${escapeHtml(p.color || '—')}</td>
                <td>${sizesLabel(p)}</td>
                <td>
                    ${p.barcode
                        ? `<span style="font-family:monospace;font-size:12px;color:var(--text-2)">${escapeHtml(p.barcode)}</span>`
                        : '<span style="color:var(--text-3);font-size:12px;">—</span>'}
                </td>
                <td>S/. ${parseFloat(p.cost_price || 0).toFixed(2)}</td>
                <td>S/. ${parseFloat(p.sale_price || 0).toFixed(2)}</td>
                <td>${getStockBadge(p.stock)}</td>
                <td>
                    ${isUserSeller ? '<span class="read-only">Solo lectura</span>' : `
                    <div class="action-buttons">
                        <button class="btn-icon edit" onclick="editProduct(${p.id})">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button class="btn-icon delete" onclick="deleteProductHandler(${p.id})">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </div>`}
                </td>
            </tr>`;
}

// Carga la primera ventana de productos (reinicia la paginación por lotes).
async function loadProducts() {
    _invLimit = 50;
    return _renderInventory();
}

// Crece la ventana en otro lote (scroll infinito).
async function loadMoreInv() {
    if (_invLoadingMore) return;
    _invLimit += 50;
    return _renderInventory();
}

async function _renderInventory() {
    try {
        _invLoadingMore = true;
        if (!_invLoaded && productsTableBody) productsTableBody.innerHTML = skeletonRows(10, 6);
        const filters = { limit: _invLimit };
        if (searchInput    && searchInput.value)   filters.q        = searchInput.value;
        if (categoryFilter && categoryFilter.value !== 'all') filters.category = categoryFilter.value;
        if (colorFilter    && colorFilter.value    !== 'all') filters.color    = colorFilter.value;
        if (sizeFilter     && sizeFilter.value     !== 'all') filters.size     = sizeFilter.value;

        const products     = await getProducts(filters) || [];
        _productsCache     = products;
        _invLoaded         = true;
        const isUserSeller = isSeller() && !isBusinessAdmin() && !isSuperAdmin();

        if (products.length === 0) {
            productsTableBody.innerHTML = '';
            emptyState.classList.add('show');
            return;
        }
        emptyState.classList.remove('show');
        productsTableBody.innerHTML = products.map(p => _invRowHtml(p, isUserSeller)).join('');
        observeLazyImages(productsTableBody);
        _wireInvScroll();
    } catch (err) { console.error('loadProducts error:', err); }
    finally { _invLoadingMore = false; }
}

// Scroll infinito: pide el siguiente lote cuando te acercas al final de la lista.
function _wireInvScroll() {
    if (_invScrollWired) return;
    _invScrollWired = true;
    const onScroll = () => {
        if (_invLoadingMore) return;
        // Solo pide más si la última ventana vino llena (probablemente hay más).
        if (!_productsCache || _productsCache.length < _invLimit) return;
        const rect = productsTableBody.getBoundingClientRect();
        const vh = window.innerHeight || document.documentElement.clientHeight;
        if (rect.bottom < vh + 400) loadMoreInv();
    };
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
}

window.editProduct = function(id) {
    // Use cached list — instant open, no API call needed
    const p = _productsCache.find(x => x.id === id);
    if (p) openModal('edit', p);
};

window.deleteProductHandler = async function(id) {
    const product = _productsCache.find(p => p.id === id);
    const name = product ? `"${product.name}"` : 'este producto';
    if (!confirm(`¿Eliminar ${name}? Esta acción no se puede deshacer.`)) return;
    const row = document.querySelector(`button[onclick="deleteProductHandler(${id})"]`)?.closest('tr');
    if (row) row.remove();
    try {
        await deleteProduct(id);
        await Promise.all([loadProducts(), updateStats()]);
    } catch (err) {
        await Promise.all([loadProducts(), updateStats()]);
        showNotification('Error: ' + err.message, true);
    }
};

async function updateStats() {
    try {
        const stats = await getProductStats();
        if (totalProductsEl) totalProductsEl.textContent = stats.totalProducts || 0;
        if (lowStockEl)      lowStockEl.textContent      = stats.lowStock      || 0;
        if (outOfStockEl)    outOfStockEl.textContent    = stats.outOfStock    || 0;
        if (totalValueEl)    totalValueEl.textContent    = 'S/. ' + (stats.totalValue || 0).toFixed(2);
    } catch (err) { console.error('Stats error:', err); }
}

async function populateFilters() {
    try {
        const f = await getProductFilters();
        categoryFilter.innerHTML = '<option value="all">All Categories</option>' + (f.categories || []).map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
        colorFilter.innerHTML    = '<option value="all">All Colors</option>'     + (f.colors     || []).map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
        sizeFilter.innerHTML     = '<option value="all">All Sizes</option>'      + (f.sizes      || []).map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
    } catch (err) { console.error('Filters error:', err); }
}

function debounce(fn, ms) { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }; }

// ─── Barcode scanner detection (same timing logic as sales.js) ────────────────
let _invBcLastKey   = 0;
let _invBcFastCount = 0;
let _invBcDebounce  = null;

searchInput.addEventListener('keydown', async function(e) {
    const now = Date.now();
    const gap = now - _invBcLastKey;
    _invBcLastKey = now;

    if (e.key !== 'Enter') {
        if (gap > 100) _invBcFastCount = 0;
        if (gap < 50)  _invBcFastCount++;
        return;
    }

    e.preventDefault();
    clearTimeout(_invBcDebounce);
    const code = this.value.trim();
    if (!code) return;

    const isScanner = _invBcFastCount >= 3;
    _invBcFastCount = 0;

    if (isScanner) {
        this.value = '';
        try {
            const product = await getProductByBarcode(code);
            // Load/refresh list then open edit modal
            await loadProducts();
            const found = _productsCache.find(p => p.id === product.id);
            if (found) {
                // Highlight the row briefly
                const row = productsTableBody.querySelector(`button[onclick="editProduct(${product.id})"]`)?.closest('tr');
                if (row) {
                    row.style.transition = 'background 0.3s';
                    row.style.background = 'rgba(0,212,106,0.12)';
                    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(() => { row.style.background = ''; }, 1500);
                }
                openModal('edit', found);
                showNotification(`Producto encontrado: ${product.name}`);
            }
        } catch {
            showNotification(`No se encontró ningún producto con código "${code}"`, true);
        }
        return;
    }

    loadProducts();
});

searchInput.addEventListener('focus', () => { _invBcFastCount = 0; _invBcLastKey = 0; });

// Wrap debounce to allow keydown cancel
searchInput.addEventListener('input', function() {
    clearTimeout(_invBcDebounce);
    _invBcDebounce = setTimeout(() => loadProducts(), 300);
});

categoryFilter.addEventListener('change', loadProducts);
colorFilter.addEventListener('change',    loadProducts);
sizeFilter.addEventListener('change',     loadProducts);

const _invUser = initPage({ requireStore: true });
if (_invUser) {
    if (isSeller() && !isBusinessAdmin() && !isSuperAdmin()) {
        if (addProductBtn) addProductBtn.style.display = 'none';
    }
    Promise.all([populateFilters(), loadProducts(), updateStats()]);
}
