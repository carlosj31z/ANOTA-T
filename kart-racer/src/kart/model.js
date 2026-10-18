// Bloque 2 — Geometría procedural del kart (chasis, ruedas, emblema).
// Todo se genera por código y se cachea a nivel de módulo: un mismo personaje
// reutiliza su geometría fusionada entre karts y entre carreras.
// Estilo "low-poly juguete", ~1.8 m de largo, morro hacia +Z.

import * as THREE from 'three';
import { CHARACTERS } from '../shared/characters.js';
import { buildPilotParts } from './pilot.js';

const modelCache = new Map();

// Plano compartido del emblema (la textura cambia por personaje).
const EMBLEM_GEO = new THREE.PlaneGeometry(0.5, 0.34);

// ---------------------------------------------------------------------------
// Utilidades de geometría
// ---------------------------------------------------------------------------

function nonIndexed(geo) {
  return geo.index ? geo.toNonIndexed() : geo;
}

// Aplica escala/rotación/traslación in-place a una BufferGeometry.
function g(geo, t = {}) {
  const { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s } = t;
  if (s) {
    geo.scale(s[0], s[1], s[2]);
    geo.computeVertexNormals();
  }
  if (rx) geo.rotateX(rx);
  if (ry) geo.rotateY(ry);
  if (rz) geo.rotateZ(rz);
  if (x || y || z) geo.translate(x, y, z);
  return geo;
}

function box(w, h, d) {
  return new THREE.BoxGeometry(w, h, d);
}
function cyl(rt, rb, h, seg = 10) {
  return new THREE.CylinderGeometry(rt, rb, h, seg);
}

// Fusiona varias geometrías en una sola con color por vértice.
// parts: Array<{ geo: BufferGeometry, color: number }>
export function mergeColored(parts) {
  const list = [];
  let total = 0;
  for (const part of parts) {
    const geo = nonIndexed(part.geo);
    const col = new THREE.Color(part.color);
    list.push({ geo, col });
    total += geo.attributes.position.count;
  }

  const position = new Float32Array(total * 3);
  const normal = new Float32Array(total * 3);
  const uv = new Float32Array(total * 2);
  const color = new Float32Array(total * 3);

  let po = 0;
  let no = 0;
  let uo = 0;
  let co = 0;
  for (const { geo, col } of list) {
    const pAttr = geo.attributes.position;
    const nAttr = geo.attributes.normal;
    const uAttr = geo.attributes.uv;
    position.set(pAttr.array, po);
    po += pAttr.array.length;
    if (nAttr) {
      normal.set(nAttr.array, no);
      no += nAttr.array.length;
    }
    if (uAttr) uv.set(uAttr.array, uo);
    uo += pAttr.count * 2;
    for (let i = 0; i < pAttr.count; i++) {
      color[co] = col.r;
      color[co + 1] = col.g;
      color[co + 2] = col.b;
      co += 3;
    }
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(position, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setAttribute('color', new THREE.BufferAttribute(color, 3));
  out.computeBoundingSphere();
  return out;
}

// ---------------------------------------------------------------------------
// Emblema: número del personaje dibujado en CanvasTexture
// ---------------------------------------------------------------------------

function emblemTexture(character) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, size, size);
  // Disco de fondo
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.46, 0, Math.PI * 2);
  ctx.fillStyle = '#fdfdf7';
  ctx.fill();
  ctx.lineWidth = 9;
  ctx.strokeStyle = '#15171c';
  ctx.stroke();

  // Número derivado del orden del personaje en la lista compartida.
  const idx = CHARACTERS.findIndex((c) => c.id === character.id);
  const num = idx >= 0 ? idx + 1 : 1;
  ctx.fillStyle = '#15171c';
  ctx.font = '900 74px system-ui, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(num), size / 2, size / 2 + 4);

  // Rayita de acento en la base del disco.
  ctx.strokeStyle = '#' + character.colors.kartAccent.toString(16).padStart(6, '0');
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.40, 0.6, 2.55);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------------------
// Chasis
// ---------------------------------------------------------------------------

