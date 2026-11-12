// 22-enemies.js: how the dead move and strike. The wake and its cells; the behaviours of the dead, named by an enemy
// def's ai; their steering with the capped separation, and their bodies against the player's; the rules In
// Procession, mourning and riders; their attacks: Blows wound up with a locked aim, Swells drawn on the ground as
// areas that fill and land; and the Dial's shadow on their speed and on the warning of a Swell.
// Owns: AI, Enemies
// Public:
//   AI.register(name, fn(S, e))      a behaviour of the dead, named by an enemy def's ai (it calls Defs.allow('ai',
//                                    name), so only while files load). fn sets e.vx, e.vy (steering only) and e.face
//                                    and runs the body's attacks, most often with the two helpers below. Registered
//                                    here: 'wake' (the common dead steer at the place the player stood wake-lag ago,
//                                    so they walk the player's path as a train; an elite or greater steers at the
//                                    player) and 'chase' (steer at the player; aiParams.keep: the distance it holds)
//   AI.has(name) -> boolean
//   AI.steer(S, e, x, y, stop)       steering toward (x, y) at e.pace, easing in over the last metre, standing at
//                                    stop metres. A body winding up or striking stands, facing its locked aim.
//   AI.strike(S, e)                  runs the body's attacks: their cooldowns, the choice of one in range, its wind-up
//                                    and its landing (see "Attacks" below)
//   Enemies.step(S)                  phase 4: notes the wake (every 0.1 s), works out the shared point of the wake,
//                                    runs the rules and the behaviour of every one of the dead, moves them with the
//                                    capped separation, keeps their bodies and the player's apart, keeps them out of
//                                    colliders (World.pushOut), moves riders, and lands the Swells of team 1
//   Enemies.wakeAt(S, seconds, out) -> out    {x, y}: where the player stood that many seconds ago, from S.wake
//                                    (between two places noted, or between the newest and where the player stands).
//                                    Exact during a step, as the dead read it; between two steps (the player has
//                                    moved for the coming step's time already counted) it is one step more recent.
//   Enemies.fill(S, e, attack, x, y) -> seconds   how long a Swell of e's aimed at the player fills when it is first
//                                    shown at (x, y): its windup, plus Dmg.warning(S, e, attack.id) (Heed, warn, a
//                                    Sounded body, the Register), less the district's rule
//                                    there (the Dial's shadow: 0.3 s), never under 0.3 s
//   Enemies.swell(S, e, attack, x, y, angle, scale, fill) -> area | null   shows a Swell of the dead: an area of
//                                    S.areas with team 1 (see "Swells" below) and a 'telegraph' event. null when
//                                    the areas are full. 25-boss.js makes the keeper's Swells with it.
//   Enemies.shaded(S, x, y) -> boolean    the point lies in the district's shade (S.vigil.shade, kept by
//                                    26-director.js: the Dial's shadow)
//
// Its slots and fields:
//   S.wake = {n, head, x, y, t, count, cells, side, ox, oy}: the player's places, noted every 0.1 s (steps with
//     S.step % 6 === 0) into a ring of 120 (12 s, the most wake-length allows): newest at head, older at head - 1
//     and so on round the ring; count of them written, n of them the wake (wake-length x 10 at most), t the time the
//     newest was noted. cells: the 1 m grid of wake cells over the region, side cells a side from (ox, oy), each
//     holding S.t when the player last stood within a cell of it (the cell and the eight round it are stamped).
//   S.crowd = {climb, rider}: seconds the player has stood still toward the next hanger-on climbing on, and the id of
//     the enemy def the riders came from (they drop off as that when the large body they ride falls)
//   enemy fields: attack (-1, or the index in def.attacks of the attack winding up or striking), pace (its speed this
//     step: top speed with its rules), lifeSeen (its life at the end of the last Enemies.step, to tell a harm)
//
// Attacks. state 1 is a wind-up (stateT the seconds into it, a1 its length, a0 the aim locked when it began) and
// state 2 a strike (0.35 s: Scene.ATTACK). Cooldowns cd0..cd3 belong to def.attacks[0..3]; a body's first step
// sets each to a share of its attack's cooldown, so a crowd does not strike in step. A body chooses the first
// attack whose cooldown has run out and whose range holds; its cooldown restarts then.
//   strike (a Blow)    begins when the player's edge is within range of the body's; at the end of its wind-up it
//                      lands through Dmg.hitPlayer(S, attack, e, 1, windup) if the player stands in its shape: an
//                      'arc' (range and the full opening angle about the locked aim), a 'circle' (radius round the
//                      body) or a 'line' (range long, radius each side). Sounded: its wind-up is 0.3 s longer.
//   press with ailment 'clung' (a hanger-on's leap)   at the end of its wind-up, a player still within range is
//                      climbed onto: one more rider (the row clung), and the hanger-on leaves the pool
//   spread, fall (a Swell)   shown at once with Enemies.swell; the body gestures for 0.4 s
//   throw, zone        not used by the Dial; a body never begins one
// Coiled: every coil makes its cooldowns run 12% slower. Mourning: none while in full mourning, half as often in
// half mourning, 30% faster roused.
//
// Swells. An area of team 1: x, y its source (spreading) or centre (falling); r how far it reaches (a lane: half its
// width); angle its aim; len a lane's length, else 0; def the Attack (shape: 'circle' falling; 'ring', 'wedge' with
// the def's angle as its opening, or 'line' spreading); damage its whole harm: the damage of the body that made it x
// the attack's mult x scale (the keeper's echo: 0.3), as Dmg.hitPlayer(S, def, area, 1, seen) takes it; t the seconds since it was
// first shown, ttl the seconds until it lands (it is t / (t + ttl) full); a0 the whole fill as it was shown (the
// depth of the wound it opens); owner the uid of its maker; state 2 once it has landed. It lands in the Enemies.step
// of the step whose deaths phase removes it, on the player if the player's centre is within its shape (grown by half
// the player's radius) and, for a spreading Swell, not in lee (Dmg.inLee within the player's lee-reach). A falling
// Swell has no lee.
//
// The rules (rows of Stats.AILMENTS by their behaviour's id):
//   procession (in-procession)   checked for a sixth of the bodies each step (uid % 6 === S.step % 6): a common body
//     whose wake cell was stamped within wake-length seconds, not touching the player, builds V by 0.1 s a check; at 5
//     it is In Procession (N 1): 15% faster. It ends when it touches the player, or when none of the nine wake cells
//     round it was stamped within wake-length (it strayed). A shove ends it too (Dmg.shove). Elites and keepers never.
//   mourning   laid by 26-director.js round a fallen elite or keeper (T 12, V 2, tx, ty where it fell). V 2 (full,
//     while T > 6): it stands facing (tx, ty) and does not strike; harmed then it is roused (V 3, T 6): 30% faster
//     strikes; V 1 (half, from T 6): half speed, half as many strikes. Mourners stand, so Dmg.step braces them.
//   riders (clung)   a hanger-on's leap, or while the player stands still one hanger-on within 3 m every 2 s, climbs on:
//     N + 1 (at most 5), V the mean Drag a second of the riders (the hanger-on's damage x its leap's mult). A body
//     carrying riders is 8% slower for each. While the player Strides within 0.8 m of a large body (edge to edge),
//     every rider moves onto it. Dmg.tick deals the riders' Drag.
// It reads coined (it walks straight on its heading, V, turning a quarter at props, and does not strike; its coins
// drop through Director.drop as its time runs out), moored, filed and burgess (each stands where it is; the filed and
// the burgess do not strike) for movement, sealed (no rule starts or ends a condition on it), sounded and coiled.
//
// Bodies. Each body keeps the capped separation: the overlaps with up to 6 neighbours, shared by weight (small 1,
// large 3, a keeper 12), and at most 0.04 m a step. The player's body and the dead's are kept apart: a Braced player
// is planted and the dead give way entirely; otherwise the player gives way a share of each overlap (by the same
// weights, three quarters of a fair share), at most 0.025 m a step in all, so a crowd slows a player walking into it
// and cannot carry one off. The district's shade (the Dial's shadow)
// makes the dead within it shade.speed times as fast. Knockback (kx, ky) moves a body and fades.
(function () {
  'use strict';

  const DT = Core.DT, TAU = Core.TAU, PI = Math.PI, SLIVER = 1e-9;
  const sqrt = Math.sqrt, cos = Math.cos, sin = Math.sin, atan2 = Math.atan2, floor = Math.floor, abs = Math.abs, round = Math.round;
  const COMMON = 0, ELITE = 1, BOSS = 3;               // Sim's ranks; Sim has not run when this file loads

  // rows of Stats.AILMENTS: the rules this file runs, and what it reads
  const PROC = Stats.RULE.procession, MOURN = Stats.RULE.mourning, CLUNG = Stats.RULE.riders;
  const COINED = Stats.AILMENT.coined, MOORED = Stats.AILMENT.moored, FILED = Stats.AILMENT.filed;
  const BURGESS = Stats.AILMENT.burgess, SEALED = Stats.AILMENT.sealed, SOUNDED = Stats.AILMENT.sounded;
  const COILED = Stats.AILMENT.coiled;
  const RIDERS = Stats.AILMENTS[CLUNG].stacks;         // 5

  // the wake
  const WAKE_MAX = 120, WAKE_EVERY = 6, CELL = 1, CELL_MARGIN = 4;   // places, steps, metres, metres round the region
  const NEVER = -1e9;
  // procession
  const PROC_TIME = 5, PROC_SPEED = 1.15, TOUCH = 0.1;               // seconds, times, metres between edges
  // mourning: V's grades
  const FULL = 2, HALF = 1, ROUSED = 3, HALF_FROM = 6, ROUSED_FOR = 6;
  // riders
  const CLIMB_REACH = 3, CLIMB_EVERY = 2, PASS_REACH = 0.8, RIDER_SLOW = 0.08;
  // attacks
  const WINDUP = 1, STRIKING = 2, STRIKE_SECONDS = 0.35, GESTURE = 0.4;   // states as Scene.ATTACK has them
  const SOUNDED_EARLY = 0.3, COIL_SLOW = 0.12, HALF_RATE = 0.5, ROUSED_RATE = 1.3, FILL_LEAST = 0.3;
  const LANDED = 2;
  // bodies
  const EASE = 1, TURN = 8;                            // metres of easing in; radians a second a body turns
  const SEP_N = 6, SEP_MARGIN = 0.15, SEP_CAP = 0.04, PUSH_CAP = 0.025, GIVE = 0.75;
  const KNOCK_FADE = 0.88;
  const NEAR_MAX = 1024;                               // room for any query: more than the enemies' cap

  // ---- the registry of behaviours ----

  const behaviours = Object.create(null);

  AI.register = function (name, fn) {
    Core.assert(typeof name === 'string' && name !== '' && typeof fn === 'function', 'AI.register needs a name and a function (S, e)');
    Core.assert(behaviours[name] === undefined, 'AI.register: there are two behaviours named "' + name + '"');
    behaviours[name] = fn;
    Defs.allow('ai', name);
  };

  AI.has = function (name) { return behaviours[name] !== undefined; };

  // ---- slots and fields ----

  Sim.field('enemy', 'attack', -1);
  Sim.field('enemy', 'pace', 0);
  Sim.field('enemy', 'lifeSeen', 0);

  Sim.state('wake', function (S) {
    const rg = S.region, R = (rg ? rg.radius : 60) + CELL_MARGIN, side = Math.ceil(2 * R / CELL);
    const cells = new Float64Array(side * side);
    cells.fill(NEVER);
    return {
      n: 0, head: WAKE_MAX - 1, x: new Float64Array(WAKE_MAX), y: new Float64Array(WAKE_MAX), t: 0, count: 0,
      cells, side, ox: (rg ? rg.x : 0) - R, oy: (rg ? rg.y : 0) - R,
    };
  });

  Sim.state('crowd', function () { return { climb: 0, rider: null }; });

  // ---- what each def's attacks are, looked up once ----
  // A def's attacks may be ids of attack defs or attacks written inline. Defs are frozen, so the list made for a def is
  // the same in every run and every copy of a run: a cache of it carries nothing from one run to another.

  const resolved = new Map(), clingers = new Map();

  function attacksOf(def) {
    let list = resolved.get(def);
    if (list === undefined) {
      list = def.attacks.slice(0, 4).map((a) => (typeof a === 'string' ? Defs.get('attack', a) : a));
      resolved.set(def, list);
    }
    return list;
  }

  // the index of the attack with which a def climbs onto a body (a press that lays clung), or -1
  function clingerOf(def) {
    let k = clingers.get(def);
    if (k === undefined) {
      const list = attacksOf(def);
      k = -1;
      for (let i = 0; i < list.length && k < 0; i++) if (list[i].ailment === 'clung') k = i;
      clingers.set(def, k);
    }
    return k;
  }

  function cdOf(e, i) { return i === 0 ? e.cd0 : i === 1 ? e.cd1 : i === 2 ? e.cd2 : e.cd3; }
  function setCd(e, i, v) {
    if (i === 0) e.cd0 = v; else if (i === 1) e.cd1 = v; else if (i === 2) e.cd2 = v; else e.cd3 = v;
  }

  // ---- small tests ----

  function large(e) {
    return typeof Dmg.large === 'function' ? Dmg.large(e) : e.def.size === 'large' || e.rank >= ELITE;
  }
  function weight(S, e) { return e === S.boss || e.rank >= BOSS ? 12 : large(e) ? 3 : 1; }
  function poseOf(p, name) { return typeof Dmg.POSE === 'object' && Dmg.POSE !== null ? p.pose === Dmg.POSE[name] : false; }
  function topSpeed(S) { return S.sheet ? S.sheet.stats['move-speed'] : 4.5; }
  function standing(S, p) {
    if (typeof Dmg.POSE === 'object' && Dmg.POSE !== null && typeof p.pose === 'number') return p.pose === Dmg.POSE.still || p.pose === Dmg.POSE.braced;
    return p.vx * p.vx + p.vy * p.vy < 0.0225 * topSpeed(S) * topSpeed(S);
  }
  function striding(S, p) {
    if (typeof Dmg.POSE === 'object' && Dmg.POSE !== null && typeof p.pose === 'number') return p.pose === Dmg.POSE.striding;
    return p.vx * p.vx + p.vy * p.vy >= 0.49 * topSpeed(S) * topSpeed(S);
  }

  Enemies.shaded = function (S, x, y) {
    const sh = S.vigil ? S.vigil.shade : null;
    if (!sh || !sh.on) return false;
    const dx = x - sh.x, dy = y - sh.y;
    if (dx * dx + dy * dy > sh.reach * sh.reach) return false;
    return Core.mod(atan2(dy, dx) - sh.from, TAU) <= sh.span;
  };

  // Enemies.shaded for one of the dead, whose shade sh is on: the same test, but it takes the body, not its
  // coordinates, since a number handed across a call the engine does not inline is boxed, garbage in the loop over
  // the dead. (Only bodies of the dead come here, so the engine sees one shape of object.)
  function inShade(sh, e) {
    const dx = e.x - sh.x, dy = e.y - sh.y;
    if (dx * dx + dy * dy > sh.reach * sh.reach) return false;
    const a = atan2(dy, dx) - sh.from;
    return ((a % TAU) + TAU) % TAU <= sh.span;    // Core.mod(a, TAU), written out
  }

  // ---- the wake ----

  function noteWake(S, p, length) {
    const w = S.wake, head = w.head + 1 === WAKE_MAX ? 0 : w.head + 1;
    w.x[head] = p.x;
    w.y[head] = p.y;
    w.head = head;
    w.t = S.t;
    if (w.count < WAKE_MAX) w.count++;
    const hold = round(length * 10);
    w.n = w.count < hold ? w.count : hold;
    const side = w.side, cx = floor((p.x - w.ox) / CELL), cy = floor((p.y - w.oy) / CELL);
    for (let gy = cy - 1; gy <= cy + 1; gy++) {
      if (gy < 0 || gy >= side) continue;
      for (let gx = cx - 1; gx <= cx + 1; gx++) if (gx >= 0 && gx < side) w.cells[gy * side + gx] = S.t;
    }
  }

  Enemies.wakeAt = function (S, seconds, out) {
    const w = S.wake, p = S.player, lag = seconds > 0 ? seconds : 0;
    if (!w || w.count === 0) { out.x = p.x; out.y = p.y; return out; }
    const since = S.t - w.t;                       // seconds from the newest place noted to now
    if (lag <= since) {
      const f = since > 0 ? lag / since : 0;
      out.x = p.x + (w.x[w.head] - p.x) * f;
      out.y = p.y + (w.y[w.head] - p.y) * f;
      return out;
    }
    let k = (lag - since) * 10;                    // places back from the newest
    const most = w.count - 1;
    if (k > most) k = most;
    const i = floor(k), f = k - i, a = (w.head - i + WAKE_MAX) % WAKE_MAX;
    if (i >= most) { out.x = w.x[a]; out.y = w.y[a]; return out; }
    const b = a === 0 ? WAKE_MAX - 1 : a - 1;
    out.x = w.x[a] + (w.x[b] - w.x[a]) * f;
    out.y = w.y[a] + (w.y[b] - w.y[a]) * f;
    return out;
  };

  // Was a wake cell within ring cells of the body's own stamped at or after since?
  function nearWake(w, e, since, ring) {
    const side = w.side, cx = floor((e.x - w.ox) / CELL), cy = floor((e.y - w.oy) / CELL), cells = w.cells;
    for (let gy = cy - ring; gy <= cy + ring; gy++) {
      if (gy < 0 || gy >= side) continue;
      for (let gx = cx - ring; gx <= cx + ring; gx++) if (gx >= 0 && gx < side && cells[gy * side + gx] >= since) return true;
    }
    return false;
  }

  // ---- the rules ----

  function procession(S, e, p, since) {
    if (e.rank >= ELITE || e.condT[SEALED] > 0) return;      // the row spares elites and keepers
    const dx = e.x - p.x, dy = e.y - p.y, touch = e.r + p.r + TOUCH, touching = dx * dx + dy * dy <= touch * touch;
    const V = e.condV, N = e.condN;
    if (N[PROC] === 1) {
      if (touching || !nearWake(S.wake, e, since, 1)) { N[PROC] = 0; V[PROC] = 0; }
    } else if (!touching && nearWake(S.wake, e, since, 0)) {
      V[PROC] += DT * WAKE_EVERY;
      if (V[PROC] >= PROC_TIME - SLIVER) { V[PROC] = PROC_TIME; N[PROC] = 1; }
    } else V[PROC] = 0;
  }

  // grade of mourning now, after its turns: 0 none
  function mourning(e) {
    const T = e.condT, V = e.condV;
    if (!(T[MOURN] > 0)) { if (V[MOURN] !== 0) V[MOURN] = 0; return 0; }
    if (T[SEALED] > 0) return V[MOURN];
    if (V[MOURN] === FULL) {
      if (e.life < e.lifeSeen) { V[MOURN] = ROUSED; T[MOURN] = ROUSED_FOR; }
      else if (T[MOURN] <= HALF_FROM) V[MOURN] = HALF;
    }
    return V[MOURN];
  }

  // a hanger-on climbs onto the player; false when the player can carry no more
  function climbOn(S, e, attack) {
    const p = S.player, n = p.condN[CLUNG];
    if (n >= RIDERS || p.condT[SEALED] > 0) return false;
    const drag = e.damage * (attack ? attack.mult : 1);
    p.condV[CLUNG] = (p.condV[CLUNG] * n + drag) / (n + 1);
    p.condN[CLUNG] = n + 1;
    S.crowd.rider = e.def.id;
    S.enemies.kill(e);
    return true;
  }

  // sets the body's pace for this step (it writes the field rather than return the number, which would be boxed)
  function setPace(S, e, gate, grade) {
    if (grade === FULL) { e.pace = 0; return; }
    let v = e.speed * gate;
    if (grade === HALF) v *= 0.5;
    if (e.condN[PROC] === 1) v *= PROC_SPEED;
    const sh = S.vigil ? S.vigil.shade : null;
    if (sh && sh.on && inShade(sh, e)) v *= sh.speed;
    const hop = e.def.aiParams.hop;
    if (hop > 0) {                                 // quick hops: fast on the way up, slow on the way down
      const s = sin(TAU * (e.t / hop + (e.uid % 7) / 7));
      v *= 0.2 + 2.5 * (s > 0 ? s : 0);
    }
    const riders = e.condN[CLUNG];
    if (riders > 0) v *= 1 - RIDER_SLOW * riders;
    e.pace = v > 0 ? v : 0;
  }

  // how fast the body's cooldowns run: mourning and coils
  function rateOf(e) {
    let r = 1;
    if (e.condT[MOURN] > 0) {
      const g = e.condV[MOURN];
      if (g === HALF) r = HALF_RATE; else if (g === ROUSED) r = ROUSED_RATE; else if (g === FULL) r = 0;
    }
    if (e.condT[COILED] > 0 && e.condN[COILED] > 0) r /= 1 + COIL_SLOW * e.condN[COILED];
    return r;
  }

  function mayStrike(e) {
    if (e.condT[MOURN] > 0 && e.condV[MOURN] === FULL) return false;
    return !(e.condT[FILED] > 0 || e.condT[COINED] > 0 || e.condV[BURGESS] > 0 || e.condN[BURGESS] > 0 || e.condT[BURGESS] > 0);
  }

  // stands where it is: full mourning, moored (its stake is the laying voice's), filed, a burgess
  function held(e) {
    if (e.condT[MOURN] > 0 && e.condV[MOURN] === FULL) return true;
    return e.condT[MOORED] > 0 || e.condT[FILED] > 0 || e.condT[BURGESS] > 0 || e.condV[BURGESS] > 0;
  }

  // ---- steering ----

  AI.steer = function (S, e, x, y, stop) {
    if (e.state !== 0) { e.vx = 0; e.vy = 0; e.face = e.a0; return; }
    const dx = x - e.x, dy = y - e.y, d = sqrt(dx * dx + dy * dy);
    let s = e.pace;
    const gap = d - (stop > 0 ? stop : 0);
    if (d < 1e-6 || gap <= 0 || s <= 0) { e.vx = 0; e.vy = 0; return; }
    if (gap < EASE) s *= gap / EASE;
    e.vx = dx / d * s;
    e.vy = dy / d * s;
    if (s > 0.05) e.face = Core.angleToward(e.face, atan2(dy, dx), TURN * DT);
  };

  // ---- attacks ----

  // the point the body's wake behaviour steers at this step: shared by all the common dead
  const lagPoint = { x: 0, y: 0 };

  function inRange(e, A, p, d) {
    if (A.kind === 'strike' || A.kind === 'press') return d - e.r - p.r <= A.range;
    if (A.kind === 'spread' || A.kind === 'fall') return d <= A.range;
    return false;                                  // throw and zone: not in the Dial
  }

  function blowLands(e, A, p) {
    const dx = p.x - e.x, dy = p.y - e.y, d = sqrt(dx * dx + dy * dy), aim = e.a0;
    if (A.shape === 'line') {
      const c = cos(aim), s = sin(aim), along = dx * c + dy * s, across = -dx * s + dy * c;
      return along >= 0 && along <= e.r + A.range + p.r && abs(across) <= A.radius + p.r;
    }
    if (A.shape === 'circle' || A.shape === 'ring') return d <= e.r + A.radius + p.r;
    if (d > e.r + A.range + p.r) return false;
    return d < e.r || abs(Core.angleDiff(aim, atan2(dy, dx))) <= A.angle / 2;   // arc, wedge
  }

  Enemies.fill = function (S, e, A, x, y) {
    let f = A.windup + (typeof Dmg.warning === 'function' ? Dmg.warning(S, e, A.id) : 0);
    const sh = S.vigil ? S.vigil.shade : null;
    if (sh && sh.on && Enemies.shaded(S, x, y)) f -= sh.warn;
    return f > FILL_LEAST ? f : FILL_LEAST;
  };

  Enemies.swell = function (S, e, A, x, y, angle, scale, fill) {
    const a = S.areas.alloc();
    if (a === null) return null;                   // the areas are full: this one is not shown
    const lane = A.shape === 'line';
    a.def = A;
    a.team = 1;
    a.owner = e ? e.uid : 0;
    a.skill = -1;
    a.x = a.px = x;
    a.y = a.py = y;
    a.r = A.radius;
    a.angle = angle;
    a.len = lane ? A.range : 0;
    a.damage = (e ? e.damage : 0) * A.mult * scale;
    a.t = 0;
    a.ttl = fill > 0.05 ? fill : 0.05;
    a.a0 = a.ttl;
    a.target = 0;
    a.state = 0;
    Sim.emit(S, 'telegraph', x, y, a.r, a.ttl, A.id);
    return a;
  };

  function begin(S, e, i, A, p) {
    e.attack = i;
    e.state = WINDUP;
    e.stateT = 0;
    e.a0 = atan2(p.y - e.y, p.x - e.x);
    e.face = e.a0;
    setCd(e, i, A.cooldown);
    if (A.kind === 'fall') {
      const n = A.count > 1 ? A.count : 1;
      for (let k = 0; k < n; k++) {
        // the first lands where the player stands; the rest round it, spread metres out, a golden angle apart
        const r = k === 0 ? 0 : A.spread, a = e.a0 + k * 2.39996;
        const x = p.x + cos(a) * r, y = p.y + sin(a) * r;
        Enemies.swell(S, e, A, x, y, 0, 1, Enemies.fill(S, e, A, x, y));
      }
      e.a1 = GESTURE;
    } else if (A.kind === 'spread') {
      Enemies.swell(S, e, A, e.x, e.y, e.a0, 1, Enemies.fill(S, e, A, e.x, e.y));
      e.a1 = GESTURE;
    } else {
      e.a1 = A.windup + (e.condT[SOUNDED] > 0 ? SOUNDED_EARLY : 0);
    }
  }

  function land(S, e, p) {
    const list = attacksOf(e.def), A = e.attack >= 0 && e.attack < list.length ? list[e.attack] : null;
    e.state = STRIKING;
    e.stateT = 0;
    if (A === null || !p.alive) return;
    if (A.kind === 'strike') {
      if (blowLands(e, A, p) && typeof Dmg.hitPlayer === 'function') Dmg.hitPlayer(S, A, e, 1, e.a1);
    } else if (A.kind === 'press' && A.ailment === 'clung') {
      const dx = p.x - e.x, dy = p.y - e.y, reach = e.r + p.r + A.range;
      if (dx * dx + dy * dy <= reach * reach) climbOn(S, e, A);
    }
  }

  AI.strike = function (S, e) {
    const list = attacksOf(e.def), count = list.length, p = S.player;
    if (count === 0) return;
    const dt = DT * rateOf(e);
    if (e.cd0 > 0) e.cd0 -= dt;
    if (count > 1 && e.cd1 > 0) e.cd1 -= dt;
    if (count > 2 && e.cd2 > 0) e.cd2 -= dt;
    if (count > 3 && e.cd3 > 0) e.cd3 -= dt;
    if (e.state === WINDUP) {
      e.stateT += DT;
      if (e.stateT >= e.a1 - SLIVER) land(S, e, p);
      return;
    }
    if (e.state === STRIKING) {
      e.stateT += DT;
      if (e.stateT >= STRIKE_SECONDS - SLIVER) { e.state = 0; e.stateT = 0; e.attack = -1; }
      return;
    }
    if (!p.alive || !mayStrike(e)) return;
    const dx = p.x - e.x, dy = p.y - e.y, d = sqrt(dx * dx + dy * dy);
    for (let i = 0; i < count; i++) {
      if (cdOf(e, i) > 0) continue;
      const A = list[i];
      if (A.ailment === 'clung' && p.condN[CLUNG] >= RIDERS) continue;
      if (!inRange(e, A, p, d)) continue;
      begin(S, e, i, A, p);
      return;
    }
  };

  // ---- the behaviours of the Dial ----

  AI.register('wake', function (S, e) {
    const p = S.player;
    if (e.rank >= ELITE) AI.steer(S, e, p.x, p.y, 0);
    else AI.steer(S, e, lagPoint.x, lagPoint.y, 0);
    AI.strike(S, e);
  });

  AI.register('chase', function (S, e) {
    const p = S.player, keep = e.def.aiParams.keep;
    AI.steer(S, e, p.x, p.y, keep > 0 ? keep : 0);
    AI.strike(S, e);
  });

  // ---- one step ----

  const near = new Array(NEAR_MAX).fill(null);

  // a body's first step: its cooldowns are set to a share of each attack's, by its uid, so a crowd strikes out of step
  function first(e) {
    const list = attacksOf(e.def);
    for (let i = 0; i < list.length; i++) {
      const k = e.uid * 0.6180339887 + i * 0.37, share = k - floor(k);
      setCd(e, i, list[i].cooldown * share);
    }
    e.lifeSeen = e.life;
  }

  function coinedWalk(S, e) {
    const h = e.condV[COINED];
    e.vx = cos(h) * e.pace;
    e.vy = sin(h) * e.pace;
    e.face = h;
    if (e.condT[COINED] <= DT + SLIVER && e.condN[COINED] > 0 && typeof Director.drop === 'function') {
      Director.drop(S, 1, e.condN[COINED], e.x, e.y);   // its time runs out in this step: its coins drop
      e.condN[COINED] = 0;
    }
  }

  // the overlaps with its neighbours, each shared by weight, at most SEP_CAP in all
  function separate(S, e) {
    const k = S.grid.near(e, SEP_MARGIN, near), me = weight(S, e);
    let sx = 0, sy = 0, used = 0;
    for (let j = 0; j < k && used < SEP_N; j++) {
      const o = near[j];
      if (o === e || !o.alive) continue;
      const dx = e.x - o.x, dy = e.y - o.y, reach = e.r + o.r, d2 = dx * dx + dy * dy;
      if (d2 >= reach * reach) continue;
      used++;
      const d = sqrt(d2), over = reach - d, share = weight(S, o) / (me + weight(S, o));
      if (d > 1e-9) { sx += dx / d * over * share; sy += dy / d * over * share; }
      else { sx += cos(e.uid) * over * share; sy += sin(e.uid) * over * share; }
    }
    const m2 = sx * sx + sy * sy;
    if (m2 > SEP_CAP * SEP_CAP) { const f = SEP_CAP / sqrt(m2); sx *= f; sy *= f; }
    e.x += sx;
    e.y += sy;
  }

  function move(S, p, items, n) {
    const planted = poseOf(p, 'braced');
    let pushX = 0, pushY = 0;
    for (let i = 0; i < n; i++) {
      const e = items[i];
      if (!e.alive) continue;
      e.x += (e.vx + e.kx) * DT;
      e.y += (e.vy + e.ky) * DT;
      if (e.kx !== 0 || e.ky !== 0) {
        e.kx *= KNOCK_FADE;
        e.ky *= KNOCK_FADE;
        if (e.kx * e.kx + e.ky * e.ky < 1e-4) { e.kx = 0; e.ky = 0; }
      }
      separate(S, e);
      if (p.alive) {
        const dx = e.x - p.x, dy = e.y - p.y, reach = e.r + p.r, d2 = dx * dx + dy * dy;
        if (d2 < reach * reach) {
          const d = sqrt(d2), over = reach - d, nx = d > 1e-9 ? dx / d : cos(e.uid), ny = d > 1e-9 ? dy / d : sin(e.uid);
          const w = weight(S, e), give = planted ? 0 : w / (w + 1) * GIVE;
          e.x += nx * over * (1 - give);
          e.y += ny * over * (1 - give);
          pushX -= nx * over * give;
          pushY -= ny * over * give;
        }
      }
      if (World.pushOut(S, e) && e.condT[COINED] > 0) e.condV[COINED] = Core.angleWrap(e.condV[COINED] + PI / 2);
    }
    if (pushX !== 0 || pushY !== 0) {
      const m2 = pushX * pushX + pushY * pushY;
      if (m2 > PUSH_CAP * PUSH_CAP) { const f = PUSH_CAP / sqrt(m2); pushX *= f; pushY *= f; }
      p.x += pushX;
      p.y += pushY;
      World.pushOut(S, p);
    }
  }

  // riders: they climb on while the player stands, and move onto a large body the player strides past
  function riders(S, p) {
    if (!p.alive) return;
    const crowd = S.crowd;
    if (p.condN[CLUNG] > 0 && p.condT[SEALED] <= 0 && striding(S, p)) {
      const k = S.grid.near(p, PASS_REACH, near);
      for (let j = 0; j < k; j++) {
        const o = near[j];
        if (!o.alive || !large(o) || o.condT[SEALED] > 0) continue;
        const have = o.condN[CLUNG], come = p.condN[CLUNG], all = have + come > RIDERS ? RIDERS : have + come;
        o.condV[CLUNG] = (o.condV[CLUNG] * have + p.condV[CLUNG] * come) / (have + come);
        o.condN[CLUNG] = all;
        p.condN[CLUNG] = 0;
        p.condV[CLUNG] = 0;
        break;
      }
    }
    if (p.condN[CLUNG] < RIDERS && standing(S, p)) {
      crowd.climb += DT;
      if (crowd.climb >= CLIMB_EVERY - SLIVER) {
        const k = S.grid.near(p, CLIMB_REACH, near);
        let best = null, bestD = Infinity;
        for (let j = 0; j < k; j++) {
          const o = near[j];
          if (!o.alive || o.rank >= ELITE || clingerOf(o.def) < 0) continue;
          const d = Core.dist2(o.x, o.y, p.x, p.y);
          if (d < bestD) { bestD = d; best = o; }
        }
        if (best !== null && climbOn(S, best, attacksOf(best.def)[clingerOf(best.def)])) crowd.climb = 0;
      }
    } else crowd.climb = 0;
  }

  function inSwell(a, x, y, r) {
    const A = a.def, dx = x - a.x, dy = y - a.y;
    if (A.shape === 'line') {
      const c = cos(a.angle), s = sin(a.angle), along = dx * c + dy * s, across = -dx * s + dy * c;
      return along >= -r && along <= a.len + r && abs(across) <= a.r + r;
    }
    const reach = a.r + r, d2 = dx * dx + dy * dy;
    if (d2 > reach * reach) return false;
    if (A.shape === 'wedge' || A.shape === 'arc') return d2 <= r * r || abs(Core.angleDiff(a.angle, atan2(dy, dx))) <= A.angle / 2;
    return true;
  }

  // the Swells of team 1: their clocks, and the landing of those whose time is up in this step
  function swells(S, p) {
    const areas = S.areas, items = areas.items, hit = typeof Dmg.hitPlayer === 'function', lee = typeof Dmg.inLee === 'function';
    const reach = S.sheet ? S.sheet.stats['lee-reach'] : 3;
    for (let i = 0; i < areas.n; i++) {
      const a = items[i];
      if (!a.alive || a.team !== 1 || a.def === null) continue;
      a.t += DT;
      if (a.state === LANDED || a.ttl > DT + SLIVER || a.def.type !== 'swell') continue;
      a.state = LANDED;
      if (!p.alive || !inSwell(a, p.x, p.y, p.r * 0.5)) continue;
      if (a.def.kind === 'spread' && lee && Dmg.inLee(S, a.x, a.y, p, reach)) continue;
      if (hit) Dmg.hitPlayer(S, a.def, a, 1, a.a0);
    }
  }

  Enemies.step = function (S) {
    const p = S.player, stats = S.sheet ? S.sheet.stats : null;
    const length = stats ? stats['wake-length'] : 5, lag = stats ? stats['wake-lag'] : 1.2;
    if (S.step % WAKE_EVERY === 0) noteWake(S, p, length);
    Enemies.wakeAt(S, lag, lagPoint);
    const items = S.enemies.items, n = S.enemies.n, turn = S.step % WAKE_EVERY, since = S.t - length;
    const v = S.vigil, gate = v && S.sheet && S.sheet.flags['pass-the-gate'] && v.passed > 0 ? 1 + 0.04 * v.passed : 1;
    for (let i = 0; i < n; i++) {
      const e = items[i];
      if (!e.alive) continue;
      if (e.t === 0) first(e);
      e.t += DT;
      const grade = mourning(e);
      if (e.uid % WAKE_EVERY === turn) procession(S, e, p, since);
      setPace(S, e, gate, grade);
      if (held(e)) {
        e.vx = 0;
        e.vy = 0;
        if (grade === FULL) {
          e.state = 0;
          e.attack = -1;
          e.face = Core.angleToward(e.face, atan2(e.ty - e.y, e.tx - e.x), TURN * DT);
        } else if (e.condT[MOORED] > 0) AI.strike(S, e);
        continue;
      }
      if (e.condT[COINED] > 0) { coinedWalk(S, e); continue; }
      const fn = behaviours[e.def.ai];
      if (fn !== undefined) fn(S, e);
      else { AI.steer(S, e, p.x, p.y, 0); AI.strike(S, e); }
    }
    move(S, p, items, n);
    riders(S, p);
    swells(S, p);
    for (let i = 0; i < S.enemies.n; i++) items[i].lifeSeen = items[i].life;
  };
})();
