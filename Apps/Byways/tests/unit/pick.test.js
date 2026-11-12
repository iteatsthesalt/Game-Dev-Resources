import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseBranch, scoreFind, eligible, pickNext } from '../../src/core/pick.js';
import { DEFAULT_TASTE } from '../../src/core/taste.js';
import { makeFind } from '../../src/core/model/find.js';
import { gumbel } from '../../src/core/util/hash.js';

const seq = (...xs) => { let i = 0; return () => xs[i++ % xs.length]; };
const F = (title, tags, extra = {}) => makeFind({ source: 'library', kind: 'site', title, tags, safety: 'curated', url: `https://${title}.example.com/`, ...extra });
const warm = { ...DEFAULT_TASTE, tags: { retro: 2 }, reactions: 5 };
const opts = { seenHas: () => false, recentDomains: [], familyFilter: true };

test('chooseBranch splits 45/22.5/32.5 at s = 0.25', () => {
  assert.equal(chooseBranch(seq(0.449), 0.25), 'momentum');
  assert.equal(chooseBranch(seq(0.451), 0.25), 'taste');
  assert.equal(chooseBranch(seq(0.674), 0.25), 'taste');
  assert.equal(chooseBranch(seq(0.676), 0.25), 'wildcard');
  assert.equal(chooseBranch(seq(0), 1), 'wildcard');
});
test('scoreFind sums tag and source weights plus Gumbel noise', () => {
  const taste = { ...DEFAULT_TASTE, tags: { retro: 2, indie: 1 }, sources: { library: 0.5 } };
  assert.equal(scoreFind(F('a', ['retro', 'indie', 'toy']), taste, () => 0.5), 3.5 + gumbel(() => 0.5));
});
test('eligible applies every always-on filter', () => {
  const t = { ...DEFAULT_TASTE, hiddenTags: ['toy'], blockedDomains: ['b.example.com'] };
  assert.equal(eligible(F('a', []), { ...opts, taste: t }), true);
  assert.equal(eligible(F('a', []), { ...opts, taste: t, seenHas: () => true }), false);
  assert.equal(eligible(F('b', []), { ...opts, taste: t }), false);
  assert.equal(eligible(F('a', []), { ...opts, taste: t, recentDomains: ['a.example.com'] }), false);
  assert.equal(eligible(F('a', ['toy']), { ...opts, taste: t }), false);
  assert.equal(eligible(F('a', [], { safety: 'mixed' }), { ...opts, taste: t }), false);
  assert.equal(eligible(F('a', [], { safety: 'mixed' }), { ...opts, taste: t, familyFilter: false }), true);
});
test('cold start always picks a wildcard', () => {
  const r = pickNext({ ...opts, candidates: [F('a', ['retro'])], current: null, taste: DEFAULT_TASTE, rand: seq(0.1) });
  assert.equal(r.branch, 'wildcard'); assert.equal(r.why, 'wildcard');
});
test('momentum picks a candidate sharing a tag with the current find', () => {
  const r = pickNext({ ...opts, candidates: [F('a', ['puzzle']), F('b', ['retro'])], current: F('cur', ['retro']), taste: warm, rand: seq(0.1, 0.5) });
  assert.equal(r.find.title, 'b'); assert.equal(r.branch, 'momentum'); assert.equal(r.why, 'similar to cur');
});
test('taste picks the best score and says why', () => {
  const r = pickNext({ ...opts, candidates: [F('a', ['puzzle']), F('b', ['retro'])], current: null, taste: warm, rand: seq(0.5) });
  assert.equal(r.find.title, 'b'); assert.equal(r.branch, 'taste'); assert.equal(r.why, 'matches retro +2');
});
test('momentum with no shared tag falls back to taste', () => {
  const r = pickNext({ ...opts, candidates: [F('b', ['retro'])], current: F('cur', ['music']), taste: warm, rand: seq(0.1, 0.5) });
  assert.equal(r.branch, 'taste');
});
test('pickNext returns null when nothing is eligible', () => {
  assert.equal(pickNext({ ...opts, candidates: [F('a', [])], current: null, taste: warm, rand: seq(0.9), seenHas: () => true }), null);
});
