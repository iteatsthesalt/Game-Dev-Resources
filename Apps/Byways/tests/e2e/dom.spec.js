import { test, expect } from './helpers/net.js';

test('h sets text, attributes and handlers without parsing HTML', async ({ page }) => {
  await page.goto('./');
  expect(await page.evaluate(async () => {
    const { h } = await import(new URL('ui/dom.js', document.baseURI).href); let clicks = 0;
    const el = h('button', { class: 'big', text: '<b>hi</b>', 'aria-label': 'Say hi', 'data-id': '7', type: 'button', onClick: () => clicks++ });
    el.click(); const div = h('div', null, 'a', h('span', { text: 'b' }), null, false, ['c', 'd']);
    return [el.className, el.textContent, el.children.length, el.getAttribute('aria-label'), el.dataset.id, clicks, div.textContent, div.childNodes.length];
  })).toEqual(['big', '<b>hi</b>', 0, 'Say hi', '7', 1, 'abcd', 4]);
});
test('h writes aria-* and data-* booleans as text and toggles other boolean attributes', async ({ page }) => {
  await page.goto('./');
  expect(await page.evaluate(async () => {
    const { h } = await import(new URL('ui/dom.js', document.baseURI).href);
    const b = h('button', { 'aria-pressed': false, 'aria-expanded': true, 'data-on': false, disabled: true, hidden: false });
    return [b.getAttribute('aria-pressed'), b.getAttribute('aria-expanded'), b.getAttribute('data-on'), b.disabled, b.hasAttribute('hidden')];
  })).toEqual(['false', 'true', 'false', true, false]);
});
test('h drops unsafe link schemes', async ({ page }) => {
  await page.goto('./');
  expect(await page.evaluate(async () => {
    const { h } = await import(new URL('ui/dom.js', document.baseURI).href);
    const bad = ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', ' javascript:alert(1)', 'java\tscript:alert(1)', 'data:text/html,<b>x</b>', 'vbscript:x', 'blob:https://evil.example/x']
      .map(u => h('a', { href: u }).hasAttribute('href'));
    return [...bad, h('a', { href: 'https://x.org/' }).getAttribute('href'), h('a', { href: '#/feed' }).hasAttribute('href'),
      h('a', { href: `blob:${location.origin}/x` }).hasAttribute('href'),
      h('img', { src: 'data:image/png;base64,AA' }).hasAttribute('src'), h('iframe', { src: 'data:text/html,x' }).hasAttribute('src')];
  })).toEqual([false, false, false, false, false, false, false, 'https://x.org/', true, true, true, false]);
});
test('h refuses a style prop', async ({ page }) => {
  await page.goto('./');
  expect(await page.evaluate(async () => {
    const { h } = await import(new URL('ui/dom.js', document.baseURI).href);
    try { h('div', { style: 'color:red' }); return 'allowed'; } catch (e) { return e.message; }
  })).toBe('h: style is blocked by the CSP; use a class');
});
test('announce writes the polite or the assertive region', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(async () => { const { announce } = await import(new URL('ui/a11y.js', document.baseURI).href);
    announce('Saved'); announce('Microphone blocked', { assertive: true }); });
  await expect(page.locator('#live-polite')).toHaveText('Saved');
  await expect(page.locator('#live-assertive')).toHaveText('Microphone blocked');
});
test('showToast offers Undo for 5 seconds, announces politely and keeps a sticky toast', async ({ page }) => {
  await page.clock.install(); await page.goto('./');
  await page.evaluate(async () => { const { showToast } = await import(new URL('ui/toast.js', document.baseURI).href);
    showToast('Saved', { undo: async () => { window.__undone = true; } }); });
  await expect(page.locator('#toasts')).toContainText('Saved'); await expect(page.locator('#live-polite')).toHaveText('Saved');
  await page.getByRole('button', { name: 'Undo' }).click();
  expect(await page.evaluate(() => window.__undone)).toBe(true); await expect(page.locator('#toasts')).toBeEmpty();
  await page.evaluate(async () => (await import(new URL('ui/toast.js', document.baseURI).href)).showToast('Liked'));
  await page.clock.runFor(5000); await expect(page.locator('#toasts')).toBeEmpty();
  await page.evaluate(async () => (await import(new URL('ui/toast.js', document.baseURI).href)).showToast('Update available, reload', { ms: 0, action: { label: 'Reload', run: () => {} } }));
  await page.clock.runFor(60000); await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible();
  await page.evaluate(async () => (await import(new URL('ui/toast.js', document.baseURI).href)).showToast('Liked'));
  await expect(page.locator('#toasts')).toContainText('Liked'); await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible();
  await page.clock.runFor(5000); await expect(page.locator('#toasts')).not.toContainText('Liked');
  await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible();
});
