const encoder = new TextEncoder();

/** FNV-1a, 32-bit, over the UTF-8 bytes of `str`. Returns an unsigned integer. */
export function fnv1a32(str) {
  let h = 0x811c9dc5;
  for (const byte of encoder.encode(str)) {
    h ^= byte;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const MASK_64 = 0xffffffffffffffffn;

/** FNV-1a, 64-bit, over the UTF-8 bytes of `str`. Returns 16 lowercase hex characters. */
export function hash64(str) {
  let h = 0xcbf29ce484222325n;
  for (const byte of encoder.encode(str)) {
    h ^= BigInt(byte);
    h = (h * 0x100000001b3n) & MASK_64;
  }
  return h.toString(16).padStart(16, '0');
}

/** Seeded generator returning values in [0,1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** SHA-256 of a string (UTF-8) or bytes, as 64 lowercase hex characters. */
export async function sha256Hex(data) {
  const bytes = typeof data === 'string' ? encoder.encode(data) : data;
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** A Gumbel(0,1) sample from `rand`, with u clamped away from 0 and 1 so the result stays finite. */
export function gumbel(rand) {
  const u = Math.min(Math.max(rand(), 1e-12), 1 - 1e-12);
  return -Math.log(-Math.log(u));
}
