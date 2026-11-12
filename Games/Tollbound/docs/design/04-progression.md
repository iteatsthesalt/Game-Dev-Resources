# Tollbound: progression

This file holds the rules of growth: character levels and the Plan, voices and knots, finds and how they are changed, observances and Heed, favours and the row, the Bellframe and Hum, and the two ways to play. Content lists (the Plan's nodes, the voices, knots, bases, favours, observances, gifts, Bills and bequests) come later from other authors, who take their ideas from the pool in the forms its notes allow.

## Levels and points

- Character levels run from 1 to 70. Experience is kept the moment it is earned. Each level from the second gives one point for the Plan, and bequests give about 15 more: about 85 in all.
- Inside a vigil, experience also raises the run level, and each run level brings a favour (see "Favours and the row"). Run levels and favours end with the vigil.
- Each character level gives 2 points to the class's first attribute and 1 to its second (`03-classes.md`).

## The Plan: the shared tree

### Its shape

The Plan is the street plan of Tollbound. At its centre is the cathedral close. Round it run eight ring roads, the old walls, numbered 1 to 8 outward, and twelve straight streets run out from the close across all eight. Lanes and alleys fill the blocks between. The river crosses the plan from west to east: the nodes within two steps of the water on its south side are the **Flood bank**, those on its north side the **Ebb bank**, and four bridges cross between them. There are about 640 nodes. The six class doors stand on ring 1, two streets apart.

### Its nodes

| Kind | What it gives |
|---|---|
| door | a class's start; nothing |
| lane | one attribute point of your choice, or a small stat |
| corner | a stat limited by a tag or a condition, such as more harm from voices tagged `turn` |
| square | a rule, with a price in another rule, such as "you and the dead stay Wrong-footed twice as long" |
| milestone | a stat that grows with the straight street it stands in |

The engine's node kinds `start`, `path`, `minor`, `major` and `capstone` become door, lane, corner, square and milestone.

### Its rules

1. **One route.** A character's points lay one unbranching walk from its class's door. A point may only extend the walk's head to a node next to it. Points come back only from the head, newest first, for coin.
2. **Doubling.** The route may step onto a node it already holds. That costs a point and doubles the node, once per node.
3. **Beaten bounds.** Stepping back onto the route closes a loop. Every node inside the loop is granted at half strength without a point, if there are 12 or fewer; a loop holding more grants nothing. A node inside two loops is granted once.
4. **Toll rings.** A node on ring N works from the (N − 1)th toll of each vigil: ring 1 from the start, ring 8 from the seventh toll. Nodes are stronger the farther out they lie: their values are times (1 + 0.15 × (N − 1)).
5. **The banks.** Flood-bank nodes work only while you stand in water, ankle-deep or more; Ebb-bank nodes only while you stand on dry ground; both at 160% of their printed value. Bridges and all other streets always work.
6. **Straight miles.** A milestone gains 25% for each held node beyond the fourth in the unbroken run of held nodes through it along its straight street, counting at most 10.

Planning the Plan is drawing a walk, as play is: where to cross yourself to fence a rich block, which straight to hold for its milestone, how far out to go, which is how long the character means to stay in a vigil, and which bank to live on, which is where it means to stand when the tide turns. In the engine the toll rings rebuild the sheet at each toll, and a bank node's modifiers carry the condition `in-water` or `dry`.

## Voices and knots

- **Voices** are found blank at a tier from 1 to 5: elites and keepers drop them, and bequests give named ones. A character's loadout has six places, opening at levels 1, 3, 8, 15, 25 and 35. The order of the places matters to some rules (the Change-ringer's pull fires the first).
- A voice has a level from 1 to 20. It gains a level for every 8 tolls it speaks through, equipped, in vigils its character survives.
- A voice's **rope** holds two knots at level 1 and one more at levels 7, 13 and 19, five at most.
- **Knots** are found. A knot fits a voice only if the voice has every tag the knot requires and none that it excludes. Tying and untying are free at the Lantern; a knot is tied into one voice at a time.
- Knots change rules, not only numbers. Among the clean ideas of the pool: Running Line (60% faster while your heading has held within 15° for a second, silent for 0.7 s after a sharper turn), Stone's Answer (repeated 0.3 s later from the nearest obstacle within 6 m, at 60%), Second Voice (standing still lends it another voice's shape), Open Lead (every fourth cast is left out, and in that beat you take 40% less), Passes Free (it skips the first body it would strike and hits the next 60% harder), Reflected (a second, mirrored cast while you stand in still water), Resist (a triple first bite on each body, then nothing on it until the toll), Quartered (casts saved and let go together at each quarter of the toll).
- The engine's rule stays: `more` modifiers appear only on knots, squares, callings and named finds; favours and the Bellframe use only `flat`, `inc` and parameter changes.

