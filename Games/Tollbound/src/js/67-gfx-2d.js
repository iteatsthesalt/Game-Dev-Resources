// 67-gfx-2d.js: the list of views, and the plain 2D view: the ground seen from straight above, drawn with discs.
// A browser without WebGL2 gets this view, and it is a debugging aid: ?view=2d asks for it.
// Owns: Gfx
// Public:
//   Gfx.register(name, factory, isSupported)   adds a view. factory(canvas) -> backend; isSupported() -> boolean
//                                              and must leave the game's canvas alone. A file that registers a
//                                              view has to load after this one: 67-gfx-gl.js does, 66-gfx-gl.js
//                                              would not.
//   Gfx.backends                               name -> factory of every registered view. '2d' is always there.
//   Gfx.create(canvas, prefer) -> backend      the view called prefer ('gl' when left out) if it is registered,
//                                              supported and starts; otherwise the next one that does, '2d' last.
//                                              The backend made last is the active one. Use backend.canvas from
//                                              then on: after a view failed to start, it is a fresh canvas that
//                                              took the place of the one passed in.
//   Gfx.active                                 the active backend, or null before Gfx.create. A value.
//   Gfx.worldToScreen(x, y, z, out) -> {x, y}  where the active view draws a point of the world, in CSS pixels
//                                              from the top left corner of the canvas. z is the height above the
//                                              ground and may be left out.
//   Gfx.screenToWorld(sx, sy, out) -> {x, y}   the point of the ground under a point of the canvas
//     Both use the camera of the last begin(). out may be left out: they then fill and return one shared
//     object, so copy what you keep. Both return null before Gfx.create.
//
// Instance buffers are Float32Arrays of whole records, and count is a number of records:
//   Gfx.DISC_STRIDE = 7        x, y, radius, red, green, blue, alpha
//   Gfx.DECAL_STRIDE = 8       x, y, radius, red, green, blue, alpha, fill
//   Gfx.BILLBOARD_STRIDE = 9   x, y, z, size, red, green, blue, alpha, glow
//   x, y, z, radius and size are metres; colours and alpha run from 0 to 1.
//   fill   how much of a decal's radius is filled in, 0 to 1: a telegraph can fill up as its attack comes
//   glow   above 0.5 the billboard adds its light to what is behind it; otherwise it covers it
// The strides of b.parts and b.lights belong to the 3D view, the only one that reads those buffers.
//
// The backend made here, after the renderer contract of docs/engine.md:
//   b.name = '2d'   b.canvas   b.caps = {puppets: false, shadows: false, lights: false, bloom: false, maxInstances}
//   b.stats = {drawCalls, instances}     counted from begin() to end()
//   b.resize(cssW, cssH, dpr)            the canvas shows cssW by cssH CSS pixels, with dpr device pixels to each
//   b.quality('high'|'medium'|'low')     caps the device pixels to a CSS pixel at 2, 1.5 and 1
//   b.begin(cam, env)                    cam {x, y, zoom}: the ground point at the centre of the canvas, and a
//                                        factor on the scale. At zoom 1 the longer side shows 30 metres of ground.
//                                        env {ground: [r, g, b]}: the ground colour; the rest of env is not
//                                        used, and env may be null. Paints the ground with a line every 2 metres.
//   b.decals(buffer, count)              rings on the ground, each filled in faintly as far as its fill says
//   b.discs(buffer, count)               filled discs with a thin dark rim
//   b.billboards(buffer, count)          squares; a metre of height moves one half a metre up the screen
//   b.parts(shape, buffer, count), b.lights(buffer, count)   do nothing: no solid shapes and no lights here
//   b.end(post)                          post {flash, vignette}, each 0 to 1: flash whitens the frame, vignette
//                                        darkens its corners. post may be null.
//   b.worldToScreen(x, y, z, out), b.screenToWorld(sx, sy, out)   what the two Gfx functions call; out is needed
//   This view paints at once and in the order of the calls, so: decals, then discs, then billboards.
//   +x of the world runs right and +y runs down the screen.
(function () {
  'use strict';

  const TAU = Core.TAU;
  const GROUND_SPAN = 30;   // metres of ground along the longer side of the canvas, at zoom 1
  const GRID = 2;           // metres between ground lines; every fifth line is a little stronger
  const LIFT = 0.5;         // metres up the screen for a metre of height
  const GROUND = [0.043, 0.051, 0.075];
  const RIM = 'rgba(0, 0, 0, 0.55)', RIM_FROM = 3;   // a disc gets its dark rim from this radius on, in CSS pixels
  const FILL_ALPHA = 0.3;                            // the filled part of a decal, against its ring

  Gfx.DISC_STRIDE = 7;
  Gfx.DECAL_STRIDE = 8;
  Gfx.BILLBOARD_STRIDE = 9;

  // ---- the list of views ----

  const supportTests = Object.create(null);   // name -> isSupported, or null
  const order = [];                           // the names, in the order they registered
  const shared = { x: 0, y: 0 };
  let active = null;

  Gfx.backends = Object.create(null);   // no inherited names: ?view=constructor must not find a "view"

  Gfx.register = function (name, factory, isSupported) {
    Core.assert(typeof name === 'string' && typeof factory === 'function', 'Gfx.register needs a name and a factory');
    Core.assert(!Gfx.backends[name], 'Gfx.register: the view "' + name + '" is already registered');
    Gfx.backends[name] = factory;
    supportTests[name] = typeof isSupported === 'function' ? isSupported : null;
    order.push(name);
  };

  function usable(name) {
    if (!Gfx.backends[name]) return false;
    try {
      return !supportTests[name] || !!supportTests[name]();
    } catch (e) {
      return false;
    }
  }

  Gfx.create = function (canvas, prefer) {
    const names = [prefer || 'gl'];
    for (let i = order.length - 1; i >= 0; i--) {   // the latest registered first, so the plain view comes last
      if (names.indexOf(order[i]) < 0) names.push(order[i]);
    }
    let failure = null;
    for (let i = 0; i < names.length; i++) {
      if (!usable(names[i])) continue;
      try {
        active = Gfx.backends[names[i]](canvas);
        return active;
      } catch (err) {
        failure = err;
        console.warn('Gfx: the "' + names[i] + '" view did not start; trying the next.', err);
        // A canvas that has given out one kind of context gives no other kind: go on with a fresh one in its place.
        const fresh = canvas.cloneNode(false);
        if (canvas.parentNode) canvas.parentNode.replaceChild(fresh, canvas);
        canvas = fresh;
      }
    }
    throw failure || new Error('Gfx.create: no view can be used');
  };

  Object.defineProperty(Gfx, 'active', { enumerable: true, get: function () { return active; } });

  Gfx.worldToScreen = function (x, y, z, out) {
    return active ? active.worldToScreen(x, y, z || 0, out || shared) : null;
  };
  Gfx.screenToWorld = function (sx, sy, out) {
    return active ? active.screenToWorld(sx, sy, out || shared) : null;
  };

  // ---- the plain view ----

  // A colour channel from 0..1 to 0..255. Anything that is not a number counts as 0.
  function channel(v) { return v >= 1 ? 255 : v > 0 ? (v * 255 + 0.5) | 0 : 0; }
  function pack(r, g, b) { return (channel(r) << 16) | (channel(g) << 8) | channel(b); }
  function unit(v) { return v >= 1 ? 1 : v > 0 ? v : 0; }

  function make2d(canvas) {
    const ctx = canvas.getContext('2d', { alpha: false });
    Core.assert(ctx, 'the canvas gives no 2d context');

    const caps = { puppets: false, shadows: false, lights: false, bloom: false, maxInstances: 8192 };
    const stats = { drawCalls: 0, instances: 0 };
    const colours = new Map();   // packed colour -> its CSS text, so that drawing builds no strings
    let cssW = 1, cssH = 1, dpr = 1, cap = 2;    // cap: the most device pixels to a CSS pixel, set by quality()
    let camX = 0, camY = 0, zoom = 1, ppm = 1;   // the camera of the last begin(); ppm is CSS pixels to a metre
    let vignette = null;                         // the gradient for end(), made when first needed at this size

    function cssOf(key) {
      let text = colours.get(key);
      if (text === undefined) {
        if (colours.size >= 4096) colours.clear();
        text = '#' + (0x1000000 + key).toString(16).slice(1);
        colours.set(key, text);
      }
      return text;
    }

    function fit() {
      const ratio = Math.min(dpr, cap);
      const w = Math.max(1, Math.round(cssW * ratio)), h = Math.max(1, Math.round(cssH * ratio));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      ppm = Math.max(cssW, cssH) / GROUND_SPAN * zoom;
      vignette = null;
    }

    // Ground lines every step metres, as thin rectangles: they stay sharp at any pixel ratio.
    function lines(step, key) {
      const gap = step * ppm;
      if (gap < 6) return;   // too dense to help
      ctx.beginPath();
      const left = camX - cssW / 2 / ppm, top = camY - cssH / 2 / ppm;
      for (let sx = (Math.ceil(left / step) * step - left) * ppm; sx < cssW; sx += gap) ctx.rect(Math.round(sx), 0, 1, cssH);
      for (let sy = (Math.ceil(top / step) * step - top) * ppm; sy < cssH; sy += gap) ctx.rect(0, Math.round(sy), cssW, 1);
      ctx.fillStyle = cssOf(key);
      ctx.fill();
      stats.drawCalls++;
    }

    function begin(cam, env) {
      stats.drawCalls = 0;
      stats.instances = 0;
      camX = cam ? +cam.x || 0 : 0;
      camY = cam ? +cam.y || 0 : 0;
      zoom = cam && cam.zoom > 0 ? cam.zoom : 1;
      ppm = Math.max(cssW, cssH) / GROUND_SPAN * zoom;
      ctx.setTransform(canvas.width / cssW, 0, 0, canvas.height / cssH, 0, 0);   // from here on, CSS pixels
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      const g = env && env.ground && env.ground.length >= 3 ? env.ground : GROUND;
      ctx.fillStyle = cssOf(pack(g[0], g[1], g[2]));
      ctx.fillRect(0, 0, cssW, cssH);
      stats.drawCalls++;
      lines(GRID, pack(g[0] + 0.03, g[1] + 0.035, g[2] + 0.05));
      lines(GRID * 5, pack(g[0] + 0.07, g[1] + 0.08, g[2] + 0.11));
    }

    // Each disc is a path of its own: a lone circle is the canvas's quick case, and measured faster than a
    // crowd gathered into one path. The colour is set only when it changes.
    function discs(buffer, count) {
      const stride = Gfx.DISC_STRIDE, halfW = cssW / 2, halfH = cssH / 2;
      let key = -1, alpha = -1;
      ctx.lineWidth = 1;
      ctx.strokeStyle = RIM;
      for (let i = 0, o = 0; i < count; i++, o += stride) {
        const r = buffer[o + 2] * ppm;
        const sx = (buffer[o] - camX) * ppm + halfW, sy = (buffer[o + 1] - camY) * ppm + halfH;
        if (!(r > 0) || sx + r < 0 || sx - r > cssW || sy + r < 0 || sy - r > cssH) continue;
        const k = pack(buffer[o + 3], buffer[o + 4], buffer[o + 5]), a = unit(buffer[o + 6]);
        if (k !== key) {
          key = k;
          ctx.fillStyle = cssOf(k);
        }
        if (a !== alpha) {
          alpha = a;
          ctx.globalAlpha = a;
        }
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, TAU);
        ctx.fill();
        stats.drawCalls++;
        if (r >= RIM_FROM) {
          ctx.stroke();
          stats.drawCalls++;
        }
        stats.instances++;
      }
      ctx.globalAlpha = 1;
    }

    function decals(buffer, count) {
      const stride = Gfx.DECAL_STRIDE, halfW = cssW / 2, halfH = cssH / 2;
      let key = -1;
      ctx.lineWidth = 2;
      for (let i = 0, o = 0; i < count; i++, o += stride) {
        const r = buffer[o + 2] * ppm;
        const sx = (buffer[o] - camX) * ppm + halfW, sy = (buffer[o + 1] - camY) * ppm + halfH;
        if (!(r > 0) || sx + r < 0 || sx - r > cssW || sy + r < 0 || sy - r > cssH) continue;
        const k = pack(buffer[o + 3], buffer[o + 4], buffer[o + 5]), a = unit(buffer[o + 6]), inner = r * unit(buffer[o + 7]);
        if (k !== key) {
          key = k;
          ctx.fillStyle = ctx.strokeStyle = cssOf(k);
        }
        if (inner > 0) {   // the part that has filled in, fainter than the ring
          ctx.globalAlpha = a * FILL_ALPHA;
          ctx.beginPath();
          ctx.arc(sx, sy, inner, 0, TAU);
          ctx.fill();
          stats.drawCalls++;
        }
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, TAU);
        ctx.stroke();
        stats.drawCalls++;
        stats.instances++;
      }
      ctx.globalAlpha = 1;
    }

    function billboards(buffer, count) {
      const stride = Gfx.BILLBOARD_STRIDE, halfW = cssW / 2, halfH = cssH / 2;
      let key = -1, alpha = -1, glow = false;
      for (let i = 0, o = 0; i < count; i++, o += stride) {
        const half = Math.max(0.5, buffer[o + 3] * ppm / 2);
        const sx = (buffer[o] - camX) * ppm + halfW, sy = (buffer[o + 1] - camY - buffer[o + 2] * LIFT) * ppm + halfH;
        if (sx + half < 0 || sx - half > cssW || sy + half < 0 || sy - half > cssH) continue;
        const k = pack(buffer[o + 4], buffer[o + 5], buffer[o + 6]), a = unit(buffer[o + 7]), lit = buffer[o + 8] > 0.5;
        if (k !== key) { key = k; ctx.fillStyle = cssOf(k); }
        if (a !== alpha) { alpha = a; ctx.globalAlpha = a; }
        if (lit !== glow) { glow = lit; ctx.globalCompositeOperation = lit ? 'lighter' : 'source-over'; }
        ctx.fillRect(sx - half, sy - half, half * 2, half * 2);
        stats.instances++;
        stats.drawCalls++;
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    function end(post) {
      if (!post) return;
      if (post.vignette > 0) {
        if (!vignette) {
          const far = Math.sqrt(cssW * cssW + cssH * cssH) / 2;
          vignette = ctx.createRadialGradient(cssW / 2, cssH / 2, far * 0.55, cssW / 2, cssH / 2, far);
          vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
          vignette.addColorStop(1, 'rgba(0, 0, 0, 0.9)');
        }
        ctx.globalAlpha = unit(post.vignette);
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, cssW, cssH);
        stats.drawCalls++;
      }
      if (post.flash > 0) {
        ctx.globalAlpha = unit(post.flash);
        ctx.fillStyle = cssOf(0xffffff);
        ctx.fillRect(0, 0, cssW, cssH);
        stats.drawCalls++;
      }
      ctx.globalAlpha = 1;
    }

    return {
      name: '2d',
      canvas: canvas,
      caps: caps,
      stats: stats,
      resize: function (w, h, pixels) {
        cssW = w > 1 ? w : 1;
        cssH = h > 1 ? h : 1;
        dpr = pixels > 0 ? pixels : 1;
        fit();
      },
      quality: function (level) {
        cap = level === 'low' ? 1 : level === 'medium' ? 1.5 : 2;
        fit();
      },
      begin: begin,
      parts: function () {},
      lights: function () {},
      decals: decals,
      discs: discs,
      billboards: billboards,
      end: end,
      worldToScreen: function (x, y, z, out) {
        out.x = (x - camX) * ppm + cssW / 2;
        out.y = (y - camY - z * LIFT) * ppm + cssH / 2;
        return out;
      },
      screenToWorld: function (sx, sy, out) {
        out.x = (sx - cssW / 2) / ppm + camX;
        out.y = (sy - cssH / 2) / ppm + camY;
        return out;
      },
    };
  }

  Gfx.register('2d', make2d, function () { return typeof CanvasRenderingContext2D !== 'undefined'; });
})();
