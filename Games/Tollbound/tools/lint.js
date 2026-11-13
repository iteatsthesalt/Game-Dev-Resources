#!/usr/bin/env node
// tools/lint.js: checks the code rules that plain text can show.
//   node tools/lint.js      prints "file:line: what is wrong" for every problem and exits 1 if there is one
//
// What it checks
//   every module   starts with a comment; is one enclosed function, (function () { 'use strict'; ... })();, with
//                  nothing before or after it (00-core.js and 50-platform.js may first declare namespaces as
//                  "const A = {}, B = {};"); assigns only to namespaces named on the "Owns: A, B" line of its
//                  header comment; does not assign a namespace property that another file assigns; does not
//                  replace or hide a namespace; does not build code from text (eval, new Function)
//   00 to 49       no window, document, navigator, performance, Date, Math.random, timers, storage or globalThis
//   00 to 29       no presentation namespace
//   30 to 49       no function of any kind, no class, no new, no undefined, no namespace but Defs.add
//   99-boot.js     collects every declared namespace
//   src/js         every file is named NN-name.js
//   src/page       nothing loaded from another file or address; no 100vh (the screen is filled by height: 100%)
//   everything     no entry of docs/design/denylist.txt (when that file exists) as a whole word, in any letter
//                  case; a space in an entry also matches a dash, a dot, an underscore or nothing
//   the page       what tools/build.js guards: nothing that ends the script or style early, no document tag
//
// What it cannot see (it reads text; it neither parses nor runs the code)
//   - a namespace reached under another name (const G = Game; G.x = 1), by destructuring ([Sim.a] = list) or
//     more than one step in (Game.state.x = 1 passes: only Name.prop and Name[key] are checked)
//   - a forbidden global reached through a variable, through this, or by a name built at run time
//   - allocation, closures or string building inside per-entity loops
//   - code that does work at load time instead of only defining things
//   - presentation code that changes simulation state by writing into S instead of calling Sim.step or Sim.command
//   - content values that are not JSON (NaN, Infinity, one object used in two places)
//   - whether a header comment really lists the public functions and their signatures
//   - denylist words that are inflected, split across strings or built at run time
//   - it tells a regular expression from a division by the token before the slash; in an odd case
//     (a regular expression straight after ")" or "}") it can misread the rest of that line
//
// For tests: lint.check({js: [{file, text}], pages: [{file, text}], deny: [entry]}) -> [{file, line, msg}],
//   lint.strip(source) -> the source with all but code blanked, lint.denyEntries(listText) -> [entry]
'use strict';
const fs = require('fs'), path = require('path');
const modules = require('./modules.js');
const build = require('./build.js');

const ROOT = path.join(__dirname, '..');
const lineOf = (text, index) => text.slice(0, index).split('\n').length;

// ---- reading JavaScript as text ----

