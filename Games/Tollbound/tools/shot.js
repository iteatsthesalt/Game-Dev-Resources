#!/usr/bin/env node
// Saves a picture of the running game, for a person to look at.
//   node tools/shot.js --out .build/shots/name.png [options]
// Options:
//   --query "?view=gl"     added to the page address
//   --size 960x540         the window, in CSS pixels (default 960x540)
//   --mobile               a touch device (as the phone scenarios use)
//   --dpr 2                device pixels to a CSS pixel (default 1)
//   --eval file.js         run this file's code in the page once it has booted; it may return a promise
//   --wait 300             milliseconds to wait before the picture (default 300)
//   --target artifact      the published-page build instead of the standalone one
//   --page file.html       this built page instead of the one in .build/ (a build of your own:
//                          node tools/build.js --out <folder>, then --page <folder>/Tollbound.html)
// It reads the dev build in .build/ unless --page is given, so run "npm run build:dev" first. Exits 1 if the page
// logs an error.
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (!a.startsWith('--')) continue;
  const next = args[i + 1];
  if (next === undefined || next.startsWith('--')) opt[a.slice(2)] = true;
  else { opt[a.slice(2)] = next; i++; }
}
if (!opt.out) { console.error('usage: node tools/shot.js --out file.png [--query q] [--size WxH] [--mobile] [--dpr n] [--eval file.js] [--wait ms] [--target artifact] [--page file.html]'); process.exit(1); }

const root = path.join(__dirname, '..');
const file = typeof opt.page === 'string' ? path.resolve(opt.page)
  : path.join(root, '.build', opt.target === 'artifact' ? 'Tollbound.artifact.html' : 'Tollbound.html');
const [w, h] = String(opt.size || '960x540').split('x').map(Number);

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: w, height: h }, deviceScaleFactor: Number(opt.dpr || 1),
    isMobile: !!opt.mobile, hasTouch: !!opt.mobile,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto('file://' + file + (typeof opt.query === 'string' ? opt.query : ''));
  await page.waitForFunction(() => window.TB && window.TB.ready, null, { timeout: 15000 });
  if (opt.eval) await page.evaluate(fs.readFileSync(path.resolve(opt.eval), 'utf8'));
  await page.waitForTimeout(Number(opt.wait || 300));
  fs.mkdirSync(path.dirname(path.resolve(opt.out)), { recursive: true });
  await page.screenshot({ path: path.resolve(opt.out) });
  await browser.close();
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  console.log('wrote ' + opt.out);
})().catch((e) => { console.error(e); process.exit(1); });
