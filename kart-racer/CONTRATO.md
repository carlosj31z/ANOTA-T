# CONTRATO DE RONDA — Rally Relámpago

Este documento es la ley de la ronda. Si algo aquí contradice a tu intuición, gana este documento.
Si algo que necesitas NO está aquí, no lo inventes en un archivo ajeno: anótalo en
`para_el_orquestador` de tu reporte.

## 0. Reglas generales

- Todo el código vive en `kart-racer/`. Rutas de este documento son relativas a `kart-racer/`.
- JavaScript ES modules, sin TypeScript. Única dependencia de runtime: `three` (ya instalada). **Prohibido añadir dependencias** o tocar `package.json` (salvo bloque 0).
- Importa Three así: `import * as THREE from 'three';` (addons: `three/addons/...`).
- **Prohibido** cargar archivos externos (texturas, modelos, audio, fuentes por URL). Todo se genera por código: geometrías, `CanvasTexture`, Web Audio API.
- **Contenido original**: no uses nombres/personajes/melodías de Mario, Nintendo ni ninguna franquicia.
- **No ejecutes `git commit`, `git push`, ni `git` que modifique estado.** Solo el orquestador commitea.
- Solo escribes los archivos de tu bloque (tabla §1). Puedes LEER cualquier archivo.
- Antes de terminar: `npm run build` dentro de `kart-racer/` debe pasar.
- Unidades: metros, segundos, radianes. Eje Y arriba.
- **Rumbo (heading)**: número `h` en radianes; vector adelante = `(Math.sin(h), 0, Math.cos(h))`. Girar a la izquierda (visto desde el kart) = aumentar `h`.
- Comentarios y textos en pantalla en español.

## 1. Propiedad de archivos

| Bloque | Escribe (exclusivo) | Lee, nunca escribe |
|---|---|---|
| 0 Fundación | `package.json`, `vite.config.js`, `index.html`, `src/main.js`, `src/core/**`, `src/shared/**`, y los **stubs iniciales** de `src/{track,kart,ai,items,audio,ui,fx}/index.js` y `src/ui/styles.css` | CONTRATO.md, SPEC.md |
| 1 Circuitos | `src/track/**` | `src/shared/**` |
| 2 Kart | `src/kart/**` | `src/shared/**` |
| 3 IA | `src/ai/**` | `src/shared/**`, `src/track/index.js` (solo la API) |
| 4 Objetos | `src/items/**` | `src/shared/**` |
| 5 Audio | `src/audio/**` | `src/shared/**` |
| 6 Interfaz | `src/ui/**` | `src/shared/**` |
| 7 Efectos/cámara | `src/fx/**` | `src/shared/**` |
| 8 Integración | lo que el orquestador indique en su brief | todo |

Cada bloque puede además crear SUS propios scripts de prueba `scripts/<nombre-indicado-en-su-brief>.mjs` y capturas `shots/<prefijo-de-su-bloque>-*.png` (archivos distintos por bloque; `scripts/autotest.mjs` es del bloque 0).

En la tanda 1, el dueño de cada carpeta **reemplaza** su stub con la implementación real, manteniendo exactamente la API exportada. Puedes crear más archivos dentro de tu carpeta.

## 2. Primitivas compartidas (`src/shared/`, bloque 0)

### `src/shared/constants.js`
```js
export const TOTAL_LAPS = 3;
export const NUM_RACERS = 8;
export const ROAD_WIDTH = 18;           // metros
export const GRAVITY = 30;              // m/s²
export const BASE_MAX_SPEED = 32;       // m/s (modificado por stats)
export const OFFROAD_SPEED_FACTOR = 0.45;
export const ITEM_IDS = ['turbo', 'peel', 'bouncer', 'seeker', 'shield', 'storm'];
export const TRACK_IDS = ['meadow', 'desert', 'snow'];
export const MUSIC_IDS = ['menu', 'meadow', 'desert', 'snow', 'results'];
export const DRIFT_SPARK_COLORS = [null, 0x3ab0ff, 0xff9a1f, 0xc04bff]; // índice = driftLevel
export const EVENTS = { /* ver §3, mismos nombres como valores string */ };
export const KEYS = { /* mapeo de teclas, ver §5 */ };
```

