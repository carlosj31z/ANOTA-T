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
  // 11 pilotos en 3 filas: 4 + 4 + 3 (tanda 4).
  const rows = [
    { z: 3.0, xs: [-4.3, -1.43, 1.43, 4.3] },
    { z: -0.3, xs: [-4.3, -1.43, 1.43, 4.3] },
    { z: -3.6, xs: [-2.9, 0, 2.9] },
  ];
  let i = 0;
  for (const row of rows) {
    for (const x of row.xs) {
      if (i >= karts.length) break;
      karts[i].object3d.visible = true;
      place(karts[i], x, row.z, 0);
      i++;
    }
  }
}

// Primer plano de los 3 pilotos nuevos, en fila (el resto oculto).
function layoutNew3() {
  const xs = [-1.5, 0, 1.5];
  for (let i = 0; i < karts.length; i++) {
    const isNew = i >= 8;
    karts[i].object3d.visible = isNew;
    if (isNew) place(karts[i], xs[i - 8], 0.6, 0);
  }
}

// Un solo piloto (por id) en primer plano, girado ry radianes (dev / revisión).
function layoutSolo(id, ry = 0) {
  for (let i = 0; i < karts.length; i++) {
    const on = karts[i].character.id === id;
    karts[i].object3d.visible = on;
    if (on) place(karts[i], 0, 0.6, ry);
  }
}

// Varios pilotos (por id) en fila, cada uno con su giro; el resto oculto.
function layoutPair(ids, xs, rys, z = 0.6) {
  for (const k of karts) k.object3d.visible = false;
  ids.forEach((id, i) => {
    const k = karts.find((q) => q.character.id === id);
    if (!k) return;
    k.object3d.visible = true;
    place(k, xs[i], z, rys[i] || 0);
  });
}

// Comprobación de solapes piloto / volante / arco antivuelco. Devuelve, por
// kart, la distancia mínima (m, mundo) de cabeza, cara, pelo y torso (con
// morphs aplicados) al aro del volante y al arco; negativa = atraviesa.
// Los brazos se excluyen: agarran el volante a propósito.
function clipReport(framesPerState = 40) {
  const out = {};
  const v = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const states = [
    { steer: 0, drift: false },
    { steer: 1, drift: false },
    { steer: -1, drift: false },
    { steer: 1, drift: true },
    { steer: -1, drift: true },
  ];
  for (const k of karts) {
    const res = { steer: Infinity, steerAt: '', roll: Infinity, rollAt: '' };
    k.object3d.visible = true;
    place(k, 0, 0, 0);
    const wheel = k.object3d.getObjectByName('steering');
    const chrome = k.object3d.getObjectByName('chrome');
    const parts = ['pilot-body', 'pilot-head', 'pilot-face', 'pilot-glow']
      .map((n) => k.object3d.getObjectByName(n))
      .filter(Boolean);
    for (const st of states) {
      k.controls.throttle = 1;
      k.controls.steer = st.steer;
      k.controls.drift = st.drift;
      for (let f = 0; f < framesPerState; f++) {
        k.update(1 / 60, fakeTrack);
        if (f % 4 !== 3) continue;
        k.object3d.updateMatrixWorld(true);
        // Aro del volante: centro, eje (normal) y radios en mundo.
        const wc = new THREE.Vector3().setFromMatrixPosition(wheel.matrixWorld);
        const wn = new THREE.Vector3(0, 0, 1).transformDirection(wheel.matrixWorld);
        const ws = new THREE.Vector3().setFromMatrixScale(wheel.matrixWorld).x;
        // Arco antivuelco: semicircunferencia en el plano z = -0.56 (local kart).
        const inv = new THREE.Matrix4().copy(chrome.matrixWorld).invert();
        for (const m of parts) {
          const pos = m.geometry.attributes.position;
          for (let i = 0; i < pos.count; i += 2) {
            m.getVertexPosition(i, v).applyMatrix4(m.matrixWorld);
            // volante
            tmp.copy(v).sub(wc);
            const h = tmp.dot(wn);
            const inPlane = tmp.addScaledVector(wn, -h).length();
            const dW = Math.hypot(inPlane - 0.115 * ws, h) - 0.022 * ws;
            if (dW < res.steer) {
              res.steer = dW;
              res.steerAt = `${m.name}/${st.steer}/${st.drift ? 'drift' : 'normal'}`;
            }
            // arco (en el espacio del kart)
            const l = v.clone().applyMatrix4(inv);
            if (l.y >= 0.72 - 0.04) {
              const dr = Math.hypot(Math.hypot(l.x, l.y - 0.72) - 0.34, l.z + 0.56) - 0.035;
              if (dr < res.roll) {
                res.roll = dr;
                res.rollAt = `${m.name}/${st.steer}/${st.drift ? 'drift' : 'normal'}`;
                res.rollPos = [l.x, l.y, l.z].map((q) => +q.toFixed(3));
              }
            }
          }
        }
      }
    }
    k.controls.steer = 0;
    k.controls.drift = false;
    k.controls.throttle = 0;
    out[k.character.id] = {
      steer: +res.steer.toFixed(3),
      steerAt: res.steerAt,
      roll: +res.roll.toFixed(3),
      rollAt: res.rollAt,
      rollPos: res.rollPos,
    };
  }
  return out;
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
setCamera([0, 5.4, 17.5], [0, 0.8, -0.5], 40);

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
  layoutNew3,
  layoutSolo,
  layoutPair,
  settle,
  clipReport,
  triangles,
  setCamera,
  render: () => renderer.render(scene, camera),
};
window.__galleryReady = true;
