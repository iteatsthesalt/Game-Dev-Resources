// tests/shots/input-touch-stick.js: a picture of the touch controls with the stick held, for tools/shot.js --eval:
//   node tools/shot.js --out .build/shots/touch-stick-portrait.png --size 390x844 --mobile --eval tests/shots/input-touch-stick.js
// Starts a vigil and puts a thumb (events made in the page) on the stick side, then pushes it up and to the
// right, a little past the rim, and holds it there. A second finger rests on button A.
(async () => {
  const { Game } = TB;
  Game.start({ seed: 7 });
  const view = document.getElementById('view'), x = innerWidth * 0.22, y = innerHeight * 0.7;
  const finger = (type, id, at, cx, cy) => at.dispatchEvent(new PointerEvent(type, {
    pointerId: id, pointerType: 'touch', isPrimary: id === 41, clientX: cx, clientY: cy, bubbles: true, cancelable: true,
  }));
  finger('pointerdown', 41, view, x, y);
  await new Promise((done) => requestAnimationFrame(done));
  finger('pointermove', 41, view, x + 30, y - 20);
  finger('pointermove', 41, view, x + 52, y - 46);
  const a = document.querySelector('#touch .tc-a');
  if (a) {
    const box = a.getBoundingClientRect();
    finger('pointerdown', 42, a, box.left + box.width / 2, box.top + box.height / 2);
  }
  TB.Input.button('B', { cooldown: 0.6, charges: 2 });
  await new Promise((done) => setTimeout(done, 250));
})();
