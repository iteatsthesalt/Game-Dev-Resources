// 25-boss.js: the keepers' fights. The keeper in S.boss walks by its own behaviour, 'keeper', and strikes by its
// phases: Boss.step casts the attacks of its phase's loop and lays each one's strokes on the ground in the order of
// the keeper's rule.
// Owns: Boss
// Public:
//   Boss.step(S)                     phase 7: the keeper in S.boss (26-director.js raises it at the eighth toll and
//                                    sets S.boss): its phase by its life, the casts of the phase's loop, and the
//                                    strokes it has queued, shown as Swells of team 1 when their time comes
//   AI 'keeper'                      registered here: it steers toward the player and holds aiParams.keep metres off,
//                                    walking on at 60% of its pace while it gestures, and never walks farther than
//                                    arena.radius from the middle of the district. It makes no attack itself:
//                                    Boss.step does.
//
// A keeper's def is a boss (an enemy with arena and phases). phases[i] holds while its life is above until of its
// share (the last phase to the end); entering it emits 'phase' (x, y the keeper; a = the phase entered, from 1;
// id = the keeper's id), sets its speed to the def's speed times the phase's speed, and casts its onEnter attacks.
// Then its loop runs round: an attack id is cast, {wait} waits that many seconds.
//
// The Half-muffled Keeper's rule (its aiParams): every stroke lands twice on the same ground, at full harm and as an
// echo at aiParams.echo (0.3) of it. aiParams.order names the order in each phase:
//   'after'    the full stroke is shown (its fill: Enemies.fill), and as it lands its echo is shown on the same ground,
//              landing aiParams.after (2) seconds later
//   'before'   the echo is shown first and is the only warning; as it lands the full stroke is shown on the same
//              ground, landing aiParams.before (1.2) seconds later
//   'reverse'  three echoes are laid one after another, aiParams.lay (0.7) seconds apart, each where the player
//              stands as it is shown; as the last lands their full strokes are shown at once and land in reverse
//              order, the last laid first, aiParams.reverse ([1.2, 2, 2.8]) seconds later
// A falling stroke (kind 'fall') is a circle on the ground where the player stood; a spreading one is drawn from the
// keeper's place toward the player, and keeps that source and aim for its echo. The keeper gestures (state 1, 0.9 s
// or the stroke's fill if shorter, then state 2 for 0.35 s) as it shows a stroke, unless it is gesturing already.
//
// Its slot: S.keeper = {uid, phase, loop, wait, n, at, fill, scale, att, ground, aim, gx, gy, ga, gSet, next}: the
// keeper it follows (by uid), its phase (-1 before the first) and place in the loop, the seconds to wait, and a queue
// of n strokes, each with the time it is shown (at), its fill, its scale, its attack (an index into the def's
// attacks), and its ground (an index into gx, gy, ga, a ring of grounds; gSet whether it is set; aim: the ground is
// set when the stroke is shown).
(function () {
  'use strict';

  const DT = Core.DT, SLIVER = 1e-9;
  const atan2 = Math.atan2;
  const QUEUE = 24, GROUNDS = 16;
  const GESTURE = 0.9, STRIKE_SECONDS = 0.35, WINDUP = 1, STRIKING = 2, GESTURE_PACE = 0.6;
  const ORDER = ['after', 'before', 'reverse'];
  const DEFAULTS = { echo: 0.3, after: 2, before: 1.2, lay: 0.7, keep: 6, first: 2 };
  const REVERSE = [1.2, 2, 2.8];

  Sim.state('keeper', function () {
    return {
      uid: 0, phase: -1, loop: 0, wait: 0, n: 0, next: 0,
      at: new Float64Array(QUEUE), fill: new Float64Array(QUEUE), scale: new Float64Array(QUEUE),
      att: new Int32Array(QUEUE), ground: new Int32Array(QUEUE), aim: new Uint8Array(QUEUE),
      gx: new Float64Array(GROUNDS), gy: new Float64Array(GROUNDS), ga: new Float64Array(GROUNDS), gSet: new Uint8Array(GROUNDS),
    };
  });

  function param(def, key) {
    const v = def.aiParams[key];
    return typeof v === 'number' ? v : DEFAULTS[key];
  }

  // the keeper's attacks, each an attack def (an id is looked up)
  const resolved = new Map();
  function attacksOf(def) {
    let list = resolved.get(def);
    if (list === undefined) {
      list = def.attacks.map((a) => (typeof a === 'string' ? Defs.get('attack', a) : a));
      resolved.set(def, list);
    }
    return list;
  }
  function indexOf(def, id) {
    const list = attacksOf(def);
    for (let i = 0; i < list.length; i++) if (list[i].id === id) return i;
    return -1;
  }

  // ---- walking ----

  AI.register('keeper', function (S, e) {
    const p = S.player, keep = param(e.def, 'keep'), state = e.state, pace = e.pace;
    // it walks on as it gestures, more slowly: AI.steer would hold a body that is winding up
    e.state = 0;
    if (state !== 0) e.pace = pace * GESTURE_PACE;
    AI.steer(S, e, p.x, p.y, keep);
    e.state = state;
    e.pace = pace;
    const R = e.def.arena ? e.def.arena.radius : 0, rg = S.region;
    if (R > 0 && rg) {
      const x = e.x + e.vx * DT - rg.x, y = e.y + e.vy * DT - rg.y;
      if (x * x + y * y > R * R && (e.vx * (e.x - rg.x) + e.vy * (e.y - rg.y)) > 0) { e.vx = 0; e.vy = 0; }
    }
  });

  // ---- the queue of strokes ----

  function ground(st) {
    const g = st.next;
    st.next = (st.next + 1) % GROUNDS;
    st.gSet[g] = 0;
    return g;
  }

  function setGround(S, st, g, e, A) {
    const p = S.player;
    if (A.kind === 'fall') { st.gx[g] = p.x; st.gy[g] = p.y; st.ga[g] = 0; }
    else { st.gx[g] = e.x; st.gy[g] = e.y; st.ga[g] = atan2(p.y - e.y, p.x - e.x); }
    st.gSet[g] = 1;
  }

  function queue(st, at, fill, scale, att, g, aim) {
    if (st.n >= QUEUE) return;                     // full: the stroke is not laid
    const k = st.n++;
    st.at[k] = at; st.fill[k] = fill; st.scale[k] = scale; st.att[k] = att; st.ground[k] = g; st.aim[k] = aim ? 1 : 0;
  }

  // casts one attack of the keeper in the order of its phase
  function cast(S, st, e, att) {
    const def = e.def, A = attacksOf(def)[att], t = S.t, echo = param(def, 'echo');
    const order = Array.isArray(def.aiParams.order) ? def.aiParams.order[st.phase] : ORDER[st.phase];
    const p = S.player, ax = A.kind === 'fall' ? p.x : e.x, ay = A.kind === 'fall' ? p.y : e.y;
    const F = Enemies.fill(S, e, A, ax, ay);
    if (order === 'reverse') {
      const lay = param(def, 'lay'), times = Array.isArray(def.aiParams.reverse) ? def.aiParams.reverse : REVERSE;
      const g0 = ground(st), g1 = ground(st), g2 = ground(st), last = t + 2 * lay + F;
      queue(st, t, F, echo, att, g0, true);
      queue(st, t + lay, F, echo, att, g1, true);
      queue(st, t + 2 * lay, F, echo, att, g2, true);
      queue(st, last, times[0], 1, att, g2, false);
      queue(st, last, times[1], 1, att, g1, false);
      queue(st, last, times[2], 1, att, g0, false);
    } else {
      const g = ground(st);
      setGround(S, st, g, e, A);
      if (order === 'before') {
        queue(st, t, F, echo, att, g, false);
        queue(st, t + F, param(def, 'before'), 1, att, g, false);
      } else {
        queue(st, t, F, 1, att, g, false);
        queue(st, t + F, param(def, 'after'), echo, att, g, false);
      }
    }
  }

  // shows the strokes whose time has come, and drops them from the queue
  function show(S, st, e) {
    const list = attacksOf(e.def);
    let k = 0;
    while (k < st.n) {
      if (st.at[k] > S.t + SLIVER) { k++; continue; }
      const A = list[st.att[k]], g = st.ground[k];
      if (st.aim[k] === 1 || st.gSet[g] === 0) setGround(S, st, g, e, A);
      Enemies.swell(S, e, A, st.gx[g], st.gy[g], st.ga[g], st.scale[k], st.fill[k]);
      if (e.state === 0) {                         // it gestures as it shows a stroke, and stands
        e.state = WINDUP;
        e.stateT = 0;
        e.a1 = st.fill[k] < GESTURE ? st.fill[k] : GESTURE;
        e.a0 = A.kind === 'fall' ? atan2(st.gy[g] - e.y, st.gx[g] - e.x) : st.ga[g];
      }
      st.n--;                                      // the last entry takes this place
      st.at[k] = st.at[st.n]; st.fill[k] = st.fill[st.n]; st.scale[k] = st.scale[st.n];
      st.att[k] = st.att[st.n]; st.ground[k] = st.ground[st.n]; st.aim[k] = st.aim[st.n];
    }
  }

  function enter(S, st, e, i) {
    const def = e.def, ph = def.phases[i];
    st.phase = i;
    st.loop = 0;
    st.wait = i === 0 ? param(def, 'first') : 0.5;
    e.speed = def.speed * (ph.speed > 0 ? ph.speed : 0);
    Sim.emit(S, 'phase', e.x, e.y, i + 1, 0, def.id);
    for (let j = 0; j < ph.onEnter.length; j++) {
      const att = indexOf(def, ph.onEnter[j]);
      if (att >= 0) cast(S, st, e, att);
    }
  }

  Boss.step = function (S) {
    const e = S.boss, st = S.keeper;
    if (!e || !e.alive || !(e.life > 0) || !e.def || !Array.isArray(e.def.phases) || e.def.phases.length === 0) {
      if (st.uid !== 0) { st.uid = 0; st.n = 0; st.phase = -1; }   // laid (or falling in this step): nothing more
      return;
    }
    const def = e.def, phases = def.phases;
    if (st.uid !== e.uid) {
      st.uid = e.uid; st.phase = -1; st.n = 0; st.loop = 0; st.wait = 0;
      enter(S, st, e, 0);
    }
    const share = e.lifeMax > 0 ? e.life / e.lifeMax : 0;
    while (st.phase < phases.length - 1 && share <= phases[st.phase].until) enter(S, st, e, st.phase + 1);
    // the gesture
    if (e.state === WINDUP) {
      e.stateT += DT;
      if (e.stateT >= e.a1 - SLIVER) { e.state = STRIKING; e.stateT = 0; }
    } else if (e.state === STRIKING) {
      e.stateT += DT;
      if (e.stateT >= STRIKE_SECONDS - SLIVER) { e.state = 0; e.stateT = 0; }
    }
    // the loop of its phase
    const loop = phases[st.phase].loop;
    if (st.wait > 0) st.wait -= DT;
    let guard = loop.length;
    while (st.wait <= SLIVER && loop.length > 0 && guard-- > 0) {
      const item = loop[st.loop];
      st.loop = (st.loop + 1) % loop.length;
      if (typeof item === 'string') {
        const att = indexOf(def, item);
        if (att >= 0 && S.player.alive) cast(S, st, e, att);
      } else st.wait += item.wait > 0 ? item.wait : 0;
    }
    show(S, st, e);
  };
})();
