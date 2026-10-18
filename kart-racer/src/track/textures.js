// BLOQUE 1 — Circuitos. Texturas procedurales (CanvasTexture), sin archivos externos.
// Contrato §0: todo generado por código.

import * as THREE from 'three';

// PRNG determinista (para que las capturas y el escenario sean estables).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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
  if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  if (opts.repeat) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  }
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

// --- Cuadros blanco/negro (línea de meta y pancartas) ---
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

// --- Bordillos rojo/blanco: una banda por ciclo en v ---
export function curbTex(a = '#e23b2f', b = '#f2f2f2') {
  return canvasTex(16, 64, (ctx, w, h) => {
    ctx.fillStyle = a;
    ctx.fillRect(0, 0, w, h / 2);
    ctx.fillStyle = b;
    ctx.fillRect(0, h / 2, w, h / 2);
  }, { repeat: true });
}

// --- Textura de suelo con grano ---
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

// --- Placa de turbo: chevrones brillantes sobre transparente (se anima el offset) ---
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
    // Hacia v=0 (arriba de la textura) => "adelante".
    chev(52, 0.55);
    chev(86, 0.8);
    chev(120, 1);
    ctx.globalAlpha = 1;
  }, { repeat: true });
}

// --- Flecha de rampa (una sola chevron, transparente) ---
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

// --- Pancarta de meta con el nombre del circuito ---
export function bannerTex(title, bg = '#c8362b', accent = '#ffd23f') {
  return canvasTex(1024, 256, (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, w, 18);
    ctx.fillRect(0, h - 18, w, 18);
    // damero lateral
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

// --- Cielo en degradado vertical (esfera BackSide) ---
export function skyTex(stops) {
  return canvasTex(32, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    for (const [p, c] of stops) g.addColorStop(p, c);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, { srgb: true });
}

// --- Tramado sutil sobre hielo ---
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

// --- Textura de agua para el oasis ---
export function waterTex() {
  const rnd = mulberry32(11);
  return canvasTex(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#1f74c8';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) {
      ctx.globalAlpha = 0.12 + rnd() * 0.25;
      ctx.strokeStyle = rnd() < 0.5 ? '#7fd4ff' : '#0f4f8f';
      ctx.lineWidth = 1 + rnd() * 3;
      ctx.beginPath();
      const y = rnd() * h;
      ctx.moveTo(rnd() * w, y);
      ctx.bezierCurveTo(w * 0.3, y + 6, w * 0.6, y - 6, w, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }, { repeat: true });
}
