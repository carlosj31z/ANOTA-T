// Iconografía SVG procedural para la interfaz (bloque 6).
// Todo generado por código: retratos de personaje, iconos de objeto, emblemas de
// ventaja, miniaturas de circuito (trazado REAL vía getTrackOutline) y el rayo del
// logotipo. Sin archivos externos.

import { getTrackOutline } from '../track/index.js';

let _uid = 0;
function uid() {
  _uid += 1;
  return 'rr-grad-' + _uid;
}

export function colorCss(c) {
  if (typeof c === 'number') return '#' + (c >>> 0).toString(16).padStart(6, '0');
  return c || '#ffffff';
}

function svg(inner, extra = '') {
  return `<svg viewBox="0 0 100 100" class="rr-svg" xmlns="http://www.w3.org/2000/svg" ${extra}>${inner}</svg>`;
}

// ---------------------------------------------------------------------------
// Retratos de personaje (caras expresivas por especie, con colores del piloto).
// Expresividad común: cejas, sonrisa y brillo en los ojos.
// ---------------------------------------------------------------------------

function portraitFox(p) {
  const ink = p.ink;
  return `
    <path d="M20 42 L24 10 L46 30 Z" fill="${p.body}" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M80 42 L76 10 L54 30 Z" fill="${p.body}" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M27 20 L29 29 L38 29 Z" fill="${p.accent}"/>
    <path d="M73 20 L71 29 L62 29 Z" fill="${p.accent}"/>
    <ellipse cx="50" cy="58" rx="31" ry="29" fill="${p.body}" stroke="${ink}" stroke-width="4"/>
    <path d="M50 50 q-16 6 -16 18 q0 12 16 14 q16 -2 16 -14 q0 -12 -16 -18 Z" fill="#fff6ea" stroke="${ink}" stroke-width="3"/>
    <path d="M42 66 q8 8 16 0" fill="none" stroke="${ink}" stroke-width="2.8" stroke-linecap="round"/>
    <circle cx="50" cy="60" r="5.4" fill="${ink}"/>
    <circle cx="38" cy="53" r="5" fill="${ink}"/>
    <circle cx="62" cy="53" r="5" fill="${ink}"/>
    <circle cx="36.2" cy="51.2" r="1.8" fill="#fff"/>
    <circle cx="60.2" cy="51.2" r="1.8" fill="#fff"/>
    <path d="M31 43 q6 -5 13 -1" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>
    <path d="M69 43 q-6 -5 -13 -1" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`;
}

function portraitRobot(p) {
  const ink = p.ink;
  return `
    <line x1="50" y1="10" x2="50" y2="24" stroke="${ink}" stroke-width="4"/>
    <circle cx="50" cy="9" r="5" fill="${p.accent}" stroke="${ink}" stroke-width="3"/>
    <rect x="20" y="24" width="60" height="56" rx="15" fill="${p.body}" stroke="${ink}" stroke-width="4"/>
    <rect x="14" y="44" width="7" height="14" rx="3.5" fill="${p.body}" stroke="${ink}" stroke-width="3"/>
    <rect x="79" y="44" width="7" height="14" rx="3.5" fill="${p.body}" stroke="${ink}" stroke-width="3"/>
    <rect x="29" y="39" width="42" height="17" rx="8.5" fill="#101a30" stroke="${ink}" stroke-width="3"/>
    <circle cx="40" cy="47.5" r="4.6" fill="${p.accent}"/>
    <circle cx="60" cy="47.5" r="4.6" fill="${p.accent}"/>
    <circle cx="38.5" cy="45.9" r="1.5" fill="#fff"/>
    <circle cx="58.5" cy="45.9" r="1.5" fill="#fff"/>
    <path d="M32 33 h8" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>
    <path d="M60 33 h8" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>
    <path d="M39 66 q11 9 22 0" fill="none" stroke="${ink}" stroke-width="3.4" stroke-linecap="round"/>
    <circle cx="29" cy="70" r="2.4" fill="${p.accent}"/>
    <circle cx="71" cy="70" r="2.4" fill="${p.accent}"/>`;
}

