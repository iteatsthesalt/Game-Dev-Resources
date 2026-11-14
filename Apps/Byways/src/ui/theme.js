const THEMES = ['system', 'light', 'dark', 'high-contrast'];
const FONTS = ['system', 'atkinson'];
const MOTIONS = ['system', 'reduced', 'full'];

const pick = (value, allowed) => (allowed.includes(value) ? value : 'system');
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export function applyAccessSettings(settings, root = document.documentElement) {
  root.dataset.theme = pick(settings.theme, THEMES);
  root.dataset.font = pick(settings.font, FONTS);
  root.dataset.motion = pick(settings.motion, MOTIONS);
  root.style.setProperty('--text-scale', String(clamp(settings.textScale, 1, 2)));
}
