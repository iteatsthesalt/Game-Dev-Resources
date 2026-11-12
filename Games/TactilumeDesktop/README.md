# Tactilume Desktop

Tactilume Desktop is the desktop edition of Tactilume, for Windows, macOS and Linux. It is a
light show drawn by a WebGPU particle engine, and you play it in three ways:

- **Phones on the same network.** The app shows a QR code. A phone that scans it becomes a
  touch pad, with no app to install and no internet needed. Several phones can play at once,
  each in its own colour. The big screen says when a phone joins or leaves, and the Phone
  panel can remove one phone for good (it asks first, and the code changes).
- **Gamepads.** Each pad is a player, from its first press of any button; a pad plugged in
  but not yet playing is asked to press one. The sticks steer two points of light, the
  triggers set their strength, and the buttons change the behaviour, colours and scene.
  Clicking a stick holds its light down without the trigger, for anyone who cannot keep a
  trigger pulled; click it again to let go. Settings > Gamepad lists every button. Settings
  also names the requirement tier from [docs/design.md](docs/design.md) this computer meets.
- **Sound.** The light can move with a microphone, with what the computer is playing, or with
  a music file.

The scenes, palettes, presets and share codes are the mobile edition's, so a scene made on a
phone opens here. When a computer cannot run WebGPU, the app runs the mobile edition's WebGL2
engine instead. The mobile edition lives next door in [`../Tactilume`](../Tactilume).

Why it is built this way is in [docs/design.md](docs/design.md). The interfaces between its
parts are in [CONTRACTS.md](CONTRACTS.md).

**Status:** first milestone (M1), built and tested: the WebGPU particle engine, the phone link,
gamepads, sound, the overlay with its Phone, Sound and Settings panels, and installers from CI.
What is still missing is listed under "Known gaps" below.

## Running it

You need Node.js 22 or later.

```
npm install          # once
npm start            # build, then open the app
```

The first start downloads Electron's binary, which takes a minute.

On Linux, Chromium turns WebGPU off for some graphics drivers (AMD ones most often). The app
then runs the classic engine: the mobile edition's WebGL2 light show, played with the mouse,
touch and keys. It has no phones, no gamepads, and none of the desktop's Sound or Settings
panels, and a strip at the top of the window says so. To turn WebGPU on anyway, press the
strip's "Turn on WebGPU" button, or press Alt to show the menu and choose
Graphics > Force WebGPU on This Computer. It applies from the next start, and the app offers
to restart. When WebGPU is running, the same switch is also in Settings.

Chromium refuses to start as root with its sandbox on. Run the app as an ordinary user. In a
throwaway container where you must be root, add `--no-sandbox` (for example
`npx electron . --no-sandbox`); never ship or document that for real use.

## Testing it

```
npm test                             # build, unit tests, then the browser tests
npm run unit                         # only the unit tests (node --test)
npm run e2e -- boot fallback         # only the browser scenarios whose names contain these words
xvfb-run -a npm run smoke            # the real app under a virtual display (Linux)
```

- **Unit tests** are in `tests/unit/`. They cover the pure modules, and `wgsl.test.js` checks
  every shader for the WGSL rules in CONTRACTS.md.
- **Browser tests** serve the built `dist/` on 127.0.0.1 and run the renderer in Playwright's
  Chromium with WebGPU on its software adapter. A shim stands in for the Electron bridge, so
  the tests can play fake phones (`window.__tlShim.emit`) and fake gamepads. Headless Chromium
  cannot show a WebGPU canvas, so the tests draw offscreen (`present=0`) and read the picture
  back. Each part adds its own `tests/e2e/scenarios-<area>.js`; `scenarios-integration.js`
  plays two phones, a gamepad, the mouse and a music file all at once.
- **The smoke test** starts the real app with an empty profile, waits for the renderer to say
  it is ready, checks that the phone link answers, prints one line and exits: 0 means it works.

## Known gaps

Things M1 does not do yet, or that the tests cannot reach. Each is safe to leave for now.

- **No phone-to-app test in one piece.** Each hop is tested on its own: the link server with
  a real WebSocket client and the real phone page, the main process forwarding link events,
  and the renderer with fake link events. No automated test sends a real phone's touches all
  the way into the running Electron app.
