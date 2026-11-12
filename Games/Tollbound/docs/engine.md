# Tollbound engine notes

These are the contracts every module is written against: how files are shaped, what the simulation state looks like, the data shapes content is authored in, the rules of stats and harm, and, in "Stage 1 systems", what each file of the first vigil exports. The game itself is in `docs/design/`: the words, the districts and the art in `01-world.md`, the combat model and the engine's tables in `02-combat.md`, the classes in `03-classes.md` and progression in `04-progression.md`. `docs/plan.md` is the approved plan and is a snapshot; where it differs from this file, this file wins. Once a module exists, its code and its header comment win over this file, and whoever changes an interface updates this file in the same change.

## What is fixed and what is provisional

The owner's instruction of 2026-11-12: **all new fresh ideas, nothing from memory.** Every idea in the game is invented for this game. Nothing is recalled from another game, from genre stock, or from an earlier project. What is known of other games is used only to recognise and reject look-alikes.

Fixed, because the owner asked for it or approved it:

- The frame: horde-survival runs with self-casting skills and level-up picks; a character with a class, a subclass, levels, a large shared passive tree, socketable skills that take modifiers, and gear with random modifiers.
- One life per character. A permanent tree shared by all characters. Runs with no fixed end, left through gates. Two ways to play. The open world last.
- The bell-city world and the title. The 2.5D look. One HTML file.
- The machinery in this file: file shape, layers, determinism, pools, the modifier operations (`flat`, `inc`, `more`, `set`) with tags and conditions, definitions as plain data, behaviour named by id in closed registries.

**Decided by `docs/design/`.** The design team has invented what the first plan left as placeholders, and the engine now speaks it:

- The kinds of harm, the families, the attributes, what a `per` modifier counts, the conditions a body carries, the tags, the modifier conditions and the full list of stats are the rows of section 15 of `02-combat.md`, and they are the rows of `src/js/10-stats.js`.
- The steps of a hit on the dead, of a hit on the player and of the Drag ticks are sections 15.10 to 15.12 of `02-combat.md`; "Rules" below gives their formulas.
- The words of the game are those of `01-world.md` (the table under "Conventions"); the kinds of definition `voice`, `knot`, `observance`, `favour`, `bequest` and `cause`, the modes `household` and `watch-night`, the zone kinds and the input's `trade` and `heave` are named after them.

Still provisional, to be replaced as the later stages arrive:

- The shapes of the Plan, finds, the Bellframe and saves (Stage 2): until then the kinds `treeSkeleton`, `cluster`, `legacyNode`, `base`, `affix`, `unique` and `currency`, and `Save` and `Char` below, keep the first plan's shapes. `04-progression.md` gives what replaces them.
- The finer fields of a mode, and every number in the curves: to be tuned with the first vigil.
- Content lists (voices, knots, the dead, favours, observances), which come from the pool in `docs/design/pool/` in the forms its notes allow.

