// BLOQUE 9 — RENDER PIPELINE. Contrato §9.1.
//
// `createRenderPipeline(renderer, scene, camera, opts)` devuelve el pipeline de
// postprocesado que sustituye a `renderer.render(scene, camera)`.
//
// Cadena para `high` (presupuesto SPEC C12: < 300 draw calls por frame):
//   RenderPass → UnrealBloomPass → Grading (ShaderPass) → SMAAPass → OutputPass
// `ultra`: high + GTAOPass (tras el RenderPass) a resolución completa, bloom más
//   rico y sombras 4096. El pase de normales de GTAO repite toda la escena
//   (~200 draw calls), por eso SOLO existe en ultra, y se ejecuta con
//   `renderer.shadowMap.autoUpdate = false` para no repintar los shadow maps.
// `low`: `renderer.render` directo, sin composer.
//
// TONE MAPPING (una sola vez): desde three r152 los materiales solo aplican
// tone mapping cuando se renderiza al framebuffer por defecto
// (`_currentRenderTarget === null`). Al renderizar la escena a un render target
// del EffectComposer el material NO aplica tone mapping ni conversión a sRGB:
// el buffer intermedio queda en lineal HDR. El OutputPass final es quien aplica
// el tone mapping (leyendo `renderer.toneMapping`, ACES) y la conversión sRGB.
// En `low` no hay composer, así que son los propios materiales los que aplican
// ACES+sRGB al framebuffer. En ambos casos se aplica exactamente una vez; por
// eso NO se toca `renderer.toneMapping` en ningún momento.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createGrading } from './grading.js';
import { createSunShadowFollower } from './sunShadow.js';
import { createDynamicResolution } from './dynamicResolution.js';

const QUALITIES = ['low', 'high', 'ultra'];

function urlQuality() {
  if (typeof window === 'undefined' || !window.location) return null;
  const q = new URLSearchParams(window.location.search).get('q');
  return QUALITIES.includes(q) ? q : null;
}

function defaultBaseRatio() {
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  return Math.min(dpr, 1.5);
}

