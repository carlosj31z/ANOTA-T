// BLOQUE 1 — CIRCUITOS. Vegetación orgánica procedural:
// árboles de copa (tronco curvo + nubes de hojas), pinos nevados, palmeras
// arqueadas, cactus redondeados, arbustos secos y matas de hierba con viento.
// Todo MeshStandardMaterial; geometría con normales suaves (contrato §9.2/§9.3).

import * as THREE from 'three';
import {
  mergeGeo,
  displaceRadial,
  tubeFromPoints,
  fbm2,
  mulberry32,
} from './procgen.js';
import { barkMaps } from './textures.js';

const _up = new THREE.Vector3(0, 1, 0);

// -------- Utilidades geométricas --------

// Cinta (hoja) a lo largo de una curva, con ancho variable; normales suaves.
function ribbonAlongCurve(points, segments, widthFn, droop = 0) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
  const positions = [];
  const norms = [];
  const uvs = [];
  const p = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const left = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    curve.getPointAt(u, p);
    curve.getTangentAt(u, tan);
    left.crossVectors(_up, tan);
    if (left.lengthSq() < 1e-6) left.set(1, 0, 0);
    left.normalize();
    nrm.crossVectors(tan, left).normalize();
    const w = widthFn(u);
    const droopY = droop * u * u;
    // dos vértices por sección (borde izq/der)
    positions.push(p.x + left.x * w, p.y - droopY, p.z + left.z * w);
    positions.push(p.x - left.x * w, p.y - droopY, p.z - left.z * w);
    norms.push(nrm.x, nrm.y, nrm.z, nrm.x, nrm.y, nrm.z);
    uvs.push(0, u, 1, u);
  }
  const idx = [];
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(norms, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  return g;
}

// Nube de hojas: varias icosaedros subdivididos desplazados con ruido.
function leafCloud(seed, blobs, radius) {
  const rnd = mulberry32(seed);
  const parts = [];
  for (let i = 0; i < blobs; i++) {
    const r = radius * (0.6 + rnd() * 0.6);
    const g = new THREE.IcosahedronGeometry(r, 1);
    const ang = rnd() * Math.PI * 2;
    const rad = rnd() * radius * 0.7;
    g.translate(
      Math.cos(ang) * rad,
      r * 0.5 + rnd() * radius * 0.6,
      Math.sin(ang) * rad
    );
    const ph = rnd() * 30;
    displaceRadial(g, (x, z, y) => (fbm2(x * 0.7 + ph, z * 0.7 + ph) - 0.5) * r * 0.7, 1, ph, ph, ph);
    parts.push(g);
  }
  return mergeGeo(parts);
}

// -------- Constructores --------

// Árbol de copa: tronco curvo con ramas + copa de nubes de hojas.
export function buildBroadleaf(seed, opts = {}) {
  const rnd = mulberry32(seed);
  const height = opts.height ?? 7 + rnd() * 3;
  const lean = (rnd() - 0.5) * 0.35;
  const trunkPts = [];
  const n = 5;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    trunkPts.push(
      new THREE.Vector3(
        lean * height * u * u + Math.sin(u * 3 + seed) * 0.15,
        height * 0.55 * u,
        Math.cos(u * 2.5 + seed) * 0.15
      )
    );
  }
  const trunk = tubeFromPoints(trunkPts, 0.24, 12, 6);
  const parts = [trunk];
  // ramas
  const nb = 2 + Math.floor(rnd() * 2);
  for (let i = 0; i < nb; i++) {
    const u = 0.45 + rnd() * 0.4;
    const base = new THREE.Vector3(
      lean * height * u * u,
      height * 0.55 * u,
      0
    );
    const ang = rnd() * Math.PI * 2;
    const len = height * (0.28 + rnd() * 0.2);
    parts.push(
      tubeFromPoints(
        [
          base,
          base.clone().add(new THREE.Vector3(Math.cos(ang) * len * 0.5, len * 0.5, Math.sin(ang) * len * 0.5)),
          base.clone().add(new THREE.Vector3(Math.cos(ang) * len, len * 0.9, Math.sin(ang) * len)),
        ],
        0.11,
        6,
        5
      )
    );
  }
  const trunkGeo = mergeGeo(parts);

  const foliage = leafCloud(seed + 101, 6, height * 0.42);
  foliage.translate(0, height * 0.6, 0);

  return { trunk: trunkGeo, foliage, height, radius: height * 0.42 };
}

