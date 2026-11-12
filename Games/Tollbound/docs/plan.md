# Tollbound: plan

## Context

You asked for a game that fuses Vampire Survivors and Halls of Torment with the class, leveling and progression of PoE2. Your answers since then set its shape.

| Question | Your answer | What the plan does |
|---|---|---|
| Platform | "unreal engine? but html to the max for now" | One HTML file now, pushed as far as a browser goes. Rules and content stay engine-neutral and exportable, so an Unreal port can reuse them later. I cannot run Unreal from this session. |
| Progression | Both modes | A living character you keep between runs, and a fresh-start gauntlet that builds a whole character in one sitting. |
| Scope | Full breadth, in stages | Seven stages. Each ends in a tested, playable, committed build. |
| World | New bell-city gothic | Working title **Tollbound**. A web search found no game with that name. |
| Look | 2.5D, real 3D figures, retro render | Figures built from simple 3D shapes, with real lights and cast shadows, seen from a tilted camera and drawn at low resolution. YouTube is blocked from this session, so I have not seen your video. The first build is where you check the look. |
| Run length and death | As long as you can; one life; shared permanent tree; open world eventually | Runs have no fixed end. Every character has one life. A permanent tree shared by all characters grows from what each one achieved. The open world is the last stage. |
| Accessibility | None in particular | Ordinary options only: shake, flashes, text size, volume. |

Tollbound is an original game. It borrows mechanics from those three games and none of their names, classes, skills, items, monsters, layouts or art. A word list checked by the tests keeps borrowed names out.

## The game

**Setting.** A drowned cathedral-city whose great bells kept the dead asleep. The bells have fallen silent. You hold a vigil in a district, the dead rise in tides, and you leave through a gate before the night takes you.

**One run (a vigil).** You move, dodge and drink; every skill casts by itself. Kills drop XP, gold and loot. A bell tolls every 75 seconds; each toll raises the danger and the rewards. The district's boss arrives at the eighth toll (10 minutes). Killing it clears the district, and the vigil then goes on for as long as you dare. Gates open after elites, after bosses and on every third toll. Leaving through one banks what you carry. Dying ends that character for good.

**Words the game uses**

| Term | Meaning |
|---|---|
| Sigil | An active skill. Levels 1 to 20, raised by finding blank sigils of a higher tier. |
| Binding | A modifier socketed into a sigil. A sigil has 2 sockets, rising to 5. |
| Vow | A permanent buff that burns part of your candle pool. |
| Chime | A temporary upgrade, picked from three each time your run level rises. Lost when the vigil ends. |
| Hush | A shield that refills when you avoid damage for a moment. |
| Draught | A healing drink whose charges refill from kills. |
| Calling | A subclass. Each class has two, chosen at its first rite. |
| Rite | A challenge run that grants calling points. |
| Haul | Items picked up during a vigil. Lost if you die before leaving. |
| Chart | An endgame map item with a tier and random modifiers. |
| Deed | A quest-like goal that unlocks classes, districts, unique items or tree points. |
| Echoes | What every run leaves behind, even a fatal one. Spent on the Carillon. |
| The Carillon | The permanent tree shared by all your characters. |

**Building a character (the PoE2 side)**

- Six classes on Strength, Dexterity, Intelligence and the three pairs. Three are open at the start; deeds unlock the rest.
- Character levels to 60. Each level gives one point for the passive tree; deeds give about 12 more.
- One shared passive tree laid out like a rose window, with six class starts on an inner ring. Node kinds: path (pick which attribute it gives), minor, major and capstone. Capstones change how a build plays and carry a real cost.
- Sigils, bindings and vows as above. Up to six sigils equipped; slots open with level. Attack sigils need a weapon family. Sigils and gear have attribute requirements.
- Gear in ten slots. Rarities: common, magic (1 prefix and 1 suffix), rare (3 and 3), unique. About eight crafting currencies, one per job: raise rarity, add a modifier, reroll, remove a modifier, reroll values, add a sigil socket, corrupt.
- Callings: two per class, each a small tree with 8 points to spend, earned at four rites.
- Damage types: physical, fire, cold, lightning, void. Defences: life, hush, armour, evasion, resistances capped at 75%, and the dodge roll. Ailments: ignite, bleed, poison, shock, chill and freeze, stun.

