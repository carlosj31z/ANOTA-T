// BLOQUE 1 — CIRCUITOS. Texturas procedurales (CanvasTexture / DataTexture).
// Contrato §0: todo generado por código, sin archivos externos.
// Todas las texturas son tileables (ruido periódico) para poder repetirse sin costuras.

import * as THREE from 'three';
import { mulberry32, hash2, valueNoise2, fbm2 } from './procgen.js';

// --- PRNG determinista (re-exportado por compatibilidad) ---
export { mulberry32 };

// Anisotropía global de las texturas del bloque. El renderer la puede subir
// (renderer.capabilities.getMaxAnisotropy()); si no hay renderer se usa 8.
let _maxAniso = 8;
export function setMaxAnisotropy(v) {
  const n = typeof v === 'number' && isFinite(v) ? v : 8;
  _maxAniso = Math.max(1, Math.min(16, Math.floor(n) || 8));
}
export function getMaxAnisotropy() {
  return _maxAniso;
}

// Ajustes comunes de filtrado: mipmaps trilineales + anisotropía alta para
// evitar aliasing/parpadeo en el suelo visto en perspectiva (contrato §9.2).
function configureTex(t, srgb = true, repeat = true) {
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = _maxAniso;
  t.needsUpdate = true;
  return t;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext('2d') };
}

export function canvasTex(w, h, draw, opts = {}) {
  const { c, ctx } = makeCanvas(w, h);
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  configureTex(t, opts.srgb !== false, !!opts.repeat);
  if (typeof opts.anisotropy === 'number') t.anisotropy = opts.anisotropy;
  return t;
}

// --- Ruido periódico (tileable) de valor 2D ---
function phash(ix, iy, seed) {
  const s = Math.sin(ix * 127.1 + iy * 311.7 + seed * 74.7) * 43758.5453123;
  return s - Math.floor(s);
}
function pnoise(x, y, period, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const wrap = (i, p) => ((i % p) + p) % p;
  const a = phash(wrap(xi, period), wrap(yi, period), seed);
  const b = phash(wrap(xi + 1, period), wrap(yi, period), seed);
  const c = phash(wrap(xi, period), wrap(yi + 1, period), seed);
  const d = phash(wrap(xi + 1, period), wrap(yi + 1, period), seed);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}
function tfbm(u, v, baseFreq, octaves, seed) {
  let s = 0;
  let amp = 1;
  let f = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    const period = baseFreq * f;
    s += amp * pnoise(u * period, v * period, period, seed + o * 13);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return s / norm;
}

// --- Normal map a partir de un campo de altura (Float32) ---
function normalMapFromHeight(H, size, strength) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const l = H[y * size + ((x - 1 + size) % size)];
      const r = H[y * size + ((x + 1) % size)];
      const d = H[((y - 1 + size) % size) * size + x];
      const u = H[((y + 1) % size) * size + x];
      let nx = (l - r) * strength;
      let ny = (d - u) * strength;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      nz /= len;
      const i = (y * size + x) * 4;
      data[i] = (nx * 0.5 + 0.5) * 255;
      data[i + 1] = (ny * 0.5 + 0.5) * 255;
      data[i + 2] = (nz * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.colorSpace = THREE.NoColorSpace;
  configureTex(tex, false, true);
  return tex;
}

function grayMapFromField(F, size, lo = 0, hi = 1) {
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const v = Math.round((lo + (hi - lo) * F[i]) * 255);
    data[i * 4] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.colorSpace = THREE.NoColorSpace;
  configureTex(tex, false, true);
  return tex;
}

