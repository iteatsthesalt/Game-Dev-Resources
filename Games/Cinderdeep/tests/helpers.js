// Loaded into the game page before each scenario. Game globals (G, UI, W, ...)
// are visible here because the game is a classic script.
window.T = {
  wait: (ms) => new Promise((r) => setTimeout(r, ms)),
  // a list of named checks the runner reports on
  checks: [],
  check(name, ok, info) { this.checks.push({ name, ok: !!ok, info: ok ? '' : info === undefined ? '' : JSON.stringify(info).slice(0, 300) }); return !!ok; },
  done() { const c = this.checks; this.checks = []; return c; },
  // start a descent and wait for the fade
  async descent(cls = 'knight') { CD.startRun({ cls }); await this.wait(900); },
  // a fresh character placed straight into the Realm
  async realm(cls = 'ranger') {
    UI.title(); await this.wait(200);
    const st = realmStore(), ch = newRealmChar(cls); ch.realm = true; st.chars.push(ch);
    enterRealm(st.chars.length - 1); await this.wait(2200);
    return ch;
  },
  // step the simulation, dismissing level-up picks so nothing pauses it
  sim(seconds) { for (let t = 0; t < seconds; t += 1 / 60) { if (UI.top()) { G.p.pendingLevels = 0; UI.clear(); } CD.sim(1 / 60); } },
  buttons: () => (UI.top() ? [...UI.top().querySelectorAll('button')].map((b) => b.textContent) : []),
  click(re) { const b = UI.top() && [...UI.top().querySelectorAll('button')].find((x) => re.test(x.textContent)); if (b) b.click(); return !!b; },
  go(n, dy = 10) { G.p.x = n.x; G.p.y = n.y + dy; },
};
