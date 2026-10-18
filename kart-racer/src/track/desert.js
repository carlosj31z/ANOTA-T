// BLOQUE 1 — Circuito "Dunas Doradas": tarde dorada, dunas, cactus redondeados,
// rocas, mesas, arcos, pirámide lejana, oasis con agua y polvo en el aire.

import * as THREE from 'three';
import { mergeGeo, fbm2, smoothstep, displaceRadial, weldSmoothNormals } from './procgen.js';
import { buildCactus, buildShrub, buildPalm, scatter, instantiate } from './vegetation.js';
import { buildRock, rockMaterial } from './rocks.js';
import { createWaterMaterial } from './water.js';
import { terrainNormal } from './textures.js';
import { buildDust, buildTracksideFlags } from './props.js';
import { setWindTime } from './materials.js';

export const DESERT_AMBIENT = {
  seed: 9021,
  background: 0xf0b46a,
  fogColor: 0xf1c37e,
  fogDensity: 0.00075,
  sky: {
    elevation: 12,
    azimuth: 100,
    turbidity: 4.5,
    rayleigh: 1.0,
    mieCoefficient: 0.009,
    mieDirectionalG: 0.86,
    sun: { color: 0xffd9a0, intensity: 3.2 },
    hemi: { sky: 0xffe0b0, ground: 0xa9764b, intensity: 0.6 },
    sunVisual: '#ffcf87',
    sunVisualSize: 40,
    sunVisualOpacity: 0.85,
    shadowRadius: 150,
  },
  terrain: {
    detailNormal: 'sand',
    detailRepeat: 46,
    amp: 18,
    fineAmp: 2.2,
    flattenIn: 28,
    flattenOut: 160,
    roughness: 0.98,
    normalScale: 0.5,
    color: (x, z, h, rel, c) => {
      const n = fbm2(x * 0.02 + 5, z * 0.02 + 2);
      const rock = smoothstep(0.62, 0.85, fbm2(x * 0.008 + 30, z * 0.008 + 12));
      const dark = smoothstep(0.4, 0.75, n);
      let r = 0.85 - dark * 0.08;
      let g = 0.7 - dark * 0.06;
      let b = 0.42 - dark * 0.04;
      c.setRGB(
        r * (1 - rock) + 0.6 * rock,
        g * (1 - rock) + 0.42 * rock,
        b * (1 - rock) + 0.3 * rock
      );
    },
  },
};

