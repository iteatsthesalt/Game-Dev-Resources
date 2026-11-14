import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, expect } from './helpers/net.js';
import { gotoApp } from './helpers/app.js';
test.use({ serviceWorkers: 'allow' });
const dist = f => fileURLToPath(new URL(`../../dist/pwa/${f}`, import.meta.url));
const swr = dist('data/swr-test.json'); const swFile = dist('sw.js');
test.afterAll(() => rmSync(swr, { force: true }));
async function controlled(page) {
  await gotoApp(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); await page.waitForFunction(() => !!navigator.serviceWorker.controller);
}
test('precaches the shell under byways-<build id>, same-origin only', async ({ page }) => {
  await controlled(page);
  const { id } = await (await page.request.get('build.json')).json();
  expect(await page.evaluate(async name => {
    const c = await caches.open(name); const same = (await c.keys()).every(r => new URL(r.url).origin === location.origin);
    return [await caches.keys(), !!(await c.match('./index.html')), !!(await c.match('./ui/boot.js')), same];
  }, `byways-${id}`)).toEqual([[`byways-${id}`], true, true, true]);
});
// The host's max-age must not let the HTTP cache answer: cache 'reload' sends Cache-Control: no-cache,
// and the data files' 'no-cache' revalidation sends max-age=0.
test('the worker fetches past the HTTP cache', async ({ page, context }) => {
  // [path, Cache-Control] of each finished request the worker made; sw.js itself is the browser's script
  // fetch, which updateViaCache governs, so it is left out.
  const fromWorker = [];
  context.on('requestfinished', async r => {
    const path = new URL(r.url()).pathname;
    if (r.serviceWorker() && !path.endsWith('/sw.js')) fromWorker.push([path, (await r.allHeaders())['cache-control']]);
  });
  const shell = ['/Game-Dev-Resources/byways/index.html', '/Game-Dev-Resources/byways/ui/boot.js'];
  await gotoApp(page); await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => fromWorker.map(([path]) => path)).toEqual(expect.arrayContaining(shell));
  expect(fromWorker.filter(([, cc]) => cc !== 'no-cache')).toEqual([]);
  await page.reload(); await page.waitForFunction(() => !!navigator.serviceWorker.controller); fromWorker.length = 0;
  await page.evaluate(() => fetch('data/tags.json').then(r => r.json()));
  await expect.poll(() => fromWorker.filter(([path]) => path.endsWith('/data/tags.json')).map(([, cc]) => cc)).toContain('max-age=0');
});
test('reloads offline from the cache', async ({ page, context }) => {
  await controlled(page); await context.setOffline(true); await page.reload();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Stumble' })).toBeVisible();
  await context.setOffline(false);
});
test('only the app URL gets the cached shell', async ({ page }) => {
  await controlled(page); await page.goto('build.json');
  expect(await page.evaluate(() => document.contentType)).toBe('application/json');
});
test('data files are stale-while-revalidate', async ({ page }) => {
  writeFileSync(swr, '{"n":1}'); await controlled(page);
  const get = () => page.evaluate(() => fetch('data/swr-test.json').then(r => r.json()));
  expect(await get()).toEqual({ n: 1 });
  await expect.poll(() => page.evaluate(async () => !!(await caches.match('data/swr-test.json')))).toBe(true);
  writeFileSync(swr, '{"n":2}');
  expect(await get()).toEqual({ n: 1 });
  await expect.poll(get).toEqual({ n: 2 });
});
test('a new build shows the update toast and Reload switches to it', async ({ page }) => {
  await controlled(page); const original = readFileSync(swFile, 'utf8');
  try {
    writeFileSync(swFile, original.replace(/const BUILD_ID = "[^"]*";/, 'const BUILD_ID = "next";'));
    await page.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r.update()));
    await expect(page.locator('#toasts')).toContainText('Update available, reload');
    await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Reload' }).click()]);
    expect(await page.evaluate(() => caches.keys())).toEqual(['byways-next']);
  } finally { writeFileSync(swFile, original); }
});
test('Reload still reloads when another tab has already activated the new build', async ({ page }) => {
  await controlled(page); const original = readFileSync(swFile, 'utf8');
  try {
    writeFileSync(swFile, original.replace(/const BUILD_ID = "[^"]*";/, 'const BUILD_ID = "next";'));
    await page.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r.update()));
    await expect(page.locator('#toasts')).toContainText('Update available, reload');
    // What another tab's Reload does: the waiting worker activates and reg.waiting becomes null here.
    await page.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r.waiting.postMessage({ type: 'skip-waiting' })));
    await page.waitForFunction(async () => !(await navigator.serviceWorker.getRegistration()).waiting);
    await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Reload' }).click()]);
    expect(await page.evaluate(() => caches.keys())).toEqual(['byways-next']);
  } finally { writeFileSync(swFile, original); }
});
