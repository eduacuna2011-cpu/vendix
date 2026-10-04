// ===== MOTOR DE POSES ANATÓMICAS (cualquier rig con nombres Mixamo) =====================================
// Idea: las animaciones NO se guardan como cuaterniones de un rig concreto, sino como POSES ANATÓMICAS
// (inclinación del cuerpo, flexión de columna, DIRECCIÓN de cada segmento de brazo/pierna, etc.).
// Este módulo "resuelve" esas poses sobre el esqueleto que le pases (el maniquí del banco o tu personaje.fbx),
// sea T-pose o A-pose, y genera un THREE.AnimationClip normal (QuaternionKeyframeTrack por hueso).
//
// MARCO DEL PERSONAJE (todas las direcciones de las poses usan estos ejes):
//   X = izquierda del jugador   Y = arriba   Z = adelante (hacia donde mira el pecho)
// Grados: positivos según la regla de la mano derecha sobre esos ejes (ver comentarios en cada campo).
import * as THREE from 'three';

export const NOMBRES = [
  'Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head',
  'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'LeftHandMiddle1',
  'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand', 'RightHandMiddle1',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase',
  'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase',
];
const REQUERIDOS = NOMBRES.filter((n) => !n.endsWith('Middle1'));

// "mixamorigHips", "mixamorig:Hips", "mixamorig1:Hips", "Hips" -> "hips"
function clave(nombre) {
  return nombre.replace(/^.*?mixamorig\d*[:_]?/i, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
}

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
const RAD = Math.PI / 180;

// ---------------------------------------------------------------------------------------------------------
// crearRig(root): busca los huesos, guarda la pose de reposo y calcula el marco del personaje.
// ---------------------------------------------------------------------------------------------------------
export function crearRig(root) {
  root.updateMatrixWorld(true);
  const porClave = {};
  root.traverse((o) => { if (o.isBone) { const k = clave(o.name); if (!porClave[k]) porClave[k] = o; } });
  const h = {};
  for (const n of NOMBRES) h[n] = porClave[n.toLowerCase()] || null;
  const faltan = REQUERIDOS.filter((n) => !h[n]);
  if (faltan.length) throw new Error('Rig sin huesos Mixamo: ' + faltan.join(', '));

  const rig = { root, h, reposo: new Map(), huesos: NOMBRES.filter((n) => h[n]).map((n) => h[n]) };
  // Pose de reposo: cuaternión local + cuaternión "modelo" (relativo al root) de cada hueso y de su padre.
  for (const b of rig.huesos) {
    rig.reposo.set(b, { q: b.quaternion.clone(), W: qModelo(rig, b, new THREE.Quaternion()), Wp: qModelo(rig, b.parent, new THREE.Quaternion()) });
  }
  // Marco del personaje (en espacio-modelo): arriba = cadera->cabeza, izquierda = muslo der -> muslo izq.
  const arriba = pModelo(rig, h.Head).sub(pModelo(rig, h.Hips)).normalize();
  const izq = pModelo(rig, h.LeftUpLeg).sub(pModelo(rig, h.RightUpLeg));
  izq.addScaledVector(arriba, -izq.dot(arriba)).normalize();
  const adelante = new THREE.Vector3().crossVectors(izq, arriba).normalize();
  rig.C = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(izq, arriba, adelante));
  // Altura de la cadera (en unidades del modelo) y escala a metros (para poner el agua bien).
  const cab = pModelo(rig, h.Head), pie = pModelo(rig, h.LeftFoot);
  rig.alturaCabezaPie = cab.sub(pie).dot(arriba);
  // Bisagras de codo/rodilla en el marco local del hueso superior (para que flexionen hacia el lado correcto).
  //   codo: desde reposo, flexionar lleva el antebrazo hacia ADELANTE; rodilla: la pierna va hacia ATRÁS.
  rig.bisagra = new Map();
  const adel = dirC(rig, [0, 0, 1]), atras = dirC(rig, [0, 0, -1]);
  const defs = [['LeftArm', 'LeftForeArm', adel], ['RightArm', 'RightForeArm', adel], ['LeftForeArm', 'LeftHand', adel], ['RightForeArm', 'RightHand', adel],
    ['LeftUpLeg', 'LeftLeg', atras], ['RightUpLeg', 'RightLeg', atras], ['LeftLeg', 'LeftFoot', adel], ['RightLeg', 'RightFoot', adel]];
  for (const [a, b, flex] of defs) {
    const u = dirSeg(rig, h[a], h[b]);
    let n = new THREE.Vector3().crossVectors(u, flex);
    if (n.lengthSq() < 1e-6) n = new THREE.Vector3().crossVectors(u, dirC(rig, [0, 1, 0]));
    n.normalize().applyQuaternion(rig.reposo.get(h[a]).W.clone().invert());
    rig.bisagra.set(h[a], n);
  }
  return rig;
}

