// 27-favours.js: the row of six favours and the walk-in offers. Nothing pauses: at a run level the favours at the
// front of the row rise round the player as shapes, and the player takes one by walking into it.
// Owns: Favours
// Public:
//   Favours.step(S)                  phase 11: fills the row on the vigil's first step; when S.player.runLevel has risen
//                                    past the run levels the row has answered (and no offer stands), the favours of
//                                    places 1 to 3 (1 to 4 after an offer sank) rise as pickups of kind 3, 4 m from the
//                                    player and evenly apart, none on the way the player faces (item: the favour def,
//                                    value: its place, ttl 8 s); a shape the player's body touches is taken; and the
//                                    nails of Nail in the Candle drop
//   Favours.take(S, place) -> id | null   takes the favour at place (1 to 6) of the row as the player walking into it
//                                    does: S.favours[id] + 1, S.dirty, a 'favour' event at the player, the standing
//                                    shapes taken away, the row closed up and swapped (for tests and for gifts)
//   Favours.mods(S, out) -> out      the modifiers of every favour taken this vigil, each as many times as it was
//                                    taken, at most its maxStacks: what this file's Sim.source adds to every sheet
//
// Its slot: S.row = {ids, raised, levels, shapes, until, turn, filled, nails}: the six favour ids in their places
// (null where none could be drawn), how many places the next offer raises (3, or 4 after one sank), the run levels
// answered, the uids of the shapes standing and S.t when they sink, which pairs swap next (0: places 1-2, 3-4, 5-6;
// 1: 2-3, 4-5), whether the row has been filled, and the tolls at which the nails of Nail in the Candle drop.
// When one is taken: S.favours[id] + 1, S.dirty, the other shapes are taken away (pool.kill), the row closes up, a
// favour drawn from S.rng.offers enters at place 6, and the next offer raises 3. When none is taken in 8 s they sink
// and the next level's offer raises 4. After each offer, taken or sunk, the neighbours swap in fixed pairs, by turns.
// A favour is drawn by weight from those with weight above 0, taken fewer times than maxStacks, not already in the
// row, of no group another favour in the row belongs to, and whose requires hold: class (the run's class, cfg.class
// or the character's), runLevel (at least) and tags (some voice of the loadout carries all of them).
// Events: 'offer' (x, y the player; a = the shapes raised; b = the run level answered) and 'favour' (x, y where it was
// taken; a = its place in the row; b = the times it has now been taken; id = the favour's id).
// The turned favour whose rule lives here: nail-in-the-candle, which gives nothing when taken; at the second toll
// after, the favours at places 1 and 2 are given at once (as soon as no offer stands).
(function () {
  'use strict';

  const TAU = Core.TAU, PI = Math.PI;
  const cos = Math.cos, sin = Math.sin;
  const PLACES = 6, FIRST = 3, AFTER_SINK = 4, FROM = 4, STAND = 8, SHAPE_R = 0.5, KIND = 3, EDGE = 1.5;
  const NAIL = 'nail-in-the-candle', NAIL_TOLLS = 2;

  Sim.state('row', function () {
    return { ids: [null, null, null, null, null, null], raised: FIRST, levels: 0, shapes: [], until: 0, turn: 0, filled: false, nails: [] };
  });

  Sim.source(function (S, out) { Favours.mods(S, out); });

  Favours.mods = function (S, out) {
    for (const id in S.favours) {
      const times = S.favours[id];
      if (!(times > 0) || !Defs.has('favour', id)) continue;
      const def = Defs.get('favour', id), k = times < def.maxStacks ? times : def.maxStacks;
      for (let t = 0; t < k; t++) for (let i = 0; i < def.mods.length; i++) out.push(def.mods[i]);
    }
    return out;
  };

  // ---- drawing ----

  const choice = [];                               // scratch for one draw: emptied before every use

  function classOf(S) {
    if (typeof S.cfg.class === 'string') return S.cfg.class;
    return S.cfg.char && typeof S.cfg.char.class === 'string' ? S.cfg.char.class : null;
  }

  function loadoutHas(S, tags) {
    for (let i = 0; i < S.skills.length; i++) {
      const inst = S.skills[i].inst;
      if (inst === null || !Defs.has('voice', inst.id)) continue;
      const own = Defs.get('voice', inst.id).tags;
      let all = true;
      for (let j = 0; j < tags.length && all; j++) all = own.includes(tags[j]);
      if (all) return true;
    }
    return false;
  }

  function eligible(S, row, def) {
    if (!(def.weight > 0) || (S.favours[def.id] || 0) >= def.maxStacks) return false;
    for (let k = 0; k < PLACES; k++) {
      const id = row.ids[k];
      if (id === null) continue;
      if (id === def.id) return false;
      if (def.group !== undefined && Defs.get('favour', id).group === def.group) return false;
    }
    const rq = def.requires;
    if (rq.class !== undefined && rq.class !== classOf(S)) return false;
    if (rq.runLevel !== undefined && S.player.runLevel < rq.runLevel) return false;
    if (rq.tags !== undefined && rq.tags.length > 0 && !loadoutHas(S, rq.tags)) return false;
    return true;
  }

  function draw(S, row) {
    const all = Defs.all('favour');
    choice.length = 0;
    for (let i = 0; i < all.length; i++) if (eligible(S, row, all[i])) choice.push(all[i]);
    if (choice.length === 0) return null;
    const def = S.rng.offers.weighted(choice, 'weight');
    choice.length = 0;
    return def === undefined ? null : def.id;
  }

  function fill(S, row) {
    row.filled = true;
    for (let k = 0; k < PLACES; k++) if (row.ids[k] === null) row.ids[k] = draw(S, row);
  }

  // after every offer the neighbours swap in fixed pairs, by turns
  function swap(row) {
    const ids = row.ids;
    for (let k = row.turn === 0 ? 0 : 1; k + 1 < PLACES; k += 2) {
      const t = ids[k];
      ids[k] = ids[k + 1];
      ids[k + 1] = t;
    }
    row.turn = 1 - row.turn;
  }

  // ---- the shapes ----

  function standing(S, row) {
    const items = S.pickups.items;
    let n = 0;
    for (let i = 0; i < S.pickups.n; i++) {
      const o = items[i];
      if (o.alive && o.kind === KIND && row.shapes.includes(o.uid)) n++;
    }
    return n;
  }

  function takeAway(S, row) {
    const items = S.pickups.items;
    for (let i = 0; i < S.pickups.n; i++) {
      const o = items[i];
      if (o.alive && o.kind === KIND && row.shapes.includes(o.uid)) S.pickups.kill(o);
    }
    row.shapes.length = 0;
  }

  function raise(S, row) {
    const p = S.player, rg = S.region;
    row.levels++;
    let count = 0;
    for (let k = 0; k < row.raised && k < PLACES; k++) if (row.ids[k] !== null) count++;
    if (count === 0) return;
    const a0 = p.face + PI / count;                // none on the way the player faces
    let j = 0;
    for (let k = 0; k < row.raised && k < PLACES; k++) {
      if (row.ids[k] === null) continue;
      const o = S.pickups.alloc();                 // 26-director.js keeps the last few places of the pool for these
      if (o === null) break;
      const a = a0 + j * TAU / count;
      o.x = p.x + cos(a) * FROM;
      o.y = p.y + sin(a) * FROM;
      if (rg) {                                    // inside the district, and out of colliders
        const dx = o.x - rg.x, dy = o.y - rg.y, R = rg.radius - EDGE, d2 = dx * dx + dy * dy;
        if (d2 > R * R) { const d = Math.sqrt(d2); o.x = rg.x + dx / d * R; o.y = rg.y + dy / d * R; }
      }
      o.r = SHAPE_R;
      World.pushOut(S, o);
      o.px = o.x;
      o.py = o.y;
      o.kind = KIND;
      o.item = Defs.get('favour', row.ids[k]);
      o.value = k + 1;
      o.ttl = STAND;
      row.shapes.push(o.uid);
      j++;
    }
    row.until = S.t + STAND;
    Sim.emit(S, 'offer', p.x, p.y, j, row.levels);
  }

  // the favour at place (0-based) is taken
  function taken(S, row, place, x, y) {
    const id = row.ids[place];
    if (id === null) return null;
    S.favours[id] = (S.favours[id] || 0) + 1;
    S.dirty = true;
    Sim.emit(S, 'favour', x, y, place + 1, S.favours[id], id);
    takeAway(S, row);
    for (let k = place; k + 1 < PLACES; k++) row.ids[k] = row.ids[k + 1];
    row.ids[PLACES - 1] = null;
    row.ids[PLACES - 1] = draw(S, row);
    row.raised = FIRST;
    swap(row);
    if (id === NAIL) row.nails.push(S.toll + NAIL_TOLLS);
    return id;
  }

  Favours.take = function (S, place) {
    const row = S.row;
    if (!row.filled) fill(S, row);
    if (!(place >= 1 && place <= PLACES)) return null;
    return taken(S, row, place - 1, S.player.x, S.player.y);
  };

  Favours.step = function (S) {
    const row = S.row, p = S.player;
    if (!row.filled) fill(S, row);
    if (row.shapes.length > 0) {
      const items = S.pickups.items;
      for (let i = 0; i < S.pickups.n; i++) {
        const o = items[i];
        if (!o.alive || o.kind !== KIND || !row.shapes.includes(o.uid)) continue;
        const reach = p.r + o.r;
        if (p.alive && Core.dist2(o.x, o.y, p.x, p.y) <= reach * reach) {
          taken(S, row, o.value - 1, o.x, o.y);
          return;
        }
      }
      if (S.t + 1e-9 >= row.until || standing(S, row) === 0) {   // none was taken: they sink
        takeAway(S, row);
        row.raised = AFTER_SINK;
        swap(row);
      }
      return;
    }
    for (let i = 0; i < row.nails.length; i++) {
      if (row.nails[i] > S.toll) continue;
      row.nails.splice(i, 1);
      // the favours at places 1 and 2 as the nail drops: the first taken closes the row up and swaps its pairs, so
      // the second is found by its id wherever that left it
      const second = row.ids[1];
      taken(S, row, 0, p.x, p.y);
      const at = second === null ? -1 : row.ids.indexOf(second);
      if (at >= 0) taken(S, row, at, p.x, p.y);
      return;
    }
    if (p.runLevel > row.levels) raise(S, row);
  };
})();
