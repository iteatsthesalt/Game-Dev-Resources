import { test, expect } from './helpers/net.js';
import { expectNoSeriousA11y } from './helpers/axe.js';
test.beforeEach(async ({ page }) => { await page.goto('./'); });
test('nav links are at least 56 px and show a 3 px focus ring', async ({ page }) => {
  for (const link of await page.getByRole('navigation', { name: 'Main' }).getByRole('link').all())
    expect((await link.boundingBox()).height).toBeGreaterThanOrEqual(56);
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  expect(await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return [s.outlineStyle, s.outlineWidth]; })).toEqual(['solid', '3px']);
});
test('the in-app motion setting overrides the OS preference', async ({ page }) => {
  const duration = m => page.evaluate(m => {
    document.documentElement.dataset.motion = m; const el = document.createElement('div'); el.style.setProperty('transition', 'opacity 1s');
    document.body.append(el); const d = getComputedStyle(el).transitionDuration; el.remove(); return d;
  }, m);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect([await duration('system'), await duration('full'), await duration('reduced')]).toEqual(['0s', '1s', '0s']);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  expect([await duration('system'), await duration('reduced')]).toEqual(['1s', '0s']);
});
test('text scale 2 doubles the root font size', async ({ page }) => {
  expect(await page.evaluate(() => { document.documentElement.style.setProperty('--text-scale', '2'); return getComputedStyle(document.documentElement).fontSize; })).toBe('32px');
});
test('axe passes in the light, dark and high-contrast themes', async ({ page }) => {
  for (const theme of ['light', 'dark', 'high-contrast']) {
    await page.evaluate(t => { document.documentElement.dataset.theme = t; }, theme); await expectNoSeriousA11y(page);
  }
});
test('toPlainText gives the same text with DOMParser', async ({ page }) => {
  expect(await page.evaluate(async () => {
    const { toPlainText } = await import(new URL('core/util/text.js', document.baseURI).href);
    return ['<p>Fish &amp; <b>chips</b></p>', 'a<br>b<p>c</p>', '<p>One.</p><p>Two.</p>', 'un<b>believ</b>able', '<script>alert(1)</script><style>p{}</style>ok'].map(toPlainText);
  })).toEqual(['Fish & chips', 'a b c', 'One. Two.', 'unbelievable', 'ok']);
});
test.describe('with ignoreProblems', () => {
  test.use({ ignoreProblems: [/boom/] });
  test('a matching console error does not fail the test', async ({ page }) => { await page.evaluate(() => console.error('boom')); });
});
