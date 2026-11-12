#!/usr/bin/env node
// tests/bench.js: how fast the simulation steps, in Node, without a browser.
//   node tests/bench.js                  Sim.debugScene(600): three rounds of 6000 steps (100 s of play) after a warm-up
//   node tests/bench.js 300 12000        the same with 300 enemies and rounds of 12000 steps
//   node tests/bench.js --strict         exit 1 if the best round misses the budget of docs/plan.md: at most 1.5 ms
//                                        a step on average and 4 ms for the slowest step, with 600 enemies
// It loads the simulation the way the Node tests do (tests/sim/loader.js), so it measures every module below 50
// that exists: today the kernel alone, later whatever systems Sim.step finds. The scene is the debug scene, in
// which the director, the enemy AI and the boss stand aside; a bench of real play belongs with those systems.
//
// Reading the numbers: "steps/s" and the step times are by the wall clock, "by CPU time" counts only the time
// this process was really running. On a busy machine the wall clock swings widely and the slowest step is
// whatever the scheduler did, so quote the best round, and trust the CPU figure and the 99th percentile more.
// The checksum is printed so that two runs can be seen to have done the same work.
'use strict';
const { performance } = require('perf_hooks');
const { loadSim } = require('./sim/loader.js');

const args = process.argv.slice(2), strict = args.includes('--strict');
const numbers = args.filter((a) => /^\d+$/.test(a)).map(Number);
const n = numbers[0] === undefined ? 600 : numbers[0], steps = numbers[1] === undefined ? 6000 : numbers[1];
const ROUNDS = 3, WARM_UP = 600, BUDGET = { mean: 1.5, worst: 4 };

const { Sim } = loadSim({ boot: true });
// the player walks in a slow circle, so whatever moves the player has something to do
const input = { mx: 0, my: 0, ax: 1, ay: 0, aim: false, dodge: false, draught: false };
const S = Sim.debugScene(n, 20261112);
function step() {
  input.mx = Math.cos(S.step / 240) * 0.6;
  input.my = Math.sin(S.step / 240) * 0.6;
  Sim.step(S, input);
}
for (let i = 0; i < WARM_UP; i++) step();

const rounds = [], times = new Float64Array(steps);
for (let round = 0; round < ROUNDS; round++) {
  const cpu0 = process.cpuUsage(), begun = performance.now();
  let last = begun;
  for (let i = 0; i < steps; i++) {
    step();
    const now = performance.now();
    times[i] = now - last;
    last = now;
  }
  const total = last - begun, cpu = process.cpuUsage(cpu0);
  times.sort();
  rounds.push({
    perSecond: steps / total * 1000, mean: total / steps, p99: times[Math.floor(steps * 0.99)], worst: times[steps - 1],
    cpuPerSecond: steps / ((cpu.user + cpu.system) / 1e6),
  });
}
const best = rounds.reduce((a, b) => (b.mean < a.mean ? b : a));
const least = (key) => Math.min(...rounds.map((r) => r[key]));

console.log(`bench: Sim.debugScene(${n}), ${ROUNDS} rounds of ${steps} steps, Node ${process.version}`);
rounds.forEach((r, i) => console.log(`  round ${i + 1}: ${Math.round(r.perSecond)} steps/s (${Math.round(r.cpuPerSecond)} by CPU time), ` +
  `mean ${r.mean.toFixed(4)} ms, 99th percentile ${r.p99.toFixed(4)} ms, slowest step ${r.worst.toFixed(3)} ms`));
console.log(`  best:    ${Math.round(best.perSecond)} steps/s, mean ${best.mean.toFixed(4)} ms a step, ${(1000 / 60 / best.mean).toFixed(0)} times real time; ` +
  `slowest step of the calmest round ${least('worst').toFixed(3)} ms`);
console.log(`  enemies ${S.enemies.n}, steps done ${S.step}, checksum ${Sim.hash(S)}`);
const within = best.mean <= BUDGET.mean && least('worst') <= BUDGET.worst;
console.log(`  budget:  mean <= ${BUDGET.mean} ms and slowest <= ${BUDGET.worst} ms: ${within ? 'met' : 'MISSED'}`);
if (strict && !within) process.exit(1);