**Two ways to play**

- **The Watch.** Your living characters. A character keeps its level, tree, sigils and gear between vigils until it dies. The five districts lead to endgame charts.
- **The Gauntlet** (working name). One character from level 1 through all five districts in one sitting of 20 to 25 minutes. Each level-up offers three tree nodes next to what you already hold. Elites and bosses offer sigils, bindings and gear. The calling is chosen after the first boss.

**Death and what lasts.** Every character has one life. A fallen character goes on the memorial roll. Echoes from every run feed the Carillon, whose nodes apply to every character you make afterwards. The stash, gold, deeds and unlocks are also shared.

**Target content.** Breadth lands in two waves. Wave 1 uses the smaller numbers; wave 2 raises them once the balance checks hold.

| | Wave 1 | Wave 2 |
|---|---|---|
| Classes / callings | 6 / 12 | 6 / 12 |
| Sigils / bindings / vows | 24 / 16 / 6 | 36 / 24 / 8 |
| Passive tree nodes | about 180 | about 240 |
| Carillon nodes | about 30 | about 45 |
| Districts / bosses | 5 / 5 plus 2 mini-bosses | same, plus rites and charts |
| Enemy types | 24 | 30 |
| Unique items / deeds | 12 / 24 | 20 / 40 |
| Chimes / chart modifiers | 40 / 10 | 60 / 16 |

## Stages

Each stage ends with the tests green, the build committed and pushed, and the playable page republished for you.

| Stage | What gets built | What you can do at the end |
|---|---|---|
| 0. Design | The design document with exact rules and numbers, the word list, the content list. | Read `Games/Tollbound/docs/design.md`. |
| 1. Core loop | Engine core, combat, the vigil (tolls, gates, elites, one boss), the 3D renderer, input, sound, HUD, chimes. One class, three sigils, six enemies, one district. | Play a full vigil on phone or desktop. **This is the check on look and feel.** |
| 2. Characters | Saves, one life and the memorial, levels, the passive tree, sigils and bindings and vows, gear and crafting, the hub, the Carillon, deeds. | Keep a character between vigils, build it, lose it, and see the Carillon carry over. |
| 3. Gauntlet | The fresh-start mode, its level-up and reward offers, scoring and records. | Build a whole character in one sitting. |
| 4. Breadth | All classes, callings and rites, districts, enemies, bosses, sigils, bindings, uniques, deeds, endgame charts. Two waves. | Play the whole game. |
| 5. Polish | Lighting and effects, music, onboarding, phone performance, balance from simulated play, review until two passes find nothing serious. | A finished first version. |
| 6. Open world | The five districts become one continuous city that loads in pieces as you walk, with bells to re-ring, sanctuaries in place of the hub menu, and a world map. | Walk the city on one life. |

This is many hours of agent work. Stage 1 is the first point with something to play. If the session restarts, work resumes from the last pushed commit.

## Architecture

**Where it lives.** `Games/Tollbound/`, in the same shape as `Games/Cinderdeep/`:

```
Games/Tollbound/
  Tollbound.html        built single file (tracked; written only by the integration step)
  package.json          scripts below; playwright 1.63.0 as a devDependency for CI only
  README.md             how to play, how to work on it, layout, how to extend
  docs/design.md        rules, numbers, word list, content list
  src/page/             head.html, body.html, tail.html, css/NN-<owner>.css
  src/js/NN-*.js        modules, concatenated in the order tools/modules.js gives
  tools/                modules.js, build.js, lint.js, export.js, counts.js
  tests/                run.js, helpers.js, scenarios/*.js, sim/*.test.js, soak.js, bench.js, balance.js
.github/workflows/tollbound.yml
```

