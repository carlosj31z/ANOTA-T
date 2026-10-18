// BLOQUE 4 — OBJETOS (contrato §4.4, SPEC C6/C11, tanda 3 §9 + tanda 4 §10.2).
//
// Lógica de jugabilidad intacta (cajas, ruleta, 6 objetos, reparto por posición)
// + ventaja `mecanico` de Max Tuerca (ruleta en 0.9 s y reparto como si fuera 2
// puestos peor, máx. 8).
//
// Presentación next-gen 100 % procedural (ver ./gfx.js): cajas de cristal
// redondeado con "?" 3D emisivo y barrido arcoíris, peel de piel orgánica,
// bouncer con placas hexagonales, seeker de energía con fresnel y anillos,
// escudo de aura fresnel arcoíris, tormenta con nube + rayo + destello, y
// sombras de contacto. Todos los pools usan InstancedMesh (≤ 15 draw calls) y
// no se crea ningún objeto THREE por frame.

import * as THREE from 'three';
import { EVENTS, ITEM_IDS } from '../shared/constants.js';
import { hasPerk } from '../shared/characters.js';
import { getAssets, disposeAssets } from './gfx.js';

// ---------------------------------------------------------------------------
// Tabla de reparto por posición de carrera (1..8). Pesos relativos.
// ---------------------------------------------------------------------------
export const ITEM_TABLE = {
  1: [
    { id: 'peel', w: 45 },
    { id: 'bouncer', w: 35 },
    { id: 'turbo', w: 20 },
  ],
  2: [
    { id: 'peel', w: 25 },
    { id: 'bouncer', w: 25 },
    { id: 'turbo', w: 30 },
    { id: 'seeker', w: 20 },
  ],
  3: [
    { id: 'peel', w: 18 },
    { id: 'bouncer', w: 22 },
    { id: 'turbo', w: 30 },
    { id: 'seeker', w: 30 },
  ],
  4: [
    { id: 'turbo', w: 35 },
    { id: 'seeker', w: 30 },
    { id: 'shield', w: 35 },
  ],
  5: [
    { id: 'turbo', w: 25 },
    { id: 'seeker', w: 30 },
    { id: 'shield', w: 25 },
    { id: 'storm', w: 20 },
  ],
  6: [
    { id: 'turbo', w: 25 },
    { id: 'seeker', w: 30 },
    { id: 'shield', w: 25 },
    { id: 'storm', w: 20 },
  ],
  7: [
    { id: 'turbo', w: 25 },
    { id: 'seeker', w: 30 },
    { id: 'shield', w: 25 },
    { id: 'storm', w: 20 },
  ],
  8: [
    { id: 'turbo', w: 30 },
    { id: 'seeker', w: 30 },
    { id: 'shield', w: 20 },
    { id: 'storm', w: 20 },
  ],
};

const ROULETTE_DURATION = 2.0;
const ROULETTE_DURATION_MECANICO = 0.9;
const MECANICO_PLACE_OFFSET = 2; // "como si fuera 2 puestos peor"
const ROULETTE_FAST = 0.08;
const ROULETTE_SLOW = 0.28;
const BOX_RESPAWN = 3.0;
const BOX_POP_TIME = 0.22;
const BOX_GROW_TIME = 0.4;
const BOX_PICK_RADIUS = 2.0;

const PEEL_DROP_DISTANCE = 2.5;
const PEEL_HIT_RADIUS = 1.6;
const PEEL_MAX = 8;

const BOUNCER_LIFE = 6.0;
const BOUNCER_MIN_SPEED = 45;
const BOUNCER_MAX_BOUNCES = 3;

const SEEKER_LIFE = 10.0;
const SEEKER_LOCK_DIST = 25.0;

const SHIELD_DURATION = 7.0;
const SHIELD_BOOST_STRENGTH = 0.6;

const PROJ_POOL_SIZE = 16;
const PEEL_POOL_SIZE = 8;
const SHIELD_POOL_SIZE = 8;
const DEBRIS_POOL_SIZE = 48;
const DEBRIS_PER_BOX = 6;
const DEBRIS_LIFE = 0.9;

const STORM_POOL_SIZE = 7;
const STORM_DURATION = 1.2;
const CLOUD_PUFFS = 6;

const PERK_EVENT = 'kart:perk';

// --- helpers de ventaja (puros: verificables numéricamente) -----------------
export function rouletteDuration(kart) {
  return hasPerk(kart, 'mecanico') ? ROULETTE_DURATION_MECANICO : ROULETTE_DURATION;
}

export function effectiveItemPlace(kart, place) {
  const p = Number.isFinite(place) ? place : 1;
  const offset = hasPerk(kart, 'mecanico') ? MECANICO_PLACE_OFFSET : 0;
  return Math.min(8, Math.max(1, p + offset));
}

// ---------------------------------------------------------------------------
// Temporales reutilizados (cero allocations por frame).
// ---------------------------------------------------------------------------
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _axisZ = new THREE.Vector3(0, 0, 1);
const _axisY = new THREE.Vector3(0, 1, 0);
const _axisX = new THREE.Vector3(1, 0, 0);
const _color = new THREE.Color();

