import { test, expect } from './helpers/net.js';
import { gotoApp } from './helpers/app.js';
import { APP_VERSION } from '../../src/core/version.js';
test('routes between the registered views', async ({ page }) => {
  await gotoApp(page); const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(page.getByRole('heading', { level: 1, name: 'Stumble' })).toBeVisible();
  for (const label of ['Feed', 'Daily Fate', 'Vault', 'Saved', 'Settings']) {
    await nav.getByRole('link', { name: label }).click();
    await expect(page.getByRole('heading', { level: 1, name: label })).toBeVisible();
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page).toHaveTitle(`${label} · Byways`);
    await expect(nav.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page');
  }
  await expect(page.locator('#main')).toBeFocused();
});
test('unknown hashes land on Stumble', async ({ page }) => {
  await gotoApp(page, '#/nope'); await expect(page.getByRole('heading', { level: 1, name: 'Stumble' })).toBeVisible();
});
test('settings list their sections in order and route to them', async ({ page }) => {
  await gotoApp(page, '#/settings');
  await page.evaluate(async () => {
    const s = await import(new URL('ui/views/settings/index.js', document.baseURI).href);
    s.registerSettingsSection({ id: 'test', label: 'Test section', order: 5, render: c => c.append('hello') });
    location.hash = '#/feed'; location.hash = '#/settings';
  });
  await expect(page.locator('#app .view-body a')).toHaveText(['Test section', 'About']);
  await page.getByRole('link', { name: 'Test section' }).click();
  await expect(page).toHaveURL(/#\/settings\/test$/);
  await expect(page.getByRole('heading', { level: 2, name: 'Test section' })).toBeVisible();
  await expect(page.locator('#app')).toContainText('hello');
  await expect(page.getByRole('link', { name: 'All settings' })).toHaveAttribute('href', '#/settings');
});
test('About shows the version, the build and the links', async ({ page }) => {
  const { id } = await (await page.request.get('build.json')).json();
  await gotoApp(page, '#/settings/about');
  await expect(page.getByText(`Version ${APP_VERSION}`, { exact: true })).toBeVisible();
  await expect(page.getByText(`Build ${id}`, { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Source code' })).toHaveAttribute('href', 'https://github.com/iteatsthesalt/Game-Dev-Resources');
  await expect(page.getByRole('link', { name: 'Byways web app' })).toHaveAttribute('href', 'https://iteatsthesalt.github.io/Game-Dev-Resources/byways/');
});
test('a view that throws leaves the shell working', async ({ page }) => {
  await gotoApp(page);
  await page.evaluate(async () => {
    const r = await import(new URL('ui/router.js', document.baseURI).href);
    r.registerView('vault', { title: 'Vault', render() { throw new Error('boom'); } }); r.navigate('vault');
  });
  await expect(page.getByRole('heading', { level: 1, name: 'Vault' })).toBeVisible();
  await expect(page.locator('#app')).toContainText('This view failed to load.');
  await expect(page.locator('#live-assertive')).toHaveText('This view failed to load.');
  await page.getByRole('link', { name: 'Feed' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Feed' })).toBeVisible();
});
test('boots on a memory store when IndexedDB is blocked', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'indexedDB', { get() { throw new DOMException('blocked', 'SecurityError'); } }));
  await gotoApp(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Stumble' })).toBeVisible();
  await expect(page.locator('#live-assertive')).toHaveText('Storage is blocked in this browser. Nothing you save will be kept.');
});
