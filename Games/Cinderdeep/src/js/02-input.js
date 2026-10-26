/* ============================================================
   Cinderdeep — input: keyboard + mouse, gamepad, touch sticks
   All sources fold into one set of actions per frame.
   ============================================================ */
const KEYMAP = {
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  attack: ['KeyJ'], dash: ['Space', 'ShiftLeft', 'ShiftRight', 'KeyK'], ab1: ['KeyQ', 'KeyU'], ab2: ['KeyE', 'KeyI'],
  use: ['KeyF', 'KeyL'], swap: ['Tab', 'KeyC', 'KeyO'], potion: ['KeyR', 'KeyH'], pause: ['Escape', 'KeyP'], map: ['KeyM'],
  confirm: ['Enter', 'NumpadEnter'],
};
// gamepad buttons per action (standard mapping); both maps can be rebound in Controls
const PADMAP = { dash: [0], potion: [1], use: [2], swap: [3], ab1: [4, 6], ab2: [5], attack: [7], map: [8], pause: [9] };
const GAME_KEYS = new Set(['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

// Controllers report wildly different layouts: Chrome and Android give the standard layout,
// Firefox on Linux often gives raw evdev order (triggers on axes, d-pad on hat axes), Firefox on
// Windows/macOS packs the d-pad into one hat axis. Everything is folded into the standard layout:
// buttons 0 A,1 B,2 X,3 Y,4 LB,5 RB,6 LT,7 RT,8 View,9 Menu,10 LS,11 RS,12-15 d-pad,16 Home; axes LX,LY,RX,RY.
function padFamily(id) {
  id = String(id || '').toLowerCase();
  if (/054c|playstation|dualshock|dualsense|sony|wireless controller/.test(id)) return 'ps';
  if (/057e|nintendo|switch|joy-con|pro controller/.test(id)) return 'switch';
  if (/045e|xbox|x-box|xinput|microsoft|8bitdo|logitech|046d|steam|28de|valve/.test(id)) return 'xbox';
  return 'generic';
}
// what each raw pad has been seen doing at rest: hat axes rest above 1, trigger axes rest at -1
const PAD_REST = {};
function normPad(g) {
  const raw = g.buttons.map((x) => (x == null ? 0 : typeof x === 'number' ? x : x.pressed ? Math.max(1, x.value || 0) : x.value || 0));
  const ax = g.axes.map((v) => (Number.isFinite(v) ? v : 0));
  const out = new Array(17).fill(0), axes = [ax[0] || 0, ax[1] || 0, 0, 0];
  const standard = g.mapping === 'standard' || !!g.native;
  const key = (g.native ? 'n:' : g.index + ':') + g.id;
  if (standard) {
    for (let i = 0; i < 17; i++) out[i] = raw[i] || 0;
    axes[2] = ax[2] || 0; axes[3] = ax[3] || 0;
  } else {
    const rest = PAD_REST[key] || (PAD_REST[key] = { hat: {}, trig: {} });
    ax.forEach((v, i) => { if (v > 1.05) rest.hat[i] = true; if (v < -0.95) rest.trig[i] = true; });
    const ov = CD.settings && CD.settings.padLayout, fam = ov && ov !== 'auto' ? ov : padFamily(g.id);
    const trig = (i) => (rest.trig[i] ? Math.max(0, (ax[i] + 1) / 2) : 0);
    const cust = CD.save && CD.save.binds && CD.save.binds.rawpad && CD.save.binds.rawpad[g.id];
    let bm, am;
    if (fam === 'ps') { bm = [0, 1, 3, 2, 4, 5, 6, 7, 8, 9, 16, 10, 11]; am = { rx: 3, ry: 4, lt: 2, rt: 5, hx: 6, hy: 7 }; }
    else if (fam === 'switch') { bm = [1, 0, 3, 2, 4, 5, 6, 7, 8, 9, 16, 10, 11]; am = { rx: 2, ry: 3, hx: 4, hy: 5 }; }
    else if (fam === 'xbox') { bm = [0, 1, 2, 3, 4, 5, 8, 9, 16, 10, 11]; am = { rx: 3, ry: 4, lt: 2, rt: 5, hx: 6, hy: 7 }; }
    else { bm = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]; am = { rx: 2, ry: 3, hx: ax.length >= 6 ? ax.length - 2 : null, hy: ax.length >= 6 ? ax.length - 1 : null }; }
    if (cust) { bm = cust.b || bm; am = cust.a || am; }
    raw.forEach((v, i) => { const to = bm[i]; if (to != null && to < 17) out[to] = Math.max(out[to], v); else if (i >= bm.length && raw.length > 13 && i - bm.length + 12 < 16) out[i - bm.length + 12] = Math.max(out[i - bm.length + 12], v); });
    // too few axes for that layout: fall back to the usual 2,3 right stick
    if (ax.length <= Math.max(am.rx, am.ry)) am = { rx: 2, ry: 3, hx: ax.length >= 6 ? 4 : null, hy: ax.length >= 6 ? 5 : null };
    axes[2] = ax[am.rx] || 0; axes[3] = ax[am.ry] || 0;
    // a stick that rests at -1 is really a trigger: leave it out of aiming
    if (rest.trig[am.rx] && !rest.trig[am.ry]) axes[2] = 0;
    if (am.lt != null && ax.length > am.lt) out[6] = Math.max(out[6], trig(am.lt));
    if (am.rt != null && ax.length > am.rt) out[7] = Math.max(out[7], trig(am.rt));
    if (am.hx != null && am.hy != null && ax.length > am.hy && !rest.hat[am.hx] && (fam !== 'generic' || (!rest.trig[am.hx] && !rest.trig[am.hy]))) { const hx = ax[am.hx] || 0, hy = ax[am.hy] || 0; if (hy < -0.5) out[12] = 1; if (hy > 0.5) out[13] = 1; if (hx < -0.5) out[14] = 1; if (hx > 0.5) out[15] = 1; }
    // a packed hat axis (Firefox on Windows/macOS): eight directions in steps of 2/7, resting above 1
    for (let i = 2; i < ax.length; i++) {
      if (!rest.hat[i]) continue;
      const h = ax[i];
      if (h >= -1.01 && h <= 1.01) {
        const d = Math.round((h + 1) * 3.5) % 8; // 0 up,1 up-right,2 right,3 down-right,4 down,5 down-left,6 left,7 up-left
        if (d === 7 || d === 0 || d === 1) out[12] = 1; if (d >= 3 && d <= 5) out[13] = 1; if (d >= 5 && d <= 7) out[14] = 1; if (d >= 1 && d <= 3) out[15] = 1;
      }
      if (i === am.rx || i === am.ry) { axes[2] = 0; axes[3] = 0; }
    }
  }
  return { id: g.id, key, native: !!g.native, standard, axes, buttons: out, src: g };
}

const Input = {
  down: new Set(), edge: new Set(), device: 'kbm', lastMouseMove: 0, lastKeyAim: 0,
  mouse: { x: 0, y: 0, l: false, r: false, lEdge: false, rEdge: false, wheel: 0, over: false },
  pad: { on: false, lx: 0, ly: 0, rx: 0, ry: 0, b: [], pb: [], edge: new Set() },
  touch: { on: false, mx: 0, my: 0, ax: 0, ay: 0, aimOn: false, attack: false, held: new Set(), edge: new Set(), ids: {} },
  act: {},
  gameFocus: false, // true while the run is being played (no menu open)

  init(canvas) {
    window.addEventListener('keydown', (e) => {
      if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      if (this.gameFocus && (GAME_KEYS.has(e.code))) e.preventDefault();
      if (!this.gameFocus && e.code === 'Space' && e.target === document.body) e.preventDefault();
      if (!e.repeat) this.edge.add(e.code);
      this.down.add(e.code);
      if (this.device !== 'kbm') this.setDevice('kbm');
      Sound.init();
    });
    window.addEventListener('keyup', (e) => { this.down.delete(e.code); });
    window.addEventListener('blur', () => { this.down.clear(); this.mouse.l = this.mouse.r = false; if (CD.onBlur) CD.onBlur(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && CD.onBlur) CD.onBlur(); });
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left; this.mouse.y = e.clientY - r.top; this.mouse.over = true;
      this.lastMouseMove = performance.now();
      if (this.device !== 'kbm') this.setDevice('kbm');
    });
    canvas.addEventListener('mouseleave', () => { this.mouse.over = false; });
    canvas.addEventListener('mousedown', (e) => {
      Sound.init();
      if (e.button === 0) { this.mouse.l = true; this.mouse.lEdge = true; }
      if (e.button === 2) { this.mouse.r = true; this.mouse.rEdge = true; }
      this.lastMouseMove = performance.now();
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouse.l = false; if (e.button === 2) this.mouse.r = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => { if (this.gameFocus) { e.preventDefault(); this.mouse.wheel += Math.sign(e.deltaY); } }, { passive: false });
    window.addEventListener('gamepadconnected', () => { this.pad.on = true; });
    this.bindTouch();
  },
  setDevice(d) {
    this.device = d;
    const app = $('app');
    if (d === 'touch') app.classList.add('touchy');
    else if (d === 'kbm') app.classList.remove('touchy');
    if (CD.onDevice) CD.onDevice(d);
  },
  bindTouch() {
    const T = this.touch;
    const stick = (id, onMove, onEnd) => {
      const el = $(id), knob = el.querySelector('i');
      let pid = null, cx = 0, cy = 0;
      const move = (e) => {
        const r = el.getBoundingClientRect(), R = r.width / 2;
        let dx = e.clientX - cx, dy = e.clientY - cy;
        const d = Math.hypot(dx, dy), m = Math.min(d, R * 0.72);
        if (d > 0) { dx = (dx / d) * m; dy = (dy / d) * m; }
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        onMove(dx / (R * 0.72), dy / (R * 0.72), d);
      };
      const begin = (e) => {
        e.preventDefault(); Sound.init();
        if (pid !== null) return;
        pid = e.pointerId; try { el.setPointerCapture(pid); } catch (err) { /* ignore */ }
        const r = el.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
        this.setDevice('touch'); T.on = true; el.classList.add('active');
        if (CD.ctlFx) CD.ctlFx(el, e);
        move(e);
      };
      el._begin = begin;
      el.addEventListener('pointerdown', (e) => { if (CD.ctlEdit) return; begin(e); });
      el.addEventListener('pointermove', (e) => { if (e.pointerId === pid) move(e); });
      const end = (e) => { if (e.pointerId !== pid) return; pid = null; knob.style.transform = ''; el.classList.remove('active'); if (CD.ctlStickEnd) CD.ctlStickEnd(el); onEnd(); };
      el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    };
    stick('stick-l', (x, y) => { T.mx = x; T.my = y; }, () => { T.mx = T.my = 0; });
    stick('stick-a', (x, y, d) => { T.attack = true; T.aimOn = d > 14; if (T.aimOn) { T.ax = x; T.ay = y; } }, () => { T.attack = false; T.aimOn = false; });
    const btn = (id, name) => {
      const el = $(id);
      el.addEventListener('pointerdown', (e) => { if (CD.ctlEdit) return; e.preventDefault(); Sound.init(); this.setDevice('touch'); T.held.add(name); T.edge.add(name); el.classList.add('down'); if (CD.ctlFx) CD.ctlFx(el, e); try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } });
      const up = () => { T.held.delete(name); el.classList.remove('down'); };
      el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    };
    btn('tb-dash', 'dash'); btn('tb-ab1', 'ab1'); btn('tb-ab2', 'ab2'); btn('tb-use', 'use'); btn('tb-pot', 'potion'); btn('tb-swap', 'swap');
    btn('tb-pause', 'pause'); btn('tb-map', 'map');
    // any touch on the page marks a touch player
    window.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' && this.device !== 'touch') this.setDevice('touch'); }, true);
  },
  pollPad() {
    const P = this.pad;
    // every connected pad, normalised to the standard layout; the one you are using wins
    let list = [];
    try { list = navigator.getGamepads ? [...navigator.getGamepads()] : []; } catch (e) { list = []; }
    const pads = [];
    for (const g of list) if (g && g.connected !== false && g.buttons && g.axes) { const n = normPad(g); if (n) pads.push(n); }
    const nat = this.nativePad ? this.nativePad() : null;
    if (nat) pads.push(normPad(nat));
    P.web = pads.some((q) => !q.native);
    P.edge.clear();
    const now = performance.now(), last = this.padLast;
    // activity means a button going down or a stick actually moving: a drifting stick that sits still does not count
    for (const q of pads) {
      const prev = last[q.key], b = q.buttons.map((v) => v > 0.5);
      const press = b.some((x, i) => x && !(prev && prev.b[i]));
      const moved = prev ? q.axes.some((v, i) => Math.abs(v - prev.a[i]) > 0.25 && Math.abs(v) > 0.5) : false;
      if (press || moved) this.padSeen[q.key] = now;
      q.b = b; q.press = press;
      last[q.key] = { b, a: q.axes.slice() };
    }
    // stay on the current pad unless another one is pressed while it rests
    let gp = pads.find((q) => q.key === P.key) || null;
    const curIdle = !gp || now - (this.padSeen[gp.key] || 0) > 1200;
    for (const q of pads) {
      if (q === gp) continue;
      const better = !gp || (q.native && !gp.native && (this.padSeen[q.key] || 0) > 0) || (curIdle && q.press);
      if (better) gp = q;
    }
    if (!gp && pads.length) gp = pads.find((q) => q.native) || pads.find((q) => q.standard) || pads[0];
    if (!gp) { P.on = false; P.lx = P.ly = P.rx = P.ry = 0; P.b = P.pb = []; P.key = null; return; }
    P.on = true;
    const Z = (CD.settings && CD.settings.deadzone) ?? 0.2;
    // a radial dead zone keeps diagonals smooth
    const stick = (x, y) => { const m = Math.hypot(x, y); if (m < Z) return [0, 0]; const k = Math.min(1, (m - Z) / (1 - Z)) / m; return [x * k, y * k]; };
    const switched = P.key !== gp.key;
    P.key = gp.key; P.id = gp.id;
    P.gp = gp; P.native = !!gp.native; P.standard = gp.standard;
    [P.lx, P.ly] = stick(gp.axes[0] || 0, gp.axes[1] || 0); [P.rx, P.ry] = stick(gp.axes[2] || 0, gp.axes[3] || 0);
    const b = gp.b, prevB = switched ? b : P.pb; // a pad you switch to does not replay what it already held
    for (let i = 0; i < b.length; i++) if (b[i] && !prevB[i]) P.edge.add(i);
    const any = gp.press || Math.hypot(P.lx, P.ly) > 0.3 || Math.hypot(P.rx, P.ry) > 0.3;
    if (any && this.device !== 'pad' && (gp.press || this.padSeen[gp.key] > now - 300)) this.setDevice('pad');
    P.pb = b; P.b = b;
  },
  padLast: {},
  padSeen: {},
  // inside some embedded pages the browser hides controllers entirely
  padBlocked() {
    try {
      const fp = document.featurePolicy || document.permissionsPolicy;
      if (fp && fp.allowsFeature && !fp.allowsFeature('gamepad')) return true;
      if (!navigator.getGamepads) return true;
      navigator.getGamepads();
      return false;
    } catch (e) { return true; }
  },
  key(name) { return KEYMAP[name].some((k) => this.down.has(k)); },
  keyEdge(name) { return KEYMAP[name].some((k) => this.edge.has(k)); },
  padHeld(name) { const b = this.pad.b || []; return (PADMAP[name] || []).some((i) => !!b[i]); },
  padEdge(name) { return (PADMAP[name] || []).some((i) => this.pad.edge.has(i)); },
  // Fold every source into one action set. Call once per frame before the game reads Input.act.
  update() {
    this.pollPad();
    const P = this.pad, T = this.touch, M = this.mouse, A = this.act, pb = P.b || [], pe = P.edge;
    let mx = (this.key('right') ? 1 : 0) - (this.key('left') ? 1 : 0);
    let my = (this.key('down') ? 1 : 0) - (this.key('up') ? 1 : 0);
    if (P.on && (Math.abs(P.lx) > 0 || Math.abs(P.ly) > 0)) { mx += P.lx; my += P.ly; }
    if (P.on) { mx += (pb[15] ? 1 : 0) - (pb[14] ? 1 : 0); my += (pb[13] ? 1 : 0) - (pb[12] ? 1 : 0); }
    if (T.on) { mx += T.mx; my += T.my; }
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    A.mx = mx; A.my = my;
    // aim source
    const padAim = P.on && Math.hypot(P.rx, P.ry) > 0.35;
    if (padAim) { A.aimMode = 'stick'; A.ax = P.rx; A.ay = P.ry; }
    else if (T.on && T.aimOn) { A.aimMode = 'stick'; A.ax = T.ax; A.ay = T.ay; }
    else if (this.device === 'kbm' && M.over && performance.now() - this.lastMouseMove < 4000) A.aimMode = 'mouse';
    else A.aimMode = 'auto';
    A.attack = M.l || this.key('attack') || this.padHeld('attack') || (padAim && CD.settings && CD.settings.padAutoFire) || T.attack;
    A.dash = this.keyEdge('dash') || this.padEdge('dash') || T.edge.has('dash');
    A.ab1 = this.keyEdge('ab1') || M.rEdge || this.padEdge('ab1') || T.edge.has('ab1');
    A.ab2 = this.keyEdge('ab2') || this.padEdge('ab2') || T.edge.has('ab2');
    A.use = this.keyEdge('use') || this.padEdge('use') || T.edge.has('use');
    A.swap = this.keyEdge('swap') || this.padEdge('swap') || T.edge.has('swap') || M.wheel !== 0;
    A.potion = this.keyEdge('potion') || this.padEdge('potion') || T.edge.has('potion');
    A.pause = this.keyEdge('pause') || this.padEdge('pause') || T.edge.has('pause');
    A.map = this.keyEdge('map') || this.padEdge('map') || T.edge.has('map');
    // menu navigation
    A.navUp = this.edge.has('ArrowUp') || this.edge.has('KeyW') || pe.has(12);
    A.navDown = this.edge.has('ArrowDown') || this.edge.has('KeyS') || pe.has(13);
    A.navLeft = this.edge.has('ArrowLeft') || this.edge.has('KeyA') || pe.has(14);
    A.navRight = this.edge.has('ArrowRight') || this.edge.has('KeyD') || pe.has(15);
    A.confirm = this.keyEdge('confirm') || pe.has(0);
    A.back = this.edge.has('Escape') || pe.has(1) || pe.has(9) || this.edge.has('BrowserBack');
    if (CD.bot) CD.bot(A);
    // left-stick menu navigation with repeat
    const now = performance.now();
    if (P.on) {
      const sy = P.ly, sx = P.lx;
      if (Math.abs(sy) > 0.6 || Math.abs(sx) > 0.6) {
        if (!this._stickT || now - this._stickT > 220) {
          this._stickT = now;
          if (Math.abs(sy) > Math.abs(sx)) { if (sy > 0) A.navDown = true; else A.navUp = true; }
          else if (sx > 0) A.navRight = true; else A.navLeft = true;
        }
      } else this._stickT = 0;
    }
  },
  endFrame() {
    this.edge.clear(); this.touch.edge.clear();
    this.mouse.lEdge = this.mouse.rEdge = false; this.mouse.wheel = 0;
  },
  clearHeld() { this.down.clear(); this.mouse.l = this.mouse.r = false; this.touch.attack = false; },
};

