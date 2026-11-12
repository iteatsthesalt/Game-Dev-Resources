// tests/scenarios/33-scene-language.js: the screen language of docs/design/02-combat.md, section 13, as 68-scene.js
// draws it from a vigil of the Dial, in the buffers of a frame and in its pixels, in both views.
//   - under a body its posture: a closed pale ring when Braced, two short streaks behind it when Striding; a white
//     outline round a Wrong-footed figure (a shell of white parts turned inside out; a white ring in the plain view)
//   - the wake as a faint line from the player, and a thread from a body In Procession to the wake's nearest point
//   - wounds as deep red discs 1 m across, darker for deeper, greyer for older, with a ring closing as one mends
//   - a Swell filling in pale bone with a dark rim, the lee of a heavy and of the stones cut out of it: by pixels,
//     ground in lee stays as it was while ground beside it is filled; a falling Swell darkens from its rim
//   - a Blow's wind-up: the striking parts its attack names white at the top
//   - conditions: mourning black, riders, Sounded, Coiled, swing ticks, a wax seal, coins at the eyes, and
//     Tolled-for: a grey world in which the far lychgate's lamps keep their colour, and a lit way toward it
//   - the lychgate's ring filling stroke by stroke; a favour's figure rising out of the ground
//   - the Dial's shadow as a dark wedge from the bell-post, as the director keeps it, darker figures in it
//   - with 600 of the dead: at most 24 draw calls and 10 000 parts, and the time Scene.draw takes (information)
// The frame loop is stopped and frames are drawn straight through Scene.draw, so nothing moves between a change
// and the frame that shows it. Each function below runs inside the page (see tests/run.js).

// Shared set-up: a vigil of the Dial with the Change-ringer, its loop stopped, and helpers over the frame.
const prelude = function () {
  const { Game, Player, Plat, Scene, Sim, Stats, Defs, Rigs } = TB;
  const S = Game.start(Object.assign({ zone: 'dial', seed: 3 }, Player.classRun('change-ringer')));
  Plat.stop();
  const p = S.player, A = Stats.AILMENT, L = Scene.LOOK;
  const near = (a, b, e) => Math.abs(a - b) < (e === undefined ? 0.03 : e);
  const same = (r, c, e) => near(r[3], c[0], e) && near(r[4], c[1], e) && near(r[5], c[2], e);         // a decal's colour
  const tinted = (r, c, e) => near(r[12], c[0], e) && near(r[13], c[1], e) && near(r[14], c[2], e);   // a part's
  const decals = () => { const B = Scene.buffers(), out = []; for (let i = 0; i < B.decalN; i++) out.push(Array.from(B.decals.slice(i * 11, i * 11 + 11))); return out; };
  const parts = () => { const B = Scene.buffers(), out = []; for (let s = 0; s < 5; s++) for (let i = 0; i < B.sink.n[s]; i++) out.push(Array.from(B.sink.buf[s].slice(i * B.sink.stride, (i + 1) * B.sink.stride))); return out; };
  const at = (rec, x, y, e) => near(rec[0], x, e === undefined ? 0.05 : e) && near(rec[1], y, e === undefined ? 0.05 : e);
  const partsNear = (x, y, reach) => parts().filter((r) => Math.hypot(r[3] - x, r[11] - y) < reach);
  const det = (r) => r[0] * (r[5] * r[10] - r[6] * r[9]) - r[1] * (r[4] * r[10] - r[6] * r[8]) + r[2] * (r[4] * r[9] - r[5] * r[8]);
  // one of the dead set down at (dx, dy) from the player, standing still and facing it
  const put = (id, dx, dy) => {
    const e = Sim.spawnEnemy(S, id, p.x + dx, p.y + dy);
    e.px = e.x; e.py = e.y; e.vx = 0; e.vy = 0; e.face = Math.atan2(-dy, -dx);
    return e;
  };
  // clears the dead near the player, so that the checks own the ground they look at
  for (let i = 0; i < S.enemies.n; i++) S.enemies.items[i].alive = false;
  S.enemies.compact();
  return { S, p, A, L, near, same, tinted, decals, parts, at, partsNear, det, put, Scene, Sim, Stats, Defs, Rigs };
};

