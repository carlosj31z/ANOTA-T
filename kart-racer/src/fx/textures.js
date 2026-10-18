// BLOQUE 7 — Texturas procedurales para las partículas.
// Un único atlas 4×4 (CanvasTexture) con todas las formas: chispa, llama, humo
// (4 variantes fBm), estrella, destello en cruz, confeti, glow, estela, anillo,
// guijarro, centelleo, burbuja y suave. Se compone una sola vez y se cachea a
// nivel de módulo. Sin archivos externos: todo se calcula por código.

import * as THREE from 'three';

export const GRID = 4;

// Índices de tile dentro del atlas (fila-major: ty*GRID + tx).
export const TILE = {
  SPARK: 0,
  FLAME: 1,
  SMOKE_A: 2,
  SMOKE_B: 3,
  SMOKE_C: 4,
  SMOKE_D: 5,
  STAR: 6,
  CROSS: 7,
  CONFETTI: 8,
  GLOW: 9,
  STREAK: 10,
  RING: 11,
  PEBBLE: 12,
  SPARKLE: 13,
  BUBBLE: 14,
  SOFT: 15,
};

// ---------------------------------------------------------------
// Ruido de valor + fBm (hash sin asignaciones).
// ---------------------------------------------------------------
function hash2(x, y) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function vnoise(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x, y, oct) {
  let s = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < oct; i++) {
    s += amp * vnoise(x * f, y * f);
    f *= 2;
    amp *= 0.5;
  }
  return s;
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// Salida compartida de cada función de tile (evita asignar por píxel).
let _r = 0;
let _g = 0;
let _b = 0;
let _a = 0;

function setPx(r, g, b, a) {
  _r = r;
  _g = g;
  _b = b;
  _a = a;
}

// ---------------------------------------------------------------
// Generadores por tile (u,v en 0..1, origen arriba-izquierda).
// ---------------------------------------------------------------
function tSpark(u, v) {
  const dx = (u - 0.5) / 0.17;
  const dy = (v - 0.5) / 0.5;
  const d = Math.sqrt(dx * dx + dy * dy);
  let a = clamp01(1 - d);
  a = a * a * Math.sqrt(a);
  const core = clamp01(1 - Math.sqrt(((u - 0.5) / 0.075) ** 2 + ((v - 0.5) / 0.3) ** 2));
  const lum = 0.55 + 0.45 * core;
  setPx(lum, lum, lum, a);
}

function tFlame(u, v) {
  const t = clamp01(1 - v); // 0 base (abajo), 1 punta (arriba)
  const half = 0.44 * (1 - 0.82 * t) + 0.05;
  const dx = (u - 0.5) / half;
  const dy = (v - 0.66) / 0.5;
  const d = Math.sqrt(dx * dx + dy * dy);
  let a = clamp01(1 - d);
  a = a * a;
  const n = fbm(u * 5.5 + 3.1, v * 7.5 + 1.7, 3);
  a *= 0.55 + 0.9 * n;
  a = clamp01(a);
  const b = clamp01(1 - d);
  const lum = 0.65 + 0.35 * b;
  setPx(lum, lum, lum, a);
}

function smokeTile(scale, sx, sy, contrast) {
  return function (u, v) {
    const r = Math.sqrt((u - 0.5) ** 2 + (v - 0.5) ** 2);
    const n = fbm(u * scale + sx, v * scale + sy, 4);
    let a = clamp01(1 - r * 1.7) * (0.5 - contrast * 0.5 + (0.5 + contrast * 0.5) * n);
    a = clamp01(a);
    a = a * a * (3 - 2 * a);
    const lum = 0.82 + 0.18 * n;
    setPx(lum, lum, lum, a);
  };
}

function tStar(u, v) {
  const px = u - 0.5;
  const py = v - 0.5;
  let acc = 0;
  for (let i = 0; i < 5; i++) {
    const th = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const c = Math.cos(th);
    const s = Math.sin(th);
    const proj = px * c + py * s;
    const perp = -px * s + py * c;
    const spike = Math.exp(-(perp * perp) / 0.0042) * Math.max(0, proj);
    if (spike > acc) acc = spike;
  }
  const glow = clamp01(1 - Math.sqrt(px * px + py * py) / 0.22);
  let a = Math.max(clamp01(acc * 3.2), glow * glow);
  a = clamp01(a);
  setPx(1, 1, 1, a);
}

function tCross(u, v) {
  const px = u - 0.5;
  const py = v - 0.5;
  const h = Math.exp(-(py * py) / 0.0016) * Math.exp(-(px * px) / 0.42);
  const w = Math.exp(-(px * px) / 0.0016) * Math.exp(-(py * py) / 0.42);
  const glow = clamp01(1 - Math.sqrt(px * px + py * py) / 0.18);
  const a = clamp01(h + w + glow * glow * 1.2);
  setPx(1, 1, 1, a);
}

