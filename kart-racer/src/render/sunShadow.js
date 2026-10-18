// BLOQUE 9 — RENDER PIPELINE. Sombras que siguen al jugador (CONTRATO §9.1).
//
// Mueve `light.position` y `light.target` conservando la dirección original del
// sol, de modo que la cámara ortográfica de sombras (frustum ±45 m) siempre
// encierra al jugador con la máxima nitidez posible. Aplica texel snapping
// (redondea el centro del encuadre al tamaño de texel en el espacio de la luz)
// para evitar que las sombras "hormigueen" al avanzar.

import * as THREE from 'three';

export function createSunShadowFollower(scene, opts = {}) {
  const half = opts.half ?? 45; // frustum ortográfico ±half metros
  const distance = opts.distance ?? 240; // distancia de la luz al foco
  const mapSize = opts.mapSize ?? 2048;
  const bias = opts.bias ?? -0.0008;
  const normalBias = opts.normalBias ?? 0.08;

  let light = null;
  let currentMap = mapSize;
  const dir = new THREE.Vector3(0.5, 0.8, 0.4).normalize();
  const focus = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  function configure() {
    if (!light) return;
    const cam = light.shadow.camera;
    cam.left = -half;
    cam.right = half;
    cam.top = half;
    cam.bottom = -half;
    cam.near = 1;
    cam.far = distance + 400;
    cam.updateProjectionMatrix();
    light.shadow.bias = bias;
    light.shadow.normalBias = normalBias;
    setMapSize(currentMap);
  }

  function setMapSize(n) {
    currentMap = n;
    if (!light) return;
    if (light.shadow.mapSize.x !== n) {
      light.shadow.mapSize.set(n, n);
      // Fuerza a recrear el render target de sombras con el nuevo tamaño.
      if (light.shadow.map) {
        light.shadow.map.dispose();
        light.shadow.map = null;
      }
    }
  }

  // Registra la luz de sombras del circuito. Se puede llamar con null.
  function setSun(newLight) {
    if (light === newLight) return;
    light = newLight || null;
    if (!light) return;

    // El target debe estar en la escena para que su matrixWorld se actualice.
    if (light.target.parent !== scene) scene.add(light.target);

    dir.copy(light.position).sub(light.target.position);
    if (dir.lengthSq() < 1e-8) dir.set(0.5, 0.8, 0.4);
    dir.normalize();

    configure();
    updateTransform();
  }

  function updateTransform() {
    const cam = light.shadow.camera;

    // 1) Colocación provisional (foco sin snap) para conocer la orientación
    //    y el espacio de la luz.
    light.target.position.copy(focus);
    light.position.copy(focus).addScaledVector(dir, distance);
    light.target.updateMatrixWorld();
    light.updateMatrixWorld(true);

    cam.position.copy(light.position);
    cam.lookAt(light.target.position);
    cam.updateMatrixWorld(true);

    // 2) Texel snapping: redondea el centro al grid de texeles en space luz.
    const texel = (cam.right - cam.left) / Math.max(1, light.shadow.mapSize.x);
    tmp.copy(focus).applyMatrix4(cam.matrixWorldInverse);
    tmp.x = Math.round(tmp.x / texel) * texel;
    tmp.y = Math.round(tmp.y / texel) * texel;
    tmp.applyMatrix4(cam.matrixWorld);

    light.target.position.copy(tmp);
    light.position.copy(tmp).addScaledVector(dir, distance);
    light.target.updateMatrixWorld();
    light.updateMatrixWorld(true);
  }

  // Centro del encuadre de sombras (la posición del jugador), cada frame.
  function setFocus(position) {
    if (!light) return;
    focus.copy(position);
    updateTransform();
  }

  function dispose() {
    light = null;
  }

  return { setSun, setFocus, setMapSize, dispose, get light() { return light; } };
}
