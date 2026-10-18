// BLOQUE 1 — CIRCUITOS. Contrato §4.1 + §9.2.
// Generador común de circuitos + API `createTrack(scene, trackId, opts?)`.
// Gráficos next-gen: cielo atmosférico, PBR, terreno procedural, vegetación
// orgánica, agua con shader y detalles de ambiente. 100 % procedural.

import * as THREE from 'three';
import { ROAD_WIDTH } from '../shared/constants.js';
import { TRACKS } from '../shared/tracks.js';
import {
  mulberry32,
  asphaltMaps,
  curbMaps,
  grainTex,
  boostTex,
  arrowTex,
  checkerTex,
  wearAlphaTex,
  terrainNormal,
  setMaxAnisotropy,
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
import { buildSky } from './sky.js';
import { buildTerrain } from './terrain.js';
import { MEADOW_AMBIENT, buildMeadow } from './meadow.js';
import { DESERT_AMBIENT, buildDesert } from './desert.js';
import { SNOW_AMBIENT, buildSnow } from './snow.js';

const SAMPLE_COUNT = 700;
const BAND = 8; // franja offroad a cada lado (m)
const CURB = 1.5; // ancho del bordillo (m)
const RAMP_EDGE_MARGIN = 2.2; // m antes del borde donde isOnRamp = true
const LOCAL_SEARCH = 40;

// Busca el renderer de la aplicación (opcional) para afinar el filtrado de
// texturas. Si no está disponible se usa anisotropía 8 por defecto.
function findRenderer(opts) {
  if (opts && opts.renderer && opts.renderer.isWebGLRenderer) return opts.renderer;
  if (typeof window !== 'undefined') {
    if (window.__renderer && window.__renderer.isWebGLRenderer) return window.__renderer;
    if (window.__game && window.__game.renderer && window.__game.renderer.isWebGLRenderer) {
      return window.__game.renderer;
    }
  }
  return null;
}

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap01 = (t) => (((t % 1) + 1) % 1);
const circDist = (a, b) => {
  const d = Math.abs(wrap01(a) - wrap01(b));
  return Math.min(d, 1 - d);
};

// ----------------------------------------------------------------
// Definición de los tres circuitos (puntos de control + tema visual).
// Punto = [x, z, y] (y = elevación suave). Longitud resultante 900–1400 m.
// ----------------------------------------------------------------
const TRACK_CONFIG = {
  meadow: {
    seed: 1337,
    controlPoints: [
      [150, -20, 0], [120, 80, 1.4], [60, 140, 2.6], [-5, 130, 1.6],
      [-30, 80, 0.2], [-70, 95, -0.6], [-95, 50, 0], [-150, 20, -1.6],
      [-155, -70, -2.2], [-80, -130, -1.0], [20, -140, 0], [95, -105, 1.4],
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
    road: { base: '#5b6067', light: '#787e86', dark: '#3f434a', tint: [1.0, 1.0, 1.0], wet: 0.0 },
    offroad: { base: '#4c9a46', light: '#63b957', dark: '#357a34' },
    palette: {
      post: 0xdedede, accent: 0xffd23f, bannerBg: '#c8362b', stand: 0x8a8f98,
      curbA: '#e23b2f', curbB: '#f2f2f2', wallA: '#e8e8e8', wallB: '#2f80ff',
      padA: '#39d0ff', padB: '#ffffff',
    },
    ambient: MEADOW_AMBIENT,
    build: buildMeadow,
  },
  desert: {
    seed: 9021,
    controlPoints: [
      [180, 10, 0], [150, 110, 1.2], [60, 150, 2.2], [-20, 120, 1.2],
      [-60, 150, 0.2], [-120, 120, -1.0], [-180, 50, -1.6], [-150, -40, -1.0],
      [-60, -60, 0.2], [-80, -130, 0.6], [10, -160, 0], [120, -130, 1.2],
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
    road: { base: '#6b6157', light: '#837a6c', dark: '#4e463e', tint: [0.9, 0.95, 1.02], wet: 0.0 },
    offroad: { base: '#d9b26a', light: '#e8c887', dark: '#b98d4d' },
    palette: {
      post: 0xe0d0a8, accent: 0xff8a2b, bannerBg: '#b4531f', stand: 0xa98b5c,
      curbA: '#e23b2f', curbB: '#f2f2f2', wallA: '#f0d9a8', wallB: '#c0392b',
      padA: '#ffb347', padB: '#fff2c0',
    },
    ambient: DESERT_AMBIENT,
    build: buildDesert,
  },
  snow: {
    seed: 4242,
    controlPoints: [
      [140, -40, 0], [150, 60, 2.0], [90, 120, 3.0], [20, 100, 2.0],
      [-10, 140, 1.0], [-90, 140, 0], [-150, 80, -1.2], [-120, 0, -2.0],
      [-170, -70, -1.0], [-80, -130, 0], [10, -120, 1.0], [40, -70, 2.0],
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
    road: { base: '#7d8a94', light: '#9aa7b1', dark: '#616d77', tint: [0.82, 0.88, 0.99], wet: 0.55 },
    offroad: { base: '#f2f7fc', light: '#ffffff', dark: '#d3deea' },
    palette: {
      post: 0xdfe8f0, accent: 0x6fb7ff, bannerBg: '#1f5f8f', stand: 0x9aa9b8,
      curbA: '#2f80ff', curbB: '#f2f2f2', wallA: '#f4f8fb', wallB: '#2f80ff',
      padA: '#39d0ff', padB: '#eafcff',
    },
    ambient: SNOW_AMBIENT,
    build: buildSnow,
  },
};

export function createTrack(scene, trackId, opts = {}) {
  const def = TRACKS.find((t) => t.id === trackId) || TRACKS[0];
  const cfg = TRACK_CONFIG[def.id] || TRACK_CONFIG.meadow;
  const ambient = cfg.ambient;
  const rnd = mulberry32(cfg.seed);

  // Anisotropía del renderer (o 8 si no hay) antes de generar texturas.
  const renderer = findRenderer(opts);
  setMaxAnisotropy(renderer ? renderer.capabilities.getMaxAnisotropy() : 8);

  const group = new THREE.Group();
  group.name = `track:${def.id}`;
  const updaters = [];

  const half = ROAD_WIDTH / 2;
  const WALL_LAT = half + BAND;

  // --- Curva central (CatmullRom centripeta cerrada) ---
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
  const sampleSpacing = (() => {
    let l = 0;
    for (let i = 0; i < N; i++) l += samples[i].pos.distanceTo(samples[(i + 1) % N].pos);
    return l / N;
  })();

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

  // Contexto compartido para el terreno y los temas.
  const ctx = {
    samples,
    half,
    band: BAND,
    isOnTrack,
    nearestSampleXZ,
    rnd,
    length,
    centroid,
    sampleAt,
    sampleSpacing,
    WALL_LAT,
  };

  // ----------------------------------------------------------------
  // Terreno procedural (define heightAt para todo lo demás).
  // ----------------------------------------------------------------
  const terrain = buildTerrain(ctx, ambient);
  ctx.heightAt = terrain.heightAt;
  group.add(terrain.mesh);

  // ----------------------------------------------------------------
  // Cielo atmosférico, entorno PBR y luces.
  // ----------------------------------------------------------------
  const sky = buildSky(scene, ambient, centroid, opts);
  group.add(sky.group);

  // ----------------------------------------------------------------
  // Malla: carretera, bordillos, offroad, muros, marcas.
  // ----------------------------------------------------------------
  const roadCfg = cfg.road;
  const asphalt = asphaltMaps(1024, cfg.seed, { tint: roadCfg.tint, wet: roadCfg.wet || 0 });
  for (const t of [asphalt.map, asphalt.normalMap, asphalt.roughnessMap]) t.repeat.set(4, 3);
  const roadCommon = {
    map: asphalt.map,
    normalMap: asphalt.normalMap,
    normalScale: new THREE.Vector2(0.8, 0.8),
    roughnessMap: asphalt.roughnessMap,
    roughness: 1.0,
    metalness: 0.0,
    side: THREE.DoubleSide,
    envMapIntensity: 0.7 + 0.4 * (roadCfg.wet || 0),
  };
  const roadMat =
    (roadCfg.wet || 0) > 0
      ? new THREE.MeshPhysicalMaterial({
          ...roadCommon,
          clearcoat: 0.5 * roadCfg.wet,
          clearcoatRoughness: 0.55,
        })
      : new THREE.MeshStandardMaterial(roadCommon);
  const rb = new MeshBuilder();
  addRibbon(rb, samples, { latA: half, latB: -half, vScale: 16, close: true });
  const road = new THREE.Mesh(rb.geometry(), roadMat);
  road.receiveShadow = true;
  road.name = 'road';
  group.add(road);

  const curbs = curbMaps(cfg.palette.curbA, cfg.palette.curbB, cfg.seed + 2);
  const curbMat = new THREE.MeshStandardMaterial({
    map: curbs.map,
    normalMap: curbs.normalMap,
    normalScale: new THREE.Vector2(1.0, 1.0),
    roughness: 0.7,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
  const cb = new MeshBuilder();
  addRibbon(cb, samples, { latA: half, latB: half + CURB, yA: 0.03, yB: 0.09, vScale: 2.4, close: true });
  addRibbon(cb, samples, { latA: -half, latB: -half - CURB, yA: 0.03, yB: 0.09, vScale: 2.4, close: true });
  const curbsMesh = new THREE.Mesh(cb.geometry(), curbMat);
  curbsMesh.receiveShadow = true;
  group.add(curbsMesh);

  const offTex = grainTex(cfg.offroad.base, cfg.offroad.light, cfg.offroad.dark, cfg.seed + 5, 2600);
  offTex.repeat.set(6, 1);
  const offNormal = terrainNormal(ambient.terrain.detailNormal, 256, cfg.seed + 12);
  offNormal.repeat.set(6, 40);
  const offMat = new THREE.MeshStandardMaterial({
    map: offTex,
    normalMap: offNormal,
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughness: 0.95,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
  const ob = new MeshBuilder();
  addRibbon(ob, samples, { latA: half + CURB, latB: half + BAND, yA: 0.02, yB: -0.16, vScale: 22, close: true });
  addRibbon(ob, samples, { latA: -half - CURB, latB: -half - BAND, yA: 0.02, yB: -0.16, vScale: 22, close: true });
  const offroad = new THREE.Mesh(ob.geometry(), offMat);
  offroad.receiveShadow = true;
  group.add(offroad);

  // Muros con relieve metálico y desgaste.
  const wallMaps = curbMaps(cfg.palette.wallA, cfg.palette.wallB, cfg.seed + 7);
  const wallMat = new THREE.MeshStandardMaterial({
    map: wallMaps.map,
    normalMap: wallMaps.normalMap,
    normalScale: new THREE.Vector2(0.8, 0.8),
    roughness: 0.6,
    metalness: 0.15,
    side: THREE.DoubleSide,
  });
  const wb = new MeshBuilder();
  addWall(wb, samples, { lat: WALL_LAT, yBottom: -2.4, yTop: 1.6, vScale: 6, close: true });
  addWall(wb, samples, { lat: -WALL_LAT, yBottom: -2.4, yTop: 1.6, vScale: 6, close: true });
  const walls = new THREE.Mesh(wb.geometry(), wallMat);
  walls.receiveShadow = true;
  group.add(walls);

  // Líneas viales con pintura gastada.
  const wear = wearAlphaTex(cfg.seed + 4);
  wear.repeat.set(1, 3);
  const lineMat = new THREE.MeshStandardMaterial({
    color: 0xf2f2f2,
    roughness: 0.65,
    metalness: 0.0,
    alphaMap: wear,
    transparent: true,
    alphaTest: 0.35,
    side: THREE.DoubleSide,
  });
  const lb = new MeshBuilder();
  addDashes(lb, samples, { lat: 0, halfW: 0.18, dashLen: 3, gapLen: 6, yLift: 0.05 });
  group.add(new THREE.Mesh(lb.geometry(), lineMat));

  // Línea de meta a cuadros (pintura desgastada).
  const startTex = checkerTex(2, '#f4f4f4', '#141414');
  startTex.wrapS = THREE.RepeatWrapping;
  startTex.wrapT = THREE.RepeatWrapping;
  startTex.repeat.set(12, 1);
  const startWear = wearAlphaTex(cfg.seed + 8);
  startWear.repeat.set(12, 1);
  const startMat = new THREE.MeshStandardMaterial({
    map: startTex,
    alphaMap: startWear,
    transparent: true,
    alphaTest: 0.3,
    roughness: 0.6,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
  const sb = new MeshBuilder();
  addRibbon(sb, samples, { start: 0, count: 3, latA: half, latB: -half, vScale: 4, close: false });
  group.add(new THREE.Mesh(sb.geometry(), startMat));

  // Placas de turbo (chevrones emisivos animados).
  const padTex = boostTex(cfg.palette.padA, cfg.palette.padB);
  padTex.repeat.set(1, 2);
  const padMat = new THREE.MeshStandardMaterial({
    map: padTex,
    emissive: 0xffffff,
    emissiveMap: padTex,
    emissiveIntensity: 0.8,
    transparent: true,
    depthWrite: false,
    roughness: 0.5,
    side: THREE.DoubleSide,
  });
  const padBuilder = new MeshBuilder();
  for (const p of cfg.boostPads) {
    const start = Math.floor(wrap01(p.tc - p.th) * N);
    const count = Math.max(2, Math.ceil(p.th * 2 * N) + 1);
    addRibbon(padBuilder, samples, {
      start, count, latA: p.lat + p.hw, latB: p.lat - p.hw, yA: 0.06, yB: 0.06, vScale: 2.6, close: false,
    });
  }
  group.add(new THREE.Mesh(padBuilder.geometry(), padMat));

  // Flechas pintadas en las rampas.
  const arrowMat = new THREE.MeshStandardMaterial({
    map: arrowTex(),
    emissive: 0xffffff,
    emissiveMap: arrowTex(),
    emissiveIntensity: 0.5,
    transparent: true,
    depthWrite: false,
    roughness: 0.6,
    side: THREE.DoubleSide,
  });
  const arrowBuilder = new MeshBuilder();
  for (const r of ramps) {
    const start = Math.floor(r.f0 * N);
    const count = Math.max(2, Math.ceil((r.f1 - r.f0) * N));
    addRibbon(arrowBuilder, samples, {
      start, count, latA: half * 0.5, latB: -half * 0.5, yA: 0.07, yB: 0.07, vScale: 2.4, close: false,
    });
  }
  group.add(new THREE.Mesh(arrowBuilder.geometry(), arrowMat));
  updaters.push((dt) => {
    padTex.offset.y -= dt * 0.7;
  });

  // ----------------------------------------------------------------
  // Cajas de objetos (solo posiciones; las dibuja el bloque de objetos).
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
      addGroundQuad(gb, slot.position.x, slot.position.y, slot.position.z, slot.heading, 1.0, 2.4, 0.055);
    }
    group.add(
      new THREE.Mesh(
        gb.geometry(),
        new THREE.MeshStandardMaterial({ color: 0xffe14d, roughness: 0.6, metalness: 0.0, side: THREE.DoubleSide })
      )
    );
  }

  // ----------------------------------------------------------------
  // Escenario temático (props del bioma).
  // ----------------------------------------------------------------
  const theme = cfg.build(ctx);
  group.add(theme.group);
  if (theme.update) updaters.push(theme.update);

  // ----------------------------------------------------------------
  // Estructuras comunes.
  // ----------------------------------------------------------------
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
      const ycomp = f1z * f2x - f1x * f2z;
      const dot = clamp(f1x * f2x + f1z * f2z, -1, 1);
      const ang = Math.acos(dot);
      const sign = ycomp >= 0 ? 1 : -1;
      const offset = sign * Math.min(0.3 * half, ang * 26);
      const maxOff = half - 1.2;
      const lat = clamp(offset, -maxOff, maxOff);
      out.push(new THREE.Vector3(sa.pos.x + sa.left.x * lat, sa.pos.y, sa.pos.z + sa.left.z * lat));
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
    sky.dispose();
    terrain.material.dispose();
    terrain.mesh.geometry.dispose();
    for (const t of [asphalt.map, asphalt.normalMap, asphalt.roughnessMap, curbs.map, curbs.normalMap,
      wallMaps.map, wallMaps.normalMap, offNormal, offTex, padTex, startTex, wear, startWear]) {
      if (t) t.dispose();
    }
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
    // extras (contrato §9.2 y utilidades)
    sunLight: sky.sunLight,
    ambient,
    heightAt: terrain.heightAt,
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
