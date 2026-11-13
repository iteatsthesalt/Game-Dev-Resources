// tests/scenarios/51-screens.js: the title and the results of 73-screens.js, which replace the stand-ins of 90-game.js.
//   title     what it shows (the emblem, the name, one line of subtitle, its main control "The Household" with focus,
//             Settings under it, the build line), that it fits the window and leaves the smoke test's tap clear, that
//             every control is 44 px or more, that its text follows the setting "Text and controls", and what the main
//             control opens: the Household, with no run (it was "Begin vigil", which started a vigil, until Stage 2
//             gave every vigil a character of the Household). On a phone upright and on its side (with a notch), and
//             on a desktop.
//   results   each way a run without a character ends (rung down, spared, died, and ended by hand with no result):
//             the place, the outcome in the design's words, the tally (time, tolls, laid, coin, banked), the buttons
//             and their focus, "Another vigil" and "Back to the title", and the fit on a small screen. The results of
//             a character's vigil are in 52-household.js.
// Each function below runs inside the page (see tests/run.js), so it uses only T, TB and the page itself.

const title = async function () {
  const { UI, Game, Settings, Defs, Plat } = TB;
  const ui = document.getElementById('ui');
  const button = (text) => Array.from(ui.querySelectorAll('.ui-screen:not([inert]) button')).find((b) => b.textContent.trim() === text);
  const screen = () => ui.querySelector('.ui-screen');
  const short = innerHeight < 500;

  T.check('the game opens on the title', Game.state === 'title' && UI.top() === 'title', [Game.state, UI.top()]);
  const name = ui.querySelector('h1'), subs = ui.querySelectorAll('.ui-sub'), notes = ui.querySelectorAll('.ui-note');
  const MAIN = 'The Household';
  const emblem = ui.querySelector('.scr-emblem canvas'), begin = button(MAIN), settings = button('Settings');
  T.check('the title names the game in its heading', !!name && name.textContent === 'Tollbound', name && name.textContent);
  T.check('one line of subtitle', subs.length === 1 && subs[0].textContent.length > 20 && !/\n/.test(subs[0].textContent), subs.length && subs[0].textContent);
  T.check('the emblem is a glyph painted by code', !!emblem && emblem.dataset.glyph === 'mark.bell' && emblem.width > 0);
  T.check('the emblem gives way on a short screen and shows on a tall one', short ? getComputedStyle(emblem.parentNode).display === 'none' : emblem.getBoundingClientRect().height > 30,
    emblem && emblem.getBoundingClientRect().height);
  T.check('the build line is the one note, and names the build, the view and the storage', notes.length === 1 &&
    /^Build \d+\.\d+\.\d+ · .+ · .+$/.test(notes[0].textContent) && notes[0].textContent.includes(Game.VERSION), notes.length && notes[0].textContent);
  T.check('"' + MAIN + '" is the main control, with focus', !!begin && begin.classList.contains('primary') && document.activeElement === begin);
  if (typeof Settings.open === 'function') {
    const a = begin.getBoundingClientRect(), b = settings ? settings.getBoundingClientRect() : null;
    T.check(short ? 'Settings stands beside "' + MAIN + '" on a short screen' : 'Settings stands under "' + MAIN + '"',
      !!b && (short ? Math.abs(b.top - a.top) < 2 && b.left > a.right : b.top > a.bottom), b && [a.top, a.bottom, b.top, b.left]);
  }
  const controls = Array.from(ui.querySelectorAll('button'));
  T.check('every control is at least 44 px high and wide', controls.length >= 1 && controls.every((c) => c.getBoundingClientRect().height >= 44 && c.getBoundingClientRect().width >= 44),
    controls.map((c) => Math.round(c.getBoundingClientRect().height)));
  const s = screen(), nb = name.getBoundingClientRect();
  T.check('the title fits the window: nothing scrolls and nothing sticks out', s.scrollHeight <= innerHeight && s.scrollWidth <= innerWidth && nb.left >= 0 && nb.right <= innerWidth,
    [s.scrollWidth, s.scrollHeight, innerWidth, innerHeight]);
  const pad = getComputedStyle(s);
  T.check('it keeps clear of the notch', controls.every((c) => {
    const r = c.getBoundingClientRect();
    return r.left >= parseFloat(pad.paddingLeft) - 0.5 && r.right <= innerWidth - parseFloat(pad.paddingRight) + 0.5;
  }), [pad.paddingLeft, pad.paddingRight]);
  const at = document.elementFromPoint(40, 300);
  T.check('the place the smoke test taps (40, 300) holds no control', !at || !at.closest('button'), at && at.outerHTML.slice(0, 60));
  T.check('Escape and back leave the title open', UI.back() === false && UI.top() === 'title');

  // ---- the text follows the setting "Text and controls" ----
  const size = (el) => parseFloat(getComputedStyle(el).fontSize);
  const before = [size(subs[0]), size(begin)];
  Settings.set('ui.scale', 1.4);
  const after = [size(subs[0]), size(begin)];
  T.check('the subtitle and the buttons grow with the setting', after[0] > before[0] * 1.3 && after[1] > before[1] * 1.3, [before, after]);
  const tall = Array.from(ui.querySelectorAll('button')).every((c) => c.getBoundingClientRect().height >= 44);
  Settings.set('ui.scale', 0.85);
  const small = Array.from(ui.querySelectorAll('button')).every((c) => c.getBoundingClientRect().height >= 44);
  T.check('and the controls stay 44 px or more at the smallest and the largest', tall && small);
  Settings.set('ui.scale', 1);

  // ---- the settings, and back ----
  if (settings) {
    settings.focus();
    settings.click();
    T.check('Settings opens the settings over the title', UI.top() === 'settings');
    UI.back();
    T.check('and back returns to the title, with focus on the button', UI.top() === 'title' && document.activeElement === settings);
    begin.focus();
  }

  // ---- what "The Household" opens ----
  const states = [];
  const off = Plat.on('state', (now, was) => states.push(was + ' > ' + now));
  begin.click();
  off();
  T.check('"' + MAIN + '" opens the Household and closes the title, with no run', Game.state === 'household' && UI.top() === 'household' && Game.S === null &&
    !UI.isOpen('title') && states.join() === 'title > household', states);
  T.check('where a character can be made: the classes open to a new one are there', !!Game.save && TB.Char.classes(Game.save).length > 0 &&
    (!Defs.has('class', 'change-ringer') || TB.Char.classes(Game.save).includes('change-ringer')), Game.save && TB.Char.classes(Game.save));
  Game.title();
  T.check('Game.title brings the title back, with focus on "' + MAIN + '"', UI.top() === 'title' && document.activeElement === button(MAIN));
  return T.done();
};

