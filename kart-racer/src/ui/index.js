// BLOQUE 6 reemplazará este stub. Mantener la API exacta (§4.6).
// Pantallas mínimas navegables con ratón.

import './styles.css';

function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html != null) node.innerHTML = html;
  return node;
}

function colorCss(hex) {
  if (typeof hex === 'number') return `#${hex.toString(16).padStart(6, '0')}`;
  return hex || '#ffffff';
}

export function createUI(root, opts = {}) {
  const onSound = opts.onSound || (() => {});

  const layer = el('div', 'ui-layer');
  root.appendChild(layer);

  let screen = null;
  let hud = null;
  let countdown = null;
  let messageBox = null;
  let pauseBox = null;
  let messageTimer = null;

  function mount(node) {
    if (screen) screen.remove();
    screen = node;
    layer.appendChild(screen);
  }

  function clearScreen() {
    if (screen) {
      screen.remove();
      screen = null;
    }
  }

  function sound(name) {
    try {
      onSound(name);
    } catch (e) {
      /* ignore */
    }
  }

  function showTitle(onStart) {
    const node = el('div', 'ui-screen ui-centered title-screen');
    node.appendChild(el('h1', 'game-title', 'RALLY RELÁMPAGO'));
    node.appendChild(el('p', 'game-subtitle', 'Carreras de karts · 8 pilotos · 3 circuitos'));
    const btn = el('button', 'ui-btn ui-btn-primary', 'JUGAR');
    btn.addEventListener('click', () => {
      sound('menu-select');
      onStart && onStart();
    });
    node.appendChild(btn);
    mount(node);
  }

  function showCharacterSelect(characters, onPick, onBack) {
    const node = el('div', 'ui-screen ui-centered panel-screen');
    node.appendChild(el('h2', 'screen-title', 'ELIGE PILOTO'));
    const grid = el('div', 'char-grid');
    for (const c of characters) {
      const card = el('button', 'char-card');
      const swatch = el('span', 'char-swatch');
      swatch.style.background = colorCss(c.colors.kart);
      card.appendChild(swatch);
      card.appendChild(el('span', 'char-name', c.name));
      card.appendChild(
        el(
          'span',
          'char-stats',
          `VEL ${c.stats.speed} · ACE ${c.stats.accel} · MAN ${c.stats.handling} · PES ${c.stats.weight}`
        )
      );
      card.addEventListener('click', () => {
        sound('menu-select');
        onPick && onPick(c);
      });
      grid.appendChild(card);
    }
    node.appendChild(grid);
    const back = el('button', 'ui-btn', 'VOLVER');
    back.addEventListener('click', () => {
      sound('menu-move');
      onBack && onBack();
    });
    node.appendChild(back);
    mount(node);
  }

  function showTrackSelect(tracks, onPick, onBack) {
    const node = el('div', 'ui-screen ui-centered panel-screen');
    node.appendChild(el('h2', 'screen-title', 'ELIGE CIRCUITO'));
    const list = el('div', 'track-list');
    for (const t of tracks) {
      const card = el('button', 'track-card');
      const swatch = el('span', 'track-swatch');
      swatch.style.background = t.previewColor;
      card.appendChild(swatch);
      const info = el('span', 'track-info');
      info.appendChild(el('span', 'track-name', t.name));
      info.appendChild(el('span', 'track-desc', t.description));
      card.appendChild(info);
      card.addEventListener('click', () => {
        sound('menu-select');
        onPick && onPick(t);
      });
      list.appendChild(card);
    }
    node.appendChild(list);
    const back = el('button', 'ui-btn', 'VOLVER');
    back.addEventListener('click', () => {
      sound('menu-move');
      onBack && onBack();
    });
    node.appendChild(back);
    mount(node);
  }

  function showHUD() {
    clearScreen();
    if (hud) hud.remove();
    hud = el('div', 'hud');
    hud.innerHTML = `
      <div class="hud-top">
        <div class="hud-box"><span class="hud-label">VUELTA</span><span id="hud-lap">1/3</span></div>
        <div class="hud-box"><span class="hud-label">POS</span><span id="hud-place">1</span></div>
        <div class="hud-box"><span class="hud-label">TIEMPO</span><span id="hud-time">0.00</span></div>
      </div>
      <div class="hud-bottom">
        <div class="hud-box hud-speed"><span class="hud-label">KM/H</span><span id="hud-speed">0</span></div>
        <div class="hud-item" id="hud-item">—</div>
      </div>
      <div class="minimap" id="hud-minimap"></div>
    `;
    layer.appendChild(hud);
  }

  function updateHUD(data) {
    if (!hud) return;
    const set = (id, text) => {
      const n = hud.querySelector(id);
      if (n) n.textContent = text;
    };
    set('#hud-lap', `${data.lap}/${data.totalLaps}`);
    set('#hud-place', `${data.place}/${data.totalRacers}`);
    set('#hud-time', Number(data.raceTime || 0).toFixed(2));
    set('#hud-speed', String(Math.round(data.speedKmh || 0)));
    set('#hud-item', data.itemId || '—');

    const map = hud.querySelector('#hud-minimap');
    if (map && data.minimap) {
      map.innerHTML = '';
      const pts = data.minimap.points || [];
      if (pts.length) {
        let minX = Infinity;
        let maxX = -Infinity;
        let minZ = Infinity;
        let maxZ = -Infinity;
        for (const p of pts) {
          minX = Math.min(minX, p.x);
          maxX = Math.max(maxX, p.x);
          minZ = Math.min(minZ, p.z);
          maxZ = Math.max(maxZ, p.z);
        }
        const w = maxX - minX || 1;
        const h = maxZ - minZ || 1;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 100 100');
        svg.setAttribute('preserveAspectRatio', 'none');
        const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        poly.setAttribute(
          'points',
          pts.map((p) => `${((p.x - minX) / w) * 100},${((p.z - minZ) / h) * 100}`).join(' ')
        );
        poly.setAttribute('fill', 'none');
        poly.setAttribute('stroke', '#ffd23f');
        poly.setAttribute('stroke-width', '2');
        svg.appendChild(poly);
        const scale = Math.min(w, h);
        for (const k of data.minimap.karts || []) {
          const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          const cx = ((k.x - minX) / w) * 100;
          const cy = ((k.z - minZ) / h) * 100;
          const r = k.isPlayer ? 3.5 : 2.2;
          dot.setAttribute('cx', String(cx));
          dot.setAttribute('cy', String(cy));
          dot.setAttribute('r', String(r));
          dot.setAttribute('fill', k.isPlayer ? '#ffffff' : colorCss(k.color));
          dot.setAttribute('stroke', '#000');
          dot.setAttribute('stroke-width', '0.5');
          svg.appendChild(dot);
        }
        map.appendChild(svg);
      }
    }
  }

  function showCountdown(n) {
    if (countdown) countdown.remove();
    countdown = el('div', 'countdown', n === 0 ? '¡YA!' : String(n));
    layer.appendChild(countdown);
  }

  function showMessage(text, ms = 1600) {
    if (messageBox) messageBox.remove();
    messageBox = el('div', 'game-message', text);
    layer.appendChild(messageBox);
    if (messageTimer) clearTimeout(messageTimer);
    messageTimer = setTimeout(() => {
      if (messageBox) {
        messageBox.remove();
        messageBox = null;
      }
    }, ms);
  }

  function showPause(onResume, onQuit) {
    hidePause();
    pauseBox = el('div', 'ui-screen ui-centered pause-screen');
    pauseBox.appendChild(el('h2', 'screen-title', 'PAUSA'));
    const resume = el('button', 'ui-btn ui-btn-primary', 'CONTINUAR');
    resume.addEventListener('click', () => {
      sound('menu-select');
      onResume && onResume();
    });
    const quit = el('button', 'ui-btn', 'SALIR AL MENÚ');
    quit.addEventListener('click', () => {
      sound('menu-move');
      onQuit && onQuit();
    });
    pauseBox.appendChild(resume);
    pauseBox.appendChild(quit);
    layer.appendChild(pauseBox);
  }

  function hidePause() {
    if (pauseBox) {
      pauseBox.remove();
      pauseBox = null;
    }
  }

  function showResults(rows, onRetry, onMenu) {
    clearScreen();
    const node = el('div', 'ui-screen ui-centered panel-screen');
    node.appendChild(el('h2', 'screen-title', 'RESULTADOS'));
    const table = el('table', 'results-table');
    table.innerHTML = '<thead><tr><th>#</th><th>Piloto</th><th>Tiempo</th></tr></thead>';
    const tbody = el('tbody');
    for (const r of rows) {
      const tr = el('tr', r.isPlayer ? 'result-player' : '');
      tr.appendChild(el('td', null, String(r.place)));
      const nameCell = el('td', null, '');
      const dot = el('span', 'result-dot');
      dot.style.background = colorCss(r.color);
      nameCell.appendChild(dot);
      nameCell.appendChild(document.createTextNode(r.name));
      tr.appendChild(nameCell);
      tr.appendChild(el('td', null, r.time == null ? '—' : `${r.time.toFixed(2)} s`));
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    node.appendChild(table);
    const retry = el('button', 'ui-btn ui-btn-primary', 'VOLVER A JUGAR');
    retry.addEventListener('click', () => {
      sound('menu-select');
      onRetry && onRetry();
    });
    const menu = el('button', 'ui-btn', 'MENÚ');
    menu.addEventListener('click', () => {
      sound('menu-move');
      onMenu && onMenu();
    });
    node.appendChild(retry);
    node.appendChild(menu);
    mount(node);
  }

  function hideAll() {
    clearScreen();
    if (hud) {
      hud.remove();
      hud = null;
    }
    if (countdown) {
      countdown.remove();
      countdown = null;
    }
    if (messageBox) {
      messageBox.remove();
      messageBox = null;
    }
    hidePause();
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
  };
}
