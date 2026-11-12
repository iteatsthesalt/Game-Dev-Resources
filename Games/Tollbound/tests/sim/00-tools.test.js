// tests/sim/00-tools.test.js: the tools the rest stands on: module order, the Node loader, the build and the lint.
// The lint is checked rule by rule against small made-up files: each rule must speak up for the fault it
// names and stay quiet for honest code that only looks like it.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const modules = require('../../tools/modules.js');
const build = require('../../tools/build.js');
const lint = require('../../tools/lint.js');
const { loadSim } = require('./loader.js');

// ---- module order ----

test('modules come in the order of their number, then of their name', () => {
  const all = modules.all();
  assert.ok(all.includes('00-core.js') && all.includes('99-boot.js'));
  assert.equal(all[0], '00-core.js', 'the core runs first');
  assert.equal(all[all.length - 1], '99-boot.js', 'boot runs last');
  for (let i = 1; i < all.length; i++) {
    const a = all[i - 1], b = all[i];
    assert.ok(modules.number(a) < modules.number(b) || (modules.number(a) === modules.number(b) && a < b), `${a} before ${b}`);
  }
  assert.deepEqual([...modules.sim(), ...modules.presentation()], all);
  assert.ok(modules.sim().every((f) => modules.number(f) < 50) && modules.presentation().every((f) => modules.number(f) >= 50));
});

test('a module name is two digits, a dash and lower-case words', () => {
  for (const good of ['00-core.js', '02-pool-grid.js', '55-sound-crypt.js', '99-boot.js']) assert.ok(modules.NAME.test(good), good);
  for (const bad of ['core.js', '0-core.js', '100-core.js', '10-Stats.js', '10_stats.js', '10-stats.mjs', '10-stats.js.bak', '10--x.js']) {
    assert.ok(!modules.NAME.test(bad), bad);
  }
  assert.deepEqual(['00-core.js', '29-world.js', '30-modes.js', '49-props.js', '50-platform.js', '99-boot.js'].map(modules.layerOf),
    ['sim', 'sim', 'content', 'content', 'presentation', 'presentation']);
  assert.throws(() => modules.layerOf('notes.txt'), /not a module name/);
});

test('declared names are read from before the enclosed function only', () => {
  const text = "// core. Example: const Fake = {};\n/* (function () { */\nconst A = {}, B = {},\n  C = {};\n  (function () {\n  'use strict';\n  const cache = {};\n})();\n";
  assert.deepEqual(modules.declaredIn(text), ['A', 'B', 'C']);
  assert.deepEqual(modules.declaredIn("// plain module\n(function () {\n  const cache = {};\n})();\n"), []);
  assert.deepEqual(modules.namespaces('40-no-such-file.js'), []);
});

test('the declared namespaces are the ones docs/engine.md lists', (t) => {
  const file = path.join(__dirname, '..', '..', 'docs', 'engine.md');
  const doc = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const listed = (label) => { const m = new RegExp(label + ': `([A-Za-z ]+)`').exec(doc); return m ? m[1].split(' ') : null; };
  const sim = listed('Simulation'), presentation = listed('Presentation');
  if (!sim || !presentation) return t.skip('docs/engine.md does not list the namespaces on one line each');
  assert.deepEqual(modules.namespaces('00-core.js'), sim);
  if (modules.all().includes('50-platform.js')) assert.deepEqual(modules.namespaces('50-platform.js'), presentation);
  const boot = modules.read('99-boot.js');
  for (const name of [...sim, ...presentation]) assert.ok(boot.includes(`typeof ${name} `), `99-boot.js collects ${name}`);
});

// ---- the Node loader ----

test('the simulation loads with console as its only link to the outside', () => {
  const sim = loadSim();
  assert.deepEqual(Object.keys(sim), modules.namespaces('00-core.js'));
  const inside = (expression) => sim.Core.assert.constructor('return ' + expression)();   // runs in the simulation's own context
  for (const name of ['window', 'document', 'navigator', 'performance', 'setTimeout', 'setInterval', 'requestAnimationFrame',
    'localStorage', 'process', 'require', 'module', 'Buffer', 'fetch']) {
    assert.equal(inside(`typeof ${name}`), 'undefined', name);
  }
  assert.equal(inside('typeof console.log'), 'function');
  assert.throws(() => inside('Math.random()'), /Math\.random is not for the simulation/);
  assert.throws(() => inside('Date.now()'), /Date\.now is not for the simulation/);
  assert.throws(() => inside('new Date()'), /Date is not for the simulation/);
  assert.equal(Math.random() < 1, true, 'the tests keep their own Math.random');
});

