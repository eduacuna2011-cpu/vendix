const pptxgen = require("pptxgenjs");

const pres = new pptxgen();
pres.layout = 'LAYOUT_16x9';
pres.title = 'Vendix — Presentación';

// ── Paleta ──────────────────────────────────────────────────────────────────
const C = {
    navy:    '060d2e',
    indigo:  '6366f1',
    purple:  '8b5cf6',
    white:   'FFFFFF',
    ice:     'e0e7ff',
    slate:   '94a3b8',
    green:   '10b981',
    amber:   'f59e0b',
    surface: '0f1a3d',
    card:    '1a2a55',
    muted:   '64748b',
    text2:   'cbd5e1',
};

const makeShadow = () => ({ type: 'outer', color: '000000', blur: 12, offset: 3, angle: 45, opacity: 0.18 });

// ════════════════════════════════════════════════════════════════════════════
// SLIDE 1 — Portada
// ════════════════════════════════════════════════════════════════════════════
{
    const s = pres.addSlide();
    s.background = { color: C.navy };

    // Círculo decorativo grande (fondo)
    s.addShape(pres.shapes.OVAL, { x: 6.5, y: -1.5, w: 5.5, h: 5.5, fill: { color: C.indigo, transparency: 85 }, line: { color: C.indigo, transparency: 85 } });
    s.addShape(pres.shapes.OVAL, { x: -1.5, y: 2.5, w: 4, h: 4, fill: { color: C.purple, transparency: 88 }, line: { color: C.purple, transparency: 88 } });

    // Logo badge
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.7, y: 0.6, w: 0.7, h: 0.7, fill: { color: C.indigo }, rectRadius: 0.12 });
    s.addText('V', { x: 0.7, y: 0.6, w: 0.7, h: 0.7, fontSize: 22, bold: true, color: C.white, align: 'center', valign: 'middle', margin: 0 });

    // Nombre logo
    s.addText('Vendix', { x: 1.5, y: 0.65, w: 2, h: 0.6, fontSize: 20, bold: true, color: C.white, align: 'left', valign: 'middle' });

    // Título principal
    s.addText('Gestión inteligente\npara tu negocio', {
        x: 0.7, y: 1.55, w: 6.5, h: 1.9,
        fontSize: 42, bold: true, color: C.white,
        align: 'left', valign: 'top'
    });

    // Subtítulo
    s.addText('Software de inventario y ventas diseñado\npara negocios peruanos — simple, rápido y accesible.', {
        x: 0.7, y: 3.45, w: 6.2, h: 1,
        fontSize: 15, color: C.text2, align: 'left'
    });

    // Pill badge
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.7, y: 4.65, w: 2.2, h: 0.42, fill: { color: C.indigo, transparency: 75 }, rectRadius: 0.2, line: { color: C.indigo, transparency: 50 } });
    s.addText('S/. 15.99 / mes', { x: 0.7, y: 4.65, w: 2.2, h: 0.42, fontSize: 12, bold: true, color: C.ice, align: 'center', valign: 'middle' });

    // Panel derecho — KPI cards
    const kpis = [
        { label: 'Prueba gratis', val: '3 días', color: C.green },
        { label: 'Tiempo de setup', val: '< 5 min', color: C.indigo },
        { label: 'Precio fijo', val: 'S/. 15.99', color: C.amber },
    ];
    kpis.forEach((k, i) => {
        const x = 7.5, y = 1.2 + i * 1.35;
        s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 2.1, h: 1.1, fill: { color: C.surface }, rectRadius: 0.12, shadow: makeShadow() });
        s.addText(k.val, { x, y: y + 0.08, w: 2.1, h: 0.55, fontSize: 22, bold: true, color: k.color, align: 'center' });
        s.addText(k.label, { x, y: y + 0.6, w: 2.1, h: 0.38, fontSize: 11, color: C.slate, align: 'center' });
    });
}