function buildChassisGeo(C) {
  const kart = C.kart;
  const accent = C.kartAccent;
  const dark = 0x2a2d33;
  const darker = 0x14161a;
  const parts = [];
  const add = (geo, color) => parts.push({ geo, color });

  // Suelo y casco central
  add(g(box(0.86, 0.12, 1.6), { y: 0.28 }), kart);
  add(g(box(0.62, 0.30, 1.15), { y: 0.47, z: -0.02 }), kart);

  // Morro escalonado
  add(g(box(0.46, 0.20, 0.5), { y: 0.42, z: 0.72 }), kart);
  add(g(box(0.30, 0.14, 0.24), { y: 0.40, z: 1.04 }), kart);

  // Pontones laterales
  add(g(box(0.22, 0.28, 1.0), { x: 0.46, y: 0.40, z: -0.02 }), kart);
  add(g(box(0.22, 0.28, 1.0), { x: -0.46, y: 0.40, z: -0.02 }), kart);

  // Alerón trasero
  add(g(box(0.98, 0.07, 0.30), { y: 0.80, z: -0.78 }), accent);
  add(g(box(0.06, 0.24, 0.30), { x: 0.48, y: 0.76, z: -0.78 }), accent);
  add(g(box(0.06, 0.24, 0.30), { x: -0.48, y: 0.76, z: -0.78 }), accent);
  add(g(box(0.06, 0.36, 0.06), { x: 0.30, y: 0.62, z: -0.78 }), dark);
  add(g(box(0.06, 0.36, 0.06), { x: -0.30, y: 0.62, z: -0.78 }), dark);

  // Franja del morro y franjas laterales
  add(g(box(0.22, 0.06, 0.72), { y: 0.55, z: 0.52 }), accent);
  add(g(box(0.05, 0.09, 0.9), { x: 0.575, y: 0.53, z: -0.02 }), accent);
  add(g(box(0.05, 0.09, 0.9), { x: -0.575, y: 0.53, z: -0.02 }), accent);

  // Parachoques delantero
  add(g(box(0.8, 0.12, 0.14), { y: 0.34, z: 1.08 }), accent);

  // Asiento
  add(g(box(0.56, 0.10, 0.5), { y: 0.52, z: -0.22 }), dark);
  add(g(box(0.56, 0.5, 0.14), { y: 0.74, z: -0.45 }), dark);

  // Columna y volante
  add(g(cyl(0.035, 0.035, 0.34, 8), { y: 0.62, z: 0.46, rx: 0.6 }), darker);
  add(g(new THREE.TorusGeometry(0.13, 0.028, 8, 14), { y: 0.78, z: 0.55, rx: 1.15 }), darker);

  // Tubos de escape (el brillo lo aporta una malla aparte)
  add(g(cyl(0.05, 0.055, 0.5, 8), { x: 0.24, y: 0.44, z: -0.7, rx: Math.PI / 2 }), dark);
  add(g(cyl(0.05, 0.055, 0.5, 8), { x: -0.24, y: 0.44, z: -0.7, rx: Math.PI / 2 }), dark);

  return mergeColored(parts);
}

function buildExhaustGlowGeo() {
  // Dos toberas con forma de llama estática; el material parpadea en turbo.
  return mergeColored([
    { geo: g(new THREE.ConeGeometry(0.075, 0.22, 8), { x: 0.24, y: 0.44, z: -1.0, rx: -Math.PI / 2 }), color: 0xffffff },
    { geo: g(new THREE.ConeGeometry(0.075, 0.22, 8), { x: -0.24, y: 0.44, z: -1.0, rx: -Math.PI / 2 }), color: 0xffffff },
  ]);
}

// ---------------------------------------------------------------------------
// Ruedas (llanta + neumático + buje) fusionados y con color por vértice
// ---------------------------------------------------------------------------

function buildWheelGeo(radius, width, accent) {
  return mergeColored([
    { geo: g(cyl(radius, radius, width, 16), { rz: Math.PI / 2 }), color: 0x1b1d22 },
    { geo: g(cyl(radius * 0.62, radius * 0.62, width * 1.08, 12), { rz: Math.PI / 2 }), color: accent },
    { geo: g(cyl(radius * 0.24, radius * 0.24, width * 1.24, 8), { rz: Math.PI / 2 }), color: 0x3a3f47 },
  ]);
}

// ---------------------------------------------------------------------------
// Construcción y caché del modelo completo por personaje
// ---------------------------------------------------------------------------

function mergeMaybe(parts) {
  return parts && parts.length > 0 ? mergeColored(parts) : null;
}

function buildModel(character) {
  const C = character.colors;
  const pilot = buildPilotParts(character);
  return {
    chassisGeo: buildChassisGeo(C),
    exhaustGeo: buildExhaustGlowGeo(),
    frontWheelGeo: buildWheelGeo(0.26, 0.20, C.kartAccent),
    rearWheelGeo: buildWheelGeo(0.30, 0.30, C.kartAccent),
    emblemGeo: EMBLEM_GEO,
    emblemTex: emblemTexture(character),
    pilot: {
      bodyGeo: mergeMaybe(pilot.body),
      headGeo: mergeMaybe(pilot.head),
      faceGeo: mergeMaybe(pilot.face),
      armsGeo: mergeMaybe(pilot.arms),
      headSpringGeo: mergeMaybe(pilot.headSpring),
      bodySpringGeo: mergeMaybe(pilot.bodySpring),
      anchors: pilot.anchors,
    },
  };
}

export function getKartModel(character) {
  let model = modelCache.get(character.id);
  if (!model) {
    model = buildModel(character);
    modelCache.set(character.id, model);
  }
  return model;
}
