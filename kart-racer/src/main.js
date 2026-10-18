// Punto de entrada. Contrato §4.8 / §9.1 / §10.3.
// Crea renderer, escena, cámara, pipeline de postprocesado, bus, audio, UI,
// input (teclado/mando), controles táctiles y Game.

import * as THREE from 'three';
import { createEventBus } from './shared/events.js';
import { createAudio } from './audio/index.js';
import { createUI } from './ui/index.js';
import { createInput } from './core/Input.js';
import { createGame } from './core/Game.js';
import { createRenderPipeline } from './render/index.js';
import { createTouchControls } from './touch/index.js';

const canvas = document.getElementById('game-canvas');
const uiRoot = document.getElementById('ui');

const QUALITIES = ['low', 'high', 'ultra'];
const QUALITY_STORAGE_KEY = 'rr:quality';

function isTouchDevice() {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || (navigator && navigator.maxTouchPoints > 0);
}

// Prioridad: `?q=` → localStorage → 'low' en táctil, 'high' en PC.
function initialQuality() {
  let urlQ = null;
  try {
    urlQ = new URLSearchParams(window.location.search).get('q');
  } catch {
    urlQ = null;
  }
  if (QUALITIES.includes(urlQ)) return urlQ;
  try {
    const stored = window.localStorage.getItem(QUALITY_STORAGE_KEY);
    if (QUALITIES.includes(stored)) return stored;
  } catch {
    /* localStorage puede estar bloqueado */
  }
  return isTouchDevice() ? 'low' : 'high';
}

function saveQuality(q) {
  try {
    window.localStorage.setItem(QUALITY_STORAGE_KEY, q);
  } catch {
    /* ignore */
  }
}

const quality = initialQuality();

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 2500);
camera.position.set(0, 12, -22);
camera.lookAt(0, 0, 0);

const pipeline = createRenderPipeline(renderer, scene, camera, { quality });

const events = createEventBus();
const audio = createAudio();
const touch = createTouchControls(uiRoot);
const ui = createUI(uiRoot, {
  quality,
  onSound: (name) => audio.playSfx(name),
  onQuality: (q) => {
    pipeline.setQuality(q);
    saveQuality(q);
    ui.setQualityLabel(q);
  },
});
const input = createInput(window);

const game = createGame({ renderer, scene, camera, events, audio, ui, input, pipeline, touch });

// Desbloqueo del AudioContext en el primer gesto del usuario.
function unlock() {
  audio.unlock();
  window.removeEventListener('pointerdown', unlock);
  window.removeEventListener('keydown', unlock);
}
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  pipeline.setSize(window.innerWidth, window.innerHeight);
});

audio.bindEvents(events);
game.start();
