// tests/shots/input-touch-idle.js: a picture of the touch controls at rest, for tools/shot.js --eval:
//   node tools/shot.js --out .build/shots/touch-idle-portrait.png --size 390x844 --mobile --eval tests/shots/input-touch-idle.js
// Starts a vigil, touches the game once (a finger down and up again on the stick side, as events made in the
// page) so that the controls show, and leaves them at rest.
(async () => {
  const { Game } = TB;
  Game.start({ seed: 7 });
  const view = document.getElementById('view'), x = 40, y = innerHeight * 0.55;
  const finger = (type) => new PointerEvent(type, { pointerId: 31, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true });
  view.dispatchEvent(finger('pointerdown'));
  view.dispatchEvent(finger('pointerup'));
  await new Promise((done) => setTimeout(done, 250));
})();
