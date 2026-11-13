// tests/scenarios/00-smoke.js: the page starts, fills the window, keeps its frame, and the browser can draw in 3D.
// The same checks run on a desktop window and on a phone. More scenarios turn the phone on its side with a
// notch, reload the page, and try the runner's real input (T.tap, T.key, T.mouse, T.touch) on both devices.
// Each function below runs inside the page (see tests/run.js), so it uses only T, TB and the page itself.

const smoke = async function () {
  const phone = innerWidth < 600, root = document.documentElement;
  T.check('the page is ready', !!window.TB && TB.ready === true);
  T.check('the title is Tollbound', document.title === 'Tollbound', document.title);
  const spaces = Object.keys(TB).filter((k) => /^[A-Z]/.test(k));   // namespaces are the capitalised entries
  T.check('the namespaces are collected and sealed', !!TB.Core && spaces.every((k) => Object.isFrozen(TB[k])), spaces.join(' '));

  // the frame of body.html and 00-base.css
  const app = document.getElementById('app'), layers = app ? Array.from(app.children, (e) => e.id).join(' ') : '';
  T.check('the six layers are there, back to front', layers === 'view overlay hud touch ui toast', layers);
  const view = document.getElementById('view').getBoundingClientRect();
  T.check('the canvas fills the window', view.left === 0 && view.top === 0 && view.width === innerWidth && view.height === innerHeight,
    { canvas: [view.left, view.top, view.width, view.height], window: [innerWidth, innerHeight] });
  T.check('the page does not scroll', root.scrollWidth <= innerWidth && root.scrollHeight <= innerHeight, [root.scrollWidth, root.scrollHeight]);
  T.check('the overlay lets pointer input through', getComputedStyle(document.getElementById('overlay')).pointerEvents === 'none');
  const thin = ['hud', 'touch', 'ui', 'toast'].filter((id) => {
    const cs = getComputedStyle(document.getElementById(id));
    return parseFloat(cs.paddingLeft) < 16 || parseFloat(cs.paddingRight) < 16 || parseFloat(cs.paddingTop) < 12 || parseFloat(cs.paddingBottom) < 12;
  });
  T.check('text layers keep 16px at the sides and 12px above and below', thin.length === 0, thin.join(' '));
  const probe = document.createElement('i');
  probe.style.color = 'var(--bg)';
  document.body.appendChild(probe);
  const look = {
    want: getComputedStyle(probe).color, have: getComputedStyle(document.body).backgroundColor, scheme: getComputedStyle(root).colorScheme,
  };
  probe.remove();
  T.check('the page wears its own dark look', look.have === look.want && look.scheme === 'dark', look);

  // what the runner promises
  T.check('touch matches the device', (navigator.maxTouchPoints > 0) === phone, navigator.maxTouchPoints);
  if (T.target === 'artifact') {
    let refused = false;
    try { localStorage.getItem('x'); } catch (e) { refused = true; }
    T.check('the host page refuses storage', refused);
  }

  // WebGL2: the 3D view needs it in tests. The info of the first check is the renderer the browser used.
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 16;
  const gl = canvas.getContext('webgl2');
  let renderer = 'no webgl2 context';
  if (gl) {
    const names = gl.getExtension('WEBGL_debug_renderer_info');
    renderer = gl.getParameter(names ? names.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
  }
  T.check('WebGL2 is available', !!gl, renderer);
  if (gl) {
    // one triangle over the whole canvas through a GLSL ES 3.00 program, then read a pixel back
    const shader = (type, source) => { const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s); return s; };
    const program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, '#version 300 es\nvoid main() {' +
      ' gl_Position = vec4(float((gl_VertexID << 1) & 2) * 2.0 - 1.0, float(gl_VertexID & 2) * 2.0 - 1.0, 0.0, 1.0); }'));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER,
      '#version 300 es\nprecision mediump float;\nout vec4 color;\nvoid main() { color = vec4(0.0, 1.0, 0.0, 1.0); }'));
    gl.linkProgram(program);
    const linked = gl.getProgramParameter(program, gl.LINK_STATUS), pixel = new Uint8Array(4);
    if (linked) {
      gl.useProgram(program);
      gl.viewport(0, 0, 16, 16);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.readPixels(8, 8, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    }
    T.check('WebGL2 draws with a GLSL ES 3.00 program', linked && pixel[0] === 0 && pixel[1] === 255 && pixel[3] === 255,
      linked ? Array.from(pixel) : gl.getProgramInfoLog(program));
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
  }
  return T.done();
};