**Code rules** (each answers a fault found in the reference game)

- Every file is one enclosed function that adds only to its own namespace. Nothing reassigns another file's function; modules extend each other through registries and events. `tools/lint.js` enforces this.
- Three layers. The simulation (files below 30) is pure logic with no page access. Content (30 to 49) is plain data. Presentation (50 and up) is drawing, sound, input and menus. Files below 50 load in Node without a browser, which is what makes fast tests and the Unreal export possible.
- The simulation runs at a fixed 60 steps a second from a seeded random stream, so the same seed and inputs give the same run. It knows nothing about the screen. Level-up offers are a simulation phase, not a menu state.
- The world is a flat ground plane measured in metres. Entities are reused objects, never created and thrown away each frame. A grid finds neighbours. Hard caps: 600 enemies, 500 projectiles, 400 pickups, 1500 particles.
- Runs take place in regions of a seeded world with scattered props, not in one fixed box, so Stage 6 can join them.

**Renderer.** A small WebGL2 renderer written for this game, with no library:

- Figures are puppets: lists of boxes, tapered boxes, cylinders, spheres and cones in a palette, attached to a rig (biped, quadruped, floater, crawler, winged, serpent, static). The rig animates walking, attacking, flinching and dying from the simulation's state. Puppets are plain data.
- One sun with a shadow map, up to 32 point lights from spells and candles, fog and a tint per district.
- The scene is drawn at about 360 pixels on the short side and scaled up with hard pixels, with an outline from depth edges, optional dithering and glow from bright surfaces.
- Three quality levels. It steps down by itself when frames run long.
- Damage numbers, health bars and all menus are ordinary page elements or a flat overlay, so text stays sharp.
- A plain 2D compatibility view (discs and shapes) exists for browsers without WebGL2 and for debugging. Tests force each view and check which one ran.

**Saves.** Versioned JSON with a list of migrations. A storage adapter tries a durable store if the published page is granted one, then browser storage, then memory, and shows a save-status badge. Text export and import always work. Imported text is validated and never trusted.

**Two builds from one source.** `Tollbound.html` stands alone. A second target is the page fragment the Claude app publishes (no document tags, no outside resources, sized by `height: 100%`, no browser dialogs). A test hosts the fragment under the same restrictions.

**Ready for Unreal.** `tools/export.js` writes every content table as JSON rows, a schema, the text strings, and reference results for the damage rules and for one seeded run, so a port can be checked against this version. Behaviour is named by id in closed lists (skill archetype, enemy AI, trigger, currency job), never by code inside the data.

**Patterns reused from the reference game** (re-implemented here; `Games/Cinderdeep/` is not touched)

| Pattern | Where it is |
|---|---|
| Concatenating build with a `--check` mode | `Games/Cinderdeep/tools/build.js` |
| Scenario runner: fresh browser context each time, page errors fail the scenario, name filter | `Games/Cinderdeep/tests/run.js` |
| `T.check`, `T.until`, `T.done` test helpers | `Games/Cinderdeep/tests/helpers.js` |
| Seeded RNG class, `h()` page-element builder, storage wrapper that never throws, hooks run inside try/catch | `Games/Cinderdeep/src/js/00-utilities.js` |
| One action set per frame from keyboard, mouse, gamepad and touch sticks | `Games/Cinderdeep/src/js/02-input.js` |
| Sound-effect recipes with a per-sound rate limit; look-ahead music | `Games/Cinderdeep/src/js/01-sound.js` |
| Settings rows added through a registry | `Games/Cinderdeep/src/js/14-screens.js:103-111` |
| CI job | `.github/workflows/cinderdeep.yml` |

## How the work runs

