// The messages between a phone and the desktop: JSON text over a WebSocket at /link.
// See CONTRACTS.md, "shared/protocol.js", for every field.
//
// Everything a phone sends is untrusted. The parsers check every field, clamp numbers into
// range and build each message afresh from the fields they know, so nothing unexpected (an
// extra field, a huge number, an invisible character in a name) reaches the renderer.
//
// This one file runs in three places: the Electron main process parses what phones send,
// the phone page parses what the desktop sends, and the renderer builds the replies. So it
// is plain JavaScript with no Node or DOM APIs.
//
// Optional fields beyond CONTRACTS.md (a page that leaves them out still works):
//   hello.id      a random id the page keeps for its tab, so a phone whose Wi-Fi blinks gets
//                 its own player back instead of a new one (16..64 base64url characters)
//   touch.ms      the phone's clock (ms) when it took the frame, so the renderer can measure
//                 how fast a finger moves without the network's jitter in the timing
//   state.color   the colour the desktop really draws this player in ('#rrggbb')

export const PROTOCOL = 1;
export const LIMITS = Object.freeze({ maxTouches: 10, maxMessageBytes: 4096, maxName: 24, maxRate: 240 /* msgs/s */ });
export const ACTIONS = Object.freeze(['behaviour', 'palette', 'preset', 'surprise', 'pulse', 'clear']);
export const REJECT_REASONS = Object.freeze(['token', 'full', 'closed', 'version', 'bad']);

export const MAX_SEQ = 2 ** 31 - 1;
const MAX_TOKEN = 64;
const MAX_PLAYERS = 64;            // in state.players: every player of every kind, not just phones
const MAX_LIST = 64;               // behaviours or palettes in a welcome
const MAX_LIST_NAME = 40;
const MAX_CLOCK_MS = 1e12;         // a page's performance.now(); 1e12 ms is 31 years
// Desktop → phone messages carry the behaviour and palette lists, so they get more room.
const MAX_DESKTOP_BYTES = LIMITS.maxMessageBytes * 4;

const SESSION_ID = /^[A-Za-z0-9_-]{16,64}$/;
const KEY = /^[a-z0-9][a-z0-9_-]{0,39}$/i;   // behaviour and palette keys, 'auto' included
const COLOR = /^#[0-9a-f]{6}$/i;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
// + 0 turns -0 into 0, so a clamped value prints as "0", never "-0"
const unit = (v) => clamp(v, 0, 1) + 0;
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const isKey = (v) => typeof v === 'string' && KEY.test(v);
const isColor = (v) => typeof v === 'string' && COLOR.test(v);
const round = (v, places) => Math.round(v * 10 ** places) / 10 ** places;

// UTF-8 length without allocating: the limits are in bytes, and JSON may carry any text. A
// surrogate pair is one 4-byte character; a lone surrogate would be sent as U+FFFD, 3 bytes.
export function utf8Length(text) {
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length) {
      const d = text.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) { n += 4; i++; } else n += 3;
    } else n += 3;
  }
  return n;
}

// ---- names --------------------------------------------------------------------------------

// Characters that would make a name print oddly or pretend to be someone else's: control
// characters, lone surrogates, line and paragraph separators, and invisible formatting
// (bidirectional marks, overrides and isolates, zero-width spaces, the byte-order mark).
// The zero-width joiner stays, because emoji such as 👩‍💻 are built with it.
const UNPRINTABLE = /[\p{Cc}\p{Cs}\p{Zl}\p{Zp}­؜᠎​‎‏‪-‮⁠-⁯﻿￹-￻]/gu;
const SPACES = /[\s\p{Zs}]+/gu;
// A run of combining marks longer than this is decoration piled on one letter ("Zalgo"),
// which would spill over the lines around it. Real text and emoji keycaps need two at most.
const MARK_RUN = /(\p{M}{2})\p{M}+/gu;
const MAX_NAME_CODE_POINTS = 64;
const graphemes = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  : null;

// The printable part of `v`, with spaces collapsed, cut to `max` characters as a person
// counts them (graphemes), and to 64 code points in all. Not a string → ''. Tabs and line
// breaks count as spaces; the invisible characters are removed after that, and the spaces
// collapsed again, so "a ​ b" reads "a b".
export function cleanText(v, max = LIMITS.maxName) {
  if (typeof v !== 'string') return '';
  const text = v.replace(SPACES, ' ').replace(UNPRINTABLE, '').replace(MARK_RUN, '$1').replace(/ {2,}/g, ' ').trim();
  const parts = graphemes ? Array.from(graphemes.segment(text), (s) => s.segment) : Array.from(text);
  let out = '';
  let points = 0;
  for (let i = 0; i < parts.length && i < max; i++) {
    const size = Array.from(parts[i]).length;
    if (points + size > MAX_NAME_CODE_POINTS) break;
    out += parts[i];
    points += size;
  }
  return out.trim();
}