// =====================================================================
// ASFALTO: color 1024², normal y roughness derivados. Áridos suaves, grietas
// tenues, manchas de neumático y zonas pulidas. Frecuencia de detalle
// moderada + mipmaps/anisotropía para que no parpadee en perspectiva.
// =====================================================================
export function asphaltMaps(size = 1024, seed = 1, opts = {}) {
  const rnd = mulberry32(seed);
  const H = new Float32Array(size * size);
  const R = new Float32Array(size * size);
  const maskPolish = new Float32Array(size * size); // 1 = zona pulida
  const tint = opts.tint || [1, 1, 1];
  const wet = opts.wet ?? 0; // 0..1: asfalto frío y algo húmedo

  // Grano de media frecuencia (nada de micro-detalle: evita parpadeo).
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const fine = tfbm(u, v, 46, 2, seed + 1);
      const med = tfbm(u, v, 13, 3, seed + 3);
      const i = y * size + x;
      H[i] = fine * 0.55 + med * 0.45;
      // Rugosidad alta pero bastante uniforme (sin contraste duro).
      R[i] = 0.8 + med * 0.14;
    }
  }

  // Áridos suaves (pocos, redondeados) que rompen la superficie sin brillar.
  const pebbles = Math.floor(size * 2.2);
  for (let p = 0; p < pebbles; p++) {
    const cx = Math.floor(rnd() * size);
    const cy = Math.floor(rnd() * size);
    const rad = 1.4 + rnd() * 2.6;
    const peak = 0.16 + rnd() * 0.28;
    const r2 = rad * rad;
    for (let dy = -Math.ceil(rad); dy <= rad; dy++) {
      for (let dx = -Math.ceil(rad); dx <= rad; dx++) {
        const d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        const x = (cx + dx + size) % size;
        const y = (cy + dy + size) % size;
        const fall = 1 - d2 / r2;
        H[y * size + x] += peak * fall * fall;
      }
    }
  }

  // Grietas tenues: paseos aleatorios poco profundos.
  const cracks = 4;
  for (let c = 0; c < cracks; c++) {
    let x = rnd() * size;
    let y = rnd() * size;
    let ang = rnd() * Math.PI * 2;
    const steps = 50 + Math.floor(rnd() * 70);
    for (let s = 0; s < steps; s++) {
      ang += (rnd() - 0.5) * 0.6;
      x += Math.cos(ang) * 2.4;
      y += Math.sin(ang) * 2.4;
      const xi = ((Math.floor(x) % size) + size) % size;
      const yi = ((Math.floor(y) % size) + size) % size;
      const i = yi * size + xi;
      H[i] -= 0.28;
      R[i] = Math.min(1, R[i] + 0.12);
      for (let k = 0; k < 2; k++) {
        const j = ((yi + (k ? 1 : -1)) * size + xi + size) % (size * size);
        if (H[j] !== undefined) H[j] -= 0.12;
      }
    }
  }

  // Manchas de neumático (bandas a lo largo de v, u constante).
  const bandCount = 4;
  for (let b = 0; b < bandCount; b++) {
    const uc = 0.16 + rnd() * 0.68;
    const hw = 0.03 + rnd() * 0.05;
    for (let y = 0; y < size; y++) {
      const wob = Math.sin(y * 0.01 + b * 2) * 0.02;
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const d = Math.abs(u - (uc + wob));
        if (d < hw) {
          const t = 1 - d / hw;
          maskPolish[y * size + x] = Math.max(
            maskPolish[y * size + x],
            t * (0.5 + 0.5 * tfbm(u, y / size, 8, 3, seed + 9))
          );
        }
      }
    }
  }
  for (let i = 0; i < size * size; i++) {
    const pol = maskPolish[i];
    if (pol > 0) {
      // Zonas rodadas: un poco más lisas (más reflejo), sin contraste extremo.
      R[i] = R[i] * (1 - 0.35 * pol) - wet * 0.18 * pol;
      if (R[i] < 0.18) R[i] = 0.18;
      H[i] *= 1 - 0.16 * pol;
    }
  }

  // Color: gris asfáltico con variación, grietas tenues y bandas.
  const { c, ctx } = makeCanvas(size, size);
  const base = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    let g = 76 + H[i] * 36;
    g *= 1 - 0.34 * maskPolish[i];
    g = Math.max(0, Math.min(255, g));
    base.data[i * 4] = Math.max(0, Math.min(255, g * tint[0]));
    base.data[i * 4 + 1] = Math.max(0, Math.min(255, g * tint[1]));
    base.data[i * 4 + 2] = Math.max(0, Math.min(255, g * tint[2]));
    base.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(base, 0, 0);

  const map = new THREE.CanvasTexture(c);
  configureTex(map, true, true);

  const normalMap = normalMapFromHeight(H, size, 1.35);
  const roughnessMap = grayMapFromField(R, size, 0, 1);
  return { map, normalMap, roughnessMap };
}