// Posture, Wrong-footed, the wake and its threads, wounds, a wind-up and the conditions, in the buffers.
const marks = async function (P) {
  const { Gfx, Dmg } = TB;
  const view = Gfx.active, puppets = !!(view && view.caps.puppets);
  const { S, p, A, L, same, tinted, decals, at, partsNear, det, put, Scene, Sim, Rigs } = P;
  const POSE = Dmg.POSE;
  // walk the player east for two seconds so that it leaves a wake
  for (let i = 0; i < 120; i++) Sim.step(S, { mx: 1, my: 0, ax: 1, ay: 0, aim: false, trade: false, heave: false });
  for (let i = 0; i < S.enemies.n; i++) S.enemies.items[i].alive = false;
  S.enemies.compact();
  p.px = p.x; p.py = p.y;
  // ---- posture ----
  const braced = put('dial.wake-walker', -2, -2.5), striding = put('dial.wake-walker', 2.5, -2.5);
  braced.pose = POSE.braced;
  striding.pose = POSE.striding; striding.vx = 2.4; striding.vy = 0;
  p.pose = POSE.braced;
  Scene.draw(S, 1);
  let D = decals();
  const ring = D.filter((r) => at(r, braced.x, braced.y) && r[8] === Scene.RING && same(r, L.posture) && r[7] < 0);
  T.check('a Braced body has a closed pale ring under it', ring.length === 1 && ring[0][2] > braced.r && ring[0][2] < braced.r + 0.5, ring);
  const streaks = D.filter((r) => r[8] === Scene.BAR && same(r, L.posture) && Math.hypot(r[0] - striding.x, r[1] - striding.y) < striding.r + 0.4);
  T.check('a Striding body has two short streaks trailing behind it', streaks.length === 2 && streaks.every((r) => Math.cos(r[9]) < -0.95 && r[0] < striding.x &&
    r[2] > 0.3 && r[2] < 1.4), streaks.map((r) => r.slice(0, 3).concat([r[9]])));
  T.check('the player\'s posture is marked as every body\'s', D.some((r) => at(r, p.x, p.y) && r[8] === Scene.RING && same(r, L.posture)));
  // ---- Wrong-footed: a white outline ----
  const before = partsNear(braced.x, braced.y, 1.2).length;
  braced.condT[A['wrong-footed']] = 0.4;
  Scene.draw(S, 1);
  if (puppets) {
    const near = partsNear(braced.x, braced.y, 1.2), shells = near.filter((r) => det(r) < 0 && r[12] === 1 && r[13] === 1 && r[14] === 1);
    T.check('a Wrong-footed body is drawn with a white shell of every part round it', shells.length >= before / 2 - 1 && near.length >= 2 * before - 2,
      { before, after: near.length, shells: shells.length });
  } else {
    T.check('in the plain view a Wrong-footed body has a white ring round it', decals().some((r) => at(r, braced.x, braced.y) && r[8] === Scene.RING && same(r, L.white)));
  }
  braced.condT[A['wrong-footed']] = 0;
  // ---- the wake and the threads ----
  striding.condN[A['in-procession']] = 1;
  Scene.draw(S, 1);
  D = decals();
  const wake = D.filter((r) => r[8] === Scene.BAR && same(r, L.wake) && r[10] > 0.05);   // a thread is thinner
  const from = wake.map((r) => +Math.hypot(r[0] - p.x, r[1] - p.y).toFixed(2));
  T.check('the wake is a faint line of short bars from the player back along its path', wake.length >= 10 && wake.every((r) => r[6] < 0.45) &&
    Math.min(...from) < 0.6, { bars: wake.length, alpha: wake.length && wake[0][6], fromPlayer: from.slice(0, 4) });
  const thread = D.filter((r) => r[8] === Scene.BAR && same(r, L.thread) && at(r, striding.x, striding.y));
  const W = S.wake;
  let best = Infinity;
  for (let j = 0, k = W.head; j < W.n; j++, k = (k + W.x.length - 1) % W.x.length) best = Math.min(best, Math.hypot(W.x[k] - striding.x, W.y[k] - striding.y));
  T.check('a body In Procession has a thin thread to the nearest point of the wake', thread.length === 1 && Math.abs(thread[0][2] - best) < 0.05 && thread[0][10] < 0.06,
    { thread: thread[0] && thread[0].slice(0, 3), nearest: best });
  // ---- wounds ----
  const w = S.wounds;
  const wound = (dx, dy, life, depth, age, back) => {
    const i = w.n++;
    w.x[i] = p.x + dx; w.y[i] = p.y + dy; w.life[i] = life; w.depth[i] = depth; w.opened[i] = S.t - age; w.back[i] = back; w.told[i] = back;
    return [w.x[i], w.y[i]];
  };
  const fresh = wound(-3, 2, 6, 0, 1, 0), deep = wound(-1, 2.5, 6, 2.5, 1, 0), old = wound(1, 2.5, 6, 0, 55, 0), mending = wound(0.2, 0.1, 3, 0.5, 3, 3);
  Scene.draw(S, 1);
  D = decals();
  const disc = (c) => D.find((r) => at(r, c[0], c[1]) && r[8] === Scene.DISC && Math.abs(r[2] - 0.5) < 0.01);
  const fd = disc(fresh), dd = disc(deep), od = disc(old), md = disc(mending);
  const red = (r) => r && r[3] > r[4] * 3 && r[3] > r[5] * 3;
  const sum = (r) => r[3] + r[4] + r[5];
  T.check('a wound is a deep red disc 1 m across where it was opened', red(fd) && red(dd) && !!md, fd && fd.slice(0, 7));
  T.check('a deeper wound is darker', !!dd && sum(dd) < sum(fd) * 0.75, { fresh: fd && fd.slice(3, 6), deep: dd && dd.slice(3, 6) });
  T.check('a wound near its scar is greyer', !!od && (od[3] - od[4]) < (fd[3] - fd[4]) * 0.5, { fresh: fd.slice(3, 6), old: od && od.slice(3, 6) });
  const closing = D.find((r) => at(r, mending[0], mending[1]) && r[8] === Scene.RING && same(r, L.mend));
  T.check('a wound being given back has a pale ring closing on it, bright while the player is Braced on it', !!closing && closing[2] < 0.36 &&
    closing[6] > 0.9, closing && closing.slice(0, 7));
  // ---- a Blow's wind-up: the arms (the clutch's fx.part) white at its top ----
  const clutch = put('dial.wake-walker', 0, -3.5);
  clutch.state = Scene.ATTACK.windup; clutch.attack = 0; clutch.a1 = 0.6; clutch.stateT = 0.6;
  Scene.draw(S, 1);
  if (puppets) {
    // the clutch names the arms: the parts on the arm and hand joints, the hands among them when detail is drawn
    const fig = Rigs.figure('dial.wake-walker'), J = fig.rig.index, onArms = [];
    for (let k = 0; k < fig.n; k++) if ((fig.joint[k] === J.armL || fig.joint[k] === J.armR || fig.joint[k] === J.handR) && (Scene.stats.detail || !fig.detail[k])) onArms.push(k);
    const mine = partsNear(clutch.x, clutch.y, 1.1), white = mine.filter((r) => r[15] > 0.95);
    T.check('at the top of its wind-up the striking parts (its arms and hands) are white, the rest not', white.length === onArms.length &&
      mine.length - white.length >= fig.counts.plain - 4, { white: white.length, arms: onArms.length, all: mine.length });
  }
  // ---- conditions ----
  const heavy = put('dial.heavy', 3.5, 1.5), mourner = put('dial.wake-walker', -3.5, -0.5), twin = put('dial.wake-walker', -3.5, 1.2);
  const swung = put('dial.wake-walker', 1.5, -4.5), sealed = put('dial.wake-walker', -1.2, -4.8), coined = put('dial.wake-walker', 3.6, -1);
  for (const e of [heavy, mourner, twin, swung, sealed, coined]) e.pose = POSE.still;
  Scene.draw(S, 1);
  const marks0 = Scene.stats.marks, plainHeavy = partsNear(heavy.x, heavy.y, 1.5).length;
  heavy.condT[A.sounded] = 4; heavy.condV[A.sounded] = 2;
  heavy.condT[A.coiled] = 8; heavy.condN[A.coiled] = 2;
  mourner.condT[A.mourning] = 10; mourner.condV[A.mourning] = 2;
  swung.condN[A.swing] = 4; swung.condV[A.swing] = 0.5;
  sealed.condT[A.sealed] = 10; sealed.condV[A.sealed] = 0.08;
  coined.condT[A.coined] = 4;
  p.condN[A.clung] = 2; p.condV[A.clung] = 2.5;
  Scene.draw(S, 1);
  D = decals();
  const ticks = D.filter((r) => r[8] === Scene.BAR && same(r, L.tick) && Math.hypot(r[0] - swung.x, r[1] - swung.y) < swung.r + 0.5);
  T.check('swing from 3: a tick for each, round the way the last Blow went', ticks.length === 4 &&
    ticks.every((r) => Math.cos(r[9] - 0.5) > -0.2), ticks.map((r) => +r[9].toFixed(2)));
  if (puppets) {
    const colourOf = (e) => partsNear(e.x, e.y, 0.8).reduce((s, r) => s + r[12] + r[13] + r[14], 0) / Math.max(1, partsNear(e.x, e.y, 0.8).length);
    T.check('a body in full mourning is drawn black', colourOf(mourner) < colourOf(twin) * 0.45, { mourning: colourOf(mourner), twin: colourOf(twin) });
    const hoops = partsNear(heavy.x, heavy.y, 1.6).length - plainHeavy;
    T.check('Sounded is two hoops round a heavy and Coiled a hoop of rope at its feet for each coil', hoops === 16 + 16, { added: hoops });
    const wax = partsNear(sealed.x, sealed.y, 1.2).filter((r) => tinted(r, L.wax, 0.02));
    T.check('sealed is a red wax disc on the body', wax.length === 1 && wax[0][7] > 0.4, wax.length);
    const coins = partsNear(coined.x, coined.y, 1.2).filter((r) => tinted(r, L.coin, 0.02));
    T.check('coined is two bright discs at the eyes', coins.length === 2 && coins.every((r) => r[7] > 1), coins.map((r) => +r[7].toFixed(2)));
    const riders = partsNear(p.x, p.y, 0.9).filter((r) => tinted(r, L.riderCap, 0.02));
    T.check('riders are small boxes stuck on the player, one for each', riders.length === 2 && riders.every((r) => r[7] > 0.6), riders.length);
    T.check('Scene.stats.marks counts them', Scene.stats.marks >= marks0 + 32 + 1 + 2 + 4, [marks0, Scene.stats.marks]);
  } else {
    T.check('in the plain view Sounded and Coiled are rings round the heavy', D.filter((r) => at(r, heavy.x, heavy.y) && r[8] === Scene.RING &&
      (same(r, L.sounded) || same(r, L.coil))).length === 4);
  }
  return T.done();
};

