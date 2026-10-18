// BLOQUE 7 — Sistema de partículas por pools (CONTRATO §4.7).
// Pools de THREE.Points con ShaderMaterial, arrays tipados y reciclaje por
// pila libre. Sin asignar memoria por frame: reutiliza buffers y un objeto de
// opciones compartido. Tamaño por partícula, color, alfa y atenuación por
// distancia (gl_PointSize). Forma circular suave o cuadrado (confeti/estrellas).

import * as THREE from 'three';

const VERT = /* glsl */ `
attribute vec3 aColor;
attribute float aSize;
attribute float aAlpha;
attribute float aRot;
attribute float aShape;
varying vec3 vColor;
varying float vAlpha;
varying float vRot;
varying float vShape;
void main() {
  vColor = aColor;
  vAlpha = aAlpha;
  vRot = aRot;
  vShape = aShape;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float dist = max(0.1, -mv.z);
  gl_PointSize = clamp(aSize * (420.0 / dist), 1.0, 260.0);
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
varying float vRot;
varying float vShape;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float c = cos(vRot);
  float s = sin(vRot);
  p = mat2(c, -s, s, c) * p;
  float a;
  if (vShape < 0.5) {
    float d = length(p);
    a = smoothstep(0.5, 0.04, d);
  } else {
    vec2 ap = abs(p);
    a = (max(ap.x, ap.y) < 0.5) ? 1.0 : 0.0;
  }
  a *= vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// Opciones de emisión reutilizadas (evita asignar objetos por partícula).
export const EMIT = {
  gravity: 0,
  drag: 0,
  shape: 0,
  alpha: 1,
  rot: 0,
  rotVel: 0,
  sizeTo: -1,
};

export function resetEmit() {
  EMIT.gravity = 0;
  EMIT.drag = 0;
  EMIT.shape = 0;
  EMIT.alpha = 1;
  EMIT.rot = 0;
  EMIT.rotVel = 0;
  EMIT.sizeTo = -1;
}

export class ParticlePool {
  constructor(scene, capacity, blending) {
    this.capacity = capacity;
    this.positions = new Float32Array(capacity * 3);
    this.colors = new Float32Array(capacity * 3);
    this.sizes = new Float32Array(capacity);
    this.alphas = new Float32Array(capacity);
    this.rots = new Float32Array(capacity);
    this.shapes = new Float32Array(capacity);

    this.vx = new Float32Array(capacity);
    this.vy = new Float32Array(capacity);
    this.vz = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.grav = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);
    this.size0 = new Float32Array(capacity);
    this.size1 = new Float32Array(capacity);
    this.rotVel = new Float32Array(capacity);
    this.alphaPeak = new Float32Array(capacity);

    // Pila libre de índices (reciclaje circular).
    this._free = new Uint16Array(capacity);
    for (let i = 0; i < capacity; i++) this._free[i] = i;
    this._freeTop = capacity;
    this.aliveCount = 0;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aRot', new THREE.BufferAttribute(this.rots, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aShape', new THREE.BufferAttribute(this.shapes, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, capacity);
    this.geometry = geo;

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending,
    });

    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    scene.add(this.points);
  }

  // Emite una partícula. `opt` es el objeto compartido EMIT (mutado por quien llama).
  spawn(x, y, z, vx, vy, vz, r, g, b, size, life, opt) {
    if (this._freeTop <= 0) return -1;
    const i = this._free[--this._freeTop];
    const p = i * 3;
    this.positions[p] = x;
    this.positions[p + 1] = y;
    this.positions[p + 2] = z;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.vz[i] = vz;
    this.colors[p] = r;
    this.colors[p + 1] = g;
    this.colors[p + 2] = b;
    const s1 = opt.sizeTo >= 0 ? opt.sizeTo : size;
    this.size0[i] = size;
    this.size1[i] = s1;
    this.sizes[i] = size;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.grav[i] = opt.gravity;
    this.drag[i] = opt.drag;
    this.alphaPeak[i] = opt.alpha;
    this.alphas[i] = 0;
    this.rots[i] = opt.rot;
    this.rotVel[i] = opt.rotVel;
    this.shapes[i] = opt.shape;
    this.geometry.attributes.aColor.needsUpdate = true;
    this.geometry.attributes.aShape.needsUpdate = true;
    return i;
  }

  update(dt) {
    const cap = this.capacity;
    const pos = this.positions;
    const { vx, vy, vz, life, maxLife, grav, drag, size0, size1, sizes, alphas, rots, rotVel, alphaPeak } = this;
    let alive = 0;
    for (let i = 0; i < cap; i++) {
      const l = life[i];
      if (l <= 0) {
        if (sizes[i] !== 0) {
          sizes[i] = 0;
          alphas[i] = 0;
        }
        continue;
      }
      const nl = l - dt;
      if (nl <= 0) {
        life[i] = 0;
        sizes[i] = 0;
        alphas[i] = 0;
        this._free[this._freeTop++] = i;
        continue;
      }
      life[i] = nl;
      vy[i] += grav[i] * dt;
      const dr = drag[i];
      if (dr > 0) {
        const f = Math.max(0, 1 - dr * dt);
        vx[i] *= f;
        vy[i] *= f;
        vz[i] *= f;
      }
      const p = i * 3;
      pos[p] += vx[i] * dt;
      pos[p + 1] += vy[i] * dt;
      pos[p + 2] += vz[i] * dt;
      rots[i] += rotVel[i] * dt;

      const u = 1 - nl / maxLife[i];
      sizes[i] = size0[i] + (size1[i] - size0[i]) * u;
      let a;
      if (u < 0.12) a = u / 0.12;
      else if (u > 0.5) a = 1 - (u - 0.5) / 0.5;
      else a = 1;
      alphas[i] = alphaPeak[i] * a;
      alive++;
    }
    this.aliveCount = alive;
    const attrs = this.geometry.attributes;
    attrs.position.needsUpdate = true;
    attrs.aSize.needsUpdate = true;
    attrs.aAlpha.needsUpdate = true;
    attrs.aRot.needsUpdate = true;
  }

  dispose(scene) {
    scene.remove(this.points);
    this.geometry.dispose();
    this.material.dispose();
  }
}
