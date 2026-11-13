// tests/scenarios/56-lantern.js: the hub (src/js/77-lantern.js): the Household, the Lantern, and its rooms the Bellframe,
// the Register and the bequests, in the page.
//   touch       a phone, by the finger: the Household makes a character; the Lantern names it with the way down first and
//               its rooms; the Bellframe draws its frame and a pit is opened, a ringing place bought, the save written;
//               the Lantern tells the change; the Register and the bequests; the Lantern's music; every control 44 px
//               or more and nothing wider than the window on every screen
//   acceptance  across reloads: a character is made, goes down and comes back; a pit is opened with Hum; it dies with
//               it, and is on the Register and cannot be played; the next character made has the pit's grant on its
//               sheet; the dead one's bell is hung and a character made after rings it. A page without storage (the
//               artifact) starts each reload with a blank Household, and those parts check only that.
//   keys        a desktop, by keys and by the pad's path (UI.nav, UI.activate, UI.back): from the title to the
//               Bellframe, focus walking from pit to pit with what is told following it, and back again
//   fit         every hub screen of a Household with the living and the dead, on a phone upright, on its side with a
//               notch and on a desktop: controls of 44 px or more, nothing wider than the window
// The functions below run inside the page (see tests/run.js), so they use only T, TB and the page itself.

