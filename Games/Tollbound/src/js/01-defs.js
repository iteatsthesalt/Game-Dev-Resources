// 01-defs.js: the registries of definitions (the game's content as plain data), their shapes, and the check
// that runs once at boot.
// Owns: Defs
// Public:
//   Defs.KINDS                       the kinds of definition: sigil, binding, vow, treeSkeleton, cluster, legacyNode,
//                                    class, calling, attack, enemy, boss, zone, puppet, prop, tileset, base, affix,
//                                    unique, currency, chime, deed, mode, curves, constants, trait, chartMod
//   Defs.add(kind, def) -> def       registers a definition. Cheap checks only: a known kind, a string id, an id
//                                    not yet taken in that kind. Throws otherwise, and after Defs.finalize().
//   Defs.get(kind, id) -> def        throws an error that names the kind and the id when there is none
//   Defs.has(kind, id) -> boolean
//   Defs.all(kind) -> [def]          in the order they were added. It is the registry's own array: do not change it.
//   Defs.SCHEMA                      {kind: {open, fields: {name: spec}}}: the shapes of docs/engine.md as data
//   Defs.SHAPES                      {Mod, ModRange, Trigger, Attack: {open, fields}}: shapes used inside others
//   Defs.ENUMS                       {name: [word]}: the closed word lists the specs use (ai, archetype, rig, ...)
//   Defs.allow(name, word, ...)      adds words to one of Defs.ENUMS. A registry of behaviour (AI.register and
//                                    the like) calls it so that content may name what it has registered.
//   Defs.extend(kind, fields)        adds or replaces field specs of a kind: {name: spec}; a spec is required unless
//                                    it says required: false. What is given to 'attack' also holds for attacks
//                                    written inside an enemy, and what is given to 'enemy' for bosses.
//                                    allow and extend work only before finalize.
//   Defs.finalize() -> [string]      checks every definition and then freezes all of them, the registries and
//                                    the schema. [] means valid. Each string reads "kind id: field problem".
//
// A spec is {type, required, nullable?, ...}. A field that is not required may be left out; null is allowed
// only where nullable is true. An object may hold only the fields its spec lists, unless it is open.
//   type 'string' | 'bool' | 'any'
//        'number' | 'int'     finite; min and max, if there, are the least and most allowed
//        'id'                 lower-case words and digits joined by dots or dashes
//        'hex'                a colour as '#rrggbb'
//        'scaled'             a number, or {a, b, curve: 'lin' | 'exp'} (see Stats.scaled)
//        'array'              of: the spec of each element; len: a length, or [least, most]
//        'map'                of: the spec of each value; keys: a spec for each key (any text if absent)
//        'object'             fields: {name: spec}; open: true when other fields may be there as well
//        'shape'              shape: a name in Defs.SHAPES
//        'union'              of: [spec, ...]; the value must fit one of them
//        'stat' | 'tag' | 'cond' | 'dtype' | 'family' | 'primary' | 'counted' | 'ailment'
//                             the id of a row of that table in Stats (dtype: a damage type; counted: Stats.PER)
//   enum: [word, ...]         on a string: the words allowed
//   ref: kind                 on a string: the id of a definition of that kind. Not checked while that kind has
//                             no definitions at all, which is how a build without (say) its puppets stays valid.
//
// What finalize checks beyond the specs: that a definition is what JSON can carry (no function, no undefined,
// no NaN, only plain objects and arrays); inside every Mod and ModRange that a pair value sits on a range stat
// only, that "from" is there exactly when the stat is gained from another type, and that per.div is above 0;
// keys and links inside one definition (cluster and calling nodes, puppet parts, a boss's attack ids); that a
// class and its callings name each other; that no id is both an enemy and a boss.
(function () {
  'use strict';

  const KINDS = ['sigil', 'binding', 'vow', 'treeSkeleton', 'cluster', 'legacyNode', 'class', 'calling', 'attack', 'enemy',
    'boss', 'zone', 'puppet', 'prop', 'tileset', 'base', 'affix', 'unique', 'currency', 'chime', 'deed', 'mode', 'curves',
    'constants', 'trait', 'chartMod'];
  const ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/, HEX = /^#[0-9a-fA-F]{6}$/;
  const TABLES = {
    stat: 'a stat', tag: 'a tag', cond: 'a condition', dtype: 'a damage type', family: 'a weapon family', primary: 'an attribute',
    counted: 'something a per modifier can count', ailment: 'an ailment',
  };

  const lists = Object.create(null), byId = Object.create(null);   // no prototype behind them: "constructor" is not a kind
  for (const kind of KINDS) { lists[kind] = []; byId[kind] = new Map(); }
  let closed = false;

  const known = (kind, who) => Core.assert(lists[kind] !== undefined, who + ': "' + kind + '" is not a kind of definition');

  Defs.KINDS = KINDS;

  Defs.add = function (kind, def) {
    known(kind, 'Defs.add');
    Core.assert(!closed, 'Defs.add: the definitions were finalized; ' + kind + ' definitions are added while the files load');
    Core.assert(def !== null && typeof def === 'object' && typeof def.id === 'string' && def.id !== '', 'Defs.add: a ' + kind + ' needs a string id');
    Core.assert(!byId[kind].has(def.id), 'Defs.add: there are two ' + kind + ' definitions with the id "' + def.id + '"');
    byId[kind].set(def.id, def);
    lists[kind].push(def);
    return def;
  };

  Defs.get = function (kind, id) {
    known(kind, 'Defs.get');
    const def = byId[kind].get(id);
    if (def === undefined) throw new Error('Defs.get: there is no ' + kind + ' "' + id + '"');
    return def;
  };

  Defs.has = function (kind, id) { known(kind, 'Defs.has'); return byId[kind].has(id); };
  Defs.all = function (kind) { known(kind, 'Defs.all'); return lists[kind]; };

  // ---- the shapes: written with small helpers, kept as plain data ----

  const ENUMS = {
    op: ['flat', 'inc', 'more', 'set'],
    curve: ['lin', 'exp'],
    archetype: ['projectile', 'burst', 'arc', 'orbit', 'chain', 'beam', 'zone', 'deployable', 'summon'],
    target: ['nearest', 'densest', 'random', 'farthest', 'aim', 'self'],
    triggerOn: ['kill', 'crit', 'dodge', 'hurt', 'draught', 'timer'],
    clusterShape: ['ring6', 'arc5', 'fork4', 'line3', 'diamond4'],
    nodeKind: ['minor', 'major', 'capstone'],
    callingKind: ['minor', 'major'],
    attackKind: ['contact', 'projectile', 'area', 'beam', 'summon'],
    attackShape: ['circle', 'cone', 'line', 'ring'],
    ai: ['chase', 'ranged', 'charger', 'swarm', 'caster', 'exploder', 'summoner', 'lurker'],
    zoneKind: ['campaign', 'rite', 'chart', 'debug'],
    zoneEvent: ['elite', 'swarm', 'miniboss', 'shrine'],
    rig: ['biped', 'quadruped', 'floater', 'crawler', 'winged', 'serpent', 'static'],
    partShape: ['box', 'taper', 'cyl', 'sphere', 'cone'],
    slot: ['weapon', 'offhand', 'helm', 'body', 'gloves', 'boots', 'amulet', 'ring', 'belt'],
    affixType: ['prefix', 'suffix'],
    currencyTarget: ['item', 'sigil'],
    currencyOp: ['toMagic', 'toRare', 'addMod', 'reroll', 'removeMod', 'rerollValues', 'addSocket', 'corrupt', 'levelSigil'],
    chimeRarity: ['common', 'rare', 'epic'],
    chimeScope: ['global', 'sigils'],
    deedScope: ['account', 'character'],
    event: ['hit', 'crit', 'kill', 'cast', 'hurt', 'pickup', 'level', 'offer', 'telegraph', 'phase', 'drop', 'toll', 'gate', 'end'],
    route: ['zone', 'gauntlet'],
    levelOffer: ['none', 'node'],
    runLevelOffer: ['chime', 'none'],
    offer: ['none', 'chime', 'node', 'reward'],
    haul: ['gate', 'none'],
    respec: ['gold', 'last3'],
    death: ['permanent'],
  };

  const T = (type, more) => Object.assign({ type, required: true }, more);
  const str = T('string'), num = T('number'), bool = T('bool'), any = T('any'), scaled = T('scaled'), id = T('id'), hex = T('hex');
  const opt = (spec) => Object.assign({}, spec, { required: false });
  const nul = (spec) => Object.assign({}, spec, { nullable: true });
  const ref = (kind) => T('string', { ref: kind });
  const one = (name) => T('string', { enum: ENUMS[name] });
  const word = (...words) => T('string', { enum: words });
  const row = (table) => T(table);
  const list = (of, len) => T('array', len === undefined ? { of } : { of, len });
  const map = (of, keys) => T('map', keys === undefined ? { of } : { of, keys });
  const obj = (fields, open) => T('object', open ? { fields, open: true } : { fields });
  const shape = (name) => T('shape', { shape: name });
  const either = (...of) => T('union', { of });
  const at = (min, max) => T('number', max === undefined ? { min } : { min, max });
  const whole = (min, max) => T('int', max === undefined ? { min } : { min, max });

  const text = { name: str, text: str, icon: any }, mods = list(shape('Mod')), ranges = list(shape('ModRange'));
  const tags = list(row('tag')), vec3 = list(num, 3), req = map(at(0), either(row('primary'), word('level')));
  const SCALED = { a: num, b: num, curve: one('curve') };          // the long form of a 'scaled' value

  const attack = {
    id, kind: one('attackKind'), type: row('dtype'), mult: at(0), cooldown: at(0), range: at(0), windup: at(0), shape: one('attackShape'),
    radius: at(0), angle: at(0), count: whole(0), spread: at(0), speed: at(0), evadable: bool, ailment: nul(row('ailment')),
    summon: nul(obj({ enemy: ref('enemy'), count: whole(1) })), fx: any,
  };
  const enemy = {
    id, name: str, puppet: ref('puppet'), radius: at(0.05), life: at(0), damage: at(0), speed: at(0), xp: at(0), cost: at(0), loot: any,
    ai: one('ai'), aiParams: map(any), attacks: list(either(ref('attack'), shape('Attack'))), res: map(num, row('dtype')), armour: at(0),
    threshold: at(0), tags: list(str),
  };
  const phase = obj({ until: at(0), speed: at(0), onEnter: list(str), loop: list(either(str, obj({ wait: at(0) }))) });

  const SHAPES = {
    Mod: { open: false, fields: {
      stat: row('stat'), op: one('op'), value: either(scaled, list(scaled, 2)), tags: opt(tags), cond: opt(row('cond')),
      per: opt(obj({ stat: row('counted'), div: num, cap: opt(at(0)) })), from: opt(row('dtype')), local: opt(bool),
    } },
    ModRange: { open: false, fields: {
      stat: row('stat'), op: one('op'), tags: opt(tags), cond: opt(row('cond')), from: opt(row('dtype')), local: opt(bool),
      min: either(num, list(num, 2)), max: either(num, list(num, 2)),
    } },
    Trigger: { open: false, fields: { on: one('triggerOn'), chance: at(0), cooldown: at(0) } },
    Attack: { open: false, fields: attack },
  };

  // Each kind's fields besides its id. A kind marked open may carry fields that are not listed.
  const FIELDS = {
    sigil: Object.assign({}, text, {
      attr: row('primary'), tier: whole(1, 5), tags, weapon: nul(list(row('family'))), archetype: one('archetype'), target: one('target'),
      rate: scaled, damage: map(list(scaled, 2), row('dtype')), weaponPct: scaled, eff: at(0), crit: at(0, 100), params: map(scaled), mods,
      fx: obj({ puppet: opt(nul(ref('puppet'))), cast: opt(any), hit: opt(any), sfxCast: opt(any), sfxHit: opt(any), light: opt(any) }, true),
    }),
    binding: Object.assign({}, text, {
      attr: row('primary'), tier: whole(1, 5), requires: tags, excludes: tags, addTags: tags, mods, params: map(num), trigger: nul(shape('Trigger')),
    }),
    vow: Object.assign({}, text, {
      attr: row('primary'), tier: whole(1, 5), candles: at(0), mods, aura: nul(obj({ radius: at(0), enemyMods: mods })),
    }),
    treeSkeleton: {
      spokes: whole(1), rings: list(obj({ r: at(0), slots: whole(1) })), pathMods: mods, starts: map(obj({ sector: whole(0) }), ref('class')),
    },
    cluster: {
      name: str, anchor: obj({ sector: whole(0), ring: whole(0), slot: whole(0) }), shape: one('clusterShape'), theme: tags, entry: str,
      nodes: list(obj({ key: str, kind: one('nodeKind'), name: str, text: opt(str), icon: opt(any), mods })),
    },
    legacyNode: Object.assign({}, text, {
      branch: str, row: whole(0), col: whole(0), requires: list(ref('legacyNode')), ranks: whole(1), cost: list(at(0)), mods, unlock: opt(map(any)),
    }),
    class: {
      name: str, text: str, attrs: map(at(0), row('primary')), perLevel: map(at(0), either(row('primary'), word('life'))), base: mods,
      sector: whole(0), startSigil: ref('sigil'), startGear: list(ref('base')), callings: list(ref('calling'), 2), unlock: nul(ref('deed')),
      puppet: ref('puppet'), palette: list(hex),
    },
    calling: {
      class: ref('class'), name: str, text: str, points: whole(1),
      nodes: list(obj({ key: str, kind: one('callingKind'), name: str, text: opt(str), icon: opt(any), mods, requires: list(str), row: whole(0), col: whole(0) })),
    },
    attack,
    enemy,
    boss: Object.assign({}, enemy, { arena: obj({ radius: at(0) }), phases: list(phase) }),
    zone: {
      name: str, kind: one('zoneKind'), level: whole(1), tollSeconds: at(1), keeperToll: whole(1), gateEvery: whole(1), region: obj({ radius: at(10) }),
      tileset: nul(ref('tileset')), props: list(obj({ prop: ref('prop'), density: at(0) })),
      ambient: obj({ light: list(num, 3), fog: opt(any), sun: opt(any) }, true), music: any,
      timeline: list(obj({ toll: whole(0), rate: at(0), cap: whole(0), pool: list(obj({ enemy: ref('enemy'), w: at(0) })) })),
      overtoll: obj({ rateMul: at(0), levelPer: at(0), rewardPer: at(0) }),
      events: list(obj({
        toll: whole(0), kind: one('zoneEvent'), enemy: opt(ref('enemy')), boss: opt(ref('boss')), traits: opt(list(ref('trait'))),
        shape: opt(str), count: opt(whole(1)),
      })),
      boss: nul(ref('boss')), rules: map(any), unlock: nul(ref('deed')), next: nul(ref('zone')),
    },
    puppet: {
      rig: one('rig'), scale: at(0),
      parts: list(obj({
        key: str, shape: one('partShape'), size: vec3, at: vec3, parent: opt(str), joint: opt(str), color: str, emissive: opt(num),
      })),
      palette: map(hex), anim: obj({ stride: opt(num), swing: opt(num), bob: opt(num) }, true),
    },
    prop: { puppet: ref('puppet'), radius: at(0), light: opt(obj({ radius: at(0), color: any })), breakable: opt(obj({ loot: any })) },
    tileset: {},
    base: {
      name: str, slot: one('slot'), family: nul(row('family')), tags: list(str), level: whole(1), req, twoHanded: bool,
      weapon: nul(obj({ damage: map(list(at(0), 2), row('dtype')), aps: at(0), crit: at(0, 100) })), defence: nul(map(at(0))),
      implicit: ranges, icon: any,
    },
    affix: { name: str, type: one('affixType'), group: str, weights: map(at(0)), tiers: list(obj({ ilvl: whole(1), mods: ranges })) },
    unique: { name: str, base: ref('base'), level: whole(1), mods: ranges, flavour: str, weight: at(0), unlock: nul(ref('deed')) },
    currency: Object.assign({}, text, {
      target: one('currencyTarget'), op: one('currencyOp'), requires: map(any), args: map(any), weight: at(0), level: whole(1),
    }),
    chime: Object.assign({}, text, {
      rarity: one('chimeRarity'), weight: at(0), maxStacks: whole(1), group: opt(str), scope: one('chimeScope'),
      requires: obj({ tags: opt(tags), class: opt(ref('class')), runLevel: opt(whole(0)) }), mods, params: opt(map(num)),
    }),
    deed: {
      name: str, text: str, hidden: bool, scope: one('deedScope'), on: one('event'), count: whole(1), where: map(any),
      reward: obj({
        class: opt(ref('class')), zone: opt(ref('zone')), unique: opt(ref('unique')), treePoints: opt(whole(0)), gold: opt(at(0)),
        echoes: opt(at(0)), currency: opt(map(at(0), ref('currency'))),
      }),
    },
    mode: {
      name: str, text: opt(str), persistent: bool, route: one('route'), zones: opt(list(ref('zone'))), xpCurve: str, levelCap: whole(1),
      runLevels: whole(0), levelOffer: one('levelOffer'), runLevelOffer: one('runLevelOffer'), eliteOffer: one('offer'),
      bossOffer: one('offer'), shrineOffer: one('offer'), haul: one('haul'),
      calling: either(obj({ levels: list(whole(1)) }), obj({ afterBoss: whole(1), pointsPerBoss: whole(1) })),
      respec: one('respec'), death: one('death'), score: any,
    },
    curves: { levels: whole(1) },
    constants: {},
    trait: { name: str, text: opt(str), mods: opt(mods) },
    chartMod: { name: str, text: opt(str), mods: opt(mods) },
  };
  const OPEN = ['tileset', 'curves', 'constants', 'trait', 'chartMod'];

  const SCHEMA = {};
  for (const kind of KINDS) SCHEMA[kind] = { open: OPEN.includes(kind), fields: Object.assign({ id }, FIELDS[kind]) };

  Defs.SCHEMA = SCHEMA;
  Defs.SHAPES = SHAPES;
  Defs.ENUMS = ENUMS;

  Defs.allow = function (name) {
    Core.assert(!closed, 'Defs.allow: the definitions were finalized');
    Core.assert(Array.isArray(ENUMS[name]), 'Defs.allow: there is no word list "' + name + '"');
    for (let i = 1; i < arguments.length; i++) {
      Core.assert(typeof arguments[i] === 'string' && arguments[i] !== '', 'Defs.allow: a word is a string');
      if (!ENUMS[name].includes(arguments[i])) ENUMS[name].push(arguments[i]);
    }
  };

  Defs.extend = function (kind, fields) {
    known(kind, 'Defs.extend');
    Core.assert(!closed, 'Defs.extend: the definitions were finalized');
    for (const name of Object.keys(fields)) {
      const spec = fields[name];
      Core.assert(spec !== null && typeof spec === 'object' && typeof spec.type === 'string', 'Defs.extend: the spec of ' + kind + '.' + name + ' needs a type');
      SCHEMA[kind].fields[name] = Object.assign({ required: true }, spec);
      // an attack written inside an enemy is an attack, and a boss is an enemy: they follow
      if (kind === 'attack') SHAPES.Attack.fields[name] = SCHEMA[kind].fields[name];
      if (kind === 'enemy') SCHEMA.boss.fields[name] = SCHEMA[kind].fields[name];
    }
  };

  // ---- checking ----
  // Everything below runs once, at boot. say(path, problem) collects; path is the field inside the definition.

  const isPlain = (v) => { const p = Object.getPrototypeOf(v); return p === null || Object.getPrototypeOf(p) === null; };
  const own = Object.prototype.hasOwnProperty;       // own.call(object, key): a key such as "constructor" is not there by birth
  const join = (path, key) => (path === '' ? key : path + '.' + key);
  function show(v) {
    if (v === undefined) return 'undefined';
    if (typeof v === 'function') return 'a function';
    let s;
    try { s = JSON.stringify(v); } catch (e) { s = undefined; }
    if (s === undefined) s = String(v);
    return s.length > 40 ? s.slice(0, 37) + '...' : s;
  }

  // What JSON would drop or change: only null, booleans, finite numbers, strings, plain objects and arrays pass.
  function jsonFaults(v, path, say, above) {
    const type = typeof v;
    if (v === null || type === 'string' || type === 'boolean') return;
    if (type === 'number') { if (v !== v || v === Infinity || v === -Infinity) say(path, 'is ' + v + ', which JSON cannot carry'); return; }
    if (type !== 'object') return say(path, 'is ' + (type === 'function' ? 'a function' : type) + ', which JSON cannot carry');
    if (above.includes(v)) return say(path, 'holds itself, which JSON cannot carry');
    above.push(v);
    if (Array.isArray(v)) {
      for (let i = 0; i < v.length; i++) jsonFaults(v[i], path + '[' + i + ']', say, above);
    } else if (!isPlain(v)) {
      say(path, 'is not a plain object, so JSON would change it');
    } else {
      for (const key of Object.keys(v)) jsonFaults(v[key], join(path, key), say, above);
    }
    above.pop();
  }

  // Is the value the right sort of thing for a spec at all: text for a string, a list for an array, and so on?
  function sortFits(v, spec) {
    const type = spec.type, object = v !== null && typeof v === 'object' && !Array.isArray(v);
    if (type === 'any') return true;
    if (v === null) return spec.nullable === true;
    if (type === 'union') return spec.of.some((form) => sortFits(v, form));
    if (type === 'number' || type === 'int') return typeof v === 'number';
    if (type === 'bool') return typeof v === 'boolean';
    if (type === 'array') return Array.isArray(v);
    if (type === 'map' || type === 'object' || type === 'shape') return object;
    if (type === 'scaled') return object || typeof v === 'number';
    return typeof v === 'string';
  }

  function checkFields(v, fields, open, path, say) {
    if (typeof v !== 'object' || Array.isArray(v)) return say(path, 'must be an object, not ' + show(v));
    for (const name of Object.keys(fields)) {
      if (v[name] !== undefined) check(v[name], fields[name], join(path, name), say);
      else if (fields[name].required !== false) say(join(path, name), 'is missing');
    }
    if (open) return;
    for (const name of Object.keys(v)) if (!own.call(fields, name)) say(join(path, name), 'is not a field of this shape');
  }

  function check(v, spec, path, say) {
    const type = spec.type;
    if (v === null) { if (!spec.nullable && type !== 'any') say(path, 'is null'); return; }
    if (type === 'any') return;
    if (type === 'number' || type === 'int') {
      if (typeof v !== 'number' || v !== v || v === Infinity || v === -Infinity) return say(path, 'must be a number, not ' + show(v));
      if (type === 'int' && Math.floor(v) !== v) return say(path, 'must be a whole number, not ' + v);
      if (spec.min !== undefined && v < spec.min) return say(path, 'must be at least ' + spec.min + ', not ' + v);
      if (spec.max !== undefined && v > spec.max) say(path, 'must be at most ' + spec.max + ', not ' + v);
      return;
    }
    if (type === 'bool') { if (v !== true && v !== false) say(path, 'must be true or false, not ' + show(v)); return; }
    if (type === 'string' || type === 'id' || type === 'hex' || TABLES[type] !== undefined) {
      if (typeof v !== 'string') return say(path, 'must be text, not ' + show(v));
      if (type === 'id' && !ID.test(v)) return say(path, '"' + v + '" must be lower-case words and digits joined by dots or dashes');
      if (type === 'hex' && !HEX.test(v)) return say(path, '"' + v + '" must be a colour written as #rrggbb');
      if (TABLES[type] !== undefined && typeof Stats.is === 'function' && !Stats.is(type, v)) return say(path, '"' + v + '" is not ' + TABLES[type]);
      if (spec.enum !== undefined && !spec.enum.includes(v)) return say(path, '"' + v + '" is not one of ' + spec.enum.join(', '));
      if (spec.ref !== undefined && lists[spec.ref].length > 0 && !byId[spec.ref].has(v)) say(path, 'names the ' + spec.ref + ' "' + v + '", and there is none');
      return;
    }
    if (type === 'scaled') {
      if (typeof v === 'number') { if (v !== v || v === Infinity || v === -Infinity) say(path, 'must be a number, not ' + show(v)); return; }
      if (typeof v !== 'object' || Array.isArray(v)) return say(path, 'must be a number or {a, b, curve}, not ' + show(v));
      checkFields(v, SCALED, false, path, say);
      if (v.curve === 'exp' && !(v.a * v.b > 0)) say(path, 'has an exp curve, which needs a and b on the same side of 0');
      return;
    }
    if (type === 'array') {
      if (!Array.isArray(v)) return say(path, 'must be a list, not ' + show(v));
      const len = spec.len, least = Array.isArray(len) ? len[0] : len, most = Array.isArray(len) ? len[1] : len;
      if (len !== undefined && (v.length < least || v.length > most)) {
        say(path, 'must hold ' + (least === most ? least : least + ' to ' + most) + ' entries, not ' + v.length);
      }
      for (let i = 0; i < v.length; i++) check(v[i], spec.of, path + '[' + i + ']', say);
      return;
    }
    if (type === 'map') {
      if (typeof v !== 'object' || Array.isArray(v)) return say(path, 'must be an object, not ' + show(v));
      for (const key of Object.keys(v)) {
        if (spec.keys !== undefined) check(key, spec.keys, join(path, key) + ' (the key)', say);
        check(v[key], spec.of, join(path, key), say);
      }
      return;
    }
    if (type === 'object') return checkFields(v, spec.fields, spec.open === true, path, say);
    if (type === 'shape') {
      const before = say.count();
      checkFields(v, SHAPES[spec.shape].fields, SHAPES[spec.shape].open, path, say);
      if (say.count() === before && (spec.shape === 'Mod' || spec.shape === 'ModRange')) modRules(v, spec.shape === 'ModRange', path, say);
      return;
    }
    if (type === 'union') {
      // The value must fit one form. If it fits none, the complaints about the form it came closest to are passed
      // on: of the forms for its sort of value (all forms, if none is), the one with the fewest complaints.
      const sorted = spec.of.filter((form) => sortFits(v, form)), forms = sorted.length > 0 ? sorted : spec.of;
      let best = null;
      for (let i = 0; i < forms.length; i++) {
        const found = [], collect = (p, problem) => { found.push([p, problem]); };
        collect.count = () => found.length;
        check(v, forms[i], path, collect);
        if (found.length === 0) return;
        if (best === null || found.length < best.length) best = found;
      }
      for (let i = 0; i < best.length; i++) say(best[i][0], best[i][1]);
      return;
    }
    say(path, 'has a spec of the unknown type "' + type + '"');
  }

  // What a spec cannot say about a modifier: these need the stat's row.
  function modRules(m, ranged, path, say) {
    const stat = typeof Stats.stat === 'function' ? Stats.stat(m.stat) : null;
    if (stat === null) return;
    const value = ranged ? m.min : m.value, where = join(path, ranged ? 'min' : 'value');
    if (Array.isArray(value) && !stat.range) say(where, 'is a pair, but ' + m.stat + ' is a single number');
    if (ranged && Array.isArray(m.min) !== Array.isArray(m.max)) say(join(path, 'max'), 'must be a pair exactly when min is one');
    if (ranged && typeof m.min === 'number' && typeof m.max === 'number' && m.min > m.max) say(join(path, 'min'), 'is above max');
    if (stat.from && m.from === undefined) say(join(path, 'from'), 'is missing: ' + m.stat + ' is gained from another damage type');
    if (!stat.from && m.from !== undefined) say(join(path, 'from'), 'belongs only on a stat gained from another damage type, not on ' + m.stat);
    if (stat.from && m.from === stat.type) say(join(path, 'from'), 'is the type the damage is gained as');
    if (m.per !== undefined && !(m.per.div > 0)) say(join(path, 'per.div'), 'must be above 0');
  }

  // Keys and links inside one definition, and between a definition and its nearest relatives.
  const twice = (words) => words.find((w, i) => words.indexOf(w) !== i);
  function keyRules(nodes, say) {
    const keys = nodes.map((n) => n.key), again = twice(keys);
    if (again !== undefined) say('nodes', 'has two nodes with the key "' + again + '"');
    return keys;
  }
  const RULES = {
    cluster: function (def, say) {
      if (!keyRules(def.nodes, say).includes(def.entry)) say('entry', '"' + def.entry + '" is not the key of one of its nodes');
    },
    calling: function (def, say) {
      const keys = keyRules(def.nodes, say);
      def.nodes.forEach((node, i) => node.requires.forEach((key) => {
        if (!keys.includes(key) || key === node.key) say('nodes[' + i + '].requires', '"' + key + '" is not the key of another of its nodes');
      }));
      const owner = byId.class.get(def.class);
      if (owner !== undefined && Array.isArray(owner.callings) && !owner.callings.includes(def.id)) say('class', '"' + def.class + '" does not list this calling');
    },
    class: function (def, say) {
      def.callings.forEach((callingId, i) => {
        const calling = byId.calling.get(callingId);
        if (calling !== undefined && calling.class !== def.id) say('callings[' + i + ']', '"' + callingId + '" belongs to the class "' + calling.class + '"');
      });
    },
    legacyNode: function (def, say) {
      if (def.cost.length !== def.ranks) say('cost', 'must hold one cost for each of its ' + def.ranks + ' ranks, not ' + def.cost.length);
    },
    enemy: function (def, say) {
      const own = def.attacks.map((a) => (typeof a === 'string' ? a : a.id)), again = twice(own);
      if (again !== undefined) say('attacks', 'has two attacks with the id "' + again + '"');
      return own;
    },
    boss: function (def, say) {
      const own = RULES.enemy(def, say);
      def.phases.forEach((p, i) => {
        const named = (field) => p[field].forEach((step, j) => {
          if (typeof step === 'string' && !own.includes(step) && !byId.attack.has(step)) say('phases[' + i + '].' + field + '[' + j + ']', '"' + step + '" is not one of its attacks');
        });
        named('onEnter');
        named('loop');
      });
      if (byId.enemy.has(def.id)) say('id', 'is also the id of an enemy; the two share one pool and need different ids');
    },
    puppet: function (def, say) {
      const keys = def.parts.map((p) => p.key), again = twice(keys);
      if (again !== undefined) say('parts', 'has two parts with the key "' + again + '"');
      def.parts.forEach((p, i) => {
        if (p.parent !== undefined && (p.parent === p.key || !keys.includes(p.parent))) say('parts[' + i + '].parent', '"' + p.parent + '" is not the key of another of its parts');
        if (!own.call(def.palette, p.color)) say('parts[' + i + '].color', '"' + p.color + '" is not in its palette');
      });
    },
    mode: function (def, say) {
      const curves = byId.curves.get('main');
      if (curves !== undefined && !Array.isArray(curves[def.xpCurve])) say('xpCurve', '"' + def.xpCurve + '" is not a list in the curves "main"');
    },
  };

  Defs.finalize = function () {
    const errors = [];
    for (const kind of KINDS) {
      for (const def of lists[kind]) {
        const say = (path, problem) => { errors.push(kind + ' ' + def.id + ': ' + (path === '' ? '' : path + ' ') + problem); };
        say.count = () => errors.length;
        const before = errors.length;
        jsonFaults(def, '', say, []);
        if (errors.length === before) checkFields(def, SCHEMA[kind].fields, SCHEMA[kind].open, '', say);
        if (errors.length === before && RULES[kind] !== undefined) RULES[kind](def, say);
      }
    }
    closed = true;
    Core.deepFreeze([lists, SCHEMA, SHAPES, ENUMS, KINDS]);
    return errors;
  };
})();
