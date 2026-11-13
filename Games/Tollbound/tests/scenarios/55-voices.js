// tests/scenarios/55-voices.js: the Lantern's room of voices (src/js/76-voices.js) in the page.
//   reload    on a phone: a character holding knots and knowing observances (as vigils and bequests leave them) opens
//             the room from the Lantern, ties a knot into its first voice's rope and keeps an observance by touch; the
//             save is written at once with both, and after a reload they are as they were: the room shows the knot in
//             the rope and the observance kept, with its Heed held and the warning the free Heed gives; then the knot is
//             untied and the observance let go there. A page without storage (the artifact) starts each reload with a
//             blank Household, and the check after the reload says only that.
//   screens   the room with places open and shut, voices and knots held and in the chest, observances kept, known and
//             opened, on a phone upright, on its side with a notch, and on a desktop: every control at least 44 px
//             high and wide and nothing wider than the window; and by keys alone: a rope place chosen with the arrows
//             and Enter, a knot tied, the views left with Escape.
// The functions below run inside the page (see tests/run.js), so they use only T, TB and the page itself.

const first = async function () {
  const NOTE = 'test.voices';
  const { Game, UI, Char, Store, SaveData, Defs } = TB;
  const ui = document.getElementById('ui');
  const top = () => ui.querySelector('.ui-screen:not([inert])');
  const find = (sel) => top().querySelector(sel);
  const tap = async (el) => { el.scrollIntoView({ block: 'center' }); await T.tap(el); };
  const controls = () => Array.from(top().querySelectorAll('button, input, textarea'));
  const small = () => controls().filter((c) => c.getBoundingClientRect().height < 44 || c.getBoundingClientRect().width < 44).map((c) => c.textContent);
  const wide = () => top().scrollWidth > innerWidth;

  // a character that found a knot in a vigil and learned three observances from bequests
  Game.household();
  const char = Game.make(Char.classes(Game.save)[0], 'Ada Vowell');
  if (char) Game.lantern(char.uid);
  T.check('a character is made, and stands in the Lantern', !!char && Game.state === 'lantern');
  if (!char) return T.done();
  char.knots['stones-answer'] = 1;
  Char.learn(char, 'stability');
  Char.learn(char, 'hand-on-the-bell');
  Char.learn(char, 'full-mourning');
  await Game.write();
  const voice = char.voices.find((v) => v.uid === char.loadout[0]);

  // ---- from the Lantern into the room ----
  const way = await T.until(() => find('[data-room="voices"]'));
  T.check('the Lantern offers the room of voices', !!way);
  await tap(way);
  T.check('it opens with the loadout, focus on the voice of the first place', UI.top() === 'voices' && !!find('.vc-room') &&
    document.activeElement === find('[data-place="0"]'), [UI.top(), document.activeElement && document.activeElement.textContent]);
  T.check('the first place holds its voice, and its rope two empty places', find('[data-place="0"]').textContent.includes(Defs.get('voice', voice.id).name) &&
    !!find('[data-rope="0:0"]') && !!find('[data-rope="0:1"]') && !find('[data-rope="0:2"]'));
  T.check('every control is 44 px or more on a phone, and nothing is wider than the window', small().length === 0 && !wide(), small());

  // ---- a knot tied by touch ----
  await tap(find('[data-rope="0:0"]'));
  const tie = find('[data-act="tie"][data-knot="stones-answer"]');
  T.check('a knot place lists the knots held that fit, with what each does', !!tie && top().textContent.includes('Stone\'s Answer') &&
    top().textContent.includes(Defs.get('knot', 'stones-answer').text.slice(0, 30)));
  T.check('the knot view: controls 44 px or more, nothing wider than the window', small().length === 0 && !wide(), small());
  await tap(tie);
  const saved = Game.save.chars.find((c) => c.uid === char.uid), placed = saved.voices.find((v) => v.uid === voice.uid);
  T.check('tied: back in the room, the rope shows it, and the character holds it no longer untied', !!find('[data-rope="0:0"][data-knot="stones-answer"]') &&
    placed.knots[0] === 'stones-answer' && !saved.knots['stones-answer'], plain(placed.knots));
  T.check('focus is back on the rope place', document.activeElement === find('[data-rope="0:0"]'));

  // ---- an observance kept against Heed ----
  const keep = find('[data-act="keep"][data-obs="stability"]');
  T.check('the observances it knows can be kept; Heed all free shows Swells a whole second sooner', !!keep &&
    top().textContent.includes('Heed 100: 0 held, 100 free') && top().textContent.includes('1.00 s sooner'), find('.vc-heed-text').textContent);
  await tap(keep);
  T.check('kept: its Heed is held, and the free Heed shows Swells 0.70 s sooner', saved.observances.includes('stability') &&
    !!find('[data-act="release"][data-obs="stability"]') && find('.vc-heed-text').textContent.includes('30 held, 70 free') &&
    find('.vc-heed-text').textContent.includes('0.70 s sooner'), find('.vc-heed-text').textContent);
  await tap(find('[data-act="keep"][data-obs="hand-on-the-bell"]'));
  T.check('another its free Heed allows is kept too, 40 of the 70 free; the bar shows both', saved.observances.length === 2 &&
    top().querySelectorAll('.vc-heed .vc-held').length === 2, plain(saved.observances));
  await tap(find('[data-act="keep"][data-obs="full-mourning"]'));
  T.check('one that would hold more than is free is refused, and the status line says why', saved.observances.length === 2 &&
    find('.vc-said').textContent.includes('It holds 40 Heed, and 30 is free'), find('.vc-said').textContent);
  await tap(find('[data-act="release"][data-obs="hand-on-the-bell"]'));
  T.check('and the second let go again', saved.observances.length === 1 && saved.observances[0] === 'stability');

  const stored = await T.until(async () => {
    const s = await Store.read(SaveData.KEY);
    const c = s && s.chars.find((x) => x.uid === char.uid);
    return c && c.observances.includes('stability') && c.voices.some((v) => v.knots[0] === 'stones-answer') ? s : null;
  }, 3000);
  T.check('the save was written with the knot tied and the observance kept', T.target !== 'standalone' || !!stored);
  if (T.target === 'standalone') localStorage.setItem(NOTE, JSON.stringify({ uid: char.uid, voice: voice.uid }));
  return T.done();

  function plain(v) { return JSON.parse(JSON.stringify(v)); }
};

