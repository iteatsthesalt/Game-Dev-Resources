// 68-scene.js: the run as the view draws it. Each frame it follows the player with the camera, leaves out what is
// off screen, and turns the run into instance buffers for Gfx.active: figures through the rigs (or discs, in a
// view that has no figures), decals, billboards and lights; then it calls the view.
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
//                                dropped, decals, billboards, lights, discs, bars, fillMs}. detail is whether detail
//                                parts were drawn; cut how many enemies were drawn as a body and a head only;
//                                fillMs the time spent filling the buffers, after begin() and before the view's
//                                calls.
//   Scene.buffers()              the buffers of the last frame, for tests: {sink (see Rigs.sink), decals, decalN,
//                                billboards, billboardN, lights, lightN, discs, discN, bars, barN}
//   Scene.decal(buffer, n, x, y, radius, r, g, b, a, fill, shape, angle, arc) -> n + 1   writes one decal record at
//                                record n. shape (Scene.DISC, RING, SECTOR, BAR), angle (radians: which way a
//                                sector or bar points) and arc (a sector's opening in radians, a bar's width in
//                                metres, as 66-gfx-gl.js reads them) are kept for the wider record to come and
//                                written only once Gfx.DECAL_STRIDE has room.
//   Scene.DISC = 0, Scene.RING = 1, Scene.SECTOR = 2, Scene.BAR = 3
//   Scene.BAR_STRIDE = 6         a bar for Vfx.overlay: x, y, z (where above the ground it sits), life (0..1), rank,
//                                alpha
//   Scene.ATTACK                 {windup: 1, strike: 2, length: 0.35}: an enemy or minion whose state is windup is
//                                winding up an attack, stateT seconds into it, which lasts as long as its first
//                                attack's windup; one whose state is strike is striking, for length seconds.
//                                PROVISIONAL until the enemy AI exists: whoever writes it changes these numbers.
//
// What it draws, and from what:
//   figures    the player (the class's puppet, else 'test.biped'), enemies (their def's puppet; elites and bosses
//              larger by their radius), minions (their def's puppet, else 'test.floater'), the props of S.props
//              (their prop def's puppet, turned by where they stand), the gate (the puppet 'gate', else 'test.gate'),
//              and the dead: an enemy that leaves the pool where the camera can see it falls and sinks for 1.15 s.
//              The walk of each comes from the distance it covered; a hurt is seen when its life falls or its flash
//              rises; harm is handed to Vfx.harm, which shows it as a number.
//   decals     warnings of attacks and marks (from Vfx.decals), areas (red for the enemies'), pickups' glow, the
//              gate's ring (filling as the player holds it), and dark discs under figures where the view casts no
//              shadows (at 'low')
//   billboards shots (with a short trail), pickups' motes, and Vfx's particles
//   lights     the player's own small light, the gate, props that carry a light, shots: the nearest 32 to the player
//   discs      in a view without figures (b.caps.puppets false), one disc for each figure instead of its parts
// Budgets: at most Scene.limits.parts parts (detail parts go first, then the farthest common enemies are drawn
// as a body and a head) and Scene.limits.lights lights.
(function () {
  'use strict';

  const DT = Core.DT, HZ = Core.HZ, TAU = Core.TAU, PI = Math.PI;
  const sqrt = Math.sqrt, sin = Math.sin, cos = Math.cos, exp = Math.exp, abs = Math.abs, floor = Math.floor;
  const PARTS = 10000, LIGHTS = 32, CROWD = 170;
  const SLOTS = 2048, DRAW = 2048, CORPSES = 128, PROPS = 4096;
  const DECALS = 4096, BOARDS = 4096, CANDIDATES = 1024, DISCS = 2048, BARS = 512;
  const BAR_STRIDE = 6, DISC = 0, RING = 1, SECTOR = 2, BAR = 3;
  const DIE_TIME = 1.15, HURT_SHOW = 2;            // seconds: a death; how long a hurt common enemy shows its bar
  const CAM_TAU = 0.12, LEAD_TIME = 0.18, LEAD_MAX = 1.3, SNAP = 12;   // the camera: seconds, seconds, metres, metres
  const MARGIN = 1.6, HEIGHT_MARGIN = 0.9;         // culling: metres round a figure, and per metre of its height
  const KIND_PLAYER = 0, KIND_ENEMY = 1, KIND_MINION = 2, KIND_CORPSE = 3, KIND_PROP = 4, KIND_GATE = 5;
  const COMMON = 0, ELITE = 1, NO_CAPS = Object.freeze({ puppets: false, shadows: false });
  const PICKUP_COLORS = [[0.45, 0.95, 0.85], [1, 0.82, 0.35], [0.95, 0.95, 1], [1, 0.5, 0.6], [0.55, 0.7, 1], [0.8, 1, 0.5]];
  const MOON = {
    ground: [0.2, 0.21, 0.24], ambient: [0.3, 0.33, 0.42], sunDir: [0.35, -1, -0.45], sunColor: [0.62, 0.68, 0.85],
    fog: [0.06, 0.07, 0.1], near: 6, far: 32,
  };

  Scene.DISC = DISC; Scene.RING = RING; Scene.SECTOR = SECTOR; Scene.BAR = BAR;
  Scene.BAR_STRIDE = BAR_STRIDE;
  Scene.ATTACK = { windup: 1, strike: 2, length: 0.35 };
  Scene.limits = { parts: PARTS, lights: LIGHTS };
  const cam = { x: 0, y: 0, zoom: 1 };
  Scene.camera = cam;
  const stats = {
    figures: 0, enemies: 0, culled: 0, corpses: 0, detail: true, cut: 0, parts: 0, dropped: 0, decals: 0, billboards: 0,
    lights: 0, discs: 0, bars: 0, fillMs: 0,
  };
  Scene.stats = stats;

  // ---- buffers, made once ----
  let sink = null, decalBuf = null, boardBuf = null, lightBuf = null, discBuf = null, barBuf = null;
  let decalN = 0, boardN = 0, lightN = 0, discN = 0, barN = 0;
  let decalStride = 8, boardStride = 9, lightStride = 8, discStride = 7;
  const cand = new Float64Array(CANDIDATES * 9);   // light candidates: x, y, z, radius, r, g, b, strength, distance²
  let candN = 0;
  const st = Rigs.state(), shake = { x: 0, y: 0 }, corner = { x: 0, y: 0 };
  const post = { flash: 0, vignette: 0.22, bloom: 1, dither: 0, outline: 1 };
  const buffers = { sink: null, decals: null, decalN: 0, billboards: null, billboardN: 0, lights: null, lightN: 0, discs: null, discN: 0, bars: null, barN: 0 };

  function ensure() {
    if (sink !== null) return;
    sink = Rigs.sink(PARTS);
    decalStride = Gfx.DECAL_STRIDE || 8;
    boardStride = Gfx.BILLBOARD_STRIDE || 9;
    lightStride = Gfx.LIGHT_STRIDE || 8;
    discStride = Gfx.DISC_STRIDE || 7;
    decalBuf = new Float32Array(DECALS * decalStride);
    boardBuf = new Float32Array(BOARDS * boardStride);
    lightBuf = new Float32Array(LIGHTS * lightStride);
    discBuf = new Float32Array(DISCS * discStride);
    barBuf = new Float32Array(BARS * BAR_STRIDE);
  }

  Scene.decal = function (buf, n, x, y, radius, r, g, b, a, fill, shape, angle, arc) {
    const stride = Gfx.DECAL_STRIDE || 8, o = n * stride;
    if (o + stride > buf.length) return n;
    buf[o] = x; buf[o + 1] = y; buf[o + 2] = radius; buf[o + 3] = r; buf[o + 4] = g; buf[o + 5] = b; buf[o + 6] = a; buf[o + 7] = fill;
    if (stride >= 11) { buf[o + 8] = shape || 0; buf[o + 9] = angle || 0; buf[o + 10] = arc || 0; }
    return n + 1;
  };

  function board(x, y, z, size, r, g, b, a, glow) {
    if (boardN >= BOARDS) return;
    const o = boardN++ * boardStride;
    boardBuf[o] = x; boardBuf[o + 1] = y; boardBuf[o + 2] = z; boardBuf[o + 3] = size;
    boardBuf[o + 4] = r; boardBuf[o + 5] = g; boardBuf[o + 6] = b; boardBuf[o + 7] = a; boardBuf[o + 8] = glow;
  }

  // ---- the state of the run being drawn ----
  let run = null, frame = 0, simLast = 0, wallLast = 0, snap = true, camX = 0, camY = 0;
  let slotMap = new WeakMap(), slotN = 0;
  const sUid = new Int32Array(SLOTS), sSeen = new Int32Array(SLOTS), sKind = new Uint8Array(SLOTS);
  const sX = new Float64Array(SLOTS), sY = new Float64Array(SLOTS), sWalk = new Float64Array(SLOTS), sCycle = new Float64Array(SLOTS);
  const sSpeed = new Float32Array(SLOTS), sFace = new Float32Array(SLOTS), sScale = new Float32Array(SLOTS), sSeed = new Float32Array(SLOTS);
  const sHurt = new Float64Array(SLOTS), sFlash = new Float32Array(SLOTS), sLife = new Float32Array(SLOTS), sHush = new Float32Array(SLOTS);
  const sRank = new Uint8Array(SLOTS), sDead = new Float64Array(SLOTS);
  const sFig = new Array(SLOTS).fill(null);
  // the dying: figures whose things have left their pools
  const cFig = new Array(CORPSES).fill(null);
  const cX = new Float64Array(CORPSES), cY = new Float64Array(CORPSES), cFace = new Float32Array(CORPSES), cScale = new Float32Array(CORPSES);
  const cSeed = new Float32Array(CORPSES), cCycle = new Float64Array(CORPSES), cT0 = new Float64Array(CORPSES), cRank = new Uint8Array(CORPSES);
  let cN = 0;
  // this frame's figures
  const dKind = new Uint8Array(DRAW), dSlot = new Int32Array(DRAW), dD2 = new Float32Array(DRAW), dLod = new Uint8Array(DRAW);
  const dX = new Float64Array(DRAW), dY = new Float64Array(DRAW), dRef = new Array(DRAW).fill(null), dFig = new Array(DRAW).fill(null);
  let dN = 0, kSpeed = 0, kTurn = 0;              // this frame's smoothing of speed and facing
  const near = new Array(PROPS).fill(null);
  const histogram = new Int32Array(64);

  function startRun(S) {
    run = S;
    frame = 0;
    slotMap = new WeakMap();
    slotN = 0;
    cN = 0;
    snap = true;
    simLast = S.t;
    for (let i = 0; i < SLOTS; i++) sFig[i] = null;
    for (let i = 0; i < CORPSES; i++) cFig[i] = null;
    for (let i = 0; i < DRAW; i++) { dRef[i] = null; dFig[i] = null; }
    for (let i = 0; i < PROPS; i++) near[i] = null;
    envRun = null;
    if (typeof Vfx.clear === 'function') Vfx.clear();
  }

  // ---- figures for things ----
  const byDef = new Map();          // an enemy, boss or minion def -> its figure
  let fallbackEnemy = null, fallbackMinion = null, playerFig = null, playerFor = null, gateFig = null;

  // A def names its figure in puppet (an enemy, a boss) or in fx.puppet (a sigil that summons).
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

  function playerFigure(S) {
    if (playerFor === S) return playerFig;
    playerFor = S;
    const char = S.cfg ? S.cfg.char : null;
    let fig = null;
    if (char && typeof char.class === 'string' && Defs.has('class', char.class)) fig = Rigs.figure(Defs.get('class', char.class).puppet);
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
  function begin(s, e, kind, fig, scale, x, y) {
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
    sHush[s] = e.hush || 0;
    sRank[s] = kind === KIND_ENEMY ? e.rank : 0;
    sDead[s] = -1;
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
      begin(s, e, kind, fig, scale, x, y);
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
      Vfx.harm(e.uid, x, y, fig.height * scale, sLife[s] - life, kind === KIND_PLAYER ? 2 : 0);
    }
    if (kind === KIND_PLAYER) {
      const hush = e.hush || 0;
      if (hush < sHush[s] - 1e-6 && typeof Vfx.harm === 'function') Vfx.harm(0, x, y, fig.height * scale, sHush[s] - hush, 3);
      sHush[s] = hush;
    }
    sFlash[s] = flash;
    sLife[s] = life;
    return s;
  }

  function push(kind, slot, ref, fig, x, y, d2) {
    if (dN >= DRAW) return;
    const i = dN++;
    dKind[i] = kind; dSlot[i] = slot; dRef[i] = ref; dFig[i] = fig; dX[i] = x; dY[i] = y; dD2[i] = d2; dLod[i] = 0;
  }

  // ---- filling the buffers ----
  function collect(S, alpha, now, dt, px, py) {
    dN = 0;
    let culled = 0;
    // the player
    const p = S.player, pf = playerFigure(S);
    if (pf) {
      const s = track(p, KIND_PLAYER, pf, 1, alpha, now, dt);
      if (s >= 0) {
        if (p.alive === false && sDead[s] < 0) sDead[s] = now;
        push(KIND_PLAYER, s, p, pf, sX[s], sY[s], 0);
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
      push(KIND_ENEMY, s, e, fig, x, y, (x - px) * (x - px) + (y - py) * (y - py));
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
      push(KIND_MINION, s, m, fig, x, y, (x - px) * (x - px) + (y - py) * (y - py));
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
      push(KIND_CORPSE, c, null, cFig[c], cX[c], cY[c], (cX[c] - px) * (cX[c] - px) + (cY[c] - py) * (cY[c] - py));
    }
    // props near what the camera sees
    if (S.region && S.props && S.props.length > 0) {
      const n = World.propsNear(S, cam.x, cam.y, circleR + 8, near);
      for (let i = 0; i < n && i < PROPS; i++) {
        const q = near[i], info = propOf(q.id);
        if (info === null) continue;
        if (!inView(q.x, q.y, MARGIN + info.fig.radius + info.fig.height * HEIGHT_MARGIN)) continue;
        push(KIND_PROP, -1, q, info.fig, q.x, q.y, (q.x - px) * (q.x - px) + (q.y - py) * (q.y - py));
      }
    }
    // the gate
    if (S.gate && gateFig && inView(S.gate.x, S.gate.y, MARGIN + gateFig.radius + gateFig.height * HEIGHT_MARGIN)) {
      push(KIND_GATE, -1, S.gate, gateFig, S.gate.x, S.gate.y, (S.gate.x - px) * (S.gate.x - px) + (S.gate.y - py) * (S.gate.y - py));
    }
    stats.culled = culled;
  }

  // Detail parts first, then the farthest common enemies drawn as a body and a head, until the parts fit.
  function budget() {
    const limit = Math.max(0, Scene.limits.parts | 0);
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

  // An enemy's act, from its state (Scene.ATTACK).
  function actOf(e, st) {
    const A = Scene.ATTACK;
    st.act = Rigs.NONE;
    if (!e || typeof e.state !== 'number') return;
    if (e.state === A.windup) {
      st.act = Rigs.WINDUP;
      st.actT = e.stateT;
      const atk = e.def && e.def.attacks && e.def.attacks.length > 0 ? e.def.attacks[0] : null;
      const w = atk && typeof atk === 'object' ? atk.windup : atk && Defs.has('attack', atk) ? Defs.get('attack', atk).windup : 0.5;
      st.actLen = w > 0.05 ? w : 0.5;
    } else if (e.state === A.strike) {
      st.act = Rigs.STRIKE;
      st.actT = e.stateT;
      st.actLen = A.length;
    }
  }

  let castAt = -99;   // when the player last cast, by the run's clock

  function emit(S, alpha, now, puppets, darkDiscs, detail, flashK) {
    const limit = Math.max(0, Scene.limits.parts | 0), shadowR = 0.45;
    let figures = 0;
    for (let i = 0; i < dN; i++) {
      const kind = dKind[i], fig = dFig[i], s = dSlot[i], e = dRef[i];
      // the state of the figure
      st.alpha = alpha; st.act = Rigs.NONE; st.actT = 0; st.actLen = 0; st.hurt = 99; st.dying = false; st.die = 0;
      st.flash = 0; st.opacity = 1; st.glow = 1; st.tintR = st.tintG = st.tintB = 1; st.lod = dLod[i];
      st.detail = kind === KIND_PLAYER || detail;
      st.t = now;
      let scale = 1, x = dX[i], y = dY[i];
      if (kind === KIND_PLAYER || kind === KIND_ENEMY || kind === KIND_MINION) {
        st.x = e.x; st.y = e.y; st.px = e.px; st.py = e.py;
        st.face = sFace[s]; scale = sScale[s]; st.speed = sSpeed[s]; st.walk = sWalk[s]; st.cycle = sCycle[s]; st.seed = sSeed[s];
        st.hurt = now - sHurt[s];
        st.flash = (e.flash > 0 ? Math.min(1, e.flash) : 0) * flashK;
        if (kind === KIND_PLAYER) {
          if (now - castAt < 0.3) { st.act = Rigs.CAST; st.actT = now - castAt; st.actLen = 0.3; }
          if (sDead[s] >= 0) { st.dying = true; st.die = Math.min(0.62, (now - sDead[s]) / DIE_TIME); }
        } else {
          actOf(e, st);
          const shade = 0.9 + 0.2 * st.seed;
          st.tintR = shade * (1 + 0.05 * (st.seed - 0.5)); st.tintG = shade; st.tintB = shade * (1 - 0.05 * (st.seed - 0.5));
          if (kind === KIND_ENEMY && e.rank >= ELITE) { st.glow = 1.8; st.tintR *= 1.08; st.tintG *= 1.02; }
        }
      } else if (kind === KIND_CORPSE) {
        st.x = st.px = x; st.y = st.py = y; st.face = cFace[s]; scale = cScale[s]; st.speed = 0; st.walk = 0; st.cycle = cCycle[s];
        st.seed = cSeed[s]; st.dying = true; st.die = (now - cT0[s]) / DIE_TIME;
        const shade = 0.9 + 0.2 * st.seed;
        st.tintR = st.tintG = st.tintB = shade;
      } else {
        st.x = st.px = x; st.y = st.py = y; st.speed = 0; st.walk = 0; st.cycle = 0; st.seed = 0;
        if (kind === KIND_PROP) {
          const h = sin(x * 12.9898 + y * 78.233) * 43758.5453;
          st.face = (h - floor(h)) * TAU;
        } else {
          st.face = PI / 2;
          const hold = S.rules && S.rules.gateHoldSeconds > 0 ? Math.min(1, (e.hold || 0) / S.rules.gateHoldSeconds) : 0;
          st.glow = 0.8 + 0.25 * sin(now * 3) + 0.6 * hold;
        }
      }
      st.scale = scale;
      // a soft ring under the player, so that it can be found in a crowd
      if (kind === KIND_PLAYER) decalN = Scene.decal(decalBuf, decalN, x, y, 0.62, 1, 0.86, 0.55, 0.6, 0.18, RING, 0, 0);
      if (puppets) {
        const want = st.lod > 0 ? fig.counts.core : st.detail ? fig.n : fig.counts.plain;
        if (sink.total + want > limit) continue;
        if (Rigs.draw(fig, st, sink) > 0) figures++;
        if (darkDiscs && kind !== KIND_PROP && kind !== KIND_GATE) {
          const k = st.dying ? 1 - Math.min(1, st.die * 1.5) : 1;
          if (k > 0) decalN = Scene.decal(decalBuf, decalN, x, y, fig.radius * scale * shadowR + 0.08, 0, 0, 0, 0.3 * k, 1, DISC, 0, 0);
        }
      } else if (discN < DISCS) {
        const o = discN++ * discStride, c = fig.color3, w = st.flash, fade = st.dying ? 1 - Math.min(1, st.die) : 1;
        discBuf[o] = x; discBuf[o + 1] = y;
        discBuf[o + 2] = kind === KIND_PROP || kind === KIND_GATE ? fig.radius * 0.8 : e && e.r > 0 ? e.r : fig.radius * scale * 0.6;
        discBuf[o + 3] = c[0] * st.tintR + (1 - c[0] * st.tintR) * w;
        discBuf[o + 4] = c[1] * st.tintG + (1 - c[1] * st.tintG) * w;
        discBuf[o + 5] = c[2] * st.tintB + (1 - c[2] * st.tintB) * w;
        discBuf[o + 6] = fade;
        figures++;
      }
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

  function things(S, alpha, now, px, py) {
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
        c = typeof id === 'string' && Defs.has('sigil', id) ? fxColor(Defs.get('sigil', id)) : null;
      }
      const enemy = o.team === 1, r = c ? c[0] : 1, g = c ? c[1] : enemy ? 0.35 : 0.84, b = c ? c[2] : enemy ? 0.3 : 0.5;
      const size = Math.max(0.22, (o.r > 0 ? o.r : 0.12) * 2.2), dx = o.x - o.px, dy = o.y - o.py;
      board(x, y, 1, size, r, g, b, 1, 1);
      board(x - dx * 0.5, y - dy * 0.5, 1, size * 0.75, r, g, b, 0.6, 1);
      board(x - dx, y - dy, 1, size * 0.5, r, g, b, 0.35, 1);
      lightCandidate(x, y, 1, 2.6, r, g, b, 0.7, px, py);
    }
    // pickups: a glow on the ground and a mote that bobs above it
    const pickups = S.pickups;
    for (let i = 0; pickups && i < pickups.n; i++) {
      const o = pickups.items[i];
      if (!o.alive) continue;
      const x = o.px + (o.x - o.px) * alpha, y = o.py + (o.y - o.py) * alpha;
      if (!inView(x, y, 0.6)) continue;
      const c = PICKUP_COLORS[(o.kind | 0) % PICKUP_COLORS.length], pulse = 0.75 + 0.25 * sin(now * 5 + o.uid);
      decalN = Scene.decal(decalBuf, decalN, x, y, 0.32, c[0], c[1], c[2], 0.55 * pulse, 0.8, DISC, 0, 0);
      board(x, y, 0.3 + 0.08 * sin(now * 3 + o.uid * 1.7), 0.2, c[0], c[1], c[2], 0.9, 1);
    }
    // areas: the enemies' red, the player's in its skill's colour
    const areas = S.areas;
    for (let i = 0; areas && i < areas.n; i++) {
      const a = areas.items[i];
      if (!a.alive || !(a.r > 0) || !inView(a.x, a.y, a.r)) continue;
      const enemy = a.team === 1, fill = 0.35 + 0.15 * sin(now * 6 + a.uid);
      decalN = Scene.decal(decalBuf, decalN, a.x, a.y, a.r, enemy ? 1 : 0.6, enemy ? 0.25 : 0.85, enemy ? 0.18 : 1, enemy ? 0.75 : 0.5, fill,
        a.len > 0 ? BAR : DISC, a.angle || 0, 0);
    }
    // the gate: its ring fills as the player holds it, and it shines
    const gate = S.gate;
    if (gate) {
      const hold = S.rules && S.rules.gateHoldSeconds > 0 ? Math.min(1, (gate.hold || 0) / S.rules.gateHoldSeconds) : 0;
      if (inView(gate.x, gate.y, 2)) decalN = Scene.decal(decalBuf, decalN, gate.x, gate.y, 1.7, 0.6, 0.9, 1, 0.8, hold, RING, 0, 0);
      lightCandidate(gate.x, gate.y, 1.6, 8, 0.55, 0.8, 1, 1.1 + 0.3 * sin(now * 3) + hold, px, py);
    }
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

  // The player's own small light, put first so that it is always among the lights chosen.
  function playerLight(px, py) {
    cand[0] = px; cand[1] = py; cand[2] = 1.8; cand[3] = 6.5; cand[4] = 1; cand[5] = 0.86; cand[6] = 0.66; cand[7] = 0.55; cand[8] = -1;
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
    const p = S.player, px = p.px + (p.x - p.px) * alpha, py = p.py + (p.y - p.py) * alpha;
    if (typeof Vfx.decals === 'function') decalN = Vfx.decals(decalBuf, decalN, DECALS);
    kSpeed = dt > 0 ? 1 - exp(-dt / 0.12) : 0;
    kTurn = Math.min(1, dt * 16);
    playerLight(px, py);
    collect(S, alpha, now, dt, px, py);
    const detail = budget(), darkDiscs = puppets && (!caps.shadows || level === 'low');
    const flashK = typeof Vfx.flash === 'number' ? 0.35 + 0.65 * Vfx.flash : 1;
    emit(S, alpha, now, puppets, darkDiscs, detail, flashK);
    things(S, alpha, now, px, py);
    if (typeof Vfx.billboards === 'function') boardN = Vfx.billboards(boardBuf, boardN, BOARDS);
    chooseLights();
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
