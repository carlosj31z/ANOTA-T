// BLOQUE 7 reemplazará este stub. Mantener la API exacta (§4.7).
// Efectos: no-op. Cámara de persecución funcional.

import * as THREE from 'three';

export function createFX(scene, events) {
  return {
    update(dt, karts) {},
    dispose() {},
  };
}

export function createChaseCamera(camera) {
  const desired = new THREE.Vector3();
  const lookAt = new THREE.Vector3();
  const forward = new THREE.Vector3();
  let mode = 'chase';
  let shakeAmt = 0;
  let orbitAngle = 0;
  let introAngle = 0;

  function computeDesired(kart) {
    forward.copy(kart.getForward());
    if (mode === 'finish') {
      orbitAngle += 0.01;
      const r = 9;
      desired.set(
        kart.position.x + Math.cos(orbitAngle) * r,
        kart.position.y + 5,
        kart.position.z + Math.sin(orbitAngle) * r
      );
    } else if (mode === 'intro') {
      const r = 22;
      desired.set(
        kart.position.x + Math.cos(introAngle) * r,
        kart.position.y + 10,
        kart.position.z + Math.sin(introAngle) * r
      );
    } else {
      desired.copy(kart.position).addScaledVector(forward, -8);
      desired.y = kart.position.y + 3.5;
    }
    lookAt.copy(kart.position);
    lookAt.y = kart.position.y + 1.2;
  }

  function update(dt, kart) {
    if (!kart) return;
    if (mode === 'intro') introAngle += dt * 0.6;
    computeDesired(kart);

    const smooth = mode === 'intro' ? 1 - Math.exp(-dt * 3) : 1 - Math.exp(-dt * 6);
    camera.position.lerp(desired, smooth);
    camera.lookAt(lookAt);

    const boosting = kart.state && kart.state.boostTime > 0;
    const targetFov = mode === 'finish' ? 72 : boosting ? 85 : 72;
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 5);
    camera.updateProjectionMatrix();

    if (shakeAmt > 0.001) {
      camera.position.x += (Math.random() - 0.5) * shakeAmt;
      camera.position.y += (Math.random() - 0.5) * shakeAmt;
      camera.position.z += (Math.random() - 0.5) * shakeAmt;
      shakeAmt *= Math.max(0, 1 - dt * 4);
    } else {
      shakeAmt = 0;
    }
  }

  function shake(amount) {
    shakeAmt = Math.max(shakeAmt, amount);
  }

  function setMode(m) {
    mode = m || 'chase';
    if (mode === 'intro') introAngle = 0;
  }

  function snap(kart) {
    if (!kart) return;
    forward.copy(kart.getForward());
    computeDesired(kart);
    camera.position.copy(desired);
    camera.lookAt(lookAt);
  }

  return { update, shake, setMode, snap };
}
