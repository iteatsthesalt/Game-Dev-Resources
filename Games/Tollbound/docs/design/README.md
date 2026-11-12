# Tollbound: design

This folder is the game's design, written for the people who build it.

| File | What it holds |
|---|---|
| `01-world.md` | the game's words, the pitch and tone, how things are named, the five districts and their keepers, the fiction of the hub, the Bellframe, Hum, one life, lychgates and tolls, and the direction for art and sound |
| `02-combat.md` | the combat model in full (kinds of harm, protection, conditions, healing, the two buttons, the player and the dead, the screen), the attributes, and the engine changes: the replacement rows for every table of `src/js/10-stats.js`, the steps of a hit, the per-place ground values, and every new behaviour with its cost |
| `03-classes.md` | the six classes and the twelve callings |
| `04-progression.md` | the Plan, voices and knots, finds and how they are changed, observances and Heed, favours and the row, the Bellframe and Hum, the Household and the Watch-night |
| `denylist.txt` | names and terms that must never appear in the game's ids or text; `tools/lint.js` enforces it over `src/` as whole words in any letter case |
| `denylist-pending.txt` | entries that today's source still breaks only because of the placeholder rows of `src/js/10-stats.js`; the engineers move them into `denylist.txt` when they replace those rows |
| `pool/` | every idea proposed, how each fared, and the two spines this design merges |
| `tools/` | the scripts that checked the pool and gathered its survivors |

**How the ideas were made.** The owner asked for all new ideas and nothing from memory. Four inventors worked from real-world raw material, each from one source: how bells and change ringing work; tide, flood and wax; death customs and the trades of a river city; and what a player's thumb does in a crowd (`pool/ideas-*.json`). Skeptics then read every idea through two lenses, games and stories, and tried to name an existing work with essentially the same idea (`pool/verdicts-*.json`). An idea no skeptic recognised is clean. An idea a skeptic recognised in part may be used only in the changed form the skeptic gave, or in another form at least as far from the original. An idea recognised as the signature of an existing work was rejected. `pool/survivors.json` holds the 356 survivors with their notes and `pool/rejected.json` the 8 rejected. Two leads then composed a spine each from the survivors, one for depth for the builder (`pool/spine-depth.md`) and one for the game in the hand (`pool/spine-hands.md`). The four documents here merge them, choose wherever the two disagreed, and say why at the end of each file. Every class, calling, district and keeper name was checked against existing games by web search, and each one that collided was replaced.
