// 27-notches.js: finds in a vigil (docs/design/04-progression.md, "How lines are written"; 02-combat.md, section 10):
// the postures a toll period is spent in, the line each toll writes on every find carried and in the struck place of a
// worn find on a re-walk, the finds the dead drop, the most the haul holds, and the heave with its bursts.
// Owns: Items
// Public:
//   Items.HAUL_MOST = 30             the most finds the haul holds: a find lying while the haul is full is held back
//                                    (its pickup's state Items.FULL) until there is room, the nearest first
//   Items.FULL = -30                 that state. This file sets only pickups of kind 2 whose state is 0 or FULL, so a
//                                    hold another system puts on one (any other state below 0: an observance's
//                                    promise) is left as it is
//   Items.period(S) -> row           the posture a toll ringing now writes by, a row of Stats.POSTURES: timed when the
//                                    player stands within 4 m of a landmark (the bell-post among them), else the
//                                    posture held most in the toll period so far (stood while Braced, strode while
//                                    Striding, pressed while crowded: the player's conditions, step by step); a tie
//                                    goes to the earlier row (stood, strode, pressed), so a period of none is stood
//   Items.heave(S) -> boolean        button B (21-player.js calls it when heaveCd has run out): throws the find of the
//                                    haul with the most notches (the first carried on a tie) 5 m ahead, along the aim,
//                                    out of the haul. It lands as a Blow on a circle 2 m across and bursts once for
//                                    each notch, 0.2 s apart, the first at once; a find with no notches lands once at
//                                    half harm. Each burst is harm 9 x the curves' enemyLife at the district's level x
//                                    heave-harm / 100 on every one of the dead it touches (Dmg.harmEnemy: guard, taken,
//                                    swing). It lies where it fell, blank (its written lines and any re-walk gone, its
//                                    base and fixed line kept), a pickup of kind 2 to walk over and carry again. Each
//                                    burst also leaves an area of no voice (team 0, skill -1, in the state Skills.MARK)
//                                    for 0.18 s, which the scene draws as the mark of a Blow. Emits 'heave'. false, and
//                                    nothing thrown, when the haul is empty, the player is not alive, or the pickups
//                                    have no room for it to lie in.
//   Items.lay(S, find, x, y) -> pickup | null   a find laid on the ground: a pickup of kind 2 (value 1, lying 300 s,
//                                    item the find) at (x, y), out of props and inside the district (World.pushOut),
//                                    held back at once when the haul has no room for it; null when the pickups are
//                                    full. Every find this file lays goes through it; a system that lays one should too.
// Slot: S.notches = {seen, secs, known, n, lx, ly, throws: {n, x, y, left, at, harm}}: the toll last written for; the
// seconds of this toll period spent in each posture (Float64Array, by row of Stats.POSTURES; timed counts none); the
// landmarks, found once (their number and places); and the heaves bursting (at most 4 at once: where, the bursts left,
// S.t of the next, the harm of each).
// System 'notches' (Sim.system), once a step: when S.toll has risen, the posture of the period just ended
// (Items.period) writes a line (Items.write) on every find of S.haul with room and into the struck place of each worn
// find of S.cfg.char on a re-walk (S.dirty then; the next checkpoint keeps it), while the player lives; then this
// step's seconds go to the new period's postures; then for every 'kill' of the step a find may drop where the body
// fell: keeper 1, elite 0.3, a large common body 0.02, a small one 0.004, times find-chance / 100 (the number expected:
// above 1 drops more than one), drawn from S.rng.loot. A drop is Items.lay of a find Items.make makes of a base
// Items.draw gives (S.cfg.account.open.bases opens those with an unlock) at the district's level (zone.level), its
// fixed line rolled from S.rng.loot, uid -(++S.uid), with a 'drop' event (a = 2, b = 1); none when the pickups are
// within 8 of full (the room the favours' shapes keep). Then the heaves' bursts, then the haul's limit. Player.pickups
// puts a find walked over into S.haul, and ringing down banks it into S.bank.finds.
// Events: 'notch' (x, y the player; a = the place written; b = the posture's row of Stats.POSTURES; id = the find's
// base), 'heave' (x, y where it lands; a = its notches; id = its base) and 'drop' (as the director's, a = 2).
//
// Choices where the design is silent. The toll is read where the system notices it, in the step after it rang: the
// haul as it stands then, and the player's place then for timed (as the director reads the landmarks for Hum, phase 2
// of that step). The drop odds and the burst's harm are the numbers above, to be tuned with the Dial.
(function () {
  'use strict';

  const DT = Core.DT, SLIVER = 1e-9, sqrt = Math.sqrt, cos = Math.cos, sin = Math.sin, floor = Math.floor;
  const HAUL_MOST = 30, FULL = -30;
  const KIND_FIND = 2;                             // a pickup of kind 2 is a find (docs/engine.md, "Pickups")
  const LANDMARK_REACH = 4, LANDMARK_MOST = 16;    // a toll finds you at a landmark within 4 m of it
  const ROLES = ['bell-post', 'landmark'];         // the district's six landmarks, the bell-post among them
  const TIMED = 'timed';                           // the posture the landmark rule writes; the others are counted
  const THROW = 5, RADIUS = 1, BURST_GAP = 0.2, BURST_SHOW = 0.18, HALF = 0.5, BURST = 9;
  const HEAVE_KIND = 'blow';                       // a heaved find lands as a Blow (02-combat.md, section 10)
  const THROWS_MOST = 4, MARK = 2;                 // MARK: the state of a voice's area that marks a Blow (23-skills.js)
  const FIND_TTL = 300, FIND_R = 0.25, SCATTER = 0.8;
  const RESERVE = 8, HEAVE_RESERVE = 4;            // pickups kept free: the favours' shapes (as 26-director.js keeps)
  const ODDS = { keeper: 1, elite: 0.3, large: 0.02, small: 0.004 };

  const ROW_TIMED = Stats.POSTURE[TIMED], ROWS = Stats.POSTURES.length;
  const BITS = Stats.POSTURES.map((p) => 1 << Stats.COND[p.cond]);
  const found = new Array(1024).fill(null), roles = new Array(64).fill(null);

  Items.HAUL_MOST = HAUL_MOST;
  Items.FULL = FULL;

  Defs.allow('event', 'notch');

  Sim.state('notches', function () {
    const f = (n) => new Float64Array(n);
    return {
      seen: 0, secs: f(ROWS), known: false, n: 0, lx: f(LANDMARK_MOST), ly: f(LANDMARK_MOST),
      throws: { n: 0, x: f(THROWS_MOST), y: f(THROWS_MOST), left: new Int32Array(THROWS_MOST), at: f(THROWS_MOST), harm: f(THROWS_MOST) },
    };
  });

  // ---- the postures of a toll period ----

  function learn(S, st) {
    st.known = true;
    st.n = 0;
    for (let k = 0; k < ROLES.length; k++) {
      const n = World.withRole(S, ROLES[k], roles);
      for (let i = 0; i < n && st.n < LANDMARK_MOST; i++) { st.lx[st.n] = roles[i].x; st.ly[st.n] = roles[i].y; st.n++; }
    }
  }

  function atLandmark(S, st) {
    const p = S.player, r2 = LANDMARK_REACH * LANDMARK_REACH + SLIVER;
    for (let i = 0; i < st.n; i++) if (Core.dist2(st.lx[i], st.ly[i], p.x, p.y) <= r2) return true;
    return false;
  }

  Items.period = function (S) {
    const st = S.notches;
    if (!st.known) learn(S, st);
    if (ROW_TIMED !== undefined && atLandmark(S, st)) return ROW_TIMED;
    let best = -1;
    for (let r = 0; r < ROWS; r++) if (r !== ROW_TIMED && (best < 0 || st.secs[r] > st.secs[best] + SLIVER)) best = r;
    return best;
  };

  function count(S, st) {
    const conds = S.player.conds;
    for (let r = 0; r < ROWS; r++) if (r !== ROW_TIMED && (conds & BITS[r]) !== 0) st.secs[r] += DT;
  }

  // ---- a toll writes ----

  function notch(S, find, row) {
    const place = Items.write(S, find, row);
    if (place >= 0) Sim.emit(S, 'notch', S.player.x, S.player.y, place, row, find.base);
    return place;
  }

  function tolled(S, st) {
    const row = Items.period(S);
    if (row < 0) return;
    for (let i = 0; i < S.haul.length; i++) notch(S, S.haul[i], row);
    const char = S.cfg.char, worn = char && char.worn ? char.worn : null;
    if (worn === null || typeof Char.SLOTS !== 'object') return;
    for (let i = 0; i < Char.SLOTS.length; i++) {
      const f = worn[Char.SLOTS[i]];
      if (f && f.walk >= 0 && f.lines[f.walk] === null && notch(S, f, row) >= 0) S.dirty = true;
    }
  }

  // ---- the finds the dead drop ----

  function oddsOf(rank, id) {
    if (rank >= Sim.BOSS) return ODDS.keeper;
    if (rank >= Sim.ELITE) return ODDS.elite;
    const def = typeof id === 'string' && Defs.has('enemy', id) ? Defs.get('enemy', id) : null;
    return def !== null && def.size === 'large' ? ODDS.large : ODDS.small;
  }

  const levelOf = (S) => (S.zone && S.zone.level >= 1 ? floor(S.zone.level) : 1);

  Items.lay = function (S, find, x, y) {
    const o = S.pickups.alloc();
    if (o === null) return null;
    o.kind = KIND_FIND;
    o.value = 1;
    o.x = o.px = x;
    o.y = o.py = y;
    o.r = FIND_R;
    o.ttl = FIND_TTL;
    o.item = find;
    o.state = 0;
    World.pushOut(S, o);
    o.px = o.x;
    o.py = o.y;
    room(S);                                       // held back at once if the haul has no room for it
    return o;
  };

  function drop(S, x, y) {
    const pool = S.pickups, rng = S.rng.loot;
    if (pool.n >= pool.cap - RESERVE) return;
    const account = S.cfg.account, open = account && account.open ? account.open.bases : null, level = levelOf(S);
    const id = Items.draw(rng, open, level);
    if (id === null) return;
    const roll = rng.next(), jx = (rng.next() - 0.5) * SCATTER, jy = (rng.next() - 0.5) * SCATTER;
    const o = Items.lay(S, Items.make(id, level, -(++S.uid), roll), x + jx, y + jy);
    if (o !== null) Sim.emit(S, 'drop', o.x, o.y, KIND_FIND, 1, null);
  }

  function drops(S) {
    const ring = S.events, start = S.eventStart, n = S.eventCount;
    let chance = -1;
    for (let i = 0; i < n; i++) {
      const e = ring[(start + i) % ring.length];
      if (e.k !== 'kill') continue;
      if (chance < 0) chance = S.sheet ? S.sheet.stats['find-chance'] / 100 : 1;
      const x = e.x, y = e.y;
      for (let left = oddsOf(e.a, e.id) * chance; left > SLIVER; left -= 1) {
        if (left >= 1 || S.rng.loot.next() < left) drop(S, x, y);
      }
    }
  }

  // ---- the heave ----

  function notches(find) {
    let k = 0;
    for (let i = 0; i < find.lines.length; i++) if (find.lines[i] !== null) k++;
    return k;
  }

  function burstHarm(S, k) {
    const life = S.curves && S.curves.enemyLife ? S.curves.enemyLife[levelOf(S) - 1] || 1 : 1;
    return BURST * life * (S.sheet ? S.sheet.stats['heave-harm'] / 100 : 1) * (k > 0 ? 1 : HALF);
  }

  function addThrow(S, x, y, bursts, harm) {
    const t = S.notches.throws;
    if (t.n === THROWS_MOST) {                     // the oldest gives way
      for (let i = 1; i < THROWS_MOST; i++) { t.x[i - 1] = t.x[i]; t.y[i - 1] = t.y[i]; t.left[i - 1] = t.left[i]; t.at[i - 1] = t.at[i]; t.harm[i - 1] = t.harm[i]; }
      t.n--;
    }
    const i = t.n++;
    t.x[i] = x; t.y[i] = y; t.left[i] = bursts; t.at[i] = S.t; t.harm[i] = harm;
  }

  Items.heave = function (S) {
    const haul = S.haul, p = S.player, pool = S.pickups;
    if (haul.length === 0 || !p.alive || pool.n >= pool.cap - HEAVE_RESERVE) return false;
    let best = 0, most = -1;
    for (let i = 0; i < haul.length; i++) {
      const k = haul[i] && Array.isArray(haul[i].lines) ? notches(haul[i]) : 0;
      if (k > most) { most = k; best = i; }
    }
    const find = haul[best];
    for (let i = best; i < haul.length - 1; i++) haul[i] = haul[i + 1];
    haul.length--;
    S.dirty = true;                                // the finds carried are a count of the sheet, and its ballast
    let ax = p.aimX, ay = p.aimY;
    const l = sqrt(ax * ax + ay * ay);
    if (l > 1e-6) { ax /= l; ay /= l; } else { ax = cos(p.face); ay = sin(p.face); }
    if (Array.isArray(find.lines)) for (let i = 0; i < find.lines.length; i++) find.lines[i] = null;
    find.walk = -1;
    const o = Items.lay(S, find, p.x + ax * THROW, p.y + ay * THROW);   // there is room: the pool was asked above
    addThrow(S, o.x, o.y, most > 0 ? most : 1, burstHarm(S, most));
    Sim.emit(S, 'heave', o.x, o.y, most, 0, find.base === undefined ? null : find.base);
    return true;
  };

  // one burst: a Blow on every one of the dead within the circle, and its mark (an area of no voice) for the scene
  function burst(S, x, y, harm) {
    const m = S.grid.query(x, y, RADIUS + 1, found);
    for (let i = 0; i < m; i++) {
      const e = found[i];
      if (!e.alive || !(e.life > 0)) continue;
      const dx = e.x - x, dy = e.y - y, reach = RADIUS + e.r;
      if (dx * dx + dy * dy <= reach * reach + SLIVER) Dmg.harmEnemy(S, e, HEAVE_KIND, harm, x, y);
    }
    const a = S.areas.alloc();
    if (a === null) return;
    a.team = 0;
    a.owner = 0;
    a.skill = -1;                                  // no voice's: Skills.step and Dmg.tick pass it by
    a.state = typeof Skills.MARK === 'number' ? Skills.MARK : MARK;   // drawn as the mark of a Blow, not a Swell
    a.x = a.px = x;
    a.y = a.py = y;
    a.r = RADIUS;
    a.ttl = BURST_SHOW;
  }

  function bursts(S, st) {
    const t = st.throws;
    for (let i = 0; i < t.n; i++) {
      while (t.left[i] > 0 && S.t >= t.at[i] - SLIVER) {
        burst(S, t.x[i], t.y[i], t.harm[i]);
        t.left[i]--;
        t.at[i] += BURST_GAP;
      }
    }
    let k = 0;                                     // the heaves that have burst their last close up
    for (let i = 0; i < t.n; i++) {
      if (t.left[i] <= 0) continue;
      t.x[k] = t.x[i]; t.y[k] = t.y[i]; t.left[k] = t.left[i]; t.at[k] = t.at[i]; t.harm[k] = t.harm[i];
      k++;
    }
    t.n = k;
  }

  // ---- the most the haul holds ----

  const lying = (o) => o.alive && o.kind === KIND_FIND && (o.state === 0 || o.state === FULL);

  function room(S) {
    const items = S.pickups.items, n = S.pickups.n, p = S.player;
    let free = HAUL_MOST - S.haul.length, many = 0;
    for (let i = 0; i < n; i++) if (lying(items[i])) many++;
    if (many === 0) return;
    if (many <= free) {
      for (let i = 0; i < n; i++) if (lying(items[i])) items[i].state = 0;
      return;
    }
    for (let i = 0; i < n; i++) if (lying(items[i])) items[i].state = FULL;
    for (; free > 0; free--) {                     // room for some: the nearest are let go first
      let best = null, d = Infinity;
      for (let i = 0; i < n; i++) {
        const o = items[i];
        if (!lying(o) || o.state !== FULL) continue;
        const k = Core.dist2(o.x, o.y, p.x, p.y);
        if (k < d) { d = k; best = o; }
      }
      if (best === null) break;
      best.state = 0;
    }
  }

  // ---- the system ----

  Sim.system('notches', function (S) {
    const st = S.notches;
    if (!st.known) learn(S, st);
    if (S.toll > st.seen) {
      if (S.player.alive) tolled(S, st);
      st.seen = S.toll;
      for (let r = 0; r < ROWS; r++) st.secs[r] = 0;
    }
    if (S.player.alive) count(S, st);
    drops(S);
    bursts(S, st);
    room(S);
  });
})();
