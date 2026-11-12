// Rings that show where each gamepad's cursors are, drawn on a 2D canvas over the light. A
// stick moves a cursor before its trigger touches the light, so a player needs to see where
// it is. The rings are not in the engine's picture: photos and the tests' readback show the
// light alone.
//
// Each ring is in its player's colour, with a dark edge so it shows on bright light too, and
// carries the player's name, so colour is never the only way to tell two players apart. A
// ring fills in and grows while its trigger is held.

const BASE_RADIUS = 15;          // CSS px at power 0, before the UI scale
const POWER_RADIUS = 9;          // CSS px more at full power
const LABEL_GAP = 5;             // CSS px between a ring and its name
const FONT_PX = 14;              // the smallest text the overlay uses
// A pad put down keeps its rings, but they dim so a resting pad does not mark the light.
const REST_AFTER = 4;            // s without play before the rings dim
const REST_FADE = 2;             // s they take to dim
const REST_ALPHA = 0.3;

const finite = Number.isFinite;

// Where the gamepad cursors are now, in CSS px of the window:
// [{ px, py, color: [r, g, b], label, held, power, alpha }].
// gamepads.cursors() says best: a cursor is there even while its trigger is up. It gives each
// as fractions of the window (CONTRACTS.md does not cover it; see gamepad.js). A gamepad
// player it does not report is drawn from their poles in the hub, which are in world units.
export function gamepadCursors({ hub, gamepads, engine, width, height }) {
  const players = new Map(hub.players().map((p) => [p.id, p]));
  const out = [];
  const reported = new Set();
  const list = typeof gamepads?.cursors === 'function' ? gamepads.cursors() : null;
  for (const c of Array.isArray(list) ? list : []) {
    const p = players.get(c?.player);
    if (!p || !finite(c.x) || !finite(c.y)) continue;
    reported.add(p.id);
    const side = c.side === 'left' ? ' L' : c.side === 'right' ? ' R' : '';
    const idle = finite(c.idle) ? c.idle : 0;
    const rest = Math.min(1, Math.max(0, (idle - REST_AFTER) / REST_FADE));
    out.push({
      px: c.x * width, py: c.y * height, color: Array.isArray(c.color) ? c.color : p.color,
      label: Number.isInteger(c.pad) ? `Pad ${c.pad}${side}` : `${p.name}${side}`,
      held: !!c.held, power: finite(c.power) ? c.power : 0, alpha: 1 - (1 - REST_ALPHA) * rest,
    });
  }
  for (const pole of hub.poles()) {
    const p = players.get(pole.player);
    if (!p || p.kind !== 'gamepad' || reported.has(p.id) || !finite(pole.x) || !finite(pole.y)) continue;
    const { px, py } = engine.worldToScreen(pole.x, pole.y);
    out.push({
      px, py, color: p.color, label: p.name, held: !!pole.held, power: finite(pole.power) ? pole.power : 1,
      alpha: finite(pole.fade) ? Math.max(0, Math.min(1, pole.fade)) : 1,
    });
  }
  return out;
}

// Where a ring's name goes: centred under the ring, but always whole inside the window. A
// gamepad cursor may sit right at the window's edge (cursors stop 2% inside it), where a
// centred name would be cut off, so the name slides in from the sides, and goes above the
// ring when there is no room below. → { x, y, baseline } for a centre-aligned fillText.
export function labelPlace({ px, py, r, textWidth, width, height, k = 1 }) {
  const half = textWidth / 2 + 2 * k;     // a little room for the dark outline
  const x = Math.min(Math.max(px, half), Math.max(half, width - half));
  const gap = LABEL_GAP * k;
  const below = py + r + gap + (FONT_PX + 2) * k <= height;
  return below ? { x, y: py + r + gap, baseline: 'top' } : { x, y: py - r - gap, baseline: 'bottom' };
}

const rgba = (c, a) => `rgba(${c.slice(0, 3).map((v) => Math.round(Math.min(1, Math.max(0, Number(v) || 0)) * 255)).join(', ')}, ${a})`;

export function createCursorLayer(canvas, { hub, gamepads, engine, scale = () => 1 }) {
  const ctx = canvas.getContext('2d');
  let drawn = false;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let last = [];

  function fit() {
    dpr = Math.min(Math.max(devicePixelRatio || 1, 1), 3);
    width = innerWidth;
    height = innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    drawn = true; // a resized canvas is blank, and the next update redraws
  }
  fit();
  addEventListener('resize', fit);

  function ring(c, k) {
    const { px, py } = c;
    if (!finite(px) || !finite(py)) return;
    const power = Math.max(0, Math.min(2, c.power));
    const r = (BASE_RADIUS + POWER_RADIUS * Math.min(1, power)) * k;
    ctx.save();
    ctx.globalAlpha = 0.95 * c.alpha;
    // a dark edge under the colour, so the ring shows on white light as well as on black
    ctx.lineWidth = 5 * k;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = (c.held ? 3 : 2) * k;
    ctx.strokeStyle = rgba(c.color, 1);
    ctx.stroke();
    if (c.held) {
      ctx.fillStyle = rgba(c.color, 0.22);
      ctx.fill();
    }
    // the centre, so the exact point is clear
    ctx.beginPath();
    ctx.arc(px, py, 2.5 * k, 0, Math.PI * 2);
    ctx.fillStyle = rgba(c.color, 1);
    ctx.fill();
    if (c.label) {
      ctx.font = `600 ${Math.round(FONT_PX * k)}px system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4 * k;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.lineJoin = 'round';
      const at = labelPlace({ px, py, r, textWidth: ctx.measureText(c.label).width, width, height, k });
      ctx.textBaseline = at.baseline;
      ctx.strokeText(c.label, at.x, at.y);
      ctx.fillStyle = '#f5f6fa';
      ctx.fillText(c.label, at.x, at.y);
    }
    ctx.restore();
  }

  return {
    // → how many rings were drawn
    update() {
      const cursors = gamepadCursors({ hub, gamepads, engine, width, height });
      last = cursors;
      if (!cursors.length && !drawn) return 0;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const k = Math.max(1, Number(scale()) || 1);
      for (const c of cursors) ring(c, k);
      drawn = cursors.length > 0;
      return cursors.length;
    },
    // what the last update drew, for tests
    get cursors() { return last.map((c) => ({ ...c })); },
    dispose() {
      removeEventListener('resize', fit);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}
