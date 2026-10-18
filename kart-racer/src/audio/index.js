// BLOQUE 5 — Audio. API pública del sistema de audio (contrato §4.5).
// Todo sintetizado con Web Audio API: canciones originales, efectos, motor.
// Seguro antes de unlock(): no crea AudioContext y ningún método lanza.

import { EVENTS } from '../shared/constants.js';
import { createAudioGraph, clamp01 } from './engine.js';
import { getSong, SONG_IDS } from './songs.js';
import { createSequencer, scheduleRange, secPerStepFor } from './sequencer.js';
import { createSfx } from './sfx.js';
import { createMotor } from './motor.js';

const CROSSFADE = 0.6;

const ITEM_SFX = {
  turbo: 'turbo',
  peel: 'peel-drop',
  bouncer: 'throw',
  seeker: 'throw',
  shield: 'shield',
  storm: 'storm',
};

export function createAudio(options = {}) {
  let context = null;
  let graph = null;
  let sfx = null;
  let motor = null;
  let masterVolume = typeof options.masterVolume === 'number' ? options.masterVolume : 0.8;
  let pendingMusic = null;
  let current = null; // { id, seq, gain }
  let engineState = { ratio: 0, boosting: false, active: false };
  let bound = false;
  let musicFast = false;

  // ---------------------------------------------------------------
  // Ciclo de vida / desbloqueo
  // ---------------------------------------------------------------
  function unlock() {
    if (context) {
      if (context.state === 'suspended') context.resume().catch(() => {});
      return;
    }
    const Ctor =
      (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) || null;
    if (!Ctor) return; // headless sin audio: seguir en silencio, sin errores
    try {
      context = new Ctor();
    } catch {
      context = null;
      return;
    }
    try {
      graph = createAudioGraph(context, { masterVolume });
      sfx = createSfx(graph);
      motor = createMotor(graph);
    } catch {
      graph = null;
      sfx = null;
      motor = null;
      return;
    }
    if (context.state === 'suspended') context.resume().catch(() => {});
    motor.set(engineState.ratio, engineState.boosting, engineState.active);
    if (pendingMusic) {
      const id = pendingMusic;
      pendingMusic = null;
      startMusic(id);
    }
  }

  // ---------------------------------------------------------------
  // Música
  // ---------------------------------------------------------------
  function playMusic(id) {
    if (!id) return;
    pendingMusic = id;
    if (!graph) return;
    if (current && current.id === id) {
      pendingMusic = null; // no reiniciar la misma canción
      return;
    }
    startMusic(id);
  }

  function startMusic(id) {
    const song = getSong(id);
    if (!song || !context) return;
    const gain = context.createGain();
    gain.gain.value = 0.0001;
    gain.connect(graph.music);

    const seq = createSequencer({ graph, song, output: gain });
    if (musicFast) seq.setTempoScale(1.15);
    seq.start();

    const now = context.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(1, now + CROSSFADE);

    const prev = current;
    current = { id, seq, gain };
    if (prev && prev !== current) {
      const pg = prev.gain.gain;
      pg.cancelScheduledValues(now);
      pg.setValueAtTime(Math.max(0.0001, pg.value), now);
      pg.linearRampToValueAtTime(0.0001, now + CROSSFADE);
      const pseq = prev.seq;
      const pgain = prev.gain;
      setTimeout(() => {
        try {
          pseq.stop();
        } catch {
          /* ignore */
        }
        try {
          pgain.disconnect();
        } catch {
          /* ignore */
        }
      }, CROSSFADE * 1000 + 150);
    }
  }

  function stopMusic() {
    pendingMusic = null;
    if (!current || !context) {
      current = null;
      return;
    }
    const prev = current;
    current = null;
    const now = context.currentTime;
    prev.gain.gain.cancelScheduledValues(now);
    prev.gain.gain.setValueAtTime(Math.max(0.0001, prev.gain.gain.value), now);
    prev.gain.gain.linearRampToValueAtTime(0.0001, now + CROSSFADE);
    const pseq = prev.seq;
    const pgain = prev.gain;
    setTimeout(() => {
      try {
        pseq.stop();
      } catch {
        /* ignore */
      }
      try {
        pgain.disconnect();
      } catch {
        /* ignore */
      }
    }, CROSSFADE * 1000 + 150);
  }

  function setMusicFast(fast) {
    musicFast = !!fast;
    if (current && current.seq) current.seq.setTempoScale(musicFast ? 1.15 : 1);
  }

  // ---------------------------------------------------------------
  // Efectos
  // ---------------------------------------------------------------
  function playSfx(name, opts = {}) {
    if (!sfx) return;
    if (name === 'drift' || name === 'roulette') {
      sfx.startLoop(name, opts);
      return;
    }
    sfx.play(name, opts);
  }

  function stopSfx(name) {
    if (sfx) sfx.stopLoop(name);
  }

  function bindEvents(events) {
    if (!events || !events.on || bound) return;
    bound = true;
    const on = events.on;

    // Globales (no dependen del jugador).
    on(EVENTS.COUNTDOWN, (p) => {
      if (!p) return;
      playSfx(p.n > 0 ? 'countdown' : 'go');
    });
    on(EVENTS.ITEM_EXPLODE, () => playSfx('explode', { volume: 0.5 }));
    on(EVENTS.STATE_CHANGE, () => {}); // sin sonido

    // Solo el kart del jugador.
    const isPlayer = (p) => !!(p && p.kart && p.kart.isPlayer);

    on(EVENTS.DRIFT_START, (p) => {
      if (isPlayer(p)) startLoopSafe('drift');
    });
    on(EVENTS.DRIFT_END, (p) => {
      if (isPlayer(p)) stopSfx('drift');
    });
    on(EVENTS.DRIFT_LEVEL, (p) => {
      if (isPlayer(p)) playSfx('drift-level', { level: p.level });
    });
    on(EVENTS.ITEM_BOX, (p) => {
      if (isPlayer(p)) {
        playSfx('item-box');
        startLoopSafe('roulette');
      }
    });
    on(EVENTS.ITEM_GOT, (p) => {
      if (isPlayer(p)) {
        stopSfx('roulette');
        playSfx('item-get');
      }
    });
    on(EVENTS.ITEM_USE, (p) => {
      if (isPlayer(p)) playSfx(ITEM_SFX[p.itemId] || 'throw');
    });
    on(EVENTS.BOOST, (p) => {
      if (!isPlayer(p)) return;
      if (p.source === 'pad') playSfx('boost-pad');
      else if (p.source === 'drift') playSfx('mini-turbo');
      else playSfx('turbo');
    });
    on(EVENTS.LAP, (p) => {
      if (isPlayer(p)) playSfx(p.isFinal ? 'final-lap' : 'lap');
    });
    on(EVENTS.FINISH, (p) => {
      if (isPlayer(p)) playSfx('finish');
    });
    on(EVENTS.HIT, (p) => {
      if (isPlayer(p)) playSfx('hit');
    });
    on(EVENTS.WALL, (p) => {
      if (isPlayer(p)) playSfx('wall', { impact: p.impact });
    });
    on(EVENTS.BUMP, (p) => {
      if (p && ((p.a && p.a.isPlayer) || (p.b && p.b.isPlayer))) playSfx('bump');
    });
    on(EVENTS.JUMP, (p) => {
      if (isPlayer(p)) playSfx('jump');
    });
    on(EVENTS.LAND, (p) => {
      if (isPlayer(p)) playSfx('land');
    });
  }

  function startLoopSafe(name) {
    if (sfx) sfx.startLoop(name);
  }

  // ---------------------------------------------------------------
  // Motor
  // ---------------------------------------------------------------
  function setEngine(speedRatio, boosting, active) {
    engineState = {
      ratio: typeof speedRatio === 'number' ? speedRatio : 0,
      boosting: !!boosting,
      active: !!active,
    };
    if (motor) motor.set(engineState.ratio, engineState.boosting, engineState.active);
  }

  // ---------------------------------------------------------------
  // Volumen maestro
  // ---------------------------------------------------------------
  function setMasterVolume(v) {
    masterVolume = clamp01(v);
    if (graph && context) {
      graph.master.gain.setTargetAtTime(masterVolume, context.currentTime, 0.05);
    }
  }

  return {
    // Contrato §4.5
    unlock,
    bindEvents,
    playMusic,
    stopMusic,
    setMusicFast,
    playSfx,
    setEngine,
    setMasterVolume,
    // Extras (compatibles con el stub)
    getMusicId: () => (current ? current.id : pendingMusic),
    isMusicFast: () => musicFast,
    getMasterVolume: () => masterVolume,
    isUnlocked: () => !!context,
    _debug: { getGraph: () => graph, getSfx: () => sfx },
  };
}

// ---------------------------------------------------------------
// Render offline de una canción (para pruebas / herramientas).
// Devuelve un Promise<AudioBuffer>. Diseñado para OfflineAudioContext.
// ---------------------------------------------------------------
export async function renderSongOffline(id, seconds = 8, opts = {}) {
  const Ctor =
    typeof window !== 'undefined'
      ? window.OfflineAudioContext || window.webkitOfflineAudioContext
      : null;
  if (!Ctor) throw new Error('OfflineAudioContext no disponible');

  const song = getSong(id);
  if (!song) throw new Error(`Canción desconocida: ${id}`);

  const sampleRate = opts.sampleRate || 44100;
  const frames = Math.max(1, Math.ceil(seconds * sampleRate));
  const ctx = new Ctor(1, frames, sampleRate);
  const graph = createAudioGraph(ctx, { masterVolume: opts.masterVolume == null ? 0.8 : opts.masterVolume });
  scheduleRange(graph, song, seconds, { output: graph.music });
  return ctx.startRendering();
}

// Utilidades expuestas para el reporte/auditoría.
export { SONG_IDS, secPerStepFor };
