// BLOQUE 5 — Audio. Prueba de render offline con Playwright + OfflineAudioContext.
// Sirve el proyecto con el dev server de Vite en el puerto 4185 e importa el
// módulo de audio en la página para renderizar 8 s de cada canción, midiendo:
//   - RMS > 0.01
//   - sin NaN
//   - sin picos > 1.0
// Imprime el resultado como JSON. Exit code 1 si algo falla.

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 4185;
const BASE = `http://localhost:${PORT}`;
const SONGS = ['menu', 'meadow', 'desert', 'snow', 'results'];
const SECONDS = 8;

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
  throw new Error('El servidor de desarrollo no respondió a tiempo');
}

async function main() {
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
  let failed = false;
  const results = [];

  try {
    await waitForServer(BASE);
    const { chromium } = await import('playwright');
    browser = await chromium.launch({
      args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    });

    const page = await browser.newPage();
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      consoleErrors.push('pageerror: ' + (err && err.message ? err.message : String(err)));
    });

    // Cargamos el origen para poder importar el módulo por el dev server.
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });

    const rendered = await page.evaluate(
      async ({ songs, seconds }) => {
        const mod = await import('/src/audio/index.js');
        const out = [];
        for (const id of songs) {
          try {
            const buf = await mod.renderSongOffline(id, seconds);
            const data = buf.getChannelData(0);
            let sumSq = 0;
            let peak = 0;
            let nanCount = 0;
            for (let i = 0; i < data.length; i++) {
              const v = data[i];
              if (!Number.isFinite(v)) {
                nanCount++;
                continue;
              }
              const a = Math.abs(v);
              if (a > peak) peak = a;
              sumSq += v * v;
            }
            const rms = Math.sqrt(sumSq / data.length);
            out.push({
              id,
              sampleRate: buf.sampleRate,
              length: buf.length,
              rms: Number(rms.toFixed(5)),
              peak: Number(peak.toFixed(5)),
              nanCount,
            });
          } catch (err) {
            out.push({ id, error: err && err.message ? err.message : String(err) });
          }
        }
        return out;
      },
      { songs: SONGS, seconds: SECONDS }
    );

    for (const r of rendered) {
      const ok = !r.error && r.rms > 0.01 && r.peak <= 1.0 && r.nanCount === 0;
      if (!ok) failed = true;
      results.push({ ...r, ok });
    }

    await page.close();

    if (consoleErrors.length) {
      failed = true;
    }

    process.stdout.write(
      JSON.stringify(
        { seconds: SECONDS, songs: results, consoleErrors: consoleErrors.slice(0, 20) },
        null,
        2
      ) + '\n'
    );
  } finally {
    if (browser) await browser.close();
    cleanup();
  }

  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  process.stderr.write('audio-render falló: ' + (err && err.stack ? err.stack : String(err)) + '\n');
  process.exit(1);
});
