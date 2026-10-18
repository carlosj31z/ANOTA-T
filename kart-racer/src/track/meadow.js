// BLOQUE 1 — Circuito "Prado Turbo": hierba, colinas, árboles, flores, molino, nubes, globos.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { scatterPositions } from './builder.js';

function ico(r, d = 0) {
  return new THREE.IcosahedronGeometry(r, d);
}

export function buildMeadow(ctx) {
  const { rnd, samples, half, band, isOnTrack } = ctx;
  const group = new THREE.Group();
  const updaters = [];
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();

  // -------------------- Árboles --------------------
  const trunkGeo = new THREE.CylinderGeometry(0.32, 0.55, 3.4, 6);
  trunkGeo.translate(0, 1.7, 0);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2b });

  const foliageGeo = mergeGeometries([
    ico(2.4, 0).translate(0, 4.6, 0),
    ico(1.8, 0).translate(0.5, 5.9, 0.3),
    ico(1.4, 0).translate(-0.6, 6.5, -0.3),
  ]);
  const foliageMat = new THREE.MeshLambertMaterial({ color: 0xffffff });

  const treePos = scatterPositions(rnd, 200, {
    minR: 34,
    maxR: 330,
    isOnTrack: (x, z) => isOnTrack(x, z, 7),
  });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treePos.length);
  const foliage = new THREE.InstancedMesh(foliageGeo, foliageMat, treePos.length);
  trunks.castShadow = true;
  foliage.castShadow = true;
  const greens = [0x3f9b46, 0x2f8a3f, 0x4fb055, 0x57a83f];
  for (let i = 0; i < treePos.length; i++) {
    const p = treePos[i];
    const s = 0.8 + rnd() * 0.8;
    dummy.position.set(p.x, 0, p.z);
    dummy.rotation.set(0, p.a, 0);
    dummy.scale.set(s, s * (0.9 + rnd() * 0.3), s);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    foliage.setMatrixAt(i, dummy.matrix);
    foliage.setColorAt(i, col.setHex(greens[Math.floor(rnd() * greens.length)]));
  }
  group.add(trunks, foliage);

  // -------------------- Flores --------------------
  const flowerGeo = ico(0.28, 0);
  flowerGeo.translate(0, 0.3, 0);
  const flowerMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const flowers = scatterPositions(rnd, 320, {
    minR: 18,
    maxR: 240,
    isOnTrack: (x, z) => isOnTrack(x, z, 1.5),
  });
  const flowerMesh = new THREE.InstancedMesh(flowerGeo, flowerMat, flowers.length);
  const flowerColors = [0xff5a5a, 0xffd23f, 0xffffff, 0xff8ad8, 0xa06bff, 0xff9a3f];
  for (let i = 0; i < flowers.length; i++) {
    const p = flowers[i];
    dummy.position.set(p.x, 0, p.z);
    dummy.rotation.set(0, p.a, 0);
    dummy.scale.setScalar(0.7 + rnd() * 0.8);
    dummy.updateMatrix();
    flowerMesh.setMatrixAt(i, dummy.matrix);
    flowerMesh.setColorAt(i, col.setHex(flowerColors[Math.floor(rnd() * flowerColors.length)]));
  }
  group.add(flowerMesh);

  // -------------------- Molino de viento --------------------
  const mill = new THREE.Group();
  const towerGeo = new THREE.CylinderGeometry(1.1, 2.2, 14, 8);
  towerGeo.translate(0, 7, 0);
  const tower = new THREE.Mesh(towerGeo, new THREE.MeshLambertMaterial({ color: 0xf0ece0 }));
  tower.castShadow = true;
  mill.add(tower);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.1, 2.4, 8), new THREE.MeshLambertMaterial({ color: 0xc0392b }));
  roof.position.y = 15.2;
  roof.castShadow = true;
  mill.add(roof);
  const blades = new THREE.Group();
  const bladeGeo = new THREE.BoxGeometry(0.7, 8.5, 0.25);
  const bladeMat = new THREE.MeshLambertMaterial({ color: 0xf7f3e8 });
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(bladeGeo, bladeMat);
    b.position.set(0, 4.6, 0);
    b.castShadow = true;
    const holder = new THREE.Group();
    holder.add(b);
    holder.rotation.z = (i / 4) * Math.PI * 2;
    blades.add(holder);
  }
  blades.position.set(0, 12.5, 2.3);
  mill.add(blades);
  const millAngle = rnd() * Math.PI * 2;
  mill.position.set(Math.cos(millAngle) * 175, 0, Math.sin(millAngle) * 175);
  mill.rotation.y = millAngle + Math.PI;
  group.add(mill);
  updaters.push((dt) => {
    blades.rotation.z += dt * 1.1;
  });

  // -------------------- Nubes --------------------
  const puffGeo = mergeGeometries([
    ico(3.2, 1).translate(0, 0, 0),
    ico(2.4, 1).translate(3.4, 0.4, 0.4),
    ico(2.6, 1).translate(-3.2, 0.2, -0.3),
    ico(1.9, 1).translate(0.6, 1.2, 0.2),
  ]);
  const puffMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  const clouds = new THREE.InstancedMesh(puffGeo, puffMat, 16);
  const cloudData = [];
  for (let i = 0; i < 16; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 120 + rnd() * 700;
    cloudData.push({
      x: Math.cos(a) * r,
      y: 70 + rnd() * 45,
      z: Math.sin(a) * r,
      s: 1.6 + rnd() * 2.2,
      v: 1.5 + rnd() * 2,
    });
  }
  const updateClouds = (dt) => {
    for (let i = 0; i < cloudData.length; i++) {
      const c = cloudData[i];
      c.x += c.v * dt;
      if (c.x > 900) c.x = -900;
      dummy.position.set(c.x, c.y, c.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(c.s);
      dummy.updateMatrix();
      clouds.setMatrixAt(i, dummy.matrix);
    }
    clouds.instanceMatrix.needsUpdate = true;
  };
  updateClouds(0);
  group.add(clouds);
  updaters.push(updateClouds);

  // -------------------- Globos aerostáticos --------------------
  const balloonGeo = mergeGeometries([
    new THREE.SphereGeometry(2.6, 12, 10).scale(1, 1.3, 1),
    new THREE.BoxGeometry(1.4, 1.1, 1.4).translate(0, -4.4, 0),
  ]);
  const balloonMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  const balloons = new THREE.InstancedMesh(balloonGeo, balloonMat, 7);
  const balloonColors = [0xff6b6b, 0xffd23f, 0x4fd1ff, 0x6be36b, 0xff8ad8];
  const balloonData = [];
  for (let i = 0; i < 7; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 90 + rnd() * 260;
    balloonData.push({
      x: Math.cos(a) * r,
      y: 26 + rnd() * 26,
      z: Math.sin(a) * r,
      phase: rnd() * Math.PI * 2,
      v: 0.6 + rnd() * 0.8,
    });
    balloons.setColorAt(i, col.setHex(balloonColors[i % balloonColors.length]));
  }
  if (balloons.instanceColor) balloons.instanceColor.needsUpdate = true;
  const updateBalloons = (dt, time) => {
    for (let i = 0; i < balloonData.length; i++) {
      const b = balloonData[i];
      b.x += b.v * dt;
      if (b.x > 400) b.x = -400;
      dummy.position.set(b.x, b.y + Math.sin(time * 0.6 + b.phase) * 1.6, b.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      balloons.setMatrixAt(i, dummy.matrix);
    }
    balloons.instanceMatrix.needsUpdate = true;
  };
  updateBalloons(0, 0);
  group.add(balloons);
  updaters.push(updateBalloons);

  const ambient = {
    background: 0x9fd3ff,
    skyStops: [
      [0, '#2f6fd0'],
      [0.42, '#79c0ff'],
      [0.72, '#cbeaff'],
      [1, '#f2fbff'],
    ],
    fog: 0xcfe8ff,
    fogNear: 260,
    fogFar: 1350,
    terrainBase: '#4c9a46',
    terrainLight: '#6fbf58',
    terrainDark: '#357a34',
    sunColor: 0xfff4d6,
    sunIntensity: 2.4,
    hemiSky: 0xbfe6ff,
    hemiGround: 0x3f6b2a,
    hemiIntensity: 0.9,
    sunDir: [0.55, 0.72, 0.42],
    sunVisual: '#fff3b0',
    terrainColor: (x, z, h) => {
      const t = Math.min(1, Math.max(0, h / 22));
      return col.setRGB(0.24 + t * 0.22, 0.52 + t * 0.18, 0.2 + t * 0.1);
    },
  };

  function update(dt, time) {
    for (const u of updaters) u(dt, time);
  }

  return { group, update, ambient };
}
