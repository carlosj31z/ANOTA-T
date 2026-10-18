// BLOQUE TÁCTIL — verificación propia (CONTRATO §10.3).
//
// Levanta Vite en el puerto 4206, abre el juego en un contexto móvil real
// (hasTouch + isMobile, 844×390 horizontal), importa `src/touch/index.js`
// dentro de la página, monta los controles sobre document.body y comprueba con
// PointerEvents multitáctiles (pointerType 'touch') que el estado responde:
// steer, drift, brake, throttle automático, flanco de objeto y de pausa.
// Captura shots/touch-overlay.png.

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
// Puerto propio. 4206 quedó ocupado por el server de otro bloque en esta ronda,
// así que se usa 4237 (verificado libre) para no chocar entre agentes.
const PORT = 4237;
const BASE = `http://localhost:${PORT}`;
const SHOTS = path.join(ROOT, 'shots');
const W = 844;
const H = 390;

async function waitForServer(url, timeoutMs = 40000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status === 200) return;
    } catch {
      /* aún no está */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('El dev server táctil no respondió a tiempo');
}

async function main() {
  await mkdir(SHOTS, { recursive: true });

  const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT,
    stdio: 'ignore',
    detached: true,
  });
  const cleanup = () => {
    try {
      process.kill(-server.pid, 'SIGTERM');
    } catch {
      try {
        server.kill('SIGTERM');
      } catch {
        /* ignore */
      }
    }
  };
  process.on('exit', cleanup);

  let browser = null;
  const checks = {};
  const consoleErrors = [];

  try {
    await waitForServer(BASE);
    const { chromium } = await import('playwright');
    browser = await chromium.launch({
      args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    });

    const context = await browser.newContext({
      viewport: { width: W, height: H },
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) =>
      consoleErrors.push('pageerror: ' + (err && err.message ? err.message : String(err)))
    );

    await page.goto(`${BASE}/?autotest=1&track=meadow`, { waitUntil: 'load' });

    // Espera (con tolerancia) a la carrera para que el HUD esté montado.
    try {
      await page.waitForFunction(() => window.__game && window.__game.state === 'race', null, {
        timeout: 25000,
      });
    } catch {
      consoleErrors.push('aviso: el autotest no llegó a "race"; se continúa');
    }

    // Oculta el canvas WebGL: la captura queda sobre negro + HUD y no depende
    // del readback de SwiftShader (que puede atascarse con el juego detrás).
    await page.evaluate(() => {
      const c = document.getElementById('game-canvas');
      if (c) c.style.visibility = 'hidden';

      // Utilidad de despacho de PointerEvents táctiles.
      window.__pt = (el, type, id, dx = 0, dy = 0) => {
        const r = el.getBoundingClientRect();
        const ev = new PointerEvent(type, {
          pointerId: id,
          pointerType: 'touch',
          isPrimary: id === 1,
          clientX: r.left + r.width / 2 + dx,
          clientY: r.top + r.height / 2 + dy,
          bubbles: true,
          cancelable: true,
          buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
        });
        el.dispatchEvent(ev);
      };
    });

    const setup = await page.evaluate(async () => {
      const mod = await import('/src/touch/index.js');
      const tc = mod.createTouchControls(document.body);
      window.__tc = tc;
      tc.show();
      return {
        enabled: tc.enabled,
        api:
          typeof tc.consumeUseItem === 'function' &&
          typeof tc.consumePause === 'function' &&
          typeof tc.show === 'function' &&
          typeof tc.hide === 'function' &&
          typeof tc.dispose === 'function',
        throttle: tc.state.throttle,
        hud: !!document.querySelector('.hud'),
      };
    });
    checks.enabled = setup.enabled === true;
    checks.api = setup.api === true;
    checks.hud_presente = setup.hud === true;
    checks.auto_throttle_inicial = setup.throttle === 1;

    // --- volante + derrape simultáneos (multitáctil) ---
    const multitouch = await page.evaluate(() => {
      const tc = window.__tc;
      const pad = document.querySelector('.tc-pad');
      const drift = document.querySelector('.tc-drift');
      window.__pt(pad, 'pointerdown', 11, 0, 0);
      window.__pt(pad, 'pointermove', 11, 70, 0);
      window.__pt(drift, 'pointerdown', 12, 0, 0);
      return { steer: tc.state.steer, drift: tc.state.drift };
    });
    checks.steer_derecha = multitouch.steer > 0.3;
    checks.derrape_multitouch = multitouch.drift === true;

    const steerLeft = await page.evaluate(() => {
      const pad = document.querySelector('.tc-pad');
      const tc = window.__tc;
      window.__pt(pad, 'pointermove', 11, -140, 0);
      return tc.state.steer;
    });
    checks.steer_izquierda = steerLeft < -0.3;

    const steerRelease = await page.evaluate(() => {
      const pad = document.querySelector('.tc-pad');
      const tc = window.__tc;
      window.__pt(pad, 'pointerup', 11, 0, 0);
      window.__pt(document.querySelector('.tc-drift'), 'pointerup', 12, 0, 0);
      return { steer: tc.state.steer, drift: tc.state.drift };
    });
    checks.steer_neutro_al_soltar = steerRelease.steer === 0;
    checks.derrape_neutro_al_soltar = steerRelease.drift === false;

    // --- freno ---
    const brake = await page.evaluate(() => {
      const tc = window.__tc;
      const brake = document.querySelector('.tc-brake');
      window.__pt(brake, 'pointerdown', 13, 0, 0);
      const held = { brake: tc.state.brake, throttle: tc.state.throttle };
      window.__pt(brake, 'pointerup', 13, 0, 0);
      return { held, released: tc.state.brake };
    });
    checks.freno_activo = brake.held.brake === 1 && brake.held.throttle === 0;
    checks.freno_suelto = brake.released === 0;

    // --- objeto (flanco) ---
    const object = await page.evaluate(() => {
      const tc = window.__tc;
      const obj = document.querySelector('.tc-object');
      window.__pt(obj, 'pointerdown', 14, 0, 0);
      window.__pt(obj, 'pointerup', 14, 0, 0);
      return { first: tc.consumeUseItem(), second: tc.consumeUseItem() };
    });
    checks.objeto_flanco = object.first === true && object.second === false;

    // --- pausa (flanco) ---
    const pause = await page.evaluate(() => {
      const tc = window.__tc;
      const btn = document.querySelector('.tc-pause');
      window.__pt(btn, 'pointerdown', 15, 0, 0);
      window.__pt(btn, 'pointerup', 15, 0, 0);
      return { first: tc.consumePause(), second: tc.consumePause() };
    });
    checks.pausa_flanco = pause.first === true && pause.second === false;

    // --- AUTO off + GAS ---
    const autoOff = await page.evaluate(() => {
      const tc = window.__tc;
      const auto = document.querySelector('.tc-auto');
      window.__pt(auto, 'pointerdown', 16, 0, 0);
      window.__pt(auto, 'pointerup', 16, 0, 0);
      const offState = {
        auto: tc.autoThrottle,
        throttle: tc.state.throttle,
        accelVisible: document.querySelector('.tc-accel').classList.contains('hidden') === false,
      };
      const gas = document.querySelector('.tc-accel');
      window.__pt(gas, 'pointerdown', 17, 0, 0);
      const gasHeld = tc.state.throttle;
      window.__pt(gas, 'pointerup', 17, 0, 0);
      return { offState, gasHeld, afterRelease: tc.state.throttle };
    });
    checks.auto_off = autoOff.offState.auto === false && autoOff.offState.throttle === 0;
    checks.gas_aparece = autoOff.offState.accelVisible === true;
    checks.gas_acelera = autoOff.gasHeld === 1 && autoOff.afterRelease === 0;

    // Restaura AUTO y deja el volante y el derrape activos para la captura.
    await page.evaluate(() => {
      const tc = window.__tc;
      const auto = document.querySelector('.tc-auto');
      window.__pt(auto, 'pointerdown', 18, 0, 0);
      window.__pt(auto, 'pointerup', 18, 0, 0);
      const pad = document.querySelector('.tc-pad');
      window.__pt(pad, 'pointerdown', 21, -20, 10);
      window.__pt(pad, 'pointermove', 21, 40, 0);
      window.__pt(document.querySelector('.tc-drift'), 'pointerdown', 22, 0, 0);
      window.__pt(document.querySelector('.tc-brake'), 'pointerdown', 23, 0, 0);
    });
    await page.waitForTimeout(250);

    await page.screenshot({ path: path.join(SHOTS, 'touch-overlay.png') });

    // hide() debe neutralizar el estado y no dejar el overlay en pantalla.
    const hidden = await page.evaluate(() => {
      const tc = window.__tc;
      tc.hide();
      const root = document.querySelector('.tc-root');
      return {
        steer: tc.state.steer,
        brake: tc.state.brake,
        drift: tc.state.drift,
        hiddenClass: root.classList.contains('hidden'),
      };
    });
    checks.hide_neutraliza =
      hidden.steer === 0 && hidden.brake === 0 && hidden.drift === false && hidden.hiddenClass === true;

    // El ratón en PC no debe activar nada (pointerType 'mouse').
    const mouseIgnored = await page.evaluate(() => {
      const tc = window.__tc;
      tc.show();
      const pad = document.querySelector('.tc-pad');
      pad.dispatchEvent(
        new PointerEvent('pointerdown', {
          pointerId: 99,
          pointerType: 'mouse',
          clientX: 100,
          clientY: 200,
          bubbles: true,
        })
      );
      return tc.state.steer;
    });
    checks.raton_ignorado = mouseIgnored === 0;

    // --- modo "buttons": flechas grandes ---
    const buttonsMode = await page.evaluate(async () => {
      const mod = await import('/src/touch/index.js');
      const tc = mod.createTouchControls(document.body, { mode: 'buttons' });
      tc.show();
      const arrows = document.querySelector('.tc-root.mode-buttons .tc-arrows');
      const display = arrows ? getComputedStyle(arrows).display : 'none';
      const right = document.querySelector('.tc-root.mode-buttons .tc-arrow-right');
      window.__pt(right, 'pointerdown', 41, 0, 0);
      const steerRight = tc.state.steer;
      window.__pt(right, 'pointerup', 41, 0, 0);
      const steerReleased = tc.state.steer;
      tc.dispose();
      return { display, steerRight, steerReleased };
    });
    checks.modo_botones =
      buttonsMode.display === 'flex' &&
      buttonsMode.steerRight === 1 &&
      buttonsMode.steerReleased === 0;

    // --- Segunda pasada: pantalla horizontal ancha (1600×720) ---
    await page.close();
    const wide = await context.newPage();
    await wide.setViewportSize({ width: 1600, height: 720 });
    await wide.goto(`${BASE}/?autotest=1&track=meadow`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    try {
      await wide.waitForFunction(() => window.__game && window.__game.state === 'race', null, {
        timeout: 20000,
      });
    } catch {
      /* se continúa igualmente */
    }
    const wideShot = await wide.evaluate(async () => {
      const c = document.getElementById('game-canvas');
      if (c) c.style.visibility = 'hidden';
      const mod = await import('/src/touch/index.js');
      const tc = mod.createTouchControls(document.body);
      window.__tc = tc;
      tc.show();
      const pad = document.querySelector('.tc-pad');
      const pt = (el, type, id, dx = 0, dy = 0) => {
        const r = el.getBoundingClientRect();
        el.dispatchEvent(
          new PointerEvent(type, {
            pointerId: id,
            pointerType: 'touch',
            clientX: r.left + r.width / 2 + dx,
            clientY: r.top + r.height / 2 + dy,
            bubbles: true,
            cancelable: true,
            buttons: type === 'pointerup' ? 0 : 1,
          })
        );
      };
      pt(pad, 'pointerdown', 31, -30, 10);
      pt(pad, 'pointermove', 31, 55, 0);
      pt(document.querySelector('.tc-drift'), 'pointerdown', 32, 0, 0);
      const rect = (s) => {
        const b = document.querySelector(s).getBoundingClientRect();
        return { l: b.left, t: b.top, r: b.right, b: b.bottom };
      };
      const overlap = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
      const acts = rect('.tc-actions');
      const mm = document.querySelector('.hud-minimap-wrap') ? rect('.hud-minimap-wrap') : null;
      const overlapMinimap = mm ? overlap(acts, mm) : false;

      // Fuerza el HUD al layout de escritorio (minimapa abajo-derecha) y
      // comprueba que el bloque de acciones se aparta solo.
      const hudRight = document.querySelector('.hud-right');
      const speedo = document.querySelector('.hud-speedo');
      if (hudRight) {
        hudRight.style.top = 'auto';
        hudRight.style.bottom = '16px';
        hudRight.style.right = '16px';
      }
      if (speedo) {
        speedo.style.top = 'auto';
        speedo.style.bottom = '16px';
        speedo.style.left = '16px';
      }
      tc.show(); // recalcula --tc-reserve
      const reserve = getComputedStyle(document.querySelector('.tc-root'))
        .getPropertyValue('--tc-reserve')
        .trim();
      const acts2 = rect('.tc-actions');
      const mm2 = document.querySelector('.hud-minimap-wrap') ? rect('.hud-minimap-wrap') : null;
      const overlapDesktop = mm2 ? overlap(acts2, mm2) : false;

      return { overlapMinimap, overlapDesktop, reserve, enabled: tc.enabled };
    });
    await wide.waitForTimeout(250);
    await wide.screenshot({ path: path.join(SHOTS, 'touch-overlay-wide.png') });
    checks.wide_sin_solape_minimapa = wideShot.overlapMinimap === false;
    checks.desktop_reserva_minimapa = wideShot.overlapDesktop === false;
    checks.wide_enabled = wideShot.enabled === true;
    await wide.close();

    const allOk = Object.values(checks).every(Boolean);
    const report = {
      ok: allOk && consoleErrors.length === 0,
      checks,
      consoleErrors,
      shots: ['shots/touch-overlay.png', 'shots/touch-overlay-wide.png'],
    };
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    process.exit(report.ok ? 0 : 1);
  } catch (err) {
    process.stderr.write(
      'touch-check falló: ' + (err && err.stack ? err.stack : String(err)) + '\n'
    );
    process.exit(1);
  } finally {
    if (browser) await browser.close();
    cleanup();
  }
}

main();
