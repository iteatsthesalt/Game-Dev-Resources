#!/usr/bin/env node
// tests/bench.js: how fast the simulation steps, in Node, without a browser.
//   node tests/bench.js              Sim.debugScene(600): 1200 steps (20 s of play) after 600 to warm up. Prints
//                                    the average and the worst step time, and exits 1 if the average is above
//                                    1.5 ms, the budget of docs/plan.md. "npm run test:full" ends with this.
//   node tests/bench.js 300 6000     the same with 300 enemies and 6000 measured steps
//   node tests/bench.js --strict     also exits 1 if the worst step took more than 4 ms, the plan's other budget
// It loads the simulation the way the Node tests do (tests/sim/loader.js), so it measures every module below 50
// that exists: today the kernel alone, later whatever systems Sim.step finds. The scene is the debug scene, in
// which the director, the enemy AI and the boss stand aside; a bench of real play belongs with those systems.
//
// Reading the numbers: the step times are by the wall clock; "by CPU time" counts only the time this process
// was really running. On a busy machine the wall clock swings widely and the worst step is whatever the
// scheduler did, which is why only --strict fails on it: trust the average, the CPU figure and the 99th
// percentile more. The checksum is printed so that two runs can be seen to have done the same work.
'use strict';
const { performance } = require('perf_hooks');
const { loadSim } = require('./sim/loader.js');

const args = process.argv.slice(2), strict = args.includes('--strict');
const numbers = args.filter((a) => /^\d+$/.test(a)).map(Number);
const n = numbers[0] === undefined ? 600 : numbers[0], steps = numbers[1] === undefined ? 1200 : numbers[1];
const WARM_UP = 600, BUDGET = { average: 1.5, worst: 4 };   // ms a step
if (steps < 1) throw new Error('bench: there must be at least one step to measure');

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

const times = new Float64Array(steps), cpu0 = process.cpuUsage(), begun = performance.now();
let last = begun;
for (let i = 0; i < steps; i++) {
  step();
  const now = performance.now();
  times[i] = now - last;
  last = now;
}
const total = last - begun, cpu = process.cpuUsage(cpu0);
times.sort();
const average = total / steps, worst = times[steps - 1], p99 = times[Math.min(steps - 1, Math.floor(steps * 0.99))];
const byCpu = (cpu.user + cpu.system) / 1000 / steps;

console.log(`bench: Sim.debugScene(${n}), ${steps} steps after ${WARM_UP} to warm up, Node ${process.version}`);
console.log(`  average ${average.toFixed(4)} ms a step (${byCpu.toFixed(4)} ms by CPU time): ${Math.round(1000 / average)} steps a second, ` +
  `${(1000 / 60 / average).toFixed(0)} times real time`);
console.log(`  worst   ${worst.toFixed(4)} ms; 99th percentile ${p99.toFixed(4)} ms`);
console.log(`  enemies ${S.enemies.n}, steps done ${S.step}, checksum ${Sim.hash(S)}`);
const averageMet = average <= BUDGET.average, worstMet = worst <= BUDGET.worst;
console.log(`  budget  average <= ${BUDGET.average} ms: ${averageMet ? 'met' : 'MISSED'}; worst <= ${BUDGET.worst} ms: ` +
  `${worstMet ? 'met' : strict ? 'MISSED' : 'missed (it fails only with --strict)'}`);
if (!averageMet || (strict && !worstMet)) process.exit(1);
