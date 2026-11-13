// tests/scenarios/52-household.js: the Household in the page: the game's states around a character (90-game.js), the
// save kept through Store (16-savedata.js, 14-character.js), the stand-in screens of the Household, the Lantern and
// the save as text, and the results of a character's vigil (73-screens.js).
//   life      a character's life across reloads, on a phone. Made in the Household, it goes down from the Lantern
//             into the Dial, its level rises, the save is written when the page is hidden in the middle of the
//             vigil, it rings down, the results name it and lead back to the Lantern; the save's text goes out and
//             comes in again through its screen, and a broken text is refused. After a reload the save and the level
//             are as they were. Then it dies: the Register, its bell, and a dead character that cannot be played,
//             still after the next reload; a vigil the page leaves unfinished (a reload in the middle of it) ends as
//             one when the game starts again; a save that cannot be read is set aside and the Household begins
//             afresh. A page without storage (the artifact) starts each reload with a blank Household, and the
//             checks after a reload say only that.
//   screens   the Household with standing characters and the dead, the Lantern, the save's text and the results of a
//             character's vigil, on a phone upright, on its side with a notch, and on a desktop: every control at
//             least 44 px high and wide, and nothing wider than the window.
// The functions below run inside the page (see tests/run.js), so they use only T, TB and the page itself.

// NOTE, in each part: the key of what a part leaves in the browser's storage for the part after the reload. Each part
// runs inside the page and sees nothing of this file, so each declares it.

