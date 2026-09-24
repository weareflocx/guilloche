# Guilloché · Guía de integración

Para quien integre Guilloché en el ecosistema de herramientas CAUCE, junto
a CAZ y Cauce System. Es la guía hermana de `docs/INTEGRACION.md` en el
repo de CAZ (`weareflocx/cauce`), que conviene leer primero: allí está la
visión del ecosistema completo.

Guilloché aplica grabado guilloché a fotos y vídeos existentes. Es una web
app estática: Vite + JavaScript, sin dependencias de runtime, sin backend.
Desde la v0.2 comparte el sistema visual y la paleta de CAZ.

## Estado

| | |
|---|---|
| Repo | `weareflocx/guilloche`, rama `main` |
| Versión | 0.2.0 |
| Web normal | `npm run build` → `dist/index.html` (un solo archivo) + `test.mp4` |
| Artifact | `npm run build:artifact` → `dist/artifact.html` |
| En producción | Artifact de claude.ai, con presets compartidos por el equipo |

Verificado el 24/09/2026: build limpio, los siete patrones y los diez
presets de fábrica se aplican sin errores de consola, las gamas, los
campos hex, deshacer y la escala del PNG funcionan, y la plantilla del
artifact sigue siendo un punto fijo (republicar conserva los presets).

## Arquitectura

```
src/
  main.js            interfaz, estado, historial, presets, gamas, exportación
  sampler.js         muestreo de luminancia y color (bilineal, sin alocar
                     memoria en el camino caliente)
  patterns/index.js  los siete generadores de polilíneas
  render.js          render compartido Canvas/SVG: cintas de grosor
                     variable, capas, filtros y acabado
scripts/
  make-artifact.mjs  build del artifact que se republica a sí mismo
presets.shared.json  presets que el equipo ha guardado en el artifact
vite.config.js       build de un solo archivo + incrustación de presets
```

Como en CAZ, la dependencia va en un solo sentido: solo `main.js` importa
`sampler`, `patterns` y `render`. `patterns` es matemática pura; `sampler`
y `render` solo crean canvas auxiliares (`document.createElement`), así
que funcionan en cualquier página y se moverían a un Worker con
`OffscreenCanvas`.

### API de los módulos

| Módulo | Exporta |
|---|---|
| `patterns/index.js` | `PATTERNS`: `{ id, name, generate(sampler, params, W, H) }` → polilíneas |
| `sampler.js` | `Sampler`: `update(fuente, w, h)`, `dark(u, v)`, `lum(u, v)`, `rgb(u, v)` |
| `render.js` | `drawStrokes`, `strokesToSVG`, `buildRibbons`, `postProcess`, `srcFilterCSS` |

La geometría no depende de la resolución: el mismo `generate` sirve para
el canvas en vivo, el PNG a ×4 y el SVG, así que los tres salen idénticos.

### Exportación

La función `download()` de `main.js` ya decide cómo entregar el archivo:
en el artifact usa la capability `downloads` y fuera cae a un enlace de
descarga. En un ecosistema, ese es el único punto que hay que cambiar para
que el anfitrión reciba el `Blob` (por ejemplo, para guardarlo en una
biblioteca compartida).

## El contrato de datos: el preset

```json
{
  "name": "Retrato",
  "patternId": "rings",
  "params": { "density": 250, "amplitude": 6, "threshold": 0.12, "...": "..." },
  "colors": { "mode": "ink", "bg": "#f0f6f5", "ink": "#262929", "ink2": "#262929" }
}
```

- `params` tiene 19 claves: trazo (`density`, `amplitude`, `frequency`,
  `thickness`, `contrast`, `threshold`, `invert`, `modWidth`,
  `bgTexture`), centro de los patrones radiales (`cx`, `cy`), capas
  (`fxOpacity`, `blend`, `srcOpacity`, `srcBlur`, `srcFilter`) y acabado
  (`vignette`, `grain`, `scanlines`).
- `colors.mode` es `ink`, `duo` u `original` (colores de la foto).
- Descargar/Cargar presets usa `{ "version": 1, "presets": [...] }`.
- **No es compatible con la receta de CAZ**, pero el color sí se traduce
  directo: `bg` = `colorFondo`, `ink` = `colorTinta`, `ink2` =
  `colorDeriva`. Es la base natural de una capa de color común.

## Presets compartidos en el artifact

Guardar un preset en el artifact republica la página entera con el preset
dentro (capability `artifact`). Para poder regenerarse sin serializar el
DOM, la página lleva una plantilla de sí misma en base64 con dos huecos:
el JSON de presets y la propia plantilla. Detalle en
`scripts/make-artifact.mjs`.

**Antes de republicar desde el repo hay que copiar los presets vivos** del
bloque `<script id="shared-presets">` del artifact a
`presets.shared.json`: publicar reemplaza el documento y, si no, se
perderían. Los dos builds incrustan ese archivo, así que la web normal
arranca con los mismos presets compartidos que el artifact.

## Relación con CAZ

- **Misma paleta y mismas 14 gamas.** Están copiadas literalmente de
  `cauce/src/engine/params.ts` en `main.js`, y los tokens CSS (`--papel`,
  `--tinta`, `--lima`, `--arena`, `--senal`) son los de CAZ. Hoy son dos
  copias: el primer candidato a paquete compartido de tokens.
- **Mismo sistema visual**: bordes de 1 px en tinta, esquinas rectas,
  etiquetas en versalitas, valores en monoespaciada y la misma pila
  tipográfica, sin fuentes externas.
- **Dos grabadores de foto.** El modo RETRATO de CAZ y Guilloché hacen lo
  mismo con motores distintos: foto → grabado de línea. Conviene decidir
  si conviven con papeles claros (CAZ para la marca, Guilloché para
  procesar material, vídeo incluido) o si se unifican.

## Decisiones pendientes

1. **Guilloché en el hub.** Hoy no está. Añadirlo es una entrada en
   `TOOLS` del hub de CAZ, pero fuera del artifact los presets compartidos
   caen a `localStorage`: hay que decidir dónde viven (Netlify Blobs, como
   la biblioteca de Cauce System, sería lo coherente).
2. **Paleta del ecosistema.** Guilloché ya usa la de CAZ. Cauce System
   sigue con la suya.
3. **Los dos grabadores**, ver arriba.
4. **El preset compartido `Cauce_1`** lo guardó el equipo con la paleta
   antigua (fondo `#E6F4F3`). No se ha tocado; decidir si se migra.

## Problemas conocidos

1. **El vídeo no arranca en pestañas ocultas.** Chrome bloquea la
   reproducción en documentos no visibles; el scrub funciona igual.
2. **En el artifact, el SVG puede llegar como `.svg.txt`** si el visor no
   tiene habilitadas las extensiones ampliadas. El contenido es el mismo.
3. **El grano es raster**: sale en PNG y en vídeo, pero no en el SVG
   (viñeta y scan lines sí).
4. **Guardar un preset en el artifact recarga la vista.** La configuración
   y la imagen se restauran solas; el vídeo hay que volver a cargarlo.

## Arrancar

```bash
git clone https://github.com/weareflocx/guilloche.git
cd guilloche
npm install
npm run dev              # http://localhost:5173
npm run build            # dist/, web normal
npm run build:artifact   # dist/artifact.html
```
