// Cada patrón genera polilíneas (arrays planos [x0,y0,x1,y1,...]) a partir
// del sampler. La geometría es independiente de la resolución de salida:
// todo se calcula relativo a W y H, así el mismo patrón sirve para el
// canvas en vivo, el PNG a mayor escala y el SVG.

const TAU = Math.PI * 2;

function polyline(n) {
  return new Float32Array(n * 2);
}

// ── Ondas: líneas horizontales cuya oscilación crece con la oscuridad ──
function waves(smp, p, W, H) {
  const lines = p.density;
  const step = H / (lines + 1);
  const amp = (p.amplitude / 100) * step * 2.4;
  const N = 240;
  const strokes = [];
  for (let i = 1; i <= lines; i++) {
    const y0 = i * step;
    const pts = polyline(N);
    for (let j = 0; j < N; j++) {
      const u = j / (N - 1);
      const d = smp.dark(u, y0 / H);
      const y = y0 + amp * d * Math.sin(TAU * p.frequency * u + i * 0.7);
      pts[j * 2] = u * W;
      pts[j * 2 + 1] = y;
    }
    strokes.push(pts);
  }
  return strokes;
}

// ── Verticales: líneas verticales finas, el fondo clásico de billete ──
function vlines(smp, p, W, H) {
  const lines = p.density;
  const step = W / (lines + 1);
  const amp = (p.amplitude / 100) * step * 2.4;
  const N = 240;
  const strokes = [];
  for (let i = 1; i <= lines; i++) {
    const x0 = i * step;
    const pts = polyline(N);
    for (let j = 0; j < N; j++) {
      const v = j / (N - 1);
      const d = smp.dark(x0 / W, v);
      const x = x0 + amp * d * Math.sin(TAU * p.frequency * v + i * 0.7);
      pts[j * 2] = x;
      pts[j * 2 + 1] = v * H;
    }
    strokes.push(pts);
  }
  return strokes;
}

// ── Entrelazado: pares de sinusoides en contrafase que se cruzan ──
function weave(smp, p, W, H) {
  const rows = Math.max(4, Math.round(p.density / 2));
  const step = H / (rows + 1);
  const amp = (p.amplitude / 100) * step * 1.6;
  const N = 240;
  const strokes = [];
  for (let i = 1; i <= rows; i++) {
    const y0 = i * step;
    for (const sign of [1, -1]) {
      const pts = polyline(N);
      for (let j = 0; j < N; j++) {
        const u = j / (N - 1);
        const d = smp.dark(u, y0 / H);
        const y = y0 + sign * amp * (0.15 + 0.85 * d) *
          Math.sin(TAU * p.frequency * u + i * 0.35);
        pts[j * 2] = u * W;
        pts[j * 2 + 1] = y;
      }
      strokes.push(pts);
    }
  }
  return strokes;
}

// ── Anillos: círculos concéntricos con ondulación radial ──
// Centro configurable (click en el lienzo) y radio hasta la esquina
// más lejana, para que los anillos cubran todo el cuadro.
function centerOf(p, W, H) {
  const cx = (p.cx ?? 0.5) * W;
  const cy = (p.cy ?? 0.5) * H;
  const maxR = Math.max(
    Math.hypot(cx, cy),
    Math.hypot(W - cx, cy),
    Math.hypot(cx, H - cy),
    Math.hypot(W - cx, H - cy)
  );
  return { cx, cy, maxR };
}

function rings(smp, p, W, H) {
  const { cx, cy, maxR } = centerOf(p, W, H);
  const count = p.density;
  const stepR = maxR / count;
  const amp = (p.amplitude / 100) * stepR * 2.4;
  const strokes = [];
  for (let i = 1; i <= count; i++) {
    const r0 = i * stepR;
    // puntos según circunferencia: ~1 cada 6px, acotado
    const N = Math.max(48, Math.min(420, Math.round((TAU * r0) / 6)));
    const pts = polyline(N + 1);
    for (let j = 0; j <= N; j++) {
      const t = (j / N) * TAU;
      const bx = cx + r0 * Math.cos(t);
      const by = cy + r0 * Math.sin(t);
      const d = smp.dark(bx / W, by / H);
      const r = r0 + amp * d * Math.sin(p.frequency * t + i * 0.5);
      pts[j * 2] = cx + r * Math.cos(t);
      pts[j * 2 + 1] = cy + r * Math.sin(t);
    }
    strokes.push(pts);
  }
  return strokes;
}

