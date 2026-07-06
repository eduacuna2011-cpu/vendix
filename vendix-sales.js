// Vendix Sales — carga después de que los scripts defer hayan ejecutado
const PLANS = {
    basico:  { price: 15.99, label: 'Básico'  },
    premium: { price: 31.99, label: 'Premium' },
};
function planPrice(p) { return (PLANS[p] || PLANS.basico).price; }
function planLabel(p) { return (PLANS[p] || PLANS.basico).label; }
const PLAN_PRICE = PLANS.basico.price; // compat
const PLAN_LABEL = 'Plan La Tiendota';

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

function _setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }

async function loadVendixSales() {
    try {
        // MRR se basa en los NEGOCIOS realmente pagados (businesses.is_paid), que es
        // lo que marca "marcar pagado" en el panel de Usuarios. Los leads son solo
        // el embudo de prospectos (solicitudes del landing).
        const [leads, admins] = await Promise.all([getLeads(), getAdminUsers()]);
        const biz = admins || [];

        const paidList        = biz.filter(a => a.is_paid);          // pagando ahora
        const paidBusinesses  = paidList.length;
        const activeAccounts  = biz.length;                          // negocios con cuenta
        const trialBusinesses = biz.filter(a => !a.is_paid).length;  // con cuenta, sin pagar
        const pendingLeads    = (leads || []).filter(l => !l.account_created); // prospectos sin cuenta
        // MRR = suma del precio del plan de cada negocio pagado (Básico/Premium)
        const mrr             = paidList.reduce((s, a) => s + planPrice(a.plan), 0);
        const mrrPotential    = biz.reduce((s, a) => s + planPrice(a.plan), 0);

        // Nombres de negocios pagados, para reflejarlo también en la tabla de leads.
        const paidBizNames = new Set(
            biz.filter(a => a.is_paid).map(a => (a.business_name || '').trim().toLowerCase())
        );

        // ── KPIs ──────────────────────────────────────────────────────────────
        _setText('vMRR', 'S/. ' + mrr.toFixed(2));
        _setText('vLicencias', activeAccounts);
        _setText('vPagados', paidBusinesses);
        _setText('vTotal', (leads || []).length);

        // Badge header
        const badge = document.getElementById('vendixSalesBadge');
        if (badge) badge.textContent = mrr > 0 ? 'MRR: S/. ' + mrr.toFixed(2) : ((leads || []).length + ' solicitudes');

        // ── Plan breakdown ─────────────────────────────────────────────────────
        _setText('planVendix', activeAccounts);
        _setText('planPagados', paidBusinesses);
        _setText('planTrial', trialBusinesses);
        _setText('planPendiente', pendingLeads.length);
        _setText('planMRRPotencial', 'S/. ' + mrrPotential.toFixed(2));

        // ── Tabla de leads ─────────────────────────────────────────────────────
        const tbody = document.getElementById('vendixLeadsTable');
        if (!tbody) return;
        if (!leads || !leads.length) { _renderEmpty(); return; }

        tbody.innerHTML = leads.map(l => {
            const date       = l.created_at
                ? new Date(l.created_at).toLocaleDateString('es-PE', { day:'2-digit', month:'short', year:'2-digit' })
                : '—';
            // Un lead cuenta como pagado si su lead.paid es true O si su negocio ya
            // está marcado como pagado en Vendix.
            const isPaid     = l.paid || paidBizNames.has((l.business_name || '').trim().toLowerCase());
            const pagoHtml   = isPaid           ? _badge('Pagado', 'green')  : _badge('Pendiente', 'amber');
            const cuentaHtml  = l.account_created ? _badge('✓ Activa', 'green') : _badge('Sin cuenta', 'slate');
            const planKey    = l.plan === 'premium' ? 'premium' : 'basico';
            const planHtml   = `<span style="font-weight:700;">Plan ${planLabel(planKey)}</span>
                                <br><span style="font-size:11px;color:var(--text-secondary);">S/. ${planPrice(planKey).toFixed(2)}/mes</span>`;
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
    // No tocar el badge aquí: los KPIs/MRR ya se calculan desde los negocios.
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
