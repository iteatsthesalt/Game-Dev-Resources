// The whole interface: nearly invisible while playing (one dim button in the corner),
// rich when opened. See CONTRACTS.md for the API main.js relies on.
//
//   hud.js    the open button, recording badge, behaviour name card, toasts, live region
//   panel.js  the controls panel, built from the schema the first time it opens
//   intro.js  the first-run welcome
//
// ui.update runs every frame, so it only counts time; text changes a few times a second.

import { PALETTES, paletteCSS } from '../core/palettes.js';
import { createHUD } from './hud.js';
import { createPanel, SIDE_QUERY } from './panel.js';
import { createIntro } from './intro.js';

const BLURB_TIMES = 2;       // a behaviour's card explains it the first times it is played
const HUD_EVERY = 0.25;      // s between recording-time updates
const STATS_EVERY = 0.5;     // s between stats updates in Settings
const RESTORE_HOLD_MS = 1000; // three fingers held this long bring hidden controls back
const RESTORE_SLOP_PX = 28;   // ...as long as they stay roughly still

const isTyping = (el) => !!el && (el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');

// sRGB hex to relative luminance and a rough saturation, to pick an accent that reads
function describeHex(hex) {
  const n = parseInt(hex.slice(1), 16);
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => c / 255);
  const lin = rgb.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const lum = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  return { lum, sat: Math.max(...rgb) - Math.min(...rgb) };
}

// The palette's most colourful stop that is still bright enough to see on the dark glass.
function accentOf(palette) {
  let best = null;
  for (const hex of palette.stops) {
    const d = describeHex(hex);
    if (d.lum < 0.25) continue;
    if (!best || d.sat > best.sat) best = { hex, sat: d.sat };
  }
  return best ? best.hex : palette.stops[palette.stops.length - 1];
}

function where(r) {
  const w = String((r && r.where) || '').toLowerCase();
  if (/gallery|photo|picture|movie|video|dcim/.test(w)) return ' to your gallery';
  if (/download/.test(w)) return ' to your downloads';
  return '';
}