### `src/shared/events.js`
```js
export function createEventBus(): {
  on(name: string, fn: (payload) => void): () => void,  // devuelve función para desuscribir
  off(name: string, fn): void,
  emit(name: string, payload?: object): void,
}
```

### `src/shared/characters.js`
```js
export const CHARACTERS: Array<{
  id: string, name: string,
  species: 'fox'|'robot'|'frog'|'penguin'|'bear'|'cat'|'dino'|'rabbit',
  colors: { body: number, accent: number, kart: number, kartAccent: number },
  stats: { speed: 1..5, accel: 1..5, handling: 1..5, weight: 1..5 },  // enteros
  weightClass: 'light'|'medium'|'heavy',
}>;
```
Valores fijos (id · nombre · species · speed/accel/handling/weight · clase):
| id | name | species | spd | acc | hdl | wgt | clase |
|---|---|---|---|---|---|---|---|
| rayo | Rayo | fox | 3 | 3 | 3 | 3 | medium |
| bolt | Bolt-9 | robot | 5 | 2 | 2 | 5 | heavy |
| pipa | Pipa | frog | 2 | 5 | 4 | 1 | light |
| nieve | Nieve | penguin | 3 | 3 | 5 | 2 | light |
| bruno | Bruno | bear | 4 | 2 | 2 | 5 | heavy |
| mishi | Mishi | cat | 2 | 4 | 5 | 1 | light |
| rex | Rex | dino | 5 | 1 | 3 | 4 | heavy |
| luna | Luna | rabbit | 3 | 4 | 4 | 2 | medium |
Colores: libres, vivos, cada personaje distinguible.

### `src/shared/tracks.js`
```js
export const TRACKS: Array<{ id: 'meadow'|'desert'|'snow', name: string, description: string, musicId: string, previewColor: string /* css */ }>;
```
Nombres: meadow = "Prado Turbo", desert = "Dunas Doradas", snow = "Cumbre Helada".

## 3. Eventos (bus global, `EVENTS` en constants)

Payload siempre objeto. `kart` es la instancia Kart (§4.2).

| Constante | string | payload |
|---|---|---|
| STATE_CHANGE | `state:change` | `{ state }` |
| COUNTDOWN | `race:countdown` | `{ n }` (3,2,1,0; 0 = ¡YA!) |
| RACE_START | `race:start` | `{}` |
| LAP | `race:lap` | `{ kart, lap, isFinal }` (lap = vuelta que EMPIEZA, 2..3; isFinal si lap === TOTAL_LAPS) |
| FINISH | `race:finish` | `{ kart, place, time }` |
| DRIFT_START | `kart:drift-start` | `{ kart }` |
| DRIFT_LEVEL | `kart:drift-level` | `{ kart, level }` (1..3) |
| DRIFT_END | `kart:drift-end` | `{ kart, level }` |
| BOOST | `kart:boost` | `{ kart, source }` ('drift'\|'pad'\|'item') |
| HIT | `kart:hit` | `{ kart, by }` (by = itemId o 'wall'/'kart') |
| JUMP | `kart:jump` | `{ kart }` |
| LAND | `kart:land` | `{ kart }` |
| WALL | `kart:wall` | `{ kart, impact }` (0..1) |
| BUMP | `kart:bump` | `{ a, b }` (choque entre karts) |
| ITEM_BOX | `item:box-hit` | `{ kart, position }` |
| ITEM_GOT | `item:got` | `{ kart, itemId }` (al terminar la ruleta) |
| ITEM_USE | `item:use` | `{ kart, itemId }` |
| ITEM_EXPLODE | `item:explode` | `{ position, itemId }` |

## 4. APIs de módulo (firmas cerradas)

