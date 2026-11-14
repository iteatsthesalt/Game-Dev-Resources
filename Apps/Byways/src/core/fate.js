/** @typedef {import('./types.js').Find} Find */

export const FATE_EMPTY = 'Nothing new here. Try again, or turn on more Fate sources.';
export const FATE_NO_SOURCES = 'No Fate sources are on. Turn some on in Settings → Sources.';

/** Own properties only: source ids come from outside, so 'constructor' must not read Object.prototype. */
const weightOf = (weights, id) => (Object.hasOwn(weights, id) ? weights[id] : 1);

/** Walk the sources in order until the draw falls inside one's share of the total weight. */
function chooseSource(entries, total, draw) {
  let left = draw * total;
  for (const entry of entries) {
    left -= entry.weight;
    if (left < 0) return entry.source;
  }
  return entries[entries.length - 1].source;
}

/**
 * One Fate pull: pick a weighted random source, ask it for a random batch, and take the first find that is unseen and
 * accepted. A batch that throws, is empty or holds nothing usable is a miss and the pull tries again, making at most
 * `retries + 1` `random()` calls in all.
 * @param {object} args
 * @param {Array<{id: string, fate?: boolean, random: (ctx: any) => Promise<Find[]>}>} args.sources
 * @param {Record<string, number>} args.weights per-source weight by id; a missing weight is 1
 * @param {any} args.ctx handed to each source's `random`
 * @param {() => number} args.rand
 * @param {(url: string) => Promise<boolean>} args.seenHas
 * @param {number} [args.retries]
 * @param {(find: Find) => boolean} [args.accept] the engine's always-on filter
 * @returns {Promise<{find: Find}|{miss: true, reason: string}>}
 */
export async function fatePull({ sources, weights, ctx, rand, seenHas, retries = 3, accept = () => true }) {
  const entries = sources
    .filter((source) => source.fate === true)
    .map((source) => ({ source, weight: weightOf(weights, source.id) }))
    .filter((entry) => entry.weight > 0);
  if (!entries.length) return { miss: true, reason: FATE_NO_SOURCES };

  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  for (let attempt = 0; attempt <= retries; attempt++) {
    const source = chooseSource(entries, total, rand());
    let batch;
    try {
      batch = await source.random(ctx);
    } catch (err) {
      console.warn(`Fate: ${source.id} could not pull a random find: ${err?.message ?? err}`);
      continue;
    }
    for (const find of batch ?? []) {
      if (accept(find) && !(await seenHas(find.url))) return { find };
    }
  }
  return { miss: true, reason: FATE_EMPTY };
}
