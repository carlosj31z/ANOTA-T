// BLOQUE 5 — Audio. Instrumentos sintetizados (Web Audio API).
// Todos los instrumentos reciben (context, destination, time, params) y
// programan sus nodos de forma absoluta en `time` (segundos del contexto).
// 100 % procedural, melodías/timbres originales.

import { clamp } from './engine.js';

const noiseCache = new WeakMap();

// Buffer de ruido blanco reutilizable por contexto (~2 s).
export function getNoiseBuffer(context) {
  let buf = noiseCache.get(context);
  if (buf) return buf;
  const length = Math.max(1, Math.floor(context.sampleRate * 2));
  buf = context.createBuffer(1, length, context.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  noiseCache.set(context, buf);
  return buf;
}

export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function noiseSource(context, loop = false) {
  const src = context.createBufferSource();
  src.buffer = getNoiseBuffer(context);
  src.loop = loop;
  return src;
}

// Envolvente ADSR suave. Devuelve el instante absoluto de parada seguro.
function applyEnv(param, time, dur, peak, attack, release) {
  const a = clamp(attack, 0.0008, Math.max(0.001, dur * 0.5));
  const p = Math.max(0.0002, peak);
  param.cancelScheduledValues(time);
  param.setValueAtTime(0.0001, time);
  param.exponentialRampToValueAtTime(p, time + a);
  const sustainEnd = time + Math.max(a, dur);
  param.setValueAtTime(p * 0.85, sustainEnd);
  param.exponentialRampToValueAtTime(0.0001, sustainEnd + Math.max(0.02, release));
  return sustainEnd + Math.max(0.02, release);
}

// ---------------------------------------------------------------
// Lead: sawtooth/square con filtro paso-bajo, vibrato y ADSR.
// ---------------------------------------------------------------
export function lead(ctx, dest, time, opts = {}) {
  const { midi = 72, dur = 0.25, vel = 0.85 } = opts;
  const wave = opts.wave || 'sawtooth';
  const cutoff = opts.cutoff || 3200;
  const vib = opts.vib == null ? 5 : opts.vib;
  const vibDepth = opts.vibDepth == null ? 5 : opts.vibDepth;
  const freq = midiToFreq(midi);

  const osc = ctx.createOscillator();
  osc.type = wave;
  osc.frequency.setValueAtTime(freq, time);
  if (opts.detune) osc.detune.value = opts.detune;

  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.setValueAtTime(Math.max(200, cutoff), time);
  filt.Q.value = opts.q == null ? 4 : opts.q;

  const g = ctx.createGain();
  const stopAt = applyEnv(g.gain, time, dur, Math.max(0.001, vel * 0.4), opts.attack ?? 0.01, opts.release ?? 0.12);

  osc.connect(filt);
  filt.connect(g);
  g.connect(dest);

  let lfo = null;
  if (vib > 0 && vibDepth > 0) {
    lfo = ctx.createOscillator();
    lfo.frequency.value = vib;
    const lg = ctx.createGain();
    lg.gain.value = vibDepth;
    lfo.connect(lg);
    lg.connect(osc.frequency);
    lfo.start(time);
  }

  osc.start(time);
  osc.stop(stopAt + 0.05);
  if (lfo) lfo.stop(stopAt + 0.05);
}

// ---------------------------------------------------------------
// Bajo: triangle/square con envolvente de filtro.
// ---------------------------------------------------------------
export function bass(ctx, dest, time, opts = {}) {
  const { midi = 40, dur = 0.3, vel = 0.9 } = opts;
  const wave = opts.wave || 'triangle';
  const cutoff = opts.cutoff || 700;
  const freq = midiToFreq(midi);

  const osc = ctx.createOscillator();
  osc.type = wave;
  osc.frequency.setValueAtTime(freq, time);

  const sub = ctx.createOscillator();
  sub.type = 'square';
  sub.frequency.setValueAtTime(freq / 2, time);
  const subG = ctx.createGain();
  subG.gain.value = 0.3;

  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.Q.value = 6;
  filt.frequency.setValueAtTime(Math.min(4000, cutoff * 3.5), time);
  filt.frequency.exponentialRampToValueAtTime(Math.max(120, cutoff), time + Math.min(0.28, dur + 0.05));

  const g = ctx.createGain();
  const stopAt = applyEnv(g.gain, time, dur, Math.max(0.001, vel * 0.5), 0.006, 0.09);

  osc.connect(filt);
  sub.connect(subG);
  subG.connect(filt);
  filt.connect(g);
  g.connect(dest);

  osc.start(time);
  sub.start(time);
  osc.stop(stopAt + 0.05);
  sub.stop(stopAt + 0.05);
}

// ---------------------------------------------------------------
// Pad: varios osciladores desafinados, ataque/release lentos.
// ---------------------------------------------------------------
export function pad(ctx, dest, time, opts = {}) {
  const midis = opts.midis && opts.midis.length ? opts.midis : [60, 63, 67];
  const dur = opts.dur || 1.6;
  const vel = opts.vel == null ? 0.5 : opts.vel;
  const detune = opts.detune == null ? 8 : opts.detune;

  const g = ctx.createGain();
  const stopAt = applyEnv(g.gain, time, dur, Math.max(0.001, vel * 0.15), opts.attack ?? 0.5, opts.release ?? 1.0);

  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = opts.cutoff || 2200;
  filt.Q.value = 1.5;
  filt.connect(g);
  g.connect(dest);

  const count = Math.max(1, midis.length * 2);
  for (const m of midis) {
    for (const d of [-detune, detune]) {
      const o = ctx.createOscillator();
      o.type = opts.wave || 'sawtooth';
      o.frequency.value = midiToFreq(m);
      o.detune.value = d + (opts.spread ? (Math.random() * 2 - 1) * opts.spread : 0);
      const og = ctx.createGain();
      og.gain.value = 1 / count;
      o.connect(og);
      og.connect(filt);
      o.start(time);
      o.stop(stopAt + 0.1);
    }
  }
}

// ---------------------------------------------------------------
// Bell: FM cristalino (campanitas). Original.
// ---------------------------------------------------------------
export function bell(ctx, dest, time, opts = {}) {
  const { midi = 84, dur = 0.5, vel = 0.7 } = opts;
  const freq = midiToFreq(midi);

  const car = ctx.createOscillator();
  car.type = 'sine';
  car.frequency.setValueAtTime(freq, time);

  const mod = ctx.createOscillator();
  mod.type = 'sine';
  mod.frequency.setValueAtTime(freq * (opts.ratio || 2.76), time);
  const modG = ctx.createGain();
  const hi = Math.max(0.001, freq * (opts.index || 3));
  modG.gain.setValueAtTime(hi, time);
  modG.gain.exponentialRampToValueAtTime(Math.max(0.001, freq * 0.15), time + Math.max(0.15, dur));
  mod.connect(modG);
  modG.connect(car.frequency);

  const g = ctx.createGain();
  const stopAt = applyEnv(g.gain, time, dur, Math.max(0.001, vel * 0.4), 0.005, opts.release ?? 0.7);

  car.connect(g);
  g.connect(dest);

  car.start(time);
  mod.start(time);
  car.stop(stopAt + 0.1);
  mod.stop(stopAt + 0.1);
}

// ---------------------------------------------------------------
// Flute: tono puro con vibrato y un soplo de ruido.
// ---------------------------------------------------------------
export function flute(ctx, dest, time, opts = {}) {
  const { midi = 76, dur = 0.4, vel = 0.7 } = opts;
  const freq = midiToFreq(midi);

  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, time);

  const lfo = ctx.createOscillator();
  lfo.frequency.value = 5.5;
  const lg = ctx.createGain();
  lg.gain.value = opts.vibDepth == null ? 4 : opts.vibDepth;
  lfo.connect(lg);
  lg.connect(osc.frequency);

  const breath = noiseSource(ctx);
  const bf = ctx.createBiquadFilter();
  bf.type = 'bandpass';
  bf.frequency.value = freq * 2;
  bf.Q.value = 1.1;
  const bg = ctx.createGain();
  bg.gain.value = 0.05;

  const g = ctx.createGain();
  const stopAt = applyEnv(g.gain, time, dur, Math.max(0.001, vel * 0.38), 0.07, 0.14);

  osc.connect(g);
  breath.connect(bf);
  bf.connect(bg);
  bg.connect(g);
  g.connect(dest);

  osc.start(time);
  breath.start(time);
  lfo.start(time);
  osc.stop(stopAt + 0.1);
  breath.stop(stopAt + 0.1);
  lfo.stop(stopAt + 0.1);
}

