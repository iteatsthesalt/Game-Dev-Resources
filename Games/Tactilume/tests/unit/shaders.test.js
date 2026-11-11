// Shader rules that the software renderer the browser tests run on cannot catch, because
// it is more forgiving than phone GPUs (a Moto G Stylus showed no light at all because of
// the first two).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src/js/gfx/shaders');
const SOURCES = fs.readdirSync(dir).filter((f) => /\.(glsl|glsl\.js)$/.test(f))
  .map((f) => ({ file: f, code: fs.readFileSync(path.join(dir, f), 'utf8').replace(/\/\/[^\n]*/g, '') }));

// The first argument of every call to `fn`, with nested brackets respected.
function firstArgs(code, fn) {
  const out = [];
  const re = new RegExp(`\\b${fn}\\(`, 'g');
  let m;
  while ((m = re.exec(code))) {
    let depth = 0, i = m.index + m[0].length, start = i;
    for (; i < code.length; i++) {
      const ch = code[i];
      if (ch === '(') depth++;
      else if (ch === ')') { if (depth === 0) break; depth--; }
      else if (ch === ',' && depth === 0) break;
    }
    out.push(code.slice(start, i).trim());
  }
  return out;
}

// Bases checked by hand never to be negative. pow(x, y) is undefined for x < 0 and gives
// NaN on phone GPUs; add a base here only after making sure of that (prefer x * x).
const NON_NEGATIVE_BASES = new Set([
  '0.3 / max(lum, 0.004)',
  'max(tw, 0.0)',
  '(enc + 0.055) / 1.055',
  '0.06 / max(La, 0.0005)',
]);

describe('shader rules', () => {
  test('there are shaders to check', () => {
    assert.ok(SOURCES.length >= 4, SOURCES.map((s) => s.file).join(', '));
  });

  test('no isnan() or isinf(): phone compilers may drop them; use badf() / bad3()', () => {
    for (const { file, code } of SOURCES) {
      assert.ok(!/\bis(nan|inf)\s*\(/.test(code), `${file} uses isnan/isinf`);
    }
  });

  test('every pow() has a base that cannot be negative', () => {
    for (const { file, code } of SOURCES) {
      for (const base of firstArgs(code, 'pow')) {
        assert.ok(NON_NEGATIVE_BASES.has(base), `${file}: pow(${base}, ...) may get a negative base`);
      }
    }
  });

  test('the bit-level NaN test is what the shaders use', () => {
    const all = SOURCES.map((s) => s.code).join('\n');
    assert.match(all, /floatBitsToUint\(x\) & 0x7f800000u\) == 0x7f800000u/);
    for (const name of ['sim.vert.glsl', 'points.vert.glsl', 'post.glsl.js']) {
      const s = SOURCES.find((x) => x.file === name);
      assert.ok(s && /\bbad(f|3)\(/.test(s.code), `${name} does not guard against NaN`);
    }
  });
});
