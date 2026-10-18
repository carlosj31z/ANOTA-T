// BLOQUE 0 — CORE: perfil de draw calls a lo largo de una carrera (calidad high).
//
// Para cada circuito simula la carrera en autotest con `?q=high` y cada 15 s
// mide `window.__game.measureDrawCalls()` dos veces: con el pipeline tal cual
// y con el pase GTAO desactivado (`pass.enabled = false`), para separar lo que
// aporta el postprocesado de lo que aporta la escena. También cuenta mallas
// por kart y del circuito.
//
// Uso: CORE_BASE=http://localhost:4240 node scripts/core-drawcalls.mjs

import process from 'node:process';

process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';
const BASE = process.env.CORE_BASE || 'http://localhost:4240';
const TRACKS = (process.env.CORE_TRACKS || 'meadow,desert,snow').split(',');
const STEP = Number(process.env.CORE_STEP || 15);

const { chromium } = await import('playwright');
const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const out = [];
try {
  for (const track of TRACKS) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e && e.message)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto(`${BASE}/?autotest=1&track=${track}&q=high`, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => window.__game && window.__game.state === 'race', null, { timeout: 60000 });
    const res = await page.evaluate(async (step) => {
      const g = window.__game;
      const meshesOf = (o) => {
        let n = 0;
        let cast = 0;
        o.traverse((c) => {
          if (c.isMesh || c.isPoints || c.isLine || c.isSprite) {
            n += 1;
            if (c.castShadow) cast += 1;
          }
        });
        return { n, cast };
      };
      const kartMeshes = g.karts.map((k) => ({ id: k.character.id, ...meshesOf(k.object3d) }));
      const samples = [];
      let sim = 0;
      for (;;) {
        const withGtao = g.measureDrawCalls();
        // Mismo frame sin GTAO.
        const comp = g.pipeline && g.pipeline.composer;
        let noGtao = null;
        if (comp) {
          const gtao = comp.passes.find((p) => p.normalMaterial && p.gtaoMaterial);
          if (gtao) {
            gtao.enabled = false;
            noGtao = g.measureDrawCalls().total;
            gtao.enabled = true;
          }
        }
        samples.push({
          t: Math.round(g.raceTime),
          total: withGtao.total,
          scene: withGtao.scene,
          shadow: withGtao.shadow,
          gtao: (withGtao.passes.find((p) => p.name === 'GTAO') || {}).calls,
          totalSinGtao: noGtao,
        });
        if (g.finishedAll || sim >= 360) break;
        g.simulate(step);
        sim += step;
        await new Promise((r) => requestAnimationFrame(() => r()));
      }
      const max = (k) => Math.max(...samples.map((s) => s[k] || 0));
      return {
        kartMeshes,
        samples,
        max: { total: max('total'), scene: max('scene'), totalSinGtao: max('totalSinGtao'), gtao: max('gtao') },
      };
    }, STEP);
    await page.close();
    out.push({ track, errors, ...res });
    process.stderr.write(`[drawcalls] ${track} ${JSON.stringify(res.max)}\n`);
  }
} finally {
  await browser.close();
}
process.stdout.write(JSON.stringify(out, null, 2) + '\n');
