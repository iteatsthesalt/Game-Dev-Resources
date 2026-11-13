// tests/scenarios/40-input.js: settings (51-settings.js) and input from every device (52-input.js).
//   keys      on a desktop window: the move vectors of the keys (a diagonal has length 1), a press shorter than
//             a frame reported by exactly one sample even when a frame runs several steps, focus loss letting
//             the keys go, the aim of the mouse with 'input.aim' 'pointer', the device notice, and pausing
//   touch     on a phone held upright and on its side (with a notch), with pointer events made in the page: the
//             stick follows a thumb and comes back to rest, a second finger on button A is reported once while
//             the first keeps moving, pointercancel and a finger that slides off; then the same with real
//             fingers sent by the runner (T.touch), which the browser captures itself; the controls clear of
//             each other and of the safe area for both hands, both sticks and every size, keys hide them, the
//             pause button by a real tap, and Input.button
//   pad       a gamepad the page is made to see: the sticks with the dead zone, A and B once a press, the pad
//             used last, Start, and the menus with their repeat
//   settings  defaults, checking and clamping, listeners, the --ui-scale property, the screen (a row for every
//             setting, each changed by keys, and on the phone by real taps; up and down walk every row), a
//             hand-made row; a reload keeps what was set; storage that throws or holds rubbish breaks nothing
//   calm      where the system asks for less motion, shake and flash start at 0.3, and a chosen value wins
// Not here: real gamepads (the page is handed a stand-in navigator.getGamepads).
// Each function below runs inside the page (see tests/run.js), so it uses only T, TB and the page itself.

// ---- keys and the mouse, on a desktop window ----

const keys = async function () {
  const { Game, Input, Settings, Plat, UI, Gfx, Sim } = TB;
  const F = Input.FIELDS, frames = (n) => new Promise((done) => {
    let left = n;
    const off = Plat.on('frame', () => { if (--left <= 0) { off(); done(); } });
  });
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  const names = Object.keys(Sim.NO_INPUT).join();
  T.check('the frame names its fields after Sim.NO_INPUT', [F.moveX, F.moveY, F.aimX, F.aimY, F.aim, F.A, F.B].every((n) => n in Sim.NO_INPUT) &&
    typeof Sim.NO_INPUT[F.A] === 'boolean' && typeof Sim.NO_INPUT[F.B] === 'boolean', [F, names]);
  const first = Input.sample();
  T.check('Input.sample gives one object, refilled, with the fields of Sim.NO_INPUT', Input.sample() === first && Object.keys(first).join() === names, Object.keys(first));
  T.check('a desktop starts on the keys', Input.device === 'keys', Input.device);

  Game.start({ seed: 3 });
  T.check('a run is going', Game.state === 'run' && !!Game.S);
  const move = async (list) => {
    for (const k of list) await T.keyDown(k);
    const f = Input.sample(), got = [f[F.moveX], f[F.moveY]];
    for (const k of list) await T.keyUp(k);
    return got;
  };
  const D = Math.SQRT1_2, cases = [
    [['KeyD'], 1, 0], [['KeyA'], -1, 0], [['KeyW'], 0, -1], [['KeyS'], 0, 1],
    [['ArrowRight'], 1, 0], [['ArrowLeft'], -1, 0], [['ArrowUp'], 0, -1], [['ArrowDown'], 0, 1],
    [['KeyW', 'KeyD'], D, -D], [['KeyS', 'KeyA'], -D, D], [['ArrowUp', 'ArrowLeft'], -D, -D], [['ArrowDown', 'KeyD'], D, D],
    [['KeyA', 'KeyD'], 0, 0], [['KeyW', 'ArrowDown'], 0, 0], [['KeyW', 'ArrowUp'], 0, -1],
  ];
  const wrong = [];
  for (const [list, x, y] of cases) {
    const got = await move(list);
    if (!near(got[0], x) || !near(got[1], y)) wrong.push(list.join('+') + ' gave ' + got.join(', '));
  }
  T.check('W A S D and the arrows give the right move vectors, alone and together', wrong.length === 0, wrong);
  const diag = await move(['KeyW', 'KeyA']);
  T.check('a diagonal has length 1', near(Math.hypot(diag[0], diag[1]), 1), diag);
  const rest = Input.sample();
  T.check('with every key let go the move is 0', rest[F.moveX] === 0 && rest[F.moveY] === 0 && rest[F.aim] === false, [rest[F.moveX], rest[F.moveY]]);

  // ---- presses: the frame object is the one handed to Sim.step, so a step listener sees what each step got ----
  let a = 0, b = 0, steps = 0;
  const perFrame = [];
  const offStep = Plat.on('step', () => {
    steps++;
    if (first[F.A]) a++;
    if (first[F.B]) b++;
  });
  let lastSteps = 0;
  const offFrame = Plat.on('frame', () => { perFrame.push(steps - lastSteps); lastSteps = steps; });
  const settle = async () => { const s0 = steps; await T.until(() => steps >= s0 + 8, 5000); };
  const fire = (type, code, more) => window.dispatchEvent(new KeyboardEvent(type, Object.assign({ code: code, key: code, bubbles: true, cancelable: true }, more)));

  fire('keydown', 'Space');
  fire('keyup', 'Space');   // down and up in one task: shorter than any frame
  const before = steps;
  await settle();
  T.check('a press of Space shorter than one frame is reported by exactly one sample', a === 1 && steps > before, { a: a, steps: steps - before });

  // a slow frame: the next frame owes several steps, and the press still reaches exactly one of them
  perFrame.length = 0;
  fire('keydown', 'Space');
  fire('keyup', 'Space');
  const until = performance.now() + 70;
  while (performance.now() < until) { /* the main thread is busy, as on a slow phone */ }
  await settle();
  T.check('a press reaches exactly one step of a frame that runs several', a === 2 && perFrame.some((n) => n >= 2), { a: a, perFrame: perFrame.slice(0, 6) });

  await T.key('Space');
  await settle();
  await T.key('ShiftLeft');
  await settle();
  T.check('a real press of Space, and of Shift, is button A, once each', a === 4 && b === 0, { a: a, b: b });
  await T.key('KeyQ');
  await settle();
  await T.key('KeyE');
  await settle();
  T.check('Q and E are button B, once each', a === 4 && b === 2, { a: a, b: b });
  fire('keydown', 'Space');
  fire('keydown', 'Space', { repeat: true });
  fire('keydown', 'Space', { repeat: true });
  fire('keyup', 'Space');
  await settle();
  T.check('a key held long enough to repeat is still one press', a === 5, a);
  for (let i = 0; i < 3; i++) { fire('keydown', 'KeyQ'); fire('keyup', 'KeyQ'); }
  await settle();
  T.check('three quick presses are three samples, none lost', b === 5, b);
  offStep();
  offFrame();

  // ---- focus loss ----
  await T.keyDown('KeyD');
  const walking = Input.sample()[F.moveX];
  window.dispatchEvent(new Event('blur'));
  const after = Input.sample()[F.moveX];
  await T.keyUp('KeyD');
  T.check('a key held when the window loses focus is let go', walking === 1 && after === 0, [walking, after]);
  await T.keyDown('KeyS');
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
  document.dispatchEvent(new Event('visibilitychange'));
  const hidden = Input.sample()[F.moveY];
  delete document.visibilityState;
  document.dispatchEvent(new Event('visibilitychange'));
  await T.keyUp('KeyS');
  T.check('and so is one held when the page is hidden', hidden === 0, hidden);

  // ---- the mouse ----
  const S = Game.S, aimAt = (x, y) => {
    const g = Object.assign({}, Gfx.screenToWorld(x, y)), dx = g.x - S.player.x, dy = g.y - S.player.y, m = Math.hypot(dx, dy);
    return [dx / m, dy / m];
  };
  await T.mouse('move', 1000, 200);
  let f = Input.sample();
  T.check('with input.aim at its default, the mouse does not aim', Settings.get('input.aim') === 'auto' && f[F.aim] === false, f[F.aim]);
  Settings.set('input.aim', 'pointer');
  f = Input.sample();
  let want = aimAt(1000, 200);
  T.check('with input.aim "pointer" the aim points from the player to the ground under the mouse',
    f[F.aim] === true && Math.abs(f[F.aimX] - want[0]) < 1e-6 && Math.abs(f[F.aimY] - want[1]) < 1e-6, [f[F.aimX], f[F.aimY], want]);
  await T.mouse('move', 300, 650);
  f = Input.sample();
  want = aimAt(300, 650);
  T.check('and follows the mouse', f[F.aim] === true && Math.abs(f[F.aimX] - want[0]) < 1e-6 && Math.abs(f[F.aimY] - want[1]) < 1e-6 &&
    Math.abs(Math.hypot(f[F.aimX], f[F.aimY]) - 1) < 1e-9, [f[F.aimX], f[F.aimY], want]);
  Settings.set('input.aim', 'auto');
  T.check('and stops when the setting goes back', Input.sample()[F.aim] === false);

  // ---- the device ----
  const told = [];
  const offDevice = Plat.on('device', (name) => told.push(name));
  const view = document.getElementById('view');
  view.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 9, pointerType: 'touch', clientX: 100, clientY: 500, bubbles: true, cancelable: true }));
  view.dispatchEvent(new PointerEvent('pointerup', { pointerId: 9, pointerType: 'touch', clientX: 100, clientY: 500, bubbles: true, cancelable: true }));
  const onTouch = Input.device;
  await T.key('KeyX');
  await T.mouse('move', 640, 360);
  T.check('a touch makes the device "touch", a key "keys" again, each with one notice', onTouch === 'touch' && Input.device === 'keys' && told.join() === 'touch,keys', told);
  view.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 10, pointerType: 'touch', clientX: 100, clientY: 500, bubbles: true, cancelable: true }));
  view.dispatchEvent(new PointerEvent('pointerup', { pointerId: 10, pointerType: 'touch', clientX: 100, clientY: 500, bubbles: true, cancelable: true }));
  const field = document.createElement('input');
  document.getElementById('app').appendChild(field);
  field.focus();
  await T.key('KeyW');
  const typed = Input.device, walked = Input.sample()[F.moveY];
  field.remove();
  offDevice();
  T.check('a key typed into a text field is the field\'s: no device change, no walk', typed === 'touch' && walked === 0 && told.join() === 'touch,keys,touch', [typed, walked, told]);
  await T.key('KeyX');

  // ---- pausing ----
  await T.key('Escape');
  T.check('Escape during a run opens the settings (there is no pause screen yet), and the game stands', UI.top() === 'settings' && UI.pausing(), UI.top());
  const held = Game.S.step;
  await frames(5);
  T.check('no step runs while it is open', Game.S.step === held, [held, Game.S.step]);
  await T.key('KeyD');
  T.check('a key in a screen does not reach the game', Input.sample()[F.moveX] === 0);
  await T.key('Escape');
  T.check('Escape closes it again', UI.top() === null && !UI.pausing(), UI.top());
  await T.key('KeyP');
  T.check('P pauses as well', UI.top() === 'settings', UI.top());
  UI.close();
  const asked = [];
  const offPause = Input.onPause((from) => asked.push(from));
  await T.key('KeyP');
  T.check('Input.onPause hears a pause instead of the settings opening', asked.join() === 'keys' && UI.top() === null, [asked, UI.top()]);
  offPause();
  await T.key('Escape');
  T.check('the function it returned takes the listener off', asked.length === 1 && UI.top() === 'settings', [asked, UI.top()]);
  UI.close();
  Game.title();
  await T.key('Escape');
  T.check('Escape on the title does not pause', UI.top() === 'title', UI.top());
  T.check('Input.buzz does nothing on a desktop without a pad', Input.buzz(20) === false);
  return T.done();
};

