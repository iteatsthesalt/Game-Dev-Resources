# Tactilume

Touch the dark and play with up to two million specks of light. Each extra finger changes how
the light behaves. Tactilume is a multi-touch light toy in one HTML file, plus an Android app that
wraps it.

Open `Tactilume.html` in a browser to play. Nothing else is needed, and it works offline.

## What it does

- **Twelve behaviours.** Well, Whirl, Burst, Halo, Current, Weave, Chime, Storm, Lattice, Nova,
  Murmur and Fountain. The number of fingers picks one; any can be locked to play with any number
  of fingers. Changing behaviour crossfades rather than snapping.
- **Light that lives in 3D.** Particles move in depth while the camera drifts gently. Soft focus
  blurs near and far light like a lens.
- **HDR light.** Light trails and bloom. Eye adaptation keeps sparse and dense scenes readable, and
  AgX tone mapping lets hot light roll off to white instead of clipping.
- **Ways to play with fewer fingers.** Symmetry and mirror copies, one-finger chords (one touch acts
  as up to ten), pinned touches, full keyboard play, and autoplay that starts when nobody is touching.
- **Sound.** An optional generated instrument played by your touches. The light can also move with
  the microphone or a song you pick. Sound and the microphone stay off until you turn them on.
- **Tilt.** Optional. Tilting the device tips the light.
- **Scenes.** Fourteen built-in scenes, "Surprise me", saved scenes and share links. A share link
  carries the whole scene in its address.
- **Capture.** Photos (PNG) and video clips with sound (MP4 or WebM, whichever the device can make).
- **Comfort and access.** A flash guard (on by default) limits how fast the whole screen may
  brighten. Calm mode makes everything slower, softer and dimmer, and the system's reduced-motion
  setting is respected. Every control can be reached by keyboard and screen reader.
- **Adapts to the device.** The particle count and resolution adjust as it plays to keep the motion
  smooth. A WebGL context loss is survived.

### Keys

| Key | Does |
| --- | --- |
| Space | Put a touch down at the mouse or the centre, or lift it |
| Arrow keys | Move that touch |
| 1 to 9, 0 | Hold to play that many fingers (0 is ten) |
| S / M | Symmetry +1 / mirror on or off |
| [ / ] | Previous / next scene |
| N | Surprise me |
| A | Autoplay on or off |
| P / R | Photo / start or stop recording |
| H | Hide or show the controls |
| F | Fullscreen |
| Esc | Open or close the controls |

## Working on it

`Tactilume.html` is built from `src/`. Edit `src/`, then rebuild. Never edit the built file by hand:
the check fails if it does not match `src/`.

```
npm install          # once: esbuild and Playwright
npm run build        # src/ -> Tactilume.html
npm test             # build check, unit tests, then play it headless in Chromium
npm run unit         # only the unit tests (node --test)
node tests/run.js touch share   # only the browser scenarios whose names contain these words
```

The same checks run on GitHub for every change under `Games/Tactilume/`, and CI also builds the
Android app and keeps the APK as a download.

## Layout

- `src/page/`: the page around the app (`index.html`) and all its CSS (`style.css`).
- `src/js/main.js`: boots the app and runs the frame loop. The only file that knows every module.
- `src/js/CONTRACTS.md`: what each module promises the others. Read it before changing an interface.
- `src/js/core/`: pure logic with no DOM, unit-tested: the scene schema (which drives the controls,
  share links and the cleaning of anything from outside), behaviours, palettes, presets, the store,
  pole symmetry, and the quality governor.
- `src/js/gfx/`: the light engine. The simulation is a WebGL2 transform-feedback vertex shader
  (`shaders/sim.vert.glsl`); the points, bloom, eye adaptation, flash guard and tone mapping are in
  `shaders/`.
- `src/js/input/`: touch, pen and mouse; keyboard; autoplay; tilt.
- `src/js/audio/`: the generated instrument, the analyser for the microphone or a song, and the reverb.
- `src/js/capture/` and `src/js/platform/`: photos and video, and the difference between a browser
  tab and the Android app.
- `src/js/ui/`: the controls, built from the scene schema.
- `tests/unit/`: unit tests for `core/`. `tests/scenarios.js`: browser scenarios run by `tests/run.js`.
- `android/`: the Android app (see below).
- `tools/build.js`: the build. `tools/setup-android-sdk.sh`: installs the Android SDK.

### Adding things

- **A scene setting:** add a field to `SCHEMA` in `core/scene.js` with a new, never-used `code`. The
  control appears in the panel by itself and share links carry it. Then use it in the engine.
- **A behaviour:** append it to `BEHAVIOURS` in `core/behaviours.js` with the next id (never renumber),
  then add its force function to `shaders/sim.vert.glsl` under the same id.
- **A palette:** append it to `PALETTES` in `core/palettes.js`. Keys are permanent.
- **A scene:** add it to `PRESETS` in `core/presets.js`.

## The Android app

`android/` is a small Kotlin app: one full-screen, immersive WebView that loads `Tactilume.html` from
the app's own assets, over a private `https://appassets.androidplatform.net` origin so the
microphone and other secure-context features work. It asks for the highest refresh rate the screen
offers. It keeps the system's edge gestures away from the lower part of each side, saves photos and
clips to the gallery (Pictures/Tactilume, Movies/Tactilume), shares them, and handles Back. The web
page is copied in at build time; it is never duplicated in the repository.

```
tools/setup-android-sdk.sh         # once: installs the Android SDK (or set ANDROID_HOME to yours)
npm run build                      # the app bundles the built Tactilume.html
cd android && ./gradlew assembleDebug
# the APK: android/app/build/outputs/apk/debug/app-debug.apk
```

To install it on a phone, copy the APK over and open it. Android asks once to allow installs from
that source. A debug build is signed with a debug key, so to install a newer build over one made on
another computer, uninstall the old one first.

## Credits

Original work. The tone-mapping curve is AgX by Troy Sobotka, in Benjamin Wrensch's compact
polynomial form. The bloom downsample follows Jorge Jimenez's 2014 talk "Next Generation Post
Processing in Call of Duty: Advanced Warfare". The integer hash is PCG3D by Mark Jarzynski and Marc
Olano. The ambient flow is the Arnold-Beltrami-Childress field.
