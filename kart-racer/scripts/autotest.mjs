// Autotest de la fundación (bloque 0). Contrato §4.8 / SPEC C7.
// Compila, sirve el build y simula una carrera completa en cada circuito con
// el jugador en piloto automático, usando Chromium headless + SwiftShader.

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

// El navegador ya está instalado en /opt/pw-browsers (no ejecutar `playwright install`).
process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 4173;
const BASE = `http://localhost:${PORT}`;
const TRACK_IDS = ['meadow', 'desert', 'snow'];
const MAX_SIM_SECONDS = 360;
// Calidad explícita para que los draw calls sean comparables entre máquinas
// (sin `?q=` el juego elegiría por localStorage / tipo de dispositivo).
const QUALITY = process.env.AUTOTEST_Q || 'high';
const DRAW_CALL_BUDGET = 300; // SPEC C12: < 300 draw calls por frame

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: false });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exit ${code}`))));
  });
}

async function waitForServer(url, timeoutMs = 30000) {
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
  throw new Error('El servidor de preview no respondió a tiempo');
}

async function main() {
  // 1. Build de producción.
  await run('npm', ['run', 'build']);

  // 2. Servir el build.
  // Se lanza el binario de vite con node directamente (no `npx`): así `kill`
  // termina el propio servidor y no solo el envoltorio de npx.
  const viteBin = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  const server = spawn(process.execPath, [viteBin, 'preview', '--port', String(PORT), '--strictPort'], {
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
  const results = [];
  let failed = false;

  try {
    await waitForServer(BASE);

    const { chromium } = await import('playwright');
    browser = await chromium.launch({
      args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    });

    for (const track of TRACK_IDS) {
      const page = await browser.newPage();
      const consoleErrors = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err) => {
        consoleErrors.push('pageerror: ' + (err && err.message ? err.message : String(err)));
      });

      let finishedAll = false;
      let simulatedSeconds = 0;
      let drawCalls = 0;
      let drawCallsStart = null;
      let drawCallsEnd = null;
      let quality = null;

      try {
        await page.goto(`${BASE}/?autotest=1&track=${track}&q=${QUALITY}`, {
          waitUntil: 'load',
          timeout: 120000,
        });
        await page.waitForFunction(() => window.__game && window.__game.state === 'race', null, {
          timeout: 60000,
        });

        const res = await page.evaluate(async (maxSeconds) => {
          const g = window.__game;
          // Desglose en la parrilla (todos los karts a la vista) y al final.
          const pick = (m) => ({ total: m.total, scene: m.scene, sceneMain: m.sceneMain, shadow: m.shadow, post: m.total - m.scene, passes: m.passes });
          const start = g.measureDrawCalls ? pick(g.measureDrawCalls()) : null;
          let sim = 0;
          while (!g.finishedAll && sim < maxSeconds) {
            g.simulate(10);
            sim += 10;
            await new Promise((r) => setTimeout(r, 0));
          }
          return {
            finishedAll: !!g.finishedAll,
            simulatedSeconds: sim,
            drawCalls: g.drawCalls || 0,
            quality: g.quality,
            start,
            end: g.measureDrawCalls ? pick(g.measureDrawCalls()) : null,
          };
        }, MAX_SIM_SECONDS);

        finishedAll = res.finishedAll;
        simulatedSeconds = res.simulatedSeconds;
        drawCalls = res.drawCalls;
        drawCallsStart = res.start;
        drawCallsEnd = res.end;
        quality = res.quality;
      } catch (err) {
        consoleErrors.push('autotest: ' + (err && err.message ? err.message : String(err)));
      } finally {
        await page.close();
      }

      const ok = finishedAll && consoleErrors.length === 0;
      if (!ok) failed = true;
      // `drawCalls` = último frame pintado (frame completo: sombras + escena +
      // postprocesado). El presupuesto se informa pero no hace fallar el autotest.
      const maxTotal = Math.max(
        drawCalls,
        drawCallsStart ? drawCallsStart.total : 0,
        drawCallsEnd ? drawCallsEnd.total : 0
      );
      results.push({
        track,
        quality,
        finishedAll,
        simulatedSeconds,
        consoleErrors,
        drawCalls,
        drawCallsStart,
        drawCallsEnd,
        drawCallsBudgetOk: maxTotal < DRAW_CALL_BUDGET,
      });
    }
  } finally {
    if (browser) await browser.close();
    cleanup();
  }

  process.stdout.write(JSON.stringify(results, null, 2) + '\n');
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  process.stderr.write('Autotest falló: ' + (err && err.stack ? err.stack : String(err)) + '\n');
  process.exit(1);
});
