// Ronda de correcciones — Defecto 3: expresiones tras un golpe (CONTRATO §9.3).
// Tras kart.hit(): 'sorprendido' los primeros ~0.4 s, luego 'mareado' mientras gira,
// y 'enfadado' ~1.5 s DESPUÉS del giro; después vuelve a 'neutral'.

import { runWithBrowser } from './fix-harness.mjs';

await runWithBrowser('fix-expresion', async ({ page, report, BASE }) => {
  await page.goto(`${BASE}/?autotest=1&track=meadow&q=low`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game && window.__game.state === 'race', null, {
    timeout: 120000,
  });

  report.results = await page.evaluate(async () => {
    const mod = await import('/src/kart/dev-api.js');
    const { THREE, createKart, CHARACTERS } = mod;
    const track = window.__track;
    const kart = createKart(new THREE.Scene(), CHARACTERS.find((c) => c.id === 'rayo'), {
      isPlayer: false,
    });
    const p0 = track.projectToTrack(track.getPointAt(0.3), 0.3);
    kart.setTransform(p0.center, Math.atan2(p0.tangent.x, p0.tangent.z));
    const dt = 1 / 60;
    for (let i = 0; i < 30; i++) kart.update(dt, track);
    const before = kart.expression;
    kart.hit('test');
    const spin = kart.state.spinTime;
    const timeline = [];
    let last = null;
    let t = 0;
    let spinEnd = null;
    for (let i = 0; i < 6 * 60; i++) {
      kart.update(dt, track);
      t += dt;
      if (spinEnd === null && kart.state.spinTime <= 0) spinEnd = t;
      if (kart.expression !== last) {
        last = kart.expression;
        timeline.push({ t: +t.toFixed(2), expr: last });
      }
    }
    return { before, spinTime: +spin.toFixed(2), spinEnd: +spinEnd.toFixed(2), timeline };
  });

  const { timeline, spinEnd } = report.results;
  const at = (name) => timeline.find((e) => e.expr === name);
  const sorp = at('sorprendido');
  const mar = at('mareado');
  const enf = at('enfadado');
  const neutralAfter = timeline.filter((e) => e.expr === 'neutral').pop();
  report.checks.sorprendido_primero = !!sorp && sorp.t <= 0.1;
  report.checks.mareado_tras_0_4s = !!mar && mar.t >= 0.35 && mar.t <= 0.55;
  report.checks.enfadado_tras_giro = !!enf && Math.abs(enf.t - spinEnd) < 0.1;
  report.checks.enfadado_dura_1_5s =
    !!enf && !!neutralAfter && Math.abs(neutralAfter.t - enf.t - 1.5) < 0.15;
});
