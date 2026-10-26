/* ============================================================
   Cinderdeep — main loop, modes and boot
   ============================================================ */
CD.debug = { god: false, speed: 1 };
CD.settings = { ...DEFAULT_SETTINGS };

function setMode(m) {
  G.mode = m;
  const playing = m === 'play';
  $('hud').hidden = !playing;
  $('touch').hidden = !((playing && Input.device === 'touch') || CD.ctlEdit);
  Input.gameFocus = playing && !UI.top();
  if (!playing) { $('prompt').hidden = true; $('itemcard').hidden = true; }
}
CD.onDevice = (d) => { $('touch').hidden = !((G.mode === 'play' && d === 'touch') || CD.ctlEdit); HUD.last = {}; };
CD.onBlur = () => { if (G.mode === 'play' && !UI.top() && G.p && !G.p.dead) UI.pause(); };

let fading = false;
function fadeTransition(fn) {
  if (fading) return;
  fading = true;
  const veil = h('div', { style: { position: 'absolute', inset: '0', background: '#050305', opacity: '0', transition: 'opacity 0.28s', zIndex: 40, pointerEvents: 'none' } });
  $('app').append(veil);
  requestAnimationFrame(() => { veil.style.opacity = '1'; });
  setTimeout(() => {
    try { fn(); } catch (e) { console.error(e); }
    veil.style.opacity = '0';
    setTimeout(() => { veil.remove(); fading = false; }, 320);
  }, 300);
}

/* the title screen shows a quiet room with a hero waiting by the torches */
function startDemo() {
  const seed = 'title-' + ((Math.random() * 4) | 0);
  const run = newRunState({ cls: 'knight', seed });
  G.run = run; G.demo = true;
  const idx = ((Math.random() * 4) | 0) * FLOORS_PER_ACT;
  G.fl = { idx, info: floorInfo(idx), actIdx: floorInfo(idx).actIdx };
  G.p = makePlayer(CD.save.lastClass && CD.save.unlocks.classes.includes(CD.save.lastClass) ? CD.save.lastClass : 'knight');
  G.fl = generateFloor(run, idx);
  G.ents = []; G.projs = []; G.fx = []; G.parts = []; G.texts = []; G.picks = []; G.items = []; G.timers = [];
  G.boss = null; G.combat = false;
  const s = G.fl.rooms[0];
  G.p.x = (s.ix + s.iw / 2) * TS; G.p.y = (s.iy + s.ih / 2 + 2.5) * TS; G.p.aim = -Math.PI / 2; G.p.view = 'back';
  G.room = s; s.seen = s.visited = true;
  invalidateRoomCache(); snapCamera();
  Music.set(G.fl.actIdx, 0);
}
function updateDemo(dt) {
  G.t += dt;
  const p = G.p;
  // the hero by the torches glances round the room
  p.aim = -Math.PI / 2 + Math.sin(G.t * 0.4) * 1.15; p.turn = pickTurn(p.turn, Math.cos(p.aim), Math.sin(p.aim)); p.view = p.turn >= 3 ? 'back' : 'front'; p.face = Math.cos(p.aim) >= 0 ? 1 : -1;
  if (Math.random() < 0.3) { const r = G.room; burst((r.ix + Math.random() * r.iw) * TS, (r.iy + r.ih) * TS, 1, ['#ff9a3c', '#ffd08a'], { grav: -30, floor: false, smax: 12, lmin: 1.5, lmax: 3, glow: true }); }
  updateParts(dt);
  updateCamera(dt);
  G.cam.y = lerp(G.cam.y, G.p.y - 40, 0.02);
}

function update(dt) {
  G.t += dt;
  G.run.t += dt;
  if (G.warp > 0) G.warp -= dt;
  if (G.hurtFlash > 0) G.hurtFlash -= dt;
  updateTimers(dt);
  updatePlayer(dt);
  checkRoomEntry();
  if (G.room) updateFlow(false);
  updateEnemies(dt);
  updateCombat(dt);
  updateProjs(dt);
  updateFx(dt);
  updateParts(dt);
  updatePickups(dt);
  runHooks('update', dt);
  updateCamera(dt);
  const A = Input.act, p = G.p;
  if (A.use && !p.dead) interact();
  // learning waits until the room is quiet
  if (p.pendingLevels > 0 && !G.combat && !p.dead && !UI.top()) UI.levelUp();
}

let last = 0, acc = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, Math.max(0, (ts - last) / 1000 || 0));
  last = ts;
  Input.update();
  const A = Input.act;
  try {
    const hadUI = !!UI.top();
    if (hadUI) UI.nav();
    if (G.mode === 'play') {
      if (!UI.top() && !hadUI) {
        if (A.pause) UI.pause();
        else if (A.map) UI.map();
      }
      if (!UI.top() && G.p) {
        let sdt = dt * CD.debug.speed;
        if (G.hitstop > 0) { G.hitstop -= dt; sdt *= 0.08; }
        if (G.slowmo > 0) { G.slowmo -= dt; sdt *= 0.35; }
        update(sdt);
      }
      render();
      updateHUD(dt);
    } else if (G.mode === 'title' || G.mode === 'menu') {
      if (G.demo && G.fl && G.fl.rooms) updateDemo(dt);
      render();
    }
  } catch (e) {
    console.error(e);
    if (!frame.errShown) { frame.errShown = true; toast('Something went wrong. The run keeps going.'); }
  }
  Input.endFrame();
}

/* step the game without drawing, for tests */
CD.sim = function (seconds, step = 1 / 60) {
  for (let t = 0; t < seconds; t += step) {
    Input.update();
    if (G.mode === 'play' && !UI.top()) update(step);
    Input.endFrame();
  }
};

function boot(hotData) {
  CD.save = loadLocal();
  if (hotData && hotData.save) CD.save = mergeSave(hotData.save);
  applySettings();
  initRender();
  Input.init(R.screen);
  try { window.claude?.hot?.snapshot?.(() => ({ save: CD.save })); } catch (e) { /* not in a viewer */ }
  // first touch anywhere unlocks audio
  window.addEventListener('pointerdown', () => Sound.init(), { once: false, passive: true });
  UI.title();
  requestAnimationFrame(frame);
  connectCloud();
  Object.assign(CD, { G, UI, startRun, goFloor, descend, endRun, generateFloor, spawnEnemy, makePlayer, recalcStats, gainRelic, learnSkill, makeWeapon, spawnItem, ACTS, ENEMIES, WEAPONS, SKILLS, RELICS, ABILITIES, R, interact, nearestInteract, killEnemy, damageEnemy, hurtPlayer, continueRun, saveCheckpoint, persist });
}
try {
  if (window.claude && window.claude.hot && window.claude.hot.ready) window.claude.hot.ready(boot);
  else boot((window.claude && window.claude.hot && window.claude.hot.data) || {});
} catch (e) { console.error(e); boot({}); }

