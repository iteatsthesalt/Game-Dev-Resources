import http from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.zip': 'application/zip',
};

function statOrNull(path) {
  try { return statSync(path); } catch { return null; }
}

function decode(path) {
  try { return decodeURIComponent(path); } catch { return null; }
}

// Maps a request path to a file under root, or null when it is outside base, escapes root or is missing.
function locate(root, base, rawPath) {
  if (!rawPath.startsWith(base)) return null;
  const rel = decode(rawPath.slice(base.length));
  if (rel === null || rel.includes('\0')) return null;
  const target = resolve(root, rel);
  const inside = relative(root, target);
  if (inside === '..' || inside.startsWith('..' + sep) || isAbsolute(inside)) return null;
  const info = statOrNull(target);
  if (info?.isDirectory()) {
    const index = join(target, 'index.html');
    return statOrNull(index)?.isFile() ? index : null;
  }
  return info?.isFile() ? target : null;
}

export function createServer({ root, base }) {
  const rootDir = resolve(root);
  return http.createServer((req, res) => {
    const send = (status, headers = {}, body = '') => {
      res.writeHead(status, { 'Cache-Control': 'no-store', ...headers });
      res.end(body);
    };
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, { Allow: 'GET, HEAD' });
    const path = req.url.split(/[?#]/)[0];
    if (path === base.slice(0, -1)) return send(301, { Location: base });
    const file = locate(rootDir, base, path);
    if (!file) return send(404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not found');
    res.writeHead(200, { 'Cache-Control': 'no-store', 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
    if (req.method === 'HEAD') return res.end();
    createReadStream(file).on('error', () => res.destroy()).pipe(res);
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const option = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
  const root = option('--root', 'dist/pwa');
  const base = option('--base', '/');
  const port = Number(option('--port', 4321));
  createServer({ root, base }).listen(port, () => console.log(`Serving ${root} at http://localhost:${port}${base}`));
}
