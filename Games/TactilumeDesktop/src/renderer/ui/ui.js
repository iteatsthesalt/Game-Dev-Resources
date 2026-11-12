// The overlay: the corner buttons, the Phone, Sound and Settings panels, toasts, the keys,
// gamepad cursor rings, the first-run hint, and the card shown while the light is tuned to
// the computer. See CONTRACTS.md, "renderer/ui/ui.js".
//
// The light is the star, so the controls stay out of its way: after 4 s with no mouse or key,
// the corner buttons fade out and the mouse pointer hides over the light; any input brings
// them back. A panel that is open stays, so a QR code being scanned never vanishes. H hides
// the controls until H again; a faint button in the corner stays as the way back for a
// mouse or a screen reader.
//
// Beyond CONTRACTS.md: createUI also takes gamepads (for the cursor rings and the prompt to
// pads that have not joined), cursorCanvas, test, particlesFixed and refreshHz() (the display's
// rate, for the requirement tier in Settings), and the object it returns also has open(name), close(), panel
// (the open panel's name, or null), update(dt) (each frame), measuring(on), showIntro(),
// syncFullscreen(on), hidden, idle and cursors (what the last frame's rings were).
import { BEHAVIOUR_KEYS } from '../../../../Tactilume/src/js/core/behaviours.js';
import { h, icon } from './dom.js';
import { button } from './controls.js';
import { keyAction } from './keys.js';
import { createPhonePanel } from './phone-panel.js';
import { createSoundPanel, isMusicFile } from './sound-panel.js';
import { createSettingsPanel } from './settings-panel.js';
import { createCursorLayer } from './cursors.js';

const TOAST_MS = 2600;
const MAX_TOASTS = 3;
const IDLE_MS = 4000;             // no mouse or key for this long: the corner buttons fade away
const INTRO_MS = 20000;           // the first-run hint goes by itself after this long
// The controls grow with the window, so they read the same from the sofa on a 4K screen as
// at a desk on a laptop: 1 up to about 1600 × 1000 CSS px, up to 2.2 at 4K.
const SCALE_FROM = { width: 1600, height: 1000 };
const MAX_AUTO_SCALE = 2.2;

