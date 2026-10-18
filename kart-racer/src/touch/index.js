// BLOQUE TÁCTIL — Controles táctiles (CONTRATO §10.3).
//
// `createTouchControls(root, opts?)` monta un overlay semitransparente para
// móvil en horizontal:
//   · izquierda → volante virtual (stick) o flechas ◀ ▶ (mode: 'buttons')
//   · derecha   → OBJETO, DERRAPE, FRENO, ACELERAR (si se apaga el AUTO)
//   · arriba    → pausa (centro-derecha)
//
// Multitáctil con Pointer Events + setPointerCapture. No interfiere con el
// ratón en PC: los punteros `mouse` se ignoran y cuando está oculto/desactivado
// no procesa nada. El estado se lee desde `state` y los flancos desde
// `consumeUseItem()` / `consumePause()`; core los fusiona con teclado/mando.

import './styles.css';

const STICK_RADIUS = 70; // px de recorrido del volante
const DEADZONE = 0.08;
const VIBRATE_MS = 10;

function touchEnabled() {
  if (typeof window === 'undefined') return false;
  let forced = false;
  try {
    forced = new URLSearchParams(window.location.search).get('touch') === '1';
  } catch {
    forced = false;
  }
  const has =
    'ontouchstart' in window || (navigator && navigator.maxTouchPoints > 0);
  return forced || has;
}

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

// Curva suave: zona muerta + easing para precisión cerca del centro.
function shapeSteer(v) {
  const u = clamp(v, -1, 1);
  const a = Math.abs(u);
  if (a < DEADZONE) return 0;
  const t = (a - DEADZONE) / (1 - DEADZONE);
  const curved = Math.pow(t, 1.3);
  return (u < 0 ? -1 : 1) * curved;
}

const ICON_PAUSE = `<svg viewBox="0 0 32 32" aria-hidden="true">
  <rect x="8" y="6" width="6" height="20" rx="2" fill="currentColor"/>
  <rect x="18" y="6" width="6" height="20" rx="2" fill="currentColor"/>
</svg>`;

const ICON_BOX = `<svg viewBox="0 0 32 32" aria-hidden="true">
  <path d="M6 9.2 16 4.5l10 4.7v13.6L16 27.5 6 22.8z" fill="none"
        stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>
  <path d="M6 9.2 16 14l10-4.8M16 14v13.5" fill="none"
        stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>
  <text x="16" y="11.6" text-anchor="middle" font-size="9" font-weight="900"
        font-family="system-ui, sans-serif" fill="currentColor">?</text>
</svg>`;