// ---- touch, on a phone ----

const touch = async function () {
  const { Game, Input, Settings, Plat, UI } = TB;
  const F = Input.FIELDS, view = document.getElementById('view');
  const root = document.querySelector('#touch .tc'), base = document.querySelector('#touch .tc-base'), knob = document.querySelector('#touch .tc-knob');
  const btnA = document.querySelector('#touch .tc-a'), btnB = document.querySelector('#touch .tc-b'), pause = document.querySelector('#touch .tc-pause');
  const frames = (n) => new Promise((done) => {
    let left = n;
    const off = Plat.on('frame', () => { if (--left <= 0) { off(); done(); } });
  });
  const finger = (type, id, x, y, at) => (at || view).dispatchEvent(new PointerEvent(type, {
    pointerId: id, pointerType: 'touch', isPrimary: id === 1, clientX: x, clientY: y, bubbles: true, cancelable: true,
  }));
  const middle = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  const move = () => { const f = Input.sample(); return [f[F.moveX], f[F.moveY]]; };
  const close = (a, b, eps) => Math.abs(a - b) < (eps || 1e-6);
  T.check('the touch controls are built into #touch: a stick, buttons A and B, a pause button', !!root && !!base && !!knob && !!btnA && !!btnB && !!pause);
  T.check('they are hidden on the title', root.hidden === true);
  Game.start({ seed: 3 });
  await frames(3);
  T.check('a phone that has not been touched shows no controls during a run', root.hidden === true && Input.device === 'touch', Input.device);

  // ---- a thumb on the stick side ----
  const dead = Settings.get('input.deadzone'), x0 = Math.round(innerWidth * 0.25), y0 = Math.round(innerHeight * 0.62);
  finger('pointerdown', 1, x0, y0);
  const R = base.r.baseVal.value;
  T.check('the first touch shows the controls and takes the stick', root.hidden === false && root.classList.contains('is-held') && R >= 44, R);
  T.check('"floating" puts the stick where the thumb lands', close(base.cx.baseVal.value, x0, 0.5) && close(base.cy.baseVal.value, y0, 0.5),
    [base.cx.baseVal.value, base.cy.baseVal.value, x0, y0]);
  let m = move();
  T.check('a thumb that has not moved does not move the player', m[0] === 0 && m[1] === 0, m);
  finger('pointermove', 1, x0 + R * 0.5, y0);
  m = move();
  const half = (0.5 - dead) / (1 - dead);
  T.check('half way to the rim the move is part of the way: evenly from the dead zone to the rim', close(m[0], half) && close(m[1], 0), [m, half]);
  T.check('the knob follows the thumb', close(knob.cx.baseVal.value, x0 + R * 0.5, 0.5) && close(knob.cy.baseVal.value, y0, 0.5));
  finger('pointermove', 1, x0, y0 - R);
  m = move();
  T.check('at the rim, straight up, the move is full', close(m[0], 0) && close(m[1], -1), m);
  finger('pointermove', 1, x0 + R * dead * 0.6, y0);
  m = move();
  T.check('inside the dead zone the move is 0', m[0] === 0 && m[1] === 0, m);
  finger('pointermove', 1, x0 - R * 0.6, y0 + R * 0.6);
  m = move();
  T.check('a push between two directions points between them and is not longer than 1', close(m[0], -m[1]) && m[0] < 0 && Math.hypot(m[0], m[1]) <= 1 + 1e-9, m);
  finger('pointermove', 1, x0 - R * 3, y0);
  m = move();
  const reach = Math.hypot(knob.cx.baseVal.value - base.cx.baseVal.value, knob.cy.baseVal.value - base.cy.baseVal.value);
  T.check('past the rim the knob is held to the rim and the move is full', close(m[0], -1) && close(m[1], 0) && reach <= R + 0.5, [m, reach, R]);

  // ---- a second finger on button A while the first keeps moving ----
  const frame = Input.sample();
  let pressed = 0, moving = 0, steps = 0;
  const offStep = Plat.on('step', () => {
    steps++;
    if (frame[F.A]) pressed++;
    if (frame[F.moveX] !== 0 || frame[F.moveY] !== 0) moving++;
  });
  const [ax, ay] = middle(btnA);
  finger('pointerdown', 2, ax, ay, btnA);
  T.check('button A shows that it is held', btnA.classList.contains('is-down'));
  finger('pointermove', 1, x0 + R * 2, y0 + 4);
  const s0 = steps;
  await T.until(() => steps >= s0 + 10, 5000);
  m = move();
  T.check('a second finger on button A is reported once while the first keeps moving', pressed === 1 && moving >= 10 && m[0] > 0.9, { pressed: pressed, moving: moving, move: m });
  finger('pointerup', 2, ax, ay, btnA);
  T.check('lifting it lets the button go', !btnA.classList.contains('is-down'));
  finger('pointerup', 1, x0 + R * 2, y0 + 4);
  m = move();
  T.check('lifting the thumb brings the move back to 0, and the stick home', m[0] === 0 && m[1] === 0 && !root.classList.contains('is-held') &&
    close(knob.cx.baseVal.value, base.cx.baseVal.value, 0.01), m);
  offStep();

  // ---- pointercancel, sliding off, and a finger lifted outside the window ----
  finger('pointerdown', 3, x0, y0);
  finger('pointermove', 3, x0, y0 + R);
  const pushed = move();
  finger('pointercancel', 3, x0, y0 + R);
  m = move();
  T.check('pointercancel lets the stick go', pushed[1] > 0.9 && m[0] === 0 && m[1] === 0, [pushed, m]);
  finger('pointerdown', 4, ax, ay, btnA);
  finger('pointercancel', 4, ax, ay, btnA);
  T.check('and a button', !btnA.classList.contains('is-down'));
  const [bx, by] = middle(btnB);
  finger('pointerdown', 5, bx, by, btnB);
  const down = btnB.classList.contains('is-down');
  finger('pointermove', 5, bx - 3, by + 2, btnB);
  const still = btnB.classList.contains('is-down');
  finger('pointermove', 5, bx - 150, by - 150, btnB);
  T.check('a finger that slides off a button lets it go', down && still && !btnB.classList.contains('is-down'));
  finger('pointerup', 5, bx - 150, by - 150, btnB);
  finger('pointerdown', 6, x0, y0);
  finger('pointermove', 6, -40, y0);
  const outside = move();
  finger('pointerup', 6, -40, y0);
  m = move();
  T.check('a thumb that leaves the window still steers, and lifting it there lets go', outside[0] < -0.9 && m[0] === 0, [outside, m]);
  const twice = (() => { finger('pointerdown', 7, x0, y0); finger('pointerdown', 8, x0 - 20, y0 - 20); const id = move(); finger('pointerup', 8, x0 - 20, y0 - 20); const after = move(); finger('pointermove', 7, x0 + R, y0); const own = move(); finger('pointerup', 7, x0 + R, y0); return [id, after, own]; })();
  T.check('a second thumb on the stick side does not take the stick from the first', twice[0][0] === 0 && twice[1][0] === 0 && close(twice[2][0], 1), twice);

  // ---- the same with real fingers, sent from outside the page: the browser's own pointer capture ----
  let realA = 0, realSteps = 0;
  const offReal = Plat.on('step', () => { realSteps++; if (frame[F.A]) realA++; });
  await T.touch('start', [{ id: 1, x: x0, y: y0 }]);
  await T.touch('move', [{ id: 1, x: x0 + R, y: y0 }]);
  await T.until(() => move()[0] > 0.99, 3000);
  const realPush = move();
  await T.touch('start', [{ id: 2, x: ax, y: ay }]);
  await T.touch('move', [{ id: 1, x: x0, y: y0 + R }]);
  await T.until(() => move()[1] > 0.99, 3000);
  const realSteer = move(), r0 = realSteps;
  await T.until(() => realSteps >= r0 + 8, 5000);
  await T.touch('end', [{ id: 2, x: ax, y: ay }]);
  await T.touch('move', [{ id: 1, x: 2, y: y0 + R }]);
  await T.until(() => move()[0] < -0.9, 3000);
  const realFar = move();
  await T.touch('end', []);
  await T.until(() => move()[0] === 0, 3000);
  const realRest = move();
  offReal();
  T.check('real fingers: the thumb steers, a second finger on A is one press while it steers on, lifting stops it',
    realPush[0] > 0.99 && realSteer[1] > 0.99 && realA === 1 && realFar[0] < -0.9 && realRest[0] === 0 && realRest[1] === 0 && !btnA.classList.contains('is-down'),
    { push: realPush, steer: realSteer, pressed: realA, far: realFar, rest: realRest });
  await T.touch('start', [{ id: 3, x: x0, y: y0 }]);
  await T.touch('move', [{ id: 3, x: x0, y: y0 - R }]);
  await T.until(() => move()[1] < -0.99, 3000);
  await T.touch('cancel', []);
  await T.until(() => move()[1] === 0, 3000);
  T.check('real fingers: a touch the browser cancels lets the stick go', move()[1] === 0 && !root.classList.contains('is-held'));

  // ---- where everything is ----
  const box = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
  const cs = getComputedStyle(document.getElementById('touch'));
  const edge = { l: parseFloat(cs.paddingLeft), t: parseFloat(cs.paddingTop), r: innerWidth - parseFloat(cs.paddingRight), b: innerHeight - parseFloat(cs.paddingBottom) };
  const meet = (p, q) => p.l < q.r && q.l < p.r && p.t < q.b && q.t < p.b;
  const inside = (p) => p.l >= edge.l - 0.5 && p.t >= edge.t - 0.5 && p.r <= edge.r + 0.5 && p.b <= edge.b + 0.5;
  const survey = (label) => {
    const parts = { stick: box(base), A: box(btnA), B: box(btnB), pause: box(pause) }, names = Object.keys(parts), bad = [];
    for (let i = 0; i < names.length; i++) {
      if (!inside(parts[names[i]])) bad.push(names[i] + ' crosses the safe edge');
      for (let k = i + 1; k < names.length; k++) if (meet(parts[names[i]], parts[names[k]])) bad.push(names[i] + ' meets ' + names[k]);
    }
    const sizes = [btnA, btnB].map((el) => el.offsetWidth);   // its size, not the shrink of a press still easing back
    if (sizes.some((s) => s < 64)) bad.push('a button is under 64px: ' + sizes.join(' '));
    if (pause.offsetWidth < 44) bad.push('the pause button is under 44px');
    return bad.length ? label + ': ' + bad.join('; ') + ' ' + JSON.stringify(parts) : '';
  };
  const sides = () => {
    const mid = innerWidth / 2, c = (el) => middle(el)[0];
    return { stick: base.cx.baseVal.value < mid ? 'left' : 'right', A: c(btnA) < mid ? 'left' : 'right', B: c(btnB) < mid ? 'left' : 'right', pause: c(pause) < mid ? 'left' : 'right' };
  };
  const problems = [];
  const right = sides();
  T.check('by default the buttons and the pause button sit on the right, the stick on the left',
    right.stick === 'left' && right.A === 'right' && right.B === 'right' && right.pause === 'right', right);
  T.check('button A is the larger, and B sits above it', btnA.getBoundingClientRect().width > btnB.getBoundingClientRect().width && middle(btnB)[1] < middle(btnA)[1]);
  T.check('the pause button is in a top corner', middle(pause)[1] < innerHeight * 0.2, middle(pause));
  for (const hand of ['right', 'left']) {
    for (const mode of ['floating', 'fixed']) {
      for (const scale of [0.85, 1, 1.4]) {
        Settings.set('input.hand', hand);
        Settings.set('input.stick', mode);
        Settings.set('ui.scale', scale);
        problems.push(survey(hand + ' ' + mode + ' ' + scale));
        // a thumb held by the buttons: the stick must keep clear of them
        const near = hand === 'right' ? innerWidth / 2 - 2 : innerWidth / 2 + 2;
        finger('pointerdown', 10, near, innerHeight - 30);
        finger('pointermove', 10, near + (hand === 'right' ? 200 : -200), innerHeight - 40);
        problems.push(survey(hand + ' ' + mode + ' ' + scale + ', held by the buttons'));
        finger('pointerup', 10, near, innerHeight - 40);
      }
    }
  }
  const failed = problems.filter(Boolean);
  T.check('the controls keep clear of each other and of the safe area, for both hands, both sticks and every size', failed.length === 0, failed.slice(0, 2));
  Settings.set('input.stick', 'floating');
  Settings.set('ui.scale', 1);
  Settings.set('input.hand', 'left');
  const left = sides();
  T.check('"left" puts the buttons and the pause button on the left and the stick on the right',
    left.stick === 'right' && left.A === 'left' && left.B === 'left' && left.pause === 'left', left);
  const xl = Math.round(innerWidth * 0.75);
  finger('pointerdown', 11, xl, y0);
  finger('pointermove', 11, xl + R, y0);
  m = move();
  finger('pointerup', 11, xl + R, y0);
  finger('pointerdown', 12, Math.round(innerWidth * 0.25), y0);
  const wrongSide = root.classList.contains('is-held');
  finger('pointerup', 12, Math.round(innerWidth * 0.25), y0);
  T.check('and a thumb on the right takes the stick, while one on the left does not', close(m[0], 1) && !wrongSide, [m, wrongSide]);
  Settings.set('input.hand', 'right');
  Settings.set('input.stick', 'fixed');
  const home = [base.cx.baseVal.value, base.cy.baseVal.value];
  finger('pointerdown', 13, x0, y0 - 100);
  const fixed = [base.cx.baseVal.value, base.cy.baseVal.value], aimed = move();
  finger('pointerup', 13, x0, y0 - 100);
  T.check('"fixed" keeps the stick in the lower corner, and steers from there', close(fixed[0], home[0], 0.01) && close(fixed[1], home[1], 0.01) &&
    home[1] > innerHeight * 0.6 && home[0] < innerWidth * 0.3 && Math.hypot(aimed[0], aimed[1]) > 0.5, [home, fixed, aimed]);
  Settings.set('input.stick', 'floating');

  // ---- keys hide the controls, a touch brings them back ----
  await T.key('KeyX');
  await frames(2);
  const hiddenByKey = root.hidden;
  finger('pointerdown', 14, x0, y0);
  finger('pointerup', 14, x0, y0);
  T.check('a key hides the controls and a touch brings them back', hiddenByKey === true && root.hidden === false && Input.device === 'touch');

  // ---- Input.button ----
  Input.button('A', { icon: 'Z', cooldown: 0.5, charges: 3 });
  const sweep = btnA.querySelector('.tc-sweep'), badge = btnA.querySelector('.tc-charges'), slot = btnA.querySelector('.tc-icon');
  T.check('Input.button shows an icon, a cooldown and charges', slot.textContent === 'Z' && Math.abs(parseFloat(sweep.style.getPropertyValue('--tc-cd')) - 0.5) < 0.03 &&
    badge.hidden === false && badge.textContent === '3' && btnA.classList.contains('is-cooling'), [slot.textContent, sweep.style.getPropertyValue('--tc-cd'), badge.textContent]);
  const icon = document.createElement('canvas');
  Input.button('A', { icon: icon, cooldown: 0, charges: null });
  T.check('an element can be the icon, and the cooldown and charges clear', slot.firstChild === icon && slot.childNodes.length === 1 && !btnA.classList.contains('is-cooling') && badge.hidden === true);
  Input.button('A', { icon: null });
  Input.button('B', { hidden: true });
  T.check('null gives the letter back, and hidden takes a button away', slot.textContent === 'A' && btnB.hidden === true && getComputedStyle(btnB).display === 'none');
  Input.button('B', { hidden: false });
  let refusal = '';
  try { Input.button('C', {}); } catch (e) { refusal = e.message; }
  T.check('there is no button C', /"A" and "B"/.test(refusal), refusal);

  // ---- the pause button, by a real tap ----
  await T.tap(pause);
  await T.until(() => UI.top() === 'settings', 3000);
  T.check('a real tap on the pause button opens the settings and pauses the game', UI.top() === 'settings' && UI.pausing(), UI.top());
  await frames(2);
  T.check('the controls hide while the game is paused', root.hidden === true);
  UI.close();
  await frames(2);
  T.check('and come back when it goes on', root.hidden === false);
  Game.title();
  await frames(2);
  T.check('and hide on the title', root.hidden === true);
  return T.done();
};