### 4.1 Circuitos — `src/track/index.js`
```js
export function createTrack(scene: THREE.Scene, trackId: string): Track
```
`createTrack` añade al `scene` su `group`, sus luces, y fija `scene.background` y `scene.fog`.
```js
Track {
  id, name, musicId,
  group: THREE.Group,
  length: number,                     // longitud de la línea central (m)
  roadWidth: number,
  getStartGrid(n: number): Array<{ position: THREE.Vector3, heading: number }>, // [0] = pole; parrilla 2 en fondo, detrás de la meta
  projectToTrack(pos: THREE.Vector3, hintT?: number): {
    t: number,            // 0..1 progreso a lo largo del circuito (0 = línea de meta)
    lateral: number,      // distancia con signo al centro (m), + = izquierda según sentido de carrera
    surface: 'road'|'offroad'|'wall',  // 'wall' si |lateral| supera el límite
    groundY: number,      // altura del suelo en ese punto (rampas incluidas)
    tangent: THREE.Vector3, // dirección de avance normalizada
    wallNormal: THREE.Vector3|null, // si surface==='wall', normal hacia dentro de la pista
    center: THREE.Vector3,  // punto de la línea central más cercano
  },
  isOnBoostPad(pos: THREE.Vector3): boolean,
  isOnRamp(pos: THREE.Vector3): boolean,          // true en el borde de salto (el kart sale despedido)
  itemBoxPositions: THREE.Vector3[],              // centros de las cajas (y = suelo + 1)
  getRacingLine(): THREE.Vector3[],               // ~300 puntos ordenados, cerrada, ideal para IA
  getPointAt(t: number): THREE.Vector3,           // punto central en t (0..1)
  getMinimapPoints(): Array<{ x: number, z: number }>, // ~200 puntos de la línea central
  update(dt: number, time: number): void,         // animación de escenario
  dispose(): void,                                // quita todo de la escena
}
```
`projectToTrack` debe ser rápido (se llama 8+ veces por frame): búsqueda local alrededor de `hintT` si se da.

### 4.2 Kart — `src/kart/index.js`
```js
export function createKart(scene: THREE.Scene, character: Character, opts: { isPlayer: boolean, events: EventBus }): Kart
```
```js
Kart {
  character, isPlayer,
  object3d: THREE.Group,          // ya añadido a la escena
  position: THREE.Vector3,        // === object3d.position
  heading: number,
  velocity: THREE.Vector3,
  speed: number,                  // m/s con signo a lo largo del adelante
  maxSpeed: number,
  radius: number,                 // para colisiones kart-kart (~1.3)
  controls: { throttle: 0..1, brake: 0..1, steer: -1..1, drift: boolean, useItem: boolean },
  state: {
    drifting: boolean, driftDir: -1|0|1, driftLevel: 0|1|2|3,
    boostTime: number,            // >0 mientras hay turbo
    airborne: boolean,
    spinTime: number,             // >0 mientras está girando tras golpe (sin control)
    shieldTime: number,           // >0 invencible (objeto shield)
    surface: 'road'|'offroad'|'wall',
  },
  trackT: number,                 // último t conocido (lo actualiza update)
  update(dt: number, track: Track): void,  // física completa + animación del modelo
  applyBoost(duration: number, strength?: number /* 1 por defecto */, source?: string): void,
  hit(by: string): void,          // si shieldTime>0 se ignora; si no: spinTime≈1.2, pierde velocidad, emite HIT
  setTransform(position: THREE.Vector3, heading: number): void,
  getForward(): THREE.Vector3,
  celebrate(): void,              // animación de victoria/meta
}
```
El kart lee `controls` cada frame; quién los rellena (input del jugador o IA) no le importa.
`controls.drift` mantenido = salto + derrape si hay giro; al soltar: turbo según nivel (1:0.6s, 2:1.1s, 3:1.6s).
`createKart` también construye el piloto (según `character.species`) sentado en el kart.

### 4.3 IA — `src/ai/index.js`
```js
export function createAIDriver(kart: Kart, track: Track, opts: { skill: number /* 0..1 */ }): AIDriver
AIDriver { update(dt: number, ctx: RaceContext): void }  // rellena kart.controls
```
`RaceContext = { karts: Kart[], player: Kart, places: Map<Kart, number> /* 1..8 */, items: ItemSystem, raceTime: number }`.
La IA usa `ctx.items.getHeldItem(kart)` y pone `kart.controls.useItem = true` (un frame) para usarlo.