// ---- parsing ------------------------------------------------------------------------------

const fail = (error) => ({ ok: false, error });
const FIELD = Object.freeze(fail('field'));

function parseJson(text, maxBytes) {
  if (typeof text !== 'string') return fail('type');
  // the cheap test first: every UTF-16 unit is at least one byte
  if (text.length > maxBytes || utf8Length(text) > maxBytes) return fail('size');
  let value;
  try { value = JSON.parse(text); } catch { return fail('json'); }
  if (!isObject(value)) return fail('json');
  if (typeof value.t !== 'string') return fail('type');
  return { ok: true, value };
}

// [[id, x, y, f?], …] → the same, clamped, or null when any entry is malformed. A finger
// listed twice keeps its first entry.
function parseTouches(p) {
  if (!Array.isArray(p) || p.length > LIMITS.maxTouches) return null;
  const seen = new Set();
  const out = [];
  for (const t of p) {
    if (!Array.isArray(t) || t.length < 3 || t.length > 4) return null;
    const [id, x, y, f = 0.5] = t;
    if (!isInt(id, 0, 255) || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(f)) return null;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push([id, unit(x), unit(y), unit(f)]);
  }
  return out;
}

function parseHello(m) {
  // any whole version passes here, so the server can answer 'version' rather than 'bad'
  if (!isInt(m.v, 0, MAX_SEQ)) return FIELD;
  if (typeof m.token !== 'string' || m.token.length < 1 || m.token.length > MAX_TOKEN) return FIELD;
  if (m.name !== undefined && typeof m.name !== 'string') return FIELD;
  if (m.id !== undefined && !(typeof m.id === 'string' && SESSION_ID.test(m.id))) return FIELD;
  if (m.caps !== undefined && !isObject(m.caps)) return FIELD;
  const caps = m.caps || {};
  if (caps.touches !== undefined && !Number.isFinite(caps.touches)) return FIELD;
  if (caps.haptics !== undefined && typeof caps.haptics !== 'boolean') return FIELD;
  const msg = {
    t: 'hello',
    v: m.v,
    token: m.token,
    name: cleanText(m.name, LIMITS.maxName),
    caps: {
      touches: caps.touches === undefined ? 1 : clamp(Math.round(caps.touches), 1, LIMITS.maxTouches),
      haptics: caps.haptics === true,
    },
  };
  if (m.id !== undefined) msg.id = m.id;
  return { ok: true, msg };
}

// What a phone sends → { ok: true, msg } | { ok: false, error: 'json'|'type'|'field'|'size' }.
// 'json': not a JSON object. 'type': no `t`, or one this protocol does not have.
// 'field': a known message with a missing or malformed field. 'size': over maxMessageBytes.
export function parsePhoneMessage(text) {
  const r = parseJson(text, LIMITS.maxMessageBytes);
  if (!r.ok) return r;
  const m = r.value;
  switch (m.t) {
    case 'hello':
      return parseHello(m);
    case 'touch': {
      if (!isInt(m.s, 0, MAX_SEQ)) return FIELD;
      if (m.ms !== undefined && !(Number.isFinite(m.ms) && m.ms >= 0 && m.ms <= MAX_CLOCK_MS)) return FIELD;
      const p = parseTouches(m.p);
      if (!p) return FIELD;
      const msg = { t: 'touch', s: m.s, p };
      if (m.ms !== undefined) msg.ms = m.ms;
      return { ok: true, msg };
    }
    case 'act': {
      if (!ACTIONS.includes(m.a)) return FIELD;
      if (m.v !== undefined && !Number.isFinite(m.v)) return FIELD;
      // no direction means "forward"; any other number is its sign
      return { ok: true, msg: { t: 'act', a: m.a, v: m.v === undefined ? 0 : clamp(Math.round(m.v), -1, 1) + 0 } };
    }
    case 'ping':
      return Number.isFinite(m.c) ? { ok: true, msg: { t: 'ping', c: m.c } } : FIELD;
    default:
      return fail('type');
  }
}

