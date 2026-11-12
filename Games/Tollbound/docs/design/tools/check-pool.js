#!/usr/bin/env node
// Checks a file in docs/design/pool before it is handed on.
//   node check-pool.js ideas <ideas-KEY.json>
//   node check-pool.js verdicts <ideas-KEY.json> <verdicts-KEY-LENS.json>
// Prints every problem and exits 1 if there is one.
const fs = require('fs');

// The least number of ideas an inventor gives in each area.
const QUOTA = {
  'combat-model': 2, condition: 6, attribute: 1, class: 6, calling: 6, skill: 10, modifier: 6, reserved: 3,
  pick: 6, enemy: 8, boss: 3, district: 2, tree: 3, gear: 3, event: 4, legacy: 2, 'frame-twist': 3,
};
const COSTS = ['data', 'small', 'medium', 'large'];
const words = (s) => (typeof s === 'string' ? s.trim().split(/\s+/).filter(Boolean).length : 0);

function readJson(path, errors) {
  try { return JSON.parse(fs.readFileSync(path, 'utf8')); }
  catch (e) { errors.push(`${path}: not valid JSON: ${e.message}`); return null; }
}

function checkIdeas(path, errors) {
  const doc = readJson(path, errors);
  if (!doc) return null;
  if (typeof doc.inventor !== 'string' || !doc.inventor) errors.push('missing "inventor" (the key, for example "bells")');
  if (!Array.isArray(doc.ideas)) { errors.push('missing "ideas" array'); return null; }
  const seen = new Set(), count = {};
  doc.ideas.forEach((it, i) => {
    const at = `ideas[${i}]${it && it.id ? ' ' + it.id : ''}`;
    if (!it || typeof it !== 'object') { errors.push(`${at}: not an object`); return; }
    if (typeof it.id !== 'string' || !it.id.startsWith(doc.inventor + '-')) errors.push(`${at}: id must start with "${doc.inventor}-"`);
    if (seen.has(it.id)) errors.push(`${at}: duplicate id`);
    seen.add(it.id);
    if (!(it.area in QUOTA)) errors.push(`${at}: area "${it.area}" is not one of ${Object.keys(QUOTA).join(', ')}`);
    else count[it.area] = (count[it.area] || 0) + 1;
    if (words(it.name) < 1) errors.push(`${at}: missing name`);
    if (words(it.idea) < 25) errors.push(`${at}: "idea" must state the rule in at least 25 words`);
    if (words(it.source) < 5) errors.push(`${at}: "source" must say what fact or need it is built from`);
    if (words(it.nearest) < 1) errors.push(`${at}: "nearest" must name the closest existing thing you know, or say "none known"`);
    if (!COSTS.includes(it.cost)) errors.push(`${at}: cost must be one of ${COSTS.join(', ')}`);
  });
  for (const area of Object.keys(QUOTA)) {
    if ((count[area] || 0) < QUOTA[area]) errors.push(`area "${area}": ${count[area] || 0} ideas, at least ${QUOTA[area]} needed`);
  }
  return doc;
}

function checkVerdicts(ideasPath, verdictsPath, errors) {
  const ideas = checkIdeas(ideasPath, []);
  const doc = readJson(verdictsPath, errors);
  if (!ideas || !doc) { if (!ideas) errors.push(`${ideasPath}: could not be read`); return; }
  if (typeof doc.lens !== 'string' || !doc.lens) errors.push('missing "lens"');
  if (!Array.isArray(doc.verdicts)) { errors.push('missing "verdicts" array'); return; }
  const want = new Set(ideas.ideas.map((it) => it.id)), got = new Set();
  doc.verdicts.forEach((v, i) => {
    const at = `verdicts[${i}]${v && v.id ? ' ' + v.id : ''}`;
    if (!v || typeof v !== 'object') { errors.push(`${at}: not an object`); return; }
    if (!want.has(v.id)) errors.push(`${at}: no such idea id`);
    if (got.has(v.id)) errors.push(`${at}: second verdict for the same idea`);
    got.add(v.id);
    if (![0, 1, 2, 3].includes(v.seen)) errors.push(`${at}: seen must be 0, 1, 2 or 3`);
    if (words(v.where) < 1) errors.push(`${at}: "where" must name the closest existing thing, even when distant`);
    if (v.seen === 2 && words(v.mutation) < 8) errors.push(`${at}: seen is 2, so "mutation" must say how to change the idea so it is its own`);
  });
  for (const id of want) if (!got.has(id)) errors.push(`no verdict for ${id}`);
}

const [mode, a, b] = process.argv.slice(2);
const errors = [];
if (mode === 'ideas' && a) {
  const doc = checkIdeas(a, errors);
  if (doc && !errors.length) console.log(`${a}: ${doc.ideas.length} ideas, all checks pass`);
} else if (mode === 'verdicts' && a && b) {
  checkVerdicts(a, b, errors);
  if (!errors.length) console.log(`${b}: every idea has a verdict, all checks pass`);
} else {
  errors.push('usage: node check-pool.js ideas <ideas.json> | verdicts <ideas.json> <verdicts.json>');
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
