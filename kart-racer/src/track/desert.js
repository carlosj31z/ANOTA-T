// BLOQUE 1 — Circuito "Dunas Doradas": arena, dunas, cactus, rocas, pirámide, oasis.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { scatterPositions } from './builder.js';
import { waterTex } from './textures.js';

export function buildDesert(ctx) {
  const { rnd, samples, half, band, isOnTrack } = ctx;
  const group = new THREE.Group();
  const updaters = [];
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();

  const blocksRoad = (m) => (x, z) => isOnTrack(x, z, m);

  // -------------------- Cactus --------------------
  const armGeo = (() => {
    const parts = [new THREE.CylinderGeometry(0.36, 0.44, 3.6, 7).translate(0, 1.8, 0)];
    const a1 = new THREE.CylinderGeometry(0.24, 0.26, 1.7, 6).translate(0, 0.85, 0);
    a1.rotateZ(Math.PI / 2);
    a1.translate(1.0, 2.1, 0);
    const up1 = new THREE.CylinderGeometry(0.24, 0.26, 1.6, 6).translate(0, 0.8, 0);
    up1.translate(1.8, 2.4, 0);
    const a2 = new THREE.CylinderGeometry(0.24, 0.26, 1.5, 6).translate(0, 0.75, 0);
    a2.rotateZ(Math.PI / 2);
    a2.translate(-0.9, 1.6, 0);
    const up2 = new THREE.CylinderGeometry(0.24, 0.26, 1.3, 6).translate(0, 0.65, 0);
    up2.translate(-1.6, 1.9, 0);
    parts.push(a1, up1, a2, up2);
    return mergeGeometries(parts);
  })();
  const cactusMat = new THREE.MeshLambertMaterial({ color: 0x3f8f4f });
  const cactusPos = scatterPositions(rnd, 90, { minR: 30, maxR: 320, isOnTrack: blocksRoad(6) });
  const cacti = new THREE.InstancedMesh(armGeo, cactusMat, cactusPos.length);
  cacti.castShadow = true;
  for (let i = 0; i < cactusPos.length; i++) {
    const p = cactusPos[i];
    const s = 0.7 + rnd() * 0.9;
    dummy.position.set(p.x, 0, p.z);
    dummy.rotation.set(0, p.a, 0);
    dummy.scale.set(s, 0.85 + rnd() * 0.7, s);
    dummy.updateMatrix();
    cacti.setMatrixAt(i, dummy.matrix);
  }
  group.add(cacti);

  // -------------------- Rocas y mesetas --------------------
  const rockGeo = new THREE.IcosahedronGeometry(1, 0);
  const rockMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  const rockPos = scatterPositions(rnd, 130, { minR: 26, maxR: 380, isOnTrack: blocksRoad(4) });
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockPos.length);
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  const rockTones = [0xb98a5a, 0xa8764a, 0xc99c6a, 0x8f6a45];
  for (let i = 0; i < rockPos.length; i++) {
    const p = rockPos[i];
    const s = 0.8 + rnd() * 3.2;
    dummy.position.set(p.x, s * 0.35, p.z);
    dummy.rotation.set(rnd() * 0.5, p.a, rnd() * 0.5);
    dummy.scale.set(s, s * (0.5 + rnd() * 0.5), s * (0.7 + rnd() * 0.6));
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
    rocks.setColorAt(i, col.setHex(rockTones[Math.floor(rnd() * rockTones.length)]));
  }
  if (rocks.instanceColor) rocks.instanceColor.needsUpdate = true;
  group.add(rocks);

  // Mesetas lejanas (cilindros de tapa plana).
  const mesaMat = new THREE.MeshLambertMaterial({ color: 0xa9764b, flatShading: true });
  for (let i = 0; i < 5; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 260 + rnd() * 320;
    const mesa = new THREE.Mesh(new THREE.CylinderGeometry(14 + rnd() * 16, 22 + rnd() * 20, 20 + rnd() * 22, 7), mesaMat);
    mesa.position.set(Math.cos(a) * r, 8, Math.sin(a) * r);
    mesa.rotation.y = rnd() * Math.PI;
    group.add(mesa);
  }

  // -------------------- Arco de roca --------------------
  const archMat = new THREE.MeshLambertMaterial({ color: 0xa8764a, flatShading: true });
  for (let i = 0; i < 3; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 200 + rnd() * 200;
    const arch = new THREE.Mesh(new THREE.TorusGeometry(6 + rnd() * 3, 1.8, 6, 12, Math.PI), archMat);
    arch.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    arch.rotation.y = rnd() * Math.PI;
    arch.castShadow = true;
    group.add(arch);
  }

  // -------------------- Pirámide escalonada lejana --------------------
  const pyr = new THREE.Group();
  const pyrMat = new THREE.MeshLambertMaterial({ color: 0xd8b26a, flatShading: true });
  for (let i = 0; i < 6; i++) {
    const w = 34 - i * 5;
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, 3.2, w), pyrMat);
    box.position.y = 1.6 + i * 3.2;
    box.rotation.y = i * 0.06;
    pyr.add(box);
  }
  const pyrA = 2.3;
  pyr.position.set(Math.cos(pyrA) * 430, 0, Math.sin(pyrA) * 430);
  pyr.rotation.y = pyrA;
  group.add(pyr);

  // -------------------- Oasis: estanque + palmeras --------------------
  const oasisA = rnd() * Math.PI * 2;
  const oasisR = 150 + rnd() * 60;
  const ox = Math.cos(oasisA) * oasisR;
  const oz = Math.sin(oasisA) * oasisR;
  const waterMap = waterTex();
  waterMap.repeat.set(4, 4);
  const pond = new THREE.Mesh(
    new THREE.CircleGeometry(16, 24),
    new THREE.MeshLambertMaterial({ map: waterMap, color: 0x8fd8ff, transparent: true, opacity: 0.92 })
  );
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(ox, 0.15, oz);
  group.add(pond);
  const sandRing = new THREE.Mesh(
    new THREE.RingGeometry(16, 24, 24),
    new THREE.MeshLambertMaterial({ color: 0xe8cf93 })
  );
  sandRing.rotation.x = -Math.PI / 2;
  sandRing.position.set(ox, 0.08, oz);
  group.add(sandRing);

  const palmGeo = (() => {
    const parts = [new THREE.CylinderGeometry(0.3, 0.45, 5.5, 6).translate(0, 2.75, 0)];
    for (let i = 0; i < 6; i++) {
      const frond = new THREE.BoxGeometry(3.4, 0.16, 0.9);
      frond.translate(1.7, 0, 0);
      frond.rotateZ(0.35);
      frond.rotateY((i / 6) * Math.PI * 2);
      frond.translate(0, 5.5, 0);
      parts.push(frond);
    }
    return mergeGeometries(parts);
  })();
  const palmMat = new THREE.MeshLambertMaterial({ color: 0x4f9b4a, flatShading: true });
  const palms = new THREE.InstancedMesh(palmGeo, palmMat, 14);
  palms.castShadow = true;
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + rnd();
    const r = 17 + rnd() * 4;
    dummy.position.set(ox + Math.cos(a) * r, 0, oz + Math.sin(a) * r);
    dummy.rotation.set(0, rnd() * Math.PI * 2, 0);
    dummy.scale.setScalar(0.85 + rnd() * 0.5);
    dummy.updateMatrix();
    palms.setMatrixAt(i, dummy.matrix);
  }
  group.add(palms);
  updaters.push((dt) => {
    waterMap.offset.y += dt * 0.04;
    waterMap.offset.x += dt * 0.015;
  });

  const ambient = {
    background: 0xf0b46a,
    skyStops: [
      [0, '#3f6fbf'],
      [0.4, '#e08a3a'],
      [0.7, '#f5b25a'],
      [1, '#ffe0a8'],
    ],
    fog: 0xf0c07a,
    fogNear: 240,
    fogFar: 1250,
    terrainBase: '#d9b26a',
    terrainLight: '#e8c887',
    terrainDark: '#b98d4d',
    sunColor: 0xfff0c8,
    sunIntensity: 2.7,
    hemiSky: 0xffe0b0,
    hemiGround: 0xb07a3a,
    hemiIntensity: 0.75,
    sunDir: [0.72, 0.6, 0.32],
    sunVisual: '#fff0c0',
    terrainColor: (x, z, h) => {
      const t = Math.min(1, Math.max(0, h / 26));
      return col.setRGB(0.84 - t * 0.12, 0.71 - t * 0.08, 0.42 + t * 0.08);
    },
    duneAmp: 16,
  };

  function update(dt, time) {
    for (const u of updaters) u(dt, time);
  }

  return { group, update, ambient };
}