// Pino nevado: tronco + capas cónicas de agujas + nieve acumulada.
export function buildPine(seed, opts = {}) {
  const rnd = mulberry32(seed);
  const height = opts.height ?? 7 + rnd() * 4;
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.28, height * 0.35, 6);
  trunkGeo.translate(0, height * 0.175, 0);

  const layers = 4;
  const needleParts = [];
  const snowParts = [];
  for (let i = 0; i < layers; i++) {
    const u = i / (layers - 1);
    const y = height * (0.22 + u * 0.68);
    const r = (opts.radius ?? 1.9) * (1 - u * 0.78);
    const hh = height * 0.32 * (1 - u * 0.4);
    const cone = new THREE.ConeGeometry(r, hh, 8);
    cone.translate(0, y + hh * 0.35, 0);
    displaceRadial(cone, (x, z) => (fbm2(x * 1.4 + seed, z * 1.4 + seed) - 0.5) * r * 0.5, 1, seed, seed, seed);
    needleParts.push(cone);
    // capa de nieve: cono bajo y achatado sobre la capa
    const snow = new THREE.ConeGeometry(r * 1.03, hh * 0.42, 8);
    snow.translate(0, y + hh * 0.62, 0);
    snowParts.push(snow);
  }
  return {
    trunk: trunkGeo,
    needles: mergeGeo(needleParts),
    snow: mergeGeo(snowParts),
    height,
    radius: opts.radius ?? 1.9,
  };
}

// Palmera: tronco curvo inclinado + hojas arqueadas.
export function buildPalm(seed, opts = {}) {
  const rnd = mulberry32(seed);
  const height = opts.height ?? 8 + rnd() * 3;
  const bend = 0.5 + rnd() * 0.5;
  const pts = [];
  const n = 6;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    pts.push(new THREE.Vector3(bend * height * u * u * 0.35, height * u, 0));
  }
  const trunk = tubeFromPoints(pts, 0.28, 14, 7);
  // base ancha
  const base = new THREE.CylinderGeometry(0.5, 0.62, 0.8, 8);
  base.translate(0, 0.4, 0);
  const trunkGeo = mergeGeo([trunk, base]);

  const top = pts[n];
  const fronds = [];
  const count = 8;
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2 + rnd() * 0.2;
    const len = height * (0.5 + rnd() * 0.25);
    const fpts = [];
    const steps = 4;
    for (let k = 0; k <= steps; k++) {
      const u = k / steps;
      const r = len * u;
      const drop = 1.1 * u * u * len * 0.5;
      fpts.push(
        new THREE.Vector3(
          top.x + Math.cos(ang) * r,
          top.y + 0.4 - drop,
          top.z + Math.sin(ang) * r
        )
      );
    }
    fronds.push(
      ribbonAlongCurve(fpts, 8, (u) => 0.55 * (1 - u * 0.85) + 0.05, 0.4)
    );
  }
  return { trunk: trunkGeo, fronds: mergeGeo(fronds), height };
}

