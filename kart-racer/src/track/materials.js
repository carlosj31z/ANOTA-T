// BLOQUE 1 — CIRCUITOS. Materiales PBR y modificadores de shader (viento).
// Todo MeshStandardMaterial / MeshPhysicalMaterial (contrato §9.2).
// Nada de crear materiales por frame: se cachean y reutilizan.

import * as THREE from 'three';

// Crea un material estándar con los valores por defecto del bloque.
export function pbr(params = {}) {
  const m = new THREE.MeshStandardMaterial({
    roughness: 0.85,
    metalness: 0.0,
    ...params,
  });
  return m;
}

export function physical(params = {}) {
  return new THREE.MeshPhysicalMaterial({
    roughness: 0.6,
    metalness: 0.0,
    ...params,
  });
}

// ---------------------------------------------------------------------
// VIENTO: desplaza vértices según su altura local y el tiempo.
// Pensado para hierba, copas de árboles, arbustos y ropa. Funciona tanto
// en mallas normales como en InstancedMesh.
// ---------------------------------------------------------------------
export function applyWind(material, opts = {}) {
  const {
    strength = 0.35,
    height = 3,
    speed = 1.2,
    scale = 0.22,
    bend = 1.6,
  } = opts;
  material.userData.windTime = 0;
  material.userData.wind = true;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = { value: material.userData.windTime };
    shader.uniforms.uWindStrength = { value: strength };
    shader.uniforms.uWindHeight = { value: height };
    shader.uniforms.uWindSpeed = { value: speed };
    shader.uniforms.uWindScale = { value: scale };
    shader.uniforms.uWindBend = { value: bend };
    shader.vertexShader =
      'uniform float uWindTime;\nuniform float uWindStrength;\nuniform float uWindHeight;\n' +
      'uniform float uWindSpeed;\nuniform float uWindScale;\nuniform float uWindBend;\n' +
      shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      /* glsl */ `
      #include <begin_vertex>
      {
        vec3 wp = transformed;
        #ifdef USE_INSTANCING
          wp = (instanceMatrix * vec4(transformed, 1.0)).xyz;
        #endif
        float hf = clamp(transformed.y / max(uWindHeight, 0.001), 0.0, 1.0);
        hf = pow(hf, uWindBend);
        float ph = wp.x * uWindScale + wp.z * uWindScale * 1.3;
        float sway = sin(uWindTime * uWindSpeed + ph) * 0.6
                   + sin(uWindTime * uWindSpeed * 1.9 + ph * 2.3) * 0.4;
        transformed.x += sway * uWindStrength * hf;
        transformed.z += cos(uWindTime * uWindSpeed * 0.85 + ph) * uWindStrength * 0.5 * hf;
        transformed.y -= abs(sway) * uWindStrength * 0.12 * hf;
      }
      `
    );
    material.userData.shader = shader;
  };
  material.customProgramCacheKey = () =>
    `wind_${strength}_${height}_${speed}_${scale}_${bend}`;
  return material;
}

// ---------------------------------------------------------------------
// ONDEO DE BANDERA / TELA: extremo libre oscila; el borde del mástil queda fijo.
// uPoleAxis indica la dirección (en espacio local) hacia el mástil.
// ---------------------------------------------------------------------
export function applyFlagWave(material, opts = {}) {
  const { strength = 0.9, speed = 3.0, scale = 0.7, freeAxis = 'x' } = opts;
  material.userData.windTime = 0;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: material.userData.windTime };
    shader.uniforms.uWaveStrength = { value: strength };
    shader.uniforms.uWaveSpeed = { value: speed };
    shader.uniforms.uWaveScale = { value: scale };
    shader.uniforms.uFreeAxis = { value: freeAxis === 'x' ? 0 : 1 };
    shader.vertexShader =
      'uniform float uTime;\nuniform float uWaveStrength;\nuniform float uWaveSpeed;\n' +
      'uniform float uWaveScale;\nuniform int uFreeAxis;\n' +
      shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      /* glsl */ `
      #include <begin_vertex>
      {
        float t = (uFreeAxis == 0 ? uv.x : uv.y);
        float w = sin(uTime * uWaveSpeed + t * uWaveScale * 6.2831) * 0.5
                + sin(uTime * uWaveSpeed * 0.6 + t * uWaveScale * 3.1) * 0.5;
        float amp = uWaveStrength * t * t;
        transformed.z += w * amp;
        transformed.y += sin(uTime * uWaveSpeed * 1.3 + t * 4.0) * 0.06 * t;
      }
      `
    );
    material.userData.shader = shader;
  };
  material.customProgramCacheKey = () => `flag_${strength}_${speed}_${scale}_${freeAxis}`;
  return material;
}

// Actualiza el tiempo de una lista de materiales con viento/ondeo.
export function setWindTime(mat, t) {
  mat.userData.windTime = t;
  const s = mat.userData.shader;
  if (s && s.uniforms) {
    if (s.uniforms.uWindTime) s.uniforms.uWindTime.value = t;
    if (s.uniforms.uTime) s.uniforms.uTime.value = t;
  }
}