// =====================================================================
// BORDILLO: franjas rojo/blanco con relieve y desgaste.
// =====================================================================
export function curbMaps(a = '#e23b2f', b = '#f2f2f2', seed = 5) {
  const W = 64;
  const Hh = 256;
  const { c, ctx } = makeCanvas(W, Hh);
  const rnd = mulberry32(seed);
  const blocks = 8;
  const bh = Hh / blocks;
  for (let i = 0; i < blocks; i++) {
    ctx.fillStyle = i % 2 === 0 ? a : b;
    ctx.fillRect(0, i * bh, W, bh);
  }
  // desgaste: manchas y arañazos
  for (let i = 0; i < 700; i++) {
    ctx.globalAlpha = 0.05 + rnd() * 0.18;
    ctx.fillStyle = rnd() < 0.5 ? '#000000' : '#ffffff';
    const x = rnd() * W;
    const y = rnd() * Hh;
    ctx.fillRect(x, y, 1 + rnd() * 10, 1 + rnd() * 2);
  }
  ctx.globalAlpha = 1;
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 8;
  map.needsUpdate = true;

  // Altura: cada bloque es una loma redondeada con juntas hundidas.
  const Hf = new Float32Array(W * Hh);
  for (let y = 0; y < Hh; y++) {
    const inBlock = (y % bh) / bh;
    const dome = Math.sin(inBlock * Math.PI);
    for (let x = 0; x < W; x++) {
      const edge = Math.sin((x / W) * Math.PI);
      Hf[y * W + x] = dome * (0.6 + 0.4 * edge) + (rnd() - 0.5) * 0.06;
    }
  }
  const normalMap = normalMapFromHeight(Hf, W, 1.4);
  return { map, normalMap };
}

// =====================================================================
// TERRENO: normal de detalle tileable según bioma.
// kind: 'grass' | 'sand' | 'snow' | 'rock'
// =====================================================================
export function terrainNormal(kind, size = 256, seed = 3) {
  const H = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      let h;
      if (kind === 'sand') {
        // ondulaciones de viento direccionales
        const rip = Math.sin((u * 22 + tfbm(u, v, 8, 3, seed) * 6) * Math.PI);
        h = rip * 0.5 + tfbm(u, v, 40, 3, seed + 2) * 0.5;
      } else if (kind === 'snow') {
        // alta frecuencia = brillo (sparkle) + base suave
        h = tfbm(u, v, 90, 4, seed) * 0.5 + tfbm(u, v, 12, 2, seed + 4) * 0.5;
      } else if (kind === 'rock') {
        h = tfbm(u, v, 16, 4, seed) * 0.7 + tfbm(u, v, 60, 3, seed + 1) * 0.3;
      } else {
        // hierba: matas finas
        h = tfbm(u, v, 70, 4, seed) * 0.6 + tfbm(u, v, 14, 3, seed + 5) * 0.4;
      }
      H[y * size + x] = h;
    }
  }
  const strength = kind === 'sand' ? 1.6 : kind === 'snow' ? 1.1 : 1.8;
  return normalMapFromHeight(H, size, strength);
}

// =====================================================================
// AGUA: dos normal maps tileables que se animan (dos capas).
// =====================================================================
export function waterNormalMaps(size = 256, seed = 7) {
  const make = (s, freq, oct) => {
    const H = new Float32Array(size * size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        H[y * size + x] = tfbm(x / size, y / size, freq, oct, s);
      }
    }
    return normalMapFromHeight(H, size, 1.3);
  };
  return { n1: make(seed, 10, 4), n2: make(seed + 17, 4, 3) };
}

