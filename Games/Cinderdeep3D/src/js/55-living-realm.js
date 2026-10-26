/* ============================================================
   Cinderdeep — the Living Realm: scenery, ecology and ten brains
   Stream small deterministic patches; never put generated art in saves.
   ============================================================ */
DEFAULT_SETTINGS.livingWorld = true; DEFAULT_SETTINGS.livingBrains = true;
document.head.append(h('style', {}, '@media(max-width:600px){.lw-ribbon{top:192px!important;max-width:70%!important}}'));
const LW = { Z: null, cells: new Map(), objects: new Set(), actors: [], tracks: [], noise: [], marks: [], stats: {}, tick: 0, stream: 0, step: 0, ribbon: null, log: [], weather: '', wet: false };
const LW_BRAINS = [
  ['routine', 'Daily routines', 'Residents run errands by day and gather near home at night.'],
  ['shelter', 'Weather shelter', 'Rain and snow send residents toward covered doorways.'],
  ['social', 'Street conversations', 'Neighbors stop, face one another and exchange local observations.'],
  ['guard', 'Watch patrols', 'Guards patrol, intercept nearby threats and defend the town.'],
  ['flock', 'Skittish wildlife', 'Birds and small animals forage together, scatter from danger, then regroup.'],
  ['guide', 'Lantern wisps', 'A curious wisp waits for you and leads toward an unopened relic cache.'],
  ['flank', 'Pack tactics', 'Melee hunters spread around you rather than pursuing the same point.'],
  ['alarm', 'Sentry signals', 'Alert sentries warn nearby creatures that can see or hear them.'],
  ['morale', 'Survival instinct', 'Wounded hunters briefly retreat toward packmates without healing.'],
  ['noise', 'Sound investigation', 'Idle creatures investigate fresh nearby footsteps and weapon noise.'],
];
const lwOn = () => CD.settings.livingWorld !== false && W.on && !W.inInst && G.fl && G.fl.realm && W.Z && G.p;
const lwBrain = () => lwOn() && CD.settings.livingBrains !== false;
function lwSeen(id) { LW.stats[id] = (LW.stats[id] || 0) + 1; }
function lwBook() {
  if (!W.ch) return { loot: {}, found: {}, journal: [] };
  const b = W.ch.living || (W.ch.living = { loot: {}, found: {}, journal: [] });
  b.loot = b.loot || {}; b.found = b.found || {}; b.journal = Array.isArray(b.journal) ? b.journal : []; return b;
}
function lwNote(text, key) {
  const book = lwBook();
  if (key && book.found[key]) return;
  if (key) book.found[key] = true;
  book.journal.unshift({ zone: W.Z.id, text, day: realmDay() + 1 }); book.journal.length = Math.min(32, book.journal.length);
  LW.log.unshift(text); LW.log.length = Math.min(6, LW.log.length);
}
function lwPal() {
  const b = W.Z.b, id = b.id;
  if (/frost|tundra|glacier|alpine/.test(id)) return ['#b0d4df', '#5f8eaa', '#e4fbff', '#7b8eaa'];
  if (/ash|caldera|volcan|waste/.test(id)) return ['#80615b', '#493b40', '#ffa25b', '#c4885c'];
  if (/dune|desert|savanna/.test(id)) return ['#b4a567', '#817c42', '#ffd27d', '#ac7853'];
  if (/void|fey|crystal|spore/.test(id)) return ['#69aa9c', '#496e8c', '#d5a1ff', '#8f709b'];
  if (/swamp|fen|mangrove|bog/.test(id)) return ['#8ea65d', '#426a4a', '#a5e4b5', '#8c8061'];
  return ['#78a451', '#3e6d42', '#f1c872', '#a08464'];
}
function lwGood(x, y, r = 4) {
  if (x < 24 || y < 24 || x > ZT * TS - 24 || y > ZT * TS - 24) return false;
  const t = tileAt(G.fl, Math.floor(x / TS), Math.floor(y / TS));
  return ![TILE.SHALLOW, TILE.LAVA, TILE.TOXIC, TILE.PIT, TILE.VOID].includes(t) && !hitsWall(G.fl, x, y, r, false);
}
function lwObject(detail, x, y, seed, extra = {}) {
  const o = { kind: 'lw', detail, x, y, seed: seed >>> 0, ...extra };
  o._bucket = chunkOf(Math.floor(x / TS), Math.floor(y / TS)); W.Z.objs[o._bucket].push(o); LW.objects.add(o); return o;
}
function lwRemove(o) {
  const bucket = LW.Z && LW.Z.objs[o._bucket];
  if (bucket) { const i = bucket.indexOf(o); if (i >= 0) bucket.splice(i, 1); }
  LW.objects.delete(o);
}
function lwRebucket(o) {
  const bucket = chunkOf(Math.floor(o.x / TS), Math.floor(o.y / TS));
  if (bucket === o._bucket) return;
  const list = W.Z.objs[o._bucket], i = list.indexOf(o); if (i >= 0) list.splice(i, 1);
  W.Z.objs[bucket].push(o); o._bucket = bucket;
}
function lwReset(Z) {
  if (LW.Z) for (const o of [...LW.objects]) lwRemove(o);
  LW.Z = Z; LW.cells.clear(); LW.objects.clear(); LW.actors = []; LW.tracks = []; LW.noise = []; LW.marks = []; LW.tick = LW.stream = LW.step = 0; LW.stats = {}; LW.log = [];
  if (!lwOn()) return;
  LW.towns = new Set(); lwTownDetails(); lwStream(true);
}
function lwTownDetails() {
  const Z = W.Z;
  // Town details wait for nearby terrain; revisiting a town never duplicates its cache.
  for (const [i, town] of Z.towns.entries()) {
    if (LW.towns.has(i) || Math.hypot((town.x + 0.5) * TS - G.p.x, (town.y + 0.5) * TS - G.p.y) > 650) continue;
    const x = (town.x + 0.5) * TS, y = (town.y + town.plazaR + 3) * TS;
    const id = Z.id + ':reliquary:' + i;
    const points = [[76, 20], [-76, 20], [50, 54], [-50, 54], [0, 65]];
    let q = null;
    for (const [dx, dy] of points) if (lwGood(x + dx, y + dy, 8)) { q = { x: x + dx, y: y + dy }; break; }
    if (!q) continue;
    LW.towns.add(i);
    if (q) {
      const cache = lwObject('reliquary', q.x, q.y, hash2(Z.seed, i + 170), { id, name: 'The Wayfarer’s Reliquary', lore: 'Travelers left a little light here for the next person on the road.', town });
      LW.marks.push(cache);
      lwObject('wisp', q.x - 45, q.y + 20, i + 5, { actor: true, homeX: q.x - 45, homeY: q.y + 20, target: cache, r: 2, phase: 'wait' }); LW.actors.push([...LW.objects].at(-1));
    }
    for (let j = 0; j < 4; j++) {
      const a = j * Math.PI / 2, px = x + Math.cos(a) * (town.plazaR + 1) * TS, py = (town.y + 0.5) * TS + Math.sin(a) * (town.plazaR + 1) * TS;
      if (lwGood(px, py, 6)) lwObject(j % 2 ? 'planter' : 'bench', px, py, hash2(Z.seed, i * 8 + j));
    }
  }
}
hook('realmZone', lwReset);
function lwCell(sx, sy) {
  const key = sx + ':' + sy; if (LW.cells.has(key)) return;
  const list = [], old = new Set(LW.objects), seed = hash2(W.Z.seed, hash2(sx + 91, sy + 31)), rng = new RNG(seed), size = 256;
  for (let i = 0; i < (CD.settings.lowFx ? 10 : 22); i++) {
    const x = sx * size + rng.range(8, size - 8), y = sy * size + rng.range(8, size - 8);
    if (!lwGood(x, y, 3)) continue;
    const gr = W.Z.ground[Math.floor(y / TS) * ZT + Math.floor(x / TS)];
    const road = gr === GR.ROAD || gr === GR.PLAZA;
    if (road && rng.chance(0.72)) continue;
    const detail = road ? 'pebbles' : rng.pick(['flowers', 'flowers', 'fern', 'mushrooms', 'log', 'pebbles', 'sapling', 'reeds']);
    lwObject(detail, x, y, rng.int(1, 1e6));
  }
  if (rng.chance(0.24)) {
    const x = sx * size + 128, y = sy * size + 128;
    if (lwGood(x, y, 12) && !inSettlement(x / TS, y / TS)) {
      const detail = rng.pick(['arch', 'campsite', 'stones']), name = { arch: 'The Broken Promise', campsite: 'An Abandoned Watch', stones: 'The Listening Stones' }[detail];
      const o = lwObject(detail, x, y, seed, { id: W.Z.id + ':landmark:' + key, name, lore: { arch: 'Wildflowers push through the old road. The doorway still frames the horizon.', campsite: 'The last watch left in a hurry. Their kettle has gone cold.', stones: 'Each stone carries a different mark. Together they point toward the old towns.' }[detail] }); LW.marks.push(o);
      lwObject('flowers', x - 15, y + 8, seed + 2); lwObject('mushrooms', x + 17, y + 5, seed + 3);
    }
  }
  if (LW.actors.filter((a) => a.detail !== 'wisp').length < (CD.settings.lowFx ? 12 : 28)) {
    const x = sx * size + 100, y = sy * size + 160;
    if (lwGood(x, y)) for (let i = 0; i < 3; i++) {
      const detail = rng.pick(['bird', 'rabbit', 'butterfly']), o = lwObject(detail, x + i * 8, y + i * 3, seed + i, { actor: true, group: key, homeX: x, homeY: y, r: 2, face: 1, vx: 0, vy: 0, phase: 'forage', t: rng.range(0, 4) }); LW.actors.push(o);
    }
  }
  for (const o of LW.objects) if (!old.has(o)) list.push(o);
  LW.cells.set(key, { sx, sy, objects: list });
}
function lwStream(force = false) {
  const p = G.p, sx = Math.floor(p.x / 256), sy = Math.floor(p.y / 256), max = ZT * TS / 256;
  let made = 0;
  for (let ring = 0; ring <= 1; ring++) for (let dy = -ring; dy <= ring; dy++) for (let dx = -ring; dx <= ring; dx++) {
    const x = sx + dx, y = sy + dy;
    if (x < 0 || y < 0 || x >= max || y >= max || LW.cells.has(x + ':' + y)) continue;
    if (!force && made >= 1) return;
    // Terrain is streamed by the base game; decorative probes never generate distant chunks.
    lwCell(x, y); made++;
  }
  for (const [key, cell] of LW.cells) if (Math.abs(cell.sx - sx) > 3 || Math.abs(cell.sy - sy) > 3) {
    for (const o of cell.objects) lwRemove(o); LW.cells.delete(key);
  }
  LW.actors = LW.actors.filter((a) => LW.objects.has(a)); LW.marks = LW.marks.filter((m) => LW.objects.has(m));
}

