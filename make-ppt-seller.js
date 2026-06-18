const pptxgen = require('pptxgenjs');
const path = require('path');

const SS = 'C:\\Users\\eduac\\OneDrive\\Pictures\\Screenshots';
const LOGIN  = path.join(__dirname, 'screenshots', '00_login.png');
const DASH   = path.join(SS, 'Screenshot 2026-06-16 171030.png');
const INV    = path.join(SS, 'Screenshot 2026-06-16 171047.png');
const SALES  = path.join(SS, 'Screenshot 2026-06-16 171102.png');
const SETT   = path.join(SS, 'Screenshot 2026-06-16 171110.png');
const OUT    = path.join(__dirname, 'Vendix_Guia_Vendedor.pptx');

const NAVY   = '0F172A';
const INDIGO = '6366F1';
const WHITE  = 'FFFFFF';
const GRAY   = '64748B';
const GREEN  = '10B981';
const LIGHT  = 'F8FAFC';

let pres = new pptxgen();
pres.layout  = 'LAYOUT_16x9';
pres.title   = 'Vendix — Guía del Vendedor';
pres.author  = 'Vendix';

// ── helper: navy left panel slide ────────────────────────
function makeSlide(stepNum, leftTitle, bullets) {
    let s = pres.addSlide();
    s.background = { color: LIGHT };

    // Navy left panel
    s.addShape(pres.ShapeType.rect, { x:0, y:0, w:3.1, h:5.625, fill:{color:NAVY}, line:{color:NAVY} });

    // Step circle
    s.addShape(pres.ShapeType.ellipse, { x:1.05, y:0.3, w:1.0, h:1.0, fill:{color:INDIGO}, line:{color:INDIGO} });
    s.addText(String(stepNum), { x:1.05, y:0.3, w:1.0, h:1.0, fontSize:28, fontFace:'Calibri', bold:true, color:WHITE, align:'center', valign:'middle', margin:0 });

    // Left title
    s.addText(leftTitle, { x:0.18, y:1.5, w:2.74, h:0.9, fontSize:16, fontFace:'Calibri', bold:true, color:WHITE, align:'center', wrap:true, margin:0 });

    // Left bullets
    if (bullets && bullets.length) {
        s.addText(
            bullets.map((b, i) => ({ text: b, options: { bullet:true, breakLine: i < bullets.length-1, fontSize:10.5, fontFace:'Calibri', color:'A5B4FC' } })),
            { x:0.2, y:2.55, w:2.7, h:2.8 }
        );
    }
    return s;
}

// ── SLIDE 1 — PORTADA ────────────────────────────────────
{
    let s = pres.addSlide();
    s.background = { color: NAVY };

    s.addShape(pres.ShapeType.ellipse, { x:0.3, y:0.2, w:3.2, h:3.2, fill:{color:INDIGO, transparency:85}, line:{color:INDIGO, transparency:80} });

    s.addShape(pres.ShapeType.roundRect, { x:0.9, y:0.75, w:1.9, h:1.9, rectRadius:0.2, fill:{color:INDIGO}, line:{color:INDIGO} });
    s.addText('V', { x:0.9, y:0.75, w:1.9, h:1.9, fontSize:60, fontFace:'Calibri', bold:true, color:WHITE, align:'center', valign:'middle', margin:0 });

    s.addText('Vendix', { x:3.2, y:0.8, w:6.4, h:1.0, fontSize:52, fontFace:'Calibri', bold:true, color:WHITE, align:'left', margin:0 });
    s.addText('Guía para Vendedores', { x:3.2, y:1.85, w:6.4, h:0.6, fontSize:22, fontFace:'Calibri', color:'A5B4FC', align:'left', margin:0 });

    s.addShape(pres.ShapeType.rect, { x:0.5, y:3.0, w:9.0, h:0.03, fill:{color:INDIGO, transparency:50}, line:{color:INDIGO, transparency:50} });

    s.addText('Todo lo que necesitas saber para registrar ventas, ver tu inventario y gestionar tu perfil', {
        x:0.5, y:3.15, w:9.0, h:0.55, fontSize:13, fontFace:'Calibri', color:'94A3B8', align:'center', margin:0
    });

    // Role chips
    const chips = [
        { label:'📦  Ver Inventario', color:'1E3A5F' },
        { label:'💰  Registrar Ventas', color:'1E3A5F' },
        { label:'🤖  Bot Telegram', color:'1E3A5F' },
        { label:'⚙️  Tu Perfil', color:'1E3A5F' },
    ];
    chips.forEach((c, i) => {
        s.addShape(pres.ShapeType.roundRect, { x:0.5+i*2.35, y:3.9, w:2.2, h:0.48, rectRadius:0.1, fill:{color:INDIGO, transparency:72}, line:{color:INDIGO, transparency:55} });
        s.addText(c.label, { x:0.5+i*2.35, y:3.9, w:2.2, h:0.48, fontSize:11, fontFace:'Calibri', color:'C7D2FE', align:'center', valign:'middle', margin:0 });
    });

    s.addText('vendix-app.vercel.app  ·  @vendixadmin_bot', { x:0.5, y:5.1, w:9.0, h:0.3, fontSize:11, fontFace:'Calibri', color:'334155', align:'center', margin:0 });
}

