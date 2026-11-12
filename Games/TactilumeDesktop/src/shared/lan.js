// Local-network helpers for the phone link: which peers may connect, which of this
// computer's addresses to show in the QR code, and the session token.
//
// First version, written by the spine. The link part owns this file and replaces it.

// [a, b, c, d] for a dotted IPv4 address, or null.
function parseIPv4(ip) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  return parts.every((n) => n <= 255) ? parts : null;
}

// Eight 16-bit groups for an IPv6 address (zone ids and an embedded IPv4 tail allowed), or null.
function parseIPv6(ip) {
  const text = ip.split('%')[0];
  if (!/^[0-9a-f:.]+$/i.test(text) || text.split('::').length > 2) return null;
  const toGroups = (s) => {
    if (!s) return [];
    const out = [];
    for (const g of s.split(':')) {
      const v4 = g.includes('.') ? parseIPv4(g) : null;
      if (v4) out.push((v4[0] << 8) | v4[1], (v4[2] << 8) | v4[3]);
      else if (/^[0-9a-f]{1,4}$/i.test(g)) out.push(parseInt(g, 16));
      else return null;
    }
    return out;
  };
  const [head, tail] = text.split('::');
  const a = toGroups(head);
  const b = tail === undefined ? [] : toGroups(tail);
  if (!a || !b) return null;
  if (tail === undefined) return a.length === 8 ? a : null;
  const missing = 8 - a.length - b.length;
  return missing >= 1 ? [...a, ...new Array(missing).fill(0), ...b] : null;
}

function isPrivateIPv4([a, b]) {
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
    || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127);
}

// True for loopback, private, link-local and carrier-grade NAT addresses: the peers a phone
// on the same network can have. IPv4-mapped IPv6 (::ffff:a.b.c.d) is judged as the IPv4 inside.
export function isPrivateAddress(ip) {
  if (typeof ip !== 'string' || !ip) return false;
  const v4 = parseIPv4(ip);
  if (v4) return isPrivateIPv4(v4);
  const g = parseIPv6(ip);
  if (!g) return false;
  const mapped = g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff;
  if (mapped) return isPrivateIPv4([g[6] >> 8, g[6] & 255, g[7] >> 8, g[7] & 255]);
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return true; // ::1
  return (g[0] & 0xfe00) === 0xfc00 || (g[0] & 0xffc0) === 0xfe80;   // fc00::/7, fe80::/10
}

// Adapters that are usually virtual (containers, VMs, VPNs): a phone is rarely on them.
const VIRTUAL = /^(docker|vbox|vmnet|utun|br-|veth|tailscale|zt)|virtualbox|vmware|vethernet|hyper-v|wsl/i;

// ifaces as os.networkInterfaces() returns them → [{ address, family, name }], best first.
// Only addresses a phone could reach are kept: private, not internal, and not IPv6
// link-local (a browser cannot open those without a zone id).
export function pickLanAddresses(ifaces) {
  const found = [];
  for (const [name, list] of Object.entries(ifaces || {})) {
    for (const a of list || []) {
      const family = a.family === 4 || a.family === 'IPv4' ? 'IPv4' : 'IPv6';
      if (a.internal || !isPrivateAddress(a.address)) continue;
      if (family === 'IPv6' && /^fe[89ab]/i.test(a.address)) continue;
      const rank = (VIRTUAL.test(name) ? 4 : 0) + (family === 'IPv6' ? 2 : 0) + (a.address.startsWith('169.254.') ? 1 : 0);
      found.push({ address: a.address, family, name, rank, order: found.length });
    }
  }
  found.sort((x, y) => x.rank - y.rank || x.order - y.order);
  return found.map(({ address, family, name }) => ({ address, family, name }));
}

const B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

// randomBytes(n) → Uint8Array. 16 bytes (128 bits) → 22 base64url characters, no padding.
export function newToken(randomBytes) {
  const bytes = randomBytes(16);
  let bits = 0, value = 0, out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 6) {
      bits -= 6;
      out += B64URL[(value >> bits) & 63];
    }
  }
  if (bits > 0) out += B64URL[(value << (6 - bits)) & 63];
  return out;
}

// Compares two strings in time that does not depend on where they first differ, so a
// guesser cannot learn the token one character at a time.
export function tokensEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const n = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) | 0) ^ (b.charCodeAt(i) | 0);
  return diff === 0;
}

// 'http://192.168.1.5:47615/#k=TOKEN'. The token rides in the fragment, which browsers never
// send to a server or put in a Referer header.
export function controllerUrl({ address, port, token }) {
  const host = address.includes(':') ? `[${address}]` : address;
  return `http://${host}:${port}/#k=${token}`;
}
