// tests/scenarios/50-hud.js: the HUD of a vigil (71-hud.js) and the icons it draws with (62-glyphs.js).
//   reads     the HUD reads the run: life, wounds and scars against life-max (and the colours it draws them in),
//             Heed, the row of favours as it closes up, swaps and stands, the toll's ring in its last seconds, the
//             quarter ticks and the toll's mark, the count as marks when the setting asks, the lychgate's marker,
//             Tolled-for's grey screen and its time, the haul; and a run whose slots are missing, with no error
//   layout    where it stands at a phone's two shapes and on a desktop: in the safe area, clear of the middle, of
//             the touch controls (for both hands), sized by "Text and controls"; the buttons A and B through
//             Input.button, and the disc that stands in for A where there are no touch buttons
//   glyphs    the icon painter: a canvas for every recipe and a token for an unknown id, the cache, Glyphs.pick
// A vigil of the Dial with the Change-ringer is used where the build has it; until then a debug scene, with the
// slots the vigil's files will fill set by hand. Where the sim must stand still while the HUD is looked at, a test
// screen that pauses (and dims nothing) holds it. Each function below runs inside the page (see tests/run.js).

const reads = async function () {
  const { Game, Sim, Hud, Settings, Plat, Defs, Stats, UI } = TB;
  const st = Hud.stats;
  const frames = (n) => new Promise((done) => { let left = n; const off = Plat.on('frame', () => { if (--left <= 0) { off(); done(); } }); });
  const near = (a, b, eps) => Math.abs(a - b) <= (eps === undefined ? 1e-9 : eps);
  const canvas = document.querySelector('#hud .hud-canvas'), grey = document.querySelector('#hud .hud-grey');
  const pixel = (x, y) => {
    const k = canvas.width / innerWidth, d = canvas.getContext('2d').getImageData(Math.floor(x * k), Math.floor(y * k), 1, 1).data;
    return [d[0], d[1], d[2], d[3]];
  };
  const like = (p, q, eps) => Math.abs(p[0] - q[0]) <= eps && Math.abs(p[1] - q[1]) <= eps && Math.abs(p[2] - q[2]) <= eps;
  UI.screen('test.hold', { pause: true, scrim: false, open: () => UI.h('div', { 'aria-hidden': 'true' }) });
  const hold = () => UI.open('test.hold');
  const release = () => UI.close('test.hold');

  T.check('the HUD has its canvas and the grey of Tolled-for in #hud, and takes no input', !!canvas && !!grey &&
    getComputedStyle(canvas).pointerEvents === 'none' && getComputedStyle(grey).pointerEvents === 'none' && canvas.parentNode.id === 'hud');
  T.check('nothing shows on the title', st.shown === false && Game.state === 'title');

  // ---- a vigil, as the title begins one; its first half second played, so that the row is filled and counted ----
  const ringer = Defs.has('zone', 'dial') && typeof TB.Player.classRun === 'function' && Defs.has('class', 'change-ringer');
  let S = ringer ? Game.start(Object.assign({ zone: 'dial', seed: 11 }, TB.Player.classRun('change-ringer'))) : Game.start({ seed: 11 });
  Game.sim(0.5);
  hold();
  await frames(3);
  T.check('a run puts the HUD up and draws it', st.shown === true && st.frames > 0 && st.drawn > 0, [st.shown, st.frames, st.drawn]);
  T.check('the life bar reads life against life-max', near(st.life, S.player.life) && near(st.max, S.sheet.stats['life-max']) && st.max > 0, [st.life, st.max]);
  T.check('the Heed bar reads heed-max, all of it free', near(st.heed, S.sheet.stats['heed-max']) && near(st.heedFree, st.heed) && st.heed > 0, [st.heed, st.heedFree]);
  const cls = S.cfg.class && Defs.has('class', S.cfg.class) ? Defs.get('class', S.cfg.class) : null;
  T.check('the life bar is drawn in the class colour (the first of its palette; the accent without a class)', /^rgba\(\d+, \d+, \d+, 1\)$/.test(st.colour) &&
    (!cls || st.colour === 'rgba(' + cls.palette[0].match(/[0-9a-f]{2}/gi).map((h) => parseInt(h, 16)).join(', ') + ', 1)'), [st.colour, cls && cls.palette]);
  const b = st.block, y = b.y + Math.round(b.lifeH * 0.6), lifeColour = pixel(b.barX + 3, y);
  const want = st.colour.match(/\d+/g).map(Number);
  T.check('and the pixels of the bar are that colour', like(lifeColour, want, 8), [lifeColour, want]);
  if (S.row && S.row.filled) {
    T.check('the row the vigil filled is drawn as it stands, each favour by its own motif', st.row.join() === S.row.ids.map((id) => id || '').join() &&
      st.raised === S.row.raised && st.row.every((id) => id === '' || TB.Glyphs.has(Defs.get('favour', id).icon)), [st.row, S.row.ids]);
  }
  if (typeof TB.Director.step === 'function' && S.debug === null) {
    T.check('the count the vigil gave at its start is heard', [3, 6, 9].includes(st.count.tellers) && st.count.on === false && st.count.marks === 0, st.count);
  }

  // a Blow through the combat's own rule: the life it takes, and the wound it opens where the player stands
  if (typeof TB.Dmg.hitPlayer === 'function' && S.wounds) {
    const life0 = S.player.life, held0 = st.wounds;
    const lost = TB.Dmg.hitPlayer(S, { type: 'blow', mult: 1, id: 'test.blow' }, { damage: 9, x: S.player.x + 1, y: S.player.y }, 1, 0.5);
    await frames(2);
    let inWounds = 0;
    for (let k = 0; k < S.wounds.n; k++) inWounds += S.wounds.life[k];
    T.check('a Blow taken through Dmg.hitPlayer is drawn: less life, and as much more lying in a wound', lost > 0 && near(st.life, life0 - lost, 1e-6) &&
      near(st.wounds, held0 + lost, 1e-6) && near(st.wounds, inWounds, 1e-6) && st.woundN === S.wounds.n, [lost, st.life, st.wounds, st.woundN]);
  }

  // life lost, a wound, a scar
  const max = S.sheet.stats['life-max'];
  S.player.life = Math.round(max * 0.5);
  const w = S.wounds && S.wounds.life ? S.wounds : (S.wounds = { n: 0, x: [], y: [], life: [], depth: [], opened: [], back: [], scarred: 0 });
  const before = { n: w.n, scarred: w.scarred };
  const i = w.n;
  w.x[i] = S.player.x;
  w.y[i] = S.player.y;
  w.life[i] = 7;
  w.depth[i] = 0.5;
  w.opened[i] = S.t;
  if (w.back) w.back[i] = 0;
  w.n = i + 1;
  w.scarred = (w.scarred || 0) + 4;
  await frames(2);
  T.check('lost life is drawn as it falls', near(st.life, Math.round(max * 0.5)), st.life);
  T.check('the life lying in a wound is drawn after it, one segment for the wound', st.woundN >= 1 && st.wounds >= 7 - 1e-9, [st.woundN, st.wounds]);
  T.check('scars are drawn as the dark end', near(st.scars, before.scarred + 4), st.scars);
  const k = b.bar / (st.max + st.scars);
  const lifePx = pixel(b.barX + st.life * k / 2, y), woundPx = pixel(b.barX + (st.life + 3.5) * k, y), scarPx = pixel(b.barX + b.bar - 2, y);
  T.check('life, wound and scar are three colours: the class, its pale, the dark', like(lifePx, lifeColour, 6) && !like(woundPx, lifePx, 20) && !like(scarPx, woundPx, 20) &&
    scarPx[0] + scarPx[1] + scarPx[2] < woundPx[0] + woundPx[1] + woundPx[2], { life: lifePx, wound: woundPx, scar: scarPx });
  w.n = before.n;
  w.scarred = before.scarred;

  // Tolled-for: the grey screen (the scene's, keeping what glows, where the build's scene greys; else the HUD's own),
  // and the time left in place of life
  const row = Stats.AILMENT['tolled-for'];
  const sceneGreys = typeof TB.Scene.draw === 'function' && !!TB.Scene.stats && typeof TB.Scene.stats.grey === 'number';
  S.player.condT[row] = 20;
  await frames(3);
  T.check(sceneGreys ? 'Tolled-for greys the screen: the scene greys the world, and the HUD lays no grey over its lit lychgate'
    : 'Tolled-for greys the screen: the HUD lays its own grey under it', st.tolledFor === true && (sceneGreys
    ? st.greyBy === 'view' && TB.Scene.stats.grey > 0 && !grey.classList.contains('is-on')
    : st.greyBy === 'hud' && grey.classList.contains('is-on')), [st.greyBy, sceneGreys && TB.Scene.stats.grey]);
  const greyed = grey.classList.contains('is-on');
  grey.classList.add('is-on');
  T.check('the HUD\'s own grey is a backdrop filter that takes the colour out', /grayscale/.test(getComputedStyle(grey).backdropFilter || getComputedStyle(grey).webkitBackdropFilter) &&
    getComputedStyle(grey).visibility === 'visible', getComputedStyle(grey).backdropFilter);
  grey.classList.toggle('is-on', greyed);
  S.player.condT[row] = 10;
  await frames(2);
  T.check('and the bar shows the time left before the toll', near(st.timeLeft, 0.5, 0.02), st.timeLeft);
  S.gate = { x: S.player.x - 80, y: S.player.y + 5, until: S.t + 20, far: true, ring: 0, strokes: 0 };
  await frames(2);
  const g = st.gate;
  T.check('the far lychgate is marked at the edge, towards it', g.shown && g.far && !g.onScreen && g.x < innerWidth * 0.3 && g.x > 0 && g.y > 0 && g.y < innerHeight, g);
  S.player.condT[row] = 0;
  S.gate = null;
  await frames(2);
  T.check('the grey lifts when Tolled-for ends', st.tolledFor === false && st.greyBy === '' && !grey.classList.contains('is-on') && !st.gate.shown);
  release();
  Game.title();
  await frames(1);
  T.check('the HUD goes when the run does', st.shown === false && !grey.classList.contains('is-on'));

  // ---- the toll: a debug scene, whose clock is the kernel's own ----
  S = Game.start({ seed: 12 });
  Game.sim(S.tollSteps / 60 - 1.6);
  hold();
  await frames(2);
  T.check('in the last 3 s before a toll the ring closes round the edge', st.ring > 0.3 && st.ring < 0.75 && st.quarters === 3, [st.ring, st.quarters]);
  release();
  await T.until(() => S.toll === 1, 8000);
  hold();
  await frames(2);
  T.check('at the toll the ticks clear and the toll\'s mark shows', S.toll === 1 && st.tollMark === true && st.quarters === 0 && (st.ring === 1 || st.ring === 0), [st.ring, st.quarters, st.tollMark]);
  release();
  const quarter = S.tollSteps / 4 / 60;
  Game.sim(quarter + 0.2);
  await frames(2);
  T.check('a quarter of the interval on, its tick shows', st.quarters === 1 && st.ring === 0, st.quarters);
  Game.sim(quarter);
  await frames(2);
  T.check('and another at the half', st.quarters === 2, st.quarters);

  // the count, drawn as marks when the setting asks
  T.check('the setting for the count is defined, and off at first', Settings.get('hud.count') === false && Settings.keys().includes('hud.count'));
  Sim.emit(S, 'count', S.player.x, S.player.y, 9, 2, 'gate');
  Plat.emit('step', S, false);
  await frames(2);
  T.check('the count is heard but not drawn while the setting is off', st.count.on === false && st.count.marks === 0 && st.count.tellers === 9 && st.count.elites === 2 && st.count.gate === true, st.count);
  Settings.set('hud.count', true);
  await T.until(() => st.count.marks === 12, 8000);
  T.check('with the setting on, its marks come out in the hand-bell\'s rhythm: nine, two, the lychgate', st.count.on === true && st.count.marks === 12, st.count);
  Settings.set('hud.count', false);
  await frames(2);
  T.check('and go when it is turned off', st.count.marks === 0);

  // the row: as it stands, as it swaps, as an offer stands
  const known = Defs.all('favour').map((f) => f.id);
  const ids = known.length >= 6 ? known.slice(0, 6) : ['test.one', 'test.two', 'test.three', 'test.four', 'test.five', 'test.six'];
  hold();
  if (!S.row) S.row = { ids: ids.slice(), raised: 3, levels: 0, shapes: [], until: 0 };
  await frames(2);
  T.check('the row is drawn in its places, the first raised', st.row.join() === S.row.ids.slice(0, 6).join() && st.raised === S.row.raised, [st.row, st.raised]);
  const was = S.row.ids.slice();
  S.row.ids = [was[1], was[0], was[3], was[2], was[5], was[4]];
  S.row.raised = 4;
  await frames(2);
  T.check('it follows the row as it swaps', st.row.join() === S.row.ids.join() && st.raised === 4, st.row);
  const drawnBefore = st.drawn;
  await frames(6);
  T.check('and slides there, drawing as it moves', st.drawn > drawnBefore, [drawnBefore, st.drawn]);
  S.row.shapes = [1, 2, 3];
  S.row.until = S.t + 6;
  S.favours[S.row.ids[0]] = 2;
  await frames(2);
  T.check('an offer standing in the world is shown on the row, with the times its favours were taken', st.standing === true && st.pips >= 2, [st.standing, st.pips]);
  S.row.shapes = [];
  release();

  // the lychgate of an ordinary opening: marked only while off screen
  S.gate = { x: S.player.x + 0.5, y: S.player.y, until: S.t + 25, far: false, ring: 0, strokes: 0 };
  await frames(2);
  T.check('an open lychgate on screen is left to the scene', st.gate.onScreen === true && st.gate.shown === false && st.gate.far === false, st.gate);
  S.gate.x = S.player.x + 90;
  await frames(2);
  T.check('off screen it is marked at the edge towards it', st.gate.shown && !st.gate.onScreen && st.gate.x > innerWidth * 0.7, st.gate);
  S.gate = null;

  // ---- a run whose slots are missing: a build without the vigil's or the combat's files ----
  // A listener that throws is reported by Plat with console.error, which is held back here and counted.
  const errors = [], real = console.error;
  console.error = (...args) => errors.push(args.map(String).join(' ').slice(0, 200));
  const drawn = st.drawn;
  try {
    for (const bare of [
      { player: { life: 5, x: 0, y: 0 }, cfg: {}, step: 10, t: 0.16, toll: 0, tollAt: 4500, tollSteps: 4500, debug: null },
      { player: {}, cfg: null, debug: null },
      { player: { life: 3, condT: new Float64Array(16) }, cfg: { class: 'nobody' }, sheet: { stats: {} }, row: { ids: null }, wounds: { n: 3 }, gate: {}, haul: null, debug: null },
    ]) Plat.emit('frame', bare, 1, 1 / 60);
  } finally {
    console.error = real;
  }
  T.check('a run with its slots missing is drawn without an error', errors.length === 0 && st.drawn >= drawn + 1 && st.row.length === 0 && st.woundN === 0, errors);
  await frames(2);
  T.check('and the next frame is the real run again', st.shown === true && near(st.life, Game.S.player.life));
  Game.title();
  return T.done();
};