// ════════════════════════════════════════════════════════════════════════════
// SLIDE 2 — El problema
// ════════════════════════════════════════════════════════════════════════════
{
    const s = pres.addSlide();
    s.background = { color: C.navy };

    s.addText('El problema', { x: 0.6, y: 0.4, w: 8.8, h: 0.6, fontSize: 13, bold: true, color: C.indigo, align: 'left', charSpacing: 3 });
    s.addText('Los negocios peruanos pierden dinero\nsin herramientas adecuadas', {
        x: 0.6, y: 0.85, w: 8.8, h: 1.2,
        fontSize: 30, bold: true, color: C.white, align: 'left'
    });

    const probs = [
        { icon: '📋', title: 'Control manual', desc: 'Inventario en cuadernos o Excel sin sincronización en tiempo real.' },
        { icon: '💸', title: 'Pérdidas ocultas', desc: 'Sin registro de ventas, los negocios no saben cuánto ganan realmente.' },
        { icon: '⏰', title: 'Tiempo perdido', desc: 'Cierres de caja manuales que toman horas cada día.' },
        { icon: '📉', title: 'Sin datos', desc: 'Decisiones a ciegas sin reportes de productos más vendidos ni tendencias.' },
    ];

    probs.forEach((p, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = 0.5 + col * 4.8;
        const y = 2.3 + row * 1.5;
        s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 4.4, h: 1.25, fill: { color: C.surface }, rectRadius: 0.12, shadow: makeShadow() });
        s.addText(p.icon, { x: x + 0.15, y: y + 0.08, w: 0.6, h: 0.6, fontSize: 22, align: 'center' });
        s.addText(p.title, { x: x + 0.8, y: y + 0.1, w: 3.4, h: 0.38, fontSize: 13, bold: true, color: C.white, align: 'left' });
        s.addText(p.desc, { x: x + 0.8, y: y + 0.48, w: 3.4, h: 0.65, fontSize: 10.5, color: C.text2, align: 'left' });
    });
}

// ════════════════════════════════════════════════════════════════════════════
// SLIDE 3 — La solución
// ════════════════════════════════════════════════════════════════════════════
{
    const s = pres.addSlide();
    s.background = { color: C.navy };

    s.addText('La solución', { x: 0.6, y: 0.4, w: 8.8, h: 0.6, fontSize: 13, bold: true, color: C.green, align: 'left', charSpacing: 3 });
    s.addText('Vendix — Todo lo que necesita\ntu negocio en una plataforma', {
        x: 0.6, y: 0.85, w: 8.8, h: 1.2,
        fontSize: 30, bold: true, color: C.white, align: 'left'
    });

    const features = [
        { icon: '📦', label: 'Inventario', color: C.indigo },
        { icon: '🛒', label: 'Ventas', color: C.purple },
        { icon: '👥', label: 'Vendedores', color: C.green },
        { icon: '📊', label: 'Reportes', color: C.amber },
        { icon: '🔒', label: 'Seguridad', color: '3b82f6' },
        { icon: '☁️', label: 'En la nube', color: 'f43f5e' },
    ];

    features.forEach((f, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const x = 0.5 + col * 3.1;
        const y = 2.35 + row * 1.55;
        s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 2.8, h: 1.3, fill: { color: C.surface }, rectRadius: 0.12, shadow: makeShadow() });
        s.addShape(pres.shapes.OVAL, { x: x + 0.18, y: y + 0.18, w: 0.62, h: 0.62, fill: { color: f.color, transparency: 80 }, line: { color: f.color, transparency: 60 } });
        s.addText(f.icon, { x: x + 0.18, y: y + 0.18, w: 0.62, h: 0.62, fontSize: 18, align: 'center', valign: 'middle', margin: 0 });
        s.addText(f.label, { x: x + 0.92, y: y + 0.1, w: 1.72, h: 0.5, fontSize: 14, bold: true, color: C.white, valign: 'middle' });
        s.addText('Incluido en el plan', { x: x + 0.92, y: y + 0.6, w: 1.72, h: 0.4, fontSize: 10, color: C.slate });
    });
}