## Finds

### Slots

Eight: tool, hat, coat, hands, girdle, pattens, and two tokens. Only tools have a family (`rope`, `verge`, `pike`, `pole`, `bellows`, `spade`).

### A find

A find is a base and its lines. The base gives its slot, its family if it is a tool, its level (the band of the district where it dropped) and one fixed line. A find is found blank, with only its fixed line, and can carry up to eight written lines. Each written line is a notch cut in it.

### How lines are written

- Each toll survived while a find is carried unbanked writes one line on it, if it has room.
- The line comes from what you did most in the toll period just ended: **stood** (Braced), **strode** (Striding), **pressed** (`crowded`: three or more of the dead within 3 m), or, if the toll found you within 4 m of a landmark, **timed**.
- A line is a clause of three words: a verb (a stat and an amount), an object (the tags it is limited to) and a condition (the posture that wrote it: while Braced, while Striding, while crowded, or for 8 s after each quarter). It works only while its condition holds.
- Its verb and object are drawn at random from that posture's table, weighted by the base. Its amount rolls in a band set by the toll at which it was written (the first toll lowest, the eighth and later highest) and by the find's level, times your `notch-size`.
- One line in ten is cut backward: its condition is turned round (while not Braced, while not Striding, and so on). It still works, in the other posture.
- A find wants 4 × its written lines of the attribute of the posture that wrote most of them; below that, every line works at your share (`02-combat.md`, section 14).

### Keeping and losing

- Banked at a lychgate, a find belongs to the Household and its lines are fixed.
- Carried at death, it is lost with the rest of the haul.
- The worn finds of a character who dies go to the Household's chest.
- There are no tiers. A find is worth its notches, the tolls at which they were written, and how well their conditions fit a build.

### Changing a find

All of these are done at the Lantern, for coin that rises with the find's level and notches.

1. **Chisel.** Strike one word from a line. Strike its condition and the line works always, at 60%; strike its object and it works for everything, at 60%. One word per line, and it is never put back.
2. **Re-walk.** Strike a line out and wear the find into a vigil. The first toll survived writes a new line in that place by the rule above, and leaving by a lychgate keeps it. If the character dies in that vigil, the struck place and both its neighbours are erased for good.
3. **Recast.** Pour two finds of the same slot into one, in an order you choose: the first poured gives lines 1 to 4 and its fixed line, the last poured gives lines 5 to 8, and a place either left blank stays blank. The new find takes the higher level. Until it is first worn, each toll the Household hears, in any character's vigil, raises its lowest line one step within its band, four steps at most.
4. **Cut.** Cut one line away for good; every other line on the find rises 10%.

In the engine, the shapes `Item`, `Affix`, `Currency` and `Unique` give way to a find `{uid, base, level, fixed, lines: [{stat, op, value, tags, cond, posture, toll, backward, struck}]}` and a base `{id, name, slot, family, level, fixed, tables, icon}`. A named find is a base with a strong authored fixed line.

## Observances and Heed

- Every character has `heed-max` Heed (100). An observance holds a share of it, from 20 to 40, for as long as the character keeps it, in vigils and between them.
- Free Heed shows every Swell aimed at you sooner, 0.01 s a point, never more than 1 s with every other source.
- An observance is a promise the thumb keeps or breaks in a vigil. While the promise is kept its effect holds; when it breaks, the effect stops until the next toll, and the Heed stays held.
- A character learns observances from bequests and from the bells it rings. It keeps as many as its Heed allows.
- In the engine the `vow` kind's `candles` field is the Heed held, and `aura` is null.

Among the ideas of the pool, in the forms its notes allow:

- **Stability** (holds 30): stay within 12 m of where you stood at the last toll, a ring drawn on the ground; while kept, +25% harm.
- **The Unbroken Round** (35): touch the bell-post at least once between every two tolls; each period kept adds 5% harm and 2% speed, to eight periods; a missed period empties it.
- **Alms** (25): leave the first find of each toll period lying where it fell; each one left stands as a small cairn and pays 5% more experience while it lies unclaimed; taking one back breaks the observance.
- **Telling the Bees** (30): a hive on your back fetches every pickup within 10 m; within 10 s of an elite or keeper falling anywhere in the district you must stand still for 1 s, which also sends the bees to drive the five nearest dead back 3 m; a death left untold sends the bees away until the next toll, with what they carried.
- **Full Mourning** (40): beyond 7 m the dead cannot make you out and walk to where they last saw you; you may pick up nothing bright, only embers; at every third toll it lightens a grade, to grey (seen at 10 m, coin allowed) and then lavender (seen at 14 m).
- **Hand on the Bell** (40): no Drag can reach you and nothing can shove you, but any single Blow worth more than 20% of your greatest life also scars half the excess at once.

## Favours and the row

- Six favours stand in a visible row, places 1 to 6, in a corner of the screen.
- At each run level the favours in places 1 to 3 rise as three shapes 4 m from you, 120° apart. Walk into one within 8 s to take it. If none is taken they sink, the level waits, and the next level's offer adds the favour in place 4.
- When a favour is taken the row closes up and a new favour enters at place 6. Then, after every level, neighbours swap in fixed pairs, alternately (1–2, 3–4, 5–6) and (2–3, 4–5), so the player can see which favour will walk to the front in two levels and choose whether to wait for it.
- **Plain** favours add numbers, `flat` and `inc` only, held together to about 30% of a vigil's harm (the engine's rule). **Turned** favours change a rule: Countermarch, for one, lets you pass through the common dead for 0.6 s after a reversal of 150° or more, turning each one you pass to face the wrong way for 1 s.
- Favours last the vigil. Many are bargains with the clock or the purse: Tithe, Pall on Hire, Short Tally, Funeral Biscuit, Nail in the Candle, Ring Your Own Passing Bell, Coins on Your Own Eyes, Make Your Will, Pass the Gate, Standing Offer, Rest Beat, Muffle the Toll, Turn of the Tide, Tide-marked, Quarter-turn, Trade Clappers.

## The Bellframe and Hum

### Hum

- The Nth toll of a vigil pays N Hum times the number of different landmarks the character has stood beside (within 4 m) at a toll this vigil. Each district has six landmarks, the bell-post among them. Hum is credited the moment the toll rings, so nothing heard is ever lost.
- A keeper laid pays 50 Hum times the district's place (1 to 5).
- A death by a cause not yet in the Register pays 40 Hum times the toll at which it came.
- A Surety's debts become Hum at a lychgate.
- All Hum is multiplied by `hum-gain`.

### The frame

- The Bellframe is a tree of pits branching from the tenor pit. Hum opens a pit next to an open one: the first costs 100, and each after it 50% more than the last. Each pit has a printed grant (`flat` or `inc` only) and room for one bell.
- A character who dies, or is retired, is recast as a bell, weighing the tolls it heard in its whole life. The player hangs it in an open, empty pit. Its **gift** is fixed by its class and its calling: eighteen gifts, one for each class without a calling and one for each calling. A bell's gift may be recast, for Hum, to another gift of its class.
- A new character rings bells when it is made: as many as the ringing places the Household has bought, one at first and up to eight, bought with Hum as pits are. Their gifts apply to that character for its whole life.
- **A true ring.** The bells a character rings are put in order of weight, and each neighbouring pair whose weights differ by 10% to 30% rings true, adding 5% to the gift of every bell rung. A true ring needs light bells as much as heavy ones, so a character who died young fills a place a veteran cannot.

### The Register

Each attack that killed one of the player's characters is shown 0.15 s earlier to every later character, for up to three deaths to that attack.

### Bills and bequests

- **Bills.** The keeper of a voiced district drops Bills: that district with one to four causes written on it, each raising the danger and the Hum. Causes are named as the old Bills named deaths: Drowned (all water stands a band deeper), Overlaid (the dead rise in pairs), Frighted (Swells fill 20% faster), Found in the Street (no lychgate opens at the third toll). Bills are the Household's endgame.
- **Bequests.** The last wishes of the city's dead, met in districts as named dead or written on Bills. A bequest done opens a class, a Bill, a base, an observance or Plan points.

## The two ways to play

### The Household

