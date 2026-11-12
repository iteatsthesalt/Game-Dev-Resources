#!/usr/bin/env node
// Builds the single-file app from src/. The output is what people open;
// edit src/ and rebuild, never the output.
//   node tools/build.js               write Tactilume.html
//   node tools/build.js --check       fail if Tactilume.html is not what src/ builds
//   node tools/build.js --out x.html  write somewhere else (for experiments)
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const outArg = argv.indexOf('--out');
const OUT = outArg >= 0 ? path.resolve(argv[outArg + 1]) : path.join(root, 'Tactilume.html');
const read = (rel) => fs.readFileSync(path.join(root, 'src', rel), 'utf8');

async function render() {
  // src/js is ES modules; shaders are imported as text. One classic script comes out.
  const result = await build({
    absWorkingDir: root,
    entryPoints: ['src/js/main.js'],
    bundle: true,
    format: 'iife',
    target: ['es2020'],
    loader: { '.glsl': 'text' },
    charset: 'utf8',
    legalComments: 'none',
    minify: false,
    write: false,
    logLevel: 'warning',
  });
  // "</script" inside the bundle would end the script element early
  const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const css = read('page/style.css');
  const page = read('page/index.html');
  for (const mark of ['/*__STYLE__*/', '/*__SCRIPT__*/']) {
    if (page.split(mark).length !== 2) throw new Error(`src/page/index.html must contain ${mark} exactly once`);
  }
  // function replacers: a plain string would treat "$&" and friends in the code as patterns
  return page.replace('/*__STYLE__*/', () => css).replace('/*__SCRIPT__*/', () => js);
}

const html = await render();
const name = path.basename(OUT);
if (argv.includes('--check')) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (current !== html) {
    console.error(`${name} is out of date with src/. Run: npm run build`);
    process.exit(1);
  }
  console.log(`${name} matches src/`);
} else {
  fs.writeFileSync(OUT, html);
  console.log(`wrote ${name} (${(html.length / 1024).toFixed(0)} KB)`);
}
