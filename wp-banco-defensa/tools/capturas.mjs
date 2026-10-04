// ===== Capturas automáticas del banco (Playwright + Chromium) ==============================================
// Abre el visor, recorre las animaciones y guarda capturas en frames clave (para revisar poses a ojo).
// Uso: (con `npm run dev` corriendo)  node tools/capturas.mjs [url] [id1,id2,...] [camara]
//   PLAYWRIGHT=/ruta/a/playwright/index.mjs CHROME=/ruta/a/chrome  (opcionales)
import { mkdirSync } from 'node:fs';

const pw = await import(process.env.PLAYWRIGHT || 'playwright').catch(() => import('/opt/node22/lib/node_modules/playwright/index.mjs'));
const url = process.argv[2] || 'http://localhost:5180/banco-defensa.html?modelo=maniqui';
const ids = process.argv[3] ? process.argv[3].split(',') : null;
const cam = process.argv[4] || null;
const salida = new URL('../_capturas/', import.meta.url).pathname;
mkdirSync(salida, { recursive: true });

const browser = await pw.chromium.launch({
  executablePath: process.env.CHROME || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errores = [];
page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
page.on('pageerror', (e) => errores.push(String(e)));
await page.goto(url);
await page.waitForFunction(() => window.__banco && window.__banco.listo, null, { timeout: 60000 });
const todos = await page.evaluate(() => window.__banco.ids);
for (const id of ids || todos) {
  const dur = await page.evaluate((id) => { window.__banco.seleccionar(id); return window.__banco.estado(); }, id);
  if (cam) await page.evaluate((c) => window.__banco.camara(c), cam);
  const d = await page.evaluate(() => document.querySelector('#tiempo').max);
  const tiempos = [0.0, 0.33, 0.66, 1.0].map((f) => +(f * d).toFixed(2));
  for (const t of tiempos) {
    await page.evaluate((t) => window.__banco.tiempo(t), t);
    await page.waitForTimeout(60);
    await page.locator('#lienzo').screenshot({ path: `${salida}${id}_${String(t).replace('.', '_')}${cam ? '_' + cam : ''}.png` });
  }
  console.log('ok', id, dur.modelo, tiempos.join(' '));
}
if (errores.length) console.log('ERRORES DE CONSOLA:\n' + [...new Set(errores)].join('\n'));
await browser.close();
