// ── Guard: SA only ────────────────────────────────────────────────
const _saUser = getCurrentUser();
if (!_saUser) {
    window.location.href = 'login.html';
} else if (!isSuperAdmin()) {
    window.location.href = 'index.html';
} else {
    applyStoredTheme();
    updateUserProfile(_saUser);
    initSidebar();
    initUserProfileLogout();
    boot();
}

// ── Helpers ───────────────────────────────────────────────────────
function toast(msg, err = false) {
    const el  = document.getElementById(err ? 'toastError' : 'toast');
    const txt = document.getElementById(err ? 'toastErrorMsg' : 'toastMsg');
    txt.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 3200);
}

function setErr(id, msg) { const el = document.getElementById(id); if (el) el.textContent = msg; }
function clearErrs(...ids) { ids.forEach(id => setErr(id, '')); }

// ── Password strength ─────────────────────────────────────────────
function checkStrength(pw) {
    let s = 0;
    if (pw.length >= 8)  s++;
    if (pw.length >= 12) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s;
}

document.getElementById('newPassword').addEventListener('input', function () {
    const meter = document.getElementById('strengthMeter');
    const fill  = document.getElementById('strengthFill');
    const label = document.getElementById('strengthLabel');
    if (!this.value) { meter.style.display = 'none'; return; }
    meter.style.display = 'flex';
    const s = checkStrength(this.value);
    const colors = ['#ef4444','#f97316','#f59e0b','#3b82f6','#10b981'];
    const labels = ['Very weak','Weak','Fair','Strong','Very strong'];
    fill.style.width      = (s / 5 * 100) + '%';
    fill.style.background = colors[Math.min(s, 4)];
    label.textContent     = labels[Math.min(s, 4)];
    label.style.color     = colors[Math.min(s, 4)];
});

// ── Show/hide password toggles ────────────────────────────────────
document.querySelectorAll('.sa-pw-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
        const inp = document.getElementById(btn.dataset.target);
        const isText = inp.type === 'text';
        inp.type = isText ? 'password' : 'text';
        btn.querySelector('.eye-on').style.display  = isText ? '' : 'none';
        btn.querySelector('.eye-off').style.display = isText ? 'none' : '';
    });
});

// ── Tab navigation ────────────────────────────────────────────────
document.querySelectorAll('.sa-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.sa-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.sa-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
    });
});

// ── Boot ──────────────────────────────────────────────────────────
function boot() {
    loadProfile();
}

// ── Load profile ──────────────────────────────────────────────────
async function loadProfile() {
    const user = getCurrentUser();

    const ini = (user.fullName || 'SA')
        .split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2);

    document.getElementById('heroAvatar').textContent = ini;
    document.getElementById('heroName').textContent   = user.fullName || 'Super Administrator';
    document.getElementById('fullName').value         = user.fullName || '';
    document.getElementById('saEmail').value          = user.email || '';
    document.getElementById('currentUsernameDisplay').value = user.username || 'superadmin';
    document.getElementById('identityAvatar').textContent   = ini;
    document.getElementById('idUsername').textContent       = user.username || 'superadmin';
    document.getElementById('idSession').textContent        = formatDate(
        user.loginTime || (user.iat ? user.iat * 1000 : Date.now()), true
    );

    updateUserProfile(user);

    try {
        const [userStats, sellerStats, txStats] = await Promise.all([
            getUserStats(),
            getSellerStats(),
            getTransactionStats()
        ]);
        document.getElementById('hsTotalBiz').textContent   = userStats?.totalBusinesses || 0;
        document.getElementById('hsTotalUsers').textContent =
            (userStats?.totalBusinesses || 0) + (sellerStats?.totalSellers || 0);
        document.getElementById('hsTotalTx').textContent    = txStats?.totalOrders || 0;
    } catch (e) {
        console.warn('Stats load error', e);
    }
}

// ── Profile form ──────────────────────────────────────────────────
document.getElementById('profileForm').addEventListener('submit', async e => {
    e.preventDefault();
    clearErrs('fullNameError', 'emailError');

    const fullName = document.getElementById('fullName').value.trim();
    const email    = document.getElementById('saEmail').value.trim();

    if (!fullName) { setErr('fullNameError', 'Full name is required.'); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setErr('emailError', 'Enter a valid email.'); return;
    }

    try {
        await apiFetch('/auth/profile', { method: 'PUT', body: { fullName, email } });
        toast('Profile updated!');
        loadProfile();
    } catch (err) {
        toast(err.message || 'Failed to update profile.', true);
    }
});

