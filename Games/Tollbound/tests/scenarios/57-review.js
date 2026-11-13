// tests/scenarios/57-review.js: where the packages of Stage 2 meet in the page.
//   names     a Household whose names are 24 letters with no space in them, with the living and the dead, every pit
//             open, a full chest and a long route: every screen of the hub and every room and view of the Lantern on
//             a phone upright and on its side with a notch, controls of 44 px or more and nothing past the window's
//             edge (a name breaks rather than run off the screen)
//   hud       the haul's boxes are striped with their notches (Char.notches: the lines written, not the eight places),
//             a line written redraws them, and Hand on the Bell's scars join the life bar's dark end
//   ground    what knots and observances leave on the ground, in the buffers of a frame: Stability's ring as far out as
//             its reach round where the last toll found the player, Alms' cairns, Back-splice's figure and Balance's
//             throws standing mouth-up
// The functions below run inside the page (see tests/run.js), so they use only T, TB and the page itself.

const names = async function () {
  const { Game, UI, Char, Bellframe, Items, Sim, Defs, Tree, SaveData } = TB;
  const ui = document.getElementById('ui');
  const top = () => ui.querySelector('.ui-screen:not([inert])');
  const controls = () => Array.from(top().querySelectorAll('button, input, textarea'));
  const small = () => controls().filter((c) => { const r = c.getBoundingClientRect(); return r.width > 0 && (r.height < 44 || r.width < 44); })
    .map((c) => (c.textContent.trim() || c.tagName).slice(0, 30));
  const wide = () => {
    const s = top(), out = [];
    if (s.scrollWidth > innerWidth) out.push('the screen is ' + s.scrollWidth + ' px wide');
    for (const el of s.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && (r.right > innerWidth + 0.5 || r.left < -0.5)) out.push((el.className || el.tagName) + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
    }
    return out.slice(0, 4);
  };
  const look = (what) => { const s = small(), w = wide(); T.check(what + ': controls of 44 px or more, nothing past the edge', s.length === 0 && w.length === 0, { small: s, wide: w }); };
  const cls = Char.classes(Game.save)[0];
  const die = (name) => {
    const c = Game.make(cls, name);
    Game.lantern(c.uid);
    const S = Game.vigil();
    Game.sim(0.5);
    S.cause = { attack: 'dial.clutch', kind: 'blow', toll: 1 };
    S.toll = 1;
    Sim.end(S, 'died');
    Game.sim(0.1);
  };
  die('WWWWWWWWWWWWWWWWWWWWWWWW');
  die('MMMMMMMMMMMMMMMMMMMMMMMM');
  const save = Game.save;
  save.account.hum = 5000;
  save.account.coin = 99999;
  for (const pit of Defs.all('pit')) Bellframe.open(save, pit.id);
  for (let i = 0; i < 7; i++) Bellframe.place(save);
  Bellframe.hang(save, save.account.frame.bells[0].uid, 'tenor');
  const c = Game.make(cls, 'QQQQQQQQQQQQQQQQQQQQQQQQ', [save.account.frame.bells[0].uid]);
  T.check('a character is made with a name of 24 letters and the bell of the dead', !!c);
  if (!c) return T.done();
  while (c.level < 40) Char.gain(c, Char.need(c) - c.xp);
  for (const o of Defs.all('observance')) Char.learn(c, o.id);
  for (const k of Defs.all('knot')) c.knots[k.id] = 3;
  for (const v of Defs.all('voice')) c.voices.push(Char.voice(SaveData.uid(save), v.id));
  c.planPoints = 40;
  for (let i = 0; i < 40; i++) {
    const steps = Tree.steps(c.plan.walk);
    if (!steps.length) break;
    const n = Defs.get('node', steps[steps.length - 1]);
    Char.allocate(c, n.id, n.choice ? n.choice[0] : undefined);
  }
  for (const b of Defs.all('base')) save.chest.finds.push(Items.make(b.id, 1, SaveData.uid(save), 0.9));
  T.check('the Household is sound', SaveData.validate(save).length === 0, SaveData.validate(save).slice(0, 3));
  Game.household();
  look('the Household');
  Game.lantern(c.uid);
  look('the Lantern');
  const views = {
    finds: [['[data-uid]', 'a find'], ['[data-act="recast"]', 'the recast']],
    voices: [['[data-rope="0:0"]', 'a knot place', true], ['[data-place="0"]', 'a place', true]],
    bellframe: [['[data-pit="tenor"]', 'the tenor pit'], ['.bf-floor-btn', 'the floor'], ['.bf-waiting-btn', 'a bell waiting']],
  };
  for (const room of Game.ROOMS) {
    if (!UI.has(room)) continue;
    UI.open(room, { char: Game.char });
    look('the room ' + room);
    for (const [sel, what, back] of views[room] || []) {
      const b = top().querySelector(sel);
      if (!b) continue;
      b.click();
      look(room + ', ' + what);
      if (back) UI.back();
    }
    while (UI.top() !== 'lantern' && UI.top() !== null) UI.back();
  }
  UI.open('save-text');
  look('the save as text');
  Game.title();
  return T.done();
};

