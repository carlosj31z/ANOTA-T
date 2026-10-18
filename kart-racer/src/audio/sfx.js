// BLOQUE 5 — Audio. Efectos de sonido sintetizados (Web Audio API).
// playSfx(name) y por eventos. Incluye bucles (derrape, ruleta).

import * as synth from './synth.js';
import { getNoiseBuffer } from './synth.js';
import { clamp01 } from './engine.js';

// Ruido a través de un filtro con envolvente, para golpes/explosiones/thunder.
function noiseBurst(ctx, dest, time, opts = {}) {
  const {
    type = 'highpass',
    freq = 1200,
    freqEnd = null,
    q = 0.8,
    attack = 0.001,
    decay = 0.25,
    gain = 0.4,
    loop = false,
    stop,
  } = opts;
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx);
  src.loop = loop;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, time);
  f.Q.value = q;
  if (freqEnd != null) f.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), time + decay);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), time + Math.max(0.0008, attack));
  g.gain.exponentialRampToValueAtTime(0.0001, time + decay);
  src.connect(f);
  f.connect(g);
  g.connect(dest);
  src.start(time);
  src.stop(time + (stop || decay + 0.05));
  return { src, filter: f, gain: g };
}

// Barrido de tono (subida o bajada) con envolvente.
function sweep(ctx, dest, time, opts = {}) {
  const {
    wave = 'sawtooth',
    from = 200,
    to = 1200,
    dur = 0.25,
    gain = 0.35,
    attack = 0.005,
    filter = null,
    filterTo = null,
  } = opts;
  const osc = ctx.createOscillator();
  osc.type = wave;
  osc.frequency.setValueAtTime(Math.max(20, from), time);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), time + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), time + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  let node = osc;
  if (filter) {
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(from * 2, time);
    if (filterTo != null) f.frequency.exponentialRampToValueAtTime(Math.max(60, filterTo), time + dur);
    f.Q.value = 4;
    osc.connect(f);
    node = f;
  }
  node.connect(g);
  g.connect(dest);
  osc.start(time);
  osc.stop(time + dur + 0.05);
}

// Secuencia de notas (arpegios, fanfarrias).
function sequence(ctx, dest, time, notes, opts = {}) {
  const { step = 0.09, dur = 0.12, vel = 0.6, wave = 'square', voice = 'pluck' } = opts;
  notes.forEach((midi, i) => {
    const t = time + i * step;
    if (voice === 'bell') synth.bell(ctx, dest, t, { midi, dur: dur * 1.6, vel });
    else if (voice === 'lead') synth.lead(ctx, dest, t, { midi, dur, vel, wave });
    else synth.pluck(ctx, dest, t, { midi, dur, vel, wave });
  });
}

