# Module contracts

`main.js` owns the frame loop and wires the modules together. A module never imports
`main.js` and never reaches into another module: it gets what it needs as arguments.
Each module below is one factory function returning one object.

All coordinates handed between modules are **world units** unless named otherwise:
the plane `z = 0`, `y` from -1 (bottom of the screen) to 1 (top), `x` from `-aspect` to
`aspect` where `aspect = width / height`. CSS pixels are called `px`.

Time is in seconds. `dt` is already clamped by `main.js` to at most 1/20 s.

---

## core/ (pure, no DOM; unit-tested with `node --test`)

- `util.js`: `clamp lerp smoothstep approach lerpLog mulberry32 createEmitter`.
- `behaviours.js`: `BEHAVIOURS [{id,key,name,blurb}]`, `BEHAVIOUR_KEYS`, `behaviourByKey`,
  `behaviourById`, `MAX_FINGERS = 10`, `DEFAULT_CHORDS`, `behaviourFor(scene, fingers)`.
- `palettes.js`: `PALETTES [{key,name,stops,safe?}]`, `PALETTE_KEYS`, `paletteIndex`,
  `samplePalette`, `bakeLUT(width)`, `paletteCSS(p)`.
- `scene.js`: `SCHEMA`, `SETTINGS_SCHEMA` (each field `{key, type, def, min?, max?, step?,
  options?, group?, label, help?, hidden?}`; types `num int bool enum str chords`),
  `DEFAULT_SCENE`, `DEFAULT_SETTINGS`, `SCENE_FIELDS`, `SETTINGS_FIELDS`, `cleanValue`,
  `sanitizeScene`, `sanitizeSettings`, `diffKeys`, `encodeScene`, `decodeScene`,
  `sceneCodeFromHash`, `FORMS`, `COLOR_BY`.
- `presets.js`: `PRESETS [{key,name,blurb,scene}]`, `PRESET_KEYS`, `DEFAULT_PRESET`,
  `presetByKey`, `presetScene(key)`.
- `store.js`: `createStore({storage, initialScene})` →
  - `store.scene`, `store.settings`: frozen; replaced on every change. Read, never mutate.
  - `store.setScene(partial, {replace, source})` → changed keys; emits
    `'scene' (scene, changedKeys, source)`.
  - `store.setSettings(partial, {source})` → changed keys; emits `'settings' (settings, changedKeys, source)`.
  - `store.resetSettings()`, `store.userScenes()`, `store.saveUserScene(name)`,
    `store.deleteUserScene(id)` (emits `'user' (list)`), `store.shareCode()`,
    `store.loadShareCode(code)`, `store.flush()`, `store.on(name, fn)` → `off()`.
- `poles.js`: `MAX_POLES = 32`, `expandPoles(poles, {symmetry, mirror, virtualFingers, time})`,
  `fingerCount(poles, virtualFingers)`, `constellation`, `symmetrise`.
- `governor.js`: `createGovernor({maxParticles, startParticles, mode})`, `guessTier(...)`,
  `TIERS`, `estimateRefresh(intervals)`.

### Pole

```js
{ x, y,          // world units, on the plane z = 0
  vx, vy,        // world units per second, smoothed
  power,         // 0..2: pressure or contact size; 1 for a mouse or a key
  age,           // seconds since it went down
  held,          // true while pressed; a released pole is kept briefly with held = false
  id,            // stable string for the life of the touch
  kind,          // 'touch' | 'pin' | 'auto' | 'virtual' | 'mirror'
  fade }         // optional 0..1: 1 while held, falls to 0 over the 0.35 s after release
                 // (autoplay: equals power). The engine smooths weights by id itself.
```

A released touch keeps its flick velocity and glides while it fades.

---

## gfx/engine.js — `createEngine(canvas, opts)`

Throws `Error('webgl2')` when WebGL2 is missing. `opts`: `{ maxParticles, onLost, onRestored }`.

