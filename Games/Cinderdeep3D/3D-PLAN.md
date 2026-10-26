# Cinderdeep 3D: the road to entirely 3D

The hourly upgrade works down this list, one item (or a well-scoped part of one) per run, and ticks it off with a one-line note. While anything is unticked, runs only convert; once everything is ticked, they turn to new upgrades and creations for the 3D game.

Rules for every step: the simulation, saves and gameplay stay the same; `npm test` passes, including the soak test's frame budget; nothing is drawn in 2D twice.

## The play view

- [x] **Realm still objects become solid.** Trees, rocks, bushes, buildings, towers, wells, lamps, graves, statues, stalls, fences, menhirs and marks are built once from their pixel art into voxel models: the silhouette extruded, rounder toward the middle in stepped layers, each pixel's colour kept, lit by the scene's lights with hot colours still glowing at night. Models are shared by every object with the same picture. *(Version 9.3: `v3Solid` in 59-renderer-3d.js.)*
- [ ] **Dungeon props become solid.** Pots, crates, barrels, chests, altars, braziers and shrines get voxel models; animated parts (flames, glows) stay as light and effects around the model.
- [ ] **Loot and pickups become solid.** Weapons, relics, potions, gold, souls and keys on the floor as small spinning voxel models.
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
