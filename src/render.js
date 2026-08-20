// Recorre las polilíneas en tramos cortos para poder modular color y
// grosor a lo largo de cada línea. Canvas y SVG usan el mismo recorrido,
// así el export vectorial es idéntico a lo que se ve en pantalla.
const CHUNK = 14;
const CHUNK_FINE = 7; // con grosor variable, tramos cortos para gradientes suaves

export function forEachChunk(strokes, smp, p, colors, W, H, cb) {
  const threshold = p.threshold || 0;
  const uniform = colors.mode === 'ink' && !p.modWidth && threshold === 0;
  const chunk = p.modWidth ? CHUNK_FINE : CHUNK;
  for (const pts of strokes) {
    const n = pts.length / 2;
    if (n < 2) continue;
    if (uniform) {
      cb(pts, 0, n, colors.ink, p.thickness);
      continue;
    }
    for (let start = 0; start < n - 1; start += chunk - 1) {
      const end = Math.min(start + chunk, n);
      const mid = Math.floor((start + end) / 2);
      const u = Math.max(0, Math.min(1, pts[mid * 2] / W));
      const v = Math.max(0, Math.min(1, pts[mid * 2 + 1] / H));
      const d = smp.dark(u, v);
      // Umbral de blancos: en zonas más claras que el umbral no hay línea,
      // como en el grabado de billete (luces = papel limpio).
      if (d < threshold) continue;
      const width = p.modWidth ? p.thickness * (0.1 + 1.9 * d) : p.thickness;
      let color;
      if (colors.mode === 'original') {
        const [r, g, b] = smp.rgb(u, v);
        color = `rgb(${r | 0},${g | 0},${b | 0})`;
      } else if (colors.mode === 'duo') {
        color = d > 0.5 ? colors.ink : colors.ink2;
      } else {
        color = colors.ink;
      }
      cb(pts, start, end, color, width);
    }
  }
}

// ── Cintas de grosor continuo ──
// Con tinta única y grosor variable, cada polilínea se convierte en un
// polígono cuyo ancho sigue la oscuridad punto a punto: las luces se
// afinan hasta desaparecer y las sombras se funden en masa sólida, como
// en el grabado calcográfico de los billetes.
export function buildRibbons(strokes, smp, p, W, H) {
  const threshold = p.threshold || 0;
  const ribbons = [];
  for (const pts of strokes) {
    const n = pts.length / 2;
    if (n < 2) continue;
    const wArr = new Float32Array(n);
    const nxArr = new Float32Array(n);
    const nyArr = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = pts[i * 2], y = pts[i * 2 + 1];
      const ip = Math.max(0, i - 1), inx = Math.min(n - 1, i + 1);
      let dx = pts[inx * 2] - pts[ip * 2];
      let dy = pts[inx * 2 + 1] - pts[ip * 2 + 1];
      const len = Math.hypot(dx, dy) || 1;
      nxArr[i] = -dy / len;
      nyArr[i] = dx / len;
      const d = smp.dark(
        Math.max(0, Math.min(1, x / W)),
        Math.max(0, Math.min(1, y / H))
      );
      let w = p.thickness * (0.1 + 1.9 * d);
      if (threshold > 0) {
        // fundido suave hacia cero al cruzar el umbral
        const t = (d - threshold) / 0.06;
        w *= Math.max(0, Math.min(1, t));
      }
      wArr[i] = w;
    }
    // trocea en tramos visibles (w > ~0) y construye el polígono de cada uno
    let start = -1;
    for (let i = 0; i <= n; i++) {
      const visible = i < n && wArr[i] > 0.04;
      if (visible && start < 0) start = i;
      if (!visible && start >= 0) {
        const m = i - start;
        if (m >= 2) {
          const poly = new Float32Array(m * 4);
          for (let k = 0; k < m; k++) {
            const j = start + k;
            const h = wArr[j] / 2;
            poly[k * 2] = pts[j * 2] + nxArr[j] * h;
            poly[k * 2 + 1] = pts[j * 2 + 1] + nyArr[j] * h;
            const back = (m * 2 - 1 - k) * 2;
            poly[back] = pts[j * 2] - nxArr[j] * h;
            poly[back + 1] = pts[j * 2 + 1] - nyArr[j] * h;
          }
          ribbons.push(poly);
        }
        start = -1;
      }
    }
  }
  return ribbons;
}

