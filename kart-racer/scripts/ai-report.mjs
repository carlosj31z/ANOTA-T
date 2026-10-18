// Reporte de la IA (bloque 3). SPEC C7.
//
// Compila a un directorio propio en /tmp y sirve el build en un puerto propio
// (4183), aislado de los demás agentes, y simula una carrera completa en cada
// circuito con los 8 karts en piloto automático. Reporta por circuito: tiempo
// de meta de cada kart, respawns, tiempo atascado y errores de consola.
//
//   node scripts/ai-report.mjs
//
// Lee los datos de window.__game (contrato §4.8) y de kart.aiStats (bloque 3).

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 4183;
const BASE = `http://localhost:${PORT}`;
const BUILD_DIR = '/tmp/rr-build-b3-ai';
const ALL_TRACKS = ['meadow', 'desert', 'snow'];
const TRACK_IDS = process.argv.slice(2).filter((a) => ALL_TRACKS.includes(a));
if (TRACK_IDS.length === 0) TRACK_IDS.push(...ALL_TRACKS);
const MAX_SIM_SECONDS = 360;

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: false });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exit ${code}`))));
  });
}

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
  throw new Error('El servidor de preview no respondió a tiempo');
}

async function main() {
  // Build aislado en /tmp (no toca dist/ ni el puerto 4173 compartidos).
  await run('npx', ['vite', 'build', '--outDir', BUILD_DIR, '--emptyOutDir']);

  const server = spawn(
    'npx',
    ['vite', 'preview', '--outDir', BUILD_DIR, '--port', String(PORT), '--strictPort'],
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

    for (const track of TRACK_IDS) {
      const page = await browser.newPage();
      const consoleErrors = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err) => {
        consoleErrors.push('pageerror: ' + (err && err.message ? err.message : String(err)));
      });

      let report = null;
      try {
        await page.goto(`${BASE}/?autotest=1&track=${track}`, { waitUntil: 'load' });
        await page.waitForFunction(() => window.__game && window.__game.state === 'race', null, {
          timeout: 30000,
        });

        report = await page.evaluate(async (maxSeconds) => {
          const g = window.__game;
          let sim = 0;
          while (!g.finishedAll && sim < maxSeconds) {
            g.simulate(10);
            sim += 10;
            await new Promise((r) => setTimeout(r, 0));
          }
          const karts = (g.karts || []).map((k) => ({
            name: k.character ? k.character.name : '?',
            isPlayer: !!k.isPlayer,
            skill: k.aiStats ? k.aiStats.skill : null,
            finishTime: k.aiStats ? k.aiStats.finishTime : null,
            respawns: k.aiStats ? k.aiStats.respawns : 0,
            stuckTime: k.aiStats ? k.aiStats.stuckTime : 0,
            laps: k.aiStats ? k.aiStats.laps : 0,
          }));
          const unfinished = karts.filter((k) => k.finishTime == null).length;
          const stuck = karts.filter((k) => k.finishTime == null || k.stuckTime > 1.5).length;
          return {
            finishedAll: !!g.finishedAll,
            simulatedSeconds: sim,
            raceTime: g.raceTime,
            drawCalls: g.drawCalls || 0,
            karts,
            unfinished,
            stuck,
          };
        }, MAX_SIM_SECONDS);
      } catch (err) {
        consoleErrors.push('report: ' + (err && err.message ? err.message : String(err)));
      } finally {
        await page.close();
      }

      const ok =
        !!report && report.finishedAll && report.unfinished === 0 && consoleErrors.length === 0;
      if (!ok) failed = true;
      results.push({ track, ok, report, consoleErrors });
    }
  } finally {
    if (browser) await browser.close();
    cleanup();
  }

  process.stdout.write(JSON.stringify(results, null, 2) + '\n');
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  process.stderr.write('ai-report falló: ' + (err && err.stack ? err.stack : String(err)) + '\n');
  process.exit(1);
});
