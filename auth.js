// ─── JWT session (PostgreSQL version) ─────────────────────────────────────────
function getToken() { return localStorage.getItem('authToken'); }

function getCurrentUser() {
    const token = getToken();
    if (!token) return null;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp && Date.now() / 1000 > payload.exp) {
            localStorage.removeItem('authToken');
            return null;
        }
        return payload;
    } catch { return null; }
}

function isAuthenticated() { return getCurrentUser() !== null; }

// Check if user has specific role
function hasRole(role) {
    const user = getCurrentUser();
    if (!user) return false;
    
    // Normalize role comparison (case-insensitive)
    const userRole = user.role ? user.role.toLowerCase() : '';
    const targetRole = role.toLowerCase();
    
    return userRole === targetRole;
}

// NEW ROLE HIERARCHY FOR MULTI-BUSINESS ARCHITECTURE
// Super Admin > Business Admin > Seller

// Check if user is Super Admin
function isSuperAdmin() {
    return hasRole('Super Admin') || hasRole('SuperAdmin');
}

// Check if user is Business Admin
function isBusinessAdmin() {
    return hasRole('Business Admin') || hasRole('BusinessAdmin');
}

// Check if user is Admin (legacy - includes Super Admin and Business Admin)
function isAdmin() {
    return isSuperAdmin() || isBusinessAdmin() || hasRole('Administrator') || hasRole('Admin');
}

// Check if user is Seller
function isSeller() {
    return hasRole('Seller');
}

// Check if user has permission to access business data
function canAccessBusinessData() {
    const user = getCurrentUser();
    if (!user) return false;
    
    // Super Admin can access all business data
    // Business Admin can access their own business data
    // Seller can access their own business data
    return isSuperAdmin() || isBusinessAdmin() || isSeller();
}

// Check if user can manage businesses (Super Admin only)
function canManageBusinesses() {
    return isSuperAdmin();
}

// Get current user's business ID
function getUserBusinessId() {
    const user = getCurrentUser();
    if (!user) return null;
    
    // Super Admin doesn't belong to a specific business
    if (isSuperAdmin()) return null;
    
    // Business Admin and Seller belong to a business
    return user.businessId || null;
}

// Get current user's full name
function getCurrentUserName() {
    const user = getCurrentUser();
    return user ? user.fullName : '';
}

// Get default landing page by role
function getDefaultPageForUser() {
    if (isSuperAdmin()) return 'users.html';
    return 'index.html';
}

// Block Super Admin from store pages (not a shop owner)
function requireStoreAccess() {
    if (!isAuthenticated()) {
        window.location.href = 'login.html';
        return false;
    }
    if (isSuperAdmin()) {
        const page = window.location.pathname.split('/').pop();
        // Allow Super Admin on settings page
        if (page === 'settings.html') return true;
        window.location.href = 'users.html';
        return false;
    }
    return true;
}

