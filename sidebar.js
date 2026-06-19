// Sidebar Configuration
// SA has its own separate menu
const superAdminMenuItems = [
    { name: "Users",     icon: "users",    roles: ["superadmin"], href: "users.html" },
    { name: "Platform",  icon: "platform", roles: ["superadmin"], href: "platform-sa.html" },
    { name: "Settings",  icon: "settings", roles: ["superadmin"], href: "settings-sa.html" },
];

const menuItems = [
    { name: "Dashboard", icon: "dashboard", roles: ["admin", "seller"], href: "index.html" },
    { name: "Inventory", icon: "inventory", roles: ["admin", "seller"], href: "inventory.html" },
    { name: "Sales",     icon: "sales",     roles: ["admin", "seller"], href: "sales.html" },
    { name: "Sellers",   icon: "sellers",   roles: ["admin"],           href: "sellers.html" },
    { name: "Etiquetas", icon: "labels",    roles: ["admin"],           href: "labels.html" },
    { name: "Settings",  icon: "settings",  roles: ["admin", "seller"], href: "settings.html" },
];

// Icon SVGs
const icons = {
    dashboard: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="7" height="7"/>
        <rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/>
        <rect x="3" y="14" width="7" height="7"/>
    </svg>`,
    inventory: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
        <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>`,
    sales: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="9" cy="21" r="1"/>
        <circle cx="20" cy="21" r="1"/>
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
    </svg>`,
    sellers: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>`,
    reports: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 3v18h18"/>
        <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/>
    </svg>`,
    users: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>`,
    settings: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>`,
    platform: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="2" y="3" width="20" height="14" rx="2"/>
        <path d="M8 21h8M12 17v4"/>
    </svg>`,
    labels: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="2" y="4" width="2" height="16"/><rect x="6" y="4" width="1" height="16"/><rect x="9" y="4" width="2" height="16"/><rect x="13" y="4" width="1" height="16"/><rect x="16" y="4" width="2" height="16"/><rect x="20" y="4" width="2" height="16"/>
    </svg>`
};

// Map session role to sidebar menu role categories
function getUserMenuRole(role) {
    const normalized = (role || '').toLowerCase().replace(/\s+/g, '');
    if (normalized === 'superadmin') return 'superadmin';
    if (normalized === 'businessadmin' || normalized === 'administrator' || normalized === 'admin') return 'admin';
    if (normalized === 'seller') return 'seller';
    return normalized;
}

function canAccessMenuItem(userMenuRole, itemRoles) {
    return itemRoles.some(menuRole => {
        const requiredRole = menuRole.toLowerCase();
        if (requiredRole === userMenuRole) return true;
        // Business Admin inherits seller menu access
        if (userMenuRole === 'admin' && requiredRole === 'seller') return true;
        return false;
    });
}

// Render Sidebar
function renderSidebar() {
    const user = getCurrentUser();
    const userMenuRole = user ? getUserMenuRole(user.role) : '';

    const sidebarNav = document.querySelector('.sidebar-nav .nav-list');
    if (!sidebarNav) return;

    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const normalizedPath = currentPath.endsWith('.html') ? currentPath : `${currentPath}.html`;

    // Super Admin uses a completely separate, minimal menu
    const sourceItems = userMenuRole === 'superadmin' ? superAdminMenuItems : menuItems;

    const filteredMenuItems = sourceItems.filter(item =>
        canAccessMenuItem(userMenuRole, item.roles)
    );

    sidebarNav.innerHTML = filteredMenuItems.map(item => {
        const isActive = item.href === currentPath || item.href === normalizedPath;
        const activeClass = isActive ? 'active' : '';
        const navTextClass = item.name === 'Sellers' && userMenuRole === 'seller' ? 'nav-text-seller' : 'nav-text';
        const sellerText = item.name === 'Sellers' && userMenuRole === 'seller' ? 'My Profile' : item.name;
        
        return `
            <li class="nav-item ${activeClass}">
                <a href="${item.href}" class="nav-link">
                    ${icons[item.icon]}
                    <span class="${navTextClass}">${sellerText}</span>
                </a>
            </li>
        `;
    }).join('');
}

// ── Bottom Navigation Bar (mobile) ────────────────────────────────────────────
function renderBottomNav() {
    const user = getCurrentUser();
    const userMenuRole = user ? getUserMenuRole(user.role) : '';
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const sourceItems = userMenuRole === 'superadmin' ? superAdminMenuItems : menuItems;
    const filteredItems = sourceItems.filter(item => canAccessMenuItem(userMenuRole, item.roles));

    // Max 5 items in bottom nav
    const navItems = filteredItems.slice(0, 5);

    const nav = document.createElement('nav');
    nav.className = 'mobile-bottom-nav';
    nav.innerHTML = `<ul>${navItems.map(item => {
        const isActive = item.href === currentPath || item.href === (currentPath + '.html');
        const label = item.name === 'Sellers' && userMenuRole === 'seller' ? 'Perfil' : item.name;
        return `<li><a href="${item.href}" class="${isActive ? 'active' : ''}">
            ${icons[item.icon]}
            <span>${label}</span>
        </a></li>`;
    }).join('')}</ul>`;
    document.body.appendChild(nav);
}

// ── Sidebar Overlay (mobile) ──────────────────────────────────────────────────
function initMobileOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);

    const sidebar  = document.getElementById('sidebar');
    const toggle   = document.getElementById('menuToggle');

    function openSidebar() {
        sidebar?.classList.add('active');
        overlay.classList.add('visible');
        document.body.style.overflow = 'hidden';
    }
    function closeSidebar() {
        sidebar?.classList.remove('active');
        overlay.classList.remove('visible');
        document.body.style.overflow = '';
    }

    toggle?.addEventListener('click', () => {
        if (sidebar?.classList.contains('active')) closeSidebar();
        else openSidebar();
    });
    overlay.addEventListener('click', closeSidebar);

    // Close on nav link click (mobile)
    sidebar?.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => { if (window.innerWidth <= 768) closeSidebar(); });
    });
}

// Initialize Sidebar
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        renderSidebar();
        renderBottomNav();
        initMobileOverlay();
    });
}
