// Settings Page — async API version

function showToast(msg, isError = false) {
    const el  = document.getElementById(isError ? 'toastError' : 'toast');
    const txt = document.getElementById(isError ? 'toastErrorMsg' : 'toastMsg');
    if (!el || !txt) return;
    txt.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 3200);
}

function setFieldError(id, msg) {
    const el = document.getElementById(id);
    if (el) el.textContent = msg;
}

function clearFieldErrors(...ids) { ids.forEach(id => setFieldError(id, '')); }

function checkStrength(pw) {
    let s = 0;
    if (pw.length >= 8) s++;
    if (pw.length >= 12) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s;
}

document.getElementById('newPassword').addEventListener('input', function () {
    const pw    = this.value;
    const score = checkStrength(pw);
    const fill  = document.getElementById('strengthFill');
    const label = document.getElementById('strengthLabel');
    const meter = document.getElementById('strengthMeter');
    if (!pw) { meter.style.display = 'none'; return; }
    meter.style.display = 'flex';
    const pct    = (score / 5) * 100;
    const colors = ['#ef4444','#f97316','#f59e0b','#3b82f6','#10b981'];
    const labels = ['Very weak','Weak','Fair','Strong','Very strong'];
    fill.style.width      = pct + '%';
    fill.style.background = colors[Math.min(score, 4)];
    label.textContent     = labels[Math.min(score, 4)];
    label.style.color     = colors[Math.min(score, 4)];
});

document.querySelectorAll('.pw-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
        const input  = document.getElementById(btn.dataset.target);
        const isText = input.type === 'text';
        input.type   = isText ? 'password' : 'text';
        btn.querySelector('.eye-on').style.display  = isText ? '' : 'none';
        btn.querySelector('.eye-off').style.display = isText ? 'none' : '';
    });
});

document.querySelectorAll('.settings-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
    });
});

function loadUserData() {
    const user = getCurrentUser();
    if (!user) return;
    updateUserProfile(user);
    const initials = (user.fullName || '').split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2);
    document.getElementById('bigAvatar').textContent = initials || '?';
    document.getElementById('bigName').textContent   = user.fullName || '—';
    document.getElementById('bigRole').textContent   = user.role     || '—';
    document.getElementById('fullName').value        = user.fullName || '';
    document.getElementById('currentUsernameDisplay').value = user.username || '';

    const grid = document.getElementById('accountInfoGrid');
    grid.innerHTML = [
        ['Full Name',   user.fullName   || '—'],
        ['Username',    user.username   || '—'],
        ['Role',        user.role       || '—'],
        ['Business ID', user.businessId || 'N/A']
    ].map(([k, v]) => `<div class="info-row"><span class="info-key">${k}</span><span class="info-val">${v}</span></div>`).join('');

    document.getElementById('sessionInfo').innerHTML = `
        <div class="info-row"><span class="info-key">Auth</span><span class="info-val">JWT (PostgreSQL)</span></div>`;

    const clearCard = document.getElementById('clearDataCard');
    if (clearCard && isSuperAdmin()) clearCard.style.display = 'none';
}

// Profile form — update name via real API
document.getElementById('profileForm').addEventListener('submit', async e => {
    e.preventDefault();
    clearFieldErrors('fullNameError', 'emailError');
    const fullName = document.getElementById('fullName').value.trim();
    if (!fullName) { setFieldError('fullNameError', 'El nombre es obligatorio.'); return; }

    const btn = e.target.querySelector('[type=submit]');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }
    try {
        const user = getCurrentUser();
        const res  = await fetch(`/api/users/${user.sub || user.id}/profile`, {
            method:  'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body:    JSON.stringify({ fullName })
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || 'Error al guardar');
        showToast('Perfil actualizado');
    } catch (err) { showToast('Error: ' + err.message, true); }
    finally { if (btn) { btn.disabled = false; btn.textContent = 'Guardar cambios'; } }
});

