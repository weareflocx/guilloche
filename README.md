# Guilloché

App generativa que aplica patrones guilloché sobre imágenes y videos,
inspirada en el flujo de ASCII Magic pero con curvas continuas de grabado
en lugar de caracteres.

## Cómo funciona

La fuente (imagen o fotograma de video) se muestrea a baja resolución y su
luminancia modula la geometría del patrón: amplitud de onda, radio de
roseta, grosor de línea o aparición de trama cruzada. Los patrones generan
polilíneas independientes de la resolución, así el canvas en vivo, el PNG
a 2x y el SVG comparten exactamente la misma geometría.

## Uso

```bash
npm install
npm run dev
```

Arrastra una imagen (JPG/PNG) o un video (MP4/WebM) sobre el lienzo.
Hay un clip de prueba en `public/test.mp4`.

- **Patrones**: Ondas, Verticales, Entrelazado, Anillos, Espiral,
  Rosetas, Tramado.
- **Ajustes**: densidad (hasta 300 líneas), amplitud, frecuencia, grosor,
  contraste, umbral de blancos, inversión, grosor variable y fondo
  texturizado de rayitas verticales.
- **Modo grabado de billete**: con tinta única y grosor variable, las
  líneas se dibujan como cintas de ancho continuo — el grosor sigue la
  oscuridad punto a punto: las luces desaparecen en papel limpio (umbral)
  y las sombras se funden en masa sólida, como el grabado calcográfico
  de los billetes de euro. Click en el lienzo fija el centro de anillos
  y espiral (p. ej. sobre la cara de un retrato).
- **Color**: tinta única, duotono (sombras/luces) o colores originales.
- **Capas**: opacidad del efecto con modos de fusión (normal,
  multiplicar, trama, superponer, diferencia) y capa de la fuente
  original debajo, con su propia opacidad, desenfoque y filtro de color
  (B/N, sepia, cálido, frío). El botón «👁 Original» sobre el lienzo
  muestra la fuente sin efecto mientras se mantiene pulsado.
- **Acabado**: viñeta, grano de película y scan lines sobre el resultado
  (viñeta y scan lines también en el SVG; el grano es raster).
- **Tipografía**: Geist para la interfaz y Geist Mono para títulos y
  valores, cargadas de Google Fonts.
- **Export**: PNG (2x), SVG vectorial (fotograma actual, con la capa
  original incrustada si está activa) y grabación WebM del canvas en
  movimiento.
- **Mis presets**: guarda la configuración actual con nombre. En el
  artifact publicado se comparte con todo el equipo (la página se
  republica a sí misma vía la capability `artifact`, con una plantilla
  quine embebida en base64 — ver `scripts/make-artifact.mjs`); en local
  o sin permiso de escritura cae a localStorage. Guardar recarga la
  vista; la configuración y la imagen cargada se restauran desde
  sessionStorage (el video hay que recargarlo).

## Publicar en el artifact

`npm run build:artifact` genera `dist/artifact.html`, listo para publicar.

**Antes de republicar, sincroniza los presets compartidos.** Publicar
reemplaza el documento entero, así que los presets que el equipo haya
guardado en la versión viva se perderían si no están en la semilla.
Abre el artifact, copia el contenido del bloque
`<script id="shared-presets">` y pégalo en `presets.shared.json`; el
build lo incrusta. No se puede automatizar desde el build porque leer el
artifact requiere sesión de claude.ai.
- **Presets**: todos usan la gama cromática del design system de Cauce
  (Ink 900 `#1F2222`, Indigo 700 `#383A73`, Aqua 500 `#75D0CD`, Sky 200
  `#B9E4F0`, Mist 50 `#E6F4F3`), leída de las variables del archivo de
  Figma CAUCE — WORK: Retrato, Marca, Aqua, Dúo, Tinta, Noche, Cielo,
  Cortina, Espejo y Original. Los colores por defecto de la app también
  son de la gama.

## Estructura

- `src/sampler.js` — muestreo de luminancia/color con interpolación bilineal
- `src/patterns/index.js` — los seis generadores de polilíneas
- `src/render.js` — render compartido Canvas/SVG con modulación por tramos
- `src/main.js` — estado, UI, fuentes, presets y exportación
