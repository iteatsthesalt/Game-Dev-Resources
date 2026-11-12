// Boots Tactilume and runs the frame loop. This is the only file that knows about
// every module; see CONTRACTS.md for what each one promises.

import { clamp, approach } from './core/util.js';
import { behaviourFor, behaviourByKey } from './core/behaviours.js';
import { sceneCodeFromHash, decodeScene } from './core/scene.js';
import { PRESETS, DEFAULT_PRESET, presetScene } from './core/presets.js';
import { createStore } from './core/store.js';
import { expandPoles, fingerCount } from './core/poles.js';
import { createGovernor, guessTier, TIERS } from './core/governor.js';
import { surpriseScene } from './core/surprise.js';
import { createEngine } from './gfx/engine.js';
import { createPointers } from './input/pointers.js';
import { createKeyboard } from './input/keyboard.js';
import { createAutopilot } from './input/autopilot.js';
import { createTilt } from './input/tilt.js';
import { createAudio } from './audio/audio.js';
import { createPlatform } from './platform/platform.js';
import { createCapture } from './capture/capture.js';
import { createUI } from './ui/ui.js';

export const VERSION = '1.0.0';

const params = new URLSearchParams(location.search);
// ?test: deterministic start for the automated tests (no intro, no autoplay, fixed seed)
const TEST = params.has('test');
const forcedParticles = params.has('particles') ? clamp(parseInt(params.get('particles'), 10) || 0, 1024, 1 << 22) : 0;
const reducedMotionQuery = matchMedia('(prefers-reduced-motion: reduce)');
const LOST_NOTICE_MS = 4000;  // a lost graphics context that has not come back by then is reported
const MAX_FRAME_ERRORS = 600; // frames failing in a row (about 10 s) before the loop gives up
const SILENCE = Object.freeze({ level: 0, bass: 0, mid: 0, high: 0, onset: 0 });

// A full-screen message for when the light cannot be shown; `action` ({label, onClick})
// adds one button, and `report` a block of plain text to copy into a message.
function showFatal(title, detail, action, report) {
  const el = document.getElementById('fatal');
  el.hidden = false;
  el.replaceChildren();
  const h = document.createElement('h1');
  h.textContent = title;
  const p = document.createElement('p');
  p.textContent = detail;
  el.append(h, p);
  if (report) {
    const pre = document.createElement('pre');
    pre.className = 'fatal-report';
    pre.textContent = report;
    el.append(pre);
  }
  if (action) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'fatal-btn';
    b.textContent = action.label;
    b.addEventListener('click', action.onClick);
    el.append(b);
    b.focus({ preventScroll: true });
  }
}

