import { Sampler } from './sampler.js';
import { PATTERNS } from './patterns/index.js';
import { drawStrokes, strokesToSVG, srcFilterCSS } from './render.js';

const MAX_DIM = 1280;

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const smp = new Sampler();

const state = {
  patternId: 'weave',
  params: {
    density: 80,
    amplitude: 55,
    frequency: 18,
    thickness: 1.2,
    contrast: 0.2,
    invert: false,
    modWidth: true,
    threshold: 0,
    bgTexture: false,
    cx: 0.5,
    cy: 0.5,
    fxOpacity: 1,
    blend: 'source-over',
    srcOpacity: 0,
    srcBlur: 0,
    srcFilter: 'none',
    vignette: false,
    grain: false,
    scanlines: false,
  },
  colors: { mode: 'ink', ink: '#262929', ink2: '#c2cfcf', bg: '#f0f6f5' },
  source: null, // { el, type, w, h }
  rafId: 0,
  peek: false, // mantener pulsado "Ver original"
};

function currentPattern() {
  return PATTERNS.find((p) => p.id === state.patternId);
}

// ─────────────────────────── Render ───────────────────────────

function render() {
  const src = state.source;
  if (!src) return;
  if (state.peek) {
    // vista rápida de la fuente sin efecto
    ctx.globalAlpha = 1;
    ctx.drawImage(src.el, 0, 0, canvas.width, canvas.height);
    return;
  }
  smp.contrast = state.params.contrast;
  smp.invert = state.params.invert;
  smp.update(src.el, src.w, src.h);
  const strokes = currentPattern().generate(smp, state.params, canvas.width, canvas.height);
  drawStrokes(ctx, strokes, smp, state.params, state.colors, canvas.width, canvas.height, src.el);
}

function startLoop() {
  cancelAnimationFrame(state.rafId);
  const tick = () => {
    render();
    const v = state.source?.el;
    if (state.source?.type === 'video' && v && !v.paused && !v.ended) {
      state.rafId = requestAnimationFrame(tick);
    }
    if (state.source?.type === 'video') {
      const scrub = document.getElementById('video-scrub');
      if (isFinite(v.duration) && v.duration > 0) scrub.value = v.currentTime / v.duration;
      updateVideoTime();
    }
  };
  state.rafId = requestAnimationFrame(tick);
}

// ─────────────────────────── Fuente ───────────────────────────

function fitCanvas(w, h) {
  const scale = Math.min(1, MAX_DIM / Math.max(w, h));
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
}

function setImageSource(img) {
  stopVideo();
  state.source = { el: img, type: 'image', w: img.naturalWidth, h: img.naturalHeight };
  fitCanvas(img.naturalWidth, img.naturalHeight);
  document.getElementById('video-bar').classList.add('hidden');
  updateStatusSource();
  render();
}

function setVideoSource(video) {
  stopVideo();
  state.source = { el: video, type: 'video', w: video.videoWidth, h: video.videoHeight };
  fitCanvas(video.videoWidth, video.videoHeight);
  document.getElementById('video-bar').classList.remove('hidden');
  const btnPlay = document.getElementById('btn-play');
  video.addEventListener('play', () => {
    btnPlay.textContent = '⏸';
    startLoop();
  });
  video.addEventListener('pause', () => {
    btnPlay.textContent = '▶';
  });
  video.addEventListener('seeked', () => {
    updateVideoTime();
    renderIfStatic();
  });
  btnPlay.textContent = '▶';
  updateStatusSource();
  updateVideoTime();
  video.play();
  render(); // primer fotograma visible aunque el autoplay esté bloqueado
}

// Línea de estado: tipo y dimensiones de la fuente activa.
function updateStatusSource() {
  const s = state.source;
  document.getElementById('status-source').textContent = s
    ? `${s.type === 'video' ? 'Video' : 'Imagen'} · ${s.w}×${s.h}`
    : '';
}

