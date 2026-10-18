// Bloque 2 — Pilotos orgánicos y expresivos (tanda 3).
// Cabezones (~45 % de la altura), formas redondeadas construidas con esferas y
// cápsulas de alta resolución deformadas y soldadas. Cara con esclerótica,
// iris, pupila y brillo, párpados, cejas y boca deformable mediante morph
// targets. Vísceras internas: aquí solo geometría; los materiales en materials.js.
//
// Coordenadas del piloto: origen en la base (asiento), +Z = adelante del kart.

import * as THREE from 'three';
import { xf, blob, cap, ball, tube, torus, mergeParts, weld, sNoise } from './geo.js';

export const ANCHORS = {
  head: { x: 0, y: 0.62, z: 0.0 },
  arms: { x: 0, y: 0.3, z: 0.08 },
};

const HEAD_R = 0.2;

// Escala del piloto respecto al kart (tanda 4): estilo "cabezón".
export const PILOT_SCALE = 1.3;
// Escala extra de la cabeza sobre el cuerpo.
export const HEAD_SCALE = 1.15;

// ---------------------------------------------------------------------------
// Utilidades de construcción
// ---------------------------------------------------------------------------

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Cono suave soldado (pelo en punta, crestas...).
function cone(r, h, seg = 8) {
  const g = new THREE.ConeGeometry(r, h, seg);
  g.translate(0, h / 2, 0);
  return weld(g);
}

// Rota una parte alrededor de un punto base y un eje. Devuelve fn de morph delta.
function bendMorph(base, axis, angle) {
  const q = new THREE.Quaternion().setFromAxisAngle(axis.clone().normalize(), angle);
  const v = new THREE.Vector3();
  const b = base.clone();
  return (x, y, z) => {
    v.set(x, y, z).sub(b).applyQuaternion(q).add(b);
    return [v.x - x, v.y - y, v.z - z];
  };
}

// Cápsula que une dos puntos (para brazos / patas / colas).
function limb(a, b, r) {
  const dir = b.clone().sub(a);
  const len = dir.length() || 0.001;
  const geo = new THREE.CapsuleGeometry(r, Math.max(0.01, len - 2 * r), 6, 14);
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir.clone().normalize());
  geo.applyQuaternion(q);
  geo.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return geo;
}

// Esfera pequena soldada (ojos, narices, guantes...).
const orb = (r, seg = 16) => ball(r, seg);

// Cabezas elípticas analíticas (frog / numbat): permiten pegar a la piel la
// boca, los parches de color y las gafas sin que floten ni se hundan.
const ellipsoidHead = (cx, cy, cz, a, b, c) => ({
  cx, cy, cz, a, b, c,
  // z de la superficie delantera (+z) en (x, y); 0-ish si queda fuera.
  z(x, y) {
    const t = 1 - ((x - cx) / a) ** 2 - ((y - cy) / b) ** 2;
    return cz + c * Math.sqrt(Math.max(0, t));
  },
  // y de la superficie superior en (x, z).
  y(x, z) {
    const t = 1 - ((x - cx) / a) ** 2 - ((z - cz) / c) ** 2;
    return cy + b * Math.sqrt(Math.max(0, t));
  },
  normal(p) {
    return V((p.x - cx) / (a * a), (p.y - cy) / (b * b), (p.z - cz) / (c * c)).normalize();
  },
});

// Coloca una geometría local (x = tangente, y = bitangente, z = normal) en el
// punto p con normal n.
function orientTo(geo, p, n) {
  const nn = n.clone().normalize();
  const t = new THREE.Vector3().crossVectors(V(0, 1, 0), nn);
  if (t.lengthSq() < 1e-6) t.set(1, 0, 0);
  t.normalize();
  const b = new THREE.Vector3().crossVectors(nn, t);
  geo.applyMatrix4(new THREE.Matrix4().makeBasis(t, b, nn).setPosition(p));
  return geo;
}

// Parche aplanado pegado a la piel (manchas, mejillas, fosas nasales...).
function patchPart(p, n, rx, ry, th, color, roll = 0, seg = 14) {
  const g = xf(ball(1, seg), { sx: rx, sy: ry, sz: th, rz: roll });
  return { geo: orientTo(g, p, n), color };
}

// Tubo de sección circular siguiendo una curva (correas, aros, rayas).
function tubePath(points, r, closed = false, tubular = 48, radial = 8) {
  const curve = new THREE.CatmullRomCurve3(points, closed, 'catmullrom', 0.5);
  return weld(new THREE.TubeGeometry(curve, tubular, r, radial, closed));
}

// Malla en rejilla (u, v) en [0,1]: fn(u, v) → [x, y, z]. flip invierte la cara.
function gridGeo(nu, nv, fn, flip = false) {
  const pos = [];
  const idx = [];
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) pos.push(...fn(i / nu, j / nv));
  }
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i;
      const b = a + 1;
      const c = a + nu + 1;
      const d = c + 1;
      if (flip) idx.push(a, b, c, b, d, c);
      else idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Estira verticalmente (alrededor de y0) una malla de tubo: franjas más anchas.
function deformY(geo, y0, k) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, y0 + (p.getY(i) - y0) * k);
  geo.computeVertexNormals();
  return geo;
}

// Base ortonormal [x, y, z] con z a lo largo de dir (para anillos alrededor de un eje).
function basisFromDir(dir) {
  const z = dir.clone().normalize();
  const up = Math.abs(z.y) > 0.95 ? V(1, 0, 0) : V(0, 1, 0);
  const x = new THREE.Vector3().crossVectors(up, z).normalize();
  const y = new THREE.Vector3().crossVectors(z, x);
  return [x, y, z];
}

// Extensión (radio en x, z mínimo y máximo) de una malla en la altura y.
function sliceExtent(geo, y, tol = 0.012) {
  const p = geo.attributes.position;
  let rx = 0;
  let zMin = Infinity;
  let zMax = -Infinity;
  for (let i = 0; i < p.count; i++) {
    if (Math.abs(p.getY(i) - y) > tol) continue;
    rx = Math.max(rx, Math.abs(p.getX(i)));
    zMin = Math.min(zMin, p.getZ(i));
    zMax = Math.max(zMax, p.getZ(i));
  }
  if (!isFinite(zMin)) return { rx: 0.1, zMin: -0.1, zMax: 0.1 };
  return { rx, zMin, zMax };
}

const FROG_HEAD = ellipsoidHead(0, 0.59, 0.04, 0.255, 0.17, 0.195);
const NUMBAT_HEAD = ellipsoidHead(0, ANCHORS.head.y, 0.0, 0.19, 0.2, 0.205);

// ---------------------------------------------------------------------------
// Cara geométrica: esclerótica + brillo + iris + pupila con morphs de mirada,
// párpados con morph de parpadeo, cejas con morphs, boca con morphs.
// ---------------------------------------------------------------------------

function buildEye(face, e, irisColor) {
  const eye0 = V(e.x, e.y, e.z);
  // Globo ocular + brillo especular.
  face.push({ geo: xf(orb(e.r, 14), { x: e.x, y: e.y, z: e.z }), color: 0xfdfdff });
  face.push({
    geo: xf(orb(e.r * 0.3, 8), { x: e.x - e.r * 0.3, y: e.y + e.r * 0.36, z: e.z + e.r * 0.7 }),
    color: 0xffffff,
  });
  face.push({
    geo: xf(orb(e.r * 0.15, 6), { x: e.x + e.r * 0.34, y: e.y - e.r * 0.3, z: e.z + e.r * 0.72 }),
    color: 0xffffff,
  });

  // Iris + pupila, con morphs de mirada.
  const look = {
    lookL: (x, y, z) => [-e.r * 0.2, 0, 0],
    lookR: (x, y, z) => [e.r * 0.2, 0, 0],
    lookU: (x, y, z) => [0, e.r * 0.16, 0],
    lookD: (x, y, z) => [0, -e.r * 0.16, 0],
  };
  const irisR = e.r * 0.6;
  const iz = e.z + e.r * 0.66;
  face.push({
    geo: xf(orb(irisR, 12), { x: e.x, y: e.y, z: iz, sz: 0.5 }),
    color: irisColor,
    morphs: look,
  });
  face.push({
    geo: xf(orb(irisR * 0.52, 10), { x: e.x, y: e.y, z: iz + irisR * 0.42, sz: 0.6 }),
    color: 0x0b0c10,
    morphs: look,
  });

  // Párpado superior: casquete orientado arriba-adelante.
  const lidR = e.r * 1.06;
  let lid = new THREE.SphereGeometry(lidR, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.62);
  xf(lid, { x: e.x, y: e.y, z: e.z, rx: -1.05 });
  const closeAngle = 1.85;
  face.push({
    geo: lid,
    color: e.lidColor,
    morphs: { blink: bendMorph(eye0, V(1, 0, 0), closeAngle) },
  });
}

function buildBrow(face, side, e, colors) {
  const len = e.r * (e.browLen || 1.5);
  const anchor = V(e.x - side * e.r * 0.72, e.y + e.r * (e.browH ?? 0.86), e.z + e.r * 0.5);
  let g = new THREE.CapsuleGeometry(e.browR || 0.011, len, 4, 8);
  xf(g, { rz: Math.PI / 2, rx: 0.15 });
  xf(g, { x: anchor.x + side * len * 0.5, y: anchor.y + (e.browLift ?? 0.02), z: anchor.z });
  const raise = (x, y, z) => [0, 0.03, 0];
  const angry = bendMorph(anchor, V(0, 0, 1), side * 0.85);
  face.push({
    geo: g,
    color: e.browColor || colors.accent,
    morphs: { browRaise: raise, browAngry: angry },
  });
}