const touch = async function () {
  const { Game, UI, Store, SaveData, Music, Sound } = TB;
  const ui = document.getElementById('ui');
  const top = () => ui.querySelector('.ui-screen:not([inert])');
  const controls = () => Array.from(top().querySelectorAll('button, input, textarea'));
  const small = () => controls().filter((c) => { const r = c.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).map((c) => (c.textContent.trim() || c.tagName).slice(0, 30));
  const wide = () => top().scrollWidth > innerWidth || controls().some((c) => c.getBoundingClientRect().left < -0.5 || c.getBoundingClientRect().right > innerWidth + 0.5);
  const button = (text) => Array.from(top().querySelectorAll('button')).find((b) => b.textContent.trim() === text);
  const focused = () => (document.activeElement && ui.contains(document.activeElement) ? document.activeElement : null);
  const tap = async (el) => { el.scrollIntoView({ block: 'center' }); await T.tap(el); };
  const tally = (key) => { const c = top().querySelector('[data-tally="' + key + '"] .lt-v'); return c ? c.textContent : null; };

  // ---- the Household, by the finger ----
  await tap(button('The Household'));
  T.check('the title leads to the Household', Game.state === 'household' && UI.top() === 'household' && /Nobody stands in the Household yet/.test(top().textContent));
  const make = focused(), field = top().querySelector('input[type="text"]');
  T.check('focus starts on the control that makes a character; the name is the first text field', !!make && make.dataset.make !== undefined && field.dataset.field === 'name',
    make && make.textContent);
  T.check('the Household: every control 44 px or more, nothing wider than the window', small().length === 0 && !wide(), small());
  field.value = 'Hester Pell';
  await tap(make);
  const char = Game.char;
  T.check('the character is made, and the Lantern opens with it', Game.state === 'lantern' && UI.top() === 'lantern' && !!char && char.name === 'Hester Pell');
  if (!char) return T.done();

  // ---- the Lantern ----
  const lantern = top(), heading = lantern.querySelector('h2'), down = focused();
  T.check('the Lantern names it first, with its class and level', heading.textContent === 'Hester Pell' && lantern.textContent.includes('Change-ringer, level 1'));
  T.check('focus starts on the way down, the first of its controls', !!down && /^Go down to the Dial/.test(down.textContent) && controls()[0] === down, down && down.textContent);
  const rooms = Array.from(lantern.querySelectorAll('[data-room]')).map((b) => b.dataset.room);
  T.check('then a room for each screen of Game.ROOMS that is registered, in their order', ['bellframe', 'register', 'bequests'].every((id) => rooms.includes(id)) &&
    rooms.join() === Game.ROOMS.filter((id) => UI.has(id)).join(), rooms);
  const sheet = TB.Char.sheet(char, Game.save.account), brace0 = parseInt(tally('brace'), 10);
  T.check('its sheet, from Char.sheet: life, Heed, the attributes, Brace and Stride', tally('life') === String(Math.round(sheet.stats['life-max'])) && tally('heed') === '100' &&
    tally('knee') === '5' && tally('hand') === '10' && brace0 === Math.round(sheet.guard[0]) && tally('stride') === Math.round(sheet.guard[1]) + '%',
  [tally('life'), tally('heed'), tally('brace'), tally('stride')]);
  T.check('the Lantern: every control 44 px or more, nothing wider than the window', small().length === 0 && !wide(), small());
  if (Sound.state !== 'off') {
    const playing = await T.until(() => Music.playing === 'lantern', 6000);
    T.check('the Lantern plays its own music, plain hunt on hand-bells', !!playing && Music.has('lantern'), Music.playing);
  }

  // ---- the Bellframe ----
  await tap(lantern.querySelector('[data-room="bellframe"]'));
  let frame = top();
  T.check('the Bellframe opens over the Lantern', UI.top() === 'bellframe' && UI.isOpen('lantern'));
  const pits = frame.querySelectorAll('.bf-pit');
  T.check('it draws the frame: twelve bays, the tenor pit open, the rest boarded, a strap for each pit\'s way in', pits.length === 12 &&
    frame.querySelector('[data-pit="tenor"]').classList.contains('is-open') && frame.querySelectorAll('.bf-pit.is-shut').length === 11 &&
    frame.querySelectorAll('rect.bf-strap').length === 11, pits.length);
  T.check('the first pit that can be opened is chosen, and focused', focused() === frame.querySelector('.bf-pit.is-chosen') && focused().dataset.pit === 'curfew',
    focused() && focused().dataset.pit);
  const open = () => top().querySelector('[data-action="open"]');
  T.check('with no Hum, opening it is offered and refused', !!open() && open().disabled && /Open it for 100 Hum/.test(open().textContent), open() && open().textContent);
  T.check('the Bellframe: every control 44 px or more, nothing wider than the window', small().length === 0 && !wide(), small());
  Game.save.account.hum = 500;                                           // as if the tolls of several vigils had paid it
  await tap(button('Back to the Lantern'));
  await tap(top().querySelector('[data-room="bellframe"]'));
  frame = top();
  await tap(frame.querySelector('[data-pit="tide-bell"]'));
  T.check('a tap on a pit chooses it and tells it', frame.querySelector('.bf-title').textContent === 'Tide Bell' && frame.querySelector('[data-pit="tide-bell"]').classList.contains('is-chosen'));
  await tap(frame.querySelector('[data-pit="curfew"]'));
  T.check('with Hum enough, it can be opened', frame.querySelector('.bf-title').textContent === 'Curfew' && !!open() && !open().disabled);
  await tap(open());
  T.check('opened: the pit is open, its price paid from the Household\'s Hum', Game.save.account.frame.pits.includes('curfew') && Game.save.account.hum === 400 &&
    top().querySelector('[data-pit="curfew"]').classList.contains('is-open'), [Game.save.account.frame.pits, Game.save.account.hum]);
  const kept = await T.until(async () => { const s = await Store.read(SaveData.KEY); return s && s.account.frame.pits.includes('curfew') ? s : null; }, 3000);
  T.check('and the save is written', !!kept || Store.status !== 'saved', Store.status);
  T.check('the next pit\'s price is half as much again', /150/.test(top().querySelector('[data-pit="oven-bell"]').textContent), top().querySelector('[data-pit="oven-bell"]').textContent);
  await tap(top().querySelector('.bf-floor-btn'));
  const place = top().querySelector('[data-action="place"]');
  T.check('the ringing floor offers a place for 100 Hum', !!place && !place.disabled && /100 Hum/.test(place.textContent), place && place.textContent);
  await tap(place);
  T.check('a ringing place is bought: two ropes hang', Game.save.account.frame.places === 2 && Game.save.account.hum === 300 && top().querySelectorAll('.bf-rope').length === 2);
  T.check('still every control 44 px or more, nothing wider than the window', small().length === 0 && !wide(), small());

  // ---- back at the Lantern, which tells the change ----
  await tap(button('Back to the Lantern'));
  T.check('back closes the room, and the Lantern tells the Hum spent and the pit\'s grant: Brace 3 more', UI.top() === 'lantern' && tally('hum') === '300' &&
    parseInt(tally('brace'), 10) === brace0 + 3 && !!top().querySelector('.lt-gives [data-pit="curfew"]'), [tally('hum'), brace0, tally('brace')]);

  // ---- the Register and the bequests ----
  await tap(top().querySelector('[data-room="register"]'));
  T.check('the Register: nobody has died', UI.top() === 'register' && /The Register is empty/.test(top().textContent) && small().length === 0 && !wide(), small());
  await tap(button('Back to the Lantern'));
  await tap(top().querySelector('[data-room="bequests"]'));
  const shown = Array.from(top().querySelectorAll('[data-bequest]')).map((b) => b.dataset.bequest);
  const open2 = TB.Defs.all('bequest').filter((b) => !b.hidden).map((b) => b.id);
  T.check('the bequests: every one not sealed, with how far it has come', UI.top() === 'bequests' && open2.every((id) => shown.includes(id)) &&
    !shown.includes('spared-at-the-gate') && /sealed wish/.test(top().textContent), shown.length);
  T.check('the bequests: every control 44 px or more, nothing wider than the window', small().length === 0 && !wide(), small());
  await tap(button('Back to the Lantern'));
  T.check('and back to the Lantern', UI.top() === 'lantern');
  Game.title();
  return T.done();
};

// ---- the acceptance, across reloads ----

const first = async function () {
  const NOTE = 'test.lantern';
  const { Game, UI, Store, SaveData } = TB;
  const ui = document.getElementById('ui');
  const top = () => ui.querySelector('.ui-screen:not([inert])');
  const button = (text) => Array.from(top().querySelectorAll('button')).find((b) => b.textContent.trim() === text);
  const focused = () => (document.activeElement && ui.contains(document.activeElement) ? document.activeElement : null);
  const tap = async (el) => { el.scrollIntoView({ block: 'center' }); await T.tap(el); };
  const tally = (key) => { const c = top().querySelector('[data-tally="' + key + '"] .lt-v'); return c ? c.textContent : null; };

  await tap(button('The Household'));
  top().querySelector('input[type="text"]').value = 'Agnes Toll';
  await tap(focused());
  const agnes = Game.char, brace = parseInt(tally('brace'), 10);
  T.check('a character is made, and its sheet shows its Brace', !!agnes && Game.state === 'lantern' && brace >= 50 && brace === Math.round(TB.Char.sheet(agnes, Game.save.account).guard[0]),
    brace);
  if (!agnes) return T.done();
  // down, and back
  await tap(focused());
  T.check('it goes down', Game.state === 'run' && !!Game.S && Game.S.cfg.char.uid === agnes.uid);
  Game.sim(1);
  Game.command({ type: 'leave' });
  await T.until(() => Game.state === 'results');
  await tap(button('Back to the Lantern'));
  T.check('and comes back to the Lantern', Game.state === 'lantern' && UI.top() === 'lantern' && Game.save.chars[0].vigils === 1);
  // Hum, as the tolls of more vigils would pay it, and a pit opened with it
  Game.save.account.hum += 150;
  await Game.write();
  await tap(top().querySelector('[data-room="bellframe"]'));
  await tap(top().querySelector('[data-pit="curfew"]'));
  await tap(top().querySelector('[data-action="open"]'));
  T.check('a pit is opened in the Bellframe with this character', Game.save.account.frame.pits.includes('curfew'));
  await T.until(async () => { const s = await Store.read(SaveData.KEY); return s && s.account.frame.pits.includes('curfew'); }, 3000);
  if (T.target === 'standalone') localStorage.setItem(NOTE, JSON.stringify({ agnes: agnes.uid, brace }));
  return T.done();
};

const second = async function () {
  const NOTE = 'test.lantern';
  const { Game, Sim, UI, Char } = TB;
  if (T.target !== 'standalone') {
    T.check('a page without storage starts with a blank Household after a reload', !!Game.save && Game.save.chars.length === 0);
    return T.done();
  }
  const ui = document.getElementById('ui');
  const top = () => ui.querySelector('.ui-screen:not([inert])');
  const button = (text) => Array.from(top().querySelectorAll('button')).find((b) => b.textContent.trim() === text);
  const focused = () => (document.activeElement && ui.contains(document.activeElement) ? document.activeElement : null);
  const tap = async (el) => { el.scrollIntoView({ block: 'center' }); await T.tap(el); };
  const tally = (key) => { const c = top().querySelector('[data-tally="' + key + '"] .lt-v'); return c ? c.textContent : null; };
  const was = JSON.parse(localStorage.getItem(NOTE));
  T.check('after a reload the pit is still open, and the character stands', Game.save.account.frame.pits.includes('curfew') && !!Char.find(Game.save, was.agnes));
  await tap(button('The Household'));
  const pick = focused();
  T.check('the Household chooses it first', !!pick && pick.textContent.startsWith('Agnes Toll'), pick && pick.textContent);
  await tap(pick);
  T.check('the pit\'s grant reaches it too, made before the pit was opened: Brace 3 more', Game.state === 'lantern' && parseInt(tally('brace'), 10) === was.brace + 3,
    [was.brace, tally('brace')]);
  // it dies with the pit open
  await tap(focused());
  const S = Game.S;
  T.check('it goes down again', Game.state === 'run' && !!S);
  Game.sim(1);
  S.cause = { attack: 'dial.clutch', kind: 'blow', toll: S.toll };       // what Dmg.fall notes: a Wake-walker's Blow
  Sim.end(S, 'died');
  await T.until(() => Game.state === 'results');
  await tap(button('To the Household'));
  const register = top().querySelector('.game-register'), dead = register ? register.querySelectorAll('.game-dead') : [];
  T.check('it is on the Register, with what killed it', Game.state === 'household' && dead.length === 1 && dead[0].textContent.includes('Agnes Toll') &&
    dead[0].textContent.includes('Wake-walker'), register && register.textContent);
  T.check('and cannot be played: no control of its own, not chosen, not sent down', !Array.from(top().querySelectorAll('button')).some((b) => b.textContent.includes('Agnes')) &&
    Game.lantern(was.agnes) === null && Game.state === 'household' && Game.vigil() === null);
  T.check('nobody stands; its bell waits to be hung', /Nobody stands/.test(top().textContent) && Game.save.account.frame.bells.length === 1 &&
    Game.save.account.frame.bells[0].pit === null && /waits in the Bellframe/.test(top().textContent));
  return T.done();
};

const third = async function () {
  const NOTE = 'test.lantern';
  const { Game, UI, Char } = TB;
  if (T.target !== 'standalone') {
    T.check('a page without storage starts with a blank Household after a reload', !!Game.save && Game.save.register.length === 0);
    return T.done();
  }
  const ui = document.getElementById('ui');
  const top = () => ui.querySelector('.ui-screen:not([inert])');
  const button = (text) => Array.from(top().querySelectorAll('button')).find((b) => b.textContent.trim() === text);
  const focused = () => (document.activeElement && ui.contains(document.activeElement) ? document.activeElement : null);
  const tap = async (el) => { el.scrollIntoView({ block: 'center' }); await T.tap(el); };
  const tally = (key) => { const c = top().querySelector('[data-tally="' + key + '"] .lt-v'); return c ? c.textContent : null; };
  const was = JSON.parse(localStorage.getItem(NOTE));
  await tap(button('The Household'));
  T.check('after a reload the dead one is on the Register still, and cannot be played', top().querySelectorAll('.game-dead').length === 1 && Game.lantern(was.agnes) === null &&
    Game.state === 'household');
  // the next character: the pit opened with the first is on its sheet
  top().querySelector('input[type="text"]').value = 'Bram Holt';
  await tap(focused());
  const bram = Game.char;
  T.check('the next character is made', !!bram && bram.name === 'Bram Holt' && Game.state === 'lantern');
  T.check('and the pit opened with the first changes it: its Brace is 3 more than the first character\'s was', parseInt(tally('brace'), 10) === was.brace + 3 &&
    Math.round(Char.sheet(bram, Game.save.account).guard[0]) === was.brace + 3 && !!top().querySelector('.lt-gives [data-pit="curfew"]'), [was.brace, tally('brace')]);
  // the dead one's bell is hung, and a character made after rings it
  await tap(top().querySelector('[data-room="bellframe"]'));
  await tap(top().querySelector('.bf-waiting-btn'));
  const hang = top().querySelector('[data-action="hang"][data-pit="tenor"]');
  T.check('the bell waiting to be hung is told, and can hang in the tenor pit', !!hang && top().querySelector('.bf-title').textContent === 'Agnes Toll’s bell');
  await tap(hang);
  const bell = Game.save.account.frame.bells[0];
  T.check('it hangs there, drawn in its bay', bell.pit === 'tenor' && !!top().querySelector('[data-pit="tenor"].is-hung') && top().querySelectorAll('.bf-waiting-btn').length === 0);
  await tap(button('Back to the Lantern'));
  await tap(button('The Household'));
  const toggle = top().querySelector('[data-bell="' + bell.uid + '"]');
  T.check('a new character rings it: the hung bell is offered, rung by default in the one ringing place', !!toggle && toggle.getAttribute('aria-pressed') === 'true');
  top().querySelector('input[type="text"]').value = 'Cass Wren';
  await tap(top().querySelector('[data-make]'));
  const cass = Game.char;
  T.check('made ringing it: its gift on the sheet, at the bell\'s level', !!cass && cass.bells.includes(bell.uid) && !!top().querySelector('.lt-gives [data-bell="' + bell.uid + '"]') &&
    /The Ringer.s Turn, level 1/.test(top().querySelector('.lt-gives').textContent), cass && cass.bells);
  localStorage.removeItem(NOTE);
  Game.title();
  return T.done();
};

// ---- keys, and the pad's path ----

const keys = async function () {
  const { Game, UI } = TB;
  const ui = document.getElementById('ui');
  const top = () => ui.querySelector('.ui-screen:not([inert])');
  const focused = () => (document.activeElement && ui.contains(document.activeElement) ? document.activeElement : null);
  T.check('the title has focus on its main control', !!focused() && focused().textContent.trim() === 'The Household');
  await T.key('Enter');
  T.check('Enter opens the Household, focus on the control that makes a character', Game.state === 'household' && !!focused() && focused().dataset.make !== undefined);
  await T.key('Enter');
  T.check('Enter makes one and opens the Lantern, focus on the way down', Game.state === 'lantern' && !!focused() && focused().dataset.vigil === 'dial');
  // the arrows walk down the rooms, two to a row, as a key or pad user reaches them: down a row, then across it
  let room = null;
  const look = () => { if (focused() && focused().dataset.room === 'bellframe') room = focused(); };
  for (let row = 0; row < 4 && !room; row++) {
    await T.key('ArrowDown');
    look();
    if (room) break;
    await T.key('ArrowRight');
    look();
    if (!room) await T.key('ArrowLeft');
  }
  T.check('the arrows reach the Bellframe\'s room', !!room, focused() && focused().textContent);
  if (!room) return T.done();
  await T.key('Enter');
  const title = () => top().querySelector('.bf-title').textContent;
  T.check('Enter opens it, focus on the pit chosen first', UI.top() === 'bellframe' && focused().dataset.pit === 'curfew' && title() === 'Curfew');
  await T.key('ArrowLeft');
  T.check('left: focus walks to the next bay, and what is told follows it', focused().dataset.pit === 'oven-bell' && title() === 'Oven Bell', focused().dataset.pit);
  await T.key('ArrowUp');
  T.check('up: to the tier above', focused().dataset.pit === 'sermon-bell' && title() === 'Sermon Bell', focused().dataset.pit);
  UI.nav(1, 0);                                                            // the pad's stick
  T.check('the pad walks it too', focused().dataset.pit === 'market-bell' && title() === 'Market Bell', focused().dataset.pit);
  UI.nav(0, 1);
  UI.nav(0, 1);
  const at = focused();
  T.check('down to the foot of the frame', !!at && (at.dataset.pit === 'curfew' || at.dataset.pit === 'tenor' || at.classList.contains('bf-floor-btn')), at && at.dataset.pit);
  T.check('UI.activate presses the focused bay, which stays chosen', UI.activate() === true && focused() === at && at.classList.contains('is-chosen'));
  await T.key('Escape');
  T.check('Escape closes the room, focus back on its control in the Lantern', UI.top() === 'lantern' && focused() === top().querySelector('[data-room="bellframe"]'));
  await T.key('Escape');
  T.check('Escape on the Lantern goes back to the Household', Game.state === 'household' && UI.top() === 'household');
  await T.key('Escape');
  T.check('and from the Household to the title', Game.state === 'title');
  return T.done();
};

// ---- every hub screen fits ----

const fit = async function () {
  const { Game, UI, Sim, Char, Bellframe } = TB;
  const ui = document.getElementById('ui');
  const top = () => ui.querySelector('.ui-screen:not([inert])');
  const controls = () => Array.from(top().querySelectorAll('button, input, textarea'));
  const small = () => controls().filter((c) => { const r = c.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).map((c) => (c.textContent.trim() || c.tagName).slice(0, 30));
  const wide = () => top().scrollWidth > innerWidth || controls().some((c) => c.getBoundingClientRect().left < -0.5 || c.getBoundingClientRect().right > innerWidth + 0.5);
  const cls = Char.classes(Game.save)[0];
  // a Household with three dead (one hung), two standing, Hum spent on the frame, bequests met
  const die = (name, attack, kind) => {
    const c = Game.make(cls, name);
    Game.lantern(c.uid);
    const S = Game.vigil();
    Game.sim(0.5);
    S.cause = { attack, kind, toll: 1 };
    S.toll = 1;
    Sim.end(S, 'died');
    Game.sim(0.1);
  };
  die('Hester Pell', 'dial.clutch', 'blow');
  die('Absalom Fry', 'dial.load', 'swell');
  die('Orrin Vale', null, 'drag');
  const save = Game.save;
  save.account.hum = 900;
  Bellframe.open(save, 'curfew');
  Bellframe.open(save, 'market-bell');
  Bellframe.place(save);
  Bellframe.hang(save, save.account.frame.bells[0].uid, 'tenor');
  const jory = Game.make(cls, 'Jory Cleave', [save.account.frame.bells[0].uid]);
  Game.make(cls, 'Wenna Holt');
  Game.lantern(jory.uid);
  const S = Game.vigil();
  Game.sim(0.5);
  S.toll = 1;
  Sim.end(S, 'left');
  Game.sim(0.1);
  const look = (what) => T.check(what + ': every control 44 px or more, nothing wider than the window', small().length === 0 && !wide(), small());
  Game.household();
  look('the Household with two standing and three dead');
  T.check('its Register: one line for each death, the press of the dead among them', top().querySelectorAll('.game-dead').length === 3 && /the press of the dead/.test(top().textContent));
  Game.lantern(jory.uid);
  look('the Lantern');
  T.check('the Lantern tells the bequests the last vigil met', /Met in your last vigil/.test(top().textContent));
  for (const room of ['bellframe', 'register', 'bequests']) {
    UI.open(room, { char: Game.char });
    look('the room ' + room);
    if (room === 'bellframe') {
      for (const sel of ['[data-pit="tenor"]', '.bf-floor-btn', '.bf-waiting-btn']) {
        top().querySelector(sel).click();
        look('the Bellframe with ' + sel + ' chosen');
      }
    }
    UI.back();
  }
  T.check('each room closes back to the Lantern', UI.top() === 'lantern');
  Game.title();
  return T.done();
};

module.exports = [
  { name: 'lantern: the hub by touch, phone 390x844', viewport: { width: 390, height: 844 }, mobile: true, query: 'view=2d', run: touch },
  { name: 'lantern: the acceptance across reloads, phone 390x844', viewport: { width: 390, height: 844 }, mobile: true, query: 'view=2d', run: [first, second, third] },
  { name: 'lantern: keys and the pad, desktop 1280x720', viewport: { width: 1280, height: 720 }, mobile: false, query: 'view=2d', run: keys },
  { name: 'lantern: every hub screen fits, phone 390x844', viewport: { width: 390, height: 844 }, mobile: true, query: 'view=2d', run: fit },
  { name: 'lantern: every hub screen fits, phone on its side 844x390, with a notch', viewport: { width: 844, height: 390 }, mobile: true, query: 'view=2d',
    safeArea: { top: 0, right: 47, bottom: 21, left: 47 }, run: fit },
  { name: 'lantern: every hub screen fits, desktop 960x540', viewport: { width: 960, height: 540 }, mobile: false, query: 'view=2d', run: fit },
];
