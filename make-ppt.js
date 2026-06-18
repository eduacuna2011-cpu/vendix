const pptxgen = require('pptxgenjs');
const path = require('path');

const SS = path.join(__dirname, 'screenshots');
const OUT = path.join(__dirname, 'Vendix_Guia_Cliente.pptx');

// Colors
const NAVY   = '0F172A';
const INDIGO = '6366F1';
const LIGHT  = 'F8FAFC';
const WHITE  = 'FFFFFF';
const GRAY   = '64748B';
const GREEN  = '10B981';

let pres = new pptxgen();
pres.layout = 'LAYOUT_16x9';
pres.title  = 'Vendix — Guía de Usuario';
pres.author = 'Vendix';

// ──────────────────────────────────────────────────────────
// SLIDE 1 — PORTADA
// ──────────────────────────────────────────────────────────
{
    let s = pres.addSlide();
    s.background = { color: NAVY };

    // Purple glow circle behind logo
    s.addShape(pres.ShapeType.ellipse, {
        x: 0.5, y: 0.5, w: 2.8, h: 2.8,
        fill: { color: INDIGO, transparency: 80 }, line: { color: INDIGO, transparency: 70 }
    });

    // Logo mark
    s.addShape(pres.ShapeType.roundRect, {
        x: 1.0, y: 0.9, w: 1.8, h: 1.8,
        rectRadius: 0.2,
        fill: { color: INDIGO }, line: { color: INDIGO }
    });
    s.addText('V', {
        x: 1.0, y: 0.9, w: 1.8, h: 1.8,
        fontSize: 56, fontFace: 'Calibri', bold: true, color: WHITE,
        align: 'center', valign: 'middle', margin: 0
    });

    // Title
    s.addText('Vendix', {
        x: 3.1, y: 1.0, w: 6.5, h: 1.0,
        fontSize: 52, fontFace: 'Calibri', bold: true, color: WHITE,
        align: 'left', margin: 0
    });

    // Subtitle
    s.addText('Guía de uso para tu equipo', {
        x: 3.1, y: 2.0, w: 6.5, h: 0.6,
        fontSize: 22, fontFace: 'Calibri', color: 'A5B4FC',
        align: 'left', margin: 0
    });

    // Divider line
    s.addShape(pres.ShapeType.rect, {
        x: 0.5, y: 3.1, w: 9.0, h: 0.03,
        fill: { color: INDIGO, transparency: 50 }, line: { color: INDIGO, transparency: 50 }
    });

    // Description
    s.addText('Sistema de inventario, ventas y reportes para negocios peruanos', {
        x: 0.5, y: 3.3, w: 9.0, h: 0.5,
        fontSize: 15, fontFace: 'Calibri', color: '94A3B8',
        align: 'center', margin: 0
    });

    // Tagline chips
    const chips = ['✓  Inventario en tiempo real', '✓  Punto de venta rápido', '✓  Reportes al instante', '✓  Bot de Telegram'];
    chips.forEach((c, i) => {
        s.addShape(pres.ShapeType.roundRect, {
            x: 0.5 + i*2.35, y: 4.1, w: 2.2, h: 0.45,
            rectRadius: 0.1,
            fill: { color: INDIGO, transparency: 75 }, line: { color: INDIGO, transparency: 55 }
        });
        s.addText(c, {
            x: 0.5 + i*2.35, y: 4.1, w: 2.2, h: 0.45,
            fontSize: 10, fontFace: 'Calibri', color: 'C7D2FE',
            align: 'center', valign: 'middle', margin: 0
        });
    });

    // URL
    s.addText('vendix-app.vercel.app', {
        x: 0.5, y: 5.0, w: 9.0, h: 0.35,
        fontSize: 12, fontFace: 'Calibri', color: '475569',
        align: 'center', margin: 0
    });
}

