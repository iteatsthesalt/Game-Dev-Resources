import test from 'node:test';
import assert from 'node:assert/strict';
import { createWebMedia, createWebWakeLock } from '../../src/platform/web-media.js';
import { flush } from './helpers/async.js';

test('setHandlers maps to media session actions and survives unsupported ones', () => {
  const set = {}; const nav = { mediaSession: { setActionHandler(a, f) { if (a === 'previoustrack') throw new TypeError('unsupported'); set[a] = f; } } };
  const next = () => {}; const pp = () => {};
  createWebMedia(nav).setHandlers({ next, previous: () => {}, playPause: pp });
  assert.equal(set.nexttrack, next); assert.equal(set.play, pp); assert.equal(set.pause, pp);
});
test('setActive sets playbackState; no mediaSession is a no-op', () => {
  const nav = { mediaSession: { playbackState: 'none' } }; const m = createWebMedia(nav);
  m.setActive(true); assert.equal(nav.mediaSession.playbackState, 'playing');
  m.setActive(false); assert.equal(nav.mediaSession.playbackState, 'none');
  createWebMedia({}).setActive(true);
});
test('wake lock re-acquires when the page is visible again and stops after off', async () => {
  const held = []; const nav = { wakeLock: { request: async type => {
    const s = { type, released: false, release: async () => { s.released = true; } }; held.push(s); return s; } } };
  const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' }); const wl = createWebWakeLock(nav, doc);
  await wl.on(); assert.equal(held.length, 1);
  held[0].released = true; doc.dispatchEvent(new Event('visibilitychange')); await flush(); assert.equal(held.length, 2);
  await wl.off(); assert.equal(held[1].released, true);
  doc.dispatchEvent(new Event('visibilitychange')); await flush(); assert.equal(held.length, 2);
});
test('a refused or missing wake lock resolves quietly', async () => {
  await createWebWakeLock({ wakeLock: { request: async () => { throw new DOMException('no', 'NotAllowedError'); } } }, new EventTarget()).on();
  await createWebWakeLock({}, new EventTarget()).on();
});