// Password change via API
document.getElementById('passwordForm').addEventListener('submit', async e => {
    e.preventDefault();
    clearFieldErrors('currentPasswordError', 'newPasswordError', 'confirmPasswordError');
    const currentPw = document.getElementById('currentPassword').value;
    const newPw     = document.getElementById('newPassword').value;
    const confirmPw = document.getElementById('confirmPassword').value;
    if (!currentPw) { setFieldError('currentPasswordError', 'Enter your current password.'); return; }
    if (!newPw || newPw.length < 8) { setFieldError('newPasswordError', 'Password must be at least 8 characters.'); return; }
    if (checkStrength(newPw) < 2) { setFieldError('newPasswordError', 'Password too weak.'); return; }
    if (newPw !== confirmPw) { setFieldError('confirmPasswordError', 'Passwords do not match.'); return; }

    try {
        const changeRes = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw })
        });
        const body = await changeRes.json();
        if (!changeRes.ok) {
            if (body.error && body.error.toLowerCase().includes('current')) {
                setFieldError('currentPasswordError', body.error);
            } else {
                throw new Error(body.error || 'Could not change password');
            }
            return;
        }
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value     = '';
        document.getElementById('confirmPassword').value = '';
        document.getElementById('strengthMeter').style.display = 'none';
        showToast('Password changed! Please log in again.');
        setTimeout(() => logout(), 2000);
    } catch (err) { showToast('Error: ' + err.message, true); }
});

// Username form — contact admin to change; show info message and hide the form
const usernameForm = document.getElementById('usernameForm');
if (usernameForm) {
    usernameForm.style.display = 'none';
    const note = document.createElement('p');
    note.style.cssText = 'color:var(--text-2);font-size:13px;margin:8px 0 0;';
    note.textContent = 'Para cambiar tu usuario, contacta a un Super Administrador.';
    usernameForm.parentNode.insertBefore(note, usernameForm.nextSibling);
}

// ─── Theme ────────────────────────────────────────────────────────────────────
function setTheme(t) {
    localStorage.setItem('theme', t);
    // :root IS the dark theme; [data-theme="light"] overrides to white
    if (t === 'light') document.documentElement.setAttribute('data-theme', 'light');
    else               document.documentElement.removeAttribute('data-theme');
    document.getElementById('themeLight').classList.toggle('active', t === 'light');
    document.getElementById('themeDark').classList.toggle('active',  t === 'dark');
    saveSettings({ theme: t }).catch(() => {});
}

const accentMap = {
    indigo:  { p: '#00C864', dark: '#059669', light: '#34D399' },  // Verde (brand default)
    blue:    { p: '#3b82f6', dark: '#2563eb', light: '#60a5fa' },
    violet:  { p: '#8b5cf6', dark: '#7c3aed', light: '#a78bfa' },
    rose:    { p: '#f43f5e', dark: '#e11d48', light: '#fb7185' },
    emerald: { p: '#10b981', dark: '#059669', light: '#34d399' },
    amber:   { p: '#f59e0b', dark: '#d97706', light: '#fbbf24' }
};

function applyAccent(name) {
    const c = accentMap[name];
    if (!c) return;
    const r = document.documentElement.style;
    r.setProperty('--primary',       c.p);
    r.setProperty('--primary-dark',  c.dark);
    r.setProperty('--primary-light', c.light);
    r.setProperty('--primary-color', c.p);
    localStorage.setItem('accent', name);
    document.querySelectorAll('.accent-swatch').forEach(s => s.classList.toggle('active', s.dataset.color === name));
    saveSettings({ accent: name }).catch(() => {});
}

document.querySelectorAll('.accent-swatch').forEach(s => s.addEventListener('click', () => applyAccent(s.dataset.color)));

function toggleCompact() {
    const sidebar = document.getElementById('sidebar');
    const toggler = document.getElementById('compactToggle');
    const isCompact = sidebar.classList.toggle('compact');
    toggler.classList.toggle('on', isCompact);
    localStorage.setItem('compactSidebar', isCompact ? '1' : '0');
    saveSettings({ compactSidebar: isCompact ? '1' : '0' }).catch(() => {});
}

function logoutAll() { if (confirm('Log out?')) logout(); }

