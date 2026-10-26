/* ============================================================
   Cinderdeep — Realm quality of life: a compass to your tracked
   quest or waypoint, waypoints set from the map, quest tracking,
   selling spare weapons, buff timers on the HUD, quieter toasts.
   ============================================================ */

/* ---------- quieter toasts: no repeats, small combos stay quiet in the Realm ---------- */
const _toastQoL = toast;
const TOAST_SEEN = new Map();
toast = function (msg, color) {
  const m = String(msg), now = performance.now();
  const combo = /^Combo ended at ×(\d+)/.exec(m);
  if (combo && W.on && +combo[1] < 15) return;
  const last = TOAST_SEEN.get(m);
  if (last && now - last < 2500) return;
  TOAST_SEEN.set(m, now);
  if (TOAST_SEEN.size > 60) for (const [k, t] of TOAST_SEEN) if (now - t > 5000) TOAST_SEEN.delete(k);
  return _toastQoL(msg, color);
};

/* ---------- where things are ---------- */
function gatePos(g, label) {
  const x = g.dir === 'w' ? 2 : g.dir === 'e' ? ZT - 3 : g.inX, y = g.dir === 'n' ? 2 : g.dir === 's' ? ZT - 3 : g.inY;
  return { x: (x + 0.5) * TS, y: (y + 0.5) * TS, label };
}
// the gate that leads closest to a zone somewhere else in the realm
function gateToward(Z, zoneId) {
  const tb = BIOME[zoneId];
  if (!tb) return null;
  let best = null, bd = 1e9;
  for (const g of Z.gates) { const nb = BIOME[g.to]; const d = Math.abs(nb.at[0] - tb.at[0]) + Math.abs(nb.at[1] - tb.at[1]); if (d < bd) { bd = d; best = g; } }
  return best;
}
function questTarget(q) {
  const Z = W.Z, p = G.p;
  if (!Z || !q) return null;
  if (q.kind === 'zone') { if (q.target === Z.id) return null; const g = gateToward(Z, q.target); return g && gatePos(g, `toward ${BIOME[q.target].name}`); }
  if (q.zone && q.zone !== Z.id) { const g = gateToward(Z, q.zone); return g && gatePos(g, `toward ${BIOME[q.zone].name}`); }
  if (q.kind === 'explore') { const m = Z.marks.find((mm) => mm.id === q.target); return m && { x: (m.x + 0.5) * TS, y: (m.y + 0.5) * TS, label: m.name }; }
  if (q.kind === 'inst') return { x: (Z.dungeon.x + 0.5) * TS, y: (Z.dungeon.y + 0.5) * TS, label: Z.dungeon.name };
  if (q.kind === 'boss') return { x: (Z.lair.x + 0.5) * TS, y: (Z.lair.y + 0.5) * TS, label: 'the lair' };
  if (q.kind === 'kill') {
    // the nearest of them already about, else the nearest camp of them
    let best = null, bd = 1e9;
    for (const e of G.ents) if (!e.dead && e.kind === q.target) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; best = { x: e.x, y: e.y, label: ENEMIES[q.target].name }; } }
    if (best) return best;
    for (const c of Z.camps) if (c.kind === q.target) { const x = (c.x + 0.5) * TS, y = (c.y + 0.5) * TS, d = Math.hypot(x - p.x, y - p.y); if (d < bd) { bd = d; best = { x, y, label: `${ENEMIES[q.target].name} camp` }; } }
    return best;
  }
  return null;
}
// what the compass points at: your waypoint, or the quest you track, or your first quest with somewhere to go
function trackedTarget() {
  const ch = W.ch;
  if (!ch || !W.Z) return null;
  if (ch.wp && ch.track !== 'quests') {
    if (ch.wp.zone === W.Z.id) return { x: ch.wp.x, y: ch.wp.y, label: 'Waypoint', wp: true };
    const g = gateToward(W.Z, ch.wp.zone);
    if (g) return { ...gatePos(g, `waypoint in ${BIOME[ch.wp.zone].name}`), wp: true };
  }
  const qs = ch.quests || [];
  const q = qs.find((x) => x.id === ch.track) || qs.find((x) => questTarget(x));
  const t = q && questTarget(q);
  return t ? { ...t, quest: q } : null;
}

