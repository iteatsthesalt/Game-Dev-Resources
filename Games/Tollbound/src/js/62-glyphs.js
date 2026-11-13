// 62-glyphs.js: icons painted by code from the game's own unit shapes (box, tapered box, cylinder, sphere, cone),
// outlined and flat-shaded as its figures are: lit on the left, a darker face on the right. The trade of each
// class, the favours of the row, and the small marks of the HUD and the screens. Nothing is loaded and nothing is
// borrowed: an icon is a recipe of a few shapes, in the colours of the districts (docs/design/01-world.md).
// Owns: Glyphs
// Public:
//   Glyphs.define(id, paint)        registers a recipe while files load (or later). paint(g) draws into a square of
//                                   side 1, y running down, with the helpers of g:
//                                     g.box(x, y, w, h, colour)            g.taper(cx, y, wTop, wBottom, h, colour)
//                                     g.cyl(cx, y, w, h, colour)           g.ball(cx, cy, r, colour)
//                                     g.cone(cx, y, w, h, colour)          apex at y, base at y + h
//                                     g.bell(cx, y, w, h, colour, up)      a bell, mouth down (mouth up when up)
//                                     g.poly([x, y, x, y, ...], colour)    g.line(x0, y0, x1, y1, width, colour)
//                                     g.ring(cx, cy, r, width, colour)     g.dot(cx, cy, r, colour)  (no outline)
//                                     g.flat(x, y, w, h, colour)           a plain rectangle, no outline
//                                     g.within(path, x, y, w, h, colour)   a rectangle filled inside a shape only (g.bell
//                                                                          returns its path)
//                                     g.turned(cx, cy, angle, fn)          what fn paints, turned round (cx, cy)
//                                     g.ink, the icon's main colour (spec.ink, else the recipe's own: null);
//                                     g.c, the palette (below)
//                                   Solid shapes are outlined in dark so that they read on any ground. Throws when
//                                   the id is taken.
//   Glyphs.icon(spec) -> canvas     a new canvas with the icon on it, for a page element (a touch button, a screen).
//                                   spec: an id, or {id, size, ink, dpr}: size in CSS px (48), ink a colour that
//                                   takes the place of the main colour, dpr pixels to a CSS pixel (Plat.dpr()). The
//                                   canvas is styled size CSS px square and carries data-glyph = id.
//   Glyphs.image(spec) -> canvas    the same icon from a cache (one canvas for each id, ink and pixel size), to be
//                                   drawn into another canvas with drawImage. Shared: never put it in the page.
//   Glyphs.draw(ctx, spec, x, y, size)   draws Glyphs.image(spec) at (x, y), size units of ctx square; spec.dpr
//                                   says how many pixels a unit of ctx is (1), so that the image is sharp
//   Glyphs.pick(id, ...more) -> id  the first of the ids that has a recipe, else the first one given: for an icon
//                                   named by a definition with a name to fall back on ('trade.' + the trade's name)
//   Glyphs.has(id) -> boolean       is there a recipe for this id
//   Glyphs.ids() -> [id]            every id with a recipe, in the order they were defined
//   Glyphs.slug(name) -> id part    'Funeral Biscuit' -> 'funeral-biscuit'
//   Glyphs.C                        the palette, frozen: {name: '#rrggbb'}
// An id with no recipe is painted as a token: one of the five unit shapes on a plinth, its shape and colour drawn
// from the id's hash, so two unknown ids still look different. The recipes here:
//   trade.set (also 'set', as 31-change-ringer.js names it), trade.turn-about, trade.plant, trade.long-pole,
//   trade.gust, trade.close   the trade of each class
//     (03-classes.md): the Change-ringer's bell set mouth-up over its striped sally, the Verger's verge and a dead
//     body turned away, the Toll-gatherer's striped post and bar, the Lamp-trimmer's long pole lighting a lamp,
//     the Organ-blower's bellows and their breath, the Sexton's spade in a closed mound
//   mark.lychgate   the roofed gate of the way out        mark.heave   a find tipping over the side, into water
//   mark.find       a find, striped with notches            mark.bell    a great bell, its lower part drowned
//   the favours, by the motif each favour's icon names (40-favours.js): loaf, candle, sprig, clock, basin, stone,
//     road, frame, jug, hatband, crape, gloves, window, door, handbell, sally, stay, mourners, coffin, roof, muffle,
//     arch, coins, nail, passing-bell
(function () {
  'use strict';

  const C = Object.freeze({
    bone: '#ece7da', boneDim: '#b1ac9d', chalk: '#e4dfd1', bronze: '#c79a45', bronzeLit: '#efc977', bronzeDim: '#7d6230',
    gold: '#d6a23e', lamp: '#e6c25a', ember: '#df642a', timber: '#6a492d', oak: '#8a5f37', hemp: '#c7a86f',
    red: '#a7312c', white: '#ece9e1', blue: '#2e4e8e', slate: '#5b5470', lead: '#6d7276', moss: '#5d6a39',
    verdigris: '#6fb3a6', verdigrisLit: '#a9ddd1', water: '#4a6f8e', loam: '#79593b', soot: '#25211e', dark: '#0a0c11',
  });
  const SHADE = 'rgba(10, 12, 17, 0.28)';      // the right face of a solid: the light comes from the upper left
  const OUTLINE = 'rgba(10, 12, 17, 0.92)';
  const TOKENS = ['box', 'taper', 'cyl', 'ball', 'cone'];
  const TOKEN_COLOURS = [C.bronze, C.verdigris, C.chalk, C.red, C.lamp, C.slate, C.moss, C.oak];
  const CACHE_MAX = 96;

  const recipes = new Map();                    // id -> paint(g)
  const order = [];
  const cache = new Map();                      // id -> Map(ink -> Map(pixels -> canvas))
  let cached = 0;

  // ---- the painter ----
  // One context is painted at a time: ctx, scaled so that the icon's square is 1 unit; out is the outline width in
  // units, about 1.5 device pixels whatever the size.

  let ctx = null, out = 0.05;

  function solid(path, colour, shadeX) {
    ctx.lineWidth = out * 2;                    // the inner half is covered by the fill
    ctx.strokeStyle = OUTLINE;
    ctx.stroke(path);
    ctx.fillStyle = colour;
    ctx.fill(path);
    if (shadeX !== null) {
      ctx.save();
      ctx.clip(path);
      ctx.fillStyle = SHADE;
      ctx.fillRect(shadeX, -1, 3, 3);
      ctx.restore();
    }
  }

  function box(x, y, w, h, colour) {
    const p = new Path2D();
    p.rect(x, y, w, h);
    solid(p, colour, x + w * 0.62);
  }

  function taper(cx, y, wTop, wBottom, h, colour) {
    const p = new Path2D();
    p.moveTo(cx - wTop / 2, y);
    p.lineTo(cx + wTop / 2, y);
    p.lineTo(cx + wBottom / 2, y + h);
    p.lineTo(cx - wBottom / 2, y + h);
    p.closePath();
    solid(p, colour, cx + Math.max(wTop, wBottom) * 0.12);
  }

  function cyl(cx, y, w, h, colour) {
    const p = new Path2D(), e = Math.min(h * 0.5, w * 0.22);   // the depth of the elliptic ends
    p.moveTo(cx - w / 2, y + e);
    p.ellipse(cx, y + e, w / 2, e, 0, Math.PI, 0);
    p.lineTo(cx + w / 2, y + h - e);
    p.ellipse(cx, y + h - e, w / 2, e, 0, 0, Math.PI);
    p.closePath();
    solid(p, colour, cx + w * 0.12);
    ctx.lineWidth = out;
    ctx.strokeStyle = SHADE;                    // the rim of the top end
    ctx.beginPath();
    ctx.ellipse(cx, y + e, w / 2 - out, Math.max(0, e - out / 2), 0, 0, Math.PI);
    ctx.stroke();
  }

  function ball(cx, cy, r, colour) {
    const p = new Path2D();
    p.arc(cx, cy, r, 0, Math.PI * 2);
    solid(p, colour, cx + r * 0.2);
  }

  function cone(cx, y, w, h, colour) {
    const p = new Path2D();
    p.moveTo(cx, y);
    p.lineTo(cx + w / 2, y + h);
    p.lineTo(cx - w / 2, y + h);
    p.closePath();
    solid(p, colour, cx + w * 0.06);
  }

  // A bell in profile: a rounded crown, a waist that curves out, a flared lip. Mouth down unless up.
  function bell(cx, y, w, h, colour, up) {
    const fy = function (v) { return up ? y + h - v * h : y + v * h; };
    const p = new Path2D();
    p.moveTo(cx - w * 0.2, fy(0.14));
    p.quadraticCurveTo(cx, fy(-0.06), cx + w * 0.2, fy(0.14));
    p.bezierCurveTo(cx + w * 0.25, fy(0.5), cx + w * 0.3, fy(0.74), cx + w * 0.5, fy(0.9));
    p.lineTo(cx + w * 0.5, fy(1));
    p.quadraticCurveTo(cx, fy(0.9), cx - w * 0.5, fy(1));
    p.lineTo(cx - w * 0.5, fy(0.9));
    p.bezierCurveTo(cx - w * 0.3, fy(0.74), cx - w * 0.25, fy(0.5), cx - w * 0.2, fy(0.14));
    p.closePath();
    solid(p, colour, cx + w * 0.08);
    return p;
  }

  // Fills a rectangle inside a shape only: water standing in a bell, a band of colour on a body.
  function within(path, x, y, w, h, colour) {
    ctx.save();
    ctx.clip(path);
    ctx.fillStyle = colour;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  // Paints what fn paints, turned by angle (radians, clockwise on the screen) round (cx, cy).
  function turned(cx, cy, angle, fn) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.translate(-cx, -cy);
    try { fn(); } finally { ctx.restore(); }
  }

  function poly(points, colour) {
    const p = new Path2D();
    p.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) p.lineTo(points[i], points[i + 1]);
    p.closePath();
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < points.length; i += 2) { lo = Math.min(lo, points[i]); hi = Math.max(hi, points[i]); }
    solid(p, colour, lo + (hi - lo) * 0.58);
  }

  // A line with a dark edge: drawn twice, wide in the outline colour and then in its own.
  function line(x0, y0, x1, y1, width, colour) {
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineWidth = width + out * 2;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    ctx.lineWidth = width;
    ctx.strokeStyle = colour;
    ctx.stroke();
  }

  function ring(cx, cy, r, width, colour) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = width + out * 2;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    ctx.lineWidth = width;
    ctx.strokeStyle = colour;
    ctx.stroke();
  }

  function dot(cx, cy, r, colour) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = colour;
    ctx.fill();
  }

  function flat(x, y, w, h, colour) {
    ctx.fillStyle = colour;
    ctx.fillRect(x, y, w, h);
  }

  const g = { c: C, ink: null, box, taper, cyl, ball, cone, bell, poly, line, ring, dot, flat, within, turned };

  // ---- the token for an id with no recipe ----

  function token(gg, id) {
    const h = Core.hashStr(String(id)), shape = TOKENS[h % TOKENS.length];
    const colour = gg.ink || TOKEN_COLOURS[(h >>> 4) % TOKEN_COLOURS.length];
    gg.box(0.18, 0.8, 0.64, 0.1, C.lead);                 // the plinth
    if (shape === 'box') gg.box(0.3, 0.36, 0.4, 0.44, colour);
    else if (shape === 'taper') gg.taper(0.5, 0.3, 0.26, 0.5, 0.5, colour);
    else if (shape === 'cyl') gg.cyl(0.5, 0.26, 0.38, 0.54, colour);
    else if (shape === 'ball') gg.ball(0.5, 0.56, 0.24, colour);
    else gg.cone(0.5, 0.18, 0.5, 0.62, colour);
    const marks = (h >>> 9) % 3;                          // up to two small marks on the plinth
    for (let i = 0; i < marks; i++) gg.dot(0.4 + i * 0.2, 0.85, 0.03, C.bone);
  }

  function paint(target, id, ink, x, y, px) {
    ctx = target;
    out = Math.max(1.2, px * 0.03) / px;
    ctx.save();
    ctx.setTransform(px, 0, 0, px, x, y);
    ctx.lineJoin = 'miter';
    ctx.miterLimit = 3;
    g.ink = ink || null;
    const recipe = recipes.get(id);
    try {
      if (recipe) recipe(g); else token(g, id);
    } finally {
      ctx.restore();
      ctx = null;
    }
  }

  // ---- specs ----

  const plain = { id: '', size: 48, ink: null, dpr: 1 };

  function norm(spec) {
    if (typeof spec === 'string') {
      plain.id = spec;
      plain.size = 48;
      plain.ink = null;
      plain.dpr = Plat.dpr();
      return plain;
    }
    Core.assert(spec && typeof spec.id === 'string', 'Glyphs: a spec is an icon id or {id, size, ink, dpr}');
    plain.id = spec.id;
    plain.size = spec.size > 0 ? spec.size : 48;
    plain.ink = typeof spec.ink === 'string' ? spec.ink : null;
    plain.dpr = spec.dpr > 0 ? spec.dpr : Plat.dpr();
    return plain;
  }

  Glyphs.C = C;

  Glyphs.define = function (id, paintFn) {
    Core.assert(typeof id === 'string' && id !== '' && typeof paintFn === 'function', 'Glyphs.define needs an id and a function (g)');
    Core.assert(!recipes.has(id), 'Glyphs.define: "' + id + '" is already defined');
    recipes.set(id, paintFn);
    order.push(id);
    cache.delete(id);
  };

  Glyphs.has = function (id) { return recipes.has(id); };
  Glyphs.ids = function () { return order.slice(); };

  Glyphs.pick = function (id) {
    for (let i = 0; i < arguments.length; i++) if (typeof arguments[i] === 'string' && recipes.has(arguments[i])) return arguments[i];
    return typeof id === 'string' && id !== '' ? id : 'unknown';
  };

  Glyphs.slug = function (name) {
    return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  };

  Glyphs.icon = function (spec) {
    const s = norm(spec), px = Math.max(1, Math.round(s.size * Math.min(3, s.dpr)));
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = px;
    canvas.style.width = canvas.style.height = s.size + 'px';
    canvas.className = 'glyph';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.dataset.glyph = s.id;
    paint(canvas.getContext('2d'), s.id, s.ink, 0, 0, px);
    return canvas;
  };

  Glyphs.image = function (spec) {
    const s = norm(spec), px = Math.max(1, Math.round(s.size * Math.min(3, s.dpr))), ink = s.ink || '';
    let byInk = cache.get(s.id);
    if (!byInk) cache.set(s.id, (byInk = new Map()));
    let bySize = byInk.get(ink);
    if (!bySize) byInk.set(ink, (bySize = new Map()));
    let canvas = bySize.get(px);
    if (!canvas) {
      if (cached >= CACHE_MAX) {                 // a long session that has drawn many sizes: start again
        cache.clear();
        cached = 0;
        cache.set(s.id, (byInk = new Map()));
        byInk.set(ink, (bySize = new Map()));
      }
      canvas = document.createElement('canvas');
      canvas.width = canvas.height = px;
      paint(canvas.getContext('2d'), s.id, s.ink, 0, 0, px);
      bySize.set(px, canvas);
      cached++;
    }
    return canvas;
  };

  Glyphs.draw = function (target, spec, x, y, size) {
    const scale = typeof spec === 'object' && spec !== null && spec.dpr > 0 ? spec.dpr : 1;
    const s = norm(spec);                         // the shared spec, now ours to fill in
    s.size = size;
    s.dpr = scale;
    target.drawImage(Glyphs.image(s), x, y, size, size);
  };

  // ---- the trades ----

  // Change-ringer, Set: the bell set mouth-up on its headstock, the rope below with its striped sally. Also under
  // 'set', the icon 31-change-ringer.js names for the trade.
  function paintSet(g) {
    const c = g.c;
    g.bell(0.5, 0.05, 0.7, 0.46, g.ink || c.bronze, true);
    g.flat(0.18, 0.055, 0.64, 0.035, c.bronzeDim);       // the open mouth, seen a little from above
    g.dot(0.5, 0.1, 0.05, c.dark);                       // the clapper lying in it
    g.box(0.24, 0.5, 0.52, 0.08, c.timber);
    g.line(0.5, 0.58, 0.5, 0.97, 0.05, c.hemp);
    const stripes = [c.red, c.white, c.blue, c.red];
    for (let i = 0; i < stripes.length; i++) g.box(0.39, 0.64 + i * 0.07, 0.22, 0.07, stripes[i]);
  }
  Glyphs.define('trade.set', paintSet);
  Glyphs.define('set', paintSet);

  // Verger, Turn About: the verge held upright, and one of the dead turned to walk the other way.
  Glyphs.define('trade.turn-about', function (g) {
    const c = g.c;
    g.line(0.3, 0.26, 0.3, 0.94, 0.06, c.oak);
    g.ball(0.3, 0.2, 0.09, g.ink || c.bronze);
    g.taper(0.66, 0.4, 0.22, 0.3, 0.36, c.slate);         // the slumped body, leaning away
    g.ball(0.79, 0.4, 0.09, c.boneDim);                   // its head low and forward, to the right
    g.box(0.56, 0.76, 0.08, 0.18, c.slate);
    g.box(0.68, 0.76, 0.08, 0.18, c.slate);
    g.line(0.52, 0.18, 0.78, 0.18, 0.04, c.bone);         // the way it now faces
    g.poly([0.86, 0.18, 0.76, 0.12, 0.76, 0.24], c.bone);
  });

  // Toll-gatherer, Plant: the toll-post driven into the ground, its striped bar swung out from the top.
  Glyphs.define('trade.plant', function (g) {
    const c = g.c;
    g.poly([0.06, 0.92, 0.2, 0.8, 0.44, 0.78, 0.6, 0.92], c.loam);
    g.box(0.24, 0.16, 0.14, 0.7, g.ink || c.oak);
    g.box(0.2, 0.1, 0.22, 0.08, c.timber);
    for (let i = 0; i < 4; i++) g.box(0.38 + i * 0.14, 0.24, 0.14, 0.1, i % 2 ? c.red : c.white);
    g.box(0.92, 0.22, 0.04, 0.14, c.timber);
  });

  // Lamp-trimmer, Long Pole: a long pole reaching across to light a lamp on its post.
  Glyphs.define('trade.long-pole', function (g) {
    const c = g.c;
    g.box(0.74, 0.42, 0.06, 0.52, c.lead);                // the lamp-post
    g.box(0.66, 0.26, 0.22, 0.18, c.soot);                // the lamp
    g.dot(0.77, 0.35, 0.06, c.lamp);
    g.line(0.08, 0.92, 0.56, 0.34, 0.05, c.oak);          // the pole
    g.cone(0.6, 0.18, 0.12, 0.16, g.ink || c.lamp);       // its small flame
    g.dot(0.6, 0.31, 0.03, c.ember);
  });

  // Organ-blower, Gust: the bellows' two boards opening from their hinge, and the wind leaving them.
  Glyphs.define('trade.gust', function (g) {
    const c = g.c;
    g.poly([0.08, 0.5, 0.56, 0.24, 0.6, 0.34, 0.12, 0.54], c.oak);
    g.poly([0.08, 0.5, 0.56, 0.76, 0.6, 0.66, 0.12, 0.46], c.timber);
    g.taper(0.62, 0.4, 0.06, 0.14, 0.2, c.lead);
    const ink = g.ink || c.bone;
    g.line(0.72, 0.38, 0.92, 0.32, 0.04, ink);
    g.line(0.74, 0.5, 0.96, 0.5, 0.04, ink);
    g.line(0.72, 0.62, 0.92, 0.68, 0.04, ink);
  });

  // Sexton, Close: the grave shut into a mound, the spade left standing in it.
  Glyphs.define('trade.close', function (g) {
    const c = g.c;
    const mound = [0.06, 0.9, 0.18, 0.7, 0.38, 0.6, 0.62, 0.6, 0.82, 0.7, 0.94, 0.9];
    g.poly(mound, c.loam);
    g.line(0.6, 0.08, 0.6, 0.5, 0.05, c.oak);
    g.box(0.52, 0.06, 0.16, 0.05, c.oak);
    g.taper(0.6, 0.44, 0.2, 0.16, 0.22, g.ink || c.lead);
  });

  // ---- marks ----

  // The lychgate: two posts under a gabled roof, the opening between them.
  Glyphs.define('mark.lychgate', function (g) {
    const c = g.c, ink = g.ink || c.oak;
    g.poly([0.04, 0.42, 0.5, 0.08, 0.96, 0.42, 0.86, 0.48, 0.14, 0.48], ink);
    g.box(0.18, 0.46, 0.13, 0.46, ink);
    g.box(0.69, 0.46, 0.13, 0.46, ink);
    g.box(0.31, 0.52, 0.38, 0.06, c.timber);
  });

  // The heave: a find tipped over the side, into the water.
  Glyphs.define('mark.heave', function (g) {
    const c = g.c;
    const ink = g.ink || c.bronze;
    g.poly([0.3, 0.16, 0.66, 0.08, 0.74, 0.44, 0.38, 0.52], ink);
    g.line(0.4, 0.22, 0.47, 0.48, 0.03, c.dark);
    g.line(0.52, 0.19, 0.59, 0.45, 0.03, c.dark);
    g.line(0.16, 0.24, 0.16, 0.42, 0.04, c.bone);
    g.line(0.84, 0.3, 0.84, 0.5, 0.04, c.bone);
    g.box(0.06, 0.7, 0.88, 0.2, c.water);
    g.line(0.1, 0.68, 0.9, 0.68, 0.04, c.verdigrisLit);
  });

  // A find, striped with its notches.
  Glyphs.define('mark.find', function (g) {
    const c = g.c;
    g.box(0.18, 0.22, 0.64, 0.6, g.ink || c.bronze);
    for (let i = 0; i < 3; i++) g.line(0.3 + i * 0.16, 0.3, 0.3 + i * 0.16, 0.74, 0.04, c.dark);
  });

  // A great bell, its lower part drowned: the city's bells, fallen dumb under the water.
  Glyphs.define('mark.bell', function (g) {
    const c = g.c;
    g.box(0.44, 0.03, 0.12, 0.09, c.timber);
    const body = g.bell(0.5, 0.08, 0.8, 0.8, g.ink || c.bronze, false);
    g.within(body, 0, 0.62, 1, 0.4, 'rgba(38, 70, 112, 0.62)');
    g.line(0.04, 0.62, 0.96, 0.62, 0.025, c.verdigrisLit);
    g.line(0.18, 0.74, 0.34, 0.74, 0.02, c.verdigris);
    g.line(0.62, 0.8, 0.8, 0.8, 0.02, c.verdigris);
  });

  // ---- the favours of the row, by the motif 40-favours.js names for each ----
  // They are drawn about 24 px square in the row: two to five bold shapes each, no fine lines.

  // Arval Bread: the funeral loaf, scored across its dome.
  Glyphs.define('loaf', function (g) {
    const c = g.c;
    g.poly([0.1, 0.8, 0.1, 0.58, 0.24, 0.38, 0.5, 0.3, 0.76, 0.38, 0.9, 0.58, 0.9, 0.8], c.hemp);
    g.line(0.33, 0.46, 0.4, 0.64, 0.05, c.oak);
    g.line(0.53, 0.42, 0.6, 0.6, 0.05, c.oak);
    g.box(0.08, 0.78, 0.84, 0.1, c.oak);
  });

  // Lyke-wake: the candle kept burning by the dead through the night.
  Glyphs.define('candle', function (g) {
    const c = g.c;
    g.box(0.18, 0.84, 0.64, 0.08, c.lead);
    g.cyl(0.5, 0.36, 0.28, 0.5, c.chalk);
    g.cone(0.5, 0.06, 0.18, 0.28, c.lamp);
    g.dot(0.5, 0.29, 0.04, c.ember);
  });

  // Sprig of Rosemary: a stem and its narrow leaves.
  Glyphs.define('sprig', function (g) {
    const c = g.c;
    g.line(0.32, 0.94, 0.62, 0.08, 0.05, c.oak);
    const leaf = function (x, y, side) { g.poly([x, y, x + side * 0.26, y - 0.04, x + side * 0.05, y - 0.1], c.moss); };
    leaf(0.38, 0.76, -1);
    leaf(0.44, 0.6, 1);
    leaf(0.48, 0.46, -1);
    leaf(0.54, 0.32, 1);
    leaf(0.57, 0.2, -1);
  });

  // Stopped Clock: the clock of the house, its hands left at the hour.
  Glyphs.define('clock', function (g) {
    const c = g.c;
    g.box(0.22, 0.1, 0.56, 0.82, c.oak);
    g.ball(0.5, 0.38, 0.21, c.chalk);
    g.line(0.5, 0.39, 0.5, 0.22, 0.05, c.dark);
    g.line(0.5, 0.39, 0.62, 0.39, 0.05, c.dark);
    g.box(0.4, 0.66, 0.2, 0.18, c.soot);
  });

  // Laying Out: the basin of water, a cloth over its rim.
  Glyphs.define('basin', function (g) {
    const c = g.c;
    g.poly([0.06, 0.44, 0.94, 0.44, 0.74, 0.82, 0.26, 0.82], c.chalk);
    g.flat(0.14, 0.44, 0.72, 0.07, c.water);
    g.poly([0.6, 0.4, 0.8, 0.4, 0.76, 0.74, 0.64, 0.7], c.white);
    g.box(0.34, 0.82, 0.32, 0.08, c.lead);
  });

  // Bearers' Rest: the long stone where the coffin was set down.
  Glyphs.define('stone', function (g) {
    const c = g.c;
    g.box(0.08, 0.38, 0.84, 0.16, c.lead);
    g.box(0.18, 0.54, 0.14, 0.34, c.lead);
    g.box(0.68, 0.54, 0.14, 0.34, c.lead);
    g.box(0.06, 0.86, 0.88, 0.06, c.moss);
  });

  // Corpse Road: the old way, narrowing into the distance between its waymarks.
  Glyphs.define('road', function (g) {
    const c = g.c;
    g.poly([0.4, 0.1, 0.6, 0.1, 0.94, 0.92, 0.06, 0.92], c.loam);
    g.line(0.5, 0.2, 0.5, 0.82, 0.04, c.hemp);
    g.box(0.12, 0.36, 0.1, 0.24, c.chalk);
    g.box(0.78, 0.36, 0.1, 0.24, c.chalk);
  });

  // Picture to the Wall: a frame seen from behind, turned round, on its cord.
  Glyphs.define('frame', function (g) {
    const c = g.c;
    g.line(0.3, 0.26, 0.5, 0.08, 0.035, c.hemp);
    g.line(0.5, 0.08, 0.7, 0.26, 0.035, c.hemp);
    g.box(0.14, 0.24, 0.72, 0.62, c.oak);
    g.box(0.24, 0.34, 0.52, 0.42, c.timber);
    g.line(0.26, 0.74, 0.74, 0.36, 0.04, c.oak);
  });

  // Ringers' Jug: the belfry's jug, its belly, neck and handle.
  Glyphs.define('jug', function (g) {
    const c = g.c;
    g.ring(0.72, 0.52, 0.15, 0.07, c.hemp);
    g.ball(0.46, 0.62, 0.28, c.hemp);
    g.taper(0.46, 0.14, 0.32, 0.22, 0.28, c.hemp);
    g.poly([0.3, 0.14, 0.14, 0.08, 0.3, 0.24], c.hemp);
    g.box(0.24, 0.84, 0.44, 0.06, c.oak);
  });

  // Mourning Hatband: a tall hat with its black band and the streamer hanging from it.
  Glyphs.define('hatband', function (g) {
    const c = g.c;
    g.box(0.3, 0.18, 0.4, 0.5, c.lead);
    g.box(0.3, 0.52, 0.4, 0.12, c.dark);
    g.poly([0.66, 0.6, 0.78, 0.6, 0.86, 0.94, 0.74, 0.9], c.dark);
    g.box(0.1, 0.66, 0.8, 0.09, c.lead);
  });

  // Crape on the Door: the door of the house, hung with a black bow.
  Glyphs.define('crape', function (g) {
    const c = g.c;
    g.box(0.22, 0.08, 0.56, 0.86, c.oak);
    g.box(0.3, 0.5, 0.4, 0.34, c.timber);
    g.poly([0.5, 0.22, 0.28, 0.12, 0.28, 0.36], c.soot);
    g.poly([0.5, 0.22, 0.72, 0.12, 0.72, 0.36], c.soot);
    g.poly([0.46, 0.24, 0.36, 0.56, 0.44, 0.54], c.soot);
    g.poly([0.54, 0.24, 0.64, 0.56, 0.56, 0.54], c.soot);
  });

  // Glove Money: the bearers' glove, and the coin paid for it.
  Glyphs.define('gloves', function (g) {
    const c = g.c;
    for (let i = 0; i < 4; i++) g.box(0.18 + i * 0.1, 0.12 + (i === 0 || i === 3 ? 0.06 : 0), 0.08, 0.32, c.chalk);
    g.poly([0.1, 0.5, 0.18, 0.36, 0.24, 0.5], c.chalk);
    g.box(0.16, 0.42, 0.42, 0.34, c.chalk);
    g.box(0.18, 0.74, 0.38, 0.14, c.lead);
    g.ball(0.74, 0.7, 0.16, c.gold);
    g.ring(0.74, 0.7, 0.08, 0.03, c.bronzeDim);
  });

  // Open Window: the casement swung out to let the soul go.
  Glyphs.define('window', function (g) {
    const c = g.c;
    g.box(0.12, 0.12, 0.58, 0.78, c.oak);
    g.box(0.2, 0.2, 0.42, 0.62, c.soot);
    g.poly([0.62, 0.2, 0.92, 0.1, 0.92, 0.92, 0.62, 0.82], c.verdigrisLit);
    g.line(0.77, 0.16, 0.77, 0.87, 0.035, c.oak);
  });

  // The Bidder's Round: a door, and the knocker at it.
  Glyphs.define('door', function (g) {
    const c = g.c;
    g.box(0.24, 0.08, 0.52, 0.86, c.oak);
    g.line(0.5, 0.12, 0.5, 0.9, 0.03, c.timber);
    g.ring(0.5, 0.44, 0.1, 0.05, c.bronze);
    g.line(0.84, 0.36, 0.94, 0.32, 0.04, c.bone);
    g.line(0.84, 0.48, 0.96, 0.48, 0.04, c.bone);
  });

  // Bellman's Walk: the hand-bell he carries before the coffin.
  Glyphs.define('handbell', function (g) {
    const c = g.c;
    g.cyl(0.5, 0.04, 0.16, 0.32, c.oak);
    g.bell(0.5, 0.32, 0.66, 0.54, c.bronze, false);
    g.dot(0.5, 0.9, 0.06, c.dark);
  });

  // Worn Sally: the striped grip of the bell-rope, worn soft.
  Glyphs.define('sally', function (g) {
    const c = g.c;
    g.line(0.5, 0.02, 0.5, 0.98, 0.07, c.hemp);
    const stripes = [c.red, c.white, c.blue, c.red, c.white];
    for (let i = 0; i < stripes.length; i++) g.box(0.33, 0.18 + i * 0.12, 0.34, 0.12, stripes[i]);
  });

  // Stay and Slider: the bell resting mouth-up, held by its stay against the slider.
  Glyphs.define('stay', function (g) {
    const c = g.c;
    g.box(0.66, 0.12, 0.28, 0.07, c.timber);
    g.line(0.44, 0.66, 0.8, 0.2, 0.07, c.oak);
    g.bell(0.36, 0.2, 0.56, 0.44, c.bronze, true);
    g.box(0.12, 0.62, 0.48, 0.08, c.timber);
  });

  // Walking Mourners: the living walking close behind, upright, in a line.
  Glyphs.define('mourners', function (g) {
    const c = g.c;
    for (let i = 0; i < 3; i++) {
      const x = 0.2 + i * 0.3;
      g.box(x - 0.1, 0.4 + i * 0.04, 0.2, 0.34, c.slate);
      g.box(x - 0.08, 0.74 + i * 0.04, 0.06, 0.14 - i * 0.04, c.slate);
      g.box(x + 0.02, 0.74 + i * 0.04, 0.06, 0.14 - i * 0.04, c.slate);
      g.ball(x, 0.28 + i * 0.04, 0.09, c.boneDim);
    }
  });

  // Heavy Coffin: the long box, with its handles.
  Glyphs.define('coffin', function (g) {
    const c = g.c;
    g.poly([0.38, 0.04, 0.62, 0.04, 0.76, 0.26, 0.66, 0.96, 0.34, 0.96, 0.24, 0.26], c.oak);
    g.line(0.36, 0.3, 0.64, 0.3, 0.04, c.timber);
    g.dot(0.24, 0.5, 0.05, c.bronze);
    g.dot(0.72, 0.5, 0.05, c.bronze);
  });

  // Hearse House: the shelter by the churchyard gate, its door open.
  Glyphs.define('roof', function (g) {
    const c = g.c;
    g.box(0.18, 0.46, 0.64, 0.44, c.chalk);
    g.poly([0.04, 0.52, 0.5, 0.1, 0.96, 0.52, 0.86, 0.56, 0.14, 0.56], c.oak);
    g.box(0.38, 0.62, 0.24, 0.28, c.soot);
  });

  // Muffle the Toll: a bell with the leather muffle strapped to one side of its clapper.
  Glyphs.define('muffle', function (g) {
    const c = g.c;
    g.box(0.44, 0.04, 0.12, 0.08, c.timber);
    g.bell(0.5, 0.1, 0.8, 0.66, c.bronze, false);
    g.box(0.36, 0.7, 0.14, 0.22, c.loam);
    g.dot(0.56, 0.84, 0.07, c.dark);
    g.line(0.28, 0.78, 0.66, 0.78, 0.04, c.hemp);
  });

  // Pass the Gate: the round stone arch of a gate left unrung.
  Glyphs.define('arch', function (g) {
    const c = g.c;
    g.ball(0.5, 0.42, 0.34, c.lead);
    g.box(0.16, 0.42, 0.68, 0.5, c.lead);
    g.ball(0.5, 0.46, 0.18, c.soot);
    g.box(0.32, 0.46, 0.36, 0.46, c.soot);
    g.box(0.06, 0.9, 0.88, 0.06, c.loam);
  });

  // Coins on Your Own Eyes: two bright coins, laid where the eyes would be.
  Glyphs.define('coins', function (g) {
    const c = g.c;
    g.ball(0.5, 0.52, 0.42, c.boneDim);
    g.ball(0.3, 0.46, 0.15, c.gold);
    g.ball(0.7, 0.46, 0.15, c.gold);
    g.dot(0.26, 0.42, 0.04, c.bronzeLit);
    g.dot(0.66, 0.42, 0.04, c.bronzeLit);
  });

  // Nail in the Candle: a nail driven through the candle; when the flame burns down to it, it drops.
  Glyphs.define('nail', function (g) {
    const c = g.c;
    g.cyl(0.5, 0.3, 0.3, 0.62, c.chalk);
    g.cone(0.5, 0.04, 0.16, 0.24, c.lamp);
    g.line(0.2, 0.6, 0.86, 0.6, 0.06, c.lead);
    g.box(0.14, 0.52, 0.06, 0.16, c.lead);
  });

  // Ring Your Own Passing Bell: a bell swung up on its rope, and its strokes beside it.
  Glyphs.define('passing-bell', function (g) {
    const c = g.c;
    g.turned(0.42, 0.44, -0.5, function () { g.bell(0.42, 0.16, 0.56, 0.5, c.bronze, false); });
    g.line(0.6, 0.62, 0.62, 0.96, 0.05, c.hemp);
    for (let i = 0; i < 3; i++) g.box(0.76 + i * 0.07, 0.62, 0.04, 0.22, c.bone);
  });
})();
