// Vendix Sales — carga después de que los scripts defer hayan ejecutado
const PLAN_PRICE = 15.99; // único plan
const PLAN_LABEL = 'Plan Vendix';

function _esc(s) {
    if (!s) return '—';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function _badge(text, color) {
    const map = {
        green:  'rgba(16,185,129,.12);color:#059669',
        amber:  'rgba(245,158,11,.12);color:#d97706',
        slate:  'rgba(148,163,184,.12);color:#64748b',
        indigo: 'rgba(99,102,241,.12);color:#6366f1',
    };
    const style = map[color] || map.slate;
    return `<span style="background:${style};padding:2px 10px;border-radius:10px;font-size:11px;font-weight:700;white-space:nowrap;">${text}</span>`;
}

async function loadVendixSales() {
    try {
        const leads = await getLeads();

        if (!leads || !leads.length) {
            _renderEmpty(); return;
        }

        const withAccount = leads.filter(l => l.account_created);
        const paidLeads   = leads.filter(l => l.paid);
        const trialLeads  = leads.filter(l => l.account_created && !l.paid);
        const pendingLeads = leads.filter(l => !l.account_created);
        const mrr         = paidLeads.length * PLAN_PRICE;
        const mrrPotential = withAccount.length * PLAN_PRICE;

        // ── KPIs ──────────────────────────────────────────────────────────────
        document.getElementById('vMRR').textContent       = 'S/. ' + mrr.toFixed(2);
        document.getElementById('vLicencias').textContent = withAccount.length;
        document.getElementById('vPagados').textContent   = paidLeads.length;
        document.getElementById('vTotal').textContent     = leads.length;

        // Badge header
        const badge = document.getElementById('vendixSalesBadge');
        if (badge) badge.textContent = mrr > 0 ? 'MRR: S/. ' + mrr.toFixed(2) : leads.length + ' solicitudes';

        // ── Plan breakdown ─────────────────────────────────────────────────────
        const elVendix   = document.getElementById('planVendix');
        const elPagados  = document.getElementById('planPagados');
        const elTrial    = document.getElementById('planTrial');
        const elPendiente = document.getElementById('planPendiente');
        const elPotencial = document.getElementById('planMRRPotencial');
        if (elVendix)    elVendix.textContent   = leads.length;
        if (elPagados)   elPagados.textContent  = paidLeads.length;
        if (elTrial)     elTrial.textContent     = trialLeads.length;
        if (elPendiente) elPendiente.textContent = pendingLeads.length;
        if (elPotencial) elPotencial.textContent = 'S/. ' + mrrPotential.toFixed(2);

        // ── Tabla de leads ─────────────────────────────────────────────────────
        const tbody = document.getElementById('vendixLeadsTable');
        if (!tbody) return;

        tbody.innerHTML = leads.map(l => {
            const date       = l.created_at
                ? new Date(l.created_at).toLocaleDateString('es-PE', { day:'2-digit', month:'short', year:'2-digit' })
                : '—';
            const pagoHtml   = l.paid           ? _badge('Pagado', 'green')  : _badge('Pendiente', 'amber');
            const cuentaHtml  = l.account_created ? _badge('✓ Activa', 'green') : _badge('Sin cuenta', 'slate');
            const planHtml   = `<span style="font-weight:700;">${PLAN_LABEL}</span>
                                <br><span style="font-size:11px;color:var(--text-secondary);">S/. ${PLAN_PRICE}/mes</span>`;
            return `<tr>
                <td><strong>${_esc(l.business_name)}</strong><br>
                    <span style="font-size:11px;color:var(--text-secondary);">${_esc(l.biz_type)}</span></td>
                <td>${_esc(l.full_name)}<br>
                    <span style="font-size:11px;color:var(--text-secondary);">${_esc(l.phone)}</span></td>
                <td>${planHtml}</td>
                <td>${pagoHtml}</td>
                <td>${cuentaHtml}</td>
                <td style="white-space:nowrap;font-size:12px;">${date}</td>
            </tr>`;
        }).join('');

    } catch (err) {
        console.error('Vendix Sales error:', err);
        _renderEmpty();
    }
}

function _renderEmpty() {
    const badge = document.getElementById('vendixSalesBadge');
    if (badge) badge.textContent = 'Sin datos aún';
    const tbody = document.getElementById('vendixLeadsTable');
    if (tbody) tbody.innerHTML = `
        <tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-secondary);">
            <div style="font-size:28px;margin-bottom:10px;">💼</div>
            <div style="font-weight:700;margin-bottom:4px;color:var(--text-primary);">Sin solicitudes todavía</div>
            <div style="font-size:12px;">Cuando alguien complete el checkout en el landing, aparecerá aquí.</div>
        </td></tr>`;
}

// Se llama desde platform-sa.js después de que render() termina
window.loadVendixSales = loadVendixSales;

// También se auto-ejecuta al cargar (defer garantiza que api-client.js ya corrió)
loadVendixSales();