// Copies the fatal message's report; where the clipboard is refused, selects it instead.
async function copyReport(button) {
  const pre = document.querySelector('#fatal .fatal-report');
  if (!pre) return;
  let ok = false;
  try { await navigator.clipboard.writeText(pre.textContent); ok = true; } catch { /* below */ }
  if (!ok) {
    const range = document.createRange();
    range.selectNodeContents(pre);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
  button.textContent = ok ? 'Copied' : 'Selected: copy it from here';
}

// The graphics would not start. Only a missing WebGL 2 is called that: a GPU that has it but
// refuses a shader (as some phone compilers do) gets its real error and its name, to send on.
// Inside the Android app no other browser can be picked, so the advice there is to update.
function showStartFailure(e, canvas, native) {
  const advice = native
    ? 'Update Android System WebView and Chrome from the Play Store, then open Tactilume again.'
    : 'An up-to-date Chrome, Edge, Firefox or Safari will work.';
  if (e && e.message === 'webgl2') {
    showFatal('This device cannot draw Tactilume', `Tactilume needs WebGL 2, which ${native ? 'this device' : 'this browser'} does not offer, or has switched off. ${advice}`);
    return;
  }
  let gpu = '?';
  try {
    const gl = canvas.getContext('webgl2');
    const dbg = gl && gl.getExtension('WEBGL_debug_renderer_info');
    if (gl) gpu = `${gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER)} | ${gl.getParameter(dbg ? dbg.UNMASKED_VENDOR_WEBGL : gl.VENDOR)}`;
  } catch { /* the context itself may be broken; the error says enough then */ }
  const report = [
    `Tactilume ${VERSION}${native ? ' (Android app)' : ''}`,
    // the error's first lines: a compile failure's name, then the start of the GPU's own log
    `Error: ${String((e && e.message) || e).split('\n').filter((l) => l.trim()).slice(0, 3).join('\n').slice(0, 400)}`,
    `GPU: ${gpu}`,
    `Device: ${navigator.userAgent}`,
  ].join('\n');
  showFatal('The light could not start on this device\'s graphics',
    `The graphics refused part of Tactilume. ${native ? advice : 'Updating the browser may help.'} If it still fails, these details help find out why:`,
    { label: 'Copy the details', onClick: (ev) => copyReport(ev.currentTarget) },
    report);
}

function hideFatal() {
  const el = document.getElementById('fatal');
  el.hidden = true;
  el.replaceChildren();
}

// Calm mode (or the system asking for less motion) softens the scene the engine sees;
// the scene itself, and so share links, stay as they are.
function effectiveScene(scene, settings) {
  const calm = settings.calm;
  const reduce = reducedMotionQuery.matches;
  if (!calm && !reduce) return scene;
  const k = calm ? 1 : 0.5;
  return {
    ...scene,
    speed: scene.speed * (1 - 0.45 * k),
    strength: scene.strength * (1 - 0.3 * k),
    orbit: scene.orbit * (1 - k),
    exposure: scene.exposure - 0.6 * k,
    sparkle: scene.sparkle * (1 - 0.8 * k),
    aberration: scene.aberration * (1 - k),
    glow: scene.glow * (1 - 0.25 * k),
  };
}

// Drops "#s=..." from the address without a new history entry (and without hashchange).
function forgetLinkCode() {
  try { history.replaceState(history.state, '', location.href.split('#')[0]); } catch { /* file:// in some browsers */ }
}

function boot() {
  const canvas = document.getElementById('stage');
  const uiRoot = document.getElementById('ui');

  const code = sceneCodeFromHash(location.hash);
  const linked = code ? decodeScene(code) : null;
  const store = createStore();
  // A link's scene is played and saved like any other change, then the code leaves the
  // address, so a later reload keeps whatever the person has done since.
  if (linked) store.setScene(linked, { replace: true, source: 'link' });
  if (code) forgetLinkCode();
  if (!linked && !store.hadSavedScene) store.setScene(presetScene(DEFAULT_PRESET), { replace: true, source: 'preset' });
  if (TEST) store.setSettings({ introSeen: true, autopilot: 'off', haptics: false });
  // a microphone or a song never survives a reload, so neither may the setting that says it is on
  if (store.settings.react !== 'off') store.setSettings({ react: 'off' }, { source: 'boot' });

  // before the graphics, so a failure to start them can give the app's own advice
  const platform = createPlatform();

  // ---- graphics -------------------------------------------------------------
  // A lost graphics context normally comes back within moments. One that does not (or
  // whose rebuild fails), and a frame that keeps failing, stop the light: then say so and
  // offer a fresh start. The scene and settings are saved first, so nothing is lost.
  let lostTimer = 0;
  let contextLost = false;
  let stopNotice = false; // the "light stopped" message is on screen
  // Only counted while the page is in sight: a phone may drop the context of an app in the
  // background and give it back on return, which is no reason for a message.
  function watchLostContext() {
    clearTimeout(lostTimer);
    lostTimer = contextLost && !document.hidden && !stopNotice ? setTimeout(lightStopped, LOST_NOTICE_MS) : 0;
  }
  document.addEventListener('visibilitychange', watchLostContext);
  function lightStopped() {
    clearTimeout(lostTimer);
    lostTimer = 0;
    running = false;
    try { store.flush(); } catch (e) { console.warn('Tactilume: could not save before stopping', e); }
    stopNotice = true;
    showFatal('The light stopped', 'The graphics on this device stopped drawing. Your scene and settings are kept.', {
      label: 'Start the light again',
      onClick: () => location.reload(),
    });
  }
  let engine;
  try {
    engine = createEngine(canvas, {
      maxParticles: forcedParticles || 0,
      onLost: () => {
        running = false;
        contextLost = true;
        watchLostContext();
      },
      onRestored: () => {
        contextLost = false;
        watchLostContext();
        // it came back after all
        if (stopNotice) { stopNotice = false; hideFatal(); }
        frameErrors = 0;
        lightErrors = 0;
        running = true;
        schedule();
      },
      onRestoreFailed: () => lightStopped(),
    });
  } catch (e) {
    console.warn(e);
    showStartFailure(e, canvas, platform.native);
    return;
  }

  const caps = engine.caps;
  const tier = caps.tier;
  const tierInfo = TIERS[tier] || TIERS.mid;
  const governor = createGovernor({
    maxParticles: caps.maxParticles,
    startParticles: forcedParticles || tierInfo.start,
    mode: TEST ? 'max' : store.settings.quality,
    startScale: tier === 'low' ? 0.75 : 1,
  });
  if (forcedParticles) governor.freeze(true);
  // a saved 'Best' starts at full detail, as choosing it in Settings does
  else if (!TEST && governor.mode === 'max') governor.setMode('max');
  const capOf = (s) => (s.fpsCap === '30' ? 30 : s.fpsCap === '60' ? 60 : 0);
  governor.setCap(capOf(store.settings));
  // in the Android app the screen's refresh rate follows the cap (see platform.setFrameCap)
  platform.setFrameCap(capOf(store.settings));
  engine.setQuality({ particles: governor.particles, renderScale: governor.renderScale });

  // ---- everything else -----------------------------------------------------
  let ui = null;
  const audio = createAudio({
    getSettings: () => store.settings,
    native: platform.native,
    // the microphone or song stopped by itself: say so, and stop claiming it is on
    onSourceEnded: (kind) => {
      store.setSettings({ react: 'off' }, { source: 'audio' });
      if (ui) ui.toast(kind === 'mic' ? 'The microphone stopped' : 'The song stopped');
    },
  });
  const pointers = createPointers(canvas, { screenToWorld: (px, py) => engine.screenToWorld(px, py), getSettings: () => store.settings });
  const autopilot = createAutopilot({ seed: TEST ? 7 : (Date.now() & 0xffffff) });
  const tilt = createTilt();
  // Tilt switched on last time: try to start it again. Android needs no tap for that; where
  // a browser does (iOS), the attempt fails and the setting honestly turns off.
  if (store.settings.tilt) {
    tilt.enable().then((ok) => { if (!ok && store.settings.tilt) store.setSettings({ tilt: false }, { source: 'boot' }); });
  }
  const capture = createCapture({ engine, audio, platform });

  // A clip's video cannot change size halfway: an MP4 player loses the picture from there
  // on. So before the drawing changes size (a phone turned, split screen), a
  // recording ends and is saved. The recorder stops at once, before a frame of the new size.
  //
  // The on-screen keyboard is not a new shape for the light: it shrinks the window in the
  // Android app (and the visual viewport in some browsers), and a new aspect would re-frame
  // the light and wipe its trails, once as it opens and again as it closes. So the size is
  // the layout viewport's, and while a text field has focus a window that only got shorter
  // keeps the drawing as it is (the canvas keeps its size; the keyboard covers its bottom).
  // Letting go of the field catches up with whatever the window is by then.
  let drawn = null; // the size last given to the engine
  function typing() {
    const a = document.activeElement;
    if (!a) return false;
    if (a.isContentEditable || a.tagName === 'TEXTAREA') return true;
    return a.tagName === 'INPUT' && !/^(button|checkbox|radio|range|color|file|submit|reset|image|hidden)$/i.test(a.type || '');
  }
  function resize() {
    const w = Math.round(innerWidth);
    const h = Math.round(innerHeight);
    if (drawn && typing() && w === drawn.w && h < drawn.h) return;
    drawn = { w, h };
    const ratio = Math.min(window.devicePixelRatio || 1, tier === 'ultra' ? 2 : tier === 'low' ? 1.25 : 2);
    if (capture.recording && engine.changesSize(w, h, ratio)) {
      // the result is shown by the UI's 'finished' listener, like every other clip's
      capture.stopRecording().catch((e) => console.warn('Tactilume: the clip could not be finished', e));
      if (ui) ui.toast('The screen changed shape, so the recording stopped there.');
    }
    engine.resize(w, h, ratio);
  }
  resize();
  addEventListener('resize', resize);
  window.visualViewport?.addEventListener('resize', resize);
  // typing ended (the keyboard is going): catch up with the window, after focus has moved on
  addEventListener('focusout', () => setTimeout(resize, 0), true);

  // A Quality change resizes the drawing too, so during a recording it waits for the end
  // (the governor holds still while recording anyway).
  let qualityHeld = false;
  function applyQuality() {
    if (capture.recording) { qualityHeld = true; return; }
    qualityHeld = false;
    engine.setQuality({ particles: governor.particles, renderScale: governor.renderScale });
  }
  capture.on('state', (st) => { if (qualityHeld && !(st && st.recording)) applyQuality(); });

  let uiHidden = false;
  let presetCursor = Math.max(0, PRESETS.findIndex((p) => p.name === store.scene.name));
  // nobody has touched yet: autoplay starts at once, so the app opens already alive
  let lastActivity = -Infinity;
  // when a person last did anything (unlike lastActivity, this one starts now): the screen
  // is only kept awake for a while after that, so an unattended phone can still sleep
  let personAt = performance.now();
  let autopilotForced = false;  // A turned autoplay on before the idle wait was over
  let autopilotPaused = false;  // A turned it off; the next touch or A clears this
  let autoShown = false;        // autoplay was what was on screen last frame
  let due = 0;                  // with a frame-rate cap: when the next frame may be drawn
  let toldRepairs = false;      // the engine's repeated self-repairs were mentioned
  let awake = null;             // whether the screen is being kept on right now
  let tiltTicket = 0;           // the latest tilt choice (see enableTilt)
  let personHolds = false;      // last frame, a touch, pin or key of the person's was down
  let frameErrors = 0;          // frames in a row that hit an exception
  let lightErrors = 0;          // frames in a row in which the light itself could not draw

  const actions = {
    loadPreset(key) {
      const i = PRESETS.findIndex((p) => p.key === key);
      if (i < 0) return;
      presetCursor = i;
      store.setScene(presetScene(key), { replace: true, source: 'preset' });
    },
    stepPreset(delta) {
      presetCursor = (presetCursor + delta + PRESETS.length) % PRESETS.length;
      actions.loadPreset(PRESETS[presetCursor].key);
      return PRESETS[presetCursor];
    },
    surprise() { store.setScene(surpriseScene(Math.random), { replace: true, source: 'surprise' }); },
    resetScene() {
      const p = PRESETS[presetCursor] || PRESETS[0];
      store.setScene(presetScene(p.key), { replace: true, source: 'preset' });
    },
    async photo() { return capture.photo(); },
    async toggleRecord() {
      if (capture.recording) return capture.stopRecording();
      return capture.startRecording({ maxSeconds: 60, withSound: store.settings.sound || store.settings.react !== 'off' });
    },
    async shareLink() {
      const code = store.shareCode();
      // Inside the Android app the page lives at a private address nobody else can open,
      // so the app shares the scene code instead; Scenes > Open a shared scene takes it.
      if (platform.native) {
        const r = await platform.shareLink(code, 'A Tactilume scene code');
        return { ...r, kind: 'code' };
      }
      const url = location.href.split('#')[0].split('?')[0] + '#s=' + code;
      return platform.shareLink(url, store.scene.name ? `${store.scene.name}, on Tactilume` : 'A scene on Tactilume');
    },
    // A pasted share link or bare scene code. Returns { ok }.
    openShared(text) {
      const s = String(text || '').trim().slice(0, 4096);
      const fromLink = /(?:#|&)s=([A-Za-z0-9_-]+)/.exec(s);
      const bare = /^1[A-Za-z0-9_-]{2,}$/.test(s) ? s : null;
      const code = fromLink ? fromLink[1] : bare;
      return { ok: !!code && store.loadShareCode(code, 'paste') };
    },
    clearPins() { pointers.clearPins(); },
    toggleFullscreen() { platform.setFullscreen(!platform.isFullscreen()); },
    // the UI can also restore itself (a three-finger double tap), so its own state is the truth
    toggleUI() { uiHidden = !ui.hidden; ui.setHidden(uiHidden); },
    async setReact(mode, file) {
      audio.unlock();
      // A switch that fails keeps what was already playing, and the setting names it:
      // writing 'off' would stop that too.
      const live = () => { const st = audio.state(); return st.mic ? 'mic' : st.file ? 'file' : 'off'; };
      if (mode === 'mic') {
        const r = await audio.startMic();
        store.setSettings({ react: r.ok ? 'mic' : live() });
        return r;
      }
      if (mode === 'file' && file) {
        const r = await audio.playFile(file);
        store.setSettings({ react: r.ok ? 'file' : live() });
        return r;
      }
      audio.stopMic();
      audio.stopFile();
      store.setSettings({ react: 'off' });
      return { ok: true };
    },
    // Tilt asks the sensors and waits for a first reading. Switched off (or on again) in the
    // meantime, the latest choice wins: a late answer to an older one changes nothing.
    async enableTilt() {
      const ticket = ++tiltTicket;
      const ok = await tilt.enable();
      if (ticket !== tiltTicket) return false;
      store.setSettings({ tilt: ok });
      return ok;
    },
    disableTilt() {
      tiltTicket++;
      tilt.disable();
      store.setSettings({ tilt: false });
    },
    unlock() { audio.unlock(); },
    // The Device check in Settings: what the GPU says, what the light is doing, and how bright
    // the screen really is. Plain text, so it can be copied into a message.
    async diagnose() {
      const d = engine.diagnose();
      let screenLight = 'unknown';
      try {
        const blob = await Promise.race([engine.capture('image/png'), new Promise((r) => setTimeout(() => r(null), 3000))]);
        if (blob) {
          const bmp = await createImageBitmap(blob);
          const c = document.createElement('canvas');
          c.width = 96; c.height = Math.max(1, Math.round(96 * bmp.height / bmp.width));
          const x = c.getContext('2d');
          x.drawImage(bmp, 0, 0, c.width, c.height);
          const px = x.getImageData(0, 0, c.width, c.height).data;
          let sum = 0, max = 0;
          for (let i = 0; i < px.length; i += 4) { const l = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]; sum += l; max = Math.max(max, l); }
          screenLight = `mean ${(sum / (px.length / 4)).toFixed(1)} / 255, brightest ${Math.round(max)}`;
        }
      } catch (e) { screenLight = `could not read (${e && e.message})`; }
      // a plain word after each reading, so a report can be read without knowing the numbers
      const a = d.adapt || [];
      const finiteState = a.length === 4 && a.every(Number.isFinite);
      const stateVerdict = !a.length ? 'not readable'
        : finiteState && a[3] === 1 && a[2] > 0 ? 'OK'
          : finiteState && a[3] !== 1 && a.slice(0, 3).some((v) => v !== 0) ? 'LOST PRECISION: the GPU kept only part of each value'
            : 'BROKEN';
      const simVerdict = {
        moving: 'moving', still: 'still (this scene has no current in it)',
        stopped: 'NOT MOVING: the GPU is not running the simulation', unknown: 'not checked yet',
      }[d.simulation] || String(d.simulation);
      const lightVerdict = !d.sceneLight ? 'not readable here' : d.sceneLight.mean > 1e-4 ? 'some' : 'NONE';
      const targets = d.targets ? Object.entries(d.targets).map(([k, ok]) => `${k} ${ok ? 'complete' : 'INCOMPLETE'}`).join(', ') : 'none';
      const lines = [
        `Tactilume ${VERSION}${platform.native ? ' (Android app)' : ''}`,
        `Device: ${navigator.userAgent}`,
        `GPU: ${d.renderer || '?'} | ${d.vendor || '?'}`,
        `WebGL: ${d.version || '?'} | ${d.glsl || '?'}`,
        `Extensions: ${(d.extensions || []).join(', ') || 'none of the float ones'}`,
        `Limits: ${JSON.stringify(d.limits || {})}`,
        `Tier ${d.tier}, HDR ${d.hdr}, particles ${d.drawN} of ${d.capacity}, scale ${d.renderScale}`,
        `Canvas ${d.canvas.join('x')} for ${d.css.join('x')} at ${d.dpr}x, frames ${d.frames}, ${Math.round(fps)} fps`,
        `Render targets: ${targets}`,
        `Screen light: ${screenLight}`,
        `Scene light: ${d.sceneLight ? `${JSON.stringify(d.sceneLight)} (${lightVerdict})` : lightVerdict}`,
        `Brightness state: ${a.map((v) => +Number(v).toPrecision(3)).join(', ')} (${stateVerdict})`,
        `Simulation: ${simVerdict}`,
        `Particles: ${JSON.stringify(d.particles || {})}`,
        `Health: ${d.health.checks} checks, ${d.health.heals} repairs${d.health.lastIssue ? `, last: ${d.health.lastIssue}` : ''}`,
        `GL error: ${d.glError}${d.lost ? ', context lost' : ''}`,
      ];
      return lines.join('\n');
    },
    // Works on what is on screen: if autoplay is showing, or was switched on and waits
    // behind the person's own pins or keys, A stops it (until the next touch or A);
    // otherwise A starts it now. Returns whether autoplay is now wanted.
    toggleAutopilot() {
      if (autoShown || autopilotForced) {
        autopilotForced = false;
        autopilotPaused = true;
        lastActivity = performance.now();
        return false;
      }
      autopilotPaused = false;
      autopilotForced = true;
      autopilot.reset();
      return true;
    },
  };

  // a link's scene says it is the one shared, once the welcome (if any) has closed
  const welcome = linked ? `Playing ${linked.name ? `“${linked.name}”` : 'the scene'}, shared with you` : null;
  ui = createUI({ root: uiRoot, store, actions, platform, audio, capture, welcome });
  // Keys go through the UI's versions of photo and record (so results are shown), and
  // every key that changes what plays says what it did (seen, and heard by screen readers).
  const keyboard = createKeyboard({
    store,
    pointers,
    actions: {
      ...actions,
      photo: () => ui.run.photo(),
      toggleRecord: () => ui.run.record(),
      stepPreset: (d) => {
        const p = actions.stepPreset(d);
        ui.toast(`${p.name} is playing`);
        return p;
      },
      surprise: () => {
        actions.surprise();
        ui.toast(`${store.scene.name || 'A new scene'} is playing`);
      },
      toggleAutopilot: () => {
        const on = actions.toggleAutopilot();
        // the person's own pins and keys come first, so then autoplay waits for them
        ui.toast(store.settings.autopilot === 'off' ? 'Autoplay is switched off in Settings'
          : !on ? 'Autoplay off'
            : personHolds ? 'Autoplay on. It starts when nothing is pinned or held.' : 'Autoplay on');
        return on;
      },
    },
  });
  // S and M change the scene directly (source 'keyboard'): say what they did, too
  store.on('scene', (s, keys, source) => {
    if (source !== 'keyboard') return;
    if (keys.includes('symmetry')) ui.toast(s.symmetry > 1 ? `Symmetry ${s.symmetry}×` : 'Symmetry off', undefined, 'symmetry');
    if (keys.includes('mirror')) ui.toast(s.mirror ? 'Mirror on' : 'Mirror off', undefined, 'mirror');
  });

  // ---- reacting to input and settings ---------------------------------------
  const activity = () => {
    const now = performance.now();
    lastActivity = now;
    personAt = now;
    autopilotPaused = false;
    if (autopilotForced && store.settings.autopilot !== 'always') autopilotForced = false;
  };
  pointers.on('activity', activity);
  pointers.on('down', (e) => {
    engine.pulse(e.x, e.y, e.power);
    audio.noteDown(e);
    if (store.settings.haptics) platform.vibrate(6);
  });
  pointers.on('up', (e) => {
    engine.release(e.x, e.y, e.power, e.heldFor);
    audio.noteUp(e);
  });
  // the first touch or key anywhere unlocks sound (browsers require a gesture)
  const unlockOnce = () => { audio.unlock(); };
  addEventListener('pointerdown', unlockOnce, { capture: true });
  // keys reset the idle timer but leave forced autoplay to the A key (key poles take over
  // from autoplay anyway, because user poles always come first)
  addEventListener('keydown', (e) => {
    const now = performance.now();
    lastActivity = now;
    personAt = now;
    unlockOnce(e);
  }, { capture: true });

  store.on('settings', (s, keys) => {
    if (keys.includes('quality') && !forcedParticles && !TEST) {
      governor.setMode(s.quality);
      applyQuality();
    }
    if (keys.includes('fpsCap')) { governor.setCap(capOf(s)); due = 0; platform.setFrameCap(capOf(s)); }
    if (keys.includes('tilt') && !s.tilt) tilt.disable();
    if (keys.includes('sound') || keys.includes('react')) audio.unlock();
  });

  // A link whose code does not read (a messaging app cut it short, or a newer version made
  // it) says so; otherwise the scene on screen would be taken for the shared one.
  const BROKEN_LINK = 'That link’s scene could not be read. It may have been cut short.';
  if (code && !linked) ui.toast(BROKEN_LINK);
  addEventListener('hashchange', () => {
    const c = sceneCodeFromHash(location.hash);
    if (!c) return;
    ui.toast(store.loadShareCode(c) ? 'Scene loaded from the link' : BROKEN_LINK);
    forgetLinkCode();
  });

  // another tab of the app saved scenes or changed settings
  addEventListener('storage', (e) => {
    if (e.key === null || e.key === 'tactilume.v1') store.syncFromStorage();
  });

  platform.onBack(() => ui.back());

  // ---- the frame loop ---------------------------------------------------------
  const blend = { a: behaviourFor(store.scene, 1).key, b: behaviourFor(store.scene, 1).key, mix: 1 };
  let running = true;
  let rafId = 0;
  let last = performance.now();
  let time = 0;
  let frames = 0;
  let fps = 60;
  let lastFingers = 0;

  function schedule() {
    if (!rafId && running && !document.hidden) rafId = requestAnimationFrame(tick);
  }

  // One exception must never stop the loop for good (the controls would keep working over
  // a frozen or black light, and nobody would be told). A frame that fails is counted;
  // a few in a row are mentioned; when the light itself fails for many frames in a row
  // (it is plainly broken) the loop stops, and says how to start again.
  function frameFailed(e) {
    frameErrors++;
    // the first one, then now and then, so a fault in every frame does not flood the console
    if (frameErrors === 1 || frameErrors % 120 === 0) console.warn(`Tactilume: a frame failed (${frameErrors} in a row)`, e);
    if (lightErrors >= MAX_FRAME_ERRORS) lightStopped();
    else if (frameErrors === 3) ui.toast('The light hit a problem on this device. Settings > Device check shows the details.', 8000);
  }

  function tick(now) {
    rafId = 0;
    if (!running) return;
    try {
      let failed = null;
      try {
        const result = drawFrame(now);
        if (result === 'skipped') return;
        failed = result;
      } catch (e) {
        failed = e || new Error('the frame could not run');
        lightErrors++; // it stopped before the light could draw
      }
      if (failed) frameFailed(failed);
      else frameErrors = 0;
    } finally {
      schedule();
    }
  }

  // One frame. Returns 'skipped' when a frame-rate cap leaves this one out, else the first
  // error any part of it threw. The parts run each on their own, so the light still draws
  // when touches or sound fail every frame (without them, then), and the rest still runs
  // when the light fails.
  function drawFrame(now) {
    // A cap is paced by deadline, not by a minimum gap: on a 90 Hz screen a 60 cap then
    // draws on one vsync, then two, and averages 60 (a minimum gap would give 45).
    const capHz = capOf(store.settings);
    if (capHz) {
      if (now < due - 2) return 'skipped';
      due = Math.max(due + 1000 / capHz, now);
    }
    const interval = Math.max(0, now - last);
    last = now;
    const dt = Math.min(interval / 1000, 1 / 20);
    time += dt;
    fps += (1000 / Math.max(interval, 1) - fps) * approach(dt, 0.5);

    const settings = store.settings;
    const scene = effectiveScene(store.scene, settings);
    let failed = null;
    const fail = (e) => { failed = failed || e || new Error('part of a frame failed'); };

    let play = { poles: [], fingers: 0 };
    let sound = SILENCE;
    try {
      play = whatPlays(now, dt, settings, scene);
      sound = audio.analysis();
      audio.update(dt, { poles: play.poles, fingers: play.fingers, behaviour: blend.b, scene, aspect: engine.aspect });
    } catch (e) { fail(e); }

    try {
      engine.frame({
        dt, time, scene, settings, poles: play.poles, fingers: play.fingers,
        behaviour: { a: blend.a, b: blend.b, mix: blend.mix },
        audio: sound,
        gravity: settings.tilt ? tilt.vector() : { x: 0, y: -1, z: 0 },
      });
      lightErrors = 0;
    } catch (e) { fail(e); lightErrors++; }

    try {
      if (!capture.recording && governor.sample(interval, dt)) {
        engine.setQuality({ particles: governor.particles, renderScale: governor.renderScale });
      }
      ui.update(dt, { fingers: play.fingers, behaviour: blend.b, fps, particles: engine.stats.particles, recording: capture.recording, autopilot: autoShown });
      updateAwake(now);
      // the engine repairs itself; if it keeps having to, say so once and where to look
      if (!toldRepairs && engine.health.heals >= 3) {
        toldRepairs = true;
        ui.toast('The light keeps hitting a graphics problem on this device. Settings > Device check shows the details.', 8000);
      }
    } catch (e) { fail(e); }
    frames++;
    if (frames === 2) hook.ready = true;
    return failed;
  }

  // The touches, keys and autoplay of this frame, and the behaviour they choose.
  function whatPlays(now, dt, settings, scene) {
    pointers.update(dt);

    const idleFor = (now - lastActivity) / 1000;
    const auto = !TEST && settings.autopilot !== 'off' && !autopilotPaused
      && (settings.autopilot === 'always' || autopilotForced || idleFor > settings.idleSeconds);
    const userPoles = pointers.poles().concat(keyboard.poles());
    // Autoplay steps aside while the person holds a touch, a pin or a key, and its clock
    // stops with it, so afterwards it fades back in instead of popping in at full strength.
    personHolds = userPoles.some((p) => p.held);
    const autoPoles = auto && !personHolds ? autopilot.update(dt, time, engine.aspect) : [];
    const raw = userPoles.length ? userPoles : autoPoles;
    // decided this frame, so a person's first touch after autoplay counts as theirs
    autoShown = auto && !userPoles.length;

    const fingers = fingerCount(raw, settings.virtualFingers);
    const poles = expandPoles(raw, { symmetry: scene.symmetry, mirror: scene.mirror, virtualFingers: settings.virtualFingers, time });

    if (fingers > 0) {
      const target = behaviourFor(scene, fingers).key;
      if (target !== blend.b) {
        blend.a = blend.mix > 0.5 ? blend.b : blend.a;
        blend.b = target;
        blend.mix = 0;
        const b = behaviourByKey(target);
        if (settings.hints) ui.showBehaviour(b, { autopilot: autoShown });
        audio.behaviourChanged(target);
      }
    }
    blend.mix = Math.min(1, blend.mix + dt / 0.45);
    lastFingers = fingers;
    return { poles, fingers };
  }

  // The screen stays on while someone is around (and a while after), while recording, and
  // when Autoplay is set to Always; otherwise the phone may sleep as it normally would.
  function updateAwake(now) {
    const s = store.settings;
    const quietFor = Math.max(5 * 60e3, (s.idleSeconds + 60) * 1e3);
    const want = !document.hidden && (s.autopilot === 'always' || capture.recording || now - personAt < quietFor);
    if (want !== awake) { awake = want; platform.keepAwake(want); }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { store.flush(); updateAwake(performance.now()); }
    else { last = performance.now(); due = 0; personAt = last; updateAwake(last); schedule(); }
  });
  addEventListener('pagehide', () => store.flush());
  updateAwake(performance.now());

  // what the automated tests (and curious people in the console) can reach
  const hook = {
    version: VERSION, ready: false, test: TEST,
    store, engine, governor, pointers, keyboard, autopilot, tilt, audio, capture, platform, ui, actions,
    get frames() { return frames; },
    get fingers() { return lastFingers; },
    get behaviour() { return { ...blend }; },
    get autoplay() { return autoShown; },
  };
  window.TACTILUME = hook;
  schedule();
}

try {
  boot();
} catch (e) {
  console.error(e);
  showFatal('Tactilume could not start', String(e && e.message ? e.message : e));
}
