// Iconografía SVG procedural para la interfaz (bloque 6).
// Todo generado por código: retratos de personaje, iconos de objeto, miniaturas
// de circuito y el rayo del logotipo. Sin archivos externos.

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
// Retratos de personaje (caras simples por especie, con los colores del piloto)
// ---------------------------------------------------------------------------

function portraitFox(p) {
  return `
    <path d="M20 42 L24 10 L46 30 Z" fill="${p.body}" stroke="${p.ink}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M80 42 L76 10 L54 30 Z" fill="${p.body}" stroke="${p.ink}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M27 20 L29 29 L38 29 Z" fill="${p.accent}"/>
    <path d="M73 20 L71 29 L62 29 Z" fill="${p.accent}"/>
    <ellipse cx="50" cy="58" rx="31" ry="29" fill="${p.body}" stroke="${p.ink}" stroke-width="4"/>
    <path d="M50 50 q-15 6 -15 17 q0 11 15 13 q15 -2 15 -13 q0 -11 -15 -17 Z" fill="#fff6ea" stroke="${p.ink}" stroke-width="3"/>
    <circle cx="50" cy="70" r="5.5" fill="${p.ink}"/>
    <circle cx="38" cy="53" r="4.8" fill="${p.ink}"/>
    <circle cx="62" cy="53" r="4.8" fill="${p.ink}"/>
    <circle cx="36.5" cy="51.5" r="1.6" fill="#fff"/>
    <circle cx="60.5" cy="51.5" r="1.6" fill="#fff"/>`;
}

function portraitRobot(p) {
  return `
    <line x1="50" y1="10" x2="50" y2="24" stroke="${p.ink}" stroke-width="4"/>
    <circle cx="50" cy="9" r="5" fill="${p.accent}" stroke="${p.ink}" stroke-width="3"/>
    <rect x="20" y="24" width="60" height="56" rx="15" fill="${p.body}" stroke="${p.ink}" stroke-width="4"/>
    <rect x="29" y="40" width="42" height="17" rx="8" fill="#101a30" stroke="${p.ink}" stroke-width="3"/>
    <circle cx="40" cy="48.5" r="4.4" fill="${p.accent}"/>
    <circle cx="60" cy="48.5" r="4.4" fill="${p.accent}"/>
    <rect x="38" y="66" width="24" height="6" rx="3" fill="${p.ink}"/>
    <rect x="14" y="44" width="7" height="14" rx="3.5" fill="${p.body}" stroke="${p.ink}" stroke-width="3"/>
    <rect x="79" y="44" width="7" height="14" rx="3.5" fill="${p.body}" stroke="${p.ink}" stroke-width="3"/>`;
}

function portraitFrog(p) {
  return `
    <circle cx="31" cy="33" r="14" fill="${p.body}" stroke="${p.ink}" stroke-width="4"/>
    <circle cx="69" cy="33" r="14" fill="${p.body}" stroke="${p.ink}" stroke-width="4"/>
    <circle cx="31" cy="34" r="8.5" fill="#ffffff" stroke="${p.ink}" stroke-width="2.5"/>
    <circle cx="69" cy="34" r="8.5" fill="#ffffff" stroke="${p.ink}" stroke-width="2.5"/>
    <circle cx="31" cy="36" r="4.2" fill="${p.ink}"/>
    <circle cx="69" cy="36" r="4.2" fill="${p.ink}"/>
    <ellipse cx="50" cy="62" rx="33" ry="27" fill="${p.body}" stroke="${p.ink}" stroke-width="4"/>
    <path d="M28 62 q22 19 44 0" fill="none" stroke="${p.ink}" stroke-width="4" stroke-linecap="round"/>
    <circle cx="43" cy="56" r="2.4" fill="${p.accent}"/>
    <circle cx="57" cy="56" r="2.4" fill="${p.accent}"/>`;
}

