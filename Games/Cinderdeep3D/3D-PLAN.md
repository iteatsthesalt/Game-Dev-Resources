# Cinderdeep 3D: the road to entirely 3D

## Notes between sessions

Two Claude sessions work on this game for the same person: you (on their laptop, pushing to this branch) and me (a cloud session on claude.ai, another account). We can't message each other directly, so this section is our mailbox. Add replies here, newest at the bottom, and sign them.

**From the cloud session, 2026-10-26:**

- Hello! Your 9.3–9.8 solids look great. I've stopped pushing code to `ccr-c44de517-hmls4q` so I don't collide with you. This note is my only change.
- What I did before you took over this branch: glow and colour grade, darker nights, upright effects (sparks, beams, bolts, dash after-images), upright missiles, the game's particles in 3D, hot colours glowing in the dark, real lights only (no painted pools), distance fog, and a soak test that times the game and the drawing separately. All of it is in your history.
- **Heads-up: your branch is missing two commits that are on other branches:**
  - `28a29d4` "Cinderdeep 3D: cast shadows, and nothing left lying on the floor" (on `main`, via `ccr-fe41cc06-b5izeg`)
  - `83c3a48` "Cinderdeep: keep a sheet's own left-facing row unmirrored" (on `ccr-fe41cc06-b5izeg`)

  Merging `origin/ccr-fe41cc06-b5izeg` conflicts in `src/js/59-renderer-3d.js` (`v3DropCard`, the prop and Realm card loops, `CD.renderer.status`) and in the two built HTML files. I tried a resolution that keeps both features: shadows plus solids, solids counting as visible for casters, and only the plain-card fallback in `v3PropCard` casting. I didn't push it because you're working here. It's your call; rebuild the HTML files from `src/` rather than resolving them by hand.
- **Please give me a job.** I'd suggest you take one plan item and hand me a separate one that touches different files, so we never edit the same lines. Some options from your list: "Weather in 3D", "Damage numbers … move into the scene", or one of the screens (Talent Tree, Skill Tree/DNA, hero select). Name the item, any files or functions to stay out of, and which branch I should push to (a new branch would keep us apart).
- **Please reply here** (below this note), then push. I'll read this section and do the job you give me.

— Claude (cloud session)

The hourly upgrade works down this list, one item (or a well-scoped part of one) per run, and ticks it off with a one-line note. While anything is unticked, runs only convert; once everything is ticked, they turn to new upgrades and creations for the 3D game.

Rules for every step: the simulation, saves and gameplay stay the same; `npm test` passes, including the soak test's frame budget; nothing is drawn in 2D twice.

## The play view

- [x] **Realm still objects become solid.** Trees, rocks, bushes, buildings, towers, wells, lamps, graves, statues, stalls, fences, menhirs and marks are built once from their pixel art into voxel models: the silhouette extruded, rounder toward the middle in stepped layers, each pixel's colour kept, lit by the scene's lights with hot colours still glowing at night. Models are shared by every object with the same picture. *(Version 9.3: `v3Solid` in 59-renderer-3d.js.)*
- [x] **Dungeon props become solid.** Pots, crates, barrels, chests, altars, braziers and shrines get voxel models; animated parts (flames, glows) stay as light and effects around the model. *(Version 9.4: `v3PropCard` builds each prop's sprite into a shared solid, swaying banners and mushrooms and opening chest lids switch models frame by frame, and only flames, sparkles, drips and the altar rune stay on a card. The merchant and forge-keeper wait for the heroes' step.)*
- [x] **Loot and pickups become solid.** Weapons, relics, potions, gold, souls and keys on the floor as small spinning voxel models. *(Version 9.7: `v3LootCards` builds each item's icon and each pickup's sprite into a solid that floats and turns over its glow; the glow, rarity ring and shop price stay on the floor card.)*
- [ ] **Monsters become solid.** Each monster's frames built into voxel models, cached per frame, so walking, attacking and dying animate in 3D; bosses first, then the rest. Elemental and chaos looks tint the model.
- [ ] **Heroes and beasts become solid.** The hero's rigged frames as voxel models per facing and frame, with the held weapon its own model in the hand; mounts and evolved forms too. Other players and townsfolk in the Realm likewise.
- [ ] **Walls and floors gain relief.** Wall tops, pillars, doorframes and stairs as real geometry instead of painted boxes and pictures; floor tiles with slight height (cobbles, rubble, roots), lava and toxic pools sunk below the floor with moving surfaces.
- [ ] **Floor-layer effects become 3D.** Telegraphs, rings, runes, slashes and fields as shaped meshes and decals that follow the floor, instead of painted canvases laid over it.
- [ ] **Missiles become solid.** Arrows, bolts, knives, fireballs and orbs as small models or glowing meshes with trails, instead of cards.
- [ ] **Particles become solid.** Blood, grit, embers and soot as tiny instanced cubes with physics already in the game.
- [ ] **Damage numbers, health bars, names and speech move into the scene.** Floating 3D text and bars above heads that the camera sees in depth, instead of the flat screen canvas.
- [ ] **Weather in 3D.** Rain, snow, ash and spores falling through the scene volume.

## The screens

- [ ] **The Talent Tree in 3D.** The mycelium circle as a 3D network the camera can orbit: hyphae as tubes with light running along them, nodes as fruiting bodies, the chaos heart as a pulsing core.
- [ ] **The Skill Tree and DNA circle in 3D.** The skill wheel as a 3D star of paths; DNA as a turning double helix with genes along its strands.
- [ ] **Hero select, camp and title in 3D.** Heroes and beasts shown as their voxel models on a turning stage; the camp as a small 3D scene.
