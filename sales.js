// DOM refs
const productSearch      = document.getElementById('productSearch');
const productsGrid       = document.getElementById('productsGrid');
const productsEmptyState = document.getElementById('productsEmptyState');
const cartItems          = document.getElementById('cartItems');
const cartEmptyState     = document.getElementById('cartEmptyState');
const cartSummary        = document.getElementById('cartSummary');
const subtotalEl         = document.getElementById('subtotal');
const taxEl              = document.getElementById('tax');
const totalEl            = document.getElementById('total');
const completeSaleBtn    = document.getElementById('completeSaleBtn');
const clearCartBtn       = document.getElementById('clearCartBtn');
const recentSalesBody    = document.getElementById('recentSalesBody');

let cart        = [];
let allProducts = [];
let _taxSettings = { igv_enabled: false, igv_rate: 18 };

async function loadTaxSettings() {
    try { _taxSettings = await getTaxSettings(); } catch {}
}

function getTaxRate() {
    return _taxSettings.igv_enabled ? (_taxSettings.igv_rate / 100) : 0;
}

// ─── Receipts store (localStorage map by transaction ID) ──────────────────────
function _saveReceipt(receipt) {
    try {
        const map = JSON.parse(localStorage.getItem('receiptsMap') || '{}');
        map[receipt.transactionId] = receipt;
        const keys = Object.keys(map);
        if (keys.length > 100) delete map[keys[0]];
        localStorage.setItem('receiptsMap', JSON.stringify(map));
    } catch {}
}

function _getReceipt(id) {
    try {
        const map = JSON.parse(localStorage.getItem('receiptsMap') || '{}');
        return map[id] || null;
    } catch { return null; }
}

// ─── Products ─────────────────────────────────────────────────────────────────
async function loadProducts(searchQuery = '') {
    try {
        const filters = {};
        if (searchQuery) filters.q = searchQuery;
        const products = await getProducts(filters) || [];
        allProducts = products;

        if (!products.length) {
            productsGrid.innerHTML = '';
            productsEmptyState.classList.add('show');
            return;
        }

        productsEmptyState.classList.remove('show');
        productsGrid.innerHTML = products.map(p => `
            <div class="product-card ${p.stock === 0 ? 'out-of-stock' : ''}" onclick="${p.stock > 0 ? `addToCart(${p.id})` : ''}">
                <div class="product-image">
                    ${p.image
                        ? `<img src="${p.image}" alt="${escapeHtml(p.name)}">`
                        : `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                               <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                               <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                               <line x1="12" y1="22.08" x2="12" y2="12"/>
                           </svg>`}
                </div>
                <div class="product-info">
                    <h3>${escapeHtml(p.name)}</h3>
                    <div class="product-sku">${escapeHtml(p.sku || '')}</div>
                    <div class="product-price">S/. ${parseFloat(p.sale_price || 0).toFixed(2)}</div>
                    <div class="product-stock ${p.stock === 0 ? 'out' : p.stock < 5 ? 'low' : ''}">
                        ${p.stock === 0 ? 'Out of Stock' : p.stock < 5 ? `Low: ${p.stock}` : `Stock: ${p.stock}`}
                    </div>
                </div>
            </div>`).join('');
    } catch (err) {
        console.error('loadProducts error:', err);
    }
}

// ─── Cart ─────────────────────────────────────────────────────────────────────
window.addToCart = function(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product || product.stock === 0) return;

    const existing = cart.find(i => i.id === productId);
    if (existing) {
        if (existing.quantity < product.stock) existing.quantity++;
        else { showNotification('Stock insuficiente', true); return; }
    } else {
        cart.push({
            id:        product.id,
            sku:       product.sku || '',
            name:      product.name,
            price:     parseFloat(product.sale_price || 0),
            costPrice: parseFloat(product.cost_price || 0),
            quantity:  1,
            maxStock:  product.stock
        });
    }
    renderCart();
};

window.updateQuantity = function(productId, change) {
    const item = cart.find(i => i.id === productId);
    if (!item) return;
    const newQty = item.quantity + change;
    if (newQty <= 0)              { removeFromCart(productId); return; }
    if (newQty > item.maxStock)   { showNotification('Stock insuficiente', true); return; }
    item.quantity = newQty;
    renderCart();
};

window.removeFromCart = function(productId) {
    cart = cart.filter(i => i.id !== productId);
    renderCart();
};

