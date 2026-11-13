// tests/scenarios/32-dial-figures.js: the figures and the ground of the Dial (46-puppets-dial.js, 47-dial-ground.js),
// the rigs they move on (61-rigs.js) and the decal record both views draw (65-gfx.js, 66-gfx-gl.js, 67-gfx-2d.js).
//   - the ids both sides need exist and compile: the Change-ringer, the three dead of the Dial, the keeper, the
//     lychgate, the props with their roles, the tileset and its own fields, a figure for every favour's motif;
//     their sizes keep to the design (a hanger-on half a person, a heavy twice a wake-walker's width, a keeper two to
//     three times a person, the ringer's rope over its head) and to the dead's colliders where 41-dial.js has them
//   - every one of them draws: in the 3D view its parts change the picture where it stands; in the plain view the
//     scene draws it as a disc of its colour
//   - the rigs: a striking part whitens at the top of its wind-up and nothing else does; the Wrong-footed shell is
//     a white copy of each part, turned inside out; the ringer's rope stands upright while it walks and pulls; a
//     hop moves both feet together; lift raises a whole figure; Rigs.mask names joints
//   - the decal record is 11 floats, and both views draw each shape where it should be: a disc, a ring with its
//     middle clear, a sector only within its arc, a bar only along its length, fill from the middle and from the
//     rim, a lee record drawn as nothing, and a cut decal with the lee of a lee record left clean
// Pixels are compared with room to spare: software drawing differs a little between machines.
// Each function below runs inside the page (see tests/run.js), so it uses only T, TB and the page itself.

