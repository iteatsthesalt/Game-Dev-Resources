// 23-skills.js: voices speaking. Every voice of the loadout speaks by itself when its cooldown has run out, as its
// archetype and its target rule say; the Change-ringer's pull makes the first speak at once. The registry of
// archetypes, and what the archetypes share: finding the dead a voice aims at, striking every body a shape covers,
// and the areas a voice leaves on the ground (a Swell that fills before it lands, a Drag zone, the mark of a Blow).
// Owns: Skills
// Public:
//   Skills.archetype(name, {cast, step?})   registers an archetype and allows its name for voices
//                                (Defs.allow('archetype', name)). 24-archetypes.js registers ring, rap, bar, spark
//                                and cone.
//     cast(S, slot, forced) -> boolean   the voice in S.skills[slot] is ready: its cooldown has run out, its place
//                                is not silenced and the player is not Tolled-for. It strikes at once with
//                                Dmg.hitEnemy, or makes areas and shots (team 0, owner 0, skill = slot, a ttl in
//                                seconds), and returns true if it spoke (its cooldown becomes 1 / rate) or false if
//                                it found nothing (it is asked again next step). forced: the pull asks, and a voice
//                                that can speak with nothing in reach should (a ring round you rings).
//     step(S, thing, slot)       once a step for each live shot and area of team 0 whose skill is slot; the kernel
//                                removes it when its ttl runs out
//   Skills.step(S)               phase 6: casting, in place order, then the voices' shots and areas. A 'cast' event
//                                for each voice that spoke: x, y where it spoke (Skills.where, else the player);
//                                a = the slot; id = the voice id.
//   Skills.speak(S, slot, times) -> boolean   makes a voice speak now, cooldown or not (its cooldown runs on as
//                                it was); times above 1 are spoken AGAIN seconds apart (12 steps after the step of
//                                the one before; a call between steps belongs to the step that follows). False when the place is
//                                empty, silenced, or the player is Tolled-for, or the voice found nothing.
//   Skills.silenced(S, slot) -> boolean   the last S.ringing.silent voices of the loadout are silenced
//   Skills.AGAIN = 0.2           seconds between the strokes of a pull spoken twice
// For archetypes (and later voices' own):
//   Skills.kind(sheet) -> kind index      the kind of harm a voice deals (one, by the design), -1 for none
//   Skills.pick(S, rule, x, y, reach, count, out) -> n    up to count of the dead within reach of (x, y) by a
//                                target rule, into out: 'nearest', 'farthest', 'random' (S.rng.combat), 'densest'
//                                (most others within 2 m), 'aim' (the nearest within 30 degrees of the player's
//                                aim). Only bodies alive with life left.
//   Skills.point(S, slot, rule, reach, out) -> boolean    where a voice of that rule is aimed: out {x, y, body}.
//                                'self' the player; 'mark' the place the player last stood still 0.5 s (false
//                                until it has); 'aim' reach metres along the aim; the others the body they pick.
//   Skills.count(S, x, y, r) -> n          the dead with life left whose edge is within r of (x, y)
//   Skills.strike(S, slot, shape, part, lee, ox, oy) -> n   Dmg.hitEnemy on every dead body inside shape (anything
//                                with the fields Dmg.inside reads for a voice's area: x, y, r, angle, len, a3), but
//                                not one in lee from (shape.x, shape.y) when lee is true; (ox, oy) is where the harm
//                                comes from. Returns how many were struck.
//   Skills.circle(S, slot, x, y, r, part, lee, ox, oy), Skills.wedge(S, slot, x, y, len, aim, open, part, lee),
//   Skills.lane(S, slot, x, y, aim, len, half, part, lee)   strike over a circle, a wedge (open: its opening,
//                                radians) and a lane (half: its half-width) -> n
//   Skills.area(S, slot, state, x, y, r, seconds) -> area | null   a voice's area: team 0, owner 0, skill = slot,
//                                state, ttl = seconds, t = 0, a1 = 1; def = the attack of the voice's own id when
//                                content gives one (the shape the scene draws: kind, shape, angle), else null
//   Skills.areaStep(S, area, slot)  t runs on, and a filling Swell lands on its last step: every dead body inside
//                                its shape is struck with part = a1, a spreading one (a0 = 1) sparing those in lee
//   Skills.strokes(S, n) -> seconds   the ttl of a Drag zone made now that is to tick exactly n times
//   Skills.find(S, uid, x, y) -> body | null   one of the dead by uid, looked for near (x, y) first
//   Skills.where(x, y)           where the voice that is speaking speaks, for its 'cast' event
//   Skills.FILL = 0, ZONE = 1, MARK = 2, LANDED = 3     the states of a voice's area: a Swell filling (t / (t + ttl)
//                                full; a0 = 1 spreading from x, y, 0 falling on x, y), a Drag zone (tick = the share
//                                of the voice's harm a second each Drag tick deals), the mark of a Blow that has
//                                landed (drawn for its ttl), a Swell that has landed
//   Skills.TICK = 0.25           a Drag zone deals a quarter of its harm a second on each tick
//   Skills.LEE = 3               the dead's lee-reach against a voice's spreading Swell
//
// The target rule 'mark' is added to the voices' words here: the place where the player last stood still for
// 0.5 s or more, which moves only at the next such stop (Plumb's). Its slot: S.voices = {pend, pendAt, lastHit,
// marked, stop, markX, markY, markT}: the strokes of a pull still to come and the step the next is due, by place;
// the last hit each voice landed (Dmg.hitEnemy writes it; coils spend it); and the mark.
(function () {
  'use strict';

  const DT = Core.DT, HZ = Core.HZ, PI = Math.PI;
  const atan2 = Math.atan2, cos = Math.cos, sin = Math.sin, abs = Math.abs, floor = Math.floor;
  const SLIVER = 1e-9;
  const PLACES = 6, AGAIN = 0.2, AGAIN_STEPS = Math.round(AGAIN * HZ), TICK = 0.25, LEE = 3;
  const FILL = 0, ZONE = 1, MARK = 2, LANDED = 3;
  const MARK_STILL = 0.5;        // seconds still that set the mark
  const DENSE = 2, AIM_CONE = PI / 6, SLACK = 0.5;   // metres; radians; metres added to grid queries
  const TICK_STEPS = 15;         // Sim.step calls Dmg.tick on the steps where S.step % 15 is 14
  const REPRIEVE = Stats.RULE.reprieve;

  const archetypes = Object.create(null);
  const forPick = new Array(1024).fill(null), forStrike = new Array(1024).fill(null), forDense = new Array(1024).fill(null);
  const dist = new Float64Array(1024), score = new Float64Array(1024);
  const SHAPE = { team: 0, def: null, x: 0, y: 0, r: 0, angle: 0, len: 0, a3: 0 };
  let whereX = 0, whereY = 0, whereSet = false;

  Defs.allow('target', 'mark');

  Sim.state('voices', function () {
    return {
      pend: new Float64Array(PLACES), pendAt: new Float64Array(PLACES), lastHit: new Float64Array(PLACES),
      marked: false, stop: false, markX: 0, markY: 0, markT: 0,
    };
  });

  Skills.FILL = FILL; Skills.ZONE = ZONE; Skills.MARK = MARK; Skills.LANDED = LANDED;
  Skills.TICK = TICK; Skills.LEE = LEE; Skills.AGAIN = AGAIN;

  Skills.archetype = function (name, spec) {
    Core.assert(typeof name === 'string' && spec && typeof spec.cast === 'function', 'Skills.archetype needs a name and {cast, step?}');
    Defs.allow('archetype', name);
    archetypes[name] = spec;
  };

  Skills.where = function (x, y) { whereX = x; whereY = y; whereSet = true; };

  Skills.kind = function (ss) {
    for (let t = 0; t < Stats.TYPES.length; t++) if ((ss.kinds >>> t) & 1) return t;
    return -1;
  };

  // ---- whether a voice may speak ----

  Skills.silenced = function (S, slot) {
    const r = S.ringing;
    if (!r || !(r.silent > 0)) return false;
    let after = 0;                                 // voices after this one in the loadout
    for (let i = S.skills.length - 1; i > slot; i--) if (S.skills[i].inst !== null) after++;
    return after < r.silent;
  };

  function quiet(S, slot) {
    const sk = S.skills[slot];
    return !sk || sk.inst === null || !sk.sheet || !(sk.sheet.rate > 0) || !S.player.alive ||
      S.player.condT[REPRIEVE] > 0 || Skills.silenced(S, slot);
  }

  function say(S, slot, forced) {
    const sk = S.skills[slot], arch = archetypes[sk.sheet.def.archetype];
    if (arch === undefined) return false;
    whereSet = false;
    if (!arch.cast(S, slot, forced)) return false;
    const p = S.player;
    Sim.emit(S, 'cast', whereSet ? whereX : p.x, whereSet ? whereY : p.y, slot, 0, sk.inst.id);
    return true;
  }

  Skills.speak = function (S, slot, times) {
    if (quiet(S, slot) || S.phase === 'ended' || !say(S, slot, true)) return false;
    const v = S.voices, more = floor(times) - 1;
    if (more > 0 && v && slot < PLACES) { v.pend[slot] += more; v.pendAt[slot] = S.step + AGAIN_STEPS; }
    return true;
  };

  // the mark: where the player last stood still MARK_STILL seconds; it moves only at the next such stop
  function mark(S, p, v) {
    if (p.stillT >= MARK_STILL - SLIVER) {
      if (!v.stop) { v.stop = true; v.marked = true; v.markX = p.x; v.markY = p.y; v.markT = S.t; }
    } else v.stop = false;
  }

  function things(S, pool) {
    const items = pool.items;
    for (let i = 0; i < pool.n; i++) {
      const o = items[i];
      if (!o.alive || o.team !== 0 || o.skill < 0) continue;
      const sk = S.skills[o.skill];
      if (!sk || !sk.sheet) { pool.kill(o); continue; }       // its voice has left the loadout
      const arch = archetypes[sk.sheet.def.archetype];
      if (arch !== undefined && typeof arch.step === 'function') arch.step(S, o, o.skill);
    }
  }

  Skills.step = function (S) {
    const p = S.player, skills = S.skills, v = S.voices;
    if (v && p.alive) mark(S, p, v);
    for (let i = 0; i < skills.length; i++) {
      const sk = skills[i];
      if (sk.inst === null || !sk.sheet) continue;
      if (sk.cd > 0) sk.cd = sk.cd > DT + SLIVER ? sk.cd - DT : 0;     // what sixtieths leave over is no wait
      if (S.phase === 'ended') continue;
      if (quiet(S, i)) { if (v && i < PLACES) v.pend[i] = 0; continue; }
      if (v && i < PLACES && v.pend[i] > 0 && S.step >= v.pendAt[i]) {
        v.pend[i]--;
        v.pendAt[i] = S.step + AGAIN_STEPS;
        say(S, i, true);
      }
      if (sk.cd <= 0 && say(S, i, false)) sk.cd = 1 / sk.sheet.rate;
    }
    things(S, S.shots);
    things(S, S.areas);
  };

  // ---- finding the dead ----

  // the dead with life left whose edge is within reach of (x, y), into forPick, with their squared distances
  function gather(S, x, y, reach) {
    const n = S.grid.query(x, y, reach + SLACK, forPick);
    let m = 0;
    for (let i = 0; i < n; i++) {
      const e = forPick[i];
      if (!e.alive || !(e.life > 0)) continue;
      const dx = e.x - x, dy = e.y - y, d2 = dx * dx + dy * dy, r = reach + e.r;
      if (d2 > r * r) continue;
      forPick[m] = e;
      dist[m] = d2;
      m++;
    }
    return m;
  }

  // moves the best of [k, m) by key (smallest first, or largest with sign -1) to k
  function bring(k, m, key, sign) {
    let best = k;
    for (let j = k + 1; j < m; j++) if (sign * key[j] < sign * key[best] || (key[j] === key[best] && dist[j] < dist[best])) best = j;
    if (best !== k) {
      const e = forPick[k]; forPick[k] = forPick[best]; forPick[best] = e;
      let t = dist[k]; dist[k] = dist[best]; dist[best] = t;
      if (key !== dist) { t = key[k]; key[k] = key[best]; key[best] = t; }
    }
  }

  Skills.pick = function (S, rule, x, y, reach, count, out) {
    let m = gather(S, x, y, reach);
    if (m === 0 || !(count > 0)) return 0;
    if (rule === 'aim') {                          // only those near the line of the aim
      const p = S.player, aim = atan2(p.aimY, p.aimX);
      let k = 0;
      for (let i = 0; i < m; i++) {
        const e = forPick[i];
        if (abs(Core.angleDiff(aim, atan2(e.y - y, e.x - x))) > AIM_CONE) continue;
        forPick[k] = e; dist[k] = dist[i]; k++;
      }
      m = k;
    }
    const n = count < m ? count : m;
    if (rule === 'random') {
      const rng = S.rng.combat;
      for (let k = 0; k < n; k++) {
        const j = k + floor(rng.next() * (m - k));
        const e = forPick[k]; forPick[k] = forPick[j]; forPick[j] = e;
        out[k] = forPick[k];
      }
      return n;
    }
    if (rule === 'densest') {
      for (let i = 0; i < m; i++) {
        const c = S.grid.near(forPick[i], DENSE, forDense);
        let around = 0;
        for (let j = 0; j < c; j++) if (forDense[j] !== forPick[i] && forDense[j].alive && forDense[j].life > 0) around++;
        score[i] = around;
      }
      for (let k = 0; k < n; k++) { bring(k, m, score, -1); out[k] = forPick[k]; }
      return n;
    }
    const sign = rule === 'farthest' ? -1 : 1;     // nearest, and aim, by distance
    for (let k = 0; k < n; k++) { bring(k, m, dist, sign); out[k] = forPick[k]; }
    return n;
  };

  const one = [null];
  Skills.point = function (S, slot, rule, reach, out) {
    const p = S.player;
    out.body = null;
    if (rule === 'self') { out.x = p.x; out.y = p.y; return true; }
    if (rule === 'mark') {
      const v = S.voices;
      if (!v || !v.marked) return false;
      out.x = v.markX; out.y = v.markY;
      return true;
    }
    if (rule === 'aim' && !(reach > 0)) { out.x = p.x; out.y = p.y; return true; }
    if (Skills.pick(S, rule, p.x, p.y, reach, 1, one) === 0) {
      if (rule !== 'aim') return false;
      out.x = p.x + p.aimX * reach; out.y = p.y + p.aimY * reach;
      return true;
    }
    out.body = one[0];
    out.x = one[0].x; out.y = one[0].y;
    one[0] = null;
    return true;
  };

  Skills.count = function (S, x, y, r) { return gather(S, x, y, r); };

  Skills.find = function (S, uid, x, y) {
    const n = S.grid.query(x, y, 3, forStrike);
    for (let i = 0; i < n; i++) if (forStrike[i].uid === uid && forStrike[i].alive) return forStrike[i];
    const items = S.enemies.items;
    for (let i = 0; i < S.enemies.n; i++) if (items[i].uid === uid && items[i].alive) return items[i];
    return null;
  };

  // ---- striking what a shape covers ----

  Skills.strike = function (S, slot, shape, part, lee, ox, oy) {
    let cx = shape.x, cy = shape.y, reach = shape.r;
    if (shape.len > 0) {                           // a lane: round its middle
      const half = shape.len / 2;
      cx += cos(shape.angle) * half;
      cy += sin(shape.angle) * half;
      reach = half + shape.r;
    }
    const n = S.grid.query(cx, cy, reach + SLACK, forStrike);
    let k = 0;
    for (let i = 0; i < n; i++) {
      const e = forStrike[i];
      if (!e.alive || !(e.life > 0) || !Dmg.inside(shape, e.x, e.y, e.r)) continue;
      if (lee && Dmg.inLee(S, shape.x, shape.y, e, LEE)) continue;
      Dmg.hitEnemy(S, slot, e, part, ox, oy);
      k++;
    }
    return k;
  };

  function shapeAt(x, y, r, angle, len, open) {
    SHAPE.x = x; SHAPE.y = y; SHAPE.r = r; SHAPE.angle = angle; SHAPE.len = len; SHAPE.a3 = open;
    return SHAPE;
  }

  Skills.circle = function (S, slot, x, y, r, part, lee, ox, oy) {
    return Skills.strike(S, slot, shapeAt(x, y, r, 0, 0, 0), part, lee, ox === undefined ? x : ox, oy === undefined ? y : oy);
  };
  Skills.wedge = function (S, slot, x, y, len, aim, open, part, lee) {
    return Skills.strike(S, slot, shapeAt(x, y, len, aim, 0, open), part, lee, x, y);
  };
  Skills.lane = function (S, slot, x, y, aim, len, half, part, lee) {
    return Skills.strike(S, slot, shapeAt(x, y, half, aim, len, 0), part, lee, x, y);
  };

  // ---- the areas a voice leaves ----

  Skills.area = function (S, slot, state, x, y, r, seconds) {
    const a = S.areas.alloc();
    if (a === null) return null;
    const id = S.skills[slot].inst.id;
    a.def = Defs.has('attack', id) ? Defs.get('attack', id) : null;
    a.team = 0;
    a.owner = 0;
    a.skill = slot;
    a.state = state;
    a.x = x;
    a.y = y;
    a.r = r;
    a.ttl = seconds;
    a.a1 = 1;
    return a;
  };

  Skills.areaStep = function (S, a, slot) {
    a.t += DT;
    if (a.state !== FILL || a.ttl > DT + SLIVER) return;
    a.state = LANDED;
    Skills.strike(S, slot, a, a.a1 > 0 ? a.a1 : 1, a.a0 === 1, a.x, a.y);
  };

  Skills.strokes = function (S, n) {
    const first = (TICK_STEPS - 1 - S.step % TICK_STEPS + TICK_STEPS) % TICK_STEPS;
    return (first + TICK_STEPS * ((n > 1 ? floor(n) : 1) - 1) + 1) / HZ;
  };
})();