// ════════════════════════════════════════════════════════════════════════════
// SLIDE 4 — Cómo funciona
// ════════════════════════════════════════════════════════════════════════════
{
    const s = pres.addSlide();
    s.background = { color: C.navy };

    s.addText('Proceso', { x: 0.6, y: 0.4, w: 8.8, h: 0.6, fontSize: 13, bold: true, color: C.indigo, align: 'left', charSpacing: 3 });
    s.addText('Empieza en minutos', {
        x: 0.6, y: 0.85, w: 8.8, h: 0.85,
        fontSize: 34, bold: true, color: C.white, align: 'left'
    });

    const steps = [
        { n: '1', title: 'Regístrate', desc: 'Completa el checkout en el landing. Solo nombre, negocio y teléfono.', color: C.indigo },
        { n: '2', title: 'Recibe acceso', desc: 'En horas recibes tu usuario y contraseña con 3 días de prueba gratis.', color: C.purple },
        { n: '3', title: 'Carga tu inventario', desc: 'Agrega tus productos con precio, stock y categoría en minutos.', color: C.green },
        { n: '4', title: 'Empieza a vender', desc: 'Tus vendedores registran ventas desde cualquier dispositivo.', color: C.amber },
    ];

    steps.forEach((st, i) => {
        const x = 0.45 + i * 2.35;
        const y = 2.0;

        // Card
        s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 2.1, h: 3.1, fill: { color: C.surface }, rectRadius: 0.14, shadow: makeShadow() });

        // Number circle
        s.addShape(pres.shapes.OVAL, { x: x + 0.65, y: y + 0.2, w: 0.8, h: 0.8, fill: { color: st.color }, line: { color: st.color } });
        s.addText(st.n, { x: x + 0.65, y: y + 0.2, w: 0.8, h: 0.8, fontSize: 20, bold: true, color: C.white, align: 'center', valign: 'middle', margin: 0 });

        s.addText(st.title, { x: x + 0.12, y: y + 1.2, w: 1.86, h: 0.5, fontSize: 13, bold: true, color: C.white, align: 'center' });
        s.addText(st.desc, { x: x + 0.12, y: y + 1.7, w: 1.86, h: 1.15, fontSize: 10.5, color: C.text2, align: 'center' });

        // Arrow between cards
        if (i < 3) {
            s.addShape(pres.shapes.LINE, { x: x + 2.15, y: y + 1.55, w: 0.18, h: 0, line: { color: C.indigo, width: 2 } });
        }
    });
}

// ════════════════════════════════════════════════════════════════════════════
// SLIDE 5 — Funcionalidades clave
// ════════════════════════════════════════════════════════════════════════════
{
    const s = pres.addSlide();
    s.background = { color: C.navy };

    s.addText('Funcionalidades', { x: 0.6, y: 0.4, w: 8.8, h: 0.6, fontSize: 13, bold: true, color: C.purple, align: 'left', charSpacing: 3 });
    s.addText('Todo lo que necesitas, sin complicaciones', {
        x: 0.6, y: 0.85, w: 8.8, h: 0.75, fontSize: 28, bold: true, color: C.white, align: 'left'
    });

    const items = [
        { icon: '📦', title: 'Control de inventario', points: ['Stock en tiempo real', 'Alertas de stock bajo', 'Categorías y filtros'] },
        { icon: '🛒', title: 'Registro de ventas', points: ['Ventas con IGV automático', 'Comprobante imprimible', 'Historial completo'] },
        { icon: '👥', title: 'Gestión de vendedores', points: ['Múltiples usuarios', 'Roles y permisos', 'Rendimiento por vendedor'] },
        { icon: '⚙️', title: 'Configuración', points: ['IGV configurable', 'Tema oscuro / claro', 'Ajustes por negocio'] },
    ];

    items.forEach((item, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = 0.5 + col * 4.75;
        const y = 1.85 + row * 1.75;

        s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 4.35, h: 1.55, fill: { color: C.surface }, rectRadius: 0.12, shadow: makeShadow() });
        s.addText(item.icon, { x: x + 0.15, y: y + 0.1, w: 0.65, h: 0.65, fontSize: 24, align: 'center' });
        s.addText(item.title, { x: x + 0.88, y: y + 0.1, w: 3.3, h: 0.42, fontSize: 13, bold: true, color: C.white });
        item.points.forEach((pt, pi) => {
            s.addText('· ' + pt, { x: x + 0.88, y: y + 0.52 + pi * 0.3, w: 3.3, h: 0.28, fontSize: 10.5, color: C.text2 });
        });
    });
}

