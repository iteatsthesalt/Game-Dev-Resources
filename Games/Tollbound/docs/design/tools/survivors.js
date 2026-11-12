#!/usr/bin/env node
// Applies the "nothing from memory" rule to the idea pool.
// Reads every pool/ideas-KEY.json and pool/verdicts-KEY-LENS.json, and writes:
//   pool/survivors.json  ideas no skeptic recognised (status "clean"), and ideas a skeptic
//                        recognised as an existing mechanic but gave a way to change (status "mutate")
//   pool/rejected.json   ideas a skeptic recognised as the signature of an existing work, and ideas nobody reviewed
// The rule, on the highest "seen" any skeptic gave an idea:
//   0 or 1  keep as it is        2  keep only with the skeptic's change        3  reject
//   node survivors.js
const fs = require('fs'), path = require('path');
const pool = path.join(__dirname, '..', 'pool');
const read = (f) => JSON.parse(fs.readFileSync(path.join(pool, f), 'utf8'));

const files = fs.readdirSync(pool);
const ideas = files.filter((f) => /^ideas-[a-z]+\.json$/.test(f)).sort().flatMap((f) => read(f).ideas);
const notes = new Map();
for (const f of files.filter((f) => /^verdicts-[a-z]+-[a-z]+\.json$/.test(f)).sort()) {
  const doc = read(f);
  for (const v of doc.verdicts) {
    if (!notes.has(v.id)) notes.set(v.id, []);
    notes.get(v.id).push({ lens: doc.lens, seen: v.seen, where: v.where, mutation: v.mutation || '' });
  }
}

const survivors = [], rejected = [];
for (const idea of ideas) {
  const n = notes.get(idea.id) || [];
  const worst = n.length ? Math.max(...n.map((x) => x.seen)) : -1;
  const row = { ...idea, seen: worst, notes: n };
  if (worst < 0) rejected.push({ ...row, status: 'unreviewed' });
  else if (worst >= 3) rejected.push({ ...row, status: 'recognised' });
  else survivors.push({ ...row, status: worst === 2 ? 'mutate' : 'clean' });
}

fs.writeFileSync(path.join(pool, 'survivors.json'), JSON.stringify(survivors, null, 1) + '\n');
fs.writeFileSync(path.join(pool, 'rejected.json'), JSON.stringify(rejected, null, 1) + '\n');

const areas = [...new Set(ideas.map((i) => i.area))].sort();
const tally = (list, area, status) => list.filter((i) => i.area === area && (!status || i.status === status)).length;
console.log('area'.padEnd(14) + 'proposed  clean  mutate  rejected');
for (const a of areas) {
  console.log(a.padEnd(14) + String(tally(ideas, a)).padStart(8) + String(tally(survivors, a, 'clean')).padStart(7) +
    String(tally(survivors, a, 'mutate')).padStart(8) + String(tally(rejected, a)).padStart(10));
}
console.log('total'.padEnd(14) + String(ideas.length).padStart(8) + String(survivors.filter((i) => i.status === 'clean').length).padStart(7) +
  String(survivors.filter((i) => i.status === 'mutate').length).padStart(8) + String(rejected.length).padStart(10));
