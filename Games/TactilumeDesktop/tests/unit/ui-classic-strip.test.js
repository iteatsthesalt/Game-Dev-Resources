// The strip on the classic engine's page: what it tells the player on each system. Its
// behaviour in the page (the button, Dismiss, the first Tab) is in the e2e "app fallback".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { menuHint, stripText } from '../../src/classic/desktop-strip.js';

test('on Windows and Linux it says to press Alt, because the menu bar is hidden', () => {
  for (const platform of ['win32', 'linux']) {
    assert.match(menuHint(platform), /^Graphics > Force WebGPU on This Computer \(press Alt to show the menu\)$/);
  }
});

test('on macOS it points to the menu bar, which is always there', () => {
  assert.equal(menuHint('darwin'), 'Graphics > Force WebGPU on This Computer, in the menu bar');
});

test('it names what the classic engine lacks, and the way back', () => {
  const words = stripText({ platform: 'linux', forced: false });
  assert.match(words, /WebGPU is off/);
  assert.match(words, /phones and gamepads cannot join/);
  assert.match(words, /Sound and Settings panels/);
  assert.match(words, /then restart/);
});

test('when WebGPU is already forced and still failed, it says so instead of offering it again', () => {
  const words = stripText({ platform: 'win32', forced: true });
  assert.match(words, /did not start on this computer even when forced/);
  assert.match(words, /To stop forcing it/);
});