### 4.4 Objetos — `src/items/index.js`
```js
export function createItemSystem(scene: THREE.Scene, track: Track, events: EventBus): ItemSystem
ItemSystem {
  update(dt: number, ctx: RaceContext): void, // cajas (giro, recogida, reaparición 3s), ruleta (~2s), proyectiles, trampas, y consume kart.controls.useItem
  getHeldItem(kart: Kart): string|null,
  isRolling(kart: Kart): boolean,
  getRouletteDisplay(kart: Kart): string|null, // id que se muestra ahora mismo en la ruleta (cambia rápido) o null
  dispose(): void,
}
```
Objetos: `turbo` (applyBoost 1.2s) · `peel` (cáscara que se deja detrás; el que la pisa → hit) · `bouncer` (proyectil recto que rebota en muros 3 veces, 6 s de vida) · `seeker` (proyectil teledirigido al kart de delante) · `shield` (shieldTime 7s + velocidad extra) · `storm` (golpea a todos los rivales por delante, excepto con shield). El ItemSystem es quien detecta `controls.useItem` y lo pone a false tras procesarlo.

### 4.5 Audio — `src/audio/index.js`
```js
export function createAudio(): AudioSystem
AudioSystem {
  unlock(): void,                    // llamar en el primer gesto del usuario (crea/resume AudioContext)
  bindEvents(events: EventBus): void, // se suscribe y suena SFX (solo eventos del kart jugador o globales)
  playMusic(id: 'menu'|'meadow'|'desert'|'snow'|'results'): void, // crossfade
  stopMusic(): void,
  setMusicFast(fast: boolean): void, // última vuelta: tempo +15%
  playSfx(name: string): void,       // 'menu-move','menu-select','countdown','go', etc.
  setEngine(speedRatio: number /*0..1*/, boosting: boolean, active: boolean): void,
  setMasterVolume(v: number): void,
}
```
Todo sintetizado con Web Audio API (osciladores, ruido, envolventes, secuenciador propio). Melodías originales.

### 4.6 Interfaz — `src/ui/index.js` (+ `src/ui/styles.css`, importado desde `src/ui/index.js`)
```js
export function createUI(root: HTMLElement, opts: { onSound?: (name: string) => void }): UI
UI {
  showTitle(onStart: () => void): void,
  showCharacterSelect(characters, onPick: (character) => void, onBack: () => void): void,
  showTrackSelect(tracks, onPick: (track) => void, onBack: () => void): void,
  showHUD(): void,
  updateHUD(data: {
    lap, totalLaps, place, totalRacers, raceTime /*s*/, speedKmh,
    itemId /*string|null*/, rouletteId /*string|null*/,
    minimap: { points: Array<{x,z}>, karts: Array<{ x, z, color /*css*/, isPlayer }> },
    boosting: boolean,
  }): void,
  showCountdown(n: number): void,          // 3,2,1,0(=¡YA!)
  showMessage(text: string, ms?: number): void, // p.ej. "¡ÚLTIMA VUELTA!"
  showPause(onResume: () => void, onQuit: () => void): void,
  hidePause(): void,
  showResults(rows: Array<{ place, name, color, time /*s|null*/, isPlayer }>, onRetry: () => void, onMenu: () => void): void,
  hideAll(): void,
}
```
`onSound` lo llama la UI al navegar ('menu-move', 'menu-select'). Menús navegables con flechas+Enter+Esc y ratón. Iconos de objetos dibujados con SVG/CSS inline.