// ── SLIDE 2 — CÓMO INGRESAR ──────────────────────────────
{
    let s = makeSlide(1, 'Cómo\ningresar', [
        'Abre tu navegador (Chrome, Safari, etc.)',
        'Escribe: vendix-app.vercel.app',
        'Ingresa tu usuario y contraseña',
        'Haz clic en "Iniciar Sesión"',
        'Si olvidaste tu contraseña,',
        'avisa a tu administrador',
    ]);
    s.addText('Paso 1 — Ingresar al sistema', { x:3.3, y:0.3, w:6.4, h:0.55, fontSize:23, fontFace:'Calibri', bold:true, color:NAVY, align:'left', margin:0 });
    s.addText('Accede desde cualquier dispositivo — celular, tablet o computadora. No necesitas instalar nada.', {
        x:3.3, y:0.9, w:6.4, h:0.45, fontSize:11, fontFace:'Calibri', color:GRAY, align:'left', margin:0
    });
    s.addImage({ path:LOGIN, x:3.3, y:1.4, w:6.4, h:3.8 });
    s.addShape(pres.ShapeType.roundRect, { x:3.3, y:5.28, w:6.4, h:0.28, rectRadius:0.06, fill:{color:GREEN, transparency:88}, line:{color:GREEN, transparency:70} });
    s.addText('💡  Tu usuario y contraseña te los envía tu administrador por WhatsApp.', { x:3.3, y:5.28, w:6.4, h:0.28, fontSize:9, fontFace:'Calibri', color:'065F46', align:'center', valign:'middle', margin:0 });
}

// ── SLIDE 3 — DASHBOARD DEL VENDEDOR ────────────────────
{
    let s = makeSlide(2, 'Tu Panel\nPrincipal', [
        'Total de órdenes realizadas',
        'Total de ventas en soles',
        'Comisión ganada',
        'Valor promedio por orden',
        'Banner del bot de Telegram',
        'Historial de transacciones recientes',
    ]);
    s.addText('Paso 2 — Tu Dashboard', { x:3.3, y:0.3, w:6.4, h:0.55, fontSize:23, fontFace:'Calibri', bold:true, color:NAVY, align:'left', margin:0 });
    s.addText('Al ingresar verás tu resumen personal. Aquí puedes ver tus ventas del día y tu comisión acumulada.', {
        x:3.3, y:0.9, w:6.4, h:0.45, fontSize:11, fontFace:'Calibri', color:GRAY, align:'left', margin:0
    });
    s.addImage({ path:DASH, x:3.3, y:1.4, w:6.4, h:3.8 });
    s.addShape(pres.ShapeType.roundRect, { x:3.3, y:5.28, w:6.4, h:0.28, rectRadius:0.06, fill:{color:INDIGO, transparency:88}, line:{color:INDIGO, transparency:70} });
    s.addText('ℹ️  Solo ves tus propias ventas y comisiones. El administrador ve los datos de todos.', { x:3.3, y:5.28, w:6.4, h:0.28, fontSize:9, fontFace:'Calibri', color:'3730A3', align:'center', valign:'middle', margin:0 });
}

