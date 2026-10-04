// ===== VISOR DEL BANCO DE DEFENSA (localhost) ============================================================
// Carga el personaje del juego (/personaje.fbx) si existe; si no, usa el maniquí. Genera cada animación sobre
// ESE esqueleto (motor de poses anatómicas), la reproduce con agua, arco, atacante y pelota, y permite exportar
// el AnimationClip en JSON (mismo formato que crawl.json -> cargarClipJSON en el juego).
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { crearEscena } from './escena.js';
import { crearManiqui } from './maniqui.js';
import { crearRig, crearClip, raizEn, posHueso } from './rig.js';
import { BANCO, CATEGORIAS, LEGALIDAD } from './banco.js';

const RAD = Math.PI / 180;
const qs = new URLSearchParams(location.search);
const $ = (s) => document.querySelector(s);
const E = crearEscena($('#lienzo'));
const estado = { sel: null, t: 0, play: true, loop: true, vel: 1, camara: qs.get('cam') || null, modelo: 'maniquí' };

// ---------------------------------------------------------------------------------------------------------
// Personajes
// ---------------------------------------------------------------------------------------------------------
async function cargarFBX() {
  if (qs.get('modelo') === 'maniqui') return null;
  const url = qs.get('fbx') || '/personaje.fbx';
  try {
    const r = await fetch(url, { method: 'HEAD' });
    const ct = r.headers.get('content-type') || '';
    if (!r.ok || ct.includes('text/html')) return null;           // vite devuelve index.html si no existe
    return await new FBXLoader().loadAsync(url);
  } catch (e) { console.warn('[banco] sin personaje.fbx -> maniquí', e); return null; }
}

function prepararPersonaje(obj, { escalarA = null } = {}) {
  obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  const cont = new THREE.Group();
  cont.add(obj);
  E.scene.add(cont);
  const rig = crearRig(obj);
  if (escalarA) obj.scale.multiplyScalar(escalarA / rig.alturaCabezaPie);
  // Que mire a +Z (el banco asume defensor mirando a +Z y el arco que defiende detrás, en -Z)
  obj.updateMatrixWorld(true);
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(rig.C).applyQuaternion(obj.getWorldQuaternion(new THREE.Quaternion()));
  cont.rotation.y = -Math.atan2(fwd.x, fwd.z);
  cont.updateMatrixWorld(true);
  const caderaY = posHueso(rig, 'Hips').y * obj.scale.y;          // altura de la cadera en reposo (m) sobre el origen
  return { cont, obj, rig, caderaY, mixer: new THREE.AnimationMixer(obj), clips: new Map(), accion: null, giro: 0, base: [0, 0] };
}

let DEF, ATA;
const pelota = crearPelota();
E.scene.add(pelota);

async function init() {
  const fbx = await cargarFBX();
  if (fbx) {
    try { DEF = prepararPersonaje(fbx, { escalarA: 1.56 }); estado.modelo = 'personaje.fbx'; }
    catch (e) { console.warn('[banco] personaje.fbx sin huesos Mixamo -> maniquí', e); E.scene.remove(fbx.parent); }
  }
  if (!DEF) DEF = prepararPersonaje(crearManiqui({ gorro: 0xf4f4f4, gorroDetalle: 0x1f5fbf, malla: 0x1f3d8f, numero: 4 }));
  ATA = prepararPersonaje(crearManiqui({ gorro: 0xd32f2f, gorroDetalle: 0xffffff, malla: 0x8e1b1b, piel: 0xc98f6b, numero: 7 }));
  $('#modelo').textContent = estado.modelo;
  construirLista();
  const ini = qs.get('anim') && BANCO.find((b) => b.id === qs.get('anim')) ? qs.get('anim') : BANCO[0].id;
  seleccionar(ini);
  requestAnimationFrame(bucle);
}

function clipDe(pj, clave, poseFn, dur) {
  if (!pj.clips.has(clave)) pj.clips.set(clave, crearClip(pj.rig, clave, poseFn, dur));
  return pj.clips.get(clave);
}
function usarClip(pj, data) {
  pj.mixer.stopAllAction();
  pj.accion = pj.mixer.clipAction(data.clip);
  pj.accion.play(); pj.accion.paused = true;
  pj.data = data;
}
function posar(pj, t) {
  if (!pj.accion) return;
  pj.accion.time = Math.min(t, pj.data.clip.duration);
  pj.mixer.update(0);
  const r = raizEn(pj.data.raiz, Math.min(t, pj.data.clip.duration));
  // la raíz (x,z) va en el marco del jugador -> rotarla por su giro
  const c = Math.cos(pj.giro * RAD), s = Math.sin(pj.giro * RAD);
  pj.cont.position.set(pj.base[0] + r.x * c + r.z * s, r.y - pj.caderaY, pj.base[1] - r.x * s + r.z * c);
  pj.cont.updateMatrixWorld(true);
}

