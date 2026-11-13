# Tollbound: combat

This file is the combat model in full: the kinds of harm, protection, every condition, healing, the two buttons, how the player and the dead differ, what the screen shows, the attributes, and the engine changes that put all of it into the tables of `src/js/10-stats.js`. Words are as in `01-world.md`. Numbers are starting values for tuning.

## The model in four sentences

1. Harm comes three ways: a Blow is one strike you see raised first, Drag bites four times a second while a crowd presses you or bad ground holds you, and a Swell is a great strike drawn on the ground that fills before it lands.
2. Stand still to Brace against Blows, run hard to Stride out of Drag, and keep a pillar or a big body between you and a Swell; the dead are covered by the same rules, so strike the runners and grind the standers.
3. Anyone who has just turned sharply is Wrong-footed and takes half as much again, and the dead walk the path you walked, so they turn wherever you turned.
4. The life you lose lies on the ground where you lost it: stand on it to take it back before it scars.

## 1. Posture

Every body, the player and each of the dead, has a posture, worked out every step from its own movement. Movement is the body's steering speed. Shoves and currents are not movement, but a shove ends Brace.

| Posture | When it holds | What it guards |
|---|---|---|
| still | speed under 15% of the body's top speed | |
| Braced | still for `brace-time` (0.4 s); it lasts until speed rises to 15% or the body is shoved 0.3 m or more | Blows |
| moving | speed 15% of top speed or more | |
| Striding | speed at least `stride-share` (70%) of the body's dry-ground top speed, held for 0.25 s; it ends when speed falls below | Drag |
| Wrong-footed | see section 4 | nothing; it is a weakness |

A body's top speed for these tests is its top speed on dry ground. Water slows a body against that number, so deep water can take Stride away (section 6).

## 2. Kinds of harm

Every voice and every attack of the dead deals one kind of harm.

| Kind | How it arrives | Its warning | Its guard |
|---|---|---|---|
| **Blow** | at once, on whatever is inside its shape when it lands: an arc, a thrust line, a thrown thing | an attack of the dead raises its striking part for its wind-up, 0.3 to 0.8 s, and locks its aim when the wind-up starts; your voices give no warning | Brace |
| **Drag** | counted every 15th step, four times a second, for as long as its cause lasts: one of the dead touching you (its press), a rider, a zone, bad ground | none; you see the crowd, the rider or the ground | Stride |
| **Swell** | drawn on the ground as a shape that fills, and lands when it is full. A spreading Swell fills outward from a source (a ring, a wedge, a lane); a falling Swell darkens a circle from its rim to its centre | its fill time: 0.8 to 3 s for the dead's Swells, plus your warning (section 9); 0.6 to 2 s for your voices'. Its aim locks when it is first shown | Lee, for a spreading Swell; for a falling Swell, only being outside it |

Three rules hold for every hit:

- **A Swell is bare.** It ignores the guards and the harm-taken modifiers of whatever it lands on. Only Wrong-footed adds to it.
- **Water holds.** Drag on a body standing in water is multiplied by the band at its feet: ankle 1, knee 1.25, waist 1.5.
- **Nothing is random but the roll.** A hit rolls within its range of harm. There are no critical strikes, no evasion, no dodge, no shield and no resistance by element.

## 3. Protection

**Brace.** A Braced body takes Blows times (1 − guard ÷ 100), where the guard is `guard.blow`, at most `guard-max.blow`. The player starts at 50 and can reach 80. Each kind of the dead has its own Brace guard, 50 unless its kind says otherwise.

**Stride.** A Striding body takes Drag times (1 − `guard.drag` ÷ 100), at most `guard-max.drag`. The player starts at 60 and can reach 85. The dead's Stride guard is 60 unless their kind says otherwise.

**Lee.** When a spreading Swell lands, every body inside its shape is tested: if a prop, or a large body other than itself, stands on the straight line from the Swell's source to it, within `lee-reach` of it (the player's stat, 3 m to start; the dead always 3 m), it is in lee and the Swell does nothing to it. Large bodies are the heavy dead, elites, keepers, burgesses and anything else whose kind is marked large. A falling Swell has no source and no lee: be outside it when it lands.

**Piercing a guard.** A voice's `through.blow` and `through.drag` ignore that share of a target's Brace or Stride guard.

**No posture covers all three.** Standing in a crowd braces you against its Blows and gives you to its Drag. Running shakes off the Drag and leaves you open to Blows. Cover against a Swell is only where something stands. The dead are covered the same way: a train following you at speed is Striding, so your Drag barely bites it and your Blows land in full; a crowd pressed round you, or halted, mourning or moored, is Braced, so your Blows are halved and your Drag bites in full. Your Swells ignore both, but the dead shelter one another from them.

## 4. Wrong-footed

A body moving faster than 30% of its top speed records its heading every 0.1 s. If its heading now differs by more than its turn limit from any heading it recorded in the last 0.5 s, it is Wrong-footed for 0.5 s from that moment (keepers 0.25 s). The turn limit is 90° for the dead and `turn-limit` for the player (90° to start).

A Wrong-footed body takes 50% more from all harm, Swells included. Against the dead the number is the striking voice's `wrong-foot` stat; against the player it is `wrong-foot-taken`.

Because the common dead walk your wake (section 5), every sharp corner you cut is a corner they turn 1.2 s later, Wrong-footed, while you are already through it.

## 5. How the dead move

- **The wake.** Your wake is the path you walked in the last `wake-length` seconds (5 s), kept as a point every 0.1 s.
- **The common dead steer at the place you stood `wake-lag` ago** (1.2 s), not at you. Walking draws them into a train on your exact path; a cut back meets them side-on; a stop is found in about 1.2 s.
- Elites, keepers and the duty-dead steer at you or by their own rule. Every body keeps the engine's capped separation from its neighbours.
- **The train.** The dead that follow your wake closely become In Procession (section 7), faster and riper; voices can count them.

## 6. Water and the tide

The ground of every district has a height, and every district has a tide. The depth at a place is the tide's level less the ground's height there (section 15.13).

| Band | Depth | Speed | Drag held |
|---|---|---|---|
| dry | under 0.05 m | full | ×1 |
| ankle | under 0.3 m | full | ×1 |
| knee | under 0.6 m | −15% | ×1.25 |
| waist | 0.6 m or more | −35% | ×1.5 |

- In waist water nobody Strides, because 65% of top speed is under the 70% needed, unless a build has lowered its `stride-share` to 65% or less.
- Currents move every body in water along the district's channels, as fast as the level is changing; the player is moved times `shove-taken`. Floating things (heaved finds, the drowned) ride the full current.
- Fresh water (fonts, rain pools) rinses Brine.
- **The tide.** Each toll turns it: the first 75 seconds of a vigil ebb from high water, odd tolls begin a flood, even tolls an ebb. Within an interval the water moves by the rule of twelfths, its six parts moving 1, 2, 3, 3, 2 and 1 twelfths of the change, and it stands slack for 3 s either side of each toll. The flood that ends at every fourth toll is a spring and rises twice as high above the mean, so the keeper's toll, the eighth, brings the highest water of the first eight. Each district sets its mean level and its range; the Dial and the Hanging Quarter are above it.

## 7. Conditions

A body carries at most one of each condition. Each condition stores three numbers in the engine's arrays: a time T, a strength V and a spare number N.

