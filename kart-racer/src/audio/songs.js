// BLOQUE 5 — Audio. Canciones 100 % originales, generadas por código.
// Cada canción de carrera tiene intro + parte A + parte B (+ C/D): >= 36
// compases de material distinto, en tonalidades y ritmos diferentes.
//
// El "compositor" es determinista (PRNG con semilla): mismo material cada vez,
// pero con melodías, bajos y ritmos coherentes construidos sobre progresiones
// de acordes y motivos melódicos propios.

const STEPS_PER_BEAT = 4;
const STEPS_PER_BAR = STEPS_PER_BEAT * 4;

// --- PRNG determinista (mulberry32) ---
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Escalas (semitonos desde la tónica) ---
const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  doubleHarmonic: [0, 1, 4, 5, 7, 8, 11],
  majorPent: [0, 2, 4, 7, 9],
  minorPent: [0, 3, 5, 7, 10],
};

// --- Acordes (intervalos desde la raíz del acorde) ---
const CH = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dom: [0, 4, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  sus4: [0, 5, 7],
  sus2: [0, 2, 7],
  maj6: [0, 4, 7, 9],
  min6: [0, 3, 7, 9],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  dom7: [0, 4, 7, 10],
  add9: [0, 4, 7, 14],
  min9: [0, 3, 7, 14],
  dom7sus: [0, 5, 7, 10],
  min7b5: [0, 3, 6, 10],
};

function scaleStep(scale, deg) {
  const n = scale.length;
  const oct = Math.floor(deg / n);
  const idx = ((deg % n) + n) % n;
  return oct * 12 + scale[idx];
}

function pcOf(v) {
  return ((v % 12) + 12) % 12;
}