const content = async function () {
  const { Defs, Rigs } = TB;
  const CAST = ['change-ringer', 'dial.wake-walker', 'dial.hanger-on', 'dial.heavy', 'dial.half-muffled-keeper', 'gate'];
  const GROUND = ['dial.bell-post', 'dial.stone', 'dial.wall'];
  const missing = CAST.concat(GROUND).filter((id) => !Defs.has('puppet', id));
  T.check('the agreed puppets are there: the cast, the lychgate, the props and the wall', missing.length === 0, missing);
  const bad = CAST.concat(GROUND).filter((id) => {
    const f = Rigs.figure(id);
    return !f || !(f.height > 0.3) || f.counts.core < 1 || f.n !== Defs.get('puppet', id).parts.length;
  });
  T.check('each compiles, with a height, a core to fall back on and all its parts', bad.length === 0, bad);
  const astray = [];
  for (const id of CAST.concat(GROUND)) {
    const def = Defs.get('puppet', id), joints = Rigs.joints(def.rig);
    for (const p of def.parts) if (!joints.includes(p.joint === undefined ? joints[0] : p.joint)) astray.push(id + '.' + p.key);
  }
  T.check('every part hangs on a joint of its rig', astray.length === 0, astray);
  T.check('the props: the bell-post with its role, the stone, each with its own figure and a collider',
    Defs.has('prop', 'dial.bell-post') && Defs.get('prop', 'dial.bell-post').role === 'bell-post' && Defs.get('prop', 'dial.bell-post').radius > 0.5 &&
    Defs.has('prop', 'dial.stone') && Defs.get('prop', 'dial.stone').radius > 0.4 &&
    Defs.get('prop', 'dial.bell-post').puppet === 'dial.bell-post' && Defs.get('prop', 'dial.stone').puppet === 'dial.stone');
  const tile = Defs.has('tileset', 'dial') ? Defs.get('tileset', 'dial') : null;
  T.check('the tileset dial, its edge figure, hour lines and shadow', !!tile && !!Rigs.figure(tile.edge.puppet) && tile.edge.step > 1 &&
    tile.hours.count === 8 && Array.isArray(tile.shadow.color), tile);
  // sizes against the design
  const f = (id) => Rigs.figure(id), body = (id) => { const g = f(id); return (g.rest[g.rig.index.torso * 3 + 1] + g.rest[g.rig.index.head * 3 + 1] + 0.25) * g.scale; };
  const sizes = {};
  for (const id of CAST) sizes[id] = [+f(id).height.toFixed(2), +f(id).radius.toFixed(2)];
  T.check('a person is about 1.7 m: the ringer\'s body, a wake-walker slumped a little lower', Math.abs(body('change-ringer') - 1.73) < 0.12 &&
    f('dial.wake-walker').height > 1.35 && f('dial.wake-walker').height < 1.7, sizes);
  T.check('the ringer\'s rope rises well over its head', f('change-ringer').height > body('change-ringer') + 1.2, sizes);
  T.check('a hanger-on is half a person', f('dial.hanger-on').height > 0.75 && f('dial.hanger-on').height < 1.05, sizes);
  T.check('a heavy is about twice as wide as a wake-walker, and no taller than a person', f('dial.heavy').radius > 1.6 * f('dial.wake-walker').radius &&
    f('dial.heavy').height < 1.95, sizes);
  T.check('the keeper is two to three times a person\'s height', f('dial.half-muffled-keeper').height > 3.4 && f('dial.half-muffled-keeper').height < 5.2, sizes);
  // against the dead's own colliders, once 41-dial.js defines them: a figure about as wide as its body; the keeper's
  // bell (its widest part, the lip) as wide as its collider, its clapper reaching past it
  const colliders = {};
  for (const id of ['dial.wake-walker', 'dial.hanger-on', 'dial.heavy']) if (Defs.has('enemy', id)) colliders[id] = [Defs.get('enemy', id).radius, sizes[id][1]];
  T.check('each of the dead is drawn about as wide as its collider (from 0.7 to 1.5 times it)',
    Object.values(colliders).every(([r, fr]) => fr > 0.7 * r && fr < 1.5 * r), colliders);
  if (Defs.has('boss', 'dial.half-muffled-keeper')) {
    const keeper = Defs.get('puppet', 'dial.half-muffled-keeper'), lip = keeper.parts.find((q) => q.key === 'lip');
    const bell = lip.size[0] / 2 * keeper.scale, r = Defs.get('boss', 'dial.half-muffled-keeper').radius;
    T.check('the keeper\'s bell is about as wide as its collider, and its clapper reaches past it', bell > 0.8 * r && bell < 1.3 * r &&
      f('dial.half-muffled-keeper').radius > r, { bell, collider: r, reach: f('dial.half-muffled-keeper').radius });
  }
  // the favours' motifs
  const motifs = Array.from(new Set(Defs.all('favour').map((v) => v.icon).filter((i) => typeof i === 'string')));
  const noFigure = motifs.filter((m) => !Rigs.figure('favour.' + m));
  T.check('every favour\'s motif has a figure that rises for it', noFigure.length === 0, { motifs: motifs.length, noFigure });
  const tall = motifs.map((m) => Rigs.figure('favour.' + m)).filter((g) => g && (g.height < 0.15 || g.height > 0.9 || g.radius > 0.6));
  T.check('and each is a small thing, at most 0.9 m tall and 0.6 m round', tall.length === 0, tall.map((g) => g.id));
  // the dead are not drawn glowing: only flames and hot metal glow
  const glowing = [];
  for (const id of ['dial.wake-walker', 'dial.hanger-on', 'dial.heavy', 'dial.half-muffled-keeper']) {
    for (const p of Defs.get('puppet', id).parts) if ((p.glow || 0) > 0 || (p.emissive || 0) > 0) glowing.push(id + '.' + p.key);
  }
  T.check('no part of the dead glows (no glowing eyes)', glowing.length === 0, glowing);
  return T.done();
};

