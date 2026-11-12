# Tactilume Desktop

Tactilume Desktop is the desktop edition of Tactilume, for Windows, macOS and Linux. It is a
light show drawn by a WebGPU particle engine, and you play it in three ways:

- **Phones on the same network.** The app shows a QR code. A phone that scans it becomes a
  touch pad, with no app to install and no internet needed. Several phones can play at once,
  each in its own colour.
- **Gamepads.** Each pad is a player. The sticks steer two points of light, the triggers set
  their strength, and the buttons change the behaviour, colours and scene.
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

On Linux, Chromium turns WebGPU off for some graphics drivers. The app then runs the mobile
engine. "Force WebGPU" in Settings (or in the app's small menu) turns WebGPU on anyway, from
the next start; the app offers to restart.

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
  256-wide workgroups everywhere, and eye adaptation runs on a single invocation. The engine is correct without these; they only make it faster.
- **Settings shows no tier.** The Settings panel shows the GPU and the particle count, but not
  the requirement tier from `docs/design.md`.
- **One phone cannot be removed.** The link server can drop a single phone for good
  (`kick(player)`), but there is no IPC call or button for it yet. "New code" removes the
  way back in for everyone not yet joined.
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
