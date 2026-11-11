// The UI's glyphs: small inline SVGs drawn for Tactilume on a 24-unit grid with a
// 1.6 stroke, so they sit together as one family. They take the text colour
// (currentColor) and are decorative: every button that shows one has its own name.

const PATHS = {
  // The open button: a touch with its light gathering round it.
  lume: '<circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none"/>'
    + '<path d="M12 4.2a7.8 7.8 0 0 1 7.8 7.8"/><path d="M4.2 12A7.8 7.8 0 0 1 9 4.8"/>'
    + '<path d="M19.2 15a7.8 7.8 0 0 1-10.2 4.2"/>'
    + '<circle cx="17.6" cy="6.4" r="1.15" fill="currentColor" stroke="none"/>'
    + '<circle cx="5.6" cy="17.2" r="0.9" fill="currentColor" stroke="none"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',

  // tabs
  scenes: '<rect x="3.5" y="3.5" width="7.2" height="7.2" rx="2.2"/><rect x="13.3" y="3.5" width="7.2" height="7.2" rx="2.2"/>'
    + '<rect x="3.5" y="13.3" width="7.2" height="7.2" rx="2.2"/><circle cx="16.9" cy="16.9" r="3.6"/>',
  play: '<circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="5.4"/>'
    + '<path d="M12 3.2a8.8 8.8 0 0 1 8.8 8.8M12 20.8A8.8 8.8 0 0 1 3.2 12" opacity=".55"/>',
  look: '<circle cx="9" cy="9.4" r="5.4"/><circle cx="15" cy="9.4" r="5.4"/><circle cx="12" cy="14.6" r="5.4"/>',
  motion: '<path d="M3 8.5c2.6-2.4 5.2-2.4 7.8 0s5.2 2.4 7.8 0"/><path d="M3 13c2.6-2.4 5.2-2.4 7.8 0s5.2 2.4 7.8 0"/>'
    + '<path d="M6 17.5c2-1.6 4-1.6 6 0s4 1.6 6 0" opacity=".55"/>',
  sound: '<path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2"/>',
  capture: '<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8l1.4-2h4.6l1.4 2h1.8A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z"/>'
    + '<circle cx="12" cy="12.4" r="3.4"/>',
  settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>',

  // actions
  photo: '<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8l1.4-2h4.6l1.4 2h1.8A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z"/>'
    + '<circle cx="12" cy="12.4" r="3.4"/>',
  record: '<circle cx="12" cy="12" r="8.4"/><circle cx="12" cy="12" r="4.4" fill="currentColor" stroke="none"/>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="2.4" fill="currentColor" stroke="none"/>',
  share: '<path d="M12 14.5V3.8M8 7.6l4-3.8 4 3.8"/><path d="M8.5 10.5H7a2.5 2.5 0 0 0-2.5 2.5v5A2.5 2.5 0 0 0 7 20.5h10a2.5 2.5 0 0 0 2.5-2.5v-5a2.5 2.5 0 0 0-2.5-2.5h-1.5"/>',
  surprise: '<path d="M12 3.5l1.7 5.1 5.3 1.7-5.3 1.7L12 17.1l-1.7-5.1L5 10.3l5.3-1.7z"/>'
    + '<path d="M18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" fill="currentColor" stroke="none"/>',
  save: '<path d="M7 3.8h10a1.5 1.5 0 0 1 1.5 1.5v15l-6.5-4-6.5 4v-15A1.5 1.5 0 0 1 7 3.8z"/><path d="M12 7.6v5.2M9.4 10.2h5.2"/>',
  trash: '<path d="M4.5 7h15M9.5 7V5a1.2 1.2 0 0 1 1.2-1.2h2.6A1.2 1.2 0 0 1 14.5 5v2"/>'
    + '<path d="M6.5 7l.8 11.6A1.8 1.8 0 0 0 9.1 20.3h5.8a1.8 1.8 0 0 0 1.8-1.7L17.5 7"/>',
  chevron: '<path d="M7 9.5l5 5 5-5"/>',
  check: '<path d="M5.5 12.5l4.2 4.2 8.8-9.2"/>',
  minus: '<path d="M6 12h12"/>',
  plus: '<path d="M12 6v12M6 12h12"/>',
  hide: '<path d="M3.5 12s3-6 8.5-6c1.6 0 3 .5 4.2 1.2M20.5 12s-3 6-8.5 6c-1.6 0-3-.5-4.2-1.2"/>'
    + '<path d="M9.9 14.1a3 3 0 0 1 4.2-4.2M4.5 19.5l15-15"/>',
  fullscreen: '<path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15"/>',
  unpin: '<circle cx="8" cy="9" r="2.4"/><circle cx="16.5" cy="7.5" r="1.8"/><circle cx="14" cy="16" r="2.1"/><path d="M4 20L20 4" opacity=".7"/>',
  mic: '<rect x="9" y="3.5" width="6" height="10.5" rx="3"/><path d="M5.8 11.5a6.2 6.2 0 0 0 12.4 0M12 17.7v2.8"/>',
  song: '<path d="M9 17.5V6l10-2v11.5"/><circle cx="6.8" cy="17.5" r="2.2"/><circle cx="16.8" cy="15.5" r="2.2"/>',
  reset: '<path d="M4.8 12a7.2 7.2 0 1 0 2.1-5.1"/><path d="M4.5 4.5v3.9h3.9"/>',
};

const NS = 'http://www.w3.org/2000/svg';

// A fresh <svg> element for `name`. The markup is our own constant, so parsing it is safe.
export function icon(name, className = 'tl-icon') {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.6');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.innerHTML = PATHS[name] || '';
  return svg;
}
