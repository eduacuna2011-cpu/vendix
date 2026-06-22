// Settings Page

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
    if (pw.length >= 8)  s++;
    if (pw.length >= 12) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s;
}

// Password strength meter
document.getElementById('newPassword')?.addEventListener('input', function () {
    const pw    = this.value;
    const score = checkStrength(pw);
    const fill  = document.getElementById('strengthFill');
    const label = document.getElementById('strengthLabel');
    const meter = document.getElementById('strengthMeter');
    if (!pw) { meter.style.display = 'none'; return; }
    meter.style.display = 'flex';
    const pct    = (score / 5) * 100;
    const colors = ['#ef4444','#f97316','#f59e0b','#3b82f6','#10b981'];
    const labels = ['Muy debil','Debil','Regular','Fuerte','Muy fuerte'];
    fill.style.width      = pct + '%';
    fill.style.background = colors[Math.min(score, 4)];
    label.textContent     = labels[Math.min(score, 4)];
    label.style.color     = colors[Math.min(score, 4)];
});

// Password visibility toggles
document.querySelectorAll('.pw-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
        const input  = document.getElementById(btn.dataset.target);
        if (!input) return;
        const isText = input.type === 'text';
        input.type   = isText ? 'password' : 'text';
        btn.querySelector('.eye-on').style.display  = isText ? '' : 'none';
        btn.querySelector('.eye-off').style.display = isText ? 'none' : '';
    });
});

// Tab switching
document.querySelectorAll('.settings-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const panel = document.getElementById('panel-' + tab.dataset.tab);
        if (panel) panel.classList.add('active');
    });
});

function loadUserData() {
    const user = getCurrentUser();
    if (!user) return;
    updateUserProfile(user);
    const initials = (user.fullName || '').split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2);
    document.getElementById('bigAvatar').textContent = initials || (user.username || '?')[0].toUpperCase();
    document.getElementById('bigName').textContent   = user.fullName || user.username || '—';
    document.getElementById('bigRole').textContent   = user.role     || '—';
    document.getElementById('fullName').value        = user.fullName || '';
    document.getElementById('email').value           = user.email    || '';
    document.getElementById('currentUsernameDisplay').value = user.username || '';

    const grid = document.getElementById('accountInfoGrid');
    if (grid) {
        grid.innerHTML = [
            ['Nombre',    user.fullName   || '—'],
            ['Usuario',   user.username   || '—'],
            ['Rol',       user.role       || '—'],
            ['Negocio ID', user.businessId || 'N/A']
        ].map(([k, v]) => `<div class="info-row"><span class="info-key">${k}</span><span class="info-val">${v}</span></div>`).join('');
    }

    const sessionInfo = document.getElementById('sessionInfo');
    if (sessionInfo) {
        sessionInfo.innerHTML = `<div class="info-row"><span class="info-key">Autenticacion</span><span class="info-val">JWT / PostgreSQL</span></div>`;
    }

    const clearCard = document.getElementById('clearDataCard');
    if (clearCard && isSuperAdmin()) clearCard.style.display = 'none';
}

// ── Profile form — PUT /api/auth/profile ──────────────────────────────────────
document.getElementById('profileForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    clearFieldErrors('fullNameError', 'emailError');
    const fullName = document.getElementById('fullName').value.trim();
    const email    = document.getElementById('email').value.trim();
    if (!fullName) { setFieldError('fullNameError', 'El nombre es obligatorio.'); return; }

    const btn = e.target.querySelector('[type=submit]');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }
    try {
        const res  = await fetch('/api/auth/profile', {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body:    JSON.stringify({ fullName, email: email || undefined })
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || 'Error al guardar');
        // Guardar el JWT nuevo para que el nombre se actualice en TODA la app (navbar, sidebar, al recargar)
        if (body.token && typeof setToken === 'function') setToken(body.token);
        // Update avatar initials live
        const initials = fullName.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2);
        document.getElementById('bigAvatar').textContent = initials || fullName[0].toUpperCase();
        document.getElementById('bigName').textContent   = fullName;
        // Refrescar el perfil del navbar/sidebar con el token nuevo
        if (typeof updateUserProfile === 'function' && typeof getCurrentUser === 'function') {
            updateUserProfile(getCurrentUser());
        }
        showToast('Perfil actualizado correctamente');
    } catch (err) { showToast('Error: ' + err.message, true); }
    finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Guardar cambios'; }
    }
});