- Each stage is run as agent workflows. A contract package goes first and alone: it fixes the interfaces. Then parallel packages follow, each owning its own files, so no two agents edit the same file. One workflow runs two agents at a time, and I run at most two workflows together.
- After each batch I build, run the full tests, look at screenshots at phone and desktop sizes, commit and push. Then a review workflow hunts for defects (correctness, speed, save safety, borrowed names, play by a scripted player) and the fixes go in before the stage closes.
- Agents work on branch `ccr-916a4169-z57ov4`. After the first push I open a draft pull request and watch its checks.
- After Stage 1 and every later stage I publish the playable page to the Claude app, at the same link each time.
- Your Bash hook blocks inline scripts. Agents will write their test and tool scripts as files in the game's `tests/` and `tools/` folders and run them from there, so every script is in the pull request for you to read.
- No third-party art, sound or code is used. Nothing is generated with paid services.

## Verification

```
npm run lint          layer rules, no reassignment, no forbidden globals, word list
npm test              lint, dev build, Node simulation tests, browser scenarios
npm run test:full     the above plus the published-page harness, soak, bench, balance, build check
```

- **Simulation tests in Node.** Fixed cases for stats and damage; every content entry valid and cross-referenced; the tree connected and evenly spaced; item rolls and crafting; save migration; 500 corrupted imports that must never throw; every legal sigil and binding pair simulated.
- **Determinism.** The same seed and scripted player twice give the same state checksum every 600 steps for three minutes.
- **Soak and balance.** A scripted player plays whole vigils for every class in every district: no errors, caps respected, nothing leaking. Its win rate and boss kill times must stay inside set bands. This catches regressions; it does not prove difficulty feels right.
- **Speed budgets on this machine.** Simulation step at most 1.5 ms on average and 4 ms at worst with 600 enemies; scene preparation at most 2.5 ms; at most 24 draw calls; file size at most 2 MB. This machine has no graphics card, so frame rate itself is not measured here.
- **Browser scenarios.** Phone portrait, phone landscape and desktop, each with the 3D view and the compatibility view: start, play a vigil with touch only, level up, leave through a gate, die, reload and find the save.
- **By eye.** I view screenshots at every stage. Stage 1 also produces a sheet of every puppet for an art check.
- **On your phone.** Adding `?fps=1` to the page shows frame times. The Stage 5 target is 18 ms or less for 95% of frames with 400 enemies.

## Risks and assumptions

- **The look.** I have not seen your reference video. If Stage 1 does not look right, changing the art direction then is cheap; changing it after Stage 4 is not.
- **Phone speed.** It can only be measured on a real phone. The renderer has three quality levels and steps down by itself.
- **Saves inside the Claude app.** Browser storage there can be cleared. The save badge, export and import, and the durable store (if your account has it) cover this. I will check the durable store when Stage 2 starts.
- **One life.** Permanent death needs fair difficulty. Gates, the Carillon and telegraphed boss attacks are the safety valves, and balance bands are tested from Stage 1.
- **Assumed, say if wrong:** both ways to play stay in; a death loses the haul but keeps Echoes; level cap 60; there is no mana, because every sigil casts by itself.

## Appendix A: modules

`tools/modules.js` is the single source of file order for the build, the lint, the Node loader and the export. Nothing runs at load time before `99-boot`.

