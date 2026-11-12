// The WGSL rules from CONTRACTS.md, checked in every .wgsl file under src/. GPU drivers
// differ in what they do with NaN, negative pow bases and division by zero, and the
// software GPU the browser tests use is more forgiving than most, so these are checked on
// the source instead:
//   1. No NaN checks a compiler may drop: no isnan()/isinf()-style calls and no x != x.
//      Test the float's bits instead: (bitcast<u32>(x) & 0x7f800000u) == 0x7f800000u
//   2. pow() only on a base that can never be negative.
//   3. Every division (/, /=, % and %=) guarded against zero.
//
// The checker accepts what it can see is safe: a literal or const, max(x, 1e-4),
// clamp(x, 0.5, 2.0), abs(x), length(v), dot(v, v), vectors of those, and so on. Anything
// else needs its reason in a comment on the same line:
//   let k = a / b; // nonzero: b is a count, at least 1
//   let s = pow(t, 2.2); // non-negative: t is a colour channel, 0..1
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src');

// ---- reading WGSL -------------------------------------------------------------------------

// Comments become spaces (lines keep their numbers); the comment text of each line is kept
// apart, for the reasons. Block comments nest in WGSL.
function splitComments(src) {
  let code = '';
  const notes = [''];
  let depth = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '\n') { code += '\n'; notes.push(''); continue; }
    if (depth === 0 && c === '/' && src[i + 1] === '/') {
      const end = src.indexOf('\n', i) < 0 ? src.length : src.indexOf('\n', i);
      notes[notes.length - 1] += src.slice(i + 2, end);
      code += ' '.repeat(end - i);
      i = end - 1;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') { depth++; code += '  '; i++; continue; }
    if (depth > 0 && c === '*' && src[i + 1] === '/') { depth--; code += '  '; i++; continue; }
    if (depth > 0) { notes[notes.length - 1] += c; code += ' '; continue; }
    code += c;
  }
  return { code, notes };
}

// index just past the bracket that closes the one at `i`
function closeOf(code, i) {
  const open = code[i], close = open === '(' ? ')' : ']';
  let depth = 0;
  for (let j = i; j < code.length; j++) {
    if (code[j] === open) depth++;
    else if (code[j] === close && --depth === 0) return j + 1;
  }
  return code.length;
}

function splitArgs(text) {
  const out = [];
  let depth = 0, start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (c === ',' && depth === 0) { out.push(text.slice(start, i).trim()); start = i + 1; }
  }
  const last = text.slice(start).trim();
  if (last) out.push(last);
  return out;
}