function portraitFrog(p) {
  const ink = p.ink;
  return `
    <circle cx="31" cy="33" r="14" fill="${p.body}" stroke="${ink}" stroke-width="4"/>
    <circle cx="69" cy="33" r="14" fill="${p.body}" stroke="${ink}" stroke-width="4"/>
    <circle cx="31" cy="34" r="8.5" fill="#ffffff" stroke="${ink}" stroke-width="2.5"/>
    <circle cx="69" cy="34" r="8.5" fill="#ffffff" stroke="${ink}" stroke-width="2.5"/>
    <circle cx="31" cy="36" r="4.4" fill="${ink}"/>
    <circle cx="69" cy="36" r="4.4" fill="${ink}"/>
    <circle cx="29.3" cy="34.2" r="1.6" fill="#fff"/>
    <circle cx="67.3" cy="34.2" r="1.6" fill="#fff"/>
    <path d="M23 21 q7 -5 14 -2" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>
    <path d="M77 21 q-7 -5 -14 -2" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="50" cy="62" rx="33" ry="27" fill="${p.body}" stroke="${ink}" stroke-width="4"/>
    <path d="M28 60 q22 22 44 0" fill="none" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>
    <circle cx="43" cy="55" r="2.8" fill="${p.accent}"/>
    <circle cx="57" cy="55" r="2.8" fill="${p.accent}"/>`;
}

function portraitPenguin(p) {
  const ink = p.ink;
  return `
    <ellipse cx="50" cy="56" rx="31" ry="33" fill="${p.body}" stroke="${ink}" stroke-width="4"/>
    <ellipse cx="50" cy="63" rx="20" ry="23" fill="#ffffff" stroke="${ink}" stroke-width="3"/>
    <circle cx="41" cy="49" r="4.8" fill="${ink}"/>
    <circle cx="59" cy="49" r="4.8" fill="${ink}"/>
    <circle cx="39.4" cy="47.3" r="1.7" fill="#fff"/>
    <circle cx="57.4" cy="47.3" r="1.7" fill="#fff"/>
    <path d="M34 39 q5 -4 11 -1" fill="none" stroke="${ink}" stroke-width="2.8" stroke-linecap="round"/>
    <path d="M66 39 q-5 -4 -11 -1" fill="none" stroke="${ink}" stroke-width="2.8" stroke-linecap="round"/>
    <path d="M50 55 l-8 8 h16 Z" fill="#ff9a1f" stroke="${ink}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M42 69 q8 6 16 0" fill="none" stroke="${ink}" stroke-width="2.4" stroke-linecap="round"/>`;
}

function portraitBear(p) {
  const ink = p.ink;
  return `
    <circle cx="27" cy="27" r="13" fill="${p.body}" stroke="${ink}" stroke-width="4"/>
    <circle cx="73" cy="27" r="13" fill="${p.body}" stroke="${ink}" stroke-width="4"/>
    <circle cx="27" cy="27" r="6.5" fill="${p.accent}"/>
    <circle cx="73" cy="27" r="6.5" fill="${p.accent}"/>
    <circle cx="50" cy="58" r="31" fill="${p.body}" stroke="${ink}" stroke-width="4"/>
    <ellipse cx="50" cy="69" rx="17" ry="13" fill="${p.accent}" stroke="${ink}" stroke-width="2.5"/>
    <circle cx="50" cy="63" r="5.4" fill="${ink}"/>
    <path d="M42 73 q8 6 16 0" fill="none" stroke="${ink}" stroke-width="2.6" stroke-linecap="round"/>
    <circle cx="38" cy="51" r="4.8" fill="${ink}"/>
    <circle cx="62" cy="51" r="4.8" fill="${ink}"/>
    <circle cx="36.3" cy="49.3" r="1.7" fill="#fff"/>
    <circle cx="60.3" cy="49.3" r="1.7" fill="#fff"/>
    <path d="M31 41 q6 -5 13 -1" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>
    <path d="M69 41 q-6 -5 -13 -1" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`;
}