function hash3(a, b, c) {
  const h = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
  return h - Math.floor(h);
}

export function weightedPick(place) {
  const table = ITEM_TABLE[place] || ITEM_TABLE[4];
  let total = 0;
  for (const e of table) total += e.w;
  let r = Math.random() * total;
  for (const e of table) {
    r -= e.w;
    if (r <= 0) return e.id;
  }
  return table[table.length - 1].id;
}

// Reparto efectivo de un kart en una posición dada (aplica la ventaja mecánico).
export function rollItemFor(kart, place) {
  return weightedPick(effectiveItemPlace(kart, place));
}

function randomRollDisplay() {
  return ITEM_IDS[(Math.random() * ITEM_IDS.length) | 0];
}

function makeInstanced(geo, mat, capacity, renderOrder = 0) {
  const mesh = new THREE.InstancedMesh(geo, mat, capacity);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.count = 0;
  mesh.visible = false;
  mesh.renderOrder = renderOrder;
  return mesh;
}

function composeInst(mesh, i, pos, quat, sx, sy, sz) {
  _s.set(sx, sy, sz);
  _m.compose(pos, quat, _s);
  mesh.setMatrixAt(i, _m);
}

function finalizeInst(mesh, count) {
  mesh.count = count;
  mesh.visible = count > 0;
  if (count > 0) mesh.instanceMatrix.needsUpdate = true;
}

