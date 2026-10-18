// BLOQUE 4 — OBJETOS · capturas + prueba numérica de la ventaja `mecanico`.
//
// Levanta el dev server de Vite en el puerto 4213 y sirve una página de banco de
// pruebas propia (route interceptada, no se escribe ningún HTML en el repo) que
// importa `src/items/index.js` con una pista mínima de stub. Captura de cerca:
//   - shots/items-boxes.png       (fila de cajas de objeto)
//   - shots/items-projectiles.png (bouncer + seeker)
//   - shots/items-fx.png          (escudo + tormenta + fragmentos)
// y comprueba numéricamente la ventaja de Max Tuerca (§10.2): ruleta 0.9 s,
// reparto 2 puestos peor (máx. 8), evento 'kart:perk' al recibir el objeto.
//
// Uso: node scripts/items-shots.mjs

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 4213;
const BASE = `http://localhost:${PORT}`;
const SHOTS = path.join(ROOT, 'shots');

// El módulo del banco de pruebas se sirve interceptado (sin escribir archivos en
// el repo), así que Vite no reescribe sus imports "bare": se usan las URLs
// /@id/... que el dev server de Vite sí resuelve.
const HARNESS_JS = `
import * as THREE from '/@id/three';
import { RoomEnvironment } from '/@id/three/addons/environments/RoomEnvironment.js';
import { createItemSystem, rouletteDuration, effectiveItemPlace, rollItemFor } from '/src/items/index.js';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fb8e2);
const pmrem = new THREE.PMREMGenerator(renderer);
const env = pmrem.fromScene(new RoomEnvironment(), 0.04);
scene.environment = env.texture;
pmrem.dispose();

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 400);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(400, 400),
  new THREE.MeshStandardMaterial({ color: 0x5aa04a, roughness: 0.95, metalness: 0.0 })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const sun = new THREE.DirectionalLight(0xfff4e0, 3.0);
sun.position.set(9, 16, 7);
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xbfe0ff, 0x3f5a2a, 0.7));

const boxes = [];
for (let i = 0; i < 7; i++) boxes.push(new THREE.Vector3((i - 3) * 2.7, 1.0, 0));

const trackStub = {
  itemBoxPositions: boxes,
  projectToTrack(pos) {
    return {
      t: 0, lateral: 0, surface: 'road', groundY: 0,
      tangent: new THREE.Vector3(0, 0, 1), wallNormal: null,
      center: new THREE.Vector3(pos.x, 0, pos.z),
    };
  },
  isOnBoostPad() { return false; },
  isOnRamp() { return false; },
};

const events = {
  list: {},
  on(n, f) { (this.list[n] = this.list[n] || []).push(f); return () => {}; },
  off() {},
  emit(n, p) { const a = this.list[n]; if (a) for (const f of a) f(p); },
};

const world = { scene, camera, renderer, events, trackStub, boxes };
world.sys = createItemSystem(scene, trackStub, events);
world.ctx = { karts: [], player: null, places: new Map(), items: world.sys, raceTime: 0 };

function fakeKart(x, z, heading, perk) {
  return {
    position: new THREE.Vector3(x, 0, z),
    heading: heading || 0,
    trackT: 0, maxSpeed: 32, radius: 1.3,
    character: { perk: { id: perk || 'none' } },
    state: { spinTime: 0, boostTime: 0, shieldTime: 0 },
    controls: { useItem: false, throttle: 0, brake: 0, steer: 0, drift: false },
    getForward() { return new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading)); },
    applyBoost(d) { this.state.boostTime = Math.max(this.state.boostTime, d); },
    hit() {},
  };
}
world.fakeKart = fakeKart;

function step(n) {
  for (let i = 0; i < n; i++) world.sys.update(1 / 60, world.ctx);
}
function render() { renderer.render(scene, camera); }
function fit() {
  if (renderer.domElement.width !== window.innerWidth) {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }
}

window.numericTest = function () {
  const out = {};
  const max = fakeKart(0, 0, 0, 'mecanico');
  const rayo = fakeKart(0, 0, 0, 'astucia');
  out.durMax = rouletteDuration(max);
  out.durRayo = rouletteDuration(rayo);
  out.placeMax4 = effectiveItemPlace(max, 4);
  out.placeMax8 = effectiveItemPlace(max, 8);
  out.placeMax1 = effectiveItemPlace(max, 1);
  out.placeRayo4 = effectiveItemPlace(rayo, 4);

  let maxStorm = 0;
  let rayoStorm = 0;
  for (let i = 0; i < 400; i++) {
    if (rollItemFor(max, 4) === 'storm') maxStorm++;
    if (rollItemFor(rayo, 4) === 'storm') rayoStorm++;
  }
  out.maxStorm = maxStorm;
  out.rayoStorm = rayoStorm;

  const perkEvents = [];
  events.on('kart:perk', (p) => perkEvents.push(p));
  const k = fakeKart(boxes[0].x, boxes[0].z, 0, 'mecanico');
  const c = { karts: [k], player: k, places: new Map([[k, 4]]), items: world.sys, raceTime: 0 };
  world.sys.update(1 / 60, c);
  const rolling = world.sys.isRolling(k);
  let elapsed = 0;
  let got = null;
  for (let i = 0; i < 300 && !got; i++) {
    world.sys.update(1 / 60, c);
    elapsed += 1 / 60;
    got = world.sys.getHeldItem(k);
  }
  out.rolling = rolling;
  out.rouletteSeconds = elapsed;
  out.got = got;
  out.perkIds = perkEvents.filter((p) => p.kart === k).map((p) => p.perkId);
  return out;
};

function resetSystem() {
  world.sys.dispose();
  world.sys = createItemSystem(scene, trackStub, events);
  world.ctx = { karts: [], player: null, places: new Map(), items: world.sys, raceTime: 0 };
}

window.setupBoxes = function () {
  resetSystem();
  step(40);
  fit();
  camera.position.set(0, 2.1, 7.4);
  camera.lookAt(0, 1.05, 0);
  render();
  return true;
};

window.setupProjectiles = function () {
  resetSystem();
  const k = fakeKart(-1, -5, 0.15, 'none');
  const c = { karts: [k], player: k, places: new Map([[k, 4]]), items: world.sys, raceTime: 0 };
  world.ctx = c;
  world.sys.debugUse(k, 'bouncer', c);
  k.heading = 0.55;
  world.sys.debugUse(k, 'seeker', c);
  k.heading = -0.35;
  world.sys.debugUse(k, 'bouncer', c);
  step(9);
  fit();
  camera.position.set(0.5, 2.6, 7.5);
  camera.lookAt(0.3, 0.9, -1.2);
  render();
  return true;
};

window.setupFx = function () {
  resetSystem();
  const owner = fakeKart(-3.0, 2.5, 0.5, 'none');
  const v1 = fakeKart(3.5, 1.2, 0, 'none');
  const v2 = fakeKart(3.0, -1.6, 0, 'none');
  const c = {
    karts: [owner, v1, v2], player: owner,
    places: new Map([[owner, 4], [v1, 2], [v2, 1]]),
    items: world.sys, raceTime: 0,
  };
  world.ctx = c;
  world.sys.debugUse(owner, 'shield', c);
  world.sys.debugUse(owner, 'storm', c);

  const picker = fakeKart(boxes[3].x, boxes[3].z, 0, 'none');
  world.sys.update(1 / 60, { karts: [picker], places: new Map([[picker, 4]]), items: world.sys, raceTime: 0 });
  step(11);
  fit();
  camera.position.set(0.0, 4.6, 12.0);
  camera.lookAt(0.6, 1.7, 0.0);
  render();
  return true;
};

window.measureCalls = function () {
  ground.visible = false;
  let best = 0;
  for (let i = 0; i < 3; i++) {
    render();
    best = Math.max(best, renderer.info.render.calls);
  }
  ground.visible = true;
  return best;
};

window.__ready = true;
`;