So that a change stays cheap, **code never hard-codes a row in its logic.** Kinds of harm, attributes, conditions and stats are rows in the tables of `10-stats.js`, and logic loops over the tables. A body stores the conditions it carries in three fixed-length arrays indexed by `Stats.AILMENT[id]`, the row of `Stats.AILMENTS` (`condT` for time left, `condV` for strength, `condN` for a spare number such as stacks; what each holds is in the row's comment and in section 7 of `02-combat.md`), sized `Stats.COND_MAX` (16, for 15 rows), not in named fields. The behaviour that runs a condition laid by a rule finds its row by its own id: `Stats.RULE.footing` is the row of `wrong-footed`. The conditions a modifier may ask for (`Cond` below) are a separate table, `Stats.CONDS`; a set of them is a number with the bits `Stats.COND[id]` set. Attributes are `Stats.PRIMARIES`, and requirements and `per` modifiers accept any of them.

The ids the rules themselves name, and nothing else: in `10-stats.js` the stats `damage`, `speed`, `taken`, `cond-duration` and `guard.all`, the tags `attack`, `hit` and `dot`, and the prefixes `guard.`, `guard-max.`, `through.`, `added.`, `chance.`, `flag.` and `param.`; in `20-sim.js` the stat `life-max`. A system names the rows of the conditions its own rule runs, and the modifier conditions it sets (`Stage 1 systems` lists them file by file).

## Conventions

**Language.** Plain JavaScript (ES2020), classic scripts, no dependencies, no build step beyond concatenation. Everything in `src/js` is joined into one `<script>` in the order `tools/modules.js` gives.

**File shape.** A file is one enclosed function that adds to its own namespace and to nothing else:

```js
// 10-stats.js: stat tables, modifier matching, sheets.
// Owns: Stats
// Public: Stats.sheet(mods, ctx), Stats.skillSheet(mods, voiceInst, sheet), Stats.query(mods, stat, tags, conds)
(function () {
  'use strict';
  Stats.sheet = function (mods, ctx) { /* ... */ };
})();
```

- Namespaces are the only top-level names. `00-core.js` declares the simulation ones, `50-platform.js` the presentation ones. No other file declares anything at top level.
  - Simulation: `Core Defs Stats Dmg Items Tree Char Progress Legacy SaveData Sim Player Buffs AI Enemies Skills Boss Director Offers Favours Bot World`
  - Presentation: `Plat Store Settings Input Sound Music Mesh Rigs Glyphs Ground Gfx Scene Vfx UI Hud Game`
- Nothing runs when a file loads except definitions and registrations. `99-boot.js` starts the game.
- No file reassigns a function another file defined. Modules extend each other through registries and through the per-step event queue. The registries that exist: `Defs.add`, `Defs.allow` and `Defs.extend` (content, word lists and fields of the schema), `Sim.field`, `Sim.state` and `Sim.source` (entity fields, a system's slot in the run state, modifiers for every sheet), `Gfx.register` (views), `UI.screen` (menus), `Plat.on` (the notices `90-game.js` and others post), `Settings.define` and `Settings.row` (settings and rows of the settings screen), `Sound.define` (sound effects as code recipes), `Music.define` (pieces of music) and `Rigs.register` (rigs). Planned for Stage 1, with their signatures under "Stage 1 systems": `Skills.archetype`, `AI.register`, `Player.rule` and `Director.event`.
- `Core.seal(list)` freezes every namespace at boot, before `Game.boot()`, so a late reassignment throws. State that changes therefore lives in a closure or inside an object the namespace holds; a namespace shows it through a getter defined while the file loads (`Game.S`, `Store.status`, `Gfx.active`).
- Each file starts with a comment that says what the file is, names the namespaces it adds to on an `Owns:` line (`Owns: A, B`, or `Owns: (none)`), and lists its public functions with their arguments. That comment is the interface, and `tools/lint.js` holds a file to its `Owns:` line.

**Layers.** `tools/lint.js` enforces them.

| Files | Layer | May use |
|---|---|---|
| `00` to `29` | simulation | other simulation namespaces only. No `window`, `document`, `navigator`, `performance`, `Date`, `Math.random`, timers or storage. |
| `30` to `49` | content | `Defs.add` only. Plain JSON-serializable data: no functions, no `undefined`, no references to other objects. |
| `50` to `99` | presentation | everything. Reads simulation state and the event queue; changes the simulation only through `Sim.step(S, input)` and `Sim.command(S, cmd)`. |

Files below 50 load in Node with nothing but `console`. That is how the simulation tests run, and it is what keeps the rules portable to another engine.

**Units and axes.** Metres, seconds, radians. The world is a flat ground plane: the simulation uses `(x, y)` on the ground, and the 3D view draws simulation `y` along its depth axis with height as a third value. In every view `+x` runs to the right of the screen and `+y` towards the viewer, down the screen, so an input of `my = -1` walks up the screen. No frame counts appear in data; durations are seconds. Sunwise is the direction of increasing angle on the ground, from `+x` towards `+y`.

**Determinism.** The simulation advances in fixed steps of 1/60 s. All randomness comes from seeded streams forked from the run seed (`S.rng.spawn`, `S.rng.loot`, `S.rng.combat`, `S.rng.offers`, `S.rng.world`). Presentation has its own unseeded stream for cosmetic effects and never feeds anything back. The same seed and the same inputs give the same `Sim.hash(S)`: `tests/sim/determinism.test.js` holds every module below 50 to that in Node, and `tests/scenarios/20-play.js` makes the built page replay a run that Node has played, checksum for checksum. A module keeps nothing from one run to the next: a scratch array or variable it holds for itself carries nothing over from one call to another, so two runs stepped in turn do not disturb each other. A system's state between steps lives in the run: in a slot made with `Sim.state`, or in fields declared with `Sim.field`.

**Speed.** The simulation step runs with hundreds of entities, so hot loops allocate nothing:

- Entities live in `Core.Pool`s of fixed-shape objects and are removed by swap, only in the deaths phase of the step.
- Neighbour queries go through `Core.Grid` and write into a caller-supplied array. In a loop over entities use `grid.near(body, margin, out)`: it hands no numbers across a call and allocates nothing.
- No closures, array literals, object literals, `map`/`filter`/`forEach` or string building inside per-entity loops.
- Hard caps, from the constants `main` (`S.rules.caps`): 600 enemies, 500 projectiles, 120 areas, 400 pickups, 40 minions, and 2048 events in one step. `pool.alloc()` gives `null` when a pool is full. When a cap is hit, the oldest or weakest is merged or dropped, never an error.
- Budget, checked by `tests/bench.js` at the end of `npm run test:full`: a step of `Sim.debugScene(600)` takes at most 1.5 ms on average. Every system that exists runs in it (a debug scene sets aside only the director, the enemies and the keeper).

**Text.** Display text lives only in `name`, `text` and `flavour` fields, plain, with `{0}` placeholders. Ids are lower-case with dots or dashes and never shown. Nothing the player must read in a fight is text (`02-combat.md`, section 13).

**Original names.** The game's words are those of `docs/design/01-world.md`, which says why each was chosen; the engine's ids follow them, in lower case joined by dashes. `docs/design/denylist.txt` lists names that must not appear anywhere in ids or text; `tools/lint.js` checks it over `src/`.

| Word | What it is | In the engine |
|---|---|---|
| vigil | one run in one district | a run, `S` |
| toll | the stroke every 75 seconds that raises danger and reward | `S.toll`, the event `'toll'` |
| keeper | the great dead of a district, who comes at the eighth toll | rank `Sim.BOSS`, the kind `boss`, `S.boss` |
| the dead | every enemy | the kind `enemy`, `S.enemies` |
| voice | an active skill; it speaks by itself | the kind `voice`; a voice in its place is a slot of `S.skills` |
| knot | a modifier tied into a voice | the kind `knot`; `VoiceInst.knots` |
| rope | a voice's places for knots, two to five | `VoiceInst.rope` |
| trade | the first button: the class's own act | `InputFrame.trade`, button A, `Class.trade` |
| heave | the second button: a find thrown overboard | `InputFrame.heave`, button B |
| Blow, Drag, Swell | harm that lands at once; harm counted four times a second; a great strike drawn on the ground | the kinds of harm `blow`, `drag`, `swell` |
| Brace, Stride, Lee | the guards: standing still, running hard, cover from the source | `guard.blow`, `guard.drag`; `Dmg.inLee` |
| Wrong-footed | having just turned sharply; takes half as much again | the condition `wrong-footed` |
| wake, train | your path of the last five seconds; the dead walking it | `S.wake`; the condition `in-procession` |
| wound, mend, scar | life lost lying where it was lost; taking it back by standing on it; what an unmended wound leaves | `S.wounds`; the events `'wound'`, `'mend'`, `'scar'` |
| Heed | the pool observances hold; free Heed shows Swells sooner | the stat `heed-max`; `Dmg.warning` |
| observance | a lasting effect that holds Heed while its promise is kept | the kind `observance` |
| favour, the row | a temporary upgrade taken at a run level; the six favours standing in a visible line | the kind `favour`; `S.favours`, `S.row` |
| calling, peal | a subclass; a vigil kept to one rule, which earns calling points | the kind `calling`; the zone kind `peal` |
| find, notch, haul | an item; a line a toll writes on a find you carry; the finds and coin you carry unbanked | `S.haul`, `S.coin` (finds and notches: Stage 2) |
| ember, coin | experience the dead leave on the ground; the Household's money | pickups of kind 0 and 1; `S.coin` |
| lychgate, ringing down | the way out of a vigil; leaving through it one stroke at a time | `S.gate` (the id is `gate`), `S.gate.ring`; the events `'gate'` and `'stroke'` |
| Tolled-for | the state at no life | the condition `tolled-for`; the outcome `'spared'` |
| bell-post, landmark | the post at the centre of each district; one of its six places that pay Hum | prop roles `bell-post`, `landmark` |
| the Plan; door, lane, corner, square, milestone | the tree shared by all classes, and its kinds of node | Stage 2 (the kinds `treeSkeleton` and `cluster` until then) |
| the Bellframe, Hum, the Register | the permanent tree shared by every character; its currency; what killed each character | `S.hum`; the rest Stage 2 (the kind `legacyNode` until then) |
| Bill, cause, bequest | an endgame district with causes added; one danger written on it; a quest-like goal | the zone kind `bill`; the kinds `cause`, `bequest` |
| the Household, the Watch-night | standing characters kept until they die; a one-sitting run through five districts | the modes `household`, `watch-night` |
| the Lantern | the hub | Stage 2 |
| flood, ebb, slack, spring; dry, ankle, knee, waist | the tide's states; the bands of water at a body's feet | from the Ropewalk |

The engine keeps a few plain words of its own that players never see: enemy, boss (the keeper's machinery), gate (the lychgate's id), skill (a voice in its place), offer (a choice that pauses the run; none does yet). The first plan's words have no successor where the design has no such thing: there is no shield, no healing drink, no dodge, no critical strike, no evasion and no resistance.

Modifier operations are shown to players as `+12` (flat), `+12%` (inc) and `x1.20` (more).

## Run state

`Sim.create(cfg)` returns the run state `S`. It is plain data plus pools and grids. Presentation reads it and never writes it. These are the fields as `20-sim.js` makes them; its header comment says more about each.

```js
cfg = {mode, zone, seed, char, account}       // seed: a number or a string. mode defaults to 'household'.
                                              // char is a deep copy; the run changes the copy, the game writes it back
      // a run without a character (tests, debug scenes, the first vigil) may carry instead:
      //   mods: [Mod], voices: [VoiceInst|null], level, class (the class id whose rule and trade the player has),
      //   weapon: {family, damage, aps} (no tool is a weapon: always left out in the game)
      // and any run may carry rules: {name: number}, which overrule S.rules.
      // Player.classRun(classId, level) gives {class, level, mods, voices} for such a run.

S = {
  cfg, mode, zone,                            // the cfg as given (never copied), and the defs of its mode and zone
  rules,                                      // the constants 'main', overruled by the zone's tollSeconds, keeperToll
                                              // and gateEvery, by zone.rules and by cfg.rules. rules.caps holds the caps.
  curves,                                     // the curves 'main'
  rng: {spawn, loot, combat, offers, world},  // Core.RNG streams forked from the seed
  step, t,                                    // steps done; seconds = step / 60
  toll, tollAt, tollSteps,                    // tolls rung; the step at which the next one rings; steps between two
  threat,                                     // threat tier: starts at 0, and the director keeps it
  phase: 'play'|'offer'|'ended',              // favours are walked into, so nothing in the first vigil pauses
  player,                                     // one sealed object; see "Entities"
  mods, sheet,                                // the modifier list of the last rebuild, and the Sheet made from it
  skills: [{inst, sheet, cd, t, n, target, a0, a1, a2, a3}],
                                              // one slot for each place of the loadout, in its order, and no slot ever
                                              // moves: an empty place has inst and sheet null. cd is seconds until the
                                              // next cast; the rest is room for the archetype's state.
  enemies, shots, areas, pickups, minions,    // Core.Pool; see "Entities"
  grid,                                       // Core.Grid over enemies, rebuilt once in every step
  region, props,                              // the ground from World.region: {x, y, radius, startX, startY, props, grid},
                                              // and its props [{id, x, y, r, light, role}]: colliders, lights, roles
  gate: null|{x, y, until, far, ring, strokes},   // the open lychgate; see "Stage 1 systems"
  boss: null|enemy,                           // the keeper; set to null when that enemy is removed
  offer: null|Offer, offerQueue: [],          // an offer that pauses the run, and those waiting behind it
  favours: {[favourId]: times}, buffs: [],    // the favours taken this vigil; a list the buff system keeps
  events, eventCount, eventStart, eventsDropped,   // see "Events" below
  haul: [], coin, bank: {coin, finds: []},    // finds and coin carried (lost at death); what ringing down banked
  hum, kills, counters: {},                   // Hum heard this vigil; kills is counted in the deaths phase of the step
  dirty,                                      // set it to true when modifiers, the loadout, a count of a per modifier
                                              // or player.conds changed: the sheets are rebuilt in the same step, or at
                                              // once after a command
  result: null|{outcome:'left'|'spared'|'died', mode, zone, seed, steps, time, tolls, threat, kills, coin, banked, hum,
                runLevel, haul /* how many finds */, eventsDropped},
  uid,                                        // the last uid given out
  debug: null|{x, y}                          // the centre of Sim.debugScene; null in a real run
  // plus one field for each Sim.state(name, make) a system declared while its file loaded: S[name] = make(S)
}

Offer = {kind:'node'|'reward', source, options:[{id, kind, name, text, icon}], rerolls, banishes, skips}
```

While `S.phase` is `'offer'` the clock does not advance and `Sim.step` does nothing and returns `false` until `Sim.command(S, {type:'pick', ...})` resolves the offer. This is what lets `Game.sim(seconds, {bot: true})` play through an offer without any menu. Favours never pause the run: they rise as shapes in the world and are walked into (see "Stage 1 systems"). Until an `Offers` system exists, `pick` and `skip` only close an offer. A step that began in `'play'` runs to its end even if the run ends or an offer opens on the way.

The outcomes: `'left'`, the player rang down at a lychgate (what was banked is kept); `'spared'`, the player reached a lychgate while Tolled-for (the character lives and the whole haul is lost: the director empties `S.haul` and `S.coin` before it ends the run); `'died'`.

**Events.** `S.events` is a ring of `S.rules.caps.events` reused objects `{k, x, y, a, b, id}`, not a list that grows. It holds what the last step that ran, or the last command, emitted: both empty it first, so read it after each call (in the page: in a listener of the notice `'step'` or `'command'`, since one frame may hold several steps). Event `i` of `S.eventCount` is `S.events[(S.eventStart + i) % S.events.length]`. `S.eventStart` is 0 unless more events were emitted than the ring holds; then the oldest were overwritten and `S.eventsDropped` counts them. What `a`, `b` and `id` mean is up to the emitter; "Stage 1 systems" lists every event with its emitter. The kernel's own: `'kill'` has `a` = rank, `b` = level, `id` = the enemy def's id; `'toll'` has `a` = `S.toll`; `'end'` has `a` = tolls, `b` = kills, `id` = the outcome.

**Sheets.** `Sim.rebuild(S)` gathers the modifiers: `Char.mods(cfg.char, S, cfg.account)` if the run has a character and that function exists, else `cfg.mods`; then whatever each `Sim.source(fn)` adds (favours, buffs, scars). `Stats.sheet` gets them with the level, the weapon, the counts of a `per` modifier (observances: `char.observances.length`; favours: the times in `S.favours`; finds: `S.haul.length`; debts: `S.player.debts`, a field the Surety's file declares, else 0) and `S.player.conds`. Then `S.skills` is made to follow the loadout and every slot gets its skill sheet. A rebuild is not cheap (about half a millisecond with 400 modifiers and six voices), so set `S.dirty` when something changed, not in every step.

`InputFrame`: `mx, my` is the move vector with length at most 1. `ax, ay` is a unit aim vector, used only when `aim` is true; otherwise each voice picks its own target. `trade` (button A) and `heave` (button B) are true only on the step they are pressed: the game samples the input once for each step, not once a frame. `Sim.NO_INPUT` is the frame of a player who does nothing, and what `Sim.step(S)` uses when it is given none.

## Entities

Every pooled object has one fixed set of fields and is sealed, so a field that was not declared cannot be added by mistake. `pool.alloc()` gives one with every field at its default, `alive = true` and a new `uid`, or `null` when the pool is full. A file that needs another field declares it while it loads, with `Sim.field(kind, name, value)`: the default is a number, a boolean, a string or `null`, and the kinds are `enemy`, `minion`, `shot`, `area`, `pickup`, `player` and `skill`. Only files numbered above `20` can do so, because `20-sim.js` has not run when the earlier ones load: the fields `11-damage.js` needs are declared by `21-player.js` (see "Stage 1 systems"). `Sim.fields(kind)` lists the fields of a kind, built in and added.

| Kind | Built-in fields, in order |
|---|---|
| every pooled entity | `alive, uid, x, y, px, py, vx, vy, r, face, t, state, stateT, a0, a1, a2, a3` |
| enemy and minion add | `def, defHash, level, life, lifeMax, damage, speed, cd0, cd1, cd2, cd3, kx, ky, tx, ty, target, flash, condT, condV, condN` |
| enemy adds | `rank, xp, traitN, traits` |
| minion adds | `skill, ttl` |
| shot adds | `def, team, owner, skill, ttl, damage, dist, pierce, chain, fork, tx, ty, target, hitN, hits` |
| area adds | `def, team, owner, skill, ttl, damage, tick, angle, len, target` |
| pickup adds | `kind, value, ttl, item` |
| player | `alive, uid, x, y, px, py, vx, vy, r, face, aimX, aimY, life, runLevel, runXp, kx, ky, state, stateT, conds, hurtT, killT, flash, condT, condV, condN, a0, a1, a2, a3` |
| skill | `inst, sheet, cd, t, n, target, a0, a1, a2, a3` |

- `x, y` is the place and `px, py` the place before the last step. A view draws a thing at `px + (x - px) * alpha`, with the `alpha` of `Scene.draw(S, alpha)`. Something made during a step has its own place in `px, py`.
- `r` is the radius, `face` a direction in radians. `vx, vy` is a body's steering velocity: how it means to move, which its posture is worked out from; shoves, knockback (`kx, ky`) and separation are not movement. `t`, `state`, `stateT` and `a0` to `a3` are free for the system that owns the entity.
- `def` is the definition (for a shot or an area, the enemy `Attack` it came from, or `null`), `defHash` the hash of its id. `speed` is a body's top speed on dry ground, from its def. `cd0` to `cd3` are attack cooldowns, `kx, ky` knockback speed, `tx, ty` a point it heads for, `target` a uid.
- `condT`, `condV` and `condN` are `Float64Array(Stats.COND_MAX)`, indexed by `Stats.AILMENT[id]`: what each holds is in the comment beside each row of `Stats.AILMENTS`.
- `rank` is `Sim.COMMON` (0), `Sim.ELITE`, `Sim.MINIBOSS` or `Sim.BOSS` (3, a keeper). `traits` has 4 slots of trait defs or `null`, and `traitN` says how many are filled. A body is **large** when its def's `size` is `'large'` or its rank is `Sim.ELITE` or above (large bodies give lee); otherwise it is small.
- `team` is 0 for the player's side and 1 for the enemies'. `owner` is a uid, 0 for the player. `skill` is an index into `S.skills`, or -1. `hits` is an `Int32Array(8)` of uids hit lately, and `hitN` counts how many were written.
- Shots, areas and pickups lose 1/60 s of `ttl` in every step and are removed when none is left: whoever makes one gives it a `ttl` in seconds, or it is gone in the same step. An enemy or a minion is removed when its `life` is 0 or less (a minion's `ttl` is free for its own system). `pool.kill(o)` removes without a kill, an event or a drop.
- The player has `uid` 0. `conds` is a mask of the modifier conditions that hold for the player (`Stats.condMask`); `21-player.js` keeps it.
- Entities are reused: keep a `uid`, never the object, from one step to the next. A loop over `pool.items[0 .. pool.n)` skips what is not `alive`: the dead keep their place until the deaths phase compacts the pool.

## Modules

`tools/modules.js` is the single source of file order for the build, the lint, the Node loader and the export. Nothing runs at load time before `99-boot`. The files in bold exist: their rows give the real signatures, and each file's header comment says the rest. The files of the first vigil are under "Stage 1 systems"; the other rows are the plan.

| File | Layer | Responsibility | Key exports |
|---|---|---|---|
| **`00-core`** | sim | namespaces, maths, hash, RNG | `Core.HZ`, `Core.DT`, `Core.TAU`; `Core.clamp(v, lo, hi)`, `lerp(a, b, t)`, `sign(v)`, `mod(a, n)`, `approach(v, target, step)`, `dist2(ax, ay, bx, by)`, `dist(ax, ay, bx, by)`, `angleWrap(a)`, `angleDiff(from, to)`, `angleToward(a, target, step)`; `Core.hashStr(text)`, `Core.hashMix(h, number)`; `new Core.RNG(seed)`: `next()`, `u32()`, `range(a, b)`, `int(a, b)`, `chance(p)`, `pick(array, n?)`, `weighted(items, key?, n?)`, `shuffle(array, n?)`, `fork(label)`, `getState()`, `setState(state)`, `hash(h)`; `Core.assert(cond, message)`, `Core.deepFreeze(obj)`, `Core.seal(list)` |
| **`01-defs`** | sim | registries, schemas, validation, freeze | `Defs.KINDS`, `Defs.add(kind, def) -> def`, `Defs.get(kind, id)` (throws when there is none), `Defs.has(kind, id)`, `Defs.all(kind) -> [def]`, `Defs.SCHEMA`, `Defs.SHAPES`, `Defs.ENUMS`, `Defs.allow(name, word, ...)`, `Defs.extend(kind, fields)`, `Defs.finalize() -> [error]` |
| **`02-pool-grid`** | sim | fixed-shape pools, spatial grid | `new Core.Pool(make, cap, reset?)`: `items`, `n`, `cap`, `moves`, `alloc()` (an object, or `null` when full), `kill(o)`, `compact() -> removed`, `clear()`; `new Core.Grid(cell)`: `rebuild(pool)`, `query(x, y, r, out) -> n`, `near(body, margin, out) -> n` |
| **`10-stats`** | sim | the tables of section 15 of `02-combat.md`; sheets | the tables `Stats.TYPES`, `TYPE`, `FAMILIES`, `PRIMARIES`, `PER`, `AILMENTS`, `AILMENT`, `RULE`, `COND_MAX`, `TAGS`, `CONDS`, `COND`, `STATS`, `WANTS`, `LEVEL_MAX`; `Stats.stat(id)`, `Stats.is(table, id)`, `Stats.condMask(conds)`, `Stats.scaled(value, level)`, `Stats.resolve(mods, level, out?)`, `Stats.share(have, want)`, `Stats.query(mods, stat, tags?, conds?, primaries?)`, `Stats.queryRange(mods, stat, tags, conds, primaries, out)`, `Stats.sheet(mods, ctx) -> Sheet`, `Stats.skillSheet(mods, voiceInst, sheet) -> SkillSheet`, `Stats.hitMult(skillSheet, kindIndex, conds)`, `Stats.fits(voiceDef, knotDef)` |
| `11-damage` | sim | hits, guards, the lee test, conditions, posture of the dead, Drag ticks | see "Stage 1 systems" |
| `12-items` | sim | finds: lines written at tolls, chisel, re-walk, recast, cut | Stage 2 |
| `13-tree` | sim | the Plan: one route, doubling, beaten bounds, toll rings, banks, straight miles | Stage 2 |
| `14-character` | sim | character operations, modifier collection, the share rule for finds | `Char.create(classId, name)`, `Char.mods(char, run, account)`, `Char.weapon(char)` (always `null`: no tool is a weapon), `Char.allocate(char, id, choice)`, `Char.equip(char, uid, slot)`; Stage 2 |
| `15-progress` | sim | bequests, unlocks, Bills, peals, Hum and the Bellframe | Stage 2 |
| `16-savedata` | sim | save schema, migrations, text codec | `SaveData.blank()`, `migrate(raw)`, `validate(raw)`, `encode(save)`, `decode(text)`; Stage 2 |
| **`20-sim`** | sim | run state, step order, commands, events, entity fields | `Sim.create(cfg) -> S`, `Sim.step(S, input?) -> boolean`, `Sim.command(S, cmd) -> boolean`, `Sim.emit(S, k, x, y, a, b, id)`, `Sim.spawnEnemy(S, id, x, y, opts?)` (an enemy, or `null` when the pool is full; opts `{level, rank, traits}`; the id may be a keeper), `Sim.rebuild(S) -> Sheet`, `Sim.end(S, outcome) -> result`, `Sim.result(S)`, `Sim.hash(S) -> uint32`, `Sim.debugScene(n, seed = 1) -> S`, `Sim.field(kind, name, value)`, `Sim.fields(kind)`, `Sim.state(name, make)`, `Sim.source(fn)`, `Sim.COMMON`, `Sim.ELITE`, `Sim.MINIBOSS`, `Sim.BOSS`, `Sim.NO_INPUT` |
| `21-player` | sim | the player: movement, posture, the turn rule, the class rule and trade, the heave, wounds and mending, pickups, run levels | see "Stage 1 systems" |
| `22-enemies` | sim | the wake; the dead's steering, separation, attacks and rules (procession, mourning, riders) | see "Stage 1 systems" |
| `23-skills`, `24-archetypes` | sim | voices speaking, the pull; the archetypes `ring`, `rap`, `bar`, `spark`, `cone` | see "Stage 1 systems" |
| `25-boss` | sim | the keepers' phases | see "Stage 1 systems" |
| `26-director` | sim | tolls' effects, the count, spawns, elites, lychgates, ringing down, Tolled-for's lychgate, drops, district rules | see "Stage 1 systems" |
| `27-favours` | sim | the row and its walk-in offers | see "Stage 1 systems" |
| `28-bot` | sim | scripted players | see "Stage 1 systems" |
| **`29-world`** | sim | seeded regions, authored and scattered props, roles, obstacles | `World.region(seed, zoneDef, x?, y?) -> {x, y, radius, startX, startY, props, grid}`, `World.propsNear(S, x, y, r, out) -> count`, `World.withRole(S, role, out) -> count`, `World.pushOut(S, ent) -> boolean`, `World.CLEAR`, `World.GAP`. The ground's height, the tide, depth, bands, currents and fresh water (`02-combat.md`, section 15.13) arrive with the Ropewalk; until then every place is dry. |
| **`30-modes-curves`** | content | the two modes, the level curves, the constants of a run, the debug zone | modes `household` and `watch-night`; curves `main` (for levels 1 to 70: `enemyLife`, `enemyDamage`, `enemyXp`, `charXp`, `nightXp`, `runXp`; and `rank[0..3]`); constants `main` (`spawnRadius`, `despawnRadius`, `tollSeconds`, `keeperToll`, `gateEvery`, `gateOpenSeconds`, `gateRadius`, `ringStrokes`, `strokeSeconds`, `backSeconds`, `caps`, `gridCell`, `playerRadius`); zone `debug`; enemy `debug.husk` |
| `31` to `49` | content | one file per class with its voices; the dead, keeper and favours of each district; puppets, props and tilesets; later the Plan, finds, observances, the Bellframe | `Defs.add(...)` only; the files of the first vigil are under "Stage 1 systems" |
| **`48-puppets-test`**, **`49-tilesets-test`** | content | test figures, props and grounds for the views and their tests | `Defs.add(...)` only |
| **`50-platform`** | presentation | namespaces, the browser as the game sees it, the notice board, storage adapter | `Plat.query(name)`, `Plat.isTouch`, `Plat.dpr()`, `Plat.now()`, `Plat.loop(fn)`, `Plat.stop()`, `Plat.onVisibility(fn) -> off`, `Plat.onResize(fn) -> off`, `Plat.on(name, fn) -> off`, `Plat.emit(name, a, b, c)`; `Store.read(key)` (a promise of an object or `null`), `Store.write(key, obj)` and `Store.remove(key)` (promises of a boolean), `Store.status` (`'saved'`, `'memory'` or `'error'`), `Store.onStatus(fn) -> off` |
| **`51-settings`** | presentation | the player's settings, stored; the settings screen | `Settings.define(key, spec)` (spec `{value, label, group, order}`, plus `min, max, step, format, live` for a number or `options [{value, label}]` for a choice; a boolean value makes a switch), `Settings.get(key)`, `Settings.set(key, value) -> value held`, `Settings.on(key \| 'group.*' \| '*', fn(value, key)) -> off`, `Settings.row(id, order, build(back))`, `Settings.open() -> element \| null`, `Settings.keys()`, `Settings.reset()`, `Settings.loaded` |
| **`52-input`** | presentation | keyboard, mouse, gamepad and touch into one frame a step; the touch stick and buttons | `Input.sample() -> InputFrame` (one live object, refilled; only `90-game` calls it), `Input.FIELDS` (button A is the frame's `trade`, button B its `heave`), `Input.button('A' \| 'B', {icon, cooldown, charges, hidden, label})`, `Input.onPause(fn(device)) -> off`, `Input.buzz(ms) -> boolean`, `Input.device` |
| **`53-sound`** | presentation | sound effects from code recipes: per-effect gap, voice cap and priority; 32 voices (24 on touch); panning by screen place; suspended when hidden; offline rendering | `Sound.define(id, recipe, limits)`, `Sound.has(id)`, `Sound.list()`, `Sound.info(id)`, `Sound.sfx(id, {x, y, level, pitch, key, wet}) -> handle`, `Sound.stop(handle, fade)`, `Sound.stopAll(fade)`, `Sound.render(id \| recipe, opts, seconds)`, `Sound.bake(...)`, `Sound.suspend()`, `Sound.resume()`, `Sound.state`, `Sound.bus(name)`, `Sound.stats(id?)`; recipe helpers `env, tone, noise, bell, replay, click, creak, crackle, water, note, rand, vary` |
| **`54-music`** | presentation | music scheduled ahead from the frame loop; change-ringing rows | `Music.define(id, piece)`, `Music.has(id)`, `Music.list()`, `Music.play(id, {fade, intensity})`, `Music.stop({fade})`, `Music.intensity(v, glide)`, `Music.tick()`, `Music.toll(opts)`, `Music.changes(n, method, rows)` |
| **`55-sound-core`** | presentation | the first effects, and what plays them: the run's events, ringing down, the menus | adds to no namespace: `Sound.define` calls and listeners only |
| **`60-mesh`** | presentation | the five unit shapes as flat-shaded meshes; matrix helpers that allocate nothing | `Mesh.SHAPES`, `Mesh.FLOATS`, `Mesh.shape(id \| name) -> {name, data, count}`; 4x4: `mat4()`, `identity`, `multiply`, `invert`, `perspective`, `ortho`, `view`, `apply`; 3x4 part matrices: `part(out, o, x, y, z, sx, sy, sz, yaw, pitch, roll)` (a simulation facing a is yaw -a), `chain(out, o, a, ao, b, bo)` |
| **`61-rigs`** | presentation | rigs that pose a puppet's parts straight into the part buffers: walk by distance covered, wind-up, blow, flinch, fall and sink | `Rigs.register(name, rig)` (rig `{joints, core, anim, prepare?, stride?, pose(fig, st, P)}`), `Rigs.figure(puppetId) -> fig \| null`, `Rigs.state()`, `Rigs.advance(fig, st, metres)`, `Rigs.sink(cap)`, `Rigs.clear(out)`, `Rigs.draw(fig, st, out) -> parts written`, `Rigs.joints(name)`, `Rigs.names()`, `Rigs.NONE`, `WINDUP`, `STRIKE`, `CAST`; rigs `biped`, `quadruped`, `floater`, `crawler`, `winged`, `serpent`, `static` |
| `62-glyphs` | presentation | icon painter | `Glyphs.icon(spec) -> canvas`; Stage 1, the screens' package |
| **`63-ground`** | presentation | seamless ground textures painted by code from a seeded generator | `Ground.texture(id) -> canvas` (512x512, cached), `Ground.span(id) -> metres`, `Ground.color(id, out?)`, `Ground.pixels(id)`, `Ground.recipe(name, spec)`, `Ground.recipes()`, `Ground.SIZE`, `Ground.DEFAULT`; recipes `flags`, `cobbles`, `silt` |
| **`65-gfx`** | presentation | the list of views; the instance records all views share; world to screen | `Gfx.register(name, factory, isSupported)`, `Gfx.backends`, `Gfx.create(canvas, prefer) -> backend`, `Gfx.active`, `Gfx.worldToScreen(x, y, z?, out?)`, `Gfx.screenToWorld(sx, sy, out?)`, `Gfx.DISC_STRIDE`, `Gfx.DECAL_STRIDE`, `Gfx.BILLBOARD_STRIDE` |
| **`66-gfx-gl`** | presentation | the 3D view (see the renderer contract) | registers the view `'gl'`; adds `Gfx.SHAPES`, `Gfx.PART_STRIDE`, `Gfx.LIGHT_STRIDE` |
| **`67-gfx-2d`** | presentation | the compatibility view: discs on the ground seen from above | registers the view `'2d'` |
| **`68-scene`** | presentation | the run into instance buffers: the camera, culling, figures through the rigs, decals, billboards, lights; budgets of 10 000 parts and 32 lights | `Scene.draw(S, alpha)`, `Scene.camera`, `Scene.look(look \| null)`, `Scene.quality(level?)`, `Scene.limits`, `Scene.stats`, `Scene.buffers()`, `Scene.decal(buffer, n, x, y, radius, r, g, b, a, fill, shape, angle, arc) -> n + 1`, `Scene.DISC`, `RING`, `SECTOR`, `BAR`, `Scene.BAR_STRIDE`, `Scene.ATTACK` |
| **`69-vfx`** | presentation | pooled particles (1500; 400 at 'low'), harm numbers merged per target, life bars on the overlay canvas, shake and flash from the settings | `Vfx.consume(S)` (it also listens to live 'step' and 'command' itself), `Vfx.update`, `Vfx.harm(uid, x, y, z, amount, kind)` (kind 0 harm to one of the dead, 1 harm to the player), `Vfx.burst`, `Vfx.billboards`, `Vfx.decals`, `Vfx.offset`, `Vfx.post`, `Vfx.overlay(bars, count)`, `Vfx.clear`, `Vfx.quality`; `Vfx.shake`, `Vfx.flash`, `Vfx.numbers` read `fx.*` from Settings |
| **`70-ui-core`** | presentation | element builder, screen stack, confirm dialog, toasts, focus by keys and pad | `UI.h(tag, attrs, ...children)`, `UI.button(label, onClick, attrs)`, `UI.screen(id, {open, close, pause, back, scrim})`, `UI.has(id)`, `UI.isOpen(id)`, `UI.open(id, args)`, `UI.close(id?)`, `UI.replace(id, args)`, `UI.clear()`, `UI.top()`, `UI.pausing()`, `UI.confirm(text, {yes, no})` (a promise of a boolean), `UI.toast(text, ms)`, `UI.nav(dx, dy)`, `UI.activate()`, `UI.back()`, `UI.setKeys(on)` |
| `71-hud` | presentation | the HUD of a vigil | see "Stage 1 systems" |
| `72` to `77` | presentation | the title and results; later the Lantern, finds, the Plan, voices and knots, the Bellframe, bequests, the memorial, onboarding | screens registered with `UI.screen` |
| **`90-game`** | presentation | the states title, run and results; the frame loop with its 60 Hz steps (at most 4 a frame), paused when hidden; stand-in title, results and picture | `Game.boot()`, `Game.start(cfg)` (the run, or `null`), `Game.title()`, `Game.command(cmd) -> boolean`, `Game.sim(seconds, {bot, policy}) -> steps`, `Game.S`, `Game.state`, `Game.debug`, `Game.VERSION` |
| **`99-boot`** | presentation | collects the namespaces; finalize, seal, boot | `window.TB`: every namespace, and `TB.ready` |

**The order of a step**, set in `Sim.step` and nowhere else. Other namespaces are called only if they exist.

```
 0  the event queue is emptied; px, py of the player and of every entity take its x, y
 1  Player.step(S, input)              the player moves; its posture, the turn rule, its conditions' mask, the trade
 2  Director.step(S)                   spawns, the toll's effects and the count, lychgates and ringing down
 3  S.grid.rebuild(S.enemies)          so the grid does not know enemies spawned later in the step
 4  Enemies.step(S)                    the wake is noted; the dead steer, and their attacks wind up and land
 5  Dmg.step(S)                        every body's condition times run down; the dead's postures and the turn rule
 6  Skills.step(S)                     casting, then shots, areas, minions and their hits
 7  Boss.step(S)
 8  Dmg.tick(S)                        every 15th step: Drag, 4 times a second
 9  deaths                             an enemy at no life: S.kills + 1, a 'kill' event, Director.onKill(S, enemy), removal.
                                       Minions at no life, and shots, areas and pickups out of ttl, are removed.
                                       Pools are compacted here and only here.
10  Player.pickups(S)                  embers, coin and finds; run levels
11  Favours.step(S)                    the row; walk-in favours rise, are taken, sink
12  Sim.rebuild(S), if S.dirty
13  Offers.step(S)
14  the clock: S.step, S.t, and on time S.toll + 1 with a 'toll' event
```

In a debug scene (`Sim.debugScene`, `S.debug` not null) steps 2, 4 and 7 give way to the scene's own rule: every husk walks a ring round the spot where the player began. Without `Player.step`, the move vector of the input walks the player there at 5 m/s.

**What is called if it exists.** The kernel and the game are written against systems that come later, and ask with `typeof` before each call. These are the signatures they use; whoever writes the system keeps to them, or changes the caller in the same change.

- `Sim.step`: the hooks of the list above.
- `Sim.command`: `Offers.resolve(S, cmd)` for `pick`, `banish`, `reroll` and `skip`; `Char.allocate(char, id, choice)` and `Char.equip(char, uid, slot)`. Each counts as done unless it returns `false`.
- `Sim.rebuild`: `Char.mods(char, S, account) -> [Mod]` and `Char.weapon(char)` (a weapon profile `{family, damage, aps}`, or `null`: always `null` in the game).
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
| `'device'` | `name` | posted by `52-input`: the player switched to `'keys'`, `'mouse'`, `'pad'` or `'touch'` |
| `'quality'` | `level` | posted by `66-gfx-gl` when it stepped itself down after slow frames |
| `'ui'` | `what, id` | posted by `70-ui-core`: `'move'` (focus moved), `'press'` (a control was activated), `'open'`, `'close'` or `'back'`; `id` is the screen's id, or `null` |

What `55-sound-core` reads from the events: `'hit'`, `'kill'` (`a` = rank), `'hurt'`, `'mend'`, `'scar'`, `'pickup'` (`a` = kind, `b` = value: a big pickup when `a` is not 0 or `b` is 10 or more), `'favour'`, `'level'`, `'offer'`, `'count'` (`a` strokes, `b` elites, `id` `'gate'` for the low stroke), `'toll'`, `'gate'` at the place a lychgate opened, and `'telegraph'` at the place an attack will land. It plays ringing down while `S.gate.ring` grows. `69-vfx` reads the same and `'cast'`, `'wound'`, `'pull'`, `'trade'`, `'heave'`, `'drop'`, `'phase'` and `'stroke'`; `68-scene` reads `'cast'`. An emitter that gives these fields another meaning changes those files in the same change.

The screens `'title'` and `'results'` of `90-game` are stand-ins, registered at boot only if no other file has registered those ids. `'results'` is opened with `{S, result}`. `Scene.draw` is called only while there is a run; on the title the game draws the empty ground itself.

**The renderer contract** shared by both views. A view's file registers it while it loads; `65-gfx` holds the list and the records.

```
Gfx.register(name, factory, isSupported)   factory(canvas) -> b; isSupported() -> boolean
Gfx.create(canvas, 'gl'|'2d') -> b         the view asked for, else the next that starts, '2d' last. Use b.canvas from then on.
b.name   b.canvas   b.caps {puppets, shadows, lights, bloom, maxInstances}   b.stats {drawCalls, instances}
b.resize(cssW, cssH, dpr)   b.quality('high'|'medium'|'low') -> level   b.quality() -> the level now
b.begin(cam {x, y, zoom}, env {ambient, sun:{dir, color}, fog:{color, near, far}, ground:[r, g, b] | tilesetId} | null)
b.parts(shape, buffer, count)       solid instances of one shape (an index of Gfx.SHAPES): Gfx.PART_STRIDE floats each
b.decals(buffer, count)             flat on the ground: telegraphs, scorch, pickup glow
b.billboards(buffer, count)         facing the camera: particles, bolts (alpha or additive)
b.discs(buffer, count)              one disc per entity: the plain view's figures; the 3D view draws each as a cylinder
b.lights(buffer, count)             point lights: Gfx.LIGHT_STRIDE floats each
b.end(post {outline, bloom, flash, vignette, dither, grey} | null)   each 0 to 1; grey: colour out of all that does not glow
b.worldToScreen(x, y, z, out)   b.screenToWorld(sx, sy, out)
b.visibleRadius() -> metres         3D view: from the point looked at to the farthest ground on screen; under 24 at zoom 1
b.readPixels(x, y, w, h) -> bytes   3D view, for tests: the finished low-resolution picture, rows from the top
Gfx.active   Gfx.worldToScreen(x, y, z?, out?) -> {x, y}   Gfx.screenToWorld(sx, sy, out?) -> {x, y}     in CSS pixels
```

The 3D view (`66-gfx-gl`) in brief; its header comment is the full contract.
- Axes: the ground point (x, y) is the 3D point (x, 0, y); Y is up and +Z runs toward the viewer.
- `Gfx.SHAPES = ['box', 'taper', 'cyl', 'sphere', 'cone']`, the same array as `Mesh.SHAPES`. Every unit shape stands on the ground and fills (-0.5, 0, -0.5) to (0.5, 1, 0.5): the taper's top is 0.6 of its base; cyl and cone have 8 sides; the sphere is 8 facets round and 6 bands high, so it spans ±0.462 across.
- The camera is tilted 52° with a 28° lens along the longer side. At zoom 1 the larger ground span (across or up the screen) is 30 m, and the camera comes nearer if a corner would show ground beyond 23.5 m.
- The scene is drawn into a low-resolution target (short side about 300 to 432 px) and scaled up by a whole number with hard pixels; the canvas holds at most about 2.5 million pixels.
- Quality: 'high' (shadow map 1024, bloom, outline), 'medium' (shadow map 512, no bloom), 'low' (no shadows, bloom or outline). After about two seconds of frames over 20 ms the view steps down one level by itself and posts the notice `'quality'`; it never steps up by itself. `caps.shadows` and `caps.bloom` follow the level.
- `env.sun.dir` is the direction the light travels, kept above the horizon; `env.fog.near` and `far` are metres up the screen beyond the point looked at. The defaults of `post`: outline 1, bloom 1, dither 0, vignette 0, flash 0.
- A lost WebGL context stops drawing and a restored one rebuilds everything. A shader that fails throws with its log, and `Gfx.create` falls back to the next view.

Instance buffers are `Float32Array`s of whole records, and `count` is a number of records. Lengths are metres; colours and alpha run from 0 to 1.

```
Gfx.DISC_STRIDE = 7        x, y, radius, red, green, blue, alpha
Gfx.DECAL_STRIDE = 11      x, y, radius, red, green, blue, alpha, fill, shape, angle, arc
                           fill: the share filled in, drawn like the rim: 0 to 1 from the middle out, below 0 from the
                           rim in. shape: 0 disc, 1 ring, 2 sector, 3 bar, 4 lee (not drawn: a body or prop at x, y,
                           radius round, that shelters by the rule of Dmg.inLee with arc as its reach); 8 added to 0 to
                           3: cut, the frame's lee as seen from the decal's x, y cut out of it as clean ground. angle:
                           which way a sector or bar points. arc: a sector's opening (radians), a bar's width or a
                           lee record's reach (metres)
Gfx.BILLBOARD_STRIDE = 9   x, y, z, size, red, green, blue, alpha, glow     glow above 0.5: it adds its light, else it covers
Gfx.PART_STRIDE = 18       a 3x4 matrix in rows (m00 m01 m02 m03 m10 ... m23) taking a unit-shape point to the world,
                           then red, green, blue, flash (toward white, for a hit), glow (shines by itself, feeds the
                           bloom), alpha (below 1: drawn with a screen-door pattern, so nothing needs sorting)
Gfx.LIGHT_STRIDE = 8       x, y on the ground, z height, radius, red, green, blue, strength
```

The decal record is 11 floats: after `fill` come `shape` (`Scene.DISC` 0, `RING` 1, `SECTOR` 2, `BAR` 3, `LEE` 4, and `Scene.CUT` 8 added for a decal cut by lee), `angle` and `arc`, and both views draw every shape. A Swell is two cut records of its shape, its fill in pale bone and its dark rim, and each body or prop that may shelter from it is a lee record in the same buffer: the lee is worked out per pixel from those, so the clean ground left in the fill is exactly the ground where a body would stand in lee. Both views read up to 64 lee records a frame.

In the plain view the longer side of the canvas shows 30 m of ground at zoom 1, and a metre of height lifts a point half a metre up the screen.

## Data shapes

All definitions are plain JSON. Units are metres, seconds and radians. The lists are the rows of `src/js/10-stats.js` (section 15 of `docs/design/02-combat.md`).

```js
Kind   = 'blow'|'drag'|'swell'                                // Stats.TYPES; "Type" in the shapes below
Family = 'rope'|'verge'|'pike'|'pole'|'bellows'|'spade'      // the six trade tools; a family is a tag
Tag    = Kind|Family|'attack'|'hit'|'dot'|'still'|'moving'|'timed'|'thrown'|'ground'|'line'|'round'|'planted'|'held'
       |'turn'|'crossing'|'water'|'trade'|'heave'|Ailment
Ailment = 'wrong-footed'|'in-procession'|'moored'|'sounded'|'coiled'|'mourning'|'clung'|'coined'|'swing'|'sealed'
       |'brined'|'tolled-for'|'filed'|'tolled'|'burgess'      // the conditions a body carries (Stats.AILMENTS)
Cond   = 'braced'|'striding'|'crowded'|'after-quarter'|'wrong-footed'|'in-water'|'dry'|'on-wound'|'laden'|'scarred'
       |'faint'|'at-post'|'in-light'|'tolled-for'             // the player's
       |'t-braced'|'t-striding'|'t-large'|'t-elite'|'t-keeper'|'t-near'|'t-far'|'t-in-water'
       |'t-wrong-footed'|'t-in-procession'|'t-moored'|'t-sounded'|'t-coiled'|'t-mourning'|'t-coined'|'t-sealed'|'t-brined'
Primary = 'knee'|'heel'|'hand'|'ear'
Stat   = Primary life-max wound-term wound-join wound-cap mend-rate mend-reach mend-on-lay scarring brace-time
         stride-share lee-reach turn-limit wrong-foot-taken guard.all taken move-speed shove-taken find-weight find-steady
         pickup-reach wake-lag wake-length heed-max warn trade-recharge heave-recharge heave-harm pull-window set-time
         wedge-length bar-length lamp-burn chest-size dig-rate procession-cap procession-bonus sound-time xp-gain
         coin-find find-chance hum-gain notch-size damage speed area reach duration throws pierce throw-speed shove
         wrong-foot cond-duration guard.<Kind> guard-max.<Kind> through.<Kind> added.<Kind>
         chance.coined chance.sealed chance.brined flag.<id> param.<key>      // table of 15.8 for bases and bounds

Scaled   = number | {a, b, curve:'lin'|'exp'}                 // owner level 1 -> 20
Mod      = {stat, op:'flat'|'inc'|'more'|'set', value:Scaled|[min,max], tags?:[Tag], cond?:Cond,
            per?:{stat:Primary|'level'|'observances'|'favours'|'finds'|'debts', div, cap?}, local?:true}
            // a [min,max] value only on added.<Kind>
ModRange = {stat, op, tags?, cond?, local?, min, max}
Req      = {level?, knee?, heel?, hand?, ear?}                // wanted, not locked: the share rule (Rules)

Voice     = {id, name, text, icon, attr:Primary, tier:1..5, tags:[Tag], weapon:null, archetype, target, rate:Scaled,
             damage:{[Kind]:[Scaled,Scaled]} /* exactly one kind */, weaponPct:0, eff, crit:0, params:{[key]:Scaled},
             mods:[Mod], fx:{puppet?, cast?, hit?, sfxCast?, sfxHit?, light?, ...}}
             // archetype: 'ring'|'rap'|'bar'|'spark'|'cone', and what Skills.archetype adds
             // target: 'nearest'|'densest'|'random'|'farthest'|'aim'|'self'
VoiceInst = {uid, id, level:1..20, rope:2..5, knots:[knotId|null]}
Knot      = {id, name, text, icon, attr:Primary, tier, requires:[Tag], excludes:[Tag], addTags:[Tag], mods:[Mod],
             params:{[key]:number}, trigger:Trigger|null}
Trigger   = {on:'kill'|'hurt'|'pull'|'trade'|'heave'|'timer', chance, cooldown}
Observance = {id, name, text, icon, attr, tier, heed:20..40, mods:[Mod], aura:null}    // heed: the Heed it holds

Class   = {id, name, text, attrs:{[Primary]:n}, perLevel:{[Primary]:n}, base:[Mod], door?:0..5,
           voices:[voiceId x 1..6] /* the starting loadout, in place order */, startGear:[baseId],
           trade:{name, text, icon, recharge}, callings:[id,id], unlock:bequestId|null, puppet, palette:[hex]}
           // the class's first attribute starts at 10 and its second at 5; each level adds 2 and 1 (03-classes.md)
Calling = {id, class, name, text, points:8,
           nodes:[{key, kind:'minor'|'major', name, mods:[Mod], requires:[key], row, col}]}

Attack = {id, kind:'strike'|'throw'|'press'|'spread'|'fall'|'zone', type:Kind, mult, cooldown, range, windup,
          shape:'arc'|'line'|'circle'|'ring'|'wedge', radius, angle, count, spread, speed, evadable:false,
          ailment:Ailment|null, summon:{enemy, count}|null, fx}
          // strike and throw are Blows, press and zone Drag, spread and fall Swells (02-combat.md, section 2).
          // windup: a Blow's wind-up, or a Swell's fill before any warning is added. summon: shedding only.
Enemy  = {id, name, puppet, radius, life, damage, speed, xp, cost, loot,           // life, damage, xp scale by level curve
          ai:'wake'|'chase' (and what AI.register adds), aiParams:{}, attacks:[Attack|attackId],
          guard:{blow?, drag?} /* 50 and 60 unless given; never swell */, size:'small'|'large',
          press /* the Drag a second it deals while touching, as a multiple of its damage */, tags:[string]}
Boss   = Enemy & {arena:{radius}, phases:[{until, speed, onEnter:[attackId], loop:[attackId|{wait}]}]}
Trait  = {id, name, text?, mods?:[Mod]}                       // an elite trait; Cause has the same shape. Both
                                                              // may carry more fields
Zone   = {id, name, kind:'district'|'peal'|'bill'|'debug', level, tollSeconds:75, keeperToll:8, gateEvery:3,
          region:{radius}, start?:{x, y}, tileset:id|null, place?:[{prop, x, y, role?}], props:[{prop, density}],
          ambient:{light:[r,g,b], fog, sun}, music, timeline:[{toll, rate, cap, pool:[{enemy, w}]}],
          overtoll:{rateMul, levelPer, rewardPer}, events:[{toll, kind:'elite'|'swarm', enemy?, traits?, shape?, count?}],
          boss:id|null, rules:{}, unlock:bequestId|null, next:zoneId|null}
          // density: props on 100 square metres. place: props set down by hand, (x, y) from the middle; start: where a
          // run begins, from the middle. A district's own rules add fields with Defs.extend('zone', ...).
Role   = 'bell-post'|'landmark'|'lamp-post'|'pit'|'sally'|'circle'|'stair'|'hulk'

Puppet = {id, rig:'biped'|'quadruped'|'floater'|'crawler'|'winged'|'serpent'|'static', scale,
          parts:[{key, shape:'box'|'taper'|'cyl'|'sphere'|'cone', size:[x,y,z], at:[x,y,z], parent?:key,
                  joint?:string, color:paletteKey, emissive?:number, glow?:0..1, detail?:bool}],
          palette:{[key]:hex|[r,g,b]}, anim:{stride, swing, bob}}
          // a part is one unit shape scaled to size (metres), its base centre at "at" from its joint's origin;
          // detail parts are left out first when many figures are on screen. A person is about 1.7 m tall.
Prop   = {id, puppet, radius, light?:{radius, color, height?, strength?}, breakable?:{loot}, role?:Role}
Tileset = {id, recipe?:'flags'|'cobbles'|'silt'|..., span?:metres, colors?:{[name]:hex|[r,g,b]}}   // open: more fields allowed

Favour   = {id, name, text, icon, rarity:'plain'|'turned', weight, maxStacks, group?, scope:'global'|'voices',
            requires:{tags?, class?, runLevel?}, mods:[Mod], params?:{}}
            // plain: adds numbers (flat and inc only); turned: changes a rule, by a flag.<id> modifier the rule reads
Bequest  = {id, name, text, hidden, scope:'account'|'character', on:EventKind, count, where:{},
            reward:{class?, zone?, unique?, planPoints?, coin?, hum?, currency?:{}}}
Cause    = {id, name, text?, mods?:[Mod]}

Mode = {id, name, text?, persistent, route:'zone'|'night', zones?, xpCurve, levelCap, runLevels,
        levelOffer:'none'|'node', runLevelOffer:'favour'|'none', eliteOffer, bossOffer:'none'|'favour'|'node'|'reward',
        haul:'gate'|'none', calling:{afterKeeper, pointsPerPeal}, respec:'coin'|'none', death:'permanent', score}
        // xpCurve names a list of the curves 'main'. The finer fields are provisional (see the top of this file).
Curves    = {id:'main', levels, enemyLife:[n], enemyDamage:[n], enemyXp:[n], charXp:[n], nightXp:[n], runXp:[n],
             rank:[{life, damage, xp, size} x4]}                // lists indexed by level - 1
Constants = {id:'main', spawnRadius, despawnRadius, tollSeconds, keeperToll, gateEvery, gateOpenSeconds, gateRadius,
             ringStrokes, strokeSeconds, backSeconds, caps:{enemies, shots, areas, pickups, minions, events}, gridCell,
             playerRadius}
             // a run reads them as S.rules; both kinds, and Tileset, may carry more fields

InputFrame = {mx, my, ax, ay, aim, trade, heave}
Command = {type:'pick'|'banish', index} | {type:'reroll'|'skip'|'leave'} | {type:'allocate', id, choice?}
        | {type:'equip', uid, slot}
Event   = {k:'hit'|'kill'|'cast'|'hurt'|'wound'|'mend'|'scar'|'pull'|'trade'|'heave'|'pickup'|'level'|'offer'|'favour'
           |'telegraph'|'phase'|'drop'|'toll'|'count'|'gate'|'stroke'|'end', x, y, a, b, id}
```

These keep the first plan's shapes until Stage 2 replaces them (`04-progression.md`: the Plan, finds, the Bellframe); their stats, tags, families and slots are already the design's:

```js
TreeSkeleton = {spokes, rings:[{r, slots}], pathMods:[Mod], starts:{[classId]:{sector}}}
Cluster   = {id, name, anchor:{sector, ring, slot}, shape:'ring6'|'arc5'|'fork4'|'line3'|'diamond4', theme:[Tag], entry:key,
             nodes:[{key, kind:'minor'|'major'|'capstone', name, text?, icon?, mods:[Mod]}]}
LegacyNode = {id, name, text, icon, branch, row, col, requires:[id], ranks, cost:[n], mods:[Mod], unlock?:{}}
Base     = {id, name, slot:'tool'|'hat'|'coat'|'hands'|'girdle'|'pattens'|'token', family:Family|null, tags:[string], level,
            req:Req, twoHanded, weapon:null /* no tool is a weapon */, defence:{}|null, implicit:[ModRange], icon}
Affix    = {id, name, type:'prefix'|'suffix', group, weights:{[itemTag]:number}, tiers:[{ilvl, mods:[ModRange]}]}
Unique   = {id, name, base, level, mods:[ModRange], flavour, weight, unlock:bequestId|null}
Currency = {id, name, text, icon, target:'item'|'voice', op, requires:{}, args:{}, weight, level}
Save = {v:1, rev, updated, settings:{}, binds:{}, chars:[Char], active:uid|null, fallen:[...], account:{...}}
Char = {uid, name, class, level, xp, calling:id|null, callingNodes:[key], tree:[{id, choice?}], voices:[VoiceInst],
        loadout:[uid|null x6], knots:{[id]:n}, observances:[id], ...}       // what the kernel reads: class, level,
                                                                             // voices, loadout, observances
// Stage 2 targets: a find {uid, base, level, fixed, lines:[{stat, op, value, tags, cond, posture, toll, backward,
// struck}]} and a base {id, name, slot, family, level, fixed, tables, icon}.
```

`Defs.SCHEMA` in `01-defs.js` holds these shapes as data, and `Defs.finalize()` checks every definition against them at boot; each fault reads `kind id: field problem`. The check is stricter than the lines above in four ways:

- A field without `?` is required. An `Attack` carries all 17 of its fields, a class exactly two callings and one to six voices.
- An object holds no field that its shape does not list. The exceptions are `fx`, `ambient` and `anim`, and the kinds tileset, curves, constants, trait and cause, which may carry more.
- A field the design keeps at one value holds only that value (a spec with `only`): a voice's `crit` is 0, its `weapon` null and its `weaponPct` 0; an attack's `evadable` is false; an observance's `aura` is null; a base's `weapon` is null.
- Every id that names another definition must exist. This is not checked while the kind it points into has no definitions at all, which keeps a build without (say) its puppets valid: `debug.husk` names a puppet of its own id, and once any puppet is registered that one must be there too.

It also checks the design's rules that a spec cannot say: a voice deals exactly one kind of harm; no enemy's guard is for a bare kind (the Swell); a favour's modifiers are `flat` or `inc`, and only a turned favour switches a `flag.`.

A registry of behaviour adds its words to the closed lists with `Defs.allow` (`Defs.allow('ai', 'rider')`), and a system adds fields to a kind with `Defs.extend`; both only while files load.

## Rules

**A stat's value**

`V = clamp(set ?? (base + sum of flat) x max(0, 1 + sum of inc / 100) x product of (1 + more / 100), min, max)`

- A modifier applies when all of its tags are among the query's tags and its condition, if any, holds.
- All `inc` add together whatever their source. Each `more` multiplies on its own. Source order never matters. Of several `set` on one stat the lowest wins.
- A `per` modifier counts `min(cap, floor(count / div))` times. While the attributes themselves are worked out every attribute counts as 0, so one attribute cannot feed another.
- `param.<key>` is a family: a modifier of `param.count` changes the param `count` of the voices its tags fit.
- `more` modifiers appear only on knots, squares, callings and named finds. Favours and the Bellframe use only `flat`, `inc` and parameter changes; favours are held together to about 30% of a vigil's harm. `Defs.finalize` enforces the first for favours; the second is the favours' authors' to test.
- The tags of a kind of harm: its id, and `dot` if it ticks (Drag), else `hit` (Blow, Swell). A voice's harm of a kind is worked out with the voice's tags, what its knots add, and that kind's tags; every other number on its sheet with its tags and those of the kind it deals.

**The attributes** (`02-combat.md`, section 14). Each point of an attribute gives what its row of `Stats.PRIMARIES` lists; a give with `div: 10` counts once for every ten points. They join the modifiers of the player's sheet and of every voice's sheet, so Knee's "+1% harm of voices tagged `still`" reaches the voice and Hand's "+1% harm to the dead within 3 m" waits, on the voice's sheet, for a body that is near.

**The share rule.** A voice wants `10 x tier` of its attribute, a knot `6 x tier`, a find `4 x` its written lines. Below that, what it gives works at `Stats.share(have, want) = clamp(have / want, 0.2, 1)`. A voice's base harm is multiplied by its share (`ss.share`); a knot's modifiers (all but `set`) and params are multiplied by the knot's. Nothing is locked.

**A voice's harm, per kind T** (only the kind its `damage` names; added harm of another kind adds nothing)

```
base_T  = (roll(voice.damage[T] at its level) + sum(added.T) x eff) x share
hit_T   = base_T x (1 + sum inc/100) x product(1 + more/100)        Stats.hitMult adds what is about the body struck
rate    = voice.rate x V(speed)
```

**One hit on one of the dead** (`02-combat.md`, section 15.10). A voice with skill sheet `ss` strikes the dead body `e`; `m` is `e`'s condition mask: `t-braced` and `t-striding` by its posture, `t-large`, `t-elite` and `t-keeper` by size and rank, `t-near` (within 3 m of the player) and `t-far` (beyond 8 m), `t-in-water`, and the `cond` of every row of `Stats.AILMENTS` it carries.

```
1  shape     e is inside the voice's shape (spreading Swell: and not in lee, within 3 m; falling Swell: inside when it lands)
2  roll      b[T] = ss.baseMin[T] + r x (ss.baseMax[T] - ss.baseMin[T]), r from S.rng.combat; r = 1 if e is Sounded
3  attacker  h[T] = b[T] x Stats.hitMult(ss, T, m) x part          part: the archetype's part-hit share, else 1
4  train     in procession: h[T] x (1 + procession-bonus / 100)
5  footing   Wrong-footed: h[T] x (1 + ss['wrong-foot'] / 100)
6  guard     not bare, and its posture holds (Blow and Braced, Drag and Striding):
             g = min(e.guard[T], guardMax[T]) x (1 - ss.through[T] / 100);  h[T] x (1 - g / 100)
             e.guard[T] = the def's guard, else Stats.TYPES[T].guardBase; guardMax[T] = Stats.TYPES[T].guardMax
7  taken     not bare: h[T] x e's harm-taken multiplier (its kind, its traits); Drag x the water band (dry: 1)
8  life      H = sum h[T];  e.life -= H;  emit 'hit' (a = H, b = mask of kinds)
9  shove     ss.shove > 0: moved ss.shove m away from the voice (keepers a quarter as far); ends Brace and procession
10 conds     each chance row laid at ss.ailChance[row] percent, for ss.ailDuration[row] x its seconds; a Blow counts
             swing (more than 120 degrees off the last Blow's direction +1, within 60 degrees -1; at 6, keepers 12, it
             goes over); a seal breaks when H >= V x lifeMax
11 death     at no life, in the deaths phase: the kill event, mourning if elite or keeper, coins, embers, finds
```

**One hit on the player** (section 15.11). An attack `A` of kind `T` from body `s` lands or ticks; `d = s.damage x A.mult x scale`.

```
1  shape     a Blow if you are inside it at the end of its wind-up; a Swell if inside when it lands and (spreading)
             not in lee within your lee-reach; Drag while its cause touches you
2  bare      a Swell: h = d, go to 5
3  guard     its posture holds for you: h = d x (1 - S.sheet.guard[T] / 100); else h = d
4  taken     h x S.sheet.taken[T]; Drag x the water band at your feet (dry: 1)
5  footing   Wrong-footed: h x (1 + wrong-foot-taken / 100)
6  reprieve  Tolled-for: no life is lost; its time loses 1 s for a Blow or a Swell, 0.25 s for a Drag tick; stop
7  life      life -= h
8  wound     depth w: the Blow's wind-up, 0 for Drag, the fill you saw for a Swell. An open wound within wound-join
             takes h more and the deeper depth; else one opens where you stand (the oldest scars first when
             wound-cap are open). Emit 'wound'.
9  seal      breaks if h >= 8% of greatest life; swing counts on you as on the dead (at 6 you are shoved 2 m)
10 no life   life <= 0: Tolled-for if not yet this vigil (its time: seconds to the next toll); otherwise death
```

**Drag ticks** (section 15.12). `Dmg.tick` runs every 15th step, four times a second: each of the dead whose edge is within 0.1 m of yours presses you for `s.damage x s.press / 4`; each rider on you deals its Drag / 4 (riders on a large dead do the same to it); each Drag zone you stand in (an attack of kind `zone`, or bad ground) its harm a second / 4; each of your Drag voices' zones its harm a second / 4 to every body inside, through the steps of 15.10.

**Posture and the turn rule** (sections 1 and 4). A body's posture comes from its steering speed against its top speed on dry ground: under 15% it is still, and Braced once still for `brace-time` (the dead 0.4 s) until its speed reaches 15% or it is shoved 0.3 m or more; at 15% or more it is moving, and Striding once at `stride-share` (the dead 70%) or more for 0.25 s, until it falls below. A body faster than 30% of its top speed records its heading every 0.1 s; when its heading turns more than its turn limit (the dead 90°, the player `turn-limit`) from any heading of the last 0.5 s, it is Wrong-footed for 0.5 s (keepers 0.25 s) and takes 50% more from all harm (`wrong-foot` against the dead, `wrong-foot-taken` against you). The Change-ringer's pull never wrong-foots the player.

**Conditions.** `Stats.AILMENTS` lists them, with what T, V and N hold; their rules are section 7 of `02-combat.md`. Every body's condition times run down in `Dmg.step`; while a body is sealed, no other condition on it expires, starts or ends. A condition a voice, knot, favour or class rule lays (`by: 'effect'`) is laid with `Dmg.lay`, which refuses a body the row spares (`small`, `large`, `elite`, `keeper`), one that cannot carry it (`on`), a sealed one and one still immune.

**Wounds** (section 8). All the life harm takes from you lies on the ground in wounds: discs 1 m across, at most `wound-cap`, joined within `wound-join`. Standing Braced within `mend-reach` of a wound's centre gives its life back evenly over `(1 s + 2 x depth) / mend-rate`; stepping off keeps what came back. A wound open `wound-term` seconds scars: `scarring` of the life still in it comes off greatest life until the vigil ends. Nothing else heals unless a voice, knot, favour or observance says so. While Tolled-for wounds cannot be mended.

**Heed** (section 9). Free Heed (`heed-max` less what observances hold; all of it in the first vigil) shows every Swell aimed at you 0.01 s sooner a point; `warn`, a lit lamp's light (0.4 s), the Register (0.15 s a death, three at most) and a Sounded attacker (0.3 s) add to it; never more than 1 s in all. A Swell shown sooner fills for longer: it is aimed when first shown, at where you were.

**The vigil** (`01-world.md`, "The frame in the fiction"; `02-combat.md`, section 11)

- A toll every 75 s raises the threat tier: more of the dead, slightly higher levels, more reward. After each toll the count forecasts the next interval. At the eighth toll the keeper comes; once it is laid the district's bell speaks, and the vigil goes on for as long as the player dares.
- A lychgate opens for 25 s after each elite or keeper falls and at every third toll. Standing in it rings you down: six strokes a second apart, each banking a sixth of the haul and silencing a sixth of the voices; the sixth ends the vigil (`'left'`). Driven out sooner, you keep what was banked and stay, and the silenced voices come back one every 2 s.
- At no life you are Tolled-for, once a vigil: your voices stop, you run 20% faster, nothing lowers your life, each Blow or Swell takes 1 s from your time and each Drag tick 0.25 s, and a lychgate opens at the farthest edge of the district. Reach it in time and you live with the haul lost (`'spared'`); otherwise you join the dead when the toll rings (`'died'`). A second fall to no life in one vigil is death.
- Character experience is kept as it is earned. The haul is kept only by ringing down. Hum is kept either way.

## Stage 1 systems

Stage 1 ends in a first playable vigil (`docs/plan.md`, Appendix D): the Dial and its keeper (the Half-muffled Keeper), one class (the Change-ringer) with three starting voices, the dead of the Dial, tolls, elites, lychgates with ringing down, Tolled-for, wounds and mending, Heed, the walk-in favours and their row, the scripted player and the HUD. Written finds, the Plan, observances, the Bellframe and saves wait for Stage 2; water waits for the Ropewalk. Four packages build it in parallel, each in its own files. The shared files (`00-core`, `01-defs`, `10-stats`, `20-sim`, `29-world`, `30-modes-curves`, `50-platform`, `90-game`, `99-boot`) are not edited by any of them: what a package needs from them is here, and a package extends the schema, the run state and the entities only through `Defs.allow`, `Defs.extend`, `Sim.field`, `Sim.state` and `Sim.source` from its own files.

### Who owns what

| Package | Files | Namespaces |
|---|---|---|
| combat | `11-damage.js`, `21-player.js`, `23-skills.js`, `24-archetypes.js`, and the content `31-change-ringer.js` (the class and its three voices) | `Dmg`, `Player`, `Buffs`, `Skills` |
| vigil | `22-enemies.js`, `25-boss.js`, `26-director.js`, `27-favours.js`, `28-bot.js`, and the content `40-favours.js` (the favours of the row) and `41-dial.js` (the zone, its dead, their attacks, elite traits and the keeper) | `AI`, `Enemies`, `Boss`, `Director`, `Favours`, `Bot` |
| screens | `62-glyphs.js` (icons for buttons, favours and marks), `71-hud.js`, `73-screens.js` (the title and the results, which replace the stand-ins of `90-game` by registering first) | `Glyphs`, `Hud` |
| figures | the content `46-puppets-dial.js` (the Change-ringer, the dead of the Dial, the keeper, the lychgate) and `47-dial-ground.js` (its props, their roles, its tileset); `61-rigs.js`, `63-ground.js`, `65-gfx.js` and `66-gfx-gl.js` where they need changes (the wider decal record), `68-scene.js` and `69-vfx.js` | `Rigs`, `Ground`, `Gfx`, `Scene`, `Vfx` |

Sound (`53` to `55`) has no owner in Stage 1: `55-sound-core.js` already plays the events below (the count, mending, a scar, ringing down) with simple effects.

**Ids both sides need.** Every enemy, keeper and prop names a puppet of its own id; the class names the puppet `change-ringer`; the lychgate is drawn with the puppet `gate`. The Dial's ids, which the vigil's content defines and the figures' puppets carry: the zone `dial`; the dead `dial.wake-walker` (the common dead: small, `ai: 'wake'`, in trains), `dial.hanger-on` (small, riders: the condition `clung`) and `dial.heavy` (the heavy dead: `size: 'large'`, lee, Sounded, Coiled); the keeper `dial.half-muffled-keeper` (a boss of `size: 'large'`); the props `dial.bell-post` (`role: 'bell-post'`) and `dial.stone` (the eight stones on the radii; the zone gives landmarks their role in `place`); the tileset `dial`. The vigil may add dead to the Dial by agreeing their ids with the figures first; the class's voices name no puppet. Puppets and tilesets already exist (the test ones), so `Defs.finalize` checks every reference to them: until a package's work meets the figures' files, it names the test figures (`debug.husk`, the `test.*` puppets and the tileset `test.cobbles`) in place of the agreed ids, and the agreed ids go in when the two meet.

**Pickups** are of four kinds: 0 an ember (`value`: experience), 1 coin (`value`: coins), 2 a find (`item`: the find; Stage 2), 3 a favour's shape (`item`: the favour def; `value`: its place in the row). The vigil drops kinds 0 and 1 and raises kind 3; the combat package collects 0 to 2, and the favours take 3; the scene draws all four.

### The order of the step, and where things are worked out

- **The player's posture, its turn rule, the pull and its conditions' mask**: `Player.step`, phase 1, right after the player moves.
- **The wake**: `Enemies.step`, phase 4, before any of the dead steer: the player's place is noted every 0.1 s (on the steps where `S.step % 6 === 0`) into `S.wake`, and the wake cells are stamped.
- **The dead's posture and their turn rule**: `Dmg.step`, phase 5, from the steering velocity (`vx, vy`) `Enemies.step` gave each body. Shoves (`Dmg.shove`) end Brace at once, whenever they happen.
- **Condition times** of every body, the player included: `Dmg.step`, phase 5. In procession, mourning, riders and the like are applied and kept by the vigil's rules in `Enemies.step` (their rows: `Stats.RULE.procession`, `mourning`, `riders`); Wrong-footed, Sounded, Coiled, Swing and Tolled-for by the combat package (`footing`, `sounding`, `coiling`, `swing`, `reprieve`); coined, sealed and brined are laid by voices through `Dmg.lay`.
- **Blows and Swells of the dead on the player** land in `Enemies.step` (phase 4) and `Boss.step` (phase 7) through `Dmg.hitPlayer`; the voices' hits in `Skills.step` (phase 6) through `Dmg.hitEnemy`; Drag in `Dmg.tick` (phase 8).

### 11-damage.js (combat). Owns: Dmg

```
Dmg.hitEnemy(S, slot, e, part, ox, oy) -> number     section 15.10 steps 2 to 10 for the voice in S.skills[slot] on the
                                                     body e (step 1, the shape, is the archetype's): part is the
                                                     archetype's part-hit share (1 for a whole hit); (ox, oy) where the
                                                     harm comes from, for the shove and for swing. Returns H.
Dmg.harmEnemy(S, e, type, amount, ox, oy) -> number  harm on the dead from no voice (a coined body's contact, a body
                                                     going over, Brine landing): guard, taken, life, swing; no roll.
Dmg.hitPlayer(S, attack, source, scale, seen) -> number   section 15.11 steps 2 to 10: attack is the Attack def (type,
                                                     mult, id), source any body with damage, x and y (an enemy, the keeper,
                                                     an area), scale a factor (the keeper's echo is 0.3), seen the
                                                     warning the player had, which is the wound's depth (the wind-up of
                                                     a Blow, the whole fill of a Swell as shown, 0 for Drag). The caller
                                                     has done step 1, the shape and the lee. Returns the life lost.
Dmg.tick(S)                                          phase 8: the Drag ticks of section 15.12
Dmg.step(S)                                          phase 5: every body's condition times (sealed holds the others
                                                     still), then the dead's postures and the turn rule; Tolled-for
                                                     that runs out ends the run 'died'
Dmg.inLee(S, sx, sy, body, reach) -> boolean         a prop with a collider, or a large body other than body, stands on
                                                     the line from (sx, sy) to body within reach of it
Dmg.shove(S, body, dx, dy) -> number                 moves a body (the player times shove-taken and less for its ballast;
                                                     out of colliders by World.pushOut); 0.3 m or more ends Brace; on the
                                                     dead it ends In Procession. Returns the metres moved.
Dmg.lay(S, body, row, seconds, v, n) -> boolean      lays a condition (a row of Stats.AILMENTS), refused where the row
                                                     spares the body, the body cannot carry it, it is sealed or immune
Dmg.lift(S, body, row) -> boolean                    ends one, unless the body is sealed
Dmg.warning(S, source) -> seconds                    the warning added to the fill of a Swell aimed at the player: free
                                                     Heed x 0.01 + warn (+ 0.3 when source is Sounded), at most 1. A
                                                     district's own rule (the Dial's shadow: 0.3 s less) is the vigil's.
Dmg.large(e) -> boolean                              its def's size is 'large', or its rank is elite or above
Dmg.POSE = {still: 0, braced: 1, moving: 2, striding: 3}     the values of the field pose
```

As built, it also exports `Dmg.carries(body, row)`, `Dmg.inside(area, x, y, r)` (the one test of an area's circle, wedge or lane that the scene also uses) and the posture helpers the player shares with the dead (`Dmg.posture`, `record`, `turn`, `SAMPLE`, `FAST`). `Dmg.hitPlayer` takes a source that has a `team` (a shot or an area) as already carrying its whole harm, so `attack.mult` is not applied again; a body's attack is scaled by `mult`.

It names the rows `wrong-footed`, `in-procession`, `sounded`, `coiled`, `swing`, `sealed`, `tolled-for` and `clung` (Drag of riders), and the modifier conditions of a body struck (section 15.7). Events: `'hit'` (x, y the body; a = H; b = the mask of kinds dealt), `'hurt'` (x, y the player; a = the life lost, 0 while Tolled-for; b = the kind index; id = the attack's id, or null for a press, a rider or the ground), `'wound'` (x, y the wound's centre; a = the life this harm put in it; b = its depth now, seconds; id = `'open'` or `'join'`).

### 21-player.js (combat). Owns: Player, Buffs

```
Player.step(S, input)                phase 1: movement (move-speed, less find-weight a find carried and 8% a rider; 20%
                                     faster while Tolled-for; pushOut), posture, headings and the turn rule, the class
                                     rule and the trade (input.trade), the heave (input.heave: no finds in Stage 1, so it
                                     does nothing and the HUD hides button B), mending, scars, and S.player.conds (the
                                     flickering braced, striding, crowded and in-water held 0.25 s before the mask
                                     changes; S.dirty when it does)
Player.pickups(S)                    phase 10: pickups of kinds 0 (ember: value is experience, added to p.runXp; when
                                     runXp reaches S.curves.runXp[min(runLevel, 69)] it is spent and runLevel + 1),
                                     1 (coin: value added to S.coin) and 2 (a find, Stage 2), drawn in within
                                     pickup-reach. Kind 3 is the favours'.
Player.classRun(classId, level?) -> {class, level, mods, voices}     the cfg fields of a run without a character: the
                                     class's attributes as flat modifiers (attrs + perLevel x (level - 1)), its base
                                     modifiers, and its voices as VoiceInst at level 1 with a rope of 2. The title and
                                     the tests start a vigil with Game.start(Object.assign({zone: 'dial', seed},
                                     Player.classRun('change-ringer'))).
Player.rule(classId, {step(S, input), trade(S)})     registers a class's rule (21-player.js registers the
                                     Change-ringer's: the pull and the set bell; trade Set, recharge class.trade.recharge
                                     x trade-recharge / 100)
Buffs.add(S, id, mods, seconds)      timed modifiers through Sim.source (optional in Stage 1)
```

Fields it declares with `Sim.field`: on `'player'` and on `'enemy'`, `stillT` and `strideT` (seconds still, seconds at stride), `pose` (see `Dmg.POSE`) and `heading0` to `heading4` (the headings recorded every 0.1 s, newest first); on `'player'` only, `tradeCd` and `heaveCd` (seconds until each button is ready again) and `setBell` (true while the Change-ringer's bell is set mouth-up). Later classes add theirs here (`wind`, `graveDug`, `graveFilled`, `debts`). Its slot: `Sim.state('wounds', S => ...)` = `{n, x, y, life, depth, opened, back, scarred}`: the open wounds in `[0, n)`, oldest first, in arrays of 20 (the most `wound-cap` allows): centre, the life each holds, its depth (s), `S.t` when it opened, the life it has given back while mended (for the closing ring), and `scarred`, the greatest life lost to scars this vigil (a `Sim.source` takes it off `life-max`). It sets the modifier conditions of the player, and names the rows `wrong-footed`, `tolled-for` and `clung`. Events: `'pull'` (x, y the player; a = how many times the first voice speaks, 1, or 2 with the bell set), `'trade'` (a = the recharge it starts, seconds; id = the class id), `'heave'` (x, y where the find lands; a = its notches), `'mend'` (x, y the wound; a = the life given back since the last, at most four a second; id `'whole'` when it closed), `'scar'` (x, y the wound; a = the greatest life lost), `'pickup'` (a = kind, b = value) and `'level'` (a = the new run level).

### 23-skills.js and 24-archetypes.js (combat). Owns: Skills

```
Skills.archetype(name, {cast, step?})    registers an archetype and calls Defs.allow('archetype', name), so voices may
                                         name it. 24-archetypes.js registers what the three voices use, of ring, rap,
                                         bar, spark and cone.
  cast(S, slot) -> boolean               called by Skills.step when the voice in place slot is ready: its cd has run
                                         out, its place is not silenced and the player is not Tolled-for. It is given
                                         the run and the slot index: S.skills[slot] holds inst (VoiceInst), sheet (the
                                         SkillSheet: min, max, rate, through, share, params, area, reach, duration,
                                         throws, pierce, 'throw-speed', shove, 'wrong-foot', ailChance, ailDuration,
                                         targetMods, def with target and fx), cd, and t, n, target, a0..a3 for the
                                         archetype's own state; S.player is where it speaks from, S.grid finds the dead.
                                         It strikes at once with Dmg.hitEnemy, or makes areas and shots (team 0,
                                         owner 0, skill = slot, a ttl in seconds), and returns true if it spoke (cd
                                         becomes 1 / rate) or false if it found nothing (it is asked again next step).
  step(S, thing, slot)                   called once a step for each live shot and area whose skill is slot, to move
                                         and strike; the kernel removes it when its ttl runs out
Skills.step(S)                           phase 6: casting, then the voices' shots and areas; a 'cast' event for each
                                         voice that spoke (x, y where; a = slot; id = the voice id)
Skills.speak(S, slot, times) -> boolean  makes a voice speak now, cooldown or not: the pull
```

As built: an archetype's `cast(S, slot, forced)` takes a third argument, true when the pull makes the voice speak. `Skills` also exports the helpers the archetypes share (`silenced`, `kind`, `pick`, `point`, `count`, `strike`, `circle`, `wedge`, `lane`, `area`, `areaStep`, `strokes`, `find`, `where`) and the constants `FILL`, `ZONE`, `MARK`, `LANDED`, `TICK`, `LEE`, `AGAIN`. A voice's area is a Swell that spreads from `x, y` when its `a0` is 1 and falls when it is 0. Voices may target `'mark'` (where the player last stood still 0.5 s). The combat package keeps two more slots: `S.combat` (the class id, whether Tolled-for has come this vigil, the conditions' hold timers, the last pull, the bell-post's place) and `S.voices` (pending pull strokes, each voice's last hit, the mark); `S.wounds` has one more array, `told`. `Player` also exports `turn(S, seconds)`, `wound(S, life, depth)` and `scar(S, i)`, and a class rule's `step` returns true when the turn was its own act (a pull is never a wrong-foot).

The voices silenced by ringing down are the last `S.ringing.silent` voices of the loadout (the vigil's slot); none speaks while the player carries `tolled-for`. A Swell of a voice is an area with team 0, drawn like the dead's (below).

### 22-enemies.js (vigil). Owns: AI, Enemies

```
AI.register(name, fn(S, e))      a behaviour of the dead, named by an enemy def's ai (Defs.allow('ai', name)); it sets
                                 e.vx, e.vy (steering only) and e.face, winds up its attacks and lands them. 22-enemies.js
                                 registers 'wake' (steer at your place wake-lag ago) and 'chase' (steer at you).
Enemies.step(S)                  phase 4: notes the wake, steers every one of the dead by its ai (+15% In Procession,
                                 30% faster in the Dial's shadow: the district's rule), keeps the capped separation, moves
                                 them (World.pushOut), and runs the rules procession, mourning and riders
Enemies.wakeAt(S, seconds, out) -> out    {x, y}: where the player stood that many seconds ago, from S.wake
```

Its slot: `Sim.state('wake', ...)` = `{n, head, x, y, cells}`: up to 120 places (12 s at ten a second, the most `wake-length` allows), newest at `head`, older at `head - 1` and so on round the ring, `n` of them held; `cells` the 1 m grid of wake cells stamped with the time, its own. Field: `Sim.field('enemy', 'attack', -1)`, the index in `def.attacks` of the attack winding up or striking. An attack's wind-up: `state` 1 and `stateT` the seconds into it (`Scene.ATTACK.windup`), its aim locked when it starts; striking: `state` 2 (`Scene.ATTACK.strike`). A Swell of the dead is an area of `S.areas` with team 1: `x, y` its source (spreading) or centre (falling), `r` how far it reaches, `angle` its aim, `len` a lane's length (else 0), `def` the Attack (its kind, shape and, for a wedge, `angle` the opening), `damage` the harm, `t` the seconds since it was first shown and `ttl` the seconds until it lands, so it is `t / (t + ttl)` full. The fill is its `windup`, plus `Dmg.warning` when it is aimed at the player, plus the district's rule. A Drag zone of the dead is an area of team 1 whose def's kind is `'zone'`, `damage` its harm a second: `Dmg.tick` deals a quarter of it to the player standing within its `r`, as it deals the press of every body touching the player (`def.press`) and the Drag of the riders it carries. Events: `'telegraph'` when a Swell is first shown (x, y its source or centre; a = its radius; b = the seconds until it lands; id = the attack id). It names the rows `in-procession`, `mourning` and `clung`, and reads `coined`, `moored`, `filed` and `burgess` for movement.

As built (the files' headers have the full contract): `AI` also exports `has`, `steer(S, e, x, y, stop)` and `strike`; `25-boss.js` registers the behaviour `'keeper'`. `Enemies` also exports `fill`, `swell` and `shaded`. `Director` also exports `drop(S, kind, value, x, y)` and `level(S)`; `Favours` exports `take(S, place)` and `mods(S, out)`. The vigil's slots are `S.wake`, `S.crowd`, `S.keeper`, `S.vigil` (with `shade`, the Dial's shadow), `S.ringing`, `S.row` and `S.bot`; enemy fields `attack`, `pace` and `lifeSeen`; zone fields `districtRules` and `ordinal`; rules `overElites` and `shadowSpan`, `shadowSpeed`, `shadowWarn`. A Swell area of the dead carries its whole harm in `damage` (so `Dmg.hitPlayer` is called with scale 1), a lane's `r` is its half-width, `a0` is the fill as first shown, and `state` 2 means it has landed. The player and the dead collide: a Braced player is planted; otherwise the player gives way a share, at most 0.025 m a step.

### 25-boss.js (vigil). Owns: Boss

`Boss.step(S)`, phase 7: the keeper in `S.boss` (the Director spawns it at the keeper's toll and sets `S.boss`): its phases by its life (the Half-muffled Keeper: a full Swell then its echo at 30% 2 s later on the same ground; from 60% the echo first and the full stroke 1.2 s later; from 25% three echoes laid, then their full strokes in reverse order). Its state lives in the keeper's own fields and in a slot of its own if it needs one. Events: `'phase'` (x, y the keeper; a = the phase entered; id = the keeper's id) and `'telegraph'` as above.

### 26-director.js (vigil). Owns: Director

```
Director.step(S)                 phase 2: the toll's effects (threat + 1; the count; a lychgate at every gateEvery-th
                                 toll; the keeper at keeperToll; the threat budget and spawns by zone.timeline and
                                 zone.events; elites), lychgates and ringing down, the lychgate of Tolled-for, the
                                 voices coming back, district rules (the Dial's shadow)
Director.onKill(S, e)            the deaths phase: drops (embers and coin as pickups of kinds 0 and 1, their values
                                 final: In Procession +25% experience, xp-gain, coin-find), mourning round an elite or a
                                 keeper, a lychgate after an elite or a keeper
Director.event(kind, fn)         a district's own rule (the Dial's shadow and the like), named by the zone in a field
                                 the vigil adds to it with Defs.extend('zone', ...)
```

`S.gate` (the kernel's field) is its: `null`, or the open lychgate `{x, y, until, far, ring, strokes}`, one at a time (an opening while one stands renews its time): its place; `S.t` when it closes; `far`, true for the lychgate Tolled-for opens at the farthest edge; `ring`, the seconds the player has stood within `S.rules.gateRadius` of it without a break; `strokes`, the strokes rung (a stroke every `strokeSeconds`, `ringStrokes` in all). Each stroke banks a sixth of the coin carried when ringing began into `S.bank.coin`; the last ends the run `'left'`. Its slot `Sim.state('ringing', ...)` = `{silent, back}`: how many voices are silenced, counted from the last of the loadout, and the seconds until the next comes back (`backSeconds`, one at a time once the player is out). It ends the run `'spared'` when the player stands in the far lychgate while Tolled-for, after emptying `S.haul` and setting `S.coin` to 0. It names the row `tolled-for` (to see it) and `mourning`. Events: `'count'` (x, y the player; a = the tellers, 9 when the next interval brings mostly large dead, 6 a mixed crowd, 3 small dead in numbers; b = the elites that will rise; id = `'gate'` when a lychgate will open in it, else null), `'gate'` (x, y the lychgate; a = the seconds it stays open; b = 1 for the far lychgate, else 0), `'stroke'` (x, y the lychgate; a = the stroke, 1 to 6; b = the coin it banked) and `'drop'` (x, y; a = the pickup's kind; b = its value).

### 27-favours.js (vigil). Owns: Favours

Favours are walked into: **S.phase never becomes `'offer'` for them**, and nothing waits for a command.

```
Favours.step(S)                  phase 11: when S.player.runLevel has risen past the levels the row has answered, the
                                 favours of places 1 to 3 (1 to 4 after an offer sank) rise as pickups of kind 3, 4 m
                                 from the player and evenly apart (120 degrees for three), each with item = the favour
                                 def, value = its place, ttl 8 s. The player takes one by walking into it: S.favours[id]
                                 + 1, S.dirty, the others are taken away (pool.kill), the row closes up, a new favour
                                 drawn from S.rng.offers enters at place 6. If none is taken they sink; the next level's
                                 offer adds place 4. After every level the neighbours swap in fixed pairs, by turns
                                 (1-2, 3-4, 5-6) and (2-3, 4-5).
```

Its slot: `Sim.state('row', ...)` = `{ids, raised, levels, shapes, until}`: the six favour ids in their places, how many places the next offer raises (3 or 4), the run levels answered, the uids of the shapes standing, and when they sink. A `Sim.source` adds the modifiers of every favour in `S.favours`, as many times as it was taken (at most its `maxStacks`); a turned favour's rule reads its `flag.<id>` in `S.sheet.flags`, in the file that owns that rule. Events: `'offer'` (x, y the player; a = the shapes raised; b = the run level) and `'favour'` (x, y where it was taken; a = its place in the row; b = the times it has now been taken; id = the favour's id). `Offers` and `S.offer` stay for an offer that must pause, which nothing in Stage 1 makes; `Bot.choose` answers one if it ever comes.

### 28-bot.js (vigil). Owns: Bot

```
Bot.input(S, policy) -> InputFrame       one reused frame a step. Policies: 'still' (does nothing), 'walk' (a slow
                                         circle), 'vigil' (plays the Change-ringer through the Dial: rocks to pull in
                                         crowds, keeps out of filling Swells, stands on wounds to mend, walks into
                                         favours, rings down at a lychgate after the keeper or when life is low, and
                                         runs for the far lychgate when Tolled-for)
Bot.choose(S, offer) -> index | Command  for an offer that pauses (none in Stage 1)
```

Its memory between steps lives in `Sim.state('bot', ...)`. `Game.sim(seconds, {bot: true, policy})` drives it; the acceptance of Stage 1 (ten minutes of a vigil, the keeper, ringing down) is played with `'vigil'`.

### 71-hud.js and the screens (screens). Owns: Hud, Glyphs

`71-hud.js` draws into `#hud` on the notice `'frame'`, and keeps `Hud` for what tests and other screens read (`Hud.stats`, for one). From the run it shows: the life bar (`S.player.life` in the class colour, the life lying in `S.wounds` as a pale part, `S.wounds.scarred` as a dark end, against `S.sheet.stats['life-max']`); the Heed bar under it (free Heed bright: `heed-max`, all free in Stage 1); the row (`S.row.ids`, the first `S.row.raised` places raised; each favour's `icon`); the toll ring in the last 3 s before `S.tollAt` and a tick at each quarter of `S.tollSteps`; the count as marks when the setting asks (from `'count'` events); the haul (`S.haul`, one box a find; none in Stage 1); the buttons, through `Input.button('A', {icon, cooldown: S.player.tradeCd / (trade recharge x trade-recharge / 100)})` and `Input.button('B', {hidden: true})` while there is nothing to heave; Tolled-for (the player carries the row `tolled-for`) as a grey screen. `73-screens.js` registers `'title'` (it starts a vigil of the Dial with `Player.classRun('change-ringer')`) and `'results'` (opened with `{S, result}`: the outcome, `result.tolls`, `kills`, `coin`, `banked`, `time`). The favours themselves rise in the world and are drawn by the scene; the screens show the row.

As built: `Glyphs.define(id, paint)` registers an icon recipe (paint gets helpers that draw outlined, flat-shaded unit shapes); `Glyphs.icon(spec) -> canvas` (a new one, for page elements; spec an id or `{id, size, ink, dpr}`), `Glyphs.image(spec)` (a cached canvas for `drawImage`), `Glyphs.draw(ctx, spec, x, y, size)`, `Glyphs.pick(...ids)`, `has`, `ids`, `slug`, and the palette `Glyphs.C`; an unknown id gets a token whose shape and colour come from its hash. `Hud.stats` is a live record of what the HUD last drew, and `71-hud.js` defines the setting `hud.count` (draw the count as marks; off by default). In a debug scene, which has no class, the HUD shows both buttons plainly. While Tolled-for, the view greys the world itself (`post.grey`, which keeps what glows, the far lychgate's lamps among it); the HUD lays a grey of its own only where the scene does not.

### The figures and the scene (figures)

`68-scene.js` draws, from the run: under every body its posture from `pose` (a closed pale ring when Braced, a short trailing streak when Striding) and a white flash of the outline while it carries `wrong-footed`; the wake from `S.wake` as a faint line, and a thin thread from each body In Procession (`condN` of `in-procession` is 1) to it; the wounds of `S.wounds` as deep red discs, darker for deeper, greying toward `wound-term`, with a ring closing while one mends; the dead's Swells (areas of team 1, and the voices' of team 0) as their shape filling in pale bone with a dark rim, the lee of props and large bodies cut out of it as clean ground; a Blow's wind-up through the rig (`state` 1, `stateT`, the attack `e.attack`); the conditions as shapes and colours on the bodies (`02-combat.md`, section 13); the open lychgate and its ring filling stroke by stroke (`S.gate.ring` against `ringStrokes x strokeSeconds`); the favours' shapes (pickups of kind 3, by their favour's `icon`). It reads no event but `'cast'`; `69-vfx.js` reads the events listed under "Modules".
