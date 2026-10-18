// Prueba de sanidad del BLOQUE 4 — OBJETOS (contrato §4.4, SPEC C6/C11).
// Levanta un dev server propio en el puerto 4184 y:
//   A) corre la carrera completa en los 3 circuitos (finishedAll, sin errores);
//   B) ejercita el ItemSystem en vivo (cajas, ruleta, y los 6 objetos) usando
//      `window.__itemsSystem` que expone src/items/index.js en modo autotest.
//
// Uso: node scripts/items-sanity.mjs

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 4184;
const BASE = `http://localhost:${PORT}`;
const TRACK_IDS = ['meadow', 'desert', 'snow'];
const MIN_SIM_SECONDS = 120;
const MAX_SIM_SECONDS = 360;
const ITEM_IDS = ['turbo', 'peel', 'bouncer', 'seeker', 'shield', 'storm'];

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
  throw new Error('El dev server no respondió a tiempo');
}

function wireConsole(page) {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    errors.push('pageerror: ' + (err && err.message ? err.message : String(err)));
  });
  return errors;
}

async function runRace(browser, track) {
  const page = await browser.newPage();
  const errors = wireConsole(page);
  let report = null;
  try {
    await page.goto(`${BASE}/?autotest=1&track=${track}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__game && window.__game.state === 'race', null, {
      timeout: 30000,
    });
    report = await page.evaluate(
      async ({ minSeconds, maxSeconds }) => {
        const g = window.__game;
        let sim = 0;
        while (!g.finishedAll && sim < minSeconds) {
          g.simulate(10);
          sim += 10;
          await new Promise((r) => setTimeout(r, 0));
        }
        const statsAtMin = window.__itemsStats ? JSON.parse(JSON.stringify(window.__itemsStats)) : null;
        while (!g.finishedAll && sim < maxSeconds) {
          g.simulate(10);
          sim += 10;
          await new Promise((r) => setTimeout(r, 0));
        }
        return {
          finishedAll: !!g.finishedAll,
          simulatedSeconds: sim,
          drawCalls: g.drawCalls || 0,
          state: g.state,
          statsAtMin,
          statsFinal: window.__itemsStats ? JSON.parse(JSON.stringify(window.__itemsStats)) : null,
        };
      },
      { minSeconds: MIN_SIM_SECONDS, maxSeconds: MAX_SIM_SECONDS }
    );
  } catch (err) {
    errors.push('race: ' + (err && err.message ? err.message : String(err)));
  } finally {
    await page.close();
  }
  return { track, ok: !!(report && report.finishedAll && errors.length === 0), ...report, errors };
}

async function runHarness(browser, track) {
  const page = await browser.newPage();
  const errors = wireConsole(page);
  let report = null;
  try {
    await page.goto(`${BASE}/?autotest=1&track=${track}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__game && window.__game.state === 'race', null, {
      timeout: 30000,
    });
    report = await page.evaluate(async (ITEM_LIST) => {
      const g = window.__game;
      const sys = window.__itemsSystem;
      if (!sys) return { error: 'window.__itemsSystem no existe' };

      // Poblar posiciones (places) y mapa.
      g.simulate(2);
      const karts = g.karts;
      const places = g.places;
      const ctx = { karts, player: karts[0], places, items: sys, raceTime: g.raceTime };

      // --- Cajas + ruleta ---
      const boxPos = sys.getBoxPositions();
      let firstBoxCollected = false;
      let rollingAfterPick = false;
      let displayAfterPick = null;
      if (boxPos && boxPos.length > 0) {
        const k = karts[1];
        k.position.copy(boxPos[0]);
        g.simulate(1 / 60);
        firstBoxCollected = sys.stats.boxes > 0;
        rollingAfterPick = sys.isRolling(k);
        displayAfterPick = sys.getRouletteDisplay(k);
      }
      for (let i = 1; i < boxPos.length; i++) {
        const k = karts[1 + (i % (karts.length - 1))];
        k.position.copy(boxPos[i]);
        g.simulate(1 / 60);
      }
      const boxesCollected = sys.stats.boxes;

      g.simulate(2.2); // resolver ruletas pendientes
      const gotItems = karts.filter((k) => sys.getHeldItem(k)).length;

      // --- Los 6 objetos vía debugUse ---
      const effects = {};
      const owner = karts[0];
      sys.debugUse(owner, 'turbo', ctx);
      effects.turboBoostTime = owner.state.boostTime;
      sys.debugUse(owner, 'peel', ctx);
      effects.peelHazards = sys.getHazards().length;
      sys.debugUse(owner, 'bouncer', ctx);
      sys.debugUse(owner, 'seeker', ctx);
      sys.debugUse(owner, 'shield', ctx);
      effects.shieldTime = owner.state.shieldTime;

      let last = karts[0];
      let lastPlace = -1;
      for (const k of karts) {
        const p = places.get(k) || 0;
        if (p > lastPlace) {
          lastPlace = p;
          last = k;
        }
      }
      sys.debugUse(last, 'storm', ctx);
      effects.stormHits = karts.filter((k) => k !== last && k.state.spinTime > 0).length;

      g.simulate(1.5);
      effects.exploded = sys.stats.exploded;
      effects.used = JSON.parse(JSON.stringify(sys.stats.used));

      const allSixUsed = ITEM_LIST.every((id) => sys.stats.used[id] > 0);
      return {
        boxCount: boxPos.length,
        firstBoxCollected,
        rollingAfterPick,
        displayAfterPick,
        boxesCollected,
        gotItems,
        effects,
        allSixUsed,
        state: g.state,
      };
    }, ITEM_IDS);
  } catch (err) {
    errors.push('harness: ' + (err && err.message ? err.message : String(err)));
  } finally {
    await page.close();
  }
  return { track, ok: !!(report && !report.error && report.allSixUsed && errors.length === 0), ...report, errors };
}

async function main() {
  const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT,
    stdio: 'ignore',
  });
  const cleanup = () => {
    try {
      server.kill('SIGTERM');
    } catch {
      /* ignore */
    }
  };
  process.on('exit', cleanup);

  let browser = null;
  const races = [];
  let harness = null;
  let failed = false;

  try {
    await waitForServer(BASE);
    const { chromium } = await import('playwright');
    browser = await chromium.launch({
      args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    });

    for (const track of TRACK_IDS) {
      const r = await runRace(browser, track);
      if (!r.ok) failed = true;
      races.push(r);
    }

    harness = await runHarness(browser, 'meadow');
    if (!harness.ok) failed = true;
  } finally {
    if (browser) await browser.close();
    cleanup();
  }

  process.stdout.write(JSON.stringify({ races, harness }, null, 2) + '\n');
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  process.stderr.write('Sanity falló: ' + (err && err.stack ? err.stack : String(err)) + '\n');
  process.exit(1);
});