const first = async function () {
  const NOTE = 'test.household';
  const { Game, UI, Char, Store, SaveData, Defs } = TB;
  const ui = document.getElementById('ui');
  const top = () => ui.querySelector('.ui-screen:not([inert])');
  const button = (text) => Array.from(ui.querySelectorAll('.ui-screen:not([inert]) button')).find((b) => b.textContent.trim() === text);
  const controls = () => Array.from(top().querySelectorAll('button, input, textarea'));
  const small = () => controls().filter((c) => c.getBoundingClientRect().height < 44 || c.getBoundingClientRect().width < 44).map((c) => c.textContent || c.tagName);
  const wide = () => top().scrollWidth > innerWidth;
  const focused = () => (document.activeElement && ui.contains(document.activeElement) ? document.activeElement : null);
  const stored = () => Store.read(SaveData.KEY);
  const pretend = (state) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
    document.dispatchEvent(new Event('visibilitychange'));
  };

  T.check('the game opens on the title, with a blank Household', Game.state === 'title' && !!Game.save && Game.save.chars.length === 0 &&
    Game.save.register.length === 0 && Game.save.away === null && Game.save.v === SaveData.VERSION, Game.save && Game.save.v);
  T.check('nothing was written at the start', (await stored()) === null);

  // ---- the Household: nobody stands in it yet ----
  button('The Household').click();
  T.check('the title leads to the Household', Game.state === 'household' && UI.top() === 'household' && /Nobody stands in the Household yet/.test(top().textContent), [Game.state, UI.top()]);
  const field = top().querySelector('input[type="text"]'), make = focused();
  T.check('a new character has a name field, and focus starts on the control that makes it', !!field && !!make && make.dataset.make !== undefined && field.value.length > 0,
    make && make.textContent);
  T.check('every control of the Household is 44 px or more at phone size, and nothing is wider than the window', small().length === 0 && !wide(), small());
  field.value = '  Hester Pell ';
  make.click();
  const char = Game.char;
  T.check('making a character opens the Lantern with it', Game.state === 'lantern' && UI.top() === 'lantern' && !!char && char.name === 'Hester Pell' && char.level === 1 &&
    Game.save.active === char.uid && Game.save.chars.length === 1, char && [char.name, char.level]);
  if (!char) return T.done();
  const cls = Defs.get('class', char.class);
  T.check('it is a character of an open class, with its class\'s voices, the first in the loadout', Char.classes(Game.save).includes(char.class) &&
    char.voices.length === cls.voices.length && char.loadout[0] === char.voices[0].uid, [char.class, char.voices.length]);
  T.check('the Lantern names it, and shows its class and level', top().querySelector('h2').textContent === 'Hester Pell' && top().textContent.includes(cls.name + ', level 1'),
    top().textContent.slice(0, 120));
  T.check('every control of the Lantern is 44 px or more at phone size, and nothing is wider than the window', small().length === 0 && !wide(), small());
  T.check('the save was written when the character was made', ((await stored()) || { chars: [] }).chars.some((c) => c.uid === char.uid && c.name === 'Hester Pell'));

  // ---- down into the Dial ----
  const down = focused();
  T.check('focus starts on the way down', !!down && /^Go down to /.test(down.textContent), down && down.textContent);
  down.click();
  const S = Game.S;
  T.check('the Lantern sends the character down: a vigil of the Dial with a copy of it', Game.state === 'run' && !!S && S.zone.id === 'dial' && !!S.cfg.char &&
    S.cfg.char !== char && S.cfg.char.uid === char.uid && S.cfg.mode === 'household' && Game.save.away !== null && Game.save.away.char === char.uid, S && S.zone.id);
  if (!S) return T.done();
  T.check('the save says a vigil is under way', ((await stored()) || {}).away !== null);
  Game.sim(1);
  const c = S.cfg.char;
  while (c.level < 3) Char.gain(c, Char.need(c, S.mode) - c.xp, S.mode);   // as the embers of the vigil would
  Char.gain(c, 3, S.mode);
  S.dirty = true;
  Game.sim(1);
  const xp = c.xp;
  T.check('the character of the run rises to level 3, the second place of its loadout opening', c.level === 3 && xp >= 3 && c.loadout[1] !== null &&
    Game.save.chars[0].level === 1, [c.level, xp, c.loadout]);

  // ---- the page hidden in the middle of the vigil: what was earned is kept at once ----
  pretend('hidden');
  const kept = await T.until(async () => {
    const s = await stored();
    return s && s.chars[0].level === 3 ? s : null;
  }, 3000);
  pretend('visible');
  delete document.visibilityState;
  T.check('when the page is hidden the save is written with what the vigil earned so far, still away', !!kept && kept.chars[0].xp === xp && kept.away !== null &&
    kept.away.char === char.uid && Game.save.chars[0].level === 3, kept && kept.chars[0]);

  // ---- rung down ----
  Game.command({ type: 'leave' });
  await T.until(() => Game.state === 'results');
  const rep = Game.report, words = top().textContent;
  T.check('ringing down ends the vigil and the end is applied to the character', Game.state === 'results' && !!rep && rep.outcome === 'left' && rep.level === 3 && rep.rose === 2 &&
    rep.death === null && Game.save.away === null && Game.save.chars[0].level === 3 && Game.save.chars[0].vigils === 1, rep);
  T.check('the results name the character, its class and level and the levels it gained', words.includes('Hester Pell, ' + cls.name + ' of level 3, 2 levels gained') &&
    words.includes('Rung down'), words.slice(0, 240));
  const back = button('Back to the Lantern');
  T.check('and lead back to the Lantern (with focus), or down again', !!back && document.activeElement === back && !!button('Another vigil') && !button('Back to the title'));
  T.check('the save was written at the end', ((await stored()) || {}).away === null && (await stored()).chars[0].vigils === 1);
  back.click();
  T.check('back at the Lantern, the character is at level 3', Game.state === 'lantern' && UI.top() === 'lantern' && top().textContent.includes(cls.name + ', level 3'),
    top().textContent.slice(0, 120));

  // ---- the save as text, out and in again ----
  Game.household();
  button('Save text').click();
  const out = top().querySelector('[data-field="export"]'), into = top().querySelector('[data-field="import"]');
  T.check('the Household offers its save as text', UI.top() === 'save-text' && !!out && !!into && out.value === Game.exportText() && /^TOLLBOUND SAVE 2 [0-9a-f]{8}\n/.test(out.value),
    out && out.value.slice(0, 30));
  T.check('every control of the save\'s text is 44 px or more, and nothing is wider than the window', small().length === 0 && !wide(), small());
  into.value = out.value.replace('"Hester Pell"', '"Hester Bell"');     // the text changed: its check no longer holds
  button('Read it in').click();
  T.check('a text whose check does not hold is refused, and the Household is as it was', UI.top() === 'save-text' &&
    /could not be read/.test(top().textContent) && Game.save.chars[0].name === 'Hester Pell', top().textContent.slice(-160));
  const before = JSON.parse(JSON.stringify(Game.save));
  into.value = out.value;
  button('Read it in').click();
  const after = Game.save, same = JSON.stringify(Object.assign({}, before, { rev: 0 })) === JSON.stringify(Object.assign({}, after, { rev: 0 }));
  T.check('export then import gives back the same save (but for rev, which counts the write the import made)', same && after !== before && after.rev === before.rev + 1 &&
    Game.state === 'household' && UI.top() === 'household', [before.rev, after.rev]);
  T.check('the Household shows the save read in', !!Array.from(top().querySelectorAll('button')).find((b) => b.textContent.startsWith('Hester Pell')));

  if (T.target === 'standalone') localStorage.setItem(NOTE, JSON.stringify({ uid: char.uid, text: Game.exportText(), xp: Game.save.chars[0].xp }));
  return T.done();
};