function buildMouth(face, m, mouthColor, teethColor) {
  const c = V(m.x, m.y, m.z);
  const R = m.R;
  const ring = torus(R, m.tube, 8, 20);
  xf(ring, { x: c.x, y: c.y, z: c.z, rx: m.tilt || 0 });
  const hide = R * 2.1;
  // Sonrisa: se oculta la mitad superior (hacia dentro), queda el arco inferior.
  const smile = (x, y, z) => (y > c.y ? [0, 0, -hide] : [0, -R * 0.08, 0]);
  const big = (x, y, z) => (y > c.y ? [0, 0, -hide] : [0, -R * 0.22, x > c.x ? R * 0.16 : -R * 0.16]);
  const o = (x, y, z) => [0, 0, 0];
  const frown = (x, y, z) => (y < c.y ? [0, 0, -hide] : [0, R * 0.05, 0]);
  const grit = (x, y, z) => [0, 0, -hide * 0.9];
  face.push({
    geo: ring,
    color: mouthColor,
    morphs: { mouthSmile: smile, mouthBig: big, mouthO: o, mouthFrown: frown, mouthGrit: grit },
  });

  // Dientes: banda blanca que asoma al abrir la boca o apretar.
  const teeth = xf(new THREE.BoxGeometry(R * 1.2, R * 0.22, 0.02), { x: c.x, y: c.y + R * 0.1, z: c.z - R * 0.4 });
  const showTeeth = (x, y, z) => [0, 0, R * 0.62];
  face.push({ geo: teeth, color: teethColor, morphs: { mouthGrit: showTeeth, mouthO: showTeeth } });
}

// Boca que sigue la superficie de la cabeza (frog / numbat). m: { x, y, R, Ry,
// tube, follow(x, y) → z, hide, fill?: color }. La línea es un tubo elíptico;
// los morphs reutilizan los mismos nombres que buildMouth (mouthSmile, ...).
// Con fill, una "cavidad" oscura aflora al abrir la boca (big / o).
function buildMouthFollow(face, m, mouthColor) {
  const { x: cx, y: cy, R, Ry, tube: tr, follow } = m;
  const hide = m.hide ?? R * 0.7;
  const dz = (x, y, dy) => follow(x, y + dy) - follow(x, y);
  const pts = [];
  const N = 72;
  for (let k = 0; k < N; k++) {
    const a = (k / N) * Math.PI * 2;
    const x = cx + R * Math.cos(a);
    const y = cy + Ry * Math.sin(a);
    pts.push(V(x, y, follow(x, y) + tr * 0.3));
  }
  const ring = tubePath(pts, tr, true, 120, 8);
  const sag = (k) => -Ry * k;
  const lowerOnly = (up, down) => (x, y, z) => (y > cy ? up(x, y, z) : down(x, y, z));
  const hideUp = () => [0, 0, -hide];
  face.push({
    geo: ring,
    color: mouthColor,
    morphs: {
      mouthSmile: lowerOnly(hideUp, (x, y) => [0, sag(0.12), dz(x, y, sag(0.12))]),
      mouthBig: lowerOnly(hideUp, (x, y) => [0, sag(0.95), dz(x, y, sag(0.95))]),
      mouthO: (x, y, z) => [0, 0, 0],
      mouthFrown: (x, y, z) =>
        y < cy ? [0, 0, -hide] : [0, Ry * 0.5, dz(x, y, Ry * 0.5)],
      mouthGrit: () => [0, 0, -hide * 0.9],
    },
  });

  if (m.fill) {
    const sink = 0.03;
    const half = (sign) =>
      gridGeo(
        28,
        5,
        (u, v) => {
          const uu = u * 2 - 1;
          const x = cx + uu * (R - tr * 0.8);
          const y = cy + sign * v * Ry * Math.sqrt(Math.max(0, 1 - uu * uu)) * 0.98;
          return [x, y, follow(x, y) - sink];
        },
        sign > 0
      );
    const prof = (x) => Math.sqrt(Math.max(1e-4, 1 - ((x - cx) / R) ** 2));
    const lowerFill = (k) => (x, y) => {
      const v = Math.min(1, Math.max(0, (cy - y) / (Ry * prof(x))));
      const dy = sag(k) * v;
      return [0, dy, dz(x, y, dy) + sink + 0.012];
    };
    face.push({
      geo: half(-1),
      color: m.fill,
      morphs: { mouthBig: lowerFill(0.95), mouthO: lowerFill(0) },
    });
    face.push({
      geo: half(1),
      color: m.fill,
      morphs: { mouthO: (x, y) => [0, 0, sink + 0.012] },
    });
  }
}

// ---------------------------------------------------------------------------
// Configuración de cara por especie (en espacio final de la cabeza).
// ---------------------------------------------------------------------------

function faceConfig(species, colors, head) {
  const hx = head.x;
  const hy = head.y;
  const hz = head.z;
  const base = {
    browColor: 0x2a2028,
    mouthColor: 0x3a1620,
    teethColor: 0xffffff,
  };
  switch (species) {
    case 'fox':
      return {
        ...base,
        eyes: [
          { x: hx - 0.085, y: hy + 0.05, z: hz + 0.155, r: 0.052, lidColor: colors.body, browColor: 0x5a3410 },
          { x: hx + 0.085, y: hy + 0.05, z: hz + 0.155, r: 0.052, lidColor: colors.body, browColor: 0x5a3410 },
        ],
        iris: 0x7a4a12,
        mouth: { x: hx, y: hy - 0.06, z: hz + 0.235, R: 0.045, tube: 0.013 },
      };
    case 'frog': {
      const H = FROG_HEAD;
      const skin = (colors.look || {}).skinColor || colors.body;
      return {
        ...base,
        mouthColor: 0x0f2a14,
        eyes: [-1, 1].map((sd) => ({
          x: sd * 0.12,
          y: H.y(0.12, 0.07) + 0.002,
          z: H.cz + 0.07,
          r: 0.07,
          lidColor: skin,
          browColor: 0x23863a,
          browR: 0.017,
          browLen: 1.15,
          browH: 0.8,
          browLift: 0.004,
        })),
        iris: 0xc9a227,
        mouth: {
          x: 0,
          y: H.cy - 0.03,
          R: 0.2,
          Ry: 0.062,
          tube: 0.011,
          hide: 0.13,
          fill: 0x3d0f1a,
          follow: (x, y) => H.z(x, y),
        },
      };
    }
    case 'penguin':
      return {
        ...base,
        eyes: [
          { x: hx - 0.075, y: hy + 0.055, z: hz + 0.15, r: 0.045, lidColor: colors.body },
          { x: hx + 0.075, y: hy + 0.055, z: hz + 0.15, r: 0.045, lidColor: colors.body },
        ],
        iris: 0x2b6bb0,
        mouth: null,
      };
    case 'bear':
      return {
        ...base,
        eyes: [
          { x: hx - 0.088, y: hy + 0.045, z: hz + 0.155, r: 0.05, lidColor: colors.body, browColor: 0x4a2e12 },
          { x: hx + 0.088, y: hy + 0.045, z: hz + 0.155, r: 0.05, lidColor: colors.body, browColor: 0x4a2e12 },
        ],
        iris: 0x5a3a1a,
        mouth: { x: hx, y: hy - 0.07, z: hz + 0.215, R: 0.04, tube: 0.012 },
      };
    case 'cat':
      return {
        ...base,
        eyes: [
          { x: hx - 0.082, y: hy + 0.05, z: hz + 0.16, r: 0.052, lidColor: colors.body, browColor: 0xd08aa8 },
          { x: hx + 0.082, y: hy + 0.05, z: hz + 0.16, r: 0.052, lidColor: colors.body, browColor: 0xd08aa8 },
        ],
        iris: 0x3fae3a,
        mouth: { x: hx, y: hy - 0.07, z: hz + 0.2, R: 0.038, tube: 0.011 },
      };
    case 'dino':
      return {
        ...base,
        eyes: [
          { x: hx - 0.095, y: hy + 0.1, z: hz + 0.16, r: 0.055, lidColor: colors.body, browColor: 0x1c6b38 },
          { x: hx + 0.095, y: hy + 0.1, z: hz + 0.16, r: 0.055, lidColor: colors.body, browColor: 0x1c6b38 },
        ],
        iris: 0xe0a81e,
        mouth: { x: hx, y: hy - 0.05, z: hz + 0.34, R: 0.05, tube: 0.015 },
      };
    case 'rabbit':
      return {
        ...base,
        eyes: [
          { x: hx - 0.088, y: hy + 0.05, z: hz + 0.16, r: 0.052, lidColor: colors.body, browColor: 0xd8c0c0 },
          { x: hx + 0.088, y: hy + 0.05, z: hz + 0.16, r: 0.052, lidColor: colors.body, browColor: 0xd8c0c0 },
        ],
        iris: 0xc4587a,
        mouth: { x: hx, y: hy - 0.07, z: hz + 0.2, R: 0.038, tube: 0.011 },
      };
    case 'mechanic':
      return {
        ...base,
        mouthColor: 0x5a2a20,
        eyes: [
          { x: hx - 0.092, y: hy + 0.03, z: hz + 0.15, r: 0.056, lidColor: (colors.look || {}).skinColor || 0xf1c39a, browColor: (colors.look || {}).mustacheColor || 0x6b3f1d, browR: 0.02, browLen: 1.4 },
          { x: hx + 0.092, y: hy + 0.03, z: hz + 0.15, r: 0.056, lidColor: (colors.look || {}).skinColor || 0xf1c39a, browColor: (colors.look || {}).mustacheColor || 0x6b3f1d, browR: 0.02, browLen: 1.4 },
        ],
        iris: 0x4a2f14,
        mouth: { x: hx, y: hy - 0.045, z: hz + 0.205, R: 0.052, tube: 0.013 },
      };
    case 'fighter':
      return {
        ...base,
        mouthColor: 0x5a2430,
        eyes: [
          { x: hx - 0.088, y: hy + 0.045, z: hz + 0.158, r: 0.052, lidColor: (colors.look || {}).skinColor || 0xf1c9a0, browColor: (colors.look || {}).hairColor || 0xc9d3dd, browR: 0.014, browLen: 1.5 },
          { x: hx + 0.088, y: hy + 0.045, z: hz + 0.158, r: 0.052, lidColor: (colors.look || {}).skinColor || 0xf1c9a0, browColor: (colors.look || {}).hairColor || 0xc9d3dd, browR: 0.014, browLen: 1.5 },
        ],
        iris: 0x1a8f86,
        mouth: { x: hx, y: hy - 0.06, z: hz + 0.205, R: 0.04, tube: 0.012 },
      };
    case 'numbat': {
      const H = NUMBAT_HEAD;
      const mask = (colors.look || {}).maskColor || 0x2a1812;
      return {
        ...base,
        mouthColor: 0x2a1410,
        eyes: [-1, 1].map((sd) => ({
          x: sd * 0.088,
          y: H.cy + 0.03,
          z: H.z(0.088, H.cy + 0.03) - 0.012,
          r: 0.04,
          lidColor: mask,
          browColor: mask,
          browR: 0.0095,
          browLen: 1.3,
          browH: 0.8,
          browLift: 0.0,
        })),
        iris: 0x3a2414,
        mouth: {
          x: 0,
          y: H.cy - 0.108,
          R: 0.085,
          Ry: 0.04,
          tube: 0.009,
          hide: 0.1,
          fill: 0x3a1214,
          follow: (x, y) => H.z(x, y),
        },
      };
    }
    default:
      return {
        ...base,
        eyes: [
          { x: hx - 0.085, y: hy + 0.05, z: hz + 0.155, r: 0.05, lidColor: colors.body },
          { x: hx + 0.085, y: hy + 0.05, z: hz + 0.155, r: 0.05, lidColor: colors.body },
        ],
        iris: 0x3a6bd0,
        mouth: { x: hx, y: hy - 0.07, z: hz + 0.2, R: 0.04, tube: 0.012 },
      };
  }
}

