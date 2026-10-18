// BLOQUE 1 — Circuito "Cumbre Helada": atardecer frío, pinos nevados, rocas,
// cordilleras, lago helado, témpanos, nieve cayendo y aurora sutil.

import * as THREE from 'three';
import { smoothstep } from './procgen.js';
import { buildPine, buildGrassTuft, scatter, instantiate } from './vegetation.js';
import { buildRock, rockMaterial, buildMountainCone, mountainMaterial } from './rocks.js';
import { createWaterMaterial } from './water.js';
import { buildSnowfall, buildTracksideFlags } from './props.js';
import { setWindTime } from './materials.js';

export const SNOW_AMBIENT = {
  seed: 4242,
  background: 0x2b3a6a,
  fogColor: 0xdbe7f4,
  fogDensity: 0.0011,
  sky: {
    elevation: 7,
    azimuth: 300,
    turbidity: 3.2,
    rayleigh: 2.4,
    mieCoefficient: 0.006,
    mieDirectionalG: 0.8,
    sun: { color: 0xffdbe6, intensity: 2.4 },
    hemi: { sky: 0xcfe2ff, ground: 0x9fb0c8, intensity: 0.85 },
    sunVisual: '#ffe6ee',
    sunVisualSize: 34,
    sunVisualOpacity: 0.8,
    shadowRadius: 150,
  },
  terrain: {
    detailNormal: 'snow',
    detailRepeat: 90,
    amp: 22,
    fineAmp: 4,
    flattenIn: 26,
    flattenOut: 150,
    roughness: 0.72,
    normalScale: 0.7,
    color: (x, z, h, rel, c) => {
      const rock = smoothstep(8, 24, rel);
      const ice = smoothstep(6, -1, rel) * 0.9;
      let r = 0.93, g = 0.96, b = 1.0;
      // hielo azulado en zonas bajas
      r = r * (1 - ice) + 0.62 * ice;
      g = g * (1 - ice) + 0.79 * ice;
      b = b * (1 - ice) + 0.9 * ice;
      // roca en alturas; transición suave (sin bandas duras)
      r = r * (1 - rock) + 0.45 * rock;
      g = g * (1 - rock) + 0.49 * rock;
      b = b * (1 - rock) + 0.53 * rock;
      c.setRGB(r, g, b);
    },
  },
};

