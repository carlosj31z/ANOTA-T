// Bloque 2 — Pilotos orgánicos y expresivos (tanda 3).
// Cabezones (~45 % de la altura), formas redondeadas construidas con esferas y
// cápsulas de alta resolución deformadas y soldadas. Cara con esclerótica,
// iris, pupila y brillo, párpados, cejas y boca deformable mediante morph
// targets. Vísceras internas: aquí solo geometría; los materiales en materials.js.
//
// Coordenadas del piloto: origen en la base (asiento), +Z = adelante del kart.

import * as THREE from 'three';
import { xf, blob, cap, ball, tube, torus, mergeParts } from './geo.js';

export const ANCHORS = {
  head: { x: 0, y: 0.62, z: 0.0 },
  arms: { x: 0, y: 0.3, z: 0.08 },
};

const HEAD_R = 0.2;

// ---------------------------------------------------------------------------
// Utilidades de construcción
// ---------------------------------------------------------------------------

const V = (x, y, z) => new THREE.Vector3(x, y, z);

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
  const len = e.r * 1.5;
  const anchor = V(e.x - side * e.r * 0.72, e.y + e.r * 0.86, e.z + e.r * 0.5);
  let g = new THREE.CapsuleGeometry(0.011, len, 4, 8);
  xf(g, { rz: Math.PI / 2, rx: 0.15 });
  xf(g, { x: anchor.x + side * len * 0.5, y: anchor.y + 0.02, z: anchor.z });
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
    case 'frog':
      return {
        ...base,
        mouthColor: 0x123018,
        eyes: [
          { x: hx - 0.115, y: hy + 0.2, z: hz + 0.06, r: 0.062, lidColor: colors.body },
          { x: hx + 0.115, y: hy + 0.2, z: hz + 0.06, r: 0.062, lidColor: colors.body },
        ],
        iris: 0xc9a227,
        mouth: { x: hx, y: hy - 0.075, z: hz + 0.14, R: 0.11, tube: 0.014 },
      };
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
  return { body, head, face, arms };
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
  buildArmsCommon(colors, arms);
}

function buildFrog(colors, body, head, face, arms) {
  const b = colors.body;
  // Cuerpo bajo y ancho.
  body.push({ geo: xf(torsoParts(), { sy: 0.8, sx: 1.15, sz: 1.05 }), color: b });
  // Manchas.
  for (const [mx, my, mz, mr] of [
    [0.1, 0.22, 0.1, 0.03],
    [-0.12, 0.18, 0.06, 0.025],
    [0.04, 0.3, -0.05, 0.022],
  ]) {
    body.push({ geo: xf(orb(mr, 12), { x: mx, y: my, z: mz, sz: 0.4 }), color: 0x2f8f38 });
  }
  // Cabeza ancha y baja con boca enorme.
  let shell = headShell((v) => {
    v.x *= 1.18;
    v.y *= 0.82;
    v.z *= 1.05;
    // párpados óseos sobre los ojos
  });
  head.push({ geo: xf(shell, { x: ANCHORS.head.x, y: ANCHORS.head.y - 0.02, z: ANCHORS.head.z }), color: b });
  // Ojos saltones (cúpulas) — la esclerótica va en la cara; aquí los párpados.
  for (const side of [1, -1]) {
    head.push({ geo: xf(orb(0.072, 16), { x: ANCHORS.head.x + side * 0.115, y: ANCHORS.head.y + 0.19, z: ANCHORS.head.z + 0.05, sy: 0.85 }), color: b });
  }
  buildArmsCommon(colors, arms);
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
  body.push({ geo: xf(blob(0.06, null, 16, 12), { x: 0, y: 0.2, z: -0.16, sz: 1.4 }), color: 0xfdfdfd });
  // Cabeza.
  let shell = headShell((v) => { v.x *= 1.03; v.y *= 1.0; v.z *= 1.0; });
  head.push({ geo: xf(shell, ANCHORS.head), color: b });
  // Orejas largas (morph para flamear).
  for (const side of [1, -1]) {
    const base = V(ANCHORS.head.x + side * 0.07, ANCHORS.head.y + 0.17, ANCHORS.head.z - 0.01);
    let ear = blob(0.045, (v) => { v.y += 0.16; const t = (v.y - 0.16) / 0.045; v.x *= 1 - 0.3 * Math.max(0, t); v.z *= 1 - 0.25 * Math.max(0, t); v.y *= 1.05; v.y *= 1.6; }, 22, 18);
    xf(ear, { x: base.x, y: base.y, z: base.z, rz: side * -0.12 });
    const morphs = { earBend: bendMorph(base, V(1, 0, 0), -0.95), earWag: bendMorph(base, V(0, 0, 1), side * 0.4) };
    head.push({ geo: ear, color: b, morphs });
    head.push({ geo: xf(orb(0.024, 10), { x: base.x, y: base.y + 0.1, z: base.z + 0.03, sy: 2.0 }), color: a, morphs });
  }
  // Naricita y dientes.
  head.push({ geo: xf(blob(0.055, (v) => { v.z *= 1.1; v.y *= 0.75; }, 20, 14), { x: 0, y: ANCHORS.head.y - 0.06, z: ANCHORS.head.z + 0.16 }), color: 0xfdfdfd });
  head.push({ geo: xf(orb(0.024, 10), { x: 0, y: ANCHORS.head.y - 0.04, z: ANCHORS.head.z + 0.205 }), color: 0xff9ab0 });
  buildArmsCommon(colors, arms);
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
      buildFox(colors, g.body, g.head, g.face, g.arms);
      break;
    case 'robot':
      buildRobot(colors, g.body, g.head, g.face, g.arms);
      break;
    case 'frog':
      buildFrog(colors, g.body, g.head, g.face, g.arms);
      break;
    case 'penguin':
      buildPenguin(colors, g.body, g.head, g.face, g.arms);
      break;
    case 'bear':
      buildBear(colors, g.body, g.head, g.face, g.arms);
      break;
    case 'cat':
      buildCat(colors, g.body, g.head, g.face, g.arms);
      break;
    case 'dino':
      buildDino(colors, g.body, g.head, g.face, g.arms);
      break;
    case 'rabbit':
      buildRabbit(colors, g.body, g.head, g.face, g.arms);
      break;
    default:
      buildFox(colors, g.body, g.head, g.face, g.arms);
  }

  // Cara geométrica (excepto el robot, que dibuja sus ojos en pantalla).
  let screen = null;
  if (species === 'robot') {
    screen = buildRobotScreen(colors);
  } else {
    const cfg = faceConfig(species, colors, head);
    for (const e of cfg.eyes) buildEye(g.face, e, cfg.iris);
    for (const e of cfg.eyes) buildBrow(g.face, e.x < head.x ? 1 : -1, e, colors);
    if (cfg.mouth) buildMouth(g.face, cfg.mouth, cfg.mouthColor, cfg.teethColor);
  }

  const bodyGeo = mergeParts(g.body);
  const headGeo = mergeParts(g.head);
  const armsGeo = mergeParts(g.arms);
  const faceGeo = g.face.length ? mergeParts(g.face) : null;

  return {
    bodyGeo,
    headGeo,
    armsGeo,
    faceGeo,
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
