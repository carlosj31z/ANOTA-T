// Reporte de la IA (bloque 3). SPEC C7 + objetivo de corrección tanda 2.
//
// Compila a un directorio propio en /tmp y sirve el build en un puerto propio
// (4183), aislado de los demás agentes, y simula una carrera completa en cada
// circuito con los 8 karts en piloto automático. Reporta por circuito:
//   · offroadRatio  = frames fuera de pista / frames totales, contando SOLO
//                     frames con kart.state.spinTime <= 0.
//   · winnerTime    = menor tiempo de meta entre los 8 karts.
//   · respawns      = suma de respawns de recuperación de la IA.
//   · driftLevel 2+ alcanzado, objetos usados, y errores de consola.
//
//   node scripts/ai-report.mjs [meadow desert snow]
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
const DT = 1 / 60;

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

        report = await page.evaluate(
          async ({ maxSeconds, dt }) => {
            const g = window.__game;
            const karts = g.karts || [];
            const n = karts.length;
            const per = karts.map((k) => ({
              name: k.character ? k.character.name : '?',
              isPlayer: !!k.isPlayer,
              skill: k.aiStats ? k.aiStats.skill : null,
              nonSpin: 0,
              offroad: 0,
              wall: 0,
              maxDrift: 0,
            }));
            let nonSpin = 0;
            let offroad = 0;
            let wall = 0;
            let spinFrames = 0;
            let sim = 0;

            while (!g.finishedAll && sim < maxSeconds) {
              g.simulate(dt);
              sim += dt;
              for (let i = 0; i < n; i++) {
                const k = karts[i];
                const s = k.state;
                if (s.spinTime > 0) {
                  spinFrames++;
                  continue;
                }
                nonSpin++;
                per[i].nonSpin++;
                if (s.surface === 'offroad') {
                  offroad++;
                  per[i].offroad++;
                }
                if (s.surface === 'wall') {
                  wall++;
                  per[i].wall++;
                }
                if (s.driftLevel > per[i].maxDrift) per[i].maxDrift = s.driftLevel;
              }
            }

            const kartsOut = karts.map((k, i) => {
              const a = k.aiStats || {};
              return {
                name: per[i].name,
                isPlayer: per[i].isPlayer,
                skill: per[i].skill,
                finishTime: a.finishTime == null ? null : a.finishTime,
                respawns: a.respawns || 0,
                stuckTime: a.stuckTime || 0,
                itemsUsed: a.itemsUsed || 0,
                maxDrift: per[i].maxDrift,
                offroadRatio: per[i].nonSpin ? per[i].offroad / per[i].nonSpin : 0,
                nonSpin: per[i].nonSpin,
                wall: per[i].wall,
              };
            });

            const finished = kartsOut.filter((k) => k.finishTime != null);
            const times = finished.map((k) => k.finishTime);
            const respawns = kartsOut.reduce((s, k) => s + k.respawns, 0);

            return {
              finishedAll: !!g.finishedAll,
              simulatedSeconds: sim,
              raceTime: g.raceTime,
              drawCalls: g.drawCalls || 0,
              offroadRatio: nonSpin ? offroad / nonSpin : 1,
              offroadFrames: offroad,
              nonSpinFrames: nonSpin,
              spinFrames,
              wallFrames: wall,
              winnerTime: times.length ? Math.min(...times) : null,
              lastTime: times.length ? Math.max(...times) : null,
              unfinished: kartsOut.length - finished.length,
              respawns,
              driftLevel2Plus: kartsOut.filter((k) => k.maxDrift >= 2).length,
              itemUsers: kartsOut.filter((k) => k.itemsUsed > 0).length,
              karts: kartsOut,
            };
          },
          { maxSeconds: MAX_SIM_SECONDS, dt: DT }
        );
      } catch (err) {
        consoleErrors.push('report: ' + (err && err.message ? err.message : String(err)));
      } finally {
        await page.close();
      }

      const ok =
        !!report &&
        report.finishedAll &&
        report.unfinished === 0 &&
        report.offroadRatio < 0.05 &&
        consoleErrors.length === 0;
      if (!ok) failed = true;
      results.push({ track, ok, report, consoleErrors });
    }
  } finally {
    if (browser) await browser.close();
    cleanup();
  }

  // Resumen legible en stderr (el JSON completo va a stdout).
  for (const r of results) {
    const rep = r.report;
    if (!rep) {
      process.stderr.write(`${r.track}: SIN DATOS\n`);
      continue;
    }
    process.stderr.write(
      `${r.track}: offroad=${(rep.offroadRatio * 100).toFixed(2)}% ` +
        `(${rep.offroadFrames}/${rep.nonSpinFrames}) winner=${rep.winnerTime ? rep.winnerTime.toFixed(1) : '-'}s ` +
        `last=${rep.lastTime ? rep.lastTime.toFixed(1) : '-'}s respawns=${rep.respawns} ` +
        `drift2+=${rep.driftLevel2Plus} itemUsers=${rep.itemUsers} unif=${rep.unfinished} ok=${r.ok}\n`
    );
  }

  process.stdout.write(JSON.stringify(results, null, 2) + '\n');
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  process.stderr.write('ai-report falló: ' + (err && err.stack ? err.stack : String(err)) + '\n');
  process.exit(1);
});