function fmtTime(t) {
  if (!isFinite(t)) return '0:00';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function updateVideoTime() {
  const v = state.source?.el;
  if (state.source?.type !== 'video') return;
  document.getElementById('video-time').textContent =
    `${fmtTime(v.currentTime)} / ${fmtTime(v.duration)}`;
}

function stopVideo() {
  const prev = state.source;
  if (prev?.type === 'video') {
    prev.el.pause();
    URL.revokeObjectURL(prev.el.src);
  }
  cancelAnimationFrame(state.rafId);
}

function togglePlay() {
  const v = state.source?.el;
  if (state.source?.type !== 'video') return;
  if (v.paused) v.play();
  else v.pause();
}

function loadFile(file) {
  if (!file) return;
  const url = URL.createObjectURL(file);
  if (file.type.startsWith('video/')) {
    const video = document.createElement('video');
    video.src = url;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.addEventListener('loadeddata', () => setVideoSource(video), { once: true });
  } else if (file.type.startsWith('image/')) {
    const img = new Image();
    img.onload = () => {
      setImageSource(img);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }
}

// Imagen de demostración para que la app abra con algo que ver.
function demoImage() {
  const c = document.createElement('canvas');
  c.width = 1200;
  c.height = 900;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 1200, 900);
  grad.addColorStop(0, '#e8e8e8');
  grad.addColorStop(1, '#666');
  g.fillStyle = grad;
  g.fillRect(0, 0, 1200, 900);
  g.fillStyle = '#1c1c1c';
  g.beginPath();
  g.arc(760, 420, 300, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(650, 330, 110, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#3a3a3a';
  g.fillRect(80, 560, 340, 260);
  const img = new Image();
  img.src = c.toDataURL();
  img.onload = () => setImageSource(img);
}

// ─────────────────────────── Undo/Redo ───────────────────────────
// Historial de {patternId, params, colors}. Cada cambio de UI hace
// commit; sliders y pickers de color coalescen ráfagas del mismo
// control (hasta 600 ms) para que un arrastre sea un solo paso.

const HISTORY_MAX = 60;
const COALESCE_MS = 600;
let history = [];
let historyIndex = -1;
let historyKey = null;
let historyTime = 0;

function snapshot() {
  return {
    patternId: state.patternId,
    params: { ...state.params },
    colors: { ...state.colors },
  };
}

function commitHistory(coalesceKey) {
  const now = Date.now();
  const canCoalesce =
    coalesceKey && coalesceKey === historyKey && now - historyTime < COALESCE_MS;
  if (canCoalesce && historyIndex === history.length - 1) {
    history[historyIndex] = snapshot();
  } else {
    history = history.slice(0, historyIndex + 1);
    history.push(snapshot());
    if (history.length > HISTORY_MAX) history.shift();
    historyIndex = history.length - 1;
    historyKey = coalesceKey || null;
  }
  historyTime = now;
  updateHistoryUI();
}

function applyHistoryEntry() {
  const s = history[historyIndex];
  state.patternId = s.patternId;
  state.params = { ...s.params };
  state.colors = { ...s.colors };
  syncUI();
  renderIfStatic();
  updateHistoryUI();
}

function undoHistory() {
  if (historyIndex > 0) {
    historyIndex--;
    applyHistoryEntry();
  }
}

function redoHistory() {
  if (historyIndex < history.length - 1) {
    historyIndex++;
    applyHistoryEntry();
  }
}

function updateHistoryUI() {
  document.getElementById('btn-undo').disabled = historyIndex <= 0;
  document.getElementById('btn-redo').disabled = historyIndex >= history.length - 1;
}

// ─────────────────────────── UI ───────────────────────────

function buildPatternSelect() {
  const sel = document.getElementById('p-pattern');
  for (const [i, pat] of PATTERNS.entries()) {
    const opt = document.createElement('option');
    opt.value = pat.id;
    opt.textContent = `${i + 1}. ${pat.name}`;
    sel.appendChild(opt);
  }
  sel.value = state.patternId;
}

function selectPattern(id) {
  state.patternId = id;
  document.getElementById('p-pattern').value = id;
  renderIfStatic();
}

function renderIfStatic() {
  // Con video en marcha el rAF ya repinta; con imagen o video en pausa, repintamos a mano.
  const v = state.source?.el;
  if (state.source?.type !== 'video' || v.paused || v.ended) render();
}

// Cada slider tiene su par numérico (n-*): se puede arrastrar o tipear.
// percent: la UI va en escala -100..100 o 0..100 y el estado en -1..1 / 0..1.
const SLIDERS = [
  { key: 'density', sid: 'p-density', nid: 'n-density', min: 10, max: 300, step: 1, def: 80 },
  { key: 'amplitude', sid: 'p-amplitude', nid: 'n-amplitude', min: 0, max: 100, step: 1, def: 55 },
  { key: 'frequency', sid: 'p-frequency', nid: 'n-frequency', min: 1, max: 60, step: 1, def: 18 },
  { key: 'thickness', sid: 'p-thickness', nid: 'n-thickness', min: 0.3, max: 6, step: 0.1, def: 1.2 },
  { key: 'contrast', sid: 'p-contrast', nid: 'n-contrast', min: -100, max: 100, step: 1, def: 20, percent: true },
  { key: 'threshold', sid: 'p-threshold', nid: 'n-threshold', min: 0, max: 60, step: 1, def: 0, percent: true },
  { key: 'fxOpacity', sid: 'p-fxopacity', nid: 'n-fxopacity', min: 0, max: 100, step: 1, def: 100, percent: true },
  { key: 'srcOpacity', sid: 'p-srcopacity', nid: 'n-srcopacity', min: 0, max: 100, step: 1, def: 0, percent: true },
  { key: 'srcBlur', sid: 'p-srcblur', nid: 'n-srcblur', min: 0, max: 40, step: 1, def: 0 },
];

// claves que en la UI van en % pero en estado son 0..1
const PERCENT_KEYS = new Set(SLIDERS.filter((s) => s.percent).map((s) => s.key));

function toUI(s, value) {
  return s.percent ? Math.round(value * 100) : value;
}

function fromUI(s, raw) {
  return s.percent ? raw / 100 : raw;
}

function setSliderParam(s, uiValue) {
  const clamped = Math.max(s.min, Math.min(s.max, uiValue));
  document.getElementById(s.sid).value = clamped;
  document.getElementById(s.nid).value = clamped;
  state.params[s.key] = fromUI(s, clamped);
}

function wireControls() {
  for (const s of SLIDERS) {
    const slider = document.getElementById(s.sid);
    const num = document.getElementById(s.nid);
    // Doble click vuelve al valor por defecto.
    for (const el of [slider, num]) {
      el.addEventListener('dblclick', () => {
        setSliderParam(s, s.def);
        renderIfStatic();
        commitHistory('slider:' + s.key);
      });
    }
    slider.addEventListener('input', () => {
      num.value = slider.value;
      state.params[s.key] = fromUI(s, parseFloat(slider.value));
      renderIfStatic();
      commitHistory('slider:' + s.key);
    });
    num.addEventListener('input', () => {
      if (num.value === '' || num.value === '-') return; // tipeo a medias
      setSliderParam(s, parseFloat(num.value));
      renderIfStatic();
      commitHistory('slider:' + s.key);
    });
    num.addEventListener('change', () => {
      if (num.value === '' || isNaN(parseFloat(num.value))) {
        num.value = toUI(s, state.params[s.key]);
        return;
      }
      setSliderParam(s, parseFloat(num.value)); // normaliza fuera de rango
      renderIfStatic();
    });
  }
  document.getElementById('p-invert').addEventListener('change', (e) => {
    state.params.invert = e.target.checked;
    renderIfStatic();
    commitHistory();
  });
  document.getElementById('p-modwidth').addEventListener('change', (e) => {
    state.params.modWidth = e.target.checked;
    renderIfStatic();
    commitHistory();
  });
  document.getElementById('p-bgtexture').addEventListener('change', (e) => {
    state.params.bgTexture = e.target.checked;
    renderIfStatic();
    commitHistory();
  });
  // Click en el lienzo: fija el centro de los patrones radiales.
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    state.params.cx = (e.clientX - rect.left) / rect.width;
    state.params.cy = (e.clientY - rect.top) / rect.height;
    renderIfStatic();
    commitHistory();
  });
  document.getElementById('p-blend').addEventListener('change', (e) => {
    state.params.blend = e.target.value;
    renderIfStatic();
    commitHistory();
  });
  // Filtro de color de la capa original
  const filterRow = document.getElementById('filter-row');
  filterRow.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    state.params.srcFilter = btn.dataset.filter;
    filterRow.querySelectorAll('.btn').forEach((b) => b.classList.toggle('active', b === btn));
    renderIfStatic();
    commitHistory();
  });
  // Acabado
  for (const [id, key] of [['p-vignette', 'vignette'], ['p-grain', 'grain'], ['p-scanlines', 'scanlines']]) {
    document.getElementById(id).addEventListener('change', (e) => {
      state.params[key] = e.target.checked;
      renderIfStatic();
      commitHistory();
    });
  }
  // Mantener pulsado para ver la fuente sin efecto.
  const peekBtn = document.getElementById('btn-peek');
  const setPeek = (on) => {
    if (state.peek === on) return;
    state.peek = on;
    renderIfStatic();
  };
  peekBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    setPeek(true);
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) {
    peekBtn.addEventListener(ev, () => setPeek(false));
  }
  document.getElementById('p-colormode').addEventListener('change', (e) => {
    state.colors.mode = e.target.value;
    document.getElementById('wrap-ink2').classList.toggle('hidden', e.target.value !== 'duo');
    renderIfStatic();
    commitHistory();
  });
  for (const [key, cid, hid] of COLOR_FIELDS) {
    const picker = document.getElementById(cid);
    const hex = document.getElementById(hid);
    picker.addEventListener('input', () => {
      state.colors[key] = picker.value.toLowerCase();
      syncColorUI();
      renderIfStatic();
      commitHistory(cid);
    });
    // Campo hex: acepta con o sin #; si no es válido se marca y no se aplica.
    hex.addEventListener('input', () => {
      const m = hex.value.trim().match(/^#?([0-9a-f]{6})$/i);
      hex.classList.toggle('bad', !m);
      if (!m) return;
      state.colors[key] = '#' + m[1].toLowerCase();
      picker.value = state.colors[key];
      document.querySelectorAll('#gamas .gama').forEach((b) => b.classList.remove('active'));
      renderIfStatic();
      commitHistory(cid);
    });
    hex.addEventListener('blur', syncColorUI);
  }

  // Fuente
  const fileInput = document.getElementById('file-input');
  document.getElementById('btn-upload').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => loadFile(fileInput.files[0]));

  const stage = document.getElementById('stage');
  const dropzone = document.getElementById('dropzone');
  stage.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.remove('hidden');
  });
  stage.addEventListener('dragleave', () => dropzone.classList.add('hidden'));
  stage.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.add('hidden');
    loadFile(e.dataTransfer.files[0]);
  });

  // Video
  document.getElementById('btn-play').addEventListener('click', togglePlay);
  document.getElementById('video-scrub').addEventListener('input', (e) => {
    const v = state.source?.el;
    if (state.source?.type === 'video' && isFinite(v.duration) && v.duration > 0) {
      v.currentTime = parseFloat(e.target.value) * v.duration;
      // el repintado llega con el evento 'seeked'
    }
  });
}

