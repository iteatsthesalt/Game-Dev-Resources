// A small strip on the classic engine's page, shown when the desktop app runs it because
// WebGPU is off (the page is opened with ?desktop=1). The classic engine is the mobile
// edition as it is, and knows nothing of the desktop: no phones, no gamepads, no desktop
// Sound or Settings panels, and the menu bar is hidden until Alt is pressed. Without this
// strip the player would get a light show with no sign that any of that exists, nor how to
// get it back. tools/build.mjs bundles this file next to dist/classic/index.html and adds a
// script tag for it; the mobile edition itself is never changed.
//
// window.tactilume is the desktop app's preload bridge (CONTRACTS.md). In a plain browser
// (the tests) it may be missing, and then the strip only explains.

const STYLE = `
.tl-desk-strip {
  position: fixed; z-index: 2147483000; top: 12px; left: 50%; transform: translateX(-50%);
  box-sizing: border-box; width: min(640px, calc(100vw - 24px));
  padding: 12px 14px; border-radius: 12px;
  background: rgba(12, 12, 16, 0.92); border: 1px solid rgba(255, 255, 255, 0.22);
  color: #f5f6fa; font: 15px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.5);
}
.tl-desk-strip p { margin: 0 0 10px; }
.tl-desk-strip strong { color: #ffd59a; }
.tl-desk-strip .tl-desk-row { display: flex; flex-wrap: wrap; gap: 8px; }
.tl-desk-strip button {
  font: inherit; font-size: 15px; min-height: 36px; padding: 6px 14px; border-radius: 999px; cursor: pointer;
  color: #f5f6fa; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.35);
}
.tl-desk-strip button.tl-desk-main { color: #1a0d00; background: #ffb347; border-color: #ffb347; font-weight: 600; }
.tl-desk-strip button:hover { filter: brightness(1.12); }
.tl-desk-strip button:focus-visible { outline: 2px solid #ffffff; outline-offset: 2px; box-shadow: 0 0 0 5px rgba(255, 179, 71, 0.6); }
.tl-desk-strip [role="status"]:empty { display: none; }
.tl-desk-strip [role="status"] { margin: 10px 0 0; }
`;

// Where the setting lives, in words for this computer. On macOS the menu bar is always there;
// on Windows and Linux the window hides it until Alt is pressed.
export function menuHint(platform) {
  const where = 'Graphics > Force WebGPU on This Computer';
  return platform === 'darwin' ? `${where}, in the menu bar` : `${where} (press Alt to show the menu)`;
}

// The strip's words. forced: WebGPU is already forced on, and still did not start.
export function stripText({ platform, forced }) {
  const lacks = 'phones and gamepads cannot join, and the desktop Sound and Settings panels are not here.';
  if (forced) {
    return `WebGPU did not start on this computer even when forced, so this is the classic engine: ${lacks} `
      + `Updating the graphics driver may help. To stop forcing it: ${menuHint(platform)}.`;
  }
  return `WebGPU is off on this computer, so this is the classic engine: ${lacks} `
    + `To turn WebGPU on: ${menuHint(platform)}, then restart.`;
}

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const c of children) node.append(c);
  return node;
}

export async function showStrip({ bridge = window.tactilume, doc = document } = {}) {
  const platform = bridge?.platform || (/Mac/.test(navigator.platform) ? 'darwin' : 'other');
  let forced = false;
  try { forced = !!(await bridge?.app?.getSettings())?.forceWebGPU; } catch { /* it only changes the words */ }

  doc.head.append(el('style', { textContent: STYLE }));
  const text = el('p', { id: 'tl-desk-strip-text', textContent: stripText({ platform, forced }) });
  const status = el('p', { className: 'tl-desk-status' });
  status.setAttribute('role', 'status');
  const strip = el('section', { className: 'tl-desk-strip' }, [
    el('p', {}, [el('strong', { textContent: 'Phones and gamepads are off' })]),
    text,
  ]);
  strip.setAttribute('aria-labelledby', 'tl-desk-strip-text');
  const row = el('div', { className: 'tl-desk-row' });

  // The button does what the menu does; main asks whether to restart now.
  if (!forced && typeof bridge?.app?.setSettings === 'function') {
    const turnOn = el('button', { type: 'button', className: 'tl-desk-main', textContent: 'Turn on WebGPU' });
    turnOn.addEventListener('click', async () => {
      turnOn.disabled = true;
      try {
        await bridge.app.setSettings({ forceWebGPU: true });
        status.textContent = 'WebGPU is on from the next start. Restart Tactilume to use it.';
      } catch {
        turnOn.disabled = false;
        status.textContent = `That did not work. Use the menu instead: ${menuHint(platform)}.`;
      }
    });
    row.append(turnOn);
  }
  const close = el('button', { type: 'button', textContent: 'Dismiss' });
  close.setAttribute('aria-label', 'Dismiss this message');
  close.addEventListener('click', () => strip.remove());
  row.append(close);
  strip.append(row, status);

  // Keys and touches on the strip are for the strip: the classic engine listens on the
  // window (Space pulses, for one), and must not also act on them.
  for (const type of ['keydown', 'keyup', 'pointerdown', 'pointerup', 'wheel']) {
    strip.addEventListener(type, (e) => e.stopPropagation());
  }
  // first in the page, so the first Tab reaches it
  doc.body.prepend(strip);
  return strip;
}

if (typeof window !== 'undefined' && new URLSearchParams(location.search).get('desktop') === '1') {
  const start = () => showStrip().catch((e) => console.warn('Tactilume: the desktop strip did not start', e));
  if (document.body) start(); else addEventListener('DOMContentLoaded', start, { once: true });
}
