// 11-damage.js: harm and protection. One hit of a voice on one of the dead and one hit on the player, step by step
// as docs/design/02-combat.md sets them out (sections 15.10 and 15.11); the Drag ticks (15.12); the times of the
// conditions every body carries, and the rules of this file that lay them (the turn rule, Sounded, Coiled, swing,
// the seal and Tolled-for); the dead's postures; the lee test and shoves.
// Owns: Dmg
// Public:
//   Dmg.hitEnemy(S, slot, e, part, ox, oy) -> H
//       Steps 2 to 10 of 15.10 for the voice in S.skills[slot] on the dead body e; step 1, the shape (and the lee of
//       a spreading Swell), is the archetype's. part: the archetype's share of a whole hit (1 for a whole hit; a
//       Drag zone's tick passes its quarter). (ox, oy): where the harm comes from, for the shove and for swing.
//       Returns H, the life it took. Emits 'hit'.
//   Dmg.harmEnemy(S, e, type, amount, ox, oy) -> H
//       Harm on one of the dead from no voice (a coined body's contact, a body going over, coils spent): guard,
//       harm taken and the water band, life, swing and the seal; no roll. type: a kind of harm, by index or id.
//   Dmg.hitPlayer(S, attack, source, scale, seen) -> life lost
//       Steps 2 to 10 of 15.11. attack: the Attack def (type, mult, id). source: anything with damage, x and y.
//       The harm is d = source.damage x attack.mult x scale for a body (an enemy, the keeper, a minion); a shot or an
//       area (it has a team) carries its harm in damage already, so for it d = source.damage x scale. scale: a
//       factor (the keeper's echo is 0.3). seen: the warning the player had, which is the wound's depth (a Blow's
//       wind-up, the whole fill of a Swell as shown, 0 for Drag). The caller has done step 1, the shape and the
//       lee. Emits 'hurt', and 'wound' through Player.wound.
//   Dmg.tick(S)                 phase 8, every 15th step: the Drag ticks of 15.12. The dead whose edge is within
//                               0.1 m of yours press you (damage x press / 4 each); each rider on you deals its Drag
//                               / 4, and riders on a large dead do the same to it; each Drag zone of the dead you
//                               stand in (an area of team 1 whose def's kind is 'zone') deals damage / 4; each area
//                               of a voice with a tick above 0 strikes every dead body inside it with part = tick.
//   Dmg.step(S)                 phase 5: every body's condition times (a seal holds every other one still), then
//                               the dead's postures from their steering velocity against their top speed on dry
//                               ground as it stands (their def's, less 8% a rider), their turn rule (headings every
//                               0.1 s), Sounded and Coiled on the large dead, and a body going over at full swing.
//                               Tolled-for that runs out ends the run 'died'.
//   Dmg.inLee(S, sx, sy, body, reach) -> boolean
//                               a prop with a collider, or a large body other than body, stands on the line from
//                               (sx, sy) to body within reach of body: not behind the body, not farther than reach
//                               from it, and not a body standing over (sx, sy) itself (the Swell's own caster)
//   Dmg.shove(S, body, dx, dy) -> metres moved
//                               moves a body by (dx, dy) (the player times shove-taken and less for its ballast),
//                               then out of colliders and inside the region (World.pushOut). 0.3 m or more ends
//                               Brace; any shove ends In Procession on the dead.
//   Dmg.lay(S, body, row, seconds, v, n) -> boolean
//                               lays a condition (a row of Stats.AILMENTS) with T, V and N; refused where the row
//                               spares the body, the body cannot carry it (on), the body is sealed, or still immune
//   Dmg.lift(S, body, row) -> boolean     ends one the body carries, unless the body is sealed (a seal itself lifts)
//   Dmg.carries(body, row) -> boolean     whether a body carries a condition: its T or its N is above 0
//   Dmg.inside(area, x, y, r) -> boolean  whether a body of radius r at (x, y) is inside an area's shape: an area of
//                               a voice by its own fields (len above 0: a lane of half-width r_area along angle;
//                               a3 above 0: a wedge of that opening round angle; else a circle), an area of the dead
//                               by its def's shape ('wedge' and 'arc' with def.angle, 'line' with len, else a circle)
//   Dmg.warning(S, source) -> seconds    added to the fill of a Swell aimed at the player: free Heed x 0.01 + warn
//                               (+ 0.3 when source is Sounded), at most 1. The Dial's shadow is the vigil's.
//   Dmg.large(e) -> boolean     its def's size is 'large', or its rank is elite or above
//   Dmg.POSE = {still: 0, braced: 1, moving: 2, striding: 3}    the values of the field pose
// Shared with 21-player.js, which runs the same rules for the player:
//   Dmg.posture(body, top, braceTime, share)   one step of a body's posture from its steering speed against top:
//                               still under 15%, Braced once still for braceTime; moving at 15% or more, Striding once
//                               at share (0..1) of top or more for 0.25 s. Sets stillT, strideT and pose.
//   Dmg.record(body, h)         a new heading record, newest first (heading0); NaN for a body too slow to have one
//   Dmg.turn(body, h, seconds, age0) -> degrees   the largest turn from heading h to the records at most seconds
//                               old, heading0 being age0 seconds old and each next one Dmg.SAMPLE steps older
//   Dmg.SAMPLE = 6              steps between two heading records (0.1 s)
//   Dmg.FAST = 0.3              the share of top speed above which a body records its heading
//
// Rows it names: wrong-footed (Stats.RULE.footing), in-procession, sounded, coiled, swing, sealed, tolled-for
// (reprieve) and clung (riders). The kinds it needs by their columns: the one Brace guards is the Blow (swing counts
// it), the one that ticks is the Drag. Events: 'hit' (x, y the body; a = H; b = the mask of kinds dealt), 'hurt'
// (x, y the player; a = the life lost, 0 while Tolled-for; b = the kind index; id = the attack's id, or null for a
// press, a rider or the ground). The fields it reads on bodies (stillT, strideT, pose, heading0 to heading4) and the
// slots 'wounds' and 'combat' are declared by 21-player.js, which loads after the kernel; 'voices' by 23-skills.js.
//
// Conventions of the condition arrays, beyond the comments of Stats.AILMENTS: a row with seconds lasts while its T is
// above 0, and when T runs out its V and N are cleared; a row with immune then holds T at -immune and counts it back
// up to 0, and cannot be laid again until it is there. Every place is dry until the Ropewalk brings the tide: the
// water band at a body's feet is 1, and t-in-water never holds.
(function () {
  'use strict';

  const DT = Core.DT, TAU = Core.TAU, PI = Math.PI;
  const sqrt = Math.sqrt, atan2 = Math.atan2, cos = Math.cos, sin = Math.sin, abs = Math.abs, asin = Math.asin;
  const DEG = 180 / PI, SLIVER = 1e-9;

  const POSE = Object.freeze({ still: 0, braced: 1, moving: 2, striding: 3 });
  const STILL = POSE.still, BRACED = POSE.braced, MOVING = POSE.moving, STRIDING = POSE.striding;
  Dmg.POSE = POSE;

  // ---- what the rules of the design fix (docs/design/02-combat.md, sections 1, 3, 4, 7 and 15) ----
  const STILL_SHARE = 0.15;      // under this share of top speed a body is still
  const STRIDE_HOLD = 0.25;      // seconds at stride-share before Striding holds
  const FAST_SHARE = 0.3;        // above this share of top speed a body records its heading
  const SAMPLE = 6;              // steps between two heading records (0.1 s); five are kept
  const BRACE_DEAD = 0.4, STRIDE_DEAD = 0.7, TURN_DEAD = 90;   // the dead's brace-time, stride-share, turn limit
  const NEAR = 3, FAR = 8;       // metres: t-near and t-far
  const PRESS_GAP = 0.1;         // metres between edges within which a body presses
  const QUERY_SLACK = 0.5;       // metres added to grid queries: the grid stands where the dead were at phase 3
  const SOUND_NEAR = 4, SOUND_FAR = 6, SOUND_AFTER = 0.5, SOUND_EARLY = 0.3;   // the band; seconds after leaving it;
                                                                               // seconds earlier its attacks show
  const COIL_REACH = 6, COIL_SPEND = 1.5;   // metres a circuit is walked within; a spent coil's share of the last hit
  const SWING_UP = 120, SWING_DOWN = 60;    // degrees off the last Blow that add one, or take one away
  const OVER = 4, OVER_KEEPER = 1, OVER_REACH = 1, OVER_HARM = 0.1, OVER_PLAYER = 2;   // going over
  const KEEPER_SHOVE = 0.25;     // keepers are shoved a quarter as far by a voice
  const RIDER_SLOW = 0.08;       // each rider takes 8% off a body's top speed (clung; 22-enemies.js slows it so)
  const TOLL_BLOW = 1, TOLL_TICK = 0.25;    // seconds of Tolled-for a Blow or Swell, and a Drag tick, take
  const WARN_PER_HEED = 0.01, WARN_MOST = 1;
  const FLASH_FALL = 6;          // a body's flash fades in a sixth of a second

  // ---- the tables ----
  const TYPES = Stats.TYPES, AILMENTS = Stats.AILMENTS, NK = TYPES.length, NA = AILMENTS.length;
  let BLOW = -1, DRAG = -1;
  for (let t = 0; t < NK; t++) {
    if (BLOW < 0 && TYPES[t].guard === 'brace') BLOW = t;
    if (DRAG < 0 && TYPES[t].ticks) DRAG = t;
  }
  const RULE = Stats.RULE;
  const FOOTING = RULE.footing, PROCESSION = RULE.procession, SOUNDING = RULE.sounding, COILING = RULE.coiling;
  const SWING = RULE.swing, REPRIEVE = RULE.reprieve, RIDERS = RULE.riders, SEALED = Stats.AILMENT.sealed;
  Core.assert(BLOW >= 0 && DRAG >= 0 && SEALED !== undefined && FOOTING !== undefined && REPRIEVE !== undefined,
    'Dmg: the tables lack a kind or a condition the rules of harm need');
  const ELITE = 1, MINIBOSS = 2, BOSS = 3;   // Sim's ranks; 20-sim.js loads after this file
  const bit = (id) => 1 << Stats.COND[id];
  const T_BRACED = bit('t-braced'), T_STRIDING = bit('t-striding'), T_LARGE = bit('t-large'), T_ELITE = bit('t-elite');
  const T_KEEPER = bit('t-keeper'), T_NEAR = bit('t-near'), T_FAR = bit('t-far');
  const AIL_BIT = AILMENTS.map((a) => (a.cond ? bit(a.cond) : 0));
  const KIND_TAGS = TYPES.map((t) => [t.id, t.ticks ? 'dot' : 'hit']);
  const SEAL_SHARE = AILMENTS[SEALED].amount ? AILMENTS[SEALED].amount[0] / 100 : 0.08;
  const TAKEN = 'taken';

  // scratch for the queries of each function; each is filled before it is read, and none is shared by a function
  // and one it calls while it walks its own
  const forLee = new Array(1024).fill(null), forProps = new Array(256).fill(null), forTick = new Array(1024).fill(null);
  const forZone = new Array(1024).fill(null), forOver = new Array(1024).fill(null);

  // ---- small helpers ----

  function carries(body, row) { return body.condT[row] > 0 || body.condN[row] > 0; }
  Dmg.carries = carries;

  function large(e) {
    return (e.def !== null && e.def !== undefined && e.def.size === 'large') || e.rank >= ELITE;
  }
  Dmg.large = large;

  const isElite = (e) => e.rank === ELITE || e.rank === MINIBOSS;
  const isKeeper = (e) => e.rank === BOSS;

  // whether the posture that guards a kind holds for a body: a Blow and Braced, a Drag and Striding
  function holds(body, type) {
    return type.guard === 'brace' ? body.pose === BRACED : type.guard === 'stride' ? body.pose === STRIDING : false;
  }

  // the water band at a place: dry ground everywhere until the Ropewalk (02-combat.md, sections 6 and 15.13)
  function band() { return 1; }

  // a dead body's guard against a kind: its def's, else the kind's base
  function guardOf(e, t) {
    const g = e.def && e.def.guard ? e.def.guard[TYPES[t].id] : undefined;
    return g === undefined ? TYPES[t].guardBase : g;
  }

  // what harm of a kind is multiplied by on a dead body: its traits' modifiers of 'taken' for that kind's tags
  // (a modifier with a condition is left out: nothing about a body changes how it takes harm in Stage 1)
  function takenOf(e, t) {
    if (!(e.traitN > 0)) return 1;
    let flat = 0, inc = 0, more = 1;
    const tags = KIND_TAGS[t];
    for (let i = 0; i < e.traitN; i++) {
      const mods = e.traits[i] && e.traits[i].mods;
      for (let j = 0; mods && j < mods.length; j++) {
        const m = mods[j];
        if (m.stat !== TAKEN || m.cond !== undefined || !fits(m.tags, tags)) continue;
        const v = typeof m.value === 'number' ? m.value : Stats.scaled(m.value, 1);
        if (m.op === 'flat') flat += v;
        else if (m.op === 'inc') inc += v;
        else if (m.op === 'more') more *= v > -100 ? 1 + v / 100 : 0;
      }
    }
    const base = Stats.stat(TAKEN).base, v = (base + flat) * (inc > -100 ? 1 + inc / 100 : 0) * more;
    return v > 0 ? v / base : 0;
  }
  function fits(few, many) {
    if (few === undefined) return true;
    for (let i = 0; i < few.length; i++) if (many.indexOf(few[i]) < 0) return false;
    return true;
  }

  // the condition mask of a dead body struck by a voice (15.10): its posture, size, rank, distance and conditions
  function maskOf(S, e) {
    let m = 0;
    if (e.pose === BRACED) m |= T_BRACED;
    else if (e.pose === STRIDING) m |= T_STRIDING;
    if (large(e)) m |= T_LARGE;
    if (isElite(e)) m |= T_ELITE;
    if (isKeeper(e)) m |= T_KEEPER;
    const p = S.player, dx = e.x - p.x, dy = e.y - p.y, edge = sqrt(dx * dx + dy * dy) - e.r;
    if (edge <= NEAR) m |= T_NEAR;
    else if (edge > FAR) m |= T_FAR;
    for (let r = 0; r < NA; r++) if (AIL_BIT[r] !== 0 && carries(e, r)) m |= AIL_BIT[r];
    return m;
  }

  // ---- conditions ----

  // what never carries a row, and who cannot: true when the row passes this body by
  function spared(S, body, a) {
    if (body === S.player) return a.on === 'dead';
    if (a.on === 'player') return true;
    const sp = a.spares;
    for (let i = 0; sp && i < sp.length; i++) {
      const w = sp[i], big = large(body);
      if ((w === 'small' && !big) || (w === 'large' && big) || (w === 'elite' && isElite(body)) || (w === 'keeper' && isKeeper(body))) return true;
    }
    return false;
  }

  function stacksOf(S, body, a) {
    if (body === S.player && a.playerStacks !== undefined) return a.playerStacks;
    if (isKeeper(body) && a.keeperStacks !== undefined) return a.keeperStacks;
    return a.stacks;
  }

  // a rule's own laying: refused only where the row spares the body or the body is sealed
  function put(S, body, row, seconds, v, n) {
    const a = AILMENTS[row];
    if (spared(S, body, a) || (body.condT[SEALED] > 0 && row !== SEALED)) return false;
    const most = stacksOf(S, body, a);
    body.condT[row] = seconds;
    body.condV[row] = v;
    body.condN[row] = most !== undefined && n > most ? most : n;
    return true;
  }

  function immune(body, row, a) {
    const t = body.condT[row];
    if (t < 0) return true;                                  // the time after it ended
    return a.immune !== undefined && a.seconds === undefined && t > 0;   // a crust that takes nothing new (brined)
  }

  Dmg.lay = function (S, body, row, seconds, v, n) {
    const a = AILMENTS[row];
    if (a === undefined || body.condT[SEALED] > 0 || immune(body, row, a)) return false;
    return put(S, body, row, seconds > 0 ? seconds : 0, v || 0, n > 0 ? n : 0);
  };

  Dmg.lift = function (S, body, row) {
    const a = AILMENTS[row];
    if (a === undefined || (body.condT[SEALED] > 0 && row !== SEALED) || !carries(body, row)) return false;
    body.condT[row] = a.immune !== undefined && a.seconds !== undefined ? -a.immune : 0;
    body.condV[row] = 0;
    body.condN[row] = 0;
    return true;
  };

  // one step of every condition time of a body: a seal holds every other one still
  function times(S, b) {
    const T = b.condT, sealed = T[SEALED] > 0;
    for (let r = 0; r < NA; r++) {
      const t = T[r];
      if (t === 0 || (sealed && r !== SEALED)) continue;
      if (t < 0) { T[r] = t + DT < -SLIVER ? t + DT : 0; continue; }
      if (t > DT + SLIVER) { T[r] = t - DT; continue; }
      T[r] = 0;
      ended(S, b, r);
    }
  }

  function ended(S, b, r) {
    if (r === REPRIEVE && b === S.player) { Sim.end(S, 'died'); return; }   // the toll rang for you
    const a = AILMENTS[r];
    if (a.seconds === undefined) return;            // its T was only a count (a halt, a crust)
    b.condV[r] = 0;
    b.condN[r] = 0;
    if (a.immune !== undefined) b.condT[r] = -a.immune;
  }

  // ---- posture and the turn rule ----

  // still under 15% of top speed, Braced once still for braceTime; moving at 15% or more, Striding once at the
  // share or more for 0.25 s. The speed is the steering speed: shoves and separation are not movement.
  function posture(b, top, braceTime, share) {
    const v2 = b.vx * b.vx + b.vy * b.vy, still = STILL_SHARE * top;
    if (!(top > 0) || v2 < still * still) {
      b.stillT += DT;
      b.strideT = 0;
      b.pose = b.stillT >= braceTime - SLIVER ? BRACED : STILL;
    } else {
      b.stillT = 0;
      const stride = share * top;
      b.strideT = v2 >= stride * stride - SLIVER ? b.strideT + DT : 0;
      b.pose = b.strideT >= STRIDE_HOLD - SLIVER ? STRIDING : MOVING;
    }
  }

  Dmg.posture = posture;
  Dmg.SAMPLE = SAMPLE;
  Dmg.FAST = FAST_SHARE;

  // the turn in degrees from a recorded heading a to h; a heading not recorded (NaN) is no turn
  function turnFrom(a, h) { return a === a ? abs(Core.angleDiff(a, h)) * DEG : 0; }

  // the largest turn from h to the headings recorded at most `seconds` ago, heading0 being age0 seconds old and each
  // next one SAMPLE steps older
  function turn(b, h, seconds, age0) {
    const gap = SAMPLE / Core.HZ, last = seconds + SLIVER;
    let most = 0, d;
    if (age0 <= last) { d = turnFrom(b.heading0, h); if (d > most) most = d; } else return most;
    if (age0 + gap <= last) { d = turnFrom(b.heading1, h); if (d > most) most = d; } else return most;
    if (age0 + 2 * gap <= last) { d = turnFrom(b.heading2, h); if (d > most) most = d; } else return most;
    if (age0 + 3 * gap <= last) { d = turnFrom(b.heading3, h); if (d > most) most = d; } else return most;
    if (age0 + 4 * gap <= last) { d = turnFrom(b.heading4, h); if (d > most) most = d; }
    return most;
  }
  Dmg.turn = turn;

  // a new heading record, newest first: h, or NaN for a body too slow to have one
  function record(b, h) {
    b.heading4 = b.heading3;
    b.heading3 = b.heading2;
    b.heading2 = b.heading1;
    b.heading1 = b.heading0;
    b.heading0 = h;
  }
  Dmg.record = record;

  // A dead body's top speed on dry ground as it stands: its def's, less what its riders take off it. Its posture and
  // its turn rule measure it against this, as the player's do (21-player.js).
  function topOf(b) {
    const n = b.condN[RIDERS];
    return n > 0 ? b.speed * (1 - RIDER_SLOW * n) : b.speed;
  }

  // The dead's turn rule, on the steps that record headings: a body above 30% of its top speed whose heading now
  // is more than 90 degrees from one of the last 0.5 s is Wrong-footed (0.5 s, keepers 0.25 s) unless it already
  // is. The record moves on whatever the speed, so a slow body's old headings age out.
  function footing(S, b) {
    const top = topOf(b), v2 = b.vx * b.vx + b.vy * b.vy, fast = top > 0 && v2 > FAST_SHARE * FAST_SHARE * top * top;
    let h = NaN;
    if (fast) {
      h = atan2(b.vy, b.vx);
      const most = b.condT[FOOTING] > 0 ? 0 : turn(b, h, 0.5, SAMPLE / Core.HZ);
      if (most > TURN_DEAD) {
        const a = AILMENTS[FOOTING];
        put(S, b, FOOTING, isKeeper(b) && a.keeperSeconds !== undefined ? a.keeperSeconds : a.seconds, most, 0);
      }
    }
    record(b, h);
  }

  // ---- the rules of the large dead: Sounded and Coiled ----

  // Kept 4 to 6 m from you for sound-time, it is Sounded (T 6, renewed while held); it ends 0.5 s after it leaves.
  function sounding(S, e, p, soundTime) {
    const dx = p.x - e.x, dy = p.y - e.y, d2 = dx * dx + dy * dy, a = AILMENTS[SOUNDING];
    if (d2 >= SOUND_NEAR * SOUND_NEAR && d2 <= SOUND_FAR * SOUND_FAR) {
      const held = e.condV[SOUNDING] + DT;
      e.condV[SOUNDING] = held < soundTime ? held : soundTime;
      if (held >= soundTime - SLIVER) e.condT[SOUNDING] = a.seconds;
    } else {
      e.condV[SOUNDING] = 0;
      if (e.condT[SOUNDING] > SOUND_AFTER) e.condT[SOUNDING] = SOUND_AFTER;
    }
  }

  // The angle you walk round it within 6 m, sunwise positive (from +x towards +y), from how the two moved this step.
  // A full sunwise circuit ties a coil (to 3; T 10 after the last); a full widdershins circuit spends every coil at
  // once, each a Blow worth 150% of the last hit of your strongest voice.
  function coiling(S, e, p) {
    const rx = p.x - e.x, ry = p.y - e.y, r2 = rx * rx + ry * ry;
    if (r2 > COIL_REACH * COIL_REACH || r2 < 1e-6) { e.condV[COILING] = 0; return; }
    const dx = (p.x - p.px) - (e.x - e.px), dy = (p.y - p.py) - (e.y - e.py);
    let v = e.condV[COILING] + (rx * dy - ry * dx) / r2;
    if (v >= TAU) {
      const a = AILMENTS[COILING], n = e.condN[COILING] + 1;
      v -= TAU;
      e.condN[COILING] = a.stacks !== undefined && n > a.stacks ? a.stacks : n;
      e.condT[COILING] = a.seconds;
    } else if (v <= -TAU) {
      v = 0;
      const coils = e.condN[COILING];
      if (coils > 0) {
        e.condN[COILING] = 0;
        e.condT[COILING] = 0;
        const blow = COIL_SPEND * strongestHit(S);
        for (let k = 0; k < coils && blow > 0; k++) Dmg.harmEnemy(S, e, BLOW, blow, p.x, p.y);
      }
    }
    e.condV[COILING] = v;
  }

  // The last hit of the strongest voice: the largest last hit any voice has landed, else the middle of the range
  // of the voice with the largest one.
  function strongestHit(S) {
    const v = S.voices, skills = S.skills;
    let most = 0;
    for (let i = 0; v && i < skills.length && i < v.lastHit.length; i++) if (v.lastHit[i] > most) most = v.lastHit[i];
    if (most > 0) return most;
    for (let i = 0; i < skills.length; i++) {
      const ss = skills[i].sheet;
      for (let t = 0; ss && t < NK; t++) if ((ss.min[t] + ss.max[t]) / 2 > most) most = (ss.min[t] + ss.max[t]) / 2;
    }
    return most;
  }

  // ---- swing ----

  // A Blow more than 120 degrees off the last Blow's direction adds one, one within 60 degrees takes one away; the
  // first only notes its direction. A V and N of 0 is a body never struck by a Blow (a first direction of exactly 0
  // is kept as a hair above it).
  function swingCount(body, dir) {
    if (body.condT[SEALED] > 0) return;
    const n = body.condN[SWING], v = body.condV[SWING];
    if (n !== 0 || v !== 0) {
      const off = abs(Core.angleDiff(v, dir)) * DEG;
      if (off > SWING_UP) body.condN[SWING] = n + 1;
      else if (off <= SWING_DOWN && n > 0) body.condN[SWING] = n - 1;
    }
    body.condV[SWING] = dir === 0 ? 1e-9 : dir;
  }

  function swingMost(S, body) { return stacksOf(S, body, AILMENTS[SWING]); }

  // At full swing a dead body goes over: thrown 4 m along the last Blow (keepers 1 m), it strikes each of the dead
  // within 1 m of its path with a Blow worth 10% of its own greatest life, and its swing returns to 0.
  function over(S, e) {
    const dir = e.condV[SWING], far = isKeeper(e) ? OVER_KEEPER : OVER, x0 = e.x, y0 = e.y;
    e.condN[SWING] = 0;
    Dmg.shove(S, e, cos(dir) * far, sin(dir) * far);
    const x1 = e.x, y1 = e.y, lx = x1 - x0, ly = y1 - y0, len2 = lx * lx + ly * ly, half = sqrt(len2) / 2;
    const n = S.grid.query((x0 + x1) / 2, (y0 + y1) / 2, half + OVER_REACH + QUERY_SLACK, forOver), harm = OVER_HARM * e.lifeMax;
    for (let i = 0; i < n; i++) {
      const o = forOver[i];
      if (o === e || !o.alive || !(o.life > 0)) continue;
      let s = len2 > 0 ? ((o.x - x0) * lx + (o.y - y0) * ly) / len2 : 0;
      s = s < 0 ? 0 : s > 1 ? 1 : s;
      const qx = x0 + lx * s - o.x, qy = y0 + ly * s - o.y, reach = OVER_REACH + o.r;
      if (qx * qx + qy * qy <= reach * reach) Dmg.harmEnemy(S, o, BLOW, harm, x0, y0);
    }
  }

  // ---- a hit on one of the dead ----

  // after the life: a seal the body had broken by a heavy hit, then swing for a Blow (a seal laid by this very hit
  // comes after, from the caller)
  function sealShare(body) { return body.condV[SEALED] > 0 ? body.condV[SEALED] : SEAL_SHARE; }

  function afterHit(S, e, kinds, H, ox, oy) {
    if (e.condT[SEALED] > 0 && H >= sealShare(e) * e.lifeMax) Dmg.lift(S, e, SEALED);
    if ((kinds >>> BLOW) & 1) swingCount(e, atan2(e.y - oy, e.x - ox));
  }

  // moves a dead body dist metres away from (ox, oy) (away from the player if it stands there)
  function away(S, e, ox, oy, dist) {
    let dx = e.x - ox, dy = e.y - oy, d = sqrt(dx * dx + dy * dy);
    if (d < 1e-6) { dx = e.x - S.player.x; dy = e.y - S.player.y; d = sqrt(dx * dx + dy * dy); }
    if (d < 1e-6) { dx = 1; dy = 0; d = 1; }
    Dmg.shove(S, e, dx / d * dist, dy / d * dist);
  }

  Dmg.hitEnemy = function (S, slot, e, part, ox, oy) {
    const sk = S.skills[slot], ss = sk ? sk.sheet : null;
    if (ss === null || ss === undefined || !e.alive || !(e.life > 0)) return 0;
    const m = maskOf(S, e), rng = S.rng.combat, top = carries(e, SOUNDING);
    const train = carries(e, PROCESSION) ? 1 + S.sheet.stats['procession-bonus'] / 100 : 1;
    const foot = e.condT[FOOTING] > 0 ? 1 + ss['wrong-foot'] / 100 : 1;
    let H = 0, kinds = 0;
    for (let t = 0; t < NK; t++) {
      if (!(ss.max[t] > 0)) continue;
      const type = TYPES[t], r = top ? 1 : rng.next();                                      // 2 roll
      let h = (ss.baseMin[t] + r * (ss.baseMax[t] - ss.baseMin[t])) * Stats.hitMult(ss, t, m) * part;   // 3 attacker
      h *= train * foot;                                                                       // 4 train, 5 footing
      if (!type.bare) {
        if (holds(e, type)) {                                                                  // 6 guard
          const g = guardOf(e, t), cap = type.guardMax, through = ss.through[t];
          h *= 1 - (g < cap ? g : cap) * (1 - through / 100) / 100;
        }
        h *= takenOf(e, t);                                                                    // 7 taken
        if (type.ticks) h *= band(S, e.x, e.y);
      }
      if (h > 0) { H += h; kinds |= 1 << t; }
    }
    if (H > 0) {                                                                               // 8 life
      e.life -= H;
      e.flash = 1;
      Sim.emit(S, 'hit', e.x, e.y, H, kinds, null);
      const v = S.voices;
      if (v && slot < v.lastHit.length) v.lastHit[slot] = H;
    }
    if (ss.shove > 0) away(S, e, ox, oy, ss.shove * (isKeeper(e) ? KEEPER_SHOVE : 1));      // 9 shove
    afterHit(S, e, kinds, H, ox, oy);                                                          // 10 conditions
    for (let r = 0; r < NA; r++) {
      const chance = ss.ailChance[r];
      if (!(chance > 0) || rng.next() * 100 >= chance) continue;
      const a = AILMENTS[r], most = stacksOf(S, e, a);
      const v = a.amount !== undefined ? a.amount[0] / 100 : e.face;
      const n = most !== undefined ? e.condN[r] + 1 : 0;
      Dmg.lay(S, e, r, (a.seconds || 0) * ss.ailDuration[r], v, n);
    }
    return H;
  };

  Dmg.harmEnemy = function (S, e, type, amount, ox, oy) {
    const t = typeof type === 'number' ? type : Stats.TYPE[type], kind = TYPES[t];
    if (kind === undefined || !e.alive || !(e.life > 0) || !(amount > 0)) return 0;
    let h = amount;
    if (!kind.bare) {
      if (holds(e, kind)) { const g = guardOf(e, t), cap = kind.guardMax; h *= 1 - (g < cap ? g : cap) / 100; }
      h *= takenOf(e, t);
      if (kind.ticks) h *= band(S, e.x, e.y);
    }
    if (!(h > 0)) return 0;
    e.life -= h;
    e.flash = 1;
    Sim.emit(S, 'hit', e.x, e.y, h, 1 << t, null);
    afterHit(S, e, 1 << t, h, ox, oy);
    return h;
  };

  // ---- a hit on the player ----

  // Falling to no life: Tolled-for once a vigil, until the next toll; a second fall is death. A seal does not hold
  // back a fall: it breaks first.
  function fall(S, p) {
    p.life = 0;
    const c = S.combat;
    if (c && !c.reprieved) {
      c.reprieved = true;
      if (p.condT[SEALED] > 0) Dmg.lift(S, p, SEALED);
      put(S, p, REPRIEVE, (S.tollAt - S.step) / Core.HZ, 0, 0);
    } else {
      Sim.end(S, 'died');
    }
  }

  // steps 2 to 10 of 15.11 with the harm d worked out
  function hurt(S, t, d, id, seen, sx, sy) {
    const p = S.player, kind = TYPES[t];
    if (!p.alive || S.phase === 'ended' || !(d > 0)) return 0;
    const sheet = S.sheet, st = sheet.stats;
    let h = d;                                                       // 2 a Swell is bare
    if (!kind.bare) {
      if (holds(p, kind)) h *= 1 - sheet.guard[t] / 100;             // 3 guard
      h *= sheet.taken[t];                                           // 4 taken, and the water band
      if (kind.ticks) h *= band(S, p.x, p.y);
    }
    if (p.condT[FOOTING] > 0) h *= 1 + st['wrong-foot-taken'] / 100;   // 5 footing
    if (p.condT[REPRIEVE] > 0) {                                     // 6 reprieve: time, not life
      const left = p.condT[REPRIEVE] - (kind.ticks ? TOLL_TICK : TOLL_BLOW);
      p.condT[REPRIEVE] = left > SLIVER ? left : 0;
      Sim.emit(S, 'hurt', p.x, p.y, 0, t, id);
      if (!(left > SLIVER)) Sim.end(S, 'died');
      return 0;
    }
    if (!(h > 0)) return 0;
    const before = p.life;                                           // 7 life
    p.life = before - h;
    const lost = p.life > 0 ? h : before > 0 ? before : 0;
    p.flash = 1;
    p.hurtT = S.t;
    if (lost > 0 && typeof Player.wound === 'function') Player.wound(S, lost, kind.ticks ? 0 : seen > 0 ? seen : 0);   // 8 wound
    if (p.condT[SEALED] > 0 && h >= sealShare(p) * st['life-max']) Dmg.lift(S, p, SEALED);   // 9 seal and swing
    if (t === BLOW) {
      const dir = atan2(p.y - sy, p.x - sx);
      swingCount(p, dir);
      if (p.condN[SWING] >= swingMost(S, p)) {
        p.condN[SWING] = 0;
        Dmg.shove(S, p, cos(dir) * OVER_PLAYER, sin(dir) * OVER_PLAYER);
      }
    }
    Sim.emit(S, 'hurt', p.x, p.y, lost, t, id);
    if (p.life <= 0) fall(S, p);                                     // 10 no life
    return lost;
  }

  Dmg.hitPlayer = function (S, attack, source, scale, seen) {
    const t = typeof attack.type === 'number' ? attack.type : Stats.TYPE[attack.type];
    if (TYPES[t] === undefined || source === null || source === undefined) return 0;
    const flown = source.team !== undefined, mult = flown ? 1 : attack.mult;     // a shot or an area: its damage is the harm
    const d = source.damage * (mult === undefined ? 1 : mult) * (scale === undefined ? 1 : scale);
    return hurt(S, t, d, attack.id === undefined ? null : attack.id, seen, source.x, source.y);
  };

  // ---- the Drag ticks ----

  Dmg.tick = function (S) {
    const p = S.player;
    if (p.alive && S.phase !== 'ended') {
      // the dead touching you press you
      const n = S.grid.near(p, PRESS_GAP + QUERY_SLACK, forTick);
      for (let i = 0; i < n; i++) {
        const e = forTick[i], press = e.def ? e.def.press : 0;
        if (!e.alive || !(e.life > 0) || !(press > 0)) continue;
        const dx = e.x - p.x, dy = e.y - p.y, gap = sqrt(dx * dx + dy * dy) - e.r - p.r;
        if (gap <= PRESS_GAP + SLIVER) hurt(S, DRAG, e.damage * press / 4, null, 0, e.x, e.y);
      }
      // the riders on you
      const riders = p.condN[RIDERS], each = p.condV[RIDERS] / 4;
      for (let k = 0; k < riders && each > 0; k++) hurt(S, DRAG, each, null, 0, p.x, p.y);
      // the Drag zones of the dead you stand in
      const areas = S.areas.items;
      for (let i = 0; i < S.areas.n; i++) {
        const a = areas[i];
        if (!a.alive || a.team !== 1 || a.def === null || a.def.kind !== 'zone' || !(a.damage > 0)) continue;
        if (!Dmg.inside(a, p.x, p.y, p.r)) continue;
        const t = Stats.TYPE[a.def.type];
        hurt(S, t === undefined ? DRAG : t, a.damage / 4, a.def.id, 0, a.x, a.y);
      }
    }
    // riders on the large dead
    const enemies = S.enemies.items;
    for (let i = 0; i < S.enemies.n; i++) {
      const e = enemies[i];
      if (e.alive && e.condN[RIDERS] > 0 && large(e)) Dmg.harmEnemy(S, e, DRAG, e.condN[RIDERS] * e.condV[RIDERS] / 4, e.x, e.y);
    }
    // the voices' Drag zones: every dead body inside, through the steps of 15.10
    const areas = S.areas.items;
    for (let i = 0; i < S.areas.n; i++) {
      const a = areas[i];
      if (!a.alive || a.team !== 0 || !(a.tick > 0) || a.skill < 0 || a.skill >= S.skills.length) continue;
      const reach = (a.len > 0 ? a.len : 0) + a.r + QUERY_SLACK;
      const m = S.grid.query(a.x, a.y, reach, forZone);
      for (let k = 0; k < m; k++) {
        const e = forZone[k];
        if (e.alive && e.life > 0 && Dmg.inside(a, e.x, e.y, e.r)) Dmg.hitEnemy(S, a.skill, e, a.tick, a.x, a.y);
      }
    }
  };

  // ---- shapes and lee ----

  Dmg.inside = function (a, x, y, r) {
    const dx = x - a.x, dy = y - a.y;
    let shape = 0, open = 0;                     // 0 a circle, 1 a wedge, 2 a lane
    if (a.team === 0) {
      if (a.len > 0) shape = 2;
      else if (a.a3 > 0) { shape = 1; open = a.a3; }
    } else if (a.def !== null && a.def !== undefined) {
      const s = a.def.shape;
      if ((s === 'wedge' || s === 'arc') && a.def.angle > 0) { shape = 1; open = a.def.angle; }
      else if (s === 'line' && a.len > 0) shape = 2;
    }
    if (shape === 2) {
      const ux = cos(a.angle), uy = sin(a.angle), along = dx * ux + dy * uy, across = dy * ux - dx * uy;
      return along >= -r && along <= a.len + r && abs(across) <= a.r + r;
    }
    const d2 = dx * dx + dy * dy, reach = a.r + r;
    if (d2 > reach * reach) return false;
    if (shape === 0) return true;
    const d = sqrt(d2);
    if (d <= r) return true;                       // it stands over the source
    const off = abs(Core.angleDiff(a.angle, atan2(dy, dx)));
    return off <= open / 2 + asin(r / d < 1 ? r / d : 1);
  };

  // whether a circle (cx, cy, cr) stands on the stretch of the line from the source within reach of the body
  function blocks(sx, sy, ux, uy, d, from, cx, cy, cr) {
    const ox = cx - sx, oy = cy - sy;
    if (ox * ox + oy * oy <= cr * cr) return false;          // a body standing over the source is its own caster
    const s = ox * ux + oy * uy;
    if (s >= d) return false;                                // level with the body or behind it
    const t = s < from ? from : s, qx = sx + ux * t - cx, qy = sy + uy * t - cy;
    return qx * qx + qy * qy <= cr * cr;
  }

  Dmg.inLee = function (S, sx, sy, body, reach) {
    const dx = body.x - sx, dy = body.y - sy, d = sqrt(dx * dx + dy * dy);
    if (d < 1e-9 || !(reach > 0)) return false;
    const ux = dx / d, uy = dy / d, from = d > reach ? d - reach : 0;
    const np = World.propsNear(S, body.x, body.y, reach, forProps);
    for (let i = 0; i < np; i++) {
      const q = forProps[i];
      if (q.r > 0 && blocks(sx, sy, ux, uy, d, from, q.x, q.y, q.r)) return true;
    }
    const ne = S.grid.query(body.x, body.y, reach + QUERY_SLACK, forLee);
    for (let i = 0; i < ne; i++) {
      const e = forLee[i];
      if (e === body || !e.alive || !(e.life > 0) || !large(e)) continue;
      if (blocks(sx, sy, ux, uy, d, from, e.x, e.y, e.r)) return true;
    }
    return false;
  };

  // ---- shoves ----

  Dmg.shove = function (S, body, dx, dy) {
    let k = 1;
    if (body === S.player) {
      const st = S.sheet.stats, steady = S.haul.length * st['find-steady'] / 100;
      k = st['shove-taken'] / 100 * (1 - (steady < 0.6 ? steady : 0.6));
    }
    const x0 = body.x, y0 = body.y;
    body.x = x0 + dx * k;
    body.y = y0 + dy * k;
    World.pushOut(S, body);
    const mx = body.x - x0, my = body.y - y0, moved = sqrt(mx * mx + my * my);
    if (moved >= 0.3 - SLIVER) {
      body.stillT = 0;
      if (body.pose === BRACED) body.pose = STILL;
    }
    if (moved > 0 && body !== S.player && carries(body, PROCESSION)) Dmg.lift(S, body, PROCESSION);
    return moved;
  };

  // ---- warning ----

  // free Heed: heed-max less what the character's observances hold (none in the first vigil)
  function freeHeed(S) {
    let held = 0;
    const char = S.cfg.char, list = char && Array.isArray(char.observances) ? char.observances : null;
    for (let i = 0; list && i < list.length; i++) if (Defs.has('observance', list[i])) held += Defs.get('observance', list[i]).heed;
    const free = S.sheet.stats['heed-max'] - held;
    return free > 0 ? free : 0;
  }

  Dmg.warning = function (S, source) {
    let w = freeHeed(S) * WARN_PER_HEED + S.sheet.stats.warn;
    if (source && source.condT && carries(source, SOUNDING)) w += SOUND_EARLY;
    return w < 0 ? 0 : w > WARN_MOST ? WARN_MOST : w;
  };

  // ---- the step ----

  Dmg.step = function (S) {
    const p = S.player;
    if (p.alive) times(S, p);
    const items = S.enemies.items, sample = S.step % SAMPLE === 0, soundTime = S.sheet.stats['sound-time'];
    for (let i = 0; i < S.enemies.n; i++) {
      const e = items[i];
      if (!e.alive) continue;
      times(S, e);
      if (e.flash > 0) e.flash = e.flash > FLASH_FALL * DT ? e.flash - FLASH_FALL * DT : 0;
      posture(e, topOf(e), BRACE_DEAD, STRIDE_DEAD);
      if (sample) footing(S, e);
      if (e.condT[SEALED] > 0 || !(e.life > 0)) continue;
      if (large(e) && p.alive) {
        sounding(S, e, p, soundTime);
        coiling(S, e, p);
      }
      if (e.condN[SWING] >= swingMost(S, e)) over(S, e);
    }
    const minions = S.minions.items;
    for (let i = 0; i < S.minions.n; i++) if (minions[i].alive) times(S, minions[i]);
  };

})();
