// Bloque 2 — Página de galería (solo desarrollo). Aislada del core: monta su
// propia escena con los 8 pilotos y expone utilidades en window.__gallery para
// que Playwright la fotografíe. No entra en el bundle de producción.

import { THREE, RoomEnvironment, createKart, CHARACTERS } from './dev-api.js';

const canvas = document.getElementById('gallery-canvas');
const W = window.innerWidth || 1280;
const H = window.innerHeight || 720;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(W, H, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x171b24);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const key = new THREE.DirectionalLight(0xfff2e0, 3.0);
key.position.set(4, 8, 7);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -9;
key.shadow.camera.right = 9;
key.shadow.camera.top = 9;
key.shadow.camera.bottom = -9;
key.shadow.camera.near = 1;
key.shadow.camera.far = 40;
scene.add(key);
const rim = new THREE.DirectionalLight(0x88aaff, 1.6);
rim.position.set(-6, 5, -7);
scene.add(rim);
scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x30343c, 0.55));

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(40, 48),
  new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.92, metalness: 0.0 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 200);

const fakeTrack = {
  projectToTrack: (pos) => ({
    t: 0,
    lateral: 0,
    surface: 'road',
    groundY: 0,
    tangent: new THREE.Vector3(0, 0, 1),
    wallNormal: null,
    center: new THREE.Vector3(pos.x, 0, pos.z),
  }),
  isOnBoostPad: () => false,
  isOnRamp: () => false,
};

const karts = CHARACTERS.map((c) => createKart(scene, c, { isPlayer: false }));

function place(kart, x, z, ry) {
  kart.setTransform(new THREE.Vector3(x, 0, z), ry);
}

function layoutGallery() {
  let i = 0;
  for (const z of [1.0, -1.9]) {
    for (const x of [-3.4, -1.13, 1.13, 3.4]) {
      place(karts[i], x, z, 0);
      i++;
    }
  }
}

function settle(frames = 50) {
  for (let f = 0; f < frames; f++) for (const k of karts) k.update(1 / 60, fakeTrack);
}

function triangles() {
  let tris = 0;
  let meshes = 0;
  karts[0].object3d.traverse((o) => {
    if (o.isMesh && o.geometry) {
      meshes++;
      const g = o.geometry;
      tris += g.index ? g.index.count / 3 : g.attributes.position.count / 3;
    }
  });
  return { tris: Math.round(tris), meshes };
}

function setCamera(pos, look, fov) {
  camera.fov = fov;
  camera.position.set(pos[0], pos[1], pos[2]);
  camera.lookAt(look[0], look[1], look[2]);
  camera.updateProjectionMatrix();
}

layoutGallery();
settle(50);
setCamera([0, 3.1, 11.2], [0, 0.75, -0.3], 42);

function loop() {
  requestAnimationFrame(loop);
  renderer.render(scene, camera);
}
loop();

window.__gallery = {
  THREE,
  renderer,
  scene,
  camera,
  karts,
  fakeTrack,
  layoutGallery,
  settle,
  triangles,
  setCamera,
  render: () => renderer.render(scene, camera),
};
window.__galleryReady = true;