// The runner reports safe-area insets of 0, 47, 21 and 47 px (top, right, bottom, left) for this one.
const notch = async function () {
  const pads = {};
  for (const id of ['hud', 'touch', 'ui', 'toast']) {
    const cs = getComputedStyle(document.getElementById(id));
    pads[id] = [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].join(' ');
  }
  T.check('text layers keep clear of the notch and never go under 12px and 16px',
    Object.values(pads).every((p) => p === '12px 47px 21px 47px'), pads);
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;top:var(--edge-top);right:var(--edge-right);bottom:var(--edge-bottom);left:var(--edge-left)';
  document.getElementById('app').appendChild(probe);
  const r = probe.getBoundingClientRect(), edges = [r.top, innerWidth - r.right, innerHeight - r.bottom, r.left];
  probe.remove();
  T.check('the edge tokens follow the notch', edges.join(' ') === '12 47 21 47', edges);
  const view = document.getElementById('view').getBoundingClientRect();
  T.check('the canvas still fills the window, under the notch too',
    view.width === innerWidth && view.height === innerHeight, [view.width, view.height]);
  return T.done();
};

const beforeReload = async function () {
  window.smokeMark = 1;
  if (T.target === 'standalone') localStorage.setItem('tb.smoke', 'kept');
  T.check('the page is ready', !!window.TB && TB.ready === true);
  T.check('the query reaches the page', location.search === '?smoke=reload', location.search);
  return T.done();
};

const afterReload = async function () {
  T.check('the reload gave a new page, ready again', window.smokeMark === undefined && !!window.TB && TB.ready === true);
  T.check('the query is kept', location.search === '?smoke=reload', location.search);
  if (T.target === 'standalone') {
    T.check('storage survives the reload', localStorage.getItem('tb.smoke') === 'kept');
    localStorage.removeItem('tb.smoke');
  }
  return T.done();
};

