// BLOQUE 3 — IA de corredores CPU ("Rally Relámpago"). Contrato §4.3.
//
// createAIDriver(kart, track, { skill }) -> { update(dt, ctx) }
//
// Estrategia:
//   · Pure pursuit sobre track.getRacingLine() con un índice local que solo
//     avanza (nunca retrocede más de unos puntos) y anticipación proporcional
//     a la velocidad (8..25 m).
//   · Cada corredor tiene un desplazamiento lateral propio (±25 % del medio
//     ancho) que varía lento, para no ir en fila india.
//   · Control de velocidad midiendo el ángulo entre tangentes a 15 y 40 m.
//   · Derrape en curvas largas con velocidad suficiente; suelta al acabar la
//     curva o al alcanzar el nivel objetivo (skill alto busca nivel 2-3).
//   · Evitación de karts delante y, si el ItemSystem lo expone, de cáscaras.
//   · Uso de objetos según la situación (ctx.items.getHeldItem).
//   · Recuperación de atascos: marcha atrás con giro 1 s y, si persiste > 5 s,
//     respawn sobre la línea de carrera (contador en driver.respawns / kart.aiStats).
//   · Rubber-banding suave respecto al jugador (≤ +8 % / −6 %).
//
// Programado contra la API del CONTRATO, no contra los stubs: funciona con
// cualquier circuito que cumpla §4.1 (curvas, rampas, elevación).

import { ROAD_WIDTH, TOTAL_LAPS } from '../shared/constants.js';

const UP_Y = 1;

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function wrapPi(a) {
  a = (a + Math.PI) % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a - Math.PI;
}

// --- Scratch reutilizado (una actualización es secuencial; no asignamos por frame) ---
const _s = { px: 0, py: 0, pz: 0, tx: 0, tz: 0, index: 0, u: 0 };

// --- Caché de geometría de la línea de carrera por circuito ---
const lineCache = new WeakMap();

function getLineGeom(track) {
  let g = lineCache.get(track);
  if (g) return g;

  let pts = [];
  try {
    const raw = track.getRacingLine();
    if (Array.isArray(raw)) pts = raw;
  } catch (err) {
    pts = [];
  }
  if (pts.length < 4) {
    // Respaldo: muestrear la línea central si la línea de carrera no está aún.
    pts = [];
    for (let i = 0; i < 300; i++) {
      try {
        const p = track.getPointAt(i / 300);
        if (p && typeof p.x === 'number') pts.push(p);
      } catch (err) {
        /* ignore */
      }
    }
  }

  const N = Math.max(1, pts.length);
  const seg = new Float64Array(N);
  const cum = new Float64Array(N + 1);
  let total = 0;
  for (let i = 0; i < N; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % N];
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    seg[i] = d;
    total += d;
    cum[i + 1] = total;
  }
  g = { pts, N, seg, cum, total: Math.max(total, 1e-3), roadHalf: 0 };
  lineCache.set(track, g);
  return g;
}

// Muestrea punto y tangente a `distance` metros por delante del índice `idx`.
function sampleArc(g, idx, distance) {
  const N = g.N;
  let i = ((idx % N) + N) % N;
  let rem = distance;
  if (rem < 0) rem = 0;
  if (rem > g.total) rem = rem % g.total;

  let guard = 0;
  while (rem > g.seg[i] + 1e-9 && guard < N) {
    rem -= g.seg[i];
    i = (i + 1) % N;
    guard++;
  }

  const a = g.pts[i];
  const b = g.pts[(i + 1) % N];
  const u = g.seg[i] > 1e-6 ? clamp(rem / g.seg[i], 0, 1) : 0;
  _s.px = a.x + (b.x - a.x) * u;
  _s.py = a.y + (b.y - a.y) * u;
  _s.pz = a.z + (b.z - a.z) * u;
  let tx = b.x - a.x;
  let tz = b.z - a.z;
  const tl = Math.hypot(tx, tz) || 1;
  _s.tx = tx / tl;
  _s.tz = tz / tl;
  _s.index = i;
  _s.u = u;
  return _s;
}

