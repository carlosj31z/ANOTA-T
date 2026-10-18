// BLOQUE 4 — OBJETOS · GRÁFICOS (tanda 3, contrato §9).
//
// Todo procedural y cacheado a nivel de módulo: texturas CanvasTexture con ruido
// fBm / Voronoi y normal maps derivados de mapas de altura, geometrías orgánicas
// suavizadas y materiales PBR (MeshPhysicalMaterial con clearcoat/transmission/
// iridescence) + unos pocos shaders propios (fresnel arcoíris, arcoíris de la
// caja, destellos). Nada de archivos externos. Un solo constructor de assets,
// reutilizado por todos los pools del sistema de objetos.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------------------------------------------------------------------------
// Ruido y texturas procedurales
// ---------------------------------------------------------------------------

function hash2(x, y) {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return h - Math.floor(h);
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

function valueNoise(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  const u = smooth(xf);
  const v = smooth(yf);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

function fbm(x, y, octaves = 4) {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * f, y * f);
    f *= 2;
    amp *= 0.5;
  }
  return sum;
}

function makeCanvas(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function canvasTexture(canvas, { srgb = false, repeat = 1, aniso = 4 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  if (Array.isArray(repeat)) tex.repeat.set(repeat[0], repeat[1]);
  else tex.repeat.set(repeat, repeat);
  tex.anisotropy = aniso;
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return tex;
}

// Genera un normal map (CanvasTexture) a partir de un canvas de altura en
// escala de grises. Fuerza el relieve con diferencias centrales (sobel ligero).
function heightToNormal(canvas, strength = 2.0) {
  const size = canvas.width;
  const src = canvas.getContext('2d').getImageData(0, 0, size, size).data;
  const out = makeCanvas(size);
  const g = out.getContext('2d');
  const img = g.createImageData(size, size);
  const at = (x, y) => src[(((y + size) % size) * size + ((x + size) % size)) * 4] / 255;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = at(x + 1, y) - at(x - 1, y);
      const dy = at(x, y + 1) - at(x, y - 1);
      let nx = -dx * strength;
      let ny = -dy * strength;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      const i = (y * size + x) * 4;
      img.data[i] = Math.round((nx * 0.5 + 0.5) * 255);
      img.data[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      img.data[i + 2] = Math.round(((nz / len) * 0.5 + 0.5) * 255);
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return canvasTexture(out, { repeat: 1 });
}

// --- Piel del peel: amarillo con manchas marrones y relieves verticales ---
function makePeelTextures() {
  const size = 256;
  const base = makeCanvas(size);
  const g = base.getContext('2d');
  g.fillStyle = '#ffd23f';
  g.fillRect(0, 0, size, size);

  // Degradado suave (cereo).
  const grad = g.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, 'rgba(255,240,170,0.55)');
  grad.addColorStop(1, 'rgba(215,140,20,0.35)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);

  // Relieves verticales orgánicos.
  const height = makeCanvas(size);
  const hg = height.getContext('2d');
  hg.fillStyle = '#808080';
  hg.fillRect(0, 0, size, size);
  for (let x = 0; x < size; x++) {
    const v = fbm(x * 0.05, 3.7, 3);
    const shade = 90 + v * 90;
    hg.fillStyle = `rgba(${shade},${shade},${shade},0.5)`;
    hg.fillRect(x, 0, 1, size);
  }

  // Manchas marrones con borde difuso.
  for (let i = 0; i < 26; i++) {
    const cx = hash2(i * 3.1, 1.7) * size;
    const cy = hash2(2.3, i * 5.9) * size;
    const r = 8 + hash2(i * 7.7, i * 2.2) * 16;
    const rgrad = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    rgrad.addColorStop(0, 'rgba(122,74,30,0.95)');
    rgrad.addColorStop(0.7, 'rgba(122,74,30,0.55)');
    rgrad.addColorStop(1, 'rgba(122,74,30,0)');
    g.fillStyle = rgrad;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();

    const hgrad = hg.createRadialGradient(cx, cy, 0, cx, cy, r);
    hgrad.addColorStop(0, 'rgba(40,40,40,0.9)');
    hgrad.addColorStop(1, 'rgba(128,128,128,0)');
    hg.fillStyle = hgrad;
    hg.beginPath();
    hg.arc(cx, cy, r, 0, Math.PI * 2);
    hg.fill();
  }

  return {
    map: canvasTexture(base, { srgb: true, repeat: [1, 1] }),
    normalMap: heightToNormal(height, 2.2),
  };
}

// --- Caparazón del bouncer: placas hexagonales con juntas oscuras ---
function hexDistance(u, v, cell) {
  const row = Math.floor(v / cell);
  const odd = row & 1;
  const col = Math.floor((u + (odd ? cell * 0.5 : 0)) / cell);
  const cx = col * cell - (odd ? cell * 0.5 : 0) + cell * 0.5;
  const cy = row * cell + cell * 0.5;
  const dx = (u - cx) / cell;
  const dy = (v - cy) / cell;
  return Math.max(Math.abs(dx), Math.abs(dx * 0.5 + dy * 0.866), Math.abs(dx * 0.5 - dy * 0.866));
}

function makeBouncerTextures() {
  const size = 256;
  const cell = size / 5;
  const base = makeCanvas(size);
  const g = base.getContext('2d');
  const height = makeCanvas(size);
  const hg = height.getContext('2d');
  const img = g.createImageData(size, size);
  const himg = hg.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x + 0.5;
      const v = y + 0.5;
      const d = hexDistance(u, v, cell);
      const row = Math.floor(v / cell);
      const odd = row & 1;
      const col = Math.floor((u + (odd ? cell * 0.5 : 0)) / cell);
      const tint = hash2(col * 12.9, row * 7.3);
      const plate = 1 - smooth(Math.max(0, Math.min(1, (d - 0.72) / 0.28)));
      const bump = fbm(u * 0.06, v * 0.06, 3);
      const i = (y * size + x) * 4;
      const shade = 0.72 + 0.28 * plate;
      img.data[i] = Math.round((40 + tint * 40) * shade);
      img.data[i + 1] = Math.round((170 + tint * 60) * shade);
      img.data[i + 2] = Math.round((70 + tint * 40) * shade);
      img.data[i + 3] = 255;
      const h = Math.round(70 + plate * 130 + bump * 20);
      himg.data[i] = h;
      himg.data[i + 1] = h;
      himg.data[i + 2] = h;
      himg.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  hg.putImageData(himg, 0, 0);

  return {
    map: canvasTexture(base, { srgb: true, repeat: [3, 2] }),
    normalMap: heightToNormal(height, 3.0),
  };
}

// --- Destello puntual para las chispas mágicas de las cajas ---
function makeSparkTexture() {
  const size = 64;
  const canvas = makeCanvas(size);
  const g = canvas.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.7)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// --- Textura de mancha de contacto (blob shadow) ---
function makeBlobTexture() {
  const size = 128;
  const canvas = makeCanvas(size);
  const g = canvas.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(0,0,0,0.85)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.45)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

// ---------------------------------------------------------------------------
// Geometrías orgánicas
// ---------------------------------------------------------------------------

// "?" 3D: se dibuja el trazo con Shape (ribbon de ancho constante a lo largo de
// una curva) y se extruye con bevel. El punto inferior es un segundo Shape.
function strokeShape(points, width) {
  const left = [];
  const right = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(points.length - 1, i + 1)];
    let tx = b[0] - a[0];
    let ty = b[1] - a[1];
    const len = Math.hypot(tx, ty) || 1;
    tx /= len;
    ty /= len;
    const nx = -ty;
    const ny = tx;
    left.push([p[0] + nx * width * 0.5, p[1] + ny * width * 0.5]);
    right.push([p[0] - nx * width * 0.5, p[1] - ny * width * 0.5]);
  }
  const shape = new THREE.Shape();
  shape.moveTo(left[0][0], left[0][1]);
  for (let i = 1; i < left.length; i++) shape.lineTo(left[i][0], left[i][1]);
  for (let i = right.length - 1; i >= 0; i--) shape.lineTo(right[i][0], right[i][1]);
  shape.closePath();
  return shape;
}

function makeQuestionGeometry() {
  const pts = [];
  const r = 0.30;
  const cx = 0;
  const cy = 0.16;
  const a0 = THREE.MathUtils.degToRad(205);
  const a1 = THREE.MathUtils.degToRad(-55);
  const steps = 26;
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (a1 - a0) * (i / steps);
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  // Cola del "?": del final del arco hacia el centro-abajo.
  const ctrl = [0.17, -0.34];
  const dest = [0.0, -0.22];
  const end = pts[pts.length - 1];
  for (let i = 1; i <= 10; i++) {
    const t = i / 10;
    const it = 1 - t;
    const x = it * it * end[0] + 2 * it * t * ctrl[0] + t * t * dest[0];
    const y = it * it * end[1] + 2 * it * t * ctrl[1] + t * t * dest[1];
    pts.push([x, y]);
  }

  const extrude = { depth: 0.05, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 3, curveSegments: 10 };
  const hook = new THREE.ExtrudeGeometry(strokeShape(pts, 0.17), extrude);

  const dotShape = new THREE.Shape();
  dotShape.absarc(0, -0.47, 0.075, 0, Math.PI * 2, false);
  const dot = new THREE.ExtrudeGeometry(dotShape, extrude);

  const geo = mergeGeometries([hook, dot], false);
  hook.dispose();
  dot.dispose();
  // Centra y normaliza a ~1.02 de alto (casi llena el interior de la caja).
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const height = bb.max.y - bb.min.y;
  const scale = 1.02 / height;
  const cxm = (bb.max.x + bb.min.x) * 0.5;
  const cym = (bb.max.y + bb.min.y) * 0.5;
  geo.translate(-cxm, -cym, -0.05);
  geo.scale(scale, scale, scale);
  geo.computeVertexNormals();
  return geo;
}

// Piel del peel: tubo con sección variable (puntiagudo en los extremos),
// curvado en arco y aplastado, con ondulación orgánica en el radio.
function makePeelGeometry() {
  const segU = 24;
  const segV = 16;
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i <= segU; i++) {
    const u = i / segU;
    const x = -0.46 + u * 0.92;
    const arch = Math.sin(u * Math.PI) * 0.26;
    const cy = 0.06 + arch;
    const rr = 0.16 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, u))), 0.55) + 0.012;
    for (let j = 0; j <= segV; j++) {
      const v = j / segV;
      const ang = v * Math.PI * 2;
      const wobble = 1 + (fbm(u * 9.0, v * 6.0, 3) - 0.5) * 0.25;
      const lx = Math.cos(ang) * rr * wobble;
      const ly = Math.sin(ang) * rr * 0.72 * wobble;
      const curl = Math.sin(u * Math.PI) * 0.05;
      positions.push(x, cy + ly + curl * 0.2, lx);
      uvs.push(u, v);
    }
  }
  for (let i = 0; i < segU; i++) {
    for (let j = 0; j < segV; j++) {
      const a = i * (segV + 1) + j;
      const b = a + segV + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.translate(0, -0.12, 0);
  return geo;
}

// Caparazón del bouncer: esfera deformada con ruido + borde (toro).
function makeBouncerGeometry() {
  const shell = new THREE.SphereGeometry(0.5, 40, 28);
  const pos = shell.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n =
      0.5 +
      0.25 * Math.sin(v.x * 7.0 + v.y * 5.0) * Math.sin(v.y * 6.0 + v.z * 4.0) +
      0.25 * Math.sin(v.z * 5.5 + v.x * 4.5);
    const d = 1 + (n - 0.5) * 0.14;
    pos.setXYZ(i, v.x * d, v.y * d, v.z * d);
  }
  shell.computeVertexNormals();
  const rim = new THREE.TorusGeometry(0.503, 0.05, 8, 32);
  rim.rotateX(Math.PI / 2);
  const geo = mergeGeometries([shell, rim], false);
  shell.dispose();
  rim.dispose();
  return geo;
}

