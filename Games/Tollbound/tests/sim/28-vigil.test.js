// tests/sim/28-vigil.test.js: the soak, and the scripted player (src/js/28-bot.js). Bot 'vigil' plays the
// Change-ringer through the Dial for ten simulated minutes from several seeds, with every module below 50 loaded and
// booted as the page boots them: no exception, no cap ever exceeded and no event dropped, the keeper at the eighth
// toll, and each vigil's outcome reported with its time (t.diagnostic); the same seed twice gives the same hash. Then
// the bot's own policies: 'still', 'walk', and 'vigil' ringing down after the keeper and running for the far
// lychgate when Tolled-for. How long the bot lives is reported, not held to a number: it follows the tuning of the
// combat package and of the Dial.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSim } = require('./loader.js');

// ten minutes and a half: the keeper rises in the step after the eighth toll, at 600 s
const SEEDS = [1, 2, 3, 4, 5, 6], MINUTES = 10.5, STEPS = MINUTES * 60 * 60;
const sim = loadSim({ boot: true });
const { Sim, Bot, Player, Stats, Defs } = sim;

const vigilCfg = (seed, extra) => Object.assign({ zone: 'dial', seed }, Player.classRun('change-ringer'), extra || {});

// plays one vigil with the bot; checks the caps after every step; returns what happened
function play(S, steps, policy) {
  const caps = S.rules.caps;
  const seen = { keeperAt: null, keeperToll: null, most: 0, steps: 0, marks: [] };
  for (let i = 0; i < steps && S.phase === 'play'; i++) {
    Sim.step(S, Bot.input(S, policy || 'vigil'));
    seen.steps++;
    if (S.enemies.n > caps.enemies || S.shots.n > caps.shots || S.areas.n > caps.areas || S.pickups.n > caps.pickups || S.minions.n > caps.minions) {
      throw new Error(`a cap was exceeded at step ${S.step}: ${S.enemies.n} ${S.shots.n} ${S.areas.n} ${S.pickups.n} ${S.minions.n}`);
    }
    if (S.eventCount > caps.events || S.eventsDropped > 0) throw new Error(`events overflowed at step ${S.step}`);
    if (S.boss && seen.keeperAt === null) { seen.keeperAt = S.t; seen.keeperToll = S.toll; }
    if (S.enemies.n > seen.most) seen.most = S.enemies.n;
    if (S.step % 3600 === 0) seen.marks.push(Sim.hash(S));
  }
  return seen;
}

test(`the Change-ringer keeps ${MINUTES} minutes of vigil in the Dial from ${SEEDS.length} seeds: no exception, no cap exceeded, an outcome with its time`, (t) => {
  let pastKeeper = 0;
  for (const seed of SEEDS) {
    const S = Sim.create(vigilCfg(seed)), seen = play(S, STEPS);
    const outcome = S.result ? S.result.outcome : 'still keeping it';
    assert.ok(['left', 'spared', 'died', 'still keeping it'].includes(outcome));
    assert.ok(S.kills > 100, `seed ${seed}: the dead were laid (${S.kills})`);
    // a vigil may end in the very step its eighth toll rings (a Tolled-for that runs out at that toll): the keeper
    // rises in the next step, so it is looked for only in a vigil that lasted past it
    if (S.t > S.rules.keeperToll * 75 + 0.05) {
      assert.equal(seen.keeperToll, S.rules.keeperToll, `seed ${seed}: the keeper came at the eighth toll`);
      assert.ok(Math.abs(seen.keeperAt - 8 * 75) < 0.1, `seed ${seed}: at ${seen.keeperAt} s`);
      pastKeeper++;
    } else assert.equal(seen.keeperAt, null, `seed ${seed}: no keeper before the eighth toll`);
    if (S.result) assert.ok(Math.abs(S.result.time - S.t) <= 1 / 60 + 1e-9, 'the time it ended, in the step it ended');
    t.diagnostic(`seed ${seed}: ${outcome} at ${S.t.toFixed(1)} s, toll ${S.toll}, ${S.kills} laid, run level ${S.player.runLevel}, ` +
      `keeper ${seen.keeperAt === null ? 'not come' : 'came at ' + seen.keeperAt.toFixed(0) + ' s'}${S.vigil.keeper === 2 ? ', laid' : ''}, ` +
      `banked ${S.bank.coin}, at most ${seen.most} of the dead standing`);
  }
  t.diagnostic(`${pastKeeper} of ${SEEDS.length} vigils lasted to the keeper's coming`);
});

