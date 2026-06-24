// ═══════════════════════════════════════════════════════════════════════════════
// API Client — reemplaza data.js
// Todas las funciones son async y hacen fetch() al backend Express/Neon.
// ═══════════════════════════════════════════════════════════════════════════════

const API_BASE = '/api';

// ─── Skeleton loaders (evitan el "flash vacío" mientras carga la data) ────────
// Filas shimmer para tablas
function skeletonRows(cols, rows = 6) {
    const td = `<td><div class="sk-row"></div></td>`.repeat(cols);
    return Array.from({ length: rows }, () => `<tr class="sk-tr">${td}</tr>`).join('');
}
// Tarjetas shimmer para grids (productos, etc.)
function skeletonCards(n = 8) {
    return Array.from({ length: n }, () => `<div class="sk-card"></div>`).join('');
}
// Pone un valor "cargando" suave en una tarjeta de stat
function skeletonStats(...ids) {
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<span class="sk-inline"></span>';
    });
}

// ─── DB warm-up — ping on load + every 4 min to keep Neon awake ──────────────
(function warmUp() {
    const ping = () => fetch('/api/health', { method: 'GET' }).catch(() => {});
    ping();
    setInterval(ping, 4 * 60 * 1000);
})();

// ─── In-memory response cache (15s TTL for GET requests) ─────────────────────
const _cache = new Map();
const CACHE_TTL = 15000;

function _getCached(key) {
    const e = _cache.get(key);
    if (!e) return null;
    if (Date.now() - e.ts > CACHE_TTL) { _cache.delete(key); return null; }
    return e.data;
}
function _setCached(key, data) { _cache.set(key, { data, ts: Date.now() }); }
function _bust(...prefixes) {
    for (const k of _cache.keys()) {
        if (prefixes.some(p => k.startsWith('GET:' + p) || k.startsWith(p))) _cache.delete(k);
    }
}

// ─── Token management ─────────────────────────────────────────────────────────
function getToken() {
    return localStorage.getItem('authToken');
}

function setToken(token) {
    localStorage.setItem('authToken', token);
}

function clearToken() {
    localStorage.removeItem('authToken');
}