// ---------------------------------------------------------------
// Pluck: nota corta tipo arpegio.
// ---------------------------------------------------------------
export function pluck(ctx, dest, time, opts = {}) {
  const { midi = 72, dur = 0.18, vel = 0.6 } = opts;
  const freq = midiToFreq(midi);

  const osc = ctx.createOscillator();
  osc.type = opts.wave || 'square';
  osc.frequency.setValueAtTime(freq, time);

  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.setValueAtTime(Math.max(600, freq * 6), time);
  filt.frequency.exponentialRampToValueAtTime(Math.max(200, freq * 1.4), time + 0.18);

  const g = ctx.createGain();
  const stopAt = applyEnv(g.gain, time, Math.min(dur, 0.22), Math.max(0.001, vel * 0.28), 0.004, 0.18);

  osc.connect(filt);
  filt.connect(g);
  g.connect(dest);
  osc.start(time);
  osc.stop(stopAt + 0.05);
}

// ---------------------------------------------------------------
// Batería sintetizada.
// ---------------------------------------------------------------
export function kick(ctx, dest, time, opts = {}) {
  const vel = opts.vel == null ? 1 : opts.vel;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, time);
  osc.frequency.exponentialRampToValueAtTime(45, time + 0.12);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, vel * 0.9), time + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.3);
  osc.connect(g);
  g.connect(dest);
  osc.start(time);
  osc.stop(time + 0.34);
}

