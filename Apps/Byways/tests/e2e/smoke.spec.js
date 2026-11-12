import { test, expect } from './helpers/net.js';
import { expectNoSeriousA11y } from './helpers/axe.js';
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
test('the manifest is served with relative scope', async ({ page }) => {
  const r = await page.request.get('manifest.webmanifest');
  expect(r.headers()['content-type']).toBe('application/manifest+json');
  expect(await r.json()).toMatchObject({ start_url: './', scope: './' });
});
