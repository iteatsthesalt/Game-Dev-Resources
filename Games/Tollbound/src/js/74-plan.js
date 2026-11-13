// 74-plan.js: the screen of the Plan (docs/design/04-progression.md, "The Plan"), the Lantern's room 'plan': the
// street plan of Tollbound drawn as the map of a drowned city seen from the tower, the character's route through it
// as a line of lit lamps, and what every node gives. css/40-plan.css styles what is its own (pl-*); the rest is the
// classes of css/10-ui.css.
// Owns: (none)
// Public: no functions. It registers one screen with UI.screen:
//   'plan'   opened with {char} (Game.char when it is left out). The map: the close in the middle with the Lantern's
//            tower, the eight walls and twelve streets as roads between dark blocks tinted by the quarter of each
//            class, the alleys through the blocks, the river with its four bridges and its banks (Flood south, Ebb
//            north), the open marsh beyond the last wall; the route lit in gold, the head as a lantern, the nodes it
//            may step to next ringed, the loops it closed (the ones that grant shaded), the straight run of each held
//            milestone as a broad band along its street, and the way from the head to the chosen node dotted. Pan with one finger or the mouse, zoom with two
//            fingers, the wheel or the - and + controls; tap a node to choose it. The panel tells the chosen node:
//            its name, kind and place, whether the route holds it, doubled it or fences it, what it gives at the
//            numbers its ring, bank and straight run make, from which toll it works, and the way to it; and offers
//            what can be done: a step onto it (Char.allocate; for a lane one control for each attribute it offers),
//            or taking back the head (Char.refund, for Char.refundPrice coin from Game.save.account). After each the
//            save is written (Game.write). "What the route gives" lists the whole Plan's modifiers, summed. The
//            controls are 44 px or more; text is in rem; it reads Char.points and the coin in its header.
//            Keys and a pad: focus starts on the map, where the arrows (the d-pad) move the choice to the next node
//            that way, along a link where there is one, and Enter (the pad's lower face button) steps onto it when one
//            point does that, and else moves focus into the panel (to choose a lane's attribute, to take back the head,
//            or to anything else there); - and + zoom; Escape (the pad's back) closes it. Nothing is changed while a vigil is under way (save.away), and only through
//            Char, so the Lantern, which tells itself again when a room closes, shows what was done.
//   For tests, the map's canvas carries data-cx, data-cy and data-scale: the point of the plan at its middle and the
//   CSS pixels a unit of the plan takes, so that a scenario can find where a node is drawn; the panel carries
//   data-node, the chosen node's id.
(function () {
  'use strict';

  const h = UI.h;
  const TAU = Math.PI * 2;
  const MOST = 26, AROUND = 44;    // the closest zoom (CSS px a unit), and the units a map's shorter side shows at first
  const TAP = 9, TAP_MS = 650;      // a press that moves less than this (px) and lasts less than this is a tap
  const PICK = 30;                  // a tap chooses the nearest node within this many CSS px
  const MINUS = '−';

  // ---- words ----

  // what each stat is, the unit of a flat change of it ('' a plain number; '%' points of a percentage), and words that
  // follow whatever its tags limit it to ("harm" "of your Blows" "to the Wrong-footed")
  const STAT = {
    knee: ['Knee', ''], heel: ['Heel', ''], hand: ['Hand', ''], ear: ['Ear', ''],
    'life-max': ['greatest life', ''], 'wound-term': ['before a wound scars', ' s'], 'wound-join': ['reach of a wound to join new harm', ' m'],
    'wound-cap': ['open wounds at most', ''], 'mend-rate': ['mending', '%'], 'mend-reach': ['mending reach', ' m'],
    'mend-on-lay': ['of a wound mended by each of the dead laid in it', '%'], scarring: ['scarring', '%'], 'brace-time': ['time to Brace', ' s'],
    'stride-share': ['of top speed needed to Stride', '%'], 'lee-reach': ['lee reach', ' m'], 'turn-limit': ['turn before you are Wrong-footed', '°'],
    'wrong-foot-taken': ['harm taken while Wrong-footed', '%'], 'guard.all': ['to every guard', '%'], taken: ['harm taken', '%'],
    'move-speed': ['top speed', ' m/s'], 'shove-taken': ['how far shoves move you', '%'], 'find-weight': ['weight of each find carried', '%'],
    'find-steady': ['steadiness of each find carried', '%'], 'pickup-reach': ['pickup reach', ' m'], 'wake-lag': ['how far behind you the dead walk', ' s'],
    'wake-length': ['length of your wake', ' s'], 'heed-max': ['Heed', ''], warn: ['warning of every Swell', ' s'], 'trade-recharge': ['trade recharge', '%'],
    'heave-recharge': ['heave recharge', ' s'], 'heave-harm': ['harm of the heave', '%'], 'pull-window': ['pull window', ' s'],
    'set-time': ['time to set the bell', ' s'], 'wedge-length': ['wedge length', ' m'], 'bar-length': ['bar length', ' m'], 'lamp-burn': ['lamp burn', ' s'],
    'chest-size': ['wind-chest', ''], 'dig-rate': ['digging', ''], 'procession-cap': ['In Procession counted', ''],
    'procession-bonus': ['harm', '%', 'to the dead In Procession'], 'sound-time': ['time to Sound a large dead', ' s'], 'xp-gain': ['experience', '%'],
    'coin-find': ['coin found', '%'], 'find-chance': ['finds found', '%'], 'hum-gain': ['Hum heard', '%'], 'notch-size': ['size of notches', '%'],
    damage: ['harm', '%'], speed: ['voice speed', '%'], area: ['size of shapes', '%'], reach: ['reach', '%'], duration: ['how long what voices leave lasts', '%'],
    throws: ['thrown things', ''], pierce: ['bodies passed through', ''], 'throw-speed': ['speed of thrown things', '%'], shove: ['shove', ' m'],
    'wrong-foot': ['harm', '%', 'to the Wrong-footed'], 'cond-duration': ['how long conditions you lay last', '%'],
    'guard.blow': ['Brace guard', '%'], 'guard.drag': ['Stride guard', '%'], 'guard.swell': ['guard against Swells', '%'],
    'guard-max.blow': ['most Brace guard', '%'], 'guard-max.drag': ['most Stride guard', '%'], 'guard-max.swell': ['most guard against Swells', '%'],
    'through.blow': ['of a Brace guard pierced', '%'], 'through.drag': ['of a Stride guard pierced', '%'], 'through.swell': ['of lee pierced', '%'],
    'added.blow': ['Blow harm added', ''], 'added.drag': ['Drag harm added', ''], 'added.swell': ['Swell harm added', ''],
    'chance.coined': ['chance to Coin', '%', 'on each hit'], 'chance.sealed': ['chance to Seal', '%', 'on each hit'],
    'chance.brined': ['chance to Brine', '%', 'on each hit'],
  };
  const KIND = { blow: 'Blows', drag: 'Drag', swell: 'Swells' };
  // whose stat it is when a tag holds it: a voice's ("of voices that circle you")
  const TAG = {
    round: 'voices that circle you', still: 'voices that speak as you stand', moving: 'voices that speak as you move', timed: 'voices on the clock',
    thrown: 'thrown voices', ground: 'voices that lie on the ground', line: 'voices that run between two points', planted: 'voices that stay where set',
    held: 'voices that last', turn: 'voices that answer a turn', crossing: 'voices that answer a crossing of your wake', water: 'voices that answer water',
    trade: 'your trade', heave: 'the heave', blow: 'your Blows', drag: 'your Drag', swell: 'your Swells', hit: 'your hits', dot: 'your Drag',
  };
  const COND = {
    braced: 'while Braced', striding: 'while Striding', crowded: 'while crowded', 'after-quarter': 'for 8 s after each quarter of a toll',
    'wrong-footed': 'while Wrong-footed', 'in-water': 'in water', dry: 'on dry ground', 'on-wound': 'while you stand on a wound',
    laden: 'while you carry four finds or more', scarred: 'once a wound has scarred', faint: 'while your life is low', 'at-post': 'within 6 m of the bell-post',
    'in-light': 'in lamplight', 'tolled-for': 'while Tolled-for', 't-braced': 'to the Braced dead', 't-striding': 'to the Striding dead',
    't-large': 'to the large dead', 't-elite': 'to elites', 't-keeper': 'to keepers', 't-near': 'to the dead within 3 m', 't-far': 'to the dead beyond 8 m',
    't-in-water': 'to the dead in water', 't-wrong-footed': 'to the Wrong-footed dead', 't-in-procession': 'to the dead In Procession',
    't-moored': 'to the Moored', 't-sounded': 'to the Sounded', 't-coiled': 'to the Coiled', 't-mourning': 'to the dead in mourning',
    't-coined': 'to the Coined', 't-sealed': 'to the Sealed', 't-brined': 'to the Brined',
  };
  const KINDS = { door: 'Door', lane: 'Lane', corner: 'Corner', square: 'Square', milestone: 'Milestone' };
  const ATTR = { knee: 'Knee', heel: 'Heel', hand: 'Hand', ear: 'Ear' };

  function ordinal(n) {
    const t = n % 100, u = n % 10;
    return n + (t >= 11 && t <= 13 ? 'th' : u === 1 ? 'st' : u === 2 ? 'nd' : u === 3 ? 'rd' : 'th');
  }
  // a number as a player reads it: two places at most, no trailing zeros, a true minus sign
  function num(v) {
    const a = Math.abs(v), r = a >= 10 ? Math.round(a * 10) / 10 : Math.round(a * 100) / 100;
    return String(r).replace(/\.0+$/, '');
  }
  const signed = (v) => (v < 0 ? MINUS : '+') + num(v);
  const condWords = (c) => [].concat(c).map((id) => COND[id] || id).join(', ');
  const unlessWords = (c) => [].concat(c).map((id) => (id.startsWith('t-') ? 'except ' : 'unless ') + (COND[id] || id).replace(/^(while|to) /, '')).join(', ');

  // one modifier in words: "+8% harm of voices that circle you", "x1.2 voice speed while Braced"
  function say(m) {
    const row = STAT[m.stat] || [m.stat.replace(/^param\./, ''), ''], tags = m.tags || [];
    let what = row[0], amount;
    if (m.op === 'more') amount = '×' + num(1 + m.value / 100);
    else if (m.op === 'inc') amount = signed(m.value) + '%';
    else if (m.op === 'set') amount = num(m.value) + row[1];
    else amount = signed(Array.isArray(m.value) ? m.value[0] : m.value) + row[1];
    if (m.stat === 'taken' && tags.length && KIND[tags[0]]) what = KIND[tags[0]] + ' taken';
    else if (tags.length) what += ' of ' + tags.map((t) => TAG[t] || (Stats.FAMILIES.indexOf(t) >= 0 ? 'voices while you hold a ' + t : t)).join(' and ');
    if (row[2]) what += ' ' + row[2];
    let text = (m.op === 'set' ? what + ' set to ' : amount + ' ') + (m.op === 'set' ? amount : what);
    if (m.cond !== undefined) text += ' ' + condWords(m.cond);
    if (m.unless !== undefined) text += ' ' + unlessWords(m.unless);
    return text;
  }

  // ---- the plan, as the screen draws it ----

  const fontPx = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  function palette() {
    const css = getComputedStyle(document.documentElement), get = (name, fallback) => (css.getPropertyValue(name).trim() || fallback);
    return {
      marsh: get('--pl-marsh', '#0b1218'), road: get('--pl-road', '#3a3a3e'), block: get('--pl-block', '#16181f'), alley: get('--pl-alley', '#2c2d33'),
      water: get('--pl-water', '#1c3646'), shore: get('--pl-shore', '#4f7d8c'), flood: get('--pl-flood', 'rgba(60,120,150,0.16)'),
      close: get('--pl-close', '#2a2620'), minster: get('--pl-minster', '#5a5244'), link: get('--pl-link', 'rgba(236,231,218,0.16)'),
      node: get('--pl-node', '#8a867a'), nodeEdge: get('--pl-node-edge', '#0a0c11'), held: get('--accent-bright', '#efc977'),
      route: get('--accent', '#c79a45'), lamp: get('--pl-lamp', 'rgba(239,201,119,0.35)'), granted: get('--second', '#6fb3a6'),
      loop: get('--pl-loop', 'rgba(111,179,166,0.2)'), tooBig: get('--bad', '#e8776b'), step: get('--ink', '#ece7da'), chosen: get('--focus', '#9fd0ff'),
      way: get('--pl-way', 'rgba(159,208,255,0.75)'), label: get('--pl-label', 'rgba(236,231,218,0.55)'), ebb: get('--pl-ebb', '#c9b58a'),
      mile: get('--pl-mile', 'rgba(239,201,119,0.16)'),
      font: get('--font-ui', 'sans-serif'),
    };
  }

  // the street plan's fixed shapes, worked out once from the definitions
  let shapes = null;
  function geometry() {
    if (shapes !== null) return shapes;
    const plan = Tree.plan(), look = plan.look || {}, nodes = Defs.all('node'), byId = Object.create(null);
    for (let i = 0; i < nodes.length; i++) byId[nodes[i].id] = nodes[i];
    const links = [];
    for (let i = 0; i < nodes.length; i++) for (const l of nodes[i].links) if (nodes[i].id < l && byId[l]) links.push([nodes[i], byId[l]]);
    let extent = 0;
    for (let i = 0; i < nodes.length; i++) extent = Math.max(extent, Math.hypot(nodes[i].x, nodes[i].y));
    const doors = Object.create(null);
    for (let i = 0; i < nodes.length; i++) if (nodes[i].kind === 'door') doors[nodes[i].street] = nodes[i].class;
    shapes = { plan, look, nodes, byId, links, extent, doors, radii: look.radii || [], river: look.river || [] };
    return shapes;
  }

  // the class whose quarter an angle (degrees, sunwise from the east) lies in, by the doors' streets
  function quarterAt(g, deg) {
    const look = g.look;
    if (typeof look.first !== 'number') return null;
    let best = null, near = Infinity;
    for (const s in g.doors) {
      const mid = look.first + look.step * Number(s), off = Math.abs(((deg - mid + 540) % 360) - 180);
      if (off < near) { near = off; best = g.doors[s]; }
    }
    return best;
  }

  function colourOf(g, cls) {
    if (cls && Defs.has('class', cls) && Defs.get('class', cls).palette.length) return Defs.get('class', cls).palette[0];
    return (g.look.colours && g.look.colours[cls]) || null;
  }

  // ---- the screen ----

  let open = null;   // the screen that is open: its state (one at a time)

  // the held nodes of a held milestone's straight run, end to end along its street
  function runOf(g, held, mile) {
    const run = [mile], seen = Object.create(null);
    seen[mile.id] = true;
    for (let side = 0; side < 2; side++) {
      for (let at = mile, more = true; more;) {
        more = false;
        for (const l of at.links) {
          const n = g.byId[l];
          if (!n || seen[l] || !(held[l] > 0) || n.street !== mile.street) continue;
          seen[l] = true;
          if (side === 0) run.unshift(n); else run.push(n);
          at = n;
          more = true;
          break;
        }
      }
    }
    return run;
  }

  function stateOf(char, g) {
    const walk = char.plan.walk, held = Tree.held(walk), loops = Tree.loops(walk);
    const granted = Object.create(null), miles = [];
    for (const id of Tree.granted(walk)) granted[id] = true;
    for (const id in held) if (g.byId[id] && g.byId[id].kind === 'milestone') miles.push(runOf(g, held, g.byId[id]));
    return { walk, held, loops, granted, miles, steps: Tree.steps(walk), head: walk.length ? walk[walk.length - 1] : null };
  }

  // the way from one node to another over the plan's links, fewest steps first: [id] from the first to the last
  function wayTo(g, from, to) {
    if (from === null || to === null || from === to) return [];
    const back = Object.create(null), todo = [from];
    back[from] = '';
    for (let i = 0; i < todo.length; i++) {
      const n = g.byId[todo[i]];
      for (const l of n.links) {
        if (back[l] !== undefined) continue;
        back[l] = n.id;
        if (l === to) {
          const out = [l];
          for (let at = n.id; at !== ''; at = back[at]) out.push(at);
          return out.reverse();
        }
        todo.push(l);
      }
    }
    return [];
  }

  function build(args) {
    const g = geometry(), save = Game.save, char = (args && args.char) || Game.char;
    const root = h('div', { class: 'pl-screen' });
    if (!char || !save || !char.plan || g.nodes.length === 0) {
      root.append(h('div', { class: 'ui-panel ui-stack' }, h('h2', { class: 'ui-heading' }, 'The Plan'),
        h('p', { class: 'ui-sub' }, 'There is no route to show.'), UI.button('Back', function () { UI.back(); }, { class: 'primary', dataset: { focus: '' } })));
      return root;
    }
    const canvas = h('canvas', { class: 'pl-canvas', tabindex: '0', role: 'application', 'aria-label': 'The street plan: the arrow keys choose a node, Enter steps onto it' });
    const map = h('div', { class: 'pl-map' }, canvas);
    const points = h('p', { class: 'pl-points', role: 'status' });
    const panel = h('section', { class: 'pl-panel', 'aria-live': 'polite' });
    const tools = h('div', { class: 'pl-tools' },
      UI.button(MINUS, function () { zoom(1 / 1.5); }, { class: 'pl-tool', 'aria-label': 'Zoom out', dataset: { tool: 'out' } }),
      UI.button('+', function () { zoom(1.5); }, { class: 'pl-tool', 'aria-label': 'Zoom in', dataset: { tool: 'in' } }),
      UI.button('Head', function () { choose(st.state.head, true); }, { class: 'pl-tool pl-tool-head', 'aria-label': 'Back to the head of the route', dataset: { tool: 'head' } }));
    map.append(tools);
    root.append(h('header', { class: 'pl-head' },
      h('div', { class: 'pl-titles' }, h('h2', { class: 'pl-title' }, 'The Plan'), points),
      UI.button('Back', function () { UI.back(); }, { class: 'second pl-back', dataset: { action: 'back' } })),
    h('div', { class: 'pl-body' }, map, panel));

    const st = {
      g, save, char, root, canvas, map, panel, points, colours: palette(),
      cx: 0, cy: 0, scale: 8, w: 0, ht: 0, dpr: 1, fitted: false,
      chosen: null, totals: false, state: stateOf(char, g), way: [], frame: 0,
      pointers: new Map(), drag: null, pinch: null, offResize: null, observer: null,
    };
    const readOnly = () => save.away !== null;

    // ---- the view: where the plan's point (x, y) is drawn ----
    const sx = (x) => (x - st.cx) * st.scale + st.w / 2;
    const sy = (y) => (y - st.cy) * st.scale + st.ht / 2;
    const least = () => Math.min(st.w, st.ht) / (2 * (g.extent + 8));
    const clampScale = (k) => Math.max(least(), Math.min(MOST, k));
    // the view stays over the city: its middle may go as far as the last wall while the city is wider than the view,
    // and less as the city fills it, to none once the whole city shows
    function keepNear() {
      const edge = g.extent + 4;
      const lx = Math.max(0, Math.min(edge, 2 * (edge - st.w / (2 * st.scale)))), ly = Math.max(0, Math.min(edge, 2 * (edge - st.ht / (2 * st.scale))));
      st.cx = Math.max(-lx, Math.min(lx, st.cx));
      st.cy = Math.max(-ly, Math.min(ly, st.cy));
    }

    function zoom(k, px, py) {
      const ax = px === undefined ? st.w / 2 : px, ay = py === undefined ? st.ht / 2 : py;
      const wx = st.cx + (ax - st.w / 2) / st.scale, wy = st.cy + (ay - st.ht / 2) / st.scale;
      st.scale = clampScale(st.scale * k);
      st.cx = wx - (ax - st.w / 2) / st.scale;
      st.cy = wy - (ay - st.ht / 2) / st.scale;
      keepNear();
      redraw();
    }

    function fit() {
      const box = map.getBoundingClientRect(), w = Math.max(1, box.width), ht = Math.max(1, box.height);
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      if (w === st.w && ht === st.ht && dpr === st.dpr) return;
      st.w = w;
      st.ht = ht;
      st.dpr = dpr;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(ht * dpr);
      if (!st.fitted && w > 1 && ht > 1) {
        st.fitted = true;
        st.scale = clampScale(Math.min(w, ht) / AROUND);
        const at = g.byId[st.chosen];
        if (at) { st.cx = at.x; st.cy = at.y; }
      }
      st.scale = clampScale(st.scale);
      keepNear();
      redraw();
    }

    function redraw() {
      if (st.frame) return;
      st.frame = window.requestAnimationFrame(function () { st.frame = 0; draw(st); });
    }

    // keeps the chosen node in view, centring on it when asked or when it lies near the edge
    function show(id, centre) {
      const n = g.byId[id];
      if (!n) return;
      const x = sx(n.x), y = sy(n.y), margin = Math.min(60, Math.min(st.w, st.ht) / 4);
      if (centre || x < margin || y < margin || x > st.w - margin || y > st.ht - margin) {
        st.cx = n.x;
        st.cy = n.y;
        keepNear();
      }
    }

    function choose(id, centre) {
      if (!id || !g.byId[id]) return;
      st.chosen = id;
      st.totals = false;
      st.way = wayTo(g, st.state.head, id);
      show(id, centre);
      tell();
      redraw();
    }

    // after a change: the state is worked out again and the save written
    function changed() {
      st.state = stateOf(char, g);
      Game.write();
    }

    function step(id, attr) {
      if (readOnly()) return false;
      if (!Char.allocate(char, id, attr)) { UI.toast('That step cannot be taken.'); return false; }
      changed();
      choose(id, false);
      canvas.focus({ preventScroll: true });
      return true;
    }

    function takeBack() {
      if (readOnly()) return;
      const was = st.state.head, price = Char.refundPrice(char);
      if (Char.refund(char, save.account) === null) {
        UI.toast(save.account.coin < price ? 'Not enough coin: taking it back costs ' + price + '.' : 'That cannot be taken back.');
        return;
      }
      changed();
      choose(st.state.head, false);
      if (was) UI.toast(g.byId[was].name + ' taken back for ' + price + ' coin.');
      canvas.focus({ preventScroll: true });
    }

    // ---- the panel ----

    function header() {
      const p = Char.points(char);
      st.points.textContent = char.name + ' · ' + p.spent + ' of ' + p.have + ' points walked · ' + p.free + ' free · ' + Math.floor(save.account.coin) + ' coin';
    }

    // where a node stands: its street, and its wall or the two walls it lies between
    function place(n) {
      const look = g.look, parts = [], walls = look.walls || [], ring = g.radii[n.ring - 1];
      if (n.street !== null && look.streets) parts.push(look.streets[n.street]);
      const onWall = typeof ring !== 'number' || Math.abs(Math.hypot(n.x, n.y) - ring) < 0.5;
      if (onWall && walls[n.ring - 1]) parts.push(walls[n.ring - 1]);
      else if (walls[n.ring - 1] && walls[n.ring]) parts.push('between ' + walls[n.ring - 1] + ' and ' + walls[n.ring]);
      return parts.join(', ');
    }

    function gives(n, attr, k) {
      return Tree.give(n, attr, k, []).map(say);
    }

    // the panel told afresh; a control of it that had focus keeps it in the new panel when it is still there, and
    // else focus goes back to the map, so that keys and a pad are never left with nothing
    function tell() {
      const had = document.activeElement, inPanel = had && had !== st.panel && st.panel.contains(had);
      const key = !inPanel ? null : had.dataset.step ? '[data-step="' + had.dataset.step + '"]'
        : had.dataset.action ? '[data-action="' + had.dataset.action + '"]' + (had.dataset.attr ? '[data-attr="' + had.dataset.attr + '"]' : '') : null;
      told();
      if (!inPanel) return;
      const again = key ? st.panel.querySelector(key) : null;
      if (again && !again.disabled) again.focus({ preventScroll: true }); else st.canvas.focus({ preventScroll: true });
    }

    function told() {
      header();
      const box = st.panel, n = g.byId[st.chosen], s = st.state, plan = g.plan;
      box.textContent = '';
      box.dataset.node = n ? n.id : '';
      if (st.totals) return totals(box);
      if (!n) return;
      const held = s.held[n.id] || 0, granted = s.granted[n.id] === true, isStep = s.steps.indexOf(n.id) >= 0, isHead = s.head === n.id;
      const kind = n.id.startsWith('plan.bridge.') ? 'Bridge' : KINDS[n.kind] || n.kind;
      const cls = quarterAt(g, (Math.atan2(n.y, n.x) * 180 / Math.PI + 360) % 360), colour = colourOf(g, n.class || cls);
      box.append(h('h3', { class: 'pl-name', style: colour ? { '--pl-quarter': colour } : null }, n.name),
        h('p', { class: 'pl-where' }, kind + ' · ring ' + n.ring + (place(n) ? ' · ' + place(n) : '')));
      if (n.text) box.append(h('p', { class: 'pl-text' }, n.text));
      let state;
      if (isHead && held > 0) state = n.kind === 'door' ? 'Your door: the route begins here.' : 'The head of your route' + (held === 2 ? ', doubled.' : '.');
      else if (held === 2) state = 'On your route twice: doubled.';
      else if (held === 1) state = 'On your route.';
      else if (granted) state = 'Fenced by your route: granted at ' + plan.loopShare + '%.';
      else if (isStep) state = 'Next to the head of your route: a point takes it.';
      else if (st.way.length > 1) state = (st.way.length - 1) + ' steps from the head of your route, the way dotted on the plan.';
      else state = 'Out of reach of your route.';
      box.append(h('p', { class: ['pl-state', held ? 'is-held' : granted ? 'is-granted' : isStep ? 'is-step' : ''] }, state));
      if (s.walk.length === 0) box.append(h('p', { class: 'pl-note' }, 'This character was made before the Plan was laid out: its route has no door, and it cannot walk.'));
      if (n.kind === 'door') {
        box.append(h('p', { class: 'pl-note' }, n.class && Defs.has('class', n.class) ? 'The door of the ' + Defs.get('class', n.class).name + '. It gives nothing.'
          : 'A class\'s door. It gives nothing.'));
      }
      // what it gives at the numbers this route makes
      const lines = [];
      if (n.choice !== null) {
        const k = granted && !held ? Tree.factor(n, []) * plan.loopShare / 100 : Tree.factor(n, s.walk), chosen = char.plan.choice[n.id];
        if (held && chosen) lines.push(gives(n, chosen, k).join('; ') + (held === 2 ? ', twice' : '') + ' (' + ATTR[chosen] + ' chosen)');
        else if (granted) lines.push(gives(n, n.choice[0], k).join('; ') + ': the first it offers, since nobody chose');
        else lines.push(signed(k) + ' ' + n.choice.map((a) => ATTR[a] || a).join(' or ') + ', as you choose');
      } else if (n.mods.length) {
        const k = granted && !held ? Tree.factor(n, []) * plan.loopShare / 100 : Tree.factor(n, s.walk);
        for (const line of gives(n, null, k)) lines.push(line + (held === 2 ? ', twice' : ''));
      }
      if (lines.length) box.append(h('ul', { class: 'pl-gives' }, lines.map((l) => h('li', null, l))));
      const works = Tree.from(n) <= 0 ? 'Works from the start of a vigil' : 'Works from the ' + ordinal(Tree.from(n)) + ' toll of a vigil';
      const ringPart = n.ring > 1 ? ', at ' + Math.round((1 + plan.ringGain / 100 * (n.ring - 1)) * 100) + '% for its ring' : '';
      if (n.kind !== 'door') box.append(h('p', { class: 'pl-note' }, works + ringPart + '.'));
      if (n.bank === 'flood') box.append(h('p', { class: 'pl-note pl-flood' }, 'The Flood bank: only while you stand in water, at ' + (100 + plan.bankGain) + '%.'));
      if (n.bank === 'ebb') box.append(h('p', { class: 'pl-note pl-ebb' }, 'The Ebb bank: only on dry ground, at ' + (100 + plan.bankGain) + '%.'));
      if (n.kind === 'milestone') {
        const run = held ? Tree.run(s.walk, n.id) : Tree.run(s.walk.concat([n.id]), n.id), beyond = Math.max(0, Math.min(plan.mileMost, run - plan.mileFrom));
        box.append(h('p', { class: 'pl-note' }, (held ? 'Its straight run: ' : 'Held, its straight run would be ') + run + ' along ' +
          (g.look.streets ? g.look.streets[n.street] : 'its street') + ', +' + beyond * plan.mileGain + '% (' + plan.mileGain + '% a node beyond the ' +
          ordinal(plan.mileFrom) + ', ' + plan.mileMost + ' at most).'));
      }
      if (isStep && held === 1) {
        const loop = Tree.loops(s.walk.concat([n.id])).pop();
        if (loop && loop.inside.length) {
          box.append(h('p', { class: 'pl-note' }, 'Stepping back onto it closes a loop round ' + loop.inside.length + (loop.inside.length === 1 ? ' node' : ' nodes') +
            (loop.grants ? ': granted at ' + plan.loopShare + '%.' : ': more than ' + plan.loopMost + ', so it grants nothing.')));
        }
      }
      actions(box, n, held, isStep, isHead);
      stepsRow(box);
      box.append(h('div', { class: 'pl-more' }, UI.button('What the route gives', function () { st.totals = true; tell(); focusPanel(); }, { class: 'second', dataset: { action: 'totals' } })));
    }

    function actions(box, n, held, isStep, isHead) {
      const row = h('div', { class: 'pl-actions' }), p = Char.points(char);
      if (readOnly()) {
        box.append(h('p', { class: 'pl-note' }, 'A vigil is under way: the route waits until it ends.'));
        return;
      }
      if (isStep) {
        if (p.free <= 0) {
          row.append(UI.button('No point free', null, { class: 'primary', disabled: true }));
          box.append(row, h('p', { class: 'pl-note' }, 'Every level from the second gives a point.'));
          return;
        }
        if (n.choice !== null && held === 0) {
          const k = Tree.factor(n, st.state.walk);
          for (const a of n.choice) {
            row.append(UI.button(ATTR[a] + ' ' + signed(k), function () { step(n.id, a); }, { class: 'primary', dataset: { action: 'step', attr: a } }));
          }
        } else {
          row.append(UI.button(held ? 'Double it: 1 point' : 'Walk here: 1 point', function () { step(n.id); }, { class: 'primary', dataset: { action: 'step' } }));
        }
      }
      if (isHead && st.state.walk.length > 1) {
        const price = Char.refundPrice(char);
        row.append(UI.button('Take back: ' + price + ' coin', takeBack, { class: 'second', disabled: save.account.coin < price, dataset: { action: 'refund' } }));
        if (save.account.coin < price) box.append(h('p', { class: 'pl-note' }, 'The Household holds ' + Math.floor(save.account.coin) + ' coin.'));
      }
      if (row.childNodes.length) box.append(row);
    }

    // the head's next steps, by name: a quick way to them for keys and a pad
    function stepsRow(box) {
      const steps = st.state.steps;
      if (!steps.length) return;
      const row = h('div', { class: 'pl-steps' }, h('p', { class: 'pl-note' }, 'From the head:'));
      for (const id of steps) {
        const n = g.byId[id];
        row.append(UI.button(n.name, function () { choose(id, true); }, { class: ['second', 'pl-chip', id === st.chosen ? 'is-chosen' : ''], dataset: { step: id } }));
      }
      box.append(row);
    }

    // the whole Plan's modifiers, outside a vigil (every ring counts), summed where they are alike
    function totals(box) {
      const list = Tree.mods(char, Infinity, []), sums = new Map();
      for (const m of list) {
        const key = [m.stat, m.op, JSON.stringify(m.tags || []), JSON.stringify(m.cond || null), JSON.stringify(m.unless || null)].join('|');
        const had = sums.get(key);
        if (!had) sums.set(key, Object.assign({}, m, { value: Array.isArray(m.value) ? m.value[0] : m.value }));
        else if (m.op === 'more') had.value = ((1 + had.value / 100) * (1 + m.value / 100) - 1) * 100;
        else had.value += Array.isArray(m.value) ? m.value[0] : m.value;
      }
      // in the order of the stat tables (the attributes first), then by what holds each to its tags and conditions
      const order = Object.create(null);
      Stats.STATS.forEach(function (r, i) { order[r.id] = i; });
      const rank = (m) => (order[m.stat] !== undefined ? order[m.stat] : Stats.STATS.length);
      const lines = Array.from(sums.values()).filter((m) => Math.abs(m.value) > 1e-9)
        .sort((a, b) => rank(a) - rank(b) || (say(a) < say(b) ? -1 : 1)).map(say);
      box.append(h('h3', { class: 'pl-name' }, 'What the route gives'),
        h('p', { class: 'pl-where' }, 'Outside a vigil, every ring counting; in a vigil a ring counts from its toll, and a bank only on its ground.'),
        lines.length ? h('ul', { class: 'pl-gives' }, lines.map((l) => h('li', null, l))) : h('p', { class: 'pl-note' }, 'Nothing yet: the route is only its door.'),
        h('div', { class: 'pl-more' }, UI.button('Back to the plan', function () { st.totals = false; tell(); canvas.focus({ preventScroll: true }); },
          { class: 'second', dataset: { action: 'plan' } })));
    }

    function focusPanel() {
      const first = st.panel.querySelector('button:not([disabled])');
      if (first) first.focus({ preventScroll: true });
    }

    // ---- choosing with keys and a pad ----

    // the next node from the chosen one in the direction (dx, dy): along a link within 70 degrees if there is one,
    // else the nearest within 45 degrees
    function next(dx, dy) {
      const at = g.byId[st.chosen];
      if (!at) return null;
      const pick = (list, cos) => {
        let best = null, score = Infinity;
        for (const n of list) {
          const vx = n.x - at.x, vy = n.y - at.y, d = Math.hypot(vx, vy);
          if (d < 1e-6) continue;
          const c = (vx * dx + vy * dy) / d;
          if (c < cos) continue;
          const s = d * (1 + 2 * (1 - c));
          if (s < score) { score = s; best = n; }
        }
        return best;
      };
      return pick(at.links.map((l) => g.byId[l]), Math.cos(70 * Math.PI / 180)) || pick(g.nodes, Math.cos(45 * Math.PI / 180));
    }

    canvas.addEventListener('ui-nav', function (e) {
      const n = next(e.detail.dx, e.detail.dy);
      if (n === null) return;   // nothing that way: focus moves on, out of the map
      e.preventDefault();
      choose(n.id, false);
    });

    // Enter, or the pad's button (UI.activate clicks the map): step onto the chosen node if one point does it; else
    // into the panel, to choose an attribute or take back the head
    function activate() {
      const n = g.byId[st.chosen], s = st.state;
      if (!n) return;
      if (!readOnly() && s.steps.indexOf(n.id) >= 0 && Char.points(char).free > 0 && !(n.choice !== null && !s.held[n.id])) { step(n.id); return; }
      focusPanel();
    }

    canvas.addEventListener('click', function (e) { if (e.detail === 0) activate(); });
    canvas.addEventListener('keydown', function (e) {
      if (e.key === '+' || e.key === '=') { zoom(1.5); e.preventDefault(); }
      else if (e.key === '-' || e.key === '_') { zoom(1 / 1.5); e.preventDefault(); }
    });

    // ---- pointers: pan with one, zoom with two, a tap chooses ----

    const local = (e) => { const b = canvas.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
    function nearest(px, py) {
      let best = null, d2 = PICK * PICK;
      for (const n of g.nodes) {
        const dx = sx(n.x) - px, dy = sy(n.y) - py, d = dx * dx + dy * dy;
        if (d < d2) { d2 = d; best = n; }
      }
      return best;
    }
    function twoOf() {
      const it = st.pointers.values(), a = it.next().value, b = it.next().value;
      return { mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, d: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) };
    }
    canvas.addEventListener('pointerdown', function (e) {
      const p = local(e);
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* a pointer the page cannot hold is followed while it lasts */ }
      st.pointers.set(e.pointerId, { x: p.x, y: p.y });
      if (st.pointers.size === 1) st.drag = { x0: p.x, y0: p.y, cx: st.cx, cy: st.cy, t0: e.timeStamp, moved: false };
      else if (st.pointers.size === 2) {
        const t = twoOf();
        st.pinch = { d0: t.d, scale0: st.scale, wx: st.cx + (t.mx - st.w / 2) / st.scale, wy: st.cy + (t.my - st.ht / 2) / st.scale };
        if (st.drag) st.drag.moved = true;
      }
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!st.pointers.has(e.pointerId)) return;
      const p = local(e);
      st.pointers.set(e.pointerId, { x: p.x, y: p.y });
      if (st.pinch && st.pointers.size >= 2) {
        const t = twoOf();
        st.scale = clampScale(st.pinch.scale0 * t.d / st.pinch.d0);
        st.cx = st.pinch.wx - (t.mx - st.w / 2) / st.scale;
        st.cy = st.pinch.wy - (t.my - st.ht / 2) / st.scale;
        keepNear();
        redraw();
      } else if (st.drag) {
        const dx = p.x - st.drag.x0, dy = p.y - st.drag.y0;
        if (!st.drag.moved && dx * dx + dy * dy > TAP * TAP) st.drag.moved = true;
        if (st.drag.moved) {
          st.cx = st.drag.cx - dx / st.scale;
          st.cy = st.drag.cy - dy / st.scale;
          keepNear();
          redraw();
        }
      }
    });
    function lift(e, cancelled) {
      if (!st.pointers.has(e.pointerId)) return;
      const p = local(e), was = st.drag;
      st.pointers.delete(e.pointerId);
      if (st.pointers.size < 2) st.pinch = null;
      if (st.pointers.size === 1) {   // a finger is left from a pinch: it pans on from where it is
        const q = st.pointers.values().next().value;
        st.drag = { x0: q.x, y0: q.y, cx: st.cx, cy: st.cy, t0: e.timeStamp, moved: true };
        return;
      }
      st.drag = null;
      if (!cancelled && was && !was.moved && e.timeStamp - was.t0 < TAP_MS) {
        const n = nearest(p.x, p.y);
        if (n) choose(n.id, false);
      }
    }
    canvas.addEventListener('pointerup', function (e) { lift(e, false); });
    canvas.addEventListener('pointercancel', function (e) { lift(e, true); });
    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      const p = local(e);
      zoom(Math.pow(1.0018, -e.deltaY), p.x, p.y);
    }, { passive: false });

    st.offResize = Plat.onResize(function () { st.colours = palette(); fit(); });
    if (typeof ResizeObserver === 'function') {
      st.observer = new ResizeObserver(function () { fit(); });
      st.observer.observe(map);
    }
    st.chosen = st.state.head || Tree.door(char.class);
    st.way = [];
    canvas.dataset.focus = '';
    tell();
    open = st;
    window.requestAnimationFrame(function () { if (open === st) fit(); });
    return root;
  }

  // ---- drawing ----

  function draw(st) {
    const g = st.g, c = st.colours, ctx = st.canvas.getContext('2d');
    if (!ctx || st.w < 2 || st.ht < 2) return;
    const k = st.scale, X = (x) => (x - st.cx) * k + st.w / 2, Y = (y) => (y - st.cy) * k + st.ht / 2;
    st.canvas.dataset.cx = String(Math.round(st.cx * 1000) / 1000);
    st.canvas.dataset.cy = String(Math.round(st.cy * 1000) / 1000);
    st.canvas.dataset.scale = String(Math.round(k * 1000) / 1000);
    ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
    ctx.fillStyle = c.marsh;
    ctx.fillRect(0, 0, st.w, st.ht);
    const radii = g.radii, look = g.look, last = radii.length ? radii[radii.length - 1] : g.extent, road = 1.1;   // a road's half width
    // the city: roads everywhere, then the blocks between them
    ctx.fillStyle = c.road;
    ctx.beginPath();
    ctx.arc(X(0), Y(0), (last + 2.2) * k, 0, TAU);
    ctx.fill();
    if (typeof look.first === 'number' && radii.length) {
      const streets = (g.plan.streets || 12);
      for (let r = 0; r + 1 < radii.length; r++) {
        for (let s = 0; s < streets; s++) {
          const a0 = (look.first + look.step * s) * Math.PI / 180, a1 = a0 + look.step * Math.PI / 180;
          const inner = radii[r] + road, outer = radii[r + 1] - road, pad0 = road / inner, pad1 = road / outer;
          const cls = quarterAt(g, look.first + look.step * (s + 0.5)), tint = colourOf(g, cls);
          ctx.beginPath();
          ctx.arc(X(0), Y(0), outer * k, a0 + pad1, a1 - pad1);
          ctx.arc(X(0), Y(0), inner * k, a1 - pad0, a0 + pad0, true);
          ctx.closePath();
          ctx.fillStyle = c.block;
          ctx.fill();
          if (tint) {
            ctx.globalAlpha = 0.13;
            ctx.fillStyle = tint;
            ctx.fill();
            ctx.globalAlpha = 1;
          }
        }
      }
      // the close: the cathedral in the middle, the Lantern's tower at its crossing
      ctx.fillStyle = c.close;
      ctx.beginPath();
      ctx.arc(X(0), Y(0), (radii[0] - road) * k, 0, TAU);
      ctx.fill();
      const m = (look.close || 8) * k;
      ctx.fillStyle = c.minster;
      ctx.fillRect(X(0) - m * 0.75, Y(0) - m * 0.16, m * 1.5, m * 0.32);
      ctx.fillRect(X(0) - m * 0.16, Y(0) - m * 0.5, m * 0.32, m * 1.05);
      ctx.fillStyle = c.held;
      ctx.beginPath();
      ctx.arc(X(0), Y(0), Math.max(2, m * 0.12), 0, TAU);
      ctx.fill();
    }
    // the alleys and every link: thin ways between the places
    ctx.strokeStyle = c.alley;
    ctx.lineWidth = Math.max(1, 0.7 * k);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const [a, b] of g.links) {
      if (a.street !== null && b.street !== null && a.street === b.street) continue;   // a street is drawn as a road already
      ctx.moveTo(X(a.x), Y(a.y));
      ctx.lineTo(X(b.x), Y(b.y));
    }
    ctx.stroke();
    // the river: the drowned south washed over, the water, its shores, and the bridges over it
    const river = g.river;
    if (river.length > 1) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(X(0), Y(0), (last + 2.2) * k, 0, TAU);
      ctx.clip();
      ctx.beginPath();
      ctx.moveTo(X(river[0][0]), Y(river[0][1]));
      for (const p of river) ctx.lineTo(X(p[0]), Y(p[1]));
      ctx.lineTo(X(river[river.length - 1][0]), Y(last + 10));
      ctx.lineTo(X(river[0][0]), Y(last + 10));
      ctx.closePath();
      ctx.fillStyle = c.flood;
      ctx.fill();
      ctx.restore();
      const half = (look.riverHalf || 1.6) * k;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(X(river[0][0]), Y(river[0][1]));
      for (const p of river) ctx.lineTo(X(p[0]), Y(p[1]));
      ctx.strokeStyle = c.shore;
      ctx.lineWidth = half * 2 + Math.max(2, 0.5 * k);
      ctx.stroke();
      ctx.strokeStyle = c.water;
      ctx.lineWidth = half * 2;
      ctx.stroke();
      for (const n of g.nodes) {
        if (!n.id.startsWith('plan.bridge.')) continue;
        const a = g.byId[n.links[0]], b = g.byId[n.links[1]];
        ctx.strokeStyle = c.road;
        ctx.lineWidth = Math.max(3, 1.6 * k);
        ctx.lineCap = 'butt';
        ctx.beginPath();
        ctx.moveTo(X(a.x), Y(a.y));
        ctx.lineTo(X(b.x), Y(b.y));
        ctx.stroke();
        ctx.lineCap = 'round';
      }
    }
    // the loops the route closed: the ones that grant shaded, the ones too big to grant outlined
    const s = st.state;
    for (const loop of s.loops) {
      if (!loop.inside.length) continue;
      ctx.beginPath();
      for (let i = loop.from; i <= loop.to; i++) {
        const n = g.byId[s.walk[i]];
        if (!n) continue;
        if (i === loop.from) ctx.moveTo(X(n.x), Y(n.y)); else ctx.lineTo(X(n.x), Y(n.y));
      }
      ctx.closePath();
      if (loop.grants) { ctx.fillStyle = c.loop; ctx.fill('evenodd'); }
      else { ctx.setLineDash([4, 4]); ctx.strokeStyle = c.tooBig; ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]); }
    }
    // the straight run of each held milestone: a broad band along its street, under the route
    ctx.strokeStyle = c.mile;
    ctx.lineWidth = Math.max(10, 2.8 * k);
    for (const run of s.miles) {
      if (run.length < 2) continue;
      ctx.beginPath();
      run.forEach(function (n, i) { if (i === 0) ctx.moveTo(X(n.x), Y(n.y)); else ctx.lineTo(X(n.x), Y(n.y)); });
      ctx.stroke();
    }
    // the route: a lamplit line, its glow under it
    if (s.walk.length > 1) {
      ctx.beginPath();
      for (let i = 0; i < s.walk.length; i++) {
        const n = g.byId[s.walk[i]];
        if (!n) continue;
        if (i === 0) ctx.moveTo(X(n.x), Y(n.y)); else ctx.lineTo(X(n.x), Y(n.y));
      }
      ctx.strokeStyle = c.lamp;
      ctx.lineWidth = Math.max(6, 1.9 * k);
      ctx.stroke();
      ctx.strokeStyle = c.route;
      ctx.lineWidth = Math.max(2.5, 0.75 * k);
      ctx.stroke();
    }
    // the way from the head to the chosen node, dotted
    if (st.way.length > 1) {
      ctx.beginPath();
      st.way.forEach(function (id, i) { const n = g.byId[id]; if (i === 0) ctx.moveTo(X(n.x), Y(n.y)); else ctx.lineTo(X(n.x), Y(n.y)); });
      ctx.setLineDash([3, 5]);
      ctx.strokeStyle = c.way;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // the nodes, by kind: a lane a disc, a corner a lozenge, a square a square, a milestone a post, a door an arch
    const size = Math.max(3, Math.min(10, 0.85 * k)), steps = s.steps, detail = k >= 3.2;
    for (const n of g.nodes) {
      const x = X(n.x), y = Y(n.y);
      if (x < -20 || y < -20 || x > st.w + 20 || y > st.ht + 20) continue;
      const held = s.held[n.id] || 0, granted = s.granted[n.id] === true;
      if (!detail && !held && n.kind !== 'door' && n.kind !== 'square') continue;
      const fill = held ? c.held : granted ? c.granted : n.kind === 'door' ? colourOf(g, n.class) || c.node : n.bank === 'ebb' ? c.ebb : n.bank === 'flood' ? c.shore : c.node;
      const r = n.kind === 'lane' ? size * 0.75 : n.kind === 'corner' ? size * 0.95 : size * 1.15;
      ctx.fillStyle = fill;
      ctx.strokeStyle = c.nodeEdge;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (n.kind === 'lane') ctx.arc(x, y, r, 0, TAU);
      else if (n.kind === 'corner') { ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); }
      else if (n.kind === 'milestone') ctx.rect(x - r * 0.45, y - r, r * 0.9, r * 2);
      else if (n.kind === 'door') { ctx.moveTo(x - r, y + r * 0.8); ctx.lineTo(x - r, y - r * 0.1); ctx.arc(x, y - r * 0.1, r, Math.PI, 0); ctx.lineTo(x + r, y + r * 0.8); ctx.closePath(); }
      else ctx.rect(x - r, y - r, r * 2, r * 2);
      ctx.fill();
      ctx.stroke();
      if (held === 2) {
        ctx.strokeStyle = c.held;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, r + 3.5, 0, TAU);
        ctx.stroke();
      }
      if (steps.indexOf(n.id) >= 0) {
        ctx.strokeStyle = c.step;
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(x, y, r + 6, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    // the head: the lantern carried on the route
    const head = g.byId[s.head];
    if (head) {
      const x = X(head.x), y = Y(head.y), r = size * 1.7, glow = ctx.createRadialGradient(x, y, 1, x, y, r * 2.6);
      glow.addColorStop(0, c.lamp);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, r * 2.6, 0, TAU);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = c.nodeEdge;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = c.held;
      ctx.stroke();
      ctx.fillStyle = c.step;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(2, size * 0.4), 0, TAU);
      ctx.fill();
    }
    // the chosen node
    const at = g.byId[st.chosen];
    if (at) {
      ctx.strokeStyle = c.chosen;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(X(at.x), Y(at.y), size + 9, 0, TAU);
      ctx.stroke();
    }
    // the names of the streets, out by the last wall, and of the walls, north of the close
    if (look.streets && typeof look.first === 'number' && k >= 4) {
      const px = Math.round(fontPx() * 0.72);
      ctx.font = px + 'px ' + c.font;
      ctx.fillStyle = c.label;
      ctx.textBaseline = 'middle';
      for (let i = 0; i < look.streets.length; i++) {
        const a = (look.first + look.step * i) * Math.PI / 180, r = (radii[radii.length - 2] + radii[radii.length - 1]) / 2;
        const x = X(Math.cos(a) * r), y = Y(Math.sin(a) * r);
        if (x < -200 || y < -50 || x > st.w + 200 || y > st.ht + 50) continue;
        ctx.save();
        ctx.translate(x, y);
        const flip = Math.cos(a) < 0;
        ctx.rotate(flip ? a + Math.PI : a);
        ctx.textAlign = 'center';
        ctx.fillText(look.streets[i], 0, -size - 4);
        ctx.restore();
      }
      if (look.walls) {
        ctx.textAlign = 'center';
        for (let r = 0; r < radii.length; r++) {
          const y = Y(-radii[r]) - size - 3;
          if (y < -20 || y > st.ht + 20) continue;
          ctx.fillText(look.walls[r], X(0), y);
        }
      }
    }
  }

  // what an open screen listens to, let go
  function release() {
    if (open === null) return;
    if (open.frame) window.cancelAnimationFrame(open.frame);
    if (open.offResize) open.offResize();
    if (open.observer) open.observer.disconnect();
    open = null;
  }

  UI.screen('plan', {
    open: function (args) {
      release();   // a screen opened over another of its own: the newest is the one that listens
      return build(args);
    },
    close: release,
  });
})();