const HARNESS_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%;overflow:hidden}canvas{display:block}</style></head>
<body><canvas id="c"></canvas><script type="module" src="/src/items/harness.js"></script></body></html>`;

async function waitForServer(url, timeoutMs = 40000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status === 200) return;
    } catch {
      /* aún no está */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('El dev server de items no respondió a tiempo');
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });

  const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT,
    stdio: 'ignore',
  });
  const cleanup = () => {
    try {
      server.kill('SIGTERM');
    } catch {
      /* ignore */
    }
  };
  process.on('exit', cleanup);

  let browser = null;
  const report = { ok: false, numeric: null, checks: {}, drawCalls: null, errors: [] };

  try {
    await waitForServer(BASE);
    const { chromium } = await import('playwright');
    browser = await chromium.launch({
      args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    });

    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('console', (msg) => {
      if (msg.type() === 'error') report.errors.push(msg.text());
    });
    page.on('pageerror', (err) =>
      report.errors.push('pageerror: ' + (err && err.message ? err.message : String(err)))
    );

    await page.route('**/items-harness', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: HARNESS_HTML })
    );
    await page.route('**/src/items/harness.js', (route) =>
      route.fulfill({ status: 200, contentType: 'application/javascript', body: HARNESS_JS })
    );

    await page.goto(`${BASE}/items-harness`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 40000 });

    report.numeric = await page.evaluate(() => window.numericTest());

    await page.evaluate(() => window.setupBoxes());
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: path.join(SHOTS, 'items-boxes.png') });

    await page.evaluate(() => window.setupProjectiles());
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: path.join(SHOTS, 'items-projectiles.png') });

    await page.evaluate(() => window.setupFx());
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: path.join(SHOTS, 'items-fx.png') });

    report.drawCalls = await page.evaluate(() => window.measureCalls());

    await page.close();

    const n = report.numeric;
    const near = (a, b, eps) => Math.abs(a - b) <= eps;
    report.checks = {
      durMax: near(n.durMax, 0.9, 1e-6),
      durRayo: near(n.durRayo, 2.0, 1e-6),
      placeMax4: n.placeMax4 === 6,
      placeMax8: n.placeMax8 === 8,
      placeMax1: n.placeMax1 === 3,
      placeRayo4: n.placeRayo4 === 4,
      monteCarlo: n.maxStorm > 0 && n.rayoStorm === 0,
      rolling: n.rolling === true,
      rouletteSeconds: near(n.rouletteSeconds, 0.9, 0.03),
      perkEvent: Array.isArray(n.perkIds) && n.perkIds.includes('mecanico'),
    };
    const allChecks = Object.values(report.checks).every(Boolean);
    report.ok = allChecks && report.errors.length === 0;
  } catch (err) {
    report.errors.push('fatal: ' + (err && err.stack ? err.stack : String(err)));
  } finally {
    if (browser) await browser.close();
    cleanup();
  }

  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  process.exit(report.ok ? 0 : 1);
}

main().catch((err) => {
  process.stderr.write('items-shots falló: ' + (err && err.stack ? err.stack : String(err)) + '\n');
  process.exit(1);
});
