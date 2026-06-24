// DOM Elements
const addSellerBtn       = document.getElementById('addSellerBtn');
const sellerModal        = document.getElementById('sellerModal');
const modalClose         = document.getElementById('modalClose');
const cancelBtn          = document.getElementById('cancelBtn');
const sellerForm         = document.getElementById('sellerForm');
const modalTitle         = document.getElementById('modalTitle');
const sellersTableBody   = document.getElementById('sellersTableBody');
const emptyState         = document.getElementById('emptyState');
const searchInput        = document.getElementById('searchInput');
const statusFilter       = document.getElementById('statusFilter');
const sellerDetailsModal = document.getElementById('sellerDetailsModal');
const detailsModalClose  = document.getElementById('detailsModalClose');
const sellerDetailsContent = document.getElementById('sellerDetailsContent');

function debounce(fn, ms) {
    let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

let _sellersCache = []; // in-memory list for instant view/edit

function escAttr(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Modal ─────────────────────────────────────────────────────────
function openModal(mode, seller = null) {
    modalTitle.textContent = mode === 'add' ? 'Add New Seller' : 'Edit Seller';

    if (mode === 'add') {
        sellerForm.reset();
        document.getElementById('sellerId').value = '';
        document.getElementById('status').value   = 'Active';
        const usernameField = document.getElementById('username');
        if (usernameField) usernameField.disabled = false;
    } else if (mode === 'edit' && seller) {
        document.getElementById('sellerId').value             = seller.id;
        document.getElementById('fullName').value             = seller.full_name || '';
        document.getElementById('username').value             = seller.username || '';
        document.getElementById('email').value                = seller.email || '';
        document.getElementById('phone').value                = seller.phone || '';
        document.getElementById('commissionPercentage').value = seller.commission_percentage || 0;
        document.getElementById('status').value               = seller.status || 'Active';
        const usernameField = document.getElementById('username');
        if (usernameField) usernameField.disabled = true;
    }

    sellerModal.classList.add('show');
}

function closeModal() { sellerModal.classList.remove('show'); sellerForm.reset(); }

function openDetailsModal(seller) {
    const orders     = parseInt(seller.total_orders || 0);
    const totalSales = parseFloat(seller.total_sales || 0);
    const commission = totalSales * parseFloat(seller.commission_percentage || 0) / 100;
    const initials   = (seller.full_name || '?').split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2);

    sellerDetailsContent.innerHTML = `
        <div class="seller-details-header">
            <div class="seller-avatar">${initials}</div>
            <div class="seller-info">
                <h3>${escapeHtml(seller.full_name)}</h3>
                <p class="seller-status">${seller.status}</p>
            </div>
        </div>
        <div class="seller-details-grid">
            <div class="detail-item"><label>Usuario:</label><span>${escapeHtml(seller.username)}</span></div>
            <div class="detail-item"><label>Correo:</label><span>${escapeHtml(seller.email || 'N/A')}</span></div>
            <div class="detail-item"><label>Teléfono:</label><span>${escapeHtml(seller.phone || 'N/A')}</span></div>
            <div class="detail-item"><label>Comisión:</label><span>${seller.commission_percentage || 0}%</span></div>
            <div class="detail-item"><label>Estado:</label><span class="status-badge ${(seller.status || '').toLowerCase()}">${seller.status}</span></div>
            <div class="detail-item"><label>Ingreso:</label><span>${seller.join_date ? new Date(seller.join_date).toLocaleDateString() : '—'}</span></div>
        </div>
        <div class="seller-performance">
            <h4>Rendimiento</h4>
            <div class="performance-grid">
                <div class="performance-card"><div class="performance-label">Pedidos</div><div class="performance-value">${orders}</div></div>
                <div class="performance-card"><div class="performance-label">Ventas</div><div class="performance-value">S/. ${totalSales.toFixed(2)}</div></div>
                <div class="performance-card"><div class="performance-label">Comisión</div><div class="performance-value">S/. ${commission.toFixed(2)}</div></div>
            </div>
        </div>`;

    sellerDetailsModal.classList.add('show');
}

function closeDetailsModal() { sellerDetailsModal.classList.remove('show'); }

// ── Event Listeners ───────────────────────────────────────────────
if (addSellerBtn)    addSellerBtn.addEventListener('click', () => openModal('add'));
if (modalClose)      modalClose.addEventListener('click', closeModal);
if (cancelBtn)       cancelBtn.addEventListener('click', closeModal);
if (detailsModalClose) detailsModalClose.addEventListener('click', closeDetailsModal);

if (sellerModal)        sellerModal.addEventListener('click', e => { if (e.target === sellerModal) closeModal(); });
if (sellerDetailsModal) sellerDetailsModal.addEventListener('click', e => { if (e.target === sellerDetailsModal) closeDetailsModal(); });

// ── Credentials Modal (idéntico al original) ──────────────────────
function generateLoginLink(username, password) {
    const token = btoa(JSON.stringify({ u: username, p: password }));
    return `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, '')}login.html?auto=${token}`;
}

function copyToClipboard(elementId) {
    const el = document.getElementById(elementId);
    el.select();
    el.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(el.value)
        .then(() => showNotification('Copiado al portapapeles'))
        .catch(() => showNotification('No se pudo copiar', true));
}

function copyAllCredentials(fullName, username, password) {
    const text = `Nombre: ${fullName}\nUsuario: ${username}\nContraseña: ${password}`;
    navigator.clipboard.writeText(text)
        .then(() => showNotification('Credenciales copiadas'))
        .catch(() => showNotification('No se pudo copiar', true));
}

function showCredentialsModal(fullName, username, password) {
    const existing = document.getElementById('credentialsModal');
    if (existing) existing.remove();

    const link = generateLoginLink(username, password);
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.id = 'credentialsModal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Credenciales del Vendedor</h2>
                <button class="modal-close" onclick="document.getElementById('credentialsModal').remove()">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
            <div class="modal-body">
                <div class="credentials-warning">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                    <h3>Guarda estas credenciales</h3>
                    <p>Solo se mostrarán una vez. Guárdalas en un lugar seguro.</p>
                </div>
                <div class="credentials-display">
                    <div class="credential-item">
                        <label>Nombre completo:</label>
                        <div class="credential-input-group">
                            <input type="text" id="credFullName" value="${escAttr(fullName)}" readonly>
                            <button class="copy-btn" onclick="copyToClipboard('credFullName')">Copiar</button>
                        </div>
                    </div>
                    <div class="credential-item">
                        <label>Usuario:</label>
                        <div class="credential-input-group">
                            <input type="text" id="credUsername" value="${escAttr(username)}" readonly>
                            <button class="copy-btn" onclick="copyToClipboard('credUsername')">Copiar</button>
                        </div>
                    </div>
                    <div class="credential-item">
                        <label>Contraseña:</label>
                        <div class="credential-input-group">
                            <input type="text" id="credPassword" value="${escAttr(password)}" readonly>
                            <button class="copy-btn" onclick="copyToClipboard('credPassword')">Copiar</button>
                        </div>
                    </div>
                    <div class="credential-item">
                        <label>Enlace de acceso directo:</label>
                        <div class="credential-input-group">
                            <input type="text" id="credLoginLink" value="${escAttr(link)}" readonly style="font-size:11px;">
                            <button class="copy-btn" onclick="navigator.clipboard.writeText(document.getElementById('credLoginLink').value)">Copiar</button>
                        </div>
                    </div>
                    <button class="btn btn-primary copy-all-btn" onclick="copyAllCredentials('${escAttr(fullName)}','${escAttr(username)}','${escAttr(password)}')">Copiar todo</button>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary" onclick="document.getElementById('credentialsModal').remove()">Ya las guardé</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

// ── Load Sellers ──────────────────────────────────────────────────
let _sellersLoaded = false;
async function loadSellers() {
    try {
        if (!_sellersLoaded && sellersTableBody) sellersTableBody.innerHTML = skeletonRows(7, 5);
        const filters = {};
        if (statusFilter && statusFilter.value !== 'all') filters.status = statusFilter.value;
        if (searchInput  && searchInput.value.trim())     filters.q      = searchInput.value.trim();

        const sellers = await getSellers(filters) || [];
        _sellersCache = sellers;
        _sellersLoaded = true;
        const isUserSeller = isSeller() && !isBusinessAdmin() && !isSuperAdmin();

        if (sellers.length === 0) {
            sellersTableBody.innerHTML = '';
            emptyState.classList.add('show');
            return;
        }
        emptyState.classList.remove('show');

        sellersTableBody.innerHTML = sellers.map(seller => {
            const statusClass = (seller.status || 'active').toLowerCase();
            const initials    = (seller.full_name || seller.username || '?').split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2);
            const orders      = seller.total_orders || 0;
            const sales       = parseFloat(seller.total_sales || 0).toFixed(2);
            const commission  = (parseFloat(seller.total_sales || 0) * parseFloat(seller.commission_percentage || 0) / 100).toFixed(2);
            return `
                <tr>
                    <td>
                        <div class="seller-info">
                            <div class="seller-avatar">${initials}</div>
                            <div>
                                <div class="seller-name">${escapeHtml(seller.full_name)}</div>
                                <div class="seller-username">@${escapeHtml(seller.username)}</div>
                            </div>
                        </div>
                    </td>
                    <td>${escapeHtml(seller.email || '—')}</td>
                    <td>${escapeHtml(seller.phone || '—')}</td>
                    <td>${seller.commission_percentage || 0}%</td>
                    <td><span class="status-badge ${statusClass}">${seller.status}</span></td>
                    <td>${seller.join_date ? new Date(seller.join_date).toLocaleDateString() : '—'}</td>
                    <td>
                        <div class="performance-stats">
                            <div class="performance-stat"><strong>${orders}</strong> pedidos</div>
                            <div class="performance-stat"><strong>S/. ${sales}</strong> ventas</div>
                            <div class="performance-stat"><strong>S/. ${commission}</strong> comisión</div>
                        </div>
                    </td>
                    <td>
                        <div class="action-buttons">
                            ${isUserSeller ? '' : `
                            <button class="btn-icon" onclick="handleResetPassword(${seller.id})" title="Restablecer contraseña">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                            </button>`}
                            <button class="btn-icon edit" onclick="viewSeller(${seller.id})">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            </button>
                            ${isUserSeller ? '' : `
                            <button class="btn-icon edit" onclick="editSeller(${seller.id})">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button class="btn-icon delete" onclick="deleteSellerHandler(${seller.id})">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>`}
                        </div>
                    </td>
                </tr>`;
        }).join('');
    } catch (err) {
        console.error('loadSellers error:', err);
    }
}

// ── Stats ─────────────────────────────────────────────────────────
async function updateStats() {
    try {
        const stats = await getSellerStats();
        const els = {
            totalSellers:    document.getElementById('totalSellers'),
            activeSellers:   document.getElementById('activeSellers'),
            totalSales:      document.getElementById('totalSales'),
            totalCommission: document.getElementById('totalCommission') || document.getElementById('totalCommissions')
        };
        if (els.totalSellers)    els.totalSellers.textContent    = stats.totalSellers    || 0;
        if (els.activeSellers)   els.activeSellers.textContent   = stats.activeSellers   || 0;
        if (els.totalSales)      els.totalSales.textContent      = 'S/. ' + parseFloat(stats.totalSales    || 0).toFixed(2);
        if (els.totalCommission) els.totalCommission.textContent = 'S/. ' + parseFloat(stats.totalCommission || 0).toFixed(2);
    } catch (err) { console.error('Stats error:', err); }
}

// ── Form Submit ───────────────────────────────────────────────────
sellerForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id   = document.getElementById('sellerId').value;
    const data = {
        fullName:             document.getElementById('fullName').value.trim(),
        username:             document.getElementById('username').value.trim(),
        email:                document.getElementById('email').value.trim(),
        phone:                document.getElementById('phone').value.trim(),
        commissionPercentage: parseFloat(document.getElementById('commissionPercentage').value) || 0,
        status:               document.getElementById('status').value
    };

    const submitBtn = e.target.querySelector('[type=submit]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Guardando…'; }
    try {
        if (id) {
            await updateSeller(parseInt(id), data);
            showNotification('Vendedor actualizado');
        } else {
            const result = await addSeller(data);
            showCredentialsModal(data.fullName, result.seller.username, result.temporaryPassword);
        }
        closeModal();
        await Promise.all([loadSellers(), updateStats()]);
    } catch (err) {
        showNotification('Error: ' + err.message, true);
    } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = id ? 'Actualizar' : 'Agregar vendedor'; }
    }
});

