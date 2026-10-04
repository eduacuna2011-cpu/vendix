// ===== BANCO DE ANIMACIONES DE DEFENSA (waterpolo) =======================================================
// Cada entrada: { id, cat, nombre, dur, loop, legal, desc, claves[], juego, notas?, fuentes[], pose(t), camara?, escena }
//   pose(t)  -> pose anatómica del DEFENSOR (ver rig.js / poses.js). Mira a +Z; el arco que defiende está en -Z.
//   escena   -> { arco: z del arco, atacante: { pose(t), pos:[x,z], giro: grados (0 = mira a +Z, 180 = mira al arco), dur? },
//                pelota: { tipo:'mano'|'ruta'|'fija', ... } }  (solo para ver el contexto; no se exporta al juego)
// legal: 'legal' | 'tactica' (falta ordinaria/zona gris, se usa a propósito) | 'ilegal' (exclusión o penal)
import {
  nv, TAU, suave, rapido, lento, secuencia, capas, espejo, eggbeater, eggSplit, patadaCrol, patadaWhip,
  scullBrazo, sculling, brazoArriba, brazoHacia, crolBrazos, crolCabezaAlta, baseVertical, basePresion, rebote,
} from './poses.js';

export const LEGALIDAD = {
  legal: { corto: 'legal', largo: '✅ Legal' },
  tactica: { corto: 'falta táctica', largo: '⚠️ Falta ordinaria / zona gris (se usa a propósito)' },
  ilegal: { corto: 'ILEGAL', largo: '⛔ Ilegal (exclusión o penal) — para animar la falta' },
};

export const CATEGORIAS = [
  { id: 'base', nombre: 'A · Postura base' },
  { id: 'mov', nombre: 'B · Desplazamientos' },
  { id: 'bloqueo', nombre: 'C · Bloqueo de tiro' },
  { id: 'boya', nombre: 'D · Defensa del boya (2 m)' },
  { id: 'robo', nombre: 'E · Robo e intercepción' },
  { id: 'driver', nombre: 'F · Defensa del driver' },
  { id: 'zona', nombre: 'G · Inferioridad (5 vs 6)' },
  { id: 'reglas', nombre: 'H · Faltas y reglas' },
  { id: 'reac', nombre: 'I · Reacciones' },
];

// ---- Fuentes -------------------------------------------------------------------------------------------------
const F = {
  ind: { t: 'Water Polo Planet – Individual Defense (M. Nitzkowski)', url: 'http://www.waterpoloplanet.com/HTML_Monte_pages/mn03_Individual_Defense.html' },
  centro: { t: 'Water Polo Planet – Fundamentals of the Center Defender', url: 'http://www.waterpoloplanet.com/fundamentals-of-the-center-defender/' },
  tact1: { t: 'Water Polo Planet – Defensive Tactics (parte 1)', url: 'http://www.waterpoloplanet.com/HTML_Robert_pages/02_Defensive_Tactics1.html' },
  tact2: { t: 'Water Polo Planet – Defensive Tactics (parte 2)', url: 'http://www.waterpoloplanet.com/HTML_Robert_pages/02_Defensive_Tactics2.html' },
  contra: { t: 'Water Polo Planet – Defending the Counterattack', url: 'http://www.waterpoloplanet.com/HTML_Monte_pages/mn06_Defending_the_Counterattack.html' },
  guy: { t: 'Guy Baker – Counterattack Technical', url: 'http://www.waterpoloplanet.com/HTML_Guy_pages/gb04_guys_coaching_corner.html' },
  presTec: { t: 'Water Polo Planet – Pressure Defense: Technical Component', url: 'http://www.waterpoloplanet.com/pressure-defense-technical-component/' },
  presTac: { t: 'Water Polo Planet – Pressure Defense: Tactical Component', url: 'http://www.waterpoloplanet.com/pressure-defense-tactical-component/' },
  press: { t: 'Water Polo To Go – Press (handout)', url: 'http://www.waterpoloplanet.com/HTML_Monique_pages/press.html' },
  terry: { t: 'Terry Schroeder – Back to Fundamentals (bloqueo)', url: 'http://www.waterpoloplanet.com/HTML_Terry_pages/ts51_Terrys_BTF1.html' },
  seis5: { t: 'Water Polo Planet – 6 on 5', url: 'http://www.waterpoloplanet.com/HTML_guest_pages/46_guest_water_polo_6_on_5.html' },
  wpuBloq: { t: 'Water Polo University – Shot Blocking (U10–U15)', url: 'https://www.waterpolouniversity.com/blog/3b91c86a-4aae-4c06-826f-78727839468e' },
  wpuDef: { t: 'Water Polo University – Water Polo Defense Explained', url: 'https://www.waterpolouniversity.com/blog/bdff6581-764c-43aa-80de-c1f86710c1c5' },
  soDef: { t: 'SwimOutlet – Basic Water Polo Defense', url: 'https://www.swimoutlet.com/blogs/guides/basic-water-polo-defense' },
  soRobo: { t: 'SwimOutlet – How to Steal the Ball in Water Polo', url: 'https://www.swimoutlet.com/blogs/guides/how-to-steal-the-ball-in-water-polo' },
  so5m: { t: 'SwimOutlet – Defense during a five-meter', url: 'https://www.swimoutlet.com/guides/how-to-play-defense-during-a-five-meter-in-water-polo' },
  reglas: { t: 'World Aquatics – Water Polo Rules 2022–2025 (PDF)', url: 'https://resources.fina.org/fina/document/2023/02/03/7935d035-dbdf-43f3-96b5-e40cb355dd84/221230-CLEAN-2022-2024_WP_Rules-Integration_diagrams-002-.pdf' },
  reg2025: { t: 'World Aquatics – Competition Regulations Water Polo 2025 (PDF)', url: 'https://waterpoloserbia.org/wp-content/uploads/2026/02/Vaterpolo-pravila-2025-Engleski.pdf' },
  awp: { t: 'American Water Polo – Basic Rules (Defense)', url: 'https://americanwaterpolo.org/lessons/lesson-7-basic-rules-part-2/' },
  egg: { t: 'Wikipedia – Eggbeater kick', url: 'https://en.wikipedia.org/wiki/Eggbeater_kick' },
  oliveira: { t: 'Oliveira et al. 2015 – Kinematic patterns of the eggbeater kick (J Sports Sci 33:16)', url: 'https://www.tandfonline.com/doi/full/10.1080/02640414.2014.1003590' },
  alexander: { t: 'M. Alexander – The Technique of the Eggbeater Kick (Water Polo Canada)', url: 'https://cloud.rampinteractive.com/waterpoloca/files/LTAD/EggBeater.pdf' },
  glos: { t: 'Wikipedia – Glossary of water polo', url: 'https://en.wikipedia.org/wiki/Glossary_of_water_polo' },
  hole: { t: 'Wikipedia – Hole set', url: 'https://en.wikipedia.org/wiki/Hole_set' },
  kap7: { t: 'KAP7 – Cómo defender los 2 metros siendo más bajo', url: 'https://collegiatewaterpolo.org/kap7-tip-of-the-week-classic-edition-how-to-defend-two-meters-as-a-smaller-player/' },
  flacks: { t: 'Total Water Polo – Coach Flacks: principios de defensa', url: 'https://totalwaterpolo.com/2020/04/08/coach-flacks-front-court-defense-principles/' },
  youth: { t: 'Youth Inc. – Recursos de bloqueo de tiro (videos)', url: 'https://www.youth.inc/learn/youth-inc-recommends-three-great-resources-to-master-the-art-of-shot-blocking-in-water-polo' },
  biwpa: { t: 'BIWPA – Technical Corner (videos de técnica)', url: 'https://www.biwpa.com/technical-corner/' },
  tisca: { t: 'TISCA – Water Polo High School Coaching Manual', url: 'https://www.txwaterpolo.com/wp-content/uploads/2019/09/TISCA-Water-Polo-High-School-Coaching-Manual.pdf' },
};

// ---- Atacantes (maniquí rojo) ------------------------------------------------------------------------------
const ataVertical = (t) => ({ ...baseVertical(t, { y: -0.45, pitch: 8, periodo: 0.75 }) });
// Boya (centro) de espaldas al arco: sentado/recostado atrás, brazos abiertos remando, piernas fuertes.
const ataBoya = (t) => ({
  cuerpo: { pitch: -12 }, columna: { flex: 6 }, cuello: { flex: 10 },
  ...eggbeater(t, { periodo: 0.75, potencia: 1.1 }), ...sculling(t, { periodo: 0.75, ancho: 1.15 }),
  raiz: { y: -0.4 + rebote(t, 0.75) },
});
// Tirador armado (diestro): brazo derecho arriba-atrás con la pelota, brazo izquierdo adelante equilibrando.
const brazoArmado = { marco: 'mundo', sup: nv(-0.35, 0.55, -0.45), inf: nv(-0.08, 0.96, -0.2), palma: [0, 0, 1], fin: nv(0, 0.8, 0.55) };
const brazoTiro = { marco: 'mundo', sup: nv(-0.12, 0.45, 0.88), inf: nv(-0.05, 0.1, 1), palma: [0, -1, 0.3], fin: nv(0, -0.3, 1) };
const brazoBalance = { marco: 'mundo', sup: nv(0.55, 0.05, 0.8), inf: nv(0.45, 0.05, 0.9), palma: [0, -1, 0], prono: 60 };
const ataArmado = (t) => ({
  cuerpo: { pitch: 4 }, columna: { giro: -28, flex: -4 }, cuello: { giro: 24 },
  ...eggbeater(t, { periodo: 0.6, potencia: 1.25 }),
  brazoD: brazoArmado, brazoI: brazoBalance, hombroD: { elev: 10 },
  raiz: { y: -0.22 + rebote(t, 0.6, 0.015) },
});
const ataDisparo = (tTiro) => secuencia([
  [0, ataArmado], [tTiro - 0.12, ataArmado],
  [tTiro, (t) => ({ ...ataArmado(t), columna: { giro: 10, flex: 10 }, brazoD: brazoTiro, cuello: { giro: 0 } }), rapido],
  [tTiro + 0.5, (t) => ({ ...ataVertical(t), raiz: { y: -0.3 } })],
]);
// Amague del tirador: arma, baja el brazo como si tirara y vuelve a armar (sin soltar la pelota).
const ataAmague = (tA) => secuencia([
  [0, ataArmado], [tA - 0.1, ataArmado],
  [tA + 0.08, (t) => ({ ...ataArmado(t), columna: { giro: 2, flex: 6 }, brazoD: { ...brazoTiro, inf: nv(-0.05, 0.6, 0.8) } }), rapido],
  [tA + 0.45, ataArmado],
]);
const ataNadador = (t) => crolCabezaAlta(t, { periodo: 1.0, velocidad: 0 });
// Atacante con la pelota en la superficie, caderas abajo, de espaldas al defensor (protegiendo).
const ataBalonAgua = (t) => ({
  cuerpo: { pitch: 25 }, cuello: { flex: -15 },
  ...eggbeater(t, { periodo: 0.75 }),
  brazoD: { marco: 'mundo', sup: nv(-0.15, -0.45, 0.9), inf: nv(-0.05, -0.5, 0.85), palma: [0, -1, 0], prono: -70 },
  brazoI: scullBrazo(t, 'I'),
  raiz: { y: -0.5 },
});

