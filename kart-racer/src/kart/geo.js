// Bloque 2 — Utilidades de geometría orgánica (tanda 3).
// Todo procedural: deformación suave de vértices, soldadura de costuras,
// fusionado con color por vértice y morph targets (para caras expresivas).
// Sin archivos externos: las texturas se generan por código en materials.js.

import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const ZERO3 = [0, 0, 0];

// ---------------------------------------------------------------------------
// Transformaciones
// ---------------------------------------------------------------------------

// Aplica escala/rotación/traslación in-place. Recalcula normales si hay escala
// no uniforme (para conservar el sombreado suave correcto).
export function xf(geo, t = {}) {
  const { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = t;
  let scaled = false;
  if (sx !== 1 || sy !== 1 || sz !== 1) {
    geo.scale(sx, sy, sz);
    scaled = true;
  }
  if (rx) geo.rotateX(rx);
  if (ry) geo.rotateY(ry);
  if (rz) geo.rotateZ(rz);
  if (x || y || z) geo.translate(x, y, z);
  if (scaled && geo.attributes.normal) geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------------------
// Deformación y soldadura
// ---------------------------------------------------------------------------

// Deforma cada vértice con fn(Vector3). No recalcula normales (se hace al soldar).
export function deformPositions(geo, fn) {
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    fn(v, i);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  p.needsUpdate = true;
  return geo;
}

// Suelda costuras (uv/normal descartados) y recalcula normales suaves.
// Imprescindible para esferas deformadas: sin esto queda una costura visible.
export function weld(geo, tol = 1e-4) {
  geo.deleteAttribute('uv');
  geo.deleteAttribute('normal');
  let g = geo;
  try {
    g = mergeVertices(geo, tol);
  } catch {
    g = geo;
  }
  g.computeVertexNormals();
  return g;
}

// Esfera de alta resolución deformable, soldada y con normales suaves.
export function blob(r, fn, w = 32, h = 22) {
  const g = new THREE.SphereGeometry(r, w, h);
  if (fn) deformPositions(g, fn);
  return weld(g);
}

// Cápsula soldada.
export function cap(r, len, fn) {
  const g = new THREE.CapsuleGeometry(r, len, 10, 22);
  if (fn) deformPositions(g, fn);
  return weld(g);
}

// Lathe soldado.
export function lathe(points, seg, fn) {
  const g = new THREE.LatheGeometry(points, seg);
  if (fn) deformPositions(g, fn);
  return weld(g);
}

// ---------------------------------------------------------------------------
// Fusión con color por vértice + morph targets
// ---------------------------------------------------------------------------

// parts: Array<{ geo, color, morphs?: { [name]: (x,y,z) => [dx,dy,dz] } }>
// Devuelve una BufferGeometry con atributos position/normal/uv/color y, si hay
// morphs, morphAttributes.position (relativos) + userData.morphNames.
export function mergeParts(parts) {
  const nd = parts.map((p) => {
    const src = p.geo;
    const g = src.index ? src.toNonIndexed() : src;
    return { g, color: new THREE.Color(p.color), morphs: p.morphs || null };
  });

  const names = [];
  const seen = new Set();
  for (const p of nd) {
    if (!p.morphs) continue;
    for (const k of Object.keys(p.morphs)) {
      if (!seen.has(k)) {
        seen.add(k);
        names.push(k);
      }
    }
  }

  let total = 0;
  for (const p of nd) total += p.g.attributes.position.count;

  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const uvs = new Float32Array(total * 2);
  const col = new Float32Array(total * 3);
  const morphArr = names.map(() => new Float32Array(total * 3));

  let vo = 0;
  for (const p of nd) {
    const P = p.g.attributes.position;
    const N = p.g.attributes.normal;
    const U = p.g.attributes.uv;
    const n = P.count;
    pos.set(P.array, vo * 3);
    if (N) nor.set(N.array, vo * 3);
    if (U) uvs.set(U.array, vo * 2);
    for (let i = 0; i < n; i++) {
      const o = (vo + i) * 3;
      col[o] = p.color.r;
      col[o + 1] = p.color.g;
      col[o + 2] = p.color.b;
    }
    if (p.morphs) {
      for (let mi = 0; mi < names.length; mi++) {
        const fn = p.morphs[names[mi]];
        if (!fn) continue;
        const arr = morphArr[mi];
        for (let i = 0; i < n; i++) {
          const d = fn(P.getX(i), P.getY(i), P.getZ(i)) || ZERO3;
          const o = (vo + i) * 3;
          arr[o] = d[0];
          arr[o + 1] = d[1];
          arr[o + 2] = d[2];
        }
      }
    }
    vo += n;
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));

  if (names.length) {
    out.morphAttributes.position = morphArr.map((a) => new THREE.BufferAttribute(a, 3));
    out.morphTargetsRelative = true;
    out.userData.morphNames = names;
  }
  out.computeBoundingSphere();
  return out;
}

// Índice semántico: nombre de morph → posición en morphTargetInfluences.
export function morphIndex(geo, name) {
  const names = geo.userData.morphNames;
  if (!names) return -1;
  return names.indexOf(name);
}

// ---------------------------------------------------------------------------
// Ruido procedural (value noise + fBm). Solo en tiempo de construcción.
// ---------------------------------------------------------------------------

function hash(i, j, k) {
  let n = (i * 374761393 + j * 668265263 + k * 1442695040) | 0;
  n = (n ^ (n >> 13)) | 0;
  n = Math.imul(n, 1274126177) | 0;
  n = (n ^ (n >> 16)) >>> 0;
  return n / 4294967295;
}

const lerp = (a, b, t) => a + (b - a) * t;

export function noise3(x, y, z) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = x - xi;
  const yf = y - yi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const w = zf * zf * (3 - 2 * zf);
  const c = (i, j, k) => hash(xi + i, yi + j, zi + k);
  const x00 = lerp(c(0, 0, 0), c(1, 0, 0), u);
  const x10 = lerp(c(0, 1, 0), c(1, 1, 0), u);
  const x01 = lerp(c(0, 0, 1), c(1, 0, 1), u);
  const x11 = lerp(c(0, 1, 1), c(1, 1, 1), u);
  return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w);
}

export function fbm(x, y, z, oct = 3) {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < oct; i++) {
    sum += amp * noise3(x * f, y * f, z * f);
    f *= 2;
    amp *= 0.5;
  }
  return sum;
}

// Ruido centrado en 0 (−1..1 aprox.) para desplazamientos.
export function sNoise(x, y, z) {
  return noise3(x, y, z) * 2 - 1;
}

// ---------------------------------------------------------------------------
// Utilidades varias
// ---------------------------------------------------------------------------

export function tube(rt, rb, h, seg = 12) {
  return weld(new THREE.CylinderGeometry(rt, rb, h, seg));
}

export function ball(r, seg = 18) {
  return weld(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.7)));
}

export function torus(r, tubeR, radial = 12, tubular = 24, arc = Math.PI * 2) {
  return weld(new THREE.TorusGeometry(r, tubeR, radial, tubular, arc));
}

export function clone(geo) {
  return geo.clone();
}
