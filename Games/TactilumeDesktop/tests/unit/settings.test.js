// The app's settings file (src/main/settings.js): its defaults, what it accepts, the atomic
// write, and how it recovers from a damaged file. Each test works in its own temporary
// folder; disk faults are made by wrapping Node's fs.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createSettings, cleanSettings, cleanBounds, DEFAULT_SETTINGS } from '../../src/main/settings.js';

function tempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tl-settings-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const leftovers = (dir) => fs.readdirSync(dir).filter((n) => n.endsWith('.tmp'));
const fsError = (code, message = code) => Object.assign(new Error(message), { code });

// Node's fs with some calls replaced; `calls` records the names of the calls made, in order.
function wrapFs(overrides = {}) {
  const calls = [];
  const wrapped = {};
  for (const name of ['readFileSync', 'readdirSync', 'unlinkSync', 'renameSync', 'mkdirSync', 'openSync', 'writeFileSync', 'fsyncSync', 'closeSync']) {
    wrapped[name] = (...args) => {
      calls.push(name);
      return (overrides[name] || fs[name])(...args);
    };
  }
  return { fs: wrapped, calls };
}

describe('defaults', () => {
  test('a first start, with no file, gives the defaults from CONTRACTS.md', (t) => {
    const file = path.join(tempDir(t), 'settings.json');
    const s = createSettings(file);
    assert.deepEqual(s.get(), { linkPort: 47615, allowNewPhones: true, forceWebGPU: false, fullscreen: false, bounds: null });
    assert.deepEqual(s.get(), { ...DEFAULT_SETTINGS });
    assert.equal(s.path, file);
  });

  test('reading the settings never creates the file', (t) => {
    const file = path.join(tempDir(t), 'settings.json');
    createSettings(file).get();
    assert.equal(fs.existsSync(file), false);
  });

  test('the folder is made on the first save if it is missing', (t) => {
    const file = path.join(tempDir(t), 'deep', 'er', 'settings.json');
    createSettings(file).set({ fullscreen: true });
    assert.equal(read(file).fullscreen, true);
  });

  test('DEFAULT_SETTINGS cannot be changed by accident', () => {
    assert.ok(Object.isFrozen(DEFAULT_SETTINGS));
  });
});

