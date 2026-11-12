// The settings panel: how much light (measured for this computer, or chosen by hand), HDR,
// the flash guard and the other ways the light behaves, forcing WebGPU, what the GPU is, and
// the keys. See CONTRACTS.md, "renderer/ui/ui.js".
//
// Where each setting lives: the flash guard, calm mode, autoplay and control size are the
// mobile edition's shared settings (store.settings); the particle count, HDR, team colours
// and haptics are the desktop's own (desktop); forcing WebGPU belongs to the main process,
// because it must be known before the GPU starts (bridge.app).
import { h, countText } from './dom.js';
import { button, switchField, segmentedField, selectField, notice, section } from './controls.js';
import { createPanel } from './panel.js';
import { KEY_LIST, PAD_LIST } from './keys.js';

const STATS_MS = 1000;            // the GPU facts are read again this often while the panel is open
// counts offered when choosing by hand; only those the GPU can hold are shown
const COUNTS = [25000, 50000, 100000, 250000, 500000, 1e6, 2e6, 4e6, 8e6, 16e6, 32e6, 64e6, 128e6];
const SIZES = [{ value: 1, label: 'Standard' }, { value: 1.25, label: 'Large' }, { value: 1.5, label: 'Largest' }];

const dl = (rows, className) => h('dl', { class: className }, rows.flatMap(([k, v]) => [h('dt', {}, k), h('dd', { text: v })]));
const kbd = (text) => text.split(/\s{2,}/).map((part, i) => [i ? ' ' : null, h('kbd', { text: part })]);

