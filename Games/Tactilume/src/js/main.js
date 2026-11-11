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

function showFatal(title, detail) {
  const el = document.getElementById('fatal');
  el.hidden = false;
  el.replaceChildren();
  const h = document.createElement('h1');
  h.textContent = title;
  const p = document.createElement('p');
  p.textContent = detail;
  el.append(h, p);
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

  // ---- graphics -------------------------------------------------------------
  let engine;
  try {
    engine = createEngine(canvas, {
      maxParticles: forcedParticles || 0,
      onLost: () => { running = false; },
      onRestored: () => { running = true; schedule(); },
    });
  } catch (e) {
    console.warn(e);
    showFatal('This device cannot draw Tactilume', 'Tactilume needs WebGL 2, which this browser does not offer, or has switched off. An up-to-date Chrome, Edge, Firefox or Safari will work.');
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
  engine.setQuality({ particles: governor.particles, renderScale: governor.renderScale });

  function resize() {
    const vv = window.visualViewport;
    const w = Math.round(vv ? vv.width : innerWidth);
    const h = Math.round(vv ? vv.height : innerHeight);
    engine.resize(w, h, Math.min(window.devicePixelRatio || 1, tier === 'ultra' ? 2 : tier === 'low' ? 1.25 : 2));
  }
  resize();
  addEventListener('resize', resize);
  window.visualViewport?.addEventListener('resize', resize);

  // ---- everything else -----------------------------------------------------
  const platform = createPlatform();
  let ui = null;
  const audio = createAudio({
    getSettings: () => store.settings,
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
  let awake = null;             // whether the screen is being kept on right now

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
    // the UI can also restore itself (three fingers held), so its own state is the truth
    toggleUI() { uiHidden = !ui.hidden; ui.setHidden(uiHidden); },
    async setReact(mode, file) {
      audio.unlock();
      if (mode === 'mic') {
        const r = await audio.startMic();
        store.setSettings({ react: r.ok ? 'mic' : 'off' });
        return r;
      }
      if (mode === 'file' && file) {
        const r = await audio.playFile(file);
        store.setSettings({ react: r.ok ? 'file' : 'off' });
        return r;
      }
      audio.stopMic();
      audio.stopFile();
      store.setSettings({ react: 'off' });
      return { ok: true };
    },
    async enableTilt() {
      const ok = await tilt.enable();
      store.setSettings({ tilt: ok });
      return ok;
    },
    unlock() { audio.unlock(); },
    // Works on what is on screen: if autoplay is showing, A stops it (until the next touch
    // or A); otherwise A starts it now. Returns whether autoplay is now wanted.
    toggleAutopilot() {
      if (autoShown) {
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

  ui = createUI({ root: uiRoot, store, actions, platform, audio, capture });
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
        ui.toast(store.settings.autopilot === 'off' ? 'Autoplay is switched off in Settings' : on ? 'Autoplay on' : 'Autoplay off');
        return on;
      },
    },
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
      engine.setQuality({ particles: governor.particles, renderScale: governor.renderScale });
    }
    if (keys.includes('fpsCap')) { governor.setCap(capOf(s)); due = 0; }
    if (keys.includes('tilt') && !s.tilt) tilt.disable();
    if (keys.includes('sound') || keys.includes('react')) audio.unlock();
  });

  addEventListener('hashchange', () => {
    const c = sceneCodeFromHash(location.hash);
    if (!c) return;
    if (store.loadShareCode(c)) ui.toast('Scene loaded from the link');
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

  function tick(now) {
    rafId = 0;
    if (!running) return;
    // A cap is paced by deadline, not by a minimum gap: on a 90 Hz screen a 60 cap then
    // draws on one vsync, then two, and averages 60 (a minimum gap would give 45).
    const capHz = capOf(store.settings);
    if (capHz) {
      if (now < due - 2) { schedule(); return; }
      due = Math.max(due + 1000 / capHz, now);
    }
    const interval = Math.max(0, now - last);
    last = now;
    const dt = Math.min(interval / 1000, 1 / 20);
    time += dt;
    fps += (1000 / Math.max(interval, 1) - fps) * approach(dt, 0.5);

    const settings = store.settings;
    const scene = effectiveScene(store.scene, settings);
    pointers.update(dt);

    const idleFor = (now - lastActivity) / 1000;
    const auto = !TEST && settings.autopilot !== 'off' && !autopilotPaused
      && (settings.autopilot === 'always' || autopilotForced || idleFor > settings.idleSeconds);
    const userPoles = pointers.poles().concat(keyboard.poles());
    const autoPoles = auto && pointers.active() === 0 ? autopilot.update(dt, time, engine.aspect) : [];
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

    const sound = audio.analysis();
    audio.update(dt, { poles, fingers, behaviour: blend.b, scene, aspect: engine.aspect });

    engine.frame({
      dt, time, scene, settings, poles, fingers,
      behaviour: { a: blend.a, b: blend.b, mix: blend.mix },
      audio: sound,
      gravity: settings.tilt ? tilt.vector() : { x: 0, y: -1, z: 0 },
    });

    if (!capture.recording && governor.sample(interval, dt)) {
      engine.setQuality({ particles: governor.particles, renderScale: governor.renderScale });
    }

    ui.update(dt, { fingers, behaviour: blend.b, fps, particles: engine.stats.particles, recording: capture.recording, autopilot: autoShown });
    updateAwake(now);
    frames++;
    if (frames === 2) hook.ready = true;
    schedule();
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
