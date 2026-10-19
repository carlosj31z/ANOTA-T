// Utilidad compartida por los scripts scripts/fix-*.mjs (ronda de correcciones):
// levanta un `vite` propio en un puerto dedicado (KART_PORT, 4270 por defecto),
// abre Chromium con SwiftShader y garantiza el cierre con el PID exacto.

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');
export const PORT = Number(process.env.KART_PORT) || 4270;
export const BASE = `http://localhost:${PORT}`;

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

// Ejecuta `body({ page, report, BASE })` con servidor + navegador y sale con 0/1.
export async function runWithBrowser(name, body) {
  const server = spawn(
    path.join(ROOT, 'node_modules', '.bin', 'vite'),
    ['--port', String(PORT), '--strictPort', '--host', '127.0.0.1'],
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
  const report = { name, ok: false, errors: [], results: null, checks: {} };
  try {
    if (!(await waitForServer(BASE))) throw new Error('El dev server no respondió en ' + PORT);
    const { chromium } = await import('playwright');
    browser = await chromium.launch({
      args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    });
    const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !/ERR_FAILED/.test(msg.text())) report.errors.push(msg.text());
    });
    page.on('pageerror', (err) =>
      report.errors.push('pageerror: ' + (err && err.message ? err.message : String(err)))
    );
    await body({ page, report, BASE });
    report.ok = Object.values(report.checks).every(Boolean) && report.errors.length === 0;
  } catch (err) {
    report.errors.push('fatal: ' + (err && err.stack ? err.stack : String(err)));
  } finally {
    if (browser) await browser.close();
    cleanup();
  }
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  process.exit(report.ok ? 0 : 1);
}