// ---- utilidades de espacio-modelo (relativo al root; así no importa dónde esté parado el root en la escena) ----
function qModelo(rig, o, out) {
  o.getWorldQuaternion(out);
  rig.root.getWorldQuaternion(_q2);
  return out.premultiply(_q2.invert());
}
function pModelo(rig, o) { return rig.root.worldToLocal(o.getWorldPosition(new THREE.Vector3())); }
function dirSeg(rig, a, b) { return pModelo(rig, b).sub(pModelo(rig, a)).normalize(); }
function dirC(rig, v) { return new THREE.Vector3(v[0], v[1], v[2]).normalize().applyQuaternion(rig.C); }
function eulerC(rig, flex, giro, lat) {
  // rotación anatómica en marco personaje: flex (sobre X, + = hacia adelante), giro (sobre Y, + = hacia la izq),
  // lat (sobre Z, + = inclinar a la derecha: hombro izq sube). Orden: giro -> flex -> lat.
  const J = new THREE.Quaternion().setFromEuler(new THREE.Euler(flex * RAD, giro * RAD, lat * RAD, 'YXZ'));
  return rig.C.clone().multiply(J).multiply(rig.C.clone().invert());
}
// Rotación R (espacio-modelo) aplicada al hueso: W' = R * W
function rotarModelo(rig, b, R) {
  const Wp = qModelo(rig, b.parent, new THREE.Quaternion());
  const Wb = qModelo(rig, b, new THREE.Quaternion());
  b.quaternion.copy(Wp.invert().multiply(R).multiply(Wb));
  b.updateMatrixWorld(true);
}
// Rotación anatómica RELATIVA AL PADRE (como si el padre estuviera en reposo): q = Wp_r^-1 * J * Wp_r * q_r
function rotarRelativo(rig, b, J) {
  const r = rig.reposo.get(b);
  b.quaternion.copy(r.Wp.clone().invert().multiply(J).multiply(r.Wp).multiply(r.q));
  b.updateMatrixWorld(true);
}

export function aReposo(rig) {
  for (const b of rig.huesos) b.quaternion.copy(rig.reposo.get(b).q);
  rig.root.updateMatrixWorld(true);
}

// Marco de referencia para direcciones de extremidades: 'mundo' (personaje erguido), 'cuerpo' (cadera), 'pecho' (Spine2)
function marcoQ(rig, marco) {
  if (marco === 'mundo') return rig.C.clone();
  const b = marco === 'pecho' ? rig.h.Spine2 : rig.h.Hips;
  const W = qModelo(rig, b, new THREE.Quaternion());
  return W.multiply(rig.reposo.get(b).W.clone().invert()).multiply(rig.C);
}
const vec = (a, Q) => new THREE.Vector3(a[0], a[1], a[2]).normalize().applyQuaternion(Q);

// Limita el ángulo entre la dirección base y la objetivo a [min,max] grados (muñeca / tobillo).
function limitarAngulo(base, obj, min, max) {
  const ang = base.angleTo(obj) / RAD;
  if (ang >= min && ang <= max) return obj;
  const eje = new THREE.Vector3().crossVectors(base, obj);
  if (eje.lengthSq() < 1e-8) return obj;
  eje.normalize();
  const a = THREE.MathUtils.clamp(ang, min, max) * RAD;
  return base.clone().applyAxisAngle(eje, a);
}