// Helper: slide with navy left panel + white right content
function slideLayout(title, step, leftLines) {
    let s = pres.addSlide();
    s.background = { color: LIGHT };

    // Left navy panel
    s.addShape(pres.ShapeType.rect, {
        x: 0, y: 0, w: 3.2, h: 5.625,
        fill: { color: NAVY }, line: { color: NAVY }
    });

    // Step badge
    s.addShape(pres.ShapeType.ellipse, {
        x: 1.1, y: 0.35, w: 1.0, h: 1.0,
        fill: { color: INDIGO }, line: { color: INDIGO }
    });
    s.addText(String(step), {
        x: 1.1, y: 0.35, w: 1.0, h: 1.0,
        fontSize: 28, fontFace: 'Calibri', bold: true, color: WHITE,
        align: 'center', valign: 'middle', margin: 0
    });

    // Left title
    s.addText(title, {
        x: 0.2, y: 1.55, w: 2.8, h: 0.8,
        fontSize: 18, fontFace: 'Calibri', bold: true, color: WHITE,
        align: 'center', wrap: true, margin: 0
    });

    // Left bullets
    if (leftLines && leftLines.length) {
        s.addText(leftLines.map((l, i) => ({
            text: l,
            options: { bullet: true, breakLine: i < leftLines.length - 1, fontSize: 11, fontFace: 'Calibri', color: 'A5B4FC' }
        })), {
            x: 0.25, y: 2.5, w: 2.7, h: 2.8
        });
    }
    return s;
}

// ──────────────────────────────────────────────────────────
// SLIDE 2 — INGRESO AL SISTEMA
// ──────────────────────────────────────────────────────────
{
    let s = slideLayout('Ingreso\nal sistema', 1, [
        'Abre tu navegador',
        'Ve a vendix-app.vercel.app',
        'Ingresa tu usuario y contraseña',
        'Haz clic en "Iniciar Sesión"'
    ]);

    s.addText('Cómo ingresar a Vendix', {
        x: 3.4, y: 0.35, w: 6.3, h: 0.55,
        fontSize: 24, fontFace: 'Calibri', bold: true, color: NAVY,
        align: 'left', margin: 0
    });

    s.addImage({
        path: path.join(SS, '00_login.png'),
        x: 3.4, y: 1.05, w: 6.3, h: 4.0
    });

    // Tip box
    s.addShape(pres.ShapeType.roundRect, {
        x: 3.4, y: 5.15, w: 6.3, h: 0.3,
        rectRadius: 0.06,
        fill: { color: GREEN, transparency: 88 }, line: { color: GREEN, transparency: 70 }
    });
    s.addText('💡  Si olvidaste tu contraseña, escríbele a tu administrador por WhatsApp.', {
        x: 3.4, y: 5.15, w: 6.3, h: 0.3,
        fontSize: 9, fontFace: 'Calibri', color: '065F46',
        align: 'center', valign: 'middle', margin: 0
    });
}

// ──────────────────────────────────────────────────────────
// SLIDE 3 — DASHBOARD
// ──────────────────────────────────────────────────────────
{
    let s = slideLayout('Panel\nPrincipal', 2, [
        'Ingresos del mes',
        'Ganancia neta',
        'Órdenes del mes',
        'Vendedores activos',
        'Alertas de stock bajo',
        'Gráfica de ventas',
        'Top vendedores'
    ]);

    s.addText('Dashboard — Vista general', {
        x: 3.4, y: 0.35, w: 6.3, h: 0.55,
        fontSize: 24, fontFace: 'Calibri', bold: true, color: NAVY,
        align: 'left', margin: 0
    });

    s.addImage({
        path: path.join(SS, '01_dashboard.png'),
        x: 3.4, y: 1.05, w: 6.3, h: 4.0
    });

    s.addText('Al ingresar verás este resumen automático de tu negocio', {
        x: 3.4, y: 5.15, w: 6.3, h: 0.3,
        fontSize: 9, fontFace: 'Calibri', color: GRAY,
        align: 'center', margin: 0
    });
}

