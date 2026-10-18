// BLOQUE 0 — CORE: verificación de la integración (tanda 4).
//
// Usa un dev server ya levantado (por defecto http://localhost:4240; cambiar con
// CORE_BASE) y comprueba con Chromium headless + SwiftShader:
//   1. Calidad: `?q=low|high|ultra` en los 3 circuitos cargan sin errores y
//      reporta el desglose de draw calls (escena, sombras, pases, total).
//   2. Perks de core: `salida` (Luna: BOOST en los primeros 0.2 s), `empujon`
//      (Bruno: desplazamiento asimétrico) y `torbellino` (Zuri: HIT a rivales).
//   3. Rivales: 7 distintos, sin el jugador, reproducibles con semilla.
//   4. Móvil (isMobile + hasTouch, 844×390): controles táctiles visibles en
//      carrera y ocultos en menús / pausa.
// Capturas: shots/core-q-high.png y shots/core-mobile.png.
//
// Uso: node scripts/core-check.mjs   (imprime un JSON; exit 1 si algo falla)

import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SHOTS = path.join(ROOT, 'shots');
const BASE = process.env.CORE_BASE || 'http://localhost:4240';
const TRACKS = ['meadow', 'desert', 'snow'];
const QUALITIES = ['low', 'high', 'ultra'];
const ONLY = process.env.CORE_ONLY ? process.env.CORE_ONLY.split(',') : null;

const results = {};
const failures = [];

