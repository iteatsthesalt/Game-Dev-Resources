// tests/scenarios/54-finds.js: written finds in the page (12-items.js, 27-notches.js, 75-finds.js): the acceptance's
// "finds survive a reload", and the Lantern's room of finds.
//   life      on a phone: a character goes down into the Dial carrying two finds that tolls wrote on, rings down at a
//             lychgate, and the finds are in the Household's chest with their lines; at the Lantern the room of finds
//             shows them, one is worn from it, a line of another is struck by the chisel and cut, each paid in coin and
//             refused, with the reason, when the coin is short or the change cannot be made; the save is written. After a
//             reload the worn find is worn still, with the same lines, and the room shows it. A page without storage (the
//             artifact) starts each reload with a blank Household, and the checks after the reload say only that.
//   screens   the room on a phone upright, on its side with a notch, and on a desktop: the list, a find and the recast,
//             every control at least 44 px high and wide and nothing wider than the window; moving through it by keys and
//             pad (UI.nav, UI.activate, UI.back); a recast poured in the order chosen, paid, the two finds poured gone.
// The functions below run inside the page (see tests/run.js), so they use only T, TB and the page itself.

const life = async function () {
  const NOTE = 'test.finds';
  const { Game, UI, Char, Items, Store, SaveData } = TB;
  const ui = document.getElementById('ui');
  const top = () => ui.querySelector('.ui-screen:not([inert])');
  const within = (sel) => top().querySelector(sel);
  const button = (text) => Array.from(top().querySelectorAll('button')).find((b) => b.textContent.trim() === text);
  const small = () => Array.from(top().querySelectorAll('button, input, textarea')).filter((c) => c.getBoundingClientRect().height < 44 ||
    c.getBoundingClientRect().width < 44).map((c) => c.textContent || c.tagName);
  const wide = () => top().scrollWidth > innerWidth;
  const said = () => (within('.fnd-said') || { textContent: '' }).textContent;
  const stored = () => Store.read(SaveData.KEY);

  // ---- a character goes down with two finds, and the tolls write on them ----
  const c = Game.make(Char.classes(Game.save)[0], 'Hester Pell');
  Game.lantern(c.uid);
  const down = Array.from(top().querySelectorAll('button')).find((b) => /^Go down to /.test(b.textContent.trim()));
  T.check('the Lantern sends the character down', !!down);
  down.click();
  const S = Game.S;
  T.check('a vigil of the Dial with a copy of the character', Game.state === 'run' && !!S && S.cfg.char.uid === c.uid);
  if (!S) return T.done();
  Game.sim(0.5);
  const coat = Items.make('base.oilskin', 1, -(++S.uid), 0.5), token = Items.make('base.sand-glass', 1, -(++S.uid), 0.5);
  S.haul.push(coat, token);
  S.dirty = true;
  // what the first tolls write: the posture of each period, from the run's own loot stream and sheet
  for (const [find, postures] of [[coat, ['stood', 'stood', 'timed']], [token, ['pressed', 'strode']]]) {
    postures.forEach(function (p, i) { T.check('a line is written on ' + find.base, Items.write({ rng: S.rng, toll: i + 1, sheet: S.sheet }, find, p) >= 0); });
  }
  const lines = JSON.stringify(S.haul.map((f) => f.lines));
  T.check('the haul shows button B, the heave', S.haul.length === 2);
  // a lychgate opens where the character stands: ringing down banks the haul, stroke by stroke
  S.gate = { x: S.player.x, y: S.player.y, until: S.t + 25, far: false, ring: 0, strokes: 0 };
  Game.sim(8);
  await T.until(() => Game.state === 'results');
  const rep = Game.report, chest = Game.save.chest.finds;
  T.check('rung down: the vigil ended at the lychgate with both finds banked', !!rep && rep.outcome === 'left' && rep.finds === 2 && rep.lost.finds === 0, rep);
  T.check('the finds are in the Household\'s chest, with the lines the tolls wrote and uids of the save',
    chest.length === 2 && JSON.stringify(chest.map((f) => f.lines)) === lines && chest.every((f) => f.uid > 0 && f.uid <= Game.save.uid), chest.map((f) => f.uid));
  T.check('and the save was written with them', ((await stored()) || { chest: { finds: [] } }).chest.finds.length === 2);
  button('Back to the Lantern').click();
  T.check('back at the Lantern', Game.state === 'lantern' && UI.top() === 'lantern');

  // ---- the room of finds ----
  const room = ui.querySelector('[data-room="finds"]');
  T.check('the Lantern offers the room of finds', !!room, room && room.textContent);
  if (!room) return T.done();
  room.click();
  T.check('it opens over the Lantern', UI.top() === 'finds' && UI.isOpen('lantern'));
  const worn = Game.char.worn;
  T.check('it lists the worn finds and those of the chest', !!within('[data-slot="tool"][data-uid="' + worn.tool.uid + '"]') &&
    !!within('[data-slot="coat"][data-uid="' + worn.coat.uid + '"]') && chest.every((f) => !!within('[data-uid="' + f.uid + '"]')));
  T.check('it names them and their notches', /Oilskin/.test(top().textContent) && /3 notches/.test(top().textContent) && /Sand-glass/.test(top().textContent));
  T.check('every control of the room is 44 px or more at phone size, and nothing is wider than the window', small().length === 0 && !wide(), small());

  // ---- a find, its lines, and wearing it ----
  const oil = chest.find((f) => f.base === 'base.oilskin'), was = worn.coat;
  within('[data-uid="' + oil.uid + '"]').click();
  const text = top().textContent;
  T.check('a find shows each line with the posture and the toll that wrote it', /Stood, at the 1st toll/.test(text) && /Stood, at the 2nd toll/.test(text) &&
    /Timed, at the 3rd toll/.test(text) && /while Braced|while not Braced/.test(text), text.slice(0, 300));
  T.check('and what it wants of its attribute', /it wants 12 Knee/.test(text), text.slice(0, 300));
  T.check('a find\'s view: controls of 44 px or more, nothing wider than the window', small().length === 0 && !wide(), small());
  within('[data-act="wear"]').click();
  T.check('worn from the room: the oilskin in the coat place, the jerkin back in the chest', Game.char.worn.coat === oil && Game.save.chest.finds.includes(was) &&
    /Worn as coat/.test(said()), said());
  const keep = await T.until(async () => { const s = await stored(); return s && s.chars[0].worn.coat && s.chars[0].worn.coat.uid === oil.uid ? s : null; }, 3000);
  T.check('and the save was written', !!keep);

  // ---- the changes: refused, then paid ----
  within('[data-act="cut"]').click();
  T.check('a change without a line chosen is refused, with the reason', /Choose a line first/.test(said()), said());
  within('[data-place="0"]').click();
  T.check('pressing a line chooses it', within('[data-place="0"]').getAttribute('aria-pressed') === 'true');
  Game.save.account.coin = 3;
  within('[data-act="cut"]').click();
  const price = Items.price(oil, 'cut');
  T.check('a change the coin cannot pay is refused, saying what it costs', new RegExp('has 3 coin; this costs ' + price).test(said()) && oil.lines[0] !== null, said());
  T.check('nothing was paid for what was refused, and no dialog asked', Game.save.account.coin === 3 && UI.top() === 'finds');
  Game.save.account.coin = 500;
  const rest = oil.lines[1].value;
  within('[data-act="cut"]').click();
  await T.until(() => UI.top() === 'confirm');
  T.check('a change is asked once more, with its price', UI.top() === 'confirm' && new RegExp(price + ' coin').test(top().textContent), top().textContent);
  top().querySelector('[data-answer="yes"]').click();
  await T.until(() => UI.top() === 'finds');
  T.check('cut: the line is gone for good, the others rose 10%, the price paid', oil.lines[0] === null && oil.gone.includes(0) &&
    Math.abs(oil.lines[1].value - rest * 1.1) < 1e-9 && Game.save.account.coin === 500 - price, [oil.gone, Game.save.account.coin]);
  T.check('the room shows the place gone', /gone for good/.test(top().textContent));
  within('[data-place="1"]').click();
  const chisel = Items.price(oil, 'chisel');
  within('[data-act="chisel-condition"]').click();
  await T.until(() => UI.top() === 'confirm');
  top().querySelector('[data-answer="yes"]').click();
  await T.until(() => UI.top() === 'finds');
  T.check('the chisel strikes the condition of the chosen line, and is paid', oil.lines[1].struck === 'condition' && !!within('[data-place="1"] .is-struck') &&
    Game.save.account.coin === 500 - price - chisel, Game.save.account.coin);
  within('[data-act="chisel-object"]').click();
  T.check('one word a line: a second is refused, with the reason', /one word a line/.test(said()) && oil.lines[1].struck === 'condition', said());
  const now = await T.until(async () => { const s = await stored(); return s && s.account.coin === Game.save.account.coin ? s : null; }, 3000);
  T.check('each change was written', !!now);
  T.check('the save is sound', SaveData.validate(Game.save).length === 0, SaveData.validate(Game.save));
  UI.back();
  T.check('back goes to the list', UI.top() === 'finds' && !!within('[data-slot="coat"][data-uid="' + oil.uid + '"]'));
  UI.back();
  T.check('and out of the room, to the Lantern', UI.top() === 'lantern');
  if (T.target === 'standalone') {
    localStorage.setItem(NOTE, JSON.stringify({ char: c.uid, uid: oil.uid, lines: oil.lines, gone: oil.gone, coin: Game.save.account.coin, chest: Game.save.chest.finds.map((f) => f.uid) }));
  }
  return T.done();
};