// Cadena de 2 huesos (brazo o pierna): dirección del segmento superior e inferior + palma/prono + extremo.
function resolverCadena(rig, sup, inf, fin, punta, spec) {
  const Q = marcoQ(rig, spec.marco || 'cuerpo');
  const u = vec(spec.sup, Q);
  const f = vec(spec.inf || spec.sup, Q);
  // 1) swing del segmento superior hacia u
  rotarModelo(rig, sup, _q.setFromUnitVectors(dirSeg(rig, sup, inf), u).clone());
  // 2) giro (twist) del superior sobre su eje para que la bisagra (codo/rodilla) quede perpendicular al plano (u,f)
  let n = new THREE.Vector3().crossVectors(u, f);
  if (n.length() < 0.15) {                                   // segmento casi recto: usa la "palma" (hacia dónde curvaría)
    const p = vec(spec.palma || (spec.esPie ? [0, 0, -1] : [0, 0, 1]), Q);   // la rodilla curva hacia ATRÁS
    n = new THREE.Vector3().crossVectors(u, p);
  }
  if (n.lengthSq() > 1e-6) {
    n.normalize();
    const hAct = rig.bisagra.get(sup).clone().applyQuaternion(qModelo(rig, sup, new THREE.Quaternion()));
    const a = hAct.addScaledVector(u, -hAct.dot(u)).normalize();
    const b = n.clone().addScaledVector(u, -n.dot(u)).normalize();
    let ang = Math.atan2(new THREE.Vector3().crossVectors(a, b).dot(u), a.dot(b));
    // Límite de rotación interna/externa respecto del swing mínimo: cadera ±80°, hombro ±165°.
    const lim = (spec.esPie ? 80 : 165) * RAD;
    if (Math.abs(ang) > lim) {
      if (rig.alertas) rig.alertas.push(`${sup.name}: giro ${(ang / RAD).toFixed(0)}° fuera de rango (se limita a ±${(lim / RAD).toFixed(0)}°)`);
      ang = Math.sign(ang) * lim;
    }
    rotarModelo(rig, sup, new THREE.Quaternion().setFromAxisAngle(u, ang));
  }
  // 3) swing del inferior hacia f (con el twist anterior es una flexión pura de bisagra)
  rotarModelo(rig, inf, new THREE.Quaternion().setFromUnitVectors(dirSeg(rig, inf, fin), f));
  // 4) pronación/supinación (giro del antebrazo/pierna sobre su eje), en grados
  if (spec.prono) rotarModelo(rig, inf, new THREE.Quaternion().setFromAxisAngle(f, spec.prono * RAD));
  // 5) extremo (mano o pie): dirección limitada por la articulación
  if (spec.fin && punta) {
    const actual = dirSeg(rig, fin, punta);
    let obj = vec(spec.fin, Q);
    obj = spec.esPie ? limitarAngulo(f, obj, 55, 130) : limitarAngulo(f, obj, 0, 75);
    rotarModelo(rig, fin, new THREE.Quaternion().setFromUnitVectors(actual, obj));
  }
}

// ---------------------------------------------------------------------------------------------------------
// aplicarPose(rig, pose): deja el esqueleto en la pose. Campos (todos opcionales):
//   cuerpo:  { pitch, giro, lat }   inclinación global (pitch + = hacia adelante; 90 = horizontal boca abajo)
//   columna: { flex, giro, lat }    se reparte entre Spine/Spine1/Spine2 (flex + = encorvar hacia adelante)
//   cuello:  { flex, giro, lat }    se reparte entre Neck/Head (flex - = levantar la mirada)
//   hombroI / hombroD: { elev, adel }   clavícula: elevar (+) y adelantar (+) el hombro, grados
//   brazoI / brazoD:  { marco:'pecho'|'cuerpo'|'mundo', sup:[x,y,z], inf:[x,y,z], palma:[x,y,z], prono, fin:[x,y,z] }
//   piernaI / piernaD: { marco:'cuerpo'|'mundo', sup, inf, fin }   (sup = muslo, inf = pierna, fin = pie)
//   raiz:    { x, y, z }  metros: posición de la CADERA respecto al agua (y=0 es la superficie). No toca huesos.
// ---------------------------------------------------------------------------------------------------------
export function aplicarPose(rig, pose) {
  const h = rig.h;
  if (pose.__mezcla) {                                   // mezcla de dos poses (secuencias): slerp por hueso
    const [a, b, w] = pose.__mezcla;
    aplicarPose(rig, a);
    const qa = rig.huesos.map((x) => x.quaternion.clone());
    aplicarPose(rig, b);
    rig.huesos.forEach((x, i) => { x.quaternion.slerpQuaternions(qa[i], x.quaternion.clone(), w); });
    rig.root.updateMatrixWorld(true);
    return;
  }
  if (rig.faltantes) for (const k of ['brazoI', 'brazoD', 'piernaI', 'piernaD']) if (!pose[k]) rig.faltantes.add(k);
  aReposo(rig);
  const c = pose.cuerpo || {};
  rotarRelativo(rig, h.Hips, eulerC(rig, c.pitch || 0, c.giro || 0, c.lat || 0));
  const col = pose.columna || {};
  const reparto = [[h.Spine, 0.4], [h.Spine1, 0.3], [h.Spine2, 0.3]];
  for (const [b, w] of reparto) rotarRelativo(rig, b, eulerC(rig, (col.flex || 0) * w, (col.giro || 0) * w, (col.lat || 0) * w));
  const cu = pose.cuello || {};
  rotarRelativo(rig, h.Neck, eulerC(rig, (cu.flex || 0) * 0.5, (cu.giro || 0) * 0.5, (cu.lat || 0) * 0.5));
  rotarRelativo(rig, h.Head, eulerC(rig, (cu.flex || 0) * 0.5, (cu.giro || 0) * 0.5, (cu.lat || 0) * 0.5));
  for (const lado of ['I', 'D']) {
    const L = lado === 'I' ? 'Left' : 'Right', s = lado === 'I' ? 1 : -1;
    const hb = pose['hombro' + lado];
    if (hb) rotarRelativo(rig, h[L + 'Shoulder'], eulerC(rig, 0, -s * (hb.adel || 0), s * (hb.elev || 0)));
    const br = pose['brazo' + lado];
    if (br) resolverCadena(rig, h[L + 'Arm'], h[L + 'ForeArm'], h[L + 'Hand'], h[L + 'HandMiddle1'], { marco: 'pecho', ...br });
    const pi = pose['pierna' + lado];
    if (pi) resolverCadena(rig, h[L + 'UpLeg'], h[L + 'Leg'], h[L + 'Foot'], h[L + 'ToeBase'], { marco: 'cuerpo', ...pi, esPie: true });
  }
}

