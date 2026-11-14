import { test, expect } from './helpers/net.js';
import { gotoApp } from './helpers/app.js';
const PRIVACY = 'There is no Byways server. Your keys, collections and history are stored only on this device. Network calls go only to the sources and AI providers you turn on.';
test('the first visit shows Welcome with the privacy promise, once', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1, name: 'Welcome to Byways' })).toBeVisible();
  await expect(page.getByText(PRIVACY, { exact: true })).toBeVisible();
  for (const name of ['Continue', 'Skip'])
    expect((await page.getByRole('button', { name }).boundingBox()).height).toBeGreaterThanOrEqual(56);
  await expect(page.getByRole('heading', { level: 1, name: 'Welcome to Byways' })).toBeFocused();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Stumble' })).toBeVisible();
  await expect(page.locator('#main')).toBeFocused();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Stumble' })).toBeVisible();
  await expect(page.locator('[data-firstrun]')).toHaveCount(0);
});
test('steps run in order, Skip moves on, and a broken step is passed over', async ({ page }) => {
  await gotoApp(page);
  const done = page.evaluate(async () => {
    const at = p => import(new URL(p, document.baseURI).href);
    const [f, { EMPTY_DATA }, { DEFAULT_SETTINGS }] = await Promise.all([at('ui/firstrun.js'), at('core/data.js'), at('core/settings.js')]);
    f.registerFirstRunStep({ id: 'b', order: 18, render: (c, app, done) => c.append(Object.assign(document.createElement('button'), { textContent: 'Finish b', onclick: done })) });
    f.registerFirstRunStep({ id: 'late', order: 16, render: async () => { throw new Error('y'); } });
    f.registerFirstRunStep({ id: 'boom', order: 15, render: () => { throw new Error('x'); } });
    f.registerFirstRunStep({ id: 'a', order: 12, render: c => { c.append('Step a'); return new Promise(() => {}); } });
    const settings = structuredClone(DEFAULT_SETTINGS);
    await f.runFirstRun({ settings, data: structuredClone(EMPTY_DATA), getSettings: () => settings,
      saveSettings: async p => { window.__saved = p; return Object.assign(settings, p); } });
    return window.__saved;
  });
  const skip = page.locator('[data-firstrun]').getByRole('button', { name: 'Skip', exact: true });
  await expect(page.locator('[data-firstrun="welcome"]')).toBeVisible(); await skip.click();
  await expect(page.locator('[data-firstrun="a"]')).toContainText('Step a');
  await expect(page.locator('[data-firstrun="a"]')).toBeFocused(); await skip.click();
  await page.getByRole('button', { name: 'Finish b' }).click();
  let settled = false; done.then(() => { settled = true; }, () => { settled = true; });
  while (!settled) await skip.click({ timeout: 2000 }).catch(() => {});
  expect(await done).toEqual({ firstRunDone: true });
});
test('a step heading takes focus, and a failed final save is announced instead of stopping boot', async ({ page }) => {
  await gotoApp(page);
  const done = page.evaluate(async () => {
    const f = await import(new URL('ui/firstrun.js', document.baseURI).href);
    f.registerFirstRunStep({ id: 'h', order: 12, render: c => c.append(Object.assign(document.createElement('h2'), { textContent: 'Pick some interests' })) });
    const settings = { firstRunDone: false };
    return f.runFirstRun({ settings, getSettings: () => settings, saveSettings: async () => { throw new Error('quota'); } });
  });
  const skip = page.locator('[data-firstrun]').getByRole('button', { name: 'Skip', exact: true });
  await expect(page.locator('[data-firstrun="welcome"]')).toBeVisible(); await skip.click();
  await expect(page.getByRole('heading', { level: 2, name: 'Pick some interests' })).toBeFocused(); await skip.click();
  expect(await done).toBe(true);
  await expect(page.locator('#live-assertive')).toHaveText('Byways could not save your choices, so these first steps will show again next time.');
});