// ──────────────────────────────────────────────────────────
// SLIDE 4 — INVENTARIO
// ──────────────────────────────────────────────────────────
{
    let s = slideLayout('Inventario', 3, [
        'Ver todos tus productos',
        'Buscar por nombre',
        'Filtrar por categoría',
        'Ver stock disponible',
        'Editar productos',
        'Eliminar productos'
    ]);

    s.addText('Módulo de Inventario', {
        x: 3.4, y: 0.35, w: 6.3, h: 0.55,
        fontSize: 24, fontFace: 'Calibri', bold: true, color: NAVY,
        align: 'left', margin: 0
    });

    s.addImage({
        path: path.join(SS, '02_inventory.png'),
        x: 3.4, y: 1.05, w: 6.3, h: 4.0
    });

    s.addText('Administra todos tus productos desde un solo lugar', {
        x: 3.4, y: 5.15, w: 6.3, h: 0.3,
        fontSize: 9, fontFace: 'Calibri', color: GRAY,
        align: 'center', margin: 0
    });
}

// ──────────────────────────────────────────────────────────
// SLIDE 5 — AGREGAR PRODUCTO
// ──────────────────────────────────────────────────────────
{
    let s = slideLayout('Agregar\nProducto', 4, [
        'Clic en "+ Add Product"',
        'Sube una foto del producto',
        'Ingresa SKU y nombre',
        'Selecciona categoría y color',
        'Define precio de costo y venta',
        'Indica el stock inicial',
        'Clic en "Save"'
    ]);

    s.addText('Cómo agregar un producto', {
        x: 3.4, y: 0.35, w: 6.3, h: 0.55,
        fontSize: 24, fontFace: 'Calibri', bold: true, color: NAVY,
        align: 'left', margin: 0
    });

    s.addImage({
        path: path.join(SS, '03_add_product_modal.png'),
        x: 3.4, y: 1.05, w: 6.3, h: 4.0
    });

    s.addShape(pres.ShapeType.roundRect, {
        x: 3.4, y: 5.15, w: 6.3, h: 0.3,
        rectRadius: 0.06,
        fill: { color: INDIGO, transparency: 88 }, line: { color: INDIGO, transparency: 70 }
    });
    s.addText('💡  El SKU debe ser único. Puedes usar el código del proveedor o crear el tuyo.', {
        x: 3.4, y: 5.15, w: 6.3, h: 0.3,
        fontSize: 9, fontFace: 'Calibri', color: '3730A3',
        align: 'center', valign: 'middle', margin: 0
    });
}

// ──────────────────────────────────────────────────────────
// SLIDE 6 — PUNTO DE VENTA
// ──────────────────────────────────────────────────────────
{
    let s = slideLayout('Punto\nde Venta', 5, [
        'Busca el producto',
        'Haz clic para agregar al carrito',
        'Ajusta la cantidad',
        'Selecciona método de pago',
        'Confirma la venta',
        'El recibo se genera automático',
        'Comparte por WhatsApp'
    ]);

    s.addText('Registrar una Venta', {
        x: 3.4, y: 0.35, w: 6.3, h: 0.55,
        fontSize: 24, fontFace: 'Calibri', bold: true, color: NAVY,
        align: 'left', margin: 0
    });

    s.addImage({
        path: path.join(SS, '04_sales.png'),
        x: 3.4, y: 1.05, w: 6.3, h: 4.0
    });

    s.addText('Panel izquierdo: productos disponibles  |  Panel derecho: carrito de compra', {
        x: 3.4, y: 5.15, w: 6.3, h: 0.3,
        fontSize: 9, fontFace: 'Calibri', color: GRAY,
        align: 'center', margin: 0
    });
}