// A Swell filling with its lee cut out, by pixels: ground behind the heavy (in lee) stays as it was, ground beside
// it at the same distance from the source is filled in pale bone. And a falling Swell darkening from its rim.
const swell = async function (P) {
  const { Gfx, Enemies } = TB;
  const view = Gfx.active;
  const { S, p, L, same, decals, at, put, Scene, Defs } = P;
  // the source 6 m north of where the player began; a heavy 3 m south of the source, so that its lee runs south;
  // the points looked at stand 4.5 m from the source, one behind the heavy, one 45 degrees round from it. The
  // player stands off to the south-east, where neither it nor its rope covers them.
  const sx = p.x, sy = p.y - 6, maker = put('dial.wake-walker', 0, -6), heavy = put('dial.heavy', 0, -3);
  maker.pose = heavy.pose = 0;
  p.x = p.px = sx + 4; p.y = p.py = sy + 7;
  const round = Defs.get('attack', 'dial.keeper.round');
  const area = Enemies.swell(S, maker, round, sx, sy, Math.PI / 2, 1, 2);
  T.check('a spreading Swell is shown as an area', !!area && area.r > 5, area && area.r);
  if (!area) return T.done();
  area.t = 1.6; area.ttl = 0.4;                       // 80% filled
  const lee = [sx, sy + 4.5], open = [sx + 3.18, sy + 3.18];
  for (let i = 0; i < 6; i++) Scene.draw(S, 1);       // the camera settles on the player
  const canvas = view.canvas, kx = canvas.width / innerWidth, ky = canvas.height / innerHeight, scr = { x: 0, y: 0 };
  const read = (x, y) => {
    Gfx.worldToScreen(x, y, 0, scr);
    let px;
    if (view.name === 'gl') px = view.readPixels(Math.round(scr.x * kx) - 1, Math.round(scr.y * ky) - 1, 3, 3);
    else px = canvas.getContext('2d').getImageData(Math.round(scr.x * kx) - 1, Math.round(scr.y * ky) - 1, 3, 3).data;
    const s = [0, 0, 0];
    for (let i = 0; i < px.length; i += 4) { s[0] += px[i]; s[1] += px[i + 1]; s[2] += px[i + 2]; }
    return s.map((v) => v / 9);
  };
  const lum = (c) => (c[0] + c[1] + c[2]) / 3;
  Scene.draw(S, 1);
  const D = decals();
  const fill = D.find((r) => at(r, sx, sy) && r[8] === Scene.RING + Scene.CUT && same(r, L.bone)), rim = D.find((r) => at(r, sx, sy) &&
    r[8] === Scene.RING + Scene.CUT && same(r, L.rim));
  T.check('its fill in pale bone, filled 80% from its source, and its dark rim, both cut by lee', !!fill && Math.abs(fill[7] - 0.8) < 0.02 && !!rim && rim[7] === 0,
    { fill: fill && fill.slice(0, 9), rim: rim && rim.slice(0, 9) });
  const lees = D.filter((r) => r[8] === Scene.LEE);
  T.check('the heavy is a lee record, its reach the player\'s lee-reach', lees.some((r) => at(r, heavy.x, heavy.y) && Math.abs(r[2] - heavy.r) < 1e-3 &&
    Math.abs(r[10] - S.sheet.stats['lee-reach']) < 1e-3), lees.map((r) => [r[0], r[1], r[2], r[10]]));
  T.check('the Swell\'s own maker, standing over its source, is no lee record of it, and small bodies are none at all',
    !lees.some((r) => at(r, maker.x, maker.y)), lees.length);
  const withSwell = [read(lee[0], lee[1]), read(open[0], open[1])];
  area.alive = false;
  Scene.draw(S, 1);
  const bare = [read(lee[0], lee[1]), read(open[0], open[1])];
  area.alive = true;
  T.check('ground beside the heavy is filled in pale bone (brighter than the bare ground)', lum(withSwell[1]) > lum(bare[1]) + 18, { swell: withSwell[1], bare: bare[1] });
  T.check('ground in the heavy\'s lee is left as it was: the lee is cut out as clean ground', Math.abs(lum(withSwell[0]) - lum(bare[0])) < 8,
    { swell: withSwell[0], bare: bare[0] });
  // a falling Swell darkens from its rim inward
  const load = Defs.get('attack', 'dial.load'), fall = Enemies.swell(S, maker, load, p.x - 2, p.y + 3, 0, 1, 2);
  fall.t = 1; fall.ttl = 1;
  Scene.draw(S, 1);
  const f = decals().find((r) => at(r, fall.x, fall.y) && r[8] === Scene.RING && same(r, L.fall));
  T.check('a falling Swell darkens from its rim inward, and takes no lee', !!f && Math.abs(f[7] + 0.5) < 0.02, f && f.slice(0, 9));
  const rimAt = read(fall.x + 1.8, fall.y), middle = read(fall.x, fall.y + 0.2);
  T.check('by pixels: its outer half dark, its middle not yet', lum(rimAt) < lum(middle) - 10, { rim: rimAt, middle });
  return T.done();
};

