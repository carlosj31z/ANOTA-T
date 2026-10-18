// BLOQUE 5 — Audio. Secuenciador con lookahead para el render en vivo y
// planificador "offline" para renderizar canciones completas.
//
// Notación: cada parte es un array indexado por paso de semicorchea.
//   parts.lead[step]  = { ns:[midi...], d: duración en pasos, v: velocidad }
//   drums.kick[step]  = velocidad 0..1 (0/null = silencio)
//
// En vivo: setInterval(25 ms) programa en ctx.currentTime con ventana de 0.1 s.
// El tempo se puede escalar (última vuelta: ×1.15) aplicándose al siguiente compás.

import * as synth from './synth.js';

export const LOOKAHEAD_MS = 25;
export const SCHEDULE_WINDOW = 0.1;

const PART_ORDER = ['pad', 'arp', 'bass', 'lead'];
const DRUM_ORDER = ['kick', 'snare', 'hat', 'tom', 'crash'];

function playVoice(name, ctx, dest, time, ev, secPerStep, song) {
  const dur = Math.max(0.02, (ev.d || 1) * secPerStep);
  const vel = ev.v == null ? 0.8 : ev.v;
  const ns = ev.ns && ev.ns.length ? ev.ns : [72];
  switch (name) {
    case 'pad':
      synth.pad(ctx, dest, time, { midis: ns, dur, vel, ...(song.padCfg || {}) });
      break;
    case 'bass':
      synth.bass(ctx, dest, time, { midi: ns[0], dur, vel, ...(song.bassCfg || {}) });
      break;
    case 'pluck':
      synth.pluck(ctx, dest, time, { midi: ns[0], dur, vel, ...(song.arpCfg || {}) });
      break;
    case 'flute':
      synth.flute(ctx, dest, time, { midi: ns[0], dur, vel, ...(song.leadCfg || {}) });
      break;
    case 'bell':
      synth.bell(ctx, dest, time, { midi: ns[0], dur, vel, ...(song.leadCfg || {}) });
      break;
    case 'lead':
    default:
      synth.lead(ctx, dest, time, { midi: ns[0], dur, vel, ...(song.leadCfg || {}) });
      break;
  }
}

// Programa un único paso de la canción en `time`.
export function scheduleStep(graph, song, step, time, secPerStep, opts = {}) {
  const ctx = graph.context;
  const dest = opts.output || graph.music;
  const voices = song.voices || {};
  const parts = song.parts || {};

  for (const key of PART_ORDER) {
    const part = parts[key];
    if (!part) continue;
    const ev = part[step];
    if (!ev) continue;
    playVoice(voices[key] || key, ctx, dest, time, ev, secPerStep, song);
  }

  const drums = song.drums;
  if (drums) {
    for (const name of DRUM_ORDER) {
      const arr = drums[name];
      if (!arr) continue;
      const v = arr[step];
      if (!v) continue;
      if (name === 'kick') synth.kick(ctx, dest, time, { vel: v });
      else if (name === 'snare') synth.snare(ctx, dest, time, { vel: v });
      else if (name === 'hat') synth.hat(ctx, dest, time, { vel: v, open: v > 0.5 && !!(drums.openHat && drums.openHat[step]) });
      else if (name === 'tom') synth.tom(ctx, dest, time, { vel: v, midi: drums.tomPitch || 55 });
      else if (name === 'crash') synth.crash(ctx, dest, time, { vel: v });
    }
  }
}

export function secPerStepFor(song, tempoScale = 1) {
  const base = 60 / song.bpm / (song.stepsPerBeat || 4);
  return base / (tempoScale || 1);
}

// ---------------------------------------------------------------
// Secuenciador en vivo.
// ---------------------------------------------------------------
export function createSequencer({ graph, song, output }) {
  const ctx = graph.context;
  const stepsPerBar = (song.stepsPerBeat || 4) * 4;
  let running = false;
  let timer = null;
  let nextStep = 0;
  let nextTime = 0;
  let tempoScale = 1;
  let pendingTempo = null;
  const out = output || graph.music;

  function tick() {
    if (!running) return;
    const now = ctx.currentTime;
    const horizon = now + SCHEDULE_WINDOW;
    let guard = 0;
    while (nextTime < horizon && guard < 512) {
      const secPerStep = secPerStepFor(song, tempoScale);
      scheduleStep(graph, song, nextStep, nextTime, secPerStep, { output: out });
      nextTime += secPerStep;
      nextStep += 1;
      if (nextStep >= song.loopSteps) nextStep = 0;
      if (nextStep % stepsPerBar === 0 && pendingTempo != null) {
        tempoScale = pendingTempo;
        pendingTempo = null;
      }
      guard += 1;
    }
  }

  function start(when = 0.06) {
    if (running) return;
    running = true;
    nextStep = 0;
    nextTime = ctx.currentTime + when;
    tick();
    timer = setInterval(tick, LOOKAHEAD_MS);
  }

  function stop() {
    running = false;
    if (timer != null) {
      clearInterval(timer);
      timer = null;
    }
  }

  // Cambio de tempo suave: se aplica al llegar al siguiente compás.
  function setTempoScale(scale) {
    const s = scale > 0 ? scale : 1;
    if (s === tempoScale) return;
    pendingTempo = s;
  }

  return {
    start,
    stop,
    setTempoScale,
    isRunning: () => running,
    getTempoScale: () => tempoScale,
  };
}

// ---------------------------------------------------------------
// Planificación offline: programa `seconds` segundos de la canción.
// ---------------------------------------------------------------
export function scheduleRange(graph, song, seconds, opts = {}) {
  const startTime = opts.startTime == null ? 0.05 : opts.startTime;
  const secPerStep = secPerStepFor(song, 1);
  const steps = Math.ceil(seconds / secPerStep) + 1;
  const out = opts.output || graph.music;
  for (let i = 0; i < steps; i++) {
    const time = startTime + i * secPerStep;
    scheduleStep(graph, song, i % song.loopSteps, time, secPerStep, { output: out });
  }
  return secPerStep * steps;
}
