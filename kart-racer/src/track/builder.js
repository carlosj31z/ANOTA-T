// BLOQUE 1 — Circuitos. Constructores de mallas (BufferGeometry) a partir de muestras.
// Todo procedural; nada de assets externos.

import * as THREE from 'three';

// Acumulador simple de geometría indexada (posición + uv). Normales al final.
export class MeshBuilder {
  constructor() {
    this.p = [];
    this.uv = [];
    this.idx = [];
  }
  vert(x, y, z, u, v) {
    const i = this.p.length / 3;
    this.p.push(x, y, z);
    this.uv.push(u, v);
    return i;
  }
  quad(a, b, c, d) {
    this.idx.push(a, b, c, a, c, d);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    g.computeVertexNormals();
    return g;
  }
}

export function horizDist(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

// Tira (ribbon) siguiendo las muestras entre dos desplazamientos laterales.
// Si close=true, une la última muestra con la primera (circuito cerrado).
export function addRibbon(builder, samples, opts) {
  const {
    start = 0,
    count = samples.length,
    latA,
    latB,
    yA = 0,
    yB = 0,
    yBetween = 0,
    vScale = 8,
    uTile = 0,
    close = false,
  } = opts;

  const n = count;
  const verts = [];
  let dist = 0;
  for (let k = 0; k < n; k++) {
    const s = samples[(start + k) % samples.length];
    const next = samples[(start + k + 1) % samples.length];
    let ybA = yA;
    let ybB = yB;
    if (Math.abs(yBetween) > 1e-6) {
      // Eleva el centro (arcén abombado) según cercanía al centro.
      const tA = Math.abs(latA);
      const tB = Math.abs(latB);
      const mid = (tA + tB) * 0.5;
      ybA += yBetween * (mid - tA) / Math.max(1e-3, mid + 1e-3);
      ybB += yBetween * (mid - tB) / Math.max(1e-3, mid + 1e-3);
    }
    const ax = s.pos.x + s.left.x * latA;
    const az = s.pos.z + s.left.z * latA;
    const bx = s.pos.x + s.left.x * latB;
    const bz = s.pos.z + s.left.z * latB;
    const v = dist / vScale;
    const uA = uTile ? dist / uTile : 0;
    const uB = uTile ? dist / uTile : 1;
    const ia = builder.vert(ax, s.pos.y + ybA, az, uA, v);
    const ib = builder.vert(bx, s.pos.y + ybB, bz, uB, v);
    verts.push([ia, ib]);
    if (k < n) dist += horizDist(s.pos, next.pos);
  }

  const last = close ? n : n - 1;
  for (let k = 0; k < last; k++) {
    const a = verts[k];
    const b = verts[(k + 1) % n];
    builder.quad(a[0], b[0], b[1], a[1]);
  }
}

// Muro vertical siguiendo las muestras a un desplazamiento lateral dado.
export function addWall(builder, samples, opts) {
  const {
    start = 0,
    count = samples.length,
    lat,
    yBottom = -1.5,
    yTop = 1.4,
    vScale = 6,
    close = false,
  } = opts;
  const n = count;
  const verts = [];
  let dist = 0;
  for (let k = 0; k < n; k++) {
    const s = samples[(start + k) % samples.length];
    const next = samples[(start + k + 1) % samples.length];
    const x = s.pos.x + s.left.x * lat;
    const z = s.pos.z + s.left.z * lat;
    const v = dist / vScale;
    const ib = builder.vert(x, s.pos.y + yBottom, z, 0, v);
    const it = builder.vert(x, s.pos.y + yTop, z, 1, v);
    verts.push([ib, it]);
    if (k < n) dist += horizDist(s.pos, next.pos);
  }
  const last = close ? n : n - 1;
  for (let k = 0; k < last; k++) {
    const a = verts[k];
    const b = verts[(k + 1) % n];
    builder.quad(a[0], b[0], b[1], a[1]);
  }
}

// Línea discontinua central.
export function addDashes(builder, samples, opts) {
  const {
    lat = 0,
    halfW = 0.16,
    dashLen = 3,
    gapLen = 6,
    yLift = 0.03,
    vScale = 6,
  } = opts;
  const length = samples.length;
  // Recorremos por distancia aproximada.
  let acc = 0;
  const period = dashLen + gapLen;
  for (let i = 0; i < length; i++) {
    const s = samples[i];
    const nx = samples[(i + 1) % length];
    const seg = horizDist(s.pos, nx.pos);
    // Insertamos un quad si el tramo cae dentro de un dash.
    const posInPeriod = acc % period;
    if (posInPeriod < dashLen && seg > 1e-4) {
      const l = s.left;
      const a0 = builder.vert(
        s.pos.x + l.x * (lat - halfW), s.pos.y + yLift, s.pos.z + l.z * (lat - halfW), 0, 0
      );
      const a1 = builder.vert(
        s.pos.x + l.x * (lat + halfW), s.pos.y + yLift, s.pos.z + l.z * (lat + halfW), 1, 0
      );
      const b0 = builder.vert(
        nx.pos.x + nx.left.x * (lat - halfW), nx.pos.y + yLift, nx.pos.z + nx.left.z * (lat - halfW), 0, 1
      );
      const b1 = builder.vert(
        nx.pos.x + nx.left.x * (lat + halfW), nx.pos.y + yLift, nx.pos.z + nx.left.z * (lat + halfW), 1, 1
      );
      builder.quad(a0, b0, b1, a1);
    }
    acc += seg;
  }
  return period;
}

// Cuadrilátero orientado en el plano XZ en una posición/rumbo dados.
export function addGroundQuad(builder, cx, cy, cz, heading, width, length, yLift = 0.03) {
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const lx = fz;
  const lz = -fx;
  const hw = width / 2;
  const hl = length / 2;
  const y = cy + yLift;
  const p = (df, dl) =>
    builder.vert(cx + fx * df + lx * dl, y, cz + fz * df + lz * dl, (dl + hw) / width, (df + hl) / length);
  const a = p(-hl, -hw);
  const b = p(hl, -hw);
  const c = p(hl, hw);
  const d = p(-hl, hw);
  builder.quad(a, b, c, d);
}

// --- Utilidades de escena ---

export function makeInstanced(geo, mat, count, castShadow = true, receiveShadow = false) {
  const m = new THREE.InstancedMesh(geo, mat, count);
  m.castShadow = castShadow;
  m.receiveShadow = receiveShadow;
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  return m;
}

export function scatterPositions(rnd, count, opts) {
  const { minR, maxR, isOnTrack, tries = 40 } = opts;
  const out = [];
  let guard = 0;
  while (out.length < count && guard < count * tries) {
    guard++;
    const a = rnd() * Math.PI * 2;
    const r = minR + rnd() * (maxR - minR);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (isOnTrack && isOnTrack(x, z)) continue;
    out.push({ x, z, a: rnd() * Math.PI * 2, s: 0.7 + rnd() * 0.8 });
  }
  return out;
}

export function disposeObject(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        for (const k of Object.keys(m)) {
          const v = m[k];
          if (v && v.isTexture) v.dispose();
        }
        m.dispose();
      }
    }
  });
}
