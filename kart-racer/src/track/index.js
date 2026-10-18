// BLOQUE 1 — CIRCUITOS. Contrato §4.1.
// Generador común de circuitos + API `createTrack(scene, trackId)`.

import * as THREE from 'three';
import { ROAD_WIDTH } from '../shared/constants.js';
import { TRACKS } from '../shared/tracks.js';
import {
  mulberry32,
  checkerTex,
  curbTex,
  grainTex,
  boostTex,
  arrowTex,
  skyTex,
} from './textures.js';
import {
  MeshBuilder,
  addRibbon,
  addWall,
  addDashes,
  addGroundQuad,
  disposeObject,
} from './builder.js';
import { buildStartArch, buildGrandstands } from './common.js';
import { buildMeadow } from './meadow.js';
import { buildDesert } from './desert.js';
import { buildSnow } from './snow.js';

const SAMPLE_COUNT = 700;
const BAND = 8; // franja offroad a cada lado (m)
const CURB = 1.5; // ancho del bordillo (m)
const RAMP_EDGE_MARGIN = 2.2; // m antes del borde donde isOnRamp = true
const LOCAL_SEARCH = 40;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap01 = (t) => (((t % 1) + 1) % 1);
const circDist = (a, b) => {
  const d = Math.abs(wrap01(a) - wrap01(b));
  return Math.min(d, 1 - d);
};

// ----------------------------------------------------------------
// Definición de los tres circuitos (puntos de control + adornos).
// Punto = [x, z, y] (y = elevación suave). Longitud resultante 900–1400 m.
// ----------------------------------------------------------------
const TRACK_CONFIG = {
  meadow: {
    seed: 1337,
    controlPoints: [
      [150, -20, 0],
      [120, 80, 1.4],
      [60, 140, 2.6],
      [-5, 130, 1.6],
      [-30, 80, 0.2],
      [-70, 95, -0.6],
      [-95, 50, 0],
      [-150, 20, -1.6],
      [-155, -70, -2.2],
      [-80, -130, -1.0],
      [20, -140, 0],
      [95, -105, 1.4],
      [135, -55, 0.4],
    ],
    ramps: [{ f0: 0.3, f1: 0.319, h: 1.9 }],
    boostPads: [
      { tc: 0.1, th: 0.006, lat: 0, hw: 5 },
      { tc: 0.4, th: 0.005, lat: -3, hw: 3.4 },
      { tc: 0.62, th: 0.006, lat: 3, hw: 4 },
      { tc: 0.85, th: 0.006, lat: 0, hw: 5 },
    ],
    itemRows: [0.2, 0.52, 0.76],
    road: { base: '#5b6067', light: '#787e86', dark: '#3f434a' },
    offroad: { base: '#4c9a46', light: '#63b957', dark: '#357a34' },
    palette: {
      post: 0xdedede,
      accent: 0xffd23f,
      bannerBg: '#c8362b',
      stand: 0x8a8f98,
      curbA: '#e23b2f',
      curbB: '#f2f2f2',
      wallA: '#e8e8e8',
      wallB: '#2f80ff',
      padA: '#39d0ff',
      padB: '#ffffff',
    },
    theme: buildMeadow,
  },
  desert: {
    seed: 9021,
    controlPoints: [
      [180, 10, 0],
      [150, 110, 1.2],
      [60, 150, 2.2],
      [-20, 120, 1.2],
      [-60, 150, 0.2],
      [-120, 120, -1.0],
      [-180, 50, -1.6],
      [-150, -40, -1.0],
      [-60, -60, 0.2],
      [-80, -130, 0.6],
      [10, -160, 0],
      [120, -130, 1.2],
      [180, -60, 0.6],
    ],
    ramps: [{ f0: 0.36, f1: 0.379, h: 2.0 }],
    boostPads: [
      { tc: 0.08, th: 0.006, lat: 0, hw: 5 },
      { tc: 0.3, th: 0.005, lat: 3, hw: 3.4 },
      { tc: 0.55, th: 0.006, lat: -3, hw: 4 },
      { tc: 0.79, th: 0.006, lat: 0, hw: 5 },
    ],
    itemRows: [0.16, 0.48, 0.72],
    road: { base: '#7a5a3c', light: '#966f4a', dark: '#5a4028' },
    offroad: { base: '#d9b26a', light: '#e8c887', dark: '#b98d4d' },
    palette: {
      post: 0xe0d0a8,
      accent: 0xff8a2b,
      bannerBg: '#b4531f',
      stand: 0xa98b5c,
      curbA: '#e23b2f',
      curbB: '#f2f2f2',
      wallA: '#f0d9a8',
      wallB: '#c0392b',
      padA: '#ffb347',
      padB: '#fff2c0',
    },
    theme: buildDesert,
  },
  snow: {
    seed: 4242,
    controlPoints: [
      [140, -40, 0],
      [150, 60, 2.0],
      [90, 120, 3.0],
      [20, 100, 2.0],
      [-10, 140, 1.0],
      [-90, 140, 0],
      [-150, 80, -1.2],
      [-120, 0, -2.0],
      [-170, -70, -1.0],
      [-80, -130, 0],
      [10, -120, 1.0],
      [40, -70, 2.0],
      [110, -90, 1.0],
    ],
    ramps: [{ f0: 0.24, f1: 0.259, h: 2.0 }],
    boostPads: [
      { tc: 0.12, th: 0.006, lat: 0, hw: 5 },
      { tc: 0.34, th: 0.005, lat: -3, hw: 3.4 },
      { tc: 0.6, th: 0.006, lat: 3, hw: 4 },
      { tc: 0.88, th: 0.006, lat: 0, hw: 5 },
    ],
    itemRows: [0.18, 0.5, 0.8],
    road: { base: '#9fbdd2', light: '#c2dbe9', dark: '#7d9fb6' },
    offroad: { base: '#f2f7fc', light: '#ffffff', dark: '#d3deea' },
    palette: {
      post: 0xdfe8f0,
      accent: 0x6fb7ff,
      bannerBg: '#1f5f8f',
      stand: 0x9aa9b8,
      curbA: '#2f80ff',
      curbB: '#f2f2f2',
      wallA: '#f4f8fb',
      wallB: '#2f80ff',
      padA: '#39d0ff',
      padB: '#eafcff',
    },
    theme: buildSnow,
  },
};

