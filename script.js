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

    // :root IS dark; only light mode sets data-theme="light"
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
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
                    label: 'Ingresos',
                    data: revenue,
                    backgroundColor: 'rgba(0,200,100,0.15)',
                    borderColor: '#00C864',
                    borderWidth: 2,
                    borderRadius: 6,
                    yAxisID: 'y',
                },
                {
                    type: 'line',
                    label: 'Ganancia',
                    data: profit,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59,130,246,0.08)',
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
                        label: ctx => ` ${ctx.dataset.label}: S/. ${ctx.parsed.y.toFixed(2)}`
                    }
                }
            },
            scales: {
                x: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 12 } } },
                y: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 12 }, callback: v => 'S/. ' + v.toLocaleString() }, beginAtZero: true }
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

// ── Export completo a Excel (SheetJS) ─────────────────────────────────────────
async function exportAllData() {
    const btn = document.getElementById('exportBtn');
    const origHTML = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Generando…'; }

    try {
        if (typeof XLSX === 'undefined') throw new Error('SheetJS no cargado');

        const [products, allTx, sellers] = await Promise.all([
            getProducts(),
            getTransactions(9999),
            getSellers()
        ]);

        const wb = XLSX.utils.book_new();

        // ── Resumen ───────────────────────────────────────────────────────
        const totalRevenue = allTx.reduce((s, t) => s + parseFloat(t.total || 0), 0);
        const totalProfit  = allTx.reduce((s, t) => s + parseFloat(t.profit || 0), 0);
        const today = new Date().toLocaleDateString('es-PE', { timeZone: 'America/Lima', year: 'numeric', month: 'long', day: 'numeric' });
        const wsResumen = XLSX.utils.aoa_to_sheet([
            ['VENDIX — Reporte Completo'],
            ['Fecha de exportación', today],
            [],
            ['MÉTRICA',                'VALOR'],
            ['Total de productos',      products.length],
            ['Total de ventas',         allTx.length],
            ['Ingresos totales',        totalRevenue],
            ['Ganancia total',          totalProfit],
            ['Margen promedio (%)',      totalRevenue ? +((totalProfit / totalRevenue) * 100).toFixed(1) : 0],
            ['Total vendedores',        sellers.length],
        ]);
        XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

        // ── Inventario ────────────────────────────────────────────────────
        const invHeader = ['SKU', 'Nombre', 'Categoría', 'Stock', 'Precio de Venta (S/.)', 'Costo (S/.)', 'Valor en Inventario (S/.)', 'Estado'];
        const invRows   = (products || []).map(p => {
            const stock = parseInt(p.stock || 0);
            const cost  = parseFloat(p.cost || 0);
            const estado = stock === 0 ? 'Sin stock' : stock <= 2 ? 'Crítico' : stock <= 5 ? 'Bajo' : 'OK';
            return [
                p.sku || '—',
                p.name || '—',
                p.category || '—',
                stock,
                parseFloat(p.price || 0),
                cost,
                +(stock * cost).toFixed(2),
                estado
            ];
        });
        const wsInv = XLSX.utils.aoa_to_sheet([invHeader, ...invRows]);
        XLSX.utils.book_append_sheet(wb, wsInv, 'Inventario');

        // ── Ventas (resumen por venta) ────────────────────────────────────
        const salesHeader = ['ID', 'Fecha', 'Hora', 'Vendedor', 'Método de Pago', 'Total (S/.)', 'Ganancia (S/.)', 'Margen (%)'];
        const salesRows   = (allTx || []).map(t => {
            const d      = new Date(t.date);
            const total  = parseFloat(t.total || 0);
            const profit = parseFloat(t.profit || 0);
            return [
                t.id,
                d.toLocaleDateString('es-PE', { timeZone: 'America/Lima' }),
                d.toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' }),
                t.seller_name || '—',
                t.payment_method || 'Efectivo',
                total,
                profit,
                total ? +((profit / total) * 100).toFixed(1) : 0
            ];
        });
        const wsVentas = XLSX.utils.aoa_to_sheet([salesHeader, ...salesRows]);
        XLSX.utils.book_append_sheet(wb, wsVentas, 'Ventas');

        // ── Detalle de Ventas (producto por producto) ─────────────────────
        // Build SKU lookup from products
        const skuMap = {};
        (products || []).forEach(p => { if (p.name) skuMap[p.name.toLowerCase()] = p.sku || '—'; });

        const detailHeader = ['Venta ID', 'Fecha', 'Vendedor', 'SKU', 'Producto', 'Cantidad', 'Precio Unit. (S/.)', 'Subtotal (S/.)'];
        const detailRows   = [];
        for (const t of (allTx || [])) {
            const fecha = new Date(t.date).toLocaleDateString('es-PE', { timeZone: 'America/Lima' });
            for (const item of (t.items || [])) {
                const sku      = item.sku || skuMap[(item.product_name || '').toLowerCase()] || '—';
                const unitPrice = parseFloat(item.unit_price || item.price || 0);
                detailRows.push([
                    t.id,
                    fecha,
                    t.seller_name || '—',
                    sku,
                    item.product_name || '—',
                    item.quantity || 0,
                    unitPrice,
                    +((item.quantity || 0) * unitPrice).toFixed(2)
                ]);
            }
        }
        const wsDetail = XLSX.utils.aoa_to_sheet([detailHeader, ...detailRows]);
        XLSX.utils.book_append_sheet(wb, wsDetail, 'Detalle Ventas');

        // ── Vendedores ────────────────────────────────────────────────────
        const selHeader = ['Nombre', 'Usuario', 'Email', 'Teléfono', 'Comisión (%)', 'Estado'];
        const selRows   = (sellers || []).map(s => [
            s.full_name || '—',
            s.username  || '—',
            s.email     || '—',
            s.phone     || '—',
            parseFloat(s.commission_percentage || 0),
            s.status    || 'activo'
        ]);
        const wsSellers = XLSX.utils.aoa_to_sheet([selHeader, ...selRows]);
        XLSX.utils.book_append_sheet(wb, wsSellers, 'Vendedores');

        // ── Descargar ────────────────────────────────────────────────────
        const fecha = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, `vendix-${fecha}.xlsx`);
        showNotification('Archivo descargado correctamente');

    } catch (err) {
        console.error('Export error:', err);
        showNotification('Error al exportar: ' + err.message, true);
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = origHTML; }
    }
}