// --- Motivos melódicos por carácter. deg = grado de escala relativo. ---
const MOTIFS = {
  bright: [
    [{ t: 0, d: 1, deg: 0 }, { t: 1, d: 1, deg: 2 }, { t: 2, d: 1, deg: 4 }, { t: 3, d: 1, deg: 2 }, { t: 4, d: 2, deg: 5 }, { t: 6, d: 1, deg: 4 }, { t: 7, d: 1, deg: 2 }, { t: 8, d: 2, deg: 0 }, { t: 10, d: 1, deg: 2 }, { t: 11, d: 1, deg: 4 }, { t: 12, d: 2, deg: 7 }, { t: 14, d: 2, deg: 4 }],
    [{ t: 0, d: 2, deg: 0 }, { t: 2, d: 1, deg: 4 }, { t: 3, d: 1, deg: 5 }, { t: 4, d: 2, deg: 7 }, { t: 6, d: 2, deg: 5 }, { t: 8, d: 2, deg: 4 }, { t: 10, d: 1, deg: 2 }, { t: 11, d: 1, deg: 4 }, { t: 12, d: 4, deg: 0 }],
    [{ t: 0, d: 1, deg: 4 }, { t: 1, d: 1, deg: 5 }, { t: 2, d: 1, deg: 7 }, { t: 3, d: 1, deg: 5 }, { t: 4, d: 1, deg: 4 }, { t: 5, d: 1, deg: 2 }, { t: 6, d: 1, deg: 0 }, { t: 7, d: 1, deg: 2 }, { t: 8, d: 4, deg: 4 }, { t: 12, d: 1, deg: 2 }, { t: 13, d: 1, deg: 4 }, { t: 14, d: 2, deg: 2 }],
    [{ t: 0, d: 3, deg: 7 }, { t: 4, d: 3, deg: 4 }, { t: 8, d: 3, deg: 5 }, { t: 12, d: 4, deg: 0 }],
  ],
  bounce: [
    [{ t: 0, d: 2, deg: 0 }, { t: 3, d: 1, deg: 2 }, { t: 4, d: 2, deg: 4 }, { t: 7, d: 1, deg: 2 }, { t: 8, d: 2, deg: 0 }, { t: 11, d: 1, deg: 4 }, { t: 12, d: 2, deg: 5 }, { t: 15, d: 1, deg: 4 }],
    [{ t: 0, d: 2, deg: 4 }, { t: 2, d: 2, deg: 5 }, { t: 4, d: 2, deg: 7 }, { t: 6, d: 2, deg: 4 }, { t: 8, d: 2, deg: 2 }, { t: 10, d: 2, deg: 4 }, { t: 12, d: 4, deg: 0 }],
    [{ t: 0, d: 1, deg: 0 }, { t: 1, d: 1, deg: 2 }, { t: 2, d: 2, deg: 4 }, { t: 5, d: 1, deg: 2 }, { t: 6, d: 2, deg: 0 }, { t: 9, d: 1, deg: 4 }, { t: 10, d: 2, deg: 5 }, { t: 13, d: 3, deg: 4 }],
  ],
  flowing: [
    [{ t: 0, d: 4, deg: 0 }, { t: 4, d: 4, deg: 4 }, { t: 8, d: 4, deg: 7 }, { t: 12, d: 4, deg: 4 }],
    [{ t: 0, d: 3, deg: 5 }, { t: 3, d: 1, deg: 4 }, { t: 4, d: 3, deg: 2 }, { t: 8, d: 4, deg: 4 }, { t: 12, d: 4, deg: 0 }],
    [{ t: 0, d: 2, deg: 7 }, { t: 2, d: 2, deg: 5 }, { t: 4, d: 2, deg: 4 }, { t: 6, d: 2, deg: 2 }, { t: 8, d: 3, deg: 4 }, { t: 12, d: 4, deg: 0 }],
  ],
  sparse: [
    [{ t: 0, d: 8, deg: 0 }, { t: 8, d: 8, deg: 4 }],
    [{ t: 0, d: 6, deg: 7 }, { t: 8, d: 8, deg: 4 }],
    [{ t: 0, d: 4, deg: 0 }, { t: 6, d: 2, deg: 2 }, { t: 8, d: 8, deg: 4 }],
  ],
  arabic: [
    [{ t: 0, d: 1, deg: 0 }, { t: 1, d: 1, deg: 1 }, { t: 2, d: 2, deg: 4 }, { t: 4, d: 1, deg: 5 }, { t: 5, d: 1, deg: 4 }, { t: 6, d: 2, deg: 1 }, { t: 8, d: 1, deg: 0 }, { t: 9, d: 1, deg: 1 }, { t: 10, d: 2, deg: 4 }, { t: 12, d: 2, deg: 5 }, { t: 14, d: 2, deg: 4 }],
    [{ t: 0, d: 2, deg: 4 }, { t: 2, d: 1, deg: 5 }, { t: 3, d: 1, deg: 4 }, { t: 4, d: 4, deg: 1 }, { t: 8, d: 2, deg: 0 }, { t: 10, d: 1, deg: 1 }, { t: 11, d: 1, deg: 4 }, { t: 12, d: 4, deg: 0 }],
    [{ t: 0, d: 3, deg: 0 }, { t: 3, d: 1, deg: 4 }, { t: 4, d: 3, deg: 5 }, { t: 7, d: 1, deg: 4 }, { t: 8, d: 4, deg: 1 }, { t: 12, d: 2, deg: 4 }, { t: 14, d: 2, deg: 1 }],
  ],
  bell: [
    [{ t: 0, d: 2, deg: 0 }, { t: 2, d: 2, deg: 4 }, { t: 4, d: 2, deg: 7 }, { t: 6, d: 2, deg: 4 }, { t: 8, d: 2, deg: 9 }, { t: 10, d: 2, deg: 7 }, { t: 12, d: 4, deg: 4 }],
    [{ t: 0, d: 4, deg: 7 }, { t: 4, d: 2, deg: 9 }, { t: 6, d: 2, deg: 7 }, { t: 8, d: 4, deg: 4 }, { t: 12, d: 4, deg: 0 }],
    [{ t: 0, d: 2, deg: 4 }, { t: 4, d: 2, deg: 7 }, { t: 8, d: 2, deg: 4 }, { t: 10, d: 2, deg: 2 }, { t: 12, d: 4, deg: 0 }],
  ],
  calm: [
    [{ t: 0, d: 4, deg: 0 }, { t: 4, d: 4, deg: 2 }, { t: 8, d: 4, deg: 4 }, { t: 12, d: 4, deg: 2 }],
    [{ t: 0, d: 6, deg: 4 }, { t: 8, d: 4, deg: 2 }, { t: 12, d: 4, deg: 0 }],
  ],
};