### 4.7 Efectos y cámara — `src/fx/index.js`
```js
export function createFX(scene: THREE.Scene, events: EventBus): FX
FX { update(dt: number, karts: Kart[]): void, dispose(): void }
// update lee kart.state para emisores continuos (chispas de derrape del color DRIFT_SPARK_COLORS[level], llamas de turbo, polvo fuera de pista, estela de shield).
// Por eventos: estrellas en HIT, explosión en ITEM_EXPLODE, destellos en ITEM_BOX, confeti en FINISH del jugador.
// Pool de partículas (InstancedMesh o Points), máx. ~2000, sin crear objetos por frame.

export function createChaseCamera(camera: THREE.PerspectiveCamera): ChaseCamera
ChaseCamera {
  update(dt: number, kart: Kart): void,   // persecución suave, FOV 70→85 en turbo, inclinación en derrape
  shake(amount: number): void,
  setMode(mode: 'chase'|'intro'|'finish', track?: Track): void, // intro: vuelo alrededor de la parrilla; finish: órbita alrededor del kart
  snap(kart: Kart): void,                 // coloca sin suavizado
}
```

### 4.8 Core (bloque 0)
`src/main.js` crea el renderer (WebGLRenderer, antialias, sombras PCFSoft, ACESFilmic, sRGB), la escena, la cámara, el bus, el audio, la UI y el `Game` (`src/core/Game.js`).
Estados: `title → charSelect → trackSelect → intro (3 s) → countdown → race → finished → results`, y `paused` superpuesto.
Core es dueño de: input (`src/core/Input.js`, teclado + Gamepad), progreso de carrera (vueltas por cruce de `t` 0.9→0.1 con anti-trampa de mitad de vuelta, posiciones por `vueltas + t`), colisiones kart-kart (empuje esférico + evento BUMP), cronómetro, y armar `RaceContext`.
Autotest: `?autotest=1&track=<id>` salta menús, pone al jugador en piloto automático (usa createAIDriver), y expone `window.__game = { state, karts, places, raceTime, simulate(seconds) }` donde `simulate` avanza la simulación a paso fijo de 1/60 s sin renderizar. `?autotest=1` también fija `window.__game.finishedAll` cuando los 8 terminan.

## 5. Controles (KEYS en constants)

| Acción | Teclado | Mando |
|---|---|---|
| Acelerar | ↑ / W | A / RT |
| Frenar / marcha atrás | ↓ / S | B / LT |
| Girar | ← → / A D | stick izq. / cruceta |
| Saltar / derrapar | Espacio / Shift | RB |
| Usar objeto | E / Ctrl / X | X / LB |
| Pausa | Esc / P | Start |

## 6. Estética común

- Paleta saturada y alegre, cielo con degradado, sombras suaves, estilo "low-poly juguete".
- Tipografía UI: `system-ui, 'Segoe UI', sans-serif`, peso 800–900, mayúsculas con contorno/sombra marcada.
- Colores UI: amarillo `#ffd23f`, rojo `#ff3b3b`, azul `#2f80ff`, fondo oscuro translúcido `rgba(10,14,30,0.75)`.
- Rendimiento: reutilizar geometrías/materiales, `InstancedMesh` para elementos repetidos (árboles, rocas, vallas, cajas), < 300 draw calls.

## 7. Formato de reporte (último mensaje de cada agente)

```json
{"bloque":"<nombre>","status":"completado|bloqueado|error",
 "archivos":[{"path":"...","que_hace":"..."}],
 "criterios_que_dice_cumplir":["C.."],
 "supuestos":["..."],
 "no_hecho":["..."],
 "para_el_orquestador":"..."}
```

## 8. Clasificación de riesgo (orquestador)

Todo es riesgo **Bajo/Medio** (es un juego: lo peor es que se vea mal o no se pueda terminar una carrera). Medio: core (carrera no termina), kart (física rota), ai (CPU atascadas) → verificación por autotest + lente adversarial DeepSeek. Bajo: track, items, audio, ui, fx → revisión del orquestador con capturas.

## 9. Tanda 3 — Gráficos de nueva generación (enmienda)

Objetivo: dejar de parecer "geometría simple". Personajes orgánicos y expresivos, escenarios realistas con PBR, postprocesado cinematográfico. Sigue siendo 100 % procedural (sin archivos), pero se permiten todos los addons de `three/addons/...` (EffectComposer, GTAOPass, UnrealBloomPass, SMAAPass, OutputPass, Sky, RoomEnvironment, BufferGeometryUtils, SimplexNoise, etc.).

