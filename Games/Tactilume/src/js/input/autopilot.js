// STUB: replaced by the real module. Matches CONTRACTS.md so the app builds.
export function createAutopilot({ seed = 1 } = {}) {
  return {
    update(dt, time, aspect) {
      const x = Math.sin(time * 0.31) * aspect * 0.5, y = Math.sin(time * 0.23 + 1) * 0.5;
      return [{ x, y, vx: 0, vy: 0, power: 1, age: time, held: true, id: 'a0', kind: 'auto' }];
    },
    reset() {},
  };
}
