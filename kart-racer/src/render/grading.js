// BLOQUE 9 — RENDER PIPELINE. Pase propio de GRADING cinematográfico.
//
// Opera en espacio lineal (antes del OutputPass, que aplica ACES + sRGB):
// exposición, contraste suave tipo filmic, saturación, balance cálido,
// lift/gamma/gain, viñeteado suave, grano de película muy sutil, aberración
// cromática radial y blur radial ligero. Aberración, viñeteado extra, blur y
// un pequeño empuje de exposición dependen de `setBoost(amount)` para dar
// sensación de velocidad.

import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const GradingShader = {
  name: 'GradingShader',

  uniforms: {
    tDiffuse: { value: null },
    uExposure: { value: 1.0 },
    uContrast: { value: 1.05 },
    uSaturation: { value: 1.06 },
    uLift: { value: new THREE.Vector3(0.004, 0.003, 0.006) },
    uGamma: { value: new THREE.Vector3(0.99, 1.0, 1.01) },
    uGain: { value: new THREE.Vector3(1.02, 1.0, 0.99) },
    uWarmth: { value: 0.3 },
    uVignette: { value: 0.3 },
    uGrain: { value: 0.015 },
    uAberration: { value: 0.0 },
    uRadialBlur: { value: 0.0 },
    uTime: { value: 0.0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
  },

  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }
  `,

  fragmentShader: /* glsl */ `
    precision highp float;

    uniform sampler2D tDiffuse;
    uniform float uExposure;
    uniform float uContrast;
    uniform float uSaturation;
    uniform vec3 uLift;
    uniform vec3 uGamma;
    uniform vec3 uGain;
    uniform float uWarmth;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uAberration;
    uniform float uRadialBlur;
    uniform float uTime;
    uniform vec2 uResolution;

    varying vec2 vUv;

    float hash12( vec2 p ) {
      return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453123 );
    }

    void main() {
      vec2 centered = vUv - 0.5;
      float r = length( centered ) * 1.41421356;
      vec2 radialDir = centered / max( r, 1e-4 );

      // Blur radial hacia el centro + aberración cromática radial integradas
      // en la misma lectura (un solo bucle de taps).
      const int TAPS = 6;
      float abBase = ( 0.0009 + 0.0022 * r ) * uAberration;
      vec2 baseOffset = radialDir * abBase;

      vec3 col = vec3( 0.0 );
      float total = 0.0;
      for ( int i = 0; i < TAPS; i ++ ) {
        float f = float( i ) / float( TAPS - 1 );
        vec2 suv = 0.5 + centered * ( 1.0 - uRadialBlur * 0.06 * f );
        vec3 s;
        s.r = texture2D( tDiffuse, suv + baseOffset ).r;
        s.g = texture2D( tDiffuse, suv ).g;
        s.b = texture2D( tDiffuse, suv - baseOffset ).b;
        float w = 1.0 - f * 0.55;
        col += s * w;
        total += w;
      }
      col /= total;

      // Exposición.
      col *= uExposure;

      // Lift / gamma / gain.
      col = pow( max( col, 0.0 ), uGamma );
      col = col * uGain + uLift;

      // Balance cálido (sube rojos, baja azules, ajuste verde mínimo).
      col.r *= 1.0 + uWarmth * 0.08;
      col.b *= 1.0 - uWarmth * 0.08;
      col.g *= 1.0 + uWarmth * 0.01;

      // Contraste suave tipo filmic alrededor de 0.18 (gris medio lineal).
      vec3 mid = vec3( 0.18 );
      col = mid + ( col - mid ) * uContrast;

      // Saturación conservando luminancia.
      float luma = dot( col, vec3( 0.2126, 0.7152, 0.0722 ) );
      col = mix( vec3( luma ), col, uSaturation );

      // Viñeteado suave.
      float vig = smoothstep( 1.08, 0.32, r );
      col *= mix( 1.0, vig, uVignette );

      // Grano de película muy sutil.
      float g = hash12( vUv * uResolution + uTime * 91.7 ) - 0.5;
      col += g * uGrain;

      gl_FragColor = vec4( max( col, 0.0 ), 1.0 );
    }
  `,
};

export function createGrading() {
  const pass = new ShaderPass(GradingShader);
  const u = pass.uniforms;

  function setBoost(amount) {
    const a = Math.min(1, Math.max(0, amount || 0));
    u.uAberration.value = 1.5 * a;
    u.uRadialBlur.value = a;
    u.uVignette.value = 0.3 + 0.35 * a;
    u.uExposure.value = 1.0 + 0.05 * a;
    u.uGrain.value = 0.015 + 0.01 * a;
  }

  function setSize(width, height) {
    u.uResolution.value.set(width, height);
  }

  function tick(dt) {
    u.uTime.value += dt;
  }

  setBoost(0);

  return {
    pass,
    uniforms: u,
    setBoost,
    setSize,
    tick,
    dispose() {
      pass.dispose();
    },
  };
}
