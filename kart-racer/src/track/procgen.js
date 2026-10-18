// BLOQUE 1 — CIRCUITOS. Utilidades procedurales compartidas por todo el bloque:
// ruido determinista, deformación de geometría y fusión de mallas.
// Contrato §0: todo generado por código, sin archivos externos.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// --- PRNG determinista (mismo que usa el resto del bloque) ---
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Ruido de valor 2D con interpolación suave ---
export function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

export function valueNoise2(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

// fBm clásico (varias octavas de ruido de valor).
export function fbm2(x, y, octaves = 4, lacunarity = 2, gain = 0.5) {
  let s = 0;
  let amp = 1;
  let f = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    s += amp * valueNoise2(x * f, y * f);
    norm += amp;
    amp *= gain;
    f *= lacunarity;
  }
  return s / norm;
}

// Ruido "ridged" (crestas) útil para montañas y dunas.
export function ridge2(x, y, octaves = 4) {
  let s = 0;
  let amp = 1;
  let f = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    const n = 1 - Math.abs(valueNoise2(x * f, y * f) * 2 - 1);
    s += amp * n * n;
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return s / norm;
}

export function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a || 1)));
  return t * t * (3 - 2 * t);
}

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// --- Geometría ---

// Pasa a no indexado sólo si hace falta (necesario para mezclar tipos).
export function toNonIndexed(geo) {
  return geo.index ? geo.toNonIndexed() : geo;
}

// Fusiona una lista heterogénea de geometrías garantizando atributos comunes.
export function mergeGeo(list) {
  const clean = list
    .filter(Boolean)
    .map((g) => {
      const ng = toNonIndexed(g);
      if (!ng.attributes.uv) {
        const count = ng.attributes.position.count;
        const uv = new Float32Array(count * 2);
        ng.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      }
      if (!ng.attributes.normal) ng.computeVertexNormals();
      return ng;
    });
  if (clean.length === 0) return new THREE.BufferGeometry();
  if (clean.length === 1) return clean[0];
  const merged = mergeGeometries(clean, false);
  return merged || clean[0];
}

// Desplaza cada vértice a lo largo de su dirección radial (centrada en el origen)
// con una función de ruido; ideal para rocas, copas y montañas orgánicas.
export function displaceRadial(geo, fn, freq = 1, seedX = 0, seedZ = 0, seedY = 0) {
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    n.copy(v);
    if (n.lengthSq() < 1e-9) n.set(0, 1, 0);
    n.normalize();
    const d = fn(
      v.x * freq + seedX,
      v.z * freq + seedZ,
      v.y * freq + seedY,
      v.length()
    );
    pos.setXYZ(i, v.x + n.x * d, v.y + n.y * d, v.z + n.z * d);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// Normales suaves soldando por posición: promedia las normales de todas las
// caras que comparten un mismo vértice (incluso en geometría no indexada o con
// costuras de UV). Es lo que elimina el aspecto facetado de rocas, copas y
// colinas. No toca posiciones ni UVs.
export function weldSmoothNormals(geo) {
  const pos = geo.attributes.position;
  const count = pos.count;
  const idx = geo.index;
  const triCount = idx ? idx.count / 3 : count / 3;
  const keyOf = (i) =>
    pos.getX(i).toFixed(3) + '_' + pos.getY(i).toFixed(3) + '_' + pos.getZ(i).toFixed(3);
  const acc = new Map();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let t = 0; t < triCount; t++) {
    const i0 = idx ? idx.getX(t * 3) : t * 3;
    const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    a.fromBufferAttribute(pos, i0);
    b.fromBufferAttribute(pos, i1);
    c.fromBufferAttribute(pos, i2);
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    n.crossVectors(ab, ac);
    const verts = [i0, i1, i2];
    for (let v = 0; v < 3; v++) {
      const k = keyOf(verts[v]);
      let e = acc.get(k);
      if (!e) {
        e = [0, 0, 0];
        acc.set(k, e);
      }
      e[0] += n.x;
      e[1] += n.y;
      e[2] += n.z;
    }
  }
  const normals = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const e = acc.get(keyOf(i)) || [0, 1, 0];
    const len = Math.hypot(e[0], e[1], e[2]) || 1;
    normals[i * 3] = e[0] / len;
    normals[i * 3 + 1] = e[1] / len;
    normals[i * 3 + 2] = e[2] / len;
  }
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return geo;
}

// Mezcla las normales geométricas hacia una dirección esférica (la copa
// ilumina como una masa redonda y suave aunque tenga irregularidades).
export function sphericalNormals(geo, center, blend = 0.7) {
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const v = new THREE.Vector3();
  const r = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(nor, i);
    r.set(pos.getX(i) - center.x, pos.getY(i) - center.y, pos.getZ(i) - center.z);
    if (r.lengthSq() < 1e-8) continue;
    r.normalize();
    v.lerp(r, blend).normalize();
    nor.setXYZ(i, v.x, v.y, v.z);
  }
  nor.needsUpdate = true;
  return geo;
}

// Desplaza vértices con un campo arbitrario f(x,y,z)->[dx,dy,dz].
export function displaceVertices(geo, fn) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const [dx, dy, dz] = fn(x, y, z);
    pos.setXYZ(i, x + dx, y + dy, z + dz);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// Curva de TubeGeometry a partir de puntos; devuelve la geometría ya fusionable.
export function tubeFromPoints(points, radius, tubularSegments, radialSegments = 6) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
  return new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false);
}
