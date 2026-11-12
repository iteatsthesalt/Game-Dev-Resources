# Tactilume Desktop: contracts

The interfaces every part is built against. `docs/design.md` explains why. When code and this file disagree, fix the code, or update this file in the same change and say so.

## Ground rules

- **Plain JavaScript ES modules.** Node 22, Chromium 156 (Electron 45). No TypeScript and no frameworks.
- **Comments** say *why*, in plain English. Names are what a person would call the thing.
- **Ownership.** Each file has one owner (see "Ownership" at the end). Edit only files you own. If you need something from another part, code against its contract here; if the contract is missing something, stop and report it rather than editing another owner's file.
- **The mobile edition's core is shared and read-only.** It lives in `../Tactilume/src/js/core/` (`util behaviours palettes scene presets poles store surprise governor`). Import it by relative path, for example `import { sanitizeScene } from '../../../Tactilume/src/js/core/scene.js'`, and never edit it. The mobile edition's tests guard it. Its contracts are in `../Tactilume/src/js/CONTRACTS.md`.
- **Original work.** Do not copy the names, mode tables, presets, look or text of other light-show apps.
- **Safety.** The flash guard is on by default. No full-screen strobing: whole-screen brightness may not rise faster than the guard allows. Respect `prefers-reduced-motion` in the UI.
- **Accessibility.** Every control is reachable by keyboard and has a visible focus ring and an accessible name. Text is at least 14 px. Colour is never the only signal.
- **WGSL rules** (unit-tested in `tests/unit/wgsl.test.js`):
  - Never rely on NaN checks. Test the float's bits: `(bitcast<u32>(x) & 0x7f800000u) == 0x7f800000u`.
  - Use `pow` only on bases that can never be negative.
  - Guard every division.

## Layout and build

```
package.json              type: module, main: dist/main.cjs
tools/build.mjs           esbuild, builds dist/
  dist/main.cjs           ← src/main/main.js        (node, cjs; external: electron)
  dist/preload.cjs        ← src/preload/preload.js  (node, cjs; external: electron)
  dist/renderer/          ← src/renderer/index.html, style.css, app.js (← src/renderer/main.js, browser, esm; .wgsl as text)
  dist/phone/             ← src/phone/index.html, phone.css, phone.js (← src/phone/phone.js, browser, iife)
  dist/classic/index.html ← ../Tactilume/Tactilume.html (the mobile engine, used as the fallback)
electron-builder.yml      NSIS (Windows, per user), dmg (macOS arm64 + x64), AppImage + deb (Linux); unsigned
```

Scripts: `build`, `start` (build, then electron .), `unit` (`node --test tests/unit/`), `e2e` (`node tests/e2e/run.js [name filter...]`), `test` (build, then unit, then e2e), `smoke` (`electron . --smoke`), `dist` (build, then electron-builder --publish never).

Dependencies: `ws` and `qrcode-generator`. Dev dependencies: `electron` 45.3.1, `electron-builder` 26.18.0, `esbuild` 0.28.2, `playwright` 1.63.0.

---

## shared/ (pure; used by main, phone and tests)

### shared/protocol.js: phone ↔ desktop messages, JSON over WebSocket at path `/link`

```js
export const PROTOCOL = 1;
export const LIMITS = { maxTouches: 10, maxMessageBytes: 4096, maxName: 24, maxRate: 240 /* msgs/s */ };
export const ACTIONS = ['behaviour', 'palette', 'preset', 'surprise', 'pulse', 'clear'];
export function parsePhoneMessage(text) // → { ok: true, msg } | { ok: false, error: 'json'|'type'|'field'|'size' }
export function parseDesktopMessage(text) // the same, for the phone page
export const encode = (msg) => JSON.stringify(msg);
// builders, desktop → phone:
export function welcome({ player, color, name, behaviour, palette, behaviours, palettes }) // → msg
export function reject(why)        // why: 'token' | 'full' | 'closed' | 'version' | 'bad'
export function haptic(ms, k)      // ms clamped to 1..500, k (strength) to 0..1
export function pong(c, s)
export function state(partial)     // { behaviour?, palette?, players? }
```