// Which keys belong to the focused element rather than to the shortcuts: in a text field all
// of them (bar Esc); on a button, switch or radio, Space and Enter.
function keyOwner(t) {
  if (!t || t === document.body || !(t instanceof Element)) return null;
  if (t.isContentEditable || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return 'text';
  if (t.tagName === 'INPUT') return ['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'file'].includes(t.type) ? 'control' : 'text';
  if (['BUTTON', 'A', 'SUMMARY'].includes(t.tagName) || t.getAttribute('role') === 'button') return 'control';
  return null;
}

export function createUI({ root, store, actions, bridge, engine, audio, hub, desktop, gamepads = null, cursorCanvas = null, test = false, particlesFixed = false, refreshHz = () => 60 }) {
  root.replaceChildren();
  root.classList.add('tl-root');
  const cleanups = [];
  const listen = (target, type, fn, options) => {
    target.addEventListener(type, fn, options);
    cleanups.push(() => target.removeEventListener(type, fn, options));
  };

  // ---- toasts ---------------------------------------------------------------------------------
  const toasts = h('div', { class: 'tl-toasts', role: 'status', 'aria-live': 'polite' });
  function toast(text) {
    if (!text) return;
    const el = h('div', { class: 'tl-toast', text: String(text) });
    toasts.append(el);
    while (toasts.children.length > MAX_TOASTS) toasts.firstElementChild.remove();
    void el.offsetWidth; // so the fade-in starts from its first style
    el.classList.add('is-in');
    setTimeout(() => {
      el.classList.add('is-out');
      setTimeout(() => el.remove(), 400);
    }, TOAST_MS);
  }

  // ---- panels ---------------------------------------------------------------------------------
  const phone = createPhonePanel({ bridge, hub, toast, onClose: () => close() });
  const sound = createSoundPanel({ audio, bridge, toast, onClose: () => close() });
  const settings = createSettingsPanel({ store, desktop, bridge, engine, actions, particlesFixed, refreshHz, toast, onClose: () => close() });
  const panels = { phone, sound, settings };
  let current = null;             // the open panel's name
  let opener = null;              // what had the focus before it opened

  // ---- the corner -----------------------------------------------------------------------------
  const chip = (label, iconName, props) => h('button', { type: 'button', class: 'tl-chip', ...props }, icon(iconName), h('span', { class: 'tl-chip-text', text: label }));
  // `key`: the shortcut, or none (an empty aria-keyshortcuts names no key, so it is left off)
  const panelChip = (name, label, iconName, key) => chip(label, iconName, {
    'aria-expanded': 'false', 'aria-controls': `tl-panel-${name}`, 'aria-keyshortcuts': key || undefined, title: key ? `${label} (${key})` : label,
    onclick: () => (current === name ? close() : open(name)),
  });
  const chips = {
    phone: panelChip('phone', 'Phone', 'phone', 'P'),
    sound: panelChip('sound', 'Sound', 'sound', 'S'),
    settings: panelChip('settings', 'Settings', 'settings'),
  };
  const fullChip = chip('Full screen', 'fullscreen', { 'aria-pressed': 'false', 'aria-keyshortcuts': 'F', title: 'Full screen (F)', onclick: () => actions.toggleFullscreen() });
  const corner = h('nav', { class: 'tl-corner', 'aria-label': 'Tactilume controls' }, chips.phone, chips.sound, chips.settings, fullChip);
  const showButton = h('button', { type: 'button', class: 'tl-show', hidden: true, 'aria-keyshortcuts': 'H', onclick: () => setHidden(false) },
    icon('eye'), h('span', { text: 'Show controls' }));

  // ---- the first-run hint, and the card while the light is tuned ---------------------------------
  const keyLine = (key, text) => h('li', {}, h('kbd', { text: key }), h('span', { text }));
  // A gamepad joins at its first press of any button (gamepad.js), so it is shown as a
  // gamepad, not as a key on the keyboard
  const padLine = (text) => h('li', { class: 'tl-intro-pad' }, h('span', { class: 'tl-intro-icon' }, icon('gamepad')), h('span', { text }));
  const intro = h('div', { class: 'tl-intro', role: 'note', 'aria-live': 'polite', hidden: true },
    h('p', { class: 'tl-intro-title', text: 'Drag across the light to play' }),
    h('ul', { class: 'tl-intro-keys' },
      keyLine('P', 'Play with phones: scan the code'),
      padLine('Play with a gamepad: press any button to join in'),
      keyLine('S', 'Move the light with sound'),
      keyLine('H', 'Hide the controls'),
      keyLine('F', 'Full screen')),
    button('Got it', { variant: 'primary', onClick: () => dismissIntro() }));
  let introTimer = 0;
  const measureCard = h('div', { class: 'tl-measure', role: 'status', hidden: true },
    h('p', { class: 'tl-measure-title', text: 'Tuning the light to this computer' }),
    h('p', { class: 'tl-measure-text', text: 'This takes about ten seconds, once for each graphics card.' }),
    h('div', { class: 'tl-progress', 'aria-hidden': 'true' }, h('span')));
  const dropZone = h('div', { class: 'tl-drop', hidden: true, 'aria-hidden': 'true' }, icon('music'), h('p', { text: 'Drop a music file to play it' }));
  // Gamepads that are plugged in but have not joined: a pad joins at its first button press,
  // which nobody guesses without being told.
  const padList = h('ul', { class: 'tl-pads-list' });
  const padBox = h('div', { class: 'tl-pads', role: 'status', 'aria-live': 'polite', hidden: true }, padList);

  root.append(corner, showButton, phone.panel.el, sound.panel.el, settings.panel.el, toasts, intro, measureCard, dropZone, padBox);

  // ---- opening and closing ----------------------------------------------------------------------
  function open(name) {
    const p = panels[name];
    if (!p) return;
    if (hidden) setHidden(false);
    if (current === name) return void p.focusTarget().focus();
    if (current) close({ restoreFocus: false });
    else opener = document.activeElement;
    current = name;
    p.panel.setOpen(true);
    chips[name].setAttribute('aria-expanded', 'true');
    root.classList.add('is-panel-open');
    p.onOpen();
    p.focusTarget().focus();
    wake();
  }

  function close({ restoreFocus = true } = {}) {
    if (!current) return;
    const name = current;
    const p = panels[name];
    const hadFocus = p.panel.el.contains(document.activeElement);
    p.panel.setOpen(false);
    p.onClose();
    chips[name].setAttribute('aria-expanded', 'false');
    current = null;
    root.classList.remove('is-panel-open');
    if (!restoreFocus || !hadFocus) return;
    // back to what opened it: a corner button, or the light when a key opened it
    if (opener && opener !== document.body && opener.isConnected && !opener.closest('[inert]')) opener.focus();
    else document.activeElement?.blur();
    opener = null;
  }

  // ---- hidden, and idle ---------------------------------------------------------------------------
  let hidden = false;
  let hiddenToldOnce = false;
  function setHidden(on) {
    hidden = !!on;
    // The focus must not stay on a button that is going away: Chromium can leave it on an
    // inert element for a moment, and Space would then press that unseen button instead of
    // sending out light.
    const focusWasIn = (el) => el.contains(document.activeElement);
    const fromCorner = focusWasIn(corner) || (current && focusWasIn(panels[current].panel.el));
    const fromShow = focusWasIn(showButton);
    root.classList.toggle('is-hidden', hidden);
    if (hidden) {
      close({ restoreFocus: false });
      if (fromCorner) document.activeElement.blur();
    }
    corner.inert = hidden;
    showButton.hidden = !hidden;
    if (hidden) {
      // Start on a gamepad hides them too, and a player on the sofa may have no keyboard
      if (!hiddenToldOnce) toast('Controls hidden. Press H, or Start on a gamepad, to show them again.');
      hiddenToldOnce = true;
    } else if (fromShow) {
      // brought back with the keyboard: carry on from the first corner button
      chips.phone.focus();
    }
    wake();
  }

  let idle = false;
  let idleTimer = 0;
  function goIdle() {
    // an open panel, or the keyboard among the corner buttons, keeps the controls there
    const keyboardHere = corner.contains(document.activeElement) && document.activeElement.matches(':focus-visible');
    if (current || keyboardHere || !measureCard.hidden) {
      idleTimer = setTimeout(goIdle, IDLE_MS);
      return;
    }
    idle = true;
    root.classList.add('is-idle');
    document.documentElement.classList.add('tl-idle');
  }
  function wake() {
    if (idle) {
      idle = false;
      root.classList.remove('is-idle');
      document.documentElement.classList.remove('tl-idle');
    }
    clearTimeout(idleTimer);
    idleTimer = setTimeout(goIdle, IDLE_MS);
  }
  // A drag across the light (a button held down) is playing it, not looking for the controls,
  // so only a free move, a click, the wheel or a key brings them back.
  const onPointer = (e) => { if (!(e.type === 'pointermove' && e.buttons)) wake(); };
  for (const type of ['pointermove', 'pointerdown']) listen(window, type, onPointer, { passive: true, capture: true });
  for (const type of ['wheel', 'keydown']) listen(window, type, wake, { passive: true, capture: true });
  wake();

  // ---- the size of the controls ---------------------------------------------------------------
  let scale = 1;
  function applyScale() {
    const auto = Math.min(MAX_AUTO_SCALE, Math.max(1, Math.min(innerWidth / SCALE_FROM.width, innerHeight / SCALE_FROM.height)));
    scale = auto * (Number(store.settings.uiScale) || 1);
    root.style.setProperty('--ui-scale', scale.toFixed(3));
  }
  applyScale();
  cleanups.push(store.on('settings', applyScale));

  // ---- full screen ----------------------------------------------------------------------------
  function syncFullscreen(on) {
    fullChip.setAttribute('aria-pressed', String(!!on));
    fullChip.firstElementChild.replaceWith(icon(on ? 'window' : 'fullscreen'));
  }
  let fullTimer = 0;
  // the system can change it too (the window's own button, the menu, F11): a resize follows
  listen(window, 'resize', () => {
    applyScale();
    clearTimeout(fullTimer);
    fullTimer = setTimeout(() => bridge.app.isFullscreen().then(syncFullscreen).catch(() => {}), 250);
  });
  bridge.app.isFullscreen().then(syncFullscreen).catch(() => {});

  // ---- the first-run hint ---------------------------------------------------------------------------
  function revealIntro() {
    if (!intro.hidden) return;
    intro.hidden = false;
    void intro.offsetWidth;
    intro.classList.add('is-in');
    introTimer = setTimeout(() => dismissIntro(), INTRO_MS);
  }
  function dismissIntro() {
    if (intro.hidden) return;
    clearTimeout(introTimer);
    intro.classList.remove('is-in');
    intro.hidden = true;
    desktop.set({ intro: false });
  }
  // playing on the light is the hint taken
  listen(window, 'pointerdown', (e) => { if (!intro.hidden && !intro.contains(e.target)) dismissIntro(); }, { passive: true });

  // ---- a music file dropped on the window -----------------------------------------------------
  let dragDepth = 0;
  const carriesFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
  listen(window, 'dragenter', (e) => {
    if (!carriesFiles(e)) return;
    e.preventDefault();
    dragDepth++;
    dropZone.hidden = false;
  });
  listen(window, 'dragover', (e) => {
    if (!carriesFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });
  listen(window, 'dragleave', (e) => {
    if (!carriesFiles(e)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) dropZone.hidden = true;
  });
  listen(window, 'drop', (e) => {
    if (!carriesFiles(e)) return;
    // never let the page be replaced by the file
    e.preventDefault();
    dragDepth = 0;
    dropZone.hidden = true;
    const file = [...e.dataTransfer.files].find(isMusicFile);
    if (file) sound.playFile(file);
    else toast('That is not a music file Tactilume can play.');
  });

  // ---- the keys ----------------------------------------------------------------------------------
  function run(k) {
    if (k.id !== 'escape' && k.id !== 'hide') dismissIntro();
    switch (k.id) {
      case 'fullscreen': return actions.toggleFullscreen();
      case 'hide': return actions.toggleUI();
      case 'phone': return actions.togglePhonePanel();
      case 'sound': return current === 'sound' ? close() : open('sound');
      case 'pulse': {
        // the middle of the window, wherever the camera has drifted
        const c = engine.screenToWorld(innerWidth / 2, innerHeight / 2);
        return actions.pulse(c.x, c.y, 1);
      }
      case 'behaviour': return actions.setBehaviour(BEHAVIOUR_KEYS[k.index]);
      case 'nextBehaviour': return actions.nextBehaviour(k.dir);
      case 'palette': return actions.nextPalette(k.dir);
      case 'preset': return actions.nextPreset(k.dir);
      case 'surprise': return actions.surprise();
      case 'escape':
        if (current) return close();
        if (!intro.hidden) return dismissIntro();
        return bridge.app.isFullscreen().then((on) => { if (on) actions.toggleFullscreen(); }).catch(() => {});
      default: return undefined;
    }
  }
  function onKey(e) {
    // A held key does not repeat its shortcut: panels would flicker open and shut, and a held
    // Space would fire pulses in one spot as fast as the key repeats.
    if (e.defaultPrevented || e.isComposing) return;
    if (e.repeat) {
      if (keyAction(e)) e.preventDefault();
      return;
    }
    const k = keyAction(e);
    if (!k) return;
    const owner = keyOwner(e.target);
    if (owner === 'text' && k.id !== 'escape') return;
    if (owner === 'control' && (e.key === ' ' || e.key === 'Enter')) return;
    e.preventDefault();
    Promise.resolve(run(k)).catch((err) => console.warn('A shortcut failed:', err));
  }
  listen(window, 'keydown', onKey);

  // ---- gamepad cursors ------------------------------------------------------------------------
  const cursorLayer = cursorCanvas ? createCursorLayer(cursorCanvas, { hub, gamepads, engine, scale: () => scale }) : null;

  // ---- gamepads waiting to join ----------------------------------------------------------------
  // Redrawn only when the pads waiting change. A pad newly waiting wakes the controls, so the
  // prompt shows; it fades with them when nobody does anything.
  let shownPads = [];
  function showPads() {
    let list = [];
    try { list = typeof gamepads?.pads === 'function' ? gamepads.pads() : []; } catch { list = []; }
    const waiting = list.filter((p) => p && !p.joined).map((p) => `${p.pad}:${p.standard ? 's' : 'o'}`);
    if (waiting.join() === shownPads.join()) return;
    const fresh = waiting.some((w) => !shownPads.includes(w));
    shownPads = waiting;
    padList.replaceChildren(...list.filter((p) => p && !p.joined).map((p) => h('li', { class: 'tl-pad-prompt' },
      icon('gamepad'),
      h('span', { text: `Gamepad ${p.pad}: press any button to join.${p.standard ? '' : ' Its buttons may be in other places than the Gamepad list in Settings shows.'}` }))));
    padBox.hidden = waiting.length === 0;
    if (fresh) wake();
  }

  return {
    // hides or shows the controls; toasts still appear while they are hidden
    toggle() { setHidden(!hidden); },
    isOpen: () => current !== null,
    toast,
    showPhonePanel(on) {
      if (on) open('phone');
      else if (current === 'phone') close();
    },
    open,
    close: () => close(),
    get panel() { return current; },
    get hidden() { return hidden; },
    get idle() { return idle; },
    get cursors() { return cursorLayer ? cursorLayer.cursors : []; },
    // each frame, from the frame loop
    update(dt) {
      cursorLayer?.update();
      showPads();
      if (current === 'sound') sound.update(dt);
    },
    measuring(on) {
      measureCard.hidden = !on;
      settings.measuring(on);
      if (on) wake();
    },
    showIntro() { if (!test) revealIntro(); },
    syncFullscreen,
    dispose() {
      for (const fn of cleanups.splice(0)) fn();
      clearTimeout(idleTimer);
      clearTimeout(introTimer);
      clearTimeout(fullTimer);
      for (const p of Object.values(panels)) p.dispose();
      cursorLayer?.dispose();
      document.documentElement.classList.remove('tl-idle');
      root.replaceChildren();
    },
  };
}