function portraitCat(p) {
  const ink = p.ink;
  return `
    <path d="M20 44 L23 12 L47 31 Z" fill="${p.body}" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M80 44 L77 12 L53 31 Z" fill="${p.body}" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M26 24 L28 32 L36 32 Z" fill="#ff9ec4"/>
    <path d="M74 24 L72 32 L64 32 Z" fill="#ff9ec4"/>
    <ellipse cx="50" cy="57" rx="31" ry="28" fill="${p.body}" stroke="${ink}" stroke-width="4"/>
    <circle cx="39" cy="52" r="5" fill="${ink}"/>
    <circle cx="61" cy="52" r="5" fill="${ink}"/>
    <circle cx="37.4" cy="50.3" r="1.7" fill="#fff"/>
    <circle cx="59.4" cy="50.3" r="1.7" fill="#fff"/>
    <path d="M33 43 q6 -5 13 -1" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>
    <path d="M67 43 q-6 -5 -13 -1" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>
    <path d="M50 59 l-5 5 h10 Z" fill="#ff7aa8" stroke="${ink}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M43 65 q7 7 14 0" fill="none" stroke="${ink}" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M22 60 h10 M23 67 h10" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M78 60 h-10 M77 67 h-10" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/>`;
}

function portraitDino(p) {
  const ink = p.ink;
  return `
    <path d="M26 32 l6 -16 l6 16 Z" fill="${p.accent}" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M44 30 l6 -16 l6 16 Z" fill="${p.accent}" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M62 32 l6 -16 l6 16 Z" fill="${p.accent}" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>
    <ellipse cx="50" cy="60" rx="33" ry="27" fill="${p.body}" stroke="${ink}" stroke-width="4"/>
    <circle cx="39" cy="52" r="5" fill="#ffffff" stroke="${ink}" stroke-width="2.5"/>
    <circle cx="61" cy="52" r="5" fill="#ffffff" stroke="${ink}" stroke-width="2.5"/>
    <circle cx="40" cy="53" r="2.7" fill="${ink}"/>
    <circle cx="62" cy="53" r="2.7" fill="${ink}"/>
    <circle cx="38.8" cy="51.4" r="1.2" fill="#fff"/>
    <circle cx="60.8" cy="51.4" r="1.2" fill="#fff"/>
    <path d="M31 43 q6 -5 12 -1" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>
    <path d="M69 43 q-6 -5 -12 -1" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>
    <path d="M30 68 q20 13 40 0" fill="none" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>
    <path d="M38 69 l2 6 l3 -5 Z M48 71 l2 6 l3 -5 Z M58 69 l2 6 l3 -5 Z" fill="#ffffff" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/>`;
}

function portraitRabbit(p) {
  const ink = p.ink;
  return `
    <ellipse cx="37" cy="24" rx="8" ry="23" fill="${p.body}" stroke="${ink}" stroke-width="4" transform="rotate(-10 37 24)"/>
    <ellipse cx="63" cy="24" rx="8" ry="23" fill="${p.body}" stroke="${ink}" stroke-width="4" transform="rotate(10 63 24)"/>
    <ellipse cx="37" cy="24" rx="3.6" ry="15" fill="#ffb6c1" transform="rotate(-10 37 24)"/>
    <ellipse cx="63" cy="24" rx="3.6" ry="15" fill="#ffb6c1" transform="rotate(10 63 24)"/>
    <circle cx="50" cy="61" r="30" fill="${p.body}" stroke="${ink}" stroke-width="4"/>
    <circle cx="39" cy="55" r="4.8" fill="${ink}"/>
    <circle cx="61" cy="55" r="4.8" fill="${ink}"/>
    <circle cx="37.4" cy="53.3" r="1.6" fill="#fff"/>
    <circle cx="59.4" cy="53.3" r="1.6" fill="#fff"/>
    <path d="M33 46 q6 -5 13 -1" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>
    <path d="M67 46 q-6 -5 -13 -1" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>
    <path d="M50 62 l-4.5 4.5 h9 Z" fill="#ffb6c1" stroke="${ink}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M43 68 q7 6 14 0" fill="none" stroke="${ink}" stroke-width="2.4" stroke-linecap="round"/>
    <rect x="45.5" y="73" width="9" height="8" rx="2" fill="#ffffff" stroke="${ink}" stroke-width="2"/>
    <line x1="50" y1="73" x2="50" y2="81" stroke="${ink}" stroke-width="1.6"/>`;
}

