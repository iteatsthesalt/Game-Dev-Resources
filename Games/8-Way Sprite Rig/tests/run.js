#!/usr/bin/env node
// Opens the built tool in a headless browser and checks that it works.
//   node tests/run.js                 every scenario
//   node tests/run.js export reload   only scenarios whose names contain these words
// Each scenario gets a fresh browser context (empty storage). A scenario fails if a
// check fails, it throws, or the page logs an error.
const path = require('path');
const { chromium } = require('playwright');
const TOOL = path.resolve(process.env.TOOL || path.join(__dirname, '..', 'sprite-rig.html'));
const scenarios = require('./scenarios');

(async () => {
  const want = process.argv.slice(2);
  const list = scenarios.filter((s) => !want.length || want.some((w) => s.name.includes(w)));
  const browser = await chromium.launch();
  let failed = 0;
  for (const s of list) {
    const ctx = await browser.newContext({ viewport: { width: 1300, height: 900 }, reducedMotion: 'reduce', acceptDownloads: true });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(String(e.stack || e.message).split('\n').slice(0, 4).join('\n')));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().split('\n').slice(0, 4).join('\n')); });
    // fonts come from the network; the tool falls back without them
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    const t0 = Date.now();
    let checks = [], crash = null;
    const open = async () => {
      await page.goto('file://' + TOOL);
      await page.waitForFunction(() => window.SpriteRig && window.SpriteRig.state().baked.length > 0, null, { timeout: 15000 });
      await page.addScriptTag({ path: path.join(__dirname, 'helpers.js') });
    };
    try {
      await open();
      checks = await s.run(page, open);
    } catch (e) { crash = String(e.message || e).split('\n').slice(0, 6).join('\n'); }
    const bad = checks.filter((c) => !c.ok);
    const ok = !crash && !bad.length && !errors.length;
    if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${s.name}  (${checks.length} checks, ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    for (const c of bad) console.log(`      ✗ ${c.name}${c.info ? ' — ' + c.info : ''}`);
    if (crash) console.log('      crashed: ' + crash.replace(/\n/g, '\n      '));
    for (const e of errors.slice(0, 5)) console.log('      page error: ' + e.replace(/\n/g, '\n      '));
    await ctx.close();
  }
  await browser.close();
  console.log(failed ? `\n${failed} of ${list.length} scenarios failed` : `\nall ${list.length} scenarios passed`);
  process.exit(failed ? 1 : 0);
})();
