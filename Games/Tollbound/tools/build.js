#!/usr/bin/env node
// tools/build.js: joins src/ into the page players open. Edit src/ and rebuild; never edit the output by hand.
//   node tools/build.js              write Tollbound.html, the standalone page (tracked in git)
//   node tools/build.js --out <dir>  write <dir>/Tollbound.html and <dir>/Tollbound.artifact.html, touching nothing
//                                    tracked; a relative <dir> is taken from the game folder, not the current one
//   node tools/build.js --check      exit 1 if Tollbound.html is missing or is not what src/ builds
// Two targets from the same parts:
//   standalone  src/page/head.html, one <style> of src/page/css/*.css in name order, src/page/body.html,
//               one <script> of every module in the order tools/modules.js gives, src/page/tail.html
//   artifact    the page fragment the Claude app publishes: a title and one meta, then the same <style>, body and
//               <script>, with no doctype, html, head or body tag anywhere in it
// The output depends on src/ alone (no dates, no version stamps), so the same source gives the same bytes.
// For other tools: build.parts() -> {head, css, body, js, tail} with css and js as [{file, text}],
//   build.guard(parts) -> [{file, line, msg}], build.standalone(parts?), build.artifact(parts?),
//   build.sources() -> the modules as [{file, text}], exactly as they sit in the page.
'use strict';
const fs = require('fs'), path = require('path');
const modules = require('./modules.js');

const ROOT = path.join(__dirname, '..'), PAGE = path.join(ROOT, 'src', 'page');
const NAME = 'Tollbound';
const ARTIFACT_HEAD = `<title>${NAME}</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n`;

// Text as it goes into the page: no byte-order mark, Unix line ends, exactly one newline at the end.
const tidy = (text) => text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').replace(/\s*$/, '\n');
const lineOf = (text, index) => text.slice(0, index).split('\n').length;

function parts() {
  const page = (rel) => ({ file: 'src/page/' + rel, text: tidy(fs.readFileSync(path.join(PAGE, rel), 'utf8')) });
  const sheets = fs.readdirSync(path.join(PAGE, 'css')).filter((f) => f.endsWith('.css')).sort();
  return {
    head: page('head.html'),
    css: sheets.map((f) => page('css/' + f)),
    body: page('body.html'),
    js: modules.all().map((f) => ({ file: 'src/js/' + f, text: tidy(modules.read(f)) })),
    tail: page('tail.html'),
  };
}

// Text that would end its own element early, or put a document tag into the fragment, must not reach the page.
// These are plain text matches on purpose: the browser reads the page as text too, comments and strings included.
function guard(p) {
  const found = [];
  const scan = (list, re, msg) => {
    for (const part of list) {
      const m = re.exec(part.text);
      if (m) found.push({ file: part.file, line: lineOf(part.text, m.index), msg: msg.replace('{0}', m[0]) });
    }
  };
  scan(p.js, /<\/script/i, '"{0}" would end the page\'s script here; write it as "<\\/script"');
  scan(p.js, /<!--/, '"{0}" changes how a browser reads the rest of the script; write it as "<\\!--"');
  scan(p.css, /<\/style/i, '"{0}" would end the page\'s style here');
  scan([...p.css, p.body, ...p.js], /<!doctype|<\/?(?:html|head|body)\b/i,
    '"{0}" is a document tag: the published fragment may hold none, not even in a comment or a string');
  return found;
}

function checked(p) {
  const found = guard(p);
  if (found.length) throw new Error(found.map((f) => `${f.file}:${f.line}: ${f.msg}`).join('\n'));
  return p;
}

const inner = (p) =>
  '<style>\n' + p.css.map((c) => c.text).join('') + '</style>\n' + p.body.text +
  '<script>\n' + p.js.map((m) => m.text).join('') + '</script>\n';
const standalone = (p = parts()) => checked(p).head.text + inner(p) + p.tail.text;
const artifact = (p = parts()) => ARTIFACT_HEAD + inner(checked(p));
const sources = () => parts().js;

// Write through a temporary name so a test that is reading the old file never sees half of the new one.
function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
  console.log(`wrote ${path.relative(ROOT, file) || file} (${(Buffer.byteLength(text) / 1024).toFixed(1)} KB)`);
}

function main(args) {
  const tracked = path.join(ROOT, NAME + '.html');
  if (args.length === 0) return write(tracked, standalone());
  if (args.length === 1 && args[0] === '--check') {
    if (!fs.existsSync(tracked)) throw new Error(`${NAME}.html is missing. Run: node tools/build.js`);
    const now = fs.readFileSync(tracked, 'utf8').replace(/\r\n?/g, '\n').split('\n'), want = standalone().split('\n');
    let i = 0;
    while (i < want.length && now[i] === want[i]) i++;
    if (i < want.length || now.length !== want.length) {
      throw new Error(`${NAME}.html is not what src/ builds (first difference at line ${i + 1}). Run: node tools/build.js`);
    }
    return console.log(`${NAME}.html matches src/`);
  }
  if (args.length === 2 && args[0] === '--out') {
    const dir = path.resolve(ROOT, args[1]), p = parts();
    write(path.join(dir, NAME + '.html'), standalone(p));
    return write(path.join(dir, NAME + '.artifact.html'), artifact(p));
  }
  console.error('usage: node tools/build.js [--out <dir> | --check]');
  process.exit(2);
}

if (require.main === module) {
  try { main(process.argv.slice(2)); } catch (e) { console.error('build: ' + e.message); process.exit(1); }
}

module.exports = { parts, guard, standalone, artifact, sources, NAME };