test('the loader can load a few modules alone, under the same guard', () => {
  const some = loadSim({ only: ['02-pool-grid.js', '00-core.js'] });   // named in any order, run in module order
  assert.deepEqual(Object.keys(some), modules.namespaces('00-core.js'), 'every namespace is there');
  assert.equal(typeof some.Core.Pool, 'function');
  assert.deepEqual(Object.keys(some.Defs), [], 'and those of the files left out are empty');
  assert.throws(() => some.Core.assert.constructor('return Math.random()')(), /Math\.random is not for the simulation/);
  assert.throws(() => loadSim({ only: ['00-core.js', '50-platform.js'] }), /"50-platform\.js" is not a module below 50/);
  assert.throws(() => loadSim({ only: ['00-nothing.js'] }), /is not a module below 50/);
  const booted = loadSim({ only: ['00-core.js', '01-defs.js'], boot: true });
  assert.ok(Object.isFrozen(booted.Core) && Object.isFrozen(booted.Sim), 'boot seals what was loaded and what was not');
});

// ---- the build ----

test('the build gives the same bytes every time', () => {
  assert.equal(build.standalone(), build.standalone());
  assert.equal(build.artifact(), build.artifact());
});

test('the standalone page is one document with one style and one script', () => {
  const page = build.standalone(), p = build.parts();
  assert.ok(page.startsWith('<!doctype html>\n'));
  assert.ok(page.endsWith('</body>\n</html>\n'));
  assert.ok(page.includes('<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'));
  assert.ok(page.includes('<title>Tollbound</title>'));
  assert.equal(page.split('<style>').length, 2);
  assert.equal(page.split('<script>').length, 2);
  let at = 0;
  for (const part of [p.head, ...p.css, p.body, ...p.js, p.tail]) {
    const found = page.indexOf(part.text, at);
    assert.ok(found >= at, `${part.file} is in the page, after the part before it`);
    at = found + part.text.length;
  }
  assert.ok(!/\d{4}-\d\d-\d\d|\d\d:\d\d:\d\d/.test(p.head.text + p.tail.text), 'no date or time in the wrapper');
});

test('the artifact is a fragment: a title, one meta, then the same style, body and script', () => {
  const page = build.standalone(), fragment = build.artifact(), p = build.parts();
  assert.ok(fragment.startsWith('<title>Tollbound</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<style>\n'));
  assert.ok(fragment.endsWith('</script>\n'));
  assert.ok(!/<!doctype|<\/?(?:html|head|body)\b/i.test(fragment), 'no doctype, html, head or body tag');
  const shared = fragment.slice(fragment.indexOf('<style>'));
  assert.equal(page, p.head.text + shared + p.tail.text, 'both targets share everything between the wrappers');
});

