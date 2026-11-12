import { gumbel } from './util/hash.js';
import { domainOf } from './util/url.js';

/** @typedef {import('./types.js').Find} Find */

/** Below this many counted reactions the reader has no taste to follow, so every pick is a wildcard. */
const COLD_START_REACTIONS = 5;
const MOMENTUM_SHARE = 0.6;
const TASTE_SHARE = 0.3;

/**
 * Choose which branch the next Tuned stumble takes, from one `rand()` draw. With strangeness `s` the odds are
 * momentum 0.6(1-s), taste 0.3(1-s) and wildcard 0.1+0.9s (at s = 0.25: 45%, 22.5%, 32.5%).
 * @param {() => number} rand
 * @param {number} s strangeness, 0 to 1
 * @returns {'momentum'|'taste'|'wildcard'}
 */
export function chooseBranch(rand, s) {
  const draw = rand();
  const momentumEnd = MOMENTUM_SHARE * (1 - s);
  if (draw < momentumEnd) return 'momentum';
  if (draw < momentumEnd + TASTE_SHARE * (1 - s)) return 'taste';
  return 'wildcard';
}

const weightOf = (weights, key) => weights[key] ?? 0;

/**
 * A find's taste score: its tag weights plus its source weight (missing weights count as 0), plus Gumbel noise
 * so the best score is a weighted random pick rather than always the same find. Uses one `rand()` draw.
 * @param {Find} find
 * @param {{tags: Record<string, number>, sources: Record<string, number>}} taste
 * @param {() => number} rand
 */
export function scoreFind(find, taste, rand) {
  let score = 0;
  for (const tag of find.tags) score += weightOf(taste.tags, tag);
  score += weightOf(taste.sources, find.source);
  return score + gumbel(rand);
}

/**
 * The always-on filters, applied before any branch: not already seen, domain not blocked or shown recently,
 * no hidden tag, and (with the Family filter on) not `mixed` safety.
 * @param {Find} find
 * @param {{seenHas: (url: string) => boolean, taste: object, recentDomains: string[], familyFilter: boolean}} ctx
 */
export function eligible(find, { seenHas, taste, recentDomains, familyFilter }) {
  const domain = domainOf(find.url);
  if (seenHas(find.url)) return false;
  if (taste.blockedDomains.includes(domain)) return false;
  if (recentDomains.includes(domain)) return false;
  if (find.tags.some((tag) => taste.hiddenTags.includes(tag))) return false;
  if (familyFilter && find.safety === 'mixed') return false;
  return true;
}

/** The candidate with the best score; one `rand()` draw per candidate, in order. */
function bestScored(finds, taste, rand) {
  let best = null;
  let bestScore = -Infinity;
  for (const find of finds) {
    const score = scoreFind(find, taste, rand);
    if (score > bestScore) {
      best = find;
      bestScore = score;
    }
  }
  return best;
}

const formatWeight = (n) => `${Math.round(n * 100) / 100}`;

/** Why a taste pick matched: the find's highest-weighted liked tag, else a plain fallback. */
function tasteWhy(find, taste) {
  let topTag = null;
  let topWeight = 0;
  for (const tag of find.tags) {
    const weight = weightOf(taste.tags, tag);
    if (weight > topWeight) {
      topTag = tag;
      topWeight = weight;
    }
  }
  return topTag === null ? 'matches your taste' : `matches ${topTag} +${formatWeight(topWeight)}`;
}

function tastePick(pool, taste, rand) {
  const find = bestScored(pool, taste, rand);
  return { find, branch: 'taste', why: tasteWhy(find, taste) };
}

/**
 * Pick the next Tuned find from `candidates`, or null when none passes the filters. The `rand()` draws are, in
 * order: one for the branch (skipped in cold start, when `taste.reactions` is under 5), then one per scored
 * candidate (taste, or momentum among candidates sharing a tag with `current`) or one for the wildcard index.
 * Momentum with no `current` or no tag-sharing candidate falls back to taste.
 * @param {{candidates: Find[], current: Find|null, taste: object, rand: () => number,
 *   seenHas: (url: string) => boolean, recentDomains: string[], familyFilter: boolean}} args
 * @returns {{find: Find, branch: 'momentum'|'taste'|'wildcard', why: string}|null}
 */
export function pickNext({ candidates, current, taste, rand, seenHas, recentDomains, familyFilter }) {
  const filters = { seenHas, taste, recentDomains, familyFilter };
  const pool = candidates.filter((find) => eligible(find, filters));
  if (pool.length === 0) return null;

  const branch = taste.reactions < COLD_START_REACTIONS ? 'wildcard' : chooseBranch(rand, taste.strangeness);

  if (branch === 'wildcard') {
    return { find: pool[Math.floor(rand() * pool.length)], branch, why: 'wildcard' };
  }
  if (branch === 'momentum' && current) {
    const shared = pool.filter((find) => find.tags.some((tag) => current.tags.includes(tag)));
    if (shared.length > 0) {
      return { find: bestScored(shared, taste, rand), branch, why: `similar to ${current.title}` };
    }
  }
  return tastePick(pool, taste, rand);
}
