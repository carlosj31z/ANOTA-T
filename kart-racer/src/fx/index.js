// BLOQUE 7 — Efectos (partículas) y cámara de persecución. CONTRATO §4.7 y §10.2.
//
// Partículas de calidad "juego actual": atlas procedural con formas orgánicas
// (chispa, llama, humo fBm, estrella, destello en cruz, confeti), colores HDR
// para el bloom del pipeline de render, motion-stretch, mallas emisivas
// instanciadas (conos de llama y ondas expansivas) y luces dinámicas acotadas.
// Todo procedural, sin assets externos. API exacta: createFX(scene, events) y
// createChaseCamera(camera).

import * as THREE from 'three';
import { DRIFT_SPARK_COLORS, EVENTS } from '../shared/constants.js';
import { hasPerk } from '../shared/characters.js';
import { ParticlePool, EMIT } from './particles.js';
import { FlameJets, Shockwaves } from './meshes.js';
import { TILE } from './textures.js';

// ---------------------------------------------------------------
// Utilidades de color (lineal; los valores pueden superar 1 → bloom).
// ---------------------------------------------------------------
const _col = new THREE.Color();
const _base = new THREE.Vector3();
const _fwdT = new THREE.Vector3();

function lin(hex, mul = 1) {
  _col.setHex(hex);
  return [_col.r * mul, _col.g * mul, _col.b * mul];
}

const WHITE = lin(0xffffff);
const WARM = lin(0xfff2c0);
const BLUE_CORE = lin(0xbfe4ff);
const YELLOW = lin(0xffd23f);
const ORANGE = lin(0xff8a1f);
const RED = lin(0xff2d18);
const STAR_GOLD = lin(0xffe14d);
const STAR_WARM = lin(0xffb020);
const SMOKE = lin(0x53535c);
const SMOKE_DARK = lin(0x2a2a30);
const AURA = lin(0x28e0d0);
const AURA_SPARK = lin(0x9bfff2);

const RAINBOW = [
  lin(0xff3b3b), lin(0xff9a1f), lin(0xffe14d), lin(0x4dff88),
  lin(0x39c6ff), lin(0x6a6dff), lin(0xb04dff), lin(0xff5ec4),
];
const CONFETTI = [
  lin(0xff3b3b), lin(0xffd23f), lin(0x2f80ff), lin(0x36d76a),
  lin(0xff6ec7), lin(0x9b5cff), lin(0x00e0d0), lin(0xffffff),
];
const SMOKE_TILES = [TILE.SMOKE_A, TILE.SMOKE_B, TILE.SMOKE_C, TILE.SMOKE_D];

const DRIFT_RGB = DRIFT_SPARK_COLORS.map((h) => (h == null ? null : lin(h)));

// Paletas precalculadas (evita asignar arrays en eventos frecuentes).
const STARS_PAL = [STAR_GOLD, STAR_WARM, WHITE];
const SPARK_RING = [WHITE, STAR_GOLD];
const EXPLODE_PAL = [ORANGE, WARM, RED, WHITE];
const BUMP_PAL = [WHITE, ORANGE];
const SMOKE_PAL = [SMOKE];
const DARK_SMOKE_PAL = [SMOKE, SMOKE_DARK];
const FINISH_PAL = [STAR_GOLD, WHITE, ORANGE];

function rand(a, b) {
  return a + Math.random() * (b - a);
}

function pick(arr) {
  return arr[(Math.random() * arr.length) | 0];
}

// ---------------------------------------------------------------
// Punto de anclaje para el "camera shake" del módulo de cámara.
// createChaseCamera registra aquí su función shake(); createFX la dispara en
// LAND/HIT/WALL del jugador. Mantener la API intacta (solo se añade).
// ---------------------------------------------------------------
let _cameraShake = null;
function fireShake(amount) {
  if (_cameraShake) _cameraShake(amount);
}