test('the build refuses text that would break the page', () => {
  const part = (text) => ({ file: 'x', text });
  const guard = (js, css = '', body = '<div></div>') => build.guard({ css: [part(css)], body: part(body), js: [part(js)] }).map((f) => `${f.line}: ${f.msg}`);
  assert.deepEqual(guard("const ok = 'a < b'; // plain code\n"), []);
  assert.match(guard("const a = 1;\nconst s = '</script>';\n")[0], /^2: .*end the page's script/);
  assert.match(guard('// see </SCRIPT> above\n')[0], /end the page's script/);
  assert.match(guard("el.innerHTML = '<!-- note -->';\n")[0], /changes how a browser reads/);
  assert.match(guard('', 'a::after { content: "</style>"; }\n')[0], /end the page's style/);
  assert.match(guard("// goes into the <body> of the host\n")[0], /document tag/);
  assert.match(guard('', '', '<html><div></div>\n')[0], /document tag/);
  assert.match(guard("const t = '<!DOCTYPE html>';\n")[0], /document tag/);
  assert.deepEqual(guard("const t = '<header><thead><tbody>';\n"), [], 'only whole document tags count');
});

// ---- the lint ----

const CORE = "// 00-core.js: test core.\n// Owns: Core\nconst Core = {}, Defs = {}, Stats = {}, Sim = {};\n(function () {\n  'use strict';\n  Core.clamp = function (v) { return v; };\n})();\n";
const PLATFORM = "// 50-platform.js: test platform.\n// Owns: Plat\nconst Plat = {}, Game = {}, UI = {};\n(function () {\n  'use strict';\n  Plat.now = function () { return performance.now(); };\n})();\n";
const wrap = (owns, body) => `// a test module.\n// Owns: ${owns}\n(function () {\n  'use strict';\n${body}\n})();\n`;   // body starts on line 5

// The problems the lint finds in one file, as "line: message", with the two declaring files clean beside it.
function problems(file, text, others = []) {
  const js = [{ file: '00-core.js', text: CORE }, { file: '50-platform.js', text: PLATFORM }, ...others, { file, text }];
  return lint.check({ js }).filter((p) => p.file === 'src/js/' + file).map((p) => `${p.line}: ${p.msg}`);
}
const flagged = (found, pattern, line) => {
  const hit = found.find((p) => pattern.test(p) && (line === undefined || p.startsWith(line + ':')));
  assert.ok(hit, `expected ${pattern}${line === undefined ? '' : ' on line ' + line}, got ${JSON.stringify(found)}`);
};
const clean = (found) => assert.deepEqual(found, []);

test('lint: honest files pass', () => {
  clean(lint.check({ js: [{ file: '00-core.js', text: CORE }, { file: '50-platform.js', text: PLATFORM }] }));
  clean(problems('10-stats.js', wrap('Stats', '  const table = [1, 2, 3];\n  Stats.sheet = function (mods) { return Core.clamp(mods.length + table.length); };')));
  clean(problems('30-modes.js', wrap('(none)', "  Defs.add('mode', { id: 'watch', name: 'The Watch', levels: [1, 2, 3], next: null });")));
  clean(problems('70-ui-core.js', wrap('UI', '  UI.open = function (id) { document.title = id; window.setTimeout(function () {}, 5); return Game; };')));
});

test('lint: a file is one enclosed function', () => {
  const body = "(function () {\n  'use strict';\n  Stats.a = 1;\n})();\n";
  clean(problems('10-stats.js', '// stats.\n// Owns: Stats\n' + body));
  clean(problems('10-stats.js', '/* stats.\n * Owns: Stats\n */\n' + body));
  flagged(problems('10-stats.js', body), /starts without a comment/, 1);
  flagged(problems('10-stats.js', '// Owns: Stats\nconst helper = 1;\n' + body), /code outside the enclosed function/, 2);
  flagged(problems('10-stats.js', '// Owns: Stats\nfunction helper() {}\n' + body), /code outside the enclosed function/, 2);
  flagged(problems('10-stats.js', '// Owns: Stats\n' + body + "(function () {\n  'use strict';\n})();\n"), /code after the enclosed function/, 6);
  flagged(problems('10-stats.js', '// Owns: Stats\n' + body + 'Stats.b = 2;\n'), /code after the enclosed function/, 6);
  flagged(problems('10-stats.js', '// Owns: Stats\n(function () {\n  Stats.a = 1;\n})();\n'), /must begin with 'use strict'/, 3);
  flagged(problems('10-stats.js', "// Owns: Stats\n(function () {\n  'use strict';\n  Stats.a = 1;\n}());\n"), /must end with \}\)\(\);/);
  flagged(problems('10-stats.js', "// Owns: Stats\n(function () {\n  'use strict';\n  Stats.a = 1;\n})()\n"), /must end with \}\)\(\);/);
  flagged(problems('10-stats.js', "// Owns: Stats\n(function () {\n  'use strict';\n  Stats.a = [1, 2;\n})();\n"), /brackets .* do not balance|must end with/);
  flagged(problems('10-stats.js', "// Owns: Stats\n(() => {\n  'use strict';\n  Stats.a = 1;\n})();\n"), /code outside the enclosed function/, 2);
  flagged(problems('10-stats.js', '// nothing here\n'), /holds no code/);
});

