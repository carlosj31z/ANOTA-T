// Bloque 2 — Kart y piloto. API exacta del contrato §4.2 (+ §9.3 expresiones).
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
import {
  getPilotMaterial,
  getFaceMaterial,
  getPilotGlowMaterial,
} from './materials.js';
import { PILOT_SCALE, HEAD_SCALE } from './pilot.js';

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

// --- Expresiones ---
const EXPRESSIONS = {
  neutral: { smile: 0.55, big: 0, o: 0, frown: 0, grit: 0, browAngry: 0, browRaise: 0.05, squint: 0, headShake: 0 },
  contento: { smile: 1, big: 0.2, o: 0, frown: 0, grit: 0, browAngry: 0, browRaise: 0.45, squint: 0, headShake: 0 },
  determinado: { smile: 0.2, big: 0, o: 0, frown: 0, grit: 0.15, browAngry: 0.7, browRaise: 0, squint: 0.4, headShake: 0 },
  eufórico: { smile: 0.1, big: 1, o: 0, frown: 0, grit: 0, browAngry: 0, browRaise: 0.9, squint: 0, headShake: 0 },
  sorprendido: { smile: 0, big: 0, o: 1, frown: 0, grit: 0, browAngry: 0, browRaise: 1, squint: 0, headShake: 0 },
  enfadado: { smile: 0, big: 0, o: 0, frown: 1, grit: 0, browAngry: 1, browRaise: 0, squint: 0.5, headShake: 0 },
  mareado: { smile: 0, big: 0, o: 0.5, frown: 0, grit: 0, browAngry: 0.25, browRaise: 0, squint: 0.2, headShake: 1 },
};
const EXPR_KEYS = ['smile', 'big', 'o', 'frown', 'grit', 'browAngry', 'browRaise', 'squint', 'headShake'];

// --- Ventajas por personaje (contrato §10.2) ---
// El evento 'kart:perk' es nuevo de la tanda 4; no está en EVENTS (shared).
const PERK_EVENT = 'kart:perk';
const PERK_DRIFT_CHARGE = 1.25; // astucia: carga de derrape ×1.25
const PERK_SPIN_FACTOR = 0.6; // blindaje: spin ×0.6
const PERK_RAMP_IMPULSE = 1.3; // salto_rana: impulso de rampa ×1.3
const PERK_ITEM_BOOST = 1.35; // rugido: boost de objeto ×1.35
const PERK_AURA_BOOST = 1.5; // aura: mini-turbo nivel 3 ×1.5

const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _probe = new THREE.Vector3();

// Reutilizados por el instancing de ruedas.
const _wheelPos = new THREE.Vector3();
const _wheelScale = new THREE.Vector3(1, 1, 1);
const _wheelQ = new THREE.Quaternion();
const _wheelQ2 = new THREE.Quaternion();
const _wheelM = new THREE.Matrix4();
const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);

const WHEELS = [
  { x: 0.52, y: 0.28, z: 0.6, steer: true },
  { x: -0.52, y: 0.28, z: 0.6, steer: true },
  { x: 0.56, y: 0.28, z: -0.62, steer: false },
  { x: -0.56, y: 0.28, z: -0.62, steer: false },
];

