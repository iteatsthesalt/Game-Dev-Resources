// 28-bot.js: scripted players, for tests and for Game.sim(seconds, {bot: true, policy}).
// Owns: Bot
// Public:
//   Bot.input(S, policy) -> InputFrame       the input of the next step: one frame of the run's own (S.bot.frame),
//                                            refilled each call. policy (default 'vigil'):
//     'still'    does nothing
//     'walk'     a slow circle, about 5 m across
//     'vigil'    plays the Change-ringer through the Dial. In order of need: Tolled-for, it runs for the far
//                lychgate; it steps out of a Swell of the dead that will land on it; it rings down at an open lychgate
//                once the keeper is laid or its life is low; it walks into the favour it likes best of those standing;
//                with no dead near it goes to an open wound and stands on it to mend; and otherwise it fights: it
//                walks a wide round of the plaza with the train behind, stops to set the bell when the train is long
//                (pressing the trade when it is ready), rocks back and forth in the crowd so that every reversal is a
//                pull, and breaks out the thin way when the crowd is too thick or its life runs low. Whatever it
//                does, it keeps 5 m from the keeper and turns aside from the ground of a Swell about to land.
//   Bot.choose(S, offer) -> index            for an offer that pauses (none in Stage 1): the first option
//
// Its memory lives in S.bot = {frame, mode, modeT, flick, flickT, round, aim, set}: the frame it hands out, what it is
// doing ('kite', 'set', 'rock', 'break') and for how long, the sign and age of the present flick, which way round the
// plaza it walks (1 sunwise, -1 widdershins), the direction it last chose, and whether it has set the bell for this
// stop. It reads only the run (S.player, S.wounds, S.gate, S.boss, S.areas, S.pickups, S.grid) and draws from no
// stream of the run, so it never changes what the run itself would draw.
(function () {
  'use strict';

  const DT = Core.DT, TAU = Core.TAU, PI = Math.PI;
  const sqrt = Math.sqrt, cos = Math.cos, sin = Math.sin, atan2 = Math.atan2, abs = Math.abs;
  const TOLLED = Stats.AILMENT['tolled-for'], CLUNG = Stats.RULE.riders;
  const ROUND_R = 13, ROUND_SLACK = 4;             // metres: the plaza round it walks, and how far off it may stray
  const FLICK = 12;                                 // steps each way of a rock (0.2 s)
  const SET_TIME = 1.8, ROCK_BURST = 0.75, ROCK_MOST = 2.5, BREAK_TIME = 1, KITE_LEAST = 1.5, SEEK_AFTER = 5;   // seconds
  const RING = 2.6, CROWD_TOO_THICK = 9, PRESSED = 3, KEEPER_OFF = 0.6, KEEPER_NEAR = 1.6, SHED_FAR = 40, CLINGER_NEAR = 3.4;
  const RING_DOWN_LOW = 0.3, MEND_BELOW = 0.95, MEND_CLEAR = 4, MEND_REACH = 14, STEP_BACK = 4, OLD = 30;
  const SWELL_MARGIN = 0.6, SWELL_SOON = 1.1, DODGE_BELOW = 0.5;
  const LIKED = {                                   // what it prefers among the favours raised (unlisted: 1)
    'arval-bread': 9, 'laying-out': 9, 'bellmans-walk': 8, 'ringers-jug': 8, 'mourning-hatband': 7, 'crape-on-the-door': 7,
    'corpse-road': 6, 'lyke-wake': 6, 'sprig-of-rosemary': 5, 'stopped-clock': 8, 'worn-sally': 6, 'stay-and-slider': 5,
    'bidders-round': 5, 'open-window': 4, 'heavy-coffin': 4, 'walking-mourners': 4, 'picture-to-the-wall': 3,
    'bearers-rest': 3, 'hearse-house': 3, 'glove-money': 2, 'pass-the-gate': 2, 'muffle-the-toll': 3,
    'ring-your-own-passing-bell': 4, 'nail-in-the-candle': 2, 'coins-on-your-own-eyes': 1,
  };

  Sim.state('bot', function () {
    return {
      frame: { mx: 0, my: 0, ax: 1, ay: 0, aim: false, trade: false, heave: false },
      mode: 'hold', modeT: 0, flick: 1, flickT: 0, round: 1, aim: 0, set: false, why: '',
    };
  });

  const near = new Array(1024).fill(null);
  const dir = { x: 0, y: 0 };                       // scratch: a direction, refilled before each use

  // ---- what it sees ----

  function lifeShare(S) {
    const max = S.sheet ? S.sheet.stats['life-max'] : 60;
    return max > 0 ? S.player.life / max : 0;
  }

  function crowd(S, x, y, r) {
    const n = S.grid.query(x, y, r, near);
    let k = 0;
    for (let i = 0; i < n; i++) if (near[i].alive) k++;
    return k;
  }

  // Is (x, y) inside a Swell of the dead that lands within soon seconds (grown by margin)?
  function swellAt(S, x, y, margin, soon) {
    const areas = S.areas, items = areas.items;
    for (let i = 0; i < areas.n; i++) {
      const a = items[i];
      if (!a.alive || a.team !== 1 || a.def === null || a.def.type !== 'swell' || a.state === 2 || a.ttl > soon) continue;
      const A = a.def, dx = x - a.x, dy = y - a.y;
      if (A.shape === 'line') {
        const c = cos(a.angle), s = sin(a.angle), along = dx * c + dy * s, across = -dx * s + dy * c;
        if (along >= -margin && along <= a.len + margin && abs(across) <= a.r + margin) return a;
        continue;
      }
      const reach = a.r + margin, d2 = dx * dx + dy * dy;
      if (d2 > reach * reach) continue;
      if ((A.shape === 'wedge' || A.shape === 'arc') && d2 > margin * margin &&
        abs(Core.angleDiff(a.angle, atan2(dy, dx))) > A.angle / 2 + 0.25) continue;
      return a;
    }
    return null;
  }

  // the way out of the Swell a: away from its centre, or sideways out of a wedge or a lane
  function escape(S, a, out) {
    const p = S.player;
    if (a.def.shape === 'wedge' || a.def.shape === 'line' || a.def.shape === 'arc') {
      const side = Core.angleDiff(a.angle, atan2(p.y - a.y, p.x - a.x)) >= 0 ? 1 : -1;
      const ang = a.angle + side * PI / 2;
      out.x = cos(ang); out.y = sin(ang);
      return out;
    }
    let dx = p.x - a.x, dy = p.y - a.y, d = sqrt(dx * dx + dy * dy);
    if (d < 1e-3) { dx = cos(S.bot.aim); dy = sin(S.bot.aim); d = 1; }
    out.x = dx / d; out.y = dy / d;
    return out;
  }

  // of eight directions, the one with the fewest dead 2.5 m out that keeps inside the district
  function thinWay(S, out) {
    const p = S.player, rg = S.region;
    let best = 0, fewest = Infinity;
    for (let k = 0; k < 8; k++) {
      const a = k * TAU / 8, x = p.x + cos(a) * 2.5, y = p.y + sin(a) * 2.5;
      let n = crowd(S, x, y, 2);
      if (rg && Core.dist2(x, y, rg.x, rg.y) > (rg.radius - 3) * (rg.radius - 3)) n += 50;
      if (n < fewest) { fewest = n; best = a; }
    }
    out.x = cos(best); out.y = sin(best);
    return out;
  }

  // ---- how it moves ----

  function toward(S, x, y, out) {
    const p = S.player, dx = x - p.x, dy = y - p.y, d = sqrt(dx * dx + dy * dy);
    if (d < 1e-6) { out.x = 0; out.y = 0; return 0; }
    out.x = dx / d; out.y = dy / d;
    return d;
  }

  // the direction along the round of the plaza, pulled back to it when it strays
  function round(S, b, out) {
    const p = S.player, rg = S.region, cx = rg ? rg.x : p.x, cy = rg ? rg.y : p.y;
    let dx = p.x - cx, dy = p.y - cy, d = sqrt(dx * dx + dy * dy);
    if (d < 1e-3) { dx = 1; dy = 0; d = 1; }
    const ux = dx / d, uy = dy / d, tx = -uy * b.round, ty = ux * b.round;
    const pull = Core.clamp((ROUND_R - d) / ROUND_SLACK, -1, 1);
    out.x = tx + ux * pull * 0.8;
    out.y = ty + uy * pull * 0.8;
    const m = sqrt(out.x * out.x + out.y * out.y);
    out.x /= m; out.y /= m;
    return out;
  }

  // the chosen direction, turned aside from the keeper and from a Swell about to land, into the frame
  function steer(S, b, f, x, y, speed) {
    const p = S.player;
    let ang = atan2(y, x);
    if (S.boss && S.boss.alive) {                  // close enough for the ring, but not pressed against it
      const kx = S.boss.x - p.x, ky = S.boss.y - p.y, kd = sqrt(kx * kx + ky * ky);
      if (kd < KEEPER_OFF + S.boss.r + p.r) {
        const off = Core.angleDiff(atan2(ky, kx), ang);
        if (abs(off) < PI / 2) ang = atan2(ky, kx) + (off >= 0 ? 1 : -1) * PI / 2;
      }
    }
    if (swellAt(S, p.x, p.y, 0.2, SWELL_SOON) === null) {
      for (let k = 0; k < 7; k++) {                // try the way, then 45, 90 and 135 degrees to either side
        const turn = (k + 1 >> 1) * (k % 2 === 1 ? 1 : -1) * PI / 4, a = ang + turn;
        if (swellAt(S, p.x + cos(a) * 1.5, p.y + sin(a) * 1.5, SWELL_MARGIN, SWELL_SOON) === null) { ang = a; break; }
      }
    }
    b.aim = ang;
    f.mx = cos(ang) * speed;
    f.my = sin(ang) * speed;
  }

  function mode(b, name) {
    if (b.mode !== name) { b.mode = name; b.modeT = 0; b.set = false; }
  }

  // ---- the policies ----

  function vigil(S, b, f) {
    const p = S.player, life = lifeShare(S), tolled = p.condT[TOLLED] > 0, gate = S.gate;
    b.modeT += DT;
    // Tolled-for: the far lychgate, whatever it costs
    if (tolled && gate && gate.far) {
      b.why = 'tolled';
      toward(S, gate.x, gate.y, dir);
      steer(S, b, f, dir.x, dir.y, 1);
      return;
    }
    // out of a Swell about to land
    const swell = swellAt(S, p.x, p.y, SWELL_MARGIN, SWELL_SOON);
    if (swell !== null) {                          // only as long as it stands in it: then back to what it was doing
      b.why = 'swell';
      escape(S, swell, dir);
      f.mx = dir.x;
      f.my = dir.y;
      return;
    }
    // ring down once the keeper is laid; before that only when life is low past the keeper's coming
    const laid = S.vigil && S.vigil.keeper === 2;
    if (gate && !gate.far && (laid || (life < RING_DOWN_LOW && S.toll >= S.rules.keeperToll))) {
      b.why = 'ring';
      const d = toward(S, gate.x, gate.y, dir), r = S.rules.gateRadius;
      if (d > r * 0.5) steer(S, b, f, dir.x, dir.y, d > 2 ? 1 : 0.5);
      return;
    }
    // otherwise it does not stand in a lychgate: standing there would ring it down
    if (gate && !gate.far) {
      const d = toward(S, gate.x, gate.y, dir), r = S.rules.gateRadius + 0.6;
      if (d < r) { b.why = 'gate'; f.mx = -dir.x; f.my = -dir.y; return; }
    }
    // a favour standing: the best liked
    const shape = favourShape(S);
    if (shape !== null) {
      b.why = 'favour';
      toward(S, shape.x, shape.y, dir);
      steer(S, b, f, dir.x, dir.y, 1);
      return;
    }
    // out of the arc of a large body winding up a Blow at it, for as long as the wind-up lasts; Braced and not low,
    // it takes the Blow at half and stays on its wound
    const braced = typeof Dmg.POSE === 'object' && p.pose === Dmg.POSE.braced;
    if ((!braced || life < DODGE_BELOW) && blowComing(S, dir)) {
      b.why = 'blow';
      f.mx = dir.x;
      f.my = dir.y;
      return;
    }
    b.why = b.mode;
    fight(S, b, f, life);
  }

  // a large body near the end of a Blow's wind-up with the player in reach of it: the way out, into out
  function blowComing(S, out) {
    const p = S.player, n = S.grid.query(p.x, p.y, 3.5, near);
    for (let i = 0; i < n; i++) {
      const e = near[i];
      if (!e.alive || e.state !== 1 || e.a1 - e.stateT > 0.45 || !(e.def.size === 'large' || e.rank >= 1)) continue;
      const dx = p.x - e.x, dy = p.y - e.y, d = sqrt(dx * dx + dy * dy) || 1;
      if (abs(Core.angleDiff(e.a0, atan2(dy, dx))) > 1.4) continue;
      out.x = dx / d; out.y = dy / d;                // straight away from it
      return true;
    }
    return false;
  }

  function favourShape(S) {
    const items = S.pickups.items;
    let best = null, score = -Infinity;
    for (let i = 0; i < S.pickups.n; i++) {
      const o = items[i];
      if (!o.alive || o.kind !== 3 || !o.item) continue;
      const liked = LIKED[o.item.id] || 1, d = Core.dist(o.x, o.y, S.player.x, S.player.y), s = liked - d * 0.2;
      if (s > score) { score = s; best = o; }
    }
    return best;
  }

  // the wound to hold on: the nearest within a few steps; else, when free to go, the oldest past OLD seconds within
  // MEND_REACH, else the nearest within it, where the dead are few
  function woundToHold(S, free) {
    const w = S.wounds, p = S.player;
    if (!w || w.n === 0) return -1;
    // a wound is worth the walk when it holds a twenty-fifth of greatest life (or 2), or a little and is old; none
    // in an open lychgate, where standing would ring it down
    const worth = Math.max(2, 0.04 * (S.sheet ? S.sheet.stats['life-max'] : 60)), g = S.gate, gr = S.rules.gateRadius + 0.6;
    let best = -1, d = STEP_BACK * STEP_BACK;
    for (let i = 0; i < w.n; i++) {
      if (g !== null && !g.far && Core.dist2(w.x[i], w.y[i], g.x, g.y) < gr * gr) continue;
      if (!(w.life[i] >= worth || (w.life[i] > 1 && S.t - w.opened[i] > OLD))) continue;
      const k = Core.dist2(w.x[i], w.y[i], p.x, p.y);
      // a wound the dead stand on cannot be reached: the crowd holds it off
      if (k < d && (k < 0.36 || crowd(S, w.x[i], w.y[i], 1.2) <= 1)) { d = k; best = i; }
    }
    if (best >= 0 || !free) return best;
    let old = -1, nearest = -1, dn = MEND_REACH * MEND_REACH;
    for (let i = 0; i < w.n; i++) {
      if (g !== null && !g.far && Core.dist2(w.x[i], w.y[i], g.x, g.y) < gr * gr) continue;
      if (!(w.life[i] >= worth || (w.life[i] > 1 && S.t - w.opened[i] > OLD)) || crowd(S, w.x[i], w.y[i], MEND_CLEAR - 1) > 4) continue;
      const k = Core.dist2(w.x[i], w.y[i], p.x, p.y);
      if (k > MEND_REACH * MEND_REACH) continue;
      if (old < 0 && S.t - w.opened[i] > OLD) old = i;     // wounds are kept oldest first
      if (k < dn) { dn = k; nearest = i; }
    }
    return old >= 0 ? old : nearest;
  }

  // whether one of the dead that climbs onto the player (its def has an attack laying clung) is within reach
  function clingerNear(S, reach) {
    const p = S.player, n = S.grid.query(p.x, p.y, reach, near);
    for (let i = 0; i < n; i++) {
      const o = near[i];
      if (!o.alive || o.rank > 0) continue;
      const list = o.def.attacks;
      for (let j = 0; j < list.length; j++) {
        const a = typeof list[j] === 'string' ? (Defs.has('attack', list[j]) ? Defs.get('attack', list[j]) : null) : list[j];
        if (a !== null && a.ailment === 'clung') return true;
      }
    }
    return false;
  }

  // the nearest large body within reach (riders move onto it as the player strides past), not the keeper
  function largeNear(S, reach) {
    const p = S.player, n = S.grid.query(p.x, p.y, reach, near);
    let best = null, d = Infinity;
    for (let i = 0; i < n; i++) {
      const o = near[i];
      if (!o.alive || o === S.boss || !(o.def.size === 'large' || o.rank >= 1)) continue;
      const k = Core.dist2(o.x, o.y, p.x, p.y);
      if (k < d) { d = k; best = o; }
    }
    return best;
  }

  function fight(S, b, f, life) {
    const p = S.player, close = crowd(S, p.x, p.y, RING), thick = crowd(S, p.x, p.y, 1.4);
    // riders: stride past a large body, close beside it, and they move onto it
    if (p.condN[CLUNG] > 0 && b.mode !== 'break') {
      const big = largeNear(S, SHED_FAR);
      if (big !== null) {
        const side = b.round, ax = big.x - p.x, ay = big.y - p.y, d = sqrt(ax * ax + ay * ay) || 1;
        const off = big.r + p.r + 0.25, tx = big.x - ay / d * off * side, ty = big.y + ax / d * off * side;
        toward(S, tx + ax / d * 2, ty + ay / d * 2, dir);
        mode(b, 'shed');
        steer(S, b, f, dir.x, dir.y, 1);
        return;
      }
    }
    if (b.mode === 'shed') mode(b, 'hold');
    // the keeper is fought close, within the ring: with few of the dead about, it goes to it
    if (S.boss && S.boss.alive && close <= 1 && b.mode !== 'break' && b.mode !== 'rock') {
      const d = toward(S, S.boss.x, S.boss.y, dir);
      if (d > S.boss.r + KEEPER_NEAR) { b.why = 'keeper'; mode(b, 'hold'); steer(S, b, f, dir.x, dir.y, 0.8); b.modeT = 0; return; }
    }
    if (b.mode === 'break') {
      if (b.modeT < BREAK_TIME) { steer(S, b, f, cos(b.aim), sin(b.aim), 1); return; }
      mode(b, 'hold');
    }
    if (b.mode === 'rock') {
      // low life is no reason to run: standing Braced on its wound mends the crowd's Drag as it comes
      if (thick >= CROWD_TOO_THICK) {
        thinWay(S, dir);
        mode(b, 'break');
        steer(S, b, f, dir.x, dir.y, 1);
        return;
      }
      // a short burst of pulls (the first speaks twice with the bell set), then a stand to brace, mend and set it again
      if (close === 0 || b.modeT > (thick >= 5 || close >= 7 ? ROCK_MOST : ROCK_BURST)) { mode(b, 'hold'); return; }
      if (++b.flickT >= FLICK) { b.flickT = 0; b.flick = -b.flick; }
      f.mx = cos(b.aim) * b.flick;                  // back and forth along one line: every reversal a pull
      f.my = sin(b.aim) * b.flick;
      return;
    }
    if (b.mode === 'hold') {
      // stand: Braced, the bell sets in a second (or at once by the trade), and the crowd comes to where it stands
      if (thick >= CROWD_TOO_THICK) { thinWay(S, dir); mode(b, 'break'); steer(S, b, f, dir.x, dir.y, 1); return; }
      // it holds its ground on an open wound when one lies near, so that every pause between pulls mends: always
      // one within a few steps, and, with few of the dead about, one farther off, the nearest to scarring first
      const w = life < MEND_BELOW ? woundToHold(S, close <= 4) : -1;
      if (w >= 0) {
        const reach = S.sheet ? S.sheet.stats['mend-reach'] : 1, d = toward(S, S.wounds.x[w], S.wounds.y[w], dir);
        if (d > reach * 0.85) { b.why = 'wound'; steer(S, b, f, dir.x, dir.y, d > reach + 0.5 ? 1 : 0.5); b.modeT = 0; return; }
      }
      if (!b.set && close >= 1 && typeof p.tradeCd === 'number' && p.tradeCd <= 0 && !p.setBell) { f.trade = true; b.set = true; }
      // a hanger-on near enough to leap on is met with pulls, whose ring takes it before it climbs
      if ((close >= 3 && b.modeT >= SET_TIME) || thick >= PRESSED || clingerNear(S, CLINGER_NEAR)) {
        const at = b.aim;
        mode(b, 'rock');
        b.aim = at + PI / 2;
        b.flickT = FLICK >> 1;                      // the first flick is half as long: it rocks about where it stood
        return;
      }
      if (b.modeT > SEEK_AFTER && crowd(S, p.x, p.y, 9) === 0) mode(b, 'kite');
      return;
    }
    // kite: the round of the plaza, until the dead are near enough to stand for
    if (close >= 1 || (b.modeT > KITE_LEAST && crowd(S, p.x, p.y, 7) >= 3)) { mode(b, 'hold'); return; }
    round(S, b, dir);
    steer(S, b, f, dir.x, dir.y, 0.8);
  }

  Bot.input = function (S, policy) {
    const b = S.bot, f = b.frame, p = S.player;
    f.mx = 0; f.my = 0; f.ax = 1; f.ay = 0; f.aim = false; f.trade = false; f.heave = false;
    const name = policy || 'vigil';
    if (name === 'still' || !p.alive) return f;
    if (name === 'walk') {
      const a = S.t * 0.5;
      f.mx = cos(a) * 0.6;
      f.my = sin(a) * 0.6;
      return f;
    }
    vigil(S, b, f);
    const m2 = f.mx * f.mx + f.my * f.my;
    if (m2 > 1) { const m = sqrt(m2); f.mx /= m; f.my /= m; }
    return f;
  };

  Bot.choose = function () { return 0; };
})();