/* ---------- the compass ---------- */
hook('update', () => {
  if (!W.on || W.inInst || !W.ch || !W.ch.wp || !W.Z || !G.p) return;
  const wp = W.ch.wp;
  if (wp.zone === W.Z.id && Math.hypot(wp.x - G.p.x, wp.y - G.p.y) < 3 * TS) { W.ch.wp = null; toast('Waypoint reached', '#7fe8ff'); Sound.play('pickup', { p: 1.3 }); }
});
hook('renderTop', (g, cx, cy) => {
  if (!W.on || W.inInst || !G.fl || !G.fl.realm || !G.p || G.p.dead || CD.settings.compass === false) return;
  const t = W.compassT && W.compassT.at > G.t - 0.25 ? W.compassT.t : (W.compassT = { at: G.t, t: trackedTarget() }).t;
  if (!t) return;
  const VW = R.VW, VH = R.VH, sx = t.x - cx, sy = t.y - cy, col = t.wp ? '#7fe8ff' : '#ffd35c';
  const dist = Math.round(Math.hypot(t.x - G.p.x, t.y - G.p.y) / TS);
  const label = pixelText(`${t.label.toUpperCase().slice(0, 22)} ${dist}M`, col);
  if (sx > 24 && sx < VW - 24 && sy > 40 && sy < VH - 24) {
    // on screen: a bobbing marker over the spot
    const by = Math.round(sy - 26 + Math.sin(G.t * 4) * 3);
    g.fillStyle = '#0b0709'; g.beginPath(); g.moveTo(sx, by + 9); g.lineTo(sx - 7, by); g.lineTo(sx, by - 7); g.lineTo(sx + 7, by); g.closePath(); g.fill();
    g.fillStyle = col; g.beginPath(); g.moveTo(sx, by + 6); g.lineTo(sx - 5, by); g.lineTo(sx, by - 5); g.lineTo(sx + 5, by); g.closePath(); g.fill();
    if (dist > 2) g.drawImage(label, Math.round(sx - label.width / 2), by - 18);
    return;
  }
  // off screen: an arrow on the edge pointing the way
  const px = G.p.x - cx, py = G.p.y - 12 - cy, a = Math.atan2(sy - py, sx - px), m = 16, top = 34, bottom = 30;
  const k = Math.max(20, Math.min(Math.abs((Math.cos(a) > 0 ? VW - m - px : px - m) / (Math.cos(a) || 1e-6)), Math.abs((Math.sin(a) > 0 ? VH - bottom - py : py - top) / (Math.sin(a) || 1e-6))));
  const ax = px + Math.cos(a) * k, ay = py + Math.sin(a) * k;
  g.save(); g.translate(Math.round(ax), Math.round(ay)); g.rotate(a);
  g.fillStyle = '#0b0709'; g.beginPath(); g.moveTo(12, 0); g.lineTo(-7, -9); g.lineTo(-3, 0); g.lineTo(-7, 9); g.closePath(); g.fill();
  g.fillStyle = col; g.beginPath(); g.moveTo(9, 0); g.lineTo(-5, -6); g.lineTo(-2, 0); g.lineTo(-5, 6); g.closePath(); g.fill();
  g.restore();
  const lx = clamp(Math.round(ax - label.width / 2), 4, VW - label.width - 4), ly = clamp(Math.round(ay + (Math.sin(a) > 0.3 ? -22 : 14)), 4, VH - 12);
  g.globalAlpha = 0.85; g.fillStyle = '#0b0709'; g.fillRect(lx - 2, ly - 1, label.width + 4, label.height + 2); g.globalAlpha = 1;
  g.drawImage(label, lx, ly);
});