/* ---------- a small pixel-art vocabulary, cached by biome and variant ---------- */
const LW_ART = new Map();
function lwArt(o) {
  const [leaf, dark, accent, stone] = lwPal(), kind = o.detail, v = o.seed % 3, opened = kind === 'reliquary' && !!(W.ch && W.ch.living && W.ch.living.loot[o.id]);
  const key = W.Z.id + ':' + kind + ':' + v + ':' + opened;
  if (LW_ART.has(key)) return LW_ART.get(key);
  if (!rigBudgetOk(true)) return null;
  const start = performance.now(), p = new PP(56, 56), rng = new RNG(o.seed % 3 + 91), gy = 51;
  const T = (x, y, xx, yy, xxx, yyy, c) => p.poly([[x,y],[xx,yy],[xxx,yyy]], c);
  const R = (x, y, w, h, c) => p.rect(x, y, w, h, c), E = (x, y, rx, ry, c) => p.ell(x, y, rx, ry, c), L = (x, y, xx, yy, c) => p.line(x, y, xx, yy, c);
  switch (kind) {
    case 'flowers':
      for (let i = 0; i < 14; i++) { const x = rng.int(10, 44), y = rng.int(36, 50), h = rng.int(3, 8); L(x, y, x - 1, y - h, dark); R(x - 3, y - 3, 3, 1, leaf); p.disc(x, y - h, 1.5, [accent, '#eeb0ca', '#fff0ba'][i % 3]); p.px(x, y - h, '#fff5d8'); } break;
    case 'fern': case 'reeds':
      for (let i = -3; i <= 3; i++) { const x = 28 + i * 3, y = 34 + Math.abs(i) * 2; L(28, 51, x, y, dark); for (let j = 0; j < 4; j++) { L(x, y + j * 3, x - 4, y + j * 3 + 2, leaf); L(x, y + j * 3, x + 3, y + j * 3 + 2, leaf); } if (kind === 'reeds') R(x - 1, y - 4, 2, 6, stone); } break;
    case 'mushrooms':
      for (let i = 0; i < 5; i++) { const x = 16 + i * 6, y = 44 + (i % 2) * 5; R(x, y - 4, 2, 7, '#cfbda0'); E(x + 1, y - 5, 4, 2, i % 2 ? accent : '#c87b65'); p.px(x, y - 6, '#f4e7c8'); } break;
    case 'pebbles':
      for (let i = 0; i < 9; i++) { const x = rng.int(12, 44), y = rng.int(43, 52); E(x, y, rng.int(1, 3), 1, stone); p.px(x, y - 1, shade(stone, 0.3)); } break;
    case 'sapling':
      L(28, 51, 28, 31, stone); L(28, 39, 21, 32, stone); E(28, 28, 9, 7, dark); E(25, 25, 7, 5, leaf); E(32, 28, 5, 4, leaf); p.px(23, 23, accent); break;
    case 'log':
      R(12, 44, 30, 7, '#6f5139'); E(12, 47, 4, 4, '#b48b5c'); E(12, 47, 2, 2, '#785039'); L(18, 44, 39, 45, '#9b7952'); L(19, 49, 36, 49, '#493929'); R(25, 42, 10, 3, dark); R(26, 42, 5, 1, leaf); break;
    case 'planter':
      R(17, 43, 22, 8, '#8b5b46'); R(15, 40, 26, 4, '#b27650'); R(18, 41, 20, 1, '#382c28'); for (let i = 0; i < 5; i++) { L(20 + i * 4, 42, 20 + i * 4, 34 - i % 2 * 3, leaf); p.disc(20 + i * 4, 34 - i % 2 * 3, 2, i % 2 ? '#e4a5bc' : accent); } break;
    case 'bench':
      R(10, 39, 36, 3, '#a67b4e'); R(10, 34, 36, 3, '#986c42'); R(12, 31, 3, 20, '#564735'); R(41, 31, 3, 20, '#564735'); R(8, 45, 40, 3, '#bd8a55'); R(13, 48, 3, 5, '#655143'); R(40, 48, 3, 5, '#655143'); break;
    case 'signpost':
      R(27, 26, 3, 27, '#73593f'); R(14, 29, 25, 6, '#b38b56'); T(39, 29, 44, 32, 39, 35, '#b38b56'); L(18, 32, 33, 32, '#5b4b38'); R(20, 38, 23, 5, '#8c6b48'); T(20, 38, 15, 40, 20, 43, '#8c6b48'); break;
    case 'arch':
      R(7, 23, 10, 29, stone); R(39, 19, 10, 33, stone); R(9, 18, 11, 7, shade(stone, 0.2)); R(35, 14, 14, 8, shade(stone, 0.16)); R(17, 12, 13, 7, stone); R(29, 10, 10, 8, stone);
      for (let i = 0; i < 5; i++) { L(8, 26 + i * 5, 16, 26 + i * 5, shade(stone, -0.3)); L(40, 23 + i * 6, 47, 23 + i * 6, shade(stone, -0.3)); } L(42, 18, 41, 44, dark); for (let i = 0; i < 6; i++) E(42 + i % 2 * 3, 20 + i * 4, 3, 2, leaf); break;
    case 'stones':
      for (let i = 0; i < 5; i++) { const x = 11 + i * 8, y = 46 + Math.sin(i * 1.5) * 4; R(x - 3, y - 13, 6, 15, stone); L(x - 2, y - 12, x + 2, y - 12, shade(stone, 0.3)); L(x - 1, y - 8, x + 1, y - 4, accent); } break;
    case 'campsite':
      T(10, 48, 24, 23, 40, 48, '#957a52'); T(24, 23, 34, 48, 40, 48, '#5c5545'); T(22, 32, 20, 48, 29, 48, '#373c35'); L(7, 50, 14, 42, '#bd9a67'); R(37, 45, 13, 3, '#634a37'); E(42, 46, 3, 2, '#2e3638'); E(42, 50, 6, 2, stone); break;
    case 'reliquary':
      R(15, 47, 27, 5, stone); R(18, 43, 21, 5, shade(stone, 0.2)); R(21, 31, 15, 13, '#5a6575'); T(19, 31, 28, 23, 38, 31, stone); R(26, 32, 5, 8, opened ? '#667265' : accent); p.px(28, 34, '#fff1c1'); L(22, 42, 35, 42, '#c0a878'); E(16, 50, 5, 2, dark); E(41, 51, 5, 2, leaf); break;
    case 'bird':
      E(28, 46, 4, 3, '#7f9eac'); E(31, 43, 2, 2, '#b6ced0'); p.px(32, 42, '#211f2b'); L(32, 44, 35, 44, accent); L(24, 47, 21, 45, '#516479'); L(26, 49, 26, 51, '#9e7951'); break;
    case 'rabbit':
      E(27, 46, 6, 4, '#b5a28c'); E(32, 43, 3, 3, '#c8b9a3'); R(30, 35, 2, 7, '#d4c4b3'); R(33, 34, 2, 8, '#c9b5a4'); p.px(34, 42, '#28252d'); E(21, 46, 2, 2, '#eee0ce'); break;
    case 'butterfly':
      E(24, 43, 4, 4, accent); E(32, 43, 4, 4, '#dca0be'); E(25, 48, 3, 2, '#dca0be'); E(31, 48, 3, 2, accent); R(28, 41, 1, 9, '#3e3b4a'); break;
    case 'wisp':
      E(28, 43, 2, 4, '#c7fae5'); p.disc(28, 41, 3, '#7fdcd6'); p.disc(28, 40, 1, '#fff6cf'); p.px(25, 47, '#94d3d3'); break;
  }
  // Shrink first and outline after: outlining at full size and then halving left broken black specks.
  const scale = ['arch', 'stones'].includes(kind) ? 0.9 : kind === 'campsite' ? 0.8 : kind === 'reliquary' ? 0.7 : kind === 'bench' ? 0.7 : 0.5;
  const sp = lwShrink(p, scale).outline().sprite(Math.round(28 * scale), Math.round(52 * scale)); LW_ART.set(key, sp); RIG_BUDGET.spent += performance.now() - start; return sp;
}
// each small pixel keeps the first painted pixel of its block, so thin stems and petals survive
function lwShrink(p, scale) {
  const w = Math.round(p.w * scale), h = Math.round(p.h * scale), q = new PP(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const x0 = Math.floor(x / scale), x1 = Math.max(x0 + 1, Math.floor((x + 1) / scale)), y0 = Math.floor(y / scale), y1 = Math.max(y0 + 1, Math.floor((y + 1) / scale));
    find: for (let sy = y0; sy < Math.min(y1, p.h); sy++) for (let sx = x0; sx < Math.min(x1, p.w); sx++) { const v = p.d[sy * p.w + sx]; if (v >>> 24) { q.d[y * w + x] = v; break find; } }
  }
  return q;
}
const _objSpriteLW = objSprite;
objSprite = function (o, b) { if (o.kind === 'lw') return lwOn() ? lwArt(o) : null; return _objSpriteLW(o, b); };
const _drawObjLW = drawRealmObj;
drawRealmObj = function (g, o, sp, cx, cy, faded) {
  if (o.kind !== 'lw') {
    _drawObjLW(g, o, sp, cx, cy, faded);
    if (lwOn() && o.kind === 'building' && !faded) lwHouse(g, o, sp, cx, cy);
    return;
  }
  if (!lwOn() || !sp) return;
  const x = o.x - cx, y = o.y - cy, actor = o.actor, a = Math.atan2(o.vy || 0, o.vx || (o.face || 1)), flip = actor && Math.cos(a) < 0;
  const z = o.detail === 'wisp' ? 8 + Math.sin(G.t * 2 + o.seed) * 3 : o.detail === 'butterfly' ? 5 + Math.sin(G.t * 5 + o.seed) * 3 : o.detail === 'bird' && o.phase === 'flee' ? 7 : 0;
  if (!['flowers', 'fern', 'reeds', 'pebbles', 'mushrooms'].includes(o.detail)) shadow(g, x, y, actor ? 3 : o.detail === 'arch' ? 16 : 10, z);
  if (o.detail === 'wisp') { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.25 + Math.sin(G.t * 3) * 0.08; g.drawImage(LightTex.get('#7fe8d5', 0.3), x - 14, y - 25 - z, 28, 28); g.restore(); }
  drawSprite(g, sp, x, y - z, flip, { alpha: o.detail === 'wisp' && o.phase === 'rest' ? 0.35 : 1 });
  if (['arch', 'stones', 'campsite', 'reliquary'].includes(o.detail) && Math.hypot(o.x - G.p.x, o.y - G.p.y) < 48) {
    const collected = o.detail === 'reliquary' && W.ch.living && W.ch.living.loot[o.id];
    const text = pixelText(collected ? 'REMEMBERED' : o.detail === 'reliquary' ? 'RELIC CACHE' : 'LOOK CLOSER', collected ? '#9ba995' : '#efce83'); g.drawImage(text, Math.round(x - text.width / 2), Math.round(y - 37));
  }
};
function lwHouse(g, o, sp, cx, cy) {
  const x = Math.round(o.x - cx), y = Math.round(o.y - cy), v = o.bld.v || 0;
  g.save(); g.globalAlpha = 0.75;
  const left = x - sp.ax + 4, right = x - sp.ax + sp.w - 7, top = y - Math.min(24, sp.ay / 3);
  g.fillStyle = '#446b43'; for (let i = 0; i < 5; i++) g.fillRect(v % 2 ? left + i % 2 : right - i % 2, top + i * 3, 3, 2);
  g.fillStyle = '#a57854'; g.fillRect(left + 4, y - 5, 5, 4); g.fillStyle = '#82a65b'; g.fillRect(left + 3, y - 7, 7, 3);
  if (daylight() < 0.3) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = (0.3 - daylight()) * 0.8; g.drawImage(LightTex.get('#ffd399', 0.3), x - 26, y - 35, 52, 45); }
  g.restore();
}

