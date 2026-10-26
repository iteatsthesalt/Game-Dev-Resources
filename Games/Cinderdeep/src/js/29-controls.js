/* ============================================================
   Cinderdeep — controls: touch layouts you can drag around,
   skins and effects for the on-screen controls, floating sticks,
   keyboard and gamepad rebinding, controller glyphs, rumble and
   haptics, spatial menu navigation, the Android app bridge, and
   phone orientation (landscape first)
   ============================================================ */
Object.assign(DEFAULT_SETTINGS, { deadzone: 0.2, rumble: 0.7, haptics: true, glyphs: 'auto', orient: 'auto', orientChosen: false });
const IS_APK = !!window.AndroidHost;
const CTRL = [
  { id: 'stick-l', name: 'Move stick', w: 132, h: 132 },
  { id: 'stick-a', name: 'Attack stick', w: 128, h: 128 },
  { id: 'tb-dash', name: 'Dash', w: 58, h: 58 },
  { id: 'tb-ab1', name: 'Ability 1', w: 58, h: 58 },
  { id: 'tb-ab2', name: 'Ability 2', w: 58, h: 58 },
  { id: 'tb-use', name: 'Use', w: 64, h: 64 },
  { id: 'tb-pot', name: 'Potion', w: 48, h: 48 },
  { id: 'tb-swap', name: 'Swap', w: 48, h: 48 },
  { id: 'tb-map', name: 'Map', w: 64, h: 38, rect: true },
  { id: 'tb-pause', name: 'Pause', w: 72, h: 38, rect: true },
];
const CTRL_BY = Object.fromEntries(CTRL.map((c) => [c.id, c]));
// positions are control centres as fractions of the safe screen area, plus a size factor
const BASE_LAYOUT = {
  landscape: { 'stick-l': [0.12, 0.72, 1], 'stick-a': [0.88, 0.72, 1], 'tb-dash': [0.73, 0.86, 1], 'tb-ab1': [0.735, 0.6, 1], 'tb-ab2': [0.8, 0.43, 1], 'tb-use': [0.93, 0.42, 1], 'tb-pot': [0.05, 0.42, 1], 'tb-swap': [0.13, 0.42, 1], 'tb-map': [0.44, 0.06, 1], 'tb-pause': [0.56, 0.06, 1] },
  portrait: { 'stick-l': [0.22, 0.89, 1], 'stick-a': [0.78, 0.89, 1], 'tb-dash': [0.5, 0.93, 1], 'tb-ab1': [0.5, 0.82, 1], 'tb-ab2': [0.7, 0.77, 1], 'tb-use': [0.87, 0.73, 1], 'tb-pot': [0.14, 0.76, 1], 'tb-swap': [0.29, 0.76, 1], 'tb-map': [0.7, 0.19, 1], 'tb-pause': [0.89, 0.19, 1] },
};
const mirror = (L) => Object.fromEntries(Object.entries(L).map(([k, [x, y, s]]) => [k, [k === 'tb-map' || k === 'tb-pause' ? x : 1 - x, y, s]]));
const shrink = (L, k) => Object.fromEntries(Object.entries(L).map(([id, [x, y, s]]) => [id, [0.5 + (x - 0.5) * 1.06, y + (1 - y) * 0.05, s * k]]));
const PRESETS = {
  classic: { name: 'Classic', make: (o) => BASE_LAYOUT[o] },
  lefty: { name: 'Left-handed', make: (o) => mirror(BASE_LAYOUT[o]) },
  compact: { name: 'Compact', make: (o) => shrink(BASE_LAYOUT[o], 0.82) },
  big: { name: 'Big thumbs', make: (o) => Object.fromEntries(Object.entries(BASE_LAYOUT[o]).map(([id, [x, y, s]]) => [id, [x, y, s * 1.2]])) },
  arcade: { name: 'Arcade', make: (o) => o === 'landscape'
    ? { ...BASE_LAYOUT.landscape, 'tb-dash': [0.7, 0.88, 1.1], 'tb-ab1': [0.69, 0.66, 1.05], 'tb-ab2': [0.76, 0.5, 1.05], 'tb-use': [0.88, 0.4, 1], 'tb-swap': [0.95, 0.56, 0.9], 'tb-pot': [0.3, 0.86, 0.9] }
    : { ...BASE_LAYOUT.portrait, 'tb-dash': [0.5, 0.9, 1.1], 'tb-ab1': [0.5, 0.8, 1.05], 'tb-ab2': [0.66, 0.72, 1.05], 'tb-use': [0.84, 0.69, 1], 'tb-pot': [0.1, 0.72, 0.9], 'tb-swap': [0.26, 0.72, 0.9] } },
};
const SKINS = {
  classic: { name: 'Cinder (classic)', fc: '#ffd08a' },
  ember: { name: 'Living ember', fc: '#ff9a3c' },
  neon: { name: 'Neon', fc: '#ff4ad0' },
  glass: { name: 'Frosted glass', fc: '#ffffff' },
  pixel: { name: 'Pixel', fc: '#ffb35e' },
  chaos: { name: 'Chaos', fc: '#c873ff' },
  minimal: { name: 'Minimal', fc: '#f1e5cd' },
};
const DEFAULT_CONTROLS = () => ({ preset: 'classic', skin: 'classic', size: 1, opacity: 0.9, floatL: true, floatR: false, fx: { ripple: true, sparks: true, glow: true, haptics: true }, layouts: { landscape: null, portrait: null } });
function controls() {
  const s = CD.save;
  if (!s.controls) s.controls = DEFAULT_CONTROLS();
  const c = s.controls, d = DEFAULT_CONTROLS();
  for (const k in d) if (c[k] == null) c[k] = d[k];
  c.fx = { ...d.fx, ...(c.fx || {}) }; c.layouts = c.layouts || { landscape: null, portrait: null };
  return c;
}
const orientNow = () => (window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait');
function layoutFor(o) {
  const c = controls(), base = (PRESETS[c.preset] || PRESETS.classic).make(o);
  return { ...base, ...(c.layouts[o] || {}) };
}
const safeProbe = (() => { let el = null; return () => {
  if (!el) { el = h('div', { style: { position: 'absolute', visibility: 'hidden', pointerEvents: 'none', paddingTop: 'env(safe-area-inset-top, 0px)', paddingRight: 'env(safe-area-inset-right, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)', paddingLeft: 'env(safe-area-inset-left, 0px)' } }); document.body.append(el); }
  const cs = getComputedStyle(el);
  return { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
}; })();
function ctlArea() {
  const app = $('app'), W = app.clientWidth || window.innerWidth, H = app.clientHeight || window.innerHeight, s = safeProbe();
  const o = W >= H ? 'landscape' : 'portrait';
  const auto = o === 'landscape' ? clamp(H / 430, 0.68, 1.2) : clamp(W / 400, 0.74, 1.25);
  return { W, H, s, o, x0: s.l + 8, y0: s.t + 8, w: W - s.l - s.r - 16, h: H - s.t - s.b - 16, k: auto * controls().size };
}
function placeControl(id, A, pos) {
  const el = $(id), C = CTRL_BY[id];
  if (!el || !C) return;
  const [fx, fy, fs] = pos, sc = A.k * (fs || 1), w = C.w * sc, hh = C.h * sc;
  const cx = A.x0 + fx * A.w, cy = A.y0 + fy * A.h;
  Object.assign(el.style, { left: Math.round(cx - w / 2) + 'px', top: Math.round(cy - hh / 2) + 'px', right: 'auto', bottom: 'auto', width: Math.round(w) + 'px', height: Math.round(hh) + 'px', fontSize: Math.round((C.rect ? 17 : 14) * Math.max(0.8, sc)) + 'px', padding: C.rect ? '0' : '' });
  el.dataset.home = JSON.stringify([cx, cy]);
}
function layoutControls() {
  const t = $('touch');
  if (!t || !CD.save) return;
  const c = controls(), A = ctlArea(), L = layoutFor(A.o);
  for (const C of CTRL) placeControl(C.id, A, L[C.id] || BASE_LAYOUT[A.o][C.id]);
  t.className = `touch skin-${SKINS[c.skin] ? c.skin : 'classic'}${CD.ctlEdit ? ' editing' : ''}`;
  $('app').style.setProperty('--fc', (SKINS[c.skin] || SKINS.classic).fc);
  t.style.opacity = String(CD.ctlEdit ? 1 : c.opacity);
  $('stick-l').classList.toggle('floating', !!c.floatL && !CD.ctlEdit);
  $('stick-a').classList.toggle('floating', !!c.floatR && !CD.ctlEdit);
  $('tzone-l').hidden = !c.floatL || !!CD.ctlEdit; $('tzone-r').hidden = !c.floatR || !!CD.ctlEdit;
  for (const C of CTRL) { const el = $(C.id); if (el) el.dataset.label = C.name; }
}
window.addEventListener('resize', () => { requestAnimationFrame(() => { layoutControls(); checkRotate(); }); });
window.addEventListener('orientationchange', () => setTimeout(() => { layoutControls(); checkRotate(); }, 250));

/* ---------- floating sticks: touch anywhere on that side ---------- */
function bindZones() {
  for (const [zone, stickId, flag] of [['tzone-l', 'stick-l', 'floatL'], ['tzone-r', 'stick-a', 'floatR']]) {
    const z = $(zone);
    z.addEventListener('pointerdown', (e) => {
      if (CD.ctlEdit || !controls()[flag]) return;
      const el = $(stickId), w = el.offsetWidth, hh = el.offsetHeight;
      const A = ctlArea();
      const x = clamp(e.clientX, A.x0 + w / 2, A.x0 + A.w - w / 2), y = clamp(e.clientY, A.y0 + hh / 2, A.y0 + A.h - hh / 2);
      el.style.left = Math.round(x - w / 2) + 'px'; el.style.top = Math.round(y - hh / 2) + 'px';
      el._begin && el._begin(e);
    });
  }
}
CD.ctlStickEnd = (el) => { if (el.classList.contains('floating')) setTimeout(() => { if (!el.classList.contains('active')) layoutControls(); }, 160); };

/* ---------- press effects, ready pulses, haptics and rumble ---------- */
const NPAD = { on: false, id: '', axes: [0, 0, 0, 0], buttons: new Array(17).fill(0), seen: false };
function haptic(ms) {
  if (!CD.settings.haptics || !controls().fx.haptics) return;
  try { if (IS_APK && window.AndroidHost.vibrate) window.AndroidHost.vibrate(ms); else if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* not supported */ }
}
function rumble(strong, weak, ms) {
  const k = CD.settings.rumble ?? 0.7;
  if (!k || Input.device !== 'pad') return;
  if (IS_APK && NPAD.on && Input.pad.native) { try { window.AndroidHost.rumble(Math.round(ms), clamp(Math.max(strong, weak) * k, 0, 1)); } catch (e) { /* old host */ } return; }
  const gp = Input.pad.gp && Input.pad.gp.src;
  if (!gp) return;
  try {
    const va = gp.vibrationActuator;
    if (va && va.playEffect) va.playEffect(va.type === 'trigger-rumble' ? 'trigger-rumble' : 'dual-rumble', { startDelay: 0, duration: ms, strongMagnitude: clamp(strong * k, 0, 1), weakMagnitude: clamp(weak * k, 0, 1) }).catch(() => {});
    else if (gp.hapticActuators && gp.hapticActuators[0] && gp.hapticActuators[0].pulse) gp.hapticActuators[0].pulse(clamp(Math.max(strong, weak) * k, 0, 1), ms).catch(() => {}); // Firefox
  } catch (e) { /* no rumble */ }
}
CD.ctlFx = (el, e) => {
  const c = controls(), fxl = $('tfx');
  haptic(el.id === 'tb-dash' ? 16 : 9);
  if (!fxl || CD.settings.lowFx) return;
  const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
  if (c.fx.ripple) { const d = h('span', { class: 'trip', style: { left: x + 'px', top: y + 'px' } }); fxl.append(d); setTimeout(() => d.remove(), 500); }
  if (c.fx.sparks) for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + Math.random() * 0.5, d = 26 + Math.random() * 30;
    const sp = h('span', { class: 'tspark', style: { left: x + 'px', top: y + 'px' } });
    sp.style.setProperty('--dx', Math.round(Math.cos(a) * d) + 'px'); sp.style.setProperty('--dy', Math.round(Math.sin(a) * d) + 'px');
    fxl.append(sp); setTimeout(() => sp.remove(), 560);
  }
};
const readyWas = [true, true];
hook('update', () => {
  const p = G.p;
  if (!p || Input.device !== 'touch' || !controls().fx.glow) return;
  for (let i = 0; i < 2; i++) {
    const a = p.abilities[i], ready = !a || a.cd <= 0;
    if (ready && !readyWas[i] && a) { const el = $(i ? 'tb-ab2' : 'tb-ab1'); el.classList.remove('ready'); void el.offsetWidth; el.classList.add('ready'); setTimeout(() => el.classList.remove('ready'), 700); haptic(6); }
    readyWas[i] = ready;
  }
});
hook('onHurt', () => { rumble(0.7, 0.5, 160); if (Input.device === 'touch') haptic(28); });
const _shakeCtl = shake;
shake = function (a) { _shakeCtl(a); if (a >= 3) rumble(Math.min(1, a / 12), Math.min(1, a / 8), 70 + a * 12); };
hook('onLevel', () => rumble(0.2, 0.6, 220));
hook('bossStart', () => { rumble(0.9, 0.9, 600); if (Input.device === 'touch') haptic(60); });

/* ---------- bindings: keyboard and gamepad ---------- */
const BIND_ACTIONS = [['up', 'Move up'], ['down', 'Move down'], ['left', 'Move left'], ['right', 'Move right'], ['attack', 'Attack'], ['dash', 'Dash'], ['ab1', 'Ability 1'], ['ab2', 'Ability 2'], ['use', 'Use / interact'], ['swap', 'Swap weapon'], ['potion', 'Potion'], ['map', 'Map'], ['pause', 'Pause']];
const KEYMAP_DEFAULT = JSON.parse(JSON.stringify(KEYMAP));
const PADMAP_DEFAULT = JSON.parse(JSON.stringify(PADMAP));
function applyBinds() {
  const B = CD.save.binds || {};
  for (const k in KEYMAP_DEFAULT) KEYMAP[k] = [...((B.keys && B.keys[k]) || KEYMAP_DEFAULT[k])];
  for (const k in PADMAP_DEFAULT) PADMAP[k] = [...((B.pad && B.pad[k]) || PADMAP_DEFAULT[k])];
}
// a key or button taken from another action hands that action this one's old binding
function bindKey(action, code) {
  const B = (CD.save.binds = CD.save.binds || {}); B.keys = B.keys || {};
  const prev = [...KEYMAP[action]];
  for (const k of Object.keys(KEYMAP)) if (k !== action && k !== 'confirm' && KEYMAP[k].includes(code)) {
    const left = KEYMAP[k].filter((c) => c !== code);
    B.keys[k] = left.length ? left : prev.filter((c) => c !== code).slice(0, 1);
  }
  B.keys[action] = [code, ...KEYMAP_DEFAULT[action].filter((c) => c !== code && !Object.keys(KEYMAP).some((k) => k !== action && (B.keys[k] || KEYMAP[k]).includes(c)))].slice(0, 2);
  applyBinds(); persist();
}
function bindPad(action, idx) {
  const B = (CD.save.binds = CD.save.binds || {}); B.pad = B.pad || {};
  const prev = [...PADMAP[action]];
  for (const k of Object.keys(PADMAP)) if (k !== action && PADMAP[k].includes(idx)) {
    const left = PADMAP[k].filter((i) => i !== idx);
    B.pad[k] = left.length ? left : prev.filter((i) => i !== idx).slice(0, 1);
  }
  B.pad[action] = [idx];
  applyBinds(); persist();
}
const GLYPHS = {
  xbox: { name: 'Xbox', b: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'LS', 'RS', 'D↑', 'D↓', 'D←', 'D→', 'Home'] },
  ps: { name: 'PlayStation', b: ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'Share', 'Options', 'L3', 'R3', 'D↑', 'D↓', 'D←', 'D→', 'PS'] },
  switch: { name: 'Nintendo', b: ['B', 'A', 'Y', 'X', 'L', 'R', 'ZL', 'ZR', '−', '+', 'LS', 'RS', 'D↑', 'D↓', 'D←', 'D→', 'Home'] },
};
function glyphStyle() {
  const g = CD.settings.glyphs;
  if (GLYPHS[g]) return g;
  const id = (Input.pad.id || '').toLowerCase();
  if (/xbox|xinput|045e|microsoft/.test(id)) return 'xbox';
  if (/054c|playstation|dualshock|dualsense|sony|^wireless controller/.test(id)) return 'ps';
  if (/057e|nintendo|switch|joy-con|pro controller/.test(id)) return 'switch';
  return 'xbox';
}
const padGlyph = (i) => GLYPHS[glyphStyle()].b[i] || `B${i}`;
const keyName = (code) => ({ Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'R-Shift', ControlLeft: 'Ctrl', ControlRight: 'R-Ctrl', AltLeft: 'Alt', Escape: 'Esc', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Enter: 'Enter', Tab: 'Tab', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\' }[code] || code.replace(/^Key|^Digit|^Numpad/, (m) => (m === 'Numpad' ? 'Num' : '')));
function keyLabel(action) {
  const d = Input.device;
  if (d === 'touch') return '';
  if (d === 'pad') { const b = PADMAP[action]; return b && b.length ? padGlyph(b[0]) : ''; }
  if (action === 'attack') return 'LMB';
  const k = KEYMAP[action]; return k && k.length ? keyName(k[0]) : '';
};
// a live view of the controller, so you can see what the game reads
function padTester() {
  const cv = h('canvas', { width: 300, height: 92, class: 'padtest' }), info = h('small', { class: 'padtest-info' }, '');
  const g = cv.getContext('2d');
  const names = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'VIEW', 'MENU', 'LS', 'RS', 'UP', 'DN', 'LF', 'RT', 'HOME'];
  const draw = () => {
    if (!cv.isConnected) return;
    const P = Input.pad, b = (P.gp && P.gp.buttons) || [];
    g.clearRect(0, 0, 300, 92);
    const st = (cx, x, y) => { g.strokeStyle = '#6a5a60'; g.beginPath(); g.arc(cx, 34, 24, 0, TAU); g.stroke(); g.fillStyle = '#ffb04a'; g.beginPath(); g.arc(cx + x * 22, 34 + y * 22, 6, 0, TAU); g.fill(); };
    st(30, P.lx || 0, P.ly || 0); st(270, P.rx || 0, P.ry || 0);
    g.font = '9px monospace'; g.textAlign = 'center';
    names.forEach((n, i) => { const x = 74 + (i % 9) * 18, y = 18 + Math.floor(i / 9) * 30; g.fillStyle = b[i] > 0.5 ? '#ffb04a' : '#2a2026'; g.fillRect(x - 8, y - 8, 16, 16); g.fillStyle = b[i] > 0.5 ? '#120a0e' : '#9a8a90'; g.fillText(n.slice(0, 2), x, y + 3); });
    g.fillStyle = '#9a8a90'; g.textAlign = 'left'; g.fillText('L stick', 8, 88); g.textAlign = 'right'; g.fillText('R stick', 292, 88);
    info.textContent = P.on ? `${P.native ? 'Read by the app' : P.standard ? 'Standard layout' : 'Raw layout, remapped (' + ((CD.settings.padLayout && CD.settings.padLayout !== 'auto') ? CD.settings.padLayout : padFamily(P.id)) + ')'} · ${(P.id || '').slice(0, 60)}` : 'Press any button on your controller.';
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
  return h('div', { class: 'padtest-wrap' }, cv, info);
}
function padToast(connected) {
  if (!CD.save) return;
  if (connected) toast(`Controller connected · ${GLYPHS[glyphStyle()].name} buttons`, '#9ff6ff');
  else { toast('Controller disconnected'); if (G.mode === 'play' && !UI.top() && G.p && !G.p.dead) UI.pause(); }
}
window.addEventListener('gamepadconnected', () => setTimeout(() => padToast(true), 50));
window.addEventListener('gamepaddisconnected', () => padToast(false));

/* ---------- the Android app: native controllers, back button, pausing ---------- */
// The app forwards controller state in the standard gamepad layout:
// 0 A, 1 B, 2 X, 3 Y, 4 LB, 5 RB, 6 LT, 7 RT, 8 View, 9 Menu, 10 LS, 11 RS, 12-15 d-pad, 16 Home
CD.nativePad = (id, connected, lx, ly, rx, ry, lt, rt, mask) => {
  const was = NPAD.on;
  NPAD.on = !!connected; NPAD.id = String(id || 'Controller');
  NPAD.axes = [+lx || 0, +ly || 0, +rx || 0, +ry || 0];
  for (let i = 0; i < 17; i++) NPAD.buttons[i] = (mask >> i) & 1;
  NPAD.buttons[6] = Math.max(NPAD.buttons[6], +lt || 0); NPAD.buttons[7] = Math.max(NPAD.buttons[7], +rt || 0);
  if (NPAD.on !== was) { Input.pad.id = NPAD.id; padToast(NPAD.on); }
};
Input.nativePad = () => (NPAD.on ? { id: NPAD.id, connected: true, axes: NPAD.axes, buttons: NPAD.buttons.map((v) => ({ pressed: v > 0.5, value: v })), native: true } : null);
// Back: close what is open, pause a run, or leave the app from the title screen
CD.nativeBack = () => {
  const top = UI.top();
  if (top && (top._opts.onBack || top._opts.modal)) { Input.edge.add('Escape'); return 'ok'; }
  if (G.mode === 'play' && G.p && !G.p.dead && !top) { UI.pause(); return 'ok'; }
  if (top && G.mode !== 'title') { UI.title(); return 'ok'; }
  return 'exit';
};
CD.appPause = () => { try { if (CD.onBlur) CD.onBlur(); if (Sound.ctx && Sound.ctx.state === 'running') Sound.ctx.suspend(); } catch (e) { /* ignore */ } };
CD.appResume = () => { try { if (Sound.ctx) Sound.ctx.resume(); layoutControls(); } catch (e) { /* ignore */ } };

/* ---------- orientation: landscape on phones ---------- */
const isPhone = () => (window.matchMedia && matchMedia('(pointer: coarse)').matches) && Math.min(screen.width, screen.height) < 600;
function applyOrient() {
  const o = CD.settings.orient;
  if (IS_APK) { try { window.AndroidHost.setOrientation(o === 'auto' ? 'sensor' : o); } catch (e) { /* old host */ } }
  else if (o !== 'auto' && screen.orientation && screen.orientation.lock && document.fullscreenElement) screen.orientation.lock(o).catch(() => {});
  checkRotate();
}
function goFullscreenLandscape() {
  CD.settings.orient = 'landscape'; CD.settings.orientChosen = true; persist();
  if (IS_APK) { applyOrient(); return; }
  const el = document.documentElement, req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (req) Promise.resolve().then(() => req.call(el, { navigationUI: 'hide' })).then(() => { if (screen.orientation && screen.orientation.lock) return screen.orientation.lock('landscape'); }).catch(() => toast('Turn your phone sideways to play in landscape')).finally(() => setTimeout(() => { layoutControls(); checkRotate(); }, 300));
  else { toast('Turn your phone sideways to play in landscape'); checkRotate(); }
}
function checkRotate() {
  const el = $('rotate');
  if (!el || !CD.settings) return;
  const want = CD.settings.orient, o = orientNow();
  el.hidden = !(isPhone() && !IS_APK && want !== 'auto' && want !== o);
}
document.addEventListener('fullscreenchange', () => setTimeout(() => { layoutControls(); checkRotate(); }, 200));
$('rotate-ok').addEventListener('click', () => { CD.settings.orient = 'auto'; persist(); checkRotate(); Sound.play('ui'); });

/* ---------- menus: move focus by direction, not just in a line ---------- */
function spatialPick(list, cur, dx, dy) {
  const r0 = cur.getBoundingClientRect(), c0x = r0.left + r0.width / 2, c0y = r0.top + r0.height / 2;
  let best = null, bs = Infinity;
  for (const e of list) {
    if (e === cur) continue;
    const r = e.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    const vx = r.left + r.width / 2 - c0x, vy = r.top + r.height / 2 - c0y, along = vx * dx + vy * dy;
    if (along <= 4) continue;
    const across = Math.abs(vx * dy - vy * dx);
    const overlap = dx ? r.bottom > r0.top + 2 && r.top < r0.bottom - 2 : r.right > r0.left + 2 && r.left < r0.right - 2;
    const score = along + across * (overlap ? 0.3 : 2.2);
    if (score < bs) { bs = score; best = e; }
  }
  return best;
}
UI.nav = function () {
  const el = this.top(), A = Input.act;
  if (!el) return;
  if (el._listening) { el._listening(A); return; }
  if (A.back || (A.map && el._isMap)) { Sound.play('back'); if (el._opts.onBack) el._opts.onBack(); else if (el._opts.modal) this.close(el); return; }
  if (el._customNav && el._customNav(A)) return;
  const f = this.focusables(el);
  if (!f.length) return;
  const cur = document.activeElement, has = f.includes(cur), PE = Input.pad.edge;
  const dx = A.navLeft ? -1 : A.navRight ? 1 : 0, dy = A.navUp ? -1 : A.navDown ? 1 : 0;
  const go = (t) => { if (!t) return; t.focus({ preventScroll: true }); t.scrollIntoView({ block: 'nearest', inline: 'nearest' }); Sound.play('ui', { v: 0.5 }); };
  const tag = has ? cur.tagName : '';
  // sliders and pickers keep the keyboard's arrows; a pad changes them sideways
  if (tag === 'INPUT' || tag === 'SELECT') {
    const padX = PE.has(14) ? -1 : PE.has(15) ? 1 : 0;
    if (padX && cur.type === 'range') { const st = +cur.step || 0.05; cur.value = clamp(+cur.value + padX * st, +cur.min, +cur.max); cur.dispatchEvent(new Event('input', { bubbles: true })); Sound.play('ui', { v: 0.4 }); return; }
    if (padX && tag === 'SELECT') { cur.selectedIndex = clamp(cur.selectedIndex + padX, 0, cur.options.length - 1); cur.dispatchEvent(new Event('change', { bubbles: true })); Sound.play('ui', { v: 0.4 }); return; }
    if (PE.has(0) && cur.type === 'checkbox') { cur.click(); return; }
    const padY = PE.has(12) ? -1 : PE.has(13) ? 1 : 0;
    if (padY || (Input.device === 'pad' && dy)) go(spatialPick(f, cur, 0, padY || dy) || f[(f.indexOf(cur) + (padY || dy) + f.length) % f.length]);
    return;
  }
  if (dx || dy) {
    if (!has) { go(el.querySelector('[data-autofocus]:not([disabled])') || f[0]); return; }
    go(spatialPick(f, cur, dx, dy) || (dy ? f[(f.indexOf(cur) + dy + f.length) % f.length] : null));
    return;
  }
  if (PE.has(0) && has) cur.click();
};

/* ---------- the layout editor ---------- */
UI.ctlEditor = function (back) {
  const t = $('touch');
  CD.ctlEdit = true; t.hidden = false; $('tb-use').hidden = false;
  const c = controls(), o = ctlArea().o;
  const cur = () => ({ ...layoutFor(o) });
  let L = cur(), sel = null, drag = null, spot = 0;
  const nameEl = h('b', {}), sizeIn = h('input', { type: 'range', min: 0.6, max: 1.8, step: 0.05, value: 1, oninput: () => { if (!sel) return; L[sel] = [L[sel][0], L[sel][1], +sizeIn.value]; save(); } });
  const save = () => { c.layouts[o] = L; persist(); layoutControls(); mark(); };
  const mark = () => { for (const C of CTRL) $(C.id).classList.toggle('sel', C.id === sel); nameEl.textContent = sel ? CTRL_BY[sel].name : 'Tap a control, then drag it'; sizeIn.disabled = !sel; if (sel) sizeIn.value = L[sel][2] || 1; };
  const onDown = (e) => {
    const el = e.target.closest('.stick, .tb, .tsmall');
    if (!el || !CTRL_BY[el.id]) return;
    e.preventDefault(); e.stopPropagation();
    sel = el.id; mark(); Sound.play('ui', { v: 0.5 });
    const r = el.getBoundingClientRect();
    drag = { id: el.id, pid: e.pointerId, ox: e.clientX - (r.left + r.width / 2), oy: e.clientY - (r.top + r.height / 2) };
    try { t.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  };
  const onMove = (e) => {
    if (!drag || e.pointerId !== drag.pid) return;
    const A = ctlArea();
    const x = clamp((e.clientX - drag.ox - A.x0) / A.w, 0, 1), y = clamp((e.clientY - drag.oy - A.y0) / A.h, 0, 1);
    L[drag.id] = [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000, (L[drag.id] && L[drag.id][2]) || 1];
    placeControl(drag.id, A, L[drag.id]);
  };
  const onUp = (e) => { if (drag && e.pointerId === drag.pid) { drag = null; save(); } };
  t.addEventListener('pointerdown', onDown, true); t.addEventListener('pointermove', onMove); t.addEventListener('pointerup', onUp); t.addEventListener('pointercancel', onUp);
  const close = () => {
    CD.ctlEdit = false;
    t.removeEventListener('pointerdown', onDown, true); t.removeEventListener('pointermove', onMove); t.removeEventListener('pointerup', onUp); t.removeEventListener('pointercancel', onUp);
    for (const C of CTRL) $(C.id).classList.remove('sel');
    t.hidden = !(G.mode === 'play' && Input.device === 'touch');
    $('tb-use').hidden = true; HUD.last = {};
    layoutControls();
    UI.close(panel);
    if (back) back();
  };
  // nudge the selected control with the arrow keys or the d-pad
  const nudge = (dx, dy) => { if (!sel) return false; const [x, y, s] = L[sel]; L[sel] = [clamp(x + dx * 0.01, 0, 1), clamp(y + dy * 0.01, 0, 1), s]; save(); return true; };
  const presetSel = h('select', { 'aria-label': 'Apply a preset', onchange: (e) => { const id = e.target.value; e.target.value = ''; if (!PRESETS[id]) return; c.preset = id; c.layouts[o] = null; L = cur(); save(); toast(`${PRESETS[id].name} layout`); } },
    h('option', { value: '' }, 'Apply a preset…'), ...Object.entries(PRESETS).map(([id, P]) => h('option', { value: id }, P.name)));
  const moveBtn = btn('Move panel', () => { spot = (spot + 1) % 3; panel.classList.toggle('high', spot === 1); panel.classList.toggle('low', spot === 2); }, 'small');
  const panel = h('div', { class: 'ctl-panel' },
    h('div', { class: 'ctl-top' }, h('span', { class: 'ctl-title' }, `Editing the ${o} layout`), nameEl),
    h('div', { class: 'ctl-row' }, h('label', { class: 'ctl-size' }, 'Size', sizeIn), presetSel),
    h('small', { class: 'ctl-hint' }, 'Drag a control to move it. Arrow keys or the d-pad nudge the one you picked, and the bumpers pick the next one.'),
    h('div', { class: 'row' }, moveBtn, btn('Reset', () => { c.layouts[o] = null; L = cur(); sel = null; save(); }, 'small'), btn('Done', close, 'primary small', { 'data-autofocus': true })));
  panel._customNav = (A) => {
    const PE = Input.pad.edge, dx = (Input.edge.has('ArrowLeft') || PE.has(14) ? -1 : 0) + (Input.edge.has('ArrowRight') || PE.has(15) ? 1 : 0), dy = (Input.edge.has('ArrowUp') || PE.has(12) ? -1 : 0) + (Input.edge.has('ArrowDown') || PE.has(13) ? 1 : 0);
    if ((dx || dy) && sel && document.activeElement !== sizeIn) return nudge(dx, dy);
    if (PE.has(4) || PE.has(5)) { const i = CTRL.findIndex((C) => C.id === sel); sel = CTRL[(i + (PE.has(5) ? 1 : CTRL.length - 1) + CTRL.length) % CTRL.length].id; mark(); return true; }
    return false;
  };
  UI.open(panel, { modal: G.mode === 'play', replace: false, onBack: close });
  layoutControls(); mark();
};

/* ---------- the controls screen ---------- */
UI.controls = function (back, tab = 'touch') {
  const S = CD.settings, c = controls();
  const save = () => { persist(); layoutControls(); };
  let el = null;
  const reopen = (t) => { window.removeEventListener('keydown', listenKey, true); UI.close(el); UI.controls(back, t); };
  const row = (label, input) => h('label', { class: 'set-row' }, label, input);
  const check = (label, get, set) => row(label, h('input', { type: 'checkbox', checked: get() ? true : null, onchange: (e) => { set(e.target.checked); save(); } }));
  const range = (label, min, max, step, get, set) => row(label, h('input', { type: 'range', min, max, step, value: get(), oninput: (e) => { set(+e.target.value); save(); } }));
  const select = (label, opts, get, set) => row(label, h('select', { onchange: (e) => { set(e.target.value); save(); } }, ...opts.map(([v, l]) => h('option', { value: v, selected: String(get()) === String(v) ? true : null }, l))));
  const body = h('div', { class: 'ctl-body' });
  let listening = null;
  const listenKey = (e) => {
    if (!listening || listening.kind !== 'key') return;
    e.preventDefault(); e.stopPropagation();
    if (e.code !== 'Escape') { bindKey(listening.action, e.code); Sound.play('pickup'); }
    listening = null; reopen('keys');
  };
  if (tab === 'touch') {
    const skinRow = h('div', { class: 'skins' }, ...Object.entries(SKINS).map(([id, K]) => h('button', { type: 'button', class: `skin-chip skin-${id} ${c.skin === id ? 'on' : ''}`, onclick: () => { c.skin = id; save(); Sound.play('ui'); reopen('touch'); } }, h('i', {}), K.name)));
    body.append(
      h('h3', {}, 'Layout'),
      h('div', { class: 'row', style: { justifyContent: 'flex-start' } }, ...Object.entries(PRESETS).map(([id, P]) => btn(P.name, () => { c.preset = id; c.layouts = { landscape: null, portrait: null }; save(); reopen('touch'); }, `small ${c.preset === id ? 'primary' : ''}`))),
      h('div', { class: 'row', style: { justifyContent: 'flex-start' } }, btn('Edit layout: drag the controls', () => { UI.close(el); UI.ctlEditor(() => UI.controls(back, 'touch')); }, 'primary'), btn('Reset both layouts', () => { c.layouts = { landscape: null, portrait: null }; save(); toast('Layouts reset'); }, 'small')),
      range('Control size', 0.7, 1.5, 0.05, () => c.size, (v) => { c.size = v; }),
      range('Opacity', 0.3, 1, 0.05, () => c.opacity, (v) => { c.opacity = v; }),
      check('Floating move stick (touch anywhere on the left)', () => c.floatL, (v) => { c.floatL = v; }),
      check('Floating attack stick (touch anywhere on the right)', () => c.floatR, (v) => { c.floatR = v; }),
      h('h3', {}, 'Style'), skinRow,
      h('h3', {}, 'Effects'),
      check('Ripples when you press', () => c.fx.ripple, (v) => { c.fx.ripple = v; }),
      check('Sparks when you press', () => c.fx.sparks, (v) => { c.fx.sparks = v; }),
      check('Glow when an ability is ready', () => c.fx.glow, (v) => { c.fx.glow = v; }),
      check('Vibration', () => c.fx.haptics && S.haptics, (v) => { c.fx.haptics = v; S.haptics = v; if (v) haptic(30); }),
      h('h3', {}, 'Screen'),
      select('Orientation', [['auto', 'Follow the phone'], ['landscape', 'Landscape'], ['portrait', 'Portrait']], () => S.orient, (v) => { S.orient = v; S.orientChosen = true; applyOrient(); }),
      IS_APK ? null : h('div', { class: 'row', style: { justifyContent: 'flex-start' } }, btn('Play fullscreen in landscape', () => goFullscreenLandscape(), 'small')));
  }
  if (tab === 'pad') {
    const P = Input.pad;
    const status = h('div', { class: 'padinfo' }, h('i', { class: `dot ${P.on ? 'on' : ''}` }), h('span', {}, P.on ? `${(P.id || 'Controller').replace(/\s*\(.*$/, '').slice(0, 48) || 'Controller'} · ${GLYPHS[glyphStyle()].name} buttons` : Input.padBlocked() ? 'This page is embedded in a way that hides controllers from the game. Open the downloaded HTML file, the Linux app or the Android app to play with a controller.' : 'No controller yet. Plug one in or pair it over Bluetooth, then press any button. Firefox only shows a controller after you press a button with this page focused.'));
    const binds = h('div', { class: 'binds' }, ...BIND_ACTIONS.filter(([a]) => PADMAP[a]).map(([a, label]) => h('div', { class: 'bind' }, h('span', {}, label), h('kbd', {}, (PADMAP[a] || []).map(padGlyph).join(' / ') || '—'),
      btn('Rebind', (ev) => { listening = { kind: 'pad', action: a }; Sound.play('ui'); ev.currentTarget.textContent = 'Press a button…'; el._listening = () => { const e2 = [...Input.pad.edge]; if (Input.edge.has('Escape')) { listening = null; el._listening = null; reopen('pad'); return; } if (e2.length) { bindPad(a, e2[0]); Sound.play('pickup'); listening = null; el._listening = null; reopen('pad'); } }; }, 'small'))));
    body.append(status,
      select('Button labels', [['auto', 'Match the controller'], ['xbox', 'Xbox'], ['ps', 'PlayStation'], ['switch', 'Nintendo']], () => S.glyphs, (v) => { S.glyphs = v; reopen('pad'); }),
      range('Stick dead zone', 0.05, 0.45, 0.01, () => S.deadzone ?? 0.2, (v) => { S.deadzone = v; }),
      range('Rumble', 0, 1, 0.05, () => S.rumble ?? 0.7, (v) => { S.rumble = v; }),
      check('Right stick also attacks', () => S.padAutoFire, (v) => { S.padAutoFire = v; }),
      h('div', { class: 'row', style: { justifyContent: 'flex-start' } }, btn('Test rumble', () => { const was = Input.device; Input.device = 'pad'; rumble(1, 1, 400); Input.device = was; }, 'small'), btn('Reset buttons', () => { if (CD.save.binds) CD.save.binds.pad = {}; applyBinds(); persist(); reopen('pad'); }, 'small')),
      select('Raw controller layout (only if buttons are mixed up, e.g. Firefox on Linux)', [['auto', 'Detect'], ['xbox', 'Xbox style'], ['ps', 'PlayStation style'], ['switch', 'Nintendo style']], () => S.padLayout || 'auto', (v) => { S.padLayout = v; }),
      padTester(),
      h('h3', {}, 'Buttons'), binds,
      h('p', { class: 'foot', style: { textAlign: 'left' } }, 'The left stick or d-pad moves, the right stick aims. In menus the bottom face button confirms and the right one goes back.'));
  }
  if (tab === 'keys') {
    const binds = h('div', { class: 'binds' }, ...BIND_ACTIONS.map(([a, label]) => h('div', { class: 'bind' }, h('span', {}, label), h('kbd', {}, a === 'attack' ? ['Mouse', ...KEYMAP.attack.map(keyName)].join(' / ') : KEYMAP[a].map(keyName).join(' / ')),
      btn('Rebind', (ev) => { listening = { kind: 'key', action: a }; ev.currentTarget.textContent = 'Press a key…'; window.addEventListener('keydown', listenKey, true); toast(`Press a key for ${label} · Esc cancels`); }, 'small'))));
    body.append(h('h3', {}, 'Keys'), binds, h('div', { class: 'row', style: { justifyContent: 'flex-start' } }, btn('Reset keys', () => { if (CD.save.binds) CD.save.binds.keys = {}; applyBinds(); persist(); reopen('keys'); }, 'small')),
      h('p', { class: 'foot', style: { textAlign: 'left' } }, 'Right click casts ability 1 and the mouse wheel swaps weapons.'));
  }
  const tabs = [['touch', 'Touch'], ['pad', 'Gamepad'], ['keys', 'Keyboard']];
  const done = () => { window.removeEventListener('keydown', listenKey, true); UI.close(el); if (back) back(); };
  el = h('div', { class: 'modal' }, h('div', { class: 'panel wide' },
    h('h2', {}, 'Controls'),
    h('div', { class: 'tabs', role: 'tablist' }, ...tabs.map(([id, l]) => btn(l, () => reopen(id), 'small', { role: 'tab', 'aria-selected': id === tab ? 'true' : 'false', 'data-autofocus': id === tab ? true : null }))),
    body,
    h('div', { class: 'row' }, btn('Done', done, 'primary'))));
  UI.open(el, { modal: G.mode === 'play', replace: G.mode !== 'play', onBack: done });
};
// settings, pause and title link here
settingsRow('controls', 10, (back) => h('div', { class: 'menu', style: { width: '100%' } },
  btn('Controls, layouts and gamepad', () => UI.controls(() => { if (G.mode !== 'play') UI.settings(back); })),
  G.mode === 'play' ? null : btn('Move progress to another device', () => UI.saveTransfer(() => UI.settings(back)))));
pauseItem('controls', 90, (el) => btn('Controls', () => { UI.close(el); UI.controls(() => UI.pause()); }));
const _titleCtl = UI.title;
UI.title = function () {
  _titleCtl();
  const el = UI.top(), menu = el && el.querySelector('.menu');
  if (!menu) return;
  const set = [...menu.children].find((b) => b.textContent === 'Settings');
  menu.insertBefore(btn('Controls', () => UI.controls(() => UI.title())), set || null);
  if (isPhone() && !IS_APK && orientNow() === 'portrait') menu.append(btn('Play in landscape', () => goFullscreenLandscape()));
};

/* ---------- moving progress between the browser and the app ---------- */
function saveCode() {
  const { sheets, ...rest } = CD.save;
  return 'CD1:' + btoa(unescape(encodeURIComponent(JSON.stringify(rest))));
}
function readSaveCode(code) {
  const t = String(code || '').trim().replace(/\s+/g, '');
  const data = JSON.parse(decodeURIComponent(escape(atob(t.replace(/^CD1:/, '')))));
  if (!data || typeof data !== 'object' || !data.stats || !data.unlocks) throw new Error('not a save');
  return data;
}
UI.saveTransfer = function (back) {
  const code = saveCode();
  const out = h('textarea', { class: 'savecode', readonly: true, rows: 3, 'aria-label': 'Your save code' });
  out.value = code;
  const inp = h('textarea', { class: 'savecode', rows: 3, placeholder: 'Paste a save code here', 'aria-label': 'Save code to load', spellcheck: 'false' });
  const close = () => { UI.close(el); if (back) back(); };
  const el = h('div', { class: 'modal' }, h('div', { class: 'panel' },
    h('h2', {}, 'Move your progress'),
    h('p', {}, 'Copy this code, then paste it into Cinderdeep on another device, in the browser or the Android app. It carries embers, characters, talent levels, the talent tree, feats and Chaos Beasts.'),
    out,
    h('div', { class: 'row', style: { justifyContent: 'flex-start' } }, btn('Copy my save code', async () => {
      try { await navigator.clipboard.writeText(code); toast('Save code copied', '#9ff6ff'); }
      catch (e) { out.focus(); out.select(); try { document.execCommand('copy'); toast('Save code copied', '#9ff6ff'); } catch (e2) { toast('Select the code and copy it'); } }
    }, 'small primary')),
    h('h3', {}, 'Load a save code'), inp,
    h('div', { class: 'row', style: { justifyContent: 'flex-start' } }, btn('Load it', () => {
      let data = null;
      try { data = readSaveCode(inp.value); } catch (e) { Sound.play('deny'); toast('That is not a Cinderdeep save code'); return; }
      UI.confirm('Replace your progress here?', 'Everything on this device is replaced by the pasted save. A run in progress is lost.', 'Replace', () => {
        const keepSheets = CD.save.sheets || [];
        CD.save = mergeSave({ ...data, sheets: keepSheets, settings: CD.save.settings });
        persist(true); applySettings();
        toast('Save loaded', '#9ff6ff'); Sound.play('ascend');
        UI.clear(); setMode('title'); UI.title();
      });
    }, 'small')),
    h('div', { class: 'row' }, btn('Done', close, 'primary'))));
  UI.open(el, { modal: G.mode === 'play', replace: G.mode !== 'play', onBack: close });
};
const _saveNoteCtl = saveNote;
saveNote = function () { return IS_APK ? 'Progress saves on this device.' : _saveNoteCtl(); };

/* ---------- boot ---------- */
const _applySettingsCtl = applySettings;
applySettings = function () {
  _applySettingsCtl();
  if (IS_APK && !CD.settings.orientChosen) CD.settings.orient = 'landscape';
  applyBinds();
  layoutControls();
  applyOrient();
};
bindZones();

