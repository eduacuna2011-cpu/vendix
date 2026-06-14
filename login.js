// DOM Elements
const loginForm         = document.getElementById('loginForm');
const usernameInput     = document.getElementById('username');
const passwordInput     = document.getElementById('password');
const togglePassword    = document.getElementById('togglePassword');
const rememberMeCheckbox = document.getElementById('rememberMe');
const loginBtn          = document.getElementById('loginBtn');
const errorBanner       = document.getElementById('errorBanner');
const usernameError     = document.getElementById('usernameError');
const passwordError     = document.getElementById('passwordError');

// Show/Hide Password
togglePassword.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    passwordInput.parentElement.classList.toggle('show-password', !isPassword);
});

function clearErrors() {
    usernameError.textContent = '';
    passwordError.textContent = '';
    errorBanner.classList.remove('show');
    errorBanner.innerHTML = '';
    usernameInput.parentElement.classList.remove('shake');
    passwordInput.parentElement.classList.remove('shake');
}

function showError(message, field = null) {
    if (field === 'username') {
        usernameError.textContent = message;
        usernameInput.parentElement.classList.add('shake');
        setTimeout(() => usernameInput.parentElement.classList.remove('shake'), 500);
    } else if (field === 'password') {
        passwordError.textContent = message;
        passwordInput.parentElement.classList.add('shake');
        setTimeout(() => passwordInput.parentElement.classList.remove('shake'), 500);
    } else {
        errorBanner.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span>${message}</span>`;
        errorBanner.classList.add('show');
    }
}

function validateForm() {
    let ok = true;
    clearErrors();
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    if (!username) { showError('Username is required', 'username'); ok = false; }
    else if (username.length < 3) { showError('Username must be at least 3 characters', 'username'); ok = false; }
    if (!password) { showError('Password is required', 'password'); ok = false; }
    else if (password.length < 6) { showError('Password must be at least 6 characters', 'password'); ok = false; }
    return ok;
}

// Handle login via API
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const username   = usernameInput.value.trim();
    const password   = passwordInput.value;
    const rememberMe = rememberMeCheckbox.checked;

    loginBtn.disabled = true;
    loginBtn.classList.add('loading');

    try {
        const res  = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (!res.ok) {
            showError(data.error || 'Invalid username or password');
            return;
        }

        // Store token
        localStorage.setItem('authToken', data.token);
        if (rememberMe) localStorage.setItem('rememberedUsername', username);
        else            localStorage.removeItem('rememberedUsername');

        const user = data.user;
        window.location.href = user.role === 'Super Admin' ? 'users.html' : 'index.html';
    } catch (err) {
        showError('Connection error. Please try again.');
    } finally {
        loginBtn.disabled = false;
        loginBtn.classList.remove('loading');
    }
});

// Check for existing valid token
function checkExistingSession() {
    const token = localStorage.getItem('authToken');
    if (!token) return;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp && Date.now() / 1000 > payload.exp) {
            localStorage.removeItem('authToken');
            return;
        }
        window.location.href = payload.role === 'Super Admin' ? 'users.html' : 'index.html';
    } catch {
        localStorage.removeItem('authToken');
    }
}

function autoFillRemembered() {
    const remembered = localStorage.getItem('rememberedUsername');
    if (remembered) { usernameInput.value = remembered; rememberMeCheckbox.checked = true; }
}

// Auto-login from magic link (?auto=BASE64TOKEN)
async function tryAutoLogin() {
    const params = new URLSearchParams(window.location.search);
    const token  = params.get('auto');
    if (!token) return false;
    let creds;
    try { creds = JSON.parse(atob(token)); } catch { return false; }
    if (!creds || !creds.u || !creds.p) return false;

    try {
        const res  = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: creds.u, password: creds.p })
        });
        const data = await res.json();
        if (!res.ok) return false;

        localStorage.setItem('authToken', data.token);
        sessionStorage.setItem('welcomeCredentials', JSON.stringify({
            fullName: data.user.fullName,
            username: creds.u,
            password: creds.p
        }));
        document.documentElement.style.visibility = '';
        window.location.href = data.user.role === 'Super Admin' ? 'users.html' : 'index.html';
        return true;
    } catch { return false; }
}

// Initialize
(async () => {
    const didAutoLogin = await tryAutoLogin();
    if (!didAutoLogin) {
        document.documentElement.style.visibility = '';
        checkExistingSession();
        autoFillRemembered();
    }
})();

usernameInput.addEventListener('input', clearErrors);
passwordInput.addEventListener('input', clearErrors);
