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
      vertexColors: true,
      roughness: 0.82,
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
  {
    const tuft = buildGrassTuft(207, {
      height: 0.8,
      rootColor: 0x2f5a1e,
      tipColor: 0xa9d95f,
      blades: 8,
    });
    const list = scatterTrackSide(ctx, rnd, 3000, { latMin: half + 1.4, latMax: half + 20 });
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0.0, side: THREE.DoubleSide });
    applyWind(mat, { strength: 0.12, height: tuft.height, speed: 1.7, scale: 0.6, bend: 1.2 });
    windMats.push(mat);
    const mesh = instantiate(tuft.geo, mat, list, {
      castShadow: false,
      scaleMin: 0.6,
      scaleMax: 1.7,
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
  // Torre + tejado en una malla (vertex colors) y las 4 aspas en otra que gira.
  const mill = new THREE.Group();
  const tint = (g, hex) => {
    const c = new THREE.Color(hex);
    const arr = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] = c.r;
      arr[i + 1] = c.g;
      arr[i + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return g;
  };
  const towerGeo = new THREE.CylinderGeometry(1.1, 2.3, 14, 24);
  towerGeo.translate(0, 7, 0);
  const roofGeo = new THREE.ConeGeometry(2.2, 2.6, 24);
  roofGeo.translate(0, 15.3, 0);
  const millBody = new THREE.Mesh(
    mergeGeometries([
      tint(towerGeo.toNonIndexed(), 0xf0ece0),
      tint(roofGeo.toNonIndexed(), 0xc0392b),
    ]),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.0 })
  );
  millBody.castShadow = true;
  millBody.receiveShadow = true;
  mill.add(millBody);
  const blades = new THREE.Group();
  const bladeParts = [];
  for (let i = 0; i < 4; i++) {
    const b = new THREE.BoxGeometry(0.7, 9.0, 0.22);
    b.translate(0, 4.8, 0);
    b.rotateZ((i / 4) * Math.PI * 2);
    bladeParts.push(b);
  }
  const bladeMesh = new THREE.Mesh(
    mergeGeometries(bladeParts),
    new THREE.MeshStandardMaterial({ color: 0xf7f3e8, roughness: 0.7, metalness: 0.0 })
  );
  bladeMesh.castShadow = true;
  blades.add(bladeMesh);
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
  group.add(
    buildDistantHills(ctx, {
      count: 26,
      detail: 3,
      colorBase: 0x4c8a3c,
      colorTop: 0x86b56a,
      dryColor: 0xa6b070,
      normalKind: 'grass',
    }).mesh
  );

  // -------------------- Banderas --------------------
  {
    const flags = buildTracksideFlags(samples, {
      half,
      sides: [1, -1],
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
