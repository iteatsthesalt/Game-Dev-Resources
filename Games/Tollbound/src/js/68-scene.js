// 68-scene.js: the run as the view draws it. Each frame it follows the player with the camera, leaves out what is
// off screen, and turns the run into instance buffers for Gfx.active: figures through the rigs (or discs, in a
// view that has no figures), decals, billboards and lights; then it calls the view. It speaks the screen
// language of docs/design/02-combat.md, section 13: what a fight shows is shapes and colours, never text.
// Owns: Scene
// Public:
//   Scene.draw(S, alpha)         draws the run S, alpha of the way from the step before the last to the last (see
//                                90-game.js, which calls it once a frame while there is a run). Allocates nothing
//                                once a run has been drawn once.
//   Scene.camera                 {x, y, zoom}: the ground point looked at and the zoom, as last handed to the view.
//                                It follows the player smoothly, a little ahead of where the player is going, plus
//                                Vfx's shake. zoom may be set (1 by default) and is kept.
//   Scene.look(look | null)      lays a look over the zone's own until it is called with null: {tileset, ground,
//                                ambient, sun, fog} as the view's env takes them, any of them left out. For test
//                                pictures, and for screens that show a place.
//   Scene.quality(level?) -> level   'high' | 'medium' | 'low': the scene's level (at 'low' fewer particles and dark
//                                discs under figures) and the view's. Also follows the view when it steps itself
//                                down (the notice 'quality'), and ?quality= in the address at boot. ?dither=0..1 in
//                                the address turns on the view's ordered dither (off otherwise).
//   Scene.limits                 {parts: 10000, lights: 32}, the budgets of a frame. May be lowered (tests do).
//   Scene.stats                  what the last frame drew: {figures, enemies, culled, corpses, detail, cut, parts,
//                                dropped, decals, billboards, lights, discs, bars, fillMs} and the marks of the
//                                screen language: {postures, threads, wake, swells, lees, wounds, marks, walls,
//                                favours, shadow (0 or 1), grey (0..1)}. detail is whether detail parts were drawn;
//                                cut how many enemies were drawn as a body and a head only; marks the solid parts
//                                that mark conditions; fillMs the time spent filling the buffers, after begin() and
//                                before the view's calls.
//   Scene.buffers()              the buffers of the last frame, for tests: {sink (see Rigs.sink), decals, decalN,
//                                billboards, billboardN, lights, lightN, discs, discN, bars, barN}
//   Scene.decal(buffer, n, x, y, radius, r, g, b, a, fill, shape, angle, arc) -> n + 1   writes one decal record at
//                                record n (65-gfx.js lays the record out). Returns n when the buffer is full.
//   Scene.DISC = 0, Scene.RING = 1, Scene.SECTOR = 2, Scene.BAR = 3, Scene.LEE = 4, Scene.CUT = 8   decal shapes
//   Scene.LOOK                   the colours of the screen language, [r, g, b] each (frozen): posture, wake,
//                                thread, bone (a Swell's fill), rim (its rim), fall (a falling Swell's fill), wound,
//                                deep, scar, mend, tick, wax, sounded, coil, coin, rider, riderCap, lamp, bell,
//                                ember, white
//   Scene.BAR_STRIDE = 6         a bar for Vfx.overlay: x, y, z (where above the ground it sits), life (0..1), rank,
//                                alpha
//   Scene.ATTACK                 {windup: 1, strike: 2, length: 0.35}: an enemy or minion whose state is windup is
//                                winding up an attack (e.attack, the index in def.attacks, else its first), stateT
//                                seconds into it, which lasts as long as that attack's windup; one whose state is
//                                strike is striking, for length seconds.
//
// What it draws, and from what (field names as docs/engine.md gives them; each is read only if it is there):
//   figures    the player (the class's puppet, from cfg.char.class or cfg.class, else 'test.biped'), enemies (their
//              def's puppet; elites and bosses larger by their radius), minions (their def's puppet, else
//              'test.floater'), the props of S.props (their prop def's puppet: one the zone set down by hand faces
//              the middle of the region, the rest turn at random), the open lychgate (the puppet 'gate', else
//              'test.gate'; half seen through while the player stands in it), the tileset's edge figure round the
//              region's edge, and the dying: an enemy that leaves the pool where the camera can see it falls and
//              sinks for 1.15 s. The walk comes from the distance covered; a Blow's wind-up from state, stateT and
//              attack, the striking part white at its top (61-rigs.js); a hurt is seen when life falls or flash
//              rises, and harm is handed to Vfx.harm.
//   under every body, its posture (pose, Dmg.POSE): a closed pale ring when Braced, two short trailing streaks
//              when Striding; Wrong-footed (the row wrong-footed) a white outline round the figure (Rigs' shell)
//   the wake   S.wake as a faint line from the player back over wake-length seconds, and a thin thread from each
//              body In Procession (condN of in-procession is 1) to the nearest point of it
//   wounds     S.wounds as deep red discs 1 m across, darker for deeper, greying toward wound-term; a pale ring
//              closes on one as it gives its life back (back against life), bright while the player is Braced on it
//   Swells     areas of team 1 whose def is a Swell, and the voices' areas while they fill or land (Skills.FILL,
//              Skills.LANDED): the shape as Dmg.inside reads it (a circle, a wedge, a lane) filling in pale bone with
//              a dark rim, fill = t / (t + ttl). Whether it falls or spreads is the area's own, never where it lies:
//              one of the dead's falls when its attack's kind is 'fall', a voice's when its a0 is 0 (1: it spreads
//              from x, y). A falling one darkens from its rim inward. A spreading one is cut by lee: each prop with
//              a collider and each large body near it is a lee record, reaching the player's lee-reach for the
//              dead's Swells and Skills.LEE for the voices'. The keeper's echoes (harm well under its full stroke)
//              are drawn fainter. A voice's Drag zone or Blow mark is its shape in the voice's colour.
//   conditions mourning (condV 2 black, 1 grey), riders (condN of clung: small boxes stuck on), Sounded (two
//              thin hoops round the body), Coiled (a hoop of rope at its feet for each coil), swing (from 3 a
//              tick for each swing, round the direction of the last Blow, closing toward going over), sealed (a
//              red wax disc), coined (two bright discs at the eyes), Tolled-for on the player (the world grey, all
//              but what glows, and the far lychgate lit, with a lit way toward it); the Change-ringer's set bell
//              (setBell) as a bell mouth-up over it
//   the place  the tileset's hour lines round the bell-post (its field hours, 47-dial-ground.js), the Dial's shadow
//              as the director keeps it (S.vigil.shade: a dark wedge with a darker leading edge, in the tileset's
//              shadow colour; figures in it are darker), Vfx's marks, pickups (embers as warm motes, coin as small discs,
//              finds as small boxes, favours (kind 3) as solid shapes that rise from the ground, by their icon),
//              the open lychgate's ring of strokes filling one by one as the player rings down (S.gate.ring and
//              strokes against ringStrokes and strokeSeconds)
//   billboards shots (with a short trail), embers, the far lychgate's lit way, and Vfx's particles
//   lights     the player's own small light at the belt, the lychgate's lamps, props that carry a light, shots: the
//              nearest 32 to the player
//   discs      in a view without figures (b.caps.puppets false), one disc for each figure instead of its parts;
//              the marks on bodies become decals and billboards there
// Budgets: at most Scene.limits.parts parts (figures within the limit less a share kept for marks; detail parts go
// first, then the farthest common enemies are drawn as a body and a head; outlines of the Wrong-footed go before
// any figure does) and Scene.limits.lights lights.
(function () {
  'use strict';

  const DT = Core.DT, HZ = Core.HZ, TAU = Core.TAU, PI = Math.PI;
  const sqrt = Math.sqrt, sin = Math.sin, cos = Math.cos, exp = Math.exp, abs = Math.abs, floor = Math.floor, atan2 = Math.atan2;
  const PARTS = 10000, LIGHTS = 32, CROWD = 170, MARK_SHARE = 0.12, MARK_MOST = 1200;
  const SLOTS = 2048, DRAW = 2048, CORPSES = 128, PROPS = 4096, BIG = 512, CASTERS = 64, WAKE = 121, WALLS = 256;
  const DECALS = 4096, BOARDS = 4096, CANDIDATES = 1024, DISCS = 2048, BARS = 512;
  const BAR_STRIDE = 6, DISC = 0, RING = 1, SECTOR = 2, BAR = 3, LEE = 4, CUT = 8;
  const DIE_TIME = 1.15, HURT_SHOW = 2;            // seconds: a death; how long a hurt common enemy shows its bar
  const CAM_TAU = 0.12, LEAD_TIME = 0.18, LEAD_MAX = 1.3, SNAP = 12;   // the camera: seconds, seconds, metres, metres
  const MARGIN = 1.6, HEIGHT_MARGIN = 0.9;         // culling: metres round a figure, and per metre of its height
  const KIND_PLAYER = 0, KIND_ENEMY = 1, KIND_MINION = 2, KIND_CORPSE = 3, KIND_PROP = 4, KIND_GATE = 5, KIND_WALL = 6, KIND_PICKUP = 7;
  const COMMON = 0, ELITE = 1, KEEPER = 3, NO_CAPS = Object.freeze({ puppets: false, shadows: false });
  const POSE = { still: 0, braced: 1, moving: 2, striding: 3 };   // Dmg.POSE, when there is no Dmg yet
  const SHELL = 0.045;                             // metres: the white outline of the Wrong-footed
  const HIT_FLASH = 0.3;                           // how far toward white a hit takes a body, at its flash's height
  const SEAL_PITCH = 0.663;                        // radians: a disc this far off level faces the camera (52 degrees down)
  const RISE = 0.6, SINK_AT = 0.8;                 // seconds: a favour's shape rises for this long, sinks in its last
  const GREY_RATE = 2.5;                           // how fast the world loses its colour when Tolled-for, a second
  const MOON = {
    ground: [0.2, 0.21, 0.24], ambient: [0.3, 0.33, 0.42], sunDir: [0.35, -1, -0.45], sunColor: [0.62, 0.68, 0.85],
    fog: [0.06, 0.07, 0.1], near: 6, far: 32,
  };
  // the screen language: the same colours in every district, so that it is learned once
  const LOOK = {
    posture: [0.97, 0.94, 0.85], wake: [0.86, 0.9, 0.97], thread: [0.79, 0.84, 0.95],
    bone: [0.93, 0.9, 0.81], rim: [0.12, 0.1, 0.14], fall: [0.15, 0.13, 0.18],
    wound: [0.58, 0.05, 0.07], deep: [0.27, 0.02, 0.04], scar: [0.44, 0.42, 0.42], mend: [1, 0.9, 0.84],
    tick: [1, 0.95, 0.78], wax: [0.82, 0.14, 0.09], sounded: [0.98, 0.88, 0.62], coil: [0.5, 0.36, 0.2],
    coin: [0.97, 0.78, 0.3], rider: [0.42, 0.37, 0.31], riderCap: [0.88, 0.64, 0.2], lamp: [1, 0.74, 0.38],
    bell: [0.62, 0.43, 0.23], ember: [1, 0.52, 0.18], white: [1, 1, 1],
  };
  // where riders sit on a figure: across (by its radius), up (by its height), forward (by its radius)
  const RIDERS = [[0.55, 0.78, -0.25], [-0.55, 0.78, -0.25], [0, 0.66, -0.7], [0.62, 0.5, -0.35], [-0.62, 0.5, -0.35]];
  const SHAPE_NAMES = ['box', 'taper', 'cyl', 'sphere', 'cone'];

  Scene.DISC = DISC; Scene.RING = RING; Scene.SECTOR = SECTOR; Scene.BAR = BAR; Scene.LEE = LEE; Scene.CUT = CUT;
  Scene.BAR_STRIDE = BAR_STRIDE;
  Scene.ATTACK = { windup: 1, strike: 2, length: 0.35 };
  Scene.LOOK = Core.deepFreeze(LOOK);
  Scene.limits = { parts: PARTS, lights: LIGHTS };
  const cam = { x: 0, y: 0, zoom: 1 };
  Scene.camera = cam;
  const stats = {
    figures: 0, enemies: 0, culled: 0, corpses: 0, detail: true, cut: 0, parts: 0, dropped: 0, decals: 0, billboards: 0,
    lights: 0, discs: 0, bars: 0, fillMs: 0,
    postures: 0, threads: 0, wake: 0, swells: 0, lees: 0, wounds: 0, marks: 0, walls: 0, favours: 0, shadow: 0, grey: 0,
  };
  Scene.stats = stats;

  // ---- buffers, made once ----
  let sink = null, decalBuf = null, boardBuf = null, lightBuf = null, discBuf = null, barBuf = null;
  let decalN = 0, boardN = 0, lightN = 0, discN = 0, barN = 0;
  let decalStride = 11, boardStride = 9, lightStride = 8, discStride = 7;
  const cand = new Float64Array(CANDIDATES * 9);   // light candidates: x, y, z, radius, r, g, b, strength, distance²
  let candN = 0;
  const st = Rigs.state(), shake = { x: 0, y: 0 }, corner = { x: 0, y: 0 };
  const post = { flash: 0, vignette: 0.22, bloom: 1, dither: 0, outline: 1, grey: 0 };
  const buffers = { sink: null, decals: null, decalN: 0, billboards: null, billboardN: 0, lights: null, lightN: 0, discs: null, discN: 0, bars: null, barN: 0 };
  const shapeId = new Int8Array(SHAPE_NAMES.length);   // a shape's name -> the view's id of it (the sink's index)
  const BOX = 0, TAPER = 1, CYL = 2, SPHERE = 3, CONE = 4;
  // the rows of the conditions the scene shows, from Stats.AILMENT (-1 where a row is missing)
  let rowWF = -1, rowProc = -1, rowSound = -1, rowCoil = -1, rowMourn = -1, rowClung = -1, rowCoin = -1, rowSwing = -1, rowSeal = -1, rowTolled = -1;

  function ensure() {
    if (sink !== null) return;
    sink = Rigs.sink(PARTS);
    decalStride = Gfx.DECAL_STRIDE || 11;
    boardStride = Gfx.BILLBOARD_STRIDE || 9;
    lightStride = Gfx.LIGHT_STRIDE || 8;
    discStride = Gfx.DISC_STRIDE || 7;
    decalBuf = new Float32Array(DECALS * decalStride);
    boardBuf = new Float32Array(BOARDS * boardStride);
    lightBuf = new Float32Array(LIGHTS * lightStride);
    discBuf = new Float32Array(DISCS * discStride);
    barBuf = new Float32Array(BARS * BAR_STRIDE);
    const names = Array.isArray(Gfx.SHAPES) ? Gfx.SHAPES : SHAPE_NAMES;
    for (let i = 0; i < SHAPE_NAMES.length; i++) shapeId[i] = names.indexOf(SHAPE_NAMES[i]);
    const A = Stats.AILMENT || {}, row = (id) => (typeof A[id] === 'number' ? A[id] : -1);
    rowWF = row('wrong-footed'); rowProc = row('in-procession'); rowSound = row('sounded'); rowCoil = row('coiled');
    rowMourn = row('mourning'); rowClung = row('clung'); rowCoin = row('coined'); rowSwing = row('swing');
    rowSeal = row('sealed'); rowTolled = row('tolled-for');
  }

  Scene.decal = function (buf, n, x, y, radius, r, g, b, a, fill, shape, angle, arc) {
    const stride = Gfx.DECAL_STRIDE || 11, o = n * stride;
    if (o + stride > buf.length) return n;
    buf[o] = x; buf[o + 1] = y; buf[o + 2] = radius; buf[o + 3] = r; buf[o + 4] = g; buf[o + 5] = b; buf[o + 6] = a; buf[o + 7] = fill;
    if (stride >= 11) { buf[o + 8] = shape || 0; buf[o + 9] = angle || 0; buf[o + 10] = arc || 0; }
    return n + 1;
  };

  // one decal of a colour of LOOK (or any [r, g, b]) into this frame's buffer
  function mark(x, y, radius, c, a, fill, shape, angle, arc) {
    decalN = Scene.decal(decalBuf, decalN, x, y, radius, c[0], c[1], c[2], a, fill, shape, angle, arc);
  }

  function board(x, y, z, size, r, g, b, a, glow) {
    if (boardN >= BOARDS) return;
    const o = boardN++ * boardStride;
    boardBuf[o] = x; boardBuf[o + 1] = y; boardBuf[o + 2] = z; boardBuf[o + 3] = size;
    boardBuf[o + 4] = r; boardBuf[o + 5] = g; boardBuf[o + 6] = b; boardBuf[o + 7] = a; boardBuf[o + 8] = glow;
  }

  // One solid shape that is not a figure's part (a mark, a coin, a favour): its base centre at the ground point
  // (x, y) h metres up, sized sx, sy, sz, turned yaw about up (the yaw of Mesh.part) after pitch about across.
  // False when the budget or the sink has no room.
  let markParts = 0;
  function solid(shape, x, y, h, sx, sy, sz, yaw, pitch, c, glow) {
    const s = shapeId[shape];
    if (s < 0 || sink.total >= Scene.limits.parts) return false;
    const n = sink.n[s];
    if (n >= sink.cap) { sink.dropped++; return false; }
    const buf = sink.buf[s], o = n * sink.stride;
    Mesh.part(buf, o, x, h, y, sx, sy, sz, yaw, pitch, 0);
    buf[o + 12] = c[0]; buf[o + 13] = c[1]; buf[o + 14] = c[2]; buf[o + 15] = 0; buf[o + 16] = glow || 0; buf[o + 17] = 1;
    sink.n[s] = n + 1;
    sink.total++;
    markParts++;
    return true;
  }

  // A thin hoop round the ground point (x, y), h metres up: eight boxes whose middles stand `radius` from it,
  // each laid along the hoop (Mesh.part's yaw -t points a box's length along the angle t of the ground).
  function hoop(x, y, h, radius, thick, c) {
    const side = 2 * radius * 0.4142 + thick;   // the side of an octagon is 2 tan(22.5 degrees) of its middle's reach
    for (let k = 0; k < 8; k++) {
      const a = (k + 0.5) / 8 * TAU;
      solid(BOX, x + cos(a) * radius, y + sin(a) * radius, h, side, thick, thick, -(a + PI / 2), 0, c, 0);
    }
  }

  // ---- the state of the run being drawn ----
  let run = null, frame = 0, simLast = 0, wallLast = 0, snap = true, camX = 0, camY = 0, grey = 0;
  let slotMap = new WeakMap(), slotN = 0, placed = new WeakSet();
  const sUid = new Int32Array(SLOTS), sSeen = new Int32Array(SLOTS), sKind = new Uint8Array(SLOTS);
  const sX = new Float64Array(SLOTS), sY = new Float64Array(SLOTS), sWalk = new Float64Array(SLOTS), sCycle = new Float64Array(SLOTS);
  const sSpeed = new Float32Array(SLOTS), sFace = new Float32Array(SLOTS), sScale = new Float32Array(SLOTS), sSeed = new Float32Array(SLOTS);
  const sHurt = new Float64Array(SLOTS), sFlash = new Float32Array(SLOTS), sLife = new Float32Array(SLOTS);
  const sRank = new Uint8Array(SLOTS), sDead = new Float64Array(SLOTS), sBorn = new Float64Array(SLOTS);
  const sFig = new Array(SLOTS).fill(null);
  // the dying: figures whose things have left their pools
  const cFig = new Array(CORPSES).fill(null);
  const cX = new Float64Array(CORPSES), cY = new Float64Array(CORPSES), cFace = new Float32Array(CORPSES), cScale = new Float32Array(CORPSES);
  const cSeed = new Float32Array(CORPSES), cCycle = new Float64Array(CORPSES), cT0 = new Float64Array(CORPSES), cRank = new Uint8Array(CORPSES);
  let cN = 0;
  // this frame's figures
  const dKind = new Uint8Array(DRAW), dSlot = new Int32Array(DRAW), dD2 = new Float32Array(DRAW), dLod = new Uint8Array(DRAW);
  const dX = new Float64Array(DRAW), dY = new Float64Array(DRAW), dFace = new Float32Array(DRAW);
  const dRef = new Array(DRAW).fill(null), dFig = new Array(DRAW).fill(null);
  let dN = 0, kSpeed = 0, kTurn = 0;              // this frame's smoothing of speed and facing
  const near = new Array(PROPS).fill(null), nearLee = new Array(PROPS).fill(null);
  const histogram = new Int32Array(64);
  const big = new Int32Array(BIG);                 // the draw entries of large bodies, which may shelter from Swells
  let bigN = 0;
  // this frame's lee records, to add each once for each lee-reach
  const leeX = new Float64Array(CASTERS), leeY = new Float64Array(CASTERS), leeReachOf = new Float64Array(CASTERS);
  let leeN = 0;
  const wx = new Float64Array(WAKE), wy = new Float64Array(WAKE);   // this frame's wake points, newest first
  let wN = 0;
  // the place: the bell-post, and the tileset's own fields
  let bellX = 0, bellY = 0, hasBell = false, ground = null;
  let shadowOn = false, shadowFrom = 0, shadowArc = 0, shadowReach = 0, shadowX = 0, shadowY = 0;
  const found = [];

  function startRun(S) {
    run = S;
    frame = 0;
    slotMap = new WeakMap();
    slotN = 0;
    cN = 0;
    snap = true;
    grey = 0;
    simLast = S.t;
    for (let i = 0; i < SLOTS; i++) sFig[i] = null;
    for (let i = 0; i < CORPSES; i++) cFig[i] = null;
    for (let i = 0; i < DRAW; i++) { dRef[i] = null; dFig[i] = null; }
    for (let i = 0; i < PROPS; i++) { near[i] = null; nearLee[i] = null; }
    envRun = null;
    // what the zone set down by hand faces the middle; the bell-post and the tileset's fields, once a run
    placed = new WeakSet();
    const place = S.zone && Array.isArray(S.zone.place) ? S.zone.place.length : 0;
    for (let i = 0; S.props && i < place && i < S.props.length; i++) placed.add(S.props[i]);
    found.length = 0;
    hasBell = !!S.region && World.withRole(S, 'bell-post', found) > 0;
    if (hasBell) { bellX = found[0].x; bellY = found[0].y; }
    found.length = 0;
    if (typeof Vfx.clear === 'function') Vfx.clear();
  }

  // ---- figures for things ----
  const byDef = new Map();          // an enemy, boss or minion def -> its figure
  let fallbackEnemy = null, fallbackMinion = null, playerFig = null, playerFor = null, gateFig = null, edgeFig = null;

  // A def names its figure in puppet (an enemy, a boss) or in fx.puppet (a voice that summons).
  function figureOf(def, fallback) {
    if (def === null || typeof def !== 'object') return fallback;
    let fig = byDef.get(def);
    if (fig === undefined) {
      const id = typeof def.puppet === 'string' ? def.puppet : def.fx && typeof def.fx.puppet === 'string' ? def.fx.puppet : null;
      fig = (id !== null && Rigs.figure(id)) || fallback;
      byDef.set(def, fig);
    }
    return fig;
  }

  function firstFigure(ids) {
    for (let i = 0; i < ids.length; i++) {
      const fig = Rigs.figure(ids[i]);
      if (fig) return fig;
    }
    const all = Defs.all('puppet');
    return all.length > 0 ? Rigs.figure(all[0].id) : null;
  }

  // The player's figure: its class's puppet, the class named by the character or, in a run without one, by cfg.class.
  function playerFigure(S) {
    if (playerFor === S) return playerFig;
    playerFor = S;
    const cfg = S.cfg || {}, char = cfg.char || null;
    const id = char && typeof char.class === 'string' ? char.class : typeof cfg.class === 'string' ? cfg.class : null;
    let fig = null;
    if (id !== null && Defs.has('class', id)) fig = Rigs.figure(Defs.get('class', id).puppet);
    playerFig = fig || firstFigure(['test.biped', 'debug.husk']);
    return playerFig;
  }

  // A prop's figure and light, worked out once for each prop def.
  const propInfo = new Map();
  function propOf(id) {
    let info = propInfo.get(id);
    if (info !== undefined) return info;
    info = null;
    if (Defs.has('prop', id)) {
      const def = Defs.get('prop', id), light = def.light || null, rgb = [1, 0.8, 0.5];
      if (light) colorInto(light.color, rgb);
      info = {
        fig: Rigs.figure(def.puppet), light: light !== null && light.radius > 0, radius: light ? light.radius : 0,
        r: rgb[0], g: rgb[1], b: rgb[2], height: light && light.height > 0 ? light.height : 1.2, strength: light && light.strength > 0 ? light.strength : 1,
      };
      if (!info.fig) info = null;
    }
    propInfo.set(id, info);
    return info;
  }

  function colorInto(v, out) {
    if (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) {
      const n = parseInt(v.slice(1), 16);
      out[0] = ((n >> 16) & 255) / 255; out[1] = ((n >> 8) & 255) / 255; out[2] = (n & 255) / 255;
    } else if (Array.isArray(v) && v.length >= 3) {
      out[0] = +v[0] || 0; out[1] = +v[1] || 0; out[2] = +v[2] || 0;
    }
    return out;
  }

  // A colour for the shots of a skill or an attack: its fx.light colour, or fx.color, else null.
  const shotColor = new Map();
  function fxColor(def) {
    if (def === null || typeof def !== 'object') return null;
    let c = shotColor.get(def);
    if (c !== undefined) return c;
    c = null;
    const fx = def.fx;
    const v = fx && typeof fx === 'object' ? (fx.light && fx.light.color) || fx.color : null;
    if (v) c = colorInto(v, [1, 1, 1]);
    shotColor.set(def, c);
    return c;
  }

  // A favour's shape in the world: the puppet 'favour.' + its icon, the motif the row paints (46-puppets-dial.js);
  // for an icon with no such puppet, a token: one of the unit shapes in a colour, both chosen by the icon's hash
  // as 62-glyphs.js chooses the token it paints. {fig, shape, rgb}, worked out once for each favour def.
  const TOKEN_COLOURS = ['#c79a45', '#6fb3a6', '#e4dfd1', '#a7312c', '#e6c25a', '#5b5470', '#5d6a39', '#8a5f37'];
  const favourLooks = new Map();
  function favourLook(def) {
    let look = favourLooks.get(def);
    if (look !== undefined) return look;
    const icon = def && typeof def === 'object' && def.icon !== undefined && def.icon !== null ? String(def.icon) : '';
    const h = Core.hashStr(icon) >>> 0;
    look = { fig: icon !== '' ? Rigs.figure('favour.' + icon) : null, shape: h % SHAPE_NAMES.length, rgb: colorInto(TOKEN_COLOURS[(h >>> 4) % 8], [1, 1, 1]) };
    favourLooks.set(def, look);
    return look;
  }

  // a number of the player's sheet, or what it is without one
  function stat(S, id, fallback) {
    const v = S.sheet && S.sheet.stats ? S.sheet.stats[id] : undefined;
    return typeof v === 'number' && v > 0 ? v : fallback;
  }

  // How tall a figure's body stands, in metres as fig.height is, without what it holds over its head: to the top
  // of its head joint and a head above it where the rig has a torso and a head, else its whole height. Worked out
  // once a figure.
  const bodyHeights = new Map();
  function bodyHeight(fig) {
    let h = bodyHeights.get(fig);
    if (h === undefined) {
      const t = fig.rig.index.torso, k = fig.rig.index.head, root = fig.rig.index.root;
      h = t !== undefined && k !== undefined && fig.rig.parent[k] === t && fig.rig.parent[t] === root
        ? Math.min(fig.height, (fig.rest[t * 3 + 1] + fig.rest[k * 3 + 1] + 0.25) * fig.scale) : fig.height;
      bodyHeights.set(fig, h);
    }
    return h;
  }

  // the colour of a rider: the figure of the dead the riders came from (S.crowd.rider, an enemy def's id)
  const riderColours = new Map();
  function riderLook(S) {
    const id = S.crowd && typeof S.crowd.rider === 'string' ? S.crowd.rider : null;
    if (id === null) return LOOK.rider;
    let c = riderColours.get(id);
    if (c === undefined) {
      const fig = Defs.has('enemy', id) ? Rigs.figure(Defs.get('enemy', id).puppet) : null;
      c = fig ? fig.color3 : LOOK.rider;
      riderColours.set(id, c);
    }
    return c;
  }

  function large(e) {
    if (typeof Dmg.large === 'function') return Dmg.large(e);
    return !!(e.def && e.def.size === 'large') || e.rank >= ELITE;
  }

  // ---- the look of the place ----
  let look = null, lookVersion = 0, envRun = null, envVersion = -1, envPuppets = null;
  const env = { ground: null, ambient: [0, 0, 0], sun: { dir: [0, -1, 0], color: [1, 1, 1] }, fog: { color: [0, 0, 0], near: 0, far: 0 } };
  const groundRGB = [0, 0, 0];

  Scene.look = function (next) {
    look = next && typeof next === 'object' ? next : null;
    lookVersion++;
  };

  function copy3(from, to, fallback) {
    const c = Array.isArray(from) && from.length >= 3 ? from : fallback;
    to[0] = +c[0] || 0; to[1] = +c[1] || 0; to[2] = +c[2] || 0;
  }

  function envFor(S, puppets) {
    if (envRun === S && envVersion === lookVersion && envPuppets === puppets) return;
    envRun = S;
    envVersion = lookVersion;
    envPuppets = puppets;
    const zone = S.zone || null, amb = zone && zone.ambient ? zone.ambient : null, L = look || {};
    const tileset = typeof L.tileset === 'string' ? L.tileset : zone && typeof zone.tileset === 'string' ? zone.tileset : null;
    const known = tileset !== null && Defs.has('tileset', tileset);
    ground = known ? Defs.get('tileset', tileset) : null;
    edgeFig = ground && ground.edge && typeof ground.edge.puppet === 'string' ? Rigs.figure(ground.edge.puppet) : null;
    if (Array.isArray(L.ground)) { copy3(L.ground, groundRGB, MOON.ground); env.ground = groundRGB; }
    else if (known && puppets) env.ground = tileset;
    else {
      if (known) Ground.color(tileset, groundRGB); else copy3(null, groundRGB, MOON.ground);
      env.ground = groundRGB;
    }
    copy3(L.ambient || (amb ? amb.light : null), env.ambient, MOON.ambient);
    const sun = L.sun || (amb && amb.sun && typeof amb.sun === 'object' ? amb.sun : null);
    copy3(sun ? sun.dir : null, env.sun.dir, MOON.sunDir);
    copy3(sun ? sun.color : null, env.sun.color, MOON.sunColor);
    const fog = L.fog !== undefined ? L.fog : amb ? amb.fog : undefined;
    if (fog && typeof fog === 'object') {
      copy3(fog.color, env.fog.color, MOON.fog);
      env.fog.near = Number.isFinite(fog.near) ? fog.near : MOON.near;
      env.fog.far = Number.isFinite(fog.far) ? fog.far : MOON.far;
    } else if (typeof fog === 'number' && fog > 0) {
      // a number is a thickness: the fog is whole about 3 / thickness metres out, never nearer than 18
      copy3(null, env.fog.color, MOON.fog);
      env.fog.near = 4;
      env.fog.far = Math.max(18, Math.min(80, 3 / fog));
    } else {
      copy3(null, env.fog.color, MOON.fog);
      env.fog.near = MOON.near;
      env.fog.far = MOON.far;
    }
  }

  // ---- quality ----
  let level = 'high';
  Scene.quality = function (next) {
    if (next === 'high' || next === 'medium' || next === 'low') {
      level = next;
      const view = Gfx.active;
      if (view && typeof view.quality === 'function') view.quality(next);
      if (typeof Vfx.quality === 'function') Vfx.quality(next);
    }
    return level;
  };
  Plat.on('quality', function (next) {
    if (next !== 'high' && next !== 'medium' && next !== 'low') return;
    level = next;
    if (typeof Vfx.quality === 'function') Vfx.quality(next);
  });
  let dither = 0;
  Plat.on('boot', function () {
    const asked = Plat.query('quality');
    if (asked === 'high' || asked === 'medium' || asked === 'low') Scene.quality(asked);
    const d = Number(Plat.query('dither'));
    dither = d > 0 ? Math.min(1, d) : 0;
  });

  // ---- the camera ----
  function follow(S, alpha, wdt) {
    const p = S.player, x = p.px + (p.x - p.px) * alpha, y = p.py + (p.y - p.py) * alpha;
    let lx = (p.x - p.px) * HZ * LEAD_TIME, ly = (p.y - p.py) * HZ * LEAD_TIME;
    const lead = sqrt(lx * lx + ly * ly);
    if (lead > LEAD_MAX) { lx *= LEAD_MAX / lead; ly *= LEAD_MAX / lead; }
    const tx = x + lx, ty = y + ly, dx = tx - camX, dy = ty - camY;
    if (snap || !(dx * dx + dy * dy < SNAP * SNAP)) {
      camX = tx;
      camY = ty;
      snap = false;
    } else {
      const k = 1 - exp(-wdt / CAM_TAU);
      camX += dx * k;
      camY += dy * k;
    }
    shake.x = 0;
    shake.y = 0;
    if (typeof Vfx.offset === 'function') Vfx.offset(shake);
    cam.x = camX + shake.x;
    cam.y = camY + shake.y;
    if (!(cam.zoom > 0)) cam.zoom = 1;
  }

  // ---- what is on screen ----
  // The ground the screen shows, as four half-planes from the corners of the canvas; or, when a corner has no
  // ground under it, a circle as far as the view can see.
  const hx = new Float64Array(4), hy = new Float64Array(4), hd = new Float64Array(4), cx = new Float64Array(4), cy = new Float64Array(4);
  let useCircle = false, circleR = 30;

  function footprint(view) {
    const w = view.canvas.clientWidth || view.canvas.width || 1, h = view.canvas.clientHeight || view.canvas.height || 1;
    useCircle = false;
    for (let k = 0; k < 4; k++) {
      const got = view.screenToWorld(k === 1 || k === 2 ? w : 0, k >= 2 ? h : 0, corner);
      if (!got || !Number.isFinite(corner.x) || !Number.isFinite(corner.y)) { useCircle = true; break; }
      cx[k] = corner.x;
      cy[k] = corner.y;
    }
    circleR = typeof view.visibleRadius === 'function' ? view.visibleRadius() : 30;
    if (!(circleR > 0)) circleR = 30;
    if (useCircle) return;
    const mx = (cx[0] + cx[1] + cx[2] + cx[3]) / 4, my = (cy[0] + cy[1] + cy[2] + cy[3]) / 4;
    for (let k = 0; k < 4; k++) {
      const j = (k + 1) & 3, ex = cx[j] - cx[k], ey = cy[j] - cy[k], len = sqrt(ex * ex + ey * ey);
      if (!(len > 1e-6)) { useCircle = true; return; }
      let nx = -ey / len, ny = ex / len;
      if (nx * (mx - cx[k]) + ny * (my - cy[k]) < 0) { nx = -nx; ny = -ny; }
      hx[k] = nx; hy[k] = ny; hd[k] = nx * cx[k] + ny * cy[k];
    }
  }

  function inView(x, y, margin) {
    if (useCircle) {
      const dx = x - cam.x, dy = y - cam.y, r = circleR + margin;
      return dx * dx + dy * dy <= r * r;
    }
    return hx[0] * x + hy[0] * y - hd[0] >= -margin && hx[1] * x + hy[1] * y - hd[1] >= -margin &&
      hx[2] * x + hy[2] * y - hd[2] >= -margin && hx[3] * x + hy[3] * y - hd[3] >= -margin;
  }

  // ---- slots: what the scene remembers of each moving thing between frames ----
  function slotOf(o) {
    let s = slotMap.get(o);
    if (s === undefined) {
      if (slotN >= SLOTS) return -1;
      s = slotN++;
      slotMap.set(o, s);
      sUid[s] = -1;
      sSeen[s] = -2;
    }
    return s;
  }

  function seedOf(uid) { return ((Math.imul(uid + 1, 2654435761) >>> 0) % 100000) / 100000; }

  // Starts a slot for a thing it has not seen before (or for a new thing in a reused object).
  function begin(s, e, kind, fig, scale, x, y, now) {
    sUid[s] = e.uid;
    sKind[s] = kind;
    sFig[s] = fig;
    sX[s] = x;
    sY[s] = y;
    sWalk[s] = 0;
    sSeed[s] = seedOf(e.uid);
    sCycle[s] = sSeed[s];
    sSpeed[s] = 0;
    sFace[s] = e.face;
    sScale[s] = scale;
    sHurt[s] = -99;
    sFlash[s] = e.flash || 0;
    sLife[s] = e.life;
    sRank[s] = kind === KIND_ENEMY ? e.rank : 0;
    sDead[s] = -1;
    sBorn[s] = now;
  }

  // The thing in slot s has left its pool: if it was where the camera can see, it dies there.
  function vanish(s, now) {
    const fig = sFig[s];
    sSeen[s] = -2;
    if (fig === null || sKind[s] === KIND_PLAYER) return;
    const x = sX[s], y = sY[s];
    if (!inView(x, y, MARGIN + fig.height * sScale[s] * HEIGHT_MARGIN)) return;
    if (sLife[s] > 0 && typeof Vfx.harm === 'function') Vfx.harm(sUid[s], x, y, fig.height * sScale[s], sLife[s], 0);
    if (cN >= CORPSES) return;
    const c = cN++;
    cFig[c] = fig; cX[c] = x; cY[c] = y; cFace[c] = sFace[s]; cScale[c] = sScale[s]; cSeed[c] = sSeed[s]; cCycle[c] = sCycle[s];
    cT0[c] = now; cRank[c] = sRank[s];
  }

  // Follows one moving thing: its walk, its speed, its facing, its hurts. Returns its slot, or -1.
  function track(e, kind, fig, scale, alpha, now, dt) {
    const s = slotOf(e);
    if (s < 0) return -1;
    const x = e.px + (e.x - e.px) * alpha, y = e.py + (e.y - e.py) * alpha;
    if (sUid[s] !== e.uid) {
      if (sSeen[s] === frame - 1) vanish(s, now);
      begin(s, e, kind, fig, scale, x, y, now);
    }
    sSeen[s] = frame;
    sFig[s] = fig;
    sScale[s] = scale;
    const dx = x - sX[s], dy = y - sY[s];
    sX[s] = x;
    sY[s] = y;
    // facing: turned toward the simulation's, quickly, so a snap in it does not show
    const f = Core.angleWrap(sFace[s] + Core.angleWrap(e.face - sFace[s]) * kTurn);
    sFace[s] = f;
    if (dt > 0) {
      const moved = sqrt(dx * dx + dy * dy);
      sSpeed[s] += (Math.min(moved / dt, 30) - sSpeed[s]) * kSpeed;
      if (moved > 0 && moved < 4) {
        st.speed = sSpeed[s];
        st.scale = scale;
        st.walk = sWalk[s];
        st.cycle = sCycle[s];
        Rigs.advance(fig, st, dx * cos(f) + dy * sin(f));
        sWalk[s] = st.walk;
        sCycle[s] = st.cycle;
      }
    }
    // hurt: its flash rose, or its life fell
    const flash = e.flash || 0, life = e.life;
    if (flash > sFlash[s] + 0.01 || life < sLife[s] - 1e-6) sHurt[s] = now;
    if (life < sLife[s] - 1e-6 && typeof Vfx.harm === 'function' && inView(x, y, 1)) {
      Vfx.harm(e.uid, x, y, fig.height * scale, sLife[s] - life, kind === KIND_PLAYER ? 1 : 0);
    }
    sFlash[s] = flash;
    sLife[s] = life;
    return s;
  }

  function push(kind, slot, ref, fig, x, y, d2, face) {
    if (dN >= DRAW) return;
    const i = dN++;
    dKind[i] = kind; dSlot[i] = slot; dRef[i] = ref; dFig[i] = fig; dX[i] = x; dY[i] = y; dD2[i] = d2; dLod[i] = 0; dFace[i] = face;
  }

  // ---- filling the buffers ----
  function collect(S, alpha, now, dt, px, py) {
    dN = 0;
    bigN = 0;
    let culled = 0;
    // the player
    const p = S.player, pf = playerFigure(S);
    if (pf) {
      const s = track(p, KIND_PLAYER, pf, 1, alpha, now, dt);
      if (s >= 0) {
        if (p.alive === false && sDead[s] < 0) sDead[s] = now;
        push(KIND_PLAYER, s, p, pf, sX[s], sY[s], 0, 0);
      }
    }
    // enemies
    const curves = S.curves, enemies = S.enemies;
    for (let i = 0; i < enemies.n; i++) {
      const e = enemies.items[i];
      if (!e.alive) continue;
      const def = e.def, fig = figureOf(def, fallbackEnemy);
      if (fig === null) continue;
      const scale = def && def.radius > 0 && e.r > 0 ? e.r / def.radius : curves && curves.rank && curves.rank[e.rank] ? curves.rank[e.rank].size : 1;
      const s = track(e, KIND_ENEMY, fig, scale, alpha, now, dt);
      if (s < 0) continue;
      sRank[s] = e.rank;
      const x = sX[s], y = sY[s];
      if (!inView(x, y, MARGIN + fig.radius * scale + fig.height * scale * HEIGHT_MARGIN)) { culled++; continue; }
      if (bigN < BIG && large(e)) big[bigN++] = dN;
      push(KIND_ENEMY, s, e, fig, x, y, (x - px) * (x - px) + (y - py) * (y - py), 0);
    }
    // minions
    const minions = S.minions;
    for (let i = 0; minions && i < minions.n; i++) {
      const m = minions.items[i];
      if (!m.alive) continue;
      const fig = figureOf(m.def, fallbackMinion);
      if (fig === null) continue;
      const scale = m.def && m.def.radius > 0 && m.r > 0 ? m.r / m.def.radius : 1;
      const s = track(m, KIND_MINION, fig, scale, alpha, now, dt);
      if (s < 0) continue;
      const x = sX[s], y = sY[s];
      if (!inView(x, y, MARGIN + fig.radius * scale + fig.height * scale * HEIGHT_MARGIN)) { culled++; continue; }
      push(KIND_MINION, s, m, fig, x, y, (x - px) * (x - px) + (y - py) * (y - py), 0);
    }
    // things seen last frame and gone now
    for (let s = 0; s < slotN; s++) if (sSeen[s] === frame - 1) vanish(s, now);
    // the dying
    for (let c = 0; c < cN; c++) {
      if (now - cT0[c] >= DIE_TIME || now < cT0[c] - 1) {
        cN--;
        cFig[c] = cFig[cN]; cX[c] = cX[cN]; cY[c] = cY[cN]; cFace[c] = cFace[cN]; cScale[c] = cScale[cN]; cSeed[c] = cSeed[cN];
        cCycle[c] = cCycle[cN]; cT0[c] = cT0[cN]; cRank[c] = cRank[cN];
        cFig[cN] = null;
        c--;
        continue;
      }
      push(KIND_CORPSE, c, null, cFig[c], cX[c], cY[c], (cX[c] - px) * (cX[c] - px) + (cY[c] - py) * (cY[c] - py), 0);
    }
    // props near what the camera sees: set down by hand they face the middle of the region, else turn at random
    if (S.region && S.props && S.props.length > 0) {
      const n = World.propsNear(S, cam.x, cam.y, circleR + 8, near);
      for (let i = 0; i < n && i < PROPS; i++) {
        const q = near[i], info = propOf(q.id);
        if (info === null) continue;
        if (!inView(q.x, q.y, MARGIN + info.fig.radius + info.fig.height * HEIGHT_MARGIN)) continue;
        const h = sin(q.x * 12.9898 + q.y * 78.233) * 43758.5453;
        const face = placed.has(q) ? atan2(S.region.y - q.y, S.region.x - q.x) : (h - floor(h)) * TAU;
        push(KIND_PROP, -1, q, info.fig, q.x, q.y, (q.x - px) * (q.x - px) + (q.y - py) * (q.y - py), face);
      }
    }
    // the low wall round the edge of the region, where the tileset has one
    if (edgeFig && S.region && ground && ground.edge && ground.edge.step > 0) {
      const R = S.region.radius + 0.3, n = Math.min(WALLS, Math.round(TAU * R / ground.edge.step));
      const reach = MARGIN + edgeFig.radius + edgeFig.height * HEIGHT_MARGIN;
      for (let k = 0; k < n; k++) {
        const a = k / n * TAU, x = S.region.x + cos(a) * R, y = S.region.y + sin(a) * R;
        if (!inView(x, y, reach)) continue;
        push(KIND_WALL, k, null, edgeFig, x, y, (x - px) * (x - px) + (y - py) * (y - py), a + PI);
      }
    }
    // the gate
    if (S.gate && gateFig && inView(S.gate.x, S.gate.y, MARGIN + gateFig.radius + gateFig.height * HEIGHT_MARGIN)) {
      push(KIND_GATE, -1, S.gate, gateFig, S.gate.x, S.gate.y, (S.gate.x - px) * (S.gate.x - px) + (S.gate.y - py) * (S.gate.y - py), PI / 2);
    }
    stats.culled = culled;
  }

  // Detail parts first, then the farthest common enemies drawn as a body and a head, until the parts fit within
  // the limit less what is kept for the marks.
  function budget() {
    const all = Math.max(0, Scene.limits.parts | 0), limit = all - Math.min(MARK_MOST, floor(all * MARK_SHARE));
    let full = 0, plain = 0, enemies = 0;
    for (let i = 0; i < dN; i++) {
      full += dFig[i].n;
      plain += dKind[i] === KIND_PLAYER ? dFig[i].n : dFig[i].counts.plain;
      if (dKind[i] === KIND_ENEMY || dKind[i] === KIND_MINION || dKind[i] === KIND_CORPSE) enemies++;
    }
    stats.enemies = enemies;
    const detail = full <= limit && enemies <= CROWD;
    stats.detail = detail;
    let total = detail ? full : plain, cut = 0;
    if (total > limit) {
      // the distance beyond which common enemies (and the dying) keep only their core, found from a histogram
      let far = 1;
      for (let i = 0; i < dN; i++) if (dD2[i] > far) far = dD2[i];
      far = sqrt(far) + 1e-3;
      histogram.fill(0);
      for (let i = 0; i < dN; i++) {
        if (!cuttable(i)) continue;
        histogram[Math.min(63, floor(sqrt(dD2[i]) / far * 64))] += dFig[i].counts.plain - dFig[i].counts.core;
      }
      let saved = 0, edge = 64;
      while (edge > 0 && total - saved > limit) saved += histogram[--edge];
      const from = edge / 64 * far;
      for (let i = 0; i < dN; i++) {
        if (cuttable(i) && sqrt(dD2[i]) >= from) { dLod[i] = 1; cut++; }
      }
      total -= saved;
    }
    stats.cut = cut;
    return detail;
  }

  function cuttable(i) {
    const k = dKind[i];
    if (k === KIND_CORPSE) return cRank[dSlot[i]] === COMMON;
    return k === KIND_ENEMY && sRank[dSlot[i]] === COMMON;
  }

  // The joints that strike for an attack's fx.part ('arms', 'shoulder', 'body'), as a mask for st.strike; 0 (the
  // rig's own) for anything else. Worked out once for each figure and part.
  const STRIKE_PARTS = new Map([['arms', ['armL', 'armR', 'handR']], ['shoulder', ['torso', 'head', 'armL', 'armR']], ['body', null]]);
  const strikeMasks = new Map();
  function strikeMask(fig, part) {
    if (typeof part !== 'string' || !STRIKE_PARTS.has(part)) return 0;
    let byPart = strikeMasks.get(fig);
    if (byPart === undefined) { byPart = new Map(); strikeMasks.set(fig, byPart); }
    let m = byPart.get(part);
    if (m === undefined) {
      const names = STRIKE_PARTS.get(part);
      m = Rigs.mask(fig, names === null ? Rigs.joints(fig.rigName) : names);
      byPart.set(part, m);
    }
    return m;
  }

  // An enemy's act, from its state (Scene.ATTACK): the attack it winds up is def.attacks[e.attack], else its first;
  // the wind-up lasts a1 seconds where the body says (22-enemies.js), else the attack's windup. The attack's
  // fx.part says which of the figure's parts whiten as it strikes.
  function actOf(e, st, fig) {
    const A = Scene.ATTACK;
    st.act = Rigs.NONE;
    if (!e || typeof e.state !== 'number' || (e.state !== A.windup && e.state !== A.strike)) return;
    const list = e.def && e.def.attacks ? e.def.attacks : null, at = typeof e.attack === 'number' && e.attack >= 0 ? e.attack : 0;
    const ref = list && list.length > at ? list[at] : null;
    const atk = ref && typeof ref === 'object' ? ref : typeof ref === 'string' && Defs.has('attack', ref) ? Defs.get('attack', ref) : null;
    st.strike = atk && atk.fx && typeof atk.fx === 'object' ? strikeMask(fig, atk.fx.part) : 0;
    if (e.state === A.windup) {
      st.act = Rigs.WINDUP;
      st.actT = e.stateT;
      const w = e.a1 > 0.05 ? e.a1 : atk ? atk.windup : 0.5;
      st.actLen = w > 0.05 ? w : 0.5;
    } else {
      st.act = Rigs.STRIKE;
      st.actT = e.stateT;
      st.actLen = A.length;
    }
  }

  // ---- the ground of the place: hour lines and the district's shade (the Dial's shadow) ----
  function placeMarks(S) {
    shadowOn = false;
    if (!S.region) return;
    const R = S.region.radius, h = ground ? ground.hours : null;
    if (h && h.count > 0 && hasBell) {
      const c = Array.isArray(h.color) ? h.color : LOOK.rim, a = h.alpha > 0 ? h.alpha : 0.3, w = h.width > 0 ? h.width : 0.1;
      for (let k = 0; k < h.count; k++) {
        const ang = -PI / 2 + k / h.count * TAU, from = 1.3;
        mark(bellX + cos(ang) * from, bellY + sin(ang) * from, R - from - 0.4, c, a, 1, BAR, ang, w);
      }
    }
    // the shade as the director keeps it (S.vigil.shade: from x, y, sunwise from `from` through span radians,
    // reach metres long), in the tileset's colour; its leading edge, the clock's hand, a little darker
    const sh = S.vigil && S.vigil.shade && S.vigil.shade.on === true ? S.vigil.shade : null;
    if (sh && sh.span > 0 && sh.reach > 0) {
      const look = ground && ground.shadow ? ground.shadow : null, c = look && Array.isArray(look.color) ? look.color : LOOK.rim;
      const a = look && look.alpha > 0 ? look.alpha : 0.35, lead = sh.from + sh.span;
      shadowOn = true; shadowFrom = sh.from; shadowArc = sh.span; shadowReach = sh.reach; shadowX = sh.x; shadowY = sh.y;
      mark(sh.x, sh.y, sh.reach, c, a, 1, SECTOR, sh.from + sh.span / 2, sh.span);
      mark(sh.x + cos(lead) * 0.8, sh.y + sin(lead) * 0.8, sh.reach - 0.8, c, a, 1, BAR, lead, 0.14);
    }
  }

  function inShadow(x, y) {
    if (!shadowOn) return false;
    const dx = x - shadowX, dy = y - shadowY;
    if (dx * dx + dy * dy > shadowReach * shadowReach) return false;
    return Core.mod(atan2(dy, dx) - shadowFrom, TAU) <= shadowArc;
  }

  // ---- the wake: a faint line from the player back over wake-length seconds ----
  function wakeLine(S, px, py) {
    wN = 0;
    stats.wake = 0;
    const W = S.wake;
    if (!W || !(W.n > 0) || !W.x || !W.y) return;
    const cap = W.x.length, want = Math.min(W.n, WAKE - 1, Math.round(stat(S, 'wake-length', 5) * 10) + 1);
    let k = W.head | 0, lx = px, ly = py, drawn = 0;
    for (let j = 0; j < want; j++) {
      const x = W.x[k], y = W.y[k];
      wx[wN] = x; wy[wN] = y; wN++;
      const dx = x - lx, dy = y - ly, len = sqrt(dx * dx + dy * dy);
      if (len > 0.02 && len < 4 && (inView(x, y, 1) || inView(lx, ly, 1))) {
        mark(lx, ly, len, LOOK.wake, 0.34 * (1 - j / want) + 0.04, 1, BAR, atan2(dy, dx), 0.07);
        drawn++;
      }
      lx = x; ly = y;
      k = k > 0 ? k - 1 : cap - 1;
    }
    stats.wake = drawn;
  }

  // ---- the wounds lying open ----
  function wounds(S, now, px, py, braced) {
    const W = S.wounds;
    let n = 0;
    if (W && W.n > 0 && W.x) {
      const term = stat(S, 'wound-term', 60), reach = stat(S, 'mend-reach', 1);
      for (let i = 0; i < W.n; i++) {
        const x = W.x[i], y = W.y[i];
        if (!inView(x, y, 0.6)) continue;
        const deep = Math.min(1, Math.max(0, (W.depth ? W.depth[i] : 0) / 2.5));
        const age = Math.min(1, Math.max(0, (now - (W.opened ? W.opened[i] : now)) / term)), g = age * age;
        const r0 = LOOK.wound[0] + (LOOK.deep[0] - LOOK.wound[0]) * deep, g0 = LOOK.wound[1] + (LOOK.deep[1] - LOOK.wound[1]) * deep;
        const b0 = LOOK.wound[2] + (LOOK.deep[2] - LOOK.wound[2]) * deep;
        decalN = Scene.decal(decalBuf, decalN, x, y, 0.5, r0 + (LOOK.scar[0] - r0) * g, g0 + (LOOK.scar[1] - g0) * g, b0 + (LOOK.scar[2] - b0) * g,
          0.9, 1, DISC, 0, 0);
        n++;
        // a ring closing on it as it gives its life back: bright while the player stands Braced on it
        const back = W.back ? W.back[i] : 0, life = W.life ? W.life[i] : 0;
        if (back > 0 && back + life > 0) {
          const share = back / (back + life), on = braced && (x - px) * (x - px) + (y - py) * (y - py) <= reach * reach;
          mark(x, y, 0.06 + 0.46 * (1 - share), LOOK.mend, on ? 0.95 : 0.45, -0.3, RING, 0, 0);
        }
      }
    }
    stats.wounds = n;
  }

  // ---- Swells: filling in pale bone with a dark rim, their lee cut out ----
  // A lee record for a body or a prop at (x, y), once a frame for each reach. (A view cuts every cut decal by every
  // lee record, so where the dead's Swells and the voices' lie near the same shelter in one frame, the longer reach
  // shows on both.)
  function lee(x, y, r, reach) {
    if (leeN >= CASTERS) return;
    for (let i = 0; i < leeN; i++) if (leeX[i] === x && leeY[i] === y && leeReachOf[i] === reach) return;
    leeX[leeN] = x; leeY[leeN] = y; leeReachOf[leeN] = reach; leeN++;
    mark(x, y, r, LOOK.rim, 0, 0, LEE, 0, reach);
  }

  // Everything that may shelter ground from a spreading Swell whose source is (sx, sy) and that reaches `reach`.
  function shelters(S, sx, sy, reach, leeReach) {
    for (let k = 0; k < bigN; k++) {
      const i = big[k], e = dRef[i], dx = dX[i] - sx, dy = dY[i] - sy, far = reach + leeReach + e.r;
      if (dx * dx + dy * dy <= far * far) lee(dX[i], dY[i], e.r, leeReach);
    }
    if (S.region) {
      const n = World.propsNear(S, sx, sy, reach + leeReach, nearLee);
      for (let i = 0; i < n && i < PROPS; i++) if (nearLee[i].r > 0) lee(nearLee[i].x, nearLee[i].y, nearLee[i].r, leeReach);
    }
  }

  // The shape of area a as Dmg.inside reads it, into shForm, shOpen, shLength and shWidth: a voice's area (team 0)
  // by its own fields (len above 0: a lane len long and 2 r wide along angle; else a3 above 0: a wedge of that
  // opening round angle), one of the dead's by its def's shape ('wedge' and 'arc' with def.angle, 'line' with len);
  // else a circle of radius r.
  let shForm = RING, shOpen = 0, shLength = 0, shWidth = 0;
  function areaShape(a, def, team1) {
    let lane = false, open = 0;
    if (!team1) {
      if (a.len > 0) lane = true;
      else if (a.a3 > 0) open = a.a3;
    } else if (def) {
      if ((def.shape === 'wedge' || def.shape === 'arc') && def.angle > 0) open = def.angle;
      else if (def.shape === 'line' && a.len > 0) lane = true;
    }
    shForm = lane ? BAR : open > 0 ? SECTOR : RING;
    shOpen = open;
    shLength = lane ? a.len : a.r;
    shWidth = lane ? 2 * a.r : 0;
  }

  function swells(S) {
    leeN = 0;
    let n = 0;
    const areas = S.areas, leeReach = stat(S, 'lee-reach', 3), boss = S.boss;
    // a voice's area is a Swell while it fills and as it lands (the states of 23-skills.js; else it is a Drag zone or
    // the mark of a Blow), and the dead keep their own lee-reach against it
    const FILLING = typeof Skills.FILL === 'number' ? Skills.FILL : 0, LANDED = typeof Skills.LANDED === 'number' ? Skills.LANDED : 3;
    const deadLee = typeof Skills.LEE === 'number' ? Skills.LEE : 3;
    for (let i = 0; areas && i < areas.n; i++) {
      const a = areas.items[i];
      if (!a.alive || !(a.r > 0)) continue;
      const def = a.def, team1 = a.team === 1;
      let kind = null;
      if (team1) {
        kind = def && typeof def.type === 'string' ? def.type : null;
        if (def && def.kind === 'zone') kind = 'zone';
      } else kind = a.state === FILLING || a.state === LANDED ? 'swell' : 'voice';
      const reach = a.r + (a.len > 0 ? a.len : 0);
      if (!inView(a.x, a.y, reach)) continue;
      const k = a.t + a.ttl > 0 ? Math.min(1, Math.max(0, a.t / (a.t + a.ttl))) : 1;
      areaShape(a, def, team1);
      const form = shForm, length = shLength, arc = form === SECTOR ? shOpen : shWidth, angle = a.angle || 0;
      if (kind === 'swell') {
        // it falls or spreads by what it is, wherever it lies: one of the dead's falls when its attack is of kind
        // 'fall'; a voice's spreads from x, y when its a0 is 1 and falls on x, y when it is 0
        const fall = team1 ? !!def && def.kind === 'fall' : a.a0 !== 1;
        // the keeper's echoes, worth well under its full stroke, are fainter
        let echo = false;
        if (team1 && boss && a.owner === boss.uid && def && def.mult > 0 && boss.damage > 0) echo = a.damage < 0.6 * boss.damage * def.mult;
        const cut = fall ? 0 : CUT;
        if (!fall) shelters(S, a.x, a.y, reach, team1 ? leeReach : deadLee);
        mark(a.x, a.y, length, fall ? LOOK.fall : LOOK.bone, fall ? 0.5 : echo ? 0.36 : 0.7, fall ? -k : k, form + cut, angle, arc);
        mark(a.x, a.y, length, LOOK.rim, echo ? 0.5 : 0.92, 0, form + cut, angle, arc);
        n++;
      } else if (kind === 'zone') {
        // bad ground: a dark patch with a darker rim
        mark(a.x, a.y, length, LOOK.fall, 0.3, 1, form === RING ? DISC : form, angle, arc);
        mark(a.x, a.y, length, LOOK.rim, 0.6, 0, form, angle, arc);
      } else if (!team1) {
        // a voice's Drag zone or the mark of its Blow, in its shape and the voice's colour, gone as it ends
        const sk = a.skill >= 0 && S.skills ? S.skills[a.skill] : null, id = sk && sk.inst ? sk.inst.id : null;
        const c = typeof id === 'string' && Defs.has('voice', id) ? fxColor(Defs.get('voice', id)) : null;
        mark(a.x, a.y, length, c || LOOK.posture, 0.7 * (1 - k * k), 0, form, angle, arc);
      } else {
        mark(a.x, a.y, length, LOOK.rim, 0.7, 0, form, angle, arc);
      }
    }
    stats.swells = n;
    stats.lees = leeN;
  }

  // ---- the marks of one body: posture under it, conditions on it, its thread to the wake ----
  // face is the way the figure is drawn facing.
  function bodyMarks(S, kind, e, fig, x, y, scale, face, puppets) {
    const r = e.r > 0 ? e.r : fig.radius * scale * 0.6, H = bodyHeight(fig) * scale;
    const P = typeof Dmg.POSE === 'object' && Dmg.POSE ? Dmg.POSE : POSE, pose = typeof e.pose === 'number' ? e.pose : -1;
    if (pose === P.braced) {
      mark(x, y, r * 1.12 + 0.1, LOOK.posture, 0.85, -0.24, RING, 0, 0);
      stats.postures++;
    } else if (pose === P.striding) {
      // two short streaks trailing from its back edge, against the way it means to go
      let ux = e.vx, uy = e.vy;
      const v = sqrt(ux * ux + uy * uy);
      if (v > 0.05) { ux /= v; uy /= v; } else { ux = cos(e.face); uy = sin(e.face); }
      const back = atan2(-uy, -ux), len = 0.55 + 0.6 * r, side = r * 0.5;
      mark(x - ux * r * 0.8 - uy * side, y - uy * r * 0.8 + ux * side, len, LOOK.posture, 0.7, 1, BAR, back, 0.06);
      mark(x - ux * r * 0.8 + uy * side, y - uy * r * 0.8 - ux * side, len, LOOK.posture, 0.7, 1, BAR, back, 0.06);
      stats.postures++;
    }
    const T = e.condT, V = e.condV, N = e.condN;
    if (!T) return;
    if (!puppets && rowWF >= 0 && T[rowWF] > 0) mark(x, y, r * 1.35 + 0.06, LOOK.white, 1, -0.3, RING, 0, 0);
    // In Procession: a thin thread to the nearest point of the wake
    if (rowProc >= 0 && N[rowProc] === 1 && wN > 0) {
      let best = 0, bd = Infinity;
      for (let j = 0; j < wN; j++) {
        const dx = wx[j] - x, dy = wy[j] - y, d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = j; }
      }
      const d = sqrt(bd);
      if (d > 0.12) mark(x, y, d, LOOK.thread, 0.5, 1, BAR, atan2(wy[best] - y, wx[best] - x), 0.035);
      stats.threads++;
    }
    // swing: from 3, a short tick for each round it, centred on the way the last Blow went, the ticks closing
    // into a full round as it nears going over
    if (rowSwing >= 0 && N[rowSwing] >= 3) {
      const most = kind === KIND_ENEMY && e.rank >= KEEPER ? 12 : 6, count = Math.min(most, N[rowSwing] | 0), step = TAU / most;
      for (let k = 0; k < count; k++) {
        const a = V[rowSwing] + (k - (count - 1) / 2) * step, from = r + 0.24;
        mark(x + cos(a) * from, y + sin(a) * from, 0.18, LOOK.tick, 0.95, 1, BAR, a, 0.08);
      }
    }
    // Sounded: two thin hoops round it, like the bands of a bell
    if (rowSound >= 0 && T[rowSound] > 0) {
      if (puppets) {
        hoop(x, y, H * 0.42, r * 1.18, 0.045, LOOK.sounded);
        hoop(x, y, H * 0.6, r * 1.3, 0.045, LOOK.sounded);
      } else {
        mark(x, y, r * 1.4, LOOK.sounded, 0.9, -0.1, RING, 0, 0);
        mark(x, y, r * 1.65, LOOK.sounded, 0.9, -0.08, RING, 0, 0);
      }
    }
    // Coiled: a hoop of rope at its feet for each coil
    if (rowCoil >= 0 && N[rowCoil] >= 1) {
      const coils = Math.min(3, N[rowCoil] | 0);
      for (let k = 0; k < coils; k++) {
        if (puppets) hoop(x, y, 0.03 + 0.085 * k, r * 1.05 + 0.04, 0.07, LOOK.coil);
        else mark(x, y, r * (1.2 + 0.16 * k), LOOK.coil, 0.95, -0.12, RING, 0, 0);
      }
    }
    // riders: small boxes stuck on it
    if (rowClung >= 0 && N[rowClung] >= 1) {
      const riders = Math.min(RIDERS.length, N[rowClung] | 0), f = face, sf = sin(f), cf = cos(f), R = Math.max(r, 0.3);
      for (let k = 0; k < riders; k++) {
        const ax = RIDERS[k][0] * R, az = RIDERS[k][2] * R, h = RIDERS[k][1] * H;
        const rx = x + sf * ax + cf * az, ry = y - cf * ax + sf * az;
        if (puppets) {
          solid(BOX, rx, ry, h, 0.17, 0.19, 0.15, -f, 0, riderLook(S), 0);
          solid(BOX, rx, ry, h + 0.19, 0.19, 0.05, 0.17, -f, 0, LOOK.riderCap, 0);
        } else board(rx, ry, h, 0.2, LOOK.riderCap[0], LOOK.riderCap[1], LOOK.riderCap[2], 1, 0);
      }
    }
    // sealed: a red wax disc on the body, turned to the camera; coined: two bright discs at its eyes
    const toward = r * 0.95 + 0.04;
    if (rowSeal >= 0 && T[rowSeal] > 0) {
      if (puppets) solid(CYL, x, y + toward, H * 0.55, 0.3, 0.05, 0.3, 0, SEAL_PITCH, LOOK.wax, 0);
      else board(x, y, H * 0.55, 0.3, LOOK.wax[0], LOOK.wax[1], LOOK.wax[2], 1, 0);
    }
    if (rowCoin >= 0 && T[rowCoin] > 0) {
      for (let s = -1; s <= 1; s += 2) {
        if (puppets) solid(CYL, x + s * 0.07, y + toward * 0.6, H * 0.86, 0.09, 0.03, 0.09, 0, SEAL_PITCH, LOOK.coin, 0.35);
        else board(x + s * 0.08, y, H * 0.86, 0.1, LOOK.coin[0], LOOK.coin[1], LOOK.coin[2], 1, 0);
      }
    }
  }

  let castAt = -99;   // when the player last cast, by the run's clock

  function emit(S, alpha, now, puppets, darkDiscs, detail, flashK) {
    const all = Math.max(0, Scene.limits.parts | 0), limit = all - Math.min(MARK_MOST, floor(all * MARK_SHARE)), shadowR = 0.45;
    const gate = S.gate, p = S.player, gateR = S.rules && S.rules.gateRadius > 0 ? S.rules.gateRadius : 1.7;
    let figures = 0;
    for (let i = 0; i < dN; i++) {
      const kind = dKind[i], fig = dFig[i], s = dSlot[i], e = dRef[i], body = kind === KIND_PLAYER || kind === KIND_ENEMY || kind === KIND_MINION;
      // the state of the figure
      st.alpha = alpha; st.act = Rigs.NONE; st.actT = 0; st.actLen = 0; st.hurt = 99; st.dying = false; st.die = 0;
      st.flash = 0; st.opacity = 1; st.glow = 1; st.tintR = st.tintG = st.tintB = 1; st.grey = 0; st.shell = 0; st.strike = 0; st.lift = 0;
      st.lod = dLod[i];
      st.detail = kind === KIND_PLAYER || detail;
      st.t = now;
      let scale = 1, x = dX[i], y = dY[i];
      if (body) {
        st.x = e.x; st.y = e.y; st.px = e.px; st.py = e.py;
        st.face = sFace[s]; scale = sScale[s]; st.speed = sSpeed[s]; st.walk = sWalk[s]; st.cycle = sCycle[s]; st.seed = sSeed[s];
        st.hurt = now - sHurt[s];
        // a hit only lightens a body: white belongs to the top of a wind-up and to the outline of the Wrong-footed
        st.flash = (e.flash > 0 ? Math.min(1, e.flash) : 0) * flashK * HIT_FLASH;
        if (kind === KIND_PLAYER) {
          if (now - castAt < 0.3) { st.act = Rigs.CAST; st.actT = now - castAt; st.actLen = 0.3; }
          if (sDead[s] >= 0) { st.dying = true; st.die = Math.min(0.62, (now - sDead[s]) / DIE_TIME); }
        } else {
          actOf(e, st, fig);
          const shade = 0.9 + 0.2 * st.seed;
          st.tintR = shade * (1 + 0.05 * (st.seed - 0.5)); st.tintG = shade; st.tintB = shade * (1 - 0.05 * (st.seed - 0.5));
          if (kind === KIND_ENEMY && e.rank >= ELITE) { st.glow = 1.8; st.tintR *= 1.08; st.tintG *= 1.02; }
        }
        // conditions that change the figure itself: mourning (black, then grey), Wrong-footed (a white outline)
        const T = e.condT;
        if (T && rowMourn >= 0 && T[rowMourn] > 0) {
          const grade = e.condV[rowMourn];
          if (grade === 2) { st.grey = 1; st.tintR *= 0.24; st.tintG *= 0.23; st.tintB *= 0.27; }
          else if (grade === 1) { st.grey = 1; st.tintR *= 0.72; st.tintG *= 0.72; st.tintB *= 0.76; }
        }
        if (T && rowWF >= 0 && T[rowWF] > 0) st.shell = SHELL;
      } else if (kind === KIND_CORPSE) {
        st.x = st.px = x; st.y = st.py = y; st.face = cFace[s]; scale = cScale[s]; st.speed = 0; st.walk = 0; st.cycle = cCycle[s];
        st.seed = cSeed[s]; st.dying = true; st.die = (now - cT0[s]) / DIE_TIME;
        const shade = 0.9 + 0.2 * st.seed;
        st.tintR = st.tintG = st.tintB = shade;
      } else {
        st.x = st.px = x; st.y = st.py = y; st.speed = 0; st.walk = 0; st.cycle = 0; st.seed = 0; st.face = dFace[i];
        if (kind === KIND_GATE) {
          const far = e.far === true;
          st.glow = (far ? 2.2 : 1) * (0.85 + 0.15 * sin(now * 3)) + 0.6 * rungDown(S, e);
          // half seen through while the player stands in it, so the player is not lost under its roof
          if ((p.x - e.x) * (p.x - e.x) + (p.y - e.y) * (p.y - e.y) < (gateR + 0.8) * (gateR + 0.8)) st.opacity = 0.45;
        }
      }
      // the Dial's shadow darkens what stands in it
      if (kind !== KIND_GATE && inShadow(x, y)) { st.tintR *= 0.7; st.tintG *= 0.7; st.tintB *= 0.74; }
      st.scale = scale;
      if (puppets) {
        let want = st.lod > 0 ? fig.counts.core : st.detail ? fig.n : fig.counts.plain;
        if (st.shell > 0) {
          if (sink.total + want * 2 > limit) st.shell = 0; else want *= 2;
        }
        if (sink.total + want > limit) continue;
        if (Rigs.draw(fig, st, sink) > 0) figures++;
        if (darkDiscs && kind !== KIND_PROP && kind !== KIND_GATE && kind !== KIND_WALL) {
          const k = st.dying ? 1 - Math.min(1, st.die * 1.5) : 1;
          if (k > 0) decalN = Scene.decal(decalBuf, decalN, x, y, fig.radius * scale * shadowR + 0.08, 0, 0, 0, 0.3 * k, 1, DISC, 0, 0);
        }
      } else if (discN < DISCS) {
        const o = discN++ * discStride, c = fig.color3, w = st.flash, fade = st.dying ? 1 - Math.min(1, st.die) : 1;
        discBuf[o] = x; discBuf[o + 1] = y;
        discBuf[o + 2] = kind === KIND_PROP || kind === KIND_GATE || kind === KIND_WALL ? fig.radius * 0.8 : e && e.r > 0 ? e.r : fig.radius * scale * 0.6;
        discBuf[o + 3] = c[0] * st.tintR + (1 - c[0] * st.tintR) * w;
        discBuf[o + 4] = c[1] * st.tintG + (1 - c[1] * st.tintG) * w;
        discBuf[o + 5] = c[2] * st.tintB + (1 - c[2] * st.tintB) * w;
        discBuf[o + 6] = fade;
        figures++;
      }
      if (body && !st.dying) bodyMarks(S, kind, e, fig, x, y, scale, st.face, puppets);
      if (kind === KIND_WALL) stats.walls++;
      // a life bar: elites and greater, and anything hurt lately
      if ((kind === KIND_ENEMY || kind === KIND_MINION) && barN < BARS && e.lifeMax > 0) {
        const since = now - sHurt[s], ranked = kind === KIND_ENEMY && e.rank >= ELITE;
        if (ranked || (since < HURT_SHOW && e.life < e.lifeMax)) {
          const o = barN++ * BAR_STRIDE;
          barBuf[o] = x; barBuf[o + 1] = y; barBuf[o + 2] = fig.height * scale + 0.3;
          barBuf[o + 3] = Math.max(0, Math.min(1, e.life / e.lifeMax)); barBuf[o + 4] = kind === KIND_ENEMY ? e.rank : 0;
          barBuf[o + 5] = ranked ? 1 : Math.min(1, (HURT_SHOW - since) / 0.4);
        }
      }
    }
    stats.figures = figures;
  }

  function lightCandidate(x, y, z, radius, r, g, b, strength, px, py) {
    if (candN >= CANDIDATES || !(radius > 0) || !inView(x, y, radius)) return;
    const o = candN++ * 9;
    cand[o] = x; cand[o + 1] = y; cand[o + 2] = z; cand[o + 3] = radius; cand[o + 4] = r; cand[o + 5] = g; cand[o + 6] = b;
    cand[o + 7] = strength; cand[o + 8] = (x - px) * (x - px) + (y - py) * (y - py);
  }

  // The nearest of the candidates, at most Scene.limits.lights of them.
  function chooseLights() {
    const limit = Math.min(LIGHTS, Math.max(0, Scene.limits.lights | 0)), want = Math.min(limit, candN);
    for (let i = 0; i < want; i++) {
      let best = i;
      for (let j = i + 1; j < candN; j++) if (cand[j * 9 + 8] < cand[best * 9 + 8]) best = j;
      if (best !== i) for (let k = 0; k < 9; k++) { const t = cand[i * 9 + k]; cand[i * 9 + k] = cand[best * 9 + k]; cand[best * 9 + k] = t; }
      const o = i * lightStride, c = i * 9;
      for (let k = 0; k < 8; k++) lightBuf[o + k] = cand[c + k];
    }
    lightN = want;
  }

  // How far ringing down has gone at the open lychgate g, 0 to 1: its ring seconds against the strokes it takes.
  function rungDown(S, g) {
    const r = S.rules, full = r ? (r.ringStrokes > 0 ? r.ringStrokes : 6) * (r.strokeSeconds > 0 ? r.strokeSeconds : 1) : 6;
    const ring = g && g.ring > 0 ? g.ring : 0;
    return ring < full ? ring / full : 1;
  }

  // The lychgate's ring: one arc for each stroke of ringing down, lit as its stroke rings, the one ringing now
  // sweeping round; and, for the far lychgate of Tolled-for, a lit way to it from the player.
  function gateMarks(S, now, px, py, puppets) {
    const g = S.gate;
    if (!g) return;
    const rules = S.rules || {}, R = rules.gateRadius > 0 ? rules.gateRadius : 1.7;
    const strokes = rules.ringStrokes > 0 ? rules.ringStrokes : 6, each = rules.strokeSeconds > 0 ? rules.strokeSeconds : 1;
    if (inView(g.x, g.y, R + 0.4)) {
      mark(g.x, g.y, R, LOOK.lamp, 0.6, -0.06, RING, 0, 0);
      const done = Math.min(strokes, g.strokes > 0 ? g.strokes | 0 : 0), rung = g.ring > 0 ? g.ring / each : 0, part = TAU / strokes, gap = 0.08;
      for (let k = 0; k < strokes; k++) {
        const a0 = -PI / 2 + k * part;
        if (k < done) mark(g.x, g.y, R, LOOK.lamp, 0.85, -0.34, SECTOR, a0 + part / 2, part - gap);
        else if (k === done && rung > k) {
          const sweep = Math.min(1, rung - k) * (part - gap);
          if (sweep > 0.02) mark(g.x, g.y, R, LOOK.lamp, 0.85, -0.34, SECTOR, a0 + gap / 2 + sweep / 2, sweep);
        }
      }
    }
    const far = g.far === true, lit = 1.1 + 0.3 * sin(now * 3) + rungDown(S, g);
    lightCandidate(g.x, g.y, 1.9, far ? 12 : 8, LOOK.lamp[0], LOOK.lamp[1], LOOK.lamp[2], far ? 2 : lit, px, py);
    if (far) {
      // the lit way: warm motes on the ground from the player toward the far lychgate, walking toward it
      const dx = g.x - px, dy = g.y - py, d = sqrt(dx * dx + dy * dy);
      if (d > 2.5) {
        const ux = dx / d, uy = dy / d, flow = (now * 1.6) % 1;
        for (let k = 0; k < 7; k++) {
          const along = 1.4 + (k + flow) * 0.75;
          if (along > d - 1) break;
          const fade = 1 - k / 7;
          board(px + ux * along, py + uy * along, 0.08, 0.22 + 0.06 * fade, LOOK.lamp[0], LOOK.lamp[1], LOOK.lamp[2], 0.85 * fade, 1);
        }
      }
    }
  }

  function things(S, alpha, now, px, py, puppets) {
    // shots: a bright bolt with a short trail, and a little light
    const shots = S.shots;
    for (let i = 0; shots && i < shots.n; i++) {
      const o = shots.items[i];
      if (!o.alive) continue;
      const x = o.px + (o.x - o.px) * alpha, y = o.py + (o.y - o.py) * alpha;
      if (!inView(x, y, 1)) continue;
      let c = null;
      if (o.team === 1) c = fxColor(o.def);
      else if (o.skill >= 0 && S.skills[o.skill] && S.skills[o.skill].inst) {
        const id = S.skills[o.skill].inst.id;
        c = typeof id === 'string' && Defs.has('voice', id) ? fxColor(Defs.get('voice', id)) : null;
      }
      const enemy = o.team === 1, r = c ? c[0] : 1, g = c ? c[1] : enemy ? 0.35 : 0.84, b = c ? c[2] : enemy ? 0.3 : 0.5;
      const size = Math.max(0.22, (o.r > 0 ? o.r : 0.12) * 2.2), dx = o.x - o.px, dy = o.y - o.py;
      board(x, y, 1, size, r, g, b, 1, 1);
      board(x - dx * 0.5, y - dy * 0.5, 1, size * 0.75, r, g, b, 0.6, 1);
      board(x - dx, y - dy, 1, size * 0.5, r, g, b, 0.35, 1);
      lightCandidate(x, y, 1, 2.6, r, g, b, 0.7, px, py);
    }
    // pickups: an ember is a small warm glow, coin a small bright disc on the ground, a find a small box, and a
    // favour a solid shape that rises out of the ground and sinks again if it is not taken
    const pickups = S.pickups;
    let favours = 0;
    for (let i = 0; pickups && i < pickups.n; i++) {
      const o = pickups.items[i];
      if (!o.alive) continue;
      const x = o.px + (o.x - o.px) * alpha, y = o.py + (o.y - o.py) * alpha, kind = o.kind | 0;
      if (!inView(x, y, kind === 3 ? 1.4 : 0.6)) continue;
      const bob = sin(now * 3 + o.uid * 1.7);
      if (kind === 0) {
        board(x, y, 0.18 + 0.05 * bob, 0.2, LOOK.ember[0], LOOK.ember[1], LOOK.ember[2], 0.95, 1);
        mark(x, y, 0.2, LOOK.ember, 0.35, 1, DISC, 0, 0);
      } else if (kind === 1) {
        if (puppets) {
          solid(CYL, x, y, 0, 0.17, 0.035, 0.17, o.uid, 0, LOOK.coin, 0.25);
          solid(CYL, x + 0.05, y - 0.04, 0.035, 0.16, 0.03, 0.16, o.uid, 0, LOOK.coin, 0.25);
        } else mark(x, y, 0.12, LOOK.coin, 1, 1, DISC, 0, 0);
      } else if (kind === 2) {
        if (puppets) solid(BOX, x, y, 0, 0.3, 0.22, 0.24, o.uid * 0.7, 0, LOOK.posture, 0);
        else mark(x, y, 0.16, LOOK.posture, 1, 1, DISC, 0, 0);
      } else if (kind === 3) {
        // out of the ground over RISE seconds from when the scene first saw it, back into it over its last SINK_AT
        const s = slotOf(o);
        if (s >= 0 && sUid[s] !== o.uid) { sUid[s] = o.uid; sKind[s] = KIND_PICKUP; sFig[s] = null; sBorn[s] = now; }
        if (s >= 0) sSeen[s] = frame;
        const born = s >= 0 ? sBorn[s] : now - RISE, up = Math.min(1, (now - born) / RISE), down = o.ttl < SINK_AT ? Math.max(0, o.ttl / SINK_AT) : 1;
        const lift = up * up * (3 - 2 * up) * down, f = favourLook(o.item), spin = now * 0.9 + o.uid;
        mark(x, y, 0.55, LOOK.rim, 0.32 * lift, 1, DISC, 0, 0);
        if (puppets && f.fig) {
          const tall = f.fig.height, all = Math.max(0, Scene.limits.parts | 0);
          st.x = st.px = x; st.y = st.py = y; st.alpha = 1; st.face = spin; st.scale = 1; st.speed = 0; st.walk = 0; st.cycle = 0;
          st.act = Rigs.NONE; st.hurt = 99; st.dying = false; st.die = 0; st.flash = 0; st.opacity = 1; st.glow = 1; st.grey = 0;
          st.tintR = st.tintG = st.tintB = 1; st.seed = 0; st.detail = true; st.lod = 0; st.shell = 0; st.strike = 0;
          st.lift = -tall + (tall + 0.25 + 0.05 * bob) * lift;
          if (st.lift + tall > 0.02 && sink.total + f.fig.n <= all) markParts += Rigs.draw(f.fig, st, sink);
          st.lift = 0;
        } else if (puppets) {
          const tall = 0.62, h = -tall + (tall + 0.28 + 0.05 * bob) * lift;
          if (h + tall > 0.02) solid(f.shape, x, y, h, 0.46, tall, 0.46, -spin, 0, f.rgb, 0);
        } else mark(x, y, 0.32 * lift, f.rgb, 1, 1, DISC, 0, 0);
        favours++;
      }
    }
    stats.favours = favours;
    // the lychgate's ring and light
    gateMarks(S, now, px, py, puppets);
    // props that carry a light
    for (let i = 0; i < dN; i++) {
      if (dKind[i] !== KIND_PROP) continue;
      const q = dRef[i], info = propOf(q.id);
      if (info && info.light) {
        const flicker = 0.92 + 0.08 * sin(now * 13 + q.x) * sin(now * 7.3 + q.y);
        lightCandidate(q.x, q.y, info.height, info.radius, info.r, info.g, info.b, info.strength * flicker, px, py);
      }
    }
  }
  // The Change-ringer's bell, set mouth-up over it.
  function setBell(S, px, py, puppets) {
    const p = S.player;
    if (p.setBell !== true || p.alive === false) return;
    if (puppets) {
      solid(CONE, px, py, 3.0, 0.5, 0.42, 0.5, 0, PI, LOOK.bell, 0);
      solid(CYL, px, py, 3.0, 0.54, 0.05, 0.54, 0, 0, LOOK.bell, 0);
    } else board(px, py, 2.6, 0.4, LOOK.bell[0], LOOK.bell[1], LOOK.bell[2], 1, 0);
  }

  // The player's own small light, at the belt, put first so that it is always among the lights chosen.
  function playerLight(px, py) {
    cand[0] = px; cand[1] = py; cand[2] = 1.05; cand[3] = 6.5; cand[4] = 1; cand[5] = 0.82; cand[6] = 0.6; cand[7] = 0.55; cand[8] = -1;
    candN = 1;
  }

  // ---- the frame ----
  Scene.draw = function (S, alpha) {
    const view = Gfx.active;
    if (!view || typeof view.begin !== 'function' || typeof view.screenToWorld !== 'function' || !S || !S.player) return;
    ensure();
    if (fallbackEnemy === null) {
      fallbackEnemy = firstFigure(['debug.husk', 'test.biped']);
      fallbackMinion = firstFigure(['test.floater', 'debug.husk']);
      gateFig = firstFigure(['gate', 'test.gate']);
    }
    if (S !== run) startRun(S);
    frame++;
    if (!(alpha > 0)) alpha = 1;
    // time: the run's clock where this frame stands, and the wall clock for the camera
    const now = S.t + (alpha - 1) * DT;
    let dt = now - simLast;
    dt = dt > 0 ? (dt < 0.25 ? dt : 0.25) : 0;
    simLast = now;
    const wall = Plat.now(), wdt = wallLast > 0 ? Math.min(0.1, Math.max(0, (wall - wallLast) / 1000)) : 0;
    wallLast = wall;
    if (typeof Vfx.update === 'function') Vfx.update(dt, S);
    follow(S, alpha, wdt);
    const caps = view.caps || NO_CAPS, puppets = caps.puppets === true;
    envFor(S, puppets);
    view.begin(cam, env);

    const t0 = Plat.now();
    footprint(view);
    Rigs.clear(sink);
    decalN = boardN = lightN = discN = barN = candN = 0;
    markParts = 0;
    stats.postures = stats.threads = stats.walls = 0;
    const p = S.player, px = p.px + (p.x - p.px) * alpha, py = p.py + (p.y - p.py) * alpha;
    kSpeed = dt > 0 ? 1 - exp(-dt / 0.12) : 0;
    kTurn = Math.min(1, dt * 16);
    playerLight(px, py);
    collect(S, alpha, now, dt, px, py);
    // the ground first, in the order it is laid: the place, the marks the dead leave, the wake, Swells, wounds
    placeMarks(S);
    if (typeof Vfx.decals === 'function') decalN = Vfx.decals(decalBuf, decalN, DECALS);
    wakeLine(S, px, py);
    swells(S);
    const P = typeof Dmg.POSE === 'object' && Dmg.POSE ? Dmg.POSE : POSE;
    wounds(S, now, px, py, p.pose === P.braced);
    const detail = budget(), darkDiscs = puppets && (!caps.shadows || level === 'low');
    const flashK = typeof Vfx.flash === 'number' ? 0.35 + 0.65 * Vfx.flash : 1;
    emit(S, alpha, now, puppets, darkDiscs, detail, flashK);
    setBell(S, px, py, puppets);
    things(S, alpha, now, px, py, puppets);
    if (typeof Vfx.billboards === 'function') boardN = Vfx.billboards(boardBuf, boardN, BOARDS);
    chooseLights();
    // Tolled-for: the world loses its colour, all but what glows
    const tolled = rowTolled >= 0 && p.condT && p.condT[rowTolled] > 0;
    grey = Math.max(0, Math.min(1, grey + (tolled ? 1 : -1) * GREY_RATE * Math.max(dt, wdt)));
    if (tolled && dt === 0 && wdt === 0) grey = 1;
    const t1 = Plat.now();

    // the view paints the plain picture in the order of the calls: the ground's marks, then figures, then the air
    if (decalN > 0) view.decals(decalBuf, decalN);
    if (puppets) {
      for (let sh = 0; sh < sink.n.length; sh++) if (sink.n[sh] > 0) view.parts(sh, sink.buf[sh], sink.n[sh]);
    } else if (discN > 0) view.discs(discBuf, discN);
    if (boardN > 0) view.billboards(boardBuf, boardN);
    if (lightN > 0) view.lights(lightBuf, lightN);
    post.flash = 0;
    post.vignette = 0.22;
    post.dither = dither;
    post.grey = grey;
    if (typeof Vfx.post === 'function') Vfx.post(post);
    view.end(post);
    if (typeof Vfx.overlay === 'function') Vfx.overlay(barBuf, barN);

    stats.parts = sink.total;
    stats.dropped = sink.dropped;
    stats.decals = decalN;
    stats.billboards = boardN;
    stats.lights = lightN;
    stats.discs = discN;
    stats.bars = barN;
    stats.corpses = cN;
    stats.marks = markParts;
    stats.shadow = shadowOn ? 1 : 0;
    stats.grey = grey;
    stats.fillMs = t1 - t0;
  };

  Scene.buffers = function () {
    buffers.sink = sink;
    buffers.decals = decalBuf; buffers.decalN = decalN;
    buffers.billboards = boardBuf; buffers.billboardN = boardN;
    buffers.lights = lightBuf; buffers.lightN = lightN;
    buffers.discs = discBuf; buffers.discN = discN;
    buffers.bars = barBuf; buffers.barN = barN;
    return buffers;
  };

  // The player's casts, from the events of each step.
  function heard(S) {
    if (S !== run) return;
    const ring = S.events, p = S.player;
    for (let i = 0; i < S.eventCount; i++) {
      const e = ring[(S.eventStart + i) % ring.length];
      if (e.k === 'cast' && abs(e.x - p.x) < 1.5 && abs(e.y - p.y) < 1.5) castAt = S.t;
    }
  }
  Plat.on('step', function (S, live) { if (live) heard(S); });
  Plat.on('state', function (state) { if (state !== 'run' && state !== 'results') { run = null; castAt = -99; } });
})();