export function createSettingsPanel({ store, desktop, bridge, engine, actions, particlesFixed, toast, onClose }) {
  const panel = createPanel({ name: 'settings', eyebrow: 'Tactilume', title: 'Settings', onClose });

  // ---- light ---------------------------------------------------------------------------
  const mode = segmentedField({
    label: 'Amount of light',
    help: 'Auto measures what this computer can draw smoothly, then adjusts as it plays.',
    options: [{ value: 'auto', label: 'Auto' }, { value: 'manual', label: 'Choose' }],
    value: desktop.get().particleMode,
    onChange: (v) => (v === 'auto' ? setParticles('auto') : setParticles(Number(count.select.value))),
  });
  const count = selectField({ label: 'Particles', onChange: (v) => setParticles(Number(v)) });
  const readout = h('p', { class: 'tl-help' });
  const measureButton = button('Measure again', { onClick: measure });
  const fixedNote = notice();

  const hdr = segmentedField({
    label: 'HDR',
    help: 'Auto uses HDR when the screen offers it. On asks for it anyway.',
    options: [{ value: 'auto', label: 'Auto' }, { value: 'on', label: 'On' }, { value: 'off', label: 'Off' }],
    value: desktop.get().hdr,
    onChange: (v) => desktop.set({ hdr: v }),
  });
  const flashGuard = switchField({
    label: 'Flash guard',
    help: 'Smooths sudden bright flashes across the whole screen. Leave it on if anyone watching is sensitive to flashing light.',
    checked: store.settings.flashGuard,
    onChange: (on) => store.setSettings({ flashGuard: on }, { source: 'ui' }),
  });
  const calm = switchField({
    label: 'Calm mode',
    help: 'Slower, softer and dimmer, with no camera movement.',
    checked: store.settings.calm,
    onChange: (on) => store.setSettings({ calm: on }, { source: 'ui' }),
  });

  // ---- play -------------------------------------------------------------------------------
  const teamColors = switchField({
    label: 'Team colours',
    help: 'With two or more players, the light near each player takes on their colour.',
    checked: desktop.get().teamColors,
    onChange: (on) => desktop.set({ teamColors: on }),
  });
  const haptics = switchField({
    label: 'Buzz and rumble',
    help: 'Phones buzz and gamepads rumble when they send out light.',
    checked: desktop.get().haptics,
    onChange: (on) => desktop.set({ haptics: on }),
  });
  const autoplay = switchField({
    label: 'Play by itself when idle',
    help: 'After 20 seconds with nobody playing, the light plays on its own until someone joins in.',
    checked: store.settings.autopilot !== 'off',
    onChange: (on) => store.setSettings({ autopilot: on ? 'idle' : 'off' }, { source: 'ui' }),
  });
  const size = segmentedField({
    label: 'Control size',
    help: 'The controls also grow by themselves on large screens.',
    options: SIZES,
    value: closestSize(store.settings.uiScale),
    onChange: (v) => store.setSettings({ uiScale: v }, { source: 'ui' }),
  });

  // ---- graphics ------------------------------------------------------------------------
  const forceWebGPU = switchField({
    label: 'Force WebGPU',
    help: 'For graphics drivers that Chromium turns WebGPU off for. Takes effect the next time Tactilume starts.',
    onChange: setForceWebGPU,
  });
  const gpuNote = notice();
  const gpuFacts = h('dl', { class: 'tl-facts' });

  panel.body.append(
    section('Light', mode.el, count.el, h('div', { class: 'tl-field' }, readout, measureButton), fixedNote.el, hdr.el, flashGuard.el, calm.el),
    section('Play', teamColors.el, haptics.el, autoplay.el, size.el),
    section('Graphics', forceWebGPU.el, gpuNote.el, h('div', { class: 'tl-field' }, gpuFacts)),
    section('Keys', h('dl', { class: 'tl-keys' }, KEY_LIST.flatMap(([k, v]) => [h('dt', {}, kbd(k)), h('dd', { text: v })]))),
    section('Gamepad', h('dl', { class: 'tl-keys' }, PAD_LIST.flatMap(([k, v]) => [h('dt', {}, kbd(k)), h('dd', { text: v })]))),
    section('About', dl([['Version', String(bridge.version || '')], ['System', platformName(bridge.platform)]], 'tl-facts')));

  let measuringNow = false;
  let statsTimer = 0;
  let gpuInfo = null;

  // ---- keeping the controls true to the settings ---------------------------------------------
  function counts() {
    const max = engine.caps.maxParticles;
    const list = COUNTS.filter((n) => n <= max);
    const chosen = desktop.get().manualParticles;
    if (chosen && chosen <= max && !list.includes(chosen)) list.push(chosen);
    if (!list.length) list.push(max);
    return list.sort((a, b) => a - b).map((n) => ({ value: n, label: countText(n) }));
  }

  // The words under the choices. Refreshed every second while the panel is open (the governor
  // moves the count), so it is not a live region: a screen reader would read it out each time.
  function showReadout() {
    const d = desktop.get();
    const drawing = countText(engine.stats.particles);
    let text;
    if (measuringNow) text = 'Measuring this computer…';
    else if (particlesFixed) text = `Drawing ${drawing} particles.`;
    else if (d.particleMode === 'auto') text = `Drawing ${drawing} particles now${d.particles ? `, of ${countText(d.particles)} measured for this computer` : ''}. The count steps down if frames run late, and back up when there is room.`;
    else text = `Drawing ${drawing} particles, as chosen.`;
    if (readout.textContent !== text) readout.textContent = text;
  }

  // The choices themselves, only when a setting changes or the panel opens: rebuilding the
  // list while someone has it open would snatch it away.
  function showParticles() {
    const d = desktop.get();
    const auto = d.particleMode === 'auto';
    const list = counts();
    const now = engine.stats.particles;
    const nearest = list.reduce((best, o) => (Math.abs(o.value - now) < Math.abs(best - now) ? o.value : best), list[0].value);
    mode.set(d.particleMode);
    count.setOptions(list, auto || !d.manualParticles ? nearest : d.manualParticles);
    count.el.hidden = auto;
    const fixed = !!particlesFixed;
    mode.setDisabled(fixed || measuringNow);
    count.setDisabled(fixed || measuringNow);
    measureButton.disabled = fixed || measuringNow;
    fixedNote.show(fixed ? `The page’s address sets the count (particles=${countText(now)}), so these choices are off.` : '');
    showReadout();
  }

  function showSettings() {
    const s = store.settings;
    flashGuard.set(s.flashGuard);
    calm.set(s.calm);
    autoplay.set(s.autopilot !== 'off');
    size.set(closestSize(s.uiScale));
    const d = desktop.get();
    hdr.set(d.hdr);
    teamColors.set(d.teamColors);
    haptics.set(d.haptics);
    showParticles();
  }

  function showGpu() {
    const c = engine.caps;
    const st = engine.stats;
    const a = c.adapter || {};
    const name = [a.vendor, a.architecture].filter(Boolean).join(' ') || 'Unnamed';
    const rows = [
      ['Engine', 'WebGPU'],
      ['Graphics', a.description ? `${name} (${a.description})` : name],
    ];
    if (a.fallback) rows.push(['Adapter', 'A software fallback: expect slow drawing']);
    rows.push(
      ['Picture', c.presenting ? 'On screen' : 'Offscreen only'],
      ['Output', c.hdr ? 'HDR' : 'SDR'],
      ['Particles', `${countText(st.particles)} of at most ${countText(c.maxParticles)}`],
      ['Frame time', Number.isFinite(st.frameMs) && st.frameMs > 0 ? `${st.frameMs.toFixed(1)} ms` : '–'],
    );
    const status = gpuInfo?.featureStatus?.webgpu;
    if (status) rows.push(['Chromium reports WebGPU', String(status).replace(/_/g, ' ')]);
    const device = (gpuInfo?.gpuDevice || []).find((d) => d.active) || gpuInfo?.gpuDevice?.[0];
    if (device?.driverVersion) rows.push(['Driver', `${device.driverVendor ? `${device.driverVendor} ` : ''}${device.driverVersion}`]);
    drawFacts(rows);
    showReadout();
  }

  // This runs every second while the panel is open, and the frame time changes each time. Only
  // what changed is redrawn: rebuilding the list would throw a screen reader moving through it
  // back to its start every second.
  let shownFacts = [];   // [{ key, dd, value }] as on screen
  function drawFacts(rows) {
    const sameRows = rows.length === shownFacts.length && rows.every(([k], i) => shownFacts[i].key === k);
    if (!sameRows) {
      shownFacts = rows.map(([key, value]) => ({ key, value, dd: h('dd', { text: value }) }));
      gpuFacts.replaceChildren(...shownFacts.flatMap((f) => [h('dt', { text: f.key }), f.dd]));
      return;
    }
    rows.forEach(([, value], i) => {
      const f = shownFacts[i];
      if (f.value !== value) {
        f.value = value;
        f.dd.textContent = value;
      }
    });
  }

  // ---- doing what was asked -------------------------------------------------------------------
  async function setParticles(n) {
    try {
      await actions.setParticles(n);
    } catch (e) {
      toast(`The amount of light did not change (${e?.message || e}).`);
    }
    showParticles();
  }

  async function measure() {
    try {
      const n = await actions.measure();
      toast(`Measured: ${countText(n)} particles suit this computer`);
    } catch (e) {
      toast(`The measurement stopped (${e?.message || e}).`);
    }
    showParticles();
  }

  async function setForceWebGPU(on) {
    gpuNote.hide();
    try {
      const next = await bridge.app.setSettings({ forceWebGPU: on });
      forceWebGPU.set(next.forceWebGPU);
    } catch (e) {
      forceWebGPU.set(!on);
      gpuNote.show(`That did not change (${e?.message || e}).`, 'error');
    }
  }

  const offStore = store.on('settings', showSettings);
  const offDesktop = desktop.on(showSettings);

  return {
    panel,
    focusTarget: () => panel.closeButton,
    measuring(on) {
      measuringNow = !!on;
      showParticles();
    },
    async onOpen() {
      showSettings();
      showGpu();
      clearInterval(statsTimer);
      statsTimer = setInterval(showGpu, STATS_MS);
      try {
        forceWebGPU.set((await bridge.app.getSettings()).forceWebGPU);
      } catch { /* left as it was */ }
      try {
        gpuInfo = await bridge.app.gpuInfo();
        showGpu();
      } catch { /* the engine's own facts are enough */ }
    },
    onClose() { clearInterval(statsTimer); },
    dispose() {
      clearInterval(statsTimer);
      offStore();
      offDesktop();
    },
  };
}

function closestSize(scale) {
  const s = Number(scale) || 1;
  return SIZES.reduce((best, o) => (Math.abs(o.value - s) < Math.abs(best - s) ? o.value : best), 1);
}

function platformName(p) {
  return { win32: 'Windows', darwin: 'macOS', linux: 'Linux', browser: 'A web browser (no app)' }[p] || String(p || 'Unknown');
}
