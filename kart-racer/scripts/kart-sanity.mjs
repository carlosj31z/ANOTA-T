// Bloque 2 — Prueba de sanidad del kart (contrato §7 / SPEC C3, C5, C11).
// Levanta el dev server de Vite en el puerto 4182 (exclusivo del bloque 2),
// abre ?autotest=1&track=<id> y comprueba con Playwright que:
//   - ningún kart tiene posiciones/velocidades NaN
//   - todos los karts han avanzado (distancia > 0 tras 30 s simulados)
//   - la carrera termina (window.__game.finishedAll)
// Imprime un JSON con el resultado.

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.KART_PORT) || 4182;
const BASE = `http://localhost:${PORT}`;
const TRACK_IDS = process.env.KART_TRACKS ? process.env.KART_TRACKS.split(',') : ['meadow', 'desert', 'snow'];
const SANITY_SECONDS = 30;
const MAX_SIM_SECONDS = 360;

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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
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
  const results = [];
  let failed = false;

  try {
    const up = await waitForServer(BASE);
    if (!up) throw new Error('El dev server no respondió en el puerto ' + PORT);

    const { chromium } = await import('playwright');
    browser = await chromium.launch({
      args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    });

    for (const track of TRACK_IDS) {
      const page = await browser.newPage();
      const consoleErrors = [];
      page.on('console', (msg) => {
        // El abort deliberado de @vite/client (HMR off) no cuenta como error.
        if (msg.type() === 'error' && !/ERR_FAILED/.test(msg.text())) consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err) => {
        consoleErrors.push('pageerror: ' + (err && err.message ? err.message : String(err)));
      });

      let sanity = null;
      let simSeconds = 0;
      let finishedAll = false;

      try {
        await page.goto(`${BASE}/?autotest=1&track=${track}`, { waitUntil: 'load' });
        await page.waitForFunction(() => window.__game && window.__game.state === 'race', null, {
          timeout: 120000,
        });

        const res = await page.evaluate(
          async (cfg) => {
            const g = window.__game;
            const start = g.karts.map((k) => ({
              x: k.position.x,
              z: k.position.z,
            }));

            g.simulate(cfg.sanitySeconds);

            const after = g.karts.map((k, i) => {
              const dx = k.position.x - start[i].x;
              const dz = k.position.z - start[i].z;
              const p = k.position;
              const v = k.velocity;
              return {
                id: k.character.id,
                moved: Math.hypot(dx, dz),
                nan:
                  !isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z) ||
                  !isFinite(v.x) || !isFinite(v.y) || !isFinite(v.z) ||
                  !isFinite(k.speed) || !isFinite(k.heading),
              };
            });

            // Continúa hasta que termine la carrera (los 8 karts).
            let extra = 0;
            while (!g.finishedAll && cfg.sanitySeconds + extra < cfg.maxSeconds) {
              g.simulate(10);
              extra += 10;
              await new Promise((r) => setTimeout(r, 0));
            }

            return {
              karts: after,
              anyNaN: after.some((k) => k.nan),
              allMoved: after.every((k) => k.moved > 1),
              minMoved: Math.min(...after.map((k) => k.moved)),
              finishedAll: !!g.finishedAll,
              totalSimSeconds: cfg.sanitySeconds + extra,
            };
          },
          { sanitySeconds: SANITY_SECONDS, maxSeconds: MAX_SIM_SECONDS }
        );

        sanity = res;
        simSeconds = res.totalSimSeconds;
        finishedAll = res.finishedAll;
      } catch (err) {
        consoleErrors.push('sanity: ' + (err && err.message ? err.message : String(err)));
      } finally {
        await page.close();
      }

      const ok =
        sanity &&
        !sanity.anyNaN &&
        sanity.allMoved &&
        sanity.finishedAll &&
        consoleErrors.length === 0;
      if (!ok) failed = true;

      results.push({
        track,
        ok,
        anyNaN: sanity ? sanity.anyNaN : null,
        allMoved: sanity ? sanity.allMoved : null,
        minMoved: sanity ? Number(sanity.minMoved.toFixed(2)) : null,
        finishedAll,
        simSeconds,
        karts: sanity ? sanity.karts.map((k) => ({ id: k.id, moved: Number(k.moved.toFixed(2)), nan: k.nan })) : [],
        consoleErrors,
      });
    }
  } catch (err) {
    failed = true;
    results.push({ error: err && err.stack ? err.stack : String(err) });
  } finally {
    if (browser) await browser.close();
    cleanup();
  }

  process.stdout.write(JSON.stringify(results, null, 2) + '\n');
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  process.stderr.write('kart-sanity falló: ' + (err && err.stack ? err.stack : String(err)) + '\n');
  process.exit(1);
});