// ════════════════════════════════════════════════════════════════════════════
// SLIDE 6 — Para quién es
// ════════════════════════════════════════════════════════════════════════════
{
    const s = pres.addSlide();
    s.background = { color: C.navy };

    s.addText('Mercado', { x: 0.6, y: 0.4, w: 8.8, h: 0.6, fontSize: 13, bold: true, color: C.amber, align: 'left', charSpacing: 3 });
    s.addText('¿Para quién es Vendix?', {
        x: 0.6, y: 0.85, w: 8.8, h: 0.75, fontSize: 30, bold: true, color: C.white, align: 'left'
    });

    const targets = [
        { icon: '🛍️', name: 'Tiendas retail', desc: 'Ropa, calzado, accesorios, ferreterías, bazares.' },
        { icon: '🍕', name: 'Restaurantes / cafés', desc: 'Control de insumos y ventas por caja.' },
        { icon: '💊', name: 'Farmacias / botiquines', desc: 'Inventario con fechas de vencimiento y stock crítico.' },
        { icon: '🏪', name: 'Bodegas y minimarkets', desc: 'Múltiples vendedores, turnos, y cierre diario.' },
        { icon: '🔧', name: 'Servicios técnicos', desc: 'Control de repuestos y órdenes de trabajo.' },
        { icon: '📚', name: 'Librerías / papelerías', desc: 'Amplio catálogo con búsqueda rápida.' },
    ];

    targets.forEach((t, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const x = 0.5 + col * 3.15;
        const y = 2.0 + row * 1.6;

        s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 2.85, h: 1.35, fill: { color: C.surface }, rectRadius: 0.12, shadow: makeShadow() });
        s.addText(t.icon, { x: x + 0.12, y: y + 0.1, w: 0.55, h: 0.55, fontSize: 20, align: 'center' });
        s.addText(t.name, { x: x + 0.74, y: y + 0.1, w: 1.97, h: 0.42, fontSize: 12, bold: true, color: C.white });
        s.addText(t.desc, { x: x + 0.74, y: y + 0.52, w: 1.97, h: 0.65, fontSize: 10, color: C.text2 });
    });
}

// ════════════════════════════════════════════════════════════════════════════
// SLIDE 7 — Precio
// ════════════════════════════════════════════════════════════════════════════
{
    const s = pres.addSlide();
    s.background = { color: C.navy };

    s.addText('Pricing', { x: 0.6, y: 0.4, w: 8.8, h: 0.6, fontSize: 13, bold: true, color: C.green, align: 'left', charSpacing: 3 });
    s.addText('Simple y transparente', {
        x: 0.6, y: 0.85, w: 8.8, h: 0.75, fontSize: 30, bold: true, color: C.white, align: 'left'
    });

    // Pricing card — centro
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 2.5, y: 1.9, w: 5, h: 3.3, fill: { color: C.surface }, rectRadius: 0.18, shadow: makeShadow() });

    // Indigo top accent (no es una raya, es un badge pill centrado)
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 3.6, y: 1.75, w: 2.8, h: 0.38, fill: { color: C.indigo }, rectRadius: 0.18 });
    s.addText('Plan Vendix — Todo incluido', { x: 3.6, y: 1.75, w: 2.8, h: 0.38, fontSize: 10.5, bold: true, color: C.white, align: 'center', valign: 'middle' });

    // Precio
    s.addText('S/. 15', { x: 2.5, y: 2.15, w: 3.6, h: 1.1, fontSize: 64, bold: true, color: C.white, align: 'right', valign: 'middle' });
    s.addText([
        { text: '.99', options: { fontSize: 28, bold: true, color: C.white } },
        { text: '\n/mes', options: { fontSize: 13, color: C.slate, breakLine: false } }
    ], { x: 6.1, y: 2.55, w: 1.1, h: 0.9, valign: 'top' });

    // Includes
    const includes = [
        '✓  Inventario ilimitado',
        '✓  Registro de ventas con IGV',
        '✓  Múltiples vendedores',
        '✓  Acceso desde cualquier dispositivo',
        '✓  Soporte incluido',
    ];
    includes.forEach((line, i) => {
        s.addText(line, { x: 2.8, y: 3.25 + i * 0.35, w: 4.4, h: 0.32, fontSize: 12, color: i === 0 ? C.green : C.text2 });
    });

    // Trial badge
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 3.25, y: 5.05, w: 3.5, h: 0.38, fill: { color: C.amber, transparency: 80 }, rectRadius: 0.18, line: { color: C.amber, transparency: 60 } });
    s.addText('3 días de prueba gratis — sin tarjeta', { x: 3.25, y: 5.05, w: 3.5, h: 0.38, fontSize: 11, bold: true, color: C.amber, align: 'center', valign: 'middle' });
}