// Núcleo del seeker: orbe + cola cónica (misma malla, un solo draw).
function makeSeekerCoreGeometry() {
  const orb = new THREE.SphereGeometry(0.3, 22, 16);
  const tail = new THREE.ConeGeometry(0.16, 0.52, 14);
  tail.rotateX(Math.PI / 2);
  tail.translate(0, 0, -0.44);
  const geo = mergeGeometries([orb, tail], false);
  orb.dispose();
  tail.dispose();
  return geo;
}

// Anillos orbitando: dos toros cruzados en la misma malla.
function makeSeekerRingGeometry() {
  const a = new THREE.TorusGeometry(0.46, 0.035, 8, 32);
  a.rotateX(Math.PI / 2);
  const b = new THREE.TorusGeometry(0.4, 0.03, 8, 32);
  b.rotateY(Math.PI / 2);
  const geo = mergeGeometries([a, b], false);
  a.dispose();
  b.dispose();
  return geo;
}

// Nube de tormenta: esfera suave deformada (se instancia varias veces por nube).
function makeCloudGeometry() {
  const geo = new THREE.SphereGeometry(0.5, 18, 14);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = fbm(v.x * 3 + 5, v.z * 3 + 2, 3) - 0.5;
    const d = 1 + n * 0.35;
    pos.setXYZ(i, v.x * d, v.y * d, v.z * d);
  }
  geo.computeVertexNormals();
  return geo;
}