// The lychgate's ring, a favour rising, the Dial's shadow, and Tolled-for's grey world with its lit far lychgate.
const place = async function (P) {
  const { Gfx } = TB;
  const view = Gfx.active, puppets = !!(view && view.caps.puppets);
  const { S, p, A, L, same, decals, at, partsNear, put, Scene, Sim, Defs, Rigs } = P;
  // ---- the lychgate: two strokes rung, the third half rung ----
  S.gate = { x: p.x + 4, y: p.y + 2, until: S.t + 30, far: false, ring: 2.5, strokes: 2 };
  Scene.draw(S, 1);
  let D = decals();
  const arcs = D.filter((r) => at(r, S.gate.x, S.gate.y) && r[8] === Scene.SECTOR && same(r, L.lamp)).map((r) => +r[10].toFixed(3));
  const part = Math.PI * 2 / 6;
  T.check('the lychgate\'s ring: an arc for each stroke rung and the one ringing now half swept', arcs.length === 3 &&
    arcs.filter((a) => Math.abs(a - (part - 0.08)) < 0.01).length === 2 && arcs.some((a) => Math.abs(a - (part - 0.08) / 2) < 0.02), arcs);
  if (puppets) T.check('and the lychgate itself is drawn there', partsNear(S.gate.x, S.gate.y, 2.2).length >= Rigs.figure('gate').counts.plain);
  // ---- a favour rising out of the ground ----
  const favour = Defs.all('favour').find((f) => typeof f.icon === 'string' && Rigs.figure('favour.' + f.icon));
  const o = S.pickups.alloc();
  o.kind = 3; o.item = favour; o.value = 1; o.ttl = 8; o.x = o.px = p.x - 3; o.y = o.py = p.y + 2;
  Scene.draw(S, 1);
  const low = partsNear(o.x, o.y, 0.8);
  for (let i = 0; i < 40; i++) { Sim.step(S, Sim.NO_INPUT); o.x = o.px = p.x - 3; o.y = o.py = p.y + 2; o.ttl = 8; }
  for (let i = 0; i < S.enemies.n; i++) S.enemies.items[i].alive = false;   // the dead risen meanwhile
  S.enemies.compact();
  Scene.draw(S, 1);
  const risen = partsNear(o.x, o.y, 0.8), fig = Rigs.figure('favour.' + favour.icon);
  if (puppets) {
    T.check('a favour rises as the solid figure of its motif', risen.length >= fig.n && Scene.stats.favours >= 1, { motif: favour.icon, parts: risen.length, of: fig.n });
    const top = (list) => list.reduce((m, r) => Math.max(m, r[7] + r[5]), -9);
    T.check('out of the ground: lower when it is first seen than once it has risen', top(low) < top(risen) - 0.3, { first: top(low), risen: top(risen) });
  } else T.check('in the plain view a favour is a disc of its colour', Scene.stats.favours >= 1);
  // ---- the Dial's shadow ----
  const sh = S.vigil && S.vigil.shade;
  T.check('the director keeps the Dial\'s shadow', !!sh && sh.on === true && sh.span > 1, sh);
  D = decals();
  const wedge = D.find((r) => r[8] === Scene.SECTOR && at(r, sh.x, sh.y) && r[2] > 30);
  T.check('it is drawn as a dark wedge from the bell-post, where the director has it', !!wedge && Math.abs(wedge[10] - sh.span) < 1e-3 &&
    Math.abs(Math.cos(wedge[9] - (sh.from + sh.span / 2)) - 1) < 1e-4 && wedge[3] + wedge[4] + wedge[5] < 1, wedge && wedge.slice(0, 11));
  if (puppets) {
    // a body inside the wedge and its twin outside, both 14 m from the post
    const mid = sh.from + sh.span / 2, out = mid + Math.PI;
    const inside = put('dial.wake-walker', sh.x + Math.cos(mid) * 14 - p.x, sh.y + Math.sin(mid) * 14 - p.y);
    const outside = put('dial.wake-walker', sh.x + Math.cos(out) * 14 - p.x, sh.y + Math.sin(out) * 14 - p.y);
    inside.pose = outside.pose = 0;
    S.player.x = S.player.px = sh.x; S.player.y = S.player.py = sh.y + 1;
    Scene.camera.zoom = 0.55;
    for (let i = 0; i < 3; i++) Scene.draw(S, 1);
    const shade = (e) => { const list = partsNear(e.x, e.y, 0.8); return list.reduce((s, r) => s + r[12] + r[13] + r[14], 0) / Math.max(1, list.length); };
    T.check('the dead in the shadow are drawn darker', shade(inside) > 0 && shade(inside) < shade(outside) * 0.8, { inside: shade(inside), outside: shade(outside) });
    Scene.camera.zoom = 1;
  }
  // ---- Tolled-for: a grey world, the far lychgate lit and the way to it ----
  S.player.x = S.player.px = sh.x + 2; S.player.y = S.player.py = sh.y + 8;
  S.gate = { x: S.player.x + 2, y: S.player.y - 5, until: S.t + 30, far: true, ring: 0, strokes: 0 };
  p.condT[A['tolled-for']] = 20;
  for (let i = 0; i < 14; i++) { Scene.draw(S, 1); await T.sleep(50); }   // the colour goes over about 0.4 s
  Scene.draw(S, 1);
  T.check('Tolled-for: the world loses its colour', Scene.stats.grey === 1, Scene.stats.grey);
  const B = Scene.buffers();
  let way = 0;
  for (let i = 0; i < B.billboardN; i++) if (B.billboards[i * 9 + 8] > 0.5 && same([0, 0, 0].concat(Array.from(B.billboards.slice(i * 9 + 4, i * 9 + 7))), L.lamp)) way++;
  T.check('and a lit way of warm motes runs from the player toward the far lychgate', way >= 3, way);
  if (view.name === 'gl') {
    const canvas = view.canvas, kx = canvas.width / innerWidth, ky = canvas.height / innerHeight, scr = { x: 0, y: 0 };
    const sat = (x, y, z) => {
      Gfx.worldToScreen(x, y, z, scr);
      const px = view.readPixels(Math.round(scr.x * kx) - 2, Math.round(scr.y * ky) - 2, 5, 5);
      let most = 0;
      for (let i = 0; i < px.length; i += 4) most = Math.max(most, Math.max(px[i], px[i + 1], px[i + 2]) - Math.min(px[i], px[i + 1], px[i + 2]));
      return most;
    };
    const ground = sat(S.player.x - 3, S.player.y + 2, 0), lamp = sat(S.gate.x + 1.35, S.gate.y + 0.84, 1.85);
    T.check('by pixels: the ground grey, the lychgate\'s lamps still warm', ground < 14 && lamp > 40, { ground, lamp });
  }
  return T.done();
};

