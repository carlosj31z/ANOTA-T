// Bloque 2 — Geometría del kart (tanda 3): carrocería curva con ExtrudeGeometry
// y bevel generoso, neumáticos por lathe, llantas con radios, alerón, asiento,
// volante, faros y dorsal. Todo procedural y cacheado por personaje.

import * as THREE from 'three';
import { xf, deformPositions, weld, blob, tube, torus, mergeParts } from './geo.js';
import { buildPilot } from './pilot.js';
import { getKartMaterials } from './materials.js';

const cache = new Map();

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---------------------------------------------------------------------------
// Carrocería
// ---------------------------------------------------------------------------

function chassisGeo(C) {
  const kart = C.kart;
  const accent = C.kartAccent;
  const dark = 0x24262c;
  const darker = 0x141619;

  // Perfil lateral (x = largo, y = alto).
  const shape = new THREE.Shape();
  shape.moveTo(-0.86, 0.09);
  shape.quadraticCurveTo(-1.0, 0.11, -0.98, 0.3);
  shape.quadraticCurveTo(-0.96, 0.52, -0.72, 0.56);
  shape.lineTo(-0.12, 0.58);
  shape.quadraticCurveTo(0.36, 0.6, 0.62, 0.5);
  shape.quadraticCurveTo(1.02, 0.42, 1.08, 0.25);
  shape.quadraticCurveTo(1.02, 0.11, 0.84, 0.08);
  shape.lineTo(-0.86, 0.09);

  const depth = 0.76;
  let body = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.07,
    bevelSize: 0.07,
    bevelSegments: 5,
    curveSegments: 12,
    steps: 1,
  });
  // Orienta: largo → Z, ancho → X.
  body.rotateY(-Math.PI / 2);
  body.translate(depth / 2, 0, 0);
  deformPositions(body, (v) => {
    const t = clamp((v.z + 0.9) / 1.95, 0, 1);
    const wf = 0.66 + 0.34 * Math.sin(Math.PI * Math.pow(t, 0.85));
    v.x *= wf;
    v.y += 0.02 * Math.sin(t * Math.PI);
  });
  body = weld(body);

  const parts = [];
  const add = (geo, color) => parts.push({ geo, color });
  add(body, kart);

  // Pontones laterales redondeados.
  for (const side of [1, -1]) {
    let pod = blob(0.11, (v) => {
      v.z *= 2.4;
      v.y *= 1.1;
    }, 20, 14);
    xf(pod, { x: side * 0.44, y: 0.34, z: 0.0, rz: side * 0.0 });
    add(pod, kart);
    add(
      xf(blob(0.05, (v) => { v.z *= 3.2; }, 14, 10), { x: side * 0.55, y: 0.34, z: 0.0 }),
      accent
    );
  }

  // Franja del morro.
  let stripe = blob(0.06, (v) => {
    v.z *= 3.2;
    v.x *= 1.6;
    v.y *= 0.4;
  }, 16, 12);
  xf(stripe, { x: 0, y: 0.62, z: 0.5 });
  add(stripe, accent);

  // Alerón trasero (perfil aerodinámico).
  let wing = blob(0.09, (v) => {
    v.x *= 4.6;
    v.z *= 1.5;
    v.y *= 0.34;
  }, 20, 14);
  xf(wing, { x: 0, y: 0.82, z: -0.82 });
  add(wing, accent);
  for (const side of [1, -1]) {
    add(xf(tube(0.028, 0.028, 0.34, 10), { x: side * 0.32, y: 0.64, z: -0.82 }), dark);
  }

  // Asiento acolchado (base + respaldo curvado).
  let seat = blob(0.2, (v) => {
    v.x *= 1.5;
    v.z *= 1.3;
    v.y *= 0.5;
  }, 18, 14);
  xf(seat, { x: 0, y: 0.5, z: -0.24 });
  add(seat, dark);
  let back = blob(0.18, (v) => {
    v.x *= 1.4;
    v.y *= 1.7;
    v.z *= 0.5;
  }, 18, 14);
  xf(back, { x: 0, y: 0.7, z: -0.44, rx: -0.18 });
  add(back, darker);

  // Suelo / pan (darker).
  let pan = blob(0.3, (v) => { v.x *= 1.5; v.z *= 2.9; v.y *= 0.12; }, 18, 12);
  xf(pan, { x: 0, y: 0.22, z: -0.05 });
  add(pan, darker);

  return mergeParts(parts);
}

