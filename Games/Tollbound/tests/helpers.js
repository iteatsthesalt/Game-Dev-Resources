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
// Input as a player gives it. Events a scenario makes itself (new KeyboardEvent, element.click()) reach the
// game's listeners but are not trusted: the browser will not let them capture a pointer, unlock sound or
// start a gesture. These go through the runner and are the real thing. All take CSS pixels from the top left
// corner of the window, and all are awaited: the browser has dealt with the input when they resolve.
//   await T.tap(x, y)              a finger tap in a scenario with mobile: true, else a mouse click
//   await T.tap(element)           the same in the middle of an element (also for T.click)
//   await T.click(x, y)            a mouse click, whatever the device
//   await T.mouse(type, x, y)      type 'move' (to x, y), 'down' or 'up' (the left button, where the mouse is)
//   await T.key(key)               a key pressed and let go; key as Playwright names it: 'KeyD', 'ArrowUp',
//                                  'Escape', 'Enter', 'a'
//   await T.keyDown(key), await T.keyUp(key)
//   await T.touch(type, points)    raw touches, in a scenario with mobile: true, for sticks, drags and two
//                                  thumbs. points [{id, x, y}] are the fingers the event is about: those that
//                                  come down ('start'), move ('move') or lift ('end'). Fingers that are down
//                                  and not named stay as they are. 'end' or 'cancel' with [] lifts them all.
//                                  The browser may hand a move to the page a frame later: wait for what it
//                                  does (T.until), do not look for it at once.
//   T.middle(element) -> {x, y}    the middle of an element, for the calls above
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
  function middle(element) {
    const box = element.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  }
  function input(kind, a, b, c) {
    if (typeof window.__tbInput !== 'function') throw new Error('real input needs the runner: this page was not opened by tests/run.js');
    return window.__tbInput(kind, a, b, c);
  }
  // (x, y), or an element whose middle is meant
  function at(kind, x, y) {
    const point = x !== null && typeof x === 'object' ? middle(x) : { x: x, y: y };
    return input(kind, point.x, point.y);
  }
  return {
    target: 'standalone',
    sleep,
    middle,
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
    tap(x, y) { return at('tap', x, y); },
    click(x, y) { return at('click', x, y); },
    mouse(type, x, y) { return input('mouse', type, x, y); },
    key(key) { return input('key', 'press', key); },
    keyDown(key) { return input('key', 'down', key); },
    keyUp(key) { return input('key', 'up', key); },
    touch(type, points) { return input('touch', type, points || []); },
  };
})();
