// 20-sim.js: the run state, the order of a step, commands and events.
// Owns: Sim
// Public:
//   Sim.create(cfg) -> S             a new run. cfg: {mode, zone, seed, char, account} as in docs/engine.md; seed is
//                                    a number or a string, mode defaults to 'watch'. For a run without a
//                                    character (tests, debug scenes, the first stage) cfg may also carry
//                                    mods: [Mod], sigils: [SigilInst], level, weapon (a weapon profile for
//                                    Stats.sheet) and rules: {name: number} to overrule S.rules.
//   Sim.step(S, input?) -> boolean   one step of 1/60 s. Does nothing and returns false unless S.phase is 'play'.
//   Sim.command(S, cmd) -> boolean   a Command of docs/engine.md; false if it was not acted on
//   Sim.emit(S, k, x, y, a, b, id)   adds an event to this step's queue
//   Sim.spawnEnemy(S, id, x, y, opts?) -> enemy | null     opts: {level, rank, traits: [trait id]}; id may be a boss
//   Sim.rebuild(S) -> Sheet          collects the modifiers and works out S.sheet and every skill's sheet
//   Sim.end(S, outcome) -> result    ends the run: outcome is 'left' or 'died'
//   Sim.result(S) -> result          the totals so far, or S.result once the run has ended
//   Sim.hash(S) -> uint32            a checksum of the run: equal seeds and inputs give equal checksums
//   Sim.debugScene(n, seed?) -> S    a run in the zone 'debug' with n 'debug.husk' enemies in rings round the player
//   Sim.field(kind, name, value)     gives every entity of a kind one more field; see "Entities"
//   Sim.fields(kind) -> [name]       the fields of a kind, built in and added
//   Sim.state(name, make)            gives every run a slot S[name] = make(S), for a system's own state
//   Sim.source(fn)                   fn(S, out) adds modifiers to every sheet rebuild: out.push(mod)
//   Sim.COMMON = 0, Sim.ELITE = 1, Sim.MINIBOSS = 2, Sim.BOSS = 3     the ranks of an enemy
//   Sim.NO_INPUT                     the InputFrame of a player who does nothing
//
// The run state. Plain data, pools and grids; presentation reads it and never writes it.
//   S.cfg, S.mode, S.zone        the cfg given, and the defs of its mode and zone
//   S.rules                      the numbers this run goes by: the constants 'main', overruled by the zone's
//                                tollSeconds, keeperToll and gateEvery, by zone.rules and by cfg.rules
//   S.curves                     the curves 'main'
//   S.rng                        {spawn, loot, combat, offers, world}: Core.RNG streams forked from the seed
//   S.step, S.t                  steps done; seconds = step / 60
//   S.toll, S.tollAt, S.tollSteps    tolls rung, the step at which the next one rings, and steps between two
//   S.threat                     the threat tier. The director keeps it; this file only starts it at 0.
//   S.phase                      'play' | 'offer' | 'ended'
//   S.player                     see "Entities"
//   S.mods, S.sheet              the modifier list of the last rebuild and the Sheet made from it (Stats.sheet)
//   S.skills                     [{inst, sheet, cd, t, n, target, a0..a3}]: one slot for each place of the loadout
//                                (cfg.sigils, or the character's loadout), in its order: a sigil instance, its
//                                SkillSheet, and room for the archetype's state (cd: seconds until the next
//                                cast). An empty place has inst and sheet null. Every rebuild follows the
//                                loadout: a slot whose sigil changed starts afresh, and no slot ever moves.
//   S.enemies, S.shots, S.areas, S.pickups, S.minions      Core.Pool
//   S.grid                       Core.Grid over S.enemies, rebuilt in every step (see the order below): it knows
//                                the enemies as they stood then, so not the ones spawned later in the step
//   S.region, S.props            the ground from World.region; S.props is S.region.props
//   S.gate, S.boss               null | {x, y, until, hold}; null | the boss's entity (set to null when it is removed)
//   S.offer, S.offerQueue        null | Offer; offers waiting behind it
//   S.chimes, S.buffs            {[chime id]: stacks}; a list the buff system keeps
//   S.events, S.eventCount, S.eventStart, S.eventsDropped   see "Events"
//   S.haul, S.gold, S.echoes, S.kills, S.counters           S.kills is counted here, in the deaths phase
//   S.dirty                      set it to true when modifiers changed; the sheets are rebuilt in the same step
//   S.result                     null | {outcome, mode, zone, seed, steps, time, tolls, threat, kills, gold, echoes,
//                                runLevel, haul (how many items), eventsDropped}
//   S.uid                        the last uid given out
//   S.debug                      null | the state of Sim.debugScene
//
// The order of a step, set here and nowhere else. Other namespaces are called only if they exist.
//    0  the event queue is emptied, and px, py of the player and of every entity take its x, y
//    1  Player.step(S, input)
//    2  Director.step(S)
//    3  S.grid.rebuild(S.enemies)
//    4  Enemies.step(S)
//    5  Skills.step(S)                 casting, then shots, areas, minions and their hits
//    6  Boss.step(S)
//    7  Dmg.tick(S)                    every 15th step: damage over time, 4 times a second
//    8  deaths                         an enemy with life <= 0: S.kills + 1, a 'kill' event, Director.onKill(S, enemy),
//                                      removal. A minion with life <= 0 is removed. Shots, areas and pickups lose
//                                      1/60 s of ttl and are removed when none is left: whoever spawns one gives it
//                                      a ttl in seconds (0.5 lasts 30 steps), or it is gone in the same step.
//                                      Anything killed by pool.kill() goes without a word. Pools are compacted
//                                      here and only here.
//    9  Player.pickups(S)
//   10  Sim.rebuild(S), if S.dirty
//   11  Offers.step(S)
//   12  the clock: S.step, S.t, and on time S.toll + 1 with a 'toll' event (just before it, what was made in
//       this step gets its px, py)
// A step that began in 'play' runs to its end even if the run ends or an offer opens on the way.
// In a debug scene (S.debug) steps 2, 4 and 6 are replaced by the scene's own rule: every enemy circles the
// spot where the player began. Without Player.step, the move vector of the input walks the player.
//
// Sheets. Sim.rebuild(S) gathers the modifiers: Char.mods(cfg.char, S, cfg.account) if the run has a character
// and that function exists, else cfg.mods; then whatever each Sim.source adds (chimes, buffs). Stats.sheet gets
// them with level (the character's, else cfg.level, else 1), weapon (cfg.weapon, else Char.weapon(char) if
// there is such a function, else none), vows (how many the character has active), chimes (the stacks in
// S.chimes) and conds (S.player.conds). Then S.skills is made to follow the loadout and every slot gets its
// SkillSheet. Whoever changes a modifier, the loadout or S.player.conds sets S.dirty; the rebuild comes at
// step 10, or at once after a command.
//
// Entities. Every pooled object has one fixed set of fields and is sealed, so a field that was not declared
// cannot be added by mistake. pool.alloc() gives one with every field at its default, alive = true and a new uid.
// A file that needs another field declares it while it loads: Sim.field('enemy', 'chargeT', 0). The default is
// a number, a boolean, a string or null. Kinds: enemy, minion, shot, area, pickup, player, skill. (Only files
// numbered above 20 can do so: this one has not run yet when the earlier ones load.)
//   all pooled    alive, uid, x, y, px, py (where it stood before the last step: draw between the two; a thing
//                 made in that step has its own place there), vx, vy, r (radius), face (radians),
//                 t (seconds; free for its system), state, stateT (free), a0, a1, a2, a3 (free numbers)
//   enemy, minion def, defHash, level, life, lifeMax, damage, speed, cd0..cd3 (attack cooldowns), kx, ky
//                 (knockback speed), tx, ty (a point it heads for), target (a uid), flash,
//                 condT, condV, condN: Float64Array(Stats.COND_MAX) indexed by Stats.AILMENT[id]: seconds left,
//                 strength, and a spare number (stacks, build-up)
//   enemy only    rank, xp, traits (4 slots of trait defs or null), traitN
//   minion only   skill (index into S.skills, -1 none), ttl (free: this file removes a minion by its life alone)
//   shot          def (the enemy Attack it came from, or null), team (0 the player's, 1 the enemies'), owner (uid;
//                 0 the player), skill, ttl, damage, dist, pierce, chain, fork, tx, ty, target,
//                 hits: Int32Array(8) of uids hit lately, hitN: how many were written
//   area          def, team, owner, skill, ttl, damage, tick, angle, len, target
//   pickup        kind, value, ttl, item
//   player        alive, uid (0), x, y, px, py, vx, vy, r, face, aimX, aimY, life, hush, hushWait, dodgeT, dodgeCd, invuln,
//                 draughts, draughtFill, runLevel, runXp, kx, ky, state, stateT, conds (a mask, Stats.condMask),
//                 evade, hurtT, killT, flash, condT, condV, condN, a0..a3
// Entities are reused: keep a uid, never the object, from one step to the next (S.boss is the one exception,
// and this file clears it). A loop over pool.items[0 .. pool.n) skips what is not alive.
//
// Events. S.events is a ring of S.rules.caps.events reused objects {k, x, y, a, b, id}. It holds what the last
// step that ran, or the last command, emitted: both empty it first, so read it after each call. Event i of
// S.eventCount is S.events[(S.eventStart + i) % S.events.length]; S.eventStart is 0 unless more events were
// emitted than the ring holds, in which case the oldest were overwritten and S.eventsDropped counts them.
// What a, b and id mean is up to the emitter; here: 'kill' a = rank, b = level, id = the enemy def's id;
// 'toll' a = S.toll; 'end' id = the outcome.
(function () {
  'use strict';

  const DT = Core.DT, HZ = Core.HZ, TAU = Core.TAU, hashMix = Core.hashMix;
  const round = Math.round, floor = Math.floor, cos = Math.cos, sin = Math.sin;
  const COMMON = 0, ELITE = 1, MINIBOSS = 2, BOSS = 3;
  const TICK = 15;                                   // steps between two calls of Dmg.tick
  const SLIVER = 1e-9;                               // seconds: a ttl this small has run out
  const PHASES = ['play', 'offer', 'ended'];
  const ZONE_RULES = ['tollSeconds', 'keeperToll', 'gateEvery'];   // zone fields that overrule the constants
  const NEEDED = ['tollSeconds', 'gridCell', 'playerRadius'];      // the constants this file itself cannot do without
  const CAPS = ['enemies', 'shots', 'areas', 'pickups', 'minions', 'events'];
  const LIFE = 'lifeMax', HUSH = 'hushMax', DRAUGHTS = 'draughtCharges';   // the stats this file reads by name
  const COMMANDS = { pick: true, banish: true, reroll: true, skip: true, leave: true, allocate: true, equip: true };
  const NONE = Object.freeze({}), NO_SIGILS = Object.freeze([]);
  const NO_INPUT = Object.freeze({ mx: 0, my: 0, ax: 1, ay: 0, aim: false, dodge: false, draught: false });

  Sim.COMMON = COMMON; Sim.ELITE = ELITE; Sim.MINIBOSS = MINIBOSS; Sim.BOSS = BOSS;
  Sim.NO_INPUT = NO_INPUT;

  // ---- entity fields ----
  // A table gives each field its default. A function as default makes an array that belongs to the one entity.

  const conds = () => new Float64Array(Stats.COND_MAX), uids = () => new Int32Array(8), slots = () => [null, null, null, null];
  const BASE = {
    alive: false, uid: 0, x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, r: 0, face: 0, t: 0, state: 0, stateT: 0, a0: 0, a1: 0, a2: 0, a3: 0,
  };
  const BODY = {
    def: null, defHash: 0, level: 1, life: 0, lifeMax: 0, damage: 0, speed: 0, cd0: 0, cd1: 0, cd2: 0, cd3: 0, kx: 0, ky: 0,
    tx: 0, ty: 0, target: 0, flash: 0, condT: conds, condV: conds, condN: conds,
  };
  const FIELDS = {
    enemy: Object.assign({}, BASE, BODY, { rank: 0, xp: 0, traitN: 0, traits: slots }),
    minion: Object.assign({}, BASE, BODY, { skill: -1, ttl: 0 }),
    shot: Object.assign({}, BASE, {
      def: null, team: 0, owner: 0, skill: -1, ttl: 0, damage: 0, dist: 0, pierce: 0, chain: 0, fork: 0, tx: 0, ty: 0, target: 0,
      hitN: 0, hits: uids,
    }),
    area: Object.assign({}, BASE, { def: null, team: 0, owner: 0, skill: -1, ttl: 0, damage: 0, tick: 0, angle: 0, len: 0, target: 0 }),
    pickup: Object.assign({}, BASE, { kind: 0, value: 0, ttl: 0, item: null }),
    player: {
      alive: false, uid: 0, x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, r: 0, face: 0, aimX: 1, aimY: 0, life: 0, hush: 0, hushWait: 0, dodgeT: 0,
      dodgeCd: 0, invuln: 0, draughts: 0, draughtFill: 0, runLevel: 0, runXp: 0, kx: 0, ky: 0, state: 0, stateT: 0, conds: 0,
      evade: 0, hurtT: 0, killT: 0, flash: 0, condT: conds, condV: conds, condN: conds, a0: 0, a1: 0, a2: 0, a3: 0,
    },
    skill: { inst: null, sheet: null, cd: 0, t: 0, n: 0, target: 0, a0: 0, a1: 0, a2: 0, a3: 0 },
  };
  const states = [], sources = [];
  let made = null;               // the factories, built when the first run is created; from then on the fields are fixed

  Sim.field = function (kind, name, value) {
    Core.assert(made === null, 'Sim.field: fields are fixed once a run exists; declare "' + name + '" while the file loads');
    Core.assert(FIELDS[kind] !== undefined, 'Sim.field: "' + kind + '" is not a kind of entity');
    Core.assert(typeof name === 'string' && name !== '' && !(name in FIELDS[kind]), 'Sim.field: ' + kind + ' already has a field "' + name + '"');
    Core.assert(value === null || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string',
      'Sim.field: the default of ' + kind + '.' + name + ' must be a number, a boolean, a string or null');
    FIELDS[kind][name] = value;
  };

  Sim.fields = function (kind) {
    Core.assert(FIELDS[kind] !== undefined, 'Sim.fields: "' + kind + '" is not a kind of entity');
    return Object.keys(FIELDS[kind]);
  };

  Sim.state = function (name, make) {
    Core.assert(made === null, 'Sim.state: slots are fixed once a run exists; declare "' + name + '" while the file loads');
    Core.assert(typeof name === 'string' && typeof make === 'function', 'Sim.state needs a name and a function (S) -> state');
    for (let i = 0; i < states.length; i++) Core.assert(states[i].name !== name, 'Sim.state: there are two slots named "' + name + '"');
    states.push({ name, make });
  };

  Sim.source = function (fn) {
    Core.assert(typeof fn === 'function', 'Sim.source needs a function (S, out)');
    sources.push(fn);
  };

  // make() gives a sealed object with every field of the table; reset(o) puts every field back to its default.
  // The first object is built with Object.defineProperty and the rest are copies of it, which keeps all of them
  // in the engine's fast layout whatever the number of fields (plain o[name] = v on a new object does not).
  function factory(kind) {
    const table = FIELDS[kind], names = Object.keys(table), defaults = names.map((name) => table[name]), n = names.length;
    const template = {}, desc = { value: null, writable: true, enumerable: true, configurable: true };
    for (let i = 0; i < n; i++) {
      desc.value = typeof defaults[i] === 'function' ? null : defaults[i];
      Object.defineProperty(template, names[i], desc);
    }
    return {
      make: function () {
        const o = { ...template };
        for (let i = 0; i < n; i++) if (typeof defaults[i] === 'function') o[names[i]] = defaults[i]();
        return Object.seal(o);
      },
      reset: function (o) {
        for (let i = 0; i < n; i++) {
          const d = defaults[i];
          if (typeof d !== 'function') o[names[i]] = d;
          else o[names[i]].fill(Array.isArray(o[names[i]]) ? null : 0);
        }
      },
    };
  }

  function factories() {
    if (made === null) {
      made = {};
      for (const kind of Object.keys(FIELDS)) made[kind] = factory(kind);
    }
    return made;
  }

  // ---- a new run ----

  function rulesFor(zone, cfg) {
    const rules = Object.assign({}, Defs.get('constants', 'main'));
    delete rules.id;
    for (let i = 0; i < ZONE_RULES.length; i++) if (zone[ZONE_RULES[i]] !== undefined) rules[ZONE_RULES[i]] = zone[ZONE_RULES[i]];
    Object.assign(rules, zone.rules, cfg.rules);
    for (const name of NEEDED) Core.assert(rules[name] > 0, 'Sim.create: the run needs the constant ' + name + ', above 0');
    for (const name of CAPS) Core.assert(rules.caps && rules.caps[name] > 0, 'Sim.create: the run needs the constant caps.' + name + ', above 0');
    return { ...rules };         // a copy made in one go: an object that had a key deleted is slow to read from
  }

  // Makes S.skills follow the loadout: cfg.sigils as it stands, or the sigils the character's loadout names.
  // Slot i is place i of the loadout whatever happens, so a shot can keep the index of the skill that made it;
  // a place with no sigil has inst null. A slot whose sigil changed starts afresh, the others keep their state.
  function syncSkills(S) {
    const cfg = S.cfg, char = cfg.char, places = cfg.sigils || (char && char.loadout && char.sigils ? char.loadout : NO_SIGILS);
    const skills = S.skills, F = factories().skill;
    while (skills.length < places.length) skills.push(F.make());
    skills.length = places.length;
    for (let i = 0; i < places.length; i++) {
      let inst = places[i] === undefined ? null : places[i];
      if (inst !== null && typeof inst !== 'object') inst = (char && char.sigils && char.sigils.find((s) => s.uid === places[i])) || null;   // a uid
      if (skills[i].inst === inst) continue;
      F.reset(skills[i]);
      skills[i].inst = inst;
    }
  }

  Sim.create = function (cfg) {
    Core.assert(cfg && (typeof cfg.seed === 'number' || typeof cfg.seed === 'string'), 'Sim.create needs cfg.seed, a number or a string');
    const F = factories(), mode = Defs.get('mode', cfg.mode || 'watch'), zone = Defs.get('zone', cfg.zone);
    const rules = rulesFor(zone, cfg), caps = rules.caps, root = new Core.RNG(cfg.seed);
    const S = {
      cfg, mode, zone, rules, curves: Defs.get('curves', 'main'),
      rng: { spawn: root.fork('spawn'), loot: root.fork('loot'), combat: root.fork('combat'), offers: root.fork('offers'), world: root.fork('world') },
      step: 0, t: 0, toll: 0, tollAt: 0, tollSteps: 0, threat: 0, phase: 'play',
      player: F.player.make(), mods: [], sheet: null, skills: [],
      enemies: null, shots: null, areas: null, pickups: null, minions: null,
      grid: new Core.Grid(rules.gridCell), region: null, props: null,
      gate: null, boss: null, offer: null, offerQueue: [], chimes: {}, buffs: [],
      events: [], eventCount: 0, eventStart: 0, eventsDropped: 0,
      haul: [], gold: 0, echoes: 0, kills: 0, counters: {},
      dirty: false, result: null, uid: 0, debug: null,
    };
    const pool = (kind, cap) => new Core.Pool(F[kind].make, cap, function (o) { F[kind].reset(o); o.uid = ++S.uid; });
    S.enemies = pool('enemy', caps.enemies);
    S.shots = pool('shot', caps.shots);
    S.areas = pool('area', caps.areas);
    S.pickups = pool('pickup', caps.pickups);
    S.minions = pool('minion', caps.minions);
    for (let i = 0; i < caps.events; i++) S.events.push({ k: '', x: 0, y: 0, a: 0, b: 0, id: null });
    S.tollSteps = Math.max(1, round(rules.tollSeconds * HZ));
    S.tollAt = S.tollSteps;
    S.region = World.region(S.rng.world.u32(), zone);
    S.props = S.region.props;

    const p = S.player;
    p.alive = true;
    p.x = p.px = S.region.x;
    p.y = p.py = S.region.y;
    p.r = rules.playerRadius;
    for (let i = 0; i < states.length; i++) {
      Core.assert(!(states[i].name in S), 'Sim.state: the run state has a field "' + states[i].name + '" already');
      S[states[i].name] = states[i].make(S);
    }

    const stats = Sim.rebuild(S).stats;
    p.life = stats[LIFE];
    p.hush = stats[HUSH];
    p.draughts = stats[DRAUGHTS];
    return S;
  };

  Sim.rebuild = function (S) {
    const cfg = S.cfg, char = cfg.char || null, p = S.player, mods = [];
    const own = char !== null && typeof Char.mods === 'function' ? Char.mods(char, S, cfg.account || null) : cfg.mods;
    for (let i = 0; own && i < own.length; i++) mods.push(own[i]);
    for (let i = 0; i < sources.length; i++) sources[i](S, mods);
    let chimes = 0;
    for (const id in S.chimes) chimes += S.chimes[id];
    S.mods = mods;
    S.sheet = Stats.sheet(mods, {
      level: char !== null && char.level > 0 ? char.level : cfg.level || 1,
      weapon: cfg.weapon || (char !== null && typeof Char.weapon === 'function' ? Char.weapon(char) : null),
      vows: char !== null && char.activeVows ? char.activeVows.length : 0,
      chimes,
      conds: p.conds,
    });
    syncSkills(S);
    for (let i = 0; i < S.skills.length; i++) {
      const skill = S.skills[i];
      skill.sheet = skill.inst === null ? null : Stats.skillSheet(mods, skill.inst, S.sheet);
    }
    if (p.life > S.sheet.stats[LIFE]) p.life = S.sheet.stats[LIFE];
    if (p.hush > S.sheet.stats[HUSH]) p.hush = S.sheet.stats[HUSH];
    S.dirty = false;
    return S.sheet;
  };

  // ---- events ----

  Sim.emit = function (S, k, x, y, a, b, id) {
    const ring = S.events;
    let slot = S.eventCount;
    if (slot < ring.length) S.eventCount = slot + 1;
    else {                       // full: the oldest event gives way
      slot = S.eventStart;
      S.eventStart = slot + 1 === ring.length ? 0 : slot + 1;
      S.eventsDropped++;
    }
    const e = ring[slot];
    e.k = k;
    e.x = x === undefined ? 0 : x;
    e.y = y === undefined ? 0 : y;
    e.a = a === undefined ? 0 : a;
    e.b = b === undefined ? 0 : b;
    e.id = id === undefined ? null : id;
  };

  // ---- enemies ----

  const curveAt = (curve, level) => (curve ? curve[(level < curve.length ? level : curve.length) - 1] : 1);

  Sim.spawnEnemy = function (S, id, x, y, opts) {
    const boss = !Defs.has('enemy', id) && Defs.has('boss', id), def = Defs.get(boss ? 'boss' : 'enemy', id);
    const e = S.enemies.alloc();
    if (e === null) return null;
    const o = opts || NONE, curves = S.curves;
    const level = Core.clamp(floor(o.level || S.zone.level || 1), 1, curves.levels);
    const rank = o.rank === undefined ? (boss ? BOSS : COMMON) : o.rank, mult = curves.rank ? curves.rank[rank] : undefined;
    e.def = def;
    e.defHash = Core.hashStr(def.id);
    e.x = e.px = x;
    e.y = e.py = y;
    e.r = def.radius * (mult ? mult.size : 1);
    e.face = Math.atan2(S.player.y - y, S.player.x - x);
    e.level = level;
    e.rank = rank;
    e.life = e.lifeMax = def.life * curveAt(curves.enemyLife, level) * (mult ? mult.life : 1);
    e.damage = def.damage * curveAt(curves.enemyDamage, level) * (mult ? mult.damage : 1);
    e.xp = def.xp * curveAt(curves.enemyXp, level) * (mult ? mult.xp : 1);
    e.speed = def.speed;
    for (let i = 0; o.traits && i < o.traits.length && i < e.traits.length; i++) e.traits[e.traitN++] = Defs.get('trait', o.traits[i]);
    return e;
  };

  // ---- the step ----

  // SLIVER: sixty sixtieths do not add up to exactly 1, and a ttl of half a second should last 30 steps, not 31.
  function expire(pool) {
    const items = pool.items;
    for (let i = 0; i < pool.n; i++) {
      const o = items[i];
      if (o.alive && (o.ttl -= DT) <= SLIVER) o.alive = false;
    }
    pool.compact();
  }

  // px, py: where a thing stood before the step, for drawing between two steps. hold(pool, -1) notes it for
  // everything; hold(pool, uid) only for what is newer than that uid, which has no earlier place than its own.
  function hold(pool, newerThan) {
    const items = pool.items;
    for (let i = 0; i < pool.n; i++) {
      const o = items[i];
      if (o.uid > newerThan) { o.px = o.x; o.py = o.y; }
    }
  }
  function holdAll(S, newerThan) {
    hold(S.enemies, newerThan);
    hold(S.minions, newerThan);
    hold(S.shots, newerThan);
    hold(S.areas, newerThan);
    hold(S.pickups, newerThan);
  }

  function deaths(S) {
    const enemies = S.enemies, minions = S.minions, onKill = typeof Director.onKill === 'function';
    for (let i = 0; i < enemies.n; i++) {
      const e = enemies.items[i];
      if (e.alive && e.life <= 0) {
        S.kills++;
        Sim.emit(S, 'kill', e.x, e.y, e.rank, e.level, e.def === null ? null : e.def.id);
        if (onKill) Director.onKill(S, e);
        e.alive = false;
      }
      if (!e.alive && S.boss === e) S.boss = null;
    }
    enemies.compact();           // S.grid notices and redoes its index if it is asked before the next step's rebuild
    for (let i = 0; i < minions.n; i++) {
      const m = minions.items[i];
      if (m.alive && m.life <= 0) m.alive = false;
    }
    minions.compact();
    expire(S.shots);
    expire(S.areas);
    expire(S.pickups);
  }

  Sim.step = function (S, input) {
    if (S.phase !== 'play') return false;
    const frame = input || NO_INPUT, debug = S.debug !== null, before = S.uid, p = S.player;
    S.eventCount = 0;
    S.eventStart = 0;
    p.px = p.x;
    p.py = p.y;
    holdAll(S, -1);
    if (typeof Player.step === 'function') Player.step(S, frame);
    else if (debug) debugWalk(S, frame);
    if (!debug && typeof Director.step === 'function') Director.step(S);
    S.grid.rebuild(S.enemies);
    if (debug) debugOrbit(S);
    else if (typeof Enemies.step === 'function') Enemies.step(S);
    if (typeof Skills.step === 'function') Skills.step(S);
    if (!debug && typeof Boss.step === 'function') Boss.step(S);
    if (S.step % TICK === TICK - 1 && typeof Dmg.tick === 'function') Dmg.tick(S);
    deaths(S);
    if (typeof Player.pickups === 'function') Player.pickups(S);
    if (S.dirty) Sim.rebuild(S);
    if (typeof Offers.step === 'function') Offers.step(S);
    holdAll(S, before);
    S.step++;
    S.t = S.step / HZ;
    if (S.step >= S.tollAt) {
      S.toll++;
      S.tollAt += S.tollSteps;
      Sim.emit(S, 'toll', p.x, p.y, S.toll, 0, null);
    }
    return true;
  };

  // ---- commands ----

  Sim.command = function (S, cmd) {
    const type = cmd ? cmd.type : undefined, char = S.cfg.char || null;
    let done = false;
    if (S.phase === 'ended') return false;
    if (COMMANDS[type] !== true) {
      console.warn('Sim.command: unknown command ' + JSON.stringify(cmd));
      return false;
    }
    S.eventCount = S.eventStart = 0;             // like a step, a command starts with an empty queue
    if (type === 'leave') {
      Sim.end(S, 'left');
      done = true;
    } else if (type === 'allocate') {
      if (char !== null && typeof Char.allocate === 'function') done = Char.allocate(char, cmd.id, cmd.choice) !== false;
      S.dirty = S.dirty || done;
    } else if (type === 'equip') {
      if (char !== null && typeof Char.equip === 'function') done = Char.equip(char, cmd.uid, cmd.slot) !== false;
      S.dirty = S.dirty || done;
    } else if (typeof Offers.resolve === 'function') {
      done = Offers.resolve(S, cmd) !== false;
    } else if (S.phase === 'offer' && (type === 'pick' || type === 'skip')) {
      // without an offer system the two only close the offer, so that a run can go on
      S.offer = S.offerQueue.length > 0 ? S.offerQueue.shift() : null;
      if (S.offer === null) S.phase = 'play';
      done = true;
    }
    if (S.dirty && S.phase !== 'ended') Sim.rebuild(S);
    return done;
  };

  // ---- the end, and what it comes to ----

  function totals(S, outcome) {
    return {
      outcome, mode: S.mode.id, zone: S.zone.id, seed: S.cfg.seed, steps: S.step, time: S.t, tolls: S.toll, threat: S.threat,
      kills: S.kills, gold: S.gold, echoes: S.echoes, runLevel: S.player.runLevel, haul: S.haul.length, eventsDropped: S.eventsDropped,
    };
  }

  Sim.result = function (S) { return S.result !== null ? S.result : totals(S, null); };

  Sim.end = function (S, outcome) {
    Core.assert(outcome === 'left' || outcome === 'died', 'Sim.end: the outcome is "left" or "died"');
    if (S.phase === 'ended') return S.result;
    if (outcome === 'died') S.player.alive = false;
    S.phase = 'ended';
    S.result = totals(S, outcome);
    Sim.emit(S, 'end', S.player.x, S.player.y, S.toll, S.kills, outcome);
    return S.result;
  };

  // ---- checksum ----
  // Positions count to the millimetre and amounts to the thousandth, so the last bits of a sum do not matter.

  // kind: 0 enemy, 1 minion, 2 shot or area, 3 pickup
  function hashPool(h, pool, kind) {
    const items = pool.items;
    let live = 0;
    for (let i = 0; i < pool.n; i++) {
      const o = items[i];
      if (!o.alive) continue;
      live++;
      h = hashMix(hashMix(hashMix(h, o.uid), round(o.x * 1000)), round(o.y * 1000));
      h = hashMix(h, o.state);
      if (kind >= 2) h = hashMix(h, round(o.ttl * 1000));
      else h = hashMix(hashMix(hashMix(h, round(o.life * 1000)), o.defHash), kind === 0 ? o.level * 4 + o.rank : o.level);
      if (kind === 3) h = hashMix(hashMix(h, o.kind), round(o.value * 1000));
    }
    return hashMix(h, live);
  }

  Sim.hash = function (S) {
    const p = S.player, rng = S.rng;
    let h = hashMix(0x70116, S.step);
    h = hashMix(hashMix(hashMix(hashMix(h, S.toll), S.threat), PHASES.indexOf(S.phase)), S.uid);
    h = hashMix(hashMix(hashMix(h, S.kills), round(S.gold * 1000)), round(S.echoes * 1000));
    h = rng.world.hash(rng.offers.hash(rng.combat.hash(rng.loot.hash(rng.spawn.hash(h)))));
    h = hashMix(hashMix(hashMix(h, round(p.x * 1000)), round(p.y * 1000)), p.alive);
    h = hashMix(hashMix(hashMix(h, round(p.life * 1000)), round(p.hush * 1000)), p.draughts);
    h = hashMix(hashMix(h, p.runLevel), round(p.runXp * 1000));
    for (let i = 0; i < S.skills.length; i++) h = hashMix(h, round(S.skills[i].cd * 1000));
    h = hashPool(h, S.enemies, 0);
    h = hashPool(h, S.minions, 1);
    h = hashPool(h, S.shots, 2);
    h = hashPool(h, S.areas, 2);
    return hashPool(h, S.pickups, 3);
  };

  // ---- the debug scene ----
  // Rings of husks round the player, each walking its ring: alternate rings turn the other way, and every husk
  // drifts a little in and out. An enemy keeps its ring in a0, its angle in a1, its turning speed in a2 and
  // the phase of its drift in a3; S.debug holds the centre.

  const RING_FIRST = 4, RING_STEP = 2.2, RING_SPACING = 1.4;   // metres: the first ring, between rings, between husks
  const ORBIT_SPEED = 0.6, DRIFT = 0.35, DRIFT_RATE = 0.8;      // metres a second, metres, radians a second
  const DEBUG_WALK = 5;                                         // metres a second, when nothing else moves the player

  Sim.debugScene = function (n, seed) {
    const S = Sim.create({ mode: 'watch', zone: 'debug', seed: seed === undefined ? 1 : seed });
    const p = S.player, rng = S.rng.spawn;
    S.debug = { x: p.x, y: p.y };
    for (let ring = 0, left = n; left > 0; ring++) {
      const R = RING_FIRST + ring * RING_STEP, count = Math.min(left, floor(TAU * R / RING_SPACING));
      const turn = rng.next() * TAU, spin = (ring % 2 === 0 ? 1 : -1) * ORBIT_SPEED / R;
      for (let i = 0; i < count; i++) {
        const a = turn + i / count * TAU, phase = rng.next() * TAU, r = R + DRIFT * sin(phase);   // where its drift has it at t = 0
        const e = Sim.spawnEnemy(S, 'debug.husk', p.x + cos(a) * r, p.y + sin(a) * r, null);
        if (e === null) return S;                  // the pool is full
        e.a0 = R;
        e.a1 = a;
        e.a2 = spin;
        e.a3 = phase;
      }
      left -= count;
    }
    return S;
  };

  function debugOrbit(S) {
    const centre = S.debug, items = S.enemies.items, drift = S.t * DRIFT_RATE;
    for (let i = 0; i < S.enemies.n; i++) {
      const e = items[i];
      if (!e.alive || !(e.a0 > 0)) continue;       // an enemy spawned later has no ring and stands where it was put
      e.a1 += e.a2 * DT;
      const R = e.a0 + DRIFT * sin(drift + e.a3), x = centre.x + cos(e.a1) * R, y = centre.y + sin(e.a1) * R;
      e.vx = (x - e.x) * HZ;
      e.vy = (y - e.y) * HZ;
      e.x = x;
      e.y = y;
      e.face = Core.angleWrap(e.a1 + (e.a2 > 0 ? TAU / 4 : -TAU / 4));
      e.t += DT;
    }
  }

  function debugWalk(S, input) {
    const p = S.player;
    p.vx = input.mx * DEBUG_WALK;
    p.vy = input.my * DEBUG_WALK;
    p.x += p.vx * DT;
    p.y += p.vy * DT;
    if (p.vx !== 0 || p.vy !== 0) p.face = Math.atan2(p.vy, p.vx);
    World.pushOut(S, p);
  }
})();
