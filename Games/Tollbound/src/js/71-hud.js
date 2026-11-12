// 71-hud.js: the HUD of a vigil: what the player reads at a glance in a fight, drawn as shapes on one canvas in
// #hud once a frame, with no text but a key's name (docs/design/02-combat.md, section 13).
// Owns: Hud
// Public:
//   Hud.stats     what the last frame showed, for tests and other screens. A value whose parts are renewed in place:
//     shown            the HUD is up: there is a run and the game is in it
//     frames, drawn    frames seen during runs, and those that changed the picture (a frame that would draw the same
//                      picture again draws nothing); ms, the mean time of a frame that drew, over the last 30 of them
//     life, wounds, woundN, scars, max, colour   the life bar: life, the life lying in open wounds (woundN segments),
//                      the greatest life lost to scars, life-max, as drawn; colour, the class colour used
//     heed, heedFree   the Heed bar: heed-max and its free part
//     row, raised, standing, pips   the favour ids of the row in their places (a list renewed in place), how many
//                      are raised, whether an offer stands in the world now, and the times-taken dots drawn under them
//     ring, quarters, tollMark   the toll ring: the share of it closed (0 when none shows; 1 while the closed ring
//                      fades after a toll); the quarter ticks shown, 0 to 3; whether the toll's own mark shows
//     count            {on, tellers, elites, gate, marks}: the setting, the last count heard, the marks drawn now
//     haul             boxes drawn, one a find
//     trade            {id, icon, cooldown, ready, disc}: the class's trade (its def's name), the glyph of button A,
//                      the share of its recharge still to run, whether it is ready, whether the HUD draws its disc
//     heave            {hidden}: button B is hidden, there being nothing to heave
//     tolledFor, timeLeft, greyBy   the player is Tolled-for; the share of the time to the toll still left; who greys
//                      the screen: 'view' (the scene, through post.grey), 'hud' (this file's own grey), '' (nobody)
//     gate             {shown, far, onScreen, x, y}: the marker of the open lychgate, (x, y) in CSS px
//     block, disc      {x, y, w, h, bar, barX, lifeH} and {x, y, r, shown}: where the corner block is (bar and
//                      barX: the width of its bars and their left edge; lifeH: the life bar's height) and the
//                      trade's disc, CSS px
// Settings it defines: hud.count, a switch, off: the count after each toll drawn as marks, for play without sound.
// What it draws, from the run:
//   the corner block, in the top corner on the stick's side (the touch pause button has the other). The bars are
//   15 rem wide at most; the row and the count stand under them, or beside them on a screen wider than tall that
//   has the room, so that on a phone on its side the block stays a strip along the top:
//     the life bar      S.player.life in the class colour (the first colour of its palette, lifted towards bone if it
//                       is too dark to read); after it the life lying in open wounds (S.wounds.life), a pale segment
//                       for each, the newest first, greying as it nears its scar and lit along its top while it is
//                       being mended (its back[] rising); scars (S.wounds.scarred) as a dark end;
//                       against S.sheet.stats['life-max'] and the scars together. It beats while life is under 35% of
//                       the greatest. While Tolled-for it shows the time left before the toll instead, bone on grey.
//     the Heed bar      under it: heed-max, the free part bright (all of it while no observance holds any)
//     the haul          a small box for each find of S.haul, striped with its notches (none in Stage 1)
//     the row           S.row.ids as six small icons (Glyphs, by the favour's icon, else its name; a place with no
//                       favour as an empty socket), the first S.row.raised lifted; while an offer stands they beat and
//                       a line under them runs down to their sinking; a dot under an icon for each time its favour was
//                       taken; a nail over the first two while Nail in the Candle waits (S.row.nails). It slides as
//                       it closes up and swaps.
//     the count         when hud.count is on, the last 'count' event as marks, shown in the hand-bell's own rhythm
//                       (55-sound-core.js): a stroke for each teller, a lozenge for each elite, a lychgate if one will
//                       open; bright for 10 s once all are out, faint until the next toll
//   the toll ring     round the screen's edge, inside the safe area: in the last 3 s before S.tollAt it closes clockwise
//                     from the top, and at the toll it stands closed and fades. At each quarter of the interval a tick
//                     at the edge (the right for the first, then the bottom, then the left) and after a toll a mark at
//                     the top: bright for the 8 s of 'after-quarter', faint until the next toll clears them
//   the lychgate      the open S.gate: off screen, a marker at the edge towards it, its time left running down round
//                     it; the far lychgate of Tolled-for lit (and, in a build whose scene does not light it, marked
//                     over the gate itself while it is on screen)
//   Tolled-for        while the player carries the row tolled-for, the screen grey: the scene greys the world itself
//                     (68-scene.js, the view's post.grey, keeping what glows in colour, the far lychgate among it),
//                     and only a build without that has this file lay a grey of its own under the HUD (a backdrop
//                     filter)
//   the buttons       Input.button('A', {icon, cooldown, label}): the trade's glyph and the share of its recharge
//                     (S.player.tradeCd against class.trade.recharge x trade-recharge / 100), hidden in a run with no
//                     class; 'B' hidden while S.haul is empty, else the heave's glyph and recharge. Where the touch
//                     buttons are not shown (keys, a pad, a phone not yet touched) a disc in the lower corner stands in
//                     for A, with its key's name. A debug scene (S.debug) has no class: its first frame puts both
//                     buttons back to their plain look, and then they are left to whoever drives the scene.
// Every slot of the run it reads may be missing (a build without the combat or vigil package): what is missing is
// not drawn. Notices it reads: 'boot', 'frame', 'step' (the 'count' events, live or not), 'state' and 'resize'.
// css/30-hud.css styles the canvas and the grey, and its tokens (and those of 00-base.css) colour the canvas.
(function () {
  'use strict';

  const TAU = Math.PI * 2, HZ = Core.HZ, clamp = Core.clamp, mix = Core.hashMix;
  const floor = Math.floor, round = Math.round, min = Math.min, max = Math.max, abs = Math.abs;
  const RING_SECONDS = 3, RING_FADE = 0.9, AFTER_QUARTER = 8;          // seconds
  const COUNT_STROKE = 0.26, COUNT_QUICK = 0.14, COUNT_PAUSE = 0.55;    // seconds: the hand-bell's rhythm
  const COUNT_BRIGHT = 10, TAKEN_FLASH = 0.6, OFFER_SECONDS = 8;        // seconds
  const FAINT = 0.35;              // a share of greatest life: under it the life bar beats
  const PAUSE_ROOM = 44;           // CSS px: the touch pause button in the far top corner
  const MIN_LUMA = 0.2;            // a class colour darker than this (soot, tar) is lifted towards bone for the bar
  const GREYS = 8;                 // steps of a wound's greying, each with its colour made once a run
  const ROW = 6, PIPS = 5, COUNT_KEY = 'hud.count';
  const KEYS = { keys: 'Space' };  // the key of button A by device (52-input.js): a pad's button has no one name
  const NO_DASH = [];

  // The canvas's colours: the tokens of 00-base.css and 30-hud.css, read at layout; these hold until then.
  const col = {
    ink: '#ece7da', inkDim: '#b1ac9d', grey: '#8a867a', accent: '#c79a45', accentLit: '#efc977', second: '#6fb3a6',
    secondLit: '#a9ddd1', bad: '#e8776b', trough: 'rgba(10, 12, 17, 0.62)', edge: 'rgba(10, 12, 17, 0.88)',
    scar: '#3b1d20', lamp: '#e6c25a', heed: '#a9ddd1', fill: 'rgba(10, 12, 17, 0.5)', font: 'system-ui, sans-serif',
  };
  const TOKENS = {
    ink: '--ink', inkDim: '--ink-dim', grey: '--ink-faint', accent: '--accent', accentLit: '--accent-bright', second: '--second',
    secondLit: '--second-bright', bad: '--bad', trough: '--hud-trough', edge: '--hud-edge', scar: '--hud-scar', lamp: '--hud-lamp',
    heed: '--hud-heed', fill: '--hud-fill', font: '--font-ui',
  };

  const stats = {
    shown: false, frames: 0, drawn: 0, ms: 0,
    life: 0, wounds: 0, woundN: 0, scars: 0, max: 0, colour: '',
    heed: 0, heedFree: 0,
    row: [], raised: 0, standing: false, pips: 0,
    ring: 0, quarters: 0, tollMark: false,
    count: { on: false, tellers: 0, elites: 0, gate: false, marks: 0 },
    haul: 0,
    trade: { id: '', icon: '', cooldown: 0, ready: false, disc: false },
    heave: { hidden: true },
    tolledFor: false, timeLeft: 0, greyBy: '',
    gate: { shown: false, far: false, onScreen: false, x: 0, y: 0 },
    block: { x: 0, y: 0, w: 0, h: 0, bar: 0, barX: 0, lifeH: 0 }, disc: { x: 0, y: 0, r: 0, shown: false },
  };
  Hud.stats = stats;

  // ---- the page ----

  let layer = null, canvas = null, ctx = null, grey = null, probe = null, touchRoot = null, viewGreys = false;
  let W = 0, H = 0, dpr = 1, rem = 16, mirror = false, still = false, wantLayout = true, fpsRoom = 0;
  const edge = { t: 12, r: 16, b: 12, l: 16 }, safe = { t: 0, r: 0, b: 0, l: 0 };
  const L = {                                 // the layout, CSS px
    bx: 0, by: 0, bw: 0, lifeH: 0, heedY: 0, heedH: 0, haulY: 0, box: 0, rowY: 0, icon: 0, gap: 0, raise: 0, countY: 0, bh: 0,
    beside: false, barX: 0, rowX: 0, blockW: 0,
    dx: 0, dy: 0, dr: 0, x0: 0, y0: 0, x1: 0, y1: 0, corner: 0, ringLen: 0, tick: 0, pointer: 0, keyFont: '',
  };
  let ringPath = null;
  const dash = [0, 0], spot = { x: 0, y: 0 };

  // ---- the run, as last read ----

  let run = null, classColour = '', classLit = '', tradeDef = null, tradeGlyph = '';
  let heaveIcon = null, buttonsFor = null, tolledStart = 0, gateSpan = 0, gateLeft = 0, greyOn = false;
  const woundColours = [];
  const count = { t: -1, toll: -1, tellers: 0, elites: 0, gate: false };
  const taken = { t: -1, place: 0 };
  const slots = [];                           // the row as drawn: {id, x, alpha, img}, in place order
  for (let i = 0; i < ROW; i++) slots.push({ id: '', x: 0, alpha: 0, img: null });
  const spare = [];                           // the slots of the last row, while a new one is matched against them
  for (let i = 0; i < ROW; i++) spare.push({ id: '', x: 0, alpha: 0, img: null });
  let rowKey = 0, rowN = 0, sliding = false, lastSig = -1, clock = 0, msSum = 0, msN = 0;

  // ---- settings ----

  function setting(key, fallback) {
    if (typeof Settings.get !== 'function') return fallback;
    const v = Settings.get(key);
    return v === undefined ? fallback : v;
  }

  if (typeof Settings.define === 'function') {
    Settings.define(COUNT_KEY, { value: false, label: 'Draw the count', group: 'Display', order: 25 });
  }

  // ---- colours ----

  function rgbOf(hex) {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex || '').trim());
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
  }
  function luma(c) { return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255; }
  function mixRgb(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function css(c, alpha) {
    return 'rgba(' + round(c[0]) + ', ' + round(c[1]) + ', ' + round(c[2]) + ', ' + (alpha === undefined ? 1 : alpha) + ')';
  }

  // The class colour and what the bar makes of it, once a run: its own, a lit edge, the pale of a wound greying.
  function colours(classId) {
    const bone = rgbOf(col.ink) || [236, 231, 218], ash = [125, 122, 114];
    let c = null;
    if (classId && Defs.has('class', classId)) {
      const p = Defs.get('class', classId).palette;
      for (let i = 0; p && i < p.length && !c; i++) c = rgbOf(p[i]);
    }
    if (!c) c = rgbOf(col.accent) || [199, 154, 69];
    for (let i = 0; i < 10 && luma(c) < MIN_LUMA; i++) c = mixRgb(c, bone, 0.18);
    classColour = css(c);
    classLit = css(mixRgb(c, bone, 0.45));
    const pale = mixRgb(c, bone, 0.6);
    woundColours.length = 0;
    for (let i = 0; i <= GREYS; i++) woundColours.push(css(mixRgb(pale, ash, i / GREYS), 0.9));
  }

  // ---- layout ----

  function layout() {
    wantLayout = false;
    W = layer.clientWidth;
    H = layer.clientHeight;
    const cs = getComputedStyle(layer), root = getComputedStyle(document.documentElement);
    edge.t = parseFloat(cs.paddingTop) || 12;
    edge.r = parseFloat(cs.paddingRight) || 16;
    edge.b = parseFloat(cs.paddingBottom) || 12;
    edge.l = parseFloat(cs.paddingLeft) || 16;
    rem = parseFloat(root.fontSize) || 16;
    for (const k in TOKENS) {
      const v = root.getPropertyValue(TOKENS[k]).trim();
      if (v) col[k] = v;
    }
    const pb = probe.getBoundingClientRect(), lb = layer.getBoundingClientRect();
    safe.t = max(0, pb.top - lb.top);
    safe.r = max(0, lb.right - pb.right);
    safe.b = max(0, lb.bottom - pb.bottom);
    safe.l = max(0, pb.left - lb.left);
    mirror = setting('input.hand', 'right') === 'left';
    still = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    fpsRoom = Plat.query('fps') === '1' ? round(1.7 * rem) : 0;
    dpr = min(2, Plat.dpr());
    const pw = max(1, round(W * dpr)), ph = max(1, round(H * dpr));
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }

    // the corner block: the bars, and under them (or beside them, where the screen is wide) the row and the count
    const room = W - edge.l - edge.r - PAUSE_ROOM - 0.75 * rem;
    L.icon = max(18, round(1.5 * rem));
    L.gap = max(4, round(0.32 * rem));
    L.raise = max(4, round(0.34 * rem));
    L.bw = round(max(6 * rem, min(15 * rem, room)));
    const rowW = ROW * (L.icon + L.gap) - L.gap, apart = round(1.1 * rem);
    L.beside = W > H && L.bw + apart + rowW <= room;
    L.blockW = L.beside ? L.bw + apart + rowW : max(L.bw, rowW);
    L.bx = mirror ? W - edge.r - L.blockW : edge.l;
    // from the block's left edge: the bars keep the corner, so for the left hand they stand at its right end
    L.barX = mirror ? L.blockW - L.bw : 0;
    L.rowX = L.beside ? (mirror ? 0 : L.bw + apart) : (mirror ? L.blockW - rowW : 0);
    L.by = edge.t + fpsRoom;
    L.lifeH = max(7, round(0.62 * rem));
    L.heedH = max(3, round(0.24 * rem));
    L.heedY = L.by + L.lifeH + max(3, round(0.24 * rem));
    L.box = max(7, round(0.62 * rem));
    L.haulY = L.heedY + L.heedH + round(0.4 * rem);
    L.tick = max(8, round(0.75 * rem));
    L.pointer = max(16, round(1.15 * rem));
    L.keyFont = '600 ' + max(10, round(0.72 * rem)) + 'px ' + col.font;
    for (let i = 0; i < ROW; i++) slots[i].img = null;   // the icons are made again at the new size
    rowKey = 0;

    // the trade's disc, in the lower corner on the buttons' side
    L.dr = round(1.45 * rem);
    L.dx = mirror ? edge.l + L.dr + round(0.4 * rem) : W - edge.r - L.dr - round(0.4 * rem);
    L.dy = H - edge.b - L.dr - round(0.4 * rem);

    // the toll ring: a rounded frame inside the safe area, its path starting at the top middle, going clockwise
    L.x0 = max(4, safe.l + 3);
    L.y0 = max(4, safe.t + 3);
    L.x1 = W - max(4, safe.r + 3);
    L.y1 = H - max(4, safe.b + 3);
    const r = L.corner = min(round(0.9 * rem), (L.x1 - L.x0) / 2, (L.y1 - L.y0) / 2), cx = (L.x0 + L.x1) / 2;
    ringPath = new Path2D();
    ringPath.moveTo(cx, L.y0);
    ringPath.lineTo(L.x1 - r, L.y0);
    ringPath.arc(L.x1 - r, L.y0 + r, r, -Math.PI / 2, 0);
    ringPath.lineTo(L.x1, L.y1 - r);
    ringPath.arc(L.x1 - r, L.y1 - r, r, 0, Math.PI / 2);
    ringPath.lineTo(L.x0 + r, L.y1);
    ringPath.arc(L.x0 + r, L.y1 - r, r, Math.PI / 2, Math.PI);
    ringPath.lineTo(L.x0, L.y0 + r);
    ringPath.arc(L.x0 + r, L.y0 + r, r, Math.PI, Math.PI * 1.5);
    ringPath.lineTo(cx, L.y0);
    L.ringLen = 2 * (L.x1 - L.x0 + L.y1 - L.y0) - 8 * r + TAU * r;
    lastSig = -1;
  }

  // ---- reading the run ----
  // now: everything the frame will draw, read once. sig: a checksum of it, rounded to what the eye can tell apart.

  const now = {
    life: 0, max: 0, scars: 0, wounds: 0, woundN: 0, heed: 0, heedFree: 0, tolled: false, timeLeft: 0, faint: false,
    ring: 0, ringFade: 0, quarters: 0, bright: 0, tollMark: false, tollBright: false, keeperNext: false,
    raised: 0, standing: false, sinkShare: 0, nails: 0, haul: 0, gate: false, far: false, gateLeft: 0,
    cooldown: 0, trade: false, disc: false, countOn: false, marks: 0, countDim: false,
  };
  const held = new Float64Array(64), age = new Float64Array(64);   // the open wounds, newest first

  function tolledRow() { return Stats.AILMENT && typeof Stats.AILMENT['tolled-for'] === 'number' ? Stats.AILMENT['tolled-for'] : -1; }

  function stat(S, id, fallback) {
    const v = S.sheet && S.sheet.stats ? S.sheet.stats[id] : undefined;
    return typeof v === 'number' && v === v ? v : fallback;
  }

  // Wounds being mended: what wound i had given back (back[i]) at the last look, which wound that was (when it
  // opened: the wounds close up when one goes), and the clock when it last gave life back. It shows as mending for
  // a quarter of a second after, so that a frame with no step in it (a fast screen) does not make it flicker.
  const lastBack = new Float64Array(64), lastOpened = new Float64Array(64), mendAt = new Float64Array(64).fill(-1);
  const mending = new Uint8Array(64);

  function read(S, alpha) {
    const p = S.player;
    let sig = mix(0x48ad, W * 7 + H);
    sig = mix(sig, mirror ? 1 : 0);

    // life, wounds and scars
    now.life = p.life > 0 ? p.life : 0;
    now.max = max(0, stat(S, 'life-max', now.life));
    const w = S.wounds, term = max(1, stat(S, 'wound-term', 60));
    now.scars = w && w.scarred > 0 ? w.scarred : 0;
    now.wounds = 0;
    now.woundN = 0;
    if (w && w.n > 0 && w.life) {
      const n = min(w.n, w.life.length, held.length);
      for (let i = n - 1; i >= 0; i--) {
        const h = w.life[i];                       // the life still lying in it: mending moves it into back[i]
        if (!(h > 0)) continue;
        const k = now.woundN, opened = w.opened ? w.opened[i] : 0, back = w.back ? w.back[i] : 0;
        held[k] = h;
        age[k] = clamp((S.t - opened) / term, 0, 1);
        if (lastOpened[i] !== opened) mendAt[i] = -1;
        else if (back > lastBack[i]) mendAt[i] = clock;
        mending[k] = mendAt[i] >= 0 && clock - mendAt[i] < 0.25 ? 1 : 0;
        lastOpened[i] = opened;
        lastBack[i] = back;
        now.wounds += h;
        sig = mix(mix(mix(sig, round(h * 10)), round(age[k] * GREYS)), mending[k]);
        now.woundN++;
      }
    }
    const row = tolledRow();
    const tolledT = row >= 0 && p.condT ? p.condT[row] : 0;
    now.tolled = tolledT > 0;
    if (now.tolled) {
      if (tolledT > tolledStart) tolledStart = tolledT;
      now.timeLeft = tolledStart > 0 ? clamp(tolledT / tolledStart, 0, 1) : 0;
    } else {
      tolledStart = 0;
      now.timeLeft = 0;
    }
    now.faint = !now.tolled && now.max > 0 && now.life < now.max * FAINT && now.life > 0;
    sig = mix(mix(mix(sig, round(now.life * 10)), round(now.max * 10)), round(now.scars * 10));
    sig = mix(mix(sig, now.tolled ? 1 + round(now.timeLeft * 400) : 0), now.faint && !still ? round(clock * 30) : 0);

    // Heed: all of it free until observances hold some (Stage 2)
    now.heed = max(0, stat(S, 'heed-max', 0));
    now.heedFree = now.heed - heldHeed(S);
    sig = mix(mix(sig, round(now.heed)), round(now.heedFree));

    // the toll: the ring in the last seconds, the flash after, the quarters and their ticks
    const at = S.step - 1 + alpha;                 // where the frame stands, in steps
    const left = (S.tollAt - at) / HZ, steps = S.tollSteps > 0 ? S.tollSteps : 75 * HZ;
    const into = (at - (S.tollAt - steps)) / HZ, quarter = steps / 4 / HZ;
    now.ring = left <= RING_SECONDS ? clamp(1 - left / RING_SECONDS, 0, 1) : 0;
    now.ringFade = S.toll > 0 && into < RING_FADE ? 1 - into / RING_FADE : 0;
    now.quarters = clamp(floor(into / quarter), 0, 3);
    now.bright = 0;
    for (let k = 1; k <= now.quarters; k++) if (into - k * quarter < AFTER_QUARTER) now.bright |= 1 << k;
    now.tollMark = S.toll > 0;
    now.tollBright = now.tollMark && into < AFTER_QUARTER;
    now.keeperNext = S.rules && S.toll + 1 === S.rules.keeperToll;
    sig = mix(mix(mix(sig, round(now.ring * 240)), round(now.ringFade * 60)), now.quarters * 16 + now.bright + (now.tollBright ? 64 : 0));
    sig = mix(sig, (now.tollMark ? 1 : 0) + (now.keeperNext ? 2 : 0));

    // the row
    readRow(S);
    sig = mix(mix(mix(sig, rowKey), now.raised * 4 + (now.standing ? 1 : 0) + (now.nails > 0 ? 2 : 0)), round(now.sinkShare * 64));
    if (now.standing && !still) sig = mix(sig, round(clock * 20));
    if (sliding) sig = mix(sig, round(clock * 1000));
    const flashing = taken.t >= 0 && S.t - taken.t < TAKEN_FLASH;
    if (flashing) sig = mix(sig, round((S.t - taken.t) * 60));
    stats.pips = 0;
    for (let i = 0; i < rowN; i++) sig = mix(sig, pipsOf(S, slots[i].id));

    // the haul
    now.haul = Array.isArray(S.haul) ? S.haul.length : 0;
    sig = mix(sig, now.haul);

    // the count
    now.countOn = setting(COUNT_KEY, false) === true;
    now.marks = 0;
    now.countDim = false;
    if (count.t >= 0 && count.toll === S.toll) {
      const since = S.t - count.t, all = countMarks();
      for (let i = 0; i < all; i++) if (since >= markTime(i)) now.marks = i + 1;
      now.countDim = now.marks === all && since > markTime(all - 1) + COUNT_BRIGHT;
    }
    sig = mix(mix(sig, now.countOn ? 1 + now.marks : 0), now.countDim ? 1 : 0);

    // the lychgate
    const g = S.gate;
    now.gate = !!g && typeof g.x === 'number';
    now.far = now.gate && !!g.far;
    if (now.gate) {
      const leftNow = max(0, (g.until || 0) - S.t);
      if (leftNow > gateLeft + 0.5 || gateSpan <= 0) gateSpan = max(leftNow, 1);   // opened, or opened again
      gateLeft = leftNow;
      now.gateLeft = clamp(leftNow / gateSpan, 0, 1);
      const sp = typeof Gfx.worldToScreen === 'function' ? Gfx.worldToScreen(g.x, g.y, 0, spot) : null;
      if (!sp) now.gate = false;
      else sig = mix(mix(mix(sig, round(sp.x)), round(sp.y)), round(now.gateLeft * 120) + (now.far ? 7 : 0));
      if (now.far && !still) sig = mix(sig, round(clock * 12));
    } else {
      gateSpan = 0;
      gateLeft = 0;
    }

    // the trade, and whether its disc stands in for the touch button
    now.trade = tradeDef !== null;
    now.cooldown = 0;
    if (now.trade) {
      const full = (tradeDef.recharge > 0 ? tradeDef.recharge : 0) * stat(S, 'trade-recharge', 100) / 100;
      const cd = typeof p.tradeCd === 'number' && p.tradeCd > 0 ? p.tradeCd : 0;
      now.cooldown = full > 0 ? clamp(cd / full, 0, 1) : 0;
    }
    now.disc = now.trade && !(touchRoot && !touchRoot.hidden);
    sig = mix(mix(sig, round(now.cooldown * 48)), (now.disc ? 1 : 0) + (KEYS[Input.device] ? 2 : 0));
    return sig;
  }

  function heldHeed(S) {
    const char = S.cfg ? S.cfg.char : null, kept = char && Array.isArray(char.observances) ? char.observances : null;
    let sum = 0;
    for (let i = 0; kept && i < kept.length; i++) {
      if (Defs.has('observance', kept[i])) sum += Defs.get('observance', kept[i]).heed || 0;
    }
    return sum;
  }

  function pipsOf(S, id) {
    const n = S.favours && S.favours[id] > 0 ? min(PIPS, S.favours[id]) : 0;
    stats.pips += n;
    return n;
  }

  // The count's marks: the tellers, then the elites, then the lychgate; markTime(i) is when the hand-bell rings mark i.
  function countMarks() { return count.tellers + count.elites + (count.gate ? 1 : 0); }
  function markTime(i) {
    const n = count.tellers, e = count.elites;
    if (i < n) return i * COUNT_STROKE;
    const first = max(0, n - 1) * COUNT_STROKE + COUNT_PAUSE;
    if (i < n + e) return first + (i - n) * COUNT_QUICK;
    return (e > 0 ? first + e * COUNT_QUICK : first) + COUNT_PAUSE;
  }

  // ---- the row ----

  function favourIcon(id) {
    const def = Defs.has('favour', id) ? Defs.get('favour', id) : null;
    if (!def) return id;
    return Glyphs.pick(typeof def.icon === 'string' ? def.icon : '', 'favour.' + Glyphs.slug(def.name), 'favour.' + Glyphs.slug(id), id);
  }

  // Matches the row as it stands against the one drawn: a favour that stays slides from where it was, one that is
  // new comes in from beyond the last place.
  function readRow(S) {
    const r = S.row, ids = r && Array.isArray(r.ids) ? r.ids : null;
    now.raised = ids && r.raised > 0 ? min(ROW, r.raised | 0) : 0;
    const shapes = r && Array.isArray(r.shapes) ? r.shapes.length : 0;
    now.standing = !!ids && shapes > 0 && (typeof r.until !== 'number' || r.until > S.t);
    now.sinkShare = now.standing && typeof r.until === 'number' ? clamp((r.until - S.t) / OFFER_SECONDS, 0, 1) : 0;
    let key = 0x52;
    const n = ids ? min(ROW, ids.length) : 0;
    for (let i = 0; i < n; i++) key = mix(key, typeof ids[i] === 'string' ? Core.hashStr(ids[i]) : 0);
    key = mix(key, n);
    const step = L.icon + L.gap;
    if (key !== rowKey) {
      rowKey = key;
      for (let i = 0; i < ROW; i++) {
        spare[i].id = slots[i].id;
        spare[i].x = slots[i].x;
        spare[i].alpha = slots[i].alpha;
        spare[i].img = slots[i].img;
      }
      const before = rowN;
      for (let i = 0; i < n; i++) {
        const id = typeof ids[i] === 'string' ? ids[i] : '', s = slots[i];
        let from = -1;
        for (let j = 0; j < before && from < 0; j++) if (spare[j].id === id) from = j;
        s.id = id;
        if (from >= 0) {
          s.x = spare[from].x;
          s.alpha = spare[from].alpha;
          s.img = spare[from].img;
          spare[from].id = '';               // matched once: a second copy of a favour comes in afresh
        } else {
          s.x = before > 0 ? ROW * step : i * step;
          s.alpha = before > 0 ? 0 : 1;
          s.img = null;
        }
      }
      for (let i = n; i < ROW; i++) slots[i].id = '';
      rowN = n;
    }
    for (let i = 0; i < rowN; i++) if (slots[i].img === null && slots[i].id !== '') slots[i].img = glyph(favourIcon(slots[i].id), L.icon, null);
    now.nails = r && Array.isArray(r.nails) ? r.nails.length : 0;
  }

  function slide(dt) {
    const step = L.icon + L.gap, k = still ? 1 : min(1, dt * 10);
    sliding = false;
    for (let i = 0; i < rowN; i++) {
      const s = slots[i], target = i * step;
      s.x += (target - s.x) * k;
      s.alpha = min(1, s.alpha + (still ? 1 : dt * 4));
      if (abs(target - s.x) < 0.5) s.x = target;
      else sliding = true;
      if (s.alpha < 1) sliding = true;
    }
  }

  // ---- drawing ----

  function rect(x, y, w, h, style) {
    ctx.fillStyle = style;
    ctx.fillRect(x, y, w, h);
  }

  function drawLife() {
    const x = L.bx + L.barX, y = L.by, w = L.bw, h = L.lifeH;
    rect(x - 1, y - 1, w + 2, h + 2, col.edge);
    rect(x, y, w, h, col.trough);
    if (now.tolled) {                                // the time left before the toll, bone on grey
      const tw = w * now.timeLeft;
      if (tw > 0) {
        rect(x, y, tw, h, col.ink);
        rect(x, y + h - max(1, round(h * 0.3)), tw, max(1, round(h * 0.3)), col.grey);
      }
      return;
    }
    const total = now.max + now.scars;
    if (!(total > 0)) return;
    const k = w / total, lw = clamp(now.life, 0, now.max) * k;
    let at = x;
    if (lw > 0) {
      const beat = now.faint && !still ? 0.72 + 0.28 * Math.cos(clock * TAU * 1.6) : 1;
      ctx.globalAlpha = beat;
      rect(at, y, lw, h, classColour);
      rect(at, y, lw, max(1, round(h * 0.25)), classLit);
      ctx.globalAlpha = 1;
      at += lw;
    }
    const room = x + w - now.scars * k;              // wounds never run into the scars' end
    for (let i = 0; i < now.woundN && at < room; i++) {
      const ww = min(held[i] * k, room - at);
      if (ww >= 1) {
        rect(at, y + 1, max(1, ww - 1), h - 2, woundColours[round(age[i] * GREYS)]);
        if (mending[i]) rect(at, y + 1, max(1, ww - 1), max(1, round(h * 0.3)), classLit);   // life coming back
      }
      at += ww;
    }
    if (now.scars > 0) {
      const sw = max(2, now.scars * k);
      rect(x + w - sw, y, sw, h, col.scar);
      rect(x + w - sw, y, 1, h, col.grey);
    }
  }

  function drawHeed() {
    const x = L.bx + L.barX, y = L.heedY, w = L.bw, h = L.heedH;
    rect(x - 1, y - 1, w + 2, h + 2, col.edge);
    rect(x, y, w, h, col.trough);
    if (!(now.heed > 0)) return;
    const fw = w * clamp(now.heedFree / now.heed, 0, 1);
    if (fw > 0) rect(x, y, fw, h, now.tolled ? col.grey : col.heed);
    if (fw < w) rect(x + fw, y, w - fw, h, col.accent);   // held by observances: their colour once they have one
  }

  function drawHaul(S) {
    const n = min(now.haul, floor(L.bw / (L.box + 3)));
    for (let i = 0; i < n; i++) {
      const f = S.haul[i], x = L.bx + L.barX + i * (L.box + 3), y = L.haulY;
      const notches = f && typeof f.notches === 'number' ? f.notches : f && Array.isArray(f.lines) ? f.lines.length : 0;
      rect(x - 1, y - 1, L.box + 2, L.box + 2, col.edge);
      rect(x, y, L.box, L.box, col.accent);
      for (let k = 0; k < min(notches, 4); k++) rect(x + 2 + k * 2, y + 2, 1, L.box - 4, col.edge);
    }
  }

  function drawRow(S) {
    const step = L.icon + L.gap, y0 = L.rowY, x0 = L.bx + L.rowX;
    const beat = now.standing && !still ? 0.82 + 0.18 * Math.cos(clock * TAU * 1.2) : 1;
    for (let i = 0; i < rowN; i++) {
      const s = slots[i], up = i < now.raised, x = x0 + s.x, y = up ? y0 - L.raise : y0;
      if (!s.img) {                                  // a place no favour could be drawn for: an empty socket
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1;
        ctx.strokeStyle = col.grey;
        ctx.strokeRect(x + 3.5, y + 3.5, L.icon - 7, L.icon - 7);
        ctx.globalAlpha = 1;
        continue;
      }
      ctx.globalAlpha = s.alpha * (up ? beat : 0.5);
      ctx.drawImage(s.img, x, y, L.icon, L.icon);
      if (i < 2 && now.nails > 0) {                  // Nail in the Candle: the two front places are pinned
        ctx.globalAlpha = 1;
        rect(x + L.icon - 4, y - 3, 3, round(L.icon * 0.45), col.edge);
        rect(x + L.icon - 3, y - 2, 1, round(L.icon * 0.45) - 2, col.ink);
        rect(x + L.icon - 6, y - 4, 7, 3, col.ink);
      }
      const pips = S.favours && S.favours[s.id] > 0 ? min(PIPS, S.favours[s.id]) : 0, pip = max(2, round(0.14 * rem));
      ctx.globalAlpha = s.alpha;
      for (let k = 0; k < pips; k++) {               // the times taken: small squares centred under the icon
        rect(x + (L.icon - (pips * 2 - 1) * pip) / 2 + k * pip * 2, y0 + L.icon + 2, pip, pip, col.inkDim);
      }
    }
    ctx.globalAlpha = 1;
    if (now.raised > 0 && rowN > 0) {                // the line under the raised places: it runs down while they stand
      const w = min(now.raised, rowN) * step - L.gap, y = y0 + L.icon - L.raise + 2;
      rect(x0, y, w, 2, col.edge);
      rect(x0, y, now.standing ? w * now.sinkShare : w, 2, now.standing ? col.accentLit : col.accent);
    }
    if (taken.t >= 0 && S.t - taken.t < TAKEN_FLASH) {
      const k = (S.t - taken.t) / TAKEN_FLASH, cx = x0 + taken.place * step + L.icon / 2, cy = y0 - L.raise + L.icon / 2;
      ctx.globalAlpha = 1 - k;
      ctx.lineWidth = 2;
      ctx.strokeStyle = col.accentLit;
      ctx.beginPath();
      ctx.arc(cx, cy, L.icon * (0.5 + 0.6 * k), 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  // The count's marks, under the row: strokes, then lozenges, then a lychgate.
  function drawCount() {
    if (!now.countOn || now.marks === 0) return;
    const y = L.countY, h = max(8, round(0.62 * rem)), stroke = max(3, round(0.18 * rem)), gap = max(4, round(0.26 * rem));
    let x = L.bx + L.rowX;
    ctx.globalAlpha = now.countDim ? 0.62 : 1;
    for (let i = 0; i < now.marks; i++) {
      if (i < count.tellers) {
        rect(x - 1, y - 1, stroke + 2, h + 2, col.edge);
        rect(x, y, stroke, h, col.ink);
        x += stroke + gap;
        if (i === count.tellers - 1) x += gap;
      } else if (i < count.tellers + count.elites) {
        const r = h * 0.42, cx = x + r, cy = y + h / 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx + r, cy);
        ctx.lineTo(cx, cy + r);
        ctx.lineTo(cx - r, cy);
        ctx.closePath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = col.edge;
        ctx.stroke();
        ctx.fillStyle = col.accentLit;
        ctx.fill();
        x += 2 * r + gap;
        if (i === count.tellers + count.elites - 1) x += gap;
      } else {
        Glyphs.draw(ctx, gateSpec(col.secondLit, h + 4), x, y - 2, h + 4);
      }
    }
    ctx.globalAlpha = 1;
  }

  // An icon from the cache of Glyphs at a size in CSS px, sharp on this canvas. One spec object serves every call.
  const glyphSpec = { id: '', size: 0, ink: null, dpr: 1 };
  function glyph(id, size, ink) {
    glyphSpec.id = id;
    glyphSpec.size = size;
    glyphSpec.ink = ink;
    glyphSpec.dpr = dpr;
    return Glyphs.image(glyphSpec);
  }
  function gateSpec(ink, size) {
    glyphSpec.id = 'mark.lychgate';
    glyphSpec.ink = ink;
    glyphSpec.size = size;
    glyphSpec.dpr = dpr;
    return glyphSpec;
  }

  function drawRing() {
    if (now.ring <= 0 && now.ringFade <= 0) return;
    const closing = now.ring > 0, bad = now.tolled;
    const lineW = max(3, round(0.24 * rem)) + (now.keeperNext ? 2 : 0);   // its dark edge carries it on bright ground
    if (closing) {
      dash[0] = now.ring * L.ringLen;
      dash[1] = L.ringLen;
      ctx.setLineDash(dash);
    } else {
      ctx.setLineDash(NO_DASH);
      ctx.globalAlpha = now.ringFade;
    }
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';
    ctx.lineWidth = lineW + 4;
    ctx.strokeStyle = col.edge;
    ctx.stroke(ringPath);
    ctx.lineWidth = lineW;
    ctx.strokeStyle = bad ? col.bad : closing ? col.accentLit : col.ink;
    ctx.stroke(ringPath);
    ctx.setLineDash(NO_DASH);
    ctx.globalAlpha = 1;
  }

  function tick(x, y, dx, dy, bright) {
    const len = L.tick, w = max(2, round(0.18 * rem));
    ctx.globalAlpha = bright ? 1 : 0.4;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dx * len, y + dy * len);
    ctx.lineWidth = w + 3;
    ctx.strokeStyle = col.edge;
    ctx.stroke();
    ctx.lineWidth = w;
    ctx.strokeStyle = bright ? col.accentLit : col.ink;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawTicks() {
    const cx = (L.x0 + L.x1) / 2, cy = (L.y0 + L.y1) / 2;
    if (now.quarters >= 1) tick(L.x1, cy, -1, 0, (now.bright & 2) !== 0);
    if (now.quarters >= 2) tick(cx, L.y1, 0, -1, (now.bright & 4) !== 0);
    if (now.quarters >= 3) tick(L.x0, cy, 1, 0, (now.bright & 8) !== 0);
    if (now.tollMark) tick(cx, L.y0, 0, 1, now.tollBright);
  }

  // The open lychgate: on screen only the far one is marked, over the gate; off screen a marker at the edge points at it.
  function drawGate(S) {
    const g = S.gate, st = stats.gate;
    st.shown = false;
    st.far = now.far;
    if (!now.gate) return;
    const m = L.pointer + round(0.5 * rem), x0 = edge.l + m, x1 = W - edge.r - m, y0 = edge.t + m, y1 = H - edge.b - m;
    let x = spot.x, y = spot.y;
    const on = x >= x0 && x <= x1 && y >= y0 && y <= y1;
    st.onScreen = on;
    const ink = now.far ? col.lamp : col.secondLit, r = L.pointer;
    let a = 0;
    if (on) {
      if (!now.far || viewGreys) return;             // the scene lights the far gate itself, and the way to it
      y -= 2.4 * rem;                                // over the gate, as a lit sign
    } else {
      const cx = W / 2, cy = H / 2, dx = x - cx, dy = y - cy;
      const t = min(dx !== 0 ? abs((dx > 0 ? x1 - cx : x0 - cx) / dx) : Infinity, dy !== 0 ? abs((dy > 0 ? y1 - cy : y0 - cy) / dy) : Infinity);
      x = cx + dx * t;
      y = cy + dy * t;
      if (x < L.bx + L.blockW + r && x > L.bx - r && y < L.by + L.bh + r) y = L.by + L.bh + r;   // clear of the corner block
      a = Math.atan2(dy, dx);
    }
    if (now.far && !still) {                         // lit: a soft glow that breathes
      ctx.globalAlpha = 0.25 + 0.15 * Math.cos(clock * TAU * 0.8);
      ctx.fillStyle = col.lamp;
      ctx.beginPath();
      ctx.arc(x, y, r * 1.55, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = col.fill;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = col.edge;
    ctx.stroke();
    if (!on) {                                       // the point towards the gate, standing out of the disc
      const tip = r + max(6, round(0.55 * rem));
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * tip, y + Math.sin(a) * tip);
      ctx.lineTo(x + Math.cos(a + 0.62) * (r - 1), y + Math.sin(a + 0.62) * (r - 1));
      ctx.lineTo(x + Math.cos(a - 0.62) * (r - 1), y + Math.sin(a - 0.62) * (r - 1));
      ctx.closePath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = col.edge;
      ctx.stroke();
      ctx.fillStyle = ink;
      ctx.fill();
    }
    if (now.gateLeft > 0) {                          // its time left, running down round it
      ctx.lineWidth = max(2, round(0.16 * rem));
      ctx.strokeStyle = ink;
      ctx.beginPath();
      ctx.arc(x, y, r - 2, -Math.PI / 2, -Math.PI / 2 + TAU * now.gateLeft);
      ctx.stroke();
    }
    const s = round(r * 1.25);
    Glyphs.draw(ctx, gateSpec(ink, s), x - s / 2, y - s / 2 - 1, s);
    st.shown = true;
    st.x = round(x);
    st.y = round(y);
  }

  function drawDisc() {
    const d = stats.disc;
    d.shown = now.disc;
    if (!now.disc) return;
    const x = L.dx, y = L.dy, r = L.dr, ready = now.cooldown <= 0;
    ctx.fillStyle = col.fill;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    const s = round(r * 1.25);
    ctx.globalAlpha = ready ? 1 : 0.55;
    ctx.drawImage(glyph(tradeGlyph, s, null), x - s / 2, y - s / 2, s, s);
    ctx.globalAlpha = 1;
    if (!ready) {                                    // the recharge still to run: a pale wedge from the top, clockwise
      ctx.fillStyle = 'rgba(236, 231, 218, 0.28)';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, r - 1, -Math.PI / 2, -Math.PI / 2 + TAU * now.cooldown);
      ctx.closePath();
      ctx.fill();
    }
    ctx.lineWidth = 2;
    ctx.strokeStyle = ready ? col.accent : col.grey;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.stroke();
    const key = KEYS[Input.device];
    if (key) {
      ctx.font = L.keyFont;
      ctx.textAlign = mirror ? 'left' : 'right';
      ctx.textBaseline = 'middle';
      const kx = mirror ? x + r + 8 : x - r - 8;
      ctx.lineWidth = 3;
      ctx.strokeStyle = col.edge;
      ctx.strokeText(key, kx, y);
      ctx.fillStyle = ready ? col.ink : col.inkDim;
      ctx.fillText(key, kx, y);
    }
    d.x = x;
    d.y = y;
    d.r = r;
  }

  function draw(S) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawRing();
    drawTicks();
    drawLife();
    drawHeed();
    // under the bars the haul if any; then the row and the count, under it all or beside the bars
    const bars = now.haul > 0 ? L.haulY + L.box : L.heedY + L.heedH;
    L.rowY = (L.beside ? L.by : bars + round(0.55 * rem)) + L.raise;
    L.countY = L.rowY + L.icon + round(0.85 * rem);
    drawHaul(S);
    drawRow(S);
    drawCount();
    drawGate(S);
    drawDisc();
    L.bh = max(bars, now.countOn && now.marks > 0 ? L.countY + round(0.62 * rem) : L.rowY + L.icon + 6) - L.by;
  }

  // ---- the buttons ----

  function plainButtons() {
    Input.button('A', { icon: null, cooldown: 0, hidden: false, label: 'Button A' });
    Input.button('B', { icon: null, cooldown: 0, hidden: false, label: 'Button B' });
  }

  function buttons(S) {
    if (typeof Input.button !== 'function') return;
    if (S !== buttonsFor) {
      buttonsFor = S;
      if (S.debug !== null) {
        plainButtons();
        return;
      }
      Input.button('A', tradeDef ? { icon: Glyphs.icon({ id: tradeGlyph, size: 72 }), label: tradeDef.name || 'Trade', hidden: false }
        : { icon: null, hidden: true, label: 'Button A' });
      Input.button('B', { icon: heaveIcon || (heaveIcon = Glyphs.icon({ id: 'mark.heave', size: 64 })), label: 'Heave' });
    }
    if (S.debug !== null) return;
    if (tradeDef) Input.button('A', { cooldown: now.cooldown });
    const empty = now.haul === 0;
    Input.button('B', { hidden: empty });
    if (!empty) {
      const p = S.player, full = stat(S, 'heave-recharge', 4);
      Input.button('B', { cooldown: full > 0 && p.heaveCd > 0 ? clamp(p.heaveCd / full, 0, 1) : 0 });
    }
  }

  // ---- a run begins, a frame is drawn ----

  function begin(S) {
    run = S;
    const cfg = S.cfg || {}, classId = cfg.class || (cfg.char && cfg.char.class) || null;
    colours(classId);
    tradeDef = classId && Defs.has('class', classId) ? Defs.get('class', classId).trade || null : null;
    tradeGlyph = tradeDef ? Glyphs.pick(typeof tradeDef.icon === 'string' ? tradeDef.icon : '', 'trade.' + Glyphs.slug(tradeDef.name)) : '';
    tolledStart = gateSpan = gateLeft = 0;
    count.t = taken.t = -1;
    count.tellers = count.elites = stats.count.tellers = stats.count.elites = 0;
    count.gate = stats.count.gate = false;
    rowKey = 0;
    rowN = 0;
    for (let i = 0; i < ROW; i++) slots[i].id = '';
    lastOpened.fill(-1);                             // nothing of the last run's wounds is taken for mending
    lastBack.fill(0);
    mendAt.fill(-1);
    lastSig = -1;
    const t = stats.trade;
    t.id = tradeDef ? tradeDef.name || '' : '';
    t.icon = tradeGlyph;
  }

  function hide() {
    stats.shown = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    grey.classList.remove('is-on');
    greyOn = false;
    stats.tolledFor = false;
    stats.gate.shown = false;
    stats.disc.shown = false;
    run = null;
    lastSig = -1;
  }

  function report() {
    stats.life = now.life;
    stats.wounds = now.wounds;
    stats.woundN = now.woundN;
    stats.scars = now.scars;
    stats.max = now.max;
    stats.colour = classColour;
    stats.heed = now.heed;
    stats.heedFree = now.heedFree;
    stats.row.length = rowN;
    for (let i = 0; i < rowN; i++) stats.row[i] = slots[i].id;
    stats.raised = rowN > 0 ? now.raised : 0;
    stats.standing = now.standing;
    stats.ring = now.ring > 0 ? now.ring : now.ringFade > 0 ? 1 : 0;
    stats.quarters = now.quarters;
    stats.tollMark = now.tollMark;
    const c = stats.count;
    c.on = now.countOn;
    c.marks = now.countOn ? now.marks : 0;
    stats.haul = now.haul;
    stats.trade.cooldown = now.cooldown;
    stats.trade.ready = now.trade && now.cooldown <= 0;
    stats.trade.disc = now.disc;
    stats.tolledFor = now.tolled;
    stats.timeLeft = now.timeLeft;
    const b = stats.block;
    b.x = L.bx;
    b.y = L.by;
    b.w = L.blockW;
    b.h = L.bh;
    b.bar = L.bw;
    b.barX = L.bx + L.barX;
    b.lifeH = L.lifeH;
  }

  function frame(S, alpha, dt) {
    if (!ctx) return;
    if (wantLayout) layout();
    if (!S || Game.state !== 'run') {
      if (stats.shown || run !== null) hide();
      return;
    }
    if (S !== run) begin(S);
    stats.shown = true;
    stats.frames++;
    clock += dt > 0 && dt < 0.25 ? dt : 0;
    slide(dt > 0 && dt < 0.25 ? dt : 0);
    const sig = read(S, alpha);
    if ((now.tolled && !viewGreys) !== greyOn) {
      greyOn = now.tolled && !viewGreys;
      grey.classList.toggle('is-on', greyOn);
    }
    stats.greyBy = now.tolled ? (viewGreys ? 'view' : 'hud') : '';
    if (sig !== lastSig) {
      const t0 = Plat.now();
      lastSig = sig;
      draw(S);
      report();
      stats.drawn++;
      msSum += Plat.now() - t0;
      if (++msN >= 30) {
        stats.ms = msSum / msN;
        msSum = msN = 0;
      }
    }
    stats.heave.hidden = now.haul === 0 && S.debug === null;
    buttons(S);
  }

  // The events of a step that the state does not keep: the count, and the place of a favour taken.
  function heard(S) {
    if (!S || S.eventCount === 0) return;
    if (S !== run && ctx) begin(S);                  // a run heard before it is first drawn keeps what it said
    const ring = S.events, n = S.eventCount, len = ring.length;
    for (let i = 0; i < n; i++) {
      const e = ring[(S.eventStart + i) % len];
      if (e.k === 'count') {
        count.t = S.t;
        count.toll = S.toll;
        count.tellers = clamp(e.a | 0, 0, 12);
        count.elites = clamp(e.b | 0, 0, 8);
        count.gate = e.id === 'gate';
        const c = stats.count;                     // what was heard is known whether or not it is drawn
        c.tellers = count.tellers;
        c.elites = count.elites;
        c.gate = count.gate;
      } else if (e.k === 'favour') {
        taken.t = S.t;
        taken.place = clamp((e.a | 0) - 1, 0, ROW - 1);
      }
    }
  }

  Plat.on('boot', function () {
    layer = document.getElementById('hud');
    if (!layer) return;
    grey = UI.h('div', { class: 'hud-grey', 'aria-hidden': 'true' });
    canvas = UI.h('canvas', { class: 'hud-canvas', 'aria-hidden': 'true' });
    probe = UI.h('div', { class: 'hud-probe', 'aria-hidden': 'true' });
    layer.appendChild(grey);
    layer.appendChild(canvas);
    layer.appendChild(probe);
    ctx = canvas.getContext('2d');
    touchRoot = document.querySelector('#touch .tc');   // 52-input.js builds it on this same notice, earlier
    // A scene that greys the world itself for Tolled-for (68-scene.js, through the view's post.grey) keeps what
    // glows in colour, the far lychgate among it: then the HUD lays no grey of its own over it.
    viewGreys = typeof Scene.draw === 'function' && !!Scene.stats && typeof Scene.stats.grey === 'number';
    wantLayout = true;
    if (typeof Settings.on === 'function') {
      const again = function () { wantLayout = true; };
      Settings.on('ui.scale', again);
      Settings.on('input.hand', again);
      Settings.on(COUNT_KEY, function () { lastSig = -1; });
    }
  });
  Plat.on('resize', function () { wantLayout = true; });
  Plat.on('frame', frame);
  Plat.on('step', heard);
  Plat.on('state', function (state) { if (state !== 'run' && ctx && run !== null) hide(); });
})();
