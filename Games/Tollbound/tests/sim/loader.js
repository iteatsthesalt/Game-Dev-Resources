// tests/sim/loader.js: loads the simulation into Node without a browser, for the tests in this folder.
//   const { loadSim, plain } = require('./loader.js');
//   const { Core, Defs, Stats } = loadSim();
//
//   loadSim()              runs every module below 50 (the simulation and its content) in the order
//                          tools/modules.js gives, in a fresh context whose only global is console, and returns
//                          {Core, Defs, ...}: every namespace 00-core.js declares. Each call makes a separate
//                          copy of the simulation, so tests cannot disturb each other.
//   loadSim({boot: true})  then does what 99-boot.js does when the page starts: Defs.finalize(), where an
//                          error in the content throws, and Core.seal(), after which no namespace can change
//   loadSim({only: [file, ...]})   runs just the modules named ('00-core.js', '01-defs.js', ...), still in
//                          module order. The test of one file loads what that file stands on and nothing
//                          else: content and systems that arrive later can then neither disturb the test nor
//                          be disturbed by it, and its own definitions never meet the ids the game ships.
//                          The namespaces of the files left out are there, and empty. Goes with boot as well.
//   plain(value)           a JSON copy of a simulation value, built from this side's own objects and arrays
//
// Three things to know:
//   - In that context Math.random and Date throw. The simulation takes its randomness from seeded streams and
//     its time from the step count; a file that reaches for either fails its tests here.
//   - Objects and arrays that come out of the simulation belong to another context. assert.deepStrictEqual
//     (which is also the deepEqual of node:assert/strict) compares prototypes, so it calls a simulation array
//     different from a test array with the same content: compare plain(value) instead. For the same reason
//     "value instanceof Array" is false (Array.isArray works) and assert.throws(fn, Error) fails: check a
//     thrown error by its message, assert.throws(fn, /text/).
//   - Each module runs as its own script under its own file name, so a stack trace names src/js/NN-name.js
//     and the line. Top-level names are shared between the scripts of one context just as they are between
//     the files joined into the page.
'use strict';
const path = require('path'), vm = require('vm');
const modules = require('../../tools/modules.js');

const GUARD = `(function () {
  'use strict';
  const refuse = (what) => function () { throw new Error(what + ' is not for the simulation: files below 50 are deterministic'); };
  Math.random = refuse('Math.random');
  globalThis.Date = refuse('Date');
  Date.now = refuse('Date.now');
})();`;

// A context with an ordinary global object that holds console and nothing else of Node. Node's usual wrapped
// global makes every use of Math, Object or Array inside the context about a hundred times slower, which
// would make simulation tests crawl; the plain one (Node 22.8 and later) costs nothing.
function freshContext() {
  const plainGlobal = vm.constants && vm.constants.DONT_CONTEXTIFY;
  const context = plainGlobal ? vm.createContext(plainGlobal) : vm.createContext({});
  context.console = console;
  return context;
}

// Each module is compiled once for the whole test process; every loadSim() runs the compiled scripts afresh.
const scripts = new Map();
function compiled(file) {
  if (!scripts.has(file)) scripts.set(file, new vm.Script(modules.read(file), { filename: path.join(modules.DIR, file) }));
  return scripts.get(file);
}

function loadSim(options = {}) {
  const context = freshContext(), all = modules.sim(), only = options.only || null;
  for (const file of only || []) if (!all.includes(file)) throw new Error(`loadSim: "${file}" is not a module below 50 in src/js`);
  new vm.Script(GUARD, { filename: __filename }).runInContext(context);
  for (const file of all) if (only === null || only.includes(file)) compiled(file).runInContext(context);
  const names = modules.namespaces(modules.DECLARERS[0]);
  const sim = Object.assign({}, new vm.Script(`({ ${names.join(', ')} })`, { filename: __filename }).runInContext(context));
  if (options.boot) {
    const errors = sim.Defs && typeof sim.Defs.finalize === 'function' ? Array.from(sim.Defs.finalize() || []) : [];
    if (errors.length) throw new Error(`Defs.finalize found ${errors.length} problem(s):\n  ${errors.slice(0, 20).join('\n  ')}`);
    sim.Core.seal(Object.values(sim));
  }
  return sim;
}

const plain = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));

module.exports = { loadSim, plain };
