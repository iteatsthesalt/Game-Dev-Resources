// renderer/ui/keys.js: the Keys list in Settings names every key the shortcuts answer to.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { KEY_LIST, keyAction } from '../../src/renderer/ui/keys.js';

const press = (key, extra = {}) => keyAction({ key, code: '', ...extra });

describe('the Keys list', () => {
  test('every key in CONTRACTS.md\'s table works, and is listed', () => {
    const listed = KEY_LIST.flatMap(([keys]) => keys.split(/\s{2,}/));
    for (const [key, id] of [['f', 'fullscreen'], ['F11', 'fullscreen'], ['h', 'hide'], ['p', 'phone'], ['s', 'sound'], [' ', 'pulse'], ['b', 'nextBehaviour'], ['n', 'surprise'], ['Escape', 'escape']]) {
      assert.equal(press(key)?.id, id, key);
    }
    for (const name of ['F', 'F11', 'H', 'P', 'S', 'Space', 'B', 'N', 'Esc']) {
      assert.ok(listed.includes(name), `${name} is in the Keys list: ${JSON.stringify(listed)}`);
    }
  });
});