// --- Patrones de bajo: [paso, duración, semitonos desde la raíz del acorde] ---
const BASS_PATTERNS = {
  funk: [[0, 2, 0], [3, 1, 0], [6, 2, 12], [8, 2, 0], [11, 1, 7], [12, 2, 0], [14, 2, 5]],
  root: [[0, 4, 0], [4, 4, 0], [8, 4, 0], [12, 4, 0]],
  drive: [[0, 2, 0], [2, 2, 0], [4, 2, 0], [6, 2, 0], [8, 2, 0], [10, 2, 0], [12, 2, 0], [14, 2, 0]],
  sparse: [[0, 8, 0], [8, 8, 0]],
  arabic: [[0, 2, 0], [2, 1, 0], [3, 1, 1], [4, 2, 0], [6, 2, 0], [8, 2, 7], [10, 1, 0], [11, 1, 1], [12, 2, 0], [14, 2, 0]],
  walk: [[0, 2, 0], [2, 2, 5], [4, 2, 7], [6, 2, 5], [8, 2, 0], [10, 2, 7], [12, 2, 12], [14, 2, 0]],
  bounce: [[0, 1, 0], [2, 1, 0], [4, 2, 0], [6, 1, 0], [8, 1, 0], [10, 1, 12], [12, 2, 7], [14, 2, 0]],
};

// --- Grooves de batería (16 pasos, valores 0..1) ---
const GROOVES = {
  none: { kick: [], snare: [], hat: [] },
  soft: {
    kick: [0.9, 0, 0, 0, 0, 0, 0, 0, 0.7, 0, 0, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 0.7, 0, 0, 0, 0, 0, 0, 0, 0.7, 0, 0, 0],
    hat: [0.28, 0, 0.18, 0, 0.28, 0, 0.18, 0, 0.28, 0, 0.18, 0, 0.28, 0, 0.18, 0],
  },
  pop: {
    kick: [1, 0, 0, 0, 0, 0, 0.85, 0, 0, 0, 0, 0, 0.9, 0, 0, 0],
    snare: [0, 0, 0, 0, 0.8, 0, 0, 0, 0, 0, 0, 0, 0.8, 0, 0, 0],
    hat: [0.4, 0, 0.3, 0, 0.4, 0, 0.3, 0, 0.4, 0, 0.3, 0, 0.4, 0, 0.32, 0],
  },
  drive: {
    kick: [1, 0, 0, 0.6, 0, 0, 0.9, 0, 0, 0, 0.8, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 0.8, 0, 0, 0, 0, 0, 0, 0, 0.8, 0, 0, 0.4],
    hat: [0.4, 0.15, 0.34, 0.15, 0.4, 0.15, 0.34, 0.15, 0.4, 0.15, 0.34, 0.15, 0.4, 0.15, 0.34, 0.15],
  },
  toms: {
    kick: [0.9, 0, 0, 0, 0, 0, 0.7, 0, 0, 0, 0.8, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 0.7, 0, 0, 0, 0, 0, 0, 0, 0.7, 0, 0.3, 0],
    hat: [0.24, 0, 0.24, 0, 0.24, 0, 0.24, 0, 0.24, 0, 0.24, 0, 0.24, 0, 0.24, 0.3],
    tom: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5, 0.6, 0.7],
  },
  funk: {
    kick: [1, 0, 0, 0, 0, 0, 0.9, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 0.8, 0, 0, 0.3, 0, 0, 0, 0, 0.8, 0, 0, 0],
    hat: [0.4, 0.12, 0.4, 0.12, 0.4, 0.12, 0.4, 0.12, 0.4, 0.12, 0.4, 0.12, 0.4, 0.3, 0.4, 0.3],
  },
  halftime: {
    kick: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.8, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 0, 0, 0, 0, 0.8, 0, 0, 0, 0, 0, 0, 0],
    hat: [0.3, 0, 0.22, 0, 0.3, 0, 0.22, 0, 0.3, 0, 0.22, 0, 0.3, 0.22, 0.22, 0.3],
  },
  arabic: {
    kick: [1, 0, 0, 0.6, 0, 0, 0.8, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 0.7, 0, 0, 0, 0, 0, 0, 0, 0.7, 0, 0.3, 0.4],
    hat: [0.34, 0.14, 0.34, 0.14, 0.34, 0.14, 0.34, 0.14, 0.34, 0.14, 0.34, 0.14, 0.34, 0.14, 0.34, 0.14],
    tom: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.4, 0.5],
  },
};

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