// --- Los 3 pilotos nuevos (bloque 10) ---

function portraitMechanic(p) {
  const ink = p.ink;
  const skin = p.skinColor || p.body;
  const cap = p.capColor || '#2f9e8f';
  const emblem = p.capEmblemColor || '#ffd23f';
  const must = p.mustacheColor || '#6b3f1d';
  const nose = p.noseColor || '#e08a6a';
  return `
    <ellipse cx="50" cy="62" rx="30" ry="28" fill="${skin}" stroke="${ink}" stroke-width="4"/>
    <circle cx="21" cy="60" r="5.4" fill="${skin}" stroke="${ink}" stroke-width="3"/>
    <circle cx="79" cy="60" r="5.4" fill="${skin}" stroke="${ink}" stroke-width="3"/>
    <path d="M23 47 Q24 15 50 15 Q76 15 77 47 Z" fill="${cap}" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M17 47 Q50 40 83 47 Q83 53 50 53 Q17 53 17 47 Z" fill="${cap}" stroke="${ink}" stroke-width="3.4" stroke-linejoin="round"/>
    <polygon points="50,25 55.5,28.2 55.5,34.6 50,37.8 44.5,34.6 44.5,28.2" fill="${emblem}" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="50" cy="31.4" r="2.6" fill="${ink}"/>
    <circle cx="39" cy="57" r="4.8" fill="${ink}"/>
    <circle cx="61" cy="57" r="4.8" fill="${ink}"/>
    <circle cx="37.4" cy="55.3" r="1.7" fill="#fff"/>
    <circle cx="59.4" cy="55.3" r="1.7" fill="#fff"/>
    <path d="M33 49 q6 -4 12 -1" fill="none" stroke="${ink}" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M67 49 q-6 -4 -12 -1" fill="none" stroke="${ink}" stroke-width="2.6" stroke-linecap="round"/>
    <circle cx="50" cy="65" r="5.6" fill="${nose}" stroke="${ink}" stroke-width="2.4"/>
    <path d="M50 70 Q37 59 24 68 Q18 76 29 81 Q42 84 50 75 Z" fill="${must}" stroke="${ink}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M50 70 Q63 59 76 68 Q82 76 71 81 Q58 84 50 75 Z" fill="${must}" stroke="${ink}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M24 68 q-5 -1 -7 2 M76 68 q5 -1 7 2" fill="none" stroke="${must}" stroke-width="3" stroke-linecap="round"/>
    <path d="M45 82 q5 4 10 0" fill="none" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/>`;
}

function portraitFighter(p) {
  const ink = p.ink;
  const skin = p.skinColor || p.body;
  const hair = p.hairColor || '#c9d3dd';
  const streak = p.hairStreakColor || '#28e0d0';
  const band = p.bandColor || '#ff3b3b';
  const emblem = p.emblemColor || '#28e0d0';
  return `
    <ellipse cx="50" cy="61" rx="29" ry="28" fill="${skin}" stroke="${ink}" stroke-width="4"/>
    <circle cx="22" cy="61" r="5" fill="${skin}" stroke="${ink}" stroke-width="3"/>
    <circle cx="78" cy="61" r="5" fill="${skin}" stroke="${ink}" stroke-width="3"/>
    <path d="M16 46 L27 14 L36 40 L47 10 L55 40 L64 12 L73 42 L84 22 L86 48 Z" fill="${hair}" stroke="${ink}" stroke-width="3.4" stroke-linejoin="round"/>
    <path d="M47 11 L51 40 L56 14 Z" fill="${streak}"/>
    <path d="M69 17 L65 42 L75 26 Z" fill="${streak}"/>
    <circle cx="39" cy="57" r="4.8" fill="${ink}"/>
    <circle cx="61" cy="57" r="4.8" fill="${ink}"/>
    <circle cx="37.4" cy="55.3" r="1.7" fill="#fff"/>
    <circle cx="59.4" cy="55.3" r="1.7" fill="#fff"/>
    <path d="M32 50 L45 52" fill="none" stroke="${ink}" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M68 50 L55 52" fill="none" stroke="${ink}" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M20 45 Q50 39 80 45 L80 52 Q50 46 20 52 Z" fill="${band}" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="50" cy="49.5" r="4.6" fill="${emblem}" stroke="${ink}" stroke-width="2"/>
    <path d="M46 49 q4 -5 0 -8 M50 49 q4 -5 0 -8 M54 49 q3 -4 0 -7" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M42 72 q8 7 16 0" fill="none" stroke="${ink}" stroke-width="2.8" stroke-linecap="round"/>`;
}

