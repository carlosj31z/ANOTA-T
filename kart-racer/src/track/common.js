// BLOQUE 1 — Circuitos. Estructuras comunes de pista: arco de meta y gradas con público.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { bannerTex } from './textures.js';

// Arco de meta con pancarta del nombre del circuito.
export function buildStartArch(samples, half, name, palette) {
  const s = samples[0];
  const heading = Math.atan2(s.tangent.x, s.tangent.z);
  const group = new THREE.Group();

  const postH = 8.5;
  const postGeo = new THREE.BoxGeometry(0.9, postH, 0.9);
  const postMat = new THREE.MeshLambertMaterial({ color: palette.post });
  const off = half + 2.5;
  const l = s.left;

  for (const sign of [1, -1]) {
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(s.pos.x + l.x * off * sign, s.pos.y + postH / 2, s.pos.z + l.z * off * sign);
    post.castShadow = true;
    group.add(post);
    const capGeo = new THREE.SphereGeometry(0.65, 10, 8);
    const cap = new THREE.Mesh(capGeo, new THREE.MeshLambertMaterial({ color: palette.accent }));
    cap.position.copy(post.position);
    cap.position.y = s.pos.y + postH;
    group.add(cap);
  }

  const bannerW = off * 2 - 1;
  const bMat = new THREE.MeshBasicMaterial({
    map: bannerTex(name, palette.bannerBg, palette.accent),
    side: THREE.DoubleSide,
  });
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(bannerW, 2.6), bMat);
  banner.position.set(s.pos.x, s.pos.y + postH - 1.9, s.pos.z);
  banner.rotation.y = heading + Math.PI; // el texto mira a los karts que llegan por detrás
  group.add(banner);

  return group;
}

function grandstandGeometry() {
  const standLen = 42;
  const parts = [];
  const steps = 6;
  for (let i = 0; i < steps; i++) {
    const g = new THREE.BoxGeometry(standLen, 0.9, 1.5);
    g.translate(0, 0.45 + i * 0.9, 1.0 + i * 1.5);
    parts.push(g);
  }
  const base = new THREE.BoxGeometry(standLen, 5.4, 1.4);
  base.translate(0, 2.7, 1.0 + (steps - 1) * 1.5 + 0.9);
  parts.push(base);
  return mergeGeometries(parts);
}

// Dos gradas a ambos lados de la meta, con público que salta.
export function buildGrandstands(samples, half, palette, rnd) {
  const group = new THREE.Group();
  const stepGeo = grandstandGeometry();
  const stepMat = new THREE.MeshLambertMaterial({ color: palette.stand });

  const anchor = samples[Math.floor(samples.length * 0.02)];
  const off = half + 16;

  const crowdData = [];
  const crowdColors = [0xff5a5a, 0xffd23f, 0x4fd1ff, 0x6be36b, 0xff8ad8, 0xffffff, 0xffa33f, 0x9a7bff];

  for (const side of [1, -1]) {
    const stand = new THREE.Mesh(stepGeo, stepMat);
    stand.position.set(
      anchor.pos.x + anchor.left.x * off * side,
      anchor.pos.y,
      anchor.pos.z + anchor.left.z * off * side
    );
    stand.rotation.y = Math.atan2(anchor.tangent.x, anchor.tangent.z) + side * (Math.PI / 2);
    stand.castShadow = true;
    stand.receiveShadow = true;
    group.add(stand);

    // Público en los escalones.
    for (let i = 0; i < 6; i++) {
      const localZ = 1.0 + i * 1.5;
      const localY = 0.9 + i * 0.9 + 0.45;
      for (let k = 0; k < 20; k++) {
        const lx = -19 + k * 2.0 + (rnd() - 0.5) * 0.5;
        crowdData.push({
          side,
          anchorX: anchor.pos.x,
          anchorZ: anchor.pos.z,
          anchorY: anchor.pos.y,
          heading: Math.atan2(anchor.tangent.x, anchor.tangent.z),
          off,
          lx,
          ly: localY,
          lz: localZ,
          phase: rnd() * Math.PI * 2,
          color: crowdColors[Math.floor(rnd() * crowdColors.length)],
        });
      }
    }
  }

  const crowdGeo = new THREE.BoxGeometry(0.45, 0.55, 0.45);
  const crowdMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const crowd = new THREE.InstancedMesh(crowdGeo, crowdMat, crowdData.length);
  crowd.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();

  // Posición base de cada espectador en coordenadas de mundo.
  // Bases locales de la grada: localX = -side*forward, localZ = side*left.
  function worldPos(c, bob) {
    const h = c.heading;
    const fx = Math.sin(h);
    const fz = Math.cos(h);
    const lx = Math.cos(h);
    const lz = -Math.sin(h);
    const s = c.side;
    return {
      x: c.anchorX + lx * c.off * s + -s * fx * c.lx + s * lx * c.lz,
      y: c.anchorY + c.ly + bob,
      z: c.anchorZ + lz * c.off * s + -s * fz * c.lx + s * lz * c.lz,
    };
  }

  for (let i = 0; i < crowdData.length; i++) {
    const c = crowdData[i];
    const p = worldPos(c, 0);
    c.bx = p.x;
    c.by = p.y;
    c.bz = p.z;
    dummy.position.set(p.x, p.y, p.z);
    dummy.rotation.set(0, c.heading, 0);
    dummy.updateMatrix();
    crowd.setMatrixAt(i, dummy.matrix);
    crowd.setColorAt(i, col.setHex(c.color));
  }
  crowd.instanceMatrix.needsUpdate = true;
  if (crowd.instanceColor) crowd.instanceColor.needsUpdate = true;
  group.add(crowd);

  function update(dt, time) {
    for (let i = 0; i < crowdData.length; i++) {
      const c = crowdData[i];
      const bob = Math.max(0, Math.sin(time * 3.2 + c.phase)) * 0.22;
      const p = worldPos(c, bob);
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0, c.heading, 0);
      dummy.updateMatrix();
      crowd.setMatrixAt(i, dummy.matrix);
    }
    crowd.instanceMatrix.needsUpdate = true;
  }

  return { group, update };
}
