# Cinderdeep 3D

Cinderdeep drawn entirely in 3D. Open `Cinderdeep3D.html` in a browser with WebGL to play; nothing else is needed. It is a copy of [Cinderdeep](../Cinderdeep/) with every 2D drawing path removed: the dungeons, the dungeons inside the Realm and the Realm itself are all three.js scenes.

## Working on it

`Cinderdeep3D.html` is built from `src/`. Edit `src/`, then rebuild. Never edit the built file by hand: the check below fails if it does not match `src/`.

```
npm install                       # once: Playwright for the tests
npx playwright install chromium   # once, if you have no Chromium for Playwright
npm run build                     # src/ -> Cinderdeep3D.html
npm test                          # build check, then play the game headless
node tests/run.js realm trail     # only the scenarios whose names contain these words
```

The same check and tests run on GitHub for every change under `Games/Cinderdeep3D/`.

## Layout

- `src/page/`: the page around the game: `head.html`, `style.css`, `body.html` (HUD and touch controls) and `tail.html`.
- `src/vendor/`: three.js, inlined ahead of the game, with its license beside it.
- `src/js/`: the game, one module per system, run in file-name order:
  - `00`–`15`: the core: utilities, sound, input, pixel art, content, floors, the world, the hero, monsters, loot, the painters, HUD, screens and saving.
  - `16`–`32`: the big content and art expansions, chaos, souls, talents' effects, feats, audio, controls, evolutions and turning heroes.
  - `33`–`47`: the Realm: zones, art, creatures, play, the ground painter, people, other players, the rigged world, the twenty-four elements, the Mycelium and small life.
- **The twenty-four elements.** Eight primal (fire, frost, storm, venom, shadow, earth, chaos, luck) and sixteen fused, each a pair one or two steps apart on the skill wheel, named as the wheel names it (`44-elemental-creatures.js`). A fused element does what both its primals do. The Mycelium carries them (`45-mycelium.js`): it runs in veins of a primal, veins fuse where neighbouring primals meet, and monsters, dungeon props, trees and stones, and fallen weapons take the element of the vein under them.
  - `48`–`54`: progression: one life each, skill trees, the shared talent tree and DNA.
  - `55`–`58`: the Living Realm, the Proving Trail, effects and Steel & Chaos.
  - `59`: the 3D renderer.
  - `60`: the main loop and boot.
- `tests/`: `scenarios.js` holds the scenarios, `helpers.js` is loaded into the page for them, `run.js` runs them.
- `tools/build.js`: the build. `tools/bundle-three.sh` rebuilds `src/vendor/three.min.js`.

## How it draws

`59-renderer-3d.js` is the only renderer. The simulation, collision and saves are the game's own; the renderer only reads them.

- **Dungeons.** Each room's floor is its pixel room picture laid flat. Wall tiles stand up as boxes, low on the near side of a room so they never hide it. Shut doors stand across their gaps. Unseen rooms stay hidden and the rooms you are not in are dimmed.
- **The Realm.** The land under the view is painted from the zone's baked 512-pixel blocks, with moving water, lava and shores, and laid flat. Trees, buildings, waystones, townsfolk and creatures stand up.
- **Cards.** Heroes, monsters, props, loot and Realm objects are painted by their pixel painters into canvases of their own that stand upright in the scene, so held weapons, rigs, tints and elemental looks carry over. Still things (trees, houses, rocks) are painted once and only moved; trees and roofs fade when you walk behind them. Shadows a painter casts while painting a card are laid on the floor instead.
- **The floor layers.** Lava, shadows, corpses, telegraphs, rings, runes and slashes are painted onto two canvases laid over the floor: one lit, one glowing.
- **Effects in the air.** Sparks, glows, hit bursts, level-up beams and lightning stand up as soft pictures added on as light, one draw per picture for all of them; sparks arc through the air and settle. The game's own particles (blood, grit, embers, soot) are square pixels flying in the scene too: glowing ones added as light, the rest lit like anything else. Dash after-images are cards of the hero's frame. Missiles are cards too, flying at hand height over their own shadows and lit by themselves.
- **The screen.** Damage numbers, health bars, levels, speech and weather stay flat on a canvas over the scene.
- **The camera** looks straight ahead with its lens shifted down, so upright things stay upright anywhere on screen and sprites show at their painted size. `screenToWorld` casts the mouse onto the floor to aim.
- **Light.** The ten nearest light sources (torches, lamps, lava, spells, the hero) are point lights, over ambient light set by the region's darkness or the Realm's time of day. Distance fades into the dark below ground and into a haze in the Realm that darkens with the night. In the dark, hot colours on cards and floors (fire, lava, lit windows, eyes, magic) glow by themselves.
- **Glow and colour.** The scene is drawn off-screen, its bright parts are blurred at a quarter and an eighth of the size and added back, then highlights are rolled off softly with a vignette. Settings can turn it off; low effects turn it off too.

three.js comes from the [CinderDeep](https://github.com/iteatsthesalt/CinderDeep) catalog, at the commit it pins for `upstream/mrdoob/three.js`. Only the classes listed in `tools/three-entry.js` are bundled. To add one, list it there and run `tools/bundle-three.sh /path/to/three.js` against a checkout of that commit.

## Extending the game

Later modules change earlier ones by reassigning functions (`const _x = f; f = function () { … _x() … }`) or through `hook(name, fn)`. Prefer a hook, or one of the registries, to another wrapper:

- Pause menu: `pauseItem(id, order, (el, p, run) => button or null)` in `28-screens-upgrade.js`. Entries show in order: Resume is 10, Settings 100.
- Settings: `settingsRow(id, order, (back) => node or null, top)` in `14-screens.js`. Rows go above the Done row, or under the heading when `top` is true.
- Things the hero can use: `interactable({ near, prompt, use })` in `11-stats-loot-shops.js`. `near(p, best)` returns something closer than `best`, or `best`; `prompt(t)` names a target it owns, or returns null; `use(t)` acts on a target and returns true if it was theirs.

Add a scenario to `tests/scenarios.js` for anything new, and run `npm test` before committing.