// Cactus redondeado (saguaro): cuerpo Lathe + brazos tubulares.
export function buildCactus(seed, opts = {}) {
  const rnd = mulberry32(seed);
  const height = opts.height ?? 4.5 + rnd() * 2;
  const profile = [];
  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const r = 0.5 * Math.sin(u * Math.PI * 0.92 + 0.12) + 0.08;
    profile.push(new THREE.Vector2(Math.max(0.06, r), u * height));
  }
  const body = new THREE.LatheGeometry(profile, 12);
  const parts = [body];
  const arms = 1 + Math.floor(rnd() * 2);
  for (let i = 0; i < arms; i++) {
    const y = height * (0.45 + rnd() * 0.25);
    const side = rnd() < 0.5 ? 1 : -1;
    const ang = rnd() * Math.PI;
    const dx = Math.cos(ang) * side;
    const dz = Math.sin(ang);
    const elbow = new THREE.Vector3(dx * 0.9, y, dz * 0.9);
    const up = new THREE.Vector3(dx * 0.9, y + height * 0.3, dz * 0.9);
    parts.push(tubeFromPoints([new THREE.Vector3(dx * 0.35, y, dz * 0.35), elbow, up], 0.28, 8, 6));
  }
  return { body: mergeGeo(parts), height };
}

// Arbusto seco (desierto): ramitas splayed con pequeñas matas.
export function buildShrub(seed, opts = {}) {
  const rnd = mulberry32(seed);
  const h = opts.height ?? 1.2 + rnd() * 0.8;
  const parts = [];
  const twigs = 7 + Math.floor(rnd() * 5);
  for (let i = 0; i < twigs; i++) {
    const ang = rnd() * Math.PI * 2;
    const lean = 0.3 + rnd() * 0.6;
    const len = h * (0.7 + rnd() * 0.6);
    const pts = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(Math.cos(ang) * len * 0.2, len * 0.5, Math.sin(ang) * len * 0.2),
      new THREE.Vector3(Math.cos(ang) * len * lean, len, Math.sin(ang) * len * lean),
    ];
    parts.push(tubeFromPoints(pts, 0.035 + rnd() * 0.03, 5, 4));
    const clump = new THREE.IcosahedronGeometry(0.18 + rnd() * 0.12, 0);
    clump.translate(pts[2].x, pts[2].y, pts[2].z);
    parts.push(clump);
  }
  return { geo: mergeGeo(parts), height: h };
}

// Mata de hierba: varias briznas finas (gradiente raíz→punta por vertex colors).
export function buildGrassTuft(seed, opts = {}) {
  const rnd = mulberry32(seed);
  const h = opts.height ?? 0.55 + rnd() * 0.5;
  const blades = opts.blades ?? 5 + Math.floor(rnd() * 4);
  const positions = [];
  const colors = [];
  const rootC = new THREE.Color(opts.rootColor ?? 0x2f5a1e);
  const tipC = new THREE.Color(opts.tipColor ?? 0x9fd25a);
  const segs = 3;
  const pushVert = (x, y, z, t) => {
    positions.push(x, y, z);
    const c = rootC.clone().lerp(tipC, t);
    colors.push(c.r, c.g, c.b);
  };
  for (let b = 0; b < blades; b++) {
    const ang = rnd() * Math.PI * 2;
    const ox = (rnd() - 0.5) * 0.18;
    const oz = (rnd() - 0.5) * 0.18;
    const bh = h * (0.6 + rnd() * 0.6);
    const lean = 0.25 + rnd() * 0.5;
    const w0 = 0.035 + rnd() * 0.02;
    let px = ox;
    let pz = oz;
    let py = 0;
    for (let s = 0; s < segs; s++) {
      const t0 = s / segs;
      const t1 = (s + 1) / segs;
      const bend0 = t0 * t0 * lean * bh;
      const bend1 = t1 * t1 * lean * bh;
      const x0 = px + Math.cos(ang) * bend0;
      const z0 = pz + Math.sin(ang) * bend0;
      const y0 = py + bh * (t0);
      const x1 = px + Math.cos(ang) * bend1;
      const z1 = pz + Math.sin(ang) * bend1;
      const y1 = py + bh * t1;
      const w = w0 * (1 - t0 * 0.9);
      // perpendicular horizontal
      const lx = -Math.sin(ang) * w;
      const lz = Math.cos(ang) * w;
      pushVert(x0 + lx, y0, z0 + lz, t0);
      pushVert(x0 - lx, y0, z0 - lz, t0);
      pushVert(x1 + lx * 0.6, y1, z1 + lz * 0.6, t1);
      pushVert(x1 - lx * 0.6, y1, z1 - lz * 0.6, t1);
    }
  }
  const g = new THREE.BufferGeometry()
    .setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    .setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return { geo: g, height: h };
}

