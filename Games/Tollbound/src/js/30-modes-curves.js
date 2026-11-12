// 30-modes-curves.js: the two ways to play, the level curves, the constants of a run, and the debug zone.
// Owns: (none)
// Public: nothing; it only registers definitions with Defs.add:
//   mode       'watch', 'gauntlet'
//   curves     'main'    lists indexed by level - 1, for levels 1 to 70:
//                          enemyLife, enemyDamage, enemyXp   what an enemy def's life, damage and xp are multiplied by
//                          accuracy                          what enemies of that level bring against the player's evasion
//                          charXp, gauntletXp                xp a character of that level needs for the next (see Mode.xpCurve)
//                          runXp                             xp the run level after that many needs
//                        rank: what an enemy of rank 0..3 (common, elite, mini-boss, boss) multiplies life,
//                        damage, xp and size by. A boss def carries its own numbers, so its row is all ones.
//   constants  'main'    spawnRadius, despawnRadius (metres from the player), tollSeconds, keeperToll, gateEvery,
//                        gateOpenSeconds, gateHoldSeconds, caps (the most entities of each pool, and events in
//                        one step), gridCell (metres), playerRadius (metres). A run reads them as S.rules.
//   zone       'debug'   an empty ground for Sim.debugScene and for tests
//   enemy      'debug.husk'   the enemy of the debug scene; its puppet has the same id
//
// PROVISIONAL: every number in the curves and the modes is a placeholder until docs/design/02-rules.md gives
// the real ones (that file did not exist when this was written). The curves are built from plain sums and
// products only, so they come out the same on every machine.
(function () {
  'use strict';

  const LEVELS = 70;
  const enemyLife = [], enemyDamage = [], enemyXp = [], accuracy = [], charXp = [], gauntletXp = [], runXp = [];
  let life = 1, damage = 1, xp = 1;
  for (let level = 1; level <= LEVELS; level++) {
    enemyLife.push(Math.round(life * 100) / 100);
    enemyDamage.push(Math.round(damage * 100) / 100);
    enemyXp.push(Math.round(xp * 100) / 100);
    accuracy.push(60 + 14 * level);
    charXp.push(40 + 18 * level * level);
    gauntletXp.push(12 + 3 * level * level);
    runXp.push(Math.round(8 + 5 * level + 0.6 * level * level));
    life *= 1.105;
    damage *= 1.062;
    xp *= 1.085;
  }

  Defs.add('curves', {
    id: 'main',
    levels: LEVELS,
    enemyLife, enemyDamage, enemyXp, accuracy, charXp, gauntletXp, runXp,
    rank: [
      { life: 1, damage: 1, xp: 1, size: 1 },
      { life: 6, damage: 1.4, xp: 8, size: 1.25 },
      { life: 30, damage: 1.8, xp: 40, size: 1.6 },
      { life: 1, damage: 1, xp: 1, size: 1 },
    ],
  });

  Defs.add('constants', {
    id: 'main',
    spawnRadius: 26,
    despawnRadius: 34,
    tollSeconds: 75,
    keeperToll: 8,
    gateEvery: 3,
    gateOpenSeconds: 25,
    gateHoldSeconds: 3,
    caps: { enemies: 600, shots: 500, areas: 120, pickups: 400, minions: 40, events: 2048 },
    gridCell: 2,
    playerRadius: 0.4,
  });

  Defs.add('mode', {
    id: 'watch',
    name: 'The Watch',
    text: 'Your living characters. Each keeps its level, its tree, its sigils and its gear from vigil to vigil, for as long as it lives.',
    persistent: true,
    route: 'zone',
    xpCurve: 'charXp',
    levelCap: 60,
    runLevels: 40,
    levelOffer: 'none',
    runLevelOffer: 'chime',
    eliteOffer: 'none',
    bossOffer: 'none',
    shrineOffer: 'chime',
    haul: 'gate',
    calling: { levels: [15, 30, 45, 55] },
    respec: 'gold',
    death: 'permanent',
    score: null,
  });

  Defs.add('mode', {
    id: 'gauntlet',
    name: 'The Gauntlet',
    text: 'One character, from the first level through every district, in a single sitting.',
    persistent: false,
    route: 'gauntlet',
    zones: [],
    xpCurve: 'gauntletXp',
    levelCap: 60,
    runLevels: 0,
    levelOffer: 'node',
    runLevelOffer: 'none',
    eliteOffer: 'reward',
    bossOffer: 'reward',
    shrineOffer: 'reward',
    haul: 'none',
    calling: { afterBoss: 1, pointsPerBoss: 2 },
    respec: 'last3',
    death: 'permanent',
    score: { kill: 1, toll: 50, boss: 500, level: 20 },
  });

  Defs.add('zone', {
    id: 'debug',
    name: 'Test Ground',
    kind: 'debug',
    level: 1,
    tollSeconds: 75,
    keeperToll: 8,
    gateEvery: 3,
    region: { radius: 60 },
    tileset: null,
    props: [],
    ambient: { light: [0.6, 0.65, 0.8], fog: 0.012, sun: { dir: [-0.45, -0.6, 0.66], color: [1, 0.93, 0.8] } },
    music: null,
    timeline: [],
    overtoll: { rateMul: 1, levelPer: 0, rewardPer: 0 },
    events: [],
    boss: null,
    rules: {},
    unlock: null,
    next: null,
  });

  Defs.add('enemy', {
    id: 'debug.husk',
    name: 'Husk',
    puppet: 'debug.husk',
    radius: 0.45,
    life: 20,
    damage: 4,
    speed: 2.2,
    xp: 1,
    cost: 1,
    loot: null,
    ai: 'chase',
    aiParams: {},
    attacks: [],
    res: {},
    armour: 0,
    threshold: 1,
    tags: [],
  });
})();
