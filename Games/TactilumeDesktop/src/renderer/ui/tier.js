// Which of docs/design.md's requirement tiers this computer meets, from the particle count the
// first-run measurement found. Pure, so tests/unit/ui-tier.test.js checks it.
//
// The tiers are stated at 60 Hz; a faster display draws more frames a second, so the count is
// weighed by its refresh rate first (15 million at 144 Hz is as much light a second as 36
// million at 60, which is why design.md calls 15M+ at 144-240 Hz Ultra).

// each tier: its key, its name, the count (at 60 Hz) it starts at, and design.md's words for it
export const TIERS = Object.freeze([
  { key: 'minimum', name: 'Minimum', from: 1e6, expected: 'about 1–3M particles at 60 Hz' },
  { key: 'standard', name: 'Standard', from: 5e6, expected: 'about 5–10M' },
  { key: 'reference', name: 'Reference', from: 15e6, expected: 'about 15–30M at 60 Hz with every effect on' },
  { key: 'ultra', name: 'Ultra', from: 30e6, expected: '30M+ particles, or 15M+ at 144–240 Hz' },
].map((t) => Object.freeze(t)));

// → { key, name, text } for a measured `particles` at `refreshHz`, or null when nothing has
// been measured. `key` is 'below' under the Minimum tier.
export function requirementTier({ particles, refreshHz = 60 } = {}) {
  if (!Number.isFinite(particles) || particles <= 0) return null;
  const hz = Number.isFinite(refreshHz) && refreshHz > 0 ? Math.min(Math.max(refreshHz, 30), 500) : 60;
  const at60 = (particles * hz) / 60;
  let tier = null;
  for (const t of TIERS) if (at60 >= t.from) tier = t;
  if (!tier) return { key: 'below', name: 'Below Minimum', text: `Below the Minimum tier (${TIERS[0].expected})` };
  return { key: tier.key, name: tier.name, text: `${tier.name} (${tier.expected})` };
}