export function createUI({ root, store, actions, platform, audio, capture }) {
  const reduceQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  const reducedMotion = () => !!(reduceQuery && reduceQuery.matches);

  root.classList.add('tl-ui');

  function applyScale(v) { root.style.setProperty('--ui-scale', String(v)); }
  function applyAccent(key) {
    const p = PALETTES.find((x) => x.key === key) || PALETTES[0];
    root.style.setProperty('--accent', accentOf(p));
    root.style.setProperty('--accent-grad', paletteCSS(p));
  }
  applyScale(store.settings.uiScale);
  applyAccent(store.scene.palette);
  store.on('scene', (scene, keys) => { if (keys.includes('palette')) applyAccent(scene.palette); });
  store.on('settings', (settings, keys) => { if (keys.includes('uiScale')) applyScale(settings.uiScale); });

  // ---- the floating parts -------------------------------------------------------------
  const hud = createHUD(root, {
    onOpen: () => ui.open(),
    onStopRecording: () => run.record(),
    reducedMotion,
  });

  let panel = null;

  // ---- results people should hear about ------------------------------------------------
  let finishedCount = 0; // recordings that reported themselves through capture's 'finished'
  const toast = (text, ms) => hud.toast(text, ms);
  function report(what, r) {
    if (r && r.ok) toast(`${what} saved${where(r)}`);
    else if (r && r.error !== 'cancelled') toast((r && r.error) || `The ${what.toLowerCase()} could not be saved.`);
  }
  const attempt = async (fn) => {
    try { return await fn(); } catch (e) { return { ok: false, error: (e && e.message) || '' }; }
  };
  const run = {
    async photo() {
      const r = await attempt(() => actions.photo());
      report('Photo', r);
      return r;
    },
    async record() {
      const wasRecording = !!(capture && capture.recording);
      const before = finishedCount;
      const r = await attempt(() => actions.toggleRecord());
      if (!wasRecording) {
        if (r && r.ok === false) toast(r.error || 'Recording could not start here.');
        else if (panel && panel.isOpen() && isSheetMode()) panel.close();
      } else if (finishedCount === before) {
        report('Video', r);
      }
      return r;
    },
    async shareLink() {
      const r = await attempt(() => actions.shareLink());
      if (r && r.ok) toast(r.copied ? 'Link copied' : 'Shared');
      else if (r && r.error !== 'cancelled') toast((r && r.error) || 'The link could not be shared.');
      return r;
    },
  };

  // ---- recording state ------------------------------------------------------------
  let recOn = false;
  function setRecording(on, elapsed) {
    if (on && !recOn) toast(hidden ? 'Recording. Press R to stop.' : 'Recording. Tap the red dot to stop.');
    recOn = on;
    hud.setRecording(on, elapsed);
    if (panel) panel.setRecording(on, elapsed);
  }
  if (capture && typeof capture.on === 'function') {
    capture.on('state', (s) => setRecording(!!(s && s.recording), (s && s.elapsed) || 0));
    capture.on('finished', (result) => { finishedCount++; report('Video', result); });
  }

  // ---- the panel, made the first time it is needed ---------------------------------------
  const sideQuery = typeof matchMedia === 'function' ? matchMedia(SIDE_QUERY) : null;
  const isSheetMode = () => !(sideQuery && sideQuery.matches);
  function ensurePanel() {
    if (!panel) {
      panel = createPanel(root, {
        store, actions, platform, audio, run,
        toast: (t) => hud.toast(t),
        announce: (t) => hud.announce(t),
        onClosed: ({ returnFocus }) => {
          hud.setOpen(false);
          hud.wake();
          if (returnFocus && !hidden) hud.openBtn.focus({ preventScroll: true });
        },
      });
      panel.setRecording(recOn, capture ? capture.elapsed || 0 : 0);
    }
    return panel;
  }

  // The on-screen keyboard can cover the bottom sheet: lift it by the covered height.
  const vv = window.visualViewport;
  function onViewport() {
    const covered = Math.max(0, Math.round(innerHeight - vv.height - vv.offsetTop));
    root.style.setProperty('--kb', `${covered > 80 ? covered : 0}px`);
  }
  if (vv) vv.addEventListener('resize', onViewport, { passive: true });

  // ---- first run ----------------------------------------------------------------------
  let intro = null;
  if (!store.settings.introSeen) {
    root.classList.add('is-intro');
    intro = createIntro(root, {
      reducedMotion,
      onBegin: () => {
        // still inside the tap: browsers only allow sound to start from one
        try { actions.unlock(); } catch (e) { console.warn('Tactilume: could not unlock sound', e); }
        store.setSettings({ introSeen: true });
        root.classList.remove('is-intro');
        setTimeout(() => hud.beckon(), 900);
      },
    });
  }
  const introOpen = () => !!(intro && intro.isOpen());

  // ---- hidden controls ------------------------------------------------------------------
  let hidden = false;
  let toldHidden = false;
  const touches = new Map(); // pointerId -> where it went down
  let holdTimer = 0;
  function cancelHold() { clearTimeout(holdTimer); holdTimer = 0; }
  function onHoldDown(e) {
    if (e.pointerType !== 'touch') return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size >= 3 && !holdTimer) {
      holdTimer = setTimeout(() => {
        holdTimer = 0;
        if (touches.size < 3) return;
        restore();
        if (store.settings.haptics && platform && typeof platform.vibrate === 'function') platform.vibrate(12);
      }, RESTORE_HOLD_MS);
    }
  }
  function onHoldMove(e) {
    const t = touches.get(e.pointerId);
    if (t && Math.hypot(e.clientX - t.x, e.clientY - t.y) > RESTORE_SLOP_PX) cancelHold();
  }
  function onHoldUp(e) {
    touches.delete(e.pointerId);
    if (touches.size < 3) cancelHold();
  }
  const HOLD_EVENTS = [['pointerdown', onHoldDown], ['pointermove', onHoldMove], ['pointerup', onHoldUp], ['pointercancel', onHoldUp]];
  function watchHold(on) {
    for (const [name, fn] of HOLD_EVENTS) {
      if (on) addEventListener(name, fn, { passive: true });
      else removeEventListener(name, fn);
    }
    if (!on) { touches.clear(); cancelHold(); }
  }

  // main keeps its own hidden flag, so coming back goes through its action; if the two
  // ever disagreed, the first toggle only hid, and the second one shows
  function restore() {
    if (!hidden) return;
    try {
      actions.toggleUI();
      if (hidden) actions.toggleUI();
    } catch (e) {
      console.warn('Tactilume: could not show the controls', e);
    }
    if (hidden) ui.setHidden(false);
  }

  // ---- keys -----------------------------------------------------------------------------
  function onKey(e) {
    if (e.key !== 'Escape' || e.defaultPrevented || e.isComposing) return;
    if (introOpen()) { e.preventDefault(); intro.close(); return; }
    if (panel && panel.isOpen()) { e.preventDefault(); panel.close({ returnFocus: true }); return; }
    if (isTyping(document.activeElement)) return;
    e.preventDefault();
    if (hidden) restore();
    else ui.open();
  }
  document.addEventListener('keydown', onKey);

  // ---- behaviour names ----------------------------------------------------------------
  const seen = new Map(); // behaviour key -> times shown while someone was playing
  let autopilotOn = false;

  // ---- per frame ----------------------------------------------------------------------
  let hudClock = 0;
  let statsClock = 0;

  const ui = {
    update(dt, f = {}) {
      autopilotOn = !!f.autopilot;
      hudClock += dt;
      if (hudClock >= HUD_EVERY) {
        hudClock = 0;
        const on = !!f.recording;
        if (on || recOn) setRecording(on, capture ? capture.elapsed || 0 : 0);
      }
      if (panel && panel.isOpen()) {
        statsClock += dt;
        if (statsClock >= STATS_EVERY) {
          statsClock = 0;
          panel.setStats(f.fps || 0, f.particles || 0);
        }
      }
    },

    showBehaviour(b) {
      if (!b || !b.name || introOpen()) return;
      // autoplay changes behaviour on its own: name it, but save the explanations for people
      const times = seen.get(b.key) || 0;
      const explain = !autopilotOn && times < BLURB_TIMES;
      if (!autopilotOn) {
        seen.set(b.key, times + 1);
        hud.announce(b.name);
      }
      hud.showBehaviour(b.name, explain ? b.blurb : null);
    },

    toast(text) { hud.toast(text); },
    announce(text) { hud.announce(text); },

    open(tab) {
      if (introOpen()) return;
      if (hidden) restore();
      ensurePanel().open(tab);
      hud.setOpen(true);
    },
    close() { if (panel) panel.close(); },
    isOpen: () => !!(panel && panel.isOpen()),

    back() {
      if (introOpen()) return intro.close();
      if (panel && panel.isOpen()) return panel.close();
      if (hidden) { restore(); return true; }
      return false;
    },

    setHidden(on) {
      const want = !!on;
      if (want === hidden) return;
      hidden = want;
      if (want && panel && panel.isOpen()) panel.close({ returnFocus: false });
      // focus must not stay on a control that is about to vanish
      if (want && root.contains(document.activeElement)) document.activeElement.blur();
      root.classList.toggle('is-hidden', want);
      // the recording dot stays in sight while hidden, but out of the Tab order
      hud.recBtn.tabIndex = want ? -1 : 0;
      watchHold(want);
      if (want) {
        if (!toldHidden) {
          toldHidden = true;
          hud.toast('Controls hidden. Press H, or hold three fingers still for a second, to bring them back.', 5200);
        }
      } else {
        hud.wake();
      }
    },

    // extras, not in the contract: for tests and the console
    get hidden() { return hidden; },
    get tab() { return panel ? panel.tab : null; },
    // photo, record and share with their results shown as toasts (the keyboard uses these)
    run,
  };
  return ui;
}
