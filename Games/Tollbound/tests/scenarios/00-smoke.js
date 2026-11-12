// tests/scenarios/00-smoke.js: the page starts, fills the window, keeps its frame, and the browser can draw in 3D.
// The same checks run on a desktop window and on a phone. A third scenario reloads the page.
// Each function below runs inside the page (see tests/run.js), so it uses only T, TB and the page itself.

const smoke = async function () {
  const phone = innerWidth < 600, root = document.documentElement;
  T.check('the page is ready', !!window.TB && TB.ready === true);
  T.check('the title is Tollbound', document.title === 'Tollbound', document.title);
  const spaces = Object.keys(TB).filter((k) => k !== 'ready');
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
  const look = { want: getComputedStyle(probe).color, have: getComputedStyle(document.body).backgroundColor, scheme: getComputedStyle(root).colorScheme };
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
    gl.attachShader(program, shader(gl.VERTEX_SHADER,
      '#version 300 es\nvoid main() { gl_Position = vec4(float((gl_VertexID << 1) & 2) * 2.0 - 1.0, float(gl_VertexID & 2) * 2.0 - 1.0, 0.0, 1.0); }'));
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

module.exports = [
  { name: 'smoke: desktop 1280x720', viewport: { width: 1280, height: 720 }, mobile: false, query: '', run: smoke },
  { name: 'smoke: phone 390x844', viewport: { width: 390, height: 844 }, mobile: true, query: '', run: smoke },
  { name: 'smoke: reload', viewport: { width: 1280, height: 720 }, mobile: false, query: 'smoke=reload', run: [beforeReload, afterReload] },
];
