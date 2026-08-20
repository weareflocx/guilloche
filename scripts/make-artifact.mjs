// Genera dist/artifact.html a partir del build single-file de Vite.
//
// El artifact permite guardar presets compartidos: la página se republica
// a sí misma vía la capability `artifact`, que exige entregar el documento
// COMPLETO. Para que la página pueda regenerar su propio HTML sin
// serializar el DOM vivo, se embebe una plantilla de sí misma en base64
// con dos huecos: __PRESETS__ (el JSON de presets compartidos) y
// __TPL64__ (la propia plantilla, construcción tipo quine).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const dist = new URL('../dist/', import.meta.url);
let html = readFileSync(new URL('index.html', dist), 'utf8');

// Presets compartidos que ya viven en el artifact publicado. Republicar
// entrega el documento completo, así que sin esta semilla un despliegue
// desde local borraría los presets que el equipo haya guardado.
//
// IMPORTANTE: antes de republicar, copiar aquí el contenido del bloque
// <script id="shared-presets"> de la versión viva del artifact. No se
// puede automatizar desde el build (requiere sesión de claude.ai).
const seedFile = new URL('../presets.shared.json', import.meta.url);
const seed = existsSync(seedFile) ? readFileSync(seedFile, 'utf8').trim() : '[]';
const seedJson = JSON.stringify(JSON.parse(seed)).replace(/</g, '\\u003c');

// contenido de página sin esqueleto de documento (el visor pone el suyo)
let content = html
  .replace(/<!doctype html>/i, '')
  .replace(/<html[^>]*>/i, '')
  .replace(/<\/html>/i, '')
  .replace(/<head>/i, '')
  .replace(/<\/head>/i, '')
  .replace(/<body>/i, '')
  .replace(/<\/body>/i, '')
  .replace(/<meta[^>]*>/gi, '')
  .replace(/<title>[^<]*<\/title>/i, '<title>Guilloché</title>')
  .trim();

// hueco de presets compartidos (el fuente trae [] de semilla)
content = content.replace(
  /(<script type="application\/json" id="shared-presets">)\[\]/,
  '$1__PRESETS__'
);
if (!content.includes('__PRESETS__')) {
  throw new Error('No se encontró el bloque #shared-presets en el build');
}

// bloque de plantilla, con su propio hueco
content = content.replace(
  '<script type="module"',
  '<script type="text/plain" id="page-tpl">__TPL64__</script>\n<script type="module"'
);

// plantilla de documento completo, la que la página republica de sí misma
const tpl = `<!doctype html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body>
${content}
</body>
</html>
`;

const b64 = Buffer.from(tpl, 'utf8').toString('base64');
// sustituciones ancladas al id del bloque, nunca al token suelto
const artifact = content
  .replace(/(id="shared-presets">)__PRESETS__/, (_, a) => a + seedJson)
  .replace(/(id="page-tpl">)__TPL64__/, (_, a) => a + b64);

writeFileSync(new URL('artifact.html', dist), artifact + '\n');
const count = JSON.parse(seed).length;
console.log(
  `artifact.html listo (${(artifact.length / 1024).toFixed(1)} KB, plantilla ${(b64.length / 1024).toFixed(1)} KB, ${count} preset(s) compartido(s))`
);
