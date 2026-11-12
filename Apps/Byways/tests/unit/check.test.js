import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  APP_CSP, LAB_CSP, expectedCsp, findForbidden, checkHtml, checkRefs, checkManifest, checkData, checkPrecache,
} from '../../tools/check.js';

const page = csp => `<!doctype html><meta http-equiv="Content-Security-Policy" content="${csp}"><script type="module" src="ui/boot.js"></script>`;
test('findForbidden flags each banned API once', () => {
  for (const s of ['el.innerHTML = x', 'el.outerHTML = x', 'el.insertAdjacentHTML("a", b)', 'document.write(1)', 'eval(x)', 'new Function("x")', '<script src="https://cdn.x/y.js"></script>'])
    assert.equal(findForbidden('a.js', s).length, 1, s);
  assert.deepEqual(findForbidden('a.js', 'const evaluate = 1; medieval(2); x.innerHTMLish = 3;'), []);
});
test('checkHtml wants the expected CSP and no inline code', () => {
  assert.deepEqual(checkHtml('x.html', page(APP_CSP)), []);
  assert.deepEqual(checkHtml('x.html', '<p>hi</p>'), ['x.html: missing CSP meta']);
  assert.deepEqual(checkHtml('x.html', page("default-src *")), ['x.html: wrong CSP']);
  assert.deepEqual(checkHtml('dist/pwa/lab/x.html', page(LAB_CSP)), []);
  assert.deepEqual(checkHtml('dist/pwa/lab/index.html', page(expectedCsp('lab/index.html'))), []);
  assert.deepEqual(checkHtml('dist/pwa/lab/x.html', page(expectedCsp('lab/index.html'))), ['dist/pwa/lab/x.html: wrong CSP']);
  assert.deepEqual(checkHtml('x.html', page(APP_CSP) + '<script>1</script>'), ['x.html: inline script']);
  assert.deepEqual(checkHtml('x.html', page(APP_CSP) + '<div style="color:red"></div><style>p{}</style>'), ['x.html: inline style', 'x.html: inline style']);
});
test('expectedCsp gives each Lab page its exact CSP', () => {
  assert.equal(LAB_CSP, "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' blob:; style-src 'self'; img-src 'self' https: data: blob:; media-src 'self' https: blob:; frame-src https://archive.org https://*.archive.org; connect-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'none'");
  assert.equal(expectedCsp('dist/pwa/index.html'), APP_CSP);
  for (const f of ['lab/dos.html', 'dist/pwa/lab/pc.html', 'dist/pwa/lab/flash.html']) assert.equal(expectedCsp(f), LAB_CSP, f);
  assert.equal(expectedCsp('lab/index.html'), LAB_CSP.replace('frame-src ', "frame-src 'self' "));
  for (const f of ['lab/console.html', 'shells/android/app/src/main/assets/lab/lab/console.html'])
    assert.equal(expectedCsp(f), LAB_CSP.replace("style-src 'self';", "style-src 'self'; style-src-attr 'unsafe-inline';"), f);
});
test('checkRefs reports imports and links that do not resolve', () => {
  const have = new Set(['/out/ui/a.js', '/out/index.html', '/out/ui/styles/app.css']); const exists = p => have.has(p);
  assert.deepEqual(checkRefs('/out/ui/b.js', "import { a } from './a.js'; import x from './gone.js'; export * from '../core/z.js'; const m = import('./lazy.js');", exists),
    ['/out/ui/b.js: missing ./gone.js', '/out/ui/b.js: missing ../core/z.js', '/out/ui/b.js: missing ./lazy.js']);
  assert.deepEqual(checkRefs('/out/index.html', '<a href="#/feed">F</a><a href="https://x.org/">X</a><link href="ui/styles/app.css?v=1"><img src="data:image/png;base64,AA"><a href="./">H</a><script src="ui/nope.js"></script>', exists),
    ['/out/index.html: missing ui/nope.js']);
});
test('checkManifest parses and wants relative scope', () => {
  assert.deepEqual(checkManifest('m.webmanifest', '{'), ['m.webmanifest: not valid JSON']);
  assert.deepEqual(checkManifest('m.webmanifest', '{"start_url":"/","scope":"./"}'), ['m.webmanifest: start_url must be ./']);
  assert.deepEqual(checkManifest('manifest.chrome.json', '{"manifest_version":3}'), []);
});
test('checkData validates the four data file shapes', () => {
  assert.deepEqual(checkData('tags.json', { v: 1, groups: [] }, {}), []);
  assert.match(checkData('tags.json', { v: 1, groups: [{ id: 'g', label: 'G', tags: [{ id: 'Retro Games', label: 'R' }] }] }, {})[0], /bad tag id/);
  const entry = { id: 'lib-0001', url: 'javascript:x', title: 't', blurb: 'b', tags: ['retro'], kind: 'site', added: '2026-11-11' };
  assert.match(checkData('library.json', { v: 1, entries: [entry] }, { tagIds: new Set(['retro']) })[0], /bad url/);
  assert.match(checkData('library.json', { v: 1, entries: [{ ...entry, url: 'https://x.org/', tags: ['nope'] }] }, { tagIds: new Set() })[0], /unknown tag nope/);
  assert.match(checkData('vault-starter.json', { v: 1, entries: [{ id: 'msdos_x', title: 't', platform: 'DOS', year: 1994, added: '2026-11-11' }] }, {})[0], /bad id/);
  assert.match(checkData('geocities-seeds.json', { v: 1, urls: ['ftp://x'] }, {})[0], /bad url/);
  assert.match(checkData('other.json', {}, {})[0], /unknown data file/);
});
test('checkPrecache wants a stamped id, existing files and under 2 MB', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pc-'));
  writeFileSync(join(dir, 'index.html'), '0123456789'); writeFileSync(join(dir, 'big.bin'), Buffer.alloc(2 * 1024 * 1024 + 1));
  assert.deepEqual(checkPrecache("const BUILD_ID = '__BUILD_ID__'; const PRECACHE = [\"__PRECACHE__\"];", dir), ['sw.js: build id not stamped', 'sw.js: precache list not written']);
  assert.deepEqual(checkPrecache(`const BUILD_ID = "dev"; const PRECACHE = ["./index.html","./gone.js"];`, dir), ['sw.js: precache missing ./gone.js']);
  assert.match(checkPrecache(`const BUILD_ID = "dev"; const PRECACHE = ["./index.html","./big.bin"];`, dir)[0], /app shell is over 2 MB/);
});
