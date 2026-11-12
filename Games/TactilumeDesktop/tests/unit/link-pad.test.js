// phone/pad.js: the controller page's timing, reconnecting and touch mapping, checked
// without a browser.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readToken, createFrameGate, retryDelay, padPoint, intensityOf, createSlots, REFUSALS } from '../../src/phone/pad.js';
import { REJECT_REASONS } from '../../src/shared/protocol.js';

describe('readToken', () => {
  test('reads k= from the fragment', () => {
    assert.equal(readToken('#k=abcDEF_-123'), 'abcDEF_-123');
    assert.equal(readToken('#x=1&k=tok'), 'tok');
    assert.equal(readToken('#k=tok&x=1'), 'tok');
  });
  test('anything else is no token', () => {
    for (const hash of ['', '#', '#k=', '#kk=abc', '#k=a b', '#k=<script>', '#k=abc/def', `#k=${'x'.repeat(65)}`, null, undefined]) {
      assert.equal(readToken(hash), '', String(hash));
    }
  });
});

describe('createFrameGate', () => {
  // frames from a screen at `hz` for one second, with a little timing noise
  function sendsPerSecond(hz, jitterMs = 0) {
    const take = createFrameGate(120);
    let sent = 0;
    let t = 1000;
    for (let i = 0; i < hz; i++) {
      const noise = jitterMs ? ((i * 7919) % 100) / 100 * jitterMs - jitterMs / 2 : 0;
      if (take(t + noise)) sent++;
      t += 1000 / hz;
    }
    return sent;
  }
  test('a 60 Hz or 120 Hz screen sends every frame, even with jittery frame times', () => {
    assert.equal(sendsPerSecond(60), 60);
    assert.equal(sendsPerSecond(120), 120);
    assert.equal(sendsPerSecond(120, 1.5), 120);
  });
  test('faster screens are held to about 120 a second', () => {
    for (const hz of [144, 165, 240]) {
      const n = sendsPerSecond(hz, 1);
      assert.ok(n >= 118 && n <= 122, `${hz} Hz sent ${n}`);
    }
  });
  test('a long pause does not save up a burst', () => {
    const take = createFrameGate(120);
    assert.equal(take(0), true);
    let burst = 0;
    for (let i = 0; i < 10; i++) if (take(10000 + i * 0.1)) burst++;
    assert.ok(burst <= 2, `${burst} frames went out at once`);
  });
});

describe('retryDelay', () => {
  test('doubles from 0.25 s up to 5 s', () => {
    const top = (n) => retryDelay(n, () => 1);
    assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 30].map(top), [250, 500, 1000, 2000, 4000, 5000, 5000, 5000]);
  });
  test('jitter takes off up to half', () => {
    assert.equal(retryDelay(3, () => 0), 1000);
    for (let i = 0; i < 50; i++) {
      const d = retryDelay(2);
      assert.ok(d >= 500 && d <= 1000, String(d));
    }
  });
});

describe('padPoint', () => {
  const rect = { left: 10, top: 20, width: 200, height: 100 };
  test('0..1 from the pad\'s top left', () => {
    assert.deepEqual(padPoint(10, 20, rect), [0, 0]);
    assert.deepEqual(padPoint(210, 120, rect), [1, 1]);
    assert.deepEqual(padPoint(60, 95, rect), [0.25, 0.75]);
  });
  test('a finger past the edge stays on the edge', () => {
    assert.deepEqual(padPoint(-500, 900, rect), [0, 1]);
  });
  test('a pad with no size does not divide by zero', () => {
    assert.deepEqual(padPoint(5, 5, { left: 0, top: 0, width: 0, height: 0 }), [1, 1]);
  });
});

describe('intensityOf', () => {
  test('a pen reports real pressure', () => {
    assert.equal(intensityOf({ pointerType: 'pen', pressure: 0.8 }), 0.8);
    assert.equal(intensityOf({ pointerType: 'pen', pressure: 0 }), 0.5);
  });
  test('a mouse is a usual touch', () => {
    assert.equal(intensityOf({ pointerType: 'mouse', pressure: 1 }), 0.5);
  });
  test('a touch with real pressure uses it', () => {
    assert.equal(intensityOf({ pointerType: 'touch', pressure: 0.3, width: 40, height: 40 }), 0.3);
    assert.equal(intensityOf({ pointerType: 'touch', pressure: 3 }), 1);
  });
  test('a touch reporting 0 or exactly 0.5 uses the size of the contact', () => {
    assert.equal(intensityOf({ pointerType: 'touch', pressure: 0.5, width: 40, height: 40 }), 0.5);
    assert.equal(intensityOf({ pointerType: 'touch', pressure: 0, width: 20, height: 40 }), 0.25);
    assert.equal(intensityOf({ pointerType: 'touch', pressure: 0.5, width: 80, height: 80 }), 1);
  });
  test('no pressure and no size is a usual touch', () => {
    assert.equal(intensityOf({ pointerType: 'touch', pressure: 0.5, width: 1, height: 1 }), 0.5);
    assert.equal(intensityOf({ pointerType: 'touch' }), 0.5);
  });
});

describe('createSlots', () => {
  test('at most `count` fingers at once, and none past the count', () => {
    const s = createSlots(3);
    const ids = [s.take(), s.take(), s.take()];
    assert.equal(new Set(ids).size, 3);
    assert.equal(s.take(), -1);
    s.give(ids[1]);
    assert.equal(s.size, 2);
    assert.notEqual(s.take(), -1);
    assert.equal(s.take(), -1);
  });

  // A finger that lifts and another that lands before the next frame goes out must not share
  // an id, or the computer sees one finger jump across the pad (no release, no new ring).
  test('a lifted finger\'s id is not handed straight to the next finger', () => {
    const s = createSlots(10);
    const a = s.take();
    s.give(a);
    const b = s.take();
    assert.notEqual(b, a, 'the next finger gets a fresh id');
    // quick taps, one finger at a time: no id comes back within a long run of them
    const seen = [];
    for (let i = 0; i < 200; i++) {
      const id = s.take();
      seen.push(id);
      s.give(id);
    }
    assert.ok(seen.every((id, i) => i === 0 || id !== seen[i - 1]), 'never the id just freed');
    assert.equal(new Set(seen.slice(0, 200)).size, 200, 'two hundred taps, two hundred ids');
  });

  test('ids stay within the protocol\'s 0..255, wrapping round', () => {
    const s = createSlots(2);
    for (let i = 0; i < 600; i++) {
      const id = s.take();
      assert.ok(Number.isInteger(id) && id >= 0 && id <= 255, String(id));
      s.give(id);
    }
  });

  test('a finger still down keeps its id, and the wrap skips it', () => {
    const s = createSlots(10);
    const held = s.take();
    for (let i = 0; i < 300; i++) {
      const id = s.take();
      assert.notEqual(id, held);
      s.give(id);
    }
  });
});

describe('REFUSALS', () => {
  test('every reason the desktop may give has words, and only full and closed retry by themselves', () => {
    for (const why of REJECT_REASONS) {
      assert.ok(REFUSALS[why] && REFUSALS[why].text.length > 20, why);
    }
    assert.deepEqual(Object.keys(REFUSALS).filter((k) => REFUSALS[k].retry).sort(), ['closed', 'full']);
  });

  test('a phone removed from the Phone panel is told so, and does not knock again', () => {
    assert.ok(REJECT_REASONS.includes('removed'));
    assert.match(REFUSALS.removed.text, /removed/i);
    assert.equal(REFUSALS.removed.retry, false);
    assert.equal(REFUSALS.removed.action, 'none');
  });
});
