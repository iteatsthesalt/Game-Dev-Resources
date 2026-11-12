// Mouse, pen and touch on the desktop window become the poles of one player, "Desk".
// Poles are in world units with smoothed velocity; a lifted pole glides on and fades out
// over 0.35 s, as on mobile.
//
// First version, written by the spine. The input-audio part owns this file and replaces it.

const FADE_SECONDS = 0.35;
const VELOCITY_TAU = 0.05; // s: how quickly the measured velocity follows the pointer

export function createPointer(canvas, { engine, hub, actions }) {
  const live = new Map(); // pointerId → pole (with its target position tx, ty)
  let fading = [];
  let player = null;

  const toWorld = (e) => {
    const r = canvas.getBoundingClientRect();
    return engine.screenToWorld(e.clientX - r.left, e.clientY - r.top);
  };
  // 0..2 like mobile: pens and touches that report pressure use it, everything else is 1
  const powerOf = (e) => (e.pointerType !== 'mouse' && e.pressure > 0 && e.pressure !== 0.5 ? e.pressure * 2 : 1);

  function down(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    canvas.setPointerCapture?.(e.pointerId);
    if (!player) player = hub.addPlayer({ kind: 'pointer', name: 'Desk', key: 'pointer' });
    const w = toWorld(e);
    const power = powerOf(e);
    live.set(e.pointerId, { x: w.x, y: w.y, tx: w.x, ty: w.y, vx: 0, vy: 0, power, age: 0, held: true, id: `p${e.pointerId}`, kind: 'touch', fade: 1 });
    actions.pulse(w.x, w.y, power, player.color);
  }
  function move(e) {
    const p = live.get(e.pointerId);
    if (!p) return;
    const w = toWorld(e);
    p.tx = w.x;
    p.ty = w.y;
    p.power = powerOf(e);
  }
  function up(e) {
    const p = live.get(e.pointerId);
    if (!p) return;
    live.delete(e.pointerId);
    p.held = false;
    fading.push(p);
    engine.release(p.x, p.y, p.power, p.age);
  }

  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('lostpointercapture', up);

  const pub = ({ x, y, vx, vy, power, age, held, id, kind, fade }) => ({ x, y, vx, vy, power, age, held, id, kind, fade });

  return {
    update(dt) {
      if (!player) return;
      const k = 1 - Math.exp(-dt / VELOCITY_TAU);
      for (const p of live.values()) {
        if (dt > 0) {
          p.vx += ((p.tx - p.x) / dt - p.vx) * k;
          p.vy += ((p.ty - p.y) / dt - p.vy) * k;
        }
        p.x = p.tx;
        p.y = p.ty;
        p.age += dt;
      }
      for (const p of fading) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.age += dt;
        p.fade -= dt / FADE_SECONDS;
      }
      fading = fading.filter((p) => p.fade > 0);
      hub.setPoles(player.id, [...live.values(), ...fading].map(pub));
    },
    dispose() {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('lostpointercapture', up);
      if (player) hub.removePlayer(player.id);
    },
  };
}
