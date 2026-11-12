// Local-network helpers for the phone link: which peers may connect, which of this
// computer's addresses to put in the QR code, the session token, and the checks that keep
// web pages from elsewhere out. See CONTRACTS.md, "shared/lan.js". Pure: no Node or DOM APIs.

// [a, b, c, d] for a dotted-quad IPv4 address, or null. Leading zeros are refused, because
// some parsers read "010" as octal and the same text could then name two machines.
function parseIPv4(text) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(text);
  if (!m) return null;
  const parts = m.slice(1);
  if (parts.some((p) => p.length > 1 && p[0] === '0')) return null;
  const n = parts.map(Number);
  return n.every((x) => x <= 255) ? n : null;
}

// Eight 16-bit groups for an IPv6 address, or null. A zone id ("%eth0") is ignored and an
// IPv4 tail ("::ffff:192.168.1.5") is read as the last two groups.
function parseIPv6(text) {
  const zone = text.indexOf('%');
  const s = (zone >= 0 ? text.slice(0, zone) : text).toLowerCase();
  if (!s || /[^0-9a-f:.]/.test(s)) return null;
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const groups = (part, tailAllowed) => {
    if (part === '') return [];
    const pieces = part.split(':');
    const out = [];
    for (let i = 0; i < pieces.length; i++) {
      const g = pieces[i];
      if (g.includes('.')) {
        const v4 = tailAllowed && i === pieces.length - 1 ? parseIPv4(g) : null;
        if (!v4) return null;
        out.push((v4[0] << 8) | v4[1], (v4[2] << 8) | v4[3]);
      } else if (/^[0-9a-f]{1,4}$/.test(g)) {
        out.push(parseInt(g, 16));
      } else {
        return null;
      }
    }
    return out;
  };
  if (halves.length === 1) {
    const all = groups(halves[0], true);
    return all && all.length === 8 ? all : null;
  }
  const head = groups(halves[0], false);
  const tail = groups(halves[1], true);
  if (!head || !tail) return null;
  const missing = 8 - head.length - tail.length;
  return missing >= 1 ? [...head, ...new Array(missing).fill(0), ...tail] : null;
}

function isPrivateIPv4([a, b]) {
  return a === 10 || a === 127
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 169 && b === 254)
    || (a === 100 && b >= 64 && b <= 127);
}

// True for the addresses a phone on the same network can have: loopback, the private
// ranges, link-local and carrier-grade NAT (10/8, 172.16/12, 192.168/16, 169.254/16,
// 100.64/10, 127/8; ::1, fc00::/7, fe80::/10). A dual-stack server sees IPv4 peers as
// IPv4-mapped IPv6 (::ffff:a.b.c.d), which is judged by the IPv4 address inside.
// Anything else, including text that is not an address, is false.
export function isPrivateAddress(ip) {
  if (typeof ip !== 'string' || ip.length === 0 || ip.length > 64) return false;
  const v4 = parseIPv4(ip);
  if (v4) return isPrivateIPv4(v4);
  const g = parseIPv6(ip);
  if (!g) return false;
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) {
    return isPrivateIPv4([g[6] >> 8, g[6] & 0xff, g[7] >> 8, g[7] & 0xff]);
  }
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return true; // ::1
  return (g[0] & 0xfe00) === 0xfc00 || (g[0] & 0xffc0) === 0xfe80;   // fc00::/7, fe80::/10
}

// Adapters that are usually virtual (containers, virtual machines, VPNs, AirDrop): a phone is
// rarely on them, so their addresses go last. Linux and macOS names first, then Windows ones.
const VIRTUAL = /^(docker|br-|veth|virbr|vboxnet|vmnet|lxcbr|lxdbr|cni|flannel|cali|podman|tailscale|zt|wg|tun|tap|utun|ipsec|bridge|awdl|llw|anpi|ham)|virtualbox|vmware|vethernet|hyper-v|wsl|vpn|hamachi|zerotier|wireguard|openvpn|tap-windows|npcap|bluetooth/i;