export function createItemSystem(scene, track, events) {
  const g = getAssets();

  const group = new THREE.Group();
  group.name = 'items';
  scene.add(group);

  const boxPositions = (track && track.itemBoxPositions) || [];
  const boxCount = boxPositions.length;

  const stats = {
    boxes: 0,
    used: { turbo: 0, peel: 0, bouncer: 0, seeker: 0, shield: 0, storm: 0 },
    exploded: 0,
  };
  if (typeof window !== 'undefined' && window.location && String(window.location.search).includes('autotest=1')) {
    window.__itemsStats = stats;
  }

  // -------------------------------------------------------------------------
  // Cajas de objeto (cristal + "?" + barrido arcoíris), instanciadas.
  // -------------------------------------------------------------------------
  const boxGroup = new THREE.Group();
  boxGroup.name = 'item-boxes';
  group.add(boxGroup);

  const SPARKS_PER_BOX = 3;
  let boxMesh = null;
  let questionMesh = null;
  let rainbowMesh = null;
  let sparkPoints = null;
  let sparkGeo = null;
  let sparkPos = null;
  let sparkCol = null;
  const boxes = [];
  if (boxCount > 0) {
    boxMesh = makeInstanced(g.boxGeo, g.boxMat, boxCount, 1);
    questionMesh = makeInstanced(g.questionGeo, g.questionMat, boxCount, 2);
    rainbowMesh = makeInstanced(g.rainbowGeo, g.rainbowMat, boxCount, 2);
    boxGroup.add(boxMesh, questionMesh, rainbowMesh);

    sparkGeo = new THREE.BufferGeometry();
    sparkPos = new Float32Array(boxCount * SPARKS_PER_BOX * 3);
    sparkCol = new Float32Array(boxCount * SPARKS_PER_BOX * 3);
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
    sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkCol, 3));
    sparkPoints = new THREE.Points(sparkGeo, g.sparkMat);
    sparkPoints.frustumCulled = false;
    sparkPoints.renderOrder = 2;
    boxGroup.add(sparkPoints);

    for (let i = 0; i < boxCount; i++) {
      boxes.push({ pos: boxPositions[i].clone(), phase: 'idle', timer: 0, scale: 1, phase0: i * 0.7 });
    }
  }

  const heldItems = new Map(); // kart -> itemId
  const roulettes = new Map(); // kart -> { t, swapTimer, display, result }

  // -------------------------------------------------------------------------
  // Peels (piel orgánica), instanciados.
  // -------------------------------------------------------------------------
  const peelGroup = new THREE.Group();
  peelGroup.name = 'peels';
  group.add(peelGroup);
  const peelMesh = makeInstanced(g.peelGeo, g.peelMat, PEEL_POOL_SIZE, 0);
  peelGroup.add(peelMesh);

  const peelPool = [];
  const peels = []; // activos: { index, pos }
  for (let i = 0; i < PEEL_POOL_SIZE; i++) {
    peelPool.push({ active: false, pos: new THREE.Vector3() });
  }
  let peelCursor = 0;

  function acquirePeel() {
    for (let k = 0; k < PEEL_POOL_SIZE; k++) {
      const idx = (peelCursor + k) % PEEL_POOL_SIZE;
      if (!peelPool[idx].active) {
        peelCursor = (idx + 1) % PEEL_POOL_SIZE;
        return peelPool[idx];
      }
    }
    const pool = peelPool[peelCursor];
    peelCursor = (peelCursor + 1) % PEEL_POOL_SIZE;
    return pool;
  }

  // -------------------------------------------------------------------------
  // Proyectiles (bouncer y seeker), instanciados.
  // -------------------------------------------------------------------------
  const projGroup = new THREE.Group();
  projGroup.name = 'projectiles';
  group.add(projGroup);

  const bouncerMesh = makeInstanced(g.bouncerGeo, g.bouncerMat, PROJ_POOL_SIZE, 0);
  const seekerCoreMesh = makeInstanced(g.seekerCoreGeo, g.seekerCoreMat, PROJ_POOL_SIZE, 0);
  const seekerRingMesh = makeInstanced(g.seekerRingGeo, g.seekerRingMat, PROJ_POOL_SIZE, 0);
  const seekerShellMesh = makeInstanced(g.seekerShellGeo, g.seekerShellMat, PROJ_POOL_SIZE, 1);
  projGroup.add(bouncerMesh, seekerCoreMesh, seekerRingMesh, seekerShellMesh);

  const projectiles = [];
  for (let i = 0; i < PROJ_POOL_SIZE; i++) {
    projectiles.push({
      active: false,
      type: null,
      index: i,
      pos: new THREE.Vector3(),
      dir: new THREE.Vector3(0, 0, 1),
      speed: 0,
      life: 0,
      time: 0,
      bounces: 0,
      owner: null,
      hintT: 0,
      spin: 0,
      phase: Math.random() * 10,
    });
  }
  let projCursor = 0;

  function acquireProjectile() {
    for (let k = 0; k < PROJ_POOL_SIZE; k++) {
      const idx = (projCursor + k) % PROJ_POOL_SIZE;
      if (!projectiles[idx].active) {
        projCursor = (idx + 1) % PROJ_POOL_SIZE;
        return projectiles[idx];
      }
    }
    const entry = projectiles[projCursor];
    projCursor = (projCursor + 1) % PROJ_POOL_SIZE;
    return entry;
  }

  // -------------------------------------------------------------------------
  // Escudo (aura fresnel arcoíris), instanciado por kart.
  // -------------------------------------------------------------------------
  const shieldGroup = new THREE.Group();
  shieldGroup.name = 'shields';
  group.add(shieldGroup);
  const shieldMesh = makeInstanced(g.shieldGeo, g.shieldMat, SHIELD_POOL_SIZE, 3);
  shieldGroup.add(shieldMesh);

  // -------------------------------------------------------------------------
  // Tormenta: nube (puffs), rayo (línea) y destello.
  // -------------------------------------------------------------------------
  const stormGroup = new THREE.Group();
  stormGroup.name = 'storms';
  group.add(stormGroup);

  const cloudMesh = makeInstanced(g.cloudGeo, g.cloudMat, STORM_POOL_SIZE * CLOUD_PUFFS, 4);
  const flashMesh = makeInstanced(g.flashGeo, g.flashMat, STORM_POOL_SIZE, 5);
  stormGroup.add(cloudMesh, flashMesh);
  const boltLine = new THREE.LineSegments(g.boltGeo, g.boltMat);
  boltLine.frustumCulled = false;
  boltLine.renderOrder = 6;
  stormGroup.add(boltLine);

  const storms = []; // { active, kart, t, seed, pos }
  for (let i = 0; i < STORM_POOL_SIZE; i++) {
    storms.push({ active: false, kart: null, t: 0, seed: 0, pos: new THREE.Vector3() });
  }
  let stormCursor = 0;

  // -------------------------------------------------------------------------
  // Fragmentos de caja y sombras de contacto.
  // -------------------------------------------------------------------------
  const debrisGroup = new THREE.Group();
  debrisGroup.name = 'debris';
  group.add(debrisGroup);
  const debrisMesh = makeInstanced(g.shardGeo, g.shardMat, DEBRIS_POOL_SIZE, 2);
  debrisGroup.add(debrisMesh);

  const debris = [];
  for (let i = 0; i < DEBRIS_POOL_SIZE; i++) {
    debris.push({
      active: false,
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      life: 0,
      spin: new THREE.Vector3(),
      rot: new THREE.Euler(),
    });
  }
  let debrisCursor = 0;

  const blobsMesh = makeInstanced(g.blobGeo, g.blobMat, boxCount + PEEL_POOL_SIZE + PROJ_POOL_SIZE, 0);
  blobsMesh.castShadow = false;
  group.add(blobsMesh);

  // -------------------------------------------------------------------------
  // Lógica de juego (sin cambios de comportamiento salvo la ventaja mecánico).
  // -------------------------------------------------------------------------
  let time = 0;

  function groundAt(pos, hintT) {
    const proj = track.projectToTrack(pos, hintT);
    return { y: proj.groundY, proj };
  }

  function startRoulette(kart) {
    roulettes.set(kart, {
      t: 0,
      swapTimer: 0,
      display: randomRollDisplay(),
      result: null,
    });
  }

  function resolveRoulette(kart, roll, ctx) {
    const place = (ctx && ctx.places && ctx.places.get(kart)) || 1;
    const itemId = rollItemFor(kart, place);
    roll.result = itemId;
    heldItems.set(kart, itemId);
    events.emit(EVENTS.ITEM_GOT, { kart, itemId });
    if (hasPerk(kart, 'mecanico')) {
      events.emit(PERK_EVENT, { kart, perkId: 'mecanico' });
    }
  }

  function collectBox(box, kart) {
    box.phase = 'pop';
    box.timer = 0;
    stats.boxes += 1;
    events.emit(EVENTS.ITEM_BOX, { kart, position: box.pos.clone() });
    spawnDebris(box.pos);
    if (!heldItems.has(kart) && !roulettes.has(kart)) startRoulette(kart);
  }

  function spawnDebris(pos) {
    for (let k = 0; k < DEBRIS_PER_BOX; k++) {
      const d = debris[debrisCursor];
      debrisCursor = (debrisCursor + 1) % DEBRIS_POOL_SIZE;
      d.active = true;
      d.life = DEBRIS_LIFE;
      d.pos.copy(pos);
      const a = Math.random() * Math.PI * 2;
      const up = 2.4 + Math.random() * 2.6;
      const out = 2.0 + Math.random() * 2.4;
      d.vel.set(Math.cos(a) * out, up, Math.sin(a) * out);
      d.spin.set((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18);
      d.rot.set(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28);
    }
  }

  function updateBoxes(dt, karts) {
    if (boxCount === 0 || !boxMesh) return;

    g.rainbowMat.uniforms.uTime.value = time;

    let n = 0;
    const hue = (time * 0.12) % 1;

    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      let scale = box.scale;

      if (box.phase === 'idle') {
        scale = 1;
        for (const kart of karts) {
          if (!kart || !kart.controls) continue;
          if (kart.state && kart.state.spinTime > 0) continue;
          const dx = kart.position.x - box.pos.x;
          const dz = kart.position.z - box.pos.z;
          if (dx * dx + dz * dz < BOX_PICK_RADIUS * BOX_PICK_RADIUS) {
            collectBox(box, kart);
            scale = 1;
            break;
          }
        }
      } else if (box.phase === 'pop') {
        box.timer += dt;
        const p = Math.min(1, box.timer / BOX_POP_TIME);
        scale = 1 + 1.3 * p;
        if (p >= 1) {
          box.phase = 'hidden';
          box.timer = 0;
          scale = 0;
        }
      } else if (box.phase === 'hidden') {
        box.timer += dt;
        scale = 0;
        if (box.timer >= BOX_RESPAWN) {
          box.phase = 'grow';
          box.timer = 0;
        }
      } else if (box.phase === 'grow') {
        box.timer += dt;
        const p = Math.min(1, box.timer / BOX_GROW_TIME);
        scale = p;
        if (p >= 1) {
          box.phase = 'idle';
          box.timer = 0;
          scale = 1;
        }
      }
      box.scale = scale;
      if (scale <= 0.001) continue;

      const bob = Math.sin(time * 2 + box.phase0) * 0.18;
      const spin = time * 1.2 + box.phase0;
      _v.set(box.pos.x, box.pos.y + bob, box.pos.z);
      _q.setFromAxisAngle(_axisY, spin);
      _q2.setFromAxisAngle(_axisZ, Math.sin(time * 0.8 + box.phase0) * 0.35);
      _q.multiply(_q2);

      composeInst(boxMesh, n, _v, _q, scale, scale, scale);
      composeInst(questionMesh, n, _v, _q, scale, scale, scale);
      composeInst(rainbowMesh, n, _v, _q, scale, scale, scale);
      n++;
    }

    // Chispas mágicas sutiles alrededor de cada caja.
    if (sparkPoints) {
      for (let i = 0; i < boxes.length; i++) {
        const box = boxes[i];
        const base = i * SPARKS_PER_BOX;
        if (box.scale <= 0.001) {
          for (let k = 0; k < SPARKS_PER_BOX; k++) sparkPos[(base + k) * 3 + 1] = -10000;
          continue;
        }
        const bob = Math.sin(time * 2 + box.phase0) * 0.18;
        for (let k = 0; k < SPARKS_PER_BOX; k++) {
          const a = time * 1.6 + k * 2.094 + box.phase0;
          const rr = 0.95 + Math.sin(time * 2.3 + k * 1.7) * 0.12;
          const o = (base + k) * 3;
          sparkPos[o] = box.pos.x + Math.cos(a) * rr;
          sparkPos[o + 1] = box.pos.y + bob + Math.sin(time * 3.1 + k * 2.0) * 0.75;
          sparkPos[o + 2] = box.pos.z + Math.sin(a) * rr;
          _color.setHSL((time * 0.2 + k * 0.34 + box.phase0) % 1, 0.9, 0.62);
          sparkCol[o] = _color.r;
          sparkCol[o + 1] = _color.g;
          sparkCol[o + 2] = _color.b;
        }
      }
      sparkGeo.attributes.position.needsUpdate = true;
      sparkGeo.attributes.color.needsUpdate = true;
    }

    finalizeInst(boxMesh, n);
    finalizeInst(questionMesh, n);
    finalizeInst(rainbowMesh, n);
  }

  function updateRoulettes(dt, karts, ctx) {
    for (const kart of karts) {
      const roll = roulettes.get(kart);
      if (!roll) continue;
      roll.t += dt;

      if (roll.result != null) {
        roulettes.delete(kart);
        continue;
      }

      const duration = rouletteDuration(kart);
      const progress = Math.min(1, roll.t / duration);
      const interval = ROULETTE_FAST + (ROULETTE_SLOW - ROULETTE_FAST) * progress * progress;
      roll.swapTimer += dt;
      if (roll.swapTimer >= interval) {
        roll.swapTimer = 0;
        roll.display = randomRollDisplay();
      }

      if (roll.t >= duration) {
        resolveRoulette(kart, roll, ctx);
        roulettes.delete(kart);
      }
    }
  }

  function doUse(kart, itemId, ctx) {
    stats.used[itemId] = (stats.used[itemId] || 0) + 1;

    if (itemId === 'turbo') {
      kart.applyBoost(1.2, 1, 'item');
    } else if (itemId === 'peel') {
      dropPeel(kart);
    } else if (itemId === 'bouncer') {
      spawnBouncer(kart);
    } else if (itemId === 'seeker') {
      spawnSeeker(kart);
    } else if (itemId === 'shield') {
      kart.state.shieldTime = SHIELD_DURATION;
      kart.applyBoost(SHIELD_DURATION, SHIELD_BOOST_STRENGTH, 'item');
    } else if (itemId === 'storm') {
      useStorm(kart, ctx);
    }
  }

  function consumeUses(ctx, karts) {
    for (const kart of karts) {
      if (!kart || !kart.controls) continue;
      if (!kart.controls.useItem) continue;
      kart.controls.useItem = false;
      const itemId = heldItems.get(kart);
      if (!itemId) continue;
      heldItems.delete(kart);
      events.emit(EVENTS.ITEM_USE, { kart, itemId });
      doUse(kart, itemId, ctx);
    }
  }

  // --- peel ---
  function dropPeel(kart) {
    const fwd = kart.getForward();
    const pos = kart.position.clone().addScaledVector(fwd, -PEEL_DROP_DISTANCE);
    pos.y = groundAt(pos, kart.trackT).y + 0.05;

    if (peels.length >= PEEL_MAX) {
      const oldest = peels.shift();
      oldest.active = false;
    }

    const pool = acquirePeel();
    // Por si el pool devuelto seguía referenciado en la lista de activos.
    for (let i = peels.length - 1; i >= 0; i--) {
      if (peels[i] === pool) peels.splice(i, 1);
    }
    pool.active = true;
    pool.pos.copy(pos);
    pool.phase = Math.random() * 6.28;
    peels.push(pool);
  }

  function updatePeels(dt, karts) {
    let count = 0;
    for (let i = peels.length - 1; i >= 0; i--) {
      const peel = peels[i];
      for (const kart of karts) {
        if (!kart || !kart.state) continue;
        if (kart.state.shieldTime > 0) continue;
        const dx = kart.position.x - peel.pos.x;
        const dz = kart.position.z - peel.pos.z;
        if (dx * dx + dz * dz < PEEL_HIT_RADIUS * PEEL_HIT_RADIUS) {
          kart.hit('peel');
          peel.active = false;
          peels.splice(i, 1);
          break;
        }
      }
    }
    for (const peel of peels) {
      const wobble = Math.sin(time * 3 + peel.phase) * 0.12;
      _q.setFromAxisAngle(_axisY, time * 1.5 + peel.phase);
      _q2.setFromAxisAngle(_axisZ, wobble);
      _q.multiply(_q2);
      composeInst(peelMesh, count, peel.pos, _q, 1, 1, 1);
      count++;
    }
    finalizeInst(peelMesh, count);
  }

  // --- bouncer ---
  function spawnBouncer(kart) {
    const entry = acquireProjectile();
    const fwd = kart.getForward();
    const speed = Math.max(BOUNCER_MIN_SPEED, (kart.maxSpeed || 32) * 1.6);

    entry.active = true;
    entry.type = 'bouncer';
    entry.pos.copy(kart.position).addScaledVector(fwd, 1.8);
    entry.pos.y = groundAt(entry.pos, kart.trackT).y + 0.5;
    entry.dir.set(fwd.x, 0, fwd.z).normalize();
    entry.speed = speed;
    entry.life = BOUNCER_LIFE;
    entry.time = 0;
    entry.bounces = 0;
    entry.owner = kart;
    entry.hintT = kart.trackT;
    entry.spin = 0;
  }

  // --- seeker ---
  function spawnSeeker(kart) {
    const entry = acquireProjectile();
    const fwd = kart.getForward();
    const speed = Math.max(BOUNCER_MIN_SPEED, (kart.maxSpeed || 32) * 1.4);

    entry.active = true;
    entry.type = 'seeker';
    entry.pos.copy(kart.position).addScaledVector(fwd, 1.8);
    entry.pos.y = groundAt(entry.pos, kart.trackT).y + 0.5;
    entry.dir.set(fwd.x, 0, fwd.z).normalize();
    entry.speed = speed;
    entry.life = SEEKER_LIFE;
    entry.time = 0;
    entry.bounces = 0;
    entry.owner = kart;
    entry.hintT = kart.trackT;
    entry.spin = 0;
  }

  function kartAtPlace(ctx, place) {
    if (!ctx || !ctx.karts || !ctx.places) return null;
    for (const k of ctx.karts) {
      if (ctx.places.get(k) === place) return k;
    }
    return null;
  }

  function explode(pos, itemId) {
    stats.exploded += 1;
    events.emit(EVENTS.ITEM_EXPLODE, { position: pos.clone(), itemId });
  }

  function projectileHitsKart(entry, karts, itemId) {
    for (const kart of karts) {
      if (!kart || !kart.state) continue;
      if (kart === entry.owner && entry.time < 0.4) continue;
      const dx = kart.position.x - entry.pos.x;
      const dz = kart.position.z - entry.pos.z;
      const rr = (kart.radius || 1.3) + 0.6;
      if (dx * dx + dz * dz < rr * rr) {
        if (kart.state.shieldTime <= 0) kart.hit(itemId);
        explode(entry.pos, itemId);
        return true;
      }
    }
    return false;
  }

  function updateProjectiles(dt, ctx, karts) {
    let bouncerCount = 0;
    let seekerCount = 0;

    for (const entry of projectiles) {
      if (!entry.active) continue;

      entry.time += dt;
      entry.life -= dt;
      if (entry.life <= 0) {
        entry.active = false;
        continue;
      }

      const proj = track.projectToTrack(entry.pos, entry.hintT);
      entry.hintT = proj.t;

      if (entry.type === 'bouncer') {
        entry.pos.addScaledVector(entry.dir, entry.speed * dt);
        entry.pos.y = proj.groundY + 0.5;

        if (proj.surface === 'wall' && proj.wallNormal) {
          const nrm = proj.wallNormal;
          const dot = entry.dir.x * nrm.x + entry.dir.z * nrm.z;
          entry.dir.x -= 2 * dot * nrm.x;
          entry.dir.z -= 2 * dot * nrm.z;
          entry.dir.normalize();
          entry.pos.addScaledVector(nrm, 0.8);
          entry.bounces += 1;
          entry.spin += 6;
          if (entry.bounces >= BOUNCER_MAX_BOUNCES) {
            explode(entry.pos, 'bouncer');
            entry.active = false;
            continue;
          }
        }

        if (projectileHitsKart(entry, karts, 'bouncer')) {
          entry.active = false;
          continue;
        }

        _q.setFromAxisAngle(_axisY, entry.time * 6 + entry.phase);
        _q2.setFromAxisAngle(_axisX, entry.time * 4.5);
        _q.multiply(_q2);
        const sc = 1 + Math.sin(entry.time * 14 + entry.phase) * 0.04;
        composeInst(bouncerMesh, bouncerCount, entry.pos, _q, sc, sc, sc);
        bouncerCount++;
      } else {
        // seeker
        const myPlace = (ctx.places && ctx.places.get(entry.owner)) || 1;
        const target = kartAtPlace(ctx, myPlace - 1);

        if (target) {
          const dx = target.position.x - entry.pos.x;
          const dz = target.position.z - entry.pos.z;
          const d = Math.hypot(dx, dz);
          if (d < SEEKER_LOCK_DIST && d > 1e-3) {
            _v.set(dx / d, 0, dz / d);
          } else {
            _v.copy(proj.tangent);
            _v.y = 0;
            _v.normalize();
          }
        } else {
          _v.copy(entry.dir);
        }

        entry.dir.lerp(_v, Math.min(1, dt * 4.5));
        entry.dir.y = 0;
        if (entry.dir.lengthSq() > 1e-6) entry.dir.normalize();

        entry.pos.addScaledVector(entry.dir, entry.speed * dt);
        entry.pos.y = proj.groundY + 0.5;

        if (proj.surface === 'wall' && proj.wallNormal) {
          const nrm = proj.wallNormal;
          const dot = entry.dir.x * nrm.x + entry.dir.z * nrm.z;
          entry.dir.x -= 2 * dot * nrm.x;
          entry.dir.z -= 2 * dot * nrm.z;
          entry.dir.normalize();
          entry.pos.addScaledVector(nrm, 0.8);
        }

        if (projectileHitsKart(entry, karts, 'seeker')) {
          entry.active = false;
          continue;
        }

        _v.copy(entry.dir).normalize();
        _q.setFromUnitVectors(_axisZ, _v);
        _q2.setFromAxisAngle(_axisZ, entry.time * 8);
        _q.multiply(_q2);

        const pulse = 1 + Math.sin(entry.time * 16) * 0.1;
        composeInst(seekerCoreMesh, seekerCount, entry.pos, _q, pulse, pulse, pulse);

        _q2.setFromAxisAngle(_axisZ, entry.time * 3.5);
        _q.multiply(_q2);
        composeInst(seekerRingMesh, seekerCount, entry.pos, _q, 1, 1, 1);

        composeInst(seekerShellMesh, seekerCount, entry.pos, _q, pulse, pulse, pulse);
        seekerCount++;
      }
    }

    finalizeInst(bouncerMesh, bouncerCount);
    finalizeInst(seekerCoreMesh, seekerCount);
    finalizeInst(seekerRingMesh, seekerCount);
    finalizeInst(seekerShellMesh, seekerCount);
  }

  function useStorm(kart, ctx) {
    const myPlace = (ctx && ctx.places && ctx.places.get(kart)) || 1;
    if (!ctx || !ctx.karts) return;
    for (const other of ctx.karts) {
      if (!other || other === kart || !other.state) continue;
      const p = ctx.places ? ctx.places.get(other) : null;
      if (p == null || p >= myPlace) continue;
      if (other.state.shieldTime > 0) continue;
      other.hit('storm');
      explode(other.position, 'storm');
      spawnStorm(other);
    }
  }

  function spawnStorm(victim) {
    const s = storms[stormCursor];
    stormCursor = (stormCursor + 1) % STORM_POOL_SIZE;
    s.active = true;
    s.kart = victim;
    s.t = 0;
    s.seed = Math.random() * 100;
    s.pos.copy(victim.position);
  }

  function updateStorms(dt) {
    let puffCount = 0;
    let flashCount = 0;
    let boltVerts = 0;
    const positions = g.boltPositions;

    for (const s of storms) {
      if (!s.active) continue;
      s.t += dt;
      if (s.t >= STORM_DURATION || !s.kart) {
        s.active = false;
        s.kart = null;
        continue;
      }
      const p = s.kart.position;
      s.pos.lerp(p, Math.min(1, dt * 6));

      const life = 1 - s.t / STORM_DURATION;
      const cloudY = s.pos.y + 3.0;

      // Puffs de la nube.
      for (let k = 0; k < CLOUD_PUFFS; k++) {
        const a = (k / CLOUD_PUFFS) * Math.PI * 2 + s.t * 2.2;
        const rad = 0.9 + hash3(s.seed, k, 1) * 0.8;
        const px = s.pos.x + Math.cos(a) * rad;
        const pz = s.pos.z + Math.sin(a) * rad;
        const py = cloudY + (hash3(s.seed, k, 2) - 0.5) * 0.7 + Math.sin(s.t * 9 + k) * 0.12;
        _v.set(px, py, pz);
        _q.setFromAxisAngle(_axisY, s.t * 0.8 + k);
        const sz = (1.3 + hash3(s.seed, k, 3) * 0.9) * (0.6 + life * 0.4);
        composeInst(cloudMesh, puffCount, _v, _q, sz, sz * 0.7, sz);
        puffCount++;
      }

      // Rayo quebrado (se regenera unas 15 veces/s).
      const seedTick = Math.floor(s.t * 15);
      let px = s.pos.x + (hash3(s.seed, seedTick, 7) - 0.5) * 0.3;
      let py = cloudY - 0.5;
      let pz = s.pos.z + (hash3(s.seed, seedTick, 8) - 0.5) * 0.3;
      const segs = 7;
      for (let k = 1; k <= segs; k++) {
        const tt = k / segs;
        const jit = (1 - tt) * 0.9;
        const nx = s.pos.x + (hash3(s.seed, seedTick, k * 3 + 1) - 0.5) * jit;
        const ny = cloudY - 0.5 + (s.pos.y + 0.7 - (cloudY - 0.5)) * tt;
        const nz = s.pos.z + (hash3(s.seed, seedTick, k * 3 + 2) - 0.5) * jit;
        if (boltVerts + 2 <= g.MAX_BOLT_VERTS) {
          let o = boltVerts * 3;
          positions[o++] = px;
          positions[o++] = py;
          positions[o++] = pz;
          positions[o++] = nx;
          positions[o++] = ny;
          positions[o++] = nz;
          boltVerts += 2;
        }
        px = nx;
        py = ny;
        pz = nz;
      }

      // Destello en el punto de impacto.
      _v.set(s.pos.x, s.pos.y + 0.9, s.pos.z);
      _q.identity();
      const fs = (0.95 + Math.sin(s.t * 40) * 0.22) * (0.35 + life * 0.65);
      composeInst(flashMesh, flashCount, _v, _q, fs, fs, fs);
      flashCount++;
    }

    finalizeInst(cloudMesh, puffCount);
    finalizeInst(flashMesh, flashCount);
    g.boltGeo.setDrawRange(0, boltVerts);
    if (boltVerts > 0) g.boltGeo.attributes.position.needsUpdate = true;
    boltLine.visible = boltVerts > 0;
  }

  // --- escudos ---
  function updateShields(dt, karts) {
    let count = 0;
    for (let i = 0; i < karts.length && i < SHIELD_POOL_SIZE; i++) {
      const kart = karts[i];
      const active = !!(kart && kart.state && kart.state.shieldTime > 0);
      if (!active) continue;
      g.shieldMat.uniforms.uTime.value = time;
      const pulse = 1 + Math.sin(time * 6) * 0.05;
      _v.set(kart.position.x, kart.position.y + 0.95, kart.position.z);
      _q.setFromAxisAngle(_axisY, time * 1.5);
      const sc = 1.7 * pulse;
      composeInst(shieldMesh, count, _v, _q, sc, sc, sc);
      count++;
    }
    finalizeInst(shieldMesh, count);

    // Contacto pasivo: un kart con escudo golpea a quien toca.
    for (const a of karts) {
      if (!a || !a.state || a.state.shieldTime <= 0) continue;
      for (const b of karts) {
        if (b === a || !b || !b.state) continue;
        if (b.state.shieldTime > 0) continue;
        if (b.state.spinTime > 0) continue;
        const dx = b.position.x - a.position.x;
        const dz = b.position.z - a.position.z;
        const rr = (a.radius || 1.3) + (b.radius || 1.3) + 0.35;
        if (dx * dx + dz * dz < rr * rr) b.hit('shield');
      }
    }
  }

  function updateDebris(dt) {
    let count = 0;
    for (const d of debris) {
      if (!d.active) continue;
      d.life -= dt;
      if (d.life <= 0) {
        d.active = false;
        continue;
      }
      d.vel.y -= 14 * dt;
      d.pos.addScaledVector(d.vel, dt);
      d.rot.x += d.spin.x * dt;
      d.rot.y += d.spin.y * dt;
      d.rot.z += d.spin.z * dt;
      const k = Math.min(1, d.life / DEBRIS_LIFE);
      const sc = 0.4 + k * 0.6;
      _q.setFromEuler(d.rot);
      composeInst(debrisMesh, count, d.pos, _q, sc, sc, sc);
      count++;
    }
    finalizeInst(debrisMesh, count);
  }

  function updateBlobs(karts) {
    let count = 0;

    // Cajas.
    for (const box of boxes) {
      if (box.scale <= 0.001) continue;
      _v.set(box.pos.x, box.pos.y - 1.02, box.pos.z);
      _q.identity();
      const sc = 1.5 * box.scale;
      composeInst(blobsMesh, count, _v, _q, sc, 1, sc);
      count++;
    }
    // Peels.
    for (const peel of peels) {
      _v.set(peel.pos.x, peel.pos.y - 0.04, peel.pos.z);
      _q.identity();
      composeInst(blobsMesh, count, _v, _q, 1.1, 1, 1.1);
      count++;
    }
    // Proyectiles.
    for (const entry of projectiles) {
      if (!entry.active) continue;
      _v.set(entry.pos.x, entry.pos.y - 0.46, entry.pos.z);
      _q.identity();
      composeInst(blobsMesh, count, _v, _q, 1.2, 1, 1.2);
      count++;
    }

    finalizeInst(blobsMesh, count);
  }

  // -------------------------------------------------------------------------
  // API
  // -------------------------------------------------------------------------
  function update(dt, ctx) {
    const karts = (ctx && ctx.karts) || [];
    time += dt;

    updateBoxes(dt, karts);
    updateRoulettes(dt, karts, ctx);
    consumeUses(ctx, karts);
    updatePeels(dt, karts);
    updateProjectiles(dt, ctx, karts);
    updateShields(dt, karts);
    updateStorms(dt);
    updateDebris(dt);
    updateBlobs(karts);
  }

  function getHeldItem(kart) {
    return heldItems.get(kart) || null;
  }

  function isRolling(kart) {
    return roulettes.has(kart);
  }

  function getRouletteDisplay(kart) {
    const roll = roulettes.get(kart);
    if (!roll) return null;
    return roll.display;
  }

  function getHazards() {
    return peels.map((p) => ({ position: p.pos, type: 'peel' }));
  }

  function getBoxPositions() {
    return boxPositions;
  }

  function debugUse(kart, itemId, ctx) {
    if (!kart || !ITEM_IDS.includes(itemId)) return false;
    events.emit(EVENTS.ITEM_USE, { kart, itemId });
    doUse(kart, itemId, ctx || { karts: [kart], places: new Map() });
    return true;
  }

  function dispose() {
    scene.remove(group);
    heldItems.clear();
    roulettes.clear();
    peels.length = 0;
    for (const p of peelPool) p.active = false;
    for (const p of projectiles) p.active = false;
    for (const s of storms) {
      s.active = false;
      s.kart = null;
    }
    for (const d of debris) d.active = false;
    if (sparkGeo) sparkGeo.dispose();
    disposeAssets();
  }

  const system = {
    update,
    getHeldItem,
    isRolling,
    getRouletteDisplay,
    dispose,
    getHazards,
    getBoxPositions,
    debugUse,
    stats,
  };

  if (
    typeof window !== 'undefined' &&
    window.location &&
    String(window.location.search).includes('autotest=1')
  ) {
    window.__itemsSystem = system;
  }

  return system;
}