// Cabeza base: esfera deformada con mejillas y mentón, más hocico opcional.
function headShell(deformFn) {
  return blob(HEAD_R, deformFn, 38, 26);
}

// ---------------------------------------------------------------------------
// Construcción por especie
// ---------------------------------------------------------------------------

function buildCommon() {
  const body = [];
  const head = [];
  const face = [];
  const arms = [];
  const glow = [];
  return { body, head, face, arms, glow };
}

// Torso redondeado con caderas y cuello.
function torsoParts() {
  let torso = blob(0.19, (v) => {
    const t = v.y / 0.19;
    const hip = 1 + 0.4 * Math.max(0, -t);
    v.x *= hip;
    v.z *= 0.8 * hip;
    const top = Math.max(0, t);
    v.x *= 1 - 0.28 * top;
    v.z *= 1 - 0.28 * top;
    v.y *= 1.14;
    v.y += 0.26;
  });
  return torso;
}

function buildArms(colors, handY = 0.24, handZ = 0.52, handX = 0.13) {
  const arms = [];
  const r = 0.05;
  for (const side of [1, -1]) {
    const shoulder = V(side * 0.17, 0.3, 0.02);
    const hand = V(side * handX, handY, handZ);
    arms.push({ geo: limb(shoulder, hand, r), color: colors.body });
    arms.push({ geo: xf(orb(0.072, 12), { x: hand.x, y: hand.y, z: hand.z }), color: colors.accent });
  }
  return arms;
}

// ---------------------------------------------------------------------------
// Por especie
// ---------------------------------------------------------------------------

function buildFox(colors, body, head, face, arms) {
  const b = colors.body;
  const a = colors.accent;
  body.push({ geo: torsoParts(), color: b });
  // Pecho claro.
  body.push({ geo: xf(blob(0.12, null, 24, 18), { x: 0, y: 0.27, z: 0.12, sx: 0.85, sy: 1.1, sz: 0.55 }), color: 0xfff2df });

  // Cabeza: hocico afilado hacia +Z, pómulos suaves.
  const shell = headShell((v) => {
    const zt = (v.z / HEAD_R + 1) / 2;
    v.x *= 1.06 - 0.28 * zt;
    v.y *= 1.0 - 0.2 * zt;
    if (v.z > 0) v.z *= 1.12;
    const cheek = Math.exp(-((Math.abs(v.x) - 0.09) ** 2 + (v.y + 0.02) ** 2) * 60);
    v.x += Math.sign(v.x) * cheek * 0.012;
  });
  head.push({ geo: xf(shell, ANCHORS.head), color: b });
  // Hocico.
  head.push({ geo: xf(blob(0.085, (v) => { v.z *= 1.7; v.y *= 0.8; v.x *= 0.8; }, 30, 20), { x: ANCHORS.head.x, y: ANCHORS.head.y - 0.055, z: ANCHORS.head.z + 0.2 }), color: 0xfff2df });
  // Nariz.
  head.push({ geo: xf(orb(0.032, 14), { x: ANCHORS.head.x, y: ANCHORS.head.y - 0.04, z: ANCHORS.head.z + 0.345 }), color: 0x1b1418 });
  // Orejas grandes con interior claro.
  for (const side of [1, -1]) {
    const base = V(ANCHORS.head.x + side * 0.11, ANCHORS.head.y + 0.16, ANCHORS.head.z - 0.02);
    let ear = blob(0.075, (v) => {
      v.y += 0.11;
      const t = (v.y - 0.11) / 0.075;
      v.x *= 1 - 0.4 * Math.max(0, t);
      v.z *= 1 - 0.3 * Math.max(0, t);
      v.y *= 1.9;
    }, 26, 20);
    xf(ear, { x: base.x, y: base.y, z: base.z, rz: side * -0.2 });
    const morphs = {
      earBend: bendMorph(base, V(1, 0, 0), -0.7),
      earWag: bendMorph(base, V(0, 0, 1), side * 0.45),
    };
    head.push({ geo: ear, color: b, morphs });
    head.push({ geo: xf(orb(0.045, 12), { x: base.x + side * 0.005, y: base.y + 0.07, z: base.z + 0.045, sy: 1.7 }), color: a, morphs: { earBend: morphs.earBend, earWag: morphs.earWag } });
  }
  // Cola esponjosa con punta clara (morph).
  const tailBase = V(0, 0.2, -0.15);
  let tail = blob(0.1, (v) => { v.y += 0.0; v.z *= 1; v.x *= 0.9; v.y *= 0.9; v.z *= 2.4; }, 24, 18);
  xf(tail, { x: tailBase.x, y: tailBase.y - 0.05, z: tailBase.z - 0.22, rx: 0.5 });
  const tailM = { tailSwing: bendMorph(tailBase, V(0, 1, 0), 0.4), tailUp: bendMorph(tailBase, V(1, 0, 0), -0.5) };
  body.push({ geo: tail, color: b, morphs: tailM });
  body.push({ geo: xf(orb(0.08, 16), { x: tailBase.x, y: tailBase.y + 0.03, z: tailBase.z - 0.62, sy: 1.3 }), color: a, morphs: tailM });

  buildArmsCommon(colors, arms);
}

function buildArmsCommon(colors, arms) {
  const built = buildArms(colors);
  for (const p of built) arms.push(p);
}

function buildRobot(colors, body, head, face, arms) {
  const b = colors.body;
  const a = colors.accent;
  body.push({ geo: torsoParts(), color: b });
  // Placa pectoral.
  body.push({ geo: xf(cap(0.09, 0.1), { x: 0, y: 0.3, z: 0.14, rx: Math.PI / 2, sx: 1.4, sz: 0.5 }), color: a });
  body.push({ geo: xf(tube(0.03, 0.03, 0.03, 14), { x: 0, y: 0.3, z: 0.19, rx: Math.PI / 2 }), color: 0xffd23f });
  // Cabeza cápsula.
  let shell = cap(HEAD_R * 0.92, 0.1, (v) => { v.x *= 1.02; v.z *= 1.0; });
  head.push({ geo: xf(shell, ANCHORS.head), color: b });
  // Aro / antena.
  head.push({ geo: xf(tube(0.012, 0.012, 0.16, 8), { x: 0, y: ANCHORS.head.y + 0.22, z: ANCHORS.head.z - 0.02 }), color: 0x5b6572 });
  head.push({ geo: xf(orb(0.038, 12), { x: 0, y: ANCHORS.head.y + 0.3, z: ANCHORS.head.z - 0.02 }), color: a });
  // Orejas-auriculares laterales.
  for (const side of [1, -1]) {
    head.push({ geo: xf(tube(0.03, 0.03, 0.06, 12), { x: ANCHORS.head.x + side * 0.19, y: ANCHORS.head.y, z: ANCHORS.head.z, rz: Math.PI / 2 }), color: 0x3a4450 });
  }
  // Rejilla/reactor trasero emisivo (rasgo trasero identificable).
  body.push({ geo: xf(blob(0.06, (v) => { v.x *= 1.7; v.y *= 0.95; v.z *= 0.3; }, 16, 12), { x: 0, y: 0.32, z: -0.17 }), color: a });
  for (const side of [1, -1]) {
    body.push({ geo: xf(tube(0.022, 0.022, 0.05, 8), { x: side * 0.1, y: 0.3, z: -0.2, rx: Math.PI / 2 }), color: 0x3a4450 });
  }
  buildArmsCommon(colors, arms);
}

