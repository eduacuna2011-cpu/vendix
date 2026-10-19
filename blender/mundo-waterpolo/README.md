# Mundo Waterpolo — Blender

Mini mundo realista generado 100% por script (Blender 5.0+):

- **Barrio europeo**: hileras de edificios haussmannianos (sillería, mansarda de zinc con buhardillas,
  balcones corridos de forja), clásicos mediterráneos (estuco de colores, contraventanas, teja) y de
  ladrillo; tiendas con rótulo y toldo, plaza adoquinada con fuente, plátanos de sombra, farolas,
  bancos, quiosco, terrazas, pasos de cebra y aparcamientos.
- **GIMNASIO de alto rendimiento** (edificio independiente, 22 × 22 m, 5,6 m libres), con la
  distribución típica de centros de alto rendimiento: 8 estaciones *rack + plataforma integrada*
  en dos filas enfrentadas (barra olímpica y discos de competición en cada estación, tablet VBT),
  2 racks de mancuernas hexagonales 2,5–50 kg, bancos regulables, soporte de barras, árboles de
  discos, 6 remoergómetros, bicis de aire, SkiErg, poleas, kettlebells de competición, balones
  medicinales, cajas pliométricas, carril de césped con trineos, espalderas, espejos, pizarra con
  el entrenamiento del día, reloj de intervalos LED, mesa del preparador.
- **CENTRO DE WATERPOLO** (sólo instalaciones, sin piscina ni pool deck): recepción con vitrina de
  trofeos, escudo y tornos; pasillo con gorros históricos enmarcados; sala de vídeo/táctica con
  pantalla, pizarra táctica magnética y mesas de análisis; despacho de entrenadores;
  fisioterapia/recuperación (camillas, tinas de agua fría, rodillos); **vestuario LOCAL** y
  **VISITANTE** (taquillas abiertas numeradas con parka, gorro y toalla de cada jugador, banco
  central, duchas, pizarra táctica); enfermería con DEA; **almacén de material** (porterías
  flotantes con red, carros de balones, carretes de corcheras, paneles de gorros blancos / azules /
  rojos de portero, tablas, pull-buoys, relojes de posesión).
- **Parcela libre para tu pool deck**: `x[-28, 28]  y[-86, -50]` (56 × 36 m), a cota `z = 0.16`,
  pegada a las salidas de los vestuarios (puertas en la fachada sur) y del almacén (persiana).
  Una pasarela cubierta une gimnasio y centro.

## Rendimiento

- Todo se agrupa en ~18 objetos (pocos *draw calls*), ~360 k caras en total.
- **Iluminación horneada** (Cycles + denoise OIDN) en lightmaps por grupo (canal UV `Lightmap`).
  El material multiplica *albedo tileable (alta resolución) × lightmap*, como un motor de juego:
  los suelos conservan todo el detalle de la textura y la luz global (sol, cielo, rebotes,
  sombras suaves, oclusión) no cuesta nada en tiempo real.
- En modo horneado EEVEE no necesita luces ni sombras dinámicas (la colección `Luces_Horneado`
  queda oculta). Hay sondas de reflexión por estancia para el cromo y el vidrio.

## Uso

Abrir `mundo_waterpolo.blend` (deja las carpetas `texturas/` y `lightmaps/` al lado).
Las cámaras `CAM_01 … CAM_16` están en la colección `Camaras`.

Regenerar desde cero:

```bash
blender -b -P generar_mundo.py -- --calidad alta            # ~1 h en CPU
blender -b -P generar_mundo.py -- --calidad borrador --render   # prueba rápida + renders
```

| Opción | Efecto |
|---|---|
| `--calidad borrador / media / alta` | resolución y muestras de los lightmaps |
| `--sin-hornear` | sólo geometría y materiales PBR (iluminación dinámica) |
| `--render` | renderiza todas las cámaras en `renders/` (`--solo CAM_05` para una) |

## Ver en el navegador (web/)

`web/` es un visor three.js estático listo para subir a cualquier hosting:

```
web/index.html     visor (orbitar / caminar con WASD o joystick en móvil, 17 vistas, exposición automática)
web/mundo.glb      geometría Draco (~6 MB) con UV de textura + UV de lightmap + color 'Tinte'
web/lm/  web/tex/  lightmaps (JPEG) y texturas tileables
web/mundo.json     materiales, escala de cada lightmap, cámaras, zonas interiores, sol
web/draco/         decodificador Draco (three.js 0.160)
```

Regenerar tras volver a hornear: `blender -b mundo_waterpolo.blend -P exportar_web.py`.
Probar en local: `cd web && python3 -m http.server` y abrir `http://localhost:8000`.

El visor usa `MeshStandardMaterial` con `map` (UV 0, tileable) + `lightMap` (UV 1,
`lightMapIntensity = π × escala`), sin luces dinámicas ni sombras: corre fluido en móvil.

### Cambiar entre horneado y dinámico

Todos los materiales leen el grupo de nodos **`MW_Modo`** (valor `k`):

- `k = 1` → **horneado** (lo que se entrega).
- `k = 0` → PBR completo con luces reales (para volver a hornear tras mover cosas:
  mostrar `Luces_Horneado`, `k = 0`, re-ejecutar el script o hornear *Diffuse* sin *Color*
  sobre el nodo `BAKE_TGT` de cada material).

## Estructura

```
generar_mundo.py     orquestador (grupos, cámaras, horneado, render)
mw/texturas.py       texturas PBR tileables procedurales (numpy/FFT)
mw/materiales.py     catálogo de materiales + conmutador horneado/dinámico
mw/geo.py            constructor de mallas por lotes + UV de lightmap
mw/arq.py            muros con huecos, ventanas, puertas, fachadas
mw/ciudad.py         edificios europeos, calles, plaza y mobiliario
mw/centro.py         envolventes del gimnasio y del centro, entorno, pasarela
mw/gimnasio.py       equipamiento del gimnasio
mw/waterpolo.py      estancias y material del centro de waterpolo
```
