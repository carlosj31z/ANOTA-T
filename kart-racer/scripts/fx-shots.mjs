// Prueba del BLOQUE 7 (fx). Contrato §4.7 / SPEC C11, C12.
// Levanta un dev server propio (puerto 4187), abre el autotest del circuito
// "meadow", avanza la simulación ~20 s dejando renderizar, captura
// shots/fx-race.png y reporta draw calls y partículas vivas (< máximo).

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 4187;
const BASE = `http://localhost:${PORT}`;
const TRACK = process.argv[2] || 'meadow';
const SIM_SECONDS = 20;
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
    // Bloquea el cliente HMR de Vite: otros agentes editan src/* a la vez y un
    // reload a mitad de la prueba destruiría el contexto de la página.
    await page.route('**/@vite/client', (route) => route.abort());
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

    const data = await page.evaluate(async (seconds) => {
      const g = window.__game;
      const t0 = performance.now();
      const simCap = 14; // nos quedamos a mitad de carrera para ver acción
      let sim = 0;
      // Corre ~20 s reales dejando renderizar (los emisores continuos necesitan
      // frames); sólo avanzamos física hasta `simCap` para no llegar a meta.
      while ((performance.now() - t0) / 1000 < seconds && !g.finishedAll) {
        if (sim < simCap) {
          g.simulate(0.5);
          sim += 0.5;
        }
        await new Promise((r) => requestAnimationFrame(r));
      }
      const s = window.__fxStats || null;
      return {
        simulated: sim,
        finishedAll: !!g.finishedAll,
        drawCalls: g.drawCalls || 0,
        fx: s ? { alive: s.alive, max: s.max, peak: s.peak } : null,
      };
    }, SIM_SECONDS);

    await page.screenshot({ path: path.join(SHOTS, 'fx-race.png') });
    await page.close();

    const fxOk = data.fx && data.fx.alive <= data.fx.max && data.fx.peak <= data.fx.max;
    if (!fxOk || consoleErrors.length > 0) failed = true;
    result = { track: TRACK, ...data, fxOk, consoleErrors };
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