Phone → desktop messages, after validation and clamping:
- `{ t: 'hello', v: 1, token: string 1..64, name: string 0..24 (control chars removed, trimmed), caps: { touches: int 1..10, haptics: bool } }`
- `{ t: 'touch', s: seq (int 0..2^31-1), p: [[id 0..255, x 0..1, y 0..1, f 0..1], …] }`. This lists every touch currently down, at most 10. x and y are in pad space with (0,0) at the top left. f is force, 0.5 when unknown. An empty `p` means no touches.
- `{ t: 'act', a: one of ACTIONS, v: int -1..1 (direction; optional) }`
- `{ t: 'ping', c: finite number }`

Anything else is rejected: unknown `t`, non-finite numbers, extra-long arrays or strings, or text over `maxMessageBytes`.

Desktop → phone messages:
- `welcome`, which carries `player` (1..8), `color` (`'#rrggbb'`), `behaviours` and `palettes` (`[{key, name}]`)
- `reject`, `haptic`, `pong`, `state`

### shared/lan.js

```js
export function isPrivateAddress(ip)    // IPv4 10/8, 172.16/12, 192.168/16, 169.254/16, 100.64/10, 127/8;
                                        // IPv6 ::1, fc00::/7, fe80::/10; IPv4-mapped IPv6 (::ffff:a.b.c.d) unwrapped
export function pickLanAddresses(ifaces) // ifaces as os.networkInterfaces() returns; → [{address, family, name}], best first:
                                         // private IPv4 that is not internal first, likely-virtual adapters
                                         // (docker, vbox, vmnet, utun, br-, veth, tailscale, zt) last
export function newToken(randomBytes)    // randomBytes(n) → Uint8Array; returns 22-char base64url (128 bits)
export function tokensEqual(a, b)        // constant-time string compare
export function controllerUrl({ address, port, token }) // 'http://192.168.1.5:47615/#k=TOKEN'; IPv6 in brackets
```

---

## main/ (Electron main process)

### main/link-server.js

```js
export function createLinkServer({ port = 47615, host = '0.0.0.0', staticDir, onEvent,
  allowNew = true, maxPhones = 8, log = () => {}, now = Date.now, randomBytes, interfaces })
server.start()  // → Promise<info>; if the port is busy, tries the next 20 ports
server.stop()   // → Promise
server.info()   // → { running, port, addresses, url, token, allowNew, phones: [{ player, name, since }] }
server.setAllowNew(on); server.rotateToken() // → info
server.send(player, msg) // → bool; msg must be a haptic or state builder result
server.broadcast(msg)
// onEvent(e): { type: 'join', player, name, caps } | { type: 'leave', player }
//           | { type: 'touch', player, seq, touches: [[id, x, y, f], …], at } | { type: 'act', player, a, v }
```

