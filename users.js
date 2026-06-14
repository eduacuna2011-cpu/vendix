// Users Page — Super Admin, async API version

const searchInput         = document.getElementById('searchInput');
const statusFilter        = document.getElementById('statusFilter');
const adminUsersBody      = document.getElementById('adminUsersBody');
const addAdminUserBtn     = document.getElementById('addAdminUserBtn');
const adminUserModal      = document.getElementById('adminUserModal');
const adminUserForm       = document.getElementById('adminUserForm');
const modalTitle          = document.getElementById('modalTitle');
const closeModalBtn       = document.getElementById('closeModalBtn');
const cancelModalBtn      = document.getElementById('cancelModalBtn');
const credentialsModal    = document.getElementById('credentialsModal');
const closeCredentialsModalBtn = document.getElementById('closeCredentialsModalBtn');
const closeCredentialsBtn = document.getElementById('closeCredentialsBtn');
const deleteModal         = document.getElementById('deleteModal');
const closeDeleteModalBtn = document.getElementById('closeDeleteModalBtn');
const cancelDeleteBtn     = document.getElementById('cancelDeleteBtn');
const confirmDeleteBtn    = document.getElementById('confirmDeleteBtn');
const statsModal          = document.getElementById('statsModal');
const closeStatsModalBtn  = document.getElementById('closeStatsModalBtn');

let deleteTargetId = null;

function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

async function loadStatistics() {
    try {
        const stats = await getUserStats();
        document.getElementById('totalBusinesses').textContent  = stats.totalBusinesses;
        document.getElementById('activeBusinesses').textContent = stats.activeBusinesses;
        document.getElementById('createdThisMonth').textContent = stats.createdThisMonth;
        document.getElementById('totalRevenue').textContent     = 'S/. ' + (stats.totalRevenue || 0).toFixed(2);
    } catch (err) { console.error('Stats error:', err); }
}

async function loadAdminUsers() {
    const filters = {
        status: statusFilter ? statusFilter.value : 'all',
        q:      searchInput  ? searchInput.value  : ''
    };
    try {
        const users = await getAdminUsers(filters);
        _usersCache = users || [];
        if (!users || users.length === 0) {
            adminUsersBody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-secondary);">No admin users found</td></tr>`;
            return;
        }
        adminUsersBody.innerHTML = users.map(user => {
            const d      = new Date(user.created_at);
            const date   = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const status = user.status === 'Active' ? 'status-active' : 'status-disabled';
            const trialBadge = renderTrialBadge(user);
            return `
                <tr>
                    <td>${escapeHtml(user.business_name)}</td>
                    <td>${escapeHtml(user.full_name)}</td>
                    <td>${escapeHtml(user.username)}</td>
                    <td>${escapeHtml(user.email || '—')}</td>
                    <td><span class="status-badge ${status}">${user.status}</span></td>
                    <td>${trialBadge}</td>
                    <td>${date}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-icon" onclick="showAdminPassword(${user.id})" title="View Credentials">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                            </button>
                            <button class="btn-icon" onclick="viewBusinessProfile(${user.id})" title="View Profile">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/></svg>
                            </button>
                            <button class="btn-icon" onclick="editAdminUser(${user.id})" title="Edit">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button class="btn-icon" onclick="sendCredsWhatsApp(${user.id})" title="Enviar credenciales por WhatsApp" style="color:#25d366;">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                            </button>
                            <button class="btn-icon" onclick="handleMarkUserPaid(${user.id})" title="Marcar pagado" style="color:#16a34a;">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14l-4-4 1.41-1.41L11 13.17l6.59-6.59L19 8l-8 8z" fill="currentColor" stroke="none"/></svg>
                            </button>
                            <button class="btn-icon" onclick="handleExtendTrial(${user.id})" title="Extender +3 días" style="color:#6366f1;">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            </button>
                            <button class="btn-icon ${user.status === 'Active' ? '' : 'danger'}" onclick="handleToggleStatus(${user.id})" title="${user.status === 'Active' ? 'Disable' : 'Enable'}">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                            </button>
                            <button class="btn-icon danger" onclick="promptDeleteAdminUser(${user.id})" title="Delete">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                        </div>
                    </td>
                </tr>`;
        }).join('');
    } catch (err) { console.error('Load users error:', err); }
}

