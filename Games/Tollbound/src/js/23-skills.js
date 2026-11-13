// 23-skills.js: voices speaking, and the knots tied into them. Every voice of the loadout speaks by itself when its
// cooldown has run out, as its archetype and its target rule say; the Change-ringer's pull makes the first speak at
// once. The registry of archetypes, and what the archetypes share: the cast in hand (where a voice speaks from, at
// what part of its harm, with whose shape), finding the dead a voice aims at, striking every body a shape covers, and
// the areas a voice leaves on the ground (a Swell that fills before it lands, a Drag zone, the mark of a Blow). The
// registry of knot rules, and the rules of the knots of 35-knots.js, which act inside a cast.
// Owns: Skills
// Public:
//   Skills.archetype(name, {cast, step?})   registers an archetype and allows its name for voices
//                                (Defs.allow('archetype', name)). 24-archetypes.js registers ring, rap, bar, spark
//                                and cone.
//     cast(S, slot, forced) -> boolean   the voice in S.skills[slot] is ready: its cooldown has run out, its place
//                                is not silenced and the player is not Tolled-for. It speaks from Skills.C (below),
//                                strikes at once with Skills.hit, or makes areas and shots (team 0, owner 0, skill =
//                                slot, a ttl in seconds), and returns true if it spoke (its cooldown becomes 1 / rate)
//                                or false if it found nothing (it is asked again next step). forced: the pull asks, or
//                                a knot lets a saved cast go, and a voice that can speak with nothing in reach should
//                                (a ring round you rings).
//     step(S, thing, slot)       once a step for each live shot and area of team 0 whose skill is slot; the kernel
//                                removes it when its ttl runs out
//   Skills.step(S)               phase 6: the knots' trackers, then casting in place order (the knots may hurry a
//                                voice, hold it silent, save its casts and let them go, or answer them), then the
//                                voices' shots and areas. A 'cast' event for each voice that spoke: x, y where it
//                                spoke (Skills.where, else where it spoke from); a = the slot; id = the voice id.
//   Skills.speak(S, slot, times) -> boolean   makes a voice speak now, cooldown or not (its cooldown runs on as
//                                it was); times above 1 are spoken AGAIN seconds apart (12 steps after the step of
//                                the one before; a call between steps belongs to the step that follows). False when the
//                                place is empty, silenced (by ringing down, or by a knot's silence), or the player is
//                                Tolled-for, or the voice found nothing.
//   Skills.silenced(S, slot) -> boolean   the last S.ringing.silent voices of the loadout are silenced
//   Skills.AGAIN = 0.2           seconds between the strokes of a pull spoken twice
// For archetypes (and later voices' own):
//   Skills.C                     the cast in hand, one reused object, set before an archetype's cast and read during
//                                it: {slot, x, y, part, reach, shape, lent, point, px, py, lx, ly, passed, echo}.
//                                slot: the voice speaking (-1 between casts); (x, y): where it speaks from (the player,
//                                or where a knot has it speak: a stone, a corner, a figure left behind); part: what
//                                its harm is multiplied by in everything it makes; reach: what its reach and lengths are
//                                multiplied by; shape: the SkillSheet whose shape it speaks with (its own, or one a
//                                Second Voice lends), lent the slot of that sheet or -1; point: true when it is aimed
//                                at (px, py) whatever its target rule says (a Muffle's echo); (lx, ly): where it
//                                landed, which the archetype says with Skills.landed; passed: the archetype has let
//                                Passes Free's first body through itself; echo: it is a repeat (an answer, a cast let
//                                go) that rules which count casts or price them leave alone.
//   Skills.shape(S, slot, thing?) -> SkillSheet   the sheet whose params and sizes a voice speaks with: during its
//                                cast C.shape, for a thing it made the sheet of the slot the thing was lent by
//                                (thing.lent), else its own
//   Skills.landed(x, y)          the archetype says where its cast landed (Muffle's echo and Ringer's Fine read it)
//   Skills.hit(S, slot, e, part, ox, oy) -> H   one hit of the voice on the dead body e through the rules of its
//                                knots that act on each body struck (Resist, Handstroke, Clash), then Dmg.hitEnemy.
//                                0 when a knot spares the body.
//   Skills.knotRule(name, spec)  registers the rule a knot changes and allows its name for knots
//                                (Defs.allow('knotRule', name)). spec, every hook optional:
//                                  pace(S, slot, ss) -> factor   how fast the voice's cooldown runs down this step (1
//                                                                as it is; 0 holds the voice silent)
//                                  ready(S, slot, ss) -> boolean the voice is ready by itself: true when the rule
//                                                                takes the cast (it is not spoken now)
//                                  before(S, slot, ss, C) -> boolean   a cast is about to be made: the rule may change
//                                                                C; false leaves the cast out (it counts as spoken)
//                                  after(S, slot, ss, C)         a cast was made and spoke
//                                  step(S, slot, ss)             once a step while the voice may speak
//                                ss is the voice's SkillSheet: its knots' numbers are in ss.params, each at its
//                                knot's share (Stats.skillSheet). A rule that acts on the bodies struck or on the shape
//                                of a cast is read where it acts, from its params (see "The knots' rules" below).
//   Skills.kind(sheet) -> kind index      the kind of harm a voice deals (one, by the design), -1 for none
//   Skills.pick(S, rule, x, y, reach, count, out) -> n    up to count of the dead within reach of (x, y) by a
//                                target rule, into out: 'nearest', 'farthest', 'random' (S.rng.combat), 'densest'
//                                (most others within 2 m), 'aim' (the nearest within 30 degrees of the player's
//                                aim). Only bodies alive with life left.
//   Skills.point(S, slot, rule, reach, out) -> boolean    where a voice of that rule is aimed: out {x, y, body}.
//                                'self' where it speaks from; 'mark' the place the player last stood still 0.5 s
//                                (false until it has); 'crossing' where the player's step just crossed its own wake
//                                (false on any other step); 'step' where it speaks from, on the player's first step
//                                after standing still (false on any other); 'ahead' reach metres the way the player
//                                faces; 'aim' reach metres along the aim; the others the body they pick. A cast aimed
//                                at C.point is aimed there, whatever the rule (but 'self').
//   Skills.count(S, x, y, r) -> n          the dead with life left whose edge is within r of (x, y)
//   Skills.strike(S, slot, shape, part, lee, ox, oy) -> n   Skills.hit on every dead body inside shape (anything
//                                with the fields Dmg.inside reads for a voice's area: x, y, r, angle, len, a3), but
//                                not one in lee from (shape.x, shape.y) when lee is true; (ox, oy) is where the harm
//                                comes from. With Passes Free, the body nearest (shape.x, shape.y) is let through and
//                                the rest are struck harder. Returns how many stood inside it.
//   Skills.circle(S, slot, x, y, r, part, lee, ox, oy), Skills.wedge(S, slot, x, y, len, aim, open, part, lee),
//   Skills.lane(S, slot, x, y, aim, len, half, part, lee)   strike over a circle, a wedge (open: its opening,
//                                radians) and a lane (half: its half-width) -> n
//   Skills.area(S, slot, state, x, y, r, seconds) -> area | null   a voice's area: team 0, owner 0, skill = slot,
//                                state, ttl = seconds, t = 0, a1 = 1, lent = C.lent during a cast; def = the attack of
//                                the id of the voice whose shape it has, when content gives one (the shape the scene
//                                draws: kind, shape, angle), else null
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
// The target rules 'mark', 'crossing', 'step' and 'ahead' are added to the voices' words here. 'mark': the place
// where the player last stood still for 0.5 s or more, which moves only at the next such stop (Plumb's). Its slot:
// S.voices = {pend, pendAt, lastHit, marked, stop, markX, markY, markT}: the strokes of a pull still to come and the
// step the next is due, by place; the last hit each voice landed (Dmg.hitEnemy writes it; coils spend it); and the
// mark.
//
// The knots' rules (35-knots.js names them; every number named in params is the knot's, at its share; the others
// are the rule's own, below):
//   running-line   line-quick: percent faster while the player's heading has held within 15 degrees for a second;
//                  silent 0.7 s after any sharper turn
//   open-lead      every fourth cast is left out, a beat of silence one interval long (1.5 s at most), in which
//                  the player takes lead-damp percent less harm (Blow and Drag: a Swell is bare); two beats at once
//                  damp half as much again
//   quartered      it no longer speaks by itself: each cast it would have made is saved, quarter-most at most, and
//                  all are let go at each quarter of the toll interval, 0.1 s apart, from where the player stands
//   slip-knot      it no longer speaks by itself: while it is ready, each sharp corner the player turns (more than
//                  60 degrees within 0.5 s) ties one cast to that corner, slip-most at most, and its cooldown runs
//                  20% slower; when the player stops, every cast tied lands on its corner, oldest first, 0.1 s apart
//   back-splice    it speaks from a figure left where the player stood 2 s ago, which stays there while one of the
//                  dead stands within splice-hold metres of it and then jumps to the new place 2 s back; its
//                  cooldown runs 15% slower
//   stones-answer  each cast is answered 0.3 s later from the nearest obstacle within 6 m of the player, at
//                  answer-part percent; with no obstacle in reach the cast itself is 20% weaker
//   muffle         it speaks muffle-pace percent faster, but every second cast is an echo: aimed at the point
//                  opposite the last landing, mirrored through the player, at 30%; its reach is 20% less
//   passes-free    the first body a cast would strike is let through untouched and the others are struck free-more
//                  percent harder (24-archetypes.js and Skills.strike); a cast that meets one body only is wasted
//   resist         its first touch on a body bites resist-bite percent harder and waxes it: it never harms that body
//                  again until the next toll (Skills.hit)
//   handstroke     the bodies on the player's right of the line it walks (as it was 0.3 s ago, held while it
//                  stands) are struck hand-right percent harder, those on its left 70% less (Skills.hit)
//   clash          it strikes at half its harm, and leaves the other half on the body as a foil; when another Clash
//                  voice strikes that body within 0.25 s, the foil is paid at clash-pay percent (Skills.hit)
//   louvres        its cast becomes a cross of four lanes 2 m wide from where it speaks, one arm toward the bell-post,
//                  as long as its reach, louvre-more percent harder (Skills.cross, 24-archetypes.js)
//   balance        thrown things that reach the end of their flight stand there mouth-up for 4 s; each small body
//                  that passes rocks one (balance-rock percent more), and a large body tips it over onto itself
//                  (balance-fall percent more); on the way out they strike at half; 12 stand at most (24)
//   unlaid         each thrown thing flies as two strands 40 degrees apart at half its harm; where both strike
//                  bodies within 1.5 m of each other, they fit: unlaid-fit percent in a circle 1.5 m across (24)
//   ringers-fine   while coin is carried, each cast flings one coin out where it landed, lying until the next toll,
//                  and strikes fine-more percent harder; with none carried it strikes at half
//   second-voice   while the player stands still, its casts take the shape of the next voice of the loadout, with
//                  its own harm at second-voice percent; both voices are at 75%, and the lent one's own cooldown runs
//                  25% slower
// Their slot: S.knots (below, under "the knots' slot"). Fields declared here: on 'enemy' waxed and waxToll (Resist),
// clashT, clashS, clashH and clashK (Clash's foil); on 'shot' part (the share of its voice's harm it carries), lent
// (the slot whose shape it has, or -1), free (bodies it has let through), twin (Unlaid's other strand, a uid); on
// 'area' lent and part (the share of the voice's harm it was laid with).
(function () {
  'use strict';

  const DT = Core.DT, HZ = Core.HZ, PI = Math.PI;
  const atan2 = Math.atan2, cos = Math.cos, sin = Math.sin, abs = Math.abs, floor = Math.floor, round = Math.round;
  const SLIVER = 1e-9, DEG = 180 / PI;
  const PLACES = 6, AGAIN = 0.2, AGAIN_STEPS = Math.round(AGAIN * HZ), TICK = 0.25, LEE = 3;
  const FILL = 0, ZONE = 1, MARK = 2, LANDED = 3;
  const MARK_STILL = 0.5;        // seconds still that set the mark
  const DENSE = 2, AIM_CONE = PI / 6, SLACK = 0.5;   // metres; radians; metres added to grid queries
  const TICK_STEPS = 15;         // Sim.step calls Dmg.tick on the steps where S.step % 15 is 14
  const REPRIEVE = Stats.RULE.reprieve;

  // ---- what the knots' rules fix (the numbers a knot gives are its params) ----
  const SAMPLE = 6;              // steps between two samples of the player's heading (0.1 s), as its own records
  const TRACK = 10;              // samples kept: one second
  const FAST = 0.3;              // above this share of top speed the player has a heading
  const LINE_WITHIN = 15, LINE_HELD = 1, LINE_SILENT = 0.7;   // Running Line: degrees, seconds held, seconds silent
  const CORNER = 60, CORNER_SAMPLES = 5;                      // a sharp corner: degrees within 0.5 s
  const HAND_LAG = 3, HAND_LEFT = 0.7;                         // Handstroke: samples back (0.3 s); the left side's cut
  const LEAD_EVERY = 4, LEAD_BEAT = 1.5, LEAD_TWO = 1.5, LEAD_DEEPEST = 90;   // Open Lead
  const LET_GO = Math.round(0.1 * HZ);                         // steps between the casts a knot lets go together
  const QUARTER_MOST = 20, SLIP_MOST = 3, SLIP_SLOW = 1.2;     // Quartered and Slip-knot
  const SPLICE_BACK = 2, SPLICE_SLOW = 1.15;                   // Back-splice: seconds back; its slower cooldown
  const ANSWER_STEPS = Math.round(0.3 * HZ), ANSWER_REACH = 6, ANSWER_WEAK = 0.8, ANSWERS = 4;   // Stone's Answer
  const MUFFLE_ECHO = 0.3, MUFFLE_REACH = 0.8;                 // Muffle
  const CLASH_STOCK = 0.5, CLASH_WITHIN = 0.25;                // Clash
  const FINE_POOR = 0.5, FINE_R = 0.25;                        // Ringer's Fine: half harm with no coin; a coin's radius
  const SECOND_COST = 0.75, SECOND_SLOW = 1.25;                // Second Voice
  const WAKE_SKIP = 3;           // the newest places of the wake a crossing does not count (0.3 s)
  const COIN = 1;                // the pickup kind of coin

  const archetypes = Object.create(null), rules = Object.create(null);
  const forPick = new Array(1024).fill(null), forStrike = new Array(1024).fill(null), forDense = new Array(1024).fill(null);
  const forStone = new Array(256).fill(null);
  const dist = new Float64Array(1024), score = new Float64Array(1024);
  const SHAPE = { team: 0, def: null, x: 0, y: 0, r: 0, angle: 0, len: 0, a3: 0 };
  const BACK = { x: 0, y: 0 };
  let whereX = 0, whereY = 0, whereSet = false;

  // the cast in hand: set before every archetype's cast (say), read during it
  const C = {
    slot: -1, x: 0, y: 0, part: 1, reach: 1, shape: null, lent: -1, point: false, px: 0, py: 0, lx: 0, ly: 0, landed: false,
    passed: false, echo: false, muffled: false, fine: false, stone: false, sx: 0, sy: 0,
  };
  Skills.C = C;

  Defs.allow('target', 'mark', 'crossing', 'step', 'ahead');

  Sim.state('voices', function () {
    return {
      pend: new Float64Array(PLACES), pendAt: new Float64Array(PLACES), lastHit: new Float64Array(PLACES),
      marked: false, stop: false, markX: 0, markY: 0, markT: 0,
    };
  });

  // ---- the knots' slot ----
  // S.knots: what the knots' rules keep between steps.
  //   sheets, insts, hooks   the sheet and voice each place's rules were read from, and the rules with hooks
  //   pace                   how fast each place's cooldown ran this step (0: silent)
  //   head, hi, run          the player's headings, one every 0.1 s for a second (NaN while too slow), the newest's
  //                          index, and how many in a row it has had
  //   turning, turnAt, calmAt, straight   whether the heading has turned more than 15 degrees within the last second,
  //                          when it last began to, when it last stopped (or a run began), and the seconds it has
  //                          held within 15 degrees
  //   cornering, cornerStep, cornerX, cornerY   whether it is turning a sharp corner, and the step and place of the last
  //   line                   the heading Handstroke splits by
  //   stillWas, stopAt, stepAt, stepHeld   the player's stillT a step ago; the step it last stopped; the step it last
  //                          moved off after standing, and how long it had stood
  //   q, quarterAt           the quarter of the toll interval now, and the step the last one began
  //   crossChecked, crossStep, crossX, crossY   a crossing of the wake: the step last looked at, and the last found
  //   leadN, leadEnd, leadDamp, leadLive   Open Lead: casts counted, when each place's beat ends, how deep it damps,
  //                          and the beats counted at the last rebuild
  //   bank, outAt            casts saved (Quartered, Slip-knot) and the step the next is let go (-1: none)
  //   slipX, slipY, slipK    the corners Slip-knot tied casts to (SLIP_MOST a place), and the next to let go
  //   figX, figY, fig        Back-splice's figure, and whether it stands
  //   ansN, ansAt, ansX, ansY, ansPart   Stone's Answer: answers due (ANSWERS a place): when, from where, how strong
  //   muffN, muffX, muffY, muffSet   Muffle: casts counted, and where the last one that was not an echo landed
  //   lends, lentBy, second  Second Voice: the place each lends its shape from, the place it is lent to, and whether
  //                          a place is at Second Voice's cost
  Sim.state('knots', function (S) {
    const f = (n) => new Float64Array(n), hooks = [];
    for (let i = 0; i < PLACES; i++) hooks.push([]);
    const h = f(TRACK);
    h.fill(NaN);
    return {
      sheets: [null, null, null, null, null, null], insts: [null, null, null, null, null, null], hooks, pace: f(PLACES).fill(1),
      head: h, hi: 0, run: 0, turning: false, turnAt: -1e9, calmAt: 0, straight: 0,
      cornering: false, cornerStep: -1, cornerX: 0, cornerY: 0, line: S.player.face,
      stillWas: 0, stopAt: -1, stepAt: -1, stepHeld: 0, q: 0, quarterAt: -1,
      crossChecked: -1, crossStep: -1, crossX: 0, crossY: 0,
      leadN: f(PLACES), leadEnd: f(PLACES), leadDamp: f(PLACES), leadLive: 0,
      bank: f(PLACES), outAt: f(PLACES).fill(-1), slipX: f(PLACES * SLIP_MOST), slipY: f(PLACES * SLIP_MOST), slipK: f(PLACES),
      figX: f(PLACES), figY: f(PLACES), fig: f(PLACES),
      ansN: f(PLACES), ansAt: f(PLACES * ANSWERS), ansX: f(PLACES * ANSWERS), ansY: f(PLACES * ANSWERS), ansPart: f(PLACES * ANSWERS),
      muffN: f(PLACES), muffX: f(PLACES), muffY: f(PLACES), muffSet: f(PLACES),
      lends: f(PLACES).fill(-1), lentBy: f(PLACES).fill(-1), second: f(PLACES),
    };
  });

  Sim.field('enemy', 'waxed', 0);
  Sim.field('enemy', 'waxToll', -1);
  Sim.field('enemy', 'clashT', -1e9);
  Sim.field('enemy', 'clashS', -1);
  Sim.field('enemy', 'clashH', 0);
  Sim.field('enemy', 'clashK', 0);
  Sim.field('shot', 'part', 1);
  Sim.field('shot', 'lent', -1);
  Sim.field('shot', 'free', 0);
  Sim.field('shot', 'twin', 0);
  Sim.field('area', 'lent', -1);
  Sim.field('area', 'part', 1);

  // Open Lead's beat: the harm the player takes is damped while a beat lasts (a Swell is bare: it ignores taken)
  Sim.source(function (S, out) {
    const K = S.knots;
    if (!K) return;
    let deepest = 0, beats = 0;
    for (let i = 0; i < PLACES; i++) {
      if (!(K.leadEnd[i] > S.t + SLIVER)) continue;
      beats++;
      if (K.leadDamp[i] > deepest) deepest = K.leadDamp[i];
    }
    if (beats === 0 || !(deepest > 0)) return;
    const d = beats > 1 ? deepest * LEAD_TWO : deepest;
    out.push({ stat: 'taken', op: 'more', value: -(d < LEAD_DEEPEST ? d : LEAD_DEEPEST) });
  });

  Skills.FILL = FILL; Skills.ZONE = ZONE; Skills.MARK = MARK; Skills.LANDED = LANDED;
  Skills.TICK = TICK; Skills.LEE = LEE; Skills.AGAIN = AGAIN;

  Skills.archetype = function (name, spec) {
    Core.assert(typeof name === 'string' && spec && typeof spec.cast === 'function', 'Skills.archetype needs a name and {cast, step?}');
    Defs.allow('archetype', name);
    archetypes[name] = spec;
  };

  Skills.knotRule = function (name, spec) {
    Core.assert(typeof name === 'string' && name !== '' && spec && typeof spec === 'object', 'Skills.knotRule needs a name and a spec');
    Core.assert(rules[name] === undefined, 'Skills.knotRule: there are two rules named "' + name + '"');
    Defs.allow('knotRule', name);
    rules[name] = spec;
  };

  Skills.where = function (x, y) { whereX = x; whereY = y; whereSet = true; };
  Skills.landed = function (x, y) { C.lx = x; C.ly = y; C.landed = true; };

  Skills.kind = function (ss) {
    for (let t = 0; t < Stats.TYPES.length; t++) if ((ss.kinds >>> t) & 1) return t;
    return -1;
  };

  Skills.shape = function (S, slot, thing) {
    if (thing && thing.lent >= 0) {
      const lent = S.skills[thing.lent];
      if (lent && lent.sheet) return lent.sheet;
    } else if (!thing && C.slot === slot && C.shape !== null) return C.shape;
    return S.skills[slot].sheet;
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
    const sk = S.skills[slot], K = S.knots;
    return !sk || sk.inst === null || !sk.sheet || !(sk.sheet.rate > 0) || !S.player.alive ||
      S.player.condT[REPRIEVE] > 0 || Skills.silenced(S, slot) || (K && slot < PLACES && !(K.pace[slot] > 0));
  }

  // A cast of the voice in place slot, from (x, y), at part of its harm. echo: a repeat (an answer, a cast saved and
  // let go) that the rules which count or price casts leave alone. False when it found nothing; true when it spoke,
  // or when a knot left it out (that counts as spoken).
  function say(S, slot, forced, x, y, part, echo) {
    const sk = S.skills[slot], ss = sk.sheet, K = S.knots;
    C.slot = slot; C.x = x; C.y = y; C.part = part; C.reach = 1; C.shape = ss; C.lent = -1;
    C.point = false; C.px = x; C.py = y; C.lx = x; C.ly = y; C.landed = false; C.passed = false; C.echo = echo === true;
    C.muffled = false; C.fine = false; C.stone = false; C.sx = 0; C.sy = 0;
    if (K && slot < PLACES && K.second[slot] > 0) C.part *= SECOND_COST;
    const hooks = K && slot < PLACES ? K.hooks[slot] : null;
    let out = false;
    for (let i = 0; hooks !== null && i < hooks.length; i++) if (typeof hooks[i].before === 'function' && hooks[i].before(S, slot, ss, C) === false) out = true;
    if (out) { C.slot = -1; return true; }
    whereSet = false;
    let spoke = false;
    if (ss.params['louvre-more'] > 0 && typeof Skills.cross === 'function') spoke = Skills.cross(S, slot, forced);
    else {
      const arch = archetypes[C.shape.def.archetype];
      spoke = arch !== undefined && arch.cast(S, slot, forced) === true;
    }
    if (spoke) {
      Sim.emit(S, 'cast', whereSet ? whereX : C.x, whereSet ? whereY : C.y, slot, 0, sk.inst.id);
      for (let i = 0; hooks !== null && i < hooks.length; i++) if (typeof hooks[i].after === 'function') hooks[i].after(S, slot, ss, C);
    }
    C.slot = -1;
    return spoke;
  }

  Skills.speak = function (S, slot, times) {
    const p = S.player;
    if (quiet(S, slot) || S.phase === 'ended' || !say(S, slot, true, p.x, p.y, 1, false)) return false;
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

  // ---- what the knots read: the player's headings, stops, steps and the quarters ----

  function track(S, p, K) {
    const still = p.stillT > 0;
    if (still && !(K.stillWas > 0)) K.stopAt = S.step;
    if (!still && K.stillWas > 0) { K.stepAt = S.step; K.stepHeld = K.stillWas; }
    K.stillWas = p.stillT;
    const into = S.step - (S.tollAt - S.tollSteps), q = S.toll * 4 + floor(into * 4 / S.tollSteps);
    if (q !== K.q) { K.q = q; K.quarterAt = S.step; }
    if (S.step % SAMPLE !== 0) return;
    const top = S.sheet.stats['move-speed'], least = FAST * top, v2 = p.vx * p.vx + p.vy * p.vy;
    const h = top > 0 && v2 > least * least ? atan2(p.vy, p.vx) : NaN;
    K.hi = (K.hi + 1) % TRACK;
    K.head[K.hi] = h;
    if (h !== h) { K.run = 0; K.turning = false; K.cornering = false; K.straight = 0; return; }
    K.run++;
    let most = 0, half = 0;
    for (let k = 1; k < TRACK && k < K.run; k++) {
      const d = abs(Core.angleDiff(K.head[(K.hi - k + TRACK) % TRACK], h)) * DEG;
      if (d > most) most = d;
      if (k <= CORNER_SAMPLES && d > half) half = d;
    }
    const turning = most > LINE_WITHIN;
    if (turning && !K.turning) K.turnAt = S.t;
    if (!turning && (K.turning || K.run === 1)) K.calmAt = S.t;
    K.turning = turning;
    K.straight = turning ? 0 : S.t - K.calmAt;
    const cornering = half > CORNER;
    if (cornering && !K.cornering) { K.cornerStep = S.step; K.cornerX = p.x; K.cornerY = p.y; }
    K.cornering = cornering;
    const back = K.head[(K.hi - HAND_LAG + TRACK) % TRACK];
    if (back === back) K.line = back;
  }

  // the rules of each place's knots, read again whenever the sheets change (a rebuild makes them all anew)
  function compile(S, K) {
    const skills = S.skills;
    let same = true;
    for (let i = 0; i < PLACES && same; i++) if (K.sheets[i] !== (i < skills.length ? skills[i].sheet : null)) same = false;
    if (same) return;
    for (let i = 0; i < PLACES; i++) {
      const sh = i < skills.length ? skills[i].sheet : null, inst = i < skills.length ? skills[i].inst : null, list = K.hooks[i];
      K.sheets[i] = sh;
      if (K.insts[i] !== inst) forget(K, i);           // another voice stands in the place: what was saved goes
      K.insts[i] = inst;
      list.length = 0;
      K.lends[i] = -1; K.lentBy[i] = -1; K.second[i] = 0;
      if (sh === null) continue;
      for (let k = 0; k < sh.knots.length; k++) {
        const rule = sh.knots[k].rule ? rules[sh.knots[k].rule] : undefined;
        if (rule !== undefined && list.indexOf(rule) < 0) list.push(rule);
      }
    }
    // Second Voice: the next voice of the loadout lends its shape
    const second = rules['second-voice'];
    for (let i = 0; second && i < PLACES && i < skills.length; i++) {
      if (K.hooks[i].indexOf(second) < 0) continue;
      for (let d = 1; d < skills.length; d++) {
        const j = (i + d) % skills.length;
        if (j >= PLACES || !skills[j].sheet) continue;
        K.lends[i] = j; K.lentBy[j] = i; K.second[i] = 1; K.second[j] = 1;
        break;
      }
    }
  }

  function forget(K, i) {
    K.leadN[i] = 0; K.leadEnd[i] = 0; K.bank[i] = 0; K.outAt[i] = -1; K.slipK[i] = 0; K.fig[i] = 0; K.ansN[i] = 0;
    K.muffN[i] = 0; K.muffSet[i] = 0; K.pace[i] = 1;
  }

  // an Open Lead beat that began or ended: the sheet is made again
  function beats(S, K) {
    let live = 0;
    for (let i = 0; i < PLACES; i++) if (K.leadEnd[i] > S.t + SLIVER) live++;
    if (live !== K.leadLive) { K.leadLive = live; S.dirty = true; }
  }

  function things(S, pool) {
    const items = pool.items;
    for (let i = 0; i < pool.n; i++) {
      const o = items[i];
      if (!o.alive || o.team !== 0 || o.skill < 0) continue;
      const sk = S.skills[o.skill];
      if (!sk || !sk.sheet) { pool.kill(o); continue; }       // its voice has left the loadout
      const arch = archetypes[Skills.shape(S, o.skill, o).def.archetype];
      if (arch !== undefined && typeof arch.step === 'function') arch.step(S, o, o.skill);
    }
  }

  Skills.step = function (S) {
    const p = S.player, skills = S.skills, v = S.voices, K = S.knots || null;
    if (v && p.alive) mark(S, p, v);
    if (K !== null) { compile(S, K); if (p.alive) track(S, p, K); }
    for (let i = 0; i < skills.length; i++) {
      const sk = skills[i];
      if (sk.inst === null || !sk.sheet) continue;
      const hooks = K !== null && i < PLACES ? K.hooks[i] : null;
      let pace = 1;
      if (hooks !== null) {
        for (let r = 0; r < hooks.length; r++) if (typeof hooks[r].pace === 'function') pace *= hooks[r].pace(S, i, sk.sheet);
        if (K.lentBy[i] >= 0) pace /= SECOND_SLOW;
        K.pace[i] = pace;
      }
      if (sk.cd > 0 && pace > 0) {
        const run = DT * pace;
        sk.cd = sk.cd > run + SLIVER ? sk.cd - run : 0;        // what sixtieths leave over is no wait
      }
      if (S.phase === 'ended') continue;
      if (quiet(S, i)) { if (v && i < PLACES) v.pend[i] = 0; continue; }
      if (v && i < PLACES && v.pend[i] > 0 && S.step >= v.pendAt[i]) {
        v.pend[i]--;
        v.pendAt[i] = S.step + AGAIN_STEPS;
        say(S, i, true, p.x, p.y, 1, false);
      }
      if (hooks !== null) for (let r = 0; r < hooks.length; r++) if (typeof hooks[r].step === 'function') hooks[r].step(S, i, sk.sheet);
      if (!(sk.cd <= 0) || S.phase === 'ended') continue;
      let taken = false;
      if (hooks !== null) for (let r = 0; r < hooks.length; r++) if (typeof hooks[r].ready === 'function' && hooks[r].ready(S, i, sk.sheet) === true) taken = true;
      if (!taken && say(S, i, false, p.x, p.y, 1, false)) sk.cd = 1 / sk.sheet.rate;
    }
    if (K !== null) beats(S, K);
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

  // where the player's last step crossed its own wake (S.wake, kept by 22-enemies.js), laid in the wake's time but
  // not in its newest WAKE_SKIP places; looked at once a step
  function crossing(S, K) {
    if (K.crossChecked === S.step) return K.crossStep === S.step;
    K.crossChecked = S.step;
    const w = S.wake, p = S.player;
    if (!w || !(w.n > WAKE_SKIP + 1)) return false;
    const ax = p.px, ay = p.py, ux = p.x - ax, uy = p.y - ay, len = w.x.length;
    if (ux === 0 && uy === 0) return false;
    for (let k = WAKE_SKIP; k < w.n - 1; k++) {
      const i = (w.head - k + len) % len, j = (i - 1 + len) % len;
      const bx = w.x[i], by = w.y[i], vx = w.x[j] - bx, vy = w.y[j] - by, den = ux * vy - uy * vx;
      if (abs(den) < 1e-12) continue;              // side by side: no crossing
      const s = ((bx - ax) * vy - (by - ay) * vx) / den, t = ((bx - ax) * uy - (by - ay) * ux) / den;
      if (s < 0 || s > 1 || t < 0 || t > 1) continue;
      K.crossStep = S.step;
      K.crossX = ax + ux * s;
      K.crossY = ay + uy * s;
      return true;
    }
    return false;
  }

  const one = [null];
  Skills.point = function (S, slot, rule, reach, out) {
    const p = S.player, mine = C.slot === slot, x = mine ? C.x : p.x, y = mine ? C.y : p.y, K = S.knots;
    out.body = null;
    if (mine && C.point && rule !== 'self') { out.x = C.px; out.y = C.py; return true; }
    if (rule === 'self') { out.x = x; out.y = y; return true; }
    if (rule === 'mark') {
      const v = S.voices;
      if (!v || !v.marked) return false;
      out.x = v.markX; out.y = v.markY;
      return true;
    }
    if (rule === 'crossing') {
      if (!K || !crossing(S, K)) return false;
      out.x = K.crossX; out.y = K.crossY;
      return true;
    }
    if (rule === 'step') {
      if (!K || K.stepAt !== S.step) return false;
      out.x = x; out.y = y;
      return true;
    }
    if (rule === 'ahead') { out.x = x + cos(p.face) * reach; out.y = y + sin(p.face) * reach; return true; }
    if (rule === 'aim' && !(reach > 0)) { out.x = x; out.y = y; return true; }
    if (Skills.pick(S, rule, x, y, reach, 1, one) === 0) {
      if (rule !== 'aim') return false;
      out.x = x + p.aimX * reach; out.y = y + p.aimY * reach;
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

  // ---- striking: one body, and what a shape covers ----

  // Resist: a body this voice has waxed since the toll is never harmed by it again; the first touch bites harder
  function waxed(S, e, slot) {
    if (e.waxToll !== S.toll) { e.waxed = 0; e.waxToll = S.toll; }
    return (e.waxed & (1 << slot)) !== 0;
  }

  // Handstroke: the side of the line the player walks a body stands on
  function side(S, e, right) {
    const p = S.player, line = S.knots ? S.knots.line : p.face, c = cos(line) * (e.y - p.y) - sin(line) * (e.x - p.x);
    return c > SLIVER ? 1 + right / 100 : c < -SLIVER ? 1 - HAND_LEFT : 1;
  }

  // Clash: a foil left by another Clash voice within the quarter-second is paid; else this hit leaves its own
  function clash(S, slot, ss, e, H, pay, ox, oy) {
    if (e.clashS >= 0 && e.clashS !== slot && S.t - e.clashT <= CLASH_WITHIN + SLIVER && e.clashH > 0) {
      const foil = e.clashH * pay / 100, kind = e.clashK;
      e.clashS = -1; e.clashH = 0;
      if (e.alive && e.life > 0) Dmg.harmEnemy(S, e, kind, foil, ox, oy);
      return;
    }
    e.clashS = slot; e.clashT = S.t; e.clashH = H; e.clashK = Skills.kind(ss);
  }

  Skills.hit = function (S, slot, e, part, ox, oy) {
    const sk = S.skills[slot], ss = sk ? sk.sheet : null;
    if (ss === null || ss === undefined || !e.alive || !(e.life > 0)) return 0;
    const pr = ss.params, bite = pr['resist-bite'] > 0 ? pr['resist-bite'] : 0, right = pr['hand-right'] > 0 ? pr['hand-right'] : 0;
    const pay = pr['clash-pay'] > 0 ? pr['clash-pay'] : 0;
    let f = part;
    if (bite > 0) {
      if (waxed(S, e, slot)) return 0;
      e.waxed |= 1 << slot;
      f *= 1 + bite / 100;
    }
    if (right > 0) f *= side(S, e, right);
    if (pay > 0) f *= CLASH_STOCK;
    if (!(f > 0)) return 0;
    const H = Dmg.hitEnemy(S, slot, e, f, ox, oy);
    if (pay > 0 && H > 0) clash(S, slot, ss, e, H, pay, ox, oy);
    return H;
  };

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
      forStrike[k++] = e;
    }
    // Passes Free: the body nearest where the shape starts is let through, and the rest are struck harder
    const sk = S.skills[slot], free = sk && sk.sheet && !(C.slot === slot && C.passed) ? sk.sheet.params['free-more'] : 0;
    let first = -1, f = part;
    if (free > 0 && k > 0) {
      let d = Infinity;
      for (let i = 0; i < k; i++) {
        const dx = forStrike[i].x - shape.x, dy = forStrike[i].y - shape.y;
        if (dx * dx + dy * dy < d) { d = dx * dx + dy * dy; first = i; }
      }
      f = part * (1 + free / 100);
    }
    for (let i = 0; i < k; i++) if (i !== first) Skills.hit(S, slot, forStrike[i], f, ox, oy);
    for (let i = 0; i < k; i++) forStrike[i] = null;
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
    const id = C.slot === slot && C.shape !== null ? C.shape.def.id : S.skills[slot].inst.id;
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
    a.lent = C.slot === slot ? C.lent : -1;
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

  // ---- the knots' rules ----
  // A knot's numbers are its params at its share: what it gives. The rest is the rule's own (the constants above).

  // a count a knot gives, at its share: at least one, and no more than the rule has room for
  function capped(v, most) {
    const n = round(v > 0 ? v : 0);
    return n < 1 ? 1 : n > most ? most : n;
  }

  Skills.knotRule('running-line', {
    pace: function (S, slot, ss) {
      const K = S.knots;
      if (S.t - K.turnAt < LINE_SILENT - SLIVER) return 0;
      return K.straight >= LINE_HELD - SLIVER ? 1 + (ss.params['line-quick'] > 0 ? ss.params['line-quick'] : 0) / 100 : 1;
    },
  });

  Skills.knotRule('open-lead', {
    before: function (S, slot, ss, C0) {
      if (C0.echo) return true;
      const K = S.knots;
      K.leadN[slot]++;
      if (K.leadN[slot] % LEAD_EVERY !== 0) return true;
      const beat = ss.rate > 0 ? 1 / ss.rate : LEAD_BEAT;
      K.leadEnd[slot] = S.t + (beat < LEAD_BEAT ? beat : LEAD_BEAT);
      K.leadDamp[slot] = ss.params['lead-damp'] > 0 ? ss.params['lead-damp'] : 0;
      return false;                                // the beat of silence
    },
  });

  Skills.knotRule('quartered', {
    ready: function (S, slot, ss) {
      const K = S.knots;
      if (K.bank[slot] < capped(ss.params['quarter-most'], QUARTER_MOST)) K.bank[slot]++;
      S.skills[slot].cd = 1 / ss.rate;
      return true;
    },
    step: function (S, slot) {
      const K = S.knots, p = S.player;
      if (K.quarterAt === S.step && K.bank[slot] > 0) K.outAt[slot] = S.step;
      if (!(K.bank[slot] > 0) || K.outAt[slot] < 0 || S.step < K.outAt[slot]) return;
      K.bank[slot]--;
      K.outAt[slot] = K.bank[slot] > 0 ? S.step + LET_GO : -1;
      say(S, slot, true, p.x, p.y, 1, true);
    },
  });

  Skills.knotRule('slip-knot', {
    ready: function () { return true; },          // it waits for a corner, ready
    step: function (S, slot, ss) {
      const K = S.knots, sk = S.skills[slot], at = slot * SLIP_MOST;
      if (K.outAt[slot] >= 0) {                    // letting go: each on its corner, oldest first
        if (S.step < K.outAt[slot]) return;
        const k = K.slipK[slot];
        say(S, slot, true, K.slipX[at + k], K.slipY[at + k], 1, true);
        K.slipK[slot] = k + 1;
        if (K.slipK[slot] >= K.bank[slot]) { K.bank[slot] = 0; K.slipK[slot] = 0; K.outAt[slot] = -1; } else K.outAt[slot] = S.step + LET_GO;
        return;
      }
      if (K.cornerStep === S.step && sk.cd <= 0 && K.bank[slot] < capped(ss.params['slip-most'], SLIP_MOST)) {
        const k = K.bank[slot];
        K.slipX[at + k] = K.cornerX;
        K.slipY[at + k] = K.cornerY;
        K.bank[slot] = k + 1;
        sk.cd = SLIP_SLOW / ss.rate;
      }
      if (K.stopAt === S.step && K.bank[slot] > 0) { K.slipK[slot] = 0; K.outAt[slot] = S.step; }
    },
  });

  // where the player stood seconds ago: from the wake when the vigil keeps one, else where it stands
  function back(S, seconds) {
    if (typeof Enemies.wakeAt === 'function' && S.wake) return Enemies.wakeAt(S, seconds, BACK);
    BACK.x = S.player.x; BACK.y = S.player.y;
    return BACK;
  }

  Skills.knotRule('back-splice', {
    pace: function () { return 1 / SPLICE_SLOW; },
    step: function (S, slot, ss) {
      const K = S.knots, hold = ss.params['splice-hold'] > 0 ? ss.params['splice-hold'] : 0;
      if (K.fig[slot] > 0 && Skills.count(S, K.figX[slot], K.figY[slot], hold) > 0) return;   // a clump to finish
      const b = back(S, SPLICE_BACK);
      K.figX[slot] = b.x; K.figY[slot] = b.y; K.fig[slot] = 1;
    },
    before: function (S, slot, ss, C0) {
      const K = S.knots;
      if (K.fig[slot] > 0 && !C0.echo) { C0.x = K.figX[slot]; C0.y = K.figY[slot]; C0.px = C0.x; C0.py = C0.y; }
      return true;
    },
  });

  // the nearest obstacle to the player whose collider reaches within ANSWER_REACH of it, into C.sx, C.sy
  function stone(S, C0) {
    const p = S.player, n = World.propsNear(S, p.x, p.y, ANSWER_REACH, forStone);
    let d = Infinity;
    C0.stone = false;
    for (let i = 0; i < n; i++) {
      const q = forStone[i];
      if (!(q.r > 0)) continue;
      const k = (q.x - p.x) * (q.x - p.x) + (q.y - p.y) * (q.y - p.y);
      if (k < d) { d = k; C0.stone = true; C0.sx = q.x; C0.sy = q.y; }
    }
    for (let i = 0; i < n; i++) forStone[i] = null;
    return C0.stone;
  }

  Skills.knotRule('stones-answer', {
    before: function (S, slot, ss, C0) {
      if (C0.echo) return true;
      if (!stone(S, C0)) C0.part *= ANSWER_WEAK;
      return true;
    },
    after: function (S, slot, ss, C0) {
      const K = S.knots, n = K.ansN[slot];
      if (C0.echo || !C0.stone || n >= ANSWERS) return;
      const at = slot * ANSWERS + n;
      K.ansAt[at] = S.step + ANSWER_STEPS;
      K.ansX[at] = C0.sx; K.ansY[at] = C0.sy;
      K.ansPart[at] = (ss.params['answer-part'] > 0 ? ss.params['answer-part'] : 0) / 100;
      K.ansN[slot] = n + 1;
    },
    step: function (S, slot) {
      const K = S.knots, base = slot * ANSWERS;
      if (!(K.ansN[slot] > 0) || S.step < K.ansAt[base]) return;
      const x = K.ansX[base], y = K.ansY[base], part = K.ansPart[base];
      for (let k = 1; k < K.ansN[slot]; k++) {     // the answers are kept in the order they fall due
        K.ansAt[base + k - 1] = K.ansAt[base + k]; K.ansX[base + k - 1] = K.ansX[base + k];
        K.ansY[base + k - 1] = K.ansY[base + k]; K.ansPart[base + k - 1] = K.ansPart[base + k];
      }
      K.ansN[slot]--;
      if (part > 0) say(S, slot, false, x, y, part, true);
    },
  });

  Skills.knotRule('muffle', {
    pace: function (S, slot, ss) { return 1 + (ss.params['muffle-pace'] > 0 ? ss.params['muffle-pace'] : 0) / 100; },
    before: function (S, slot, ss, C0) {
      const K = S.knots, p = S.player;
      C0.reach *= MUFFLE_REACH;
      if (C0.echo) return true;
      const n = K.muffN[slot]++;
      if (n % 2 === 1 && K.muffSet[slot] > 0) {   // the second stroke: muffled, on the far side of you
        C0.point = true;
        C0.px = 2 * p.x - K.muffX[slot];
        C0.py = 2 * p.y - K.muffY[slot];
        C0.part *= MUFFLE_ECHO;
        C0.muffled = true;
      }
      return true;
    },
    after: function (S, slot, ss, C0) {
      const K = S.knots;
      if (C0.muffled || C0.echo) return;
      K.muffX[slot] = C0.lx; K.muffY[slot] = C0.ly; K.muffSet[slot] = 1;
    },
  });

  // these act where a cast strikes or takes its shape: their params are read there (Skills.hit, Skills.strike,
  // Skills.cross and the archetypes of 24-archetypes.js)
  Skills.knotRule('passes-free', {});
  Skills.knotRule('resist', {});
  Skills.knotRule('handstroke', {});
  Skills.knotRule('clash', {});
  Skills.knotRule('louvres', {});
  Skills.knotRule('balance', {});
  Skills.knotRule('unlaid', {});

  // a coin flung out where the cast landed: it lies until the next toll unless walked back for
  function fling(S, x, y) {
    const until = (S.tollAt - S.step) / HZ;
    if (typeof Director.drop === 'function') {
      const o = Director.drop(S, COIN, 1, x, y);
      // a coin of its own lies until the toll; one a full pool joined to another coin keeps that one's time
      if (o !== null && o.value === 1 && o.x === x && o.y === y) o.ttl = until;
      return;
    }
    const o = S.pickups.alloc();
    if (o === null) return;
    o.kind = COIN; o.value = 1; o.x = o.px = x; o.y = o.py = y; o.r = FINE_R; o.item = null; o.ttl = until;
    Sim.emit(S, 'drop', x, y, COIN, 1, null);
  }

  Skills.knotRule('ringers-fine', {
    before: function (S, slot, ss, C0) {
      if (C0.echo) return true;
      if (S.coin >= 1) { C0.part *= 1 + (ss.params['fine-more'] > 0 ? ss.params['fine-more'] : 0) / 100; C0.fine = true; } else C0.part *= FINE_POOR;
      return true;
    },
    after: function (S, slot, ss, C0) {
      if (!C0.fine || !(S.coin >= 1)) return;
      S.coin -= 1;
      fling(S, C0.lx, C0.ly);
    },
  });

  Skills.knotRule('second-voice', {
    before: function (S, slot, ss, C0) {
      const K = S.knots, lent = K.lends[slot];
      if (lent < 0 || C0.echo || !(S.player.stillT > 0)) return true;   // moving: the voice's own shape
      const sheet = S.skills[lent].sheet;
      if (!sheet) return true;
      C0.shape = sheet;
      C0.lent = lent;
      C0.part *= (ss.params['second-voice'] > 0 ? ss.params['second-voice'] : 0) / 100;
      return true;
    },
  });
})();
