# Tollbound engine notes

These are the contracts every module is written against: how files are shaped, what the simulation state looks like, the data shapes content is authored in, and the rules of stats and damage. `docs/design.md` holds the game itself (names, numbers, content lists). `docs/plan.md` is the approved plan and is a snapshot; where it differs from this file, this file wins. Once a module exists, its code and its header comment win over this file, and whoever changes an interface updates this file in the same change.

## What is fixed and what is provisional

The owner's instruction of 2026-11-12: **all new fresh ideas, nothing from memory.** Every idea in the game is invented for this game. Nothing is recalled from another game, from genre stock, or from an earlier project. What is known of other games is used only to recognise and reject look-alikes.

Fixed, because the owner asked for it or approved it:

- The frame: horde-survival runs with self-casting skills and level-up picks; a character with a class, a subclass, levels, a large shared passive tree, socketable skills that take modifiers, and gear with random modifiers.
- One life per character. A permanent tree shared by all characters. Runs with no fixed end, left through gates. Two ways to play. The open world last.
- The bell-city world and the title. The 2.5D look. One HTML file.
- The machinery in this file: file shape, layers, determinism, pools, the modifier operations (`flat`, `inc`, `more`, `set`) with tags and conditions, definitions as plain data, behaviour named by id in closed registries.

Provisional, to be replaced by what `docs/design/` invents:

- The lists of damage types, tags, conditions, attributes and stats under "Data shapes".
- The defender's steps and the ailment table under "Rules".
- Item rarities, crafting jobs, enemy AI names, skill archetype names, and every display word in the table below.

So that the replacement is cheap, **code never hard-codes one of these names in its logic.** Damage types, attributes, conditions and stats are rows in the tables of `10-stats.js`, and logic loops over the tables. An entity stores the conditions it carries in three fixed-length arrays indexed by `Stats.AILMENT[id]`, the row of `Stats.AILMENTS` (`condT` for time left, `condV` for strength, `condN` for a spare number such as stacks or build-up), sized `Stats.COND_MAX` (16), not in named fields. The conditions a modifier may ask for (`Cond` below) are a separate table, `Stats.CONDS`; a set of them is a number with the bits `Stats.COND[id]` set. Attributes are `Stats.PRIMARIES`, and requirements and `per` modifiers accept any of them.

## Conventions

**Language.** Plain JavaScript (ES2020), classic scripts, no dependencies, no build step beyond concatenation. Everything in `src/js` is joined into one `<script>` in the order `tools/modules.js` gives.

**File shape.** A file is one enclosed function that adds to its own namespace and to nothing else:

```js
// 10-stats.js: stat tables, modifier matching, sheets.
// Owns: Stats
// Public: Stats.sheet(mods, ctx), Stats.skillSheet(mods, sigilInst, sheet), Stats.query(mods, stat, tags, conds)
(function () {
  'use strict';
  Stats.sheet = function (mods, ctx) { /* ... */ };
})();
```

- Namespaces are the only top-level names. `00-core.js` declares the simulation ones, `50-platform.js` the presentation ones. No other file declares anything at top level.
  - Simulation: `Core Defs Stats Dmg Items Tree Char Progress Legacy SaveData Sim Player Buffs AI Enemies Skills Boss Director Offers Bot World`
  - Presentation: `Plat Store Settings Input Sound Music Mesh Rigs Glyphs Ground Gfx Scene Vfx UI Game`