// Redirect if not authenticated
function requireAuth() {
    if (!isAuthenticated()) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// Redirect if not authorized for specific role
function requireRole(role) {
    if (!requireAuth()) return false;
    
    if (!hasRole(role)) {
        // Redirect to dashboard if not authorized
        window.location.href = 'index.html';
        return false;
    }
    return true;
}

// Hide/show elements based on role
function applyRoleBasedUI() {
    const user = getCurrentUser();
    if (!user) return;
    
    const isUserAdmin = (isBusinessAdmin() || hasRole('Administrator') || hasRole('Admin')) && !isSuperAdmin();
    const isUserSeller = isSeller();
    
    // Hide/show sidebar items based on role
    const adminOnlyItems = document.querySelectorAll('.admin-only');
    const sellerOnlyItems = document.querySelectorAll('.seller-only');
    
    adminOnlyItems.forEach(item => {
        if (isUserAdmin) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });

    const superAdminOnlyItems = document.querySelectorAll('.superadmin-only');
    superAdminOnlyItems.forEach(item => {
        if (isSuperAdmin()) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
    
    sellerOnlyItems.forEach(item => {
        if (isUserSeller) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
    
    // Disable admin-only buttons for sellers
    const adminOnlyButtons = document.querySelectorAll('.admin-only-btn');
    adminOnlyButtons.forEach(btn => {
        if (isUserAdmin) {
            btn.disabled = false;
            btn.style.display = '';
        } else {
            btn.disabled = true;
            btn.style.display = 'none';
        }
    });
    
    // Update user role display in navbar
    const userRoleElement = document.querySelector('.user-role');
    if (userRoleElement) {
        userRoleElement.textContent = user.role;
    }
}

// Filter data based on current user
function filterDataByUser(data, userField = 'seller') {
    const user = getCurrentUser();
    if (!user) return [];
    
    // Super Admin sees all data
    if (isSuperAdmin()) {
        return data;
    }
    
    // Business Admin sees only their business data
    if (isBusinessAdmin()) {
        const businessId = getUserBusinessId();
        if (businessId) {
            return data.filter(item => item.businessId === businessId);
        }
        return data;
    }
    
    // Sellers see only their own data
    const userName = getCurrentUserName();
    return data.filter(item => item[userField] === userName);
}

// Filter data by business ID
function filterDataByBusinessId(data, businessId) {
    if (!businessId) return data;
    return data.filter(item => item.businessId === businessId);
}

// Check if user can access specific business data
function canAccessBusinessData(businessId) {
    const user = getCurrentUser();
    if (!user) return false;
    
    // Super Admin can access all business data
    if (isSuperAdmin()) return true;
    
    // Business Admin can access their own business data
    if (isBusinessAdmin()) {
        return getUserBusinessId() === businessId;
    }
    
    // Seller can access their own business data
    if (isSeller()) {
        return getUserBusinessId() === businessId;
    }
    
    return false;
}

// Check page access and redirect if needed
function checkPageAccess() {
    const user = getCurrentUser();
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    
    const currentPage = window.location.pathname.split('/').pop();
    
    // Define page access rules
    const pageAccess = {
        'index.html': ['Business Admin', 'Administrator', 'Admin', 'Seller'],
        'inventory.html': ['Business Admin', 'Administrator', 'Admin', 'Seller'],
        'sales.html': ['Business Admin', 'Administrator', 'Admin', 'Seller'],
        'orders.html': ['Business Admin', 'Administrator', 'Admin', 'Seller'],
        'sellers.html': ['Business Admin', 'Administrator', 'Admin', 'Seller'],
        'users.html': ['Super Admin']
    };
    
    const allowedRoles = pageAccess[currentPage];
    
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        window.location.href = getDefaultPageForUser();
        return;
    }

    // Super Admin cannot access store pages
    const storePages = ['index.html', 'inventory.html', 'sales.html', 'orders.html', 'sellers.html'];
    if (storePages.includes(currentPage) && isSuperAdmin()) {
        window.location.href = 'users.html';
    }
}

// Initialize role-based UI when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (isAuthenticated()) {
        applyRoleBasedUI();
    }
});

// ─── Shared page utilities ────────────────────────────────────────────────────

// Escape HTML to prevent XSS when inserting user data into innerHTML
function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Format a date string consistently across pages
function formatDate(isoString, includeTime = false) {
    if (!isoString) return '—';
    const d = new Date(isoString);
    if (isNaN(d)) return '—';
    const datePart = d.toLocaleDateString();
    if (!includeTime) return datePart;
    return datePart + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Update the navbar user profile block
function updateUserProfile(sessionData) {
    if (!sessionData) return;
    const userNameEl  = document.querySelector('.user-name')  || document.getElementById('userName');
    const userRoleEl  = document.querySelector('.user-role')  || document.getElementById('userRole');
    const avatarEl    = document.querySelector('.avatar')     || document.getElementById('userAvatar');

    if (userNameEl)  userNameEl.textContent  = sessionData.fullName || '';
    if (userRoleEl)  userRoleEl.textContent  = sessionData.role     || '';
    if (avatarEl && sessionData.fullName) {
        avatarEl.textContent = sessionData.fullName
            .split(' ')
            .filter(Boolean)
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    }
}

function logout() {
    localStorage.removeItem('authToken');
    sessionStorage.clear();
    window.location.href = 'login.html';
}

// Wire up sidebar toggle + outside-click close (mobile)
function initSidebar() {
    const toggle  = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    if (!toggle || !sidebar) return;

    toggle.addEventListener('click', () => sidebar.classList.toggle('active'));

    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 &&
            !sidebar.contains(e.target) &&
            !toggle.contains(e.target)) {
            sidebar.classList.remove('active');
        }
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) sidebar.classList.remove('active');
    });
}

// Wire logout on user profile click
function initUserProfileLogout() {
    const profile = document.querySelector('.user-profile');
    if (!profile) return;
    profile.style.cursor = 'pointer';
    profile.title = 'Click to logout';
    profile.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm('Are you sure you want to logout?')) logout();
    });
}

