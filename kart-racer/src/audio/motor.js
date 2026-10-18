// BLOQUE 5 — Audio. Sonido del motor del kart (setEngine).
// Dos osciladores (sawtooth + square una octava abajo) -> filtro paso-bajo -> gain,
// con LFO leve ("petardeo"). Frecuencia base 55-220 Hz según el ratio de velocidad.

import { clamp01 } from './engine.js';

export function createMotor(graph) {
  const ctx = graph.context;
  const out = ctx.createGain();
  out.gain.value = 0.0001;
  out.connect(graph.engine);

  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = 600;
  filt.Q.value = 6;
  filt.connect(out);

  const oscA = ctx.createOscillator();
  oscA.type = 'sawtooth';
  oscA.frequency.value = 60;
  const gA = ctx.createGain();
  gA.gain.value = 0.5;

  const oscB = ctx.createOscillator();
  oscB.type = 'square';
  oscB.frequency.value = 30;
  const gB = ctx.createGain();
  gB.gain.value = 0.3;

  oscA.connect(gA);
  gA.connect(filt);
  oscB.connect(gB);
  gB.connect(filt);

  // LFO de "petardeo": modula ligeramente la frecuencia del oscilador principal.
  const lfo = ctx.createOscillator();
  lfo.type = 'square';
  lfo.frequency.value = 13;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 3;
  lfo.connect(lfoGain);
  lfoGain.connect(oscA.frequency);

  oscA.start();
  oscB.start();
  lfo.start();

  let last = { ratio: 0, boosting: false, active: false };

  function set(ratio, boosting, active) {
    const r = clamp01(ratio);
    const boost = !!boosting;
    const now = ctx.currentTime;
    const base = 55 + r * 165;
    const pitchMul = boost ? 1.2 : 1;
    oscA.frequency.setTargetAtTime(base * pitchMul, now, 0.06);
    oscB.frequency.setTargetAtTime(base * pitchMul * 0.5, now, 0.06);
    filt.frequency.setTargetAtTime((500 + r * 2800) * (boost ? 1.6 : 1), now, 0.08);
    lfoGain.gain.setTargetAtTime(boost ? 7 : 3, now, 0.1);
    const target = active ? (0.1 + r * 0.1) * (boost ? 1.25 : 1) : 0.0001;
    out.gain.setTargetAtTime(target, now, active ? 0.08 : 0.12);
    last = { ratio: r, boosting: boost, active: !!active };
  }

  function dispose() {
    try {
      oscA.stop();
      oscB.stop();
      lfo.stop();
    } catch {
      /* ignore */
    }
  }

  return { set, dispose, state: () => ({ ...last }) };
}
