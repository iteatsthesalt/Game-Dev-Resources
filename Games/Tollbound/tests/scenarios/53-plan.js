// tests/scenarios/53-plan.js: the Plan's screen (src/js/74-plan.js), the Lantern's room 'plan'.
//   touch     on a phone: the Lantern opens the Plan; a node is chosen by a tap on the map and walked to with the
//             panel's control, a lane by the attribute chosen; the head is taken back for its coin; the save is written
//             after each; one finger pans and two zoom; back returns to the Lantern. After a reload the route is the
//             one walked (a character's level and Plan survive a reload), and the Plan shows it again. A page without
//             storage (the artifact) starts each reload with a blank Household, and the checks after it say only that.
//   keys      on a desktop: focus starts on the map, the arrow keys choose along the plan, Enter steps, + zooms,
//             Escape closes; a pad's moves (UI.nav, UI.activate) do the same.
//   screens   on a phone upright, on its side with a notch, and on a desktop: every control 44 px or more, nothing wider
//             than the window, the map and the panel both on screen, the map over the panel upright and beside it
//             otherwise.
// The functions below run inside the page (see tests/run.js), so they use only T, TB and the page itself.

const touch = async function () {
  const NOTE = 'test.plan';
  const { Game, UI, Char, Defs, Store, SaveData, Tree } = TB;
  const ui = document.getElementById('ui');
  const top = () => ui.querySelector('.ui-screen:not([inert])');
  const canvas = () => top().querySelector('.pl-canvas');
  const panel = () => top().querySelector('.pl-panel');
  const action = (name, attr) => top().querySelector('[data-action="' + name + '"]' + (attr ? '[data-attr="' + attr + '"]' : ''));
  const stored = async () => (await Store.read(SaveData.KEY)) || { chars: [] };
  // where the map draws a node, in CSS pixels of the window
  const at = (id) => {
    const c = canvas(), b = c.getBoundingClientRect(), n = Defs.get('node', id), k = Number(c.dataset.scale);
    return { x: b.left + (n.x - Number(c.dataset.cx)) * k + b.width / 2, y: b.top + (n.y - Number(c.dataset.cy)) * k + b.height / 2 };
  };
  // a tap on an element's middle or on a point; false (and a failed check) when there is nothing to tap
  const tap = async (what, label, y) => {
    const p = what && what.nodeType ? T.middle(what) : typeof what === 'number' ? { x: what, y } : what;
    if (!T.check('there is something to tap: ' + label, !!p && Number.isFinite(p.x) && Number.isFinite(p.y), p)) return false;
    await T.tap(p.x, p.y);
    return true;
  };
  const inside = (p) => { const b = canvas().getBoundingClientRect(); return p.x > b.left + 8 && p.x < b.right - 64 && p.y > b.top + 8 && p.y < b.bottom - 8; };

  const c = Game.make('change-ringer', 'Hester Pell');
  T.check('a Change-ringer is made, its route at its door', !!c && c.plan.walk.length === 1 && c.plan.walk[0] === Tree.door('change-ringer'), c && c.plan.walk);
  if (!c) return T.done();
  c.level = 6;                       // five points to walk
  Game.save.account.coin = 60;
  await Game.write();
  Game.lantern(c.uid);
  const room = top().querySelector('[data-room="plan"]');
  T.check('the Lantern offers the Plan', UI.top() === 'lantern' && !!room, UI.top());
  if (!room) return T.done();
  if (!(await tap(room, 'the Plan room'))) return T.done();
  await T.until(() => UI.top() === 'plan' && canvas() && canvas().dataset.scale);
  T.check('a tap opens the Plan over the Lantern', UI.top() === 'plan' && UI.isOpen('lantern'), UI.top());
  T.check('the map is drawn, centred on the door, which the panel tells', !!canvas() && Number(canvas().dataset.scale) > 0 &&
    panel().dataset.node === c.plan.walk[0] && /Your door/.test(panel().textContent), [panel().dataset.node, canvas().dataset.scale]);
  T.check('the header counts the points', /0 of 5 points walked · 5 free · 60 coin/.test(top().querySelector('.pl-points').textContent),
    top().querySelector('.pl-points').textContent);

  // ---- a step by touch: a tap on the map chooses, the panel's control walks ----
  const steps = Tree.steps(c.plan.walk), first = steps.find((id) => Defs.get('node', id).choice === null && inside(at(id)));
  T.check('the door has a step that needs no choice, on screen', !!first, steps);
  if (!first) return T.done();
  let p = at(first);
  if (!(await tap(p, 'the first step'))) return T.done();
  await T.until(() => panel().dataset.node === first);
  T.check('a tap on a node chooses it', panel().dataset.node === first && /Next to the head of your route/.test(panel().textContent),
    [panel().dataset.node, first, panel().textContent.slice(0, 160)]);
  if (!T.check('the panel offers to walk there', !!action('step'), panel().textContent.slice(0, 300))) return T.done();
  if (!(await tap(action('step'), 'walk here'))) return T.done();
  await T.until(() => c.plan.walk.length === 2);
  T.check('its control walks the route onto it (Char.allocate)', c.plan.walk.length === 2 && c.plan.walk[1] === first, c.plan.walk);
  T.check('the save is written', !!(await T.until(async () => (await stored()).chars.some((x) => x.uid === c.uid && x.plan.walk[1] === first), 3000)));
  T.check('the new head is chosen and the header counts the point', panel().dataset.node === first && /1 of 5 points walked · 4 free/.test(top().textContent),
    top().querySelector('.pl-points').textContent);

  // ---- a lane: one control for each attribute it offers ----
  let lane = Tree.steps(c.plan.walk).find((id) => Defs.get('node', id).choice !== null && inside(at(id)));
  if (!lane) {                       // one more step out first, to reach one: by touch, as the first
    const on = Tree.steps(c.plan.walk).find((id) => c.plan.walk.indexOf(id) < 0 && Defs.get('node', id).choice === null && inside(at(id)));
    if (!(await tap(at(on), 'a second step'))) return T.done();
    await T.until(() => panel().dataset.node === on);
    if (!(await tap(action('step'), 'walk there'))) return T.done();
    await T.until(() => c.plan.walk.length === 3);
    T.check('a second step by touch', c.plan.walk[2] === on, c.plan.walk);
    lane = Tree.steps(c.plan.walk).find((id) => Defs.get('node', id).choice !== null && inside(at(id)));
  }
  T.check('a lane is a step away', !!lane, Tree.steps(c.plan.walk));
  if (!lane) return T.done();
  const offers = Defs.get('node', lane).choice, want = offers[offers.length - 1];
  p = at(lane);
  if (!(await tap(p, 'the lane'))) return T.done();
  await T.until(() => panel().dataset.node === lane);
  T.check('a lane offers a control for each attribute', offers.every((a) => !!action('step', a)), offers);
  const walked = c.plan.walk.length;
  if (!(await tap(action('step', want), 'an attribute'))) return T.done();
  await T.until(() => c.plan.walk.length === walked + 1);
  T.check('the attribute tapped is the one chosen', c.plan.walk[walked] === lane && c.plan.choice[lane] === want, [c.plan.walk, c.plan.choice]);
  T.check('and the save keeps it', !!(await T.until(async () => ((await stored()).chars.find((x) => x.uid === c.uid) || { plan: { choice: {} } }).plan.choice[lane] === want, 3000)));

  // ---- taking back the head, for its coin ----
  const price = Char.refundPrice(c), coin = Game.save.account.coin, back = action('refund');
  T.check('the head offers to be taken back, for its price', !!back && back.textContent.includes(price + ' coin') && price === Defs.get('plan', 'main').refund * Defs.get('node', lane).ring,
    back && back.textContent);
  if (!back) return T.done();
  if (!(await tap(back, 'take back'))) return T.done();
  await T.until(() => c.plan.walk.length === walked);
  T.check('a tap takes it back (Char.refund) and pays from the Household\'s coin', c.plan.walk.length === walked && Game.save.account.coin === coin - price &&
    c.plan.choice[lane] === undefined, [c.plan.walk.length, Game.save.account.coin]);
  T.check('the save is written again', !!(await T.until(async () => (await stored()).account.coin === coin - price, 3000)));

  // ---- one finger pans, two zoom, and the controls zoom ----
  const box = canvas().getBoundingClientRect(), mx = box.left + box.width / 2, my = box.top + box.height / 2;
  const cx = Number(canvas().dataset.cx), scale = Number(canvas().dataset.scale);
  await T.touch('start', [{ id: 1, x: mx, y: my }]);
  for (let i = 1; i <= 4; i++) await T.touch('move', [{ id: 1, x: mx - 20 * i, y: my }]);
  await T.touch('end', []);
  await T.until(() => Number(canvas().dataset.cx) > cx + 1);
  T.check('one finger drags the plan along', Number(canvas().dataset.cx) > cx + 1, [cx, canvas().dataset.cx]);
  await T.touch('start', [{ id: 1, x: mx - 30, y: my }, { id: 2, x: mx + 30, y: my }]);
  for (let i = 1; i <= 4; i++) await T.touch('move', [{ id: 1, x: mx - 30 - 15 * i, y: my }, { id: 2, x: mx + 30 + 15 * i, y: my }]);
  await T.touch('end', []);
  await T.until(() => Number(canvas().dataset.scale) > scale * 1.5);
  T.check('two fingers spread zoom in', Number(canvas().dataset.scale) > scale * 1.5, [scale, canvas().dataset.scale]);
  const zoomed = Number(canvas().dataset.scale);
  if (!(await tap(top().querySelector('[data-tool="out"]'), 'zoom out'))) return T.done();
  await T.until(() => Number(canvas().dataset.scale) < zoomed);
  T.check('the zoom control zooms out', Number(canvas().dataset.scale) < zoomed);
  T.check('nothing is walked by dragging', c.plan.walk.length === walked, c.plan.walk);

  // ---- back to the Lantern ----
  if (!(await tap(top().querySelector('[data-action="back"]'), 'back'))) return T.done();
  T.check('back closes the Plan over the Lantern', UI.top() === 'lantern', UI.top());
  if (T.target === 'standalone') localStorage.setItem(NOTE, JSON.stringify({ uid: c.uid, walk: c.plan.walk, choice: c.plan.choice, level: c.level }));
  return T.done();
};

