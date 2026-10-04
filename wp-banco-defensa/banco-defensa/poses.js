// ===== LIBRERÍA DE MOVIMIENTOS DE WATERPOLO (poses anatómicas reutilizables) ============================
// Marco del personaje: X = izquierda, Y = arriba, Z = adelante. Las direcciones de brazos van en marco 'pecho'
// y las de piernas en marco 'cuerpo' (cadera), salvo que se indique marco:'mundo' (p.ej. "brazo vertical al cielo").
//
// Referencias biomecánicas usadas (ver docs/defensa-investigacion.md):
//  - Eggbeater: cadera ~80-90° de flexión y ~90° de abducción con ~30° de rotación externa; rodilla que se flexiona
//    y extiende rápido; cada pie dibuja un círculo, piernas ALTERNADAS (medio ciclo de desfase), sentido opuesto
//    entre piernas (Sanders 1999; Oliveira et al. 2015 J Sports Sci 33(16); Wikipedia "Eggbeater kick").
//  - Bloqueo: eggbeater en SPLIT (trípode): si bloquea con el brazo derecho -> pierna izquierda adelante (eleva),
//    pierna derecha atrás (cierra distancia); brazo libre haciendo sculling (Water Polo University, shot blocking).
import * as THREE from 'three';

export const TAU = Math.PI * 2;
export const suave = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };       // smoothstep
export const rapido = (x) => { x = Math.min(1, Math.max(0, x)); return 1 - (1 - x) * (1 - x) * (1 - x); }; // ease-out
export const lento = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * x; };                    // ease-in
export const lerp = (a, b, t) => a + (b - a) * t;
export const nv = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };

// ---------------------------------------------------------------------------------------------------------
// Composición
// ---------------------------------------------------------------------------------------------------------
// Mezcla dos poses: el motor resuelve ambas y hace SLERP hueso por hueso (como un cross-fade de animaciones),
// así no importa si usan marcos distintos ('pecho' vs 'mundo'). La raíz (altura/desplazamiento) se interpola lineal.
export function mezclarPose(a, b, t) {
  if (t <= 0) return a; if (t >= 1) return b;
  const ra = a.raiz || {}, rb = b.raiz || {};
  return {
    __mezcla: [a, b, t],
    raiz: { x: lerp(ra.x || 0, rb.x || 0, t), y: lerp(ra.y ?? rb.y ?? -0.42, rb.y ?? ra.y ?? -0.42, t), z: lerp(ra.z || 0, rb.z || 0, t) },
  };
}

// Fusiona capas: las de la derecha pisan a las de la izquierda (por segmento). Cada capa es pose o fn(t).
export function capas(...cs) {
  return (t) => {
    const out = {};
    for (const c of cs) {
      const p = typeof c === 'function' ? c(t) : c;
      if (!p) continue;
      for (const k of Object.keys(p)) out[k] = (k === 'raiz' && out.raiz) ? { ...out.raiz, ...p.raiz } : p[k];
    }
    return out;
  };
}

// Secuencia de poses clave: claves = [[t, pose|fn(t)], ...]; entre claves interpola con 'ease' (suave por defecto).
// Cada pose clave puede ser una función de t (p.ej. una base con eggbeater animado) -> se evalúa en el t real.
export function secuencia(claves, ease = suave) {
  return (t) => {
    const ev = (p) => (typeof p === 'function' ? p(t) : p);
    if (t <= claves[0][0]) return ev(claves[0][1]);
    for (let i = 1; i < claves.length; i++) {
      const [t1, p1, e1] = claves[i];
      const [t0, p0] = claves[i - 1];
      if (t <= t1) return mezclarPose(ev(p0), ev(p1), (e1 || ease)((t - t0) / (t1 - t0)));
    }
    return ev(claves[claves.length - 1][1]);
  };
}

