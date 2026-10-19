// BLOQUE TÁCTIL — verificación final (maquetación 844x390 + teclado vs táctil).
// Uso: BASE=http://localhost:4250 node scripts/touch-final.mjs
// 1) contexto móvil: carrera con controles → shots/touch-final.png + solapes.
// 2) contexto escritorio con hasTouch: AUTO apagado, keydown oculta controles y
//    el kart no acelera solo; un toque los restaura.
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE || 'http://localhost:4250';
const SHOTS = path.join(ROOT, 'shots');
await mkdir(SHOTS, { recursive: true });

const { chromium } = await import('playwright');
const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const errors = [];
const out = { checks: {} };

async function open(ctx, q = '') {
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto(`${BASE}/?autotest=1&track=meadow&q=low${q}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game && window.__game.state === 'race', null, { timeout: 60000 });
  return page;
}

// ---------- 1) móvil ----------
{
  const ctx = await browser.newContext({
    viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1,
  });
  const page = await open(ctx);
  await page.evaluate(() => window.__game.simulate(4));
  await page.waitForTimeout(500);
  const info = await page.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
    const rects = {
      pause: r('.tc-pause'), object: r('.tc-object'), drift: r('.tc-drift'), brake: r('.tc-brake'), auto: r('.tc-auto'),
      clock: r('.hud-clock'), lap: r('.hud-lap'), item: r('.hud-item-slot'), speedo: r('.hud-speedo'),
      minimap: r('.hud-minimap-wrap'), place: r('.hud-place'), right: r('.hud-right'),
    };
    return { rects, mq: [matchMedia('(pointer: coarse)').matches, matchMedia('(hover: hover)').matches] };
  });
  out.mobile = info;
  const ov = (a, b) => a && b && a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
  const R = info.rects;
  const pairs = [['pause','clock'],['pause','lap'],['pause','item'],['pause','speedo'],['pause','minimap'],['pause','place'],
    ['object','place'],['object','minimap'],['object','right'],['drift','place'],['brake','place']];
  out.overlaps = pairs.filter(([a, b]) => ov(R[a], R[b])).map((p) => p.join('/'));
  // separación vertical objeto - posición
  out.gap_object_place = R.object && R.place ? R.object.t - R.place.b : null;
  const t = await page.evaluate(() => window.__game && window.__game.player && window.__game.player.controls);
  out.mobile_controls_throttle_sample = t ? t.throttle : null;
  await page.screenshot({ path: path.join(SHOTS, 'touch-final.png'), timeout: 150000 });

  // Instancia extra (la del juego no está expuesta): mismo código, mismo estado.
  const kb = await page.evaluate(async () => {
    const mod = await import('/src/touch/index.js');
    const tc = mod.createTouchControls(document.body);
    tc.show();
    const a = { auto: tc.autoThrottle, throttle: tc.state.throttle };
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp', key: 'ArrowUp', bubbles: true }));
    const b = { suppressed: tc.suppressed, throttle: tc.state.throttle, hidden: tc.element.classList.contains('hidden') };
    window.__tcm = tc;
    return { a, b };
  });
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(200);
  await page.touchscreen.tap(400, 200);
  await page.waitForTimeout(200);
  kb.c = await page.evaluate(() => ({ suppressed: window.__tcm.suppressed, throttle: window.__tcm.state.throttle, hidden: window.__tcm.element.classList.contains('hidden') }));
  out.mobile_kb = kb;
  await ctx.close();
}

// ---------- 2) escritorio con pantalla táctil ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, hasTouch: true });
  // Un portátil táctil real reporta (pointer: fine) y (hover: hover) aunque tenga
  // pantalla táctil; Chromium+hasTouch emulado reporta coarse, así que se imita.
  await ctx.addInitScript(() => {
    const orig = window.matchMedia.bind(window);
    window.matchMedia = (q) => {
      const m = orig(q);
      const fake = /\(pointer:\s*coarse\)/.test(q) ? false : /\(hover:\s*hover\)/.test(q) ? true : /\(pointer:\s*fine\)/.test(q) ? true : null;
      if (fake === null) return m;
      return new Proxy(m, { get: (t, k) => (k === 'matches' ? fake : typeof t[k] === 'function' ? t[k].bind(t) : t[k]) });
    };
  });
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  // sin autotest: la IA no controla al jugador; se lleva a carrera con simulate.
  await page.goto(`${BASE}/?autotest=1&track=meadow&q=low`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game && window.__game.state === 'race', null, { timeout: 60000 });
  out.desktop = {};
  out.desktop.mq = await page.evaluate(() => [matchMedia('(pointer: coarse)').matches, matchMedia('(hover: hover)').matches, navigator.maxTouchPoints]);
  const probe = () => page.evaluate(() => {
    const el = document.querySelector('.tc-root');
    const cs = getComputedStyle(el);
    return {
      cls: el.className, visibility: cs.visibility, opacity: cs.opacity,
      auto: document.querySelector('.tc-auto').classList.contains('on'),
    };
  });
  out.desktop.before = await probe();
  out.desktop.instance = await page.evaluate(async () => {
    const mod = await import('/src/touch/index.js');
    const tc = mod.createTouchControls(document.body);
    tc.show();
    window.__tcd = tc;
    return { auto: tc.autoThrottle, throttle: tc.state.throttle, enabled: tc.enabled };
  });
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(400);
  out.desktop.afterKey = await probe();
  await page.keyboard.up('ArrowUp');
  await page.waitForTimeout(300);
  out.desktop.afterRelease = await probe();
  out.desktop.instanceAfterKey = await page.evaluate(() => ({ suppressed: window.__tcd.suppressed, throttle: window.__tcd.state.throttle, hidden: window.__tcd.element.classList.contains('hidden') }));
  await page.touchscreen.tap(600, 300);
  await page.waitForTimeout(200);
  out.desktop.afterTap = await probe();
  out.desktop.instanceAfterTap = await page.evaluate(() => ({ suppressed: window.__tcd.suppressed, throttle: window.__tcd.state.throttle }));
  await page.screenshot({ path: path.join(SHOTS, 'touch-final-desktop.png'), timeout: 150000 });
  await ctx.close();
}
await browser.close();
out.errors = errors;
console.log(JSON.stringify(out, null, 1));