function chooseBase(motif, chordPcs, scale) {
  const firstDeg = motif[0].deg;
  const order = [0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5, 6, -6, 7];
  for (const b of order) {
    if (chordPcs.includes(pcOf(scaleStep(scale, firstDeg + b)))) return b;
  }
  return 0;
}

function clampMidi(m, lo, hi) {
  while (m < lo) m += 12;
  while (m > hi) m -= 12;
  return m;
}

// --- Generadores por parte ---
function genLead(rng, sec, spec) {
  const len = sec.bars * STEPS_PER_BAR;
  const out = new Array(len).fill(null);
  const scale = SCALES[sec.scale || spec.scale];
  const tonic = spec.tonic;
  const oct = sec.leadOct || 12;
  for (let bar = 0; bar < sec.bars; bar++) {
    const ch = sec.chords[bar];
    const tones = CH[ch.kind].map((i) => i + ch.off);
    const pcs = tones.map(pcOf);
    let motif;
    if (sec.leadNotes) {
      motif = sec.leadNotes;
    } else {
      const set = MOTIFS[sec.lead] || MOTIFS.bright;
      motif = pick(rng, set);
    }
    const base = chooseBase(motif, pcs, scale);
    for (const ev of motif) {
      const step = bar * STEPS_PER_BAR + ev.t;
      if (step >= len) continue;
      const midi = clampMidi(tonic + oct + scaleStep(scale, ev.deg + base), 55, 98);
      out[step] = { ns: [midi], d: Math.max(1, ev.d || 1), v: ev.v == null ? 0.85 : ev.v };
    }
  }
  return out;
}

function genBass(rng, sec, spec) {
  const len = sec.bars * STEPS_PER_BAR;
  const out = new Array(len).fill(null);
  const pattern = BASS_PATTERNS[sec.bass] || BASS_PATTERNS.root;
  for (let bar = 0; bar < sec.bars; bar++) {
    const ch = sec.chords[bar];
    for (const [t, d, semi] of pattern) {
      const step = bar * STEPS_PER_BAR + t;
      if (step >= len) continue;
      const midi = clampMidi(spec.tonic + ch.off - 12 + semi, 28, 55);
      out[step] = { ns: [midi], d: d, v: 0.9 };
    }
  }
  return out;
}

function genArp(rng, sec, spec) {
  const len = sec.bars * STEPS_PER_BAR;
  const out = new Array(len).fill(null);
  const density = sec.arp || 8; // pasos entre notas
  const oct = sec.arpOct || 12;
  const upDown = sec.arpUp !== false;
  for (let bar = 0; bar < sec.bars; bar++) {
    const ch = sec.chords[bar];
    const tones = CH[ch.kind].map((i) => i + ch.off);
    const seq = [];
    for (const t of tones) seq.push(t);
    if (upDown) for (let i = tones.length - 2; i > 0; i--) seq.push(tones[i]);
    let k = 0;
    for (let s = 0; s < STEPS_PER_BAR; s += density) {
      const step = bar * STEPS_PER_BAR + s;
      if (step >= len) break;
      const semi = seq[k % seq.length];
      k += 1;
      const midi = clampMidi(spec.tonic + oct + semi, 60, 100);
      out[step] = { ns: [midi], d: Math.max(1, density - 1), v: 0.5 };
    }
  }
  return out;
}

function genPad(rng, sec, spec) {
  const len = sec.bars * STEPS_PER_BAR;
  const out = new Array(len).fill(null);
  for (let bar = 0; bar < sec.bars; bar++) {
    const ch = sec.chords[bar];
    const tones = CH[ch.kind].map((i) => i + ch.off);
    const notes = [spec.tonic + ch.off - 12];
    for (const t of tones) notes.push(spec.tonic + t);
    notes.push(spec.tonic + tones[0] + 12);
    out[bar * STEPS_PER_BAR] = { ns: notes, d: STEPS_PER_BAR, v: sec.padVel == null ? 0.5 : sec.padVel };
  }
  return out;
}

