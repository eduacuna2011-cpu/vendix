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

function openModal(mode, product = null) {
    productModal.classList.add('show');
    if (mode === 'add') {
        modalTitle.textContent = 'Add New Product';
        productForm.reset();
        document.getElementById('productId').value = '';
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

addProductBtn.addEventListener('click', () => openModal('add'));
modalClose.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);
productModal.addEventListener('click', e => { if (e.target === productModal) closeModal(); });

productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('productId').value;
    const productData = {
        sku:       document.getElementById('sku').value,
        name:      document.getElementById('name').value,
        category:  document.getElementById('category').value,
        color:     document.getElementById('color').value,
        size:      document.getElementById('size').value,
        stock:     parseInt(document.getElementById('stock').value) || 0,
        costPrice: parseFloat(document.getElementById('costPrice').value) || 0,
        salePrice: parseFloat(document.getElementById('salePrice').value) || 0,
        image:     currentImageData
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
    if (stock === 0)  return '<span class="stock-badge out-of-stock">Out of Stock</span>';
    if (stock < 5)    return `<span class="stock-badge low-stock">${stock} (Low)</span>`;
    return `<span class="stock-badge in-stock">${stock}</span>`;
}

async function loadProducts() {
    try {
        const filters = {};
        if (searchInput    && searchInput.value)   filters.q        = searchInput.value;
        if (categoryFilter && categoryFilter.value !== 'all') filters.category = categoryFilter.value;
        if (colorFilter    && colorFilter.value    !== 'all') filters.color    = colorFilter.value;
        if (sizeFilter     && sizeFilter.value     !== 'all') filters.size     = sizeFilter.value;

        const products     = await getProducts(filters) || [];
        _productsCache     = products;
        const isUserSeller = isSeller() && !isBusinessAdmin() && !isSuperAdmin();

        if (products.length === 0) {
            productsTableBody.innerHTML = '';
            emptyState.classList.add('show');
            return;
        }
        emptyState.classList.remove('show');

        productsTableBody.innerHTML = products.map(p => `
            <tr>
                <td><strong>${escapeHtml(p.sku || '')}</strong></td>
                <td>
                    <div class="product-cell-with-image">
                        ${p.image ? `<img src="${p.image}" alt="${escapeHtml(p.name)}" class="product-thumbnail">` : ''}
                        <span>${escapeHtml(p.name)}</span>
                    </div>
                </td>
                <td>${escapeHtml(p.category || '—')}</td>
                <td>${escapeHtml(p.color || '—')}</td>
                <td>${escapeHtml(p.size || '—')}</td>
                <td>S/. ${parseFloat(p.cost_price || 0).toFixed(2)}</td>
                <td>S/. ${parseFloat(p.sale_price || 0).toFixed(2)}</td>
                <td>${getStockBadge(p.stock)}</td>
                <td>
                    ${isUserSeller ? '<span class="read-only">Read-only</span>' : `
                    <div class="action-buttons">
                        <button class="btn-icon edit" onclick="editProduct(${p.id})">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button class="btn-icon delete" onclick="deleteProductHandler(${p.id})">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </div>`}
                </td>
            </tr>`).join('');
    } catch (err) { console.error('loadProducts error:', err); }
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

searchInput.addEventListener('input',   debounce(loadProducts, 300));
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
