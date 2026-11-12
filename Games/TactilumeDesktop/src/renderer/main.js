// Boots Tactilume Desktop and runs the frame loop: the only renderer file that knows every
// module. See CONTRACTS.md, "renderer/main.js".
//
// URL parameters:
//   ?test=1      fixed seed, no autoplay, no intro, no calibration (the automated tests)
//   particles=N  this many particles, and the governor leaves the count alone
//   present=0    draw offscreen only (headless browsers cannot present a WebGPU canvas)
//   webgpu=0     go straight to the classic (mobile, WebGL2) engine
//
// Beyond CONTRACTS.md:
//   - The desktop settings also hold particleMode: 'auto' (the count measured once per GPU,
//     `particles`, which the governor adjusts as it plays) or 'manual' (the count the person
//     chose, `manualParticles`, left alone). Choosing by hand keeps the measured count, so
//     going back to Auto needs no new measurement.
//   - actions.measure() runs the benchmark again; actions.setParticles(n) picks a count by
//     hand, and actions.setParticles('auto') goes back to the measured one.
//   - The test hook also has desktop (the desktop settings), gamepads, phones, pointer and
//     settings() (what the engine is given: the shared settings with the desktop ones).
import { clamp, mulberry32 } from '../../../Tactilume/src/js/core/util.js';
import { BEHAVIOUR_KEYS, behaviourFor, behaviourByKey } from '../../../Tactilume/src/js/core/behaviours.js';
import { PALETTE_KEYS, PALETTES, paletteIndex } from '../../../Tactilume/src/js/core/palettes.js';
import { PRESETS, DEFAULT_PRESET, presetScene } from '../../../Tactilume/src/js/core/presets.js';
import { SCENE_FIELDS } from '../../../Tactilume/src/js/core/scene.js';
import { createStore } from '../../../Tactilume/src/js/core/store.js';
import { surpriseScene } from '../../../Tactilume/src/js/core/surprise.js';
import { estimateRefresh } from '../../../Tactilume/src/js/core/governor.js';
import { createAutopilot } from '../../../Tactilume/src/js/input/autopilot.js';
import { getBridge } from './bridge.js';
import { createEngine } from './engine/engine.js';
import { createGovernor } from './engine/governor.js';
import { calibrate } from './engine/calibrate.js';
import { createHub } from './input/hub.js';
import { createPointer } from './input/pointer.js';
import { createGamepads } from './input/gamepad.js';
import { createPhones } from './input/phone.js';
import { createAudio } from './audio/audio.js';
import { createUI } from './ui/ui.js';

const params = new URLSearchParams(location.search);
const TEST = params.get('test') === '1';
const PRESENT = params.get('present') !== '0';
const WEBGPU = params.get('webgpu') !== '0';
const forcedParticles = params.has('particles') ? clamp(parseInt(params.get('particles'), 10) || 0, 1, 2 ** 28) : 0;

const IDLE_SECONDS = 20;            // nobody has played for this long: autoplay takes over
const BLEND_SECONDS = 0.45;         // the crossfade between behaviours, as on mobile
const START_PARTICLES = 1 << 20;    // until the first-run benchmark has measured this computer
const MIN_PARTICLES = 1 << 14;      // the fewest the governor or a person may choose
const BEHAVIOUR_CYCLE = ['auto', ...BEHAVIOUR_KEYS];

// What the tests and curious people in the console can reach. Filled in as boot goes on.
const hook = {
  ready: false, version: '', engine: null, hub: null, store: null, audio: null, ui: null, actions: null, bridge: null,
  frames: 0, fallback: false, desktop: null, gamepads: null, phones: null, pointer: null, settings: () => null,
};
window.TACTILUME_DESKTOP = hook;

// ---- desktop-only settings ------------------------------------------------------------
// The scene and the shared settings live in the mobile store (so a scene made on a phone
// opens here); these few exist only on the desktop.
const DESKTOP_KEY = 'tactilume.desktop.v1';
const DESKTOP_DEFAULTS = Object.freeze({ particles: 0, particleMode: 'auto', manualParticles: 0, calibratedFor: '', hdr: 'auto', teamColors: true, haptics: true, intro: true });
const isCount = (n) => Number.isInteger(n) && n >= 0 && n <= 2 ** 28;

function cleanDesktop(src, base) {
  const s = src && typeof src === 'object' ? src : {};
  const out = { ...base };
  // particles: the measured count, 0 until measured. calibratedFor: the adapter it was
  // measured on. manualParticles: the count chosen by hand, used while particleMode is 'manual'.
  if (isCount(s.particles)) out.particles = s.particles;
  if (isCount(s.manualParticles)) out.manualParticles = s.manualParticles;
  if (s.particleMode === 'auto' || s.particleMode === 'manual') out.particleMode = s.particleMode;
  if (typeof s.calibratedFor === 'string') out.calibratedFor = s.calibratedFor.slice(0, 200);
  if (['auto', 'on', 'off'].includes(s.hdr)) out.hdr = s.hdr;
  for (const k of ['teamColors', 'haptics', 'intro']) if (typeof s[k] === 'boolean') out[k] = s[k];
  return Object.freeze(out);
}

