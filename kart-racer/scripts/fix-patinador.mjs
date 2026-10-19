// Ronda de correcciones — Defecto 2: la ventaja 'patinador' (Nieve) debe notarse
// fuera de pista. Kart con throttle=1 durante 15 s a ~11 m del centro de la pista
// (franja fuera de pista, antes del muro), Nieve frente a Rayo (mismas stats de
// velocidad/aceleración). Objetivo: Nieve >= 20 m/s sostenidos, Rayo ~15-16 m/s.

import { runWithBrowser } from './fix-harness.mjs';

await runWithBrowser('fix-patinador', async ({ page, report, BASE }) => {
  await page.goto(`${BASE}/?autotest=1&track=meadow&q=low`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game && window.__game.state === 'race', null, {
    timeout: 120000,
  });

  report.results = await page.evaluate(async () => {
    const mod = await import('/src/kart/dev-api.js');
    const { THREE, createKart, CHARACTERS } = mod;
    const track = window.__track;
    const OFFSET = 11;

    function run(charId) {
      const c = CHARACTERS.find((x) => x.id === charId);
      const kart = createKart(new THREE.Scene(), c, { isPlayer: false });
      const t0 = 0.3;
      const p0 = track.projectToTrack(track.getPointAt(t0), t0);
      const left = new THREE.Vector3(p0.tangent.z, 0, -p0.tangent.x);
      const start = p0.center.clone().addScaledVector(left, OFFSET);
      kart.setTransform(start, Math.atan2(p0.tangent.x, p0.tangent.z));
      kart.controls.throttle = 1;
      const dt = 1 / 60;
      const samples = [];
      let offroadSteps = 0;
      let steps = 0;
      for (let i = 0; i < 15 * 60; i++) {
        kart.update(dt, track);
        // Mantiene el kart a OFFSET m del centro y alineado con la pista.
        const pr = track.projectToTrack(kart.position, kart.trackT);
        const corr = OFFSET - pr.lateral;
        kart.position.x += (corr * (pr.tangent.z)) ;
        kart.position.z += (corr * (-pr.tangent.x));
        kart.heading = Math.atan2(pr.tangent.x, pr.tangent.z);
        if (kart.state.surface === 'offroad') offroadSteps++;
        steps++;
        if (i % 60 === 59) samples.push(+kart.speed.toFixed(2));
      }
      const tail = samples.slice(-5);
      return {
        id: charId,
        perk: c.perk.id,
        maxSpeed: +kart.maxSpeed.toFixed(2),
        speedPerSecond: samples,
        sustained: +(tail.reduce((a, b) => a + b, 0) / tail.length).toFixed(2),
        offroadRatio: +(offroadSteps / steps).toFixed(3),
      };
    }

    return { nieve: run('nieve'), rayo: run('rayo') };
  });

  const { nieve, rayo } = report.results;
  report.checks.nieveSobre20 = nieve.sustained >= 20;
  report.checks.rayoCerca15 = rayo.sustained > 13 && rayo.sustained < 18;
  report.checks.ventajaClara = nieve.sustained - rayo.sustained >= 4;
  report.checks.estuvoFueraDePista = nieve.offroadRatio > 0.95 && rayo.offroadRatio > 0.95;
});