const reloaded = async function () {
  const NOTE = 'test.plan';
  const { Game, UI } = TB;
  if (T.target !== 'standalone') {
    T.check('a page without storage starts with a blank Household after a reload', !!Game.save && Game.save.chars.length === 0);
    return T.done();
  }
  const was = JSON.parse(localStorage.getItem(NOTE));
  if (!T.check('the first part left its note', !!was)) return T.done();
  const c = Game.save.chars.find((x) => x.uid === was.uid);
  T.check('after a reload the character stands with its level and its route on the Plan', !!c && c.level === was.level &&
    JSON.stringify(c.plan.walk) === JSON.stringify(was.walk) && JSON.stringify(c.plan.choice) === JSON.stringify(was.choice), c && c.plan);
  if (!c) return T.done();
  Game.lantern(c.uid);
  UI.open('plan', { char: Game.char });
  const top = () => document.querySelector('#ui .ui-screen:not([inert])');
  await T.until(() => top().querySelector('.pl-canvas').dataset.scale);
  T.check('the Plan shows it again: the head chosen, the points counted', top().querySelector('.pl-panel').dataset.node === was.walk[was.walk.length - 1] &&
    top().querySelector('.pl-points').textContent.includes((was.walk.length - 1) + ' of ' + (was.level - 1) + ' points walked'), top().querySelector('.pl-points').textContent);
  localStorage.removeItem(NOTE);
  return T.done();
};