// ---- a gamepad the page is made to see ----

const pad = async function () {
  const { Game, Input, Settings, Plat, UI } = TB;
  const F = Input.FIELDS, frames = (n) => new Promise((done) => {
    let left = n;
    const off = Plat.on('frame', () => { if (--left <= 0) { off(); done(); } });
  });
  const make = (index) => ({
    id: 'test pad ' + index, index: index, connected: true, mapping: 'standard', axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  });
  const one = make(0), two = make(1);
  let list = [one, null, null, null];
  Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => list });
  window.dispatchEvent(new Event('gamepadconnected'));
  const near = (a, b) => Math.abs(a - b) < 1e-6;
  Game.start({ seed: 3 });
  await frames(2);
  const dead = Settings.get('input.deadzone');
  one.axes[0] = 0.6;
  await frames(2);
  let f = Input.sample();
  T.check('the left stick moves, and makes the pad the device in use', Input.device === 'pad' && near(f[F.moveX], (0.6 - dead) / (1 - dead)) && f[F.moveY] === 0, [Input.device, f[F.moveX]]);
  one.axes[0] = dead * 0.8;
  await frames(2);
  f = Input.sample();
  T.check('inside the dead zone it does nothing', f[F.moveX] === 0, f[F.moveX]);
  one.axes[0] = 0;
  one.axes[3] = -0.9;
  await frames(2);
  f = Input.sample();
  T.check('the right stick aims', f[F.aim] === true && near(f[F.aimX], 0) && near(f[F.aimY], -1), [f[F.aim], f[F.aimX], f[F.aimY]]);
  one.axes[3] = 0;
  await frames(2);
  T.check('and lets the voices choose again when it rests', Input.sample()[F.aim] === false);

  const frame = Input.sample();
  let a = 0, b = 0, steps = 0;
  const offStep = Plat.on('step', () => { steps++; if (frame[F.A]) a++; if (frame[F.B]) b++; });
  const hold = async (button, ms) => {
    one.buttons[button].pressed = true;
    await T.sleep(ms);
    one.buttons[button].pressed = false;
    const s0 = steps;
    await T.until(() => steps >= s0 + 6, 5000);
  };
  await hold(0, 250);
  T.check('the lower face button is A, once for a press however long it is held', a === 1 && b === 0, { a: a, b: b });
  await hold(1, 60);
  T.check('the right face button is B', a === 1 && b === 1, { a: a, b: b });
  await hold(5, 60);
  await hold(4, 60);
  T.check('the right bumper is A as well, and the left bumper B', a === 2 && b === 2, { a: a, b: b });
  offStep();

  // the pad used last wins
  list = [one, two, null, null];
  window.dispatchEvent(new Event('gamepadconnected'));
  two.axes[1] = 1;
  await frames(2);
  f = Input.sample();
  T.check('a second pad that is used takes over', f[F.moveY] > 0.99, f[F.moveY]);
  two.axes[1] = 0;
  one.axes[1] = -1;
  await frames(2);
  f = Input.sample();
  T.check('and the first takes over again once it is used', f[F.moveY] < -0.99, f[F.moveY]);
  one.axes[1] = 0;
  await frames(2);

  // Start, and the menus
  one.buttons[9].pressed = true;
  await T.until(() => UI.top() === 'settings', 3000);
  one.buttons[9].pressed = false;
  T.check('Start pauses: the settings open', UI.top() === 'settings' && UI.pausing(), UI.top());
  await frames(3);
  const panel = document.querySelector('#ui .set-panel'), at = () => document.activeElement;
  const startAt = at();
  one.buttons[13].pressed = true;   // the d-pad, down
  await T.sleep(200);
  const oneStep = at();
  await T.sleep(700);
  one.buttons[13].pressed = false;
  const rows = Array.from(panel.querySelectorAll('[data-setting]'));
  const rowOf = (el) => rows.findIndex((r) => r.contains(el));
  T.check('a push on the d-pad moves focus one step; held, it goes on after a pause', panel.contains(startAt) && rowOf(oneStep) === rowOf(startAt) + 1 && rowOf(at()) > rowOf(oneStep) + 1,
    [rowOf(startAt), rowOf(oneStep), rowOf(at())]);
  await frames(2);
  const from = rowOf(at());
  // The pad is read at most once a drawn frame, so a push lasts two frames, not a fixed time: on a busy
  // machine one frame can take longer than a short sleep, and the push would never be seen. Two frames stay
  // well under the pause before a repeat (REPEAT_WAIT, 420 ms) unless a frame takes over 200 ms.
  one.axes[1] = -0.9;   // the stick, up, for less than the pause before a repeat
  await frames(2);
  one.axes[1] = 0;
  await frames(2);
  T.check('the stick moves focus too, one step for one push', from > 0 && rowOf(at()) === from - 1, [from, rowOf(at())]);
  await frames(2);
  const choice = rows.find((r) => r.dataset.kind === 'choice' && r.dataset.setting === 'input.hand');
  choice.querySelector('[aria-checked="true"]').focus();
  one.buttons[15].pressed = true;   // right, held for two frames like the stick above
  await frames(2);
  one.buttons[15].pressed = false;
  await frames(2);
  T.check('right on the pad changes a choice', Settings.get('input.hand') === 'left', Settings.get('input.hand'));
  Settings.set('input.hand', 'right');
  const toggle = rows.find((r) => r.dataset.kind === 'switch').querySelector('button'), was = Settings.get('input.haptics');
  toggle.focus();
  one.buttons[0].pressed = true;
  await frames(3);
  one.buttons[0].pressed = false;
  await frames(2);
  T.check('the lower face button presses the control in focus', Settings.get('input.haptics') === !was, Settings.get('input.haptics'));
  Settings.set('input.haptics', was);
  one.buttons[1].pressed = true;
  await frames(3);
  one.buttons[1].pressed = false;
  await frames(2);
  T.check('the right face button closes the screen, and the game goes on', UI.top() === null && !UI.pausing(), UI.top());
  T.check('Input.buzz on a pad without a motor does nothing', Input.buzz(30) === false);
  Settings.set('input.haptics', false);
  T.check('nor with vibration switched off', Input.buzz(30) === false);
  window.dispatchEvent(new Event('gamepaddisconnected'));
  window.dispatchEvent(new Event('gamepaddisconnected'));

  // a pad without the standard mapping, whose axes 2 and 3 are triggers resting at -1
  await T.key('KeyX');
  const odd = make(2);
  odd.mapping = '';
  odd.axes = [0, 0, -1, -1, 0, 0];
  list = [odd, null, null, null];
  window.dispatchEvent(new Event('gamepadconnected'));
  await frames(3);
  f = Input.sample();
  T.check('a pad without the standard mapping does not take over by its resting triggers', Input.device === 'keys' && f[F.aim] === false, [Input.device, f[F.aim]]);
  odd.axes[0] = -1;
  await frames(2);
  f = Input.sample();
  T.check('but its left stick moves', Input.device === 'pad' && f[F.moveX] < -0.99 && f[F.aim] === false, [Input.device, f[F.moveX], f[F.aim]]);
  window.dispatchEvent(new Event('gamepaddisconnected'));
  Game.title();
  return T.done();
};