function genDrums(rng, sec) {
  const len = sec.bars * STEPS_PER_BAR;
  const d = {
    kick: new Array(len).fill(0),
    snare: new Array(len).fill(0),
    hat: new Array(len).fill(0),
    tom: new Array(len).fill(0),
    crash: new Array(len).fill(0),
    openHat: new Array(len).fill(0),
  };
  const g = GROOVES[sec.drums] || GROOVES.none;
  for (let bar = 0; bar < sec.bars; bar++) {
    const off = bar * STEPS_PER_BAR;
    for (let s = 0; s < STEPS_PER_BAR; s++) {
      d.kick[off + s] = (g.kick && g.kick[s]) || 0;
      d.snare[off + s] = (g.snare && g.snare[s]) || 0;
      const hv = (g.hat && g.hat[s]) || 0;
      d.hat[off + s] = hv ? hv * (0.85 + 0.3 * rng()) : 0;
      d.tom[off + s] = (g.tom && g.tom[s]) || 0;
    }
    // Fill al final del bloque: toms ascendentes.
    if (sec.fill && bar === sec.bars - 1) {
      d.tom[off + 12] = 0.55;
      d.tom[off + 13] = 0.65;
      d.tom[off + 14] = 0.75;
      d.tom[off + 15] = 0.9;
      d.snare[off + 15] = Math.max(d.snare[off + 15], 0.45);
    }
  }
  if (sec.crash) d.crash[0] = 0.85;
  return d;
}

function genSection(rng, sec, spec) {
  return {
    bars: sec.bars,
    lead: sec.lead ? genLead(rng, sec, spec) : null,
    bass: sec.bass ? genBass(rng, sec, spec) : null,
    arp: sec.arp ? genArp(rng, sec, spec) : null,
    pad: sec.pad ? genPad(rng, sec, spec) : null,
    drums: genDrums(rng, sec),
  };
}

function buildSong(spec) {
  const rng = mulberry32(spec.seed || 1);
  const sections = new Map();
  for (const sec of spec.sections) sections.set(sec.name, genSection(rng, sec, spec));

  let loopSteps = 0;
  for (const name of spec.arrangement) {
    const sd = sections.get(name);
    if (sd) loopSteps += sd.bars * STEPS_PER_BAR;
  }

  const parts = {
    pad: new Array(loopSteps).fill(null),
    arp: new Array(loopSteps).fill(null),
    bass: new Array(loopSteps).fill(null),
    lead: new Array(loopSteps).fill(null),
  };
  const drums = {
    kick: new Array(loopSteps).fill(0),
    snare: new Array(loopSteps).fill(0),
    hat: new Array(loopSteps).fill(0),
    tom: new Array(loopSteps).fill(0),
    crash: new Array(loopSteps).fill(0),
    openHat: new Array(loopSteps).fill(0),
    tomPitch: spec.tomPitch || 55,
  };

  let cursor = 0;
  for (const name of spec.arrangement) {
    const sd = sections.get(name);
    if (!sd) continue;
    const n = sd.bars * STEPS_PER_BAR;
    for (const key of ['pad', 'arp', 'bass', 'lead']) {
      const src = sd[key];
      if (!src) continue;
      for (let i = 0; i < n; i++) {
        const ev = src[i];
        if (ev) parts[key][cursor + i] = ev;
      }
    }
    for (const key of ['kick', 'snare', 'hat', 'tom', 'crash', 'openHat']) {
      const src = sd.drums[key];
      for (let i = 0; i < n; i++) drums[key][cursor + i] = src[i];
    }
    cursor += n;
  }

  return {
    id: spec.id,
    bpm: spec.bpm,
    tonic: spec.tonic,
    scale: spec.scale,
    stepsPerBeat: STEPS_PER_BEAT,
    stepsPerBar: STEPS_PER_BAR,
    loopSteps,
    sections: spec.arrangement.slice(),
    voices: spec.voices || { lead: 'lead', bass: 'bass', arp: 'pluck', pad: 'pad' },
    leadCfg: spec.leadCfg || {},
    bassCfg: spec.bassCfg || {},
    arpCfg: spec.arpCfg || {},
    padCfg: spec.padCfg || {},
    parts,
    drums,
  };
}