// ── Global Handlers ───────────────────────────────────────────────
window.viewSeller = function(id) {
    const seller = _sellersCache.find(s => s.id === id);
    if (seller) openDetailsModal(seller);
};

window.editSeller = function(id) {
    const seller = _sellersCache.find(s => s.id === id);
    if (seller) openModal('edit', seller);
};

window.deleteSellerHandler = async function(id) {
    const seller = _sellersCache.find(s => s.id === id);
    const name = seller ? seller.full_name : 'este vendedor';
    if (!confirm(`¿Eliminar a "${name}"? Esta acción no se puede deshacer.`)) return;
    const row = document.querySelector(`button[onclick="deleteSellerHandler(${id})"]`)?.closest('tr');
    if (row) row.remove();
    try {
        await deleteSeller(id);
        await Promise.all([loadSellers(), updateStats()]);
    } catch (err) {
        await Promise.all([loadSellers(), updateStats()]);
        showNotification('Error: ' + err.message, true);
    }
};

window.handleResetPassword = async function(id) {
    const seller = _sellersCache.find(s => s.id === id);
    const name = seller ? seller.full_name : 'este vendedor';
    if (!confirm(`¿Restablecer la contraseña de "${name}"? Se generará una nueva.`)) return;
    try {
        const result = await resetSellerPassword(id);
        showCredentialsModal(result.full_name || '', result.username, result.temporaryPassword);
    } catch (err) { showNotification('Error: ' + err.message, true); }
};

