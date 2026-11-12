// Shader rules that the software renderer the browser tests run on cannot catch, because
// it is more forgiving than phone GPUs (a Moto G Stylus showed no light at all because of
// the first two).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as POST from '../../src/js/gfx/shaders/post.glsl.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src/js/gfx/shaders');
const stripComments = (code) => code.replace(/\/\/[^\n]*/g, '');
const SOURCES = fs.readdirSync(dir).filter((f) => /\.(glsl|glsl\.js)$/.test(f))
  .map((f) => ({ file: f, code: stripComments(fs.readFileSync(path.join(dir, f), 'utf8')) }));

// Every fragment shader exactly as the GPU compiles it: post.glsl.js exports finished
// sources (its shared snippets pasted in, so they count too), the .frag.glsl files are whole.
const FRAGMENT_SHADERS = [
  ...Object.entries(POST).filter(([name]) => name.endsWith('_FS')).map(([name, code]) => ({ name: `post.glsl.js ${name}`, code: stripComments(code) })),
  ...SOURCES.filter((s) => s.file.endsWith('.frag.glsl')).map((s) => ({ name: s.file, code: s.code })),
];
const USES_UNSIGNED = /\buint\b|\buvec[234]\b|\busampler|floatBitsToUint|uintBitsToFloat/;

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

  // A fragment shader's ints and uints default to mediump, which only promises 16 bits
  // (GLSL ES 3.00 4.5.3); phone compilers do narrow them. The brightness state is kept as
  // the bits of 32-bit floats, so a narrowed output keeps 1e-41 of it: no light at all.
  test('every fragment shader that uses unsigned ints or float bits declares precision highp int', () => {
    assert.ok(FRAGMENT_SHADERS.length >= 6, FRAGMENT_SHADERS.map((s) => s.name).join(', '));
    for (const { name, code } of FRAGMENT_SHADERS) {
      if (!USES_UNSIGNED.test(code)) continue;
      assert.match(code, /^\s*precision\s+highp\s+int\s*;/m, `${name} uses unsigned ints or float bits without precision highp int`);
    }
  });

  test('the brightness state is written through a highp output', () => {
    assert.match(stripComments(POST.ADAPT_FS), /\bout\s+highp\s+uvec4\s+o\s*;/);
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
