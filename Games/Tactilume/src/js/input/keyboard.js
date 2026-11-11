// Keys for desktop and switch access (the list is in CONTRACTS.md).
//
// There is one keyboard cursor. It sits at the centre to begin with; Space drops a
// pole on it (taken from the mouse when the mouse is over the light) and lifts it
// again, and the arrow keys move it. Number keys play that many fingers in a small
// ring around the mouse, or around the cursor when there is no mouse. Presses are
// announced through the pointers' events, so they ring and chime like touches do.

import { approach, clamp } from '../core/util.js';
import { SCENE_FIELDS } from '../core/scene.js';

const RING_RADIUS = 0.18;  // world units
const RING_SPIN = 0.25;    // rad/s: the ring turns slowly so it never looks frozen
const ARROW_SPEED = 0.9;   // world units / s
const FADE_SECONDS = 0.35; // a released key pole fades like a lifted touch
const VELOCITY_TAU = 0.06; // s
const COAST_TAU = 0.12;    // s
const MAX_STEP = 0.05;     // s; a longer gap (a hidden tab) is not caught up
const EDGE = 0.97;         // the cursor stays just inside the screen
const MAX_SYMMETRY = SCENE_FIELDS.get('symmetry').max;

const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };

// Focused controls that use Space or the arrows themselves keep them. Space presses every
// kind of button. The arrows are kept only by widgets that move a choice or a value with
// them, and inside a dialog, whose body they scroll; a plain button such as the open
// button leaves them to the light. Text fields and other inputs never get here (isTyping).
const ARROW_WIDGETS = ['tab', 'tablist', 'radio', 'radiogroup', 'slider', 'menuitem', 'option', 'listbox', 'spinbutton', 'scrollbar'];
const byRole = (roles) => roles.map((r) => `[role="${r}"]`);
const KEEPS_SPACE = ['button', 'a[href]', 'summary', 'audio', 'video', ...byRole(['button', 'switch', 'checkbox', ...ARROW_WIDGETS])].join(',');
const KEEPS_ARROWS = ['audio', 'video', ...byRole([...ARROW_WIDGETS, 'dialog'])].join(',');

function isTyping(el) {
  if (!el || !el.tagName) return false;
  return el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT';
}

const keeps = (el, selector) => !!(el && typeof el.closest === 'function' && el.closest(selector));

// AltGr types characters (on many layouts it is the only way to type "[" and "]"),
// so it is not a shortcut modifier, but then only the character counts, not the key.
const altGraph = (e) => typeof e.getModifierState === 'function' && e.getModifierState('AltGraph');

// Letters by what the key says, so shortcuts follow the printed labels; by position
// on layouts without Latin letters.
function letterOf(e, byCode) {
  if (typeof e.key === 'string' && /^[a-z]$/i.test(e.key)) return e.key.toLowerCase();
  const m = byCode && /^Key([A-Z])$/.exec(e.code || '');
  return m ? m[1].toLowerCase() : null;
}

// 1-9, and 0 for ten. By position first, because some layouts need Shift for digits.
function digitOf(e, byCode) {
  const m = byCode && /^(?:Digit|Numpad)([0-9])$/.exec(e.code || '');
  const d = m ? m[1] : typeof e.key === 'string' && /^[0-9]$/.test(e.key) ? e.key : null;
  return d === null ? 0 : d === '0' ? 10 : Number(d);
}

function bracketOf(e, byCode) {
  if (e.key === '[' || e.key === ']') return e.key;
  if (!byCode) return null;
  return e.code === 'BracketLeft' ? '[' : e.code === 'BracketRight' ? ']' : null;
}