// -------- Dispersión e instancias --------

// Devuelve posiciones de mundo alrededor del circuito sin pisar la pista.
export function scatter(ctx, rnd, count, opts = {}) {
  const { centroid, isOnTrack, heightAt } = ctx;
  const { minR = 30, maxR = 340, clearance = 6, tries = 30, flatness = null } = opts;
  const out = [];
  let guard = 0;
  const maxGuard = count * tries + count;
  while (out.length < count && guard < maxGuard) {
    guard++;
    const a = rnd() * Math.PI * 2;
    const r = minR + Math.pow(rnd(), 0.85) * (maxR - minR);
    const x = centroid.x + Math.cos(a) * r;
    const z = centroid.z + Math.sin(a) * r;
    if (isOnTrack(x, z, clearance)) continue;
    const y = heightAt(x, z);
    if (flatness) {
      const y2 = heightAt(x + 3, z);
      const y3 = heightAt(x, z + 3);
      const slope = Math.abs(y2 - y) + Math.abs(y3 - y);
      if (slope > flatness) continue;
    }
    out.push({ x, y, z, a: rnd() * Math.PI * 2, s: 0.75 + rnd() * 0.6 });
  }
  return out;
}

const _dummy = new THREE.Object3D();
const _col = new THREE.Color();

// Rellena un InstancedMesh a partir de una lista de colocaciones.
export function instantiate(geo, material, list, opts = {}) {
  const mesh = new THREE.InstancedMesh(geo, material, Math.max(1, list.length));
  mesh.castShadow = opts.castShadow !== false;
  mesh.receiveShadow = !!opts.receiveShadow;
  const colors = opts.colors;
  const sMin = opts.scaleMin ?? 1;
  const sMax = opts.scaleMax ?? 1;
  const yScaleVar = opts.yScaleVar ?? 0.15;
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    _dummy.position.set(p.x, p.y + (opts.yOffset || 0), p.z);
    _dummy.rotation.set(0, p.a, 0);
    const sc = (p.s ?? 1) * (sMin + (p.r ?? Math.random()) * (sMax - sMin));
    _dummy.scale.set(sc, sc * (1 + (p.yr ?? 0) * yScaleVar), sc);
    _dummy.updateMatrix();
    mesh.setMatrixAt(i, _dummy.matrix);
    if (colors) mesh.setColorAt(i, _col.set(colors(p, i)));
  }
  mesh.count = list.length;
  mesh.instanceMatrix.needsUpdate = true;
  if (colors && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

// Dispersión a lo largo del borde de la pista (hierba tupida junto al asfalto).
export function scatterTrackSide(ctx, rnd, count, opts = {}) {
  const { samples, half } = ctx;
  const { latMin = half + 1.2, latMax = half + 14, side = 0 } = opts;
  const out = [];
  const n = samples.length;
  for (let i = 0; i < count; i++) {
    const s = samples[Math.floor(rnd() * n)];
    const sign = side !== 0 ? side : rnd() < 0.5 ? 1 : -1;
    const lat = (latMin + rnd() * (latMax - latMin)) * sign;
    out.push({
      x: s.pos.x + s.left.x * lat,
      y: s.pos.y - 0.15,
      z: s.pos.z + s.left.z * lat,
      a: rnd() * Math.PI * 2,
      s: 0.7 + rnd() * 0.7,
    });
  }
  return out;
}

// Material de corteza reutilizable (cacheado por módulo).
let _barkCache = null;
export function barkMaterial() {
  if (!_barkCache) {
    const maps = barkMaps(256, 2);
    _barkCache = new THREE.MeshStandardMaterial({
      map: maps.map,
      normalMap: maps.normalMap,
      roughness: 0.9,
      metalness: 0.0,
    });
  }
  return _barkCache;
}
