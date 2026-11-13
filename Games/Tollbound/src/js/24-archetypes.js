// 24-archetypes.js: the shapes voices speak in: ring, rap, bar, spark and cone (docs/design/02-combat.md, 15.14),
// and the cross a Louvres knot makes of any of them. Each delivers the one kind of harm its voice deals: a Blow strikes
// at once whatever the shape covers and leaves its mark for a moment; Drag lays a zone there that the Drag ticks bite
// through (Dmg.tick); a Swell lays an area that fills for the voice's fill and then lands (Skills.areaStep): spreading
// from where the voice speaks when the shape starts there, falling where it was aimed otherwise, and the dead's lee
// works against a spreading one. Every shape is cast from the cast in hand, Skills.C (23-skills.js): from (C.x, C.y),
// at C.part of the voice's harm, its reach and lengths times C.reach, with the params and sizes of C.shape (its own
// sheet, or the one a Second Voice lends), aimed at (C.px, C.py) when C.point; its kind of harm is always its own.
// Owns: Skills (it registers the archetypes with Skills.archetype, and adds Skills.cross)
// Public:
//   Skills.cross(S, slot, forced) -> boolean   the cast of a voice with a Louvres knot: four lanes 2 m wide from
//          where it speaks, one toward the district's bell-post (north where there is none), one away from it and two
//          across, each as long as the voice reaches (its reach, else its length, else its radius), louvre-more
//          percent harder: struck at once for a Blow, laid as zones for Drag, filling from where it speaks for a Swell
// The archetypes' params, from the voice's params at its level (lengths in metres, times in seconds; the sheet's
// area, reach, duration and throw-speed multiply what they name):
//   ring   a circle of radius (x area) round the voice's point (Skills.point: 'self' where it speaks from, 'mark' the
//          mark, 'crossing' where the player crossed its wake, else the body the rule picks within reach x reach). A
//          Blow strikes every body inside; Drag lays a zone for duration (x duration); a Swell fills for fill. Round
//          'mark': still (percent more harm for each second the mark has stayed put) and stillMost (at most that much
//          more). beat: two forks a beat apart (the second's interval over the first's, the voice's own): each ring
//          is beatMost (3 if not given) x cos^2(pi x phase), phase = frac(t x rate x (1 - 1 / beat)), so it swells to
//          beatMost and fades to nothing once a beat. byCount: the harm is multiplied by the dead it catches, byCount
//          at most.
//   rap    the bodies the rule picks within reach (count of them, 1 if none is given). A Blow strikes each, and the
//          dead within splash (x area) of it; Drag tells it: a zone of radius splash (else just over the body) that
//          follows it for strokes ticks (strokesLarge for a large body, strokesElite for an elite or a keeper; twice
//          and three times strokes when not given), and if it falls before the count is done the strokes left over
//          are told on its nearest neighbour within reach, counting pass times (2 if not given); a Swell falls on
//          its place, radius splash, for fill. Aimed at a point (C.point), it picks the nearest to the point.
//   bar    the line from the voice's post to where it speaks while it is no longer than length (else the player's
//          bar-length), x reach: a Blow strikes what lies within width / 2 (x area) of it; Drag lays the lane as a
//          zone for duration; a Swell fills along it from the post. The post stands where the vigil began until
//          something moves it: S.skills[slot].a0, a1 are its place, a2 = 1 once it stands.
//   spark  count (1 if none is given) + throws thrown things at the bodies the rule picks within reach (straight
//          along the aim when the pull asks and none is in reach), at speed (x throw-speed), radius size. A Blow
//          strikes each body it meets, passing through pierce of them; a Drag or Swell spark opens a zone or a
//          falling Swell of radius splash where it first meets a body or where its flight ends. Target 'ahead' (or a
//          cast aimed at a point): count thrown straight the way the player faces (or at the point), none picked, and
//          behind more thrown straight back, each rearGrow percent stronger and rearWide metres wider for every second
//          the player's heading has held within 15 degrees, rearMost seconds at most.
//   cone   a wedge length (x reach) long and angle degrees wide from where it speaks: at the body the rule picks within
//          length ('aim' along the aim, 'self' the way the player faces). Target 'step': it speaks on the player's
//          first step after standing still, toward that step, held metres longer for every second it stood, heldMost
//          seconds at most (when the pull asks on another step, the way the player faces). A Blow strikes every body
//          inside; Drag lays the wedge as a zone for duration; a Swell fills it, spreading from where it speaks.
// The knots that act in a shape (their rules are under "The knots' rules" in 23-skills.js): Passes Free (rap picks
// one more and lets the nearest through; a thrown thing passes through the first body it meets and strikes the rest
// harder), Balance and Unlaid (thrown things), Louvres (the cross above).
(function () {
  'use strict';

  const DT = Core.DT, PI = Math.PI;
  const sqrt = Math.sqrt, atan2 = Math.atan2, floor = Math.floor, cos = Math.cos, sin = Math.sin;
  const SLIVER = 1e-9;
  const MARK_SECONDS = 0.25;     // how long the mark of a Blow lies
  const FILL_SECONDS = 1;        // a Swell's fill when its voice gives none
  const SWELL_IN = 2;            // metres: a Swell is laid if one of the dead is within this of its edge
  const SPARK_SPEED = 14, SPARK_SIZE = 0.2, BAR_WIDTH = 1;
  const RAP_PASS = 2, BEAT_MOST = 3;
  const LOUVRE_HALF = 1;         // the lanes of the cross are 2 m wide
  const FLY = 0, STAND = 1;      // a thrown thing in flight; stood mouth-up at the end of it (Balance)
  const BALANCE_OUT = 0.5, BALANCE_SECONDS = 4, BALANCE_MOST = 12, BALANCE_TOUCH = 0.3;
  const UNLAID_HALF = 0.5, UNLAID_SPREAD = 40 * PI / 180, UNLAID_FIT = 1.5;
  const QUERY = 2;               // metres added to a query for bodies touching a thrown thing that stands

  const C = Skills.C;
  const P = { x: 0, y: 0, body: null };
  const picked = new Array(64).fill(null), met = new Array(1024).fill(null);

  const harmOf = (S, slot) => S.skills[slot].sheet;
  const typeOf = (S, slot) => Stats.TYPES[Skills.kind(S.skills[slot].sheet)];
  const fillOf = (pr) => (pr.fill > 0 ? pr.fill : FILL_SECONDS);
  const countOf = (pr) => (pr.count >= 1 ? floor(pr.count) : 1);
  const num = (v) => (v > 0 ? v : 0);

  // a Swell or a zone at (x, y) of radius r for the voice in slot, at part of its harm; null when the areas are full
  function swell(S, slot, x, y, r, spreading, part, fill) {
    const a = Skills.area(S, slot, Skills.FILL, x, y, r, fill + DT);
    if (a !== null) { a.a0 = spreading ? 1 : 0; a.a1 = part; a.part = part; }
    return a;
  }
  function zone(S, slot, x, y, r, seconds, part) {
    const a = Skills.area(S, slot, Skills.ZONE, x, y, r, seconds);
    if (a !== null) { a.tick = Skills.TICK * part; a.part = part; }
    return a;
  }

  // ---- ring ----

  // Round the mark: harm rises still percent for each second the mark has stayed put, to stillMost, counted to
  // when the voice lands.
  function stillPart(S, pr, rule, later) {
    if (rule !== 'mark' || !(pr.still > 0) || !S.voices) return 1;
    const held = S.t - S.voices.markT + later, more = pr.still * (held > 0 ? held : 0), most = pr.stillMost > 0 ? pr.stillMost : 100;
    return 1 + (more < most ? more : most) / 100;
  }

  // Two forks a beat apart: how nearly they sound together now, from beatMost down to nothing
  function beatPart(S, ss, pr) {
    const most = pr.beatMost > 0 ? pr.beatMost : BEAT_MOST, f = S.t * num(ss.rate) * (1 - 1 / pr.beat), c = cos(PI * (f - floor(f)));
    return most * c * c;
  }

  Skills.archetype('ring', {
    cast: function (S, slot, forced) {
      const sh = Skills.shape(S, slot), pr = sh.params, rule = sh.def.target, type = typeOf(S, slot);
      if (type === undefined || !Skills.point(S, slot, rule, num(pr.reach) * sh.reach * C.reach, P)) return false;
      const r = num(pr.radius) * sh.area;
      if (!(r > 0)) return false;
      let part = C.part;
      if (pr.beat > 0) part *= beatPart(S, harmOf(S, slot), pr);
      if (pr.byCount > 0) { const n = Skills.count(S, P.x, P.y, r); part *= n < pr.byCount ? n : pr.byCount; }
      Skills.landed(P.x, P.y);
      if (type.bare) {
        if (!forced && Skills.count(S, P.x, P.y, r + SWELL_IN) === 0) return false;
        if (swell(S, slot, P.x, P.y, r, rule === 'self', part * stillPart(S, pr, rule, fillOf(pr)), fillOf(pr)) === null) return false;
      } else if (type.ticks) {
        if (!forced && Skills.count(S, P.x, P.y, r) === 0) return false;
        if (zone(S, slot, P.x, P.y, r, (pr.duration > 0 ? pr.duration : 1) * sh.duration, part) === null) return false;
      } else {
        const n = Skills.circle(S, slot, P.x, P.y, r, part * stillPart(S, pr, rule, 0), false);
        if (n === 0 && !forced) return false;
        Skills.area(S, slot, Skills.MARK, P.x, P.y, r, MARK_SECONDS);
      }
      Skills.where(P.x, P.y);
      return true;
    },
    step: Skills.areaStep,
  });

  // ---- rap ----

  function strokesOf(pr, b) {
    const n = pr.strokes >= 1 ? pr.strokes : 1;
    if (b.rank >= 1) return pr.strokesElite >= 1 ? pr.strokesElite : n * 3;      // an elite or a keeper
    if (Dmg.large(b)) return pr.strokesLarge >= 1 ? pr.strokesLarge : n * 2;
    return n;
  }

  Skills.archetype('rap', {
    cast: function (S, slot) {
      const sh = Skills.shape(S, slot), pr = sh.params, type = typeOf(S, slot), free = num(harmOf(S, slot).params['free-more']);
      if (type === undefined) return false;
      const skip = free > 0 ? 1 : 0, ox = C.point ? C.px : C.x, oy = C.point ? C.py : C.y, rule = C.point ? 'nearest' : sh.def.target;
      const n = Skills.pick(S, rule, ox, oy, num(pr.reach) * sh.reach * C.reach, countOf(pr) + skip, picked);
      if (n === 0) return false;
      C.passed = skip > 0;                         // Passes Free: the nearest is let through (a lone one: wasted)
      const splash = num(pr.splash) * sh.area, part = C.part * (skip > 0 ? 1 + free / 100 : 1);
      Skills.landed(picked[0].x, picked[0].y);
      for (let i = skip; i < n; i++) {
        const b = picked[i];
        if (type.bare) swell(S, slot, b.x, b.y, splash > b.r ? splash : b.r, false, part, fillOf(pr));
        else if (type.ticks) {
          const a = zone(S, slot, b.x, b.y, splash > 0 ? splash : b.r + 0.3, Skills.strokes(S, strokesOf(pr, b)), part);
          if (a !== null) { a.target = b.uid; a.a2 = pr.pass > 0 ? pr.pass : RAP_PASS; }
        } else {
          if (splash > 0) Skills.circle(S, slot, b.x, b.y, splash, part, false, C.x, C.y);
          else Skills.hit(S, slot, b, part, C.x, C.y);
          Skills.area(S, slot, Skills.MARK, b.x, b.y, splash > b.r ? splash : b.r, MARK_SECONDS);
        }
      }
      for (let i = 0; i < n; i++) picked[i] = null;
      Skills.where(C.x, C.y);
      return true;
    },
    // a told zone follows its body; when the body has fallen the strokes left are told on its nearest neighbour
    step: function (S, a, slot) {
      Skills.areaStep(S, a, slot);
      if (a.state !== Skills.ZONE || a.target === 0 || !(a.tick > 0)) return;
      const b = Skills.find(S, a.target, a.x, a.y);
      if (b !== null && b.life > 0) { a.x = b.x; a.y = b.y; return; }
      const sh = Skills.shape(S, slot, a), reach = num(sh.params.reach) * sh.reach;
      if (Skills.pick(S, 'nearest', a.x, a.y, reach, 1, picked) === 0) {
        a.tick = 0;                                  // nobody left to tell
        a.ttl = DT / 2;
        return;
      }
      const next = picked[0];
      picked[0] = null;
      a.target = next.uid;
      a.x = next.x;
      a.y = next.y;
      a.tick = Skills.TICK * a.a2 * a.part;
    },
  });

  // ---- bar ----

  Skills.archetype('bar', {
    cast: function (S, slot, forced) {
      const sh = Skills.shape(S, slot), pr = sh.params, type = typeOf(S, slot), post = S.skills[C.lent >= 0 ? C.lent : slot];
      if (type === undefined) return false;
      if (!(post.a2 > 0)) { post.a0 = S.region.startX; post.a1 = S.region.startY; post.a2 = 1; }
      const ax = post.a0, ay = post.a1, dx = C.x - ax, dy = C.y - ay, len = sqrt(dx * dx + dy * dy);
      const most = (pr.length > 0 ? pr.length : S.sheet.stats['bar-length']) * sh.reach * C.reach;
      if (len > most || len < 0.1) return false;    // past its length the bar drops until you come back
      const half = (pr.width > 0 ? pr.width : BAR_WIDTH) / 2 * sh.area, aim = atan2(dy, dx);
      let a = null;
      if (type.bare) {
        a = swell(S, slot, ax, ay, half, true, C.part, fillOf(pr));
        if (a === null) return false;
      } else if (type.ticks) {
        a = zone(S, slot, ax, ay, half, (pr.duration > 0 ? pr.duration : 1) * sh.duration, C.part);
        if (a === null) return false;
      } else {
        const n = Skills.lane(S, slot, ax, ay, aim, len, half, C.part, false);
        if (n === 0 && !forced) return false;
        a = Skills.area(S, slot, Skills.MARK, ax, ay, half, MARK_SECONDS);
      }
      if (a !== null) { a.angle = aim; a.len = len; }
      Skills.landed(ax + dx / 2, ay + dy / 2);
      Skills.where(C.x, C.y);
      return true;
    },
    step: Skills.areaStep,
  });

  // ---- spark ----

  function fling(S, slot, ux, uy, sh, pr, reach, part, size) {
    const o = S.shots.alloc();
    if (o === null) return null;
    const speed = (pr.speed > 0 ? pr.speed : SPARK_SPEED) * sh['throw-speed'], id = sh.def.id;
    o.def = Defs.has('attack', id) ? Defs.get('attack', id) : null;
    o.team = 0;
    o.owner = 0;
    o.skill = slot;
    o.x = C.x;
    o.y = C.y;
    o.vx = ux * speed;
    o.vy = uy * speed;
    o.r = size;
    o.face = atan2(uy, ux);
    o.pierce = sh.pierce;
    o.ttl = (reach > 0 ? reach : 1) / speed + DT;
    o.part = part;
    o.lent = C.lent;
    o.state = FLY;
    return o;
  }

  // one thing thrown along (ux, uy), or, unlaid, two strands 40 degrees apart at half its harm each
  function throwOne(S, slot, ux, uy, sh, pr, reach, part, size, unlaid) {
    if (!unlaid) return fling(S, slot, ux, uy, sh, pr, reach, part, size) !== null ? 1 : 0;
    const c = cos(UNLAID_SPREAD / 2), s = sin(UNLAID_SPREAD / 2);
    const a = fling(S, slot, ux * c - uy * s, ux * s + uy * c, sh, pr, reach, part * UNLAID_HALF, size);
    const b = fling(S, slot, ux * c + uy * s, uy * c - ux * s, sh, pr, reach, part * UNLAID_HALF, size);
    if (a !== null && b !== null) { a.twin = b.uid; b.twin = a.uid; }
    return (a !== null ? 1 : 0) + (b !== null ? 1 : 0);
  }

  // a Drag or Swell spark opens its area where it meets a body or where its flight ends
  function burst(S, o, slot, type, pr, sh) {
    const r = pr.splash > 0 ? pr.splash : 1;
    const a = type.bare ? swell(S, slot, o.x, o.y, r, false, o.part, fillOf(pr))
      : zone(S, slot, o.x, o.y, r, (pr.duration > 0 ? pr.duration : 1) * sh.duration, o.part);
    if (a !== null) a.lent = o.lent;
    o.ttl = 0;
  }

  function struck(o, uid) {
    const n = o.hitN < o.hits.length ? o.hitN : o.hits.length;
    for (let i = 0; i < n; i++) if (o.hits[i] === uid) return true;
    return false;
  }

  function shotOf(S, uid) {
    const items = S.shots.items;
    for (let i = 0; i < S.shots.n; i++) if (items[i].alive && items[i].uid === uid) return items[i];
    return null;
  }

  // Unlaid: a strand stops at the body it strikes. The first of a pair leaves where it struck on its twin; the second
  // fits the two when their bodies stand within UNLAID_FIT of each other: unlaid-fit percent of the whole cast there.
  function strand(S, o, slot, e) {
    o.ttl = 0;
    if (o.target === 1) {
      const dx = e.x - o.tx, dy = e.y - o.ty;
      if (dx * dx + dy * dy > UNLAID_FIT * UNLAID_FIT) return;
      const fit = num(harmOf(S, slot).params['unlaid-fit']), mx = (e.x + o.tx) / 2, my = (e.y + o.ty) / 2;
      Skills.circle(S, slot, mx, my, UNLAID_FIT / 2, o.part / UNLAID_HALF * fit / 100, false, mx, my);
      Skills.area(S, slot, Skills.MARK, mx, my, UNLAID_FIT / 2, MARK_SECONDS);
      return;
    }
    const twin = shotOf(S, o.twin);
    if (twin !== null) { twin.tx = e.x; twin.ty = e.y; twin.target = 1; }
  }

  // Balance: a thrown thing at the end of its flight stands mouth-up there; when more than BALANCE_MOST of a voice's
  // stand, the oldest falls harmlessly
  function stood(S, o, slot) {
    o.state = STAND; o.vx = 0; o.vy = 0; o.ttl = BALANCE_SECONDS + DT; o.part = o.part / BALANCE_OUT; o.a1 = 0; o.hitN = 0;
    const items = S.shots.items;
    let n = 0, oldest = null;
    for (let i = 0; i < S.shots.n; i++) {
      const q = items[i];
      if (!q.alive || q.team !== 0 || q.skill !== slot || q.state !== STAND || !(q.ttl > 0)) continue;
      n++;
      if (oldest === null || q.uid < oldest.uid) oldest = q;
    }
    if (n > BALANCE_MOST && oldest !== null) oldest.ttl = 0;
  }

  // a light body that passes a standing thing rocks it once; a large one tips it over onto itself
  function standing(S, o, slot, ss) {
    const n = S.grid.query(o.x, o.y, o.r + BALANCE_TOUCH + QUERY, met);
    for (let i = 0; i < n; i++) {
      const e = met[i];
      if (!e.alive || !(e.life > 0)) continue;
      const dx = e.x - o.x, dy = e.y - o.y, reach = o.r + e.r + BALANCE_TOUCH;
      if (dx * dx + dy * dy > reach * reach) continue;
      if (Dmg.large(e)) {
        const pr = ss.params;
        Skills.hit(S, slot, e, o.part * (1 + num(pr['balance-fall']) / 100) * (1 + num(pr['balance-rock']) / 100 * o.a1), o.x, o.y);
        o.ttl = 0;
        return;
      }
      if (struck(o, e.uid)) continue;
      o.hits[o.hitN % o.hits.length] = e.uid;
      o.hitN++;
      o.a1++;
    }
  }

  function flight(S, o, slot) {
    const sh = Skills.shape(S, slot, o), pr = sh.params, ss = harmOf(S, slot), type = typeOf(S, slot);
    if (type === undefined || !(o.ttl > 0)) return;
    if (o.state === STAND) { standing(S, o, slot, ss); return; }
    const x0 = o.x, y0 = o.y, free = num(ss.params['free-more']);
    o.x += o.vx * DT;
    o.y += o.vy * DT;
    const lx = o.x - x0, ly = o.y - y0, len2 = lx * lx + ly * ly, half = sqrt(len2) / 2;
    o.dist += 2 * half;
    const n = S.grid.query(x0 + lx / 2, y0 + ly / 2, half + o.r + 0.5, met);
    for (let i = 0; i < n; i++) {
      const e = met[i];
      if (!e.alive || !(e.life > 0) || struck(o, e.uid)) continue;
      let s = len2 > 0 ? ((e.x - x0) * lx + (e.y - y0) * ly) / len2 : 0;
      s = s < 0 ? 0 : s > 1 ? 1 : s;
      const qx = x0 + lx * s - e.x, qy = y0 + ly * s - e.y, reach = o.r + e.r;
      if (qx * qx + qy * qy > reach * reach) continue;
      if (!type.bare && !type.ticks) {
        o.hits[o.hitN % o.hits.length] = e.uid;
        o.hitN++;
        if (free > 0 && o.free === 0) { o.free = 1; continue; }      // Passes Free: the first is let through
        Skills.hit(S, slot, e, o.part * (free > 0 ? 1 + free / 100 : 1), x0, y0);
        if (o.twin !== 0) { strand(S, o, slot, e); return; }
        if (o.hitN - o.free > o.pierce) { o.ttl = 0; return; }
      } else { burst(S, o, slot, type, pr, sh); return; }
    }
    if (o.ttl > DT + SLIVER) return;
    if (type.bare || type.ticks) burst(S, o, slot, type, pr, sh);
    else if (ss.params['balance-fall'] > 0) stood(S, o, slot);
  }

  Skills.archetype('spark', {
    cast: function (S, slot, forced) {
      const sh = Skills.shape(S, slot), pr = sh.params, ss = harmOf(S, slot), p = S.player, rule = sh.def.target;
      const reach = num(pr.reach) * sh.reach * C.reach, size = pr.size > 0 ? pr.size : SPARK_SIZE, unlaid = ss.params['unlaid-fit'] > 0;
      const part = C.part * (ss.params['balance-fall'] > 0 ? BALANCE_OUT : 1);
      let thrown = 0;
      if (rule === 'ahead' || C.point) {
        let ux = cos(p.face), uy = sin(p.face);
        if (C.point) {
          const dx = C.px - C.x, dy = C.py - C.y, d = sqrt(dx * dx + dy * dy);
          if (d > 1e-6) { ux = dx / d; uy = dy / d; }
        }
        for (let i = 0; i < countOf(pr) + sh.throws; i++) thrown += throwOne(S, slot, ux, uy, sh, pr, reach, part, size, unlaid);
        const behind = pr.behind >= 1 ? floor(pr.behind) : 0, K = S.knots, most = num(pr.rearMost);
        const held = K && K.straight < most ? K.straight : most;
        const rp = part * (1 + num(pr.rearGrow) / 100 * held), rs = size + num(pr.rearWide) * held;
        for (let i = 0; i < behind; i++) thrown += throwOne(S, slot, -ux, -uy, sh, pr, reach, rp, rs, unlaid);
        Skills.landed(C.x + ux * reach, C.y + uy * reach);
      } else {
        const n = Skills.pick(S, rule, C.x, C.y, reach, countOf(pr) + sh.throws, picked);
        if (n === 0 && !forced) return false;
        for (let i = 0; i < (n > 0 ? n : 1); i++) {
          let ux = p.aimX, uy = p.aimY;
          if (n > 0) {
            const dx = picked[i].x - C.x, dy = picked[i].y - C.y, d = sqrt(dx * dx + dy * dy);
            if (d > 1e-6) { ux = dx / d; uy = dy / d; }
            if (i === 0) Skills.landed(picked[i].x, picked[i].y);
            picked[i] = null;
          } else Skills.landed(C.x + ux * reach, C.y + uy * reach);
          thrown += throwOne(S, slot, ux, uy, sh, pr, reach, part, size, unlaid);
        }
      }
      if (thrown === 0) return false;
      Skills.where(C.x, C.y);
      return true;
    },
    step: function (S, thing, slot) {
      if (thing.hits !== undefined) flight(S, thing, slot);
      else Skills.areaStep(S, thing, slot);
    },
  });

  // ---- cone ----

  Skills.archetype('cone', {
    cast: function (S, slot, forced) {
      const sh = Skills.shape(S, slot), pr = sh.params, rule = sh.def.target, type = typeOf(S, slot), p = S.player;
      const open = num(pr.angle) * PI / 180;
      let len = num(pr.length) * sh.reach * C.reach;
      if (type === undefined || !(len > 0) || !(open > 0)) return false;
      let aim = p.face;
      if (C.point) aim = atan2(C.py - C.y, C.px - C.x);
      else if (rule === 'aim') aim = atan2(p.aimY, p.aimX);
      else if (rule === 'step') {
        if (Skills.point(S, slot, 'step', 0, P)) {     // the first step after standing: toward it
          const K = S.knots, most = num(pr.heldMost), held = K.stepHeld < most ? K.stepHeld : most;
          aim = atan2(p.vy, p.vx);
          len += num(pr.held) * held * sh.reach * C.reach;
        } else if (!forced) return false;
      } else if (rule !== 'self') {
        if (Skills.pick(S, rule, C.x, C.y, len, 1, picked) > 0) {
          aim = atan2(picked[0].y - C.y, picked[0].x - C.x);
          picked[0] = null;
        } else if (!forced) return false;
      }
      let a = null;
      if (type.bare) {
        a = swell(S, slot, C.x, C.y, len, true, C.part, fillOf(pr));
        if (a === null) return false;
      } else if (type.ticks) {
        a = zone(S, slot, C.x, C.y, len, (pr.duration > 0 ? pr.duration : 1) * sh.duration, C.part);
        if (a === null) return false;
      } else {
        const n = Skills.wedge(S, slot, C.x, C.y, len, aim, open, C.part, false);
        if (n === 0 && !forced) return false;
        a = Skills.area(S, slot, Skills.MARK, C.x, C.y, len, MARK_SECONDS);
      }
      if (a !== null) { a.angle = aim; a.a3 = open; }
      Skills.landed(C.x + cos(aim) * len, C.y + sin(aim) * len);
      Skills.where(C.x, C.y);
      return true;
    },
    step: Skills.areaStep,
  });

  // ---- the cross of Louvres ----

  Skills.cross = function (S, slot, forced) {
    const sh = Skills.shape(S, slot), pr = sh.params, type = typeOf(S, slot);
    if (type === undefined) return false;
    const len = (pr.reach > 0 ? pr.reach * sh.reach : pr.length > 0 ? pr.length * sh.reach : num(pr.radius) * sh.area) * C.reach;
    if (!(len > 0) || (!forced && Skills.count(S, C.x, C.y, len) === 0)) return false;
    const part = C.part * (1 + num(harmOf(S, slot).params['louvre-more']) / 100), c = S.combat;
    let toward = -PI / 2;                          // north, where the district has no bell-post
    if (c && c.post) {
      const dx = c.postX - C.x, dy = c.postY - C.y;
      if (dx * dx + dy * dy > 1e-6) toward = atan2(dy, dx);
    }
    for (let k = 0; k < 4; k++) {
      const aim = toward + k * PI / 2;
      let a = null;
      if (type.bare) a = swell(S, slot, C.x, C.y, LOUVRE_HALF, true, part, fillOf(pr));
      else if (type.ticks) a = zone(S, slot, C.x, C.y, LOUVRE_HALF, (pr.duration > 0 ? pr.duration : 1) * sh.duration, part);
      else {
        Skills.lane(S, slot, C.x, C.y, aim, len, LOUVRE_HALF, part, false);
        a = Skills.area(S, slot, Skills.MARK, C.x, C.y, LOUVRE_HALF, MARK_SECONDS);
      }
      if (a !== null) { a.angle = aim; a.len = len; }
    }
    Skills.landed(C.x, C.y);
    Skills.where(C.x, C.y);
    return true;
  };
})();
