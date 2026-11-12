// The QR code a phone scans to join: an SVG string, dark modules on a light background, with
// the four-module quiet zone scanners need. See CONTRACTS.md, "main/qr.js".
//
// Only shapes go into the SVG, never the text itself, so whatever the text holds it cannot
// add markup to the page that shows the code. tests/unit/link-qr.test.js checks the modules
// against qrcode-generator's own.
import qrcode from 'qrcode-generator';

const QUIET_ZONE = 4; // modules of light margin

export function qrSvg(text) {
  if (typeof text !== 'string' || !text) throw new TypeError('qrSvg: the text to encode is missing');
  // type 0 picks the smallest version that fits; 'M' survives about 15% damage or glare,
  // and fits a controller URL with an IPv4 address (about 52 characters) in version 4,
  // 33 modules across, easy to scan from across a room
  const qr = qrcode(0, 'M');
  qr.addData(text, 'Byte');
  qr.make();
  const n = qr.getModuleCount();
  const size = n + QUIET_ZONE * 2;
  // one path for every dark module keeps the SVG small
  let d = '';
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (qr.isDark(row, col)) d += `M${col + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">`
    + `<rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
