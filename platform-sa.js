// Guard: SA only
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
    render();
}

function fmtMoney(n) {
    return 'S/. ' + Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso) { return formatDate(iso, false); }

function initials(name) {
    return (name || '?').split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function refresh() { render(); }

async function render() {
    const [admins, sellers, transactions, prodStats, userStats] = await Promise.all([
        getAdminUsers(),
        getSellers(),
        getTransactions(50),
        getProductStats(),
        getUserStats()
    ]);

    const totalRev      = userStats?.totalRevenue || 0;
    const activeSellers = sellers.filter(s => s.status === 'Active').length;

    // ── KPIs ──────────────────────────────────────────────────────
    const kpis = [
        { color: 'indigo',  val: admins.length,        label: 'Businesses',
          icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>` },
        { color: 'emerald', val: fmtMoney(totalRev),   label: 'Total Revenue',
          icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>` },
        { color: 'violet',  val: sellers.length,        label: 'Total Sellers',
          icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>` },
        { color: 'amber',   val: transactions.length,   label: 'Transactions',
          icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>` },
        { color: 'blue',    val: prodStats?.totalProducts || 0, label: 'Products',
          icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/></svg>` },
        { color: 'rose',    val: activeSellers,          label: 'Active Sellers',
          icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 4 12 14.01 9 11.01"/><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/></svg>` },
    ];

    document.getElementById('kpiRow').innerHTML = kpis.map(k => `
        <div class="plat-kpi">
            <div class="plat-kpi-icon ${k.color}">${k.icon}</div>
            <div>
                <div class="plat-kpi-val">${k.val}</div>
                <div class="plat-kpi-label">${k.label}</div>
            </div>
        </div>`).join('');

    // ── Revenue by business (from transactions) ───────────────────
    document.getElementById('totalRevBadge').textContent = fmtMoney(totalRev);

    const bizRevMap = {};
    for (const t of transactions) {
        if (t.business_id) {
            bizRevMap[t.business_id] = (bizRevMap[t.business_id] || 0) + parseFloat(t.total || 0);
        }
    }

    const bizRevData = admins.map(a => ({
        name: a.business_name || a.biz_name || '—',
        rev:  bizRevMap[a.business_id] || 0
    })).sort((a, b) => b.rev - a.rev);

    const maxRev = bizRevData[0]?.rev || 1;

    document.getElementById('bizRevenueList').innerHTML = bizRevData.length
        ? bizRevData.map(b => `
            <div class="plat-biz-row">
                <div class="plat-biz-row-top">
                    <span class="plat-biz-name">${b.name}</span>
                    <span class="plat-biz-rev">${fmtMoney(b.rev)}</span>
                </div>
                <div class="plat-bar-bg">
                    <div class="plat-bar-fill" style="width:${Math.max((b.rev / maxRev) * 100, 2)}%"></div>
                </div>
            </div>`).join('')
        : `<p style="color:var(--text-3);font-size:13px;padding:8px 0">No business data yet.</p>`;

    // ── Top sellers ───────────────────────────────────────────────
    const sellerRevs = sellers
        .map(s => ({
            name: s.full_name,
            biz:  s.business_name || '—',
            rev:  parseFloat(s.total_sales || 0)
        }))
        .sort((a, b) => b.rev - a.rev)
        .slice(0, 8);

    document.getElementById('sellerCountBadge').textContent = sellers.length + ' total';

    const rankClass = i => i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';

    document.getElementById('topSellerList').innerHTML = sellerRevs.length
        ? sellerRevs.map((s, i) => `
            <div class="plat-seller-row">
                <div class="plat-seller-rank ${rankClass(i)}">${i + 1}</div>
                <div class="plat-seller-avatar">${initials(s.name)}</div>
                <div class="plat-seller-info">
                    <div class="plat-seller-name">${s.name}</div>
                    <div class="plat-seller-biz">${s.biz}</div>
                </div>
                <div class="plat-seller-sales">${fmtMoney(s.rev)}</div>
            </div>`).join('')
        : `<p style="color:var(--text-3);font-size:13px;padding:16px 20px">No sellers yet.</p>`;

    // ── Business registry table ───────────────────────────────────
    document.getElementById('bizTable').innerHTML = admins.length
        ? admins.map(a => {
            const bizSellers = sellers.filter(s => s.business_id === a.business_id);
            const bizRev     = bizRevMap[a.business_id] || 0;
            const status     = a.status || 'Active';
            return `<tr>
                <td><strong>${a.business_name || a.biz_name || '—'}</strong></td>
                <td>${a.full_name || '—'}</td>
                <td><span class="status-dot ${status.toLowerCase()}">${status}</span></td>
                <td>${bizSellers.length}</td>
                <td class="sa-amount">${fmtMoney(bizRev)}</td>
                <td>${fmtDate(a.created_at)}</td>
            </tr>`;
          }).join('')
        : `<tr><td colspan="6" class="sa-empty">No businesses registered yet.</td></tr>`;

    // ── Recent transactions ───────────────────────────────────────
    const recent = transactions.slice(0, 10);

    document.getElementById('recentTx').innerHTML = recent.length
        ? recent.map(t => {
            const biz = admins.find(a => a.business_id === t.business_id);
            return `<tr>
                <td><code style="font-size:12px">#${t.id || '—'}</code></td>
                <td>${biz?.business_name || biz?.biz_name || '—'}</td>
                <td>${t.seller_name || '—'}</td>
                <td class="sa-amount">${fmtMoney(t.total)}</td>
                <td>${fmtDate(t.date)}</td>
            </tr>`;
          }).join('')
        : `<tr><td colspan="5" class="sa-empty">No transactions yet.</td></tr>`;
}
