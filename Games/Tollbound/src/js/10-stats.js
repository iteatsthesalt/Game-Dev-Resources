// 10-stats.js: the tables of damage types, tags, conditions and stats; what a list of modifiers adds up to;
// the player's sheet and the sheet of one sigil.
// Owns: Stats
//
// The rows of the tables are PROVISIONAL (docs/engine.md, "What is fixed and what is provisional"). Logic here
// and elsewhere loops over the tables and never names a row; only the handful of ids under "what the rules
// themselves name" below are used by name. To change the game's types, attributes, conditions or stats, change
// the rows.
//
// Public, tables (all frozen):
//   Stats.TYPES        [{id, elemental}]         damage types. A "type index" is a row number here.
//   Stats.TYPE         {id: type index}
//   Stats.FAMILIES     [id]                      weapon families
//   Stats.PRIMARIES    [{id, gives: {stat, value}}]   the attributes, and what one point of each gives
//   Stats.PER          [id]                      what a "per" modifier may count: the attributes, then level, vows, chimes
//   Stats.AILMENTS     [{id, from, chance?, build?, dot?, seconds?, stacks?, cond, player, ...}]
//                                                the conditions an entity can carry; see the table for the columns
//   Stats.AILMENT      {id: row number}          the index into an entity's condT, condV and condN arrays
//   Stats.COND_MAX     16                        the length of those arrays
//   Stats.TAGS         [id]                      every tag a modifier or a sigil may carry
//   Stats.CONDS        [{id, target, ailment}]   modifier conditions. target: it is about the enemy being hit.
//   Stats.COND         {id: bit number}          a set of conditions is a number with these bits set
//   Stats.STATS        [{id, base, min, max, skill?, pct?, int?, range?, from?, type?, prefix?}]
//                        skill   worked out for each sigil with its tags and copied into its skill sheet
//                        pct     a percentage where 100 is unchanged (a skill sheet holds it as a multiplier)
//                        int     a whole number, rounded down
//                        range   its flat values may be [min, max] pairs (added damage)
//                        from    its modifiers carry "from", the damage type the gain is taken from; type is
//                                the damage type it is gained as
//                        prefix  the row stands for every id that starts with this ('flag.', 'param.')
//   Stats.LEVEL_MAX    20                        the top level of a Scaled value
// Public, functions:
//   Stats.stat(id) -> row | null                 the row of a stat id, also for 'flag.<id>' and 'param.<key>'
//   Stats.is(table, id) -> boolean               table: 'stat' | 'tag' | 'cond' | 'dtype' | 'family' | 'primary' |
//                                                'counted' (Stats.PER) | 'ailment'
//   Stats.condMask(conds) -> number              a set of conditions from an array of ids (a number passes through)
//   Stats.scaled(value, level) -> number         a Scaled at an owner level: a number is itself; {a, b, curve} runs
//                                                from a at level 1 to b at level 20, 'lin' in equal steps, 'exp' by
//                                                equal factors. The level is held inside 1..20.
//   Stats.resolve(mods, level, out?) -> out      appends the modifiers with every Scaled value worked out at that
//                                                level (a modifier that is plain numbers already is appended as it
//                                                is). Whoever collects modifiers from an owner with a level calls it.
//   Stats.query(mods, stat, tags?, conds?, primaries?) -> number
//                                                the value of one stat from a list of modifiers:
//                                                  clamp(set ?? (base + flat) * max(0, 1 + inc/100) * product(1 + more/100), min, max)
//                                                A modifier counts when its stat is the one asked for, all its tags
//                                                are among tags, its cond (if any) is in conds (an array of ids or a
//                                                mask) and it is not local. A "per" modifier is multiplied by
//                                                min(cap, floor(primaries[per.stat] / per.div)). Of several "set" the
//                                                lowest wins. A Scaled value that was not resolved counts at level 1.
//                                                For a range stat this is the low end.
//   Stats.queryRange(mods, stat, tags, conds, primaries, out) -> out      both ends, as out[0] and out[1]
//   Stats.sheet(mods, ctx) -> Sheet              ctx: {level, weapon?, vows?, chimes?, conds?}
//   Stats.skillSheet(mods, sigilInst, sheet) -> SkillSheet
//   Stats.hitMult(skillSheet, typeIndex, conds) -> number
//                                                what the base damage of one type is multiplied by against a target
//                                                for which the conditions in conds (a mask) hold: the sheet's inc
//                                                and more for that type, with its targetMods on 'damage' added in
//   Stats.fits(sigilDef, bindingDef) -> boolean  the sigil has every tag the binding requires and none it excludes
//
// Sheet = {
//   level, weapon,                 as given in ctx. weapon: null | {family, damage: {[type]: [min, max]}, aps, crit}
//   conds,                         the mask of the player's conditions it was built for
//   primaries,                     {[id of Stats.PER]: number}: the attributes worked out, and the counts from ctx
//   stats,                         {[stat id]: value} for every row of Stats.STATS but the prefix rows, with no tags
//   res,                           Float64Array by type index: res.<type> + res.all (+ res.elemental), capped by resMax.<type>
//   taken,                         Float64Array by type index: what damage of that type is multiplied by (1 = unchanged)
//   flags,                         {[id]: true} for every flag.<id> some modifier raised above 0
// }
// The attributes come first: while they are worked out every attribute reads 0, so one cannot feed another.
// Then everything else, with one flat modifier per attribute for what a point of it gives (Stats.PRIMARIES).
//
// SkillSheet = {
//   id, def, level,                the sigil
//   usable,                        false when the sigil needs a weapon family the weapon is not; its rate is then 0
//   attack,                        it has the attack tag, so the weapon's damage, speed, crit and family count
//   tags,                          the sigil's tags, what its bindings add, and the weapon family for an armed attack
//   bindings,                      the binding defs that fit and were applied
//   mods,                          every modifier that went in: the list given, the sigil's and its bindings'
//   baseMin, baseMax,              Float64Array by type index: base damage (the sigil's own roll, the weapon's
//                                  share, added damage times eff, then what is gained as extra from other types)
//   inc, more,                     by type index: the sum of inc percent and the product of more for 'damage'
//   min, max,                      by type index: the hit range, base * max(0, 1 + inc/100) * more
//   pen,                           by type index: penetration
//   critChance, critMulti,         percent (0..100) and percent (150 = one and a half times)
//   rate,                          casts a second: the sigil's rate * the weapon's attacks a second (armed attacks) * speed
//   area, projSpeed, duration, range, minionLife        multipliers (1 = unchanged)
//   projectiles, pierce, chain, fork, knockback         plain numbers (one field for every stat row marked skill)
//   ailChance, ailBuild, ailDuration,   Float64Array by row of Stats.AILMENTS: chance in percent, build-up
//                                  multiplier, duration multiplier
//   dot,                           Float64Array, [row of Stats.AILMENTS * types + type index]: the share of the
//                                  hit's base damage of that type dealt each second by that ailment
//   params,                        {[key]: number}: the sigil's params at its level, plus its bindings' params,
//                                  then modifiers of param.<key>
//   targetMods,                    [{stat, op, value, hi, cond, types, skill}]: modifiers whose condition is about
//                                  the target, left out of everything above for the hit code to apply. cond is a
//                                  bit number, types a mask of the type indices whose hit tags it fits, skill is
//                                  true when it fits the sigil without a type.
// }
// Hit tags of a type: the sheet's tags, the type, 'hit', and 'elemental' for an elemental type. Tags of damage
// over time: the type, 'elemental' if it is, 'dot' and the ailment; a sigil's other tags never scale it.
(function () {
  'use strict';

  const floor = Math.floor, pow = Math.pow;
  const LEVEL_MAX = 20, COND_MAX = 16;

  // ---- the tables ----

  const TYPES = [
    { id: 'physical', elemental: false },
    { id: 'fire', elemental: true },
    { id: 'cold', elemental: true },
    { id: 'lightning', elemental: true },
    { id: 'void', elemental: false },
  ];
  const FAMILIES = ['sword', 'axe', 'mace', 'dagger', 'bow', 'staff', 'wand', 'shield', 'focus'];
  const PRIMARIES = [
    { id: 'str', gives: { stat: 'lifeMax', value: 2 } },
    { id: 'dex', gives: { stat: 'evasion', value: 3 } },
    { id: 'int', gives: { stat: 'hushMax', value: 2 } },
  ];
  const COUNTS = ['level', 'vows', 'chimes'];     // what a sheet's ctx brings for "per" modifiers; level starts at 1

  // The conditions an entity can carry. Columns:
  //   from     the damage types whose hits bring it           attack   only hits of attack sigils bring it
  //   chance   it lands by the roll chance.<id>               build    it builds up, scaled by build.<id>
  //   dot      percent of the hit's base damage each second   seconds  how long it lasts
  //   stacks   how many run at once                           amount   weakest and strongest effect, in percent
  //   cond     the modifier condition that holds while a target carries it
  //   player   whether the player can carry it
  // and the odd ones: follows (it shows while that row builds up), bossSeconds, immune (seconds), melee (melee
  // hits build it up this many times as fast).
  const AILMENTS = [
    { id: 'ignite', from: ['fire'], chance: true, dot: 30, seconds: 4, stacks: 1, cond: 'tIgnited', player: true },
    { id: 'bleed', from: ['physical'], attack: true, chance: true, dot: 25, seconds: 5, stacks: 1, cond: 'tBleeding', player: true },
    { id: 'poison', from: ['physical', 'void'], chance: true, dot: 20, seconds: 3, stacks: 8, cond: 'tPoisoned', player: true },
    { id: 'shock', from: ['lightning'], chance: true, amount: [5, 40], seconds: 4, stacks: 1, cond: 'tShocked', player: true },
    { id: 'chill', from: ['cold'], follows: 'freeze', amount: [10, 30], cond: 'tChilled', player: true },
    { id: 'freeze', from: ['cold'], build: true, seconds: 1.5, bossSeconds: 0.5, immune: 6, cond: 'tFrozen', player: false },
    { id: 'stun', from: ['physical'], build: true, melee: 1.5, seconds: 1, cond: null, player: false },
  ];

  // What the rules themselves name: the tags that decide how a hit is put together, and the stats of the hit formula.
  const ATTACK = 'attack', HIT = 'hit', DOT = 'dot', ELEMENTAL = 'elemental';
  const DAMAGE = 'damage', CRIT = 'critChance', SPEED = 'speed', TAKEN = 'taken', AIL_DURATION = 'ailmentDuration';
  const RES_ALL = 'res.all', RES_ELEMENTAL = 'res.elemental', FLAG = 'flag.', PARAM = 'param.';

  const ROLE_TAGS = [ELEMENTAL, ATTACK, 'spell', 'melee', 'projectile', 'area', 'minion', 'duration', 'chain', 'beam', 'orbit',
    'deployable', HIT, DOT];
  const PLAYER_CONDS = ['lowLife', 'fullLife', 'moving', 'still', 'recentKill', 'recentHurt', 'recentDodge', 'draughtActive', 'hushFull'];
  const TARGET_CONDS = ['tElite', 'tBoss', 'tNear', 'tFar'];        // besides one for each ailment that has a cond

  // Stat rows as [id, base, least, most, marks]; the marks are s (skill), % (pct) and i (int), see the header.
  // The families by type, by ailment and by prefix are added below.
  const ROWS = [
    ['lifeMax', 60, 1, 1e7], ['lifeRegen', 0, 0, 1e6], ['lifeOnKill', 0, 0, 1e6], ['lifeOnHit', 0, 0, 1e6],
    ['hushMax', 0, 0, 1e7], ['hushDelay', 4, 0.25, 60], ['hushRate', 25, 0, 1000],
    ['armour', 0, 0, 1e7], ['evasion', 0, 0, 1e7], [RES_ELEMENTAL, 0, -200, 200], [RES_ALL, 0, -200, 200],
    [TAKEN, 100, 0, 1000, '%'], ['moveSpeed', 5, 0.5, 15], ['dodgeCooldown', 1.2, 0.2, 30],
    ['draughtCharges', 3, 0, 12, 'i'], ['draughtHeal', 40, 0, 100], ['draughtGain', 100, 0, 1000, '%'],
    ['pickupRadius', 2.5, 0, 40], ['xpGain', 100, 0, 1000, '%'], ['goldFind', 100, 0, 1000, '%'],
    ['itemRarity', 100, 0, 1000, '%'], ['itemQuantity', 100, 0, 1000, '%'], ['echoGain', 100, 0, 1000, '%'],
    ['candleMax', 3, 0, 99, 'i'],
    [DAMAGE, 100, 0, 1e6, '%'], [CRIT, 0, 0, 100], ['critMulti', 150, 100, 1000, 's'], [SPEED, 100, 10, 1000, '%'],
    ['area', 100, 10, 1000, 's%'], ['projectiles', 0, 0, 50, 'si'], ['pierce', 0, 0, 99, 'si'], ['chain', 0, 0, 99, 'si'],
    ['fork', 0, 0, 9, 'si'], ['projSpeed', 100, 10, 1000, 's%'], ['duration', 100, 10, 1000, 's%'],
    ['range', 100, 10, 1000, 's%'], ['knockback', 0, 0, 30, 's'], [AIL_DURATION, 100, 10, 1000, '%'],
    ['minionLife', 100, 10, 10000, 's%'],
  ];

  // ---- everything derived from the tables ----

  // Look-ups by id have no prototype behind them: an id that happens to be "constructor" finds nothing.
  const index = (rows) => { const map = Object.create(null); rows.forEach((r, i) => { map[r.id] = i; }); return map; };
  const TYPE = index(TYPES), AILMENT = index(AILMENTS);
  const PER = PRIMARIES.map((p) => p.id).concat(COUNTS);
  const TAGS = TYPES.map((t) => t.id).concat(FAMILIES, ROLE_TAGS, AILMENTS.map((a) => a.id));
  const CONDS = PLAYER_CONDS.map((id) => ({ id, target: false, ailment: null }))
    .concat(AILMENTS.filter((a) => a.cond).map((a) => ({ id: a.cond, target: true, ailment: a.id })))
    .concat(TARGET_CONDS.map((id) => ({ id, target: true, ailment: null })));
  const COND = index(CONDS);
  let TARGET_BITS = 0;
  CONDS.forEach((c, bit) => { if (c.target) TARGET_BITS |= 1 << bit; });
  Core.assert(AILMENTS.length <= COND_MAX, 'Stats: more ailments than an entity has room for (COND_MAX)');
  Core.assert(CONDS.length <= 31 && TYPES.length <= 31, 'Stats: conditions and types are kept as bits of one number, 31 at most');

  const STATS = [];
  const row = (id, base, min, max, marks, more) => {
    const m = marks || '', r = Object.assign({ id, base, min, max }, more);
    if (m.includes('s')) r.skill = true;
    if (m.includes('%')) r.pct = true;
    if (m.includes('i')) r.int = true;
    STATS.push(r);
    return id;
  };
  PRIMARIES.forEach((p) => row(p.id, 0, 0, 1e5, 'i'));
  ROWS.forEach((r) => row(r[0], r[1], r[2], r[3], r[4]));
  const RES = TYPES.map((t) => row('res.' + t.id, 0, -200, 200));
  const RES_MAX = TYPES.map((t) => row('resMax.' + t.id, 75, 0, 90));
  const PEN = TYPES.map((t) => row('pen.' + t.id, 0, 0, 100));
  const ADDED = TYPES.map((t) => row('added.' + t.id, 0, 0, 1e7, '', { range: true }));
  const GAIN = TYPES.map((t) => row('gainAsExtra.' + t.id, 0, 0, 1000, '', { from: true, type: t.id }));
  const CHANCE = AILMENTS.map((a) => (a.chance ? row('chance.' + a.id, 0, 0, 100) : null));
  const BUILD = AILMENTS.map((a) => (a.build ? row('build.' + a.id, 100, 0, 1000, '%') : null));
  row(FLAG + '*', 0, 0, 1, '', { prefix: FLAG });
  row(PARAM + '*', 0, -1e9, 1e9, '', { prefix: PARAM });

  const BY_ID = Object.create(null);
  STATS.forEach((r) => { BY_ID[r.id] = r; });
  const PREFIX_ROWS = STATS.filter((r) => r.prefix), PLAIN_ROWS = STATS.filter((r) => !r.prefix), SKILL_ROWS = STATS.filter((r) => r.skill);
  const FLAG_ROW = BY_ID[FLAG + '*'], PARAM_ROW = BY_ID[PARAM + '*'];
  const INHERENT = PRIMARIES.map((p) => ({ stat: p.gives.stat, op: 'flat', value: p.gives.value, per: { stat: p.id, div: 1 } }));
  const TYPE_TAGS = TYPES.map((t) => (t.elemental ? [t.id, ELEMENTAL] : [t.id]));
  const DOT_TAGS = AILMENTS.map((a) => TYPES.map((t) => TYPE_TAGS[TYPE[t.id]].concat(DOT, a.id)));
  const SETS = {
    tag: new Set(TAGS), cond: new Set(CONDS.map((c) => c.id)), dtype: new Set(TYPES.map((t) => t.id)), family: new Set(FAMILIES),
    primary: new Set(PRIMARIES.map((p) => p.id)), counted: new Set(PER), ailment: new Set(AILMENTS.map((a) => a.id)),
  };
  const NO_TAGS = Object.freeze([]), NONE = Object.freeze({});

  Stats.TYPES = TYPES; Stats.TYPE = TYPE; Stats.FAMILIES = FAMILIES; Stats.PRIMARIES = PRIMARIES; Stats.PER = PER;
  Stats.AILMENTS = AILMENTS; Stats.AILMENT = AILMENT; Stats.COND_MAX = COND_MAX; Stats.TAGS = TAGS;
  Stats.CONDS = CONDS; Stats.COND = COND; Stats.STATS = STATS; Stats.LEVEL_MAX = LEVEL_MAX;
  Core.deepFreeze([TYPES, TYPE, FAMILIES, PRIMARIES, PER, AILMENTS, AILMENT, TAGS, CONDS, COND, STATS, INHERENT, TYPE_TAGS, DOT_TAGS]);

  Stats.stat = function (id) {
    const known = BY_ID[id];
    if (known !== undefined) return known.prefix ? null : known;
    if (typeof id !== 'string') return null;
    for (let i = 0; i < PREFIX_ROWS.length; i++) {
      const p = PREFIX_ROWS[i].prefix;
      if (id.length > p.length && id.startsWith(p)) return PREFIX_ROWS[i];
    }
    return null;
  };

  Stats.is = function (table, id) {
    if (table === 'stat') return Stats.stat(id) !== null;
    Core.assert(SETS[table] !== undefined, 'Stats.is: no table "' + table + '"');
    return SETS[table].has(id);
  };

  function condMask(conds) {
    if (typeof conds === 'number') return conds;
    let mask = 0;
    if (conds) for (let i = 0; i < conds.length; i++) if (COND[conds[i]] !== undefined) mask |= 1 << COND[conds[i]];
    return mask;
  }
  Stats.condMask = condMask;

  function scaled(value, level) {
    if (typeof value === 'number') return value;
    const t = ((level < 1 ? 1 : level > LEVEL_MAX ? LEVEL_MAX : level) - 1) / (LEVEL_MAX - 1);
    return value.curve === 'exp' ? value.a * pow(value.b / value.a, t) : value.a + (value.b - value.a) * t;
  }
  Stats.scaled = scaled;

  Stats.resolve = function (mods, level, out) {
    const list = out || [];
    for (let i = 0; mods && i < mods.length; i++) {
      const m = mods[i], v = m.value, pair = Array.isArray(v);
      if (typeof v === 'number' || (pair && typeof v[0] === 'number' && typeof v[1] === 'number')) list.push(m);
      else list.push(Object.assign({}, m, { value: pair ? [scaled(v[0], level), scaled(v[1], level)] : scaled(v, level) }));
    }
    return list;
  };

  // ---- adding modifiers up ----
  // fold() gathers what the fitting modifiers of one stat give into the variables below, and finish() turns
  // that into the stat's value. Nothing is allocated, so the same code serves the sheets and single queries.

  let aLo = 0, aHi = 0, aInc = 0, aMore = 1, aSet = 0, aSetHi = 0, aHasSet = false;
  let vLo = 0, vHi = 0;

  function within(few, many) {                    // is every tag of the first list in the second?
    for (let i = 0; i < few.length; i++) {
      let found = false;
      for (let j = 0; j < many.length && !found; j++) found = many[j] === few[i];
      if (!found) return false;
    }
    return true;
  }

  // The low and high end of what one modifier is worth, into vLo and vHi: its value, times what "per" counts.
  function amount(m, prim) {
    const v = m.value;
    if (typeof v === 'number') vLo = vHi = v;
    else if (Array.isArray(v)) { vLo = scaled(v[0], 1); vHi = scaled(v[1], 1); }
    else vLo = vHi = scaled(v, 1);
    const per = m.per;
    if (per === undefined) return;
    let times = floor(prim[per.stat] / per.div);
    if (!(times > 0)) times = 0;
    if (per.cap !== undefined && times > per.cap) times = per.cap;
    vLo *= times;
    vHi *= times;
  }

  // stat: only modifiers of this stat count (null: the list is of one stat already).
  // from: only modifiers that take their gain from this damage type count (null: any).
  function fold(mods, stat, tags, conds, prim, from) {
    aLo = 0; aHi = 0; aInc = 0; aMore = 1; aSet = 0; aSetHi = 0; aHasSet = false;
    if (!mods) return;
    for (let i = 0; i < mods.length; i++) {
      const m = mods[i];
      if (stat !== null && m.stat !== stat) continue;
      if (m.local === true || (from !== null && m.from !== from)) continue;
      if (m.cond !== undefined) {
        const bit = COND[m.cond];
        if (bit === undefined || ((conds >>> bit) & 1) === 0) continue;
      }
      if (m.tags !== undefined && !within(m.tags, tags)) continue;
      amount(m, prim);
      const op = m.op;
      if (op === 'flat') { aLo += vLo; aHi += vHi; }
      else if (op === 'inc') aInc += vLo;
      else if (op === 'more') aMore *= vLo > -100 ? 1 + vLo / 100 : 0;
      else if (op === 'set' && (!aHasSet || vLo < aSet)) { aSet = vLo; aSetHi = vHi; aHasSet = true; }
    }
  }

  function finish(r, base, high) {
    let v;
    if (aHasSet) v = high ? aSetHi : aSet;
    else v = (base + (high ? aHi : aLo)) * (aInc > -100 ? 1 + aInc / 100 : 0) * aMore;
    if (v !== v) v = base;                        // a modifier without a number: fall back to the base
    v = v < r.min ? r.min : v > r.max ? r.max : v;
    return r.int ? floor(v + 1e-9) : v;
  }

  function value(list, r, tags, conds, prim) {
    fold(list, null, tags, conds, prim, null);
    return finish(r, r.base, false);
  }

  function rowOf(stat, who) {
    const r = Stats.stat(stat);
    Core.assert(r !== null, who + ': "' + stat + '" is not a stat');
    return r;
  }

  Stats.query = function (mods, stat, tags, conds, primaries) {
    const r = rowOf(stat, 'Stats.query');
    fold(mods, stat, tags || NO_TAGS, condMask(conds), primaries || NONE, null);
    return finish(r, r.base, false);
  };

  Stats.queryRange = function (mods, stat, tags, conds, primaries, out) {
    const r = rowOf(stat, 'Stats.queryRange');
    fold(mods, stat, tags || NO_TAGS, condMask(conds), primaries || NONE, null);
    out[0] = finish(r, r.base, false);
    out[1] = finish(r, r.base, true);
    return out;
  };

  // The modifiers sorted by stat, so that a sheet reads the list once and not once for each stat.
  function bucket(mods, into) {
    for (let i = 0; mods && i < mods.length; i++) {
      const list = into.get(mods[i].stat);
      if (list === undefined) into.set(mods[i].stat, [mods[i]]);
      else list.push(mods[i]);
    }
    return into;
  }

  // ---- the player's sheet ----

  const attrs = new Float64Array(PRIMARIES.length);
  const FIELD = { value: 0, writable: true, enumerable: true, configurable: true };

  Stats.sheet = function (mods, ctx) {
    const c = ctx || NONE, conds = condMask(c.conds) & ~TARGET_BITS, by = bucket(mods, bucket(INHERENT, new Map()));
    const prim = {}, stats = {}, flags = {}, n = TYPES.length;
    for (let i = 0; i < PER.length; i++) prim[PER[i]] = 0;
    for (let i = 0; i < COUNTS.length; i++) prim[COUNTS[i]] = c[COUNTS[i]] > 0 ? c[COUNTS[i]] : 0;
    if (!(prim.level >= 1)) prim.level = 1;

    for (let i = 0; i < PRIMARIES.length; i++) attrs[i] = value(by.get(PRIMARIES[i].id), BY_ID[PRIMARIES[i].id], NO_TAGS, conds, prim);
    for (let i = 0; i < PRIMARIES.length; i++) prim[PRIMARIES[i].id] = attrs[i];
    for (let i = 0; i < PLAIN_ROWS.length; i++) {
      // defineProperty and not stats[id] = v: with this many keys it keeps the object in the engine's fast layout
      const r = PLAIN_ROWS[i];
      FIELD.value = SETS.primary.has(r.id) ? prim[r.id] : value(by.get(r.id), r, NO_TAGS, conds, prim);
      Object.defineProperty(stats, r.id, FIELD);
    }

    const res = new Float64Array(n), taken = new Float64Array(n);
    for (let t = 0; t < n; t++) {
      const raw = stats[RES[t]] + stats[RES_ALL] + (TYPES[t].elemental ? stats[RES_ELEMENTAL] : 0), cap = stats[RES_MAX[t]];
      res[t] = raw < cap ? raw : cap;
      taken[t] = value(by.get(TAKEN), BY_ID[TAKEN], TYPE_TAGS[t], conds, prim) / 100;
    }
    by.forEach((list, stat) => {
      if (typeof stat === 'string' && stat.startsWith(FLAG) && value(list, FLAG_ROW, NO_TAGS, conds, prim) > 0) flags[stat.slice(FLAG.length)] = true;
    });
    return { level: prim.level, weapon: c.weapon || null, conds, primaries: prim, stats, res, taken, flags };
  };

  // ---- the sheet of one sigil ----

  Stats.fits = function (sigil, binding) {
    if (!within(binding.requires, sigil.tags)) return false;
    for (let i = 0; i < binding.excludes.length; i++) if (sigil.tags.includes(binding.excludes[i])) return false;
    return true;
  };

  const firstLo = new Float64Array(TYPES.length), firstHi = new Float64Array(TYPES.length);
  const add = (list, item) => { if (item && !list.includes(item)) list.push(item); };

  Stats.skillSheet = function (mods, inst, sheet) {
    const def = Defs.get('sigil', inst.id), level = inst.level >= 1 ? inst.level : 1;
    const prim = sheet.primaries, conds = sheet.conds, weapon = sheet.weapon, n = TYPES.length;

    // tags: the sigil's own, then what its bindings add; a binding that does not fit the sigil is left out
    const tags = def.tags.slice(), bindings = [], sockets = inst.bindings || NO_TAGS;
    for (let i = 0; i < sockets.length; i++) {
      const b = sockets[i] ? Defs.get('binding', sockets[i]) : null;
      if (b === null || !Stats.fits(def, b)) continue;
      bindings.push(b);
      for (let j = 0; j < b.addTags.length; j++) add(tags, b.addTags[j]);
    }
    const attack = tags.includes(ATTACK), armed = attack && weapon !== null;
    const usable = !def.weapon || (weapon !== null && def.weapon.includes(weapon.family));
    if (armed) add(tags, weapon.family);
    const skillTags = tags.concat(HIT), hitTags = TYPES.map((t) => tags.concat(TYPE_TAGS[TYPE[t.id]], HIT));

    // every modifier that can touch this sigil: the list given, the sigil's own and its bindings', at its level
    const all = mods ? mods.slice() : [];
    Stats.resolve(def.mods, level, all);
    for (let i = 0; i < bindings.length; i++) Stats.resolve(bindings[i].mods, level, all);
    const by = bucket(all, new Map());

    const ss = {
      id: def.id, def, level, usable, attack, tags, bindings, mods: all,
      baseMin: new Float64Array(n), baseMax: new Float64Array(n), inc: new Float64Array(n), more: new Float64Array(n),
      min: new Float64Array(n), max: new Float64Array(n), pen: new Float64Array(n),
      critChance: 0, rate: 0,
      ailChance: new Float64Array(COND_MAX), ailBuild: new Float64Array(COND_MAX), ailDuration: new Float64Array(COND_MAX),
      dot: new Float64Array(COND_MAX * n), params: {}, targetMods: [],
    };

    // base damage of each type: the sigil's own roll, the weapon's share for an armed attack, added damage times eff
    const share = armed ? scaled(def.weaponPct, level) / 100 : 0;
    for (let t = 0; t < n; t++) {
      const id = TYPES[t].id, own = def.damage[id], held = armed ? weapon.damage[id] : undefined, r = BY_ID[ADDED[t]];
      fold(by.get(ADDED[t]), null, hitTags[t], conds, prim, null);
      firstLo[t] = (own ? scaled(own[0], level) : 0) + (held ? held[0] * share : 0) + finish(r, r.base, false) * def.eff;
      firstHi[t] = (own ? scaled(own[1], level) : 0) + (held ? held[1] * share : 0) + finish(r, r.base, true) * def.eff;
    }
    for (let t = 0; t < n; t++) {
      // what is gained as extra of this type comes from the first bases of the other types, never from another gain
      let lo = firstLo[t], hi = firstHi[t];
      const gains = by.get(GAIN[t]);
      for (let f = 0; gains !== undefined && f < n; f++) {
        if (f === t || firstHi[f] <= 0) continue;
        fold(gains, null, hitTags[t], conds, prim, TYPES[f].id);
        const part = finish(BY_ID[GAIN[t]], 0, false) / 100;
        lo += firstLo[f] * part;
        hi += firstHi[f] * part;
      }
      fold(by.get(DAMAGE), null, hitTags[t], conds, prim, null);
      const scale = (aInc > -100 ? 1 + aInc / 100 : 0) * aMore;
      ss.baseMin[t] = lo; ss.baseMax[t] = hi; ss.inc[t] = aInc; ss.more[t] = aMore;
      ss.min[t] = lo * scale; ss.max[t] = hi * scale;
      ss.pen[t] = value(by.get(PEN[t]), BY_ID[PEN[t]], hitTags[t], conds, prim);
    }

    fold(by.get(CRIT), null, skillTags, conds, prim, null);
    ss.critChance = finish(BY_ID[CRIT], def.crit + (armed ? weapon.crit : 0), false);
    const speed = value(by.get(SPEED), BY_ID[SPEED], skillTags, conds, prim) / 100;
    ss.rate = usable ? scaled(def.rate, level) * (armed ? weapon.aps : 1) * speed : 0;
    for (let i = 0; i < SKILL_ROWS.length; i++) {
      const r = SKILL_ROWS[i], v = value(by.get(r.id), r, skillTags, conds, prim);
      ss[r.id] = r.pct ? v / 100 : v;
    }

    for (let a = 0; a < AILMENTS.length; a++) {
      const ail = AILMENTS[a], ailTags = skillTags.concat(ail.id);
      if (CHANCE[a] !== null) ss.ailChance[a] = value(by.get(CHANCE[a]), BY_ID[CHANCE[a]], ailTags, conds, prim);
      if (BUILD[a] !== null) ss.ailBuild[a] = value(by.get(BUILD[a]), BY_ID[BUILD[a]], ailTags, conds, prim) / 100;
      ss.ailDuration[a] = value(by.get(AIL_DURATION), BY_ID[AIL_DURATION], ailTags, conds, prim) / 100;
      for (let i = 0; ail.dot !== undefined && i < ail.from.length; i++) {
        const t = TYPE[ail.from[i]];
        fold(by.get(DAMAGE), null, DOT_TAGS[a][t], conds, prim, null);
        ss.dot[a * n + t] = ail.dot / 100 * (aInc > -100 ? 1 + aInc / 100 : 0) * aMore;
      }
    }

    for (const key in def.params) ss.params[key] = scaled(def.params[key], level);
    for (let i = 0; i < bindings.length; i++) {
      for (const key in bindings[i].params) ss.params[key] = (ss.params[key] || 0) + bindings[i].params[key];
    }
    for (const key in ss.params) {
      const list = by.get(PARAM + key);
      if (list === undefined) continue;
      fold(list, null, skillTags, conds, prim, null);
      ss.params[key] = finish(PARAM_ROW, ss.params[key], false);
    }

    // modifiers that depend on the target cannot be settled here: they are set aside, worth and reach worked out
    for (let i = 0; i < all.length; i++) {
      const m = all[i], bit = m.cond === undefined ? undefined : COND[m.cond];
      if (bit === undefined || !CONDS[bit].target || m.local === true) continue;
      const skill = m.tags === undefined || within(m.tags, skillTags);
      let types = 0;
      for (let t = 0; t < n; t++) if (m.tags === undefined || within(m.tags, hitTags[t])) types |= 1 << t;
      if (types === 0 && !skill) continue;
      amount(m, prim);
      ss.targetMods.push({ stat: m.stat, op: m.op, value: vLo, hi: vHi, cond: bit, types, skill });
    }
    return ss;
  };

  Stats.hitMult = function (ss, t, conds) {
    let inc = ss.inc[t], more = ss.more[t];
    const list = ss.targetMods;
    for (let i = 0; i < list.length; i++) {
      const m = list[i];
      if (m.stat !== DAMAGE || ((m.types >>> t) & 1) === 0 || ((conds >>> m.cond) & 1) === 0) continue;
      if (m.op === 'inc') inc += m.value;
      else if (m.op === 'more') more *= m.value > -100 ? 1 + m.value / 100 : 0;
    }
    return (inc > -100 ? 1 + inc / 100 : 0) * more;
  };
})();