function generateLoginLink(username, password) {
    const token = btoa(JSON.stringify({ u: username, p: password }));
    return `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, '')}login.html?auto=${token}`;
}

function showCredentialsModal(data) {
    document.getElementById('credBusinessName').textContent = data.businessName || '';
    document.getElementById('credUsername').textContent     = data.username;
    document.getElementById('credPassword').textContent     = data.temporaryPassword;
    const link    = generateLoginLink(data.username, data.temporaryPassword);
    const linkEl  = document.getElementById('credLoginLink');
    const linkRow = document.getElementById('credLoginLinkRow');
    if (linkEl)  linkEl.value = link;
    if (linkRow) linkRow.style.display = '';
    credentialsModal.classList.add('show');
}

async function showAdminPassword(id) {
    try {
        const result = await resetAdminPassword(id);
        showQuickCredPopup(result.full_name || '', result.username, result.temporaryPassword,
            generateLoginLink(result.username, result.temporaryPassword));
    } catch {
        alert('Could not reset password.');
    }
}

function showQuickCredPopup(fullName, username, password, link) {
    const existing = document.getElementById('quickCredPopup');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.id = 'quickCredPopup';
    el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;';
    el.innerHTML = `<div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:28px;max-width:400px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.3);font-family:Inter,sans-serif;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;"><h3 style="margin:0;font-size:16px;font-weight:700;color:var(--text-1);">New Password — ${escapeHtml(fullName)}</h3><button onclick="document.getElementById('quickCredPopup').remove()" style="background:none;border:none;cursor:pointer;color:var(--text-3);font-size:18px;">&times;</button></div><div style="display:flex;flex-direction:column;gap:10px;margin-bottom:18px;"><div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:12px;"><div style="font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;margin-bottom:4px;">Username</div><div style="display:flex;align-items:center;gap:8px;"><code style="flex:1;font-size:13px;font-weight:600;color:var(--text-1);">${escapeHtml(username)}</code><button onclick="navigator.clipboard.writeText(this.previousElementSibling.textContent)" style="padding:4px 9px;font-size:11px;font-weight:600;background:var(--surface);border:1px solid var(--border);border-radius:5px;color:var(--text-2);cursor:pointer;">Copy</button></div></div><div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:12px;"><div style="font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;margin-bottom:4px;">New Password</div><div style="display:flex;align-items:center;gap:8px;"><code style="flex:1;font-size:13px;font-weight:600;color:var(--text-1);">${escapeHtml(password)}</code><button onclick="navigator.clipboard.writeText(this.previousElementSibling.textContent)" style="padding:4px 9px;font-size:11px;font-weight:600;background:var(--surface);border:1px solid var(--border);border-radius:5px;color:var(--text-2);cursor:pointer;">Copy</button></div></div><div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:12px;"><div style="font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;margin-bottom:4px;">Magic Login Link</div><div style="display:flex;align-items:center;gap:8px;"><input readonly value="${escapeHtml(link)}" style="flex:1;font-size:11px;color:var(--text-2);background:none;border:none;outline:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><button onclick="navigator.clipboard.writeText(this.previousElementSibling.value)" style="padding:4px 9px;font-size:11px;font-weight:600;background:var(--surface);border:1px solid var(--border);border-radius:5px;color:var(--text-2);cursor:pointer;white-space:nowrap;">Copy Link</button></div></div></div><button onclick="document.getElementById('quickCredPopup').remove()" style="width:100%;padding:10px;background:#6366f1;color:#fff;border:none;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;">Close</button></div>`;
    document.body.appendChild(el);
    el.addEventListener('click', e => { if (e.target === el) el.remove(); });
}

// Keep user data in memory for edit modal
let _usersCache = [];

function showAdminUserModal(user = null) {
    if (user) {
        modalTitle.textContent = 'Edit Admin User';
        document.getElementById('adminUserId').value    = user.id;
        document.getElementById('businessName').value   = user.business_name || '';
        document.getElementById('adminFullName').value  = user.full_name || '';
        document.getElementById('adminEmail').value     = user.email || '';
        document.getElementById('adminPhone').value     = user.phone || '';
    } else {
        modalTitle.textContent = 'Add Admin User';
        adminUserForm.reset();
        document.getElementById('adminUserId').value = '';
    }
    adminUserModal.classList.add('show');
}

