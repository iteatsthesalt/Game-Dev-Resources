import { test, expect } from './helpers/net.js';
import { expectNoSeriousA11y } from './helpers/axe.js';
import { gotoApp } from './helpers/app.js';
const PRIVACY = 'There is no Byways server. Your keys, collections and history are stored only on this device. Network calls go only to the sources and AI providers you turn on.';
test('the app loads at the base path, welcomes, routes and passes axe', async ({ page }) => {
  await page.goto('./');
  await expect(page).toHaveURL('http://localhost:4321/Game-Dev-Resources/byways/');
  await expect(page.getByRole('heading', { level: 1, name: 'Welcome to Byways' })).toBeVisible();
  await expect(page.getByText(PRIVACY, { exact: true })).toBeVisible();
  await expectNoSeriousA11y(page);
  await page.getByRole('button', { name: 'Continue' }).click();
  const nav = page.getByRole('navigation', { name: 'Main' });
  for (const label of ['Stumble', 'Feed', 'Daily Fate', 'Vault', 'Saved', 'Settings']) {
    await nav.getByRole('link', { name: label }).click();
    await expect(page.getByRole('heading', { level: 1, name: label })).toBeVisible();
    await expect(nav.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page');
    await expectNoSeriousA11y(page);
  }
  for (const theme of ['dark', 'high-contrast']) {
    await page.evaluate(t => { document.documentElement.dataset.theme = t; }, theme);
    await expectNoSeriousA11y(page);
  }
  await expect(page.locator('#live-polite')).toHaveAttribute('role', 'status');
  await expect(page.locator('#live-assertive')).toHaveAttribute('aria-live', 'assertive');
});
test('Settings sections, Import, a failed view, the update toast and blocked storage pass axe', async ({ page }) => {
  await gotoApp(page, '#/settings/about');
  await expect(page.getByRole('heading', { level: 2, name: 'About' })).toBeVisible();
  await expect(page.getByText(/^Build /)).toBeVisible();
  for (const name of ['All settings', 'Source code', 'Byways web app'])
    expect((await page.getByRole('link', { name }).boundingBox()).height).toBeGreaterThanOrEqual(56);
  await expectNoSeriousA11y(page);
  await page.getByRole('link', { name: 'All settings' }).click();
  const aboutLink = page.locator('#app .view-body li > a', { hasText: 'About' });
  await expect(aboutLink).toBeVisible(); expect((await aboutLink.boundingBox()).height).toBeGreaterThanOrEqual(56);
  await expectNoSeriousA11y(page);
  await page.goto('./#/import'); await expect(page.getByRole('heading', { level: 1, name: 'Import' })).toBeVisible();
  await expectNoSeriousA11y(page);
  await page.evaluate(async () => {
    const r = await import(new URL('ui/router.js', document.baseURI).href);
    r.registerView('vault', { title: 'Vault', render() { throw new Error('boom'); } }); r.navigate('vault');
  });
  await expect(page.locator('#app')).toContainText('This view failed to load.');
  await page.evaluate(async () => (await import(new URL('ui/toast.js', document.baseURI).href))
    .showToast('Update available, reload', { ms: 0, action: { label: 'Reload', run: () => {} } }));
  await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible();
  await expectNoSeriousA11y(page);
  await page.addInitScript(() => Object.defineProperty(window, 'indexedDB', { get() { throw new DOMException('blocked', 'SecurityError'); } }));
  await page.goto('about:blank'); await gotoApp(page);
  await expect(page.locator('#live-assertive')).toHaveText('Storage is blocked in this browser. Nothing you save will be kept.');
  await expectNoSeriousA11y(page);
});
test('the manifest is served with relative scope', async ({ page }) => {
  const r = await page.request.get('manifest.webmanifest');
  expect(r.headers()['content-type']).toBe('application/manifest+json');
  expect(await r.json()).toMatchObject({ start_url: './', scope: './' });
});
