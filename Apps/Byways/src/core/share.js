import { makeFind } from './model/find.js';
import { truncate } from './util/text.js';

export const MAX_LINK_CHARS = 2000;
export const SHARE_BASE = 'https://iteatsthesalt.github.io/Game-Dev-Resources/byways/';

const BROKEN = 'This link is broken or not from Byways.';
const MAX_ENCODED_CHARS = 65536;
const MAX_INFLATED_BYTES = 1_000_000;
const MAX_ITEMS = 500;
const TITLE_MAX = 80;
const KINDS = ['c', 'f', 'd'];
const BASE64URL = /^[A-Za-z0-9_-]*$/;
const FRAGMENT = '#s=';

const toBase64Url = bytes => btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function fromBase64Url(text) {
  if (!BASE64URL.test(text)) throw new Error(BROKEN);
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')), ch => ch.charCodeAt(0));
}

async function collect(stream, maxBytes) {
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new Error(BROKEN);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

const isItem = item => Array.isArray(item) && item.length === 3 && item.every(part => typeof part === 'string');

function isPayload(p) {
  return p !== null && typeof p === 'object' && p.v === 1 && KINDS.includes(p.t) && typeof p.n === 'string' &&
    Array.isArray(p.i) && p.i.length <= MAX_ITEMS && p.i.every(isItem);
}

/** Share payload to the text that follows `#s=`: base64url of the deflate-raw JSON. Does no validation. */
export async function encodeShare(payload) {
  const stream = new Blob([JSON.stringify(payload)]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return toBase64Url(await collect(stream, Infinity));
}

/**
 * Read a share payload from outside input. Input and inflated size are capped, and every failure rejects with the
 * same message, so a hostile link can neither exhaust memory nor leak a parser error. Only the four known keys are
 * returned, so a crafted link cannot carry extra fields to callers.
 */
export async function decodeShare(str) {
  try {
    if (typeof str !== 'string' || str.length > MAX_ENCODED_CHARS) throw new Error(BROKEN);
    const stream = new Blob([fromBase64Url(str)]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    const json = new TextDecoder('utf-8', { fatal: true }).decode(await collect(stream, MAX_INFLATED_BYTES));
    const payload = JSON.parse(json);
    if (!isPayload(payload)) throw new Error(BROKEN);
    return { v: 1, t: payload.t, n: payload.n, i: payload.i.map(([source, url, title]) => [source, url, title]) };
  } catch {
    throw new Error(BROKEN);
  }
}

export async function buildShareUrl(base, payload) {
  const url = base + FRAGMENT + (await encodeShare(payload));
  return { url, tooLong: url.length > MAX_LINK_CHARS };
}

export const shareItem = find => [find.source, find.url, truncate(find.title, TITLE_MAX)];

export const itemToFind = ([source, url, title]) =>
  makeFind({ source, url, title, kind: 'site', safety: 'mostly', why: ['Shared with you'] });

/** The payload text of a pasted Byways share link, or null when the text is anything else. */
export function payloadFromLink(text) {
  let link;
  try {
    link = new URL(String(text).trim());
  } catch {
    return null;
  }
  const page = link.origin + link.pathname;
  if (page !== SHARE_BASE && page !== SHARE_BASE + 'index.html') return null;
  if (!link.hash.startsWith(FRAGMENT)) return null;
  return link.hash.slice(FRAGMENT.length) || null;
}
