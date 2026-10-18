// Bloque 2 — Galería de personajes (tanda 3). Abre la página aislada
// /src/kart/gallery.html (no depende del core ni del circuito) y captura dos
// imágenes: los 8 pilotos de frente en 2 filas, y un primer plano de caras con
// varias expresiones activadas con kart.setExpression.
//
// Uso: node scripts/kart-gallery.mjs
// Salidas: shots/kart-gallery.png, shots/kart-expressions.png

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 4201;
const BASE = `http://localhost:${PORT}`;

async function waitForServer(url, timeoutMs = 40000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status === 200) return true;
    } catch {
      /* aún no está */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

async function main() {
  const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
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
  const report = { gallery: false, expressions: false, errors: [], stats: null };

  try {
    const up = await waitForServer(BASE);
    if (!up) throw new Error('El dev server no respondió en ' + PORT);

    const { chromium } = await import('playwright');
    browser = await chromium.launch({
      args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('console', (msg) => {
      if (msg.type() === 'error') report.errors.push(msg.text());
    });
    page.on('pageerror', (err) =>
      report.errors.push('pageerror: ' + (err && err.message ? err.message : String(err)))
    );

    // Sin HMR: evita recargas completas mientras otros agentes escriben archivos.
    await page.route('**/@vite/client', (route) => route.abort());
    await page.route('**/ws', (route) => route.abort());

    await page.goto(`${BASE}/src/kart/gallery.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__galleryReady && window.__gallery, null, { timeout: 30000 });
    await page.waitForTimeout(1200);

    report.stats = await page.evaluate(() => window.__gallery.triangles());

    // ---- Foto 1: galería (2 filas de 4, de frente) ----
    await page.evaluate(() => {
      const g = window.__gallery;
      g.layoutGallery();
      g.settle(60);
      g.setCamera([0, 3.1, 11.2], [0, 0.75, -0.3], 42);
      g.render();
    });
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(ROOT, 'shots', 'kart-gallery.png') });
    report.gallery = true;

    // ---- Foto 2: expresiones (una distinta por personaje) ----
    await page.evaluate(() => {
      const g = window.__gallery;
      const exprs = [
        'eufórico',
        'determinado',
        'enfadado',
        'sorprendido',
        'mareado',
        'contento',
        'neutral',
        'eufórico',
      ];
      g.layoutGallery();
      for (let i = 0; i < g.karts.length; i++) g.karts[i].setExpression(exprs[i], 9999);
      g.settle(70);
      g.setCamera([0, 1.75, 6.4], [0, 0.95, 0.2], 34);
      g.render();
    });
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(ROOT, 'shots', 'kart-expressions.png') });
    report.expressions = true;
  } catch (err) {
    report.errors.push('fatal: ' + (err && err.stack ? err.stack : String(err)));
  } finally {
    if (browser) await browser.close();
    cleanup();
  }

  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  process.exit(report.gallery && report.expressions ? 0 : 1);
}

main().catch((err) => {
  process.stderr.write('kart-gallery falló: ' + (err && err.stack ? err.stack : String(err)) + '\n');
  process.exit(1);
});