// ── Access Denied ─────────────────────────────────────────────────
function showAccessDenied() {
    document.querySelector('.dashboard-container').innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;width:100%;gap:16px;background:var(--bg,#f8fafc);font-family:Inter,sans-serif;">
            <div style="background:var(--surface,#fff);border:1px solid var(--border,#e2e8f0);border-radius:16px;padding:48px 56px;text-align:center;max-width:420px;">
                <div style="width:64px;height:64px;border-radius:50%;background:#fef2f2;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                </div>
                <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:var(--text-1,#0f172a);">Acceso denegado</h2>
                <p style="margin:0 0 24px;font-size:14px;color:var(--text-2,#64748b);line-height:1.5;">Esta página no está permitida para tu cuenta.</p>
                <a href="index.html" style="display:inline-block;padding:10px 24px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">Ir al Dashboard</a>
            </div>
        </div>`;
}

// ── Search / Filter ───────────────────────────────────────────────
if (searchInput)  searchInput.addEventListener('input',  debounce(loadSellers, 300));
if (statusFilter) statusFilter.addEventListener('change', loadSellers);

// ── Initialize ────────────────────────────────────────────────────
const _sellersUser = initPage({ requireStore: true });
if (_sellersUser) {
    if (isSeller() && !isBusinessAdmin() && !isSuperAdmin()) {
        showAccessDenied();
    } else {
        Promise.all([loadSellers(), updateStats()]);
    }
}
