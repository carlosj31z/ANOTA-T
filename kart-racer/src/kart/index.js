// Bloque 2 — Kart y piloto. API exacta del contrato §4.2.
// Física arcade paso fijo (dt=1/60 lo da el core) + animación del modelo.
//
// Rumbos: adelante = (sin h, 0, cos h). Girar a la izquierda = aumentar h.
// Controls.steer se interpreta como +1 = izquierda (igual que la IA).

import * as THREE from 'three';
import {
  EVENTS,
  BASE_MAX_SPEED,
  OFFROAD_SPEED_FACTOR,
  GRAVITY,
} from '../shared/constants.js';
import { getKartModel } from './model.js';

// --- Constantes de jugabilidad ---
const SPIN_TIME = 1.2; // duración del giro por golpe
const SPIN_SPEED = (Math.PI * 4) / SPIN_TIME; // 2 vueltas
const HOP_TIME = 0.15; // saltito al iniciar derrape
const HOP_HEIGHT = 0.22;
const RAMP_IMPULSE = 9; // m/s de impulso vertical al salir de una rampa
const BOOST_MAX_FACTOR = 1.35;
const BOOST_ACCEL = 24;
const REVERSE_FACTOR = 0.35;
const AIR_TURN_FACTOR = 0.35;
const DRIFT_BOOST = [0, 0.6, 1.1, 1.6]; // duración del turbo al soltar
const DRIFT_LEVEL_TIME = [0.7, 1.5, 2.4]; // carga → nivel
const DRIFT_BASE_YAW = 1.35;
const DRIFT_MIN_YAW = 0.9;
const DRIFT_MAX_YAW = 2.7;
const WALL_COOLDOWN = 0.4;
const PAD_COOLDOWN = 1.2;
const LAND_TIME = 0.22;

const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _probe = new THREE.Vector3();

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

