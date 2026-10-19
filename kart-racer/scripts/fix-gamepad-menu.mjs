// Ronda de correcciones — Defecto 4: menús navegables con mando.
// Se simula `navigator.getGamepads` (A=0, B=1, Start=9, cruceta 12-15, stick axes 0/1)
// y se recorre: título -A-> personaje -derecha-> cambia selección -A-> circuito
// -B-> vuelve a personaje. También: repetición al mantener dirección, A mantenido
// no atraviesa varias pantallas (detección de flanco + bloqueo al abrir menú),
// Start = Enter en el título y stick = flechas.

import { runWithBrowser } from './fix-harness.mjs';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

await runWithBrowser('fix-gamepad-menu', async ({ page, report, BASE }) => {
  await page.addInitScript(() => {
    window.__pad = { buttons: {}, axes: [0, 0, 0, 0] };
    navigator.getGamepads = () => [
      {
        connected: true,
        id: 'mock',
        axes: window.__pad.axes,
        buttons: Array.from({ length: 17 }, (_, i) => ({
          pressed: !!window.__pad.buttons[i],
          value: window.__pad.buttons[i] ? 1 : 0,
        })),
      },
    ];
  });

  const press = async (btn, ms = 150) => {
    await page.evaluate((b) => (window.__pad.buttons[b] = true), btn);
    await wait(ms);
    await page.evaluate((b) => (window.__pad.buttons[b] = false), btn);
    await wait(150);
  };
  const screenTitle = () =>
    page.evaluate(() => {
      if (document.querySelector('.title-screen')) return 'TITULO';
      const h = document.querySelector('.screen-title');
      return h ? h.textContent.trim() : null;
    });
  const charIndex = () =>
    page.evaluate(() => {
      const cards = [...document.querySelectorAll('.char-grid > *')];
      return cards.findIndex((c) => c.classList.contains('selected'));
    });

  await page.goto(`${BASE}/?q=low`, { waitUntil: 'load' });
  await page.waitForSelector('.title-screen', { timeout: 120000 });
  const r = (report.results = {});

  r.s0 = await screenTitle();
  await press(0); // A
  r.s1_trasA = await screenTitle(); // ELIGE PILOTO
  r.idx0 = await charIndex();

  await press(15); // cruceta derecha
  r.idx1_trasDerecha = await charIndex();

  // Mantener derecha ~0.75 s: primer paso inmediato + repeticiones cada ~180 ms.
  const before = await charIndex();
  await page.evaluate(() => (window.__pad.buttons[15] = true));
  await wait(750);
  await page.evaluate(() => (window.__pad.buttons[15] = false));
  await wait(150);
  const after = await charIndex();
  const total = await page.evaluate(() => document.querySelectorAll('.char-grid > *').length);
  r.repeticion = { antes: before, despues: after, pasos: (after - before + total) % total, total };

  await press(14); // cruceta izquierda: vuelve atrás un paso
  r.idx_trasIzquierda = await charIndex();

  // Stick horizontal derecha (axes[0] = 1).
  const b2 = await charIndex();
  await page.evaluate(() => (window.__pad.axes[0] = 1));
  await wait(120);
  await page.evaluate(() => (window.__pad.axes[0] = 0));
  await wait(150);
  r.stick = { antes: b2, despues: await charIndex() };

  await press(0); // A -> circuito
  r.s2_trasA = await screenTitle(); // ELIGE CIRCUITO
  await press(1); // B -> vuelve
  r.s3_trasB = await screenTitle(); // ELIGE PILOTO
  await press(1); // B -> título
  r.s4_trasB2 = await screenTitle(); // TITULO

  // A mantenida 0.8 s desde el título: solo debe pasar a personaje (una pantalla).
  await page.evaluate(() => (window.__pad.buttons[0] = true));
  await wait(800);
  await page.evaluate(() => (window.__pad.buttons[0] = false));
  await wait(150);
  r.aMantenida = await screenTitle(); // ELIGE PILOTO (no ELIGE CIRCUITO)
  await press(1);
  r.volvioTitulo = await screenTitle();

  // Start = Enter en el título.
  await press(9);
  r.startEnTitulo = await screenTitle();

  report.checks.titulo_A_a_personaje = r.s0 === 'TITULO' && r.s1_trasA === 'ELIGE PILOTO';
  report.checks.derecha_cambia_seleccion = r.idx1_trasDerecha === r.idx0 + 1;
  report.checks.repeticion_al_mantener = r.repeticion.pasos >= 3;
  report.checks.izquierda_retrocede = r.idx_trasIzquierda === (r.repeticion.despues - 1 + r.repeticion.total) % r.repeticion.total;
  report.checks.stick_derecha = r.stick.despues === (r.stick.antes + 1) % r.repeticion.total;
  report.checks.A_a_circuito = r.s2_trasA === 'ELIGE CIRCUITO';
  report.checks.B_vuelve = r.s3_trasB === 'ELIGE PILOTO' && r.s4_trasB2 === 'TITULO';
  report.checks.A_mantenida_una_sola_pantalla = r.aMantenida === 'ELIGE PILOTO';
  report.checks.start_enter_en_titulo = r.volvioTitulo === 'TITULO' && r.startEnTitulo === 'ELIGE PILOTO';
});
