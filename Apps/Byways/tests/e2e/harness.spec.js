import { test as base, expect } from '@playwright/test';
import { mockNet, unmocked, pageProblems } from './helpers/net.js';
import { installFakeSpeech } from './helpers/fakes.js';
import { expectNoSeriousA11y } from './helpers/axe.js';
base('mockNet serves fixtures, aborts the rest and lists them', async ({ page }) => {
  await mockNet(page); await page.goto('./');
  expect(await page.evaluate(() => fetch('https://example.test/ping').then(r => r.json()))).toEqual({ pong: true });
  expect(await page.evaluate(() => fetch('https://unmatched.test/x').then(() => 'ok', () => 'failed'))).toBe('failed');
  expect(unmocked(page)).toEqual(['https://unmatched.test/x']);
});
base('overrides win over routes.js', async ({ page }) => {
  await mockNet(page); await mockNet(page, { overrides: [{ match: /example\.test\/ping/, json: { pong: 'override' } }] });
  await page.goto('./');
  expect(await page.evaluate(() => fetch('https://example.test/ping').then(r => r.json()))).toEqual({ pong: 'override' });
});
base('mockNet lets a request that sends a key through CORS', async ({ page }) => {
  await mockNet(page); await page.goto('./');
  expect(await page.evaluate(() => fetch('https://example.test/ping', { headers: { Authorization: 'Bearer x' } }).then(r => r.json()))).toEqual({ pong: true });
});
base('pageProblems catches CSP violations', async ({ page }) => {
  await mockNet(page); await page.goto('./');
  await page.evaluate(() => document.body.setAttribute('style', 'color: red'));
  await expect.poll(() => pageProblems(page).join('\n')).toMatch(/Content Security Policy/);
});
base('pageProblems lists console errors and page errors unless ignored', async ({ page }) => {
  await mockNet(page); await page.goto('./');
  await page.evaluate(() => { console.error('boom'); setTimeout(() => { throw new Error('bang'); }); });
  await expect.poll(() => pageProblems(page)).toEqual(['console: boom', 'pageerror: bang']);
  expect(pageProblems(page, { ignore: [/boom/, /bang/] })).toEqual([]);
});
base('pageProblems gives the source URL, so an ignore pattern can name a file', async ({ page }) => {
  await mockNet(page); await page.goto('./');
  expect(await page.evaluate(() => fetch('no-such-file.json').then(r => r.status))).toBe(404);
  await expect.poll(() => pageProblems(page)).toEqual([
    expect.stringMatching(/^console: Failed to load resource: .+ \(http:\/\/localhost:4321\/Game-Dev-Resources\/byways\/no-such-file\.json\)$/)]);
  expect(pageProblems(page, { ignore: [/no-such-file\.json/] })).toEqual([]);
});
base('installFakeSpeech drives recognition, records speech and fakes the wake lock', async ({ page }) => {
  await mockNet(page); await installFakeSpeech(page); await page.goto('./');
  expect(await page.evaluate(() => new Promise(res => {
    const r = new webkitSpeechRecognition(); r.onresult = e => res([e.results[0][0].transcript, e.results[0].isFinal, e.resultIndex]);
    r.start(); window.__say('next please');
  }))).toEqual(['next please', true, 0]);
  expect(await page.evaluate(() => new Promise(res => {
    const u = new SpeechSynthesisUtterance('Hello'); u.onend = () => res(window.__spoken); speechSynthesis.speak(u);
  }))).toEqual(['Hello']);
  expect(await page.evaluate(async () => {
    const s = await navigator.wakeLock.request('screen'); const held = { ...window.__wake }; await s.release();
    return [held, { ...window.__wake }, s.released];
  })).toEqual([{ requests: 1, releases: 0 }, { requests: 1, releases: 1 }, true]);
});
base('expectNoSeriousA11y passes the bare shell and catches an unnamed button', async ({ page }) => {
  await mockNet(page); await page.goto('./'); await expectNoSeriousA11y(page);
  await page.evaluate(() => document.body.append(document.createElement('button')));
  await expect(expectNoSeriousA11y(page)).rejects.toThrow(/button-name/);
});
