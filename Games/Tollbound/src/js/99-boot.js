// 99-boot.js: starts the page. It runs last, after every other file has only defined things.
// Owns: (none)
// Public: window.TB, the handle that tests and the browser console use:
//   TB.<Name>   every namespace this build has: TB.Core, TB.Sim, TB.Game, ...
//   TB.ready    false until the start below has finished, then true
// The start, once the document is parsed:
//   1. collect the namespaces into TB
//   2. Defs.finalize(), if there is one; each error it returns goes to console.error
//   3. Core.seal(namespaces): from here on no namespace can gain or change a property
//   4. Game.boot(), if there is one; if it returns a promise, the start waits for it
//   5. TB.ready = true
// An error on the way is shown in #toast and thrown again, and TB.ready stays false.
(function () {
  'use strict';

  // typeof is the one way to ask for a name that may not exist: a build without the presentation files
  // (or with only some of them) still starts. tools/lint.js checks that every declared namespace is here.
  function collect() {
    return {
      Core: typeof Core !== 'undefined' ? Core : null,
      Defs: typeof Defs !== 'undefined' ? Defs : null,
      Stats: typeof Stats !== 'undefined' ? Stats : null,
      Dmg: typeof Dmg !== 'undefined' ? Dmg : null,
      Items: typeof Items !== 'undefined' ? Items : null,
      Tree: typeof Tree !== 'undefined' ? Tree : null,
      Char: typeof Char !== 'undefined' ? Char : null,
      Progress: typeof Progress !== 'undefined' ? Progress : null,
      Bellframe: typeof Bellframe !== 'undefined' ? Bellframe : null,
      SaveData: typeof SaveData !== 'undefined' ? SaveData : null,
      Sim: typeof Sim !== 'undefined' ? Sim : null,
      Player: typeof Player !== 'undefined' ? Player : null,
      Buffs: typeof Buffs !== 'undefined' ? Buffs : null,
      AI: typeof AI !== 'undefined' ? AI : null,
      Enemies: typeof Enemies !== 'undefined' ? Enemies : null,
      Skills: typeof Skills !== 'undefined' ? Skills : null,
      Boss: typeof Boss !== 'undefined' ? Boss : null,
      Director: typeof Director !== 'undefined' ? Director : null,
      Offers: typeof Offers !== 'undefined' ? Offers : null,
      Favours: typeof Favours !== 'undefined' ? Favours : null,
      Observances: typeof Observances !== 'undefined' ? Observances : null,
      Bot: typeof Bot !== 'undefined' ? Bot : null,
      World: typeof World !== 'undefined' ? World : null,
      Plat: typeof Plat !== 'undefined' ? Plat : null,
      Store: typeof Store !== 'undefined' ? Store : null,
      Settings: typeof Settings !== 'undefined' ? Settings : null,
      Input: typeof Input !== 'undefined' ? Input : null,
      Sound: typeof Sound !== 'undefined' ? Sound : null,
      Music: typeof Music !== 'undefined' ? Music : null,
      Mesh: typeof Mesh !== 'undefined' ? Mesh : null,
      Rigs: typeof Rigs !== 'undefined' ? Rigs : null,
      Glyphs: typeof Glyphs !== 'undefined' ? Glyphs : null,
      Ground: typeof Ground !== 'undefined' ? Ground : null,
      Gfx: typeof Gfx !== 'undefined' ? Gfx : null,
      Scene: typeof Scene !== 'undefined' ? Scene : null,
      Vfx: typeof Vfx !== 'undefined' ? Vfx : null,
      UI: typeof UI !== 'undefined' ? UI : null,
      Hud: typeof Hud !== 'undefined' ? Hud : null,
      Game: typeof Game !== 'undefined' ? Game : null,
    };
  }

  function show(err) {
    const layer = document.getElementById('toast');
    if (!layer) return;
    const note = document.createElement('div');
    note.className = 'toast-error';
    note.textContent = 'Tollbound could not start: ' + (err && err.message ? err.message : String(err));
    layer.appendChild(note);
  }

  function start() {
    const TB = (window.TB = { ready: false });
    try {
      const found = collect(), list = [];
      for (const name in found) {
        if (found[name]) { TB[name] = found[name]; list.push(found[name]); }
      }
      if (TB.Defs && typeof TB.Defs.finalize === 'function') {
        const errors = TB.Defs.finalize() || [];
        for (let i = 0; i < errors.length && i < 20; i++) console.error('Defs: ' + errors[i]);
        if (errors.length > 20) console.error('Defs: and ' + (errors.length - 20) + ' more');
      }
      TB.Core.seal(list);
      const pending = TB.Game && typeof TB.Game.boot === 'function' ? TB.Game.boot() : null;
      if (pending && typeof pending.then === 'function') {
        pending.then(function () { TB.ready = true; }, function (err) { show(err); throw err; });
      } else {
        TB.ready = true;
      }
    } catch (err) {
      show(err);
      throw err;
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