const second = async function () {
  const NOTE = 'test.voices';
  const { Game, UI, Store, SaveData } = TB;
  const ui = document.getElementById('ui');
  const top = () => ui.querySelector('.ui-screen:not([inert])');
  const find = (sel) => top().querySelector(sel);
  const tap = async (el) => { el.scrollIntoView({ block: 'center' }); await T.tap(el); };
  if (T.target !== 'standalone') {
    T.check('a page without storage starts with a blank Household after a reload', !!Game.save && Game.save.chars.length === 0 && Store.status === 'memory', Store.status);
    return T.done();
  }
  const was = JSON.parse(localStorage.getItem(NOTE)), char = Game.save.chars.find((c) => c.uid === was.uid);
  const voice = char && char.voices.find((v) => v.uid === was.voice);
  T.check('after a reload the knot is tied in the rope and the observance kept, as they were saved', !!voice && voice.knots[0] === 'stones-answer' &&
    char.observances.length === 1 && char.observances[0] === 'stability', char && char.observances);
  if (!voice) return T.done();
  Game.lantern(char.uid);
  await T.tap(await T.until(() => find('[data-room="voices"]')));
  T.check('the room shows them: the knot in the rope, the observance kept, its Heed held and the warning the rest gives',
    UI.top() === 'voices' && !!find('[data-rope="0:0"][data-knot="stones-answer"]') && !!find('[data-act="release"][data-obs="stability"]') &&
    find('.vc-heed-text').textContent.includes('0.70 s sooner'), find('.vc-heed-text').textContent);
  await tap(find('[data-rope="0:0"]'));
  await tap(find('[data-act="untie"]'));
  await tap(find('[data-act="release"][data-obs="stability"]'));
  const now = Game.save.chars.find((c) => c.uid === was.uid);
  T.check('untied and let go there: the knot is held again, the Heed all free', now.voices.find((v) => v.uid === was.voice).knots[0] === null &&
    now.knots['stones-answer'] === 1 && now.observances.length === 0 && find('.vc-heed-text').textContent.includes('1.00 s sooner'));
  const kept = await T.until(async () => {
    const s = await Store.read(SaveData.KEY);
    const c = s && s.chars.find((x) => x.uid === was.uid);
    return c && c.observances.length === 0 && c.knots['stones-answer'] === 1 ? s : null;
  }, 3000);
  T.check('and the save says so', !!kept);
  localStorage.removeItem(NOTE);
  return T.done();
};