// ── SLIDE 4 — INVENTARIO (READ ONLY) ────────────────────
{
    let s = makeSlide(3, 'Ver\nInventario', [
        'Mira todos los productos disponibles',
        'Busca por nombre de producto',
        'Filtra por categoría, color o talla',
        'Consulta el stock en tiempo real',
        'Ve el precio de venta de cada producto',
        'Acceso de solo lectura (Read-only)',
        'No puedes editar ni eliminar productos',
    ]);
    s.addText('Paso 3 — Consultar el Inventario', { x:3.3, y:0.3, w:6.4, h:0.55, fontSize:23, fontFace:'Calibri', bold:true, color:NAVY, align:'left', margin:0 });
    s.addText('Revisa qué productos tienes disponibles antes de registrar una venta. Puedes buscar y filtrar fácilmente.', {
        x:3.3, y:0.9, w:6.4, h:0.45, fontSize:11, fontFace:'Calibri', color:GRAY, align:'left', margin:0
    });
    s.addImage({ path:INV, x:3.3, y:1.4, w:6.4, h:3.8 });
    s.addShape(pres.ShapeType.roundRect, { x:3.3, y:5.28, w:6.4, h:0.28, rectRadius:0.06, fill:{color:'F59E0B', transparency:88}, line:{color:'F59E0B', transparency:70} });
    s.addText('⚠️  Si un producto dice "Read-only" no puedes modificarlo — solo consultarlo.', { x:3.3, y:5.28, w:6.4, h:0.28, fontSize:9, fontFace:'Calibri', color:'92400E', align:'center', valign:'middle', margin:0 });
}

// ── SLIDE 5 — REGISTRAR VENTA ────────────────────────────
{
    let s = makeSlide(4, 'Registrar\nuna Venta', [
        'Ve al módulo "Sales" en el menú',
        'Busca el producto a vender',
        'Haz clic en el producto para agregarlo',
        'Ajusta la cantidad si es necesario',
        'Selecciona el método de pago',
        'Haz clic en "Confirm Sale"',
        'Se genera el recibo automáticamente',
        'Comparte el recibo por WhatsApp',
    ]);
    s.addText('Paso 4 — Registrar una Venta', { x:3.3, y:0.3, w:6.4, h:0.55, fontSize:23, fontFace:'Calibri', bold:true, color:NAVY, align:'left', margin:0 });
    s.addText('El panel izquierdo muestra los productos disponibles. El carrito (derecha) acumula los artículos de la venta.', {
        x:3.3, y:0.9, w:6.4, h:0.45, fontSize:11, fontFace:'Calibri', color:GRAY, align:'left', margin:0
    });
    s.addImage({ path:SALES, x:3.3, y:1.4, w:6.4, h:3.8 });
    s.addShape(pres.ShapeType.roundRect, { x:3.3, y:5.28, w:6.4, h:0.28, rectRadius:0.06, fill:{color:GREEN, transparency:88}, line:{color:GREEN, transparency:70} });
    s.addText('💡  Puedes agregar varios productos a la misma venta antes de confirmar.', { x:3.3, y:5.28, w:6.4, h:0.28, fontSize:9, fontFace:'Calibri', color:'065F46', align:'center', valign:'middle', margin:0 });
}

// ── SLIDE 6 — AJUSTES / PERFIL ───────────────────────────
{
    let s = makeSlide(5, 'Tu Perfil\ny Ajustes', [
        'Edita tu nombre completo',
        'Agrega tu correo electrónico',
        'Actualiza tu número de teléfono',
        'Cambia tu contraseña (Security)',
        'Ajusta la apariencia (claro/oscuro)',
        'Revisa info de tu cuenta',
        'Haz clic en "Save Changes" al terminar',
    ]);
    s.addText('Paso 5 — Tu Perfil y Ajustes', { x:3.3, y:0.3, w:6.4, h:0.55, fontSize:23, fontFace:'Calibri', bold:true, color:NAVY, align:'left', margin:0 });
    s.addText('Desde Ajustes puedes actualizar tus datos personales y cambiar tu contraseña cuando lo necesites.', {
        x:3.3, y:0.9, w:6.4, h:0.45, fontSize:11, fontFace:'Calibri', color:GRAY, align:'left', margin:0
    });
    s.addImage({ path:SETT, x:3.3, y:1.4, w:6.4, h:3.8 });
    s.addShape(pres.ShapeType.roundRect, { x:3.3, y:5.28, w:6.4, h:0.28, rectRadius:0.06, fill:{color:INDIGO, transparency:88}, line:{color:INDIGO, transparency:70} });
    s.addText('🔒  Cambia tu contraseña regularmente desde la sección "Security" para mayor seguridad.', { x:3.3, y:5.28, w:6.4, h:0.28, fontSize:9, fontFace:'Calibri', color:'3730A3', align:'center', valign:'middle', margin:0 });
}