const afterReload = async function () {
  const NOTE = 'test.finds';
  const { Game, UI } = TB;
  const ui = document.getElementById('ui');
  const top = () => ui.querySelector('.ui-screen:not([inert])');
  if (T.target !== 'standalone') {
    T.check('a page without storage starts with a blank Household after a reload', !!Game.save && Game.save.chars.length === 0);
    return T.done();
  }
  const was = JSON.parse(localStorage.getItem(NOTE));
  const c = Game.save.chars.find((x) => x.uid === was.char);
  T.check('after a reload the character stands, wearing the find it put on', !!c && !!c.worn.coat && c.worn.coat.uid === was.uid, c && c.worn.coat);
  if (!c) return T.done();
  T.check('with the same lines, the place cut away still gone, the word struck still struck', JSON.stringify(c.worn.coat.lines) === JSON.stringify(was.lines) &&
    JSON.stringify(c.worn.coat.gone) === JSON.stringify(was.gone) && c.worn.coat.lines[1].struck === 'condition');
  T.check('the chest and the coin as they were', JSON.stringify(Game.save.chest.finds.map((f) => f.uid)) === JSON.stringify(was.chest) && Game.save.account.coin === was.coin);
  Game.lantern(c.uid);
  ui.querySelector('[data-room="finds"]').click();
  T.check('the room shows it worn', UI.top() === 'finds' && !!top().querySelector('[data-slot="coat"][data-uid="' + was.uid + '"]') && /Oilskin/.test(top().textContent));
  localStorage.removeItem(NOTE);
  return T.done();
};

