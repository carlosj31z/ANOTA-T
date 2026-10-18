// BLOQUE 7 — Mallas emisivas instanciadas: conos de llama de escape y anillos
// de onda expansiva. Se usan InstancedMesh para mantener el conjunto en un solo
// draw call cada uno (CONTRATO §4.7 / brief tanda 3). Sin crear objetos THREE
// por frame: matrices y colores se escriben sobre instancias reutilizadas.

import * as THREE from 'three';

const _dummy = new THREE.Object3D();
const _up = new THREE.Vector3(0, 1, 0);
const _fwd = new THREE.Vector3();
const _pos = new THREE.Vector3();
const _col = new THREE.Color();

// ---------------------------------------------------------------
// Conos de llama (turbo): uno por cada escape activo.
// ---------------------------------------------------------------
export class FlameJets {
  constructor(scene, max = 32) {
    this.max = max;
    const geo = new THREE.ConeGeometry(1, 1, 12, 4, true);
    // Gradiente vertical: brillante en el vértice (escape), transparente en la
    // base (extremo ancho). Con vertexColors + instanceColor se obtiene un jet
    // de llama que se desvanece, sin necesidad de texturas.
    {
      const pos = geo.attributes.position;
      const col = new Float32Array(pos.count * 4);
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i); // -0.5 (base) .. +0.5 (vértice)
        const u = Math.min(1, Math.max(0, y + 0.5));
        const alpha = u * u; // 0 en la base, 1 en el vértice
        const lum = 0.35 + 0.65 * alpha;
        col[i * 4] = lum;
        col[i * 4 + 1] = lum;
        col[i * 4 + 2] = lum;
        col[i * 4 + 3] = alpha;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
    }
    this.material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    this.mesh = new THREE.InstancedMesh(geo, this.material, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 9;
    this.mesh.count = 0;
    this.mesh.visible = false;
    // Inicializa colores de instancia.
    const white = new THREE.Color(1, 1, 1);
    for (let i = 0; i < max; i++) this.mesh.setColorAt(i, white);
    if (this.mesh.instanceColor) this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.mesh);
    this._n = 0;
  }

  begin() {
    this._n = 0;
  }

  // Añade un cono en `base` (posición del escape) apuntando hacia `forward`.
  add(base, forward, length, radius, r, g, b) {
    if (this._n >= this.max) return;
    const i = this._n++;
    _fwd.copy(forward).normalize();
    // Centro del cono: media longitud por detrás del escape.
    _pos.copy(base).addScaledVector(_fwd, -length * 0.5);
    _dummy.position.copy(_pos);
    _dummy.quaternion.setFromUnitVectors(_up, _fwd);
    _dummy.scale.set(radius, length, radius);
    _dummy.updateMatrix();
    this.mesh.setMatrixAt(i, _dummy.matrix);
    _col.setRGB(r, g, b);
    this.mesh.setColorAt(i, _col);
  }

  end() {
    this.mesh.count = this._n;
    this.mesh.visible = this._n > 0;
    if (this._n > 0) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
  }

  dispose(scene) {
    scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.dispose();
  }
}

// ---------------------------------------------------------------
// Anillos de onda expansiva (explosiones / golpes), tumbados en el suelo.
// ---------------------------------------------------------------
export class Shockwaves {
  constructor(scene, max = 8) {
    this.max = max;
    const geo = new THREE.RingGeometry(0.62, 1.0, 48, 1);
    geo.rotateX(-Math.PI / 2);
    this.material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    this.mesh = new THREE.InstancedMesh(geo, this.material, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 9;
    this.mesh.count = 0;
    this.mesh.visible = false;
    const white = new THREE.Color(1, 1, 1);
    for (let i = 0; i < max; i++) this.mesh.setColorAt(i, white);
    if (this.mesh.instanceColor) this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.mesh);

    // Estado por instancia.
    this._x = new Float32Array(max);
    this._y = new Float32Array(max);
    this._z = new Float32Array(max);
    this._age = new Float32Array(max);
    this._life = new Float32Array(max);
    this._r0 = new Float32Array(max);
    this._r1 = new Float32Array(max);
    this._r = new Float32Array(max);
    this._g = new Float32Array(max);
    this._b = new Float32Array(max);
    this._int = new Float32Array(max);
    this._active = new Uint8Array(max);
    this._next = 0;
    this._n = 0;
  }

  spawn(x, y, z, opts) {
    const i = this._next;
    this._next = (this._next + 1) % this.max;
    this._x[i] = x;
    this._y[i] = y;
    this._z[i] = z;
    this._age[i] = 0;
    this._life[i] = opts.life || 0.5;
    this._r0[i] = opts.r0 == null ? 0.3 : opts.r0;
    this._r1[i] = opts.r1 == null ? 4 : opts.r1;
    this._r[i] = opts.r || 1;
    this._g[i] = opts.g == null ? opts.r : opts.g;
    this._b[i] = opts.b == null ? opts.r : opts.b;
    this._int[i] = opts.intensity == null ? 1.6 : opts.intensity;
    this._active[i] = 1;
  }

  update(dt) {
    let n = 0;
    const mat = this.mesh;
    for (let i = 0; i < this.max; i++) {
      if (!this._active[i]) continue;
      let age = this._age[i] + dt;
      if (age >= this._life[i]) {
        this._active[i] = 0;
        continue;
      }
      this._age[i] = age;
      const u = age / this._life[i];
      const e = 1 - (1 - u) * (1 - u); // ease-out
      const rad = this._r0[i] + (this._r1[i] - this._r0[i]) * e;
      const alpha = (1 - u) * (1 - u) * this._int[i];
      _dummy.position.set(this._x[i], this._y[i], this._z[i]);
      _dummy.rotation.set(0, 0, 0);
      _dummy.scale.set(rad, 1, rad);
      _dummy.updateMatrix();
      mat.setMatrixAt(n, _dummy.matrix);
      _col.setRGB(this._r[i] * alpha, this._g[i] * alpha, this._b[i] * alpha);
      mat.setColorAt(n, _col);
      n++;
    }
    this._n = n;
    mat.count = n;
    mat.visible = n > 0;
    if (n > 0) {
      mat.instanceMatrix.needsUpdate = true;
      if (mat.instanceColor) mat.instanceColor.needsUpdate = true;
    }
  }

  dispose(scene) {
    scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.dispose();
  }
}
