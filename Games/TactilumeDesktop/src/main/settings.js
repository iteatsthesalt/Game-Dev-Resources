// The app's own settings (not the scene): one JSON file in Electron's user-data folder.
//
// First version, written by the spine. The shell-ui part owns this file and replaces it.
import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_SETTINGS = Object.freeze({ linkPort: 47615, allowNewPhones: true, forceWebGPU: false, fullscreen: false, bounds: null });

const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

// A window rectangle that could be on some screen, or null.
function cleanBounds(b) {
  if (!b || typeof b !== 'object') return null;
  const { x, y, width, height } = b;
  if (![x, y].every((v) => isInt(v, -100000, 100000)) || !isInt(width, 200, 100000) || !isInt(height, 150, 100000)) return null;
  return { x, y, width, height };
}

// Keeps each known key whose new value is valid; anything else keeps its old value.
function clean(partial, base) {
  const src = partial && typeof partial === 'object' ? partial : {};
  const has = (k) => Object.prototype.hasOwnProperty.call(src, k);
  const out = { ...base };
  if (has('linkPort') && isInt(src.linkPort, 1024, 65535)) out.linkPort = src.linkPort;
  for (const k of ['allowNewPhones', 'forceWebGPU', 'fullscreen']) if (has(k) && typeof src[k] === 'boolean') out[k] = src[k];
  if (has('bounds')) out.bounds = cleanBounds(src.bounds);
  return out;
}

export function createSettings(file) {
  function load() {
    try { return clean(JSON.parse(fs.readFileSync(file, 'utf8')), DEFAULT_SETTINGS); } catch { return { ...DEFAULT_SETTINGS }; }
  }
  // Written to a temporary file and renamed, so a crash mid-write never leaves half a file.
  function save() {
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const temp = `${file}.${process.pid}.tmp`;
      fs.writeFileSync(temp, JSON.stringify(current, null, 2));
      fs.renameSync(temp, file);
    } catch {
      // a read-only or full disk loses this save; the settings in memory still apply
    }
  }
  let current = load();
  const get = () => ({ ...current, bounds: current.bounds && { ...current.bounds } });
  return {
    path: file,
    get,
    set(partial) {
      current = clean(partial, current);
      save();
      return get();
    },
  };
}
