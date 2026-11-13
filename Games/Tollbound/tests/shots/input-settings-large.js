// tests/shots/input-settings-large.js: the settings screen with text and controls at their largest (ui.scale 1.4),
// scrolled down to the Display group, for tools/shot.js --eval:
//   node tools/shot.js --out .build/shots/settings-large.png --size 390x844 --mobile --eval tests/shots/input-settings-large.js
(async () => {
  const { Game, Settings } = TB;
  Settings.set('ui.scale', 1.4);
  Game.start({ seed: 7 });
  Settings.open();
  const row = document.querySelector('#ui [data-setting="view.quality"]');
  if (row) row.scrollIntoView({ block: 'center' });
  await new Promise((done) => setTimeout(done, 200));
})();
