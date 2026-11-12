// The messages between a phone and the desktop: JSON text over a WebSocket at /link.
// See CONTRACTS.md, "shared/protocol.js", for every field.
//
// Everything a phone sends is untrusted. The parsers check every field, clamp numbers into
// range and rebuild each message from the fields they know, so nothing unexpected reaches
// the renderer.
//
// First version, written by the spine. The link part owns this file and replaces it.

export const PROTOCOL = 1;
export const LIMITS = Object.freeze({ maxTouches: 10, maxMessageBytes: 4096, maxName: 24, maxRate: 240 /* msgs/s */ });
export const ACTIONS = Object.freeze(['behaviour', 'palette', 'preset', 'surprise', 'pulse', 'clear']);
export const REJECT_REASONS = Object.freeze(['token', 'full', 'closed', 'version', 'bad']);

const MAX_SEQ = 2 ** 31 - 1;
// desktop → phone messages carry the behaviour and palette lists, so they get more room
const MAX_DESKTOP_BYTES = LIMITS.maxMessageBytes * 4;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

// UTF-8 length without allocating: the limits are in bytes, and JSON may carry any text.
function byteLength(text) {
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff) { n += 4; i++; } // a surrogate pair is one 4-byte character
    else n += 3;
  }
  return n;
}

// Control characters and bidirectional overrides would make a name print oddly or
// pretend to be someone else's, so they are removed before the length cut.
const UNPRINTABLE = /[\p{Cc}‎‏‪-‮⁦-⁩]/gu;
function cleanName(v) {
  if (typeof v !== 'string') return '';
  const chars = Array.from(v.replace(UNPRINTABLE, '').trim()).slice(0, LIMITS.maxName);
  return chars.join('').trim();
}

function parseJson(text, maxBytes) {
  if (typeof text !== 'string') return { ok: false, error: 'type' };
  // the cheap test first: every UTF-16 unit is at least one byte
  if (text.length > maxBytes || byteLength(text) > maxBytes) return { ok: false, error: 'size' };
  let value;
  try { value = JSON.parse(text); } catch { return { ok: false, error: 'json' }; }
  if (!isObject(value)) return { ok: false, error: 'json' };
  if (typeof value.t !== 'string') return { ok: false, error: 'type' };
  return { ok: true, value };
}

const field = { ok: false, error: 'field' };

function parseTouches(p) {
  if (!Array.isArray(p) || p.length > LIMITS.maxTouches) return null;
  const seen = new Set();
  const out = [];
  for (const t of p) {
    if (!Array.isArray(t) || t.length < 3 || t.length > 4) return null;
    const [id, x, y, f = 0.5] = t;
    if (!isInt(id, 0, 255) || ![x, y, f].every(Number.isFinite)) return null;
    if (seen.has(id)) continue; // the same finger twice: keep the first
    seen.add(id);
    out.push([id, clamp(x, 0, 1), clamp(y, 0, 1), clamp(f, 0, 1)]);
  }
  return out;
}

// → { ok: true, msg } | { ok: false, error: 'json'|'type'|'field'|'size' }
export function parsePhoneMessage(text) {
  const r = parseJson(text, LIMITS.maxMessageBytes);
  if (!r.ok) return r;
  const m = r.value;
  switch (m.t) {
    case 'hello': {
      // any whole version number passes, so the server can answer 'version' rather than 'bad'
      if (!isInt(m.v, 0, MAX_SEQ)) return field;
      if (typeof m.token !== 'string' || m.token.length < 1 || m.token.length > 64) return field;
      if (m.name !== undefined && typeof m.name !== 'string') return field;
      const caps = isObject(m.caps) ? m.caps : {};
      const touches = Number.isFinite(caps.touches) ? clamp(Math.round(caps.touches), 1, LIMITS.maxTouches) : 1;
      return { ok: true, msg: { t: 'hello', v: m.v, token: m.token, name: cleanName(m.name), caps: { touches, haptics: caps.haptics === true } } };
    }
    case 'touch': {
      if (!isInt(m.s, 0, MAX_SEQ)) return field;
      const p = parseTouches(m.p);
      return p ? { ok: true, msg: { t: 'touch', s: m.s, p } } : field;
    }
    case 'act': {
      if (!ACTIONS.includes(m.a)) return field;
      if (m.v !== undefined && !Number.isFinite(m.v)) return field;
      return { ok: true, msg: { t: 'act', a: m.a, v: m.v === undefined ? 0 : clamp(Math.round(m.v), -1, 1) } };
    }
    case 'ping':
      return Number.isFinite(m.c) ? { ok: true, msg: { t: 'ping', c: m.c } } : field;
    default:
      return { ok: false, error: 'type' };
  }
}