- Nothing runs when a file loads except definitions and registrations. `99-boot.js` starts the game.
- No file reassigns a function another file defined. Modules extend each other through registries and through the per-step event queue. The registries that exist: `Defs.add`, `Defs.allow` and `Defs.extend` (content, word lists and fields of the schema), `Sim.field`, `Sim.state` and `Sim.source` (entity fields, a system's slot in the run state, modifiers for every sheet), `Gfx.register` (views), `UI.screen` (menus) and `Plat.on` (the notices `90-game.js` posts). Planned: `AI.register`, `Skills.archetype`, `Rigs.register`, `Director.event`, `Settings.row`.
- `Core.seal(list)` freezes every namespace at boot, before `Game.boot()`, so a late reassignment throws. State that changes therefore lives in a closure or inside an object the namespace holds; a namespace shows it through a getter defined while the file loads (`Game.S`, `Store.status`, `Gfx.active`).
- Each file starts with a comment that says what the file is, names the namespaces it adds to on an `Owns:` line (`Owns: A, B`, or `Owns: (none)`), and lists its public functions with their arguments. That comment is the interface, and `tools/lint.js` holds a file to its `Owns:` line.

**Layers.** `tools/lint.js` enforces them.

| Files | Layer | May use |
|---|---|---|
| `00` to `29` | simulation | other simulation namespaces only. No `window`, `document`, `navigator`, `performance`, `Date`, `Math.random`, timers or storage. |
| `30` to `49` | content | `Defs.add` only. Plain JSON-serializable data: no functions, no `undefined`, no references to other objects. |
| `50` to `99` | presentation | everything. Reads simulation state and the event queue; changes the simulation only through `Sim.step(S, input)` and `Sim.command(S, cmd)`. |

Files below 50 load in Node with nothing but `console`. That is how the simulation tests run, and it is what keeps the rules portable to another engine.

**Units and axes.** Metres, seconds, radians. The world is a flat ground plane: the simulation uses `(x, y)` on the ground, and the 3D view draws simulation `y` along its depth axis with height as a third value. In every view `+x` runs to the right of the screen and `+y` towards the viewer, down the screen, so an input of `my = -1` walks up the screen. No frame counts appear in data; durations are seconds.

**Determinism.** The simulation advances in fixed steps of 1/60 s. All randomness comes from seeded streams forked from the run seed (`S.rng.spawn`, `S.rng.loot`, `S.rng.combat`, `S.rng.offers`, `S.rng.world`). Presentation has its own unseeded stream for cosmetic effects and never feeds anything back. The same seed and the same inputs give the same `Sim.hash(S)`: `tests/sim/determinism.test.js` holds every module below 50 to that in Node, and `tests/scenarios/20-play.js` makes the built page replay a run that Node has played, checksum for checksum. A module keeps nothing from one run to the next: a scratch array or variable it holds for itself carries nothing over from one call to another, so two runs stepped in turn do not disturb each other.

**Speed.** The simulation step runs with hundreds of entities, so hot loops allocate nothing:

- Entities live in `Core.Pool`s of fixed-shape objects and are removed by swap, only in the deaths phase of the step.
- Neighbour queries go through `Core.Grid` and write into a caller-supplied array. In a loop over entities use `grid.near(body, margin, out)`: it hands no numbers across a call and allocates nothing.
- No closures, array literals, object literals, `map`/`filter`/`forEach` or string building inside per-entity loops.
- Hard caps, from the constants `main` (`S.rules.caps`): 600 enemies, 500 projectiles, 120 areas, 400 pickups, 40 minions, and 2048 events in one step. `pool.alloc()` gives `null` when a pool is full. When a cap is hit, the oldest or weakest is merged or dropped, never an error.
- Budget, checked by `tests/bench.js` at the end of `npm run test:full`: a step of `Sim.debugScene(600)` takes at most 1.5 ms on average.

**Text.** Display text lives only in `name`, `text` and `flavour` fields, plain, with `{0}` placeholders. Ids are lower-case with dots or dashes and never shown.

**Original names.** The game's own words are in the table below. `docs/design/denylist.txt` lists names that must not appear anywhere in ids or text; `tools/lint.js` checks it.

| Word | Role |
|---|---|
| sigil | active skill |
| binding | modifier socketed into a sigil |
| vow | permanent buff that reserves candles |
| candles | the pool vows reserve |
| chime | temporary in-run upgrade |
| hush | recharging shield |
| draught | healing charge item |
| calling | subclass |
| rite | challenge run that grants calling points |
| path / minor / major / capstone | passive tree node kinds |
| vigil | a run |
| toll | the periodic bell that raises threat |
| gate | the exit from a vigil |
| haul | items carried during a vigil |
| chart | endgame map item |
| deed | quest-like goal |
| Echoes | currency for the Carillon |
| the Carillon | permanent tree shared by all characters |

Modifier operations are shown to players as `+12` (flat), `+12%` (inc) and `x1.20` (more).

## Run state

`Sim.create(cfg)` returns the run state `S`. It is plain data plus pools and grids. Presentation reads it and never writes it. These are the fields as `20-sim.js` makes them; its header comment says more about each.

```js
cfg = {mode, zone, seed, char, account}       // seed: a number or a string. mode defaults to 'watch'.
                                              // char is a deep copy; the run changes the copy, the game writes it back
      // a run without a character (tests, debug scenes, the first stage) may carry instead:
      //   mods: [Mod], sigils: [SigilInst|null], level, weapon: {family, damage, aps, crit}
      // and any run may carry rules: {name: number}, which overrule S.rules

S = {
  cfg, mode, zone,                            // the cfg as given (never copied), and the defs of its mode and zone
  rules,                                      // the constants 'main', overruled by the zone's tollSeconds, keeperToll
                                              // and gateEvery, by zone.rules and by cfg.rules. rules.caps holds the caps.
  curves,                                     // the curves 'main'
  rng: {spawn, loot, combat, offers, world},  // Core.RNG streams forked from the seed
  step, t,                                    // steps done; seconds = step / 60
  toll, tollAt, tollSteps,                    // tolls rung; the step at which the next one rings; steps between two
  threat,                                     // threat tier: starts at 0, and the director keeps it
  phase: 'play'|'offer'|'ended',
  player,                                     // one sealed object; see "Entities"
  mods, sheet,                                // the modifier list of the last rebuild, and the Sheet made from it
  skills: [{inst, sheet, cd, t, n, target, a0, a1, a2, a3}],
                                              // one slot for each place of the loadout, in its order, and no slot ever
                                              // moves: an empty place has inst and sheet null. cd is seconds until the
                                              // next cast; the rest is room for the archetype's state.
  enemies, shots, areas, pickups, minions,    // Core.Pool; see "Entities"
  grid,                                       // Core.Grid over enemies, rebuilt once in every step
  region, props,                              // the ground from World.region: {x, y, radius, props, grid}, and its
                                              // props [{id, x, y, r, light}]: colliders and lights
  gate: null|{x, y, until, hold},
  boss: null|enemy,                           // set to null when that enemy is removed
  offer: null|Offer, offerQueue: [],
  chimes: {[chimeId]: stacks}, buffs: [],
  events, eventCount, eventStart, eventsDropped,   // see "Events" below
  haul: [], gold, echoes, kills, counters: {},     // kills is counted in the deaths phase of the step
  dirty,                                      // set it to true when modifiers, the loadout or player.conds changed:
                                              // the sheets are rebuilt in the same step, or at once after a command
  result: null|{outcome:'left'|'died', mode, zone, seed, steps, time, tolls, threat, kills, gold, echoes, runLevel,
                haul /* how many items */, eventsDropped},
  uid,                                        // the last uid given out
  debug: null|{x, y}                          // the centre of Sim.debugScene; null in a real run
  // plus one field for each Sim.state(name, make) a system declared while its file loaded: S[name] = make(S)
}

Offer = {kind:'chime'|'node'|'reward', source, options:[{id, kind, name, text, icon, rarity}], rerolls, banishes, skips}
```

While `S.phase` is `'offer'` the clock does not advance and `Sim.step` does nothing and returns `false` until `Sim.command(S, {type:'pick', ...})` resolves the offer. This is what lets `Game.sim(seconds, {bot: true})` play through level-ups without any menu. Until `27-offers` exists, `pick` and `skip` only close the offer. A step that began in `'play'` runs to its end even if the run ends or an offer opens on the way.

**Events.** `S.events` is a ring of `S.rules.caps.events` reused objects `{k, x, y, a, b, id}`, not a list that grows. It holds what the last step that ran, or the last command, emitted: both empty it first, so read it after each call (in the page: in a listener of the notice `'step'` or `'command'`, since one frame may hold several steps). Event `i` of `S.eventCount` is `S.events[(S.eventStart + i) % S.events.length]`. `S.eventStart` is 0 unless more events were emitted than the ring holds; then the oldest were overwritten and `S.eventsDropped` counts them. What `a`, `b` and `id` mean is up to the emitter. So far: `'kill'` has `a` = rank, `b` = level, `id` = the enemy def's id; `'toll'` has `a` = `S.toll`; `'end'` has `a` = tolls, `b` = kills, `id` = the outcome.

**Sheets.** `Sim.rebuild(S)` gathers the modifiers: `Char.mods(cfg.char, S, cfg.account)` if the run has a character and that function exists, else `cfg.mods`; then whatever each `Sim.source(fn)` adds (chimes, buffs). `Stats.sheet` gets them with the level, the weapon, the number of active vows, the stacks of chimes and `S.player.conds`. Then `S.skills` is made to follow the loadout and every slot gets its skill sheet. A rebuild is not cheap (its author measured about half a millisecond with 400 modifiers and six sigils), so set `S.dirty` when something changed, not in every step.

`InputFrame`: `mx, my` is the move vector with length at most 1. `ax, ay` is a unit aim vector, used only when `aim` is true; otherwise each sigil picks its own target. `dodge` and `draught` are true only on the step they are pressed: the game samples the input once for each step, not once a frame. `Sim.NO_INPUT` is the frame of a player who does nothing, and what `Sim.step(S)` uses when it is given none.

## Entities

Every pooled object has one fixed set of fields and is sealed, so a field that was not declared cannot be added by mistake. `pool.alloc()` gives one with every field at its default, `alive = true` and a new `uid`, or `null` when the pool is full. A file that needs another field declares it while it loads, with `Sim.field(kind, name, value)`: the default is a number, a boolean, a string or `null`, and the kinds are `enemy`, `minion`, `shot`, `area`, `pickup`, `player` and `skill`. Only files numbered above `20` can do so, because `20-sim.js` has not run when the earlier ones load: `11-damage` declares its fields from a later file of its package. `Sim.fields(kind)` lists the fields of a kind, built in and added.

| Kind | Built-in fields, in order |
|---|---|
| every pooled entity | `alive, uid, x, y, px, py, vx, vy, r, face, t, state, stateT, a0, a1, a2, a3` |
| enemy and minion add | `def, defHash, level, life, lifeMax, damage, speed, cd0, cd1, cd2, cd3, kx, ky, tx, ty, target, flash, condT, condV, condN` |
| enemy adds | `rank, xp, traitN, traits` |
| minion adds | `skill, ttl` |
| shot adds | `def, team, owner, skill, ttl, damage, dist, pierce, chain, fork, tx, ty, target, hitN, hits` |
| area adds | `def, team, owner, skill, ttl, damage, tick, angle, len, target` |
| pickup adds | `kind, value, ttl, item` |
| player | `alive, uid, x, y, px, py, vx, vy, r, face, aimX, aimY, life, hush, hushWait, dodgeT, dodgeCd, invuln, draughts, draughtFill, runLevel, runXp, kx, ky, state, stateT, conds, evade, hurtT, killT, flash, condT, condV, condN, a0, a1, a2, a3` |
| skill | `inst, sheet, cd, t, n, target, a0, a1, a2, a3` |

- `x, y` is the place and `px, py` the place before the last step. A view draws a thing at `px + (x - px) * alpha`, with the `alpha` of `Scene.draw(S, alpha)`. Something made during a step has its own place in `px, py`.
- `r` is the radius, `face` a direction in radians, `vx, vy` the speed. `t`, `state`, `stateT` and `a0` to `a3` are free for the system that owns the entity.
- `def` is the definition (for a shot or an area, the enemy `Attack` it came from, or `null`), `defHash` the hash of its id. `cd0` to `cd3` are attack cooldowns, `kx, ky` knockback speed, `tx, ty` a point it heads for, `target` a uid.
- `condT`, `condV` and `condN` are `Float64Array(Stats.COND_MAX)`, indexed by `Stats.AILMENT[id]`: seconds left, strength, and a spare number.
- `rank` is `Sim.COMMON` (0), `Sim.ELITE`, `Sim.MINIBOSS` or `Sim.BOSS` (3). `traits` has 4 slots of trait defs or `null`, and `traitN` says how many are filled.
- `team` is 0 for the player's side and 1 for the enemies'. `owner` is a uid, 0 for the player. `skill` is an index into `S.skills`, or -1. `hits` is an `Int32Array(8)` of uids hit lately, and `hitN` counts how many were written.
- Shots, areas and pickups lose 1/60 s of `ttl` in every step and are removed when none is left: whoever makes one gives it a `ttl` in seconds, or it is gone in the same step. An enemy or a minion is removed when its `life` is 0 or less (a minion's `ttl` is free for its own system). `pool.kill(o)` removes without a kill, an event or a drop.
- The player has `uid` 0. `conds` is a mask of the modifier conditions that hold for the player (`Stats.condMask`).
- Entities are reused: keep a `uid`, never the object, from one step to the next. A loop over `pool.items[0 .. pool.n)` skips what is not `alive`: the dead keep their place until the deaths phase compacts the pool.

## Modules

`tools/modules.js` is the single source of file order for the build, the lint, the Node loader and the export. Nothing runs at load time before `99-boot`. The files in bold exist: their rows give the real signatures, and each file's header comment says the rest. The other rows are the plan.

| File | Layer | Responsibility | Key exports |
|---|---|---|---|
| **`00-core`** | sim | namespaces, maths, hash, RNG | `Core.HZ`, `Core.DT`, `Core.TAU`; `Core.clamp(v, lo, hi)`, `lerp(a, b, t)`, `sign(v)`, `mod(a, n)`, `approach(v, target, step)`, `dist2(ax, ay, bx, by)`, `dist(ax, ay, bx, by)`, `angleWrap(a)`, `angleDiff(from, to)`, `angleToward(a, target, step)`; `Core.hashStr(text)`, `Core.hashMix(h, number)`; `new Core.RNG(seed)`: `next()`, `u32()`, `range(a, b)`, `int(a, b)`, `chance(p)`, `pick(array, n?)`, `weighted(items, key?, n?)`, `shuffle(array, n?)`, `fork(label)`, `getState()`, `setState(state)`, `hash(h)`; `Core.assert(cond, message)`, `Core.deepFreeze(obj)`, `Core.seal(list)` |
| **`01-defs`** | sim | registries, schemas, validation, freeze | `Defs.KINDS`, `Defs.add(kind, def) -> def`, `Defs.get(kind, id)` (throws when there is none), `Defs.has(kind, id)`, `Defs.all(kind) -> [def]`, `Defs.SCHEMA`, `Defs.SHAPES`, `Defs.ENUMS`, `Defs.allow(name, word, ...)`, `Defs.extend(kind, fields)`, `Defs.finalize() -> [error]` |
| **`02-pool-grid`** | sim | fixed-shape pools, spatial grid | `new Core.Pool(make, cap, reset?)`: `items`, `n`, `cap`, `moves`, `alloc()` (an object, or `null` when full), `kill(o)`, `compact() -> removed`, `clear()`; `new Core.Grid(cell)`: `rebuild(pool)`, `query(x, y, r, out) -> n`, `near(body, margin, out) -> n` |
| **`10-stats`** | sim | stat, tag and condition tables; sheets | the tables `Stats.TYPES`, `TYPE`, `FAMILIES`, `PRIMARIES`, `PER`, `AILMENTS`, `AILMENT`, `COND_MAX`, `TAGS`, `CONDS`, `COND`, `STATS`, `LEVEL_MAX`; `Stats.stat(id)`, `Stats.is(table, id)`, `Stats.condMask(conds)`, `Stats.scaled(value, level)`, `Stats.resolve(mods, level, out?)`, `Stats.query(mods, stat, tags?, conds?, primaries?)`, `Stats.queryRange(mods, stat, tags, conds, primaries, out)`, `Stats.sheet(mods, ctx) -> Sheet`, `Stats.skillSheet(mods, sigilInst, sheet) -> SkillSheet`, `Stats.hitMult(skillSheet, typeIndex, conds)`, `Stats.fits(sigilDef, bindingDef)` |
| `11-damage` | sim | hits, defences, ailments, damage over time | `Dmg.hitEnemy(S, skill, enemy, scale)`, `Dmg.hitPlayer(S, attack, source)`, `Dmg.tick(S)` |
| `12-items` | sim | generation, crafting, salvage | `Items.create(baseId, ilvl, rarity, rng)`, `Items.drop(ctx, rng)`, `Items.craft(target, currencyId, rng)`, `Items.mods(item)` |
| `13-tree` | sim | passive tree built from skeleton and clusters | `Tree.build()`, `Tree.frontier(char)`, `Tree.canAllocate(char, id)`, `Tree.canRefund(char, id)` |
| `14-character` | sim | character operations, modifier collection, requirements | `Char.create(classId, name)`, `Char.mods(char, run, account)`, `Char.weapon(char)`, `Char.allocate(char, id, choice)`, `Char.equip(char, uid, slot)`, `Char.socket`, `Char.grantXp` |
| `15-progress` | sim | deeds, unlocks, charts, rites, Echoes and the Carillon | `Progress.onEvent(save, evt)`, `Progress.chart(tier, rng)`, `Legacy.buy(save, id)`, `Legacy.mods(save)` |
| `16-savedata` | sim | save schema, migrations, text codec | `SaveData.blank()`, `migrate(raw)`, `validate(raw)`, `encode(save)`, `decode(text)` |
| **`20-sim`** | sim | run state, step order, commands, events, entity fields | `Sim.create(cfg) -> S`, `Sim.step(S, input?) -> boolean`, `Sim.command(S, cmd) -> boolean`, `Sim.emit(S, k, x, y, a, b, id)`, `Sim.spawnEnemy(S, id, x, y, opts?)` (an enemy, or `null` when the pool is full; opts `{level, rank, traits}`; the id may be a boss), `Sim.rebuild(S) -> Sheet`, `Sim.end(S, outcome) -> result`, `Sim.result(S)`, `Sim.hash(S) -> uint32`, `Sim.debugScene(n, seed = 1) -> S`, `Sim.field(kind, name, value)`, `Sim.fields(kind)`, `Sim.state(name, make)`, `Sim.source(fn)`, `Sim.COMMON`, `Sim.ELITE`, `Sim.MINIBOSS`, `Sim.BOSS`, `Sim.NO_INPUT` |
| `21-player` | sim | move, dodge, draught, pickup magnet, buffs | `Player.step(S, input)`, `Player.pickups(S)`, `Buffs.add(S, id, mods, seconds)` |
| `22-enemies` | sim | AI, steering, capped separation, elite traits | `AI.register(name, fn)`, `Enemies.step(S)` |
| `23-skills`, `24-archetypes` | sim | auto-cast, targeting, triggers; projectile, burst, arc, orbit, chain, beam, zone, deployable, summon | `Skills.archetype(name, {cast, update})`, `Skills.step(S)` |
| `25-boss` | sim | phases, telegraphs | `Boss.step(S)` |
| `26-director` | sim | tolls, threat budget, gates, events, drops, shard merging, routes | `Director.step(S)`, `Director.onKill(S, enemy)`, `Director.event(kind, fn)` |
| `27-offers` | sim | chime, node and reward offers | `Offers.push(S, source)`, `Offers.step(S)`, `Offers.resolve(S, cmd)` |
| `28-bot` | sim | scripted players | `Bot.input(S, policy)`, `Bot.choose(S, offer)` |
| **`29-world`** | sim | seeded regions, props, obstacles | `World.region(seed, zoneDef, x?, y?) -> {x, y, radius, props, grid}`, `World.propsNear(S, x, y, r, out) -> count`, `World.pushOut(S, ent) -> boolean`, `World.CLEAR`, `World.GAP` |
| **`30-modes-curves`** | content | the two modes, the level curves, the constants of a run, the debug zone | modes `watch` and `gauntlet`; curves `main` (for levels 1 to 70: `enemyLife`, `enemyDamage`, `enemyXp`, `accuracy`, `charXp`, `gauntletXp`, `runXp`; and `rank[0..3]`); constants `main` (`spawnRadius`, `despawnRadius`, `tollSeconds`, `keeperToll`, `gateEvery`, `gateOpenSeconds`, `gateHoldSeconds`, `caps`, `gridCell`, `playerRadius`); zone `debug`; enemy `debug.husk` |
| `31` to `49` | content | one file per class with its callings; Carillon; tree skeleton and sectors; sigils by attribute; bindings; vows; bases; affixes; uniques; currencies; chimes; one file per district with its enemies and boss; elite traits and chart modifiers; deeds; puppets; tilesets and props | `Defs.add(...)` only |
| **`50-platform`** | presentation | namespaces, the browser as the game sees it, the notice board, storage adapter | `Plat.query(name)`, `Plat.isTouch`, `Plat.dpr()`, `Plat.now()`, `Plat.loop(fn)`, `Plat.stop()`, `Plat.onVisibility(fn) -> off`, `Plat.onResize(fn) -> off`, `Plat.on(name, fn) -> off`, `Plat.emit(name, a, b, c)`; `Store.read(key)` (a promise of an object or `null`), `Store.write(key, obj)` and `Store.remove(key)` (promises of a boolean), `Store.status` (`'saved'`, `'memory'` or `'error'`), `Store.onStatus(fn) -> off` |
| `51-settings`, `52-input` | presentation | settings rows; all devices into one frame | `Settings.row(id, order, build)`, `Input.sample() -> InputFrame` |
| `53-sound`, `54-music`, `55-sound-<set>` | presentation | effects with rate limits; music ticked from the frame loop; suspended when hidden | `Sound.sfx(id, opts)`, `Music.play(id)`, `Sound.suspend()` |
| `60-mesh`, `61-rigs`, `62-glyphs`, `63-ground` | presentation | primitive shapes and matrix maths; rig animation; icon painter; ground textures | `Rigs.register(name, fn)`, `Glyphs.icon(spec) -> canvas` |
| **`65-gfx`** | presentation | the list of views; the instance records all views share; world to screen | `Gfx.register(name, factory, isSupported)`, `Gfx.backends`, `Gfx.create(canvas, prefer) -> backend`, `Gfx.active`, `Gfx.worldToScreen(x, y, z?, out?)`, `Gfx.screenToWorld(sx, sy, out?)`, `Gfx.DISC_STRIDE`, `Gfx.DECAL_STRIDE`, `Gfx.BILLBOARD_STRIDE` |
| `66-gfx-gl` | presentation | the 3D view | registers the view `'gl'` with `Gfx.register` |
| **`67-gfx-2d`** | presentation | the compatibility view: discs on the ground seen from above | registers the view `'2d'` |
| `68-scene`, `69-vfx` | presentation | sim state to instance buffers; particles, numbers overlay, shake | `Scene.draw(S, alpha)`, `Vfx.consume(events)` |
| **`70-ui-core`** | presentation | element builder, screen stack, confirm dialog, toasts, focus by keys and pad | `UI.h(tag, attrs, ...children)`, `UI.button(label, onClick, attrs)`, `UI.screen(id, {open, close, pause, back, scrim})`, `UI.has(id)`, `UI.isOpen(id)`, `UI.open(id, args)`, `UI.close(id?)`, `UI.replace(id, args)`, `UI.clear()`, `UI.top()`, `UI.pausing()`, `UI.confirm(text, {yes, no})` (a promise of a boolean), `UI.toast(text, ms)`, `UI.nav(dx, dy)`, `UI.activate()`, `UI.back()`, `UI.setKeys(on)` |
| `71` to `77-ui-meta` | presentation | HUD; offers; hub; gear; tree; sigils; deeds, Carillon, memorial, onboarding | screens registered with `UI.screen` |
| **`90-game`** | presentation | the states title, run and results; the frame loop with its 60 Hz steps (at most 4 a frame), paused when hidden; stand-in title, results and picture | `Game.boot()`, `Game.start(cfg)` (the run, or `null`), `Game.title()`, `Game.command(cmd) -> boolean`, `Game.sim(seconds, {bot, policy}) -> steps`, `Game.S`, `Game.state`, `Game.debug`, `Game.VERSION` |
| **`99-boot`** | presentation | collects the namespaces; finalize, seal, boot | `window.TB`: every namespace, and `TB.ready` |

**The order of a step**, set in `Sim.step` and nowhere else. Other namespaces are called only if they exist.

```
 0  the event queue is emptied; px, py of the player and of every entity take its x, y
 1  Player.step(S, input)
 2  Director.step(S)
 3  S.grid.rebuild(S.enemies)          so the grid does not know enemies spawned later in the step
 4  Enemies.step(S)
 5  Skills.step(S)                     casting, then shots, areas, minions and their hits
 6  Boss.step(S)
 7  Dmg.tick(S)                        every 15th step: damage over time, 4 times a second
 8  deaths                             an enemy at no life: S.kills + 1, a 'kill' event, Director.onKill(S, enemy), removal.
                                       Minions at no life, and shots, areas and pickups out of ttl, are removed.
                                       Pools are compacted here and only here.
 9  Player.pickups(S)
10  Sim.rebuild(S), if S.dirty
11  Offers.step(S)
12  the clock: S.step, S.t, and on time S.toll + 1 with a 'toll' event
```

In a debug scene (`Sim.debugScene`, `S.debug` not null) steps 2, 4 and 6 give way to the scene's own rule: every husk walks a ring round the spot where the player began. Without `Player.step`, the move vector of the input walks the player there at 5 m/s.

**What is called if it exists.** The kernel and the game are written against systems that come later, and ask with `typeof` before each call. These are the signatures they use; whoever writes the system keeps to them, or changes the caller in the same change.

- `Sim.step`: the hooks of the list above.
- `Sim.command`: `Offers.resolve(S, cmd)` for `pick`, `banish`, `reroll` and `skip`; `Char.allocate(char, id, choice)` and `Char.equip(char, uid, slot)`. Each counts as done unless it returns `false`.
- `Sim.rebuild`: `Char.mods(char, S, account) -> [Mod]` and `Char.weapon(char)` (a weapon profile `{family, damage, aps, crit}`, or `null`).
- The frame loop of `90-game`: `Input.sample() -> InputFrame`, once for each step; `Scene.draw(S, alpha)`, once a frame while there is a run.
- `Game.sim`: `Bot.input(S, policy) -> InputFrame` and `Bot.choose(S, offer)`, which returns the index to pick or a whole command.

**The frame.** `90-game` adds up frame time and spends it in steps of 1/60 s. A step runs as soon as any time is owed, so after a frame the simulation stands where the frame is or up to one step ahead, and `alpha`, above 0 and up to 1, says where the frame lies between the last two steps: a thing is drawn at `px + (x - px) * alpha`. On a 60 Hz screen each frame is one step and `alpha` is 1. No step runs while a screen that pauses is open (`UI.pausing()`), while `S.phase` is `'offer'`, while the page is hidden, or once the run has ended. Menus send commands through `Game.command(cmd)`, not `Sim.command`, so that the readers of events hear of them.

Files that load before `90-game` cannot call it while they load. They hear from it through the notice board, `Plat.on(name, fn)`:

| Notice | Arguments | When |
|---|---|---|
| `'boot'` | `view` | once, in `Game.boot`, when the view exists and before the title opens: the moment for a module to set itself up |
| `'state'` | `state, before` | the game changed state: `'title'`, `'run'` or `'results'` |
| `'step'` | `S, live` | after every simulation step; `live` is false inside `Game.sim`. The place to read `S.events` |
| `'command'` | `S, live, cmd` | after a command sent with `Game.command`, or by `Game.sim` to resolve an offer |
| `'frame'` | `S, alpha, dt` | once a frame, after drawing; `S` is `null` while there is no run |
| `'resize'` | `cssW, cssH, dpr` | the view was fitted to a new size |

The screens `'title'` and `'results'` of `90-game` are stand-ins, registered at boot only if no other file has registered those ids. `'results'` is opened with `{S, result}`. `Scene.draw` is called only while there is a run; on the title the game draws the empty ground itself.

**The renderer contract** shared by both views. A view's file registers it while it loads; `65-gfx` holds the list and the records.

```
Gfx.register(name, factory, isSupported)   factory(canvas) -> b; isSupported() -> boolean
Gfx.create(canvas, 'gl'|'2d') -> b         the view asked for, else the next that starts, '2d' last. Use b.canvas from then on.
b.name   b.canvas   b.caps {puppets, shadows, lights, bloom, maxInstances}   b.stats {drawCalls, instances}
b.resize(cssW, cssH, dpr)   b.quality('high'|'medium'|'low')
b.begin(cam {x, y, zoom}, env {ambient, sun:{dir, color}, fog, ground:[r, g, b]} | null)
b.parts(shape, buffer, count)       solid instances: 3x4 matrix, colour, flash, emissive (the 3D view gives the stride)
b.decals(buffer, count)             flat on the ground: telegraphs, scorch, pickup glow
b.billboards(buffer, count)         facing the camera: particles, bolts (alpha or additive)
b.discs(buffer, count)              compatibility view only: one disc per entity (b.caps.puppets is false)
b.lights(buffer, count)             x, y, z, radius, colour (the 3D view gives the stride)
b.end(post {bloom, flash, vignette, dither} | null)
b.worldToScreen(x, y, z, out)   b.screenToWorld(sx, sy, out)
Gfx.active   Gfx.worldToScreen(x, y, z?, out?) -> {x, y}   Gfx.screenToWorld(sx, sy, out?) -> {x, y}     in CSS pixels
```

Instance buffers are `Float32Array`s of whole records, and `count` is a number of records. Lengths are metres; colours and alpha run from 0 to 1.

```
Gfx.DISC_STRIDE = 7        x, y, radius, red, green, blue, alpha
Gfx.DECAL_STRIDE = 8       x, y, radius, red, green, blue, alpha, fill      fill: the share of the radius filled in, 0 to 1
Gfx.BILLBOARD_STRIDE = 9   x, y, z, size, red, green, blue, alpha, glow     glow above 0.5: it adds its light, else it covers
```

In the plain view the longer side of the canvas shows 30 m of ground at zoom 1, and a metre of height lifts a point half a metre up the screen.

## Data shapes

All definitions are plain JSON. Units are metres, seconds and radians.

The first five lists below (`Type`, `Family`, `Tag`, `Cond`, `Stat`) and the names `str`, `dex`, `int` are **placeholders**. The shapes that use them are the contract; the entries are not. See "What is fixed and what is provisional".

```js
Type   = 'physical'|'fire'|'cold'|'lightning'|'void'
Family = 'sword'|'axe'|'mace'|'dagger'|'bow'|'staff'|'wand'|'shield'|'focus'
Tag    = Type|Family|'elemental'|'attack'|'spell'|'melee'|'projectile'|'area'|'minion'|'duration'|'chain'|'beam'
       |'orbit'|'deployable'|'hit'|'dot'|'ignite'|'bleed'|'poison'
Cond   = 'lowLife'|'fullLife'|'moving'|'still'|'recentKill'|'recentHurt'|'recentDodge'|'draughtActive'|'hushFull'
       |'tChilled'|'tFrozen'|'tIgnited'|'tShocked'|'tBleeding'|'tPoisoned'|'tElite'|'tBoss'|'tNear'|'tFar'
Stat   = str dex int lifeMax lifeRegen lifeOnKill lifeOnHit hushMax hushDelay hushRate armour evasion
         res.<T> resMax.<T> res.elemental res.all pen.<T> taken moveSpeed dodgeCooldown draughtCharges draughtHeal
         draughtGain pickupRadius xpGain goldFind itemRarity itemQuantity echoGain candleMax damage added.<Type>
         gainAsExtra.<Type> critChance critMulti speed area projectiles pierce chain fork projSpeed duration range
         knockback chance.<ailment> build.freeze build.stun ailmentDuration minionLife flag.<id> param.<key>

Scaled   = number | {a, b, curve:'lin'|'exp'}                 // owner level 1 -> 20
Mod      = {stat, op:'flat'|'inc'|'more'|'set', value:Scaled|[min,max], tags?:[Tag], cond?:Cond,
            per?:{stat:'str'|'dex'|'int'|'level'|'vows'|'chimes', div, cap?}, from?:Type, local?:true}
            // a [min,max] value only on added.<Type>; from on gainAsExtra.<Type> and nowhere else
ModRange = {stat, op, tags?, cond?, from?, local?, min, max}
Req      = {level?, str?, dex?, int?}

Sigil     = {id, name, text, icon, attr, tier:1..5, tags:[Tag], weapon:[Family]|null, archetype,
             target:'nearest'|'densest'|'random'|'farthest'|'aim'|'self', rate:Scaled,
             damage:{[Type]:[Scaled,Scaled]}, weaponPct:Scaled, eff, crit, params:{[key]:Scaled}, mods:[Mod],
             fx:{puppet, cast, hit, sfxCast, sfxHit, light}}
SigilInst = {uid, id, level:1..20, sockets:2..5, bindings:[bindingId|null]}
Binding   = {id, name, text, icon, attr, tier, requires:[Tag], excludes:[Tag], addTags:[Tag], mods:[Mod],
             params:{[key]:number}, trigger:Trigger|null}
Trigger   = {on:'kill'|'crit'|'dodge'|'hurt'|'draught'|'timer', chance, cooldown}
Vow       = {id, name, text, icon, attr, tier, candles, mods:[Mod], aura:{radius, enemyMods:[Mod]}|null}

TreeSkeleton = {spokes:6, rings:[{r, slots}], pathMods:[Mod], starts:{[classId]:{sector}}}
Cluster   = {id, name, anchor:{sector:0..5, ring, slot}, shape:'ring6'|'arc5'|'fork4'|'line3'|'diamond4',
             theme:[Tag], entry:key, nodes:[{key, kind:'minor'|'major'|'capstone', name, text?, icon?, mods:[Mod]}]}
TreeNode  = {id, kind:'start'|'path'|'minor'|'major'|'capstone', name, mods:[Mod],
             choice:['str','dex','int']|null, x, y, links:[id], cluster:id|null}     // built, never hand-written
LegacyNode = {id, name, text, icon, branch, row, col, requires:[id], ranks, cost:[n], mods:[Mod], unlock?:{}}

Class   = {id, name, text, attrs:{str,dex,int}, perLevel:{str,dex,int,life}, base:[Mod], sector, startSigil,
           startGear:[baseId], callings:[id,id], unlock:deedId|null, puppet, palette:[hex]}
Calling = {id, class, name, text, points:8,
           nodes:[{key, kind:'minor'|'major', name, mods:[Mod], requires:[key], row, col}]}

Attack = {id, kind:'contact'|'projectile'|'area'|'beam'|'summon', type:Type, mult, cooldown, range, windup,
          shape:'circle'|'cone'|'line'|'ring', radius, angle, count, spread, speed, evadable,
          ailment:string|null, summon:{enemy, count}|null, fx}
Enemy  = {id, name, puppet, radius, life, damage, speed, xp, cost, loot,           // life, damage, xp scale by level curve
          ai:'chase'|'ranged'|'charger'|'swarm'|'caster'|'exploder'|'summoner'|'lurker', aiParams:{},
          attacks:[Attack|attackId], res:{[Type]:number}, armour, threshold, tags:[string]}
Boss   = Enemy & {arena:{radius}, phases:[{until, speed, onEnter:[attackId], loop:[attackId|{wait}]}]}
Trait  = {id, name, text?, mods?:[Mod]}                       // an elite trait; ChartMod has the same shape. Both
                                                              // may carry more fields
Zone   = {id, name, kind:'campaign'|'rite'|'chart'|'debug', level, tollSeconds:75, keeperToll:8, gateEvery:3,
          region:{radius}, tileset:id|null, props:[{prop, density}], ambient:{light:[r,g,b], fog, sun}, music,
          timeline:[{toll, rate, cap, pool:[{enemy, w}]}], overtoll:{rateMul, levelPer, rewardPer},
          events:[{toll, kind:'elite'|'swarm'|'miniboss'|'shrine', enemy?, boss?, traits?, shape?, count?}],
          boss:id|null, rules:{}, unlock:deedId|null, next:zoneId|null}   // density: props on 100 square metres

Puppet = {id, rig:'biped'|'quadruped'|'floater'|'crawler'|'winged'|'serpent'|'static', scale,
          parts:[{key, shape:'box'|'taper'|'cyl'|'sphere'|'cone', size:[x,y,z], at:[x,y,z], parent?:key,
                  joint?:string, color:paletteKey, emissive?:number}],
          palette:{[key]:hex}, anim:{stride, swing, bob}}
Prop   = {id, puppet, radius, light?:{radius, color}, breakable?:{loot}}

Base     = {id, name, slot, family, tags:[string], level, req:Req, twoHanded,
            weapon:{damage:{[Type]:[min,max]}, aps, crit}|null, defence:{armour,evasion,hush}|null,
            implicit:[ModRange], icon}
Affix    = {id, name, type:'prefix'|'suffix', group, weights:{[itemTag]:number}, tiers:[{ilvl, mods:[ModRange]}]}
Unique   = {id, name, base, level, mods:[ModRange], flavour, weight, unlock:deedId|null}
Item     = {uid, base, ilvl, rarity:'common'|'magic'|'rare'|'unique', unique?, implicit:[roll], corrupted,
            affixes:[{id, tier, rolls:[0..1]}]}
Currency = {id, name, text, icon, target:'item'|'sigil', op:'toMagic'|'toRare'|'addMod'|'reroll'|'removeMod'
            |'rerollValues'|'addSocket'|'corrupt'|'levelSigil', requires:{}, args:{}, weight, level}
Chime    = {id, name, text, icon, rarity:'common'|'rare'|'epic', weight, maxStacks, group?,
            scope:'global'|'sigils', requires:{tags?, class?, runLevel?}, mods:[Mod], params?:{}}
Deed     = {id, name, text, hidden, scope:'account'|'character', on:EventKind, count, where:{},
            reward:{class?, zone?, unique?, treePoints?, gold?, echoes?, currency?:{}}}

Mode = {id, name, text?, persistent, route:'zone'|'gauntlet', zones?, xpCurve, levelCap, runLevels,
        levelOffer:'none'|'node', runLevelOffer:'chime'|'none', eliteOffer, bossOffer, shrineOffer,
        haul:'gate'|'none', calling:{levels:[15,30,45,55]}|{afterBoss:1, pointsPerBoss:2},
        respec:'gold'|'last3', death:'permanent', score}       // xpCurve names a list of the curves 'main'
Curves    = {id:'main', levels, enemyLife:[n], enemyDamage:[n], enemyXp:[n], accuracy:[n], charXp:[n],
             gauntletXp:[n], runXp:[n], rank:[{life, damage, xp, size} x4]}      // lists indexed by level - 1
Constants = {id:'main', spawnRadius, despawnRadius, tollSeconds, keeperToll, gateEvery, gateOpenSeconds,
             gateHoldSeconds, caps:{enemies, shots, areas, pickups, minions, events}, gridCell, playerRadius}
             // a run reads them as S.rules; both kinds, and Tileset, may carry more fields

Save = {v:1, rev, updated, settings:{}, binds:{}, chars:[Char], active:uid|null,
        fallen:[{name, class, level, calling, zone, cause, tolls, played, date}],
        account:{gold, currency:{}, stash:[Item], deeds:{[id]:{n, done}}, counters:{},
                 legacy:{echoes, ranks:{[id]:n}}, unlocks:{classes:[], zones:[], uniques:[]},
                 records:[{mode, class, score, time, level, seed}]},
        gauntlet:null|{char:Char, zoneIndex, seed, time, score}}
Char = {uid, name, class, level, xp, calling:id|null, callingNodes:[key], tree:[{id, choice?}], bonusPoints,
        gear:{weapon,offhand,helm,body,gloves,boots,amulet,ring1,ring2,belt}, bag:[Item], sigils:[SigilInst],
        loadout:[uid|null x6], bindings:{[id]:n}, vows:{[id]:level}, activeVows:[id],
        charts:[{uid, tier, zone, mods:[id]}], cleared:[zoneId], rites:[id], played}

InputFrame = {mx, my, ax, ay, aim, dodge, draught}
Command = {type:'pick'|'banish', index} | {type:'reroll'|'skip'|'leave'} | {type:'allocate', id, choice?}
        | {type:'equip', uid, slot}
Event   = {k:'hit'|'crit'|'kill'|'cast'|'hurt'|'pickup'|'level'|'offer'|'telegraph'|'phase'|'drop'|'toll'
           |'gate'|'end', x, y, a, b, id}
```

`Defs.SCHEMA` in `01-defs.js` holds these shapes as data, and `Defs.finalize()` checks every definition against them at boot; each fault reads `kind id: field problem`. The check is stricter than the lines above in three ways:

- A field without `?` is required. An `Attack` carries all 17 of its fields, and a class exactly two callings.
- An object holds no field that its shape does not list. The exceptions are `fx`, `ambient` and `anim`, and the kinds tileset, curves, constants, trait and chartMod, which may carry more.
- Every id that names another definition must exist. This is not checked while the kind it points into has no definitions at all, which keeps a build without (say) its puppets valid: `debug.husk` names a puppet of its own id, and once any puppet is registered that one must be there too.

A registry of behaviour adds its words to the closed lists with `Defs.allow` (`Defs.allow('ai', 'burrower')`), and a system adds fields to a kind with `Defs.extend`; both only while files load.

## Rules

**A stat's value**

`V = clamp(set ?? (base + sum of flat) x max(0, 1 + sum of inc / 100) x product of (1 + more / 100), min, max)`

- A modifier applies when all of its tags are among the query's tags and its condition, if any, holds.
- All `inc` add together whatever their source. Each `more` multiplies on its own. Source order never matters. Of several `set` on one stat the lowest wins.
- A `per` modifier counts `min(cap, floor(count / div))` times. While the attributes themselves are worked out every attribute counts as 0, so one attribute cannot feed another.
- `gainAsExtra.<T>` is a family of stats, one for each type gained, and its modifiers carry `from`, the type the gain is taken from. `param.<key>` is a family too: a modifier of `param.count` changes the param `count` of the sigils its tags fit.
- Chimes and Carillon nodes may use only `flat`, `inc` and parameter changes. `more` is kept for bindings, capstones, callings and uniques. Chimes are capped near 30% of end-of-run damage. Tests enforce both.
- Hit tags for a damage type: the sigil's tags, tags added by bindings, the weapon family for attacks, the type, `hit`, and `elemental` for fire, cold and lightning.
- Damage-over-time tags: the type, `elemental` if it applies, `dot`, and the ailment. Attack, spell and projectile modifiers never scale it.
- Each point of Strength gives 2 life, Dexterity 3 evasion, Intelligence 2 hush.

**A hit, per damage type T**

```
base_T  = roll(sigil.damage[T]) + weapon.damage[T] x weaponPct/100 + sum(added.T) x eff
base_T += for each other type F: base_F x gainAsExtra[F to T]/100        (from original bases only)
hit_T   = base_T x (1 + sum inc/100) x product(1 + more/100)
crit      chance capped at 100; on a crit, hit_T x critMulti/100 (base 150); a crit always applies its ailments
rate      = sigil.rate x weapon attacks per second (attacks only) x V(speed)
```

**The defender, in order** (placeholder: the steps, the formulas and the ailment table after them will be replaced by the invented combat model in `docs/design/`; build the pipeline as an ordered list of small steps that is easy to swap)

1. Dodge roll: no damage.
2. Player only, evadable attacks: a running total gains `1 - min(0.75, EV / (EV + accuracy[level]))` per attack; the attack lands when the total reaches 1. This avoids streaks.
3. Physical: multiply by `1 - min(0.9, AR / (AR + 8 x hit))`.
4. Other types: multiply by `1 - (min(res, resMax) - pen) / 100`. `resMax` defaults to 75, hard cap 90.
5. Multiply by the defender's damage-taken modifiers.
6. Hush absorbs first, then life. Hush refills after `hushDelay` seconds without damage.

**Ailments** (`H` is the target's life times its threshold)

| Ailment | From | Rule |
|---|---|---|
| Ignite | fire hit | 30% of base fire a second for 4 s; strongest only |
| Bleed | physical attack hit | 25% of base physical a second for 5 s; strongest only |
| Poison | physical or void hit | 20% of base a second for 3 s; 8 stacks |
| Shock | lightning hit | target takes 5 to 40% more damage for 4 s, by hit size against `H` |
| Chill, freeze | cold hit | builds by hit size against `H`; slows 10 to 30%; at 100 frozen 1.5 s (boss 0.5 s, then immune 6 s) |
| Stun | physical hit, melee counts 1.5 times | same build-up; at 100 stunned 1 s (boss: one stagger a phase) |

The player can be ignited, chilled, shocked, bled or poisoned, never frozen or stunned.

**The vigil**

- A toll every 75 s raises the threat tier: more spawn budget, slightly higher enemy level, more reward.
- Elites about every 120 s. Mini-boss at toll 4. The district boss at toll 8.
- A gate opens for 25 s after each elite or boss kill and on every third toll. Standing in it for 3 s leaves the vigil.
- After the boss dies the district is cleared and the vigil continues. Past a high tier the danger rises fast enough that staying forever is not possible.
- Character XP is kept as it is earned. The haul is kept only on leaving. Echoes are kept either way.

