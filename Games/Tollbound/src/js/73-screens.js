// 73-screens.js: the title and the results, registered while this file loads, so that 90-game.js finds them and
// leaves its stand-ins out. css/30-hud.css styles what is theirs; the rest is the classes of css/10-ui.css.
// Owns: (none)
// Public: no functions. It registers two screens with UI.screen:
//   'title'     the game's name under its emblem (Glyphs 'mark.bell'), a gold rule, one line of subtitle; its main
//               control (focus starts on it), a Settings button under it where the build has Settings.open; and the
//               build line, "Build <version> · <view> · <where saves go>", kept up to date while the title is open.
//               The main control is "The Household", Game.household(): a vigil is kept by a character of the
//               Household, chosen or made there. In a build that keeps no Household (Game.save is null: no
//               14-character.js or 16-savedata.js) it is "Begin vigil", which starts a vigil of the Dial with the
//               Change-ringer, Game.start(Object.assign({zone: 'dial'}, Player.classRun('change-ringer'))), when that
//               function, the class and the zone exist; with the zone but not the class, a vigil of the Dial without
//               one; with no Dial, the debug scene (Game.start()). Escape does nothing here.
//   'results'   opened by 90-game.js with {S, result, report} when a run has ended (result may be null when the run
//               was ended by hand: then Sim.result(S) gives the totals; report is what the end did to the character
//               whose vigil it was, Char.end's, and null for a run without one). It says which vigil it was ("The vigil
//               of the Dial"), how it ended in the design's words (the outcomes of OUTCOMES below), and its tally: time
//               (m:ss), tolls, laid (kills), coin, banked, and Hum when any was heard; then who kept it: for a
//               character its name, class and level, the levels it gained, and, if it died, that it is on the Register
//               and was recast as a bell; for a run with a class, the class's name. Its buttons: for a character that
//               lives, "Back to the Lantern" (focus starts on it) and "Another vigil" (the same character into the same
//               district, Game.vigil); for one that died, "To the Household" alone; for a run without a character,
//               "Back to the title" (focus) and "Another vigil", which starts the same kind of vigil again with a new
//               seed: the same zone and class, or after a debug scene what "Begin vigil" starts. Escape does nothing
//               here either.
(function () {
  'use strict';

  const VIEWS = { '2d': '2D view', gl: '3D view' };
  const STORAGE = { saved: 'saves in this browser', memory: 'nothing is saved here', error: 'a save has failed' };
  const SUBTITLE = 'Every dumb stroke of the drowned bells wakes more of the dead.';
  // How a vigil ended, in the design's words (docs/design/01-world.md, "The frame in the fiction").
  const OUTCOMES = {
    left: { head: 'Rung down', text: 'You rang down and left by the lychgate.', kept: true },
    spared: { head: 'Spared', text: 'Tolled-for, you reached the lychgate in time. You live; your haul is lost.', kept: true },
    died: { head: 'Joined the dead', text: 'You fell, and joined the dead of the district.', kept: false },
  };
  const OVER = { head: 'Over', text: 'The night closes over the district.', kept: true };

  // ---- starting a vigil ----

  // The cfg of a vigil of the Dial as far as this build can give one, or null for the debug scene.
  function dialVigil() {
    const dial = Defs.has('zone', 'dial');
    if (dial && typeof Player.classRun === 'function' && Defs.has('class', 'change-ringer')) {
      return Object.assign({ zone: 'dial' }, Player.classRun('change-ringer'));
    }
    return dial ? { zone: 'dial' } : null;
  }

  function begin() {
    const cfg = dialVigil();
    if (cfg) Game.start(cfg); else Game.start();
  }

  // The same kind of vigil as the run that ended, with a new seed.
  function again(S) {
    const cfg = S && S.cfg;
    if (!cfg || S.debug !== null || !cfg.zone || !Defs.has('zone', cfg.zone)) {
      begin();
      return;
    }
    let next;
    if (cfg.class && typeof Player.classRun === 'function' && Defs.has('class', cfg.class)) {
      next = Object.assign({ zone: cfg.zone }, Player.classRun(cfg.class, cfg.level));
      if (cfg.mode) next.mode = cfg.mode;
    } else {
      next = Object.assign({}, cfg);
      delete next.seed;
    }
    Game.start(next);
  }

  // ---- the title ----

  function buildLine() {
    const view = Gfx.active ? Gfx.active.name : '';
    return 'Build ' + Game.VERSION + ' · ' + (VIEWS[view] || view || 'no view') + ' · ' + (STORAGE[Store.status] || Store.status);
  }

  let stopWatching = null;   // takes the open title off Store.onStatus again

  // The way in: the Household, where a vigil is kept by one of its characters; a vigil without one in a build that
  // keeps no Household.
  function mainControl() {
    const main = { class: 'primary', dataset: { focus: '' } };
    return Game.save !== null ? UI.button('The Household', function () { Game.household(); }, main) : UI.button('Begin vigil', begin, main);
  }

  UI.screen('title', {
    back: false,
    open: function () {
      const build = UI.h('p', { class: 'ui-note' }, buildLine());
      if (stopWatching) stopWatching();
      stopWatching = Store.onStatus(function () { build.textContent = buildLine(); });
      const emblem = typeof Glyphs.icon === 'function' ? Glyphs.icon({ id: 'mark.bell', size: 72 }) : null;
      if (emblem) emblem.style.width = emblem.style.height = '100%';   // the emblem's box sizes it, in rem
      return UI.h('div', { class: 'ui-stack scr-title' },
        emblem ? UI.h('div', { class: 'scr-emblem', 'aria-hidden': 'true' }, emblem) : null,
        UI.h('h1', { class: 'ui-title' }, 'Tollbound'),
        UI.h('div', { class: 'ui-rule' }),
        UI.h('p', { class: 'ui-sub' }, SUBTITLE),
        UI.h('div', { class: 'scr-choices' },
          mainControl(),
          typeof Settings.open === 'function' ? UI.button('Settings', function () { Settings.open(); }, { class: 'second' }) : null),
        build);
    },
    close: function () {
      if (stopWatching) stopWatching();
      stopWatching = null;
    },
  });

  // ---- the results ----

  function clock(seconds) {
    const s = Math.max(0, Math.floor(seconds || 0)), rest = s % 60;
    return Math.floor(s / 60) + ':' + (rest < 10 ? '0' : '') + rest;
  }

  function whole(n) { return typeof n === 'number' && n === n ? String(Math.floor(n)) : '0'; }

  // A cell of the tally: its label over its number. The space between them keeps "Time 4:03" one phrase in the text.
  function cell(label, value, kind) {
    return UI.h('div', { class: ['scr-cell', kind ? 'is-' + kind : ''], dataset: { tally: label.toLowerCase() } },
      UI.h('span', { class: 'scr-k' }, label), ' ', UI.h('span', { class: 'scr-v' }, value));
  }

  // "The Dial" -> "the Dial", for the middle of a sentence.
  function placeName(zone) {
    const name = zone && typeof zone.name === 'string' ? zone.name : 'the district';
    return /^The /.test(name) ? 'the ' + name.slice(4) : name;
  }

  const nameOfClass = (id) => (typeof id === 'string' && Defs.has('class', id) ? Defs.get('class', id).name : '');
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);

  // Who kept the vigil: a character (from the report of its end), else the class of a run without one.
  function keptBy(S, rep) {
    if (!rep) return nameOfClass(S && S.cfg ? S.cfg.class : null);
    let text = rep.name + ', ' + (nameOfClass(rep.class) || rep.class) + ' of level ' + rep.level;
    if (rep.rose > 0) text += ', ' + plural(rep.rose, 'level', 'levels') + ' gained';
    if (rep.death) text += '. On the Register now, and recast as a bell of ' + plural(rep.bell ? rep.bell.weight : rep.death.tolls, 'toll', 'tolls');
    return text + '.';
  }

  // The ways on: for a character that lives, back to the Lantern or down again; for one that died, the Household;
  // for a run without a character, the title or the same kind of vigil.
  function waysOn(S, rep) {
    const main = { class: 'primary', dataset: { focus: '' } };
    if (rep && rep.death === null) {
      return [UI.button('Back to the Lantern', function () { Game.lantern(rep.char); }, main),
        UI.button('Another vigil', function () { if (Game.vigil(S && S.zone ? S.zone.id : undefined) === null) Game.lantern(rep.char); }, { class: 'second' })];
    }
    if (rep) return [UI.button('To the Household', function () { Game.household(); }, main)];
    return [UI.button('Back to the title', function () { Game.title(); }, main), UI.button('Another vigil', function () { again(S); }, { class: 'second' })];
  }

  UI.screen('results', {
    back: false,
    open: function (args) {
      const S = args && args.S ? args.S : null, rep = args && args.report ? args.report : null;
      const result = (args && args.result) || (S && typeof Sim.result === 'function' ? Sim.result(S) : null) || {};
      const said = OUTCOMES[result.outcome] || OVER;
      const zone = S ? S.zone : null, who = keptBy(S, rep);
      const num = function (name, fallback) { return typeof result[name] === 'number' ? result[name] : fallback; };
      const time = num('time', S ? S.t : 0), tolls = num('tolls', S ? S.toll : 0), kills = num('kills', S ? S.kills : 0);
      const coin = num('coin', S ? S.coin : 0), banked = num('banked', S && S.bank ? S.bank.coin : 0), hum = num('hum', S ? S.hum : 0);
      const lost = result.outcome === 'died' || result.outcome === 'spared';
      return UI.h('div', { class: 'ui-panel ui-stack scr-results', dataset: { outcome: result.outcome || 'none' } },
        UI.h('p', { class: 'scr-kicker' }, 'The vigil of ' + placeName(zone)),
        UI.h('h2', { class: 'ui-heading' }, said.head),
        UI.h('p', { class: 'ui-sub scr-outcome' }, said.text),
        UI.h('div', { class: 'scr-tally' },
          cell('Time', clock(time)),
          cell('Tolls', whole(tolls)),
          cell('Laid', whole(kills)),
          cell('Coin', whole(coin), lost && coin > 0 ? 'lost' : ''),
          cell('Banked', whole(banked), banked > 0 ? 'kept' : ''),
          hum > 0 ? cell('Hum', whole(hum), 'kept') : null),
        who ? UI.h('p', { class: 'scr-meta', dataset: rep ? { char: String(rep.char) } : {} }, who) : null,
        UI.h('div', { class: 'ui-row' }, waysOn(S, rep)));
    },
  });
})();
