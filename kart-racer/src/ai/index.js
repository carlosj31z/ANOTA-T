// BLOQUE 3 reemplazará este stub. Mantener la API exacta (§4.3).
// Pure pursuit simple: sigue la línea de carrera mirando ~12 m hacia delante.

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

export function createAIDriver(kart, track, opts = {}) {
  const skill = clamp(opts.skill ?? 0.7, 0, 1);
  const lookAhead = 12 + skill * 4;
  const target = kart.position.clone();
  const toTarget = { x: 0, z: 0 };

  function update(dt) {
    const length = track.length || 1;
    const t = ((kart.trackT % 1) + 1) % 1;
    const aheadT = (t + lookAhead / length) % 1;
    const point = track.getPointAt(aheadT);

    target.copy(point);
    toTarget.x = target.x - kart.position.x;
    toTarget.z = target.z - kart.position.z;

    const desired = Math.atan2(toTarget.x, toTarget.z);
    let diff = desired - kart.heading;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));

    kart.controls.steer = clamp(diff * 2.0, -1, 1);
    kart.controls.throttle = 1;
    kart.controls.brake = 0;
    kart.controls.drift = false;
    kart.controls.useItem = false;
  }

  return { update };
}