// ════════════════════════════════════════════════════════════════════════════
// SLIDE 8 — Llamada a acción
// ════════════════════════════════════════════════════════════════════════════
{
    const s = pres.addSlide();
    s.background = { color: C.navy };

    // Decoración
    s.addShape(pres.shapes.OVAL, { x: 6.0, y: -1.0, w: 6, h: 6, fill: { color: C.indigo, transparency: 88 }, line: { color: C.indigo, transparency: 88 } });

    // Logo
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.7, y: 0.55, w: 0.7, h: 0.7, fill: { color: C.indigo }, rectRadius: 0.12 });
    s.addText('V', { x: 0.7, y: 0.55, w: 0.7, h: 0.7, fontSize: 22, bold: true, color: C.white, align: 'center', valign: 'middle', margin: 0 });
    s.addText('Vendix', { x: 1.5, y: 0.6, w: 2, h: 0.6, fontSize: 20, bold: true, color: C.white, align: 'left', valign: 'middle' });

    s.addText('¿Listo para ordenar\ntu negocio?', {
        x: 0.7, y: 1.5, w: 7.5, h: 1.8,
        fontSize: 46, bold: true, color: C.white, align: 'left'
    });

    s.addText('Empieza hoy con 3 días gratis. Sin tarjeta. Sin complicaciones.', {
        x: 0.7, y: 3.3, w: 7, h: 0.6,
        fontSize: 15, color: C.text2, align: 'left'
    });

    // CTA button (simulado con shape + text)
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.7, y: 4.05, w: 3.2, h: 0.65, fill: { color: C.indigo }, rectRadius: 0.3, shadow: makeShadow() });
    s.addText('Empezar gratis →', { x: 0.7, y: 4.05, w: 3.2, h: 0.65, fontSize: 14, bold: true, color: C.white, align: 'center', valign: 'middle', margin: 0 });

    // Contact info
    s.addText([
        { text: '🌐  ', options: { fontSize: 12 } },
        { text: 'vendix.vercel.app', options: { fontSize: 12, color: C.ice } },
        { text: '      📧  ', options: { fontSize: 12, color: C.white } },
        { text: 'soporte@vendix.pe', options: { fontSize: 12, color: C.ice } },
    ], { x: 0.7, y: 4.9, w: 6, h: 0.4, color: C.slate });
}

// ── Exportar ──────────────────────────────────────────────────────────────
pres.writeFile({ fileName: 'C:/Users/eduac/CascadeProjects/inventory-sales-dashboard-postgres/Vendix-Presentacion.pptx' })
    .then(() => console.log('OK: Vendix-Presentacion.pptx creado'))
    .catch(e => { console.error(e); process.exit(1); });
