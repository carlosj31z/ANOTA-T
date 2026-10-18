// BLOQUE 1 — Capturas de los 3 circuitos (2 vistas por circuito).
// Levanta Vite en el puerto 4205 y con Playwright + SwiftShader abre
// ?autotest=1&track=<id>; captura la vista de carrera tras simulate(8) y una
// vista general (cámara elevada sobre el circuito) a 1280x720.

import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 4205;
const BASE = `http://localhost:${PORT}`;
const TRACK_IDS = ['meadow', 'desert', 'snow'];
const PREVIEW_OUT = '/tmp/rr-build-g-track';

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

async function runCapture(page, track) {
  let drawCalls = 0;
  await page.goto(`${BASE}/?autotest=1&track=${track}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game && window.__game.state === 'race', null, {
    timeout: 45000,
  });
  await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve()));

  // --- Vista de carrera ---
  await page.evaluate(() => window.__game.simulate(8));
  await page.waitForTimeout(1400);
  drawCalls = await page.evaluate(() => window.__game.drawCalls || 0);
  await page.screenshot({ path: path.join(ROOT, 'shots', `track-${track}.png`) });

  // --- Vista general: cámara elevada sobre el circuito ---
  await page.evaluate(() => {
    const t = window.__track;
    const k = window.__game.karts[0];
    if (!t || !k) throw new Error('sin __track/__game');
    k.velocity.set(0, 0, 0);
    k.speed = 0;
    k.position.set(t.centroid.x, 175, t.centroid.z + 300);
    k.heading = Math.PI; // mira hacia -z (centro del circuito)
    k.object3d.visible = false;
    window.__game.simulate(0); // recoloca la cámara sin suavizado
  });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(ROOT, 'shots', `track-${track}-overview.png`) });

  return drawCalls;
}

async function main() {
  await mkdir(path.join(ROOT, 'shots'), { recursive: true });

  // Servimos el build de producción (sin HMR ni recargas de Vite que rompan
  // las capturas) en el mismo puerto.
  const build = spawnSync('npx', ['vite', 'build', '--outDir', PREVIEW_OUT, '--emptyOutDir'], {
    cwd: ROOT,
    stdio: 'ignore',
  });
  if (build.status !== 0) throw new Error('vite build falló');

  const server = spawn(
    'npx',
    ['vite', 'preview', '--outDir', PREVIEW_OUT, '--port', String(PORT), '--strictPort'],
    { cwd: ROOT, stdio: 'ignore' }
  );
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

    // Calentamiento: deja listo el contexto WebGL/decodificación de shaders.
    {
      const warm = await browser.newPage({ viewport: { width: 320, height: 240 } });
      try {
        await warm.goto(`${BASE}/?autotest=1&track=meadow`, { waitUntil: 'load' });
        await warm.waitForTimeout(2500);
      } catch {
        /* ignore */
      }
      await warm.close();
    }

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
      let lastErr = null;
      for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
        try {
          drawCalls = await runCapture(page, track);
          ok = true;
        } catch (err) {
          lastErr = err;
          await page.waitForTimeout(500);
        }
      }
      if (!ok && lastErr) {
        consoleErrors.push('capture: ' + (lastErr.message || String(lastErr)));
      }
      await page.close();

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
