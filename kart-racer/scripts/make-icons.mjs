// Genera el icono y el splash de Rally Relámpago de forma 100% procedural.
//
// Dibuja un emblema (rayo amarillo-naranja sobre círculo azul oscuro con
// borde dorado) en SVG y lo rasteriza con el Chromium del sistema vía
// Playwright (sin `playwright install`), a todas las densidades mipmap y a
// los splash de todas las orientaciones, copiando el resultado al proyecto
// nativo de Capacitor.
//
// Uso: node scripts/make-icons.mjs

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

// Chromium del sistema (ya presente en la imagen); evita `playwright install`.
process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RES = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');
const RESOURCES = path.join(ROOT, 'resources');

// Paleta del juego.
const NAVY = '#0e1b3a';
const NAVY_LIGHT = '#2a4fa0';
const YELLOW = '#ffd23f';
const ORANGE = '#ff9a1f';

// Mismo path de rayo en una caja de 100×100 (dibujado centrado en 50,50).
const BOLT = 'M58 4 L30 56 L47 56 L38 96 L72 40 L53 40 Z';

// Densidades Android: densidad -> tamaño de launcher (48dp) y de foreground (108dp).
const DENSITIES = [
  { dir: 'mdpi', launcher: 48, foreground: 108 },
  { dir: 'hdpi', launcher: 72, foreground: 162 },
  { dir: 'xhdpi', launcher: 96, foreground: 216 },
  { dir: 'xxhdpi', launcher: 144, foreground: 324 },
  { dir: 'xxxhdpi', launcher: 192, foreground: 432 },
];

// Splash por orientación (mismas dimensiones que la plantilla de Capacitor).
const SPLASHES = [
  { dir: 'drawable', w: 480, h: 320 },
  { dir: 'drawable-land-mdpi', w: 480, h: 320 },
  { dir: 'drawable-land-hdpi', w: 800, h: 480 },
  { dir: 'drawable-land-xhdpi', w: 1280, h: 720 },
  { dir: 'drawable-land-xxhdpi', w: 1600, h: 960 },
  { dir: 'drawable-land-xxxhdpi', w: 1920, h: 1280 },
  { dir: 'drawable-port-mdpi', w: 320, h: 480 },
  { dir: 'drawable-port-hdpi', w: 480, h: 800 },
  { dir: 'drawable-port-xhdpi', w: 720, h: 1280 },
  { dir: 'drawable-port-xxhdpi', w: 960, h: 1600 },
  { dir: 'drawable-port-xxxhdpi', w: 1280, h: 1920 },
];

function defs(id, scale) {
  // Gradientes reutilizables; `id` evita colisiones de ids entre SVG.
  return `
    <defs>
      <radialGradient id="disc-${id}" cx="38%" cy="30%" r="78%">
        <stop offset="0" stop-color="${NAVY_LIGHT}"/>
        <stop offset="1" stop-color="${NAVY}"/>
      </radialGradient>
      <linearGradient id="bolt-${id}" x1="0" y1="0" x2="0.35" y2="1">
        <stop offset="0" stop-color="#fff2a8"/>
        <stop offset="0.35" stop-color="${YELLOW}"/>
        <stop offset="1" stop-color="${ORANGE}"/>
      </linearGradient>
      <filter id="shadow-${id}" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.45"/>
      </filter>
    </defs>
    <g filter="url(#shadow-${id})">
      <circle cx="50" cy="50" r="46" fill="url(#disc-${id})" stroke="${YELLOW}" stroke-width="4"/>
    </g>
    <g transform="translate(50,50) scale(${scale}) translate(-50,-50)">
      <path d="${BOLT}" fill="url(#bolt-${id})" stroke="${NAVY}" stroke-width="3.2" stroke-linejoin="round"/>
    </g>`;
}

// Icono cuadrado clásico (pre-API 26): fondo a sangre con esquinas redondeadas.
function squareIconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
    <rect width="100" height="100" rx="22" fill="${NAVY}"/>
    ${defs('sq', 0.62)}
  </svg>`;
}

// Icono redondo clásico: círculo que llena el lienzo, esquinas transparentes.
function roundIconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
    <circle cx="50" cy="50" r="50" fill="${NAVY}"/>
    ${defs('rd', 0.62)}
  </svg>`;
}

