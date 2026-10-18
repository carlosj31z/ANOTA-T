// BLOQUE 1 — CIRCUITOS. Rocas orgánicas y cordilleras lejanas.
// Icosaedros subdivididos + desplazamiento fBm con normales suaves; montañas
// con nieve en cumbres por altura (vertex colors) y neblina (FogExp2).

import * as THREE from 'three';
import { displaceRadial, fbm2, mulberry32 } from './procgen.js';
import { terrainNormal } from './textures.js';

// Roca: esfera icosaédrica subdividida, deformada con fBm.
export function buildRock(seed, opts = {}) {
  const rnd = mulberry32(seed);
  const detail = opts.detail ?? 2;
  const g = new THREE.IcosahedronGeometry(1, detail);
  const ph = rnd() * 40;
  displaceRadial(
    g,
    (x, z, y) => {
      const n = fbm2(x * 1.1 + ph, z * 1.1 + ph, 4) - 0.5;
      const n2 = fbm2(x * 3.3 + ph, y * 3.3 + ph, 3) - 0.5;
      return n * 0.55 + n2 * 0.18;
    },
    1,
    ph,
    ph,
    ph
  );
  g.scale(1, opts.flatten ?? 0.75, 1);
  return g;
}

let _rockMat = null;
export function rockMaterial(color = 0xffffff) {
  if (!_rockMat) {
    _rockMat = new THREE.MeshStandardMaterial({
      color,
      normalMap: terrainNormal('rock', 256, 12),
      normalScale: new THREE.Vector2(1.1, 1.1),
      roughness: 0.95,
      metalness: 0.0,
      vertexColors: false,
    });
  }
  return _rockMat;
}

// Montaña individual: cono deformado con vertex colors (roca abajo, nieve arriba).
// Se instancia para formar cordilleras lejanas.
export function buildMountainCone(seed, opts = {}) {
  const rnd = mulberry32(seed);
  const rockBottom = new THREE.Color(opts.rock ?? 0x6f7a86);
  const rockTop = new THREE.Color(opts.rockTop ?? 0x8a95a2);
  const snow = new THREE.Color(opts.snow ?? 0xf6fbff);
  const snowLine = opts.snowLine ?? 0.5;
  const g = new THREE.ConeGeometry(1, 1, 7, 5);
  const ph = rnd() * 50;
  displaceRadial(
    g,
    (x, z) => (fbm2(x * 2.1 + ph, z * 2.1 + ph, 3) - 0.5) * 0.4,
    1,
    ph,
    ph,
    ph
  );
  const pos = g.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let v = 0; v < pos.count; v++) {
    const ny = pos.getY(v) + 0.5; // 0..1
    const n = fbm2(pos.getX(v) * 4 + ph, pos.getZ(v) * 4 + ph, 3);
    const line = snowLine + (n - 0.5) * 0.2;
    const c = ny > line ? snow : rockBottom.clone().lerp(rockTop, ny);
    colors[v * 3] = c.r;
    colors[v * 3 + 1] = c.g;
    colors[v * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return g;
}

export function mountainMaterial() {
  return new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
    metalness: 0.0,
  });
}
