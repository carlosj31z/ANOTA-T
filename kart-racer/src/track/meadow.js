// BLOQUE 1 — Circuito "Prado Turbo": colinas verdes, hierba con viento, flores,
// árboles orgánicos, molino, nubes, globos, mariposas y banderas.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fbm2, smoothstep } from './procgen.js';
import { applyWind, setWindTime } from './materials.js';
import {
  buildBroadleaf,
  buildGrassTuft,
  scatter,
  scatterTrackSide,
  instantiate,
  barkMaterial,
} from './vegetation.js';
import { buildBalloons, buildClouds, buildButterflies, buildTracksideFlags } from './props.js';
import { buildDistantHills } from './terrain.js';

export const MEADOW_AMBIENT = {
  seed: 1337,
  background: 0x9fd3ff,
  fogColor: 0xc2dcf6,
  fogDensity: 0.00042,
  sky: {
    elevation: 42,
    azimuth: 96,
    turbidity: 1.4,
    rayleigh: 1.0,
    mieCoefficient: 0.004,
    mieDirectionalG: 0.8,
    sun: { color: 0xfff5e2, intensity: 3.2 },
    hemi: { sky: 0xa8d4ff, ground: 0x4a7a3a, intensity: 0.55 },
    sunVisual: '#fffbe6',
    sunVisualSize: 20,
    shadowRadius: 150,
  },
  terrain: {
    detailNormal: 'grass',
    detailRepeat: 110,
    amp: 15,
    fineAmp: 3,
    flattenIn: 26,
    flattenOut: 150,
    roughness: 0.95,
    normalScale: 0.6,
    color: (x, z, h, rel, c) => {
      const n = fbm2(x * 0.025 + 3, z * 0.025 + 7);
      const dry = smoothstep(0.52, 0.78, n);
      const dirt = smoothstep(0.72, 0.95, fbm2(x * 0.011 + 40, z * 0.011 + 9)) * 0.7;
      let r = 0.2 + 0.16 * (1 - dry) + 0.34 * dry;
      let g = 0.46 + 0.1 * (1 - dry) + 0.14 * dry;
      let b = 0.15 + 0.06 * (1 - dry) + 0.07 * dry;
      r = r * (1 - dirt) + 0.38 * dirt;
      g = g * (1 - dirt) + 0.3 * dirt;
      b = b * (1 - dirt) + 0.2 * dirt;
      c.setRGB(r, g, b);
    },
  },
};

