// BLOQUE 1 — CIRCUITOS. Agua procedural (oasis del desierto y lago helado):
// dos capas de normal maps animadas, fresnel con el color del cielo, especular
// del sol y niebla que casa con el horizonte. ShaderMaterial propio.

import * as THREE from 'three';
import { waterNormalMaps } from './textures.js';

export function createWaterMaterial(opts = {}) {
  const maps = waterNormalMaps(256, opts.seed ?? 7);
  const uniforms = {
    uTime: { value: 0 },
    uNormal1: { value: maps.n1 },
    uNormal2: { value: maps.n2 },
    uDeep: { value: new THREE.Color(opts.deep ?? 0x0d3b6b) },
    uShallow: { value: new THREE.Color(opts.shallow ?? 0x2f8fd8) },
    uSky: { value: new THREE.Color(opts.sky ?? 0xbfe0ff) },
    uSunColor: { value: new THREE.Color(opts.sunColor ?? 0xfff4d6) },
    uSunDir: { value: new THREE.Vector3(0.4, 0.6, 0.3).normalize() },
    uFogColor: { value: new THREE.Color(opts.fogColor ?? 0xbfe0ff) },
    uFogDensity: { value: opts.fogDensity ?? 0.0007 },
    uOpacity: { value: opts.opacity ?? 0.86 },
    uNormalScale: { value: opts.normalScale ?? 0.22 },
    uFlow: { value: opts.flow ?? 0.03 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      varying vec2 vUv;
      varying vec3 vViewDir;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vec4 mv = viewMatrix * wp;
        vViewDir = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uTime;
      uniform sampler2D uNormal1;
      uniform sampler2D uNormal2;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uSky;
      uniform vec3 uSunColor;
      uniform vec3 uSunDir;
      uniform vec3 uFogColor;
      uniform float uFogDensity;
      uniform float uOpacity;
      uniform float uNormalScale;
      uniform float uFlow;
      varying vec3 vWorld;
      varying vec2 vUv;
      varying vec3 vViewDir;

      void main() {
        vec3 nA = texture2D(uNormal1, vUv * 6.0 + vec2(uTime * uFlow, uTime * uFlow * 0.7)).xyz * 2.0 - 1.0;
        vec3 nB = texture2D(uNormal2, vUv * 3.0 - vec2(uTime * uFlow * 0.6, uTime * uFlow)) .xyz * 2.0 - 1.0;
        vec3 n = normalize(vec3(
          (nA.xy + nB.xy) * uNormalScale,
          1.0
        ));
        vec3 V = normalize(vViewDir);
        float fres = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 3.0);
        vec3 base = mix(uDeep, uShallow, 0.5 + 0.5 * n.x);
        vec3 col = mix(base, uSky, clamp(fres * 1.2, 0.0, 0.85));
        // especular Blinn-Phong del sol
        vec3 L = normalize(uSunDir);
        vec3 H = normalize(L + V);
        float spec = pow(max(dot(n, H), 0.0), 180.0);
        col += uSunColor * spec * 1.6;
        float glint = pow(max(dot(n, H), 0.0), 24.0) * 0.15;
        col += uSunColor * glint;
        // niebla exponencial (atmosférica)
        float dist = length(vViewDir);
        float fog = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
        col = mix(col, uFogColor, clamp(fog, 0.0, 1.0));
        gl_FragColor = vec4(col, uOpacity);
      }
    `,
  });

  function update(dt) {
    uniforms.uTime.value += dt;
  }

  function dispose() {
    maps.n1.dispose();
    maps.n2.dispose();
    material.dispose();
  }

  return { material, uniforms, update, dispose };
}