const layout = async function () {
  const { Game, Hud, Settings, Plat, Defs, Input, UI } = TB;
  const st = Hud.stats, phone = innerWidth < innerHeight ? innerWidth < 600 : innerHeight < 600;
  const touch = !!document.querySelector('#touch .tc') && navigator.maxTouchPoints > 0;
  const frames = (n) => new Promise((done) => { let left = n; const off = Plat.on('frame', () => { if (--left <= 0) { off(); done(); } }); });
  const box = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
  const meet = (p, q) => p.l < q.r && q.l < p.r && p.t < q.b && q.t < p.b;
  const cs = getComputedStyle(document.getElementById('hud'));
  const edge = { l: parseFloat(cs.paddingLeft), t: parseFloat(cs.paddingTop), r: innerWidth - parseFloat(cs.paddingRight), b: innerHeight - parseFloat(cs.paddingBottom) };
  const blockBox = () => ({ l: st.block.x, t: st.block.y, r: st.block.x + st.block.w, b: st.block.y + st.block.h });
  const middle = { l: innerWidth * 0.25, t: innerHeight * 0.3, r: innerWidth * 0.75, b: innerHeight * 0.7 };
  UI.screen('test.hold', { pause: true, scrim: false, open: () => UI.h('div', { 'aria-hidden': 'true' }) });

  const ringer = Defs.has('zone', 'dial') && typeof TB.Player.classRun === 'function' && Defs.has('class', 'change-ringer');
  const S = ringer ? Game.start(Object.assign({ zone: 'dial', seed: 31 }, TB.Player.classRun('change-ringer'))) : Game.start({ seed: 31 });
  if (!S.row) S.row = { ids: ['test.one', 'test.two', 'test.three', 'test.four', 'test.five', 'test.six'], raised: 3, levels: 0, shapes: [], until: 0 };
  Settings.set('hud.count', true);
  TB.Sim.emit(S, 'count', 0, 0, 9, 3, 'gate');
  Plat.emit('step', S, false);
  await T.until(() => st.count.marks === 13, 8000);
  await frames(2);
  const block = blockBox();
  T.check('the corner block keeps inside the safe area', block.l >= edge.l - 0.5 && block.t >= edge.t - 0.5 && block.r <= edge.r + 0.5 && block.b <= edge.b, [block, edge]);
  T.check('it stands in a top corner and leaves the middle of the screen clear', block.t < innerHeight * 0.1 && !meet(block, middle) && block.b < innerHeight * (phone && innerHeight < innerWidth ? 0.4 : 0.25),
    [block, middle]);
  T.check('it stands on the stick\'s side: the left, for the right hand', block.l < innerWidth / 2 && block.r < innerWidth - 44, block);

  // the touch controls: shown by a touch on a phone (and hidden while a screen pauses, so nothing is held here)
  if (touch) {
    const view = document.getElementById('view');
    view.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 41, pointerType: 'touch', isPrimary: true, clientX: innerWidth * 0.25, clientY: innerHeight * 0.62, bubbles: true, cancelable: true }));
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 41, pointerType: 'touch', clientX: innerWidth * 0.25, clientY: innerHeight * 0.62, bubbles: true }));
    await frames(3);
    const root = document.querySelector('#touch .tc'), parts = ['.tc-a', '.tc-b', '.tc-pause'].map((s) => root.querySelector(s)).filter((el) => !el.hidden);
    const clash = parts.filter((el) => meet(blockBox(), box(el))).map((el) => el.className);
    T.check('the touch controls are up, and the block meets none of them', !root.hidden && clash.length === 0, clash);
    const stick = { l: 0, t: innerHeight * 0.55, r: innerWidth * 0.5, b: innerHeight };
    T.check('nor the stick\'s lower half of its side', !meet(blockBox(), stick));
    T.check('the disc that stands in for button A is not drawn while the touch buttons are', st.disc.shown === false);
    Settings.set('input.hand', 'left');
    await frames(3);
    const left = blockBox(), parts2 = ['.tc-a', '.tc-b', '.tc-pause'].map((s) => root.querySelector(s)).filter((el) => !el.hidden);
    T.check('for the left hand the block stands against the right edge, clear of the controls that moved left', Math.abs(left.r - edge.r) < 1 &&
      left.l > box(root.querySelector('.tc-pause')).r && parts2.every((el) => !meet(left, box(el))), [left, edge.r, parts2.map((el) => box(el))]);
    T.check('and its bars keep the corner', Math.abs(st.block.barX + st.block.bar - edge.r) < 1, [st.block.barX, st.block.bar, edge.r]);
    Settings.set('input.hand', 'right');
    await frames(2);
  }

  // "Text and controls" sizes the HUD as it sizes the text
  const w1 = st.block.w, h1 = st.block.h;
  Settings.set('ui.scale', 1.4);
  await frames(3);
  const w2 = st.block.w, h2 = st.block.h, big = blockBox();
  T.check('a larger "Text and controls" makes the HUD larger, and it still keeps clear of the middle', h2 > h1 * 1.25 && w2 >= w1 && !meet(big, middle) && big.r <= edge.r + 0.5,
    [w1, h1, w2, h2]);
  Settings.set('ui.scale', 1);
  await frames(2);

  // the buttons (the run stands still for them: the trade's recharge would run down)
  const btnA = document.querySelector('#touch .tc-a'), btnB = document.querySelector('#touch .tc-b');
  UI.open('test.hold');
  if (btnA && S.debug === null) {
    const cls = S.cfg.class && Defs.has('class', S.cfg.class) ? Defs.get('class', S.cfg.class) : null;
    if (cls) {
      const icon = btnA.querySelector('.tc-icon canvas');
      T.check('button A wears the trade\'s glyph and name', !!icon && icon.dataset.glyph === st.trade.icon && TB.Glyphs.has(st.trade.icon) && btnA.getAttribute('aria-label') === cls.trade.name,
        [icon && icon.dataset.glyph, st.trade.icon, btnA.getAttribute('aria-label')]);
      const full = cls.trade.recharge * S.sheet.stats['trade-recharge'] / 100;
      S.player.tradeCd = full / 2;
      await frames(2);
      const cd = parseFloat(btnA.querySelector('.tc-sweep').style.getPropertyValue('--tc-cd'));
      T.check('and its recharge as a wedge: half of it still to run', Math.abs(st.trade.cooldown - 0.5) < 0.02 && Math.abs(cd - 0.5) < 0.03, [st.trade.cooldown, cd]);
      S.player.tradeCd = 0;
      await frames(2);
      T.check('ready again, the wedge is gone', st.trade.ready === true && parseFloat(btnA.querySelector('.tc-sweep').style.getPropertyValue('--tc-cd')) === 0);
    } else {
      T.check('without a class there is no trade, and button A is hidden', btnA.hidden === true);
    }
    T.check('button B is hidden while there is nothing to heave', btnB.hidden === true && st.heave.hidden === true && S.haul.length === 0);
    S.haul.push({ uid: 9001, lines: [{}, {}] });     // a find, as Stage 2 will carry them: the run stands still meanwhile
    await frames(2);
    T.check('with a find carried, the haul is drawn as a box and B comes back with the heave\'s glyph', st.haul === 1 && btnB.hidden === false &&
      st.heave.hidden === false && btnB.querySelector('.tc-icon canvas').dataset.glyph === 'mark.heave' && btnB.getAttribute('aria-label') === 'Heave');
    S.haul.length = 0;
    await frames(2);
    T.check('and goes again when the haul is empty', st.haul === 0 && btnB.hidden === true);
  }
  if (!touch && st.trade.id) {
    T.check('on a desktop a disc stands in for button A, in the lower corner on the buttons\' side', st.disc.shown === true && st.disc.x > innerWidth / 2 && st.disc.y > innerHeight / 2 &&
      st.disc.x + st.disc.r <= edge.r + 0.5 && st.disc.y + st.disc.r <= edge.b + 0.5, st.disc);
  }
  UI.close('test.hold');
  Game.title();
  Settings.set('hud.count', false);

  // a debug scene puts the buttons back to their plain look and leaves them to whoever drives it
  if (btnA) {
    const D = Game.start({ seed: 32 });
    await frames(3);
    T.check('a debug scene shows both buttons plain', D.debug !== null && btnA.hidden === false && btnB.hidden === false && btnA.querySelector('.tc-icon').textContent === 'A');
    Input.button('A', { icon: 'Z' });
    await frames(3);
    T.check('and does not take them back from a test that sets them', btnA.querySelector('.tc-icon').textContent === 'Z');
    Input.button('A', { icon: null });
    Game.title();
  }
  return T.done();
};