// ──────────────────────────────────────────────────────────
// SLIDE 7 — VENDEDORES
// ──────────────────────────────────────────────────────────
{
    let s = slideLayout('Vendedores', 6, [
        'Ver todos los vendedores',
        'Agregar nuevo vendedor',
        'Ver performance por vendedor',
        'Activar / desactivar cuentas',
        'Cada vendedor tiene su propio usuario y contraseña',
    ]);

    s.addText('Gestión de Vendedores', {
        x: 3.4, y: 0.35, w: 6.3, h: 0.55,
        fontSize: 24, fontFace: 'Calibri', bold: true, color: NAVY,
        align: 'left', margin: 0
    });

    s.addImage({
        path: path.join(SS, '05_sellers.png'),
        x: 3.4, y: 1.05, w: 6.3, h: 4.0
    });

    s.addShape(pres.ShapeType.roundRect, {
        x: 3.4, y: 5.15, w: 6.3, h: 0.3,
        rectRadius: 0.06,
        fill: { color: GREEN, transparency: 88 }, line: { color: GREEN, transparency: 70 }
    });
    s.addText('💡  Cada vendedor solo ve sus propias ventas. El admin ve todo.', {
        x: 3.4, y: 5.15, w: 6.3, h: 0.3,
        fontSize: 9, fontFace: 'Calibri', color: '065F46',
        align: 'center', valign: 'middle', margin: 0
    });
}

// ──────────────────────────────────────────────────────────
// SLIDE 8 — AJUSTES
// ──────────────────────────────────────────────────────────
{
    let s = slideLayout('Ajustes', 7, [
        'Editar perfil',
        'Cambiar contraseña',
        'Apariencia (claro/oscuro)',
        'Configurar impuestos',
        'Info del negocio',
    ]);

    s.addText('Ajustes de Cuenta', {
        x: 3.4, y: 0.35, w: 6.3, h: 0.55,
        fontSize: 24, fontFace: 'Calibri', bold: true, color: NAVY,
        align: 'left', margin: 0
    });

    s.addImage({
        path: path.join(SS, '07_settings.png'),
        x: 3.4, y: 1.05, w: 6.3, h: 4.0
    });

    s.addText('Personaliza tu experiencia y la configuración de tu negocio', {
        x: 3.4, y: 5.15, w: 6.3, h: 0.3,
        fontSize: 9, fontFace: 'Calibri', color: GRAY,
        align: 'center', margin: 0
    });
}

// ──────────────────────────────────────────────────────────
// SLIDE 9 — BOT TELEGRAM
// ──────────────────────────────────────────────────────────
{
    let s = pres.addSlide();
    s.background = { color: NAVY };

    // Telegram blue header bar
    s.addShape(pres.ShapeType.rect, {
        x: 0, y: 0, w: 10, h: 1.3,
        fill: { color: '229ED9' }, line: { color: '229ED9' }
    });

    s.addText('🤖  Bot de Telegram — @vendixadmin_bot', {
        x: 0.4, y: 0.0, w: 9.2, h: 1.3,
        fontSize: 24, fontFace: 'Calibri', bold: true, color: WHITE,
        align: 'left', valign: 'middle', margin: 0
    });

    s.addText('Gestiona tu negocio directamente desde Telegram, sin abrir el navegador:', {
        x: 0.5, y: 1.5, w: 9.0, h: 0.4,
        fontSize: 13, fontFace: 'Calibri', color: '94A3B8',
        align: 'left', margin: 0
    });

    const features = [
        { icon: '📦', title: 'Ver inventario', desc: 'Consulta el stock de cualquier producto al instante' },
        { icon: '💰', title: 'Registrar ventas', desc: 'Vende sin abrir el dashboard — recibo automático' },
        { icon: '➕', title: 'Agregar productos', desc: 'Agrega nuevo stock con foto, precio y cantidad' },
        { icon: '📊', title: 'Estadísticas del día', desc: 'Ventas, ganancia y órdenes del día en segundos' },
    ];

    features.forEach((f, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = 0.5 + col * 4.8;
        const y = 2.1 + row * 1.35;

        s.addShape(pres.ShapeType.roundRect, {
            x, y, w: 4.5, h: 1.1,
            rectRadius: 0.12,
            fill: { color: WHITE, transparency: 92 }, line: { color: WHITE, transparency: 80 }
        });
        s.addText(f.icon, {
            x: x + 0.15, y, w: 0.7, h: 1.1,
            fontSize: 24, fontFace: 'Calibri',
            align: 'center', valign: 'middle', margin: 0
        });
        s.addText(f.title, {
            x: x + 0.9, y: y + 0.05, w: 3.4, h: 0.4,
            fontSize: 13, fontFace: 'Calibri', bold: true, color: WHITE,
            align: 'left', margin: 0
        });
        s.addText(f.desc, {
            x: x + 0.9, y: y + 0.45, w: 3.4, h: 0.5,
            fontSize: 10, fontFace: 'Calibri', color: '94A3B8',
            align: 'left', margin: 0
        });
    });

    // CTA
    s.addShape(pres.ShapeType.roundRect, {
        x: 2.5, y: 4.85, w: 5.0, h: 0.55,
        rectRadius: 0.1,
        fill: { color: '229ED9' }, line: { color: '229ED9' }
    });
    s.addText('Abrir @vendixadmin_bot en Telegram', {
        x: 2.5, y: 4.85, w: 5.0, h: 0.55,
        fontSize: 14, fontFace: 'Calibri', bold: true, color: WHITE,
        align: 'center', valign: 'middle', margin: 0
    });
}