// ─────────────────────────── Export ───────────────────────────

async function download(blob, filename) {
  // En el visor de Artifacts de claude.ai las descargas directas están
  // bloqueadas; el archivo se ofrece a través de la capability `downloads`.
  if (window.claude?.use) {
    try {
      const downloads = await window.claude.use('downloads');
      if (downloads) {
        try {
          await downloads.save({ filename, data: blob });
        } catch (err) {
          if (err?.code === 'extension_not_enabled') {
            // p. ej. SVG fuera del set base: se ofrece como texto
            await downloads.save({ filename: `${filename}.txt`, data: blob }).catch(() => {});
          }
          // 'declined' / 'rate_limited': decisión del usuario, sin reintentos
        }
        return;
      }
    } catch {
      // sin runtime de artifact utilizable: cae a la descarga normal
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

let pngScale = 2;

function exportPNG() {
  if (!state.source) return;
  const scale = pngScale;
  const W = canvas.width * scale;
  const H = canvas.height * scale;
  const off = document.createElement('canvas');
  off.width = W;
  off.height = H;
  const p2 = {
    ...state.params,
    thickness: state.params.thickness * scale,
    srcBlur: (state.params.srcBlur || 0) * scale,
    ppScale: scale,
  };
  const strokes = currentPattern().generate(smp, p2, W, H);
  drawStrokes(off.getContext('2d'), strokes, smp, p2, state.colors, W, H, state.source.el);
  off.toBlob((blob) => download(blob, 'guilloche.png'), 'image/png');
}

// fotograma actual de la fuente como data URL, para incrustar en el SVG
function sourceDataURL() {
  const off = document.createElement('canvas');
  off.width = canvas.width;
  off.height = canvas.height;
  const g = off.getContext('2d');
  // el filtro de color se hornea en la imagen; el desenfoque lo pone el SVG
  const filter = srcFilterCSS(state.params, false);
  if (filter) g.filter = filter;
  g.drawImage(state.source.el, 0, 0, off.width, off.height);
  return off.toDataURL('image/jpeg', 0.85);
}

function exportSVG() {
  if (!state.source) return;
  const strokes = currentPattern().generate(smp, state.params, canvas.width, canvas.height);
  const backdrop = (state.params.srcOpacity || 0) > 0 ? sourceDataURL() : null;
  const svg = strokesToSVG(strokes, smp, state.params, state.colors, canvas.width, canvas.height, backdrop);
  download(new Blob([svg], { type: 'image/svg+xml' }), 'guilloche.svg');
}

let recorder = null;

function toggleRecord() {
  if (typeof MediaRecorder === 'undefined') {
    setShareNote('Tu navegador no soporta grabación de canvas (MediaRecorder).');
    return;
  }
  const btn = document.getElementById('btn-record');
  if (recorder) {
    recorder.stop();
    return;
  }
  const stream = canvas.captureStream(30);
  const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : '';
  recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  recorder.onstop = () => {
    const type = recorder.mimeType || 'video/webm';
    download(new Blob(chunks, { type }), type.includes('mp4') ? 'guilloche.mp4' : 'guilloche.webm');
    recorder = null;
    btn.classList.remove('recording');
    btn.textContent = '● Grabar';
  };
  recorder.start();
  btn.classList.add('recording');
  btn.textContent = '■ Detener';
  // Con una imagen fija hay que seguir pintando para alimentar el stream.
  if (state.source?.type !== 'video') {
    const keepAlive = () => {
      if (!recorder) return;
      render();
      requestAnimationFrame(keepAlive);
    };
    keepAlive();
  }
}

// ─────────────────────────── Presets ───────────────────────────

// Paleta de marca CAUCE, la misma que CAZ (cauce/src/engine/params.ts):
// tinta #262929 · papel #F0F6F5 · lima #FBFD9D · bruma #C2CFCF. Las gamas
// se copian literalmente de CAZ; fondo/tinta/deriva equivalen aquí a
// fondo/tinta/tinta 2. Si cambian en CAZ, hay que cambiarlas aquí.
const GAMAS = [
  // --- sobre papel ---
  { nombre: 'Tinta',    fondo: '#F0F6F5', tinta: '#262929', deriva: '#262929' },
  { nombre: 'Señal',    fondo: '#F0F6F5', tinta: '#262929', deriva: '#FBFD9D' },
  { nombre: 'Vado',     fondo: '#F0F6F5', tinta: '#262929', deriva: '#C2CFCF' },
  { nombre: 'Niebla',   fondo: '#F0F6F5', tinta: '#C2CFCF', deriva: '#C2CFCF' },
  // --- sobre tinta ---
  { nombre: 'Noche',    fondo: '#262929', tinta: '#F0F6F5', deriva: '#C2CFCF' },
  { nombre: 'Espuma',   fondo: '#262929', tinta: '#F0F6F5', deriva: '#FBFD9D' },
  { nombre: 'Lima',     fondo: '#262929', tinta: '#FBFD9D', deriva: '#FBFD9D' },
  { nombre: 'Faro',     fondo: '#262929', tinta: '#FBFD9D', deriva: '#C2CFCF' },
  { nombre: 'Poza',     fondo: '#262929', tinta: '#C2CFCF', deriva: '#F0F6F5' },
  // --- sobre bruma ---
  { nombre: 'Bruma',    fondo: '#C2CFCF', tinta: '#262929', deriva: '#F0F6F5' },
  { nombre: 'Marea',    fondo: '#C2CFCF', tinta: '#262929', deriva: '#FBFD9D' },
  // --- sobre lima ---
  { nombre: 'Contraluz', fondo: '#FBFD9D', tinta: '#262929', deriva: '#262929' },
  { nombre: 'Cal',      fondo: '#FBFD9D', tinta: '#262929', deriva: '#C2CFCF' },
  { nombre: 'Junco',    fondo: '#FBFD9D', tinta: '#262929', deriva: '#F0F6F5' },
];

// Colores de una gama en el formato de estado (hex en minúscula, como
// los devuelve <input type="color">, para poder comparar).
function gama(nombre) {
  const g = GAMAS.find((x) => x.nombre === nombre);
  return { bg: g.fondo.toLowerCase(), ink: g.tinta.toLowerCase(), ink2: g.deriva.toLowerCase() };
}

// Presets de fábrica: patrón + parámetros + una gama de CAZ.
const CAUCE_PRESETS = [
  {
    name: 'Retrato',
    patternId: 'rings',
    params: { density: 250, amplitude: 6, frequency: 4, thickness: 3, contrast: 0.3, invert: false, modWidth: true, threshold: 0.12, bgTexture: true },
    colors: { mode: 'ink', ...gama('Tinta') },
  },
  {
    name: 'Marca',
    patternId: 'weave',
    params: { density: 90, amplitude: 60, frequency: 22, thickness: 1, contrast: 0.25, invert: false, modWidth: true },
    colors: { mode: 'ink', ...gama('Bruma') },
  },
  {
    name: 'Poza',
    patternId: 'rings',
    params: { density: 90, amplitude: 55, frequency: 12, thickness: 1.2, contrast: 0.2, invert: true, modWidth: true },
    colors: { mode: 'ink', ...gama('Poza') },
  },
  {
    name: 'Dúo',
    patternId: 'waves',
    params: { density: 70, amplitude: 70, frequency: 14, thickness: 1.8, contrast: 0.35, invert: false, modWidth: true },
    colors: { mode: 'duo', ...gama('Vado') },
  },
  {
    name: 'Tinta',
    patternId: 'hatch',
    params: { density: 110, amplitude: 40, frequency: 10, thickness: 0.9, contrast: 0.3, invert: false, modWidth: true },
    colors: { mode: 'ink', ...gama('Tinta') },
  },
  {
    name: 'Noche',
    patternId: 'spiral',
    params: { density: 100, amplitude: 65, frequency: 30, thickness: 1.4, contrast: 0.3, invert: true, modWidth: true },
    colors: { mode: 'ink', ...gama('Noche') },
  },
  {
    name: 'Lluvia',
    patternId: 'rosettes',
    params: { density: 120, amplitude: 60, frequency: 24, thickness: 1.1, contrast: 0.35, invert: false, modWidth: false },
    colors: { mode: 'duo', ...gama('Marea') },
  },
  {
    name: 'Cortina',
    patternId: 'vlines',
    params: { density: 220, amplitude: 10, frequency: 6, thickness: 2.6, contrast: 0.3, invert: false, modWidth: true, threshold: 0.08, bgTexture: false },
    colors: { mode: 'ink', ...gama('Contraluz') },
  },
  {
    name: 'Espejo',
    patternId: 'spiral',
    params: { density: 100, amplitude: 65, frequency: 30, thickness: 1.4, contrast: 0.3, invert: true, modWidth: true },
    colors: { mode: 'ink', ...gama('Lima') },
  },
  {
    name: 'Original',
    patternId: 'rosettes',
    params: { density: 120, amplitude: 60, frequency: 24, thickness: 1.1, contrast: 0.35, invert: false, modWidth: false },
    colors: { mode: 'original', ...gama('Noche') },
  },
];

// Muestras de gama, dibujadas igual que en CAZ.
function buildGamas() {
  const wrap = document.getElementById('gamas');
  for (const g of GAMAS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'gama';
    b.dataset.gama = g.nombre;
    b.title = `${g.nombre} · ${g.tinta} sobre ${g.fondo}`;
    b.innerHTML =
      `<span class="gama-swatch" style="background:linear-gradient(135deg, ${g.tinta} 0 46%, ${g.deriva} 46% 54%, ${g.fondo} 54% 100%)"></span>` +
      `<span class="gama-name">${g.nombre}</span>`;
    b.addEventListener('click', () => {
      Object.assign(state.colors, gama(g.nombre));
      syncColorUI();
      renderIfStatic();
      commitHistory();
    });
    wrap.appendChild(b);
  }
}

const COLOR_FIELDS = [['bg', 'c-bg', 'h-bg'], ['ink', 'c-ink', 'h-ink'], ['ink2', 'c-ink2', 'h-ink2']];

// Pickers, campos hex y gama activa (la que coincide con los tres colores).
function syncColorUI() {
  const c = state.colors;
  for (const [key, cid, hid] of COLOR_FIELDS) {
    document.getElementById(cid).value = c[key];
    const hex = document.getElementById(hid);
    hex.value = c[key].toUpperCase();
    hex.classList.remove('bad');
  }
  document.querySelectorAll('#gamas .gama').forEach((b) => {
    const g = gama(b.dataset.gama);
    b.classList.toggle('active', g.bg === c.bg && g.ink === c.ink && g.ink2 === c.ink2);
  });
}

function syncUI() {
  const p = state.params;
  for (const s of SLIDERS) {
    const v = toUI(s, p[s.key]);
    document.getElementById(s.sid).value = v;
    document.getElementById(s.nid).value = v;
  }
  document.getElementById('p-invert').checked = p.invert;
  document.getElementById('p-modwidth').checked = p.modWidth;
  document.getElementById('p-bgtexture').checked = !!p.bgTexture;
  document.getElementById('p-blend').value = p.blend || 'source-over';
  document.getElementById('p-vignette').checked = !!p.vignette;
  document.getElementById('p-grain').checked = !!p.grain;
  document.getElementById('p-scanlines').checked = !!p.scanlines;
  document.querySelectorAll('#filter-row .btn').forEach((b) =>
    b.classList.toggle('active', b.dataset.filter === (p.srcFilter || 'none'))
  );
  document.getElementById('p-colormode').value = state.colors.mode;
  document.getElementById('wrap-ink2').classList.toggle('hidden', state.colors.mode !== 'duo');
  syncColorUI();
  document.getElementById('p-pattern').value = state.patternId;
}

// ───────────────────── Presets de usuario ─────────────────────
// Guardados con nombre desde la configuración actual. En el artifact
// publicado se comparten con todo el equipo republicando la página
// (capability `artifact`); en local o sin permiso de escritura caen a
// localStorage de este navegador.

const LOCAL_KEY = 'guilloche.userPresets';
let readOnlyShared = false;

function loadSharedPresets() {
  try {
    return JSON.parse(document.getElementById('shared-presets')?.textContent || '[]');
  } catch {
    return [];
  }
}

function loadLocalPresets() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveLocalPresets(list) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
}

let sharedPresets = loadSharedPresets();

function setShareNote(text) {
  const note = document.getElementById('share-note');
  note.textContent = text;
  note.classList.toggle('hidden', !text);
}

// Reconstruye el documento completo desde la plantilla embebida (base64
// con dos huecos: el JSON de presets y la propia plantilla) y lo publica
// como nueva versión del artifact. Tras publicar, el visor recarga.
async function persistShared(list) {
  if (!window.claude?.use || readOnlyShared) return false;
  const tplEl = document.getElementById('page-tpl');
  if (!tplEl) return false;
  try {
    const artifact = await window.claude.use('artifact');
    if (!artifact) return false;
    const b64 = tplEl.textContent.trim();
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const tpl = new TextDecoder().decode(bytes);
    const json = JSON.stringify(list).replace(/</g, '\\u003c');
    // Los huecos van anclados a su atributo id y el token se construye en
    // runtime: así nunca aparece literal dentro de este código y la
    // sustitución no puede morder el propio JS embebido en la plantilla.
    const hole = (s) => `__${s}__`;
    const html = tpl
      .replace('id="shared-presets">' + hole('PRESETS'), () => 'id="shared-presets">' + json)
      .replace('id="page-tpl">' + hole('TPL64'), () => 'id="page-tpl">' + b64);
    stashSession();
    await artifact.publish(html);
    return true; // el visor recarga a la nueva versión
  } catch (err) {
    if (err?.code === 'conflict') return true; // otra versión ganó; recarga en curso
    if (err?.code === 'not_writer' || err?.code === 'not_granted') {
      readOnlyShared = true;
      setShareNote('Sin permiso de edición en el artifact: los presets se guardan solo en este navegador.');
    }
    return false;
  }
}

function applyUserPreset(preset) {
  state.patternId = preset.patternId;
  state.params = { ...state.params, ...preset.params };
  state.colors = { ...state.colors, ...preset.colors };
  syncUI();
  renderIfStatic();
  commitHistory();
}

// los presets Cauce no tocan el centro ni las capas elegidas por el usuario
function applyCaucePreset(preset) {
  state.patternId = preset.patternId;
  state.params = {
    threshold: 0,
    bgTexture: false,
    ...preset.params,
    cx: state.params.cx,
    cy: state.params.cy,
    fxOpacity: state.params.fxOpacity,
    blend: state.params.blend,
    srcOpacity: state.params.srcOpacity,
    srcBlur: state.params.srcBlur,
    srcFilter: state.params.srcFilter,
    vignette: state.params.vignette,
    grain: state.params.grain,
    scanlines: state.params.scanlines,
  };
  state.colors = { ...preset.colors };
  syncUI();
  renderIfStatic();
}

// Select único con optgroups: Cauce / Compartidos / Locales.
// Las claves de opción son "cauce:<nombre>", "shared:<nombre>", "local:<nombre>".
function renderPresetSelect() {
  const sel = document.getElementById('preset-select');
  const previous = sel.value;
  sel.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Elegir preset…';
  sel.appendChild(placeholder);
  const groups = [
    ['Cauce', CAUCE_PRESETS.map((p) => [`cauce:${p.name}`, p.name])],
    ['Compartidos', sharedPresets.map((p) => [`shared:${p.name}`, p.name])],
    ['Locales', loadLocalPresets().map((p) => [`local:${p.name}`, `${p.name} ·`])],
  ];
  for (const [title, items] of groups) {
    if (!items.length) continue;
    const og = document.createElement('optgroup');
    og.label = title;
    for (const [value, label] of items) {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      og.appendChild(opt);
    }
    sel.appendChild(og);
  }
  sel.value = previous && sel.querySelector(`option[value='${CSS.escape(previous)}']`) ? previous : '';
  updateDeleteButton();
}

function updateDeleteButton() {
  const key = document.getElementById('preset-select').value;
  const deletable = key.startsWith('shared:') || key.startsWith('local:');
  document.getElementById('btn-delete-preset').disabled = !deletable;
}

function wirePresetSelect() {
  const sel = document.getElementById('preset-select');
  sel.addEventListener('change', () => {
    const key = sel.value;
    if (!key) return;
    const i = key.indexOf(':');
    const kind = key.slice(0, i);
    const name = key.slice(i + 1);
    if (kind === 'cauce') {
      const preset = CAUCE_PRESETS.find((p) => p.name === name);
      if (preset) {
        applyCaucePreset(preset);
        commitHistory();
      }
    } else {
      const list = kind === 'shared' ? sharedPresets : loadLocalPresets();
      const preset = list.find((p) => p.name === name);
      if (preset) applyUserPreset(preset); // ya hace commitHistory
    }
  });
  document.getElementById('btn-delete-preset').addEventListener('click', async () => {
    const key = sel.value;
    if (!key.startsWith('shared:') && !key.startsWith('local:')) return;
    const i = key.indexOf(':');
    const kind = key.slice(0, i);
    const name = key.slice(i + 1);
    if (kind === 'shared') {
      const next = sharedPresets.filter((p) => p.name !== name);
      if (await persistShared(next)) return; // la página recarga sin el preset
      setShareNote('No se pudo borrar el preset compartido.');
      renderPresetSelect();
    } else {
      saveLocalPresets(loadLocalPresets().filter((p) => p.name !== name));
      renderPresetSelect();
    }
  });
}

async function saveUserPreset() {
  const input = document.getElementById('preset-name');
  const name = input.value.trim();
  if (!name) {
    input.focus();
    return;
  }
  const preset = {
    name,
    patternId: state.patternId,
    params: { ...state.params },
    colors: { ...state.colors },
  };
  const btn = document.getElementById('btn-save-preset');
  btn.disabled = true;
  btn.textContent = 'Guardando…';
  const next = [...sharedPresets.filter((p) => p.name !== name), preset];
  const shared = await persistShared(next);
  btn.disabled = false;
  btn.textContent = 'Guardar';
  if (shared) return; // la página recarga con el preset ya compartido
  saveLocalPresets([...loadLocalPresets().filter((p) => p.name !== name), preset]);
  input.value = '';
  renderPresetSelect();
  if (!readOnlyShared && !window.claude?.use) {
    setShareNote('Guardado en este navegador. En la versión publicada se comparte con el equipo.');
  }
}

// ─────────── Exportar / importar presets como archivo ───────────
// Descarga todos los presets (compartidos + locales) en un JSON;
// cargar fusiona un JSON así por nombre en los presets locales.

function exportPresets() {
  const byName = new Map();
  for (const p of sharedPresets) byName.set(p.name, p);
  for (const p of loadLocalPresets()) byName.set(p.name, p);
  const payload = { version: 1, presets: [...byName.values()] };
  download(
    new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
    'guilloche-presets.json'
  );
}

function importPresets(file) {
  file.text().then((text) => {
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      setShareNote('El archivo no es un JSON válido.');
      return;
    }
    const list = Array.isArray(data) ? data : data?.presets;
    if (!Array.isArray(list)) {
      setShareNote('El archivo no contiene presets.');
      return;
    }
    const valid = list.filter(
      (p) =>
        p &&
        typeof p.name === 'string' &&
        typeof p.patternId === 'string' &&
        PATTERNS.some((q) => q.id === p.patternId) &&
        p.params && typeof p.params === 'object' &&
        p.colors && typeof p.colors === 'object'
    );
    if (!valid.length) {
      setShareNote('No se encontró ningún preset válido en el archivo.');
      return;
    }
    const names = new Set(valid.map((p) => p.name));
    const merged = [...loadLocalPresets().filter((p) => !names.has(p.name)), ...valid];
    saveLocalPresets(merged);
    renderPresetSelect();
    setShareNote(`${valid.length} ${valid.length === 1 ? 'preset importado' : 'presets importados'} a este navegador.`);
  });
}

// ─────────── Stash: sobrevivir a la recarga tras publicar ───────────
// Publicar una nueva versión recarga la vista; guardamos configuración
// e imagen (no video) para restaurarlas al volver.

function stashSession() {
  try {
    const stash = {
      patternId: state.patternId,
      params: state.params,
      colors: state.colors,
    };
    if (state.source?.type === 'image') {
      const off = document.createElement('canvas');
      off.width = canvas.width;
      off.height = canvas.height;
      off.getContext('2d').drawImage(state.source.el, 0, 0, off.width, off.height);
      const data = off.toDataURL('image/jpeg', 0.8);
      if (data.length < 3_000_000) stash.imgData = data;
    }
    sessionStorage.setItem('guilloche.stash', JSON.stringify(stash));
  } catch {
    // sin sitio en sessionStorage: se pierde solo la restauración
  }
}

function restoreStash() {
  let stash = null;
  try {
    stash = JSON.parse(sessionStorage.getItem('guilloche.stash') || 'null');
    sessionStorage.removeItem('guilloche.stash');
  } catch {}
  if (!stash) return false;
  state.patternId = stash.patternId || state.patternId;
  state.params = { ...state.params, ...stash.params };
  state.colors = { ...state.colors, ...stash.colors };
  syncUI();
  if (stash.imgData) {
    const img = new Image();
    img.onload = () => setImageSource(img);
    img.src = stash.imgData;
    return true;
  }
  return false;
}

// ─────────────────────────── Init ───────────────────────────

buildPatternSelect();
buildGamas();
syncColorUI();
wirePresetSelect();
renderPresetSelect();
wireControls();
document.getElementById('p-pattern').addEventListener('change', (e) => {
  selectPattern(e.target.value);
  commitHistory();
});
document.getElementById('btn-play').addEventListener('click', togglePlay);
document.getElementById('btn-export-png').addEventListener('click', exportPNG);
document.getElementById('png-scale').addEventListener('click', (e) => {
  const b = e.target.closest('[data-scale]');
  if (!b) return;
  pngScale = parseInt(b.dataset.scale, 10);
  document.querySelectorAll('#png-scale button').forEach((x) => x.classList.toggle('active', x === b));
});
document.getElementById('btn-export-svg').addEventListener('click', exportSVG);
document.getElementById('btn-record').addEventListener('click', toggleRecord);
document.getElementById('btn-save-preset').addEventListener('click', saveUserPreset);
document.getElementById('btn-export-presets').addEventListener('click', exportPresets);
document.getElementById('btn-import-presets').addEventListener('click', () =>
  document.getElementById('presets-file-input').click()
);
document.getElementById('presets-file-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) importPresets(file);
  e.target.value = '';
});
document.getElementById('btn-undo').addEventListener('click', undoHistory);
document.getElementById('btn-redo').addEventListener('click', redoHistory);
document.addEventListener('keydown', (e) => {
  const t = e.target;
  const typing = t instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !typing) {
    e.preventDefault();
    if (e.shiftKey) redoHistory();
    else undoHistory();
    return;
  }
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === ' ') {
    e.preventDefault(); // sin scroll de página ni click nativo del botón enfocado
    togglePlay();
    return;
  }
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= PATTERNS.length) {
    selectPattern(PATTERNS[n - 1].id);
    commitHistory();
  }
});
history = [snapshot()];
historyIndex = 0;
document.getElementById('preset-name').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveUserPreset();
});
if (!restoreStash()) demoImage();

// Hook de depuración (inspección desde la consola)
window.__guilloche = state;
