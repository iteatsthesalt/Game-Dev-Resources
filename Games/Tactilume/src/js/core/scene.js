// What a scene is, and the device settings beside it.
//
// One schema drives three things: the sliders and pickers in the UI, the share-link
// codec, and the cleaning of anything that arrives from outside (a link, saved data,
// the native wrapper). Anything not in the schema is dropped; numbers are clamped and
// snapped to their step; unknown choices fall back to the default.
//
// `code` is the key used in share links. Codes are permanent: never change or reuse one.

import { BEHAVIOUR_KEYS, DEFAULT_CHORDS, MAX_FINGERS, behaviourByKey, behaviourById } from './behaviours.js';
import { PALETTE_KEYS } from './palettes.js';

export const FORMS = ['nebula', 'disc', 'shell', 'ring', 'lattice', 'none'];
export const COLOR_BY = ['speed', 'heat', 'seed', 'direction', 'depth'];

// group: where the control lives in the UI. label/help are shown to people.
export const SCHEMA = [
  // Play
  { key: 'lock', code: 'lk', type: 'enum', options: ['auto', ...BEHAVIOUR_KEYS], def: 'auto', group: 'play', label: 'Behaviour', help: 'Auto picks a behaviour from how many fingers touch. Choose one to play it with any number of fingers.' },
  { key: 'chords', code: 'ch', type: 'chords', def: DEFAULT_CHORDS, group: 'play', label: 'Fingers', help: 'Which behaviour each number of fingers plays.' },
  { key: 'symmetry', code: 'sy', type: 'int', min: 1, max: 12, def: 1, group: 'play', label: 'Symmetry', help: 'Copies every touch around the centre.' },
  { key: 'mirror', code: 'mi', type: 'bool', def: false, group: 'play', label: 'Mirror', help: 'Reflects the copies as well, like a kaleidoscope.' },
  { key: 'strength', code: 'st', type: 'num', min: 0.2, max: 3, step: 0.05, def: 1, group: 'play', label: 'Strength', help: 'How hard touches pull and push.' },
  { key: 'form', code: 'fo', type: 'enum', options: FORMS, def: 'nebula', group: 'play', label: 'Resting shape', help: 'The shape the light drifts back into when nobody is touching.' },
  // Motion
  { key: 'speed', code: 'sp', type: 'num', min: 0.1, max: 2, step: 0.05, def: 1, group: 'motion', label: 'Time', help: 'Slows down or speeds up everything.' },
  { key: 'drag', code: 'dr', type: 'num', min: 0, max: 1, step: 0.01, def: 0.35, group: 'motion', label: 'Drag', help: 'How quickly the light slows down.' },
  { key: 'flow', code: 'fl', type: 'num', min: 0, max: 1, step: 0.01, def: 0.3, group: 'motion', label: 'Drift', help: 'Gentle currents that keep the light moving on its own.' },
  { key: 'gravity', code: 'gr', type: 'num', min: 0, max: 1, step: 0.01, def: 0, group: 'motion', label: 'Gravity', help: 'Pulls the light down, or along your tilt when tilt is on.' },
  { key: 'depth', code: 'de', type: 'num', min: 0, max: 1, step: 0.01, def: 0.6, group: 'motion', label: 'Depth', help: 'How deep the space is. At zero everything lies flat.' },
  { key: 'orbit', code: 'or', type: 'num', min: 0, max: 1, step: 0.01, def: 0.3, group: 'motion', label: 'Camera drift', help: 'Lets the view sway slowly through the light.' },
  // Look
  { key: 'palette', code: 'pa', type: 'enum', options: PALETTE_KEYS, def: 'ember', group: 'look', label: 'Palette' },
  { key: 'colorBy', code: 'cb', type: 'enum', options: COLOR_BY, def: 'speed', group: 'look', label: 'Colour from', help: 'What picks each speck’s colour from the palette.' },
  { key: 'hue', code: 'hu', type: 'num', min: 0, max: 1, step: 0.005, def: 0, group: 'look', label: 'Hue shift' },
  { key: 'density', code: 'dn', type: 'num', min: 0.05, max: 1, step: 0.01, def: 1, group: 'look', label: 'Amount', help: 'How many specks of light, as a share of what this device can draw.' },
  { key: 'size', code: 'sz', type: 'num', min: 0.25, max: 4, step: 0.05, def: 1, group: 'look', label: 'Speck size' },
  { key: 'glow', code: 'gl', type: 'num', min: 0, max: 1, step: 0.01, def: 0.6, group: 'look', label: 'Glow' },
  { key: 'trails', code: 'tr', type: 'num', min: 0, max: 1, step: 0.01, def: 0.5, group: 'look', label: 'Trails' },
  { key: 'exposure', code: 'ex', type: 'num', min: -3, max: 3, step: 0.05, def: 0, group: 'look', label: 'Brightness' },
  { key: 'focus', code: 'fc', type: 'num', min: 0, max: 1, step: 0.01, def: 0.3, group: 'look', label: 'Soft focus', help: 'Blurs light that is near or far, like a camera lens.' },
  { key: 'sparkle', code: 'sk', type: 'num', min: 0, max: 1, step: 0.01, def: 0.3, group: 'look', label: 'Sparkle' },
  { key: 'grain', code: 'gn', type: 'num', min: 0, max: 1, step: 0.01, def: 0.25, group: 'look', label: 'Film grain' },
  { key: 'aberration', code: 'ab', type: 'num', min: 0, max: 1, step: 0.01, def: 0.2, group: 'look', label: 'Lens fringe' },
  { key: 'vignette', code: 'vi', type: 'num', min: 0, max: 1, step: 0.01, def: 0.5, group: 'look', label: 'Vignette' },
  { key: 'name', code: 'na', type: 'str', maxLen: 40, def: '', group: 'meta', label: 'Name' },
];