// ── Low Stock ─────────────────────────────────────────────────────────────────

function renderLowStock(products) {
    const low = (products || []).filter(p => parseInt(p.stock) < 5).sort((a, b) => a.stock - b.stock).slice(0, 8);
    const el  = document.getElementById('lowStockList');

    if (!low.length) { el.innerHTML = '<div class="dash-empty">✅ Todo el inventario en buen estado</div>'; return; }

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
                const product = items.length
                    ? items.map(i => `${escapeHtml(i.product_name)} ×${i.quantity}`).join(', ')
                    : '—';
                const totalQty = items.reduce((s, i) => s + (i.quantity || 0), 0) || '—';
                const comm    = (parseFloat(t.total || 0) * commissionRate / 100).toFixed(2);
                return `<tr>
                    <td>${new Date(t.date).toLocaleDateString('es-PE', { timeZone: 'America/Lima' })}</td>
                    <td>${product}</td>
                    <td>${totalQty}</td>
                    <td>${fmt(t.total)}</td>
                    <td>S/. ${comm}</td>
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
        if (dateEl)    dateEl.textContent    = now.toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Lima' });

        // Show skeleton shimmer in KPI values while loading — prevents flash of "—" or "0"
        document.querySelectorAll('.kpi-value').forEach(el => {
            el.dataset.orig = el.textContent;
            el.innerHTML = '<span class="skeleton-line" style="width:80px;height:20px;display:inline-block;border-radius:4px;"></span>';
        });

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
    checkOnboarding();
    if (isSeller() && !isSuperAdmin() && !isBusinessAdmin()) {
        renderSellerDashboard(_dashUser);
    } else {
        updateDashboardStats();
    }
}