describe('what set() accepts', () => {
  test('valid values are kept and saved', (t) => {
    const file = path.join(tempDir(t), 'settings.json');
    const s = createSettings(file);
    const bounds = { x: -1280, y: 40, width: 1280, height: 720 };
    const after = s.set({ linkPort: 50000, allowNewPhones: false, forceWebGPU: true, fullscreen: true, bounds });
    assert.deepEqual(after, { linkPort: 50000, allowNewPhones: false, forceWebGPU: true, fullscreen: true, bounds });
    assert.deepEqual(read(file), after);
  });

  test('wrong types, out-of-range numbers and unknown keys are ignored, and the old values stay', (t) => {
    const s = createSettings(path.join(tempDir(t), 'settings.json'));
    s.set({ linkPort: 50000, fullscreen: true });
    const after = s.set({
      linkPort: 80,               // needs administrator rights
      allowNewPhones: 'no',       // not a boolean
      forceWebGPU: 1,
      fullscreen: null,
      bounds: { x: 0, y: 0, width: 10, height: 10 }, // smaller than the window can be
      theme: 'dark',              // not a setting
      __proto__: { forceWebGPU: true },
    });
    assert.deepEqual(after, { ...DEFAULT_SETTINGS, linkPort: 50000, fullscreen: true });
    assert.equal('theme' in after, false);
  });

  test('anything that is not an object changes nothing', (t) => {
    const s = createSettings(path.join(tempDir(t), 'settings.json'));
    for (const bad of [null, undefined, 42, 'fullscreen', [true], true]) assert.deepEqual(s.set(bad), { ...DEFAULT_SETTINGS });
  });

  test('bounds: null forgets them; a broken rectangle keeps the old one', (t) => {
    const s = createSettings(path.join(tempDir(t), 'settings.json'));
    const bounds = { x: 10, y: 20, width: 800, height: 600 };
    s.set({ bounds });
    assert.deepEqual(s.set({ bounds: { x: 1.5, y: 0, width: 800, height: 600 } }).bounds, bounds);
    assert.deepEqual(s.set({ bounds: 'big' }).bounds, bounds);
    assert.equal(s.set({ bounds: null }).bounds, null);
  });

  test('get() and set() hand out copies, so changing them changes nothing', (t) => {
    const s = createSettings(path.join(tempDir(t), 'settings.json'));
    s.set({ bounds: { x: 0, y: 0, width: 800, height: 600 } });
    const a = s.get();
    a.fullscreen = true;
    a.bounds.width = 5;
    const b = s.set({});
    b.linkPort = 1;
    assert.deepEqual(s.get(), { ...DEFAULT_SETTINGS, bounds: { x: 0, y: 0, width: 800, height: 600 } });
  });

  test('a change that changes nothing does not write the file', (t) => {
    const file = path.join(tempDir(t), 'settings.json');
    const { fs: spy, calls } = wrapFs();
    const s = createSettings(file, { fs: spy });
    s.set({ fullscreen: true });
    const writes = () => calls.filter((c) => c === 'renameSync').length;
    assert.equal(writes(), 1);
    s.set({ fullscreen: true });
    s.set({ linkPort: 'x' });
    assert.equal(writes(), 1);
  });

  test('the settings come back on the next start', (t) => {
    const file = path.join(tempDir(t), 'settings.json');
    createSettings(file).set({ forceWebGPU: true, bounds: { x: 5, y: 6, width: 900, height: 700, maximized: true } });
    assert.deepEqual(createSettings(file).get(), { ...DEFAULT_SETTINGS, forceWebGPU: true, bounds: { x: 5, y: 6, width: 900, height: 700, maximized: true } });
  });
});

describe('cleanBounds and cleanSettings', () => {
  test('a rectangle needs whole numbers and at least the smallest window size', () => {
    assert.deepEqual(cleanBounds({ x: -3000, y: -200, width: 480, height: 320 }), { x: -3000, y: -200, width: 480, height: 320 });
    assert.equal(cleanBounds({ x: 0, y: 0, width: 479, height: 600 }), null);
    assert.equal(cleanBounds({ x: 0, y: 0, width: 800, height: 319 }), null);
    assert.equal(cleanBounds({ x: 0, y: Number.NaN, width: 800, height: 600 }), null);
    assert.equal(cleanBounds({ x: 0, y: 0, width: '800', height: 600 }), null);
    assert.equal(cleanBounds([0, 0, 800, 600]), null);
    assert.equal(cleanBounds(null), null);
  });

  test('only maximized: true is kept beside the rectangle', () => {
    assert.deepEqual(cleanBounds({ x: 0, y: 0, width: 800, height: 600, maximized: true, extra: 1 }), { x: 0, y: 0, width: 800, height: 600, maximized: true });
    assert.deepEqual(cleanBounds({ x: 0, y: 0, width: 800, height: 600, maximized: 'yes' }), { x: 0, y: 0, width: 800, height: 600 });
  });

  test('cleanSettings never returns the object it was given', () => {
    const base = { ...DEFAULT_SETTINGS, bounds: { x: 0, y: 0, width: 800, height: 600 } };
    const out = cleanSettings({}, base);
    assert.notEqual(out, base);
    assert.notEqual(out.bounds, base.bounds);
  });
});

