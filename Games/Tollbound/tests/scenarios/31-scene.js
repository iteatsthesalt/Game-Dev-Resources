// tests/scenarios/31-scene.js: the scene, the rigs and the effects in the page (src/js/61-rigs.js, 63-ground.js,
// 68-scene.js, 69-vfx.js), on a desktop window and on a phone, in the plain view and in the 3D view.
//   - a run started from the title is drawn through Scene.draw, without an error
//   - the buffers of a frame hold the player and every enemy on screen: in the 3D view parts round each of them,
//     in the plain view a disc at each
//   - with 600 enemies the budgets hold (parts, lights), and a lower part budget drops detail parts first and
//     then draws the farthest common enemies as a body and a head, never the player
//   - an enemy killed where the camera sees it leaves particles, a number for the harm, and a falling figure
//   - the camera follows the player, a little ahead while it moves, and settles on it when it stops
//   - 600 frames later the buffers are the same arrays of the same size: nothing grows from frame to frame
// Software WebGL draws slowly here, so the 600 frames are drawn straight through Scene.draw, and no frame time is
// checked; the time spent filling the buffers is shown as information only.
// The function scene runs inside the page (see tests/run.js), so it uses only T, TB and the page itself.

const scene = async function () {
  const { Game, Scene, Gfx, Sim, Vfx, Rigs, UI, Plat, Defs } = TB;
  const wanted = new URLSearchParams(location.search).get('view');
  const view = Gfx.active;
  T.check('the view is the one asked for', !!view && view.name === wanted, view && view.name);
  const puppets = !!(view && view.caps && view.caps.puppets);

  // ---- a run from the title ----
  const begin = Array.from(document.querySelectorAll('#ui button')).find((b) => /begin/i.test(b.textContent));
  T.check('the title offers a way into a run', !!begin);
  if (!begin) return T.done();
  begin.click();
  const S = Game.S;
  T.check('it starts the debug scene', Game.state === 'run' && !!S && S.debug !== null && S.enemies.n > 0, S && S.enemies.n);
  if (!S) return T.done();
  await T.until(() => S.step >= 20 && Scene.stats.figures > 0, 20000);
  T.check('the frame loop draws it through Scene.draw', Scene.stats.figures > 0 && UI.top() === null, Scene.stats);

  // ---- what a frame holds: drawn here at alpha 1, so things stand where the run has them ----
  const canvas = view.canvas, w = canvas.clientWidth, h = canvas.clientHeight, at = { x: 0, y: 0 };
  Scene.draw(S, 1);
  const B = Scene.buffers(), p = S.player;
  const onScreen = [];
  for (let i = 0; i < S.enemies.n; i++) {
    const e = S.enemies.items[i];
    if (!e.alive) continue;
    Gfx.worldToScreen(e.x, e.y, 0, at);
    if (at.x > 8 && at.x < w - 8 && at.y > 8 && at.y < h - 8) onScreen.push(e);
  }
  T.check('there are enemies on screen', onScreen.length >= 10, onScreen.length);
  // records of a buffer near a point of the ground: parts by their place, discs by their centre
  const near = (x, y, reach) => {
    let n = 0;
    if (puppets) {
      for (let s = 0; s < B.sink.n.length; s++) {
        const buf = B.sink.buf[s], stride = B.sink.stride;
        for (let i = 0; i < B.sink.n[s]; i++) if (Math.hypot(buf[i * stride + 3] - x, buf[i * stride + 11] - y) < reach) n++;
      }
    } else {
      for (let i = 0; i < B.discN; i++) if (Math.hypot(B.discs[i * Gfx.DISC_STRIDE] - x, B.discs[i * Gfx.DISC_STRIDE + 1] - y) < reach) n++;
    }
    return n;
  };
  const playerHas = near(p.x, p.y, 0.6), missing = onScreen.filter((e) => near(e.x, e.y, puppets ? 0.6 : 0.02) < (puppets ? 3 : 1));
  T.check(puppets ? 'the player is drawn: parts round its place' : 'the player is drawn: a disc at its place', playerHas >= (puppets ? 8 : 1), playerHas);
  T.check('every enemy on screen is drawn where it stands', missing.length === 0,
    { onScreen: onScreen.length, missing: missing.length, first: missing[0] && [missing[0].x, missing[0].y] });
  const fig = Rigs.figure('debug.husk');
  if (puppets) {
    T.check('in the 3D view figures are parts, at most a figure for each thing', Scene.stats.parts >= fig.counts.core * onScreen.length && B.discN === 0,
      { parts: Scene.stats.parts, figures: Scene.stats.figures });
    T.check('and the lights include the player\'s own, first', B.lightN >= 1 && Math.hypot(B.lights[0] - p.x, B.lights[1] - p.y) < 1e-3, B.lightN);
  } else {
    T.check('in the plain view each figure is a disc, and no parts are filled', B.discN === Scene.stats.figures && Scene.stats.parts === 0, [B.discN, Scene.stats.parts]);
  }

  // ---- 600 enemies, and the budgets ----
  const big = Sim.debugScene(600, 11);
  for (let i = 0; i < 40; i++) {
    const a = i / 40 * Math.PI * 2, d = 3 + (i % 5) * 2.4;
    big.props.push({ id: 'test.candles', x: big.player.x + Math.cos(a) * d, y: big.player.y + Math.sin(a) * d, r: 0.25, light: Defs.get('prop', 'test.candles').light });
  }
  big.region.grid.rebuild({ items: big.props, n: big.props.length });
  const fills = [];
  for (let i = 0; i < 5; i++) {
    Scene.draw(big, 1);
    fills.push(Scene.stats.fillMs);
  }
  const full = Object.assign({}, Scene.stats);
  T.check('with 600 enemies the parts stay within the budget of 10000', full.parts <= 10000 && full.parts <= Scene.limits.parts, full);
  T.check('and the lights within 32, the nearest to the player first', full.lights <= 32 && (!puppets || full.lights === 32), full.lights);
  if (puppets) {
    const L = Scene.buffers(), d = (k) => Math.hypot(L.lights[k * 8] - big.player.x, L.lights[k * 8 + 1] - big.player.y);
    let order = true;
    for (let k = 2; k < L.lightN; k++) if (d(k) + 1e-6 < d(k - 1)) order = false;
    T.check('the lights chosen are in order of distance', order);
    Scene.limits.parts = 2000;
    Scene.draw(big, 1);
    const cut = Object.assign({}, Scene.stats), pf = Rigs.figure('test.biped');
    const playerParts = (() => {
      const B2 = Scene.buffers();
      let n = 0;
      for (let s = 0; s < B2.sink.n.length; s++) for (let i = 0; i < B2.sink.n[s]; i++) {
        if (Math.hypot(B2.sink.buf[s][i * B2.sink.stride + 3] - big.player.x, B2.sink.buf[s][i * B2.sink.stride + 11] - big.player.y) < 0.6) n++;
      }
      return n;
    })();
    Scene.limits.parts = 10000;
    T.check('under a budget of 2000 parts: detail goes, then far common enemies keep a body and a head', cut.parts <= 2000 && cut.detail === false && cut.cut > 0, cut);
    T.check('the player keeps every part of its figure, detail too', playerParts >= pf.n, [playerParts, pf.n]);
  }
  fills.sort((a, b) => a - b);
  T.check('filling the buffers for 600 enemies (information, not a budget here)', true, { medianMs: +fills[2].toFixed(3), figures: full.figures, parts: full.parts });

  // ---- a kill ----
  Scene.draw(S, 1);
  const victim = onScreen.find((e) => e.alive && Math.hypot(e.x - p.x, e.y - p.y) > 2);
  T.check('an enemy stands on screen to be killed', !!victim);
  if (victim) {
    const before = Vfx.stats.particles, uid = victim.uid;
    let heard = false;
    const off = Plat.on('step', (run) => {
      for (let i = 0; i < run.eventCount; i++) if (run.events[(run.eventStart + i) % run.events.length].k === 'kill') heard = true;
    });
    victim.life = 0;
    await T.until(() => heard && Vfx.stats.numbers > 0, 15000);
    off();
    T.check('the kill is an event of a live step', heard);
    T.check('it makes particles', Vfx.stats.particles > before, [before, Vfx.stats.particles]);
    T.check('and a number for the harm, over where it fell', Vfx.stats.numbers > 0, Vfx.stats);
    T.check('and the figure falls where it stood', Scene.stats.corpses >= 1, Scene.stats.corpses);
    T.check('the run goes on without it', !S.enemies.items.slice(0, S.enemies.n).some((e) => e.alive && e.uid === uid));
  }

  // ---- the camera ----
  const x0 = p.x;
  let moving = true;
  const push = Plat.on('step', (run) => { if (moving && run === S) { run.player.x += 4 / 60; } });
  await T.until(() => p.x > x0 + 4, 20000);
  const ahead = Scene.camera.x - p.x;
  T.check('while the player moves right the camera keeps up, a little ahead', ahead > -0.6 && ahead < 1.6, { camera: Scene.camera.x, player: p.x });
  moving = false;
  push();
  const stopAt = S.step;
  await T.until(() => S.step > stopAt + 40, 20000);
  await T.sleep(400);
  Gfx.worldToScreen(p.x, p.y, 0, at);
  T.check('when it stops the camera settles on it', Math.abs(Scene.camera.x - p.x) < 0.25 && Math.abs(Scene.camera.y - p.y) < 0.25,
    { camera: [Scene.camera.x, Scene.camera.y], player: [p.x, p.y] });
  T.check('and the player is in the middle of the screen', Math.abs(at.x - w / 2) < w * 0.03 && Math.abs(at.y - h / 2) < h * 0.03, [at.x, at.y, w, h]);

  // ---- 600 frames: nothing grows ----
  // What is checked is the scene's own buffers, so the 3D view is made small and plain meanwhile: software WebGL
  // would otherwise spend a minute on the pictures.
  const keep = Scene.buffers(), arrays = [keep.decals, keep.billboards, keep.lights, keep.discs, keep.bars, ...keep.sink.buf];
  const sizes = arrays.map((a) => a.length), level = puppets ? view.quality() : null;
  if (puppets) {
    view.quality('low');
    view.resize(96, 54, 1);
  }
  const t0 = performance.now();
  for (let i = 0; i < 600; i++) Scene.draw(S, i % 2 ? 1 : 0.5);
  if (puppets) {
    view.resize(w, h, Plat.dpr());
    view.quality(level);
  }
  const after = Scene.buffers(), now = [after.decals, after.billboards, after.lights, after.discs, after.bars, ...after.sink.buf];
  T.check('600 frames later the buffers are the same arrays, the same size',
    now.every((a, i) => a === arrays[i] && a.length === sizes[i]), { sizes, seconds: +((performance.now() - t0) / 1000).toFixed(1) });
  T.check('and the effects keep to their caps', Vfx.stats.particles <= 1500 && Vfx.stats.numbers <= 96, Vfx.stats);
  Game.title();
  T.check('back on the title the overlay is cleared', Vfx.stats.particles === 0 && Vfx.stats.numbers === 0, Vfx.stats);
  return T.done();
};

