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
  dist/classic/index.html ← ../Tactilume/Tactilume.html (the mobile engine, used as the fallback), with a
                            Content-Security-Policy meta tag added (its inline script allowed by a sha256
                            computed at build time) and a script tag for desktop-strip.js
  dist/classic/desktop-strip.js ← src/classic/desktop-strip.js (browser, iife): with ?desktop=1, a strip
                            saying phones and gamepads are off and how to turn WebGPU on
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
export function reject(why)        // why: 'token' | 'full' | 'closed' | 'version' | 'bad' | 'removed'
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

Optional fields the parts agreed on (a page that leaves them out still works):
- `hello.id`: a random id (16..64 base64url characters) the page keeps for its tab, so a phone whose Wi-Fi blinks gets its own player back.
- `touch.ms`: the phone's clock (ms) when it took the frame, so the renderer measures finger speed without the network's jitter.
- `state.color`: the colour the desktop really draws this player in (`'#rrggbb'`); `state.players` counts every player of every kind.
- `REJECT_REASONS` is exported with the six reasons above. `'removed'` means the host removed this phone from the Phone panel (`server.kick`); a page that does not know it reads it as `'bad'`, which also stops it knocking again.

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
export function isLocalHostHeader(host)  // a Host header that is an IP address or a local name (refuses DNS rebinding)
export function isSameOrigin(origin, host) // a browser upgrade's Origin is the page this server served
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
- Headers: `Content-Security-Policy: default-src 'self'; connect-src 'self' ws://<the checked Host>; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'` (`pageCsp(host)`; never a bare `ws:`, which would allow any host), `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` and `Cache-Control: no-store`.
- A request whose remote address is not private gets 403. The same applies to the WebSocket upgrade.

WebSocket (`/link`):
- The first message must be `hello`, within 5 s. Its token must match (constant time) and its version must be 1. New phones are refused unless allowNew is on, and when 8 phones are connected.
- On success the server sends `welcome`. The player number is the lowest free slot, 1..8.
- `ping` gets a `pong` reply.
- Over the message rate the server closes with 1008; an oversized message closes with 1009. A phone that stays silent for more than 30 s is dropped after a server ping times out.

