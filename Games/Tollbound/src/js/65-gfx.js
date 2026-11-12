// 65-gfx.js: the list of views, and what every view shares: the instance records, and the way between the
// world and the screen. The views themselves register from their own files, which load after this one:
// 66-gfx-gl.js (the 3D view, 'gl') and 67-gfx-2d.js (the plain view, '2d').
// Owns: Gfx
// Public:
//   Gfx.register(name, factory, isSupported)   adds a view, while its file loads. factory(canvas) -> backend;
//                                              isSupported() -> boolean and must leave the game's canvas alone.
//   Gfx.backends                               name -> factory of every registered view
//   Gfx.create(canvas, prefer) -> backend      the view called prefer ('gl' when left out) if it is registered,
//                                              supported and starts; otherwise the next one that does: the
//                                              other views in the order they registered, the plain view '2d'
//                                              always last. The backend made last is the active one. Use
//                                              backend.canvas from then on: after a view failed to start, it is
//                                              a fresh canvas that took the place of the one passed in.
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
// The records of b.parts and b.lights belong to the 3D view, the only one that reads those buffers: it gives
// their strides when it is written.
//
// A backend is what docs/engine.md calls the renderer contract: name, canvas, caps, stats, resize, quality,
// begin, parts, decals, discs, billboards, lights, end, worldToScreen(x, y, z, out), screenToWorld(sx, sy, out).
// In every view +x of the world runs to the right of the screen and +y towards the viewer, down the screen.
(function () {
  'use strict';

  const PLAIN = '2d';                         // the view every browser can show: tried last, whatever the order

  Gfx.DISC_STRIDE = 7;
  Gfx.DECAL_STRIDE = 8;
  Gfx.BILLBOARD_STRIDE = 9;

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
    for (let i = 0; i < order.length; i++) {
      if (order[i] !== PLAIN && names.indexOf(order[i]) < 0) names.push(order[i]);
    }
    if (names.indexOf(PLAIN) < 0) names.push(PLAIN);
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
})();
