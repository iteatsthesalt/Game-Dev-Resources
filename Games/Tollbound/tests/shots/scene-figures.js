// tests/shots/scene-figures.js: a sheet of one figure in the 3D view, for judging its rig. Two rows of seven:
//   back row   standing, then six moments of one walk cycle, evenly spaced
//   front row  the wind-up at its height, the blow landing, the blow followed through, a flinch, and three moments
//              of dying (falling, fallen, sinking)
//   node tools/shot.js --out .build/shots/fig-biped.png --query "?view=gl&puppet=test.biped" --eval tests/shots/scene-figures.js
// Address parameters (all optional): puppet (default test.biped), face (radians, default 0.35: facing right and a
// little toward the camera), zoom (default 2.2), speed (metres a second for the walk, default by rig), tileset.
// It stops the game's frame loop and draws the sheet itself through Gfx.active, with Rigs.draw: the figures stand
// where the sheet puts them, not where a run would. One expression, run inside the page by tools/shot.js.
(async () => {
  const { Rigs, Gfx, Plat, UI } = TB;
  const q = new URLSearchParams(location.search), id = q.get('puppet') || 'test.biped';
  const fig = Rigs.figure(id);
  if (!fig) throw new Error('scene-figures: there is no puppet ' + id);
  Plat.stop();
  UI.clear();
  const view = Gfx.active, sink = Rigs.sink(2048), st = Rigs.state(), face = Number(q.get('face') || 0.35);
  const speeds = { biped: 2.6, quadruped: 3.2, crawler: 2, floater: 1.8, winged: 3, serpent: 1.6, static: 0 };
  const speed = Number(q.get('speed') || speeds[fig.rigName] || 2);
  const width = Math.max(1.5, fig.radius * 2.2) * fig.scale, gap = Math.max(1.7, width), rowGap = Math.max(2.6, fig.height * 1.1);
  const cam = { x: 0, y: 0.2, zoom: Number(q.get('zoom') || Math.min(2.6, 30 / (gap * 7.6))) };
  const env = {
    ground: q.get('tileset') || 'test.flags', ambient: [0.42, 0.45, 0.55], sun: { dir: [-0.45, -0.75, 0.5], color: [1, 0.93, 0.8] },
    fog: { color: [0.06, 0.07, 0.1], near: 40, far: 80 },
  };
  const stride = fig.rig.stride ? fig.rig.stride(fig, speed / fig.scale) : fig.anim.stride || 1;
  function draw(col, row, set) {
    const s = Rigs.state();
    s.x = s.px = (col - 3) * gap;
    s.y = s.py = (row - 0.5) * rowGap;
    s.face = face;
    s.t = 1.3 + col * 0.37;
    s.seed = 0.5;
    set(s);
    Rigs.draw(fig, s, sink);
  }
  Rigs.clear(sink);
  draw(0, 0, () => {});
  for (let k = 0; k < 6; k++) {
    draw(1 + k, 0, (s) => {
      s.speed = speed;
      s.cycle = k / 6;
      s.walk = k / 6 * stride * fig.scale;
    });
  }
  draw(0, 1, (s) => { s.act = Rigs.WINDUP; s.actT = 0.5; s.actLen = 0.5; });
  draw(1, 1, (s) => { s.act = Rigs.STRIKE; s.actT = 0.1; s.actLen = 0.35; });
  draw(2, 1, (s) => { s.act = Rigs.STRIKE; s.actT = 0.17; s.actLen = 0.35; });
  draw(3, 1, (s) => { s.hurt = 0.06; s.flash = 0.6; });
  draw(4, 1, (s) => { s.dying = true; s.die = 0.15; });
  draw(5, 1, (s) => { s.dying = true; s.die = 0.4; });
  draw(6, 1, (s) => { s.dying = true; s.die = 0.7; });
  const light = new Float32Array([0, 4, 3, 14, 1, 0.85, 0.65, 0.5]);
  for (let f = 0; f < 4; f++) {
    await new Promise((done) => requestAnimationFrame(done));
    view.begin(cam, env);
    for (let sh = 0; sh < sink.n.length; sh++) if (sink.n[sh] > 0) view.parts(sh, sink.buf[sh], sink.n[sh]);
    view.lights(light, 1);
    view.end({ vignette: 0 });
  }
})()