function useRibbons(p, colors) {
  return !!p.modWidth && colors.mode === 'ink';
}

// Rayas verticales finas y constantes, la textura de fondo típica de billete.
export function hairlines(W, H, count = 150) {
  const strokes = [];
  const step = W / (count + 1);
  for (let i = 1; i <= count; i++) {
    strokes.push(new Float32Array([i * step, 0, i * step, H]));
  }
  return strokes;
}

// Filtros de color para la capa original, como los del panel /COLOR
// de la referencia. Se combinan con el desenfoque en un ctx.filter.
const SRC_FILTERS = {
  none: '',
  bw: 'grayscale(1)',
  sepia: 'sepia(0.85)',
  warm: 'sepia(0.35) saturate(1.4) hue-rotate(-12deg)',
  cool: 'saturate(1.15) hue-rotate(18deg) brightness(1.05)',
};

export function srcFilterCSS(p, includeBlur = true) {
  const f = SRC_FILTERS[p.srcFilter || 'none'] || '';
  const b = includeBlur && (p.srcBlur || 0) > 0 ? `blur(${p.srcBlur}px)` : '';
  return [f, b].filter(Boolean).join(' ');
}

// Acabado raster sobre el resultado: scan lines, grano y viñeta.
// ppScale escala los tamaños en exports a mayor resolución.
export function postProcess(ctx, p, W, H) {
  const s = p.ppScale || 1;
  if (p.scanlines) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.13)';
    const step = 3 * s;
    for (let y = 0; y < H; y += step) ctx.fillRect(0, y, W, s);
    ctx.restore();
  }
  if (p.grain) {
    const n = document.createElement('canvas');
    n.width = 160;
    n.height = 160;
    const g = n.getContext('2d');
    const img = g.createImageData(160, 160);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    ctx.save();
    ctx.globalAlpha = 0.09;
    ctx.globalCompositeOperation = 'overlay';
    const tile = 160 * s;
    for (let y = 0; y < H; y += tile) {
      for (let x = 0; x < W; x += tile) {
        ctx.drawImage(n, x, y, tile, tile);
      }
    }
    ctx.restore();
  }
  if (p.vignette) {
    ctx.save();
    const r = Math.hypot(W, H) / 2;
    const grad = ctx.createRadialGradient(W / 2, H / 2, r * 0.45, W / 2, H / 2, r);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.38)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

// backdropEl: la fuente (imagen o video) dibujada bajo el efecto, con
// p.srcOpacity, p.srcBlur y p.srcFilter. El efecto usa p.fxOpacity y p.blend.
export function drawStrokes(ctx, strokes, smp, p, colors, W, H, backdropEl = null) {
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, W, H);
  if (backdropEl && (p.srcOpacity || 0) > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, p.srcOpacity);
    const filter = srcFilterCSS(p);
    if (filter) ctx.filter = filter;
    ctx.drawImage(backdropEl, 0, 0, W, H);
    ctx.restore();
  }
  const fx = p.fxOpacity ?? 1;
  if (fx > 0) {
    ctx.save();
    ctx.globalCompositeOperation = p.blend || 'source-over';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (p.bgTexture) {
      ctx.save();
      ctx.globalAlpha = 0.25 * fx;
      ctx.strokeStyle = colors.ink;
      ctx.lineWidth = Math.max(0.3, p.thickness * 0.22);
      ctx.beginPath();
      for (const pts of hairlines(W, H)) {
        ctx.moveTo(pts[0], pts[1]);
        ctx.lineTo(pts[2], pts[3]);
      }
      ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = fx;
    if (useRibbons(p, colors)) {
      ctx.fillStyle = colors.ink;
      ctx.beginPath();
      for (const poly of buildRibbons(strokes, smp, p, W, H)) {
        ctx.moveTo(poly[0], poly[1]);
        for (let i = 1; i < poly.length / 2; i++) {
          ctx.lineTo(poly[i * 2], poly[i * 2 + 1]);
        }
        ctx.closePath();
      }
      ctx.fill();
    } else {
      forEachChunk(strokes, smp, p, colors, W, H, (pts, start, end, color, width) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(pts[start * 2], pts[start * 2 + 1]);
        for (let i = start + 1; i < end; i++) {
          ctx.lineTo(pts[i * 2], pts[i * 2 + 1]);
        }
        ctx.stroke();
      });
    }
    ctx.restore();
  }
  postProcess(ctx, p, W, H);
}

