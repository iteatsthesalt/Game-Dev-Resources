# Tollbound engine notes

These are the contracts every module is written against: how files are shaped, what the simulation state looks like, the data shapes content is authored in, and the rules of stats and damage. `docs/design.md` holds the game itself (names, numbers, content lists). `docs/plan.md` is the approved plan and is a snapshot; where it differs from this file, this file wins. Once a module exists, its code and its header comment win over this file, and whoever changes an interface updates this file in the same change.

## Conventions

**Language.** Plain JavaScript (ES2020), classic scripts, no dependencies, no build step beyond concatenation. Everything in `src/js` is joined into one `<script>` in the order `tools/modules.js` gives.

**File shape.** A file is one enclosed function that adds to its own namespace and to nothing else:

```js
// 10-stats.js: stat tables, modifier matching, sheets.
// Public: Stats.sheet(mods, ctx), Stats.skillSheet(mods, sigilInst, sheet), Stats.query(mods, stat, tags, conds)
(function () {
  'use strict';
  Stats.sheet = function (mods, ctx) { /* ... */ };
})();
```

- Namespaces are the only top-level names. `00-core.js` declares the simulation ones, `50-platform.js` the presentation ones. No other file declares anything at top level.
  - Simulation: `Core Defs Stats Dmg Items Tree Char Progress Legacy SaveData Sim Player Buffs AI Enemies Skills Boss Director Offers Bot World`
  - Presentation: `Store Settings Input Sound Music Mesh Rigs Glyphs Ground Gfx Scene Vfx UI Game`
- Nothing runs when a file loads except definitions and registrations. `99-boot.js` starts the game.
- No file reassigns a function another file defined. Modules extend each other through registries (`Defs.add`, `AI.register`, `Skills.archetype`, `Rigs.register`, `Director.event`, `Settings.row`, `UI.screen`) and through the per-step event queue.
- `Core.seal()` freezes every namespace at boot, so a late reassignment throws in tests.
- Each file starts with a comment that lists its public functions. That comment is the interface.

**Layers.** `tools/lint.js` enforces them.

| Files | Layer | May use |
|---|---|---|
| `00` to `29` | simulation | other simulation namespaces only. No `window`, `document`, `navigator`, `performance`, `Date`, `Math.random`, timers or storage. |
| `30` to `49` | content | `Defs.add` only. Plain JSON-serializable data: no functions, no `undefined`, no references to other objects. |
| `50` to `99` | presentation | everything. Reads simulation state and the event queue; changes the simulation only through `Sim.step(S, input)` and `Sim.command(S, cmd)`. |

Files below 50 load in Node with nothing but `console`. That is how the simulation tests run, and it is what keeps the rules portable to another engine.

**Units and axes.** Metres, seconds, radians. The world is a flat ground plane: the simulation uses `(x, y)` on the ground, and the 3D view draws simulation `y` along its depth axis with height as a third value. No frame counts appear in data; durations are seconds.

**Determinism.** The simulation advances in fixed steps of 1/60 s. All randomness comes from seeded streams forked from the run seed (`S.rng.spawn`, `S.rng.loot`, `S.rng.combat`, `S.rng.offers`, `S.rng.world`). Presentation has its own unseeded stream for cosmetic effects and never feeds anything back. The same seed and the same inputs give the same `Sim.hash(S)`.

**Speed.** The simulation step runs with hundreds of entities, so hot loops allocate nothing:

- Entities live in `Core.Pool`s of fixed-shape objects and are removed by swap, only in the deaths phase of the step.
- Neighbour queries go through `Core.Grid` and write into a caller-supplied array.
- No closures, array literals, object literals, `map`/`filter`/`forEach` or string building inside per-entity loops.
- Hard caps: 600 enemies, 500 projectiles, 120 areas, 400 pickups. When a cap is hit, the oldest or weakest is merged or dropped, never an error.

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

`Sim.create(cfg)` returns the run state `S`. It is plain data plus pools. The first engine package fixes the exact fields and documents them at the top of `20-sim.js`; this is the intended shape.

```js
cfg = {mode, zone, seed, char, account}       // char is a deep copy; the run changes the copy, the game writes it back

S = {
  cfg, mode, zone,
  rng: {spawn, loot, combat, offers, world},
  step, t,                                    // step count; seconds = step / 60
  toll, threat,                               // tolls rung so far; threat tier
  phase: 'play'|'offer'|'ended',
  player: {x, y, vx, vy, face, aimX, aimY, life, hush, hushWait, dodgeT, dodgeCd, invuln,
           draughts, runLevel, runXp, alive /* plus status timers */},
  sheet,                                      // Sheet, rebuilt when S.dirty
  skills: [{inst, sheet, cd /* plus archetype state */}],
  enemies, shots, areas, pickups, minions,    // Core.Pool
  grid,                                       // Core.Grid over enemies, rebuilt each step
  props: [],                                  // colliders and lights from World.region
  gate: null|{x, y, until, hold},
  boss: null|enemy,
  offer: null|Offer, offerQueue: [],
  chimes: {}, buffs: [],
  events: [],                                 // filled during a step, cleared at the start of the next
  haul: [], gold, echoes, kills, counters: {},
  dirty,                                      // true when modifiers changed and sheets must be rebuilt
  result: null|{outcome:'left'|'died', /* totals */}
}

Offer = {kind:'chime'|'node'|'reward', source, options:[{id, kind, name, text, icon, rarity}], rerolls, banishes, skips}
```

While `S.phase` is `'offer'` the clock does not advance and `Sim.step` does nothing until `Sim.command(S, {type:'pick', ...})` resolves the offer. This is what lets `Game.sim(seconds, {bot: true})` play through level-ups without any menu.

`InputFrame`: `mx, my` is the move vector with length at most 1. `ax, ay` is a unit aim vector, used only when `aim` is true; otherwise each sigil picks its own target. `dodge` and `draught` are true only on the step they are pressed.

## Modules

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
| `53-sound`, `54-music`, `55-sound-<set>` | presentation | effects with rate limits; music ticked from the frame loop; suspended when hidden | `Sound.sfx(id, opts)`, `Music.play(id)`, `Sound.suspend()` |
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

## Data shapes

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

InputFrame = {mx, my, ax, ay, aim, dodge, draught}
Command = {type:'pick'|'banish', index} | {type:'reroll'|'skip'|'leave'} | {type:'allocate', id, choice?}
        | {type:'equip', uid, slot}
Event   = {k:'hit'|'crit'|'kill'|'cast'|'hurt'|'pickup'|'level'|'offer'|'telegraph'|'phase'|'drop'|'toll'
           |'gate'|'end', x, y, a, b, id}
```

## Rules

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

