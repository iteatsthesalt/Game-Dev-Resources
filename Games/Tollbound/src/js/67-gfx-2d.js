// 67-gfx-2d.js: the plain 2D view: the ground seen from straight above, drawn with discs.
// A browser without WebGL2 gets this view, and it is a debugging aid: ?view=2d asks for it.
// Owns: Gfx (it adds nothing to the namespace: it registers the view '2d' with Gfx.register of 65-gfx.js)
// Public: the view '2d'. Gfx.create(canvas, '2d'), or Gfx.backends['2d'](canvas), gives its backend, after the
// renderer contract of docs/engine.md. The instance records it reads are laid out in 65-gfx.js.
//   b.name = '2d'   b.canvas   b.caps = {puppets: false, shadows: false, lights: false, bloom: false, maxInstances}
//   b.stats = {drawCalls, instances}     counted from begin() to end()
//   b.resize(cssW, cssH, dpr)            the canvas shows cssW by cssH CSS pixels, with dpr device pixels to each
//   b.quality('high'|'medium'|'low')     caps the device pixels to a CSS pixel at 2, 1.5 and 1
//   b.begin(cam, env)                    cam {x, y, zoom}: the ground point at the centre of the canvas, and a
//                                        factor on the scale. At zoom 1 the longer side shows 30 metres of ground.
//                                        env {ground: [r, g, b]}: the ground colour; the rest of env is not
//                                        used, and env may be null. Paints the ground with a line every 2 metres.
//   b.decals(buffer, count)              the marks on the ground, as 65-gfx.js lays the record out: discs, rings,
//                                        sectors and bars, each its rim and its fill in its colour and alpha; lee
//                                        records (shape 4) are not drawn, and a cut decal (8 added) is painted on a
//                                        layer of its own with the lee of every lee record of the frame (seen from
//                                        its x, y) taken out, then laid on the ground
//   b.discs(buffer, count)               filled discs with a thin dark rim
//   b.billboards(buffer, count)          squares; a metre of height moves one half a metre up the screen
//   b.parts(shape, buffer, count), b.lights(buffer, count)   do nothing: no solid shapes and no lights here
//   b.end(post)                          post {flash, vignette, grey}, each 0 to 1: flash whitens the frame, vignette
//                                        darkens its corners, grey takes the colour out of it. post may be null.
//   b.worldToScreen(x, y, z, out), b.screenToWorld(sx, sy, out)   what the two Gfx functions call; out is needed
//   This view paints at once and in the order of the calls, so: decals, then discs, then billboards. The lee
//   records a cut decal takes are those of the frame's decals() calls up to and including the one it is in.
//   +x of the world runs right and +y runs down the screen.
(function () {
  'use strict';

  const TAU = Core.TAU;
  const GROUND_SPAN = 30;   // metres of ground along the longer side of the canvas, at zoom 1
  const GRID = 2;           // metres between ground lines; every fifth line is a little stronger
  const LIFT = 0.5;         // metres up the screen for a metre of height
  const GROUND = [0.043, 0.051, 0.075];
  const RIM = 'rgba(0, 0, 0, 0.55)', RIM_FROM = 3;   // a disc gets its dark rim from this radius on, in CSS pixels
  const DISC = 0, RING = 1, SECTOR = 2, BAR = 3, LEE = 4, CUT = 8;   // the shapes of a decal (65-gfx.js)
  const LEES = 64, LEE_RAYS = 10;                    // lee records a frame; lines across each one's lee
  const RIM_LEAST = 2;      // CSS pixels: a decal's rim is 3% of its radius, at most 0.12 m, and never thinner than this

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
    const lee = new Float64Array(LEES * 4);      // this frame's lee records: x, y, radius, reach (metres)
    let leeN = 0, layer = null, lctx = null;     // the layer a cut decal is painted on, made when first needed

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
      leeN = 0;
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

    // The shape of decal record o, painted on c with its centre at (sx, sy) in CSS pixels: its filled part, then
    // its rim (a disc is all fill). r is its radius in CSS pixels.
    function paint(c, buffer, o, shape, sx, sy, r) {
      const fill = buffer[o + 7] >= 1 ? 1 : buffer[o + 7] <= -1 ? -1 : buffer[o + 7] || 0, angle = buffer[o + 9] || 0, arc = buffer[o + 10] || 0;
      const from = fill < 0 ? r * (1 + fill) : 0, to = fill > 0 ? r * fill : fill < 0 ? r : 0;
      c.lineWidth = Math.max(RIM_LEAST, Math.min(0.03 * r, 0.12 * ppm));
      if (shape === DISC) {
        c.beginPath();
        c.arc(sx, sy, r, 0, TAU);
        c.fill();
        stats.drawCalls++;
        return;
      }
      if (shape === BAR) {
        const ux = Math.cos(angle), uy = Math.sin(angle), w = arc * ppm / 2;
        if (to > from) { bar(c, sx, sy, ux, uy, from, to, w); c.fill(); stats.drawCalls++; }
        bar(c, sx, sy, ux, uy, 0, r, w);
        c.stroke();
        stats.drawCalls++;
        return;
      }
      const a0 = shape === SECTOR ? angle - arc / 2 : 0, a1 = shape === SECTOR ? angle + arc / 2 : TAU;
      if (to > from) {
        c.beginPath();
        if (shape === SECTOR && from <= 0) c.moveTo(sx, sy);
        c.arc(sx, sy, to, a0, a1);
        if (from > 0) c.arc(sx, sy, from, a1, a0, true);
        c.closePath();
        c.fill();
        stats.drawCalls++;
      }
      c.beginPath();
      if (shape === SECTOR) c.moveTo(sx, sy);
      c.arc(sx, sy, r, a0, a1);
      if (shape === SECTOR) c.closePath();
      c.stroke();
      stats.drawCalls++;
    }

    // A path round the part of a bar from `from` to `to` CSS pixels along (ux, uy), w pixels each side.
    function bar(c, sx, sy, ux, uy, from, to, w) {
      c.beginPath();
      c.moveTo(sx + ux * from - uy * w, sy + uy * from + ux * w);
      c.lineTo(sx + ux * to - uy * w, sy + uy * to + ux * w);
      c.lineTo(sx + ux * to + uy * w, sy + uy * to - ux * w);
      c.lineTo(sx + ux * from + uy * w, sy + uy * from - ux * w);
      c.closePath();
    }

    // Takes out of the layer the lee of every lee record, as seen from the world point (x, y), by the rule of
    // Dmg.inLee: along each line from there that meets a record's circle, from where the circle's centre lies
    // across the line, out to the far side of the circle and the record's reach beyond. Drawn as LEE_RAYS lines
    // across the circle, joined.
    function takeLee(x, y) {
      const halfW = cssW / 2, halfH = cssH / 2, sx = (x - camX) * ppm + halfW, sy = (y - camY) * ppm + halfH;
      lctx.globalCompositeOperation = 'destination-out';
      lctx.globalAlpha = 1;
      for (let i = 0; i < leeN; i++) {
        const cx = lee[i * 4], cy = lee[i * 4 + 1], rho = lee[i * 4 + 2], reach = lee[i * 4 + 3];
        const dx = cx - x, dy = cy - y, d = Math.sqrt(dx * dx + dy * dy);
        if (!(d > rho)) continue;
        const beta = Math.atan2(dy, dx), half = Math.asin(rho / d);
        lctx.beginPath();
        // the near edge: where each line passes closest to the centre, from one side of the circle to the other
        for (let k = 0; k <= LEE_RAYS; k++) {
          const a = beta - half + 2 * half * k / LEE_RAYS, s = Math.cos(a - beta) * d;
          const px = sx + Math.cos(a) * s * ppm, py = sy + Math.sin(a) * s * ppm;
          if (k === 0) lctx.moveTo(px, py); else lctx.lineTo(px, py);
        }
        // the far edge: beyond the circle by the reach, back again
        for (let k = LEE_RAYS; k >= 0; k--) {
          const a = beta - half + 2 * half * k / LEE_RAYS, s = Math.cos(a - beta) * d, h = Math.sin(a - beta) * d;
          const out = s + Math.sqrt(Math.max(0, rho * rho - h * h)) + reach;
          lctx.lineTo(sx + Math.cos(a) * out * ppm, sy + Math.sin(a) * out * ppm);
        }
        lctx.closePath();
        lctx.fill();
      }
      lctx.globalCompositeOperation = 'source-over';
    }

    function decals(buffer, count) {
      const stride = Gfx.DECAL_STRIDE, halfW = cssW / 2, halfH = cssH / 2, wide = stride >= 11;
      // the lee records first: a cut decal takes every one of the frame, wherever it stands in the buffer
      for (let i = 0, o = 0; wide && i < count && leeN < LEES; i++, o += stride) {
        if (Math.round(buffer[o + 8]) !== LEE) continue;
        const k = leeN++ * 4;
        lee[k] = buffer[o]; lee[k + 1] = buffer[o + 1]; lee[k + 2] = buffer[o + 2]; lee[k + 3] = buffer[o + 10];
      }
      let key = -1;
      for (let i = 0, o = 0; i < count; i++, o += stride) {
        const code = wide ? Math.round(buffer[o + 8]) : RING, cut = code >= CUT, shape = cut ? code - CUT : code;
        if (shape < DISC || shape > BAR) continue;
        const reach = shape === BAR ? Math.hypot(buffer[o + 2], buffer[o + 10] / 2) : buffer[o + 2];
        const r = buffer[o + 2] * ppm, R = reach * ppm;
        const sx = (buffer[o] - camX) * ppm + halfW, sy = (buffer[o + 1] - camY) * ppm + halfH;
        if (!(r > 0) || sx + R < 0 || sx - R > cssW || sy + R < 0 || sy - R > cssH) continue;
        const k = pack(buffer[o + 3], buffer[o + 4], buffer[o + 5]), a = unit(buffer[o + 6]);
        if (cut && leeN > 0) {
          // painted on its own layer, the lee taken out, then laid down over the box it covers
          if (layer === null) {
            layer = document.createElement('canvas');
            lctx = layer.getContext('2d');
          }
          if (layer.width !== canvas.width || layer.height !== canvas.height) { layer.width = canvas.width; layer.height = canvas.height; }
          const kx = canvas.width / cssW, ky = canvas.height / cssH;
          const x0 = Math.max(0, Math.floor(sx - R - 2)), y0 = Math.max(0, Math.floor(sy - R - 2));
          const x1 = Math.min(cssW, Math.ceil(sx + R + 2)), y1 = Math.min(cssH, Math.ceil(sy + R + 2));
          if (x1 <= x0 || y1 <= y0) continue;
          lctx.setTransform(kx, 0, 0, ky, 0, 0);
          lctx.clearRect(x0, y0, x1 - x0, y1 - y0);
          lctx.globalAlpha = a;
          lctx.fillStyle = lctx.strokeStyle = cssOf(k);
          paint(lctx, buffer, o, shape, sx, sy, r);
          takeLee(buffer[o], buffer[o + 1]);
          ctx.drawImage(layer, x0 * kx, y0 * ky, (x1 - x0) * kx, (y1 - y0) * ky, x0, y0, x1 - x0, y1 - y0);
          stats.drawCalls++;
          stats.instances++;
          key = -1;
          continue;
        }
        if (k !== key) {
          key = k;
          ctx.fillStyle = ctx.strokeStyle = cssOf(k);
        }
        ctx.globalAlpha = a;
        paint(ctx, buffer, o, shape, sx, sy, r);
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
      if (post.grey > 0) {   // a grey of no colour laid on in 'saturation' takes the colour out of what is under it
        ctx.globalCompositeOperation = 'saturation';
        ctx.globalAlpha = unit(post.grey);
        ctx.fillStyle = cssOf(0x808080);
        ctx.fillRect(0, 0, cssW, cssH);
        ctx.globalCompositeOperation = 'source-over';
        stats.drawCalls++;
      }
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