function hideAdminUserModal() {
    adminUserModal.classList.remove('show');
    adminUserForm.reset();
    document.getElementById('adminUserId').value = '';
}

function hideCredentialsModal() { credentialsModal.classList.remove('show'); }

function showDeleteModal(id) { deleteTargetId = id; deleteModal.classList.add('show'); }
function hideDeleteModal()   { deleteModal.classList.remove('show'); deleteTargetId = null; }

async function editAdminUser(id) {
    // Find from loaded list
    const row = _usersCache.find(u => u.id === id);
    if (row) showAdminUserModal(row);
}

async function handleToggleStatus(id) {
    const btn   = document.querySelector(`button[onclick="handleToggleStatus(${id})"]`);
    const row   = btn?.closest('tr');
    const badge = row?.querySelector('.status-badge');
    if (!badge) return;

    const wasActive = badge.textContent.trim() === 'Active';
    const newStatus = wasActive ? 'Disabled' : 'Active';

    // Optimistic UI — instant feedback
    badge.textContent = newStatus;
    badge.className   = 'status-badge ' + (wasActive ? 'status-disabled' : 'status-active');
    if (btn) btn.classList.toggle('danger', !wasActive);

    try {
        await toggleAdminUserStatus(id);
        // Update cache in memory — no need to reload the whole table
        const cached = _usersCache.find(u => u.id === id);
        if (cached) cached.status = newStatus;
    } catch (err) {
        // Revert optimistic update on failure
        badge.textContent = wasActive ? 'Active' : 'Disabled';
        badge.className   = 'status-badge ' + (wasActive ? 'status-active' : 'status-disabled');
        if (btn) btn.classList.toggle('danger', wasActive);
        alert('Error: ' + err.message);
    }
}

function promptDeleteAdminUser(id) { showDeleteModal(id); }

async function viewBusinessProfile(id) {
    try {
        const data = await getAdminUserById(id);
        const u    = data.user;
        const s    = data.stats;

        document.getElementById('statsBusinessName').textContent  = u.business_name || '';
        document.getElementById('profileAdminName').textContent   = u.full_name;
        document.getElementById('profileAdminEmail').textContent  = u.email || '—';
        document.getElementById('profileAdminPhone').textContent  = u.phone || '—';
        document.getElementById('profileAdminUsername').textContent = u.username;
        document.getElementById('profileAdminStatus').textContent = u.status;
        document.getElementById('profileAdminStatus').className   = 'status-badge ' + (u.status === 'Active' ? 'status-active' : 'status-disabled');

        document.getElementById('statTotalProducts').textContent  = s.totalProducts;
        document.getElementById('statTotalSales').textContent     = 'S/. ' + (s.totalSales || 0).toFixed(2);
        document.getElementById('statTotalProfit').textContent    = 'S/. ' + (s.totalProfit || 0).toFixed(2);
        document.getElementById('statTotalOrders').textContent    = s.totalOrders;
        document.getElementById('statTotalSellers').textContent   = s.totalSellers;
        document.getElementById('statActiveSellers').textContent  = s.activeSellers;

        const sellersBody = document.getElementById('profileSellersBody');
        sellersBody.innerHTML = data.sellers.length === 0
            ? `<tr><td colspan="5" style="text-align:center;color:var(--text-secondary);">No sellers yet</td></tr>`
            : data.sellers.map(s => `<tr><td>${escapeHtml(s.full_name)}</td><td>${escapeHtml(s.username)}</td><td>${escapeHtml(s.email||'—')}</td><td>${escapeHtml(s.phone||'—')}</td><td><span class="status-badge ${s.status==='Active'?'status-active':'status-disabled'}">${s.status}</span></td></tr>`).join('');

        statsModal.classList.add('show');
    } catch (err) { alert('Error loading profile: ' + err.message); }
}

function hideStatsModal() { statsModal.classList.remove('show'); }

function copyAllCredentials() {
    const biz  = document.getElementById('credBusinessName').textContent;
    const user = document.getElementById('credUsername').textContent;
    const pw   = document.getElementById('credPassword').textContent;
    navigator.clipboard.writeText(`Business: ${biz}\nUsername: ${user}\nPassword: ${pw}`)
        .then(() => alert('Copied!')).catch(() => alert('Copy failed'));
}

