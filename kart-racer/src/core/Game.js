// Núcleo del juego (bloque 0). Contrato §4.8.
// Máquina de estados, carrera, progreso, colisiones, cronómetro, cámara y audio.

import {
  EVENTS,
  TOTAL_LAPS,
  NUM_RACERS,
  TRACK_IDS,
} from '../shared/constants.js';
import { CHARACTERS, hasPerk } from '../shared/characters.js';
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
const BUMP_COOLDOWN = 0.5; // s entre eventos BUMP de la misma pareja
const BUMP_TRANSFER = 0.2; // fracción del impulso de choque que se intercambia
const BUMP_MAX_DV = 3; // m/s máximo de cambio de velocidad por choque
const PERK_TORBELLINO_COOLDOWN = 1; // s de cooldown del torbellino por víctima
const PERK_EVENT = 'kart:perk'; // evento propio de core: { kart, perk, victim? }
const EMPUJON_PUSH = 2; // `empujon`: su empuje sobre el rival ×2
const EMPUJON_SELF = 0.3; // `empujon`: su propio desplazamiento ×0.3

function makeRng(seed) {
  let s = (seed >>> 0) || 0x9e3779b9;
  return function rng() {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Nombre legible de un pase del composer (el build minificado renombra clases).
function passName(pass) {
  if (pass.normalMaterial && pass.gtaoMaterial) return 'GTAO';
  if (pass.nMips != null) return 'Bloom';
  if (pass.edgesRT || pass.weightsRT) return 'SMAA';
  if ('clearDepth' in pass && pass.scene && pass.camera && !pass.uniforms) return 'Render';
  if (pass._outputColorSpace !== undefined) return 'Output';
  if (pass.uniforms) return 'Shader';
  return (pass.constructor && pass.constructor.name) || 'Pass';
}

function colorCss(hex) {
  if (typeof hex === 'number') return `#${hex.toString(16).padStart(6, '0')}`;
  return hex || '#ffffff';
}

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

export function createGame(deps) {
  const { renderer, scene, camera, events, audio, ui, input, pipeline, touch } = deps;

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
    bumpTimers: new Map(),
    perkTimers: new Map(),
    bumpCount: 0,
    perkCount: 0,
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
    autotestChar: null,
    rng: null,
    boostSmooth: 0,
    touchVisible: false,
    chase: createChaseCamera(camera),
  };

  // ---------------------------------------------------------------
  // Perks implementados por core (§10.2)
  // ---------------------------------------------------------------
  // `salida` (Luna): turbo automático de 1.5 s al dar la salida (jugador o CPU).
  events.on(EVENTS.RACE_START, () => {
    for (const kart of game.karts) {
      if (!hasPerk(kart, 'salida')) continue;
      kart.applyBoost(1.5, 1, 'pad');
      game.perkCount += 1;
      events.emit(PERK_EVENT, { kart, perk: 'salida' });
    }
  });

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
    if (pipeline) pipeline.setSun(null);
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
    game.bumpTimers.clear();
    game.perkTimers.clear();
    game.bumpCount = 0;
    game.perkCount = 0;
    game.player = null;
    game.playerFinishTime = null;
    game.finishedCount = 0;
    game.finishedAll = false;
  }

  function pickOpponents(playerCharacter) {
    const others = CHARACTERS.filter((c) => !playerCharacter || c.id !== playerCharacter.id);
    // Los 7 rivales se eligen al azar (sin repetir) entre los 10 restantes.
    // En autotest hay una semilla fija (o `?seed=`) para reproducibilidad.
    shuffle(others, game.rng || Math.random);
    return others.slice(0, NUM_RACERS - 1);
  }

  function startRace(trackDef, opts = {}) {
    disposeRace();
    game.trackDef = trackDef;
    game.track = createTrack(scene, trackDef.id);
    if (pipeline) pipeline.setSun(game.track.sunLight || null);
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
        crossedFinish: false,
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
      events.emit(EVENTS.RACE_START, {});
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
    const bumpTimers = game.bumpTimers;
    const perkTimers = game.perkTimers;
    for (const [key, t] of bumpTimers) {
      const nt = t - FIXED_DT;
      if (nt <= 0) bumpTimers.delete(key);
      else bumpTimers.set(key, nt);
    }
    for (const [kart, t] of perkTimers) {
      const nt = t - FIXED_DT;
      if (nt <= 0) perkTimers.delete(kart);
      else perkTimers.set(kart, nt);
    }
    for (let i = 0; i < karts.length; i++) {
      const a = karts[i];
      const massA = a.mass || 1;
      const invA = 1 / massA;
      for (let j = i + 1; j < karts.length; j++) {
        const b = karts[j];
        const dx = b.position.x - a.position.x;
        const dz = b.position.z - a.position.z;
        const dist = Math.hypot(dx, dz);
        const min = a.radius + b.radius;
        if (dist <= 1e-4 || dist >= min) continue;

        const massB = b.mass || 1;
        const invB = 1 / massB;
        const invSum = invA + invB;
        const nx = dx / dist;
        const nz = dz / dist;
        const overlap = min - dist;

        // Reparto del empuje inversamente proporcional a la masa: el ligero cede.
        let pushA = overlap * (invA / invSum);
        let pushB = overlap * (invB / invSum);

        // `empujon` (Bruno): su empuje ×2 y su propio desplazamiento ×0.3.
        const aEmp = hasPerk(a, 'empujon');
        const bEmp = hasPerk(b, 'empujon');
        if (aEmp) {
          pushA *= EMPUJON_SELF;
          pushB *= EMPUJON_PUSH;
        }
        if (bEmp) {
          pushB *= EMPUJON_SELF;
          pushA *= EMPUJON_PUSH;
        }

        a.position.x -= nx * pushA;
        a.position.z -= nz * pushA;
        b.position.x += nx * pushB;
        b.position.z += nz * pushB;

        // Intercambio de velocidad a lo largo de la normal, repartido por masa:
        // el pesado apenas se inmuta, el ligero sale despedido.
        const rvx = b.velocity.x - a.velocity.x;
        const rvz = b.velocity.z - a.velocity.z;
        const vn = rvx * nx + rvz * nz;
        if (vn < 0) {
          const e = 0.25; // restitución
          const jimp = (-(1 + e) * vn) / invSum;
          const fax = Math.sin(a.heading);
          const faz = Math.cos(a.heading);
          const fbx = Math.sin(b.heading);
          const fbz = Math.cos(b.heading);
          let dvA = (-jimp * invA) * (nx * fax + nz * faz) * BUMP_TRANSFER;
          let dvB = (jimp * invB) * (nx * fbx + nz * fbz) * BUMP_TRANSFER;
          // `empujon`: el cambio de velocidad también se reparte a su favor.
          if (aEmp) {
            dvA *= EMPUJON_SELF;
            dvB *= EMPUJON_PUSH;
          }
          if (bEmp) {
            dvB *= EMPUJON_SELF;
            dvA *= EMPUJON_PUSH;
          }
          dvA = clamp(dvA, -BUMP_MAX_DV, BUMP_MAX_DV);
          dvB = clamp(dvB, -BUMP_MAX_DV, BUMP_MAX_DV);
          a.speed += dvA;
          b.speed += dvB;
        }

        a.speed *= 0.98;
        b.speed *= 0.98;

        // `torbellino` (Zuri): con turbo, los rivales que toca salen girando.
        // Cooldown de 1 s por víctima para no encadenar golpes.
        if (hasPerk(a, 'torbellino') && a.state.boostTime > 0 && b.state.shieldTime <= 0 && !perkTimers.has(b)) {
          b.hit('torbellino');
          perkTimers.set(b, PERK_TORBELLINO_COOLDOWN);
          game.perkCount += 1;
          events.emit(PERK_EVENT, { kart: a, victim: b, perk: 'torbellino' });
        }
        if (hasPerk(b, 'torbellino') && b.state.boostTime > 0 && a.state.shieldTime <= 0 && !perkTimers.has(a)) {
          a.hit('torbellino');
          perkTimers.set(a, PERK_TORBELLINO_COOLDOWN);
          game.perkCount += 1;
          events.emit(PERK_EVENT, { kart: b, victim: a, perk: 'torbellino' });
        }

        const key = i * 100 + j;
        if (!bumpTimers.has(key)) {
          bumpTimers.set(key, BUMP_COOLDOWN);
          events.emit(EVENTS.BUMP, { a, b });
          if (game.autotest) game.bumpCount += 1;
          // Aviso del `empujon` (una vez por choque, con el mismo cooldown del BUMP).
          if (aEmp !== bEmp) {
            game.perkCount += 1;
            if (aEmp) events.emit(PERK_EVENT, { kart: a, victim: b, perk: 'empujon' });
            else events.emit(PERK_EVENT, { kart: b, victim: a, perk: 'empujon' });
          }
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
      if (info.prevT > 0.9 && t < 0.1) {
        if (!info.crossedFinish) {
          // La parrilla arranca detrás de la meta: el primer cruce no es vuelta.
          info.crossedFinish = true;
        } else if (info.passedHalf) {
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
      }
      info.prevT = t;
      // Antes del primer cruce el kart sigue detrás de la meta: t ~0.97..0.99
      // valdría 0.98 y falsearía las posiciones de salida, así que se desplaza.
      info.progress = !info.crossedFinish && t > 0.5 ? t - 1 : (info.lap - 1) + t;
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
    const touchActive = !!(touch && touch.enabled);

    const wantPause = c.pause || (touchActive && touch.consumePause());
    if (
      wantPause &&
      (game.mode === 'race' ||
        game.mode === 'finished' ||
        game.mode === 'countdown' ||
        game.mode === 'intro')
    ) {
      if (game.paused) resume();
      else pause();
    }

    const player = game.player;
    if (!player) return;
    const pc = player.controls;

    if (game.mode === 'countdown' || game.mode === 'intro' || game.paused) {
      // Un toque de OBJETO durante la cuenta atrás no debe dispararse después.
      if (touchActive) touch.consumeUseItem();
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

      if (touchActive) {
        const t = touch.state;
        if (t.throttle > pc.throttle) pc.throttle = t.throttle;
        if (t.brake > pc.brake) pc.brake = t.brake;
        if (Math.abs(t.steer) > Math.abs(pc.steer)) pc.steer = t.steer;
        if (t.drift) pc.drift = true;
        if (touch.consumeUseItem()) pc.useItem = true;
      }

      // controls.steer: +1 = izquierda (convención del kart y la IA); el input
      // humano (teclado/mando/táctil) da +1 = derecha y se niega aquí, una sola vez.
      pc.steer = -pc.steer;
    }
  }

  // Muestra los controles táctiles en carrera y los oculta en menús/resultados/pausa.
  function updateTouchVisibility() {
    if (!touch || !touch.enabled) return;
    const active =
      !game.paused && (game.mode === 'intro' || game.mode === 'countdown' || game.mode === 'race');
    if (active && !game.touchVisible) {
      touch.show();
      game.touchVisible = true;
    } else if (!active && game.touchVisible) {
      touch.hide();
      game.touchVisible = false;
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

  function updateAudio() {
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
  function render(dt) {
    if (pipeline) {
      if (game.player) pipeline.setFocus(game.player.position);
      const target = game.player && game.player.state.boostTime > 0 ? 1 : 0;
      game.boostSmooth += (target - game.boostSmooth) * Math.min(1, dt * 8);
      pipeline.setBoost(game.boostSmooth);
      pipeline.render(dt);
    } else {
      renderer.render(scene, camera);
    }
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
      updateAudio();

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
    updateTouchVisibility();
    updateHUD();
    render(dt);
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
    // En headless la cámara de persecución se queda atrás (pocos frames lentos):
    // se recoloca sin suavizado y se refresca el HUD una vez.
    if (game.player) game.chase.snap(game.player);
    updateHUD();
    return {
      state: game.mode,
      raceTime: game.raceTime,
      finishedAll: game.finishedAll,
    };
  }

  // Registro de eventos del bus (solo autotest): cuenta cada evento y guarda el
  // `raceTime` de su primera aparición. Además de la clave base se cuentan
  // variantes con el detalle del payload (`kart:boost:pad`, `kart:hit:torbellino`,
  // `kart:perk:salida`, `...@player` si el kart es el jugador).
  const eventCounts = {};
  const eventFirst = {};
  function logEvent(key) {
    eventCounts[key] = (eventCounts[key] || 0) + 1;
    if (!(key in eventFirst)) eventFirst[key] = game.raceTime;
  }
  function installEventLog() {
    const names = new Set([...Object.values(EVENTS), PERK_EVENT]);
    for (const name of names) {
      events.on(name, (payload) => {
        logEvent(name);
        if (!payload) return;
        const detail = payload.perk || payload.by || payload.source;
        if (typeof detail === 'string') logEvent(`${name}:${detail}`);
        if (payload.kart && payload.kart.isPlayer) {
          logEvent(`${name}@player`);
          if (typeof detail === 'string') logEvent(`${name}:${detail}@player`);
        }
      });
    }
  }

  // Desglose de draw calls de un frame (solo autotest). Renderiza varias veces
  // el frame actual midiendo `renderer.info` y deja en pantalla el frame normal:
  //   sceneMain: escena sin actualizar sombras · shadow: mapa(s) de sombra
  //   total: frame completo del pipeline · passes: llamadas por pase del composer.
  function measureDrawCalls() {
    const info = renderer.info;
    const prevAuto = info.autoReset;
    const sm = renderer.shadowMap;
    const prevSmAuto = sm.autoUpdate;
    info.autoReset = false;

    sm.autoUpdate = false;
    sm.needsUpdate = false;
    info.reset();
    renderer.render(scene, camera);
    const sceneMain = info.render.calls;
    sm.autoUpdate = prevSmAuto;

    info.reset();
    renderer.render(scene, camera);
    const sceneWithShadow = info.render.calls;

    const passes = [];
    const composer = pipeline && pipeline.quality !== 'low' ? pipeline.composer : null;
    const restore = [];
    if (composer) {
      for (const pass of composer.passes) {
        const orig = pass.render;
        const name = passName(pass);
        const entry = { name, calls: 0 };
        passes.push(entry);
        pass.render = function measured(...args) {
          const before = info.render.calls;
          const r = orig.apply(this, args);
          entry.calls += info.render.calls - before;
          return r;
        };
        restore.push(() => {
          pass.render = orig;
        });
      }
    }
    if (pipeline) pipeline.render(1 / 60);
    else {
      info.reset();
      renderer.render(scene, camera);
    }
    const total = info.render.calls;
    for (const fn of restore) fn();
    info.autoReset = prevAuto;
    return {
      quality: pipeline ? pipeline.quality : 'none',
      sceneMain,
      shadow: sceneWithShadow - sceneMain,
      scene: sceneWithShadow,
      total,
      passes,
    };
  }

  function parseAutotest() {
    if (typeof window === 'undefined' || !window.location) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('autotest') === '1') {
      game.autotest = true;
      const id = params.get('track');
      if (id && TRACK_IDS.includes(id)) game.autotestTrack = id;
      const ch = params.get('char');
      if (ch) game.autotestChar = ch;
    }
    // Semilla fija en autotest (`?seed=` opcional) para reproducir los rivales.
    const seedParam = params.get('seed');
    if (seedParam != null && seedParam !== '') {
      const n = Number(seedParam);
      game.rng = makeRng(Number.isFinite(n) ? n : hashString(seedParam));
    } else if (game.autotest) {
      game.rng = makeRng(0xc0ffee);
    }
  }

  function start() {
    parseAutotest();
    if (game.autotest) {
      game.playerCharacter =
        CHARACTERS.find((c) => c.id === game.autotestChar) || CHARACTERS[0];
      const def = TRACKS.find((t) => t.id === game.autotestTrack) || TRACKS[0];
      installEventLog();
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
        get bumps() {
          return game.bumpCount;
        },
        get perks() {
          return game.perkCount;
        },
        get player() {
          return game.player;
        },
        get quality() {
          return pipeline ? pipeline.quality : 'none';
        },
        // Pipeline de render (diagnóstico: pases del composer, resolución dinámica).
        get pipeline() {
          return pipeline || null;
        },
        // El bus solo se expone en autotest para que las pruebas cuenten eventos.
        events,
        eventCounts,
        eventFirst,
        // Draw calls del ÚLTIMO frame completo (escena + sombras + postprocesado).
        drawCalls: 0,
        measureDrawCalls,
        setQuality(q) {
          if (pipeline) pipeline.setQuality(q);
          return pipeline ? pipeline.quality : 'none';
        },
        simulate,
        // Solo autotest: quita (true) o restaura (false) el driver IA del jugador
        // para poder probar el control humano (teclado) en pruebas automáticas.
        setPlayerManual(manual = true) {
          const p = game.player;
          if (!p) return false;
          if (manual) {
            game.drivers.delete(p);
          } else if (!game.drivers.has(p)) {
            game.drivers.set(p, createAIDriver(p, game.track, { skill: 0.8 }));
          }
          return !game.drivers.has(p);
        },
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