export function createKart(scene, character, opts = {}) {
  const isPlayer = !!opts.isPlayer;
  const events = opts.events;

  // --- Stats → parámetros de física ---
  const stats = character.stats;
  const maxSpeed = BASE_MAX_SPEED * (0.88 + stats.speed * 0.06);
  const accelPower = 9 + stats.accel * 2.6;
  const brakePower = 22;
  const turnRate = 1.5 + stats.handling * 0.24;
  const mass = 0.8 + stats.weight * 0.24;

  // --- Modelo (geometría cacheada a nivel de módulo por personaje) ---
  const model = getKartModel(character);

  const object3d = new THREE.Group();
  object3d.name = `kart:${character.id}`;

  const tilt = new THREE.Group();
  object3d.add(tilt);

  // Materiales por kart (el emisivo se anima de forma independiente).
  const kartMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const faceMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const exhaustMat = new THREE.MeshBasicMaterial({ color: 0x3a1c10 });
  const emblemMat = new THREE.MeshBasicMaterial({
    map: model.emblemTex,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  // Chasis fusionado
  const chassis = new THREE.Mesh(model.chassisGeo, kartMat);
  chassis.castShadow = true;
  tilt.add(chassis);

  // Emblema / dorsal sobre el alerón trasero
  const emblem = new THREE.Mesh(model.emblemGeo, emblemMat);
  emblem.rotation.x = -Math.PI / 2;
  emblem.position.set(0, 0.845, -0.78);
  tilt.add(emblem);

  // Toberas de escape (brillo de turbo)
  const exhaustMesh = new THREE.Mesh(model.exhaustGeo, exhaustMat);
  tilt.add(exhaustMesh);

  // --- Ruedas: pivot (dirección) → spinner (rodadura) → malla ---
  const wheelPivots = [];
  const wheelSpinners = [];
  const wheelRadii = [];
  function addWheel(x, y, z, geo, radius, steerable) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    const spinner = new THREE.Group();
    const mesh = new THREE.Mesh(geo, kartMat);
    mesh.castShadow = true;
    spinner.add(mesh);
    pivot.add(spinner);
    tilt.add(pivot);
    wheelPivots.push({ pivot, steerable });
    wheelSpinners.push(spinner);
    wheelRadii.push(radius);
  }
  addWheel(0.52, 0.26, 0.6, model.frontWheelGeo, 0.26, true);
  addWheel(-0.52, 0.26, 0.6, model.frontWheelGeo, 0.26, true);
  addWheel(0.56, 0.3, -0.6, model.rearWheelGeo, 0.3, false);
  addWheel(-0.56, 0.3, -0.6, model.rearWheelGeo, 0.3, false);

  // --- Piloto ---
  const anchors = model.pilot.anchors;
  const pilot = new THREE.Group();
  pilot.position.set(0, 0.52, -0.2);
  tilt.add(pilot);

  function addPart(geo, parent, material) {
    if (!geo) return null;
    const mesh = new THREE.Mesh(geo, material || kartMat);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  addPart(model.pilot.bodyGeo, pilot);

  const headGroup = new THREE.Group();
  headGroup.position.set(anchors.head.x, anchors.head.y, anchors.head.z);
  pilot.add(headGroup);
  addPart(model.pilot.headGeo, headGroup);
  addPart(model.pilot.faceGeo, headGroup, faceMat);

  const headSpringGroup = new THREE.Group();
  headSpringGroup.position.set(anchors.headSpring.x, anchors.headSpring.y, anchors.headSpring.z);
  headGroup.add(headSpringGroup);
  addPart(model.pilot.headSpringGeo, headSpringGroup);

  const bodySpringGroup = new THREE.Group();
  bodySpringGroup.position.set(anchors.bodySpring.x, anchors.bodySpring.y, anchors.bodySpring.z);
  pilot.add(bodySpringGroup);
  addPart(model.pilot.bodySpringGeo, bodySpringGroup);

  const armsGroup = new THREE.Group();
  armsGroup.position.set(anchors.arms.x, anchors.arms.y, anchors.arms.z);
  pilot.add(armsGroup);
  addPart(model.pilot.armsGeo, armsGroup);

  scene.add(object3d);

  // --- Estado físico (contrato §4.2) ---
  const state = {
    drifting: false,
    driftDir: 0,
    driftLevel: 0,
    boostTime: 0,
    airborne: false,
    spinTime: 0,
    shieldTime: 0,
    surface: 'road',
  };

  const controls = { throttle: 0, brake: 0, steer: 0, drift: false, useItem: false };

  const position = object3d.position;
  const velocity = new THREE.Vector3();

  let heading = 0;
  let speed = 0;
  let lat = 0; // velocidad lateral (deslizamiento)
  let vy = 0;
  let boostStrength = 1;

  let hopActive = false;
  let hopTimer = 0;
  let driftWindow = 0;
  let driftCharge = 0;
  let prevDrift = false;
  let wallCooldown = 0;
  let padCooldown = 0;
  let rampCooldown = 0;
  let landSquash = 0;
  let spinAngle = 0;
  let celebrating = false;

  // Estado visual
  let animTime = 0;
  let steerVis = 0;
  let rollVis = 0;
  let pitchVis = 0;
  let slideVis = 0;
  let bumpPos = 0;
  let bumpVel = 0;
  let dizzy = 0;
  let shieldHue = 0;
  const headSpring = { pos: 0, vel: 0 };
  const bodySpring = { pos: 0, vel: 0 };

  function emit(name, payload) {
    if (events) events.emit(name, payload);
  }

  function bumpImpulse(amount) {
    bumpVel -= amount * 2.2;
  }

  function getForward() {
    return new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
  }

  function endDrift(giveBoost) {
    if (!state.drifting) return;
    const level = state.driftLevel;
    state.drifting = false;
    state.driftDir = 0;
    state.driftLevel = 0;
    driftCharge = 0;
    emit(EVENTS.DRIFT_END, { kart, level });
    if (giveBoost && level >= 1) applyBoost(DRIFT_BOOST[level], 1, 'drift');
  }

  function applyBoost(duration, strength = 1, source = 'item') {
    state.boostTime = Math.max(state.boostTime, duration);
    boostStrength = clamp(strength, 0, 2);
    emit(EVENTS.BOOST, { kart, source });
  }

  function hit(by = 'hit') {
    if (state.shieldTime > 0) return;
    endDrift(false);
    state.boostTime = 0;
    state.spinTime = SPIN_TIME;
    spinAngle = 0;
    const w = character.stats.weight;
    speed *= clamp(0.55 - w * 0.05, 0.25, 0.55);
    lat *= 0.3;
    emit(EVENTS.HIT, { kart, by });
  }

  function setTransform(p, h) {
    position.copy(p);
    heading = h;
    speed = 0;
    lat = 0;
    vy = 0;
    velocity.set(0, 0, 0);
    state.drifting = false;
    state.driftDir = 0;
    state.driftLevel = 0;
    state.boostTime = 0;
    state.airborne = false;
    state.spinTime = 0;
    state.shieldTime = 0;
    state.surface = 'road';
    boostStrength = 1;
    hopActive = false;
    hopTimer = 0;
    driftWindow = 0;
    driftCharge = 0;
    prevDrift = false;
    wallCooldown = 0;
    padCooldown = 0;
    rampCooldown = 0;
    landSquash = 0;
    spinAngle = 0;
    celebrating = false;
    steerVis = 0;
    rollVis = 0;
    pitchVis = 0;
    slideVis = 0;
    bumpPos = 0;
    bumpVel = 0;
    dizzy = 0;
    headSpring.pos = headSpring.vel = 0;
    bodySpring.pos = bodySpring.vel = 0;
    object3d.rotation.y = h;
    tilt.rotation.set(0, 0, 0);
    tilt.position.y = 0;
    tilt.scale.set(1, 1, 1);
  }

  function pushInside(track, proj) {
    const n = proj.wallNormal;
    let moved = 0;
    let step = 0.4;
    _probe.copy(position);
    for (let i = 0; i < 6; i++) {
      _probe.addScaledVector(n, step);
      moved += step;
      if (moved > 3) break;
      const p2 = track.projectToTrack(_probe, kart.trackT);
      if (p2.surface !== 'wall') break;
      step *= 1.7;
    }
    position.addScaledVector(n, moved);
  }

  function updateSpring(spring, group, force, dt, kSpring, damping) {
    if (!group) return;
    spring.vel += (-kSpring * spring.pos - damping * spring.vel + force) * dt;
    spring.pos += spring.vel * dt;
    spring.pos = clamp(spring.pos, -0.95, 0.95);
    group.rotation.z = spring.pos;
  }

  function animate(dt, spinning, steerIn, speedNorm) {
    const k = 1 - Math.exp(-12 * dt);

    // Rodadura de las ruedas + dirección de las delanteras.
    for (let i = 0; i < wheelSpinners.length; i++) {
      wheelSpinners[i].rotation.x += (speed / wheelRadii[i]) * dt;
    }
    steerVis += (steerIn - steerVis) * k;
    for (const w of wheelPivots) {
      if (w.steerable) w.pivot.rotation.y = steerVis * 0.42;
    }

    // Balanceo de la carrocería.
    let rollTarget = steerVis * 0.13;
    let slideTarget = 0;
    if (state.drifting) {
      rollTarget += state.driftDir * 0.34;
      slideTarget = state.driftDir * 0.32;
    }
    let pitchTarget = 0;
    if (state.airborne) pitchTarget = clamp(-vy * 0.025, -0.32, 0.32);
    else {
      if (controls.throttle > 0 && !spinning) pitchTarget -= 0.05;
      if (controls.brake > 0 && !spinning) pitchTarget += 0.07;
    }
    rollVis += (rollTarget - rollVis) * k;
    slideVis += (slideTarget - slideVis) * k;
    pitchVis += (pitchTarget - pitchVis) * (1 - Math.exp(-8 * dt));

    // Suspensión: muelle vertical + squash de aterrizaje.
    bumpVel += (-70 * bumpPos - 11 * bumpVel) * dt;
    bumpPos += bumpVel * dt;
    const squash = landSquash > 0 ? landSquash / LAND_TIME : 0;
    const bob = bumpPos + Math.sin(animTime * 17) * 0.006 * speedNorm;

    tilt.rotation.z = rollVis;
    tilt.rotation.x = pitchVis;
    tilt.rotation.y = slideVis;
    tilt.position.y = bob + (celebrating ? Math.abs(Math.sin(animTime * 5)) * 0.12 : 0);
    tilt.scale.set(1 + squash * 0.16, 1 - squash * 0.3, 1 + squash * 0.16);

    // Piloto: se inclina y se marea.
    pilot.rotation.z = -rollVis * 0.55;
    pilot.rotation.x = Math.sin(animTime * 13) * 0.02 * speedNorm;
    headGroup.rotation.z = -rollVis * 0.5;
    headGroup.rotation.x = pitchVis * 0.5;
    if (spinning) dizzy += dt * 11;
    else dizzy += (0 - dizzy) * (1 - Math.exp(-6 * dt));
    headGroup.rotation.y = dizzy;

    // Brazos: al volante, o arriba al celebrar.
    const armsTarget = celebrating ? -2.3 : 0;
    armsGroup.rotation.x += (armsTarget - armsGroup.rotation.x) * (1 - Math.exp(-10 * dt));

    // Orejas / antenas / cola con física de muelle.
    updateSpring(headSpring, headSpringGroup, -rollVis * 14 + bumpPos * 24, dt, 34, 7);
    updateSpring(bodySpring, bodySpringGroup, -rollVis * 10 + bumpPos * 20, dt, 26, 6);

    // Escudo: brillo arcoíris cíclico.
    if (state.shieldTime > 0) {
      shieldHue = (shieldHue + dt * 1.6) % 1;
      kartMat.emissive.setHSL(shieldHue, 0.9, 0.5);
      kartMat.emissiveIntensity = 0.55;
    } else if (kartMat.emissiveIntensity !== 0) {
      kartMat.emissiveIntensity = 0;
    }

    // Turbo: escapes con brillo intenso.
    if (state.boostTime > 0) {
      const f = 0.55 + 0.45 * Math.abs(Math.sin(animTime * 45));
      exhaustMat.color.setRGB(1, 0.35 + 0.4 * f, 0.08);
      exhaustMesh.scale.setScalar(1 + f * 0.22);
    } else {
      exhaustMat.color.setHex(0x3a1c10);
      exhaustMesh.scale.setScalar(1);
    }

    // Orientación base (giro por golpe y celebración añaden rotación cosmética).
    object3d.rotation.y =
      heading + spinAngle + (celebrating ? Math.sin(animTime * 1.6) * 0.22 : 0);
  }

  function update(dt, track) {
    if (!track || !isFinite(dt) || dt <= 0) return;

    const proj = track.projectToTrack(position, kart.trackT);
    kart.trackT = proj.t;
    state.surface = proj.surface;
    animTime += dt;

    // --- temporizadores ---
    if (state.boostTime > 0) state.boostTime = Math.max(0, state.boostTime - dt);
    if (state.shieldTime > 0) state.shieldTime = Math.max(0, state.shieldTime - dt);
    if (wallCooldown > 0) wallCooldown -= dt;
    if (padCooldown > 0) padCooldown -= dt;
    if (rampCooldown > 0) rampCooldown -= dt;
    if (landSquash > 0) landSquash = Math.max(0, landSquash - dt);

    const spinning = state.spinTime > 0;
    if (spinning) {
      state.spinTime = Math.max(0, state.spinTime - dt);
      spinAngle += SPIN_SPEED * dt;
    }

    // --- placas de turbo ---
    if (
      !state.airborne &&
      padCooldown <= 0 &&
      typeof track.isOnBoostPad === 'function' &&
      track.isOnBoostPad(position)
    ) {
      applyBoost(1.0, 1, 'pad');
      padCooldown = PAD_COOLDOWN;
    }

    const steerIn = spinning ? 0 : clamp(controls.steer, -1, 1);
    const throttling = !spinning && controls.throttle > 0;
    const braking = !spinning && controls.brake > 0;

    // --- saltito e inicio de derrape ---
    const driftHeld = !spinning && !!controls.drift;
    if (driftHeld && !prevDrift && !hopActive && !state.airborne && !state.drifting) {
      hopActive = true;
      hopTimer = HOP_TIME;
      bumpImpulse(0.5);
    }
    prevDrift = !!controls.drift;

    if (!hopActive && !state.drifting && driftWindow > 0 && driftHeld) {
      if (Math.abs(steerIn) > 0.2 && Math.abs(speed) > 0.4 * maxSpeed) {
        state.drifting = true;
        state.driftDir = steerIn > 0 ? 1 : -1;
        state.driftLevel = 0;
        driftCharge = 0;
        driftWindow = 0;
        emit(EVENTS.DRIFT_START, { kart });
      }
    }

    // --- velocidad máxima efectiva según superficie y turbo ---
    let effMax = maxSpeed;
    if (state.boostTime > 0) effMax *= 1 + (BOOST_MAX_FACTOR - 1) * boostStrength;
    else if (proj.surface === 'offroad') effMax *= OFFROAD_SPEED_FACTOR;
    else if (proj.surface === 'wall') effMax *= 0.55;

    // --- motor / freno / marcha atrás ---
    if (throttling) speed += accelPower * controls.throttle * dt;
    if (braking) {
      if (speed > 0.5) speed -= brakePower * controls.brake * dt;
      else speed -= accelPower * 0.55 * controls.brake * dt;
    }
    if (state.boostTime > 0 && !spinning) speed += BOOST_ACCEL * boostStrength * dt;

    // Rozamiento (rodadura baja, offroad alta).
    let drag = 1.7;
    if (throttling || state.boostTime > 0) drag = 0.35;
    if (proj.surface === 'offroad' && state.boostTime <= 0) drag += 0.7;
    speed -= speed * drag * dt;
    if (Math.abs(speed) < 0.04 && !throttling && !braking && state.boostTime <= 0 && !spinning) {
      speed = 0;
    }

    if (speed > effMax) speed = Math.max(effMax, speed - 40 * dt);
    const minSpeed = -maxSpeed * REVERSE_FACTOR;
    if (speed < minSpeed) speed = minSpeed;

    // --- giro ---
    const speedNorm = clamp(Math.abs(speed) / 7, 0, 1);
    if (!spinning && Math.abs(speed) > 0.3) {
      if (state.drifting) {
        const inward = steerIn * state.driftDir > 0 ? Math.abs(steerIn) : 0;
        const outward = steerIn * state.driftDir < 0 ? Math.abs(steerIn) : 0;
        let mag = DRIFT_BASE_YAW + inward * 1.2 - outward * 0.7;
        mag = clamp(mag, DRIFT_MIN_YAW, DRIFT_MAX_YAW);
        heading += state.driftDir * mag * dt * speedNorm;
      } else {
        let rate = turnRate;
        if (state.airborne) rate *= AIR_TURN_FACTOR;
        rate *= 1 - 0.25 * clamp(Math.abs(speed) / maxSpeed, 0, 1);
        heading += steerIn * rate * dt * speedNorm * (speed < 0 ? -1 : 1);
      }
    }
    // Mantener el rumbo en un rango razonable.
    if (heading > Math.PI * 4 || heading < -Math.PI * 4) {
      heading = ((((heading + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
    }

    // --- derrape: carga de nivel y fin ---
    if (state.drifting) {
      const inward = steerIn * state.driftDir > 0 ? Math.abs(steerIn) : 0;
      driftCharge += dt * (1 + inward * 0.7);
      let lvl = 0;
      if (driftCharge >= DRIFT_LEVEL_TIME[2]) lvl = 3;
      else if (driftCharge >= DRIFT_LEVEL_TIME[1]) lvl = 2;
      else if (driftCharge >= DRIFT_LEVEL_TIME[0]) lvl = 1;
      if (lvl > state.driftLevel) {
        state.driftLevel = lvl;
        emit(EVENTS.DRIFT_LEVEL, { kart, level: lvl });
      }
      if (!controls.drift) endDrift(true);
      else if (Math.abs(speed) < 0.25 * maxSpeed) endDrift(false);
    }

    // --- movimiento ---
    const fwd = _fwd.set(Math.sin(heading), 0, Math.cos(heading));
    const right = _right.set(-Math.cos(heading), 0, Math.sin(heading));

    if (state.drifting) {
      const target = state.driftDir * Math.min(3.5, Math.abs(speed) * 0.25);
      lat += (target - lat) * Math.min(1, 6 * dt);
    } else {
      const grip = proj.surface === 'road' ? 9 : 3;
      lat += (0 - lat) * Math.min(1, grip * dt);
    }
    lat = clamp(lat, -0.5 * Math.abs(speed) - 0.1, 0.5 * Math.abs(speed) + 0.1);

    position.x += (fwd.x * speed + right.x * lat) * dt;
    position.z += (fwd.z * speed + right.z * lat) * dt;

    // --- muro: empujar hacia dentro y perder velocidad ---
    if (proj.surface === 'wall' && proj.wallNormal) {
      pushInside(track, proj);
      const intoWall = -(fwd.x * proj.wallNormal.x + fwd.z * proj.wallNormal.z) * speed;
      const impact = clamp(Math.abs(intoWall) / maxSpeed, 0, 1);
      speed *= 1 - 0.55 * impact;
      lat *= 0.5;
      if (impact > 0.05) {
        const th = Math.atan2(proj.tangent.x, proj.tangent.z);
        let target = th;
        if (Math.cos(heading - th) < 0) target = th + Math.PI;
        let dih = target - heading;
        dih = Math.atan2(Math.sin(dih), Math.cos(dih));
        heading += dih * impact * 0.25;
      }
      if (wallCooldown <= 0) {
        emit(EVENTS.WALL, { kart, impact });
        wallCooldown = WALL_COOLDOWN;
        bumpImpulse(impact);
        if (state.drifting && impact > 0.4) endDrift(false);
      }
    }

    // --- vertical: saltito, rampa y aire ---
    if (hopActive) {
      hopTimer -= dt;
      const t = clamp(1 - hopTimer / HOP_TIME, 0, 1);
      position.y = proj.groundY + Math.sin(Math.PI * t) * HOP_HEIGHT;
      if (hopTimer <= 0) {
        hopActive = false;
        vy = 0;
        position.y = proj.groundY;
        landSquash = LAND_TIME;
        driftWindow = 0.25;
      }
    } else if (state.airborne) {
      vy -= GRAVITY * dt;
      position.y += vy * dt;
      if (position.y <= proj.groundY) {
        position.y = proj.groundY;
        vy = 0;
        state.airborne = false;
        landSquash = LAND_TIME;
        rampCooldown = 0.6;
        bumpImpulse(0.8);
        emit(EVENTS.LAND, { kart });
      }
    } else {
      position.y = proj.groundY;
      vy = 0;
      if (
        rampCooldown <= 0 &&
        Math.abs(speed) > 3 &&
        typeof track.isOnRamp === 'function' &&
        track.isOnRamp(position)
      ) {
        vy = RAMP_IMPULSE;
        state.airborne = true;
        rampCooldown = 0.6;
        emit(EVENTS.JUMP, { kart });
      }
    }

    // --- giro por golpe: frena y no hay control ---
    if (spinning) {
      speed -= speed * 3.0 * dt;
      lat *= 1 - Math.min(1, 3 * dt);
    }
    if (!spinning) spinAngle = 0;

    velocity.set(fwd.x * speed + right.x * lat, vy, fwd.z * speed + right.z * lat);

    animate(dt, spinning, steerIn, speedNorm);
  }

  function celebrate() {
    celebrating = true;
    endDrift(false);
    state.spinTime = 0;
    spinAngle = 0;
  }

  const kart = {
    character,
    isPlayer,
    object3d,
    position,
    velocity,
    controls,
    state,
    radius: 1.3,
    mass,
    maxSpeed,
    trackT: 0,
    get heading() {
      return heading;
    },
    set heading(v) {
      heading = v;
    },
    get speed() {
      return speed;
    },
    set speed(v) {
      speed = v;
    },
    update,
    applyBoost,
    hit,
    setTransform,
    getForward,
    celebrate,
  };

  setTransform(position, 0);
  return kart;
}