const second = async function () {
  const NOTE = 'test.household';
  const { Game, UI, Char, Store, SaveData, Sim, Defs } = TB;
  const ui = document.getElementById('ui');
  const top = () => ui.querySelector('.ui-screen:not([inert])');
  const button = (text) => Array.from(ui.querySelectorAll('.ui-screen:not([inert]) button')).find((b) => b.textContent.trim() === text);
  const focused = () => (document.activeElement && ui.contains(document.activeElement) ? document.activeElement : null);
  if (T.target !== 'standalone') {
    T.check('a page without storage starts with a blank Household after a reload', !!Game.save && Game.save.chars.length === 0 && Store.status === 'memory', Store.status);
    return T.done();
  }
  const was = JSON.parse(localStorage.getItem(NOTE));
  const char = Game.save.chars.find((c) => c.uid === was.uid);
  T.check('after a reload the save is the one written before it', Game.exportText() === was.text);
  T.check('the character stands in the Household with its level and experience', !!char && char.level === 3 && char.xp === was.xp && char.vigils === 1 && Game.save.away === null,
    char && [char.level, char.xp]);
  if (!char) return T.done();

  // ---- chosen in the Household, down from the Lantern, and dead ----
  button('The Household').click();
  const pick = Array.from(top().querySelectorAll('button')).find((b) => b.textContent.startsWith('Hester Pell'));
  T.check('the Household lists it, and focus starts on it', !!pick && document.activeElement === pick, pick && pick.textContent);
  pick.click();
  T.check('choosing it opens the Lantern', Game.state === 'lantern' && UI.top() === 'lantern' && !!Game.char && Game.char.uid === char.uid, [Game.state, UI.top()]);
  focused().click();
  const S = Game.S;
  T.check('it goes down again', Game.state === 'run' && !!S && S.cfg.char.uid === char.uid);
  if (!S) return T.done();
  Game.sim(1);
  const body = Defs.all('enemy').find((e) => e.attacks.length > 0), a = body.attacks[0], attack = typeof a === 'string' ? Defs.get('attack', a) : a;
  S.cause = { attack: attack.id, kind: attack.type, toll: S.toll };   // what Dmg.fall would note: the attack that killed it
  const tolls = char.tolls + S.toll;
  Sim.end(S, 'died');
  await T.until(() => Game.state === 'results');
  const rep = Game.report, dead = Game.save.register.find((d) => d.uid === char.uid);
  T.check('the end of a death is applied: the character leaves the Household for the Register', !!rep && !!rep.death && Game.save.chars.length === 0 && !!dead &&
    dead.how === 'died' && dead.cause.attack === attack.id && dead.level === 3 && Game.save.active === null, dead);
  const bell = Game.save.account.frame.bells.find((b) => b.of === char.uid);
  T.check('it is recast as a bell weighing the tolls of its life, waiting to be hung', !!bell && bell.weight === tolls && bell.pit === null && dead.bell === bell.uid && rep.first === true,
    bell);
  T.check('the results tell the death and lead to the Household alone', top().querySelector('h2').textContent === 'Joined the dead' &&
    top().textContent.includes('On the Register now') && document.activeElement === button('To the Household') && !button('Another vigil') && !button('Back to the Lantern'),
  top().textContent.slice(0, 240));
  button('To the Household').click();
  const register = top().querySelector('.game-register');
  T.check('the Household has nobody standing, and its Register names the dead and what killed it', Game.state === 'household' && /Nobody stands/.test(top().textContent) &&
    !!register && register.textContent.includes('Hester Pell') && register.textContent.includes(body.name), register && register.textContent);
  T.check('the dead character has no control of its own there', !Array.from(top().querySelectorAll('button')).some((b) => b.textContent.includes('Hester')));
  T.check('and cannot be played: not chosen, not sent down', Game.lantern(char.uid) === null && Game.state === 'household' && Game.vigil() === null && Game.S === null &&
    Char.begin(Game.save, char.uid, 'dial', 1) === null && Game.save.away === null);
  T.check('the save was written with the Register', ((await Store.read(SaveData.KEY)) || { register: [] }).register.some((d) => d.uid === char.uid));

  // ---- a second character, whose vigil the page leaves unfinished ----
  top().querySelector('input[type="text"]').value = 'Jory Cleave';
  focused().click();
  const jory = Game.char;
  T.check('a second character is made', !!jory && jory.name === 'Jory Cleave' && Game.state === 'lantern' && jory.uid !== char.uid);
  focused().click();
  T.check('and goes down', Game.state === 'run' && !!Game.S && Game.S.cfg.char.uid === jory.uid && Game.save.away !== null);
  Game.sim(2);
  localStorage.setItem(NOTE, JSON.stringify({ dead: char.uid, jory: jory.uid, name: body.name }));
  return T.done();   // the reload comes in the middle of the vigil
};