function check(name, ok, detail) {
  if (!ok) failures.push(`${name}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
}

async function openRace(browser, query, ctxOpts) {
  const context = await browser.newContext(ctxOpts || { viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push('pageerror: ' + (e && e.message)));
  await page.goto(`${BASE}/?${query}`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__game && window.__game.state === 'race', null, {
    timeout: 60000,
  });
  return { context, page, errors };
}

// Espera a que se pinte al menos un frame más (rAF) para que `drawCalls` sea real.
async function nextFrames(page, n = 2) {
  await page.evaluate(
    (k) =>
      new Promise((resolve) => {
        let left = k;
        const tick = () => (--left <= 0 ? resolve() : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
      }),
    n
  );
}

async function qualityMatrix(browser) {
  const out = [];
  for (const track of TRACKS) {
    for (const q of QUALITIES) {
      const { context, page, errors } = await openRace(browser, `autotest=1&track=${track}&q=${q}`);
      await nextFrames(page, 2);
      const start = await page.evaluate(() => ({
        quality: window.__game.quality,
        lastFrame: window.__game.drawCalls,
        breakdown: window.__game.measureDrawCalls(),
      }));
      await page.evaluate(() => window.__game.simulate(40));
      await nextFrames(page, 2);
      const mid = await page.evaluate(() => ({
        lastFrame: window.__game.drawCalls,
        breakdown: window.__game.measureDrawCalls(),
      }));
      if (track === 'meadow' && q === 'high') {
        await mkdir(SHOTS, { recursive: true });
        await page.screenshot({ path: path.join(SHOTS, 'core-q-high.png'), timeout: 180000 });
      }
      await context.close();
      const row = {
        track,
        quality: start.quality,
        start: { lastFrame: start.lastFrame, ...start.breakdown },
        t40: { lastFrame: mid.lastFrame, ...mid.breakdown },
        errors,
      };
      out.push(row);
      process.stderr.write(`[calidad] ${track}/${q} total=${row.start.total} t40=${row.t40.total}\n`);
      check(`calidad ${track}/${q} carga`, start.quality === q, row.quality);
      check(`calidad ${track}/${q} sin errores`, errors.length === 0, errors);
    }
  }
  return out;
}

async function perkSalida(browser) {
  const { context, page, errors } = await openRace(browser, 'autotest=1&track=meadow&char=luna');
  const r = await page.evaluate(() => {
    const g = window.__game;
    const boostAt0 = g.player.state.boostTime;
    g.simulate(0.2);
    return {
      player: g.player.character.id,
      boostTimeAtStart: boostAt0,
      boostTimeAt02: g.player.state.boostTime,
      firstPlayerPadBoostAt: g.eventFirst['kart:boost:pad@player'],
      perkSalida: g.eventCounts['kart:perk:salida'] || 0,
      perkSalidaPlayer: g.eventCounts['kart:perk:salida@player'] || 0,
    };
  });
  await context.close();
  r.errors = errors;
  check('salida: BOOST del jugador en <= 0.2 s', r.firstPlayerPadBoostAt != null && r.firstPlayerPadBoostAt <= 0.2, r);
  check('salida: evento kart:perk', r.perkSalidaPlayer >= 1, r);
  check('salida: sin errores', errors.length === 0, errors);
  return r;
}

// Choque forzado: un rival se superpone delante del jugador; se mide cuánto se
// mueve cada uno en el paso de colisión.
async function forcedContact(page, { boostPlayer }) {
  return page.evaluate((boost) => {
    const g = window.__game;
    const p = g.player;
    const other = g.karts.find((k) => k !== p && k.character.perk.id !== 'empujon');
    const fx = Math.sin(p.heading);
    const fz = Math.cos(p.heading);
    // El rival justo delante, solapando ~0.8 m, ambos quietos.
    const gap = p.radius + other.radius - 0.8;
    const pos = p.position.clone();
    pos.x += fx * gap;
    pos.z += fz * gap;
    other.setTransform(pos, p.heading);
    p.speed = 0;
    other.speed = 0;
    p.velocity.set(0, 0, 0);
    other.velocity.set(0, 0, 0);
    if (boost) p.applyBoost(2, 1, 'item');
    other.state.shieldTime = 0;
    const p0 = p.position.clone();
    const o0 = other.position.clone();
    const hitsBefore = g.eventCounts['kart:hit:torbellino'] || 0;
    // Congelar al resto de karts no hace falta: un solo paso.
    g.simulate(1 / 60);
    return {
      player: p.character.id,
      other: other.character.id,
      playerMoved: Math.hypot(p.position.x - p0.x, p.position.z - p0.z),
      otherMoved: Math.hypot(other.position.x - o0.x, other.position.z - o0.z),
      torbellinoHits: (g.eventCounts['kart:hit:torbellino'] || 0) - hitsBefore,
      otherSpin: other.state.spinTime,
    };
  }, boostPlayer);
}

async function perkContact(browser, char) {
  const { context, page, errors } = await openRace(browser, `autotest=1&track=desert&char=${char}`);
  // Avanza para separar la parrilla y que no haya otros solapes.
  await page.evaluate(() => window.__game.simulate(8));
  const forced = await forcedContact(page, { boostPlayer: char === 'zuri' });
  // Carrera completa: cuenta eventos reales.
  const race = await page.evaluate(async () => {
    const g = window.__game;
    let sim = 0;
    while (!g.finishedAll && sim < 360) {
      g.simulate(10);
      sim += 10;
      await new Promise((r) => setTimeout(r, 0));
    }
    const c = g.eventCounts;
    return {
      finishedAll: g.finishedAll,
      raceTime: g.raceTime,
      bumps: c['kart:bump'] || 0,
      perkEvents: c['kart:perk'] || 0,
      perkEmpujon: c['kart:perk:empujon'] || 0,
      perkTorbellino: c['kart:perk:torbellino'] || 0,
      hitTorbellino: c['kart:hit:torbellino'] || 0,
      perksCounter: g.perks,
    };
  });
  await context.close();
  return { char, forced, race, errors };
}

async function rivals(browser) {
  const ids = async (q) => {
    const { context, page, errors } = await openRace(browser, q);
    const r = await page.evaluate(() => window.__game.karts.map((k) => k.character.id));
    await context.close();
    return { ids: r, errors };
  };
  const a = await ids('autotest=1&track=meadow&char=max');
  const b = await ids('autotest=1&track=meadow&char=max');
  const c = await ids('autotest=1&track=meadow&char=max&seed=42');
  const cpu = a.ids.slice(1);
  const r = {
    defaultSeed: a.ids,
    repeat: b.ids,
    seed42: c.ids,
    errors: [...a.errors, ...b.errors, ...c.errors],
  };
  check('rivales: 8 karts', a.ids.length === 8, a.ids);
  check('rivales: jugador = max', a.ids[0] === 'max', a.ids);
  check('rivales: 7 distintos y sin el jugador', new Set(cpu).size === 7 && !cpu.includes('max'), cpu);
  check('rivales: reproducibles', JSON.stringify(a.ids) === JSON.stringify(b.ids), r);
  return r;
}

async function mobile(browser) {
  const ctxOpts = {
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  };
  const context = await browser.newContext(ctxOpts);
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push('pageerror: ' + (e && e.message)));
  const tc = () =>
    page.evaluate(() => {
      const el = document.querySelector('.tc-root');
      if (!el) return { exists: false };
      const cs = getComputedStyle(el);
      return {
        exists: true,
        hidden: el.classList.contains('hidden'),
        display: cs.display,
        visibility: cs.visibility,
      };
    });
  const isShown = (s) => s.exists && !s.hidden && s.display !== 'none' && s.visibility !== 'hidden';

  // Flujo real de menús con teclado: título → personaje → circuito → intro.
  await page.goto(`${BASE}/`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForSelector('.start-prompt', { timeout: 60000 });
  const pixelRatio = await page.evaluate(() => {
    const c = document.getElementById('game-canvas');
    return c.width / c.clientWidth;
  });
  const qualityLabel = await page.evaluate(() => document.querySelector('.quality-btn')?.textContent);
  const title = await tc();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  const charSel = await tc();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  const trackSel = await tc();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  const intro = await tc();
  // Espera a la carrera (intro 3 s + cuenta atrás 3 s; headless va lento).
  let race = null;
  // En carrera el cronómetro del HUD avanza (headless: ~MAX_FRAME_DT por frame).
  let raceStarted = false;
  for (let i = 0; i < 150; i++) {
    await page.waitForTimeout(1000);
    raceStarted = await page.evaluate(() => {
      const t = document.body.innerText || '';
      return /\d\d:\d\d\.\d\d/.test(t) && !/00:00\.00/.test(t);
    });
    if (raceStarted) break;
  }
  race = await tc();
  await mkdir(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, 'core-mobile.png'), timeout: 180000 });
  // Pausa con el botón táctil.
  const pauseBtn = await page.$('.tc-pause');
  let paused = null;
  let pauseMenu = null;
  const gameState = await page.evaluate(() => {
    const hud = document.querySelector('.hud');
    return { hud: !!hud, text: (document.body.innerText || '').slice(0, 120) };
  });
  if (pauseBtn) {
    const box = await pauseBtn.boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(500);
      paused = await tc();
      if (paused.hidden) break;
    }
    pauseMenu = await page.evaluate(() => /pausa/i.test(document.body.innerText));
  }
  await context.close();

  const r = { pixelRatio, qualityLabel, raceStarted, gameState, title, charSel, trackSel, intro, race, paused, pauseMenu, errors };
  check('móvil: oculto en título', title.exists && !isShown(title), title);
  check('móvil: oculto en selección', !isShown(charSel) && !isShown(trackSel), { charSel, trackSel });
  check('móvil: visible en intro/carrera', raceStarted && isShown(intro) && isShown(race), { raceStarted, intro, race });
  check('móvil: oculto en pausa', paused && !isShown(paused), paused);
  check('móvil: pixelRatio <= 1.5', pixelRatio <= 1.51, pixelRatio);
  check('móvil: sin errores', errors.length === 0, errors);
  return r;
}

async function main() {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const want = (k) => !ONLY || ONLY.includes(k);
  try {
    if (want('quality')) results.quality = await qualityMatrix(browser);
    if (want('salida')) results.salida = await perkSalida(browser);
    if (want('bruno')) {
      const r = await perkContact(browser, 'bruno');
      results.bruno = r;
      check('empujon: el rival se mueve más que Bruno', r.forced.otherMoved > r.forced.playerMoved * 3, r.forced);
      check('empujon: eventos kart:perk', r.race.perkEmpujon > 0, r.race);
      check('bruno: carrera termina', r.race.finishedAll, r.race);
      check('bruno: sin errores', r.errors.length === 0, r.errors);
    }
    if (want('zuri')) {
      const r = await perkContact(browser, 'zuri');
      results.zuri = r;
      check('torbellino: choque con turbo → HIT', r.forced.torbellinoHits === 1 && r.forced.otherSpin > 0, r.forced);
      check('zuri: carrera termina', r.race.finishedAll, r.race);
      check('zuri: sin errores', r.errors.length === 0, r.errors);
    }
    if (want('rivals')) results.rivals = await rivals(browser);
    if (want('mobile')) results.mobile = await mobile(browser);
  } finally {
    await browser.close();
  }
  results.failures = failures;
  process.stdout.write(JSON.stringify(results, null, 2) + '\n');
  process.exit(failures.length ? 1 : 0);
}

main().catch((err) => {
  process.stderr.write('core-check falló: ' + (err && err.stack ? err.stack : String(err)) + '\n');
  process.exit(1);
});