// Fragmento de la caja al romperse.
function makeShardGeometry() {
  return new THREE.TetrahedronGeometry(0.13, 0);
}

// ---------------------------------------------------------------------------
// Shaders propios (fresnel arcoíris, arcoíris de la caja)
// ---------------------------------------------------------------------------

const HSV = /* glsl */ `
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}
`;

// Shell arcoíris de la caja: banda de color que recorre la caja en vertical.
function makeRainbowMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vLocal;
      varying vec3 vNormalW;
      void main() {
        vLocal = position;
        #ifdef USE_INSTANCING
          vNormalW = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
          vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        #else
          vNormalW = normalize(mat3(modelMatrix) * normal);
          vec4 wp = modelMatrix * vec4(position, 1.0);
        #endif
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vLocal;
      varying vec3 vNormalW;
      ${HSV}
      void main() {
        float ang = atan(vLocal.z, vLocal.x);
        float sweep = fract(vLocal.y * 0.75 - uTime * 0.45 + ang * 0.12);
        vec3 col = hsv2rgb(vec3(sweep, 0.85, 1.0));
        float band = smoothstep(0.0, 0.16, sweep) * smoothstep(1.0, 0.7, sweep);
        float rim = pow(1.0 - abs(vNormalW.y) * 0.4, 1.5);
        float a = (0.07 + 0.45 * band) * rim;
        gl_FragColor = vec4(col * (0.35 + band * 1.2), a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
  });
}

