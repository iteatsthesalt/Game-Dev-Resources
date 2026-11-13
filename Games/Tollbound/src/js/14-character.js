// 14-character.js: a character of the Household as plain data, and everything done to one: making it, the modifiers
// it brings to a vigil, its route on the Plan, its finds, voices and knots, its observances and Heed, its experience
// and levels, and what the end of a vigil does to it and to the Household (docs/design/04-progression.md). Every
// function takes and changes plain JSON data; none keeps anything between calls.
// Owns: Char
// Public:
//   Char.SLOTS                       the eight places a character wears finds in: tool, hat, coat, hands, girdle,
//                                    pattens, token-1, token-2 (a base of slot 'token' fits either token place)
//   Char.PLACES = [1, 3, 8, 15, 25, 35]   the levels at which the six places of a loadout open
//   Char.create(save, classId, name, bells?) -> char | null
//                                    a new standing character of the Household: level 1, its class's door as the start
//                                    of its route on the Plan (when the Plan has one), its class's starting voices (the
//                                    first in the places its level opens, the rest held), its class's starting gear
//                                    worn as blank finds (Items.make when there is one), and the bells it rings: uids of
//                                    bells hung in the Bellframe, at most the ringing places bought, whose dead teach it
//                                    the observances they knew. null, and nothing changed, when the class is not open,
//                                    the name is not 1 to 24 letters, a bell cannot be rung, or a vigil is under way.
//   Char.find(save, uid) -> char | null      a standing character of the save
//   Char.open(save, classId) -> boolean      the class exists and is open (its unlock is null, or a bequest opened it)
//   Char.classes(save) -> [classId]          the classes a new character may take, in the order they were defined
//   Char.mods(char, S, account) -> [Mod]     what the character brings to the sheet (20-sim.js asks for it at every
//                                    rebuild): its class's attributes at its level and the class's own modifiers; the
//                                    Plan (Tree.mods(char, toll, out) when 13-tree.js has it; else every node of the
//                                    route at its printed value, once for each time the route holds it, a lane by the
//                                    attribute point chosen); its calling's nodes; the observances it keeps, but for
//                                    those S.observances.broken names (their promise broken until the next toll);
//                                    mourning (full: hum-gain +50% and the flag full-mourning; half: hum-gain +25%); the
//                                    Bellframe (Bellframe.mods(account, char, out) when there is one; else every open
//                                    pit's grant and the gift of every bell it rang, worked at the bell's level, one
//                                    for every bellframe.weighPer tolls it weighs past the first, to 20, times the true
//                                    ring, and twice for a bell that rings double); and last its worn finds
//                                    (Items.mods(find, attrs, out) when 12-items.js has it; else Char.findMods), whose
//                                    share is worked from the attributes the rest gives. S is the run or null (outside
//                                    a vigil every ring of the Plan counts); account the save's account or a run's.
//   Char.weapon(char) -> null                no tool is a weapon (02-combat.md, 15.2)
//   Char.sheet(char, account) -> Sheet       the character's sheet outside a vigil (Stats.sheet of Char.mods, no
//                                    conditions), for the Lantern
//   Char.findMods(find, attrs, out) -> out   the plain meaning of a find: its fixed line, and every written line by
//                                    Char.lineMod at the find's share: Stats.share of the attribute of the posture that
//                                    wrote most of its lines (the earliest place breaks a tie) against 4 a notch
//   Char.lineMod(line, share) -> Mod         one written line as a modifier: its value times share, times 0.6 when a
//                                    word is struck; its tags unless the object is struck; its condition (as unless
//                                    when the line is cut backward) unless the condition is struck
//   Char.notches(find) -> n                  the lines written on it
//   Char.points(char) -> {have, spent, free} points of the Plan: one a level from the second, and planPoints
//   Char.allocate(char, nodeId, choice?) -> boolean   one point: the route's head steps to a node linked to it. A node
//                                    the route holds already is doubled (once at most). A lane that offers a choice
//                                    needs one of its attributes the first time. (Sim.command 'allocate' calls it.)
//   Char.refundPrice(char) -> coin           what taking back the head costs: the plan's refund x the node's ring
//   Char.refund(char, account) -> nodeId | null   takes back the newest point, paid from account.coin; never the door
//   Char.equip(char, uid, slot, chest) -> boolean   wears a find of chest.finds in a place its base fits; what was worn
//                                    there goes back to the chest. A find first worn stops cooling (cool 0). Without a
//                                    chest (Sim.command 'equip' in a vigil) nothing is worn: false.
//   Char.unequip(char, slot, chest) -> boolean
//   Char.places(char) -> n                   the places of the loadout its level has opened
//   Char.place(char, voiceUid | null, place) -> boolean   puts a voice it holds in an open place (0 to 5), or empties
//                                    the place; a voice already placed elsewhere swaps with what stood there
//   Char.voice(uid, voiceId) -> VoiceInst    a voice as it is found: level 1, a rope of two empty places, no tolls
//   Char.rope(level) -> 2..5                 the knots a voice's rope holds at a level: 2, and one more at 7, 13, 19
//   Char.tie(char, voiceUid, at, knotId) -> boolean   ties one of the character's knots into place at of a voice's
//                                    rope, when it fits the voice (Stats.fits); what was tied there is untied first
//   Char.untie(char, voiceUid, at) -> boolean
//   Char.give(char, chest, what) -> boolean  from the character to the Household's chest: {voice: uid} (not placed)
//                                    or {knot: id} (one untied knot)
//   Char.take(char, chest, what) -> boolean  the other way
//   Char.heed(char, account) -> {max, held, free}   its Heed: heed-max from its sheet, what its observances hold
//   Char.learn(char, observanceId) -> boolean
//   Char.hold(char, observanceId, account) -> boolean   keeps an observance it knows, when its free Heed allows
//   Char.release(char, observanceId) -> boolean
//   Char.need(char, mode?) -> xp             the experience its next level needs (mode.xpCurve of the curves 'main';
//                                    the Household's when no mode is given); Infinity at the mode's levelCap
//   Char.gain(char, xp, mode?) -> levels     experience, kept the moment it is earned: levels rise while it reaches what
//                                    the next needs; a place a new level opens takes a voice the character holds.
//                                    21-player.js calls it for every ember of a vigil.
//   Char.mourning(char) -> 'full' | 'half' | null
//   Char.trueRing(weights) -> pairs          the true ring of bells of these weights: in order of weight, the
//                                    neighbouring pairs whose weights differ by trueLow to trueHigh percent of the
//                                    heavier (10 to 30)
//   Char.begin(save, uid, zone, seed) -> cfg | null
//                                    a vigil of that character: the save notes it under way (save.away) and the run's
//                                    cfg is {mode: 'household', zone, seed, char: a copy, account}, where account is
//                                    what the run reads of the save: {frame, open, warned}: copies of the Bellframe and
//                                    of what bequests opened, and warned, the seconds sooner the Register shows each
//                                    attack that killed a character (0.15 a death, three at most). null when there is
//                                    no such character, the zone does not exist, or a vigil is under way already.
//   Char.checkpoint(save, S) -> boolean      what is kept the moment it is earned goes into the save while the vigil
//                                    goes on (the game calls it at every toll and when the page is hidden): the run's
//                                    copy of the character (its experience, levels, the lines its worn finds took, the
//                                    voices and knots it found), the Hum heard so far, the tolls heard so far
//   Char.end(save, S) -> report | null       what the end of the vigil S does (S.result set): what was banked joins the
//                                    Household (S.bank.coin to its coin, S.bank.finds to its chest, each with a uid of
//                                    the save) whatever came after; the haul carried (S.haul, S.coin) is lost; the Hum
//                                    heard is kept. Rung down ('left') or spared, the character lives: it takes the
//                                    run's copy, every voice of its loadout counts the tolls (a level every 8, to 20,
//                                    its rope growing), and a struck place that took a line keeps it. Dead ('died'): its
//                                    worn finds go to the chest (a place struck for a re-walk and its two neighbours
//                                    are erased for good), its knots go to the chest untied, its voices fall silent
//                                    with it; it is recast as a bell (weight: the tolls of its whole life) waiting to be
//                                    hung; the Register gains it (S.cause); a cause not yet on the Register pays
//                                    bellframe.deathHum (40) x the tolls x hum-gain; every other standing character
//                                    mourns it (a vigil for every 10 levels it had, at least one; a longer term
//                                    lengthens a term already running, a shorter one adds nothing). Every recast find
//                                    of the chest cools by the tolls heard (Items.cool, when there is one). The tolls
//                                    heard are S.toll, which counts a toll rung in the step the vigil ended. Then
//                                    Progress.endVigil(save, S, report), when 15-progress.js has it. report: {char,
//                                    name, class, outcome, zone, tolls, level, rose, coin, finds, lost: {coin, finds},
//                                    hum, death, bell, first}
//   Char.abandoned(save) -> report | null    a vigil the page left unfinished (save.away still set when the game
//                                    starts): the character lives, as if spared, with what the last checkpoint kept,
//                                    its haul lost; outcome 'unfinished'
//   Char.retire(save, uid) -> bell | null    a standing character leaves the Household alive: recast as a bell, on the
//                                    Register as retired, everything it held given to the chest
//
// A uid below 1 is a run's own: a voice found in a vigil takes -(++S.uid) (the run cannot know the save's counter),
// and Char.checkpoint and Char.end give each such voice a uid of the save, its place in the loadout kept.
// The shapes (16-savedata.js checks them):
//   Char = {uid, name, class, calling, callingPoints, callingNodes, peals, level, xp, planPoints,
//           plan: {walk: [nodeId], choice: {[nodeId]: attribute}}, worn: {[slot]: Find | null}, voices: [VoiceInst],
//           loadout: [uid | null] x 6, knots: {[knotId]: n}, observances: [id], known: [id], bells: [bellUid],
//           mourning: null | {term, left}, tolls, vigils, bequests: {[id]: {n, done}}}
//   VoiceInst = {uid, id, level, rope, knots: [knotId | null] x rope, tolls}
//   Find = {uid, base, level, fixed: Mod, lines: [Line | null] x 8, gone: [place], walk: -1 | place, cool: 0..4}
//   Line = {stat, op, value, tags, cond, posture, toll, backward, struck: null | 'object' | 'condition', band: [lo, hi]}
//   Bell = {uid, of, name, class, calling, weight, gift, pit, double, known}
//   Death = {uid, name, class, calling, level, tolls, vigils, zone, toll, cause: null | {attack, kind}, how, bell}
(function () {
  'use strict';

  const floor = Math.floor, min = Math.min, max = Math.max;
  const SLIVER = 1e-9, XP_MOST = 1e12;
  const SLOTS = ['tool', 'hat', 'coat', 'hands', 'girdle', 'pattens', 'token-1', 'token-2'];
  const PLACES = [1, 3, 8, 15, 25, 35];
  const ROPE_AT = [7, 13, 19];                     // a rope holds 2 knots, and one more at each of these voice levels
  const VOICE_TOLLS = 8, VOICE_MOST = 20;          // a voice gains a level for every 8 tolls it speaks through
  const LINES = 8, STRUCK = 0.6;                   // the places of a find; what a line with a struck word works at
  const NAME_MOST = 24, BAD_NAME = /[\u0000-\u001f\u007f]/;
  const MOURN_LEVELS = 10, FULL_HUM = 50, HALF_HUM = 25;
  const REGISTER_EARLY = 0.15, REGISTER_MOST = 3;
  // the numbers of the Bellframe when it has no def of its own ('bellframe' 'main', 44-bellframe.js)
  const FRAME = Object.freeze({ trueLow: 10, trueHigh: 30, trueGain: 5, weighPer: 8, deathHum: 40, placesMost: 8 });
  const MOURNING = 'flag.full-mourning';
  const NO_TAGS = Object.freeze([]);

  Char.SLOTS = Object.freeze(SLOTS.slice());
  Char.PLACES = Object.freeze(PLACES.slice());

  const clone = (v) => JSON.parse(JSON.stringify(v));
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const frameNumbers = () => (Defs.has('bellframe', 'main') ? Defs.get('bellframe', 'main') : FRAME);

  function indexOf(save, uid) {
    for (let i = 0; i < save.chars.length; i++) if (save.chars[i].uid === uid) return i;
    return -1;
  }

  Char.find = function (save, uid) {
    const i = indexOf(save, uid);
    return i < 0 ? null : save.chars[i];
  };

  // ---- classes, names, and a new character ----

  Char.open = function (save, classId) {
    if (typeof classId !== 'string' || !Defs.has('class', classId)) return false;
    return Defs.get('class', classId).unlock === null || save.account.open.classes.indexOf(classId) >= 0;
  };

  Char.classes = function (save) {
    return Defs.all('class').filter((c) => Char.open(save, c.id)).map((c) => c.id);
  };

  function goodName(name) {
    if (typeof name !== 'string') return false;
    const t = name.trim();
    return t.length >= 1 && t.length <= NAME_MOST && !BAD_NAME.test(t);
  }

  // the bells a new character may ring: hung ones, none twice, no more than the places bought
  function ringable(save, bells) {
    const frame = save.account.frame;
    if (bells.length > frame.places) return false;
    for (let i = 0; i < bells.length; i++) {
      if (bells.indexOf(bells[i]) !== i) return false;
      const b = bellOf(frame, bells[i]);
      if (b === null || b.pit === null) return false;
    }
    return true;
  }

  function bellOf(frame, uid) {
    const list = frame && Array.isArray(frame.bells) ? frame.bells : NO_TAGS;
    for (let i = 0; i < list.length; i++) if (list[i].uid === uid) return list[i];
    return null;
  }

  function doorOf(classId) {
    const nodes = Defs.all('node');
    for (let i = 0; i < nodes.length; i++) if (nodes[i].kind === 'door' && nodes[i].class === classId) return nodes[i].id;
    return null;
  }

  // the middle of a ModRange's range, as a value: a blank find made without a roll
  function middle(r) {
    if (Array.isArray(r.min)) return [(r.min[0] + r.max[0]) / 2, (r.min[1] + r.max[1]) / 2];
    return (r.min + r.max) / 2;
  }

  // a blank find of a base: only its fixed line, every place for a written line empty
  function blankFind(baseId, level, uid) {
    if (typeof Items.make === 'function') return Items.make(baseId, level, uid, 0.5);
    const base = Defs.get('base', baseId), f = base.fixed;
    const fixed = { stat: f.stat, op: f.op, value: middle(f) };
    if (f.tags !== undefined) fixed.tags = f.tags.slice();
    if (f.cond !== undefined) fixed.cond = clone(f.cond);
    if (f.unless !== undefined) fixed.unless = clone(f.unless);
    const lines = [];
    for (let i = 0; i < LINES; i++) lines.push(null);
    return { uid, base: baseId, level, fixed, lines, gone: [], walk: -1, cool: 0 };
  }

  function fitsSlot(base, slot) { return base.slot === 'token' ? slot === 'token-1' || slot === 'token-2' : base.slot === slot; }

  // a place for a find of this base that holds nothing yet, or null
  function freeSlot(char, base) {
    for (let i = 0; i < SLOTS.length; i++) if (fitsSlot(base, SLOTS[i]) && char.worn[SLOTS[i]] === null) return SLOTS[i];
    return null;
  }

  Char.voice = function (uid, id) { return { uid, id, level: 1, rope: 2, knots: [null, null], tolls: 0 }; };

  Char.create = function (save, classId, name, bells) {
    const ring = Array.isArray(bells) ? bells : [];
    if (save.away !== null || !Char.open(save, classId) || !goodName(name) || !ringable(save, ring)) return null;
    const def = Defs.get('class', classId), char = {
      uid: SaveData.uid(save), name: name.trim(), class: classId, calling: null, callingPoints: 0, callingNodes: [], peals: [],
      level: 1, xp: 0, planPoints: 0, plan: { walk: [], choice: {} }, worn: {}, voices: [], loadout: [null, null, null, null, null, null],
      knots: {}, observances: [], known: [], bells: ring.slice(), mourning: null, tolls: 0, vigils: 0, bequests: {},
    };
    for (let i = 0; i < SLOTS.length; i++) char.worn[SLOTS[i]] = null;
    const door = doorOf(classId);
    if (door !== null) char.plan.walk.push(door);
    for (let i = 0; i < def.voices.length; i++) char.voices.push(Char.voice(SaveData.uid(save), def.voices[i]));
    fill(char);
    for (let i = 0; i < def.startGear.length; i++) {
      if (!Defs.has('base', def.startGear[i])) continue;
      const base = Defs.get('base', def.startGear[i]), slot = freeSlot(char, base);
      if (slot !== null) char.worn[slot] = blankFind(base.id, base.level, SaveData.uid(save));
    }
    for (let i = 0; i < ring.length; i++) {          // the dead teach the observances they knew
      const known = bellOf(save.account.frame, ring[i]).known;
      for (let k = 0; k < known.length; k++) Char.learn(char, known[k]);
    }
    save.chars.push(char);
    return char;
  };

  // ---- what a character brings to the sheet ----

  function planMods(char, out) {
    const walk = char.plan.walk, choice = char.plan.choice;
    for (let i = 0; i < walk.length; i++) {
      if (!Defs.has('node', walk[i])) continue;
      const node = Defs.get('node', walk[i]);
      if (node.choice !== null && own(choice, walk[i])) out.push({ stat: choice[walk[i]], op: 'flat', value: 1 });
      for (let k = 0; k < node.mods.length; k++) out.push(node.mods[k]);
    }
  }

  function times(m, k) {
    if (k === 1) return m;
    const v = m.value;
    return Object.assign({}, m, { value: Array.isArray(v) ? [v[0] * k, v[1] * k] : v * k });
  }

  Char.trueRing = function (weights) {
    const w = weights.slice().sort((a, b) => a - b), n = frameNumbers();
    let pairs = 0;
    for (let i = 1; i < w.length; i++) {
      if (!(w[i] > 0)) continue;
      const d = (w[i] - w[i - 1]) / w[i] * 100;
      if (d >= n.trueLow - SLIVER && d <= n.trueHigh + SLIVER) pairs++;
    }
    return pairs;
  };

  function frameMods(account, char, out) {
    const frame = account && account.frame;
    if (!frame) return;
    const pits = Array.isArray(frame.pits) ? frame.pits : NO_TAGS;
    for (let i = 0; i < pits.length; i++) {
      if (!Defs.has('pit', pits[i])) continue;
      const grant = Defs.get('pit', pits[i]).grant;
      for (let k = 0; k < grant.length; k++) out.push(grant[k]);
    }
    const rung = [];
    for (let i = 0; i < char.bells.length; i++) { const b = bellOf(frame, char.bells[i]); if (b !== null) rung.push(b); }
    if (rung.length === 0) return;
    const n = frameNumbers(), ring = 1 + n.trueGain / 100 * Char.trueRing(rung.map((b) => b.weight));
    for (let i = 0; i < rung.length; i++) {
      const b = rung[i];
      if (b.gift === null || !Defs.has('gift', b.gift)) continue;
      const level = min(Stats.LEVEL_MAX, 1 + floor(b.weight / n.weighPer)), list = Stats.resolve(Defs.get('gift', b.gift).mods, level);
      for (let k = 0; k < list.length; k++) out.push(times(list[k], ring * (b.double ? 2 : 1)));
    }
  }

  Char.notches = function (find) {
    let n = 0;
    for (let i = 0; i < find.lines.length; i++) if (find.lines[i] !== null) n++;
    return n;
  };

  Char.lineMod = function (line, share) {
    const k = (share > 0 ? share : 0) * (line.struck === null || line.struck === undefined ? 1 : STRUCK), v = line.value;
    const m = { stat: line.stat, op: line.op, value: Array.isArray(v) ? [v[0] * k, v[1] * k] : v * k };
    if (line.struck !== 'object' && line.tags.length > 0) m.tags = line.tags;
    if (line.struck !== 'condition') { if (line.backward) m.unless = line.cond; else m.cond = line.cond; }
    return m;
  };

  Char.findMods = function (find, attrs, out) {
    if (find.fixed) out.push(find.fixed);
    const by = [0, 0, 0, 0], first = [LINES, LINES, LINES, LINES];
    let notches = 0;
    for (let i = 0; i < find.lines.length; i++) {
      const line = find.lines[i];
      if (line === null) continue;
      notches++;
      const p = Stats.POSTURE[line.posture];
      if (p === undefined) continue;
      by[p]++;
      if (i < first[p]) first[p] = i;
    }
    if (notches === 0) return out;
    let best = -1;
    for (let p = 0; p < by.length; p++) if (by[p] > 0 && (best < 0 || by[p] > by[best] || (by[p] === by[best] && first[p] < first[best]))) best = p;
    const attr = best < 0 ? null : Stats.POSTURES[best].attr;
    const share = attr === null ? 1 : Stats.share(attrs[attr], Stats.WANTS.line * notches);
    for (let i = 0; i < find.lines.length; i++) if (find.lines[i] !== null) out.push(Char.lineMod(find.lines[i], share));
    return out;
  };

  Char.mourning = function (char) {
    const m = char.mourning;
    if (!m || !(m.left > 0)) return null;
    return m.left > floor(m.term / 2) ? 'full' : 'half';
  };

  Char.mods = function (char, S, account) {
    const out = [], def = Defs.get('class', char.class), level = char.level >= 1 ? char.level : 1;
    for (let i = 0; i < Stats.PRIMARIES.length; i++) {
      const id = Stats.PRIMARIES[i].id, v = (def.attrs[id] || 0) + (def.perLevel[id] || 0) * (level - 1);
      if (v !== 0) out.push({ stat: id, op: 'flat', value: v });
    }
    for (let i = 0; i < def.base.length; i++) out.push(def.base[i]);
    const toll = S ? S.toll : Infinity;
    if (typeof Tree.mods === 'function') Tree.mods(char, toll, out); else planMods(char, out);
    if (char.calling !== null && Defs.has('calling', char.calling)) {
      const nodes = Defs.get('calling', char.calling).nodes;
      for (let i = 0; i < nodes.length; i++) if (char.callingNodes.indexOf(nodes[i].key) >= 0) for (let k = 0; k < nodes[i].mods.length; k++) out.push(nodes[i].mods[k]);
    }
    const broken = S && S.observances && S.observances.broken ? S.observances.broken : null;
    for (let i = 0; i < char.observances.length; i++) {
      const id = char.observances[i];
      if (!Defs.has('observance', id) || (broken !== null && broken[id] === true)) continue;
      const mods = Defs.get('observance', id).mods;
      for (let k = 0; k < mods.length; k++) out.push(mods[k]);
    }
    const grief = Char.mourning(char);
    if (grief === 'full') out.push({ stat: 'hum-gain', op: 'inc', value: FULL_HUM }, { stat: MOURNING, op: 'flat', value: 1 });
    else if (grief === 'half') out.push({ stat: 'hum-gain', op: 'inc', value: HALF_HUM });
    if (typeof Bellframe.mods === 'function') Bellframe.mods(account || null, char, out); else frameMods(account, char, out);
    // last, the finds: what each works at depends on the attributes all the rest gives
    const conds = S && S.player ? S.player.conds : 0, prim = { level }, attrs = {};
    for (let i = 0; i < Stats.PRIMARIES.length; i++) attrs[Stats.PRIMARIES[i].id] = Stats.query(out, Stats.PRIMARIES[i].id, NO_TAGS, conds, prim);
    for (let i = 0; i < SLOTS.length; i++) {
      const find = char.worn[SLOTS[i]];
      if (!find) continue;
      if (typeof Items.mods === 'function') Items.mods(find, attrs, out); else Char.findMods(find, attrs, out);
    }
    return out;
  };

  Char.weapon = function () { return null; };

  Char.sheet = function (char, account) {
    return Stats.sheet(Char.mods(char, null, account), { level: char.level, observances: char.observances.length, conds: 0 });
  };

  // ---- the Plan ----

  Char.points = function (char) {
    const have = char.level - 1 + char.planPoints, spent = char.plan.walk.length > 1 ? char.plan.walk.length - 1 : 0;
    return { have, spent, free: have - spent };
  };

  Char.allocate = function (char, id, choice) {
    const walk = char.plan.walk;
    if (typeof id !== 'string' || !Defs.has('node', id) || walk.length === 0 || Char.points(char).free <= 0) return false;
    const head = walk[walk.length - 1];
    if (!Defs.has('node', head) || Defs.get('node', head).links.indexOf(id) < 0) return false;
    let held = 0;
    for (let i = 0; i < walk.length; i++) if (walk[i] === id) held++;
    if (held >= 2) return false;                     // a node is doubled once at most
    const node = Defs.get('node', id);
    if (held === 0 && node.choice !== null) {
      if (node.choice.indexOf(choice) < 0) return false;
      char.plan.choice[id] = choice;
    }
    walk.push(id);
    return true;
  };

  Char.refundPrice = function (char) {
    const walk = char.plan.walk;
    if (walk.length < 2 || !Defs.has('plan', 'main') || !Defs.has('node', walk[walk.length - 1])) return 0;
    return Defs.get('plan', 'main').refund * Defs.get('node', walk[walk.length - 1]).ring;
  };

  Char.refund = function (char, account) {
    const walk = char.plan.walk;
    if (!account || walk.length < 2) return null;
    const price = Char.refundPrice(char);
    if (!(account.coin >= price)) return null;
    account.coin -= price;
    const id = walk.pop();
    if (walk.indexOf(id) < 0) delete char.plan.choice[id];
    return id;
  };

  // ---- finds ----

  Char.equip = function (char, uid, slot, chest) {
    if (!chest || !Array.isArray(chest.finds) || SLOTS.indexOf(slot) < 0) return false;
    let at = -1;
    for (let i = 0; i < chest.finds.length; i++) if (chest.finds[i].uid === uid) at = i;
    if (at < 0) return false;
    const find = chest.finds[at];
    if (!Defs.has('base', find.base) || !fitsSlot(Defs.get('base', find.base), slot)) return false;
    chest.finds.splice(at, 1);
    if (char.worn[slot]) chest.finds.push(char.worn[slot]);
    find.cool = 0;                                   // a recast find cools until it is first worn
    char.worn[slot] = find;
    return true;
  };

  Char.unequip = function (char, slot, chest) {
    if (!chest || !Array.isArray(chest.finds) || SLOTS.indexOf(slot) < 0 || !char.worn[slot]) return false;
    chest.finds.push(char.worn[slot]);
    char.worn[slot] = null;
    return true;
  };

  // ---- voices and knots ----

  Char.places = function (char) {
    let n = 0;
    for (let i = 0; i < PLACES.length; i++) if (char.level >= PLACES[i]) n++;
    return n;
  };

  Char.rope = function (level) {
    let n = 2;
    for (let i = 0; i < ROPE_AT.length; i++) if (level >= ROPE_AT[i]) n++;
    return n;
  };

  function voiceOf(char, uid) {
    for (let i = 0; i < char.voices.length; i++) if (char.voices[i].uid === uid) return char.voices[i];
    return null;
  }

  // the open places that are empty take the voices it holds that stand in no place, in order
  function fill(char) {
    const open = Char.places(char);
    for (let p = 0; p < open && p < char.loadout.length; p++) {
      if (char.loadout[p] !== null) continue;
      let v = null;
      for (let i = 0; i < char.voices.length && v === null; i++) if (char.loadout.indexOf(char.voices[i].uid) < 0) v = char.voices[i];
      if (v === null) return;
      char.loadout[p] = v.uid;
    }
  }

  Char.place = function (char, uid, place) {
    if (typeof place !== 'number' || floor(place) !== place || place < 0 || place >= Char.places(char) || place >= char.loadout.length) return false;
    if (uid === null) { char.loadout[place] = null; return true; }
    if (voiceOf(char, uid) === null) return false;
    const was = char.loadout.indexOf(uid);
    if (was >= 0) char.loadout[was] = char.loadout[place];
    char.loadout[place] = uid;
    return true;
  };

  function untieAt(char, v, at) {
    const k = v.knots[at];
    if (k === null || k === undefined) return false;
    char.knots[k] = (own(char.knots, k) ? char.knots[k] : 0) + 1;
    v.knots[at] = null;
    return true;
  }

  Char.tie = function (char, uid, at, knotId) {
    const v = voiceOf(char, uid);
    if (v === null || typeof at !== 'number' || floor(at) !== at || at < 0 || at >= v.rope) return false;
    if (typeof knotId !== 'string' || !own(char.knots, knotId) || !(char.knots[knotId] > 0) || !Defs.has('knot', knotId) || !Defs.has('voice', v.id)) return false;
    if (!Stats.fits(Defs.get('voice', v.id), Defs.get('knot', knotId))) return false;
    untieAt(char, v, at);
    if (--char.knots[knotId] <= 0) delete char.knots[knotId];
    v.knots[at] = knotId;
    return true;
  };

  Char.untie = function (char, uid, at) {
    const v = voiceOf(char, uid);
    return v !== null && typeof at === 'number' && at >= 0 && at < v.knots.length && untieAt(char, v, at);
  };

  function moveKnot(from, to, id) {
    if (typeof id !== 'string' || !own(from, id) || !(from[id] > 0)) return false;
    if (--from[id] <= 0) delete from[id];
    to[id] = (own(to, id) ? to[id] : 0) + 1;
    return true;
  }

  Char.give = function (char, chest, what) {
    if (!chest || !what) return false;
    if (what.voice !== undefined) {
      if (char.loadout.indexOf(what.voice) >= 0) return false;
      for (let i = 0; i < char.voices.length; i++) {
        if (char.voices[i].uid !== what.voice) continue;
        chest.voices.push(char.voices.splice(i, 1)[0]);
        return true;
      }
      return false;
    }
    return what.knot !== undefined && moveKnot(char.knots, chest.knots, what.knot);
  };

  Char.take = function (char, chest, what) {
    if (!chest || !what) return false;
    if (what.voice !== undefined) {
      for (let i = 0; i < chest.voices.length; i++) {
        if (chest.voices[i].uid !== what.voice) continue;
        char.voices.push(chest.voices.splice(i, 1)[0]);
        fill(char);
        return true;
      }
      return false;
    }
    return what.knot !== undefined && moveKnot(chest.knots, char.knots, what.knot);
  };

  // ---- observances and Heed ----

  function held(char) {
    let n = 0;
    for (let i = 0; i < char.observances.length; i++) if (Defs.has('observance', char.observances[i])) n += Defs.get('observance', char.observances[i]).heed;
    return n;
  }

  Char.heed = function (char, account) {
    const most = Char.sheet(char, account).stats['heed-max'], h = held(char);
    return { max: most, held: h, free: most - h };
  };

  Char.learn = function (char, id) {
    if (typeof id !== 'string' || !Defs.has('observance', id) || char.known.indexOf(id) >= 0) return false;
    char.known.push(id);
    return true;
  };

  Char.hold = function (char, id, account) {
    if (char.known.indexOf(id) < 0 || char.observances.indexOf(id) >= 0 || !Defs.has('observance', id)) return false;
    if (Char.heed(char, account).free < Defs.get('observance', id).heed) return false;
    char.observances.push(id);
    return true;
  };

  Char.release = function (char, id) {
    const at = char.observances.indexOf(id);
    if (at < 0) return false;
    char.observances.splice(at, 1);
    return true;
  };

  // ---- experience and levels ----

  function modeOf(mode) {
    if (mode && typeof mode.xpCurve === 'string') return mode;
    return Defs.has('mode', 'household') ? Defs.get('mode', 'household') : null;
  }

  Char.need = function (char, mode) {
    const m = modeOf(mode), curves = Defs.has('curves', 'main') ? Defs.get('curves', 'main') : null;
    const curve = m !== null && curves !== null ? curves[m.xpCurve] : null;
    if (!Array.isArray(curve) || curve.length === 0 || char.level >= m.levelCap) return Infinity;
    const need = curve[char.level - 1 < curve.length ? char.level - 1 : curve.length - 1];
    return need > 0 ? need : Infinity;
  };

  Char.gain = function (char, xp, mode) {
    if (!(xp > 0)) return 0;
    char.xp = char.xp + xp < XP_MOST ? char.xp + xp : XP_MOST;
    let rose = 0;
    for (;;) {
      const need = Char.need(char, mode);
      if (!(char.xp >= need - SLIVER)) break;
      char.xp = char.xp - need > 0 ? char.xp - need : 0;
      char.level++;
      rose++;
    }
    if (rose > 0) fill(char);
    return rose;
  };

  // ---- the vigil ----

  function warnedOf(register) {
    const deaths = Object.create(null), out = Object.create(null);
    for (let i = 0; i < register.length; i++) {
      const d = register[i];
      if (d.how !== 'died' || d.cause === null || typeof d.cause.attack !== 'string') continue;
      const k = d.cause.attack, n = deaths[k] === undefined ? 0 : deaths[k];
      deaths[k] = n < REGISTER_MOST ? n + 1 : n;
    }
    for (const k in deaths) out[k] = deaths[k] * REGISTER_EARLY;
    return out;
  }

  Char.begin = function (save, uid, zone, seed) {
    const char = Char.find(save, uid);
    if (char === null || save.away !== null || typeof zone !== 'string' || !Defs.has('zone', zone)) return null;
    if (!(typeof seed === 'string' || (typeof seed === 'number' && seed === seed))) return null;
    save.away = { char: uid, zone, seed, hum: save.account.hum, heard: save.account.heard, level: char.level, tolls: 0 };
    save.active = uid;
    const account = { frame: clone(save.account.frame), open: clone(save.account.open), warned: warnedOf(save.register) };
    return { mode: 'household', zone, seed, char: clone(char), account };
  };

  // a voice found in the run has a uid below 1: it takes one of the save's, and keeps its place
  function renumber(save, char) {
    for (let i = 0; i < char.voices.length; i++) {
      const v = char.voices[i];
      if (v.uid >= 1) continue;
      const was = v.uid, at = char.loadout.indexOf(was);
      v.uid = SaveData.uid(save);
      if (at >= 0) char.loadout[at] = v.uid;
    }
    return char;
  }

  function hum(n) { return n > 0 && n < XP_MOST ? n : 0; }

  Char.checkpoint = function (save, S) {
    const away = save.away, run = S && S.cfg ? S.cfg.char : null;
    if (!away || !run || run.uid !== away.char) return false;
    const i = indexOf(save, away.char);
    if (i < 0) return false;
    save.chars[i] = renumber(save, clone(run));
    save.account.hum = away.hum + hum(S.hum);
    save.account.heard = away.heard + hum(S.hum);
    away.tolls = S.toll;
    return true;
  };

  function countdown(char) {
    if (char.mourning === null) return;
    char.mourning.left--;
    if (!(char.mourning.left > 0)) char.mourning = null;
  }

  function mourn(char, level) {
    const term = max(1, floor(level / MOURN_LEVELS)), m = char.mourning;
    if (m === null || term > m.left) char.mourning = { term, left: term };
  }

  // a character that lived through the vigil: its loadout's voices count the tolls; a struck place that took a line keeps it
  function survive(char, tolls) {
    for (let i = 0; i < char.loadout.length; i++) {
      const v = char.loadout[i] === null ? null : voiceOf(char, char.loadout[i]);
      if (v === null) continue;
      v.tolls += tolls;
      const level = min(VOICE_MOST, 1 + floor(v.tolls / VOICE_TOLLS));
      if (level > v.level) v.level = level;
      v.rope = Char.rope(v.level);
      while (v.knots.length < v.rope) v.knots.push(null);
    }
    for (let i = 0; i < SLOTS.length; i++) {
      const f = char.worn[SLOTS[i]];
      if (f && f.walk >= 0 && f.lines[f.walk] !== null) f.walk = -1;
    }
  }

  // a find worn at death: the place struck for a re-walk and both its neighbours are erased for good
  function erase(f) {
    if (!(f.walk >= 0)) return;
    for (let k = f.walk - 1; k <= f.walk + 1; k++) {
      if (k < 0 || k >= f.lines.length) continue;
      f.lines[k] = null;
      if (f.gone.indexOf(k) < 0) f.gone.push(k);
    }
    f.gone.sort((a, b) => a - b);
    f.walk = -1;
  }

  function giftOf(classId, callingId) {
    const gifts = Defs.all('gift');
    for (let i = 0; i < gifts.length; i++) if (gifts[i].class === classId && gifts[i].calling === callingId) return gifts[i].id;
    return null;
  }

  // recast as a bell, weighing the tolls of its whole life; hung by the player later
  function cast(save, char) {
    const bell = {
      uid: SaveData.uid(save), of: char.uid, name: char.name, class: char.class, calling: char.calling, weight: char.tolls,
      gift: giftOf(char.class, char.calling), pit: null, double: false, known: char.known.slice(),
    };
    save.account.frame.bells.push(bell);
    return bell;
  }

  function knotsToChest(save, char) {
    const chest = save.chest.knots;
    for (let i = 0; i < char.voices.length; i++) {
      const knots = char.voices[i].knots;
      for (let k = 0; k < knots.length; k++) if (knots[k] !== null) chest[knots[k]] = (own(chest, knots[k]) ? chest[knots[k]] : 0) + 1;
    }
    for (const id of Object.keys(char.knots)) chest[id] = (own(chest, id) ? chest[id] : 0) + char.knots[id];
  }

  const causeKey = (c) => (c === null || c === undefined ? null : typeof c.attack === 'string' ? c.attack : c.kind);

  function bury(save, char, i, zone, toll, cause) {
    const key = causeKey(cause);
    let first = key !== null;
    for (let k = 0; k < save.register.length && first; k++) if (save.register[k].how === 'died' && causeKey(save.register[k].cause) === key) first = false;
    for (let k = 0; k < SLOTS.length; k++) {
      const f = char.worn[SLOTS[k]];
      if (!f) continue;
      erase(f);
      save.chest.finds.push(f);
      char.worn[SLOTS[k]] = null;
    }
    knotsToChest(save, char);
    const bell = cast(save, char), death = {
      uid: char.uid, name: char.name, class: char.class, calling: char.calling, level: char.level, tolls: char.tolls, vigils: char.vigils,
      zone, toll, cause: cause ? { attack: cause.attack, kind: cause.kind } : null, how: 'died', bell: bell.uid,
    };
    save.register.push(death);
    save.chars.splice(i, 1);
    if (save.active === char.uid) save.active = null;
    for (let k = 0; k < save.chars.length; k++) mourn(save.chars[k], char.level);
    return { death, bell, first };
  }

  // recast finds in the chest cool by every toll the Household hears, by the finds' own rule
  function cool(save, tolls) {
    if (typeof Items.cool !== 'function' || !(tolls > 0)) return;
    for (let i = 0; i < save.chest.finds.length; i++) if (save.chest.finds[i].cool > 0) Items.cool(save.chest.finds[i], tolls);
  }

  Char.end = function (save, S) {
    const away = save.away, run = S && S.cfg ? S.cfg.char : null, result = S ? S.result : null;
    if (!away || !run || run.uid !== away.char || !result) return null;
    save.away = null;
    const i = indexOf(save, away.char);
    if (i < 0) return null;
    // the tolls heard: S.toll, which counts a toll rung in the very step the vigil ended (a character Tolled-for dies
    // as the toll rings, after the result was counted): the death came at that toll
    const char = renumber(save, clone(run)), tolls = S.toll, gain = S.sheet ? S.sheet.stats['hum-gain'] / 100 : 1;
    const report = {
      char: char.uid, name: char.name, class: char.class, outcome: result.outcome, zone: result.zone, tolls, level: char.level,
      rose: char.level - away.level, coin: S.bank.coin, finds: S.bank.finds.length, lost: { coin: S.coin, finds: S.haul.length },
      hum: hum(S.hum), death: null, bell: null, first: false,
    };
    save.account.coin += S.bank.coin;                // what was banked belongs to the Household, whatever came after
    for (let k = 0; k < S.bank.finds.length; k++) {
      const find = clone(S.bank.finds[k]);
      find.uid = SaveData.uid(save);
      save.chest.finds.push(find);
    }
    char.tolls += tolls;
    char.vigils++;
    countdown(char);
    if (result.outcome === 'died') {
      const d = bury(save, char, i, result.zone, tolls, S.cause);
      report.death = d.death;
      report.bell = d.bell;
      report.first = d.first;
      if (d.first) report.hum += frameNumbers().deathHum * tolls * gain;
    } else {
      survive(char, tolls);
      save.chars[i] = char;
    }
    save.account.hum = away.hum + report.hum;
    save.account.heard = away.heard + report.hum;
    cool(save, tolls);
    if (typeof Progress.endVigil === 'function') Progress.endVigil(save, S, report);
    return report;
  };

  Char.abandoned = function (save) {
    const away = save.away;
    if (!away) return null;
    save.away = null;
    const char = Char.find(save, away.char);
    if (char === null) return null;
    char.tolls += away.tolls;
    char.vigils++;
    countdown(char);
    survive(char, away.tolls);
    cool(save, away.tolls);
    return {
      char: char.uid, name: char.name, class: char.class, outcome: 'unfinished', zone: away.zone, tolls: away.tolls, level: char.level,
      rose: char.level - away.level, coin: 0, finds: 0, lost: { coin: 0, finds: 0 }, hum: save.account.hum - away.hum, death: null, bell: null, first: false,
    };
  };

  Char.retire = function (save, uid) {
    const i = indexOf(save, uid);
    if (save.away !== null || i < 0) return null;
    const char = save.chars[i];
    for (let k = 0; k < SLOTS.length; k++) {
      if (char.worn[SLOTS[k]]) save.chest.finds.push(char.worn[SLOTS[k]]);
      char.worn[SLOTS[k]] = null;
    }
    for (let k = 0; k < char.voices.length; k++) save.chest.voices.push(char.voices[k]);
    for (const id of Object.keys(char.knots)) save.chest.knots[id] = (own(save.chest.knots, id) ? save.chest.knots[id] : 0) + char.knots[id];
    const bell = cast(save, char);
    save.register.push({
      uid: char.uid, name: char.name, class: char.class, calling: char.calling, level: char.level, tolls: char.tolls, vigils: char.vigils,
      zone: null, toll: 0, cause: null, how: 'retired', bell: bell.uid,
    });
    save.chars.splice(i, 1);
    if (save.active === uid) save.active = null;
    return bell;
  };
})();
