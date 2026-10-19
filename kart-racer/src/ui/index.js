// BLOQUE 6 — Interfaz (menús + HUD). Contrato §4.6.
// HTML/CSS/SVG puro dentro de `root` (el div superpuesto al canvas). Sin frameworks.
// Menús navegables con flechas + Enter + Esc y ratón; HUD actualizado por-frame sin
// reconstruir el DOM.

import './styles.css';
import { colorCss, characterPortrait, itemIcon, perkIcon, trackThumb, boltSvg } from './icons.js';

const MAX_KMH = 150;
const QUALITY_ORDER = ['low', 'high', 'ultra'];
const QUALITY_LABEL = { low: 'BAJO', high: 'ALTO', ultra: 'ULTRA' };
const STAT_DEFS = [
  { key: 'speed', label: 'VELOCIDAD' },
  { key: 'accel', label: 'ACELERACIÓN' },
  { key: 'handling', label: 'MANEJO' },
  { key: 'weight', label: 'PESO' },
];
const WEIGHT_LABEL = { light: 'LIGERO', medium: 'MEDIO', heavy: 'PESADO' };
const PLACE_COLOR = { 1: '#ffd23f', 2: '#dce4ee', 3: '#e0995a' };

function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html != null) node.innerHTML = html;
  return node;
}

