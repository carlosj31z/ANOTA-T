// Entrada unificada: teclado (event.code) + Gamepad API. Contrato §4.8 / §5.
// Produce controls continuos mas flancos (useItem, pause) de un solo frame.

import { KEYS } from '../shared/constants.js';

const DEADZONE = 0.15;

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

export function createInput(target = window) {
  const held = new Set();
  let pendingUseItem = false;
  let pendingPause = false;

  function onKeyDown(e) {
    if (!e.repeat) {
      if (KEYS.useItem.includes(e.code)) pendingUseItem = true;
      if (KEYS.pause.includes(e.code)) pendingPause = true;
    }
    held.add(e.code);
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  }

  function onKeyUp(e) {
    held.delete(e.code);
  }

  function onBlur() {
    held.clear();
  }

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  const controls = {
    throttle: 0,
    brake: 0,
    steer: 0,
    drift: false,
    useItem: false,
    pause: false,
    _gpUse: false,
    _gpPause: false,
  };

  function anyKey(codes) {
    for (const c of codes) if (held.has(c)) return true;
    return false;
  }

  function readGamepad() {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    if (!pads) return null;
    for (const gp of pads) if (gp && gp.connected) return gp;
    return null;
  }

  function update() {
    let throttle = anyKey(KEYS.throttle) ? 1 : 0;
    let brake = anyKey(KEYS.brake) ? 1 : 0;
    let steer = (anyKey(KEYS.right) ? 1 : 0) - (anyKey(KEYS.left) ? 1 : 0);
    let drift = anyKey(KEYS.drift);

    let gpUse = false;
    let gpPause = false;

    const gp = readGamepad();
    if (gp) {
      const axes = gp.axes || [];
      const buttons = gp.buttons || [];
      const btn = (i) => !!(buttons[i] && buttons[i].pressed);
      const val = (i) => (buttons[i] ? buttons[i].value || 0 : 0);

      let gx = axes[0] || 0;
      let gy = axes[1] || 0;
      if (Math.abs(gx) < DEADZONE) gx = 0;
      if (Math.abs(gy) < DEADZONE) gy = 0;

      if (Math.abs(gx) > Math.abs(steer)) steer = clamp(gx, -1, 1);

      const dpadSteer = (btn(15) ? 1 : 0) - (btn(14) ? 1 : 0);
      if (dpadSteer !== 0) steer = dpadSteer;

      // A / RT / stick arriba = acelerar; B / LT / stick abajo = frenar.
      const rt = Math.max(val(7), btn(0) ? 1 : 0, gy < 0 ? -gy : 0);
      const lt = Math.max(val(6), btn(1) ? 1 : 0, gy > 0 ? gy : 0);
      throttle = Math.max(throttle, clamp(rt, 0, 1));
      brake = Math.max(brake, clamp(lt, 0, 1));

      if (btn(5)) drift = true; // RB

      const useNow = btn(2) || btn(4); // X o LB
      if (useNow && !controls._gpUse) gpUse = true;
      controls._gpUse = useNow;

      const pauseNow = btn(9); // Start
      if (pauseNow && !controls._gpPause) gpPause = true;
      controls._gpPause = pauseNow;
    }

    controls.throttle = clamp(throttle, 0, 1);
    controls.brake = clamp(brake, 0, 1);
    controls.steer = clamp(steer, -1, 1);
    controls.drift = drift;
    controls.useItem = pendingUseItem || gpUse;
    controls.pause = pendingPause || gpPause;

    pendingUseItem = false;
    pendingPause = false;
  }

  function dispose() {
    target.removeEventListener('keydown', onKeyDown);
    target.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
  }

  return { controls, update, dispose };
}
