// BLOQUE 4 reemplazará este stub. Mantener la API exacta (§4.4).
// No-op: sin cajas, sin ruleta, sin objetos. Consume controls.useItem.

export function createItemSystem(scene, track, events) {
  return {
    update(dt, ctx) {
      if (!ctx || !ctx.karts) return;
      for (const kart of ctx.karts) {
        if (kart && kart.controls) kart.controls.useItem = false;
      }
    },
    getHeldItem() {
      return null;
    },
    isRolling() {
      return false;
    },
    getRouletteDisplay() {
      return null;
    },
    dispose() {},
  };
}