const keys = async function () {
  const { Game, UI, Char, Defs, Tree } = TB;
  const ui = document.getElementById('ui');
  const top = () => ui.querySelector('.ui-screen:not([inert])');
  const canvas = () => top().querySelector('.pl-canvas');
  const chosen = () => top().querySelector('.pl-panel').dataset.node;
  const c = Game.make('change-ringer', 'Jory Cleave');
  c.level = 10;
  Game.lantern(c.uid);
  top().querySelector('[data-room="plan"]').click();
  await T.until(() => UI.top() === 'plan' && canvas().dataset.scale);
  T.check('focus starts on the map', document.activeElement === canvas(), document.activeElement && document.activeElement.className);
  const door = chosen(), moves = [];
  for (const key of ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft']) {
    await T.key(key);
    moves.push(chosen());
  }
  T.check('the arrow keys choose along the plan, and focus stays on the map', moves.some((id) => id !== door) && document.activeElement === canvas(), moves);
  // back to a step of the door, then Enter
  UI.close('plan');
  UI.open('plan', { char: c });
  await T.until(() => canvas().dataset.scale);
  const steps = Tree.steps(c.plan.walk);
  let tries = 0;
  while (steps.indexOf(chosen()) < 0 && tries++ < 6) await T.key(['ArrowUp', 'ArrowRight', 'ArrowLeft', 'ArrowDown'][tries % 4]);
  const target = chosen();
  T.check('the keys reach a step of the door', steps.indexOf(target) >= 0, [target, steps]);
  await T.key('Enter');
  if (c.plan.walk.length === 1 && Defs.get('node', target).choice !== null) {
    T.check('Enter on a lane moves focus to its attributes', document.activeElement && document.activeElement.dataset.attr !== undefined,
      document.activeElement && document.activeElement.textContent);
    await T.key('Enter');
  }
  T.check('Enter steps onto it', c.plan.walk.length === 2 && c.plan.walk[1] === target, c.plan.walk);
  const scale = Number(canvas().dataset.scale);
  canvas().focus();
  await T.key('Equal');
  await T.until(() => Number(canvas().dataset.scale) > scale);
  T.check('+ zooms in', Number(canvas().dataset.scale) > scale, [scale, canvas().dataset.scale]);
  // a pad: UI.nav and UI.activate, as 52-input.js calls them
  const before = chosen();
  let moved = false;
  for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) { UI.nav(dx, dy); if (chosen() !== before) { moved = true; break; } }
  T.check('a pad\'s d-pad chooses along the plan', moved, chosen());
  UI.close('plan');
  UI.open('plan', { char: c });
  await T.until(() => canvas().dataset.scale);
  const next = Tree.steps(c.plan.walk).find((id) => c.plan.walk.indexOf(id) < 0 && Defs.get('node', id).choice === null);
  for (let i = 0; i < 8 && chosen() !== next; i++) {
    const a = Defs.get('node', chosen()), b = Defs.get('node', next), dx = b.x - a.x, dy = b.y - a.y;
    if (Math.abs(dx) > Math.abs(dy)) UI.nav(Math.sign(dx), 0); else UI.nav(0, Math.sign(dy));
  }
  if (chosen() === next) {
    UI.activate();
    T.check('a pad\'s button steps onto a step it chose', c.plan.walk.length === 3 && c.plan.walk[2] === next, c.plan.walk);
  } else {
    T.check('a pad reaches a step of the head', false, [chosen(), next]);
  }
  await T.key('Escape');
  T.check('Escape closes the Plan over the Lantern', UI.top() === 'lantern', UI.top());
  T.check('nothing was spent that it did not have', Char.points(c).free >= 0 && Char.points(c).spent === c.plan.walk.length - 1, Char.points(c));
  return T.done();
};

