// BLOQUE 1 — CIRCUITOS. Cielo atmosférico (Sky), iluminación PBR, entorno y niebla.
// Contrato §9.2: `scene.environment` con un mapa PMREM del propio cielo + `sunLight`.

import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { equirectSky } from './textures.js';

const DEG = Math.PI / 180;

// Busca el renderer de la aplicación para generar PMREM. Es opcional:
// si no está disponible se usa un entorno equirectangular procedural.
function findRenderer(opts) {
  if (opts && opts.renderer && opts.renderer.isWebGLRenderer) return opts.renderer;
  if (typeof window !== 'undefined') {
    if (window.__renderer && window.__renderer.isWebGLRenderer) return window.__renderer;
    if (window.__game && window.__game.renderer && window.__game.renderer.isWebGLRenderer) {
      return window.__game.renderer;
    }
  }
  return null;
}

export function buildSky(scene, theme, centroid, opts = {}) {
  const sc = theme.sky || {};
  const group = new THREE.Group();
  group.name = 'sky';

  // Dirección del sol (unitaria) a partir de elevación/azimut.
  const elev = (sc.elevation ?? 35) * DEG;
  const azim = (sc.azimuth ?? 135) * DEG;
  const sunDir = new THREE.Vector3(
    Math.cos(elev) * Math.sin(azim),
    Math.sin(elev),
    Math.cos(elev) * Math.cos(azim)
  ).normalize();

  // --- Malla Sky atmosférica ---
  const sky = new Sky();
  sky.scale.setScalar(450000);
  const u = sky.material.uniforms;
  u.turbidity.value = sc.turbidity ?? 3;
  u.rayleigh.value = sc.rayleigh ?? 1.2;
  u.mieCoefficient.value = sc.mieCoefficient ?? 0.005;
  u.mieDirectionalG.value = sc.mieDirectionalG ?? 0.8;
  u.sunPosition.value.copy(sunDir);
  sky.position.copy(centroid);

  // --- Entorno PBR ---
  let envTexture = null;
  let envTarget = null;
  const renderer = findRenderer(opts);
  if (renderer) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.add(sky);
    envTarget = pmrem.fromScene(envScene, 0, 0.1, 100);
    envTexture = envTarget.texture;
    envScene.remove(sky);
    pmrem.dispose();
  } else {
    const toCss = (v) =>
      typeof v === 'number' ? `#${v.toString(16).padStart(6, '0')}` : v;
    envTexture = equirectSky({
      size: 512,
      stops: sc.equirectStops || [
        [0, toCss(theme.background) || '#2a4f9f'],
        [0.5, toCss(theme.fogColor) || '#9fc6ff'],
        [1, '#f2fbff'],
      ],
      sunDir: [sunDir.x, sunDir.y, sunDir.z],
      sunColor: sc.sunSpriteColor || '#fff4d6',
      glow: 0.7,
    });
    envTexture.mapping = THREE.EquirectangularReflectionMapping;
  }

  group.add(sky);

  // --- Sol visible (glow) ---
  const sunVis = new THREE.Mesh(
    new THREE.SphereGeometry(sc.sunVisualSize ?? 26, 20, 14),
    new THREE.MeshBasicMaterial({
      color: sc.sunVisual || '#fff4d6',
      transparent: true,
      opacity: sc.sunVisualOpacity ?? 0.9,
      fog: false,
    })
  );
  sunVis.position.copy(centroid).addScaledVector(sunDir, 1700);
  group.add(sunVis);

  // --- Luces ---
  const hemiCfg = sc.hemi || {};
  const hemi = new THREE.HemisphereLight(
    hemiCfg.sky ?? 0xbfe6ff,
    hemiCfg.ground ?? 0x3f6b2a,
    hemiCfg.intensity ?? 0.7
  );
  group.add(hemi);

  const sunCfg = sc.sun || {};
  const sunLight = new THREE.DirectionalLight(sunCfg.color ?? 0xfff4d6, sunCfg.intensity ?? 2.6);
  sunLight.position.copy(centroid).addScaledVector(sunDir, 320);
  sunLight.target.position.copy(centroid);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  const R = sc.shadowRadius ?? 150;
  sunLight.shadow.camera.left = -R;
  sunLight.shadow.camera.right = R;
  sunLight.shadow.camera.top = R;
  sunLight.shadow.camera.bottom = -R;
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 1000;
  sunLight.shadow.camera.updateProjectionMatrix();
  sunLight.shadow.bias = sc.shadowBias ?? -0.0004;
  sunLight.shadow.normalBias = sc.shadowNormalBias ?? 0.4;
  group.add(sunLight);
  group.add(sunLight.target);

  // --- Fondo y niebla exponencial ---
  const prevBackground = scene.background;
  const prevEnv = scene.environment;
  const prevFog = scene.fog;
  scene.background = null;
  scene.environment = envTexture;
  scene.fog = new THREE.FogExp2(theme.fogColor ?? 0xbcdcff, theme.fogDensity ?? 0.0006);

  function dispose() {
    scene.background = prevBackground;
    scene.environment = prevEnv;
    scene.fog = prevFog;
    sky.geometry.dispose();
    sky.material.dispose();
    sunVis.geometry.dispose();
    sunVis.material.dispose();
    hemi.dispose();
    sunLight.shadow.map && sunLight.shadow.map.dispose();
    sunLight.dispose();
    if (envTarget) envTarget.dispose();
    if (!renderer && envTexture) envTexture.dispose();
  }

  return {
    group,
    sunLight,
    hemi,
    skyMesh: sky,
    sunVis,
    sunDir,
    envTexture,
    dispose,
  };
}
