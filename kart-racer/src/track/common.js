// BLOQUE 1 — CIRCUITOS. Estructuras comunes: arco de meta y gradas con público.
// Materiales PBR (MeshStandardMaterial). Contrato §9.2.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { bannerTex } from './textures.js';

// Arco de meta con pancarta del nombre del circuito.
export function buildStartArch(samples, half, name, palette) {
  const s = samples[0];
  const heading = Math.atan2(s.tangent.x, s.tangent.z);
  const group = new THREE.Group();
  group.name = 'start-arch';

  const postH = 9.0;
  const postGeo = new THREE.CylinderGeometry(0.45, 0.55, postH, 10);
  const postMat = new THREE.MeshStandardMaterial({
    color: palette.post,
    roughness: 0.35,
    metalness: 0.75,
    envMapIntensity: 1.1,
  });
  const off = half + 2.5;
  const l = s.left;

  const parts = [];
  const capMat = new THREE.MeshStandardMaterial({ color: palette.accent, roughness: 0.3, metalness: 0.6 });
  for (const sign of [1, -1]) {
    const g = postGeo.clone();
    g.translate(0, postH / 2, 0);
    g.translate(s.pos.x + l.x * off * sign, s.pos.y, s.pos.z + l.z * off * sign);
    parts.push(g);
  }
  const posts = new THREE.Mesh(mergeGeometries(parts), postMat);
  posts.castShadow = true;
  posts.receiveShadow = true;
  group.add(posts);
  // remates en la punta de cada poste
  const caps = new THREE.Mesh(
    mergeGeometries([1, -1].map((sign) => {
      const cap = new THREE.SphereGeometry(0.62, 12, 10);
      cap.translate(s.pos.x + l.x * off * sign, s.pos.y + postH + 0.2, s.pos.z + l.z * off * sign);
      return cap;
    })),
    capMat
  );
  group.add(caps);

  const bannerW = off * 2 - 0.6;
  const bTex = bannerTex(name, palette.bannerBg, palette.accent);
  const bMat = new THREE.MeshStandardMaterial({
    map: bTex,
    emissive: 0xffffff,
    emissiveMap: bTex,
    emissiveIntensity: 0.25,
    roughness: 0.7,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(bannerW, 2.8), bMat);
  banner.position.set(s.pos.x, s.pos.y + postH - 1.7, s.pos.z);
  banner.rotation.y = heading + Math.PI;
  banner.castShadow = true;
  group.add(banner);

  return group;
}

function grandstandGeometry() {
  const standLen = 44;
  const parts = [];
  const steps = 6;
  for (let i = 0; i < steps; i++) {
    const g = new THREE.BoxGeometry(standLen, 0.9, 1.5);
    g.translate(0, 0.45 + i * 0.9, 1.0 + i * 1.5);
    parts.push(g);
  }
  const base = new THREE.BoxGeometry(standLen, 5.6, 1.4);
  base.translate(0, 2.8, 1.0 + (steps - 1) * 1.5 + 0.9);
  parts.push(base);
  return mergeGeometries(parts);
}

// Dos gradas a ambos lados de la meta, con público que salta.
export function buildGrandstands(samples, half, palette, rnd) {
  const group = new THREE.Group();
  group.name = 'grandstands';
  const stepGeo = grandstandGeometry();
  const stepMat = new THREE.MeshStandardMaterial({
    color: palette.stand,
    roughness: 0.8,
    metalness: 0.05,
  });

  const anchor = samples[Math.floor(samples.length * 0.02)];
  const off = half + 17;

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

    for (let i = 0; i < 6; i++) {
      const localZ = 1.0 + i * 1.5;
      const localY = 0.9 + i * 0.9 + 0.5;
      for (let k = 0; k < 20; k++) {
        const lx = -20 + k * 2.1 + (rnd() - 0.5) * 0.5;
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
          tall: 0.8 + rnd() * 0.5,
        });
      }
    }
  }

  // Cada espectador = torso + cabeza fusionados (una sola malla instanciada).
  const crowdGeo = mergeGeometries([
    new THREE.BoxGeometry(0.42, 0.52, 0.34).translate(0, 0.26, 0),
    new THREE.SphereGeometry(0.16, 8, 6).translate(0, 0.62, 0),
  ]);
  const crowdMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0.0 });
  const crowd = new THREE.InstancedMesh(crowdGeo, crowdMat, crowdData.length);
  crowd.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  crowd.castShadow = false;
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();

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
    dummy.scale.set(1, c.tall, 1);
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
      const bob = Math.max(0, Math.sin(time * 3.0 + c.phase)) * 0.24;
      const p = worldPos(c, bob);
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(bob * 0.15, c.heading, 0);
      dummy.scale.set(1, c.tall, 1);
      dummy.updateMatrix();
      crowd.setMatrixAt(i, dummy.matrix);
    }
    crowd.instanceMatrix.needsUpdate = true;
  }

  return { group, update };
}