// ---- settings ----

const settings = async function () {
  const { Settings, Store, UI, Game } = TB;
  await T.until(() => Settings.loaded, 5000);
  T.check('the stored settings are read at boot', Settings.loaded === true);
  const mine = ['input.stick', 'input.hand', 'input.deadzone', 'input.aim', 'input.haptics', 'ui.scale', 'view.quality', 'fx.shake', 'fx.flash', 'fx.numbers'];
  const keys = Settings.keys();
  T.check('every setting of this file is defined, Controls before Display', mine.every((k) => keys.includes(k)) && keys.indexOf('input.stick') < keys.indexOf('ui.scale'), keys);
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.3 : 1;
  const defaults = { 'input.stick': 'floating', 'input.hand': 'right', 'input.deadzone': 0.15, 'input.aim': 'auto', 'input.haptics': true, 'ui.scale': 1, 'view.quality': 'auto', 'fx.shake': calm, 'fx.flash': calm, 'fx.numbers': 1 };
  const off = mine.filter((k) => Settings.get(k) !== defaults[k]);
  T.check('each starts at its default', off.length === 0, off.map((k) => k + '=' + Settings.get(k)));
  T.check('a key nobody defined has no value', Settings.get('nothing.here') === undefined);

  // checking and clamping
  const got = [Settings.set('ui.scale', 5), Settings.set('ui.scale', '1.12'), Settings.set('ui.scale', 'big'), Settings.set('fx.shake', -1),
    Settings.set('input.hand', 'middle'), Settings.set('input.hand', 'left'), Settings.set('input.haptics', 'false'), Settings.set('input.haptics', 'maybe')];
  T.check('numbers are clamped and put on a step, text that is no number changes nothing', got[0] === 1.4 && got[1] === 1.1 && got[2] === 1.1 && got[3] === 0, got);
  T.check('a choice takes only its options, a switch only true and false', got[4] === 'right' && got[5] === 'left' && got[6] === false && got[7] === false, got);
  const quiet = console.warn;
  console.warn = () => {};
  const unknown = Settings.set('nothing.here', 3);
  console.warn = quiet;
  T.check('setting a key nobody defined does nothing', unknown === undefined && Settings.get('nothing.here') === undefined);
  T.check('ui.scale is set on the root as --ui-scale', getComputedStyle(document.documentElement).getPropertyValue('--ui-scale').trim() === '1.1',
    getComputedStyle(document.documentElement).getPropertyValue('--ui-scale'));

  // listeners
  const heard = [];
  const offOne = Settings.on('input.hand', (v, k) => heard.push('one ' + k + '=' + v));
  const offAll = Settings.on('input.*', (v, k) => heard.push('all ' + k + '=' + v));
  Settings.set('input.hand', 'right');
  Settings.set('input.hand', 'right');
  Settings.set('input.aim', 'pointer');
  Settings.set('fx.numbers', 0.5);
  offOne();
  Settings.set('input.hand', 'left');
  offAll();
  Settings.set('input.hand', 'right');
  T.check('Settings.on hears every change of its key, ".*" a whole group, until taken off', heard.join() ===
    'one input.hand=right,all input.hand=right,all input.aim=pointer,all input.hand=left', heard);
  const reports = [];
  const err = console.error;
  console.error = (...args) => reports.push(args.join(' '));
  const offBad = Settings.on('fx.flash', () => { throw new Error('a listener that fails'); });
  Settings.set('fx.flash', 0.5);
  Settings.set('fx.flash', 0.6);
  console.error = err;
  offBad();
  T.check('a listener that throws is reported once and stops nothing', reports.length === 1 && Settings.get('fx.flash') === 0.6, reports);
  let refused = '';
  try { Settings.define('input.hand', { value: true }); } catch (e) { refused = e.message; }
  T.check('a key is defined once', /already defined/.test(refused), refused);
  try { Settings.define('test.bad', { value: 'x', options: [{ value: 'y' }, { value: 'z' }] }); refused = ''; } catch (e) { refused = e.message; }
  T.check('a choice whose default is no option is refused', /not one of its options/.test(refused), refused);
  Settings.define('test.later', { value: 2, min: 0, max: 10, step: 1, label: 'A test number', group: 'Tests', order: 90 });
  Settings.define('test.flag', { value: false, label: 'A test switch', group: 'Tests', order: 91 });
  Settings.define('test.pick', { value: 'b', options: [{ value: 'a', label: 'First' }, { value: 'b', label: 'Second' }, { value: 'c', label: 'Third' }], label: 'A test choice', group: 'Tests', order: 92 });
  T.check('a setting can be defined after boot', Settings.get('test.later') === 2 && Settings.keys().slice(-3).join() === 'test.later,test.flag,test.pick', Settings.keys().slice(-3));
  Settings.reset();
  T.check('Settings.reset puts every setting back', mine.every((k) => Settings.get(k) === defaults[k]) && Settings.get('test.later') === 2);
  await T.until(async () => { const s = await Store.read('settings'); return s && s.values && Object.keys(s.values).length === 0; }, 3000);
  const stored = await Store.read('settings');
  T.check('what differs from the defaults is stored under one key; after a reset nothing does', !!stored && stored.v === 1 && Object.keys(stored.values).length === 0, stored);

  // a hand-made row
  let backed = null;
  Settings.row('test.row', 15, (back) => { backed = back; return UI.button('A row of a test', () => back(), { dataset: { test: 'row' } }); });
  Settings.row('test.none', 16, () => null);

  // ---- the screen ----
  Game.start({ seed: 3 });
  T.check('Settings.open opens the screen, which pauses the game', Settings.open() !== null && UI.top() === 'settings' && UI.pausing(), UI.top());
  T.check('a second call while it is open does nothing', Settings.open() === null && document.querySelectorAll('#ui [data-screen="settings"]').length === 1);
  const panel = document.querySelector('#ui .set-panel'), rowOf = (k) => panel.querySelector('[data-setting="' + k + '"]');
  const all = Settings.keys(), missing = all.filter((k) => !rowOf(k));
  T.check('the screen has a row for every defined setting', missing.length === 0 && panel.querySelectorAll('[data-setting]').length === all.length, missing);
  const kinds = { 'ui.scale': 'number', 'input.hand': 'choice', 'input.haptics': 'switch', 'view.quality': 'choice', 'fx.shake': 'number' };
  T.check('a slider for a number, a set of choices for a choice, a switch for a switch',
    Object.keys(kinds).every((k) => rowOf(k).dataset.kind === kinds[k]) && !!rowOf('ui.scale').querySelector('input[type="range"]') &&
    rowOf('view.quality').querySelectorAll('[role="radio"]').length === 4 && !!rowOf('input.haptics').querySelector('[role="switch"]'));
  const groups = Array.from(panel.querySelectorAll('.set-group-name'), (h) => h.textContent);
  T.check('rows stand under the names of their groups, in order', groups.indexOf('Controls') >= 0 && groups.indexOf('Controls') < groups.indexOf('Display') && groups.includes('Tests'), groups);
  const own = panel.querySelector('[data-row="test.row"]'), ownAt = Array.from(panel.querySelectorAll('[data-row], .set-group')).indexOf(own);
  T.check('a hand-made row stands by its order, and one that builds nothing is left out', !!own && !panel.querySelector('[data-row="test.none"]') && ownAt === 1, ownAt);
  const tall = Array.from(panel.querySelectorAll('[data-setting]')).filter((r) => r.getBoundingClientRect().height < 44).map((r) => r.dataset.setting);
  const controls = Array.from(panel.querySelectorAll('input, button')).filter((c) => c.getBoundingClientRect().height < 44).map((c) => c.className || c.tagName);
  T.check('every row and every control is at least 44 pixels tall', tall.length === 0 && controls.length === 0, [tall, controls]);

  // each row changed by keys alone
  const changed = [], unchanged = [];
  for (const k of all) {
    const row = rowOf(k), kind = row.dataset.kind, was = Settings.get(k);
    const control = kind === 'number' ? row.querySelector('input') : kind === 'choice' ? row.querySelector('[aria-checked="true"]') : row.querySelector('button');
    control.focus();
    if (kind === 'switch') await T.key('Enter');
    else if (kind === 'number') await T.key(was >= Number(control.max) ? 'ArrowLeft' : 'ArrowRight');
    else await T.key(row.querySelectorAll('[role="radio"]')[row.querySelectorAll('[role="radio"]').length - 1] === control ? 'ArrowLeft' : 'ArrowRight');
    (Settings.get(k) !== was ? changed : unchanged).push(k + ' ' + was + ' > ' + Settings.get(k));
  }
  T.check('each row can be changed by keys', unchanged.length === 0 && changed.length === all.length, unchanged.length ? unchanged : changed);
  const hand = rowOf('input.hand'), checkedHand = hand.querySelector('[aria-checked="true"]');
  T.check('a choice moves its one stop for focus to the option chosen', document.activeElement !== null && checkedHand.tabIndex === 0 &&
    Array.from(hand.querySelectorAll('[role="radio"]')).filter((b) => b.tabIndex === 0).length === 1);
  await T.key('Space');
  T.check('Space in the screen presses the control in focus, and reaches no game', UI.top() === 'settings');

  // by touch, on the phone: real taps on a choice, the switch and a slider's line
  if (innerWidth < 600) {
    const tapIn = async (el, share) => {
      el.scrollIntoView({ block: 'center' });
      await T.sleep(50);
      const r = el.getBoundingClientRect();
      await T.tap(share === undefined ? r.left + r.width / 2 : r.left + r.width * share, r.top + r.height / 2);
      await T.sleep(50);
    };
    const options = rowOf('input.stick').querySelectorAll('[role="radio"]'), stickWas = Settings.get('input.stick');
    await tapIn(options[stickWas === 'floating' ? 1 : 0]);
    const flip = rowOf('input.haptics').querySelector('[role="switch"]'), hapticsWas = Settings.get('input.haptics');
    await tapIn(flip);
    const line = rowOf('fx.shake').querySelector('input');
    await tapIn(line, 0.03);
    const low = Settings.get('fx.shake');
    await tapIn(line, 0.97);
    T.check('a tap picks a choice, flips the switch and moves a slider to where it lands',
      Settings.get('input.stick') !== stickWas && Settings.get('input.haptics') === !hapticsWas && low <= 0.1 && Settings.get('fx.shake') >= 0.9,
      [Settings.get('input.stick'), Settings.get('input.haptics'), low, Settings.get('fx.shake')]);
  }
  Settings.set('ui.scale', 1.25);
  const shown = rowOf('ui.scale');
  T.check('a value set while the screen is open shows in its row', shown.querySelector('input').value === '1.25' && shown.querySelector('.set-value').textContent === '125%',
    [shown.querySelector('input').value, shown.querySelector('.set-value').textContent]);

  // up and down walk the rows
  rowOf(all[0]).querySelector(rowOf(all[0]).dataset.kind === 'number' ? 'input' : '[tabindex="0"]').focus();
  const seen = new Set(), path = [];
  for (let i = 0; i < all.length + 3; i++) {
    const at = document.activeElement, row = at && at.closest('[data-setting], [data-row], [data-act]');
    path.push(row ? row.dataset.setting || row.dataset.row || row.dataset.act : at && at.tagName);
    if (row && row.dataset.setting) seen.add(row.dataset.setting);
    await T.key('ArrowDown');
  }
  T.check('the arrow keys walk down through every row', all.every((k) => seen.has(k)), [all.filter((k) => !seen.has(k)), path.join(' ')]);
  panel.querySelector('[data-test="row"]').click();
  T.check('back() of a hand-made row closes the screen', UI.top() === null && typeof backed === 'function');
  Settings.open();
  panel.ownerDocument.querySelector('#ui [data-act="defaults"]').click();
  await T.until(() => UI.top() === 'confirm', 2000);
  document.querySelector('#ui [data-answer="yes"]').click();
  await T.until(() => UI.top() === 'settings', 2000);
  T.check('Defaults asks first, then puts every setting back', mine.every((k) => Settings.get(k) === defaults[k]), mine.filter((k) => Settings.get(k) !== defaults[k]));
  document.querySelector('#ui [data-act="done"]').click();
  T.check('Done closes the screen, and the game goes on', UI.top() === null && !UI.pausing());
  Game.title();
  return T.done();
};

