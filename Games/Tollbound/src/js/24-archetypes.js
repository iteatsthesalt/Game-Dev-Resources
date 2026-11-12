// 24-archetypes.js: the shapes voices speak in: ring, rap, bar, spark and cone (docs/design/02-combat.md, 15.14).
// Each delivers the one kind of harm its voice deals: a Blow strikes at once whatever the shape covers and leaves its
// mark for a moment; Drag lays a zone there that the Drag ticks bite through (Dmg.tick); a Swell lays an area that
// fills for the voice's fill and then lands (Skills.areaStep): spreading from the player where the shape starts at
// the player, falling where it was aimed otherwise, and the dead's lee works against a spreading one.
// Owns: Skills (it registers the archetypes with Skills.archetype and adds nothing else)
// Public: nothing beyond the archetypes; their params, from the voice's params at its level (lengths in metres,
// times in seconds; the sheet's area, reach, duration and throw-speed multiply what they name):
//   ring   a circle of radius (x area) round the voice's point (Skills.point: 'self' the player, 'mark' the mark,
//          else the body the rule picks within reach x reach). A Blow strikes every body inside; Drag lays a zone
//          for duration (x duration); a Swell fills for fill. Round 'mark': still (percent more harm for each second
//          the mark has stayed put) and stillMost (at most that much more).
//   rap    the bodies the rule picks within reach (count of them, 1 if none is given). A Blow strikes each, and the
//          dead within splash (x area) of it; Drag tells it: a zone of radius splash (else just over the body) that
//          follows it for strokes ticks (strokesLarge for a large body, strokesElite for an elite or a keeper; twice
//          and three times strokes when not given), and if it falls before the count is done the strokes left over
//          are told on its nearest neighbour within reach, counting pass times (2 if not given); a Swell falls on
//          its place, radius splash, for fill.
//   bar    the line from the voice's post to the player while it is no longer than length (else the player's
//          bar-length), x reach: a Blow strikes what lies within width / 2 (x area) of it; Drag lays the lane as a
//          zone for duration; a Swell fills along it from the post. The post stands where the vigil began until
//          something moves it: S.skills[slot].a0, a1 are its place, a2 = 1 once it stands.
//   spark  count (1 if none is given) + throws thrown things at the bodies the rule picks within reach (straight
//          along the aim when the pull asks and none is in reach), at speed (x throw-speed), radius size. A Blow
//          strikes each body it meets, passing through pierce of them; a Drag or Swell spark opens a zone or a
//          falling Swell of radius splash where it first meets a body or where its flight ends.
//   cone   a wedge length (x reach) long and angle degrees wide from the player: at the body the rule picks within
//          length ('aim' along the aim, 'self' the way the player faces). A Blow strikes every body inside; Drag
//          lays the wedge as a zone for duration; a Swell fills it, spreading from the player.
(function () {
  'use strict';

  const DT = Core.DT, PI = Math.PI;
  const sqrt = Math.sqrt, atan2 = Math.atan2, floor = Math.floor;
  const SLIVER = 1e-9;
  const MARK_SECONDS = 0.25;     // how long the mark of a Blow lies
  const FILL_SECONDS = 1;        // a Swell's fill when its voice gives none
  const SWELL_IN = 2;            // metres: a Swell is laid if one of the dead is within this of its edge
  const SPARK_SPEED = 14, SPARK_SIZE = 0.2, BAR_WIDTH = 1;
  const RAP_PASS = 2;

  const P = { x: 0, y: 0, body: null };
  const picked = new Array(64).fill(null), met = new Array(1024).fill(null);

  const sheetOf = (S, slot) => S.skills[slot].sheet;
  const typeOf = (ss) => Stats.TYPES[Skills.kind(ss)];
  const fillOf = (pr) => (pr.fill > 0 ? pr.fill : FILL_SECONDS);
  const countOf = (pr) => (pr.count >= 1 ? floor(pr.count) : 1);

  // a Swell or a zone at (x, y) of radius r for the voice in slot; null when the pool of areas is full
  function swell(S, slot, x, y, r, spreading) {
    const a = Skills.area(S, slot, Skills.FILL, x, y, r, fillOf(sheetOf(S, slot).params) + DT);
    if (a !== null) a.a0 = spreading ? 1 : 0;
    return a;
  }
  function zone(S, slot, x, y, r, seconds) {
    const a = Skills.area(S, slot, Skills.ZONE, x, y, r, seconds);
    if (a !== null) a.tick = Skills.TICK;
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

  Skills.archetype('ring', {
    cast: function (S, slot, forced) {
      const ss = sheetOf(S, slot), pr = ss.params, rule = ss.def.target, type = typeOf(ss);
      if (type === undefined || !Skills.point(S, slot, rule, (pr.reach > 0 ? pr.reach : 0) * ss.reach, P)) return false;
      const r = (pr.radius > 0 ? pr.radius : 0) * ss.area;
      if (!(r > 0)) return false;
      if (type.bare) {
        if (!forced && Skills.count(S, P.x, P.y, r + SWELL_IN) === 0) return false;
        const a = swell(S, slot, P.x, P.y, r, rule === 'self');
        if (a === null) return false;
        a.a1 = stillPart(S, pr, rule, fillOf(pr));
      } else if (type.ticks) {
        if (!forced && Skills.count(S, P.x, P.y, r) === 0) return false;
        if (zone(S, slot, P.x, P.y, r, (pr.duration > 0 ? pr.duration : 1) * ss.duration) === null) return false;
      } else {
        const n = Skills.circle(S, slot, P.x, P.y, r, stillPart(S, pr, rule, 0), false);
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
      const ss = sheetOf(S, slot), pr = ss.params, type = typeOf(ss), p = S.player;
      if (type === undefined) return false;
      const n = Skills.pick(S, ss.def.target, p.x, p.y, (pr.reach > 0 ? pr.reach : 0) * ss.reach, countOf(pr), picked);
      if (n === 0) return false;
      const splash = (pr.splash > 0 ? pr.splash : 0) * ss.area;
      for (let i = 0; i < n; i++) {
        const b = picked[i];
        if (type.bare) swell(S, slot, b.x, b.y, splash > b.r ? splash : b.r, false);
        else if (type.ticks) {
          const a = zone(S, slot, b.x, b.y, splash > 0 ? splash : b.r + 0.3, Skills.strokes(S, strokesOf(pr, b)));
          if (a !== null) { a.target = b.uid; a.a2 = pr.pass > 0 ? pr.pass : RAP_PASS; }
        } else {
          if (splash > 0) Skills.circle(S, slot, b.x, b.y, splash, 1, false, p.x, p.y);
          else Dmg.hitEnemy(S, slot, b, 1, p.x, p.y);
          Skills.area(S, slot, Skills.MARK, b.x, b.y, splash > b.r ? splash : b.r, MARK_SECONDS);
        }
        picked[i] = null;
      }
      Skills.where(p.x, p.y);
      return true;
    },
    // a told zone follows its body; when the body has fallen the strokes left are told on its nearest neighbour
    step: function (S, a, slot) {
      Skills.areaStep(S, a, slot);
      if (a.state !== Skills.ZONE || a.target === 0 || !(a.tick > 0)) return;
      const b = Skills.find(S, a.target, a.x, a.y);
      if (b !== null && b.life > 0) { a.x = b.x; a.y = b.y; return; }
      const ss = sheetOf(S, slot), reach = (ss.params.reach > 0 ? ss.params.reach : 0) * ss.reach;
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
      a.tick = Skills.TICK * a.a2;
    },
  });

  // ---- bar ----

  Skills.archetype('bar', {
    cast: function (S, slot, forced) {
      const sk = S.skills[slot], ss = sk.sheet, pr = ss.params, type = typeOf(ss), p = S.player;
      if (type === undefined) return false;
      if (!(sk.a2 > 0)) { sk.a0 = S.region.startX; sk.a1 = S.region.startY; sk.a2 = 1; }
      const ax = sk.a0, ay = sk.a1, dx = p.x - ax, dy = p.y - ay, len = sqrt(dx * dx + dy * dy);
      const most = (pr.length > 0 ? pr.length : S.sheet.stats['bar-length']) * ss.reach;
      if (len > most || len < 0.1) return false;    // past its length the bar drops until you come back
      const half = (pr.width > 0 ? pr.width : BAR_WIDTH) / 2 * ss.area, aim = atan2(dy, dx);
      let a = null;
      if (type.bare) {
        a = Skills.area(S, slot, Skills.FILL, ax, ay, half, fillOf(pr) + DT);
        if (a === null) return false;
        a.a0 = 1;
      } else if (type.ticks) {
        a = zone(S, slot, ax, ay, half, (pr.duration > 0 ? pr.duration : 1) * ss.duration);
        if (a === null) return false;
      } else {
        const n = Skills.lane(S, slot, ax, ay, aim, len, half, 1, false);
        if (n === 0 && !forced) return false;
        a = Skills.area(S, slot, Skills.MARK, ax, ay, half, MARK_SECONDS);
      }
      if (a !== null) { a.angle = aim; a.len = len; }
      Skills.where(p.x, p.y);
      return true;
    },
    step: Skills.areaStep,
  });

  // ---- spark ----

  function fling(S, slot, ux, uy, ss, pr, reach) {
    const o = S.shots.alloc();
    if (o === null) return false;
    const p = S.player, speed = (pr.speed > 0 ? pr.speed : SPARK_SPEED) * ss['throw-speed'], id = S.skills[slot].inst.id;
    o.def = Defs.has('attack', id) ? Defs.get('attack', id) : null;
    o.team = 0;
    o.owner = 0;
    o.skill = slot;
    o.x = p.x;
    o.y = p.y;
    o.vx = ux * speed;
    o.vy = uy * speed;
    o.r = pr.size > 0 ? pr.size : SPARK_SIZE;
    o.face = atan2(uy, ux);
    o.pierce = ss.pierce;
    o.ttl = (reach > 0 ? reach : 1) / speed + DT;
    return true;
  }

  // a Drag or Swell spark opens its area where it meets a body or where its flight ends
  function burst(S, o, slot, type, pr) {
    const r = pr.splash > 0 ? pr.splash : 1;
    if (type.bare) swell(S, slot, o.x, o.y, r, false);
    else zone(S, slot, o.x, o.y, r, (pr.duration > 0 ? pr.duration : 1) * sheetOf(S, slot).duration);
    o.ttl = 0;
  }

  function struck(o, uid) {
    const n = o.hitN < o.hits.length ? o.hitN : o.hits.length;
    for (let i = 0; i < n; i++) if (o.hits[i] === uid) return true;
    return false;
  }

  function flight(S, o, slot) {
    const ss = sheetOf(S, slot), pr = ss.params, type = typeOf(ss);
    if (type === undefined || !(o.ttl > 0)) return;
    const x0 = o.x, y0 = o.y;
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
        Dmg.hitEnemy(S, slot, e, 1, x0, y0);
        o.hits[o.hitN % o.hits.length] = e.uid;
        o.hitN++;
        if (o.hitN > o.pierce) { o.ttl = 0; return; }
      } else { burst(S, o, slot, type, pr); return; }
    }
    if ((type.bare || type.ticks) && o.ttl <= DT + SLIVER) burst(S, o, slot, type, pr);
  }

  Skills.archetype('spark', {
    cast: function (S, slot, forced) {
      const ss = sheetOf(S, slot), pr = ss.params, p = S.player, reach = (pr.reach > 0 ? pr.reach : 0) * ss.reach;
      const n = Skills.pick(S, ss.def.target, p.x, p.y, reach, countOf(pr) + ss.throws, picked);
      if (n === 0 && !forced) return false;
      let thrown = 0;
      for (let i = 0; i < (n > 0 ? n : 1); i++) {
        let ux = p.aimX, uy = p.aimY;
        if (n > 0) {
          const dx = picked[i].x - p.x, dy = picked[i].y - p.y, d = sqrt(dx * dx + dy * dy);
          if (d > 1e-6) { ux = dx / d; uy = dy / d; }
          picked[i] = null;
        }
        if (fling(S, slot, ux, uy, ss, pr, reach)) thrown++;
      }
      if (thrown === 0) return false;
      Skills.where(p.x, p.y);
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
      const ss = sheetOf(S, slot), pr = ss.params, rule = ss.def.target, type = typeOf(ss), p = S.player;
      const len = (pr.length > 0 ? pr.length : 0) * ss.reach, open = (pr.angle > 0 ? pr.angle : 0) * PI / 180;
      if (type === undefined || !(len > 0) || !(open > 0)) return false;
      let aim = p.face;
      if (rule === 'aim') aim = atan2(p.aimY, p.aimX);
      else if (rule !== 'self') {
        if (Skills.pick(S, rule, p.x, p.y, len, 1, picked) > 0) {
          aim = atan2(picked[0].y - p.y, picked[0].x - p.x);
          picked[0] = null;
        } else if (!forced) return false;
      }
      let a = null;
      if (type.bare) {
        a = swell(S, slot, p.x, p.y, len, true);
        if (a === null) return false;
      } else if (type.ticks) {
        a = zone(S, slot, p.x, p.y, len, (pr.duration > 0 ? pr.duration : 1) * ss.duration);
        if (a === null) return false;
      } else {
        const n = Skills.wedge(S, slot, p.x, p.y, len, aim, open, 1, false);
        if (n === 0 && !forced) return false;
        a = Skills.area(S, slot, Skills.MARK, p.x, p.y, len, MARK_SECONDS);
      }
      if (a !== null) { a.angle = aim; a.a3 = open; }
      Skills.where(p.x, p.y);
      return true;
    },
    step: Skills.areaStep,
  });
})();