function renderCart() {
    if (!cart.length) {
        cartItems.innerHTML = '';
        cartEmptyState.classList.add('show');
        cartSummary.style.display = 'none';
        return;
    }
    cartEmptyState.classList.remove('show');
    cartSummary.style.display = 'block';

    cartItems.innerHTML = cart.map(item => `
        <div class="cart-item">
            <div class="cart-item-info">
                <h4>${escapeHtml(item.name)}</h4>
                <div class="cart-item-sku">${escapeHtml(item.sku)}</div>
                <div class="cart-item-price">S/. ${item.price.toFixed(2)}</div>
            </div>
            <div class="cart-item-quantity">
                <button class="quantity-btn" onclick="updateQuantity(${item.id}, -1)">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
                <span class="quantity-value">${item.quantity}</span>
                <button class="quantity-btn" onclick="updateQuantity(${item.id}, 1)" ${item.quantity >= item.maxStock ? 'disabled' : ''}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
            </div>
            <button class="cart-item-remove" onclick="removeFromCart(${item.id})">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </div>`).join('');

    const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    const tax      = subtotal * getTaxRate();
    subtotalEl.textContent = `S/. ${subtotal.toFixed(2)}`;
    taxEl.textContent      = `S/. ${tax.toFixed(2)}`;
    totalEl.textContent    = `S/. ${(subtotal + tax).toFixed(2)}`;
}

// ─── Clear cart ───────────────────────────────────────────────────────────────
clearCartBtn.addEventListener('click', () => {
    if (!cart.length) return;
    if (confirm('Clear the cart?')) { cart = []; renderCart(); }
});