// Event listeners
if (addAdminUserBtn)          addAdminUserBtn.addEventListener('click', () => showAdminUserModal());
if (closeModalBtn)            closeModalBtn.addEventListener('click', hideAdminUserModal);
if (cancelModalBtn)           cancelModalBtn.addEventListener('click', hideAdminUserModal);
if (closeCredentialsModalBtn) closeCredentialsModalBtn.addEventListener('click', hideCredentialsModal);
if (closeCredentialsBtn)      closeCredentialsBtn.addEventListener('click', hideCredentialsModal);
if (closeDeleteModalBtn)      closeDeleteModalBtn.addEventListener('click', hideDeleteModal);
if (cancelDeleteBtn)          cancelDeleteBtn.addEventListener('click', hideDeleteModal);
if (closeStatsModalBtn)       closeStatsModalBtn.addEventListener('click', hideStatsModal);

if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', async () => {
        if (deleteTargetId) {
            try {
                await deleteAdminUser(deleteTargetId);
                await Promise.all([loadAdminUsers(), loadStatistics()]);
            } catch (err) { alert('Error deleting: ' + err.message); }
        }
        hideDeleteModal();
    });
}

if (adminUserForm) {
    adminUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id           = document.getElementById('adminUserId').value;
        const businessName = document.getElementById('businessName').value;
        const fullName     = document.getElementById('adminFullName').value;
        const email        = document.getElementById('adminEmail').value;
        const phone        = document.getElementById('adminPhone').value;

        try {
            if (id) {
                await updateAdminUser(parseInt(id), { businessName, fullName, email, phone });
            } else {
                const result = await createAdminUserWithBusiness({ businessName, fullName, email, phone });
                showCredentialsModal({
                    businessName:      result.user.business_name,
                    username:          result.user.username,
                    temporaryPassword: result.temporaryPassword
                });
            }
            hideAdminUserModal();
            await Promise.all([loadAdminUsers(), loadStatistics()]);
        } catch (err) { alert('Error: ' + err.message); }
    });
}

// ─── Trial helpers ────────────────────────────────────────────────────────────
function renderTrialBadge(user) {
    if (user.is_paid) {
        return `<span class="status-badge status-active" style="white-space:nowrap;">✓ Pagado</span>`;
    }
    if (!user.trial_ends_at) {
        return `<span class="status-badge" style="background:rgba(100,116,139,.12);color:#64748b;">Sin trial</span>`;
    }
    const msLeft = new Date(user.trial_ends_at) - Date.now();
    const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
    if (daysLeft <= 0) {
        return `<span class="status-badge status-disabled" style="white-space:nowrap;">Vencido</span>`;
    }
    const color = daysLeft > 3 ? '#16a34a' : daysLeft > 1 ? '#d97706' : '#dc2626';
    const bg    = daysLeft > 3 ? 'rgba(22,163,74,.1)' : daysLeft > 1 ? 'rgba(217,119,6,.1)' : 'rgba(220,38,38,.1)';
    return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:20px;font-size:11px;font-weight:700;background:${bg};color:${color};white-space:nowrap;">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        ${daysLeft}d restante${daysLeft !== 1 ? 's' : ''}
    </span>`;
}

async function sendCredsWhatsApp(id) {
    const user = _usersCache.find(u => u.id === id);
    if (!user) return;
    if (!user.phone) { alert('Este usuario no tiene número de WhatsApp registrado.'); return; }
    if (!confirm(`Esto generará una nueva contraseña para ${user.full_name} y abrirá WhatsApp. ¿Continuar?`)) return;

    // Open blank tab NOW (sync context) to avoid popup blocker
    const tab = window.open('', '_blank');

    try {
        const result = await resetAdminPassword(id);
        const loginLink = generateLoginLink(result.username, result.temporaryPassword);
        const phone = user.phone.replace(/\D/g, '');
        const number = phone.startsWith('51') ? phone : '51' + phone;
        const msg = encodeURIComponent(
            `Hola ${user.full_name}! 🎉 Aquí están tus credenciales de Vendix.\n\n` +
            `🏪 Negocio: ${user.business_name}\n` +
            `👤 Usuario: ${result.username}\n` +
            `🔑 Contraseña: ${result.temporaryPassword}\n\n` +
            `🔗 Ingresa con un clic:\n${loginLink}\n\n` +
            `(Cambia tu contraseña al ingresar por primera vez)`
        );
        tab.location.href = `https://wa.me/${number}?text=${msg}`;
    } catch (err) {
        tab.close();
        alert('Error: ' + err.message);
    }
}