// The figures and grounds the build ships: every puppet hangs its parts on joints of its rig, and every ground
// texture tiles without a seam (the step from its last row to its first is no bigger than a step inside it).
const content = async function () {
  const { Defs, Rigs, Ground } = TB;
  const rigs = Rigs.names();
  T.check('the seven rigs are registered', ['biped', 'quadruped', 'floater', 'crawler', 'winged', 'serpent', 'static'].every((r) => rigs.includes(r)), rigs);
  const astray = [];
  for (const def of Defs.all('puppet')) {
    const joints = Rigs.joints(def.rig);
    for (const part of def.parts) if (!joints.includes(part.joint === undefined ? joints[0] : part.joint)) astray.push(def.id + '.' + part.key + ' on ' + part.joint);
  }
  T.check('every part of every puppet hangs on a joint of its rig', astray.length === 0, astray.slice(0, 5));
  const bad = Defs.all('puppet').filter((def) => { const f = Rigs.figure(def.id); return !f || !(f.height > 0.1) || f.counts.core < 1; });
  T.check('every puppet compiles, with a height and a core to fall back on', bad.length === 0, bad.map((d) => d.id));
  T.check('every prop has a figure', Defs.all('prop').every((p) => !!Rigs.figure(p.puppet)), Defs.all('prop').map((p) => p.id));
  T.check('the debug scene\'s enemy has a figure of ten parts', Rigs.figure('debug.husk') && Rigs.figure('debug.husk').n === 10);
  for (const set of Defs.all('tileset')) {
    const canvas = Ground.texture(set.id), px = Ground.pixels(set.id), N = Ground.SIZE;
    const step = (ax, ay, bx, by) => {
      const a = (ay * N + ax) * 4, b = (by * N + bx) * 4;
      return Math.abs(px[a] - px[b]) + Math.abs(px[a + 1] - px[b + 1]) + Math.abs(px[a + 2] - px[b + 2]);
    };
    let seamY = 0, seamX = 0, inside = 0;
    for (let k = 0; k < N; k++) {
      seamY += step(k, N - 1, k, 0);
      seamX += step(N - 1, k, 0, k);
      inside += (step(k, N / 2 - 1, k, N / 2) + step(N / 2 - 1, k, N / 2, k)) / 2;
    }
    T.check(set.id + ' is painted as a ' + N + ' by ' + N + ' canvas, ' + Ground.span(set.id) + ' m across', canvas.width === N && canvas.height === N && px.length === N * N * 4);
    T.check(set.id + ' tiles without a seam', seamX <= inside * 1.6 + N && seamY <= inside * 1.6 + N, { seamX, seamY, inside: Math.round(inside) });
    T.check(set.id + ' is the same picture every time', Ground.texture(set.id) === canvas && Ground.pixels(set.id) === px);
  }
  return T.done();
};

module.exports = [
  { name: 'scene: the figures and grounds that ship', viewport: { width: 1280, height: 720 }, mobile: false, query: 'view=2d', run: content },
  { name: 'scene: plain view, desktop 1280x720', viewport: { width: 1280, height: 720 }, mobile: false, query: 'view=2d&seed=3', run: scene, timeout: 180000 },
  { name: 'scene: plain view, phone 390x844', viewport: { width: 390, height: 844 }, mobile: true, query: 'view=2d&seed=3', run: scene, timeout: 180000 },
  { name: 'scene: 3D view, desktop 1280x720', viewport: { width: 1280, height: 720 }, mobile: false, query: 'view=gl&seed=3', run: scene, timeout: 240000 },
  { name: 'scene: 3D view, phone 390x844', viewport: { width: 390, height: 844 }, mobile: true, query: 'view=gl&seed=3', run: scene, timeout: 240000 },
];