// ---------------------------------------------------------------
// Especificaciones de las 5 canciones originales.
// ---------------------------------------------------------------
// `prog`: convierte pares [offset, kind] en objetos { off, kind }.
function prog(...list) {
  return list.map((item) => ({ off: item[0], kind: item[1] }));
}

const MENU_SPEC = {
  id: 'menu',
  seed: 101,
  bpm: 118,
  tonic: 60,
  scale: 'major',
  voices: { lead: 'lead', bass: 'bass', arp: 'pluck', pad: 'pad' },
  leadCfg: { wave: 'sawtooth', cutoff: 3400, vib: 5, vibDepth: 4 },
  sections: [
    { name: 'intro', bars: 4, chords: prog([0, 'maj'], [9, 'min'], [5, 'maj'], [7, 'dom']), lead: 'sparse', pad: true, drums: 'none' },
    { name: 'A', bars: 8, chords: prog([0, 'maj'], [9, 'min'], [5, 'maj'], [7, 'dom'], [0, 'maj'], [9, 'min'], [2, 'min'], [7, 'dom']), lead: 'bounce', bass: 'funk', arp: 8, pad: true, drums: 'funk', crash: true },
    { name: 'B', bars: 8, chords: prog([5, 'maj'], [7, 'dom'], [4, 'min'], [9, 'min'], [2, 'min'], [7, 'dom'], [0, 'maj'], [10, 'dom7']), lead: 'bright', bass: 'funk', arp: 8, pad: true, drums: 'funk' },
    { name: 'C', bars: 8, chords: prog([9, 'min'], [5, 'maj'], [0, 'maj'], [7, 'dom'], [9, 'min'], [2, 'min'], [11, 'dim'], [7, 'dom7']), lead: 'flowing', bass: 'walk', pad: true, drums: 'pop' },
    { name: 'D', bars: 8, chords: prog([5, 'maj'], [7, 'dom'], [4, 'min7'], [9, 'min7'], [5, 'maj'], [7, 'dom'], [0, 'maj'], [0, 'maj']), lead: 'bright', bass: 'funk', arp: 4, pad: true, drums: 'funk', crash: true, fill: true },
  ],
  arrangement: ['intro', 'A', 'B', 'A', 'C', 'B'],
};

const MEADOW_SPEC = {
  id: 'meadow',
  seed: 202,
  bpm: 150,
  tonic: 65,
  scale: 'major',
  voices: { lead: 'lead', bass: 'bass', arp: 'pluck', pad: 'pad' },
  leadCfg: { wave: 'square', cutoff: 4200, vib: 6, vibDepth: 5, q: 3 },
  arpCfg: { wave: 'square' },
  sections: [
    { name: 'intro', bars: 4, chords: prog([0, 'maj'], [4, 'min'], [5, 'maj'], [4, 'min']), lead: 'sparse', arp: 8, pad: true, drums: 'none' },
    { name: 'A', bars: 8, chords: prog([0, 'maj'], [5, 'maj'], [7, 'maj'], [9, 'min'], [0, 'maj'], [5, 'maj'], [7, 'maj'], [7, 'dom7']), lead: 'bright', bass: 'drive', arp: 4, pad: true, drums: 'drive', crash: true },
    { name: 'B', bars: 8, chords: prog([9, 'min'], [5, 'maj'], [0, 'maj'], [7, 'maj'], [9, 'min'], [4, 'min'], [5, 'maj'], [7, 'dom7']), lead: 'bounce', bass: 'drive', arp: 4, pad: true, drums: 'drive' },
    { name: 'C', bars: 8, chords: prog([5, 'maj'], [7, 'maj'], [9, 'min'], [4, 'min'], [5, 'maj'], [7, 'maj'], [0, 'maj'], [0, 'maj']), lead: 'bright', bass: 'bounce', arp: 2, pad: true, drums: 'drive' },
    { name: 'D', bars: 8, chords: prog([2, 'min7'], [7, 'dom7'], [0, 'maj'], [9, 'min7'], [5, 'maj'], [4, 'min'], [5, 'maj'], [7, 'dom7']), lead: 'flowing', bass: 'drive', pad: true, drums: 'drive', crash: true, fill: true },
  ],
  arrangement: ['intro', 'A', 'B', 'A', 'C', 'B', 'D'],
};