- Standing characters, kept between vigils until they die. Each has one life.
- A vigil is one district at its level band. After all five keepers are laid, the districts join into the open city.
- **Mourning.** When a standing character dies, every other standing character mourns it for one vigil for every 10 levels it had, at least one. The first half of the term is full mourning: 50% more Hum, and no coin may be picked up. The second half is half mourning: 25% more Hum, coin allowed. A second death during the term lengthens it and does not add to it.
- The Household's chest holds banked finds and the worn finds of the dead.
- In the engine this is the mode `household`.

### The Watch-night

- One sitting, from nothing, through five districts. It is held for one of the player's dead standing characters, chosen at the start, or, before there is one, for an unknown ringer.
- The character starts at level 1 with no class, no trade, and one voice, the **Hand-bell** (a Blow ring 2 m round you every 1.5 s).
- Each district is one **watch**: a vigil at the level band of its place in the night (the first at 1 to 9, and so on), which ends when its keeper is laid and goes straight down to the next. Leaving by a lychgate ends the night with what was banked; dying ends it.
- Levels come fast. Each character level extends the route on the Plan: the head's neighbouring nodes rise as up to three shapes to walk into, in their own colour, as favours do. Run levels still bring favours.
- **The class is courted.** In the first district six guild figures stand where their act is easiest: the Verger's at the end of a long straight, the Toll-gatherer's beside a post, the Lamp-trimmer's under a lamp, the Change-ringer's in a tight square, the Organ-blower's at a long run's end, the Sexton's on soft ground. Each counts only what you do within 8 m of it. At the second toll the figure that saw most steps forward, and standing beside it for 2 s takes its class; walking to another figure takes that one's instead. The calling is courted the same way in the second district.
- **The order of the night.** Each Watch-night's order of districts is the last one's with exactly one neighbouring pair swapped, chosen by the player before the start. An order never rung before pays 25% more Hum.
- Keeping all five watches writes the dead character's name on the bede-roll, and its bell rings double in the Bellframe from then on. A broken watch may be held again.
- A Watch-night character is not kept. It leaves its Hum, and its dead one's name if it kept the night.
- In the engine this is the mode `watch-night`.

## Where the two spines disagreed

- **The Plan:** both spines' one route, doubling, beaten bounds and straight miles, and both specials: toll rings (hands) and banks (depth), because one asks how long a character means to stay and the other where the tide will let it stand, and a hundred-hour builder wants both questions.
- **Finds:** written by posture at each toll (hands), as three-word clauses that can only be shortened (the depth spine's chisel), because the thumb should write the gear and the builder should edit it. The depth spine's lathe goes, because it spent Weight, which is no longer a protection; its recast by pour order stays, with its cooling moved onto the line bands.
- **The pool:** Heed over the vigil candle (`02-combat.md`).
- **Favours:** walked into (both), standing in the visible row (depth), because seeing what comes is the builder's half and walking into it is the thumb's.
- **The Bellframe:** both spines' bells of the dead and their true ring; pits opened by Hum (depth) give it the shape of a tree, ringing places (hands) set how many bells one character rings; the Register (hands) over naming the killer's kind (depth), because warning time is this combat's currency. A bell gives a gift, not a boon, because boon is another game's word for its upgrades.
- **Hum by landmarks at each toll** (both).
- **The Watch-night:** held for a dead character (depth), with the class courted by watching figures (the hands spine's idea, in a changed form its notes allow), because the short mode then completes the long mode's deaths and still builds a character from nothing.
- **Added from the pool:** the order of the night (bells-76), so that no two Watch-nights are the same, and the Household's mourning (customs-90), so that a death changes how the house plays for a while.
- **The calling** comes at the second keeper, because the first keeper falls near level 9, too soon to choose a life's office.

## Sources

thumbs-71, thumbs-72, thumbs-73, thumbs-74, water-79 in its changed form (the Plan); thumbs-75, thumbs-76, thumbs-77 in its changed form, bells-64, bells-65 in its changed form (finds); thumbs-45, thumbs-47, thumbs-46 in its changed form, customs-47, customs-46, bells-39 (observances); bells-74, thumbs-86, thumbs-54 (favours); thumbs-85 in its changed form, bells-70, thumbs-84, thumbs-83 (the Bellframe); customs-90, customs-95, thumbs-91 in its changed form, bells-76 (the two ways to play).
