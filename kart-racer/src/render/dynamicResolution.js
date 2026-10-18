// BLOQUE 9 — RENDER PIPELINE. Resolución dinámica (CONTRATO §9.1).
//
// Mide la media móvil del dt real que recibe `render(dt)`. Si la media supera
// 20 ms durante 2 s, baja el pixelRatio por pasos (mínimo 0.6); si baja de
// 12 ms durante 2 s, lo sube (máximo min(devicePixelRatio, 1.5)).
//
// No toca el canvas: devuelve el nuevo ratio para que el pipeline aplique
// `renderer.setPixelRatio` + `setSize` y reconfigure el EffectComposer.

const WINDOW = 60; // ~1 s de muestras a 60 fps

function defaultMax() {
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  return Math.min(dpr, 1.5);
}

export function createDynamicResolution(opts = {}) {
  const min = opts.min ?? 0.6;
  const max = opts.max ?? defaultMax();
  const step = opts.step ?? 0.1;
  const downMs = opts.downMs ?? 20;
  const upMs = opts.upMs ?? 12;
  const hold = opts.hold ?? 2; // s que debe sostenerse la condición

  const samples = [];
  let sum = 0;
  let ratio = Math.min(Math.max(opts.initial ?? max, min), max);
  let overTime = 0;
  let underTime = 0;
  let enabled = opts.enabled !== false;

  function averageMs() {
    return samples.length ? (sum / samples.length) * 1000 : 0;
  }

  // Devuelve el nuevo pixelRatio si ha cambiado, o null.
  function update(dt) {
    const d = dt > 0 && isFinite(dt) ? dt : 0;
    samples.push(d);
    sum += d;
    if (samples.length > WINDOW) sum -= samples.shift();

    if (!enabled) {
      overTime = 0;
      underTime = 0;
      return null;
    }

    const avg = averageMs();
    let next = null;

    if (avg > downMs) {
      underTime = 0;
      overTime += d;
      if (overTime >= hold && ratio > min + 1e-4) {
        ratio = Math.max(min, Math.round((ratio - step) * 100) / 100);
        overTime = 0;
        next = ratio;
      }
    } else if (avg < upMs) {
      overTime = 0;
      underTime += d;
      if (underTime >= hold && ratio < max - 1e-4) {
        ratio = Math.min(max, Math.round((ratio + step) * 100) / 100);
        underTime = 0;
        next = ratio;
      }
    } else {
      overTime = 0;
      underTime = 0;
    }

    return next;
  }

  function reset(r) {
    ratio = Math.min(Math.max(r ?? max, min), max);
    samples.length = 0;
    sum = 0;
    overTime = 0;
    underTime = 0;
  }

  return {
    min,
    max,
    update,
    reset,
    get ratio() {
      return ratio;
    },
    get averageMs() {
      return averageMs();
    },
    get enabled() {
      return enabled;
    },
    setEnabled(v) {
      enabled = !!v;
      overTime = 0;
      underTime = 0;
    },
  };
}