| Id | Carried by | Applied by | T | V | N | Rule |
|---|---|---|---|---|---|---|
| `wrong-footed` | all | the turn rule (section 4) | seconds left (0.5; keepers 0.25) | the turn, in degrees | | takes +50% from all harm (`wrong-foot` against the dead, `wrong-foot-taken` against you). Your pull as a Change-ringer never wrong-foots you. |
| `in-procession` | the common dead (not elites or keepers) | the train rule | seconds a halt has left (Wand-bearer), else 0 | seconds it has followed, building to 5 | 1 while in procession | A dead that stays within 2.5 m of your wake for 5 s unbroken is In Procession: 15% faster, takes `procession-bonus` (30%) more harm from you, gives 25% more experience. It ends when it touches you, is shoved, or strays more than 3 m from the wake. Voices that count the train count at most `procession-cap` (40). |
| `moored` | the dead, not keepers | voices and knots that say so | seconds left (4) | the stake's number | its place in the line | A stake is driven at a point and up to 12 of the dead within 2.5 m are tied to it in the order they followed. Each moves only within 2.5 m of the stake. Felling or shoving one jerks the next 1 m inward and Wrong-foots it. The moored stand, so they Brace and take Drag in full. It ends after 4 s or when fewer than two remain; a body cannot be moored again for 6 s. |
| `sounded` | large dead and keepers | the band rule | seconds left (6, renewed while held) | seconds held in the band, building to `sound-time` (2) | | Kept 4 to 6 m from you for `sound-time`, it is Sounded: your harm against it always rolls the top of its range, and its attacks are shown 0.3 s earlier. It ends 0.5 s after it leaves the band. |
| `coiled` | large dead and keepers | the circuit rule | seconds left (10 after the last circuit) | the angle you have walked round it, signed, sunwise positive | coils, to 3 | Each full sunwise circuit you walk round it within 6 m adds a coil, and its attacks come 12% slower per coil. One full widdershins circuit spends every coil at once, each a Blow worth 150% of the last hit of your strongest voice. |
| `mourning` | the common dead | the death of an elite or keeper within 8 m | seconds left (12) | grade: 2 full, 1 half, 3 roused | | Full mourning, the first 6 s: it turns black, stops, faces the body and will not strike. Half mourning, the next 6 s: grey, half speed, strikes half as often. Harmed in full mourning it is roused instead and strikes 30% faster for 6 s. Mourners stand: Braced, and open to Drag. |
| `clung` | you, and large dead | hangers-on, small dead that leap on from 1.5 m | | Drag per rider per second | riders, to 5 | Each rider takes 8% off top speed and deals its Drag each second. Standing still lets another within 3 m climb on every 2 s. Riders never fall off by time: pass within 0.8 m of a large dead while Striding and every rider moves onto it, where they drag and bite it instead. |
| `coined` | the dead, not keepers | voices, knots and favours that say so; a snuffed lamp | seconds left (5) | its heading | the coins it drops: 2, or 4 if laid while coined, or 0 when blinded by a lamp | It walks straight on its heading, turning only at props, and every body it walks into, the dead included, takes its contact harm as a Blow. It ends on time, or when a Swell lands within 4 m. When it ends it drops its coins. |
| `swing` | the dead; you are only shoved | the alternation rule | | the direction of the last Blow on it | swing, to 6 (keepers 12) | A Blow arriving more than 120° off the direction of the last Blow on that body adds 1; one within 60° takes 1 away; it never fades. At 6 the body goes over: it is thrown 4 m along the last Blow (keepers 1 m) and strikes each body within 1 m of its path with a Blow worth 10% of its own greatest life, and its swing returns to 0. On you, 6 shoves you 2 m. |
| `sealed` | all | wax voices, knots, observances | seconds left (15) | the hit that breaks it, as a share of greatest life (8%) | | While sealed, no other condition on the body expires, starts or ends. The seal breaks on one hit worth 8% or more of its greatest life, or after 15 s. |
| `brined` | all | Salters, and voices and knots that say so; only a body in water takes stacks | crust seconds (3) once it has landed | | stacks, to 20 (you 10) | Brine does nothing while the body is in water. The moment it stands on dry ground every stack lands at once as bare harm worth 4% of its greatest life (elites 2%, keepers 1%, you 2%), and it is crusted for 3 s, taking no new stacks. One second in fresh water rinses every stack off. |
| `tolled-for` | you | your life reaching 0, once a vigil | seconds left, until the next toll | | | Your voices stop, you run 20% faster, and a lychgate opens at the farthest edge of the district. Nothing can lower your life, but each Blow or Swell that lands takes 1 s off your time and each Drag tick 0.25 s. Reach the lychgate in time and you live: the vigil ends at once and your whole haul is lost. Otherwise you join the dead when the toll rings. Wounds cannot be mended. |
| `filed` | the common dead | a Beadle's wedge | seconds left (5) | its side, −1 or +1 | its place in the file | It stands in a still file facing inward along the lane the Beadle walked, does not strike, and is Braced. If the Beadle turns back into the lane, the whole file strikes inward at once and the files end. |
| `tolled` | the dead | a Toll-gatherer's bar | seconds left of the paying window (10) | | payments in the window | Each pass of the bar is a Blow times 2 to the power of (payments − 1), at most ×8. The window restarts with each payment. |
| `burgess` | the common dead | an Alderman's bar (three payments) | | tolls stood as a burgess | | It stops, cannot harm or be harmed, blocks like a prop, gives lee, and pays 1 coin into your haul at each toll it stands. It lasts the vigil. |

## 8. Healing: wounds

- **Opening.** All the life that harm takes from you opens a wound on the ground where you stood, a disc 1 m across, holding that life. Harm that lands within `wound-join` (2 m) of an open wound joins it instead, adding its life to it. At most `wound-cap` (10) wounds lie open; when another would open, the oldest scars at once.
- **Depth.** A wound's depth is the warning its harm was shown for: a Blow's wind-up, a Swell's fill time as you saw it, 0 for Drag. A joined wound keeps the deepest.
- **Mending.** Stand Braced inside a wound (within `mend-reach`, 1 m, of its centre) and it gives its life back evenly over (1 s + 2 × depth) ÷ `mend-rate`. Stepping off keeps what has come back. A Drag wound mends in 1 s; a Blow wound with a 0.5 s wind-up in 2 s; a Swell wound filled over 2 s in 5 s. Harm is a debt in seconds, owed to a place.
- **Scars.** A wound left open for `wound-term` (60 s) scars: `scarring` (100%) of the life still in it comes off your greatest life until the vigil ends. The disc greys as it nears its scar.
- **Laying the dead on a wound.** If `mend-on-lay` is above 0, each of the dead laid inside one of your wounds mends that share of it at once.
- **Nothing else heals** unless a voice, knot, favour or observance says so. Between vigils a character is whole.

## 9. Heed and warning

