# 8-Way Sprite Rig: where it goes next

The hourly upgrade works down this list on the hours it gives to the tool, one item (or a well-scoped part of one) per run, and ticks it off with a one-line note. The aim is a tool that feeds Cinderdeep 3D: whatever it makes, the game can use. Once every item is ticked, runs add new tool features that serve the game.

Rules for every step: `npm test` passes; no dead code, no `!important` stacks, no inline styles in the markup, no button that only changes its own label, and no text that claims more than the code does.

- [x] **A real 3D preview.** Replace the canvas "True 3D Mesh" view with a three.js scene (the same bundle as `Games/Cinderdeep3D/src/vendor/three.min.js`), the skeleton's bones as lit capsules and the subject's colours as materials, orbitable with the existing camera controls. *(The "3D Model" view: `05-models-3d.js` dresses each skeleton in tapered limbs, ellipsoids and rounded blocks, `04-preview-3d.js` lights and self-shadows them under a camera matching the rig's projection, turned by Camera and Pitch. Every subject stands at its real height beside a 1.8 m person, on a 3D pedestal that takes its shadows; held props are modelled too.)*
- [ ] **Solid models from the atlas.** Build voxel models from any baked cell exactly as Cinderdeep 3D builds its solids (`v3SolidGeo` in `59-renderer-3d.js`: silhouette extruded, stepped depth, pixel colours), preview them, and export them as JSON the game can load.
- [ ] **The game's own sprites on the bench.** Load Cinderdeep 3D's heroes, beasts and monsters (their painters and frames) as subjects, so their solid models can be checked and tuned here before the game's "Monsters become solid" and "Heroes and beasts become solid" steps.
- [ ] **Saved looks reach the game.** Cinderdeep 3D's hero select reads the look kept by "Save look" (`cinderdeep.custom3dHero`) when both run from the same place, and offers it as a hero look.
- [ ] **Rigs for the game's monsters.** Skeletons and clips for Cinderdeep's monster families, so their 3D models animate from bones rather than from per-frame pictures.