// ---------------------------------------------------------------
// FX
// ---------------------------------------------------------------
export function createFX(scene, events) {
  const additive = new ParticlePool(scene, 2000, THREE.AdditiveBlending);
  const normal = new ParticlePool(scene, 1000, THREE.NormalBlending);
  const MAX_TOTAL = additive.capacity + normal.capacity;

  const flames = new FlameJets(scene, 32);
  const waves = new Shockwaves(scene, 8);

  // Única luz dinámica del juego: ilumina el derrape del jugador con el color
  // de su nivel (azul → naranja → morado). Se reutiliza siempre.
  const driftLight = new THREE.PointLight(0xffffff, 0, 10, 2);
  driftLight.visible = false;
  scene.add(driftLight);

  let time = 0;
  let confettiTime = 0;
  let finishKart = null;

  // Tinte del polvo según tema (fondo + niebla de la escena).
  let dust = lin(0x9a7444);
  {
    const bg = scene && scene.background;
    if (bg && bg.isColor) {
      const r = bg.r, g = bg.g, b = bg.b;
      const mn = Math.min(r, g, b);
      if (mn > 0.6) dust = lin(0xe9f0f7);
      else if (r > 0.45 && g > 0.35 && b < 0.3) dust = lin(0xd8b26a);
      else dust = lin(0x9a7444);
    }
    const fog = scene && scene.fog;
    if (fog && fog.color) {
      const k = 0.35;
      dust = [
        dust[0] * (1 - k) + fog.color.r * k,
        dust[1] * (1 - k) + fog.color.g * k,
        dust[2] * (1 - k) + fog.color.b * k,
      ];
    }
  }
  const DUST = dust;
  const DUST_PAL = [DUST];

  const stats = { alive: 0, max: MAX_TOTAL, peak: 0 };
  if (typeof window !== 'undefined') window.__fxStats = stats;

  function auraActive(k) {
    const st = k.state;
    return st.aura === true || (hasPerk(k, 'aura') && st.boostTime > 0);
  }

  // --- emisores genéricos -------------------------------------------------
  function burstStars(x, y, z, count, speed, palette, gravity) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const el = rand(-0.2, 1.0);
      const ce = Math.cos(el);
      const v = speed * rand(0.5, 1.2);
      const col = pick(palette);
      EMIT.gravity = gravity == null ? -14 : gravity;
      EMIT.drag = 1.4;
      EMIT.alpha = 1;
      EMIT.sizeTo = -1;
      EMIT.rot = Math.random() * 6.28;
      EMIT.rotVel = rand(-8, 8);
      EMIT.tile = TILE.STAR;
      EMIT.stretch = 0.35;
      additive.spawn(
        x, y, z,
        Math.cos(a) * ce * v, Math.sin(el) * v + 2, Math.sin(a) * ce * v,
        col[0] * 2.2, col[1] * 2.2, col[2] * 2.2, rand(0.26, 0.42), rand(0.5, 0.9), EMIT
      );
    }
  }

  function ring(x, y, z, count, speed, palette, gravity, tile) {
    const tl = tile == null ? TILE.GLOW : tile;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rand(-0.1, 0.1);
      const v = speed * rand(0.7, 1.15);
      const col = pick(palette);
      EMIT.gravity = gravity == null ? -18 : gravity;
      EMIT.drag = 1.2;
      EMIT.alpha = 1;
      EMIT.sizeTo = -1;
      EMIT.rot = 0;
      EMIT.rotVel = 0;
      EMIT.tile = tl;
      EMIT.stretch = 0.6;
      additive.spawn(
        x, y + 0.2, z,
        Math.cos(a) * v, rand(1, 4), Math.sin(a) * v,
        col[0] * 2.0, col[1] * 2.0, col[2] * 2.0, rand(0.24, 0.4), rand(0.35, 0.65), EMIT
      );
    }
  }

  function puffs(x, y, z, count, spread, up, palette, size, life, dark) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const col = pick(palette);
      EMIT.gravity = rand(0.4, 1.6);
      EMIT.drag = 1.6;
      EMIT.alpha = dark ? 0.5 : 0.42;
      EMIT.sizeTo = size * rand(2.2, 3.4);
      EMIT.rot = Math.random() * 6.28;
      EMIT.rotVel = rand(-1.2, 1.2);
      EMIT.tile = pick(SMOKE_TILES);
      EMIT.stretch = 0;
      normal.spawn(
        x + rand(-spread, spread), y + rand(0, 0.4), z + rand(-spread, spread),
        Math.cos(a) * rand(0.4, 1.6), up * rand(0.5, 1.2), Math.sin(a) * rand(0.4, 1.6),
        col[0] * 0.9, col[1] * 0.9, col[2] * 0.9, size, life * rand(0.7, 1.2), EMIT
      );
    }
  }

  // --- continuos ---------------------------------------------------------
  function emitDrift(k, dt) {
    const st = k.state;
    const level = st.driftLevel | 0;
    const p = k.position;
    const h = k.heading;
    const s = Math.sin(h), c = Math.cos(h);
    const dir = st.driftDir || 0;
    const outX = c * -dir;
    const outZ = -s * -dir;

    // Humo suave de neumáticos (una o ambas ruedas traseras).
    let ns = Math.floor((level > 0 ? 24 : 12) * dt + Math.random());
    for (let i = 0; i < ns; i++) {
      const w = Math.random() < 0.5 ? -1 : 1;
      const x = p.x + c * (0.62 * w) + s * -0.8;
      const z = p.z - s * (0.62 * w) + c * -0.8;
      EMIT.gravity = rand(0.6, 1.4);
      EMIT.drag = 1.6;
      EMIT.alpha = 0.3 + level * 0.05;
      EMIT.sizeTo = rand(0.9, 1.4);
      EMIT.rot = Math.random() * 6.28;
      EMIT.rotVel = rand(-1.5, 1.5);
      EMIT.tile = pick(SMOKE_TILES);
      EMIT.stretch = 0;
      normal.spawn(x, p.y + 0.2, z,
        outX * rand(0.5, 2.0) + rand(-1.2, 1.2), rand(0.6, 1.8), outZ * rand(0.5, 2.0) + rand(-1.2, 1.2),
        DUST[0] + 0.35, DUST[1] + 0.35, DUST[2] + 0.35, rand(0.26, 0.38), rand(0.45, 0.8), EMIT);
    }

    if (level <= 0) return;

    // Chispas estiradas del color del nivel, muy brillantes (HDR) para el bloom.
    const col = DRIFT_RGB[level] || WHITE;
    let n = Math.floor((28 + level * 26) * dt + Math.random());
    for (let i = 0; i < n; i++) {
      const w = Math.random() < 0.5 ? -1 : 1;
      const x = p.x + c * (0.55 * w) + s * -0.7;
      const z = p.z - s * (0.55 * w) + c * -0.7;
      EMIT.gravity = -16;
      EMIT.drag = 1.1;
      EMIT.alpha = 1;
      EMIT.sizeTo = -1;
      EMIT.rot = 0;
      EMIT.rotVel = 0;
      EMIT.tile = TILE.SPARK;
      EMIT.stretch = 1;
      const br = 2.4 + Math.random() * 1.2;
      additive.spawn(x, p.y + 0.2, z,
        outX * rand(2.5, 6.5) + rand(-1.5, 1.5), rand(1, 4.5), outZ * rand(2.5, 6.5) + rand(-1.5, 1.5),
        col[0] * br, col[1] * br, col[2] * br, rand(0.2, 0.34), rand(0.3, 0.55), EMIT);
    }
    // Destello en cruz ocasional.
    if (Math.random() < 14 * dt) {
      const w = Math.random() < 0.5 ? -1 : 1;
      EMIT.gravity = -10;
      EMIT.drag = 1.4;
      EMIT.alpha = 1;
      EMIT.sizeTo = -1;
      EMIT.rot = 0;
      EMIT.rotVel = 0;
      EMIT.tile = TILE.CROSS;
      EMIT.stretch = 0;
      additive.spawn(p.x + c * (0.55 * w) + s * -0.7, p.y + 0.25, p.z - s * (0.55 * w) + c * -0.7,
        0, rand(0.5, 2), 0, col[0] * 3.0, col[1] * 3.0, col[2] * 3.0, 0.42, 0.26, EMIT);
    }
  }

  function emitBoost(k, dt) {
    const p = k.position;
    const h = k.heading;
    const s = Math.sin(h), c = Math.cos(h);
    let n = Math.floor(150 * dt + Math.random());
    for (let i = 0; i < n; i++) {
      const w = Math.random() < 0.5 ? -1 : 1;
      const x = p.x + c * (0.38 * w) + s * -1.0;
      const z = p.z - s * (0.38 * w) + c * -1.0;
      const y = p.y + 0.5 + rand(-0.14, 0.14);
      const t = Math.random();
      let col;
      if (t < 0.32) col = [BLUE_CORE[0] * 2.6, BLUE_CORE[1] * 2.6, BLUE_CORE[2] * 2.6];
      else if (t < 0.68) col = [YELLOW[0] * 2.2, YELLOW[1] * 2.2, YELLOW[2] * 2.2];
      else col = [ORANGE[0] * 1.8, ORANGE[1] * 1.8, ORANGE[2] * 1.8];
      EMIT.gravity = 0.5;
      EMIT.drag = 2.4;
      EMIT.alpha = 1;
      EMIT.sizeTo = rand(0.1, 0.2);
      EMIT.rot = Math.random() * 6.28;
      EMIT.rotVel = rand(-10, 10);
      EMIT.tile = TILE.FLAME;
      EMIT.stretch = 1;
      additive.spawn(x, y, z,
        -s * rand(7, 13) + rand(-1.3, 1.3), rand(-0.5, 1.4), -c * rand(7, 13) + rand(-1.3, 1.3),
        col[0], col[1], col[2], rand(0.34, 0.55), rand(0.12, 0.26), EMIT);
    }
    // Humo oscuro que se disipa detrás.
    if (Math.random() < 90 * dt) {
      EMIT.gravity = 1.2;
      EMIT.drag = 1.4;
      EMIT.alpha = 0.4;
      EMIT.sizeTo = 1.4;
      EMIT.rot = Math.random() * 6.28;
      EMIT.rotVel = rand(-1, 1);
      EMIT.tile = TILE.SMOKE_D;
      EMIT.stretch = 0;
      normal.spawn(p.x + s * -1.3, p.y + 0.5, p.z + c * -1.3,
        -s * rand(3, 6) + rand(-0.7, 0.7), rand(0.4, 1.2), -c * rand(3, 6) + rand(-0.7, 0.7),
        SMOKE_DARK[0], SMOKE_DARK[1], SMOKE_DARK[2], 0.4, rand(0.4, 0.75), EMIT);
    }
  }

  function emitOffroad(k, dt) {
    const st = k.state;
    if (Math.abs(k.speed) < 5 || st.airborne) return;
    const p = k.position;
    const h = k.heading;
    const s = Math.sin(h), c = Math.cos(h);
    let n = Math.floor(42 * dt + Math.random());
    for (let i = 0; i < n; i++) {
      const w = Math.random() < 0.5 ? -1 : 1;
      const x = p.x + c * (0.7 * w) + s * -0.6;
      const z = p.z - s * (0.7 * w) + c * -0.6;
      EMIT.gravity = rand(-1.5, 0.5);
      EMIT.drag = 1.5;
      EMIT.alpha = 0.9;
      EMIT.sizeTo = rand(0.6, 1.2);
      EMIT.rot = Math.random() * 6.28;
      EMIT.rotVel = rand(-2, 2);
      EMIT.tile = Math.random() < 0.8 ? pick(SMOKE_TILES) : TILE.PEBBLE;
      EMIT.stretch = 0.3;
      normal.spawn(x, p.y + 0.15, z,
        -s * rand(1, 3) + rand(-1.2, 1.2), rand(0.5, 1.8), -c * rand(1, 3) + rand(-1.2, 1.2),
        DUST[0], DUST[1], DUST[2], rand(0.28, 0.46), rand(0.5, 0.9), EMIT);
    }
  }

  function emitShield(k, dt) {
    const p = k.position;
    let n = Math.floor(40 * dt + Math.random());
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2 + time * 2;
      const r = rand(1.0, 1.5);
      const col = pick(RAINBOW);
      EMIT.gravity = 0.4;
      EMIT.drag = 0.6;
      EMIT.alpha = 1;
      EMIT.sizeTo = -1;
      EMIT.rot = a;
      EMIT.rotVel = rand(-4, 4);
      EMIT.tile = TILE.GLOW;
      EMIT.stretch = 0;
      additive.spawn(
        p.x + Math.cos(a) * r, p.y + rand(0.3, 1.4), p.z + Math.sin(a) * r,
        Math.cos(a) * rand(-0.6, 0.6), rand(0.4, 1.4), Math.sin(a) * rand(-0.6, 0.6),
        col[0] * 2.4, col[1] * 2.4, col[2] * 2.4, rand(0.18, 0.3), rand(0.25, 0.55), EMIT
      );
    }
  }

  function emitSpin(k, dt) {
    const p = k.position;
    let n = Math.floor(22 * dt + Math.random());
    for (let i = 0; i < n; i++) {
      const a = time * 5 + i * 2.1;
      const r = 0.78;
      const col = Math.random() < 0.5 ? STAR_GOLD : STAR_WARM;
      EMIT.gravity = 0.2;
      EMIT.drag = 0.5;
      EMIT.alpha = 1;
      EMIT.sizeTo = -1;
      EMIT.rot = a;
      EMIT.rotVel = rand(-6, 6);
      EMIT.tile = TILE.STAR;
      EMIT.stretch = 0.4;
      additive.spawn(
        p.x + Math.cos(a) * r, p.y + 2 + Math.sin(time * 7 + i) * 0.18, p.z + Math.sin(a) * r,
        Math.cos(a + 1.57) * 2, rand(0.2, 0.8), Math.sin(a + 1.57) * 2,
        col[0] * 2.3, col[1] * 2.3, col[2] * 2.3, rand(0.2, 0.32), rand(0.25, 0.45), EMIT
      );
      // estela
      EMIT.tile = TILE.GLOW;
      EMIT.stretch = 0;
      additive.spawn(
        p.x + Math.cos(a) * r, p.y + 2 + Math.sin(time * 7 + i) * 0.18, p.z + Math.sin(a) * r,
        0, 0, 0, STAR_GOLD[0] * 1.6, STAR_GOLD[1] * 1.6, STAR_GOLD[2] * 1.6, 0.45, 0.2, EMIT
      );
    }
  }

  // Aura turquesa de Kenzo: llamas ascendentes + chispas eléctricas.
  function emitAura(k, dt) {
    const p = k.position;
    let nf = Math.floor(230 * dt + Math.random());
    for (let i = 0; i < nf; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = rand(0.25, 1.35);
      EMIT.gravity = 0.8;
      EMIT.drag = 1.2;
      EMIT.alpha = 1;
      EMIT.sizeTo = rand(0.05, 0.12);
      EMIT.rot = Math.random() * 6.28;
      EMIT.rotVel = rand(-4, 4);
      EMIT.tile = TILE.FLAME;
      EMIT.stretch = 0.4;
      const br = 2.0 + Math.random() * 1.4;
      additive.spawn(
        p.x + Math.cos(a) * r, p.y + rand(0.0, 0.55), p.z + Math.sin(a) * r,
        Math.cos(a) * rand(-0.4, 0.4), rand(2.2, 4.2), Math.sin(a) * rand(-0.4, 0.4),
        AURA[0] * br, AURA[1] * br, AURA[2] * br, rand(0.32, 0.55), rand(0.35, 0.7), EMIT
      );
    }
    let ns = Math.floor(70 * dt + Math.random());
    for (let i = 0; i < ns; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = rand(0.3, 1.2);
      EMIT.gravity = -6;
      EMIT.drag = 2.5;
      EMIT.alpha = 1;
      EMIT.sizeTo = -1;
      EMIT.rot = 0;
      EMIT.rotVel = 0;
      EMIT.tile = Math.random() < 0.5 ? TILE.SPARK : TILE.SPARKLE;
      EMIT.stretch = 1;
      const br = 3.0 + Math.random() * 1.5;
      additive.spawn(
        p.x + Math.cos(a) * r, p.y + rand(0.2, 1.4), p.z + Math.sin(a) * r,
        Math.cos(a) * rand(-3, 3), rand(-1, 3), Math.sin(a) * rand(-3, 3),
        AURA_SPARK[0] * br, AURA_SPARK[1] * br, AURA_SPARK[2] * br, rand(0.16, 0.28), rand(0.15, 0.3), EMIT
      );
    }
    if (Math.random() < 20 * dt) {
      EMIT.gravity = 0;
      EMIT.drag = 1.5;
      EMIT.alpha = 1;
      EMIT.sizeTo = -1;
      EMIT.rot = 0;
      EMIT.rotVel = 0;
      EMIT.tile = TILE.CROSS;
      EMIT.stretch = 0;
      additive.spawn(p.x, p.y + rand(0.6, 1.6), p.z, 0, 0, 0,
        AURA_SPARK[0] * 3.2, AURA_SPARK[1] * 3.2, AURA_SPARK[2] * 3.2, 0.5, 0.22, EMIT);
    }
  }

  // Torbellino de Zuri: anillo de polvo/viento en espiral alrededor del kart.
  function emitTorbellino(k, dt) {
    const p = k.position;
    const n = Math.floor(90 * dt + Math.random());
    for (let i = 0; i < n; i++) {
      const a = time * 7 + Math.random() * Math.PI * 2;
      const r = rand(1.25, 1.75);
      const cx = Math.cos(a);
      const sz = Math.sin(a);
      EMIT.gravity = 1.0;
      EMIT.drag = 1.1;
      EMIT.alpha = 0.55;
      EMIT.sizeTo = rand(0.8, 1.4);
      EMIT.rot = a;
      EMIT.rotVel = rand(4, 9);
      EMIT.tile = pick(SMOKE_TILES);
      EMIT.stretch = 0;
      normal.spawn(
        p.x + cx * r, p.y + rand(0.1, 1.1), p.z + sz * r,
        -sz * rand(2.5, 4.5), rand(0.8, 2.2), cx * rand(2.5, 4.5),
        DUST[0] + 0.5, DUST[1] + 0.5, DUST[2] + 0.5, rand(0.24, 0.4), rand(0.35, 0.6), EMIT
      );
    }
    if (Math.random() < 30 * dt) {
      const a = time * 7;
      EMIT.gravity = 0;
      EMIT.drag = 0.8;
      EMIT.alpha = 1;
      EMIT.sizeTo = -1;
      EMIT.rot = 0;
      EMIT.rotVel = 0;
      EMIT.tile = TILE.GLOW;
      EMIT.stretch = 0;
      additive.spawn(p.x + Math.cos(a) * 1.5, p.y + rand(0.3, 1.0), p.z + Math.sin(a) * 1.5,
        0, 0.8, 0, WHITE[0] * 1.2, WHITE[1] * 1.2, WHITE[2] * 1.2, 0.35, 0.3, EMIT);
    }
  }

  // Líneas de velocidad: estelas alargadas alrededor del jugador durante el turbo.
  function emitSpeedLines(k, dt) {
    const p = k.position;
    const h = k.heading;
    const s = Math.sin(h), c = Math.cos(h);
    const n = Math.floor(90 * dt + Math.random());
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = rand(2.2, 7.0);
      const x = p.x + Math.cos(a) * r + s * rand(-2, 6);
      const z = p.z + Math.sin(a) * r + c * rand(-2, 6);
      const y = p.y + rand(-0.5, 2.4);
      EMIT.gravity = 0;
      EMIT.drag = 0.4;
      EMIT.alpha = 0.9;
      EMIT.sizeTo = -1;
      EMIT.rot = 0;
      EMIT.rotVel = 0;
      EMIT.tile = TILE.STREAK;
      EMIT.stretch = 1;
      additive.spawn(x, y, z,
        -s * rand(22, 40) + rand(-2, 2), rand(-1, 1), -c * rand(22, 40) + rand(-2, 2),
        WHITE[0] * 1.5, WHITE[1] * 1.5, WHITE[2] * 1.5, rand(0.2, 0.4), rand(0.16, 0.3), EMIT);
    }
  }

  function emitConfetti(dt) {
    if (!finishKart) return;
    const p = finishKart.position;
    let n = Math.floor(80 * dt + Math.random());
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = rand(1.5, 6.5);
      const col = pick(CONFETTI);
      EMIT.gravity = -7;
      EMIT.drag = 0.55;
      EMIT.alpha = 1;
      EMIT.sizeTo = -1;
      EMIT.rot = Math.random() * 6.28;
      EMIT.rotVel = rand(-9, 9);
      EMIT.tile = Math.random() < 0.8 ? TILE.CONFETTI : TILE.STAR;
      EMIT.stretch = 0.2;
      normal.spawn(
        p.x + Math.cos(a) * r, p.y + rand(3.5, 7), p.z + Math.sin(a) * r,
        rand(-1.2, 1.2), rand(-0.5, 1.5), rand(-1.2, 1.2),
        col[0], col[1], col[2], rand(0.3, 0.45), rand(1.3, 2.4), EMIT
      );
    }
  }

  // --- eventos -----------------------------------------------------------
  function onHit(p) {
    const k = p && p.kart;
    if (!k) return;
    burstStars(k.position.x, k.position.y + 1.1, k.position.z, 24, 6.5, STARS_PAL);
    ring(k.position.x, k.position.y + 0.4, k.position.z, 14, 7, SPARK_RING, -6, TILE.SPARK);
    waves.spawn(k.position.x, k.position.y + 0.06, k.position.z, {
      life: 0.42, r0: 0.4, r1: 3.4, r: 1.6, g: 1.2, b: 0.4, intensity: 1.8,
    });
    if (k.isPlayer) fireShake(0.55);
  }

  function onExplode(p) {
    const v = p && p.position;
    if (!v) return;
    // Flash central.
    EMIT.gravity = 0;
    EMIT.drag = 3;
    EMIT.alpha = 1;
    EMIT.sizeTo = 10;
    EMIT.rot = 0;
    EMIT.rotVel = 0;
    EMIT.tile = TILE.GLOW;
    EMIT.stretch = 0;
    additive.spawn(v.x, v.y + 0.5, v.z, 0, 0, 0, WARM[0] * 3.2, WARM[1] * 3.2, WARM[2] * 3.2, 3.6, 0.3, EMIT);

    // Bola de fuego: sprites animados (llama con ruido) que crecen y se apagan.
    let nf = 26;
    for (let i = 0; i < nf; i++) {
      const a = Math.random() * Math.PI * 2;
      const el = rand(-0.5, 1.0);
      const sp = rand(2, 7);
      const t = Math.random();
      const col = t < 0.4 ? WARM : t < 0.75 ? ORANGE : RED;
      EMIT.gravity = 1.5;
      EMIT.drag = 1.8;
      EMIT.alpha = 1;
      EMIT.sizeTo = rand(1.6, 2.8);
      EMIT.rot = Math.random() * 6.28;
      EMIT.rotVel = rand(-6, 6);
      EMIT.tile = TILE.FLAME;
      EMIT.stretch = 0.5;
      const br = 2.2 + Math.random();
      additive.spawn(
        v.x, v.y + 0.5, v.z,
        Math.cos(a) * Math.cos(el) * sp, Math.sin(el) * sp + 2, Math.sin(a) * Math.cos(el) * sp,
        col[0] * br, col[1] * br, col[2] * br, rand(0.5, 0.85), rand(0.35, 0.6), EMIT
      );
    }

    // Anillo de onda expansiva (malla).
    waves.spawn(v.x, v.y + 0.06, v.z, {
      life: 0.55, r0: 0.4, r1: 5.2, r: 2.0, g: 1.1, b: 0.35, intensity: 2.0,
    });

    // Chispas.
    ring(v.x, v.y, v.z, 34, 13, EXPLODE_PAL, -18, TILE.SPARK);

    // Humo persistente.
    puffs(v.x, v.y + 0.3, v.z, 18, 0.8, 2.4, DARK_SMOKE_PAL, 0.55, 1.4, true);
    if (p && p.itemId === 'storm') {
      // Nube extra para el golpe global.
      puffs(v.x, v.y + 0.6, v.z, 10, 1.6, 1.6, SMOKE_PAL, 0.7, 1.6, true);
    }
  }

  function onItemBox(p) {
    const v = (p && p.position) || (p && p.kart && p.kart.position);
    if (!v) return;
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2;
      const col = pick(RAINBOW);
      EMIT.gravity = -10;
      EMIT.drag = 1.2;
      EMIT.alpha = 1;
      EMIT.sizeTo = -1;
      EMIT.rot = Math.random() * 6.28;
      EMIT.rotVel = rand(-8, 8);
      EMIT.tile = Math.random() < 0.7 ? TILE.STAR : TILE.GLOW;
      EMIT.stretch = 0.4;
      additive.spawn(v.x, v.y + 0.5, v.z,
        Math.cos(a) * rand(2, 6), rand(1, 5), Math.sin(a) * rand(2, 6),
        col[0] * 2.3, col[1] * 2.3, col[2] * 2.3, rand(0.22, 0.36), rand(0.4, 0.8), EMIT);
    }
    EMIT.gravity = 0;
    EMIT.drag = 3;
    EMIT.alpha = 1;
    EMIT.sizeTo = 4;
    EMIT.tile = TILE.CROSS;
    EMIT.stretch = 0;
    additive.spawn(v.x, v.y + 0.5, v.z, 0, 0, 0, 2.4, 2.4, 2.4, 1.6, 0.3, EMIT);
  }

  function onLand(p) {
    const k = p && p.kart;
    if (!k) return;
    const speed = Math.abs(k.speed || 0);
    const count = Math.min(30, 10 + Math.floor(speed * 0.7));
    puffs(k.position.x, k.position.y + 0.15, k.position.z, count, 1.1, 1.6, DUST_PAL, 0.4, 0.8);
    ring(k.position.x, k.position.y + 0.1, k.position.z, Math.min(20, count), 3.5, DUST_PAL, -6, TILE.RING);
    if (k.isPlayer) fireShake(0.16 + Math.min(0.25, speed * 0.008));
  }

  function onBoost(p) {
    const k = p && p.kart;
    if (!k || p.source !== 'drift') return;
    const level = k.state ? k.state.driftLevel | 0 : 0;
    if (level >= 1) {
      const col = DRIFT_RGB[level] || WHITE;
      ring(k.position.x, k.position.y, k.position.z, 22, 9, [col], null, TILE.RING);
      EMIT.gravity = 0;
      EMIT.drag = 2.4;
      EMIT.alpha = 1;
      EMIT.sizeTo = 3.4;
      EMIT.tile = TILE.GLOW;
      EMIT.stretch = 0;
      additive.spawn(k.position.x, k.position.y + 0.4, k.position.z, 0, 0, 0,
        col[0] * 2.4, col[1] * 2.4, col[2] * 2.4, 1.2, 0.3, EMIT);
    }
  }

  function onFinish(p) {
    const k = p && p.kart;
    if (!k || !k.isPlayer) return;
    finishKart = k;
    confettiTime = 4;
    burstStars(k.position.x, k.position.y + 2.2, k.position.z, 26, 8, FINISH_PAL);
  }

  function onWall(p) {
    const k = p && p.kart;
    if (!k) return;
    const impact = p.impact == null ? 0.6 : p.impact;
    const count = 5 + Math.floor(impact * 18);
    const h = k.heading;
    const s = Math.sin(h), c = Math.cos(h);
    for (let i = 0; i < count; i++) {
      EMIT.gravity = -16;
      EMIT.drag = 1.0;
      EMIT.alpha = 1;
      EMIT.sizeTo = -1;
      EMIT.rot = 0;
      EMIT.rotVel = 0;
      EMIT.tile = TILE.SPARK;
      EMIT.stretch = 1;
      const br = 2.2 + Math.random();
      additive.spawn(k.position.x + s * 0.9, k.position.y + 0.5, k.position.z + c * 0.9,
        s * rand(3, 8) + rand(-3, 3), rand(1, 5), c * rand(3, 8) + rand(-3, 3),
        WHITE[0] * br, WHITE[1] * br, WHITE[2] * br, rand(0.18, 0.3), rand(0.25, 0.5), EMIT);
    }
    if (k.isPlayer && impact > 0.25) fireShake(0.12 + impact * 0.4);
  }

  function onBump(p) {
    if (!p || !p.a || !p.b) return;
    const x = (p.a.position.x + p.b.position.x) * 0.5;
    const y = (p.a.position.y + p.b.position.y) * 0.5 + 0.7;
    const z = (p.a.position.z + p.b.position.z) * 0.5;
    burstStars(x, y, z, 8, 4, BUMP_PAL, -12);
  }

  // Efecto de ventaja (perk) activada: destello con el color del personaje.
  function onPerk(p) {
    const k = p && p.kart;
    if (!k) return;
    const c = (k.character && k.character.colors) || {};
    const accent = c.accent != null ? c.accent : 0xffffff;
    const col = lin(accent);
    EMIT.gravity = 0;
    EMIT.drag = 3;
    EMIT.alpha = 1;
    EMIT.sizeTo = 3.2;
    EMIT.tile = TILE.GLOW;
    EMIT.stretch = 0;
    EMIT.rot = 0;
    EMIT.rotVel = 0;
    additive.spawn(k.position.x, k.position.y + 0.9, k.position.z, 0, 0, 0,
      col[0] * 2.6, col[1] * 2.6, col[2] * 2.6, 1.4, 0.35, EMIT);
    // Estrella pequeña orbitando.
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * 6.28;
      EMIT.gravity = 0;
      EMIT.drag = 1.2;
      EMIT.alpha = 1;
      EMIT.sizeTo = -1;
      EMIT.tile = TILE.STAR;
      EMIT.stretch = 0.3;
      additive.spawn(k.position.x + Math.cos(a) * 0.9, k.position.y + 1.3, k.position.z + Math.sin(a) * 0.9,
        Math.cos(a) * 2, rand(0.8, 1.6), Math.sin(a) * 2,
        col[0] * 2.6, col[1] * 2.6, col[2] * 2.6, 0.24, 0.5, EMIT);
    }
  }

  const unsubs = [
    events.on(EVENTS.HIT, onHit),
    events.on(EVENTS.ITEM_EXPLODE, onExplode),
    events.on(EVENTS.ITEM_BOX, onItemBox),
    events.on(EVENTS.LAND, onLand),
    events.on(EVENTS.BOOST, onBoost),
    events.on(EVENTS.FINISH, onFinish),
    events.on(EVENTS.WALL, onWall),
    events.on(EVENTS.BUMP, onBump),
    events.on('kart:perk', onPerk),
  ];

  function emitFlameJets(k) {
    const h = k.heading;
    const s = Math.sin(h), c = Math.cos(h);
    const p = k.position;
    const aura = auraActive(k);
    for (let side = -1; side <= 1; side += 2) {
      _base.set(p.x + c * 0.38 * side + s * -1.0, p.y + 0.5, p.z - s * 0.38 * side + c * -1.0);
      // Dirección ligeramente abierta hacia fuera y hacia abajo para que el
      // cono se vea de canto (no como un círculo visto desde atrás).
      _fwdT.set(s + c * side * 0.24, -0.16, c - s * side * 0.24);
      const flick = 0.7 + Math.random() * 0.7;
      const len = (1.05 + Math.random() * 0.7) * flick;
      const rad = 0.12 + Math.random() * 0.05;
      if (aura) {
        flames.add(_base, _fwdT, len, rad,
          AURA[0] * 1.8 * flick, AURA[1] * 1.8 * flick, AURA[2] * 1.8 * flick);
      } else {
        flames.add(_base, _fwdT, len, rad,
          (1.9 + Math.random() * 0.8) * flick, (0.95 + Math.random() * 0.5) * flick, (0.28 + Math.random() * 0.3) * flick);
      }
    }
  }

  function update(dt, karts) {
    if (!isFinite(dt) || dt <= 0) return;
    if (dt > 0.05) dt = 0.05;
    time += dt;

    flames.begin();

    let player = null;
    if (karts && karts.length) {
      for (let i = 0; i < karts.length; i++) {
        const k = karts[i];
        if (!k || !k.state || !k.position) continue;
        if (k.isPlayer) player = k;
        const st = k.state;
        if (st.drifting) emitDrift(k, dt);
        if (st.boostTime > 0) {
          emitBoost(k, dt);
          emitFlameJets(k);
        }
        if (st.surface === 'offroad') emitOffroad(k, dt);
        if (st.shieldTime > 0) emitShield(k, dt);
        if (st.spinTime > 0) emitSpin(k, dt);
        if (auraActive(k)) emitAura(k, dt);
        if (hasPerk(k, 'torbellino') && st.boostTime > 0) emitTorbellino(k, dt);
      }
    }

    // Extras del jugador: líneas de velocidad y luz de derrape.
    if (player) {
      const pst = player.state;
      if (pst.boostTime > 0) emitSpeedLines(player, dt);
      const level = pst.drifting ? pst.driftLevel | 0 : 0;
      if (level > 0) {
        const p = player.position;
        driftLight.position.set(p.x, p.y + 0.7, p.z);
        if (driftLight.color.getHex() !== DRIFT_SPARK_COLORS[level]) driftLight.color.setHex(DRIFT_SPARK_COLORS[level]);
        driftLight.intensity = 3 + level * 4;
        driftLight.visible = true;
      } else if (driftLight.visible) {
        driftLight.visible = false;
        driftLight.intensity = 0;
      }
    } else if (driftLight.visible) {
      driftLight.visible = false;
      driftLight.intensity = 0;
    }

    flames.end();

    if (confettiTime > 0) {
      confettiTime -= dt;
      emitConfetti(dt);
      if (confettiTime <= 0) finishKart = null;
    }

    additive.update(dt);
    normal.update(dt);
    waves.update(dt);

    stats.alive = additive.aliveCount + normal.aliveCount;
    if (stats.alive > stats.peak) stats.peak = stats.alive;
  }

  function dispose() {
    for (const u of unsubs) {
      if (typeof u === 'function') u();
    }
    unsubs.length = 0;
    additive.dispose(scene);
    normal.dispose(scene);
    flames.dispose(scene);
    waves.dispose(scene);
    scene.remove(driftLight);
    if (typeof window !== 'undefined' && window.__fxStats === stats) {
      window.__fxStats = null;
    }
  }

  return { update, dispose, stats };
}