// Returns the source with everything that is not code blanked: comments, the insides of strings and
// templates, and regular expressions become spaces. The result has the same length and the same line breaks,
// so a position in it is a position in the source. Code inside a template's ${...} stays code.
function strip(src) {
  const n = src.length, code = src.split('');
  const blank = (a, b) => { for (let k = a; k < b && k < n; k++) if (code[k] !== '\n') code[k] = ' '; };
  let i = 0;
  let last = '';   // the token before this one: a word, a punctuation mark, 'v' for a string, '' at the start

  // Is the slash at i the start of a regular expression (and not a division)? Judged by what comes before it.
  function regexStarts() {
    if (last === '') return true;
    if (/^[\w$]/.test(last)) return /^(?:return|typeof|instanceof|in|of|new|delete|void|throw|case|do|else|yield|await)$/.test(last);
    return !/^(?:v|\)|\]|\}|\+\+|--)$/.test(last);
  }
  // Blanks the regular expression that starts at i and returns the index after it, or -1 if the line has none.
  function regexEnd() {
    let inClass = false;
    for (let j = i + 1; j < n && src[j] !== '\n'; j++) {
      const c = src[j];
      if (c === '\\') j++;
      else if (c === '[') inClass = true;
      else if (c === ']') inClass = false;
      else if (c === '/' && !inClass) {
        blank(i + 1, j);
        do j++; while (j < n && /[a-z]/i.test(src[j]));
        return j;
      }
    }
    return -1;
  }
  function quoted(q) {           // at the opening quote; a string never runs past its line
    let j = i + 1;
    while (j < n && src[j] !== q && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
    blank(i + 1, j);
    i = Math.min(j + 1, n);
  }
  function template() {          // at the opening backtick
    let from = ++i;
    while (i < n && src[i] !== '`') {
      if (src[i] === '\\') i += 2;
      else if (src[i] === '$' && src[i + 1] === '{') { blank(from, i); i += 2; run(true); from = i; }
      else i++;
    }
    blank(from, i);
    i = Math.min(i + 1, n);
  }
  function run(inTemplate) {     // inTemplate: stop after the brace that closes ${
    let depth = 0;
    while (i < n) {
      const c = src[i], d = src[i + 1];
      if (c === '/' && (d === '/' || d === '*')) {
        let j = d === '/' ? src.indexOf('\n', i) : src.indexOf('*/', i + 2);
        j = j < 0 ? n : d === '/' ? j : j + 2;
        blank(i, j);
        i = j;
      } else if (c === '"' || c === "'") { quoted(c); last = 'v'; }
      else if (c === '`') { template(); last = 'v'; }
      else if (c === '/') {
        const j = regexStarts() ? regexEnd() : -1;
        if (j > 0) { i = j; last = 'v'; } else { i++; last = '/'; }
      } else if (/[\w$]/.test(c)) {
        let j = i + 1;
        while (j < n && /[\w$]/.test(src[j])) j++;
        last = src.slice(i, j);
        i = j;
      } else if ((c === '+' || c === '-') && d === c) { last = c + c; i += 2; }
      else if (/\s/.test(c)) i++;
      else {
        if (inTemplate && c === '{') depth++;
        if (inTemplate && c === '}' && depth-- === 0) { i++; return; }
        last = c;
        i++;
      }
    }
  }
  run(false);
  return code.join('');
}

// ---- the rules for one module ----