/* ---------- ten small brains share one bounded neighborhood query ---------- */
function lwSay(n, text, seconds = 2.8) { n._lwSpeech = { text, until: W.t + seconds }; }
function lwWalk(n, x, y, speed, dt) {
  let dx = x - n.x, dy = y - n.y, d = Math.hypot(dx, dy);
  if (d < 4) { n.moving = false; return; }
  const ox = n.x, oy = n.y, step = Math.min(d, speed * dt);
  if (n._lwDetour && n._lwDetour.until > W.t) { dx = n._lwDetour.x; dy = n._lwDetour.y; d = 1; }
  const bumped = moveEnt(n, dx / d * step, dy / d * step);
  if (bumped && Math.hypot(n.x - ox, n.y - oy) < step * 0.2) { const a = Math.atan2(dy, dx) + (n.seed % 2 ? 1 : -1) * Math.PI / 2; n._lwDetour = { x: Math.cos(a), y: Math.sin(a), until: W.t + 0.7 }; }
  n.moving = Math.hypot(n.x - ox, n.y - oy) > 0.02;
  n.anim = (n.anim || 0) + dt * 3; n.face = dx < 0 ? -1 : 1; n.turn = pickTurn(n.turn, dx, dy); n.view = n.turn >= 3 ? 'back' : 'front';
}
function lwNpcGoal(n) {
  const night = daylight() < 0.22, town = n.town, seed = n.seed || 1, phase = Math.floor(W.t / 28);
  if (LW.wet) {
    const houses = town && town.buildings || [], near = houses.reduce((a, b) => !a || Math.hypot(b.doorX * TS - n.x, b.doorY * TS - n.y) < Math.hypot(a.doorX * TS - n.x, a.doorY * TS - n.y) ? b : a, null);
    lwSeen('shelter'); n._lwState = 'sheltering';
    if (near) return { x: (near.doorX + 0.5) * TS + ((seed % 5) - 2) * 5, y: (near.doorY + 0.6) * TS };
  }
  lwSeen('routine'); n._lwState = night ? 'heading home' : 'running errands';
  if (night) {
    const b = town && town.buildings && town.buildings[seed % town.buildings.length];
    if (b) return { x: (b.doorX + 0.5) * TS + (seed % 3 - 1) * 6, y: (b.doorY + 1.3) * TS };
  }
  const spots = town && town.spots || [], spot = spots[(seed + phase) % Math.max(1, spots.length)];
  if (spot && seed % 3) return { x: (spot.x + 0.5) * TS + (seed % 5 - 2) * 7, y: (spot.y + 2) * TS };
  const a = (seed % 100) * 0.063 + phase * 1.7, r = Math.min(n.roam || 60, 85);
  return { x: n.hx + Math.cos(a) * r, y: n.hy + Math.sin(a) * r };
}
const _npcsLW = updateNpcs;
updateNpcs = function (dt) {
  if (!lwBrain()) return _npcsLW(dt);
  const all = W.npcs, local = all.filter((n) => Math.hypot(n.x - G.p.x, n.y - G.p.y) < 560), handled = new Set(local.filter((n) => n.role === 'guard' || n.role === 'folk'));
  try { W.npcs = all.filter((n) => !handled.has(n)); _npcsLW(dt); } finally { W.npcs = all; }
  const threats = G.ents.filter((e) => e.world && !e.dead && e.aggro && !e.boss && Math.hypot(e.x - G.p.x, e.y - G.p.y) < 500);
  for (const n of handled) {
    n.t += dt; n._lwChoice = (n._lwChoice || 0) - dt;
    if (n.role === 'guard') {
      const foe = threats.reduce((a, e) => Math.hypot(e.x - n.x, e.y - n.y) < 130 && (!a || Math.hypot(e.x - n.x, e.y - n.y) < Math.hypot(a.x - n.x, a.y - n.y)) ? e : a, null);
      n._lwState = foe ? 'defending' : 'patrolling';
      if (foe) {
        lwSeen('guard'); lwWalk(n, foe.x, foe.y, 43, dt);
        n._lwStrike = (n._lwStrike || 0) - dt;
        if (n._lwStrike <= 0 && Math.hypot(foe.x - n.x, foe.y - n.y) < 22 && lineOfSight(G.fl, n.x, n.y, foe.x, foe.y)) {
          n._lwStrike = 1.5; damageEnemy(foe, Math.max(1, Math.min(foe.maxHp * 0.06, 4 + G.p.level * 0.7)), { src: 'guard', noCrit: true, kb: 20, ang: Math.atan2(foe.y - n.y, foe.x - n.x) });
          lwSay(n, 'Hold the road!'); ring(foe.x, foe.y - 6, 10, '#f1ce82', 0.2, 1);
        }
      } else {
        const a = Math.floor(W.t / 12 + (n.seed % 4)) * Math.PI / 2;
        lwWalk(n, n.hx + Math.cos(a) * 28, n.hy + Math.sin(a) * 22, 22, dt);
      }
      continue;
    }
    const danger = threats.find((e) => Math.hypot(e.x - n.x, e.y - n.y) < 95);
    if (danger) {
      const a = Math.atan2(n.y - danger.y, n.x - danger.x); lwWalk(n, n.x + Math.cos(a) * 50, n.y + Math.sin(a) * 50, 40, dt); n._lwState = 'fleeing'; n._lwSocial = null; continue;
    }
    if (n._lwSocial && n._lwSocial.until > W.t && !LW.wet) {
      const other = n._lwSocial.other; n.moving = false; n.turn = pickTurn(n.turn, other.x - n.x, other.y - n.y); n.face = other.x < n.x ? -1 : 1; n.view = n.turn >= 3 ? 'back' : 'front'; n._lwState = 'chatting'; continue;
    }
    if (n._lwChoice <= 0 || !n._lwGoal || n._lwWet !== LW.wet || n._lwNight !== (daylight() < 0.22)) {
      n._lwChoice = 5 + n.seed % 5; n._lwGoal = lwNpcGoal(n); n._lwWet = LW.wet; n._lwNight = daylight() < 0.22;
    }
    if (Math.hypot(n.x - G.p.x, n.y - G.p.y) < 18) { n.moving = false; n.turn = pickTurn(n.turn, G.p.x - n.x, G.p.y - n.y); continue; }
    lwWalk(n, n._lwGoal.x, n._lwGoal.y, LW.wet ? 35 : 23, dt);
  }
  // Each pair has a shared cooldown, so a busy market never becomes a speech wall.
  LW.socialT = (LW.socialT || 0) - dt;
  if (LW.socialT <= 0 && !LW.wet && !threats.length) {
    LW.socialT = 3.5;
    const folks = local.filter((n) => n.role === 'folk' && (n._lwTalkAt || 0) < W.t);
    outer: for (const n of folks) for (const other of folks) if (n !== other && Math.hypot(n.x - other.x, n.y - other.y) < 36) {
      const lines = daylight() < 0.22 ? ['The lanterns are lit. Time to head home.', 'Save me a seat by the fire.'] : LW.noise.length ? ['Did you hear that out on the road?', 'The watch will keep an eye on it.'] : ['Blue lights gather near the old stones.', 'I left flowers by the wayfarer’s shrine.'];
      n._lwSocial = { other, until: W.t + 4 }; other._lwSocial = { other: n, until: W.t + 4 };
      n._lwTalkAt = other._lwTalkAt = W.t + 25; lwSay(n, lines[0], 3.5); lwSay(other, lines[1], 3.5); lwSeen('social'); break outer;
    }
  }
};
function lwNoise(x, y, radius, kind) {
  if (!lwBrain()) return;
  LW.noise.push({ x, y, radius, kind, at: W.t }); if (LW.noise.length > 12) LW.noise.shift();
}
hook('onAttack', (p) => lwNoise(p.x, p.y, 175, 'weapon'));
const _beforeLW = mobsBeforeAI;
mobsBeforeAI = function (dt) {
  if (lwBrain()) for (const e of G.ents) {
    if (!e.world || e.dead || e.aggro || e.boss || e.dorm || e.rooted || e.evade > 0) continue;
    const noise = LW.noise.findLast((q) => W.t - q.at < 3 && Math.hypot(q.x - e.x, q.y - e.y) < q.radius);
    if (noise && e._lwHeard !== noise.at && lineOfSight(G.fl, e.x, e.y, noise.x, noise.y)) { e.wx = noise.x; e.wy = noise.y; e.wanderT = 3; e._lwHeard = noise.at; e._lwIntent = 'investigating'; lwSeen('noise'); }
  }
  return _beforeLW(dt);
};
const _wakeLW = wakeMob;
wakeMob = function (e) {
  const fresh = !e.aggro; _wakeLW(e);
  if (!fresh || !lwBrain() || !e.world || e.boss || (e._lwAlarmAt || -99) > W.t - 12) return;
  // Only one in three acts as a sentry; no recursive wake calls.
  if ((Math.floor(e.x / 8) + Math.floor(e.y / 8)) % 3) return;
  e._lwAlarmAt = W.t; let warned = 0;
  for (const q of G.ents) if (q !== e && q.world && !q.dead && !q.aggro && !q.boss && Math.hypot(q.x - e.x, q.y - e.y) < 165 && Math.hypot(q.x - G.p.x, q.y - G.p.y) < 300 && lineOfSight(G.fl, e.x, e.y, q.x, q.y)) { q.aggro = true; q.dorm = false; q.evade = 0; warned++; if (warned >= 3) break; }
  if (warned) { lwSeen('alarm'); addText(e.x, e.y - e.h - 9, 'ALARM', '#f6c77c', 1); ring(e.x, e.y, 35, '#f6c77c', 0.4, 1); }
};
function lwThinkEnemies() {
  const p = G.p, near = G.ents.filter((e) => e.world && !e.dead && e.aggro && !e.boss && !e.rooted && !e.def.range && Math.hypot(e.x - p.x, e.y - p.y) < 220).slice(0, 24);
  for (const [i, e] of near.entries()) {
    const danger = e.hp / e.maxHp < 0.28 && !e.def.bone && !e.def.ghostly;
    if (danger && (e._lwBraveAt || 0) <= W.t) { e._lwRetreat = W.t + 2.2; e._lwBraveAt = W.t + 18; lwSeen('morale'); addText(e.x, e.y - e.h - 5, 'RETREAT', '#e3c78b', 0.8); }
    if ((e._lwRetreat || 0) > W.t) {
      const buddy = near.find((q) => q !== e && q.hp > q.maxHp * 0.5 && Math.hypot(q.x - e.x, q.y - e.y) < 110);
      const a = Math.atan2(e.y - p.y, e.x - p.x);
      e._lwGoal = buddy && Math.hypot(buddy.x - p.x, buddy.y - p.y) > Math.hypot(e.x - p.x, e.y - p.y) + 15 ? { x: buddy.x, y: buddy.y } : { x: e.x + Math.cos(a) * 70, y: e.y + Math.sin(a) * 70 };
      e._lwIntent = 'retreating';
    } else if (near.length >= 2 && Math.hypot(e.x - p.x, e.y - p.y) > e.r + 25) {
      const a = Math.atan2(e.y - p.y, e.x - p.x) + (i % 2 ? 1 : -1) * 0.65, r = Math.min(46, 24 + e.r);
      e._lwGoal = { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r }; e._lwIntent = 'flanking'; lwSeen('flank');
    } else { e._lwGoal = null; e._lwIntent = 'pursuing'; }
    e._lwPlanAt = W.t;
  }
}
const _steerLW = steerTo;
steerTo = function (e, x, y) {
  if (lwBrain() && e.world && e.aggro && !e.boss && e._lwGoal && W.t - e._lwPlanAt < 0.7 && e.st !== 'act' && e.st !== 'windup' && e.st !== 'lunge' && Math.hypot(x - G.p.x, y - G.p.y) < 2) return _steerLW(e, e._lwGoal.x, e._lwGoal.y);
  return _steerLW(e, x, y);
};
function lwActors(dt) {
  const p = G.p, noise = LW.noise.findLast((q) => W.t - q.at < 1.5);
  for (const o of LW.actors) {
    if (Math.hypot(o.x - p.x, o.y - p.y) > 800) continue;
    const ox = o.x, oy = o.y; o.t = (o.t || 0) + dt;
    if (!lwBrain()) continue;
    if (o.detail === 'wisp') {
      const claimed = W.ch && W.ch.living && W.ch.living.loot[o.target.id], d = Math.hypot(o.x - p.x, o.y - p.y), to = Math.hypot(o.target.x - o.x, o.target.y - o.y);
      if (claimed) o.phase = 'rest';
      else if (d < 78 && to > 18 && !p.dead) {
        o.phase = 'guide'; const a = Math.atan2(o.target.y - o.y, o.target.x - o.x); o.x += Math.cos(a) * dt * 18; o.y += Math.sin(a) * dt * 18;
        if (!o.noticed) { o.noticed = true; lwSeen('guide'); lwNote('A lantern wisp waited, then drifted toward a wayside reliquary.'); }
      } else if (!claimed && to <= 18) { o.phase = 'reveal'; o.x = o.target.x + Math.cos(o.t * 1.6) * 12; o.y = o.target.y + Math.sin(o.t * 1.6) * 7; }
      else o.phase = 'wait';
    } else {
      const d = Math.hypot(o.x - p.x, o.y - p.y), threat = !p.dead && (d < (p.moving ? 55 : 25) || noise && Math.hypot(o.x - noise.x, o.y - noise.y) < 110);
      if (threat) { if (o.phase !== 'flee') lwSeen('flock'); o.phase = 'flee'; o.fleeUntil = W.t + 2.2; }
      let tx, ty, speed;
      if ((o.fleeUntil || 0) > W.t) { const a = Math.atan2(o.y - p.y, o.x - p.x) + (o.seed % 3 - 1) * 0.4; tx = o.x + Math.cos(a) * 45; ty = o.y + Math.sin(a) * 45; speed = o.detail === 'bird' ? 57 : 43; }
      else {
        o.phase = Math.hypot(o.x - o.homeX, o.y - o.homeY) > 65 ? 'regroup' : 'forage';
        const a = Math.floor(o.t / 3 + o.seed % 10) * 1.7; tx = o.homeX + Math.cos(a) * 24 + o.seed % 7; ty = o.homeY + Math.sin(a) * 20; speed = o.phase === 'regroup' ? 25 : o.detail === 'butterfly' ? 17 : 9;
        const flock = LW.actors.filter((q) => q !== o && q.group === o.group && Math.hypot(q.x - o.x, q.y - o.y) < 65);
        if (flock.length) { tx = lerp(tx, flock.reduce((n, q) => n + q.x, 0) / flock.length, 0.25); ty = lerp(ty, flock.reduce((n, q) => n + q.y, 0) / flock.length, 0.25); }
        for (const q of flock) if (Math.hypot(q.x - o.x, q.y - o.y) < 7) { tx += (o.x - q.x) * 2; ty += (o.y - q.y) * 2; }
      }
      const d2 = Math.hypot(tx - o.x, ty - o.y);
      if (d2 > 2) {
        const nx = o.x + (tx - o.x) / d2 * Math.min(d2, speed * dt), ny = o.y + (ty - o.y) / d2 * Math.min(d2, speed * dt);
        if (lwGood(nx, o.y, 2)) o.x = nx; if (lwGood(o.x, ny, 2)) o.y = ny;
      }
    }
    o.vx = (o.x - ox) / Math.max(0.001, dt); o.vy = (o.y - oy) / Math.max(0.001, dt); if (Math.abs(o.vx) > 1) o.face = o.vx < 0 ? -1 : 1; lwRebucket(o);
  }
}

