// renderer/input/hub.js: players, their ids and colours, and the merged, capped pole list.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createHub, PLAYER_COLORS, PLAYER_COLOR_NAMES } from '../../src/renderer/input/hub.js';

// a pole as the inputs make them; `age` says how long ago it went down
const pole = (id, { x = 0, y = 0, age = 0, held = true } = {}) => ({ x, y, vx: 0, vy: 0, power: 1, age, held, id, kind: 'touch', fade: 1 });

describe('players and ids', () => {
  test('each player gets a new id, in order, and an id is never handed out twice', () => {
    const hub = createHub();
    const a = hub.addPlayer({ kind: 'pointer', name: 'Desk', key: 'pointer' });
    const b = hub.addPlayer({ kind: 'gamepad', name: 'Pad 1', key: 'pad0' });
    assert.equal(a.id, 1);
    assert.equal(b.id, 2);
    hub.removePlayer(a.id);
    const c = hub.addPlayer({ kind: 'phone', name: 'Phone', key: 'phone1' });
    assert.equal(c.id, 3, 'a newcomer does not inherit a departed player\'s id');
    assert.deepEqual(hub.players().map((p) => p.id), [2, 3]);
  });

  test('the same key gives back the same player, without announcing a new one', () => {
    const hub = createHub();
    const heard = [];
    hub.on('players', (list) => heard.push(list.length));
    const first = hub.addPlayer({ kind: 'phone', name: 'Ann', key: 'phone1' });
    const again = hub.addPlayer({ kind: 'phone', name: 'Ann', key: 'phone1' });
    assert.equal(again.id, first.id);
    assert.deepEqual(heard, [1]);
    // without a key every call is somebody new
    const x = hub.addPlayer({ kind: 'pointer' });
    const y = hub.addPlayer({ kind: 'pointer' });
    assert.notEqual(x.id, y.id);
  });

  test('a player is { id, kind, name, key, color, colorName }, and changing it changes nothing in the hub', () => {
    const hub = createHub();
    const p = hub.addPlayer({ kind: 'gamepad', name: 'Pad 1', key: 'pad0' });
    assert.deepEqual(Object.keys(p).sort(), ['color', 'colorName', 'id', 'key', 'kind', 'name']);
    assert.deepEqual(p.color, [...PLAYER_COLORS[0]]);
    assert.equal(p.colorName, 'orange');
    p.color[0] = 0;
    p.name = 'changed';
    assert.deepEqual(hub.players()[0].color, [...PLAYER_COLORS[0]]);
    assert.equal(hub.players()[0].name, 'Pad 1');
  });

  test('an unknown kind is a mistake in the caller and throws', () => {
    const hub = createHub();
    assert.throws(() => hub.addPlayer({ kind: 'keyboard' }), TypeError);
    assert.throws(() => hub.addPlayer(), TypeError);
    assert.equal(hub.players().length, 0);
  });

  test('long names are cut short', () => {
    const hub = createHub();
    assert.equal(hub.addPlayer({ kind: 'phone', name: 'x'.repeat(100) }).name.length, 40);
  });

  test('the players event carries the list on every join and leave, and off() stops it', () => {
    const hub = createHub();
    const heard = [];
    const off = hub.on('players', (list) => heard.push(list.map((p) => p.name)));
    const a = hub.addPlayer({ kind: 'pointer', name: 'Desk' });
    hub.addPlayer({ kind: 'phone', name: 'Ann' });
    hub.removePlayer(a.id);
    hub.removePlayer(999); // nobody: no news
    off();
    hub.addPlayer({ kind: 'phone', name: 'Bo' });
    assert.deepEqual(heard, [['Desk'], ['Desk', 'Ann'], ['Ann']]);
  });
});