// ── SLIDE 7 — TELEGRAM BOT ───────────────────────────────
{
    let s = pres.addSlide();
    s.background = { color: NAVY };

    s.addShape(pres.ShapeType.rect, { x:0, y:0, w:10, h:1.2, fill:{color:'229ED9'}, line:{color:'229ED9'} });
    s.addText('🤖  Bot de Telegram — Tu asistente en el celular', { x:0.4, y:0, w:9.2, h:1.2, fontSize:22, fontFace:'Calibri', bold:true, color:WHITE, align:'left', valign:'middle', margin:0 });

    s.addText('Puedes registrar ventas y consultar inventario directamente desde Telegram, sin abrir el navegador:', {
        x:0.5, y:1.35, w:9.0, h:0.4, fontSize:12, fontFace:'Calibri', color:'94A3B8', align:'left', margin:0
    });

    const features = [
        { icon:'📦', title:'Ver inventario', desc:'Escribe /inventario y consulta el stock de cualquier producto al instante desde tu celular.' },
        { icon:'💰', title:'Registrar ventas', desc:'Escribe /vender y sigue los pasos — el bot te guía y genera el recibo automáticamente.' },
        { icon:'📊', title:'Mis ventas del día', desc:'Consulta cuánto llevas vendido hoy y tu comisión acumulada en segundos.' },
        { icon:'🔔', title:'Alertas de stock bajo', desc:'Recibe notificaciones cuando un producto tiene poco stock disponible.' },
    ];

    features.forEach((f, i) => {
        const col = i % 2, row = Math.floor(i / 2);
        const x = 0.5 + col * 4.85, y = 1.9 + row * 1.4;
        s.addShape(pres.ShapeType.roundRect, { x, y, w:4.6, h:1.2, rectRadius:0.12, fill:{color:WHITE, transparency:92}, line:{color:WHITE, transparency:80} });
        s.addText(f.icon, { x:x+0.15, y, w:0.7, h:1.2, fontSize:26, fontFace:'Calibri', align:'center', valign:'middle', margin:0 });
        s.addText(f.title, { x:x+0.9, y:y+0.08, w:3.5, h:0.38, fontSize:13, fontFace:'Calibri', bold:true, color:WHITE, align:'left', margin:0 });
        s.addText(f.desc, { x:x+0.9, y:y+0.46, w:3.5, h:0.6, fontSize:9.5, fontFace:'Calibri', color:'94A3B8', align:'left', margin:0 });
    });

    s.addShape(pres.ShapeType.roundRect, { x:2.7, y:4.9, w:4.6, h:0.52, rectRadius:0.1, fill:{color:'229ED9'}, line:{color:'229ED9'} });
    s.addText('Abrir @vendixadmin_bot en Telegram', { x:2.7, y:4.9, w:4.6, h:0.52, fontSize:14, fontFace:'Calibri', bold:true, color:WHITE, align:'center', valign:'middle', margin:0 });
}

