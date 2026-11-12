#!/usr/bin/env node
// tests/run.js: opens the built page in a headless browser and runs every scenario against it.
//   node tests/run.js                 every scenario of tests/scenarios/*.js
//   node tests/run.js smoke gate      only the scenarios whose names contain one of these words
//   node tests/run.js --verbose       also list every passing check with its info (-v, or VERBOSE=1)
//   GAME=path/to/page.html            test another build. The default is .build/Tollbound.html, which
//                                     "npm run build:dev" writes.
//   TARGET=artifact                   test .build/Tollbound.artifact.html, the fragment the Claude app publishes,
//                                     inside a host page like the app's (hostPage and hostRules below)
//
// A scenario file exports an array of
//   { name, viewport: {width, height}, mobile: bool, query: 'a=1&b=2', run: async function () { ...; return T.done(); } }
// run is sent to the page and runs there: tests/helpers.js gives it T and 99-boot.js gives it TB. It cannot
// use anything from the file around it. Optional fields: timeout (ms for the whole scenario, default 120000)
// and dpr (device pixel ratio, default 1). run may also be an array of such functions: the page is reloaded
// between them and keeps its storage, which is how a scenario sees what survives a reload.
//
// Every scenario gets a fresh browser context, so storage starts empty. It passes only if nothing threw,
// every check passed and the page stayed clean: no uncaught error, no console.error (a "Failed to load
// resource" line aside), no browser dialog and no request for anything but the page itself.
// Where an error names a line of the built page, the line of the source file is added in brackets.
'use strict';
const fs = require('fs'), path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');
const build = require('../tools/build.js');

const ROOT = path.join(__dirname, '..');
const HELPERS = path.join(__dirname, 'helpers.js');
const TARGET = process.env.TARGET || 'standalone';
const GAME = path.resolve(process.env.GAME || path.join(ROOT, '.build', TARGET === 'artifact' ? 'Tollbound.artifact.html' : 'Tollbound.html'));
const HOST = 'https://artifact.tollbound.test/';
const DOCUMENT_TAG = /<!doctype|<\/?(?:html|head|body)\b/i;

// ---- the artifact host ----

// The page the Claude app puts around a published fragment, as far as it matters to the game: the document
// tags the fragment itself must not have, a light default look the page has to override, and a policy that
// lets in only what is written inline, data: and blob: addresses, and Google Fonts.
const POLICY = "default-src 'unsafe-inline' data: blob: https://fonts.googleapis.com https://fonts.gstatic.com";
const hostPage = (fragment) =>
  '<!doctype html><html><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
  `<meta http-equiv="Content-Security-Policy" content="${POLICY}">` +
  '<style>:root{color-scheme:light}body{margin:0;font:14px sans-serif;background:#faf9f5;color:#141413}</style>' +
  '</head><body>\n' + fragment;

// Runs in the hosted page before any of its own code. Storage is an object whose every use throws, as in a
// frame without storage. A dialog or a broken policy becomes a console.error, which fails the scenario.
function hostRules() {
  const refuse = () => { throw new DOMException('This page has no storage.', 'SecurityError'); };
  const dead = new Proxy({}, {
    get: refuse, set: refuse, has: refuse, deleteProperty: refuse, ownKeys: refuse, getOwnPropertyDescriptor: refuse, defineProperty: refuse,
  });
  for (const name of ['localStorage', 'sessionStorage']) Object.defineProperty(window, name, { configurable: true, get: () => dead });
  for (const name of ['alert', 'confirm', 'prompt']) {
    window[name] = () => {
      console.error(`${name}() was called: the published page has no browser dialogs`);
      return name === 'confirm' ? false : null;
    };
  }
  document.addEventListener('securitypolicyviolation', (e) => {
    console.error(`content policy: ${e.violatedDirective} refused ${e.blockedURI || 'inline code'}`);
  });
}

// ---- pointing at the source ----