function tConfetti(u, v) {
  const ex = clamp01((0.4 - Math.abs(u - 0.5)) / 0.05);
  const ey = clamp01((0.28 - Math.abs(v - 0.5)) / 0.05);
  const a = ex * ey;
  const lum = 0.72 + 0.28 * (1 - v);
  setPx(lum, lum, lum, a);
}

function tGlow(u, v) {
  const r = Math.sqrt((u - 0.5) ** 2 + (v - 0.5) ** 2) * 2;
  let a = clamp01(1 - r);
  a = a * a * a;
  setPx(1, 1, 1, a);
}

function tStreak(u, v) {
  const py = v - 0.5;
  const edge = Math.abs(u - 0.5) / 0.5;
  let a = Math.exp(-(py * py) / 0.0014) * Math.pow(clamp01(1 - edge), 0.6);
  a = clamp01(a);
  setPx(1, 1, 1, a);
}

function tRing(u, v) {
  const r = Math.sqrt((u - 0.5) ** 2 + (v - 0.5) ** 2);
  const a = clamp01((r - 0.29) / 0.05) * clamp01((0.46 - r) / 0.06);
  setPx(1, 1, 1, a);
}

function tPebble(u, v) {
  const r = Math.sqrt((u - 0.5) ** 2 + (v - 0.5) ** 2);
  const n = fbm(u * 5 + 11.3, v * 5 + 7.9, 3);
  let a = clamp01((0.32 - r + (n - 0.5) * 0.16) * 9);
  a = a * a * (3 - 2 * a);
  const lum = 0.66 + 0.34 * n;
  setPx(lum, lum, lum, a);
}

function tSparkle(u, v) {
  const px = u - 0.5;
  const py = v - 0.5;
  const h = Math.exp(-(py * py) / 0.0006) * clamp01(1 - Math.abs(px) / 0.42);
  const w = Math.exp(-(px * px) / 0.0006) * clamp01(1 - Math.abs(py) / 0.42);
  const glow = clamp01(1 - Math.sqrt(px * px + py * py) / 0.14);
  const a = clamp01(h + w + glow * glow);
  setPx(1, 1, 1, a);
}

function tBubble(u, v) {
  const px = u - 0.5;
  const py = v - 0.5;
  const r = Math.sqrt(px * px + py * py);
  const body = clamp01((0.47 - r) / 0.05);
  const rim = Math.exp(-((r - 0.4) ** 2) / 0.0016);
  const hi = Math.exp(-(((u - 0.37) ** 2 + (v - 0.37) ** 2)) / 0.006);
  const lum = 0.55 + 0.45 * rim + 0.6 * hi;
  setPx(Math.min(lum, 1), Math.min(lum, 1), Math.min(lum, 1), clamp01(body * 0.9));
}

function tSoft(u, v) {
  const r = Math.sqrt((u - 0.5) ** 2 + (v - 0.5) ** 2) * 2;
  const a = clamp01(1 - r);
  setPx(1, 1, 1, a * a);
}

const TILE_FNS = [
  tSpark,
  tFlame,
  smokeTile(3.2, 1.3, 5.1, 0.65),
  smokeTile(4.0, 7.7, 2.9, 0.7),
  smokeTile(5.2, 4.4, 9.2, 0.8),
  smokeTile(2.6, 12.1, 3.3, 0.55),
  tStar,
  tCross,
  tConfetti,
  tGlow,
  tStreak,
  tRing,
  tPebble,
  tSparkle,
  tBubble,
  tSoft,
];

let _atlas = null;

// Construye (una vez) el atlas y lo devuelve como THREE.CanvasTexture.
export function getAtlasTexture() {
  if (_atlas) return _atlas;
  const S = 1024;
  const tiles = GRID;
  const T = S / tiles;
  const cvs = document.createElement('canvas');
  cvs.width = S;
  cvs.height = S;
  const ctx = cvs.getContext('2d');
  const img = ctx.createImageData(S, S);
  const data = img.data;

  for (let ty = 0; ty < tiles; ty++) {
    for (let tx = 0; tx < tiles; tx++) {
      const idx = ty * tiles + tx;
      const fn = TILE_FNS[idx];
      if (!fn) continue;
      for (let y = 0; y < T; y++) {
        const v = (y + 0.5) / T;
        for (let x = 0; x < T; x++) {
          const u = (x + 0.5) / T;
          fn(u, v);
          const p = (((ty * T + y) * S) + (tx * T + x)) * 4;
          data[p] = (_r * 255) | 0;
          data[p + 1] = (_g * 255) | 0;
          data[p + 2] = (_b * 255) | 0;
          data[p + 3] = (_a * 255) | 0;
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(cvs);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.flipY = false;
  tex.needsUpdate = true;
  _atlas = tex;
  return tex;
}
