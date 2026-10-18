# SPEC — "Rally Relámpago" (juego de karts para PC, navegador)

Versión 1 · 2026-10-18 · Orquestador: Claude · Constructores: agentes OpenCode con DeepSeek 4.1 (`opencode/deepseek-v4.1-flash-free`)

## Objetivo real

Un juego de carreras de karts arcade, jugable en PC desde el navegador, que transmita la
experiencia de un "kart racer" clásico: derrapes con mini-turbo, cajas de objetos con
ruleta, objetos ofensivos/defensivos, 8 corredores (1 jugador + 7 CPU), 3 vueltas,
varios circuitos con temática propia, música y efectos de sonido, menús, HUD y podio.

**Todo el contenido es original.** Inspirado en el género, sin usar nombres, personajes,
música, logos ni assets de ninguna franquicia existente (nada de Mario, Nintendo, etc.).
Gráficos 3D procedurales (Three.js, geometría generada por código) y audio procedural
(Web Audio API, sintetizado en tiempo real). Cero archivos binarios de assets.

## Fuera de alcance

- Multijugador online o pantalla dividida.
- Modos batalla / contrarreloj con fantasmas / campeonato de varias copas.
- Assets descargados de internet (modelos, texturas, audio).
- Guardado de progreso.

## Stack

Vite + Three.js (única dependencia de runtime) · JavaScript ES modules (sin TypeScript) ·
proyecto autocontenido en `kart-racer/` dentro del repo, con su propio `package.json`.

## Bloques

| # | Bloque | Tanda | Checkpoint (lo que se puede mirar) |
|---|---|---|---|
| 0 | Fundación (core + shared + stubs) | 0 | `npm run build` OK; carrera completa con stubs vía `?autotest=1` |
| 1 | Circuitos (`track`) | 1 | 3 circuitos renderizados, captura de cada uno |
| 2 | Kart y piloto (`kart`) | 1 | Kart conducible, derrape con chispas de 3 niveles |
| 3 | IA (`ai`) | 1 | 7 CPU completan 3 vueltas sin atascarse |
| 4 | Objetos (`items`) | 1 | Cajas, ruleta y 6 objetos funcionando |
| 5 | Audio (`audio`) | 1 | 5 temas musicales + efectos, sin archivos |
| 6 | Interfaz (`ui`) | 1 | Menús, HUD, minimapa, resultados |
| 7 | Efectos y cámara (`fx`) | 1 | Partículas y cámara de persecución |
| 8 | Integración y pulido | 2 | Juego completo jugable de principio a fin |

## Criterios de éxito (sí/no, con evidencia)

- **C1** `cd kart-racer && npm install && npm run build` termina con código 0.
- **C2** Al abrir el juego no hay errores en consola (`console.error` / excepciones no capturadas) durante: título → selección de personaje → selección de circuito → carrera → resultados.
- **C3** Hay 8 personajes originales seleccionables, cada uno con nombre, modelo 3D propio distinguible (forma/colores) y 4 estadísticas (velocidad, aceleración, manejo, peso) que afectan a la física.
- **C4** Hay 3 circuitos con temática visual distinta (pradera, desierto, nieve), cada uno cerrado, con muros/límites, zonas fuera de pista que frenan, al menos 1 rampa o salto, placas de turbo y cajas de objetos.
- **C5** Física de kart: acelerar, frenar/marcha atrás, girar, saltito + derrape con mini-turbo de 3 niveles (chispas azul → naranja → morado), turbo al soltar, ralentización fuera de pista, choque con muros.
- **C6** 6 objetos: `turbo`, `peel`, `bouncer`, `seeker`, `shield`, `storm`; la caja da un objeto tras una ruleta visible en el HUD; el reparto depende de la posición en carrera.
- **C7** 7 corredores CPU siguen la línea de carrera, derrapan, usan objetos, y en `?autotest=1` los 8 karts (jugador en piloto automático) completan 3 vueltas en < 6 minutos simulados en todos los circuitos.
- **C8** Música procedural: tema de menú, un tema por circuito (3), tema de resultados; la música se acelera en la última vuelta. Efectos: motor que cambia de tono con la velocidad, cuenta atrás, derrape, turbo, caja, golpe, vuelta, meta.
- **C9** HUD: posición (1º–8º), vuelta X/3, objeto actual con ruleta, cronómetro, velocímetro, minimapa con los 8 karts; aviso "¡ÚLTIMA VUELTA!"; cuenta atrás 3-2-1-¡YA!.
- **C10** Menús navegables con teclado y ratón: título, selección de personaje (con estadísticas), selección de circuito, pausa (Esc), resultados con podio/tabla y opción de volver a jugar.
- **C11** Animaciones: ruedas que giran, dirección de las ruedas delanteras, inclinación en derrape, piloto que se balancea/celebra, cámara de persecución con FOV que se abre en turbo, partículas (chispas, llamas de turbo, polvo, estrellas al ser golpeado, confeti en meta).
- **C12** Rendimiento: carrera a ≥ 50 fps en Chromium headless con GPU por software a 1280×720 *o*, si el entorno no permite medirlo, < 300 draw calls por frame (`renderer.info.render.calls`).
- **C13** Ningún nombre, personaje, logotipo o melodía de franquicias existentes aparece en el código o en pantalla.
- **C14** Mando (Gamepad API) funciona además del teclado.
- **C15** Cada uno de los 11 personajes tiene una ventaja única (CONTRATO §10.2), visible en la selección, y medible en simulación (p. ej. Mishi ignora el 1er golpe de cada vuelta; Luna recibe turbo en la salida).
- **C16** 11 personajes seleccionables, incluidos 3 inspirados en arquetipos clásicos (mecánico bigotudo, luchador con aura, marsupial travieso) con diseño original que respeta las prohibiciones del CONTRATO §10.1.
- **C17** Gráficos "next-gen" (CONTRATO §9): personajes orgánicos con expresiones faciales cambiantes, escenarios PBR con cielo atmosférico y reflejos, postprocesado (AO, bloom, grading) con niveles de calidad.
- **C18** Controles táctiles en pantalla funcionales en móvil (girar, acelerar/frenar, derrapar, objeto, pausa).
- **C19** Existe un APK de Android instalable (`apk/rally-relampago-debug.apk`) generado por `scripts/build-apk.sh`, en horizontal y pantalla completa.

## Acciones que requieren permiso humano

- Publicar/desplegar el juego en un dominio público.
- Abrir un pull request.

## Bitácora

| Fecha | Cambio |
|---|---|
| 2026-10-18 | v1 creada |
| 2026-10-18 | v2: gráficos next-gen (C17), ventajas por personaje (C15), 3 pilotos nuevos (C16), táctil (C18) y APK Android (C19); móvil deja de estar fuera de alcance |
