// 13-tree.js: the Plan's rules (docs/design/04-progression.md, "The Plan"): what a character's route on the street
// plan gives, by the six rules of the Plan (one route, doubling, beaten bounds, toll rings, the banks, straight
// miles), and what the screen of the Plan reads to show them: the head's next steps, the loops the route closes,
// the nodes they grant and the straight runs. Every function takes plain data and keeps nothing between calls.
// Owns: Tree
// Public:
//   Tree.mods(char, toll, out) -> out    the Plan's modifiers for the route char.plan.walk at toll (S.toll in a vigil;
//                                        Infinity outside one, where every ring counts), pushed onto out (a new list
//                                        when out is left out). 14-character.js calls it at every rebuild, in place
//                                        of its plain reading. By the rules, with the numbers of the plan 'main':
//                                        - every node of the walk, a doubled node twice; a lane that offers a choice
//                                          by the attribute chosen (char.plan.choice[id]: one flat point of it, and
//                                          nothing while none is chosen), any other node by its own mods
//                                        - beaten bounds: the nodes inside each loop the route closes (Tree.loops),
//                                          at loopShare percent when the loop holds loopMost or fewer, once each even
//                                          inside two loops, and never a node the route holds; a lane granted so gives
//                                          its share of a point of the first attribute it offers, since nobody chose
//                                        - toll rings: a node of ring N only from toll N - 1 (ring 1 from the start),
//                                          its values x (1 + ringGain / 100 x (N - 1))
//                                        - the banks: a flood node's modifiers also need in-water and an ebb node's
//                                          dry (added to their cond), both x (1 + bankGain / 100)
//                                        - straight miles: a held milestone x (1 + mileGain / 100 x the held nodes
//                                          beyond the mileFrom-th in the unbroken run of held nodes through it along
//                                          its street, mileMost of them at most). A node beyond the toll still counts
//                                          in a run: it is held, though it does not work yet.
//                                        Values are multiplied, a set's excepted (it is a limit, not an amount); a
//                                        modifier of a node at its printed value, with no bank, is pushed as the
//                                        node's own object, as 14-character.js's plain reading pushes it.
//   Tree.plan() -> Plan                  the plan 'main', or the design's numbers when the build has none
//   Tree.door(classId) -> nodeId | null  the door of a class: where its characters' routes begin
//   Tree.held(walk) -> {[nodeId]: n}     how many times the route holds each node (1, or 2 when doubled)
//   Tree.steps(walk) -> [nodeId]         where the next point may go: the head's links the route holds fewer than
//                                        twice. Char.allocate also wants a free point, and a lane its attribute.
//   Tree.loops(walk) -> [Loop]           the loops the route closes, in the order it closed them. Loop = {from, to,
//                                        inside: [nodeId], grants}: the step at walk[to] onto the node walk[from]
//                                        holds already closes walk[from..to]; inside lists the nodes the loop fences
//                                        on the street plan (by their x, y, the even-odd rule), held ones too but not
//                                        the loop's own; grants is true when it fences one to loopMost of them.
//   Tree.granted(walk) -> [nodeId]       the nodes beaten bounds grant: inside a loop that grants, not on the route,
//                                        each once, in the order the loops found them
//   Tree.run(walk, nodeId) -> n          the unbroken run of held nodes through a held node along its straight
//                                        street, itself counted (0 when it is not held or stands in no street)
//   Tree.from(node) -> toll              the toll of a vigil from which a node works: its ring - 1
//   Tree.factor(node, walk) -> k         what a node's printed values are multiplied by on this route, held: its
//                                        ring, its bank, and for a milestone its straight miles (counted as if it
//                                        were held, so that the screen can say what a step onto it would give)
//   Tree.give(node, attr, k, out) -> out a node's modifiers at k times their printed values, a bank's condition
//                                        added: a lane that offers a choice gives k points of attr (nothing when attr
//                                        is not one it offers), any other node its mods
//
// The node's class. A door names its class (01-defs.js), and the Plan needs a door for each of the six classes of
// 03-classes.md to be whole, though only the Change-ringer is built yet. This file lets a door name a class that is
// defined, or any of the six ids of the design (Defs.extend on the node's field class); anything else is refused.
(function () {
  'use strict';

  // the numbers of the design (04-progression.md, "Its rules"), for a build that has no plan 'main'
  const DESIGN = Object.freeze({
    id: 'main', name: 'The Plan', rings: 8, streets: 12, ringGain: 15, bankGain: 60, mileGain: 25, mileFrom: 4, mileMost: 10,
    loopMost: 12, loopShare: 50, refund: 5,
  });
  const BANKS = Object.freeze({ flood: 'in-water', ebb: 'dry' });   // where each bank's nodes work
  const CLASSES = ['change-ringer', 'verger', 'toll-gatherer', 'lamp-trimmer', 'organ-blower', 'sexton'];   // 03-classes.md
  const NONE = Object.freeze([]), NO_CHOICE = Object.freeze({});
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  Defs.extend('node', {
    class: { type: 'union', required: false, of: [{ type: 'string', required: true, ref: 'class' }, { type: 'string', required: true, enum: CLASSES }] },
  });

  Tree.plan = function () { return Defs.has('plan', 'main') ? Defs.get('plan', 'main') : DESIGN; };

  Tree.door = function (classId) {
    const nodes = Defs.all('node');
    for (let i = 0; i < nodes.length; i++) if (nodes[i].kind === 'door' && nodes[i].class === classId) return nodes[i].id;
    return null;
  };

  function walkOf(walk) { return Array.isArray(walk) ? walk : NONE; }

  Tree.held = function (walk) {
    const w = walkOf(walk), held = Object.create(null);
    for (let i = 0; i < w.length; i++) held[w[i]] = (held[w[i]] || 0) + 1;
    return held;
  };

  Tree.steps = function (walk) {
    const w = walkOf(walk), out = [];
    if (w.length === 0 || !Defs.has('node', w[w.length - 1])) return out;
    const held = Tree.held(w), links = Defs.get('node', w[w.length - 1]).links;
    for (let i = 0; i < links.length; i++) if (!(held[links[i]] >= 2) && Defs.has('node', links[i])) out.push(links[i]);
    return out;
  };

  // ---- beaten bounds ----

  // Is (x, y) inside the polygon xs, ys? The even-odd rule: a ray to the east crosses its edges an odd number of times.
  function within(x, y, xs, ys) {
    let inside = false;
    for (let a = 0, b = xs.length - 1; a < xs.length; b = a++) {
      if ((ys[a] > y) !== (ys[b] > y) && x < (xs[b] - xs[a]) * (y - ys[a]) / (ys[b] - ys[a]) + xs[a]) inside = !inside;
    }
    return inside;
  }

  // the loop walk[from..to] (walk[to] is walk[from] again): the nodes it fences
  function loop(walk, from, to, most) {
    const xs = [], ys = [], on = Object.create(null), inside = [];
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = from; i < to; i++) {
      if (!Defs.has('node', walk[i])) continue;
      const p = Defs.get('node', walk[i]);
      xs.push(p.x);
      ys.push(p.y);
      on[p.id] = true;
      if (p.x < x0) x0 = p.x;
      if (p.x > x1) x1 = p.x;
      if (p.y < y0) y0 = p.y;
      if (p.y > y1) y1 = p.y;
    }
    if (xs.length >= 3) {
      const nodes = Defs.all('node');
      for (let k = 0; k < nodes.length; k++) {
        const p = nodes[k];
        if (on[p.id] === true || p.x <= x0 || p.x >= x1 || p.y <= y0 || p.y >= y1) continue;
        if (within(p.x, p.y, xs, ys)) inside.push(p.id);
      }
    }
    return { from, to, inside, grants: inside.length > 0 && inside.length <= most };
  }

  Tree.loops = function (walk) {
    const w = walkOf(walk), out = [], at = Object.create(null), most = Tree.plan().loopMost;
    for (let j = 0; j < w.length; j++) {
      if (at[w[j]] !== undefined) out.push(loop(w, at[w[j]], j, most));
      at[w[j]] = j;
    }
    return out;
  };

  function grantedOf(walk, held) {
    const loops = Tree.loops(walk), seen = Object.create(null), out = [];
    for (let i = 0; i < loops.length; i++) {
      if (!loops[i].grants) continue;
      const inside = loops[i].inside;
      for (let k = 0; k < inside.length; k++) {
        const id = inside[k];
        if (held[id] > 0 || seen[id] === true) continue;
        seen[id] = true;
        out.push(id);
      }
    }
    return out;
  }

  Tree.granted = function (walk) { return grantedOf(walkOf(walk), Tree.held(walk)); };

  // ---- straight miles ----

  // the node of id, if it is held and stands in the street, and the run has not counted it yet; else null
  function onward(id, street, held, seen) {
    if (seen[id] === true || !(held[id] > 0) || !Defs.has('node', id)) return null;
    const p = Defs.get('node', id);
    return p.street === street ? p : null;
  }

  // the held nodes in the unbroken run along node's street through node (node held), itself counted
  function along(node, held) {
    const seen = Object.create(null);
    seen[node.id] = true;
    let count = 1;
    for (let i = 0; i < node.links.length; i++) {
      let at = onward(node.links[i], node.street, held, seen);
      while (at !== null) {
        count++;
        seen[at.id] = true;
        let next = null;
        for (let k = 0; k < at.links.length && next === null; k++) next = onward(at.links[k], node.street, held, seen);
        at = next;
      }
    }
    return count;
  }

  Tree.run = function (walk, id) {
    if (!Defs.has('node', id)) return 0;
    const node = Defs.get('node', id), held = Tree.held(walk);
    return node.street === null || !(held[id] > 0) ? 0 : along(node, held);
  };

  // the nodes beyond the mileFrom-th in its run, at most mileMost
  function miles(node, held, n) {
    const beyond = along(node, held) - n.mileFrom;
    return beyond <= 0 ? 0 : beyond < n.mileMost ? beyond : n.mileMost;
  }

  // ---- what a node gives ----

  Tree.from = function (node) { return node.ring - 1; };

  // its ring and its bank
  function base(node, n) { return (1 + n.ringGain / 100 * (node.ring - 1)) * (node.bank === null ? 1 : 1 + n.bankGain / 100); }

  Tree.factor = function (node, walk) {
    const n = Tree.plan();
    let k = base(node, n);
    if (node.kind === 'milestone' && node.street !== null) {
      const held = Tree.held(walk);
      if (!(held[node.id] > 0)) held[node.id] = 1;
      k *= 1 + n.mileGain / 100 * miles(node, held, n);
    }
    return k;
  };

  function times(v, k) {
    if (typeof v === 'number') return v * k;
    if (Array.isArray(v)) return [times(v[0], k), times(v[1], k)];
    return { a: v.a * k, b: v.b * k, curve: v.curve };   // a Scaled: both ends, so the curve keeps its shape
  }

  // a cond that also needs `also`
  function needing(cond, also) {
    if (cond === undefined) return also;
    if (typeof cond === 'string') return cond === also ? cond : [cond, also];
    return cond.indexOf(also) >= 0 ? cond : cond.concat([also]);
  }

  function at(m, k, also) {
    if (k === 1 && also === null) return m;
    const out = Object.assign({}, m);
    if (m.op !== 'set') out.value = times(m.value, k);
    if (also !== null) out.cond = needing(m.cond, also);
    return out;
  }

  Tree.give = function (node, attr, k, out) {
    const list = out || [], also = node.bank === null ? null : BANKS[node.bank];
    if (node.choice !== null) {
      if (typeof attr === 'string' && node.choice.indexOf(attr) >= 0) list.push(at({ stat: attr, op: 'flat', value: 1 }, k, also));
      return list;
    }
    for (let i = 0; i < node.mods.length; i++) list.push(at(node.mods[i], k, also));
    return list;
  };

  // ---- the Plan's modifiers ----

  Tree.mods = function (char, toll, out) {
    const list = out || [], plan = char && char.plan ? char.plan : null, walk = plan ? walkOf(plan.walk) : NONE;
    if (walk.length === 0) return list;
    const n = Tree.plan(), t = typeof toll === 'number' && toll === toll ? toll : Infinity;
    const choice = plan.choice !== null && typeof plan.choice === 'object' ? plan.choice : NO_CHOICE;
    const held = Tree.held(walk);
    for (let i = 0; i < walk.length; i++) {
      if (!Defs.has('node', walk[i])) continue;
      const node = Defs.get('node', walk[i]);
      if (node.ring - 1 > t) continue;
      let k = base(node, n);
      if (node.kind === 'milestone' && node.street !== null) k *= 1 + n.mileGain / 100 * miles(node, held, n);
      Tree.give(node, own(choice, node.id) ? choice[node.id] : null, k, list);
    }
    const granted = grantedOf(walk, held);
    for (let i = 0; i < granted.length; i++) {
      const node = Defs.get('node', granted[i]);
      if (node.ring - 1 > t) continue;
      Tree.give(node, node.choice !== null ? node.choice[0] : null, base(node, n) * n.loopShare / 100, list);
    }
    return list;
  };
})();