const WORD = '[A-Za-z_$][\\w$]*';
// Not part of a longer word, and not a property (x.name, x?.name). Three dots are a spread, not a property.
const FREE = '(?<![\\w$])(?<!(?<!\\.)\\.\\s*)';
const ASSIGN = '(?:[-+*/%&|^]|\\*\\*|<<|>>>?|&&|\\|\\||\\?\\?)?=(?![=>])';
const DECLARE = new RegExp(`const\\s+${WORD}\\s*=\\s*\\{\\s*\\}(?:\\s*,\\s*${WORD}\\s*=\\s*\\{\\s*\\})*\\s*;`, 'y');
const OPEN = /\(\s*function\s*\(\s*\)\s*\{/y;
const NO_BROWSER = ['window', 'document', 'navigator', 'performance', 'Date', 'setTimeout', 'setInterval', 'setImmediate',
  'requestAnimationFrame', 'localStorage', 'sessionStorage', 'indexedDB', 'globalThis'];

// Calls fn(name, index) for each use of one of the names as a free identifier: not a property, not an object key.
function eachUse(code, names, from, to, fn) {
  if (!names.length) return;
  const re = new RegExp(`${FREE}(?:${names.join('|')})(?![\\w$])`, 'g');
  re.lastIndex = from;
  for (let m; (m = re.exec(code)) && m.index < to;) {
    const end = m.index + m[0].length;
    const before = code.slice(Math.max(0, m.index - 400), m.index).trimEnd().slice(-1);
    if ((before === '{' || before === ',') && /^\s*:/.test(code.slice(end, end + 400))) continue;
    fn(m[0], m.index);
  }
}

// Checks that the file is one enclosed function and returns where its body is, or null if there is no telling.
function shape(m, say) {
  const { code, src } = m, declarer = modules.DECLARERS.includes(m.file);
  const skip = (at) => at + code.slice(at).search(/\S|$/);
  if (!/^\s*\/[/*]/.test(src)) say(0, 'starts without a comment: the first lines of a file say what it offers');
  let at = skip(0);
  if (at >= code.length) { say(0, 'holds no code'); return null; }
  if (declarer) {
    for (;;) {
      DECLARE.lastIndex = at;
      const d = DECLARE.exec(code);
      if (!d) break;
      at = skip(at + d[0].length);
    }
  }
  OPEN.lastIndex = at;
  const open = OPEN.exec(code);
  if (!open) {
    say(at, declarer
      ? 'only "const Name = {}, Other = {};" may stand before the enclosed function'
      : 'code outside the enclosed function: a file is (function () { \'use strict\'; ... })(); and nothing else');
    return null;
  }
  let depth = 0, close = -1;
  for (let k = at; k < code.length && close < 0; k++) {
    const c = code[k];
    if (c === '(' || c === '[' || c === '{') depth++;
    else if ((c === ')' || c === ']' || c === '}') && --depth === 0) close = k;
  }
  if (close < 0) { say(at, 'the brackets of the enclosed function do not balance'); return null; }
  const rest = /^\s*\(\s*\)\s*;/.exec(code.slice(close + 1));
  if (!rest) say(close, 'the enclosed function must end with })();');
  else if (skip(close + 1 + rest[0].length) < code.length) {
    say(skip(close + 1 + rest[0].length), 'code after the enclosed function: a file is one function and nothing else');
  }
  const from = open.index + open[0].length, strict = skip(from);
  if (!/^(['"])use strict\1\s*;/.test(src.slice(strict))) say(strict, "the enclosed function must begin with 'use strict';");
  return { from, to: close };
}

// The namespaces a file may add to, from the "Owns: A, B" line of its header comment.
function owned(m, names, say) {
  const header = m.src.slice(0, m.code.search(/\S|$/));
  const line = /^[ \t]*(?:\/\/+|\/?\*+)?[ \t]*Owns:(.*)$/m.exec(header);
  const owns = new Set();
  if (!line || /^\s*\(?none\b/i.test(line[1])) return owns;
  const list = new RegExp(`^\\s*(${WORD}(?:\\s*,\\s*${WORD})*)`).exec(line[1]);   // words after the list are a remark
  for (const name of list ? list[1].split(/\s*,\s*/) : []) {
    if (names.includes(name)) owns.add(name);
    else say(line.index + line[0].indexOf('Owns:'), `the header says it owns ${name}, which is not a declared namespace`);
  }
  return owns;
}

function simRules(m, from, to, presentation, say) {
  const { code } = m;
  eachUse(code, NO_BROWSER, 0, code.length, (name, at) => say(at,
    `uses ${name}: files below 50 run without a browser, a clock, timers or storage`));
  for (const x of code.matchAll(/(?<![\w$])Math\s*\.\s*random(?![\w$])|(?<![\w$.])Math(?![\w$])(?!\s*\.)/g)) {
    say(x.index, x[0] === 'Math'
      ? 'passes Math around: name the function you need (Math.floor), so Math.random cannot slip through'
      : 'uses Math.random: randomness comes from the seeded streams of the run (S.rng)');
  }
  if (m.layer === 'sim') {
    eachUse(code, presentation, from, to, (name, at) => say(at,
      `uses ${name}, a presentation namespace: the simulation may use simulation namespaces only`));
  }
}

function contentRules(m, from, to, names, say) {
  const { code } = m;
  const scan = (re, msg) => {
    re.lastIndex = from;
    for (let x; (x = re.exec(code)) && x.index < to;) say(x.index, msg);
  };
  const plain = 'content is plain data, and behaviour is named by id';
  // as words of the language only: a field may well be called class or new ({ id: 'x', class: 'y' })
  const words = {
    function: `a function: ${plain}`, class: `a class: ${plain}`, new: `an object made with new: ${plain}`,
    undefined: 'undefined: leave the field out, or use null',
  };
  eachUse(code, Object.keys(words), from, to, (word, at) => say(at, words[word]));
  scan(/=>/g, `an arrow function: ${plain}`);
  scan(/(?<![\w$.])(?:get|set)\s+[\w$]+\s*\(/g, `a getter or setter: ${plain}`);
  scan(/(?<![\w$.])(?!(?:if|for|while|switch|catch|with|function)\b)[A-Za-z_$][\w$]*\s*\([^()]*\)\s*\{/g, `a method: ${plain}`);
  eachUse(code, names, from, to, (name, at) => {
    if (name === 'Defs' && /^\s*\.\s*add\s*\(/.test(code.slice(at + 4, at + 80))) return;
    say(at, name === 'Defs' ? 'content may call Defs.add and nothing else of Defs' : `uses ${name}: content may call Defs.add only`);
  });
}

// defined: 'Name.prop' -> where the first file that assigns it does so, shared by all modules of one check.
function ownershipRules(m, from, to, names, owns, defined, say) {
  if (!names.length) return;
  const { code } = m, N = names.join('|');
  const each = (source, fn) => {
    const re = new RegExp(source, 'g');
    re.lastIndex = from;
    for (let x; (x = re.exec(code)) && x.index < to;) fn(x);
  };
  const notOwner = (name) => `, but its header does not say "Owns: ${name}" (a file adds only to its own namespaces)`;

  each(`${FREE}(${N})\\s*(?:\\.\\s*([\\w$]+)|\\[[^\\]]*\\])\\s*(${ASSIGN}|\\+\\+|--)`, (x) => {
    const what = x[2] ? `${x[1]}.${x[2]}` : `a property of ${x[1]}`;
    if (!owns.has(x[1])) return say(x.index, `assigns ${what}${notOwner(x[1])}`);
    if (!x[2] || x[3] !== '=') return;
    const first = defined.get(what);
    if (!first) defined.set(what, { m, index: x.index });
    else if (first.m !== m) {
      const where = `${first.m.file}:${lineOf(first.m.src, first.index)}`;
      say(x.index, `assigns ${what}, which ${where} already defines: no file reassigns what another file defined`);
    }
  });
  each(`(?<![\\w$.])(?:delete\\s+|\\+\\+\\s*|--\\s*)(${N})\\s*(?:\\.\\s*[\\w$]+|\\[[^\\]]*\\])(?!\\s*[.\\[(])`, (x) => {
    if (!owns.has(x[1])) say(x.index, `changes a property of ${x[1]}${notOwner(x[1])}`);
  });
  each(`(?<![\\w$])Object\\s*\\.\\s*(?:assign|defineProperty|defineProperties|setPrototypeOf)\\s*\\(\\s*(${N})\\s*[,)]`, (x) => {
    if (!owns.has(x[1])) say(x.index, `adds to ${x[1]}${notOwner(x[1])}`);
  });
  each(`(?<![\\w$.])(const|let|var|function|class)\\s+(${N})(?![\\w$])`, (x) => {
    say(x.index, `declares a local ${x[2]}, which hides the namespace ${x[2]}`);
  });
  each(`${FREE}(${N})\\s*${ASSIGN}`, (x) => {
    if (/(?:const|let|var)\s*$/.test(code.slice(Math.max(0, x.index - 12), x.index))) return;   // reported above
    say(x.index, `assigns to the namespace ${x[1]} itself`);
  });
}

// ---- the denylist ----

// One entry a line; blank lines and lines that start with # are skipped.
const denyEntries = (listText) => listText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));

// An entry matches as a whole: no letter or digit right before or after it. Between its words anything of
// space, dash, dot and underscore may stand, or nothing, so "Two Words" also finds two-words and twoWords.
function denyRules(entries) {
  const quote = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return entries.map((entry) => ({ entry, words: entry.split(/[\s_-]+/).filter(Boolean) })).filter((e) => e.words.length).map((e) => ({
    entry: e.entry,
    start: (/^[a-z0-9]+/.exec(e.words[0].toLowerCase()) || [''])[0],   // how a word that matches must begin
    re: new RegExp(`(?<![A-Za-z0-9])${e.words.map(quote).join('[\\s._-]*')}(?![A-Za-z0-9])`, 'gi'),
  }));
}

function denyScan(files, entries, found) {
  // Most entries occur nowhere. One list of every distinct word of the source rules them out in one pass each,
  // so a long denylist stays cheap; only the few that might match are searched for file by file.
  const words = '\n' + Array.from(new Set(files.flatMap((f) => f.text.toLowerCase().match(/[a-z0-9]+/g) || []))).join('\n');
  const rules = denyRules(entries).filter((r) => words.includes('\n' + r.start));
  for (const f of rules.length ? files : []) {
    for (const r of rules) {
      for (const x of f.text.matchAll(r.re)) {
        const msg = `"${x[0]}" is on the denylist (${r.entry}): names from other games stay out`;
        found.push({ file: f.file, line: lineOf(f.text, x.index), msg });
      }
    }
  }
}

// ---- everything together ----

function check({ js = [], pages = [], deny = [] }) {
  const found = [];
  const mods = js.map((m) => ({ file: m.file, src: m.text, code: strip(m.text), layer: modules.layerOf(m.file) }));
  const declaredBy = (file) => { const m = mods.find((x) => x.file === file); return m ? modules.declaredIn(m.src) : []; };
  const presentation = declaredBy(modules.DECLARERS[1]), names = [...declaredBy(modules.DECLARERS[0]), ...presentation];
  const defined = new Map();

  for (const m of mods) {
    const say = (index, msg) => found.push({ file: 'src/js/' + m.file, line: lineOf(m.src, index), msg });
    const body = shape(m, say);
    const from = body ? body.from : 0, to = body ? body.to : m.code.length;
    const owns = owned(m, names, say);
    if (m.layer !== 'presentation') simRules(m, from, to, presentation, say);
    if (m.layer === 'content') contentRules(m, from, to, names, say);
    ownershipRules(m, from, to, names, owns, defined, say);
    for (const x of m.code.matchAll(new RegExp(`${FREE}eval\\s*\\(|(?<![\\w$])new\\s+Function(?![\\w$])`, 'g'))) {
      say(x.index, 'builds code from text: the published page forbids eval and new Function');
    }
    if (m.file === '99-boot.js') {
      for (const name of names) {
        if (!new RegExp(`typeof\\s+${name.replace(/\$/g, '\\$')}(?![\\w$])`).test(m.code)) {
          say(0, `does not collect the namespace ${name}: add a typeof line for it, or tests cannot reach it`);
        }
      }
    }
  }

  for (const p of pages) pageRules(p, found);
  if (deny.length) denyScan([...mods.map((m) => ({ file: 'src/js/' + m.file, text: m.src })), ...pages], deny, found);
  return found;
}

// What an html or css file of src/page may not do. A data: address and a #reference stay inside the page.
const OUTSIDE = new RegExp([
  '<link\\b',
  '<script\\b[^>]*\\bsrc\\s*=',
  '<(?:img|iframe|audio|video|source|embed|object)\\b[^>]*\\s(?:src|data)\\s*=(?!\\s*["\']?data:)',
  '@import\\b',
  'url\\((?!\\s*["\']?(?:data:|#))',
].join('|'), 'gi');

function pageRules(p, found) {
  const text = p.text.replace(/<!--[\s\S]*?-->|\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));   // comments blanked
  const say = (x, msg) => found.push({ file: p.file, line: lineOf(text, x.index), msg });
  for (const x of text.matchAll(OUTSIDE)) {
    say(x, `"${x[0].trim()}" loads another file: the page is one file and asks the network for nothing`);
  }
  for (const x of text.matchAll(/\b100(?:vh|svh|lvh|dvh)\b/g)) {
    say(x, `"${x[0]}": fill the screen with height: 100%, which is right on phones and inside the published page's frame`);
  }
}

function filesUnder(dir, rel) {
  return fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1)).flatMap((e) =>
    e.isDirectory() ? filesUnder(path.join(dir, e.name), `${rel}/${e.name}`)
      : [{ file: `${rel}/${e.name}`, text: fs.readFileSync(path.join(dir, e.name), 'utf8') }]);
}

