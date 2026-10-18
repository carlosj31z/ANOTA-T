// BLOQUE 4 — OBJETOS (contrato §4.4, SPEC C6/C11).
// Cajas de objeto (cubo arcoíris translúcido con "?"), ruleta de ~2 s,
// 6 objetos (turbo, peel, bouncer, seeker, shield, storm) con reparto por posición.
// Todo procedural, con pools: nada de crear geometrías por disparo.

import * as THREE from 'three';
import { EVENTS, ITEM_IDS } from '../shared/constants.js';

// ---------------------------------------------------------------------------
// Tabla de reparto por posición de carrera (1..8). Pesos relativos.
// 1º: peel/bouncer/turbo · 2º–3º: mezcla · 4º–6º: turbo/seeker/shield más frecuentes.
// 7º–8º: turbo/seeker/shield/storm (storm solo desde el 5º).
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
const ROULETTE_FAST = 0.08; // s entre cambios de id al inicio
const ROULETTE_SLOW = 0.28; // s entre cambios al final (frenada)
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
const PEEL_POOL_SIZE = 12;
const SHIELD_POOL_SIZE = 12;

// Vectores temporales reutilizados (evitar allocations por frame).
const _v1 = new THREE.Vector3();
const _dummy = new THREE.Object3D();

function weightedPick(place) {
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

function randomRollDisplay() {
  return ITEM_IDS[(Math.random() * ITEM_IDS.length) | 0];
}

function makeQuestionTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, 128, 128);
  g.font = 'bold 104px system-ui, "Segoe UI", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = 14;
  g.strokeStyle = '#2a1250';
  g.strokeText('?', 64, 72);
  g.fillStyle = '#ffffff';
  g.fillText('?', 64, 72);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 2;
  return tex;
}