function authHeaders() {
    const token = getToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const cacheKey = `${method}:${path}`;

    // Serve GET from cache when available
    if (method === 'GET') {
        const cached = _getCached(cacheKey);
        if (cached !== null) return cached;
    }

    const res = await fetch(`${API_BASE}${path}`, {
        headers: {
            'Content-Type': 'application/json',
            ...authHeaders(),
            ...options.headers
        },
        ...options,
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (res.status === 401) {
        const data401 = await res.json().catch(() => ({}));
        clearToken();
        if (data401.error === 'account_deleted') {
            window.location.href = 'account-deleted.html';
        } else {
            window.location.href = 'login.html';
        }
        return null;
    }

    if (res.status === 403) {
        const data403 = await res.json().catch(() => ({}));
        if (data403.error === 'trial_expired') {
            window.location.href = 'trial-expired.html';
            return null;
        }
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
    }

    if (method === 'GET') _setCached(cacheKey, data);
    return data;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
async function apiLogin(username, password) {
    const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: { username, password }
    });
    if (data && data.token) {
        setToken(data.token);
        return data.user;
    }
    return null;
}

async function apiLogout() {
    clearToken();
    sessionStorage.clear();
}

// ─── Products ─────────────────────────────────────────────────────────────────
async function getProducts(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return apiFetch(`/products${params ? '?' + params : ''}`);
}

async function getProductById(id) {
    return apiFetch(`/products/${id}`);
}

async function addProduct(product) {
    const r = await apiFetch('/products', { method: 'POST', body: product });
    _bust('/products', '/products/stats', '/products/filters');
    return r;
}

async function updateProduct(id, product) {
    const r = await apiFetch(`/products/${id}`, { method: 'PUT', body: product });
    _bust('/products', '/products/stats', '/products/filters');
    return r;
}

async function deleteProduct(id) {
    const r = await apiFetch(`/products/${id}`, { method: 'DELETE' });
    _bust('/products', '/products/stats', '/products/filters');
    return r;
}

async function getProductStats() {
    return apiFetch('/products/stats');
}

async function getProductFilters() {
    return apiFetch('/products/filters');
}

async function getProductByBarcode(code) {
    return apiFetch(`/products/barcode/${encodeURIComponent(code)}`);
}

async function generateBarcode() {
    return apiFetch('/products/generate-barcode');
}

// ─── Sellers ──────────────────────────────────────────────────────────────────
async function getSellers(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return apiFetch(`/sellers${params ? '?' + params : ''}`);
}

async function getSellerById(id) {
    return apiFetch(`/sellers/${id}`);
}

async function addSeller(seller) {
    const r = await apiFetch('/sellers', { method: 'POST', body: seller });
    _bust('/sellers');
    return r;
}

async function updateSeller(id, seller) {
    const r = await apiFetch(`/sellers/${id}`, { method: 'PUT', body: seller });
    _bust('/sellers');
    return r;
}

async function deleteSeller(id) {
    const r = await apiFetch(`/sellers/${id}`, { method: 'DELETE' });
    _bust('/sellers');
    return r;
}

async function resetSellerPassword(id) {
    return apiFetch(`/sellers/${id}/reset-password`, { method: 'POST' });
}

async function getSellerStats() {
    return apiFetch('/sellers/stats');
}

// ─── Transactions ─────────────────────────────────────────────────────────────
async function getTransactions(limit) {
    const qs = limit ? `?limit=${limit}` : '';
    return apiFetch(`/transactions${qs}`);
}

async function getTransactionStats() {
    return apiFetch('/transactions/stats');
}

async function getRecentTransactions(limit = 5) {
    return apiFetch(`/transactions/recent?limit=${limit}`);
}

async function addTransaction(transaction) {
    const r = await apiFetch('/transactions', { method: 'POST', body: transaction });
    _bust('/transactions', '/products');
    return r;
}

// ─── Users (Super Admin) ──────────────────────────────────────────────────────
async function getAdminUsers(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return apiFetch(`/users${params ? '?' + params : ''}`);
}

async function getAdminUserById(id) {
    return apiFetch(`/users/${id}/profile`);
}

async function createAdminUserWithBusiness(data) {
    const r = await apiFetch('/users', { method: 'POST', body: data });
    _bust('/users');
    return r;
}

async function updateAdminUser(id, data) {
    const r = await apiFetch(`/users/${id}`, { method: 'PUT', body: data });
    _bust('/users');
    return r;
}

async function deleteAdminUser(id) {
    const r = await apiFetch(`/users/${id}`, { method: 'DELETE' });
    _bust('/users');
    return r;
}

async function toggleAdminUserStatus(id) {
    const r = await apiFetch(`/users/${id}/toggle-status`, { method: 'PATCH' });
    _bust('/users');
    return r;
}

async function resetAdminPassword(id) {
    return apiFetch(`/users/${id}/reset-password`, { method: 'POST' });
}

async function markUserPaid(id) {
    const r = await apiFetch(`/users/${id}/mark-paid`, { method: 'PATCH' });
    _bust('/users');
    return r;
}

async function extendUserTrial(id, days = 7) {
    const r = await apiFetch(`/users/${id}/extend-trial`, { method: 'PATCH', body: { days } });
    _bust('/users');
    return r;
}

async function getUserStats() {
    return apiFetch('/users/stats');
}

// ─── Settings ─────────────────────────────────────────────────────────────────
async function getSettings() {
    return apiFetch('/settings');
}

async function saveSettings(data) {
    return apiFetch('/settings', { method: 'PUT', body: data });
}

// ─── Tax / IGV ────────────────────────────────────────────────────────────────
async function getTaxSettings() {
    return apiFetch('/tax');
}

async function saveTaxSettings(data) {
    const r = await apiFetch('/tax', { method: 'PUT', body: data });
    _bust('/tax');
    return r;
}

// ─── Leads (SuperAdmin) ───────────────────────────────────────────────────────
async function getLeads() {
    return apiFetch('/leads');
}

async function getLeadsCount() {
    return apiFetch('/leads/count');
}

async function markLeadPaid(id) {
    const r = await apiFetch(`/leads/${id}/mark-paid`, { method: 'PATCH' });
    _bust('/leads');
    return r;
}

async function saveLeadNotes(id, notes) {
    const r = await apiFetch(`/leads/${id}/notes`, { method: 'PATCH', body: { notes } });
    _bust('/leads');
    return r;
}

async function createAccountFromLead(id) {
    const r = await apiFetch(`/leads/${id}/create-account`, { method: 'POST' });
    _bust('/leads', '/users');
    return r;
}

// ─── Password generator (client-side, same as before) ─────────────────────────
function generatePassword(length = 12) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
    let pw = '';
    for (let i = 0; i < length; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    return pw;
}

// ─── Login link helper ────────────────────────────────────────────────────────
function generateLoginLink(username, password) {
    const token = btoa(JSON.stringify({ u: username, p: password }));
    const base  = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
    return `${base}login.html?auto=${token}`;
}