export function createRenderPipeline(renderer, scene, camera, opts = {}) {
  let quality = QUALITIES.includes(opts.quality) ? opts.quality : urlQuality() || 'high';

  const baseRatio = defaultBaseRatio();
  const isWebGL2 = !!(renderer.capabilities && renderer.capabilities.isWebGL2);

  let composer = null;
  let renderPass = null;
  let gtaoPass = null;
  let bloomPass = null;
  let smaaPass = null;
  let outputPass = null;
  let grading = null;

  let cssW = 1;
  let cssH = 1;

  const sun = createSunShadowFollower(scene);
  const dyn = createDynamicResolution({ initial: baseRatio, max: baseRatio });

  // Medición global de draw calls del frame (ver render()).
  if (renderer.info) renderer.info.autoReset = false;

  // ----------------------------------------------------------------
  // Construcción del composer (bajo demanda, calidad != low)
  // ----------------------------------------------------------------
  function ensureComposer() {
    if (composer) return;

    const samples = isWebGL2 ? 4 : 0;
    const rt = new THREE.WebGLRenderTarget(cssW, cssH, {
      type: THREE.HalfFloatType,
      samples,
    });
    rt.texture.name = 'RenderPipeline.rt';

    composer = new EffectComposer(renderer, rt);

    renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    // Bloom: umbral alto para que solo florezcan emisivos, chispas, turbo y sol.
    bloomPass = new UnrealBloomPass(new THREE.Vector2(cssW, cssH), 0.55, 0.5, 1.05);
    composer.addPass(bloomPass);

    grading = createGrading();
    composer.addPass(grading.pass);

    smaaPass = new SMAAPass(cssW, cssH);
    composer.addPass(smaaPass);

    outputPass = new OutputPass();
    composer.addPass(outputPass);

    applyQualityParams();
  }

  // ----------------------------------------------------------------
  // GTAO (solo ultra). Se crea/inserta bajo demanda tras el RenderPass y se
  // retira al salir de ultra para no pagar su pase de normales.
  // ----------------------------------------------------------------
  function addGtao() {
    if (gtaoPass || !composer) return;
    // Oclusión ambiental de horizonte. Radio/escala pensados para karts de ~2 m:
    // contactos bajo ruedas y objetos del escenario.
    gtaoPass = new GTAOPass(scene, camera, 1, 1, undefined, {
      radius: 0.55,
      distanceExponent: 2.0,
      thickness: 1.0,
      scale: 1.0,
      samples: 24,
      screenSpaceRadius: false,
    });
    gtaoPass.output = GTAOPass.OUTPUT.Default;
    gtaoPass.blendIntensity = 1.0;

    // El pase de normales interno llama a renderer.render(), que actualiza el
    // shadow map en cada llamada. Las sombras ya las pintó el RenderPass de
    // este mismo frame: se congelan durante el pase GTAO y se restaura el valor.
    const origRender = gtaoPass.render.bind(gtaoPass);
    gtaoPass.render = function (...args) {
      const sm = renderer.shadowMap;
      const prev = sm.autoUpdate;
      sm.autoUpdate = false;
      try {
        origRender(...args);
      } finally {
        sm.autoUpdate = prev;
      }
    };
    composer.insertPass(gtaoPass, 1);
  }

  function removeGtao() {
    if (!gtaoPass) return;
    if (composer) {
      const i = composer.passes.indexOf(gtaoPass);
      if (i >= 0) composer.passes.splice(i, 1);
    }
    if (gtaoPass.dispose) gtaoPass.dispose();
    gtaoPass = null;
  }

  // ----------------------------------------------------------------
  // Parámetros dependientes de la calidad
  // ----------------------------------------------------------------
  function applyQualityParams() {
    const ultra = quality === 'ultra';
    if (composer) {
      if (ultra) addGtao();
      else removeGtao();
    }
    if (bloomPass) {
      bloomPass.strength = ultra ? 0.8 : 0.55;
      bloomPass.radius = ultra ? 0.62 : 0.5;
      bloomPass.threshold = ultra ? 0.9 : 1.05;
    }
    sun.setMapSize(ultra ? 4096 : 2048);
  }

  // ----------------------------------------------------------------
  // Tamaño / resolución
  // ----------------------------------------------------------------
  function applySize() {
    const pr = renderer.getPixelRatio();
    if (composer) {
      composer.setPixelRatio(pr);
      composer.setSize(cssW, cssH);
    }
    if (gtaoPass) {
      // GTAO solo existe en ultra: resolución completa.
      const w = Math.max(1, Math.round(cssW * pr));
      const h = Math.max(1, Math.round(cssH * pr));
      gtaoPass.setSize(w, h);
    }
    if (grading) grading.setSize(Math.round(cssW * pr), Math.round(cssH * pr));
  }

  function onRatioChange(ratio) {
    renderer.setPixelRatio(ratio);
    renderer.setSize(cssW, cssH);
    applySize();
  }

  // ----------------------------------------------------------------
  // API
  // ----------------------------------------------------------------
  function render(dt) {
    const changed = dyn.update(dt);
    if (changed != null) onRatioChange(changed);

    // El composer lanza varios `renderer.render` (escena + pases full-screen);
    // con autoReset desactivado se acumulan las draw calls de TODO el frame,
    // que es lo que interesa para el presupuesto (< 300).
    if (renderer.info) renderer.info.reset();

    if (quality === 'low') {
      renderer.render(scene, camera);
      return;
    }

    ensureComposer();
    if (grading) grading.tick(dt);
    composer.render(dt);
  }

  function setSize(width, height) {
    cssW = Math.max(1, Math.floor(width));
    cssH = Math.max(1, Math.floor(height));
    applySize();
  }

  function setQuality(q) {
    if (!QUALITIES.includes(q)) q = 'high';
    quality = q;
    api.quality = q;

    if (q !== 'low') ensureComposer();

    dyn.reset(baseRatio);
    renderer.setPixelRatio(baseRatio);
    applyQualityParams();
    applySize();
  }

  function setSun(light) {
    sun.setSun(light);
  }

  function setFocus(position) {
    sun.setFocus(position);
  }

  function setBoost(amount) {
    if (grading) grading.setBoost(amount);
  }

  function setDynamicResolution(enabled) {
    dyn.setEnabled(enabled);
    if (!enabled) {
      dyn.reset(baseRatio);
      onRatioChange(baseRatio);
    }
  }

  function dispose() {
    if (composer) {
      composer.dispose();
      composer = null;
    }
    if (grading) {
      grading.dispose();
      grading = null;
    }
    if (gtaoPass && gtaoPass.dispose) gtaoPass.dispose();
    if (smaaPass && smaaPass.dispose) smaaPass.dispose();
    if (outputPass && outputPass.dispose) outputPass.dispose();
    sun.dispose();
    renderPass = null;
    gtaoPass = null;
    bloomPass = null;
    smaaPass = null;
    outputPass = null;
  }

  // Tamaño inicial a partir del renderer (el core ya lo ha dimensionado).
  {
    const size = renderer.getSize(new THREE.Vector2());
    cssW = Math.max(1, Math.floor(size.x || 1));
    cssH = Math.max(1, Math.floor(size.y || 1));
    renderer.setPixelRatio(baseRatio);
    renderer.setSize(cssW, cssH);
    if (quality !== 'low') ensureComposer();
    applySize();
  }

  const api = {
    render,
    setSize,
    setQuality,
    setSun,
    setFocus,
    setBoost,
    setDynamicResolution,
    dispose,
    quality,
    // Extras de depuración (no rompen el contrato).
    get composer() {
      return composer;
    },
    get dynamicResolution() {
      return dyn;
    },
  };

  return api;
}