// ifaces as os.networkInterfaces() returns them → [{ address, family, name }], best first.
// Only addresses a phone could reach are kept: private, not internal, and not IPv6
// link-local, which a browser cannot open without a zone id. Among those, IPv4 on a real
// adapter comes first, in the order the system lists them; then IPv6, link-local IPv4 (an
// adapter that found no router), carrier-grade NAT (usually a VPN), and virtual adapters.
export function pickLanAddresses(ifaces) {
  const found = [];
  for (const [name, list] of Object.entries(ifaces || {})) {
    for (const a of Array.isArray(list) ? list : []) {
      if (!a || typeof a.address !== 'string' || a.internal) continue;
      const family = a.family === 4 || a.family === 'IPv4' ? 'IPv4' : 'IPv6';
      if (!isPrivateAddress(a.address)) continue;
      if (family === 'IPv6' && /^fe[89ab]/i.test(a.address)) continue;
      const rank = (VIRTUAL.test(name) ? 8 : 0)
        + (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(a.address) ? 4 : 0)
        + (a.address.startsWith('169.254.') ? 2 : 0)
        + (family === 'IPv6' ? 1 : 0);
      found.push({ address: a.address, family, name, rank, order: found.length });
    }
  }
  found.sort((x, y) => x.rank - y.rank || x.order - y.order);
  return found.map(({ address, family, name }) => ({ address, family, name }));
}

const B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const TOKEN_BYTES = 16;

// randomBytes(n) → Uint8Array (crypto.randomBytes in Node). 16 bytes, 128 bits, become 22
// base64url characters with no padding: short enough for a small QR code, far too many
// to guess.
export function newToken(randomBytes) {
  const bytes = randomBytes(TOKEN_BYTES);
  if (!bytes || bytes.length < TOKEN_BYTES) throw new Error('newToken: randomBytes gave fewer than 16 bytes');
  let bits = 0, value = 0, out = '';
  for (let i = 0; i < TOKEN_BYTES; i++) {
    // at most 12 bits are still to be written here; the mask keeps the number small
    value = ((value << 8) | bytes[i]) & 0xffff;
    bits += 8;
    while (bits >= 6) {
      bits -= 6;
      out += B64URL[(value >> bits) & 63];
    }
  }
  if (bits > 0) out += B64URL[(value << (6 - bits)) & 63];
  return out;
}

// Compares two strings in a time that does not depend on where they first differ, so a
// guesser cannot learn the token one character at a time.
export function tokensEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const n = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) | 0) ^ (b.charCodeAt(i) | 0);
  return diff === 0;
}

// 'http://192.168.1.5:47615/#k=TOKEN'. The token rides in the fragment, which browsers never
// send to a server or put in a Referer header. IPv6 goes in brackets, with a zone's % as %25.
export function controllerUrl({ address, port, token }) {
  if (typeof address !== 'string' || !address) throw new TypeError('controllerUrl: no address');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new TypeError(`controllerUrl: bad port ${port}`);
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(token)) throw new TypeError('controllerUrl: bad token');
  const host = address.includes(':') ? `[${address.replace('%', '%25')}]` : address;
  return `http://${host}:${port}/#k=${token}`;
}

// Names only this network can resolve: none of them can be pointed here from the internet.
const LOCAL_SUFFIX = /\.(local|lan|home|home\.arpa|internal|localdomain|localhost)$/;
const HOSTNAME = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/;

// True for a Host header that a phone on this network sends: an IP address, localhost, a
// one-word computer name, or a name ending .local, .lan, .home, .home.arpa, .internal or
// .localdomain, each with an optional port. A public name is refused, because that is
// what a web page sends after pointing its own domain at this computer (DNS rebinding).
export function isLocalHostHeader(host) {
  if (typeof host !== 'string' || !host || host.length > 255) return false;
  let name = host.toLowerCase();
  if (name.startsWith('[')) {
    const end = name.indexOf(']');
    if (end < 0) return false;
    const rest = name.slice(end + 1);
    if (rest && !/^:\d{1,5}$/.test(rest)) return false;
    return parseIPv6(name.slice(1, end)) !== null;
  }
  const colon = name.lastIndexOf(':');
  if (colon >= 0) {
    if (!/^\d{1,5}$/.test(name.slice(colon + 1))) return false;
    name = name.slice(0, colon);
  }
  if (name.endsWith('.')) name = name.slice(0, -1); // a fully qualified "mypc.local."
  if (parseIPv4(name)) return true;
  if (!HOSTNAME.test(name)) return false;
  return name === 'localhost' || !name.includes('.') || LOCAL_SUFFIX.test(name);
}

// True when a WebSocket handshake's Origin is this server: the controller page the phone
// loaded from here. A page anywhere else that tries to open the link sends its own origin.
export function isSameOrigin(origin, host) {
  if (typeof origin !== 'string' || typeof host !== 'string' || !host) return false;
  return origin.toLowerCase() === `http://${host.toLowerCase()}`;
}
