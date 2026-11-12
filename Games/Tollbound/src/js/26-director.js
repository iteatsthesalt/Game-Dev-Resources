// 26-director.js: the vigil's clock and its dead. Each toll's effects (the threat, the count, Hum, a lychgate at
// every third toll, the keeper at the eighth); the dead rising by the zone's timeline and its events; elites; drops on
// a kill; mourning round a fallen elite or keeper; lychgates and ringing down; the far lychgate of Tolled-for and the
// outcome 'spared'; and a district's own rules (the Dial's shadow).
// Owns: Director
// Public:
//   Director.step(S)                 phase 2: the effects of a toll rung since the last step (and of the vigil's start),
//                                    the district's rules, the dead rising (the threat budget, elites, swarms, the
//                                    keeper), the far dead walked back near the player, the open lychgate and ringing
//                                    down, the far lychgate of Tolled-for, the silenced voices coming back
//   Director.onKill(S, e)            the deaths phase, for one of the dead at no life: its embers and coin, the riders
//                                    it carried falling off, mourning round it and a lychgate if it was an elite or a
//                                    keeper, and Hum when the keeper is laid
//   Director.event(kind, fn(S, v))   registers a district's own rule, run once a step in Director.step for a zone whose
//                                    districtRules names kind (a field this file adds to the zone with Defs.extend); v is
//                                    S.vigil. Registered here: 'dial.shadow'.
//   Director.drop(S, kind, value, x, y) -> pickup | null    a pickup of kind 0 (an ember: value is experience) or 1
//                                    (coin) where the dead fell, with a 'drop' event; when the pickups are full (the
//                                    last 8 places are kept for the favours' shapes) the value joins the nearest
//                                    pickup of its kind
//   Director.level(S) -> number      the level the dead rise at now
//
// Zone fields it adds: districtRules (optional, [id]: the rules of Director.event the district keeps) and ordinal
// (optional, 1 to 5: the district's place, for the keeper's Hum). Rules it reads from S.rules (zone.rules may set
// them): overElites (elites in an interval past keeperToll with no event of its own, default 2), shadowSpan,
// shadowSpeed and shadowWarn (the Dial's shadow: its opening in radians, how much faster the dead walk in it, and the
// seconds less warning a Swell in it gives; default pi/2, 1.3 and 0.3).
//
// The timeline. The entry of a zone's timeline in force is the last whose toll is at most S.threat; past the keeper's
// toll the zone's overtoll raises it each threat step: rate x rateMul, the level + levelPer, the reward + rewardPer,
// and the cap + 40. rate is the cost of the dead (an enemy def's cost) that rise a second; the next to rise is drawn
// from the entry's pool by weight from S.rng.spawn, and rises when the budget holds its cost and fewer than cap of the
// dead stand. The dead rise S.rules.spawnRadius from the player, inside the district (1.5 m off its edge), at their
// level: the zone's level + the threat (up to keeperToll) + levelPer past it. A common body farther than
// S.rules.despawnRadius from the player is walked back to a new place of rising (every half second).
//
// A toll's effects, in order: the threat + 1 (Muffle the Toll below); Hum (the toll's number times the landmarks
// stood beside, within 4 m, at a toll this vigil, the bell-post among them, times hum-gain); the turned favour Coins
// on Your Own Eyes; a lychgate at every gateEvery-th toll, at the landmark nearest 14 m from the player, 2.4 m in
// from it toward the middle; the keeper at keeperToll (zone.boss, at the bell-post, or 14 m from the player when the
// player stands within 12 m of it; S.boss); the plan of the next interval: its elites (the zone's events of kind
// 'elite' for that toll, risen evenly through the interval, with their traits or one of the zone's own drawn from
// S.rng.spawn) and swarms (events of kind 'swarm', 4 s after the toll, in the shape 'ring', 'arc' or 'column'); and
// the count. The vigil's start is toll 0: its plan and its count.
// 'count' (x, y the player; a = the tellers: 9 when the next interval's pool is mostly large dead by weight, 3 when
// they are nearly all small (large under 15%), else 6; b = the elites that will rise in it; id = 'gate' when a
// lychgate will open at its end, else null).
//
// Drops: an ember of the body's xp x xp-gain (In Procession x 1.25; Pass the Gate x (1 + 0.08 a gate passed)); coin
// (a keeper 30, an elite 6, a large common body by a chance of 0.35, a small one 0.08, each 1) x the reward x coin-find,
// drawn from S.rng.loot. The reward is 1 + 0.1 a threat step up to keeperToll, + rewardPer past it. Embers and
// coin lie 40 s.
//
// Lychgates. S.gate (the kernel's field) is null or the open lychgate {x, y, until, far, ring, strokes}, one at a
// time: an opening while one stands renews its time (none opens over the far one). One opens for gateOpenSeconds
// after each elite or keeper falls (where it fell) and at every gateEvery-th toll. Standing within gateRadius of it
// rings the player down: ring counts the seconds without a break, a stroke every strokeSeconds, ringStrokes in all;
// each banks its share of the coin (and the finds) carried when ringing began into S.bank, and silences its share of
// the loadout's voices (S.ringing.silent, counted from the last place: the stroke's share of the voices, rounded up);
// the last ends the run 'left'. Driven out sooner, ring and strokes go back to 0, what was banked stays, and the
// silenced voices come back one every backSeconds. The gate does not close while the player rings at it. Events:
// 'gate' (x, y; a = the seconds it stays open; b = 1 for the far lychgate, else 0) and 'stroke' (x, y the lychgate;
// a = the stroke, 1 to 6; b = the coin it banked).
// Tolled-for (the player carries tolled-for): once a vigil the far lychgate opens at the district's edge farthest from
// the player, until the next toll, in place of any other; standing in it while Tolled-for empties S.haul, sets
// S.coin to 0 and ends the run 'spared'.
//
// The turned favours whose rules live here (flags of S.sheet.flags, and the times taken in S.favours):
//   muffle-the-toll   the next toll after it is taken does not raise the threat, and the toll after it raises it two
//                     steps at once (a keeper rising then comes a level higher)
//   pass-the-gate     each lychgate that opens and closes without a stroke rung at it adds 8% to the embers of the
//                     dead and 4% to their speed (22-enemies.js reads S.vigil.passed) for the rest of the vigil
//   coins-on-your-own-eyes   at every toll a lychgate opens 20 m from the player for 15 s, for a fare of 2 coins
//                     out of S.coin, rising by 1 each toll; the first fare that cannot be paid takes the favour away
//                     (S.favours[id] = 0) and no lychgate opens for the next two tolls, the far one aside
//   ring-your-own-passing-bell   the far lychgate of Tolled-for opens 12 m from the player, toward the middle
//
// Its slots: S.vigil (see make() below: the plan, the budget, the keeper, the landmarks, the favours' counts, the
// shade) and S.ringing = {silent, back}. S.vigil.shade = {on, x, y, from, span, reach, speed, warn} is the district's
// shade, kept by its rule: the wedge from (x, y) sunwise from the angle from through span radians, reach metres
// long; the dead in it walk speed times as fast and a Swell shown in it fills warn seconds less. The Dial's shadow is
// cast by the bell-post: its leading edge (from + span) points north (-y) as each toll rings and turns sunwise once
// round in every interval.
(function () {
  'use strict';

  const DT = Core.DT, TAU = Core.TAU, PI = Math.PI, SLIVER = 1e-9;
  const sqrt = Math.sqrt, cos = Math.cos, sin = Math.sin, floor = Math.floor, round = Math.round, pow = Math.pow, ceil = Math.ceil;
  const COMMON = 0, ELITE = 1, BOSS = 3;               // Sim's ranks; Sim has not run when this file loads
  const EMBER = 0, COIN = 1;

  const PROC = Stats.RULE.procession, MOURN = Stats.RULE.mourning, CLUNG = Stats.RULE.riders;
  const TOLLED = Stats.AILMENT['tolled-for'], SEALED = Stats.AILMENT.sealed;

  const EDGE = 1.5, TRIES = 8, PER_STEP = 4, BUDGET_MOST = 40;        // metres, tries, risings a step, cost banked
  const OVER_CAP = 40, REWARD_TOLL = 0.1, SURGE = 4;                  // past the keeper; reward a step; seconds
  const PLAN_MAX = 16, SWARM_MAX = 8;
  const LANDMARK_REACH = 4, GATE_FROM = 14, GATE_IN = 2.4, KEEPER_NEAR = 12, KEEPER_FROM = 14;
  const MOURN_REACH = 8, MOURN_SECONDS = 12, MOURN_FULL = 2;
  const PROC_XP = 1.25, PASS_XP = 0.08, KEEPER_HUM = 50;
  const KEEPER_COIN = 30, ELITE_COIN = 6, LARGE_COIN = 0.35, SMALL_COIN = 0.08;
  const DROP_TTL = 40, DROP_R = 0.2, SCATTER = 0.6, RESERVE = 8;
  const FARE_FIRST = 2, EYES_FROM = 20, EYES_OPEN = 15, NO_GATE = 2, PASSING_FROM = 12;
  const RELOCATE_EVERY = 30;
  const MUFFLE = 'muffle-the-toll', PASS = 'pass-the-gate', EYES = 'coins-on-your-own-eyes', PASSING = 'ring-your-own-passing-bell';

  Defs.extend('zone', {
    districtRules: { type: 'array', required: false, of: { type: 'string', required: true } },
    ordinal: { type: 'int', required: false, min: 1, max: 5 },
  });

  Sim.state('vigil', function () {
    return {
      seen: -1, budget: 0, next: null, relocate: 0,
      tellers: 0, elites: 0, gateSaid: false,          // what the last count said
      eliteN: 0, eliteI: 0, eliteAt: new Float64Array(PLAN_MAX), eliteEv: new Int32Array(PLAN_MAX),
      swarmN: 0, swarmI: 0, swarmAt: new Float64Array(SWARM_MAX), swarmEv: new Int32Array(SWARM_MAX),
      keeper: 0, keeperUid: 0, bell: false,           // keeper: 0 to come, 1 risen, 2 laid; bell: the district's bell speaks
      known: false, postX: 0, postY: 0, landmarks: 0, lx: new Float64Array(31), ly: new Float64Array(31), marks: 0,
      muffles: 0, double: false, keeperUp: 0, passed: 0, rung: false, fare: FARE_FIRST, noGate: 0, far: false,
      ringCoin: 0, ringFinds: 0, bankedCoin: 0, bankedFinds: 0,
      gate: { x: 0, y: 0, until: 0, far: false, ring: 0, strokes: 0 },
      shade: { on: false, x: 0, y: 0, from: 0, span: 0, reach: 0, speed: 1, warn: 0 },
    };
  });

  Sim.state('ringing', function () { return { silent: 0, back: 0 }; });

  // ---- district rules ----

  const rules = Object.create(null);

  Director.event = function (kind, fn) {
    Core.assert(typeof kind === 'string' && kind !== '' && typeof fn === 'function', 'Director.event needs a kind and a function (S, v)');
    Core.assert(rules[kind] === undefined, 'Director.event: there are two district rules named "' + kind + '"');
    rules[kind] = fn;
  };

  Director.event('dial.shadow', function (S, v) {
    const sh = v.shade, rg = S.region, R = S.rules;
    const span = R.shadowSpan > 0 ? R.shadowSpan : PI / 2;
    const turn = S.tollSteps > 0 ? 1 - (S.tollAt - S.step) / S.tollSteps : 0;   // 0 as a toll rings, 1 at the next
    sh.on = true;
    sh.x = v.postX;
    sh.y = v.postY;
    sh.span = span;
    sh.from = Core.angleWrap(-PI / 2 + turn * TAU - span);
    sh.reach = (rg ? rg.radius : 35) + 2;
    sh.speed = R.shadowSpeed > 0 ? R.shadowSpeed : 1.3;
    sh.warn = R.shadowWarn >= 0 ? R.shadowWarn : 0.3;
  });

  // ---- reused scratch: filled before every use, so nothing passes from one call to the next ----

  const opts = { level: 1, rank: 0, traits: null };
  const oneTrait = [''];
  const spot = { x: 0, y: 0, r: 0.5 };
  const found = new Array(1024).fill(null);
  const roles = new Array(64).fill(null);

  // ---- where and how strong ----

  function overOf(S) { return S.threat > S.rules.keeperToll ? S.threat - S.rules.keeperToll : 0; }

  Director.level = function (S) {
    const z = S.zone, kt = S.rules.keeperToll, up = S.threat < kt ? S.threat : kt;
    return z.level + up + overOf(S) * (z.overtoll ? z.overtoll.levelPer : 0);
  };

  function reward(S) {
    const kt = S.rules.keeperToll, up = S.threat < kt ? S.threat : kt;
    return 1 + REWARD_TOLL * up + overOf(S) * (S.zone.overtoll ? S.zone.overtoll.rewardPer : 0);
  }

  function entryAt(zone, threat) {
    const tl = zone.timeline;
    let best = null;
    for (let i = 0; i < tl.length; i++) if (tl[i].toll <= threat && (best === null || tl[i].toll >= best.toll)) best = tl[i];
    return best;
  }

  function inside(S, x, y, edge) {
    const rg = S.region, R = rg.radius - edge, dx = x - rg.x, dy = y - rg.y;
    return dx * dx + dy * dy <= R * R;
  }

  // a place dist metres from the player inside the district, into spot; toward the middle when no draw finds one
  function risePoint(S, dist) {
    const p = S.player, rg = S.region, rng = S.rng.spawn;
    for (let k = 0; k < TRIES; k++) {
      const a = rng.next() * TAU, x = p.x + cos(a) * dist, y = p.y + sin(a) * dist;
      if (inside(S, x, y, EDGE)) { spot.x = x; spot.y = y; return spot; }
    }
    let dx = rg.x - p.x, dy = rg.y - p.y, d = sqrt(dx * dx + dy * dy);
    if (d < 1e-6) { dx = 0; dy = -1; d = 1; }
    spot.x = p.x + dx / d * dist;
    spot.y = p.y + dy / d * dist;
    keepInside(S, spot, EDGE);
    return spot;
  }

  function keepInside(S, o, edge) {
    const rg = S.region, R = rg.radius - edge, dx = o.x - rg.x, dy = o.y - rg.y, d2 = dx * dx + dy * dy;
    if (d2 > R * R) { const d = sqrt(d2); o.x = rg.x + dx / d * R; o.y = rg.y + dy / d * R; }
  }

  // one of the dead rises; null when the pool is full
  function rise(S, id, x, y, level, rank, traits) {
    opts.level = level;
    opts.rank = rank;
    opts.traits = traits;
    const e = Sim.spawnEnemy(S, id, x, y, opts);
    if (e === null) return null;
    World.pushOut(S, e);
    for (let i = 0; i < e.traitN; i++) {           // a trait's numbers: life-max, damage and move-speed, inc
      const mods = e.traits[i].mods;
      for (let j = 0; mods && j < mods.length; j++) {
        const m = mods[j];
        if (m.op !== 'inc' || typeof m.value !== 'number') continue;
        const f = 1 + m.value / 100;
        if (m.stat === 'life-max') { e.life *= f; e.lifeMax *= f; }
        else if (m.stat === 'damage') e.damage *= f;
        else if (m.stat === 'move-speed') e.speed *= f;
      }
    }
    return e;
  }

  // makes room in a full pool for an elite or a keeper: the common body farthest from the player goes
  function makeRoom(S) {
    if (S.enemies.n < S.enemies.cap) return;
    const items = S.enemies.items, p = S.player;
    let far = null, d = -1;
    for (let i = 0; i < S.enemies.n; i++) {
      const e = items[i];
      if (!e.alive || e.rank !== COMMON) continue;
      const k = Core.dist2(e.x, e.y, p.x, p.y);
      if (k > d) { d = k; far = e; }
    }
    if (far !== null) S.enemies.kill(far);
  }

  // ---- the landmarks and the bell-post, found once ----

  function learn(S, v) {
    v.known = true;
    const rg = S.region;
    v.postX = rg ? rg.x : 0;
    v.postY = rg ? rg.y : 0;
    let n = World.withRole(S, 'bell-post', roles);
    if (n > 0) { v.postX = roles[0].x; v.postY = roles[0].y; }
    v.landmarks = 0;
    for (let i = 0; i < n && v.landmarks < 31; i++) { v.lx[v.landmarks] = roles[i].x; v.ly[v.landmarks] = roles[i].y; v.landmarks++; }
    n = World.withRole(S, 'landmark', roles);
    for (let i = 0; i < n && v.landmarks < 31; i++) { v.lx[v.landmarks] = roles[i].x; v.ly[v.landmarks] = roles[i].y; v.landmarks++; }
  }

  // ---- lychgates ----

  function open(S, v, x, y, seconds, far) {
    if (!far && v.noGate > 0) return null;
    const g = v.gate;
    if (S.gate !== null && !far) {
      if (S.gate.far) return null;                 // nothing opens over the far lychgate
      if (S.t + seconds > g.until) g.until = S.t + seconds;
      Sim.emit(S, 'gate', g.x, g.y, g.until - S.t, 0, null);
      return g;
    }
    spot.x = x;
    spot.y = y;
    spot.r = S.rules.gateRadius > 0 ? S.rules.gateRadius * 0.5 : 0.8;
    keepInside(S, spot, EDGE);
    World.pushOut(S, spot);
    g.x = spot.x;
    g.y = spot.y;
    g.until = S.t + seconds;
    g.far = !!far;
    g.ring = 0;
    g.strokes = 0;
    spot.r = 0.5;
    S.gate = g;
    v.rung = false;
    Sim.emit(S, 'gate', g.x, g.y, seconds, far ? 1 : 0, null);
    return g;
  }

  // the gate of every third toll: by the landmark nearest GATE_FROM from the player, in from it toward the middle
  function tollGate(S, v) {
    const p = S.player, rg = S.region;
    let best = -1, err = Infinity;
    for (let k = 0; k < v.landmarks; k++) {
      const d = Core.dist(v.lx[k], v.ly[k], p.x, p.y), off = Math.abs(d - GATE_FROM);
      if ((v.lx[k] !== v.postX || v.ly[k] !== v.postY) && off < err) { err = off; best = k; }
    }
    if (best < 0) {
      risePoint(S, GATE_FROM);
      return open(S, v, spot.x, spot.y, S.rules.gateOpenSeconds, false);
    }
    let dx = rg.x - v.lx[best], dy = rg.y - v.ly[best], d = sqrt(dx * dx + dy * dy);
    if (d < 1e-6) { dx = 0; dy = 1; d = 1; }
    return open(S, v, v.lx[best] + dx / d * GATE_IN, v.ly[best] + dy / d * GATE_IN, S.rules.gateOpenSeconds, false);
  }

  function farGate(S, v) {
    const p = S.player, rg = S.region, flags = S.sheet ? S.sheet.flags : null;
    let dx = p.x - rg.x, dy = p.y - rg.y, d = sqrt(dx * dx + dy * dy);
    if (d < 1e-6) { dx = 0; dy = 1; d = 1; }
    let x, y;
    if (flags && flags[PASSING]) {                 // Ring Your Own Passing Bell: near, toward the middle
      x = p.x - dx / d * PASSING_FROM;
      y = p.y - dy / d * PASSING_FROM;
    } else {                                       // the district's edge farthest from the player
      const R = rg.radius - EDGE - 1;
      x = rg.x - dx / d * R;
      y = rg.y - dy / d * R;
    }
    S.gate = null;
    v.far = true;
    open(S, v, x, y, S.tollAt / Core.HZ - S.t + 0.5, true);
  }

  function voicesOf(S) {
    let n = 0;
    for (let i = 0; i < S.skills.length; i++) if (S.skills[i].inst !== null) n++;
    return n;
  }

  // the open lychgate: ringing down, the far one, closing; and the silenced voices coming back
  function gates(S, v) {
    const p = S.player, rings = S.ringing, R = S.rules, tolled = p.condT[TOLLED] > 0;
    if (tolled && !v.far) farGate(S, v);
    if (S.gate !== null) {
      const r = R.gateRadius, there = p.alive && Core.dist2(p.x, p.y, S.gate.x, S.gate.y) <= r * r;
      if (S.gate.far) {
        if (there && tolled) {
          S.gate.ring += DT;
          S.haul.length = 0;
          S.coin = 0;
          Sim.end(S, 'spared');
          return;
        }
      } else if (there && !tolled) {
        if (S.gate.ring === 0) { v.ringCoin = S.coin; v.ringFinds = S.haul.length; v.bankedCoin = 0; v.bankedFinds = 0; }
        S.gate.ring += DT;
        v.rung = true;
        const due = Math.min(R.ringStrokes, floor(S.gate.ring / R.strokeSeconds + SLIVER));
        while (S.gate.strokes < due && S.phase === 'play') stroke(S, v, S.gate);
      } else if (S.gate.ring > 0) {
        S.gate.ring = 0;                           // driven out: what was banked stays
        S.gate.strokes = 0;
      }
      if (S.gate !== null && S.phase === 'play' && S.t >= S.gate.until && S.gate.ring === 0) {
        if (!S.gate.far && !v.rung && S.sheet && S.sheet.flags[PASS]) v.passed++;
        S.gate = null;
      }
    }
    const ringing = S.gate !== null && S.gate.ring > 0;
    if (ringing) rings.back = R.backSeconds;
    else if (rings.silent > 0) {
      rings.back -= DT;
      if (rings.back <= SLIVER) { rings.silent--; rings.back = R.backSeconds; }
    }
  }

  function stroke(S, v, g) {
    const R = S.rules, k = ++g.strokes, last = k >= R.ringStrokes;
    const wantCoin = last ? v.ringCoin : floor(v.ringCoin * k / R.ringStrokes + SLIVER);   // coin is banked whole
    let coin = wantCoin - v.bankedCoin;
    if (coin > S.coin) coin = S.coin;
    if (last) coin = S.coin;                       // the last stroke banks all that is carried
    if (coin < 0) coin = 0;
    S.coin -= coin;
    S.bank.coin += coin;
    v.bankedCoin += coin;
    const wantFinds = last ? S.haul.length + v.bankedFinds : ceil(v.ringFinds * k / R.ringStrokes);
    while (v.bankedFinds < wantFinds && S.haul.length > 0) {
      S.bank.finds.push(S.haul.shift());
      v.bankedFinds++;
      S.dirty = true;                              // the finds carried are a count of the sheet
    }
    const silent = ceil(k * voicesOf(S) / R.ringStrokes - SLIVER);
    if (silent > S.ringing.silent) S.ringing.silent = silent;
    Sim.emit(S, 'stroke', g.x, g.y, k, coin, null);
    if (last) Sim.end(S, 'left');
  }

  // ---- a toll ----

  function landmarksHeard(S, v, toll) {
    const p = S.player, r2 = LANDMARK_REACH * LANDMARK_REACH;
    for (let k = 0; k < v.landmarks; k++) if (Core.dist2(v.lx[k], v.ly[k], p.x, p.y) <= r2) v.marks |= 1 << k;
    let n = 0;
    for (let m = v.marks; m !== 0; m &= m - 1) n++;
    const gain = S.sheet ? S.sheet.stats['hum-gain'] / 100 : 1;
    if (toll > 0 && n > 0) S.hum += toll * n * gain;
  }

  function threatens(S, v) {
    const taken = S.favours[MUFFLE] || 0;
    if (v.double) { S.threat += 2; v.double = false; return 1; }
    if (taken > v.muffles) { v.muffles++; v.double = true; return 0; }
    S.threat += 1;
    return 0;
  }

  function fares(S, v) {
    if (!S.sheet || !S.sheet.flags[EYES] || !(S.favours[EYES] > 0)) return;
    if (S.coin >= v.fare) {
      S.coin -= v.fare;
      v.fare++;
      risePoint(S, EYES_FROM);
      open(S, v, spot.x, spot.y, EYES_OPEN, false);
    } else {
      S.favours[EYES] = 0;                         // the fare cannot be paid: the favour is lost
      S.dirty = true;
      v.noGate = NO_GATE + 1;                      // this toll and the next two
    }
  }

  function keeperRises(S, v, boost) {
    const z = S.zone, p = S.player;
    if (!z.boss || v.keeper !== 0) return;
    let x = v.postX, y = v.postY;
    const dx = x - p.x, dy = y - p.y, d = sqrt(dx * dx + dy * dy);
    if (d < KEEPER_NEAR) {                         // the player stands by the post: it rises beyond the player
      const nx = d > 1e-6 ? dx / d : 0, ny = d > 1e-6 ? dy / d : -1;
      x = p.x + nx * KEEPER_FROM;
      y = p.y + ny * KEEPER_FROM;
      spot.x = x; spot.y = y;
      keepInside(S, spot, EDGE + 1);
      x = spot.x; y = spot.y;
    }
    makeRoom(S);
    const e = rise(S, z.boss, x, y, Director.level(S) + boost, BOSS, null);
    if (e === null) return;
    S.boss = e;
    v.keeper = 1;
    v.keeperUid = e.uid;
  }

  // the zone's traits are those whose id begins with its own: one of them drawn
  function drawTrait(S) {
    const all = Defs.all('trait'), prefix = S.zone.id + '.';
    let n = 0;
    for (let i = 0; i < all.length; i++) if (all[i].id.startsWith(prefix)) n++;
    if (n === 0) return null;
    let k = floor(S.rng.spawn.next() * n);
    for (let i = 0; i < all.length; i++) if (all[i].id.startsWith(prefix) && k-- === 0) return all[i].id;
    return null;
  }

  // the elites and swarms of the interval after toll T, and the count
  function plan(S, v, T) {
    const z = S.zone, events = z.events, start = S.t, P = S.rules.tollSeconds;
    v.eliteN = 0; v.eliteI = 0; v.swarmN = 0; v.swarmI = 0;
    let elites = 0;
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      if (ev.toll !== T) continue;
      const count = ev.count > 0 ? ev.count : 1;
      if (ev.kind === 'elite') {
        for (let c = 0; c < count && v.eliteN < PLAN_MAX; c++) v.eliteEv[v.eliteN++] = i;
        elites += count;
      } else if (ev.kind === 'swarm' && v.swarmN < SWARM_MAX) {
        v.swarmAt[v.swarmN] = start + SURGE;
        v.swarmEv[v.swarmN++] = i;
      }
    }
    if (elites === 0 && T > S.rules.keeperToll && z.timeline.length > 0) {
      const over = S.rules.overElites >= 0 ? S.rules.overElites : 2;
      for (let c = 0; c < over && v.eliteN < PLAN_MAX; c++) v.eliteEv[v.eliteN++] = -1;
    }
    for (let k = 0; k < v.eliteN; k++) v.eliteAt[k] = start + P * (k + 1) / (v.eliteN + 1);
    count(S, v, T);
  }

  function count(S, v, T) {
    const z = S.zone, entry = entryAt(z, S.threat), p = S.player;
    if (z.timeline.length === 0) return;
    let large = 0, all = 0;
    for (let i = 0; entry && i < entry.pool.length; i++) {
      const w = entry.pool[i].w, def = Defs.get('enemy', entry.pool[i].enemy);
      all += w;
      if (def.size === 'large') large += w;
    }
    const share = all > 0 ? large / all : 0;
    v.tellers = share >= 0.5 ? 9 : share < 0.15 ? 3 : 6;
    v.elites = v.eliteN;
    const eyes = S.sheet && S.sheet.flags[EYES] && S.favours[EYES] > 0;
    v.gateSaid = v.noGate <= 1 && ((T + 1) % S.rules.gateEvery === 0 || !!eyes);
    Sim.emit(S, 'count', p.x, p.y, v.tellers, v.elites, v.gateSaid ? 'gate' : null);
  }

  function toll(S, v, T) {
    const boost = threatens(S, v);
    landmarksHeard(S, v, T);
    if (v.noGate > 0) v.noGate--;
    fares(S, v);
    if (T % S.rules.gateEvery === 0) tollGate(S, v);
    if (T === S.rules.keeperToll) keeperRises(S, v, boost);
    plan(S, v, T);
  }

  // ---- the dead rising ----

  function swarm(S, v, ev) {
    const n = ev.count > 0 ? ev.count : 1, shape = ev.shape || 'ring', id = ev.enemy, level = Director.level(S);
    const p = S.player, dist = S.rules.spawnRadius, rng = S.rng.spawn;
    if (!id) return;
    const a0 = rng.next() * TAU;
    for (let k = 0; k < n; k++) {
      let x, y;
      if (shape === 'column') {                    // a file walking in from one place, a body every 0.9 m
        x = p.x + cos(a0) * (dist + k * 0.9);
        y = p.y + sin(a0) * (dist + k * 0.9);
      } else {
        const a = shape === 'arc' ? a0 + (k / (n > 1 ? n - 1 : 1) - 0.5) * 1.75 : a0 + k * TAU / n;
        x = p.x + cos(a) * dist;
        y = p.y + sin(a) * dist;
      }
      spot.x = x; spot.y = y;
      keepInside(S, spot, EDGE);
      if (rise(S, id, spot.x, spot.y, level, COMMON, null) === null) return;
    }
  }

  function elite(S, v, k) {
    const z = S.zone, i = v.eliteEv[k], ev = i >= 0 ? z.events[i] : null, entry = entryAt(z, S.threat);
    let id = ev && ev.enemy ? ev.enemy : null;
    if (id === null) id = entry && entry.pool.length > 0 ? entry.pool[0].enemy : null;
    if (id === null) return;
    let traits = ev && ev.traits && ev.traits.length > 0 ? ev.traits : null;
    if (traits === null) {                         // none named: one of the zone's own
      const t = drawTrait(S);
      if (t !== null) { oneTrait[0] = t; traits = oneTrait; }
    }
    risePoint(S, S.rules.spawnRadius);
    makeRoom(S);
    rise(S, id, spot.x, spot.y, Director.level(S), ELITE, traits);
  }

  function spawning(S, v) {
    const z = S.zone, entry = entryAt(z, S.threat);
    if (entry === null || entry.pool.length === 0) return;
    const over = overOf(S), ot = z.overtoll;
    const rate = entry.rate * (over > 0 && ot ? pow(ot.rateMul, over) : 1);
    let cap = entry.cap + OVER_CAP * over;
    if (cap > S.enemies.cap) cap = S.enemies.cap;
    v.budget += rate * DT;
    if (v.budget > BUDGET_MOST) v.budget = BUDGET_MOST;
    const level = Director.level(S);
    for (let k = 0; k < PER_STEP; k++) {
      if (v.next === null) {
        const pick = S.rng.spawn.weighted(entry.pool, 'w');
        if (pick === undefined) return;            // nothing in the pool has weight
        v.next = pick.enemy;
      }
      const def = Defs.get('enemy', v.next), cost = def.cost > 0 ? def.cost : 1;
      if (v.budget < cost || S.enemies.n >= cap) return;
      risePoint(S, S.rules.spawnRadius);
      if (rise(S, v.next, spot.x, spot.y, level, COMMON, null) === null) return;
      v.budget -= cost;
      v.next = null;
    }
  }

  // the common dead that strayed too far are walked back to a new place of rising
  function relocate(S, v) {
    if (++v.relocate < RELOCATE_EVERY) return;
    v.relocate = 0;
    const p = S.player, items = S.enemies.items, far = S.rules.despawnRadius, f2 = far * far;
    for (let i = 0; i < S.enemies.n; i++) {
      const e = items[i];
      if (!e.alive || e.rank !== COMMON || Core.dist2(e.x, e.y, p.x, p.y) <= f2) continue;
      risePoint(S, S.rules.spawnRadius);
      e.x = e.px = spot.x;
      e.y = e.py = spot.y;
      e.condV[PROC] = 0;
      e.condN[PROC] = 0;
      e.state = 0;
      e.stateT = 0;
      World.pushOut(S, e);
    }
  }

  // ---- the step ----

  Director.step = function (S) {
    const v = S.vigil, z = S.zone;
    if (!v.known) learn(S, v);
    if (v.seen < 0) { v.seen = 0; plan(S, v, 0); }
    while (v.seen < S.toll) toll(S, v, ++v.seen);
    const own = z.districtRules;
    for (let i = 0; own && i < own.length; i++) if (rules[own[i]] !== undefined) rules[own[i]](S, v);
    if (S.phase !== 'play') return;
    spawning(S, v);
    while (v.eliteI < v.eliteN && v.eliteAt[v.eliteI] <= S.t + SLIVER) elite(S, v, v.eliteI++);
    while (v.swarmI < v.swarmN && v.swarmAt[v.swarmI] <= S.t + SLIVER) swarm(S, v, z.events[v.swarmEv[v.swarmI++]]);
    relocate(S, v);
    gates(S, v);
  };

  // ---- a kill ----

  Director.drop = function (S, kind, value, x, y) {
    if (!(value > 0)) return null;
    // the last RESERVE places of the pool are kept for the favours' shapes
    let o = S.pickups.n < S.pickups.cap - RESERVE ? S.pickups.alloc() : null;
    if (o === null) {                              // full: it joins the nearest of its kind
      const items = S.pickups.items;
      let best = null, d = Infinity;
      for (let i = 0; i < S.pickups.n; i++) {
        const q = items[i];
        if (!q.alive || q.kind !== kind) continue;
        const k = Core.dist2(q.x, q.y, x, y);
        if (k < d) { d = k; best = q; }
      }
      if (best !== null) { best.value += value; if (best.ttl < DROP_TTL) best.ttl = DROP_TTL; }
      return best;
    }
    o.kind = kind;
    o.value = value;
    o.x = o.px = x;
    o.y = o.py = y;
    o.r = DROP_R;
    o.ttl = DROP_TTL;
    o.item = null;
    Sim.emit(S, 'drop', x, y, kind, value, null);
    return o;
  };

  function mournRound(S, e) {
    const n = S.grid.query(e.x, e.y, MOURN_REACH, found);
    for (let i = 0; i < n; i++) {
      const o = found[i];
      if (o === e || !o.alive || o.rank !== COMMON || o.life <= 0 || o.condT[SEALED] > 0) continue;
      o.condT[MOURN] = MOURN_SECONDS;
      o.condV[MOURN] = MOURN_FULL;
      o.tx = e.x;
      o.ty = e.y;
      o.state = 0;
      o.stateT = 0;
      o.lifeSeen = o.life;                         // harm before it began does not rouse it
    }
  }

  Director.onKill = function (S, e) {
    const v = S.vigil, stats = S.sheet ? S.sheet.stats : null, flags = S.sheet ? S.sheet.flags : null, rng = S.rng.loot;
    const jx = (rng.next() - 0.5) * SCATTER, jy = (rng.next() - 0.5) * SCATTER;
    let xp = e.xp * (stats ? stats['xp-gain'] / 100 : 1);
    if (e.condN[PROC] === 1) xp *= PROC_XP;
    if (flags && flags[PASS] && v.passed > 0) xp *= 1 + PASS_XP * v.passed;
    Director.drop(S, EMBER, xp, e.x + jx, e.y + jy);
    const big = e.def.size === 'large';
    let coin = e.rank >= BOSS ? KEEPER_COIN : e.rank >= ELITE ? ELITE_COIN : rng.chance(big ? LARGE_COIN : SMALL_COIN) ? 1 : 0;
    if (coin > 0) {
      coin = round(coin * reward(S) * (stats ? stats['coin-find'] / 100 : 1));
      if (coin < 1) coin = 1;
      Director.drop(S, COIN, coin, e.x - jy, e.y + jx);
    }
    const riders = e.condN[CLUNG];                 // the riders it carried drop off as hangers-on
    if (riders > 0 && S.crowd && S.crowd.rider && Defs.has('enemy', S.crowd.rider)) {
      for (let k = 0; k < riders; k++) {
        const a = k * TAU / riders;
        rise(S, S.crowd.rider, e.x + cos(a) * (e.r + 0.4), e.y + sin(a) * (e.r + 0.4), e.level, COMMON, null);
      }
    }
    if (e.rank < ELITE) return;
    mournRound(S, e);
    open(S, v, e.x, e.y, S.rules.gateOpenSeconds, false);
    if (e === S.boss || e.uid === v.keeperUid) {
      v.keeper = 2;
      v.bell = true;
      const place = S.zone.ordinal > 0 ? S.zone.ordinal : 1;
      S.hum += KEEPER_HUM * place * (stats ? stats['hum-gain'] / 100 : 1);
    }
  };
})();