/* ---------- weather fronts, tracks, ambient light and a readable world ---------- */
const _weatherLW = weatherKey;
weatherKey = function () {
  const base = _weatherLW(); if (!lwOn()) return base;
  const phase = (Math.floor(W.t / 95) + (hashStr(W.Z.id) >>> 0) % 5) % 5;
  if (/meadows|whisper|elderwood|jungle|mangrove|highland|coast|fey/.test(W.Z.id) && phase === 2) return 'rain';
  if (/frost|tundra|alpine|glacier/.test(W.Z.id) && phase === 2) return 'blizzard';
  return base;
};
function lwEnvironment(dt) {
  const weather = weatherKey(); LW.weather = weather; LW.wet = /rain|blizzard/.test(weather);
  LW.noise = LW.noise.filter((q) => W.t - q.at < 4);
  LW.tracks = LW.tracks.filter((q) => W.t - q.at < 15);
  const p = G.p;
  LW.step -= dt;
  if (p.moving && !p.dead && LW.step <= 0) {
    LW.step = p.mounted ? 0.22 : 0.3;
    const a = Math.atan2(p.vy, p.vx), side = (LW.foot = !(LW.foot || false)) ? 1 : -1;
    if (!CD.settings.lowFx && !p.fly) LW.tracks.push({ x: p.x + Math.cos(a + Math.PI / 2) * 2 * side, y: p.y + Math.sin(a + Math.PI / 2) * 2 * side, a, at: W.t, water: tileAt(G.fl, Math.floor(p.x / TS), Math.floor(p.y / TS)) === TILE.SHALLOW });
    if (LW.tracks.length > 96) LW.tracks.shift();
    if (Math.hypot(p.vx, p.vy) > 30) lwNoise(p.x, p.y, p.mounted ? 100 : 60, 'footsteps');
  }
  LW.stream -= dt; if (LW.stream <= 0) { LW.stream = 0.18; lwTownDetails(); lwStream(); }
  LW.tick -= dt;
  if (LW.tick <= 0) {
    LW.tick = 0.3; if (lwBrain()) lwThinkEnemies();
    for (const m of LW.marks) if (m.id && m.detail !== 'reliquary' && Math.hypot(m.x - p.x, m.y - p.y) < 45) {
      const book = W.ch && W.ch.living;
      if (!book || !book.found[m.id]) { lwNote('Found ' + m.name + '. ' + m.lore, m.id); toast(m.name + ' · added to your field journal', '#d6d99e'); }
    }
    lwRibbon();
  }
  lwActors(dt);
}
hook('update', (dt) => {
  if (!lwOn()) { if (LW.ribbon) LW.ribbon.hidden = true; return; }
  if (LW.Z !== W.Z) lwReset(W.Z);
  lwEnvironment(dt);
});
hook('renderFloor', (g, cx, cy) => {
  if (!lwOn()) return;
  g.save();
  if (!CD.settings.lowFx) {
    for (const q of LW.tracks) {
      const age = W.t - q.at; g.globalAlpha = Math.max(0, 1 - age / 15) * (q.water ? 0.4 : 0.23);
      if (q.water) { g.strokeStyle = '#c3e5e5'; g.lineWidth = 0.5; g.beginPath(); g.ellipse(q.x - cx, q.y - cy, 2 + age * 1.3, 1 + age * 0.6, 0, 0, TAU); g.stroke(); }
      else { g.fillStyle = LW.wet ? '#2f3a39' : '#4c4938'; g.save(); g.translate(Math.round(q.x - cx), Math.round(q.y - cy)); g.rotate(q.a); g.fillRect(-2, -1, 4, 2); g.restore(); }
    }
    // Drifting cloud shadows and a thin ground haze follow the ground through camera turns.
    if (daylight() > 0.3) for (let i = 0; i < 3; i++) {
      const x = ((G.cam.x * 0.15 + W.t * 3 + i * 171) % (R.VW + 180)) - 90, y = ((G.cam.y * 0.1 + i * 97) % (R.VH + 100)) - 50;
      g.globalAlpha = LW.wet ? 0.1 : 0.045; g.fillStyle = '#182b3b'; g.beginPath(); g.ellipse(x, y, 65 + i * 15, 23, -0.2, 0, TAU); g.fill();
    }
    if (LW.wet) {
      g.globalAlpha = 0.15; g.strokeStyle = '#afc6cc'; g.lineWidth = 0.5;
      for (let i = 0; i < 20; i++) { const x = ((hash2(W.Z.seed, i) >>> 0) % R.VW), y = ((hash2(i + 3, W.Z.seed) >>> 0) % R.VH), r = (W.t * 9 + i * 0.7) % 5; g.beginPath(); g.ellipse(x, y, r, r * 0.4, 0, 0, TAU); g.stroke(); }
    }
  }
  g.restore();
});
const _npcDrawLW = drawNpc;
drawNpc = function (g, n, cx, cy) {
  _npcDrawLW(g, n, cx, cy); if (!lwOn()) return;
  const x = n.x - cx, y = n.y - cy;
  if (daylight() < 0.25 && n.role === 'guard') {
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.3; g.drawImage(LightTex.get('#ffd399', 0.3), x - 12, y - 34, 32, 32); g.restore(); g.fillStyle = '#f1ca72'; g.fillRect(Math.round(x + n.face * 7), Math.round(y - 16), 2, 4);
  }
  if (lwBrain() && n._lwSpeech && n._lwSpeech.until > W.t && Math.hypot(n.x - G.p.x, n.y - G.p.y) < 130) {
    const t = speechText(n._lwSpeech.text, 65); g.save(); g.globalAlpha = Math.min(0.95, (n._lwSpeech.until - W.t) * 2); g.fillStyle = '#ece1c7'; g.fillRect(Math.round(x - t.width / 2 - 3), Math.round(y - 33 - t.height), t.width + 6, t.height + 6); g.drawImage(t, Math.round(x - t.width / 2), Math.round(y - 30 - t.height)); g.restore();
  }
};
const _talkLW = talkTo;
talkTo = function (n) {
  if (!lwBrain() || !['folk', 'guard'].includes(n.role)) return _talkLW(n);
  const unclaimed = LW.marks.find((m) => m.detail === 'reliquary' && !(W.ch.living && W.ch.living.loot[m.id]));
  const text = LW.wet ? 'The weather has turned. We are keeping close to the doorways.' : n.role === 'guard' ? (G.combat ? 'Stay behind the watch. We will hold this road.' : 'Listen before you rush a camp. One sentry can warn the others.') : daylight() < 0.22 ? 'Shops keep their doors open for travelers, but the rest of us are heading home.' : unclaimed ? 'Follow the blue lantern wisp. It knows where the travelers left their offerings.' : 'The old stones have stories. Your field journal will remember them.';
  W.say = { npc: n, text, t: 4 }; Sound.play('ui', { p: 1.2 });
};
function lwRibbon() {
  if (!LW.ribbon || !LW.ribbon.isConnected) {
    LW.ribbon = h('div', { class: 'lw-ribbon', style: { position: 'absolute', top: '8px', left: '50%', transform: 'translateX(-50%)', maxWidth: '42%', padding: '5px 10px', borderRadius: '4px', color: '#e7d8ac', background: 'rgba(17,26,26,.73)', borderBottom: '1px solid #8fa078', font: '11px/1.35 sans-serif', textAlign: 'center', pointerEvents: 'none' } }); $('hud').append(LW.ribbon);
  }
  LW.ribbon.hidden = !lwOn();
  LW.ribbon.style.top = R.cssW < 600 ? '192px' : '8px'; LW.ribbon.style.maxWidth = R.cssW < 600 ? '70%' : '42%';
  const t = realmTime(), time = t < 0.18 || t > 0.82 ? 'Night watch' : t < 0.35 ? 'Daybreak' : t < 0.65 ? 'Daylight' : 'Evening';
  const wx = LW.wet ? LW.weather === 'blizzard' ? 'Snowfall' : 'Rainfront' : /ash|core/.test(LW.weather) ? 'Drifting embers' : /sand|dust/.test(LW.weather) ? 'Dry winds' : 'Fair skies';
  LW.ribbon.textContent = 'LIVING REALM · ' + time + ' · ' + wx;
}