export function createItemSystem(scene, track, events) {
  const group = new THREE.Group();
  group.name = 'items';
  scene.add(group);

  const disposables = [];
  function trackDisposable(d) {
    disposables.push(d);
    return d;
  }

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
  // Cajas de objeto
  // -------------------------------------------------------------------------
  const boxGroup = new THREE.Group();
  boxGroup.name = 'item-boxes';
  group.add(boxGroup);

  const boxGeo = trackDisposable(new THREE.BoxGeometry(1.5, 1.5, 1.5));
  const boxMat = trackDisposable(
    new THREE.MeshStandardMaterial({
      color: 0xffd23f,
      emissive: 0x8844ff,
      emissiveIntensity: 0.9,
      metalness: 0.1,
      roughness: 0.25,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    })
  );

  const questionTex = makeQuestionTexture();
  disposables.push(questionTex);
  const questionMat = trackDisposable(
    new THREE.SpriteMaterial({ map: questionTex, transparent: true, depthWrite: false })
  );

  let boxMesh = null;
  const boxes = [];
  const questionSprites = [];
  if (boxCount > 0) {
    boxMesh = new THREE.InstancedMesh(boxGeo, boxMat, boxCount);
    boxMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    boxMesh.castShadow = false;
    boxMesh.frustumCulled = false;
    boxMesh.renderOrder = 1;
    boxGroup.add(boxMesh);

    for (let i = 0; i < boxCount; i++) {
      const base = boxPositions[i].clone();
      boxes.push({ pos: base, phase: 'idle', timer: 0, scale: 1, phase0: i * 0.7 });
      const sprite = new THREE.Sprite(questionMat);
      sprite.scale.set(0.95, 0.95, 0.95);
      sprite.renderOrder = 2;
      sprite.frustumCulled = false;
      boxGroup.add(sprite);
      questionSprites.push(sprite);
    }
  }

  const heldItems = new Map(); // kart -> itemId
  const roulettes = new Map(); // kart -> { t, swapTimer, display, result }

  // -------------------------------------------------------------------------
  // Pools procedurales
  // -------------------------------------------------------------------------

  // --- Cáscara (peel): media luna amarilla con puntitas marrones ---
  const peelGroup = new THREE.Group();
  peelGroup.name = 'peels';
  group.add(peelGroup);

  const peelShellGeo = trackDisposable(new THREE.TorusGeometry(0.42, 0.11, 6, 12, Math.PI));
  const peelShellMat = trackDisposable(
    new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0x553300, emissiveIntensity: 0.25, roughness: 0.5 })
  );
  const peelTipGeo = trackDisposable(new THREE.ConeGeometry(0.09, 0.22, 5));
  const peelTipMat = trackDisposable(new THREE.MeshStandardMaterial({ color: 0x7a4a1e, roughness: 0.8 }));

  function makePeel() {
    const g = new THREE.Group();
    const shell = new THREE.Mesh(peelShellGeo, peelShellMat);
    shell.rotation.x = -Math.PI / 2;
    shell.position.y = 0.14;
    shell.castShadow = true;
    g.add(shell);
    for (let i = 0; i < 3; i++) {
      const tip = new THREE.Mesh(peelTipGeo, peelTipMat);
      const a = (i / 3) * Math.PI - Math.PI / 2;
      tip.position.set(Math.cos(a) * 0.4, 0.14, Math.sin(a) * 0.4);
      tip.rotation.z = a;
      g.add(tip);
    }
    return g;
  }

  const peelPool = [];
  const peels = []; // activos: { mesh, pos }
  for (let i = 0; i < PEEL_POOL_SIZE; i++) {
    const mesh = makePeel();
    mesh.visible = false;
    peelGroup.add(mesh);
    peelPool.push({ mesh, pos: new THREE.Vector3(), active: false });
  }

  function acquirePeel() {
    for (const p of peelPool) if (!p.active) return p;
    return peelPool[0];
  }

  // --- Bouncer: caparazón esférico verde con franjas ---
  const bouncerBodyGeo = trackDisposable(new THREE.SphereGeometry(0.5, 16, 12));
  const bouncerBodyMat = trackDisposable(
    new THREE.MeshStandardMaterial({ color: 0x37c24a, emissive: 0x0a3311, emissiveIntensity: 0.45, roughness: 0.4 })
  );
  const bouncerStripeGeo = trackDisposable(new THREE.TorusGeometry(0.5, 0.06, 6, 18));
  const bouncerStripeMat = trackDisposable(new THREE.MeshStandardMaterial({ color: 0x0f6d24, roughness: 0.6 }));

  function makeBouncer() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(bouncerBodyGeo, bouncerBodyMat);
    body.castShadow = true;
    g.add(body);
    const s1 = new THREE.Mesh(bouncerStripeGeo, bouncerStripeMat);
    s1.rotation.x = Math.PI / 2;
    g.add(s1);
    const s2 = new THREE.Mesh(bouncerStripeGeo, bouncerStripeMat);
    s2.rotation.y = Math.PI / 2;
    g.add(s2);
    return g;
  }

  // --- Seeker: orbe rojo brillante con anillo y estela ---
  const seekerOrbGeo = trackDisposable(new THREE.SphereGeometry(0.34, 14, 12));
  const seekerOrbMat = trackDisposable(
    new THREE.MeshStandardMaterial({ color: 0xff2b2b, emissive: 0xff2200, emissiveIntensity: 1.1, roughness: 0.3 })
  );
  const seekerRingGeo = trackDisposable(new THREE.TorusGeometry(0.52, 0.05, 6, 18));
  const seekerRingMat = trackDisposable(
    new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xff8800, emissiveIntensity: 0.8, roughness: 0.4 })
  );
  const seekerTailGeo = trackDisposable(new THREE.ConeGeometry(0.22, 0.6, 8));
  const seekerTailMat = trackDisposable(
    new THREE.MeshStandardMaterial({ color: 0xff8800, emissive: 0xff4400, emissiveIntensity: 0.7, roughness: 0.5 })
  );

  function makeSeeker() {
    const g = new THREE.Group();
    const orb = new THREE.Mesh(seekerOrbGeo, seekerOrbMat);
    orb.castShadow = true;
    g.add(orb);
    const ring = new THREE.Mesh(seekerRingGeo, seekerRingMat);
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    const tail = new THREE.Mesh(seekerTailGeo, seekerTailMat);
    tail.rotation.x = Math.PI / 2;
    tail.position.z = -0.45;
    g.add(tail);
    return g;
  }

  // --- Pool unificado de proyectiles ---
  const projGroup = new THREE.Group();
  projGroup.name = 'projectiles';
  group.add(projGroup);

  const projectiles = [];
  for (let i = 0; i < PROJ_POOL_SIZE; i++) {
    const bouncer = makeBouncer();
    const seeker = makeSeeker();
    bouncer.visible = false;
    seeker.visible = false;
    projGroup.add(bouncer);
    projGroup.add(seeker);
    projectiles.push({
      active: false,
      type: null,
      bouncer,
      seeker,
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

  function acquireProjectile() {
    for (const p of projectiles) if (!p.active) return p;
    return projectiles[0];
  }

  function deactivateProjectile(p) {
    p.active = false;
    p.bouncer.visible = false;
    p.seeker.visible = false;
    p.owner = null;
  }

  // --- Burbuja de escudo ---
  const shieldGroup = new THREE.Group();
  shieldGroup.name = 'shields';
  group.add(shieldGroup);

  const shieldGeo = trackDisposable(new THREE.SphereGeometry(1.9, 16, 12));
  const shieldMat = trackDisposable(
    new THREE.MeshBasicMaterial({
      color: 0x66ccff,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );

  const shieldPool = [];
  for (let i = 0; i < SHIELD_POOL_SIZE; i++) {
    const mesh = new THREE.Mesh(shieldGeo, shieldMat);
    mesh.visible = false;
    shieldGroup.add(mesh);
    shieldPool.push(mesh);
  }

  // -------------------------------------------------------------------------
  // Lógica
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
    const itemId = weightedPick(place);
    roll.result = itemId;
    heldItems.set(kart, itemId);
    events.emit(EVENTS.ITEM_GOT, { kart, itemId });
  }

  function collectBox(box, kart) {
    box.phase = 'pop';
    box.timer = 0;
    stats.boxes += 1;
    events.emit(EVENTS.ITEM_BOX, { kart, position: box.pos.clone() });
    if (!heldItems.has(kart) && !roulettes.has(kart)) startRoulette(kart);
  }

  function updateBoxes(dt, karts, ctx) {
    if (boxCount === 0 || !boxMesh) return;

    const hue = (time * 0.12) % 1;
    boxMat.color.setHSL(hue, 0.85, 0.6);
    boxMat.emissive.setHSL((hue + 0.35) % 1, 0.95, 0.5);

    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      let scale = box.scale;

      if (box.phase === 'idle') {
        scale = 1;
        // Recogida por proximidad.
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

      const bob = Math.sin(time * 2 + box.phase0) * 0.18;
      const spin = time * 1.2 + box.phase0;

      _dummy.position.set(box.pos.x, box.pos.y + bob, box.pos.z);
      _dummy.rotation.set(0, spin, 0);
      _dummy.scale.setScalar(Math.max(0.001, scale));
      _dummy.updateMatrix();
      boxMesh.setMatrixAt(i, _dummy.matrix);

      const sprite = questionSprites[i];
      sprite.position.set(box.pos.x, box.pos.y + bob, box.pos.z);
      const ss = 0.95 * scale;
      sprite.scale.set(ss, ss, ss);
      sprite.visible = scale > 0.05;
    }
    boxMesh.instanceMatrix.needsUpdate = true;
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

      const progress = Math.min(1, roll.t / ROULETTE_DURATION);
      const interval = ROULETTE_FAST + (ROULETTE_SLOW - ROULETTE_FAST) * progress * progress;
      roll.swapTimer += dt;
      if (roll.swapTimer >= interval) {
        roll.swapTimer = 0;
        roll.display = randomRollDisplay();
      }

      if (roll.t >= ROULETTE_DURATION) {
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
      kart.controls.useItem = false; // SIEMPRE a false tras leerlo
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
      oldest.mesh.visible = false;
    }

    const entry = acquirePeel();
    if (entry.active) {
      // Reutilizado mientras aún estaba activo: quítalo de la lista.
      const idx = peels.indexOf(entry);
      if (idx >= 0) peels.splice(idx, 1);
    }
    entry.pos.copy(pos);
    entry.active = true;
    entry.mesh.visible = true;
    entry.mesh.position.copy(pos);
    entry.mesh.rotation.y = kart.heading;
    peels.push(entry);
  }

  function updatePeels(dt, karts) {
    for (let i = peels.length - 1; i >= 0; i--) {
      const peel = peels[i];
      peel.mesh.rotation.y += dt * 1.5;
      peel.mesh.children[0].rotation.z = Math.sin(time * 3 + i) * 0.12;

      for (const kart of karts) {
        if (!kart || !kart.state) continue;
        if (kart.state.shieldTime > 0) continue;
        const dx = kart.position.x - peel.pos.x;
        const dz = kart.position.z - peel.pos.z;
        if (dx * dx + dz * dz < PEEL_HIT_RADIUS * PEEL_HIT_RADIUS) {
          kart.hit('peel');
          peel.active = false;
          peel.mesh.visible = false;
          peels.splice(i, 1);
          break;
        }
      }
    }
  }

  // --- bouncer ---
  function spawnBouncer(kart) {
    const entry = acquireProjectile();
    if (entry.active) deactivateProjectile(entry);
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
    entry.bouncer.visible = true;
    entry.seeker.visible = false;
    entry.bouncer.position.copy(entry.pos);
  }

  // --- seeker ---
  function spawnSeeker(kart) {
    const entry = acquireProjectile();
    if (entry.active) deactivateProjectile(entry);
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
    entry.bouncer.visible = false;
    entry.seeker.visible = true;
    entry.seeker.position.copy(entry.pos);
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
    for (const entry of projectiles) {
      if (!entry.active) continue;
      entry.time += dt;
      entry.life -= dt;
      if (entry.life <= 0) {
        deactivateProjectile(entry);
        continue;
      }

      const proj = track.projectToTrack(entry.pos, entry.hintT);
      entry.hintT = proj.t;

      if (entry.type === 'bouncer') {
        entry.pos.addScaledVector(entry.dir, entry.speed * dt);
        entry.pos.y = proj.groundY + 0.5;

        if (proj.surface === 'wall' && proj.wallNormal) {
          const n = proj.wallNormal;
          const dot = entry.dir.x * n.x + entry.dir.z * n.z;
          entry.dir.x -= 2 * dot * n.x;
          entry.dir.z -= 2 * dot * n.z;
          entry.dir.normalize();
          entry.pos.addScaledVector(n, 0.8);
          entry.bounces += 1;
          entry.spin += 6;
          if (entry.bounces >= BOUNCER_MAX_BOUNCES) {
            explode(entry.pos, 'bouncer');
            deactivateProjectile(entry);
            continue;
          }
        }

        if (projectileHitsKart(entry, karts, 'bouncer')) {
          deactivateProjectile(entry);
          continue;
        }

        entry.bouncer.position.copy(entry.pos);
        entry.bouncer.rotation.y += dt * 6;
        entry.bouncer.rotation.x += dt * 4;
      } else {
        // seeker
        const myPlace = (ctx.places && ctx.places.get(entry.owner)) || 1;
        const target = kartAtPlace(ctx, myPlace - 1);

        if (target) {
          const dx = target.position.x - entry.pos.x;
          const dz = target.position.z - entry.pos.z;
          const d = Math.hypot(dx, dz);
          if (d < SEEKER_LOCK_DIST && d > 1e-3) {
            _v1.set(dx / d, 0, dz / d);
          } else {
            _v1.copy(proj.tangent);
            _v1.y = 0;
            _v1.normalize();
          }
        } else {
          _v1.copy(entry.dir); // sin rival delante: recto
        }

        entry.dir.lerp(_v1, Math.min(1, dt * 4.5));
        entry.dir.y = 0;
        if (entry.dir.lengthSq() > 1e-6) entry.dir.normalize();

        entry.pos.addScaledVector(entry.dir, entry.speed * dt);
        entry.pos.y = proj.groundY + 0.5;

        if (proj.surface === 'wall' && proj.wallNormal) {
          const n = proj.wallNormal;
          const dot = entry.dir.x * n.x + entry.dir.z * n.z;
          entry.dir.x -= 2 * dot * n.x;
          entry.dir.z -= 2 * dot * n.z;
          entry.dir.normalize();
          entry.pos.addScaledVector(n, 0.8);
        }

        if (projectileHitsKart(entry, karts, 'seeker')) {
          deactivateProjectile(entry);
          continue;
        }

        entry.seeker.position.copy(entry.pos);
        entry.seeker.rotation.y += dt * 8;
        const s = 1 + Math.sin(entry.time * 16) * 0.12;
        entry.seeker.scale.setScalar(s);
        entry.seeker.children[1].rotation.z += dt * 5;
      }
    }
  }

  function useStorm(kart, ctx) {
    const myPlace = (ctx.places && ctx.places.get(kart)) || 1;
    if (!ctx || !ctx.karts) return;
    for (const other of ctx.karts) {
      if (!other || other === kart || !other.state) continue;
      const p = ctx.places ? ctx.places.get(other) : null;
      if (p == null || p >= myPlace) continue; // solo rivales por delante
      if (other.state.shieldTime > 0) continue; // el escudo protege
      other.hit('storm');
      explode(other.position, 'storm');
    }
  }

  // --- escudos ---
  function updateShields(dt, karts) {
    for (let i = 0; i < shieldPool.length; i++) {
      const mesh = shieldPool[i];
      const kart = karts[i];
      const active = !!(kart && kart.state && kart.state.shieldTime > 0);
      mesh.visible = active;
      if (!active) continue;
      mesh.position.set(kart.position.x, kart.position.y + 0.9, kart.position.z);
      const pulse = 1 + Math.sin(time * 6) * 0.05;
      mesh.scale.setScalar(pulse);
      mesh.rotation.y += dt * 1.5;
    }

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

  // -------------------------------------------------------------------------
  // API
  // -------------------------------------------------------------------------
  function update(dt, ctx) {
    const karts = (ctx && ctx.karts) || [];
    time += dt;

    updateBoxes(dt, karts, ctx);
    updateRoulettes(dt, karts, ctx);
    consumeUses(ctx, karts);
    updatePeels(dt, karts);
    updateProjectiles(dt, ctx, karts);
    updateShields(dt, karts);
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

  // Uso directo de un objeto (útil para pruebas e integración). Emite ITEM_USE.
  function debugUse(kart, itemId, ctx) {
    if (!kart || !ITEM_IDS.includes(itemId)) return false;
    events.emit(EVENTS.ITEM_USE, { kart, itemId });
    doUse(kart, itemId, ctx || { karts: [kart], places: new Map() });
    return true;
  }

  function dispose() {
    scene.remove(group);
    for (const d of disposables) {
      if (d && typeof d.dispose === 'function') d.dispose();
    }
    disposables.length = 0;
    heldItems.clear();
    roulettes.clear();
    peels.length = 0;
    if (boxMesh) boxMesh.dispose();
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
