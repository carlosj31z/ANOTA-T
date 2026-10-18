// BLOQUE 5 — Audio. Motor de audio procedural (Web Audio API).
// Construye el grafo: buses (music/sfx/engine) -> master -> compresor -> destino,
// más un reverb sencillo con impulso de ruido generado. Contrato §4.5.
//
// El grafo puede construirse sobre CUALQUIER BaseAudioContext: uno en vivo
// (AudioContext) o uno offline (OfflineAudioContext) para renderizar.

export const BUS_VOLUMES = {
  master: 0.8,
  music: 0.5,
  sfx: 0.85,
  engine: 0.3,
  reverbReturn: 0.32,
  reverbSend: 0.22,
};

// Impulso de reverb generado por código: ruido con decaimiento exponencial.
export function createImpulseResponse(context, duration = 1.6, decay = 2.4) {
  const rate = context.sampleRate;
  const length = Math.max(1, Math.floor(rate * duration));
  const buffer = context.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      // Pequeño retardo inicial para simular reflexiones tempranas.
      const slap = i < rate * 0.02 ? 0.4 : 1.0;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * slap;
    }
  }
  return buffer;
}

// Construye el grafo de audio sobre `context`. `opts.destination` permite
// redirigir; por defecto usa `context.destination`.
export function createAudioGraph(context, opts = {}) {
  const destination = opts.destination || context.destination;
  const masterVolume = typeof opts.masterVolume === 'number' ? opts.masterVolume : BUS_VOLUMES.master;

  const master = context.createGain();
  master.gain.value = clamp01(masterVolume);

  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -14;
  compressor.knee.value = 26;
  compressor.ratio.value = 3.2;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.25;

  master.connect(compressor);
  compressor.connect(destination);

  // Buses independientes.
  const music = context.createGain();
  music.gain.value = BUS_VOLUMES.music;
  const sfx = context.createGain();
  sfx.gain.value = BUS_VOLUMES.sfx;
  const engine = context.createGain();
  engine.gain.value = BUS_VOLUMES.engine;
  music.connect(master);
  sfx.connect(master);
  engine.connect(master);

  // Reverb en envío (music + sfx). El motor no lleva reverb.
  const convolver = context.createConvolver();
  convolver.buffer = createImpulseResponse(context, 1.6, 2.4);
  const reverbReturn = context.createGain();
  reverbReturn.gain.value = BUS_VOLUMES.reverbReturn;
  const reverbSend = context.createGain();
  reverbSend.gain.value = BUS_VOLUMES.reverbSend;
  reverbSend.connect(convolver);
  convolver.connect(reverbReturn);
  reverbReturn.connect(master);
  music.connect(reverbSend);
  sfx.connect(reverbSend);

  return {
    context,
    destination,
    master,
    compressor,
    music,
    sfx,
    engine,
    reverb: convolver,
    reverbReturn,
    reverbSend,
  };
}

export function clamp01(v) {
  if (!isFinite(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function clamp(v, lo, hi) {
  if (!isFinite(v)) return lo;
  return v < lo ? lo : v > hi ? hi : v;
}
