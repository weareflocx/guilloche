// Muestrea la fuente (imagen o video) a baja resolución y expone
// luminancia/color con interpolación bilineal en coordenadas normalizadas.
const SAMPLE_MAX = 180;

export class Sampler {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.w = 0;
    this.h = 0;
    this.data = null;
    this.contrast = 0; // -1..1
    this.invert = false;
  }

  update(source, srcW, srcH) {
    const scale = Math.min(1, SAMPLE_MAX / Math.max(srcW, srcH));
    const w = Math.max(2, Math.round(srcW * scale));
    const h = Math.max(2, Math.round(srcH * scale));
    if (w !== this.canvas.width || h !== this.canvas.height) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.ctx.drawImage(source, 0, 0, w, h);
    this.data = this.ctx.getImageData(0, 0, w, h).data;
    this.w = w;
    this.h = h;
  }

  // Índice del píxel más cercano, sujetando al borde.
  _idx(x, y) {
    const xi = Math.max(0, Math.min(this.w - 1, x));
    const yi = Math.max(0, Math.min(this.h - 1, y));
    return (yi * this.w + xi) * 4;
  }

  rgb(u, v) {
    if (!this.data) return [128, 128, 128];
    const x = u * (this.w - 1);
    const y = v * (this.h - 1);
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    const d = this.data;
    const i00 = this._idx(x0, y0), i10 = this._idx(x0 + 1, y0);
    const i01 = this._idx(x0, y0 + 1), i11 = this._idx(x0 + 1, y0 + 1);
    const out = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
      const top = d[i00 + c] * (1 - fx) + d[i10 + c] * fx;
      const bot = d[i01 + c] * (1 - fx) + d[i11 + c] * fx;
      out[c] = top * (1 - fy) + bot * fy;
    }
    return out;
  }

  // Luminancia 0..1 con contraste e inversión aplicados.
  lum(u, v) {
    const [r, g, b] = this.rgb(u, v);
    let l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    if (this.contrast !== 0) {
      const k = Math.tan((this.contrast * 0.99 + 1) * Math.PI / 4);
      l = Math.max(0, Math.min(1, (l - 0.5) * k + 0.5));
    }
    return this.invert ? 1 - l : l;
  }

  // "Oscuridad": 1 en zonas oscuras. Es lo que modula los patrones.
  dark(u, v) {
    return 1 - this.lum(u, v);
  }
}