function portraitNumbat(p) {
  const ink = p.ink;
  const fur = p.furColor || p.body;
  const stripe = p.stripeColor || '#ffffff';
  const snout = p.snoutColor || '#f3d8b8';
  const gog = p.gogglesColor || '#6b4a1f';
  const lens = p.gogglesLensColor || '#3ab0ff';
  return `
    <path d="M30 34 L24 12 L44 27 Z" fill="${fur}" stroke="${ink}" stroke-width="3.6" stroke-linejoin="round"/>
    <path d="M70 34 L76 12 L56 27 Z" fill="${fur}" stroke="${ink}" stroke-width="3.6" stroke-linejoin="round"/>
    <ellipse cx="50" cy="60" rx="30" ry="27" fill="${fur}" stroke="${ink}" stroke-width="4"/>
    <path d="M31 38 q-4 8 -2 15" fill="none" stroke="${stripe}" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M69 38 q4 8 2 15" fill="none" stroke="${stripe}" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M45 64 Q43 82 50 89 Q57 82 55 64 Z" fill="${snout}" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="50" cy="87" r="3" fill="${ink}"/>
    <path d="M46 79 q4 4 8 0" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>
    <circle cx="36" cy="58" r="4.6" fill="${ink}"/>
    <circle cx="64" cy="58" r="4.6" fill="${ink}"/>
    <circle cx="34.4" cy="56.4" r="1.6" fill="#fff"/>
    <circle cx="62.4" cy="56.4" r="1.6" fill="#fff"/>
    <path d="M30 51 q5 -4 10 -1" fill="none" stroke="${ink}" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M70 51 q-5 -4 -10 -1" fill="none" stroke="${ink}" stroke-width="2.4" stroke-linecap="round"/>
    <ellipse cx="38" cy="35" rx="10" ry="7.5" fill="${lens}" stroke="${gog}" stroke-width="3.2"/>
    <ellipse cx="62" cy="35" rx="10" ry="7.5" fill="${lens}" stroke="${gog}" stroke-width="3.2"/>
    <circle cx="34.5" cy="32.5" r="2.2" fill="rgba(255,255,255,0.75)"/>
    <circle cx="58.5" cy="32.5" r="2.2" fill="rgba(255,255,255,0.75)"/>
    <rect x="46" y="32" width="8" height="5" rx="2.5" fill="${gog}"/>`;
}

const PORTRAITS = {
  fox: portraitFox,
  robot: portraitRobot,
  frog: portraitFrog,
  penguin: portraitPenguin,
  bear: portraitBear,
  cat: portraitCat,
  dino: portraitDino,
  rabbit: portraitRabbit,
  mechanic: portraitMechanic,
  fighter: portraitFighter,
  numbat: portraitNumbat,
};

export function characterPortrait(species, colors, look) {
  const p = {
    body: colorCss(colors && colors.body),
    accent: colorCss(colors && colors.accent),
    kart: colorCss(colors && colors.kart),
    ink: 'rgba(18,22,40,0.9)',
  };
  if (look && typeof look === 'object') {
    for (const k of Object.keys(look)) p[k] = colorCss(look[k]);
  }
  const fn = PORTRAITS[species] || PORTRAITS.fox;
  return svg(fn(p));
}

// ---------------------------------------------------------------------------
// Iconos de objeto (64x64)
// ---------------------------------------------------------------------------

