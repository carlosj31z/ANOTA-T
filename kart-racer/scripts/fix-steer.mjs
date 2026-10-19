// Ronda de correcciones — Defecto 1: el giro humano estaba invertido.
// Convención del kart: controls.steer +1 = IZQUIERDA (heading += steer). El input
// humano (teclado/mando/táctil) da +1 = derecha y Game.handleInput lo niega.
// Prueba: sin driver IA en el jugador (window.__game.setPlayerManual), ArrowUp 2 s
// simulados y luego ArrowRight (o ArrowLeft / stick derecho) 0.6 s. Se mide el
// desplazamiento lateral respecto al rumbo inicial con el vector DERECHA del kart
// (-cos h, 0, sin h): adelante = (sin h, 0, cos h), izquierda = aumentar h.

import { runWithBrowser } from './fix-harness.mjs';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function scenario(page, BASE, name, press, release, gamepad = null) {
  if (gamepad) {
    await page.addInitScript(() => {
      window.__padAxis = 0;
      navigator.getGamepads = () => [
        {
          connected: true,
          axes: [window.__padAxis, 0, 0, 0],
          buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
        },
      ];
    });
  }
  await page.goto(`${BASE}/?autotest=1&track=meadow&q=low`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game && window.__game.state === 'race', null, {
    timeout: 120000,
  });
  await page.evaluate(() => window.__game.setPlayerManual(true));

  await page.keyboard.down('ArrowUp');
  await wait(1500); // deja correr algunos frames para que handleInput lea la tecla
  await page.evaluate(() => window.__game.simulate(2));
  const before = await page.evaluate(() => {
    const k = window.__game.player;
    return { x: k.position.x, z: k.position.z, h: k.heading, speed: k.speed };
  });

  await press(page);
  await wait(1500);
  const steerSeen = await page.evaluate(() => window.__game.player.controls.steer);
  await page.evaluate(() => window.__game.simulate(0.6));
  await release(page);
  const after = await page.evaluate(() => {
    const k = window.__game.player;
    return { x: k.position.x, z: k.position.z, h: k.heading, speed: k.speed };
  });
  await page.keyboard.up('ArrowUp');

  const dx = after.x - before.x;
  const dz = after.z - before.z;
  const rx = -Math.cos(before.h);
  const rz = Math.sin(before.h);
  const lateralRight = dx * rx + dz * rz; // >0 = a la derecha del rumbo inicial
  const forward = dx * Math.sin(before.h) + dz * Math.cos(before.h);
  return {
    name,
    controlsSteerEnKart: steerSeen,
    speedAntes: +before.speed.toFixed(2),
    deltaHeadingRad: +(after.h - before.h).toFixed(3),
    lateralDerecha_m: +lateralRight.toFixed(3),
    adelante_m: +forward.toFixed(3),
  };
}

await runWithBrowser('fix-steer', async ({ page, report, BASE }) => {
  const right = await scenario(
    page,
    BASE,
    'ArrowRight',
    (p) => p.keyboard.down('ArrowRight'),
    (p) => p.keyboard.up('ArrowRight')
  );
  const left = await scenario(
    page,
    BASE,
    'ArrowLeft',
    (p) => p.keyboard.down('ArrowLeft'),
    (p) => p.keyboard.up('ArrowLeft')
  );
  const stick = await scenario(
    page,
    BASE,
    'stick derecho (mando)',
    (p) => p.evaluate(() => (window.__padAxis = 1)),
    (p) => p.evaluate(() => (window.__padAxis = 0)),
    true
  );
  report.results = { right, left, stick };

  report.checks.arrowRight_aLaDerecha = right.lateralDerecha_m > 1 && right.deltaHeadingRad < 0;
  report.checks.arrowLeft_aLaIzquierda = left.lateralDerecha_m < -1 && left.deltaHeadingRad > 0;
  report.checks.stickDerecho_aLaDerecha = stick.lateralDerecha_m > 1 && stick.deltaHeadingRad < 0;
  report.checks.avanzaRecto = right.speedAntes > 5 && left.speedAntes > 5;
});
