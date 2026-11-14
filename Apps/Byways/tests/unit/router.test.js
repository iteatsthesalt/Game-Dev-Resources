import test from 'node:test';
import assert from 'node:assert/strict';
import { ROUTES, registerView, getView, parseHash, buildHash, startRouter, navigate } from '../../src/ui/router.js';
import { flush } from './helpers/async.js';

const fakeWin = (hash, dialogs = []) => Object.assign(new EventTarget(), { location: { hash }, history: { backs: 0, back() { this.backs++; } },
  document: { querySelectorAll: s => (s === 'dialog[open]' ? dialogs.filter(d => d.open) : []) } });

test('parseHash reads the hash forms', () => {
  for (const h of ['', '#', '#/']) assert.deepEqual(parseHash(h), { route: 'stumble', params: {} });
  assert.deepEqual(parseHash('#/feed'), { route: 'feed', params: {} });
  assert.deepEqual(parseHash('#/FEED'), { route: 'feed', params: {} });
  assert.deepEqual(parseHash('#/daily/2026-11-11'), { route: 'daily', params: { id: '2026-11-11' } });
  assert.deepEqual(parseHash('#/settings/a%20b'), { route: 'settings', params: { id: 'a b' } });
  assert.deepEqual(parseHash('#s=abc-_'), { route: 'import', params: { payload: 'abc-_' } });
  assert.deepEqual(parseHash('#/nope'), { route: 'stumble', params: {} });
});
test('parseHash never throws on malformed input', () => {
  for (const h of ['#/daily/%E0%A4%A', '#%', '#/%', '#s=', '#s=%%%', '#/__proto__', '#/constructor/x', null, undefined, '#/' + 'x'.repeat(100000)]) {
    const r = parseHash(h); assert.ok(ROUTES.includes(r.route), String(h).slice(0, 20));
  }
  assert.deepEqual(parseHash('#/daily/%E0%A4%A'), { route: 'daily', params: {} });
  assert.deepEqual(parseHash('#s='), { route: 'stumble', params: {} });
});
test('buildHash writes the hash forms', () => {
  assert.equal(buildHash('stumble'), '#/stumble');
  assert.equal(buildHash('daily', { id: '2026-11-11' }), '#/daily/2026-11-11');
  assert.equal(buildHash('settings', { id: 'a b' }), '#/settings/a%20b');
  assert.equal(buildHash('import', { payload: 'xyz' }), '#s=xyz');
  assert.throws(() => buildHash('nope'), /unknown route: nope/);
});
test('registerView replaces an earlier view and refuses unknown routes', () => {
  const a = { title: 'A', render() {} }, b = { title: 'B', render() {} };
  registerView('vault', a); registerView('vault', b); assert.equal(getView('vault'), b);
  assert.throws(() => registerView('nope', a), /unknown route: nope/); assert.equal(getView('nope'), undefined);
});
test('startRouter renders now and on hashchange; navigate re-renders an unchanged hash', () => {
  const win = fakeWin('#/feed'); const seen = []; startRouter((route, params) => seen.push([route, params]), win);
  win.location.hash = '#/daily/2026-11-11'; win.dispatchEvent(new Event('hashchange'));
  navigate('daily', { id: '2026-11-11' }); navigate('vault');
  assert.deepEqual(seen, [['feed', {}], ['daily', { id: '2026-11-11' }], ['daily', { id: '2026-11-11' }]]);
  assert.equal(win.location.hash, '#/vault');
});
test('byways:back goes back unless a listener cancels it or the view is home', async () => {
  const win = fakeWin('#/feed'); startRouter(() => {}, win);
  const back = () => win.dispatchEvent(new CustomEvent('byways:back', { cancelable: true }));
  back(); await flush(); assert.equal(win.history.backs, 1);
  const cancel = e => e.preventDefault(); win.addEventListener('byways:back', cancel);
  back(); await flush(); assert.equal(win.history.backs, 1);
  win.removeEventListener('byways:back', cancel); win.location.hash = '#/stumble';
  back(); await flush(); assert.equal(win.history.backs, 1);
});
test('byways:back first closes the topmost open dialog, at once and even at home', async () => {
  const dialogs = [true, false, true].map(open => ({ open, close() { this.open = false; } }));
  const win = fakeWin('#/stumble', dialogs); startRouter(() => {}, win);
  const back = () => { const e = new CustomEvent('byways:back', { cancelable: true }); win.dispatchEvent(e); return e.defaultPrevented; };
  assert.equal(back(), true); assert.deepEqual(dialogs.map(d => d.open), [true, false, false]);
  win.location.hash = '#/feed';
  assert.equal(back(), true); assert.deepEqual(dialogs.map(d => d.open), [false, false, false]);
  await flush(); assert.equal(win.history.backs, 0);
  assert.equal(back(), false); await flush(); assert.equal(win.history.backs, 1);
});
