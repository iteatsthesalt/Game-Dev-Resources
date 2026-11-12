// tests/shots/scene-fight.js: a picture of the effects: the debug scene, where the picture script itself harms the
// husks near the player as a fight would (the simulation has no combat yet), so that numbers rise, life bars
// show over the hurt, the killed fall and sink, and sparks, dust and marks are left; one husk is made an elite,
// one stands winding up an attack, and a warning ring fills on the ground.
//   node tools/shot.js --out .build/shots/fight.png --query "?view=gl&tileset=test.cobbles" --eval tests/shots/scene-fight.js
// Address parameters (all optional): tileset (default test.cobbles), seconds (default 2.5).
// It writes into the run (life, rank, state) as a test may and the game never does. One expression, run inside
// the page by tools/shot.js.
(async () => {
  const { Game, Scene, Plat, Sim, Vfx } = TB;
  // an event of the script's own, handed straight to Vfx (the step's own events were read before this listener)
  const tell = (k, x, y, a, b) => Vfx.consume({ events: [{ k, x, y, a, b, id: null }], eventCount: 1, eventStart: 0 });
  const q = new URLSearchParams(location.search), seconds = Number(q.get('seconds') || 2.5);
  const S = Game.start({ seed: 9 });
  Scene.look({ tileset: q.get('tileset') || 'test.cobbles' });
  const p = S.player, live = () => S.enemies.items.slice(0, S.enemies.n).filter((e) => e.alive);
  const near = (r) => live().filter((e) => Math.hypot(e.x - p.x, e.y - p.y) < r);
  // an elite among them, and one winding up its blow
  const ring = near(9);
  if (ring.length > 4) {
    ring[0].rank = Sim.ELITE;
    ring[0].r *= 1.25;
    ring[1].state = Scene.ATTACK.windup;
  }
  let n = 0, off = null;
  await new Promise((done) => {
    off = Plat.on('step', (run) => {
      if (run !== S) return;
      n++;
      if (ring.length > 4) ring[1].stateT = Math.min(0.45, ring[1].stateT + 1 / 60);
      if (n % 8 === 0) {
        const some = near(6.5);
        const e = some[(n * 7) % Math.max(1, Math.min(8, some.length))];
        if (e) {
          tell(n % 24 === 0 ? 'crit' : 'hit', e.x, e.y, 6, e.uid);
          e.life -= 7 + (n % 4) * 2;
          e.flash = 1;
        }
      }
      for (const e of live()) if (e.flash > 0) e.flash = Math.max(0, e.flash - 0.12);
      if (n === 30) tell('telegraph', p.x + 2.5, p.y - 2, 1.6, seconds);
      if (n >= seconds * 60) { off(); done(); }
    });
  });
})()
