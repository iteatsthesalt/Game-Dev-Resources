// tests/scenarios/10-shell.js: the shell around the simulation: the platform helpers and storage (50-platform.js),
// the list of views (65-gfx.js), the plain 2D view (67-gfx-2d.js), the menu framework (70-ui-core.js) and the
// game loop (90-game.js).
// Three parts:
//   menus    the title, the screen stack, focus and keys, the confirm dialog, toasts, the view, the platform
//            helpers and a first look at storage. On a desktop window and on a phone. Needs no simulation.
//   storage  Store across a reload, and with storage that fills up or is gone. Needs no simulation.
//   vigil    a run: "Begin vigil", the steps of the frame loop, Game.sim, the picture, pausing, the hidden page,
//            walking, the same seed twice, the results and the way back. On a desktop window and on a phone.
//            Needs the simulation: without Sim.debugScene its first check fails and says so.
// All three ask for the plain view (?view=2d) where the picture matters, so they keep testing that view once
// the 3D view exists. Each function below runs inside the page (see tests/run.js), so it uses only T, TB and
// the page itself.

const menus = async function () {
  const { UI, Game, Plat, Gfx, Store } = TB;
  const phone = innerWidth < 600, ui = document.getElementById('ui');
  const key = (name, more) => {
    const e = new KeyboardEvent('keydown', Object.assign({ key: name, bubbles: true, cancelable: true }, more));
    window.dispatchEvent(e);
    return e;
  };
  const button = (text) => Array.from(ui.querySelectorAll('.ui-screen:not([inert]) button')).find((b) => b.textContent.trim() === text);
  const settle = (promise) => Promise.race([promise, T.sleep(2000).then(() => 'never settled')]);
  const stackNow = () => Array.from(ui.children, (w) => w.dataset.screen + (w.inert ? ' (under)' : '')).join(', ');
  const focusName = () => (document.activeElement && document.activeElement.dataset.cell) || '';
  // Runs fn with console.error held back, and returns how often it was called: for failures the test sets off itself.
  const quietly = (fn) => {
    const real = console.error;
    let calls = 0;
    console.error = () => { calls++; };
    try { fn(); } finally { console.error = real; }
    return calls;
  };

  // ---- the title ----
  T.check('the game starts on the title, with no run', Game.state === 'title' && UI.top() === 'title' && Game.S === null, [Game.state, UI.top()]);
  const name = ui.querySelector('h1'), sub = ui.querySelectorAll('.ui-sub'), begin = button('Begin vigil'), build = ui.querySelector('.ui-note');
  T.check('the title names the game', !!name && name.textContent === 'Tollbound', name && name.textContent);
  T.check('the title has one line of subtitle', sub.length === 1 && sub[0].textContent.length > 10, sub.length);
  T.check('the title has a "Begin vigil" button, and focus starts on it', !!begin && document.activeElement === begin);
  T.check('the build line names the build, the view and the storage',
    !!build && /^Build \d+\.\d+\.\d+ · .+ · .+$/.test(build.textContent) && build.textContent.includes(Game.VERSION), build && build.textContent);
  T.check('the view is the plain one the address asked for', !!Gfx.active && Gfx.active.name === '2d' && Gfx.active.caps.puppets === false, Gfx.active && Gfx.active.name);
  const box = name.getBoundingClientRect(), screenBox = ui.querySelector('.ui-screen');
  T.check('the title fits the window', box.left >= 0 && box.right <= innerWidth && screenBox.scrollWidth <= innerWidth && screenBox.scrollHeight <= innerHeight,
    [box.left, box.right, screenBox.scrollWidth, screenBox.scrollHeight]);
  key('Escape');
  T.check('Escape does not close the title', UI.top() === 'title' && UI.back() === false);
  T.check('the focus ring starts shown, except on a touch screen', ui.classList.contains('ui-keys') === !phone);

  // ---- the picture behind the title, and the scale of the view ----
  const picture = () => new Promise((resolve) => requestAnimationFrame(() => {
    const view = document.getElementById('view'), copy = document.createElement('canvas');
    copy.width = view.width;
    copy.height = view.height;
    const ctx = copy.getContext('2d'), colours = new Set();
    ctx.drawImage(view, 0, 0);
    for (const at of [0.31, 0.5, 0.73]) {   // three rows of pixels, right across
      const row = ctx.getImageData(0, Math.floor(view.height * at), view.width, 1).data;
      for (let i = 0; i < row.length; i += 4) colours.add((row[i] << 16) | (row[i + 1] << 8) | row[i + 2]);
    }
    resolve({ colours: colours.size, size: [view.width, view.height] });
  }));
  const behind = await picture();
  T.check('the canvas has the pixels of the window', behind.size[0] === Math.round(innerWidth * Math.min(devicePixelRatio, 2)) &&
    behind.size[1] === Math.round(innerHeight * Math.min(devicePixelRatio, 2)), behind.size);
  T.check('the ground and its lines are drawn behind the title', behind.colours >= 2, behind);
  const a = Object.assign({}, Gfx.worldToScreen(-15, -15, 0)), b = Object.assign({}, Gfx.worldToScreen(15, 15, 0));
  T.check('30 metres of ground fit the longer side of the screen', Math.abs(Math.max(b.x - a.x, b.y - a.y) - Math.max(innerWidth, innerHeight)) < 0.01, [a, b]);
  const mid = Object.assign({}, Gfx.worldToScreen(0, 0)), up = Object.assign({}, Gfx.worldToScreen(0, 0, 2));
  T.check('the camera rests on the middle of the ground, and height lifts a point up the screen',
    Math.abs(mid.x - innerWidth / 2) < 0.01 && Math.abs(mid.y - innerHeight / 2) < 0.01 && up.y < mid.y && up.x === mid.x, [mid, up]);
  const ground = Object.assign({}, Gfx.screenToWorld(a.x, a.y)), own = { x: 0, y: 0 };
  T.check('Gfx.screenToWorld is the way back, and fills the object it is given',
    Math.abs(ground.x + 15) < 1e-9 && Math.abs(ground.y + 15) < 1e-9 && Gfx.screenToWorld(b.x, b.y, own) === own && Math.abs(own.x - 15) < 1e-9, [ground, own]);

  // ---- the plain view, on a canvas of its own: 300 by 200 pixels, so 10 pixels to a metre ----
  const canvas = document.createElement('canvas'), view = Gfx.backends['2d'](canvas);
  const at = (x, y) => Array.from(canvas.getContext('2d').getImageData(x, y, 1, 1).data.slice(0, 3)).join(' ');
  view.resize(300, 200, 1);
  view.begin({ x: 0, y: 0, zoom: 1 }, { ground: [0, 0, 0] });
  view.parts('box', new Float32Array(32), 1);
  view.lights(new Float32Array(8), 1);
  const decals = new Float32Array(2 * Gfx.DECAL_STRIDE), discs = new Float32Array(2 * Gfx.DISC_STRIDE), boards = new Float32Array(2 * Gfx.BILLBOARD_STRIDE);
  decals.set([10, 0, 3, 0, 1, 0, 1, 0, 10, 6, 2, 0, 1, 0, 1, 1]);          // a bare ring, and one filled in
  discs.set([0, 0, 2, 1, 0, 0, 1, 500, 0, 1, 1, 1, 1, 1]);                // a red disc in the middle, and one far off the canvas
  boards.set([-10, 0, 0, 1, 0, 0, 1, 1, 0, -10, 6, 4, 1, 1, 1, 0, 1, 0]);  // on the ground, and 4 metres above it
  view.decals(decals, 2);
  view.discs(discs, 2);
  view.billboards(boards, 2);
  view.end({ flash: 0, vignette: 0 });
  T.check('the plain view paints the ground and a line every 2 metres', at(185, 107) === '0 0 0' && at(190, 107) !== '0 0 0' && at(185, 120) !== '0 0 0',
    [at(185, 107), at(190, 107), at(185, 120)]);
  T.check('a disc is filled with its colour', at(150, 100) === '255 0 0' && at(160, 108) === '255 0 0', at(150, 100));
  T.check('a decal is a ring, and fills in by its fill', at(250, 70) === '0 255 0' && at(250, 100) !== '0 255 0' && /^0 7\d 0$/.test(at(253, 163)),
    [at(250, 70), at(250, 100), at(253, 163)]);
  T.check('a billboard is a square, lifted by its height', at(50, 100) === '0 0 255' && at(50, 140) === '255 255 0' && at(52, 163) === '0 0 0',
    [at(50, 100), at(50, 140), at(52, 163)]);
  T.check('the view counts what it drew and leaves out what is off the canvas', view.stats.instances === 5 && view.stats.drawCalls > 0, view.stats);
  view.begin({ x: 0, y: 0, zoom: 1 }, null);
  view.end({ flash: 1 });
  T.check('a full flash whitens the frame', at(185, 107) === '255 255 255', at(185, 107));
  view.resize(100, 50, 3);
  const widths = [canvas.width];
  for (const level of ['medium', 'low', 'high']) {
    view.quality(level);
    widths.push(canvas.width);
  }
  T.check('the quality caps the pixels to a CSS pixel at 2, 1.5 and 1', widths.join(' ') === '200 150 100 200' && canvas.height === 100, widths);
  T.check('the view states what it cannot do', ['puppets', 'shadows', 'lights', 'bloom'].every((c) => view.caps[c] === false) && view.caps.maxInstances > 1500, view.caps);
  T.check('making a view by its factory leaves the active one alone', Gfx.active !== view && Gfx.active.canvas === document.getElementById('view'));
  const factory = () => view;
  Gfx.register('test', factory, () => false);
  let refusal = '';
  try { Gfx.register('test', factory); } catch (e) { refusal = e.message; }
  T.check('Gfx.register adds a view once', Gfx.backends.test === factory && /already registered/.test(refusal), refusal);

  // ---- UI.h ----
  let clicks = 0;
  const made = UI.h('div', { class: ['a', null, 'b'], dataset: { kind: 'x' }, style: { color: 'red', '--gap': '4px' }, onclick: () => { clicks++; },
    title: 'T', hidden: false, 'aria-busy': true }, 'one ', 2, [UI.h('b', null, 'three'), null], false, '<i>four</i>');
  made.click();
  T.check('UI.h sets class, dataset, style, handlers and attributes', made.className === 'a b' && made.dataset.kind === 'x' && made.style.color === 'red' &&
    made.style.getPropertyValue('--gap') === '4px' && clicks === 1 && made.title === 'T' && !made.hasAttribute('hidden') && made.getAttribute('aria-busy') === '');
  T.check('UI.h adds text as text, never as markup', made.textContent === 'one 2three<i>four</i>' && made.children.length === 1 && !made.querySelector('i'), made.textContent);

  // ---- the stack of screens ----
  const log = [];
  const cell = (id) => UI.button(id, () => log.push('click ' + id), { dataset: { cell: id } });
  UI.screen('test.grid', {
    open: (args) => {
      log.push('open ' + (args && args.n));
      return UI.h('div', { class: 'ui-panel' },
        UI.h('div', { class: 'ui-row' }, cell('a'), cell('b')),
        UI.h('div', { class: 'ui-row', style: { marginTop: '12px' } }, cell('c'), cell('d')),
        UI.h('div', { tabindex: '0', role: 'button', dataset: { cell: 'e' }, style: { marginTop: '12px' }, onclick: () => log.push('click e') }, 'e'));
    },
    close: () => log.push('close'),
  });
  UI.screen('test.bare', { back: false, pause: false, scrim: false, open: () => UI.h('div', { class: 'ui-panel' }, UI.h('p', null, 'Nothing to press here.')) });
  T.check('UI.has knows the registered screens', UI.has('test.grid') && UI.has('title') && UI.has('results') && !UI.has('test.none'));
  try { UI.screen('test.grid', { open: () => null }); refusal = ''; } catch (e) { refusal = e.message; }
  T.check('a second screen under one id is refused', /already registered/.test(refusal), refusal);
  try { UI.open('test.none'); refusal = ''; } catch (e) { refusal = e.message; }
  T.check('opening a screen nobody registered throws', /no screen is registered/.test(refusal), refusal);

  const grid = UI.open('test.grid', { n: 1 });
  T.check('UI.open puts the screen on top; the title stays under it and takes no input', UI.top() === 'test.grid' && stackNow() === 'title (under), test.grid', stackNow());
  T.check('open() got its arguments, and UI.open gives back what it built', log.join() === 'open 1' && grid.classList.contains('ui-panel'), log);
  T.check('focus moves into the screen, to its first control', focusName() === 'a', focusName());
  T.check('every control is at least 44 pixels high', Array.from(document.querySelectorAll('#ui button')).every((x) => x.getBoundingClientRect().height >= 44),
    Array.from(document.querySelectorAll('#ui button'), (x) => x.getBoundingClientRect().height));

  // ---- moving focus ----
  const walk = [UI.nav(1, 0) && focusName(), UI.nav(0, 1) && focusName(), UI.nav(-1, 0) && focusName(), UI.nav(0, -1) && focusName()].join('');
  T.check('UI.nav moves focus right, down, left and up', walk === 'bdca', walk);
  T.check('UI.nav stays at the edge and says so', UI.nav(-1, 0) === false && UI.nav(0, -1) === false && focusName() === 'a');
  T.check('moving focus by keys shows the focus ring', ui.classList.contains('ui-keys'));
  window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  T.check('a pointer press hides the ring', !ui.classList.contains('ui-keys'));
  const arrow = key('ArrowRight');
  T.check('the arrow keys move focus, and bring the ring back', focusName() === 'b' && arrow.defaultPrevented && ui.classList.contains('ui-keys'), focusName());
  const round = [key('Tab') && focusName(), key('Tab') && focusName(), key('Tab') && focusName(), key('Tab') && focusName(), key('Tab', { shiftKey: true }) && focusName()].join('');
  T.check('Tab goes round the controls of the top screen and never leaves it', round === 'cdeae', round);
  key('Enter');
  T.check('Enter activates a control the browser would not click itself', log.join() === 'open 1,click e', log);
  UI.nav(0, -1);
  const pressed = UI.activate();
  T.check('UI.activate clicks the focused control', pressed === true && /^open 1,click e,click [cd]$/.test(log.join()), log);
  const stay = (e) => e.preventDefault(), here = document.activeElement;
  here.addEventListener('ui-nav', stay);
  T.check('a control can keep a move for itself', UI.nav(0, -1) === true && document.activeElement === here);
  here.removeEventListener('ui-nav', stay);

  // ---- fields: a text field keeps its arrows, a slider and a select take left and right ----
  const changes = [];
  UI.screen('test.form', {
    pause: false,
    open: () => UI.h('div', { class: 'ui-panel ui-stack' },
      UI.h('input', { type: 'text', value: 'bell', dataset: { cell: 'text' } }),
      UI.h('input', { type: 'range', min: '0', max: '10', step: '1', value: '5', dataset: { cell: 'range' }, oninput: (e) => changes.push('range ' + e.target.value) }),
      UI.h('select', { dataset: { cell: 'select' }, onchange: (e) => changes.push('select ' + e.target.value) },
        UI.h('option', { value: 'low' }, 'Low'), UI.h('option', { value: 'high' }, 'High')),
      cell('ok')),
  });
  UI.open('test.form');
  const inField = key('ArrowDown'), fieldEnter = key('Enter');
  T.check('a text field keeps the arrow keys and Enter', focusName() === 'text' && !inField.defaultPrevented && !fieldEnter.defaultPrevented);
  UI.nav(0, 1);
  const slid = [UI.nav(1, 0), UI.nav(1, 0), UI.nav(-1, 0)].join(), onSlider = key('ArrowRight');
  T.check('a slider takes left and right as its own', focusName() === 'range' && slid === 'true,true,true' && changes.join() === 'range 6,range 7,range 6' && !onSlider.defaultPrevented, changes);
  UI.nav(0, 1);
  UI.nav(1, 0);
  T.check('so does a select', focusName() === 'select' && changes[changes.length - 1] === 'select high' && UI.nav(1, 0) === true, changes);
  key('ArrowDown');
  T.check('up and down still move on from them', focusName() === 'ok', focusName());
  T.check('Escape closes a screen that allows it', UI.pausing() && key('Escape').defaultPrevented && UI.top() === 'test.grid' && document.activeElement === here);

  // ---- closing, replacing, clearing ----
  UI.open('test.bare');
  T.check('a screen without controls takes focus itself', document.activeElement === ui.lastElementChild && stackNow() === 'title (under), test.grid (under), test.bare', stackNow());
  key('Escape');
  T.check('a screen can refuse Escape and UI.back', UI.top() === 'test.bare' && UI.back() === false);
  T.check('UI.close closes the top screen, and focus returns to where it was', UI.close() === 'test.bare' && UI.top() === 'test.grid' && document.activeElement === here, focusName());
  UI.screen('test.unbuilt', { open: () => { throw new Error('a screen that cannot be built'); } });
  try { UI.replace('test.unbuilt'); refusal = ''; } catch (e) { refusal = e.message; }
  T.check('a screen that cannot be built replaces nothing', /cannot be built/.test(refusal) && UI.top() === 'test.grid' && document.activeElement === here, stackNow());
  UI.replace('test.bare');
  T.check('UI.replace swaps the top screen', stackNow() === 'title (under), test.bare' && log[log.length - 1] === 'close', stackNow());
  UI.close();
  T.check('and hands its way back on to the new one', UI.top() === 'title' && document.activeElement === button('Begin vigil'));
  UI.open('test.grid', { n: 2 });
  UI.open('test.bare');
  T.check('UI.close(id) closes that screen wherever it is', UI.close('test.grid') === 'test.grid' && stackNow() === 'title (under), test.bare' && !UI.isOpen('test.grid') && UI.isOpen('test.bare') && UI.close('test.grid') === null, stackNow());
  UI.screen('test.asks', { back: () => log.push('asked'), open: () => UI.h('div', { class: 'ui-panel' }, 'Asks first') });
  UI.open('test.asks');
  T.check('a screen can answer Escape and UI.back itself', key('Escape').defaultPrevented && UI.back() === true && UI.top() === 'test.asks' && log.slice(-2).join() === 'asked,asked', log);
  UI.close();
  UI.screen('test.sour', { open: () => UI.h('div', { class: 'ui-panel' }, 'Sour'), close: () => { throw new Error('a close() that fails'); } });
  UI.open('test.sour');
  let soured = null;
  const complaints = quietly(() => { soured = UI.close(); });
  T.check('a screen whose close() throws is reported, and goes all the same', soured === 'test.sour' && complaints === 1 && stackNow() === 'title (under), test.bare', stackNow());
  UI.clear();
  T.check('UI.clear closes everything', UI.top() === null && ui.children.length === 0 && !UI.pausing() && UI.close() === null);
  T.check('with no screen open the keys are left alone', UI.nav(1, 0) === false && UI.activate() === false && UI.back() === false && !key('ArrowDown').defaultPrevented);
  Game.title();
  T.check('Game.title shows the title again', UI.top() === 'title' && Game.state === 'title' && document.activeElement === button('Begin vigil'));

  // ---- the confirm dialog ----
  const first = UI.confirm('Leave the vigil?', { yes: 'Leave', no: 'Stay' });
  const dialog = ui.querySelector('[role="alertdialog"]');
  T.check('UI.confirm opens a dialog in the page, with the text and both labels',
    UI.top() === 'confirm' && !!dialog && dialog.textContent.includes('Leave the vigil?') && !!button('Leave') && !!button('Stay'), stackNow());
  T.check('focus starts on the "no" button', document.activeElement === button('Stay'));
  T.check('the dialog pauses, and the title under it takes no input', UI.pausing() && ui.firstElementChild.inert === true);
  T.check('the buttons of the dialog are at least 44 pixels high', button('Leave').getBoundingClientRect().height >= 44 && button('Stay').getBoundingClientRect().height >= 44);
  key('ArrowLeft');
  T.check('the arrow keys move between the two buttons', document.activeElement === button('Leave'));
  button('Leave').click();
  T.check('the "yes" button resolves true', (await settle(first)) === true);
  T.check('the dialog is gone, and focus is back where it was', UI.top() === 'title' && !ui.querySelector('[role="alertdialog"]') && document.activeElement === button('Begin vigil'));
  const second = UI.confirm('Again?');
  T.check('the labels are Yes and No unless given', !!button('Yes') && !!button('No'));
  button('No').click();
  T.check('the "no" button resolves false', (await settle(second)) === false);
  const third = UI.confirm('Again?');
  key('Escape');
  T.check('Escape resolves false', (await settle(third)) === false && UI.top() === 'title');
  const fourth = UI.confirm('Again?');
  UI.back();
  T.check('so does UI.back', (await settle(fourth)) === false && UI.top() === 'title');
  const lower = UI.confirm('One?'), upper = UI.confirm('Two?', { yes: 'Second' });
  button('Second').click();
  const upperAnswer = await settle(upper);
  button('No').click();
  T.check('two dialogs at once each get their own answer', upperAnswer === true && (await settle(lower)) === false && UI.top() === 'title');

  // ---- toasts ----
  const note = UI.toast('The third toll.', 300);
  T.check('UI.toast shows a message in the toast layer', !!note && note.parentNode.id === 'toast' && note.textContent === 'The third toll.');
  for (let i = 0; i < 6; i++) UI.toast('Toll ' + i, 400);
  T.check('at most four toasts show at once', document.querySelectorAll('#toast .ui-toast').length === 4, document.querySelectorAll('#toast .ui-toast').length);
  await T.until(() => document.querySelectorAll('#toast .ui-toast').length === 0);
  T.check('a toast leaves when its time is up', document.querySelectorAll('#toast .ui-toast').length === 0);

  // ---- the platform helpers ----
  T.check('Plat.query reads the page address', Plat.query('view') === '2d' && Plat.query('nothing') === null);
  T.check('Plat.isTouch matches the device', Plat.isTouch === phone, Plat.isTouch);
  T.check('Plat.dpr stays inside 1..3', Plat.dpr() >= 1 && Plat.dpr() <= 3, Plat.dpr());
  const sizes = [], offResize = Plat.onResize((w, h) => sizes.push(w + 'x' + h));
  for (let i = 0; i < 5; i++) window.dispatchEvent(new Event('resize'));
  const atOnce = sizes.length;
  await T.until(() => sizes.length > 0);
  await T.sleep(250);
  T.check('Plat.onResize waits for the window to settle, then tells once', atOnce === 0 && sizes.join() === innerWidth + 'x' + innerHeight, sizes);
  window.dispatchEvent(new Event('orientationchange'));
  await T.until(() => sizes.length > 2);
  await T.sleep(250);
  T.check('a turn of the device tells too, and once more a little later', sizes.length === 3, sizes);
  offResize();
  window.dispatchEvent(new Event('resize'));
  await T.sleep(300);
  T.check('the function Plat.onResize gave back takes the listener off', sizes.length === 3, sizes);
  const shown = [], offShown = Plat.onVisibility((v) => shown.push(v));
  const pretend = (state) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
    document.dispatchEvent(new Event('visibilitychange'));
  };
  pretend('hidden');
  pretend('hidden');
  pretend('visible');
  delete document.visibilityState;
  offShown();
  T.check('Plat.onVisibility tells hidden and shown, each once', shown.join() === 'false,true' && document.visibilityState === 'visible', shown);
  const heard = [];
  const off = Plat.on('test.notice', (x, y, z) => heard.push('first ' + x + y + z));
  Plat.on('test.notice', () => { throw new Error('a listener that fails'); });
  Plat.on('test.notice', (x) => heard.push('third ' + x));
  const reports = quietly(() => {
    Plat.emit('test.notice', 1, 2, 3);
    off();
    Plat.emit('test.notice', 4, 5, 6);
  });
  T.check('Plat.on hears Plat.emit until it is taken off', heard.join() === 'first 123,third 1,third 4', heard);
  T.check('a listener that throws is reported once and stops nobody', reports === 1, reports);
  T.check('Plat.now is the steady clock of the page, in ms', Math.abs(Plat.now() - performance.now()) < 50, Plat.now());
  await T.until(() => Game.debug.fps > 0);
  T.check('the frame loop runs and measures itself', Game.debug.fps > 0 && ['fps', 'steps', 'stepMs', 'drawMs', 'worstMs'].every((k) => typeof Game.debug[k] === 'number'), Game.debug);
  const readout = await T.until(() => document.querySelector('#hud .game-fps') || !Plat.query('fps'));
  if (Plat.query('fps') === '1') T.check('?fps=1 shows the numbers on the screen', readout !== true && /^fps \d+ {2}steps \d+ {2}step /.test(readout.textContent), readout.textContent);
  else T.check('without ?fps=1 there is no readout', !document.querySelector('.game-fps'));

  // ---- storage, in short (the storage scenario goes further) ----
  const save = { v: 1, list: [1, 2, { deep: true }], text: 'a "quoted" bell' };
  const wrote = await Store.write('test.menus', save), back = await Store.read('test.menus');
  T.check('Store.write, then Store.read, returns the object', wrote === true && JSON.stringify(back) === JSON.stringify(save) && back !== save, back);
  T.check('Store.status says where it is held', Store.status === (T.target === 'artifact' ? 'memory' : 'saved'), Store.status);
  await Store.remove('test.menus');
  T.check('Store.remove forgets it', (await Store.read('test.menus')) === null);

  // ---- a view that does not start (last, because it leaves a view of the test's own as the active one) ----
  Gfx.register('test.broken', (c) => {
    c.getContext('webgl2');
    throw new Error('a view that is made to fail');
  });
  const spare = document.createElement('canvas');
  spare.id = 'spare';
  document.body.appendChild(spare);
  const fallback = Gfx.create(spare, 'test.broken');
  T.check('Gfx.create falls back to the plain view, on a fresh canvas in place of the spoiled one',
    fallback.name === '2d' && fallback.canvas !== spare && fallback.canvas.id === 'spare' && fallback.canvas.isConnected && !spare.isConnected && Gfx.active === fallback, fallback.name);
  const other = Gfx.create(fallback.canvas, 'constructor');
  T.check('a view nobody registered is passed over, whatever its name', other.name === '2d' && other.canvas.isConnected);
  Gfx.register('test.fine', (c) => ({ name: 'test.fine', canvas: c }));
  const better = Gfx.create(other.canvas, 'test.nobody');
  T.check('the plain view is the last resort: another view that starts is taken before it', better.name === 'test.fine' && Gfx.active === better, better.name);
  better.canvas.remove();
  return T.done();
};

