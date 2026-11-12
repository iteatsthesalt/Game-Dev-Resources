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
//   plain(value)           a copy of a simulation value built from this side's own objects and arrays
//
// Three things to know:
//   - In that context Math.random and Date throw. The simulation takes its randomness from seeded streams and
//     its time from the step count; a file that reaches for either fails its tests here.
//   - Values that come out of the simulation belong to another context. assert.deepStrictEqual compares
//     prototypes, so it calls a simulation array different from a test array with the same content. Compare
//     plain(value), or use assert.deepEqual. For the same reason check a thrown error by its message,
//     assert.throws(fn, /text/), not with instanceof.
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

function loadSim(options = {}) {
  const context = freshContext();
  new vm.Script(GUARD, { filename: __filename }).runInContext(context);
  for (const file of modules.sim()) {
    new vm.Script(modules.read(file), { filename: path.join(modules.DIR, file) }).runInContext(context);
  }
  const names = modules.namespaces(modules.DECLARERS[0]);
  const sim = Object.assign({}, new vm.Script(`({ ${names.join(', ')} })`, { filename: __filename }).runInContext(context));
  if (options.boot) {
    const errors = sim.Defs && typeof sim.Defs.finalize === 'function' ? Array.from(sim.Defs.finalize() || []) : [];
    if (errors.length) throw new Error(`Defs.finalize found ${errors.length} problem(s):\n  ${errors.slice(0, 20).join('\n  ')}`);
    sim.Core.seal(Object.values(sim));
  }
  return sim;
}

const plain = (value) => JSON.parse(JSON.stringify(value));

module.exports = { loadSim, plain };