describe('the atomic write', () => {
  test('a save goes to a temporary file in the same folder, flushed, then renamed over the settings file', (t) => {
    const dir = tempDir(t);
    const file = path.join(dir, 'settings.json');
    let renamed = null;
    const { fs: spy, calls } = wrapFs({
      renameSync(from, to) {
        renamed = { from, to };
        return fs.renameSync(from, to);
      },
    });
    createSettings(file, { fs: spy }).set({ fullscreen: true });
    assert.equal(path.dirname(renamed.from), dir, 'a rename only replaces a file atomically on the same disk');
    assert.match(path.basename(renamed.from), /^settings\.json\..+\.tmp$/);
    assert.equal(renamed.to, file);
    const order = ['openSync', 'writeFileSync', 'fsyncSync', 'closeSync', 'renameSync'];
    assert.deepEqual(calls.filter((c) => order.includes(c)), order, 'the data is flushed to disk before the rename');
    assert.deepEqual(leftovers(dir), []);
    assert.equal(read(file).fullscreen, true);
  });

  test('a write that fails halfway leaves the old file whole, and no temporary file', (t) => {
    const dir = tempDir(t);
    const file = path.join(dir, 'settings.json');
    createSettings(file).set({ linkPort: 50000 });
    const before = fs.readFileSync(file, 'utf8');
    const logs = [];
    const { fs: faulty } = wrapFs({
      // the disk fills up after the first few bytes of the new settings
      writeFileSync(fd, data) {
        if (typeof fd === 'number') {
          fs.writeSync(fd, String(data).slice(0, 7));
          throw fsError('ENOSPC', 'no space left on device');
        }
        return fs.writeFileSync(fd, data);
      },
    });
    const s = createSettings(file, { fs: faulty, log: (line) => logs.push(line) });
    const after = s.set({ forceWebGPU: true });
    assert.equal(fs.readFileSync(file, 'utf8'), before, 'the settings file is untouched');
    assert.deepEqual(leftovers(dir), []);
    assert.equal(after.forceWebGPU, true, 'the change still applies while the app runs');
    assert.equal(logs.length, 1);
    assert.match(logs[0], /could not be saved.*no space/);
  });

  test('a rename refused by a busy file is tried again', (t) => {
    const dir = tempDir(t);
    const file = path.join(dir, 'settings.json');
    let refusals = 2;
    const { fs: busy } = wrapFs({
      renameSync(from, to) {
        if (refusals-- > 0) throw fsError('EPERM', 'operation not permitted');
        return fs.renameSync(from, to);
      },
    });
    createSettings(file, { fs: busy }).set({ fullscreen: true });
    assert.equal(read(file).fullscreen, true);
    assert.deepEqual(leftovers(dir), []);
  });

  test('a rename that keeps failing gives up, keeps the old file and cleans up', (t) => {
    const dir = tempDir(t);
    const file = path.join(dir, 'settings.json');
    createSettings(file).set({ linkPort: 50000 });
    let tries = 0;
    const logs = [];
    const { fs: stuck } = wrapFs({
      renameSync() {
        tries++;
        throw fsError('EBUSY', 'resource busy or locked');
      },
    });
    createSettings(file, { fs: stuck, log: (line) => logs.push(line) }).set({ fullscreen: true });
    assert.equal(tries, 5);
    assert.equal(read(file).fullscreen, false);
    assert.equal(read(file).linkPort, 50000);
    assert.deepEqual(leftovers(dir), []);
    assert.equal(logs.length, 1);
  });

  test('a rename that fails for another reason is not tried again', (t) => {
    const file = path.join(tempDir(t), 'settings.json');
    let tries = 0;
    const { fs: cross } = wrapFs({
      renameSync() {
        tries++;
        throw fsError('EXDEV', 'cross-device link not permitted');
      },
    });
    createSettings(file, { fs: cross }).set({ fullscreen: true });
    assert.equal(tries, 1);
  });

  test('a read-only disk loses the save, but set() still works and does not throw', (t) => {
    const file = path.join(tempDir(t), 'settings.json');
    const { fs: readOnly } = wrapFs({
      openSync() { throw fsError('EROFS', 'read-only file system'); },
    });
    const s = createSettings(file, { fs: readOnly });
    assert.equal(s.set({ fullscreen: true }).fullscreen, true);
    assert.equal(s.get().fullscreen, true);
    assert.equal(fs.existsSync(file), false);
  });

  test('temporary files left by a run that stopped mid-write are removed at the next start', (t) => {
    const dir = tempDir(t);
    const file = path.join(dir, 'settings.json');
    fs.writeFileSync(path.join(dir, 'settings.json.4242.1.tmp'), '{"linkPo');
    fs.writeFileSync(path.join(dir, 'other.json.1.tmp'), 'not ours');
    fs.writeFileSync(path.join(dir, 'settings.json.corrupt'), 'kept');
    createSettings(file);
    assert.deepEqual(fs.readdirSync(dir).sort(), ['other.json.1.tmp', 'settings.json.corrupt']);
  });
});