- `engine.caps` → `{ maxParticles, tier, renderer, halfFloat }`
- `engine.resize(cssWidth, cssHeight, dpr)`
- `engine.setQuality({ particles, renderScale })`
- `engine.frame(f)` where `f = { dt, time, scene, settings, poles, behaviour: {a, b, mix},
  audio: {level, bass, mid, high, onset}, gravity: {x, y, z}, fingers }`
- `engine.pulse(x, y, power)`: a ring of light at a touch (world units).
- `engine.release(x, y, power, heldFor)`: a touch was lifted (Nova lets go here).
- `engine.screenToWorld(px, py)` → `{x, y}`; `engine.worldToScreen(x, y)` → `{px, py}`.
- `engine.aspect` (width / height).
- `engine.capture(mime = 'image/png')` → `Promise<Blob>` of the next frame.
- `engine.captureStream(fps)` → `MediaStream` of the canvas.
- `engine.stats` → `{ particles, renderScale, width, height }`.
- `engine.health` → `{ checks, heals, lastIssue, issues }`: a background check (every ~90
  frames, read through a fence so the GPU never waits) that repairs NaN particles or a broken
  brightness state.
- `engine.diagnose()` → the Device check's facts (GPU, limits, particles, brightness state).
  Slow; on demand only. `engine.inspect(n)`, `engine.reset()` and `engine._poison()` are for
  tests and debugging.
- `engine.dispose()`.

Shader rules (enforced by tests/unit/shaders.test.js), because phone GPUs are stricter than
the software renderer the browser tests use: no `isnan()`/`isinf()` (compilers may drop them;
use `badf()`/`bad3()`), and `pow()` only on a base listed there as never negative.

---

## input/

### input/pointers.js — `createPointers(target, { screenToWorld, getSettings })`

`target` is the canvas. Handles Pointer Events for touch, pen and mouse; stops the
browser's own gestures (scroll, zoom, text selection, callouts, context menu).

- `pointers.update(dt)`: ages poles, smooths velocity, drops released poles after 0.35 s.
- `pointers.poles()` → `Pole[]`: live touches, pinned touches, and released ones fading out.
  Not symmetry-expanded, no virtual fingers (main does that with `core/poles.js`).
- `pointers.active()` → number of touches pressed right now (not pins).
- `pointers.clearPins()`.
- `pointers.on(name, fn)` → `off()`; events:
  - `'down' {x, y, power, id, kind}` — `kind` is `'touch'` or `'pin'`.
  - `'up' {x, y, vx, vy, power, heldFor, id}`
  - `'activity' ()` — any input at all (resets the autoplay idle timer).
- `pointers.dispose()`.
- Extras: `pinCount()`, `target`, `clientToWorld(clientX, clientY)` (the engine's mapping,
  camera included), and `relay(name, payload)`, which the keyboard uses so key presses
  pulse, chime and vibrate exactly like touches.
- Held touches are re-cast from their screen position every frame, so the light stays under
  a resting finger while the camera drifts. Pins stay fixed in world space.
- Pins: lifting a touch that becomes a pin emits no `'up'` (the pin keeps holding); tapping
  a pin away emits `'up'` for the pin; `clearPins()` and switching pinning off fade pins
  without an `'up'`.
- Rules: `pointercancel` counts as `'up'`. Pressure: use `e.pressure` for pens and
  touches that report it (not 0 / 0.5 defaults); else contact size when reported; else 1.
  When `settings.pin` is on, lifting a touch leaves a `'pin'` pole; tapping within 0.08
  world units of a pin removes it. Never more than 10 live touches + 10 pins.

### input/keyboard.js — `createKeyboard({ store, actions, pointers })`

