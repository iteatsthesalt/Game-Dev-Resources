import test, { before, after } from 'node:test'; import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from '../../tools/serve.js';

let root, server, port;
before(async () => {
  root = mkdtempSync(join(tmpdir(), 'byways-serve-'));
  mkdirSync(join(root, 'sub'));
  writeFileSync(join(root, 'index.html'), 'home');
  writeFileSync(join(root, 'sub/index.html'), 'sub');
  writeFileSync(join(root, 'a.wasm'), 'wasm');
  server = createServer({ root, base: '/Game-Dev-Resources/byways/' });
  await new Promise(resolve => server.listen(0, resolve));
  port = server.address().port;
});
after(async () => {
  await new Promise(resolve => server.close(resolve));
  rmSync(root, { recursive: true, force: true });
});

const get = path => new Promise((resolve, reject) => {
  http.get({ port, path }, res => {
    let body = '';
    res.setEncoding('utf8');
    res.on('data', chunk => { body += chunk; });
    res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'], location: res.headers.location, body }));
  }).on('error', reject);
});

test('serves the base, MIME types and folder indexes', async () => {
  assert.deepEqual(await get('/Game-Dev-Resources/byways/'), { status: 200, type: 'text/html; charset=utf-8', location: undefined, body: 'home' });
  assert.equal((await get('/Game-Dev-Resources/byways/a.wasm')).type, 'application/wasm');
  assert.equal((await get('/Game-Dev-Resources/byways/sub/')).body, 'sub');
});
test('redirects the bare base and refuses everything else', async () => {
  const r = await get('/Game-Dev-Resources/byways'); assert.equal(r.status, 301); assert.equal(r.location, '/Game-Dev-Resources/byways/');
  assert.equal((await get('/other/')).status, 404);
  assert.equal((await get('/Game-Dev-Resources/byways/..%2f..%2fpackage.json')).status, 404);
  assert.equal((await get('/Game-Dev-Resources/byways/../../etc/passwd')).status, 404);
  assert.equal((await get('/Game-Dev-Resources/byways/missing.js')).status, 404);
});
