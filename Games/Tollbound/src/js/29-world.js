// 29-world.js: the ground a run takes place on: a seeded region with props set down on it.
// Owns: World
// Public:
//   World.region(seed, zoneDef, x?, y?) -> region
//       Builds the region of a zone around the world point (x, y); (0, 0) if left out. The same seed (a number
//       or a string) and the same zone give the same region.
//         region = {x, y, radius, startX, startY, props, grid}
//         startX, startY   where a run starts: (x, y), moved by the zone's start {x, y} if it has one
//         props   [{id, x, y, r, light, role}]: the prop def's id, its place in world coordinates, the radius of its
//                 collider (0: nothing to bump into), the def's light ({radius, color, ...}) or null, and its role
//                 (the place's role, else the def's, else null: 'bell-post', 'landmark', 'lamp-post', ...)
//         grid    a Core.Grid over props, which the functions below read
//       A zone's authored props come first: each entry of zone.place {prop, x, y, role?} stands where it says,
//       (x, y) metres from the region's middle. Then the scattered ones: a zone lists those as {prop, density},
//       density being how many stand on 100 square metres of ground. Each is put down at random with its whole
//       collider inside the region, at least World.GAP metres clear of every other collider, and outside the
//       circle of World.CLEAR metres round the start. One that finds no room in a few tries is left out, so a
//       crowded zone gets fewer than it asked for.
//   World.propsNear(S, x, y, r, out) -> count
//       Writes into out[0 .. count) the props of the run whose collider reaches within r of (x, y), that is
//       whose centre is within r + prop.r. Exact, not candidates. out is the caller's array.
//   World.withRole(S, role, out) -> count
//       Writes into out[0 .. count) the props of the run that have that role, in the order they were set down.
//   World.pushOut(S, ent) -> boolean
//       Moves ent (anything with x, y and r) out of every prop collider it overlaps, and then inside the edge
//       of the region. Returns whether it moved. Allocates nothing.
//   World.CLEAR = 8, World.GAP = 2    metres
//
// Everything here takes world coordinates, and the clear circle sits at the region's own start, not at the
// origin. A later stage can therefore keep several regions that load as the player walks: only this file reads
// S.region, and it would then look in the regions near the point asked about.
// The ground's height, the tide, its depth, bands and currents (docs/design/02-combat.md, section 15.13) arrive
// with the Ropewalk; until then every place is dry ground.
(function () {
  'use strict';

  const PI = Math.PI, sqrt = Math.sqrt, cos = Math.cos, sin = Math.sin, round = Math.round;
  const CLEAR = 8, GAP = 2;
  const TRIES = 20;              // random places tried for one prop before it is left out
  const MOST = 2000;             // props in one region at most: placing checks every prop against every other
  const CELL = 4;                // cell size of the prop grid, in metres

  World.CLEAR = CLEAR;
  World.GAP = GAP;

  function crowded(props, x, y, r) {
    for (let i = 0; i < props.length; i++) {
      const p = props[i], dx = p.x - x, dy = p.y - y, reach = p.r + r + GAP;
      if (dx * dx + dy * dy < reach * reach) return true;
    }
    return false;
  }

  function prop(def, x, y, role) {
    const own = typeof role === 'string' ? role : typeof def.role === 'string' ? def.role : null;
    return { id: def.id, x, y, r: def.radius, light: def.light === undefined ? null : def.light, role: own };
  }

  World.region = function (seed, zone, x, y) {
    const cx = x || 0, cy = y || 0, radius = zone.region.radius, rng = new Core.RNG(seed), props = [];
    const sx = cx + (zone.start ? zone.start.x : 0), sy = cy + (zone.start ? zone.start.y : 0);
    const placed = zone.place || [], wanted = zone.props || [], per100 = PI * radius * radius / 100, middle = sx === cx && sy === cy;
    for (let k = 0; k < placed.length && props.length < MOST; k++) {
      const at = placed[k];
      props.push(prop(Defs.get('prop', at.prop), cx + at.x, cy + at.y, at.role));
    }
    for (let k = 0; k < wanted.length; k++) {
      const def = Defs.get('prop', wanted[k].prop), r = def.radius, count = round(wanted[k].density * per100);
      for (let i = 0; i < count && props.length < MOST; i++) {
        for (let attempt = 0; attempt < TRIES; attempt++) {
          const d = sqrt(rng.next()) * (radius - r), a = rng.next() * Core.TAU;      // spread evenly over the disc
          const px = cx + cos(a) * d, py = cy + sin(a) * d, ex = px - sx, ey = py - sy, clear = CLEAR + r;
          if (middle ? d < clear : ex * ex + ey * ey < clear * clear) continue;
          if (crowded(props, px, py, r)) continue;
          props.push(prop(def, px, py, null));
          break;
        }
      }
    }
    const grid = new Core.Grid(CELL);             // props never move, so it is built once
    grid.rebuild({ items: props, n: props.length });
    return { x: cx, y: cy, radius, startX: sx, startY: sy, props, grid };
  };

  World.propsNear = function (S, x, y, r, out) {
    return S.region ? S.region.grid.query(x, y, r, out) : 0;
  };

  World.withRole = function (S, role, out) {
    const props = S.region ? S.region.props : null;
    let n = 0;
    for (let i = 0; props && i < props.length; i++) if (props[i].role === role) out[n++] = props[i];
    return n;
  };

  const near = [];               // scratch for pushOut

  World.pushOut = function (S, ent) {
    const region = S.region;
    if (!region) return false;
    let moved = false;
    for (let pass = 0; pass < 2; pass++) {        // a second pass, in case leaving one collider pushed it into another
      const n = region.grid.near(ent, 0, near);
      let pushed = false;
      for (let i = 0; i < n; i++) {
        const p = near[i];
        if (!(p.r > 0)) continue;
        const dx = ent.x - p.x, dy = ent.y - p.y, reach = ent.r + p.r, d2 = dx * dx + dy * dy;
        if (d2 >= reach * reach) continue;
        const d = sqrt(d2);
        if (d > 1e-9) { ent.x = p.x + dx / d * reach; ent.y = p.y + dy / d * reach; } else ent.x = p.x + reach;
        pushed = true;
      }
      if (!pushed) break;
      moved = true;
    }
    const dx = ent.x - region.x, dy = ent.y - region.y, most = region.radius - ent.r, d2 = dx * dx + dy * dy;
    if (most > 0 && d2 > most * most) {
      const d = sqrt(d2);
      ent.x = region.x + dx / d * most;
      ent.y = region.y + dy / d * most;
      moved = true;
    }
    return moved;
  };
})();
