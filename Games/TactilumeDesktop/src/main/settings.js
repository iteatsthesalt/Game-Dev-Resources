// The app's own settings (not the scene, which the renderer keeps): one JSON file in
// Electron's user-data folder. See CONTRACTS.md, "main/settings.js".
//
//   const settings = createSettings(path.join(app.getPath('userData'), 'settings.json'));
//   settings.get()                  → a copy of the settings
//   settings.set({ fullscreen: true }) → the settings after the change
//
// Every value is checked as it comes in, from the file or from a caller: a key that is not
// known, or a value of the wrong type or out of range, is ignored and the old value kept.
//
// The file is written atomically: the new settings go to a temporary file, which is flushed
// to disk and then renamed over the old one. A crash or a power cut mid-write therefore
// leaves either the old file or the new one, never half of one. A file that cannot be read
// as settings (damaged, or edited by hand into broken JSON) is set aside as
// `settings.json.corrupt`, so nothing a person wrote is lost, and the app starts from the
// defaults.
//
// Does not import electron, so tests/unit/settings.test.js runs it in plain Node. `fs` can be
// passed in, so a test can make a disk that fails at any step.
import nodeFs from 'node:fs';
import path from 'node:path';

export const DEFAULT_SETTINGS = Object.freeze({ linkPort: 47615, allowNewPhones: true, forceWebGPU: false, fullscreen: false, bounds: null });

// The smallest window the app makes (window.js), so a remembered size is never below it.
export const MIN_WINDOW = Object.freeze({ width: 480, height: 320 });

// Windows briefly locks a file that an antivirus scanner or the search indexer is reading,
// and a rename over it then fails. Trying again a moment later almost always works.
const RENAME_TRIES = 5;
const RENAME_WAIT_MS = 25;
const BUSY = new Set(['EPERM', 'EACCES', 'EBUSY']);

const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// A remembered window rectangle, or null. Screens can sit left of or above the main one, so
// x and y may be negative. `maximized` says the window was maximised; x, y, width and height
// are then the size it returns to.
export function cleanBounds(b) {
  if (!isPlainObject(b)) return null;
  const { x, y, width, height } = b;
  const coord = (v) => isInt(v, -100000, 100000);
  if (!coord(x) || !coord(y) || !isInt(width, MIN_WINDOW.width, 100000) || !isInt(height, MIN_WINDOW.height, 100000)) return null;
  const out = { x, y, width, height };
  if (b.maximized === true) out.maximized = true;
  return out;
}

// `partial` merged into `base`, keeping only known keys with valid values.
export function cleanSettings(partial, base = DEFAULT_SETTINGS) {
  const src = isPlainObject(partial) ? partial : {};
  const out = { ...base, bounds: base.bounds ? { ...base.bounds } : null };
  // below 1024 a port needs administrator rights on most systems
  if (has(src, 'linkPort') && isInt(src.linkPort, 1024, 65535)) out.linkPort = src.linkPort;
  for (const k of ['allowNewPhones', 'forceWebGPU', 'fullscreen']) {
    if (has(src, k) && typeof src[k] === 'boolean') out[k] = src[k];
  }
  // null forgets the bounds; anything that is not a usable rectangle leaves them as they were
  if (has(src, 'bounds')) {
    if (src.bounds === null) out.bounds = null;
    else out.bounds = cleanBounds(src.bounds) || out.bounds;
  }
  return out;
}

// A short synchronous pause, for the rename retries: settings are saved synchronously so
// that a save made just before the app quits is never lost.
function pause(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function createSettings(file, { fs = nodeFs, log = () => {} } = {}) {
  const dir = path.dirname(file);
  const base = path.basename(file);
  let tempCount = 0;

  // A previous run that stopped mid-write may have left a temporary file behind.
  function removeStaleTemps() {
    let names = [];
    try { names = fs.readdirSync(dir); } catch { return; }
    for (const name of names) {
      if (name.startsWith(`${base}.`) && name.endsWith('.tmp')) {
        try { fs.unlinkSync(path.join(dir, name)); } catch { /* still in use, or already gone */ }
      }
    }
  }

  function setAside(why) {
    const aside = `${file}.corrupt`;
    try {
      fs.renameSync(file, aside);
      log(`The settings file could not be read (${why}). It was kept as ${aside}, and the defaults are in use.`);
    } catch (e) {
      log(`The settings file could not be read (${why}), nor set aside (${e.message}). The defaults are in use.`);
    }
  }

  function load() {
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch (e) {
      // no file yet is the normal first start; anything else is worth a line in the log
      if (e.code !== 'ENOENT') log(`The settings file could not be opened (${e.message}). The defaults are in use.`);
      return { ...DEFAULT_SETTINGS };
    }
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      setAside(text.trim() ? 'it is not valid JSON' : 'it is empty');
      return { ...DEFAULT_SETTINGS };
    }
    if (!isPlainObject(parsed)) {
      setAside('it does not hold an object');
      return { ...DEFAULT_SETTINGS };
    }
    return cleanSettings(parsed, DEFAULT_SETTINGS);
  }

  function renameWithRetry(from, to) {
    for (let i = 1; ; i++) {
      try {
        fs.renameSync(from, to);
        return;
      } catch (e) {
        if (i >= RENAME_TRIES || !BUSY.has(e.code)) throw e;
        pause(RENAME_WAIT_MS * i);
      }
    }
  }

  // → true when the settings reached the disk
  function save(settings) {
    const temp = path.join(dir, `${base}.${process.pid}.${++tempCount}.tmp`);
    let fd = null;
    try {
      fs.mkdirSync(dir, { recursive: true });
      fd = fs.openSync(temp, 'w');
      fs.writeFileSync(fd, `${JSON.stringify(settings, null, 2)}\n`);
      // the data must be on the disk before the rename makes it the settings file
      fs.fsyncSync(fd);
      fs.closeSync(fd);
      fd = null;
      renameWithRetry(temp, file);
      return true;
    } catch (e) {
      // A read-only or full disk loses this save; the settings in memory still apply, and
      // the old file is untouched.
      log(`The settings could not be saved (${e.message}).`);
      if (fd !== null) try { fs.closeSync(fd); } catch { /* already closed */ }
      try { fs.unlinkSync(temp); } catch { /* never made */ }
      return false;
    }
  }

  removeStaleTemps();
  let current = load();
  // a copy, so a caller that changes what it got cannot change the settings
  const get = () => ({ ...current, bounds: current.bounds ? { ...current.bounds } : null });

  return {
    path: file,
    get,
    set(partial) {
      const next = cleanSettings(partial, current);
      // nothing changed: no write (window moves save the bounds often)
      if (JSON.stringify(next) !== JSON.stringify(current)) {
        current = next;
        save(current);
      }
      return get();
    },
  };
}
