// tests/scenarios/28-vigil.js: a vigil of the Dial in the built page, played by the scripted player. The page starts
// the Change-ringer's vigil as the title does, Game.sim plays ten and a half minutes of it with Bot 'vigil', and the
// page must hold together: the dead rise and fall, Swells of the dead are drawn as areas of team 1 with their
// warnings, the count is rung and lychgates open, the keeper comes at the eighth toll if the vigil lasts that long,
// and when the vigil ends the results show. The page then plays the same seed again and must reach the same
// checksum, so the systems of the vigil run in the page as they do in Node (tests/sim/28-vigil.test.js).
// The function play runs inside the page (see tests/run.js), so it uses only T, TB, its argument and the page.
'use strict';

const play = async function (seed) {
  const { Game, Sim, Player, UI } = TB;
  T.check('the build has the vigil\'s systems and the Dial', typeof TB.Director.step === 'function' && typeof TB.Bot.input === 'function' &&
    TB.Defs.has('zone', 'dial') && TB.Defs.has('class', 'change-ringer'));
  const S = Game.start(Object.assign({ zone: 'dial', seed: seed }, Player.classRun('change-ringer')));
  T.check('a vigil of the Dial starts', !!S && S.zone.id === 'dial' && Game.state === 'run' && S.phase === 'play', S && S.zone.id);
  if (!S) return T.done();
  // what the run says along the way, read after every step from the notice the page posts
  const seen = { telegraph: 0, count: 0, gate: 0, kill: 0, offer: 0, favour: 0, swell: false, keeperToll: null, mostEnemies: 0 };
  const off = TB.Plat.on('step', (run) => {
    if (run !== S) return;
    for (let i = 0; i < run.eventCount; i++) {
      const e = run.events[(run.eventStart + i) % run.events.length];
      if (seen[e.k] !== undefined) seen[e.k]++;
    }
    for (let i = 0; i < run.areas.n && !seen.swell; i++) {
      const a = run.areas.items[i];
      if (a.alive && a.team === 1 && a.def && a.def.type === 'swell' && a.r > 0 && a.ttl > 0) seen.swell = true;
    }
    if (run.boss && seen.keeperToll === null) seen.keeperToll = run.toll;
    if (run.enemies.n > seen.mostEnemies) seen.mostEnemies = run.enemies.n;
  });
  const t0 = performance.now(), ran = Game.sim(630, { bot: true, policy: 'vigil' }), ms = performance.now() - t0;
  off();
  T.check('Game.sim played the vigil with the scripted player', ran > 60 * 60 && S.step === ran, { steps: ran, seconds: S.t, ms: Math.round(ms) });
  T.check('the dead rose and were laid', S.kills > 100 && seen.kill === S.kills && seen.mostEnemies > 20, { kills: S.kills, most: seen.mostEnemies });
  T.check('the dead\'s Swells were drawn as areas of team 1, each with its warning', seen.swell && seen.telegraph > 0, { telegraphs: seen.telegraph });
  // (a vigil that ends in the step its toll rings ends before the count of that toll)
  T.check('the count was rung at the start and at every toll', seen.count === S.toll + 1 || (S.phase === 'ended' && seen.count === S.toll),
    { count: seen.count, tolls: S.toll });
  T.check('favours rose and were walked into, and nothing paused', seen.offer > 3 && seen.favour > 3 && S.offer === null, { offers: seen.offer, taken: seen.favour });
  T.check('lychgates opened', seen.gate > 0, seen.gate);
  if (S.t > 600.05) T.check('the keeper came at the eighth toll', seen.keeperToll === 8, seen.keeperToll);
  else T.check('the vigil ended before the keeper\'s toll, and no keeper came', seen.keeperToll === null && S.phase === 'ended', { t: S.t });
  if (S.phase === 'ended') {
    await T.until(() => Game.state === 'results' && UI.top() === 'results', 5000);
    T.check('the vigil ended with an outcome, and the results show', ['left', 'spared', 'died'].includes(S.result.outcome) && Game.state === 'results' && UI.top() === 'results',
      { outcome: S.result.outcome, t: S.t, state: Game.state, top: UI.top() });
  }
  const sum = Sim.hash(S);
  // the same seed again: the same vigil, checksum for checksum
  const again = Game.start(Object.assign({ zone: 'dial', seed: seed }, Player.classRun('change-ringer')));
  Game.sim(S.t, { bot: true, policy: 'vigil' });
  T.check('the same seed plays the same vigil again', Sim.hash(again) === sum && again.step === S.step, { first: sum, second: Sim.hash(again) });
  Game.title();
  return T.done();
};

module.exports = [
  { name: 'vigil: the scripted player keeps a vigil of the Dial, phone 390x844', viewport: { width: 390, height: 844 }, mobile: true, query: '', args: 6, run: play, timeout: 240000 },
  { name: 'vigil: the scripted player keeps a vigil of the Dial, desktop 1280x720', viewport: { width: 1280, height: 720 }, mobile: false, query: '', args: 2, run: play, timeout: 240000 },
];
