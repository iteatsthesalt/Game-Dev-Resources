// The sound panel: what the light listens to (nothing, a microphone, what the computer plays,
// or a music file), which input device, and a meter that shows what it hears. See
// CONTRACTS.md, "renderer/ui/ui.js" and "renderer/audio/".
//
// The audio module keeps the state (source, label, error, hint, and a 'change' event when any
// of them change, say when a microphone is unplugged); this panel shows it and asks for
// changes. Its failures come as sentences a person can act on, shown here as they are.
//
// The sources are separate buttons rather than a radio group on purpose: with radios, moving
// through them with the arrow keys would choose each one on the way, and passing over
// "Microphone" would ask for the microphone.
import { h, icon } from './dom.js';
import { button, selectField, notice, section } from './controls.js';
import { createPanel } from './panel.js';

// The kinds of file people mean by "a music file"; the type is checked too, where the system knows it.
const MUSIC = /\.(mp3|m4a|aac|wav|wave|ogg|oga|opus|flac|webm|weba)$/i;
export const isMusicFile = (file) => !!file && (/^audio\//.test(file.type || '') || MUSIC.test(file.name || ''));

// A failure, as a sentence: the audio module's own words when it gave them, or the browser's.
export function soundError(error) {
  const e = typeof error === 'string' ? { message: error } : error || {};
  if (e.name === 'NotAllowedError') return 'Tactilume was not allowed to listen. Check the system’s privacy settings, then try again.';
  if (e.name === 'NotFoundError') return 'No input device was found. Plug one in, or choose another sound.';
  const text = String(e.message || 'That did not start').trim().replace(/\.?$/, '.');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const BANDS = [['level', 'Level'], ['bass', 'Bass'], ['mid', 'Mids'], ['high', 'Treble']];

export function createSoundPanel({ audio, bridge, toast, onClose }) {
  const panel = createPanel({ name: 'sound', eyebrow: 'Sound', title: 'Play with sound', onClose });
  let system = { supported: false, how: 'none' };
  let busy = false;
  let revealed = false;            // whether the input names have been asked for

  const sourceButton = (source, label, iconName, onClick) => h('button', {
    type: 'button', class: 'tl-source', 'aria-pressed': 'false', 'data-source': source, onclick: onClick,
  }, icon(iconName), h('span', { text: label }));
  const buttons = {
    off: sourceButton('off', 'Off', 'off', () => choose('off')),
    mic: sourceButton('mic', 'Microphone', 'mic', () => choose('mic')),
    system: sourceButton('system', 'Computer audio', 'speaker', () => choose('system')),
    file: sourceButton('file', 'Music file', 'music', () => picker.click()),
  };
  buttons.system.hidden = true;
  const sources = h('div', { class: 'tl-sources', role: 'group', 'aria-label': 'Listen to' }, Object.values(buttons));

  const device = selectField({
    label: 'Input',
    help: 'The microphone or line-in the light listens to.',
    onChange: (id) => choose('mic', id),
  });
  // the names of the inputs are private until a microphone is allowed: ask when the list is opened
  const reveal = () => { if (!revealed) listDevices({ reveal: true }); };
  device.select.addEventListener('pointerdown', reveal);
  device.select.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ' || e.key.startsWith('Arrow')) reveal(); });
  device.el.hidden = true;

  const picker = h('input', {
    type: 'file', accept: 'audio/*,.mp3,.m4a,.aac,.wav,.ogg,.opus,.flac,.webm', class: 'tl-file-input', tabindex: '-1', 'aria-hidden': 'true',
    onchange: () => {
      const file = picker.files?.[0];
      picker.value = '';
      if (file) playFile(file);
    },
  });
  const songName = h('span', { class: 'tl-song-name' });
  const fileRow = h('div', { class: 'tl-field tl-song', hidden: true },
    icon('music', 'tl-icon tl-song-icon'),
    h('span', { class: 'tl-song-text' }, h('span', { class: 'tl-song-eyebrow', text: 'Playing' }), songName),
    button('Another file', { variant: 'quiet', onClick: () => picker.click() }));
  const systemHelp = h('p', { class: 'tl-help', hidden: true });
  const status = notice();

  const bars = BANDS.map(([key, label]) => {
    const bar = h('span', { class: 'tl-meter-fill' });
    return { key, bar, el: h('div', { class: 'tl-meter-row' }, h('span', { class: 'tl-meter-label', text: label }), h('span', { class: 'tl-meter-track' }, bar)) };
  });
  const beat = h('span', { class: 'tl-meter-beat', text: 'Beat' });
  const meter = h('div', { class: 'tl-meter', 'aria-hidden': 'true' }, bars.map((b) => b.el), beat);

  panel.body.append(
    h('p', { class: 'tl-lead', text: 'The light can move with sound: with its loudness, its bass, mids and treble, and its beat. What it hears stays on this computer.' }),
    section('Listen to', sources, systemHelp, device.el, fileRow,
      h('p', { class: 'tl-help tl-drop-hint', text: 'You can also drop a music file anywhere on the window.' })),
    status.el,
    section('What the light hears', meter, h('p', { class: 'tl-help', text: 'The bars move when sound comes in.' })),
    picker);

  // the buttons, the input list, the file and any message, as the audio module has them now
  function sync() {
    const source = audio.source || 'off';
    for (const [key, b] of Object.entries(buttons)) {
      b.setAttribute('aria-pressed', String(key === source));
      b.disabled = busy;
    }
    device.el.hidden = source !== 'mic';
    fileRow.hidden = source !== 'file';
    songName.textContent = source === 'file' ? audio.label || 'Music file' : '';
    if (busy) return;
    if (audio.error) status.show(soundError(audio.error), 'error');
    else if (audio.hint) status.show(audio.hint);
    else status.hide();
  }

  async function listDevices({ reveal: ask = false } = {}) {
    if (ask) revealed = true;
    let list = [];
    try { list = await audio.devices({ reveal: ask }); } catch { /* no list: the system's default is used */ }
    const inputs = (Array.isArray(list) ? list : []).filter((d) => d && (!d.kind || d.kind === 'audioinput'));
    device.setOptions([
      { value: '', label: 'System default' },
      ...inputs.map((d, i) => ({ value: d.deviceId || '', label: `${d.label || `Input ${i + 1}`}${d.monitor ? ' (computer sound)' : ''}` })),
    ], device.select.value);
  }

  // → whether it worked; a failure is said in the panel
  async function run(fn) {
    busy = true;
    sync();
    status.hide();
    let result;
    try {
      result = await fn();
    } catch (e) {
      result = { ok: false, error: e };
    }
    busy = false;
    // a later choice took over from this one: that one reports for itself
    if (result && result.replaced) {
      sync();
      return false;
    }
    const ok = !(result && result.ok === false);
    sync();
    if (!ok) status.show(soundError(result.error), 'error');
    return ok;
  }

  async function choose(source, deviceId = device.select.value) {
    if (source === 'off') {
      await run(() => audio.stop());
      return;
    }
    const ok = await run(() => (source === 'mic' ? audio.useMic(deviceId || undefined) : audio.useSystem()));
    if (!ok) return;
    // a microphone that started has been allowed, so the inputs have names now
    if (source === 'mic') await listDevices();
    toast(source === 'mic' ? `Listening to ${audio.label || 'the microphone'}` : 'Listening to the computer');
  }

  async function playFile(file) {
    const ok = await run(() => audio.useFile(file));
    if (ok) toast(`Playing ${audio.label || file.name || 'the music file'}`);
    return ok;
  }

  const offChange = typeof audio.on === 'function' ? audio.on('change', sync) : () => {};
  // Computer audio is offered only where this system can capture it (main.js knows)
  function checkSystem() {
    bridge.audio.systemSupport().then((s) => {
      system = s && typeof s === 'object' ? s : system;
      buttons.system.hidden = !system.supported;
      systemHelp.hidden = system.how !== 'monitor-device';
      systemHelp.textContent = 'On Linux, what the computer plays comes in through a “Monitor of …” input, which Computer audio looks for.';
    }).catch(() => {});
  }
  checkSystem();

  return {
    panel,
    playFile,
    focusTarget: () => panel.closeButton,
    onOpen() {
      sync();
      checkSystem();
      listDevices();
    },
    onClose() {},
    // the meter, while the panel is open
    update() {
      const f = audio.features() || {};
      for (const b of bars) b.bar.style.setProperty('--v', String(Math.max(0, Math.min(1, Number(f[b.key]) || 0))));
      beat.classList.toggle('is-on', (Number(f.beat) || 0) > 0.5);
    },
    dispose() { offChange(); },
  };
}
