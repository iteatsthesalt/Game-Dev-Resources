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
test('h filters URL props in any letter case and refuses srcdoc and STYLE', async ({ page }) => {
  await page.goto('./');
  expect(await page.evaluate(async () => {
    const { h } = await import(new URL('ui/dom.js', document.baseURI).href);
    const tryMake = props => { try { h('iframe', props); return 'allowed'; } catch (e) { return e.message; } };
    return [h('a', { HREF: 'javascript:alert(1)' }).hasAttribute('href'), h('button', { formAction: 'javascript:alert(1)' }).hasAttribute('formaction'),
      h('img', { SRC: 'data:image/png;base64,AA' }).hasAttribute('src'), h('a', { HREF: 'https://x.org/' }).getAttribute('href'),
      tryMake({ srcdoc: '<b>x</b>' }), tryMake({ srcDoc: '<b>x</b>' }), tryMake({ STYLE: 'color:red' })];
  })).toEqual([false, false, true, 'https://x.org/', 'h: srcdoc parses HTML; build the content with h', 'h: srcdoc parses HTML; build the content with h',
    'h: style is blocked by the CSP; use a class']);
});
test('h gives a link that opens a new tab rel=noopener', async ({ page }) => {
  await page.goto('./');
  expect(await page.evaluate(async () => {
    const { h } = await import(new URL('ui/dom.js', document.baseURI).href);
    const rel = props => h('a', { href: 'https://x.org/', ...props }).getAttribute('rel');
    return [rel({ target: '_blank' }), rel({ target: '_BLANK', rel: 'nofollow' }), rel({ target: '_blank', rel: 'noopener' }), rel({}), rel({ target: '_self' })];
  })).toEqual(['noopener noreferrer', 'nofollow noopener noreferrer', 'noopener', null, null]);
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
  await page.getByRole('button', { name: 'Undo' }).click(); await page.mouse.move(0, 0); // a toast under the pointer waits
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
const openToast = (page, message, opts) => page.evaluate(async ([message, opts]) => {
  const { showToast } = await import(new URL('ui/toast.js', document.baseURI).href);
  const run = ms => () => new Promise((resolve, reject) => setTimeout(() => (opts.fail ? reject(new Error('db down')) : resolve()), ms));
  showToast(message, { ms: opts.ms, undo: opts.undoMs === undefined ? undefined : run(opts.undoMs) });
}, [message, opts]);
test('a timed toast replaces only the timed toast, and a sticky toast only the sticky one', async ({ page }) => {
  await page.goto('./');
  await openToast(page, 'Liked', {}); await openToast(page, 'Pinned', { ms: 0 }); await openToast(page, 'Saved', {});
  await expect(page.locator('#toasts .toast')).toHaveText(['Pinned', 'Saved']);
  await openToast(page, 'Pinned again', { ms: 0 });
  await expect(page.locator('#toasts .toast')).toHaveText(['Saved', 'Pinned again']);
});
test('closing a toast that holds focus returns focus to where it was, or to main', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => { const b = Object.assign(document.createElement('button'), { textContent: 'Opener' }); document.body.append(b); b.focus(); });
  await openToast(page, 'Saved', { undoMs: 0 });
  await page.getByRole('button', { name: 'Undo' }).focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#toasts')).toBeEmpty(); await expect(page.getByRole('button', { name: 'Opener' })).toBeFocused();
  await openToast(page, 'Saved', { undoMs: 0 });
  await page.getByRole('button', { name: 'Undo' }).focus(); await page.getByRole('button', { name: 'Opener' }).evaluate(b => b.remove());
  await page.keyboard.press('Enter');
  await expect(page.locator('#toasts')).toBeEmpty(); await expect(page.locator('#main')).toBeFocused();
});
test('a timed toast waits while it has focus or the pointer, or while Undo runs', async ({ page }) => {
  await page.clock.install(); await page.goto('./');
  const undo = page.getByRole('button', { name: 'Undo' }); const toasts = page.locator('#toasts');
  await openToast(page, 'Saved', { undoMs: 0 }); await undo.focus(); await page.clock.runFor(20000); await expect(undo).toBeVisible();
  await undo.blur(); await page.clock.runFor(5000); await expect(toasts).toBeEmpty();
  await openToast(page, 'Saved', { undoMs: 0 }); await undo.hover(); await page.clock.runFor(20000); await expect(undo).toBeVisible();
  await page.mouse.move(0, 0); await page.clock.runFor(5000); await expect(toasts).toBeEmpty();
  await openToast(page, 'Saved', { undoMs: 8000, fail: true }); await undo.evaluate(b => b.click());
  await page.clock.runFor(7000); await expect(undo).toBeDisabled();
  await page.clock.runFor(1000); await expect(undo).toBeEnabled(); await expect(page.locator('#live-assertive')).not.toBeEmpty();
  await page.clock.runFor(5000); await expect(toasts).toBeEmpty();
});
test('a failed Undo pressed from the keyboard keeps focus on Undo', async ({ page }) => {
  await page.goto('./');
  await openToast(page, 'Saved', { ms: 0, undoMs: 0, fail: true });
  await page.getByRole('button', { name: 'Undo' }).focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#live-assertive')).not.toBeEmpty(); await expect(page.getByRole('button', { name: 'Undo' })).toBeFocused();
});
test('a toast runs Undo once on a double click and survives a failing action', async ({ page }) => {
  await page.clock.install(); await page.goto('./');
  await page.evaluate(async () => { const { showToast } = await import(new URL('ui/toast.js', document.baseURI).href);
    window.__undos = 0;
    showToast('Deleted', { undo: () => new Promise((resolve) => { window.__undos++; setTimeout(resolve, 200); }) }); });
  await page.getByRole('button', { name: 'Undo' }).dblclick();
  await page.clock.runFor(300); await expect(page.locator('#toasts')).toBeEmpty();
  expect(await page.evaluate(() => window.__undos)).toBe(1);
  await page.evaluate(async () => { const { showToast } = await import(new URL('ui/toast.js', document.baseURI).href);
    window.__tries = 0;
    showToast('Deleted', { ms: 0, undo: async () => { window.__tries++; if (window.__tries === 1) throw new Error('db down'); } }); });
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('#live-assertive')).not.toBeEmpty();
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('#toasts')).toBeEmpty();
  expect(await page.evaluate(() => window.__tries)).toBe(2);
});
