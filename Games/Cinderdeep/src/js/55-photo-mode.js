/* ============================================================
   Cinderdeep — Turn the World, phase 1: paused Realm dioramas
   The camera is session-only; positions and saves stay in world space.
   ============================================================ */
const DIORAMA = { enabled: true, active: false, yaw: 0, el: null };
function dioramaRealm() { return W.on && !W.inInst && W.Z && G.fl && G.fl.realm && G.p && G.mode === 'play'; }
function dioramaPoint(x, y) {
  const c = Math.round(Math.cos(DIORAMA.yaw)), s = Math.round(Math.sin(DIORAMA.yaw)), dx = x - G.cam.x, dy = y - G.cam.y;
  return { x: R.VW / 2 + dx * c + dy * s, y: R.VH / 2 - dx * s + dy * c };
}
function dioramaTurn(step) {
  if (!DIORAMA.active) return;
  DIORAMA.yaw = ((Math.round(DIORAMA.yaw / (Math.PI / 2)) + step + 4) % 4) * Math.PI / 2;
  const label = DIORAMA.el && DIORAMA.el.querySelector('[data-view]');
  if (label) label.textContent = ['North view', 'East view', 'South view', 'West view'][Math.round(DIORAMA.yaw / (Math.PI / 2))] + ' · simulation paused';
}
function dioramaStop() {
  if (!DIORAMA.active) return;
  DIORAMA.active = false; DIORAMA.yaw = 0; DIORAMA.el = null;
  for (const [id, hidden] of DIORAMA.hidden || []) $(id).hidden = hidden;
  DIORAMA.hidden = null; Input.clearHeld();
}
UI.diorama = function () {
  if (!DIORAMA.enabled || !dioramaRealm()) return;
  UI.clear();
  const close = () => UI.close(DIORAMA.el);
  const el = h('div', { class: 'diorama', role: 'dialog', 'aria-label': 'Realm diorama photo mode', style: { position: 'absolute', inset: '0', pointerEvents: 'none', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '12px', boxSizing: 'border-box' } },
    h('div', { style: { pointerEvents: 'auto', background: 'var(--bg, #17151c)', color: 'var(--text, #eee3cf)', border: '1px solid #8b7961', borderRadius: '10px', padding: '10px', maxWidth: '100%', boxSizing: 'border-box', textAlign: 'center' } },
      h('strong', {}, 'Turn the World'), h('div', { 'data-view': '', role: 'status', style: { fontSize: '12px', margin: '4px 0 8px' } }, 'North view · simulation paused'),
      h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' } },
        btn('↶ Q', () => dioramaTurn(-1), '', { 'aria-label': 'Rotate camera left' }),
        btn('Reset', () => { DIORAMA.yaw = 0; dioramaTurn(0); }),
        btn('E ↷', () => dioramaTurn(1), '', { 'aria-label': 'Rotate camera right' }),
        btn('Done', close, 'primary')),
      h('div', { style: { fontSize: '11px', marginTop: '6px' } }, 'Q / E to turn · Esc to return · buildings ghost away from the front')));
  UI.open(el, { modal: true, onBack: close });
  DIORAMA.el = el; DIORAMA.active = true; DIORAMA.yaw = 0;
  DIORAMA.hidden = ['hud', 'touch', 'prompt', 'itemcard'].map((id) => [id, $(id).hidden]);
  for (const [id] of DIORAMA.hidden) $(id).hidden = true;
};
const _closeDiorama = UI.close;
UI.close = function (el) { if (DIORAMA.active && (el || UI.top()) === DIORAMA.el) dioramaStop(); return _closeDiorama.call(this, el); };
const _clearDiorama = UI.clear;
UI.clear = function () { dioramaStop(); return _clearDiorama.call(this); };
pauseItem('photo', 140, () => (DIORAMA.enabled && dioramaRealm() ? btn('Turn the World · photo mode', () => UI.diorama()) : null));
settingsRow('photo', 20, () => h('label', { class: 'set-row' }, 'Realm photo camera (this session)',
  h('input', { type: 'checkbox', checked: DIORAMA.enabled, onchange: (e) => { DIORAMA.enabled = e.target.checked; if (!DIORAMA.enabled) dioramaStop(); } })));
