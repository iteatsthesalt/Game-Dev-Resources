// 10-stats.js: the tables of the kinds of harm, the families of finds, the attributes, the conditions a body carries,
// tags, modifier conditions and stats; what a list of modifiers adds up to; the player's sheet and the sheet of one
// voice.
// Owns: Stats
//
// The rows are the design's: docs/design/02-combat.md, sections 15.1 to 15.8. Logic here and elsewhere loops over the
// tables and never names a row; only the ids under "what the rules themselves name" below are used by name. To change
// the game's kinds of harm, attributes, conditions or stats, change the rows.
//
// Public, tables (all frozen):
//   Stats.TYPES        [{id, guard, shown, ticks, bare, guardBase, guardMax}]   the kinds of harm; a "kind index" is
//                                                a row number here
//                        guard      the posture that guards against it: 'brace' | 'stride' | 'lee'
//                        shown      how it is warned: 'windup' | 'none' | 'fill'; a wound's depth comes from it
//                        ticks      dealt on Dmg.tick, four times a second, and not on landing
//                        bare       it ignores the target's guards and harm-taken modifiers (only Wrong-footed adds)
//                        guardBase, guardMax   the base and the cap of its rows guard.<id> and guard-max.<id>
//   Stats.TYPE         {id: kind index}
//   Stats.FAMILIES     [id]                      the families of finds: the six trade tools. A family is a tag.
//   Stats.PRIMARIES    [{id, gives: [{stat, op, value, div, tags?, cond?}]}]   the attributes. Each give is one
//                                                modifier, counted once for every div points of the attribute.
//   Stats.PER          [id]                      what a "per" modifier may count: the attributes, then level,
//                                                observances, favours, finds and debts
//   Stats.AILMENTS     [{id, by, rule?, on, spares?, seconds?, keeperSeconds?, stacks?, keeperStacks?, playerStacks?,
//                        immune?, amount?, chance?, cond, player}]   the conditions a body can carry:
//                        by         'rule': a behaviour applies and runs it, the one named in rule; 'effect': a voice,
//                                   knot, favour, observance or class rule lays it
//                        rule       the id of the behaviour, when by is 'rule'
//                        on         who carries it: 'dead', 'player' or 'both'
//                        spares     what never carries it: any of 'small', 'large', 'elite', 'keeper'
//                        seconds    how long it lasts; keeperSeconds on a keeper
//                        stacks     the most of it a body holds; keeperStacks on a keeper, playerStacks on the player
//                        immune     seconds after it ends (or lands) during which it cannot be laid again
//                        amount     [least, most], in percent: its strength
//                        chance     it is laid by the roll chance.<id>, so there is a stat of that name
//                        cond       the modifier condition that holds while a struck body carries it, or null
//                        player     whether the player can carry it (on is not 'dead')
//                      What condT, condV and condN hold for each row is in the comment beside it.
//   Stats.AILMENT      {id: row number}          the index into a body's condT, condV and condN arrays
//   Stats.RULE         {rule: row number}        the row that the behaviour of that id applies and runs
//   Stats.COND_MAX     16                        the length of those arrays
//   Stats.TAGS         [id]                      every tag a modifier or a voice may carry: the kinds of harm, the
//                                                families, the role tags and the condition ids
//   Stats.CONDS        [{id, target, ailment}]   modifier conditions; target: it is about the body being struck;
//                                                ailment: the row of Stats.AILMENTS it follows, or null
//   Stats.COND         {id: bit number}          a set of conditions is a number with these bits set
//   Stats.STATS        [{id, base, min, max, skill?, pct?, int?, range?, prefix?}]
//                        skill   worked out for each voice with its tags and copied into its skill sheet
//                        pct     a percentage where 100 is unchanged (a skill sheet holds it as a multiplier)
//                        int     a whole number, rounded down
//                        range   its flat values may be [min, max] pairs (added harm)
//                        prefix  the row stands for every id that starts with this ('flag.', 'param.')
//   Stats.WANTS        {voice: 10, knot: 6, line: 4}   what a voice and a knot want of their attribute for each
//                                                tier, and a find for each written line (section 14 of the design)
//   Stats.LEVEL_MAX    20                        the top level of a Scaled value
// Public, functions:
//   Stats.stat(id) -> row | null                 the row of a stat id, also for 'flag.<id>' and 'param.<key>'
//   Stats.is(table, id) -> boolean               table: 'stat' | 'tag' | 'cond' | 'harm' (Stats.TYPES) | 'family' |
//                                                'primary' | 'counted' (Stats.PER) | 'ailment'
//   Stats.condMask(conds) -> number              a set of conditions from an array of ids (a number passes through)
//   Stats.scaled(value, level) -> number         a Scaled at an owner level: a number is itself; {a, b, curve} runs
//                                                from a at level 1 to b at level 20, 'lin' in equal steps, 'exp' by
//                                                equal factors. The level is held inside 1..20.
//   Stats.resolve(mods, level, out?) -> out      appends the modifiers with every Scaled value worked out at that
//                                                level (a modifier that is plain numbers already is appended as it
//                                                is). Whoever collects modifiers from an owner with a level calls it.
//   Stats.share(have, want) -> number            the share rule: what something that wants `want` of an attribute
//                                                works at when you have `have` of it, have / want held within 0.2
//                                                and 1 (1 when it wants nothing). Nothing is ever locked.
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
//   Stats.sheet(mods, ctx) -> Sheet              ctx: {level, weapon?, observances?, favours?, finds?, debts?, conds?}
//   Stats.skillSheet(mods, voiceInst, sheet) -> SkillSheet
//   Stats.hitMult(skillSheet, kindIndex, conds) -> number
//                                                what the base harm of one kind is multiplied by against a body for
//                                                which the conditions in conds (a mask) hold: the sheet's inc and more
//                                                for that kind, with its targetMods on 'damage' added in
//   Stats.fits(voiceDef, knotDef) -> boolean     the voice has every tag the knot requires and none it excludes
//
// Sheet = {
//   level, weapon,                 as given in ctx. weapon: null | {family, damage: {[kind]: [min, max]}, aps}; no tool
//                                  is a weapon (design 15.2), so in the game it is always null
//   conds,                         the mask of the player's conditions it was built for
//   primaries,                     {[id of Stats.PER]: number}: the attributes worked out, and the counts from ctx
//   stats,                         {[stat id]: value} for every row of Stats.STATS but the prefix rows, with no tags
//   guard,                         Float64Array by kind index: guard.<kind> + guard.all, held within 0 and
//                                  guard-max.<kind>; 0 for a bare kind
//   taken,                         Float64Array by kind index: what harm of that kind is multiplied by (1 = unchanged);
//                                  1 for a bare kind, which ignores it
//   flags,                         {[id]: true} for every flag.<id> some modifier raised above 0
// }
// The attributes come first: while they are worked out every attribute reads 0, so one cannot feed another.
// Then everything else, with what the attributes give (Stats.PRIMARIES) as modifiers of their own.
//
// SkillSheet = {
//   id, def, level,                the voice
//   usable,                        false when the voice needs a family the tool held is not; its rate is then 0
//   attack,                        it has the attack tag, so an armed tool's harm and speed count (none is ever armed)
//   tags,                          the voice's tags and what its knots add
//   knots,                         the knot defs that fit and were tied in
//   kinds,                         a mask of the kind indices it deals: the kinds its damage names (the design gives a
//                                  voice one kind). Added harm reaches only these.
//   share,                         the share it works at (Stats.share of its attribute against WANTS.voice x its tier);
//                                  its base harm is multiplied by it
//   mods,                          every modifier that went in: the list given, what the attributes give, the voice's
//                                  own and its knots' (each knot's at its own share)
//   baseMin, baseMax,              Float64Array by kind index: base harm (the voice's own roll at its level, plus added
//                                  harm times eff), times share
//   inc, more,                     by kind index: the sum of inc percent and the product of more for 'damage'
//   min, max,                      by kind index: the range of a hit, base * max(0, 1 + inc/100) * more
//   through,                       by kind index: the share of a body's guard its harm ignores, in percent
//   rate,                          casts a second: the voice's rate * speed
//   area, reach, duration, 'throw-speed'          multipliers (1 = unchanged), as properties named by stat id
//   throws, pierce, shove, 'wrong-foot'           plain numbers (one property for every stat row marked skill)
//   ailChance, ailDuration,        Float64Array by row of Stats.AILMENTS: the chance in percent to lay it on each hit
//                                  (rows with chance), and what its seconds are multiplied by (cond-duration)
//   params,                        {[key]: number}: the voice's params at its level, plus its knots' params, then
//                                  modifiers of param.<key>
//   targetMods,                    [{stat, op, value, hi, cond, kinds, skill}]: modifiers whose condition is about the
//                                  body struck, left out of everything above for the hit code to apply. cond is a bit
//                                  number, kinds a mask of the kind indices whose tags it fits, skill is true when it
//                                  fits the voice without a kind.
// }
// The tags of one kind of harm: the kind's id, and 'dot' if the kind ticks, else 'hit'. A voice's harm of a kind is
// worked out with its tags and that kind's; everything else on its sheet with its tags and those of the kinds it deals.
(function () {
  'use strict';

  const floor = Math.floor, pow = Math.pow;
  const LEVEL_MAX = 20, COND_MAX = 16;

  // ---- the tables ----

  const TYPES = [
    { id: 'blow', guard: 'brace', shown: 'windup', ticks: false, bare: false, guardBase: 50, guardMax: 80 },
    { id: 'drag', guard: 'stride', shown: 'none', ticks: true, bare: false, guardBase: 60, guardMax: 85 },
    { id: 'swell', guard: 'lee', shown: 'fill', ticks: false, bare: true, guardBase: 0, guardMax: 0 },
  ];
  const FAMILIES = ['rope', 'verge', 'pike', 'pole', 'bellows', 'spade'];   // the six trade tools
  const PRIMARIES = [
    { id: 'knee', gives: [
      { stat: 'life-max', op: 'flat', value: 2, div: 1 },
      { stat: 'damage', op: 'inc', value: 1, div: 1, tags: ['still'] },
      { stat: 'brace-time', op: 'flat', value: -0.03, div: 10 },
      { stat: 'guard.blow', op: 'flat', value: 2, div: 10 }] },
    { id: 'heel', gives: [
      { stat: 'move-speed', op: 'inc', value: 0.25, div: 1 },
      { stat: 'damage', op: 'inc', value: 1, div: 1, tags: ['moving'] },
      { stat: 'stride-share', op: 'flat', value: -1, div: 10 }] },
    { id: 'hand', gives: [
      { stat: 'damage', op: 'inc', value: 1, div: 1, cond: 't-near' },
      { stat: 'pickup-reach', op: 'inc', value: 1, div: 1 },
      { stat: 'mend-reach', op: 'flat', value: 0.1, div: 10 }] },
    { id: 'ear', gives: [
      { stat: 'damage', op: 'inc', value: 1, div: 1, tags: ['timed'] },
      { stat: 'heed-max', op: 'flat', value: 1, div: 1 },
      { stat: 'warn', op: 'flat', value: 0.05, div: 10 }] },
  ];
  // what a sheet's ctx brings for "per" modifiers: character level (from 1), observances kept, favours taken this
  // vigil, finds carried, and the Surety's debts. Whoever changes one of them sets S.dirty.
  const COUNTS = ['level', 'observances', 'favours', 'finds', 'debts'];

  // Each row's comment says what condT (T), condV (V) and condN (N) hold for it; its rule is in section 7 of the design.
  const AILMENTS = [
    { id: 'wrong-footed', by: 'rule', rule: 'footing', on: 'both', seconds: 0.5, keeperSeconds: 0.25, cond: 't-wrong-footed', player: true },
    // T seconds left; V the turn in degrees; N unused
    { id: 'in-procession', by: 'rule', rule: 'procession', on: 'dead', spares: ['elite', 'keeper'], cond: 't-in-procession', player: false },
    // T seconds a halt has left (Wand-bearer), else 0; V seconds followed, building to 5; N 1 while in procession
    { id: 'moored', by: 'effect', on: 'dead', spares: ['keeper'], seconds: 4, stacks: 12, immune: 6, cond: 't-moored', player: false },
    // T seconds left; V the stake's number; N its place in the line
    { id: 'sounded', by: 'rule', rule: 'sounding', on: 'dead', spares: ['small'], seconds: 6, cond: 't-sounded', player: false },
    // T seconds left; V seconds held in the 4 to 6 m band, building to sound-time; N unused
    { id: 'coiled', by: 'rule', rule: 'coiling', on: 'dead', spares: ['small'], seconds: 10, stacks: 3, cond: 't-coiled', player: false },
    // T seconds left; V signed angle walked round it, sunwise positive; N coils
    { id: 'mourning', by: 'rule', rule: 'mourning', on: 'dead', spares: ['elite', 'keeper'], seconds: 12, cond: 't-mourning', player: false },
    // T seconds left; V grade (2 full, 1 half, 3 roused); N unused
    { id: 'clung', by: 'rule', rule: 'riders', on: 'both', spares: ['small'], stacks: 5, cond: null, player: true },
    // T unused; V Drag per rider per second; N riders
    { id: 'coined', by: 'effect', chance: true, on: 'dead', spares: ['keeper'], seconds: 5, cond: 't-coined', player: false },
    // T seconds left; V its heading in radians; N coins it drops (2, 4 if laid while coined, 0 if blinded by a lamp)
    { id: 'swing', by: 'rule', rule: 'swing', on: 'both', stacks: 6, keeperStacks: 12, cond: null, player: true },
    // T unused; V direction of the last Blow, radians; N swing
    { id: 'sealed', by: 'effect', chance: true, on: 'both', seconds: 15, amount: [8, 8], cond: 't-sealed', player: true },
    // T seconds left; V the share of greatest life one hit must reach to break it (0.08); N unused
    { id: 'brined', by: 'effect', chance: true, on: 'both', stacks: 20, playerStacks: 10, immune: 3, cond: 't-brined', player: true },
    // T crust seconds left after it lands; V unused; N stacks
    { id: 'tolled-for', by: 'rule', rule: 'reprieve', on: 'player', cond: null, player: true },
    // T seconds left until the next toll; V unused; N unused
    { id: 'filed', by: 'effect', on: 'dead', spares: ['elite', 'keeper'], seconds: 5, cond: null, player: false },
    // T seconds left; V its side, -1 or +1; N its place in the file
    { id: 'tolled', by: 'rule', rule: 'toll-bar', on: 'dead', seconds: 10, stacks: 8, cond: null, player: false },
    // T seconds left of the paying window; V unused; N payments in the window
    { id: 'burgess', by: 'effect', on: 'dead', spares: ['elite', 'keeper'], cond: null, player: false },
    // T unused (it lasts the vigil); V tolls stood as a burgess; N unused
  ];
  // 15 of COND_MAX (16) rows.

  // What the rules themselves name: the tags that say how harm arrives, the stats of a hit and of the sheets, and
  // the prefixes of two families of stats.
  const ATTACK = 'attack', HIT = 'hit', DOT = 'dot';
  const DAMAGE = 'damage', SPEED = 'speed', TAKEN = 'taken', COND_DURATION = 'cond-duration', GUARD_ALL = 'guard.all';
  const FLAG = 'flag.', PARAM = 'param.';
  const WANTS = { voice: 10, knot: 6, line: 4 }, SHARE_LEAST = 0.2;

  const ROLE_TAGS = [ATTACK, HIT, DOT,               // named by the code; no voice carries 'attack'
    'still', 'moving', 'timed',                      // the voice speaks, or is stronger, while you stand / move / on the clock
    'thrown', 'ground', 'line', 'round', 'planted', 'held',   // it travels / lies on the ground / runs between two points /
                                                     // circles you / stays where it was set / lasts
    'turn', 'crossing', 'water', 'trade', 'heave'];  // it answers a turn / a crossing of your wake / water; it belongs to
                                                     // the trade or the heave
  const PLAYER_CONDS = ['braced', 'striding', 'crowded', 'after-quarter', 'wrong-footed', 'in-water', 'dry', 'on-wound', 'laden',
    'scarred', 'faint', 'at-post', 'in-light', 'tolled-for'];
  const TARGET_CONDS = ['t-braced', 't-striding', 't-large', 't-elite', 't-keeper', 't-near', 't-far', 't-in-water'];
  // besides one target condition for each row of AILMENTS that has a cond

  // Stat rows as [id, base, least, most, marks]; the marks are s (skill), % (pct) and i (int), see the header.
  // The attributes come before them, and the families by kind of harm, by condition and by prefix after them.
  const ROWS = [
    ['life-max', 60, 1, 1e7], ['wound-term', 60, 10, 300], ['wound-join', 2, 0, 5], ['wound-cap', 10, 3, 20, 'i'],
    ['mend-rate', 100, 10, 1000, '%'], ['mend-reach', 1, 0.5, 2.5], ['mend-on-lay', 0, 0, 100], ['scarring', 100, 0, 100, '%'],
    ['brace-time', 0.4, 0.1, 2], ['stride-share', 70, 40, 95], ['lee-reach', 3, 1, 6], ['turn-limit', 90, 45, 170],
    ['wrong-foot-taken', 50, 0, 200], [GUARD_ALL, 0, -100, 100], [TAKEN, 100, 0, 1000, '%'],
    ['move-speed', 4.5, 0.5, 15], ['shove-taken', 100, 0, 300, '%'], ['find-weight', 1.5, 0, 5], ['find-steady', 4, 0, 10],
    ['pickup-reach', 2.5, 0, 40], ['wake-lag', 1.2, 0.6, 2.5], ['wake-length', 5, 2, 12],
    ['heed-max', 100, 0, 400], ['warn', 0, 0, 1],
    ['trade-recharge', 100, 25, 400, '%'], ['heave-recharge', 4, 1, 20], ['heave-harm', 100, 0, 1000, '%'],
    ['pull-window', 0.3, 0.1, 0.6], ['set-time', 1, 0.3, 3], ['wedge-length', 3, 1, 8], ['bar-length', 7, 3, 14],
    ['lamp-burn', 45, 10, 120], ['chest-size', 30, 10, 90, 'i'], ['dig-rate', 1, 0.25, 4],
    ['procession-cap', 40, 0, 80, 'i'], ['procession-bonus', 30, 0, 100], ['sound-time', 2, 0.5, 5],
    ['xp-gain', 100, 0, 1000, '%'], ['coin-find', 100, 0, 1000, '%'], ['find-chance', 100, 0, 1000, '%'],
    ['hum-gain', 100, 0, 1000, '%'], ['notch-size', 100, 0, 500, '%'],
    [DAMAGE, 100, 0, 1e6, '%'], [SPEED, 100, 10, 1000, '%'], ['area', 100, 10, 1000, 's%'], ['reach', 100, 10, 1000, 's%'],
    ['duration', 100, 10, 1000, 's%'], ['throws', 0, 0, 50, 'si'], ['pierce', 0, 0, 99, 'si'], ['throw-speed', 100, 10, 1000, 's%'],
    ['shove', 0, 0, 30, 's'], ['wrong-foot', 50, 0, 300, 's'], [COND_DURATION, 100, 10, 1000, '%'],
  ];

  // ---- everything derived from the tables ----

  // Look-ups by id have no prototype behind them: an id that happens to be "constructor" finds nothing.
  const index = (rows, key) => {
    const map = Object.create(null);
    rows.forEach((r, i) => { if (typeof r[key] === 'string') map[r[key]] = i; });
    return map;
  };
  const TYPE = index(TYPES, 'id'), AILMENT = index(AILMENTS, 'id'), RULE = index(AILMENTS, 'rule');
  const PER = PRIMARIES.map((p) => p.id).concat(COUNTS);
  const TAGS = TYPES.map((t) => t.id).concat(FAMILIES, ROLE_TAGS, AILMENTS.map((a) => a.id));
  const CONDS = PLAYER_CONDS.map((id) => ({ id, target: false, ailment: null }))
    .concat(TARGET_CONDS.map((id) => ({ id, target: true, ailment: null })))
    .concat(AILMENTS.filter((a) => a.cond).map((a) => ({ id: a.cond, target: true, ailment: a.id })));
  const COND = index(CONDS, 'id');
  let TARGET_BITS = 0;
  CONDS.forEach((c, bit) => { if (c.target) TARGET_BITS |= 1 << bit; });
  const once = (list) => new Set(list).size === list.length;
  Core.assert(AILMENTS.length <= COND_MAX, 'Stats: more conditions than a body has room for (COND_MAX)');
  Core.assert(CONDS.length <= 31 && TYPES.length <= 31, 'Stats: conditions and kinds of harm are kept as bits of one number, 31 at most');
  Core.assert(once(TAGS) && once(CONDS.map((c) => c.id)) && once(AILMENTS.filter((a) => a.rule).map((a) => a.rule)), 'Stats: an id is listed twice');
  for (const a of AILMENTS) {
    Core.assert((a.by === 'rule') === (typeof a.rule === 'string') && (a.by === 'rule' || a.by === 'effect'), 'Stats: ' + a.id + ' needs a rule exactly when by is "rule"');
    Core.assert(a.player === (a.on !== 'dead'), 'Stats: the player column of ' + a.id + ' must follow its on column');
  }

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
  const GUARD = TYPES.map((t) => row('guard.' + t.id, t.guardBase, 0, t.guardBase ? 100 : 0));
  const GUARD_MAX = TYPES.map((t) => row('guard-max.' + t.id, t.guardMax, 0, t.guardMax ? 90 : 0));
  const THROUGH = TYPES.map((t) => row('through.' + t.id, 0, 0, t.bare ? 0 : 100));
  const ADDED = TYPES.map((t) => row('added.' + t.id, 0, 0, 1e7, '', { range: true }));
  const CHANCE = AILMENTS.map((a) => (a.chance ? row('chance.' + a.id, 0, 0, 100) : null));
  row(FLAG + '*', 0, 0, 1, '', { prefix: FLAG });
  row(PARAM + '*', 0, -1e9, 1e9, '', { prefix: PARAM });

  const BY_ID = Object.create(null);
  STATS.forEach((r) => { BY_ID[r.id] = r; });
  const PREFIX_ROWS = STATS.filter((r) => r.prefix), PLAIN_ROWS = STATS.filter((r) => !r.prefix), SKILL_ROWS = STATS.filter((r) => r.skill);
  const FLAG_ROW = BY_ID[FLAG + '*'], PARAM_ROW = BY_ID[PARAM + '*'];
  for (const id of [DAMAGE, SPEED, TAKEN, COND_DURATION, GUARD_ALL]) Core.assert(BY_ID[id] !== undefined, 'Stats: the rules need the stat ' + id);

  // What the attributes give, as modifiers that count once for every div points: {stat, op, value, tags?, cond?, per}.
  const INHERENT = [];
  PRIMARIES.forEach((p) => p.gives.forEach((g) => {
    const m = { stat: g.stat, op: g.op, value: g.value };
    if (g.tags !== undefined) m.tags = g.tags;
    if (g.cond !== undefined) m.cond = g.cond;
    m.per = { stat: p.id, div: g.div };
    Core.assert(BY_ID[g.stat] !== undefined && (g.cond === undefined || COND[g.cond] !== undefined), 'Stats: ' + p.id + ' gives what is not in the tables');
    INHERENT.push(m);
  }));
  const KIND_TAGS = TYPES.map((t) => [t.id, t.ticks ? DOT : HIT]);
  const SETS = {
    tag: new Set(TAGS), cond: new Set(CONDS.map((c) => c.id)), harm: new Set(TYPES.map((t) => t.id)), family: new Set(FAMILIES),
    primary: new Set(PRIMARIES.map((p) => p.id)), counted: new Set(PER), ailment: new Set(AILMENTS.map((a) => a.id)),
  };
  const NO_TAGS = Object.freeze([]), NONE = Object.freeze({});

  Stats.TYPES = TYPES; Stats.TYPE = TYPE; Stats.FAMILIES = FAMILIES; Stats.PRIMARIES = PRIMARIES; Stats.PER = PER;
  Stats.AILMENTS = AILMENTS; Stats.AILMENT = AILMENT; Stats.RULE = RULE; Stats.COND_MAX = COND_MAX; Stats.TAGS = TAGS;
  Stats.CONDS = CONDS; Stats.COND = COND; Stats.STATS = STATS; Stats.WANTS = WANTS; Stats.LEVEL_MAX = LEVEL_MAX;
  Core.deepFreeze([TYPES, TYPE, FAMILIES, PRIMARIES, PER, AILMENTS, AILMENT, RULE, TAGS, CONDS, COND, STATS, WANTS, INHERENT, KIND_TAGS]);

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

  function share(have, want) {
    if (!(want > 0)) return 1;
    const s = (have > 0 ? have : 0) / want;
    return s < SHARE_LEAST ? SHARE_LEAST : s > 1 ? 1 : s;
  }
  Stats.share = share;

  // Like resolve, with every value but a set's worked at the share k: a knot below what it wants gives that much.
  function resolveAt(mods, level, k, out) {
    if (k === 1) return Stats.resolve(mods, level, out);
    for (let i = 0; mods && i < mods.length; i++) {
      const m = mods[i], v = m.value, pair = Array.isArray(v);
      const lo = scaled(pair ? v[0] : v, level), hi = pair ? scaled(v[1], level) : lo, f = m.op === 'set' ? 1 : k;
      out.push(Object.assign({}, m, { value: pair ? [lo * f, hi * f] : lo * f }));
    }
    return out;
  }

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
  function fold(mods, stat, tags, conds, prim) {
    aLo = 0; aHi = 0; aInc = 0; aMore = 1; aSet = 0; aSetHi = 0; aHasSet = false;
    if (!mods) return;
    for (let i = 0; i < mods.length; i++) {
      const m = mods[i];
      if (stat !== null && m.stat !== stat) continue;
      if (m.local === true) continue;
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
    fold(list, null, tags, conds, prim);
    return finish(r, r.base, false);
  }

  function rowOf(stat, who) {
    const r = Stats.stat(stat);
    Core.assert(r !== null, who + ': "' + stat + '" is not a stat');
    return r;
  }

  Stats.query = function (mods, stat, tags, conds, primaries) {
    const r = rowOf(stat, 'Stats.query');
    fold(mods, stat, tags || NO_TAGS, condMask(conds), primaries || NONE);
    return finish(r, r.base, false);
  };

  Stats.queryRange = function (mods, stat, tags, conds, primaries, out) {
    const r = rowOf(stat, 'Stats.queryRange');
    fold(mods, stat, tags || NO_TAGS, condMask(conds), primaries || NONE);
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

    const guard = new Float64Array(n), taken = new Float64Array(n);
    for (let t = 0; t < n; t++) {
      if (TYPES[t].bare) { guard[t] = 0; taken[t] = 1; continue; }
      const raw = stats[GUARD[t]] + stats[GUARD_ALL], cap = stats[GUARD_MAX[t]];
      guard[t] = raw < 0 ? 0 : raw < cap ? raw : cap;
      taken[t] = value(by.get(TAKEN), BY_ID[TAKEN], KIND_TAGS[t], conds, prim) / 100;
    }
    by.forEach((list, stat) => {
      if (typeof stat === 'string' && stat.startsWith(FLAG) && value(list, FLAG_ROW, NO_TAGS, conds, prim) > 0) flags[stat.slice(FLAG.length)] = true;
    });
    return { level: prim.level, weapon: c.weapon || null, conds, primaries: prim, stats, guard, taken, flags };
  };

  // ---- the sheet of one voice ----

  Stats.fits = function (voice, knot) {
    if (!within(knot.requires, voice.tags)) return false;
    for (let i = 0; i < knot.excludes.length; i++) if (voice.tags.includes(knot.excludes[i])) return false;
    return true;
  };

  const add = (list, item) => { if (item && !list.includes(item)) list.push(item); };

  Stats.skillSheet = function (mods, inst, sheet) {
    const def = Defs.get('voice', inst.id), level = inst.level >= 1 ? inst.level : 1;
    const prim = sheet.primaries, conds = sheet.conds, weapon = sheet.weapon, n = TYPES.length;

    // tags: the voice's own, then what its knots add; a knot that does not fit the voice is left out
    const tags = def.tags.slice(), knots = [], ties = inst.knots || NO_TAGS;
    for (let i = 0; i < ties.length; i++) {
      const k = ties[i] ? Defs.get('knot', ties[i]) : null;
      if (k === null || !Stats.fits(def, k)) continue;
      knots.push(k);
      for (let j = 0; j < k.addTags.length; j++) add(tags, k.addTags[j]);
    }
    const attack = tags.includes(ATTACK), armed = attack && weapon !== null;
    const usable = !def.weapon || (weapon !== null && def.weapon.includes(weapon.family));
    if (armed) add(tags, weapon.family);
    let kinds = 0;
    for (let t = 0; t < n; t++) if (def.damage[TYPES[t].id] !== undefined) kinds |= 1 << t;
    const skillTags = tags.slice(), hitTags = KIND_TAGS.map((k) => tags.concat(k));
    for (let t = 0; t < n; t++) if ((kinds >>> t) & 1) { add(skillTags, KIND_TAGS[t][0]); add(skillTags, KIND_TAGS[t][1]); }

    // every modifier that can touch this voice: the list given, what the attributes give, the voice's own at its
    // level, and each knot's at the voice's level and at the knot's own share
    const all = mods ? mods.slice() : [];
    for (let i = 0; i < INHERENT.length; i++) all.push(INHERENT[i]);
    Stats.resolve(def.mods, level, all);
    const knotShare = knots.map((k) => share(prim[k.attr], WANTS.knot * k.tier));
    for (let i = 0; i < knots.length; i++) resolveAt(knots[i].mods, level, knotShare[i], all);
    const by = bucket(all, new Map()), part = share(prim[def.attr], WANTS.voice * def.tier);

    const ss = {
      id: def.id, def, level, usable, attack, tags, knots, kinds, share: part, mods: all,
      baseMin: new Float64Array(n), baseMax: new Float64Array(n), inc: new Float64Array(n), more: new Float64Array(n),
      min: new Float64Array(n), max: new Float64Array(n), through: new Float64Array(n), rate: 0,
      ailChance: new Float64Array(COND_MAX), ailDuration: new Float64Array(COND_MAX), params: {}, targetMods: [],
    };

    // base harm of each kind the voice deals: its own roll at its level, an armed tool's share (never, in the game),
    // and added harm of that kind times eff; all of it at the voice's share. Added harm of another kind adds nothing.
    const toolPct = armed ? scaled(def.weaponPct, level) / 100 : 0;
    for (let t = 0; t < n; t++) {
      let lo = 0, hi = 0;
      if ((kinds >>> t) & 1) {
        const id = TYPES[t].id, own = def.damage[id], held = armed ? weapon.damage[id] : undefined, r = BY_ID[ADDED[t]];
        fold(by.get(ADDED[t]), null, hitTags[t], conds, prim);
        lo = (scaled(own[0], level) + (held ? held[0] * toolPct : 0) + finish(r, r.base, false) * def.eff) * part;
        hi = (scaled(own[1], level) + (held ? held[1] * toolPct : 0) + finish(r, r.base, true) * def.eff) * part;
      }
      fold(by.get(DAMAGE), null, hitTags[t], conds, prim);
      const scale = (aInc > -100 ? 1 + aInc / 100 : 0) * aMore;
      ss.baseMin[t] = lo; ss.baseMax[t] = hi; ss.inc[t] = aInc; ss.more[t] = aMore;
      ss.min[t] = lo * scale; ss.max[t] = hi * scale;
      ss.through[t] = value(by.get(THROUGH[t]), BY_ID[THROUGH[t]], hitTags[t], conds, prim);
    }

    const speed = value(by.get(SPEED), BY_ID[SPEED], skillTags, conds, prim) / 100;
    ss.rate = usable ? scaled(def.rate, level) * (armed ? weapon.aps : 1) * speed : 0;
    for (let i = 0; i < SKILL_ROWS.length; i++) {
      const r = SKILL_ROWS[i], v = value(by.get(r.id), r, skillTags, conds, prim);
      ss[r.id] = r.pct ? v / 100 : v;
    }

    for (let a = 0; a < AILMENTS.length; a++) {
      const ailTags = skillTags.concat(AILMENTS[a].id);
      if (CHANCE[a] !== null) ss.ailChance[a] = value(by.get(CHANCE[a]), BY_ID[CHANCE[a]], ailTags, conds, prim);
      ss.ailDuration[a] = value(by.get(COND_DURATION), BY_ID[COND_DURATION], ailTags, conds, prim) / 100;
    }

    for (const key in def.params) ss.params[key] = scaled(def.params[key], level);
    for (let i = 0; i < knots.length; i++) {
      for (const key in knots[i].params) ss.params[key] = (ss.params[key] || 0) + knots[i].params[key] * knotShare[i];
    }
    for (const key in ss.params) {
      const list = by.get(PARAM + key);
      if (list === undefined) continue;
      fold(list, null, skillTags, conds, prim);
      ss.params[key] = finish(PARAM_ROW, ss.params[key], false);
    }

    // modifiers that depend on the body struck cannot be settled here: they are set aside, worth and reach worked out
    for (let i = 0; i < all.length; i++) {
      const m = all[i], bit = m.cond === undefined ? undefined : COND[m.cond];
      if (bit === undefined || !CONDS[bit].target || m.local === true) continue;
      const skill = m.tags === undefined || within(m.tags, skillTags);
      let fit = 0;
      for (let t = 0; t < n; t++) if (m.tags === undefined || within(m.tags, hitTags[t])) fit |= 1 << t;
      if (fit === 0 && !skill) continue;
      amount(m, prim);
      ss.targetMods.push({ stat: m.stat, op: m.op, value: vLo, hi: vHi, cond: bit, kinds: fit, skill });
    }
    return ss;
  };

  Stats.hitMult = function (ss, t, conds) {
    let inc = ss.inc[t], more = ss.more[t];
    const list = ss.targetMods;
    for (let i = 0; i < list.length; i++) {
      const m = list[i];
      if (m.stat !== DAMAGE || ((m.kinds >>> t) & 1) === 0 || ((conds >>> m.cond) & 1) === 0) continue;
      if (m.op === 'inc') inc += m.value;
      else if (m.op === 'more') more *= m.value > -100 ? 1 + m.value / 100 : 0;
    }
    return (inc > -100 ? 1 + inc / 100 : 0) * more;
  };
})();