// ── Username form — POST /api/auth/change-username ────────────────────────────
document.getElementById('usernameForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    clearFieldErrors('newUsernameError', 'usernameConfirmError');
    const newUsername = document.getElementById('newUsername').value.trim();
    const password    = document.getElementById('usernameConfirmPassword').value;

    if (!newUsername) { setFieldError('newUsernameError', 'Ingresa el nuevo usuario.'); return; }
    if (newUsername.length < 3) { setFieldError('newUsernameError', 'Minimo 3 caracteres.'); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) { setFieldError('newUsernameError', 'Solo letras, numeros y guion bajo (_).'); return; }
    if (!password) { setFieldError('usernameConfirmError', 'Ingresa tu contrasena actual.'); return; }

    const btn = e.target.querySelector('[type=submit]');
    if (btn) { btn.disabled = true; btn.textContent = 'Cambiando...'; }
    try {
        const res  = await fetch('/api/auth/change-username', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body:    JSON.stringify({ newUsername, currentPassword: password })
        });
        const body = await res.json();
        if (!res.ok) {
            const msg = body.error || 'No se pudo cambiar el usuario';
            if (msg.toLowerCase().includes('password') || msg.toLowerCase().includes('contrasena')) {
                setFieldError('usernameConfirmError', msg);
            } else {
                setFieldError('newUsernameError', msg);
            }
            return;
        }
        document.getElementById('currentUsernameDisplay').value = newUsername;
        document.getElementById('newUsername').value            = '';
        document.getElementById('usernameConfirmPassword').value = '';
        showToast('Usuario cambiado. Inicia sesion de nuevo.');
        setTimeout(() => logout(), 2000);
    } catch (err) { showToast('Error: ' + err.message, true); }
    finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Cambiar usuario'; }
    }
});

// ── Password form — POST /api/auth/change-password ───────────────────────────
document.getElementById('passwordForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    clearFieldErrors('currentPasswordError', 'newPasswordError', 'confirmPasswordError');
    const currentPw = document.getElementById('currentPassword').value;
    const newPw     = document.getElementById('newPassword').value;
    const confirmPw = document.getElementById('confirmPassword').value;
    if (!currentPw) { setFieldError('currentPasswordError', 'Ingresa tu contrasena actual.'); return; }
    if (!newPw || newPw.length < 8) { setFieldError('newPasswordError', 'Minimo 8 caracteres.'); return; }
    if (checkStrength(newPw) < 2)   { setFieldError('newPasswordError', 'Contrasena demasiado debil.'); return; }
    if (newPw !== confirmPw)         { setFieldError('confirmPasswordError', 'Las contrasenas no coinciden.'); return; }

    const btn = e.target.querySelector('[type=submit]');
    if (btn) { btn.disabled = true; btn.textContent = 'Cambiando...'; }
    try {
        const res  = await fetch('/api/auth/change-password', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body:    JSON.stringify({ currentPassword: currentPw, newPassword: newPw })
        });
        const body = await res.json();
        if (!res.ok) {
            const msg = body.error || 'No se pudo cambiar la contrasena';
            if (msg.toLowerCase().includes('current') || msg.toLowerCase().includes('actual') || msg.toLowerCase().includes('incorrect')) {
                setFieldError('currentPasswordError', 'Contrasena actual incorrecta.');
            } else {
                showToast(msg, true);
            }
            return;
        }
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value     = '';
        document.getElementById('confirmPassword').value = '';
        document.getElementById('strengthMeter').style.display = 'none';
        showToast('Contrasena cambiada. Iniciando sesion de nuevo...');
        setTimeout(() => logout(), 2000);
    } catch (err) { showToast('Error: ' + err.message, true); }
    finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Cambiar contrasena'; }
    }
});

// ── Theme ─────────────────────────────────────────────────────────────────────
function setTheme(t) {
    localStorage.setItem('theme', t);
    if (t === 'light') document.documentElement.setAttribute('data-theme', 'light');
    else               document.documentElement.removeAttribute('data-theme');
    document.getElementById('themeLight').classList.toggle('active', t === 'light');
    document.getElementById('themeDark').classList.toggle('active',  t !== 'light');
    saveSettings({ theme: t }).catch(() => {});
}