const screens = async function () {
  const { Game, UI, Char, Defs, Tree } = TB;
  const ui = document.getElementById('ui');
  const top = () => ui.querySelector('.ui-screen:not([inert])');
  const controls = () => Array.from(top().querySelectorAll('button, input, textarea'));
  const small = () => controls().filter((x) => x.getBoundingClientRect().height < 44 || x.getBoundingClientRect().width < 44).map((x) => x.textContent || x.tagName);
  const wide = () => top().scrollWidth > innerWidth || controls().some((x) => x.getBoundingClientRect().left < -0.5 || x.getBoundingClientRect().right > innerWidth + 0.5);
  const c = Game.make('change-ringer', 'Wenna Holt');
  c.level = 30;
  Game.save.account.coin = 500;
  // a route that fences the court by the door, then runs out along the high street
  const route = ['plan.1.7.a1', 'plan.1.8', 'plan.1.8.s', 'plan.2.8', 'plan.2.7.a2', 'plan.2.7.a1', 'plan.2.7', 'plan.1.7.s', 'plan.door.change-ringer',
    'plan.1.7.s', 'plan.2.7', 'plan.2.7.s', 'plan.3.7', 'plan.3.7.s'];
  for (const id of route) Char.allocate(c, id, Defs.get('node', id).choice ? Defs.get('node', id).choice[0] : undefined);
  T.check('the route is walked, and a loop by the door grants the court inside it', c.plan.walk.length === route.length + 1 && Tree.granted(c.plan.walk).length === 1,
    Tree.granted(c.plan.walk));
  Game.lantern(c.uid);
  UI.open('plan', { char: c });
  await T.until(() => top().querySelector('.pl-canvas').dataset.scale);
  const map = top().querySelector('.pl-map').getBoundingClientRect(), panel = top().querySelector('.pl-panel').getBoundingClientRect();
  T.check('the map and the panel are both on screen', map.width > 150 && map.height > 150 && panel.width > 150 && panel.height > 80 &&
    map.bottom <= innerHeight + 0.5 && panel.bottom <= innerHeight + 0.5, [map.width, map.height, panel.width, panel.height]);
  T.check(innerHeight > innerWidth ? 'upright, the map stands over the panel' : 'on its side and on a desktop, the panel beside the map',
    innerHeight > innerWidth ? map.bottom <= panel.top + 0.5 : map.right <= panel.left + 0.5, [map.right, map.bottom, panel.left, panel.top]);
  T.check('the head is told, with its price to take back', /The head of your route/.test(top().textContent) && !!top().querySelector('[data-action="refund"]'));
  T.check('every control is 44 px or more, nothing wider than the window', small().length === 0 && !wide(), small());
  top().querySelector('[data-action="totals"]').click();
  T.check('what the route gives, summed', /What the route gives/.test(top().textContent) && top().querySelectorAll('.pl-gives li').length >= 5 && small().length === 0 && !wide(),
    top().querySelectorAll('.pl-gives li').length);
  top().querySelector('[data-action="plan"]').click();
  // the court the loop fences, chosen with a press on the map where it is drawn
  const granted = Tree.granted(c.plan.walk)[0], canvas = top().querySelector('.pl-canvas'), b = canvas.getBoundingClientRect(), n = Defs.get('node', granted);
  const k = Number(canvas.dataset.scale), x = b.left + (n.x - Number(canvas.dataset.cx)) * k + b.width / 2, y = b.top + (n.y - Number(canvas.dataset.cy)) * k + b.height / 2;
  for (const type of ['pointerdown', 'pointerup']) canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 3, clientX: x, clientY: y, isPrimary: true }));
  T.check('the court fenced by the loop is told as granted, and what it gives at half', top().querySelector('.pl-panel').dataset.node === granted &&
    /granted at 50%/.test(top().querySelector('.pl-panel').textContent) && top().querySelectorAll('.pl-gives li').length >= 1,
  [granted, top().querySelector('.pl-panel').dataset.node, top().querySelector('.pl-panel').textContent.slice(0, 200)]);
  UI.back();
  T.check('back returns to the Lantern', UI.top() === 'lantern', UI.top());
  return T.done();
};

module.exports = [
  { name: 'plan: walked and taken back by touch, and the route survives a reload, phone 390x844', viewport: { width: 390, height: 844 }, mobile: true,
    query: 'view=2d', run: [touch, reloaded] },
  { name: 'plan: keys and a pad, desktop 1280x720', viewport: { width: 1280, height: 720 }, mobile: false, query: 'view=2d', run: keys },
  { name: 'plan: the screen, phone 390x844', viewport: { width: 390, height: 844 }, mobile: true, query: 'view=2d', run: screens },
  { name: 'plan: the screen, phone on its side 844x390, with a notch', viewport: { width: 844, height: 390 }, mobile: true, query: 'view=2d',
    safeArea: { top: 0, right: 47, bottom: 21, left: 47 }, run: screens },
  { name: 'plan: the screen, desktop 1280x720', viewport: { width: 1280, height: 720 }, mobile: false, query: 'view=2d', run: screens },
];