/* ---------- discoveries pay once per hero; the journal and art survive independently ---------- */
// the reliquaries, landmarks and stones of the living Realm
interactable({
  near(p, best) {
    if (!lwOn()) return best;
    let d0 = best ? 15 : 31;
    for (const o of LW.marks) { const d = Math.hypot(o.x - p.x, o.y - p.y); if (d < d0) { d0 = d; best = { kind: 'living', o }; } }
    return best;
  },
  prompt: (t) => (t.kind === 'living' ? t.o.detail === 'reliquary' ? W.ch.living && W.ch.living.loot[t.o.id] ? 'Read the old inscription' : 'Open the relic cache' : 'Read ' + t.o.name : null),
  use(t) { if (t.kind !== 'living' || !lwOn()) return false; lwUse(t); return true; },
});
function lwUse(t) {
  const o = t.o, book = lwBook();
  if (o.detail === 'reliquary' && !book.loot[o.id]) {
    book.loot[o.id] = true; lwNote('Opened ' + o.name + '. ' + o.lore, o.id); LW_ART.clear();
    const level = clamp(G.p.level, W.Z.b.lvl[0], W.Z.b.lvl[1]), rng = new RNG(hashStr(o.id));
    for (let i = 0; i < 5; i++) dropPickup('gold', o.x + (i - 2) * 4, o.y + 6, 2 + Math.floor(level / 3));
    dropPickup('ember', o.x, o.y + 8, 2); spawnItem(realmLoot(rng, level, 'uncommon'), o.x + 12, o.y + 12);
    Sound.play('chest'); burst(o.x, o.y - 12, 20, ['#c9fff1', '#eaca7e', '#ffffff'], { smax: 70, glow: true });
    toast('A gift for the next traveler · field journal updated', '#e4d092'); saveRealm(true); return;
  }
  lwNote(o.name + ': ' + o.lore, o.id); toast(o.name + ': ' + o.lore, '#d8d9ba');
}
UI.livingJournal = function () {
  if (!lwOn()) return;
  const book = lwBook(), discovered = Object.keys(book.found).length, collected = Object.keys(book.loot).length;
  const goal = LW.marks.filter((m) => m.detail === 'reliquary' && !book.loot[m.id]).sort((a, b) => Math.hypot(a.x - G.p.x, a.y - G.p.y) - Math.hypot(b.x - G.p.x, b.y - G.p.y))[0];
  const close = () => UI.close(el), el = h('div', { class: 'modal' }, h('div', { class: 'panel wide' },
    h('p', { style: { color: '#a6bb8d', letterSpacing: '0.16em', fontSize: '12px', marginBottom: '4px' } }, 'CINDERDEEP · THE LIVING REALM'),
    h('h2', {}, 'Field Journal'),
    h('p', {}, W.Z.b.name + ' · ' + discovered + ' discoveries · ' + collected + ' relic caches opened'),
    h('p', {}, 'Follow blue wisps, inspect old stonework, and watch the roads. This world keeps moving around you.'),
    goal ? btn('Track a nearby relic cache', () => { W.ch.wp = { zone: W.Z.id, x: goal.x, y: goal.y, label: 'Wayfarer’s Reliquary' }; W.ch.track = 'wp'; saveRealm(); UI.close(el); toast('Relic cache marked on your compass', '#93e1cf'); }) : h('p', {}, 'Every known wayside cache in this land has been opened.'),
    h('h3', {}, 'Ten signs of life'),
    h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(225px,1fr))', gap: '10px' } }, ...LW_BRAINS.map(([id, name, desc], i) => h('div', { style: { border: '1px solid #53604b', background: 'rgba(102,132,88,.08)', padding: '10px', borderRadius: '6px' } }, h('strong', { style: { color: '#d7dbb7' } }, String(i + 1).padStart(2, '0') + ' · ' + name), h('p', { style: { margin: '6px 0', fontSize: '14px' } }, desc), h('small', { style: { color: LW.stats[id] ? '#a9d49d' : '#9d9b91' } }, LW.stats[id] ? 'Observed in this land' : 'Watch for this behavior')))),
    h('h3', {}, 'Travel notes'),
    ...(book.journal.length ? book.journal.slice(0, 16).map((entry) => h('p', {}, 'Day ' + entry.day + ' · ' + (BIOME[entry.zone] ? BIOME[entry.zone].name : entry.zone) + ' — ' + entry.text)) : [h('p', {}, 'Your first discovery starts the journal. Look for a blue wisp near town.')]),
    h('div', { class: 'row' }, btn('Back to the Realm', close, 'primary'))));
  UI.open(el, { modal: true, replace: false, onBack: close });
};
pauseItem('journal', 40, (el) => (lwOn() ? btn('Field Journal · Living Realm', () => { UI.close(el); UI.livingJournal(); }) : null));
[['livingWorld', 'Living Realm: scenery, wildlife and discoveries'], ['livingBrains', 'Living Realm: ten intelligent behaviors']].forEach(([key, label], i) => settingsRow(key, 30 + i, () => h('label', { class: 'set-row' }, label,
  h('input', { type: 'checkbox', checked: CD.settings[key] !== false, onchange: (e) => {
    CD.settings[key] = e.target.checked; CD.save.settings = { ...CD.settings }; persist();
    if (LW.ribbon) LW.ribbon.hidden = !lwOn();
    if (!e.target.checked) for (const n of W.npcs || []) { n._lwSocial = null; n._lwSpeech = null; n._lwChoice = 0; }
    if (key === 'livingWorld' && e.target.checked && W.Z && lwOn()) lwReset(W.Z);
  } }))));
CD.living = { get brains() { return LW_BRAINS.map(([id, name]) => ({ id, name, observed: !!LW.stats[id] })); }, get details() { return LW.objects.size; }, get actors() { return LW.actors.length; }, journal: () => UI.livingJournal() };

