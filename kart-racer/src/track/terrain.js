// BLOQUE 1 — CIRCUITOS. Terreno de fondo: malla con desplazamiento fBm que se
// aplana junto a la pista, coloreada por vértices (2–3 materiales por bioma) y
// con normal map de detalle repetido. Contrato §9.2 (PBR procedural).

import * as THREE from 'three';
import { fbm2, smoothstep, clamp01, displaceRadial, mergeGeo } from './procgen.js';
import { terrainNormal, canvasTex, mulberry32 } from './textures.js';

// Grano neutro de detalle para modular el color del terreno (multiplica).
function detailGrainTex(seed) {
  const rnd = mulberry32(seed);
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#c9c9c9';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 5000; i++) {
      const v = 150 + Math.floor(rnd() * 106);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2);
    }
  }, { repeat: true });
}

export function buildTerrain(ctx, theme) {
  const { nearestSampleXZ, centroid, isOnTrack } = ctx;
  const t = theme.terrain || {};
  const size = t.size ?? 4600;
  const seg = t.seg ?? 156;
  const amp = t.amp ?? 14;
  const fineAmp = t.fineAmp ?? amp * 0.18;
  const flattenIn = t.flattenIn ?? 30;
  const flattenOut = t.flattenOut ?? 170;
  const baseDrop = t.baseDrop ?? 0.5;

  // Altura coherente con la pista (se aplana suavemente al acercarse).
  function heightAt(x, z) {
    const ns = nearestSampleXZ(x, z);
    const base = ns.y - baseDrop;
    const n1 = fbm2(x * 0.0032 + 11, z * 0.0032 + 7);
    const n2 = fbm2(x * 0.018 + 3, z * 0.018 + 5);
    const far = (n1 - 0.5) * 2 * amp + (n2 - 0.5) * 2 * fineAmp;
    const blend = smoothstep(flattenIn, flattenOut, ns.d);
    return base * (1 - blend) + (base + far) * blend;
  }

  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  geo.translate(centroid.x, 0, centroid.z);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const colors = new Float32Array(pos.count * 3);
  const tile = t.detailRepeat ?? 90;
  const useVC = typeof t.color === 'function';
  const c = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const ns = nearestSampleXZ(x, z);
    const base = ns.y - baseDrop;
    const n1 = fbm2(x * 0.0032 + 11, z * 0.0032 + 7);
    const n2 = fbm2(x * 0.018 + 3, z * 0.018 + 5);
    const far = (n1 - 0.5) * 2 * amp + (n2 - 0.5) * 2 * fineAmp;
    const blend = smoothstep(flattenIn, flattenOut, ns.d);
    const h = base * (1 - blend) + (base + far) * blend;
    pos.setY(i, h);
    uv.setXY(i, x / tile, z / tile);
    if (useVC) {
      t.color(x, z, h, h - base, c);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
  }
  pos.needsUpdate = true;
  uv.needsUpdate = true;
  geo.computeVertexNormals();
  if (useVC) geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  const normalMap = terrainNormal(t.detailNormal || 'grass', 256, theme.seed + 9);
  const grain = detailGrainTex(theme.seed + 31);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: grain,
    normalMap,
    normalScale: new THREE.Vector2(t.normalScale ?? 0.7, t.normalScale ?? 0.7),
    roughness: t.roughness ?? 0.92,
    metalness: 0.0,
    vertexColors: useVC,
    envMapIntensity: t.envIntensity ?? 0.7,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';

  return { mesh, heightAt, material: mat };
}

// Colinas lejanas: anillo de domos deformados con vertex colors (verde→pálido)
// que rompen el horizonte plano. Una sola malla fusionada = 1 draw call.
export function buildDistantHills(ctx, opts = {}) {
  const { rnd, centroid } = ctx;
  const count = opts.count ?? 22;
  const colorBase = new THREE.Color(opts.colorBase ?? 0x4f8f3e);
  const colorTop = new THREE.Color(opts.colorTop ?? 0x7fae63);
  const dryColor = new THREE.Color(opts.dryColor ?? 0x9aa86a);
  const parts = [];
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + (rnd() - 0.5) * 0.45;
    const r = (opts.minR ?? 640) + rnd() * ((opts.maxR ?? 1350) - (opts.minR ?? 640));
    const w = (opts.minW ?? 170) + rnd() * ((opts.maxW ?? 430) - (opts.minW ?? 170));
    const h = w * ((opts.minHFactor ?? 0.18) + rnd() * ((opts.maxHFactor ?? 0.36) - (opts.minHFactor ?? 0.18)));
    const g = new THREE.IcosahedronGeometry(1, 2);
    const ph = i * 7 + Math.floor(rnd() * 50);
    displaceRadial(
      g,
      (x, z, y) => (fbm2(x * 2.3 + ph, z * 2.3 + ph, 3) - 0.5) * 0.4 +
        (fbm2(x * 6 + ph, y * 6 + ph, 2) - 0.5) * 0.12,
      1,
      ph,
      ph,
      ph
    );
    g.scale(w, h, w);
    const baseY = h * 0.2;
    const cx = centroid.x + Math.cos(a) * r;
    const cz = centroid.z + Math.sin(a) * r;
    g.translate(cx, baseY, cz);
    const pos = g.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    for (let v = 0; v < pos.count; v++) {
      const t = Math.min(1, Math.max(0, (pos.getY(v) - (baseY - h)) / (2 * h)));
      const n = fbm2(pos.getX(v) * 0.012 + i, pos.getZ(v) * 0.012 + i);
      c.copy(colorBase).lerp(colorTop, t);
      c.lerp(dryColor, Math.min(0.55, n * 0.55));
      colors[v * 3] = c.r;
      colors[v * 3 + 1] = c.g;
      colors[v * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    parts.push(g);
  }
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    metalness: 0.0,
    flatShading: false,
    envMapIntensity: 0.6,
  });
  const mesh = new THREE.Mesh(mergeGeo(parts), mat);
  mesh.name = 'distant-hills';
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return { mesh, material: mat };
}