// Settings belong to the device and the person, not to a scene: they are never in share links.
export const SETTINGS_SCHEMA = [
  { key: 'quality', type: 'enum', options: ['auto', 'battery', 'balanced', 'max'], def: 'auto', label: 'Quality', help: 'Auto keeps the motion smooth by adjusting detail as it plays.' },
  { key: 'fpsCap', type: 'enum', options: ['display', '60', '30'], def: 'display', label: 'Frame rate' },
  { key: 'sound', type: 'bool', def: false, label: 'Sound', help: 'Touches play soft generated music.' },
  { key: 'volume', type: 'num', min: 0, max: 1, step: 0.01, def: 0.6, label: 'Volume' },
  { key: 'react', type: 'enum', options: ['off', 'mic', 'file'], def: 'off', label: 'React to', help: 'Lets the light move with sound from the microphone or a song you pick.' },
  { key: 'sensitivity', type: 'num', min: 0, max: 1, step: 0.01, def: 0.5, label: 'Sensitivity' },
  { key: 'tilt', type: 'bool', def: false, label: 'Tilt', help: 'Tilting the device tips the light.' },
  { key: 'haptics', type: 'bool', def: true, label: 'Vibration', help: 'A tiny tap you can feel when you touch.' },
  { key: 'autopilot', type: 'enum', options: ['idle', 'always', 'off'], def: 'idle', label: 'Autoplay', help: 'Idle plays by itself when nobody has touched for a while.' },
  { key: 'idleSeconds', type: 'int', min: 5, max: 300, def: 25, label: 'Autoplay after (s)' },
  { key: 'virtualFingers', type: 'int', min: 0, max: MAX_FINGERS, def: 0, label: 'One-finger chords', help: 'When set, one touch acts as this many fingers.' },
  { key: 'pin', type: 'bool', def: false, label: 'Pin touches', help: 'Lifting a finger leaves its touch in place. Tap a pinned touch to remove it.' },
  { key: 'flashGuard', type: 'bool', def: true, label: 'Flash guard', help: 'Smooths sudden bright flashes across the whole screen.' },
  { key: 'calm', type: 'bool', def: false, label: 'Calm mode', help: 'Slower, softer and dimmer, with no camera movement.' },
  { key: 'hints', type: 'bool', def: true, label: 'Show behaviour names' },
  { key: 'uiScale', type: 'num', min: 1, max: 1.6, step: 0.05, def: 1, label: 'Control size' },
  { key: 'introSeen', type: 'bool', def: false, label: 'Intro seen', hidden: true },
];

const defaultsOf = (schema) => Object.fromEntries(schema.map((f) => [f.key, Array.isArray(f.def) ? [...f.def] : f.def]));
export const DEFAULT_SCENE = Object.freeze(defaultsOf(SCHEMA));
export const DEFAULT_SETTINGS = Object.freeze(defaultsOf(SETTINGS_SCHEMA));
export const SCENE_FIELDS = new Map(SCHEMA.map((f) => [f.key, f]));
export const SETTINGS_FIELDS = new Map(SETTINGS_SCHEMA.map((f) => [f.key, f]));