describe('recovering from a damaged file', () => {
  for (const [what, text] of [
    ['broken JSON', '{"linkPort": 50000, "fullscreen": tr'],
    ['an empty file (a power cut before the data reached the disk)', ''],
    ['JSON that is not an object', '[true, false]'],
    ['JSON null', 'null'],
  ]) {
    test(`${what}: the defaults are used and the file is kept aside, not lost`, (t) => {
      const dir = tempDir(t);
      const file = path.join(dir, 'settings.json');
      fs.writeFileSync(file, text);
      const logs = [];
      const s = createSettings(file, { log: (line) => logs.push(line) });
      assert.deepEqual(s.get(), { ...DEFAULT_SETTINGS });
      assert.equal(fs.readFileSync(`${file}.corrupt`, 'utf8'), text, 'what was in the file is kept');
      assert.equal(fs.existsSync(file), false);
      assert.equal(logs.length, 1);
      assert.match(logs[0], /settings\.json\.corrupt/);

      // and the next change writes a good file again
      s.set({ allowNewPhones: false });
      assert.equal(read(file).allowNewPhones, false);
      assert.equal(createSettings(file).get().allowNewPhones, false);
    });
  }

  test('a readable file with some bad values keeps the good ones and is not set aside', (t) => {
    const dir = tempDir(t);
    const file = path.join(dir, 'settings.json');
    fs.writeFileSync(file, JSON.stringify({ linkPort: 99999, allowNewPhones: false, forceWebGPU: 'yes', fullscreen: true, bounds: { x: 0 }, extra: [1, 2] }));
    const s = createSettings(file);
    assert.deepEqual(s.get(), { ...DEFAULT_SETTINGS, allowNewPhones: false, fullscreen: true });
    assert.equal(fs.existsSync(`${file}.corrupt`), false);
  });

  test('an older damaged copy is replaced by the newest one', (t) => {
    const dir = tempDir(t);
    const file = path.join(dir, 'settings.json');
    fs.writeFileSync(`${file}.corrupt`, 'old');
    fs.writeFileSync(file, 'new and broken');
    createSettings(file);
    assert.equal(fs.readFileSync(`${file}.corrupt`, 'utf8'), 'new and broken');
  });

  test('a file that cannot be opened (not just missing) is logged, and the defaults are used', (t) => {
    const file = path.join(tempDir(t), 'settings.json');
    const logs = [];
    const { fs: locked } = wrapFs({
      readFileSync() { throw fsError('EACCES', 'permission denied'); },
    });
    assert.deepEqual(createSettings(file, { fs: locked, log: (line) => logs.push(line) }).get(), { ...DEFAULT_SETTINGS });
    assert.equal(logs.length, 1);
    assert.match(logs[0], /could not be opened/);
  });

  test('a missing file on the first start is not an error', (t) => {
    const logs = [];
    createSettings(path.join(tempDir(t), 'settings.json'), { log: (line) => logs.push(line) });
    assert.deepEqual(logs, []);
  });
});
