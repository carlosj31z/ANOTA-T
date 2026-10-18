// BLOQUE 1 — Capturas de los 3 circuitos.
// Levanta el dev server de Vite en el puerto 4181 (reglas de concurrencia de la ronda)
// y con Playwright + SwiftShader abre ?autotest=1&track=<id>, simula 3 s y captura
// shots/track-<id>.png a 1280x720.

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 4181;
const BASE = `http://localhost:${PORT}`;
const TRACK_IDS = ['meadow', 'desert', 'snow'];

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

async function main() {
  await mkdir(path.join(ROOT, 'shots'), { recursive: true });

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
  const results = [];
  let failed = false;

  try {
    await waitForServer(BASE);

    const { chromium } = await import('playwright');
    browser = await chromium.launch({
      args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    });

    for (const track of TRACK_IDS) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      const consoleErrors = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err) => {
        consoleErrors.push('pageerror: ' + (err && err.message ? err.message : String(err)));
      });

      let drawCalls = 0;
      let ok = false;
      try {
        await page.goto(`${BASE}/?autotest=1&track=${track}`, { waitUntil: 'load' });
        await page.waitForFunction(() => window.__game && window.__game.state === 'race', null, {
          timeout: 30000,
        });
        // Avanza 3 s de simulación y deja unos frames para que la cámara siga al kart.
        await page.evaluate(() => window.__game.simulate(3));
        await page.waitForTimeout(600);
        drawCalls = await page.evaluate(() => window.__game.drawCalls || 0);
        await page.screenshot({ path: path.join(ROOT, 'shots', `track-${track}.png`) });
        ok = true;
      } catch (err) {
        consoleErrors.push('capture: ' + (err && err.message ? err.message : String(err)));
      } finally {
        await page.close();
      }

      if (consoleErrors.length > 0) failed = true;
      results.push({ track, ok, drawCalls, consoleErrors });
    }
  } finally {
    if (browser) await browser.close();
    cleanup();
  }

  process.stdout.write(JSON.stringify(results, null, 2) + '\n');
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  process.stderr.write('Capturas fallaron: ' + (err && err.stack ? err.stack : String(err)) + '\n');
  process.exit(1);
});
