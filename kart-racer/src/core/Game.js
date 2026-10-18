// Núcleo del juego (bloque 0). Contrato §4.8.
// Máquina de estados, carrera, progreso, colisiones, cronómetro, cámara y audio.

import {
  EVENTS,
  TOTAL_LAPS,
  NUM_RACERS,
  TRACK_IDS,
} from '../shared/constants.js';
import { CHARACTERS } from '../shared/characters.js';
import { TRACKS } from '../shared/tracks.js';
import { createTrack } from '../track/index.js';
import { createKart } from '../kart/index.js';
import { createAIDriver } from '../ai/index.js';
import { createItemSystem } from '../items/index.js';
import { createFX, createChaseCamera } from '../fx/index.js';

const FIXED_DT = 1 / 60;
const MAX_FRAME_DT = 1 / 20;
const INTRO_SECONDS = 3;
const PLAYER_FINISH_GRACE = 8; // s tras la meta del jugador antes de resultados

function colorCss(hex) {
  if (typeof hex === 'number') return `#${hex.toString(16).padStart(6, '0')}`;
  return hex || '#ffffff';
}

export function createGame(deps) {
  const { renderer, scene, camera, events, audio, ui, input } = deps;

  const game = {
    // --- estado público (para autotest, vía getters/objeto) ---
    mode: 'title',
    paused: false,
    track: null,
    trackDef: null,
    karts: [],
    drivers: new Map(),
    raceInfo: new Map(),
    places: new Map(),
    items: null,
    fx: null,
    player: null,
    playerCharacter: null,
    raceTime: 0,
    playerFinishTime: null,
    finishedCount: 0,
    finishedAll: false,
    accumulator: 0,
    time: 0,
    lastFrame: 0,
    drawCalls: 0,
    introTimer: 0,
    countdownTimer: 0,
    lastCount: 4,
    autotest: false,
    autotestTrack: TRACK_IDS[0],
    chase: createChaseCamera(camera),
  };

  // ---------------------------------------------------------------
  // Estado
  // ---------------------------------------------------------------
  function setState(m) {
    game.mode = m;
    events.emit(EVENTS.STATE_CHANGE, { state: m });
  }

  function menuMusic() {
    audio.playMusic('menu');
  }

  function showTitle() {
    setState('title');
    menuMusic();
    ui.hideAll();
    ui.showTitle(() => showCharSelect());
  }

  function showCharSelect() {
    setState('charSelect');
    menuMusic();
    ui.hideAll();
    ui.showCharacterSelect(
      CHARACTERS,
      (character) => {
        game.playerCharacter = character;
        showTrackSelect();
      },
      () => showTitle()
    );
  }

  function showTrackSelect() {
    setState('trackSelect');
    menuMusic();
    ui.hideAll();
    ui.showTrackSelect(
      TRACKS,
      (trackDef) => startRace(trackDef, { skipIntro: false }),
      () => showCharSelect()
    );
  }

  // ---------------------------------------------------------------
  // Carrera
  // ---------------------------------------------------------------
  function disposeRace() {
    if (game.track) {
      game.track.dispose();
      game.track = null;
    }
    if (game.items) {
      game.items.dispose();
      game.items = null;
    }
    if (game.fx) {
      game.fx.dispose();
      game.fx = null;
    }
    for (const kart of game.karts) {
      if (kart.object3d && kart.object3d.parent) {
        kart.object3d.parent.remove(kart.object3d);
      }
    }
    game.karts = [];
    game.drivers.clear();
    game.raceInfo.clear();
    game.places = new Map();
    game.player = null;
    game.playerFinishTime = null;
    game.finishedCount = 0;
    game.finishedAll = false;
  }

  function pickOpponents(playerCharacter) {
    const others = CHARACTERS.filter((c) => !playerCharacter || c.id !== playerCharacter.id);
    return others.slice(0, NUM_RACERS - 1);
  }

  function startRace(trackDef, opts = {}) {
    disposeRace();
    game.trackDef = trackDef;
    game.track = createTrack(scene, trackDef.id);
    game.items = createItemSystem(scene, game.track, events);
    game.fx = createFX(scene, events);

    game.raceTime = 0;
    game.accumulator = 0;
    game.finishedCount = 0;
    game.finishedAll = false;
    game.playerFinishTime = null;

    const grid = game.track.getStartGrid(NUM_RACERS);
    const opponents = pickOpponents(game.playerCharacter);

    for (let i = 0; i < NUM_RACERS; i++) {
      const isPlayer = i === 0;
      const character = isPlayer ? game.playerCharacter : opponents[i - 1];
      const kart = createKart(scene, character, { isPlayer, events });
      const slot = grid[i] || grid[grid.length - 1];
      kart.setTransform(slot.position, slot.heading);
      const proj = game.track.projectToTrack(kart.position);
      kart.trackT = proj.t;
      game.karts.push(kart);
      game.raceInfo.set(kart, {
        lap: 1,
        prevT: proj.t,
        passedHalf: false,
        finished: false,
        finishTime: null,
        finishOrder: 0,
        place: 0,
        progress: 0,
      });
      if (isPlayer) game.player = kart;
    }

    // CPU con skill escalonado 0.55..0.95
    const cpu = game.karts.filter((k) => !k.isPlayer);
    cpu.forEach((kart, idx) => {
      const skill = 0.55 + (cpu.length > 1 ? idx / (cpu.length - 1) : 1) * 0.4;
      game.drivers.set(kart, createAIDriver(kart, game.track, { skill }));
    });

    if (game.autotest && game.player) {
      game.drivers.set(game.player, createAIDriver(game.player, game.track, { skill: 0.8 }));
    }

    audio.setMusicFast(false);
    audio.playMusic(game.track.musicId);
    game.chase.setMode('intro', game.track);
    game.chase.snap(game.player);

    ui.hideAll();
    ui.showHUD();

    if (opts.skipIntro) {
      setState('race');
      game.chase.setMode('chase');
    } else {
      game.introTimer = 0;
      setState('intro');
    }
  }

  function beginCountdown() {
    game.countdownTimer = 0;
    game.lastCount = 4;
    setState('countdown');
  }

  function updateIntroAndCountdown(dt) {
    if (game.mode === 'intro') {
      game.introTimer += dt;
      if (game.introTimer >= INTRO_SECONDS) beginCountdown();
    } else if (game.mode === 'countdown') {
      game.countdownTimer += dt;
      const n = 3 - Math.floor(game.countdownTimer);
      if (n >= 1 && n !== game.lastCount) {
        game.lastCount = n;
        ui.showCountdown(n);
        events.emit(EVENTS.COUNTDOWN, { n });
      }
      if (game.countdownTimer >= 3) {
        ui.showCountdown(0);
        events.emit(EVENTS.COUNTDOWN, { n: 0 });
        events.emit(EVENTS.RACE_START, {});
        game.chase.setMode('chase');
        setState('race');
      }
    }
  }

  // ---------------------------------------------------------------
  // Simulación (paso fijo)
  // ---------------------------------------------------------------
  function raceContext() {
    return {
      karts: game.karts,
      player: game.player,
      places: game.places,
      items: game.items,
      raceTime: game.raceTime,
    };
  }

  function step(dt) {
    if (game.paused) return;
    if (game.mode !== 'race' && game.mode !== 'finished') return;

    game.raceTime += dt;
    const ctx = raceContext();

    for (const kart of game.karts) {
      const driver = game.drivers.get(kart);
      if (driver) driver.update(dt, ctx);
    }

    if (game.items) game.items.update(dt, ctx);

    for (const kart of game.karts) kart.update(dt, game.track);

    updateCollisions();
    updateProgress();
    updatePlaces();
    checkEnd();
  }

  function updateCollisions() {
    const karts = game.karts;
    for (let i = 0; i < karts.length; i++) {
      const a = karts[i];
      for (let j = i + 1; j < karts.length; j++) {
        const b = karts[j];
        const dx = b.position.x - a.position.x;
        const dz = b.position.z - a.position.z;
        const dist = Math.hypot(dx, dz);
        const min = a.radius + b.radius;
        if (dist > 1e-4 && dist < min) {
          const nx = dx / dist;
          const nz = dz / dist;
          const push = (min - dist) * 0.5;
          a.position.x -= nx * push;
          a.position.z -= nz * push;
          b.position.x += nx * push;
          b.position.z += nz * push;
          a.speed *= 0.97;
          b.speed *= 0.97;
          events.emit(EVENTS.BUMP, { a, b });
        }
      }
    }
  }

  function updateProgress() {
    for (const kart of game.karts) {
      const info = game.raceInfo.get(kart);
      if (!info || info.finished) continue;
      const t = kart.trackT;
      if (t > 0.4 && t < 0.6) info.passedHalf = true;

      // Cruce de meta hacia adelante (0.9 -> 0.1) con anti-trampa.
      if (info.prevT > 0.9 && t < 0.1 && info.passedHalf) {
        info.passedHalf = false;
        if (info.lap >= TOTAL_LAPS) {
          finishKart(kart, info);
        } else {
          info.lap += 1;
          const isFinal = info.lap === TOTAL_LAPS;
          events.emit(EVENTS.LAP, { kart, lap: info.lap, isFinal });
          if (isFinal && kart.isPlayer) {
            audio.setMusicFast(true);
            ui.showMessage('¡ÚLTIMA VUELTA!');
          }
        }
      }
      info.prevT = t;
      info.progress = (info.lap - 1) + t;
    }
  }

  function finishKart(kart, info) {
    info.finished = true;
    info.finishTime = game.raceTime;
    info.finishOrder = game.finishedCount++;
    info.place = info.finishOrder + 1;
    game.places.set(kart, info.place);
    events.emit(EVENTS.FINISH, { kart, place: info.place, time: info.finishTime });
    if (kart.isPlayer) onPlayerFinish();
  }

  function onPlayerFinish() {
    game.playerFinishTime = game.raceTime;
    game.chase.setMode('finish', game.track);
    if (game.player && game.player.celebrate) game.player.celebrate();
    if (game.mode === 'race') setState('finished');
  }

  function updatePlaces() {
    const arr = [...game.karts];
    arr.sort((a, b) => {
      const ia = game.raceInfo.get(a);
      const ib = game.raceInfo.get(b);
      if (ia.finished && ib.finished) return ia.finishOrder - ib.finishOrder;
      if (ia.finished) return -1;
      if (ib.finished) return 1;
      return ib.progress - ia.progress;
    });
    arr.forEach((kart, i) => game.places.set(kart, i + 1));
  }

  function checkEnd() {
    if (game.karts.length === 0) return;
    const all = game.karts.every((k) => game.raceInfo.get(k).finished);
    if (all) game.finishedAll = true;
    if (game.mode === 'finished' && game.playerFinishTime != null) {
      // En autotest dejamos que los 8 terminen para poder medir finishedAll.
      if (all || (!game.autotest && game.raceTime - game.playerFinishTime >= PLAYER_FINISH_GRACE)) {
        showResults();
      }
    }
  }

  function showResults() {
    const finished = game.karts
      .filter((k) => game.raceInfo.get(k).finished)
      .sort((a, b) => game.raceInfo.get(a).finishOrder - game.raceInfo.get(b).finishOrder);
    const unfinished = game.karts
      .filter((k) => !game.raceInfo.get(k).finished)
      .sort((a, b) => game.raceInfo.get(b).progress - game.raceInfo.get(a).progress);
    const ordered = [...finished, ...unfinished];

    const rows = ordered.map((kart, i) => {
      const info = game.raceInfo.get(kart);
      game.places.set(kart, i + 1);
      return {
        place: i + 1,
        name: kart.character.name,
        color: colorCss(kart.character.colors.kart),
        time: info.finished ? info.finishTime : null,
        isPlayer: kart.isPlayer,
      };
    });

    setState('results');
    audio.playMusic('results');
    ui.hideAll();
    ui.showResults(
      rows,
      () => startRace(game.trackDef, { skipIntro: false }),
      () => {
        disposeRace();
        showTitle();
      }
    );
  }

  // ---------------------------------------------------------------
  // Pausa
  // ---------------------------------------------------------------
  function pause() {
    if (game.paused) return;
    game.paused = true;
    ui.showPause(
      () => resume(),
      () => {
        game.paused = false;
        ui.hidePause();
        disposeRace();
        showTitle();
      }
    );
  }

  function resume() {
    game.paused = false;
    ui.hidePause();
  }

  // ---------------------------------------------------------------
  // Entrada / HUD
  // ---------------------------------------------------------------
  function handleInput() {
    input.update();
    const c = input.controls;

    if (
      c.pause &&
      (game.mode === 'race' || game.mode === 'finished' || game.mode === 'countdown')
    ) {
      if (game.paused) resume();
      else pause();
    }

    const player = game.player;
    if (!player) return;
    const pc = player.controls;

    if (game.mode === 'countdown' || game.mode === 'intro' || game.paused) {
      pc.throttle = 0;
      pc.brake = 0;
      pc.steer = 0;
      pc.drift = false;
      pc.useItem = false;
      return;
    }

    if (game.drivers.has(player)) return; // autotest: lo controla la IA

    if (game.mode === 'race' || game.mode === 'finished') {
      pc.throttle = c.throttle;
      pc.brake = c.brake;
      pc.steer = c.steer;
      pc.drift = c.drift;
      pc.useItem = c.useItem;
    }
  }

  function updateHUD() {
    if (game.mode !== 'race' && game.mode !== 'finished') return;
    if (!game.player || !game.track) return;
    const info = game.raceInfo.get(game.player);
    if (!info) return;

    ui.updateHUD({
      lap: Math.min(info.lap, TOTAL_LAPS),
      totalLaps: TOTAL_LAPS,
      place: game.places.get(game.player) || 1,
      totalRacers: NUM_RACERS,
      raceTime: game.raceTime,
      speedKmh: Math.abs(game.player.speed) * 3.6,
      itemId: game.items ? game.items.getHeldItem(game.player) : null,
      rouletteId: game.items ? game.items.getRouletteDisplay(game.player) : null,
      minimap: {
        points: game.track.getMinimapPoints(),
        karts: game.karts.map((k) => ({
          x: k.position.x,
          z: k.position.z,
          color: colorCss(k.character.colors.kart),
          isPlayer: k.isPlayer,
        })),
      },
      boosting: game.player.state.boostTime > 0,
    });
  }

  function updateAudio(dt) {
    if (game.mode === 'race' || game.mode === 'finished') {
      const p = game.player;
      const ratio = p ? Math.min(1, Math.abs(p.speed) / (p.maxSpeed || 1)) : 0;
      audio.setEngine(ratio, !!(p && p.state.boostTime > 0), true);
    } else {
      audio.setEngine(0, false, false);
    }
  }

  // ---------------------------------------------------------------
  // Bucle
  // ---------------------------------------------------------------
  function render() {
    renderer.render(scene, camera);
    game.drawCalls = renderer.info.render.calls;
    if (window.__game) window.__game.drawCalls = game.drawCalls;
  }

  function loop(now) {
    game.raf = requestAnimationFrame(loop);
    let dt = (now - game.lastFrame) / 1000;
    game.lastFrame = now;
    if (!isFinite(dt) || dt < 0) dt = 0;
    dt = Math.min(dt, MAX_FRAME_DT);
    game.time += dt;

    handleInput();

    if (!game.paused) {
      updateIntroAndCountdown(dt);
      updateAudio(dt);

      if (!game.autotest) {
        game.accumulator += dt;
        let guard = 0;
        while (game.accumulator >= FIXED_DT && guard < 8) {
          step(FIXED_DT);
          game.accumulator -= FIXED_DT;
          guard += 1;
        }
        if (game.accumulator > FIXED_DT * 8) game.accumulator = 0;
      }
    }

    if (game.track) game.track.update(dt, game.time);
    if (game.fx) game.fx.update(dt, game.karts);
    if (game.player) game.chase.update(dt, game.player);
    updateHUD();
    render();
  }

  // ---------------------------------------------------------------
  // Autotest
  // ---------------------------------------------------------------
  function simulate(seconds) {
    const steps = Math.max(0, Math.round(seconds / FIXED_DT));
    for (let i = 0; i < steps; i++) {
      if (game.mode !== 'race' && game.mode !== 'finished') break;
      step(FIXED_DT);
      if (game.finishedAll) break;
    }
    return {
      state: game.mode,
      raceTime: game.raceTime,
      finishedAll: game.finishedAll,
    };
  }

  function parseAutotest() {
    if (typeof window === 'undefined' || !window.location) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('autotest') === '1') {
      game.autotest = true;
      const id = params.get('track');
      if (id && TRACK_IDS.includes(id)) game.autotestTrack = id;
    }
  }

  function start() {
    parseAutotest();
    if (game.autotest) {
      game.playerCharacter = CHARACTERS[0];
      const def = TRACKS.find((t) => t.id === game.autotestTrack) || TRACKS[0];
      window.__game = {
        get state() {
          return game.mode;
        },
        get karts() {
          return game.karts;
        },
        get places() {
          return game.places;
        },
        get raceTime() {
          return game.raceTime;
        },
        get finishedAll() {
          return game.finishedAll;
        },
        drawCalls: 0,
        simulate,
      };
      startRace(def, { skipIntro: true });
    } else {
      showTitle();
    }
    game.lastFrame = performance.now();
    game.raf = requestAnimationFrame(loop);
  }

  function stop() {
    if (game.raf) cancelAnimationFrame(game.raf);
    game.raf = 0;
  }

  Object.defineProperty(game, 'state', {
    get() {
      return game.mode;
    },
    enumerable: true,
  });
  Object.assign(game, {
    start,
    stop,
    simulate,
    setState,
    startRace,
    disposeRace,
    step,
    pause,
    resume,
    showResults,
  });

  return game;
}