HTTP:
- Serves `GET /` (index.html), `/phone.js` and `/phone.css` from `staticDir`. Everything else gets 404.
- Headers: `Content-Security-Policy: default-src 'self'; connect-src 'self' ws:; img-src 'self' data:`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` and `Cache-Control: no-store`.
- A request whose remote address is not private gets 403. The same applies to the WebSocket upgrade.

WebSocket (`/link`):
- The first message must be `hello`, within 5 s. Its token must match (constant time) and its version must be 1. New phones are refused unless allowNew is on, and when 8 phones are connected.
- On success the server sends `welcome`. The player number is the lowest free slot, 1..8.
- `ping` gets a `pong` reply.
- Over the message rate the server closes with 1008; an oversized message closes with 1009. A phone that stays silent for more than 30 s is dropped after a server ping times out.

### main/qr.js
`qrSvg(text)` → an SVG string (dark modules on a light background, 4-module quiet zone), made with `qrcode-generator`.

### main/settings.js
`createSettings(file)` → `{ get(), set(partial) → settings, path }`. It stores JSON atomically: it writes a temporary file, then renames it.

Defaults: `{ linkPort: 47615, allowNewPhones: true, forceWebGPU: false, fullscreen: false, bounds: null }`.

### main/audio-capture.js
`installDisplayMedia(session, { platform, release })` sets `setDisplayMediaRequestHandler` so the renderer's `getDisplayMedia({ audio: true, video: true })` gets the primary screen together with `audio: 'loopback'`, wherever Electron supports that (Windows; macOS 14.2+).
`systemAudioSupport({ platform, release })` → `{ supported, how: 'loopback' | 'monitor-device' | 'none' }`. On Linux the answer is `'monitor-device'`: PipeWire/Pulse monitor sources appear in `enumerateDevices`.

### main/window.js and main/main.js
- **GPU switches** are set before `ready`. If `forceWebGPU` is on, add `ignore-gpu-blocklist` and `enable-unsafe-webgpu`.
- **Single instance lock.**
- **Window:** background `#000`, and it is shown on `ready-to-show`.
- **webPreferences:** `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `backgroundThrottling: false`, and the preload.
- **Navigation:** anything other than `dist/renderer` and `dist/classic` is denied, and `window.open` is denied.
- **CSP:** the renderer's CSP is in its `index.html` meta tag.
- **IPC.** Every argument is validated in main.
  - `link:info`, `link:allowNew`, `link:rotate`, `link:send`
  - `app:settings:get`, `app:settings:set`, `app:fullscreen`, `app:gpu` (from `app.getGPUInfo('basic')`), `app:ready`, `app:quit`
  - `audio:support`
  - main → renderer: `link:event`
- **`--smoke`.** Start everything and wait for `app:ready`. Then `GET /` on the link server must return 200. On success, exit 0; after 30 s with no success, exit 1. Print one line of the result.

## preload/preload.js → `window.tactilume` (contextBridge)

```js
{ version, platform,
  link: { info() /* → Promise<info & {qrSvg}> */, setAllowNew(on), rotateToken() /* → info & {qrSvg} */,
          send(player, msg) /* haptic/state only */, onEvent(fn) /* → off */ },
  app:  { getSettings(), setSettings(partial), setFullscreen(on), isFullscreen(), gpuInfo(), ready(), quit() },
  audio:{ systemSupport() } }
