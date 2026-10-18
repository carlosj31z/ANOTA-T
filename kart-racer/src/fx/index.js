// BLOQUE 7 — Efectos (partículas) y cámara de persecución. CONTRATO §4.7.
// Reemplaza el stub. API exacta: createFX(scene, events) y
// createChaseCamera(camera). Todo procedural, sin assets externos.

import * as THREE from 'three';
import { DRIFT_SPARK_COLORS, EVENTS } from '../shared/constants.js';
import { ParticlePool, EMIT } from './particles.js';

// ---------------------------------------------------------------
// Utilidades de color
// ---------------------------------------------------------------
const _col = new THREE.Color();

function rgb(hex) {
  _col.setHex(hex);
  return [_col.r, _col.g, _col.b];
}

const WHITE = rgb(0xffffff);
const WARM = rgb(0xfff2c0);
const ORANGE = rgb(0xff8a1f);
const RED = rgb(0xff2d18);
const STAR_GOLD = rgb(0xffe14d);
const STAR_WARM = rgb(0xffb020);
const SPARK_WHITE = rgb(0xffffff);
const SMOKE = rgb(0x4a4a52);

const RAINBOW = [
  rgb(0xff3b3b), rgb(0xff9a1f), rgb(0xffe14d), rgb(0x4dff88),
  rgb(0x39c6ff), rgb(0x6a6dff), rgb(0xb04dff), rgb(0xff5ec4),
];
const CONFETTI = [
  rgb(0xff3b3b), rgb(0xffd23f), rgb(0x2f80ff), rgb(0x36d76a),
  rgb(0xff6ec7), rgb(0x9b5cff), rgb(0x00e0d0), rgb(0xffffff),
];

// Colores de derrape: índice 0 = humo blanco tenue (pool normal), 1..3 aditivo.
const DRIFT_RGB = DRIFT_SPARK_COLORS.map((h) => (h == null ? null : rgb(h)));

function cfg(gravity, drag, shape, alpha, sizeTo, rot, rotVel) {
  EMIT.gravity = gravity;
  EMIT.drag = drag;
  EMIT.shape = shape;
  EMIT.alpha = alpha;
  EMIT.sizeTo = sizeTo == null ? -1 : sizeTo;
  EMIT.rot = rot || 0;
  EMIT.rotVel = rotVel || 0;
}

function rand(a, b) {
  return a + Math.random() * (b - a);
}

