// tools/modules.js: the one source of module order, for the build, the lint, the Node loader and the export.
// A module is a file in src/js named NN-name.js (two digits, then lower-case words joined by dashes).
// Modules run in the order of their number, then of their name.
//   all()             every module file name, in order
//   sim()             the modules below 50: the simulation and its content, which load without a browser
//   presentation()    the modules from 50 up
//   layerOf(file)     'sim' (00 to 29) | 'content' (30 to 49) | 'presentation' (50 to 99)
//   read(file)        the text of a module
//   namespaces(file)  the names a module declares before its enclosed function ([] if the file is absent)
//   DECLARERS         the only two modules that may declare names: ['00-core.js', '50-platform.js']
//   DIR               the absolute path of src/js
'use strict';
const fs = require('fs'), path = require('path');

const DIR = path.join(__dirname, '..', 'src', 'js');
const NAME = /^(\d\d)-[a-z0-9]+(?:-[a-z0-9]+)*\.js$/;
const DECLARERS = ['00-core.js', '50-platform.js'];

function number(file) {
  const m = NAME.exec(path.basename(file));
  if (!m) throw new Error(`not a module name (NN-name.js): ${file}`);
  return Number(m[1]);
}

const inOrder = (a, b) => number(a) - number(b) || (a < b ? -1 : a > b ? 1 : 0);
const all = () => fs.readdirSync(DIR).filter((f) => NAME.test(f)).sort(inOrder);
const sim = () => all().filter((f) => number(f) < 50);
const presentation = () => all().filter((f) => number(f) >= 50);
const read = (file) => fs.readFileSync(path.join(DIR, path.basename(file)), 'utf8');

function layerOf(file) {
  const n = number(file);
  return n < 30 ? 'sim' : n < 50 ? 'content' : 'presentation';
}

// The declarations sit between the header comment and the enclosed function, as "const A = {}, B = {};".
// tools/lint.js checks that nothing else is there, so reading the names needs no parser.
function namespaces(file) {
  if (!fs.existsSync(path.join(DIR, path.basename(file)))) return [];
  const top = read(file).split(/^\(function/m)[0].replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  return Array.from(top.matchAll(/([A-Za-z_$][\w$]*)\s*=\s*\{\s*\}/g), (m) => m[1]);
}

module.exports = { all, sim, presentation, layerOf, read, namespaces, number, NAME, DECLARERS, DIR };