const storageBefore = async function () {
  const { Store, Gfx } = TB;
  const lasting = T.target === 'standalone', calm = lasting ? 'saved' : 'memory';
  const seen = [], save = { v: 1, keeper: 'a test', list: [1, 2, { deep: true }], text: 'a "quoted" bell' };
  Store.onStatus((s) => seen.push(s));
  T.check('without ?view= the game still has a view', !!Gfx.active && typeof Gfx.active.name === 'string', Gfx.active && Gfx.active.name);
  T.check('Store.status says whether the page can keep anything', Store.status === calm, Store.status);
  T.check('nothing is stored at first', (await Store.read('test.save')) === null);
  T.check('Store.write resolves true', (await Store.write('test.save', save)) === true);
  const back = await Store.read('test.save');
  T.check('Store.read returns what was written, as a copy of its own', JSON.stringify(back) === JSON.stringify(save) && back !== save && back !== (await Store.read('test.save')), back);
  if (lasting) T.check('it is in the browser storage, under the prefix of the game', localStorage.getItem('tollbound.test.save') === JSON.stringify(save));
  await Store.write('test.other', { n: 2 });
  T.check('keys are kept apart', (await Store.read('test.other')).n === 2 && (await Store.read('test.save')).v === 1);

  // what is not JSON data
  const knot = {};
  knot.self = knot;
  T.check('an object that holds itself is refused: false, and the status is error', (await Store.write('test.save', knot)) === false && Store.status === 'error', Store.status);
  T.check('the save before it is still there', (await Store.read('test.save')).keeper === 'a test');
  T.check('a number is refused too', (await Store.write('test.number', 5)) === false && (await Store.read('test.number')) === null);
  T.check('the next good write clears the error', (await Store.write('test.other', { n: 3 })) === true && Store.status === calm, Store.status);
  T.check('Store.onStatus told each change', seen.join() === 'error,' + calm, seen);
  T.check('Store.remove forgets a key', (await Store.remove('test.other')) === true && (await Store.read('test.other')) === null);
  if (lasting) {
    localStorage.setItem('tollbound.test.torn', '{"v": 1, "lis');
    localStorage.setItem('tollbound.test.word', '"just text"');
    T.check('stored text that is torn, or is not an object, reads as null', (await Store.read('test.torn')) === null && (await Store.read('test.word')) === null);
    localStorage.removeItem('tollbound.test.torn');
    localStorage.removeItem('tollbound.test.word');
  }

  // storage that fills up: small writes pass, a large one is refused. A shelf of the test's own stands in for
  // the browser's storage, on a page that has storage and on one that has none.
  await Store.remove('test.save');
  const real = Object.getOwnPropertyDescriptor(window, 'localStorage'), shelf = new Map();
  let room = 40;
  const cramped = {
    getItem: (k) => (shelf.has(k) ? shelf.get(k) : null),
    setItem: (k, v) => {
      if (v.length > room) throw new DOMException('the shelf is full', 'QuotaExceededError');
      shelf.set(k, v);
    },
    removeItem: (k) => { shelf.delete(k); },
  };
  Object.defineProperty(window, 'localStorage', { configurable: true, get: () => cramped });
  T.check('a small write goes into storage', (await Store.write('test.small', { a: 1 })) === true && Store.status === 'saved' && shelf.get('tollbound.test.small') === '{"a":1}', Store.status);
  T.check('a write that storage refuses resolves false, and the status is error', (await Store.write('test.big', { text: 'x'.repeat(100) })) === false && Store.status === 'error', Store.status);
  T.check('the page still holds the newest copy', (await Store.read('test.big')).text.length === 100 && !shelf.has('tollbound.test.big'));
  T.check('the error stays while that copy waits, whatever else is saved', (await Store.write('test.small', { a: 2 })) === true && Store.status === 'error' && shelf.get('tollbound.test.small') === '{"a":2}', Store.status);
  room = 1000;
  T.check('once storage has room, the next write takes the waiting copy along and the error clears', (await Store.write('test.small', { a: 3 })) === true && Store.status === 'saved' &&
    shelf.has('tollbound.test.big') && JSON.parse(shelf.get('tollbound.test.big')).text.length === 100, Store.status);

  // storage that is gone: reading window.localStorage itself throws
  Object.defineProperty(window, 'localStorage', { configurable: true, get: () => { throw new DOMException('this page has no storage', 'SecurityError'); } });
  T.check('without storage a write is held in memory: true, and the status is memory', (await Store.write('test.held', { m: 1 })) === true && Store.status === 'memory', Store.status);
  T.check('and it reads back', (await Store.read('test.held')).m === 1 && (await Store.read('test.never')) === null);
  T.check('what storage held before it went is still known to the page', (await Store.read('test.big')).text.length === 100);
  T.check('Store.remove works without storage', (await Store.remove('test.held')) === true && (await Store.read('test.held')) === null && Store.status === 'memory');

  // back to the browser's own storage
  if (real) Object.defineProperty(window, 'localStorage', real); else delete window.localStorage;
  T.check('with its storage back the page saves as before', (await Store.write('test.save', save)) === true && Store.status === calm, Store.status);
  T.check('Store.onStatus told every change, and only changes', seen.join() === (lasting ? 'error,saved,error,saved,memory,saved' : 'error,memory,saved,error,saved,memory'), seen);
  return T.done();
};

