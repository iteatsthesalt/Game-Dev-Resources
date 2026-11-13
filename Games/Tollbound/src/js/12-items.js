// 12-items.js: finds as data (docs/design/04-progression.md, "Finds"): making one, what a worn find gives, writing one
// line by the posture of a toll period, the four changes made at the Lantern (chisel, re-walk, recast, cut), cooling,
// and the coin each change costs. Every function takes and changes plain JSON data and keeps nothing between calls.
// What runs in a vigil (the postures of a toll period, the tolls that write, the finds the dead drop, the heave) is
// 27-notches.js's, which adds to Items too.
// Owns: Items
// Public:
//   Items.LINES = 8                  the places of a find for written lines
//   Items.CHANGES                    ['chisel', 'rewalk', 'recast', 'cut'], the four ways to change a find
//   Items.make(baseId, level, uid, roll) -> Find
//                                    a blank find of that base and level (1 to 70): its fixed line rolled within the
//                                    base's range at roll (0 to 1: from S.rng.loot in a vigil, 0.5 for a class's
//                                    starting gear, which Char.create asks for), every place empty, gone [], walk -1,
//                                    cool 0
//   Items.mods(find, attrs, out) -> out   what a worn find gives (Char.mods calls it): Char.findMods, kept as it is:
//                                    its fixed line in full, and every written line by Char.lineMod at the find's
//                                    share, Stats.share(attrs[attr], Stats.WANTS.line x notches), attr being the
//                                    attribute of the posture that wrote most of its lines (the earliest place breaks
//                                    a tie)
//   Items.wants(find) -> {posture, attr, want, notches} | null   what Items.mods works the share from: the posture
//                                    that wrote most of its lines, its attribute, and 4 a notch; null for a blank find,
//                                    which wants nothing
//   Items.attrs(char, account) -> {knee, heel, hand, ear}   the attributes a worn find's share is worked from outside a
//                                    vigil: all that Char.mods gives the character but its finds
//   Items.fits(stat, tags) -> boolean   whether a line on that stat can be held to those tags, so that it can ever
//                                    work: no tags always; the tags of voices and of kinds of harm only on a stat a
//                                    voice's own sheet works out (damage, speed, cond-duration, the skill rows,
//                                    through., added., chance., param.), and on a stat of one kind of harm (added.drag)
//                                    of the kinds' tags only its own (drag, dot); a condition's id only on chance. and
//                                    cond-duration; kinds of harm alone on taken; a family never (no tool is held as a
//                                    weapon, so its tag never holds)
//   Items.draw(rng, open, level) -> baseId | null   a base for a find that drops in a district of that level, drawn by
//                                    the bases' weights: those of level at most that, whose unlock is null or whose id
//                                    is in open (account.open.bases); null when none may drop
//   Items.write(S, find, posture) -> place | -1   one line by the rule of 04-progression.md: verb and object drawn
//                                    from the posture's table (posture: its id or its row of Stats.POSTURES) with
//                                    S.rng.loot, each entry's w times the weight the find's base gives it (1 where it
//                                    names none), the object among those that fit the verb (Items.fits; for all when
//                                    none does); the amount rolled in the verb's band for toll S.toll (the eighth for
//                                    later ones) grown grow percent a level above the first, x notch-size / 100 (from
//                                    S.sheet); cut backward one time in ten. Into the place struck for a re-walk, else
//                                    the first empty place that is not gone; -1 when there is none
//   Items.strength(line) -> 0..1     where a line's value stands in its band, from its weak end to its strong one: the
//                                    end farther from nothing (the low end of a band below 0, such as brace-time's)
//   Items.cool(find, tolls)          a recast find not yet worn cools by the tolls the Household hears: each toll, while
//                                    cool is above 0, raises its weakest line (the lowest Items.strength, the earliest
//                                    place on a tie) one step, a quarter of its band, toward the band's strong end, and
//                                    counts cool down by one, whether a line rose or not (Char.end calls it)
//   Items.price(find, change, other?) -> coin   what a change costs at the Lantern, in the Household's coin: the
//                                    change's own price for a blank find of level 1 (chisel 6, rewalk 4, recast 8, cut
//                                    10), x (1 + 0.1 a level above the first) x (1 + 0.25 a notch); a recast pours two
//                                    finds and costs both (other: the second). Infinity for what is no change.
//   Items.refusal(find, change, a, b) -> null | reason   why a change cannot be made, or null when it can: chisel (a =
//                                    place, b = 'object' | 'condition'), rewalk (a = place), cut (a = place), recast (a
//                                    = the last find poured). reason: 'change' (no such change), 'place' (no place 0 to
//                                    7), 'empty' (no line there), 'word' (not one of the two words), 'struck' (that line
//                                    has a word struck already: one a line, never put back), 'all' (its object is
//                                    everything already: nothing to strike), 'walking' (a place of the find waits for
//                                    its re-walk already), 'same' (one find poured into itself), 'slot' (the two are not
//                                    of one slot), 'base' (a base no definition names)
//   Items.chisel(find, place, word) -> boolean   strikes the word 'object' or 'condition' from a line for good
//                                    (Line.struck; the line then works at 60%, Char.lineMod)
//   Items.rewalk(find, place) -> boolean   strikes a line out and marks its place (find.walk): the first toll survived
//                                    wearing it writes the place anew (27-notches.js), ringing down keeps that, and a
//                                    death erases the place and both its neighbours (Char.end does both)
//   Items.recast(first, last, uid) -> Find | null   pours two finds of one slot into a new one with that uid: the base,
//                                    the fixed line and lines 1 to 4 of the first, lines 5 to 8 of the last, a blank
//                                    place staying blank and a place gone for good staying gone; the higher level; walk
//                                    -1; cool 4. The two poured are the caller's to take out of the chest.
//   Items.cut(find, place) -> boolean   cuts a line away for good (its place into gone); every other line, its value
//                                    and its band, rises 10%
//
// Choices where the design is silent. One step of cooling is a quarter of the line's band, so four steps carry the
// weakest roll to the top. A line whose stat is better lower (brace-time, stride-share, find-weight and the like) is
// written with a band below 0: its strong end is the low one, cooling moves it down, and the cut's 10% makes it larger
// below nothing. Prices are the numbers above, set against the coin of a vigil (about 150 to the keeper).
(function () {
  'use strict';

  const floor = Math.floor, round = Math.round;
  const LINES = 8, BANDS = 8;                      // places for written lines; a verb's bands, by toll (the 8th for later)
  const LEVEL_LEAST = 1, LEVEL_MOST = 70;
  const BACKWARD = 0.1;                            // one line in ten is cut backward
  const FIRST_HALF = 4;                            // a recast takes places 0 to 3 from the first poured, 4 to 7 from the last
  const COOL = 4, COOL_STEPS = 4;                  // a recast find cools four steps, each a quarter of a band
  const CUT_RISE = 1.1;                            // a cut raises every other line 10%
  const PRICE = { chisel: 6, rewalk: 4, recast: 8, cut: 10 };   // coin, for a blank find of level 1
  const LEVEL_RISE = 0.1, NOTCH_RISE = 0.25;      // what a level above the first and a notch add to a price
  const WORDS = ['object', 'condition'];           // the two words the chisel strikes (the verb stays)
  // what the rules themselves name (docs/engine.md, "What is fixed"): the stats a voice's sheet works out with its
  // tags, the prefixes of those families, and the stat of harm taken, which only the kinds of harm limit
  const VOICE_STATS = ['damage', 'speed', 'cond-duration'], VOICE_PREFIXES = ['through.', 'added.', 'chance.', 'param.'];
  const AILING = ['cond-duration'], AILING_PREFIX = 'chance.', TAKEN = 'taken';
  const KIND_TAGS = Stats.TYPES.map((t) => t.id).concat(['hit', 'dot']);
  const KIND_FAMILIES = ['guard.', 'guard-max.', 'through.', 'added.'];   // the families of stats made one for each kind

  Items.LINES = LINES;
  Items.CHANGES = Object.freeze(['chisel', 'rewalk', 'recast', 'cut']);

  const copy = (v) => JSON.parse(JSON.stringify(v));
  const isPlace = (p) => typeof p === 'number' && floor(p) === p && p >= 0 && p < LINES;
  const levelOf = (n) => (n >= LEVEL_LEAST ? (n <= LEVEL_MOST ? floor(n) : LEVEL_MOST) : LEVEL_LEAST);

  function notches(find) {
    let n = 0;
    for (let i = 0; i < find.lines.length; i++) if (find.lines[i] !== null) n++;
    return n;
  }

  // ---- making a find, and what it gives ----

  const between = (lo, hi, r) => lo + (hi - lo) * r;

  Items.make = function (baseId, level, uid, roll) {
    const base = Defs.get('base', baseId), f = base.fixed, r = roll >= 0 && roll <= 1 ? roll : 0.5;
    const value = Array.isArray(f.min) ? [between(f.min[0], f.max[0], r), between(f.min[1], f.max[1], r)] : between(f.min, f.max, r);
    const fixed = { stat: f.stat, op: f.op, value };
    if (f.tags !== undefined) fixed.tags = f.tags.slice();
    if (f.cond !== undefined) fixed.cond = copy(f.cond);
    if (f.unless !== undefined) fixed.unless = copy(f.unless);
    const lines = [];
    for (let i = 0; i < LINES; i++) lines.push(null);
    return { uid, base: baseId, level: levelOf(level), fixed, lines, gone: [], walk: -1, cool: 0 };
  };

  Items.mods = function (find, attrs, out) { return Char.findMods(find, attrs, out); };

  Items.wants = function (find) {
    const n = Stats.POSTURES.length, by = new Array(n).fill(0), first = new Array(n).fill(LINES);
    let count = 0;
    for (let i = 0; i < find.lines.length; i++) {
      const line = find.lines[i];
      if (line === null) continue;
      count++;
      const p = Stats.POSTURE[line.posture];
      if (p === undefined) continue;
      by[p]++;
      if (i < first[p]) first[p] = i;
    }
    if (count === 0) return null;
    let best = -1;
    for (let p = 0; p < n; p++) if (by[p] > 0 && (best < 0 || by[p] > by[best] || (by[p] === by[best] && first[p] < first[best]))) best = p;
    if (best < 0) return { posture: null, attr: null, want: 0, notches: count };
    return { posture: Stats.POSTURES[best].id, attr: Stats.POSTURES[best].attr, want: Stats.WANTS.line * count, notches: count };
  };

  Items.attrs = function (char, account) {
    const bare = Object.assign({}, char, { worn: {} }), mods = Char.mods(bare, null, account || null), out = {};
    const prim = { level: char.level >= 1 ? char.level : 1 };
    for (let i = 0; i < Stats.PRIMARIES.length; i++) out[Stats.PRIMARIES[i].id] = Stats.query(mods, Stats.PRIMARIES[i].id, [], 0, prim);
    return out;
  };

  // ---- which object fits which verb ----

  function voiceStat(stat) {
    const row = Stats.stat(stat);
    if (row === null) return false;
    if (row.skill === true || VOICE_STATS.indexOf(stat) >= 0) return true;
    for (let i = 0; i < VOICE_PREFIXES.length; i++) if (stat.startsWith(VOICE_PREFIXES[i])) return true;
    return false;
  }

  // the kind of harm a stat of a family by kind belongs to (through.drag: drag), or -1
  function kindOfStat(stat) {
    for (let t = 0; t < Stats.TYPES.length; t++) {
      const id = Stats.TYPES[t].id;
      if (stat.length > id.length && stat.endsWith('.' + id) && KIND_FAMILIES.indexOf(stat.slice(0, stat.length - id.length)) >= 0) return t;
    }
    return -1;
  }

  Items.fits = function (stat, tags) {
    if (!Array.isArray(tags) || tags.length === 0) return true;
    if (typeof stat !== 'string' || Stats.stat(stat) === null) return false;
    const voice = voiceStat(stat), ailing = AILING.indexOf(stat) >= 0 || stat.startsWith(AILING_PREFIX), kind = kindOfStat(stat);
    for (let i = 0; i < tags.length; i++) {
      const tag = tags[i], k = KIND_TAGS.indexOf(tag);
      if (!Stats.is('tag', tag) || Stats.is('family', tag)) return false;
      if (stat === TAKEN) { if (k < 0) return false; continue; }
      if (Stats.is('ailment', tag)) { if (!ailing) return false; continue; }
      if (!voice) return false;
      // a stat of one kind of harm (added.drag) is held only to that kind's own tags among the kinds' (drag, dot)
      if (kind >= 0 && k >= 0 && tag !== Stats.TYPES[kind].id && tag !== (Stats.TYPES[kind].ticks ? 'dot' : 'hit')) return false;
    }
    return true;
  };

  // ---- the bases a district drops ----

  function droppable(b, open, level) {
    return b.weight > 0 && b.level <= level && (b.unlock === null || (Array.isArray(open) && open.indexOf(b.id) >= 0));
  }

  Items.draw = function (rng, open, level) {
    const all = Defs.all('base');
    let total = 0, last = null;
    for (let i = 0; i < all.length; i++) if (droppable(all[i], open, level)) { total += all[i].weight; last = all[i].id; }
    if (!(total > 0)) return null;
    let r = rng.next() * total;
    for (let i = 0; i < all.length; i++) {
      if (!droppable(all[i], open, level)) continue;
      r -= all[i].weight;
      if (r < 0) return all[i].id;
    }
    return last;
  };

  // ---- writing a line ----

  // the place a line is written into: the one struck for a re-walk, else the first empty place not gone; -1 if none
  function placeFor(find) {
    if (find.walk >= 0 && find.walk < LINES && find.lines[find.walk] === null) return find.walk;
    for (let i = 0; i < LINES; i++) if (find.lines[i] === null && find.gone.indexOf(i) < 0 && i !== find.walk) return i;
    return -1;
  }

  const biasOf = (bias, key) => (bias && typeof bias[key] === 'number' ? bias[key] : 1);

  // one entry of a table drawn by its w times the base's weight for its key; with stat given (an object), only the
  // entries whose tags fit a line on that stat. null when nothing can be drawn.
  function drawEntry(rng, entries, bias, stat) {
    let total = 0;
    for (let i = 0; i < entries.length; i++) {
      if (stat !== null && !Items.fits(stat, entries[i].tags)) continue;
      total += entries[i].w * biasOf(bias, entries[i].key);
    }
    if (!(total > 0)) return null;
    let r = rng.next() * total, last = null;
    for (let i = 0; i < entries.length; i++) {
      if (stat !== null && !Items.fits(stat, entries[i].tags)) continue;
      const w = entries[i].w * biasOf(bias, entries[i].key);
      if (!(w > 0)) continue;
      last = entries[i];
      r -= w;
      if (r < 0) return entries[i];
    }
    return last;
  }

  Items.write = function (S, find, posture) {
    const row = typeof posture === 'number' ? posture : Stats.POSTURE[posture], P = row === undefined ? undefined : Stats.POSTURES[row];
    if (P === undefined || !find || !Array.isArray(find.lines) || !Defs.has('posture', P.id)) return -1;
    const place = placeFor(find);
    if (place < 0) return -1;
    const table = Defs.get('posture', P.id), base = Defs.has('base', find.base) ? Defs.get('base', find.base) : null;
    const bias = base !== null && base.tables[P.id] ? base.tables[P.id] : null, rng = S.rng.loot;
    const verb = drawEntry(rng, table.verbs, bias ? bias.verbs : null, null);
    if (verb === null) return -1;
    const object = drawEntry(rng, table.objects, bias ? bias.objects : null, verb.stat);
    const toll = S.toll >= 1 ? floor(S.toll) : 1, band = verb.band[(toll < BANDS ? toll : BANDS) - 1];
    const grow = 1 + verb.grow / 100 * (levelOf(find.level) - 1), size = S.sheet ? S.sheet.stats['notch-size'] / 100 : 1;
    const lo = band[0] * grow * size, hi = band[1] * grow * size;
    const value = lo + rng.next() * (hi - lo), backward = rng.chance(BACKWARD);
    find.lines[place] = {
      stat: verb.stat, op: verb.op, value, tags: object === null ? [] : object.tags.slice(), cond: P.cond, posture: P.id, toll,
      backward, struck: null, band: [lo, hi],
    };
    return place;
  };

  // ---- a line within its band, and cooling ----

  const valueOf = (v) => (Array.isArray(v) ? v[1] : v);
  const below = (band) => band[1] <= 0;          // a band below nothing: its strong end is its low one

  Items.strength = function (line) {
    const lo = line.band[0], hi = line.band[1], v = valueOf(line.value);
    if (!(hi > lo)) return 1;                      // a band of no width: there is nowhere to rise
    const s = below(line.band) ? (hi - v) / (hi - lo) : (v - lo) / (hi - lo);
    return s < 0 ? 0 : s > 1 ? 1 : s;
  };

  function weakest(find) {
    let best = -1, least = 1;
    for (let i = 0; i < find.lines.length; i++) {
      const line = find.lines[i];
      if (line === null) continue;
      const s = Items.strength(line);
      if (s < least) { least = s; best = i; }
    }
    return best;
  }

  // one step of cooling: a quarter of the band toward its strong end, never past it
  function riseStep(line) {
    const lo = line.band[0], hi = line.band[1], step = (hi - lo) / COOL_STEPS, v = line.value;
    if (Array.isArray(v)) return;                  // a pair: no line of this file is written so
    line.value = below(line.band) ? (v - step > lo ? v - step : lo) : (v + step < hi ? v + step : hi);
  }

  Items.cool = function (find, tolls) {
    let n = floor(tolls);
    if (!(n > 0) || !(find.cool > 0)) return;
    if (n > find.cool) n = find.cool;
    for (let k = 0; k < n; k++) {
      const i = weakest(find);
      if (i >= 0) riseStep(find.lines[i]);
      find.cool--;
    }
  };

  // ---- the four changes and what they cost ----

  function priceOf(find, change) {
    return round(PRICE[change] * (1 + LEVEL_RISE * (levelOf(find.level) - 1)) * (1 + NOTCH_RISE * notches(find)));
  }

  Items.price = function (find, change, other) {
    if (PRICE[change] === undefined || !find || !Array.isArray(find.lines)) return Infinity;
    let p = priceOf(find, change);
    if (change === 'recast' && other && Array.isArray(other.lines)) p += priceOf(other, change);
    return p;
  };

  const slotOf = (find) => (Defs.has('base', find.base) ? Defs.get('base', find.base).slot : null);

  Items.refusal = function (find, change, a, b) {
    if (Items.CHANGES.indexOf(change) < 0) return 'change';
    if (change === 'recast') {
      const last = a;
      if (!find || !last || find === last || find.uid === last.uid) return 'same';
      const s1 = slotOf(find), s2 = slotOf(last);
      if (s1 === null || s2 === null) return 'base';
      return s1 === s2 ? null : 'slot';
    }
    if (!isPlace(a)) return 'place';
    const line = find.lines[a];
    if (line === null || line === undefined) return 'empty';
    if (change === 'chisel') {
      if (WORDS.indexOf(b) < 0) return 'word';
      if (line.struck !== null && line.struck !== undefined) return 'struck';
      if (b === 'object' && line.tags.length === 0) return 'all';
    } else if (change === 'rewalk') {
      if (find.walk >= 0) return 'walking';
    }
    return null;
  };

  Items.chisel = function (find, place, word) {
    if (Items.refusal(find, 'chisel', place, word) !== null) return false;
    find.lines[place].struck = word;
    return true;
  };

  Items.rewalk = function (find, place) {
    if (Items.refusal(find, 'rewalk', place) !== null) return false;
    find.lines[place] = null;
    find.walk = place;
    return true;
  };

  function rise(line, k) {
    const v = line.value;
    line.value = Array.isArray(v) ? [v[0] * k, v[1] * k] : v * k;
    line.band = [line.band[0] * k, line.band[1] * k];
  }

  Items.cut = function (find, place) {
    if (Items.refusal(find, 'cut', place) !== null) return false;
    find.lines[place] = null;
    if (find.gone.indexOf(place) < 0) find.gone.push(place);
    find.gone.sort((x, y) => x - y);
    for (let i = 0; i < find.lines.length; i++) if (find.lines[i] !== null) rise(find.lines[i], CUT_RISE);
    return true;
  };

  Items.recast = function (first, last, uid) {
    if (Items.refusal(first, 'recast', last) !== null) return null;
    const lines = [], gone = [];
    for (let i = 0; i < LINES; i++) {
      const from = i < FIRST_HALF ? first : last, line = from.lines[i];
      lines.push(line === null || line === undefined ? null : copy(line));
      if (from.gone.indexOf(i) >= 0) gone.push(i);
    }
    return {
      uid, base: first.base, level: levelOf(first.level > last.level ? first.level : last.level), fixed: copy(first.fixed), lines, gone,
      walk: -1, cool: COOL,
    };
  };
})();
