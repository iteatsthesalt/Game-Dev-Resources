#!/usr/bin/env node
// Builds the single-file game from src/. The output is what players open;
// edit src/ and rebuild, never the output.
//   node tools/build.js          write the game file
//   node tools/build.js --check  fail if the game file is not what src/ builds
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), src = path.join(root, 'src');
const OUT = path.join(root, 'Cinderdeep3D.html');
const read = (rel) => fs.readFileSync(path.join(src, rel), 'utf8');

function build() {
  // modules run in file-name order; the number in front of each name is its place
  const mods = fs.readdirSync(path.join(src, 'js')).filter((f) => /^\d{2}-[a-z0-9-]+\.js$/.test(f)).sort();
  // third-party libraries, each in its own script ahead of the game
  const vendor = fs.existsSync(path.join(src, 'vendor')) ? fs.readdirSync(path.join(src, 'vendor')).filter((f) => f.endsWith('.js')).sort() : [];
  return read('page/head.html') + '<style>\n' + read('page/style.css') + '</style>\n' + read('page/body.html') +
    vendor.map((f) => '<script>\n' + read('vendor/' + f).replace(/\n$/, '') + '\n</script>\n').join('') +
    '<script>\n' + mods.map((f) => read('js/' + f)).join('') + '</script>\n' + read('page/tail.html').replace(/\n$/, '');
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