| File | Layer | Responsibility | Key exports |
|---|---|---|---|
| `00-core` | sim | namespaces, maths, hash, RNG | `new Core.RNG(seed)`, `rng.fork(label)`, `Core.seal()` |
| `01-defs` | sim | registries, schemas, validation, freeze | `Defs.add(kind, def)`, `Defs.get(kind, id)`, `Defs.all(kind)`, `Defs.finalize() -> errors[]`, `Defs.SCHEMA` |
| `02-pool-grid` | sim | fixed-shape pools, spatial grid | `Core.Pool(make, cap)`, `Core.Grid(cell)`: `rebuild(pool)`, `query(x, y, r, out) -> n` |
| `10-stats` | sim | stat, tag and condition tables; sheets | `Stats.sheet(mods, ctx)`, `Stats.skillSheet(mods, sigilInst, sheet)`, `Stats.query(mods, stat, tags, conds)` |
| `11-damage` | sim | hits, defences, ailments, damage over time | `Dmg.hitEnemy(S, skill, enemy, scale)`, `Dmg.hitPlayer(S, attack, source)`, `Dmg.tick(S)` |
| `12-items` | sim | generation, crafting, salvage | `Items.create(baseId, ilvl, rarity, rng)`, `Items.drop(ctx, rng)`, `Items.craft(target, currencyId, rng)`, `Items.mods(item)` |
| `13-tree` | sim | passive tree built from skeleton and clusters | `Tree.build()`, `Tree.frontier(char)`, `Tree.canAllocate(char, id)`, `Tree.canRefund(char, id)` |
| `14-character` | sim | character operations, modifier collection, requirements | `Char.create(classId, name)`, `Char.mods(char, run, account)`, `Char.allocate`, `Char.equip`, `Char.socket`, `Char.grantXp` |
| `15-progress` | sim | deeds, unlocks, charts, rites, Echoes and the Carillon | `Progress.onEvent(save, evt)`, `Progress.chart(tier, rng)`, `Legacy.buy(save, id)`, `Legacy.mods(save)` |
| `16-savedata` | sim | save schema, migrations, text codec | `SaveData.blank()`, `migrate(raw)`, `validate(raw)`, `encode(save)`, `decode(text)` |
| `20-sim` | sim | run state, step order, commands, events | `Sim.create(cfg)`, `Sim.step(S, input)`, `Sim.command(S, cmd)`, `Sim.spawnEnemy`, `Sim.emit`, `Sim.hash(S)`, `Sim.result(S)`, `Sim.debugScene(n)` |
| `21-player` | sim | move, dodge, draught, pickup magnet, buffs | `Player.step(S, input)`, `Buffs.add(S, id, mods, seconds)` |
| `22-enemies` | sim | AI, steering, capped separation, elite traits | `AI.register(name, fn)`, `Enemies.step(S)` |
| `23-skills`, `24-archetypes` | sim | auto-cast, targeting, triggers; projectile, burst, arc, orbit, chain, beam, zone, deployable, summon | `Skills.archetype(name, {cast, update})`, `Skills.step(S)` |
| `25-boss` | sim | phases, telegraphs | `Boss.step(S)` |
| `26-director` | sim | tolls, threat budget, gates, events, drops, shard merging, routes | `Director.step(S)`, `Director.event(kind, fn)` |
| `27-offers` | sim | chime, node and reward offers | `Offers.push(S, source)`, `Offers.resolve(S, cmd)` |
| `28-bot` | sim | scripted players | `Bot.input(S, policy)`, `Bot.choose(S, offer)` |
| `29-world` | sim | seeded regions, props, obstacles | `World.region(seed, zone)`, `World.propsNear(S, x, y, r, out)` |
| `30` to `49` | content | modes and curves; one file per class with its callings; Carillon; tree skeleton and sectors; sigils by attribute; bindings; vows; bases; affixes; uniques; currencies; chimes; one file per district with its enemies and boss; elite traits and chart modifiers; deeds; puppets; tilesets and props | `Defs.add(...)` only |
| `50-platform` | presentation | namespaces, storage adapter | `Store.read(key)`, `Store.write(key, obj)`, `Store.status` |
| `51-settings`, `52-input` | presentation | settings rows; all devices into one frame | `Settings.row(id, order, build)`, `Input.sample() -> InputFrame` |
| `53-audio`, `54-music`, `55-sound-<set>` | presentation | effects with rate limits; music ticked from the frame loop; suspended when hidden | `Audio.sfx(id, opts)`, `Audio.music(id)`, `Audio.suspend()` |
| `60-mesh`, `61-rigs`, `62-glyphs`, `63-ground` | presentation | primitive shapes and matrix maths; rig animation; icon painter; ground textures | `Rigs.register(name, fn)`, `Glyphs.icon(spec) -> canvas` |
| `66-gfx-gl`, `67-gfx-2d` | presentation | the 3D view; the compatibility view | `Gfx.create(canvas, prefer) -> backend` |
| `68-scene`, `69-vfx` | presentation | sim state to instance buffers; particles, numbers overlay, shake | `Scene.draw(S, alpha)`, `Vfx.consume(events)` |
| `70-ui-core` to `77-ui-meta` | presentation | screen stack and pad navigation; HUD; offers; hub; gear; tree; sigils; deeds, Carillon, memorial, onboarding | `UI.screen(id, {open, close})`, `UI.open(id, args)`, `UI.confirm(text)` |
| `90-game`, `99-boot` | presentation | state machine, 60 Hz accumulator (at most 4 steps a frame), pause when hidden; finalize and seal | `Game.start(cfg)`, `Game.sim(seconds, {bot})`, `Game.S`, `Game.debug` |