describe('colours', () => {
  test('the first eight players all get different colours, in the palette\'s order', () => {
    const hub = createHub();
    const colors = Array.from({ length: 8 }, (_, i) => hub.addPlayer({ kind: 'phone', key: `p${i}` }).color.join());
    assert.equal(new Set(colors).size, 8);
    assert.deepEqual(colors, PLAYER_COLORS.map((c) => c.join()));
  });

  test('a colour freed by a leaving player goes to the next newcomer', () => {
    const hub = createHub();
    const players = Array.from({ length: 3 }, (_, i) => hub.addPlayer({ kind: 'phone', key: `p${i}` }));
    hub.removePlayer(players[1].id);
    assert.equal(hub.addPlayer({ kind: 'gamepad', key: 'pad0' }).colorName, PLAYER_COLOR_NAMES[1]);
  });

  test('past eight players the colours repeat evenly', () => {
    const hub = createHub();
    const names = Array.from({ length: 11 }, (_, i) => hub.addPlayer({ kind: 'phone', key: `p${i}` }).colorName);
    assert.deepEqual(names.slice(8), PLAYER_COLOR_NAMES.slice(0, 3));
  });

  test('a player who comes back gets their own colour again while it is free', () => {
    const hub = createHub();
    const a = hub.addPlayer({ kind: 'phone', key: 'phone1' });
    const b = hub.addPlayer({ kind: 'phone', key: 'phone2' });
    hub.removePlayer(a.id);
    hub.removePlayer(b.id);
    assert.equal(hub.addPlayer({ kind: 'phone', key: 'phone2' }).colorName, b.colorName, 'sky blue is free, so phone2 is sky blue again');
    // phone1's orange is taken meanwhile by a newcomer: phone1 gets the next free colour
    hub.addPlayer({ kind: 'gamepad', key: 'pad0' });
    assert.notEqual(hub.addPlayer({ kind: 'phone', key: 'phone1' }).colorName, a.colorName);
  });

  test('the palette is frozen and every colour has a name', () => {
    assert.equal(PLAYER_COLORS.length, 8);
    assert.equal(PLAYER_COLOR_NAMES.length, 8);
    assert.ok(Object.isFrozen(PLAYER_COLORS) && PLAYER_COLORS.every((c) => Object.isFrozen(c) && c.length === 3));
    assert.ok(PLAYER_COLORS.flat().every((v) => v >= 0 && v <= 1));
  });

  // Machado, Oliveira and Fernandes (2009), full severity, applied to linear sRGB; distances
  // in OKLab, where about 0.02 is just noticeable.
  const VISION = {
    typical: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    protanopia: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
    deuteranopia: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.011820, 0.042940, 0.968881],
    tritanopia: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.303900],
  };
  const linear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const unit = (v) => Math.min(1, Math.max(0, v));
  function seenAs(color, m) {
    const [r, g, b] = color.map(linear);
    const [R, G, B] = [m[0] * r + m[1] * g + m[2] * b, m[3] * r + m[4] * g + m[5] * b, m[6] * r + m[7] * g + m[8] * b].map(unit);
    const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
    const mm = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
    const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
    return [0.2104542553 * l + 0.793617785 * mm - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * mm + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * mm - 0.808675766 * s];
  }
  const closest = (colors, m) => {
    const seen = colors.map((c) => seenAs(c, m));
    let min = Infinity;
    for (let i = 0; i < seen.length; i++) for (let j = i + 1; j < seen.length; j++) min = Math.min(min, Math.hypot(...seen[i].map((v, k) => v - seen[j][k])));
    return min;
  };

  for (const [vision, m] of Object.entries(VISION)) {
    test(`with ${vision}, every two colours stay apart, and the first four stay well apart`, () => {
      assert.ok(closest(PLAYER_COLORS, m) >= 0.07, `closest pair ${closest(PLAYER_COLORS, m).toFixed(3)}`);
      assert.ok(closest(PLAYER_COLORS.slice(0, 4), m) >= 0.1, `closest of the first four ${closest(PLAYER_COLORS.slice(0, 4), m).toFixed(3)}`);
    });
  }

  test('every colour is light enough to see as a ring on a black screen', () => {
    for (const c of PLAYER_COLORS) assert.ok(seenAs(c, VISION.typical)[0] >= 0.5, c.join());
  });
});