const decimals = (step) => (step >= 1 ? 0 : Math.min(6, Math.ceil(-Math.log10(step) - 1e-9)));

// Returns a clean value for one field, or the default when `v` is unusable.
export function cleanValue(field, v) {
  switch (field.type) {
    case 'num': {
      const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
      if (!Number.isFinite(n)) return field.def;
      const c = Math.min(Math.max(n, field.min), field.max);
      const s = field.step || 0;
      const snapped = s ? field.min + Math.round((c - field.min) / s) * s : c;
      return Number(Math.min(Math.max(snapped, field.min), field.max).toFixed(decimals(s || 0.0001)));
    }
    case 'int': {
      const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
      if (!Number.isFinite(n)) return field.def;
      return Math.min(Math.max(Math.round(n), field.min), field.max);
    }
    case 'bool':
      return v === true || v === 1 || v === '1' || v === 'true' ? true : v === false || v === 0 || v === '0' || v === 'false' ? false : field.def;
    case 'enum':
      return typeof v === 'string' && field.options.includes(v) ? v : field.def;
    case 'str': {
      if (typeof v !== 'string') return field.def;
      // printable text only, no markup characters; the UI also inserts it as text, never HTML
      return v.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, field.maxLen);
    }
    case 'chords': {
      const arr = Array.isArray(v) ? v : [];
      return field.def.map((d, i) => (typeof arr[i] === 'string' && BEHAVIOUR_KEYS.includes(arr[i]) ? arr[i] : d));
    }
    default:
      return field.def;
  }
}

function cleanWith(schema, obj, base) {
  const src = obj && typeof obj === 'object' ? obj : {};
  const out = {};
  for (const f of schema) {
    const has = Object.prototype.hasOwnProperty.call(src, f.key);
    out[f.key] = has ? cleanValue(f, src[f.key]) : Array.isArray(base[f.key]) ? [...base[f.key]] : base[f.key];
  }
  return out;
}

// A complete, valid scene from anything. Missing fields come from `base` (default: the defaults).
export const sanitizeScene = (obj, base = DEFAULT_SCENE) => cleanWith(SCHEMA, obj, base);
export const sanitizeSettings = (obj, base = DEFAULT_SETTINGS) => cleanWith(SETTINGS_SCHEMA, obj, base);

const same = (a, b) => (Array.isArray(a) ? Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i]) : a === b);

// Keys whose values differ between two scenes (or two settings objects).
export function diffKeys(a, b, schema = SCHEMA) {
  return schema.filter((f) => !same(a[f.key], b[f.key])).map((f) => f.key);
}

// ---- share links ---------------------------------------------------------
// A share code is "1" (the codec version) followed by base64url of a small JSON
// object holding only the fields that differ from the defaults, under their codes.
// Chords are stored as a string of base-36 behaviour ids.


const CODEC_VERSION = '1';
const MAX_CODE_LENGTH = 2048;

function toBase64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export function encodeScene(scene) {
  const clean = sanitizeScene(scene);
  const out = {};
  for (const f of SCHEMA) {
    const v = clean[f.key];
    if (same(v, f.def)) continue;
    if (f.type === 'chords') out[f.code] = v.map((k) => behaviourByKey(k).id.toString(36)).join('');
    else if (f.type === 'bool') out[f.code] = v ? 1 : 0;
    else out[f.code] = v;
  }
  return CODEC_VERSION + toBase64Url(JSON.stringify(out));
}

// Returns a full valid scene, or null if `code` is not a share code at all.
export function decodeScene(code) {
  if (typeof code !== 'string' || code.length < 1 || code.length > MAX_CODE_LENGTH) return null;
  if (code[0] !== CODEC_VERSION) return null;
  let raw;
  try {
    raw = JSON.parse(fromBase64Url(code.slice(1)));
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const byCode = {};
  for (const f of SCHEMA) {
    if (!Object.prototype.hasOwnProperty.call(raw, f.code)) continue;
    let v = raw[f.code];
    if (f.type === 'chords') {
      v = typeof v === 'string' ? [...v.slice(0, MAX_FINGERS)].map((c) => behaviourById(parseInt(c, 36))?.key) : [];
    }
    byCode[f.key] = v;
  }
  return sanitizeScene(byCode);
}

// The scene code in a URL hash such as "#s=1eyJ...", or null.
export function sceneCodeFromHash(hash) {
  if (typeof hash !== 'string') return null;
  const m = /(?:^#|&)s=([A-Za-z0-9_-]+)/.exec(hash);
  return m ? m[1] : null;
}