test('lint: only 00-core.js and 50-platform.js declare names, and only namespaces', () => {
  const declarer = (top) => `// core.\n// Owns: Core\n${top}\n(function () {\n  'use strict';\n})();\n`;
  const check = (text) => lint.check({ js: [{ file: '00-core.js', text }] }).map((p) => `${p.line}: ${p.msg}`);
  clean(check(declarer('const Core = {};')));
  clean(check(declarer('const Core = {}, Defs = {},\n  Sim = {};\nconst World = {};')));
  flagged(check(declarer('const Core = {};\nlet count = 0;')), /only "const Name = \{\}/, 4);
  flagged(check(declarer('const Core = {}, LIMIT = 600;')), /only "const Name = \{\}/, 3);
  flagged(check(declarer('const Core = { a: 1 };')), /only "const Name = \{\}/, 3);
  flagged(problems('10-stats.js', "// Owns: Stats\nconst Extra = {};\n(function () {\n  'use strict';\n})();\n"), /code outside the enclosed function/, 2);
});

test('lint: the scanner is not fooled by strings, comments, templates and regular expressions', () => {
  clean(problems('10-stats.js', wrap('Stats', [
    "  const a = 'window ) } ]', b = \"document ( { [ \\\" Date\", c = `Math.random() ) } ${a.length + (b ? 1 : 2)} localStorage`;",
    '  // window.setTimeout(function () {}) and an unclosed ( in a comment',
    '  /* Date.now() and }) */',
    "  const re = /[\"'`(\\]/]+\\/ window/g, half = a.length / 2 / 3, split = c.split(/\\)/);",
    '  Stats.table = { window: 3, document: [1, 2], Date: null };',
    '  Stats.read = function (S) { return S.window + S.navigator.performance + S.rows.Date + half + (re.test(b) ? split.length : 0); };',
    '  let n = 0; n++ / 2; Stats.n = n-- / 2;',
    '  Stats.updated = 1; Stats.myDate = 2; Stats.windowed = 3;',
  ].join('\n'))));
  // code inside a template's ${...} is still code
  flagged(problems('10-stats.js', wrap('Stats', '  Stats.label = function () { return `now ${Date.now()}`; };')), /uses Date/, 5);
  flagged(problems('10-stats.js', wrap('Stats', "  const s = 'it''s';\n  Stats.t = performance.now();")), /uses performance/, 6);
  assert.equal(lint.strip("a = 'x' + /y'/.source; // z\nb = `t${c}u`; /* w */"), "a = ' ' + /  /.source;     \nb = ` ${c} `;        ");
});

test('lint: files below 50 use no browser, clock, timer, storage or unseeded randomness', () => {
  const uses = {
    window: 'window.innerWidth', document: 'document.title', navigator: 'navigator.userAgent', performance: 'performance.now()',
    Date: 'new Date()', 'Math.random': 'Math.random()', setTimeout: 'setTimeout(tick, 5)', setInterval: 'setInterval(tick, 5)',
    requestAnimationFrame: 'requestAnimationFrame(tick)', localStorage: "localStorage.getItem('k')",
  };
  for (const [name, use] of Object.entries(uses)) {
    const text = wrap('Stats', `  const tick = 1;\n  Stats.f = function () {\n    return ${use};\n  };`);
    flagged(problems('10-stats.js', text), new RegExp('uses ' + name.replace('.', '\\.')), 7);
    flagged(problems('35-sigils.js', text), new RegExp('uses ' + name.replace('.', '\\.')), 7);
    clean(problems('60-mesh.js', text.replace(/Stats/g, 'UI')));
  }
  flagged(problems('10-stats.js', wrap('Stats', '  Stats.f = function () { return Date.now(); };')), /uses Date/);
  flagged(problems('10-stats.js', wrap('Stats', '  Stats.f = function () { return [...window.frames]; };')), /uses window/);
  flagged(problems('10-stats.js', wrap('Stats', '  Stats.f = function () { return { window }; };')), /uses window/);
  flagged(problems('10-stats.js', wrap('Stats', '  Stats.f = function (a) { return a ? window : null; };')), /uses window/);
  flagged(problems('10-stats.js', wrap('Stats', '  const M = Math;\n  Stats.f = function () { return M.random(); };')), /passes Math around/, 5);
  flagged(problems('10-stats.js', wrap('Stats', "  Stats.f = function () { return Math['random'](); };")), /passes Math around/);
  flagged(problems('10-stats.js', wrap('Stats', '  Stats.f = function () { return globalThis.anything; };')), /uses globalThis/);
  clean(problems('10-stats.js', wrap('Stats', '  const floor = Math.floor;\n  Stats.f = function (v) { return floor(Math.sqrt(v)) + Math.PI + Math\n    .max(v, 1); };')));
});

test('lint: the simulation does not use presentation namespaces', () => {
  flagged(problems('20-sim.js', wrap('Sim', '  Sim.step = function (S) {\n    UI.open(S);\n  };')), /uses UI, a presentation namespace/, 6);
  flagged(problems('20-sim.js', wrap('Sim', '  Sim.step = function (S) { return Game; };')), /uses Game, a presentation namespace/);
  clean(problems('20-sim.js', wrap('Sim', '  Sim.step = function (S) { return S.Game + S.UI.x + Stats.n + Core.clamp(1); };')));
  clean(problems('90-game.js', wrap('Game', '  Game.start = function (cfg) { return Sim.step(cfg) + UI.x; };')));
});

test('lint: content is plain data', () => {
  const content = (body) => problems('35-sigils.js', wrap('(none)', body));
  clean(content("  const fire = ['fire', 'spell'];\n  for (const tier of [1, 2, 3]) Defs.add('sigil', { id: 'ember.' + tier, tags: fire, text: 'A function of heat => light.', angle: Math.PI / 3 });"));
  // words of the language are fine as field names
  clean(content("  const base = { class: 'warden', new: true };\n  Defs.add('calling', {\n    id: 'a',\n    class: base.class,\n    new: base.new, function: 1, undefined: 2, get: 3, set: 4,\n  });"));
  flagged(content("  Defs.add('sigil', { id: 'a', cast: function (S) { return 1; } });"), /a function: content is plain data/, 5);
  flagged(content("  Defs.add('sigil', { id: 'a', cast: (S) => 1 });"), /an arrow function/, 5);
  flagged(content("  Defs.add('sigil', {\n    id: 'a',\n    cast(S) { return 1; },\n  });"), /a method/, 7);
  flagged(content("  Defs.add('sigil', { id: 'a', get power() { return 1; } });"), /a getter or setter/, 5);
  flagged(content("  class Sigil {}\n  Defs.add('sigil', { id: 'a' });"), /a class/, 5);
  flagged(content("  Defs.add('sigil', { id: 'a', tags: new Set() });"), /an object made with new/, 5);
  flagged(content("  Defs.add('sigil', { id: 'a', icon: undefined });"), /undefined: leave the field out/, 5);
  flagged(content("  Defs.add('sigil', { id: 'a', rate: Stats.base });"), /uses Stats: content may call Defs\.add only/, 5);
  flagged(content("  Defs.add('sigil', { id: 'a', like: Defs.get('sigil', 'b') });"), /content may call Defs\.add and nothing else/, 5);
  flagged(content("  Defs.add('sigil', { id: 'a', seed: Date.now() });"), /uses Date/, 5);
});

test('lint: a file adds only to the namespaces its header says it owns', () => {
  clean(problems('21-player.js', '// player.\n// Owns: Sim, Stats (both shared with other files)\n(function () {\n  \'use strict\';\n  Sim.a = 1;\n  Stats.b = 2;\n})();\n'));
  clean(problems('21-player.js', "/* player.\n * Owns: Sim\n */\n(function () {\n  'use strict';\n  Sim.a = 1;\n})();\n"));
  flagged(problems('21-player.js', "// player, with no line that says what it owns.\n(function () {\n  'use strict';\n  Sim.a = 1;\n})();\n"), /assigns Sim\.a, but its header does not say "Owns: Sim"/, 4);
  flagged(problems('21-player.js', wrap('(none)', '  Sim.a = 1;')), /assigns Sim\.a/, 5);
  flagged(problems('21-player.js', wrap('Stats', '  Stats.ok = 1;\n  Sim.step = function () {};')), /assigns Sim\.step, but its header does not say "Owns: Sim"/, 6);
  flagged(problems('21-player.js', wrap('Stats', "  Sim['step'] = null;")), /assigns a property of Sim/, 5);
  flagged(problems('21-player.js', wrap('Stats', '  Sim.count += 1;')), /assigns Sim\.count/);
  flagged(problems('21-player.js', wrap('Stats', '  Sim.count++;')), /assigns Sim\.count/);
  flagged(problems('21-player.js', wrap('Stats', '  Sim.cache ||= {};')), /assigns Sim\.cache/);
  flagged(problems('21-player.js', wrap('Stats', '  delete Sim.step;')), /changes a property of Sim/);
  flagged(problems('21-player.js', wrap('Stats', '  Object.assign(Sim, { step: null });')), /adds to Sim/);
  flagged(problems('21-player.js', wrap('Stats', "  Object.defineProperty(Sim, 'step', { value: 1 });")), /adds to Sim/);
  flagged(problems('71-hud.js', wrap('UI', '  UI.ok = 1;\n  Game.S = null;')), /assigns Game\.S/, 6);
  flagged(problems('21-player.js', wrap('Player', '  Sim.a = 1;')), /owns Player, which is not a declared namespace/, 2);
  // reading, calling and comparing are not assigning; a step further in is out of the lint's sight
  clean(problems('21-player.js', wrap('Stats', [
    '  Stats.f = function (S) {',
    '    if (Sim.count === 1 || Sim.count == null || Sim.count >= 2 || Sim.count <= 3 || Sim.count != 4) return Sim.step(S);',
    '    const copy = { step: Sim.step, n: Sim.count + 1 };',
    '    Sim.state.x = 1;',
    '    return copy;',
    '  };',
  ].join('\n'))));
});

test('lint: no file reassigns what another file defined, replaces a namespace or hides one', () => {
  const first = { file: '10-stats.js', text: wrap('Stats', '  Stats.sheet = function () {};') };
  flagged(problems('11-damage.js', wrap('Stats', '  Stats.other = 1;\n  Stats.sheet = function () { return 2; };'), [first]),
    /assigns Stats\.sheet, which 10-stats\.js:5 already defines/, 6);
  flagged(problems('02-pool-grid.js', wrap('Core', '  Core.clamp = null;')), /assigns Core\.clamp, which 00-core\.js:6 already defines/, 5);
  clean(problems('11-damage.js', wrap('Stats', '  Stats.table = null;\n  Stats.table = [1];\n  Stats.tick = function () {};'), [first]));
  flagged(problems('11-damage.js', wrap('Stats', '  Stats = {};')), /assigns to the namespace Stats itself/, 5);
  flagged(problems('11-damage.js', wrap('Stats', '  const Sim = { local: true };\n  Stats.x = Sim.local;')), /declares a local Sim, which hides the namespace/, 5);
  flagged(problems('11-damage.js', wrap('Stats', '  function Core() {}\n  Stats.x = Core;')), /declares a local Core/, 5);
});

test('lint: no code is built from text, and boot collects every namespace', () => {
  flagged(problems('70-ui-core.js', wrap('UI', "  UI.run = function (text) { return eval(text); };")), /builds code from text/, 5);
  flagged(problems('10-stats.js', wrap('Stats', "  Stats.make = new Function('return 1');")), /builds code from text/, 5);
  clean(problems('70-ui-core.js', wrap('UI', '  UI.run = function (S) { return S.eval(1) + S.retrieval; };')));
  const boot = (names) => wrap('(none)', '  window.TB = {' + names.map((n) => ` ${n}: typeof ${n} !== 'undefined' ? ${n} : null,`).join('') + ' };');
  clean(problems('99-boot.js', boot(['Core', 'Defs', 'Stats', 'Sim', 'Plat', 'Game', 'UI'])));
  const missing = problems('99-boot.js', boot(['Core', 'Defs', 'Stats', 'Plat', 'Game']));
  flagged(missing, /does not collect the namespace Sim/);
  flagged(missing, /does not collect the namespace UI/);
  assert.equal(missing.length, 2);
});

test('lint: the page loads nothing from another file', () => {
  const pages = (file, text) => lint.check({ pages: [{ file, text }] }).map((p) => `${p.line}: ${p.msg}`);
  clean(pages('src/page/body.html', '<div id="app">\n  <canvas id="view"></canvas>\n  <img src="data:image/png;base64,AAAA">\n</div>\n'));
  clean(pages('src/page/body.html', "<img alt='' src = 'data:image/gif;base64,AAAA'><video data-kind=\"x\" src=data:video/mp4;base64,AAAA></video>\n"));
  clean(pages('src/page/css/00-base.css', 'a { background: url(data:image/png;base64,AAAA); filter: url(#glow); }\n/* @import "x.css"; url(y.png) */\n'));
  clean(pages('src/page/css/00-base.css', 'a { background: url("data:image/png;base64,AAAA"), url( \'data:image/png;base64,BBBB\' ); mask: url("#m"); }\n'));
  flagged(pages('src/page/body.html', '<div></div>\n<link rel="stylesheet" href="x.css">\n'), /loads another file/, 2);
  flagged(pages('src/page/body.html', '<script src="https://cdn.example/x.js"></script>\n'), /loads another file/, 1);
  flagged(pages('src/page/body.html', '<img alt="" src="shield.png">\n'), /loads another file/, 1);
  flagged(pages('src/page/css/10-hud.css', '@import url("https://fonts.googleapis.com/css2?family=X");\n'), /loads another file/, 1);
  flagged(pages('src/page/css/10-hud.css', '.a {}\n.b { background: url("panel.png"); }\n'), /loads another file/, 2);
  clean(pages('src/page/body.html', '<!-- <link rel="x" href="y"> -->\n<div></div>\n'));
  flagged(pages('src/page/css/10-hud.css', 'html { height: 100% }\n.app { height: 100vh; }\n'), /"100vh": fill the screen with height: 100%/, 2);
  flagged(pages('src/page/css/10-hud.css', '.app { min-height: 100dvh; }\n'), /"100dvh"/, 1);
  clean(pages('src/page/css/10-hud.css', '.list { max-height: 60vh; width: 1100vhx; } /* not 100vh */\n'));
});

test('lint: denylist entries are found as whole words in any letter case', () => {
  // the two entries are nonsense words made up for this test
  assert.deepEqual(lint.denyEntries('# names that stay out\n\nZorblat\n  Quib Marn  \n# end\n'), ['Zorblat', 'Quib Marn']);
  const deny = ['Zorblat', 'Quib Marn'];
  const find = (text) => lint.check({ js: [{ file: '35-sigils.js', text }], deny }).filter((p) => /denylist/.test(p.msg)).map((p) => `${p.line}: ${p.msg}`);
  const data = (line) => wrap('(none)', `  Defs.add('sigil', ${line});`);
  flagged(find(data("{ id: 'x', name: 'Zorblat' }")), /"Zorblat" is on the denylist/, 5);
  flagged(find(data("{ id: 'the-zorblat.one', name: 'X' }")), /"zorblat" is on the denylist/, 5);
  flagged(find(data("{ id: 'x', name: 'ZORBLAT!' }")), /"ZORBLAT" is on the denylist/);
  flagged(find('// about the Quib   Marn\n' + data("{ id: 'x' }")), /"Quib   Marn" is on the denylist \(Quib Marn\)/, 1);
  flagged(find(data("{ id: 'quib-marn' }")), /"quib-marn" is on the denylist/);
  flagged(find(data("{ id: 'quib_marn.quibMarn' }")), /"quib_marn" is on the denylist/);
  flagged(find(data("{ id: 'quib_marn.quibMarn' }")), /"quibMarn" is on the denylist/);
  assert.deepEqual(find(data("{ id: 'x', name: 'Zorblats', text: 'A squib marn; quib marns; bezorblat.' }")), [], 'part of a longer word does not count');
  const pages = lint.check({ pages: [{ file: 'src/page/body.html', text: '<div>\n  <p>Welcome to Zorblat</p>\n</div>\n' }], deny });
  assert.equal(pages.length, 1);
  assert.equal(`${pages[0].file}:${pages[0].line}`, 'src/page/body.html:2');
});
