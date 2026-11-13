// 30-modes-curves.js: the two ways to play, the level curves, the constants of a run, and the debug zone.
// Owns: (none)
// Public: nothing; it only registers definitions with Defs.add:
//   mode       'household', 'watch-night'      (docs/design/04-progression.md, "The two ways to play")
//   curves     'main'    lists indexed by level - 1, for levels 1 to 70:
//                          enemyLife, enemyDamage, enemyXp   what an enemy def's life, damage and xp are multiplied by
//                          charXp, nightXp                   xp a character of that level needs for the next, in the
//                                                            Household and in the Watch-night (see Mode.xpCurve)
//                          runXp                             xp the run level after that many needs
//                        rank: what an enemy of rank 0..3 (common, elite, mini-boss, keeper) multiplies life,
//                        damage, xp and size by. A keeper's def carries its own numbers, so its row is all ones.
//   constants  'main'    spawnRadius, despawnRadius (metres from the player), tollSeconds, keeperToll, gateEvery,
//                        gateOpenSeconds (how long a lychgate stays open), gateRadius (metres from its middle within
//                        which the player stands in it, and the ring the scene draws), ringStrokes and strokeSeconds (ringing
//                        down: six strokes a second apart), backSeconds (a silenced voice comes back after this
//                        many seconds, one at a time), caps (the most entities of each pool, and events in one
//                        step), gridCell (metres), playerRadius (metres). A run reads them as S.rules.
//   zone       'debug'   an empty ground for Sim.debugScene and for tests
//   enemy      'debug.husk'   the enemy of the debug scene; its puppet has the same id
//
// The numbers of a toll, a lychgate and ringing down are the design's (docs/design/02-combat.md, section 11, and
// docs/design/01-world.md, "The frame in the fiction"); the modes follow docs/design/04-progression.md. The curves
// are still the first plan's, to be tuned with the first vigil. They are built from plain sums and products only,
// so they come out the same on every machine.
(function () {
  'use strict';

  const LEVELS = 70;
  const enemyLife = [], enemyDamage = [], enemyXp = [], charXp = [], nightXp = [], runXp = [];
  let life = 1, damage = 1, xp = 1;
  for (let level = 1; level <= LEVELS; level++) {
    enemyLife.push(Math.round(life * 100) / 100);
    enemyDamage.push(Math.round(damage * 100) / 100);
    enemyXp.push(Math.round(xp * 100) / 100);
    charXp.push(40 + 18 * level * level);
    nightXp.push(12 + 3 * level * level);
    runXp.push(Math.round(8 + 5 * level + 0.6 * level * level));
    life *= 1.105;
    damage *= 1.062;
    xp *= 1.085;
  }

  Defs.add('curves', {
    id: 'main',
    levels: LEVELS,
    enemyLife, enemyDamage, enemyXp, charXp, nightXp, runXp,
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
    gateRadius: 1.7,
    ringStrokes: 6,
    strokeSeconds: 1,
    backSeconds: 2,
    caps: { enemies: 600, shots: 500, areas: 120, pickups: 400, minions: 40, events: 2048 },
    gridCell: 2,
    playerRadius: 0.4,
  });

  Defs.add('mode', {
    id: 'household',
    name: 'The Household',
    text: 'Standing characters, kept from vigil to vigil until they die. Each has one life.',
    persistent: true,
    route: 'zone',
    xpCurve: 'charXp',
    levelCap: 70,
    runLevels: 40,
    levelOffer: 'none',
    runLevelOffer: 'favour',
    eliteOffer: 'none',
    bossOffer: 'none',
    haul: 'gate',
    calling: { afterKeeper: 2, pointsPerPeal: 2 },
    respec: 'coin',
    death: 'permanent',
    score: null,
  });

  Defs.add('mode', {
    id: 'watch-night',
    name: 'The Watch-night',
    text: 'One sitting, from nothing, through five districts, held for one of your dead.',
    persistent: false,
    route: 'night',
    zones: [],
    xpCurve: 'nightXp',
    levelCap: 70,
    runLevels: 40,
    levelOffer: 'node',
    runLevelOffer: 'favour',
    eliteOffer: 'none',
    bossOffer: 'none',
    haul: 'gate',
    calling: { afterKeeper: 1, pointsPerPeal: 2 },
    respec: 'none',
    death: 'permanent',
    score: null,
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
    guard: {},
    size: 'small',
    press: 0,
    tags: [],
  });
})();
