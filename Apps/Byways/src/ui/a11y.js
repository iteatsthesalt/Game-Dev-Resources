const timers = new Map();

// Empty the region first, then fill it 50 ms later, so a repeated message is spoken again.
export function announce(text, { assertive = false } = {}) {
  const region = document.getElementById(assertive ? 'live-assertive' : 'live-polite');
  if (!region) return;
  clearTimeout(timers.get(region));
  region.textContent = '';
  timers.set(region, setTimeout(() => { region.textContent = text; }, 50));
}

export function focusMain() { document.getElementById('main').focus(); }