const DESERT_SPEC = {
  id: 'desert',
  seed: 303,
  bpm: 140,
  tonic: 62, // D
  scale: 'doubleHarmonic',
  voices: { lead: 'flute', bass: 'bass', arp: 'pluck', pad: 'pad' },
  leadCfg: { vibDepth: 5 },
  bassCfg: { wave: 'sawtooth', cutoff: 620 },
  padCfg: { wave: 'triangle', detune: 6, cutoff: 1800 },
  tomPitch: 52,
  sections: [
    { name: 'intro', bars: 4, chords: prog([0, 'min'], [0, 'min'], [10, 'maj'], [0, 'min']), lead: 'sparse', pad: true, drums: 'none' },
    { name: 'A', bars: 8, chords: prog([0, 'min'], [1, 'maj'], [0, 'min'], [7, 'maj'], [8, 'maj'], [1, 'maj'], [0, 'min'], [0, 'min']), lead: 'arabic', bass: 'arabic', arp: 4, pad: true, drums: 'toms', crash: true, leadOct: 12 },
    { name: 'B', bars: 8, chords: prog([8, 'maj'], [10, 'maj'], [0, 'min'], [7, 'maj'], [5, 'min'], [8, 'maj'], [1, 'maj'], [0, 'min']), lead: 'arabic', bass: 'arabic', pad: true, drums: 'arabic', leadOct: 12 },
    { name: 'C', bars: 8, chords: prog([0, 'min'], [5, 'min'], [8, 'maj'], [7, 'maj'], [0, 'min'], [10, 'maj'], [1, 'maj'], [0, 'min']), lead: 'flowing', bass: 'arabic', arp: 8, pad: true, drums: 'toms', leadOct: 12 },
    { name: 'D', bars: 8, chords: prog([1, 'maj'], [8, 'maj'], [7, 'maj'], [1, 'maj'], [0, 'min'], [5, 'min'], [7, 'maj'], [0, 'min']), lead: 'arabic', bass: 'arabic', arp: 8, pad: true, drums: 'arabic', crash: true, fill: true, leadOct: 12 },
  ],
  arrangement: ['intro', 'A', 'B', 'A', 'C', 'D', 'B'],
};

const SNOW_SPEC = {
  id: 'snow',
  seed: 404,
  bpm: 135,
  tonic: 69, // A
  scale: 'minor',
  voices: { lead: 'bell', bass: 'bass', arp: 'pluck', pad: 'pad' },
  leadCfg: { ratio: 2.76, index: 2.6 },
  bassCfg: { wave: 'triangle', cutoff: 560 },
  padCfg: { wave: 'sawtooth', detune: 10, cutoff: 2000 },
  sections: [
    // intro en menor
    { name: 'intro', bars: 4, chords: prog([0, 'min'], [5, 'min'], [3, 'maj'], [7, 'maj']), lead: 'sparse', pad: true, drums: 'none', scale: 'minor' },
    { name: 'A', bars: 8, chords: prog([0, 'min'], [7, 'min'], [3, 'maj'], [10, 'maj'], [0, 'min'], [5, 'min'], [7, 'maj'], [7, 'dom7']), lead: 'bell', bass: 'root', arp: 8, pad: true, drums: 'soft', crash: true, scale: 'minor' },
    // estribillo en MAYOR (relativo mayor)
    { name: 'B', bars: 8, chords: prog([3, 'maj'], [5, 'maj'], [0, 'maj'], [7, 'maj'], [3, 'maj'], [10, 'maj'], [5, 'maj'], [7, 'maj']), lead: 'bright', bass: 'bounce', arp: 4, pad: true, drums: 'pop', scale: 'major' },
    { name: 'C', bars: 8, chords: prog([0, 'min'], [3, 'maj'], [5, 'min'], [3, 'maj'], [0, 'min'], [10, 'maj'], [7, 'maj'], [7, 'dom7']), lead: 'flowing', bass: 'root', arp: 8, pad: true, drums: 'soft', scale: 'minor' },
    { name: 'D', bars: 8, chords: prog([3, 'maj'], [0, 'maj'], [10, 'maj'], [5, 'maj'], [3, 'maj'], [7, 'maj'], [5, 'maj'], [0, 'maj']), lead: 'bell', bass: 'bounce', arp: 4, pad: true, drums: 'pop', crash: true, fill: true, scale: 'major' },
  ],
  arrangement: ['intro', 'A', 'B', 'A', 'C', 'B', 'D'],
};

