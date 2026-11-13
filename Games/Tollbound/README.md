# Tollbound

Tollbound is a horde-survival action game for the browser, seen from a tilted camera. Your voices speak by themselves: you steer with one thumb and press two buttons, your trade and the heave, while the dead of a drowned bell-city rise around you in their hundreds. A vigil has no fixed end; each toll of the dumb bell raises the danger and the reward, each character has one life, and you leave by ringing down at a lychgate or not at all.

## Playing

Open `Tollbound.html` in a browser. Nothing else is needed: no server, no install, no network.

The Household (your characters, the Register of the dead, the chest, the Bellframe) is saved in the browser as you play: at every toll of a vigil and whenever the page is hidden, so closing it loses nothing already earned. Where the page has no storage that lasts (some private windows, a host that allows none) it is kept until the page closes, and the title says so. "Save text" in the Household gives the whole save as text to keep or to carry to another browser, and reads such a text back in.

## Working on it

`Tollbound.html` is built from `src/`. Edit `src/`, then build and test. Never edit a built file by hand.

```
npm install                       # once: Playwright for the browser tests
npx playwright install chromium   # once, if Playwright has no Chromium yet

npm run lint            # the code rules below, checked by tools/lint.js
npm run build:dev       # src/ -> .build/Tollbound.html and .build/Tollbound.artifact.html (untracked; the tests use these)
npm run test:sim        # the simulation in Node, without a browser
npm run test:e2e        # browser scenarios against .build/Tollbound.html
npm run test:artifact   # the same scenarios against the fragment the Claude app publishes, hosted the way the app hosts it
npm test                # lint, build:dev, test:sim, test:e2e
npm run test:full       # npm test, then test:artifact, then the bench
npm run bench           # step time of the simulation with 600 enemies; fails above 1.5 ms a step on average

npm run build           # src/ -> Tollbound.html, the tracked page
npm run check           # fails if Tollbound.html is not what src/ builds

node tests/run.js smoke phone           # only the scenarios whose names contain one of these words
node tests/run.js --verbose             # list every check, with its info
node --test tests/sim/00-core.test.js   # one simulation test file
node tests/bench.js 300 6000 --strict   # 300 enemies, 6000 steps; also fail if the worst step is above 4 ms
node tools/build.js --out /tmp/mine     # both builds into a folder of your own, and then
GAME=/tmp/mine/Tollbound.html node tests/run.js   # test that build instead of .build/

node tools/shot.js --out .build/shots/x.png --size 390x844 --mobile   # a picture of the running game
node tools/hear.js --all                # every sound effect to .build/hear/*.wav, checked for silence, clipping
                                        # and loudness against the others (node tools/hear.js --list for the ids)
```

Node 22 is needed. `npm run test:full` runs on GitHub for every change under `Games/Tollbound/`.

## Layout

- `Tollbound.html`: the built game. Tracked, so the game can be played straight from the repository.
- `src/page/`: the page around the game. `head.html` and `tail.html` are the wrapper of the standalone page, `body.html` holds the game area and its six layers, and `css/NN-owner.css` files are joined in name order.
- `src/js/NN-name.js`: the game, one module per file, joined in the order of the numbers.
- `tools/`: `modules.js` gives the module order to everything else, `build.js` builds, `lint.js` checks the code rules, `shot.js` takes a picture of the running game and `hear.js` renders the sound effects to WAV files.
- `tests/`: `run.js` runs the browser scenarios of `scenarios/*.js`, and `helpers.js` is loaded into the page for them. `sim/*.test.js` are the Node tests, and `sim/loader.js` loads the simulation for them. `bench.js` measures the step time of the simulation.
- `docs/`: `design/` is the game itself: its words, districts and art (`01-world.md`), the combat model with the rows of every table of `src/js/10-stats.js` (`02-combat.md`), the classes (`03-classes.md`) and progression (`04-progression.md`), and the denylist the lint enforces. `engine.md` holds the contracts every module is written against: the run state, the entities, the modules with their signatures, the data shapes, the rules, what each file of the first vigil exports ("Stage 1 systems"), and the contracts of the Household and the packages that build it ("Stage 2 systems"). Read both before writing code. `tests/sim/docs.test.js` holds parts of `engine.md` against the code, so a change to the fields of an entity or of the run state goes into both.
- `.build/`: development builds. Not tracked.

## Two builds from one source

`tools/build.js` writes two pages from the same parts. The standalone page is a whole document. The artifact is the fragment the Claude app publishes: the same style, body and script with no doctype, html, head or body tag. `npm run test:artifact` hosts the fragment under the app's limits. So that both keep working:

- The page is one file and asks the network for nothing: no outside scripts, styles, fonts or images.
- No `alert`, `confirm` or `prompt`. Storage may be missing or may throw; go through the storage adapter (`Store`).
- Sizes come from `height: 100%`, never from viewport units. Colours are custom properties on `:root`.
- The text of a document tag must not appear anywhere in `src/js`, `body.html` or the css, not even in a comment. The build stops if it does.

## The layers

| Files | Layer | May use |
|---|---|---|
| `00` to `29` | simulation | simulation namespaces only. No `window`, `document`, `navigator`, `performance`, `Date`, `Math.random`, timers or storage. |
| `30` to `49` | content | `Defs.add` only. Plain data: no functions, no `undefined`. |
| `50` to `99` | presentation | everything. It changes the simulation only through `Sim.step` and `Sim.command`. |

The simulation works in metres on a flat ground plane, advances in fixed steps of 1/60 s and draws all its randomness from seeded streams (`Core.RNG`), so the same seed and inputs give the same run. Files below 50 load in Node with nothing but `console`; that is how `npm run test:sim` runs them.

## The shape of a module

```js
// 10-stats.js: stat tables, modifier matching, sheets.
// Owns: Stats
// Public: Stats.sheet(mods, ctx), Stats.query(mods, stat, tags, conds)
(function () {
  'use strict';
  Stats.sheet = function (mods, ctx) { /* ... */ };
})();
```

- A file is one enclosed function and nothing else. Its header comment says what it is, which namespaces it adds to (`Owns: A, B`, or `Owns: (none)`), and lists its public functions with their arguments. That comment is the interface.
- Namespaces are the only top-level names. `00-core.js` declares the simulation ones and `50-platform.js` the presentation ones.
- A file adds only to the namespaces it owns and never reassigns what another file defined. Modules extend each other through registries (`Defs.add`, `AI.register`, `UI.screen` and the like).
- Nothing runs when a file loads except definitions and registrations. `99-boot.js` starts the game: it finalizes the definitions, then freezes every namespace, then calls `Game.boot()`. After that a namespace cannot gain or change a property, so state that changes lives in a closure or inside an object the namespace holds.
- Hot loops allocate nothing: no closures, array or object literals, `map`, `filter` or string building per entity.

## Adding a module

1. Pick the number by layer and by what the file builds on, and name the file `NN-name.js` in lower case. The build, the lint and the tests pick it up by its name.
2. Write the header comment first, then the enclosed function.
3. For a new namespace, add it to the `const` line of `00-core.js` or `50-platform.js`, add its `typeof` line to `99-boot.js`, and list it in `docs/engine.md`.
4. Styles for it go in `src/page/css/NN-name.css`, with colours from the tokens in `00-base.css`.
5. Test it. Rules and data get a Node test in `tests/sim/NN-name.test.js`:

   ```js
   const test = require('node:test');
   const assert = require('node:assert/strict');
   const { loadSim, plain } = require('./loader.js');
   const { Core } = loadSim();
   test('a seed gives the same stream', () => {
     assert.equal(new Core.RNG(7).next(), new Core.RNG(7).next());
     assert.deepEqual(plain(new Core.RNG(7).getState()), plain(new Core.RNG(7).getState()));
   });
   ```

   `loadSim()` gives a fresh copy of the simulation each time; `loadSim({ boot: true })` also finalizes the definitions and freezes the namespaces, as the page does; `loadSim({ only: ['00-core.js', '01-defs.js', '10-stats.js'] })` loads just the files named, which keeps the test of one file clear of content and systems that arrive later. Objects and arrays that come out of the simulation belong to another context: pass them through `plain()` before a strict deep comparison, and check thrown errors by their message.

   What the player sees gets a scenario in `tests/scenarios/NN-name.js`. Its `run` function is sent to the page and runs there, with `T` from `tests/helpers.js` and the game's namespaces under `TB`:

   ```js
   module.exports = [{
     name: 'title: opens on a phone', viewport: { width: 390, height: 844 }, mobile: true, query: '',
     run: async function () {
       T.check('the game is ready', TB.ready === true);
       await T.until(() => document.querySelector('#ui button'));
       return T.done();
     },
   }];
   ```

   A scenario passes only if every check passes and the page stays clean: no error, no `console.error`, no browser dialog, no request for another file. For input as a player gives it, use `await T.tap(element)`, `T.click`, `T.mouse`, `T.key`, `T.keyDown`, `T.keyUp` and, on a phone, `T.touch` for sticks and drags: the runner sends these from outside the page, so they are trusted, which events made inside the page are not (the top of `tests/helpers.js` lists them). The top of `tests/run.js` lists the optional fields (a time limit, a notch, a reload in the middle, a value handed from Node to the page). `tests/scenarios/20-play.js` uses the last of these to make the page replay a run that Node has played, checksum for checksum.

6. Run `npm test` before committing.
