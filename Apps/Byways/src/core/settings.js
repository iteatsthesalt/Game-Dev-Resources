const STORE = 'settings';
const KEY = 'current';

export const DEFAULT_SETTINGS = {
  v: 1,
  mode: 'tuned',
  familyFilter: true, checkLinks: true,
  dwellSec: 20, dwellWaitForMe: false,          // range 5–300
  leanBackAI: false, aiInRabbitHole: false,
  singleKeyShortcuts: true, screenReaderMode: false,
  motion: 'system', theme: 'system', font: 'system', textScale: 1,   // textScale 1–2
    // motion 'system' | 'reduced' | 'full'; theme 'system' | 'light' | 'dark' | 'high-contrast'; font 'system' | 'atkinson'
  goStraightToSite: false,                       // Android site view only
  sessionLengthMin: null, exploringCue: false,
  voice: { mode: 'auto', cloudOptIn: false, voiceURI: null, rate: 1, volume: 1, lang: 'en-US' },
    // mode 'auto' | 'always' | 'push' | 'off'. Per spec §6.2, 'auto' resolves to:
    //   'always' for web-local, for web-cloud after opt-in on browsers that are not Android, and for native continuous (Android 13+);
    //   'push' for Android browsers (each restart beeps) and for native Android 24–32.
  ai: { provider: null, model: null, runCapUsd: 0.5, dailySearchCap: 50, dailySpendCapUsd: 2,
        baseUrls: {},                            // {[providerId]: user-entered base URL} for custom, ollama, lmstudio
        team: { enabled: false, captain: false, roles: { scout: null, digger: null, wildcard: null, captain: null } } },
        // role value: {provider, model} | null
  sources: {},                                   // {[sourceId]: {enabled:boolean, fateWeight:0..3}}; absent = default
  passphraseLock: false,
  firstRunDone: false,
};

const isPlainObject = v => v !== null && typeof v === 'object' && !Array.isArray(v)
  && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const isUnsafeKey = k => k === '__proto__';

/** Copy a stored value so the result shares no references with it. */
const copy = v => (isPlainObject(v)
  ? Object.fromEntries(Object.entries(v).filter(([k]) => !isUnsafeKey(k)).map(([k, x]) => [k, copy(x)]))
  : Array.isArray(v) ? v.map(copy) : v);

/** Repair one value against its default. The result never shares references with either. */
function repairValue(stored, def) {
  if (isPlainObject(def)) {
    const keys = Object.keys(def);
    if (keys.length === 0) return isPlainObject(stored) ? copy(stored) : {};
    const src = isPlainObject(stored) ? stored : {};
    const out = {};
    for (const k of keys) out[k] = repairValue(src[k], def[k]);
    for (const k of Object.keys(src)) if (!(k in def) && !isUnsafeKey(k)) out[k] = copy(src[k]);
    return out;
  }
  if (def === null) {
    const ok = stored === null || typeof stored === 'string' || isPlainObject(stored)
      || (typeof stored === 'number' && Number.isFinite(stored));
    return ok ? copy(stored) : null;
  }
  const ok = typeof stored === typeof def && (typeof def !== 'number' || Number.isFinite(stored));
  return ok ? stored : def;
}

/** Turn anything read from storage into valid settings. Pure. */
export function repairSettings(stored) {
  const s = repairValue(stored, DEFAULT_SETTINGS);
  s.dwellSec = clamp(s.dwellSec, 5, 300);
  s.textScale = clamp(s.textScale, 1, 2);
  s.voice.rate = clamp(s.voice.rate, 0.5, 2);
  s.voice.volume = clamp(s.voice.volume, 0, 1);
  for (const [id, entry] of Object.entries(s.sources)) {
    if (!isPlainObject(entry)) { delete s.sources[id]; continue; }
    if (typeof entry.enabled !== 'boolean') delete entry.enabled;
    if (typeof entry.fateWeight === 'number' && Number.isFinite(entry.fateWeight)) entry.fateWeight = clamp(entry.fateWeight, 0, 3);
    else delete entry.fateWeight;
  }
  return s;
}

/** Read the stored settings, repaired; an empty store gives a fresh copy of the defaults. */
export async function loadSettings(store) {
  return repairSettings(await store.get(STORE, KEY));
}

/** Plain objects merge key by key; arrays and every other value replace. An undefined value changes nothing. */
function deepMerge(base, patch) {
  if (!isPlainObject(base) || !isPlainObject(patch)) return patch;
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (isUnsafeKey(k) || v === undefined) continue;
    out[k] = isPlainObject(v) && isPlainObject(base[k]) ? deepMerge(base[k], v) : v;
  }
  return out;
}

/** Deep-merge `patch` over the stored settings, repair, persist and return the result. A patch must be a plain object. */
export async function saveSettings(store, patch) {
  if (!isPlainObject(patch)) throw new TypeError('saveSettings: the patch must be a plain object');
  const next = repairSettings(deepMerge(await loadSettings(store), patch));
  await store.put(STORE, KEY, next);
  return next;
}
