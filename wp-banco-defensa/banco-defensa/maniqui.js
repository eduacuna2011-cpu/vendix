// ===== MANIQUÍ con esqueleto estilo Mixamo (mismos nombres de huesos: mixamorigHips, mixamorigLeftArm...) =====
// Se usa cuando no hay personaje.fbx (o con ?modelo=maniqui). Piezas rígidas pegadas a cada hueso, T-pose,
// 1.85 m, mirando a +Z, izquierda = +X. Sirve para ver y validar las animaciones del banco.
import * as THREE from 'three';

const P = 'mixamorig';
// [nombre, padre, offset desde el padre (m)]
const HUESOS = [
  ['Hips', null, [0, 1.0, 0]],
  ['Spine', 'Hips', [0, 0.1, 0]], ['Spine1', 'Spine', [0, 0.12, 0]], ['Spine2', 'Spine1', [0, 0.14, 0]],
  ['Neck', 'Spine2', [0, 0.17, 0]], ['Head', 'Neck', [0, 0.1, 0]], ['HeadTop_End', 'Head', [0, 0.2, 0]],
  ['LeftShoulder', 'Spine2', [0.03, 0.11, 0]], ['LeftArm', 'LeftShoulder', [0.15, 0, 0]], ['LeftForeArm', 'LeftArm', [0.29, 0, 0]],
  ['LeftHand', 'LeftForeArm', [0.26, 0, 0]], ['LeftHandMiddle1', 'LeftHand', [0.09, 0, 0]], ['LeftHandMiddle4', 'LeftHandMiddle1', [0.08, 0, 0]],
  ['RightShoulder', 'Spine2', [-0.03, 0.11, 0]], ['RightArm', 'RightShoulder', [-0.15, 0, 0]], ['RightForeArm', 'RightArm', [-0.29, 0, 0]],
  ['RightHand', 'RightForeArm', [-0.26, 0, 0]], ['RightHandMiddle1', 'RightHand', [-0.09, 0, 0]], ['RightHandMiddle4', 'RightHandMiddle1', [-0.08, 0, 0]],
  ['LeftUpLeg', 'Hips', [0.1, -0.06, 0]], ['LeftLeg', 'LeftUpLeg', [0, -0.45, 0]], ['LeftFoot', 'LeftLeg', [0, -0.42, 0]],
  ['LeftToeBase', 'LeftFoot', [0, -0.05, 0.13]], ['LeftToe_End', 'LeftToeBase', [0, 0, 0.08]],
  ['RightUpLeg', 'Hips', [-0.1, -0.06, 0]], ['RightLeg', 'RightUpLeg', [0, -0.45, 0]], ['RightFoot', 'RightLeg', [0, -0.42, 0]],
  ['RightToeBase', 'RightFoot', [0, -0.05, 0.13]], ['RightToe_End', 'RightToeBase', [0, 0, 0.08]],
];

