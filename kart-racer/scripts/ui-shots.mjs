// Capturas de la interfaz (bloque 6). Contrato §1.
// Levanta el dev server en el puerto 4186 (exclusivo de este bloque) y captura
// menús y HUD en dos contextos:
//   - escritorio 1280x720
//   - móvil horizontal 844x390 (isMobile + hasTouch, para ver la adaptación táctil)
// Guarda shots/ui-*.png.

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

async function captureMenus(page, tag) {
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(1400);
  await page.screenshot({ path: path.join(SHOTS, `ui-${tag}title.png`) });

  await page.keyboard.press('Enter');
  await page.waitForTimeout(700);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOTS, `ui-${tag}chars.png`) });

  await page.keyboard.press('Enter');
  await page.waitForTimeout(700);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOTS, `ui-${tag}tracks.png`) });
}

async function captureHud(page, tag) {
  await page.goto(`${BASE}/?autotest=1&track=meadow`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__game, null, { timeout: 60000 });
  // El render headless va a ~4 fps: avanzamos la simulación a paso fijo.
  await page.evaluate(() => window.__game.simulate(9));
  await page.waitForTimeout(2200);
  await page.evaluate(() => window.__game.simulate(4));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(SHOTS, `ui-${tag}hud.png`) });

  // Final de carrera -> resultados (menú también navegable al tacto).
  try {
    await page.evaluate(() => window.__game.simulate(420));
    await page.waitForSelector('.results-screen', { timeout: 30000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(SHOTS, `ui-${tag}results.png`) });
  } catch {
    /* si la carrera no termina en el entorno headless, no es bloqueante */
  }
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

    const wire = (page) => {
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err) => {
        consoleErrors.push('pageerror: ' + (err && err.message ? err.message : String(err)));
      });
    };

    // --- Escritorio 1280x720 ---
    const desktop = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const dpage = await desktop.newPage();
    wire(dpage);
    await captureMenus(dpage, '');
    await captureHud(dpage, '');
    await desktop.close();

    // --- Móvil horizontal 844x390 (táctil) ---
    const mobile = await browser.newContext({
      viewport: { width: 844, height: 390 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 1,
    });
    const mpage = await mobile.newPage();
    wire(mpage);
    await captureMenus(mpage, 'mobile-');
    await captureHud(mpage, 'mobile-');
    await mobile.close();
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