function fmtTime(s) {
  if (s == null || !isFinite(s)) return '—';
  const total = Math.max(0, s);
  const m = Math.floor(total / 60);
  const sec = Math.floor(total % 60);
  const cc = Math.floor((total * 100) % 100);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cc).padStart(2, '0')}`;
}

function retrigger(node, cls) {
  node.classList.remove(cls);
  void node.offsetWidth;
  node.classList.add(cls);
}

// En táctil un tap emite un mouseenter sintético antes del click; si
// seleccionáramos en hover, el primer toque confirmaría sin poder explorar.
function prefersTouch() {
  try {
    if (typeof window === 'undefined') return false;
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return true;
    return (navigator.maxTouchPoints || 0) > 0 && 'ontouchstart' in window;
  } catch (e) {
    return false;
  }
}

export function createUI(root, opts = {}) {
  const onSound = typeof opts.onSound === 'function' ? opts.onSound : () => {};
  const onQuality = typeof opts.onQuality === 'function' ? opts.onQuality : null;

  const layer = el('div', 'ui-layer');
  root.appendChild(layer);

  let quality = QUALITY_ORDER.includes(opts.quality) ? opts.quality : 'high';
  let qualityLabelEl = null;

  let screen = null; // pantalla de menú actual
  let menuHandler = null; // handler de teclado activo (solo menús)
  let hud = null; // contenedor del HUD
  let refs = null; // referencias cacheadas del HUD
  let countdownEl = null;
  let countdownTimer = null;
  let messageEl = null;
  let messageTimer = null;
  let pauseEl = null;

  function sound(name) {
    try {
      onSound(name);
    } catch (e) {
      /* la UI nunca debe tumbar el bucle */
    }
  }

  // ---------------------------------------------------------------
  // Calidad gráfica (botón en el título)
  // ---------------------------------------------------------------
  function refreshQualityLabel() {
    if (qualityLabelEl) {
      qualityLabelEl.innerHTML = `GRÁFICOS: <b>${QUALITY_LABEL[quality] || quality}</b>`;
    }
  }

  function setQualityLabel(q) {
    if (QUALITY_ORDER.includes(q)) {
      quality = q;
      refreshQualityLabel();
    }
  }

  function cycleQuality() {
    const i = QUALITY_ORDER.indexOf(quality);
    quality = QUALITY_ORDER[(i + 1) % QUALITY_ORDER.length];
    refreshQualityLabel();
    sound('menu-move');
    if (onQuality) {
      try {
        onQuality(quality);
      } catch (e) {
        /* nunca tumbar el bucle */
      }
    }
  }

  // ---------------------------------------------------------------
  // Teclado y mando de menús (solo activo cuando hay un menú visible)
  // El mando se traduce a los mismos `code` de teclado y pasa por el MISMO
  // manejador (`menuHandler`), sin duplicar lógica.
  // ---------------------------------------------------------------
  function runMenuHandler(e) {
    if (!menuHandler) return false;
    let handled = false;
    try {
      handled = menuHandler(e);
    } catch (err) {
      handled = false;
    }
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
    return handled;
  }

  function onMenuKey(e) {
    runMenuHandler(e);
  }

  const PAD_POLL_MS = 40; // sondeo del mando
  const PAD_REPEAT_MS = 180; // repetición de dirección mantenida
  const PAD_AXIS = 0.55; // umbral del stick
  let padTimer = null;
  let padPressed = null; // entradas activas en el sondeo anterior (Map nombre -> {nextAt})
  let padLocked = null; // entradas ya mantenidas al abrir el menú: exigen soltar primero
  let padStartEnter = true; // Start actúa como Enter (la pausa lo gestiona el juego)

  const PAD_CODE = {
    left: 'ArrowLeft',
    right: 'ArrowRight',
    up: 'ArrowUp',
    down: 'ArrowDown',
    a: 'Enter',
    start: 'Enter',
    b: 'Escape',
  };
  const PAD_REPEATS = new Set(['left', 'right', 'up', 'down']);

  function readPadInputs() {
    const active = new Set();
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return active;
    let pads = null;
    try {
      pads = navigator.getGamepads();
    } catch (err) {
      return active;
    }
    if (!pads) return active;
    for (const gp of pads) {
      if (!gp || !gp.connected) continue;
      const btn = (i) => !!(gp.buttons && gp.buttons[i] && gp.buttons[i].pressed);
      const ax = gp.axes || [];
      if (btn(14) || (ax[0] || 0) < -PAD_AXIS) active.add('left');
      if (btn(15) || (ax[0] || 0) > PAD_AXIS) active.add('right');
      if (btn(12) || (ax[1] || 0) < -PAD_AXIS) active.add('up');
      if (btn(13) || (ax[1] || 0) > PAD_AXIS) active.add('down');
      if (btn(0)) active.add('a');
      if (btn(1)) active.add('b');
      if (padStartEnter && btn(9)) active.add('start');
      break; // primer mando conectado
    }
    return active;
  }

  function pollPad() {
    if (!menuHandler) {
      stopPadPoll();
      return;
    }
    const now = performance.now();
    const pressedRef = padPressed;
    const active = readPadInputs();
    for (const name of [...padLocked]) if (!active.has(name)) padLocked.delete(name);
    for (const name of [...padPressed.keys()]) if (!active.has(name)) padPressed.delete(name);
    for (const name of active) {
      if (padLocked.has(name)) continue;
      const st = padPressed.get(name);
      if (!st) {
        // Flanco de subida (A/B/Start) o primer paso inmediato de una dirección.
        padPressed.set(name, { nextAt: now + PAD_REPEAT_MS });
      } else if (PAD_REPEATS.has(name) && now >= st.nextAt) {
        st.nextAt = now + PAD_REPEAT_MS;
      } else {
        continue;
      }
      runMenuHandler({ code: PAD_CODE[name], repeat: false, preventDefault() {}, stopPropagation() {} });
      if (!menuHandler || padPressed !== pressedRef) return; // el manejador cambió de menú
    }
  }

  function startPadPoll() {
    stopPadPoll();
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return;
    padPressed = new Map();
    padLocked = readPadInputs(); // lo que ya está pulsado al abrir el menú no cuenta
    padTimer = setInterval(pollPad, PAD_POLL_MS);
  }

  function stopPadPoll() {
    if (padTimer) {
      clearInterval(padTimer);
      padTimer = null;
    }
    padPressed = null;
    padLocked = null;
  }

  function setMenu(handler, menuOpts = {}) {
    removeMenu();
    menuHandler = handler;
    padStartEnter = menuOpts.padStart !== false;
    window.addEventListener('keydown', onMenuKey, true);
    startPadPoll();
  }

  function removeMenu() {
    stopPadPoll();
    if (menuHandler) {
      menuHandler = null;
      window.removeEventListener('keydown', onMenuKey, true);
    }
  }

  function mountScreen(node) {
    clearScreen();
    screen = node;
    layer.appendChild(node);
  }

  function clearScreen() {
    removeMenu();
    if (screen) {
      screen.remove();
      screen = null;
    }
    qualityLabelEl = null;
  }

  function clearHud() {
    if (hud) {
      hud.remove();
      hud = null;
      refs = null;
    }
  }

  // ---------------------------------------------------------------
  // Título
  // ---------------------------------------------------------------
  function showTitle(onStart) {
    clearHud();
    const node = el('div', 'ui-screen title-screen');
    node.innerHTML = `
      <div class="stripes"></div>
      <div class="title-inner">
        <div class="game-logo">
          <span class="logo-word logo-word-1">RALLY</span>
          <span class="logo-word logo-word-2">RELÁMPAGO${boltSvg()}</span>
        </div>
        <p class="game-subtitle">11 pilotos · 3 circuitos · 3 vueltas al límite</p>
        <button type="button" class="start-prompt">PULSA <b>ENTER</b> PARA EMPEZAR</button>
        <div class="controls-summary">
          <span><b>↑↓←→</b> Conducir</span>
          <span><b>ESPACIO</b> Derrapar</span>
          <span><b>E</b> Objeto</span>
          <span><b>ESC</b> Pausa</span>
        </div>
        <button type="button" class="quality-btn"></button>
      </div>`;
    const start = () => {
      sound('menu-select');
      if (onStart) onStart();
    };
    node.querySelector('.start-prompt').addEventListener('click', start);
    mountScreen(node);
    qualityLabelEl = node.querySelector('.quality-btn');
    refreshQualityLabel();
    qualityLabelEl.addEventListener('click', (e) => {
      e.stopPropagation();
      cycleQuality();
    });
    setMenu((e) => {
      if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') {
        start();
        return true;
      }
      return false;
    });
  }

  // ---------------------------------------------------------------
  // Selección de personaje
  // ---------------------------------------------------------------
  function showCharacterSelect(characters, onPick, onBack) {
    clearHud();
    const chars = characters || [];
    let index = 0;

    const node = el('div', 'ui-screen panel-screen');
    node.innerHTML = `
      <div class="stripes"></div>
      <h2 class="screen-title">ELIGE PILOTO</h2>
      <div class="cs-layout">
        <div class="char-grid"></div>
        <aside class="cs-panel">
          <div class="cs-portrait"></div>
          <div class="cs-name"></div>
          <div class="cs-class"></div>
          <div class="cs-stats"></div>
          <div class="cs-perk">
            <div class="cs-perk-badge"><span class="cs-perk-icon"></span><span>VENTAJA</span></div>
            <div class="cs-perk-name"></div>
            <div class="cs-perk-desc"></div>
          </div>
        </aside>
      </div>
      <div class="screen-actions">
        <button type="button" class="ui-btn option cs-back">VOLVER</button>
        <button type="button" class="ui-btn option primary cs-pick">ELEGIR</button>
      </div>
      <div class="cs-hint">Toca para elegir · <b>ENTER</b> confirma · <b>ESC</b> vuelve</div>`;

    const grid = node.querySelector('.char-grid');
    const portraitEl = node.querySelector('.cs-portrait');
    const nameEl = node.querySelector('.cs-name');
    const classEl = node.querySelector('.cs-class');
    const statsHost = node.querySelector('.cs-stats');
    const perkIconEl = node.querySelector('.cs-perk-icon');
    const perkNameEl = node.querySelector('.cs-perk-name');
    const perkDescEl = node.querySelector('.cs-perk-desc');

    const cards = chars.map((ch, i) => {
      const card = el('button', 'char-card');
      card.type = 'button';
      card.innerHTML = `
        <div class="cc-portrait">${characterPortrait(ch.species, ch.colors, ch.look)}</div>
        <div class="cc-name">${ch.name}</div>
        <div class="cc-kart" style="background:${colorCss(ch.colors.kart)}"></div>`;
      if (!prefersTouch()) {
        card.addEventListener('mouseenter', () => {
          if (i !== index) select(i, true);
        });
      }
      card.addEventListener('click', () => {
        // Táctil: primer toque selecciona, segundo confirma.
        // Ratón: el hover ya seleccionó, así que el clic confirma.
        if (i !== index) select(i, false);
        else pick();
      });
      grid.appendChild(card);
      return card;
    });

    const segRefs = {};
    for (const def of STAT_DEFS) {
      const row = el('div', 'cs-stat');
      row.appendChild(el('span', 'cs-stat-label', def.label));
      const segs = el('div', 'cs-stat-segs');
      segRefs[def.key] = [];
      for (let k = 0; k < 5; k++) {
        const s = el('i', 'cs-seg');
        segs.appendChild(s);
        segRefs[def.key].push(s);
      }
      row.appendChild(segs);
      statsHost.appendChild(row);
    }

    function select(i, withSound) {
      const n = chars.length;
      if (!n) return;
      const next = ((i % n) + n) % n;
      const changed = next !== index;
      index = next;
      cards.forEach((c, k) => c.classList.toggle('selected', k === index));
      const ch = chars[index];
      portraitEl.innerHTML = characterPortrait(ch.species, ch.colors, ch.look);
      nameEl.textContent = ch.name;
      classEl.textContent = 'CLASE ' + (WEIGHT_LABEL[ch.weightClass] || ch.weightClass);
      classEl.dataset.cls = ch.weightClass;
      for (const def of STAT_DEFS) {
        const val = ch.stats[def.key];
        segRefs[def.key].forEach((seg, k) => {
          seg.classList.toggle('on', k < val);
          seg.style.transitionDelay = k * 45 + 'ms';
        });
      }
      const perk = ch.perk || {};
      perkIconEl.innerHTML = perkIcon(perk.id);
      perkNameEl.textContent = perk.name || '';
      perkDescEl.textContent = perk.description || '';
      if (changed) retrigger(portraitEl, 'pop');
      if (withSound && changed) sound('menu-move');
    }

    function pick() {
      if (!chars.length) return;
      sound('menu-select');
      if (onPick) onPick(chars[index]);
    }

    function back() {
      sound('menu-back');
      if (onBack) onBack();
    }

    node.querySelector('.cs-pick').addEventListener('click', pick);
    node.querySelector('.cs-back').addEventListener('click', back);

    mountScreen(node);
    select(0, false);
    setMenu((e) => {
      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
          select(index - 1, true);
          return true;
        case 'ArrowRight':
        case 'KeyD':
          select(index + 1, true);
          return true;
        case 'ArrowUp':
        case 'KeyW':
          select(index - 4, true);
          return true;
        case 'ArrowDown':
        case 'KeyS':
          select(index + 4, true);
          return true;
        case 'Enter':
        case 'NumpadEnter':
        case 'Space':
          pick();
          return true;
        case 'Escape':
        case 'Backspace':
          back();
          return true;
        default:
          return false;
      }
    });
  }

  // ---------------------------------------------------------------
  // Selección de circuito
  // ---------------------------------------------------------------
  function showTrackSelect(tracks, onPick, onBack) {
    clearHud();
    const list = tracks || [];
    let index = 0;

    const node = el('div', 'ui-screen panel-screen');
    node.innerHTML = `
      <div class="stripes"></div>
      <h2 class="screen-title">ELIGE CIRCUITO</h2>
      <div class="track-row"></div>
      <div class="screen-actions">
        <button type="button" class="ui-btn option ts-back">VOLVER</button>
        <button type="button" class="ui-btn option primary ts-pick">ELEGIR</button>
      </div>
      <div class="cs-hint">Toca para elegir · <b>ENTER</b> confirma · <b>ESC</b> vuelve</div>`;

    const row = node.querySelector('.track-row');
    const cards = list.map((t, i) => {
      const card = el('button', 'track-card');
      card.type = 'button';
      card.innerHTML = `
        <div class="tc-thumb">${trackThumb(t.id, t.previewColor)}</div>
        <div class="tc-name">${t.name}</div>
        <div class="tc-desc">${t.description || ''}</div>`;
      if (!prefersTouch()) {
        card.addEventListener('mouseenter', () => {
          if (i !== index) select(i, true);
        });
      }
      card.addEventListener('click', () => {
        if (i !== index) select(i, false);
        else pick();
      });
      row.appendChild(card);
      return card;
    });

    function select(i, withSound) {
      const n = list.length;
      if (!n) return;
      const next = ((i % n) + n) % n;
      const changed = next !== index;
      index = next;
      cards.forEach((c, k) => c.classList.toggle('selected', k === index));
      if (changed) retrigger(cards[index], 'pop');
      if (withSound && changed) sound('menu-move');
    }

    function pick() {
      if (!list.length) return;
      sound('menu-select');
      if (onPick) onPick(list[index]);
    }

    function back() {
      sound('menu-back');
      if (onBack) onBack();
    }

    node.querySelector('.ts-pick').addEventListener('click', pick);
    node.querySelector('.ts-back').addEventListener('click', back);

    mountScreen(node);
    select(0, false);
    setMenu((e) => {
      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
        case 'ArrowUp':
        case 'KeyW':
          select(index - 1, true);
          return true;
        case 'ArrowRight':
        case 'KeyD':
        case 'ArrowDown':
        case 'KeyS':
          select(index + 1, true);
          return true;
        case 'Enter':
        case 'NumpadEnter':
        case 'Space':
          pick();
          return true;
        case 'Escape':
        case 'Backspace':
          back();
          return true;
        default:
          return false;
      }
    });
  }

  // ---------------------------------------------------------------
  // HUD
  // ---------------------------------------------------------------
  function showHUD() {
    clearScreen();
    clearHud();
    hud = el('div', 'hud');
    hud.innerHTML = `
      <div class="hud-item-slot">
        <div class="hud-item-frame"><div class="hud-item-icon"></div></div>
      </div>
      <div class="hud-clock">00:00.00</div>
      <div class="hud-lap"><span class="hud-lap-label">VUELTA</span><span class="hud-lap-num">1/3</span></div>
      <div class="hud-right">
        <div class="hud-minimap-wrap"><canvas class="hud-minimap" width="200" height="200"></canvas></div>
        <div class="hud-place" data-place="x">1º</div>
      </div>
      <div class="hud-speedo">
        <svg viewBox="0 0 200 122" class="speedo-svg" xmlns="http://www.w3.org/2000/svg">
          <path class="speedo-track" d="M20 105 A80 80 0 0 1 180 105" pathLength="100"/>
          <path class="speedo-fill" d="M20 105 A80 80 0 0 1 180 105" pathLength="100"/>
        </svg>
        <div class="speedo-num"><span class="speedo-val">0</span><small>km/h</small></div>
      </div>`;
    layer.appendChild(hud);

    refs = {
      itemSlot: hud.querySelector('.hud-item-slot'),
      itemFrame: hud.querySelector('.hud-item-frame'),
      itemIcon: hud.querySelector('.hud-item-icon'),
      clock: hud.querySelector('.hud-clock'),
      lapNum: hud.querySelector('.hud-lap-num'),
      placeEl: hud.querySelector('.hud-place'),
      speedo: hud.querySelector('.hud-speedo'),
      speedFill: hud.querySelector('.speedo-fill'),
      speedVal: hud.querySelector('.speedo-val'),
      minimap: hud.querySelector('.hud-minimap'),
      // estado para no tocar el DOM si no cambió
      lapText: '',
      clockText: '',
      place: -1,
      kmh: -1,
      boosting: false,
      slotId: undefined,
      slotRolling: false,
      mmSig: null,
      mmPath: null,
      mmProj: null,
    };
  }

  function setSlotIcon(id, rolling) {
    if (!refs) return;
    refs.itemFrame.classList.toggle('has-item', !!id);
    refs.itemIcon.classList.toggle('rolling', !!rolling);
    refs.itemIcon.innerHTML = id ? itemIcon(id) : '<span class="hud-item-empty">—</span>';
  }

  function updateHUD(data) {
    if (!hud || !refs || !data) return;

    const lapText = `${data.lap}/${data.totalLaps}`;
    if (lapText !== refs.lapText) {
      refs.lapText = lapText;
      refs.lapNum.textContent = lapText;
      refs.lapNum.classList.toggle('final', data.lap === data.totalLaps);
    }

    const clockText = fmtTime(data.raceTime || 0);
    if (clockText !== refs.clockText) {
      refs.clockText = clockText;
      refs.clock.textContent = clockText;
    }

    const place = data.place || 1;
    if (place !== refs.place) {
      refs.place = place;
      refs.placeEl.textContent = `${place}º`;
      refs.placeEl.dataset.place = place <= 3 ? String(place) : 'x';
      retrigger(refs.placeEl, 'pop');
    }

    const kmh = Math.max(0, data.speedKmh || 0);
    const shown = Math.round(kmh);
    if (shown !== refs.kmh) {
      refs.kmh = shown;
      refs.speedVal.textContent = String(shown);
    }
    const pct = Math.min(1, kmh / MAX_KMH);
    refs.speedFill.style.strokeDashoffset = String(100 - pct * 100);

    const boosting = !!data.boosting;
    if (boosting !== refs.boosting) {
      refs.boosting = boosting;
      refs.speedo.classList.toggle('boost', boosting);
    }

    const rolling = data.rouletteId || null;
    if (rolling) {
      if (refs.slotId !== rolling || !refs.slotRolling) {
        refs.slotId = rolling;
        refs.slotRolling = true;
        setSlotIcon(rolling, true);
      }
    } else {
      const id = data.itemId || null;
      if (refs.slotId !== id || refs.slotRolling) {
        refs.slotId = id;
        refs.slotRolling = false;
        setSlotIcon(id, false);
      }
    }

    drawMinimap(data.minimap);
  }

  // ---------------------------------------------------------------
  // Minimapa (canvas 2D con encuadre cacheado)
  // ---------------------------------------------------------------
  function buildMinimapPath(pts) {
    const cv = refs.minimap;
    if (!cv) return;
    const W = cv.width;
    const H = cv.height;
    if (!refs.mmPath) {
      const off = document.createElement('canvas');
      refs.mmPath = off;
    }
    const off = refs.mmPath;
    off.width = W;
    off.height = H;
    const ctx = off.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    if (!pts || !pts.length) {
      refs.mmProj = null;
      return;
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }
    // El contenedor es circular: encajamos el trazado en el cuadrado inscrito
    // para que las esquinas no queden recortadas por el borde redondo.
    const pad = W * 0.16;
    const bw = maxX - minX || 1;
    const bh = maxZ - minZ || 1;
    const scale = Math.min((W - pad * 2) / bw, (H - pad * 2) / bh);
    const ox = (W - bw * scale) / 2;
    const oy = (H - bh * scale) / 2;
    refs.mmProj = (x, z) => [ox + (x - minX) * scale, oy + (z - minZ) * scale];

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    pts.forEach((p, i) => {
      const [x, y] = refs.mmProj(p.x, p.z);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 9;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(18,24,46,0.9)';
    ctx.lineWidth = 4.5;
    ctx.stroke();
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = 'rgba(255,210,63,0.85)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawMinimap(mm) {
    const cv = refs.minimap;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const pts = (mm && mm.points) || [];
    const mid = pts.length ? pts[Math.floor(pts.length / 2)] : null;
    const sig = pts.length
      ? `${pts.length}:${pts[0].x.toFixed(1)},${pts[0].z.toFixed(1)}:${mid.x.toFixed(1)},${mid.z.toFixed(1)}`
      : '0';
    if (sig !== refs.mmSig) {
      refs.mmSig = sig;
      buildMinimapPath(pts);
    }

    const W = cv.width;
    const H = cv.height;
    ctx.clearRect(0, 0, W, H);
    if (refs.mmPath) ctx.drawImage(refs.mmPath, 0, 0);
    if (!refs.mmProj) return;

    for (const k of (mm && mm.karts) || []) {
      const [x, y] = refs.mmProj(k.x, k.z);
      const isP = !!k.isPlayer;
      const r = isP ? 7 : 4.6;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = colorCss(k.color);
      ctx.fill();
      ctx.lineWidth = isP ? 3 : 1.4;
      ctx.strokeStyle = isP ? '#ffffff' : 'rgba(8,10,22,0.85)';
      ctx.stroke();
    }
  }

  // ---------------------------------------------------------------
  // Cuenta atrás y mensajes
  // ---------------------------------------------------------------
  function showCountdown(n) {
    if (countdownEl) {
      countdownEl.remove();
      countdownEl = null;
    }
    if (countdownTimer) {
      clearTimeout(countdownTimer);
      countdownTimer = null;
    }
    const go = n === 0;
    const node = el('div', 'countdown' + (go ? ' go' : ''), go ? '¡YA!' : String(n));
    layer.appendChild(node);
    countdownEl = node;
    if (go) {
      countdownTimer = setTimeout(() => {
        if (countdownEl === node) {
          node.remove();
          countdownEl = null;
        }
      }, 950);
    }
  }

  function showMessage(text, ms = 1600) {
    if (messageEl) messageEl.remove();
    messageEl = el('div', 'game-message', text);
    layer.appendChild(messageEl);
    if (messageTimer) clearTimeout(messageTimer);
    messageTimer = setTimeout(() => {
      if (messageEl) {
        messageEl.remove();
        messageEl = null;
      }
    }, ms);
  }

  // ---------------------------------------------------------------
  // Pausa
  // ---------------------------------------------------------------
  function hidePause() {
    if (pauseEl) {
      pauseEl.remove();
      pauseEl = null;
    }
    removeMenu();
  }

  function showPause(onResume, onQuit) {
    hidePause();
    const options = [
      { label: 'CONTINUAR', fn: onResume },
      { label: 'SALIR AL MENÚ', fn: onQuit },
    ];
    let idx = 0;

    pauseEl = el('div', 'ui-screen panel-screen pause-screen');
    pauseEl.innerHTML = `
      <div class="pause-panel">
        <h2 class="pause-title">PAUSA</h2>
        <div class="pause-opts"></div>
        <div class="cs-hint">↑ ↓ mover · ENTER · ESC continuar</div>
      </div>`;
    const host = pauseEl.querySelector('.pause-opts');
    const btns = options.map((o, i) => {
      const b = el('button', 'ui-btn option', o.label);
      b.type = 'button';
      b.addEventListener('mouseenter', () => sel(i, true));
      b.addEventListener('click', () => {
        sound('menu-select');
        if (o.fn) o.fn();
      });
      host.appendChild(b);
      return b;
    });

    function sel(i, withSound) {
      idx = ((i % btns.length) + btns.length) % btns.length;
      btns.forEach((b, k) => b.classList.toggle('selected', k === idx));
      if (withSound) sound('menu-move');
    }

    layer.appendChild(pauseEl);
    sel(0, false);
    setMenu((e) => {
      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
          sel(idx - 1, true);
          return true;
        case 'ArrowDown':
        case 'KeyS':
          sel(idx + 1, true);
          return true;
        case 'Enter':
        case 'NumpadEnter':
        case 'Space':
          sound('menu-select');
          if (options[idx].fn) options[idx].fn();
          return true;
        case 'Escape':
        case 'KeyP':
          sound('menu-back');
          if (onResume) onResume();
          return true;
        default:
          return false;
      }
    }, { padStart: false }); // Start (pausa) lo gestiona el juego: evita reanudar y re-pausar a la vez
  }

  // ---------------------------------------------------------------
  // Resultados (podio + tabla)
  // ---------------------------------------------------------------
  function showResults(rows, onRetry, onMenu) {
    clearScreen();
    clearHud();
    const list = rows || [];
    const top3 = list.slice(0, 3);
    const byPlace = (p) => top3.find((r) => r.place === p) || null;

    function podiumCol(r, place) {
      const color = r ? colorCss(r.color) : '#666';
      const name = r ? r.name : '';
      return `
        <div class="podium-col podium-${place}">
          <div class="podium-name" style="color:${color}">${name}</div>
          <div class="podium-block" style="background:${color}"><span>${place}</span></div>
        </div>`;
    }

    const tableRows = list
      .map((r) => {
        const color = colorCss(r.color);
        const medal = r.place === 1 ? 'gold' : r.place === 2 ? 'silver' : r.place === 3 ? 'bronze' : '';
        return `
        <tr class="${r.isPlayer ? 'result-player' : ''} ${medal}">
          <td class="rc-place">${r.place}º</td>
          <td class="rc-name"><span class="result-dot" style="background:${color}"></span>${r.name}${
            r.isPlayer ? ' <span class="you-tag">TÚ</span>' : ''
          }</td>
          <td class="rc-time">${fmtTime(r.time)}</td>
        </tr>`;
      })
      .join('');

    const node = el('div', 'ui-screen results-screen');
    node.innerHTML = `
      <div class="stripes"></div>
      <div class="results-inner">
        <h2 class="screen-title results-title">RESULTADOS</h2>
        <div class="podium">
          ${podiumCol(byPlace(2), 2)}
          ${podiumCol(byPlace(1), 1)}
          ${podiumCol(byPlace(3), 3)}
        </div>
        <table class="results-table">
          <thead><tr><th>POS</th><th>PILOTO</th><th>TIEMPO</th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
        <div class="results-buttons"></div>
        <div class="cs-hint">← → mover · ENTER · ratón</div>
      </div>`;

    const options = [
      { label: 'OTRA VEZ', fn: onRetry },
      { label: 'MENÚ', fn: onMenu },
    ];
    let idx = 0;
    const host = node.querySelector('.results-buttons');
    const btns = options.map((o, i) => {
      const b = el('button', 'ui-btn option' + (i === 0 ? ' primary' : ''), o.label);
      b.type = 'button';
      b.addEventListener('mouseenter', () => sel(i, true));
      b.addEventListener('click', () => {
        sound('menu-select');
        if (o.fn) o.fn();
      });
      host.appendChild(b);
      return b;
    });

    function sel(i, withSound) {
      idx = ((i % btns.length) + btns.length) % btns.length;
      btns.forEach((b, k) => b.classList.toggle('selected', k === idx));
      if (withSound) sound('menu-move');
    }

    mountScreen(node);
    sel(0, false);
    setMenu((e) => {
      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
        case 'ArrowUp':
        case 'KeyW':
          sel(idx - 1, true);
          return true;
        case 'ArrowRight':
        case 'KeyD':
        case 'ArrowDown':
        case 'KeyS':
          sel(idx + 1, true);
          return true;
        case 'Enter':
        case 'NumpadEnter':
        case 'Space':
          sound('menu-select');
          if (options[idx].fn) options[idx].fn();
          return true;
        case 'Escape':
          sound('menu-back');
          if (onMenu) onMenu();
          return true;
        default:
          return false;
      }
    });
  }

  function hideAll() {
    clearScreen();
    clearHud();
    if (countdownEl) {
      countdownEl.remove();
      countdownEl = null;
    }
    if (countdownTimer) {
      clearTimeout(countdownTimer);
      countdownTimer = null;
    }
    if (messageEl) {
      messageEl.remove();
      messageEl = null;
    }
    if (messageTimer) {
      clearTimeout(messageTimer);
      messageTimer = null;
    }
    hidePause();
    removeMenu();
  }

  return {
    showTitle,
    showCharacterSelect,
    showTrackSelect,
    showHUD,
    updateHUD,
    showCountdown,
    showMessage,
    showPause,
    hidePause,
    showResults,
    hideAll,
    setQualityLabel,
    cycleQuality,
  };
}