function buildFrog(colors, body, head, face, arms) {
  const L = colors.look || {};
  const b = L.skinColor ?? colors.body;
  const belly = L.bellyColor ?? colors.accent;
  const cheek = L.cheekColor ?? 0xff8c9e;
  const dark = 0x1f7a2c;
  const H = FROG_HEAD;

  // Cuerpo bajo y ancho con barriga clara.
  const torso = xf(torsoParts(), { sy: 0.97, sx: 1.15, sz: 1.05 });
  body.push({ geo: torso, color: b });
  body.push({ geo: xf(blob(0.145, (v) => { v.z *= 0.5; v.y *= 1.2; v.x *= 1.0; }, 28, 20), { x: 0, y: 0.25, z: 0.13 }), color: belly });

  // Manchas oscuras en el lomo y los costados (pegadas al torso).
  const spots = [
    [-0.075, 0.41, 0.03], [0.07, 0.38, 0.036], [0.0, 0.32, 0.03], [-0.115, 0.27, 0.034],
    [0.115, 0.23, 0.03], [0.0, 0.2, 0.028], [-0.04, 0.44, 0.022],
  ];
  for (const [x, y, r] of spots) {
    const e = sliceExtent(torso, y);
    const cz = (e.zMin + e.zMax) / 2;
    const rz = (e.zMax - e.zMin) / 2;
    const zz = cz - rz * Math.sqrt(Math.max(0.05, 1 - (x / e.rx) ** 2));
    const n = V(x / (e.rx * e.rx), 0.12, (zz - cz) / (rz * rz)).normalize();
    body.push(patchPart(V(x, y, zz), n, r, r * 0.85, 0.012, dark));
  }
  for (const side of [1, -1]) {
    for (const [y, r] of [[0.3, 0.032], [0.2, 0.026]]) {
      const e = sliceExtent(torso, y);
      const cz = (e.zMin + e.zMax) / 2;
      body.push(patchPart(V(side * e.rx * 0.985, y, cz - 0.03), V(side, 0.05, -0.15), r, r * 0.9, 0.012, dark, 0.2));
    }
  }

  // Cabeza ancha y achatada: elipsoide puro (la cara se calcula sobre él).
  const shell = headShell((v) => {
    v.x *= H.a / HEAD_R;
    v.y *= H.b / HEAD_R;
    v.z *= H.c / HEAD_R;
  });
  head.push({ geo: xf(shell, { x: H.cx, y: H.cy, z: H.cz }), color: b });

  // Ojos saltones sobre la cabeza (sin tallos): una cúpula verde los arropa.
  for (const side of [1, -1]) {
    head.push({ geo: xf(orb(0.083, 18), { x: side * 0.12, y: H.y(0.12, 0.05) - 0.03, z: H.cz + 0.04, sy: 0.88 }), color: b });
  }
  // Mejillas rosadas, fosas nasales y manchas oscuras en la espalda de la cabeza.
  for (const side of [1, -1]) {
    const p = V(side * 0.175, H.cy - 0.012, 0);
    p.z = H.z(p.x, p.y) - 0.004;
    head.push(patchPart(p, H.normal(p), 0.042, 0.03, 0.012, cheek, side * 0.25));
    const nx = side * 0.036;
    const nz = H.cz + 0.185;
    const np = V(nx, H.y(nx, nz), nz);
    head.push(patchPart(np, H.normal(np), 0.011, 0.007, 0.008, 0x1d5a29));
  }
  for (const [x, z, r] of [
    [0, -0.075, 0.036], [-0.085, -0.035, 0.03], [0.09, -0.05, 0.033], [-0.15, -0.1, 0.034],
    [0.155, -0.11, 0.03], [0, -0.15, 0.03],
  ]) {
    const p = V(x, H.y(x, z) - 0.002, z);
    head.push(patchPart(p, H.normal(p), r, r * 0.9, 0.012, dark, x * 3));
  }

  // Brazos verdes con manos de dedos redondeados.
  const handC = 0x86ec76;
  for (const side of [1, -1]) {
    const shoulder = V(side * 0.18, 0.3, 0.02);
    const hand = V(side * 0.13, 0.24, 0.52);
    arms.push({ geo: limb(shoulder, hand, 0.052), color: b });
    arms.push({ geo: xf(orb(0.072, 14), { x: hand.x, y: hand.y, z: hand.z }), color: handC });
    for (const [dx, dy, dz] of [[-0.04, 0.012, 0.062], [0, 0.026, 0.074], [0.04, 0.012, 0.062]]) {
      arms.push({ geo: xf(orb(0.027, 10), { x: hand.x + dx, y: hand.y + dy, z: hand.z + dz }), color: handC });
    }
  }
}

