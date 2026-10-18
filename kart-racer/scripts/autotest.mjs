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
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
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

      try {
        await page.goto(`${BASE}/?autotest=1&track=${track}`, { waitUntil: 'load' });
        await page.waitForFunction(() => window.__game && window.__game.state === 'race', null, {
          timeout: 30000,
        });

        const res = await page.evaluate(async (maxSeconds) => {
          const g = window.__game;
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
          };
        }, MAX_SIM_SECONDS);

        finishedAll = res.finishedAll;
        simulatedSeconds = res.simulatedSeconds;
        drawCalls = res.drawCalls;
      } catch (err) {
        consoleErrors.push('autotest: ' + (err && err.message ? err.message : String(err)));
      } finally {
        await page.close();
      }

      const ok = finishedAll && consoleErrors.length === 0;
      if (!ok) failed = true;
      results.push({ track, finishedAll, simulatedSeconds, consoleErrors, drawCalls });
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