// ── Espiral: una sola espiral de Arquímedes desplazada por la imagen ──
function spiral(smp, p, W, H) {
  const { cx, cy, maxR } = centerOf(p, W, H);
  const turns = Math.max(8, Math.min(80, Math.round(p.density * 0.6)));
  const stepR = maxR / turns;
  const amp = (p.amplitude / 100) * stepR * 2.2;
  const perTurn = 220;
  const total = turns * perTurn;
  const pts = polyline(total);
  for (let j = 0; j < total; j++) {
    const t = (j / perTurn) * TAU;
    const r0 = (j / total) * maxR;
    const bx = cx + r0 * Math.cos(t);
    const by = cy + r0 * Math.sin(t);
    const d = smp.dark(bx / W, by / H);
    const r = r0 + amp * d * Math.sin(p.frequency * 0.5 * t);
    pts[j * 2] = cx + r * Math.cos(t);
    pts[j * 2 + 1] = cy + r * Math.sin(t);
  }
  return [pts];
}

// ── Rosetas: retícula de rosas de espirógrafo, tamaño según oscuridad ──
function rosettes(smp, p, W, H) {
  const cols = Math.max(6, Math.min(56, Math.round(p.density / 3)));
  const cell = W / cols;
  const rows = Math.ceil(H / cell);
  const k = 3 + Math.round(p.frequency / 8);
  const w = 0.2 + 0.5 * (p.amplitude / 100);
  const N = 64;
  const strokes = [];
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const cx = (gx + 0.5) * cell;
      const cy = (gy + 0.5) * cell;
      const d = smp.dark(cx / W, cy / H);
      if (d < 0.06) continue;
      const R = cell * 0.52 * (0.2 + 0.8 * d);
      const pts = polyline(N + 1);
      for (let j = 0; j <= N; j++) {
        const t = (j / N) * TAU;
        const r = R * (1 - w + w * Math.cos(k * t));
        pts[j * 2] = cx + r * Math.cos(t);
        pts[j * 2 + 1] = cy + r * Math.sin(t);
      }
      strokes.push(pts);
    }
  }
  return strokes;
}

// ── Tramado: diagonales onduladas; en sombras aparece la trama cruzada ──
function hatch(smp, p, W, H) {
  const lines = p.density;
  const diag = W + H;
  const step = diag / lines;
  const amp = (p.amplitude / 100) * step * 1.8;
  const N = 200;
  const strokes = [];
  // Dos familias a ±45°: la primera se dibuja casi siempre, la segunda
  // solo en zonas oscuras (trama cruzada, como en el grabado clásico).
  for (const [dir, thresh] of [[1, 0.1], [-1, 0.55]]) {
    for (let i = 0; i <= lines; i++) {
      const c = dir === 1 ? i * step - W : i * step;
      let current = null;
      for (let j = 0; j <= N; j++) {
        const x = (j / N) * W;
        const yb = dir * x + c;
        if (yb < -step || yb > H + step) { current = null; continue; }
        const d = smp.dark(x / W, Math.max(0, Math.min(1, yb / H)));
        if (d < thresh) { if (current && current.length >= 4) strokes.push(new Float32Array(current)); current = null; continue; }
        const s = j / N;
        const off = amp * d * Math.sin(TAU * p.frequency * s + i * 0.4);
        // desplazamiento perpendicular a la diagonal
        const nx = -dir / Math.SQRT2, ny = 1 / Math.SQRT2;
        if (!current) current = [];
        current.push(x + off * nx, yb + off * ny);
      }
      if (current && current.length >= 4) strokes.push(new Float32Array(current));
    }
  }
  return strokes;
}

export const PATTERNS = [
  { id: 'waves', name: 'Ondas', generate: waves },
  { id: 'vlines', name: 'Verticales', generate: vlines },
  { id: 'weave', name: 'Entrelazado', generate: weave },
  { id: 'rings', name: 'Anillos', generate: rings },
  { id: 'spiral', name: 'Espiral', generate: spiral },
  { id: 'rosettes', name: 'Rosetas', generate: rosettes },
  { id: 'hatch', name: 'Tramado', generate: hatch },
];