function buildPenguin(colors, body, head, face, arms) {
  const b = colors.body;
  // Cuerpo de huevo.
  let egg = blob(0.2, (v) => {
    const t = v.y / 0.2;
    v.x *= 1 - 0.12 * t;
    v.z *= 1 - 0.12 * t;
    v.y *= 1.25;
    v.y += 0.27;
  }, 40, 28);
  body.push({ geo: egg, color: b });
  // Panza blanca.
  body.push({ geo: xf(blob(0.15, (v) => { v.z *= 0.5; v.y *= 1.2; }, 30, 22), { x: 0, y: 0.28, z: 0.12 }), color: 0xfbfbfb });
  // Aletas.
  for (const side of [1, -1]) {
    let flipper = blob(0.05, (v) => { v.y *= 1.8; v.x *= 0.6; v.z *= 0.8; }, 18, 14);
    xf(flipper, { x: side * 0.2, y: 0.24, z: 0, rz: side * 0.25 });
    body.push({ geo: flipper, color: b });
  }
  // Cabeza redonda.
  let shell = headShell((v) => { v.x *= 1.02; v.y *= 1.0; v.z *= 1.02; });
  head.push({ geo: xf(shell, ANCHORS.head), color: b });
  // Pico curvo.
  head.push({ geo: xf(tube(0.005, 0.05, 0.14, 12), { x: 0, y: ANCHORS.head.y - 0.03, z: ANCHORS.head.z + 0.2, rx: Math.PI / 2, rz: 0.2 }), color: 0xff9a1f });
  // Gorro de lana con pompón.
  let hat = new THREE.SphereGeometry(HEAD_R * 1.02, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
  xf(hat, { x: ANCHORS.head.x, y: ANCHORS.head.y + 0.03, z: ANCHORS.head.z, sz: 1.04 });
  head.push({ geo: hat, color: 0xd23b3b });
  head.push({ geo: xf(tube(0.15, 0.16, 0.05, 20), { x: 0, y: ANCHORS.head.y + 0.19, z: 0 }), color: 0xf0f0f0 });
  head.push({ geo: xf(orb(0.05, 14), { x: 0, y: ANCHORS.head.y + 0.27, z: 0 }), color: 0xf0f0f0 });
  // Bufanda con puntas ondeando detrás (rasgo trasero identificable).
  const scarfC = (colors.look || {}).scarfColor || 0xd23b3b;
  body.push({ geo: xf(torus(0.15, 0.045, 8, 18), { x: 0, y: 0.44, z: 0, rx: Math.PI / 2 }), color: scarfC });
  for (const side of [1, -1]) {
    let flap = blob(0.05, (v) => { v.y *= 2.4; v.x *= 0.6; v.z *= 0.5; }, 14, 10);
    xf(flap, { x: side * 0.06, y: 0.34, z: -0.16, rz: side * 0.12, rx: -0.3 });
    body.push({ geo: flap, color: scarfC });
  }
  buildArmsCommon(colors, arms);
}

function buildBear(colors, body, head, face, arms) {
  const b = colors.body;
  const a = colors.accent;
  body.push({ geo: xf(torsoParts(), { sx: 1.15, sy: 1.05, sz: 1.1 }), color: b });
  // Barriga clara.
  body.push({ geo: xf(blob(0.15, (v) => { v.z *= 0.5; v.y *= 1.3; }, 30, 22), { x: 0, y: 0.25, z: 0.13 }), color: a });
  // Cabeza con orejas redondas.
  let shell = headShell((v) => { v.x *= 1.08; v.y *= 1.02; v.z *= 0.98; });
  head.push({ geo: xf(shell, ANCHORS.head), color: b });
  for (const side of [1, -1]) {
    head.push({ geo: xf(orb(0.085, 16), { x: ANCHORS.head.x + side * 0.15, y: ANCHORS.head.y + 0.17, z: ANCHORS.head.z - 0.02, sz: 0.7 }), color: b });
    head.push({ geo: xf(orb(0.045, 12), { x: ANCHORS.head.x + side * 0.15, y: ANCHORS.head.y + 0.17, z: ANCHORS.head.z + 0.03, sz: 0.6 }), color: a });
  }
  // Hocico claro.
  head.push({ geo: xf(blob(0.09, (v) => { v.z *= 1.2; v.y *= 0.85; v.x *= 0.95; }, 26, 18), { x: ANCHORS.head.x, y: ANCHORS.head.y - 0.055, z: ANCHORS.head.z + 0.16 }), color: a });
  head.push({ geo: xf(orb(0.038, 12), { x: 0, y: ANCHORS.head.y - 0.03, z: ANCHORS.head.z + 0.235 }), color: 0x1b1418 });
  // Colita redonda (rasgo trasero identificable).
  body.push({ geo: xf(ball(0.05, 12), { x: 0, y: 0.2, z: -0.2 }), color: a });
  buildArmsCommon(colors, arms);
}

function buildCat(colors, body, head, face, arms) {
  const b = colors.body;
  const a = colors.accent;
  body.push({ geo: torsoParts(), color: b });
  // Cola curva.
  const tailBase = V(0, 0.18, -0.16);
  let tail = blob(0.045, (v) => { v.y *= 2.0; }, 20, 16);
  xf(tail, { x: 0, y: tailBase.y + 0.06, z: tailBase.z - 0.2, rx: -0.7 });
  const tailM = { tailSwing: bendMorph(tailBase, V(0, 1, 0), 0.5), tailUp: bendMorph(tailBase, V(1, 0, 0), -0.6) };
  body.push({ geo: tail, color: b, morphs: tailM });
  // Cabeza.
  let shell = headShell((v) => { v.x *= 1.05; v.y *= 0.98; v.z *= 0.98; });
  head.push({ geo: xf(shell, ANCHORS.head), color: b });
  // Orejas triangulares con interior rosa.
  for (const side of [1, -1]) {
    const base = V(ANCHORS.head.x + side * 0.1, ANCHORS.head.y + 0.15, ANCHORS.head.z - 0.01);
    let ear = blob(0.06, (v) => { v.y += 0.09; const t = (v.y - 0.09) / 0.06; v.x *= 1 - 0.55 * Math.max(0, t); v.z *= 1 - 0.4 * Math.max(0, t); v.y *= 1.9; }, 22, 16);
    xf(ear, { x: base.x, y: base.y, z: base.z, rz: side * -0.1 });
    const morphs = { earBend: bendMorph(base, V(1, 0, 0), -0.7), earWag: bendMorph(base, V(0, 0, 1), side * 0.5) };
    head.push({ geo: ear, color: b, morphs });
    head.push({ geo: xf(orb(0.032, 12), { x: base.x, y: base.y + 0.05, z: base.z + 0.03, sy: 1.6 }), color: 0xffb0c8, morphs });
  }
  // Hociquito y bigotes.
  head.push({ geo: xf(blob(0.06, (v) => { v.z *= 1.2; v.y *= 0.8; }, 20, 16), { x: 0, y: ANCHORS.head.y - 0.06, z: ANCHORS.head.z + 0.15 }), color: a });
  head.push({ geo: xf(orb(0.026, 12), { x: 0, y: ANCHORS.head.y - 0.04, z: ANCHORS.head.z + 0.21 }), color: 0xff7aa2 });
  for (const side of [1, -1]) {
    for (const dy of [0.0, -0.03]) {
      head.push({ geo: xf(tube(0.003, 0.003, 0.22, 4), { x: side * 0.14, y: ANCHORS.head.y - 0.05 + dy, z: ANCHORS.head.z + 0.18, rz: side * (1.4 + dy), rx: 0.2 }), color: 0x3a3f47 });
    }
  }
  buildArmsCommon(colors, arms);
}

function buildDino(colors, body, head, face, arms) {
  const b = colors.body;
  const a = colors.accent;
  body.push({ geo: xf(torsoParts(), { sx: 1.1, sy: 0.95, sz: 1.15 }), color: b });
  // Crestas en la espalda.
  for (let i = 0; i < 4; i++) {
    const z = -0.02 - i * 0.1;
    const y = 0.36 - i * 0.03;
    const r = 0.055 - i * 0.008;
    body.push({ geo: xf(blob(r, (v) => { v.y += r; v.z *= 0.5; }, 16, 12), { x: 0, y, z }), color: a });
  }
  // Cabeza alargada.
  let shell = headShell((v) => {
    v.z *= 1.15;
    v.x *= 1.0;
    v.y *= 0.95;
  });
  head.push({ geo: xf(shell, ANCHORS.head), color: b });
  // Hocico alargado.
  head.push({ geo: xf(blob(0.1, (v) => { v.z *= 1.9; v.y *= 0.75; v.x *= 0.85; }, 30, 20), { x: 0, y: ANCHORS.head.y - 0.045, z: ANCHORS.head.z + 0.2 }), color: b });
  // Narinas.
  head.push({ geo: xf(orb(0.02, 10), { x: 0.03, y: ANCHORS.head.y - 0.01, z: ANCHORS.head.z + 0.38 }), color: 0x1b1418 });
  head.push({ geo: xf(orb(0.02, 10), { x: -0.03, y: ANCHORS.head.y - 0.01, z: ANCHORS.head.z + 0.38 }), color: 0x1b1418 });
  buildArmsCommon(colors, arms);
}

function buildRabbit(colors, body, head, face, arms) {
  const b = colors.body;
  const a = colors.accent;
  body.push({ geo: torsoParts(), color: b });
  // Cola esponjosa blanca (rasgo trasero identificable).
  const rTailBase = V(0, 0.22, -0.14);
  let rTail = blob(0.085, (v) => { const n = sNoise(v.x * 26, v.y * 26, v.z * 26); v.multiplyScalar(1 + 0.16 * n); }, 18, 14);
  const rTailM = { tailSwing: bendMorph(rTailBase, V(0, 1, 0), 0.3), tailUp: bendMorph(rTailBase, V(1, 0, 0), -0.4) };
  body.push({ geo: xf(rTail, { x: rTailBase.x, y: rTailBase.y, z: rTailBase.z - 0.05, sz: 1.2 }), color: 0xfdfdfd, morphs: rTailM });
  // Cabeza.
  let shell = headShell((v) => { v.x *= 1.03; v.y *= 1.0; v.z *= 1.0; });
  head.push({ geo: xf(shell, ANCHORS.head), color: b });
  // Orejas largas: nacen del cráneo (base hundida) y se alzan hacia arriba.
  for (const side of [1, -1]) {
    const base = V(ANCHORS.head.x + side * 0.07, ANCHORS.head.y + 0.09, ANCHORS.head.z - 0.01);
    const earLen = 0.36;
    let ear = blob(0.05, (v) => {
      const t = (v.y + 0.05) / 0.1; // 0 en la base, 1 en la punta
      const s = 1 - 0.42 * t;
      v.x *= s;
      v.z *= 0.68 * s;
      v.y = t * earLen;
    }, 22, 18);
    xf(ear, { x: base.x, y: base.y, z: base.z, rz: side * -0.12 });
    const morphs = { earBend: bendMorph(base, V(1, 0, 0), -0.95), earWag: bendMorph(base, V(0, 0, 1), side * 0.4) };
    head.push({ geo: ear, color: b, morphs });
    head.push({ geo: xf(orb(0.026, 10), { x: base.x, y: base.y + earLen * 0.5, z: base.z + 0.028, sy: earLen / 0.052 }), color: a, morphs });
  }
  // Naricita y dientes.
  head.push({ geo: xf(blob(0.055, (v) => { v.z *= 1.1; v.y *= 0.75; }, 20, 14), { x: 0, y: ANCHORS.head.y - 0.06, z: ANCHORS.head.z + 0.16 }), color: 0xfdfdfd });
  head.push({ geo: xf(orb(0.024, 10), { x: 0, y: ANCHORS.head.y - 0.04, z: ANCHORS.head.z + 0.205 }), color: 0xff9ab0 });
  buildArmsCommon(colors, arms);
}

// ---------------------------------------------------------------------------
// Tanda 4 — tres pilotos nuevos
// ---------------------------------------------------------------------------

// Max Tuerca — mecánico rechoncho, bigote rizado, gorra con tuerca, mono mostaza.
function buildMechanic(colors, body, head, face, arms) {
  const L = colors.look || {};
  const skin = L.skinColor ?? 0xf1c39a;
  const outfit = L.outfitColor ?? 0xd9a521;
  const pocket = L.pocketColor ?? 0xb8821a;
  const belt = L.beltColor ?? 0x4a3520;
  const capC = L.capColor ?? 0x2f9e8f;
  const emblem = L.capEmblemColor ?? 0xffd23f;
  const mush = L.mustacheColor ?? 0x6b3f1d;
  const glove = L.gloveColor ?? 0xffffff;
  const wrench = L.wrenchColor ?? 0xc9d3dd;

  // Torso rechoncho con mono de trabajo.
  body.push({ geo: xf(torsoParts(), { sx: 1.2, sy: 1.0, sz: 1.14 }), color: outfit });
  // Peto del mono.
  body.push({ geo: xf(blob(0.12, (v) => { v.z *= 0.5; v.y *= 1.15; v.x *= 0.92; }, 24, 18), { x: 0, y: 0.29, z: 0.14 }), color: pocket });
  // Costuras / tirantes.
  for (const side of [1, -1]) {
    body.push({ geo: xf(tube(0.012, 0.012, 0.34, 6), { x: side * 0.1, y: 0.33, z: 0.11, rx: 0.12, rz: side * 0.1 }), color: belt });
  }
  // Bolsillos.
  for (const side of [1, -1]) {
    body.push({ geo: xf(blob(0.045, (v) => { v.z *= 0.4; v.y *= 0.8; }, 14, 10), { x: side * 0.1, y: 0.2, z: 0.16 }), color: pocket });
  }
  // Cinturón con hebilla.
  body.push({ geo: xf(torus(0.19, 0.028, 8, 22), { x: 0, y: 0.15, z: 0, rx: Math.PI / 2 }), color: belt });
  body.push({ geo: xf(blob(0.035, (v) => { v.x *= 1.4; v.z *= 0.4; v.y *= 0.8; }, 12, 8), { x: 0, y: 0.15, z: 0.2 }), color: 0xd9d9de });
  // Llave inglesa colgando del cinturón.
  {
    const wx = 0.2, wy = 0.05, wz = 0.02;
    body.push({ geo: xf(tube(0.016, 0.016, 0.17, 8), { x: wx, y: wy - 0.04, z: wz, rx: 0.12 }), color: wrench });
    body.push({ geo: xf(torus(0.03, 0.014, 8, 12, Math.PI * 1.25), { x: wx, y: wy - 0.13, z: wz + 0.01, rz: 0.5 }), color: wrench });
  }
  // Cabeza grande y redonda.
  let shell = headShell((v) => { v.x *= 1.12; v.y *= 1.04; v.z *= 1.06; });
  head.push({ geo: xf(shell, ANCHORS.head), color: skin });
  // Orejas.
  for (const side of [1, -1]) {
    head.push({ geo: xf(orb(0.045, 12), { x: ANCHORS.head.x + side * 0.2, y: ANCHORS.head.y - 0.01, z: ANCHORS.head.z, sz: 0.6 }), color: skin });
  }
  // Nariz bulbosa.
  head.push({ geo: xf(orb(0.062, 16), { x: 0, y: ANCHORS.head.y - 0.02, z: ANCHORS.head.z + 0.205, sy: 0.9 }), color: L.noseColor ?? 0xe08a6a });
  // Gran bigote rizado castaño (esferas de tamaño decreciente).
  const mustY = ANCHORS.head.y - 0.085;
  const mustZ = ANCHORS.head.z + 0.19;
  for (const side of [1, -1]) {
    for (let i = 0; i < 3; i++) {
      const rr = 0.038 - i * 0.005;
      head.push({ geo: xf(orb(rr, 12), { x: side * (0.05 + i * 0.042), y: mustY - i * 0.004 + (i === 2 ? 0.018 : 0), z: mustZ - i * 0.022, sz: 0.85 }), color: mush });
    }
  }
  // Gorra plana verde azulada con visera corta y tuerca dorada bordada.
  {
    let capDome = new THREE.SphereGeometry(HEAD_R * 1.04, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.52);
    xf(capDome, { x: ANCHORS.head.x, y: ANCHORS.head.y + 0.04, z: ANCHORS.head.z, sz: 1.06 });
    head.push({ geo: capDome, color: capC });
    // Visera corta por encima de las cejas (no tapa los ojos) y bien visible.
    head.push({ geo: xf(blob(0.1, (v) => { v.x *= 1.6; v.z *= 1.7; v.y *= 0.14; }, 18, 12), { x: 0, y: ANCHORS.head.y + 0.115, z: ANCHORS.head.z + 0.19, rx: 0.12 }), color: capC });
    head.push({ geo: xf(torus(0.038, 0.014, 8, 6), { x: 0, y: ANCHORS.head.y + 0.17, z: ANCHORS.head.z + 0.15, rx: 1.0 }), color: emblem });
    head.push({ geo: xf(ball(0.03, 6), { x: 0, y: ANCHORS.head.y + 0.165, z: ANCHORS.head.z + 0.148 }), color: emblem });
  }
  // Brazos con guantes blancos.
  for (const side of [1, -1]) {
    const shoulder = V(side * 0.2, 0.3, 0.02);
    const hand = V(side * 0.15, 0.24, 0.5);
    arms.push({ geo: limb(shoulder, hand, 0.058), color: outfit });
    arms.push({ geo: xf(orb(0.075, 12), { x: hand.x, y: hand.y, z: hand.z }), color: glove });
  }
}

// Kenzo Ráfaga — luchador, pelo en punta plata con mechas turquesa, kimono, aura.
function buildFighter(colors, body, head, face, arms, glow) {
  const L = colors.look || {};
  const skin = L.skinColor ?? 0xf1c9a0;
  const outfit = L.outfitColor ?? 0x8a3ffb;
  const belt = L.beltColor ?? 0x1a1a1a;
  const hairC = L.hairColor ?? 0xc9d3dd;
  const streak = L.hairStreakColor ?? 0x28e0d0;
  const band = L.bandColor ?? 0xff3b3b;
  const emblem = L.emblemColor ?? 0x28e0d0;
  const wrist = L.wristbandColor ?? 0xffffff;

  // Torso atlético con kimono morado.
  body.push({ geo: xf(torsoParts(), { sx: 1.06, sy: 1.05, sz: 1.02 }), color: outfit });
  // Solapa en V.
  for (const side of [1, -1]) {
    body.push({ geo: xf(blob(0.075, (v) => { v.z *= 0.45; v.y *= 1.5; v.x *= 0.5; }, 18, 14), { x: side * 0.05, y: 0.3, z: 0.15, rz: side * 0.35 }), color: 0xf7f7ff });
  }
  // Cinturón negro ancho y nudo.
  body.push({ geo: xf(torus(0.19, 0.03, 8, 22), { x: 0, y: 0.16, z: 0, rx: Math.PI / 2 }), color: belt });
  body.push({ geo: xf(orb(0.04, 10), { x: 0, y: 0.16, z: 0.19, sz: 0.7 }), color: belt });
  // Emblema rayo-espiral en el pecho.
  body.push({ geo: xf(torus(0.055, 0.013, 6, 16, Math.PI * 1.7), { x: 0, y: 0.35, z: 0.185, rz: 0.5 }), color: emblem });
  body.push({ geo: xf(blob(0.022, (v) => { v.y *= 2.4; v.x *= 0.35; }, 10, 8), { x: 0.012, y: 0.36, z: 0.19, rz: 0.6 }), color: emblem });
  // Cabeza.
  let shell = headShell((v) => { v.x *= 1.02; v.y *= 1.0; v.z *= 1.0; });
  head.push({ geo: xf(shell, ANCHORS.head), color: skin });
  for (const side of [1, -1]) {
    head.push({ geo: xf(orb(0.042, 12), { x: ANCHORS.head.x + side * 0.195, y: ANCHORS.head.y - 0.005, z: ANCHORS.head.z, sz: 0.62 }), color: skin });
  }
  // Cinta roja en la frente.
  head.push({ geo: xf(torus(0.208, 0.022, 8, 24), { x: 0, y: ANCHORS.head.y + 0.03, z: ANCHORS.head.z, rx: Math.PI / 2 }), color: band });
  // Puntas de la cinta ondeando detrás (morphs de viento).
  for (const side of [1, -1]) {
    const bb = V(0.02 * side, ANCHORS.head.y + 0.02, ANCHORS.head.z - 0.19);
    let ribbon = blob(0.035, (v) => { v.z *= 2.6; v.y *= 0.5; v.x *= 0.5; }, 14, 10);
    xf(ribbon, { x: bb.x, y: bb.y, z: bb.z - 0.08, rx: -0.2, rz: side * 0.25 });
    const m = { earBend: bendMorph(bb, V(1, 0, 0), -0.8), earWag: bendMorph(bb, V(0, 0, 1), side * 0.9) };
    head.push({ geo: ribbon, color: band, morphs: m });
  }
  // Base de pelo (casquete plateado) para que no se vea la calva.
  head.push({ geo: xf(new THREE.SphereGeometry(HEAD_R * 1.03, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.58), { x: ANCHORS.head.x, y: ANCHORS.head.y, z: ANCHORS.head.z, sz: 1.02 }), color: hairC });
  // Pelo en punta exagerado PLATA: abanico de conos que nacen del cráneo y
  // se abren hacia fuera (algunos al mesh brillante, mechas turquesa).
  // [dirX, dirZ, alto, radio, esMecha]
  const spots = [
    [0.0, -1.0, 0.17, 0.05, false],
    [0.62, -0.82, 0.16, 0.045, true],
    [-0.62, -0.82, 0.16, 0.045, false],
    [0.9, -0.35, 0.14, 0.042, false],
    [-0.9, -0.35, 0.14, 0.042, true],
    [0.55, -0.05, 0.19, 0.048, false],
    [-0.55, -0.05, 0.19, 0.048, false],
    [0.18, 0.4, 0.2, 0.05, true],
    [-0.18, 0.4, 0.2, 0.05, false],
    [0.0, -0.45, 0.23, 0.052, true],
  ];
  for (const [dx, dz, h, r, st] of spots) {
    const lean = 0.72;
    const g = xf(cone(r, h, 8), {
      x: dx * 0.12,
      y: ANCHORS.head.y + 0.09,
      z: ANCHORS.head.z + dz * 0.12,
      rx: dz * lean,
      rz: -dx * lean,
    });
    (st ? glow : head).push({ geo: g, color: st ? streak : hairC });
  }
  // Brazos con muñequeras.
  for (const side of [1, -1]) {
    const shoulder = V(side * 0.19, 0.3, 0.02);
    const hand = V(side * 0.15, 0.24, 0.5);
    arms.push({ geo: limb(shoulder, hand, 0.052), color: outfit });
    arms.push({ geo: xf(tube(0.056, 0.056, 0.06, 12), { x: side * 0.17, y: 0.275, z: 0.3, rx: 1.35, rz: side * 0.1 }), color: wrist });
    arms.push({ geo: xf(orb(0.066, 12), { x: hand.x, y: hand.y, z: hand.z }), color: skin });
  }
}

// Cola esponjosa: tubo de radio variable con pelo erizado (ruido de alta
// frecuencia) que sigue una curva. radiusAt(u) con u en [0,1] a lo largo.
function fluffTail(points, radiusAt, bristle = 0.2) {
  const radial = 16;
  const tubular = 40;
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
  const g = new THREE.TubeGeometry(curve, tubular, 1, radial, false);
  const p = g.attributes.position;
  const c = new THREE.Vector3();
  const d = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    const u = Math.floor(i / (radial + 1)) / tubular;
    curve.getPointAt(u, c);
    d.fromBufferAttribute(p, i).sub(c);
    const n = sNoise(c.x * 22 + d.x * 9, c.y * 22 + d.y * 9, c.z * 22 + d.z * 9);
    const k = radiusAt(u) * (1 + bristle * n);
    p.setXYZ(i, c.x + d.x * k, c.y + d.y * k, c.z + d.z * k);
  }
  return weld(g);
}

