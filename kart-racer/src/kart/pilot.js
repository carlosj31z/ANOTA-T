// Bloque 2 — Piloto procedural, una silueta clara por especie.
// Las listas devueltas son piezas { geo, color } que model.js fusiona.
// Coordenadas: +Z = adelante del kart; el origen del piloto es su base (asiento).

import * as THREE from 'three';

function g(geo, t = {}) {
  const { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s } = t;
  if (s) {
    geo.scale(s[0], s[1], s[2]);
    geo.computeVertexNormals();
  }
  if (rx) geo.rotateX(rx);
  if (ry) geo.rotateY(ry);
  if (rz) geo.rotateZ(rz);
  if (x || y || z) geo.translate(x, y, z);
  return geo;
}

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s);
const sph = (r, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h);
const cone = (r, h, s = 8) => new THREE.ConeGeometry(r, h, s);

// Ojos con brillo: esfera blanca + pupila oscura (lista "face").
function addEyes(face, opts = {}) {
  const { ex = 0.085, ey = 0.03, ez = 0.19, r = 0.055, pr = 0.03 } = opts;
  for (const sgn of [1, -1]) {
    face.push({ geo: g(sph(r), { x: sgn * ex, y: ey, z: ez }), color: 0xffffff });
    face.push({ geo: g(sph(pr), { x: sgn * ex, y: ey, z: ez + r * 0.75 }), color: 0x14161c });
  }
}

const ANCHORS = {
  head: { x: 0, y: 0.56, z: -0.02 },
  headSpring: { x: 0, y: 0.14, z: 0 },
  bodySpring: { x: 0, y: 0.30, z: -0.12 },
  arms: { x: 0, y: 0.32, z: 0.06 },
};