const NECK_Y = 0.44;
const NECK_Z = -0.02;
const PILOT_BASE_Y = 0.46;

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function setMorph(mesh, map, name, value) {
  if (!mesh || !mesh.morphTargetInfluences || !map) return;
  const i = map[name];
  if (i === undefined) return;
  mesh.morphTargetInfluences[i] = value;
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
  const mats = model.materials;
  const pilotMat = getPilotMaterial(character);
  const faceMat = getFaceMaterial(character);

  const object3d = new THREE.Group();
  object3d.name = `kart:${character.id}`;

  const tilt = new THREE.Group();
  object3d.add(tilt);

  // --- Carrocería ---
  const chassis = new THREE.Mesh(model.chassisGeo, mats.paint);
  chassis.name = 'chassis';
  chassis.castShadow = true;
  tilt.add(chassis);

  const chrome = new THREE.Mesh(model.chromeGeo, mats.chrome);
  chrome.name = 'chrome';
  chrome.castShadow = true;
  tilt.add(chrome);

  const lights = new THREE.Mesh(model.lightsGeo, mats.lights);
  tilt.add(lights);

  const decal = new THREE.Mesh(model.decalGeo, mats.decal);
  decal.rotation.x = -Math.PI / 2 + 0.5;
  decal.position.set(0, 0.56, 0.86);
  tilt.add(decal);

  // --- Ruedas instanciadas (4 en 2 draw calls) ---
  const tireIM = new THREE.InstancedMesh(model.tireGeo, mats.tire, 4);
  tireIM.castShadow = true;
  tireIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const rimIM = new THREE.InstancedMesh(model.rimGeo, mats.rim, 4);
  rimIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  tilt.add(tireIM);
  tilt.add(rimIM);

  // --- Volante (gira con la dirección) ---
  const steeringPivot = new THREE.Group();
  steeringPivot.position.set(0, 0.8, 0.52);
  steeringPivot.rotation.x = 1.05;
  const steering = new THREE.Mesh(model.steeringGeo, mats.steering);
  steering.name = 'steering';
  steering.castShadow = true;
  steeringPivot.add(steering);
  tilt.add(steeringPivot);

  // --- Piloto (tanda 4: escala "cabezón") ---
  const anchors = model.pilot.anchors;
  const pilot = new THREE.Group();
  pilot.position.set(0, PILOT_BASE_Y, -0.17);
  pilot.scale.setScalar(PILOT_SCALE);
  tilt.add(pilot);

  const glowMat = getPilotGlowMaterial(character);
  const hyper = character.species === 'numbat';

  const bodyMesh = new THREE.Mesh(model.pilot.bodyGeo, pilotMat);
  bodyMesh.name = 'pilot-body';
  bodyMesh.castShadow = true;
  pilot.add(bodyMesh);

  const armsGroup = new THREE.Group();
  armsGroup.position.set(anchors.arms.x, anchors.arms.y, anchors.arms.z);
  pilot.add(armsGroup);
  const armsMesh = new THREE.Mesh(model.pilot.armsGeo, pilotMat);
  armsMesh.name = 'pilot-arms';
  armsMesh.castShadow = true;
  // La geometría ya está en coords locales del piloto: el grupo solo aporta el
  // pivote de rotación, así que compensamos con el desplazamiento inverso.
  armsMesh.position.set(-anchors.arms.x, -anchors.arms.y, -anchors.arms.z);
  armsGroup.add(armsMesh);
  pilot.userData.armsGroup = armsGroup;

  // La cabeza se agranda ×HEAD_SCALE sobre el cuerpo, anclada en el cuello
  // (posición = -escala * pivote) para que el pivote de rotación no se mueva.
  const HS = HEAD_SCALE;
  const headGroup = new THREE.Group();
  headGroup.position.set(0, NECK_Y, NECK_Z);
  pilot.add(headGroup);

  const headMesh = new THREE.Mesh(model.pilot.headGeo, pilotMat);
  headMesh.name = 'pilot-head';
  headMesh.castShadow = true;
  headMesh.scale.setScalar(HS);
  headMesh.position.set(0, -HS * NECK_Y, -HS * NECK_Z);
  headGroup.add(headMesh);

  let faceMesh = null;
  let glowMesh = null;
  let screenMesh = null;
  let screen = null;
  if (model.pilot.faceGeo) {
    faceMesh = new THREE.Mesh(model.pilot.faceGeo, faceMat);
    faceMesh.name = 'pilot-face';
    faceMesh.scale.setScalar(HS);
    faceMesh.position.set(0, -HS * NECK_Y, -HS * NECK_Z);
    headGroup.add(faceMesh);
  }
  if (model.pilot.glowGeo) {
    glowMesh = new THREE.Mesh(model.pilot.glowGeo, glowMat);
    glowMesh.name = 'pilot-glow';
    glowMesh.castShadow = true;
    glowMesh.scale.setScalar(HS);
    glowMesh.position.set(0, -HS * NECK_Y, -HS * NECK_Z);
    headGroup.add(glowMesh);
  }
  if (model.pilot.screen) {
    screen = model.pilot.screen;
    const geo = new THREE.PlaneGeometry(0.25, 0.23);
    const mat = new THREE.MeshBasicMaterial({ map: screen.texture, toneMapped: false });
    screenMesh = new THREE.Mesh(geo, mat);
    screenMesh.position.set(0, HS * (anchors.head.y + 0.02 - NECK_Y), HS * (0.2 - NECK_Z));
    headGroup.add(screenMesh);
  }

  // --- Sombra de contacto (blob shadow) ---
  const shadow = new THREE.Mesh(model.shadowGeo, mats.shadow);
  shadow.renderOrder = 1;
  object3d.add(shadow);

  scene.add(object3d);

  const faceMap = model.pilot.faceMorphs;
  const headMap = model.pilot.headMorphs;
  const bodyMap = model.pilot.bodyMorphs;

  // Influencias iniciales a cero.
  function zeroMorphs(mesh) {
    if (!mesh || !mesh.morphTargetInfluences) return;
    for (let i = 0; i < mesh.morphTargetInfluences.length; i++) mesh.morphTargetInfluences[i] = 0;
  }
  zeroMorphs(faceMesh);
  zeroMorphs(headMesh);
  zeroMorphs(bodyMesh);

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
    aura: false, // kenzo: turbo de mini-nivel 3 activo (lo dibuja fx)
  };

  const perkId = character.perk ? character.perk.id : null;
  const perkAstucia = perkId === 'astucia';
  const perkBlindaje = perkId === 'blindaje';
  const perkSalto = perkId === 'salto_rana';
  const perkPatinador = perkId === 'patinador';
  const perkSieteVidas = perkId === 'siete_vidas';
  const perkRugido = perkId === 'rugido';
  const perkAura = perkId === 'aura';
  // patinador: la penalización offroad a la mitad.
  const offroadFactor = perkPatinador
    ? 1 - (1 - OFFROAD_SPEED_FACTOR) / 2
    : OFFROAD_SPEED_FACTOR;

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
  let groundY = 0;
  const wheelSpin = [0, 0, 0, 0];
  const headSpring = { pos: 0, vel: 0 };
  const tailSpring = { pos: 0, vel: 0 };
  const earSpring = { pos: 0, vel: 0 };

  // Tanda 4: mirada lateral/atrás, aura de Kenzo, vidas de Mishi, rampa de Pipa.
  let headYaw = 0;
  let lookBackTimer = 0;
  let lookBackSign = 1;
  let auraTime = 0;
  let glowPulse = 0;
  let rampLaunch = false;
  let livesArmed = perkSieteVidas;

  // Expresiones
  let expression = 'neutral';
  const cur = {};
  for (const k of EXPR_KEYS) cur[k] = EXPRESSIONS.neutral[k];
  let manualExpr = null;
  let manualTimer = 0;
  let surpriseTimer = 0;
  let angryTimer = 0;
  let euphoriaTimer = 0;
  let blinkTimer = 1 + Math.random() * 3;
  let blinkPhase = -1;
  let lookX = 0;
  let lookY = 0;
  let screenAccum = 0;

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
    if (giveBoost && level >= 1) {
      let dur = DRIFT_BOOST[level];
      if (level === 3 && perkAura) {
        dur *= PERK_AURA_BOOST;
        auraTime = Math.max(auraTime, dur);
        state.aura = true;
        emit(PERK_EVENT, { kart, perkId });
      }
      applyBoost(dur, 1, 'drift');
    }
  }

  function applyBoost(duration, strength = 1, source = 'item') {
    let d = duration;
    if (source === 'item' && perkRugido) d *= PERK_ITEM_BOOST; // rugido
    state.boostTime = Math.max(state.boostTime, d);
    boostStrength = clamp(strength, 0, 2);
    emit(EVENTS.BOOST, { kart, source });
  }

  function hit(by = 'hit') {
    if (state.shieldTime > 0) return;
    // siete_vidas: ignora el primer golpe de cada vuelta (se rearma con LAP).
    if (perkSieteVidas && livesArmed) {
      livesArmed = false;
      bumpImpulse(0.4);
      setExpression('contento', 1.4);
      emit(PERK_EVENT, { kart, perkId });
      return;
    }
    endDrift(false);
    state.boostTime = 0;
    auraTime = 0;
    state.aura = false;
    state.spinTime = SPIN_TIME * (perkBlindaje ? PERK_SPIN_FACTOR : 1);
    spinAngle = 0;
    const w = character.stats.weight;
    speed *= clamp(0.55 - w * 0.05, 0.25, 0.55);
    lat *= 0.3;
    // 'sorprendido' los primeros ~0.4 s del giro, luego 'mareado', y 'enfadado'
    // ~1.5 s DESPUÉS del giro (el temporizador corre a la vez que el spin).
    surpriseTimer = 0.4;
    angryTimer = state.spinTime + 1.5;
    lookBackTimer = Math.max(lookBackTimer, 1.1); // mira atrás por quién le golpeó
    emit(EVENTS.HIT, { kart, by });
  }

  function setExpression(name, duration) {
    if (!EXPRESSIONS[name]) return;
    manualExpr = name;
    manualTimer = duration === undefined ? 2.5 : duration;
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
    tailSpring.pos = tailSpring.vel = 0;
    earSpring.pos = earSpring.vel = 0;
    manualExpr = null;
    manualTimer = 0;
    surpriseTimer = 0;
    angryTimer = 0;
    euphoriaTimer = 0;
    state.aura = false;
    auraTime = 0;
    lookBackTimer = 0;
    headYaw = 0;
    glowPulse = 0;
    rampLaunch = false;
    livesArmed = perkSieteVidas;
    pilot.position.y = PILOT_BASE_Y;
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

  function updateSpring(spring, force, dt, kSpring, damping) {
    spring.vel += (-kSpring * spring.pos - damping * spring.vel + force) * dt;
    spring.pos += spring.vel * dt;
    spring.pos = clamp(spring.pos, -0.95, 0.95);
  }

  // --- Anima ruedas instanciadas ---
  function updateWheels(dt) {
    for (let i = 0; i < WHEELS.length; i++) {
      const w = WHEELS[i];
      wheelSpin[i] += (speed / 0.28) * dt;
      _wheelQ.setFromAxisAngle(AXIS_Y, w.steer ? steerVis * 0.42 : 0);
      _wheelQ2.setFromAxisAngle(AXIS_X, wheelSpin[i]);
      _wheelQ.multiply(_wheelQ2);
      _wheelPos.set(w.x, w.y, w.z);
      _wheelM.compose(_wheelPos, _wheelQ, _wheelScale);
      tireIM.setMatrixAt(i, _wheelM);
      rimIM.setMatrixAt(i, _wheelM);
    }
    tireIM.instanceMatrix.needsUpdate = true;
    rimIM.instanceMatrix.needsUpdate = true;
  }

  // --- Expresión objetivo (automática desde el estado) ---
  function autoExpression() {
    if (surpriseTimer > 0) return 'sorprendido';
    if (state.spinTime > 0) return 'mareado';
    if (angryTimer > 0) return 'enfadado';
    if (celebrating) return 'eufórico';
    if (euphoriaTimer > 0) return 'eufórico';
    if (state.boostTime > 0) return 'determinado';
    if (state.drifting && state.driftLevel >= 2) return 'determinado';
    if (state.airborne) return 'contento';
    return 'neutral';
  }

  function updateExpressions(dt) {
    if (manualTimer > 0) {
      manualTimer -= dt;
      if (manualTimer <= 0) manualExpr = null;
    }
    if (surpriseTimer > 0) surpriseTimer -= dt;
    if (angryTimer > 0) angryTimer -= dt;
    if (euphoriaTimer > 0) euphoriaTimer -= dt;

    const target = manualExpr || autoExpression();
    expression = target;
    const pose = EXPRESSIONS[target] || EXPRESSIONS.neutral;

    const k = 1 - Math.exp(-dt / 0.15);
    for (const key of EXPR_KEYS) {
      cur[key] += (pose[key] - cur[key]) * k;
    }

    // Parpadeo aleatorio.
    blinkTimer -= dt;
    if (blinkTimer <= 0) {
      blinkPhase = 0;
      blinkTimer = 2 + Math.random() * 3;
    }
    let blinkValue = 0;
    if (blinkPhase >= 0) {
      blinkPhase += dt;
      const p = blinkPhase / 0.13;
      if (p >= 1) {
        blinkPhase = -1;
      } else {
        blinkValue = p < 0.5 ? p * 2 : (1 - p) * 2;
      }
    }

    // Mirada: hacia donde gira el kart.
    const lookTargetX = clamp(steerVis * 0.9 + (state.drifting ? state.driftDir * 0.4 : 0), -1, 1);
    const lookTargetY = state.airborne ? 0.4 : controls.brake > 0 ? -0.4 : 0;
    lookX += (lookTargetX - lookX) * k;
    lookY += (lookTargetY - lookY) * k;

    if (faceMesh) {
      const mouth = cur;
      setMorph(faceMesh, faceMap, 'mouthSmile', mouth.smile);
      setMorph(faceMesh, faceMap, 'mouthBig', mouth.big);
      setMorph(faceMesh, faceMap, 'mouthO', mouth.o);
      setMorph(faceMesh, faceMap, 'mouthFrown', mouth.frown);
      setMorph(faceMesh, faceMap, 'mouthGrit', mouth.grit);
      setMorph(faceMesh, faceMap, 'browAngry', mouth.browAngry);
      setMorph(faceMesh, faceMap, 'browRaise', mouth.browRaise);
      const lid = Math.max(blinkValue, mouth.squint * 0.4);
      setMorph(faceMesh, faceMap, 'blink', lid);
      if (target === 'mareado') {
        const wob = Math.sin(animTime * 14);
        setMorph(faceMesh, faceMap, 'lookL', Math.max(0, -wob));
        setMorph(faceMesh, faceMap, 'lookR', Math.max(0, wob));
      } else {
        setMorph(faceMesh, faceMap, 'lookL', Math.max(0, -lookX));
        setMorph(faceMesh, faceMap, 'lookR', Math.max(0, lookX));
      }
      setMorph(faceMesh, faceMap, 'lookU', Math.max(0, lookY));
      setMorph(faceMesh, faceMap, 'lookD', Math.max(0, -lookY));
    }

    // Pantalla del robot: redibuja cuando cambia algo relevante (limitado).
    if (screen && screenMesh) {
      screenAccum += dt;
      if (screenAccum > 0.07) {
        screenAccum = 0;
        screen.draw({ expression: target, blink: blinkValue, lookX, lookY, t: animTime });
      }
    }
  }

  function animate(dt, spinning, steerIn, speedNorm) {
    const k = 1 - Math.exp(-12 * dt);

    // Dirección visual de las ruedas delanteras.
    steerVis += (steerIn - steerVis) * k;
    updateWheels(dt);

    // Volante que gira con la dirección.
    steeringPivot.rotation.z = steerVis * 1.4;

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

    // Cabeza con inercia (muelle).
    updateSpring(headSpring, -rollVis * 14 - slideVis * 10, dt, 46, 8);
    headGroup.rotation.z = -rollVis * 0.5 + headSpring.pos * 0.5;
    headGroup.rotation.x = pitchVis * 0.5;
    if (spinning) dizzy += dt * 11;
    else dizzy += (0 - dizzy) * (1 - Math.exp(-6 * dt));
    const shake = cur.headShake * Math.sin(animTime * 12) * 0.28;
    // Tanda 4: mira hacia dentro de la curva y atrás un instante tras un golpe,
    // para que se vea la cara a menudo desde la cámara de persecución.
    const turnLook = clamp(steerVis * 0.5 + (state.drifting ? state.driftDir * 0.5 : 0), -1.1, 1.1);
    const back = lookBackTimer > 0 ? lookBackSign * 1.25 : 0;
    headYaw += (turnLook + back - headYaw) * (1 - Math.exp(-7 * dt));
    headGroup.rotation.y = dizzy + shake + headYaw;

    // Brazos: al volante; giran con la dirección y suben al celebrar.
    const armLift = celebrating ? -2.3 : cur.big > 0.5 ? -0.5 : 0;
    armsGroup.rotation.x += (armLift - armsGroup.rotation.x) * (1 - Math.exp(-10 * dt));
    armsGroup.rotation.y = steerVis * 0.32;

    // Respiración leve del torso.
    const breath = 1 + Math.sin(animTime * 2.6) * 0.015 + speedNorm * 0.01;
    bodyMesh.scale.set(1, breath, 1);

    // Zuri (numbat): hiperactivo, rebota en el asiento.
    if (hyper) {
      pilot.position.y = PILOT_BASE_Y + Math.abs(Math.sin(animTime * 7.5)) * (0.018 + speedNorm * 0.03);
    }

    // Orejas / cola con física de muelle → morphs.
    updateSpring(earSpring, -rollVis * 16 + bumpPos * 26 - speedNorm * 12, dt, 40, 8);
    updateSpring(tailSpring, -rollVis * 12 + bumpPos * 22, dt, 30, 7);
    if (headMesh) {
      const bend = clamp(speedNorm * 0.7 + Math.max(0, -earSpring.pos) * 0.8, 0, 1);
      setMorph(headMesh, headMap, 'earBend', bend);
      setMorph(headMesh, headMap, 'earWag', clamp(earSpring.pos, -1, 1));
    }
    setMorph(bodyMesh, bodyMap, 'tailSwing', clamp(tailSpring.pos, -1, 1));
    setMorph(bodyMesh, bodyMap, 'tailUp', clamp(-earSpring.pos * 0.6, -1, 1));

    // Escudo: brillo arcoíris cíclico sobre la pintura.
    if (state.shieldTime > 0) {
      shieldHue = (shieldHue + dt * 1.6) % 1;
      mats.paint.emissive.setHSL(shieldHue, 0.9, 0.5);
      mats.paint.emissiveIntensity = 0.5;
    } else if (mats.paint.emissiveIntensity !== 0) {
      mats.paint.emissiveIntensity = 0;
    }

    // Kenzo: el pelo (mechas) brilla turquesa con el turbo.
    if (glowMesh) {
      const target = state.boostTime > 0 ? 0.9 + 0.45 * Math.sin(animTime * 20) : 0;
      glowPulse += (target - glowPulse) * (1 - Math.exp(-9 * dt));
      glowMat.emissiveIntensity = glowPulse;
    }

    // Sombra de contacto: se queda en el suelo y se difumina al saltar.
    const off = Math.max(0, position.y - groundY);
    shadow.position.y = -off + 0.03;
    const ss = 1 + off * 0.35;
    shadow.scale.set(ss, ss, ss);
    mats.shadow.opacity = clamp(0.9 - off * 0.5, 0.2, 0.9);

    // Orientación base (giro por golpe y celebración añaden rotación cosmética).
    object3d.rotation.y =
      heading + spinAngle + (celebrating ? Math.sin(animTime * 1.6) * 0.22 : 0);
  }

  function update(dt, track) {
    if (!track || !isFinite(dt) || dt <= 0) return;

    const proj = track.projectToTrack(position, kart.trackT);
    kart.trackT = proj.t;
    state.surface = proj.surface;
    groundY = proj.groundY;
    animTime += dt;

    // --- temporizadores ---
    if (state.boostTime > 0) state.boostTime = Math.max(0, state.boostTime - dt);
    if (state.shieldTime > 0) state.shieldTime = Math.max(0, state.shieldTime - dt);
    if (auraTime > 0) {
      auraTime = Math.max(0, auraTime - dt);
      if (auraTime === 0) state.aura = false;
    }
    if (lookBackTimer > 0) lookBackTimer = Math.max(0, lookBackTimer - dt);
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
    else if (proj.surface === 'offroad') effMax *= offroadFactor;
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
    // patinador: además del tope, el arrastre extra fuera de pista se reduce a la mitad.
    if (proj.surface === 'offroad' && state.boostTime <= 0) drag += perkPatinador ? 0.35 : 0.7;
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
      driftCharge += dt * (1 + inward * 0.7) * (perkAstucia ? PERK_DRIFT_CHARGE : 1);
      let lvl = 0;
      if (driftCharge >= DRIFT_LEVEL_TIME[2]) lvl = 3;
      else if (driftCharge >= DRIFT_LEVEL_TIME[1]) lvl = 2;
      else if (driftCharge >= DRIFT_LEVEL_TIME[0]) lvl = 1;
      if (lvl > state.driftLevel) {
        state.driftLevel = lvl;
        emit(EVENTS.DRIFT_LEVEL, { kart, level: lvl });
        if (lvl === 3) euphoriaTimer = 1.2;
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
        // salto_rana: turbo de 0.5 s al aterrizar tras una rampa.
        if (rampLaunch && perkSalto) {
          applyBoost(0.5, 1, 'pad');
          emit(PERK_EVENT, { kart, perkId });
        }
        rampLaunch = false;
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
        vy = RAMP_IMPULSE * (perkSalto ? PERK_RAMP_IMPULSE : 1);
        rampLaunch = true;
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
    updateExpressions(dt);
  }

  function celebrate() {
    celebrating = true;
    endDrift(false);
    state.spinTime = 0;
    spinAngle = 0;
    euphoriaTimer = 3;
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
    get expression() {
      return expression;
    },
    update,
    applyBoost,
    hit,
    setTransform,
    getForward,
    celebrate,
    setExpression,
  };

  if (events) {
    // siete_vidas: se rearma al empezar cada vuelta del kart.
    events.on(EVENTS.LAP, (p) => {
      if (p && p.kart === kart && perkSieteVidas) livesArmed = true;
    });
    // Mira atrás cuando alguien le embiste por detrás.
    events.on(EVENTS.BUMP, (p) => {
      if (!p) return;
      if (p.a === kart || p.b === kart) lookBackTimer = Math.max(lookBackTimer, 0.9);
    });
  }

  setTransform(position, 0);
  updateWheels(0);
  return kart;
}