async function handleMarkUserPaid(id) {
    if (!confirm('¿Marcar este usuario como pagado? Se desbloquearán todas las funciones permanentemente.')) return;
    try {
        await markUserPaid(id);
        await loadAdminUsers();
    } catch (err) { alert('Error: ' + err.message); }
}

async function handleExtendTrial(id) {
    const days = prompt('¿Cuántos días extender el trial?', '3');
    if (!days || isNaN(parseInt(days))) return;
    try {
        await extendUserTrial(id, parseInt(days));
        await loadAdminUsers();
    } catch (err) { alert('Error: ' + err.message); }
}

if (searchInput)  searchInput.addEventListener('input',  debounce(loadAdminUsers, 300));
if (statusFilter) statusFilter.addEventListener('change', loadAdminUsers);

window.addEventListener('click', (e) => {
    if (e.target === adminUserModal)   hideAdminUserModal();
    if (e.target === credentialsModal) hideCredentialsModal();
    if (e.target === deleteModal)      hideDeleteModal();
    if (e.target === statsModal)       hideStatsModal();
});

// Cache is populated inside loadAdminUsers directly (no double-fetch wrapper)

// Initialize — only Super Admin
const _usersSession = getCurrentUser();
if (!_usersSession) {
    window.location.href = 'login.html';
} else if (!isSuperAdmin()) {
    window.location.href = 'index.html';
} else {
    applyStoredTheme();
    updateUserProfile(_usersSession);
    applyRoleBasedUI();
    initSidebar();
    initUserProfileLogout();
    maybeShowWelcomeModal();
    Promise.all([loadStatistics(), loadAdminUsers(), loadLeads()]);
}

// ═══════════════════════════════════════════════════════
// LEADS — Solicitudes de Vendix
// ═══════════════════════════════════════════════════════

let _leadsCache = [];
let _leadCredsData = null;

const PLAN_LABELS = { vendix: 'Vendix S/.15.99', starter: 'Vendix S/.15.99', negocio: 'Vendix S/.15.99', pro: 'Vendix S/.15.99' };

async function loadLeads() {
    try {
        const [leads, countData] = await Promise.all([getLeads(), getLeadsCount()]);
        _leadsCache = leads || [];
        renderLeads(_leadsCache);
        updateLeadsBadge(countData?.count || 0);
    } catch (err) {
        console.error('Leads error:', err);
        const tbody = document.getElementById('leadsBody');
        if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--danger);padding:20px;">Error al cargar solicitudes: ${err.message}</td></tr>`;
    }
}

function updateLeadsBadge(count) {
    const badge = document.getElementById('leadsBadge');
    if (!badge) return;
    if (count > 0) {
        badge.textContent = count + ' nuevas';
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
}

function renderLeads(leads) {
    const tbody = document.getElementById('leadsBody');
    if (!tbody) return;
    if (!leads.length) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-secondary);padding:24px;">Sin solicitudes aún</td></tr>`;
        return;
    }
    tbody.innerHTML = leads.map(l => {
        const date = new Date(l.created_at).toLocaleDateString('es-PE', { day:'2-digit', month:'short', year:'numeric' });
        const plan = PLAN_LABELS[l.plan] || l.plan;

        const paidBadge = l.paid
            ? `<span class="status-badge status-active">Pagado</span>`
            : `<span class="status-badge status-disabled">Pendiente</span>`;

        const accountBadge = l.account_created
            ? `<span class="status-badge status-active">Creada</span>`
            : `<span class="status-badge" style="background:rgba(99,102,241,.1);color:#6366f1;">Pendiente</span>`;

        const createBtn = l.account_created
            ? `<button class="btn btn-sm" disabled style="opacity:.4;cursor:not-allowed;">✓ Creada</button>`
            : `<button class="btn btn-sm btn-primary" onclick="handleCreateAccount(${l.id})">Crear cuenta</button>`;

        const paidBtn = `<button class="btn btn-sm" onclick="handleMarkPaid(${l.id})">${l.paid ? '↩ Desmarcar' : '✓ Pagado'}</button>`;

        return `<tr id="lead-row-${l.id}">
            <td>
                <strong>${escapeHtml(l.business_name)}</strong>
                ${l.biz_type ? `<br><span style="font-size:11px;color:var(--text-secondary);">${escapeHtml(l.biz_type)}</span>` : ''}
            </td>
            <td>
                ${escapeHtml(l.full_name)}<br>
                <a href="mailto:${escapeHtml(l.email)}" style="font-size:11px;color:var(--primary);">${escapeHtml(l.email)}</a><br>
                <a href="https://wa.me/51${escapeHtml(l.phone)}" target="_blank" style="font-size:11px;color:#25d366;">📱 ${escapeHtml(l.phone)}</a>
            </td>
            <td><strong>${escapeHtml(plan)}</strong></td>
            <td>${paidBadge}</td>
            <td>${accountBadge}</td>
            <td style="white-space:nowrap;font-size:12px;">${date}</td>
            <td>
                <div style="display:flex;flex-direction:column;gap:6px;">
                    ${createBtn}
                    ${paidBtn}
                </div>
            </td>
        </tr>`;
    }).join('');
}

