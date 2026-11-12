// 21-player.js: the player. Movement, posture, headings and the turn rule, the class rule and the trade, the heave,
// wounds, mending and scars, the modifier conditions that hold for the player, pickups and run levels; the cfg of a
// run without a character; timed modifiers. The rules are docs/design/02-combat.md (sections 1, 4, 8, 10 and 15.7)
// and the Change-ringer's of docs/design/03-classes.md.
// Owns: Player, Buffs
// Public:
//   Player.step(S, input)        phase 1. Moves the player at move-speed (less find-weight a find carried and 8% a
//                                rider, 20% faster while Tolled-for; knockback kx, ky fades; World.pushOut); its
//                                posture from the steering speed (Dmg.posture with brace-time and stride-share)
//                                against its top speed on dry ground as it stands: move-speed less what the finds and
//                                the riders take off it, so that under riders a player running flat out strides;
//                                a heading record every 0.1 s; the class rule's step, then the turn rule (a turn of
//                                more than turn-limit from a heading of the last 0.5 s, above 30% of top speed,
//                                lays wrong-footed for 0.5 s, unless the class rule took the turn as its own act);
//                                the trade on input.trade; the heave on input.heave, when heaveCd has run out:
//                                Items.heave(S) throws the find (12-items' package; it returns true when it threw one,
//                                and heaveCd becomes heave-recharge); mending and scars; and S.player.conds, where
//                                braced, striding, crowded and in-water must hold 0.25 s before the mask changes
//                                (S.dirty when it does)
//   Player.pickups(S)            phase 10. Pickups of kind 0 (an ember: value is experience into runXp; when runXp
//                                reaches S.curves.runXp[min(runLevel, 69)] it is spent and the run level rises, to
//                                the mode's runLevels; and into the experience of the run's character, kept at once,
//                                by Char.gain, which may raise the character's level: then S.dirty and a 'grow'
//                                event), 1 (coin: value into S.coin; none is taken in full mourning, while the sheet
//                                has the flag full-mourning) and 2 (a find, into S.haul) are drawn in from within
//                                pickup-reach and taken on touching. Kind 3 is the favours'. A pickup whose state is
//                                below 0 is held back by a system (an observance's promise) and is left lying.
//   Player.classRun(classId, level?) -> {class, level, mods, voices}
//                                the cfg fields of a run without a character: the class's attributes as flat
//                                modifiers (attrs + perLevel x (level - 1)), its base modifiers, and its voices as
//                                VoiceInst {uid, id, level: 1, rope: 2, knots: [null, null]}, in place order
//   Player.rule(classId, {step(S, input) -> boolean, trade(S) -> boolean})
//                                a class's rule. step runs in Player.step after the heading record; returning true
//                                says the turn this step was the class's own act: the records are cleared and the
//                                turn rule does not run. trade runs when button A is pressed and ready; returning
//                                false leaves the trade unspent. The recharge is class.trade.recharge x
//                                trade-recharge / 100. This file registers the Change-ringer's (below).
//   Player.turn(S, seconds) -> degrees   the player's turn now from the headings recorded in the last seconds, or 0
//                                while it moves at 30% of its top speed or less
//   Player.wound(S, life, depth) -> index   puts life lost where the player stands (15.11, step 8): into the
//                                nearest open wound within wound-join, which keeps the deeper depth, else into a new
//                                one (when wound-cap are open the oldest scars first). Emits 'wound'.
//   Player.scar(S, index) -> greatest life lost    scars one open wound: scarring of its life comes off greatest
//                                life until the vigil ends. Emits 'scar'.
//   Buffs.add(S, id, mods, seconds) -> buff   timed modifiers: {id, mods, until} in S.buffs, joined to every sheet
//                                through a Sim.source until S.t reaches until; adding an id again renews it
//
// The Change-ringer (class 'change-ringer'): a reversal of more than 120 degrees within pull-window is a pull, and
// never wrong-foots: the voice in the first place speaks at once (Skills.speak), at most once every 0.4 s, twice if
// the bell is set. Standing still for set-time sets the bell (setBell), and so does the trade, Set, at once.
//
// Fields declared here with Sim.field: on 'player' and on 'enemy', stillT and strideT (seconds still, seconds at
// stride), pose (Dmg.POSE) and heading0 to heading4 (headings recorded every 0.1 s, newest first; NaN where the body
// was too slow to have one); on 'player' only, tradeCd and heaveCd (seconds until each button is ready again) and
// setBell (the Change-ringer's bell is set mouth-up).
// Slots: S.wounds = {n, x, y, life, depth, opened, back, told, scarred}: the open wounds in [0, n), oldest first, in
// Float64Arrays of 20: centre, the life each holds, its depth (s), S.t when it opened, the life it has given back
// while mended (for the closing ring) and how much of that the 'mend' events have told; scarred, the greatest life
// lost to scars this vigil (a Sim.source takes it off life-max). S.combat = {cls, reprieved, hold, pullAt, post,
// postX, postY}: the class id, whether Tolled-for has come this vigil, the seconds each flickering condition has
// wanted to change, S.t of the last pull that spoke, and the bell-post's place.
// Events: 'pull' (x, y the player; a = how many times the first voice speaks), 'trade' (x, y the player; a = the
// recharge it starts; id = the class id), 'mend' (x, y the wound; a = the life given back since the last, at most
// four a second; id 'whole' when it closed), 'scar' (x, y the wound; a = the greatest life lost), 'wound' (x, y the
// wound's centre; a = the life this harm put in it; b = its depth now; id = 'open' or 'join'), 'pickup' (x, y; a =
// kind, b = value), 'level' (x, y the player; a = the new run level) and 'grow' (x, y the player; a = the character's
// new level). The 'heave' event is the finds' (Items.heave).
(function () {
  'use strict';

  const DT = Core.DT, HZ = Core.HZ;
  const sqrt = Math.sqrt, atan2 = Math.atan2, cos = Math.cos, sin = Math.sin, floor = Math.floor;
  const SLIVER = 1e-9;

  const WOUNDS = 20;             // the most wound-cap allows
  const RIDER_SLOW = 0.08, LEAST_PACE = 0.2, TOLLED_PACE = 1.2;
  const KNOCK_KEEP = 0.88;       // what is left of knockback after a step
  const TURN_SECONDS = 0.5;      // the turn rule looks this far back
  const HOLD = 0.25;             // seconds a flickering condition must hold before the mask changes
  const CROWD = 3, CROWD_REACH = 3, LADEN = 4, FAINT = 0.35, AT_POST = 6, AFTER_QUARTER = 8;
  const DRAW_SPEED = 12, TOUCH = 0.3;       // pickups fly in at this speed and are taken this near your edge
  const MOURNING = 'full-mourning';         // the flag of full mourning (Char.mods gives it): no coin is picked up
  const MEND_TELL = 15;          // steps between two 'mend' events of one wound
  const RINGER = 'change-ringer', PULL_TURN = 120, PULL_GAP = 0.4;

  const AILMENTS = Stats.AILMENTS, FOOTING = Stats.RULE.footing, REPRIEVE = Stats.RULE.reprieve, RIDERS = Stats.RULE.riders;
  const FOOT_SECONDS = AILMENTS[FOOTING].seconds;
  const BRACED = Dmg.POSE.braced, STRIDING = Dmg.POSE.striding;
  const bit = (id) => 1 << Stats.COND[id];
  const B_BRACED = bit('braced'), B_STRIDING = bit('striding'), B_CROWDED = bit('crowded'), B_IN_WATER = bit('in-water');
  const B_DRY = bit('dry'), B_FOOTED = bit('wrong-footed'), B_TOLLED = bit('tolled-for'), B_ON_WOUND = bit('on-wound');
  const B_LADEN = bit('laden'), B_SCARRED = bit('scarred'), B_FAINT = bit('faint'), B_AT_POST = bit('at-post');
  const B_IN_LIGHT = bit('in-light'), B_QUARTER = bit('after-quarter');

  const rules = Object.create(null);
  const forCrowd = new Array(1024).fill(null), forPost = new Array(16).fill(null);

  // ---- fields and slots ----

  ['player', 'enemy'].forEach(function (kind) {
    Sim.field(kind, 'stillT', 0);
    Sim.field(kind, 'strideT', 0);
    Sim.field(kind, 'pose', 0);
    for (let i = 0; i < 5; i++) Sim.field(kind, 'heading' + i, NaN);
  });
  Sim.field('player', 'tradeCd', 0);
  Sim.field('player', 'heaveCd', 0);
  Sim.field('player', 'setBell', false);

  Sim.state('wounds', function () {
    const a = () => new Float64Array(WOUNDS);
    return { n: 0, x: a(), y: a(), life: a(), depth: a(), opened: a(), back: a(), told: a(), scarred: 0 };
  });

  Sim.state('combat', function (S) {
    const n = World.withRole(S, 'bell-post', forPost), post = n > 0 ? forPost[0] : null;
    const cfg = S.cfg, cls = cfg.char && cfg.char.class ? cfg.char.class : typeof cfg.class === 'string' ? cfg.class : null;
    return { cls, reprieved: false, hold: new Float64Array(4), pullAt: -1e9, post: post !== null, postX: post ? post.x : 0, postY: post ? post.y : 0 };
  });

  // scars come off greatest life; timed modifiers join every sheet while they last
  Sim.source(function (S, out) {
    if (S.wounds && S.wounds.scarred > 0) out.push({ stat: 'life-max', op: 'flat', value: -S.wounds.scarred });
  });
  Sim.source(function (S, out) {
    const list = S.buffs;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (!(S.t < b.until - SLIVER) || !b.mods) continue;
      for (let j = 0; j < b.mods.length; j++) out.push(b.mods[j]);
    }
  });

  // ---- the class and its rule ----

  Player.rule = function (classId, rule) {
    Core.assert(typeof classId === 'string' && rule && typeof rule === 'object', 'Player.rule needs a class id and {step, trade}');
    rules[classId] = rule;
  };

  const ruleOf = (S) => (S.combat && S.combat.cls !== null && rules[S.combat.cls] !== undefined ? rules[S.combat.cls] : null);
  const classOf = (S) => (S.combat && S.combat.cls !== null && Defs.has('class', S.combat.cls) ? Defs.get('class', S.combat.cls) : null);

  Player.classRun = function (classId, level) {
    const def = Defs.get('class', classId), lv = level >= 1 ? floor(level) : 1, mods = [];
    for (let i = 0; i < Stats.PRIMARIES.length; i++) {
      const id = Stats.PRIMARIES[i].id, v = (def.attrs[id] || 0) + (def.perLevel[id] || 0) * (lv - 1);
      if (v !== 0) mods.push({ stat: id, op: 'flat', value: v });
    }
    for (let i = 0; i < def.base.length; i++) mods.push(def.base[i]);
    const voices = def.voices.map((id, i) => ({ uid: i + 1, id, level: 1, rope: 2, knots: [null, null] }));
    return { class: classId, level: lv, mods, voices };
  };

  // ---- headings ----

  function fastNow(p, top) {
    const v2 = p.vx * p.vx + p.vy * p.vy, least = Dmg.FAST * top;
    return top > 0 && v2 > least * least;
  }

  Player.turn = function (S, seconds) {
    const p = S.player, st = S.sheet.stats;
    if (!fastNow(p, st['move-speed'] * laden(S, p, st))) return 0;
    return Dmg.turn(p, atan2(p.vy, p.vx), seconds, (S.step % Dmg.SAMPLE) / HZ);
  };

  function forget(p) { p.heading0 = p.heading1 = p.heading2 = p.heading3 = p.heading4 = NaN; }

  // ---- the step ----

  function timers(S, p) {
    if (p.tradeCd > 0) p.tradeCd = p.tradeCd > DT + SLIVER ? p.tradeCd - DT : 0;
    if (p.heaveCd > 0) p.heaveCd = p.heaveCd > DT + SLIVER ? p.heaveCd - DT : 0;
    if (p.flash > 0) p.flash = p.flash > 6 * DT ? p.flash - 6 * DT : 0;
    const list = S.buffs;
    for (let i = list.length - 1; i >= 0; i--) {
      if (S.t < list[i].until - SLIVER) continue;
      for (let j = i; j < list.length - 1; j++) list[j] = list[j + 1];
      list.length--;
      S.dirty = true;
    }
  }

  // What the finds carried and the riders leave of top speed (02-combat.md, sections 7 and 10: each "takes off top
  // speed"), never under a fifth. Posture and the turn rule measure the player against move-speed times this, its top
  // speed on dry ground as it stands, so a player running flat out under four riders still strides, and can shed
  // them onto a large body. Only water slows a body against the unladen number; Tolled-for's 20% is not counted.
  function laden(S, p, st) {
    const pace = 1 - S.haul.length * st['find-weight'] / 100 - p.condN[RIDERS] * RIDER_SLOW;
    return pace < LEAST_PACE ? LEAST_PACE : pace;
  }

  function move(S, p, f, st) {
    let mx = +f.mx || 0, my = +f.my || 0;
    const l2 = mx * mx + my * my;
    if (l2 > 1) { const k = 1 / sqrt(l2); mx *= k; my *= k; }
    let pace = laden(S, p, st);
    if (p.condT[REPRIEVE] > 0) pace *= TOLLED_PACE;
    const top = st['move-speed'] * pace;
    p.vx = mx * top;
    p.vy = my * top;
    p.x += (p.vx + p.kx) * DT;
    p.y += (p.vy + p.ky) * DT;
    if (p.kx !== 0 || p.ky !== 0) {
      p.kx *= KNOCK_KEEP;
      p.ky *= KNOCK_KEEP;
      if (p.kx * p.kx + p.ky * p.ky < 1e-4) p.kx = p.ky = 0;
    }
    World.pushOut(S, p);
    if (mx !== 0 || my !== 0) p.face = atan2(my, mx);
    if (f.aim) { p.aimX = f.ax; p.aimY = f.ay; } else { p.aimX = cos(p.face); p.aimY = sin(p.face); }
  }

  function trade(S, p, rule) {
    const def = classOf(S);
    if (def === null || rule === null || typeof rule.trade !== 'function' || rule.trade(S) === false) return;
    const seconds = def.trade.recharge * S.sheet.stats['trade-recharge'] / 100;
    p.tradeCd = seconds;
    Sim.emit(S, 'trade', p.x, p.y, seconds, 0, def.id);
  }

  Player.step = function (S, input) {
    const p = S.player;
    if (!p.alive) return;
    const f = input || Sim.NO_INPUT, st = S.sheet.stats;
    timers(S, p);
    move(S, p, f, st);
    const top = st['move-speed'] * laden(S, p, st);
    Dmg.posture(p, top, st['brace-time'], st['stride-share'] / 100);
    const fast = fastNow(p, top);
    if (S.step % Dmg.SAMPLE === 0) Dmg.record(p, fast ? atan2(p.vy, p.vx) : NaN);
    const rule = ruleOf(S), own = rule !== null && typeof rule.step === 'function' && rule.step(S, f) === true;
    if (own) forget(p);
    else if (fast && !(p.condT[FOOTING] > 0)) {
      // laid before this step's Dmg.step runs the times down, so for one step more: it holds 0.5 s of step-ends,
      // as the dead's does
      const most = Player.turn(S, TURN_SECONDS);
      if (most > st['turn-limit']) Dmg.lay(S, p, FOOTING, FOOT_SECONDS + DT, most, 0);
    }
    if (f.trade && p.tradeCd <= 0) trade(S, p, rule);
    // the heave (input.heave): it throws the find with the most notches, by the finds' own rule
    if (f.heave && p.heaveCd <= 0 && typeof Items.heave === 'function' && Items.heave(S) === true) p.heaveCd = st['heave-recharge'];
    mend(S, p, st);
    scars(S, st);
    conds(S, p, st);
  };

  // ---- wounds ----

  function drop(w, i) {
    for (let j = i; j < w.n - 1; j++) {
      w.x[j] = w.x[j + 1]; w.y[j] = w.y[j + 1]; w.life[j] = w.life[j + 1]; w.depth[j] = w.depth[j + 1];
      w.opened[j] = w.opened[j + 1]; w.back[j] = w.back[j + 1]; w.told[j] = w.told[j + 1];
    }
    w.n--;
  }

  Player.wound = function (S, life, depth) {
    const w = S.wounds, p = S.player, st = S.sheet.stats;
    if (!w || !(life > 0)) return -1;
    const d0 = depth > 0 ? depth : 0, join = st['wound-join'];
    let best = -1, bestD2 = join * join + SLIVER;
    for (let i = 0; i < w.n; i++) {
      const dx = w.x[i] - p.x, dy = w.y[i] - p.y, d2 = dx * dx + dy * dy;
      if (d2 <= bestD2) { best = i; bestD2 = d2; }
    }
    if (best >= 0) {
      w.life[best] += life;
      if (d0 > w.depth[best]) w.depth[best] = d0;
      Sim.emit(S, 'wound', w.x[best], w.y[best], life, w.depth[best], 'join');
      return best;
    }
    const cap = st['wound-cap'] < WOUNDS ? st['wound-cap'] : WOUNDS;
    while (w.n >= cap && w.n > 0) Player.scar(S, 0);
    const i = w.n++;
    w.x[i] = p.x; w.y[i] = p.y; w.life[i] = life; w.depth[i] = d0; w.opened[i] = S.t; w.back[i] = 0; w.told[i] = 0;
    Sim.emit(S, 'wound', p.x, p.y, life, d0, 'open');
    return i;
  };

  Player.scar = function (S, i) {
    const w = S.wounds;
    if (!w || i < 0 || i >= w.n) return 0;
    const lost = w.life[i] * S.sheet.stats.scarring / 100, x = w.x[i], y = w.y[i];
    drop(w, i);
    if (lost > 0) { w.scarred += lost; S.dirty = true; }
    Sim.emit(S, 'scar', x, y, lost, 0, null);
    return lost;
  };

  // Standing Braced within mend-reach of a wound's centre gives its life back evenly over (1 s + 2 x depth) /
  // mend-rate; stepping off keeps what came back. Not while Tolled-for.
  function mend(S, p, st) {
    const w = S.wounds;
    if (w.n === 0 || p.pose !== BRACED || p.condT[REPRIEVE] > 0) return;
    const reach = st['mend-reach'], rate = st['mend-rate'] / 100, most = st['life-max'], tell = S.step % MEND_TELL === 0;
    for (let i = 0; i < w.n; i++) {
      const dx = w.x[i] - p.x, dy = w.y[i] - p.y;
      if (dx * dx + dy * dy > reach * reach + SLIVER) continue;
      const whole = w.life[i] + w.back[i], seconds = (1 + 2 * w.depth[i]) / rate;
      let give = whole / seconds * DT;
      if (give > w.life[i] || w.life[i] - give <= SLIVER * whole) give = w.life[i];
      w.life[i] -= give;
      w.back[i] += give;
      p.life = p.life + give < most ? p.life + give : most;
      if (w.life[i] <= 0) {
        Sim.emit(S, 'mend', w.x[i], w.y[i], w.back[i] - w.told[i], 0, 'whole');
        drop(w, i);
        i--;
      } else if (tell) {
        Sim.emit(S, 'mend', w.x[i], w.y[i], w.back[i] - w.told[i], 0, null);
        w.told[i] = w.back[i];
      }
    }
  }

  // a wound open wound-term seconds scars; wounds are kept oldest first, so only the first can be due
  function scars(S, st) {
    const w = S.wounds, term = st['wound-term'];
    while (w.n > 0 && S.t - w.opened[0] >= term - SLIVER) Player.scar(S, 0);
  }

  // ---- the modifier conditions of the player ----

  function crowd(S, p) {
    const n = S.grid.query(p.x, p.y, CROWD_REACH, forCrowd);
    let k = 0;
    for (let i = 0; i < n; i++) if (forCrowd[i].alive && forCrowd[i].life > 0) k++;
    return k;
  }

  function onWound(S, p, reach) {
    const w = S.wounds;
    for (let i = 0; i < w.n; i++) {
      const dx = w.x[i] - p.x, dy = w.y[i] - p.y;
      if (dx * dx + dy * dy <= reach * reach + SLIVER) return true;
    }
    return false;
  }

  // the first 8 s after each quarter of the toll interval, the toll included (the start of the vigil is no quarter)
  function afterQuarter(S) {
    const steps = S.tollSteps, into = S.step - (S.tollAt - steps), quarter = steps / 4;
    if (S.toll === 0 && into < quarter) return false;
    return into % quarter < AFTER_QUARTER * HZ;
  }

  // a flickering condition changes in the mask only once it has wanted to for HOLD seconds
  function held(c, i, mask, b, want) {
    if (((mask & b) !== 0) === want) { c.hold[i] = 0; return mask; }
    c.hold[i] += DT;
    if (c.hold[i] < HOLD - SLIVER) return mask;
    c.hold[i] = 0;
    return want ? mask | b : mask & ~b;
  }
  const at = (mask, b, want) => (want ? mask | b : mask & ~b);

  function conds(S, p, st) {
    const c = S.combat;
    let m = p.conds;
    m = held(c, 0, m, B_BRACED, p.pose === BRACED);
    m = held(c, 1, m, B_STRIDING, p.pose === STRIDING);
    m = held(c, 2, m, B_CROWDED, crowd(S, p) >= CROWD);
    m = held(c, 3, m, B_IN_WATER, false);                     // every place is dry until the Ropewalk
    m = at(m, B_DRY, true);
    m = at(m, B_FOOTED, p.condT[FOOTING] > 0);
    m = at(m, B_TOLLED, p.condT[REPRIEVE] > 0);
    m = at(m, B_ON_WOUND, onWound(S, p, st['mend-reach']));
    m = at(m, B_LADEN, S.haul.length >= LADEN);
    m = at(m, B_SCARRED, S.wounds.scarred > 0);
    m = at(m, B_FAINT, p.life < FAINT * st['life-max']);
    const px = p.x - c.postX, py = p.y - c.postY;
    m = at(m, B_AT_POST, c.post && px * px + py * py <= AT_POST * AT_POST);
    m = at(m, B_IN_LIGHT, false);                             // no lamp burns before the Lamp-trimmer
    m = at(m, B_QUARTER, afterQuarter(S));
    if (m !== p.conds) { p.conds = m; S.dirty = true; }
  }

  // ---- pickups and run levels ----

  function take(S, p, o) {
    if (o.kind === 0) {
      p.runXp += o.value;
      const curve = S.curves.runXp, cap = S.mode && S.mode.runLevels > 0 ? S.mode.runLevels : curve.length;
      for (;;) {
        if (p.runLevel >= cap) break;
        const need = curve[p.runLevel < curve.length - 1 ? p.runLevel : curve.length - 1];
        if (!(need > 0) || p.runXp < need - SLIVER) break;
        p.runXp -= need;
        p.runLevel++;
        Sim.emit(S, 'level', p.x, p.y, p.runLevel, 0, null);
      }
      // the character's experience is kept the moment it is earned (04-progression.md)
      const char = S.cfg.char;
      if (char && typeof Char.gain === 'function' && Char.gain(char, o.value, S.mode) > 0) {
        S.dirty = true;
        Sim.emit(S, 'grow', p.x, p.y, char.level, 0, null);
      }
    } else if (o.kind === 1) {
      S.coin += o.value;
    } else {
      S.haul.push(o.item);
      S.dirty = true;
    }
    Sim.emit(S, 'pickup', o.x, o.y, o.kind, o.value, null);
    S.pickups.kill(o);
  }

  Player.pickups = function (S) {
    const p = S.player;
    if (!p.alive || S.phase === 'ended') return;
    const reach = S.sheet.stats['pickup-reach'], items = S.pickups.items, step = DRAW_SPEED * DT;
    const noCoin = S.sheet.flags[MOURNING] === true;          // full mourning: no coin may be picked up
    for (let i = 0; i < S.pickups.n; i++) {
      const o = items[i];
      if (!o.alive || o.kind < 0 || o.kind > 2 || o.state < 0 || (noCoin && o.kind === 1)) continue;
      const dx = p.x - o.x, dy = p.y - o.y, d2 = dx * dx + dy * dy, touch = p.r + (o.r > 0 ? o.r : 0) + TOUCH;
      if (d2 <= touch * touch) { take(S, p, o); continue; }
      if (d2 > reach * reach) continue;
      const d = sqrt(d2);
      if (d - step <= touch) { take(S, p, o); continue; }
      o.x += dx / d * step;
      o.y += dy / d * step;
    }
  };

  // ---- timed modifiers ----

  Buffs.add = function (S, id, mods, seconds) {
    const list = S.buffs, until = S.t + (seconds > 0 ? seconds : 0);
    S.dirty = true;
    for (let i = 0; i < list.length; i++) {
      if (list[i].id !== id) continue;
      list[i].mods = mods;
      list[i].until = until;
      return list[i];
    }
    const b = { id, mods, until };
    list.push(b);
    return b;
  };

  // ---- the Change-ringer ----

  Player.rule(RINGER, {
    step: function (S) {
      const p = S.player, st = S.sheet.stats, c = S.combat;
      if (!p.setBell && p.stillT >= st['set-time'] - SLIVER) p.setBell = true;
      const win = st['pull-window'];
      if (!(Player.turn(S, win) > PULL_TURN)) return false;
      // a pull, which never wrong-foots: a footing this very reversal laid (within the window) is lifted
      if (p.condT[FOOTING] > 0 && FOOT_SECONDS + DT - p.condT[FOOTING] <= win + SLIVER) Dmg.lift(S, p, FOOTING);
      if (S.t - c.pullAt >= PULL_GAP - SLIVER && typeof Skills.speak === 'function') {
        const times = p.setBell ? 2 : 1;
        if (Skills.speak(S, 0, times)) {
          c.pullAt = S.t;
          p.setBell = false;
          Sim.emit(S, 'pull', p.x, p.y, times, 0, null);
        }
      }
      return true;
    },
    trade: function (S) {
      const p = S.player;
      if (p.setBell) return false;              // already set: the trade is not spent
      p.setBell = true;
      return true;
    },
  });
})();