// Zuri — numbat rojizo rayado, hocico largo y fino, gafas de aviador sobre la
// frente, cola larga y esponjosa que asoma por encima del respaldo.
function buildNumbat(colors, body, head, face, arms) {
  const L = colors.look || {};
  const fur = new THREE.Color(L.furColor ?? 0xd5732f).lerp(new THREE.Color(0xa83a14), 0.35).getHex();
  const stripe = L.stripeColor ?? 0xffffff;
  const snout = L.snoutColor ?? 0xf3d8b8;
  const vest = L.vestColor ?? 0xa8e020;
  const shoe = L.shoeColor ?? 0xff3b3b;
  const strap = L.gogglesColor ?? 0x6b4a1f;
  const lens = L.gogglesLensColor ?? 0x3ab0ff;
  const mask = L.maskColor ?? 0x2a1812;
  const brass = 0xb98a2a;
  const H = NUMBAT_HEAD;

  // Cuerpo esbelto.
  const torso = xf(torsoParts(), { sx: 0.92, sy: 1.04, sz: 0.98 });
  body.push({ geo: torso, color: fur });

  // Chaleco verde lima: panel delantero amplio y faldón bajo en la espalda.
  body.push({ geo: xf(blob(0.15, (v) => { v.z *= 0.55; v.y *= 1.3; v.x *= 0.95; }, 26, 20), { x: 0, y: 0.28, z: 0.11 }), color: vest });
  body.push({ geo: xf(blob(0.14, (v) => { v.z *= 0.5; v.y *= 0.85; v.x *= 0.95; }, 24, 18), { x: 0, y: 0.17, z: -0.1 }), color: vest });

  // RAYAS BLANCAS transversales que rodean el lomo y se enroscan hacia los
  // costados (visibles de lado y desde atrás y arriba). [y, [[desde, hasta] grados desde atrás]]
  const full = [[-128, 128]];
  const sides = [[-128, -58], [58, 128]];
  const bands = [[0.46, full], [0.4, full], [0.34, full], [0.28, sides], [0.22, sides], [0.16, sides]];
  for (const [y, ranges] of bands) {
    const e = sliceExtent(torso, y);
    const cz = (e.zMin + e.zMax) / 2;
    const rzB = cz - e.zMin + 0.011;
    const rzF = e.zMax - cz + 0.011;
    const rx = e.rx + 0.011;
    for (const [d0, d1] of ranges) {
      const pts = [];
      const n = 22;
      for (let k = 0; k <= n; k++) {
        const a = ((d0 + ((d1 - d0) * k) / n) * Math.PI) / 180;
        const cs = Math.cos(a);
        pts.push(V(rx * Math.sin(a), y, cz - (cs >= 0 ? rzB : rzF) * cs));
      }
      const g = tubePath(pts, 0.0125, false, 40, 6);
      deformY(g, y, 1.55);
      body.push({ geo: g, color: stripe });
    }
  }

  // Cola larga y MUY esponjosa: sale por detrás del respaldo (por el hueco del
  // arco), sube y se curva; punta clara.
  const tailBase = V(0, 0.18, -0.12);
  const tailPts = [
    V(0, 0.18, -0.12), V(0, 0.25, -0.27), V(0, 0.31, -0.39), V(0.02, 0.42, -0.5),
    V(0.09, 0.56, -0.56), V(0.16, 0.65, -0.52), V(0.2, 0.71, -0.44),
  ];
  const tailR = (u) => 0.026 + 0.042 * Math.sin(Math.min(1, u * 1.1) * Math.PI * 0.66) ** 1.1;
  const tailG = fluffTail(tailPts, tailR, 0.16);
  const tailM = { tailSwing: bendMorph(tailBase, V(0, 0, 1), 0.32), tailUp: bendMorph(tailBase, V(1, 0, 0), -0.4) };
  body.push({ geo: tailG, color: fur, morphs: tailM });
  {
    // Pelo erizado: penachos cónicos barridos hacia la punta (cola de cepillo).
    const curve = new THREE.CatmullRomCurve3(tailPts, false, 'catmullrom', 0.5);
    const up = V(0, 1, 0);
    const q = new THREE.Quaternion();
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 1; i <= 19; i++) {
      const u = i / 20;
      const c = curve.getPointAt(u);
      const tg = curve.getTangentAt(u);
      const [bx, by] = basisFromDir(tg);
      const r = tailR(u);
      const n = u < 0.25 ? 4 : 8;
      for (let k = 0; k < n; k++) {
        const ang = (k / n) * Math.PI * 2 + rnd() * 0.8;
        const rad = bx.clone().multiplyScalar(Math.cos(ang)).addScaledVector(by, Math.sin(ang));
        const dir = rad.clone().multiplyScalar(0.7).addScaledVector(tg, 0.7).normalize();
        const taper = Math.min(1, 0.45 + u * 1.2);
        const len = (0.024 + 0.01 * rnd() + r * 0.3) * taper;
        const wid = (0.016 + r * 0.2) * taper;
        const g = blob(1, (v) => { v.x *= wid; v.y *= wid; v.z *= len; }, 10, 8);
        const [tx, ty, tz] = basisFromDir(dir);
        const pos = c.clone().addScaledVector(rad, r * 0.9).addScaledVector(dir, len * 0.45);
        g.applyMatrix4(new THREE.Matrix4().makeBasis(tx, ty, tz).setPosition(pos));
        body.push({ geo: g, color: k % 3 === 0 ? 0xe58a4a : fur, morphs: tailM });
      }
    }
    // Punta clara.
    const tipP = curve.getPointAt(1);
    const tipT = curve.getTangentAt(1);
    const tip = cone(0.05, 0.13, 10);
    q.setFromUnitVectors(up, tipT);
    tip.applyQuaternion(q);
    tip.translate(tipP.x - tipT.x * 0.03, tipP.y - tipT.y * 0.03, tipP.z - tipT.z * 0.03);
    body.push({ geo: tip, color: 0xf7e3c8, morphs: tailM });
  }

  // Zapatillas.
  for (const side of [1, -1]) {
    body.push({ geo: xf(blob(0.06, (v) => { v.z *= 1.5; v.y *= 0.6; }, 14, 10), { x: side * 0.12, y: 0.07, z: 0.06 }), color: shoe });
  }

  // Cabeza de numbat: cráneo algo estrecho + hocico LARGO y fino.
  const shell = headShell((v) => {
    v.x *= H.a / HEAD_R;
    v.y *= H.b / HEAD_R;
    v.z *= H.c / HEAD_R;
  });
  head.push({ geo: xf(shell, { x: H.cx, y: H.cy, z: H.cz }), color: fur });
  const sBase = 0.066;
  const snoutGeo = blob(1, (v) => {
    const u = (v.z + 1) / 2;
    const k = sBase * (1 - 0.7 * u);
    v.x *= k;
    v.y *= k * 0.86;
    v.y += H.cy - 0.03 - 0.06 * u;
    v.z = H.cz + 0.1 + u * 0.34;
  }, 30, 22);
  head.push({ geo: snoutGeo, color: snout });
  head.push({ geo: xf(orb(0.026, 14), { x: 0, y: H.cy - 0.09 + 0.002, z: H.cz + 0.435, sz: 0.9, sy: 0.88 }), color: 0x14100e });

  // Antifaz oscuro a través de cada ojo (franja del numbat real).
  for (const side of [1, -1]) {
    const x = side * 0.105;
    const y = H.cy + 0.032;
    const pp = V(x, y, H.z(x, y) - 0.002);
    head.push(patchPart(pp, H.normal(pp), 0.072, 0.026, 0.012, mask, side * 0.22, 18));
  }

  // Orejas pequeñas y redondeadas (nacen del cráneo).
  for (const side of [1, -1]) {
    const eBase = V(side * 0.134, H.cy + 0.128, -0.035);
    const m = { earBend: bendMorph(eBase, V(1, 0, 0), -0.7), earWag: bendMorph(eBase, V(0, 0, 1), side * 0.5) };
    head.push({ geo: xf(orb(0.052, 16), { x: eBase.x, y: eBase.y, z: eBase.z, sz: 0.5, ry: side * 0.55 }), color: fur, morphs: m });
    head.push({ geo: xf(orb(0.03, 10), { x: eBase.x + side * 0.004, y: eBase.y - 0.004, z: eBase.z + 0.016, sz: 0.4, ry: side * 0.55 }), color: 0xffd9b0, morphs: m });
  }

  // Gafas de aviador subidas a la frente: correa fina + dos cristales redondos
  // grandes con montura de latón, puente, tornillos y reflejo.
  {
    const dy = 0.098;
    const sy = H.cy + dy;
    const k = Math.sqrt(1 - (dy / H.b) ** 2);
    const rxS = H.a * k + 0.006;
    const rzS = H.c * k + 0.006;
    const sp = [];
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      sp.push(V(rxS * Math.sin(a), sy, H.cz + rzS * Math.cos(a)));
    }
    const sg = tubePath(sp, 0.009, true, 80, 6);
    deformY(sg, sy, 1.9);
    head.push({ geo: sg, color: strap });
    for (const side of [1, -1]) {
      const d = V(side * 0.082, 0.128, 0);
      d.z = Math.sqrt(Math.max(0.004, 0.2 * 0.2 - d.x * d.x - d.y * d.y));
      const n = d.clone().normalize();
      const pos = V(H.cx, H.cy, H.cz).addScaledVector(n, 0.2);
      const put = (geo) => orientTo(geo, pos, n);
      head.push({ geo: put(torus(0.054, 0.0125, 10, 28)), color: brass });
      head.push({ geo: put(xf(ball(1, 20), { sx: 0.053, sy: 0.053, sz: 0.012, z: -0.002 })), color: lens });
      head.push({ geo: put(xf(ball(1, 10), { sx: 0.017, sy: 0.007, sz: 0.006, x: -0.02 * side, y: 0.026, z: 0.01, rz: side * 0.7 })), color: 0xffffff });
      head.push({ geo: put(xf(ball(1, 8), { sx: 0.012, sy: 0.012, sz: 0.01, x: 0.045 * side, y: -0.012, z: -0.002 })), color: brass });
    }
    // Puente entre los dos aros.
    head.push({ geo: limb(V(-0.04, H.cy + 0.158, H.cz + 0.123), V(0.04, H.cy + 0.158, H.cz + 0.123), 0.009), color: brass });
  }

  // Brazos pelirrojos con bandas blancas en el antebrazo y manos blancas.
  for (const side of [1, -1]) {
    const shoulder = V(side * 0.17, 0.3, 0.02);
    const hand = V(side * 0.13, 0.24, 0.52);
    arms.push({ geo: limb(shoulder, hand, 0.05), color: fur });
    arms.push({ geo: xf(orb(0.072, 12), { x: hand.x, y: hand.y, z: hand.z }), color: colors.accent });
    const dir = hand.clone().sub(shoulder);
    const dn = dir.clone().normalize();
    for (const t of [0.17, 0.33, 0.49]) {
      const c = shoulder.clone().addScaledVector(dir, t);
      const ring = xf(torus(0.0495, 0.0075, 6, 20), { sz: 3.2 });
      ring.applyMatrix4(new THREE.Matrix4().makeBasis(...basisFromDir(dn)).setPosition(c));
      arms.push({ geo: ring, color: stripe });
    }
  }
}

