# Game Development Resources

This collection contains full Git clones, including repository history. The repositories are grouped by engine and purpose:

This GitHub repository indexes the source projects as submodules rather than copying their histories into one large repository. When cloning, pass `--recurse-submodules` to `git clone` to check out the linked projects.

## Engines and game projects

### Godot

- [Official Demos](./Engines/Godot/Demos/) — official 2D/3D examples and templates. MIT. The `master` branch follows Godot development; choose a matching stable-version branch when needed.
- [Third-Person Shooter Demo](./Engines/Godot/Third-Person%20Shooter%20Demo/) — official runnable TPS project. Code is MIT; included assets and music are CC-BY 3.0, and some materials derive from third-party content.

### Unity

- [2D Extras](./Engines/Unity/2D%20Extras/) — tilemap tiles, brushes, and examples. Unity Companion License; development moved to the Package Manager package.
- [Tilemap Extras Package](./Engines/Unity/Tilemap%20Extras%20Package/) — current package mirror for Unity 2D tilemap extras. Unity Companion License.
- [2D Tech Demos](./Engines/Unity/2D%20Tech%20Demos/) — runnable Unity scenes demonstrating tilemap, brushes, destructible tiles, and palette swaps. MIT; designed for Unity 2021.1 or later.

### Phaser

- [Examples](./Engines/Phaser/Examples/) — a large collection of browser-game examples. Example code is MIT, but the repository explicitly says the media assets are not licensed for commercial or ad-supported games.

### Unreal Engine

- [Animation Sample](./Engines/Unreal/Animation%20Sample/) — UE5 Game Animation Sample with overlay layering. The README specifies Epic's UE-only content license; use only in Unreal Engine-based products.
- [Style Guide](./Engines/Unreal/Style%20Guide/) — project organization and naming guidance. MIT.

### Bevy

- [Engine Source](./Engines/Bevy/Engine/) — Rust game engine, dual-licensed MIT or Apache-2.0.
- [Community Assets and Projects](./Engines/Bevy/Community%20Assets/) — community plugins, assets, apps, and learning resources; check the license of each linked item.

### libGDX

- [Framework](./Engines/libGDX/Framework/) — cross-platform Java game framework.
- [Super Jumper Demo](./Engines/libGDX/Super%20Jumper%20Demo/) — sample game project.

Check each repository's license and any separate notices for bundled media and third-party dependencies.

### raylib

- [Engine and Examples](./Engines/raylib/Engine%20and%20Examples/) — small C game-programming library with examples. zlib/libpng license.

### LÖVE

- [Framework](./Engines/L%C3%96VE/Framework/) — Lua 2D game framework.

### Defold

- [Public Examples](./Engines/Defold/Examples/) — self-contained example projects. The repository credits Kenney assets; check individual asset notices.

## Editors and tools

- [Tiled Map Editor](./Tools%20and%20Editors/Tiled/) — flexible tile-based level editor source.
- [LDtk](./Tools%20and%20Editors/LDtk/) — user-friendly 2D level editor; MIT.
- [LibreSprite](./Tools%20and%20Editors/LibreSprite/) — pixel-art and sprite-animation editor; GPL-2.0.

## Assets and reference collections

- [Game Icons](./Art%20and%20Assets/Game%20Icons/) — SVG icon collection; CC-BY, so provide attribution as required.
- [Awesome GameDev Resources](./Reference%20Collections/Awesome%20GameDev%20Resources/) — curated free-software and free-culture game-development links; CC-BY-SA.
- [GameDev Agent Skills](./Reference%20Collections/GameDev%20Agent%20Skills/) — cross-engine game-development workflows for coding agents; Apache-2.0.
- [Awesome LÖVE Resources](./Reference%20Collections/Awesome%20L%C3%96VE%20Resources/) — community list of LÖVE libraries, projects, and learning resources.

## More asset libraries

- [Kenney assets](https://kenney.nl/assets) — Kenney states its game assets are CC0, including commercial use.
- [Poly Haven](https://polyhaven.com/) — CC0 3D models, HDRIs, and textures.
- [OpenGameArt](https://opengameart.org/) — community art, audio, and other assets; licenses vary by item.

## License reminder

An open-source repository does not automatically make every asset inside it free for every use. Source code and media can have different terms. Keep required notices and attribution, check licenses for individual assets and dependencies, and confirm terms before shipping a game.