const hud = async function () {
  const { Game, Char, Items, Hud, UI } = TB;
  const c = Game.make(Char.classes(Game.save)[0], 'Hester Pell');
  Game.lantern(c.uid);
  const S = Game.vigil();
  T.check('a vigil of the Dial', !!S && Game.state === 'run');
  if (!S) return T.done();
  Game.sim(0.5);
  const a = Items.make('base.oilskin', 1, -(++S.uid), 0.5), b = Items.make('base.sand-glass', 1, -(++S.uid), 0.5);
  S.haul.push(a, b);
  for (const p of ['stood', 'strode', 'pressed']) Items.write({ rng: S.rng, toll: 1, sheet: S.sheet }, a, p);
  const shown = await T.until(() => Hud.stats.haul === 2 && Hud.stats.notches === 3, 4000);
  T.check('the haul: two boxes and three notches, the lines written (not the eight places)', !!shown, [Hud.stats.haul, Hud.stats.notches]);
  const drawn = Hud.stats.drawn;
  Items.write({ rng: S.rng, toll: 2, sheet: S.sheet }, b, 'timed');
  const again = await T.until(() => Hud.stats.notches === 4 && Hud.stats.drawn > drawn, 4000);
  T.check('a line written redraws the haul', !!again, [Hud.stats.notches, Hud.stats.drawn, drawn]);
  const scars0 = Hud.stats.scars;
  S.observances.scarred = 12;
  S.dirty = true;
  const scarred = await T.until(() => Math.abs(Hud.stats.scars - scars0 - 12) < 1e-6, 4000);
  T.check('Hand on the Bell\'s scars join the life bar\'s dark end', !!scarred, [scars0, Hud.stats.scars]);
  UI.clear();
  Game.title();
  return T.done();
};

const ground = async function () {
  const { Game, Char, Plat, Scene, Sim, Stats, Defs, Observances, Items, Gfx } = TB;
  const c = Game.make(Char.classes(Game.save)[0], 'Hester Pell');
  Char.learn(c, 'stability');
  Char.hold(c, 'stability', Game.save.account);
  const voice = c.voices.find((v) => Stats.fits(Defs.get('voice', v.id), Defs.get('knot', 'back-splice')));
  c.knots['back-splice'] = 1;
  T.check('Back-splice is tied into a voice of the loadout', !!voice && Char.tie(c, voice.uid, 0, 'back-splice') && c.loadout.includes(voice.uid));
  Game.lantern(c.uid);
  const S = Game.vigil();
  Plat.stop();
  const p = S.player, slot = c.loadout.indexOf(voice.uid);
  for (let i = 0; i < 3 * 60; i++) Sim.step(S, { mx: i < 90 ? 1 : 0, my: 0, ax: 1, ay: 0, aim: false, trade: false, heave: false });
  const decals = () => { const B = Scene.buffers(), out = []; for (let i = 0; i < B.decalN; i++) out.push(Array.from(B.decals.slice(i * 11, i * 11 + 11))); return out; };
  const near = (a, b, e) => Math.abs(a - b) < (e || 0.05);
  Scene.draw(S, 1);
  const r = S.observances.of.stability, reach = Defs.get('observance', 'stability').params.reach;
  const ring = decals().find((d) => d[8] === Scene.RING && near(d[0], r.x) && near(d[1], r.y) && near(d[2], reach));
  T.check('Stability\'s ring: as far out as its reach, round where the toll found the player', !!ring && Scene.stats.rings === 1, ring && ring.slice(0, 7));
  T.check('Back-splice\'s figure stands where the player stood 2 s ago', S.knots.fig[slot] > 0 && Scene.stats.splices === 1 &&
    decals().some((d) => d[8] === Scene.RING && near(d[0], S.knots.figX[slot]) && near(d[1], S.knots.figY[slot])), [S.knots.fig[slot], Scene.stats.splices]);
  // a cairn of Alms, and a throw of Balance standing mouth-up
  const find = Items.lay(S, Items.make('base.oilskin', 1, -(++S.uid), 0.5), p.x + 1.5, p.y);
  find.state = Observances.CAIRN;
  const shot = S.shots.alloc();
  shot.team = 0; shot.owner = 0; shot.skill = 0; shot.state = 1; shot.ttl = 4; shot.r = 0.12;
  shot.x = shot.px = p.x - 1.5; shot.y = shot.py = p.y; shot.vx = 0; shot.vy = 0;
  const boards0 = (() => { Scene.draw(S, 1); return Scene.stats.billboards; })();
  T.check('a find left as a cairn is drawn as one', Scene.stats.cairns === 1, Scene.stats.cairns);
  T.check('a throw of Balance stands mouth-up on the ground, not as a bolt in the air', Scene.stats.balanced === 1 &&
    decals().some((d) => d[8] === Scene.DISC && near(d[0], shot.x) && near(d[1], shot.y)), [Scene.stats.balanced, boards0]);
  S.observances.broken.stability = true;
  Scene.draw(S, 1);
  const faint = decals().find((d) => d[8] === Scene.RING && near(d[2], reach));
  T.check('a broken promise\'s ring is faint and dark', !!faint && faint[6] <= 0.31 && faint[3] < 0.3, faint && faint.slice(3, 7));
  T.check('the view is the one asked for', !!Gfx.active);
  Game.title();
  return T.done();
};

module.exports = [
  { name: 'review: names of 24 letters fit every screen of the hub, phone 390x844', viewport: { width: 390, height: 844 }, mobile: true, query: 'view=2d',
    run: names, timeout: 200000 },
  { name: 'review: names of 24 letters fit every screen of the hub, phone on its side 844x390, with a notch', viewport: { width: 844, height: 390 }, mobile: true,
    query: 'view=2d', safeArea: { top: 0, right: 47, bottom: 21, left: 47 }, run: names, timeout: 200000 },
  { name: 'review: the haul\'s notches and the scars in the HUD, phone 390x844', viewport: { width: 390, height: 844 }, mobile: true, query: 'view=2d', run: hud },
  { name: 'review: what knots and observances leave on the ground, 3D view 960x540', viewport: { width: 960, height: 540 }, mobile: false, query: 'view=gl', run: ground },
  { name: 'review: what knots and observances leave on the ground, plain view 960x540', viewport: { width: 960, height: 540 }, mobile: false, query: 'view=2d', run: ground },
];