const screens = async function () {
  const { Game, UI, Char, Items, Core, SaveData } = TB;
  const ui = document.getElementById('ui');
  const top = () => ui.querySelector('.ui-screen:not([inert])');
  const within = (sel) => top().querySelector(sel);
  const controls = () => Array.from(top().querySelectorAll('button, input, textarea'));
  const small = () => controls().filter((c) => c.getBoundingClientRect().height < 44 || c.getBoundingClientRect().width < 44).map((c) => c.textContent || c.tagName);
  const wide = () => top().scrollWidth > innerWidth || controls().some((c) => c.getBoundingClientRect().left < -0.5 || c.getBoundingClientRect().right > innerWidth + 0.5);
  const focused = () => (document.activeElement && ui.contains(document.activeElement) ? document.activeElement : null);
  const said = () => (within('.fnd-said') || { textContent: '' }).textContent;

  const c = Game.make(Char.classes(Game.save)[0], 'Wenna Holt'), rng = new Core.RNG(7);
  const writer = (toll) => ({ rng: { loot: rng }, toll, sheet: { stats: { 'notch-size': 100 } } });
  const add = (base, postures) => {
    const f = Items.make(base, 1, SaveData.uid(Game.save), rng.next());
    postures.forEach((p, i) => Items.write(writer(i + 1), f, p));
    Game.save.chest.finds.push(f);
    return f;
  };
  const first = add('base.bell-rope', ['stood', 'pressed', 'stood', 'timed', 'strode', 'stood']);
  const last = add('base.bell-rope', ['pressed', 'pressed', 'pressed', 'pressed', 'pressed', 'pressed', 'stood', 'timed']);
  add('base.mourning-ring', ['timed']);
  add('base.pattens', []);
  Game.save.account.coin = 200;
  Game.lantern(c.uid);
  ui.querySelector('[data-room="finds"]').click();
  T.check('the room of finds is open', UI.top() === 'finds');
  T.check('the list: controls of 44 px or more, nothing wider than the window', small().length === 0 && !wide(), small());
  // by keys and pad: focus starts on the first control, and moves down the list
  const start = focused();
  T.check('focus starts in the room', !!start && top().contains(start), start && start.textContent);
  UI.nav(0, 1);
  T.check('UI.nav moves it to the next control down', !!focused() && focused() !== start, focused() && focused().textContent);
  // a find, by activating it
  within('[data-uid="' + first.uid + '"]').focus();
  UI.activate();
  T.check('UI.activate opens a find', !!within('[data-act="list"]') && /Bell-rope/.test(top().textContent));
  T.check('a find: controls of 44 px or more, nothing wider than the window', small().length === 0 && !wide(), small());
  within('[data-act="recast"]').click();
  T.check('recast lists the other finds of its slot in the chest', !!within('[data-partner="' + last.uid + '"]') && controls().filter((b) => b.dataset.partner).length === 1);
  within('[data-partner="' + last.uid + '"]').click();
  T.check('the recast, a partner chosen: controls of 44 px or more, nothing wider than the window', small().length === 0 && !wide() && !!within('[data-act="pour-first"]'), small());
  const price = Items.price(first, 'recast', last);
  within('[data-act="pour-first"]').click();
  await T.until(() => UI.top() === 'confirm');
  T.check('pouring is asked once more, with the price of both', new RegExp(price + ' coin').test(top().textContent), top().textContent);
  top().querySelector('[data-answer="yes"]').click();
  await T.until(() => UI.top() === 'finds');
  const chest = Game.save.chest.finds, made = chest[chest.length - 1];
  T.check('recast: one new find in the chest, the two poured gone, the price paid', !chest.includes(first) && !chest.includes(last) && made.cool === 4 &&
    made.lines[0].value === first.lines[0].value && made.lines[4].value === last.lines[4].value && Game.save.account.coin === 200 - price, said());
  T.check('the room shows the new find, cooling', /Cooling/.test(top().textContent) && /Recast/.test(said()), said());
  T.check('the save is sound', SaveData.validate(Game.save).length === 0, SaveData.validate(Game.save));
  // a worn find: taken off, and back; a refused recast
  UI.back();
  within('[data-slot="tool"]').click();
  within('[data-act="recast"]').click();
  T.check('a worn find is not poured: the room says to take it off first', /Take it off first/.test(said()), said());
  within('[data-act="off"]').click();
  T.check('taken off, into the chest', c.worn.tool === null && /Taken off/.test(said()), said());
  UI.back();
  T.check('UI.back: from a find to the list', !!within('.fnd-head'));
  UI.back();
  T.check('and out of the room', UI.top() === 'lantern');
  Game.title();
  return T.done();
};

module.exports = [
  { name: 'finds: banked by ringing down, worn in the room, kept through a reload, phone 390x844', viewport: { width: 390, height: 844 }, mobile: true,
    query: 'view=2d', run: [life, afterReload] },
  { name: 'finds: the room, phone 390x844', viewport: { width: 390, height: 844 }, mobile: true, query: 'view=2d', run: screens },
  { name: 'finds: the room, phone on its side 844x390, with a notch', viewport: { width: 844, height: 390 }, mobile: true, query: 'view=2d',
    safeArea: { top: 0, right: 47, bottom: 21, left: 47 }, run: screens },
  { name: 'finds: the room, desktop 1280x720', viewport: { width: 1280, height: 720 }, mobile: false, query: 'view=2d', run: screens },
];