function itemTurbo() {
  return `<svg viewBox="0 0 64 64" class="rr-svg" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 40 L4 56 L22 50 Z" fill="#ff3b3b" stroke="#5a2d00" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M50 40 L60 56 L42 50 Z" fill="#ff3b3b" stroke="#5a2d00" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M32 4 C45 16 47 34 41 52 L23 52 C17 34 19 16 32 4 Z" fill="#ff9a1f" stroke="#5a2d00" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="32" cy="26" r="6.5" fill="#eaf6ff" stroke="#5a2d00" stroke-width="2.6"/>
    <path d="M26 52 q6 12 12 0 q-6 7 -12 0 Z" fill="#ffd23f"/>
    <path d="M33 14 l-8 16 h6 l-3 12 10 -16 h-6 Z" fill="#fff" stroke="#5a2d00" stroke-width="1.6" stroke-linejoin="round"/>
  </svg>`;
}

function itemPeel() {
  return `<svg viewBox="0 0 64 64" class="rr-svg" xmlns="http://www.w3.org/2000/svg">
    <path d="M46 8 A26 26 0 1 0 46 56 A20 20 0 1 1 46 8 Z" fill="#ffd23f" stroke="#8a6200" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="46" cy="32" r="3" fill="#8a6200"/>
    <path d="M14 22 l4 -4 M11 34 l5 -2 M16 46 l4 -3" stroke="#fff3b0" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
}

function itemBouncer() {
  return `<svg viewBox="0 0 64 64" class="rr-svg" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 46 A26 22 0 0 1 58 46 Z" fill="#2fae5f" stroke="#0c3a20" stroke-width="3" stroke-linejoin="round"/>
    <path d="M32 24 V46 M14 40 q4 -14 18 -14 M50 40 q-4 -14 -18 -14" fill="none" stroke="#0c3a20" stroke-width="2.4"/>
    <ellipse cx="32" cy="46" rx="26" ry="6" fill="#eafff0" stroke="#0c3a20" stroke-width="3"/>
    <circle cx="26" cy="34" r="2.6" fill="#0c3a20"/>
    <circle cx="38" cy="34" r="2.6" fill="#0c3a20"/>
  </svg>`;
}

function itemSeeker() {
  return `<svg viewBox="0 0 64 64" class="rr-svg" xmlns="http://www.w3.org/2000/svg">
    <path d="M48 20 L62 10 L56 26 Z" fill="#b00020" stroke="#3d0008" stroke-width="2.4" stroke-linejoin="round"/>
    <circle cx="30" cy="34" r="24" fill="#ff3b3b" stroke="#3d0008" stroke-width="3"/>
    <ellipse cx="30" cy="34" rx="14" ry="10.5" fill="#ffffff" stroke="#3d0008" stroke-width="2.4"/>
    <circle cx="30" cy="34" r="6.5" fill="#1a1030"/>
    <circle cx="27.5" cy="31" r="2.6" fill="#ffffff"/>
  </svg>`;
}

function itemShield() {
  const id = uid();
  const star = starPath(32, 33, 27, 11.5);
  const star2 = starPath(32, 33, 15, 6.5);
  return `<svg viewBox="0 0 64 64" class="rr-svg" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ff3b3b"/><stop offset="0.25" stop-color="#ff9a1f"/>
      <stop offset="0.5" stop-color="#ffd23f"/><stop offset="0.75" stop-color="#3ad24a"/>
      <stop offset="1" stop-color="#2f80ff"/></linearGradient></defs>
    <path d="${star}" fill="url(#${id})" stroke="#12182e" stroke-width="3" stroke-linejoin="round"/>
    <path d="${star2}" fill="rgba(255,255,255,0.9)"/>
  </svg>`;
}

function itemStorm() {
  return `<svg viewBox="0 0 64 64" class="rr-svg" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="32" cy="30" rx="26" ry="15" fill="#c9d3e6" stroke="#2a3350" stroke-width="3"/>
    <circle cx="22" cy="24" r="12" fill="#e6edf9" stroke="#2a3350" stroke-width="3"/>
    <circle cx="42" cy="22" r="14" fill="#dfe7f5" stroke="#2a3350" stroke-width="3"/>
    <path d="M33 34 l-11 18 h9 l-4 14 15 -20 h-9 Z" fill="#ffd23f" stroke="#8a6200" stroke-width="2.4" stroke-linejoin="round"/>
  </svg>`;
}

const ITEMS = {
  turbo: itemTurbo,
  peel: itemPeel,
  bouncer: itemBouncer,
  seeker: itemSeeker,
  shield: itemShield,
  storm: itemStorm,
};

export function itemIcon(id) {
  const fn = ITEMS[id];
  if (!fn) return '';
  return fn();
}

// ---------------------------------------------------------------------------
// Emblemas de ventaja (perk) — 24x24, se pintan dentro de una insignia
// ---------------------------------------------------------------------------

const PERK_ICONS = {
  astucia: '<path d="M13 2 L4.5 13.5 h5.5 l-1.5 8.5 9-12 h-6 Z" fill="#fff"/>',
  blindaje: '<path d="M12 2 L20 5 v6.2 c0 4.9 -3.4 8.5 -8 10.8 -4.6 -2.3 -8 -5.9 -8 -10.8 V5 Z" fill="#fff"/>',
  salto_rana:
    '<path d="M12 3 L18 12 h-4.2 v7 h-3.6 v-7 H6 Z" fill="#fff"/><path d="M3.5 21.5 q8.5 4 17 0" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>',
  patinador:
    '<g stroke="#fff" stroke-width="2.2" stroke-linecap="round"><path d="M12 2 v20"/><path d="M3.3 7 l17.4 10"/><path d="M20.7 7 L3.3 17"/></g>',
  empujon:
    '<path d="M3 12 h6 M9 12 l-3 -3 M9 12 l-3 3" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 12 h-6 M15 12 l3 -3 M15 12 l3 3" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  siete_vidas: '<path d="M12 21 C4.5 15.5 2 10.5 5 6.5 c2.2 -3 6.2 -2 7 1 0.8 -3 4.8 -4 7 -1 3 4 0.5 9 -7 14.5 Z" fill="#fff"/>',
  rugido:
    '<path d="M3 9 h4 l5 -4 v14 l-5 -4 H3 Z" fill="#fff"/><path d="M16 8.5 q3 3.5 0 7 M19 5.5 q5 6.5 0 13" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/>',
  salida:
    '<path d="M12 2 c4 3.2 5.5 8 5.5 11.5 L15 17 H9 l-2.5 -3.5 C6.5 10 8 5.2 12 2 Z" fill="#fff"/><circle cx="12" cy="9" r="2.1" fill="#123"/><path d="M9 19 l-2 3 3.2 -1 M15 19 l2 3 -3.2 -1" fill="#fff"/>',
  mecanico:
    '<path d="M20.5 6.5 a4.6 4.6 0 0 1 -6.1 5.9 L6 20.8 l-2.8 -2.8 8.4 -8.4 a4.6 4.6 0 0 1 5.9 -6.1 l-3 3 1.5 1.5 3 -3 Z" fill="#fff"/>',
  aura: '<path d="M12 2 c1.5 4 5.5 5.5 5.5 10 a5.5 5.5 0 0 1 -11 0 c0 -2.6 1.8 -3.7 2.6 -6 1 1.2 1.6 2.2 2.9 2.4 C11.2 6.6 11.6 4 12 2 Z" fill="#fff"/>',
  torbellino:
    '<g stroke="#fff" stroke-width="2.3" stroke-linecap="round" fill="none"><path d="M3 5 h18"/><path d="M5 9 h14"/><path d="M7 13 h10"/><path d="M9.5 17 h5"/><path d="M11.5 21 h1.5"/></g>',
};

export function perkIcon(id) {
  const inner = PERK_ICONS[id];
  if (!inner) return '';
  return `<svg viewBox="0 0 24 24" class="rr-svg rr-perk-svg" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}