- Every character has `heed-max` Heed (100). Each observance holds part of it ("Observances and Heed" in `04-progression.md`).
- Each point of free Heed shows every Swell aimed at you 0.01 s sooner. `warn`, lamp light (0.4 s in a lit lamp's light), the Register (0.15 s per death to that attack, to three deaths) and a Sounded attacker (0.3 s) add to it. The total is never more than 1 s.
- A Swell shown sooner fills for longer: it is aimed when first shown, at where you were, so the extra time is time to leave.
- Heed is a bar under the life bar: free Heed bright, held Heed in each observance's colour.

## 10. The two buttons

**The trade (button A)** is the class's own act, shown with its tool's icon and a recharge wedge. Each class's trade is in `03-classes.md`. Its recharge is multiplied by `trade-recharge`.

**The heave (button B)** gives something up. It throws the find you carry with the most notches 5 m ahead of you. It lands as a Blow on a circle 2 m across and bursts once for each notch it carries, 0.2 s apart; each burst is a Blow whose harm is set by the district's level, times `heave-harm`. A find with no notches lands once at half harm. Then it lies blank where it fell: its written lines are gone, its base and its fixed line remain. On water it floats and drifts with the current. Walk over it to carry it again. Recharge `heave-recharge` (4 s).

**Ballast.** Every find you carry takes `find-weight` (1.5%) off your top speed and makes shoves and currents move you `find-steady` (4%) less, to at most 60% less. A laden character is slow, hard to move, and one button from being light.

## 11. Leaving, and the last seconds

- A lychgate opens for 25 s after each elite or keeper falls and at every third toll. Standing in it rings you down: six strokes a second apart, each banking a sixth of your haul in the order you set and silencing a sixth of your voices. The sixth stroke ends the vigil. Driven out sooner, you keep what was banked, stay in the vigil, and your silenced voices come back one every 2 s.
- At no life you are Tolled-for (section 7), once a vigil. A second fall to no life in the same vigil is death.

## 12. The player and the dead

Both obey every rule above. They differ in these ways only:

- Only you wound and mend. The dead have plain life and do not mend unless their kind says so.
- The common dead steer at your place `wake-lag` ago; elites, keepers and the duty-dead steer at you or by their own rule.
- The dead's Blows wind up and lock their aim; your voices speak at once when ready. Your Swells fill too, and the dead's lee works against them.
- You carry only `wrong-footed`, `clung`, `swing` (as a shove), `sealed`, `brined` and `tolled-for`.
- Keepers are Wrong-footed for 0.25 s, need 12 swing to go over and are thrown only 1 m, and cannot be moored, coined, put in mourning, filed or made burgesses.
- Your attributes and stats sharpen your postures. The dead's guards, size and turn limit are fixed by their kind.

## 13. What the screen shows

Nothing the player must read in a fight is text.

- **Under every body, its posture:** a closed pale ring when Braced, a short trailing streak when Striding, a white flash of the outline when Wrong-footed. The crowd's marks say which of your voices will bite.
- **The dead's attacks:** a Blow's striking part rising, white at the top of its wind-up; a Swell's shape filling in pale bone with a dark rim, with its lee cut out of it as clean ground; a falling Swell darkening from its rim.
- **Your wake** as a faint line on the ground, and a thin thread from each body In Procession to it.
- **Wounds** as deep red discs, darker for deeper, greying toward a scar, with a ring closing on the disc while you mend.
- **The life bar:** your life in your class colour, the life lying in open wounds as a pale part, scars as a dark end.
- **The Heed bar** under it.
- **The row** of six favours as small shapes in a corner, the first three raised.
- **The toll:** a ring closing round the screen's edge in its last 3 s, and a small tick at each quarter. The count after each toll is heard, and drawn as marks if set.
- **The haul** as small boxes on your back, one per find, each striped with its notches.
- **Buttons** with their icons and recharge wedges.
- **Conditions** as shapes and colours on the body: a thread for In Procession, a rope to a stake for Moored, two thin rings for Sounded, coils at the base for Coiled, black or grey for mourning, small boxes stuck on for riders, two bright discs for coins, a tick arc from 3 swing, a red wax disc for sealed, a white crust for Brine, a grey screen and a far lit lychgate for Tolled-for, a file for filed, a striped band for tolled, a stone colour for a burgess.
- **Water** drawn as itself, and tide marks in bands on every pillar.

## 14. Attributes

There are four attributes, one for each thing the thumb can do: stop, go, close in, and wait for the moment.

| Attribute | Measures | Each point | Every 10 points |
|---|---|---|---|
| **Knee** | standing still | +2 greatest life; +1% harm of voices tagged `still` | `brace-time` −0.03 s (least 0.1 s); `guard.blow` +2 (to `guard-max.blow`) |
| **Heel** | moving | +0.25% top speed; +1% harm of voices tagged `moving` | `stride-share` −1 point (least 40) |
| **Hand** | closeness | +1% harm to the dead within 3 m; +1% pickup reach | `mend-reach` +0.1 m (most 2.5 m) |
| **Ear** | timing | +1% harm of voices tagged `timed`; +1 greatest Heed | `warn` +0.05 s (within the 1 s limit) |

**How voices, knots and finds ask for them.** Each names one attribute and a number it wants. Nothing is locked: below the number, everything it gives works at your value divided by the number, never less than 20% and never more than 100%.

- A voice wants 10 × its tier (tiers 1 to 5) of its attribute: Knee for a voice tagged `still`, Heel for `moving`, Ear for `timed`; any other voice names its own, most often Hand.
- A knot wants 6 × its tier of its attribute.
- A find wants 4 × its written lines of the attribute of the posture that wrote most of them: Knee for stood, Heel for strode, Hand for pressed, Ear for timed. A blank find wants nothing.

**Gains.** A character starts with 10 in its class's first attribute, 5 in its second and none in the others. Each character level gives 2 to the first and 1 to the second. Lanes on the Plan give one point of your choice.

## 15. Engine changes

These replace the placeholder rows of `src/js/10-stats.js`, keep every table's shape, and add the columns listed. Ids are lower-case words joined by dashes or dots. Where code names a row today, the new id is given.

### 15.1 Stats.TYPES, the kinds of harm

```js
// guard: the posture that guards it. shown: how it is warned (a wound's depth comes from it). ticks: dealt on
// Dmg.tick, four times a second, not on landing. bare: ignores the target's guards and harm-taken modifiers
// (only Wrong-footed adds). guardBase, guardMax: base and cap of its guard.<id> and guard-max.<id> rows.
const TYPES = [
  { id: 'blow',  guard: 'brace',  shown: 'windup', ticks: false, bare: false, guardBase: 50, guardMax: 80 },
  { id: 'drag',  guard: 'stride', shown: 'none',   ticks: true,  bare: false, guardBase: 60, guardMax: 85 },
  { id: 'swell', guard: 'lee',    shown: 'fill',   ticks: false, bare: true,  guardBase: 0,  guardMax: 0 },
];
```

The `elemental` column goes, and with it the `elemental` tag and the `res.elemental` row.

### 15.2 Stats.FAMILIES, the families of finds

```js
const FAMILIES = ['rope', 'verge', 'pike', 'pole', 'bellows', 'spade'];   // the six trade tools
```

A tool is the find in the `tool` slot. No voice takes its harm from a tool: every base's `weapon` profile is null, so no skill sheet is ever armed. A family is a tag that lines and knots may name ("while you hold a pike").

### 15.3 Stats.PRIMARIES, the attributes

`gives` becomes a list. Each give is one modifier, counted once for every `div` points.

```js
const PRIMARIES = [
  { id: 'knee', gives: [
    { stat: 'life-max', op: 'flat', value: 2, div: 1 },
    { stat: 'damage', op: 'inc', value: 1, div: 1, tags: ['still'] },
    { stat: 'brace-time', op: 'flat', value: -0.03, div: 10 },
    { stat: 'guard.blow', op: 'flat', value: 2, div: 10 } ] },
  { id: 'heel', gives: [
    { stat: 'move-speed', op: 'inc', value: 0.25, div: 1 },
    { stat: 'damage', op: 'inc', value: 1, div: 1, tags: ['moving'] },
    { stat: 'stride-share', op: 'flat', value: -1, div: 10 } ] },
  { id: 'hand', gives: [
    { stat: 'damage', op: 'inc', value: 1, div: 1, cond: 't-near' },
    { stat: 'pickup-reach', op: 'inc', value: 1, div: 1 },
    { stat: 'mend-reach', op: 'flat', value: 0.1, div: 10 } ] },
  { id: 'ear', gives: [
    { stat: 'damage', op: 'inc', value: 1, div: 1, tags: ['timed'] },
    { stat: 'heed-max', op: 'flat', value: 1, div: 1 },
    { stat: 'warn', op: 'flat', value: 0.05, div: 10 } ] },
];
```

`INHERENT` is built from every give, as `{stat, op, value, tags?, cond?, per: {stat: id, div}}`, and joins the modifier lists of both the player's sheet and each skill sheet (today it joins only the player's). `Req` becomes `{level?, knee?, heel?, hand?, ear?}`, and the share rule of section 14 replaces locking.