// ---------------------------------------------------------------
// Definiciones de efectos. (ctx, dest, time, opts)
// ---------------------------------------------------------------
const SFX = {
  'menu-move': (ctx, d, t) => synth.pluck(ctx, d, t, { midi: 88, dur: 0.06, vel: 0.5, wave: 'square' }),
  'menu-select': (ctx, d, t) => sequence(ctx, d, t, [84, 91, 96], { step: 0.05, dur: 0.08, vel: 0.55, wave: 'square' }),
  'menu-back': (ctx, d, t) => sequence(ctx, d, t, [91, 84, 79], { step: 0.05, dur: 0.09, vel: 0.5, wave: 'square' }),

  countdown: (ctx, d, t) => synth.lead(ctx, d, t, { midi: 79, dur: 0.12, vel: 0.6, wave: 'square', vib: 0, cutoff: 4000 }),
  go: (ctx, d, t) => {
    synth.lead(ctx, d, t, { midi: 91, dur: 0.5, vel: 0.7, wave: 'square', vib: 0, cutoff: 5000 });
    synth.lead(ctx, d, t, { midi: 84, dur: 0.5, vel: 0.5, wave: 'triangle', vib: 0 });
  },

  'item-box': (ctx, d, t) => {
    sequence(ctx, d, t, [84, 88, 91, 96], { step: 0.035, dur: 0.14, vel: 0.55, voice: 'bell' });
    synth.bell(ctx, d, t + 0.14, { midi: 96, dur: 0.4, vel: 0.5 });
  },
  'item-get': (ctx, d, t) => sequence(ctx, d, t, [79, 84, 88, 91], { step: 0.06, dur: 0.15, vel: 0.6, voice: 'bell' }),

  turbo: (ctx, d, t) => {
    sweep(ctx, d, t, { wave: 'sawtooth', from: 180, to: 1400, dur: 0.45, gain: 0.28, filter: 'lowpass', filterTo: 4000 });
    noiseBurst(ctx, d, t, { type: 'bandpass', freq: 600, freqEnd: 4000, decay: 0.4, gain: 0.18, q: 1.2 });
  },

  'drift-level': (ctx, d, t, o = {}) => {
    const lvl = Math.max(1, Math.min(3, o.level || 1));
    const midi = [84, 88, 91][lvl - 1];
    synth.lead(ctx, d, t, { midi, dur: 0.1, vel: 0.55, wave: 'square', vib: 0 });
    synth.lead(ctx, d, t + 0.06, { midi: midi + 4, dur: 0.22, vel: 0.6, wave: 'square', vib: 0 });
  },
  'mini-turbo': (ctx, d, t) => {
    sweep(ctx, d, t, { wave: 'sawtooth', from: 260, to: 900, dur: 0.25, gain: 0.24 });
    synth.pluck(ctx, d, t + 0.2, { midi: 96, dur: 0.2, vel: 0.6, wave: 'square' });
  },
  'boost-pad': (ctx, d, t) => {
    sweep(ctx, d, t, { wave: 'square', from: 300, to: 1200, dur: 0.3, gain: 0.24 });
    noiseBurst(ctx, d, t, { type: 'highpass', freq: 1500, freqEnd: 6000, decay: 0.35, gain: 0.16 });
  },

  hit: (ctx, d, t) => {
    noiseBurst(ctx, d, t, { type: 'bandpass', freq: 2000, decay: 0.14, gain: 0.4, q: 0.8 });
    // "boing" que gira (pitch descendente con vibrato fuerte).
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(420, t);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.42);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 22;
    const lg = ctx.createGain();
    lg.gain.value = 60;
    lfo.connect(lg);
    lg.connect(o.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.38, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    o.connect(g);
    g.connect(d);
    o.start(t);
    lfo.start(t);
    o.stop(t + 0.5);
    lfo.stop(t + 0.5);
  },
  wall: (ctx, d, t, o = {}) => {
    const impact = clamp01(o.impact == null ? 0.6 : o.impact);
    noiseBurst(ctx, d, t, { type: 'lowpass', freq: 700, freqEnd: 120, decay: 0.22, gain: 0.18 + impact * 0.3 });
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.setValueAtTime(180, t);
    o2.frequency.exponentialRampToValueAtTime(60, t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.15 + impact * 0.2, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o2.connect(g);
    g.connect(d);
    o2.start(t);
    o2.stop(t + 0.26);
  },
  bump: (ctx, d, t, o = {}) => noiseBurst(ctx, d, t, { type: 'lowpass', freq: 500, freqEnd: 150, decay: 0.14, gain: 0.16 + clamp01(o.impact == null ? 0.4 : o.impact) * 0.15 }),

  jump: (ctx, d, t) => sweep(ctx, d, t, { wave: 'square', from: 300, to: 720, dur: 0.14, gain: 0.22 }),
  land: (ctx, d, t) => {
    noiseBurst(ctx, d, t, { type: 'lowpass', freq: 400, freqEnd: 120, decay: 0.16, gain: 0.24 });
    sweep(ctx, d, t, { wave: 'sine', from: 160, to: 70, dur: 0.14, gain: 0.2 });
  },

  'peel-drop': (ctx, d, t) => {
    synth.pluck(ctx, d, t, { midi: 60, dur: 0.14, vel: 0.6, wave: 'triangle' });
    synth.pluck(ctx, d, t + 0.1, { midi: 48, dur: 0.18, vel: 0.5, wave: 'triangle' });
  },
  throw: (ctx, d, t) => noiseBurst(ctx, d, t, { type: 'bandpass', freq: 500, freqEnd: 2600, decay: 0.3, gain: 0.22, q: 1.4 }),

  explode: (ctx, d, t, o = {}) => {
    const vol = o.volume == null ? 1 : o.volume;
    noiseBurst(ctx, d, t, { type: 'lowpass', freq: 1800, freqEnd: 80, decay: 0.5, gain: 0.4 * vol });
    sweep(ctx, d, t, { wave: 'sine', from: 160, to: 40, dur: 0.45, gain: 0.4 * vol });
  },

  shield: (ctx, d, t) => sequence(ctx, d, t, [72, 76, 79, 84, 88], { step: 0.055, dur: 0.2, vel: 0.5, voice: 'bell' }),

  storm: (ctx, d, t) => {
    // Trueno: ruido filtrado + retumbo grave.
    noiseBurst(ctx, d, t, { type: 'lowpass', freq: 1200, freqEnd: 100, decay: 1.1, gain: 0.45, attack: 0.02 });
    noiseBurst(ctx, d, t + 0.05, { type: 'bandpass', freq: 300, q: 0.5, decay: 0.9, gain: 0.25 });
    sweep(ctx, d, t, { wave: 'sine', from: 90, to: 35, dur: 0.9, gain: 0.35 });
  },

  lap: (ctx, d, t) => sequence(ctx, d, t, [84, 91], { step: 0.11, dur: 0.28, vel: 0.55, voice: 'bell' }),
  'final-lap': (ctx, d, t) => sequence(ctx, d, t, [84, 88, 91, 96], { step: 0.12, dur: 0.3, vel: 0.6, voice: 'bell' }),
  finish: (ctx, d, t) => {
    sequence(ctx, d, t, [79, 84, 88, 91, 96], { step: 0.12, dur: 0.34, vel: 0.65, voice: 'bell' });
    synth.bell(ctx, d, t + 0.6, { midi: 96, dur: 1.0, vel: 0.6 });
    synth.bell(ctx, d, t + 0.6, { midi: 91, dur: 1.0, vel: 0.5 });
  },

  // Tic corto de la ruleta.
  rouletteTick: (ctx, d, t) => synth.pluck(ctx, d, t, { midi: 96, dur: 0.03, vel: 0.4, wave: 'square' }),
};

export function createSfx(graph) {
  const ctx = graph.context;
  const dest = graph.sfx;
  const loops = new Map();
  let disposed = false;

  function play(name, opts = {}) {
    if (disposed) return;
    const delay = opts.delay || 0;
    const t = ctx.currentTime + delay;
    const fn = SFX[name];
    if (fn) fn(ctx, dest, t, opts);
  }

  function startLoop(name, opts = {}) {
    if (disposed || loops.has(name)) return;
    if (name === 'drift') {
      const src = ctx.createBufferSource();
      src.buffer = getNoiseBuffer(ctx);
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2200;
      bp.Q.value = 2.6;
      const g = ctx.createGain();
      g.gain.value = 0.0001;
      src.connect(bp);
      bp.connect(g);
      g.connect(dest);
      g.gain.setTargetAtTime(0.09, ctx.currentTime, 0.04);
      // Pequeño chirrido tonal.
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 320;
      const og = ctx.createGain();
      og.gain.value = 0.02;
      o.connect(og);
      og.connect(g);
      o.start();
      src.start();
      loops.set(name, {
        stop(fade = 0.12) {
          const now = ctx.currentTime;
          g.gain.setTargetAtTime(0.0001, now, fade / 3);
          try {
            src.stop(now + fade + 0.1);
            o.stop(now + fade + 0.1);
          } catch {
            /* ya detenido */
          }
        },
      });
    } else if (name === 'roulette') {
      let cancelled = false;
      const start = performance.now();
      const tickFn = () => {
        if (cancelled || disposed) return;
        SFX.rouletteTick(ctx, dest, ctx.currentTime);
        const elapsed = (performance.now() - start) / 1000;
        const period = Math.max(0.035, 0.11 - elapsed * 0.03);
        loop.timer = setTimeout(tickFn, period * 1000);
      };
      const loop = { timer: null, stop() { cancelled = true; if (loop.timer) clearTimeout(loop.timer); } };
      loops.set(name, loop);
      tickFn();
    }
  }

  function stopLoop(name) {
    const l = loops.get(name);
    if (!l) return;
    loops.delete(name);
    try {
      l.stop();
    } catch {
      /* ignore */
    }
  }

  function dispose() {
    disposed = true;
    for (const name of [...loops.keys()]) stopLoop(name);
  }

  return { play, startLoop, stopLoop, dispose, hasLoop: (n) => loops.has(n) };
}