const third = async function () {
  const NOTE = 'test.household';
  const { Game, Store, SaveData } = TB;
  if (T.target !== 'standalone') {
    T.check('a page without storage starts with a blank Household after a reload', !!Game.save && Game.save.chars.length === 0 && Game.save.register.length === 0);
    return T.done();
  }
  const was = JSON.parse(localStorage.getItem(NOTE)), jory = Game.save.chars.find((c) => c.uid === was.jory);
  T.check('a vigil the page left unfinished ends when the game starts again: the character lives, and that vigil counts', Game.save.away === null && !!jory &&
    jory.vigils === 1 && Game.state === 'title', jory);
  T.check('a toast says so', document.getElementById('toast').textContent.includes('left unfinished'), document.getElementById('toast').textContent);
  T.check('and the save was written then', ((await Store.read(SaveData.KEY)) || {}).away === null);
  T.check('the dead stay on the Register after a reload, and cannot be played', Game.save.register.some((d) => d.uid === was.dead) && Game.lantern(was.dead) === null &&
    Game.state === 'household' && !Game.save.chars.some((c) => c.uid === was.dead));
  await Store.write(SaveData.KEY, { v: SaveData.VERSION, chars: 'not a list' });   // a save that cannot be read
  return T.done();
};

const fourth = async function () {
  const NOTE = 'test.household';
  const { Game, Store, SaveData } = TB;
  if (T.target !== 'standalone') {
    T.check('a page without storage starts with a blank Household after a reload', !!Game.save && Game.save.chars.length === 0);
    return T.done();
  }
  T.check('a save that cannot be read leaves a blank Household, and a toast says it was set aside', !!Game.save && Game.save.chars.length === 0 &&
    Game.save.register.length === 0 && /could not be read, and was set aside/.test(document.getElementById('toast').textContent), document.getElementById('toast').textContent);
  const aside = await Store.read(SaveData.KEY + '.unread');
  T.check('what could not be read is kept under a key of its own, as it was', !!aside && aside.chars === 'not a list', aside);
  localStorage.removeItem(NOTE);
  return T.done();
};

const screens = async function () {
  const { Game, UI, Sim, Char } = TB;
  const ui = document.getElementById('ui');
  const top = () => ui.querySelector('.ui-screen:not([inert])');
  const controls = () => Array.from(top().querySelectorAll('button, input, textarea'));
  const small = () => controls().filter((c) => c.getBoundingClientRect().height < 44 || c.getBoundingClientRect().width < 44).map((c) => c.textContent || c.tagName);
  const wide = () => {
    const s = top();
    return s.scrollWidth > innerWidth || controls().some((c) => c.getBoundingClientRect().left < -0.5 || c.getBoundingClientRect().right > innerWidth + 0.5);
  };
  const cls = Char.classes(Game.save)[0];
  const hester = Game.make(cls, 'Hester Pell'), jory = Game.make(cls, 'Jory Cleave'), wenna = Game.make(cls, 'Wenna Holt');
  T.check('three characters are made', !!hester && !!jory && !!wenna && Game.save.chars.length === 3);
  Game.lantern(hester.uid);
  const S = Game.vigil();
  Game.sim(1);
  Sim.end(S, 'died');
  await T.until(() => Game.state === 'results');
  T.check('the results of a character\'s death: controls of 44 px or more, nothing wider than the window', UI.top() === 'results' && small().length === 0 && !wide(), small());
  Game.household();
  T.check('the Household with two standing and one dead: controls of 44 px or more, nothing wider than the window', UI.top() === 'household' &&
    top().querySelectorAll('.game-dead').length === 1 && small().length === 0 && !wide(), small());
  Game.lantern(jory.uid);
  T.check('the Lantern: controls of 44 px or more, nothing wider than the window', UI.top() === 'lantern' && small().length === 0 && !wide(), small());
  UI.open('save-text');
  T.check('the save as text: controls of 44 px or more, nothing wider than the window', UI.top() === 'save-text' && small().length === 0 && !wide(), small());
  UI.back();
  T.check('back closes it, over the Lantern', UI.top() === 'lantern');
  Game.title();
  return T.done();
};

module.exports = [
  { name: 'household: a life, its save and three reloads, phone 390x844', viewport: { width: 390, height: 844 }, mobile: true, query: 'view=2d',
    run: [first, second, third, fourth] },
  { name: 'household: the screens, phone 390x844', viewport: { width: 390, height: 844 }, mobile: true, query: 'view=2d', run: screens },
  { name: 'household: the screens, phone on its side 844x390, with a notch', viewport: { width: 844, height: 390 }, mobile: true, query: 'view=2d',
    safeArea: { top: 0, right: 47, bottom: 21, left: 47 }, run: screens },
  { name: 'household: the screens, desktop 1280x720', viewport: { width: 1280, height: 720 }, mobile: false, query: 'view=2d', run: screens },
];