// Capa foreground del icono adaptativo (108dp). El sistema la recorta a
// ~66dp de zona segura, así que el emblema va más pequeño y sin fondo.
function foregroundSvg() {
  const s = 0.5; // rayo dentro del círculo seguro
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108" width="108" height="108">
    <defs>
      <radialGradient id="disc-fg" cx="38%" cy="30%" r="78%">
        <stop offset="0" stop-color="${NAVY_LIGHT}"/>
        <stop offset="1" stop-color="${NAVY}"/>
      </radialGradient>
      <linearGradient id="bolt-fg" x1="0" y1="0" x2="0.35" y2="1">
        <stop offset="0" stop-color="#fff2a8"/>
        <stop offset="0.35" stop-color="${YELLOW}"/>
        <stop offset="1" stop-color="${ORANGE}"/>
      </linearGradient>
    </defs>
    <circle cx="54" cy="54" r="33" fill="url(#disc-fg)" stroke="${YELLOW}" stroke-width="3"/>
    <g transform="translate(54,54) scale(${s}) translate(-50,-50)">
      <path d="${BOLT}" fill="url(#bolt-fg)" stroke="${NAVY}" stroke-width="3.2" stroke-linejoin="round"/>
    </g>
  </svg>`;
}

// Splash a pantalla completa: fondo azul oscuro con degradado, el emblema
// centrado y el nombre del juego debajo.
function splashSvg(w, h) {
  const min = Math.min(w, h);
  const emblem = min * 0.34;
  const titleSize = min * 0.11;
  const subtitleSize = min * 0.045;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
    <defs>
      <radialGradient id="sky" cx="50%" cy="38%" r="75%">
        <stop offset="0" stop-color="#22407f"/>
        <stop offset="1" stop-color="${NAVY}"/>
      </radialGradient>
      <radialGradient id="disc-sp" cx="38%" cy="30%" r="78%">
        <stop offset="0" stop-color="${NAVY_LIGHT}"/>
        <stop offset="1" stop-color="#0a1430"/>
      </radialGradient>
      <linearGradient id="bolt-sp" x1="0" y1="0" x2="0.35" y2="1">
        <stop offset="0" stop-color="#fff2a8"/>
        <stop offset="0.35" stop-color="${YELLOW}"/>
        <stop offset="1" stop-color="${ORANGE}"/>
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#sky)"/>
    <g transform="translate(${w / 2},${h / 2 - min * 0.08})">
      <circle cx="0" cy="0" r="${emblem / 2}" fill="url(#disc-sp)" stroke="${YELLOW}" stroke-width="${emblem * 0.045}"/>
      <g transform="scale(${emblem / 100}) translate(-50,-50)">
        <path d="${BOLT}" fill="url(#bolt-sp)" stroke="${NAVY}" stroke-width="3.2" stroke-linejoin="round"/>
      </g>
    </g>
    <text x="${w / 2}" y="${h / 2 + min * 0.24}" text-anchor="middle"
          font-family="system-ui, 'Segoe UI', sans-serif" font-weight="900"
          font-size="${titleSize}" fill="${YELLOW}" letter-spacing="${titleSize * 0.06}"
          stroke="${NAVY}" stroke-width="${titleSize * 0.03}" paint-order="stroke">RALLY RELÁMPAGO</text>
    <text x="${w / 2}" y="${h / 2 + min * 0.34}" text-anchor="middle"
          font-family="system-ui, 'Segoe UI', sans-serif" font-weight="800"
          font-size="${subtitleSize}" fill="#cfe0ff" letter-spacing="${subtitleSize * 0.35}">CARRERAS DE KARTS</text>
  </svg>`;
}

async function render(page, svg, w, h, outPath) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
       html,body{margin:0;padding:0;background:transparent}
       #art{display:block;width:${w}px;height:${h}px}
     </style></head><body><div id="art">${svg.replace('<svg ', `<svg id="svg-icon" style="display:block;width:${w}px;height:${h}px" `)}</div></body></html>`,
    { waitUntil: 'load' }
  );
  await mkdir(path.dirname(outPath), { recursive: true });
  const el = await page.$('#svg-icon');
  await el.screenshot({ path: outPath, omitBackground: true });
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });

  const squareSvg = squareIconSvg();
  const roundSvg = roundIconSvg();
  const fgSvg = foregroundSvg();

  for (const d of DENSITIES) {
    const base = path.join(RES, `mipmap-${d.dir}`);
    await mkdir(base, { recursive: true });
    await render(page, squareSvg, d.launcher, d.launcher, path.join(base, 'ic_launcher.png'));
    await render(page, roundSvg, d.launcher, d.launcher, path.join(base, 'ic_launcher_round.png'));
    await render(page, fgSvg, d.foreground, d.foreground, path.join(base, 'ic_launcher_foreground.png'));
  }

  for (const s of SPLASHES) {
    await render(page, splashSvg(s.w, s.h), s.w, s.h, path.join(RES, s.dir, 'splash.png'));
  }

  // Maestros de referencia para @capacitor/assets / documentación.
  await mkdir(RESOURCES, { recursive: true });
  await render(page, squareSvg, 1024, 1024, path.join(RESOURCES, 'icon.png'));
  await render(page, splashSvg(2732, 2732), 2732, 2732, path.join(RESOURCES, 'splash.png'));

  await browser.close();

  process.stdout.write(
    JSON.stringify(
      { ok: true, densidad: DENSITIES.length, splashes: SPLASHES.length, salida: 'android/app/src/main/res' },
      null,
      2
    ) + '\n'
  );
}

main().catch((err) => {
  process.stderr.write('make-icons falló: ' + (err && err.stack ? err.stack : String(err)) + '\n');
  process.exit(1);
});