export function crearManiqui({ gorro = 0xf2f2f2, gorroDetalle = 0x1f5fbf, malla = 0x1f3d8f, piel = 0xd9a07a, numero = null } = {}) {
  const root = new THREE.Group();
  root.name = 'maniqui';
  const b = {};
  for (const [n, padre, off] of HUESOS) {
    const bone = new THREE.Bone();
    bone.name = P + n;
    bone.position.set(off[0], off[1], off[2]);
    (padre ? b[padre] : root).add(bone);
    b[n] = bone;
  }
  const M = (c, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.0, ...extra });
  const mPiel = M(piel), mMalla = M(malla), mGorro = M(gorro), mDet = M(gorroDetalle);
  const sombra = (m) => { m.castShadow = true; return m; };

  // Cápsula a lo largo de un segmento (del hueso a su hijo), en el espacio local del hueso.
  function seg(nombre, hijo, r, mat, acortar = 0) {
    const off = new THREE.Vector3().fromArray(HUESOS.find((h) => h[0] === hijo)[2]);
    const largo = Math.max(0.01, off.length() - acortar);
    const g = new THREE.CapsuleGeometry(r, Math.max(0.001, largo - 2 * r * 0.6), 6, 12);
    const m = sombra(new THREE.Mesh(g, mat));
    m.position.copy(off).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), off.clone().normalize());
    b[nombre].add(m);
    return m;
  }
  function caja(nombre, tam, pos, mat, rot = [0, 0, 0]) {
    const m = sombra(new THREE.Mesh(new THREE.BoxGeometry(...tam), mat));
    m.position.set(...pos); m.rotation.set(...rot);
    b[nombre].add(m);
    return m;
  }
  function esfera(nombre, r, pos, mat, esc = [1, 1, 1]) {
    const m = sombra(new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), mat));
    m.position.set(...pos); m.scale.set(...esc);
    b[nombre].add(m);
    return m;
  }

  // Tronco
  esfera('Hips', 0.16, [0, 0.0, 0], mMalla, [1.05, 0.7, 0.75]);        // pelvis (malla)
  esfera('Spine', 0.15, [0, 0.07, 0], mPiel, [1.0, 0.85, 0.72]);
  esfera('Spine1', 0.16, [0, 0.08, 0], mPiel, [1.05, 0.9, 0.72]);
  esfera('Spine2', 0.18, [0, 0.08, 0.005], mPiel, [1.15, 0.85, 0.72]); // pecho
  seg('Neck', 'Head', 0.055, mPiel);
  // Cabeza + gorro de waterpolo (con protectores de oreja) + nariz para ver hacia dónde mira
  esfera('Head', 0.105, [0, 0.1, 0.01], mPiel, [0.92, 1.08, 1.0]);
  const gorroM = esfera('Head', 0.11, [0, 0.13, 0.0], mGorro, [0.95, 0.9, 1.03]);
  gorroM.geometry = new THREE.SphereGeometry(0.11, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55);
  for (const s of [1, -1]) {
    const oreja = sombra(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 16), mDet));
    oreja.rotation.z = Math.PI / 2; oreja.position.set(0.1 * s, 0.09, 0); b.Head.add(oreja);
  }
  caja('Head', [0.025, 0.035, 0.03], [0, 0.085, 0.105], mPiel);         // nariz
  for (const s of [1, -1]) caja('Head', [0.018, 0.012, 0.01], [0.035 * s, 0.12, 0.098], M(0x222222));
  if (numero != null) {
    const c = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    if (c) {
      c.width = c.height = 64; const x = c.getContext('2d');
      x.fillStyle = '#' + new THREE.Color(gorro).getHexString(); x.fillRect(0, 0, 64, 64);
      x.fillStyle = '#' + new THREE.Color(gorroDetalle).getHexString(); x.font = 'bold 44px sans-serif';
      x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(numero), 32, 34);
      const sp = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.09), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
      sp.position.set(0, 0.16, -0.1); sp.rotation.y = Math.PI; b.Head.add(sp);
    }
  }
  // Brazos
  for (const L of ['Left', 'Right']) {
    seg(L + 'Shoulder', L + 'Arm', 0.05, mPiel);
    seg(L + 'Arm', L + 'ForeArm', 0.058, mPiel);
    seg(L + 'ForeArm', L + 'Hand', 0.045, mPiel);
    const s = L === 'Left' ? 1 : -1;
    caja(L + 'Hand', [0.11, 0.025, 0.085], [0.06 * s, 0, 0], mPiel);        // palma (abierta)
    caja(L + 'Hand', [0.04, 0.02, 0.03], [0.03 * s, 0.0, 0.055], mPiel, [0, 0.5 * s, 0]); // pulgar
    // muslo, pierna, pie
    seg(L + 'UpLeg', L + 'Leg', 0.082, mPiel);
    seg(L + 'Leg', L + 'Foot', 0.058, mPiel);
    caja(L + 'Foot', [0.09, 0.06, 0.24], [0, -0.04, 0.08], mPiel);
  }
  // Malla (bañador) sobre la parte alta de los muslos
  for (const L of ['Left', 'Right']) {
    const m = sombra(new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.085, 0.12, 14), mMalla));
    m.position.set(0, -0.05, 0); b[L + 'UpLeg'].add(m);
  }
  root.updateMatrixWorld(true);
  return root;
}