`Sim.step` order, set in one place: player, director, grid rebuild, enemies, skills, skill entities and hits, damage over time (4 times a second), deaths and drops (pools compact only here), pickups, sheet recompute if stale, offers, clock.

Renderer contract shared by both views:

```
Gfx.create(canvas, 'gl'|'2d') -> b      b.name, b.caps {shadows, lights, bloom, maxInstances}, b.stats {drawCalls, instances}
b.resize(cssW, cssH, dpr)   b.quality('high'|'medium'|'low')
b.begin(cam {x, y, zoom}, env {ambient, sun:{dir, color}, fog, ground})
b.parts(shape, buffer, count)       solid instances: 3x4 matrix, colour, flash, emissive
b.decals(buffer, count)             flat on the ground: telegraphs, scorch, pickup glow
b.billboards(buffer, count)         facing the camera: particles, bolts (alpha or additive)
b.lights(buffer, count)             x, y, z, radius, colour
b.end(post {bloom, flash, vignette, dither})
Gfx.worldToScreen(x, y, z)   Gfx.screenToWorld(sx, sy)
```

## Appendix B: data shapes

All definitions are plain JSON. Units are metres, seconds and radians.

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
         gainAsExtra critChance critMulti speed area projectiles pierce chain fork projSpeed duration range
         knockback chance.<ailment> build.freeze build.stun ailmentDuration minionLife flag.<id>

Scaled   = number | {a, b, curve:'lin'|'exp'}                 // owner level 1 -> 20
Mod      = {stat, op:'flat'|'inc'|'more'|'set', value:Scaled|[min,max], tags?:[Tag], cond?:Cond,
            per?:{stat:'str'|'dex'|'int'|'level'|'vows'|'chimes', div, cap?}, from?:Type, local?:true}
ModRange = {stat, op, tags?, cond?, local?, min, max}
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
          attacks:[Attack], res:{fire,cold,lightning,void}, armour, threshold, tags:[string]}
Boss   = Enemy & {arena:{radius}, phases:[{until, speed, onEnter:[attackId], loop:[attackId|{wait}]}]}
Zone   = {id, name, kind:'campaign'|'rite'|'chart', level, tollSeconds:75, keeperToll:8, gateEvery:3,
          region:{radius}, tileset, props:[{prop, density}], ambient:{light:[r,g,b], fog, sun}, music,
          timeline:[{toll, rate, cap, pool:[{enemy, w}]}], overtoll:{rateMul, levelPer, rewardPer},
          events:[{toll, kind:'elite'|'swarm'|'miniboss'|'shrine', enemy?, boss?, traits?, shape?, count?}],
          boss, rules:{}, unlock:deedId|null, next:zoneId|null}

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

Mode = {id, persistent, route:'zone'|'gauntlet', zones?, xpCurve, levelCap, runLevels,
        levelOffer:'none'|'node', runLevelOffer:'chime'|'none', eliteOffer, bossOffer, shrineOffer,
        haul:'gate'|'none', calling:{levels:[15,30,45,55]}|{afterBoss:1, pointsPerBoss:2},
        respec:'gold'|'last3', death:'permanent', score}

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