// A value set survives a reload. The published page has no storage that lasts: there the reload starts afresh.
const keptBefore = async function () {
  const { Settings, Store } = TB;
  await T.until(() => Settings.loaded, 5000);
  Settings.set('ui.scale', 1.2);
  Settings.set('input.hand', 'left');
  Settings.set('input.haptics', false);
  Settings.set('fx.shake', 0.4);
  const has = async () => { const s = await Store.read('settings'); return !!s && s.values['ui.scale'] === 1.2 && s.values['fx.shake'] === 0.4 && s.values['input.haptics'] === false; };
  T.check('the values are stored', await T.until(has, 3000), await Store.read('settings'));
  if (T.target === 'standalone') {
    const raw = JSON.parse(localStorage.getItem('tollbound.settings'));
    raw.values['test.other'] = 'kept for a module this build lacks';
    localStorage.setItem('tollbound.settings', JSON.stringify(raw));
  }
  return T.done();
};

const keptAfter = async function () {
  const { Settings, Store } = TB;
  await T.until(() => Settings.loaded, 5000);
  const now = { scale: Settings.get('ui.scale'), hand: Settings.get('input.hand'), haptics: Settings.get('input.haptics'), shake: Settings.get('fx.shake') };
  const css = getComputedStyle(document.documentElement).getPropertyValue('--ui-scale').trim();
  if (T.target === 'standalone') {
    T.check('a value set survives a reload', now.scale === 1.2 && now.hand === 'left' && now.haptics === false && now.shake === 0.4, now);
    T.check('and is applied: --ui-scale is 1.2', css === '1.2', css);
    Settings.set('fx.numbers', 0.5);
    await T.until(async () => { const s = await Store.read('settings'); return s && s.values['fx.numbers'] === 0.5; }, 3000);
    const s = await Store.read('settings');
    T.check('a stored value of a key nobody defines is kept when the settings are saved again', s.values['test.other'] === 'kept for a module this build lacks', s.values);
    localStorage.setItem('tollbound.settings', JSON.stringify({ v: 1, values: { 'ui.scale': 'huge', 'input.hand': 'middle', 'fx.shake': -5, 'input.deadzone': 0.33, 'input.haptics': 'yes' } }));
  } else {
    T.check('a page without lasting storage starts again from the defaults', now.scale === 1 && now.hand === 'right' && now.haptics === true, now);
  }
  return T.done();
};