function portraitPenguin(p) {
  return `
    <ellipse cx="50" cy="56" rx="31" ry="33" fill="${p.body}" stroke="${p.ink}" stroke-width="4"/>
    <ellipse cx="50" cy="63" rx="20" ry="23" fill="#ffffff" stroke="${p.ink}" stroke-width="3"/>
    <circle cx="41" cy="49" r="4.6" fill="${p.ink}"/>
    <circle cx="59" cy="49" r="4.6" fill="${p.ink}"/>
    <circle cx="39.5" cy="47.5" r="1.5" fill="#fff"/>
    <circle cx="57.5" cy="47.5" r="1.5" fill="#fff"/>
    <path d="M50 55 l-8 7 h16 Z" fill="#ff9a1f" stroke="${p.ink}" stroke-width="2.5" stroke-linejoin="round"/>`;
}

function portraitBear(p) {
  return `
    <circle cx="27" cy="27" r="13" fill="${p.body}" stroke="${p.ink}" stroke-width="4"/>
    <circle cx="73" cy="27" r="13" fill="${p.body}" stroke="${p.ink}" stroke-width="4"/>
    <circle cx="27" cy="27" r="6.5" fill="${p.accent}"/>
    <circle cx="73" cy="27" r="6.5" fill="${p.accent}"/>
    <circle cx="50" cy="58" r="31" fill="${p.body}" stroke="${p.ink}" stroke-width="4"/>
    <ellipse cx="50" cy="69" rx="17" ry="13" fill="${p.accent}" stroke="${p.ink}" stroke-width="2.5"/>
    <circle cx="50" cy="63" r="5.5" fill="${p.ink}"/>
    <circle cx="38" cy="51" r="4.6" fill="${p.ink}"/>
    <circle cx="62" cy="51" r="4.6" fill="${p.ink}"/>
    <circle cx="36.5" cy="49.5" r="1.5" fill="#fff"/>
    <circle cx="60.5" cy="49.5" r="1.5" fill="#fff"/>`;
}

function portraitCat(p) {
  return `
    <path d="M20 44 L23 12 L47 31 Z" fill="${p.body}" stroke="${p.ink}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M80 44 L77 12 L53 31 Z" fill="${p.body}" stroke="${p.ink}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M26 24 L28 32 L36 32 Z" fill="#ff9ec4"/>
    <path d="M74 24 L72 32 L64 32 Z" fill="#ff9ec4"/>
    <ellipse cx="50" cy="57" rx="31" ry="28" fill="${p.body}" stroke="${p.ink}" stroke-width="4"/>
    <circle cx="39" cy="52" r="4.8" fill="${p.ink}"/>
    <circle cx="61" cy="52" r="4.8" fill="${p.ink}"/>
    <circle cx="37.5" cy="50.5" r="1.6" fill="#fff"/>
    <circle cx="59.5" cy="50.5" r="1.6" fill="#fff"/>
    <path d="M50 62 l-5 5 h10 Z" fill="#ff7aa8" stroke="${p.ink}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M22 60 h10 M23 67 h10" stroke="${p.ink}" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M78 60 h-10 M77 67 h-10" stroke="${p.ink}" stroke-width="2.2" stroke-linecap="round"/>`;
}

function portraitDino(p) {
  return `
    <path d="M26 32 l6 -16 l6 16 Z" fill="${p.accent}" stroke="${p.ink}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M44 30 l6 -16 l6 16 Z" fill="${p.accent}" stroke="${p.ink}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M62 32 l6 -16 l6 16 Z" fill="${p.accent}" stroke="${p.ink}" stroke-width="3" stroke-linejoin="round"/>
    <ellipse cx="50" cy="60" rx="33" ry="27" fill="${p.body}" stroke="${p.ink}" stroke-width="4"/>
    <circle cx="39" cy="52" r="5" fill="#ffffff" stroke="${p.ink}" stroke-width="2.5"/>
    <circle cx="61" cy="52" r="5" fill="#ffffff" stroke="${p.ink}" stroke-width="2.5"/>
    <circle cx="40" cy="53" r="2.6" fill="${p.ink}"/>
    <circle cx="62" cy="53" r="2.6" fill="${p.ink}"/>
    <path d="M30 68 q20 13 40 0" fill="none" stroke="${p.ink}" stroke-width="4" stroke-linecap="round"/>
    <path d="M38 69 l2 6 l3 -5 Z M48 71 l2 6 l3 -5 Z M58 69 l2 6 l3 -5 Z" fill="#ffffff" stroke="${p.ink}" stroke-width="2" stroke-linejoin="round"/>`;
}

