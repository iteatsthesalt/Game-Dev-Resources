// Gamepads through the Gamepad API: each pad is a player with two cursor poles, driven by the
// sticks, with the triggers as strength and the buttons as actions. See CONTRACTS.md.
//
// First version, written by the spine: the pure helpers are real; update() does not drive
// any poles yet. The input-audio part owns this file and replaces it.

// Sticks rest a little off centre, so anything inside `dz` of the middle counts as zero and
// the rest is stretched to start from zero again. Radial, so diagonals behave like the axes.
export function radialDeadzone(x, y, dz = 0.15) {
  const m = Math.hypot(x, y);
  if (m <= dz || m === 0) return { x: 0, y: 0 };
  const scale = Math.min(1, (m - dz) / (1 - dz)) / m;
  return { x: x * scale, y: y * scale };
}

// Small deflections give fine control and full deflection still reaches full speed.
export function responseCurve(v, k = 2) {
  return Math.sign(v) * Math.abs(v) ** k;
}

// The standard mapping's buttons, in the order the Gamepad API numbers them.
const BUTTONS = ['a', 'b', 'x', 'y', 'lb', 'rb', 'lt', 'rt', 'back', 'start', 'ls', 'rs', 'up', 'down', 'left', 'right', 'home'];

// A Gamepad → { index, id, lx, ly, rx, ry, buttons: { a: { pressed, value }, … } }
export function readPad(pad) {
  const axis = (i) => (Number.isFinite(pad.axes?.[i]) ? pad.axes[i] : 0);
  const buttons = {};
  BUTTONS.forEach((name, i) => {
    const b = pad.buttons?.[i];
    buttons[name] = { pressed: !!b?.pressed, value: Number.isFinite(b?.value) ? b.value : b?.pressed ? 1 : 0 };
  });
  return { index: pad.index, id: pad.id, lx: axis(0), ly: axis(1), rx: axis(2), ry: axis(3), buttons };
}

export function createGamepads({ engine, hub, actions, getSettings, getPads = () => navigator.getGamepads() }) {
  return {
    update(dt, time) {},
    dispose() {},
  };
}