const isColor = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
const isKey = (v) => typeof v === 'string' && v.length > 0 && v.length <= 40;
function parseList(list) {
  if (!Array.isArray(list) || list.length > 64) return null;
  const out = [];
  for (const e of list) {
    if (!isObject(e) || !isKey(e.key) || typeof e.name !== 'string') return null;
    out.push({ key: e.key, name: e.name.slice(0, 40) });
  }
  return out;
}

// The same, for the phone page reading what the desktop sends.
export function parseDesktopMessage(text) {
  const r = parseJson(text, MAX_DESKTOP_BYTES);
  if (!r.ok) return r;
  const m = r.value;
  switch (m.t) {
    case 'welcome': {
      const behaviours = parseList(m.behaviours);
      const palettes = parseList(m.palettes);
      if (!isInt(m.player, 1, 8) || !isColor(m.color) || !behaviours || !palettes) return field;
      return { ok: true, msg: { t: 'welcome', player: m.player, color: m.color, name: cleanName(m.name), behaviour: isKey(m.behaviour) ? m.behaviour : '', palette: isKey(m.palette) ? m.palette : '', behaviours, palettes } };
    }
    case 'reject':
      return { ok: true, msg: { t: 'reject', why: REJECT_REASONS.includes(m.why) ? m.why : 'bad' } };
    case 'haptic':
      return Number.isFinite(m.ms) && Number.isFinite(m.k) ? { ok: true, msg: haptic(m.ms, m.k) } : field;
    case 'pong':
      return Number.isFinite(m.c) && Number.isFinite(m.s) ? { ok: true, msg: pong(m.c, m.s) } : field;
    case 'state': {
      const msg = state(m);
      if (m.players !== undefined && !msg.players) return field;
      return { ok: true, msg };
    }
    default:
      return { ok: false, error: 'type' };
  }
}

export const encode = (msg) => JSON.stringify(msg);

// ---- builders, desktop → phone ----------------------------------------------

export function welcome({ player, color, name = '', behaviour = '', palette = '', behaviours = [], palettes = [] }) {
  const list = (l) => l.map(({ key, name: n }) => ({ key, name: n }));
  return { t: 'welcome', v: PROTOCOL, player, color, name, behaviour, palette, behaviours: list(behaviours), palettes: list(palettes) };
}

export const reject = (why) => ({ t: 'reject', why: REJECT_REASONS.includes(why) ? why : 'bad' });

export function haptic(ms, k) {
  return { t: 'haptic', ms: clamp(Math.round(Number(ms) || 0), 1, 500), k: clamp(Number(k) || 0, 0, 1) };
}

export const pong = (c, s) => ({ t: 'pong', c, s });

// { behaviour?, palette?, players? }: only the parts given, so a phone can merge them.
export function state(partial = {}) {
  const msg = { t: 'state' };
  if (isKey(partial.behaviour)) msg.behaviour = partial.behaviour;
  if (isKey(partial.palette)) msg.palette = partial.palette;
  if (Number.isInteger(partial.players) && partial.players >= 0 && partial.players <= 8) msg.players = partial.players;
  return msg;
}