// Fresnel arcoíris ondulante (escudo y aura).
function makeShieldMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vNormalW;
      varying vec3 vWorldPos;
      void main() {
        #ifdef USE_INSTANCING
          vNormalW = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
          vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        #else
          vNormalW = normalize(mat3(modelMatrix) * normal);
          vec4 wp = modelMatrix * vec4(position, 1.0);
        #endif
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vNormalW;
      varying vec3 vWorldPos;
      ${HSV}
      void main() {
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float fres = pow(1.0 - clamp(dot(normalize(vNormalW), viewDir), 0.0, 1.0), 2.2);
        float hue = fract(vWorldPos.y * 0.22 + uTime * 0.14);
        vec3 col = hsv2rgb(vec3(hue, 0.85, 1.0));
        float ripple = 0.65 + 0.35 * sin(vWorldPos.y * 7.0 - uTime * 6.0);
        float a = fres * (0.55 + 0.45 * ripple);
        gl_FragColor = vec4(col * (fres * ripple * 1.9 + 0.15), a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

// Fresnel del orbe de energía del seeker.
function makeSeekerShellMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vNormalW;
      varying vec3 vWorldPos;
      void main() {
        #ifdef USE_INSTANCING
          vNormalW = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
          vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        #else
          vNormalW = normalize(mat3(modelMatrix) * normal);
          vec4 wp = modelMatrix * vec4(position, 1.0);
        #endif
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vNormalW;
      varying vec3 vWorldPos;
      void main() {
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float fres = pow(1.0 - clamp(dot(normalize(vNormalW), viewDir), 0.0, 1.0), 2.0);
        vec3 hot = vec3(1.0, 0.75, 0.25);
        vec3 cold = vec3(1.0, 0.25, 0.05);
        vec3 col = mix(cold, hot, fres);
        float flick = 0.85 + 0.15 * sin(uTime * 30.0 + vWorldPos.y * 12.0);
        gl_FragColor = vec4(col * fres * 2.8 * flick, fres * 0.9);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
  });
}

// ---------------------------------------------------------------------------
// Constructor de assets (cacheado a nivel de módulo)
// ---------------------------------------------------------------------------

let _assets = null;

export function getAssets() {
  if (_assets) return _assets;
  _assets = buildAssets();
  return _assets;
}

export function disposeAssets() {
  if (!_assets) return;
  _assets.disposables.forEach((d) => {
    if (d && typeof d.dispose === 'function') d.dispose();
  });
  _assets = null;
}

function buildAssets() {
  const disposables = [];
  const keep = (x) => {
    disposables.push(x);
    return x;
  };

  // --- texturas ---
  const peelTex = makePeelTextures();
  disposables.push(peelTex.map, peelTex.normalMap);
  const bouncerTex = makeBouncerTextures();
  disposables.push(bouncerTex.map, bouncerTex.normalMap);
  const blobTex = keep(makeBlobTexture());
  const sparkTex = keep(makeSparkTexture());

  // --- geometrías ---
  const boxGeo = keep(new RoundedBoxGeometry(1.24, 1.24, 1.24, 6, 0.22));
  const questionGeo = keep(makeQuestionGeometry());
  const rainbowGeo = keep(new RoundedBoxGeometry(1.34, 1.34, 1.34, 4, 0.24));
  const shardGeo = keep(makeShardGeometry());
  const peelGeo = keep(makePeelGeometry());
  const bouncerGeo = keep(makeBouncerGeometry());
  const seekerCoreGeo = keep(makeSeekerCoreGeometry());
  const seekerRingGeo = keep(makeSeekerRingGeometry());
  const seekerShellGeo = keep(new THREE.SphereGeometry(0.52, 22, 16));
  const shieldGeo = keep(new THREE.SphereGeometry(1.0, 32, 20));
  const cloudGeo = keep(makeCloudGeometry());
  const blobGeo = (() => {
    const g = new THREE.PlaneGeometry(1, 1);
    g.rotateX(-Math.PI / 2);
    return keep(g);
  })();
  const flashGeo = keep(new THREE.IcosahedronGeometry(0.5, 2));

  // --- materiales ---
  const boxMat = keep(
    new THREE.MeshPhysicalMaterial({
      color: 0x2a2350,
      roughness: 0.05,
      metalness: 0.0,
      transmission: 0.9,
      thickness: 0.7,
      ior: 1.45,
      iridescence: 1.0,
      iridescenceIOR: 1.35,
      iridescenceThicknessRange: [100, 460],
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      envMapIntensity: 0.85,
      transparent: true,
    })
  );

  const questionMat = keep(
    new THREE.MeshStandardMaterial({
      color: 0x0b0b22,
      emissive: 0xcfeaff,
      emissiveIntensity: 3.4,
      roughness: 0.28,
      metalness: 0.1,
    })
  );

  const rainbowMat = keep(makeRainbowMaterial());

  const shardMat = keep(
    new THREE.MeshPhysicalMaterial({
      color: 0xbfe2ff,
      emissive: 0x4a3ab0,
      emissiveIntensity: 0.5,
      roughness: 0.08,
      metalness: 0.0,
      ior: 1.45,
      iridescence: 1.0,
      iridescenceIOR: 1.3,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      envMapIntensity: 1.4,
      transparent: true,
      opacity: 0.9,
    })
  );

  const peelMat = keep(
    new THREE.MeshPhysicalMaterial({
      map: peelTex.map,
      normalMap: peelTex.normalMap,
      normalScale: new THREE.Vector2(0.6, 0.6),
      roughness: 0.42,
      metalness: 0.0,
      clearcoat: 0.35,
      clearcoatRoughness: 0.4,
      sheen: 0.4,
      sheenColor: new THREE.Color(0xfff0b0),
      envMapIntensity: 1.0,
    })
  );

  const bouncerMat = keep(
    new THREE.MeshPhysicalMaterial({
      map: bouncerTex.map,
      normalMap: bouncerTex.normalMap,
      normalScale: new THREE.Vector2(1.1, 1.1),
      color: 0xffffff,
      roughness: 0.34,
      metalness: 0.15,
      clearcoat: 0.85,
      clearcoatRoughness: 0.2,
      emissive: 0x0a3a14,
      emissiveIntensity: 0.5,
      envMapIntensity: 1.2,
    })
  );

  const seekerCoreMat = keep(
    new THREE.MeshStandardMaterial({
      color: 0x2a0500,
      emissive: 0xff5a10,
      emissiveIntensity: 2.6,
      roughness: 0.25,
      metalness: 0.2,
    })
  );

  const seekerRingMat = keep(
    new THREE.MeshStandardMaterial({
      color: 0x442200,
      emissive: 0xffb020,
      emissiveIntensity: 1.8,
      roughness: 0.35,
      metalness: 0.4,
    })
  );

  const seekerShellMat = keep(makeSeekerShellMaterial());
  const shieldMat = keep(makeShieldMaterial());

  const cloudMat = keep(
    new THREE.MeshStandardMaterial({
      color: 0x151826,
      emissive: 0x1a2038,
      emissiveIntensity: 0.35,
      roughness: 0.95,
      metalness: 0.0,
      transparent: true,
      opacity: 0.66,
      depthWrite: false,
    })
  );

  const blobMat = keep(
    new THREE.MeshBasicMaterial({
      map: blobTex,
      transparent: true,
      color: 0x000000,
      opacity: 0.5,
      depthWrite: false,
    })
  );

  const sparkMat = keep(
    new THREE.PointsMaterial({
      map: sparkTex,
      size: 0.3,
      sizeAttenuation: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
    })
  );

  const flashMat = keep(
    new THREE.MeshBasicMaterial({
      color: 0xdff0ff,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );

  const boltMat = keep(
    new THREE.LineBasicMaterial({
      color: 0xbfe4ff,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );

  // El rayo reutiliza un BufferGeometry con capacidad fija.
  const MAX_BOLT_VERTS = 8 * 2 * 7; // vértices de segmentos para hasta 7 rayos
  const boltPositions = new Float32Array(MAX_BOLT_VERTS * 3);
  const boltGeo = keep(new THREE.BufferGeometry());
  boltGeo.setAttribute('position', new THREE.BufferAttribute(boltPositions, 3));
  boltGeo.setDrawRange(0, 0);

  return {
    // geometrías
    boxGeo,
    questionGeo,
    rainbowGeo,
    shardGeo,
    peelGeo,
    bouncerGeo,
    seekerCoreGeo,
    seekerRingGeo,
    seekerShellGeo,
    shieldGeo,
    cloudGeo,
    blobGeo,
    flashGeo,
    boltGeo,
    boltPositions,
    MAX_BOLT_VERTS,
    // materiales
    boxMat,
    questionMat,
    rainbowMat,
    shardMat,
    peelMat,
    bouncerMat,
    seekerCoreMat,
    seekerRingMat,
    seekerShellMat,
    shieldMat,
    cloudMat,
    blobMat,
    sparkMat,
    flashMat,
    boltMat,
    disposables,
  };
}
