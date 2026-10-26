/* ============================================================
   Cinderdeep — atmosphere: weather and motes for every region,
   cinematic letterboxing for big entrances, tremors in the Core,
   dust and drips, a low-health heartbeat and the chaos-run haze
   ============================================================ */
let letterboxTimer = 0;
function letterbox(dur = 2) {
  const el = $('letterbox');
  if (!el) return;
  el.classList.add('on');
  clearTimeout(letterboxTimer);
  letterboxTimer = setTimeout(() => el.classList.remove('on'), dur * 1000);
}
function letterboxOff() { clearTimeout(letterboxTimer); const el = $('letterbox'); if (el) el.classList.remove('on'); }
hook('bossStart', () => { letterbox(2.8); G.slowmo = Math.max(G.slowmo, 0.5); });
hook('runEnd', letterboxOff);
hook('death', () => letterbox(1.6));

Object.assign(SFX, {
  heartbeat: (S, p, v) => { S.tone('sine', 72 * p, 42, 0.13, 0.38 * v); S.tone('sine', 64 * p, 38, 0.13, 0.26 * v, 0.004, 0.17); },
  drip: (S, p, v) => { S.tone('sine', 1300 * p, 2300 * p, 0.06, 0.05 * v); S.tone('sine', 900 * p, 700 * p, 0.12, 0.02 * v, 0.004, 0.05); },
  rumble: (S, p, v) => { S.hiss(1.6, 0.3 * v, 'lowpass', 220 * p, 60, 1); S.tone('sine', 42, 30, 1.5, 0.3 * v, 0.2); },
  dust: (S, p, v) => { for (let i = 0; i < 6; i++) S.hiss(0.05, 0.05 * v, 'highpass', 2200 + i * 300, 1800, 2, i * 0.07); },
});
Object.assign(SFX_GAP, { heartbeat: 0.3, drip: 0.2, rumble: 1, dust: 0.5 });