// Espejo izquierda <-> derecha (para definir un lado y obtener el otro).
export function espejo(pose) {
  const out = {};
  const flipV = (v) => [-v[0], v[1], v[2]];
  const flipSeg = (s) => {
    if (!s) return s;
    const o = { ...s };
    for (const k of ['sup', 'inf', 'fin', 'palma']) if (o[k]) o[k] = flipV(o[k]);
    if (o.prono) o.prono = -o.prono;
    return o;
  };
  for (const [k, v] of Object.entries(pose)) {
    if (k.endsWith('I') && (k.startsWith('brazo') || k.startsWith('pierna') || k.startsWith('hombro'))) out[k.slice(0, -1) + 'D'] = k.startsWith('hombro') ? v : flipSeg(v);
    else if (k.endsWith('D') && (k.startsWith('brazo') || k.startsWith('pierna') || k.startsWith('hombro'))) out[k.slice(0, -1) + 'I'] = k.startsWith('hombro') ? v : flipSeg(v);
    else if (['cuerpo', 'columna', 'cuello'].includes(k)) out[k] = { ...v, giro: -(v.giro || 0), lat: -(v.lat || 0) };
    else if (k === 'raiz') out[k] = { ...v, x: -(v.x || 0) };
    else out[k] = v;
  }
  return out;
}
export const espejoFn = (fn) => (t) => espejo(fn(t));

// ---------------------------------------------------------------------------------------------------------
// PIERNAS
// ---------------------------------------------------------------------------------------------------------
// EGGBEATER: muslos casi horizontales y abiertos (como sentado en una silla con rodillas separadas), cada pie
// dibuja un círculo bajo su rodilla; piernas alternadas y en sentido opuesto. 'potencia' agranda el círculo y la
// cadencia (para elevarse en un bloqueo); 'avance' inclina los círculos para desplazarse (lateral/adelante).
export function eggbeater(t, { periodo = 0.75, potencia = 1, fase = 0, abre = 1, avanceX = 0, avanceZ = 0 } = {}) {
  const pierna = (s, th) => {
    const r = 0.42 * potencia;
    return {
      marco: 'cuerpo',
      sup: nv(s * (0.70 * abre + 0.05 * Math.sin(th)), -0.24 + 0.07 * Math.cos(th), 0.66 - 0.1 * (abre - 1)),
      inf: nv(s * (r * Math.cos(th) + 0.12) + avanceX * 0.25, -1, r * Math.sin(th) * s - 0.12 + avanceZ * 0.25),
      fin: nv(s * 0.72, 0.08, 0.66),                                  // pie en flexión dorsal, girado hacia afuera
    };
  };
  const th = TAU * (t / periodo) + fase;
  return { piernaI: pierna(1, th), piernaD: pierna(-1, th + Math.PI) };
}

// EGGBEATER EN SPLIT (trípode de bloqueo). adelante = 'I' | 'D' (la pierna adelantada es la CONTRARIA al brazo
// que bloquea). La pierna de adelante eleva (círculos amplios), la de atrás empuja hacia adelante (patada corta).
export function eggSplit(t, { adelante = 'I', periodo = 0.6, potencia = 1.1 } = {}) {
  const th = TAU * (t / periodo);
  const sA = adelante === 'I' ? 1 : -1;                               // signo X de la pierna adelantada
  const r = 0.38 * potencia;
  const delantera = {
    marco: 'cuerpo',
    sup: nv(sA * (0.42 + 0.05 * Math.sin(th)), -0.22 + 0.06 * Math.cos(th), 0.86),
    inf: nv(sA * (r * Math.cos(th) + 0.08), -1, r * Math.sin(th) * sA - 0.05),
    fin: nv(sA * 0.55, 0.1, 0.8),
  };
  const trasera = {
    marco: 'cuerpo',
    sup: nv(-sA * (0.3 + 0.04 * Math.sin(th + Math.PI)), -0.82, -0.42 + 0.06 * Math.cos(th + Math.PI)),
    inf: nv(-sA * (0.2 + 0.12 * Math.cos(th + Math.PI)), -0.55, -0.83 + 0.1 * Math.sin(th + Math.PI)),
    fin: nv(-sA * 0.5, -0.75, -0.3),
  };
  return adelante === 'I' ? { piernaI: delantera, piernaD: trasera } : { piernaD: delantera, piernaI: trasera };
}

