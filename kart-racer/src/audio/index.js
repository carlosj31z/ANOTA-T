// BLOQUE 5 reemplazará este stub. Mantener la API exacta (§4.5).
// Audio silencioso: toda la API presente, sin síntesis todavía.

export function createAudio() {
  let musicId = null;
  let fast = false;
  let master = 0.8;

  return {
    unlock() {},
    bindEvents() {},
    playMusic(id) {
      musicId = id;
    },
    stopMusic() {
      musicId = null;
    },
    setMusicFast(v) {
      fast = !!v;
    },
    playSfx() {},
    setEngine() {},
    setMasterVolume(v) {
      master = Math.max(0, Math.min(1, v));
    },
    // Extras útiles para integración, no exigidos por el contrato.
    getMusicId() {
      return musicId;
    },
    isMusicFast() {
      return fast;
    },
    getMasterVolume() {
      return master;
    },
  };
}