/* ---------- weather: screen-space motes with parallax ---------- */
const WX = { key: '', parts: [], lx: null, ly: null, last: 0, gust: 0, gustT: 14, quakeT: 34, dustT: 9, dripT: 3, beatT: 0 };
const WX_CFG = {
  ossuary: { n: 22, spawn(P, W, H, init) { P.x = rnd(W); P.y = init ? rnd(H) : -4; P.vx = rnd(-3, 3); P.vy = rnd(3, 8); P.s = Math.random() < 0.15 ? 2 : 1; P.c = '#d8cbb0'; P.a = rnd(0.12, 0.3); P.par = rnd(0.2, 0.7); P.glow = false; } },
  grotto: { n: 30, spawn(P, W, H, init) { P.x = rnd(W); P.y = init ? rnd(H) : H + 4; P.vx = rnd(-4, 4); P.vy = rnd(-9, -3); P.s = 1; P.c = rndPick(['#c8ff6a', '#c58cff', '#7fe8ff', '#e8ffd0']); P.a = rnd(0.35, 0.7); P.par = rnd(0.3, 0.9); P.glow = true; } },
  frost: { n: 64, spawn(P, W, H, init) { P.x = init ? rnd(W) : rnd(-20, W + 40); P.y = init ? rnd(H) : -4; P.vx = rnd(-10, -4); P.vy = rnd(14, 28); P.s = Math.random() < 0.3 ? 2 : 1; P.c = '#ffffff'; P.a = rnd(0.35, 0.8); P.par = rnd(0.4, 1.2); P.glow = false; } },
  core: { n: 42, spawn(P, W, H, init) { const ember = Math.random() < 0.62; P.x = rnd(W); P.y = init ? rnd(H) : ember ? H + 4 : -4; P.vx = rnd(-6, 6); P.vy = ember ? rnd(-30, -12) : rnd(5, 12); P.s = ember && Math.random() < 0.2 ? 2 : 1; P.c = ember ? rndPick(['#ff9a3c', '#ffd08a', '#ff5a2a']) : rndPick(['#4a3a38', '#6a5a56']); P.a = ember ? rnd(0.5, 0.9) : rnd(0.3, 0.5); P.par = rnd(0.3, 1); P.glow = ember; } },
  chaos: { n: 26, spawn(P, W, H, init) { P.x = rnd(W); P.y = init ? rnd(H) : rndPick([-4, H + 4]); P.vx = rnd(-12, 12); P.vy = rnd(-12, 12); P.s = 1; P.c = rndPick(CHAOS_COLS); P.a = rnd(0.3, 0.7); P.par = rnd(0.2, 1); P.glow = true; } },
};
function weatherKey() {
  if (!G.fl || !G.fl.info) return '';
  if (G.room && G.room.type === 'dmt') return '';
  return ACTS[G.fl.actIdx % ACTS.length].id;
}
function drawWeather(g) {
  const key = weatherKey(), cfg = WX_CFG[key], W = R.VW, H = R.VH;
  const now = performance.now(), dt = Math.min(0.05, WX.last ? (now - WX.last) / 1000 : 0);
  WX.last = now;
  if (!cfg) { WX.parts.length = 0; WX.key = ''; return; }
  const want = Math.round(cfg.n * (CD.settings.lowFx ? 0.4 : 1) * (W * H) / (400 * 240));
  if (WX.key !== key) { WX.key = key; WX.parts = []; }
  while (WX.parts.length < want) { const P = {}; cfg.spawn(P, W, H, true); P.wob = rnd(TAU); WX.parts.push(P); }
  if (WX.parts.length > want) WX.parts.length = want;
  const dx = WX.lx == null ? 0 : R.camX - WX.lx, dy = WX.ly == null ? 0 : R.camY - WX.ly;
  WX.lx = R.camX; WX.ly = R.camY;
  const jump = Math.abs(dx) > 120 || Math.abs(dy) > 120;
  const gust = WX.gust > 0 ? Math.min(1, WX.gust) : 0;
  const chaos = G.run && G.run.chaos && !G.demo;
  for (const P of WX.parts) {
    P.wob += dt * 1.7;
    P.x += (P.vx * (1 + gust * 7) + Math.sin(P.wob) * 4) * dt - (jump ? 0 : dx * P.par);
    P.y += P.vy * dt - (jump ? 0 : dy * P.par);
    if (P.x < -24) P.x += W + 48; else if (P.x > W + 24) P.x -= W + 48;
    if (P.y > H + 8 || P.y < -8) { cfg.spawn(P, W, H, false); P.wob = rnd(TAU); }
  }
  let glowOn = false;
  for (const P of WX.parts) {
    if (P.glow !== glowOn) { glowOn = P.glow; g.globalCompositeOperation = glowOn ? 'lighter' : 'source-over'; }
    g.globalAlpha = P.a * (0.75 + Math.sin(P.wob * 2) * 0.25);
    g.fillStyle = P.c;
    const x = Math.round(P.x), y = Math.round(P.y);
    if (gust && key === 'frost') g.fillRect(x - 3, y, 4, 1);
    else g.fillRect(x, y, P.s, P.s);
    if (P.glow && P.s > 1) { g.globalAlpha *= 0.3; g.fillRect(x - 1, y - 1, P.s + 2, P.s + 2); }
  }
  // a few chaos motes drift through every room of a chaos run
  if (chaos) {
    g.globalCompositeOperation = 'lighter';
    const t = G.t;
    for (let i = 0; i < 10; i++) {
      const x = (hashU(i, 7) * W + t * (8 + i * 2)) % W, y = (hashU(i, 9) * H + Math.sin(t * 0.7 + i) * 20 + H) % H;
      g.globalAlpha = 0.35 + Math.sin(t * 3 + i) * 0.2; g.fillStyle = CHAOS_COLS[i % CHAOS_COLS.length];
      g.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  // frost gusts leave a white haze; the Core breathes red
  if (gust && key === 'frost') { g.fillStyle = `rgba(230,244,255,${(gust * 0.08).toFixed(3)})`; g.fillRect(0, 0, W, H); }
  if (key === 'core' && !CD.settings.lowFx) {
    const a = 0.05 + Math.sin(G.t * 0.9) * 0.03, grd = g.createLinearGradient(0, H, 0, H * 0.45);
    grd.addColorStop(0, `rgba(255,90,30,${a.toFixed(3)})`); grd.addColorStop(1, 'rgba(255,90,30,0)');
    g.fillStyle = grd; g.fillRect(0, H * 0.45, W, H * 0.55);
  }
  if (chaos) {
    const a = 0.1 + Math.sin(G.t * 1.6) * 0.04, grd = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.9);
    grd.addColorStop(0, 'rgba(200,40,180,0)'); grd.addColorStop(1, `rgba(200,40,180,${a.toFixed(3)})`);
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
  }
}

/* ---------- regional events ---------- */
hook('update', (dt) => {
  const p = G.p, key = weatherKey();
  if (!p || p.dead || G.demo) return;
  if (WX.gust > 0) WX.gust -= dt;
  const r = G.room;
  if (key === 'frost') {
    WX.gustT -= dt;
    if (WX.gustT <= 0) { WX.gustT = rnd(14, 26); WX.gust = 2.8; Sound.play('wind', { v: 0.7 }); }
  }
  if (key === 'core' && !G.boss) {
    WX.quakeT -= dt;
    if (WX.quakeT <= 0 && r) {
      WX.quakeT = rnd(28, 52);
      shake(3); Sound.play('rumble', { v: 0.8 });
      for (let k = 0; k < 14; k++) {
        const q = randomFloorPoint(r, p.x, p.y, 0);
        later(rnd(0, 0.9), () => burst(q.x, q.y, 2, ['#5a4a48', '#3a2a26', '#ff9a3c', '#8a7a6a'], { z: rnd(60, 100), vz: 5, smin: 0, smax: 12, grav: 260, lmin: 1, lmax: 1.3, size: 2 }));
      }
    }
  }
  if (key === 'ossuary' && r) {
    WX.dustT -= dt;
    if (WX.dustT <= 0) {
      WX.dustT = rnd(9, 18);
      const q = randomFloorPoint(r, p.x, p.y, 20);
      Sound.play('dust', { x: q.x, v: 0.6 });
      for (let k = 0; k < 8; k++) later(k * 0.09, () => burst(q.x + rnd(-6, 6), q.y + rnd(-3, 3), 2, ['#d8cbb0', '#a89a80'], { z: rnd(70, 90), vz: 2, smin: 0, smax: 6, grav: 120, drag: 4, lmin: 1.2, lmax: 1.6 }));
    }
  }
  if (key === 'grotto' && r) {
    WX.dripT -= dt;
    if (WX.dripT <= 0) {
      WX.dripT = rnd(2.5, 6);
      const q = randomFloorPoint(r, p.x + rnd(-80, 80), p.y + rnd(-50, 50), 0);
      burst(q.x, q.y, 1, '#9fe0ff', { z: 70, vz: 1, smin: 0, smax: 1, grav: 300, lmin: 0.7, lmax: 0.72, size: 1, glow: true });
      later(0.66, () => { ring(q.x, q.y, 7, '#9fe0ff', 0.45, 1); Sound.play('drip', { x: q.x, p: rnd(0.85, 1.2), v: 0.7 }); });
    }
  }
  // a heartbeat when life runs thin
  const frac = p.hp / p.maxHp;
  if (frac < 0.25 && frac > 0) {
    WX.beatT -= dt;
    if (WX.beatT <= 0) { WX.beatT = frac < 0.12 ? 0.62 : 0.85; Sound.play('heartbeat', { v: frac < 0.12 ? 1 : 0.7 }); }
  } else WX.beatT = 0;
});
// the last kill of a hard room lands in slow motion
hook('onRoomClear', (r) => {
  if (r.type === 'elite' || (G.combo && G.combo.n >= 15)) { G.slowmo = Math.max(G.slowmo, 0.45); flashLight(G.p.x, G.p.y - 10, 120, '#ffd08a', 0.35); }
});