// 600 of the dead on the Dial: the budgets of a frame, and the time Scene.draw takes (information: software WebGL
// here, on a shared machine).
const budget = async function (P) {
  const { Gfx, Enemies } = TB;
  const view = Gfx.active;
  const { S, p, A, Scene, Sim, Defs } = P;
  // a wake walked, and the director's shadow, first; then the dead, a third of them In Procession, and three Swells
  for (let i = 0; i < 120; i++) Sim.step(S, { mx: 0.8, my: 0.6, ax: 1, ay: 0, aim: false, trade: false, heave: false });
  for (let i = 0; i < S.enemies.n; i++) S.enemies.items[i].alive = false;
  S.enemies.compact();
  p.px = p.x; p.py = p.y;
  const ids = ['dial.wake-walker', 'dial.wake-walker', 'dial.wake-walker', 'dial.hanger-on', 'dial.heavy'];
  let n = 0;
  for (let ring = 0; n < 600; ring++) {
    const R = 2 + ring * 1.1, count = Math.min(600 - n, Math.floor(Math.PI * 2 * R / 1.0));
    for (let k = 0; k < count; k++, n++) {
      const a = k / count * Math.PI * 2, e = Sim.spawnEnemy(S, ids[n % ids.length], p.x + Math.cos(a) * R, p.y + Math.sin(a) * R);
      if (!e) break;
      e.px = e.x; e.py = e.y; e.vx = -Math.sin(a) * 2; e.vy = Math.cos(a) * 2; e.pose = n % 3 === 0 ? 3 : n % 3 === 1 ? 1 : 0; e.face = a + Math.PI / 2;
      if (n % 3 === 0 && e.rank === 0 && e.def.size === 'small') e.condN[A['in-procession']] = 1;
    }
  }
  T.check('600 of the dead stand on the Dial', S.enemies.n === 600, S.enemies.n);
  const maker = S.enemies.items[0];
  for (const [id, dx, dy] of [['dial.keeper.round', -4, -3], ['dial.keeper.sweep', 5, -2], ['dial.load', 1, 4]]) {
    const area = Enemies.swell(S, maker, Defs.get('attack', id), p.x + dx, p.y + dy, Math.PI / 2, 1, 2);
    if (area) { area.t = 1; area.ttl = 1; }
  }
  const times = [], fills = [], calls = [];
  for (let i = 0; i < 40; i++) {
    for (let k = 0; k < S.enemies.n; k++) { const e = S.enemies.items[k]; e.px = e.x; e.x += e.vx / 60; e.y += e.vy / 60; }
    const t0 = performance.now();
    Scene.draw(S, 1);
    times.push(performance.now() - t0);
    fills.push(Scene.stats.fillMs);
    calls.push(view.stats.drawCalls);
  }
  const med = (list) => list.slice().sort((a, b) => a - b)[list.length >> 1];
  const st = Object.assign({}, Scene.stats);
  T.check('with 600 of the dead the parts keep within 10 000, and every one on screen is drawn', st.parts <= 10000 && st.figures >= st.enemies, st);
  if (view.name === 'gl') T.check('and the 3D view draws the frame in at most 24 draw calls', Math.max(...calls) <= 24, Math.max(...calls));
  T.check('the time of Scene.draw for 600 of the dead (information: the budget is 2.5 ms on a real device)', st.swells === 3 && st.threads > 50 && st.wake > 5,
    { drawMs: +med(times).toFixed(2), fillMs: +med(fills).toFixed(2), decals: st.decals, parts: st.parts, figures: st.figures, drawCalls: Math.max(...calls),
      threads: st.threads, swells: st.swells, lees: st.lees, shadow: st.shadow });
  return T.done();
};

// A run function goes to the page as its source text, without its closure: so each one is put together here, in
// Node, from the source of the prelude and of the check, the prelude's result handed to the check.
const compose = (check) => new Function(`return async function () {
  const prelude = ${prelude.toString()};
  return (${check.toString()})(prelude());
};`)();

const checks = { marks, swell, place, budget };
module.exports = [];
for (const [view, size, mobile] of [['gl', { width: 960, height: 540 }, false], ['2d', { width: 960, height: 540 }, false], ['gl', { width: 390, height: 844 }, true]]) {
  for (const name of view === 'gl' && !mobile ? ['marks', 'swell', 'place', 'budget'] : ['marks', 'swell', 'place']) {
    module.exports.push({
      name: `scene language: ${name}, ${view === 'gl' ? '3D' : 'plain'} view ${size.width}x${size.height}`, viewport: size, mobile, query: 'view=' + view,
      timeout: 240000, run: compose(checks[name]),
    });
  }
}