Agreed additions:
- Before the token: a Host header that is not an address or a local name gets 403, and so does a browser upgrade whose Origin is not this server's page. At most 16 connections may wait for `hello` (503 beyond). Binary messages close 1003; `full` and `closed` refusals close 1013.
- Per peer (`PEER_LIMITS`, by remote address with `::ffff:a.b.c.d` folded to `a.b.c.d` by `peerKey`): at most 3 of those 16 waiting connections (503 beyond), at most 16 TCP connections of any kind (more are cut at once), and a connection that sends no byte within 3 s is cut. One peer on the network cannot take the room new phones need. `peerLimits` can be passed in, for tests.
- A phone that sends the same `hello.id` again replaces its old socket (closed 4000) and keeps its player, and may come back for 60 s after leaving even while allowNew is off. Taking over its old socket is no new join (no event), so its welcome carries the colour last sent to it in a `state` (`server.send`), not the slot's first guess; that colour is forgotten when the phone leaves.
- Fingers held with no frame for 1.5 s are let go with an empty `touch` event, so a frozen phone cannot leave a pole stuck. The page repeats its frame four times a second while fingers rest.
- `touch` events carry `ms` (the phone's clock) when the page sent it.
- `server.kick(player)` removes a phone for good: it forgets the phone's session, changes the code, and turns the phone away with `reject('removed')` (closed 1008). → whether there was such a phone. The Phone panel offers it through `link:kick`.
- `isPeerAllowed(address)` and the timeouts can be passed in, for tests.

### main/qr.js
`qrSvg(text)` → an SVG string (dark modules on a light background, 4-module quiet zone), made with `qrcode-generator`.

### main/settings.js
`createSettings(file)` → `{ get(), set(partial) → settings, path }`. It stores JSON atomically: it writes a temporary file, then renames it.

Defaults: `{ linkPort: 47615, allowNewPhones: true, forceWebGPU: false, fullscreen: false, bounds: null }`.

### main/audio-capture.js
`installDisplayMedia(session, { platform, release })` sets `setDisplayMediaRequestHandler` so the renderer's `getDisplayMedia({ audio: true, video: true })` gets the primary screen together with `audio: 'loopback'`, wherever Electron supports that (Windows; macOS 14.2+).
`systemAudioSupport({ platform, release })` → `{ supported, how: 'loopback' | 'monitor-device' | 'none' }`. On Linux the answer is `'monitor-device'`: PipeWire/Pulse monitor sources appear in `enumerateDevices`.
Where there is no loopback (Linux, macOS before 14.2) the handler answers with no stream, so no system screen picker ever opens. Optional extras: `desktopCapturer`, `allow(request)`, `primaryDisplayId()` and `log(line)`. main.js passes all of them: `allow` admits only the window's own top frame on an app page (`window.js` `isOwnTopFrame(frame, mainFrame, pages)`), and `primaryDisplayId` is `screen.getPrimaryDisplay().id`.

### main/window.js and main/main.js
- **GPU switches** are set before `ready`. If `forceWebGPU` is on, add `ignore-gpu-blocklist` and `enable-unsafe-webgpu`.
- **Single instance lock.**
- **Window:** background `#000`, and it is shown on `ready-to-show`.
- **webPreferences:** `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `backgroundThrottling: false`, and the preload.
- **Navigation:** anything other than `dist/renderer` and `dist/classic` is denied, and `window.open` is denied.
- **CSP:** the renderer's CSP is in its `index.html` meta tag.
- **IPC.** Every argument is validated in main.
  - `link:info`, `link:allowNew`, `link:rotate`, `link:send`
  - `link:kick` (a player number, 1..8): `server.kick`, then → `info & { qrSvg, kicked }` (the code has changed, so the answer carries the new QR code)
  - `app:settings:get`, `app:settings:set`, `app:fullscreen` (with no argument it only answers whether the window is full screen), `app:gpu` (from `app.getGPUInfo('basic')`, plus `featureStatus`), `app:ready`, `app:quit`
  - Calls must come from the app window's own top-level page, with no more arguments than the channel takes.
  - `audio:support`
  - main → renderer: `link:event`
- **`--smoke`.** Start everything and wait for `app:ready`. Then `GET /` on the link server must return 200. On success, exit 0; after 30 s with no success, exit 1. Print one line of the result.

## preload/preload.js → `window.tactilume` (contextBridge)

```js
{ version, platform,
  link: { info() /* → Promise<info & {qrSvg}> */, setAllowNew(on), rotateToken() /* → info & {qrSvg} */,
          kick(player) /* → info & {qrSvg, kicked} */, send(player, msg) /* haptic/state only */, onEvent(fn) /* → off */ },
  app:  { getSettings(), setSettings(partial), setFullscreen(on), isFullscreen(), gpuInfo(), ready(), quit() },
  audio:{ systemSupport() } }
```

---

## renderer/

### renderer/bridge.js
`getBridge()` returns `window.tactilume` if it exists. Otherwise it returns a browser shim with the same API, used by tests and plain-browser development.

The shim also sets `window.__tlShim = { emit(event) /* as link:event */, sent: [], settings: {}, kicks: [] }`. Its `link.info()` returns a fake URL and a small placeholder SVG, and its `link.kick(player)` emits that phone's leave, changes the code and records the player in `kicks`.

### renderer/main.js: boot, actions, frame loop, test hook
- **URL params:**
  - `?test=1`: fixed seed, no autoplay, no intro, no calibration.
  - `particles=N`: overrides the particle count.
  - `present=0`: offscreen only, for headless browsers.
  - `webgpu=0`: forces the fallback path.
- **Store.** It uses the mobile `createStore()` for scene and settings. Desktop-only settings live in `localStorage['tactilume.desktop.v1']`: `{ particles, particleMode: 'auto'|'manual', manualParticles, calibratedFor, hdr: 'auto'|'on'|'off', teamColors: true, haptics: true, intro: true }`. `particles` is the measured count (the governor adjusts it while playing); `manualParticles` is a count chosen by hand, used while `particleMode` is `'manual'`. The engine and the inputs get one merged settings object: the shared settings with the desktop ones on top.
- **Engine.** `createEngine` throwing `Error('webgpu')` sends the window to `../classic/index.html?desktop=1`.
- **Actions.** Inputs and the UI call these:
  ```js
  actions = { nextBehaviour(dir), setBehaviour(key), nextPalette(dir), nextPreset(dir), surprise(), clear(),
              pulse(x, y, power, color) /* world units */, adjust(key, delta) /* trails, size, glow, strength… */,
              toggleUI(), togglePhonePanel(), toggleFullscreen(), toast(text) }
  ```
  `nextBehaviour` cycles `scene.lock` through `['auto', ...BEHAVIOUR_KEYS]`. Also `measure()` (run the benchmark again) and `setParticles(n | 'auto')`.
- **Wiring the inputs.** `createGamepads` gets `getSettings` (the merged settings) and `getLead()` (the behaviour leading the crossfade, so letting go of a Nova rumbles). `createPhones` gets `store` and `getSettings`. `createUI` gets `gamepads` and `cursorCanvas` for the cursor rings.
- **Frame loop** (requestAnimationFrame). Each frame:
  1. `pointer.update(dt)`, `gamepads.update(dt, time)`, `phones.update(dt)`, `audio.update(dt)`.
  2. `poles = hub.poles()`.
  3. `fingers` = the number of held poles, capped at 10.
  4. The behaviour comes from `behaviourFor(scene, fingers)`, with the same crossfade as mobile.
  5. `engine.frame({ dt, time, scene, settings, poles, behaviour, audio, gravity, fingers, players })`.
  6. The governor runs, told whether `engine.stats.skipped` rose during this frame.
  7. After the first frame, `bridge.app.ready()`.
- **Idle autoplay.** When nobody has played for 20 s, the mobile edition's autopilot (`../Tactilume/src/js/input/autopilot.js`) plays, if it can be imported cleanly.
- **Test hook:** `window.TACTILUME_DESKTOP = { ready, version, engine, hub, store, audio, ui, actions, bridge, frames, fallback: false }`, plus `desktop` (the desktop settings), `gamepads`, `phones`, `pointer` and `settings()` (the merged settings).

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
engine.stats      // { particles, renderScale, width, height, frameMs, presenting }, plus drawn (after scene.density),
                  //   capacity (the buffer's room), gpuMs, frames (frames drawn), skipped, hdr
engine.errors     // WebGPU errors seen, by kind
engine.dispose()
```

- **Frames in flight.** At most 2. A frame that comes while 2 are queued is skipped, and its time is simulated with the next (still capped at 1/20 s).

- **Behaviours.** The 12 behaviours, forms, flow, gravity, symmetry poles and audio forces have the same meaning as the mobile GLSL (`../Tactilume/src/js/gfx/shaders/sim.vert.glsl`). Port them, do not reinvent them.
- **Particles.** 32 bytes each. Above 65,535 workgroups per dimension, dispatch in 2D, with the workgroups spread evenly over the rows (`gpu.js` `workgroupGrid`), so fewer than one per row is spare.
- **The particle buffer** (`gpu.js` `particleCapacity`): the first one is just big enough; growing during play leaves half as much again of room (up to the limit), so the governor's 10% steps up rarely copy the buffer; a count fallen to half gives memory back. When the GPU has no memory for a larger buffer, the limit falls halfway to the size that failed (`limitAfterNoMemory`), not to the old capacity, since the old and new buffers were both alive.
- **Light per speck** (`light.js` `speckLight`): the mobile energy normalisation. A speck may reach `max(24000 / N, 2 · energy / trailNorm)`: twice its light at no trails, growing with the trails as mobile's cap does. The fade per frame is capped at 0.998 (`KEEP_MAX`; the light is rgba16float), so trails last as long at 240 Hz as at 60 Hz.
- **Time in the shaders** (`clock.js` `createShaderClock`): the f32 `time` the sim and draw shaders get starts again from 0 at the first form change after an hour, and at two hours whatever happens, so its steps stay even after a day of play. The composite's grain seed is that time modulo 512 s.
- **Device loss.** On device loss the engine recreates itself once, then calls `onLost`.
- **Presenting.** If presenting fails (for example in headless Chromium, where pending promises reject with "A valid external Instance reference no longer exists"), the engine switches to offscreen only and sets `caps.presenting = false`.

`calibrate.js`:
- `calibrate(engine, { refreshHz, budget = 0.7, timeLimitMs = 10000 })` → `{ particles, results: [{ n, ms }] }`
- Pure helper: `pickParticles(results, refreshHz, budget)`.

`governor.js`: `createGovernor({ min, max, start, refreshHz })` → `{ update(frameMs, now, skipped = false) → particles | null, clamp(n) }`. `clamp(n)` lowers the count and the ceiling to what the engine really draws (main.js calls it when `engine.stats.particles` comes back below what was asked, as after the GPU ran out of memory). It steps down after misses and steps up slowly when there is headroom. A frame the engine skipped (the GPU had two queued) counts as a miss whatever its time, because the display's frames keep coming on time while the GPU falls behind. Pure, and unit-tested.

`shaders/adapt.wgsl`: the flash guard and eye adaptation measure the mean of every texel of the smallest bloom level (one 64-thread workgroup), not a fixed set of sample points, so light counts the same wherever it is on the screen.

### renderer/input/
- **hub.js:**
  - `createHub({ maxPoles = 64 })`.
  - `hub.addPlayer({ kind: 'pointer'|'gamepad'|'phone', name, key })` → `{ id, kind, name, color: [r, g, b], key }`.
  - `hub.removePlayer(id)`, `hub.setPoles(id, poles)`.
  - `hub.poles()` gives the total, capped at maxPoles. Each player keeps at least one pole, then the newest poles win. Every pole has `.player`.
  - `hub.players()`, `hub.on('players', fn)` → off.
  - `PLAYER_COLORS`: 8 colours that stay distinct for colour-blind viewers, and `PLAYER_COLOR_NAMES`. Each player also has `colorName`.
  - A `key` names the source (a pad, a phone's slot): adding a player with a key already playing returns that player, and a key that comes back gets its old colour while it is free.
- **pointer.js:** `createPointer(canvas, { engine, hub, actions })` turns mouse, pen and touch on the desktop window into the "Desk" player's poles. Poles are in world units, with smoothed velocity and a 0.35 s release fade, like mobile. Exposes `.update(dt)` and `.dispose()`.
- **gamepad.js:** `createGamepads({ engine, hub, actions, getSettings, getPads = () => navigator.getGamepads() })`. Exposes `.update(dt, time)` and `.dispose()`. A pad becomes a player at its first button press.
  - **Cursors:** each stick moves a cursor pole across the screen (velocity control with a radial deadzone of 0.15 and a response curve).
  - **Strength:** the trigger on the same side sets the pole's power, and the pole is held while trigger > 0.05.
  - **Buttons:** A pulses at the left cursor, B is the next behaviour, X the next palette and Y surprise. LB and RB step through presets. D-pad up and down change trails, left and right change size. Start toggles the UI and Back toggles the phone panel.
  - **Rumble:** `dual-rumble` on pulses and Nova releases, when `settings.haptics` is on.
  - **Pure helpers for unit tests:** `radialDeadzone(x, y, dz)`, `responseCurve(v, k)`, `readPad(pad)`.
  - **Agreed additions.** Optional `getLead()` (see main.js) and settings `padDeadzone` (0.05..0.4) and `padCurve` (1..3). Clicking a stick latches its cursor down until the next click, for players who cannot keep a trigger pulled. A pad's join press only joins; an unplugged pad keeps its player for 5 s, and a pad left alone for 60 s steps out.
  - **Pads without the standard mapping** may report a trigger as an axis. An axis far over at the join press is taken for a trigger and ignored; after that, an axis that rests past 0.9 for 4 s is a trigger (ignored), and one that rests near the middle for 0.5 s is a stick again.
  - **For the overlay:** `gamepads.cursors()` → `[{ id, player, pad, side: 'left'|'right', x, y, color, colorName, held, latched, power, idle }]`, where x and y are fractions of the window from its top left. A cursor exists even while its trigger is up, which is why the rings read this rather than the hub's poles. `gamepads.pads()` → `[{ pad, name, joined, player, rumble, standard }]`.
- **phone.js:** `createPhones({ bridge, hub, engine, actions })`. Exposes `.update(dt)` and `.dispose()`.
  - **Joining and leaving:** `join` adds a phone player, and `leave` removes it.
  - **Touches** become poles: pad x and y map to the whole canvas (`x * cssW`, `y * cssH`), then go through `engine.screenToWorld`. Velocity is smoothed, a released touch fades out, and `f` sets power.
  - **Actions:** `act` calls the matching action.
  - **Feedback to the phone:** a pulse sends `haptic(30, 0.6)` to its phone, and a change of behaviour or palette broadcasts `state`.
  - **Agreed additions.** Optional `store` (so changes from any input reach the phones) and `getSettings` (`haptics: false` stops the buzzing). A joining phone gets a `state` with its real colour; player-count changes are broadcast. At most one buzz per phone each 60 ms. A leaving phone keeps its player until its light has faded.
  - **Telling the big screen:** a phone that joins or leaves is announced with `actions.toast` ("Phone 2 (Ana) is playing, in sky blue", "Phone 2 (Ana) left").
  - **A join for a slot whose phone is still fading out** may be another phone (the link hands out the lowest free slot): it becomes a player of its own, with its own name, and hears its colour; the old light keeps fading. A join for a phone already playing only re-sends its colour.
  - **Starting over:** at start it asks `bridge.link.info()` and picks up every phone the link still holds (after a renderer crash, main reloads the page, and those phones never join again), quietly. A phone whose join or leave arrives first is left to that event.

### renderer/audio/
- **audio.js:** `createAudio({ bridge })` → `{ source, useMic(deviceId), useSystem(), useFile(fileOrUrl), stop(), devices(), update(dt), features() }`.
  - `source` is `'off'|'mic'|'system'|'file'`.
  - `features()` returns `{ level, bass, mid, high, onset, beat, bpm }`, all 0..1 except bpm.
  - It uses an AnalyserNode (fftSize 2048).
  - A file plays out loud. The microphone and system audio are only analysed, never played back.
  - Also `label`, `error` and `hint` (plain words for the Sound panel), `on('change', fn)` → off, and `devices({ reveal })` → `[{ deviceId, label, monitor }]`. A later choice always wins over a slower earlier one.
- **features.js:** `createFeatureTracker({ sampleRate, fftSize })` → `.update(dbBins, dt)` → features. Pure.
  - **Bands:** bass 20–150 Hz, mid 150–2k, high 2k–12k.
  - **Gain:** adaptive, from a slowly decaying peak.
  - **Onsets:** spectral flux against an adaptive threshold (median + k·MAD over about 1 s), with a 100 ms refractory period.
  - **Beat and bpm:** from a histogram of onset intervals, 60–180 bpm.

### renderer/ui/ui.js
`createUI({ root, store, actions, bridge, engine, audio, hub, desktop })` → `{ toggle(), isOpen(), toast(text), showPhonePanel(on), dispose() }`.
It also takes `gamepads`, `cursorCanvas`, `test`, `particlesFixed` and `refreshHz()` (the display's rate, for the tier), and returns `open(name)`, `close()`, `panel`, `update(dt)` (each frame), `measuring(on)`, `showIntro()`, `syncFullscreen(on)`, `hidden`, `idle` and `cursors` (the rings drawn last frame).
- **Gamepad cursor rings** are drawn on `#cursors`, a 2D canvas over the light, from `gamepads.cursors()`; they are not in the engine's picture. Each ring is in its player's colour and carries its name ("Pad 1 L"), kept whole inside the window.
- **Gamepads waiting to join:** each pad in `gamepads.pads()` that has not joined is asked, near the bottom of the window, "Gamepad 2: press any button to join." (a polite live region), with a note when its mapping is not `standard` that its buttons may be in other places than the Gamepad list in Settings shows. A newly waiting pad wakes the controls; the prompt fades with them when idle.
- **The first-run hint** shows the gamepad's row with the gamepad icon ("Play with a gamepad: press any button to join in"), not as a key. Hiding the controls says "Press H, or Start on a gamepad, to show them again."
- **Corner buttons:** Phone, Sound, Settings and Fullscreen. The UI hides itself after 4 s idle and comes back on any input.
- **Phone panel:** the QR code, the URL as text, the players in their colours, the allow-new toggle, and a "New code" button.
  - Each phone the link holds has a Remove button ("Remove Phone 2 (Ana)"). It asks first, with "Keep playing" focused; "Remove Phone 2 (Ana) for good" calls `bridge.link.kick(slot)`, shows the new code and says so in a toast.
  - When nobody has joined 45 s after it opened, the "Phone cannot connect?" help opens by itself, the panel's body scrolls to it, and a toast says so.
- **Sound panel:** Off, Microphone, Computer audio (shown only where supported), Music file (picker and drag-and-drop), and a device chooser.
- **Settings panel:** particles (auto or manual), "Measure again" (calibration), HDR (auto/on/off), flash guard, team colours, haptics, force WebGPU (needs a restart), and the GPU information.
  - Next to the particle count, the requirement tier of `docs/design.md` that the measured count meets (`ui/tier.js` `requirementTier({ particles, refreshHz })`: the count is weighed by the refresh rate against the tiers' 60 Hz figures, so 15M at 144 Hz is Ultra), or "Not measured yet".
  - The Keys list names F11 with F. A corner button with no shortcut has no `aria-keyshortcuts`.
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
  | S | sound panel |
  | B, Shift+B | next or previous behaviour |
  | N | surprise |
  | F11 | fullscreen |

### phone/ (served to phones; no external resources)
`index.html`, `phone.css` and `phone.js` make one full-screen touch pad (`touch-action: none`, no zoom or scroll).
- **Screen:** the status (connecting, playing as Player N in its colour, or disconnected) and a row of buttons: behaviour ◀ ▶, palette, surprise and pulse.
- **Connecting:** the page reads the token from `location.hash` (`k=`), sends `hello`, and reconnects with backoff. It reads it again on `hashchange`: a new address typed into the same tab changes only the fragment, and a page not playing then starts again with the new code, whatever it was told about the old one.
- **Sending touches:** at most one `touch` frame per animation frame (≤ 120 Hz), and an empty frame when the last finger lifts. Touch ids go round 0..255 (`pad.js` `createSlots`), so a finger that lands just after another lifted never shares its id.
- **Removed:** a `reject('removed')` says the phone was removed on the computer, and the page does not knock again.
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
- **Integration scenarios** (`tests/e2e/scenarios-integration.js`) play every input together: two phones, a gamepad, the mouse and a music file.
- **Electron smoke test:** `xvfb-run -a npx electron . --smoke` (in CI, and locally where Xvfb exists). Chromium will not start as root with its sandbox on; run it as an ordinary user, or add `--no-sandbox` only in a throwaway container.

## Ownership

| Part | Files |
|---|---|
| spine | `package.json`, `tools/**`, `tests/e2e/run.js`, `tests/e2e/helpers.js`, `tests/e2e/scenarios.js`, `tests/unit/wgsl.test.js`, `README.md` |
| engine | `src/renderer/engine/**`, `tests/unit/engine-*.test.js`, `tests/e2e/scenarios-engine.js` |
| link | `src/shared/**`, `src/main/link-server.js`, `src/main/qr.js`, `src/phone/**`, `src/renderer/input/phone.js`, `tests/unit/{protocol,lan,link}*.test.js`, `tests/e2e/scenarios-phone.js` |
| input-audio | `src/renderer/input/{hub,pointer,gamepad}.js`, `src/renderer/audio/**`, `src/main/audio-capture.js`, `tests/unit/{hub,gamepad,features}*.test.js`, `tests/e2e/scenarios-input.js` |
| shell-ui | `src/main/{main,window,settings}.js`, `src/preload/**`, `src/renderer/{main,bridge}.js`, `src/renderer/ui/**`, `src/classic/**`, `src/renderer/index.html`, `src/renderer/style.css`, `electron-builder.yml`, `.github/workflows/tactilume-desktop.yml`, `tests/unit/{settings,ui}*.test.js`, `tests/e2e/scenarios-app.js` |
| integration | `tests/e2e/scenarios-integration.js`, `tests/e2e/scenarios-polish.js`; it may fix any file above at its root, keeping this file true |

The spine also writes a first version of every file above. Each one is a stub that matches its contract, so the build and the tests run from day one. The owners then replace them.