// =====================================================================
// CORTEZA: color marrón con vetas verticales + normal.
// =====================================================================
export function barkMaps(size = 256, seed = 2) {
  const rnd = mulberry32(seed);
  const { c, ctx } = makeCanvas(size, size);
  ctx.fillStyle = '#5a4028';
  ctx.fillRect(0, 0, size, size);
  const H = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const streak = tfbm(u * 3, v, 6, 4, seed) * 0.8 + tfbm(u, v * 6, 20, 2, seed + 3) * 0.2;
      H[y * size + x] = streak;
      const g = 60 + streak * 70;
      // vetas verticales
      const vx = Math.sin(u * 40 + streak * 8) * 0.5 + 0.5;
      ctx.fillStyle = `rgb(${Math.floor(g * (0.9 + vx * 0.2))},${Math.floor(g * 0.66)},${Math.floor(g * 0.42)})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 4;
  map.needsUpdate = true;
  const normalMap = normalMapFromHeight(H, size, 1.6);
  return { map, normalMap };
}

// =====================================================================
// CIELO EQUIRECTANGULAR (respaldo de entorno PBR e iluminación).
// Genera un degradado vertical + halo de sol, listo para scene.environment.
// =====================================================================
export function equirectSky(opts) {
  const {
    size = 1024,
    stops = [[0, '#2a4f9f'], [0.5, '#8fc6ff'], [1, '#eaf6ff']],
    sunDir = [0.4, 0.5, 0.3],
    sunColor = '#fff4d6',
    glow = 0.7,
  } = opts || {};
  const W = size;
  const H = size / 2;
  const { c, ctx } = makeCanvas(W, H);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  for (const [p, col] of stops) g.addColorStop(p, col);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Halo del sol en su dirección equirectangular.
  const d = new THREE.Vector3(sunDir[0], sunDir[1], sunDir[2]).normalize();
  const u = 0.5 + Math.atan2(d.z, d.x) / (Math.PI * 2);
  const v = 0.5 - Math.asin(Math.max(-1, Math.min(1, d.y))) / Math.PI;
  const sx = u * W;
  const sy = v * H;
  const rad = W * 0.22;
  const rg = ctx.createRadialGradient(sx, sy, 0, sx, sy, rad);
  rg.addColorStop(0, sunColor);
  rg.addColorStop(0.12, 'rgba(255,246,214,0.85)');
  rg.addColorStop(0.5, 'rgba(255,240,200,0.18)');
  rg.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.globalAlpha = glow;
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// =====================================================================
// Utilidades viales: líneas, cuadros, chevrones, flechas, pancartas.
// =====================================================================

// Cuadros blanco/negro (línea de meta y pancartas).
export function checkerTex(cells = 8, a = '#f4f4f4', b = '#1a1a1a') {
  return canvasTex(cells * 16, cells * 16, (ctx, w, h) => {
    const cs = w / cells;
    for (let y = 0; y < cells; y++) {
      for (let x = 0; x < cells; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? a : b;
        ctx.fillRect(x * cs, y * cs, cs, cs);
      }
    }
  });
}

// Bordillos rojo/blanco (compatibilidad; la versión PBR usa curbMaps).
export function curbTex(a = '#e23b2f', b = '#f2f2f2') {
  return canvasTex(16, 64, (ctx, w, h) => {
    ctx.fillStyle = a;
    ctx.fillRect(0, 0, w, h / 2);
    ctx.fillStyle = b;
    ctx.fillRect(0, h / 2, w, h / 2);
  }, { repeat: true });
}

// Textura de suelo con grano (compatibilidad).
export function grainTex(base, light, dark, seed = 1, dots = 2600) {
  const rnd = mulberry32(seed);
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < dots; i++) {
      const x = rnd() * w;
      const y = rnd() * h;
      const r = 0.6 + rnd() * 2.4;
      const c = rnd() < 0.5 ? light : dark;
      ctx.globalAlpha = 0.16 + rnd() * 0.28;
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }, { repeat: true });
}

// Placa de turbo: chevrones brillantes sobre transparente (se anima el offset).
export function boostTex(colorA = '#39d0ff', colorB = '#ffffff') {
  return canvasTex(64, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const chev = (y0, alpha) => {
      ctx.beginPath();
      ctx.moveTo(6, y0);
      ctx.lineTo(w / 2, y0 - 22);
      ctx.lineTo(w - 6, y0);
      ctx.lineTo(w / 2, y0 - 8);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, y0 - 22, 0, y0);
      g.addColorStop(0, colorB);
      g.addColorStop(1, colorA);
      ctx.fillStyle = g;
      ctx.globalAlpha = alpha;
      ctx.fill();
    };
    chev(52, 0.55);
    chev(86, 0.8);
    chev(120, 1);
    ctx.globalAlpha = 1;
  }, { repeat: true });
}

// Flecha de rampa (una sola chevron, transparente).
export function arrowTex(color = '#ffe14d', glow = '#ff9c1f') {
  return canvasTex(64, 64, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.beginPath();
    ctx.moveTo(8, 46);
    ctx.lineTo(w / 2, 14);
    ctx.lineTo(w - 8, 46);
    ctx.lineTo(w / 2, 32);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 14, 0, 46);
    g.addColorStop(0, '#fffbe0');
    g.addColorStop(0.5, color);
    g.addColorStop(1, glow);
    ctx.fillStyle = g;
    ctx.fill();
  }, { repeat: true });
}

// Pancarta de meta con el nombre del circuito.
export function bannerTex(title, bg = '#c8362b', accent = '#ffd23f') {
  return canvasTex(1024, 256, (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, w, 18);
    ctx.fillRect(0, h - 18, w, 18);
    const cs = 24;
    for (let y = 0; y < 2; y++) {
      for (let i = 0; i < w / cs; i++) {
        ctx.fillStyle = (i + y) % 2 === 0 ? '#f4f4f4' : '#1a1a1a';
        ctx.fillRect(i * cs, y * cs, cs, cs);
        ctx.fillRect(i * cs, h - (y + 1) * cs, cs, cs);
      }
    }
    ctx.font = '900 128px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.strokeText(title.toUpperCase(), w / 2, h / 2 + 6);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(title.toUpperCase(), w / 2, h / 2 + 6);
  });
}

// Pintura vial ligeramente gastada: color plano con desgaste (alfa variable).
export function wornPaintTex(color = '#f2f2f2', seed = 17) {
  const rnd = mulberry32(seed);
  return canvasTex(256, 64, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    // desgaste: borrones que revelan el asfalto
    for (let i = 0; i < 320; i++) {
      ctx.globalAlpha = 0.06 + rnd() * 0.22;
      ctx.clearRect(rnd() * w, rnd() * h, 2 + rnd() * 16, 1 + rnd() * 4);
    }
    // grietas finas
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(0,0,0,0.0)';
    ctx.globalAlpha = 1;
  }, { repeat: true });
}

// Mapa alfa de desgaste (para líneas y cuadros de meta).
export function wearAlphaTex(seed = 19) {
  const rnd = mulberry32(seed);
  return canvasTex(256, 64, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) {
      const g = Math.floor(rnd() * 120);
      ctx.fillStyle = `rgba(${g},${g},${g},0.5)`;
      ctx.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 12, 1 + rnd() * 4);
    }
  }, { repeat: true });
}

// Cielo en degradado vertical (compatibilidad / respaldo).
export function skyTex(stops) {
  return canvasTex(32, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    for (const [p, c] of stops) g.addColorStop(p, c);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, { srgb: true });
}

// Tramado sutil sobre hielo.
export function iceTex(base = '#bcd8e6', crack = '#8fb6cc') {
  const rnd = mulberry32(7);
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = crack;
    ctx.lineWidth = 1;
    for (let i = 0; i < 40; i++) {
      ctx.globalAlpha = 0.25 + rnd() * 0.4;
      ctx.beginPath();
      let x = rnd() * w;
      let y = rnd() * h;
      ctx.moveTo(x, y);
      for (let k = 0; k < 3; k++) {
        x += (rnd() - 0.5) * 90;
        y += (rnd() - 0.5) * 90;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }, { repeat: true });
}

// Textura de agua (compatibilidad).
export function waterTex() {
  return canvasTex(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#1f74c8';
    ctx.fillRect(0, 0, w, h);
  }, { repeat: true });
}

// Reutiliza el hash/fbm de procgen por si algún módulo lo importa desde aquí.
export { hash2, valueNoise2, fbm2 };
