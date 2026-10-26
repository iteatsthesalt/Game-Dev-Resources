// Loaded into the tool's page before each scenario.
window.T = {
  wait: (ms) => new Promise((r) => setTimeout(r, ms)),
  async until(fn, ms = 10000) { const t0 = Date.now(); while (!fn() && Date.now() - t0 < ms) await this.wait(50); return fn(); },
  checks: [],
  check(name, ok, info) { this.checks.push({ name, ok: !!ok, info: ok ? '' : info === undefined ? '' : JSON.stringify(info).slice(0, 300) }); return !!ok; },
  done() { const c = this.checks; this.checks = []; return c; },
  state: () => window.SpriteRig.state(),
  // press a button by id or selector, then let a frame or two draw
  async press(sel) { const b = document.querySelector(sel.startsWith('#') || sel.startsWith('[') || sel.includes(' ') ? sel : '#' + sel); if (!b) throw new Error('no ' + sel); b.click(); await this.wait(120); },
  key(type, key, o = {}) { document.getElementById('stage').dispatchEvent(new KeyboardEvent(type, { key, bubbles: true, ...o })); },
};
