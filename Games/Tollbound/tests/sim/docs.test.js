// tests/sim/docs.test.js: docs/engine.md says what the code does, in the places where a test can tell.
//   - its "Entities" table lists the built-in fields of every kind of entity, in the order Sim.fields gives
//   - its "Run state" section names every field of a new run
//   - the strides of the instance records are the ones src/js/65-gfx.js sets
// (00-tools.test.js holds the two lists of namespaces of the same file against the code.)
// Whoever changes one of these in the code changes the doc in the same change, and the other way round.
// The tests are skipped where the doc is not there, as in a copy of the simulation alone.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const modules = require('../../tools/modules.js');
const { loadSim, plain } = require('./loader.js');

const FILE = path.join(__dirname, '..', '..', 'docs', 'engine.md');
const doc = fs.existsSync(FILE) ? fs.readFileSync(FILE, 'utf8') : null;
const KERNEL = ['00-core.js', '01-defs.js', '02-pool-grid.js', '10-stats.js', '20-sim.js', '29-world.js', '30-modes-curves.js'];

// The text of the section under "## heading", up to the next "## " line.
function section(heading) {
  const from = doc.indexOf('\n## ' + heading + '\n');
  assert.ok(from >= 0, `docs/engine.md has a section "${heading}"`);
  const to = doc.indexOf('\n## ', from + 1);
  return doc.slice(from, to < 0 ? doc.length : to);
}

test('the Entities table of docs/engine.md lists the built-in fields of every kind', (t) => {
  if (doc === null) return t.skip('there is no docs/engine.md here');
  // a row reads: | label | `field, field, ...` |
  const rows = new Map();
  for (const line of section('Entities').split('\n')) {
    const m = /^\|\s*([^|`]+?)\s*\|\s*`([^`]+)`\s*\|$/.exec(line);
    if (m) rows.set(m[1], m[2].split(/\s*,\s*/));
  }
  const row = (label) => {
    assert.ok(rows.has(label), `the table has a row "${label}"`);
    return rows.get(label);
  };
  const pooled = row('every pooled entity'), body = row('enemy and minion add');
  const listed = {
    enemy: [...pooled, ...body, ...row('enemy adds')],
    minion: [...pooled, ...body, ...row('minion adds')],
    shot: [...pooled, ...row('shot adds')],
    area: [...pooled, ...row('area adds')],
    pickup: [...pooled, ...row('pickup adds')],
    player: row('player'),
    skill: row('skill'),
  };
  // the kernel alone: fields that later files add with Sim.field are not built in
  const { Sim } = loadSim({ only: KERNEL });
  for (const kind of Object.keys(listed)) assert.deepEqual(listed[kind], plain(Sim.fields(kind)), `the fields of ${kind}`);
  const S = Sim.create({ zone: 'debug', seed: 1 });
  assert.deepEqual(Object.keys(S.player), listed.player, 'and a run makes its player of them');
  assert.deepEqual(Object.keys(S.enemies.items[0]), listed.enemy);
});

test('the Run state section of docs/engine.md names every field of a new run', (t) => {
  if (doc === null) return t.skip('there is no docs/engine.md here');
  const text = section('Run state'), { Sim } = loadSim({ only: KERNEL });
  const S = Sim.create({ zone: 'debug', seed: 1 });
  const unnamed = Object.keys(S).filter((key) => !new RegExp('(?<![\\w.])' + key + '(?![\\w])').test(text));
  assert.deepEqual(unnamed, [], 'fields of S that the section does not mention');
  for (const key of Object.keys(S.rng)) assert.ok(text.includes(key), `the stream ${key}`);
  for (const key of Object.keys(Sim.result(S))) assert.ok(new RegExp('\\b' + key + '\\b').test(text), `the result's ${key}`);
});

test('docs/engine.md gives the strides of the instance records as 65-gfx.js sets them', (t) => {
  if (doc === null) return t.skip('there is no docs/engine.md here');
  if (!modules.all().includes('65-gfx.js')) return t.skip('there is no 65-gfx.js here');
  const strides = Array.from(modules.read('65-gfx.js').matchAll(/^\s*Gfx\.([A-Z]+_STRIDE) = (\d+);/gm), (m) => `Gfx.${m[1]} = ${m[2]}`);
  assert.ok(strides.length >= 3, 'the file sets its strides one to a line');
  for (const line of strides) assert.ok(doc.includes(line), `docs/engine.md says "${line}"`);
});