// ---------------------------------------------------------------
// Cámara de persecución
// ---------------------------------------------------------------
const BASE_FOV = 70;
const BOOST_FOV = 84;
const POS_K = 22;
const LOOK_K = 32;

export function createChaseCamera(camera) {
  const pos = new THREE.Vector3(0, 6, -10);
  const posVel = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  const lookCurrent = new THREE.Vector3();
  const lookVel = new THREE.Vector3();
  const tmpPos = new THREE.Vector3();
  const tmpLook = new THREE.Vector3();
  const introCenter = new THREE.Vector3();

  let mode = 'chase';
  let track = null;
  let time = 0;
  let shakeAmt = 0;
  let tilt = 0;
  let introTime = 0;
  let introInit = false;
  let introA0 = 0;
  let introA1 = 0;
  let orbitAngle = 0;

  function chaseDesired(kart, outPos, outLook) {
    const h = kart.heading;
    const s = Math.sin(h), c = Math.cos(h);
    const p = kart.position;
    outPos.set(p.x - s * 6.5, p.y + 2.8, p.z - c * 6.5);
    const st = kart.state;
    if (st && st.drifting && st.driftDir) {
      outPos.x += c * -st.driftDir * 1.7;
      outPos.z += -s * -st.driftDir * 1.7;
    }
    outLook.set(p.x + s * 4.0, p.y + 1.2, p.z + c * 4.0);
  }

  function ensureIntroInit(kart) {
    if (introInit) return;
    if (track && track.getStartGrid) {
      const grid = track.getStartGrid(8);
      if (grid && grid[0]) introCenter.copy(grid[0].position);
      else introCenter.copy(kart.position);
    } else {
      introCenter.copy(kart.position);
    }
    const h = kart.heading;
    const s = Math.sin(h), c = Math.cos(h);
    const bx = kart.position.x - s * 7 - introCenter.x;
    const bz = kart.position.z - c * 7 - introCenter.z;
    introA1 = Math.atan2(bx, bz);
    introA0 = introA1 - 2.9;
    introInit = true;
  }

  function introDesired(kart, outPos, outLook) {
    ensureIntroInit(kart);
    const u = Math.min(1, introTime / 3);
    const e = u * u * (3 - 2 * u);
    const ang = introA0 + (introA1 - introA0) * e;
    const r = 44 - 37 * e;
    const hy = 38 - 35 * e;
    outPos.set(
      introCenter.x + Math.sin(ang) * r,
      kart.position.y + hy,
      introCenter.z + Math.cos(ang) * r
    );
    outLook.copy(kart.position);
    outLook.y += 1.2;
    if (u > 0.65) {
      chaseDesired(kart, tmpPos, tmpLook);
      const b = (u - 0.65) / 0.35;
      const bb = b * b * (3 - 2 * b);
      outPos.lerp(tmpPos, bb);
      outLook.lerp(tmpLook, bb);
    }
  }

  function finishDesired(kart, outPos, outLook) {
    outPos.set(
      kart.position.x + Math.sin(orbitAngle) * 7,
      kart.position.y + 2.5,
      kart.position.z + Math.cos(orbitAngle) * 7
    );
    outLook.copy(kart.position);
    outLook.y += 1.0;
  }

  function spring(cur, vel, target, k, dt) {
    const cd = 2 * Math.sqrt(k);
    vel.x += (-k * (cur.x - target.x) - cd * vel.x) * dt;
    vel.y += (-k * (cur.y - target.y) - cd * vel.y) * dt;
    vel.z += (-k * (cur.z - target.z) - cd * vel.z) * dt;
    cur.x += vel.x * dt;
    cur.y += vel.y * dt;
    cur.z += vel.z * dt;
  }

  function update(dt, kart) {
    if (!kart) return;
    if (!isFinite(dt) || dt <= 0) return;
    if (dt > 0.05) dt = 0.05;
    time += dt;

    if (mode === 'intro') introTime += dt;
    if (mode === 'finish') orbitAngle += dt * 0.45;

    if (mode === 'intro') introDesired(kart, desired, lookTarget);
    else if (mode === 'finish') finishDesired(kart, desired, lookTarget);
    else chaseDesired(kart, desired, lookTarget);

    const kp = mode === 'intro' ? 16 : POS_K;
    spring(pos, posVel, desired, kp, dt);
    spring(lookCurrent, lookVel, lookTarget, LOOK_K, dt);

    // Nunca bajo el suelo.
    const minY = kart.position.y + 1;
    if (pos.y < minY) {
      pos.y = minY;
      if (posVel.y < 0) posVel.y = 0;
    }

    camera.position.copy(pos);

    if (mode === 'chase') {
      const ratio = kart.maxSpeed ? Math.min(1, Math.abs(kart.speed) / kart.maxSpeed) : 0;
      const amp = Math.max(0, ratio - 0.5) * 0.16;
      if (amp > 0.001) {
        camera.position.x += Math.sin(time * 47) * amp;
        camera.position.y += Math.sin(time * 61 + 1.3) * amp * 0.7;
        camera.position.z += Math.cos(time * 53 + 0.5) * amp;
      }
    }

    if (shakeAmt > 0.0005) {
      camera.position.x += (Math.random() - 0.5) * shakeAmt;
      camera.position.y += (Math.random() - 0.5) * shakeAmt;
      camera.position.z += (Math.random() - 0.5) * shakeAmt;
      shakeAmt *= Math.max(0, 1 - dt * 6);
    } else {
      shakeAmt = 0;
    }

    // Dutch tilt: inclina levemente la cámara en derrapes.
    const st = kart.state;
    let targetTilt = 0;
    if (st && st.drifting && st.driftDir) {
      targetTilt = -st.driftDir * (0.05 + 0.03 * (st.driftLevel | 0));
    }
    tilt += (targetTilt - tilt) * Math.min(1, dt * 5);

    camera.up.set(0, 1, 0);
    camera.lookAt(lookCurrent);
    if (Math.abs(tilt) > 0.0005) camera.rotateZ(tilt);

    const boost = kart.state && kart.state.boostTime > 0;
    const targetFov = mode === 'finish' ? 74 : boost ? BOOST_FOV : BASE_FOV;
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 4);
    camera.updateProjectionMatrix();
  }

  function shake(amount) {
    if (!isFinite(amount)) return;
    shakeAmt = Math.max(shakeAmt, amount);
  }

  function setMode(m, t) {
    mode = m || 'chase';
    if (t) track = t;
    if (mode === 'intro') {
      introTime = 0;
      introInit = false;
    } else if (mode === 'finish') {
      orbitAngle = 0;
    }
  }

  function snap(kart) {
    if (!kart) return;
    if (mode === 'intro') introDesired(kart, desired, lookTarget);
    else if (mode === 'finish') finishDesired(kart, desired, lookTarget);
    else chaseDesired(kart, desired, lookTarget);

    pos.copy(desired);
    posVel.set(0, 0, 0);
    lookCurrent.copy(lookTarget);
    lookVel.set(0, 0, 0);

    camera.position.copy(pos);
    camera.up.set(0, 1, 0);
    camera.lookAt(lookCurrent);
    camera.fov = BASE_FOV;
    camera.updateProjectionMatrix();
  }

  // Registra el canal de shake para que createFX lo dispare en LAND/HIT.
  _cameraShake = shake;

  return { update, shake, setMode, snap };
}