// ── Username form ─────────────────────────────────────────────────
document.getElementById('usernameForm').addEventListener('submit', async e => {
    e.preventDefault();
    clearErrs('newUsernameError', 'usernameConfirmError');

    const newU  = document.getElementById('newUsername').value.trim();
    const confP = document.getElementById('usernameConfirmPassword').value;

    if (!newU || newU.length < 3) { setErr('newUsernameError', 'At least 3 characters.'); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(newU)) { setErr('newUsernameError', 'Letters, numbers, underscores only.'); return; }
    if (!confP) { setErr('usernameConfirmError', 'Enter your current password.'); return; }

    try {
        await apiFetch('/auth/change-username', { method: 'POST', body: { newUsername: newU, currentPassword: confP } });
        document.getElementById('currentUsernameDisplay').value = newU;
        document.getElementById('newUsername').value            = '';
        document.getElementById('usernameConfirmPassword').value = '';
        toast('Username updated! Logging out...');
        setTimeout(() => logout(), 2000);
    } catch (err) {
        if (err.message && err.message.toLowerCase().includes('password')) {
            setErr('usernameConfirmError', err.message);
        } else {
            setErr('newUsernameError', err.message || 'Failed to update username.');
        }
    }
});

// ── Password form ─────────────────────────────────────────────────
document.getElementById('passwordForm').addEventListener('submit', async e => {
    e.preventDefault();
    clearErrs('currentPasswordError', 'newPasswordError', 'confirmPasswordError');

    const curP  = document.getElementById('currentPassword').value;
    const newP  = document.getElementById('newPassword').value;
    const confP = document.getElementById('confirmPassword').value;

    if (!curP) { setErr('currentPasswordError', 'Enter current password.'); return; }
    if (!newP || newP.length < 8) { setErr('newPasswordError', 'At least 8 characters.'); return; }
    if (checkStrength(newP) < 2) { setErr('newPasswordError', 'Too weak — add uppercase, numbers or symbols.'); return; }
    if (newP !== confP) { setErr('confirmPasswordError', 'Passwords do not match.'); return; }

    try {
        await apiFetch('/auth/change-password', { method: 'POST', body: { currentPassword: curP, newPassword: newP } });
        document.getElementById('currentPassword').value       = '';
        document.getElementById('newPassword').value           = '';
        document.getElementById('confirmPassword').value       = '';
        document.getElementById('strengthMeter').style.display = 'none';
        toast('Password changed successfully!');
    } catch (err) {
        setErr('currentPasswordError', err.message || 'Failed to change password.');
    }
});

// ── Danger: confirm modal ─────────────────────────────────────────
let _pendingAction = null;

const dangerConfig = {
    'wipe-transactions': {
        title: 'Wipe All Transactions',
        message: 'This will permanently delete every transaction across ALL businesses. This cannot be undone.',
        word: 'WIPE',
        action: async () => {
            await apiFetch('/transactions/wipe-all', { method: 'DELETE' });
            toast('All transactions wiped.');
        }
    },
    'wipe-products': {
        title: 'Wipe All Products',
        message: 'This will permanently delete every product in every business. This cannot be undone.',
        word: 'WIPE',
        action: async () => {
            await apiFetch('/products/wipe-all', { method: 'DELETE' });
            toast('All products wiped.');
        }
    },
    'factory-reset': {
        title: 'Factory Reset Platform',
        message: 'This will delete ALL businesses, admins, sellers, products and transactions. The platform will return to its initial empty state.',
        word: 'RESET',
        action: async () => {
            await apiFetch('/users/factory-reset', { method: 'DELETE' });
            toast('Platform factory reset complete. Redirecting...');
            setTimeout(() => window.location.href = 'users.html', 1800);
        }
    }
};

function openConfirm(key) {
    const cfg = dangerConfig[key];
    if (!cfg) return;
    document.getElementById('confirmTitle').textContent   = cfg.title;
    document.getElementById('confirmMessage').textContent = cfg.message;
    document.getElementById('confirmWord').textContent    = cfg.word;
    document.getElementById('confirmInput').value         = '';
    document.getElementById('confirmActionBtn').disabled  = true;
    _pendingAction = cfg.action;
    document.getElementById('confirmModal').classList.add('show');
}

function closeConfirm() {
    document.getElementById('confirmModal').classList.remove('show');
    _pendingAction = null;
}

async function executeConfirm() {
    if (_pendingAction) {
        try {
            await _pendingAction();
        } catch (err) {
            toast(err.message || 'Action failed.', true);
        }
    }
    closeConfirm();
}

document.getElementById('confirmInput').addEventListener('input', function () {
    const word = document.getElementById('confirmWord').textContent;
    document.getElementById('confirmActionBtn').disabled = this.value !== word;
});

document.getElementById('confirmModal').addEventListener('click', function (e) {
    if (e.target === this) closeConfirm();
});

function logoutAll() {
    if (confirm('Log out from all sessions?')) logout();
}