/* ---------- waypoints from the map, tracking from the quest list ---------- */
const _realmMapQoL = UI.realmMap;
UI.realmMap = function (tab = 'zone') {
  _realmMapQoL(tab);
  const el = UI.top();
  if (!el || !el._isMap) return;
  if (tab === 'zone') {
    const cv = el.querySelector('canvas.zmap');
    if (!cv) return;
    const N = cv.width, g = cv.getContext('2d'), k = N / ZT, wp = W.ch.wp;
    // the waypoint and the tracked spot
    const mark = (x, y, c) => { const mx = Math.round((x / TS) * k), my = Math.round((y / TS) * k); g.fillStyle = '#0b0709'; g.fillRect(mx - 4, my - 4, 9, 9); g.fillStyle = c; g.fillRect(mx - 3, my - 3, 7, 7); g.fillStyle = '#0b0709'; g.fillRect(mx - 1, my - 1, 3, 3); };
    if (wp && wp.zone === W.Z.id) mark(wp.x, wp.y, '#7fe8ff');
    const t = trackedTarget(); if (t && !t.wp) mark(t.x, t.y, '#ffd35c');
    cv.style.cursor = 'crosshair';
    cv.title = 'Tap to set a waypoint';
    cv.addEventListener('click', (e) => {
      const r = cv.getBoundingClientRect(), tx = ((e.clientX - r.left) / r.width) * ZT, ty = ((e.clientY - r.top) / r.height) * ZT;
      W.ch.wp = { zone: W.Z.id, x: clamp(tx, 4, ZT - 4) * TS, y: clamp(ty, 4, ZT - 4) * TS }; W.ch.track = 'wp';
      Sound.play('ui', { p: 1.4 }); saveRealm();
      UI.close(el); UI.realmMap('zone');
    });
    const row = el.querySelector('.row');
    if (row) {
      row.prepend(h('small', { class: 'wp-hint' }, wp ? '' : 'Tap the map to set a waypoint.'));
      if (wp) row.prepend(btn('Clear waypoint', () => { W.ch.wp = null; saveRealm(); UI.close(el); UI.realmMap('zone'); }, 'small'));
    }
  }
};
questList = function () {
  const qs = W.ch.quests || [];
  if (!qs.length) return h('p', {}, 'No quests. Quest boards in every town have work, and guilds pay for bounties.');
  const tracked = (q) => W.ch.track === q.id || (W.ch.track !== 'wp' && !qs.some((x) => x.id === W.ch.track) && qs.find((x) => questTarget(x)) === q);
  return h('div', { class: 'quests' }, ...qs.map((q) => h('div', { class: 'quest' }, h('b', {}, `${tracked(q) ? '▸ ' : ''}${q.name}`), h('small', {}, `${q.desc} · ${q.have || 0}/${q.need} · ${BIOME[q.zone] ? BIOME[q.zone].name : ''}`),
    btn(tracked(q) && !W.ch.wp ? 'Tracked' : 'Track', () => { W.ch.track = q.id; if (W.ch.wp) W.ch.wp = null; saveRealm(); const el = UI.top(); if (el) { UI.close(el); UI.realmMap('quests'); } }, tracked(q) ? 'small primary' : 'small'))));
};

/* ---------- selling ---------- */
const SELL_BASE = { natural: 0, common: 12, uncommon: 30, rare: 70, epic: 150, legendary: 300, evolved: 480 };
function sellPrice(w) {
  const L = Math.max(1, G.p ? G.p.level : 1);
  return Math.round((SELL_BASE[w.rar] ?? 10) * (1 + (w.lvl || 0) * 0.25) * (1 + L * 0.03));
}
function sellRows(menu, p, redraw) {
  if (p.beast) return;
  const off = p.weapons.length > 1 ? p.weapons[1 - p.wi] : null;
  if (off && off.rar !== 'natural') menu.append(btn(`Sell ${weaponName(off)} · ${sellPrice(off)}g`, () => {
    UI.confirm(`Sell ${weaponName(off)}?`, `${RARITY[off.rar].name}${off.lvl ? ` +${off.lvl}` : ''}. You get ${sellPrice(off)} gold. It cannot be bought back.`, 'Sell', () => {
      const price = sellPrice(off); p.weapons = p.weapons.filter((w) => w !== off); p.wi = Math.max(0, p.weapons.indexOf(p.weapon)); p.gold += price; recalcStats(p); Sound.play('coin'); saveRealm(); redraw();
    });
  }));
  // weapons lying at your feet
  const near = G.items.filter((it) => it.type === 'weapon' && it.w && !it.shop && !it.price && Math.hypot(it.x - p.x, it.y - p.y) < 64);
  if (near.length) { const total = near.reduce((a, it) => a + sellPrice(it.w), 0); menu.append(btn(`Sell the ${near.length} weapon${near.length > 1 ? 's' : ''} at your feet · ${total}g`, () => { G.items = G.items.filter((it) => !near.includes(it)); p.gold += total; Sound.play('coin'); saveRealm(); redraw(); })); }
}

/* ---------- buffs and penalties on the HUD ---------- */
const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
function buffChips() {
  const p = G.p, out = [];
  if (!p) return '';
  if (p.weakT > 0) out.push(`<span style="color:#ff8a8a">Weak ${mmss(p.weakT)}</span>`);
  if (p.blessT > 0 && p.bless && BLESSINGS[p.bless]) out.push(`<span style="color:#fff6c8">${esc(BLESSINGS[p.bless].name.replace('Blessing of ', ''))} ${mmss(p.blessT)}</span>`);
  if (p.restedT > 0) out.push(`<span style="color:#7de08a">Rested ${mmss(p.restedT)}</span>`);
  return out.join('');
}