// ---------------------------------------------------------------------------
// Miniaturas de circuito — trazado REAL (getTrackOutline) normalizado a 160x100.
// Carretera blanca con borde oscuro, línea central de puntos, fondo temático y
// bandera de cuadros en el primer punto.
// ---------------------------------------------------------------------------

function projectOutline(pts, W, H, pad) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }
  const bw = maxX - minX || 1;
  const bh = maxZ - minZ || 1;
  const s = Math.min((W - pad * 2) / bw, (H - pad * 2) / bh);
  const ox = (W - bw * s) / 2;
  const oy = (H - bh * s) / 2;
  const proj = (x, z) => [ox + (x - minX) * s, oy + (z - minZ) * s];
  let d = '';
  pts.forEach((pt, i) => {
    const [x, y] = proj(pt.x, pt.z);
    d += (i === 0 ? 'M' : 'L') + x.toFixed(2) + ' ' + y.toFixed(2) + ' ';
  });
  return { d: d + 'Z', proj };
}

function checkerFlag(x, y) {
  const cell = 2;
  let squares = '';
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 5; c++) {
      const fill = (r + c) % 2 ? '#141b33' : '#ffffff';
      squares += `<rect x="${x + 1 + c * cell}" y="${y - 20 + r * cell}" width="${cell}" height="${cell}" fill="${fill}"/>`;
    }
  }
  return `
    <line x1="${x}" y1="${y + 4}" x2="${x}" y2="${y - 20}" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round"/>
    <rect x="${x + 1}" y="${y - 20}" width="10" height="6" fill="#ffffff" stroke="#141b33" stroke-width="0.8"/>
    ${squares}`;
}

