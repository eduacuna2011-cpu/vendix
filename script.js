// Dashboard — Pro Business Admin version

let _allTx      = [];
let _allProducts = [];
let _allSellers  = [];
let _salesChart  = null;

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n) { return 'S/. ' + parseFloat(n || 0).toFixed(2); }

function monthKey(dateStr) {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key) {
    const [y, m] = key.split('-');
    return new Date(y, parseInt(m) - 1, 1).toLocaleString('default', { month: 'short', year: '2-digit' });
}

function thisMonth() {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}

function lastMonth() {
    const n = new Date();
    n.setMonth(n.getMonth() - 1);
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}

function badge(val, prev, prefix = 'S/.') {
    if (prev === 0) return `<span class="kpi-badge flat">—</span>`;
    const pct = Math.round(((val - prev) / prev) * 100);
    const dir = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
    const arrow = pct > 0 ? '↑' : pct < 0 ? '↓' : '→';
    return `<span class="kpi-badge ${dir}">${arrow} ${Math.abs(pct)}% vs last month</span>`;
}

function paymentClass(method) {
    const m = (method || '').toLowerCase();
    if (m === 'cash')     return 'cash';
    if (m === 'card')     return 'card';
    if (m === 'transfer') return 'transfer';
    return 'other';
}

function initials(name) {
    return (name || '?').split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// ── KPI Cards ─────────────────────────────────────────────────────────────────

function renderKPIs(tx, products, sellers) {
    const cur  = thisMonth();
    const prev = lastMonth();

    const txCur  = tx.filter(t => monthKey(t.date) === cur);
    const txPrev = tx.filter(t => monthKey(t.date) === prev);

    const revCur   = txCur.reduce((s, t)  => s + parseFloat(t.total  || 0), 0);
    const revPrev  = txPrev.reduce((s, t) => s + parseFloat(t.total  || 0), 0);
    const profCur  = txCur.reduce((s, t)  => s + parseFloat(t.profit || 0), 0);
    const profPrev = txPrev.reduce((s, t) => s + parseFloat(t.profit || 0), 0);
    const ordCur   = txCur.length;
    const ordPrev  = txPrev.length;

    const activeSellers = (sellers || []).filter(s => s.status === 'Active').length;
    const lowStock      = (products || []).filter(p => parseInt(p.stock) < 5).length;

    document.getElementById('kpiRevenue').textContent    = fmt(revCur);
    document.getElementById('kpiProfit').textContent     = fmt(profCur);
    document.getElementById('kpiOrders').textContent     = ordCur;
    document.getElementById('kpiSellers').textContent    = activeSellers;
    document.getElementById('kpiLowStock').textContent   = lowStock;

    document.getElementById('kpiRevenueBadge').outerHTML  = badge(revCur, revPrev);
    document.getElementById('kpiProfitBadge').outerHTML   = badge(profCur, profPrev);
    document.getElementById('kpiOrdersBadge').outerHTML   = badge(ordCur, ordPrev, '');

    const lsEl = document.getElementById('kpiLowStockBadge');
    if (lsEl) lsEl.outerHTML = lowStock > 0
        ? `<span class="kpi-badge down">⚠ Needs attention</span>`
        : `<span class="kpi-badge up">✓ All good</span>`;

    const ssEl = document.getElementById('kpiSellersBadge');
    if (ssEl) ssEl.outerHTML = `<span class="kpi-badge flat">${(sellers || []).length} total</span>`;
}

// ── Chart ─────────────────────────────────────────────────────────────────────

function buildChartData(tx, months) {
    const keys = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    const revenue = keys.map(k => tx.filter(t => monthKey(t.date) === k).reduce((s, t) => s + parseFloat(t.total || 0), 0));
    const profit  = keys.map(k => tx.filter(t => monthKey(t.date) === k).reduce((s, t) => s + parseFloat(t.profit || 0), 0));
    const labels  = keys.map(monthLabel);
    return { labels, revenue, profit };
}

function renderChart(tx) {
    const months = parseInt(document.getElementById('chartPeriod')?.value || '6');
    const { labels, revenue, profit } = buildChartData(tx, months);

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    const ctx = document.getElementById('salesChart')?.getContext('2d');
    if (!ctx) return;

    if (_salesChart) _salesChart.destroy();

    _salesChart = new Chart(ctx, {
        data: {
            labels,
            datasets: [
                {
                    type: 'bar',
                    label: 'Revenue',
                    data: revenue,
                    backgroundColor: 'rgba(99,102,241,0.18)',
                    borderColor: '#6366f1',
                    borderWidth: 2,
                    borderRadius: 6,
                    yAxisID: 'y',
                },
                {
                    type: 'line',
                    label: 'Profit',
                    data: profit,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16,185,129,0.08)',
                    borderWidth: 2.5,
                    pointBackgroundColor: '#10b981',
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    tension: 0.4,
                    fill: true,
                    yAxisID: 'y',
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    position: 'top',
                    align: 'end',
                    labels: { color: textColor, font: { size: 12, weight: '600' }, boxWidth: 12, padding: 16 }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.dataset.label}: $${ctx.parsed.y.toFixed(2)}`
                    }
                }
            },
            scales: {
                x: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 12 } } },
                y: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 12 }, callback: v => '$' + v.toLocaleString() }, beginAtZero: true }
            }
        }
    });
}

function updateChart() { renderChart(_allTx); }

// ── Leaderboard ───────────────────────────────────────────────────────────────

function renderLeaderboard(tx, sellers) {
    const cur  = thisMonth();
    const txCur = tx.filter(t => monthKey(t.date) === cur);

    const map = {};
    txCur.forEach(t => {
        const name = t.seller_name || 'Unknown';
        if (!map[name]) map[name] = 0;
        map[name] += parseFloat(t.total || 0);
    });

    const ranked = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const max    = ranked[0]?.[1] || 1;

    const el = document.getElementById('leaderboardList');
    if (!ranked.length) { el.innerHTML = '<div class="dash-empty">No sales this month yet</div>'; return; }

    const rankClass = i => i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';

    el.innerHTML = ranked.map(([name, total], i) => `
        <div class="lb-item">
            <div class="lb-rank ${rankClass(i)}">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</div>
            <div class="lb-avatar">${initials(name)}</div>
            <div class="lb-info">
                <div class="lb-name">${name}</div>
                <div class="lb-bar-wrap"><div class="lb-bar" style="width:${Math.round((total/max)*100)}%"></div></div>
            </div>
            <div class="lb-amount">${fmt(total)}</div>
        </div>`).join('');
}

// ── Top Products ──────────────────────────────────────────────────────────────

function renderTopProducts(tx) {
    const map = {};
    tx.forEach(t => {
        (t.items || []).forEach(item => {
            const name = item.product_name || item.name || '—';
            if (!map[name]) map[name] = { revenue: 0, units: 0, category: item.category || '' };
            map[name].revenue += parseFloat(item.unit_price || item.unitPrice || 0) * parseInt(item.quantity || 1);
            map[name].units   += parseInt(item.quantity || 1);
        });
    });

    const ranked = Object.entries(map).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5);
    const el = document.getElementById('topProductsList');

    if (!ranked.length) { el.innerHTML = '<div class="dash-empty">No sales data yet</div>'; return; }

    const icons = ['📦','👕','👟','🧢','💼'];
    el.innerHTML = ranked.map(([name, d], i) => `
        <div class="tp-item">
            <div class="tp-rank">${i + 1}</div>
            <div class="tp-icon">${icons[i] || '📦'}</div>
            <div class="tp-info">
                <div class="tp-name">${name}</div>
                <div class="tp-cat">${d.category || 'Product'}</div>
            </div>
            <div>
                <div class="tp-revenue">${fmt(d.revenue)}</div>
                <div class="tp-units">${d.units} units</div>
            </div>
        </div>`).join('');
}

// ── Transactions Table ────────────────────────────────────────────────────────

let _filteredTx = [];

function renderTxTable(tx) {
    _filteredTx = tx;
    const tbody = document.getElementById('txTableBody');
    const empty = document.getElementById('txEmpty');
    const table = document.getElementById('txTable');

    if (!tx.length) {
        tbody.innerHTML = '';
        table.style.display = 'none';
        empty.style.display = '';
        return;
    }

    table.style.display = '';
    empty.style.display = 'none';

    tbody.innerHTML = tx.slice(0, 50).map(t => {
        const profit = parseFloat(t.profit || 0);
        const profClass = profit >= 0 ? 'pos' : 'neg';
        const method = t.payment_method || 'Cash';
        return `
        <tr>
            <td class="tx-id">#${String(t.id).padStart(6, '0')}</td>
            <td>${new Date(t.date).toLocaleDateString()}</td>
            <td>${t.seller_name || '—'}</td>
            <td><span class="tx-method ${paymentClass(method)}">${method}</span></td>
            <td style="font-weight:700;">${fmt(t.total)}</td>
            <td class="tx-profit ${profClass}">${profit >= 0 ? '+' : ''}${fmt(profit)}</td>
        </tr>`;
    }).join('');
}

function applyTxFilter() {
    const from = document.getElementById('filterFrom').value;
    const to   = document.getElementById('filterTo').value;
    let tx = [..._allTx];
    if (from) tx = tx.filter(t => new Date(t.date) >= new Date(from));
    if (to)   tx = tx.filter(t => new Date(t.date) <= new Date(to + 'T23:59:59'));
    renderTxTable(tx);
}

function clearTxFilter() {
    document.getElementById('filterFrom').value = '';
    document.getElementById('filterTo').value   = '';
    renderTxTable(_allTx);
}

function exportCSV() {
    const tx = _filteredTx.length ? _filteredTx : _allTx;
    if (!tx.length) return;

    const header = ['ID', 'Date', 'Seller', 'Payment Method', 'Total', 'Profit'];
    const rows   = tx.map(t => [
        t.id,
        new Date(t.date).toLocaleDateString(),
        t.seller_name || '',
        t.payment_method || 'Cash',
        parseFloat(t.total || 0).toFixed(2),
        parseFloat(t.profit || 0).toFixed(2)
    ]);

    const csv  = [header, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ── Low Stock ─────────────────────────────────────────────────────────────────

function renderLowStock(products) {
    const low = (products || []).filter(p => parseInt(p.stock) < 5).sort((a, b) => a.stock - b.stock).slice(0, 8);
    const el  = document.getElementById('lowStockList');

    if (!low.length) { el.innerHTML = '<div class="dash-empty">✅ All products well stocked</div>'; return; }

    el.innerHTML = low.map(p => {
        const stock = parseInt(p.stock);
        const cls   = stock === 0 ? 'out' : stock <= 2 ? 'crit' : 'low';
        const label = stock === 0 ? 'Out of stock' : stock <= 2 ? `${stock} left — Critical` : `${stock} left`;
        return `
        <div class="ls-item">
            <div class="ls-info">
                <div class="ls-name">${p.name}</div>
                <div class="ls-sku">${p.sku || p.category || '—'}</div>
            </div>
            <span class="ls-badge ${cls}">${label}</span>
        </div>`;
    }).join('');
}

// ── Seller Dashboard ──────────────────────────────────────────────────────────

async function renderSellerDashboard(user) {
    document.getElementById('adminDashboard').style.display  = 'none';
    document.getElementById('sellerDashboard').style.display = '';

    try {
        const [sellers, allTx] = await Promise.all([getSellers(), getTransactions(200)]);

        const sellerRecord   = (sellers || []).find(s => s.username === user.username || s.full_name === user.fullName);
        const commissionRate = sellerRecord ? parseFloat(sellerRecord.commission_percentage || 0) : 0;
        const myTx           = (allTx || []).filter(t => t.seller_id === user.id || t.seller_name === user.fullName);
        const totalSales     = myTx.reduce((s, t) => s + parseFloat(t.total || 0), 0);
        const commission     = totalSales * commissionRate / 100;
        const avg            = myTx.length ? totalSales / myTx.length : 0;

        document.getElementById('spName').textContent     = `Welcome, ${user.fullName || user.username}`;
        document.getElementById('spSubtitle').textContent = sellerRecord ? `Commission rate: ${commissionRate}%` : 'Your sales performance overview';
        document.getElementById('spTotalOrders').textContent = myTx.length;
        document.getElementById('spTotalSales').textContent  = fmt(totalSales);
        document.getElementById('spCommission').textContent  = fmt(commission);
        document.getElementById('spAvgOrder').textContent    = fmt(avg);

        const tbody = document.getElementById('spTxBody');
        const empty = document.getElementById('spTxEmpty');
        if (!myTx.length) {
            tbody.innerHTML = '';
            empty.style.display = '';
        } else {
            empty.style.display = 'none';
            tbody.innerHTML = myTx.slice().reverse().slice(0, 20).map(t => {
                const items   = t.items || [];
                const product = items[0] ? items[0].product_name : '—';
                const qty     = items[0] ? items[0].quantity : '—';
                const comm    = (parseFloat(t.total || 0) * commissionRate / 100).toFixed(2);
                return `<tr>
                    <td>${new Date(t.date).toLocaleDateString()}</td>
                    <td>${product}</td>
                    <td>${qty}</td>
                    <td>${fmt(t.total)}</td>
                    <td>$${comm}</td>
                </tr>`;
            }).join('');
        }
    } catch (err) { console.error('Seller dashboard error:', err); }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function updateDashboardStats() {
    try {
        const now  = new Date();
        const user = getCurrentUser();

        const welcomeEl = document.getElementById('adminWelcome');
        const dateEl    = document.getElementById('adminDate');
        if (welcomeEl) welcomeEl.textContent = `Welcome back, ${user?.fullName?.split(' ')[0] || 'Admin'} 👋`;
        if (dateEl)    dateEl.textContent    = now.toLocaleDateString('default', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        const [tx, products, sellers] = await Promise.all([
            getTransactions(500),
            getProducts(),
            getSellers()
        ]);

        _allTx       = (tx       || []).sort((a, b) => new Date(b.date) - new Date(a.date));
        _allProducts = products  || [];
        _allSellers  = sellers   || [];

        renderKPIs(_allTx, _allProducts, _allSellers);
        renderChart(_allTx);
        renderLeaderboard(_allTx, _allSellers);
        renderTopProducts(_allTx);
        renderTxTable(_allTx);
        renderLowStock(_allProducts);

    } catch (err) { console.error('Dashboard error:', err); }
}

// ── Init ──────────────────────────────────────────────────────────────────────

const _dashUser = initPage({ requireStore: true });
if (_dashUser) {
    if (isSeller() && !isSuperAdmin() && !isBusinessAdmin()) {
        renderSellerDashboard(_dashUser);
    } else {
        updateDashboardStats();
    }
}