// ---------------------------------------------------------------------------------------------------------
// crearClip(rig, nombre, poseFn, duracion, fps): muestrea la animación y arma el AnimationClip.
// Devuelve { clip, raiz } — raiz = curva de desplazamiento de la cadera (el juego la aplica aparte, como fintaRise).
// ---------------------------------------------------------------------------------------------------------
export function crearClip(rig, nombre, poseFn, duracion, fps = 30) {
  const n = Math.max(2, Math.round(duracion * fps) + 1);
  const tiempos = new Float32Array(n);
  const valores = rig.huesos.map(() => new Float32Array(n * 4));
  const raiz = { t: [], x: [], y: [], z: [] };
  const prev = rig.huesos.map(() => null);
  for (let i = 0; i < n; i++) {
    const t = Math.min(duracion, i / fps);
    tiempos[i] = t;
    const pose = poseFn(t);
    aplicarPose(rig, pose);
    rig.huesos.forEach((b, k) => {
      const q = b.quaternion;
      let x = q.x, y = q.y, z = q.z, w = q.w;
      const p = prev[k];
      if (p && p[0] * x + p[1] * y + p[2] * z + p[3] * w < 0) { x = -x; y = -y; z = -z; w = -w; } // mismo hemisferio (sin flips)
      valores[k].set([x, y, z, w], i * 4);
      prev[k] = [x, y, z, w];
    });
    const r = pose.raiz || {};
    raiz.t.push(+t.toFixed(4)); raiz.x.push(r.x || 0); raiz.y.push(r.y ?? -0.55); raiz.z.push(r.z || 0);
  }
  aReposo(rig);
  const tracks = rig.huesos.map((b, k) => new THREE.QuaternionKeyframeTrack(b.name + '.quaternion', tiempos, valores[k]));
  return { clip: new THREE.AnimationClip(nombre, duracion, tracks), raiz };
}

// Interpola la curva de raíz en el tiempo t (lineal).
export function raizEn(raiz, t) {
  const T = raiz.t, N = T.length;
  if (t <= T[0]) return { x: raiz.x[0], y: raiz.y[0], z: raiz.z[0] };
  if (t >= T[N - 1]) return { x: raiz.x[N - 1], y: raiz.y[N - 1], z: raiz.z[N - 1] };
  let i = 1; while (T[i] < t) i++;
  const a = (t - T[i - 1]) / (T[i] - T[i - 1]);
  const l = (k) => raiz[k][i - 1] + (raiz[k][i] - raiz[k][i - 1]) * a;
  return { x: l('x'), y: l('y'), z: l('z') };
}

// Posición (espacio-modelo) de un hueso, para medir cosas (altura de mano, pie bajo el agua, etc.).
export function posHueso(rig, nombre) { return pModelo(rig, rig.h[nombre]); }

// Ángulo (grados) entre dos segmentos consecutivos: 0 = recto. Para validar codos/rodillas.
export function anguloArticular(rig, a, b, c) {
  const u = dirSeg(rig, rig.h[a], rig.h[b]), f = dirSeg(rig, rig.h[b], rig.h[c]);
  return u.angleTo(f) / RAD;
}
// ¿La flexión va al lado correcto? (+1 = flexión anatómica, -1 = hiperextensión/al revés)
export function signoFlexion(rig, a, b, c) {
  const u = dirSeg(rig, rig.h[a], rig.h[b]), f = dirSeg(rig, rig.h[b], rig.h[c]);
  const n = rig.bisagra.get(rig.h[a]).clone().applyQuaternion(qModelo(rig, rig.h[a], new THREE.Quaternion()));
  const cr = new THREE.Vector3().crossVectors(u, f);
  if (cr.length() < 0.05) return 1;
  return Math.sign(cr.dot(n));
}