window.addEventListener('keydown', (e) => {
  if (!DIORAMA.active || e.repeat || !['KeyQ', 'KeyE'].includes(e.code)) return;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target && e.target.tagName)) return;
  e.preventDefault(); e.stopImmediatePropagation(); dioramaTurn(e.code === 'KeyQ' ? -1 : 1);
}, true);
// Painters can emit sparks. A paused photograph must not add live effects.
const _burstDiorama = burst;
burst = function (...args) { if (!DIORAMA.active) return _burstDiorama(...args); };
const _hudDiorama = updateHUD;
updateHUD = function (dt) { if (!DIORAMA.active) return _hudDiorama(dt); };
// The existing skeleton and bake budget handle every new facing, including mirrors.
const _crigTurnDiorama = crigEntTurn;
crigEntTurn = function (e) {
  if (!DIORAMA.active || !dioramaRealm()) return _crigTurnDiorama(e);
  if (e._photoTurn != null) return e._photoTurn;
  const p = G.p, v = Math.hypot(e.rigVx || 0, e.rigVy || 0);
  let dx, dy;
  if (v > 8) { dx = e.rigVx; dy = e.rigVy; }
  else if (p && !p.dead && e.type !== 'ally' && (!e.world || e.aggro)) { dx = p.x - e.x; dy = p.y - e.y; }
  else { const a = (e.rigT ?? 2) * Math.PI / 4; dx = Math.sin(a) * (e.face < 0 ? -1 : 1); dy = Math.cos(a); }
  const a = Math.atan2(dy, dx) - DIORAMA.yaw;
  return pickTurn(null, Math.cos(a), Math.sin(a));
};
function dioramaFacing(e, fn) {
  const keys = ['turn', 'face', 'view', 'aim', 'swing', 'recoil', 'rigLazy', 'rigT', '_photoTurn'], old = keys.map((k) => [k, Object.hasOwn(e, k), e[k]]);
  if (e.frames && e.frames.crig) e._photoTurn = crigEntTurn(e);
  let a = Number.isFinite(e.aim) ? e.aim : Math.atan2(Math.cos((e.turn ?? e.rigT ?? 2) * Math.PI / 4), Math.sin((e.turn ?? e.rigT ?? 2) * Math.PI / 4) * (e.face < 0 ? -1 : 1));
  if (e.frames && e.frames.crig && G.p && !G.p.dead && e.type !== 'ally' && (!e.world || e.aggro)) a = Math.atan2(G.p.y - e.y, G.p.x - e.x);
  if (e.type && Math.hypot(e.rigVx || 0, e.rigVy || 0) > 8) a = Math.atan2(e.rigVy, e.rigVx);
  else if (e.type && G.p && e.aggro) a = Math.atan2(G.p.y - e.y, G.p.x - e.x);
  a -= DIORAMA.yaw;
  e.face = Math.cos(a) < -0.00001 ? -1 : 1; e.aim = a; e.rigLazy = true;
  e.turn = pickTurn(null, Math.cos(a), Math.sin(a)); e.view = e.turn >= 3 ? 'back' : 'front';
  if (e.swing) e.swing = { ...e.swing, ang: e.swing.ang - DIORAMA.yaw };
  try { return fn(); } finally { for (const [k, own, value] of old) { if (own) e[k] = value; else delete e[k]; } }
}
const _mountDiorama = drawMount;
drawMount = function (g, p, cx, cy) {
  if (!DIORAMA.active || !crigOn()) return _mountDiorama(g, p, cx, cy);
  const fr = mountFrames(), clip = p.moving ? 'run' : 'idle', i = p.moving ? Math.floor((p.anim || 0) * 2.2) : Math.floor(G.t * 2.2);
  const sp = crigFrame(fr, p.turn ?? 2, clip, i, true) || fr[0];
  drawSprite(g, sp, p.x - cx, p.y - cy + 2, p.face < 0, {});
};
function dioramaGround(g) {
  const Z = W.Z, b = Z.b, odd = Math.round(DIORAMA.yaw / (Math.PI / 2)) % 2, ww = odd ? R.VH : R.VW, wh = odd ? R.VW : R.VH;
  const cx = G.cam.x - ww / 2, cy = G.cam.y - wh / 2, bs = BLK * TS, blocks = [];
  g.save(); g.translate(R.VW / 2, R.VH / 2); g.rotate(-DIORAMA.yaw); g.translate(-ww / 2, -wh / 2);
  g.fillStyle = b.g[2]; g.fillRect(0, 0, ww, wh);
  for (let by = Math.max(0, Math.floor(cy / bs)); by <= Math.min(ZT / BLK - 1, Math.floor((cy + wh) / bs)); by++) for (let bx = Math.max(0, Math.floor(cx / bs)); bx <= Math.min(ZT / BLK - 1, Math.floor((cx + ww) / bs)); bx++) {
    const B = blockCanvas(Z, bx, by), x = bx * bs - cx, y = by * bs - cy;
    g.drawImage(B.c, x, y); blocks.push([B, x, y]);
  }
  const lf = Math.floor(G.t * 4) % LIQ_N, ph = Math.floor(G.t * 1.6);
  const sheets = {}, liquid = (gr) => sheets[gr] || (sheets[gr] = liquidSheet(gr === GR.LAVA ? 'lava' : 'tox', b)[lf]);
  for (let y = Math.max(0, Math.floor(cy / TS)); y <= Math.min(ZT - 1, Math.ceil((cy + wh) / TS)); y++) for (let x = Math.max(0, Math.floor(cx / TS)); x <= Math.min(ZT - 1, Math.ceil((cx + ww) / TS)); x++) {
    const gr = Z.ground[y * ZT + x];
    if (gr === GR.LAVA || gr === GR.TOXIC) g.drawImage(liquid(gr), (x & 7) * TS, (y & 7) * TS, TS, TS, x * TS - cx, y * TS - cy, TS, TS);
    else if ((gr === GR.DEEP || gr === GR.SHALLOW) && (hash2(x * 7 + ph, y) & 31) === 0) { g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(x * TS - cx + (hash2(x, y + ph) & 11), y * TS - cy + (hash2(y, x + ph) & 11), 3, 1); }
  }
  for (const [B, ox, oy] of blocks) {
    for (const [ax, ay, dx, dy, gr] of B.anim) {
      const x = ox + ax, y = oy + ay, wx = ((x + cx) >> 4) & 7, wy = ((y + cy) >> 4) & 7;
      g.save(); g.translate(x + (dx < 0 ? 0 : TS), y + (dy < 0 ? 0 : TS)); g.scale(dx < 0 ? 1 : -1, dy < 0 ? 1 : -1); cornerPath(g); g.clip(); g.scale(dx < 0 ? 1 : -1, dy < 0 ? 1 : -1); g.translate(dx < 0 ? 0 : -TS, dy < 0 ? 0 : -TS); g.drawImage(liquid(gr), wx * TS, wy * TS, TS, TS, 0, 0, TS, TS); g.restore();
    }
    if (B.o) g.drawImage(B.o, ox, oy);
  }
  const vw = R.VW, vh = R.VH;
  try { R.VW = ww; R.VH = wh; runHooks('renderFloor', g, cx, cy, []); } finally { R.VW = vw; R.VH = vh; g.restore(); }
}
// Chest sides and backs have no lock; keep these tiny bakes under the shared budget.
const DIORAMA_CHESTS = new Map();
function dioramaChest(tier, open) {
  const view = Math.round(DIORAMA.yaw / (Math.PI / 2)), key = tier + open + view;
  if (!view) return chestSprite(tier, open);
  if (DIORAMA_CHESTS.has(key)) return DIORAMA_CHESTS.get(key);
  if (!rigBudgetOk(true)) return null;
  const now = performance.now(), P = new PP(18, 15), side = view % 2, x = side ? 5 : 2, w = side ? 8 : 14;
  const body = tier === 'gold' ? '#c8901c' : tier === 'silver' ? '#8a94a8' : '#8a5a32', band = tier === 'gold' ? '#ffd35c' : tier === 'silver' ? '#dde3ec' : '#5a3a1e';
  P.rect(x, 7, w, 7, shade(body, side ? -0.15 : -0.05)); P.rect(x, 13, w, 1, shade(body, -0.35));
  P.rect(x, open ? 1 : 3, w, open ? 3 : 5, shade(body, 0.12)); P.rect(x, open ? 1 : 3, w, 1, shade(body, 0.3));
  if (side) { P.rect(x, 7, w, 1, band); P.rect(x + 1, 10, 2, 1, band); }
  else { P.rect(4, open ? 1 : 3, 2, open ? 3 : 11, band); P.rect(12, open ? 1 : 3, 2, open ? 3 : 11, band); if (open) { P.rect(4, 7, 2, 7, band); P.rect(12, 7, 2, 7, band); } }
  P.outline(); const sp = P.sprite(9, 14); DIORAMA_CHESTS.set(key, sp); RIG_BUDGET.spent += performance.now() - now; return sp;
}
function renderDiorama() {
  const g = R.g, p = G.p, Z = W.Z, list = [], yaw = DIORAMA.yaw;
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  dioramaGround(g);
  const add = (o, draw, pad = 160) => {
    const q = dioramaPoint(o.x, o.y);
    if (q.x < -pad || q.x > R.VW + pad || q.y < -pad || q.y > R.VH + pad) return;
    list.push({ y: q.y, d: () => draw(o.x - q.x, o.y - q.y, q) });
  };
  const odd = Math.round(yaw / (Math.PI / 2)) % 2, hw = (odd ? R.VH : R.VW) / 2 + 180, hh = (odd ? R.VW : R.VH) / 2 + 180, bs = TS * ZCH;
  for (let by = Math.max(0, Math.floor((G.cam.y - hh) / bs)); by <= Math.min(ZCN - 1, Math.floor((G.cam.y + hh) / bs)); by++) for (let bx = Math.max(0, Math.floor((G.cam.x - hw) / bs)); bx <= Math.min(ZCN - 1, Math.floor((G.cam.x + hw) / bs)); bx++) for (const o of Z.objs[by * ZCN + bx]) {
    const q = dioramaPoint(o.x, o.y);
    if (q.x < -160 || q.x > R.VW + 160 || q.y < -30 || q.y > R.VH + 180) continue;
    let sp = objSprite(o, Z.b); if (!sp) continue;
    if (o.kind === 'chest' && crigOn()) sp = dioramaChest(o.chest.tier, sp === chestSprite(o.chest.tier, true)) || sp;
    add(o, (cx, cy) => {
      // Front-only facades become ghosts rather than inventing an unseen entrance.
      const facade = ['building', 'dungeon', 'stall', 'tower', 'mark'].includes(o.kind);
      const pq = dioramaPoint(p.x, p.y), fade = pq.y < q.y - 2 && pq.y > q.y - sp.ay + 4 && Math.abs(pq.x - q.x) < sp.w * 0.42;
      if (facade && yaw) { g.globalAlpha = 0.18; drawSprite(g, sp, q.x, q.y, false); g.globalAlpha = 1; }
      else if (o.kind === 'chest' && yaw && crigOn()) drawSprite(g, sp, q.x, q.y, false);
      else drawRealmObj(g, { ...o }, sp, cx, cy, fade);
    });
  }
  for (const e of G.ents) if (!e.dead) add(e, (cx, cy, q) => dioramaFacing(e, () => { shadow(g, q.x, q.y, e.r * (e.scale || 1), e.z || 0); drawEnt(g, e, cx, cy); drawEntOverlay(g, e, cx, cy); }));
  for (const n of W.npcs) add(n, (cx, cy) => dioramaFacing(n, () => drawNpc(g, n, cx, cy)));
  if (typeof mmoGhosts === 'function') for (const q of mmoGhosts()) add(q, (cx, cy) => dioramaFacing(q, () => drawGhostPlayer(g, q, cx, cy)));
  for (const it of G.items) add(it, (cx, cy) => drawItem(g, it, cx, cy));
  for (const k of G.picks) add(k, (cx, cy) => drawPick(g, k, cx, cy));
  for (const f of G.fx) add(f, (cx, cy, q) => {
    if (f.kind === 'corpse' && f.sp) drawCorpse(g, f, cx, cy);
    else if (f.kind === 'shard') { g.save(); g.globalAlpha = clamp((f.life - f.t) / 0.35, 0, 1); g.translate(q.x, q.y - f.z); g.rotate(f.rot); g.drawImage(f.c, -Math.round(f.w / 2), -Math.round(f.h / 2)); g.restore(); }
    else {
      const F = { ...f, ang: (f.ang || 0) - yaw };
      if (f.kind === 'tele') drawTele(g, F, cx, cy);
      else if (GROUND_FX[f.kind]) GROUND_FX[f.kind](g, F, cx, cy);
      else if (TOP_FX[f.kind]) TOP_FX[f.kind](g, F, cx, cy);
    }
  });
  for (const q of G.parts) add(q, (cx, cy, pt) => { g.save(); g.globalAlpha = clamp(q.life / q.max, 0, 1); g.fillStyle = q.color; g.fillRect(Math.round(pt.x), Math.round(pt.y - (q.z || 0)), q.size, q.size); g.restore(); });
  for (const pr of G.projs) add(pr, (cx, cy) => drawProj(g, { ...pr, vx: pr.vx * Math.cos(yaw) + pr.vy * Math.sin(yaw), vy: -pr.vx * Math.sin(yaw) + pr.vy * Math.cos(yaw) }, cx, cy));
  add(p, (cx, cy, q) => dioramaFacing(p, () => {
    shadow(g, q.x, q.y, 6 + ascStage(p) * 0.8 + (p.mounted ? 4 : 0), p.z || 0);
    if (p.mounted && !p.dead) { drawMount(g, p, cx, cy); drawPlayer(g, p, cx, cy + 9); }
    else drawPlayer(g, p, cx, cy);
  }));
  list.sort((a, b) => a.y - b.y); for (const o of list) o.d();
  // Lighting follows rotated feet; light radii remain screen-space circles.
  let dark = clamp((1 - daylight()) * 0.62 * (Z.b.night || 1) + (Z.b.dark || 0), 0, 0.9);
  if (CD.settings.bright) dark *= 0.75;
  if (dark > 0.04) {
    const lg = R.lg; lg.globalCompositeOperation = 'source-over'; lg.globalAlpha = 1; lg.fillStyle = '#0a0e22'; lg.fillRect(0, 0, R.VW, R.VH); lg.globalCompositeOperation = 'destination-out';
    const tex = LightTex.get('#ffffff', 0.45), lights = [{ x: p.x, y: p.y, r: 110 + (p.stats.light || 0) }, ...Z.lights];
    for (const l of lights) { const q = dioramaPoint(l.x, l.y); lg.drawImage(tex, q.x - l.r, q.y - l.r - 10, l.r * 2, l.r * 2); }
    lg.globalCompositeOperation = 'source-over'; g.globalAlpha = dark; g.drawImage(R.light, 0, 0); g.globalAlpha = 1;
  }
  const north = dioramaPoint(G.cam.x, G.cam.y - 1), nx = north.x - R.VW / 2, ny = north.y - R.VH / 2;
  g.fillStyle = '#ffd35c'; g.beginPath(); g.moveTo(20 + nx * 10, 20 + ny * 10); g.lineTo(20 - ny * 4, 20 + nx * 4); g.lineTo(20 + ny * 4, 20 - nx * 4); g.fill();
  const n = pixelText('N', '#ffd35c'); g.drawImage(n, 18 + nx * 17, 17 + ny * 17);
  blit();
}
const _renderDiorama = render;
render = function () {
  if (DIORAMA.active && (!dioramaRealm() || UI.top() !== DIORAMA.el || !DIORAMA.enabled)) dioramaStop();
  if (DIORAMA.active) return renderDiorama();
  return _renderDiorama();
};
CD.diorama = { open: () => UI.diorama(), turn: dioramaTurn, close: () => { if (DIORAMA.active) UI.close(DIORAMA.el); }, get yaw() { return DIORAMA.yaw; }, get active() { return DIORAMA.active; } };