const rubbish = async function () {
  const { Settings, Store, UI } = TB;
  await T.until(() => Settings.loaded, 5000);
  if (T.target === 'standalone') {
    T.check('stored rubbish is left out: defaults where it makes no sense, a clamp where it is only too far',
      Settings.get('ui.scale') === 1 && Settings.get('input.hand') === 'right' && Settings.get('fx.shake') === 0 && Settings.get('input.deadzone') === 0.35 && Settings.get('input.haptics') === true,
      ['ui.scale', 'input.hand', 'fx.shake', 'input.deadzone', 'input.haptics'].map((k) => Settings.get(k)));
  }
  // storage that throws at every touch
  const real = Object.getOwnPropertyDescriptor(window, 'localStorage');
  Object.defineProperty(window, 'localStorage', { configurable: true, get: () => { throw new DOMException('no storage here', 'SecurityError'); } });
  let threw = null;
  try {
    Settings.set('ui.scale', 0.9);
    Settings.set('input.stick', 'fixed');
  } catch (e) { threw = e; }
  await T.until(() => Store.status === 'memory', 2000);
  T.check('with storage that throws, setting a value throws nothing and the value holds', threw === null && Settings.get('ui.scale') === 0.9 && Settings.get('input.stick') === 'fixed' && Store.status === 'memory',
    [threw && threw.message, Settings.get('ui.scale'), Store.status]);
  T.check('and the screen still opens', Settings.open() !== null && UI.top() === 'settings');
  UI.close();
  if (real) Object.defineProperty(window, 'localStorage', real); else delete window.localStorage;
  return T.done();
};

