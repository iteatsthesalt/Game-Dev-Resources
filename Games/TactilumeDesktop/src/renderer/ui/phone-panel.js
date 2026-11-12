// The phone panel: how to join, the QR code and the same address as text, who is playing in
// which colour, whether new phones may join, a new code, and help for when a phone cannot
// connect. See CONTRACTS.md, "renderer/ui/ui.js".
import { h, cssColor } from './dom.js';
import { button, switchField, notice, disclosure, section } from './controls.js';
import { createPanel } from './panel.js';

const REFRESH_MS = 2000;          // while open, the link is asked again this often: phones come and go
const STUCK_MS = 45000;           // open this long with no phone joined: the connection help opens by itself

// The QR code arrives as SVG text; as an image source it can never run or inject anything.
export const svgImage = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

const KIND = { phone: 'Phone', gamepad: 'Gamepad', pointer: 'Mouse' };

// What can stop a phone reaching this computer, and where to look, for this computer's system.
export function connectionTips(platform, port) {
  const tips = [
    'Check that the phone is on the same Wi-Fi as this computer, not on mobile data or a guest network.',
    'Some networks keep devices apart, often in public places or with “client isolation” on the router. A home network usually lets them reach each other.',
  ];
  if (platform === 'win32') {
    tips.push('Windows may have asked whether Tactilume may use networks. If phones still cannot connect, open Windows Security, then Firewall & network protection, then “Allow an app through firewall”, and tick Private for Tactilume. Windows must also count this network as Private, not Public.');
  } else if (platform === 'darwin') {
    tips.push('If macOS asks whether Tactilume may accept incoming network connections, choose Allow. That list is in System Settings, under Network, then Firewall.');
  } else if (platform === 'linux') {
    tips.push(`If a firewall such as ufw or firewalld is on, let the local network reach TCP port ${port || 47615}.`);
  }
  return tips;
}

// A phone player's number on the link (its slot, 1..8), from its hub key; 0 for any other player.
const phoneSlot = (p) => (p.kind === 'phone' ? Number(/^phone([1-8])$/.exec(p.key || '')?.[1] || 0) : 0);

// A player as the list shows them: name, and what they play with (phones by their number,
// which is what their own screen says).
function describe(p) {
  const slot = p.kind === 'phone' ? /^phone(\d+)$/.exec(p.key || '')?.[1] : null;
  const kind = slot ? `Phone ${slot}` : KIND[p.kind] || 'Player';
  const name = p.name && p.name !== kind ? p.name : kind;
  return { name, kind: name === kind ? KIND[p.kind] || '' : kind };
}