export function buildDesert(ctx) {
  const { rnd, samples, half, heightAt, centroid, sampleSpacing } = ctx;
  const group = new THREE.Group();
  group.name = 'desert-props';
  const updaters = [];
  const rockTones = [0xb98a5a, 0xa8764a, 0xc99c6a, 0x8f6a45, 0xcaa06f];

  // -------------------- Cactus redondeados --------------------
  const cactusMat = new THREE.MeshStandardMaterial({ color: 0x3f8f4f, roughness: 0.85, metalness: 0.0 });
  const cactusSpecs = [buildCactus(3, { height: 5 }), buildCactus(17, { height: 3.6 })];
  const cactusPos = scatter(ctx, rnd, 80, { minR: 30, maxR: 320, clearance: 7, flatness: 6 });
  for (let v = 0; v < cactusSpecs.length; v++) {
    const list = cactusPos.filter((_, i) => i % cactusSpecs.length === v);
    if (!list.length) continue;
    group.add(
      instantiate(cactusSpecs[v].body, cactusMat, list, { scaleMin: 0.7, scaleMax: 1.4, yScaleVar: 0.25 })
    );
  }

  // -------------------- Rocas --------------------
  const rockMat = rockMaterial();
  const rockSpecs = [buildRock(5, { detail: 3 }), buildRock(23, { detail: 3 })];
  const rockPos = scatter(ctx, rnd, 140, { minR: 24, maxR: 380, clearance: 5 });
  for (let v = 0; v < rockSpecs.length; v++) {
    const list = rockPos.filter((_, i) => i % rockSpecs.length === v);
    if (!list.length) continue;
    group.add(
      instantiate(rockSpecs[v], rockMat, list, {
        scaleMin: 0.8,
        scaleMax: 4.2,
        yScaleVar: 0.5,
        receiveShadow: true,
        colors: () => rockTones[Math.floor(rnd() * rockTones.length)],
      })
    );
  }

  // -------------------- Mesas lejanas --------------------
  // Paredes erosionadas con estratos (colores por vértice), repisas suaves y
  // surcos verticales; normales suaves (nada de cilindros lisos).
  const mesaParts = [];
  const strata = [0xb9784a, 0xc98b58, 0xa5643d, 0xd29a66, 0x9a5a38].map((h) => new THREE.Color(h));
  const mc = new THREE.Color();
  for (let i = 0; i < 5; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 280 + rnd() * 340;
    const rb = 16 + rnd() * 18;
    const hgt = 22 + rnd() * 24;
    const topR = rb * (0.5 + rnd() * 0.3);
    const g = new THREE.CylinderGeometry(topR, rb, hgt, 48, 28);
    const pos = g.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const ph = i * 11.3;
    for (let v = 0; v < pos.count; v++) {
      const x = pos.getX(v);
      const y = pos.getY(v);
      const z = pos.getZ(v);
      const t = y / hgt + 0.5; // 0 base .. 1 tope
      const ang = Math.atan2(z, x);
      const rr = Math.hypot(x, z);
      // repisas: pequeñas variaciones de radio con el nivel del estrato
      const level = t * 6 + fbm2(Math.cos(ang) * 1.3 + ph, Math.sin(ang) * 1.3 + ph, 2) * 1.6;
      const ledge = smoothstep(0.55, 0.95, level - Math.floor(level));
      const gully = (fbm2(Math.cos(ang) * 3.5 + ph, Math.sin(ang) * 3.5 + t * 1.4 + ph, 4) - 0.5) * 0.16;
      const slump = 1 + (1 - t) * 0.14 * smoothstep(0.35, 0, t); // faldón inferior
      const k = (1 + ledge * 0.05 + gully) * slump;
      const rim = t > 0.985 ? 0.96 : 1; // bisel del borde superior
      if (rr > 1e-4) {
        pos.setX(v, x * k * rim);
        pos.setZ(v, z * k * rim);
      }
      pos.setY(v, y + (fbm2(x * 0.05 + ph, z * 0.05, 3) - 0.5) * 1.4 * (t > 0.9 ? 1 : 0.3));
      const band = Math.floor(level);
      mc.copy(strata[((band % strata.length) + strata.length) % strata.length]);
      mc.lerp(strata[(((band + 1) % strata.length) + strata.length) % strata.length], ledge * 0.7);
      mc.multiplyScalar(0.84 + fbm2(x * 0.12 + ph, y * 0.4 + z * 0.12, 3) * 0.3 + (1 - Math.min(1, gully * 6 + 0.5)) * 0.08);
      colors[v * 3] = mc.r;
      colors[v * 3 + 1] = mc.g;
      colors[v * 3 + 2] = mc.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    weldSmoothNormals(g);
    g.rotateY(rnd() * Math.PI);
    g.translate(
      centroid.x + Math.cos(a) * r,
      heightAt(centroid.x + Math.cos(a) * r, centroid.z + Math.sin(a) * r) + hgt * 0.35,
      centroid.z + Math.sin(a) * r
    );
    mesaParts.push(g);
  }
  const mesas = new THREE.Mesh(
    mergeGeo(mesaParts),
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      metalness: 0.0,
      normalMap: terrainNormal('rock', 256, 17),
      normalScale: new THREE.Vector2(0.7, 0.7),
    })
  );
  mesas.castShadow = true;
  group.add(mesas);

  // -------------------- Arcos --------------------
  const archParts = [];
  for (let i = 0; i < 3; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 210 + rnd() * 200;
    const ph = 5 + i * 9;
    const g = new THREE.TorusGeometry(6 + rnd() * 3, 1.9, 20, 48, Math.PI);
    // grosor irregular tipo roca erosionada, normales suaves
    displaceRadial(
      g,
      (x, z, y) =>
        (fbm2(x * 0.35 + ph, y * 0.35 + ph, 4) - 0.5) * 1.5 +
        (fbm2(x * 1.1 + ph, z * 1.1 + ph, 3) - 0.5) * 0.45,
      1,
      ph,
      ph,
      ph
    );
    weldSmoothNormals(g);
    g.rotateY(rnd() * Math.PI);
    const ax = centroid.x + Math.cos(a) * r;
    const az = centroid.z + Math.sin(a) * r;
    g.translate(ax, heightAt(ax, az) - 0.9, az);
    archParts.push(g);
  }
  const arches = new THREE.Mesh(
    mergeGeo(archParts),
    new THREE.MeshStandardMaterial({
      color: 0xb4804f,
      roughness: 0.95,
      metalness: 0.0,
      normalMap: terrainNormal('rock', 256, 12),
      normalScale: new THREE.Vector2(0.8, 0.8),
    })
  );
  arches.castShadow = true;
  group.add(arches);

  // -------------------- Pirámide escalonada lejana --------------------
  const pyr = new THREE.Group();
  const pyrMat = new THREE.MeshStandardMaterial({ color: 0xd8b26a, roughness: 0.9, metalness: 0.0, flatShading: true });
  const pyrParts = [];
  for (let i = 0; i < 6; i++) {
    const w = 34 - i * 5;
    const box = new THREE.BoxGeometry(w, 3.2, w);
    box.translate(0, 1.6 + i * 3.2, 0);
    box.rotateY(i * 0.06);
    pyrParts.push(box);
  }
  const pyrMesh = new THREE.Mesh(mergeGeo(pyrParts), pyrMat);
  pyrMesh.castShadow = true;
  pyr.add(pyrMesh);
  const pyrA = 2.3;
  pyr.position.set(centroid.x + Math.cos(pyrA) * 430, heightAt(centroid.x + Math.cos(pyrA) * 430, centroid.z + Math.sin(pyrA) * 430), centroid.z + Math.sin(pyrA) * 430);
  pyr.rotation.y = pyrA;
  group.add(pyr);

  // -------------------- Arbustos secos --------------------
  const shrubMat = new THREE.MeshStandardMaterial({ color: 0x9a8548, roughness: 0.95, metalness: 0.0 });
  const shrubSpecs = [buildShrub(19, { height: 1.5 })];
  const shrubPos = scatter(ctx, rnd, 200, { minR: 20, maxR: 340, clearance: 4 });
  for (let v = 0; v < shrubSpecs.length; v++) {
    const list = shrubPos.filter((_, i) => i % shrubSpecs.length === v);
    if (!list.length) continue;
    group.add(
      instantiate(shrubSpecs[v].geo, shrubMat, list, { castShadow: false, scaleMin: 0.7, scaleMax: 1.6 })
    );
  }

  // -------------------- Oasis: agua + palmeras --------------------
  const oasisA = rnd() * Math.PI * 2;
  const oasisR = 150 + rnd() * 60;
  const ox = centroid.x + Math.cos(oasisA) * oasisR;
  const oz = centroid.z + Math.sin(oasisA) * oasisR;
  const oy = heightAt(ox, oz);
  const water = createWaterMaterial({
    seed: 7,
    deep: 0x0f4f6e,
    shallow: 0x35a2c8,
    sky: 0xffe6bb,
    sunColor: 0xfff0c8,
    fogColor: 0xf1c37e,
    fogDensity: 0.00075,
    opacity: 0.88,
    normalScale: 0.25,
    flow: 0.035,
  });
  const pond = new THREE.Mesh(new THREE.CircleGeometry(16, 40), water.material);
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(ox, oy + 0.12, oz);
  group.add(pond);
  const ringGeo = new THREE.RingGeometry(16, 25, 40);
  ringGeo.rotateX(-Math.PI / 2);
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshStandardMaterial({ color: 0xe8cf93, roughness: 1.0 }));
  ring.position.set(ox, oy + 0.1, oz);
  ring.receiveShadow = true;
  group.add(ring);
  updaters.push(water.update);

  // Palmera completa (tronco + hojas) = una malla con vertex colors por variante.
  const palmMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
  const tintGeo = (g, fn) => {
    const g2 = g.index ? g.toNonIndexed() : g;
    const p = g2.attributes.position;
    const arr = new Float32Array(p.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      fn(c, p.getX(i), p.getY(i), p.getZ(i));
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    g2.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return g2;
  };
  const palmSpecs = [buildPalm(2, { height: 8 }), buildPalm(26, { height: 9 })].map((sp) => ({
    ...sp,
    geo: mergeGeo([
      tintGeo(sp.trunk, (c, x, y) => c.setHex(0x8a6a3f).multiplyScalar(0.75 + 0.25 * fbm2(y * 2.2, x, 2))),
      tintGeo(sp.fronds, (c, x, y) => c.setHex(0x3f8a3f).lerp(new THREE.Color(0x7fb84e), Math.min(1, Math.max(0, (y - sp.height) * 0.3 + 0.35)))),
    ]),
  }));
  const palmPos = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + rnd() * 0.3;
    const r = 18 + rnd() * 5;
    const x = ox + Math.cos(a) * r;
    const z = oz + Math.sin(a) * r;
    palmPos.push({ x, y: heightAt(x, z), z, a: rnd() * Math.PI * 2, s: 0.8 + rnd() * 0.5 });
  }
  for (let v = 0; v < palmSpecs.length; v++) {
    const list = palmPos.filter((_, i) => i % palmSpecs.length === v);
    if (!list.length) continue;
    group.add(instantiate(palmSpecs[v].geo, palmMat, list, { scaleMin: 0.85, scaleMax: 1.2 }));
  }

  // -------------------- Polvo en el aire --------------------
  const dust = buildDust(centroid.x, centroid.z, 700, { seed: 13, color: 0xe6c98a, size: 0.55 });
  group.add(dust.group);
  updaters.push(dust.update);

  // -------------------- Banderas --------------------
  const flags = buildTracksideFlags(samples, {
      half,
      sides: [1, -1],
      spacing: 18,
      sampleSpacing,
      colors: [0xff8a2b, 0xffd23f, 0xc0392b, 0xffffff],
    });
  group.add(flags.group);
  updaters.push((dt, time) => setWindTime(flags.material, time));

  function update(dt, time) {
    for (const u of updaters) u(dt, time);
  }

  return { group, update };
}