// PATADA DE CROL (flutter) para nado horizontal / repliegue. Piernas extendidas detrás del cuerpo.
export function patadaCrol(t, { periodo = 0.4, amp = 1 } = {}) {
  const th = TAU * (t / periodo);
  const p = (s, f) => ({
    marco: 'cuerpo',
    sup: nv(s * 0.1, -1, 0.22 * amp * Math.sin(f)),                  // muslo oscila adelante/atrás
    inf: nv(s * 0.08, -1, 0.22 * amp * Math.sin(f) - 0.28 * amp * (0.5 + 0.5 * Math.cos(f))), // rodilla se dobla al subir
    fin: nv(s * 0.15, -1, -0.35),                                    // empeine extendido (punta de pie)
  });
  return { piernaI: p(1, th), piernaD: p(-1, th + Math.PI) };
}

// Piernas "de pecho" (braza/whip) para frenar y girar: patada corta de rana, rodillas abiertas.
export function patadaWhip(t, { periodo = 0.7 } = {}) {
  const th = TAU * (t / periodo);
  const p = (s) => ({
    marco: 'cuerpo',
    sup: nv(s * (0.45 + 0.2 * Math.max(0, Math.sin(th))), -0.75, 0.35),
    inf: nv(s * (0.35 + 0.3 * Math.max(0, Math.sin(th))), -0.6, -0.75 + 0.4 * Math.max(0, Math.sin(th))),
    fin: nv(s * 0.8, 0, -0.5),
  });
  return { piernaI: p(1), piernaD: p(-1) };
}

// ---------------------------------------------------------------------------------------------------------
// BRAZOS
// ---------------------------------------------------------------------------------------------------------
// SCULLING (remada de apoyo): antebrazos casi horizontales bajo la superficie, manos en "8" hacia afuera y adentro.
export function scullBrazo(t, lado, { periodo = 0.6, ancho = 1, fase = 0 } = {}) {
  const s = lado === 'I' ? 1 : -1;
  const f = TAU * (t / periodo) + fase;
  return {
    marco: 'pecho',
    sup: nv(s * 0.62 * ancho, -0.62, 0.42),
    inf: nv(s * (0.55 + 0.32 * Math.cos(f)) * ancho, -0.22, 0.78),
    palma: [0, -1, 0.3],
    prono: s * -55,                                                   // palma hacia abajo
    fin: nv(s * (0.52 + 0.3 * Math.cos(f)) * ancho, -0.32 + 0.22 * Math.sin(f), 0.78),
  };
}
export const sculling = (t, o = {}) => ({ brazoI: scullBrazo(t, 'I', o), brazoD: scullBrazo(t, 'D', { ...o, fase: (o.fase || 0) + Math.PI }) });

// BRAZO ARRIBA (bloqueo/mano alta): vertical al cielo, codo firme, mano abierta mirando al tirador (palma adelante).
// incl: inclinación hacia adelante (0 = vertical; 0.3 = un poco hacia el tirador); abre: hacia el costado.
export function brazoArriba(lado, { incl = 0.15, abre = 0.08, codo = 0.05 } = {}) {
  const s = lado === 'I' ? 1 : -1;
  return {
    marco: 'mundo',
    sup: nv(s * abre, 1, incl),
    inf: nv(s * abre * 0.6, 1, incl + codo),
    palma: [0, 0, 1],
    fin: nv(s * abre * 0.5, 1, incl + 0.2),
  };
}

// Mano/antebrazo apoyado en el atacante (hombro, cadera): dirección del brazo hacia el punto, codo algo doblado.
export function brazoHacia(lado, dir, { codo = 0.25, marco = 'pecho', palma = [0, -1, 0.2] } = {}) {
  const s = lado === 'I' ? 1 : -1;
  const d = nv(...dir);
  return {
    marco,
    sup: nv(d[0] + s * 0.15, d[1] - codo, d[2]),
    inf: nv(d[0], d[1] + codo * 0.4, d[2]),
    palma,
    fin: nv(d[0], d[1] - 0.2, d[2]),
  };
}