// Acabado vectorial equivalente para el SVG (el grano es raster y se omite).
function svgFinish(p, W, H) {
  const parts = [];
  if (p.scanlines) {
    parts.push(
      '<pattern id="scan" width="4" height="3" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#000" opacity="0.13"/></pattern>',
      `<rect width="${W}" height="${H}" fill="url(#scan)"/>`
    );
  }
  if (p.vignette) {
    parts.push(
      '<radialGradient id="vig" cx="50%" cy="50%" r="70%"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.38"/></radialGradient>',
      `<rect width="${W}" height="${H}" fill="url(#vig)"/>`
    );
  }
  return parts;
}

const SVG_BLEND = {
  'source-over': 'normal',
  multiply: 'multiply',
  screen: 'screen',
  overlay: 'overlay',
  difference: 'difference',
};

export function strokesToSVG(strokes, smp, p, colors, W, H, backdropDataUrl = null) {
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    `<rect width="${W}" height="${H}" fill="${colors.bg}"/>`,
  ];
  if (backdropDataUrl && (p.srcOpacity || 0) > 0) {
    let filter = '';
    if ((p.srcBlur || 0) > 0) {
      parts.push(
        `<filter id="srcblur"><feGaussianBlur stdDeviation="${(p.srcBlur / 2).toFixed(1)}"/></filter>`
      );
      filter = ' filter="url(#srcblur)"';
    }
    parts.push(
      `<image href="${backdropDataUrl}" width="${W}" height="${H}" opacity="${p.srcOpacity.toFixed(2)}"${filter} preserveAspectRatio="none"/>`
    );
  }
  const fx = p.fxOpacity ?? 1;
  const blend = SVG_BLEND[p.blend || 'source-over'] || 'normal';
  const blendStyle = blend !== 'normal' ? `;mix-blend-mode:${blend}` : '';
  parts.push(`<g style="opacity:${fx.toFixed(2)}${blendStyle}">`);
  if (p.bgTexture) {
    const hw = Math.max(0.3, p.thickness * 0.22).toFixed(2);
    for (const pts of hairlines(W, H)) {
      parts.push(
        `<line x1="${pts[0].toFixed(1)}" y1="0" x2="${pts[2].toFixed(1)}" y2="${H}" stroke="${colors.ink}" stroke-width="${hw}" stroke-opacity="0.25"/>`
      );
    }
  }
  if (useRibbons(p, colors)) {
    for (const poly of buildRibbons(strokes, smp, p, W, H)) {
      let d = `M${poly[0].toFixed(1)} ${poly[1].toFixed(1)}`;
      for (let i = 1; i < poly.length / 2; i++) {
        d += `L${poly[i * 2].toFixed(1)} ${poly[i * 2 + 1].toFixed(1)}`;
      }
      parts.push(`<path d="${d}Z" fill="${colors.ink}"/>`);
    }
    parts.push('</g>', ...svgFinish(p, W, H), '</svg>');
    return parts.join('\n');
  }
  forEachChunk(strokes, smp, p, colors, W, H, (pts, start, end, color, width) => {
    let d = `M${pts[start * 2].toFixed(1)} ${pts[start * 2 + 1].toFixed(1)}`;
    for (let i = start + 1; i < end; i++) {
      d += `L${pts[i * 2].toFixed(1)} ${pts[i * 2 + 1].toFixed(1)}`;
    }
    parts.push(
      `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/>`
    );
  });
  parts.push('</g>', ...svgFinish(p, W, H), '</svg>');
  return parts.join('\n');
}