// ---- Piezas del defensor --------------------------------------------------------------------------------------
const scullI = (t, o) => ({ brazoI: scullBrazo(t, 'I', o) });
const scullD = (t, o) => ({ brazoD: scullBrazo(t, 'D', o) });
const manoLista = (lado) => {                // "mano lista": antebrazo vertical, codo a la altura del hombro (pre-bloqueo)
  const s = lado === 'I' ? 1 : -1;
  return { marco: 'mundo', sup: nv(s * 0.55, 0.35, 0.55), inf: nv(s * 0.1, 1, 0.15), palma: [0, 0, 1], fin: nv(0, 1, 0.3) };
};
const trípode = (t, { y = -0.3, pitch = 16, lado = 'I' } = {}) => ({     // lado = brazo que bloquea
  cuerpo: { pitch }, columna: { flex: 2 }, cuello: { flex: -pitch * 0.8 },
  ...eggSplit(t, { adelante: lado === 'I' ? 'D' : 'I' }),
  ...(lado === 'I' ? scullD(t, { periodo: 0.5 }) : scullI(t, { periodo: 0.5 })),
  raiz: { y: y + rebote(t, 0.6, 0.012) },
});
const bloqueoArriba = (t, { y = -0.12, lado = 'I', incl = 0.18, abre = 0.1, pitch = 14 } = {}) => ({
  ...trípode(t, { y, pitch, lado }),
  ['brazo' + lado]: brazoArriba(lado, { incl, abre }),
  ['hombro' + lado]: { elev: 18, adel: 6 },
  columna: { lat: lado === 'I' ? -6 : 6, flex: 0 },
});

// Escenas reutilizables
const tiradorEnfrente = (z = 2.2, extra = {}) => ({ arco: -4.5, atacante: { pose: ataArmado, pos: [0, z], giro: 180 }, pelota: { tipo: 'mano', quien: 'ata', hueso: 'RightHand' }, ...extra });