function createDesktopSettings() {
  let current = DESKTOP_DEFAULTS;
  try { current = cleanDesktop(JSON.parse(localStorage.getItem(DESKTOP_KEY) || '{}'), DESKTOP_DEFAULTS); } catch { /* unreadable: defaults */ }
  const listeners = new Set();
  return {
    get: () => current,
    set(partial) {
      const next = cleanDesktop(partial, current);
      if (Object.keys(next).every((k) => next[k] === current[k])) return current;
      current = next;
      try { localStorage.setItem(DESKTOP_KEY, JSON.stringify(current)); } catch { /* storage full or blocked */ }
      for (const fn of [...listeners]) fn(current);
      return current;
    },
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

// ---- helpers ----------------------------------------------------------------------------

function showFatal(title, detail) {
  const box = document.getElementById('fatal');
  const h = document.createElement('h1');
  h.textContent = title;
  const p = document.createElement('p');
  p.textContent = detail;
  box.replaceChildren(h, p);
  box.hidden = false;
}

// Calm mode, or the system asking for less motion, softens the scene the engine sees; the
// scene itself (and so what is saved and shared) stays as it is. The same as mobile.
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
function effectiveScene(scene, settings) {
  if (!settings.calm && !reducedMotion.matches) return scene;
  const k = settings.calm ? 1 : 0.5;
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

// The display's refresh rate, from the gaps between a few animation frames.
function measureRefresh(frames = 24) {
  return new Promise((resolve) => {
    const gaps = [];
    let last = 0;
    const step = (now) => {
      if (last) gaps.push(now - last);
      last = now;
      if (gaps.length >= frames) resolve(estimateRefresh(gaps));
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

// No WebGPU: the mobile edition's WebGL2 engine is a whole page of its own. ready() goes
// first, so the shell knows the renderer started; test parameters travel along.
async function handOver(bridge) {
  hook.fallback = true;
  try { await bridge.app.ready(); } catch { /* the page changes either way */ }
  const next = new URLSearchParams({ desktop: '1' });
  for (const k of ['test', 'particles']) if (params.has(k)) next.set(k, params.get(k));
  location.replace(`../classic/index.html?${next}`);
}

// ---- boot -------------------------------------------------------------------------------

async function boot() {
  const bridge = getBridge();
  hook.bridge = bridge;
  hook.version = bridge.version;
  if (!WEBGPU) return handOver(bridge);

  const canvas = document.getElementById('stage');
  const store = createStore();
  if (!store.hadSavedScene) store.setScene(presetScene(DEFAULT_PRESET), { replace: true, source: 'preset' });
  if (TEST) store.setSettings({ introSeen: true, autopilot: 'off', haptics: false }, { source: 'test' });
  const desktop = createDesktopSettings();
  Object.assign(hook, { store, desktop });
  const d = desktop.get();
  const startCount = d.particleMode === 'manual' && d.manualParticles ? d.manualParticles : d.particles || START_PARTICLES;

  let engine;
  try {
    engine = await createEngine(canvas, {
      particles: forcedParticles || startCount,
      hdr: desktop.get().hdr,
      present: PRESENT,
      onLost: () => showFatal('The graphics stopped working', 'The GPU stopped answering twice. Restart Tactilume to play again.'),
    });
  } catch (e) {
    if (e && e.message === 'webgpu') return handOver(bridge);
    throw e;
  }
  hook.engine = engine;

  const resize = () => engine.resize(innerWidth, innerHeight, devicePixelRatio || 1);
  resize();
  addEventListener('resize', resize);

  // ---- state the actions and the frame loop share ---------------------------------------
  let time = 0;                 // s of play, as the frame loop counts it
  let lastPlayed = -Infinity;   // when a person last touched or pulsed: nobody yet, so autoplay starts at once
  let refreshHz = 60;           // measured before the first frame (60 in tests)
  let governor = null;          // only while the count is automatic
  let measuring = null;         // the benchmark's promise while it runs; the frame loop waits for it
  let ui = null;                // the overlay, made once the inputs exist
  // The engine reads one settings object: the shared settings plus the desktop-only ones.
  let merged = null;
  let mergedFrom = null;
  function settingsFor(shared) {
    if (mergedFrom !== shared) {
      mergedFrom = shared;
      merged = Object.freeze({ ...shared, ...desktop.get() });
    }
    return merged;
  }
  desktop.on(() => { mergedFrom = null; });
  const currentSettings = () => settingsFor(store.settings);
  hook.settings = currentSettings;

  // ---- the particle count --------------------------------------------------------------
  // Measured once per GPU, so whatever computer it runs on becomes its own default; the
  // adapter's names say which GPU a measurement belongs to.
  const adapterKey = () => [engine.caps.adapter.vendor, engine.caps.adapter.architecture, engine.caps.adapter.description].join('|');
  const particleRange = (n) => clamp(Math.round(n), Math.min(MIN_PARTICLES, engine.caps.maxParticles), engine.caps.maxParticles);
  function startGovernor() {
    const auto = !TEST && !forcedParticles && desktop.get().particleMode === 'auto';
    governor = auto ? createGovernor({ min: MIN_PARTICLES, max: engine.caps.maxParticles, start: engine.stats.particles, refreshHz }) : null;
  }
  // → the count picked. The frame loop stands still meanwhile: the benchmark draws the frames.
  function measure() {
    if (measuring) return measuring;
    measuring = (async () => {
      ui?.measuring(true);
      try {
        const { particles } = await calibrate(engine, { refreshHz });
        desktop.set({ particles, particleMode: 'auto', calibratedFor: adapterKey() });
        return particles;
      } finally {
        measuring = null;
        startGovernor();
        ui?.measuring(false);
      }
    })();
    return measuring;
  }

  // ---- inputs, sound and the overlay ----------------------------------------------------
  const hub = createHub({ maxPoles: 64 });
  const audio = createAudio({ bridge });
  let presetCursor = Math.max(0, PRESETS.findIndex((p) => p.name === store.scene.name));
  const random = TEST ? mulberry32(7) : Math.random;
  const say = (text) => ui?.toast(text);

  const actions = {
    // steps scene.lock through auto and then each behaviour
    nextBehaviour(dir = 1) {
      const i = Math.max(0, BEHAVIOUR_CYCLE.indexOf(store.scene.lock));
      return actions.setBehaviour(BEHAVIOUR_CYCLE[(i + Math.sign(dir || 1) + BEHAVIOUR_CYCLE.length) % BEHAVIOUR_CYCLE.length]);
    },
    setBehaviour(key) {
      if (!BEHAVIOUR_CYCLE.includes(key)) return store.scene.lock;
      store.setScene({ lock: key }, { source: 'action' });
      say(key === 'auto' ? 'Behaviour follows the number of touches' : behaviourByKey(key).name);
      return key;
    },
    nextPalette(dir = 1) {
      const i = paletteIndex(store.scene.palette);
      const key = PALETTE_KEYS[(i + Math.sign(dir || 1) + PALETTE_KEYS.length) % PALETTE_KEYS.length];
      store.setScene({ palette: key }, { source: 'action' });
      say(`${PALETTES[paletteIndex(key)].name} colours`);
      return key;
    },
    nextPreset(dir = 1) {
      presetCursor = (presetCursor + Math.sign(dir || 1) + PRESETS.length) % PRESETS.length;
      const p = PRESETS[presetCursor];
      store.setScene(presetScene(p.key), { replace: true, source: 'preset' });
      say(`${p.name} is playing`);
      return p.key;
    },
    surprise() {
      store.setScene(surpriseScene(random), { replace: true, source: 'surprise' });
      say(`${store.scene.name || 'A new scene'} is playing`);
    },
    // starts the current scene's preset afresh, dropping changes made since it was chosen
    clear() {
      store.setScene(presetScene(PRESETS[presetCursor].key), { replace: true, source: 'preset' });
      say('Back to the start of the scene');
    },
    pulse(x, y, power = 1, color) {
      engine.pulse(x, y, power, color);
      lastPlayed = time;
    },
    // delta is a share of the setting's range: adjust('trails', 0.05) adds 5% of it
    adjust(key, delta) {
      const f = SCENE_FIELDS.get(key);
      if (!f || (f.type !== 'num' && f.type !== 'int') || !Number.isFinite(delta)) return;
      store.setScene({ [key]: store.scene[key] + delta * (f.max - f.min) }, { source: 'action' });
      say(`${f.label} ${Math.round(((store.scene[key] - f.min) / (f.max - f.min)) * 100)}%`);
    },
    toggleUI() { ui.toggle(); },
    togglePhonePanel() { ui.showPhonePanel(ui.panel !== 'phone'); },
    async toggleFullscreen() {
      const on = await bridge.app.isFullscreen();
      await bridge.app.setFullscreen(!on);
      ui?.syncFullscreen(!on);
    },
    toast: say,
    measure,
    // a count picked by hand (left alone from then on), or 'auto' for the measured count
    async setParticles(n) {
      if (forcedParticles) return engine.stats.particles;
      if (n === 'auto') {
        const d = desktop.get();
        desktop.set({ particleMode: 'auto' });
        if (d.calibratedFor !== adapterKey() || !d.particles) return measure();
        await engine.setQuality({ particles: d.particles });
        startGovernor();
        return engine.stats.particles;
      }
      if (!Number.isFinite(n)) return engine.stats.particles;
      const count = particleRange(n);
      desktop.set({ particleMode: 'manual', manualParticles: count });
      governor = null;
      await engine.setQuality({ particles: count });
      return engine.stats.particles;
    },
  };

  const pointer = createPointer(canvas, { engine, hub, actions });
  const gamepads = createGamepads({ engine, hub, actions, getSettings: currentSettings });
  const phones = createPhones({ bridge, hub, engine, actions, store, getSettings: currentSettings });
  const autopilot = createAutopilot({ seed: TEST ? 7 : Date.now() & 0xffffff });
  ui = createUI({
    root: document.getElementById('ui'), store, actions, bridge, engine, audio, hub, desktop,
    gamepads, cursorCanvas: document.getElementById('cursors'), test: TEST, particlesFixed: forcedParticles > 0,
  });
  Object.assign(hook, { hub, audio, ui, actions, gamepads, phones, pointer });

  // ---- the first-run benchmark -----------------------------------------------------------
  refreshHz = TEST ? 60 : await measureRefresh();
  const d0 = desktop.get();
  if (!TEST && !forcedParticles && d0.particleMode === 'auto' && d0.calibratedFor !== adapterKey()) {
    try {
      await measure();
    } catch (e) {
      // the light plays at the starting count; Settings offers to measure again
      console.warn('The first-run measurement failed:', e);
      say('Could not measure this computer. The light plays at a safe amount.');
    }
  } else {
    startGovernor();
  }

  // ---- the frame loop -------------------------------------------------------------------
  const first = behaviourFor(store.scene, 1).key;
  const blend = { a: first, b: first, mix: 1 };
  let last = performance.now();
  let errors = 0;

  function tick(now) {
    requestAnimationFrame(tick);
    const interval = Math.max(0, now - last);
    last = now;
    // the benchmark draws its own frames; play resumes where it was when it ends
    if (measuring) return;
    const dt = Math.min(interval / 1000, 1 / 20);
    time += dt;
    try {
      step(dt, interval, now);
    } catch (e) {
      // one bad frame must not stop the show; the first fault is reported, the rest counted
      if (errors++ === 0) console.error(e);
    }
  }

  function step(dt, interval, now) {
    const settings = currentSettings();
    const scene = effectiveScene(store.scene, settings);
    pointer.update(dt);
    gamepads.update(dt, time);
    phones.update(dt);
    audio.update(dt);

    let poles = hub.poles();
    let fingers = Math.min(10, poles.filter((p) => p.held).length);
    if (fingers) lastPlayed = time;
    // nobody has played for a while: the mobile edition's autopilot plays instead
    if (!TEST && !poles.length && settings.autopilot !== 'off' && time - lastPlayed > IDLE_SECONDS) {
      poles = autopilot.update(dt, time, engine.aspect).map((p) => ({ ...p, player: 0 }));
      fingers = Math.min(10, poles.filter((p) => p.held).length);
    }

    // A locked behaviour applies at once; with 'auto' the behaviour only changes while
    // someone touches, so lifting the fingers one by one does not run through the table.
    if (fingers > 0 || scene.lock !== 'auto') {
      const target = behaviourFor(scene, Math.max(fingers, 1)).key;
      if (target !== blend.b) {
        blend.a = blend.mix > 0.5 ? blend.b : blend.a;
        blend.b = target;
        blend.mix = 0;
      }
    }
    blend.mix = Math.min(1, blend.mix + dt / BLEND_SECONDS);

    engine.frame({
      dt, time, scene, settings, poles, fingers,
      behaviour: { a: blend.a, b: blend.b, mix: blend.mix },
      audio: audio.features(),
      gravity: { x: 0, y: -1, z: 0 },
      players: hub.players().map(({ id, color }) => ({ id, color })),
    });

    if (governor) {
      const next = governor.update(interval, now);
      if (next) engine.setQuality({ particles: next });
    }
    ui.update(dt);

    hook.frames++;
    if (hook.frames === 1) {
      hook.ready = true;
      bridge.app.ready().catch(() => {});
      if (!TEST && desktop.get().intro) ui.showIntro();
    }
  }

  requestAnimationFrame(tick);
  addEventListener('pagehide', () => store.flush());
}

boot().catch((e) => {
  console.error(e);
  showFatal('Tactilume could not start', String(e && e.message ? e.message : e));
});
