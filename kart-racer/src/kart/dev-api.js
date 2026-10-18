// Bloque 2 — Solo para herramientas de desarrollo (galería). No lo importa el
// juego, así que no entra en el bundle de producción. Reexporta THREE y la
// API de construcción del kart para poder montar escenas desde Playwright.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createKart } from './index.js';
import { CHARACTERS } from '../shared/characters.js';

export { THREE, RoomEnvironment, createKart, CHARACTERS };
