import { tokenize } from './util/text.js';
import { normalizeUrl } from './util/url.js';

/** @typedef {import('./types.js').Find} Find */

const MARGINALIA = 'marginalia';
/** The pseudo-source of a link shared into the app; it has no adapter. */
const SHARED = 'shared';
const POOL_PICKS = 10;

function jaccard(a, b) {
  const left = new Set(a);
  const right = new Set(b);
  if (!left.size || !right.size) return 0;
  let both = 0;
  for (const tag of left) if (right.has(tag)) both++;
  return both / (left.size + right.size - both);
}

function termCounts(find) {
  const counts = new Map();
  for (const word of tokenize(`${find.title} ${find.description}`)) counts.set(word, (counts.get(word) ?? 0) + 1);
  return counts;
}

/** Cosine of two sparse vectors; a zero-length vector gives 0, never NaN. */
function cosine(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [word, weight] of a) {
    normA += weight * weight;
    const other = b.get(word);
    if (other) dot += weight * other;
  }
  for (const weight of b.values()) normB += weight * weight;
  return normA && normB ? dot / Math.sqrt(normA * normB) : 0;
}

/**
 * The `k` candidates most like `find`: Jaccard overlap of tags plus cosine similarity of TF-IDF vectors over the
 * title and description. Candidates with the same normalised URL as `find`, and candidates scoring 0, are left out.
 * @param {Find} find
 * @param {Find[]} candidates
 * @param {number} k
 * @returns {Find[]}
 */
export function similarLocal(find, candidates, k) {
  const counts = [find, ...candidates].map(termCounts);
  const df = new Map();
  for (const doc of counts) for (const word of doc.keys()) df.set(word, (df.get(word) ?? 0) + 1);
  const n = counts.length;
  const vector = (doc) => new Map([...doc].map(([word, tf]) => [word, tf * (Math.log((1 + n) / (1 + df.get(word))) + 1)]));

  const mine = vector(counts[0]);
  const own = normalizeUrl(find.url);
  return candidates
    .map((candidate, i) => ({ candidate, score: jaccard(find.tags, candidate.tags) + cosine(mine, vector(counts[i + 1])) }))
    .filter(({ candidate, score }) => score > 0 && normalizeUrl(candidate.url) !== own)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(({ candidate }) => candidate);
}

/**
 * A trail of related finds. Each `next()` extends it from the last find: its own source's `more`, then Marginalia,
 * then local similarity over the cached pool, then the optional AI hook.
 * @param {object} args
 * @param {Array<{id: string, more?: (find: Find, ctx: any) => Promise<Find[]>}> | (() => Array<{id: string, more?: Function}>)} args.sources
 * @param {any} args.ctx handed to each source's `more`
 * @param {(url: string) => Promise<boolean>} args.seenHas
 * @param {() => Find[]} [args.pool] cached candidates for the local step
 * @param {(find: Find) => boolean} [args.accept] the engine's always-on filter
 */
export function createRabbitHole({ sources, ctx, seenHas, pool = () => [], accept = () => true }) {
  /** @type {Find[]} */
  let trail = [];
  /** @type {((find: Find) => Promise<Find[]>)|null} */
  let aiHook = null;

  const sourceList = () => (typeof sources === 'function' ? sources() : sources) ?? [];

  async function askMore(source, last) {
    try {
      const found = await source.more(last, ctx);
      return Array.isArray(found) ? found : [];
    } catch (err) {
      console.warn(`Rabbit hole: ${source.id} could not find more: ${err?.message ?? err}`);
      return [];
    }
  }

  async function askAi(last) {
    try {
      const found = await aiHook(last);
      return Array.isArray(found) ? found : [];
    } catch (err) {
      console.warn(`Rabbit hole: the AI hook failed: ${err?.message ?? err}`);
      return [];
    }
  }

  /** The first candidate that is off the trail, unseen and accepted, or null. */
  async function firstUsable(candidates) {
    const onTrail = new Set(trail.map((find) => normalizeUrl(find.url)));
    for (const candidate of candidates) {
      if (!candidate || onTrail.has(normalizeUrl(candidate.url))) continue;
      if (accept(candidate) && !(await seenHas(candidate.url))) return candidate;
    }
    return null;
  }

  /** The steps for the last find, in order; each yields candidates only when it is called. */
  function steps(last, ai) {
    const list = sourceList().filter((source) => typeof source.more === 'function');
    const own = last.source === SHARED ? undefined : list.find((source) => source.id === last.source);
    const marginalia = list.find((source) => source.id === MARGINALIA);
    const result = [];
    if (own) result.push(() => askMore(own, last));
    if (marginalia && marginalia !== own && (last.kind === 'site' || last.source === SHARED)) {
      result.push(() => askMore(marginalia, last));
    }
    result.push(async () => similarLocal(last, pool(), POOL_PICKS));
    if (aiHook && ai) result.push(() => askAi(last));
    return result;
  }

  return {
    start(find) {
      trail = [find];
    },
    async next({ ai = true } = {}) {
      if (!trail.length) return null;
      const last = trail[trail.length - 1];
      for (const step of steps(last, ai)) {
        const pick = await firstUsable(await step());
        if (pick) {
          trail.push(pick);
          return pick;
        }
      }
      return null;
    },
    trail: () => [...trail],
    climbOut() {
      trail = [];
    },
    useAi(fn) {
      aiHook = typeof fn === 'function' ? fn : null;
    },
  };
}