### 15.4 Stats.PER, what a "per" modifier may count

The four attributes, then the counts `['level', 'observances', 'favours', 'finds', 'debts']`: character level, observances kept, favours taken this vigil, finds carried, and the Surety's debts. A change in any of them sets `S.dirty`.

### 15.5 Stats.AILMENTS, the conditions

New columns: `by` (`'rule'`: a behaviour applies and runs it; `'effect'`: a voice, knot, favour, observance or class rule lays it; `'hit'` is not used), `rule` (the behaviour's id when `by` is `'rule'`), `on` (`'dead'`, `'player'` or `'both'`), `spares` (what never carries it: any of `'small'`, `'large'`, `'elite'`, `'keeper'`), `keeperSeconds` (in place of `bossSeconds`), `keeperStacks`, `playerStacks`. The columns `from`, `attack`, `build`, `dot`, `follows` and `melee` are not used. `chance: true` makes a `chance.<id>` row, so knots and lines can grant "a chance on each hit to coin". What T, V and N hold, and each rule, are in section 7.

```js
// Each row's comment says what condT (T), condV (V) and condN (N) hold for it; its rule is in section 7.
const AILMENTS = [
  { id: 'wrong-footed', by: 'rule', rule: 'footing', on: 'both', seconds: 0.5, keeperSeconds: 0.25, cond: 't-wrong-footed', player: true },
      // T seconds left; V the turn in degrees; N unused
  { id: 'in-procession', by: 'rule', rule: 'procession', on: 'dead', spares: ['elite', 'keeper'], cond: 't-in-procession', player: false },
      // T seconds a halt has left (Wand-bearer), else 0; V seconds followed, building to 5; N 1 while in procession
  { id: 'moored', by: 'effect', on: 'dead', spares: ['keeper'], seconds: 4, stacks: 12, immune: 6, cond: 't-moored', player: false },
      // T seconds left; V the stake's number; N its place in the line
  { id: 'sounded', by: 'rule', rule: 'sounding', on: 'dead', spares: ['small'], seconds: 6, cond: 't-sounded', player: false },
      // T seconds left; V seconds held in the 4 to 6 m band, building to sound-time; N unused
  { id: 'coiled', by: 'rule', rule: 'coiling', on: 'dead', spares: ['small'], seconds: 10, stacks: 3, cond: 't-coiled', player: false },
      // T seconds left; V signed angle walked round it, sunwise positive; N coils
  { id: 'mourning', by: 'rule', rule: 'mourning', on: 'dead', spares: ['elite', 'keeper'], seconds: 12, cond: 't-mourning', player: false },
      // T seconds left; V grade (2 full, 1 half, 3 roused); N unused
  { id: 'clung', by: 'rule', rule: 'riders', on: 'both', spares: ['small'], stacks: 5, cond: null, player: true },
      // T unused; V Drag per rider per second; N riders
  { id: 'coined', by: 'effect', chance: true, on: 'dead', spares: ['keeper'], seconds: 5, cond: 't-coined', player: false },
      // T seconds left; V its heading in radians; N coins it drops (2, 4 if laid while coined, 0 if blinded by a lamp)
  { id: 'swing', by: 'rule', rule: 'swing', on: 'both', stacks: 6, keeperStacks: 12, cond: null, player: true },
      // T unused; V direction of the last Blow, radians; N swing
  { id: 'sealed', by: 'effect', chance: true, on: 'both', seconds: 15, amount: [8, 8], cond: 't-sealed', player: true },
      // T seconds left; V the share of greatest life one hit must reach to break it (0.08); N unused
  { id: 'brined', by: 'effect', chance: true, on: 'both', stacks: 20, playerStacks: 10, immune: 3, cond: 't-brined', player: true },
      // T crust seconds left after it lands; V unused; N stacks
  { id: 'tolled-for', by: 'rule', rule: 'reprieve', on: 'player', cond: null, player: true },
      // T seconds left until the next toll; V unused; N unused
  { id: 'filed', by: 'effect', on: 'dead', spares: ['elite', 'keeper'], seconds: 5, cond: null, player: false },
      // T seconds left; V its side, -1 or +1; N its place in the file
  { id: 'tolled', by: 'rule', rule: 'toll-bar', on: 'dead', seconds: 10, stacks: 8, cond: null, player: false },
      // T seconds left of the paying window; V unused; N payments in the window
  { id: 'burgess', by: 'effect', on: 'dead', spares: ['elite', 'keeper'], cond: null, player: false },
      // T unused (it lasts the vigil); V tolls stood as a burgess; N unused
];
// 15 of COND_MAX (16) rows.
```

### 15.6 Stats.TAGS

The tags are, as today, the kinds of harm, the families, the role tags and the condition ids. The role tags become:

```js
const ROLE_TAGS = ['attack', 'hit', 'dot',            // named by the code; no voice carries 'attack'
  'still', 'moving', 'timed',                          // the voice speaks, or is stronger, while you stand / move / on the clock
  'thrown', 'ground', 'line', 'round', 'planted', 'held',   // it travels / lies on the ground / runs between two points /
                                                       // circles you / stays where it was set / lasts
  'turn', 'crossing', 'water', 'trade', 'heave'];      // it answers a turn / a crossing of your wake / water; it belongs
                                                       // to the trade or the heave
```

### 15.7 Stats.CONDS, the modifier conditions

31 bits, the most one number holds.

```js
const PLAYER_CONDS = ['braced', 'striding', 'crowded', 'after-quarter', 'wrong-footed', 'in-water', 'dry',
  'on-wound', 'laden', 'scarred', 'faint', 'at-post', 'in-light', 'tolled-for'];
const TARGET_CONDS = ['t-braced', 't-striding', 't-large', 't-elite', 't-keeper', 't-near', 't-far', 't-in-water'];
// and one target condition for each AILMENTS row with a cond: t-wrong-footed, t-in-procession, t-moored,
// t-sounded, t-coiled, t-mourning, t-coined, t-sealed, t-brined
```

| Condition | Holds while |
|---|---|
| `braced`, `striding` | you are Braced, Striding |
| `crowded` | three or more of the dead are within 3 m of you |
| `after-quarter` | the first 8 s after each quarter of the toll interval (18.75 s, 37.5 s, 56.25 s, and the toll) |
| `wrong-footed`, `tolled-for` | you carry that condition |
| `in-water`, `dry` | the water at your feet is ankle or deeper; there is none |
| `on-wound` | you stand inside one of your wounds |
| `laden` | you carry four or more finds |
| `scarred` | you have a scar this vigil |
| `faint` | your life is under 35% of greatest life |
| `at-post` | you are within 6 m of the bell-post |
| `in-light` | you are in the light of a lit lamp |
| `t-braced`, `t-striding` | the target's posture |
| `t-large`, `t-elite`, `t-keeper` | the target's size and rank |
| `t-near`, `t-far` | the target is within 3 m of you; farther than 8 m |
| `t-in-water` | the water at the target's feet is ankle or deeper |

The sim sets the player's conditions in `S.player.conds` and the hit code works out a target's mask from its posture, size, rank, distance, water and conditions. A player condition that would flicker (`braced`, `striding`, `crowded`, `in-water`) must hold for 0.25 s before the mask changes, so the sheet is rebuilt a few times a second at most, which is within the engine's budget.

### 15.8 Stats.STATS, the full list

Marks: `s` the stat is worked out per voice (skill), `%` a percentage where 100 is unchanged, `i` a whole number. Rows named by the code: `damage`, `speed`, `taken`, `cond-duration` (was `ailmentDuration`) and `guard.all` (was `res.all`). The families `res.<kind>`, `resMax.<kind>` and `pen.<kind>` are renamed `guard.<kind>`, `guard-max.<kind>` and `through.<kind>`; `res.elemental`, `gainAsExtra.<kind>`, `critChance` and `critMulti` go, with the crit step of the hit and the gain step of the skill sheet.

In the code's own shape, `[id, base, least, most, marks]`:

```js
const ROWS = [
  ['life-max', 60, 1, 1e7], ['wound-term', 60, 10, 300], ['wound-join', 2, 0, 5], ['wound-cap', 10, 3, 20, 'i'],
  ['mend-rate', 100, 10, 1000, '%'], ['mend-reach', 1, 0.5, 2.5], ['mend-on-lay', 0, 0, 100], ['scarring', 100, 0, 100, '%'],
  ['brace-time', 0.4, 0.1, 2], ['stride-share', 70, 40, 95], ['lee-reach', 3, 1, 6], ['turn-limit', 90, 45, 170],
  ['wrong-foot-taken', 50, 0, 200], [GUARD_ALL, 0, -100, 100], [TAKEN, 100, 0, 1000, '%'],
  ['move-speed', 4.5, 0.5, 15], ['shove-taken', 100, 0, 300, '%'], ['find-weight', 1.5, 0, 5], ['find-steady', 4, 0, 10],
  ['pickup-reach', 2.5, 0, 40], ['wake-lag', 1.2, 0.6, 2.5], ['wake-length', 5, 2, 12],
  ['heed-max', 100, 0, 400], ['warn', 0, 0, 1],
  ['trade-recharge', 100, 25, 400, '%'], ['heave-recharge', 4, 1, 20], ['heave-harm', 100, 0, 1000, '%'],
  ['pull-window', 0.3, 0.1, 0.6], ['set-time', 1, 0.3, 3], ['wedge-length', 3, 1, 8], ['bar-length', 7, 3, 14],
  ['lamp-burn', 45, 10, 120], ['chest-size', 30, 10, 90, 'i'], ['dig-rate', 1, 0.25, 4],
  ['procession-cap', 40, 0, 80, 'i'], ['procession-bonus', 30, 0, 100], ['sound-time', 2, 0.5, 5],
  ['xp-gain', 100, 0, 1000, '%'], ['coin-find', 100, 0, 1000, '%'], ['find-chance', 100, 0, 1000, '%'],
  ['hum-gain', 100, 0, 1000, '%'], ['notch-size', 100, 0, 500, '%'],
  [DAMAGE, 100, 0, 1e6, '%'], [SPEED, 100, 10, 1000, '%'], ['area', 100, 10, 1000, 's%'], ['reach', 100, 10, 1000, 's%'],
  ['duration', 100, 10, 1000, 's%'], ['throws', 0, 0, 50, 'si'], ['pierce', 0, 0, 99, 'si'], ['throw-speed', 100, 10, 1000, 's%'],
  ['shove', 0, 0, 30, 's'], ['wrong-foot', 50, 0, 300, 's'], [COND_DURATION, 100, 10, 1000, '%'],
];
// The families are made from the tables, as today:
//   guard.<kind>      base TYPES[k].guardBase, from 0 to (guardBase ? 100 : 0)     (was res.<kind>)
//   guard-max.<kind>  base TYPES[k].guardMax, from 0 to (guardMax ? 90 : 0)       (was resMax.<kind>)
//   through.<kind>    base 0, from 0 to (bare ? 0 : 100)                           (was pen.<kind>)
//   added.<kind>      base 0, from 0 to 1e7, range
//   chance.<row>      base 0, from 0 to 100, for every AILMENTS row with chance: true
//   flag.*, param.*   as today
// GUARD_ALL is 'guard.all' (was RES_ALL) and COND_DURATION is 'cond-duration' (was AIL_DURATION).
```

| Id | Base | Min | Max | Marks | What it is |
|---|---|---|---|---|---|
| `knee`, `heel`, `hand`, `ear` | 0 | 0 | 1e5 | i | the attributes (built from PRIMARIES) |
| `life-max` | 60 | 1 | 1e7 | | greatest life |
| `wound-term` | 60 | 10 | 300 | | seconds an open wound waits before it scars |
| `wound-join` | 2 | 0 | 5 | | metres within which new harm joins an open wound |
| `wound-cap` | 10 | 3 | 20 | i | open wounds at most |
| `mend-rate` | 100 | 10 | 1000 | % | how fast wounds give life back |
| `mend-reach` | 1 | 0.5 | 2.5 | | metres from a wound's centre you can mend it from |
| `mend-on-lay` | 0 | 0 | 100 | | percent of a wound mended when one of the dead is laid inside it |
| `scarring` | 100 | 0 | 100 | % | share of an unmended wound's life that scars |
| `brace-time` | 0.4 | 0.1 | 2 | | seconds still before Brace holds |
| `stride-share` | 70 | 40 | 95 | | percent of dry-ground top speed that is Striding |
| `lee-reach` | 3 | 1 | 6 | | metres from cover at which lee holds for you |
| `turn-limit` | 90 | 45 | 170 | | degrees of turn within 0.5 s that wrong-foot you |
| `wrong-foot-taken` | 50 | 0 | 200 | | percent more harm you take while Wrong-footed |
| `guard.all` | 0 | −100 | 100 | | added to every guard |
| `taken` | 100 | 0 | 1000 | % | harm you take, limited by kind tags (a Swell ignores it) |
| `move-speed` | 4.5 | 0.5 | 15 | | top speed on dry ground, metres a second |
| `shove-taken` | 100 | 0 | 300 | % | how far shoves and currents move you |
| `find-weight` | 1.5 | 0 | 5 | | percent of top speed each carried find takes |
| `find-steady` | 4 | 0 | 10 | | percent less each carried find lets you be moved (at most 60% in all) |
| `pickup-reach` | 2.5 | 0 | 40 | | metres |
| `wake-lag` | 1.2 | 0.6 | 2.5 | | seconds behind you the common dead steer |
| `wake-length` | 5 | 2 | 12 | | seconds of path that make your wake |
| `heed-max` | 100 | 0 | 400 | | greatest Heed |
| `warn` | 0 | 0 | 1 | | seconds sooner every Swell aimed at you shows, besides free Heed (all sources together at most 1 s) |
| `trade-recharge` | 100 | 25 | 400 | % | recharge of your trade |
| `heave-recharge` | 4 | 1 | 20 | | seconds |
| `heave-harm` | 100 | 0 | 1000 | % | harm of a heaved find's bursts |
| `pull-window` | 0.3 | 0.1 | 0.6 | | Change-ringer: seconds a reversal may take and still be a pull |
| `set-time` | 1 | 0.3 | 3 | | Change-ringer: seconds still that set the bell |
| `wedge-length` | 3 | 1 | 8 | | Verger: metres |
| `bar-length` | 7 | 3 | 14 | | Toll-gatherer: metres |
| `lamp-burn` | 45 | 10 | 120 | | Lamp-trimmer: seconds a lamp burns |
| `chest-size` | 30 | 10 | 90 | i | Organ-blower: units of wind |
| `dig-rate` | 1 | 0.25 | 4 | | Sexton: grave places dug a second |
| `procession-cap` | 40 | 0 | 80 | i | the In Procession a voice may count |
| `procession-bonus` | 30 | 0 | 100 | | percent more harm you deal to the In Procession |
| `sound-time` | 2 | 0.5 | 5 | | seconds in the band that Sound a large dead |
| `xp-gain` | 100 | 0 | 1000 | % | experience |
| `coin-find` | 100 | 0 | 1000 | % | coin the dead drop |
| `find-chance` | 100 | 0 | 1000 | % | finds the dead drop |
| `hum-gain` | 100 | 0 | 1000 | % | Hum |
| `notch-size` | 100 | 0 | 500 | % | size of the lines tolls write on your finds |
| `damage` | 100 | 0 | 1e6 | % | harm |
| `speed` | 100 | 10 | 1000 | % | how often voices speak |
| `area` | 100 | 10 | 1000 | s% | size of shapes |
| `reach` | 100 | 10 | 1000 | s% | how far voices reach |
| `duration` | 100 | 10 | 1000 | s% | how long what a voice leaves lasts |
| `throws` | 0 | 0 | 50 | si | extra thrown things |
| `pierce` | 0 | 0 | 99 | si | bodies a thrown thing passes through |
| `throw-speed` | 100 | 10 | 1000 | s% | speed of thrown things |
| `shove` | 0 | 0 | 30 | s | metres a voice shoves what it strikes (a shove ends Brace and In Procession) |
| `wrong-foot` | 50 | 0 | 300 | s | percent more harm a voice deals to the Wrong-footed |
| `cond-duration` | 100 | 10 | 1000 | % | how long conditions you lay last |
| `guard.blow`, `guard.drag`, `guard.swell` | 50, 60, 0 | 0 | 100, 100, 0 | | Brace's cut, Stride's cut, nothing |
| `guard-max.blow`, `guard-max.drag`, `guard-max.swell` | 80, 85, 0 | 0 | 90, 90, 0 | | their caps |
| `through.blow`, `through.drag`, `through.swell` | 0 | 0 | 100, 100, 0 | | share of a target's guard your harm ignores |
| `added.blow`, `added.drag`, `added.swell` | 0 | 0 | 1e7 | range | harm added to voices, times the voice's `eff` |
| `chance.coined`, `chance.sealed`, `chance.brined` | 0 | 0 | 100 | | percent chance on each hit to lay the condition |
| `flag.*` | 0 | 0 | 1 | prefix | switches named by rules |
| `param.*` | 0 | −1e9 | 1e9 | prefix | a voice's own parameters |

That is 65 stats a tree node, a line or a knot can change, beside the four attributes, the two prefix rows and the three fixed rows of the bare Swell. Builds lean on different ones: a standing build on Knee, `brace-time`, `guard.blow`, `mend-rate`, `wound-term` and `added.drag`; a striding build on Heel, `stride-share`, `guard.drag`, `move-speed`, `find-weight` and `wrong-foot`; a close build on Hand, `mend-reach`, `procession-bonus`, `shove` and `through.blow`; a timed build on Ear, `heed-max`, `warn` and the quarters; a cover build on `lee-reach` and `added.swell`; a train build on `wake-length`, `wake-lag` and `procession-cap`; a haul build on `find-steady`, `heave-harm`, `notch-size` and `coin-find`.

### 15.9 Other placeholder names in the code

- **InputFrame** (`52-input.js`, the table `FIELD`): `dodge` becomes `trade`, `draught` becomes `heave`.
- **Player fields:** `hush`, `hushWait`, `dodgeT`, `dodgeCd`, `invuln`, `draughts`, `draughtFill` and `evade` go. New fields, declared with `Sim.field`: `stillT`, `strideT`, five heading samples, `tradeCd`, `heaveCd`, and the class states (`setBell`, `wind`, `graveDug`, `graveFilled`, `debts`). Wounds and scars live in a system slot made with `Sim.state('wounds', ...)`.
- **Enemy fields:** `stillT`, `strideT` and five heading samples. **Enemy definitions:** `res`, `armour` and `threshold` give way to `guard: {blow, drag}`, `size: 'small' | 'large'` and `press` (the Drag per second it deals while touching, as a multiple of its `damage`).
- **Attack definitions:** `kind` takes the words `strike`, `throw`, `press`, `spread`, `fall` and `zone`; `shape` takes `arc`, `line`, `circle`, `ring` and `wedge`; `type` is the kind of harm; `windup` is a Blow's wind-up or a Swell's fill; `evadable` is always false; `summon` is used only for shedding (the Flogged Bell sheds four bearers at each wall).
- **Voice definitions** (the `sigil` kind): `crit` is 0, `weapon` null, `weaponPct` 0. The archetypes the first version needs: `ring`, `rap`, `bar`, `spark` and `cone` (section 15.14).
- **Observance definitions** (the `vow` kind): `candles` becomes `heed`, the Heed it holds; `aura` is null.
- **Favour definitions** (the `chime` kind): `rarity` takes `plain` (adds numbers) or `turned` (changes a rule). Offers of favours are walked into in the world, so `S.phase` never becomes `'offer'` for them.
- **Modes:** `household` and `watch-night` in place of `watch` and `gauntlet`. **Zone kinds:** `district`, `peal`, `bill` and `debug`.
- **Events:** `crit` goes. New: `wound` (a = life, b = depth), `mend` (a = life back), `scar` (a = life lost), `pull`, `heave` (a = notches), `count` (a = tellers, b = elites; id = 'gate' when a lychgate will open).

### 15.10 One hit on one of the dead

A voice with skill sheet `ss` strikes the dead body `e`. `m` is `e`'s condition mask (section 15.7).

1. **Shape.** `e` is struck only if it is inside the voice's shape. For a spreading Swell: and not in lee (section 3). For a falling Swell: inside the shape when it lands.
2. **Roll.** For each kind `T` with `ss.max[T] > 0`: `b[T] = ss.baseMin[T] + r × (ss.baseMax[T] − ss.baseMin[T])`, with `r` from `S.rng.combat`. If `e` is Sounded, `r = 1`.
3. **The attacker.** `h[T] = b[T] × Stats.hitMult(ss, T, m) × share`, where `share` is the voice's own part-hit share (1 unless its archetype says otherwise).
4. **The train.** If `e` is In Procession: `h[T] = h[T] × (1 + procession-bonus ÷ 100)`.
5. **Wrong-footed.** If `e` is Wrong-footed: `h[T] = h[T] × (1 + ss.wrong-foot ÷ 100)`.
6. **Guard** (Blow and Drag; a Swell skips to step 8). If the kind's posture holds for `e` (a Blow and `e` Braced, a Drag and `e` Striding): `g = min(e.guard[T], e.guardMax[T]) × (1 − ss.through[T] ÷ 100)` and `h[T] = h[T] × (1 − g ÷ 100)`.
7. **Taken and water** (not a Swell). `h[T] = h[T] × e.taken[T]` (its kind's and its conditions' harm-taken multipliers). For Drag, times the water band at its feet: 1, 1, 1.25 or 1.5.
8. **Life.** `H = Σ h[T]`; `e.life −= H`; emit `'hit'` (a = H, b = the mask of kinds).
9. **Shove.** If `ss.shove > 0`: `e` is moved `ss.shove` metres away from the voice's origin (keepers a quarter as far). A shove ends its Brace and its In Procession.
10. **Conditions.** Each row with `chance` is laid at `ss.ailChance[row]` percent. For a Blow, Swing compares the Blow's direction with `e`'s stored direction and adds or takes 1; at 6 (keepers 12) the body goes over. A seal breaks if `H ≥ V × e.lifeMax`.
11. **Death.** At no life `e` is laid in the deaths phase: the kill event, Mourning round it if it was an elite or keeper, its coins, embers and finds.

### 15.11 One hit on the player

An attack `A` of kind `T` from body `s` lands, or ticks. `d = s.damage × A.mult` (its damage already scaled by level and rank).

1. **Shape.** A Blow strikes if you are inside its shape at the end of its wind-up; a Swell if you are inside its shape when it lands, and, for a spreading Swell, not in lee within your `lee-reach`; Drag ticks while its cause touches you (section 15.12).
2. **Bare.** If `T` is a Swell: `h = d`, go to step 5.
3. **Guard.** If the kind's posture holds for you (a Blow and you Braced, a Drag and you Striding): `h = d × (1 − min(guard[T], guard-max[T]) ÷ 100)`; else `h = d`.
4. **Taken and water.** `h = h × sheet.taken[T]`. For Drag, times the water band at your feet: 1, 1, 1.25 or 1.5.
5. **Wrong-footed.** If you are Wrong-footed: `h = h × (1 + wrong-foot-taken ÷ 100)`.
6. **Tolled-for.** If you are Tolled-for, no life is lost: take 1 s from its time for a Blow or a Swell, 0.25 s for a Drag tick, and stop.
7. **Life.** `life −= h`.
8. **Wound.** `w` = the wind-up of a Blow, 0 for Drag, the fill time you saw for a Swell. If an open wound's centre lies within `wound-join` of you, it holds `h` more and its depth becomes `max(depth, w)`; otherwise a wound opens where you stand, holding `h`, with depth `w` (if `wound-cap` are open, the oldest scars first). Emit `'wound'`.
9. **Seal and swing.** A seal on you breaks if `h ≥ 8%` of greatest life. Swing on you counts as in section 7.
10. **No life.** If `life ≤ 0`: if you have not been Tolled-for this vigil, you are now (T = seconds to the next toll); otherwise the character dies.

### 15.12 Drag ticks

`Dmg.tick` runs every 15th step. In it:

- each of the dead whose edge is within 0.1 m of yours presses you: one Drag hit of `s.damage × s.press ÷ 4`;
- each rider on you deals its Drag ÷ 4; riders on a large dead do the same to it;
- each Drag zone you stand in (an attack of kind `zone`, or bad ground) deals its harm per second ÷ 4;
- each of your Drag voices' zones deals its harm per second ÷ 4 to every body inside, through the steps of section 15.10.

### 15.13 Per-place ground values

The simulation provides these, all as lookups:

| Value | Meaning |
|---|---|
| `H(x, y)` | ground height in metres, from the district's height grid (1 m cells, bilinear) |
| `L(t)` | the district's tide level at time `t` (below) |
| `D(x, y, t)` | depth: `max(0, L(t) − H(x, y))` |
| `band(D)` | dry under 0.05 m, ankle under 0.3, knee under 0.6, waist above |
| `C(x, y, t)` | current: the district's channel field (a direction and weight per cell, 0 off the channels) × the district's factor × `dL/dt`; 0 at slack |
| `F(x, y)` | fresh water: a flag per cell for fonts and rain pools |
| `silt(x, y, t)` | the Foreshore's bared silt: cells below the mean level that are dry now (30% slower) |
| roles | authored per district as props with a role: the bell-post, six landmarks, six lamp-posts, pits, sallies and their circles, stairs, hulks |

**The tide.** With the toll interval `P` (75 s), the mean `M` and the range `R` of the district: the vigil opens at `M + R/2` and ebbs to `M − R/2` by the first toll. After toll `n` the water floods if `n` is odd and ebbs if `n` is even, between `M − R/2` and `M + R/2`, except that the floods ending at tolls 4, 8, 12 and so on rise to `M + R` and the ebbs after them fall from there. Within each interval the water stands still for 3 s after the toll and 3 s before the next, and in the 69 s between it moves 1, 2, 3, 3, 2 and 1 twelfths of the change in six equal parts. `L(t)` is worked out once a step.

### 15.14 New behaviours

Sizes: S is a few lines over existing machinery; M is a new behaviour with its own state and queries; L would be a new system.

| Behaviour | Size | First version | Why it stays cheap with 600 bodies |
|---|---|---|---|
| Posture, the three kinds, guards, bare Swells and the lee test | M | yes | a speed and five heading samples per body, compared each step; the lee test is one segment test against props and large bodies within 3 m of each body a spreading Swell lands on, and spreading Swells are few |
| Wake steering and In Procession | M | yes | one ring buffer of your positions (10 a second for 12 s); the common dead all read one shared point; procession reads a 1 m grid of wake cells stamped with the time, each body its own cell and the eight round it, a sixth of the bodies each step |
| Wounds and mending | S | yes | player only; at most 20 records, one distance test each a step |
| Heed and warning | S | yes | one number added to the fill of Swells aimed at you |
| Heave and ballast | S | yes | player state; a heaved find is one pickup that bursts once per notch as an area |
| Ringing down, Tolled-for, the count | S | yes | a stroke timer, one lychgate placed at the far edge, and the director's plan for the next interval read aloud |
| Mourning, Sounded, Coiled, Clung, Coined, Swing, Sealed | S each | yes | mourning is one 8 m query when an elite or keeper dies; sounded and coiled look only at large dead; at most 5 riders; each coined body does one grid query a step; swing is a comparison per Blow and one capsule query when a body goes over; sealed skips timers |
| Change-ringer, Verger, Lamp-trimmer and Organ-blower rules, and the starting voices `ring`, `rap`, `spark`, `cone` | S each | yes | player state; the wedge is one 3 m cone query a step; lamps are six props and each lit lamp does one nearest query every 2 s |
| Toll-gatherer's post and bar (`bar`, `tolled`, `burgess`) | M | yes | one swept-segment test a step against the dead within 7 m of the post, found with one grid query |
| Sexton's graves | M | yes | at most 4 pits, each an area that lays what enters it (one grid query per pit a step); one player state |
| Walk-in favours and the row | M | yes | three offer pickups in the world instead of a pause; the row is data |
| The Plan | M | yes | allocation-time only; the toll rings rebuild the sheet once a toll; the banks are the conditions `in-water` and `dry` |
| Written finds | M | yes | four posture counters for the player; at each toll each carried find gets one line (at most 30 finds) |
| The Bellframe and the Register | M | yes | meta; landmarks are six flags a vigil; the Register is a lookup by attack id |
| Observances | S each | yes | one promise check a step on the player |
| The Dial's shadow and the Half-muffled Keeper's echoes | S | yes | an angle test per body; an echo is the same Swell queued again on the same ground |
| Water and the tide | M | from the Ropewalk | a height grid, one level a step, lookups per body; no fluid |
| Moored | M | later | at most 4 stakes; a clamp to a circle per moored body; jerks walk a stored list |
| Brined | S | later | stacks; the dry test is the water lookup |
| Callings Stander, Backward-ringer, Wand-bearer, Registrar, Alderman, Snuffer, Treader, Organist, Surety | S each | later | player state, the director's weights and existing conditions |
| Callings Beadle (files), Recorder (lamp recordings), Banksman (spoil banks) | M each | later | a file is a list of at most 40 bodies; a lamp stores six casts; a bank is a wall prop, at most 4 |
| The Ropewalk's lanes and alleys, the Sink's pits, the Hanging Quarter's ropes | S each | later | props with roles; a rope does one segment test a step against the bodies near it |
| The Foreshore's silt and refloating hulks | M | later | three box props regridded once a tide |
| The other four keepers | M each | later | scripted phases on the boss machinery; the Flogged Bell's lee phase reuses the lee test |
| The Watch-night's courting figures and route offers | M | later | counters within 8 m of six figures; the offers reuse the walk-in favours |
| The dead's behaviours, one per family | S to M each | the Dial's few | each reads only its neighbours and the shared wake point |

**The first version** is the Dial and its keeper, played by all six classes, with standing characters, the Plan, written finds, the Bellframe and walk-in favours. It needs eight medium behaviours: posture and the hit, wake steering, the Toll-gatherer's bar, the Sexton's graves, walk-in favours, the Plan, written finds, and the Bellframe. Everything else in it is small. The Dial is dry, so water waits for the Ropewalk.

## 16. The tests the model was held to

1. **Four sentences.** They are at the top of this file. Everything else is a number on them or a condition.
2. **Read without text.** A Blow is a rising shape, Drag is the crowd against you, a Swell is a filling shape with its lee cut out, posture is a ring, a streak or a flash, the train is a line, wounds are discs that grey, Heed and life are bars, the toll is a closing ring, and every condition is a shape or colour on a body.
3. **Forty stats.** Section 15.8 lists 65 that tree, finds and knots can change, and names seven builds that lean on different ones.
4. **No enemy examines all the others.** Lee looks within 3 m of each body a Swell lands on; procession reads a body's own wake cells; mourning is one query when an elite dies; a coined body looks at what it walks into; the toll-bar looks within 7 m of its post; the Registrar counts kills as they happen; the Backward-ringer's mark changes each body's target once. Nothing pairs every body with every other.
5. **Nothing is a renamed standard.** Each part was asked where it had been seen. Standing still to take less from hits, and moving to take less from lasting harm, each exist alone in other games; here they are the only protections there are, one per kind of harm, and the dead wear them too, so your movement decides how your own harm lands. Cover from a drawn blast is a habit of raid fights; here any large body is cover, the dead shelter each other, and the cover is part of a kind of harm that the player deals as well. Lost life that can be won back exists elsewhere (scattered rings picked up again, a rally won by striking back); here it is owed to the place where it was lost, in seconds set by its warning, and paid only by standing still on that place. Heed, a pool of warning time held by promises, was found in no game. The engine's critical strikes, dodge roll, recharging shield, healing drink, evasion, armour and elemental resistances are all gone.

## 17. Where the two spines disagreed

- **Kinds of harm:** the hands spine's three, by how harm arrives (its Knell renamed Swell), over the depth spine's four, by what harm does, because a thumb can see a wind-up, a crowd and a filling shape but cannot see a weight class or a muffling.
- **Protection:** posture (Brace, Stride, Lee) over body properties (Weight, Muffle, Freeboard, Anneal), because protection should follow what the thumb is already doing.
- **Weight matching** leaves the core; size survives as small and large (lee, Sounded, Coiled, riders), because two matching puzzles at once cannot be read in a fight.
- **Water** from the depth spine stays as a world rule: the tide turns at every toll, and knee and waist water slow everyone and hold them (Drag ×1.25 and ×1.5), because it moves where each posture works every 75 s without a fourth kind of harm.
- **Ring and Crack** leave; the cascades they promised come back as Swing, Coined and Moored, and the lasting loss as scars.
- **Healing:** the hands spine's gradual mending over the depth spine's all-at-once term, because a thumb forced to step off early keeps what it mended; scars after 60 s, not at a thirteenth wound, because a greying disc is a clock the eye can read; the depth spine's bound on open wounds kept, because records and decals must be bounded.
- **The pool:** Heed over the vigil candle, because an observance's price should be felt on every Swell, and the Plan's toll rings already ask how long a character means to stay.
- **Buttons:** a trade for every class (depth), because the second thumb should have something of its own in every class; the heave throws the find with the most notches and wipes them (the depth spine's thrown find, paid for as the hands spine's "buttons take away"), because the price should be the tolls the find was carried through.
- **Mooring** becomes the effect of certain voices, not a rule of every crossing, because a rule every class shares crowds out what makes each class different.
- **Tolled-for** is kept (hands), because one life is felt most in its last seconds.
- **Conditions:** Swing and Sealed from the depth spine, Mourning, Clung and Coined from the hands spine, Sounded and In Procession from both; Muffled, Cracked and Ringing leave with Ring and Crack.
- **Attributes:** Knee, Heel, Hand and Ear over Copper, Tin and Rope, because attributes should sharpen the postures the combat model is made of.

## Sources

thumbs-01 (posture harm, the kinds and guards), thumbs-55 (the dead walk the wake), thumbs-02 in its changed form (wounds owed to a place), water-93 (the tide), water-01 (water holds), thumbs-03 (In Procession), thumbs-04 (Sounded), thumbs-05 (Coiled), customs-03 (Mourning), thumbs-06 in its changed form (Clung), customs-05 (Coined), bells-04 (Swing), water-09 (Sealed), water-06 (Brined), thumbs-07 in its changed form (Moored), thumbs-89 (Tolled-for), bells-73 (ringing down), customs-96 (the count), thumbs-45 (Heed), water-98 and thumbs-24 in its changed form (ballast and heave), thumbs-09 and water-03 (attributes), customs-20, customs-15 and customs-24 in its changed form (filed, tolled, burgess).
