// tests/scenarios/21-combat.js: the combat package in the built page (src/js/11-damage.js, 21-player.js, 23-skills.js,
// 24-archetypes.js and the Change-ringer of 31-change-ringer.js), on a phone and on a desktop window.
//   - the replay: reference() below plays a Change-ringer's vigil in Node, through tests/sim/loader.js, with a script
//     of inputs that rocks (pulls), stands (the set bell, Plumb's mark) and presses the trade, and hands the script,
//     the checksums and what each voice did to the page. The page plays the same script on its own copy of the
//     simulation and must reach the same checksums with the same casts, pulls and hits: the voices, the hits, the
//     wounds and the pull are the ones the Node tests test, in another engine of JavaScript.
//   - a live vigil: Game.start with Player.classRun('change-ringer') in the zone the reference used, 20 s of
//     Game.sim with the player standing, then the frame loop drawing it: each of the three voices speaks, the dead
//     are struck, and the page stays clean while the scene draws the voices' areas.
// The vigil is of the Dial when the build has it, else of the debug zone with husks set down round the player.
// The function play runs inside the page (see tests/run.js), so it uses only T, TB, its argument and the page.
'use strict';
const { loadSim } = require('../sim/loader.js');

const SEED = 4242, STEPS = 900, EVERY = 300;

// [mx, my, trade] for step i: rock east and west every 0.2 s, stand still for a while, walk a little, press Set
function move(i) {
  const phase = i % 300;
  if (phase < 90) return [Math.floor(i / 12) % 2 === 0 ? 1 : -1, 0, 0];
  if (phase < 160) return [0, 0, 0];
  if (phase < 200) return [0.3, Math.sin(i / 9), phase === 170 ? 1 : 0];
  return [Math.floor(i / 12) % 2 === 0 ? -0.9 : 0.9, 0.2, 0];
}

// the dead round the player when there is no district to raise them
function setDown(Sim, S) {
  for (let i = 0; i < 40; i++) {
    const r = 3 + (i % 8) * 1.5, a = i * 2.4;
    Sim.spawnEnemy(S, 'debug.husk', S.player.x + Math.cos(a) * r, S.player.y + Math.sin(a) * r);
  }
}

function reference() {
  const { Sim, Player, Defs } = loadSim({ boot: true });
  const zone = Defs.has('zone', 'dial') ? 'dial' : 'debug';
  const S = Sim.create(Object.assign({ zone, seed: SEED }, Player.classRun('change-ringer')));
  if (zone === 'debug') setDown(Sim, S);
  const frame = { mx: 0, my: 0, ax: 1, ay: 0, aim: false, trade: false, heave: false }, marks = [], did = { cast: 0, pull: 0, hit: 0 };
  for (let i = 0; i < STEPS && S.phase !== 'ended'; i++) {
    const m = move(i);
    frame.mx = m[0]; frame.my = m[1]; frame.trade = m[2] === 1;
    Sim.step(S, frame);
    for (let k = 0; k < S.eventCount; k++) {
      const e = S.events[(S.eventStart + k) % S.events.length];
      if (did[e.k] !== undefined) did[e.k]++;
    }
    if ((i + 1) % EVERY === 0) marks.push(Sim.hash(S));
  }
  return { zone, seed: SEED, steps: STEPS, every: EVERY, moves: Array.from({ length: STEPS }, (u, i) => move(i)), marks, did };
}

const play = async function (ref) {
  const { Game, Sim, Player, Plat, Scene } = TB;
  // ---- the replay ----
  const R = Sim.create(Object.assign({ zone: ref.zone, seed: ref.seed }, Player.classRun('change-ringer')));
  if (ref.zone === 'debug') {
    for (let i = 0; i < 40; i++) {
      const r = 3 + (i % 8) * 1.5, a = i * 2.4;
      Sim.spawnEnemy(R, 'debug.husk', R.player.x + Math.cos(a) * r, R.player.y + Math.sin(a) * r);
    }
  }
  const frame = { mx: 0, my: 0, ax: 1, ay: 0, aim: false, trade: false, heave: false }, marks = [], did = { cast: 0, pull: 0, hit: 0 };
  for (let i = 0; i < ref.steps && R.phase !== 'ended'; i++) {
    const m = ref.moves[i];
    frame.mx = m[0]; frame.my = m[1]; frame.trade = m[2] === 1;
    Sim.step(R, frame);
    for (let k = 0; k < R.eventCount; k++) {
      const e = R.events[(R.eventStart + k) % R.events.length];
      if (did[e.k] !== undefined) did[e.k]++;
    }
    if ((i + 1) % ref.every === 0) marks.push(Sim.hash(R));
  }
  T.check('the page plays the Change-ringer\'s run Node played, checksum for checksum', marks.length > 0 && marks.join() === ref.marks.join(), { page: marks, node: ref.marks });
  T.check('with the same casts, pulls and hits', did.cast === ref.did.cast && did.pull === ref.did.pull && did.hit === ref.did.hit, { page: did, node: ref.did });
  T.check('and the script pulled and the voices struck', ref.did.pull > 0 && ref.did.cast > ref.did.pull && ref.did.hit > 0, ref.did);

  // ---- a live vigil ----
  const spoke = {};
  let hits = 0;
  const off = Plat.on('step', function (S) {
    for (let k = 0; k < S.eventCount; k++) {
      const e = S.events[(S.eventStart + k) % S.events.length];
      if (e.k === 'cast') spoke[e.id] = (spoke[e.id] || 0) + 1;
      else if (e.k === 'hit') hits++;
    }
  });
  const S = Game.start(Object.assign({ zone: ref.zone }, Player.classRun('change-ringer')));
  T.check('Game.start runs a Change-ringer with its three voices', !!S && S.skills.length === 3 && S.skills.every((s) => s.sheet !== null), S && S.skills.length);
  if (S && ref.zone === 'debug') {
    for (let i = 0; i < 40; i++) Sim.spawnEnemy(S, 'debug.husk', S.player.x + Math.cos(i) * (4 + i % 6), S.player.y + Math.sin(i) * (4 + i % 6));
  }
  const ran = Game.sim(20);
  T.check('20 s of the vigil ran', ran > 0, ran);
  T.check('each of the three voices spoke', spoke['tenor-stroke'] > 0 && spoke.tellers > 0 && spoke.plumb > 0, spoke);
  T.check('and struck the dead', hits > 0, hits);
  // the frame loop draws the run, the voices' areas among it
  let seen = 0;
  const watch = Plat.on('frame', function (run) {
    if (!run) return;
    for (let i = 0; i < run.areas.n; i++) if (run.areas.items[i].alive && run.areas.items[i].team === 0) seen++;
  });
  await T.until(() => seen > 0 || Game.state !== 'run', 12000);
  await T.sleep(400);
  watch();
  off();
  T.check('frames are drawn while a voice\'s area lies on the ground', seen > 0 && Game.state === 'run', { seen, state: Game.state, decals: Scene.stats && Scene.stats.decals });
  Game.title();
  return T.done();
};

const args = reference();

module.exports = [
  { name: 'combat: the Change-ringer in the page, phone 390x844', viewport: { width: 390, height: 844 }, mobile: true, query: 'seed=9', args, run: play },
  { name: 'combat: the Change-ringer in the page, desktop 1280x720', viewport: { width: 1280, height: 720 }, mobile: false, query: 'seed=9', args, run: play },
];