function portraitRabbit(p) {
  return `
    <ellipse cx="37" cy="24" rx="8" ry="23" fill="${p.body}" stroke="${p.ink}" stroke-width="4" transform="rotate(-10 37 24)"/>
    <ellipse cx="63" cy="24" rx="8" ry="23" fill="${p.body}" stroke="${p.ink}" stroke-width="4" transform="rotate(10 63 24)"/>
    <ellipse cx="37" cy="24" rx="3.6" ry="15" fill="#ffb6c1" transform="rotate(-10 37 24)"/>
    <ellipse cx="63" cy="24" rx="3.6" ry="15" fill="#ffb6c1" transform="rotate(10 63 24)"/>
    <circle cx="50" cy="61" r="30" fill="${p.body}" stroke="${p.ink}" stroke-width="4"/>
    <circle cx="39" cy="55" r="4.6" fill="${p.ink}"/>
    <circle cx="61" cy="55" r="4.6" fill="${p.ink}"/>
    <circle cx="37.5" cy="53.5" r="1.5" fill="#fff"/>
    <circle cx="59.5" cy="53.5" r="1.5" fill="#fff"/>
    <path d="M50 64 l-4.5 4.5 h9 Z" fill="#ffb6c1" stroke="${p.ink}" stroke-width="2.5" stroke-linejoin="round"/>
    <rect x="45.5" y="73" width="9" height="8" rx="2" fill="#ffffff" stroke="${p.ink}" stroke-width="2"/>
    <line x1="50" y1="73" x2="50" y2="81" stroke="${p.ink}" stroke-width="1.6"/>`;
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
};

export function characterPortrait(species, colors) {
  const p = {
    body: colorCss(colors && colors.body),
    accent: colorCss(colors && colors.accent),
    kart: colorCss(colors && colors.kart),
    ink: 'rgba(18,22,40,0.9)',
  };
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
// Miniaturas de circuito (160x100)
// ---------------------------------------------------------------------------

function ringPath(d, color) {
  return `
    <rect width="160" height="100" fill="rgba(8,12,26,0.35)"/>
    <path d="${d}" fill="${color}" stroke="#ffffff" stroke-width="9" stroke-linejoin="round"/>
    <path d="${d}" fill="none" stroke="rgba(20,26,50,0.7)" stroke-width="2.6" stroke-dasharray="7 8"/>
    <path d="${d}" fill="none" stroke="rgba(255,210,63,0.9)" stroke-width="1.4" stroke-dasharray="3 9"/>`;
}

function thumbMeadow(color) {
  return ringPath('M44 16 H116 A26 26 0 0 1 116 84 H44 A26 26 0 0 1 44 16 Z', color);
}

function thumbDesert(color) {
  return ringPath('M28 22 H132 A24 28 0 0 1 132 78 H60 A24 28 0 0 1 60 22 Z', color);
}

function thumbSnow(color) {
  return ringPath('M80 14 L144 80 H16 Z', color);
}

const THUMBS = { meadow: thumbMeadow, desert: thumbDesert, snow: thumbSnow };

export function trackThumb(id, previewColor) {
  const color = colorCss(previewColor);
  const inner = (THUMBS[id] || thumbMeadow)(color);
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