export function buildSnow(ctx) {
  const { rnd, samples, half, heightAt, centroid, sampleSpacing } = ctx;
  const group = new THREE.Group();
  group.name = 'snow-props';
  const updaters = [];

  // -------------------- Pinos nevados --------------------
  // Un pino completo (tronco + agujas + nieve) = 1 InstancedMesh por variante.
  const pineMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.82,
    metalness: 0.0,
    envMapIntensity: 0.9,
  });
  const pineSpecs = [buildPine(4, { height: 9, radius: 2.2 }), buildPine(18, { height: 6.5, radius: 1.7 })];
  const pinePos = scatter(ctx, rnd, 190, { minR: 28, maxR: 340, clearance: 7, flatness: 10 });
  for (let v = 0; v < pineSpecs.length; v++) {
    const spec = pineSpecs[v];
    const list = pinePos.filter((_, i) => i % pineSpecs.length === v);
    if (!list.length) continue;
    group.add(instantiate(spec.geo, pineMat, list, { scaleMin: 0.8, scaleMax: 1.4, yScaleVar: 0.2 }));
  }

  // -------------------- Rocas --------------------
  const rMat = rockMaterial();
  const rockSpecs = [buildRock(6, { detail: 3 }), buildRock(22, { detail: 2 })];
  const rockPos = scatter(ctx, rnd, 110, { minR: 24, maxR: 360, clearance: 5 });
  const rockTones = [0x8b98a6, 0x6f7c8a, 0xa4b0bd, 0x5f6b78];
  for (let v = 0; v < rockSpecs.length; v++) {
    const list = rockPos.filter((_, i) => i % rockSpecs.length === v);
    if (!list.length) continue;
    group.add(
      instantiate(rockSpecs[v], rMat, list, {
        scaleMin: 0.9,
        scaleMax: 4,
        yScaleVar: 0.5,
        receiveShadow: true,
        colors: () => rockTones[Math.floor(rnd() * rockTones.length)],
      })
    );
  }

  // -------------------- Cordilleras lejanas --------------------
  const coneGeo = buildMountainCone(9, { rock: 0x4f5b68, rockTop: 0x7c8895, snow: 0xf6fbff, snowLine: 0.5 });
  const mountains = new THREE.InstancedMesh(coneGeo, mountainMaterial(), 26);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + rnd() * 0.2;
    const r = 900 + rnd() * 380;
    const s = 180 + rnd() * 240;
    dummy.position.set(centroid.x + Math.cos(a) * r, s * 0.5 - 18, centroid.z + Math.sin(a) * r);
    dummy.rotation.set(0, rnd() * Math.PI, 0);
    dummy.scale.set(s * (0.75 + rnd() * 0.5), s, s * (0.75 + rnd() * 0.5));
    dummy.updateMatrix();
    mountains.setMatrixAt(i, dummy.matrix);
  }
  mountains.instanceMatrix.needsUpdate = true;
  mountains.castShadow = false;
  mountains.frustumCulled = false;
  group.add(mountains);

  // -------------------- Témpanos en la pista --------------------
  const iceGeo = new THREE.CylinderGeometry(1, 1, 0.06, 8);
  const iceMat = new THREE.MeshStandardMaterial({
    color: 0xaccbe6,
    roughness: 0.18,
    metalness: 0.15,
    transparent: true,
    opacity: 0.72,
    envMapIntensity: 1.2,
  });
  const iceList = [];
  for (let i = 0; i < 34; i++) {
    const t = rnd();
    const sa = ctx.sampleAt(t);
    const lat = (rnd() - 0.5) * (half * 1.5);
    iceList.push({
      x: sa.pos.x + sa.left.x * lat,
      y: sa.pos.y + 0.03,
      z: sa.pos.z + sa.left.z * lat,
      a: Math.atan2(sa.tangent.x, sa.tangent.z) + (rnd() - 0.5) * 0.4,
      s: 0.9 + rnd() * 2.2,
      yr: rnd(),
    });
  }
  group.add(instantiate(iceGeo, iceMat, iceList, { castShadow: false, receiveShadow: true, scaleMin: 1, scaleMax: 2.4 }));

  // -------------------- Lago helado --------------------
  const lakeA = rnd() * Math.PI * 2;
  const lakeR = 150 + rnd() * 50;
  const lx = centroid.x + Math.cos(lakeA) * lakeR;
  const lz = centroid.z + Math.sin(lakeA) * lakeR;
  const ly = heightAt(lx, lz);
  const water = createWaterMaterial({
    seed: 11,
    deep: 0x1e4a72,
    shallow: 0x7fb6d6,
    sky: 0xdbe7f4,
    sunColor: 0xffe6ee,
    fogColor: 0xdbe7f4,
    fogDensity: 0.0011,
    opacity: 0.9,
    normalScale: 0.1,
    flow: 0.012,
  });
  const lake = new THREE.Mesh(new THREE.CircleGeometry(42, 44), water.material);
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(lx, ly + 0.15, lz);
  group.add(lake);
  updaters.push(water.update);
  // borde de hielo
  const shoreGeo = new THREE.RingGeometry(42, 50, 44);
  shoreGeo.rotateX(-Math.PI / 2);
  const shore = new THREE.Mesh(shoreGeo, new THREE.MeshStandardMaterial({ color: 0xdbe8f2, roughness: 0.6 }));
  shore.position.set(lx, ly + 0.12, lz);
  shore.receiveShadow = true;
  group.add(shore);

  // -------------------- Hierba seca asomando --------------------
  const dryMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.0, side: THREE.DoubleSide });
  const tuft = buildGrassTuft(77, { height: 0.45, rootColor: 0x6b6a4a, tipColor: 0xb8b489, blades: 5 });
  const dryList = [];
  for (let i = 0; i < 900; i++) {
    const s = samples[Math.floor(rnd() * samples.length)];
    const sign = rnd() < 0.5 ? 1 : -1;
    const lat = (half + 1.6 + rnd() * 22) * sign;
    dryList.push({ x: s.pos.x + s.left.x * lat, y: s.pos.y - 0.2, z: s.pos.z + s.left.z * lat, a: rnd() * Math.PI * 2, s: 0.6 + rnd() * 0.7 });
  }
  group.add(instantiate(tuft.geo, dryMat, dryList, { castShadow: false, scaleMin: 0.7, scaleMax: 1.4 }));

  // -------------------- Nieve cayendo --------------------
  const snow = buildSnowfall(centroid.x, centroid.z, 1500, { seed: 21, range: 260, top: 80 });
  group.add(snow.group);
  updaters.push(snow.update);

  // -------------------- Aurora boreal --------------------
  const auroraMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    fog: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uTime;
      void main() {
        float bands = sin(vUv.x * 18.0 + uTime * 0.6) * 0.5 + 0.5;
        bands *= sin(vUv.x * 7.0 - uTime * 0.3) * 0.5 + 0.5;
        float curtain = pow(1.0 - abs(vUv.y - 0.68), 1.6);
        float a = bands * curtain * 0.32;
        vec3 c = mix(vec3(0.35, 1.0, 0.7), vec3(0.55, 0.45, 1.0), vUv.x);
        gl_FragColor = vec4(c, a);
      }
    `,
  });
  const aurora = new THREE.Mesh(new THREE.CylinderGeometry(1500, 1500, 520, 48, 1, true), auroraMat);
  aurora.position.set(centroid.x, 300, centroid.z);
  aurora.frustumCulled = false;
  group.add(aurora);
  updaters.push((dt, time) => {
    auroraMat.uniforms.uTime.value = time;
  });

  // -------------------- Banderas --------------------
  const flags = buildTracksideFlags(samples, {
      half,
      sides: [1, -1],
      spacing: 18,
      sampleSpacing,
      colors: [0x2f80ff, 0xffffff, 0x6fb7ff, 0xffd23f],
    });
  group.add(flags.group);
  updaters.push((dt, time) => setWindTime(flags.material, time));

  function update(dt, time) {
    for (const u of updaters) u(dt, time);
  }

  return { group, update };
}