// ---------------------------------------------------------------
// FX
// ---------------------------------------------------------------
export function createFX(scene, events) {
  const additive = new ParticlePool(scene, 1150, THREE.AdditiveBlending);
  const normal = new ParticlePool(scene, 850, THREE.NormalBlending);
  const MAX_TOTAL = additive.capacity + normal.capacity;

  let time = 0;
  let confettiTime = 0;
  let finishKart = null;

  // Color de polvo según tema (best-effort a partir del fondo de la escena).
  let dust = [0xa9803f];
  {
    const bg = scene && scene.background;
    if (bg && bg.isColor) {
      const r = bg.r, g = bg.g, b = bg.b;
      const mn = Math.min(r, g, b);
      if (mn > 0.6) dust = rgb(0xe9f0f7); // nieve / muy claro
      else if (r > 0.45 && g > 0.35 && b < 0.3) dust = rgb(0xd8b26a); // desierto
      else dust = rgb(0x9a7444); // pradera y resto: tierra marrón
    }
  }
  const DUST = dust;

  const stats = { alive: 0, max: MAX_TOTAL, peak: 0 };
  if (typeof window !== 'undefined') window.__fxStats = stats;

  // --- emisores atómicos -------------------------------------------------
  function burstStars(x, y, z, count, speed, palette, gravity) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const el = rand(-0.2, 1.0);
      const ce = Math.cos(el);
      const v = speed * rand(0.5, 1.2);
      const col = palette[(Math.random() * palette.length) | 0];
      cfg((gravity == null ? -14 : gravity), 1.4, 1, 1, -1, Math.random() * 6.28, rand(-8, 8));
      additive.spawn(
        x, y, z,
        Math.cos(a) * ce * v, Math.sin(el) * v + 2, Math.sin(a) * ce * v,
        col[0], col[1], col[2], rand(0.26, 0.42), rand(0.5, 0.9), EMIT
      );
    }
  }

  function ring(x, y, z, count, speed, palette, gravity, shape) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rand(-0.1, 0.1);
      const v = speed * rand(0.7, 1.15);
      const col = palette[(Math.random() * palette.length) | 0];
      cfg((gravity == null ? -18 : gravity), 1.2, shape || 0, 1, -1, 0, 0);
      additive.spawn(
        x, y + 0.2, z,
        Math.cos(a) * v, rand(1, 4), Math.sin(a) * v,
        col[0], col[1], col[2], rand(0.24, 0.4), rand(0.35, 0.65), EMIT
      );
    }
  }

  function puffs(x, y, z, count, spread, up, palette, size, life) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const col = palette[(Math.random() * palette.length) | 0];
      cfg(rand(0.4, 1.6), 1.6, 0, 1, size * rand(2.2, 3.4), 0, 0);
      normal.spawn(
        x + rand(-spread, spread), y + rand(0, 0.4), z + rand(-spread, spread),
        Math.cos(a) * rand(0.4, 1.6), up * rand(0.5, 1.2), Math.sin(a) * rand(0.4, 1.6),
        col[0] * 0.9, col[1] * 0.9, col[2] * 0.9, size, life * rand(0.7, 1.2), EMIT
      );
    }
  }

  // --- continuos ---------------------------------------------------------
  function emitDrift(kart, dt) {
    const st = kart.state;
    const level = st.driftLevel | 0;
    const p = kart.position;
    const h = kart.heading;
    const s = Math.sin(h), c = Math.cos(h);
    const rate = 14 + level * 22;
    let n = Math.floor(rate * dt + Math.random());
    if (level === 0) n = Math.min(n, Math.floor(6 * dt + Math.random()));
    if (n <= 0) return;
    const dir = st.driftDir || 0;
    const outX = c * -dir; // lateral hacia fuera de la curva
    const outZ = -s * -dir;
    const col = level > 0 ? DRIFT_RGB[level] : WHITE;
    for (let i = 0; i < n; i++) {
      const w = Math.random() < 0.5 ? -1 : 1;
      const x = p.x + c * (0.6 * w) + s * -0.8;
      const z = p.z - s * (0.6 * w) + c * -0.8;
      const y = p.y + 0.2;
      if (level > 0) {
        cfg(-20, 1.0, 0, 1, -1, 0, 0);
        additive.spawn(
          x, y, z,
          outX * rand(2, 5) + rand(-1.5, 1.5), rand(1, 3.5), outZ * rand(2, 5) + rand(-1.5, 1.5),
          col[0], col[1], col[2], rand(0.22, 0.34) + level * 0.05, rand(0.35, 0.6), EMIT
        );
      } else {
        cfg(1.2, 1.8, 0, 0.5, 0.5, 0, 0);
        normal.spawn(x, y, z, rand(-0.8, 0.8), rand(0.4, 1.3), rand(-0.8, 0.8),
          col[0], col[1], col[2], 0.28, rand(0.4, 0.7), EMIT);
      }
    }
  }

  function emitBoost(kart, dt) {
    const p = kart.position;
    const h = kart.heading;
    const s = Math.sin(h), c = Math.cos(h);
    let n = Math.floor(95 * dt + Math.random());
    for (let i = 0; i < n; i++) {
      const w = Math.random() < 0.5 ? -1 : 1;
      const x = p.x + c * (0.35 * w) + s * -1.0;
      const z = p.z - s * (0.35 * w) + c * -1.0;
      const y = p.y + 0.5 + rand(-0.1, 0.1);
      const t = Math.random();
      const col = t < 0.35 ? WARM : t < 0.75 ? ORANGE : RED;
      cfg(0.5, 2.4, 0, 1, 0.1, 0, 0);
      additive.spawn(
        x, y, z,
        -s * rand(6, 11) + rand(-1.2, 1.2), rand(-0.4, 1.2), -c * rand(6, 11) + rand(-1.2, 1.2),
        col[0], col[1], col[2], rand(0.32, 0.5), rand(0.12, 0.26), EMIT
      );
    }
    // ligera estela
    if (Math.random() < 160 * dt) {
      cfg(0.2, 2.2, 0, 0.5, 0.05, 0, 0);
      additive.spawn(p.x + s * -1.4, p.y + 0.5, p.z + c * -1.4,
        -s * rand(3, 6) + rand(-0.6, 0.6), rand(0, 0.8), -c * rand(3, 6) + rand(-0.6, 0.6),
        ORANGE[0], ORANGE[1], ORANGE[2], 0.4, 0.3, EMIT);
    }
  }

  function emitOffroad(kart, dt) {
    if (Math.abs(kart.speed) < 5 || kart.state.airborne) return;
    const p = kart.position;
    const h = kart.heading;
    const s = Math.sin(h), c = Math.cos(h);
    let n = Math.floor(34 * dt + Math.random());
    for (let i = 0; i < n; i++) {
      const w = Math.random() < 0.5 ? -1 : 1;
      const x = p.x + c * (0.7 * w) + s * -0.6;
      const z = p.z - s * (0.7 * w) + c * -0.6;
      cfg(rand(-1.5, 0.5), 1.5, 0, 0.85, 1.1, 0, 0);
      normal.spawn(x, p.y + 0.15, z,
        -s * rand(1, 3) + rand(-1.2, 1.2), rand(0.5, 1.8), -c * rand(1, 3) + rand(-1.2, 1.2),
        DUST[0], DUST[1], DUST[2], rand(0.3, 0.48), rand(0.5, 0.9), EMIT);
    }
  }

  function emitShield(kart, dt) {
    const p = kart.position;
    let n = Math.floor(30 * dt + Math.random());
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2 + time * 2;
      const r = rand(1.0, 1.5);
      const col = RAINBOW[(Math.random() * RAINBOW.length) | 0];
      cfg(0.4, 0.6, 0, 1, -1, 0, rand(-4, 4));
      additive.spawn(
        p.x + Math.cos(a) * r, p.y + rand(0.3, 1.4), p.z + Math.sin(a) * r,
        Math.cos(a) * rand(-0.6, 0.6), rand(0.4, 1.4), Math.sin(a) * rand(-0.6, 0.6),
        col[0], col[1], col[2], rand(0.18, 0.3), rand(0.25, 0.55), EMIT
      );
    }
  }

  function emitSpin(kart, dt) {
    const p = kart.position;
    let n = Math.floor(16 * dt + Math.random());
    for (let i = 0; i < n; i++) {
      const a = time * 5 + i * 2.1;
      const r = 0.75;
      const col = Math.random() < 0.5 ? STAR_GOLD : STAR_WARM;
      cfg(0.2, 0.5, 1, 1, -1, a, rand(-6, 6));
      additive.spawn(
        p.x + Math.cos(a) * r, p.y + 2 + Math.sin(time * 7 + i) * 0.18, p.z + Math.sin(a) * r,
        Math.cos(a + 1.57) * 2, rand(0.2, 0.8), Math.sin(a + 1.57) * 2,
        col[0], col[1], col[2], rand(0.2, 0.32), rand(0.25, 0.45), EMIT
      );
    }
  }

  function emitConfetti(dt) {
    if (!finishKart) return;
    const p = finishKart.position;
    let n = Math.floor(70 * dt + Math.random());
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = rand(1.5, 6.5);
      const col = CONFETTI[(Math.random() * CONFETTI.length) | 0];
      cfg(-7, 0.55, 1, 1, -1, Math.random() * 6.28, rand(-9, 9));
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
    burstStars(k.position.x, k.position.y + 1.0, k.position.z, 20, 6.5, [STAR_GOLD, STAR_WARM, WHITE]);
  }

  function onExplode(p) {
    const v = p && p.position;
    if (!v) return;
    // destello
    cfg(0, 3, 0, 1, 12, 0, 0);
    additive.spawn(v.x, v.y + 0.4, v.z, 0, 0, 0, WARM[0], WARM[1], WARM[2], 3.4, 0.32, EMIT);
    cfg(0, 3, 0, 0.8, 9, 0, 0);
    additive.spawn(v.x, v.y + 0.4, v.z, 0, 0.5, 0, ORANGE[0], ORANGE[1], ORANGE[2], 2.4, 0.4, EMIT);
    // anillo de chispas
    ring(v.x, v.y, v.z, 30, 13, [ORANGE, WARM, RED, SPARK_WHITE]);
    // humo
    puffs(v.x, v.y + 0.3, v.z, 16, 0.7, 2.2, [SMOKE], 0.55, 1.2);
  }

  function onItemBox(p) {
    const v = (p && p.position) || (p && p.kart && p.kart.position);
    if (!v) return;
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2;
      const col = RAINBOW[(Math.random() * RAINBOW.length) | 0];
      cfg(-10, 1.2, 1, 1, -1, Math.random() * 6.28, rand(-8, 8));
      additive.spawn(v.x, v.y + 0.5, v.z,
        Math.cos(a) * rand(2, 6), rand(1, 5), Math.sin(a) * rand(2, 6),
        col[0], col[1], col[2], rand(0.22, 0.36), rand(0.4, 0.8), EMIT);
    }
  }

  function onLand(p) {
    const k = p && p.kart;
    if (!k) return;
    const speed = Math.abs(k.speed || 0);
    const count = Math.min(26, 8 + Math.floor(speed * 0.6));
    puffs(k.position.x, k.position.y + 0.15, k.position.z, count, 1.1, 1.4, [DUST], 0.4, 0.7);
    ring(k.position.x, k.position.y + 0.1, k.position.z, Math.min(16, count), 3.5, [DUST], -6, 1);
  }

  function onBoost(p) {
    const k = p && p.kart;
    if (!k || p.source !== 'drift') return;
    const level = k.state ? k.state.driftLevel | 0 : 0;
    if (level >= 1) {
      const col = DRIFT_RGB[level] || WHITE;
      ring(k.position.x, k.position.y, k.position.z, 22, 9, [col]);
    }
  }

  function onFinish(p) {
    const k = p && p.kart;
    if (!k || !k.isPlayer) return;
    finishKart = k;
    confettiTime = 4;
    burstStars(k.position.x, k.position.y + 2.2, k.position.z, 26, 8, [STAR_GOLD, WHITE, ORANGE]);
  }

  function onWall(p) {
    const k = p && p.kart;
    if (!k) return;
    const impact = p.impact == null ? 0.6 : p.impact;
    const count = 4 + Math.floor(impact * 16);
    const h = k.heading;
    const s = Math.sin(h), c = Math.cos(h);
    for (let i = 0; i < count; i++) {
      cfg(-16, 1.0, 0, 1, -1, 0, 0);
      additive.spawn(k.position.x + s * 0.9, k.position.y + 0.5, k.position.z + c * 0.9,
        s * rand(3, 8) + rand(-3, 3), rand(1, 5), c * rand(3, 8) + rand(-3, 3),
        SPARK_WHITE[0], SPARK_WHITE[1], SPARK_WHITE[2], rand(0.18, 0.3), rand(0.25, 0.5), EMIT);
    }
  }

  function onBump(p) {
    if (!p || !p.a || !p.b) return;
    const x = (p.a.position.x + p.b.position.x) * 0.5;
    const y = (p.a.position.y + p.b.position.y) * 0.5 + 0.7;
    const z = (p.a.position.z + p.b.position.z) * 0.5;
    burstStars(x, y, z, 8, 4, [SPARK_WHITE, ORANGE], -12);
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
  ];

  function update(dt, karts) {
    if (!isFinite(dt) || dt <= 0) return;
    if (dt > 0.05) dt = 0.05;
    time += dt;

    if (karts && karts.length) {
      for (let i = 0; i < karts.length; i++) {
        const k = karts[i];
        if (!k || !k.state || !k.position) continue;
        const st = k.state;
        if (st.drifting) emitDrift(k, dt);
        if (st.boostTime > 0) emitBoost(k, dt);
        if (st.surface === 'offroad') emitOffroad(k, dt);
        if (st.shieldTime > 0) emitShield(k, dt);
        if (st.spinTime > 0) emitSpin(k, dt);
      }
    }

    if (confettiTime > 0) {
      confettiTime -= dt;
      emitConfetti(dt);
      if (confettiTime <= 0) finishKart = null;
    }

    additive.update(dt);
    normal.update(dt);

    stats.alive = additive.aliveCount + normal.aliveCount;
    if (stats.alive > stats.peak) stats.peak = stats.alive;
    if (typeof window !== 'undefined' && window.__fxStats && window.__fxStats !== stats) {
      window.__fxStats = stats;
    }
  }

  function dispose() {
    for (const u of unsubs) {
      if (typeof u === 'function') u();
    }
    unsubs.length = 0;
    additive.dispose(scene);
    normal.dispose(scene);
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
      // desplazar un poco hacia fuera de la curva
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

    camera.up.set(0, 1, 0);
    camera.lookAt(lookCurrent);

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

  return { update, shake, setMode, snap };
}
