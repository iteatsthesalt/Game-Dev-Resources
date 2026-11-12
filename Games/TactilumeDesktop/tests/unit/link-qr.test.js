// main/qr.js: the QR code is the same code qrcode-generator makes, drawn as dark squares
// on a light ground with the four-module quiet zone scanners need.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import qrcode from 'qrcode-generator';
import { qrSvg } from '../../src/main/qr.js';

const URL = 'http://192.168.1.23:47615/#k=AbCdEfGhIjKlMnOpQrStUv';

test('the SVG draws exactly the dark modules of the code, inside a quiet zone of 4', () => {
  const svg = qrSvg(URL);
  const qr = qrcode(0, 'M');
  qr.addData(URL, 'Byte');
  qr.make();
  const n = qr.getModuleCount();
  const size = n + 8;
  assert.match(svg, new RegExp(`^<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"`));
  assert.match(svg, new RegExp(`<rect width="${size}" height="${size}" fill="#fff"/>`));
  const drawn = new Set([...svg.matchAll(/M(\d+) (\d+)h1v1h-1z/g)].map((m) => `${m[1]},${m[2]}`));
  let dark = 0;
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (!qr.isDark(row, col)) continue;
      dark++;
      assert.ok(drawn.has(`${col + 4},${row + 4}`), `module ${row},${col}`);
    }
  }
  assert.equal(drawn.size, dark);
  for (const key of drawn) {
    const [x, y] = key.split(',').map(Number);
    assert.ok(x >= 4 && y >= 4 && x < n + 4 && y < n + 4, `${key} is in the quiet zone`);
  }
});

test('a controller URL fits a small code that phones read easily', () => {
  const size = Number(/viewBox="0 0 (\d+)/.exec(qrSvg(URL))[1]);
  assert.ok(size - 8 <= 37, `version too large: ${size - 8} modules`); // version 5 or smaller
});

test('the SVG is only shapes: nothing from the text is copied into it', () => {
  const svg = qrSvg('"><script>alert(1)</script>');
  assert.equal(svg.includes('script'), false);
  assert.match(svg, /^<svg [^>]*><rect [^>]*\/><path d="[Mhvz0-9 -]*" fill="#000"\/><\/svg>$/);
});
