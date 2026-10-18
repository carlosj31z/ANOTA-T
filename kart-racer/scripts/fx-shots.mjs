// Prueba del BLOQUE 7 (fx). Contrato §4.7 / SPEC C11, C12 y §10.2.
// Levanta un dev server propio (puerto 4214), abre el autotest del circuito
// "meadow", avanza la simulación dejando renderizar, captura:
//   - shots/fx-race.png    (acción de carrera a media vuelta)
//   - shots/fx-action.png  (primer plano forzado: turbo + derrape nivel 3 + aura)
// Reporta draw calls, partículas vivas y errores de consola.

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 4214;
const BASE = `http://localhost:${PORT}`;
const TRACK = process.argv[2] || 'meadow';
const SHOTS = path.join(ROOT, 'shots');

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
  throw new Error('El dev server de fx no respondió a tiempo');
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });

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
  let result = null;
  let failed = false;

  try {
    await waitForServer(BASE);
    const { chromium } = await import('playwright');
    browser = await chromium.launch({
      args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    });

    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    // Cliente HMR neutralizado (otros agentes editan src/* a la vez y un reload a
    // mitad de la prueba destruiría el contexto). Se sirve un stub que exporta
    // lo que los módulos de Vite importan, en vez de abortar (abortar rompe la
    // carga del grafo de módulos en esta versión de Vite).
    const VITE_CLIENT_STUB = `
const noop = () => {};
export function createHotContext() {
  return { accept: noop, acceptExports: noop, dispose: noop, prune: noop, invalidate: noop, on: noop, off: noop, send: noop, data: {} };
}
export function updateStyle(id, css) {
  let s = document.getElementById(id);
  if (!s) { s = document.createElement('style'); s.id = id; document.head.appendChild(s); }
  s.textContent = css;
}
export function removeStyle(id) {
  const s = document.getElementById(id);
  if (s && s.parentNode) s.parentNode.removeChild(s);
}
`;
    await page.route('**/@vite/client', (route) =>
      route.fulfill({ status: 200, contentType: 'application/javascript', body: VITE_CLIENT_STUB })
    );
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      consoleErrors.push('pageerror: ' + (err && err.message ? err.message : String(err)));
    });

    await page.goto(`${BASE}/?autotest=1&track=${TRACK}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__game && window.__game.state === 'race', null, {
      timeout: 40000,
    });

    // --- Captura 1: carrera en acción -------------------------------------
    const race = await page.evaluate(async () => {
      const g = window.__game;
      g.simulate(20);
      // Acción ligera para que la captura muestre turbo + derrape (sin aura).
      const karts = g.karts || [];
      const player = karts.find((k) => k.isPlayer) || karts[0];
      if (player) {
        player.applyBoost(4, 1.2, 'item');
        player.state.drifting = true;
        player.state.driftDir = 1;
        player.state.driftLevel = 2;
        const t1 = performance.now();
        while ((performance.now() - t1) / 1000 < 3) {
          player.state.drifting = true;
          player.state.driftLevel = 2;
          await new Promise((r) => requestAnimationFrame(r));
        }
      }
      const s = window.__fxStats || null;
      return { drawCalls: g.drawCalls || 0, fx: s ? { alive: s.alive, max: s.max, peak: s.peak } : null };
    });
    await page.screenshot({ path: path.join(SHOTS, 'fx-race.png') });

    // --- Captura 2: primer plano forzado (turbo + derrape + aura) ----------
    const action = await page.evaluate(async () => {
      const g = window.__game;
      const karts = g.karts || [];
      const player = karts.find((k) => k.isPlayer) || karts[0];
      if (!player) return null;
      const force = (k) => {
        k.applyBoost(4, 1.4, 'item');
        k.state.drifting = true;
        k.state.driftDir = 1;
        k.state.driftLevel = 3;
        k.state.aura = true;
      };
      force(player);
      const t0 = performance.now();
      while ((performance.now() - t0) / 1000 < 3) {
        force(player);
        await new Promise((r) => requestAnimationFrame(r));
      }
      const s = window.__fxStats || null;
      return { drawCalls: g.drawCalls || 0, fx: s ? { alive: s.alive, max: s.max, peak: s.peak } : null };
    });
    await page.screenshot({ path: path.join(SHOTS, 'fx-action.png') });

    await page.close();

    const fxOk =
      race.fx && race.fx.alive <= race.fx.max && race.fx.peak <= race.fx.max;
    if (!fxOk || consoleErrors.length > 0) failed = true;
    result = { track: TRACK, race, action, fxOk, consoleErrors };
  } catch (err) {
    failed = true;
    result = { track: TRACK, error: err && err.message ? err.message : String(err) };
  } finally {
    if (browser) await browser.close();
    cleanup();
  }

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  process.stderr.write('fx-shots falló: ' + (err && err.stack ? err.stack : String(err)) + '\n');
  process.exit(1);
});