// ==============================================================================================================
export const BANCO = [
  // ============================================ A · POSTURA BASE ============================================
  {
    id: 'def_base_eggbeater', cat: 'base', nombre: 'Eggbeater base (vertical)', dur: 3.0, loop: true, legal: 'legal',
    desc: 'Postura neutra del defensor: casi vertical, caderas altas y hombros sobre las caderas, eggbeater continuo y manos remando (sculling) a los costados. Es la "posición lista" desde la que sale todo lo demás.',
    claves: [
      'Muslos casi horizontales y abiertos (cadera ~80–90° de flexión y ~90° de abducción), como sentado en una silla con las rodillas separadas.',
      'Cada pie dibuja un círculo bajo su rodilla; piernas alternadas (medio ciclo de desfase) y girando en sentidos opuestos → empuje vertical continuo, sin "subir y bajar".',
      'Manos bajo la superficie haciendo "8" (sculling) para estabilizar; cabeza quieta mirando la pelota.',
      'Agua a la altura del pecho/hombros. Leve inclinación al frente para poder arrancar.',
    ],
    juego: 'Reemplazo de idle/armado para defensores sin acción. Loop; aplicar raiz.y como altura de flotación.',
    fuentes: [F.egg, F.oliveira, F.alexander, F.soDef],
    pose: (t) => baseVertical(t, { periodo: 0.75 }),
    escena: { arco: -4 },
  },
  {
    id: 'def_press', cat: 'base', nombre: 'Presión (press) con mano al hombro', dur: 3.0, loop: true, legal: 'legal',
    desc: 'Marca cerrada hombre a hombre con la pelota a un pase: cuerpo semi-horizontal entre el atacante y el arco, piernas detrás apuntando al centro del arco, pecho abierto hacia la pelota, mano del lado de la pelota ARRIBA en la línea de pase y la otra en el hombro (lado pelota) del atacante.',
    claves: [
      'Caderas en la superficie y apuntando al arco: permiten cambiar de dirección rápido.',
      'Cabeza entre el atacante y la pelota (lo ve a él y a la pelota a la vez).',
      'Mano del lado pelota arriba (desalienta el pase); la otra solo "siente" el hombro — no sujetar (exclusión).',
      'Si la pelota está más lejos, se pasa a presión en la línea de pase sin contacto (ver def_lane_press).',
    ],
    juego: 'Defensor marcando a un perímetro SIN pelota cuando la pelota está a un pase (iaDefensa con press).',
    fuentes: [F.press, F.presTec, F.wpuDef, F.ind],
    pose: (t) => ({
      ...basePresion(t, { pitch: 48, y: -0.2 }),
      columna: { giro: -18, flex: -6 }, cuello: { flex: -40, giro: -28 },
      brazoD: { marco: 'mundo', sup: nv(-0.42, 0.85, 0.3), inf: nv(-0.35, 0.92, 0.35), palma: [0, 0, 1], fin: nv(-0.3, 0.9, 0.4) },
      brazoI: brazoHacia('I', [-0.2, -0.1, 1], { codo: 0.2, marco: 'mundo' }),
      hombroD: { elev: 12 },
    }),
    escena: { arco: -5, atacante: { pose: ataVertical, pos: [-0.1, 0.85], giro: 170 }, pelota: { tipo: 'fija', pos: [-4.5, 0.35, 4.5] } },
    camara: 'tribuna',
  },
  {
    id: 'def_lane_press', cat: 'base', nombre: 'Presión en la línea de pase', dur: 3.0, loop: true, legal: 'legal',
    desc: 'Con la pelota lejos (a dos pases), el defensor se adelanta y se para EN la línea de pase entre la pelota y su atacante, sin tocarlo: brazo arriba para cortar el pase y cuerpo listo para girar si el atacante corta hacia el arco.',
    claves: [
      'Estar entre la pelota y el atacante (no entre el atacante y el arco): "lane press".',
      'Sin contacto: la ventaja viene de la posición, no de agarrar.',
      'Brazo del lado de la pelota arriba, el otro remando para mantener la altura.',
      'Si el atacante corta por detrás (backdoor), girar sobre las piernas y nadar (ver def_paso_atras_nado).',
    ],
    juego: 'Defensor del lado débil / dos pases lejos de la pelota. Buen loop para IA "negar pase".',
    fuentes: [F.presTac, F.press, F.wpuDef],
    pose: (t) => ({
      ...basePresion(t, { pitch: 38, y: -0.24 }),
      columna: { giro: -10 }, cuello: { flex: -30, giro: -15 },
      brazoD: { marco: 'mundo', sup: nv(-0.3, 0.88, 0.38), inf: nv(-0.22, 0.92, 0.4), palma: [0, 0, 1] },
      ...scullI(t),
    }),
    escena: { arco: -5, atacante: { pose: ataVertical, pos: [0.85, -0.6], giro: 0 }, pelota: { tipo: 'fija', pos: [-2.5, 0.35, 7] } },
    camara: 'tribuna',
  },
  {
    id: 'def_eggbeater_alto', cat: 'base', nombre: 'Eggbeater alto con mano arriba', dur: 3.0, loop: true, legal: 'legal',
    desc: 'Elevación sostenida con un brazo vertical ("hand up"): el defensor sube el agua hasta la mitad del pecho con un eggbeater más rápido y amplio, y deja un brazo arriba para tapar línea de pase o de tiro.',
    claves: [
      'La fuerza vertical crece con más abducción/flexión de cadera y con una extensión de rodilla más rápida (Oliveira 2015).',
      'Brazo arriba vertical, codo firme, mano abierta; el otro brazo rema fuerte para no hundirse.',
      'Cadencia más alta que la base; mirada a la pelota.',
    ],
    juego: 'Defensor de zona / a 2–3 m del tirador sin pelota todavía. Usar raiz.y para subirlo.',
    fuentes: [F.oliveira, F.egg, F.wpuBloq],
    pose: (t) => ({
      ...baseVertical(t, { y: -0.3, pitch: 10, periodo: 0.6, potencia: 1.25, scull: false }),
      brazoD: brazoArriba('D', { incl: 0.08 }), hombroD: { elev: 15 },
      ...scullI(t, { periodo: 0.5 }),
      columna: { lat: 5 },
    }),
    escena: { arco: -4 },
  },
  {
    id: 'def_tripode_split', cat: 'base', nombre: 'Trípode (eggbeater en split)', dur: 3.0, loop: true, legal: 'legal',
    desc: 'Posición previa al bloqueo frente a un tirador: eggbeater en SPLIT (una pierna adelante, otra atrás), brazo de bloqueo en "mano lista" y el otro remando. Si bloquea con el brazo izquierdo, la pierna derecha va adelante.',
    claves: [
      'Pierna de adelante = ELEVADORA (potencia vertical); pierna de atrás = cierra la distancia (potencia horizontal).',
      'Brazo libre en sculling para el equilibrio y para desplazarse lateralmente.',
      'El brazo que bloquea NO se usa para faltas; si hay que hacer falta, se hace con el otro brazo.',
      'Bloquear el lado del brazo de tiro; el arquero cubre el otro lado.',
    ],
    juego: 'Defensor encarando a un tirador con pelota (antes del tiro).',
    fuentes: [F.wpuBloq, F.terry, F.youth],
    pose: (t) => ({ ...trípode(t, { y: -0.3, lado: 'I' }), brazoI: manoLista('I'), hombroI: { elev: 8 } }),
    escena: tiradorEnfrente(2.2),
  },

  // ============================================ B · DESPLAZAMIENTOS ==========================================
  {
    id: 'def_lateral', cat: 'mov', nombre: 'Desplazamiento lateral en eggbeater', dur: 3.0, loop: true, legal: 'legal',
    desc: 'Moverse de costado sin perder la altura ni la cara al frente: el eggbeater se inclina hacia el lado del movimiento y las manos empujan el agua hacia el lado contrario.',
    claves: [
      'Nunca girar la espalda a la pelota: el cuerpo se desliza, los ojos siguen al frente.',
      'Cadera alta; los círculos de los pies se inclinan hacia el lado de avance.',
      'Leve inclinación del tronco hacia donde va.',
    ],
    juego: 'Seguir a un perímetro que se desplaza, deslizarse en zona. raiz.x = desplazamiento (en el juego lo controla la IA).',
    fuentes: [F.egg, F.alexander, F.soDef],
    pose: (t) => {
      const ph = TAU * t / 3.0, v = Math.cos(ph);
      return {
        ...baseVertical(t, { y: -0.4, pitch: 10, periodo: 0.75 }),
        ...eggbeater(t, { periodo: 0.75, avanceX: v }),
        cuerpo: { pitch: 10, lat: -10 * v },
        brazoI: scullBrazo(t, 'I', { ancho: 1 - 0.25 * v }), brazoD: scullBrazo(t, 'D', { ancho: 1 + 0.25 * v, fase: Math.PI }),
        raiz: { y: -0.4 + rebote(t), x: 0.45 * Math.sin(ph) },
      };
    },
    escena: { arco: -4 },
    camara: 'frente',
  },
  {
    id: 'def_paso_atras_nado', cat: 'mov', nombre: 'Paso atrás sobre las piernas y nado (vs. driver)', dur: 2.2, loop: false, legal: 'legal',
    desc: 'El defensor espera semi-vertical con las piernas detrás apuntando al centro del arco. Cuando el atacante arranca su drive, "da un paso atrás por encima de sus piernas": se recuesta, gira y sale nadando hacia su arco para ganar el agua de adentro.',
    claves: [
      'Posición de espera: semi-vertical, piernas atrás hacia el centro del arco.',
      'Reaccionar al primer movimiento del driver; si espera a que pase, ya perdió la posición.',
      'Salir con crol a cabeza alta, por DENTRO (entre el driver y el centro del arco).',
    ],
    juego: 'Transición defensa-de-campo → seguimiento del driver. Encadenar con def_driver_inside_water.',
    fuentes: [F.ind, F.soDef, F.wpuDef],
    pose: secuencia([
      [0, (t) => ({ ...baseVertical(t, { y: -0.38, pitch: -12 }), cuello: { flex: 8 } })],
      [0.25, (t) => ({ ...baseVertical(t, { y: -0.38, pitch: -12 }), cuello: { flex: 8 } })],
      [0.6, (t) => ({ ...baseVertical(t, { y: -0.3, pitch: -45 }), cuerpo: { pitch: -45, giro: 60 }, cuello: { giro: 40, flex: 20 }, ...patadaWhip(t), raiz: { y: -0.3, z: -0.1 } })],
      [1.0, (t) => ({ ...crolCabezaAlta(t, { velocidad: 0 }), cuerpo: { pitch: 55, giro: 180 }, raiz: { y: -0.15, z: -0.35 } })],
      [2.2, (t) => ({ ...crolCabezaAlta(t, { velocidad: 0 }), cuerpo: { pitch: 70, giro: 180, lat: 10 * Math.sin(TAU * t) }, raiz: { y: -0.12, z: -2.2 } }), (x) => x],
    ]),
    escena: { arco: -6, atacante: { pose: ataNadador, pos: [0.9, 1.6], giro: 180 } },
    camara: 'tribuna',
  },
  {
    id: 'def_crol_cabeza_alta', cat: 'mov', nombre: 'Crol a cabeza alta (repliegue)', dur: 2.0, loop: true, legal: 'legal',
    desc: 'Nado de repliegue con la cabeza fuera del agua mirando el juego: tronco más inclinado que en crol normal, brazada corta y de codo alto, patada rápida. En el loop nada "en el lugar" (el juego pone la velocidad).',
    claves: [
      'Cabeza arriba para ver la pelota y al rival; brazada más corta y frecuente.',
      'Volver "por dentro" (por el centro) y llegar al hombre antes que la pelota.',
      'Reaccionar cuando la pelota sale de la mano del tirador, no después.',
    ],
    juego: 'Reemplazo de crawl.json cuando el defensor vuelve a su arco (repliegue).',
    fuentes: [F.contra, F.guy, F.glos],
    pose: (t) => crolCabezaAlta(t, { periodo: 1.0, velocidad: 0 }),
    escena: { arco: -8 },
  },
  {
    id: 'def_sprint_repliegue', cat: 'mov', nombre: 'Sprint de repliegue ("white water")', dur: 1.6, loop: true, legal: 'legal',
    desc: 'Repliegue a máxima velocidad tras perder la pelota: brazada más rápida, patada potente ("agua blanca") y cabeza que solo se levanta para ubicar la pelota. Todos vuelven "crashing back" cerrando el centro.',
    claves: [
      'Cerrar primero el CENTRO de la piscina y forzar el contraataque hacia afuera ("inside out").',
      'Cadencia alta, codo alto, patada fuerte.',
      'La cabeza gira para ubicar pelota y rival cada 2–3 brazadas.',
    ],
    juego: 'Repliegue con stamina alta (S.azul tras pérdida). Velocidad la aplica el juego.',
    fuentes: [F.contra, F.guy],
    pose: (t) => ({ ...crolCabezaAlta(t, { periodo: 0.8, velocidad: 0, pitch: 76, kick: 0.32, y: -0.1 }), cuello: { flex: -55, giro: 25 * Math.sin(TAU * t / 1.6) } }),
    escena: { arco: -8 },
  },
  {
    id: 'def_giro_vertical', cat: 'mov', nombre: 'Frenar y encarar (de nado a vertical)', dur: 1.5, loop: false, legal: 'legal',
    desc: 'Llega nadando de espaldas al juego, frena con una patada de pecho (whip), se sienta sobre las piernas y gira 180° con eggbeater para quedar de frente al atacante, ya en posición base.',
    claves: [
      'Frenar sentándose (caderas abajo, piernas adelante) y no seguir de largo.',
      'Girar con eggbeater + remada de los brazos hacia el lado del giro.',
      'Terminar de frente a la pelota/atacante, entre el atacante y el arco.',
    ],
    juego: 'Fin del repliegue: transición crawl → defensa. Encadenar con def_base_eggbeater o def_press.',
    fuentes: [F.contra, F.ind],
    pose: secuencia([
      [0, (t) => ({ ...crolCabezaAlta(t, { velocidad: 0 }), cuerpo: { pitch: 70, giro: 180 }, raiz: { y: -0.12, z: 0.4 } })],
      [0.35, (t) => ({ ...baseVertical(t, { y: -0.4, pitch: -20 }), ...patadaWhip(t), cuerpo: { pitch: -20, giro: 180 }, raiz: { y: -0.42, z: 0.1 } })],
      [0.85, (t) => ({ ...baseVertical(t, { y: -0.42, pitch: 0 }), cuerpo: { pitch: 0, giro: 90, lat: 8 }, cuello: { giro: -50 }, raiz: { y: -0.42, z: 0 } })],
      [1.3, (t) => ({ ...baseVertical(t), raiz: { y: -0.42, z: 0 } })],
      [1.5, (t) => ({ ...baseVertical(t), raiz: { y: -0.42, z: 0 } })],
    ]),
    escena: { arco: -4, atacante: { pose: ataVertical, pos: [0, 2.0], giro: 180 } },
  },
  {
    id: 'def_drop_hoyo', cat: 'mov', nombre: 'Drop / ayuda al hoyo (sloughing)', dur: 2.0, loop: false, legal: 'legal',
    desc: 'El defensor de un perímetro suelta a su atacante y retrocede hacia el 2 m para ayudar contra el boya ("drop"/"slough"): se recuesta y retrocede con eggbeater mirando la pelota, y termina con la mano arriba frente al pase al hoyo.',
    claves: [
      'Retroceder sin dar la espalda a la pelota (eggbeater hacia atrás, no nadar de espaldas).',
      'Terminar en la línea de pase hacia el boya con la mano arriba: buscar el robo o el desvío.',
      'Comunicar ("¡ayuda!") y estar listo para volver a su hombre (def_recuperar_marca).',
    ],
    juego: 'Defensa "Zona 2 (4-5 Drop)" del menú: los defensores 4 y 5 hacen este drop.',
    fuentes: [F.tact2, F.wpuDef, F.seis5],
    pose: secuencia([
      [0, (t) => ({ ...basePresion(t, { pitch: 40, y: -0.22 }), ...sculling(t) })],
      [0.5, (t) => ({ ...baseVertical(t, { y: -0.4, pitch: -18 }), ...eggbeater(t, { avanceZ: -1 }), raiz: { y: -0.4, z: -0.4 } })],
      [1.5, (t) => ({ ...baseVertical(t, { y: -0.35, pitch: -10 }), ...eggbeater(t, { avanceZ: -1 }), brazoD: brazoArriba('D', { incl: 0.25 }), raiz: { y: -0.32, z: -1.7 } })],
      [2.0, (t) => ({ ...baseVertical(t, { y: -0.32, pitch: 5, scull: false }), ...scullI(t), brazoD: brazoArriba('D', { incl: 0.25 }), raiz: { y: -0.3, z: -1.8 } })],
    ]),
    escena: { arco: -5.5, atacante: { pose: ataVertical, pos: [0, 0.9], giro: 180 }, pelota: { tipo: 'fija', pos: [-3, 0.35, 4] } },
    camara: 'tribuna',
  },
  {
    id: 'def_recuperar_marca', cat: 'mov', nombre: 'Recuperar la marca tras ayudar', dur: 1.8, loop: false, legal: 'legal',
    desc: 'Después del drop, la pelota vuelve al perímetro: el defensor sale disparado hacia su atacante con 2–3 brazadas de cabeza alta y llega frenando en posición de presión (o de bloqueo si el atacante ya tiene la pelota).',
    claves: [
      'Salir cuando la pelota está en el aire hacia el perímetro.',
      'Llegar "cerrando" con el brazo arriba para no regalar el tiro.',
      'Frenar con las piernas adelante para no pasarse.',
    ],
    juego: 'Vuelta de la ayuda (closeout).',
    fuentes: [F.tact2, F.wpuDef],
    pose: secuencia([
      [0, (t) => ({ ...baseVertical(t, { y: -0.32, pitch: 5 }), brazoD: brazoArriba('D', { incl: 0.25 }), raiz: { y: -0.32, z: -1.6 } })],
      [0.35, (t) => ({ ...crolCabezaAlta(t, { velocidad: 0, pitch: 62 }), raiz: { y: -0.15, z: -1.2 } })],
      [1.2, (t) => ({ ...crolCabezaAlta(t, { velocidad: 0, pitch: 62 }), raiz: { y: -0.15, z: -0.2 } }), (x) => x],
      [1.8, (t) => ({ ...trípode(t, { y: -0.3, lado: 'I' }), brazoI: brazoArriba('I', { incl: 0.3 }), raiz: { y: -0.28, z: 0 } })],
    ]),
    escena: { arco: -5.5, atacante: { pose: ataArmado, pos: [0, 1.0], giro: 180 }, pelota: { tipo: 'mano', quien: 'ata', hueso: 'RightHand' } },
    camara: 'tribuna',
  },
  {
    id: 'def_switch', cat: 'mov', nombre: 'Cambio de marca (switch)', dur: 2.2, loop: false, legal: 'legal',
    desc: 'Ante un cruce o una cortina, dos defensores intercambian a quién marcan. El defensor avisa ("¡cambio!") señalando con el brazo, se desliza lateralmente al nuevo atacante y toma la posición de presión.',
    claves: [
      'Comunicación antes del contacto: el aviso evita que ambos sigan al mismo.',
      'Deslizarse con eggbeater lateral sin perder la línea atacante–arco.',
      'Llegar con la mano del lado pelota arriba.',
    ],
    juego: 'IA: cuando dos atacantes se cruzan (cambiar defensorMasCercano sin nadar detrás).',
    fuentes: [F.wpuDef, F.glos],
    pose: secuencia([
      [0, (t) => baseVertical(t)],
      [0.35, (t) => ({ ...baseVertical(t), brazoI: { marco: 'mundo', sup: nv(0.9, 0.35, 0.3), inf: nv(0.95, 0.3, 0.2), palma: [0, 0, 1] }, cuello: { giro: 35 } })],
      [0.8, (t) => ({ ...baseVertical(t), brazoI: { marco: 'mundo', sup: nv(0.9, 0.35, 0.3), inf: nv(0.95, 0.3, 0.2), palma: [0, 0, 1] }, cuello: { giro: 35 } })],
      [1.7, (t) => ({ ...baseVertical(t), ...eggbeater(t, { avanceX: -1 }), cuerpo: { pitch: 12, lat: 10 }, raiz: { y: -0.4, x: -1.1 } })],
      [2.2, (t) => ({ ...basePresion(t, { pitch: 40, y: -0.22 }), brazoD: brazoArriba('D', { incl: 0.3 }), ...scullI(t), raiz: { y: -0.22, x: -1.2 } })],
    ]),
    escena: { arco: -5, atacante: { pose: ataVertical, pos: [-1.2, 1.0], giro: 180 } },
    camara: 'frente',
  },

  // ============================================ C · BLOQUEO DE TIRO ==========================================
  {
    id: 'def_bloqueo_alto', cat: 'bloqueo', nombre: 'Bloqueo alto (un brazo)', dur: 1.7, loop: false, legal: 'legal',
    desc: 'Bloqueo clásico: desde el trípode, eggbeater explosivo para salir del agua (hasta la cintura) y brazo de bloqueo totalmente vertical, codo bloqueado, mano abierta con la palma al tirador. El otro brazo rema fuerte para sostener la altura.',
    claves: [
      'Anticipar, cerrar el ángulo y ELEVARSE: el bloqueo se gana con las piernas, no con el brazo.',
      'Brazo vertical al lado de la cabeza, codo firme, dedos abiertos; no "manotear".',
      'Tapar el lado del brazo de tiro; el arquero cubre el otro lado.',
      'UN solo brazo: dos manos = falta grave (penal/exclusión).',
    ],
    juego: 'Reacción del defensor cuando la IA/tirador dispara (S.tiroIA). raiz.y = elevación del bloqueo.',
    fuentes: [F.wpuBloq, F.terry, F.youth, F.biwpa],
    pose: secuencia([
      [0, (t) => ({ ...trípode(t, { y: -0.3 }), brazoI: manoLista('I') })],
      [0.3, (t) => ({ ...trípode(t, { y: -0.3 }), brazoI: manoLista('I') })],
      [0.5, (t) => bloqueoArriba(t, { y: -0.08 }), rapido],
      [0.95, (t) => bloqueoArriba(t, { y: -0.1 })],
      [1.7, (t) => ({ ...trípode(t, { y: -0.32 }), brazoI: manoLista('I') }), suave],
    ]),
    escena: tiradorEnfrente(2.4, {
      atacante: { pose: ataDisparo(0.48), pos: [0, 2.4], giro: 180 },
      pelota: { tipo: 'mano', quien: 'ata', hueso: 'RightHand', hasta: 0.46, luego: [[0.46, 'ata:RightHand@0.46'], [0.58, 'def:LeftHand@0.58'], [0.95, [0.6, 0.6, 1.2]], [1.5, [0.9, 0.05, 2.0]]] },
    }),
  },
  {
    id: 'def_bloqueo_lunge', cat: 'bloqueo', nombre: 'Bloqueo con estirada (lunge)', dur: 1.5, loop: false, legal: 'legal',
    desc: 'Cuando el tirador está a 1,5–2 m, el defensor se lanza hacia adelante y arriba: la pierna de atrás empuja, el tronco se inclina hacia el tirador y el brazo va arriba-adelante para tapar el tiro cerca de la pelota.',
    claves: [
      'La pierna de atrás cierra la distancia (potencia horizontal), la de adelante eleva.',
      'Brazo arriba y ADELANTE, cerca de la salida de la pelota.',
      'No caer sobre el tirador (contacto con el brazo de tiro = falta).',
    ],
    juego: 'Bloqueo cuando el tirador está cerca. Mueve raiz.z hacia adelante.',
    fuentes: [F.wpuBloq, F.terry],
    pose: secuencia([
      [0, (t) => ({ ...trípode(t, { y: -0.3 }), brazoI: manoLista('I') })],
      [0.3, (t) => ({ ...trípode(t, { y: -0.3 }), brazoI: manoLista('I') })],
      [0.55, (t) => ({ ...bloqueoArriba(t, { y: 0.0, incl: 0.5, pitch: 26 }), raiz: { y: 0.0, z: 0.45 } }), rapido],
      [0.9, (t) => ({ ...bloqueoArriba(t, { y: -0.04, incl: 0.45, pitch: 24 }), raiz: { y: -0.04, z: 0.5 } })],
      [1.5, (t) => ({ ...trípode(t, { y: -0.32 }), brazoI: manoLista('I'), raiz: { y: -0.32, z: 0.45 } })],
    ]),
    escena: tiradorEnfrente(1.8, {
      atacante: { pose: ataDisparo(0.52), pos: [0, 1.8], giro: 180 },
      pelota: { tipo: 'mano', quien: 'ata', hueso: 'RightHand', hasta: 0.5, luego: [[0.5, 'ata:RightHand@0.5'], [0.58, 'def:LeftHand@0.58'], [1.0, [0.8, 0.4, 1.6]], [1.5, [1.0, 0.05, 2.2]]] },
    }),
  },
  {
    id: 'def_bloqueo_seguir', cat: 'bloqueo', nombre: 'Seguir el brazo del tirador', dur: 3.0, loop: true, legal: 'legal',
    desc: 'El tirador mueve la pelota de un lado a otro buscando ángulo; el defensor mantiene el brazo arriba y lo "sigue" moviendo brazo, hombros y cadera sin bajar la altura, siempre tapando el lado del brazo de tiro.',
    claves: [
      'El brazo no baja: se desplaza con el hombro y la cadera.',
      'Eggbeater en split constante para no perder altura.',
      'Mirar la pelota, no la cara del tirador (los amagues engañan la mirada).',
    ],
    juego: 'Loop mientras un tirador arma/amaga frente al defensor.',
    fuentes: [F.wpuBloq, F.youth],
    pose: (t) => {
      const s = Math.sin(TAU * t / 3.0);
      return { ...bloqueoArriba(t, { y: -0.14, abre: 0.1 + 0.25 * s, incl: 0.2 }), cuerpo: { pitch: 14, giro: -14 * s }, raiz: { y: -0.14 + rebote(t, 0.6), x: 0.15 * s } };
    },
    escena: { arco: -4.5, atacante: { pose: (t) => ({ ...ataArmado(t), cuerpo: { pitch: 4, giro: 18 * Math.sin(TAU * t / 3.0) } }), pos: [0, 2.0], giro: 180 }, pelota: { tipo: 'mano', quien: 'ata', hueso: 'RightHand' } },
  },
  {
    id: 'def_bloqueo_bajo_lateral', cat: 'bloqueo', nombre: 'Bloqueo bajo lateral (tiro de bote)', dur: 1.5, loop: false, legal: 'legal',
    desc: 'Contra el tiro de bote/"skip" (la pelota pica en el agua antes del arco), el brazo de bloqueo baja de costado a ras del agua con la palma hacia afuera y el tronco se inclina hacia ese lado, sin perder la altura con las piernas.',
    claves: [
      'Leer la caída del brazo del tirador (brazo más bajo/lateral = bote).',
      'Brazo extendido al costado, a ras de la superficie, palma hacia la pelota.',
      'Inclinar el tronco, no hundirse.',
    ],
    juego: 'Variante del bloqueo cuando el tiro de la IA es "tiroagua".',
    fuentes: [F.wpuBloq, F.glos],
    pose: secuencia([
      [0, (t) => ({ ...trípode(t, { y: -0.3 }), brazoI: manoLista('I') })],
      [0.3, (t) => ({ ...trípode(t, { y: -0.3 }), brazoI: manoLista('I') })],
      [0.55, (t) => ({ ...trípode(t, { y: -0.24, pitch: 10 }), cuerpo: { pitch: 10, lat: -24 }, columna: { lat: -10 },
        brazoI: { marco: 'mundo', sup: nv(0.95, -0.12, 0.2), inf: nv(0.95, -0.2, 0.25), palma: [0, 0, 1], prono: 70, fin: nv(0.9, -0.1, 0.4) }, hombroI: { elev: -5 } }), rapido],
      [0.95, (t) => ({ ...trípode(t, { y: -0.26, pitch: 10 }), cuerpo: { pitch: 10, lat: -22 }, columna: { lat: -10 },
        brazoI: { marco: 'mundo', sup: nv(0.95, -0.12, 0.2), inf: nv(0.95, -0.2, 0.25), palma: [0, 0, 1], prono: 70, fin: nv(0.9, -0.1, 0.4) } })],
      [1.5, (t) => ({ ...trípode(t, { y: -0.32 }), brazoI: manoLista('I') })],
    ]),
    escena: tiradorEnfrente(2.4, {
      atacante: { pose: ataDisparo(0.48), pos: [0, 2.4], giro: 180 },
      pelota: { tipo: 'mano', quien: 'ata', hueso: 'RightHand', hasta: 0.46, luego: [[0.46, 'ata:RightHand@0.46'], [0.54, [0.7, 0.02, 0.9]], [0.6, 'def:LeftHand@0.6'], [1.0, [1.4, 0.3, 1.2]], [1.5, [1.8, 0.05, 1.6]]] },
    }),
  },
  {
    id: 'def_bloqueo_vaselina', cat: 'bloqueo', nombre: 'Bloqueo contra vaselina (lob)', dur: 1.6, loop: false, legal: 'legal',
    desc: 'Contra el tiro bombeado (lob) que pasa por encima, el defensor sube y lleva el brazo arriba y ATRÁS, girando la cabeza para seguir la pelota; la extensión del hombro y la elevación son lo que cuenta.',
    claves: [
      'Elevación máxima: el lob se tapa con altura, no con el brazo solo.',
      'Brazo arriba-atrás por encima de la cabeza, sin perder el equilibrio hacia atrás.',
      'Seguir la pelota con la mirada.',
    ],
    juego: 'Reacción a la vaselina/bombeado (pase largo o tiro alto de la IA).',
    fuentes: [F.wpuBloq, F.glos],
    pose: secuencia([
      [0, (t) => ({ ...trípode(t, { y: -0.3 }), brazoI: manoLista('I') })],
      [0.35, (t) => ({ ...trípode(t, { y: -0.3 }), brazoI: manoLista('I') })],
      [0.7, (t) => ({ ...bloqueoArriba(t, { y: -0.08, incl: -0.35, pitch: -10 }), cuello: { flex: 30 }, columna: { flex: -12, lat: -6 } }), rapido],
      [1.0, (t) => ({ ...bloqueoArriba(t, { y: -0.12, incl: -0.4, pitch: -12 }), cuello: { flex: 40, giro: 15 }, columna: { flex: -12 } })],
      [1.6, (t) => ({ ...trípode(t, { y: -0.34 }), brazoI: manoLista('I'), cuello: { flex: 20, giro: 20 } })],
    ]),
    escena: tiradorEnfrente(3.0, {
      atacante: { pose: ataDisparo(0.5), pos: [0, 3.0], giro: 180 },
      pelota: { tipo: 'mano', quien: 'ata', hueso: 'RightHand', hasta: 0.48, luego: [[0.48, 'ata:RightHand@0.48'], [0.85, [0.25, 2.1, 0.4]], [1.2, [0.2, 1.6, -1.5]], [1.6, [0.1, 0.6, -3.6]]] },
    }),
    camara: 'tribuna',
  },

  // ============================================ D · DEFENSA DEL BOYA ==========================================
  {
    id: 'def_front_boya', cat: 'boya', nombre: 'Front (adelante del boya)', dur: 3.0, loop: true, legal: 'legal',
    desc: 'El defensor juega DELANTE del boya, entre él y la pelota: horizontal, con las piernas y la espalda hacia el boya, mirando al perímetro con un brazo arriba en la línea de pase. Obliga a pases forzados y genera intercepciones; exige que el resto del equipo presione.',
    claves: [
      'Horizontal y alto en el agua; las piernas "sienten" dónde está el boya.',
      'Brazo arriba en la línea de pase; el otro rema para sostener la posición.',
      'Si el boya se abre a 4–5 m, pasar a defenderlo por detrás y mantenerlo lejos.',
      'No nadar sobre los hombros/espalda del boya (impedir el movimiento sin pelota = exclusión).',
    ],
    juego: 'Defensor del 2 m cuando el equipo presiona (no drop).',
    fuentes: [F.centro, F.tact2, F.hole, F.kap7],
    pose: (t) => ({
      ...basePresion(t, { pitch: 68, y: -0.14 }),
      ...patadaCrol(t, { periodo: 0.5, amp: 0.7 }),
      columna: { flex: -12 }, cuello: { flex: -58 },
      brazoD: { marco: 'mundo', sup: nv(-0.32, 0.85, 0.42), inf: nv(-0.25, 0.9, 0.45), palma: [0, 0, 1] },
      ...scullI(t, { ancho: 1.2 }),
    }),
    escena: { arco: -3.2, atacante: { pose: ataBoya, pos: [0.05, -1.05], giro: 0 }, pelota: { tipo: 'fija', pos: [-1.5, 0.35, 5.5] } },
    camara: 'tribuna',
  },
  {
    id: 'def_tres_cuartos_boya', cat: 'boya', nombre: 'Tres cuartos (3/4) al boya', dur: 3.0, loop: true, legal: 'legal',
    desc: 'El defensor se ubica de costado al boya, del lado de la pelota: cuerpo en diagonal, la mano de adentro marca al boya (sin sujetarlo) y la de afuera bloquea la línea de pase. Mezcla de front y de behind.',
    claves: [
      'Cadera lejos del boya y cuerpo en diagonal: puede ir adelante o atrás según el pase.',
      'Mano interior controla (antebrazo/muñeca), la exterior tapa el pase.',
      'Cambiar de lado cuando la pelota cambia de lado.',
    ],
    juego: 'Defensa del 2 m con la pelota en el ala.',
    fuentes: [F.centro, F.tact1, F.kap7],
    pose: (t) => ({
      ...basePresion(t, { pitch: 40, y: -0.22 }),
      cuerpo: { pitch: 40, giro: -30 }, columna: { giro: -10 }, cuello: { flex: -30, giro: -25 },
      brazoI: { marco: 'mundo', sup: nv(0.8, 0.1, -0.45), inf: nv(0.7, -0.35, -0.6), fin: nv(0.6, -0.6, -0.5) },   // antebrazo/muñeca sobre el hombro del boya
      brazoD: { marco: 'mundo', sup: nv(-0.45, 0.8, 0.35), inf: nv(-0.4, 0.85, 0.38), palma: [0, 0, 1] },
    }),
    escena: { arco: -3.2, atacante: { pose: ataBoya, pos: [0.65, -0.55], giro: 0 }, pelota: { tipo: 'fija', pos: [-4, 0.35, 3.5] } },
    camara: 'tribuna',
  },
  {
    id: 'def_detras_boya', cat: 'boya', nombre: 'Behind (detrás del boya)', dur: 3.0, loop: true, legal: 'legal',
    desc: 'Defensa clásica del boya por detrás: el defensor queda entre el boya y el arco, vertical y alto, con el antebrazo/muñeca controlando el hombro del boya y la mano trasera libre y abierta, lista para tapar el giro.',
    claves: [
      'Controlar con antebrazo o muñeca sobre el hombro; agarrar solo si es para evitar un gol (y asumir la exclusión).',
      'Mano trasera libre: va arriba en cuanto el boya recibe.',
      'Mantener al boya lejos del arco (empujarlo a 4–5 m) con piernas fuertes.',
    ],
    juego: 'Defensor del boya en defensa "drop/zona".',
    fuentes: [F.centro, F.tact2, F.kap7],
    pose: (t) => ({
      ...baseVertical(t, { y: -0.32, pitch: 14, periodo: 0.75, potencia: 1.15, scull: false }),
      brazoI: brazoHacia('I', [0.25, 0.05, 1], { codo: 0.3, marco: 'mundo', palma: [0, -1, 0] }),
      brazoD: { marco: 'mundo', sup: nv(-0.7, 0.35, 0.45), inf: nv(-0.25, 0.95, 0.2), palma: [0, 0, 1] },
      columna: { flex: 6 },
    }),
    escena: { arco: -2.2, atacante: { pose: ataBoya, pos: [0, 0.72], giro: 0 }, pelota: { tipo: 'fija', pos: [1.5, 0.35, 6] } },
  },
  {
    id: 'def_lucha_posicion', cat: 'boya', nombre: 'Lucha por la posición (antes del pase)', dur: 3.0, loop: true, legal: 'tactica',
    desc: 'Antes de que llegue la pelota al boya hay una lucha de cuerpos: el defensor empuja con el antebrazo y la cadera para sacarlo de la posición de tiro, alternando los brazos y sin sujetar, hundir ni tirar hacia atrás (eso es exclusión).',
    claves: [
      'Contacto con antebrazo/cadera, no con las manos cerradas.',
      'Alternar los brazos y mover la cadera para "sentir" al boya.',
      'Zona gris: los árbitros pitan exclusión si se sujeta, hunde o tira atrás a un jugador SIN pelota.',
    ],
    juego: 'Loop del defensor del boya mientras la pelota circula en el perímetro.',
    notas: 'La línea entre lucha legal y exclusión la marca el árbitro; en el juego conviene ligarla a una probabilidad de falta.',
    fuentes: [F.centro, F.reglas, F.awp],
    pose: (t) => {
      const s = Math.sin(TAU * t / 1.5);
      return {
        ...baseVertical(t, { y: -0.34, pitch: 18, potencia: 1.2, scull: false }),
        cuerpo: { pitch: 18, giro: 12 * s },
        brazoI: brazoHacia('I', [0.15 + 0.15 * s, -0.05, 1], { codo: 0.35 + 0.15 * s, marco: 'mundo' }),
        brazoD: brazoHacia('D', [-0.15 + 0.15 * s, -0.05, 1], { codo: 0.35 - 0.15 * s, marco: 'mundo' }),
        raiz: { y: -0.34 + rebote(t, 0.75), x: 0.08 * s },
      };
    },
    escena: { arco: -2.2, atacante: { pose: (t) => ({ ...ataBoya(t), cuerpo: { pitch: -12, giro: -10 * Math.sin(TAU * t / 1.5) } }), pos: [0, 0.7], giro: 0 } },
  },
  {
    id: 'def_giro_boya_mano_arriba', cat: 'boya', nombre: 'El boya recibe y gira: mano arriba', dur: 1.9, loop: false, legal: 'legal',
    desc: 'La pelota entra al boya; él intenta girar hacia su derecha para tirar. El defensor se mueve hacia el lado del giro y sube la mano trasera para tapar el tiro de giro (o hace falta ordinaria para cortar, ver siguiente).',
    claves: [
      'Leer hacia qué lado gira (normalmente al lado de su brazo hábil).',
      'Mano arriba del lado del giro, elevándose con eggbeater.',
      'No sujetar el brazo de tiro (si se agarra y se impide un gol claro → penal).',
    ],
    juego: 'Reacción del defensor del boya cuando la IA hace iaBoyaPosting/giro.',
    fuentes: [F.centro, F.so5m, F.kap7],
    pose: secuencia([
      [0, (t) => ({ ...baseVertical(t, { y: -0.32, pitch: 14, scull: false }), brazoI: brazoHacia('I', [0.25, 0.05, 1], { codo: 0.3, marco: 'mundo' }), ...scullD(t) })],
      [0.55, (t) => ({ ...baseVertical(t, { y: -0.32, pitch: 14, scull: false }), brazoI: brazoHacia('I', [0.25, 0.05, 1], { codo: 0.3, marco: 'mundo' }), ...scullD(t) })],
      [0.9, (t) => ({ ...baseVertical(t, { y: -0.16, pitch: 8, potencia: 1.3, scull: false }), cuerpo: { pitch: 8, giro: -25 }, brazoD: brazoArriba('D', { incl: 0.3, abre: 0.2 }), ...scullI(t, { periodo: 0.45 }), raiz: { y: -0.16, x: -0.35 } }), rapido],
      [1.4, (t) => ({ ...baseVertical(t, { y: -0.18, pitch: 8, potencia: 1.3, scull: false }), cuerpo: { pitch: 8, giro: -30 }, brazoD: brazoArriba('D', { incl: 0.3, abre: 0.2 }), ...scullI(t, { periodo: 0.45 }), raiz: { y: -0.18, x: -0.4 } })],
      [1.9, (t) => ({ ...baseVertical(t, { y: -0.3, pitch: 10, scull: false }), cuerpo: { pitch: 10, giro: -25 }, brazoD: brazoArriba('D', { incl: 0.3, abre: 0.2 }), ...scullI(t), raiz: { y: -0.3, x: -0.4 } })],
    ]),
    escena: {
      arco: -2.2,
      atacante: { pose: secuencia([[0, ataBoya], [0.6, ataBoya], [1.3, (t) => ({ ...ataBoya(t), cuerpo: { pitch: -5, giro: -80 }, brazoD: brazoArmado, raiz: { y: -0.3 } })]]), pos: [0, 0.72], giro: 0 },
      pelota: { tipo: 'ruta', puntos: [[0, [-2.5, 1.2, 5.5]], [0.55, 'ata:RightHand@0.55']], despues: { quien: 'ata', hueso: 'RightHand', desde: 0.55 } },
    },
  },
  {
    id: 'def_falta_ordinaria_corte', cat: 'boya', nombre: 'Falta ordinaria para cortar (y soltar)', dur: 1.8, loop: false, legal: 'tactica',
    desc: 'El boya ya tiene la pelota: el defensor le hace una falta ordinaria (presiona el brazo/hombro del que TIENE la pelota) para cortar el giro y convertirlo en pasador; enseguida SUELTA y levanta las manos para no interferir el tiro libre (interferir = exclusión).',
    claves: [
      'Contacto con el jugador que TIENE la pelota: se permite; si impide la jugada es falta ordinaria (tiro libre).',
      'Soltar de inmediato y mostrar las manos: interferir con el tiro libre es exclusión.',
      'Dentro de los 6 m un tiro libre por falta puede ir directo al arco desde afuera de 6 m — preferir cortar lejos.',
    ],
    juego: 'faltaDefensa / otorgarFaltaOrdinaria: animación de la falta + soltar.',
    notas: 'Verificar en el reglamento vigente de World Aquatics las distancias exactas (5 m / 6 m) para tiro directo y penal.',
    fuentes: [F.reglas, F.reg2025, F.awp, F.tact2],
    pose: secuencia([
      [0, (t) => ({ ...baseVertical(t, { y: -0.32, pitch: 14 }), brazoI: brazoHacia('I', [0.25, 0.05, 1], { codo: 0.3, marco: 'mundo' }) })],
      [0.35, (t) => ({ ...baseVertical(t, { y: -0.3, pitch: 14 }), brazoI: brazoHacia('I', [0.25, 0.05, 1], { codo: 0.3, marco: 'mundo' }) })],
      [0.6, (t) => ({ ...baseVertical(t, { y: -0.18, pitch: 26, potencia: 1.3, scull: false }), brazoD: brazoHacia('D', [-0.25, -0.15, 1], { codo: 0.1, marco: 'mundo' }), brazoI: brazoHacia('I', [0.2, -0.1, 1], { codo: 0.1, marco: 'mundo' }), raiz: { y: -0.18, z: 0.15 } }), rapido],
      [0.95, (t) => ({ ...baseVertical(t, { y: -0.2, pitch: 24, scull: false }), brazoD: brazoHacia('D', [-0.25, -0.25, 1], { codo: 0.1, marco: 'mundo' }), brazoI: brazoHacia('I', [0.2, -0.2, 1], { codo: 0.1, marco: 'mundo' }), raiz: { y: -0.2, z: 0.15 } })],
      [1.3, (t) => ({ ...baseVertical(t, { y: -0.3, pitch: -5, scull: false }), brazoI: brazoArriba('I', { abre: 0.35, incl: -0.05 }), brazoD: brazoArriba('D', { abre: 0.35, incl: -0.05 }), raiz: { y: -0.3, z: -0.15 } }), rapido],
      [1.8, (t) => ({ ...baseVertical(t, { y: -0.38, pitch: -5, scull: false }), brazoI: brazoArriba('I', { abre: 0.35, incl: -0.05 }), brazoD: brazoArriba('D', { abre: 0.35, incl: -0.05 }), raiz: { y: -0.38, z: -0.3 } })],
    ]),
    escena: {
      arco: -2.2,
      atacante: { pose: secuencia([[0, (t) => ({ ...ataBoya(t), brazoD: brazoArmado })], [0.6, (t) => ({ ...ataBoya(t), brazoD: brazoArmado })], [0.95, (t) => ({ ...ataBoya(t), cuerpo: { pitch: 10 }, brazoD: { ...brazoArmado, sup: nv(-0.5, 0.2, 0.3) }, raiz: { y: -0.5 } })], [1.8, (t) => ({ ...ataBoya(t), brazoD: brazoArmado })]]), pos: [0, 0.72], giro: 0 },
      pelota: { tipo: 'mano', quien: 'ata', hueso: 'RightHand' },
    },
  },

  // ============================================ E · ROBO E INTERCEPCIÓN =========================================
  {
    id: 'def_robo_pop', cat: 'robo', nombre: 'Robo "pop" desde atrás', dur: 1.5, loop: false, legal: 'legal',
    desc: 'Desde atrás del atacante que tiene la pelota en el agua: el defensor se corre un poco al costado, pasa la mano por debajo del brazo del atacante, la desliza hasta debajo de la pelota y la hace saltar con la punta de los dedos por encima de la cabeza del atacante.',
    claves: [
      'Ir al balón, no al cuerpo: tocar el brazo es falta.',
      'Entrar por debajo de la superficie (no se ve venir) y "flip" con los dedos.',
      'Fuerza suficiente para que la pelota pase por encima del atacante y caiga del lado del defensor.',
    ],
    juego: 'intentarRobo cuando el atacante tiene la pelota en el agua y está de espaldas.',
    fuentes: [F.soRobo, F.tact2],
    pose: secuencia([
      [0, (t) => ({ ...baseVertical(t, { y: -0.4, pitch: 25 }) })],
      [0.4, (t) => ({ ...baseVertical(t, { y: -0.36, pitch: 40 }), cuerpo: { pitch: 40, giro: 15 }, raiz: { y: -0.36, x: -0.2 } })],
      [0.75, (t) => ({ ...basePresion(t, { pitch: 55, y: -0.25 }), cuerpo: { pitch: 55, giro: 10 }, brazoD: { marco: 'mundo', sup: nv(-0.1, -0.35, 1), inf: nv(0.05, -0.15, 1), palma: [0, 1, 0], prono: 80 }, ...scullI(t), raiz: { y: -0.25, x: -0.22, z: 0.3 } })],
      [0.95, (t) => ({ ...basePresion(t, { pitch: 50, y: -0.22 }), cuerpo: { pitch: 50, giro: 10 }, brazoD: { marco: 'mundo', sup: nv(-0.1, 0.1, 1), inf: nv(0.0, 0.6, 0.8), palma: [0, 1, 0], prono: 80, fin: nv(0, 0.9, 0.3) }, ...scullI(t), raiz: { y: -0.22, x: -0.22, z: 0.3 } }), rapido],
      [1.5, (t) => ({ ...baseVertical(t, { y: -0.35, pitch: 20 }), raiz: { y: -0.35, x: -0.15, z: 0.25 } })],
    ]),
    escena: {
      arco: -5, atacante: { pose: ataBalonAgua, pos: [0, 0.75], giro: 0 },
      pelota: { tipo: 'ruta', puntos: [[0, [-0.12, 0.05, 1.55]], [0.85, [-0.12, 0.05, 1.55]], [0.95, [-0.1, 0.3, 1.5]], [1.2, [-0.05, 1.5, 0.9]], [1.5, [0, 0.6, 0.2]]] },
    },
  },
  {
    id: 'def_robo_barrida', cat: 'robo', nombre: 'Robo de barrida (sweep)', dur: 1.6, loop: false, legal: 'legal',
    desc: 'Cuando el atacante sostiene la pelota en la superficie con las caderas abajo y de espaldas: pecho paralelo a su espalda, una mano en su cadera bajo el agua para pasar, y la otra sale del agua y barre la pelota de su mano.',
    claves: [
      'Funciona si el atacante tiene las caderas abajo (lento para reaccionar).',
      'La mano en la cadera es para pasar, no para sujetar.',
      'Barrer de afuera hacia adentro, con la mano saliendo del agua.',
    ],
    juego: 'intentarRobo lateral sobre un atacante que protege la pelota.',
    fuentes: [F.soRobo],
    pose: secuencia([
      [0, (t) => ({ ...baseVertical(t, { y: -0.4, pitch: 25 }) })],
      [0.45, (t) => ({ ...basePresion(t, { pitch: 45, y: -0.25 }), brazoI: brazoHacia('I', [0.1, -0.5, 1], { codo: 0.2, marco: 'mundo' }), ...scullD(t), raiz: { y: -0.25, x: -0.35, z: 0.35 } })],
      [0.8, (t) => ({ ...basePresion(t, { pitch: 45, y: -0.22 }), brazoI: brazoHacia('I', [0.1, -0.5, 1], { codo: 0.2, marco: 'mundo' }), brazoD: { marco: 'mundo', sup: nv(-0.8, 0.35, 0.5), inf: nv(-0.6, 0.1, 0.8), palma: [1, 0, 0] }, raiz: { y: -0.22, x: -0.42, z: 0.55 } })],
      [1.05, (t) => ({ ...basePresion(t, { pitch: 45, y: -0.22 }), brazoI: brazoHacia('I', [0.1, -0.5, 1], { codo: 0.2, marco: 'mundo' }), brazoD: { marco: 'mundo', sup: nv(0.2, -0.1, 1), inf: nv(0.6, -0.2, 0.8), palma: [1, 0, 0] }, raiz: { y: -0.22, x: -0.42, z: 0.6 } }), rapido],
      [1.6, (t) => ({ ...baseVertical(t, { y: -0.36, pitch: 20 }), raiz: { y: -0.36, x: -0.4, z: 0.6 } })],
    ]),
    escena: {
      arco: -5, atacante: { pose: ataBalonAgua, pos: [0, 0.75], giro: 0 },
      pelota: { tipo: 'ruta', puntos: [[0, [-0.12, 0.05, 1.55]], [0.95, [-0.12, 0.05, 1.55]], [1.15, [0.4, 0.08, 1.5]], [1.6, [0.9, 0.05, 1.3]]] },
    },
  },
  {
    id: 'def_intercepcion_estirada', cat: 'robo', nombre: 'Intercepción con estirada', dur: 1.5, loop: false, legal: 'legal',
    desc: 'Desde la presión en la línea de pase, el defensor lee el pase y se estira lateralmente con un eggbeater explosivo para atrapar (o tocar) la pelota en el aire con una mano.',
    claves: [
      'Anticipar: salir cuando el pasador arma, no cuando la pelota ya viene.',
      'Estirada lateral con la pierna de atrás empujando y el brazo extendido.',
      'Atrapar con una mano y proteger la pelota; arrancar el contraataque.',
    ],
    juego: 'Intercepción de la IA en defensa de presión (genera contraataque).',
    fuentes: [F.presTac, F.wpuDef, F.press],
    pose: secuencia([
      [0, (t) => ({ ...basePresion(t, { pitch: 35, y: -0.25 }), ...sculling(t) })],
      [0.3, (t) => ({ ...basePresion(t, { pitch: 35, y: -0.25 }), ...sculling(t) })],
      [0.6, (t) => ({ ...trípode(t, { y: -0.1, pitch: 15, lado: 'D' }), cuerpo: { pitch: 15, lat: 22 }, brazoD: { marco: 'mundo', sup: nv(-0.85, 0.55, 0.1), inf: nv(-0.8, 0.6, 0.15), palma: [0, 0, 1] }, raiz: { y: -0.1, x: -0.45 } }), rapido],
      [1.0, (t) => ({ ...trípode(t, { y: -0.18, pitch: 15, lado: 'D' }), cuerpo: { pitch: 15, lat: 10 }, brazoD: { marco: 'mundo', sup: nv(-0.6, 0.6, 0.3), inf: nv(0.1, 0.95, 0.3), palma: [0, 0, 1] }, raiz: { y: -0.18, x: -0.5 } })],
      [1.5, (t) => ({ ...baseVertical(t, { y: -0.35, scull: false }), brazoD: { marco: 'mundo', sup: nv(-0.3, 0.6, 0.3), inf: nv(0, 1, 0.2), palma: [0, 0, 1] }, ...scullI(t), raiz: { y: -0.35, x: -0.5 } })],
    ]),
    escena: { arco: -5, pelota: { tipo: 'ruta', puntos: [[0, [4, 1.1, 1.2]], [0.6, 'def:RightHand@0.6']], despues: { quien: 'def', hueso: 'RightHand', desde: 0.6 } } },
    camara: 'frente',
  },
  {
    id: 'def_desvio_pase', cat: 'robo', nombre: 'Desvío de pase (tip con los dedos)', dur: 1.2, loop: false, legal: 'legal',
    desc: 'Cuando no llega a atraparla, el defensor sube rápido el brazo de la línea de pase y toca la pelota con la punta de los dedos (muñeca que "golpea" hacia arriba) para desviarla.',
    claves: [
      'Brazo ya arriba en la línea de pase: el desvío es un golpe corto de muñeca.',
      'Un desvío alcanza: genera pelota suelta o pérdida de tiempo de posesión.',
    ],
    juego: 'Variante barata de intercepción: pelota suelta (recuperarSuelta).',
    fuentes: [F.presTac, F.press],
    pose: secuencia([
      [0, (t) => ({ ...basePresion(t, { pitch: 35, y: -0.25 }), brazoD: { marco: 'mundo', sup: nv(-0.3, 0.88, 0.35), inf: nv(-0.25, 0.9, 0.35), palma: [0, 0, 1] }, ...scullI(t) })],
      [0.35, (t) => ({ ...basePresion(t, { pitch: 35, y: -0.25 }), brazoD: { marco: 'mundo', sup: nv(-0.3, 0.88, 0.35), inf: nv(-0.25, 0.9, 0.35), palma: [0, 0, 1] }, ...scullI(t) })],
      [0.5, (t) => ({ ...baseVertical(t, { y: -0.16, pitch: 10, potencia: 1.3, scull: false }), brazoD: { marco: 'mundo', sup: nv(-0.35, 0.92, 0.2), inf: nv(-0.3, 0.92, 0.15), palma: [0, 0, 1], fin: nv(-0.3, 0.6, -0.6) }, ...scullI(t), raiz: { y: -0.16 } }), rapido],
      [1.2, (t) => ({ ...basePresion(t, { pitch: 30, y: -0.28 }), ...sculling(t) })],
    ]),
    escena: { arco: -5, pelota: { tipo: 'ruta', puntos: [[0, [-1.2, 1.0, 6]], [0.5, 'def:RightHand@0.5'], [0.85, [-0.9, 2.0, -0.6]], [1.2, [-1.1, 0.6, -2.4]]] } },
    camara: 'tribuna',
  },

  // ============================================ F · DEFENSA DEL DRIVER =========================================
  {
    id: 'def_driver_inside_water', cat: 'driver', nombre: 'Nadar con el driver (agua de adentro)', dur: 2.0, loop: true, legal: 'legal',
    desc: 'El atacante nada hacia el arco (drive). El defensor nada a su lado, del lado de ADENTRO (entre el driver y el centro del arco), con los brazos en el agua, empujándolo hacia afuera o al lado débil. Solo levanta el brazo cuando el driver se para a tirar.',
    claves: [
      'Ganar el agua de adentro: con ella el driver no tiene tiro ni penal.',
      'Brazos en el agua nadando (no levantar el brazo antes de tiempo, se pierde velocidad).',
      'Darle un lugar adonde ir, pero no el que él quiere (afuera / lado débil).',
    ],
    juego: 'Defensor siguiendo a un atacante que corta (IA ataque drive).',
    fuentes: [F.ind, F.soDef, F.wpuDef],
    pose: (t) => ({ ...crolCabezaAlta(t, { periodo: 1.0, velocidad: 0 }), cuerpo: { pitch: 70, giro: 180, lat: 10 * Math.sin(TAU * t) }, cuello: { flex: -58, giro: -20 } }),
    escena: { arco: -8, atacante: { pose: ataNadador, pos: [0.85, 0.35], giro: 180, sincro: false, dur: 2.0 } },
    camara: 'arriba',
  },
  {
    id: 'def_driver_mano_arriba', cat: 'driver', nombre: 'El driver se para a tirar: mano arriba', dur: 1.6, loop: false, legal: 'legal',
    desc: 'El driver frena y se levanta para tirar: el defensor, que nadaba por dentro, se sienta sobre las piernas y sube el brazo del lado del driver para tapar el tiro, sin perder el agua de adentro.',
    claves: [
      'Pasar de nado a vertical en un solo movimiento (sentarse sobre las piernas).',
      'Brazo arriba del lado del atacante, cuerpo entre él y el centro del arco.',
      'No agarrar el brazo de tiro (si impide un gol probable dentro de los 6 m → penal).',
    ],
    juego: 'Fin del drive (S.tiroIA desde un driver).',
    fuentes: [F.ind, F.wpuBloq],
    pose: secuencia([
      [0, (t) => ({ ...crolCabezaAlta(t, { velocidad: 0 }), cuerpo: { pitch: 70, giro: 180 } })],
      [0.4, (t) => ({ ...crolCabezaAlta(t, { velocidad: 0 }), cuerpo: { pitch: 70, giro: 180 } })],
      [0.8, (t) => ({ ...trípode(t, { y: -0.16, pitch: 10, lado: 'D' }), cuerpo: { pitch: 10, giro: 110 }, brazoD: brazoArriba('D', { incl: 0.2 }), raiz: { y: -0.16 } }), rapido],
      [1.6, (t) => ({ ...trípode(t, { y: -0.22, pitch: 10, lado: 'D' }), cuerpo: { pitch: 10, giro: 110 }, brazoD: brazoArriba('D', { incl: 0.2 }), raiz: { y: -0.22 } })],
    ]),
    escena: { arco: -6, atacante: { pose: secuencia([[0, ataNadador], [0.4, ataNadador], [0.85, ataArmado]]), pos: [0.85, 0.2], giro: 180 }, pelota: { tipo: 'mano', quien: 'ata', hueso: 'RightHand', desde: 0.7 } },
    camara: 'tribuna',
  },

  // ============================================ G · INFERIORIDAD (5 vs 6) =======================================
  {
    id: 'def_zona_m_brazo_arriba', cat: 'zona', nombre: 'Zona en inferioridad: brazo arriba', dur: 3.0, loop: true, legal: 'legal',
    desc: 'En inferioridad (5 vs 6) los defensores forman una zona compacta: alto en el agua, brazo arriba bien abierto para tapar tiros y pases, y el cuerpo girando para seguir la pelota. Los de los palos bloquean los tiros de ala; los de afuera, los tiros de perímetro.',
    claves: [
      'Cada tirador debe tener al menos un brazo arriba + el arquero.',
      'Brazo arriba ABIERTO (más ancho que en el bloqueo 1 vs 1) para cubrir más ángulo.',
      'Girar con la pelota sin bajar el brazo.',
    ],
    juego: 'Defensa en inferioridad tras expulsar() a un jugador del equipo.',
    fuentes: [F.seis5, F.tisca, F.wpuBloq],
    pose: (t) => {
      const s = Math.sin(TAU * t / 3.0);
      return {
        ...baseVertical(t, { y: -0.26, pitch: 8, periodo: 0.6, potencia: 1.25, scull: false }),
        cuerpo: { pitch: 8, giro: 28 * s },
        brazoD: brazoArriba('D', { abre: 0.35, incl: 0.1 }), hombroD: { elev: 15 },
        ...scullI(t, { periodo: 0.5 }),
        raiz: { y: -0.26 + rebote(t, 0.6), x: 0.1 * s },
      };
    },
    escena: { arco: -3 },
    camara: 'frente',
  },
  {
    id: 'def_zona_deslizar', cat: 'zona', nombre: 'Zona: deslizar entre dos tiradores', dur: 2.2, loop: false, legal: 'legal',
    desc: 'La pelota pasa de un tirador a otro: el defensor de zona se desliza lateralmente con eggbeater alto y cambia de brazo arriba (el que queda del lado del nuevo tirador), sin bajar nunca la altura.',
    claves: [
      'Moverse durante el vuelo del pase, no después.',
      'Cambiar de brazo arriba según el lado de la pelota.',
      'Altura constante: el desplazamiento es con las piernas.',
    ],
    juego: 'Rotación de zona cuando la IA pasa en superioridad.',
    fuentes: [F.seis5, F.tisca],
    pose: secuencia([
      [0, (t) => ({ ...baseVertical(t, { y: -0.26, potencia: 1.2, scull: false }), brazoI: brazoArriba('I', { abre: 0.35 }), ...scullD(t), raiz: { y: -0.26, x: 0.6 } })],
      [0.4, (t) => ({ ...baseVertical(t, { y: -0.26, potencia: 1.2, scull: false }), brazoI: brazoArriba('I', { abre: 0.35 }), ...scullD(t), raiz: { y: -0.26, x: 0.6 } })],
      [1.1, (t) => ({ ...baseVertical(t, { y: -0.3, potencia: 1.2 }), ...eggbeater(t, { avanceX: -1 }), cuerpo: { pitch: 10, lat: 10 }, raiz: { y: -0.3, x: -0.1 } })],
      [1.6, (t) => ({ ...baseVertical(t, { y: -0.26, potencia: 1.2, scull: false }), brazoD: brazoArriba('D', { abre: 0.35 }), ...scullI(t), raiz: { y: -0.26, x: -0.6 } })],
      [2.2, (t) => ({ ...baseVertical(t, { y: -0.26, potencia: 1.2, scull: false }), brazoD: brazoArriba('D', { abre: 0.35 }), ...scullI(t), raiz: { y: -0.26, x: -0.6 } })],
    ]),
    escena: { arco: -3, pelota: { tipo: 'ruta', puntos: [[0, [3, 0.9, 4]], [0.4, [3, 0.9, 4]], [1.1, [-1, 1.8, 4.5]], [1.5, [-3, 0.9, 4]]] } },
    camara: 'frente',
  },

  // ============================================ H · FALTAS Y REGLAS ===========================================
  {
    id: 'def_ILEGAL_sujetar_hundir', cat: 'reglas', nombre: 'Sujetar/hundir a un rival SIN pelota', dur: 1.6, loop: false, legal: 'ilegal',
    desc: 'Lo que NO se debe hacer: el defensor agarra por los hombros a un atacante que no tiene la pelota, se sube encima y lo hunde / tira hacia atrás. Es falta de EXCLUSIÓN (20 s fuera). Útil para animar las exclusiones del juego.',
    claves: [
      'Exclusión: sujetar, hundir o tirar hacia atrás a un rival que NO tiene la pelota.',
      'Exclusión: impedir el movimiento de un rival sin pelota (incluye nadar sobre sus hombros, espalda o piernas).',
      'Señal del árbitro: sujetarse la muñeca con la otra mano.',
    ],
    juego: 'Animación de la falta antes de expulsar() (exclusión).',
    fuentes: [F.reglas, F.reg2025, F.awp],
    pose: secuencia([
      [0, (t) => ({ ...baseVertical(t, { y: -0.4, pitch: 20 }) })],
      [0.4, (t) => ({ ...baseVertical(t, { y: -0.3, pitch: 35, scull: false }), brazoI: brazoHacia('I', [0.2, -0.3, 1], { codo: 0.3, marco: 'mundo' }), brazoD: brazoHacia('D', [-0.2, -0.3, 1], { codo: 0.3, marco: 'mundo' }), raiz: { y: -0.3, z: 0.15 } })],
      [0.9, (t) => ({ ...baseVertical(t, { y: -0.12, pitch: 45, potencia: 1.3, scull: false }), brazoI: brazoHacia('I', [0.15, -0.75, 0.65], { codo: 0.25, marco: 'mundo' }), brazoD: brazoHacia('D', [-0.15, -0.75, 0.65], { codo: 0.25, marco: 'mundo' }), raiz: { y: -0.12, z: 0.3 } }), rapido],
      [1.6, (t) => ({ ...baseVertical(t, { y: -0.16, pitch: 40, scull: false }), brazoI: brazoHacia('I', [0.15, -0.8, 0.6], { codo: 0.25, marco: 'mundo' }), brazoD: brazoHacia('D', [-0.15, -0.8, 0.6], { codo: 0.25, marco: 'mundo' }), raiz: { y: -0.16, z: 0.3 } })],
    ]),
    escena: { arco: -4, atacante: { pose: secuencia([[0, ataVertical], [0.6, ataVertical], [1.2, (t) => ({ ...ataVertical(t), cuello: { flex: -30 }, raiz: { y: -0.95 } })]]), pos: [0, 0.75], giro: 0 } },
  },
  {
    id: 'def_ILEGAL_bloqueo_dos_manos', cat: 'reglas', nombre: 'Bloqueo con DOS manos', dur: 1.5, loop: false, legal: 'ilegal',
    desc: 'Bloquear un tiro o un pase con las dos manos arriba es ilegal. Dentro del área de penal se castiga con PENAL; fuera, con exclusión. Por eso el bloqueo correcto siempre es con un solo brazo.',
    claves: [
      'Dos brazos arriba para tapar = falta grave aunque no toque la pelota.',
      'Dentro del área de penal → penal; fuera → exclusión.',
      'Corrección: un brazo arriba + el otro remando (def_bloqueo_alto).',
    ],
    juego: 'Animación de falta → penal() / expulsar() según la zona.',
    notas: 'El área exacta (5 m / 6 m) cambió entre reglamentos: confirmar en el PDF vigente de World Aquatics.',
    fuentes: [F.reglas, F.wpuBloq, F.awp],
    pose: secuencia([
      [0, (t) => ({ ...trípode(t, { y: -0.3 }), brazoI: manoLista('I') })],
      [0.3, (t) => ({ ...trípode(t, { y: -0.3 }), brazoI: manoLista('I') })],
      [0.55, (t) => ({ ...baseVertical(t, { y: -0.12, pitch: 10, potencia: 1.35, scull: false }), brazoI: brazoArriba('I', { abre: 0.3 }), brazoD: brazoArriba('D', { abre: 0.3 }), hombroI: { elev: 15 }, hombroD: { elev: 15 }, raiz: { y: -0.12 } }), rapido],
      [1.0, (t) => ({ ...baseVertical(t, { y: -0.22, pitch: 10, scull: false }), brazoI: brazoArriba('I', { abre: 0.3 }), brazoD: brazoArriba('D', { abre: 0.3 }), raiz: { y: -0.22 } })],
      [1.5, (t) => ({ ...baseVertical(t, { y: -0.45 }), raiz: { y: -0.45 } })],
    ]),
    escena: tiradorEnfrente(2.4, {
      atacante: { pose: ataDisparo(0.5), pos: [0, 2.4], giro: 180 },
      pelota: { tipo: 'mano', quien: 'ata', hueso: 'RightHand', hasta: 0.48, luego: [[0.48, 'ata:RightHand@0.48'], [0.6, 'def:RightHand@0.6'], [1.0, [0.4, 0.5, 1.4]], [1.5, [0.6, 0.05, 2]]] },
    }),
  },
  {
    id: 'def_excluido_salida', cat: 'reglas', nombre: 'Excluido: salir a la zona de reingreso', dur: 2.4, loop: false, legal: 'legal',
    desc: 'Tras la exclusión, el jugador levanta la mano, se aparta del juego sin interferir y nada hacia la zona de reingreso (esquina de su propio arco). Interferir en la salida es otra falta.',
    claves: [
      'Salir sin tocar la pelota ni a los rivales; no estorbar el saque.',
      'Ir a la zona de reingreso de su arco y esperar la señal para volver.',
    ],
    juego: 'Animación al expulsar(): el excluido nada a la esquina (teleportManUp / reintegrarExpulsado).',
    fuentes: [F.reglas, F.reg2025, F.glos],
    pose: secuencia([
      [0, (t) => ({ ...baseVertical(t, { y: -0.4 }) })],
      [0.4, (t) => ({ ...baseVertical(t, { y: -0.36, scull: false }), brazoD: brazoArriba('D', { abre: 0.1 }), ...scullI(t) })],
      [0.9, (t) => ({ ...baseVertical(t, { y: -0.38, scull: false }), cuerpo: { pitch: 0, giro: -120 }, brazoD: brazoArriba('D', { abre: 0.1 }), ...scullI(t) })],
      [1.4, (t) => ({ ...crolCabezaAlta(t, { velocidad: 0, pitch: 60 }), cuerpo: { pitch: 60, giro: -150 }, raiz: { y: -0.15, x: -0.3, z: -0.4 } })],
      [2.4, (t) => ({ ...crolCabezaAlta(t, { velocidad: 0, pitch: 60 }), cuerpo: { pitch: 60, giro: -150 }, raiz: { y: -0.15, x: -0.9, z: -1.5 } }), (x) => x],
    ]),
    escena: { arco: -5 },
    camara: 'tribuna',
  },

  // ============================================ I · REACCIONES =================================================
  {
    id: 'def_reaccion_amague', cat: 'reac', nombre: 'Morder el amague (y recuperar)', dur: 1.5, loop: false, legal: 'legal',
    desc: 'El tirador amaga: el defensor "muerde" y salta a bloquear un tiro que no existe; cae y tiene que recuperar la posición de trípode antes del tiro real. Conecta directo con el banco de amagues del juego (FINTA_FILES): es la reacción de la IA a tu amague.',
    claves: [
      'El buen defensor reacciona a la PELOTA, no al movimiento del brazo.',
      'Si muerde, pierde altura: recupera con eggbeater fuerte y la mano lista.',
      'Ventana de tiro para el atacante: mientras el defensor está cayendo.',
    ],
    juego: 'Reacción de la IA cuando el humano amaga (RS): disparar esta animación con una probabilidad según dificultad.',
    fuentes: [F.wpuBloq, F.youth],
    pose: secuencia([
      [0, (t) => ({ ...trípode(t, { y: -0.3 }), brazoI: manoLista('I') })],
      [0.3, (t) => ({ ...trípode(t, { y: -0.3 }), brazoI: manoLista('I') })],
      [0.5, (t) => bloqueoArriba(t, { y: -0.1 }), rapido],
      [0.85, (t) => ({ ...trípode(t, { y: -0.48, pitch: 22 }), brazoI: brazoArriba('I', { incl: 0.4 }) }), lento],
      [1.5, (t) => ({ ...trípode(t, { y: -0.3 }), brazoI: manoLista('I') })],
    ]),
    escena: tiradorEnfrente(2.2, { atacante: { pose: ataAmague(0.38), pos: [0, 2.2], giro: 180 } }),
  },
];
