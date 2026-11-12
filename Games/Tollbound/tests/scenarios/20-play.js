// tests/scenarios/20-play.js: the simulation and the shell together. A vigil is started from the title and
// played, on a phone and on a desktop window, and the page is made to replay a run that Node has played.
//   - the main control of the title starts a run; Game.sim(10) takes it 600 steps on; its entities are there
//     and in place; the frame loop draws them and goes on stepping; a command ends the run and the results
//     show; a real tap (a finger on the phone, the mouse on the desktop) leads back to the title and into the
//     next run; Game.start with a cfg that names a zone starts a run of that zone
//   - the replay: reference() below plays a debug scene in Node, through tests/sim/loader.js, with a script
//     of inputs, and hands the script and the checksums to the page (the scenario's args). The page plays the
//     same script on its own copy of the simulation and must reach the same checksums: the simulation in the
//     built page is the simulation the Node tests test, in another engine of JavaScript.
// The scenarios ask for no view, so they run on the best one the build has. The reference is made from src/
// as it is now: against a page built from other sources (GAME=...) the replay may rightly differ.
// The function play runs inside the page (see tests/run.js), so it uses only T, TB, its argument and the page.
'use strict';
const { loadSim } = require('../sim/loader.js');

const SEED = 20261112, HUSKS = 600, STEPS = 600, EVERY = 200;

// Plays the reference run in Node. A move is [mx, my, trade, heave] for one step, as plain numbers.
function reference() {
  const { Sim } = loadSim({ boot: true });
  const S = Sim.debugScene(HUSKS, SEED), frame = { mx: 0, my: 0, ax: 1, ay: 0, aim: false, trade: false, heave: false };
  const moves = [], marks = [];
  for (let i = 0; i < STEPS; i++) {
    const move = [Math.cos(i / 40) * 0.7, Math.sin(i / 55) * 0.7, i % 97 === 0 ? 1 : 0, i % 211 === 0 ? 1 : 0];
    moves.push(move);
    frame.mx = move[0];
    frame.my = move[1];
    frame.trade = move[2] === 1;
    frame.heave = move[3] === 1;
    if (S.phase === 'offer') Sim.command(S, { type: 'pick', index: 0 });
    Sim.step(S, frame);
    if ((i + 1) % EVERY === 0) marks.push(Sim.hash(S));
  }
  return { seed: SEED, husks: HUSKS, every: EVERY, moves, marks, enemies: S.enemies.n };
}