// ─── Payment method ───────────────────────────────────────────────────────────
document.querySelectorAll('.payment-method-option').forEach(opt => {
    opt.addEventListener('click', () => {
        document.querySelectorAll('.payment-method-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        opt.querySelector('input[type="radio"]').checked = true;
    });
});

// ─── Complete Sale ────────────────────────────────────────────────────────────
completeSaleBtn.addEventListener('click', () => {
    if (!cart.length) { showNotification('El carrito está vacío', true); return; }
    const pm = document.querySelector('input[name="paymentMethod"]:checked');
    if (!pm) { showNotification('Selecciona un método de pago', true); return; }
    completeSale(pm.value);
});

async function completeSale(paymentMethod) {
    completeSaleBtn.disabled = true;
    completeSaleBtn.textContent = 'Processing…';
    try {
        const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
        const tax      = subtotal * getTaxRate();
        const total    = subtotal + tax;

        const savedTx = await addTransaction({
            paymentMethod,
            items: cart.map(item => ({
                productId: item.id,
                quantity:  item.quantity,
                unitPrice: item.price
            }))
        });

        const receipt = {
            receiptNumber: String(savedTx.id).padStart(6, '0'),
            transactionId: savedTx.id,
            date:          new Date().toISOString(),
            seller:        getCurrentUser()?.fullName || 'Unknown',
            paymentMethod,
            items:         cart.map(i => ({ name: i.name, sku: i.sku, price: i.price, quantity: i.quantity })),
            subtotal,
            taxRate:       getTaxRate(),
            tax,
            total
        };

        _saveReceipt(receipt);
        localStorage.setItem('lastReceipt', JSON.stringify(receipt));

        cart = [];
        renderCart();

        Promise.all([loadProducts(productSearch?.value || ''), loadRecentSales()]);
        showSaleCompletedModal();
    } catch (err) {
        showNotification('Error al procesar la venta: ' + err.message, true);
    } finally {
        completeSaleBtn.disabled = false;
        completeSaleBtn.textContent = 'Complete Sale';
    }
}

// ─── Receipt rendering ────────────────────────────────────────────────────────
function renderReceipt(receipt) {
    const date = new Date(receipt.date);
    const formattedDate = date.toLocaleString('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    document.getElementById('receiptContent').innerHTML = `
        <div class="receipt-header">
            <h3>RECEIPT</h3>
            <div class="business-name">Inventory Sales System</div>
            <div class="receipt-number">Receipt #${receipt.receiptNumber}</div>
        </div>
        <div class="receipt-info">
            <div><div>Date: ${formattedDate}</div><div>Seller: ${escapeHtml(receipt.seller || '—')}</div></div>
            <div><div>Payment: ${receipt.paymentMethod}</div></div>
        </div>
        <div class="receipt-items">
            ${(receipt.items || []).map(item => `
                <div class="receipt-item">
                    <div class="receipt-item-info">
                        <div class="receipt-item-name">${escapeHtml(item.name)}</div>
                        <div class="receipt-item-details">${escapeHtml(item.sku || '')}</div>
                    </div>
                    <div class="receipt-item-qty">x${item.quantity}</div>
                    <div class="receipt-item-price">S/. ${(item.price * item.quantity).toFixed(2)}</div>
                </div>`).join('')}
        </div>
        <div class="receipt-totals">
            <div class="receipt-total-row"><span>Subtotal</span><span>S/. ${parseFloat(receipt.subtotal||0).toFixed(2)}</span></div>
            <div class="receipt-total-row"><span>IGV (${receipt.taxRate != null ? (receipt.taxRate*100).toFixed(0) : 0}%)</span><span>S/. ${parseFloat(receipt.tax||0).toFixed(2)}</span></div>
            <div class="receipt-total-row total"><span>Total</span><span>S/. ${parseFloat(receipt.total||0).toFixed(2)}</span></div>
        </div>
        <div class="receipt-footer">
            <p>Thank you for your purchase!</p>
            <p>Receipt #${receipt.receiptNumber}</p>
        </div>`;
}

window.viewReceiptById = function(id) {
    const receipt = _getReceipt(id);
    if (receipt) {
        renderReceipt(receipt);
        document.getElementById('receiptModal').classList.add('show');
    } else {
        showNotification('Recibo no disponible para esta venta (sesión anterior)', true);
    }
};

function viewLastReceipt() {
    try {
        const last = JSON.parse(localStorage.getItem('lastReceipt'));
        if (last) { closeSaleCompletedModal(); renderReceipt(last); document.getElementById('receiptModal').classList.add('show'); }
    } catch {}
}

function printLastReceipt() {
    try {
        const last = JSON.parse(localStorage.getItem('lastReceipt'));
        if (last) { closeSaleCompletedModal(); renderReceipt(last); document.getElementById('receiptModal').classList.add('show'); setTimeout(() => window.print(), 150); }
    } catch {}
}

function downloadLastReceiptPDF() {
    try {
        const receipt = JSON.parse(localStorage.getItem('lastReceipt'));
        if (!receipt) return;
        const date = new Date(receipt.date);
        const fd   = date.toLocaleString('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        let text = `INVENTORY SALES SYSTEM\n${'='.repeat(24)}\nReceipt #${receipt.receiptNumber}\nDate: ${fd}\nSeller: ${receipt.seller}\nPayment: ${receipt.paymentMethod}\n${'-'.repeat(24)}\n`;
        (receipt.items || []).forEach(i => {
            text += `${i.name}\n  ${i.sku} x${i.quantity} @ S/. ${i.price.toFixed(2)} = S/. ${(i.price * i.quantity).toFixed(2)}\n`;
        });
        const txPct = receipt.taxRate != null ? (receipt.taxRate*100).toFixed(0) : 0;
        text += `${'-'.repeat(24)}\nSubtotal: S/. ${parseFloat(receipt.subtotal).toFixed(2)}\nIGV (${txPct}%): S/. ${parseFloat(receipt.tax).toFixed(2)}\nTotal: S/. ${parseFloat(receipt.total).toFixed(2)}\n${'='.repeat(24)}\nGracias por su compra!\n`;
        const blob = new Blob([text], { type: 'text/plain' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = `receipt_${receipt.receiptNumber}.txt`;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch {}
}

function closeReceiptModal()       { document.getElementById('receiptModal').classList.remove('show'); }
function showSaleCompletedModal()  { document.getElementById('saleCompletedModal').classList.add('show'); }
function closeSaleCompletedModal() { document.getElementById('saleCompletedModal').classList.remove('show'); }

// ─── Recent Sales ─────────────────────────────────────────────────────────────
async function loadRecentSales() {
    try {
        const transactions = await getRecentTransactions(10) || [];

        if (!transactions.length) {
            recentSalesBody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-secondary);">No sales yet</td></tr>`;
            return;
        }

        recentSalesBody.innerHTML = transactions.map(t => {
            const date        = new Date(t.date);
            const fd          = date.toLocaleString('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
            const profitClass = parseFloat(t.profit || 0) >= 0 ? 'profit-positive' : 'profit-negative';
            const hasReceipt  = !!_getReceipt(t.id);
            const items       = Array.isArray(t.items) ? t.items : [];
            const itemCount   = items.length;
            const itemLabel   = itemCount ? `<span class="sale-items-toggle" onclick="toggleSaleItems(${t.id})" title="Ver productos">${itemCount} producto${itemCount !== 1 ? 's' : ''} ▾</span>` : '—';
            const itemsHtml   = itemCount ? `
                <tr class="sale-items-detail" id="sale-items-${t.id}" style="display:none">
                    <td colspan="8">
                        <div class="sale-items-list">
                            ${items.map((it, i) => {
                                const connector = i === items.length - 1 ? '└──' : '├──';
                                return `<span>${connector} ${escapeHtml(it.product_name)} × ${it.quantity} → S/. ${parseFloat(it.total || 0).toFixed(2)}</span>`;
                            }).join('')}
                        </div>
                    </td>
                </tr>` : '';
            return `<tr class="sale-row" data-id="${t.id}">
                <td>#${String(t.id).padStart(6, '0')}</td>
                <td>${fd}</td>
                <td>${itemLabel}</td>
                <td>S/. ${parseFloat(t.total || 0).toFixed(2)}</td>
                <td>${escapeHtml(t.payment_method || 'Cash')}</td>
                <td>${escapeHtml(t.seller_name || '—')}</td>
                <td class="${profitClass}">S/. ${parseFloat(t.profit || 0).toFixed(2)}</td>
                <td>
                    ${hasReceipt
                        ? `<button class="btn-sm btn-outline" onclick="viewReceiptById(${t.id})">View Receipt</button>`
                        : `<span style="color:var(--text-3);font-size:12px;">—</span>`}
                </td>
            </tr>${itemsHtml}`;
        }).join('');
    } catch (err) {
        console.error('loadRecentSales error:', err);
    }
}

function toggleSaleItems(id) {
    const row = document.getElementById(`sale-items-${id}`);
    if (!row) return;
    const visible = row.style.display !== 'none';
    row.style.display = visible ? 'none' : 'table-row';
    const toggle = document.querySelector(`.sale-row[data-id="${id}"] .sale-items-toggle`);
    if (toggle) toggle.textContent = toggle.textContent.replace(visible ? '▴' : '▾', visible ? '▾' : '▴');
}

// ─── Search ───────────────────────────────────────────────────────────────────
function debounce(fn, ms) { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }; }
if (productSearch) productSearch.addEventListener('input', debounce(e => loadProducts(e.target.value), 280));

// ─── Barcode scanner detection ────────────────────────────────────────────────
// USB readers act like a keyboard: type chars fast (< 50ms apart) then Enter.
let _bcLastKey  = 0;
let _bcFastCount = 0;
let _bcDebounceTimer = null;

if (productSearch) {
    productSearch.addEventListener('keydown', async function (e) {
        const now = Date.now();
        const gap = now - _bcLastKey;
        _bcLastKey = now;

        if (e.key !== 'Enter') {
            // Reset if user paused (slow typing) — bug-fix #5
            if (gap > 100) _bcFastCount = 0;
            if (gap < 50)  _bcFastCount++;
            return;
        }

        // Enter pressed
        e.preventDefault();
        // Cancel any pending debounced search — bug-fix #4
        clearTimeout(_bcDebounceTimer);

        const code = this.value.trim();
        if (!code) return;

        const isScanner = _bcFastCount >= 3;
        _bcFastCount = 0;

        if (isScanner) {
            this.value = '';
            try {
                const product = await getProductByBarcode(code);
                // Bug-fix #2: check stock before adding, with clear feedback
                if (product.stock === 0) {
                    showNotification(`"${product.name}" está sin stock`, true);
                    return;
                }
                if (!allProducts.find(p => p.id === product.id)) {
                    allProducts.push(product);
                }
                addToCart(product.id);
                showNotification(`✓ ${product.name} agregado al carrito`);
                loadProducts(''); // refrescar grilla con todos los productos
            } catch (err) {
                // Bug-fix #1: catch any error from the barcode endpoint as "not found"
                showNotification(`No se encontró ningún producto con código "${code}"`, true);
            }
            return;
        }

        // Manual Enter → filter products normally
        loadProducts(code);
    });

    productSearch.addEventListener('focus', () => { _bcFastCount = 0; _bcLastKey = 0; });

    // Wrap debounce to store timer ref so keydown can cancel it
    productSearch.removeEventListener('input', productSearch._inputHandler);
    productSearch._inputHandler = function(e) {
        clearTimeout(_bcDebounceTimer);
        _bcDebounceTimer = setTimeout(() => loadProducts(e.target.value), 280);
    };
    productSearch.addEventListener('input', productSearch._inputHandler);
}

// ─── Init — load products and recent sales in parallel ────────────────────────
const _salesUser = initPage({ requireStore: true });
if (_salesUser) {
    renderCart();
    Promise.all([loadTaxSettings(), loadProducts(), loadRecentSales()]);
}