// Every figure drawn in the 3D view: each one, alone in a frame, changes the picture where it stands.
const drawsGl = async function () {
  const { Gfx, Rigs, Plat } = TB;
  const b = Gfx.active;
  if (!T.check('the view is the 3D one', !!b && b.name === 'gl', b && b.name)) return T.done();
  Plat.stop();
  b.quality('high');
  const canvas = b.canvas, at = { x: 0, y: 0 };
  const ids = ['change-ringer', 'dial.wake-walker', 'dial.hanger-on', 'dial.heavy', 'dial.half-muffled-keeper', 'gate', 'dial.bell-post', 'dial.stone', 'dial.wall'];
  const env = { ground: [0.4, 0.4, 0.4], ambient: [0.5, 0.5, 0.5], sun: { dir: [1, -1, -0.3], color: [0.6, 0.6, 0.6] }, fog: { near: 100, far: 200 } };
  const PLAIN = { outline: 0, bloom: 0, dither: 0, vignette: 0, flash: 0 };
  const sink = Rigs.sink(400), st = Rigs.state();
  const region = (id, z) => {
    b.worldToScreen(0, 0, z, at);
    const X = Math.round(at.x * canvas.width / innerWidth), Y = Math.round(at.y * canvas.height / innerHeight);
    return b.readPixels(X - 4, Y - 4, 9, 9);
  };
  const changed = (a, c) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - c[i]) + Math.abs(a[i + 1] - c[i + 1]) + Math.abs(a[i + 2] - c[i + 2]) > 30) n++; return n; };
  const result = {};
  for (const id of ids) {
    const fig = Rigs.figure(id);
    Rigs.clear(sink);
    Object.assign(st, Rigs.state());
    st.face = Math.PI / 2;
    const n = Rigs.draw(fig, st, sink), z = Math.min(1.2, fig.height / 2);
    b.begin({ x: 0, y: 0, zoom: 1 }, env);
    b.end(PLAIN);
    const bare = region(id, z);
    b.begin({ x: 0, y: 0, zoom: 1 }, env);
    for (let s = 0; s < 5; s++) if (sink.n[s] > 0) b.parts(s, sink.buf[s], sink.n[s]);
    b.end(PLAIN);
    result[id] = { parts: n, changed: changed(bare, region(id, z)) };
  }
  const notDrawn = Object.keys(result).filter((id) => !(result[id].parts === Rigs.figure(id).n && result[id].changed >= 20));
  T.check('each Dial figure draws all its parts in the 3D view, and changes the picture where it stands', notDrawn.length === 0, result);
  return T.done();
};

// Every figure drawn in the plain view: the scene gives each a disc of its colour where it stands.
const drawsPlain = async function () {
  const { Gfx, Rigs, Scene, Sim, Plat } = TB;
  const b = Gfx.active;
  if (!T.check('the view is the plain one', !!b && b.name === '2d', b && b.name)) return T.done();
  Plat.stop();
  const S = Sim.debugScene(0, 5), p = S.player;
  const ids = ['dial.wake-walker', 'dial.hanger-on', 'dial.heavy', 'dial.half-muffled-keeper'];
  ids.forEach((id, k) => {
    const e = Sim.spawnEnemy(S, 'debug.husk', p.x - 4.5 + k * 3, p.y + 2.5);
    e.def = { id, puppet: id, radius: e.r, attacks: [] };
    e.px = e.x; e.py = e.y;
  });
  Scene.draw(S, 1);
  const B = Scene.buffers(), ctx = b.canvas.getContext('2d'), kx = b.canvas.width / innerWidth, ky = b.canvas.height / innerHeight;
  const found = {};
  for (let k = 0; k < ids.length; k++) {
    const x = p.x - 4.5 + k * 3, y = p.y + 2.5, c = Rigs.figure(ids[k]).color3;
    let disc = -1;
    for (let i = 0; i < B.discN; i++) if (Math.hypot(B.discs[i * 7] - x, B.discs[i * 7 + 1] - y) < 0.01) disc = i;
    const at = Gfx.worldToScreen(x, y, 0, {}), px = ctx.getImageData(Math.round(at.x * kx), Math.round(at.y * ky), 1, 1).data;
    const want = [0, 1, 2].map((j) => Math.round(B.discs[disc * 7 + 3 + j] * 255));
    found[ids[k]] = { disc, pixel: Array.from(px.slice(0, 3)), want, base: c.map((v) => +v.toFixed(2)) };
  }
  const player = (() => { for (let i = 0; i < B.discN; i++) if (Math.hypot(B.discs[i * 7] - p.x, B.discs[i * 7 + 1] - p.y) < 0.01) return i; return -1; })();
  T.check('in the plain view each of the Dial\'s dead is a disc of its figure\'s colour where it stands',
    Object.values(found).every((v) => v.disc >= 0 && v.pixel.every((c, j) => Math.abs(c - v.want[j]) < 24)), found);
  T.check('and so is the player', player >= 0);
  return T.done();
};