const NUMBER = /^(?:0[xX][0-9a-fA-F]+[iu]?|(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?[fhiu]?)/;

// The operand that starts at `i`: signs, then a literal, a name (maybe a call, maybe with a
// template like vec3<f32>) or a bracketed group, then any .member or [index].
function operandAt(code, i) {
  while (/\s/.test(code[i])) i++;
  const start = i;
  while ('-+!~'.includes(code[i]) && i < code.length) { i++; while (/\s/.test(code[i])) i++; }
  if (code[i] === '(') {
    i = closeOf(code, i);
  } else {
    const m = NUMBER.exec(code.slice(i)) || /^[A-Za-z_]\w*/.exec(code.slice(i));
    if (!m) return code.slice(start, i).trim();
    i += m[0].length;
    if (code[i] === '<' && /^[A-Za-z_]/.test(m[0])) {
      const close = code.indexOf('>', i);
      if (close > 0 && code[close + 1] === '(') i = close + 1;
    }
    if (code[i] === '(') i = closeOf(code, i);
  }
  for (;;) {
    if (code[i] === '.' && /[A-Za-z_]/.test(code[i + 1] || '')) { i++; while (/\w/.test(code[i])) i++; }
    else if (code[i] === '[') i = closeOf(code, i);
    else break;
  }
  return code.slice(start, i).trim();
}

function stripParens(e) {
  let s = e.trim();
  while (s.startsWith('(') && closeOf(s, 0) === s.length) s = s.slice(1, -1).trim();
  return s;
}

// name(args) when `e` is exactly one call, else null
function asCall(e) {
  const m = /^([A-Za-z_]\w*(?:<[\w\s,]+>)?)\s*\(/.exec(e);
  if (!m) return null;
  const open = m[0].length - 1;
  if (closeOf(e, open) !== e.length) return null;
  return { name: m[1].replace(/<.*/, ''), args: splitArgs(e.slice(open + 1, -1)) };
}

function literalValue(e) {
  const m = /^([+-]?)\s*(0[xX][0-9a-fA-F]+|(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?)[fhiu]?$/.exec(e);
  if (!m) return null;
  const v = m[2].startsWith('0x') || m[2].startsWith('0X') ? parseInt(m[2], 16) : Number(m[2]);
  return m[1] === '-' ? -v : v;
}

// `const NAME = <literal>;` (with or without a type) anywhere in the file
function constsOf(code) {
  const out = new Map();
  for (const m of code.matchAll(/\bconst\s+([A-Za-z_]\w*)\s*(?::\s*[\w<>]+\s*)?=\s*([^;]+);/g)) {
    const v = literalValue(stripParens(m[2]));
    if (v !== null) out.set(m[1], v);
  }
  return out;
}

function constValue(e, consts) {
  const s = stripParens(e);
  const lit = literalValue(s);
  if (lit !== null) return lit;
  const neg = /^-\s*([A-Za-z_]\w*)$/.exec(s);
  if (neg && consts.has(neg[1])) return -consts.get(neg[1]);
  return consts.has(s) ? consts.get(s) : null;
}

const isVector = (name) => /^vec[234][fhiu]?$/.test(name);
const NON_NEGATIVE_CALLS = new Set(['abs', 'length', 'distance', 'exp', 'exp2', 'sqrt', 'inverseSqrt', 'saturate', 'fract', 'smoothstep']);

// Can `e` be shown, from the code alone, never to be negative / to be above zero / not to be zero?
function nonNegative(e, consts) {
  const s = stripParens(e);
  const v = constValue(s, consts);
  if (v !== null) return v >= 0;
  const call = asCall(s);
  if (!call) return false;
  if (NON_NEGATIVE_CALLS.has(call.name)) return true;
  if (isVector(call.name)) return call.args.length > 0 && call.args.every((a) => nonNegative(a, consts));
  if (call.name === 'max') return call.args.some((a) => nonNegative(a, consts));
  if (call.name === 'min') return call.args.every((a) => nonNegative(a, consts));
  if (call.name === 'clamp') return call.args.length === 3 && nonNegative(call.args[1], consts);
  if (call.name === 'dot') return call.args.length === 2 && call.args[0] === call.args[1];
  return false;
}

function positive(e, consts) {
  const s = stripParens(e);
  const v = constValue(s, consts);
  if (v !== null) return v > 0;
  const call = asCall(s);
  if (!call) return false;
  if (isVector(call.name)) return call.args.length > 0 && call.args.every((a) => positive(a, consts));
  if (call.name === 'max') return call.args.some((a) => positive(a, consts));
  if (call.name === 'min') return call.args.every((a) => positive(a, consts));
  if (call.name === 'clamp') return call.args.length === 3 && positive(call.args[1], consts);
  return false;
}

function nonzero(e, consts) {
  const s = stripParens(e);
  const v = constValue(s, consts);
  if (v !== null) return v !== 0;
  if (s.startsWith('-')) return nonzero(s.slice(1), consts);
  const call = asCall(s);
  if (call && isVector(call.name)) return call.args.length > 0 && call.args.every((a) => nonzero(a, consts));
  return positive(s, consts);
}

// ---- the rules ------------------------------------------------------------------------------

// → [{ line, rule, text }] for one WGSL source
export function checkWgsl(src) {
  const { code, notes } = splitComments(src);
  const lines = src.split('\n');
  const consts = constsOf(code);
  const lineOf = (i) => code.slice(0, i).split('\n').length;
  const found = [];
  const report = (i, rule, why) => {
    const line = lineOf(i);
    found.push({ line, rule, text: `${why}: ${lines[line - 1].trim()}` });
  };
  const noted = (i, word) => new RegExp(`\\b${word}:\\s*\\S`).test(notes[lineOf(i) - 1]);

  for (const m of code.matchAll(/\bis(nan|inf|normal)\s*\(/gi)) report(m.index, 'nan', `${m[0].slice(0, -1).trim()}() may be compiled away; test the float's bits instead`);
  for (const m of code.matchAll(/(?<![\w.])([A-Za-z_][\w.]*(?:\[[^\]]*\])?)\s*(!=|==)\s*\1(?![\w.[])/g)) {
    report(m.index, 'nan', `${m[0].trim()} is a NaN test a compiler may drop; test the float's bits instead`);
  }

  for (const m of code.matchAll(/\bpow\s*\(/g)) {
    const base = splitArgs(code.slice(m.index + m[0].length, closeOf(code, m.index + m[0].length - 1) - 1))[0] || '';
    if (!nonNegative(base, consts) && !noted(m.index, 'non-negative')) {
      report(m.index, 'pow', `pow(${base}, …) may get a negative base (add "// non-negative: <why>" if it cannot)`);
    }
  }

  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (c !== '/' && c !== '%') continue;
    const compound = code[i + 1] === '=';
    let divisor;
    if (compound) {
      const end = code.indexOf(';', i);
      divisor = code.slice(i + 2, end < 0 ? code.length : end).trim();
    } else {
      divisor = operandAt(code, i + 1);
    }
    if (!nonzero(divisor, consts) && !noted(i, 'nonzero')) {
      report(i, 'division', `${c}${compound ? '=' : ''} ${divisor} may divide by zero (guard it, or add "// nonzero: <why>")`);
    }
  }
  return found.sort((a, b) => a.line - b.line);
}

// ---- the checker itself ------------------------------------------------------------------

const rulesIn = (src) => checkWgsl(src).map((f) => f.rule);

describe('the WGSL checker', () => {
  test('divisions by literals, consts and guarded expressions pass', () => {
    const src = [
      'const SCALE = 4.0;',
      'const NEG: f32 = -2.0;',
      'fn f(a: f32, b: f32, v: vec3f, i: u32) -> f32 {',
      '  let x = a / 2.0 + a / SCALE + a / NEG + a / -3.0 + a / 1e-3;',
      '  let y = a / max(b, 1e-4) + a / max(0.5, b) + a / clamp(b, 0.25, 4.0);',
      '  let z = v / vec3f(2.0, 4.0, 8.0) + v / max(v, vec3f(0.001));',
      '  let w = (a / (2.0)) + f32(i % 2u) + a / (max((b), 1.0));',
      '  return x + y + z.x + w;',
      '}',
    ].join('\n');
    assert.deepEqual(checkWgsl(src), []);
  });

  test('an unguarded division is caught, in every form', () => {
    assert.deepEqual(rulesIn('let a = b / c;'), ['division']);
    assert.deepEqual(rulesIn('let a = b / c.x * 2.0;'), ['division']);
    assert.deepEqual(rulesIn('let a = b / (c + 1.0);'), ['division']);
    assert.deepEqual(rulesIn('let a = b / max(c, 0.0);'), ['division']);
    assert.deepEqual(rulesIn('let a = b / clamp(c, 0.0, 1.0);'), ['division']);
    assert.deepEqual(rulesIn('let a = v / vec2f(2.0, 0.0);'), ['division']);
    assert.deepEqual(rulesIn('let a = b / 0.0;'), ['division']);
    assert.deepEqual(rulesIn('x /= y;'), ['division']);
    assert.deepEqual(rulesIn('let k = i % n;'), ['division']);
    assert.deepEqual(rulesIn('k %= n;'), ['division']);
    assert.deepEqual(rulesIn('let a = b / lights[k].power;'), ['division']);
  });

  test('a reason on the same line, and only that, lets a division through', () => {
    assert.deepEqual(rulesIn('let a = b / c; // nonzero: c is a count, at least 1'), []);
    assert.deepEqual(rulesIn('let a = b / c; /* nonzero: c >= 1 */'), []);
    assert.deepEqual(rulesIn('// nonzero: c >= 1\nlet a = b / c;'), ['division']);
    assert.deepEqual(rulesIn('let a = b / c; // non-negative: c >= 0'), ['division']);
    assert.deepEqual(rulesIn('let a = b / c; // nonzero:'), ['division']);
  });

  test('comments are not code, and block comments nest', () => {
    assert.deepEqual(rulesIn('// a / b and pow(x, 2.0) and x != x\nlet k = 1.0;'), []);
    assert.deepEqual(rulesIn('/* a / b /* nested pow(x, 2.0) */ still a comment x != x */ let k = 1.0;'), []);
  });

  test('pow needs a base that cannot be negative', () => {
    assert.deepEqual(rulesIn('let a = pow(x, 2.0);'), ['pow']);
    assert.deepEqual(rulesIn('let a = pow(-2.0, x);'), ['pow']);
    assert.deepEqual(rulesIn('let a = pow(x - 1.0, 2.0);'), ['pow']);
    assert.deepEqual(rulesIn('let a = pow(max(x, y), 2.0);'), ['pow']);
    const fine = [
      'pow(2.0, x)', 'pow(max(x, 0.0), 2.2)', 'pow(abs(x), 3.0)', 'pow(saturate(c), vec3f(2.2))',
      'pow(clamp(t, 0.0, 1.0), 0.5)', 'pow(dot(d, d), 0.5)', 'pow((length(v)), 2.0)', 'pow(vec3f(0.5, 1.0, 2.0), e)',
    ];
    for (const f of fine) assert.deepEqual(rulesIn(`let a = ${f};`), [], f);
    assert.deepEqual(rulesIn('let a = pow(t, 2.2); // non-negative: t is a colour channel, 0..1'), []);
    assert.deepEqual(rulesIn('let a = pow(t, 2.2); // nonzero: wrong reason'), ['pow']);
  });

  test('NaN checks a compiler may drop are caught; the bit test is not', () => {
    assert.deepEqual(rulesIn('if (isNan(x)) { return; }'), ['nan']);
    assert.deepEqual(rulesIn('if (isinf(x)) { return; }'), ['nan']);
    assert.deepEqual(rulesIn('if (x != x) { return; }'), ['nan']);
    assert.deepEqual(rulesIn('let bad = p.pos.x == p.pos.x;'), ['nan']);
    assert.deepEqual(rulesIn('let bad = (bitcast<u32>(x) & 0x7f800000u) == 0x7f800000u;'), []);
    assert.deepEqual(rulesIn('let same = x != y || xs == x;'), []);
  });

  test('problems are reported with their line', () => {
    const [f] = checkWgsl('let a = 1.0;\n\nlet b = a / c;');
    assert.equal(f.line, 3);
    assert.match(f.text, /let b = a \/ c;/);
  });
});

// ---- the shaders ----------------------------------------------------------------------------

const files = fs.readdirSync(SRC, { recursive: true }).filter((f) => f.endsWith('.wgsl')).sort();

describe('every .wgsl file under src/', () => {
  test('there are shaders to check', () => {
    assert.ok(files.length > 0, 'no .wgsl files found under src/');
  });
  for (const file of files) {
    test(file, () => {
      const found = checkWgsl(fs.readFileSync(path.join(SRC, file), 'utf8'));
      assert.deepEqual(found.map((f) => `line ${f.line}, ${f.rule}: ${f.text}`), []);
    });
  }
});
