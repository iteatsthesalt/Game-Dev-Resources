// tests/helpers.js: loaded into the page by tests/run.js once the game is ready (and again after each reload).
// A scenario's run function works inside the page with the game's handle TB (see 99-boot.js) and with T:
//   T.check(name, ok, info)        records one named check and returns ok as a boolean. info is any small value
//                                  that explains the result; it is shown when the check fails, and for every
//                                  check with --verbose
//   await T.until(fn, ms = 15000)  calls fn every 50 ms until it returns something truthy or ms have passed;
//                                  returns what fn returned last. For things the game does on its own clock.
//   await T.sleep(ms)
//   T.done()                       the checks collected so far, for the runner: end a scenario with
//                                  "return T.done();"
//   T.target                       'standalone' or 'artifact': which build the runner is hosting
window.T = (function () {
  'use strict';
  let checks = [];
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  function show(info) {
    if (info === undefined) return '';
    let text;
    try { text = typeof info === 'string' ? info : JSON.stringify(info); } catch (e) { text = ''; }
    return String(text === undefined || text === '' ? info : text).slice(0, 300);
  }
  return {
    target: 'standalone',
    sleep,
    check(name, ok, info) {
      checks.push({ name: String(name), ok: !!ok, info: show(info) });
      return !!ok;
    },
    async until(fn, ms = 15000) {
      const end = Date.now() + ms;
      let value = await fn();
      while (!value && Date.now() < end) {
        await sleep(50);
        value = await fn();
      }
      return value;
    },
    done() {
      const list = checks;
      checks = [];
      return list;
    },
  };
})();