const storageAfter = async function () {
  const { Store } = TB;
  const back = await Store.read('test.save');
  if (T.target === 'standalone') {
    T.check('what was written survives a reload', !!back && back.keeper === 'a test' && back.list[2].deep === true, back);
    T.check('what never reached the browser storage does not', (await Store.read('test.big')) === null && (await Store.read('test.held')) === null);
    await Store.remove('test.save');
    T.check('Store.remove takes it out of the browser storage', localStorage.getItem('tollbound.test.save') === null && (await Store.read('test.save')) === null);
  } else {
    T.check('a page without storage starts empty after a reload', back === null && Store.status === 'memory', back);
  }
  return T.done();
};

const vigil = async function () {
  const { UI, Game, Sim, Plat, Gfx, Input } = TB;
  const ui = document.getElementById('ui'), has = (name) => typeof Sim[name] === 'function';
  if (!T.check('the simulation is in this build (Sim.debugScene, Sim.step, Sim.command, Sim.hash)', has('debugScene') && has('step') && has('command') && has('hash'),
    'this scenario waits for the simulation kernel')) return T.done();
  const press = (type, code, name) => window.dispatchEvent(new KeyboardEvent(type, { code: code, key: name || code, bubbles: true, cancelable: true }));
  const button = (text) => Array.from(ui.querySelectorAll('.ui-screen:not([inert]) button')).find((b) => b.textContent.trim() === text);
  const picture = () => new Promise((resolve) => requestAnimationFrame(() => {
    const view = document.getElementById('view'), copy = document.createElement('canvas');
    copy.width = view.width;
    copy.height = view.height;
    const ctx = copy.getContext('2d'), colours = new Set();
    ctx.drawImage(view, 0, 0);
    for (const at of [0.31, 0.5, 0.73]) {   // three rows of pixels, right across
      const row = ctx.getImageData(0, Math.floor(view.height * at), view.width, 1).data;
      for (let i = 0; i < row.length; i += 4) colours.add((row[i] << 16) | (row[i + 1] << 8) | row[i + 2]);
    }
    const middle = ctx.getImageData(Math.floor(view.width / 2), Math.floor(view.height / 2), 1, 1).data;
    resolve({ colours: colours.size, middle: Array.from(middle.slice(0, 3)) });
  }));
  const states = [], count = { steps: 0, live: 0, frames: 0, seconds: 0 };
  Plat.on('state', (now, before) => states.push(before + ' > ' + now));
  Plat.on('step', (S, live) => {
    count.steps++;
    if (live) count.live++;
  });
  Plat.on('frame', (S, alpha, dt) => {
    count.frames++;
    count.seconds += dt;
  });

  // ---- a run starts ----
  button('Begin vigil').click();
  const S = Game.S;
  T.check('"Begin vigil" starts a run', Game.state === 'run' && !!S && S.phase === 'play' && states.join() === 'title > run', [Game.state, S && S.phase, states]);
  if (!S) return T.done();
  T.check('the title is closed and nothing pauses', UI.top() === null && !UI.pausing() && ui.children.length === 0);
  const pools = [S.enemies, S.shots, S.pickups];
  T.check('the run has a player, and pools of enemies, shots and pickups', !!S.player && typeof S.player.x === 'number' && typeof S.player.y === 'number' &&
    pools.every((p) => !!p && !!p.items && typeof p.n === 'number' && p.items.length >= p.n) && S.enemies.n > 0, pools.map((p) => p && p.n));

  // ---- the frame loop steps it ----
  // Time is what the frames say has passed: under load the browser hands frames out late and then in a hurry,
  // and the loop is right to follow them, not the wall clock.
  const s0 = S.step, f0 = count.seconds;
  await T.until(() => S.step >= s0 + 45);
  const ran = S.step - s0, seconds = count.seconds - f0;
  T.check('the frame loop steps the run, and never faster than 60 steps a second', ran >= 45 && ran <= seconds * 60 + 5, { steps: ran, seconds: seconds });
  T.check('each step and each frame is posted on the notice board', count.live === count.steps && count.steps >= ran && count.frames > 0, count);

  // ---- Game.sim ----
  const before = S.step, posted = count.steps, live = count.live;
  const simmed = Game.sim(5);
  T.check('Game.sim(5) advances the run by 300 steps', S.step - before === 300 && simmed === 300, { before: before, after: S.step, returned: simmed, phase: S.phase });
  T.check('the time of the run follows its steps', Math.abs(S.t - S.step / 60) < 1e-6, [S.t, S.step]);
  T.check('Game.sim posts its steps as not live', count.steps - posted === 300 && count.live === live, count);

  // ---- the picture ----
  const seen = await picture(), spot = Object.assign({}, Gfx.worldToScreen(S.player.x, S.player.y, 0));
  T.check('the canvas is not blank: ground, lines and discs', seen.colours >= 3, seen);
  T.check('the camera follows the player', Math.abs(spot.x - innerWidth / 2) < 1.5 && Math.abs(spot.y - innerHeight / 2) < 1.5, spot);

  // ---- pausing ----
  UI.screen('test.pause', { open: () => UI.h('div', { class: 'ui-panel' }, UI.button('Resume', () => UI.close())) });
  UI.screen('test.aside', { pause: false, open: () => UI.h('div', { class: 'ui-panel' }, UI.button('Close', () => UI.close())) });
  UI.open('test.pause');
  let held = S.step;
  await T.sleep(250);
  T.check('no step runs while a screen that pauses is open', UI.pausing() && S.step === held, [held, S.step]);
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  T.check('Escape closes the screen', UI.top() === null && !UI.pausing());
  await T.until(() => S.step > held);
  T.check('and the run goes on', S.step > held, [held, S.step]);
  UI.open('test.pause');
  held = S.step;
  await T.sleep(150);
  const stood = S.step === held, closed = UI.back();
  await T.until(() => S.step > held);
  T.check('UI.back returns to play as well', stood && closed === true && S.step > held, [held, S.step]);
  UI.open('test.aside');
  held = S.step;
  await T.until(() => S.step > held + 5);
  T.check('a screen that does not pause lets the run go on', !UI.pausing() && S.step > held + 5, [held, S.step]);
  UI.close();

  // ---- the hidden page ----
  const pretend = (state) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
    document.dispatchEvent(new Event('visibilitychange'));
  };
  pretend('hidden');
  held = S.step;
  await T.sleep(250);
  const asleep = S.step === held;
  pretend('visible');
  delete document.visibilityState;
  await T.until(() => S.step > held);
  T.check('no step runs while the page is hidden; the run goes on when it is shown again', asleep && S.step > held, [held, S.step]);

  // ---- walking, with the keys that stand in until the input module exists ----
  if (typeof Input.sample !== 'function') {
    const x0 = S.player.x;
    press('keydown', 'KeyD', 'd');
    await T.until(() => S.player.x > x0 + 0.5);
    press('keyup', 'KeyD', 'd');
    T.check('holding D walks the player to the right (the simulation moves the player by the input)', S.player.x > x0 + 0.5, [x0, S.player.x]);
    const y0 = S.player.y;
    press('keydown', 'ArrowUp');
    await T.until(() => S.player.y < y0 - 0.5);
    press('keyup', 'ArrowUp');
    T.check('holding the up arrow walks up the screen, towards smaller y', S.player.y < y0 - 0.5, [y0, S.player.y]);
    const rest = S.player.x;
    await T.sleep(200);
    T.check('letting go stops the walk', Math.abs(S.player.x - rest) < 0.3, [rest, S.player.x]);
    const moved = await picture(), now = Object.assign({}, Gfx.worldToScreen(S.player.x, S.player.y, 0));
    T.check('the camera went along', moved.colours >= 3 && Math.abs(now.x - innerWidth / 2) < 12 && Math.abs(now.y - innerHeight / 2) < 12, now);
  }

  // ---- the same seed, the same run ----
  const hashes = [11, 11, 12].map((seed) => {
    const run = Game.start({ seed: seed });
    Game.sim(2);
    return run === Game.S && run.step === 120 ? Sim.hash(run) : 'no run';
  });
  T.check('Game.start hands the seed on: the same seed gives the same run, another seed another', hashes[0] === hashes[1] && hashes[0] !== hashes[2] && hashes[0] !== 'no run', hashes);
  T.check('starting again replaces the run', Game.S !== S && Game.state === 'run');

  // ---- commands, and the end of a run ----
  const last = Game.S, told = [];
  Plat.on('command', (run, live, cmd) => told.push((run === Game.S) + ' ' + live + ' ' + cmd.type));
  T.check('Game.command hands a command to the simulation and posts it', Game.command({ type: 'skip' }) === false && told.join() === 'true true skip' && last.phase === 'play', told);
  Game.command({ type: 'leave' });
  if (last.phase !== 'ended') last.phase = 'ended';   // a simulation that does not know the command: the test ends the run by hand
  await T.until(() => Game.state === 'results');
  T.check('when the run has ended the results show', Game.state === 'results' && UI.top() === 'results' && Game.S === last && states[states.length - 1] === 'run > results', [Game.state, UI.top()]);
  const words = ui.textContent, back = button('Back to the title');
  T.check('the results say that the vigil is over, and offer the way back', /vigil/i.test(words) && /Time \d+:\d\d/.test(words) && !!back && document.activeElement === back, words);
  if (last.result && last.result.outcome === 'left') T.check('the results name the outcome', words.includes('You left through the gate.'), words);
  held = last.step;
  await T.sleep(150);
  T.check('an ended run is not stepped, by the frame loop or by Game.sim', last.step === held && Game.sim(1) === 0 && last.step === held);
  back.click();
  T.check('the button leads back to the title, and the run is dropped', Game.state === 'title' && UI.top() === 'title' && Game.S === null && !!button('Begin vigil'), [Game.state, UI.top()]);
  button('Begin vigil').click();
  const again = Game.S;
  T.check('a new vigil begins from there', Game.state === 'run' && !!again && again !== last && again.phase === 'play');
  again.phase = 'ended';
  T.check('Game.sim notices the end as well', Game.sim(1) === 0 && Game.state === 'results' && UI.top() === 'results');
  Game.title();
  T.check('without a run Game.command and Game.sim do nothing', Game.command({ type: 'skip' }) === false && Game.sim(1) === 0 && told.length === 2, told);
  return T.done();
};

module.exports = [
  { name: 'shell: menus, desktop 1280x720', viewport: { width: 1280, height: 720 }, mobile: false, query: 'view=2d&fps=1', run: menus },
  { name: 'shell: menus, phone 390x844', viewport: { width: 390, height: 844 }, mobile: true, query: 'view=2d', run: menus },
  { name: 'shell: storage, with a reload', viewport: { width: 1280, height: 720 }, mobile: false, query: '', run: [storageBefore, storageAfter] },
  { name: 'shell: vigil, desktop 1280x720', viewport: { width: 1280, height: 720 }, mobile: false, query: 'view=2d&seed=5', run: vigil },
  { name: 'shell: vigil, phone 390x844', viewport: { width: 390, height: 844 }, mobile: true, query: 'view=2d', run: vigil },
];