// A player whose system asks for less motion starts with shake and flash at 0.3, and what they choose wins.
const calmBefore = async function () {
  const { Settings, Store } = TB;
  await T.until(() => Settings.loaded, 5000);
  T.check('the page sees the request for less motion', matchMedia('(prefers-reduced-motion: reduce)').matches);
  T.check('shake and flash start at 0.3, damage numbers at 1', Settings.get('fx.shake') === 0.3 && Settings.get('fx.flash') === 0.3 && Settings.get('fx.numbers') === 1,
    [Settings.get('fx.shake'), Settings.get('fx.flash'), Settings.get('fx.numbers')]);
  Settings.set('fx.shake', 0.8);
  if (T.target === 'standalone') T.check('a value chosen is stored', await T.until(async () => { const s = await Store.read('settings'); return !!s && s.values['fx.shake'] === 0.8; }, 3000));
  return T.done();
};

const calmAfter = async function () {
  const { Settings } = TB;
  await T.until(() => Settings.loaded, 5000);
  if (T.target === 'standalone') {
    T.check('after a reload the chosen value holds, and the other keeps the calm default', Settings.get('fx.shake') === 0.8 && Settings.get('fx.flash') === 0.3, [Settings.get('fx.shake'), Settings.get('fx.flash')]);
  } else {
    T.check('without lasting storage both start calm again', Settings.get('fx.shake') === 0.3 && Settings.get('fx.flash') === 0.3, [Settings.get('fx.shake'), Settings.get('fx.flash')]);
  }
  return T.done();
};

