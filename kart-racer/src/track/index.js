// BLOQUE 1 reemplazará este stub. Mantener la API exacta (§4.1).
// Circuito ovalado simple, plano, con proyección real sobre la línea central.

import * as THREE from 'three';
import { ROAD_WIDTH } from '../shared/constants.js';
import { TRACKS } from '../shared/tracks.js';

const SAMPLE_COUNT = 400;
const OFFROAD_BAND = 8; // metros extra antes del muro

function makeColor(hex) {
  return new THREE.Color(hex);
}

export function createTrack(scene, trackId) {
  const def = TRACKS.find((t) => t.id === trackId) || TRACKS[0];
  const group = new THREE.Group();
  group.name = `track:${def.id}`;

  const roadWidth = ROAD_WIDTH;
  const half = roadWidth / 2;

  // --- Línea central: óvalo casi circular (~radio 120 m) ---
  const controlPoints = [];
  const CN = 10;
  for (let i = 0; i < CN; i++) {
    const a = (i / CN) * Math.PI * 2;
    const rx = 150 + Math.sin(i * 1.7) * 20;
    const rz = 105 + Math.cos(i * 2.1) * 16;
    controlPoints.push(new THREE.Vector3(Math.cos(a) * rx, 0, Math.sin(a) * rz));
  }
  const curve = new THREE.CatmullRomCurve3(controlPoints, true, 'catmullrom', 0.5);
  const length = curve.getLength();

  const up = new THREE.Vector3(0, 1, 0);
  const samples = [];
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const t = i / SAMPLE_COUNT;
    const pos = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const left = up.clone().cross(tangent).normalize();
    samples.push({ t, pos, tangent, left });
  }

  // --- Suelo y carretera ---
  const groundGeo = new THREE.PlaneGeometry(4000, 4000);
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x4fbf58 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.06;
  ground.receiveShadow = true;
  group.add(ground);

  const roadPositions = [];
  const roadIndices = [];
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const s = samples[i];
    const l = s.pos.clone().addScaledVector(s.left, half);
    const r = s.pos.clone().addScaledVector(s.left, -half);
    roadPositions.push(l.x, l.y + 0.01, l.z, r.x, r.y + 0.01, r.z);
  }
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const a = i * 2;
    const b = i * 2 + 1;
    const c = ((i + 1) % SAMPLE_COUNT) * 2;
    const d = c + 1;
    roadIndices.push(a, c, b, b, c, d);
  }
  const roadGeo = new THREE.BufferGeometry();
  roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadPositions, 3));
  roadGeo.setIndex(roadIndices);
  roadGeo.computeVertexNormals();
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x6b6f76, side: THREE.DoubleSide });
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.receiveShadow = true;
  group.add(road);

  // --- Luces ---
  const hemi = new THREE.HemisphereLight(0xbfe6ff, 0x3a5f2a, 1.0);
  group.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2.0);
  sun.position.set(120, 220, 80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -260;
  sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260;
  sun.shadow.camera.bottom = -260;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 900;
  group.add(sun);
  group.add(sun.target);

  // --- Cajas de objetos (6) ---
  const itemBoxPositions = [];
  const boxGeo = new THREE.BoxGeometry(1.6, 1.6, 1.6);
  const boxMat = new THREE.MeshLambertMaterial({ color: 0xffd23f, transparent: true, opacity: 0.85 });
  const boxMesh = new THREE.InstancedMesh(boxGeo, boxMat, 6);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 6; i++) {
    const t = (i / 6 + 0.17) % 1;
    const p = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const left = up.clone().cross(tangent).normalize();
    const lat = i % 2 === 0 ? 4 : -4;
    const pos = p.clone().addScaledVector(left, lat);
    pos.y = 1;
    itemBoxPositions.push(pos.clone());
    dummy.position.copy(pos);
    dummy.updateMatrix();
    boxMesh.setMatrixAt(i, dummy.matrix);
  }
  boxMesh.instanceMatrix.needsUpdate = true;
  group.add(boxMesh);

  // --- Fondo y niebla ---
  const skyColor = makeColor(0x87c9ff);
  scene.background = skyColor;
  scene.fog = new THREE.Fog(skyColor.getHex(), 260, 1400);

  scene.add(group);

  // ---------------------------------------------------------------
  // Proyección
  // ---------------------------------------------------------------
  function nearestIndex(pos, hintT) {
    let start = 0;
    let end = SAMPLE_COUNT;
    let best = -1;
    let bestD = Infinity;

    if (hintT != null && isFinite(hintT)) {
      const center = Math.floor((((hintT % 1) + 1) % 1) * SAMPLE_COUNT);
      start = center - 30;
      end = center + 31;
      for (let i = start; i < end; i++) {
        const idx = ((i % SAMPLE_COUNT) + SAMPLE_COUNT) % SAMPLE_COUNT;
        const p = samples[idx].pos;
        const dx = pos.x - p.x;
        const dz = pos.z - p.z;
        const d = dx * dx + dz * dz;
        if (d < bestD) {
          bestD = d;
          best = idx;
        }
      }
      // Si el resultado local está muy lejos, el hint no es fiable.
      if (bestD < 80 * 80) return best;
      best = -1;
      bestD = Infinity;
    }

    for (let i = 0; i < SAMPLE_COUNT; i++) {
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
    const a = samples[idx].pos;
    const b = samples[(idx + 1) % SAMPLE_COUNT].pos;
    const abx = b.x - a.x;
    const abz = b.z - a.z;
    const apx = pos.x - a.x;
    const apz = pos.z - a.z;
    const segLen2 = abx * abx + abz * abz;
    let u = segLen2 > 1e-6 ? (apx * abx + apz * abz) / segLen2 : 0;
    u = Math.max(0, Math.min(1, u));

    const t = (((idx + u) / SAMPLE_COUNT) % 1 + 1) % 1;

    const base = samples[idx];
    const center = new THREE.Vector3(a.x + abx * u, 0, a.z + abz * u);
    const tangent = base.tangent.clone();
    const left = base.left.clone();

    const dx = pos.x - center.x;
    const dz = pos.z - center.z;
    const lateral = dx * left.x + dz * left.z;

    let surface = 'road';
    const absLat = Math.abs(lateral);
    if (absLat > half + OFFROAD_BAND) surface = 'wall';
    else if (absLat > half) surface = 'offroad';

    const wallNormal =
      surface === 'wall' ? left.clone().multiplyScalar(-Math.sign(lateral)) : null;

    return {
      t,
      lateral,
      surface,
      groundY: 0,
      tangent,
      wallNormal,
      center,
    };
  }

  function getPointAt(t) {
    return curve.getPointAt((((t % 1) + 1) % 1));
  }

  function getStartGrid(n) {
    const grid = [];
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / 2);
      const col = i % 2;
      const t = (((1 - (row + 1) * 0.012) % 1) + 1) % 1;
      const p = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t).normalize();
      const left = up.clone().cross(tangent).normalize();
      const lat = col === 0 ? 3.2 : -3.2;
      const position = p.clone().addScaledVector(left, lat);
      position.y = 0;
      const heading = Math.atan2(tangent.x, tangent.z);
      grid.push({ position, heading });
    }
    return grid;
  }

  function getRacingLine() {
    const line = [];
    const count = 300;
    for (let i = 0; i < count; i++) {
      line.push(curve.getPointAt(i / count).clone());
    }
    return line;
  }

  function getMinimapPoints() {
    const pts = [];
    const count = 200;
    for (let i = 0; i < count; i++) {
      const p = curve.getPointAt(i / count);
      pts.push({ x: p.x, z: p.z });
    }
    return pts;
  }

  function dispose() {
    scene.remove(group);
    groundGeo.dispose();
    groundMat.dispose();
    roadGeo.dispose();
    roadMat.dispose();
    boxGeo.dispose();
    boxMat.dispose();
  }

  return {
    id: def.id,
    name: def.name,
    musicId: def.musicId,
    group,
    length,
    roadWidth,
    getStartGrid,
    projectToTrack,
    isOnBoostPad: () => false,
    isOnRamp: () => false,
    itemBoxPositions,
    getRacingLine,
    getPointAt,
    getMinimapPoints,
    update: () => {},
    dispose,
  };
}