// ---------------------------------------------------------------------------
// Pantalla del robot: ojos y boca dibujados en una CanvasTexture emisiva.
// ---------------------------------------------------------------------------

function buildRobotScreen(colors) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const base = '#' + colors.body.toString(16).padStart(6, '0');
  const glow = '#3ff0ff';
  const glow2 = '#2f80ff';

  let dirty = true;

  function draw(state) {
    const { expression = 'neutral', blink = 0, lookX = 0, lookY = 0, t = 0 } = state || {};
    ctx.fillStyle = '#0a1a22';
    ctx.fillRect(0, 0, size, size);
    // Marco interior.
    ctx.strokeStyle = glow2;
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, size - 16, size - 16);

    const eyeY = size * 0.42;
    const eyeDX = size * 0.2;
    const eyeRX = size * 0.13;
    const eyeRY = size * 0.16;

    const mx = lookX * size * 0.05;
    const my = lookY * size * 0.04;

    let lidClose = blink;
    let browTilt = 0;
    let browY = 0;
    if (expression === 'determinado') {
      browTilt = 1;
      browY = 6;
      lidClose = Math.max(lidClose, 0.3);
    } else if (expression === 'enfadado') {
      browTilt = 1;
      lidClose = Math.max(lidClose, 0.45);
    } else if (expression === 'eufórico') {
      browY = -12;
    } else if (expression === 'sorprendido') {
      browY = -16;
    } else if (expression === 'contento') {
      browY = -6;
    } else if (expression === 'mareado') {
      browTilt = 0;
    }

    for (const sgn of [-1, 1]) {
      const ex = size / 2 + sgn * eyeDX;
      ctx.save();
      // Ojo (esclerótica) con brillo.
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, eyeRX, eyeRY, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#eaffff';
      ctx.fill();
      ctx.shadowColor = glow;
      ctx.shadowBlur = 18;
      ctx.strokeStyle = glow;
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.shadowBlur = 0;

      if (expression === 'mareado') {
        // Espiral.
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(ex, eyeY, eyeRX * 0.9, eyeRY * 0.9, 0, 0, Math.PI * 2);
        ctx.clip();
        ctx.strokeStyle = '#123a44';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let a = 0; a < Math.PI * 8; a += 0.12) {
          const rr = a * 2.2;
          const px = ex + Math.cos(a + t * 4) * rr;
          const py = eyeY + Math.sin(a + t * 4) * rr;
          if (a === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();
      } else {
        // Iris + pupila, mirando según lookX/lookY.
        ctx.beginPath();
        ctx.ellipse(ex + mx, eyeY + my, eyeRX * 0.62, eyeRY * 0.62, 0, 0, Math.PI * 2);
        ctx.fillStyle = glow2;
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(ex + mx * 1.1, eyeY + my * 1.1, eyeRX * 0.3, eyeRY * 0.3, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#06131a';
        ctx.fill();
        // Brillo especular.
        ctx.beginPath();
        ctx.arc(ex + mx - eyeRX * 0.22, eyeY + my - eyeRY * 0.28, eyeRX * 0.13, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }

      // Párpado.
      if (lidClose > 0.01) {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(ex, eyeY, eyeRX * 1.02, eyeRY * 1.02, 0, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = base;
        ctx.fillRect(ex - eyeRX, eyeY - eyeRY, eyeRX * 2, eyeRY * 2 * lidClose);
        ctx.restore();
      }
      // Ceja.
      ctx.strokeStyle = glow;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      const by = eyeY - eyeRY - 16 + browY;
      ctx.beginPath();
      ctx.moveTo(ex - sgn * eyeRX * 0.9, by + browTilt * 10);
      ctx.lineTo(ex + sgn * eyeRX * 0.9, by - browTilt * 10);
      ctx.stroke();
      ctx.restore();
    }

    // Boca.
    ctx.strokeStyle = glow;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const my2 = size * 0.76;
    if (expression === 'sorprendido' || expression === 'mareado') {
      ctx.ellipse(size / 2, my2, size * 0.06, size * 0.08, 0, 0, Math.PI * 2);
    } else if (expression === 'eufórico' || expression === 'contento') {
      ctx.arc(size / 2, my2 - size * 0.04, size * 0.12, 0.15 * Math.PI, 0.85 * Math.PI);
    } else if (expression === 'enfadado') {
      ctx.arc(size / 2, my2 + size * 0.08, size * 0.12, 1.15 * Math.PI, 1.85 * Math.PI);
    } else {
      ctx.moveTo(size / 2 - size * 0.08, my2);
      ctx.lineTo(size / 2 + size * 0.08, my2);
    }
    ctx.stroke();

    texture.needsUpdate = true;
    dirty = false;
  }

  draw({ expression: 'neutral' });

  return {
    texture,
    get dirty() {
      return dirty;
    },
    markDirty() {
      dirty = true;
    },
    draw,
  };
}

// ---------------------------------------------------------------------------
// Ensamblado
// ---------------------------------------------------------------------------

export function buildPilot(character) {
  const { species, colors } = character;
  const g = buildCommon();
  const head = { ...ANCHORS.head };

  switch (species) {
    case 'fox':
      buildFox(colors, g.body, g.head, g.face, g.arms, g.glow);
      break;
    case 'robot':
      buildRobot(colors, g.body, g.head, g.face, g.arms, g.glow);
      break;
    case 'frog':
      buildFrog(colors, g.body, g.head, g.face, g.arms, g.glow);
      break;
    case 'penguin':
      buildPenguin(colors, g.body, g.head, g.face, g.arms, g.glow);
      break;
    case 'bear':
      buildBear(colors, g.body, g.head, g.face, g.arms, g.glow);
      break;
    case 'cat':
      buildCat(colors, g.body, g.head, g.face, g.arms, g.glow);
      break;
    case 'dino':
      buildDino(colors, g.body, g.head, g.face, g.arms, g.glow);
      break;
    case 'rabbit':
      buildRabbit(colors, g.body, g.head, g.face, g.arms, g.glow);
      break;
    case 'mechanic':
      buildMechanic(colors, g.body, g.head, g.face, g.arms, g.glow);
      break;
    case 'fighter':
      buildFighter(colors, g.body, g.head, g.face, g.arms, g.glow);
      break;
    case 'numbat':
      buildNumbat(colors, g.body, g.head, g.face, g.arms, g.glow);
      break;
    default:
      buildFox(colors, g.body, g.head, g.face, g.arms, g.glow);
  }

  // Cara geométrica (excepto el robot, que dibuja sus ojos en pantalla).
  let screen = null;
  if (species === 'robot') {
    screen = buildRobotScreen(colors);
  } else {
    const cfg = faceConfig(species, colors, head);
    for (const e of cfg.eyes) buildEye(g.face, e, cfg.iris);
    for (const e of cfg.eyes) buildBrow(g.face, e.x < head.x ? 1 : -1, e, colors);
    if (cfg.mouth && cfg.mouth.follow) buildMouthFollow(g.face, cfg.mouth, cfg.mouthColor);
    else if (cfg.mouth) buildMouth(g.face, cfg.mouth, cfg.mouthColor, cfg.teethColor);
  }

  const bodyGeo = mergeParts(g.body);
  const headGeo = mergeParts(g.head);
  const armsGeo = mergeParts(g.arms);
  const faceGeo = g.face.length ? mergeParts(g.face) : null;
  const glowGeo = g.glow.length ? mergeParts(g.glow) : null;

  return {
    bodyGeo,
    headGeo,
    armsGeo,
    faceGeo,
    glowGeo,
    glow: !!glowGeo,
    screen,
    anchors: ANCHORS,
    headR: HEAD_R,
    bodyMorphs: morphMap(bodyGeo),
    headMorphs: morphMap(headGeo),
    faceMorphs: faceGeo ? morphMap(faceGeo) : {},
  };
}

function morphMap(geo) {
  const map = {};
  const names = geo.userData.morphNames;
  if (names) names.forEach((n, i) => (map[n] = i));
  return map;
}