module.exports = [
  { name: 'input: keys and mouse, desktop 1280x720', viewport: { width: 1280, height: 720 }, mobile: false, query: 'view=2d', run: keys },
  { name: 'input: touch, phone 390x844', viewport: { width: 390, height: 844 }, mobile: true, query: 'view=2d', run: touch },
  { name: 'input: touch, phone on its side with a notch', viewport: { width: 844, height: 390 }, mobile: true, query: 'view=2d',
    safeArea: { top: 0, right: 47, bottom: 21, left: 47 }, run: touch },
  { name: 'input: touch, phone upright with a notch and a home bar', viewport: { width: 390, height: 844 }, mobile: true, query: 'view=2d',
    safeArea: { top: 47, right: 0, bottom: 34, left: 0 }, run: touch },
  { name: 'input: gamepad, desktop 1280x720', viewport: { width: 1280, height: 720 }, mobile: false, query: 'view=2d', run: pad },
  { name: 'input: settings and their screen, desktop 1280x720', viewport: { width: 1280, height: 720 }, mobile: false, query: 'view=2d', run: settings },
  { name: 'input: settings on a phone, by keys', viewport: { width: 390, height: 844 }, mobile: true, query: 'view=2d', run: settings },
  { name: 'input: settings survive a reload, and storage that fails', viewport: { width: 1280, height: 720 }, mobile: false, query: '', run: [keptBefore, keptAfter, rubbish] },
  { name: 'input: less motion, where the system asks for it', viewport: { width: 390, height: 844 }, mobile: true, query: 'view=2d', reducedMotion: true, run: [calmBefore, calmAfter] },
];