// ──────────────────────────────────────────────────────────
// SLIDE 10 — CIERRE
// ──────────────────────────────────────────────────────────
{
    let s = pres.addSlide();
    s.background = { color: NAVY };

    s.addShape(pres.ShapeType.ellipse, {
        x: 3.5, y: -1.5, w: 3.0, h: 3.0,
        fill: { color: INDIGO, transparency: 85 }, line: { color: INDIGO, transparency: 80 }
    });

    s.addShape(pres.ShapeType.roundRect, {
        x: 4.3, y: 0.7, w: 1.4, h: 1.4,
        rectRadius: 0.15,
        fill: { color: INDIGO }, line: { color: INDIGO }
    });
    s.addText('V', {
        x: 4.3, y: 0.7, w: 1.4, h: 1.4,
        fontSize: 42, fontFace: 'Calibri', bold: true, color: WHITE,
        align: 'center', valign: 'middle', margin: 0
    });

    s.addText('¡Listo para empezar!', {
        x: 0.5, y: 2.3, w: 9.0, h: 0.8,
        fontSize: 34, fontFace: 'Calibri', bold: true, color: WHITE,
        align: 'center', margin: 0
    });

    s.addText('Cualquier duda escríbenos por WhatsApp o usa el bot de Telegram', {
        x: 1.0, y: 3.2, w: 8.0, h: 0.5,
        fontSize: 14, fontFace: 'Calibri', color: '94A3B8',
        align: 'center', margin: 0
    });

    // Contact pills
    s.addShape(pres.ShapeType.roundRect, {
        x: 1.5, y: 3.95, w: 3.0, h: 0.55,
        rectRadius: 0.1,
        fill: { color: '25D366' }, line: { color: '25D366' }
    });
    s.addText('📱  WhatsApp', {
        x: 1.5, y: 3.95, w: 3.0, h: 0.55,
        fontSize: 14, fontFace: 'Calibri', bold: true, color: WHITE,
        align: 'center', valign: 'middle', margin: 0
    });

    s.addShape(pres.ShapeType.roundRect, {
        x: 5.5, y: 3.95, w: 3.0, h: 0.55,
        rectRadius: 0.1,
        fill: { color: '229ED9' }, line: { color: '229ED9' }
    });
    s.addText('🤖  @vendixadmin_bot', {
        x: 5.5, y: 3.95, w: 3.0, h: 0.55,
        fontSize: 14, fontFace: 'Calibri', bold: true, color: WHITE,
        align: 'center', valign: 'middle', margin: 0
    });

    s.addText('vendix-app.vercel.app', {
        x: 0.5, y: 4.9, w: 9.0, h: 0.4,
        fontSize: 12, fontFace: 'Calibri', color: '334155',
        align: 'center', margin: 0
    });
}

pres.writeFile({ fileName: OUT }).then(() => {
    console.log('✅ PPT creado:', OUT);
}).catch(e => console.error('Error:', e));
