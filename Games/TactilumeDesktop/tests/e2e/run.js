#!/usr/bin/env node
// Plays the built renderer in Playwright's Chromium and checks that it works.
//   node tests/e2e/run.js               every scenario
//   node tests/e2e/run.js boot phone    only the scenarios whose names contain one of these words
//   DIST=/path/to/dist node tests/e2e/run.js   test another build
//   VERBOSE=1 node tests/e2e/run.js     also list the checks that passed
//
// dist/ is served on 127.0.0.1 at a free port by the small static server below. Chromium
// runs headless with WebGPU on its software adapter (SwiftShader). Each scenario gets a fresh
// browser context and a time limit, and fails when a check fails, when it throws or runs out
// of time, or when any of its pages reports an error: an uncaught exception, console.error,
// a WebGPU validation message, or a request that leaves the local server (the app works
// offline).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import scenarios from './scenarios.js';
import { createHelpers } from './helpers.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(process.env.DIST || path.join(here, '..', '..', 'dist'));
const SCENARIO_TIMEOUT_MS = 90000;
const VIEWPORT = { width: 800, height: 500 };
const BROWSER_ARGS = ['--enable-unsafe-webgpu', '--enable-unsafe-swiftshader'];

// Warnings that are real faults: WebGPU reports validation errors as console warnings.
const GPU_FAULTS = [/GPUValidationError/i, /\bWhile (calling|validating|encoding)\b/, /\[Invalid \w+/];

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.wasm': 'application/wasm',
};

function serve(root) {
  const server = http.createServer((req, res) => {
    const reply = (status, body = '', type = 'text/plain') => {
      res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
      res.end(body);
    };
    // the classic page asks for a favicon it does not have; an empty answer keeps 404s out of the console
    const { pathname } = new URL(req.url, 'http://localhost');
    if (pathname === '/favicon.ico') return reply(204);
    const file = path.join(root, decodeURIComponent(pathname));
    if (file !== root && !file.startsWith(root + path.sep)) return reply(403, 'outside dist/');
    fs.readFile(file, (err, body) => {
      if (err) return reply(404, 'not found');
      reply(200, body, TYPES[path.extname(file)] || 'application/octet-stream');
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function withTimeout(promise, ms, what) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${what} took longer than ${ms / 1000} s`)), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const firstLines = (text, n = 6) => String(text).split('\n').slice(0, n).join('\n');

// Every page in the context is watched; requests may only go to the local server.
async function watch(context, origin, errors) {
  context.on('page', (page) => {
    const where = () => { try { return ` [${new URL(page.url()).pathname}]`; } catch { return ''; } };
    page.on('pageerror', (e) => errors.push(`page error${where()}: ${firstLines(e.stack || e.message, 5)}`));
    page.on('crash', () => errors.push(`the page crashed${where()}`));
    page.on('console', (m) => {
      const text = m.text();
      if (m.type() === 'error' || (m.type() === 'warning' && GPU_FAULTS.some((re) => re.test(text)))) {
        errors.push(`console ${m.type()}${where()}: ${firstLines(text, 5)}`);
      }
    });
  });
  await context.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(`${origin}/`)) return route.continue();
    errors.push(`a request left the local server (the app must work offline): ${url.slice(0, 120)}`);
    return route.abort();
  });
}

async function runScenario(browser, s, baseUrl) {
  const errors = [];
  const context = await browser.newContext({ viewport: s.viewport || VIEWPORT, deviceScaleFactor: 1 });
  const h = createHelpers({ baseUrl, context });
  let checks = [];
  let crash = null;
  try {
    await watch(context, baseUrl, errors);
    const page = await context.newPage();
    checks = await withTimeout(s.run(page, h), s.timeout || SCENARIO_TIMEOUT_MS, 'the scenario');
    if (!Array.isArray(checks)) throw new Error('the scenario did not return a list of checks');
  } catch (e) {
    crash = firstLines(e && e.stack ? e.stack : e);
    // report the checks made before it stopped, and say where that was
    checks = h.log.slice();
    if (checks.length) crash += `\n(after the check "${checks[checks.length - 1].name}")`;
  }
  await context.close().catch(() => {});
  return { checks, crash, errors };
}

async function main() {
  if (!fs.existsSync(path.join(DIST, 'renderer', 'index.html'))) {
    console.error(`No build to test in ${DIST}. Build it first: npm run build`);
    process.exit(1);
  }
  const want = process.argv.slice(2);
  const list = scenarios.filter((s) => !want.length || want.some((w) => s.name.includes(w)));
  if (!list.length) {
    console.error(`No scenario matches "${want.join(' ')}". Scenarios:\n  ${scenarios.map((s) => s.name).join('\n  ')}`);
    process.exit(1);
  }

  const server = await serve(DIST);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  console.log(`Testing ${path.relative(process.cwd(), DIST) || DIST} at ${baseUrl}\n`);
  let browser = await chromium.launch({ args: BROWSER_ARGS });
  let failed = 0;
  for (const s of list) {
    // a crashed GPU process can take the browser with it; the next scenario gets a new one
    if (!browser.isConnected()) browser = await chromium.launch({ args: BROWSER_ARGS });
    const t0 = Date.now();
    const { checks, crash, errors } = await runScenario(browser, s, baseUrl);
    const bad = checks.filter((c) => !c.ok);
    const ok = !crash && !bad.length && !errors.length && checks.length > 0;
    if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${s.name}  (${checks.length} checks, ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    if (!checks.length && !crash) console.log('      the scenario made no checks');
    for (const c of bad) console.log(`      ✗ ${c.name}${c.info ? ` — ${c.info}` : ''}`);
    if (crash) console.log(`      crashed: ${crash.replace(/\n/g, '\n      ')}`);
    for (const e of errors.slice(0, 6)) console.log(`      ${e.replace(/\n/g, '\n      ')}`);
    if (errors.length > 6) console.log(`      … and ${errors.length - 6} more errors`);
    if (process.env.VERBOSE === '1') for (const c of checks.filter((x) => x.ok)) console.log(`      ✓ ${c.name}`);
  }
  await browser.close();
  server.close();
  console.log(failed ? `\n${failed} of ${list.length} scenarios failed` : `\nall ${list.length} scenarios passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