const glyphs = async function () {
  const { Glyphs } = TB;
  const ids = Glyphs.ids();
  const want = ['trade.set', 'trade.turn-about', 'trade.plant', 'trade.long-pole', 'trade.gust', 'trade.close', 'mark.lychgate', 'mark.heave', 'mark.find', 'mark.bell'];
  T.check('there is a recipe for the trade of every class and for every mark', want.every((id) => Glyphs.has(id)), want.filter((id) => !Glyphs.has(id)));
  const inked = (c) => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
    return n / (c.width * c.height);
  };
  const empty = ids.filter((id) => { const c = Glyphs.icon({ id, size: 32, dpr: 1 }); return !(inked(c) > 0.08 && inked(c) < 0.9); });
  T.check('every recipe paints a shape: neither an empty square nor a filled one', empty.length === 0, empty);
  const icon = Glyphs.icon({ id: 'trade.set', size: 40, dpr: 2 });
  T.check('Glyphs.icon gives a new canvas, sized in CSS px, sharp for the pixel ratio', icon.tagName === 'CANVAS' && icon.width === 80 && icon.style.width === '40px' &&
    icon.dataset.glyph === 'trade.set' && Glyphs.icon('trade.set') !== Glyphs.icon('trade.set'));
  const a = Glyphs.image({ id: 'mark.find', size: 24, dpr: 2 }), b = Glyphs.image({ id: 'mark.find', size: 24, dpr: 2 }), c = Glyphs.image({ id: 'mark.find', size: 24, dpr: 2, ink: '#ff0000' });
  T.check('Glyphs.image keeps one canvas for each id, ink and size', a === b && a !== c && a.width === 48);
  const u1 = Glyphs.icon({ id: 'favour.never-seen', size: 32, dpr: 1 }), u2 = Glyphs.icon({ id: 'favour.not-this-either', size: 32, dpr: 1 });
  const same = u1.getContext('2d').getImageData(0, 0, 32, 32).data.join() === u2.getContext('2d').getImageData(0, 0, 32, 32).data.join();
  T.check('an id with no recipe is painted as a token, and two such ids look different', inked(u1) > 0.05 && inked(u2) > 0.05 && !same);
  T.check('Glyphs.pick takes the first id with a recipe, else the first given', Glyphs.pick('nope', 'trade.set') === 'trade.set' && Glyphs.pick('nope', 'no.more') === 'nope' &&
    Glyphs.slug('Funeral Biscuit') === 'funeral-biscuit');
  let refused = '';
  try { Glyphs.define('trade.set', () => {}); } catch (e) { refused = e.message; }
  T.check('a recipe cannot be defined twice', /already defined/.test(refused), refused);
  const target = document.createElement('canvas');
  target.width = target.height = 64;
  Glyphs.draw(target.getContext('2d'), { id: 'mark.lychgate', dpr: 2 }, 0, 0, 32);
  T.check('Glyphs.draw paints into another canvas', inked(target) > 0.05);
  return T.done();
};

module.exports = [
  { name: 'hud: reads the run, phone 390x844', viewport: { width: 390, height: 844 }, mobile: true, query: 'view=2d', run: reads, timeout: 180000 },
  { name: 'hud: reads the run, desktop 960x540', viewport: { width: 960, height: 540 }, mobile: false, query: 'view=2d', run: reads, timeout: 180000 },
  { name: 'hud: layout, phone 390x844', viewport: { width: 390, height: 844 }, mobile: true, query: 'view=2d', run: layout },
  { name: 'hud: layout, phone on its side 844x390, with a notch', viewport: { width: 844, height: 390 }, mobile: true, query: 'view=2d',
    safeArea: { top: 0, right: 47, bottom: 21, left: 47 }, run: layout },
  { name: 'hud: layout, desktop 960x540', viewport: { width: 960, height: 540 }, mobile: false, query: 'view=2d', run: layout },
  { name: 'hud: layout, desktop 1280x720 in the 3D view', viewport: { width: 1280, height: 720 }, mobile: false, query: '', run: layout },
  { name: 'hud: glyphs', viewport: { width: 640, height: 480 }, mobile: false, query: 'view=2d', run: glyphs },
];
