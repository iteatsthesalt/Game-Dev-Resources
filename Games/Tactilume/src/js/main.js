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

function boot() {
  const canvas = document.getElementById('stage');
  const uiRoot = document.getElementById('ui');

  const code = sceneCodeFromHash(location.hash);
  const linked = code ? decodeScene(code) : null;
  const store = createStore({ initialScene: linked });
  if (!linked && !store.hadSavedScene) store.setScene(presetScene(DEFAULT_PRESET), { replace: true, source: 'preset' });
  if (TEST) store.setSettings({ introSeen: true, autopilot: 'off', haptics: false });

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
  const audio = createAudio({ getSettings: () => store.settings });
  const pointers = createPointers(canvas, { screenToWorld: (px, py) => engine.screenToWorld(px, py), getSettings: () => store.settings });
  const autopilot = createAutopilot({ seed: TEST ? 7 : (Date.now() & 0xffffff) });
  const tilt = createTilt();
  const capture = createCapture({ engine, audio, platform });

  let uiHidden = false;
  let presetCursor = Math.max(0, PRESETS.findIndex((p) => p.name === store.scene.name));
  let lastActivity = performance.now();
  let autopilotForced = false;

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
      const url = location.href.split('#')[0].split('?')[0] + '#s=' + store.shareCode();
      return platform.shareLink(url, store.scene.name ? `${store.scene.name}, on Tactilume` : 'A scene on Tactilume');
    },
    clearPins() { pointers.clearPins(); },
    toggleFullscreen() { platform.setFullscreen(!platform.isFullscreen()); },
    toggleUI() { uiHidden = !uiHidden; ui.setHidden(uiHidden); },
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
    toggleAutopilot() {
      autopilotForced = !autopilotForced;
      if (autopilotForced) autopilot.reset();
      return autopilotForced;
    },
  };

  const keyboard = createKeyboard({ store, actions, pointers });
  const ui = createUI({ root: uiRoot, store, actions, platform, audio, capture });

  // ---- reacting to input and settings ---------------------------------------
  const activity = () => { lastActivity = performance.now(); if (autopilotForced && store.settings.autopilot !== 'always') autopilotForced = false; };
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
  addEventListener('keydown', (e) => { activity(); unlockOnce(e); }, { capture: true });

  store.on('settings', (s, keys) => {
    if (keys.includes('quality') && !forcedParticles && !TEST) {
      governor.setMode(s.quality);
      engine.setQuality({ particles: governor.particles, renderScale: governor.renderScale });
    }
    if (keys.includes('tilt') && !s.tilt) tilt.disable();
    if (keys.includes('sound') || keys.includes('react')) audio.unlock();
  });

  addEventListener('hashchange', () => {
    const c = sceneCodeFromHash(location.hash);
    if (c && store.loadShareCode(c)) ui.toast('Scene loaded from the link');
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
    const interval = Math.max(0, now - last);
    const cap = store.settings.fpsCap;
    const minInterval = cap === '30' ? 1000 / 30 - 2 : cap === '60' ? 1000 / 60 - 2 : 0;
    if (interval < minInterval) { schedule(); return; }
    last = now;
    const dt = Math.min(interval / 1000, 1 / 20);
    time += dt;
    fps += (1000 / Math.max(interval, 1) - fps) * approach(dt, 0.5);

    const settings = store.settings;
    const scene = effectiveScene(store.scene, settings);
    pointers.update(dt);

    const idleFor = (now - lastActivity) / 1000;
    const auto = !TEST && settings.autopilot !== 'off' && (settings.autopilot === 'always' || autopilotForced || idleFor > settings.idleSeconds);
    const userPoles = pointers.poles().concat(keyboard.poles());
    const autoPoles = auto && pointers.active() === 0 ? autopilot.update(dt, time, engine.aspect) : [];
    const raw = userPoles.length ? userPoles : autoPoles;

    const fingers = fingerCount(raw, settings.virtualFingers);
    const poles = expandPoles(raw, { symmetry: scene.symmetry, mirror: scene.mirror, virtualFingers: settings.virtualFingers, time });

    if (fingers > 0) {
      const target = behaviourFor(scene, fingers).key;
      if (target !== blend.b) {
        blend.a = blend.mix > 0.5 ? blend.b : blend.a;
        blend.b = target;
        blend.mix = 0;
        const b = behaviourByKey(target);
        if (settings.hints) ui.showBehaviour(b);
        audio.behaviourChanged(target);
      }
    }
    blend.mix = Math.min(1, blend.mix + dt / 0.45);
    lastFingers = fingers;

    const sound = audio.analysis();
    audio.update(dt, { poles, fingers, behaviour: blend.b, scene });

    engine.frame({
      dt, time, scene, settings, poles, fingers,
      behaviour: { a: blend.a, b: blend.b, mix: blend.mix },
      audio: sound,
      gravity: settings.tilt ? tilt.vector() : { x: 0, y: -1, z: 0 },
    });

    if (!capture.recording && governor.sample(interval, dt)) {
      engine.setQuality({ particles: governor.particles, renderScale: governor.renderScale });
    }

    ui.update(dt, { fingers, behaviour: blend.b, fps, particles: engine.stats.particles, recording: capture.recording, autopilot: auto && !userPoles.length });
    frames++;
    if (frames === 2) hook.ready = true;
    schedule();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { store.flush(); platform.keepAwake(false); }
    else { last = performance.now(); platform.keepAwake(true); schedule(); }
  });
  addEventListener('pagehide', () => store.flush());
  platform.keepAwake(true);

  // what the automated tests (and curious people in the console) can reach
  const hook = {
    version: VERSION, ready: false, test: TEST,
    store, engine, governor, pointers, keyboard, autopilot, audio, capture, platform, ui, actions,
    get frames() { return frames; },
    get fingers() { return lastFingers; },
    get behaviour() { return { ...blend }; },
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