export function snare(ctx, dest, time, opts = {}) {
  const vel = opts.vel == null ? 0.8 : opts.vel;
  const n = noiseSource(ctx);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 1400;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(Math.max(0.001, vel * 0.5), time);
  ng.gain.exponentialRampToValueAtTime(0.0001, time + 0.19);
  n.connect(hp);
  hp.connect(ng);
  ng.connect(dest);
  n.start(time);
  n.stop(time + 0.22);

  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = 190;
  const og = ctx.createGain();
  og.gain.setValueAtTime(Math.max(0.001, vel * 0.28), time);
  og.gain.exponentialRampToValueAtTime(0.0001, time + 0.1);
  osc.connect(og);
  og.connect(dest);
  osc.start(time);
  osc.stop(time + 0.12);
}

export function hat(ctx, dest, time, opts = {}) {
  const vel = opts.vel == null ? 0.4 : opts.vel;
  const decay = opts.open ? 0.26 : 0.05;
  const n = noiseSource(ctx);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 7000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(Math.max(0.001, vel * 0.32), time);
  g.gain.exponentialRampToValueAtTime(0.0001, time + decay);
  n.connect(hp);
  hp.connect(g);
  g.connect(dest);
  n.start(time);
  n.stop(time + decay + 0.03);
}

export function tom(ctx, dest, time, opts = {}) {
  const vel = opts.vel == null ? 0.7 : opts.vel;
  const freq = midiToFreq(opts.midi == null ? 55 : opts.midi);
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq * 1.7, time);
  osc.frequency.exponentialRampToValueAtTime(freq, time + 0.1);
  const g = ctx.createGain();
  g.gain.setValueAtTime(Math.max(0.001, vel * 0.5), time);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.32);
  osc.connect(g);
  g.connect(dest);
  osc.start(time);
  osc.stop(time + 0.36);
}

export function crash(ctx, dest, time, opts = {}) {
  const vel = opts.vel == null ? 0.6 : opts.vel;
  const n = noiseSource(ctx);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 5000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(Math.max(0.001, vel * 0.4), time);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 1.2);
  n.connect(hp);
  hp.connect(g);
  g.connect(dest);
  n.start(time);
  n.stop(time + 1.3);
}

// Timbales afinados (para tom melódico en desierto).
export function tunedTom(ctx, dest, time, midi, vel = 0.7) {
  tom(ctx, dest, time, { midi, vel });
}
