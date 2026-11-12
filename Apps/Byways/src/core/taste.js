import { domainOf } from './util/url.js';

/** The taste a new reader starts with: no opinions yet. */
export const DEFAULT_TASTE = {
  v: 1,
  tags: {},
  sources: {},
  hiddenTags: [],
  blockedDomains: [],
  strangeness: 0.25,
  interests: [],
  reactions: 0,
};

const WEIGHT_CAP = 3;
const HIDE_AT = -3;
const COUNTED = new Set(['like', 'save', 'dislike', 'lessTopic', 'neverSite']);
const TAG_STEP = { like: 1, save: 1, dislike: -0.5 };
const SOURCE_STEP = { like: 0.5, save: 0.5, dislike: -0.25 };
const LESS_TOPIC_STEP = -2;
const INTEREST_STEP = 2;

const clamp = (n) => Math.max(-WEIGHT_CAP, Math.min(WEIGHT_CAP, n));

/** Move one weight by `step` within the cap; returns the delta that actually applied. */
function bump(weights, key, step) {
  const before = Object.hasOwn(weights, key) ? weights[key] : 0; // own only: 'constructor' is a valid id
  const after = clamp(before + step);
  weights[key] = after;
  return after - before;
}

/**
 * Apply one reaction to a taste. Pure: the input is never mutated. `extra` is `{tag}` for
 * `interest` and `lessTopic` (default: the find's first tag) and `{blockDomain: true}` for `broken`.
 * Only `lessTopic` hides a tag (at -3). With no tag to act on, `interest` and `lessTopic` change nothing.
 * Returns the new taste and a `change` describing what moved, for `describeChange`.
 */
export function applyReaction(taste, find, reaction, extra = {}) {
  const next = structuredClone(taste);
  const change = { tagDeltas: {}, sourceDelta: 0, hidden: [], blocked: [] };

  const moveTag = (tag, step) => {
    const earlier = Object.hasOwn(change.tagDeltas, tag) ? change.tagDeltas[tag] : 0;
    change.tagDeltas[tag] = earlier + bump(next.tags, tag, step);
  };
  const blockSite = () => {
    const domain = domainOf(find?.url ?? '');
    if (domain !== '' && !next.blockedDomains.includes(domain)) {
      next.blockedDomains.push(domain);
      change.blocked.push(domain);
    }
  };

  switch (reaction) {
    case 'like':
    case 'save':
    case 'dislike':
      for (const tag of new Set(find.tags)) moveTag(tag, TAG_STEP[reaction]);
      if (find.source !== 'shared') change.sourceDelta = bump(next.sources, find.source, SOURCE_STEP[reaction]);
      break;
    case 'lessTopic': {
      const tag = extra.tag ?? find?.tags?.[0];
      if (tag === undefined) return { taste: next, change };
      moveTag(tag, LESS_TOPIC_STEP);
      // Only "Less of this topic" hides a tag; other reactions stop at the -3 floor.
      if (next.tags[tag] <= HIDE_AT && !next.hiddenTags.includes(tag)) {
        next.hiddenTags.push(tag);
        change.hidden.push(tag);
      }
      break;
    }
    case 'neverSite':
      blockSite();
      break;
    case 'interest':
      if (extra.tag === undefined) return { taste: next, change };
      moveTag(extra.tag, INTEREST_STEP);
      if (!next.interests.includes(extra.tag)) next.interests.push(extra.tag);
      break;
    case 'broken':
      if (extra.blockDomain) blockSite();
      break;
    default:
      throw new Error(`Unknown reaction: ${reaction}`);
  }

  if (COUNTED.has(reaction)) next.reactions += 1;
  return { taste: next, change };
}

const defaultLabelOf = (id) => id.replace(/-/g, ' ');
const isAllCaps = (s) => s === s.toUpperCase() && s !== s.toLowerCase();

/** "a", "a and b", "a, b and c". */
function joinList(items) {
  if (items.length < 2) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Say what a reaction changed, in one short sentence for the reader. */
export function describeChange(change, labelOf = defaultLabelOf) {
  const inSentence = (id) => {
    const label = labelOf(id);
    return isAllCaps(label) ? label : label.toLowerCase();
  };
  const sentenceStart = (id) => {
    const text = inSentence(id);
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  if (change.blocked.length > 0) return `You won't see ${joinList(change.blocked)} again.`;
  if (change.hidden.length > 0) {
    const [first, ...rest] = change.hidden;
    const names = joinList([sentenceStart(first), ...rest.map(inSentence)]);
    return `${names} ${change.hidden.length > 1 ? 'are' : 'is'} hidden now.`;
  }
  const entries = Object.entries(change.tagDeltas);
  const more = entries.filter(([, d]) => d > 0).map(([id]) => inSentence(id));
  const less = entries.filter(([, d]) => d < 0).map(([id]) => inSentence(id));
  const sentences = [];
  if (more.length > 0) sentences.push(`More ${joinList(more)} from now on.`);
  if (less.length > 0) sentences.push(`Less ${joinList(less)} from now on.`);
  if (sentences.length > 0) return sentences.join(' ');
  if (change.sourceDelta > 0) return 'More like this from now on.';
  if (change.sourceDelta < 0) return 'Less like this from now on.';
  return 'Noted.';
}
