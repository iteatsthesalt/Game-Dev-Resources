// Small helpers for building the overlay with the DOM: elements, icons and ids.
//
// Text always goes in as text (textContent), never as HTML, so a phone's name or a file name
// can never add markup. The renderer's CSP forbids inline styles in markup, so anything set
// per element goes through el.style.setProperty, which it allows.

let nextId = 0;
// an id unique on the page, for label/aria wiring
export const uid = (prefix = 'tl') => `${prefix}-${++nextId}`;

// h('button', { class: 'x', type: 'button', onclick: fn, 'aria-label': 'Close' }, child, 'text', [more])
// Keys starting with "on" become listeners; `class` and `text` are shortcuts; true sets an
// attribute with no value, and false or null leaves it out.
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

// ---- icons ----------------------------------------------------------------------------------
// Drawn for Tactilume on a 24-unit grid with a 1.6 stroke, the same family as the mobile
// edition's glyphs. They take the text colour and are decorative: every control that shows
// one has a name of its own.
const PATHS = {
  phone: '<rect x="7" y="3" width="10" height="18" rx="2.4"/><path d="M10.6 18h2.8"/>'
    + '<circle cx="12" cy="10.4" r="1.6" fill="currentColor" stroke="none"/><path d="M9.2 7.8a4 4 0 0 1 5.6 0" opacity=".6"/>',
  sound: '<path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2"/>',
  settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>',
  fullscreen: '<path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15"/>',
  window: '<path d="M9 4v3.5A1.5 1.5 0 0 1 7.5 9H4M20 9h-3.5A1.5 1.5 0 0 1 15 7.5V4M15 20v-3.5a1.5 1.5 0 0 1 1.5-1.5H20M4 15h3.5A1.5 1.5 0 0 1 9 16.5V20"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2.2"/><path d="M15.5 8.5V6.2a1.7 1.7 0 0 0-1.7-1.7H6.2a1.7 1.7 0 0 0-1.7 1.7v7.6a1.7 1.7 0 0 0 1.7 1.7h2.3"/>',
  refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.6 4.6v4.2h-4.2"/>',
  chevron: '<path d="M7 9.5l5 5 5-5"/>',
  eye: '<path d="M2.8 12s3.4-6.2 9.2-6.2 9.2 6.2 9.2 6.2-3.4 6.2-9.2 6.2S2.8 12 2.8 12z"/><circle cx="12" cy="12" r="2.8"/>',
  mic: '<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.8 11.5a6.2 6.2 0 0 0 12.4 0M12 17.7v2.8"/>',
  speaker: '<path d="M4.5 9.5h3l4.5-4v13l-4.5-4h-3z"/><path d="M15.6 9a4.2 4.2 0 0 1 0 6M18.2 6.6a7.6 7.6 0 0 1 0 10.8"/>',
  music: '<path d="M9 17.5V6l10-2v11.5"/><circle cx="6.8" cy="17.5" r="2.2"/><circle cx="16.8" cy="15.5" r="2.2"/>',
  off: '<circle cx="12" cy="12" r="8"/><path d="M6.4 17.6L17.6 6.4"/>',
  gamepad: '<path d="M7.4 7h9.2a4.2 4.2 0 0 1 4.1 3.3l1 4.8a2.6 2.6 0 0 1-4.6 2.1L15.6 15H8.4l-1.5 2.2a2.6 2.6 0 0 1-4.6-2.1l1-4.8A4.2 4.2 0 0 1 7.4 7z"/>'
    + '<path d="M8 9.6v3M6.5 11.1h3"/><circle cx="15.6" cy="10.2" r=".9" fill="currentColor" stroke="none"/><circle cx="17.4" cy="12" r=".9" fill="currentColor" stroke="none"/>',
  mouse: '<rect x="6.5" y="3.5" width="11" height="17" rx="5.5"/><path d="M12 7v3"/>',
};

const SVG = 'http://www.w3.org/2000/svg';

export function icon(name, className = 'tl-icon') {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.6');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  // The path strings are this file's own constants, never outside text, so building them
  // from markup is safe. DOMParser keeps the SVG namespace that innerHTML on an svg needs.
  const doc = new DOMParser().parseFromString(`<svg xmlns="${SVG}">${PATHS[name] || ''}</svg>`, 'image/svg+xml');
  svg.append(...[...doc.documentElement.childNodes].map((n) => document.importNode(n, true)));
  return svg;
}

// [r, g, b] 0..1 → 'rgb(r g b)', for a player's colour
export const cssColor = (c) => `rgb(${(Array.isArray(c) ? c : [1, 1, 1]).slice(0, 3).map((v) => Math.round(Math.min(1, Math.max(0, Number(v) || 0)) * 255)).join(' ')})`;

// 1234567 → '1,234,567'; 2_000_000 → '2 million'
export function countText(n) {
  if (!Number.isFinite(n)) return '–';
  if (n >= 1e6 && n % 1e5 === 0) return `${n / 1e6} million`;
  return Math.round(n).toLocaleString('en-US');
}
