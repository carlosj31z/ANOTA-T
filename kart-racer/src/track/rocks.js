// BLOQUE 1 — CIRCUITOS. Rocas orgánicas y cordilleras lejanas.
// Icosaedros subdivididos + desplazamiento fBm con normales suaves; montañas
// con nieve en cumbres por altura (vertex colors) y neblina (FogExp2).

import * as THREE from 'three';
import {
  displaceRadial,
  fbm2,
  mulberry32,
  smoothstep,
  weldSmoothNormals,
} from './procgen.js';
import { terrainNormal } from './textures.js';

// Roca: esfera icosaédrica subdividida (< detail >= 3), deformada con fBm y
// normales suaves soldadas (sin facetas).
export function buildRock(seed, opts = {}) {
  const rnd = mulberry32(seed);
  const detail = opts.detail ?? 3;
  const g = new THREE.IcosahedronGeometry(1, detail);
  const ph = rnd() * 40;
  displaceRadial(
    g,
    (x, z, y) => {
      const n = fbm2(x * 1.1 + ph, z * 1.1 + ph, 5) - 0.5;
      const n2 = fbm2(x * 3.1 + ph, y * 3.1 + ph, 4) - 0.5;
      const n3 = fbm2(x * 6.5 + ph, z * 6.5 + ph, 3) - 0.5;
      return n * 0.5 + n2 * 0.2 + n3 * 0.07;
    },
    1,
    ph,
    ph,
    ph
  );
  g.scale(1, opts.flatten ?? 0.75, 1);
  weldSmoothNormals(g);
  return g;
}

let _rockMat = null;
export function rockMaterial(color = 0xffffff) {
  if (!_rockMat) {
    _rockMat = new THREE.MeshStandardMaterial({
      color,
      normalMap: terrainNormal('rock', 256, 12),
      normalScale: new THREE.Vector2(0.9, 0.9),
      roughness: 0.95,
      metalness: 0.0,
      vertexColors: false,
    });
  }
  return _rockMat;
}

// Montaña individual: cono de alta resolución deformado con fBm. Nieve por
// altura Y pendiente con transición suave; roca con variación. Se instancia
// para formar cordilleras lejanas.
export function buildMountainCone(seed, opts = {}) {
  const rnd = mulberry32(seed);
  const rockBottom = new THREE.Color(opts.rock ?? 0x6f7a86);
  const rockTop = new THREE.Color(opts.rockTop ?? 0x8a95a2);
  const snow = new THREE.Color(opts.snow ?? 0xf6fbff);
  const snowLine = opts.snowLine ?? 0.5;
  const seg = opts.seg ?? 128;
  const g = new THREE.ConeGeometry(1, 1, seg, 32);
  const ph = rnd() * 50;
  displaceRadial(
    g,
    (x, z, y) =>
      (fbm2(x * 1.7 + ph, z * 1.7 + ph, 4) - 0.5) * 0.34 +
      (fbm2(x * 4.6 + ph, z * 4.6 + ph, 3) - 0.5) * 0.12 +
      (fbm2(x * 11 + ph, y * 11 + ph, 2) - 0.5) * 0.04,
    1,
    ph,
    ph,
    ph
  );
  weldSmoothNormals(g);
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  const rc = new THREE.Color();
  for (let v = 0; v < pos.count; v++) {
    const ny = Math.min(1, Math.max(0, pos.getY(v) + 0.5)); // 0..1
    const slope = Math.min(1, Math.max(0, nor.getY(v))); // 1 = llano
    const n = fbm2(pos.getX(v) * 3.2 + ph, pos.getZ(v) * 3.2 + ph, 4);
    const line = snowLine + (n - 0.5) * 0.34;
    // nieve: alta y sobre superficies no verticales; roca en paredes.
    const byH = smoothstep(line - 0.16, line + 0.16, ny);
    const bySlope = smoothstep(0.5, 0.78, slope + (n - 0.5) * 0.3);
    const snowMask = byH * bySlope;
    // micro-variación de roca por altura y ruido
    rc.copy(rockBottom).lerp(rockTop, Math.min(1, ny + (n - 0.5) * 0.25));
    rc.multiplyScalar(0.92 + n * 0.16);
    colors[v * 3] = rc.r * (1 - snowMask) + snow.r * snowMask;
    colors[v * 3 + 1] = rc.g * (1 - snowMask) + snow.g * snowMask;
    colors[v * 3 + 2] = rc.b * (1 - snowMask) + snow.b * snowMask;
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return g;
}

export function mountainMaterial() {
  return new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.0,
    normalMap: terrainNormal('rock', 256, 5),
    normalScale: new THREE.Vector2(0.6, 0.6),
    envMapIntensity: 0.6,
  });
}
