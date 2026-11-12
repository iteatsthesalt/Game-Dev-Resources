// 52-input.js: every device turned into the one InputFrame of 20-sim.js: the keyboard and the mouse, touch (a
// stick and two buttons, drawn in #touch) and gamepads; pausing, and vibration.
// Owns: Input
// Public:
//   Input.sample() -> InputFrame   the input for the next simulation step. Always the same object, refilled: it
//                                  allocates nothing. 90-game.js calls it once for each step. Its fields are
//                                  those of Sim.NO_INPUT, named in the table FIELD at the top of this file:
//                                    moveX, moveY   the move vector, length at most 1 (+y runs down the screen)
//                                    aimX, aimY     a unit aim vector, which counts only while aim is true
//                                    A, B           the two buttons, the trade and the heave: true in exactly one
//                                                   sample for each press, however short the press and however
//                                                   many steps a frame runs. A press waits for its sample (up to
//                                                   8 of each button wait); presses are taken only while a run
//                                                   is in play.
//   Input.FIELDS                   that table: {moveX, moveY, aimX, aimY, aim, A, B} -> the frame's field names
//   Input.button(id, opts)         sets up the touch button 'A' or 'B'. opts, each one optional and kept until it
//                                  is given again: icon (an element, such as a Glyphs canvas; a short text; or
//                                  null for the button's own letter), cooldown (0..1: the share of a wait still
//                                  to run, shown as a pale wedge), charges (a number shown on the button, or null
//                                  for none), hidden (true takes the button away), label (what a screen reader
//                                  calls it). Cheap to call every frame: the page changes only when a value does.
//   Input.onPause(fn) -> off()     fn(device) when the player asks to pause a run: Escape or P, the touch pause
//                                  button, Start on a pad. While nobody listens, pausing opens the settings
//                                  screen (Settings.open), or a plain "Paused" screen in a build without it.
//   Input.buzz(ms) -> boolean      a short vibration of the phone, or of the pad in use. Does nothing and returns
//                                  false unless 'input.haptics' is on and the device allows it.
//   Input.device                   'keys' | 'touch' | 'pad': what the player used last ('touch' at first on a touch
//                                  screen, else 'keys'). A value. A change posts Plat.emit('device', name).
//
// The devices
//   Keys     W A S D or the arrows move, and a diagonal has length 1. Space or Shift is button A, Q or E button
//            B, Escape or P pauses. The keys count during a run with no screen open: an open screen keeps its
//            keys (Escape there is UI.back). Letting go always counts, and every key is let go when the window
//            loses focus, the page is hidden or the game changes state.
//   Mouse    with 'input.aim' 'pointer', while the keys and the mouse are in use, aim points from the player to
//            the ground under the pointer (Gfx.screenToWorld) and is true. Otherwise aim is false and every
//            voice picks its own target.
//   Touch    the controls show once the screen has been touched, during a run while nothing pauses it, and hide
//            again when a key or a pad is used. The first thumb that lands on the game on the stick side (the
//            half away from the buttons) holds the stick: 'floating' puts it where the thumb lands and drags it
//            along when the thumb runs past the rim; 'fixed' keeps it in the lower corner. The knob follows the
//            thumb and is held to the rim; the move grows evenly from the dead zone to full at the rim. Buttons A
//            (the larger) and B sit in the other lower corner, at least 64px across, and a small pause button in
//            the top corner on their side. 'input.hand' 'left' mirrors it all. Everything keeps clear of the
//            safe-area insets (the padding of #touch) and of each other, in both orientations; 'ui.scale' sizes
//            it, and it shrinks where a small screen leaves no room. Pointer events with pointer capture:
//            fingers at once, a finger that slides off a button, one lifted outside the window, pointercancel.
//   Gamepad  the standard mapping. The left stick (or the d-pad) moves and the right stick aims, with the dead
//            zone. The lower face button (0) or the right bumper is A, the right face button (1) or the left
//            bumper is B, Start pauses. The pad used last wins. While a screen is open, the d-pad and the left
//            stick call UI.nav (once for a push; held, again after a pause and then steadily), the lower face
//            button calls UI.activate, and the right face button and Start call UI.back. Pads are read once a
//            frame, and only once one has been connected. A pad without the standard mapping gets its left stick
//            and its buttons read the same way, but no aim: its axes 2 and 3 are often triggers at rest.
//   A key typed into a text field is left to the field, and does not count as using the keys.
// Settings read: input.aim, input.stick, input.hand, input.deadzone, input.haptics and ui.scale, defined by
// 51-settings.js. Without that file the defaults in DEFAULTS below hold. css/20-touch.css styles the controls.
(function () {
  'use strict';

  // The InputFrame's field names, as Sim.NO_INPUT has them: button A is the trade, the class's own act, and button
  // B the heave, a find thrown overboard (docs/design/02-combat.md, section 10). This is the one place they are named.
  const FIELD = { moveX: 'mx', moveY: 'my', aimX: 'ax', aimY: 'ay', aim: 'aim', A: 'trade', B: 'heave' };
  const F_MX = FIELD.moveX, F_MY = FIELD.moveY, F_AX = FIELD.aimX, F_AY = FIELD.aimY, F_AIM = FIELD.aim, F_A = FIELD.A, F_B = FIELD.B;

  // KeyboardEvent.code -> what the key does. Codes name places on the keyboard, whatever letters it wears.
  const KEYS = {
    KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
    Space: 'A', ShiftLeft: 'A', ShiftRight: 'A', KeyQ: 'B', KeyE: 'B', Escape: 'pause', KeyP: 'pause',
  };
  // Gamepad buttons of the standard mapping, as bits of a mask.
  const PAD_A = 1 << 0 | 1 << 5, PAD_B = 1 << 1 | 1 << 4, PAD_OK = 1 << 0, PAD_BACK = 1 << 1, PAD_START = 1 << 9;
  const PAD_UP = 1 << 12, PAD_DOWN = 1 << 13, PAD_LEFT = 1 << 14, PAD_RIGHT = 1 << 15;
  const DEFAULTS = { 'input.aim': 'auto', 'input.stick': 'floating', 'input.hand': 'right', 'input.deadzone': 0.15, 'input.haptics': true, 'ui.scale': 1 };
  const PLAIN = { moveX: 0, moveY: 0, aimX: 1, aimY: 0, aim: false, A: false, B: false };   // by the keys of FIELD

  const QUEUE = 8;                 // presses of one button that may wait for the simulation
  const PADS = 8;                  // gamepads looked at
  const PAD_ACTIVE = 0.25;         // a stick pushed this far makes its pad the one in use
  const MENU_PUSH = 0.5;           // a stick pushed this far moves menu focus
  const REPEAT_WAIT = 420, REPEAT_EVERY = 130;   // ms: a direction held in a menu moves again after this, then every
  const MOUSE_TRAVEL = 6;          // CSS px the mouse must move before it counts as the device in use
  const SLIDE_OFF = 1.35;          // a finger this many radii from a button's middle has slid off it
  const TAP_BUZZ = 8;              // ms of vibration for a touch button
  const SWEEP_STEPS = 48;          // the cooldown sweep is drawn in this many steps
  const PORTRAIT = [62, 76, 90, 48, 34], LANDSCAPE = [24, 38, 52, 66, 80, 90];   // degrees: B round A, best first
  const PAUSED = 'input.paused';
  const SVG = 'http://www.w3.org/2000/svg';

  const frame = {};                                   // the InputFrame, given its fields at boot
  const opt = { aim: 'auto', stick: 'floating', hand: 'right', dead: 0.15, haptics: true, scale: 1 };
  const held = Object.create(null);                   // KeyboardEvent.code -> true while held
  const dirs = { up: 0, down: 0, left: 0, right: 0 };   // how many keys hold each direction
  const pending = { A: 0, B: 0 };                     // presses waiting for a sample
  const SWEEP = [], DIGITS = [];                      // texts made once, so that a frame builds none
  let pausers = [];                                   // Input.onPause listeners; replaced when it changes
  let device = 'keys', touched = false, booted = false, shown = false;
  let aimX = 1, aimY = 0;                             // the last aim, a unit vector
  let shX = 0, shY = 0;                               // what shape() worked out

  // mouse
  const ground = { x: 0, y: 0 };
  let mouseX = 0, mouseY = 0, mouseSeen = false, travel = 0, viewX = 0, viewY = 0;

  // touch: the elements, the place of everything (CSS px from the top left of the window), and the stick
  let app = null, layer = null, root = null, lengths = null, pauseEl = null;
  const lay = { W: 0, H: 0, mirror: false, split: 0, minX: 0, maxX: 0, minY: 0, maxY: 0, gap: 0, pauseX: 0, pauseY: 0, pause: 44 };
  const stick = { id: -1, x: 0, y: 0, kx: 0, ky: 0, hx: 0, hy: 0, r: 58, kr: 26, mx: 0, my: 0 };
  function buttonState(id) {
    return {
      id: id, el: null, sweep: null, slot: null, badge: null, pointer: -1, x: 0, y: 0, size: 0,
      icon: null, iconShown: undefined, cooldown: 0, step: -1, charges: null, hidden: false, label: 'Button ' + id,
    };
  }
  const buttons = { A: buttonState('A'), B: buttonState('B') };

  // gamepads
  const masks = new Int32Array(PADS);   // the buttons each pad held at the last look
  let pads = 0, active = -1, frameNo = 0, polled = -1;
  let padMX = 0, padMY = 0, padAX = 1, padAY = 0, padAim = false, menuDir = 0, menuAt = 0;

  Object.defineProperty(Input, 'device', { enumerable: true, get: function () { return device; } });
  Input.FIELDS = Object.freeze(Object.assign({}, FIELD));

  // ---- small things ----

  function setting(key) {
    const v = typeof Settings.get === 'function' ? Settings.get(key) : undefined;
    return v === undefined ? DEFAULTS[key] : v;
  }

  function readSettings() {
    opt.aim = setting('input.aim');
    opt.stick = setting('input.stick');
    opt.hand = setting('input.hand');
    opt.dead = Core.clamp(Number(setting('input.deadzone')) || 0, 0, 0.9);
    opt.haptics = setting('input.haptics') === true;
    opt.scale = Core.clamp(Number(setting('ui.scale')) || 1, 0.5, 2);
  }

  function top() { return typeof UI.top === 'function' ? UI.top() : null; }
  function pausing() { return typeof UI.pausing === 'function' && UI.pausing(); }

  // A run is in play: presses count.
  function inPlay() {
    const S = Game.S;
    return Game.state === 'run' && S !== null && S !== undefined && S.phase === 'play' && !pausing();
  }

  function press(id) { if (pending[id] < QUEUE) pending[id]++; }

  // Nothing inside the dead zone, then evenly to 1 at the rim, in the direction pushed. Writes shX, shY.
  function shape(x, y, dead) {
    const m = Math.sqrt(x * x + y * y);
    if (!(m > dead)) {
      shX = 0;
      shY = 0;
      return;
    }
    const k = Math.min(1, (m - dead) / (1 - dead)) / m;
    shX = x * k;
    shY = y * k;
  }

  function use(name) {
    if (name === device) return;
    device = name;
    travel = 0;
    if (name !== 'touch') releaseTouch();
    Plat.emit('device', name);
  }

  // ---- the frame ----

  function makeFrame() {
    const plain = typeof Sim.NO_INPUT === 'object' && Sim.NO_INPUT !== null ? Sim.NO_INPUT : null;
    if (plain) for (const name in plain) frame[name] = plain[name];
    const missing = [];
    for (const k in FIELD) {
      if (plain && !(FIELD[k] in plain)) missing.push(FIELD[k]);
      if (!(FIELD[k] in frame)) frame[FIELD[k]] = PLAIN[k];
    }
    if (missing.length) {
      console.error('52-input.js: Sim.NO_INPUT has no field ' + missing.join(', ') + ' (it has ' + Object.keys(plain).join(', ') +
        '): put the new names into the table FIELD at the top of 52-input.js');
    }
  }

  function take(id) {
    if (pending[id] <= 0) return false;
    pending[id]--;
    return true;
  }

  function pointerAim() {
    const S = Game.S;
    if (!S || !S.player || typeof Gfx.screenToWorld !== 'function') return false;
    if (!Gfx.screenToWorld(mouseX - viewX, mouseY - viewY, ground)) return false;
    const dx = ground.x - S.player.x, dy = ground.y - S.player.y, m = Math.sqrt(dx * dx + dy * dy);
    if (m > 1e-6) {   // right under the player: the last direction stands
      aimX = dx / m;
      aimY = dy / m;
    }
    return true;
  }

  Input.sample = function () {
    if (pads > 0) poll();
    let mx = (dirs.right > 0 ? 1 : 0) - (dirs.left > 0 ? 1 : 0), my = (dirs.down > 0 ? 1 : 0) - (dirs.up > 0 ? 1 : 0);
    if (mx !== 0 && my !== 0) {
      mx *= Math.SQRT1_2;
      my *= Math.SQRT1_2;
    }
    if (stick.id >= 0) {
      mx += stick.mx;
      my += stick.my;
    }
    mx += padMX;
    my += padMY;
    const m2 = mx * mx + my * my;
    if (m2 > 1) {
      const m = Math.sqrt(m2);
      mx /= m;
      my /= m;
    }
    let aim = false;
    if (padAim) {
      aimX = padAX;
      aimY = padAY;
      aim = true;
    } else if (opt.aim === 'pointer' && mouseSeen && device === 'keys') {
      aim = pointerAim();
    }
    frame[F_MX] = mx;
    frame[F_MY] = my;
    frame[F_AX] = aimX;
    frame[F_AY] = aimY;
    frame[F_AIM] = aim;
    frame[F_A] = take('A');
    frame[F_B] = take('B');
    return frame;
  };

  // ---- pausing ----

  function canPause() {
    const S = Game.S;
    return Game.state === 'run' && !!S && S.phase !== 'ended' && !pausing();
  }

  function pausedScreen() {
    return UI.h('div', { class: 'ui-panel ui-stack' },
      UI.h('h2', { class: 'ui-heading' }, 'Paused'),
      UI.button('Resume', function () { UI.close(PAUSED); }, { class: 'primary', dataset: { focus: '' } }));
  }

  function pause(from) {
    if (!canPause()) return false;
    releaseTouch();
    const list = pausers;
    if (list.length) {
      for (let i = 0; i < list.length; i++) {
        try {
          list[i](from);
        } catch (err) {
          console.error('Input: a listener of Input.onPause threw:', err);
        }
      }
      return true;
    }
    if (typeof Settings.open === 'function' && Settings.open() !== null) return true;
    if (typeof UI.open !== 'function') return false;
    if (!UI.has(PAUSED)) UI.screen(PAUSED, { open: pausedScreen });
    UI.open(PAUSED);
    return true;
  }

  Input.onPause = function (fn) {
    Core.assert(typeof fn === 'function', 'Input.onPause needs a function');
    pausers = pausers.concat(fn);
    return function off() {
      const at = pausers.indexOf(fn);
      if (at >= 0) pausers = pausers.slice(0, at).concat(pausers.slice(at + 1));
    };
  };

  // ---- vibration ----

  function vibrate(ms) {
    try {
      if (typeof navigator.vibrate !== 'function') return false;
      const ua = navigator.userActivation;
      if (ua && !ua.hasBeenActive) return false;   // before the first touch the browser refuses, and says so
      return navigator.vibrate(ms) === true;
    } catch (err) {
      return false;
    }
  }

  function rumble(ms) {
    try {
      const list = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : null;
      const g = list && active >= 0 ? list[active] : null, motor = g ? g.vibrationActuator : null;
      if (!motor || typeof motor.playEffect !== 'function') return false;
      const done = motor.playEffect('dual-rumble', { duration: ms, strongMagnitude: 0.6, weakMagnitude: 0.4 });
      if (done && typeof done.catch === 'function') done.catch(function () { /* refused: nothing to do */ });
      return true;
    } catch (err) {
      return false;
    }
  }

  Input.buzz = function (ms) {
    if (!booted || !opt.haptics || !(ms > 0)) return false;
    const time = Math.min(1000, Math.round(ms));
    if (device === 'pad') return rumble(time);
    return device === 'touch' ? vibrate(time) : false;
  };

  // ---- keys and the mouse ----

  function releaseKeys() {
    for (const code in held) held[code] = false;
    dirs.up = dirs.down = dirs.left = dirs.right = 0;
  }

  // A key typed into a text field is writing, not play, and says nothing about the device in use.
  function typing(e) {
    const t = e.target;
    if (!t || t.nodeType !== 1) return false;
    if (t.isContentEditable || t.tagName === 'TEXTAREA') return true;
    return t.tagName === 'INPUT' && !/^(?:range|checkbox|radio|button|submit|reset|color|file|image)$/.test(t.type);
  }

  function onKeyDown(e) {
    if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey || typing(e)) return;
    if (!e.repeat) use('keys');
    const what = KEYS[e.code];
    if (what === undefined || top() !== null) return;   // an open screen keeps its keys
    if (what === 'pause') {
      if (canPause()) {
        e.preventDefault();
        pause('keys');
      }
      return;
    }
    e.preventDefault();
    if (what === 'A' || what === 'B') {
      if (!e.repeat && inPlay()) press(what);
    } else if (held[e.code] !== true) {
      held[e.code] = true;
      dirs[what]++;
    }
  }

  function onKeyUp(e) {
    if (held[e.code] !== true) return;
    held[e.code] = false;
    dirs[KEYS[e.code]]--;
  }

  function mouseAt(e) {
    if (mouseSeen) travel += Math.abs(e.clientX - mouseX) + Math.abs(e.clientY - mouseY);
    mouseSeen = true;
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (travel > MOUSE_TRAVEL && device !== 'keys') use('keys');
  }

  // ---- touch ----

  // The lengths of the two circles are held once (each read of circle.cx.baseVal makes new objects), and then
  // set as plain numbers: moving the stick builds no strings and no objects.
  function draw() {
    if (!lengths) return;
    lengths[0].value = stick.x;
    lengths[1].value = stick.y;
    lengths[2].value = stick.r;
    lengths[3].value = stick.kx;
    lengths[4].value = stick.ky;
    lengths[5].value = stick.kr;
  }

  // A base beside a button is moved sideways, back towards the stick side, until it keeps clear.
  function keepClear(cx, cy, half) {
    const need = half + lay.gap + stick.r;
    if (Math.abs(stick.y - cy) >= need) return;
    if (lay.mirror) { if (stick.x < cx + need) stick.x = cx + need; } else if (stick.x > cx - need) stick.x = cx - need;
  }

  function placeBase(x, y) {
    stick.x = Core.clamp(x, lay.minX, lay.maxX);
    stick.y = Core.clamp(y, lay.minY, lay.maxY);
    keepClear(buttons.A.x, buttons.A.y, buttons.A.size / 2);
    keepClear(buttons.B.x, buttons.B.y, buttons.B.size / 2);
    keepClear(lay.pauseX + lay.pause / 2, lay.pauseY + lay.pause / 2, lay.pause / 2);
    stick.x = Core.clamp(stick.x, lay.minX, lay.maxX);
  }

  function moveStick(x, y) {
    const R = stick.r;
    let dx = x - stick.x, dy = y - stick.y, d = Math.sqrt(dx * dx + dy * dy);
    if (opt.stick === 'floating' && d > R) {   // the thumb ran past the rim: the base comes after it
      placeBase(x - dx / d * R, y - dy / d * R);
      dx = x - stick.x;
      dy = y - stick.y;
      d = Math.sqrt(dx * dx + dy * dy);
    }
    const k = d > R ? R / d : 1;
    stick.kx = stick.x + dx * k;
    stick.ky = stick.y + dy * k;
    shape(dx / R, dy / R, opt.dead);
    stick.mx = shX;
    stick.my = shY;
    draw();
  }

  function startStick(e) {
    stick.id = e.pointerId;
    try {
      e.target.setPointerCapture(e.pointerId);
    } catch (err) { /* an event made in the page has no pointer to capture: the window still hears it */ }
    if (opt.stick === 'floating') placeBase(e.clientX, e.clientY);
    else {
      stick.x = stick.hx;
      stick.y = stick.hy;
    }
    root.classList.add('is-held');
    moveStick(e.clientX, e.clientY);
  }

  function releaseStick() {
    stick.id = -1;
    stick.mx = stick.my = 0;
    stick.x = stick.kx = stick.hx;
    stick.y = stick.ky = stick.hy;
    if (root) root.classList.remove('is-held');
    draw();
  }

  function letGo(b) {
    b.pointer = -1;
    if (b.el) b.el.classList.remove('is-down');
  }

  function releaseTouch() {
    if (stick.id >= 0) releaseStick();
    letGo(buttons.A);
    letGo(buttons.B);
  }

  function onStickSide(x) { return lay.mirror ? x >= lay.split : x < lay.split; }

  function wanted() { return touched && device === 'touch' && Game.state === 'run' && !pausing(); }

  function show(on) {
    shown = on;
    if (root) root.hidden = !on;
    if (on) layout(); else releaseTouch();
  }

  function noteTouch() {
    touched = true;
    use('touch');
    if (!shown && wanted()) show(true);
  }

  // Every press inside the game area reaches this listener of #app, after the element pressed has had it. A
  // touch on the game itself (the view, not a control or a screen) takes the stick.
  function onAppDown(e) {
    if (e.pointerType === 'mouse') {
      mouseAt(e);
      use('keys');
      return;
    }
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
    noteTouch();
    const t = e.target;
    if (!shown || stick.id >= 0 || !(t === app || t.nodeName === 'CANVAS') || !onStickSide(e.clientX)) return;
    e.preventDefault();
    startStick(e);
  }

  function slideOff(b, e) {
    if (e.pointerId !== b.pointer) return;
    const dx = e.clientX - b.x, dy = e.clientY - b.y, r = b.size / 2 * SLIDE_OFF;
    if (dx * dx + dy * dy > r * r) letGo(b);
  }

  function onPointerMove(e) {
    if (e.pointerType === 'mouse') mouseAt(e);
    else if (e.pointerId === stick.id) moveStick(e.clientX, e.clientY);
    else {
      slideOff(buttons.A, e);
      slideOff(buttons.B, e);
    }
  }

  function onPointerEnd(e) {
    if (e.pointerId === stick.id) releaseStick();
    if (e.pointerId === buttons.A.pointer) letGo(buttons.A);
    if (e.pointerId === buttons.B.pointer) letGo(buttons.B);
  }

  function letGoAll() {
    releaseKeys();
    releaseTouch();
  }

  // ---- the touch buttons ----

  function showIcon(b) {
    if (!b.slot || b.iconShown === b.icon) return;
    b.iconShown = b.icon;
    const icon = b.icon;
    if (icon && icon.nodeType === 1) {
      while (b.slot.firstChild) b.slot.removeChild(b.slot.firstChild);
      b.slot.appendChild(icon);
    } else {
      b.slot.textContent = typeof icon === 'string' && icon !== '' ? icon : b.id;
    }
  }

  function showCooldown(b) {
    if (!b.sweep) return;
    const k = Math.round(Core.clamp(b.cooldown, 0, 1) * SWEEP_STEPS);
    if (k === b.step) return;
    b.step = k;
    b.sweep.style.setProperty('--tc-cd', SWEEP[k]);
    b.el.classList.toggle('is-cooling', k > 0);
  }

  function showCharges(b) {
    if (!b.badge) return;
    const n = b.charges;
    b.badge.hidden = n === null;
    if (n !== null) b.badge.textContent = n >= 0 && n <= 9 && n === Math.floor(n) ? DIGITS[n] : String(n);
  }

  function showAll(b) {
    showIcon(b);
    b.step = -1;
    showCooldown(b);
    showCharges(b);
    if (b.el) {
      b.el.hidden = b.hidden;
      b.el.setAttribute('aria-label', b.label);
    }
  }

  Input.button = function (id, opts) {
    const b = id === 'A' ? buttons.A : id === 'B' ? buttons.B : null;
    Core.assert(b !== null, 'Input.button: the buttons are "A" and "B", not "' + id + '"');
    if (!opts) return;
    if (opts.icon !== undefined && opts.icon !== b.icon) {
      b.icon = opts.icon;
      showIcon(b);
    }
    if (opts.cooldown !== undefined) {
      b.cooldown = Number(opts.cooldown) || 0;
      showCooldown(b);
    }
    if (opts.charges !== undefined) {
      const n = opts.charges === null ? null : Number(opts.charges);
      if (n !== b.charges && !(n !== null && !Number.isFinite(n))) {
        b.charges = n;
        showCharges(b);
      }
    }
    if (opts.hidden !== undefined && !!opts.hidden !== b.hidden) {
      b.hidden = !!opts.hidden;
      if (b.el) b.el.hidden = b.hidden;
      if (b.hidden) letGo(b);
    }
    if (typeof opts.label === 'string' && opts.label !== b.label) {
      b.label = opts.label;
      if (b.el) b.el.setAttribute('aria-label', b.label);
    }
  };

  function makeButton(b) {
    b.sweep = UI.h('span', { class: 'tc-sweep' });
    b.slot = UI.h('span', { class: 'tc-icon' });
    b.badge = UI.h('span', { class: 'tc-charges', hidden: true });
    b.el = UI.h('button', { type: 'button', class: ['tc-btn', 'tc-' + b.id.toLowerCase()], tabindex: '-1', dataset: { button: b.id } }, b.sweep, b.slot, b.badge);
    b.el.addEventListener('pointerdown', function (e) {
      e.preventDefault();   // no focus for the button, and no mouse events made up after the touch
      if (b.hidden) return;
      if (e.pointerType !== 'mouse') noteTouch();
      b.pointer = e.pointerId;
      b.el.classList.add('is-down');
      try {
        b.el.setPointerCapture(e.pointerId);
      } catch (err) { /* an event made in the page: the window still hears its end */ }
      if (inPlay()) press(b.id);
      if (e.pointerType !== 'mouse') Input.buzz(TAP_BUZZ);
    });
    showAll(b);
    return b.el;
  }

  // ---- where the touch controls go ----

  function px(text, least) {
    const n = parseFloat(text);
    return Number.isFinite(n) && n > least ? n : least;
  }

  // Are two squares, given by their middles and half sides, at least gap apart, one way or the other?
  function apart(x1, y1, h1, x2, y2, h2, gap) {
    return Math.abs(x1 - x2) >= h1 + h2 + gap || Math.abs(y1 - y2) >= h1 + h2 + gap;
  }

  // The controls for the buttons on the right, in a window W by H with the given edges kept free; the caller
  // mirrors them for the left hand. False when they do not fit at this size (unless forced).
  function arrange(W, H, e, s, portrait, force) {
    const a = Math.max(64, Math.round(78 * s)), b = Math.max(64, Math.round(64 * s));
    const R = Math.max(44, Math.round(58 * s)), pad = Math.round(10 * s), gap = Math.max(8, Math.round(12 * s));
    const p = lay.pause, ax = W - e.near - pad - a / 2, ay = H - e.bottom - pad - a / 2;
    const hx = e.far + pad + R, hy = H - e.bottom - pad - R, pcx = W - e.near - p / 2, pcy = e.top + p / 2;
    const angles = portrait ? PORTRAIT : LANDSCAPE, d = (a + b) / 2 + gap;
    let bx = ax, by = ay - d, ok = false;
    for (let i = 0; i < angles.length && !ok; i++) {
      const t = angles[i] * Math.PI / 180;
      bx = ax - d * Math.cos(t);
      by = ay - d * Math.sin(t);
      ok = by - b / 2 >= e.top && bx - b / 2 >= e.far && apart(bx, by, b / 2, hx, hy, R, gap) && apart(bx, by, b / 2, pcx, pcy, p / 2, gap);
    }
    ok = ok && apart(ax, ay, a / 2, hx, hy, R, gap) && hx + R <= W / 2 + R && hy - R >= e.top;
    if (!ok && !force) return false;
    const flip = function (x) { return lay.mirror ? W - x : x; };
    buttons.A.x = flip(ax);
    buttons.A.y = ay;
    buttons.A.size = a;
    buttons.B.x = flip(bx);
    buttons.B.y = by;
    buttons.B.size = b;
    lay.pauseX = flip(pcx) - p / 2;
    lay.pauseY = e.top;
    lay.gap = gap;
    stick.r = R;
    stick.kr = Math.round(R * 0.46);
    stick.hx = flip(hx);
    stick.hy = hy;
    const lo = e.far + R, hi = Math.max(lo, Math.min(W / 2, W - e.near - R));   // where the base's middle may go
    lay.minX = lay.mirror ? W - hi : lo;
    lay.maxX = lay.mirror ? W - lo : hi;
    lay.minY = e.top + R;
    lay.maxY = Math.max(lay.minY, H - e.bottom - R);
    return true;
  }

  function place(el, x, y, size) {
    el.style.left = Math.round(x) + 'px';
    el.style.top = Math.round(y) + 'px';
    el.style.width = el.style.height = Math.round(size) + 'px';
  }

  function layout() {
    if (!root || !layer) return;
    const W = layer.clientWidth, H = layer.clientHeight;
    if (!(W > 0 && H > 0)) return;
    const cs = window.getComputedStyle(layer), mirror = opt.hand === 'left';
    const left = px(cs.paddingLeft, 16), right = px(cs.paddingRight, 16);
    const e = { top: px(cs.paddingTop, 12), bottom: px(cs.paddingBottom, 12), near: mirror ? left : right, far: mirror ? right : left };
    lay.W = W;
    lay.H = H;
    lay.mirror = mirror;
    lay.split = W / 2;
    let s = opt.scale;
    for (let tries = 0; tries < 6 && !arrange(W, H, e, s, H >= W, false); tries++) s *= 0.88;
    if (!arrange(W, H, e, s, H >= W, false)) arrange(W, H, e, s, H >= W, true);
    root.classList.toggle('tc-left', mirror);
    place(buttons.A.el, buttons.A.x - buttons.A.size / 2, buttons.A.y - buttons.A.size / 2, buttons.A.size);
    place(buttons.B.el, buttons.B.x - buttons.B.size / 2, buttons.B.y - buttons.B.size / 2, buttons.B.size);
    place(pauseEl, lay.pauseX, lay.pauseY, lay.pause);
    buttons.A.el.style.fontSize = Math.round(buttons.A.size * 0.34) + 'px';
    buttons.B.el.style.fontSize = Math.round(buttons.B.size * 0.34) + 'px';
    releaseStick();
  }

  function onResize() {
    const view = Gfx.active;
    if (view && view.canvas) {
      const box = view.canvas.getBoundingClientRect();
      viewX = box.left;
      viewY = box.top;
    }
    if (shown) layout();
  }

  function buildTouch() {
    app = document.getElementById('app');
    layer = document.getElementById('touch');
    if (!layer) return;
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('class', 'tc-svg');
    svg.setAttribute('aria-hidden', 'true');
    const base = document.createElementNS(SVG, 'circle'), knob = document.createElementNS(SVG, 'circle');
    base.setAttribute('class', 'tc-base');
    knob.setAttribute('class', 'tc-knob');
    svg.appendChild(base);
    svg.appendChild(knob);
    lengths = [base.cx.baseVal, base.cy.baseVal, base.r.baseVal, knob.cx.baseVal, knob.cy.baseVal, knob.r.baseVal];
    pauseEl = UI.h('button', {
      type: 'button', class: 'tc-pause', tabindex: '-1', 'aria-label': 'Pause',
      onpointerdown: function (e) { e.preventDefault(); },   // no focus, so a key cannot press it later
      onclick: function () { pause('touch'); },
    }, UI.h('span', { class: 'tc-pause-mark', 'aria-hidden': 'true' }));
    root = UI.h('div', { class: 'tc', hidden: true }, svg, makeButton(buttons.A), makeButton(buttons.B), pauseEl);
    layer.appendChild(root);
    if (app) app.addEventListener('pointerdown', onAppDown);
  }

  // ---- gamepads ----

  function axis(g, k) {
    const v = g.axes[k];
    return typeof v === 'number' && v === v ? v : 0;   // v === v leaves NaN out
  }

  function buttonsOf(g) {
    const list = g.buttons;
    let m = 0;
    for (let k = 0; k < list.length && k < 17; k++) {
      const b = list[k];
      if (b === 1 || (b && b.pressed === true)) m |= 1 << k;
    }
    return m;
  }

  function pushed(g, k) {
    const x = axis(g, k), y = axis(g, k + 1), least = Math.max(opt.dead, PAD_ACTIVE);
    return x * x + y * y > least * least;
  }

  // Only a pad with the standard mapping is sure to have its right stick on axes 2 and 3: on others they are
  // often the triggers, which rest at -1 and would look like a stick held over.
  function standard(g) { return g.mapping === 'standard'; }

  function readSticks(g) {
    if (!g) {
      padMX = padMY = 0;
      padAim = false;
      return;
    }
    shape(axis(g, 0), axis(g, 1), opt.dead);
    padMX = shX;
    padMY = shY;
    if (padMX === 0 && padMY === 0) {   // the d-pad, while the stick rests
      const m = masks[active];
      padMX = (m & PAD_RIGHT ? 1 : 0) - (m & PAD_LEFT ? 1 : 0);
      padMY = (m & PAD_DOWN ? 1 : 0) - (m & PAD_UP ? 1 : 0);
      if (padMX !== 0 && padMY !== 0) {
        padMX *= Math.SQRT1_2;
        padMY *= Math.SQRT1_2;
      }
    }
    const rx = standard(g) ? axis(g, 2) : 0, ry = standard(g) ? axis(g, 3) : 0, rm = Math.sqrt(rx * rx + ry * ry);
    padAim = rm > Math.max(opt.dead, 0.2);
    if (padAim) {
      padAX = rx / rm;
      padAY = ry / rm;
    }
  }

  function menu(g, edges) {
    if (edges & PAD_OK) {
      UI.activate();
      return;
    }
    if (edges & (PAD_BACK | PAD_START)) {
      UI.back();
      return;
    }
    const m = active >= 0 ? masks[active] : 0;
    let dir = m & PAD_UP ? 1 : m & PAD_DOWN ? 2 : m & PAD_LEFT ? 3 : m & PAD_RIGHT ? 4 : 0;
    if (dir === 0 && g) {
      const x = axis(g, 0), y = axis(g, 1);
      if (Math.abs(x) > MENU_PUSH || Math.abs(y) > MENU_PUSH) dir = Math.abs(x) > Math.abs(y) ? (x < 0 ? 3 : 4) : (y < 0 ? 1 : 2);
    }
    if (dir === 0) {
      menuDir = 0;
      return;
    }
    const now = Plat.now();
    if (dir !== menuDir) {
      menuDir = dir;
      menuAt = now + REPEAT_WAIT;
    } else if (now < menuAt) {
      return;
    } else {
      menuAt = now + REPEAT_EVERY;
    }
    UI.nav(dir === 3 ? -1 : dir === 4 ? 1 : 0, dir === 1 ? -1 : dir === 2 ? 1 : 0);
  }

  // Looks at the pads, at most once a frame: at the first sample of a frame, else after the frame is drawn.
  function poll() {
    if (polled === frameNo) return;
    polled = frameNo;
    let list = null;
    try {
      list = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : null;
    } catch (err) {
      list = null;
    }
    if (!list) return;
    let edges = 0;
    for (let i = 0; i < PADS; i++) {
      const g = i < list.length ? list[i] : null;
      if (!g || g.connected === false) {
        masks[i] = 0;
        if (active === i) active = -1;
        continue;
      }
      const m = buttonsOf(g), fresh = m & ~masks[i];
      masks[i] = m;
      if (fresh !== 0 || pushed(g, 0) || (standard(g) && pushed(g, 2))) {
        active = i;
        use('pad');
      }
      edges |= fresh;
    }
    const g = active >= 0 && active < list.length ? list[active] : null;
    readSticks(g);
    if (top() !== null) {
      menu(g, edges);
      return;
    }
    menuDir = 0;
    if (edges & PAD_START) pause('pad');
    else if (edges !== 0 && inPlay()) {
      if (edges & PAD_A) press('A');
      if (edges & PAD_B) press('B');
    }
  }

  function padIn() { pads++; }

  function padOut(e) {
    pads = Math.max(0, pads - 1);
    if ((e && e.gamepad && e.gamepad.index === active) || pads === 0) active = -1;
    if (pads === 0) {
      masks.fill(0);
      readSticks(null);
    }
  }

  // ---- boot ----

  function onFrame() {
    if (pads > 0) poll();
    frameNo++;
    if (wanted() !== shown) show(!shown);
  }

  function onState() {
    letGoAll();
    pending.A = pending.B = 0;
    menuDir = 0;
  }

  Plat.on('boot', function () {
    booted = true;
    for (let k = 0; k <= SWEEP_STEPS; k++) SWEEP.push(String(k / SWEEP_STEPS));
    for (let k = 0; k <= 9; k++) DIGITS.push(String(k));
    makeFrame();
    readSettings();
    device = Plat.isTouch ? 'touch' : 'keys';
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', letGoAll);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerEnd, { passive: true });
    window.addEventListener('pointercancel', onPointerEnd, { passive: true });
    window.addEventListener('lostpointercapture', onPointerEnd, { passive: true });
    window.addEventListener('gamepadconnected', padIn);
    window.addEventListener('gamepaddisconnected', padOut);
    Plat.onVisibility(function (visible) {
      if (visible) return;
      letGoAll();
      pending.A = pending.B = 0;
    });
    Plat.on('resize', onResize);
    Plat.on('frame', onFrame);
    Plat.on('state', onState);
    if (typeof Settings.on === 'function') {
      const changed = function () {
        readSettings();
        if (shown) layout();
      };
      Settings.on('input.*', changed);
      Settings.on('ui.scale', changed);
    }
    buildTouch();
    onResize();
  });
})();
