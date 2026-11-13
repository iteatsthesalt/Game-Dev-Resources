// tests/shots/scene-crowd.js: a picture of the debug scene: 200 husks walking their rings round the player, with
// test props near by, on the ground the address names.
//   node tools/shot.js --out .build/shots/crowd-flags.png --query "?view=gl&tileset=test.flags" --eval tests/shots/scene-crowd.js
// Address parameters (all optional): tileset (a tileset id, default test.flags), seconds (how long the run plays
// before the picture, default 2), walk (1: the player walks right while it plays), seed (default 7).
// It runs inside the page as one expression (tools/shot.js hands it to page.evaluate), with TB from 99-boot.js.
(async () => {
  const { Game, Scene, Plat } = TB;
  const q = new URLSearchParams(location.search), seconds = Number(q.get('seconds') || 2), walk = q.get('walk') === '1';
  const S = Game.start({ seed: Number(q.get('seed') || 7) });
  // a few props round the player's start, for their figures and the candle stand's light
  const props = [['test.pillar', -5, -3.5, 0.5], ['test.candles', 3, -2.5, 0.25], ['test.slab', -3, 4, 0.9], ['test.candles', -7.5, 2, 0.25], ['test.pillar', 8, 3, 0.5]];
  for (const [id, dx, dy, r] of props) {
    const light = TB.Defs.get('prop', id).light || null;
    S.props.push({ id, x: S.player.x + dx, y: S.player.y + dy, r, light });
  }
  S.region.grid.rebuild({ items: S.props, n: S.props.length });
  Scene.look({ tileset: q.get('tileset') || 'test.flags' });
  if (walk) window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', key: 'd', bubbles: true }));
  const start = S.step;
  await new Promise((done) => {
    const off = Plat.on('frame', () => { if (S.step - start >= seconds * 60) { off(); done(); } });
  });
  if (walk) window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD', key: 'd', bubbles: true }));
})()
