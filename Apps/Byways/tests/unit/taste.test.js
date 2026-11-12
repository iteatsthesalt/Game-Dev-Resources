import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_TASTE, applyReaction, describeChange } from '../../src/core/taste.js';

const find = { source: 'library', tags: ['retro', 'indie'], url: 'https://www.example.com/x' };

test('DEFAULT_TASTE matches the spec', () => assert.deepEqual(DEFAULT_TASTE,
  { v: 1, tags: {}, sources: {}, hiddenTags: [], blockedDomains: [], strangeness: 0.25, interests: [], reactions: 0 }));
test('like adds 1 per tag and 0.5 to the source', () => {
  const { taste, change } = applyReaction(Object.freeze(structuredClone(DEFAULT_TASTE)), find, 'like');
  assert.deepEqual(taste.tags, { retro: 1, indie: 1 }); assert.deepEqual(taste.sources, { library: 0.5 });
  assert.equal(taste.reactions, 1); assert.deepEqual(change.tagDeltas, { retro: 1, indie: 1 }); assert.equal(change.sourceDelta, 0.5);
});
test('save works like like, and weights cap at +3', () => {
  const { taste, change } = applyReaction({ ...DEFAULT_TASTE, tags: { retro: 3 } }, find, 'save');
  assert.equal(taste.tags.retro, 3); assert.equal(change.tagDeltas.retro, 0);
  assert.equal(taste.tags.indie, 1); assert.deepEqual(taste.sources, { library: 0.5 });
});
test('not for me takes 0.5 per tag and 0.25 from the source', () => {
  const { taste } = applyReaction(DEFAULT_TASTE, find, 'dislike');
  assert.deepEqual(taste.tags, { retro: -0.5, indie: -0.5 }); assert.deepEqual(taste.sources, { library: -0.25 });
});
test('a shared link moves the tags but no source weight', () => {
  const shared = { ...find, source: 'shared' }; const { taste, change } = applyReaction(DEFAULT_TASTE, shared, 'like');
  assert.deepEqual(taste.tags, { retro: 1, indie: 1 }); assert.deepEqual(taste.sources, {}); assert.equal(change.sourceDelta, 0);
  assert.deepEqual(applyReaction(DEFAULT_TASTE, shared, 'dislike').taste.sources, {});
});
test('less of this topic takes 2 and hides the tag at -3', () => {
  const once = applyReaction(DEFAULT_TASTE, find, 'lessTopic', { tag: 'retro' }).taste;
  assert.equal(once.tags.retro, -2); assert.deepEqual(once.hiddenTags, []);
  const { taste, change } = applyReaction(once, find, 'lessTopic', { tag: 'retro' });
  assert.equal(taste.tags.retro, -3); assert.deepEqual(taste.hiddenTags, ['retro']); assert.deepEqual(change.hidden, ['retro']);
});
test('never this site blocks the domain', () => {
  const { taste, change } = applyReaction(DEFAULT_TASTE, find, 'neverSite');
  assert.deepEqual(taste.blockedDomains, ['example.com']); assert.deepEqual(change.blocked, ['example.com']);
});
test('an interest adds 2 and does not count as a reaction', () => {
  const { taste } = applyReaction(DEFAULT_TASTE, null, 'interest', { tag: 'space' });
  assert.equal(taste.tags.space, 2); assert.deepEqual(taste.interests, ['space']); assert.equal(taste.reactions, 0);
});
test('broken can block the domain and is not a reaction', () => {
  const { taste } = applyReaction(DEFAULT_TASTE, find, 'broken', { blockDomain: true });
  assert.deepEqual(taste.blockedDomains, ['example.com']); assert.equal(taste.reactions, 0);
});
test('describeChange words each change', () => {
  const c = (o) => ({ tagDeltas: {}, sourceDelta: 0, hidden: [], blocked: [], ...o });
  assert.equal(describeChange(c({ tagDeltas: { retro: 1, indie: 1 } })), 'More retro and indie from now on.');
  assert.equal(describeChange(c({ tagDeltas: { art: 1, music: 1, toy: 1 } })), 'More art, music and toy from now on.');
  assert.equal(describeChange(c({ tagDeltas: { retro: -0.5 } })), 'Less retro from now on.');
  assert.equal(describeChange(c({ hidden: ['art-game'] })), 'Art game is hidden now.');
  assert.equal(describeChange(c({ blocked: ['example.com'] })), "You won't see example.com again.");
  assert.equal(describeChange(c({ sourceDelta: 0.5 })), 'More like this from now on.');
  assert.equal(describeChange(c({})), 'Noted.');
});
test('describeChange uses the tag labels', () => {
  const c = (o) => ({ tagDeltas: {}, sourceDelta: 0, hidden: [], blocked: [], ...o });
  const labelOf = (id) => ({ oldweb: 'Old web', ai: 'AI', retro: 'Retro' })[id];
  assert.equal(describeChange(c({ tagDeltas: { oldweb: 1, ai: 1, retro: 1 } }), labelOf), 'More old web, AI and retro from now on.');
  assert.equal(describeChange(c({ hidden: ['oldweb'] }), labelOf), 'Old web is hidden now.');
});
test('repeated dislikes floor a tag at -3 without hiding it', () => {
  let taste = DEFAULT_TASTE;
  for (let i = 0; i < 8; i += 1) taste = applyReaction(taste, find, 'dislike').taste;
  assert.equal(taste.tags.retro, -3); assert.deepEqual(taste.hiddenTags, []);
  assert.deepEqual(applyReaction(taste, find, 'dislike').change.hidden, []);
});
test('weights clamp at -3 on the way down', () => {
  const { taste, change } = applyReaction({ ...DEFAULT_TASTE, tags: { retro: -2.75 } }, find, 'dislike');
  assert.equal(taste.tags.retro, -3); assert.equal(change.tagDeltas.retro, -0.25);
});
test('less of this topic defaults to the first tag of the find', () => {
  const { taste, change } = applyReaction(DEFAULT_TASTE, find, 'lessTopic');
  assert.deepEqual(taste.tags, { retro: -2 }); assert.deepEqual(change.tagDeltas, { retro: -2 }); assert.equal(taste.reactions, 1);
});
test('less of this topic with no tag to resolve changes nothing', () => {
  const none = { tagDeltas: {}, sourceDelta: 0, hidden: [], blocked: [] };
  for (const f of [null, { source: 'library', url: 'https://example.com/x' }]) {
    const { taste, change } = applyReaction(DEFAULT_TASTE, f, 'lessTopic');
    assert.deepEqual(taste, DEFAULT_TASTE); assert.deepEqual(change, none);
  }
});
test('an interest with no tag changes nothing', () => {
  const { taste, change } = applyReaction(DEFAULT_TASTE, null, 'interest');
  assert.deepEqual(taste, DEFAULT_TASTE); assert.equal(taste.reactions, 0);
  assert.deepEqual(change, { tagDeltas: {}, sourceDelta: 0, hidden: [], blocked: [] });
});
test('a taste that is not frozen is not mutated', () => {
  const before = { ...structuredClone(DEFAULT_TASTE), tags: { retro: -2 } };
  const copy = structuredClone(before);
  applyReaction(before, find, 'lessTopic', { tag: 'retro' });
  applyReaction(before, find, 'like');
  assert.deepEqual(before, copy);
});