function chromeGeo() {
  const parts = [];
  const add = (geo) => parts.push({ geo, color: 0xffffff });

  // Parachoques tubulares.
  for (const side of [1, -1]) {
    add(xf(tube(0.028, 0.028, 0.72, 10), { x: side * 0.42, y: 0.28, z: 0.62, rz: Math.PI / 2 }));
    add(xf(tube(0.026, 0.026, 0.6, 10), { x: side * 0.42, y: 0.3, z: -0.85, rz: Math.PI / 2 }));
  }

  // Arco antivuelco tras el asiento.
  let roll = torus(0.34, 0.035, 8, 16, Math.PI);
  xf(roll, { x: 0, y: 0.72, z: -0.56 });
  add(roll);

  // Escapes.
  for (const side of [1, -1]) {
    add(xf(tube(0.045, 0.05, 0.42, 10), { x: side * 0.26, y: 0.4, z: -0.82, rx: Math.PI / 2 }));
    add(xf(tube(0.06, 0.06, 0.06, 10), { x: side * 0.26, y: 0.4, z: -1.02, rx: Math.PI / 2 }));
  }

  // Columna de dirección.
  add(xf(tube(0.028, 0.028, 0.4, 10), { x: 0, y: 0.62, z: 0.4, rx: 0.55 }));

  return mergeParts(parts);
}

function lightsGeo() {
  const parts = [];
  // Faros delanteros.
  for (const side of [1, -1]) {
    let l = blob(0.05, (v) => { v.z *= 1.2; }, 10, 8);
    xf(l, { x: side * 0.2, y: 0.42, z: 1.02 });
    parts.push({ geo: l, color: 0xfff6d6 });
  }
  // Pilotos traseros.
  for (const side of [1, -1]) {
    let l = blob(0.045, (v) => { v.x *= 1.4; v.z *= 0.5; v.y *= 0.7; }, 10, 8);
    xf(l, { x: side * 0.34, y: 0.5, z: -0.88 });
    parts.push({ geo: l, color: 0xff2e2e });
  }
  return mergeParts(parts);
}

function decalGeo() {
  const g = new THREE.PlaneGeometry(0.4, 0.4);
  return g;
}

// ---------------------------------------------------------------------------
// Ruedas
// ---------------------------------------------------------------------------

function tireGeo(radius, width) {
  const rimR = radius * 0.6;
  const h = width / 2;
  const pts = [
    new THREE.Vector2(rimR, -h),
    new THREE.Vector2(radius * 0.82, -h),
    new THREE.Vector2(radius, -h + 0.05),
    new THREE.Vector2(radius, h - 0.05),
    new THREE.Vector2(radius * 0.82, h),
    new THREE.Vector2(rimR, h),
  ];
  let g = new THREE.LatheGeometry(pts, 20);
  g.rotateZ(Math.PI / 2); // eje del neumático → X
  return g;
}

function rimGeo(radius, width) {
  const rimR = radius * 0.6;
  const parts = [];
  add2(parts, xf(tube(rimR, rimR, width * 0.6, 16), { rz: Math.PI / 2 }));
  add2(parts, xf(tube(rimR * 0.35, rimR * 0.35, width * 0.8, 12), { rz: Math.PI / 2 }));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    let spoke = tube(0.016, 0.016, rimR * 0.9, 6);
    xf(spoke, { rz: Math.PI / 2 });
    xf(spoke, { x: 0, y: Math.sin(a) * rimR * 0.45, z: Math.cos(a) * rimR * 0.45 });
    add2(parts, spoke);
  }
  return mergeParts(parts);
}

function add2(parts, geo) {
  parts.push({ geo, color: 0xffffff });
}

// ---------------------------------------------------------------------------
// Volante (malla aparte, rota con la dirección)
// ---------------------------------------------------------------------------

function steeringGeo() {
  const parts = [];
  let ring = torus(0.115, 0.022, 10, 20);
  xf(ring, { z: 0.0 });
  parts.push({ geo: ring, color: 0xffffff });
  add2(parts, xf(tube(0.03, 0.03, 0.05, 12), { rx: Math.PI / 2 }));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    let spoke = tube(0.012, 0.012, 0.11, 6);
    xf(spoke, { rz: Math.PI / 2 });
    xf(spoke, { ry: a, x: Math.cos(a) * 0.055, y: Math.sin(a) * 0.055 });
    add2(parts, spoke);
  }
  return mergeParts(parts);
}

// ---------------------------------------------------------------------------
// Modelo completo
// ---------------------------------------------------------------------------

function build(character) {
  const C = character.colors;
  const pilot = buildPilot(character);
  return {
    character,
    materials: getKartMaterials(character),
    chassisGeo: chassisGeo(C),
    chromeGeo: chromeGeo(C),
    lightsGeo: lightsGeo(),
    decalGeo: decalGeo(),
    tireGeo: tireGeo(0.27, 0.22),
    rimGeo: rimGeo(0.27, 0.22),
    steeringGeo: steeringGeo(),
    shadowGeo: xf(new THREE.PlaneGeometry(2.5, 2.3), { rx: -Math.PI / 2 }),
    pilot,
  };
}

export function getKartModel(character) {
  let m = cache.get(character.id);
  if (!m) {
    m = build(character);
    cache.set(character.id, m);
  }
  return m;
}