### 9.1 Nuevo bloque Render — `src/render/index.js`
```js
export function createRenderPipeline(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, opts?: { quality?: 'low'|'high'|'ultra' }): RenderPipeline
RenderPipeline {
  render(dt: number): void,             // sustituye a renderer.render(scene, camera)
  setSize(width: number, height: number): void,
  setQuality(q: 'low'|'high'|'ultra'): void,
  quality: string,
  setSun(light: THREE.DirectionalLight|null): void,  // luz de sombras del circuito
  setFocus(position: THREE.Vector3): void,            // centro del encuadre de sombras (el jugador), llamado cada frame
  setBoost(amount: number /*0..1*/): void,            // intensidad de efectos de velocidad (aberración/vignette/blur radial)
  dispose(): void,
}
```
- `low`: sin postprocesado (render directo + FXAA opcional). `high`: GTAO/SAO + bloom + grading + SMAA. `ultra`: high + resolución 1.0× con sombras 4096 + extras.
- Resolución dinámica: si el tiempo medio de frame supera 20 ms durante 2 s, baja `pixelRatio` en pasos (mín. 0.6); si baja de 12 ms, sube (máx. min(devicePixelRatio, 1.5)).
- Sombras: la shadow camera del sol sigue a `setFocus` con un frustum ajustado (±45 m) para máxima nitidez; texel-snapping para evitar parpadeo.

### 9.2 Circuitos (enmienda §4.1)
- `Track.sunLight: THREE.DirectionalLight` (la luz de sombras; `castShadow = true`).
- `createTrack` fija `scene.environment` con un mapa de entorno PMREM generado de su propio cielo (para reflejos PBR) y lo libera en `dispose()`.
- Todos los materiales pasan a `MeshStandardMaterial`/`MeshPhysicalMaterial` con texturas procedurales (CanvasTexture o DataTexture) de color + normal + roughness donde aporte.

### 9.3 Kart y piloto (enmienda §4.2)
- Modelos orgánicos: geometrías suavizadas (normales suaves, Lathe/Capsule/esferas deformadas con ruido, perfiles curvos), materiales PBR (pintura de kart con clearcoat, goma, metal cromado, pelaje/piel con sheen), sin aristas facetadas visibles en personajes.
- Expresividad: cada piloto tiene cara con ojos (párpados que parpadean, pupilas que miran hacia la dirección de giro), cejas y boca deformables. Expresiones obligatorias según estado: `neutral`, `determinado` (derrape/turbo), `eufórico` (mini-turbo nivel 3, adelantar, celebrate), `sorprendido` (golpe recibido), `mareado` (spin), `enfadado` (tras ser golpeado, 1.5 s), `contento` (en el aire / caja de objeto). API añadida: `kart.setExpression(name: string, duration?: number): void` y `kart.expression: string` (lectura).

## 10. Tanda 4 — Ventajas por personaje, 3 pilotos nuevos y Android (enmienda)

### 10.1 Personajes (`src/shared/characters.js`) — total 11
Se añaden 3 pilotos HUMANO/ANIMAL inspirados en arquetipos clásicos del género (héroe mecánico bigotudo, guerrero de artes marciales con aura de energía, marsupial salvaje y travieso). **Diseño 100 % original**: no usar nombres, emblemas, colores-firma ni vestuario reconocible de personajes existentes. Prohibido: gorra roja con letra, peto azul con botones amarillos, traje naranja con kanji, pelo negro en punta clásico, bandicoot naranja con vaqueros. `species` se amplía con `'mechanic' | 'fighter' | 'numbat'`.

