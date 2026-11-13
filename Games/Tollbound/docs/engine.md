# Tollbound engine notes

These are the contracts every module is written against: how files are shaped, what the simulation state looks like, the data shapes content is authored in, the rules of stats and harm, in "Stage 1 systems" what each file of the first vigil exports, and in "Stage 2 systems" the contracts of the Household: the four packages that build it, their files, and what each reads of the others. The game itself is in `docs/design/`: the words, the districts and the art in `01-world.md`, the combat model and the engine's tables in `02-combat.md`, the classes in `03-classes.md` and progression in `04-progression.md`. `docs/plan.md` is the approved plan and is a snapshot; where it differs from this file, this file wins. Once a module exists, its code and its header comment win over this file, and whoever changes an interface updates this file in the same change.

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
- The shapes of Stage 2 are those of `04-progression.md`: the Plan (the kinds `plan` and `node`), finds (`base`, `posture`, and a find's written lines), knots, observances with the Heed they hold, the Bellframe (`bellframe`, `pit`, `gift`), bequests, callings and peals are kinds of definition under "Data shapes"; what a game keeps (a character, a find, a voice in its place, a bell, a death, the save) is under "The Household's shapes", kept by `14-character.js` and checked by `16-savedata.js`. The first plan's placeholders (`treeSkeleton`, `cluster`, `legacyNode`, `affix`, `unique`, `currency` and their `Save` and `Char`) are gone; a save of that shape is version 1, which `SaveData.migrate` brings up.

Still provisional, to be replaced as the later stages arrive:

- The numbers of the Plan (the plan `main`), of the Bellframe (the bellframe `main`), of mourning and of the Register: the design's, to be tuned once characters live through many vigils. Where the design is silent `14-character.js` chose, and says so in its header and under "Stage 2 systems".
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
  - Simulation: `Core Defs Stats Dmg Items Tree Char Progress Bellframe SaveData Sim Player Buffs AI Enemies Skills Boss Director Offers Favours Observances Bot World`
  - Presentation: `Plat Store Settings Input Sound Music Mesh Rigs Glyphs Ground Gfx Scene Vfx UI Hud Game`
- Nothing runs when a file loads except definitions and registrations. `99-boot.js` starts the game.
- No file reassigns a function another file defined. Modules extend each other through registries and through the per-step event queue. The registries that exist: `Defs.add`, `Defs.allow` and `Defs.extend` (content, word lists and fields of the schema), `Sim.field`, `Sim.state`, `Sim.source` and `Sim.system` (entity fields, a system's slot in the run state, modifiers for every sheet, a system's part of every step), `Gfx.register` (views), `UI.screen` (menus), `Plat.on` (the notices `90-game.js` and others post), `Settings.define` and `Settings.row` (settings and rows of the settings screen), `Sound.define` (sound effects as code recipes), `Music.define` (pieces of music) and `Rigs.register` (rigs). Planned for Stage 1, with their signatures under "Stage 1 systems": `Skills.archetype`, `AI.register`, `Player.rule` and `Director.event`; for Stage 2, under "Stage 2 systems": `Observances.promise`.
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
| find, notch, haul | an item; a line a toll writes on a find you carry; the finds and coin you carry unbanked | a `Find` and its `Line`s ("The Household's shapes"); the kinds `base` and `posture`; `S.haul`, `S.coin` |
| stood, strode, pressed, timed | the four postures a toll period is spent in, which write the lines of finds | `Stats.POSTURES` |
| chisel, re-walk, recast, cut | the four ways to change a find at the Lantern | `Items` (Stage 2, the second package) |
| the chest | the Household's store of banked finds, the worn finds of the dead, and what characters gave it | `save.chest` |
| ember, coin | experience the dead leave on the ground; the Household's money | pickups of kind 0 and 1; `S.coin` |
| lychgate, ringing down | the way out of a vigil; leaving through it one stroke at a time | `S.gate` (the id is `gate`), `S.gate.ring`; the events `'gate'` and `'stroke'` |
| Tolled-for | the state at no life | the condition `tolled-for`; the outcome `'spared'` |
| bell-post, landmark | the post at the centre of each district; one of its six places that pay Hum | prop roles `bell-post`, `landmark` |
| the Plan; door, lane, corner, square, milestone | the tree shared by all classes, and its kinds of node | the kinds `plan` and `node` (`kind`); a character's route, `char.plan` |
| route, doubling, beaten bounds, toll rings, banks (flood, ebb), straight miles | the Plan's rules | `Tree.mods` (Stage 2, the first package) |
| the Bellframe, Hum, the Register | the permanent tree shared by every character; its currency; what killed each character | the kinds `bellframe`, `pit` and `gift`; `save.account.frame`; `S.hum`, `save.account.hum`; `save.register` |
| pit, the tenor pit, bell, gift, ringing place, true ring | a place of the Bellframe (the first one opens from none); a dead character recast; what it gives those who ring it; how many bells a new character rings; neighbouring weights 10% to 30% apart | the kind `pit` (`from: null`); a `Bell`; the kind `gift`; `frame.places`; `Char.trueRing` |
| mourning | the time the Household grieves a death: full, then half | `char.mourning`, `Char.mourning`; the flag `full-mourning` |
| Bill, cause, bequest | an endgame district with causes added; one danger written on it; a quest-like goal | the zone kind `bill`; the kinds `cause`, `bequest` |
| the Household, the Watch-night | standing characters kept until they die; a one-sitting run through five districts | the modes `household`, `watch-night`; the save, `Game.save` (`16-savedata.js`); the game's state `'household'` |
| the Lantern | the hub | the game's state `'lantern'`, `Game.lantern` |
| flood, ebb, slack, spring; dry, ankle, knee, waist | the tide's states; the bands of water at a body's feet | from the Ropewalk |

The engine keeps a few plain words of its own that players never see: enemy, boss (the keeper's machinery), gate (the lychgate's id), skill (a voice in its place), offer (a choice that pauses the run; none does yet). The first plan's words have no successor where the design has no such thing: there is no shield, no healing drink, no dodge, no critical strike, no evasion and no resistance.

Modifier operations are shown to players as `+12` (flat), `+12%` (inc) and `x1.20` (more).

## Run state

`Sim.create(cfg)` returns the run state `S`. It is plain data plus pools and grids. Presentation reads it and never writes it. These are the fields as `20-sim.js` makes them; its header comment says more about each.

```js
cfg = {mode, zone, seed, char, account}       // seed: a number or a string. mode defaults to 'household'.
                                              // Char.begin makes it for a character's vigil: char is a deep copy, which
                                              // the run changes (experience and levels, the lines its worn finds take,
                                              // what it finds) and the game keeps (Char.checkpoint, Char.end); account
                                              // is what the run reads of the save, {frame, open, warned, bequests}:
                                              // the Bellframe, what bequests opened, the Register's head start for
                                              // each attack that killed a character, and the Household's bequests as
                                              // they stood (copies all; see "Stage 2 systems")
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
  cause: null|{attack, kind, toll},           // the harm that last took the player to no life (the fall into
                                              // Tolled-for, or death): the attack's id (null for the press of a body,
                                              // a rider or the ground), its kind of harm, the toll it came at.
                                              // 11-damage sets it; the Register is written from it.
  dirty,                                      // set it to true when modifiers, the loadout, a count of a per modifier
                                              // or player.conds changed: the sheets are rebuilt in the same step, or at
                                              // once after a command. A run with a character is marked so at every
                                              // toll, for the toll rings of the Plan.
  result: null|{outcome:'left'|'spared'|'died', mode, zone, seed, steps, time, tolls, threat, kills, coin, banked, hum,
                runLevel, haul /* how many finds */, eventsDropped, cause},
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
| **`10-stats`** | sim | the tables of section 15 of `02-combat.md`; sheets | the tables `Stats.TYPES`, `TYPE`, `FAMILIES`, `PRIMARIES`, `PER`, `AILMENTS`, `AILMENT`, `RULE`, `COND_MAX`, `TAGS`, `CONDS`, `COND`, `STATS`, `WANTS`, `POSTURES`, `POSTURE`, `LEVEL_MAX`; `Stats.stat(id)`, `Stats.is(table, id)`, `Stats.condMask(conds)`, `Stats.scaled(value, level)`, `Stats.resolve(mods, level, out?)`, `Stats.share(have, want)`, `Stats.query(mods, stat, tags?, conds?, primaries?)`, `Stats.holds(mod, conds)`, `Stats.queryRange(mods, stat, tags, conds, primaries, out)`, `Stats.sheet(mods, ctx) -> Sheet`, `Stats.skillSheet(mods, voiceInst, sheet) -> SkillSheet`, `Stats.hitMult(skillSheet, kindIndex, conds)`, `Stats.fits(voiceDef, knotDef)` |
| `11-damage` | sim | hits, guards, the lee test, conditions, posture of the dead, Drag ticks | see "Stage 1 systems" |
| `12-items` | sim | finds: making one, what it gives, the lines a toll writes, chisel, re-walk, recast, cut, cooling, prices | see "Stage 2 systems" |
| `13-tree` | sim | the Plan: one route, doubling, beaten bounds, toll rings, banks, straight miles | see "Stage 2 systems" |
| **`14-character`** | sim | a character of the Household as plain data, and everything done to one: making it, the modifiers it brings to a vigil, the Plan's route, finds, voices and knots, observances and Heed, experience and levels, the end of a vigil (banking, Tolled-for, death and the Register, mourning, bells) | `Char.SLOTS`, `Char.PLACES`; `Char.create(save, classId, name, bells?)`, `Char.find(save, uid)`, `Char.open(save, classId)`, `Char.classes(save)`, `Char.mods(char, S, account) -> [Mod]`, `Char.weapon(char)` (always `null`: no tool is a weapon), `Char.sheet(char, account)`, `Char.findMods(find, attrs, out)`, `Char.lineMod(line, share)`, `Char.notches(find)`, `Char.points(char)`, `Char.allocate(char, nodeId, choice?)`, `Char.refundPrice(char)`, `Char.refund(char, account)`, `Char.equip(char, uid, slot, chest)`, `Char.unequip(char, slot, chest)`, `Char.places(char)`, `Char.place(char, voiceUid, place)`, `Char.voice(uid, voiceId)`, `Char.rope(level)`, `Char.tie(char, voiceUid, at, knotId)`, `Char.untie(char, voiceUid, at)`, `Char.give(char, chest, what)`, `Char.take(char, chest, what)`, `Char.heed(char, account)`, `Char.learn(char, id)`, `Char.hold(char, id, account)`, `Char.release(char, id)`, `Char.need(char, mode?)`, `Char.gain(char, xp, mode?)`, `Char.mourning(char)`, `Char.trueRing(weights)`, `Char.begin(save, uid, zone, seed) -> cfg`, `Char.checkpoint(save, S)`, `Char.end(save, S) -> report`, `Char.abandoned(save) -> report`, `Char.retire(save, uid) -> bell` |
| `15-progress` | sim | bequests and what they open; the end of a vigil for them | see "Stage 2 systems" |
| **`16-savedata`** | sim | the save as versioned JSON, its migrations and its check, the text of an export | `SaveData.VERSION` (3), `SaveData.KEY` (`'save'`), `SaveData.LIMITS`, `SaveData.blank()`, `SaveData.uid(save)`, `SaveData.clone(value)`, `SaveData.MIGRATIONS`, `SaveData.migrate(raw) -> {save, errors, notes}`, `SaveData.validate(raw) -> [error]` (never throws), `SaveData.read(raw)`, `SaveData.encode(save) -> text`, `SaveData.decode(text) -> {save, errors, notes}` (never throws) |
| `17-bellframe` | sim | the Bellframe: what it gives a character, opening pits, ringing places, hanging bells, recasting gifts | see "Stage 2 systems" |
| **`20-sim`** | sim | run state, step order, commands, events, entity fields | `Sim.create(cfg) -> S`, `Sim.step(S, input?) -> boolean`, `Sim.command(S, cmd) -> boolean`, `Sim.emit(S, k, x, y, a, b, id)`, `Sim.spawnEnemy(S, id, x, y, opts?)` (an enemy, or `null` when the pool is full; opts `{level, rank, traits}`; the id may be a keeper), `Sim.rebuild(S) -> Sheet`, `Sim.end(S, outcome) -> result`, `Sim.result(S)`, `Sim.hash(S) -> uint32`, `Sim.debugScene(n, seed = 1) -> S`, `Sim.field(kind, name, value)`, `Sim.fields(kind)`, `Sim.state(name, make)`, `Sim.source(fn)`, `Sim.system(name, fn)`, `Sim.systems()`, `Sim.COMMON`, `Sim.ELITE`, `Sim.MINIBOSS`, `Sim.BOSS`, `Sim.NO_INPUT` |
| `21-player` | sim | the player: movement, posture, the turn rule, the class rule and trade, the heave, wounds and mending, pickups, run levels | see "Stage 1 systems" |
| `22-enemies` | sim | the wake; the dead's steering, separation, attacks and rules (procession, mourning, riders) | see "Stage 1 systems" |
| `23-skills`, `24-archetypes` | sim | voices speaking, the pull; the archetypes `ring`, `rap`, `bar`, `spark`, `cone` | see "Stage 1 systems" |
| `25-boss` | sim | the keepers' phases | see "Stage 1 systems" |
| `26-director` | sim | tolls' effects, the count, spawns, elites, lychgates, ringing down, Tolled-for's lychgate, drops, district rules | see "Stage 1 systems" |
| `27-favours` | sim | the row and its walk-in offers | see "Stage 1 systems" |
| `27-notches`, `27-observances`, `28-bequests` | sim | the parts of Stage 2 that run in a vigil, each a `Sim.system`: bequests counted and the keeper's Hum; the postures of a toll period and the lines a toll writes, finds dropped, the heave; observances' promises, and the voices and knots the dead leave | see "Stage 2 systems" |
| `28-bot` | sim | scripted players | see "Stage 1 systems" |
| **`29-world`** | sim | seeded regions, authored and scattered props, roles, obstacles | `World.region(seed, zoneDef, x?, y?) -> {x, y, radius, startX, startY, props, grid}`, `World.propsNear(S, x, y, r, out) -> count`, `World.withRole(S, role, out) -> count`, `World.pushOut(S, ent) -> boolean`, `World.CLEAR`, `World.GAP`. The ground's height, the tide, depth, bands, currents and fresh water (`02-combat.md`, section 15.13) arrive with the Ropewalk; until then every place is dry. |
| **`30-modes-curves`** | content | the two modes, the level curves, the constants of a run, the debug zone | modes `household` and `watch-night`; curves `main` (for levels 1 to 70: `enemyLife`, `enemyDamage`, `enemyXp`, `charXp`, `nightXp`, `runXp`; and `rank[0..3]`); constants `main` (`spawnRadius`, `despawnRadius`, `tollSeconds`, `keeperToll`, `gateEvery`, `gateOpenSeconds`, `gateRadius`, `ringStrokes`, `strokeSeconds`, `backSeconds`, `caps`, `gridCell`, `playerRadius`); zone `debug`; enemy `debug.husk` |
| `31` to `49` | content | one file per class with its voices; the dead, keeper and favours of each district; puppets, props and tilesets; the Plan (`32`), bases and the posture tables (`33`, `34`), knots and observances (`35`, `36`), the Bellframe (`44`) and bequests (`45`) | `Defs.add(...)` only; the files of the first vigil are under "Stage 1 systems", those of the Household under "Stage 2 systems" |
| **`48-puppets-test`**, **`49-tilesets-test`** | content | test figures, props and grounds for the views and their tests | `Defs.add(...)` only |
| **`50-platform`** | presentation | namespaces, the browser as the game sees it, the notice board, storage adapter | `Plat.query(name)`, `Plat.isTouch`, `Plat.dpr()`, `Plat.now()`, `Plat.loop(fn)`, `Plat.stop()`, `Plat.onVisibility(fn) -> off`, `Plat.onResize(fn) -> off`, `Plat.on(name, fn) -> off`, `Plat.emit(name, a, b, c)`; `Store.read(key)` (a promise of an object or `null`), `Store.write(key, obj)` and `Store.remove(key)` (promises of a boolean), `Store.status` (`'saved'`, `'memory'` or `'error'`), `Store.onStatus(fn) -> off` |
| **`51-settings`** | presentation | the player's settings, stored; the settings screen | `Settings.define(key, spec)` (spec `{value, label, group, order}`, plus `min, max, step, format, live` for a number or `options [{value, label}]` for a choice; a boolean value makes a switch), `Settings.get(key)`, `Settings.set(key, value) -> value held`, `Settings.on(key \| 'group.*' \| '*', fn(value, key)) -> off`, `Settings.row(id, order, build(back))`, `Settings.open() -> element \| null`, `Settings.keys()`, `Settings.reset()`, `Settings.loaded` |
| **`52-input`** | presentation | keyboard, mouse, gamepad and touch into one frame a step; the touch stick and buttons | `Input.sample() -> InputFrame` (one live object, refilled; only `90-game` calls it), `Input.FIELDS` (button A is the frame's `trade`, button B its `heave`), `Input.button('A' \| 'B', {icon, cooldown, charges, hidden, label})`, `Input.onPause(fn(device)) -> off`, `Input.buzz(ms) -> boolean`, `Input.device` |
| **`53-sound`** | presentation | sound effects from code recipes: per-effect gap, voice cap and priority; 32 voices (24 on touch); panning by screen place; suspended when hidden; offline rendering | `Sound.define(id, recipe, limits)`, `Sound.has(id)`, `Sound.list()`, `Sound.info(id)`, `Sound.sfx(id, {x, y, level, pitch, key, wet}) -> handle`, `Sound.stop(handle, fade)`, `Sound.stopAll(fade)`, `Sound.render(id \| recipe, opts, seconds)`, `Sound.bake(...)`, `Sound.suspend()`, `Sound.resume()`, `Sound.state`, `Sound.bus(name)`, `Sound.stats(id?)`; recipe helpers `env, tone, noise, bell, replay, click, creak, crackle, water, note, rand, vary` |
| **`54-music`** | presentation | music scheduled ahead from the frame loop; change-ringing rows; the piece `'vigil'`, at rest on the title and in a run without a piece of its own; the Household and the Lantern play `'lantern'` (77-lantern.js) | `Music.define(id, piece)`, `Music.has(id)`, `Music.list()`, `Music.play(id, {fade, intensity})`, `Music.stop({fade})`, `Music.intensity(v, glide)`, `Music.tick()`, `Music.toll(opts)`, `Music.changes(n, method, rows)` |
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
| `72` to `77` | presentation | the title and results (`73`); the Plan (`74`), finds (`75`), voices, knots and observances (`76`), the Lantern, the Household, the Bellframe, the Register and bequests (`77`); later onboarding | screens registered with `UI.screen` |
| **`90-game`** | presentation | the states title, Household, Lantern, run and results; the save of the Household, read at boot and written through `Store`; the frame loop with its 60 Hz steps (at most 4 a frame), paused when hidden; stand-in title, Household, Lantern, save text, results and picture | `Game.boot() -> Promise`, `Game.start(cfg)` (the run, or `null`), `Game.title()`, `Game.household()`, `Game.lantern(uid?) -> char`, `Game.vigil(zone?, seed?) -> S`, `Game.make(classId, name, bells?) -> char`, `Game.write() -> Promise`, `Game.exportText() -> text`, `Game.importText(text) -> {ok, errors, notes}`, `Game.command(cmd) -> boolean`, `Game.sim(seconds, {bot, policy}) -> steps`, `Game.S`, `Game.state`, `Game.save`, `Game.char`, `Game.report`, `Game.ROOMS`, `Game.debug`, `Game.VERSION` |
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
11b each system of Sim.system          in the order they were registered (the files' order): the parts of Stage 2
                                       that run in a vigil. A system reads this step's events and S.toll, which rose
                                       at the end of the step before when a toll rang.
12  Sim.rebuild(S), if S.dirty
13  Offers.step(S)
14  the clock: S.step, S.t, and on time S.toll + 1 with a 'toll' event; a run with a character is marked dirty
```

In a debug scene (`Sim.debugScene`, `S.debug` not null) steps 2, 4 and 7 give way to the scene's own rule: every husk walks a ring round the spot where the player began. Without `Player.step`, the move vector of the input walks the player there at 5 m/s.

**What is called if it exists.** The kernel and the game are written against systems that come later, and ask with `typeof` before each call. These are the signatures they use; whoever writes the system keeps to them, or changes the caller in the same change.

- `Sim.step`: the hooks of the list above.
- `Sim.command`: `Offers.resolve(S, cmd)` for `pick`, `banish`, `reroll` and `skip`; `Char.allocate(char, id, choice)` and `Char.equip(char, uid, slot)` (which wears nothing without a chest, so it is refused in a vigil). Each counts as done unless it returns `false`.
- `Sim.rebuild`: `Char.mods(char, S, account) -> [Mod]` and `Char.weapon(char)` (a weapon profile `{family, damage, aps}`, or `null`: always `null` in the game).
- `Char.mods`, `Char.create`, `Char.end`, `Player.step` and `Player.pickups` call the Stage 2 packages' functions when they exist: `Tree.mods`, `Bellframe.mods`, `Items.mods`, `Items.make`, `Items.cool`, `Items.heave`, `Progress.endVigil`, and read `S.observances.broken`; "Stage 2 systems" gives their signatures. `Player.pickups` calls `Char.gain` for every ember of a character's vigil.
- The frame loop of `90-game`: `Input.sample() -> InputFrame`, once for each step; `Scene.draw(S, alpha)`, once a frame while there is a run.
- `Game.sim`: `Bot.input(S, policy) -> InputFrame` and `Bot.choose(S, offer)`, which returns the index to pick or a whole command.
- `Game`: `SaveData` and `Char` (the save, a character's vigil and its end); without them the build keeps no Household and the title begins a vigil without a character.

**The frame.** `90-game` adds up frame time and spends it in steps of 1/60 s. A step runs as soon as any time is owed, so after a frame the simulation stands where the frame is or up to one step ahead, and `alpha`, above 0 and up to 1, says where the frame lies between the last two steps: a thing is drawn at `px + (x - px) * alpha`. On a 60 Hz screen each frame is one step and `alpha` is 1. No step runs while a screen that pauses is open (`UI.pausing()`), while `S.phase` is `'offer'`, while the page is hidden, or once the run has ended. Menus send commands through `Game.command(cmd)`, not `Sim.command`, so that the readers of events hear of them.

Files that load before `90-game` cannot call it while they load. They hear from it through the notice board, `Plat.on(name, fn)`:

| Notice | Arguments | When |
|---|---|---|
| `'boot'` | `view` | once, in `Game.boot`, when the view exists and before the title opens: the moment for a module to set itself up |
| `'state'` | `state, before` | the game changed state: `'title'`, `'household'`, `'lantern'`, `'run'` or `'results'` |
| `'save'` | `save, why` | the save changed and is being written through `Store`: `why` is `'made'`, `'chosen'`, `'vigil'`, `'toll'`, `'hidden'`, `'end'`, `'unfinished'`, `'import'` or `'write'` |
| `'step'` | `S, live` | after every simulation step; `live` is false inside `Game.sim`. The place to read `S.events` |
| `'command'` | `S, live, cmd` | after a command sent with `Game.command`, or by `Game.sim` to resolve an offer |
| `'frame'` | `S, alpha, dt` | once a frame, after drawing; `S` is `null` while there is no run |
| `'resize'` | `cssW, cssH, dpr` | the view was fitted to a new size |
| `'device'` | `name` | posted by `52-input`: the player switched to `'keys'`, `'mouse'`, `'pad'` or `'touch'` |
| `'quality'` | `level` | posted by `66-gfx-gl` when it stepped itself down after slow frames |
| `'ui'` | `what, id` | posted by `70-ui-core`: `'move'` (focus moved), `'press'` (a control was activated), `'open'`, `'close'` or `'back'`; `id` is the screen's id, or `null` |

What `55-sound-core` reads from the events: `'hit'`, `'kill'` (`a` = rank), `'hurt'`, `'mend'`, `'scar'`, `'pickup'` (`a` = kind, `b` = value: a big pickup when `a` is not 0 or `b` is 10 or more), `'favour'`, `'level'`, `'offer'`, `'count'` (`a` strokes, `b` elites, `id` `'gate'` for the low stroke), `'toll'`, `'gate'` at the place a lychgate opened, and `'telegraph'` at the place an attack will land. It plays ringing down while `S.gate.ring` grows. `69-vfx` reads the same and `'cast'`, `'wound'`, `'pull'`, `'trade'`, `'heave'`, `'drop'`, `'phase'` and `'stroke'`; `68-scene` reads `'cast'`. An emitter that gives these fields another meaning changes those files in the same change.

The screens `'title'`, `'household'`, `'lantern'`, `'save-text'` and `'results'` of `90-game` are stand-ins, registered at boot only if no other file has registered those ids. `'results'` is opened with `{S, result, report}` (`report`: what `Char.end` did, for a character's vigil; else `null`), `'lantern'` with `{char}`. `Scene.draw` is called only while there is a run; on the title, the Household and the Lantern the game draws the empty ground itself.

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
Mod      = {stat, op:'flat'|'inc'|'more'|'set', value:Scaled|[min,max], tags?:[Tag], cond?:Cond|[Cond], unless?:Cond|[Cond],
            per?:{stat:Primary|'level'|'observances'|'favours'|'finds'|'debts', div, cap?}, local?:true}
            // a [min,max] value only on added.<Kind>. cond: the condition, or every one of a list, must hold; unless:
            // none of them may (a written line cut backward works "while not Braced": unless 'braced'). A condition
            // about the body struck (t-) in either is settled per hit (SkillSheet.targetMods).
ModRange = {stat, op, tags?, cond?, unless?, local?, min, max}
// What a voice, a knot and a find want of an attribute is no field: the share rule (Rules) works it from the tier,
// or from a find's written lines. Nothing is locked.

Voice     = {id, name, text, icon, attr:Primary, tier:1..5, tags:[Tag], weapon:null, archetype, target, rate:Scaled,
             damage:{[Kind]:[Scaled,Scaled]} /* exactly one kind */, weaponPct:0, eff, crit:0, params:{[key]:Scaled},
             mods:[Mod], fx:{puppet?, cast?, hit?, sfxCast?, sfxHit?, light?, ...}}
             // archetype: 'ring'|'rap'|'bar'|'spark'|'cone', and what Skills.archetype adds
             // target: 'nearest'|'densest'|'random'|'farthest'|'aim'|'self'
VoiceInst = {uid, id, level:1..20, rope:2..5, knots:[knotId|null x rope], tolls}     // tolls: spoken through, equipped,
                                                              // in vigils survived; a level every 8 ("The Household's shapes")
Knot      = {id, name, text, icon, attr:Primary, tier, requires:[Tag], excludes:[Tag], addTags:[Tag], mods:[Mod],
             params:{[key]:number}, trigger:Trigger|null, rule?:knotRule|null}
             // rule: the rule it changes (Running Line, Stone's Answer, ...), a word its registry allows
Trigger   = {on:'kill'|'hurt'|'pull'|'trade'|'heave'|'timer', chance, cooldown}
Observance = {id, name, text, icon, attr, tier, heed:20..40, mods:[Mod], aura:null, promise?:promise|null,
              params?:{[key]:number}}
             // heed: the Heed it holds; promise: the promise the thumb keeps (a word its registry allows) and params its
             // numbers (Stability's 12 m); while it is broken the mods stop until the next toll

Class   = {id, name, text, attrs:{[Primary]:n}, perLevel:{[Primary]:n}, base:[Mod], door?:0..5,
           voices:[voiceId x 1..6] /* the starting loadout, in place order */, startGear:[baseId],
           trade:{name, text, icon, recharge}, callings:[id,id], unlock:bequestId|null, puppet, palette:[hex]}
           // the class's first attribute starts at 10 and its second at 5; each level adds 2 and 1 (03-classes.md)
Calling = {id, class, name, text, points:8,
           nodes:[{key, kind:'lane'|'corner'|'square', name, text?, icon?, mods:[Mod], requires:[key], row, col}]}
           // its small tree speaks the Plan's words; a class and its two callings name each other
Peal    = {id, name, text, icon, calling, rule:pealRule|null, points, params?:{[key]:number}}
           // a vigil kept to one rule of the calling from the first toll to the keeper's fall; points: what it gives

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
            reward:{class?, bill?:{zone, causes:[causeId x 1..4]}, base?, observance?, voice?, planPoints?, coin?, hum?}}
            // done when `count` events of kind `on` that fit `where` have come, in the Household (account) or to one
            // character; it opens a class, a Bill, a base, an observance, gives a named voice, Plan points, coin, Hum
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
Event   = {k:'hit'|'kill'|'cast'|'hurt'|'wound'|'mend'|'scar'|'pull'|'trade'|'heave'|'pickup'|'level'|'grow'|'offer'
           |'favour'|'telegraph'|'phase'|'drop'|'toll'|'count'|'gate'|'stroke'|'end', x, y, a, b, id}
           // and the kinds a system allows with Defs.allow('event', k) ("Stage 2 systems")
```

The kinds of Stage 2 (`04-progression.md`):

```js
Plan      = {id:'main', name, text?, rings:1..12, streets:3..24, ringGain, bankGain, mileGain, mileFrom, mileMost,
             loopMost, loopShare:0..100, refund, look?:{}}
             // the numbers of the Plan's rules: a node of ring N works from toll N - 1, its values x (1 + ringGain/100
             // x (N - 1)); a bank node x (1 + bankGain/100); a milestone + mileGain% for each held node beyond the
             // mileFrom-th in the unbroken run of its street, mileMost at most; a loop of loopMost nodes or fewer
             // grants its inside at loopShare%; refund: the coin to take back the head, times its ring. look: the
             // screen's own (colours, the river), free
Node      = {id, kind:'door'|'lane'|'corner'|'square'|'milestone', ring:1..rings, street:0..streets-1|null,
             bank:'flood'|'ebb'|null, x, y, name, text?, icon?, mods:[Mod], choice:[Primary x 1..4]|null,
             links:[nodeId x 1..8], class?:classId}
             // a door is a class's start (class names it; nothing else has class) and gives nothing; only a lane offers
             // a choice, one point of an attribute chosen; a milestone stands in a street; only a square uses more;
             // links go both ways and never to the node itself. x, y: its place on the street plan, for the screen
Base      = {id, name, text?, slot:'tool'|'hat'|'coat'|'hands'|'girdle'|'pattens'|'token', family:Family|null, level,
             fixed:ModRange, tables:{[Posture id]:{verbs?:{[key]:w}, objects?:{[key]:w}}}, icon, named?:true,
             unlock:bequestId|null, weight}
             // what a find is made from. Only a tool has a family. fixed: its one fixed line, rolled within the range;
             // tables: the weight it gives an entry of a posture's table (times the entry's own w; 1 where it names
             // none). A named find is a base with named true and a strong fixed line, which alone may use more.
             // A token fits either token place. weight: how often it drops
Posture   = {id:'stood'|'strode'|'pressed'|'timed', name, text?,
             verbs:[{key, stat, op:'flat'|'inc', band:[[lo, hi] x 8], grow, w} x 1..200],
             objects:[{key, tags:[Tag], w} x 1..200]}
             // the table a posture writes lines from (Stats.POSTURES gives its condition and attribute): a verb is a
             // stat and an amount, band[t - 1] the amount's range for a line written at toll t (the eighth and later:
             // band[7]) on a find of level 1, grow the percent it rises for each level above the first; an object is
             // the tags a line is held to. w: how often each is drawn
Bellframe = {id:'main', pitFirst, pitGrowth, placeFirst, placeGrowth, placesMost:1..8, trueLow, trueHigh, trueGain,
             weighPer, recast, deathHum}
             // the Bellframe's numbers (open: a package may add its own): the first pit after the tenor costs pitFirst
             // Hum and each after it pitGrowth times the last, ringing places likewise; a neighbouring pair of rung
             // bells whose weights differ by trueLow to trueHigh percent of the heavier rings true, trueGain percent
             // on every gift rung; a bell's gift works at level 1 + floor(weight / weighPer), at most 20; recast:
             // the Hum to recast a gift; deathHum: Hum x the toll, for a death by a cause new to the Register
Pit       = {id, name, text, icon, from:pitId|null, grant:[Mod], x, y}
             // a place of the Bellframe: it opens from the pit `from` (the tenor pit from none: there is one); its
             // printed grant, flat and inc only, reaches every character; it holds one bell
Gift      = {id, name, text, icon, class, calling:callingId|null, mods:[Mod]}
             // what a bell gives those who ring it, fixed by its class and calling (one for each class without a
             // calling, one for each calling); flat and inc only; its Scaled values work at the bell's level
```

The Household's shapes are not definitions but what a game keeps: `14-character.js` makes and changes them, `16-savedata.js` checks them, and the save holds them. Uids are the save's: characters, finds, voices and bells share `save.uid` (`SaveData.uid(save)`); what a vigil makes has a uid below 1 until `Char.checkpoint` or `Char.end` gives it one.

```js
Char  = {uid, name, class, calling:callingId|null, callingPoints, callingNodes:[key], peals:[pealId], level:1..70, xp,
         planPoints, plan:{walk:[nodeId], choice:{[nodeId]:Primary}}, worn:{[slot]:Find|null}, voices:[VoiceInst],
         loadout:[voiceUid|null x6], knots:{[knotId]:n}, observances:[observanceId], known:[observanceId],
         bells:[bellUid], mourning:null|{term, left}, tolls, vigils, bequests:{[bequestId]:{n, done}}}
         // worn: the eight places Char.SLOTS (tool, hat, coat, hands, girdle, pattens, token-1, token-2). plan.walk:
         // the route, from its class's door, a node at most twice; choice: the attribute of each lane. voices: all it
         // holds, the loadout's six places (opening at Char.PLACES: levels 1, 3, 8, 15, 25, 35) naming some; knots:
         // those it holds untied. observances: those it keeps (their Heed held); known: those it may keep. bells: the
         // bells it rang when it was made. tolls, vigils: its life so far
Find  = {uid, base, level, fixed:Mod, lines:[Line|null x8], gone:[place], walk:-1|place, cool:0..4}
         // fixed: its fixed line as rolled. gone: places cut away or erased for good. walk: a place struck for a
         // re-walk. cool: the steps a recast find still rises before it is first worn
Line  = {stat, op, value, tags:[Tag], cond:Cond, posture, toll, backward, struck:null|'object'|'condition', band:[lo, hi]}
         // one written line: verb (stat, op, value), object (tags), condition (the posture's: cond; backward, it
         // works as unless); the toll it was written at; a word struck by the chisel; the band its value rolled in
Bell  = {uid, of, name, class, calling, weight, gift:giftId|null, pit:pitId|null, double, known:[observanceId]}
         // a dead or retired character recast: weight, the tolls of its whole life; pit, where it hangs (null: not
         // yet hung); double, it rings double (the Watch-night's bede-roll); known, the observances it teaches
Death = {uid, name, class, calling, level, tolls, vigils, zone, toll, cause:null|{attack, kind}, how:'died'|'retired', bell}
         // a line of the Register
Save  = {v:3, rev, uid, chars:[Char], register:[Death], chest:{finds:[Find], voices:[VoiceInst], knots:{[knotId]:n}},
         account:{coin, hum, heard, frame:{pits:[pitId], places, bells:[Bell]},
                  open:{classes:[classId], bases:[baseId], observances:[observanceId], bills:[{zone, causes}]},
                  bequests:{[bequestId]:{n, done}}},
         active:charUid|null, away:null|{char, zone, seed, hum, heard, level, tolls}}
         // rev: the writes so far; hum: held, heard: ever heard; away: a vigil under way (Char.begin sets it,
         // Char.end and Char.abandoned clear it). Settings keep their own key (51-settings.js).
```

`SaveData.validate` holds a save to more than its fields' types, and never throws: every uid is unique and no higher than `save.uid`; every id names a definition that exists (a death's and a bell's ids are history, and need only be ids); a route starts at its class's door, steps only between linked nodes, holds a node at most twice and spends no more points than it has, and every lane on it has its attribute chosen; a worn find sits in a place its base fits; a voice's rope is what its level gives, and each knot tied fits it; the loadout names the character's own voices, each once, none in a place its level has not opened; it keeps only observances it knows; it rang bells of the frame; a bell hangs in an open pit, one to a pit, and every open pit opens from another open one; the active character and the one away stand in the Household. `SaveData.MIGRATIONS` brings older saves up one version at a time: version 1 (the first plan's placeholder) to 2, and 2 to 3, where the route of a character made before the Plan was laid out, which is empty and from which no point can be laid, starts at its class's door (the shape is the same; a class with no door yet keeps its empty route). `SaveData.migrate` notes each route it began.

`Defs.SCHEMA` in `01-defs.js` holds the shapes of the definitions as data, and `Defs.finalize()` checks every definition against them at boot; each fault reads `kind id: field problem`. The check is stricter than the lines above in four ways:

- A field without `?` is required. An `Attack` carries all 17 of its fields, a class exactly two callings and one to six voices.
- An object holds no field that its shape does not list. The exceptions are `fx`, `ambient` and `anim`, and the kinds tileset, curves, constants, trait, cause and bellframe, which may carry more.
- A field the design keeps at one value holds only that value (a spec with `only`): a voice's `crit` is 0, its `weapon` null and its `weaponPct` 0; an attack's `evadable` is false; an observance's `aura` is null.
- Every id that names another definition must exist. This is not checked while the kind it points into has no definitions at all, which keeps a build without (say) its puppets valid: `debug.husk` names a puppet of its own id, and once any puppet is registered that one must be there too.

It also checks the design's rules that a spec cannot say: a voice deals exactly one kind of harm; no enemy's guard is for a bare kind (the Swell); a favour's modifiers are `flat` or `inc`, and only a turned favour switches a `flag.`; `more` is found only on knots, squares, callings and named finds, so a pit's grant, a gift and a written line add with `flat` and `inc` only, and no other node, base or observance uses `more`; the Plan's links go both ways, a door names its class and nothing else does, a milestone stands in a street, only a lane offers a choice, and a node lies within the plan's rings and streets; a tool has a family and nothing else does; a posture is one of the four, its keys are its own and its bands run from less to more; a class and its callings name each other, and so do a gift and its calling; there is one tenor pit.

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

**Posture and the turn rule** (sections 1 and 4). A body's posture comes from its steering speed against its top speed on dry ground as it stands, less what its riders (8% each) and the player's finds (`find-weight` each) take off it (water, when it comes, slows a body against the unladen number): under 15% it is still, and Braced once still for `brace-time` (the dead 0.4 s) until its speed reaches 15% or it is shoved 0.3 m or more; at 15% or more it is moving, and Striding once at `stride-share` (the dead 70%) or more for 0.25 s, until it falls below. A body faster than 30% of its top speed records its heading every 0.1 s; when its heading turns more than its turn limit (the dead 90°, the player `turn-limit`) from any heading of the last 0.5 s, it is Wrong-footed for 0.5 s (keepers 0.25 s) and takes 50% more from all harm (`wrong-foot` against the dead, `wrong-foot-taken` against you). The Change-ringer's pull never wrong-foots the player.

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
                                                     spares the body, the body cannot carry it, it is sealed or immune,
                                                     and on the player while an Open Lead beat holds (Skills.beat: no
                                                     condition can be put on you then, no swing is counted on you and
                                                     no rider climbs on)
Dmg.lift(S, body, row) -> boolean                    ends one, unless the body is sealed
Dmg.warning(S, source, attack) -> seconds            the warning added to the fill of a Swell aimed at the player: free
                                                     Heed x 0.01 + warn + the Register's head start for that attack id
                                                     (S.cfg.account.warned[attack]: 0.15 s a death, three at most;
                                                     Char.begin works it out) (+ 0.3 when source is Sounded), at most
                                                     1. A district's own rule (the Dial's shadow: 0.3 s less) is the
                                                     vigil's.
Dmg.large(e) -> boolean                              its def's size is 'large', or its rank is elite or above
Dmg.POSE = {still: 0, braced: 1, moving: 2, striding: 3}     the values of the field pose
```

As built, it also exports `Dmg.carries(body, row)`, `Dmg.inside(area, x, y, r)` (the one test of an area's circle, wedge or lane that the scene also uses) and the posture helpers the player shares with the dead (`Dmg.posture`, `record`, `turn`, `SAMPLE`, `FAST`). `Dmg.hitPlayer` takes a source that has a `team` (a shot or an area) as already carrying its whole harm, so `attack.mult` is not applied again; a body's attack is scaled by `mult`.

It names the rows `wrong-footed`, `in-procession`, `sounded`, `coiled`, `swing`, `sealed`, `tolled-for` and `clung` (Drag of riders), and the modifier conditions of a body struck (section 15.7). Events: `'hit'` (x, y the body; a = H; b = the mask of kinds dealt), `'hurt'` (x, y the player; a = the life lost, 0 while Tolled-for; b = the kind index; id = the attack's id, or null for a press, a rider or the ground), `'wound'` (x, y the wound's centre; a = the life this harm put in it; b = its depth now, seconds; id = `'open'` or `'join'`).

### 21-player.js (combat). Owns: Player, Buffs

```
Player.step(S, input)                phase 1: movement (move-speed, less find-weight a find carried and 8% a rider; 20%
                                     faster while Tolled-for; pushOut), posture, headings and the turn rule, the class
                                     rule and the trade (input.trade), the heave (input.heave: Items.heave(S) when the
                                     finds' package has it, else nothing, and the HUD hides button B), mending, scars,
                                     and S.player.conds (the flickering braced, striding, crowded and in-water held
                                     0.25 s before the mask changes; S.dirty when it does)
Player.pickups(S)                    phase 10: pickups of kinds 0 (ember: value is experience, added to p.runXp; when
                                     runXp reaches S.curves.runXp[min(runLevel, 69)] it is spent and runLevel + 1; and
                                     to the experience of the run's character by Char.gain, kept at once: a level it
                                     gains sets S.dirty and emits 'grow'), 1 (coin: value added to S.coin; none in full
                                     mourning, the flag full-mourning) and 2 (a find, into S.haul), drawn in within
                                     pickup-reach. Kind 3 is the favours'. A pickup whose state is below 0 is held back
                                     by a system (an observance's promise) and left lying.
Player.classRun(classId, level?) -> {class, level, mods, voices}     the cfg fields of a run without a character: the
                                     class's attributes as flat modifiers (attrs + perLevel x (level - 1)), its base
                                     modifiers, and its voices as VoiceInst at level 1 with a rope of 2. The tests start
                                     a vigil without a character with Game.start(Object.assign({zone: 'dial', seed},
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

Full Mourning's sight (Stage 2): while `S.observances.sight` is above 0 (7 m, then 10, then 14, as the observance lightens), each of the dead but a keeper that stands farther than that from the player cannot make it out. The enemy fields `seenX`, `seenY` hold where it last made the player out (where the player stood when it rose, then wherever it saw it) and `lost` is true while it cannot: it walks to its last sight and stands there, and begins no attack (a wind-up begun while it saw the player still lands). Within sight it steers by its behaviour again. A hanger-on climbs onto no player during an Open Lead beat (`Skills.beat`).

### 25-boss.js (vigil). Owns: Boss

`Boss.step(S)`, phase 7: the keeper in `S.boss` (the Director spawns it at the eighth toll, `keeperToll`, and sets `S.boss`): its phases by its life (the Half-muffled Keeper: a full Swell then its echo at 30% 2 s later on the same ground; from 60% the echo first and the full stroke 1.2 s later; from 25% three echoes laid, then their full strokes in reverse order). Its state lives in the keeper's own fields and in a slot of its own if it needs one. Events: `'phase'` (x, y the keeper; a = the phase entered; id = the keeper's id) and `'telegraph'` as above.

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
                                         favours, fights the keeper close while its life is half or more, rings down
                                         at a lychgate once the keeper is laid or whenever its life is low, where few
                                         of the dead stand at the lychgate or its time runs out, and runs for the far
                                         lychgate when Tolled-for)
Bot.choose(S, offer) -> index | Command  for an offer that pauses (none in Stage 1)
```

Its memory between steps lives in `Sim.state('bot', ...)`. `Game.sim(seconds, {bot: true, policy})` drives it; the acceptance of Stage 1 (ten minutes of a vigil, the keeper, ringing down) is played with `'vigil'`.

### 71-hud.js and the screens (screens). Owns: Hud, Glyphs

`71-hud.js` draws into `#hud` on the notice `'frame'`, and keeps `Hud` for what tests and other screens read (`Hud.stats`, for one). From the run it shows: the life bar (`S.player.life` in the class colour, the life lying in `S.wounds` as a pale part, `S.wounds.scarred` and Hand on the Bell's `S.observances.scarred` as a dark end, against `S.sheet.stats['life-max']`); the Heed bar under it (free Heed bright: `heed-max`, all free in Stage 1); the row (`S.row.ids`, the first `S.row.raised` places raised; each favour's `icon`); the toll ring in the last 3 s before `S.tollAt` and a tick at each quarter of `S.tollSteps`; the count as marks when the setting asks (from `'count'` events); the haul (`S.haul`, one box a find, striped with its notches, `Char.notches`: the lines written on it, which the redraw follows); the buttons, through `Input.button('A', {icon, cooldown: S.player.tradeCd / (trade recharge x trade-recharge / 100)})` and `Input.button('B', {hidden: true})` while there is nothing to heave; Tolled-for (the player carries the row `tolled-for`) as a grey screen. `73-screens.js` registers `'title'` (its main control opens the Household, `Game.household()`; in a build that keeps no Household it starts a vigil of the Dial with `Player.classRun('change-ringer')`) and `'results'` (opened with `{S, result, report}`: the outcome, `result.tolls`, `kills`, `coin`, `banked`, `time`, and for a character's vigil who kept it and the way back to the Lantern, or to the Household after a death). The favours themselves rise in the world and are drawn by the scene; the screens show the row.

As built: `Glyphs.define(id, paint)` registers an icon recipe (paint gets helpers that draw outlined, flat-shaded unit shapes); `Glyphs.icon(spec) -> canvas` (a new one, for page elements; spec an id or `{id, size, ink, dpr}`), `Glyphs.image(spec)` (a cached canvas for `drawImage`), `Glyphs.draw(ctx, spec, x, y, size)`, `Glyphs.pick(...ids)`, `has`, `ids`, `slug`, and the palette `Glyphs.C`; an unknown id gets a token whose shape and colour come from its hash. `Hud.stats` is a live record of what the HUD last drew, and `71-hud.js` defines the setting `hud.count` (draw the count as marks; off by default). In a debug scene, which has no class, the HUD shows both buttons plainly. While Tolled-for, the view greys the world itself (`post.grey`, which keeps what glows, the far lychgate's lamps among it); the HUD lays a grey of its own only where the scene does not.

### The figures and the scene (figures)

`68-scene.js` draws, from the run: under every body its posture from `pose` (a closed pale ring when Braced, a short trailing streak when Striding) and a white flash of the outline while it carries `wrong-footed`; the wake from `S.wake` as a faint line, and a thin thread from each body In Procession (`condN` of `in-procession` is 1) to it; the wounds of `S.wounds` as deep red discs, darker for deeper, greying toward `wound-term`, with a ring closing while one mends; the dead's Swells (areas of team 1, and the voices' of team 0) as their shape filling in pale bone with a dark rim, the lee of props and large bodies cut out of it as clean ground; a Blow's wind-up through the rig (`state` 1, `stateT`, the attack `e.attack`); the conditions as shapes and colours on the bodies (`02-combat.md`, section 13); the open lychgate and its ring filling stroke by stroke (`S.gate.ring` against `ringStrokes x strokeSeconds`); the favours' shapes (pickups of kind 3, by their favour's `icon`). It reads no event but `'cast'`; `69-vfx.js` reads the events listed under "Modules".

What Stage 2 leaves on the ground, in the same language: Stability's ring (for each observance kept whose promise is `'stability'`, `S.observances.of[id]` with its params' `reach`: a ring that far out round where the last toll found the player, in `Scene.LOOK.promise`, brighter over its last 3 m, faint and dark while broken); Alms' cairns (a find whose pickup `Observances.held` calls `'cairn'`: a heap of three stones in `LOOK.stone`; one Full Mourning holds back is drawn darker); Back-splice's figure (`S.knots.figX`, `figY` of each place whose voice is tied with it: a pale ghost of the player's figure and a thin ring at its feet); Balance's throws standing mouth-up (shots of team 0 in state 1 that stand still: a small bell in the voice's colour, rocking with each light body that rocked it, `a1`). `Scene.stats` counts them as `rings`, `cairns`, `splices` and `balanced`.

## Stage 2 systems

Stage 2 ends in the Household (`docs/plan.md`, Appendix D; `04-progression.md`): standing characters kept between vigils until they die, with saves; one life and the Register; character levels; the Plan; voices with knots in their ropes; observances that hold Heed; written finds and the four ways to change them; the Lantern between vigils; the Bellframe and its Hum; bequests. Its acceptance: a character's level, Plan and finds survive a reload; export then import gives back the same save; a character that dies is on the Register and cannot be played; a pit opened in the Bellframe with one character changes the next; the Lantern's controls are at least 44 px on a phone. Callings and peals have their shapes, and `Char.mods` reads a calling's nodes, but a calling is first taken at the Ropewalk's keeper (`03-classes.md`): taking one, peals, Bills and the Watch-night wait for the districts that bring them.

The foundation is in place (package C0): the shapes (`01-defs.js`; "Data shapes"), `14-character.js` (`Char`), `16-savedata.js` (`SaveData`), `Sim.system` and `S.cause` in the kernel, the Register's head start in `Dmg.warning`, experience and full mourning in `Player.pickups`, the game's states and the save in `90-game.js`, and stand-in screens for the Household, the Lantern and the save as text. Four packages build the rest in parallel, each in its own files. The shared files (`00-core`, `01-defs`, `10-stats`, `14-character`, `16-savedata`, `20-sim`, `50-platform`, `90-game`, `99-boot`) are not edited by any of them: what a package needs from them is here. It extends them from its own files through `Defs.allow`, `Defs.extend`, `Sim.field`, `Sim.state`, `Sim.source`, `Sim.system`, `UI.screen` and `Plat.on`, and by defining the functions below, which the shared files already call when they exist. Every namespace a package needs is declared and collected. A package that needs more of a shared file (a field of the save, another hook) asks for it rather than writing it: the save's shape changes only with a migration in `16-savedata.js`, since `SaveData.validate` refuses a field it does not know.

### Who owns what

| Package | Files | Namespaces |
|---|---|---|
| the Plan | `13-tree.js` (the Plan's rules); the content `32-plan.js` (the plan `main` and its nodes: the street plan, its banks and bridges, the Change-ringer's door); the screen `74-plan.js` (`'plan'`) | `Tree` |
| finds | `12-items.js` (finds as data: making one, what it gives, writing a line, the four changes, cooling, prices) and `27-notches.js` (in a vigil: the toll period's postures, the lines a toll writes, the finds the dead drop, the heave); the content `33-bases.js` (the bases, with the Change-ringer's starting gear, whose ids it writes into the class's `startGear` in `31-change-ringer.js`) and `34-postures.js` (the four tables); the screen `75-finds.js` (`'finds'`) | `Items` |
| voices, knots and observances | `27-observances.js` (the promises kept and broken in a vigil; the voices and knots the dead leave); `23-skills.js` and `24-archetypes.js` where a knot's rule acts inside a cast, and for archetypes new voices need; the content `35-knots.js`, `36-observances.js` and new voices in the class files; the screen `76-voices.js` (`'voices'`) | `Observances`, `Skills` |
| the Lantern and the meta | `15-progress.js` (bequests and what they open; the end of a vigil for them) and `28-bequests.js` (in a vigil: the bequests' counts); `17-bellframe.js` (what the Bellframe gives; opening pits, buying ringing places, hanging bells, recasting gifts); the content `44-bellframe.js` (the bellframe `main`, the pits from the tenor pit, the gifts) and `45-bequests.js`; the screens of `77-lantern.js`: `'lantern'` and `'household'` (in place of the stand-ins), `'bellframe'`, `'register'` and `'bequests'` | `Progress`, `Bellframe` |

`23-skills.js` and `24-archetypes.js` pass from the combat package to the third. `21-player.js` and `26-director.js` already do what Stage 2 asks of them (experience into the character, full mourning, `Items.heave`, Hum at the tolls and for a keeper laid, finds banked by ringing down) and stay as they are; a package that must change one says so to the others first. The systems run in the order their files load: `27-notches`, `27-observances`, then `28-bequests`, last, so that it can count every event of the step. A `'toll'` or an `'end'` event comes after the systems' place in the step, so a system notices a toll by `S.toll` rising, and what the end of a vigil decides is `Progress.endVigil`'s.

### The Household as the game keeps it (C0)

`90-game.js` holds the save, `Game.save`: read once at boot from `Store` under `SaveData.KEY` (one that cannot be read is set aside under `SaveData.KEY + '.unread'`, and the Household starts afresh) and written by `Game.write()`. Its states run `'title'` → `'household'` → `'lantern'` → `'run'` → `'results'` → `'lantern'`:

```
Game.household()                     the Household: choose a standing character, or make one
Game.make(classId, name, bells?) -> char | null    Char.create on the save; the new character is active; written
Game.lantern(uid?) -> char | null    the Lantern with that character (else the active one), made active
Game.vigil(zone?, seed?) -> S | null the active character goes down ('dial' unless named): Char.begin, the save written
                                     with save.away set, Game.start(cfg)
Game.write() -> Promise<boolean>     a screen that changed Game.save calls it; nothing else writes Store
Game.exportText() -> text            SaveData.encode(Game.save)
Game.importText(text) -> {ok, errors, notes}    SaveData.decode; a sound save replaces the one held, and is written
Game.char, Game.report, Game.ROOMS   the active character; what the last Char.end did; the Lantern's rooms
```

In a character's vigil the run has a copy of the character, `S.cfg.char`, and `S.cfg.account = {frame, open, warned, bequests}`: copies of the Bellframe and of what bequests opened, `warned`, the seconds sooner the Register shows each attack that killed a character (0.15 a death, three at most), and a copy of the Household's bequests (`save.account.bequests`), so that `28-bequests.js` knows how far each of the Household's has come and emits `'bequest'` in the vigil that meets one. The run never writes the save: what a vigil counted joins it at `Char.end` (`Progress.endVigil`). At every toll, and when the page is hidden, `Char.checkpoint(save, S)` keeps what was earned (the run's copy of the character, the Hum heard, the tolls) and the save is written, so nothing earned or heard is lost to a closed page. At the end `Char.end(save, S)` applies it and the save is written before the results open with `{S, result, report}`. A vigil the page closed or reloaded ends at the next start as `Char.abandoned(save)`, as if spared; one replaced by another run, or ended by hand without a result, ends so at once. What `Char.end` does, in order: what ringing down banked joins the Household, whatever came after (`S.bank.coin` to its coin, `S.bank.finds` to its chest, each with a uid of the save); the haul carried is lost; the Hum heard is kept; the character's tolls and vigils count up and a mourning term runs down by one; then

- **left or spared**: it takes the run's copy (its experience and levels, the lines its worn finds took, the voices and knots it found); every voice of its loadout counts the tolls, a level every 8, to 20, its rope growing; a place struck for a re-walk that took a line keeps it;
- **died**: its worn finds go to the chest (a place struck for a re-walk and both its neighbours erased for good), its knots go to the chest untied, its voices fall silent with it; it is recast as a bell weighing the tolls of its whole life, waiting to be hung; the Register gains it, with `S.cause`; a cause not yet on the Register pays `deathHum` x the toll x hum-gain; every other standing character mourns it, a vigil for every 10 levels it had and at least one (full mourning while more than half the term is left: +50% Hum and the flag `full-mourning`, under which no coin is picked up; then half mourning: +25%); a longer term replaces a shorter one that is running, a shorter one adds nothing;
- every recast find of the chest cools by the tolls heard (`Items.cool`); and last `Progress.endVigil(save, S, report)`.

The Lantern offers a room for each screen of `Game.ROOMS` that is registered: `'plan'`, `'finds'`, `'voices'`, `'bellframe'`, `'register'`, `'bequests'`, each opened with `{char}`, the active character. A room changes the save through `Char` and its package's functions, pays prices from `Game.save.account` (coin, Hum), and then calls `Game.write()`. The stand-ins `'household'`, `'lantern'` and `'save-text'` of `90-game` give way when the fourth package registers those ids first. The browser tests (`10-shell`, `20-play`, `31-scene`, `52-household`) count on these, whatever screen stands there: the title's main control opens the Household; on the Household the control with focus makes a character of the first open class while nobody stands (a control marked `data-make`, with a text field for the name) and otherwise chooses the first standing character; the Register is an element of class `game-register` with one of class `game-dead` for each death, naming the body that killed it, and a dead character has no control; on the Lantern focus starts on the way down, whose text begins "Go down to"; the Household's control "Save text" opens the save as text, in fields marked `data-field="export"` and `data-field="import"`, read in by "Read it in". A package that changes one of these changes those tests in the same change.

### What every package reads

- **The character** (`Char`, "The Household's shapes"). Read its fields; change them only through `Char` and the owning package's functions: the route by `Char.allocate` and `Char.refund`, worn finds by `Char.equip` and `Char.unequip` (and `Items` for a find's lines), voices and knots by `Char.place`, `Char.tie`, `Char.untie`, `Char.give` and `Char.take`, observances by `Char.learn`, `Char.hold` and `Char.release`, experience by `Char.gain`. In a vigil a system may change the run's copy, `S.cfg.char` (a line on a worn find, a voice or a knot found): the next checkpoint keeps it.
- **Its sheet.** `Char.mods(char, S, account)` gathers, in this order: the class's attributes at its level and the class's modifiers; the Plan (`Tree.mods`); its calling's nodes; the observances it keeps, but for those `S.observances.broken` names; mourning; the Bellframe (`Bellframe.mods`); and last its worn finds (`Items.mods`), whose share is worked from the attributes all the rest gives. Until a package defines its function, `Char` reads that part plainly (its header says how: each node of the route at its printed value; every open pit's grant and the gift of each bell rung, at the bell's level by its weight, times the true ring; a find's fixed line and its lines at its share). The package's function replaces that reading; it does not add to it. Outside a vigil `Char.sheet(char, account)` gives the Lantern's numbers, with every ring of the Plan counting, under the conditions of a dry district: the condition `dry` and no other (every district is dry until the Ropewalk), so the Plan's Ebb bank counts there and its Flood bank does not; `Char.mods(char, null, account)` works a worn find's share under the same.
- **uids.** Characters, finds, voices and bells take `SaveData.uid(save)`. A run cannot reach the save, so what a vigil makes takes a uid below 1, `-(++S.uid)`: a find of the haul, a voice found. `Char.checkpoint` and `Char.end` give each a uid of the save, and a voice keeps its place in the loadout.
- **What a vigil finds** is kept at once, like experience: a voice or a knot the dead leave goes into the run's character (`S.cfg.char.voices`, held; `S.cfg.char.knots`) and is the character's from the next checkpoint, whether it lives or not (at a death its knots go to the chest, and its voices with it into silence). A find goes into `S.haul` and is kept only by ringing down.
- **Events.** A package names each kind of event it emits with `Defs.allow('event', kind)` while its file loads, so that a bequest may count it, and it is listed below.
- **Tests.** `tests/sim/14-character.test.js` and `16-savedata.test.js` hold `Char` and `SaveData` to their contract with none of the packages' functions present; `tests/sim/household.js` gives a small world of test content to start a package's own tests from.

### 13-tree.js: the Plan (the first package). Owns: Tree

```
Tree.mods(char, toll, out) -> out    the Plan's modifiers for the route char.plan.walk at toll (S.toll in a vigil;
                                     Infinity outside one, where every ring counts), pushed onto out, by the six rules
                                     of 04-progression.md with the numbers of the plan 'main': every node of the walk, a
                                     doubled node twice; a lane by the attribute chosen (char.plan.choice[id]: one flat
                                     point of it), or its own mods when it offers no choice; beaten bounds: the nodes
                                     inside each loop the route closes, at loopShare percent when the loop holds
                                     loopMost or fewer, once each even inside two loops; toll rings: a node of ring N
                                     only from toll N - 1, its values x (1 + ringGain / 100 x (N - 1)); the banks: a
                                     flood node's modifiers also need in-water, an ebb node's dry (added to their cond),
                                     both x (1 + bankGain / 100); straight miles: a milestone + mileGain percent for each
                                     held node beyond the mileFrom-th in the unbroken run of held nodes through it along
                                     its street, mileMost at most. Char.mods calls it at every rebuild.
```

Its screen `'plan'` (opened with `{char}`) draws the street plan from the nodes' `x, y`, the route, the head's neighbours, and the loops and miles as they stand. A point is `Char.allocate(char, nodeId, choice)` (one step from the head; a node held twice at most; a lane's attribute chosen the first time); taking one back is `Char.refund(char, Game.save.account)` for `Char.refundPrice(char)` coin; the points are `Char.points(char)` (one a level from the second, and the bequests' `planPoints`). What more it needs to show the Plan (the head's neighbours, the loops) it adds to `Tree`. It reads the kinds `plan` and `node`, `char.plan` and `char.planPoints`; it declares no run state (the kernel marks a character's run dirty at every toll, when a ring opens) and emits nothing. Node ids begin `plan.`; the Change-ringer's door names `class: 'change-ringer'`, and each later class brings its door with it. The command `{type: 'allocate', id, choice}` already reaches `Char.allocate` in a vigil, for the Watch-night.

As built (`13-tree.js`'s header has the full contract): `Tree.mods(char, toll, out)` pushes a node's modifier at its printed value with no bank as the node's own object, multiplies values but never a `set`, grants a lane inside a loop its share of a point of the first attribute it offers, and counts a held node beyond the toll in a straight run though it does not work yet. `Tree` also exports what the screen reads: `Tree.plan()` (the plan `main`, or the design's numbers), `Tree.door(classId) -> nodeId | null`, `Tree.held(walk) -> {[nodeId]: n}`, `Tree.steps(walk) -> [nodeId]` (the head's links held fewer than twice), `Tree.loops(walk) -> [{from, to, inside, grants}]` (the step at `walk[to]` onto the node `walk[from]` closes a loop; `inside` by the nodes' `x, y` and the even-odd rule), `Tree.granted(walk) -> [nodeId]`, `Tree.run(walk, nodeId) -> n`, `Tree.from(node) -> toll` (its ring - 1), `Tree.factor(node, walk) -> k` and `Tree.give(node, attr, k, out)`. It lets a door name a class that is defined or any of the six of `03-classes.md` (`Defs.extend` on the node's field `class`). `32-plan.js` lays 627 nodes: the six doors on ring 1 on the odd streets (street s at 15 + 30 s degrees), 274 lanes, 283 corners, 36 squares, 24 milestones and the four bridges (squares too); ids `plan.<ring>.<street>`, with `.a<j>` (the ring road after it), `.s` (the street outside it), `.b<k>` (the alley), `plan.door.<class>` and `plan.bridge.<street>`; the plan's `look` holds what the screen draws. The screen `'plan'` (`74-plan.js`, styles `pl-*` in `css/40-plan.css`) pans and zooms by touch, mouse, wheel and keys, changes nothing while `save.away` is set, and for tests its canvas carries `data-cx`, `data-cy` and `data-scale` and its panel `data-node`.

### 12-items.js and 27-notches.js: finds (the second package). Owns: Items

```
Items.make(baseId, level, uid, roll) -> Find   a blank find of that base and level: its fixed line rolled within the
                                     base's range at roll (0 to 1: from S.rng.loot in a vigil, 0.5 for a class's
                                     starting gear, which Char.create asks for), every place empty, gone [], walk -1,
                                     cool 0
Items.mods(find, attrs, out) -> out  what a worn find gives (Char.mods calls it): its fixed line, and every written line
                                     (Char.lineMod) at the find's share, Stats.share(attrs[attr], Stats.WANTS.line x
                                     notches), attr being the attribute of the posture that wrote most of its lines.
                                     Char.findMods is that reading: keep it, or say why not
Items.write(S, find, posture) -> place | -1    writes one line by the rule of 04-progression.md: verb and object drawn
                                     from the posture's table (S.rng.loot), weighted by the base; the amount rolled in
                                     the verb's band for toll S.toll at the find's level, x notch-size / 100; cut
                                     backward one time in ten; into the struck place of a re-walk, else the first empty
                                     place; -1 when there is none
Items.cool(find, tolls)              a recast find not yet worn: its lowest line rises one step within its band for each
                                     toll, cool counting the steps left down from 4 (Char.end calls it for every find of
                                     the chest whose cool is above 0)
Items.heave(S) -> boolean            button B (21-player.js calls it when heaveCd has run out): throws a find of the haul
                                     at the dead (heave-harm) and emits 'heave' (x, y where it lands; a = its notches);
                                     true when one was thrown
Items.price(find, change) -> coin    what a change costs at the Lantern ('chisel', 'rewalk', 'recast', 'cut'), rising
                                     with the find's level and notches
Items.chisel(find, place, word) -> boolean     strikes 'object' or 'condition' from a line for good (Line.struck: the
                                     line then works at 60%, Char.lineMod)
Items.rewalk(find, place) -> boolean           strikes a line out and marks its place (find.walk): the first toll
                                     survived wearing it writes the place anew, ringing down keeps that, and a death
                                     erases the place and both its neighbours (Char.end does both)
Items.recast(first, last, uid) -> Find | null  pours two finds of one slot into one: the fixed line and lines 1 to 4
                                     of the first, 5 to 8 of the last, a blank place staying blank; the higher level;
                                     cool 4
Items.cut(find, place) -> boolean    cuts a line away for good (into gone); every other line rises 10%
```

`27-notches.js` is the part that runs in a vigil. Its slot, `Sim.state('notches', ...)`, holds the seconds of the toll period spent in each posture (stood while Braced, strode while Striding, pressed while crowded, from `S.player.conds`). Its `Sim.system`, when `S.toll` has risen, takes the posture of the period just ended (timed when the toll found the player within 4 m of a landmark) and writes a line on every find of `S.haul` with room, and into the struck place of each worn find on a re-walk (in `S.cfg.char.worn`, kept by the checkpoint); and it drops finds where the dead fall (`'kill'` events, by `find-chance`): pickups of kind 2 whose `item` is a find of `Items.make` at the district's level with a uid `-(++S.uid)`. `Player.pickups` puts them in `S.haul`, and ringing down banks them into `S.bank.finds`. Events: `'notch'` (x, y the player; a = the place written; b = the posture's row in `Stats.POSTURES`; id = the find's base) and `'heave'`.

Its screen `'finds'` (opened with `{char}`) shows the worn finds and the chest (`Game.save.chest.finds`): wearing by `Char.equip(char, uid, slot, Game.save.chest)` and `Char.unequip(char, slot, Game.save.chest)`, and the four changes, paid from `Game.save.account.coin`. It reads the kinds `base` and `posture`, `Stats.POSTURES`, `char.worn`, `save.chest.finds` and `save.account.open.bases` (a base with an `unlock` drops only once a bequest opened it). The bases of the Change-ringer's starting gear go into `startGear` in `31-change-ringer.js`, and `Char.create` wears them as blank finds.

As built (the headers of `12-items.js` and `27-notches.js` have the full contract): `Items.LINES` (8) and `Items.CHANGES` (`['chisel', 'rewalk', 'recast', 'cut']`); `Items.mods` is `Char.findMods` kept as it is (the earliest place breaks a tie of postures); `Items.wants(find) -> {posture, attr, want, notches} | null` (null for a blank find); `Items.attrs(char, account) -> {knee, heel, hand, ear}`, what a worn find's share is worked from at the Lantern; `Items.fits(stat, tags)`, whether a line on that stat can be held to those tags (no family ever: no tool is a weapon); `Items.draw(rng, open, level) -> baseId | null`; `Items.strength(line) -> 0..1`; `Items.price(find, change, other?)`: chisel 6, re-walk 4, recast 8 (both finds poured), cut 10 coin for a blank find of level 1, x (1 + 0.1 a level above the first) x (1 + 0.25 a notch), Infinity for no change; `Items.refusal(find, change, a, b) -> null | reason`, the reasons `'change'`, `'place'`, `'empty'`, `'word'`, `'struck'`, `'all'`, `'walking'`, `'same'`, `'slot'` and `'base'`. A stat that is better lower is written with a band below 0. One step of cooling is a quarter of the line's band. `27-notches.js` adds `Items.HAUL_MOST` (30: a find lying while the haul is full is held back, its pickup's state `Items.FULL`, -30, until there is room), `Items.period(S) -> row` and `Items.lay(S, find, x, y) -> pickup | null` (every find laid on the ground goes through it). Its slot `S.notches = {seen, secs, known, n, lx, ly, throws: {n, x, y, left, at, harm}}`. A drop: keeper 1, elite 0.3, a large common body 0.02, a small one 0.004, times `find-chance` / 100, none within 8 of the pickups' cap; it emits `'drop'` with a = 2. The heave throws the find of the haul with the most notches 5 m ahead along the aim; it bursts once a notch, 0.2 s apart (a blank find once at half), each 9 x the curves' `enemyLife` at the district's level x `heave-harm` / 100 through `Dmg.harmEnemy`, leaves an area of no voice (team 0, skill -1, state `Skills.MARK`) for 0.18 s, and lies where it fell as a blank find to carry again; `'heave'` carries id = its base. The room `'finds'` (`75-finds.js`, styles in `css/41-finds.css`) registers the glyphs `find.tool` to `find.token`, asks once more with `UI.confirm` before each change and pays only once it is made; its controls carry `data-uid`, `data-slot`, `data-place`, `data-act` and `data-partner`, and its status line is `.fnd-said`.

### 27-observances.js, 23-skills.js and 24-archetypes.js: voices, knots and observances (the third package). Owns: Observances, Skills

```
Observances.promise(rule, {step(S, id, params) -> boolean})   registers a promise, and calls Defs.allow('promise', rule)
                                     so that observances may name it. step runs once a step in a vigil for each
                                     observance the character keeps whose promise is rule, with that observance's
                                     params, and returns false when the promise broke
```

Its slot, `Sim.state('observances', S => ({broken: {}, ...}))`: `broken`, `{[observanceId]: true}` while a promise stays broken, is what `Char.mods` reads, so a broken observance's modifiers stop (its Heed stays held) until the next toll mends it. Its `Sim.system` runs the promises (a break: `broken[id] = true`, `S.dirty`, and an event `'promise'` with a = 0; each mended at a toll: a = 1; id = the observance) and gives what the dead leave: when an elite or a keeper falls (a `'kill'` with `a >= Sim.ELITE`), by the package's own odds, a blank voice of a tier the district gives (`Char.voice(-(++S.uid), voiceId)` into `S.cfg.char.voices`, held) or a knot (`S.cfg.char.knots[id] + 1`), `S.dirty`, and an event `'found'` (x, y where the body fell; a = 0 for a voice, 1 for a knot; id = its def's id). A promise that keeps pickups from the player sets their `state` below 0, and `Player.pickups` leaves them lying (Alms). Heed needs no system: `Dmg.warning` works free Heed from `heed-max` and the observances kept, and `Char.heed(char, account)` says the same at the Lantern.

A knot that changes a rule names it in `rule`, a word its registry allows with `Defs.allow('knotRule', rule)`. Such a rule acts inside a cast, so it lives in `23-skills.js` or `24-archetypes.js`, which find a voice's knots in its skill sheet (`S.skills[slot].sheet.knots`: the knot defs that fit and are tied in). Its screen `'voices'` (opened with `{char}`): the loadout's places (`Char.places`, `Char.place`), each voice's rope (`Char.rope(level)`) and knots (`Char.tie`, `Char.untie`; `Stats.fits` says which fit), the voices and knots of the chest (`Char.give`, `Char.take`, with `Game.save.chest`), the observances known and kept against Heed (`Char.heed`, `Char.hold`, `Char.release`). It reads the kinds `voice`, `knot` and `observance`, `char.voices`, `char.loadout`, `char.knots`, `char.known`, `char.observances`, `save.chest` and `save.account.open.observances`. Events: `'found'`, `'promise'`.

As built (the headers of `27-observances.js`, `23-skills.js` and `24-archetypes.js` have the full contract). `Observances.promise(rule, {step, mods?})`: step also runs while its promise is broken (to keep its own count; a false then changes nothing), and `mods(S, id, params, out)` adds what a promise kept gives beyond the observance's own modifiers, through a `Sim.source` of the file (the Round's periods, the cairns of Alms). `Observances.record(S, id)` (a kept observance's record in this vigil, `S.observances.of[id]` = `{toll, x, y, n, t, flag, seen, reach}`), `Observances.leave(S, rank, x, y) -> def | null`, `Observances.ODDS` (`{elite: 0.3, keeper: 1, voice: 1/3}`), `Observances.VOICES_MOST` (64, which the save holds a character to), `Observances.warning(char, account)` (the warning free Heed gives, at the Lantern), `Observances.held(o) -> 'cairn' | 'mourned' | null` and the states it gives pickups it holds back, `CAIRN` -1, `MOURNED` -2, `LEFT_CAIRN` -3, `LEFT_MOURNED` -4 (it holds a find only from state 0 or `Items.FULL`, and never takes the haul past `Items.HAUL_MOST`). Its slot is `S.observances = {broken, of, toll, scarred, cairns, sight, rng}`: `scarred`, the greatest life Hand on the Bell has scarred this vigil (a `Sim.source` takes it off `life-max`; the HUD's dark end and the condition `scarred` count it); `cairns`, those of Alms standing; `sight`, the metres beyond which the dead cannot make the player out (Full Mourning; 0 while nothing hides the player; `22-enemies.js` reads it); `rng`, the dead's leavings' own stream forked from `S.rng.loot`. A voice or a knot left is of the tier the zone's `ordinal` gives (one more for a keeper; the nearest lower tier that has any). Hand on the Bell also emits `'scar'` (x, y the player; a = the life lost; id = the observance). The six promises are `stability`, `unbroken-round`, `alms`, `telling-the-bees`, `full-mourning` and `hand-on-the-bell`, their numbers in the observances' `params` (`36-observances.js`).

`Skills` gains, for archetypes and knots: `Skills.C`, the cast in hand (`{slot, x, y, part, reach, shape, lent, point, px, py, lx, ly, passed, echo}`), `Skills.shape(S, slot, thing?)`, `Skills.landed(x, y)`, `Skills.hit(S, slot, e, part, ox, oy)` (a hit through the knots that act on each body struck, then `Dmg.hitEnemy`), `Skills.knotRule(name, {pace, ready, before, after, step})` (each hook optional; it allows the name for knots), `Skills.kind`, `pick`, `point`, `count`, `strike`, `circle`, `wedge`, `lane`, `area`, `areaStep`, `strokes`, `find`, `where`, the states `FILL`, `ZONE`, `MARK`, `LANDED`, and `TICK`, `LEE`, `AGAIN`; `Skills.beat(S)`, true while an Open Lead beat holds, when no condition can be put on the player (`Dmg.lay`, the swing it would count, a rider's climb); and, from `24-archetypes.js`, `Skills.cross(S, slot, forced)`, the cast of a voice with Louvres. An archetype's `cast(S, slot, forced)` is told by `forced` that the pull or a knot let it go. The target rules `'mark'`, `'crossing'`, `'step'` and `'ahead'` are added to the voices' words. The slots are `S.voices = {pend, pendAt, lastHit, marked, stop, markX, markY, markT}` and `S.knots` (each place's rules and what they keep between steps: the headings, the corners, the quarters, Open Lead's beats `leadN`, `leadEnd`, `leadDamp`, `leadLive`, saved casts, Slip-knot's corners, Back-splice's figure `figX`, `figY`, `fig`, Stone's Answer, Muffle, Second Voice). Fields: on `'enemy'` `waxed`, `waxToll` (Resist), `clashT`, `clashS`, `clashH`, `clashK` (Clash); on `'shot'` `part`, `lent`, `free`, `twin`; on `'area'` `lent`, `part`. The knots of `35-knots.js` name the rules `running-line`, `open-lead`, `quartered`, `slip-knot`, `back-splice`, `stones-answer`, `muffle`, `passes-free`, `resist`, `handstroke`, `clash`, `louvres`, `balance`, `unlaid`, `ringers-fine` and `second-voice`. A thrown thing of Balance stands mouth-up as a shot in state 1 (`24-archetypes.js`), which the scene draws. The room `'voices'` (`76-voices.js`, styles `vc-*` in `css/42-voices.css`) marks its controls with `data-place`, `data-rope` (`"place:at"`), `data-voice`, `data-knot`, `data-obs`, `data-act` and `data-key`, and its status line is `.vc-said`.

### 15-progress.js, 28-bequests.js and 17-bellframe.js: the Lantern and the meta (the fourth package). Owns: Progress, Bellframe

```
Progress.endVigil(save, S, report)   Char.end calls it last: the counts of the vigil's bequests (S.bequests) join the
                                     Household's (save.account.bequests, scope 'account') and the character's
                                     (char.bequests, scope 'character': the character report.char, if it still stands);
                                     each bequest done pays its reward: a class, a base or an observance opened
                                     (save.account.open), a named voice into the chest, Plan points (char.planPoints),
                                     coin, Hum; report.bequests lists the ids done
Bellframe.mods(account, char, out) -> out    what the Bellframe gives a character (Char.mods calls it; account is the
                                     save's account, a run's {frame, open, warned}, or null: then nothing): the grant of
                                     every open pit, and the gift of every bell it rang (char.bells, found in
                                     account.frame.bells) at level 1 + floor(weight / weighPer), at most 20, x (1 +
                                     trueGain / 100 x Char.trueRing(the weights rung)), x 2 for a bell that rings double
Bellframe.price(save, what) -> Hum   the price of the next pit ('pit': pitFirst x pitGrowth ^ the pits opened beyond
                                     the tenor) or of the next ringing place ('place': placeFirst x placeGrowth ^
                                     (places - 1))
Bellframe.open(save, pitId) -> boolean       opens a pit whose `from` is open, paid from save.account.hum
Bellframe.place(save) -> boolean     buys a ringing place, up to placesMost
Bellframe.hang(save, bellUid, pitId) -> boolean    hangs a bell not yet hung in an open, empty pit
Bellframe.recast(save, bellUid, giftId) -> boolean recasts a bell's gift, for `recast` Hum, to another gift of its class
```

`28-bequests.js` (Owns: Progress) is the part that runs in a vigil, the last of the systems: its slot `Sim.state('bequests', ...)` holds the vigil's counts, and its `Sim.system` counts every event a bequest is `on` that its `where` admits (the zone, the rank, the def's id), and the tolls by `S.toll`. Hum at the tolls, for a keeper laid (`26-director.js`) and for a death by a new cause (`Char.end`) is paid already. Events: `'bequest'` (x, y the player; id = the bequest) when one is done in the vigil.

Its screens, in `77-lantern.js`: `'lantern'` (the hub: the character and its sheet from `Char.sheet`, the Household's coin and Hum, its mourning, the rooms of `Game.ROOMS`, the way down by `Game.vigil`; the Lantern's own music, plain hunt on hand-bells, by `Music.define` and the notice `'state'`), `'household'` (the standing characters; making one with the bells it rings, as many as `frame.places` and only hung ones, which `Char.create` checks; the Register; the save as text), `'bellframe'` (the pits and their grants, opening and hanging, the ringing places, the gifts and their recasting), `'register'` (`save.register`: each death, what killed it from its `cause`, and the head start the Register now gives) and `'bequests'`. It reads `save.account` (coin, hum, heard, frame, open, bequests), `save.register`, `char.bells`, `char.bequests`, and the kinds `bellframe`, `pit`, `gift` and `bequest`. A pit opened changes every character after it, in every vigil after it, since `Bellframe.mods` reads the frame of the account each vigil carries: the acceptance's "a Bellframe node bought with one character changes the next one".

As built (the headers of `15-progress.js`, `28-bequests.js`, `17-bellframe.js` and `77-lantern.js` have the full contract). `Progress` also exports `Progress.pay(save, bequestId, char, gain = 1) -> hum` (what a bequest leaves: an observance opened is learnt by the character too; Plan points to 1000 at most; a reward that names content the build lacks is left out), `Progress.status(save, char, bequestId) -> {n, count, done, scope}`, `Progress.compiled()` (the bequests as the counting reads them, built once), `Progress.counts(c, k, a, b, id, zone, toll, cls)` and `Progress.admits(bequestId, event, ctx)` (what one event counts; nothing allocated), `Progress.WHERE` and `Progress.headStart(save) -> [{attack, kind, deaths, seconds}]` (the Register's head start, the most first). A bequest's `where` may hold `zone`, `id` (one id or a list), `rank`, `least`, `is`, `toll`, `vigil` (it keeps the most one vigil counted), `sum` (`'a'` or `'b'`: each event counts that field) and `class`; a sum is rounded down at the vigil's end, the tolls are counted one for each toll heard, the end of a vigil once as an event of kind `'end'` (a the tolls, b the dead laid, id the outcome), and `Char.abandoned` counts nothing. `report.bequests` lists the ids met in the order they were defined, and the Hum they paid joins `report.hum`. The slot `S.bequests = {on, toll, cls, n, had, known, done}` (by bequest, in the order of `Progress.compiled().list`) changes nothing the checksum reads and draws from no stream. `Bellframe` also exports `Bellframe.level(bell)`, `Bellframe.ring(account, char) -> {bells, pairs, gain}`, `Bellframe.openable(save, pitId)`, `Bellframe.hung(save, pitId) -> bell | null` and `Bellframe.gifts(classId) -> [giftId]`; `open`, `place`, `hang` and `recast` refuse, changing nothing, an id that is not there, too little Hum, and anything while a vigil is under way (`save.away`); `price` is Infinity when there is nothing left to buy. `44-bellframe.js` hangs twelve pits in three tiers (`x` the bay, `y` the tier) from the tenor pit, and three gifts whose ids are those of the class and its callings. `45-bequests.js` holds ten of the Household's and twelve of each character's. `77-lantern.js` registers `'household'`, `'lantern'`, `'bellframe'`, `'register'` and `'bequests'` (styles `lt-*` and `bf-*` in `css/43-lantern.css`) and defines the piece `'lantern'` (plain hunt on six hand-bells), which `54-music.js` and the notice `'state'` play on the Household and the Lantern.

### Choices made where the design is silent (C0)

Each is in the header of `14-character.js` or `16-savedata.js`; these bear on the packages:

- What a vigil finds (voices, knots) is the character's at once, like experience; finds are the haul. A dead character's voices fall silent with it; its knots and worn finds go to the chest.
- A vigil the page left unfinished counts as spared: the character lives and its haul is lost (the outcome `'unfinished'`).
- Full mourning lasts while more than half its term is left; a term runs down by one at the end of each of the character's vigils.
- A bell's gift works at level 1 + floor(weight / 8); a pair of bells rings true when the lighter is 10% to 30% lighter than the heavier.
- A death's key on the Register is the attack's id, or its kind of harm when no attack did it (the press of a body, a rider, the ground); only an attack's id gives a head start.
- Taking back a point of the Plan costs the plan's `refund` x the head's ring, in coin.
- No find is worn or changed in a vigil: the chest is the Lantern's, and `Char.equip` without one refuses.
- Conditions that a written line needs (every one of several; "while not") are written as lists and `unless`, not as new condition bits: `Stats.CONDS` already holds 31, all a mask holds.

And where the review of Stage 2 had to choose:

- The Lantern's sheet is a dry district's: the condition `dry` holds there and nothing else does, so Ebb-bank nodes show and Flood-bank ones wait for water.
- A character made before the Plan existed is given its door by a migration (version 2 to 3), not by `Char`: every reader of a route then sees a door.
- Under Full Mourning the dead rise knowing where the player stood, lose it beyond the sight, walk there and stand; a keeper always sees (its phases are aimed at the arena, not at a sight).
- Open Lead's "no condition can be put on you" covers what the dead lay (`Dmg.lay`), the swing their Blows count and a rider's climb; it does not cover what the player's own movement does (Wrong-footed) or Tolled-for.
- A name of 24 letters with no space breaks on any screen rather than run past its edge (`overflow-wrap` on `.ui-screen`).