```

---

## renderer/

### renderer/bridge.js
`getBridge()` returns `window.tactilume` if it exists. Otherwise it returns a browser shim with the same API, used by tests and plain-browser development.

The shim also sets `window.__tlShim = { emit(event) /* as link:event */, sent: [], settings: {} }`. Its `link.info()` returns a fake URL and a small placeholder SVG.

### renderer/main.js: boot, actions, frame loop, test hook
- **URL params:**
  - `?test=1`: fixed seed, no autoplay, no intro, no calibration.
  - `particles=N`: overrides the particle count.
  - `present=0`: offscreen only, for headless browsers.
  - `webgpu=0`: forces the fallback path.
- **Store.** It uses the mobile `createStore()` for scene and settings. Desktop-only settings live in `localStorage['tactilume.desktop.v1']`: `{ particles, calibratedFor, hdr: 'auto'|'on'|'off', teamColors: true, haptics: true, intro: true }`.
- **Engine.** `createEngine` throwing `Error('webgpu')` sends the window to `../classic/index.html?desktop=1`.
- **Actions.** Inputs and the UI call these:
  ```js
  actions = { nextBehaviour(dir), setBehaviour(key), nextPalette(dir), nextPreset(dir), surprise(), clear(),
              pulse(x, y, power, color) /* world units */, adjust(key, delta) /* trails, size, glow, strength… */,
              toggleUI(), togglePhonePanel(), toggleFullscreen(), toast(text) }
  ```
  `nextBehaviour` cycles `scene.lock` through `['auto', ...BEHAVIOUR_KEYS]`.
- **Frame loop** (requestAnimationFrame). Each frame:
  1. `pointer.update(dt)`, `gamepads.update(dt, time)`, `phones.update(dt)`, `audio.update(dt)`.
  2. `poles = hub.poles()`.
  3. `fingers` = the number of held poles, capped at 10.
  4. The behaviour comes from `behaviourFor(scene, fingers)`, with the same crossfade as mobile.
  5. `engine.frame({ dt, time, scene, settings, poles, behaviour, audio, gravity, fingers, players })`.
  6. The governor runs.
  7. After the first frame, `bridge.app.ready()`.
- **Idle autoplay.** When nobody has played for 20 s, the mobile edition's autopilot (`../Tactilume/src/js/input/autopilot.js`) plays, if it can be imported cleanly.
- **Test hook:** `window.TACTILUME_DESKTOP = { ready, version, engine, hub, store, audio, ui, actions, bridge, frames, fallback: false }`.

### renderer/engine/: the WebGPU engine (`engine.js`, `gpu.js`, `capture.js`, `calibrate.js`, `governor.js`, `shaders/*.wgsl`)

```js
export async function createEngine(canvas, { particles, maxParticles, hdr = 'auto', present = true, onLost } = {})
// Throws Error('webgpu') when there is no adapter or device. Requests the adapter's highest
// maxStorageBufferBindingSize and maxBufferSize (up to 2 GiB).
engine.caps   // { backend: 'webgpu', adapter: { vendor, architecture, description, fallback }, maxParticles,
              //   hdr /* the canvas is in extended HDR now */, features: [...], presenting: bool }
engine.resize(cssW, cssH, dpr)
engine.setQuality({ particles, renderScale })
engine.frame(f)   // f = { dt, time, scene, settings, poles, behaviour: { a, b, mix }, audio, gravity, fingers, players }
                  //   audio = { level, bass, mid, high, onset, beat }; players = [{ id, color: [r, g, b] 0..1 }]
                  //   Each pole has .player (an id in players). With teamColors and 2+ players, light near
                  //   a player's poles takes on that player's colour.
engine.pulse(x, y, power, color) ; engine.release(x, y, power, heldFor)  // world units, as in mobile
engine.screenToWorld(px, py) /* canvas CSS px → {x, y} */ ; engine.worldToScreen(x, y) ; engine.aspect
engine.capture()  // → Promise<{ width, height, data: Uint8ClampedArray }>: the last frame, SDR RGBA8,
                  //   read from the offscreen target (works with present = false)