// ----------------------------------------------------------------
// Ruido de valor para el terreno.
// ----------------------------------------------------------------
function hash2(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x, z) {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi);
  const b = hash2(xi + 1, zi);
  const c = hash2(xi, zi + 1);
  const d = hash2(xi + 1, zi + 1);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}
function fbm(x, z) {
  let s = 0;
  let amp = 1;
  let f = 1;
  let norm = 0;
  for (let o = 0; o < 4; o++) {
    s += amp * vnoise(x * f, z * f);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return s / norm;
}

export function createTrack(scene, trackId) {
  const def = TRACKS.find((t) => t.id === trackId) || TRACKS[0];
  const cfg = TRACK_CONFIG[def.id] || TRACK_CONFIG.meadow;
  const rnd = mulberry32(cfg.seed);

  const group = new THREE.Group();
  group.name = `track:${def.id}`;
  const updaters = [];

  const prevBackground = scene.background;
  const prevFog = scene.fog;

  const half = ROAD_WIDTH / 2;
  const WALL_LAT = half + BAND;

  // --- Curva central (CatmullRom centripetal cerrada) ---
  const cpoints = cfg.controlPoints.map((p) => new THREE.Vector3(p[0], p[2] || 0, p[1]));
  const curve = new THREE.CatmullRomCurve3(cpoints, true, 'centripetal');

  const ramps = cfg.ramps.map((r) => ({ f0: r.f0, f1: r.f1, h: r.h }));
  function rampHeightAt(t) {
    let y = 0;
    for (const r of ramps) {
      if (t >= r.f0 && t <= r.f1) {
        const u = (t - r.f0) / (r.f1 - r.f0 || 1);
        y += r.h * (u < 0.82 ? Math.pow(u / 0.82, 1.4) : 1);
      }
    }
    return y;
  }

  // --- Muestreo ---
  const samples = [];
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const t = i / SAMPLE_COUNT;
    const pos = curve.getPointAt(t);
    pos.y += rampHeightAt(t);
    const tan = curve.getTangentAt(t);
    tan.y = 0;
    if (tan.lengthSq() < 1e-8) tan.set(0, 0, 1);
    tan.normalize();
    const left = new THREE.Vector3(tan.z, 0, -tan.x);
    samples.push({ t, pos, left, tangent: tan });
  }
  const N = samples.length;

  let length = 0;
  for (let i = 0; i < N; i++) length += samples[i].pos.distanceTo(samples[(i + 1) % N].pos);

  const centroid = new THREE.Vector3();
  for (const s of samples) centroid.add(s.pos);
  centroid.divideScalar(N);
  centroid.y = 0;

  function sampleAt(t) {
    const ft = wrap01(t) * N;
    const i = Math.floor(ft) % N;
    const u = ft - Math.floor(ft);
    const a = samples[i];
    const b = samples[(i + 1) % N];
    return {
      pos: new THREE.Vector3(
        a.pos.x + (b.pos.x - a.pos.x) * u,
        a.pos.y + (b.pos.y - a.pos.y) * u,
        a.pos.z + (b.pos.z - a.pos.z) * u
      ),
      tangent: new THREE.Vector3(
        a.tangent.x + (b.tangent.x - a.tangent.x) * u,
        0,
        a.tangent.z + (b.tangent.z - a.tangent.z) * u
      ).normalize(),
      left: a.left.clone(),
    };
  }

  function nearestSampleXZ(x, z) {
    let best = 0;
    let bestD = Infinity;
    let by = 0;
    for (let i = 0; i < N; i += 2) {
      const p = samples[i].pos;
      const dx = x - p.x;
      const dz = z - p.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = i;
        by = p.y;
      }
    }
    return { d: Math.sqrt(bestD), y: by, index: best };
  }

  function isOnTrack(x, z, margin = 5) {
    return nearestSampleXZ(x, z).d < WALL_LAT + margin;
  }

  // ----------------------------------------------------------------
  // Malla: carretera, bordillos, offroad, muros, marcas.
  // ----------------------------------------------------------------
  const roadTex = grainTex(cfg.road.base, cfg.road.light, cfg.road.dark, cfg.seed, 3000);
  roadTex.repeat.set(2, 1);
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex, side: THREE.DoubleSide });
  const rb = new MeshBuilder();
  addRibbon(rb, samples, { latA: half, latB: -half, vScale: 16, close: true });
  const road = new THREE.Mesh(rb.geometry(), roadMat);
  road.receiveShadow = true;
  group.add(road);

  const curbMat = new THREE.MeshLambertMaterial({ map: curbTex(cfg.palette.curbA, cfg.palette.curbB), side: THREE.DoubleSide });
  const cb = new MeshBuilder();
  addRibbon(cb, samples, { latA: half, latB: half + CURB, yA: 0.03, yB: 0.07, vScale: 2.4, close: true });
  addRibbon(cb, samples, { latA: -half, latB: -half - CURB, yA: 0.03, yB: 0.07, vScale: 2.4, close: true });
  const curbs = new THREE.Mesh(cb.geometry(), curbMat);
  curbs.receiveShadow = true;
  group.add(curbs);

  const offTex = grainTex(cfg.offroad.base, cfg.offroad.light, cfg.offroad.dark, cfg.seed + 5, 2600);
  offTex.repeat.set(3, 3);
  const offMat = new THREE.MeshLambertMaterial({ map: offTex, side: THREE.DoubleSide });
  const ob = new MeshBuilder();
  addRibbon(ob, samples, { latA: half + CURB, latB: half + BAND, yA: 0.02, yB: -0.12, vScale: 22, close: true });
  addRibbon(ob, samples, { latA: -half - CURB, latB: -half - BAND, yA: 0.02, yB: -0.12, vScale: 22, close: true });
  const offroad = new THREE.Mesh(ob.geometry(), offMat);
  offroad.receiveShadow = true;
  group.add(offroad);

  const wallMat = new THREE.MeshLambertMaterial({ map: curbTex(cfg.palette.wallA, cfg.palette.wallB), side: THREE.DoubleSide });
  const wb = new MeshBuilder();
  addWall(wb, samples, { lat: WALL_LAT, yBottom: -2.2, yTop: 1.5, vScale: 6, close: true });
  addWall(wb, samples, { lat: -WALL_LAT, yBottom: -2.2, yTop: 1.5, vScale: 6, close: true });
  const walls = new THREE.Mesh(wb.geometry(), wallMat);
  walls.receiveShadow = true;
  group.add(walls);

  const lineMat = new THREE.MeshBasicMaterial({ color: 0xf2f2f2, side: THREE.DoubleSide });
  const lb = new MeshBuilder();
  addDashes(lb, samples, { lat: 0, halfW: 0.17, dashLen: 3, gapLen: 6, yLift: 0.05 });
  group.add(new THREE.Mesh(lb.geometry(), lineMat));

  // Línea de meta a cuadros.
  const startTex = checkerTex(2, '#f4f4f4', '#141414');
  startTex.wrapS = THREE.RepeatWrapping;
  startTex.wrapT = THREE.RepeatWrapping;
  startTex.repeat.set(12, 1);
  const startMat = new THREE.MeshBasicMaterial({ map: startTex, side: THREE.DoubleSide });
  const sb = new MeshBuilder();
  addRibbon(sb, samples, { start: 0, count: 3, latA: half, latB: -half, vScale: 4, close: false });
  group.add(new THREE.Mesh(sb.geometry(), startMat));

  // Placas de turbo (chevrones animados).
  const padTex = boostTex(cfg.palette.padA, cfg.palette.padB);
  padTex.repeat.set(1, 2);
  const padMat = new THREE.MeshBasicMaterial({ map: padTex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const padBuilder = new MeshBuilder();
  for (const p of cfg.boostPads) {
    const start = Math.floor(wrap01(p.tc - p.th) * N);
    const count = Math.max(2, Math.ceil(p.th * 2 * N) + 1);
    addRibbon(padBuilder, samples, {
      start,
      count,
      latA: p.lat + p.hw,
      latB: p.lat - p.hw,
      yA: 0.06,
      yB: 0.06,
      vScale: 2.6,
      close: false,
    });
  }
  group.add(new THREE.Mesh(padBuilder.geometry(), padMat));

  // Flechas pintadas en las rampas.
  const arrowMat = new THREE.MeshBasicMaterial({ map: arrowTex(), transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const arrowBuilder = new MeshBuilder();
  for (const r of ramps) {
    const start = Math.floor(r.f0 * N);
    const count = Math.max(2, Math.ceil((r.f1 - r.f0) * N));
    addRibbon(arrowBuilder, samples, {
      start,
      count,
      latA: half * 0.5,
      latB: -half * 0.5,
      yA: 0.07,
      yB: 0.07,
      vScale: 2.4,
      close: false,
    });
  }
  group.add(new THREE.Mesh(arrowBuilder.geometry(), arrowMat));
  updaters.push((dt) => {
    padTex.offset.y -= dt * 0.7;
  });

  // ----------------------------------------------------------------
  // Cajas de objetos (solo posiciones; las dibuja el bloque de objetos).
  // 3 filas de 4 cajas a lo ancho de la carretera.
  // ----------------------------------------------------------------
  const itemBoxPositions = [];
  const boxLaterals = [-6.3, -2.1, 2.1, 6.3];
  for (const f of cfg.itemRows) {
    const sa = sampleAt(f);
    for (const lat of boxLaterals) {
      itemBoxPositions.push(
        new THREE.Vector3(sa.pos.x + sa.left.x * lat, sa.pos.y + 1, sa.pos.z + sa.left.z * lat)
      );
    }
  }

  // ----------------------------------------------------------------
  // Parrilla de salida + marcas.
  // ----------------------------------------------------------------
  function getStartGrid(n) {
    const grid = [];
    const rowGap = 5;
    const lateral = 4;
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / 2);
      const col = i % 2;
      const dist = (row + 1) * rowGap;
      const t = wrap01(-dist / length);
      const sa = sampleAt(t);
      const lat = col === 0 ? lateral : -lateral;
      const position = new THREE.Vector3(
        sa.pos.x + sa.left.x * lat,
        sa.pos.y,
        sa.pos.z + sa.left.z * lat
      );
      const heading = Math.atan2(sa.tangent.x, sa.tangent.z);
      grid.push({ position, heading });
    }
    return grid;
  }

  {
    const gb = new MeshBuilder();
    for (const slot of getStartGrid(8)) {
      addGroundQuad(gb, slot.position.x, slot.position.y, slot.position.z, slot.heading, 1.0, 2.4, 0.05);
    }
    group.add(new THREE.Mesh(gb.geometry(), new THREE.MeshBasicMaterial({ color: 0xffe14d, side: THREE.DoubleSide })));
  }

  // ----------------------------------------------------------------
  // Escenario temático. Se construye ANTES que el terreno porque el tema
  // define `ambient`: los colores del propio terreno, el cielo, la niebla y
  // las luces. (Antes se leía `cfg.theme.ambient`, es decir una propiedad de
  // la función, no del objeto que devuelve; por eso todo caía en el verde
  // por defecto y desert/snow se veían como prado.)
  // ----------------------------------------------------------------
  const ctx = { samples, half, band: BAND, isOnTrack, rnd, length, centroid, sampleAt };
  const theme = cfg.theme(ctx);
  const ambient = theme.ambient || {};

  // ----------------------------------------------------------------
  // Terreno de fondo (hasta el horizonte, sin huecos).
  // ----------------------------------------------------------------
  const useVC = typeof ambient.terrainColor === 'function';
  const tmpColor = new THREE.Color();
  {
    const size = 4400;
    const seg = 132;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    geo.translate(centroid.x, 0, centroid.z);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const amp = ambient.duneAmp || 12;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const ns = nearestSampleXZ(x, z);
      const base = ns.y - 0.45;
      const n1 = fbm(x * 0.0032 + 11, z * 0.0032 + 7);
      const n2 = fbm(x * 0.018 + 3, z * 0.018 + 5);
      const far = (n1 - 0.5) * 2 * amp + (n2 - 0.5) * 2 * (amp * 0.18);
      const blend = clamp((ns.d - 34) / 150, 0, 1);
      const smooth = blend * blend * (3 - 2 * blend);
      const h = base * (1 - smooth) + (base + far) * smooth;
      pos.setY(i, h);
      if (useVC) {
        const c = ambient.terrainColor(x, z, h - base);
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }
    }
    geo.computeVertexNormals();
    if (useVC) geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const terrTex = grainTex(ambient.terrainBase || '#7fbf6a', ambient.terrainLight || '#a6d98f', ambient.terrainDark || '#5c9a4a', cfg.seed + 9, 4000);
    terrTex.repeat.set(70, 70);
    const terrMat = new THREE.MeshLambertMaterial({ map: terrTex, vertexColors: useVC });
    const terrain = new THREE.Mesh(geo, terrMat);
    terrain.receiveShadow = true;
    group.add(terrain);
  }

  // ----------------------------------------------------------------
  // Cielo, sol y luces.
  // ----------------------------------------------------------------
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1900, 32, 16),
    new THREE.MeshBasicMaterial({ map: skyTex(ambient.skyStops || [[0, '#2f6fd0'], [1, '#eaf6ff']]), side: THREE.BackSide, fog: false, depthWrite: false })
  );
  sky.position.copy(centroid);
  group.add(sky);

  const sunDir = new THREE.Vector3(...(ambient.sunDir || [0.5, 0.7, 0.45])).normalize();
  const sunVis = new THREE.Mesh(
    new THREE.SphereGeometry(45, 16, 12),
    new THREE.MeshBasicMaterial({ color: ambient.sunVisual || '#fff4d6', fog: false })
  );
  sunVis.position.copy(centroid).addScaledVector(sunDir, 1500);
  group.add(sunVis);

  const hemi = new THREE.HemisphereLight(ambient.hemiSky || 0xbfe6ff, ambient.hemiGround || 0x3f6b2a, ambient.hemiIntensity ?? 0.9);
  group.add(hemi);
  const sun = new THREE.DirectionalLight(ambient.sunColor || 0xffffff, ambient.sunIntensity ?? 2.2);
  sun.position.copy(centroid).addScaledVector(sunDir, 320);
  sun.target.position.copy(centroid);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const R = 360;
  sun.shadow.camera.left = -R;
  sun.shadow.camera.right = R;
  sun.shadow.camera.top = R;
  sun.shadow.camera.bottom = -R;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 1400;
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0007;
  sun.shadow.normalBias = 0.6;
  group.add(sun);
  group.add(sun.target);

  scene.background = new THREE.Color(ambient.background || 0x87c9ff);
  scene.fog = new THREE.Fog(ambient.fog || 0xbcdcff, ambient.fogNear ?? 240, ambient.fogFar ?? 1300);

  // ----------------------------------------------------------------
  // Estructuras comunes.
  // ----------------------------------------------------------------
  group.add(theme.group);
  if (theme.update) updaters.push(theme.update);

  group.add(buildStartArch(samples, half, def.name, cfg.palette));
  const stands = buildGrandstands(samples, half, cfg.palette, rnd);
  group.add(stands.group);
  updaters.push(stands.update);

  scene.add(group);

  // ----------------------------------------------------------------
  // Proyección rápida sobre la pista.
  // ----------------------------------------------------------------
  function nearestIndex(pos, hintT) {
    let best = -1;
    let bestD = Infinity;
    if (hintT != null && isFinite(hintT)) {
      const c = Math.floor(wrap01(hintT) * N);
      for (let k = -LOCAL_SEARCH; k <= LOCAL_SEARCH; k++) {
        const idx = ((c + k) % N + N) % N;
        const p = samples[idx].pos;
        const dx = pos.x - p.x;
        const dz = pos.z - p.z;
        const d = dx * dx + dz * dz;
        if (d < bestD) {
          bestD = d;
          best = idx;
        }
      }
      if (bestD < 90 * 90) return best;
    }
    best = -1;
    bestD = Infinity;
    for (let i = 0; i < N; i++) {
      const p = samples[i].pos;
      const dx = pos.x - p.x;
      const dz = pos.z - p.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  function projectToTrack(pos, hintT) {
    const idx = Math.max(0, nearestIndex(pos, hintT));
    const a = samples[idx];
    const b = samples[(idx + 1) % N];
    const abx = b.pos.x - a.pos.x;
    const abz = b.pos.z - a.pos.z;
    const apx = pos.x - a.pos.x;
    const apz = pos.z - a.pos.z;
    const len2 = abx * abx + abz * abz;
    let u = len2 > 1e-6 ? (apx * abx + apz * abz) / len2 : 0;
    u = clamp(u, 0, 1);
    const t = wrap01((idx + u) / N);
    const cx = a.pos.x + abx * u;
    const cy = a.pos.y + (b.pos.y - a.pos.y) * u;
    const cz = a.pos.z + abz * u;
    const left = a.left;
    const lateral = (pos.x - cx) * left.x + (pos.z - cz) * left.z;
    const absLat = Math.abs(lateral);
    let surface = 'road';
    if (absLat > WALL_LAT) surface = 'wall';
    else if (absLat > half) surface = 'offroad';
    const wallNormal =
      surface === 'wall'
        ? new THREE.Vector3(-left.x * Math.sign(lateral), 0, -left.z * Math.sign(lateral))
        : null;
    const tangent = new THREE.Vector3(
      a.tangent.x + (b.tangent.x - a.tangent.x) * u,
      0,
      a.tangent.z + (b.tangent.z - a.tangent.z) * u
    ).normalize();
    return {
      t,
      lateral,
      surface,
      groundY: cy,
      tangent,
      wallNormal,
      center: new THREE.Vector3(cx, cy, cz),
    };
  }

  function isOnBoostPad(pos) {
    const idx = nearestIndex(pos, null);
    const a = samples[idx];
    const lateral = (pos.x - a.pos.x) * a.left.x + (pos.z - a.pos.z) * a.left.z;
    for (const p of cfg.boostPads) {
      if (Math.abs(lateral - p.lat) <= p.hw && circDist(a.t, p.tc) <= p.th) return true;
    }
    return false;
  }

  function isOnRamp(pos) {
    const idx = nearestIndex(pos, null);
    const tt = samples[idx].t;
    for (const r of ramps) {
      const dist = (r.f1 - tt) * length;
      if (dist >= -0.8 && dist <= RAMP_EDGE_MARGIN) return true;
    }
    return false;
  }

  function getPointAt(t) {
    return sampleAt(t).pos;
  }

  function getMinimapPoints() {
    const pts = [];
    const count = 200;
    for (let i = 0; i < count; i++) {
      const p = samples[Math.floor((i / count) * N)].pos;
      pts.push({ x: p.x, z: p.z });
    }
    return pts;
  }

  // Línea de carrera: centro desplazado al interior de las curvas.
  const racingLine = (() => {
    const count = 300;
    const out = [];
    const aheadM = 7;
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const sa = sampleAt(t);
      const ahead = sampleAt(t + aheadM / length);
      const behind = sampleAt(t - aheadM / length);
      const f1x = behind.tangent.x;
      const f1z = behind.tangent.z;
      const f2x = ahead.tangent.x;
      const f2z = ahead.tangent.z;
      const ycomp = f1z * f2x - f1x * f2z; // >0 = gira a la izquierda
      const dot = clamp(f1x * f2x + f1z * f2z, -1, 1);
      const ang = Math.acos(dot);
      const sign = ycomp >= 0 ? 1 : -1;
      const offset = sign * Math.min(0.3 * half, ang * 26);
      const maxOff = half - 1.2;
      const lat = clamp(offset, -maxOff, maxOff);
      out.push(
        new THREE.Vector3(sa.pos.x + sa.left.x * lat, sa.pos.y, sa.pos.z + sa.left.z * lat)
      );
    }
    return out;
  })();

  function getRacingLine() {
    return racingLine.map((v) => v.clone());
  }

  function update(dt, time) {
    for (const u of updaters) u(dt, time);
  }

  function dispose() {
    scene.remove(group);
    disposeObject(group);
    scene.background = prevBackground;
    scene.fog = prevFog;
  }

  const api = {
    id: def.id,
    name: def.name,
    musicId: def.musicId,
    group,
    length,
    roadWidth: ROAD_WIDTH,
    getStartGrid,
    projectToTrack,
    isOnBoostPad,
    isOnRamp,
    itemBoxPositions,
    getRacingLine,
    getPointAt,
    getMinimapPoints,
    update,
    dispose,
    // extras útiles (no rompen el contrato)
    curve,
    samples,
    centroid,
    isOnTrack,
  };

  if (typeof window !== 'undefined' && window.location &&
      new URLSearchParams(window.location.search).get('autotest') === '1') {
    window.__track = api;
  }

  return api;
}

// ----------------------------------------------------------------
// Silueta ligera del trazado para miniaturas de la interfaz.
// ~120 puntos de la línea central en coordenadas de mundo (x, z).
// No crea escena ni mallas: deriva de los MISMOS puntos de control que usa
// `createTrack` (construye la misma CatmullRom centripeta cerrada).
// ----------------------------------------------------------------
export function getTrackOutline(trackId) {
  const def = TRACKS.find((t) => t.id === trackId) || TRACKS[0];
  const cfg = TRACK_CONFIG[def.id] || TRACK_CONFIG.meadow;
  const cpoints = cfg.controlPoints.map((p) => new THREE.Vector3(p[0], p[2] || 0, p[1]));
  const curve = new THREE.CatmullRomCurve3(cpoints, true, 'centripetal');
  const count = 120;
  const out = [];
  for (let i = 0; i < count; i++) {
    const p = curve.getPointAt(i / count);
    out.push({ x: p.x, z: p.z });
  }
  return out;
}
