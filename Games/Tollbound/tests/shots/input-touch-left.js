// tests/shots/input-touch-left.js: a picture of the touch controls at their hardest, for tools/shot.js --eval:
//   node tools/shot.js --out .build/shots/touch-left.png --size 390x844 --mobile --dpr 2 --eval tests/shots/input-touch-left.js
// The buttons on the left, the stick fixed in the right corner, everything at the largest size (ui.scale 1.4),
// button A part way through a cooldown with one charge, and a thumb holding the stick down and to the left.
(async () => {
  const { Game, Settings, Input } = TB;
  Settings.set('input.hand', 'left');
  Settings.set('input.stick', 'fixed');
  Settings.set('ui.scale', 1.4);
  Game.start({ seed: 7 });
  const view = document.getElementById('view'), x = innerWidth * 0.75, y = innerHeight * 0.8;
  const finger = (type, cx, cy) => view.dispatchEvent(new PointerEvent(type, {
    pointerId: 61, pointerType: 'touch', isPrimary: true, clientX: cx, clientY: cy, bubbles: true, cancelable: true,
  }));
  finger('pointerdown', x, y);
  await new Promise((done) => requestAnimationFrame(done));
  finger('pointermove', x - 40, y + 30);
  Input.button('A', { cooldown: 0.35, charges: 1 });
  await new Promise((done) => setTimeout(done, 250));
})();