const screens = async function () {
  const { Game, UI, Char } = TB;
  const ui = document.getElementById('ui');
  const top = () => ui.querySelector('.ui-screen:not([inert])');
  const find = (sel) => top().querySelector(sel);
  const controls = () => Array.from(top().querySelectorAll('button, input, textarea'));
  const small = () => controls().filter((c) => c.getBoundingClientRect().height < 44 || c.getBoundingClientRect().width < 44).map((c) => c.textContent);
  const wide = () => {
    const s = top();
    return s.scrollWidth > innerWidth || controls().some((c) => c.getBoundingClientRect().left < -0.5 || c.getBoundingClientRect().right > innerWidth + 0.5);
  };
  Game.household();
  const c = Game.make(Char.classes(Game.save)[0], 'Wenna Holt');
  // a character of some vigils: three places open, voices held and found, knots, and what the chest holds
  while (c.level < 8) Char.gain(c, Char.need(c) - c.xp);
  c.voices.push(Char.voice(9000, 'hand-bell'), Char.voice(9001, 'long-draw'));
  Game.save.uid = Math.max(Game.save.uid, 9001);
  c.knots = { 'running-line': 1, 'stones-answer': 2, 'passes-free': 1, resist: 1, balance: 1, unlaid: 1 };
  Char.place(c, 9001, 2);
  for (let i = 0; i < 5; i++) c.voices.find((v) => v.uid === 9001).knots[i] = null;
  const draw = c.voices.find((v) => v.uid === 9001);
  draw.level = 19; draw.rope = 5;
  Char.tie(c, 9001, 0, 'balance');
  Char.tie(c, 9001, 4, 'unlaid');
  Game.save.chest.knots = { muffle: 1, clash: 2 };
  Game.save.chest.voices.push(Char.voice(9002, 'beating-pair'));
  Game.save.uid = Math.max(Game.save.uid, 9002);
  for (const id of ['stability', 'alms', 'telling-the-bees', 'hand-on-the-bell']) Char.learn(c, id);
  Char.hold(c, 'stability', Game.save.account);
  Char.hold(c, 'alms', Game.save.account);
  Game.save.account.open.observances.push('full-mourning');
  Game.lantern(c.uid);
  UI.open('voices', { char: Game.char });
  T.check('the room opens over the Lantern', UI.top() === 'voices' && UI.isOpen('lantern'));
  T.check('three places open, three shut, a rope of five with its knots, the chest and Heed', top().querySelectorAll('.vc-place:not(.vc-locked)').length === 3 &&
    top().querySelectorAll('.vc-locked').length === 3 && top().querySelectorAll('[data-rope^="2:"]').length === 5 && !!find('[data-act="take"][data-knot="clash"]') &&
    !!find('[data-act="learn"][data-obs="full-mourning"]') && top().querySelectorAll('.vc-heed .vc-held').length === 2);
  T.check('every control is 44 px or more, and nothing is wider than the window', small().length === 0 && !wide(), small());
  find('[data-rope="2:1"]').click();
  T.check('a knot place: controls 44 px or more, nothing wider than the window', small().length === 0 && !wide() && !!find('[data-act="tie"]'), small());
  find('[data-act="back"]').click();
  find('[data-place="1"]').click();
  T.check('a place: controls 44 px or more, nothing wider than the window', small().length === 0 && !wide() && !!find('[data-act="place"]'), small());
  UI.back();
  T.check('back from a view goes to the room, not out of it', UI.top() === 'voices' && !!find('.vc-heed'));

  // ---- by keys alone ----
  const focused = () => document.activeElement;
  find('[data-place="0"]').focus();
  await T.key('ArrowDown');
  T.check('down from the first voice: the first place of its rope', focused() === find('[data-rope="0:0"]'), focused() && focused().dataset.rope);
  await T.key('Enter');
  T.check('Enter opens it', !!find('[data-act="tie"]') && focused() === find('[data-act="tie"]'), focused() && focused().textContent);
  const knot = focused().dataset.knot;
  await T.key('Enter');
  T.check('Enter ties the knot with focus, and the room comes back with focus on the place', !!find('[data-rope="0:0"][data-knot="' + knot + '"]') &&
    focused() === find('[data-rope="0:0"]'));
  await T.key('Enter');
  await T.key('Escape');
  T.check('Escape leaves a view for the room', UI.top() === 'voices' && !!find('.vc-heed'));
  await T.key('Escape');
  T.check('and the room for the Lantern', UI.top() === 'lantern');
  Game.title();
  return T.done();
};

module.exports = [
  { name: 'voices: a knot tied and an observance kept in the room survive a reload, phone 390x844', viewport: { width: 390, height: 844 }, mobile: true,
    query: 'view=2d', run: [first, second] },
  { name: 'voices: the room, phone 390x844', viewport: { width: 390, height: 844 }, mobile: true, query: 'view=2d', run: screens },
  { name: 'voices: the room, phone on its side 844x390, with a notch', viewport: { width: 844, height: 390 }, mobile: true, query: 'view=2d',
    safeArea: { top: 0, right: 47, bottom: 21, left: 47 }, run: screens },
  { name: 'voices: the room, desktop 1280x720', viewport: { width: 1280, height: 720 }, mobile: false, query: 'view=2d', run: screens },
];