export function buildPilotParts(character) {
  const { species, colors } = character;
  const body = colors.body;
  const accent = colors.accent;

  const B = []; // cuerpo / torso
  const H = []; // cabeza
  const F = []; // brillos (ojos, visor)
  const A = []; // brazos
  const HS = []; // rasgos con muelle, ligados a la cabeza
  const BS = []; // rasgos con muelle, ligados al cuerpo

  // --- Base común: torso sentado + hombros ---
  B.push({ geo: g(cyl(0.19, 0.25, 0.44, 10), { y: 0.24 }), color: body });
  B.push({ geo: g(sph(0.10), { x: 0.21, y: 0.36, z: 0.04 }), color: body });
  B.push({ geo: g(sph(0.10), { x: -0.21, y: 0.36, z: 0.04 }), color: body });
  // Cinturón de acento
  B.push({ geo: g(cyl(0.205, 0.235, 0.07, 10), { y: 0.30 }), color: accent });

  // --- Brazos al volante (grupo único que sube al celebrar) ---
  A.push({ geo: g(cyl(0.05, 0.055, 0.46, 7), { rx: 2.25, x: 0.18, y: -0.06, z: 0.22 }), color: body });
  A.push({ geo: g(cyl(0.05, 0.055, 0.46, 7), { rx: 2.25, x: -0.18, y: -0.06, z: 0.22 }), color: body });
  A.push({ geo: g(sph(0.075), { x: 0.11, y: -0.17, z: 0.44 }), color: accent });
  A.push({ geo: g(sph(0.075), { x: -0.11, y: -0.17, z: 0.44 }), color: accent });

  // --- Cabeza base ---
  H.push({ geo: g(sph(0.22), {}), color: body });

  switch (species) {
    case 'fox': {
      // Hocico + nariz
      H.push({ geo: g(cone(0.09, 0.26, 8), { rx: Math.PI / 2, y: -0.03, z: 0.20 }), color: accent });
      H.push({ geo: g(sph(0.035), { y: -0.03, z: 0.33 }), color: 0x14161c });
      // Orejas puntiagudas con interior claro (muelle)
      for (const sgn of [1, -1]) {
        HS.push({ geo: g(cone(0.10, 0.30, 7), { x: sgn * 0.12, y: 0.08, z: -0.03, rz: -sgn * 0.22 }), color: body });
        HS.push({ geo: g(cone(0.05, 0.20, 7), { x: sgn * 0.12, y: 0.06, z: -0.01, rz: -sgn * 0.22 }), color: accent });
      }
      // Cola con punta clara (muelle sobre el cuerpo)
      BS.push({ geo: g(cone(0.11, 0.5, 8), { rx: -1.9, y: -0.12, z: -0.20 }), color: body });
      BS.push({ geo: g(sph(0.09), { y: -0.30, z: -0.44 }), color: accent });
      addEyes(F, { ex: 0.09, ey: 0.04 });
      break;
    }

    case 'robot': {
      // Cabeza cúbica de acero
      H.length = 0; // reemplaza la esfera base
      H.push({ geo: g(box(0.42, 0.42, 0.42), {}), color: body });
      // Visor luminoso
      F.push({ geo: g(box(0.30, 0.09, 0.06), { y: 0.02, z: 0.21 }), color: 0x35e8ff });
      F.push({ geo: g(box(0.22, 0.05, 0.05), { y: -0.12, z: 0.21 }), color: 0xff5b3a });
      // Antena (muelle)
      HS.push({ geo: g(cyl(0.02, 0.02, 0.28, 6), { y: 0.16, z: -0.02 }), color: 0x5b6572 });
      HS.push({ geo: g(sph(0.055), { y: 0.32, z: -0.02 }), color: accent });
      // Placa pectoral
      B.push({ geo: g(box(0.24, 0.18, 0.06), { y: 0.30, z: 0.20 }), color: accent });
      F.push({ geo: g(box(0.10, 0.06, 0.03), { y: 0.30, z: 0.24 }), color: 0xffd23f });
      break;
    }

    case 'frog': {
      // Ojos saltones sobre la cabeza
      for (const sgn of [1, -1]) {
        F.push({ geo: g(sph(0.10), { x: sgn * 0.12, y: 0.19, z: 0.06 }), color: 0xffffff });
        F.push({ geo: g(sph(0.05), { x: sgn * 0.12, y: 0.21, z: 0.15 }), color: 0x14161c });
      }
      // Boca ancha
      H.push({ geo: g(box(0.30, 0.035, 0.06), { y: -0.10, z: 0.19 }), color: 0x123018 });
      B.push({ geo: g(sph(0.24), { s: [1, 0.9, 0.7], y: 0.28, z: 0.05 }), color: body });
      break;
    }

    case 'penguin': {
      // Pico naranja
      H.push({ geo: g(cone(0.06, 0.18, 6), { rx: Math.PI / 2, y: -0.02, z: 0.20 }), color: accent });
      // Panza blanca
      B.push({ geo: g(sph(0.22), { s: [0.85, 1.05, 0.55], y: 0.26, z: 0.13 }), color: 0xffffff });
      addEyes(F, { ex: 0.08, ey: 0.05 });
      break;
    }

    case 'bear': {
      // Orejas redondas
      for (const sgn of [1, -1]) {
        H.push({ geo: g(sph(0.09), { x: sgn * 0.15, y: 0.17, z: -0.02 }), color: body });
        H.push({ geo: g(sph(0.045), { x: sgn * 0.15, y: 0.17, z: 0.05 }), color: accent });
      }
      // Hocico
      H.push({ geo: g(box(0.18, 0.14, 0.16), { y: -0.05, z: 0.20 }), color: accent });
      H.push({ geo: g(sph(0.04), { y: 0.0, z: 0.29 }), color: 0x14161c });
      addEyes(F, { ex: 0.09, ey: 0.06 });
      break;
    }

    case 'cat': {
      // Orejas triangulares (muelle)
      for (const sgn of [1, -1]) {
        HS.push({ geo: g(cone(0.085, 0.22, 6), { x: sgn * 0.11, y: 0.10, z: -0.01, rz: -sgn * 0.15 }), color: body });
        HS.push({ geo: g(cone(0.045, 0.14, 6), { x: sgn * 0.11, y: 0.09, z: 0.02, rz: -sgn * 0.15 }), color: accent });
      }
      // Hociquito y bigotes
      H.push({ geo: g(box(0.14, 0.10, 0.12), { y: -0.05, z: 0.20 }), color: accent });
      H.push({ geo: g(sph(0.028), { y: -0.02, z: 0.27 }), color: 0xff7aa2 });
      for (const sgn of [1, -1]) {
        H.push({ geo: g(cyl(0.004, 0.004, 0.24, 4), { rz: sgn * 1.35, x: sgn * 0.16, y: -0.05, z: 0.18 }), color: 0x3a3f47 });
        H.push({ geo: g(cyl(0.004, 0.004, 0.22, 4), { rz: sgn * 1.65, x: sgn * 0.16, y: -0.09, z: 0.18 }), color: 0x3a3f47 });
      }
      addEyes(F, { ex: 0.085, ey: 0.04 });
      break;
    }

    case 'dino': {
      // Cabeza alargada
      H.length = 0;
      H.push({ geo: g(box(0.30, 0.26, 0.46), { y: 0.02, z: 0.04 }), color: body });
      H.push({ geo: g(box(0.22, 0.16, 0.24), { y: -0.05, z: 0.30 }), color: body });
      // Dientes
      for (const sgn of [1, -1]) {
        H.push({ geo: g(cone(0.02, 0.05, 4), { x: sgn * 0.07, y: -0.10, z: 0.30, rx: Math.PI }), color: 0xffffff });
      }
      addEyes(F, { ex: 0.10, ey: 0.10, ez: 0.20, r: 0.05, pr: 0.026 });
      // Crestas en la espalda (muelle)
      BS.push({ geo: g(cone(0.07, 0.18, 6), { rx: -0.5, y: 0.10, z: -0.05 }), color: accent });
      BS.push({ geo: g(cone(0.08, 0.20, 6), { rx: -0.5, y: 0.06, z: -0.24 }), color: accent });
      BS.push({ geo: g(cone(0.06, 0.15, 6), { rx: -0.5, y: -0.02, z: -0.40 }), color: accent });
      break;
    }

    case 'rabbit': {
      // Orejas largas con interior rosa (muelle)
      for (const sgn of [1, -1]) {
        HS.push({ geo: g(cyl(0.05, 0.06, 0.44, 8), { x: sgn * 0.09, y: 0.22, z: -0.02, rz: -sgn * 0.12 }), color: body });
        HS.push({ geo: g(cyl(0.028, 0.032, 0.34, 8), { x: sgn * 0.10, y: 0.20, z: 0.02, rz: -sgn * 0.12 }), color: accent });
      }
      // Naricita y dientes
      H.push({ geo: g(sph(0.03), { y: -0.02, z: 0.20 }), color: 0xff9ab0 });
      H.push({ geo: g(box(0.06, 0.05, 0.03), { y: -0.11, z: 0.19 }), color: 0xffffff });
      addEyes(F, { ex: 0.085, ey: 0.04 });
      break;
    }

    default: {
      addEyes(F);
      break;
    }
  }

  return { body: B, head: H, face: F, arms: A, headSpring: HS, bodySpring: BS, anchors: ANCHORS };
}
