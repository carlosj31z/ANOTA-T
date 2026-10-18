// BLOQUE 9 — RENDER PIPELINE. Escena de prueba para `scripts/render-check.mjs`.
//
// NO la usa el juego: solo existe para que el script de verificación pueda
// medir y capturar el pipeline (low/high/ultra) sin depender del core. Contiene
// suelo PBR, varias esferas con distintos materiales, un emisivo muy brillante
// (para el bloom), una DirectionalLight con sombras y un entorno PMREM.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export { THREE };

function makeGroundTexture() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // Ruido de valor simple + rejilla suave.
      const n =
        0.5 +
        0.25 * Math.sin(x * 0.31 + y * 0.17) * Math.cos(x * 0.11 - y * 0.23) +
        0.25 * Math.sin(x * 0.9 + y * 1.1);
      const grid = ((x >> 5) + (y >> 5)) % 2 ? 0.06 : 0.0;
      const v = Math.max(0, Math.min(1, n * 0.6 + 0.4 + grid));
      img.data[i] = Math.round((0.42 + v * 0.25) * 255);
      img.data[i + 1] = Math.round((0.5 + v * 0.3) * 255);
      img.data[i + 2] = Math.round((0.38 + v * 0.2) * 255);
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 10);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function createDevScene(renderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fbfe8);
  scene.fog = new THREE.Fog(0x9fc9ef, 34, 130);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(55, 1280 / 720, 0.1, 200);

  // Suelo.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 90, 1, 1),
    new THREE.MeshStandardMaterial({ map: makeGroundTexture(), roughness: 0.92, metalness: 0.0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Esferas PBR con distintos acabados (pintura, metal, goma).
  const sphereGeo = new THREE.SphereGeometry(0.72, 48, 32);
  const mats = [
    new THREE.MeshPhysicalMaterial({ color: 0xff3b3b, roughness: 0.25, metalness: 0.0, clearcoat: 1.0, clearcoatRoughness: 0.15 }),
    new THREE.MeshStandardMaterial({ color: 0xcfd6de, roughness: 0.18, metalness: 1.0 }),
    new THREE.MeshStandardMaterial({ color: 0x2f80ff, roughness: 0.7, metalness: 0.1 }),
    new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.45, metalness: 0.0 }),
    new THREE.MeshPhysicalMaterial({ color: 0x28c07a, roughness: 0.35, metalness: 0.0, sheen: 1.0, sheenColor: new THREE.Color(0xaff5cf) }),
  ];
  const group = new THREE.Group();
  for (let i = 0; i < mats.length; i++) {
    const m = new THREE.Mesh(sphereGeo, mats[i]);
    m.position.set((i - 2) * 1.9, 0.72, 0);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }
  // Caja mate para contacto con el suelo.
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 1.6, 1.6),
    new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.85, metalness: 0.05 })
  );
  box.position.set(2.6, 0.8, 2.2);
  box.castShadow = true;
  box.receiveShadow = true;
  group.add(box);
  scene.add(group);

  // Emisivo muy brillante: debe florecer con el bloom.
  const glow = new THREE.Mesh(
    new THREE.TorusKnotGeometry(0.42, 0.16, 96, 16),
    new THREE.MeshStandardMaterial({ color: 0x0a0a0a, emissive: 0x39d0ff, emissiveIntensity: 8, roughness: 0.3, metalness: 0.2 })
  );
  glow.position.set(-3.1, 1.25, 1.7);
  glow.castShadow = true;
  scene.add(glow);

  // Sol con sombras.
  const sun = new THREE.DirectionalLight(0xfff2d8, 2.8);
  sun.position.set(9, 14, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.target.position.set(0, 0.5, 0);
  scene.add(sun);
  scene.add(sun.target);

  const hemi = new THREE.HemisphereLight(0xbfe6ff, 0x3f6b2a, 0.5);
  scene.add(hemi);

  const focus = new THREE.Vector3(0, 0.8, 0);
  let angle = 0;

  function update(dt) {
    angle += dt * 0.25;
    camera.position.set(Math.cos(angle) * 9.5, 4.6, Math.sin(angle) * 9.5 + 1.5);
    camera.lookAt(focus);
  }
  update(0);

  return { scene, camera, sun, focus, update, envRT };
}