export function createTouchControls(root, opts = {}) {
  const doc = (root && root.ownerDocument) || document;
  const mode = opts.mode === 'buttons' ? 'buttons' : 'stick';

  const el =
    doc.createElement('div');
  el.className =
    'tc-root ' + (mode === 'buttons' ? 'mode-buttons' : 'mode-stick') + ' hidden';
  el.innerHTML = `
    <button class="tc-btn tc-pause" type="button" aria-label="Pausa">${ICON_PAUSE}</button>
    <div class="tc-pad">
      <div class="tc-stick">
        <div class="tc-base"></div>
        <div class="tc-knob"></div>
      </div>
      <div class="tc-arrows">
        <button class="tc-btn tc-arrow tc-arrow-left" type="button" aria-label="Girar a la izquierda">&#9664;</button>
        <button class="tc-btn tc-arrow tc-arrow-right" type="button" aria-label="Girar a la derecha">&#9654;</button>
      </div>
    </div>
    <div class="tc-actions">
      <button class="tc-btn tc-accel hidden" type="button" aria-label="Acelerar">GAS</button>
      <button class="tc-btn tc-auto on" type="button" aria-label="Acelerador automático">AUTO</button>
      <button class="tc-btn tc-object" type="button" aria-label="Usar objeto">${ICON_BOX}</button>
      <button class="tc-btn tc-brake" type="button" aria-label="Frenar">FRENO</button>
      <button class="tc-btn tc-drift" type="button" aria-label="Derrapar">DERRAPE</button>
    </div>`;

  const pad = el.querySelector('.tc-pad');
  const stick = el.querySelector('.tc-stick');
  const knob = el.querySelector('.tc-knob');
  const btnPause = el.querySelector('.tc-pause');
  const btnArrowLeft = el.querySelector('.tc-arrow-left');
  const btnArrowRight = el.querySelector('.tc-arrow-right');
  const btnObject = el.querySelector('.tc-object');
  const btnDrift = el.querySelector('.tc-drift');
  const btnBrake = el.querySelector('.tc-brake');
  const btnAccel = el.querySelector('.tc-accel');
  const btnAuto = el.querySelector('.tc-auto');

  const state = { throttle: 0, brake: 0, steer: 0, drift: false };

  let enabled = touchEnabled();
  let visible = false;
  let autoThrottle = true;
  let accelHeld = false;
  let pendingUse = false;
  let pendingPause = false;

  function vibrate(ms) {
    try {
      navigator.vibrate && navigator.vibrate(ms);
    } catch {
      /* sin vibración */
    }
  }

  function syncThrottle() {
    if (state.brake > 0) state.throttle = 0;
    else if (autoThrottle || accelHeld) state.throttle = 1;
    else state.throttle = 0;
  }

  // --- Volante virtual -------------------------------------------------------
  // Coordenadas locales al pad (`.tc-stick` es hijo de `.tc-pad`).
  let steerId = null;
  let padLeft = 0;
  let padTop = 0;
  let baseX = 0;
  let baseY = 0;

  function placeStick() {
    stick.style.transform = `translate(${baseX}px, ${baseY}px)`;
  }

  function setKnob(dx) {
    knob.style.transform = `translateX(${dx}px)`;
  }

  function onPadDown(e) {
    if (mode === 'buttons') return; // las flechas manejan su propio puntero
    if (!accept(e)) return;
    if (steerId !== null) return;
    e.preventDefault();
    const rect = pad.getBoundingClientRect();
    padLeft = rect.left;
    padTop = rect.top;
    steerId = e.pointerId;
    baseX = e.clientX - padLeft;
    baseY = e.clientY - padTop;
    try {
      pad.setPointerCapture(e.pointerId);
    } catch {
      /* sintético */
    }
    placeStick();
    setKnob(0);
    stick.classList.add('visible');
    state.steer = 0;
  }

  function onPadMove(e) {
    if (mode === 'buttons') return;
    if (e.pointerId !== steerId) return;
    e.preventDefault();
    const lx = e.clientX - padLeft;
    let dx = lx - baseX;
    // Re-centrado: si el dedo se sale del recorrido, la base lo sigue.
    if (dx > STICK_RADIUS) {
      baseX = lx - STICK_RADIUS;
      dx = STICK_RADIUS;
    } else if (dx < -STICK_RADIUS) {
      baseX = lx + STICK_RADIUS;
      dx = -STICK_RADIUS;
    }
    placeStick();
    setKnob(dx);
    state.steer = shapeSteer(dx / STICK_RADIUS);
  }

  function onPadUp(e) {
    if (e.pointerId !== steerId) return;
    try {
      pad.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    steerId = null;
    stick.classList.remove('visible');
    state.steer = 0;
  }

  // --- modo botones (flechas) ------------------------------------------------
  const arrows = new Set();
  function syncArrows() {
    state.steer = arrows.has(-1) && !arrows.has(1) ? -1 : arrows.has(1) && !arrows.has(-1) ? 1 : 0;
  }

  // --- utilidades de punteros ------------------------------------------------
  function accept(e) {
    return visible && enabled && e.pointerType !== 'mouse';
  }

  function bindHold(btn, onDown, onUp) {
    btn.addEventListener(
      'pointerdown',
      (e) => {
        if (!accept(e)) return;
        e.preventDefault();
        btn.classList.add('active');
        try {
          btn.setPointerCapture(e.pointerId);
        } catch {
          /* sintético */
        }
        onDown(e);
      },
      { passive: false }
    );
    const up = (e) => {
      if (e.pointerType === 'mouse') return;
      btn.classList.remove('active');
      if (onUp) onUp(e);
    };
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
  }

  function bindTap(btn, fn) {
    btn.addEventListener(
      'pointerdown',
      (e) => {
        if (!accept(e)) return;
        e.preventDefault();
        btn.classList.add('active');
        fn(e);
      },
      { passive: false }
    );
    const up = (e) => {
      if (e.pointerType === 'mouse') return;
      btn.classList.remove('active');
    };
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
  }

  // --- eventos ---------------------------------------------------------------
  pad.addEventListener('pointerdown', onPadDown, { passive: false });
  pad.addEventListener('pointermove', onPadMove, { passive: false });
  pad.addEventListener('pointerup', onPadUp, { passive: false });
  pad.addEventListener('pointercancel', onPadUp, { passive: false });

  bindHold(
    btnArrowLeft,
    () => {
      arrows.add(-1);
      syncArrows();
    },
    () => {
      arrows.delete(-1);
      syncArrows();
    }
  );
  bindHold(
    btnArrowRight,
    () => {
      arrows.add(1);
      syncArrows();
    },
    () => {
      arrows.delete(1);
      syncArrows();
    }
  );

  bindHold(
    btnDrift,
    () => {
      state.drift = true;
      vibrate(VIBRATE_MS);
    },
    () => {
      state.drift = false;
    }
  );

  bindHold(
    btnBrake,
    () => {
      state.brake = 1;
      syncThrottle();
    },
    () => {
      state.brake = 0;
      syncThrottle();
    }
  );

  bindHold(
    btnAccel,
    () => {
      accelHeld = true;
      syncThrottle();
    },
    () => {
      accelHeld = false;
      syncThrottle();
    }
  );

  bindTap(btnObject, () => {
    pendingUse = true;
    vibrate(VIBRATE_MS);
  });
  bindTap(btnPause, () => {
    pendingPause = true;
  });

  bindTap(btnAuto, () => {
    autoThrottle = !autoThrottle;
    btnAuto.classList.toggle('on', autoThrottle);
    btnAccel.classList.toggle('hidden', autoThrottle);
    syncThrottle();
  });

  // Bloquea menú contextual y zoom/scroll dentro del overlay.
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  el.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
  el.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches && e.touches.length > 1) e.preventDefault();
    },
    { passive: false }
  );

  root.appendChild(el);
  syncThrottle();

  // --- API -------------------------------------------------------------------
  // Mide qué hay en la esquina inferior derecha (minimapa/posición del HUD) y
  // reserva ese espacio. Si el HUD ya se ha recolocado arriba (móvil táctil),
  // el bloque de acciones ocupa la esquina inferior derecha.
  function positionActions() {
    if (typeof window === 'undefined') return;
    const mm = doc.querySelector('.hud-minimap-wrap');
    if (!mm) {
      el.style.setProperty('--tc-reserve', '0px');
      return;
    }
    const r = mm.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const bottomRight = r.top > vh * 0.5 && r.right > vw * 0.55;
    const reserve = bottomRight ? Math.max(0, vw - r.left) + 8 : 0;
    el.style.setProperty('--tc-reserve', reserve + 'px');
  }

  function onResize() {
    if (visible) positionActions();
  }
  window.addEventListener('resize', onResize);

  function resetState() {
    steerId = null;
    arrows.clear();
    accelHeld = false;
    stick.classList.remove('visible');
    state.brake = 0;
    state.drift = false;
    state.steer = 0;
    syncThrottle();
  }

  function show() {
    visible = true;
    el.classList.remove('hidden');
    positionActions();
  }

  function hide() {
    visible = false;
    el.classList.add('hidden');
    resetState();
  }

  function consumeUseItem() {
    if (!pendingUse) return false;
    pendingUse = false;
    return true;
  }

  function consumePause() {
    if (!pendingPause) return false;
    pendingPause = false;
    return true;
  }

  function dispose() {
    window.removeEventListener('resize', onResize);
    el.remove();
  }

  return {
    enabled,
    state,
    consumeUseItem,
    consumePause,
    show,
    hide,
    dispose,
    // extra útil para core/tests
    element: el,
    setEnabled(v) {
      enabled = !!v;
    },
    get autoThrottle() {
      return autoThrottle;
    },
    get mode() {
      return mode;
    },
  };
}

export default createTouchControls;