describe('poles', () => {
  test('every pole is a copy tagged with its player, in join order and then the input\'s order', () => {
    const hub = createHub();
    const a = hub.addPlayer({ kind: 'pointer', key: 'pointer' });
    const b = hub.addPlayer({ kind: 'phone', key: 'phone1' });
    const mine = [pole('t1'), pole('t2')];
    hub.setPoles(b.id, [pole('ph')]);
    hub.setPoles(a.id, mine);
    const out = hub.poles();
    assert.deepEqual(out.map((p) => [p.player, p.id]), [[a.id, 't1'], [a.id, 't2'], [b.id, 'ph']]);
    out[0].x = 99;
    assert.equal(mine[0].x, 0, 'the input\'s own pole is untouched');
  });

  test('poles without a finite place are left out, and setPoles ignores strangers and non-lists', () => {
    const hub = createHub();
    const a = hub.addPlayer({ kind: 'pointer' });
    hub.setPoles(a.id, [pole('ok'), { ...pole('nan'), x: NaN }, null, { ...pole('inf'), y: Infinity }]);
    hub.setPoles(42, [pole('nobody')]);
    assert.deepEqual(hub.poles().map((p) => p.id), ['ok']);
    hub.setPoles(a.id, 'not a list');
    assert.deepEqual(hub.poles(), []);
  });

  test('a removed player\'s poles go with them', () => {
    const hub = createHub();
    const a = hub.addPlayer({ kind: 'phone' });
    hub.setPoles(a.id, [pole('x')]);
    hub.removePlayer(a.id);
    assert.deepEqual(hub.poles(), []);
  });

  test('the total never passes maxPoles', () => {
    const hub = createHub({ maxPoles: 64 });
    for (let k = 0; k < 5; k++) {
      const p = hub.addPlayer({ kind: 'phone', key: `p${k}` });
      hub.setPoles(p.id, Array.from({ length: 20 }, (_, i) => pole(`${k}.${i}`, { age: i })));
    }
    assert.equal(hub.poles().length, 64);
  });

  test('a crowd of poles from one player cannot silence another: each keeps at least one', () => {
    const hub = createHub({ maxPoles: 8 });
    const crowd = hub.addPlayer({ kind: 'phone', key: 'crowd' });
    const quiet = hub.addPlayer({ kind: 'gamepad', key: 'quiet' });
    // the quiet player's only pole is the oldest of all
    hub.setPoles(crowd.id, Array.from({ length: 30 }, (_, i) => pole(`c${i}`, { age: i * 0.01 })));
    hub.setPoles(quiet.id, [pole('q', { age: 100 })]);
    const out = hub.poles();
    assert.equal(out.length, 8);
    assert.ok(out.some((p) => p.player === quiet.id));
    // the rest of the room goes to the crowd's newest poles
    assert.deepEqual(out.filter((p) => p.player === crowd.id).map((p) => p.id), ['c0', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6']);
  });

  test('held poles are kept before lifted ones that are fading out, even newer ones', () => {
    const hub = createHub({ maxPoles: 3 });
    const a = hub.addPlayer({ kind: 'pointer' });
    hub.setPoles(a.id, [
      pole('held-long', { age: 10 }),
      pole('fading-new', { age: 0.1, held: false }),
      pole('held-new', { age: 0.2 }),
      pole('held-mid', { age: 3 }),
    ]);
    assert.deepEqual(hub.poles().map((p) => p.id), ['held-long', 'held-new', 'held-mid']);
  });

  test('a player whose poles are all fading still keeps one, the newest', () => {
    const hub = createHub({ maxPoles: 2 });
    const a = hub.addPlayer({ kind: 'phone', key: 'a' });
    const b = hub.addPlayer({ kind: 'phone', key: 'b' });
    hub.setPoles(a.id, [pole('a1'), pole('a2'), pole('a3')]);
    hub.setPoles(b.id, [pole('b-old', { age: 2, held: false }), pole('b-new', { age: 1, held: false })]);
    assert.deepEqual(hub.poles().map((p) => p.id), ['a1', 'b-new']);
  });

  test('with more players than room, the players with the newest poles are drawn, in join order', () => {
    const hub = createHub({ maxPoles: 2 });
    const ages = [5, 1, 3, 0.5];
    const ids = ages.map((age, i) => {
      const p = hub.addPlayer({ kind: 'phone', key: `p${i}` });
      hub.setPoles(p.id, [pole(`p${i}`, { age })]);
      return p.id;
    });
    assert.deepEqual(hub.poles().map((p) => p.player), [ids[1], ids[3]]);
  });

  test('the choice is the same every frame for the same poles, so nothing flickers', () => {
    const hub = createHub({ maxPoles: 4 });
    const a = hub.addPlayer({ kind: 'phone', key: 'a' });
    hub.setPoles(a.id, Array.from({ length: 10 }, (_, i) => pole(`t${i}`, { age: 1 })));
    const first = hub.poles().map((p) => p.id);
    for (let i = 0; i < 5; i++) assert.deepEqual(hub.poles().map((p) => p.id), first);
    assert.deepEqual(first, ['t0', 't1', 't2', 't3'], 'ties go to the earlier pole');
  });

  test('a bad maxPoles falls back to 64', () => {
    const hub = createHub({ maxPoles: 0 });
    const a = hub.addPlayer({ kind: 'phone' });
    hub.setPoles(a.id, Array.from({ length: 70 }, (_, i) => pole(`t${i}`)));
    assert.equal(hub.poles().length, 64);
  });
});
