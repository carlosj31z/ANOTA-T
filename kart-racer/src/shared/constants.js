// Constantes compartidas del juego "Rally Relámpago".
// Contrato §2 y §5. Única fuente de verdad para números y mapeos globales.

export const TOTAL_LAPS = 3;
export const NUM_RACERS = 8;
export const ROAD_WIDTH = 18; // metros
export const GRAVITY = 30; // m/s²
export const BASE_MAX_SPEED = 32; // m/s (modificado por stats)
export const OFFROAD_SPEED_FACTOR = 0.45;

export const ITEM_IDS = ['turbo', 'peel', 'bouncer', 'seeker', 'shield', 'storm'];
export const TRACK_IDS = ['meadow', 'desert', 'snow'];
export const MUSIC_IDS = ['menu', 'meadow', 'desert', 'snow', 'results'];

// índice = driftLevel (0 = sin derrape)
export const DRIFT_SPARK_COLORS = [null, 0x3ab0ff, 0xff9a1f, 0xc04bff];

// Eventos del bus global (contrato §3). Nombre de constante = valor string (menos ':')
export const EVENTS = {
  STATE_CHANGE: 'state:change',
  COUNTDOWN: 'race:countdown',
  RACE_START: 'race:start',
  LAP: 'race:lap',
  FINISH: 'race:finish',
  DRIFT_START: 'kart:drift-start',
  DRIFT_LEVEL: 'kart:drift-level',
  DRIFT_END: 'kart:drift-end',
  BOOST: 'kart:boost',
  HIT: 'kart:hit',
  JUMP: 'kart:jump',
  LAND: 'kart:land',
  WALL: 'kart:wall',
  BUMP: 'kart:bump',
  ITEM_BOX: 'item:box-hit',
  ITEM_GOT: 'item:got',
  ITEM_USE: 'item:use',
  ITEM_EXPLODE: 'item:explode',
};

// Mapeo de teclas por KeyboardEvent.code (contrato §5).
export const KEYS = {
  throttle: ['ArrowUp', 'KeyW'],
  brake: ['ArrowDown', 'KeyS'],
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  drift: ['Space', 'ShiftLeft', 'ShiftRight'],
  useItem: ['KeyE', 'ControlLeft', 'ControlRight', 'KeyX'],
  pause: ['Escape', 'KeyP'],
};