// Cambio de rumbo (rad, con signo) entre el punto actual y `distance` m más allá.
function curveAngleSigned(g, idx, distance) {
  sampleArc(g, idx, 0.001);
  const h0 = Math.atan2(_s.tx, _s.tz);
  sampleArc(g, idx, distance);
  const h1 = Math.atan2(_s.tx, _s.tz);
  return wrapPi(h1 - h0);
}

function isArray(v) {
  return Array.isArray(v);
}

export function createAIDriver(kart, track, opts = {}) {
  const skill = clamp(typeof opts.skill === 'number' ? opts.skill : 0.7, 0, 1);
  const g = getLineGeom(track);
  const roadHalf = ((track && track.roadWidth) || ROAD_WIDTH) / 2;
  const maxOffset = 0.25 * roadHalf; // ±25 % del medio ancho

  // --- Personalidad determinista por personaje ---
  let hseed = 2166136261;
  const cid = (kart.character && kart.character.id) || 'x';
  for (let i = 0; i < cid.length; i++) {
    hseed ^= cid.charCodeAt(i);
    hseed = Math.imul(hseed, 16777619);
  }
  const rnd = (hseed >>> 0) / 4294967296;
  const phase = rnd * Math.PI * 2;
  const baseSign = rnd < 0.5 ? -1 : 1;
  const baseOffset = baseSign * maxOffset * (0.3 + 0.7 * ((rnd * 7) % 1));

  // --- Índice local sobre la línea de carrera ---
  let lineIdx = 0;
  try {
    const p0 = track.projectToTrack(kart.position, kart.trackT);
    if (p0 && typeof p0.t === 'number') {
      kart.trackT = p0.t;
      lineIdx = ((Math.round(((p0.t % 1) + 1) % 1 * g.N) % g.N) + g.N) % g.N;
    }
  } catch (err) {
    lineIdx = 0;
  }

  // --- Estado interno ---
  let clock = 0;
  let heldItemPrev = null;
  let itemHold = 0;
  let itemUsed = false;
  let drifting = false;
  let driftCooldown = 0;
  let stuckTimer = 0;
  let episode = 0;
  let recovering = 0;
  let recoveryDir = 1;
  let prevT = ((kart.trackT % 1) + 1) % 1;
  let passedHalf = false;
  let crossings = 0;
  let finishTime = null;

  const stats = { skill, respawns: 0, stuckTime: 0, laps: 0, finishTime: null };
  kart.aiStats = stats;

  const controls = kart.controls;
  const maxSpeed = kart.maxSpeed || 32;

  function neutral() {
    controls.throttle = 0;
    controls.brake = 0;
    controls.steer = 0;
    controls.drift = false;
    controls.useItem = false;
  }

  function behindNear(ctx, range) {
    const fx = Math.sin(kart.heading);
    const fz = Math.cos(kart.heading);
    const list = (ctx && ctx.karts) || [];
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (!o || o === kart || !o.position) continue;
      const rx = o.position.x - kart.position.x;
      const rz = o.position.z - kart.position.z;
      const d2 = rx * rx + rz * rz;
      if (d2 > range * range || d2 < 1e-6) continue;
      if (rx * fx + rz * fz < 0) return true; // detrás
    }
    return false;
  }

  function respawn() {
    sampleArc(g, lineIdx, 6);
    const px = _s.px;
    const py = _s.py;
    const pz = _s.pz;
    const heading = Math.atan2(_s.tx, _s.tz);
    const idx = _s.index;
    kart.setTransform({ x: px, y: py, z: pz }, heading);
    kart.trackT = ((idx / g.N) % 1 + 1) % 1;
    lineIdx = ((idx % g.N) + g.N) % g.N;
    stats.respawns += 1;
    stuckTimer = 0;
    episode = 0;
    recovering = 0;
    drifting = false;
    driftCooldown = 0.5;
    prevT = kart.trackT;
    passedHalf = false;
  }

  function shouldUseItem(id, ctx, curve, spd) {
    const places = ctx && ctx.places;
    const place = places && places.get ? places.get(kart) || 4 : 4;

    switch (id) {
      case 'turbo':
        return Math.abs(curve) < 0.1 && spd > 8;
      case 'peel':
        return (
          behindNear(ctx, 15) ||
          itemHold > 4 + (1 - skill) * 4
        );
      case 'bouncer':
        return rivalAhead(ctx, 30, 0.985);
      case 'seeker':
        return rivalAhead(ctx, 60, -1);
      case 'shield':
        return true;
      case 'storm':
        return place >= 4;
      default:
        return false;
    }
  }

  function rivalAhead(ctx, range, minCos) {
    const fx = Math.sin(kart.heading);
    const fz = Math.cos(kart.heading);
    const list = (ctx && ctx.karts) || [];
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (!o || o === kart || !o.position) continue;
      const rx = o.position.x - kart.position.x;
      const rz = o.position.z - kart.position.z;
      const d2 = rx * rx + rz * rz;
      if (d2 > range * range || d2 < 1e-6) continue;
      const dist = Math.sqrt(d2);
      const fwdDot = (rx * fx + rz * fz) / dist;
      if (fwdDot <= 0) continue; // detrás
      if (minCos > -1 && fwdDot < minCos) continue; // fuera del cono
      return true;
    }
    return false;
  }

  function update(dt, ctx) {
    if (!(dt > 0)) dt = 1 / 60;
    clock += dt;

    // Sin control durante el giro por golpe.
    if (kart.state && kart.state.spinTime > 0) {
      neutral();
      return;
    }

    // --- Proyección sobre la pista ---
    let proj;
    try {
      proj = track.projectToTrack(kart.position, kart.trackT);
    } catch (err) {
      proj = null;
    }
    if (proj && typeof proj.t === 'number') kart.trackT = proj.t;
    const surface = (proj && proj.surface) || 'road';

    // --- Índice local (búsqueda hacia delante, retroceso acotado) ---
    const N = g.N;
    let best = lineIdx;
    let bestD = Infinity;
    for (let off = -3; off <= 12; off++) {
      const i = ((lineIdx + off) % N + N) % N;
      const p = g.pts[i];
      if (!p) continue;
      const dx = kart.position.x - p.x;
      const dz = kart.position.z - p.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (bestD > 45 * 45 && proj && typeof proj.t === 'number') {
      best = Math.round((((proj.t % 1) + 1) % 1) * N) % N; // perdido: reanclar
    }
    lineIdx = ((best % N) + N) % N;

    const spd = Math.abs(kart.speed);

    // --- Progreso de carrera (para reporte) ---
    const tNow = ((kart.trackT % 1) + 1) % 1;
    if (tNow > 0.4 && tNow < 0.6) passedHalf = true;
    if (prevT > 0.9 && tNow < 0.1 && passedHalf) {
      passedHalf = false;
      crossings += 1;
      if (crossings >= TOTAL_LAPS && finishTime == null) {
        finishTime = ctx && typeof ctx.raceTime === 'number' ? ctx.raceTime : clock;
        stats.finishTime = finishTime;
      }
    }
    prevT = tNow;
    stats.laps = Math.min(crossings, TOTAL_LAPS);

    // --- Atascos / recuperación ---
    const countdown = !ctx || typeof ctx.raceTime !== 'number' || ctx.raceTime < 0.8;

    if (recovering > 0) {
      recovering -= dt;
      episode += dt;
      controls.throttle = 0;
      controls.brake = 1;
      controls.steer = recoveryDir;
      controls.drift = false;
      controls.useItem = false;
      if (episode > 5) respawn();
      return;
    }

    if (!countdown && spd < 2) {
      stuckTimer += dt;
      episode += dt;
    } else {
      stuckTimer = 0;
      if (spd > 3) episode = 0;
    }
    stats.stuckTime = Math.max(stats.stuckTime, episode);

    if (episode > 5) {
      respawn();
    } else if (stuckTimer > 1.5) {
      stuckTimer = 0;
      recovering = 1.0;
      const lat = proj && typeof proj.lateral === 'number' ? proj.lateral : 0;
      recoveryDir = lat > 0 ? -1 : 1;
      controls.throttle = 0;
      controls.brake = 1;
      controls.steer = recoveryDir;
      controls.drift = false;
      controls.useItem = false;
      return;
    }

    // --- Anticipación y desplazamiento personal ---
    const la = clamp(8 + spd * 0.6 + skill * 2, 8, 25);
    let personal = baseOffset + Math.sin(clock * 0.13 + phase) * maxOffset * 0.5;
    personal = clamp(personal, -maxOffset, maxOffset);

    // --- Evitación de rivales y cáscaras ---
    const fx = Math.sin(kart.heading);
    const fz = Math.cos(kart.heading);
    const lx = fz;
    const lz = -fx;
    let avoid = 0;

    const others = (ctx && ctx.karts) || [];
    for (let i = 0; i < others.length; i++) {
      const o = others[i];
      if (!o || o === kart || !o.position) continue;
      const rx = o.position.x - kart.position.x;
      const rz = o.position.z - kart.position.z;
      const d2 = rx * rx + rz * rz;
      if (d2 > 256 || d2 < 1e-6) continue;
      const dist = Math.sqrt(d2);
      const ahead = rx * fx + rz * fz;
      const side = rx * lx + rz * lz;
      if (ahead > 0 && ahead < 14 && Math.abs(side) < 2.8) {
        let dir = side > 0 ? -1 : 1;
        if (Math.abs(side) < 0.4) dir = baseSign;
        avoid += dir * (1 - ahead / 14) * 2.2 * (0.6 + skill * 0.4);
      }
      void dist;
    }

    if (ctx && ctx.items) {
      let list = null;
      try {
        if (typeof ctx.items.getHazards === 'function') list = ctx.items.getHazards();
        else if (typeof ctx.items.getProjectiles === 'function') list = ctx.items.getProjectiles();
        else if (isArray(ctx.items.peels)) list = ctx.items.peels;
        else if (isArray(ctx.items.projectiles)) list = ctx.items.projectiles;
      } catch (err) {
        list = null;
      }
      if (isArray(list)) {
        for (let i = 0; i < list.length; i++) {
          const h = list[i];
          const hp = h && h.position ? h.position : h;
          if (!hp || typeof hp.x !== 'number') continue;
          const rx = hp.x - kart.position.x;
          const rz = hp.z - kart.position.z;
          const d2 = rx * rx + rz * rz;
          if (d2 > 100 || d2 < 1e-6) continue;
          const ahead = rx * fx + rz * fz;
          const side = rx * lx + rz * lz;
          if (ahead > 0 && ahead < 10 && Math.abs(side) < 2) {
            avoid += (side > 0 ? -1 : 1) * (1 - ahead / 10) * 2.5;
          }
        }
      }
    }

    let offset = clamp(personal + avoid, -maxOffset * 1.6, maxOffset * 1.6);

    // --- Punto objetivo (pure pursuit) ---
    sampleArc(g, lineIdx, la);
    let goalX = _s.px;
    let goalZ = _s.pz;
    const Lx = _s.tz;
    const Lz = -_s.tx;
    goalX += Lx * offset;
    goalZ += Lz * offset;

    // --- Muro: reorientar hacia el centro ---
    if (surface === 'wall') {
      const c = (proj && proj.center) || null;
      const cxx = c && typeof c.x === 'number' ? c.x : kart.position.x;
      const czz = c && typeof c.z === 'number' ? c.z : kart.position.z;
      const tg = (proj && proj.tangent) || null;
      const tgx = tg && typeof tg.x === 'number' ? tg.x : fx;
      const tgz = tg && typeof tg.z === 'number' ? tg.z : fz;
      const wn = proj && proj.wallNormal;
      const wnx = wn && typeof wn.x === 'number' ? wn.x : 0;
      const wnz = wn && typeof wn.z === 'number' ? wn.z : 0;
      goalX = cxx + tgx * 6 + wnx * 5;
      goalZ = czz + tgz * 6 + wnz * 5;
      offset = 0;
    }

    // --- Dirección (pure pursuit) ---
    const desired = Math.atan2(goalX - kart.position.x, goalZ - kart.position.z);
    const diff = wrapPi(desired - kart.heading);
    let gain = 1.5 + skill * 1.0;
    gain *= 1 - 0.25 * Math.min(1, spd / maxSpeed);
    const steer = clamp(diff * gain, -1, 1);

    // --- Curvatura (ángulo entre tangentes a 15 m y 40 m) ---
    const a15 = curveAngleSigned(g, lineIdx, 15);
    const a40 = curveAngleSigned(g, lineIdx, 40);
    const curve = Math.max(Math.abs(a15), Math.abs(a40) * 0.8);

    // --- Rubber-banding suave respecto al jugador ---
    let rubber = 0;
    const places = ctx && ctx.places;
    const player = ctx && ctx.player;
    if (places && places.get && player && player !== kart) {
      const my = places.get(kart);
      const pp = places.get(player);
      if (my && pp) {
        const d = my - pp; // >0 = por detrás del jugador
        if (d > 0) rubber = Math.min(0.08, d * 0.015);
        else if (d < 0) rubber = Math.max(-0.06, d * 0.012);
      }
    }

    // --- Velocidad objetivo ---
    let allow = 1 - curve * (1.5 - skill * 0.6);
    allow *= 1 + rubber;
    allow = clamp(allow, 0.2, 1.1);
    let targetSpeed = maxSpeed * allow * (0.95 + skill * 0.05);
    if (surface === 'wall') targetSpeed = Math.min(targetSpeed, maxSpeed * 0.4);

    let throttle = 0;
    let brake = 0;
    const err = targetSpeed - spd;
    if (err > 0.5) throttle = 1;
    else if (err > -0.5) throttle = 0.6;
    else {
      throttle = 0;
      brake = Math.min(1, -err / 9);
    }
    if (surface === 'offroad') {
      throttle = Math.max(throttle, 0.85);
      brake = 0;
    }

    // --- Derrape ---
    if (driftCooldown > 0) driftCooldown -= dt;
    const signed = a40;
    const absCurve = Math.abs(signed);
    const driftMin = 0.32 - skill * 0.06;
    const targetLevel = skill < 0.35 ? 1 : skill < 0.72 ? 2 : 3;
    let wantDrift = false;

    if (drifting) {
      if (absCurve < driftMin * 0.55 || spd < 7 || surface === 'wall') {
        drifting = false;
        driftCooldown = 0.25;
      } else if (kart.state && kart.state.driftLevel >= targetLevel) {
        drifting = false;
        wantDrift = false;
        driftCooldown = 0.35; // suelta para cobrar el mini-turbo
      } else {
        wantDrift = true;
      }
    } else if (
      skill > 0.2 &&
      absCurve > driftMin &&
      spd > 11 &&
      driftCooldown <= 0 &&
      surface !== 'wall' &&
      !(kart.state && kart.state.airborne)
    ) {
      drifting = true;
      wantDrift = true;
    }

    // --- Objetos ---
    let held = null;
    const items = ctx && ctx.items;
    if (items) {
      try {
        if (typeof items.isRolling === 'function' && items.isRolling(kart)) held = null;
        else if (typeof items.getHeldItem === 'function') {
          const h = items.getHeldItem(kart);
          if (typeof h === 'string') held = h;
        }
      } catch (err) {
        held = null;
      }
    }
    if (held !== heldItemPrev) {
      heldItemPrev = held;
      itemHold = 0;
      itemUsed = false;
    }
    let useItem = false;
    if (held && !itemUsed) {
      itemHold += dt;
      if (itemHold >= 0.15 && shouldUseItem(held, ctx, curve, spd)) {
        useItem = true;
        itemUsed = true;
      }
    }

    // --- Asignar controles ---
    controls.throttle = throttle;
    controls.brake = brake;
    controls.steer = steer;
    controls.drift = wantDrift;
    controls.useItem = useItem;

    void offset;
    void UP_Y;
  }

  return {
    update,
    skill,
    get respawns() {
      return stats.respawns;
    },
    get stuckTime() {
      return stats.stuckTime;
    },
    get finishTime() {
      return stats.finishTime;
    },
    stats,
  };
}
