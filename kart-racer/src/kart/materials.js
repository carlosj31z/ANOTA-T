// Bloque 2 — Materiales PBR (tanda 3) y texturas procedurales por código.
// Cacheado por personaje. Sin archivos externos.

import * as THREE from 'three';
import { noise3 } from './geo.js';

const pilotCache = new Map();
const kartCache = new Map();
const texCache = new Map();

// ---------------------------------------------------------------------------
// Texturas procedurales
// ---------------------------------------------------------------------------

function normalMapFromHeight(size, strength, heightFn) {
  const data = new Uint8Array(size * size * 4);
  const h = (x, y) => {
    const u = ((x % size) + size) % size / size;
    const v = ((y % size) + size) % size / size;
    return heightFn(u, v);
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const hl = h(x - 1, y);
      const hr = h(x + 1, y);
      const hd = h(x, y - 1);
      const hu = h(x, y + 1);
      const nx = (hl - hr) * strength;
      const ny = (hd - hu) * strength;
      const nz = 1;
      const inv = 1 / Math.hypot(nx, ny, nz);
      const i = (y * size + x) * 4;
      data[i] = Math.round((nx * inv * 0.5 + 0.5) * 255);
      data[i + 1] = Math.round((ny * inv * 0.5 + 0.5) * 255);
      data[i + 2] = Math.round((nz * inv * 0.5 + 0.5) * 255);
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

export function treadNormal() {
  if (texCache.has('tread')) return texCache.get('tread');
  // Bloques de dibujo: dos hileras de tacos alternadas + surco central.
  const heightFn = (u, v) => {
    const row = Math.floor(v * 8);
    const su = (u + (row % 2) * 0.5) % 1;
    const block = Math.floor(su * 10);
    const inBlockU = (su * 10) % 1;
    const inBlockV = (v * 8) % 1;
    let hgt = 0.5;
    if (block < 9 && inBlockU > 0.12 && inBlockU < 0.88 && inBlockV > 0.14 && inBlockV < 0.86) hgt = 1;
    // surco central
    if (Math.abs(u - 0.5) < 0.03) hgt = 0.15;
    return hgt;
  };
  const tex = normalMapFromHeight(128, 2.2, heightFn);
  tex.repeat.set(2, 1);
  texCache.set('tread', tex);
  return tex;
}

export function blobShadowTexture() {
  if (texCache.has('shadow')) return texCache.get('shadow');
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.05, size / 2, size / 2, size * 0.5);
  g.addColorStop(0, 'rgba(0,0,0,0.5)');
  g.addColorStop(0.45, 'rgba(0,0,0,0.34)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  texCache.set('shadow', tex);
  return tex;
}

function numberTexture(character) {
  const key = 'emblem:' + character.id;
  if (texCache.has(key)) return texCache.get(key);
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;

  // Disco blanco con aro oscuro y acento inferior.
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.44, 0, Math.PI * 2);
  ctx.fillStyle = '#fbf9f2';
  ctx.fill();
  ctx.lineWidth = size * 0.045;
  ctx.strokeStyle = '#191b20';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.38, 0.65, 2.6);
  ctx.lineWidth = size * 0.06;
  ctx.strokeStyle = '#' + character.colors.kartAccent.toString(16).padStart(6, '0');
  ctx.stroke();

  const n = character.id === 'bolt' ? 9 : (character.name.charCodeAt(0) % 8) + 1;
  ctx.fillStyle = '#191b20';
  ctx.font = `900 ${Math.round(size * 0.52)}px system-ui, "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(n), cx, cy + size * 0.03);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  texCache.set(key, tex);
  return tex;
}

// ---------------------------------------------------------------------------
// Material del piloto según especie (pelaje / piel / metal / plumaje)
// ---------------------------------------------------------------------------

function lighten(hex, amount) {
  const c = new THREE.Color(hex);
  c.lerp(new THREE.Color(0xffffff), amount);
  return c;
}

export function getPilotMaterial(character) {
  if (pilotCache.has(character.id)) return pilotCache.get(character.id);
  const s = character.species;
  let mat;
  if (s === 'robot') {
    mat = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      metalness: 0.85,
      roughness: 0.28,
      clearcoat: 0.5,
      clearcoatRoughness: 0.25,
      envMapIntensity: 1.15,
    });
  } else if (s === 'frog' || s === 'dino') {
    // Piel brillante húmeda (la rana con un brillo verdoso suave: el sheen
    // claro la dejaba lavada).
    const frog = s === 'frog';
    mat = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      metalness: 0.0,
      roughness: 0.3,
      clearcoat: 1.0,
      clearcoatRoughness: 0.18,
      sheen: frog ? 0.12 : 0.25,
      sheenColor: frog ? new THREE.Color(0x8cf27a) : lighten(character.colors.accent, 0.4),
      envMapIntensity: frog ? 0.85 : 1.0,
    });
  } else if (s === 'mechanic' || s === 'fighter') {
    // Piel humana: mate con un brillo leve (mono/kimono también usan esto).
    mat = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      metalness: 0.0,
      roughness: 0.5,
      sheen: 0.2,
      sheenRoughness: 0.6,
      sheenColor: lighten(character.colors.body, 0.4),
      clearcoat: 0.22,
      clearcoatRoughness: 0.5,
      envMapIntensity: 0.9,
    });
  } else if (s === 'penguin') {
    // Plumaje sedoso, panza mate.
    mat = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      metalness: 0.0,
      roughness: 0.66,
      sheen: 0.85,
      sheenRoughness: 0.5,
      sheenColor: lighten(character.colors.accent, 0.55),
      envMapIntensity: 0.9,
    });
  } else if (s === 'numbat') {
    // Pelaje rojizo: sheen suave y cálido (el sheen claro lo dejaba melocotón).
    mat = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      metalness: 0.0,
      roughness: 0.78,
      sheen: 0.3,
      sheenRoughness: 0.6,
      sheenColor: new THREE.Color(0xe08050),
      envMapIntensity: 0.8,
    });
  } else {
    // Pelaje: sheen intenso.
    mat = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      metalness: 0.0,
      roughness: 0.82,
      sheen: 1.0,
      sheenRoughness: 0.55,
      sheenColor: lighten(character.colors.body, 0.5),
      envMapIntensity: 0.85,
    });
  }
  pilotCache.set(character.id, mat);
  return mat;
}

// Mechas brillantes (aura de Kenzo): emisivo que se enciende con el turbo.
export function getPilotGlowMaterial(character) {
  const key = 'glow:' + character.id;
  if (pilotCache.has(key)) return pilotCache.get(key);
  const aura = (character.look && character.look.auraColor) || character.colors.accent;
  const mat = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    metalness: 0.15,
    roughness: 0.25,
    clearcoat: 0.6,
    clearcoatRoughness: 0.15,
    emissive: new THREE.Color(aura),
    emissiveIntensity: 0,
    envMapIntensity: 1.3,
  });
  pilotCache.set(key, mat);
  return mat;
}

// Cara: ligeramente más brillante que el pelaje, sin sheen tan alto.
export function getFaceMaterial(character) {
  const key = 'face:' + character.id;
  if (pilotCache.has(key)) return pilotCache.get(key);
  const mat = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    metalness: 0.0,
    roughness: 0.42,
    clearcoat: 0.6,
    clearcoatRoughness: 0.25,
    envMapIntensity: 1.0,
  });
  pilotCache.set(key, mat);
  return mat;
}

// ---------------------------------------------------------------------------
// Materiales del kart
// ---------------------------------------------------------------------------

export function getKartMaterials(character) {
  if (kartCache.has(character.id)) return kartCache.get(character.id);
  const c = character.colors;
  const materials = {
    paint: new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      metalness: 0.4,
      roughness: 0.22,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      envMapIntensity: 1.2,
    }),
    chrome: new THREE.MeshPhysicalMaterial({
      color: 0xdfe4ea,
      metalness: 1.0,
      roughness: 0.14,
      clearcoat: 0.5,
      clearcoatRoughness: 0.15,
      envMapIntensity: 1.4,
    }),
    tire: new THREE.MeshPhysicalMaterial({
      color: 0x16181c,
      metalness: 0.0,
      roughness: 0.86,
      normalMap: treadNormal(),
      normalScale: new THREE.Vector2(0.9, 0.9),
      sheen: 0.3,
      sheenColor: new THREE.Color(0x555a63),
      envMapIntensity: 0.6,
    }),
    rim: new THREE.MeshPhysicalMaterial({
      color: c.kartAccent,
      metalness: 0.95,
      roughness: 0.2,
      clearcoat: 0.6,
      envMapIntensity: 1.4,
    }),
    lights: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    decal: new THREE.MeshBasicMaterial({
      map: numberTexture(character),
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
    shadow: new THREE.MeshBasicMaterial({
      map: blobShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.9,
      toneMapped: false,
    }),
    steering: new THREE.MeshPhysicalMaterial({
      color: 0x22252c,
      metalness: 0.6,
      roughness: 0.3,
      clearcoat: 0.8,
      clearcoatRoughness: 0.2,
    }),
  };
  kartCache.set(character.id, materials);
  return materials;
}