let _pendingAction = null;
function openConfirmModal(title, message, word, action) {
    document.getElementById('confirmTitle').textContent   = title;
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmWord').textContent    = word;
    document.getElementById('confirmInput').value        = '';
    document.getElementById('confirmActionBtn').disabled = true;
    _pendingAction = action;
    document.getElementById('confirmModal').classList.add('show');
}
function closeConfirmModal() { document.getElementById('confirmModal').classList.remove('show'); _pendingAction = null; }
function executeConfirmAction() { if (_pendingAction) _pendingAction(); closeConfirmModal(); }

document.getElementById('confirmInput').addEventListener('input', function () {
    const word = document.getElementById('confirmWord').textContent;
    document.getElementById('confirmActionBtn').disabled = (this.value !== word);
});

function confirmClearData() {
    openConfirmModal('Clear all business data', 'This permanently deletes ALL products, transactions and sellers. Cannot be undone.', 'DELETE', async () => {
        showToast('Clear data is handled by your admin.', true);
    });
}

function applyStoredPreferences() {
    const savedTheme  = localStorage.getItem('theme') || 'dark';
    document.getElementById('themeLight').classList.toggle('active', savedTheme === 'light');
    document.getElementById('themeDark').classList.toggle('active',  savedTheme === 'dark');
    const savedAccent = localStorage.getItem('accent') || 'indigo';
    applyAccent(savedAccent);
    const isCompact = localStorage.getItem('compactSidebar') === '1';
    if (isCompact) {
        document.getElementById('sidebar').classList.add('compact');
        const tog = document.getElementById('compactToggle');
        if (tog) tog.classList.add('on');
    }
}

// Load settings from DB and sync to localStorage
async function syncSettingsFromDB() {
    try {
        const s = await getSettings();
        if (s.theme)         localStorage.setItem('theme', s.theme);
        if (s.accent)        localStorage.setItem('accent', s.accent);
        if (s.compactSidebar) localStorage.setItem('compactSidebar', s.compactSidebar);
    } catch { /* offline — use localStorage */ }
}

// ── IGV Settings ─────────────────────────────────────────────────────────────
let _igvEnabled = false;

function applyIgvUI(enabled, rate) {
    _igvEnabled = enabled;
    const toggle   = document.getElementById('igvToggle');
    const rateRow  = document.getElementById('igvRateRow');
    const rateInput = document.getElementById('igvRate');
    if (!toggle) return;
    toggle.classList.toggle('on', enabled);
    rateRow.style.display = enabled ? 'block' : 'none';
    if (rateInput && rate != null) rateInput.value = rate;
}

async function loadIgvSettings() {
    try {
        const data = await getTaxSettings();
        applyIgvUI(!!data.igv_enabled, data.igv_rate ?? 18);
    } catch { applyIgvUI(false, 18); }
}

window.toggleIgv = async function() {
    const toggle = document.getElementById('igvToggle');
    if (!toggle) return;
    const newEnabled = !_igvEnabled;
    const rateInput  = document.getElementById('igvRate');
    const rate = rateInput ? parseFloat(rateInput.value) || 18 : 18;
    try {
        await saveTaxSettings({ igv_enabled: newEnabled, igv_rate: rate });
        applyIgvUI(newEnabled, rate);
        showToast(newEnabled ? 'IGV activado' : 'IGV desactivado');
    } catch { showToast('Error al guardar', true); }
};

window.saveIgvSettings = async function() {
    const rateInput = document.getElementById('igvRate');
    const btn       = document.getElementById('igvSaveBtn');
    if (!rateInput) return;
    const val = parseFloat(rateInput.value);
    if (isNaN(val) || val < 0 || val > 100) {
        showToast('Tasa inválida (0–100)', true); return;
    }
    if (btn) btn.disabled = true;
    try {
        await saveTaxSettings({ igv_enabled: _igvEnabled, igv_rate: val });
        showToast('IGV ' + val + '% guardado');
    } catch { showToast('Error al guardar', true); }
    finally { if (btn) btn.disabled = false; }
};

const _settingsUser = initPage({ requireStore: false });
if (_settingsUser) {
    loadUserData();
    applyStoredPreferences();
    syncSettingsFromDB();

    // Show Ventas tab + load IGV only for business admins
    if (isBusinessAdmin() || isSuperAdmin()) {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');
        loadIgvSettings();
    }
}