// ── SLIDE 8 — CONSEJOS Y PREGUNTAS FRECUENTES ───────────
{
    let s = pres.addSlide();
    s.background = { color: LIGHT };

    s.addShape(pres.ShapeType.rect, { x:0, y:0, w:10, h:0.85, fill:{color:INDIGO}, line:{color:INDIGO} });
    s.addText('Consejos y Preguntas Frecuentes', { x:0.4, y:0, w:9.2, h:0.85, fontSize:22, fontFace:'Calibri', bold:true, color:WHITE, align:'left', valign:'middle', margin:0 });

    const faqs = [
        { q:'¿Puedo ingresar desde mi celular?', a:'Sí. Vendix funciona en cualquier navegador — Chrome, Safari, etc. No necesitas instalar nada.' },
        { q:'¿Qué hago si me equivoqué en una venta?', a:'Avísale a tu administrador. Él puede revisar o anular la transacción desde su panel.' },
        { q:'¿Puedo ver las ventas de otros vendedores?', a:'No. Solo ves tus propias ventas y tu comisión. La privacidad está garantizada.' },
        { q:'¿Por qué algunos productos dicen "Read-only"?', a:'El administrador configuró esos productos como solo lectura. Puedes verlos pero no editarlos.' },
        { q:'¿Cómo sé cuánto he ganado de comisión?', a:'En tu Dashboard verás la card "Commission Earned" con el total del mes.' },
        { q:'¿Qué pasa si pierdo mi contraseña?', a:'Escríbele a tu administrador por WhatsApp y él te la restablece rápido.' },
    ];

    faqs.forEach((faq, i) => {
        const col = i % 2, row = Math.floor(i / 2);
        const x = 0.3 + col * 5.05, y = 1.0 + row * 1.42;
        s.addShape(pres.ShapeType.roundRect, { x, y, w:4.8, h:1.28, rectRadius:0.12, fill:{color:WHITE}, line:{color:'E2E8F0'} });
        s.addShape(pres.ShapeType.ellipse, { x:x+0.15, y:y+0.15, w:0.32, h:0.32, fill:{color:INDIGO}, line:{color:INDIGO} });
        s.addText('?', { x:x+0.15, y:y+0.15, w:0.32, h:0.32, fontSize:10, fontFace:'Calibri', bold:true, color:WHITE, align:'center', valign:'middle', margin:0 });
        s.addText(faq.q, { x:x+0.55, y:y+0.1, w:4.1, h:0.4, fontSize:11, fontFace:'Calibri', bold:true, color:NAVY, align:'left', margin:0 });
        s.addText(faq.a, { x:x+0.2, y:y+0.55, w:4.4, h:0.65, fontSize:10, fontFace:'Calibri', color:GRAY, align:'left', margin:0 });
    });
}

// ── SLIDE 9 — CIERRE ─────────────────────────────────────
{
    let s = pres.addSlide();
    s.background = { color: NAVY };

    s.addShape(pres.ShapeType.ellipse, { x:3.5, y:-1.5, w:3.0, h:3.0, fill:{color:INDIGO, transparency:85}, line:{color:INDIGO, transparency:80} });
    s.addShape(pres.ShapeType.roundRect, { x:4.3, y:0.65, w:1.4, h:1.4, rectRadius:0.15, fill:{color:INDIGO}, line:{color:INDIGO} });
    s.addText('V', { x:4.3, y:0.65, w:1.4, h:1.4, fontSize:44, fontFace:'Calibri', bold:true, color:WHITE, align:'center', valign:'middle', margin:0 });

    s.addText('¡Ya estás listo para vender!', { x:0.5, y:2.2, w:9.0, h:0.8, fontSize:32, fontFace:'Calibri', bold:true, color:WHITE, align:'center', margin:0 });
    s.addText('Cualquier duda escríbele a tu administrador o usa el bot de Telegram', { x:1.0, y:3.15, w:8.0, h:0.45, fontSize:13, fontFace:'Calibri', color:'94A3B8', align:'center', margin:0 });

    s.addShape(pres.ShapeType.roundRect, { x:1.5, y:3.85, w:3.0, h:0.55, rectRadius:0.1, fill:{color:'25D366'}, line:{color:'25D366'} });
    s.addText('📱  WhatsApp Soporte', { x:1.5, y:3.85, w:3.0, h:0.55, fontSize:13, fontFace:'Calibri', bold:true, color:WHITE, align:'center', valign:'middle', margin:0 });

    s.addShape(pres.ShapeType.roundRect, { x:5.5, y:3.85, w:3.0, h:0.55, rectRadius:0.1, fill:{color:'229ED9'}, line:{color:'229ED9'} });
    s.addText('🤖  @vendixadmin_bot', { x:5.5, y:3.85, w:3.0, h:0.55, fontSize:13, fontFace:'Calibri', bold:true, color:WHITE, align:'center', valign:'middle', margin:0 });

    s.addText('vendix-app.vercel.app', { x:0.5, y:4.9, w:9.0, h:0.38, fontSize:11, fontFace:'Calibri', color:'334155', align:'center', margin:0 });
}

pres.writeFile({ fileName: OUT }).then(() => {
    console.log('✅ PPT Vendedor creado:', OUT);
}).catch(e => console.error('Error:', e));
