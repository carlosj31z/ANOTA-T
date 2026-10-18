// Bus de eventos global. Contrato §2.
// on() devuelve una función para desuscribir.

export function createEventBus() {
  const listeners = new Map();

  function on(name, fn) {
    if (typeof fn !== 'function') return () => {};
    let set = listeners.get(name);
    if (!set) {
      set = new Set();
      listeners.set(name, set);
    }
    set.add(fn);
    return () => off(name, fn);
  }

  function off(name, fn) {
    const set = listeners.get(name);
    if (set) set.delete(fn);
  }

  function emit(name, payload) {
    const set = listeners.get(name);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        fn(payload);
      } catch (err) {
        // Un listener roto no debe tumbar el bucle de juego.
        console.error('[events]', name, err);
      }
    }
  }

  return { on, off, emit };
}
