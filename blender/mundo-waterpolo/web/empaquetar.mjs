// Empaqueta el código del visor + three.js en web/visor.bundle.js (para el HTML único 100% offline).
// Uso:  cd web && npm i --no-save three@0.160.0 esbuild@0.21.5 && node empaquetar.mjs
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const aqui = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(aqui, 'visor.html'), 'utf8');
const ini = html.indexOf('<script type="module">') + '<script type="module">'.length;
const codigo = html.slice(ini, html.indexOf('</script>', ini));
const entrada = join(aqui, '.visor-entrada.mjs');
writeFileSync(entrada, codigo);
await build({ entryPoints: [entrada], bundle: true, format: 'esm', minify: true, target: 'es2022',
  outfile: join(aqui, 'visor.bundle.js'), legalComments: 'eof', logLevel: 'info' });
