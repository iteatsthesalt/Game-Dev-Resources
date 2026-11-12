// The QR code a phone scans to join: an SVG string, dark modules on a light background.
//
// First version, written by the spine. The link part owns this file and replaces it.
import qrcode from 'qrcode-generator';

const QUIET_ZONE = 4; // modules of light margin, which scanners need to find the code

export function qrSvg(text) {
  // type 0 picks the smallest version that fits; 'M' survives about 15% damage or glare
  const qr = qrcode(0, 'M');
  qr.addData(String(text), 'Byte');
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
