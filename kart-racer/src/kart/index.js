// BLOQUE 2 reemplazará este stub. Mantener la API exacta (§4.2).
// Física arcade básica sin derrape real; el objetivo es que la carrera corra.

import * as THREE from 'three';
import { BASE_MAX_SPEED, OFFROAD_SPEED_FACTOR, ROAD_WIDTH } from '../shared/constants.js';
import { EVENTS } from '../shared/constants.js';

const WALL_LIMIT = ROAD_WIDTH / 2 + 8;

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

export function createKart(scene, character, opts = {}) {
  const isPlayer = !!opts.isPlayer;
  const events = opts.events;

  const object3d = new THREE.Group();
  object3d.name = `kart:${character.id}`;

  const kartColor = character.colors.kart;
  const accent = character.colors.kartAccent;
  const bodyColor = character.colors.body;

  const bodyGeo = new THREE.BoxGeometry(1.4, 0.55, 2.1);
  const bodyMat = new THREE.MeshLambertMaterial({ color: kartColor });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  object3d.add(body);

  const noseGeo = new THREE.BoxGeometry(0.9, 0.3, 0.7);
  const noseMat = new THREE.MeshLambertMaterial({ color: accent });
  const nose = new THREE.Mesh(noseGeo, noseMat);
  nose.position.set(0, 0.5, 1.1);
  nose.castShadow = true;
  object3d.add(nose);

  const seatGeo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
  const seatMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  const seat = new THREE.Mesh(seatGeo, seatMat);
  seat.position.set(0, 0.85, -0.35);
  object3d.add(seat);

  // Piloto
  const pilot = new THREE.Group();
  const torsoGeo = new THREE.CylinderGeometry(0.3, 0.34, 0.6, 8);
  const torsoMat = new THREE.MeshLambertMaterial({ color: bodyColor });
  const torso = new THREE.Mesh(torsoGeo, torsoMat);
  torso.position.y = 0.3;
  torso.castShadow = true;
  pilot.add(torso);
  const headGeo = new THREE.SphereGeometry(0.32, 12, 10);
  const headMat = new THREE.MeshLambertMaterial({ color: bodyColor });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 0.78;
  head.castShadow = true;
  pilot.add(head);
  pilot.position.set(0, 0.95, -0.3);
  object3d.add(pilot);

  // Ruedas
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const wheelPositions = [
    [-0.8, 0.35, 0.7],
    [0.8, 0.35, 0.7],
    [-0.8, 0.35, -0.7],
    [0.8, 0.35, -0.7],
  ];
  for (const [x, y, z] of wheelPositions) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, y, z);
    wheel.castShadow = true;
    object3d.add(wheel);
    wheels.push(wheel);
  }

  object3d.position.set(0, 0, 0);
  scene.add(object3d);

  const maxSpeed = BASE_MAX_SPEED * (0.88 + character.stats.speed * 0.024);
  const accelPower = 8 + character.stats.accel * 3;
  const brakePower = 18;
  const turnRate = 1.6 + character.stats.handling * 0.3;

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
  let boostStrength = 1;
  let wallCooldown = 0;
  let celebrating = false;

  function getForward() {
    return new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
  }

  function update(dt, track) {
    const proj = track.projectToTrack(position, this.trackT);
    this.trackT = proj.t;
    state.surface = proj.surface;

    if (state.boostTime > 0) state.boostTime -= dt;
    if (state.shieldTime > 0) state.shieldTime -= dt;
    if (wallCooldown > 0) wallCooldown -= dt;

    const spinning = state.spinTime > 0;
    if (spinning) state.spinTime -= dt;

    // Dirección de las ruedas delanteras + giro
    if (!spinning && !celebrating) {
      const speedFactor = Math.min(1, Math.abs(speed) / 9);
      const steerAmount = controls.steer * turnRate * speedFactor * dt;
      if (Math.abs(speed) > 0.4) {
        heading += steerAmount * (speed < 0 ? -1 : 1);
      }
      wheels[0].rotation.y = controls.steer * 0.3;
      wheels[1].rotation.y = controls.steer * 0.3;
    }

    let maxS = maxSpeed;
    if (state.boostTime > 0) maxS *= 1.35 * boostStrength;
    if (proj.surface === 'offroad') maxS *= OFFROAD_SPEED_FACTOR;
    if (proj.surface === 'wall') maxS *= 0.3;

    if (!spinning && !celebrating) {
      if (controls.throttle > 0) speed += accelPower * controls.throttle * dt;
      if (controls.brake > 0) {
        if (speed > 0.1) speed -= brakePower * controls.brake * dt;
        else speed -= accelPower * 0.6 * controls.brake * dt;
      }
    }

    // Rozamiento: bajo (rodadura) con gas, alto al soltar.
    const rolling = controls.throttle > 0 ? 0.25 : 1.6;
    speed -= speed * rolling * dt;
    if (Math.abs(speed) < 0.05 && controls.throttle <= 0 && controls.brake <= 0) speed = 0;

    const minSpeed = -maxSpeed * 0.4;
    if (speed > maxS) speed = Math.max(maxS, speed - 45 * dt);
    if (speed < minSpeed) speed = minSpeed;

    const fwd = getForward();
    position.addScaledVector(fwd, speed * dt);

    // Muro: empuja hacia dentro
    if (proj.surface === 'wall' && proj.wallNormal) {
      const push = Math.abs(proj.lateral) - (WALL_LIMIT - 0.4);
      if (push > 0) position.addScaledVector(proj.wallNormal, push);
      speed *= 0.6;
      if (wallCooldown <= 0 && events) {
        events.emit(EVENTS.WALL, { kart: this, impact: clamp(Math.abs(speed) / maxSpeed, 0, 1) });
        wallCooldown = 0.3;
      }
    }

    position.y = proj.groundY;

    velocity.copy(fwd).multiplyScalar(speed);

    // Animación: orientación y ruedas
    if (spinning) {
      object3d.rotation.y += dt * 10;
    } else if (celebrating) {
      object3d.rotation.y = heading;
      object3d.position.y = proj.groundY + Math.abs(Math.sin(performance.now() * 0.006)) * 0.4;
      pilot.rotation.z = Math.sin(performance.now() * 0.012) * 0.5;
    } else {
      object3d.rotation.y = heading;
    }

    const wheelSpin = (speed * dt) / 0.35;
    for (const w of wheels) w.rotation.x += wheelSpin;
  }

  function applyBoost(duration, strength = 1, source = 'boost') {
    state.boostTime = Math.max(state.boostTime, duration);
    boostStrength = strength;
    if (events) events.emit(EVENTS.BOOST, { kart: this, source });
  }

  function hit(by = 'hit') {
    if (state.shieldTime > 0) return;
    state.spinTime = 1.2;
    speed *= 0.3;
    if (events) events.emit(EVENTS.HIT, { kart: this, by });
  }

  function setTransform(p, h) {
    position.copy(p);
    heading = h;
    speed = 0;
    velocity.set(0, 0, 0);
    object3d.rotation.y = h;
  }

  function celebrate() {
    celebrating = true;
    state.spinTime = 0;
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

  return kart;
}