| id | name | species | spd | acc | hdl | wgt | clase | Diseño obligatorio |
|---|---|---|---|---|---|---|---|---|
| max | Max Tuerca | mechanic | 3 | 4 | 3 | 3 | medium | Humano rechoncho y simpático, gran bigote castaño rizado, nariz redonda, gorra plana VERDE AZULADA con una tuerca dorada bordada, mono de trabajo MOSTAZA con bolsillos y una llave inglesa en el cinturón, guantes blancos. Kart verde azulado. |
| kenzo | Kenzo Ráfaga | fighter | 4 | 4 | 2 | 3 | medium | Joven luchador, pelo en punta exagerado de color PLATA con mechas turquesa, cinta en la frente roja, kimono de entrenamiento MORADO con cinturón negro y un emblema propio de rayo-espiral (no letras), muñequeras. Aura turquesa al turbo. Kart morado. |
| zuri | Zuri | numbat | 3 | 5 | 4 | 1 | light | Numbat (marsupial australiano real, distinto del bandicoot) de pelaje ROJIZO con rayas blancas en el lomo, hocico fino y largo, cola esponjosa erizada, gafas de aviador sobre la frente, chaleco verde lima y zapatillas. Kart lima. |

### 10.2 Ventaja (perk) por personaje — campo nuevo
Cada personaje lleva `perk: { id, name, description }` (description en español, ≤ 70 caracteres, la muestra la UI). Valores fijos y quién los implementa:

| id personaje | perk.id | perk.name | efecto exacto | implementa |
|---|---|---|---|---|
| rayo | astucia | Astucia | La carga del derrape sube un 25 % más rápido | kart |
| bolt | blindaje | Blindaje | Los golpes le dejan girando un 40 % menos tiempo | kart |
| pipa | salto_rana | Salto de rana | Saltos de rampa ×1.3 de altura y turbo 0.5 s al aterrizar | kart |
| nieve | patinador | Patinador | La penalización fuera de pista se reduce a la mitad | kart |
| bruno | empujon | Empujón | En choques empuja ×2 y él apenas se mueve | core |
| mishi | siete_vidas | Siete vidas | Ignora el primer golpe de cada vuelta | kart (escucha LAP del bus) |
| rex | rugido | Rugido | Los turbos de objetos duran un 35 % más | kart (applyBoost con source 'item') |
| luna | salida | Salida bala | Turbo de 1.5 s automático al dar la salida | core (en RACE_START) |
| max | mecanico | Mecánico | Ruleta en 0.9 s y objetos como si fuera 2 puestos peor | items |
| kenzo | aura | Aura de energía | El mini-turbo de nivel 3 dura un 50 % más | kart (+ fx: aura turquesa) |
| zuri | torbellino | Torbellino | Con turbo, los rivales que toca salen girando | core (colisiones) + fx |

Helper en shared: `export function hasPerk(kart, perkId): boolean` (`kart.character.perk.id === perkId`).

### 10.3 Controles táctiles — nuevo bloque `src/touch/index.js`
```js
export function createTouchControls(root: HTMLElement): TouchControls
TouchControls {
  enabled: boolean,                  // true si el dispositivo es táctil ('ontouchstart' in window || navigator.maxTouchPoints > 0) o ?touch=1
  state: { throttle, brake, steer /*-1..1*/, drift: boolean },
  consumeUseItem(): boolean,         // flanco del botón de objeto
  consumePause(): boolean,           // flanco del botón de pausa
  show(): void, hide(): void,        // core muestra en carrera y oculta en menús
  dispose(): void,
}
```
Diseño: mitad izquierda = volante virtual (arrastrar horizontal; o botones ◀ ▶ grandes), derecha: botón ACELERAR grande (por defecto acelerador automático activado; botón FRENO), botón DERRAPE, botón OBJETO, pausa arriba. Multitouch, botones ≥ 64 px, semitransparentes, sin bloquear el HUD.
Core fusiona: `input` de teclado/mando + `touch.state` (máximo de cada valor).

### 10.4 Android (APK) — nuevo bloque `android`
Capacitor (`@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/screen-orientation` opcional), appId `com.rallyrelampago.game`, appName `Rally Relámpago`, orientación forzada horizontal, pantalla completa inmersiva, icono procedural generado por script (PNG de rayo sobre fondo). Salida: `kart-racer/apk/rally-relampago-debug.apk` (firma debug) + script reproducible `scripts/build-apk.sh`. En móvil, calidad por defecto `low` (o `high` si el dispositivo rinde), y `devicePixelRatio` máx. 1.5.