export function createKeyboard({ store, actions, pointers }) {
  const canvas = pointers && pointers.target;
  const clientToWorld = pointers && typeof pointers.clientToWorld === 'function' ? pointers.clientToWorld : null;
  const mouse = { x: 0, y: 0, over: false }; // client px
  const cursor = { x: 0, y: 0 };             // world units
  const digitsDown = [];                     // [{ code, n }], oldest first
  const arrowsDown = new Set();
  const fading = [];                         // [{ pole, gone }]
  let ring = null;                           // { n, spin, poles } while a number key is held
  let dot = null;                            // the Space pole
  let serial = 0;
  let lastStep = 0;

  const commands = {
    h: () => actions.toggleUI(),
    p: () => actions.photo(),
    r: () => actions.toggleRecord(),
    s: () => {
      const s = store.scene.symmetry;
      store.setScene({ symmetry: s >= MAX_SYMMETRY ? 1 : s + 1 }, { source: 'keyboard' });
    },
    m: () => store.setScene({ mirror: !store.scene.mirror }, { source: 'keyboard' }),
    n: () => actions.surprise(),
    a: () => actions.toggleAutopilot(),
    f: () => actions.toggleFullscreen(),
    '[': () => actions.stepPreset(-1),
    ']': () => actions.stepPreset(1),
  };

  function run(command) {
    try {
      const result = command();
      if (result && typeof result.then === 'function') result.catch((err) => console.warn('Tactilume: a keyboard shortcut failed', err));
    } catch (err) {
      console.warn('Tactilume: a keyboard shortcut failed', err);
    }
  }

  function announce(name, payload) {
    if (pointers && typeof pointers.relay === 'function') pointers.relay(name, payload);
  }

  function aspect() {
    const r = canvas ? canvas.getBoundingClientRect() : null;
    const w = r && r.width ? r.width : innerWidth;
    const h = r && r.height ? r.height : innerHeight;
    return h > 0 ? w / h : 1;
  }

  function mouseWorld() {
    if (!mouse.over || !clientToWorld) return null;
    const w = clientToWorld(mouse.x, mouse.y);
    return w && Number.isFinite(w.x) && Number.isFinite(w.y) ? w : null;
  }

  const anchor = () => mouseWorld() || cursor;

  function makePole(x, y) {
    const pole = { x, y, vx: 0, vy: 0, power: 1, age: 0, held: true, id: 'k' + serial++, kind: 'touch', fade: 1 };
    announce('down', { x, y, power: 1, id: pole.id, kind: 'touch' });
    return pole;
  }

  function release(pole) {
    pole.held = false;
    announce('up', { x: pole.x, y: pole.y, vx: pole.vx, vy: pole.vy, power: 1, heldFor: pole.age, id: pole.id });
    fading.push({ pole, gone: 0 });
  }

  function ringSpot(i, n, spin, a) {
    if (n === 1) return a;
    const angle = spin + (i / n) * Math.PI * 2;
    return { x: a.x + Math.cos(angle) * RING_RADIUS, y: a.y + Math.sin(angle) * RING_RADIUS };
  }

  // A new chord replaces the old one whole: its fingers lift and the new ones land.
  function setRing(n) {
    if (ring && ring.n === n) return;
    if (ring) ring.poles.forEach(release);
    ring = null;
    if (!n) return;
    const a = anchor();
    const spin = Math.PI / 2; // first finger at the top
    ring = { n, spin, poles: [] };
    for (let i = 0; i < n; i++) {
      const s = ringSpot(i, n, spin, a);
      ring.poles.push(makePole(s.x, s.y));
    }
  }

  function toggleDot() {
    if (dot) {
      release(dot);
      dot = null;
      return;
    }
    const m = mouseWorld();
    const asp = aspect();
    if (m) {
      cursor.x = clamp(m.x, -asp * EDGE, asp * EDGE);
      cursor.y = clamp(m.y, -EDGE, EDGE);
    }
    dot = makePole(cursor.x, cursor.y);
  }

  function moveTo(p, x, y, dt) {
    if (dt > 0) {
      const k = approach(dt, VELOCITY_TAU);
      p.vx += ((x - p.x) / dt - p.vx) * k;
      p.vy += ((y - p.y) / dt - p.vy) * k;
    }
    p.x = x;
    p.y = y;
  }

  // Advances the keyboard poles to now. main asks for them once a frame, and the
  // contract gives the keyboard no update(dt), so it keeps its own clock.
  function step() {
    const now = performance.now();
    const dt = lastStep ? Math.min((now - lastStep) / 1000, MAX_STEP) : 0;
    if (lastStep && dt < 1e-4) return; // asked twice in one frame
    lastStep = now;

    let dx = 0, dy = 0;
    for (const key of arrowsDown) { dx += ARROWS[key][0]; dy += ARROWS[key][1]; }
    const len = Math.hypot(dx, dy);
    if (len > 0) {
      const asp = aspect();
      cursor.x = clamp(cursor.x + (dx / len) * ARROW_SPEED * dt, -asp * EDGE, asp * EDGE);
      cursor.y = clamp(cursor.y + (dy / len) * ARROW_SPEED * dt, -EDGE, EDGE);
    }
    if (dot) {
      moveTo(dot, cursor.x, cursor.y, dt);
      dot.age += dt;
    }
    if (ring) {
      ring.spin += RING_SPIN * dt;
      const a = anchor();
      ring.poles.forEach((p, i) => {
        const s = ringSpot(i, ring.n, ring.spin, a);
        moveTo(p, s.x, s.y, dt);
        p.age += dt;
      });
    }
    const k = Math.exp(-dt / COAST_TAU);
    for (let i = fading.length - 1; i >= 0; i--) {
      const f = fading[i];
      const p = f.pole;
      f.gone += dt;
      p.age += dt;
      p.x += p.vx * COAST_TAU * (1 - k);
      p.y += p.vy * COAST_TAU * (1 - k);
      p.vx *= k;
      p.vy *= k;
      p.fade = Math.max(0, 1 - f.gone / FADE_SECONDS);
      if (f.gone >= FADE_SECONDS) fading.splice(i, 1);
    }
  }

  function onKeyDown(e) {
    if (e.defaultPrevented || e.isComposing) return;
    const altGr = altGraph(e);
    if ((e.ctrlKey || e.metaKey || e.altKey) && !altGr) return;
    const focus = document.activeElement;
    if (isTyping(e.target) || isTyping(focus)) return;
    const byCode = !altGr;

    if (ARROWS[e.key]) {
      if (keeps(focus, KEEPS_ARROWS)) return;
      e.preventDefault();
      arrowsDown.add(e.key);
      return;
    }
    if (e.code === 'Space' || e.key === ' ') {
      if (keeps(focus, KEEPS_SPACE)) return;
      e.preventDefault();
      if (!e.repeat) toggleDot();
      return;
    }
    const n = digitOf(e, byCode);
    if (n) {
      e.preventDefault();
      if (e.repeat) return;
      const code = e.code || e.key;
      const known = digitsDown.findIndex((d) => d.code === code);
      if (known >= 0) digitsDown.splice(known, 1);
      digitsDown.push({ code, n });
      setRing(n);
      return;
    }
    const command = commands[letterOf(e, byCode)] || commands[bracketOf(e, byCode)];
    if (!command) return;
    e.preventDefault();
    if (!e.repeat) run(command);
  }

  function onKeyUp(e) {
    if (ARROWS[e.key]) {
      arrowsDown.delete(e.key);
      return;
    }
    const code = e.code || e.key;
    let i = digitsDown.findIndex((d) => d.code === code);
    if (i < 0) {
      const n = digitOf(e, true);
      i = n ? digitsDown.findIndex((d) => d.n === n) : -1;
    }
    if (i < 0) return;
    digitsDown.splice(i, 1);
    const top = digitsDown[digitsDown.length - 1];
    setRing(top ? top.n : 0);
  }

  function onPointerMove(e) {
    if (e.pointerType === 'touch') return;
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.over = !!canvas && e.target === canvas;
  }
  const onPointerLeave = () => { mouse.over = false; };

  // keys held while the window loses focus never report coming up
  function letGo() {
    arrowsDown.clear();
    digitsDown.length = 0;
    setRing(0);
  }
  const onVisibility = () => { if (document.hidden) letGo(); };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  document.documentElement.addEventListener('pointerleave', onPointerLeave);
  window.addEventListener('blur', letGo);
  document.addEventListener('visibilitychange', onVisibility);

  return {
    poles() {
      step();
      const out = [];
      if (ring) for (const p of ring.poles) out.push({ ...p });
      if (dot) out.push({ ...dot });
      for (const f of fading) out.push({ ...f.pole });
      return out;
    },

    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('pointermove', onPointerMove, { passive: true });
      document.documentElement.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('blur', letGo);
      document.removeEventListener('visibilitychange', onVisibility);
      ring = null;
      dot = null;
      digitsDown.length = 0;
      arrowsDown.clear();
      fading.length = 0;
    },
  };
}
