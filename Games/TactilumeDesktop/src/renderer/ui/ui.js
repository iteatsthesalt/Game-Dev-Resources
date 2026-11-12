// The overlay: corner buttons, the phone panel, toasts and the keys. See CONTRACTS.md,
// "renderer/ui/ui.js".
//
// First version, written by the spine: the keys, toasts and a plain phone panel work; the
// Sound and Settings panels and hiding after 4 s idle are still to come. The shell-ui part
// owns this file and replaces it.
import { BEHAVIOUR_KEYS } from '../../../../Tactilume/src/js/core/behaviours.js';

const TOAST_MS = 2500;

function button(label, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

// The QR code arrives as SVG text; as an image source it can never run or inject anything.
const svgImage = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

export function createUI({ root, store, actions, bridge, engine, audio, hub, desktop }) {
  root.replaceChildren();
  let panelOpen = false;
  let toastTimer = 0;

  const corner = document.createElement('div');
  corner.className = 'corner';
  const phoneButton = button('Phone', () => showPhonePanel(!panelOpen));
  phoneButton.setAttribute('aria-expanded', 'false');
  phoneButton.setAttribute('aria-controls', 'phone-panel');
  corner.append(phoneButton, button('Full screen', () => actions.toggleFullscreen()));

  const panel = document.createElement('section');
  panel.id = 'phone-panel';
  panel.className = 'panel';
  panel.hidden = true;
  panel.setAttribute('aria-labelledby', 'phone-panel-title');
  const title = document.createElement('h2');
  title.id = 'phone-panel-title';
  title.textContent = 'Play with a phone';
  const help = document.createElement('p');
  help.textContent = 'Scan the code with a phone on the same network, or type the address into its browser.';
  const qr = document.createElement('img');
  qr.className = 'qr';
  qr.alt = 'QR code for the controller page';
  const address = document.createElement('p');
  address.className = 'address';
  const players = document.createElement('ul');
  players.className = 'players';
  players.setAttribute('aria-label', 'Phones playing');
  const allowLabel = document.createElement('label');
  const allow = document.createElement('input');
  allow.type = 'checkbox';
  allow.addEventListener('change', () => bridge.link.setAllowNew(allow.checked).then(refreshPanel));
  allowLabel.append(allow, ' Allow new phones');
  const close = button('Close', () => showPhonePanel(false));
  panel.append(title, help, qr, address, players, allowLabel,
    button('New code', () => bridge.link.rotateToken().then(refreshPanel)), close);

  const toastBox = document.createElement('div');
  toastBox.className = 'toast';
  toastBox.setAttribute('role', 'status');
  toastBox.hidden = true;

  root.append(corner, panel, toastBox);

  async function refreshPanel() {
    const info = await bridge.link.info();
    if (info.qrSvg) qr.src = svgImage(info.qrSvg);
    qr.hidden = !info.qrSvg;
    address.textContent = info.url
      || (info.running
        ? 'No local network found. Connect this computer to the same Wi-Fi or network as the phone.'
        : 'The phone link could not start.');
    allow.checked = !!info.allowNew;
    players.replaceChildren(...hub.players().filter((p) => p.kind === 'phone').map((p) => {
      const li = document.createElement('li');
      li.textContent = p.name;
      // the colour is shown, and the name says who it is: colour is never the only signal
      li.style.setProperty('--player', `rgb(${p.color.map((c) => Math.round(c * 255)).join(' ')})`);
      return li;
    }));
  }

  function showPhonePanel(on) {
    panelOpen = !!on;
    panel.hidden = !panelOpen;
    phoneButton.setAttribute('aria-expanded', String(panelOpen));
    if (panelOpen) {
      refreshPanel();
      close.focus();
    } else if (panel.contains(document.activeElement)) {
      phoneButton.focus();
    }
  }
  const offPlayers = hub.on('players', () => { if (panelOpen) refreshPanel(); });

  function toast(text) {
    toastBox.textContent = text;
    toastBox.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastBox.hidden = true; }, TOAST_MS);
  }

  const typing = (t) => t && (t.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName));
  function onKey(e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (key === 'f') actions.toggleFullscreen();
    else if (key === 'h') actions.toggleUI();
    else if (key === 'p') actions.togglePhonePanel();
    // Space on a focused button presses the button instead
    else if (key === ' ' && !(e.target instanceof HTMLButtonElement)) actions.pulse(0, 0, 1);
    else if (key === '[' || key === ']') actions.nextPalette(key === ']' ? 1 : -1);
    else if (key === ',' || key === '.') actions.nextPreset(key === '.' ? 1 : -1);
    // 1 is the first behaviour, 0 the tenth
    else if (/^[0-9]$/.test(key)) actions.setBehaviour(BEHAVIOUR_KEYS[(Number(key) + 9) % 10]);
    else if (key === 'Escape' && panelOpen) showPhonePanel(false);
    else return;
    e.preventDefault();
  }
  addEventListener('keydown', onKey);

  return {
    // hides or shows the controls; toasts still appear while they are hidden
    toggle() {
      corner.hidden = !corner.hidden;
      if (corner.hidden) showPhonePanel(false);
    },
    isOpen: () => panelOpen,
    toast,
    showPhonePanel,
    dispose() {
      removeEventListener('keydown', onKey);
      offPlayers();
      clearTimeout(toastTimer);
      root.replaceChildren();
    },
  };
}