engine.stats      // { particles, renderScale, width, height, frameMs, presenting }
engine.dispose()
```

- **Behaviours.** The 12 behaviours, forms, flow, gravity, symmetry poles and audio forces have the same meaning as the mobile GLSL (`../Tactilume/src/js/gfx/shaders/sim.vert.glsl`). Port them, do not reinvent them.
- **Particles.** 32 bytes each. Above 65,535 workgroups per dimension, dispatch in 2D.
- **Device loss.** On device loss the engine recreates itself once, then calls `onLost`.
- **Presenting.** If presenting fails (for example in headless Chromium, where pending promises reject with "A valid external Instance reference no longer exists"), the engine switches to offscreen only and sets `caps.presenting = false`.

`calibrate.js`:
- `calibrate(engine, { refreshHz, budget = 0.7, timeLimitMs = 10000 })` → `{ particles, results: [{ n, ms }] }`
- Pure helper: `pickParticles(results, refreshHz, budget)`.

`governor.js`: `createGovernor({ min, max, start, refreshHz })` → `{ update(frameMs, now) → particles | null }`. It steps down after misses and steps up slowly when there is headroom. Pure, and unit-tested.

### renderer/input/
- **hub.js:**
  - `createHub({ maxPoles = 64 })`.
  - `hub.addPlayer({ kind: 'pointer'|'gamepad'|'phone', name, key })` → `{ id, kind, name, color: [r, g, b], key }`.
  - `hub.removePlayer(id)`, `hub.setPoles(id, poles)`.
  - `hub.poles()` gives the total, capped at maxPoles. Each player keeps at least one pole, then the newest poles win. Every pole has `.player`.
  - `hub.players()`, `hub.on('players', fn)` → off.
  - `PLAYER_COLORS`: 8 colours that stay distinct for colour-blind viewers.
- **pointer.js:** `createPointer(canvas, { engine, hub, actions })` turns mouse, pen and touch on the desktop window into the "Desk" player's poles. Poles are in world units, with smoothed velocity and a 0.35 s release fade, like mobile. Exposes `.update(dt)` and `.dispose()`.
- **gamepad.js:** `createGamepads({ engine, hub, actions, getSettings, getPads = () => navigator.getGamepads() })`. Exposes `.update(dt, time)` and `.dispose()`. A pad becomes a player at its first button press.
  - **Cursors:** each stick moves a cursor pole across the screen (velocity control with a radial deadzone of 0.15 and a response curve).
  - **Strength:** the trigger on the same side sets the pole's power, and the pole is held while trigger > 0.05.
  - **Buttons:** A pulses at the left cursor, B is the next behaviour, X the next palette and Y surprise. LB and RB step through presets. D-pad up and down change trails, left and right change size. Start toggles the UI and Back toggles the phone panel.
  - **Rumble:** `dual-rumble` on pulses and Nova releases, when `settings.haptics` is on.
  - **Pure helpers for unit tests:** `radialDeadzone(x, y, dz)`, `responseCurve(v, k)`, `readPad(pad)`.
- **phone.js:** `createPhones({ bridge, hub, engine, actions })`. Exposes `.update(dt)` and `.dispose()`.
  - **Joining and leaving:** `join` adds a phone player, and `leave` removes it.
  - **Touches** become poles: pad x and y map to the whole canvas (`x * cssW`, `y * cssH`), then go through `engine.screenToWorld`. Velocity is smoothed, a released touch fades out, and `f` sets power.
  - **Actions:** `act` calls the matching action.
  - **Feedback to the phone:** a pulse sends `haptic(30, 0.6)` to its phone, and a change of behaviour or palette broadcasts `state`.

### renderer/audio/
- **audio.js:** `createAudio({ bridge })` → `{ source, useMic(deviceId), useSystem(), useFile(fileOrUrl), stop(), devices(), update(dt), features() }`.
  - `source` is `'off'|'mic'|'system'|'file'`.
  - `features()` returns `{ level, bass, mid, high, onset, beat, bpm }`, all 0..1 except bpm.
  - It uses an AnalyserNode (fftSize 2048).
  - A file plays out loud. The microphone and system audio are only analysed, never played back.
- **features.js:** `createFeatureTracker({ sampleRate, fftSize })` → `.update(dbBins, dt)` → features. Pure.
  - **Bands:** bass 20–150 Hz, mid 150–2k, high 2k–12k.
  - **Gain:** adaptive, from a slowly decaying peak.
  - **Onsets:** spectral flux against an adaptive threshold (median + k·MAD over about 1 s), with a 100 ms refractory period.
  - **Beat and bpm:** from a histogram of onset intervals, 60–180 bpm.

### renderer/ui/ui.js
`createUI({ root, store, actions, bridge, engine, audio, hub, desktop })` → `{ toggle(), isOpen(), toast(text), showPhonePanel(on), dispose() }`.
- **Corner buttons:** Phone, Sound, Settings and Fullscreen. The UI hides itself after 4 s idle and comes back on any input.
- **Phone panel:** the QR code, the URL as text, the players in their colours, the allow-new toggle, and a "New code" button.
- **Sound panel:** Off, Microphone, Computer audio (shown only where supported), Music file (picker and drag-and-drop), and a device chooser.
- **Settings panel:** particles (auto or manual), "Measure again" (calibration), HDR (auto/on/off), flash guard, team colours, haptics, force WebGPU (needs a restart), and the GPU information.
- **Keys:**

  | Key | Action |
  |---|---|
  | F | fullscreen |
  | H | hide the UI |
  | P | phone panel |
  | Space | pulse at the centre |
  | 1–9, 0 | behaviours |
  | [ and ] | palettes |
  | , and . | presets |
  | Esc | close the panel |

### phone/ (served to phones; no external resources)
`index.html`, `phone.css` and `phone.js` make one full-screen touch pad (`touch-action: none`, no zoom or scroll).
- **Screen:** the status (connecting, playing as Player N in its colour, or disconnected) and a row of buttons: behaviour ◀ ▶, palette, surprise and pulse.
- **Connecting:** the page reads the token from `location.hash` (`k=`), sends `hello`, and reconnects with backoff.
- **Sending touches:** at most one `touch` frame per animation frame (≤ 120 Hz), and an empty frame when the last finger lifts.
- **Feedback:** `haptic` calls `navigator.vibrate` where it exists. The page explains that the screen may sleep, because a phone on plain HTTP has no wake lock.
- **Compatibility:** it works in iOS Safari and Android Chrome.

---

## Tests

- **Unit tests:** `node --test tests/unit/`. Each part adds `tests/unit/<area>*.test.js`.
- **Browser tests:**
  - `node tests/e2e/run.js [filters]` runs after `npm run build`. It serves `dist/` on 127.0.0.1 with a tiny static server.
  - It launches Playwright's Chromium with `--enable-unsafe-webgpu --enable-unsafe-swiftshader` and opens `/renderer/index.html?test=1&present=0&particles=20000`.
  - Scenarios live in `tests/e2e/scenarios-<area>.js`, collected by `tests/e2e/scenarios.js`. Each is `{ name, async run(page, h) → checks[] }`; helpers are in `tests/e2e/helpers.js`.
  - Scenarios may drive phones through `window.__tlShim.emit(...)` and gamepads through an init script that replaces `navigator.getGamepads`. They read the picture through `TACTILUME_DESKTOP.engine.capture()`.
  - Each new check must be shown failing against a build without the fix it guards.
- **Electron smoke test:** `xvfb-run -a npx electron . --smoke` (in CI, and locally where Xvfb exists).

## Ownership

| Part | Files |
|---|---|
| spine | `package.json`, `tools/**`, `tests/e2e/run.js`, `tests/e2e/helpers.js`, `tests/e2e/scenarios.js`, `tests/unit/wgsl.test.js`, `README.md` |
| engine | `src/renderer/engine/**`, `tests/unit/engine-*.test.js`, `tests/e2e/scenarios-engine.js` |
| link | `src/shared/**`, `src/main/link-server.js`, `src/main/qr.js`, `src/phone/**`, `src/renderer/input/phone.js`, `tests/unit/{protocol,lan,link}*.test.js`, `tests/e2e/scenarios-phone.js` |
| input-audio | `src/renderer/input/{hub,pointer,gamepad}.js`, `src/renderer/audio/**`, `src/main/audio-capture.js`, `tests/unit/{hub,gamepad,features}*.test.js`, `tests/e2e/scenarios-input.js` |
| shell-ui | `src/main/{main,window,settings}.js`, `src/preload/**`, `src/renderer/{main,bridge}.js`, `src/renderer/ui/**`, `src/renderer/index.html`, `src/renderer/style.css`, `electron-builder.yml`, `.github/workflows/tactilume-desktop.yml`, `tests/unit/settings*.test.js`, `tests/e2e/scenarios-app.js` |

The spine also writes a first version of every file above. Each one is a stub that matches its contract, so the build and the tests run from day one. The owners then replace them.