function main() {
  const js = modules.all().map((file) => ({ file, text: modules.read(file) }));
  const pages = filesUnder(path.join(ROOT, 'src', 'page'), 'src/page');
  const list = path.join(ROOT, 'docs', 'design', 'denylist.txt');
  const deny = fs.existsSync(list) ? denyEntries(fs.readFileSync(list, 'utf8')) : null;
  const found = check({ js, pages, deny: deny || [] });
  for (const f of fs.readdirSync(modules.DIR).sort()) {
    if (modules.NAME.test(f) || f.startsWith('.')) continue;
    found.push({ file: 'src/js/' + f, line: 1, msg: 'is not named NN-name.js, so the build leaves it out' });
  }
  found.push(...build.guard(build.parts()));
  found.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line));
  for (const f of found) console.log(`${f.file}:${f.line}: ${f.msg}`);
  const words = deny ? `${deny.length} denylist entries` : 'no denylist yet';
  if (found.length) {
    console.log(`\nlint: ${found.length} problem${found.length === 1 ? '' : 's'} in ${new Set(found.map((f) => f.file)).size} file(s)`);
    process.exit(1);
  }
  console.log(`lint: ${js.length} modules and ${pages.length} page files are clean (${words})`);
}

if (require.main === module) {
  try { main(); } catch (e) { console.error('lint: ' + e.message); process.exit(1); }
}

module.exports = { check, strip, denyEntries };
