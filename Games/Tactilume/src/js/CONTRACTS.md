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
  kind }         // 'touch' | 'pin' | 'auto' | 'virtual' | 'mirror'
```

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
- `engine.dispose()`.

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
- `audio.recordTrack()` → `MediaStreamTrack | null`: what the app plays, for recordings.
- `audio.dispose()`.

---

## platform/platform.js — `createPlatform()`

Hides the difference between a browser tab and the Android app.

- `platform.native` (bool), `platform.info` → `{ native, version?, sdk?, device? }`.
- `platform.saveFile(blob, name, mime)` → `Promise<{ok, where?, error?}>`.
- `platform.shareFile(blob, name, mime, text)` → `Promise<{ok, error?}>`.
- `platform.shareLink(url, text)` → `Promise<{ok, copied?, error?}>`.
- `platform.vibrate(ms)`, `platform.keepAwake(on)`.
- `platform.canFullscreen()`, `platform.isFullscreen()`, `platform.setFullscreen(on)`.
- `platform.onBack(fn)`: Android back; `fn()` returns true when it handled it.

Android bridge (WebView, `WebViewCompat.addWebMessageListener`, object name
`TactilumeNative`, allowed origin `https://appassets.androidplatform.net` only). JSON
string messages, page to app:
`{t:'hello'}`, `{t:'begin', id, name, mime}`, `{t:'chunk', id, data}` (base64, ≤ 512 KiB),
`{t:'end', id, action: 'save'|'share', text?}`, `{t:'abort', id}`, `{t:'vibrate', ms}`,
`{t:'awake', on}`, `{t:'open', url}` (https only, opens the browser).
App to page (`reply` on the listener's proxy): `{t:'hello', version, sdk, device}`,
`{t:'done', id, ok, where?, error?}`, `{t:'back'}` (Back was pressed; page answers
`{t:'back', handled}`).

## capture/capture.js — `createCapture({ engine, audio, platform })`

- `capture.photo()` → `Promise<{ok, where?, error?}>` (PNG, saved through the platform).
- `capture.startRecording({ maxSeconds = 60, withSound = true })` → `{ok, error?}`.
- `capture.stopRecording()` → `Promise<{ok, where?, error?}>`.
- `capture.recording` (bool), `capture.elapsed` (s), `capture.mime`.
- `capture.on('state', fn)` → `off()`; state `{ recording, elapsed }`.

---

## ui/ui.js — `createUI({ root, store, actions, platform, audio, capture })`

All DOM for controls lives under `root` (`#ui`). Text from scenes is inserted as text,
never as HTML.

- `ui.update(dt, { fingers, behaviour, fps, particles, recording, autopilot })`
- `ui.showBehaviour(behaviour)`: brief name card when the behaviour changes.
- `ui.toast(text)`, `ui.announce(text)` (screen-reader live region, rate-limited).
- `ui.open(tab?)`, `ui.close()`, `ui.isOpen()`, `ui.back()` → bool, `ui.setHidden(bool)`.

`actions` (from main): `loadPreset(key)`, `surprise()`, `photo()`, `toggleRecord()`,
`shareLink()`, `clearPins()`, `resetScene()`, `toggleFullscreen()`, `toggleUI()`,
`setReact(mode, file?)`, `enableTilt()`, `unlock()`, `toggleAutopilot()`.