Desktop and switch access. Keys (ignored while focus is in a text field):
`Space` add/remove a pole at the screen centre (or at the mouse when over the canvas),
`1`–`9`, `0` (ten): play that many fingers at the mouse/centre (held while the key is down),
`H` hide/show the controls, `P` photo, `R` record, `S` symmetry +1 (wraps at 12),
`M` mirror on/off, `[` and `]` previous/next preset, `N` surprise me, `A` autoplay on/off,
`F` fullscreen, `Esc` close the panel or show it. Arrow keys move the keyboard pole.
Exposes `keyboard.poles()` → `Pole[]` (kind `'touch'`, id prefix `'k'`), `keyboard.dispose()`.

### input/autopilot.js — `createAutopilot({ seed })`

Plays by itself: 1–5 poles on slow, smooth, non-repeating paths that stay on screen.

- `autopilot.update(dt, time, aspect)` → `Pole[]` (kind `'auto'`, ids `'a0'…`). Poles appear
  and disappear one at a time (never more than one change per 4 s), so the behaviour
  table changes gracefully. Paths use sums of sines with seeded irrational ratios.
- `autopilot.reset()`.

### input/tilt.js — `createTilt()`

- `tilt.enable()` → `Promise<boolean>` (asks permission where the browser requires it;
  must be called from a tap). `tilt.disable()`.
- `tilt.vector()` → `{x, y, z}` world-space gravity direction, unit length, smoothed;
  `{0, -1, 0}` when off. Screen rotation is accounted for.

---

## audio/audio.js — `createAudio({ getSettings })`

Nothing makes a sound until settings say so. No microphone prompt unless the person
picks the microphone.

- `audio.unlock()`: call from inside a user gesture; creates/resumes the AudioContext
  when sound or reactivity is on.
- `audio.update(dt, { poles, fingers, behaviour, scene })`: drives the generative voices.
- `audio.noteDown({x, y, power})`, `audio.noteUp({x, y, vx, vy, heldFor})`,
  `audio.behaviourChanged(key)`.
- `audio.analysis()` → `{ level, bass, mid, high, onset }`, each 0..1 (all 0 when off).
- `audio.startMic()` → `Promise<{ok, error?}>`, `audio.stopMic()`.
- `audio.playFile(file)` → `Promise<{ok, error?}>`, `audio.stopFile()`, `audio.fileName`.
- `audio.recordTrack()` → `MediaStreamTrack | null`: a copy of what the app plays (instrument
  and song, never the microphone). Stop it when the recording ends: a live copy keeps the
  sound system awake.
- `audio.state()` → `{ context: 'none'|'suspended'|'running', mic, file }`, for the UI.
- `audio.dispose()`.
- The module adds its own capture listeners for `pointerup`, `touchend`, `click` and
  `keydown`: a touch's `pointerdown` does not count as a user gesture on Android Chrome or
  iOS Safari, so unlocking on it alone would miss the first touch.
- `audio._debug` is a test seam (`feed(node)` lets `analysis()` run on a test signal).

---

## platform/platform.js — `createPlatform()`

Hides the difference between a browser tab and the Android app.

- `platform.native` (bool), `platform.info` → `{ native, version?, sdk?, device? }`.
- `platform.saveFile(blob, name, mime)` → `Promise<{ok, where?, error?}>`.
- `platform.shareFile(blob, name, mime, text)` → `Promise<{ok, error?}>`.
- `platform.shareLink(url, text)` → `Promise<{ok, copied?, error?}>`.
- `platform.vibrate(ms)`, `platform.keepAwake(on)`.
- `platform.canFullscreen()`, `platform.isFullscreen()`, `platform.setFullscreen(on)`.
- `platform.onBack(fn)` → `off()`: Android back; `fn()` returns true (or a promise of true)
  when it handled it.