// The rigs: what a wind-up, the Wrong-footed, the ringer's rope, a hop and lift do to the part records.
const rigs = async function () {
  const { Rigs } = TB;
  const sink = Rigs.sink(200), st = Rigs.state();
  const fig = Rigs.figure('dial.wake-walker'), J = fig.rig.index;
  // the part records of joint j, from a fresh draw of fig in the state that set() gives
  const draw = (g, set) => {
    Rigs.clear(sink);
    Object.assign(st, Rigs.state());
    if (set) set(st);
    Rigs.draw(g, st, sink);
    const out = [];
    for (let s = 0; s < 5; s++) for (let i = 0; i < sink.n[s]; i++) out.push(sink.buf[s].slice(i * sink.stride, (i + 1) * sink.stride));
    return out;
  };
  const jointOf = (g, k) => g.joint[k];
  // the striking parts whiten toward the top of the wind-up
  const top = draw(fig, (s) => { s.act = Rigs.WINDUP; s.actT = 0.6; s.actLen = 0.6; });
  const early = draw(fig, (s) => { s.act = Rigs.WINDUP; s.actT = 0.1; s.actLen = 0.6; });
  // the records come out shape by shape, so match them to parts by the order the parts have within each shape
  const byShape = (g) => { const order = []; for (let s = 0; s < 5; s++) for (let k = 0; k < g.n; k++) if (g.shape[k] === s) order.push(k); return order; };
  const parts = byShape(fig), armR = parts.map((k, i) => [k, i]).filter(([k]) => jointOf(fig, k) === J.armR).map(([, i]) => i);
  const rest = parts.map((k, i) => [k, i]).filter(([k]) => jointOf(fig, k) !== J.armR && jointOf(fig, k) !== J.handR).map(([, i]) => i);
  T.check('at the top of a wind-up the striking arm is white and nothing else is', armR.length > 0 && armR.every((i) => top[i][15] > 0.95) &&
    rest.every((i) => top[i][15] < 0.01), { arm: armR.map((i) => top[i][15]), others: rest.map((i) => +top[i][15].toFixed(2)) });
  T.check('early in the wind-up it is not white yet', armR.every((i) => early[i][15] < 0.05), armR.map((i) => early[i][15]));
  const shoulder = draw(fig, (s) => { s.act = Rigs.WINDUP; s.actT = 0.6; s.actLen = 0.6; s.strike = Rigs.mask(fig, ['torso', 'head']); });
  const torso = parts.map((k, i) => [k, i]).filter(([k]) => jointOf(fig, k) === J.torso).map(([, i]) => i);
  T.check('a mask of joints (Rigs.mask) whitens those instead', torso.every((i) => shoulder[i][15] > 0.95) && armR.every((i) => shoulder[i][15] < 0.01) &&
    Rigs.mask(fig, ['torso', 'nothing']) === 1 << J.torso, Rigs.mask(fig, ['torso']));
  // the Wrong-footed: a white shell of every part, turned inside out
  const plain = draw(fig), shell = draw(fig, (s) => { s.shell = 0.05; });
  const det = (r) => r[0] * (r[5] * r[10] - r[6] * r[9]) - r[1] * (r[4] * r[10] - r[6] * r[8]) + r[2] * (r[4] * r[9] - r[5] * r[8]);
  const shells = shell.filter((r) => det(r) < 0);
  T.check('a shell doubles the parts: each part, and a white copy of it turned inside out and a little bigger',
    shell.length === 2 * plain.length && shells.length === plain.length && shells.every((r) => r[12] === 1 && r[13] === 1 && r[14] === 1 && r[15] === 1) &&
    shells.every((r, i) => Math.abs(det(r)) > Math.abs(det(plain[i])) * 1.01), { plain: plain.length, shell: shell.length, inside: shells.length });
  // the ringer's rope stands upright, walking and pulling
  const ringer = Rigs.figure('change-ringer'), ropeKey = TB.Defs.get('puppet', 'change-ringer').parts.findIndex((p) => p.key === 'rope');
  const ropeRecord = (set) => {
    const recs = draw(ringer, set), order = byShape(ringer);
    return recs[order.indexOf(ropeKey)];
  };
  const tilt = (r) => { const len = Math.hypot(r[1], r[5], r[9]); return Math.acos(r[5] / len) * 180 / Math.PI; };
  const tilts = [];
  for (let c = 0; c < 6; c++) tilts.push(tilt(ropeRecord((s) => { s.speed = 4.5; s.cycle = c / 6; s.t = c; })));
  const pullLow = ropeRecord((s) => { s.act = Rigs.CAST; s.actT = 0.14; s.actLen = 0.3; }), pullTop = ropeRecord((s) => { s.act = Rigs.CAST; s.actT = 0.05; s.actLen = 0.3; });
  T.check('the ringer\'s rope stands within 12 degrees of upright through a walk', tilts.every((a) => a < 12), tilts.map((a) => +a.toFixed(1)));
  T.check('and a pull moves it down along itself, still upright', tilt(pullLow) < 12 && pullLow[7] < pullTop[7] - 0.05, { low: pullLow[7], top: pullTop[7] });
  // a hop: both feet together
  const hanger = Rigs.figure('dial.hanger-on'), HJ = hanger.rig.index, hOrder = byShape(hanger);
  const legs = (c) => { const recs = draw(hanger, (s) => { s.speed = 2.8; s.cycle = c; }); const l = hOrder.findIndex((k) => hanger.joint[k] === HJ.legL), r = hOrder.findIndex((k) => hanger.joint[k] === HJ.legR); return [recs[l], recs[r]]; };
  const mid = legs(0.75), stand = legs(0.25);
  T.check('a hanger-on hops: both feet leave the ground together, and stand together', Math.abs(mid[0][7] - mid[1][7]) < 0.01 && mid[0][7] > stand[0][7] + 0.05 &&
    Math.abs(stand[0][7] - stand[1][7]) < 0.01, { air: [mid[0][7], mid[1][7]], ground: [stand[0][7], stand[1][7]] });
  // lift
  const low = draw(fig), high = draw(fig, (s) => { s.lift = 0.5; });
  T.check('lift raises the whole figure', high.every((r, i) => Math.abs(r[7] - low[i][7] - 0.5) < 1e-4));
  return T.done();
};