async function handleMarkPaid(id) {
    const lead = _leadsCache.find(l => l.id === id);
    if (!lead) return;
    // Optimistic update
    lead.paid = !lead.paid;
    renderLeads(_leadsCache);
    try {
        const updated = await markLeadPaid(id);
        Object.assign(lead, updated);
        renderLeads(_leadsCache);
    } catch (err) {
        lead.paid = !lead.paid;
        renderLeads(_leadsCache);
        alert('Error: ' + err.message);
    }
}

async function handleCreateAccount(id) {
    const lead = _leadsCache.find(l => l.id === id);
    if (!lead) return;
    if (!confirm(`¿Crear cuenta para "${lead.business_name}"?\n\nSe generará usuario y contraseña automáticamente.`)) return;

    const btn = document.querySelector(`#lead-row-${id} .btn-primary`);
    if (btn) { btn.disabled = true; btn.textContent = 'Creando...'; }

    try {
        const result = await createAccountFromLead(id);
        // Update cache
        lead.account_created = true;
        renderLeads(_leadsCache);
        updateLeadsBadge(_leadsCache.filter(l => !l.account_created).length);

        // Show credentials modal
        _leadCredsData = {
            phone:    lead.phone,
            fullName: lead.full_name,
            bizName:  lead.business_name,
            username: result.user.username,
            password: result.temporaryPassword,
            plan:     PLAN_LABELS[lead.plan] || lead.plan
        };

        const display = document.getElementById('leadCredsDisplay');
        if (display) {
            display.innerHTML = `
                <div class="credentials-item"><span class="credentials-label">Negocio</span><span class="credentials-value">${escapeHtml(lead.business_name)}</span></div>
                <div class="credentials-item"><span class="credentials-label">Plan</span><span class="credentials-value">${escapeHtml(PLAN_LABELS[lead.plan] || lead.plan)}</span></div>
                <div class="credentials-item"><span class="credentials-label">Usuario</span><span class="credentials-value">${escapeHtml(result.user.username)}</span></div>
                <div class="credentials-item"><span class="credentials-label">Contraseña</span><span class="credentials-value">${escapeHtml(result.temporaryPassword)}</span></div>
            `;
        }
        document.getElementById('leadCredsModal').style.display = 'flex';

        // Also reload admin users list so new user appears
        loadAdminUsers();
    } catch (err) {
        if (btn) { btn.disabled = false; btn.textContent = 'Crear cuenta'; }
        alert('Error: ' + err.message);
    }
}

function openLeadWA() {
    if (!_leadCredsData) return;
    const d = _leadCredsData;
    const loginLink = generateLoginLink(d.username, d.password);
    const msg = encodeURIComponent(
        `Hola ${d.fullName}! 🎉 Tu cuenta de Vendix está lista.\n\n` +
        `🏪 Negocio: ${d.bizName}\n` +
        `📦 Plan: ${d.plan}\n` +
        `👤 Usuario: ${d.username}\n` +
        `🔑 Contraseña: ${d.password}\n\n` +
        `🔗 Ingresa aquí con un clic:\n${loginLink}\n\n` +
        `(Cambia tu contraseña al ingresar por primera vez)`
    );
    const phone = d.phone.replace(/\D/g, '');
    const number = phone.startsWith('51') ? phone : '51' + phone;
    window.open(`https://wa.me/${number}?text=${msg}`, '_blank');
}
