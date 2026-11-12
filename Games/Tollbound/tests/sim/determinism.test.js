// tests/sim/determinism.test.js: the same seed and the same inputs give the same run, every time.
// The whole build is loaded, every module below 50 whoever wrote it, and booted the way the page boots it. A
// system that reads a clock, keeps something from one run to the next, shares scratch state between two runs
// or draws from anything but the run's seeded streams shows here. The scene is Sim.debugScene, with a scripted
// player who walks and presses both buttons, the trade and the heave. tests/scenarios/20-play.js makes the browser
// agree with Node.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSim } = require('./loader.js');

const HUSKS = 200, STEPS = 600;                        // 600 steps are ten seconds of play
const sim = loadSim({ boot: true });

// What the scripted player does on step i: the same for every run. The move vector stays shorter than 1.
function inputAt(i, frame) {
  frame.mx = Math.cos(i / 40) * 0.7;
  frame.my = Math.sin(i / 55) * 0.7;
  frame.trade = i % 97 === 0;
  frame.heave = i % 211 === 0;
  return frame;
}
const newFrame = () => ({ mx: 0, my: 0, ax: 1, ay: 0, aim: false, trade: false, heave: false });

// One step of a run, with any offer that stands in its way taken first.
function advance(Sim, S, i, frame) {
  if (S.phase === 'offer') Sim.command(S, { type: 'pick', index: 0 });
  Sim.step(S, inputAt(i, frame));
}

// Plays a debug scene and returns the run and its checksum after every 600 steps.
function play(Sim, seed, steps = STEPS) {
  const S = Sim.debugScene(HUSKS, seed), frame = newFrame(), marks = [];
  for (let i = 0; i < steps; i++) {
    advance(Sim, S, i, frame);
    if (i % STEPS === STEPS - 1) marks.push(Sim.hash(S));
  }
  return { S, marks, hash: Sim.hash(S) };
}

test('Sim.debugScene with the same seed gives the same Sim.hash after 600 steps, twice', () => {
  const first = play(sim.Sim, 20261112), second = play(sim.Sim, 20261112);
  assert.equal(first.S.step, STEPS);
  assert.ok(first.S.enemies.n > 0, 'the scene has its husks');
  assert.ok(Number.isInteger(first.hash) && first.hash >= 0 && first.hash <= 0xffffffff, 'a checksum is a whole number of 32 bits');
  assert.equal(second.hash, first.hash, 'a second run in the same copy of the simulation: nothing leaks from run to run');
  assert.notEqual(first.hash, sim.Sim.hash(sim.Sim.debugScene(HUSKS, 20261112)), 'and the run did go somewhere in its 600 steps');
});

test('another seed gives another run', () => {
  const a = play(sim.Sim, 20261112), b = play(sim.Sim, 20261113), word = play(sim.Sim, 'vigil');
  assert.notEqual(a.hash, b.hash);
  assert.notEqual(a.hash, word.hash);
  assert.equal(play(sim.Sim, 'vigil').hash, word.hash, 'a word is a seed like any other');
});

test('a second copy of the simulation plays the same run', () => {
  const other = loadSim({ boot: true });
  assert.notEqual(other.Sim, sim.Sim);
  assert.equal(play(other.Sim, 20261112).hash, play(sim.Sim, 20261112).hash);
});

test('for three minutes the checksum is the same every 600 steps', () => {
  const steps = 3 * 60 * 60, a = play(sim.Sim, 7, steps), b = play(sim.Sim, 7, steps);
  assert.equal(a.marks.length, 18);
  assert.deepEqual(a.marks, b.marks);
  assert.equal(new Set(a.marks).size, 18, 'and it moves on as the run does');
});

test('two runs stepped in turn do not disturb each other', () => {
  // A and B take their steps alternately. Each must end as it does when it runs alone: scratch arrays and
  // variables that a module keeps for itself must not carry anything from one run into the other.
  const A = sim.Sim.debugScene(HUSKS, 31), B = sim.Sim.debugScene(HUSKS / 2, 32), frameA = newFrame(), frameB = newFrame();
  for (let i = 0; i < STEPS; i++) {
    advance(sim.Sim, A, i, frameA);
    advance(sim.Sim, B, i, frameB);
  }
  assert.equal(sim.Sim.hash(A), play(sim.Sim, 31).hash);
  const alone = sim.Sim.debugScene(HUSKS / 2, 32), frame = newFrame();
  for (let i = 0; i < STEPS; i++) advance(sim.Sim, alone, i, frame);
  assert.equal(sim.Sim.hash(B), sim.Sim.hash(alone));
});