// Failsafe: if page-ready never gets added (auth error, etc), show body after 800ms
setTimeout(() => document.body.classList.add('page-ready'), 800);

// Restore theme and accent preferences saved from Settings page
function applyStoredTheme() {
    const theme = localStorage.getItem('theme');
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
    // Trigger fade-in only after theme is applied — prevents white flash
    requestAnimationFrame(() => document.body.classList.add('page-ready'));
    const accent = localStorage.getItem('accent');
    const accentMap = {
        indigo:  { p: '#6366f1', dark: '#4f46e5', light: '#818cf8' },
        blue:    { p: '#3b82f6', dark: '#2563eb', light: '#60a5fa' },
        violet:  { p: '#8b5cf6', dark: '#7c3aed', light: '#a78bfa' },
        rose:    { p: '#f43f5e', dark: '#e11d48', light: '#fb7185' },
        emerald: { p: '#10b981', dark: '#059669', light: '#34d399' },
        amber:   { p: '#f59e0b', dark: '#d97706', light: '#fbbf24' },
    };
    if (accent && accentMap[accent]) {
        const c = accentMap[accent];
        const r = document.documentElement.style;
        r.setProperty('--primary',       c.p);
        r.setProperty('--primary-dark',  c.dark);
        r.setProperty('--primary-light', c.light);
        r.setProperty('--primary-color', c.p);
    }
    if (localStorage.getItem('compactSidebar') === '1') {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.add('compact');
    }
}

// Show welcome popup after magic-link auto-login
function maybeShowWelcomeModal() {
    const raw = sessionStorage.getItem('welcomeCredentials');
    if (!raw) return;
    sessionStorage.removeItem('welcomeCredentials');
    let creds;
    try { creds = JSON.parse(raw); } catch { return; }

    const initials = (creds.fullName || creds.username)
        .split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2);

    const el = document.createElement('div');
    el.id = 'welcomeModal';
    el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(6px);z-index:9999;display:flex;align-items:center;justify-content:center;';
    el.innerHTML = `
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:32px;max-width:420px;width:90%;box-shadow:0 24px 64px rgba(0,0,0,.35);font-family:Inter,sans-serif;">
            <div style="text-align:center;margin-bottom:24px;">
                <div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-size:22px;font-weight:800;color:#fff;">${initials}</div>
                <h2 style="margin:0 0 6px;font-size:20px;font-weight:800;color:var(--text-1);">Welcome, ${creds.fullName || creds.username}!</h2>
                <p style="margin:0;font-size:13px;color:var(--text-3);">Save your credentials — you'll need them to log in next time.</p>
            </div>
            <div style="background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:20px;display:flex;flex-direction:column;gap:12px;">
                <div>
                    <div style="font-size:11px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Username</div>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <code style="flex:1;font-size:14px;font-weight:600;color:var(--text-1);">${creds.username}</code>
                        <button onclick="navigator.clipboard.writeText('${creds.username}')" style="padding:5px 10px;font-size:12px;font-weight:600;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text-2);cursor:pointer;">Copy</button>
                    </div>
                </div>
                <div style="border-top:1px solid var(--border);padding-top:12px;">
                    <div style="font-size:11px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Password</div>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <code style="flex:1;font-size:14px;font-weight:600;color:var(--text-1);">${creds.password}</code>
                        <button onclick="navigator.clipboard.writeText('${creds.password}')" style="padding:5px 10px;font-size:12px;font-weight:600;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text-2);cursor:pointer;">Copy</button>
                    </div>
                </div>
            </div>
            <button onclick="document.getElementById('welcomeModal').remove()" style="width:100%;padding:12px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;">
                Got it — Go to Dashboard
            </button>
        </div>
    `;
    document.body.appendChild(el);
    el.addEventListener('click', e => { if (e.target === el) el.remove(); });
}

// One-call page bootstrap (auth check + profile + sidebar + role UI)
function initPage(options = {}) {
    const { requireStore = false } = options;
    if (requireStore) {
        if (!requireStoreAccess()) return false;
    } else {
        if (!requireAuth()) return false;
    }
    // Block access to pages based on role (e.g. seller can't open users.html)
    checkPageAccess();
    const user = getCurrentUser();
    applyStoredTheme();
    updateUserProfile(user);
    applyRoleBasedUI();
    initSidebar();
    initUserProfileLogout();
    maybeShowWelcomeModal();
    return user;
}
