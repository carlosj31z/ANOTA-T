// BLOQUE 1 — Circuito "Cumbre Helada": nieve, pinos, montañas, hielo, nieve cayendo, aurora.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { scatterPositions, MeshBuilder, addGroundQuad } from './builder.js';

export function buildSnow(ctx) {
  const { rnd, samples, half, band, isOnTrack, sampleAt, centroid } = ctx;
  const group = new THREE.Group();
  const updaters = [];
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  const blocksRoad = (m) => (x, z) => isOnTrack(x, z, m);

  // -------------------- Pinos nevados --------------------
  const trunkGeo = new THREE.CylinderGeometry(0.28, 0.4, 1.6, 6).translate(0, 0.8, 0);
  const greenGeo = mergeGeometries([
    new THREE.ConeGeometry(2.0, 3.0, 7).translate(0, 2.4, 0),
    new THREE.ConeGeometry(1.5, 2.6, 7).translate(0, 4.0, 0),
    new THREE.ConeGeometry(1.0, 2.2, 7).translate(0, 5.5, 0),
  ]);
  const snowGeo = mergeGeometries([
    new THREE.ConeGeometry(1.55, 1.0, 7).translate(0, 3.7, 0),
    new THREE.ConeGeometry(1.05, 0.9, 7).translate(0, 5.2, 0),
    new THREE.ConeGeometry(0.7, 0.8, 7).translate(0, 6.5, 0),
  ]);
  const pinePos = scatterPositions(rnd, 180, { minR: 30, maxR: 340, isOnTrack: blocksRoad(6) });
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a4632 });
  const greenMat = new THREE.MeshLambertMaterial({ color: 0x2f6b45, flatShading: true });
  const snowCapMat = new THREE.MeshLambertMaterial({ color: 0xf4f8fb, flatShading: true });
  const pines = new THREE.InstancedMesh(greenGeo, greenMat, pinePos.length);
  const pinesSnow = new THREE.InstancedMesh(snowGeo, snowCapMat, pinePos.length);
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, pinePos.length);
  pines.castShadow = true;
  for (let i = 0; i < pinePos.length; i++) {
    const p = pinePos[i];
    const s = 0.85 + rnd() * 0.9;
    dummy.position.set(p.x, 0, p.z);
    dummy.rotation.set(0, p.a, 0);
    dummy.scale.set(s, 0.9 + rnd() * 0.6, s);
    dummy.updateMatrix();
    pines.setMatrixAt(i, dummy.matrix);
    pinesSnow.setMatrixAt(i, dummy.matrix);
    trunks.setMatrixAt(i, dummy.matrix);
  }
  group.add(pines, pinesSnow, trunks);

  // -------------------- Montañas al fondo --------------------
  const mountainGeo = new THREE.ConeGeometry(1, 1, 6);
  const mountainMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  const mountains = new THREE.InstancedMesh(mountainGeo, mountainMat, 22);
  mountains.castShadow = false;
  for (let i = 0; i < 22; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 900 + rnd() * 350;
    const s = 180 + rnd() * 220;
    dummy.position.set(Math.cos(a) * r, s * 0.5 - 20, Math.sin(a) * r);
    dummy.rotation.set(0, rnd() * Math.PI, 0);
    dummy.scale.set(s * (0.7 + rnd() * 0.5), s, s * (0.7 + rnd() * 0.5));
    dummy.updateMatrix();
    mountains.setMatrixAt(i, dummy.matrix);
    mountains.setColorAt(i, col.setHex(rnd() < 0.4 ? 0xdbe7f0 : 0xf6fbff));
  }
  if (mountains.instanceColor) mountains.instanceColor.needsUpdate = true;
  group.add(mountains);

  // -------------------- Témpanos de hielo en la pista --------------------
  const iceBuilder = new MeshBuilder();
  for (let i = 0; i < 26; i++) {
    const t = rnd();
    const sa = sampleAt(t);
    const lat = (rnd() - 0.5) * (half * 1.5);
    const y = sa.pos.y + 0.02;
    const cx = sa.pos.x + sa.left.x * lat;
    const cz = sa.pos.z + sa.left.z * lat;
    const heading = Math.atan2(sa.tangent.x, sa.tangent.z) + (rnd() - 0.5) * 0.4;
    addGroundQuad(iceBuilder, cx, y, cz, heading, 1.5 + rnd() * 2.5, 2 + rnd() * 5, 0.0);
  }
  const ice = new THREE.Mesh(
    iceBuilder.geometry(),
    new THREE.MeshLambertMaterial({ color: 0xaccbe6, transparent: true, opacity: 0.7, side: THREE.DoubleSide })
  );
  group.add(ice);

  // -------------------- Túnel/puente de hielo --------------------
  const tunnelT = 0.5;
  const ts = sampleAt(tunnelT);
  const tHeading = Math.atan2(ts.tangent.x, ts.tangent.z);
  const tunnel = new THREE.Group();
  const shellMat = new THREE.MeshLambertMaterial({
    color: 0xbfe0f2,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
    flatShading: true,
  });
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 30, 18, 1, true, 0, Math.PI), shellMat);
  shell.rotation.z = Math.PI / 2;
  shell.rotation.y = Math.PI / 2;
  tunnel.add(shell);
  const beamMat = new THREE.MeshLambertMaterial({ color: 0xe8f4fb, flatShading: true });
  for (let i = -1; i <= 1; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(13, 0.6, 6, 16, Math.PI), beamMat);
    rib.rotation.z = 0;
    rib.position.y = 0;
    rib.rotation.y = Math.PI / 2;
    rib.position.z = i * 12;
    tunnel.add(rib);
  }
  tunnel.position.copy(ts.pos);
  tunnel.rotation.y = tHeading;
  group.add(tunnel);

  // -------------------- Nieve cayendo --------------------
  const SNOW = 1900;
  const snowGeoPts = new THREE.BufferGeometry();
  const snowArr = new Float32Array(SNOW * 3);
  const snowVel = new Float32Array(SNOW);
  const cx0 = centroid.x;
  const cz0 = centroid.z;
  for (let i = 0; i < SNOW; i++) {
    snowArr[i * 3] = cx0 + (rnd() - 0.5) * 620;
    snowArr[i * 3 + 1] = rnd() * 150;
    snowArr[i * 3 + 2] = cz0 + (rnd() - 0.5) * 620;
    snowVel[i] = 6 + rnd() * 10;
  }
  snowGeoPts.setAttribute('position', new THREE.BufferAttribute(snowArr, 3));
  const snowMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.55,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const snowPts = new THREE.Points(snowGeoPts, snowMat);
  snowPts.frustumCulled = false;
  group.add(snowPts);
  updaters.push((dt, time) => {
    for (let i = 0; i < SNOW; i++) {
      let y = snowArr[i * 3 + 1] - snowVel[i] * dt;
      snowArr[i * 3] += Math.sin(time * 0.8 + i) * dt * 3;
      if (y < 0) {
        y = 150 + rnd() * 20;
        snowArr[i * 3] = cx0 + (rnd() - 0.5) * 620;
        snowArr[i * 3 + 2] = cz0 + (rnd() - 0.5) * 620;
      }
      snowArr[i * 3 + 1] = y;
    }
    snowGeoPts.attributes.position.needsUpdate = true;
  });

  // -------------------- Aurora boreal (shader) --------------------
  const auroraMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    fog: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      void main() {
        float bands = 0.0;
        bands += sin(vUv.x * 18.0 + uTime * 0.6) * 0.5 + 0.5;
        bands *= sin(vUv.x * 7.0 - uTime * 0.3) * 0.5 + 0.5;
        float curtain = pow(1.0 - abs(vUv.y - 0.7), 1.6);
        float a = bands * curtain * 0.5;
        vec3 c1 = vec3(0.25, 1.0, 0.6);
        vec3 c2 = vec3(0.5, 0.4, 1.0);
        vec3 c = mix(c1, c2, vUv.x);
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

  const ambient = {
    background: 0x2b3a6a,
    skyStops: [
      [0, '#141a3a'],
      [0.35, '#2c3f74'],
      [0.62, '#5568a8'],
      [0.82, '#9fb2d8'],
      [1, '#e6eef8'],
    ],
    fog: 0xdfe9f4,
    fogNear: 180,
    fogFar: 1150,
    terrainBase: '#eef4fa',
    terrainLight: '#ffffff',
    terrainDark: '#cdd9e6',
    sunColor: 0xeaf2ff,
    sunIntensity: 1.9,
    hemiSky: 0xcfe2ff,
    hemiGround: 0x8fa3bd,
    hemiIntensity: 1.05,
    sunDir: [-0.4, 0.65, 0.55],
    sunVisual: '#eef4ff',
    terrainColor: (x, z, h) => {
      const t = Math.min(1, Math.max(0, h / 30));
      return col.setRGB(0.9 - t * 0.18, 0.93 - t * 0.12, 0.98 - t * 0.05);
    },
  };

  function update(dt, time) {
    for (const u of updaters) u(dt, time);
  }

  return { group, update, ambient };
}
