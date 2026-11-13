// 27-observances.js: the observances a character keeps, in a vigil (docs/design/04-progression.md, "Observances and
// Heed"): each is a promise the thumb keeps or breaks, run once a step; a broken one's modifiers stop until the next
// toll mends it, and its Heed stays held. And what the dead leave: when an elite or a keeper falls, now and then a
// blank voice or a knot, which is the run's character's at once.
// Owns: Observances
// Public:
//   Observances.promise(rule, {step(S, id, params) -> boolean, mods?(S, id, params, out)})   registers a promise and
//                     allows its name for observances (Defs.allow('promise', rule)). step runs once a step in a vigil for
//                     each observance the character keeps whose promise is rule, with that observance's params, and
//                     returns false when the promise broke. It runs while the promise is broken as well, to keep its own
//                     count; a false then changes nothing. mods, when given, adds what the promise gives while kept
//                     beyond the observance's own modifiers (the Round's periods, the cairns of Alms): this file's
//                     Sim.source calls it for each observance kept and not broken. This file registers the six promises
//                     of 36-observances.js (below).
//   Observances.record(S, id) -> record   what a kept observance's promise holds in this vigil, S.observances.of[id],
//                     made at its first use: {toll: -1, x, y, n, t: -1, flag, seen, reach}
//   Observances.leave(S, rank, x, y) -> def | null   what one of the dead of that rank leaves where it fell, by this
//                     file's odds (an elite ODDS.elite, a keeper ODDS.keeper, the common dead nothing), from
//                     S.observances.rng: a voice (ODDS.voice of the time, while the character holds fewer than
//                     VOICES_MOST) or else a knot, of the tier the district gives (its zone's ordinal, one more for a
//                     keeper; the nearest lower tier that has any), into the run's character at once: a blank voice,
//                     Char.voice(-(++S.uid), id), held in S.cfg.char.voices, or one more of the knot in
//                     S.cfg.char.knots; then S.dirty and an event 'found'. null when it leaves nothing.
//   Observances.ODDS = {elite: 0.3, keeper: 1, voice: 1/3}
//   Observances.VOICES_MOST = 64     the voices a character may hold (16-savedata.js holds a save to that)
//   Observances.warning(char, account) -> seconds   how much sooner free Heed shows every Swell, at the Lantern: free
//                     Heed (Char.heed) x 0.01 + warn, within 0 and 1 (in a vigil Dmg.warning adds the Register's head
//                     start for an attack and a Sounded attacker)
//   Observances.held(o) -> 'cairn' | 'mourned' | null   what of this file holds a pickup back, by its state
//   Observances.CAIRN = -1, LEFT_CAIRN = -3, MOURNED = -2, LEFT_MOURNED = -4    the states it gives pickups it holds
//                     back (Player.pickups leaves a pickup lying while its state is below 0): a cairn of Alms, and a
//                     bright find in Full Mourning; LEFT_ once the player has been away from it
//
// Slot: S.observances = {broken, of, toll, scarred, cairns, sight, rng}: broken {[observanceId]: true} while a promise
// stays broken, which Char.mods reads (the observance's modifiers stop; its Heed stays held); of: each kept
// observance's record; toll: the toll last seen; scarred: the greatest life Hand on the Bell has scarred this vigil (a
// Sim.source takes it off life-max); cairns: the cairns of Alms standing; sight: the metres beyond which the dead cannot
// make the player out (Full Mourning; 0 while nothing hides the player); rng: the stream the dead's leavings are drawn
// from, forked from S.rng.loot, so that the finds' own draws do not move with them.
// System 'observances' (Sim.system, after 27-notches): when S.toll has risen every broken promise is mended (an event
// 'promise', a = 1); then the promise of each observance kept runs, and one that breaks stays broken until the next
// toll (S.dirty; 'promise', a = 0); then each 'kill' of an elite or a keeper in the step's events may leave a voice or
// a knot (Observances.leave).
// Events: 'promise' (x, y the player; a = 0 broken, 1 mended; id = the observance), 'found' (x, y where the body fell;
// a = 0 a voice, 1 a knot; id = its def's id), and 'scar' (x, y the player; a = the greatest life lost; id = the
// observance) when Hand on the Bell scars.
// Heed needs no system: Dmg.warning works free Heed from heed-max and the observances kept, and Char.heed says the
// same at the Lantern.
// The finds this file holds back are the finds' package's pickups: it holds one only from state 0 or Items.FULL (the
// haul's own limit), lays none itself, and lets one go to Items.FULL while the haul holds Items.HAUL_MOST, so that
// 27-notches.js lets it go as room comes: no promise, and no wider reach (the bees'), takes the haul past its limit.
//
// The promises. An observance's params are its numbers; the rest are this file's.
//   stability        the player stays within reach metres of where it stood when the last toll rang (where the vigil
//                    began, before the first)
//   unbroken-round   the player's edge comes within touch metres of the bell-post's at least once in each toll period;
//                    each toll that finds the period kept counts one more (most at most), each giving harm % damage and
//                    speed % speed; a toll that finds it missed empties the count and breaks the promise
//   alms             the first find to lie in each toll period (a pickup of kind 2; not a heaved one) is left lying as a
//                    cairn for the vigil (its state CAIRN); each cairn standing gives more % xp-gain; once the player has
//                    been leave metres from a cairn, walking back onto it takes it (its state 0: Player.pickups takes
//                    it) and breaks the promise
//   telling-the-bees an elite or a keeper falling ('kill', a >= Sim.ELITE) is to be told within within seconds by
//                    standing still still seconds: then the count nearest of the dead are driven drive metres back from
//                    the player; a death left untold breaks the promise, and the bees take what they were fetching (the
//                    pickups within the player's pickup-reach but beyond the stat's base reach). While broken, no death
//                    is owed.
//   full-mourning    the grade: black, and one lighter at every every-th toll (grey, then lavender): the dead cannot make
//                    the player out beyond black, grey or lavender metres (S.observances.sight); while black the flag
//                    full-mourning keeps coin from being picked up (as the Household's own full mourning does); finds
//                    in every grade are held back (state MOURNED); once the player has been leave metres from one,
//                    walking back onto it takes it and breaks the promise. While broken nothing is held back.
//   hand-on-the-bell a Blow taking more than heavy % of the player's greatest life at once (a 'hurt' event of the Blow's
//                    kind) breaks the promise, and scar % of what it took beyond that share is scarred at once
(function () {
  'use strict';

  const SLIVER = 1e-9, floor = Math.floor, sqrt = Math.sqrt;
  const ODDS = Object.freeze({ elite: 0.3, keeper: 1, voice: 1 / 3 });
  const VOICES_MOST = 64, TIER_MOST = 5;
  const CAIRN = -1, MOURNED = -2, LEFT_CAIRN = -3, LEFT_MOURNED = -4;
  const EMBER = 0, COIN = 1, FIND = 2;           // the kinds of pickup (docs/engine.md, "Pickups")
  const TOUCH = 0.3;             // metres between edges: walking onto a pickup, as Player.pickups takes one
  const CAIRN_TTL = 1e6;         // seconds: a cairn stands for the rest of the vigil
  const DRIVE_REACH = 40;        // metres: the bees find the nearest of the dead anywhere in a district
  const WARN_PER_HEED = 0.01, WARN_MOST = 1;
  const MOURNING = 'flag.full-mourning';
  const NONE = Object.freeze({});

  let BLOW = -1;                                 // the kind of harm Brace guards: a Blow
  for (let t = 0; t < Stats.TYPES.length; t++) if (BLOW < 0 && Stats.TYPES[t].guard === 'brace') BLOW = t;

  const promises = Object.create(null);
  const forNear = new Array(64).fill(null), forPost = new Array(16).fill(null);
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const num = (v) => (v > 0 ? v : 0);

  Defs.allow('event', 'promise', 'found');

  Sim.state('observances', function (S) {
    return { broken: {}, of: {}, toll: S.toll, scarred: 0, cairns: 0, sight: 0, rng: S.rng.loot.fork('found') };
  });

  Observances.ODDS = ODDS;
  Observances.VOICES_MOST = VOICES_MOST;
  Observances.CAIRN = CAIRN; Observances.MOURNED = MOURNED; Observances.LEFT_CAIRN = LEFT_CAIRN; Observances.LEFT_MOURNED = LEFT_MOURNED;

  Observances.promise = function (rule, spec) {
    Core.assert(typeof rule === 'string' && rule !== '' && spec && typeof spec.step === 'function', 'Observances.promise needs a rule and {step}');
    Core.assert(promises[rule] === undefined, 'Observances.promise: there are two promises named "' + rule + '"');
    Defs.allow('promise', rule);
    promises[rule] = spec;
  };

  Observances.record = function (S, id) {
    const of = S.observances.of;
    if (!own(of, id)) of[id] = { toll: -1, x: 0, y: 0, n: 0, t: -1, flag: false, seen: 0, reach: 0 };
    return of[id];
  };

  Observances.held = function (o) {
    return o.state === CAIRN || o.state === LEFT_CAIRN ? 'cairn' : o.state === MOURNED || o.state === LEFT_MOURNED ? 'mourned' : null;
  };

  Observances.warning = function (char, account) {
    const heed = Char.heed(char, account), w = num(heed.free) * WARN_PER_HEED + Char.sheet(char, account).stats.warn;
    return w < 0 ? 0 : w > WARN_MOST ? WARN_MOST : w;
  };

  // ---- what the promises kept give, and Hand on the Bell's scars ----

  Sim.source(function (S, out) {
    const O = S.observances, char = S.cfg.char;
    if (!O) return;
    if (O.scarred > 0) out.push({ stat: 'life-max', op: 'flat', value: -O.scarred });
    if (!char || !Array.isArray(char.observances)) return;
    for (let i = 0; i < char.observances.length; i++) {
      const id = char.observances[i];
      if (O.broken[id] === true || !Defs.has('observance', id)) continue;
      const def = Defs.get('observance', id), spec = def.promise ? promises[def.promise] : undefined;
      if (spec !== undefined && typeof spec.mods === 'function') spec.mods(S, id, def.params || NONE, out);
    }
  });

  // ---- the step ----

  Sim.system('observances', function (S) {
    const O = S.observances, char = S.cfg.char, p = S.player;
    if (!O || !char) return;
    if (O.toll !== S.toll) {                       // a toll: every promise broken is mended
      O.toll = S.toll;
      for (const id in O.broken) {
        if (O.broken[id] !== true) continue;
        delete O.broken[id];
        S.dirty = true;
        Sim.emit(S, 'promise', p.x, p.y, 1, 0, id);
      }
    }
    O.sight = 0;
    const kept = Array.isArray(char.observances) ? char.observances : null;
    for (let i = 0; kept !== null && i < kept.length; i++) {
      const id = kept[i];
      if (!Defs.has('observance', id)) continue;
      const def = Defs.get('observance', id), spec = def.promise ? promises[def.promise] : undefined;
      if (spec === undefined || spec.step(S, id, def.params || NONE) !== false || O.broken[id] === true) continue;
      O.broken[id] = true;
      S.dirty = true;
      Sim.emit(S, 'promise', p.x, p.y, 0, 0, id);
    }
    const ring = S.events, start = S.eventStart, n = S.eventCount;
    for (let i = 0; i < n; i++) {
      const e = ring[(start + i) % ring.length];
      if (e.k === 'kill' && e.a >= Sim.ELITE) Observances.leave(S, e.a, e.x, e.y);
    }
  });

  // ---- what the dead leave ----

  // one definition of a kind at the tier asked, else of the nearest lower tier that has any; null when none has
  function draw(rng, kind, tier) {
    const all = Defs.all(kind);
    for (let t = tier; t >= 1; t--) {
      let n = 0;
      for (let i = 0; i < all.length; i++) if (all[i].tier === t) n++;
      if (n === 0) continue;
      let k = floor(rng.next() * n);
      for (let i = 0; i < all.length; i++) if (all[i].tier === t && k-- === 0) return all[i];
    }
    return null;
  }

  Observances.leave = function (S, rank, x, y) {
    const char = S.cfg.char, O = S.observances;
    if (!char || !O || !(rank >= Sim.ELITE)) return null;
    const keeper = rank >= Sim.BOSS, rng = O.rng;
    if (!(rng.next() < (keeper ? ODDS.keeper : ODDS.elite))) return null;
    const voice = rng.next() < ODDS.voice && char.voices.length < VOICES_MOST;
    const place = S.zone && S.zone.ordinal > 0 ? S.zone.ordinal : 1, tier = place + (keeper ? 1 : 0);
    const def = draw(rng, voice ? 'voice' : 'knot', tier < TIER_MOST ? tier : TIER_MOST);
    if (def === null) return null;
    if (voice) char.voices.push(Char.voice(-(++S.uid), def.id));
    else char.knots[def.id] = (own(char.knots, def.id) ? char.knots[def.id] : 0) + 1;
    S.dirty = true;
    Sim.emit(S, 'found', x, y, voice ? 0 : 1, 0, def.id);
    return def;
  };

  // ---- helpers of the promises ----

  // metres between the edges of the player and a pickup
  function edge(p, o) {
    const dx = o.x - p.x, dy = o.y - p.y;
    return sqrt(dx * dx + dy * dy) - p.r - (o.r > 0 ? o.r : 0);
  }

  // a find lying free: not held back by any system but the haul's own limit (Items.FULL)
  const lying = (o) => o.state === 0 || (typeof Items.FULL === 'number' && o.state === Items.FULL);

  // did this step's events say that the great fell, or that a find was heaved?
  function said(S, k, great) {
    const ring = S.events;
    for (let i = 0; i < S.eventCount; i++) {
      const e = ring[(S.eventStart + i) % ring.length];
      if (e.k === k && (!great || e.a >= Sim.ELITE)) return true;
    }
    return false;
  }

  // a find this file held back is let go: free to be picked up, or held by the haul's own limit while the haul is full
  // (27-notches.js lets a find held so go as room comes), so that nothing here takes the haul past Items.HAUL_MOST
  function release(S, o) {
    o.state = typeof Items.FULL === 'number' && typeof Items.HAUL_MOST === 'number' && S.haul.length >= Items.HAUL_MOST ? Items.FULL : 0;
  }

  // a pickup held back (state from, or from's LEFT_ twin) as the player leaves it and walks back onto it: true when
  // it was walked back onto (taken: let go, release)
  function claimed(S, p, o, from, left, leave) {
    const d = edge(p, o);
    if (o.state === from) { if (d > leave) o.state = left; return false; }
    if (o.state !== left || d > TOUCH) return false;
    release(S, o);
    return true;
  }

  // ---- the six promises ----

  Observances.promise('stability', {
    step: function (S, id, pr) {
      const r = Observances.record(S, id), p = S.player, reach = num(pr.reach);
      if (r.toll !== S.toll) { r.toll = S.toll; r.x = p.x; r.y = p.y; }      // the ring is drawn where the toll found you
      const dx = p.x - r.x, dy = p.y - r.y;
      return dx * dx + dy * dy <= reach * reach + SLIVER;
    },
  });

  // the bell-post: its place into r.x, r.y, and how near the player's centre must come to touch it (0: no post)
  function post(S, r, touch) {
    const n = World.withRole(S, 'bell-post', forPost);
    if (n === 0) return 0;
    r.x = forPost[0].x; r.y = forPost[0].y;
    const reach = forPost[0].r + S.player.r + num(touch);
    for (let i = 0; i < n; i++) forPost[i] = null;
    return reach;
  }

  Observances.promise('unbroken-round', {
    step: function (S, id, pr) {
      const r = Observances.record(S, id), p = S.player;
      if (r.toll < 0) { r.toll = S.toll; r.reach = post(S, r, pr.touch); }
      if (r.reach > 0) {
        const dx = p.x - r.x, dy = p.y - r.y;
        if (dx * dx + dy * dy <= r.reach * r.reach + SLIVER) r.flag = true;
      }
      if (r.toll === S.toll) return true;
      r.toll = S.toll;                             // a toll: the period just ended is counted
      const kept = r.flag, most = pr.most > 0 ? floor(pr.most) : 0;
      r.flag = false;
      if (kept) {
        if (r.n < most) { r.n++; S.dirty = true; }
        return true;
      }
      if (r.n > 0) { r.n = 0; S.dirty = true; }
      return false;
    },
    mods: function (S, id, pr, out) {
      const r = S.observances.of[id];
      if (!r || !(r.n > 0)) return;
      if (pr.harm > 0) out.push({ stat: 'damage', op: 'inc', value: pr.harm * r.n });
      if (pr.speed > 0) out.push({ stat: 'speed', op: 'inc', value: pr.speed * r.n });
    },
  });

  Observances.promise('alms', {
    step: function (S, id, pr) {
      const O = S.observances, r = Observances.record(S, id), p = S.player, broken = O.broken[id] === true;
      if (r.toll !== S.toll) { r.toll = S.toll; r.flag = false; }            // a new period: its first find is the alms
      const take = !r.flag && !broken && !said(S, 'heave', false), leave = num(pr.leave), items = S.pickups.items;
      let kept = true, cairns = 0;
      for (let i = 0; i < S.pickups.n; i++) {
        const o = items[i];
        if (!o.alive || o.kind !== FIND) continue;
        if (o.state === CAIRN || o.state === LEFT_CAIRN) {
          if (claimed(S, p, o, CAIRN, LEFT_CAIRN, leave)) kept = false;      // taken back
          else cairns++;
        } else if (take && !r.flag && o.uid > r.seen && lying(o)) {
          o.state = CAIRN;
          o.ttl = CAIRN_TTL;
          r.flag = true;
          cairns++;
        }
      }
      r.seen = S.uid;
      if (cairns !== O.cairns) { O.cairns = cairns; S.dirty = true; }
      return kept;
    },
    mods: function (S, id, pr, out) {
      const n = S.observances.cairns;
      if (n > 0 && pr.more > 0) out.push({ stat: 'xp-gain', op: 'inc', value: pr.more * n });
    },
  });

  // the bees, told: the nearest of the dead are driven back from the player
  function drive(S, pr) {
    const p = S.player, k = pr.count >= 1 ? floor(pr.count) : 0, far = num(pr.drive);
    const n = Skills.pick(S, 'nearest', p.x, p.y, DRIVE_REACH, k < forNear.length ? k : forNear.length, forNear);
    for (let i = 0; i < n; i++) {
      const e = forNear[i], dx = e.x - p.x, dy = e.y - p.y, d = sqrt(dx * dx + dy * dy);
      forNear[i] = null;
      if (d > 1e-6 && far > 0) Dmg.shove(S, e, dx / d * far, dy / d * far);
    }
  }

  // the bees, untold, leave with what they were fetching: what lies within the hive's reach but beyond a bare one
  function carried(S) {
    const p = S.player, reach = S.sheet.stats['pickup-reach'], bare = Stats.stat('pickup-reach').base, items = S.pickups.items;
    for (let i = 0; i < S.pickups.n; i++) {
      const o = items[i];
      if (!o.alive || o.kind < EMBER || o.kind > FIND || o.state < 0) continue;
      const dx = o.x - p.x, dy = o.y - p.y, d2 = dx * dx + dy * dy;
      if (d2 > bare * bare && d2 <= reach * reach) S.pickups.kill(o);
    }
  }

  Observances.promise('telling-the-bees', {
    step: function (S, id, pr) {
      const O = S.observances, r = Observances.record(S, id), p = S.player;
      if (O.broken[id] === true) { r.t = -1; return true; }                  // the bees are away until the toll
      if (r.t < 0 && said(S, 'kill', true)) r.t = S.t + num(pr.within);
      if (r.t < 0) return true;
      if (p.stillT >= num(pr.still) - SLIVER) { r.t = -1; drive(S, pr); return true; }   // told
      if (S.t <= r.t + SLIVER) return true;
      r.t = -1;
      carried(S);
      return false;
    },
  });

  Observances.promise('full-mourning', {
    step: function (S, id, pr) {
      const O = S.observances, r = Observances.record(S, id), p = S.player, broken = O.broken[id] === true;
      const every = pr.every >= 1 ? floor(pr.every) : 0, g = every > 0 ? floor(S.toll / every) : 0, grade = g < 2 ? g : 2;
      if (grade !== r.n) { r.n = grade; S.dirty = true; }                   // a grade lighter: coin is allowed again
      if (!broken) O.sight = grade === 0 ? num(pr.black) : grade === 1 ? num(pr.grey) : num(pr.lavender);
      const leave = num(pr.leave), items = S.pickups.items;
      let kept = true;
      for (let i = 0; i < S.pickups.n; i++) {
        const o = items[i];
        if (!o.alive || o.kind !== FIND) continue;
        const held = o.state === MOURNED || o.state === LEFT_MOURNED;
        if (broken) { if (held) release(S, o); continue; }
        if (!held) { if (lying(o)) o.state = MOURNED; continue; }
        if (claimed(S, p, o, MOURNED, LEFT_MOURNED, leave)) kept = false;
      }
      return kept;
    },
    mods: function (S, id, pr, out) {
      const r = S.observances.of[id];                     // black until its first step says otherwise
      if (!r || r.n === 0) out.push({ stat: MOURNING, op: 'flat', value: 1 });
    },
  });

  Observances.promise('hand-on-the-bell', {
    step: function (S, id, pr) {
      const O = S.observances, p = S.player;
      if (O.broken[id] === true || BLOW < 0) return true;
      const heavy = num(pr.heavy) / 100 * S.sheet.stats['life-max'], ring = S.events;
      for (let i = 0; i < S.eventCount; i++) {
        const e = ring[(S.eventStart + i) % ring.length];
        if (e.k !== 'hurt' || e.b !== BLOW || !(e.a > heavy)) continue;
        const lost = num(pr.scar) / 100 * (e.a - heavy);
        if (lost > 0) {
          O.scarred += lost;
          S.dirty = true;
          Sim.emit(S, 'scar', p.x, p.y, lost, 0, id);
        }
        return false;
      }
      return true;
    },
  });
})();