const play = async function (ref) {
  const { Game, Sim, UI, Gfx, Plat } = TB;
  const ui = document.getElementById('ui');
  const focused = () => (document.activeElement && ui.contains(document.activeElement) ? document.activeElement : null);
  // Three rows of the picture, right across, read in the frame that drew them: after the game's own frame
  // callback, which was asked for earlier and so runs first.
  const rows = () => new Promise((resolve) => requestAnimationFrame(() => {
    const view = Gfx.active.canvas, copy = document.createElement('canvas');
    copy.width = view.width;
    copy.height = view.height;
    const ctx = copy.getContext('2d');
    ctx.drawImage(view, 0, 0);
    resolve([0.31, 0.5, 0.73].map((at) => ctx.getImageData(0, Math.floor(view.height * at), view.width, 1).data));
  }));
  const differing = (a, b) => {   // how many pixels of the rows are not alike
    let n = a.length === b.length ? 0 : Infinity;
    for (let r = 0; r < a.length && r < b.length; r++) {
      if (a[r].length !== b[r].length) return Infinity;
      for (let i = 0; i < a[r].length; i += 4) if (a[r][i] !== b[r][i] || a[r][i + 1] !== b[r][i + 1] || a[r][i + 2] !== b[r][i + 2]) n++;
    }
    return n;
  };

  // ---- from the title into a run ----
  const main = focused();
  T.check('the game opens on the title, with focus on its main control', Game.state === 'title' && UI.top() === 'title' && Game.S === null && !!main,
    [Game.state, UI.top(), main && main.textContent]);
  if (!main) return T.done();
  const bare = await rows();   // the empty ground behind the title
  main.click();
  const S = Game.S;
  T.check('the main control of the title starts a run', Game.state === 'run' && !!S && S.phase === 'play' && UI.top() === null, [Game.state, S && S.phase, UI.top()]);
  if (!S) return T.done();

  // ---- ten seconds of it ----
  const from = S.step, ran = Game.sim(10);
  T.check('Game.sim(10) plays 600 steps: the step count is 600', ran === 600 && from === 0 && S.step === 600, { returned: ran, from: from, step: S.step, phase: S.phase });
  T.check('ten seconds have passed in the run', Math.abs(S.t - 10) < 1e-9, S.t);
  const live = (pool) => pool.items.slice(0, pool.n).filter((e) => e.alive);
  const enemies = live(S.enemies), region = S.region, inside = (e) => Math.hypot(e.x - region.x, e.y - region.y) <= region.radius + 1e-6;
  T.check('the run has enemies', enemies.length > 0, { enemies: enemies.length, shots: S.shots.n, pickups: S.pickups.n, areas: S.areas.n, minions: S.minions.n });
  const sound = (e) => Number.isFinite(e.x) && Number.isFinite(e.y) && Number.isFinite(e.px) && Number.isFinite(e.py) && e.r > 0 && e.life > 0 &&
    e.lifeMax >= e.life && e.uid > 0 && !!e.def && inside(e);
  const odd = enemies.find((e) => !sound(e));
  T.check('every enemy has a def, a place inside the region, a size and life', !odd, odd && { uid: odd.uid, x: odd.x, y: odd.y, r: odd.r, life: odd.life });
  T.check('no two entities share a uid', new Set(enemies.map((e) => e.uid)).size === enemies.length);
  const p = S.player;
  T.check('the player is alive and inside the region', p.alive === true && p.life > 0 && Number.isFinite(p.x) && Number.isFinite(p.y) && inside(p), { x: p.x, y: p.y, life: p.life });
  const sum = Sim.hash(S);
  T.check('the run has a checksum, and asking for it changes nothing', Number.isInteger(sum) && sum >= 0 && sum <= 0xffffffff && Sim.hash(S) === sum, sum);

  // ---- the frame loop takes it on, and draws it ----
  await T.until(() => S.step >= 630);
  T.check('the frame loop goes on stepping the run', S.step >= 630 && S.phase === 'play' && Game.state === 'run', S.step);
  const drawn = differing(bare, await rows());
  T.check('the view draws the run: the picture is no longer the bare ground behind the title', drawn >= 20 && drawn < Infinity, { view: Gfx.active.name, pixels: drawn });

  // ---- where a frame stands between two steps ----
  // The stand-in picture of 90-game.js centres the camera on the player, so the middle of the canvas tells
  // where the player was drawn. Once the scene and the input module exist, only the first check is left.
  const frames = [], standIn = typeof TB.Scene.draw !== 'function' && typeof TB.Input.sample !== 'function';
  const key = (type) => window.dispatchEvent(new KeyboardEvent(type, { code: 'KeyD', key: 'd', bubbles: true, cancelable: true }));
  const stopNoting = Plat.on('frame', (run, alpha) => {
    if (run !== S) return;
    const q = run.player, mid = Gfx.screenToWorld(innerWidth / 2, innerHeight / 2);
    frames.push({ alpha: alpha, walking: q.x !== q.px, off: Math.abs(mid.x - (q.px + (q.x - q.px) * alpha)) + Math.abs(mid.y - (q.py + (q.y - q.py) * alpha)) });
  });
  if (standIn) key('keydown');
  await T.until(() => frames.filter((f) => f.walking || !standIn).length >= 20);
  if (standIn) key('keyup');
  stopNoting();
  const outside = frames.find((f) => !(f.alpha > 0 && f.alpha <= 1));
  T.check('every frame says where it stands between the last two steps: alpha is above 0 and at most 1', frames.length >= 20 && !outside, outside || frames.length);
  if (standIn) {
    const astray = frames.find((f) => !(f.off < 1e-6));
    T.check('a thing is drawn alpha of the way from where it stood before the last step to where it stands now',
      frames.some((f) => f.walking) && !astray, astray || frames.filter((f) => f.walking).length);
  }

  // ---- the page plays what Node played ----
  const R = Sim.debugScene(ref.husks, ref.seed), frame = { mx: 0, my: 0, ax: 1, ay: 0, aim: false, trade: false, heave: false }, marks = [];
  for (let i = 0; i < ref.moves.length; i++) {
    const move = ref.moves[i];
    frame.mx = move[0];
    frame.my = move[1];
    frame.trade = move[2] === 1;
    frame.heave = move[3] === 1;
    if (R.phase === 'offer') Sim.command(R, { type: 'pick', index: 0 });
    Sim.step(R, frame);
    if ((i + 1) % ref.every === 0) marks.push(Sim.hash(R));
  }
  T.check('a debug scene has in the page the enemies it has in Node', R.enemies.n === ref.enemies, [R.enemies.n, ref.enemies]);
  T.check('the page reaches the checksums Node reached, with the same seed and inputs', marks.length > 0 && marks.join() === ref.marks.join(), { page: marks, node: ref.marks });

  // ---- out again ----
  const steps = S.step;
  T.check('the command to leave ends the run', Game.command({ type: 'leave' }) === true && S.phase === 'ended' && !!S.result && S.result.outcome === 'left' && S.result.steps === steps,
    S.result);
  await T.until(() => Game.state === 'results');
  const back = focused();
  T.check('the results show, with focus on the way back', Game.state === 'results' && UI.top() === 'results' && !!back, [Game.state, UI.top()]);
  if (!back) return T.done();

  // ---- by a player's own hand: a finger on the phone, the mouse on the desktop ----
  let trusted = null;
  back.addEventListener('click', (e) => { trusted = e.isTrusted; }, { once: true });
  await T.tap(back);
  await T.until(() => Game.state === 'title', 5000);
  T.check('a real tap on it leads to the title, and the run is dropped', trusted === true && Game.state === 'title' && UI.top() === 'title' && Game.S === null,
    { trusted: trusted, state: Game.state, top: UI.top() });
  await T.tap(focused());
  await T.until(() => Game.state === 'run', 5000);
  T.check('and a real tap on the main control of the title starts the next run', Game.state === 'run' && !!Game.S && Game.S !== S && Game.S.phase === 'play' && UI.top() === null,
    [Game.state, UI.top()]);
  Game.title();

  // ---- a run of a zone, as the hub will start it (the address of this scenario says seed=7) ----
  const unseeded = { zone: 'debug' }, zoned = Game.start(unseeded);
  T.check('a cfg that names a zone starts a run of that zone, seeded from the address when it brings no seed',
    !!zoned && zoned === Game.S && zoned.zone.id === 'debug' && zoned.debug === null && zoned.cfg.seed === 7 && unseeded.seed === undefined && Game.state === 'run',
    zoned && { zone: zoned.zone.id, seed: zoned.cfg.seed });
  T.check('such a run steps like any other', Game.sim(1) === 60 && zoned.step === 60, zoned && zoned.step);
  const given = { zone: 'debug', seed: 'a word', mode: 'watch-night' }, own = Game.start(given);
  T.check('a cfg that brings its seed reaches the simulation as it is', !!own && own.cfg === given && own.mode.id === 'watch-night', own && own.cfg.seed);
  Game.title();
  return T.done();
};

const args = reference();

module.exports = [
  { name: 'play: a vigil from the title, phone 390x844', viewport: { width: 390, height: 844 }, mobile: true, query: 'seed=7', args, run: play },
  { name: 'play: a vigil from the title, desktop 1280x720', viewport: { width: 1280, height: 720 }, mobile: false, query: 'seed=7', args, run: play },
];