// ── Accent ────────────────────────────────────────────────────────────────────
const accentMap = {
    indigo:  { p: '#00d46a', dark: '#00a854', light: '#34d399' },
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

// ── Compact sidebar ───────────────────────────────────────────────────────────
function toggleCompact() {
    const sidebar = document.getElementById('sidebar');
    const toggler = document.getElementById('compactToggle');
    const isCompact = sidebar.classList.toggle('compact');
    if (toggler) toggler.classList.toggle('on', isCompact);
    localStorage.setItem('compactSidebar', isCompact ? '1' : '0');
    saveSettings({ compactSidebar: isCompact ? '1' : '0' }).catch(() => {});
}

// ── Danger zone ───────────────────────────────────────────────────────────────
function logoutAll() {
    openConfirmModal(
        'Cerrar sesion en todos los dispositivos',
        'Se eliminara tu sesion activa y seras redirigido al login.',
        'SALIR',
        () => logout()
    );
}

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

document.getElementById('confirmInput')?.addEventListener('input', function () {
    const word = document.getElementById('confirmWord').textContent;
    document.getElementById('confirmActionBtn').disabled = (this.value !== word);
});

function confirmClearData() {
    openConfirmModal(
        'Eliminar todos los datos del negocio',
        'Esta accion borra permanentemente TODOS los productos, transacciones y vendedores. No se puede deshacer.',
        'ELIMINAR',
        async () => {
            showToast('Esta funcion debe ser ejecutada por tu administrador.', true);
        }
    );
}

// ── Appearance init ───────────────────────────────────────────────────────────
function applyStoredPreferences() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.getElementById('themeLight')?.classList.toggle('active', savedTheme === 'light');
    document.getElementById('themeDark')?.classList.toggle('active',  savedTheme !== 'light');
    applyAccent(localStorage.getItem('accent') || 'indigo');
    const isCompact = localStorage.getItem('compactSidebar') === '1';
    if (isCompact) {
        document.getElementById('sidebar')?.classList.add('compact');
        document.getElementById('compactToggle')?.classList.add('on');
    }
}

async function syncSettingsFromDB() {
    try {
        const s = await getSettings();
        if (s.theme)          localStorage.setItem('theme', s.theme);
        if (s.accent)         localStorage.setItem('accent', s.accent);
        if (s.compactSidebar) localStorage.setItem('compactSidebar', s.compactSidebar);
    } catch { /* offline — usa localStorage */ }
}

// ── IGV ───────────────────────────────────────────────────────────────────────
let _igvEnabled = false;

function applyIgvUI(enabled, rate) {
    _igvEnabled = enabled;
    const toggle    = document.getElementById('igvToggle');
    const rateRow   = document.getElementById('igvRateRow');
    const rateInput = document.getElementById('igvRate');
    if (!toggle) return;
    toggle.classList.toggle('on', enabled);
    if (rateRow)  rateRow.style.display  = enabled ? 'block' : 'none';
    if (rateInput && rate != null) rateInput.value = rate;
}

async function loadIgvSettings() {
    try {
        const data = await getTaxSettings();
        applyIgvUI(!!data.igv_enabled, data.igv_rate ?? 18);
    } catch { applyIgvUI(false, 18); }
}

window.toggleIgv = async function() {
    const newEnabled = !_igvEnabled;
    const rateInput  = document.getElementById('igvRate');
    const rate = rateInput ? parseFloat(rateInput.value) || 18 : 18;
    try {
        await saveTaxSettings({ igv_enabled: newEnabled, igv_rate: rate });
        applyIgvUI(newEnabled, rate);
        showToast(newEnabled ? 'IGV activado' : 'IGV desactivado');
    } catch { showToast('Error al guardar IGV', true); }
};

window.saveIgvSettings = async function() {
    const rateInput = document.getElementById('igvRate');
    const btn       = document.getElementById('igvSaveBtn');
    if (!rateInput) return;
    const val = parseFloat(rateInput.value);
    if (isNaN(val) || val < 0 || val > 100) { showToast('Tasa invalida (0-100)', true); return; }
    if (btn) btn.disabled = true;
    try {
        await saveTaxSettings({ igv_enabled: _igvEnabled, igv_rate: val });
        showToast('IGV ' + val + '% guardado');
    } catch { showToast('Error al guardar', true); }
    finally { if (btn) btn.disabled = false; }
};

// ── Init ──────────────────────────────────────────────────────────────────────
const _settingsUser = initPage({ requireStore: false });
if (_settingsUser) {
    loadUserData();
    syncSettingsFromDB().then(() => {
        applyStoredPreferences();
        if (isBusinessAdmin() || isSuperAdmin()) {
            document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');
            loadIgvSettings();
        }
    });
}