// T.tap, T.key and their kin send what a player would: the page gets trusted events, at the place asked for.
const input = async function () {
  const phone = innerWidth < 600, seen = [];
  const note = (e) => {
    const at = e.changedTouches ? e.changedTouches[0] : e;
    seen.push({ type: e.type, trusted: e.isTrusted, x: Math.round(at.clientX), y: Math.round(at.clientY), code: e.code || '', down: e.touches ? e.touches.length : -1 });
  };
  for (const type of ['touchstart', 'touchmove', 'touchend', 'mousedown', 'mouseup', 'click', 'keydown', 'keyup']) window.addEventListener(type, note, true);
  const of = (type) => seen.filter((e) => e.type === type);
  const last = (type) => of(type).pop() || {};
  const is = (e, x, y) => e.trusted === true && e.x === x && e.y === y;

  // a tap: a finger on a phone, the mouse elsewhere. The place is clear of every control of the title.
  await T.tap(40, 300);
  await T.until(() => of('click').length > 0, 3000);
  T.check('T.tap ends in a trusted click at the place asked for', is(last('click'), 40, 300), last('click'));
  T.check('on a phone the tap is a finger, elsewhere the mouse', phone ? is(last('touchstart'), 40, 300) && of('touchend').length === 1 && of('mousedown').length <= 1
    : is(last('mousedown'), 40, 300) && of('touchstart').length === 0, seen.map((e) => e.type).join(' '));
  T.check('T.middle gives the middle of an element', (() => { const m = T.middle(document.getElementById('app')); return m.x === innerWidth / 2 && m.y === innerHeight / 2; })());

  // keys
  seen.length = 0;
  await T.keyDown('KeyD');
  const held = last('keydown');
  await T.keyUp('KeyD');
  await T.key('F8');
  T.check('T.keyDown and T.keyUp send trusted key events with their code', held.trusted === true && held.code === 'KeyD' && last('keyup').trusted === true && of('keyup')[0].code === 'KeyD', held);
  T.check('T.key presses a key and lets it go', of('keydown').length === 2 && of('keyup').length === 2 && last('keydown').code === 'F8' && last('keyup').code === 'F8', seen.map((e) => e.type + ' ' + e.code).join(', '));

  // the mouse, step by step
  seen.length = 0;
  await T.mouse('move', 200, 120);
  await T.mouse('down');
  await T.mouse('move', 230, 150);
  await T.mouse('up');
  T.check('T.mouse moves, presses and lets go where it is', is(last('mousedown'), 200, 120) && is(last('mouseup'), 230, 150), [last('mousedown'), last('mouseup')]);

  // raw touches: a thumb down, dragged, a second thumb, and both lifted
  let refusal = '';
  if (phone) {
    seen.length = 0;
    await T.touch('start', [{ id: 1, x: 60, y: 500 }]);
    T.check('T.touch puts a finger down', is(last('touchstart'), 60, 500) && last('touchstart').down === 1, last('touchstart'));
    await T.touch('move', [{ id: 1, x: 90, y: 520 }]);
    await T.until(() => of('touchmove').length === 1, 3000);
    T.check('and drags it', is(last('touchmove'), 90, 520) && last('touchmove').down === 1, last('touchmove'));
    await T.touch('start', [{ id: 2, x: 300, y: 600 }]);
    T.check('a second finger comes down beside the first', is(last('touchstart'), 300, 600) && last('touchstart').down === 2, last('touchstart'));
    await T.touch('move', [{ id: 2, x: 310, y: 610 }]);
    await T.until(() => of('touchmove').length === 2, 3000);   // the browser may hold a move back until its next frame
    T.check('and moves while the first stays', is(last('touchmove'), 310, 610) && last('touchmove').down === 2 && of('touchmove').length === 2, of('touchmove'));
    await T.touch('end', [{ id: 1, x: 90, y: 520 }]);
    await T.until(() => of('touchend').length === 1, 3000);
    T.check('an end lifts the finger it names', of('touchend').length === 1 && is(last('touchend'), 90, 520) && last('touchend').down === 1, of('touchend'));
    await T.touch('end', []);
    await T.until(() => of('touchend').length === 2, 3000);
    T.check('and an end that names none lifts all that are down', of('touchend').length === 2 && is(last('touchend'), 310, 610) && last('touchend').down === 0, of('touchend'));
  } else {
    try { await T.touch('start', [{ id: 1, x: 60, y: 500 }]); } catch (e) { refusal = String(e.message || e); }
    T.check('T.touch is for scenarios on a phone, and says so elsewhere', /mobile: true/.test(refusal), refusal);
  }
  try { await T.mouse('wave', 1, 1); refusal = ''; } catch (e) { refusal = String(e.message || e); }
  T.check('an input the runner does not know is refused', /knows no input "mouse wave"/.test(refusal), refusal);
  T.check('none of it started a run or closed the title', TB.Game.state === 'title' && TB.UI.top() === 'title', [TB.Game.state, TB.UI.top()]);
  return T.done();
};

module.exports = [
  { name: 'smoke: desktop 1280x720', viewport: { width: 1280, height: 720 }, mobile: false, query: '', run: smoke },
  { name: 'smoke: phone 390x844', viewport: { width: 390, height: 844 }, mobile: true, query: '', run: smoke },
  { name: 'smoke: phone on its side, with a notch', viewport: { width: 844, height: 390 }, mobile: true, query: '',
    safeArea: { top: 0, right: 47, bottom: 21, left: 47 }, run: notch },
  { name: 'smoke: reload', viewport: { width: 1280, height: 720 }, mobile: false, query: 'smoke=reload', run: [beforeReload, afterReload] },
  { name: 'smoke: real input, desktop', viewport: { width: 1280, height: 720 }, mobile: false, query: '', run: input },
  { name: 'smoke: real input, phone', viewport: { width: 390, height: 844 }, mobile: true, query: '', run: input },
];
