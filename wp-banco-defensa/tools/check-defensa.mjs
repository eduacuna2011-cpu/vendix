// ===== Chequeo automático del banco (Node, sin navegador) ==================================================
// Genera TODAS las animaciones sobre el maniquí y valida: NaN, extremidades sin definir, giros fuera de rango,
// codos/rodillas al revés o con ángulos imposibles, loops que no cierran, pies fuera del agua en posturas verticales,
// manos de bloqueo que no salen del agua, etc.   Uso: node tools/check-defensa.mjs [id]
import { crearManiqui } from '../banco-defensa/maniqui.js';
import { crearRig, aplicarPose, crearClip, posHueso, anguloArticular, signoFlexion } from '../banco-defensa/rig.js';
import { BANCO } from '../banco-defensa/banco.js';

const solo = process.argv[2];
const rig = crearRig(crearManiqui());
const caderaY = posHueso(rig, 'Hips').y;
let errores = 0, avisos = 0;
const fmt = (x) => (Math.round(x * 100) / 100).toFixed(2);

for (const b of BANCO) {
  if (solo && b.id !== solo) continue;
  const msgs = [];
  rig.alertas = []; rig.faltantes = new Set();
  const { clip } = crearClip(rig, b.id, b.pose, b.dur);
  // NaN
  if (clip.tracks.some((tr) => tr.values.some((v) => !Number.isFinite(v)))) msgs.push(['ERROR', 'valores NaN/Infinity en el clip']);
  // loop: primer y último frame iguales
  if (b.loop) {
    let peor = 0, hueso = '';
    for (const tr of clip.tracks) {
      const n = tr.values.length / 4, a = tr.values.slice(0, 4), z = tr.values.slice((n - 1) * 4);
      const d = Math.min(1, Math.abs(a[0] * z[0] + a[1] * z[1] + a[2] * z[2] + a[3] * z[3]));
      const ang = 2 * Math.acos(d) * 180 / Math.PI;
      if (ang > peor) { peor = ang; hueso = tr.name; }
    }
    if (peor > 3) msgs.push(['ERROR', `el loop no cierra: ${hueso} salta ${peor.toFixed(1)}°`]);
  }
  // muestreo de articulaciones y alturas
  let minCodo = 999, maxCodo = 0, minRod = 999, maxRod = 0, pieArriba = -9, manoMax = -9, codoMal = 0, rodMal = 0;
  for (let t = 0; t <= b.dur + 1e-6; t += 1 / 15) {
    const pose = b.pose(Math.min(t, b.dur));
    aplicarPose(rig, pose);
    const ry = (pose.raiz?.y ?? -0.42) - caderaY;
    for (const L of ['Left', 'Right']) {
      const c = anguloArticular(rig, L + 'Arm', L + 'ForeArm', L + 'Hand');
      const r = anguloArticular(rig, L + 'UpLeg', L + 'Leg', L + 'Foot');
      minCodo = Math.min(minCodo, c); maxCodo = Math.max(maxCodo, c); minRod = Math.min(minRod, r); maxRod = Math.max(maxRod, r);
      if (c > 12 && signoFlexion(rig, L + 'Arm', L + 'ForeArm', L + 'Hand') < 0) codoMal++;
      if (r > 12 && signoFlexion(rig, L + 'UpLeg', L + 'Leg', L + 'Foot') < 0) rodMal++;
      pieArriba = Math.max(pieArriba, posHueso(rig, L + 'Foot').y + ry);
      manoMax = Math.max(manoMax, posHueso(rig, L + 'Hand').y + ry);
    }
  }
  if (rig.faltantes.size) msgs.push(['ERROR', 'pose sin definir (queda en T-pose): ' + [...rig.faltantes].join(', ')]);
  if (codoMal) msgs.push(['ERROR', `codo flexionando al revés en ${codoMal} muestras`]);
  if (rodMal) msgs.push(['ERROR', `rodilla flexionando al revés en ${rodMal} muestras`]);
  if (maxCodo > 155) msgs.push(['AVISO', `codo muy cerrado (${maxCodo.toFixed(0)}°)`]);
  if (maxRod > 150) msgs.push(['AVISO', `rodilla muy cerrada (${maxRod.toFixed(0)}°)`]);
  if (pieArriba > -0.05) msgs.push(['AVISO', `un pie llega a ${fmt(pieArriba)} m (¿sale del agua?)`]);
  if (b.cat === 'bloqueo' && b.legal === 'legal' && manoMax < 0.9) msgs.push(['AVISO', `bloqueo: la mano solo llega a ${fmt(manoMax)} m sobre el agua`]);
  const alertas = [...new Set(rig.alertas)];
  if (alertas.length) msgs.push(['AVISO', `${alertas.length} giro(s) de cadera/hombro limitados: ${alertas.slice(0, 2).join(' | ')}`]);

  for (const [n] of msgs) n === 'ERROR' ? errores++ : avisos++;
  const estado = msgs.some((m) => m[0] === 'ERROR') ? '❌' : msgs.length ? '⚠️ ' : '✅';
  console.log(`${estado} ${b.id.padEnd(28)} ${b.dur.toFixed(2)}s ${b.loop ? 'loop' : '    '}  codo ${minCodo.toFixed(0)}–${maxCodo.toFixed(0)}°  rodilla ${minRod.toFixed(0)}–${maxRod.toFixed(0)}°  mano máx ${fmt(manoMax)} m  pie máx ${fmt(pieArriba)} m`);
  for (const [n, m] of msgs) console.log(`     ${n}: ${m}`);
}
console.log(`\n${BANCO.length} animaciones · ${errores} errores · ${avisos} avisos`);
process.exitCode = errores ? 1 : 0;