export function trackThumb(id, previewColor) {
  const color = colorCss(previewColor);
  let pts = [];
  try {
    pts = getTrackOutline(id) || [];
  } catch (e) {
    pts = [];
  }
  const W = 160;
  const H = 100;
  const gid = uid();
  let road = '';
  let flag = '';
  if (pts.length) {
    const { d, proj } = projectOutline(pts, W, H, 18);
    road = `
      <path d="${d}" fill="none" stroke="rgba(255,255,255,0.96)" stroke-width="10" stroke-linejoin="round" stroke-linecap="round"/>
      <path d="${d}" fill="none" stroke="rgba(20,26,50,0.85)" stroke-width="4" stroke-linejoin="round"/>
      <path d="${d}" fill="none" stroke="rgba(255,210,63,0.95)" stroke-width="1.5" stroke-dasharray="4 6" stroke-linejoin="round"/>`;
    const [fx, fy] = proj(pts[0].x, pts[0].z);
    flag = checkerFlag(fx, fy);
  }
  const inner = `
    <defs>
      <radialGradient id="${gid}" cx="50%" cy="36%" r="78%">
        <stop offset="0" stop-color="${color}" stop-opacity="0.6"/>
        <stop offset="0.7" stop-color="${color}" stop-opacity="0.28"/>
        <stop offset="1" stop-color="#0a0e1e" stop-opacity="0.92"/>
      </radialGradient>
    </defs>
    <rect width="160" height="100" fill="url(#${gid})"/>
    <rect width="160" height="100" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="2"/>
    ${road}
    ${flag}`;
  return `<svg viewBox="0 0 160 100" class="rr-svg rr-thumb" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}

// ---------------------------------------------------------------------------
// Rayo del logotipo
// ---------------------------------------------------------------------------

export function boltSvg(cls = 'logo-bolt') {
  return `<svg viewBox="0 0 48 80" class="${cls}" xmlns="http://www.w3.org/2000/svg">
    <path d="M30 2 L6 44 H22 L16 78 L42 30 H26 Z" fill="#ffd23f" stroke="#7a3d00" stroke-width="4" stroke-linejoin="round"/>
    <path d="M30 2 L6 44 H18 L24 20 Z" fill="#fff7c2" opacity="0.75"/>
  </svg>`;
}

function starPath(cx, cy, R, r, points = 5) {
  const step = Math.PI / points;
  let d = '';
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? R : r;
    const a = -Math.PI / 2 + i * step;
    d += (i === 0 ? 'M' : 'L') + (cx + Math.cos(a) * rad).toFixed(1) + ' ' + (cy + Math.sin(a) * rad).toFixed(1) + ' ';
  }
  return d + 'Z';
}