export function createPhonePanel({ bridge, hub, toast, onClose }) {
  const panel = createPanel({ name: 'phone', eyebrow: 'Phones', title: 'Play with a phone', onClose });
  const qr = h('img', { class: 'tl-qr', alt: 'QR code that opens the controller page on a phone', draggable: 'false' });
  const url = h('output', { class: 'tl-url', 'aria-label': 'The controller page’s address' });
  const copy = button('Copy', { iconName: 'copy', variant: 'quiet', ariaLabel: 'Copy the address', onClick: copyAddress });
  const join = h('div', { class: 'tl-join' },
    h('ol', { class: 'tl-steps' },
      h('li', { text: 'Join the phone to the same Wi-Fi as this computer.' }),
      h('li', { text: 'Point its camera at the code, then open the page it finds.' })),
    h('div', { class: 'tl-qr-box' }, qr),
    h('div', { class: 'tl-address' },
      h('p', { class: 'tl-address-label', text: 'Or type this address into the phone’s browser:' }),
      h('div', { class: 'tl-address-row' }, url, copy)));
  const linkNote = notice();
  const list = h('ul', { class: 'tl-players', 'aria-label': 'Players' });
  const empty = h('p', { class: 'tl-empty', text: 'Nobody is playing yet. Phones, gamepads and the mouse appear here as they join, each with its own colour.' });
  const allow = switchField({ label: 'Let new phones join', help: 'Turn this off once everyone is in. Phones playing now stay.', onChange: setAllow });
  const newCode = button('New code', { iconName: 'refresh', onClick: rotate });
  const tipList = h('ul', { class: 'tl-tips' });
  const help = disclosure('Phone cannot connect?', tipList);

  panel.body.append(
    join,
    linkNote.el,
    section('Playing now', list, empty),
    section('Joining',
      allow.el,
      h('div', { class: 'tl-field' }, newCode, h('p', { class: 'tl-help', text: 'Phones playing now stay. Any other phone needs the new code.' }))),
    h('div', { class: 'tl-section' }, help.el));

  let info = null;
  let open = false;
  let refreshTimer = 0;
  let stuckTimer = 0;
  // What is on screen now. The link is asked again every 2 s, and only what changed is
  // redrawn, so a screen reader moving through the list is not thrown back to its start.
  let shownQr = '';
  let shownTips = '';
  let shownPlayers = '';
  let confirming = 0;             // the phone (slot) whose removal is being asked about
  let focusAfter = null;          // what to focus once the list is redrawn

  function showInfo(next) {
    info = next;
    const reachable = !!(info.running && info.url);
    if (info.qrSvg && info.qrSvg !== shownQr) {
      shownQr = info.qrSvg;
      qr.src = svgImage(info.qrSvg);
    }
    join.hidden = !reachable;
    if (url.textContent !== (info.url || '')) url.textContent = info.url || '';
    if (!info.running) linkNote.show('The phone link could not start, so phones cannot join. Another program may be using its network port: restart Tactilume to try again.', 'error');
    else if (!info.url) linkNote.show('This computer is not on a local network. Connect it to the same Wi-Fi or network as the phone, and the code appears here.', 'error');
    else linkNote.hide();
    allow.set(info.allowNew);
    allow.setDisabled(!info.running);
    newCode.disabled = !info.running;
    const tips = connectionTips(bridge.platform, info.port);
    if (tips.join('\n') !== shownTips) {
      shownTips = tips.join('\n');
      tipList.replaceChildren(...tips.map((t) => h('li', { text: t })));
    }
    if (info.phones?.length) clearTimeout(stuckTimer);
  }

  // The phones the link holds now: only those can be removed (a phone still fading out on the
  // big screen has already gone).
  const linked = () => new Set((info?.phones || []).map((p) => p.player));

  function showPlayers() {
    const players = hub.players();
    const onLink = linked();
    const signature = JSON.stringify([confirming, [...onLink], players.map((p) => [p.id, p.name, p.kind, p.key, p.colorName, p.color])]);
    if (signature === shownPlayers) return;
    shownPlayers = signature;
    list.replaceChildren(...players.map((p) => {
      const d = describe(p);
      const dot = h('span', { class: 'tl-player-dot', 'aria-hidden': 'true' });
      dot.style.setProperty('--player', cssColor(p.color));
      // the colour is named as well as shown (the hub names each of its colours)
      const about = [d.kind, p.colorName].filter(Boolean).join(' · ');
      const slot = phoneSlot(p);
      const removable = slot && onLink.has(slot);
      const label = slot ? (d.name === `Phone ${slot}` ? d.name : `Phone ${slot} (${d.name})`) : '';
      const asking = removable && confirming === slot;
      const row = h('li', { class: 'tl-player' }, dot,
        h('span', { class: 'tl-player-name', text: d.name }),
        about ? h('span', { class: 'tl-player-kind', text: about }) : null,
        removable && !asking ? button('Remove', { variant: 'quiet', ariaLabel: `Remove ${label}`, onClick: () => ask(slot) }) : null);
      if (!asking) return row;
      // Removing is for good (the code changes too), so it is asked once more, with the safe
      // answer first and focused.
      const keep = button('Keep playing', { ariaLabel: `Keep ${d.name} playing`, onClick: () => ask(0, slot) });
      const confirm = h('div', { class: 'tl-player-confirm', role: 'group', 'aria-label': `Remove ${label}?` },
        h('p', { text: `Remove ${d.name} from the game? The code changes too, so only phones given the new code can join after.` }),
        h('div', { class: 'tl-player-confirm-row' }, keep,
          button('Remove', { variant: 'danger', ariaLabel: `Remove ${label} for good`, onClick: () => kick(slot, label) })));
      focusAfter = keep;
      return [row, h('li', { class: 'tl-player-asking' }, confirm)];
    }).flat());
    list.hidden = !players.length;
    empty.hidden = players.length > 0;
    if (focusAfter) {
      focusAfter.focus();
      focusAfter = null;
    }
  }

  // `slot`: the phone to ask about, or 0 to stop asking (then the focus goes back to the
  // Remove button of `back`)
  function ask(slot, back = 0) {
    confirming = slot;
    shownPlayers = '';
    showPlayers();
    if (back) list.querySelector(`[aria-label^="Remove Phone ${back}"]`)?.focus();
  }

  async function kick(slot, label) {
    confirming = 0;
    try {
      const next = await bridge.link.kick(slot);
      showInfo(next);
      toast(next.kicked ? `${label} was removed. There is a new code for anyone joining now.` : `${label} had already left.`);
    } catch (e) {
      linkNote.show(`${label} was not removed (${e?.message || e}).`, 'error');
    }
    shownPlayers = '';
    showPlayers();
    panel.closeButton.focus();
  }

  async function refresh() {
    try {
      showInfo(await bridge.link.info());
    } catch (e) {
      linkNote.show(`The phone link did not answer (${e?.message || e}).`, 'error');
    }
    showPlayers();
  }

  async function setAllow(on) {
    try {
      showInfo(await bridge.link.setAllowNew(on));
      toast(on ? 'New phones can join' : 'No new phones can join now');
    } catch (e) {
      allow.set(!on);
      linkNote.show(`That did not change (${e?.message || e}).`, 'error');
    }
  }

  async function rotate() {
    try {
      showInfo(await bridge.link.rotateToken());
      toast('There is a new code. Phones playing now stay.');
    } catch (e) {
      linkNote.show(`No new code was made (${e?.message || e}).`, 'error');
    }
  }

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(info?.url || '');
      toast('Address copied');
    } catch {
      toast('Could not copy. Select the address and copy it instead.');
    }
  }

  // a player came or went: the link is asked again too, so a phone that just joined can be removed
  const offPlayers = hub.on('players', () => {
    if (!open) return;
    showPlayers();
    refresh();
  });

  // Nobody has joined after a while: the likely causes are worth showing unasked. At 1280 x 720
  // the help sits far below the QR code, so the panel scrolls to it (only the panel's own body
  // scrolls), and a toast says so for anyone not looking at the panel or using a screen reader.
  function showHelpUnasked() {
    if (!open || info?.phones?.length) return;
    help.setOpen(true);
    const body = panel.body;
    const top = help.el.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop;
    const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    body.scrollTo({ top: Math.max(0, top - 8), behavior: still ? 'auto' : 'smooth' });
    toast('No phone has joined yet. The Phone panel now shows what to check.');
  }

  return {
    panel,
    focusTarget: () => panel.closeButton,
    onOpen() {
      open = true;
      refresh();
      clearInterval(refreshTimer);
      refreshTimer = setInterval(refresh, REFRESH_MS);
      clearTimeout(stuckTimer);
      stuckTimer = setTimeout(showHelpUnasked, STUCK_MS);
    },
    onClose() {
      open = false;
      confirming = 0;
      clearInterval(refreshTimer);
      clearTimeout(stuckTimer);
    },
    dispose() {
      offPlayers();
      clearInterval(refreshTimer);
      clearTimeout(stuckTimer);
    },
  };
}
