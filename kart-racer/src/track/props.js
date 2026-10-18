// BLOQUE 1 — CIRCUITOS. Detalles de ambiente: banderas que ondean, globos,
// nubes, polvo flotante (desierto), copos de nieve y mariposas (pradera).
// Todo reutilizable e instanciado para no disparar draw calls.

import * as THREE from 'three';
import { mergeGeo, mulberry32 } from './procgen.js';
import { applyFlagWave, setWindTime } from './materials.js';

const _dummy = new THREE.Object3D();
const _col = new THREE.Color();

// ---------------------------------------------------------------------
// Banderas a lo largo del circuito: mástil + tela que ondea (shader).
// ---------------------------------------------------------------------
export function buildTracksideFlags(samples, opts = {}) {
  const {
    lat = null,
    spacing = 14,
    height = 3.9,
    width = 1.5,
    clothH = 0.9,
    poleColor = 0x8f8f8f,
    colors = [0xff3b3b, 0xffd23f, 0x2f80ff, 0x37d67a, 0xffffff],
    seed = 4,
    sideSign = 1,
  } = opts;
  const rnd = mulberry32(seed);
  const group = new THREE.Group();
  const n = samples.length;
  const step = Math.max(1, Math.floor(spacing / (opts.sampleSpacing || 1.8)));
  const spots = [];
  for (let i = 0; i < n; i += step) {
    if (rnd() < 0.25) continue;
    const s = samples[i];
    const lateral = lat == null ? (opts.half + 6) * sideSign : lat * sideSign;
    spots.push({
      x: s.pos.x + s.left.x * lateral,
      y: s.pos.y,
      z: s.pos.z + s.left.z * lateral,
      heading: Math.atan2(s.tangent.x, s.tangent.z),
      color: colors[Math.floor(rnd() * colors.length)],
      phase: rnd() * Math.PI * 2,
    });
  }

  const poleGeo = new THREE.CylinderGeometry(0.06, 0.09, height, 6);
  poleGeo.translate(0, height / 2, 0);
  const poleMat = new THREE.MeshStandardMaterial({ color: poleColor, roughness: 0.5, metalness: 0.6 });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, Math.max(1, spots.length));
  poles.castShadow = true;

  const clothGeo = new THREE.PlaneGeometry(width, clothH, 6, 2);
  clothGeo.translate(width / 2, 0, 0);
  const clothMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    roughness: 0.8,
    metalness: 0.0,
    vertexColors: false,
  });
  applyFlagWave(clothMat, { strength: 0.55, speed: 2.4, scale: 0.5, freeAxis: 'x' });
  const cloths = new THREE.InstancedMesh(clothGeo, clothMat, Math.max(1, spots.length));
  cloths.castShadow = false;

  for (let i = 0; i < spots.length; i++) {
    const p = spots[i];
    _dummy.position.set(p.x, p.y, p.z);
    _dummy.rotation.set(0, p.heading, 0);
    _dummy.scale.set(1, 1, 1);
    _dummy.updateMatrix();
    poles.setMatrixAt(i, _dummy.matrix);
    _dummy.position.y = p.y + height - clothH / 2 - 0.1;
    _dummy.updateMatrix();
    cloths.setMatrixAt(i, _dummy.matrix);
    cloths.setColorAt(i, _col.setHex(p.color));
  }
  poles.count = spots.length;
  cloths.count = spots.length;
  poles.instanceMatrix.needsUpdate = true;
  cloths.instanceMatrix.needsUpdate = true;
  if (cloths.instanceColor) cloths.instanceColor.needsUpdate = true;
  group.add(poles, cloths);
  return { group, material: clothMat };
}