- **The smoke test runs the classic engine here.** Under Xvfb, Chromium turns WebGPU off, so
  `--smoke` boots the mobile engine. The WebGPU engine was checked by hand in Electron with
  WebGPU forced on (it calibrated and presented); the browser tests cover it otherwise.
- **Presenting is not tested.** Headless Chromium cannot show a WebGPU canvas, so the tests
  read the offscreen picture. The step that copies it to the screen is only checked by hand.
- **No per-adapter tuning yet.** `docs/design.md` plans to use `subgroups` and `shader-f16`
  where the GPU offers them, and larger workgroups where allowed. The engine requests
  `shader-f16` but its shaders do not use it or subgroups yet; the particle passes use
  256-wide workgroups everywhere, and eye adaptation runs on one 64-thread workgroup. The
  engine is correct without these; they only make it faster.
- **Each speck is shaded once per corner.** The draw pass works out a speck's colour, size and
  sparkle in the vertex shader, so it runs four times for each particle (once per corner of
  its quad), where the mobile edition ran once per point. Working it out once, in a compute
  pass that writes a small record per particle, would cut the dominant pass's vertex work by
  about three quarters, at the cost of 8 or more bytes per particle of GPU memory. It is left
  for a milestone that can measure it on the reference GPU: the software adapter here cannot
  show whether it pays, and calibration already sets the count from what the full renderer costs.
- **The HDR highlight limit has no automated test.** The composite keeps a saturated colour's
  largest channel at the HDR peak (so pure blue no longer runs to 14 times it), but HDR
  output cannot be read back headless; it was checked against the formula only.
- **Packaged builds with asar integrity are untested here.** `electron-builder.yml` turns on
  `enableEmbeddedAsarIntegrityValidation`, which only acts on Windows and macOS. Run the
  installed app once on each before a release to see that it starts.
- **No Dependabot for the workflow's actions.** They are pinned to commit SHAs; nothing bumps
  them yet. A `github-actions` entry in the repository's `.github/dependabot.yml` would, but
  that file covers every project in the repository, so it is left to its owner.
- **System audio on Linux** comes only from monitor inputs (PipeWire or PulseAudio), listed
  among the inputs in the Sound panel; Electron has no loopback capture there.
- **Fast light looks dotted on slow machines.** Trails build up frame by frame, so a speck
  that moves further than its own size in one frame leaves a dotted trail. At 60 frames a
  second this is slight; on the tests' software GPU (a few frames a second) it is plain.
- **Unsigned installers.** Windows SmartScreen and macOS Gatekeeper warn on first launch.

## Making installers

```
npm run dist         # build, then package for this operating system into release/
```

This makes an NSIS installer on Windows (per user), a dmg on macOS (Apple silicon and Intel),
and an AppImage and a .deb on Linux. They are not signed yet, so Windows SmartScreen and macOS
Gatekeeper warn on the first launch. CI builds all three on every change.

## Layout

```
src/main/        Electron's main process: window, settings, phone link server, IPC
src/preload/     the bridge the renderer sees as window.tactilume
src/renderer/    boot and frame loop (main.js), engine/, input/, audio/, ui/
src/phone/       the controller page served to phones
src/classic/     the desktop's strip on the classic (fallback) engine's page
src/shared/      the phone protocol and network helpers, used on both sides
tools/build.mjs  builds everything into dist/
tests/           unit tests and browser scenarios
```

## Working on it

- Read [CONTRACTS.md](CONTRACTS.md) first. Each file has one owner, listed at its end.
- The mobile edition's `src/js/core/` modules are shared and read-only here. Import them by
  relative path and never edit them from this project.
- Shaders follow three rules: no NaN checks a compiler may drop, `pow` only on bases that
  cannot be negative, and every division guarded. When the checker cannot see that a divisor
  is safe, give the reason in a comment on the same line:
  `let k = a / b; // nonzero: b is a count, at least 1`.
- Several people build in this tree at once. The build writes each file under a temporary
  name and renames it into place, so tests never read half a file.
