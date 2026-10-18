// Capturas de la interfaz (bloque 6). Contrato §1.
// Levanta el dev server en el puerto 4186 (exclusivo de este bloque), abre el
// juego SIN autotest y navega menús con Enter, guardando shots/ui-*.png.

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import process from 'node:process';

process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 4186;
const BASE = `http://localhost:${PORT}`;
const SHOTS = path.join(ROOT, 'shots');

function waitForServer(url, timeoutMs = 40000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(url);
        if (res.status === 200) return resolve();
      } catch {
        /* aún no está */
      }
      if (Date.now() - start > timeoutMs) return reject(new Error('El dev server no respondió'));
      setTimeout(tick, 300);
    };
    tick();
  });
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });

  const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT,
    stdio: 'ignore',
    detached: true, // grupo propio para poder matar también a los hijos de npx
  });
  const cleanup = () => {
    try {
      process.kill(-server.pid, 'SIGTERM');
    } catch {
      /* ignore */
    }
  };
  process.on('exit', cleanup);

  let browser = null;
  const consoleErrors = [];

  try {
    await waitForServer(BASE);

    const { chromium } = await import('playwright');
    browser = await chromium.launch({
      args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      consoleErrors.push('pageerror: ' + (err && err.message ? err.message : String(err)));
    });

    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(SHOTS, 'ui-title.png') });

    await page.keyboard.press('Enter');
    await page.waitForTimeout(600);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(SHOTS, 'ui-chars.png') });

    await page.keyboard.press('Enter');
    await page.waitForTimeout(600);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(SHOTS, 'ui-tracks.png') });

    await page.keyboard.press('Enter');
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(SHOTS, 'ui-hud.png') });

    // La carrera arranca tras intro (3 s) + cuenta atrás (3 s), pero bajo
    // SwiftShader el reloj de juego avanza más lento que el real: esperamos a
    // que el cronómetro esté corriendo (HUD vivo: minimapa, velocidad).
    await page.waitForFunction(
      () => {
        const clock = document.querySelector('.hud-clock');
        return clock && clock.textContent !== '0:00.00' && !document.querySelector('.countdown');
      },
      null,
      { timeout: 90000 }
    );
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(SHOTS, 'ui-hud-live.png') });

    // Extra: pausa (no forma parte del encargo mínimo).
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SHOTS, 'ui-pause.png') });
  } finally {
    if (browser) await browser.close();
    cleanup();
  }

  process.stdout.write(
    JSON.stringify({ ok: consoleErrors.length === 0, consoleErrors }, null, 2) + '\n'
  );
  process.exit(consoleErrors.length === 0 ? 0 : 1);
}

main().catch((err) => {
  process.stderr.write('ui-shots falló: ' + (err && err.stack ? err.stack : String(err)) + '\n');
  process.exit(1);
});