test('the keeper rises at the eighth toll, and past it the danger climbs: a player who cannot fall still sees the dead mount', () => {
  const S = Sim.create(vigilCfg(11, { mods: Player.classRun('change-ringer').mods.concat([{ stat: 'life-max', op: 'flat', value: 1e6 }]) }));
  const seen = play(S, 12 * 3600);
  assert.equal(S.phase, 'play', 'it is still there after twelve minutes');
  assert.equal(seen.keeperToll, 8, 'the keeper came at the eighth toll');
  assert.ok(Math.abs(seen.keeperAt - 600) < 0.1);
  assert.equal(S.toll, 9);
  assert.ok(sim.Director.level(S) >= 11, 'the dead rise two levels a toll past the keeper');
  const late = S.enemies.n;
  play(S, 3 * 4500);                                 // three more tolls
  assert.ok(S.enemies.n > late && S.enemies.n > 150, `the dead mount: ${late} then ${S.enemies.n}`);
});

test('the same seed twice gives the same hash, minute by minute', () => {
  const a = Sim.create(vigilCfg(7)), b = Sim.create(vigilCfg(7));
  const ma = play(a, STEPS).marks, mb = play(b, STEPS).marks;
  assert.ok(ma.length >= 5, `${ma.length} minutes`);
  assert.deepEqual(mb, ma);
  assert.equal(Sim.hash(a), Sim.hash(b));
  assert.notEqual(Sim.hash(Sim.create(vigilCfg(8))), Sim.hash(Sim.create(vigilCfg(7))));
});

test("Bot.input: 'still' does nothing, 'walk' walks a slow circle 11 m across, and the frame is the run's own", () => {
  const S = Sim.create(vigilCfg(3));
  const f = Bot.input(S, 'still');
  assert.deepEqual([f.mx, f.my, f.trade, f.heave, f.aim], [0, 0, false, false, false]);
  assert.equal(f, S.bot.frame, 'one frame of the run, refilled');
  const x0 = S.player.x, y0 = S.player.y;
  let far = 0;
  for (let i = 0; i < 60 * 13; i++) {
    const w = Bot.input(S, 'walk');
    assert.ok(Math.hypot(w.mx, w.my) <= 1 + 1e-9);
    Sim.step(S, w);
    far = Math.max(far, Math.hypot(S.player.x - x0, S.player.y - y0));
  }
  assert.ok(far > 9 && far < 12, `a circle about 11 m across: ${far.toFixed(2)} m at the farthest`);
  assert.ok(Math.hypot(S.player.x - x0, S.player.y - y0) < 1.5, 'back near where it began after a round');
  const other = Sim.create(vigilCfg(3));
  assert.notEqual(Bot.input(other, 'still'), f, 'another run has its own frame');
  assert.equal(Bot.choose(S, { kind: 'reward', options: [{}, {}] }), 0);
});

test("Bot 'vigil' walks into a favour, rings down once the keeper is laid, and runs for the far lychgate when Tolled-for", () => {
  // a favour standing: it walks into it
  let S = Sim.create(vigilCfg(4));
  Sim.step(S, Bot.input(S, 'vigil'));
  S.player.runLevel = 1;
  Sim.step(S, Bot.input(S, 'vigil'));
  let taken = false;
  for (let i = 0; i < 300 && !taken; i++) {
    Sim.step(S, Bot.input(S, 'vigil'));
    for (let k = 0; k < S.eventCount; k++) if (S.events[(S.eventStart + k) % S.events.length].k === 'favour') taken = true;
  }
  assert.ok(taken, 'it took one of the favours raised');
  // the keeper laid and a lychgate open: it rings down
  S = Sim.create(vigilCfg(5));
  Sim.step(S, Bot.input(S, 'vigil'));
  S.coin = 12;
  const e = Sim.spawnEnemy(S, 'dial.wake-walker', S.player.x + 8, S.player.y, { rank: 1 });
  Sim.step(S, Bot.input(S, 'vigil'));
  e.life = 0;
  Sim.step(S, Bot.input(S, 'vigil'));
  assert.ok(S.gate !== null, 'a lychgate opened where the elite fell');
  S.vigil.keeper = 2;                               // as if the keeper had been laid
  for (let i = 0; i < 20 * 60 && S.phase === 'play'; i++) Sim.step(S, Bot.input(S, 'vigil'));
  assert.equal(S.phase, 'ended');
  assert.equal(S.result.outcome, 'left', 'it rang down');
  assert.ok(S.bank.coin >= 12 && S.coin === 0 && S.result.banked === S.bank.coin, `and banked all it carried: ${S.bank.coin}`);
  // Tolled-for: the far lychgate
  S = Sim.create(vigilCfg(6));
  Sim.step(S, Bot.input(S, 'vigil'));
  S.player.condT[Stats.AILMENT['tolled-for']] = 60;
  for (let i = 0; i < 40 * 60 && S.phase === 'play'; i++) {
    S.player.condT[Stats.AILMENT['tolled-for']] = 60;   // held, so that only reaching the far lychgate can end it
    Sim.step(S, Bot.input(S, 'vigil'));
  }
  assert.equal(S.phase, 'ended');
  assert.equal(S.result.outcome, 'spared', 'it reached the far lychgate');
  assert.ok(Defs.has('zone', 'dial'));
});