// The decal record and its shapes, by the pixels of the 3D view.
const decalsGl = async function () {
  const { Gfx, Plat, Scene } = TB;
  const b = Gfx.active;
  if (!T.check('the view is the 3D one', !!b && b.name === 'gl', b && b.name)) return T.done();
  Plat.stop();
  T.check('the decal record is 11 floats', Gfx.DECAL_STRIDE === 11 && Scene.DISC === 0 && Scene.RING === 1 && Scene.SECTOR === 2 && Scene.BAR === 3 &&
    Scene.LEE === 4 && Scene.CUT === 8, Gfx.DECAL_STRIDE);
  const canvas = b.canvas, at = { x: 0, y: 0 };
  const env = { ground: [0.3, 0.3, 0.3], ambient: [0.6, 0.6, 0.6], sun: { dir: [0, -1, 0], color: [0.4, 0.4, 0.4] }, fog: { near: 100, far: 200 } };
  const PLAIN = { outline: 0, bloom: 0, dither: 0, vignette: 0, flash: 0 };
  const read = (x, y) => {
    b.worldToScreen(x, y, 0, at);
    const px = b.readPixels(Math.round(at.x * canvas.width / innerWidth) - 1, Math.round(at.y * canvas.height / innerHeight) - 1, 3, 3);
    const s = [0, 0, 0];
    for (let i = 0; i < px.length; i += 4) { s[0] += px[i]; s[1] += px[i + 1]; s[2] += px[i + 2]; }
    return s.map((v) => Math.round(v / 9));
  };
  const buf = new Float32Array(16 * 11);
  const frame = (records) => {
    let n = 0;
    for (const r of records) n = Scene.decal(buf, n, ...r);
    b.begin({ x: 0, y: 0, zoom: 1 }, env);
    if (n) b.decals(buf, n);
    b.end(PLAIN);
  };
  const green = (c) => c[1] > c[0] + 60 && c[1] > c[2] + 60;
  frame([]);
  const ground = read(0, 0);
  const isGround = (c) => Math.abs(c[0] - ground[0]) < 10 && Math.abs(c[1] - ground[1]) < 10 && Math.abs(c[2] - ground[2]) < 10;
  const G = [0.1, 0.9, 0.2];
  // a disc is filled whole
  frame([[0, 0, 2, ...G, 1, 0, Scene.DISC, 0, 0]]);
  T.check('a disc is filled whole', green(read(0, 0)) && green(read(1.5, 0)) && isGround(read(2.6, 0)), [read(0, 0), read(1.5, 0), read(2.6, 0)]);
  // a ring: its rim, its middle clear; filled from the middle out, or from the rim in
  frame([[0, 0, 2, ...G, 1, 0, Scene.RING, 0, 0]]);
  const rim = read(1.97, 0), clear = read(0.6, 0);
  frame([[0, 0, 2, ...G, 1, 0.5, Scene.RING, 0, 0]]);
  const inner = [read(0.4, 0), read(1.5, 0)];
  frame([[0, 0, 2, ...G, 1, -0.4, Scene.RING, 0, 0]]);
  const outer = [read(0.4, 0), read(1.5, 0)];
  T.check('a ring is its rim with its middle clear', green(rim) && isGround(clear), { rim, clear });
  T.check('fill 0.5 fills the middle half of it, and fill -0.4 its outer part', green(inner[0]) && isGround(inner[1]) && isGround(outer[0]) && green(outer[1]),
    { inner, outer });
  // a sector: only within its arc, centred on its angle (here pointing down the screen, +y)
  frame([[0, 0, 3, ...G, 1, 1, Scene.SECTOR, Math.PI / 2, Math.PI / 2]]);
  T.check('a sector fills only its arc about its angle', green(read(0, 2)) && green(read(0.9, 1.5)) && isGround(read(0, -2)) && isGround(read(2, 0)),
    [read(0, 2), read(0.9, 1.5), read(0, -2), read(2, 0)]);
  // a bar: from its middle toward its angle, as long as its radius and as wide as its arc
  frame([[-2, 0, 4, ...G, 1, 1, Scene.BAR, 0, 1]]);
  T.check('a bar runs from its centre along its angle, its arc wide', green(read(-1, 0)) && green(read(1.5, 0.3)) && isGround(read(-2.8, 0)) &&
    isGround(read(0, 1.2)) && isGround(read(2.6, 0)), [read(-1, 0), read(1.5, 0.3), read(-2.8, 0), read(0, 1.2), read(2.6, 0)]);
  // a lee record is drawn as nothing
  frame([[0, 0, 2, ...G, 1, 1, Scene.LEE, 0, 3]]);
  T.check('a lee record is not drawn', isGround(read(0, 0)) && isGround(read(1, 0)), read(0, 0));
  // a cut decal: a disc filled whole from (-3, 0), and a lee record of radius 0.6 at (0, 0) reaching 2 m: the
  // ground behind it, within its reach, is clean; in front of it, beside it and beyond the reach it is filled
  frame([[0, 0, 0.6, 0, 0, 0, 0, 0, Scene.LEE, 0, 2], [-3, 0, 6, ...G, 1, 1, Scene.RING + Scene.CUT, 0, 0]]);
  const behind = read(1.6, 0), front = read(-1.5, 0), side = read(1.2, 1.6), past = read(2.9, 0), inside = read(0.3, 0);
  T.check('a cut decal leaves the lee of a lee record clean, by the rule of Dmg.inLee', isGround(behind) && isGround(inside) && green(front) &&
    green(side) && green(past), { behind, inside, front, side, past });
  frame([[0, 0, 0.6, 0, 0, 0, 0, 0, Scene.LEE, 0, 2], [-3, 0, 6, ...G, 1, 1, Scene.RING, 0, 0]]);
  T.check('and a decal that is not cut is not', green(read(1.6, 0)), read(1.6, 0));
  frame([[-3, 0, 0.6, 0, 0, 0, 0, 0, Scene.LEE, 0, 2], [-3, 0, 6, ...G, 1, 1, Scene.RING + Scene.CUT, 0, 0]]);
  T.check('a lee record over the decal\'s own centre shelters nothing', green(read(-1.5, 0)) && green(read(0.5, 0)), [read(-1.5, 0), read(0.5, 0)]);
  // grey: the colour goes out of what does not glow
  b.begin({ x: 0, y: 0, zoom: 1 }, env);
  b.decals(new Float32Array([0, 0, 2, 0.1, 0.9, 0.2, 1, 1, 0, 0, 0]), 1);
  b.end(Object.assign({}, PLAIN, { grey: 1 }));
  const grey = read(0, 0);
  T.check('post.grey takes the colour out of the picture', Math.max(...grey) - Math.min(...grey) < 12, grey);
  return T.done();
};