// [{ key, name }, …] → the same with clean names, or null when malformed.
function parseList(list) {
  if (!Array.isArray(list) || list.length > MAX_LIST) return null;
  const out = [];
  for (const e of list) {
    if (!isObject(e) || !isKey(e.key) || typeof e.name !== 'string') return null;
    out.push({ key: e.key, name: cleanText(e.name, MAX_LIST_NAME) || e.key });
  }
  return out;
}

function parseState(m) {
  const msg = { t: 'state' };
  if (m.behaviour !== undefined) { if (!isKey(m.behaviour)) return FIELD; msg.behaviour = m.behaviour; }
  if (m.palette !== undefined) { if (!isKey(m.palette)) return FIELD; msg.palette = m.palette; }
  if (m.players !== undefined) { if (!isInt(m.players, 0, MAX_PLAYERS)) return FIELD; msg.players = m.players; }
  if (m.color !== undefined) { if (!isColor(m.color)) return FIELD; msg.color = m.color.toLowerCase(); }
  return { ok: true, msg };
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
      if (!isInt(m.player, 1, 8) || !isColor(m.color) || !behaviours || !palettes) return FIELD;
      return {
        ok: true,
        msg: {
          t: 'welcome',
          v: isInt(m.v, 0, MAX_SEQ) ? m.v : PROTOCOL,
          player: m.player,
          color: m.color.toLowerCase(),
          name: cleanText(m.name, LIMITS.maxName),
          behaviour: isKey(m.behaviour) ? m.behaviour : '',
          palette: isKey(m.palette) ? m.palette : '',
          behaviours,
          palettes,
        },
      };
    }
    case 'reject':
      return { ok: true, msg: reject(m.why) };
    case 'haptic':
      return Number.isFinite(m.ms) && Number.isFinite(m.k) ? { ok: true, msg: haptic(m.ms, m.k) } : FIELD;
    case 'pong':
      return Number.isFinite(m.c) && Number.isFinite(m.s) ? { ok: true, msg: pong(m.c, m.s) } : FIELD;
    case 'state':
      return parseState(m);
    default:
      return fail('type');
  }
}

export const encode = (msg) => JSON.stringify(msg);

// ---- builders, desktop → phone ----------------------------------------------------------

const list = (l) => (Array.isArray(l) ? l : [])
  .filter((e) => e && isKey(e.key))
  .slice(0, MAX_LIST)
  .map((e) => ({ key: e.key, name: cleanText(String(e.name ?? ''), MAX_LIST_NAME) || e.key }));

export function welcome({ player, color, name = '', behaviour = '', palette = '', behaviours = [], palettes = [] }) {
  return {
    t: 'welcome', v: PROTOCOL, player, color, name: cleanText(name, LIMITS.maxName),
    behaviour: isKey(behaviour) ? behaviour : '', palette: isKey(palette) ? palette : '',
    behaviours: list(behaviours), palettes: list(palettes),
  };
}

export const reject = (why) => ({ t: 'reject', why: REJECT_REASONS.includes(why) ? why : 'bad' });

export function haptic(ms, k) {
  return { t: 'haptic', ms: clamp(Math.round(Number(ms) || 0), 1, 500), k: unit(Number(k) || 0) };
}

export const pong = (c, s) => ({ t: 'pong', c, s });

// { behaviour?, palette?, players?, color? }: only the parts given and valid, so a phone can
// merge them into what it knows.
export function state(partial = {}) {
  const p = isObject(partial) ? partial : {};
  const msg = { t: 'state' };
  if (isKey(p.behaviour)) msg.behaviour = p.behaviour;
  if (isKey(p.palette)) msg.palette = p.palette;
  if (isInt(p.players, 0, MAX_PLAYERS)) msg.players = p.players;
  if (isColor(p.color)) msg.color = p.color.toLowerCase();
  return msg;
}

// ---- builders, phone → desktop (the phone page uses these) --------------------------------

export function hello({ token, name = '', id, touches = LIMITS.maxTouches, haptics = false }) {
  const msg = { t: 'hello', v: PROTOCOL, token, name, caps: { touches, haptics } };
  if (id) msg.id = id;
  return msg;
}

// `points`: [[id, x, y, f], …] in pad space. Four decimals of x and y are finer than a pixel
// on any phone and keep a ten-finger frame near 300 bytes.
export function touch(seq, points, ms) {
  const msg = { t: 'touch', s: seq, p: points.map(([id, x, y, f]) => [id, round(x, 4), round(y, 4), round(f, 2)]) };
  if (Number.isFinite(ms)) msg.ms = round(ms, 1);
  return msg;
}

export const act = (a, v) => (v === undefined ? { t: 'act', a } : { t: 'act', a, v });

export const ping = (c) => ({ t: 'ping', c });
