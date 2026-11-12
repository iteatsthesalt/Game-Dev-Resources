// Keeps the motion smooth by changing the particle count while the app runs: it steps down
// after missed frames and back up slowly when there is headroom. Pure, so it is unit-tested.
//
// First version, written by the spine: it holds the starting count and never asks for a
// change. The engine part owns this file and replaces it.

export function createGovernor({ min = 1, max = Infinity, start = min, refreshHz = 60 } = {}) {
  const particles = Math.min(Math.max(start, min), max);
  return {
    particles,
    refreshHz,
    // frameMs: how long the last frame took; now: ms. Returns a new count, or null for no change.
    update(frameMs, now) {
      return null;
    },
  };
}