// The built page is one long file. This finds where each module sits in it, so "Tollbound.html:1234:5" in an
// error can also say "src/js/20-sim.js:56". A module that has changed since the build is simply not found.
function locator(doc, base) {
  const spans = [];
  try {
    let from = 0, line = 1;
    for (const m of build.sources()) {
      const at = doc.indexOf(m.text, from);
      if (at < 0) continue;
      for (let k = doc.indexOf('\n', from); k >= 0 && k < at; k = doc.indexOf('\n', k + 1)) line++;
      spans.push({ file: m.file, first: line, count: m.text.split('\n').length - 1 });
      from = at;
    }
  } catch (e) { /* no source to point at: the page is tested as it is */ }
  const find = (line) => {
    const s = spans.find((x) => line >= x.first && line < x.first + x.count);
    return s ? `${s.file}:${line - s.first + 1}` : '';
  };
  const mark = (text) => String(text).replace(/(?:file|https?):\/\/[^\s)]*?:(\d+):\d+/g, (all, line) => {
    const src = all.startsWith(base) ? find(Number(line)) : '';
    return src ? `${all} [${src}]` : all;
  });
  return { find, mark };
}

// ---- one scenario ----

async function play(browser, s, env) {
  const context = await browser.newContext({
    viewport: s.viewport || { width: 1280, height: 720 }, isMobile: !!s.mobile, hasTouch: !!s.mobile, deviceScaleFactor: s.dpr || 1,
  });
  const checks = [], errors = [];
  const note = (text) => {
    text = env.source.mark(text).split('\n').slice(0, 6).join('\n');
    if (!errors.includes(text)) errors.push(text);
  };
  let stopped = null;
  try {
    if (TARGET === 'artifact') {
      await context.addInitScript(hostRules);
      await context.route('**/*', (route) => (route.request().url().split(/[?#]/)[0] === HOST
        ? route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: env.doc })
        : route.abort()));
    }
    const page = await context.newPage();
    page.on('pageerror', (e) => note(e.stack || e.message || e));
    page.on('crash', () => note('the page crashed'));
    page.on('console', (m) => {
      if (m.type() !== 'error' || /Failed to load resource/.test(m.text())) return;
      const loc = m.location(), src = loc && loc.url && loc.url.startsWith(env.base) ? env.source.find(loc.lineNumber + 1) : '';
      note(m.text() + (src ? ` [${src}]` : ''));
    });
    page.on('dialog', (d) => {
      note(`a browser dialog opened (${d.type()}: ${d.message()})`);
      d.dismiss().catch(() => {});
    });
    page.on('request', (r) => {
      const url = r.url();
      if (/^(?:data|blob|about):/.test(url) || (r.isNavigationRequest() && url.split(/[?#]/)[0] === env.base)) return;
      note(`the page asked for ${url.slice(0, 200)}: the game is one file and loads nothing else`);
    });

    const url = env.base + (s.query ? '?' + String(s.query).replace(/^\?/, '') : '');
    const parts = Array.isArray(s.run) ? s.run : [s.run];
    const steps = (async () => {
      for (let i = 0; i < parts.length; i++) {
        if (i === 0) await page.goto(url); else await page.reload();
        await page.waitForFunction(() => window.TB && window.TB.ready === true, null, { timeout: 15000 })
          .catch(() => { throw new Error('the page was not ready after 15 s (window.TB.ready did not turn true)'); });
        await page.addScriptTag({ path: HELPERS });
        await page.evaluate((target) => { window.T.target = target; }, TARGET);
        const got = await page.evaluate(parts[i]);
        if (!Array.isArray(got)) throw new Error('the scenario did not end with "return T.done();"');
        checks.push(...got);
      }
    })();
    steps.catch(() => {});   // if the time limit wins, closing the context makes this fail later, unheard
    const limit = s.timeout || 120000;
    let timer;
    const late = new Promise((resolve, reject) => { timer = setTimeout(() => reject(new Error(`no result after ${limit / 1000} s`)), limit); });
    try { await Promise.race([steps, late]); } finally { clearTimeout(timer); }
  } catch (e) {
    stopped = env.source.mark(e.message || e).split('\n').slice(0, 8).join('\n');
  }
  await context.close().catch(() => {});
  return { checks, errors, stopped };
}

function report(name, result, seconds, verbose) {
  const bad = result.checks.filter((c) => !c.ok);
  const ok = !result.stopped && !bad.length && !result.errors.length;
  const inset = (text) => text.replace(/\n/g, '\n        ');
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (${result.checks.length} checks, ${seconds.toFixed(1)}s)`);
  for (const c of verbose ? result.checks : bad) console.log(`      ${c.ok ? 'ok' : 'not ok'}: ${c.name}${c.info ? ' (' + inset(c.info) + ')' : ''}`);
  if (result.stopped) console.log('      stopped: ' + inset(result.stopped));
  for (const e of result.errors.slice(0, 8)) console.log('      page: ' + inset(e));
  if (result.errors.length > 8) console.log(`      and ${result.errors.length - 8} more from the page`);
  return ok;
}

function scenarios() {
  const dir = path.join(__dirname, 'scenarios'), list = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js')).sort()) {
    const got = require(path.join(dir, f));
    if (!Array.isArray(got)) throw new Error(`tests/scenarios/${f} must export an array of scenarios`);
    for (const s of got) {
      const runs = s && (Array.isArray(s.run) ? s.run : [s.run]);
      if (!s || typeof s.name !== 'string' || !runs.length || !runs.every((r) => typeof r === 'function')) {
        throw new Error(`tests/scenarios/${f}: every scenario needs a name and a run function`);
      }
      list.push(s);
    }
  }
  return list;
}

async function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose') || args.includes('-v') || !!process.env.VERBOSE;
  const words = args.filter((a) => !a.startsWith('-'));
  if (TARGET !== 'standalone' && TARGET !== 'artifact') throw new Error(`TARGET is "${TARGET}"; it can be standalone or artifact`);
  if (!fs.existsSync(GAME)) throw new Error(`there is no page at ${GAME}. Run: npm run build:dev`);
  const list = scenarios().filter((s) => !words.length || words.some((w) => s.name.includes(w)));
  if (!list.length) throw new Error(words.length ? `no scenario has ${words.join(' or ')} in its name` : 'tests/scenarios holds no scenario');

  const text = fs.readFileSync(GAME, 'utf8');
  const env = { doc: TARGET === 'artifact' ? hostPage(text) : text, base: TARGET === 'artifact' ? HOST : pathToFileURL(GAME).href };
  env.source = locator(env.doc, env.base);
  if (!process.env.GAME) {
    let fresh = null;
    try { fresh = TARGET === 'artifact' ? build.artifact() : build.standalone(); } catch (e) { /* src/ does not build now: test the page as it is */ }
    if (fresh !== null && fresh !== text) console.log(`note: ${path.relative(ROOT, GAME)} is older than src/. Run: npm run build:dev`);
  }

  let failed = 0, count = list.length;
  if (TARGET === 'artifact') {
    const tag = DOCUMENT_TAG.exec(text);
    count++;
    if (tag) failed++;
    console.log(`${tag ? 'FAIL' : 'PASS'}  fragment: no doctype, html, head or body tag`);
    if (tag) console.log(`      "${tag[0]}" at line ${text.slice(0, tag.index).split('\n').length} of ${path.relative(ROOT, GAME)}`);
  }
  // The flag keeps WebGL on a machine without a graphics card, where the browser draws in software.
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
  try {
    for (const s of list) {
      const t0 = Date.now(), result = await play(browser, s, env);
      if (!report(s.name, result, (Date.now() - t0) / 1000, verbose)) failed++;
    }
  } finally {
    await browser.close().catch(() => {});
  }
  console.log(failed ? `\n${failed} of ${count} failed (${TARGET})` : `\nall ${count} passed (${TARGET})`);
  return failed ? 1 : 0;
}

main().then((code) => process.exit(code), (e) => { console.error('tests/run.js: ' + (e.message || e)); process.exit(1); });