export function buildMeadow(ctx) {
  const { rnd, samples, half, heightAt, centroid } = ctx;
  const group = new THREE.Group();
  group.name = 'meadow-props';
  const updaters = [];
  const windMats = [];

  // -------------------- Árboles de copa --------------------
  const treeSpecs = [
    buildBroadleaf(11, { height: 8.5 }),
    buildBroadleaf(29, { height: 6.5 }),
  ];
  const trunkMat = barkMaterial();
  const greens = [0x3f9b46, 0x2f8a3f, 0x4fb055, 0x57a83f, 0x6bbf4f];
  const treePos = scatter(ctx, rnd, 170, { minR: 34, maxR: 330, clearance: 8, flatness: 9 });
  // reparto por variante
  for (let v = 0; v < treeSpecs.length; v++) {
    const spec = treeSpecs[v];
    const list = treePos.filter((_, i) => i % treeSpecs.length === v);
    if (list.length === 0) continue;
    const trunks = instantiate(spec.trunk, trunkMat, list, { scaleMin: 0.8, scaleMax: 1.5, yScaleVar: 0.2 });
    const foliageMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.85,
      metalness: 0.0,
      flatShading: false,
    });
    applyWind(foliageMat, { strength: 0.16, height: spec.height, speed: 0.9, scale: 0.12, bend: 1.3 });
    windMats.push(foliageMat);
    const foliage = instantiate(spec.foliage, foliageMat, list, {
      scaleMin: 0.8,
      scaleMax: 1.5,
      yScaleVar: 0.2,
      colors: () => greens[Math.floor(rnd() * greens.length)],
    });
    group.add(trunks, foliage);
  }

  // -------------------- Hierba tupida junto a la pista --------------------
  const tuftColors = [0x7fbf4a, 0x9fd25a, 0x6fae3f, 0xb8d86a, 0x5f9a3a];
  for (let v = 0; v < 2; v++) {
    const tuft = buildGrassTuft(200 + v * 7, {
      height: 0.6 + v * 0.25,
      rootColor: 0x2f5a1e,
      tipColor: 0xa9d95f,
      blades: 6,
    });
    const list = scatterTrackSide(ctx, rnd, 1500, { latMin: half + 1.4, latMax: half + 20 });
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0.0, side: THREE.DoubleSide });
    applyWind(mat, { strength: 0.12, height: tuft.height, speed: 1.7, scale: 0.6, bend: 1.2 });
    windMats.push(mat);
    const mesh = instantiate(tuft.geo, mat, list, {
      castShadow: false,
      scaleMin: 0.7,
      scaleMax: 1.6,
      colors: () => tuftColors[Math.floor(rnd() * tuftColors.length)],
    });
    group.add(mesh);
  }

  // -------------------- Flores --------------------
  const flowerGeo = mergeGeometries([
    new THREE.CylinderGeometry(0.02, 0.03, 0.35, 4).translate(0, 0.17, 0),
    new THREE.SphereGeometry(0.14, 6, 5).translate(0, 0.38, 0),
  ]);
  const flowerMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, metalness: 0.0 });
  const flowerColors = [0xff5a5a, 0xffd23f, 0xffffff, 0xff8ad8, 0xa06bff, 0xff9a3f];
  const flowers = scatterTrackSide(ctx, rnd, 900, { latMin: half + 1.8, latMax: half + 26 });
  group.add(
    instantiate(flowerGeo, flowerMat, flowers, {
      castShadow: false,
      scaleMin: 0.8,
      scaleMax: 1.5,
      colors: () => flowerColors[Math.floor(rnd() * flowerColors.length)],
    })
  );

  // -------------------- Mariposas --------------------
  const bfSpots = scatterTrackSide(ctx, rnd, 70, { latMin: half + 3, latMax: half + 30 });
  const bf = buildButterflies(rnd, bfSpots);
  group.add(bf.group);
  updaters.push(bf.update);

  // -------------------- Molino de viento --------------------
  const mill = new THREE.Group();
  const towerMat = new THREE.MeshStandardMaterial({ color: 0xf0ece0, roughness: 0.8, metalness: 0.0 });
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 2.3, 14, 12), towerMat);
  tower.position.y = 7;
  tower.castShadow = true;
  tower.receiveShadow = true;
  mill.add(tower);
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(2.2, 2.6, 12),
    new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.6, metalness: 0.1 })
  );
  roof.position.y = 15.3;
  roof.castShadow = true;
  mill.add(roof);
  const blades = new THREE.Group();
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0xf7f3e8, roughness: 0.7, metalness: 0.0 });
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.7, 9.0, 0.22), bladeMat);
    b.position.set(0, 4.8, 0);
    b.castShadow = true;
    const holder = new THREE.Group();
    holder.add(b);
    holder.rotation.z = (i / 4) * Math.PI * 2;
    blades.add(holder);
  }
  blades.position.set(0, 12.6, 2.4);
  mill.add(blades);
  const millAngle = rnd() * Math.PI * 2;
  mill.position.set(centroid.x + Math.cos(millAngle) * 175, heightAt(centroid.x + Math.cos(millAngle) * 175, centroid.z + Math.sin(millAngle) * 175), centroid.z + Math.sin(millAngle) * 175);
  mill.rotation.y = millAngle + Math.PI;
  group.add(mill);
  updaters.push((dt) => {
    blades.rotation.z += dt * 1.1;
  });

  // -------------------- Nubes y globos --------------------
  const clouds = buildClouds(rnd, { count: 18 });
  group.add(clouds.group);
  updaters.push(clouds.update);
  const balloons = buildBalloons(rnd, { count: 6 });
  group.add(balloons.group);
  updaters.push(balloons.update);

  // -------------------- Colinas lejanas --------------------
  group.add(buildDistantHills(ctx, { count: 26 }).mesh);

  // -------------------- Banderas --------------------
  for (const side of [1, -1]) {
    const flags = buildTracksideFlags(samples, {
      half,
      sideSign: side,
      spacing: 16,
      sampleSpacing: ctx.sampleSpacing,
      colors: [0xff3b3b, 0xffd23f, 0x2f80ff, 0x37d67a, 0xffffff],
    });
    group.add(flags.group);
    windMats.push(flags.material);
  }

  function update(dt, time) {
    for (const u of updaters) u(dt, time);
    for (const m of windMats) setWindTime(m, time);
  }

  return { group, update };
}
