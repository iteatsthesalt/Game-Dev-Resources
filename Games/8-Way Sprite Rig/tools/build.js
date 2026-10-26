#!/usr/bin/env node
// Builds the single-file tool from src/. The output is what people open;
// edit src/ and rebuild, never the output.
//   node tools/build.js          write sprite-rig.html
//   node tools/build.js --check  fail if sprite-rig.html is not what src/ builds
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), src = path.join(root, 'src');
const OUT = path.join(root, 'sprite-rig.html');
const read = (rel) => fs.readFileSync(path.join(src, rel), 'utf8');
const KIT = ['poses.js', 'shapes.js', 'models.js'];
// three.js is the very bundle Cinderdeep 3D ships, so what the tool previews is what the game draws with
const THREE_JS = path.join(root, '..', 'Cinderdeep3D', 'src', 'vendor', 'three.min.js');

function build() {
  // modules run in file-name order; the number in front of each name is its place
  const mods = fs.readdirSync(path.join(src, 'js')).filter((f) => /^\d{2}-[a-z0-9-]+\.js$/.test(f)).sort();
  // the rig kit (skeletons, shapes, models), shared with Cinderdeep 3D, runs first, in this order
  const kit = KIT.map((f) => read('kit/' + f)).join('');
  return read('page/head.html') + '<style>\n' + read('page/style.css') + '</style>\n' + read('page/body.html') +
    '<script>\n' + fs.readFileSync(THREE_JS, 'utf8').replace(/\n$/, '') + '\n</script>\n' +
    '<script>\n' + kit + mods.map((f) => read('js/' + f)).join('') + '</script>\n' + read('page/tail.html').replace(/\n$/, '');
}

const html = build();
if (process.argv.includes('--check')) {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (cur !== html) { console.error(`${path.basename(OUT)} is out of date with src/. Run: node tools/build.js`); process.exit(1); }
  console.log(`${path.basename(OUT)} matches src/`);
} else {
  fs.writeFileSync(OUT, html);
  console.log(`wrote ${path.basename(OUT)} (${(html.length / 1024).toFixed(0)} KB)`);
}