// Brazada de CROL A CABEZA ALTA (marco pecho: +Y = hacia la cabeza, +Z = hacia el fondo cuando está boca abajo,
// +X = costado). Fase 0..PI = TRACCIÓN bajo el cuerpo con codo alto (el antebrazo "adelanta" al brazo y empuja agua
// hacia atrás); PI..2PI = RECOBRO por el COSTADO sobre el agua: el codo lidera alto y la mano cuelga y lo sigue.
// (Recobrar "por el cielo" en el plano sagital exigiría rotar el hombro 180°: por eso el recobro va por fuera.)
export function brazadaCrol(t, lado, { periodo = 1.0, fase = 0, codoAlto = 1 } = {}) {
  const s = lado === 'I' ? 1 : -1;
  const a = (((TAU * (t / periodo) + fase) % TAU) + TAU) % TAU;
  let sup, inf;
  if (a < Math.PI) {                                               // tracción
    const k = (0.18 + 0.6 * Math.sin(a)) * codoAlto;               // ~10° en entrada/salida, ~45° a mitad (codo alto)
    sup = nv(s * 0.2, Math.cos(a), Math.sin(a));
    inf = nv(s * 0.14, Math.cos(a + k), Math.sin(a + k));
  } else {                                                         // recobro: de la cadera (-Y) al costado (+X) a la cabeza (+Y)
    const r = (a - Math.PI) / Math.PI, ps = Math.PI * r;
    const lev = Math.sin(ps);                                      // 0 en los extremos, 1 a mitad del recobro
    sup = nv(s * (0.2 + 0.85 * lev), -Math.cos(ps), -0.45 * lev);  // brazo abierto y algo elevado (codo alto)
    // la mano cuelga hacia el agua y queda ATRÁS del codo (el codo lidera); al final se estira para entrar
    inf = nv(s * (0.2 + 0.5 * lev), -Math.cos(ps) - 0.35 * lev, 0.15 + 0.9 * lev);
  }
  return { marco: 'pecho', sup, inf, palma: [0, 0, 1], prono: s * -20, fin: inf };
}
export const crolBrazos = (t, o = {}) => ({ brazoI: brazadaCrol(t, 'I', o), brazoD: brazadaCrol(t, 'D', { ...o, fase: (o.fase || 0) + Math.PI }) });

// ---------------------------------------------------------------------------------------------------------
// CUERPO COMPLETO
// ---------------------------------------------------------------------------------------------------------
// Pequeño rebote vertical del eggbeater (2 empujes por ciclo, uno por pierna).
export const rebote = (t, periodo = 0.75, amp = 0.012) => amp * Math.sin(2 * TAU * (t / periodo));

// Postura defensiva vertical base: casi vertical, leve inclinación al frente, hombros sobre caderas, mirada al frente.
export function baseVertical(t, { y = -0.42, pitch = 12, periodo = 0.75, potencia = 1, scull = true } = {}) {
  return {
    cuerpo: { pitch },
    columna: { flex: 4 },
    cuello: { flex: -pitch * 0.8 },
    ...eggbeater(t, { periodo, potencia }),
    ...(scull ? sculling(t, { periodo: 0.6 }) : {}),
    raiz: { y: y + rebote(t, periodo) },
  };
}

// Crol a cabeza alta completo (repliegue): cuerpo inclinado ~65-75°, cabeza afuera mirando al frente.
export function crolCabezaAlta(t, { periodo = 1.0, velocidad = 1.6, y = -0.12, pitch = 70, kick = 0.4 } = {}) {
  return {
    cuerpo: { pitch, lat: 10 * Math.sin(TAU * t / periodo) },        // rolido leve con cada brazada
    columna: { flex: -6 },
    cuello: { flex: -pitch * 0.85, giro: 0 },
    ...crolBrazos(t, { periodo }),
    ...patadaCrol(t, { periodo: kick }),
    raiz: { y: y + 0.01 * Math.sin(2 * TAU * t / periodo), z: velocidad * t },
  };
}

// Pose de "estar en presión" (semi-horizontal): piernas detrás apuntando al centro del arco, caderas en superficie.
export function basePresion(t, { y = -0.18, pitch = 55, periodo = 0.75 } = {}) {
  return {
    cuerpo: { pitch },
    columna: { flex: -8 },
    cuello: { flex: -pitch * 0.9 },
    ...eggbeater(t, { periodo, potencia: 0.8 }),
    raiz: { y: y + rebote(t, periodo, 0.008) },
  };
}

// Un frame del vector de pelota en la mano (para escenas): helper para crear rutas.
export const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
