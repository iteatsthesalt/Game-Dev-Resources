// tests/shots/input-settings.js: a picture of the settings screen over a paused vigil, for tools/shot.js --eval:
//   node tools/shot.js --out .build/shots/settings-portrait.png --size 390x844 --mobile --eval tests/shots/input-settings.js
// Starts a vigil, touches the game once so the touch controls show behind the screen, then pauses the way a
// player does, with the pause button (which opens the settings while there is no pause screen).
(async () => {
  const { Game, Settings } = TB;
  Game.start({ seed: 7 });
  const view = document.getElementById('view'), x = 40, y = innerHeight * 0.55;
  const finger = (type) => new PointerEvent(type, { pointerId: 51, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true });
  view.dispatchEvent(finger('pointerdown'));
  view.dispatchEvent(finger('pointerup'));
  await new Promise((done) => setTimeout(done, 100));
  const pause = document.querySelector('#touch .tc-pause');
  if (pause) pause.click(); else Settings.open();
  await new Promise((done) => setTimeout(done, 200));
})();
