// Punto de entrada. Contrato §4.8.
// Crea renderer, escena, cámara, bus, audio, UI, input y Game.

import * as THREE from 'three';
import { createEventBus } from './shared/events.js';
import { createAudio } from './audio/index.js';
import { createUI } from './ui/index.js';
import { createInput } from './core/Input.js';
import { createGame } from './core/Game.js';

const canvas = document.getElementById('game-canvas');
const uiRoot = document.getElementById('ui');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
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

const events = createEventBus();
const audio = createAudio();
const ui = createUI(uiRoot, { onSound: (name) => audio.playSfx(name) });
const input = createInput(window);

const game = createGame({ renderer, scene, camera, events, audio, ui, input });

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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
});

audio.bindEvents(events);
game.start();