const results = async function () {
  const { UI, Game, Sim, Defs } = TB;
  const ui = document.getElementById('ui');
  const button = (text) => Array.from(ui.querySelectorAll('.ui-screen:not([inert]) button')).find((b) => b.textContent.trim() === text);
  const tally = () => {
    const out = {};
    for (const c of ui.querySelectorAll('.scr-cell')) out[c.dataset.tally] = c.querySelector('.scr-v').textContent;
    return out;
  };
  const dial = Defs.has('zone', 'dial');
  const vigil = () => (dial && typeof TB.Player.classRun === 'function' && Defs.has('class', 'change-ringer')
    ? Game.start(Object.assign({ zone: 'dial', seed: 21 }, TB.Player.classRun('change-ringer')))
    : dial ? Game.start({ zone: 'dial', seed: 21 }) : Game.start({ seed: 21 }));

  // ---- rung down: the command to leave ----
  let S = vigil();
  Game.sim(3);
  S.kills = 17;                       // the tally reads what the run says: a few laid, some coin carried and banked
  S.coin = 12;
  S.bank.coin = 30;
  Game.command({ type: 'leave' });
  await T.until(() => Game.state === 'results');
  let words = ui.textContent;
  const back = button('Back to the title'), again = button('Another vigil');
  T.check('the results open when the vigil has ended', Game.state === 'results' && UI.top() === 'results' && Game.S === S && S.result.outcome === 'left');
  T.check('they name the vigil and its place', /The vigil of /.test(words) && ui.querySelector('.scr-kicker').textContent === 'The vigil of ' + (/^The /.test(S.zone.name) ? 'the ' + S.zone.name.slice(4) : S.zone.name),
    ui.querySelector('.scr-kicker').textContent);
  T.check('they say how it ended, in the design\'s words', ui.querySelector('h2').textContent === 'Rung down' && words.includes('You rang down and left by the lychgate.'), words.slice(0, 200));
  const t = tally();
  T.check('the tally gives time, tolls, laid, coin and banked, from the result', t.time === Math.floor(S.result.time / 60) + ':' + String(Math.floor(S.result.time) % 60).padStart(2, '0') &&
    t.tolls === String(S.result.tolls) && t.laid === '17' && t.coin === '12' && t.banked === '30' && /Time \d+:\d\d/.test(words), t);
  T.check('what was banked is marked as kept', ui.querySelector('[data-tally="banked"]').classList.contains('is-kept') && !ui.querySelector('[data-tally="coin"]').classList.contains('is-lost'));
  T.check('two ways on: back to the title (with focus) and another vigil', !!back && !!again && document.activeElement === back && back.classList.contains('primary'));
  T.check('the results are not closed by Escape', UI.back() === false && UI.top() === 'results');
  const panel = ui.querySelector('.scr-results').getBoundingClientRect(), screen = ui.querySelector('.ui-screen');
  T.check('the results fit the window', panel.left >= 0 && panel.right <= innerWidth && screen.scrollHeight <= innerHeight && screen.scrollWidth <= innerWidth,
    [panel.left, panel.right, screen.scrollHeight, innerHeight]);
  T.check('their controls are at least 44 px high', Array.from(ui.querySelectorAll('button')).every((b) => b.getBoundingClientRect().height >= 44));

  // ---- another vigil: the same kind, with a new run ----
  again.click();
  const next = Game.S;
  T.check('"Another vigil" starts a new run of the same zone and class', Game.state === 'run' && !!next && next !== S && next.phase === 'play' &&
    next.zone.id === S.zone.id && next.cfg.class === S.cfg.class && (next.debug === null) === (S.debug === null), next && [next.zone.id, next.cfg.class]);

  // ---- died: the haul is lost ----
  S = next;
  Game.sim(1);
  S.coin = 9;
  Sim.end(S, 'died');
  await T.until(() => Game.state === 'results');
  words = ui.textContent;
  T.check('a death is told as joining the dead', ui.querySelector('h2').textContent === 'Joined the dead' && words.includes('You fell, and joined the dead of the district.') && /vigil/i.test(words), words.slice(0, 160));
  T.check('and the coin carried is marked as lost', ui.querySelector('[data-tally="coin"]').classList.contains('is-lost') && tally().coin === '9');
  button('Back to the title').click();
  T.check('"Back to the title" leads there and drops the run', Game.state === 'title' && UI.top() === 'title' && Game.S === null);

  // ---- spared ----
  S = vigil();
  Game.sim(1);
  Sim.end(S, 'spared');
  await T.until(() => Game.state === 'results');
  T.check('spared: alive, the haul lost', ui.querySelector('h2').textContent === 'Spared' && ui.textContent.includes('Tolled-for, you reached the lychgate in time. You live; your haul is lost.'));

  // ---- a run ended by hand, with no result ----
  Game.title();
  S = Game.start({ seed: 22 });
  Game.sim(2);
  S.phase = 'ended';
  await T.until(() => Game.state === 'results');
  words = ui.textContent;
  T.check('a run that ended without a result still has its results, from the run itself', UI.top() === 'results' && S.result === null &&
    ui.querySelector('h2').textContent === 'Over' && /Time 0:02/.test(words) && /vigil/i.test(words), words.slice(0, 160));
  button('Another vigil').click();
  // The title began this before Stage 2 ("Begin vigil"); now it leads to the Household, and only a run without a
  // character still begins it: the vigil of the Dial with the Change-ringer, or the debug scene without the Dial.
  const ringer = typeof TB.Player.classRun === 'function' && Defs.has('class', 'change-ringer'), R = Game.S;
  T.check('after a debug scene "Another vigil" begins a vigil without a character: of the Dial, kept by a Change-ringer once both are in the build',
    Game.state === 'run' && !!R && R !== S && !R.cfg.char && (!dial || (R.zone.id === 'dial' && R.debug === null)) &&
    (!dial || !ringer || (R.cfg.class === 'change-ringer' && R.skills.length > 0)), R && [R.zone.id, R.cfg.class]);
  Game.title();
  return T.done();
};

module.exports = [
  { name: 'screens: title, phone 390x844', viewport: { width: 390, height: 844 }, mobile: true, query: 'view=2d', run: title },
  { name: 'screens: title, phone on its side 844x390, with a notch', viewport: { width: 844, height: 390 }, mobile: true, query: 'view=2d',
    safeArea: { top: 0, right: 47, bottom: 21, left: 47 }, run: title },
  { name: 'screens: title, desktop 1280x720', viewport: { width: 1280, height: 720 }, mobile: false, query: 'view=2d', run: title },
  { name: 'screens: results, phone 390x844', viewport: { width: 390, height: 844 }, mobile: true, query: 'view=2d', run: results },
  { name: 'screens: results, phone on its side 844x390', viewport: { width: 844, height: 390 }, mobile: true, query: 'view=2d', run: results },
  { name: 'screens: results, desktop 960x540', viewport: { width: 960, height: 540 }, mobile: false, query: 'view=2d', run: results },
];