// The same shapes in the plain view, by the pixels of its canvas.
const decalsPlain = async function () {
  const { Gfx, Plat, Scene } = TB;
  const b = Gfx.active;
  if (!T.check('the view is the plain one', !!b && b.name === '2d', b && b.name)) return T.done();
  Plat.stop();
  const ctx = b.canvas.getContext('2d'), kx = b.canvas.width / innerWidth, ky = b.canvas.height / innerHeight;
  const read = (x, y) => {
    const at = b.worldToScreen(x, y, 0, {});
    return Array.from(ctx.getImageData(Math.round(at.x * kx), Math.round(at.y * ky), 1, 1).data.slice(0, 3));
  };
  const buf = new Float32Array(16 * 11), env = { ground: [0.3, 0.3, 0.3] };
  const frame = (records, post) => {
    let n = 0;
    for (const r of records) n = Scene.decal(buf, n, ...r);
    b.begin({ x: 0, y: 0, zoom: 1 }, env);
    if (n) b.decals(buf, n);
    b.end(post || null);
  };
  const green = (c) => c[1] > c[0] + 60 && c[1] > c[2] + 60;
  frame([]);
  const ground = read(0.5, 0.5);
  const isGround = (c) => Math.abs(c[0] - ground[0]) < 14 && Math.abs(c[1] - ground[1]) < 14 && Math.abs(c[2] - ground[2]) < 14;
  const G = [0.1, 0.9, 0.2];
  frame([[0, 0, 2, ...G, 1, 0, Scene.DISC, 0, 0]]);
  T.check('a disc is filled whole', green(read(0.3, 0.3)) && green(read(1.5, 0.1)) && isGround(read(2.6, 0.1)), [read(0.3, 0.3), read(2.6, 0.1)]);
  frame([[0, 0, 2, ...G, 1, 0, Scene.RING, 0, 0]]);
  const rim = read(1.98, 0), clear = read(0.6, 0.1);
  frame([[0, 0, 2, ...G, 1, 0.5, Scene.RING, 0, 0]]);
  const inner = [read(0.4, 0.1), read(1.5, 0.1)];
  frame([[0, 0, 2, ...G, 1, -0.4, Scene.RING, 0, 0]]);
  const outer = [read(0.4, 0.1), read(1.5, 0.1)];
  T.check('a ring is its rim with its middle clear', green(rim) && isGround(clear), { rim, clear });
  T.check('fill 0.5 fills the middle half of it, and fill -0.4 its outer part', green(inner[0]) && isGround(inner[1]) && isGround(outer[0]) && green(outer[1]),
    { inner, outer });
  frame([[0, 0, 3, ...G, 1, 1, Scene.SECTOR, Math.PI / 2, Math.PI / 2]]);
  T.check('a sector fills only its arc about its angle', green(read(0.1, 2)) && green(read(0.9, 1.5)) && isGround(read(0.1, -2)) && isGround(read(2, 0.1)),
    [read(0.1, 2), read(0.1, -2), read(2, 0.1)]);
  frame([[-2, 0.1, 4, ...G, 1, 1, Scene.BAR, 0, 1]]);
  T.check('a bar runs from its centre along its angle, its arc wide', green(read(-1, 0.1)) && green(read(1.5, 0.4)) && isGround(read(-2.8, 0.1)) &&
    isGround(read(0.3, 1.3)) && isGround(read(2.6, 0.1)), [read(-1, 0.1), read(-2.8, 0.1), read(0.3, 1.3), read(2.6, 0.1)]);
  frame([[0, 0, 2, ...G, 1, 1, Scene.LEE, 0, 3]]);
  T.check('a lee record is not drawn', isGround(read(0.3, 0.3)), read(0.3, 0.3));
  frame([[0, 0, 0.6, 0, 0, 0, 0, 0, Scene.LEE, 0, 2], [-3, 0, 6, ...G, 1, 1, Scene.RING + Scene.CUT, 0, 0]]);
  const behind = read(1.6, 0.05), front = read(-1.5, 0.05), side = read(1.2, 1.6), past = read(2.9, 0.05);
  T.check('a cut decal leaves the lee of a lee record clean, by the rule of Dmg.inLee', isGround(behind) && green(front) && green(side) && green(past),
    { behind, front, side, past });
  frame([[0, 0, 2, ...G, 1, 1, Scene.DISC, 0, 0]], { grey: 1 });
  const grey = read(0.3, 0.3);
  T.check('post.grey takes the colour out of the picture', Math.max(...grey) - Math.min(...grey) < 14, grey);
  return T.done();
};

module.exports = [
  { name: 'dial figures: the cast, the props and the ground as content', viewport: { width: 960, height: 540 }, mobile: false, query: 'view=2d', run: content },
  { name: 'dial figures: each draws in the 3D view', viewport: { width: 960, height: 540 }, mobile: false, query: 'view=gl', run: drawsGl },
  { name: 'dial figures: each draws in the plain view', viewport: { width: 960, height: 540 }, mobile: false, query: 'view=2d', run: drawsPlain },
  { name: 'dial figures: the rigs\' wind-up, outline, rope, hop and lift', viewport: { width: 960, height: 540 }, mobile: false, query: 'view=2d', run: rigs },
  { name: 'dial figures: every decal shape in the 3D view', viewport: { width: 960, height: 540 }, mobile: false, query: 'view=gl', run: decalsGl },
  { name: 'dial figures: every decal shape in the plain view', viewport: { width: 960, height: 540 }, mobile: false, query: 'view=2d', run: decalsPlain },
];
