// ===== ESCENA del banco: piscina, agua (y = 0 es la superficie), arco, marcas de 2 m / 5 m, luces y cámaras =====
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export function crearEscena(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e2238);
  scene.fog = new THREE.Fog(0x0e2238, 18, 45);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 200);
  camera.position.set(4.2, 1.1, 1.2);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0.2, 0);
  controls.enableDamping = true;

  scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x0b3550, 1.15));
  const sol = new THREE.DirectionalLight(0xffffff, 1.6);
  sol.position.set(6, 12, 5);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  Object.assign(sol.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 40 });
  scene.add(sol);

  // Fondo de la piscina (2 m de profundidad) con baldosas
  const fondo = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), new THREE.MeshStandardMaterial({ color: 0x3fa7d6, roughness: 0.9 }));
  fondo.rotation.x = -Math.PI / 2; fondo.position.y = -2.0; fondo.receiveShadow = true;
  scene.add(fondo);
  const grid = new THREE.GridHelper(40, 80, 0x2b7fb0, 0x2b7fb0);
  grid.position.y = -1.99; grid.material.opacity = 0.35; grid.material.transparent = true;
  scene.add(grid);

  // Agua: superficie semitransparente; desde abajo también se ve (DoubleSide)
  const agua = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 30, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x1d8fd8, transparent: true, opacity: 0.42, roughness: 0.15, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false }),
  );
  agua.rotation.x = -Math.PI / 2; agua.renderOrder = 10;
  scene.add(agua);
  // Línea de flotación (anillo fino a nivel del agua) para ver bien qué parte del cuerpo sale
  const linea = new THREE.Mesh(new THREE.RingGeometry(0.0, 40, 4), new THREE.MeshBasicMaterial({ visible: false }));
  scene.add(linea);

  // Arco (3 m x 0,90 m sobre el agua) — se mueve según la escena de cada animación (siempre detrás del defensor, -Z)
  const arco = new THREE.Group();
  const mPalo = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
  const palo = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mPalo); m.position.set(x, y, z); m.castShadow = true; arco.add(m); };
  palo(0.075, 1.0, 0.075, 1.5, 0.45, 0); palo(0.075, 1.0, 0.075, -1.5, 0.45, 0); palo(3.08, 0.075, 0.075, 0, 0.92, 0);
  const red = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.0, 0.8), new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.25 }));
  red.position.set(0, 0.45, -0.4); arco.add(red);
  scene.add(arco);

  // Marcas laterales: boyas de 2 m (rojo), 5 m (amarillo) y 6 m (verde) desde la línea de gol
  const marcas = new THREE.Group();
  for (const [d, c] of [[2, 0xe53935], [5, 0xffd600], [6, 0x43a047]]) {
    for (const x of [-5, 5]) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), new THREE.MeshStandardMaterial({ color: c }));
      b.position.set(x, 0.03, d); marcas.add(b);
    }
  }
  arco.add(marcas);

  function ajustarArco(z) { arco.position.set(0, 0, z); }

  function tamano() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    }
  }

  // Presets de cámara (mirando al defensor en el origen). foco = altura de mira.
  const CAMARAS = {
    lado: { pos: [4.2, 0.9, 0.6], foco: [0, 0.15, 0.2] },
    frente: { pos: [0.3, 0.9, 4.4], foco: [0, 0.15, 0] },
    atras: { pos: [0.4, 1.4, -4.2], foco: [0, 0.1, 0.6] },
    arriba: { pos: [0.01, 6.5, 0.6], foco: [0, 0, 0.6] },
    bajoAgua: { pos: [3.2, -1.0, 1.6], foco: [0, -0.4, 0.2] },
    tribuna: { pos: [7, 4.5, 4], foco: [0, 0, 0.5] },
  };
  function camara(nombre, seguir = new THREE.Vector3()) {
    const c = CAMARAS[nombre] || CAMARAS.lado;
    camera.position.set(c.pos[0] + seguir.x, c.pos[1], c.pos[2] + seguir.z);
    controls.target.set(c.foco[0] + seguir.x, c.foco[1], c.foco[2] + seguir.z);
    controls.update();
  }

  return { renderer, scene, camera, controls, agua, arco, ajustarArco, tamano, camara, CAMARAS };
}