InputFrame = {mx, my, ax, ay, aim, dodge, draught, gate}
Command = {type:'pick'|'banish', index} | {type:'reroll'|'skip'|'leave'} | {type:'allocate', id, choice?}
        | {type:'equip', uid, slot}
Event   = {k:'hit'|'crit'|'kill'|'cast'|'hurt'|'pickup'|'level'|'offer'|'telegraph'|'phase'|'drop'|'toll'
           |'gate'|'end', x, y, a, b, id}
```

## Appendix C: rules

**A stat's value**

`V = clamp(set ?? (base + sum of flat) x max(0, 1 + sum of inc / 100) x product of (1 + more / 100), min, max)`

- A modifier applies when all of its tags are among the query's tags and its condition, if any, holds.
- All `inc` add together whatever their source. Each `more` multiplies on its own. Source order never matters.
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

**The defender, in order**

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

## Appendix D: stage packages

A contract package runs first and alone. The parallel packages then each own the files listed.

| Stage | Contract package | Parallel packages and owned files |
|---|---|---|
| 1 | **K0**: `tools/`, `package.json`, CI file, test runner and Node loader, `src/page`, `00 01 02 10 20 29 30 50 70 90 99`, a discs-only `67`. Confirms WebGL2 runs in the test browser. | **A1** combat: `11 21 22 23 24`, first class, three sigils. **A2** vigil: `15 25 26 27 28 44`, first district (6 enemies, boss), soak, bench. **A3** graphics: `60 61 63 66 67 68 69`, first puppets, against `Sim.debugScene`. **A4** shell: `51 52 53 54 55 71 72`, title and results in `73`. |
| 2 | **C0**: `14 16`, storage adapter, hub states, one life and the memorial, final signatures for `12 13`. | **C1** tree: `13 33`, two sectors, `75`. **C2** items: `12 40 41 43 74`. **C3** sigils: chain, beam, zone archetypes, `36 37 38 76`. **C4** hub and meta: `73 77`, deeds and the Carillon in `15`, `32 47`. |
| 3 | **M0**: gauntlet mode in `30`, route in `26`, node and reward offers in `27`, checkpoint in `16`. | **M1**: offer and compare screens, records. **M2**: gauntlet scripted player, curves, balance script. |
| 4 | **B0**: deployable and summon archetypes, elite traits, rites, charts, `tools/counts.js`, content templates. | New files only: one bundle per class (class file, tree sector, puppets), per district (district file, puppets, sounds), sigils per attribute, uniques and affixes, deeds, chart modifiers. |
| 5 | none | Lighting and effects (`66 68 69`); audio (`53 54 55`); onboarding (`71 77`); speed and balance (tests, `30`). |
| 6 | **W0**: `29-world` streaming regions, world state in the save, director by region. | Districts joined and dressed; sanctuaries; world map; open-world scripted player and tests. |

Acceptance at each stage, in addition to `npm run test:full` passing:

- **Stage 1.** Touch only at 390 by 844: title, a vigil, ten simulated minutes with the scripted player, the boss, leaving through a gate, results, with no page errors. Both views draw a 600-enemy test scene. The published-page fragment has no document tags and breaks none of the page restrictions. Determinism and speed budgets hold.
- **Stage 2.** Level, tree and gear survive a reload. Export then import returns the same save. A character that dies is on the memorial and cannot be played. A Carillon node bought by one character changes the next one. Hub controls are at least 44 pixels at phone size.
- **Stage 3.** The scripted player finishes a gauntlet in Node. Every level-up offers three valid nodes. The Watch's characters are untouched. The gauntlet plays with storage disabled.
- **Stage 4.** `tools/counts.js` meets the wave targets. Every class in every district soaks clean. Balance bands hold. The word list is clean. The file is at most 2 MB.
- **Stage 5.** Sound stops when the page is hidden. Onboarding completes by touch alone. Two review passes in a row find nothing above minor.
- **Stage 6.** Walking between two districts never stalls a frame for more than 50 ms in the bench. A reload returns you to the same place with the same bells rung.