- Extras: `platform.ready` (a promise of `info`, after the app's hello or 1 s),
  `platform.open(url)` → bool, `platform.onFullscreenChange(fn)` → `off()`;
  `setFullscreen(on)` returns `Promise<boolean>`. In a browser `where` is `'downloads'`.
  A share the person dismissed returns `{ ok: false, error: 'cancelled' }`.

Android bridge (WebView, `WebViewCompat.addWebMessageListener`, object name
`TactilumeNative`, allowed origin `https://appassets.androidplatform.net` only). JSON
string messages, page to app:
`{t:'hello'}`, `{t:'begin', id, name, mime, size?}`, `{t:'chunk', id, seq?, data}` (base64,
≤ 512 KiB; the app checks `seq` when present and refuses a declared size over 512 MB),
`{t:'end', id, action: 'save'|'share', text?}`, `{t:'abort', id}`, `{t:'vibrate', ms}` (the
app clamps to 1..60 ms), `{t:'awake', on}`, `{t:'open', url}` (https only, opens the browser).
App to page (`reply` on the listener's proxy): `{t:'hello', version, sdk, device, webview?}`,
`{t:'done', id, ok, where?, error?}` (for `'share'` the file is saved first; if the share
sheet cannot open, `done` is `{ok:false, where, error}`), `{t:'back'}` (Back was pressed;
the page answers `{t:'back', handled}`).
Files go one at a time; the page queues transfers.

Safe areas: when the device has a display cutout, the app may set `--safe-t`, `--safe-r`,
`--safe-b` and `--safe-l` inline on `<html>` (not every WebView reports cutouts to `env()`).
style.css therefore defines those four on `:root`, never on a descendant.

## capture/capture.js — `createCapture({ engine, audio, platform })`

- `capture.photo()` → `Promise<{ok, where?, error?}>` (PNG, saved through the platform).
- `capture.startRecording({ maxSeconds = 60, withSound = true })` → `{ok, error?}`.
- `capture.stopRecording()` → `Promise<{ok, where?, error?}>`.
- `capture.recording` (bool), `capture.elapsed` (s), `capture.mime`.
- `capture.on('state', fn)` → `off()`; state `{ recording, elapsed, paused, limit }`.
- `capture.on('finished', (result, reason))`: after any clip ends and is saved; `reason` is
  `'stopped' | 'limit' | 'ended' | 'error'`. The UI shows recording results from this.
- `capture.saving` (bool). Recording pauses while the page is hidden.

---

## ui/ui.js — `createUI({ root, store, actions, platform, audio, capture })`

All DOM for controls lives under `root` (`#ui`). Text from scenes is inserted as text,
never as HTML.

- `ui.update(dt, { fingers, behaviour, fps, particles, recording, autopilot })`
- `ui.showBehaviour(behaviour)`: brief name card when the behaviour changes.
- `ui.toast(text)`, `ui.announce(text)` (screen-reader live region, rate-limited).
- `ui.open(tab?)`, `ui.close()`, `ui.isOpen()`, `ui.back()` → bool, `ui.setHidden(bool)`.
- `ui.hidden`, `ui.tab`, and `ui.run.photo() / record() / shareLink()`: the actions with their
  results shown as toasts (the keyboard goes through these).

`actions` (from main): `loadPreset(key)`, `stepPreset(delta)`, `surprise()`, `photo()`,
`toggleRecord()`, `shareLink()`, `clearPins()`, `resetScene()`, `toggleFullscreen()`,
`toggleUI()`, `setReact(mode, file?)`, `enableTilt()`, `unlock()`, `toggleAutopilot()`.

---

## Test hook (main.js → `window.TACTILUME`)

`?test=1` starts deterministically: intro seen, autoplay off, haptics off, governor at
'max' (frozen when `?particles=N` is given). The browser tests rely on `version`, `ready`
(true after two frames), `test`, `frames`, `fingers`, `behaviour` (`{a, b, mix}`; `b` is a
behaviour key), `store`, `engine` (`stats`, `inspect()`, `reset()`), `pointers` (`active()`,
`poles()`), `capture`, `ui` (`isOpen()`), `tilt` and `actions` (`photo`, `loadPreset`).
Renaming or removing any of these breaks the browser tests.