const RESULTS_SPEC = {
  id: 'results',
  seed: 505,
  bpm: 100,
  tonic: 60,
  scale: 'major',
  voices: { lead: 'lead', bass: 'bass', arp: 'pluck', pad: 'pad' },
  leadCfg: { wave: 'sawtooth', cutoff: 3200, vib: 4, vibDepth: 4 },
  sections: [
    {
      name: 'fanfare',
      bars: 4,
      chords: prog([0, 'maj'], [5, 'maj'], [7, 'dom'], [0, 'maj']),
      lead: 'sparse',
      leadNotes: [
        { t: 0, d: 1, deg: 0, v: 0.95 },
        { t: 1, d: 1, deg: 4, v: 0.95 },
        { t: 2, d: 1, deg: 7, v: 0.95 },
        { t: 3, d: 1, deg: 12, v: 1 },
        { t: 4, d: 2, deg: 7, v: 0.95 },
        { t: 6, d: 2, deg: 12, v: 1 },
        { t: 8, d: 4, deg: 12, v: 1 },
        { t: 12, d: 4, deg: 7, v: 0.9 },
      ],
      pad: true,
      drums: 'soft',
      crash: true,
      leadOct: 12,
    },
    { name: 'loopA', bars: 8, chords: prog([0, 'maj'], [9, 'min'], [5, 'maj'], [7, 'dom'], [0, 'maj'], [4, 'min'], [2, 'min'], [7, 'dom']), lead: 'calm', bass: 'root', arp: 8, pad: true, drums: 'halftime' },
    { name: 'loopB', bars: 8, chords: prog([5, 'maj'], [9, 'min'], [2, 'min7'], [7, 'dom7'], [5, 'maj'], [9, 'min'], [5, 'maj'], [7, 'dom']), lead: 'flowing', bass: 'walk', pad: true, drums: 'soft' },
    { name: 'loopC', bars: 8, chords: prog([9, 'min'], [5, 'maj'], [0, 'maj'], [7, 'dom'], [9, 'min'], [4, 'min'], [5, 'maj'], [0, 'maj']), lead: 'bell', bass: 'root', arp: 8, pad: true, drums: 'halftime', crash: true, fill: true },
  ],
  arrangement: ['fanfare', 'loopA', 'loopB', 'loopA', 'loopC', 'loopB'],
};

const SPECS = [MENU_SPEC, MEADOW_SPEC, DESERT_SPEC, SNOW_SPEC, RESULTS_SPEC];

let cache = null;

export function buildAllSongs() {
  if (cache) return cache;
  cache = new Map();
  for (const spec of SPECS) {
    cache.set(spec.id, buildSong(spec));
  }
  return cache;
}

export function getSong(id) {
  const all = buildAllSongs();
  return all.get(id) || null;
}

export const SONG_IDS = SPECS.map((s) => s.id);

// Material distinto por canción (compases), para auditoría del criterio.
export function songStats(id) {
  const spec = SPECS.find((s) => s.id === id);
  if (!spec) return null;
  let distinctBars = 0;
  for (const sec of spec.sections) distinctBars += sec.bars;
  const song = getSong(id);
  return {
    id,
    bpm: spec.bpm,
    distinctBars,
    loopBars: song ? song.loopSteps / STEPS_PER_BAR : 0,
    sections: spec.sections.map((s) => `${s.name}:${s.bars}`).join('+'),
  };
}
