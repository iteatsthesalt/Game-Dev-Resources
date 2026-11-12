#!/usr/bin/env node
// Plays the built app in headless Chromium and checks that it works.
//   node tests/run.js                every scenario
//   node tests/run.js touch share    only scenarios whose names contain these words
//   GAME=/path/build.html node tests/run.js    test another build
//   SKIP_ENGINE=1 node tests/run.js  skip the scenarios marked needsEngine
// Each scenario gets a fresh browser context (empty storage, network off). It fails if a
// check fails, it throws or times out, or a page logs an error.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import scenarios from './scenarios.js';
import { createHelpers } from './helpers.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const GAME = path.resolve(process.env.GAME || path.join(here, '..', 'Tactilume.html'));
const SKIP_ENGINE = process.env.SKIP_ENGINE === '1';
const DEFAULT_QUERY = '?test=1&particles=24000';
const SCENARIO_TIMEOUT_MS = 120000;

function contextOptionsFor(s) {
  return {
    viewport: s.viewport || { width: 900, height: 600 },
    deviceScaleFactor: s.dpr || 1,
    isMobile: !!s.mobile,
    hasTouch: !!(s.mobile || s.touch),
  };
}

const firstLines = (text, n = 6) => String(text).split('\n').slice(0, n).join('\n');

function withTimeout(promise, ms, what) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${what} took longer than ${ms / 1000} s`)), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function runScenario(browser, s) {
  const contextOptions = contextOptionsFor(s);
  const errors = [];
  const context = await browser.newContext(contextOptions);
  const h = createHelpers({ browser, appUrl: pathToFileURL(GAME).href, query: s.query ?? DEFAULT_QUERY, errors, contextOptions });
  let checks = [], crash = null;
  try {
    await h.watch(context);
    const page = await context.newPage();
    // `open: false` scenarios set the page up and open the app themselves
    if (s.open !== false) h.bootMs = await h.open(page);
    checks = await withTimeout(s.run(page, context, h), s.timeout || SCENARIO_TIMEOUT_MS, 'the scenario');
    if (!Array.isArray(checks)) throw new Error('the scenario did not return a list of checks');
  } catch (e) {
    crash = firstLines(e && e.stack ? e.stack : e);
    // report the checks made before it stopped, and say where that was
    checks = h.log.slice();
    if (checks.length) crash += `\n(after the check "${checks[checks.length - 1].name}")`;
  }
  await h.dispose();
  await context.close().catch(() => {});
  return { checks, crash, errors };
}

async function main() {
  if (!fs.existsSync(GAME)) {
    console.error(`No app to test at ${GAME}. Build it first: npm run build`);
    process.exit(1);
  }
  const want = process.argv.slice(2);
  const list = scenarios.filter((s) => !want.length || want.some((w) => s.name.includes(w)));
  if (!list.length) {
    console.error(`No scenario matches ${want.join(' ')}. Scenarios: ${scenarios.map((s) => s.name).join(', ')}`);
    process.exit(1);
  }
  const shown = path.relative(process.cwd(), GAME);
  console.log(`Testing ${shown.startsWith('..') ? GAME : shown}${SKIP_ENGINE ? ' (skipping scenarios that need the engine)' : ''}\n`);

  // software WebGL is enough here; newer Chromium wants it allowed explicitly
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
  let failed = 0, skipped = 0;
  for (const s of list) {
    if (s.needsEngine && SKIP_ENGINE) {
      skipped++;
      console.log(`SKIP  ${s.name}  (needs the light engine)`);
      continue;
    }
    const t0 = Date.now();
    const { checks, crash, errors } = await runScenario(browser, s);
    const bad = checks.filter((c) => !c.ok);
    const ok = !crash && !bad.length && !errors.length;
    if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${s.name}  (${checks.length} checks, ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    for (const c of bad) console.log(`      ✗ ${c.name}${c.info ? ' — ' + c.info : ''}`);
    if (crash) console.log('      crashed: ' + crash.replace(/\n/g, '\n      '));
    for (const e of errors.slice(0, 6)) console.log('      ' + e.replace(/\n/g, '\n      '));
    if (errors.length > 6) console.log(`      … and ${errors.length - 6} more errors`);
    if (process.env.VERBOSE === '1') for (const c of checks.filter((x) => x.ok)) console.log(`      ✓ ${c.name}`);
  }
  await browser.close();
  const ran = list.length - skipped;
  const tail = skipped ? `, ${skipped} skipped` : '';
  console.log(failed ? `\n${failed} of ${ran} scenarios failed${tail}` : `\nall ${ran} scenarios passed${tail}`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