// ---------------------------------------------------------------------------------------------------------
// Pelota (amarilla con franjas azules)
// ---------------------------------------------------------------------------------------------------------
function crearPelota() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#ffd31a'; x.fillRect(0, 0, 256, 128);
  x.strokeStyle = '#1b4fc4'; x.lineWidth = 9;
  for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(i * 43 + 10, 0); x.bezierCurveTo(i * 43 + 40, 40, i * 43 - 10, 90, i * 43 + 20, 128); x.stroke(); }
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 16), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(c), roughness: 0.6 }));
  m.castShadow = true;
  return m;
}
const _p = new THREE.Vector3();
function ubicarPelota(b, t) {
  const pe = b.escena?.pelota;
  pelota.visible = !!pe;
  if (!pe) return;
  const ruta = (pts) => {
    if (t <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      if (t <= pts[i][0]) {
        const a = (t - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]);
        return pts[i - 1][1].map((v, k) => v + (pts[i][1][k] - v) * a);
      }
    }
    return pts[pts.length - 1][1];
  };
  if (pe.tipo === 'mano' && (pe.hasta == null || t <= pe.hasta)) {
    const pj = pe.quien === 'def' ? DEF : ATA;
    const hb = pj.rig.h[(pe.hueso || 'RightHand').replace('Hand', 'HandMiddle1')] || pj.rig.h[pe.hueso || 'RightHand'];
    hb.getWorldPosition(_p);
    pelota.position.set(_p.x, _p.y + (pe.dy ?? 0.06), _p.z);
  } else if (pe.tipo === 'mano' || pe.tipo === 'ruta') {
    const p = ruta(pe.tipo === 'ruta' ? pe.puntos : pe.luego);
    pelota.position.set(p[0], p[1], p[2]);
  } else if (pe.tipo === 'fija') pelota.position.set(...pe.pos);
  pelota.rotation.x = t * 3;
}

// ---------------------------------------------------------------------------------------------------------
// Selección y reproducción
// ---------------------------------------------------------------------------------------------------------
function seleccionar(id) {
  const b = BANCO.find((x) => x.id === id);
  if (!b) return;
  estado.sel = b; estado.t = 0; estado.loop = b.loop; estado.play = true;
  usarClip(DEF, clipDe(DEF, b.id, b.pose, b.dur));
  DEF.base = [0, 0]; DEF.giro = 0;
  const at = b.escena?.atacante;
  ATA.cont.visible = !!at && $('#verAtacante').checked;
  if (at) {
    usarClip(ATA, clipDe(ATA, b.id + ':atacante', at.pose, at.dur || b.dur));
    ATA.base = at.pos || [0, 1]; ATA.giro = at.giro || 0;
    ATA.cont.rotation.y = ATA.giro * RAD;
  }
  E.ajustarArco(b.escena?.arco ?? -4);
  pintarInfo(b);
  document.querySelectorAll('.item').forEach((el) => el.classList.toggle('activo', el.dataset.id === id));
  $('#loop').classList.toggle('on', estado.loop);
  $('#tiempo').max = b.dur;
  E.camara(estado.camara || b.camara || 'lado');
  history.replaceState(null, '', '?' + new URLSearchParams({ ...Object.fromEntries(qs), anim: id }).toString());
}

let ultimo = performance.now();
function bucle(ahora) {
  const dt = Math.min(0.05, (ahora - ultimo) / 1000); ultimo = ahora;
  const b = estado.sel;
  if (b && estado.play) {
    estado.t += dt * estado.vel;
    if (estado.t > b.dur) {
      if (estado.loop) estado.t %= b.dur;
      else { estado.t = b.dur; estado.play = false; setTimeout(() => { if (!estado.play && estado.sel === b && $('#autoRepetir').checked) { estado.t = 0; estado.play = true; } }, 900); }
    }
  }
  pintarFrame();
  E.controls.update();
  E.tamano();
  E.renderer.render(E.scene, E.camera);
  requestAnimationFrame(bucle);
}
function pintarFrame() {
  const b = estado.sel; if (!b) return;
  posar(DEF, estado.t);
  if (b.escena?.atacante) {
    const da = b.escena.atacante.dur || b.dur;
    posar(ATA, b.escena.atacante.sincro === false ? estado.t % da : Math.min(estado.t, da));
  }
  ubicarPelota(b, estado.t);
  $('#tiempo').value = estado.t;
  $('#tLabel').textContent = `${estado.t.toFixed(2)} / ${b.dur.toFixed(2)} s · frame ${Math.round(estado.t * 30)}`;
  $('#play').textContent = estado.play ? '⏸' : '▶';
}

// ---------------------------------------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------------------------------------
function construirLista() {
  const cont = $('#lista');
  cont.innerHTML = '';
  for (const cat of CATEGORIAS) {
    const items = BANCO.filter((b) => b.cat === cat.id);
    if (!items.length) continue;
    const sec = document.createElement('details'); sec.open = true;
    sec.innerHTML = `<summary><span>${cat.nombre}</span><em>${items.length}</em></summary>`;
    for (const b of items) {
      const el = document.createElement('button');
      el.className = 'item'; el.dataset.id = b.id;
      el.innerHTML = `<span class="n">${b.nombre}</span><span class="tags">${b.loop ? '<i class="tag loop">loop</i>' : ''}<i class="tag ${b.legal}">${LEGALIDAD[b.legal].corto}</i></span>`;
      el.onclick = () => { seleccionar(b.id); if (window.innerWidth < 800) document.body.classList.remove('lista-abierta'); };
      sec.appendChild(el);
    }
    cont.appendChild(sec);
  }
  $('#total').textContent = `${BANCO.length} animaciones`;
  $('#buscar').oninput = (e) => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('.item').forEach((el) => {
      const b = BANCO.find((x) => x.id === el.dataset.id);
      el.hidden = q && !(b.nombre + ' ' + b.id + ' ' + b.desc).toLowerCase().includes(q);
    });
  };
}