// ---------------------------------------------------------------------
// Globos aerostáticos (pradera).
// ---------------------------------------------------------------------
export function buildBalloons(rnd, opts = {}) {
  const count = opts.count ?? 6;
  const geo = mergeGeo([
    new THREE.SphereGeometry(2.6, 14, 12).scale(1, 1.25, 1),
    new THREE.CylinderGeometry(0.5, 0.4, 0.5, 8).translate(0, -3.4, 0),
    new THREE.BoxGeometry(1.3, 1.0, 1.3).translate(0, -4.2, 0),
  ]);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.0 });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.castShadow = true;
  const palette = [0xff6b6b, 0xffd23f, 0x4fd1ff, 0x6be36b, 0xff8ad8, 0xffa33f];
  const data = [];
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 90 + rnd() * 240;
    data.push({
      x: Math.cos(a) * r,
      y: 30 + rnd() * 28,
      z: Math.sin(a) * r,
      phase: rnd() * Math.PI * 2,
      v: 0.5 + rnd() * 0.7,
    });
    mesh.setColorAt(i, _col.setHex(palette[i % palette.length]));
  }
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

  function update(dt, time) {
    for (let i = 0; i < data.length; i++) {
      const b = data[i];
      b.x += b.v * dt;
      if (b.x > 420) b.x = -420;
      _dummy.position.set(b.x, b.y + Math.sin(time * 0.6 + b.phase) * 1.7, b.z);
      _dummy.rotation.set(0, 0, 0);
      _dummy.scale.setScalar(1);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
  update(0, 0);
  return { group: mesh, update };
}

// ---------------------------------------------------------------------
// Nubes (pradera): cúmulos suaves que derivan.
// ---------------------------------------------------------------------
export function buildClouds(rnd, opts = {}) {
  const count = opts.count ?? 16;
  const geo = mergeGeo([
    new THREE.IcosahedronGeometry(3.4, 1),
    new THREE.IcosahedronGeometry(2.6, 1).translate(3.6, 0.4, 0.4),
    new THREE.IcosahedronGeometry(2.8, 1).translate(-3.4, 0.2, -0.3),
    new THREE.IcosahedronGeometry(2.1, 1).translate(0.6, 1.4, 0.2),
  ]);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1.0, metalness: 0.0, flatShading: false });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const data = [];
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 140 + rnd() * 700;
    data.push({ x: Math.cos(a) * r, y: 90 + rnd() * 60, z: Math.sin(a) * r, s: 1.5 + rnd() * 2.2, v: 1.2 + rnd() * 2 });
  }
  function update(dt) {
    for (let i = 0; i < data.length; i++) {
      const c = data[i];
      c.x += c.v * dt;
      if (c.x > 950) c.x = -950;
      _dummy.position.set(c.x, c.y, c.z);
      _dummy.rotation.set(0, 0, 0);
      _dummy.scale.setScalar(c.s);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
  update(0);
  return { group: mesh, update };
}

// ---------------------------------------------------------------------
// Polvo flotante en el aire (desierto).
// ---------------------------------------------------------------------
export function buildDust(cx, cz, count = 700, opts = {}) {
  const rnd = mulberry32(opts.seed ?? 13);
  const positions = new Float32Array(count * 3);
  const data = [];
  for (let i = 0; i < count; i++) {
    const x = cx + (rnd() - 0.5) * 640;
    const y = 0.5 + rnd() * 26;
    const z = cz + (rnd() - 0.5) * 640;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    data.push({ v: 0.4 + rnd() * 1.2, ph: rnd() * 6.28, sway: 0.5 + rnd() * 1.5 });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: opts.color ?? 0xe6c98a,
    size: opts.size ?? 0.5,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
    sizeAttenuation: true,
    fog: true,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  function update(dt, time) {
    for (let i = 0; i < count; i++) {
      const d = data[i];
      let y = positions[i * 3 + 1] + d.v * dt;
      positions[i * 3] += Math.sin(time * 0.5 + d.ph) * dt * d.sway;
      if (y > 30) {
        y = 0.4;
        positions[i * 3] = cx + (rnd() - 0.5) * 640;
        positions[i * 3 + 2] = cz + (rnd() - 0.5) * 640;
      }
      positions[i * 3 + 1] = y;
    }
    geo.attributes.position.needsUpdate = true;
  }
  return { group: pts, update };
}

// ---------------------------------------------------------------------
// Nieve cayendo con tamaño y velocidad variables (shader de puntos).
// ---------------------------------------------------------------------
export function buildSnowfall(cx, cz, count = 1600, opts = {}) {
  const rnd = mulberry32(opts.seed ?? 21);
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const speeds = new Float32Array(count);
  const range = opts.range ?? 300;
  const top = opts.top ?? 90;
  for (let i = 0; i < count; i++) {
    positions[i * 3] = cx + (rnd() - 0.5) * range * 2;
    positions[i * 3 + 1] = rnd() * top;
    positions[i * 3 + 2] = cz + (rnd() - 0.5) * range * 2;
    sizes[i] = 0.25 + rnd() * 0.7;
    speeds[i] = 3 + rnd() * 6;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uColor: { value: new THREE.Color(opts.color ?? 0xffffff) } },
    vertexShader: /* glsl */ `
      attribute float aSize;
      varying float vSize;
      void main() {
        vSize = aSize;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * 260.0 / max(-mv.z, 1.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vSize;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float r = length(d);
        if (r > 0.5) discard;
        float a = smoothstep(0.5, 0.15, r);
        gl_FragColor = vec4(uColor, a * 0.92);
      }
    `,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  function update(dt, time) {
    for (let i = 0; i < count; i++) {
      let y = positions[i * 3 + 1] - speeds[i] * dt;
      positions[i * 3] += Math.sin(time * 0.7 + i) * dt * 1.6;
      if (y < 0.2) {
        y = top;
        positions[i * 3] = cx + (rnd() - 0.5) * range * 2;
        positions[i * 3 + 2] = cz + (rnd() - 0.5) * range * 2;
      }
      positions[i * 3 + 1] = y;
    }
    geo.attributes.position.needsUpdate = true;
  }
  return { group: pts, update };
}

// ---------------------------------------------------------------------
// Mariposas (pradera): pequeñas alas que aletean y se desplazan.
// ---------------------------------------------------------------------
export function buildButterflies(rnd, positions, opts = {}) {
  const count = positions.length;
  if (count === 0) return { group: new THREE.Group(), update() {} };
  const geo = mergeGeo([
    new THREE.PlaneGeometry(0.32, 0.24).translate(-0.16, 0, 0),
    new THREE.PlaneGeometry(0.32, 0.24).translate(0.16, 0, 0),
  ]);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    roughness: 0.7,
    emissive: 0x221100,
    emissiveIntensity: 0.2,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const palette = [0xffd23f, 0xff8ad8, 0xffffff, 0x9a7bff, 0xffa33f];
  const data = positions.map((p) => ({
    x: p.x,
    y: p.y + 0.6 + rnd() * 0.6,
    z: p.z,
    ph: rnd() * 6.28,
    r: 3 + rnd() * 5,
    sp: 0.6 + rnd() * 0.8,
  }));
  for (let i = 0; i < count; i++) mesh.setColorAt(i, _col.setHex(palette[i % palette.length]));
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  function update(dt, time) {
    for (let i = 0; i < count; i++) {
      const b = data[i];
      const t = time * b.sp + b.ph;
      _dummy.position.set(
        b.x + Math.cos(t) * b.r,
        b.y + Math.sin(t * 2.2) * 0.5,
        b.z + Math.sin(t * 0.9) * b.r
      );
      _dummy.rotation.set(Math.sin(t * 1.7) * 0.3, t, 0);
      const flap = Math.abs(Math.sin(time * 12 + b.ph));
      _dummy.scale.set(1, 0.4 + flap * 0.6, 1);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
  update(0, 0);
  return { group: mesh, update };
}

export { setWindTime };
