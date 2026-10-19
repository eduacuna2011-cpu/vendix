// Empaqueta el código del visor + three.js en web/visor.bundle.js (para el HTML único 100% offline).
// Uso:  cd web && npm i --no-save three@0.160.0 esbuild@0.21.5 && node empaquetar.mjs [pagina.html] [salida.js]
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const aqui = dirname(fileURLToPath(import.meta.url));
const [entradaHtml = 'visor.html', salidaJs = 'visor.bundle.js'] = process.argv.slice(2);
const html = readFileSync(join(aqui, entradaHtml), 'utf8');
const ini = html.indexOf('<script type="module">') + '<script type="module">'.length;
const codigo = html.slice(ini, html.indexOf('</script>', ini));
// los import van arriba; el resto se envuelve en una función async (script clásico, sin top-level await)
const lineas = codigo.split('\n');
const imports = lineas.filter((l) => l.startsWith('import ')).join('\n');
const cuerpo = lineas.filter((l) => !l.startsWith('import ')).join('\n');
const entrada = join(aqui, '.visor-entrada.mjs');
writeFileSync(entrada, `${imports}\n(async () => {\n${cuerpo}\n})().catch((e) => { const s = document.getElementById('estado'); if (s) s.textContent = 'Error: ' + (e && e.message || e); });\n`);
await build({ entryPoints: [entrada], bundle: true, format: 'iife', minify: true, target: 'es2019',
  outfile: join(aqui, salidaJs), legalComments: 'eof', logLevel: 'info' });