function pintarInfo(b) {
  const L = LEGALIDAD[b.legal];
  $('#info').innerHTML = `
    <div class="cab"><h2>${b.nombre}</h2><code>${b.id}</code></div>
    <div class="chips"><span class="chip ${b.legal}">${L.largo}</span><span class="chip">${b.dur.toFixed(2)} s</span><span class="chip">${b.loop ? 'loop' : 'una vez'}</span></div>
    <p>${b.desc}</p>
    <h3>Claves técnicas</h3><ul>${b.claves.map((c) => `<li>${c}</li>`).join('')}</ul>
    ${b.juego ? `<h3>En el juego</h3><p class="juego">${b.juego}</p>` : ''}
    ${b.notas ? `<h3>Ojo</h3><p class="nota">${b.notas}</p>` : ''}
    <h3>Fuentes</h3><ul class="fuentes">${b.fuentes.map((f) => `<li><a href="${f.url}" target="_blank" rel="noopener">${f.t}</a></li>`).join('')}</ul>`;
}

function descargar(nombre, obj) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(obj)], { type: 'application/json' }));
  a.download = nombre; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function jsonClip(b) {
  const d = clipDe(DEF, b.id, b.pose, b.dur);
  const j = THREE.AnimationClip.toJSON(d.clip);
  j.raiz = d.raiz;                                   // curva de altura/desplazamiento de la cadera (aplicar aparte)
  j.meta = { id: b.id, nombre: b.nombre, cat: b.cat, loop: b.loop, legal: b.legal, modelo: estado.modelo, fps: 30 };
  return j;
}

$('#play').onclick = () => { if (!estado.play && estado.t >= estado.sel.dur) estado.t = 0; estado.play = !estado.play; };
$('#loop').onclick = () => { estado.loop = !estado.loop; $('#loop').classList.toggle('on', estado.loop); };
$('#vel').oninput = (e) => { estado.vel = +e.target.value; $('#velLabel').textContent = estado.vel.toFixed(2) + 'x'; };
$('#tiempo').oninput = (e) => { estado.t = +e.target.value; estado.play = false; };
$('#prev').onclick = () => { estado.play = false; estado.t = Math.max(0, estado.t - 1 / 30); };
$('#next').onclick = () => { estado.play = false; estado.t = Math.min(estado.sel.dur, estado.t + 1 / 30); };
$('#exportar').onclick = () => descargar(`${estado.sel.id}.json`, jsonClip(estado.sel));
$('#exportarTodo').onclick = () => {
  const out = { generado: new Date().toISOString(), modelo: estado.modelo, banco: BANCO.map((b) => ({ id: b.id, cat: b.cat, nombre: b.nombre, file: `anim/defensa/${b.id}.json`, loop: b.loop, legal: b.legal, dur: b.dur })), clips: {} };
  for (const b of BANCO) out.clips[b.id] = jsonClip(b);
  descargar('banco-defensa-clips.json', out);
};
$('#verAgua').onchange = (e) => { E.agua.visible = e.target.checked; };
$('#verAtacante').onchange = (e) => { ATA.cont.visible = e.target.checked && !!estado.sel?.escena?.atacante; };
$('#menu').onclick = () => document.body.classList.toggle('lista-abierta');
document.querySelectorAll('[data-cam]').forEach((el) => { el.onclick = () => { estado.camara = el.dataset.cam; E.camara(el.dataset.cam); }; });
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space') { e.preventDefault(); $('#play').click(); }
  if (e.key === 'ArrowRight') $('#next').click();
  if (e.key === 'ArrowLeft') $('#prev').click();
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const i = BANCO.indexOf(estado.sel) + (e.key === 'ArrowDown' ? 1 : -1);
    if (BANCO[i]) seleccionar(BANCO[i].id);
  }
});

// API para pruebas automáticas (capturas)
window.__banco = {
  ids: BANCO.map((b) => b.id),
  seleccionar, camara: (n) => { estado.camara = n; E.camara(n); },
  tiempo: (t) => { estado.play = false; estado.t = t; pintarFrame(); E.renderer.render(E.scene, E.camera); },
  estado: () => ({ id: estado.sel?.id, t: estado.t, modelo: estado.modelo }),
  medir: (n) => posHueso(DEF.rig, n).multiplyScalar(DEF.obj.scale.y).add(new THREE.Vector3(0, DEF.cont.position.y, 0)),
};
init().then(() => { window.__banco.listo = true; }).catch((e) => { console.error(e); $('#info').textContent = 'Error: ' + e.message; });
