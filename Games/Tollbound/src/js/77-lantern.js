// 77-lantern.js: the screens of the hub (docs/design/01-world.md, "The frame in the fiction"; 04-progression.md): the
// Lantern, where a character stands between vigils; the Household, where one is chosen or made; and three of the
// Lantern's rooms: the Bellframe, the Register and the bequests. Registered while this file loads, before 90-game.js
// boots, so that the stand-ins 'lantern' and 'household' give way. The Lantern's own music, plain hunt on hand-bells,
// plays while the hub is open. css/43-lantern.css styles what is theirs (lt-*, bf-*); the rest is the classes of
// css/10-ui.css. Every control is at least 44 px; text is in rem, so "Text and controls" scales it; keys and a pad move
// focus through UI.nav, UI.activate and UI.back.
// Owns: (none)
// Public: no functions. It registers, with UI.screen:
//   'household'  the Household's coin, Hum, standing and dead (once there is any), and the bequests a death's vigil met;
//                the standing characters, each a control that opens the Lantern with it (its text begins with the name,
//                then class, level and tolls; focus starts on the first); a new character: its name (the first text
//                field, data-field "name"), its class when more than one is open, the hung bells it will ring (as many
//                as the ringing places, the heaviest chosen first; each a switch, with the true ring the chosen make),
//                and the control that makes it (data-make; focus starts there while nobody stands); the Register
//                (.game-register, one .game-dead for each death, naming what killed it; a dead character has no
//                control); "Save text" (the stand-in 'save-text' of 90-game.js); back to the title
//   'lantern'    opened with {char}: its name (the first heading), class and level and the experience to the next, its
//                mourning, the bequests its last vigil met; the way down, "Go down to the Dial" (Game.vigil; focus
//                starts on it), then a control for each room of Game.ROOMS that is registered, each opened with {char};
//                its sheet from Char.sheet (life, Heed, the attributes, speed, Brace and Stride, points of the Plan),
//                what the Bellframe gives it; the Household's coin and Hum, its tolls and vigils; "The Household"
//   'bellframe'  opened with {char}: the frame that hangs below the Lantern, drawn as the timber frame of a belfry:
//                its pits in three tiers of bays, open or boarded, the bells of the dead hung in them, the iron straps
//                that join each pit to the one it opens from, and below the ringing floor with a rope for each ringing
//                place. A pit, the floor or a bell waiting to be hung is chosen by touch or focus, and what is chosen
//                is told under the frame with what can be done: open a pit (Bellframe.open), buy a ringing place
//                (Bellframe.place), hang a bell (Bellframe.hang), recast a gift (Bellframe.recast); the save is
//                written after each (Game.write)
//   'register'   opened with {char}: the head start the Register gives (Progress.headStart) and every death, newest
//                first, with what killed it from its cause, where and when, and the bell it became
//   'bequests'   opened with {char}: the bequests, the character's own and the Household's, each with its wish, how far
//                it has come (Progress.status) and what it leaves; a sealed one only once it is met, and one that asks
//                for another class not among the character's own
// And with Music.define, the piece 'lantern', played on the notice 'state' for 'household' and 'lantern'.
(function () {
  'use strict';

  const h = UI.h;
  const NS = 'http://www.w3.org/2000/svg';
  const FIRST_ZONE = 'dial';
  const ROOM_NAMES = { plan: 'The Plan', finds: 'Finds', voices: 'Voices', bellframe: 'The Bellframe', register: 'The Register', bequests: 'Bequests' };
  const KIND_WORD = { blow: 'Blow', drag: 'Drag', swell: 'Swell' };
  const MONEY = (n) => String(Math.floor(n + 1e-9));

  // ---- words ----

  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
  const nameOfClass = (id) => (typeof id === 'string' && Defs.has('class', id) ? Defs.get('class', id).name : 'Ringer');
  function zonePhrase(id) {
    const name = typeof id === 'string' && Defs.has('zone', id) ? Defs.get('zone', id).name : 'the district';
    return /^The /.test(name) ? 'the ' + name.slice(4) : name;
  }
  function ordinal(n) {
    const t = n % 100, u = n % 10;
    return n + (t >= 11 && t <= 13 ? 'th' : u === 1 ? 'st' : u === 2 ? 'nd' : u === 3 ? 'rd' : 'th');
  }
  const withArticle = (name) => (/^the /i.test(name) ? name : (/^[aeiou]/i.test(name) ? 'an ' : 'a ') + name);

  // the body whose attack it was, or null
  function bodyOf(attack) {
    if (typeof attack !== 'string') return null;
    const bodies = Defs.all('enemy').concat(Defs.all('boss'));
    for (let i = 0; i < bodies.length; i++) {
      const own = bodies[i].attacks;
      for (let k = 0; k < own.length; k++) if ((typeof own[k] === 'string' ? own[k] : own[k].id) === attack) return bodies[i];
    }
    return null;
  }

  // what killed a character, in words: "a Lumper's Swell", or the kind of harm when no attack did it
  function killer(cause) {
    const body = cause ? bodyOf(cause.attack) : null, kind = cause ? KIND_WORD[cause.kind] || 'Blow' : 'Blow';
    if (body !== null) return withArticle(body.name) + '’s ' + kind;
    return cause && cause.kind === 'drag' ? 'the press of the dead' : 'a ' + kind + ' of the dead';
  }

  // a modifier in words: "+6 greatest life", "+5% harm while you move"
  const SAY = {
    'life-max': ['greatest life', ''], 'heed-max': ['Heed', ''], 'guard.blow': ['Brace against Blows', '%'], 'guard.drag': ['Stride against Drag', '%'],
    'move-speed': ['speed on foot', ' m/s'], 'mend-rate': ['mending', '%'], damage: ['harm', '%'], speed: ['voices’ speed', '%'],
    'coin-find': ['coin found', '%'], 'xp-gain': ['experience', '%'], 'hum-gain': ['Hum', '%'], 'find-chance': ['finds found', '%'],
    'stride-share': ['of top speed to Stride', '%'], warn: ['warning of every Swell', ' s'], 'pickup-reach': ['reach for what lies on the ground', ' m'],
    'turn-limit': ['turn before you are Wrong-footed', '°'], 'wrong-foot': ['harm to the Wrong-footed', '%'], 'brace-time': ['before Brace holds', ' s'],
    'wake-lag': ['lag of the dead behind you', ' s'], 'procession-bonus': ['harm to those In Procession', '%'], 'wound-term': ['before a wound scars', ' s'],
    knee: ['Knee', ''], heel: ['Heel', ''], hand: ['Hand', ''], ear: ['Ear', ''],
  };
  const TAG_SAY = { moving: 'while you move', still: 'while you stand still', round: 'of voices round you', timed: 'on the quarters', held: 'of voices that last' };
  // a signed number as a player reads it: whole from 10 up, one place from 1, two below
  function num(v) {
    const a = Math.abs(v), r = a >= 10 ? Math.round(a) : a >= 1 ? Math.round(a * 10) / 10 : Math.round(a * 100) / 100;
    return (v < 0 ? '−' : '+') + String(r);
  }
  function sayMod(m) {
    const row = SAY[m.stat], v = Array.isArray(m.value) ? m.value[0] : m.value;
    if (!row || typeof v !== 'number') return null;
    let text = num(v) + (m.op === 'inc' ? '%' : row[1]) + ' ' + row[0];
    if (Array.isArray(m.tags)) for (let i = 0; i < m.tags.length; i++) if (TAG_SAY[m.tags[i]]) text += ' ' + TAG_SAY[m.tags[i]];
    return text;
  }
  const sayMods = (mods) => mods.map(sayMod).filter(Boolean).join(', ');

  // ---- drawing ----

  function svg(tag, attrs) {
    const el = document.createElementNS(NS, tag);
    for (const k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) el.setAttribute(k, attrs[k]);
    for (let i = 2; i < arguments.length; i++) if (arguments[i]) el.appendChild(arguments[i]);
    return el;
  }
  const f2 = (n) => (Math.round(n * 100) / 100).toString();

  // a bell from the side, mouth down, in a box w x hh whose top middle is (cx, y): bronze, lit from the left
  function bellArt(cx, y, w, hh, cls) {
    const X = (u) => f2(cx + (u - 0.5) * w), Y = (v) => f2(y + v * hh), P = (u, v) => X(u) + ' ' + Y(v);
    const body = 'M' + P(0.36, 0.06) + 'Q' + P(0.5, 0) + ' ' + P(0.64, 0.06) + 'C' + P(0.72, 0.1) + ' ' + P(0.7, 0.45) + ' ' + P(0.76, 0.68) +
      'C' + P(0.8, 0.82) + ' ' + P(0.92, 0.86) + ' ' + P(0.96, 0.93) + 'L' + P(0.04, 0.93) + 'C' + P(0.08, 0.86) + ' ' + P(0.2, 0.82) + ' ' + P(0.24, 0.68) +
      'C' + P(0.3, 0.45) + ' ' + P(0.28, 0.1) + ' ' + P(0.36, 0.06) + 'Z';
    const shade = 'M' + P(0.57, 0.035) + 'Q' + P(0.6, 0.04) + ' ' + P(0.64, 0.06) + 'C' + P(0.72, 0.1) + ' ' + P(0.7, 0.45) + ' ' + P(0.76, 0.68) +
      'C' + P(0.8, 0.82) + ' ' + P(0.92, 0.86) + ' ' + P(0.96, 0.93) + 'L' + P(0.62, 0.93) + 'C' + P(0.62, 0.6) + ' ' + P(0.6, 0.3) + ' ' + P(0.57, 0.035) + 'Z';
    return svg('g', { class: cls || 'lt-bell' },
      svg('path', { d: body, class: 'lt-bell-body' }),
      svg('path', { d: shade, class: 'lt-bell-shade' }),
      svg('line', { x1: X(0.1), y1: Y(0.87), x2: X(0.9), y2: Y(0.87), class: 'lt-bell-bow' }),
      svg('circle', { cx: X(0.5), cy: Y(0.985), r: f2(w * 0.05), class: 'lt-bell-clapper' }));
  }

  // the Lantern: a glazed lantern on the top of the tower, lit
  function lanternArt() {
    const glow = [];
    for (let i = 0; i < 4; i++) glow.push(svg('circle', { cx: 32, cy: 34, r: 30 - i * 6, class: 'lt-glow' }));
    return svg('svg', { viewBox: '0 0 64 64', class: 'lt-emblem', 'aria-hidden': 'true', focusable: 'false' },
      svg('g', null, ...glow),
      svg('path', { d: 'M14 64 L18 52 L46 52 L50 64 Z', class: 'lt-stone' }),
      svg('rect', { x: 15, y: 50, width: 34, height: 3, class: 'lt-oak' }),
      svg('rect', { x: 21, y: 25, width: 22, height: 25, class: 'lt-pane' }),
      svg('rect', { x: 21, y: 25, width: 7, height: 25, class: 'lt-pane-lit' }),
      svg('line', { x1: 28, y1: 25, x2: 28, y2: 50, class: 'lt-mullion' }),
      svg('line', { x1: 36, y1: 25, x2: 36, y2: 50, class: 'lt-mullion' }),
      svg('circle', { cx: 32, cy: 41, r: 3.2, class: 'lt-flame' }),
      svg('path', { d: 'M17 26 L32 11 L47 26 Z', class: 'lt-roof' }),
      svg('path', { d: 'M32 11 L47 26 L36 26 Z', class: 'lt-roof-shade' }),
      svg('circle', { cx: 32, cy: 9, r: 2.4, class: 'lt-oak' }));
  }

  // ---- shared pieces of the screens ----

  function cell(label, value, key) {
    return h('div', { class: 'lt-cell', dataset: { tally: key || label.toLowerCase() } }, h('span', { class: 'lt-k' }, label), ' ', h('span', { class: 'lt-v' }, value));
  }

  // What happened at the end of the last vigil, kept until a hub screen has told it once
  let told = null;
  Plat.on('state', function (state) { if (state === 'results') told = Game.report; });

  function metLine(list, lead) {
    const names = (list || []).filter((id) => Defs.has('bequest', id)).map((id) => Defs.get('bequest', id).name);
    return names.length ? h('p', { class: 'lt-met', role: 'status' }, lead + ' ' + names.join(', ') + '.') : null;
  }

  // ---- the Household ----

  const hungBells = (save) => save.account.frame.bells.filter((b) => b.pit !== null).sort((a, b) => b.weight - a.weight || a.uid - b.uid);

  function deathLine(d) {
    const how = d.how === 'retired' ? 'Retired, and recast as a bell.'
      : 'Killed by ' + killer(d.cause) + ' in ' + zonePhrase(d.zone) + ', at the ' + ordinal(Math.max(1, d.toll)) + ' toll.';
    return h('li', { class: 'game-dead lt-dead', dataset: { char: String(d.uid) } },
      h('span', { class: 'lt-dead-name' }, d.name), ' ',
      h('span', { class: 'lt-dead-line' }, nameOfClass(d.class) + ' of level ' + d.level + '. ' + how));
  }

  UI.screen('household', {
    back: function () { Game.title(); },
    open: function () {
      const save = Game.save;
      if (!save) {
        return h('div', { class: 'ui-panel ui-stack lt-household game-household' }, h('h2', { class: 'ui-heading' }, 'The Household'),
          h('p', { class: 'ui-sub' }, 'This build keeps no Household.'), UI.button('Back', function () { Game.title(); }, { class: 'primary' }));
      }
      const living = save.chars.map(function (c, i) {
        const grief = Char.mourning(c);
        const attrs = { class: 'game-pick lt-char', dataset: Object.assign({ char: String(c.uid) }, i === 0 ? { focus: '' } : {}) };
        return UI.button([h('span', { class: 'lt-char-name' }, c.name), ' ', h('span', { class: 'lt-char-line' }, nameOfClass(c.class) + ', level ' + c.level +
          ' · ' + plural(c.tolls, 'toll', 'tolls') + (grief ? ' · in ' + grief + ' mourning' : ''))], function () { Game.lantern(c.uid); }, attrs);
      });
      // a new character
      const field = h('input', { type: 'text', class: 'game-field lt-field', maxlength: '24', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Name',
        value: 'Ringer ' + (save.chars.length + save.register.length + 1), dataset: { field: 'name' } });
      const classes = Char.classes(save);
      let chosen = classes.length > 0 ? classes[0] : null;
      const places = save.account.frame.places, hung = hungBells(save), ring = hung.slice(0, places).map((b) => b.uid);
      const ringNote = h('p', { class: 'ui-note lt-ring-note' });
      const toggles = hung.map(function (b) {
        const t = UI.button([h('span', { class: 'lt-toggle-name' }, b.name), ' ', h('span', { class: 'lt-toggle-line' }, nameOfClass(b.class) + ' · ' + plural(b.weight, 'toll', 'tolls') +
          (b.gift && Defs.has('gift', b.gift) ? ' · ' + Defs.get('gift', b.gift).name + ', level ' + Bellframe.level(b) : ''))], function () {
          const at = ring.indexOf(b.uid);
          if (at >= 0) ring.splice(at, 1);
          else if (ring.length < places) ring.push(b.uid);
          else { UI.toast('Every ringing place is taken: let one bell go first.'); return; }
          shown();
        }, { class: 'lt-toggle', dataset: { bell: String(b.uid) } });
        return t;
      });
      function shown() {
        for (const t of toggles) t.setAttribute('aria-pressed', ring.indexOf(Number(t.dataset.bell)) >= 0 ? 'true' : 'false');
        const pairs = ring.length > 1 ? Char.trueRing(ring.map((u) => hung.find((b) => b.uid === u).weight)) : 0;
        const numbers = Defs.has('bellframe', 'main') ? Defs.get('bellframe', 'main') : { trueGain: 5 };
        ringNote.textContent = 'Rings ' + ring.length + ' of ' + plural(places, 'place', 'places') + (pairs > 0 ? ' · ' + plural(pairs, 'pair rings', 'pairs ring') +
          ' true: +' + pairs * numbers.trueGain + '% to every gift' : '');
      }
      shown();
      const make = function () {
        const made = chosen === null ? null : Game.make(chosen, field.value, ring.slice());
        if (made === null) UI.toast('A name of 1 to 24 letters is needed.');
        else Game.lantern(made.uid);
      };
      field.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); make(); } });
      const pick = classes.length > 1 ? h('div', { class: 'ui-row lt-classes' }, classes.map(function (id) {
        const b = UI.button(nameOfClass(id), function () {
          chosen = id;
          for (const other of b.parentNode.children) { other.classList.toggle('primary', other === b); other.classList.toggle('second', other !== b); }
          makeBtn.textContent = 'Make a ' + nameOfClass(id);
        }, { class: id === chosen ? 'primary' : 'second', dataset: { class: id } });
        return b;
      })) : null;
      const makeBtn = UI.button(chosen === null ? 'No class is open' : 'Make a ' + nameOfClass(chosen), make,
        { class: living.length ? 'second lt-make-btn' : 'primary lt-make-btn', disabled: chosen === null, dataset: Object.assign({ make: '' }, living.length ? {} : { focus: '' }) });
      const waiting = save.account.frame.bells.length - hung.length;
      const bells = hung.length ? h('div', { class: 'lt-bells' }, h('p', { class: 'ui-note' }, 'The bells it will ring'), toggles, ringNote)
        : save.account.frame.bells.length ? h('p', { class: 'ui-note lt-ring-note' }, plural(waiting, 'bell waits', 'bells wait') +
          ' in the Bellframe to be hung. Only a hung bell can be rung.') : null;
      const dead = save.register.slice().reverse().map(deathLine);
      const met = told && told.death ? metLine(told.bequests, 'Met in the last vigil, for the Household:') : null;
      if (told && told.death) told = null;
      return h('div', { class: 'ui-panel lt-household game-household' },
        h('div', { class: 'ui-stack lt-head' },
          h('p', { class: 'lt-kicker' }, 'The Lantern'),
          h('h2', { class: 'ui-heading' }, 'The Household'),
          h('p', { class: 'ui-sub' }, living.length ? 'Choose who goes down tonight.' : 'Nobody stands in the Household yet.'),
          living.length || dead.length ? h('div', { class: 'lt-tally' }, cell('Coin', MONEY(save.account.coin)), cell('Hum', MONEY(save.account.hum)),
            cell('Standing', String(save.chars.length)), cell('Dead', String(save.register.length))) : null,
          met),
        h('div', { class: 'ui-stack lt-col' },
          living.length ? h('div', { class: 'ui-stack game-list lt-list' }, living) : null,
          h('div', { class: 'ui-stack game-make lt-make' }, h('label', { class: 'ui-note' }, 'A new character'), field, pick, bells, makeBtn)),
        h('div', { class: 'ui-stack lt-col' },
          dead.length ? h('div', { class: 'ui-stack lt-register-box' }, h('p', { class: 'ui-note' }, 'The Register'), h('ul', { class: 'game-register lt-register' }, dead))
            : h('p', { class: 'ui-note' }, 'The Register is empty: nobody of the Household has died.'),
          h('div', { class: 'ui-row lt-foot' },
            UI.button('Save text', function () { UI.open('save-text'); }, { class: 'second' }),
            UI.button('Back', function () { Game.title(); }, { class: 'second' }))));
    },
  });

  // ---- the Lantern ----

  let live = null;                       // the Lantern open now: {refresh()}, so a room that closes over it is told

  function sheetCells(c, account) {
    const sheet = Char.sheet(c, account), s = sheet.stats, heed = Char.heed(c, account), pts = Char.points(c);
    const guard = (kind) => Math.round(sheet.guard[Stats.TYPE[kind]]) + '%';
    return [
      cell('Life', String(Math.round(s['life-max'])), 'life'),
      cell('Heed', heed.held > 0 ? Math.round(heed.free) + '/' + Math.round(heed.max) : String(Math.round(heed.max)), 'heed'),
      cell('Knee', String(Math.round(s.knee))), cell('Heel', String(Math.round(s.heel))), cell('Hand', String(Math.round(s.hand))), cell('Ear', String(Math.round(s.ear))),
      cell('Speed', s['move-speed'].toFixed(1) + ' m/s', 'speed'), cell('Brace', guard('blow'), 'brace'), cell('Stride', guard('drag'), 'stride'),
      cell('Plan', pts.free + ' free', 'plan'),
    ];
  }

  // what the Bellframe gives a character, a short line for each source
  function giving(c, account) {
    const lines = [], frame = account.frame;
    for (let i = 0; i < frame.pits.length; i++) {
      if (!Defs.has('pit', frame.pits[i])) continue;
      const pit = Defs.get('pit', frame.pits[i]), said = sayMods(pit.grant);
      if (said) lines.push(h('li', { dataset: { pit: pit.id } }, h('b', null, pit.name), ' ' + said));
    }
    const ring = Bellframe.ring(account, c);
    for (let i = 0; i < ring.bells.length; i++) {
      const b = ring.bells[i];
      if (b.gift === null || !Defs.has('gift', b.gift)) continue;
      const g = Defs.get('gift', b.gift), level = Bellframe.level(b), k = ring.gain * (b.double ? 2 : 1);
      const said = sayMods(Stats.resolve(g.mods, level).map((m) => Object.assign({}, m, { value: m.value * k })));
      lines.push(h('li', { dataset: { bell: String(b.uid) } }, h('b', null, b.name + '’s bell'), ' ' + g.name + ', level ' + level + ': ' + said));
    }
    if (ring.pairs > 0) lines.push(h('li', null, h('b', null, 'A true ring'), ' ' + plural(ring.pairs, 'pair', 'pairs') + ': +' + Math.round((ring.gain - 1) * 100) + '% to every gift'));
    return lines;
  }

  UI.screen('lantern', {
    back: function () { Game.household(); },
    open: function (args) {
      const save = Game.save, c = (args && args.char) || Game.char;
      if (!c || !save) return h('div', { class: 'ui-panel ui-stack lt-lantern' }, UI.button('The Household', function () { Game.household(); }, { class: 'primary', dataset: { focus: '' } }));
      const fresh = function () { return Char.find(save, c.uid) || c; };
      const need = Char.need(c), xp = need === Infinity ? 'the most there is' : Math.floor(c.xp) + ' of ' + Math.round(need) + ' to the next';
      const grief = Char.mourning(c);
      const mourning = grief ? h('p', { class: 'lt-mourning' }, 'In ' + grief + ' mourning: ' + plural(c.mourning.left, 'vigil', 'vigils') + ' left. ' +
        (grief === 'full' ? '+50% Hum, and no coin is picked up.' : '+25% Hum.')) : null;
      const met = told && told.char === c.uid && told.death === null ? metLine(told.bequests, 'Met in your last vigil:') : null;
      if (told && told.char === c.uid) told = null;
      const rooms = Game.ROOMS.filter((id) => UI.has(id)).map(function (id) {
        return UI.button(ROOM_NAMES[id] || id, function () { UI.open(id, { char: fresh() }); }, { class: 'second lt-room', dataset: { room: id } });
      });
      const sheet = h('div', { class: 'lt-sheet' }), gives = h('ul', { class: 'lt-gives' }), tally = h('div', { class: 'lt-tally' });
      const refresh = function () {
        const now = fresh();
        sheet.replaceChildren(...sheetCells(now, save.account));
        gives.replaceChildren(...giving(now, save.account));
        tally.replaceChildren(cell('Coin', MONEY(save.account.coin)), cell('Hum', MONEY(save.account.hum)), cell('Tolls', String(now.tolls)), cell('Vigils', String(now.vigils)));
      };
      refresh();
      live = { refresh };
      return h('div', { class: 'ui-panel lt-lantern game-lantern', dataset: { char: String(c.uid) } },
        h('div', { class: 'lt-side ui-stack' },
          h('div', { class: 'lt-crown' }, lanternArt()),
          h('p', { class: 'lt-kicker' }, 'The Lantern'),
          h('h2', { class: 'ui-heading' }, c.name),
          h('p', { class: 'ui-sub' }, nameOfClass(c.class) + ', level ' + c.level + ' · ' + xp),
          mourning, met,
          UI.button('Go down to ' + zonePhrase(FIRST_ZONE), function () { Game.vigil(FIRST_ZONE); }, { class: 'primary lt-down', dataset: { focus: '', vigil: FIRST_ZONE } }),
          rooms.length ? h('div', { class: 'lt-rooms' }, rooms) : null),
        h('div', { class: 'lt-side ui-stack' },
          h('p', { class: 'ui-note' }, 'Its sheet between vigils'),
          sheet,
          gives,
          tally,
          UI.button('The Household', function () { Game.household(); }, { class: 'second lt-wide' })));
    },
    close: function () { live = null; },
  });

  // a room closed over the Lantern may have changed the save: the Lantern tells it again
  Plat.on('ui', function (what, id) { if (what === 'close' && live !== null && Game.ROOMS.indexOf(id) >= 0 && UI.top() === 'lantern') live.refresh(); });

  // ---- the Bellframe ----

  const FRAME_W = 100, FRAME_H = 106, BAY = 18, LEFT = 5, TIER = 26, FOOT = 64, BAY_H = 24, FLOOR = 90;
  const bayLeft = (x) => LEFT + BAY * x, bayTop = (y) => FOOT - TIER * y;

  function frameNumbers() { return Defs.has('bellframe', 'main') ? Defs.get('bellframe', 'main') : null; }

  // the timber frame, the walls, the straps between pits and the ringing floor: what lies behind the bays
  function frameArt(save, chosen) {
    const pits = Defs.all('pit'), open = save.account.frame.pits, parts = [];
    parts.push(svg('rect', { x: 0, y: 0, width: FRAME_W, height: FRAME_H, class: 'bf-shaft' }));
    // the light of the Lantern above, falling through the hatch in the ceiling of the belfry
    parts.push(svg('path', { d: 'M38 0 L62 0 L74 10 L26 10 Z', class: 'bf-light' }), svg('path', { d: 'M43 0 L57 0 L64 10 L36 10 Z', class: 'bf-light' }),
      svg('rect', { x: 38, y: 0, width: 24, height: 1.2, class: 'bf-hatch' }));
    for (const x of [0, 96]) {
      parts.push(svg('rect', { x, y: 0, width: 4, height: FRAME_H, class: 'bf-wall' }));
      for (let y = 6; y < FRAME_H; y += 8) parts.push(svg('line', { x1: x, y1: y, x2: x + 4, y2: y, class: 'bf-mortar' }));
    }
    // each tier: a sill under it and a head over it, a post at each side of each bay
    for (let tier = 0; tier < 3; tier++) {
      const row = pits.filter((p) => p.y === tier);
      if (!row.length) continue;
      const from = Math.min(...row.map((p) => bayLeft(p.x))), to = Math.max(...row.map((p) => bayLeft(p.x) + BAY)), top = bayTop(tier);
      parts.push(svg('rect', { x: from - 1, y: top + BAY_H, width: to - from + 2, height: 2, class: 'bf-beam' }));
      parts.push(svg('rect', { x: from - 1, y: top - 2, width: to - from + 2, height: 2, class: 'bf-beam' }));
      for (const p of row) for (const x of [bayLeft(p.x), bayLeft(p.x) + BAY]) parts.push(svg('rect', { x: x - 1, y: top, width: 2, height: BAY_H, class: 'bf-post' }));
    }
    // the iron straps: one between each pit and the pit it opens from, across the timber they share
    for (const p of pits) {
      if (p.from === null || !Defs.has('pit', p.from)) continue;
      const f = Defs.get('pit', p.from), a = open.indexOf(p.id) >= 0, b = open.indexOf(f.id) >= 0;
      const state = a && b ? 'bf-strap is-open' : b ? 'bf-strap is-next' : 'bf-strap';
      if (f.y === p.y) {
        const x = bayLeft(Math.max(f.x, p.x)), y = bayTop(p.y) + BAY_H / 2;
        parts.push(svg('rect', { x: x - 2.4, y: y - 1.1, width: 4.8, height: 2.2, class: state }), svg('circle', { cx: x - 1.4, cy: y, r: 0.45, class: 'bf-rivet' }),
          svg('circle', { cx: x + 1.4, cy: y, r: 0.45, class: 'bf-rivet' }));
      } else {
        const lower = f.y < p.y ? f : p, upper = f.y < p.y ? p : f;
        const x = (bayLeft(lower.x) + bayLeft(upper.x)) / 2 + BAY / 2, y = bayTop(lower.y) - 1;
        parts.push(svg('rect', { x: x - 1.1, y: y - 2.6, width: 2.2, height: 5.2, class: state }), svg('circle', { cx: x, cy: y - 1.6, r: 0.45, class: 'bf-rivet' }),
          svg('circle', { cx: x, cy: y + 1.6, r: 0.45, class: 'bf-rivet' }));
      }
    }
    // the ringing floor: a rope for each place bought, a hole for each still to buy
    const n = frameNumbers(), most = n ? n.placesMost : 8, places = save.account.frame.places;
    parts.push(svg('rect', { x: 4, y: FLOOR - 2, width: 92, height: 2, class: 'bf-beam' }));
    parts.push(svg('rect', { x: 4, y: FLOOR, width: 92, height: FRAME_H - FLOOR, class: chosen === 'floor' ? 'bf-floor is-chosen' : 'bf-floor' }));
    for (let i = 0; i < most; i++) {                // the ropes hang over the left of the floor; its right tells the count
      const x = 10 + i * (64 / Math.max(1, most - 1));
      if (i < places) {
        parts.push(svg('line', { x1: x, y1: FLOOR, x2: x, y2: FLOOR + 11, class: 'bf-rope' }));
        parts.push(svg('rect', { x: x - 1.2, y: FLOOR + 6, width: 2.4, height: 1.4, class: 'bf-sally-a' }), svg('rect', { x: x - 1.2, y: FLOOR + 7.4, width: 2.4, height: 1.4, class: 'bf-sally-b' }),
          svg('rect', { x: x - 1.2, y: FLOOR + 8.8, width: 2.4, height: 1.4, class: 'bf-sally-c' }));
      } else {
        parts.push(svg('circle', { cx: x, cy: FLOOR + 2.2, r: 1, class: 'bf-hole' }));
      }
    }
    return svg('svg', { viewBox: '0 0 ' + FRAME_W + ' ' + FRAME_H, class: 'bf-art', 'aria-hidden': 'true', focusable: 'false', preserveAspectRatio: 'none' }, ...parts);
  }

  // what a bay shows: boards over a closed pit, an empty headstock, or the bell that hangs there
  function bayArt(save, pit, heaviest) {
    const open = save.account.frame.pits.indexOf(pit.id) >= 0, bell = open ? Bellframe.hung(save, pit.id) : null, parts = [];
    if (!open) {
      for (let y = 2; y < 22; y += 4.2) parts.push(svg('rect', { x: 0.6, y, width: 14.8, height: 3.2, class: 'bf-board' }));
    } else {
      parts.push(svg('rect', { x: 2, y: 1, width: 12, height: 1.6, class: 'bf-headstock' }));
      if (bell !== null) {
        const k = heaviest > 0 ? 0.62 + 0.38 * Math.min(1, bell.weight / heaviest) : 0.8;
        parts.push(bellArt(8, 2.4, 13.5 * k, 17 * k));
      } else {
        parts.push(svg('path', { d: 'M5 3 Q8 2 11 3 L13 16 L3 16 Z', class: 'bf-ghost' }));
      }
    }
    return svg('svg', { viewBox: '0 0 16 22', class: 'bf-bay-art', 'aria-hidden': 'true', focusable: 'false', preserveAspectRatio: 'none' }, ...parts);
  }

  function pitState(save, pit) {
    const open = save.account.frame.pits.indexOf(pit.id) >= 0;
    if (open) {
      const bell = Bellframe.hung(save, pit.id);
      return bell ? 'holds ' + bell.name + '’s bell' : 'open and empty';
    }
    return Bellframe.openable(save, pit.id) ? 'boarded: opens for ' + Bellframe.price(save, 'pit') + ' Hum' : 'boarded';
  }

  UI.screen('bellframe', {
    open: function (args) {
      const save = Game.save, c = args && args.char ? args.char : Game.char;
      const root = h('div', { class: 'ui-panel bf-screen' });
      if (!save) return root;
      const pits = Defs.all('pit');
      let chosen = null;                               // {kind: 'pit' | 'floor' | 'bell', id}
      const first = pits.find((p) => Bellframe.openable(save, p.id)) || pits.find((p) => p.from === null) || null;
      if (first) chosen = { kind: 'pit', id: first.id };

      // a change made: the save is written and the screen built afresh, with then chosen when it is given
      const write = function (done, said, then) {
        if (!done) { UI.toast(said || 'That cannot be done now.'); return; }
        if (then) chosen = then;
        Game.write();
        render(true);
      };

      // the chosen thing, told under the frame, with what can be done to it
      function detail() {
        const box = h('div', { class: 'bf-detail', 'aria-live': 'polite' }), hum = save.account.hum;
        if (chosen === null) return box;
        if (chosen.kind === 'floor') {
          const n = frameNumbers(), most = n ? n.placesMost : 8, places = save.account.frame.places, price = Bellframe.price(save, 'place');
          box.append(h('h3', { class: 'bf-title' }, 'The ringing floor'),
            h('p', { class: 'bf-text' }, 'A new character rings as many bells as the Household has ringing places. ' + places + ' of ' + most + ' ropes hang here.'));
          if (price < Infinity) {
            box.append(UI.button('Buy a ringing place for ' + price + ' Hum', function () { write(Bellframe.place(save), 'Not enough Hum.'); },
              { class: 'primary bf-act', disabled: hum < price, dataset: { action: 'place' } }));
            if (hum < price) box.append(h('p', { class: 'ui-note' }, 'The Household holds ' + MONEY(hum) + ' Hum.'));
          } else box.append(h('p', { class: 'ui-note' }, 'Every ringing place is bought.'));
          return box;
        }
        if (chosen.kind === 'pit') {
          const pit = Defs.get('pit', chosen.id), open = save.account.frame.pits.indexOf(pit.id) >= 0, bell = open ? Bellframe.hung(save, pit.id) : null;
          box.append(h('h3', { class: 'bf-title' }, pit.name), h('p', { class: 'bf-state' }, pitState(save, pit)), h('p', { class: 'bf-text' }, pit.text));
          const said = sayMods(pit.grant);
          if (said) box.append(h('p', { class: 'bf-grant' }, 'To every character: ' + said + (open ? '' : ', once it is open') + '.'));
          if (!open) {
            if (Bellframe.openable(save, pit.id)) {
              const price = Bellframe.price(save, 'pit');
              box.append(UI.button('Open it for ' + price + ' Hum', function () { write(Bellframe.open(save, pit.id), 'Not enough Hum.'); },
                { class: 'primary bf-act', disabled: hum < price, dataset: { action: 'open', pit: pit.id } }));
              if (hum < price) box.append(h('p', { class: 'ui-note' }, 'The Household holds ' + MONEY(hum) + ' Hum. Hum is heard at every toll, by the landmarks stood beside.'));
            } else if (pit.from !== null && Defs.has('pit', pit.from)) {
              box.append(h('p', { class: 'ui-note' }, 'It opens from ' + Defs.get('pit', pit.from).name + ', which is boarded still.'));
            }
          } else if (bell !== null) {
            bellInfo(box, bell);
            recasts(box, bell);
          } else {
            const waiting = save.account.frame.bells.filter((b) => b.pit === null);
            if (waiting.length === 0) box.append(h('p', { class: 'ui-note' }, 'No bell waits to be hung. The dead are recast as bells, and hung here.'));
            for (const b of waiting) {
              box.append(UI.button('Hang ' + b.name + '’s bell here (' + plural(b.weight, 'toll', 'tolls') + ')', function () { write(Bellframe.hang(save, b.uid, pit.id)); },
                { class: 'second bf-act', dataset: { action: 'hang', bell: String(b.uid), pit: pit.id } }));
            }
          }
          return box;
        }
        const bell = save.account.frame.bells.find((b) => b.uid === chosen.id);
        if (!bell) return box;
        box.append(h('h3', { class: 'bf-title' }, bell.name + '’s bell'), h('p', { class: 'bf-state' }, bell.pit === null ? 'waiting to be hung' : 'hangs in ' +
          (Defs.has('pit', bell.pit) ? Defs.get('pit', bell.pit).name : 'the frame')));
        bellInfo(box, bell);
        if (bell.pit === null) {                       // hanging first: it is what a bell waits for
          const empty = pits.filter((p) => save.account.frame.pits.indexOf(p.id) >= 0 && Bellframe.hung(save, p.id) === null);
          if (empty.length === 0) box.append(h('p', { class: 'ui-note' }, 'No open pit is empty: open another to hang it.'));
          empty.forEach(function (p, i) {
            box.append(UI.button('Hang it in ' + p.name, function () { write(Bellframe.hang(save, bell.uid, p.id), null, { kind: 'pit', id: p.id }); },
              { class: (i === 0 ? 'primary' : 'second') + ' bf-act', dataset: { action: 'hang', bell: String(bell.uid), pit: p.id } }));
          });
        }
        recasts(box, bell);
        return box;
      }

      // a bell: what it weighs, the gift it gives and at what level, the bells it rings true beside
      function bellInfo(box, bell) {
        const level = Bellframe.level(bell), gift = bell.gift && Defs.has('gift', bell.gift) ? Defs.get('gift', bell.gift) : null;
        box.append(h('p', { class: 'bf-text' }, nameOfClass(bell.class) + ', recast weighing ' + plural(bell.weight, 'toll', 'tolls') + ' of its life. Its gift works at level ' + level +
          (bell.double ? ', and rings double' : '') + '.'));
        if (gift) box.append(h('p', { class: 'bf-grant' }, gift.name + ': ' + sayMods(Stats.resolve(gift.mods, level)) + ', to whoever rings it.'));
        const others = save.account.frame.bells.filter((b) => b !== bell && b.pit !== null && Char.trueRing([b.weight, bell.weight]) === 1);
        if (others.length) box.append(h('p', { class: 'ui-note' }, 'Rings true beside ' + others.map((b) => b.name + ' (' + b.weight + ')').join(', ') + '.'));
      }

      // recasting its gift as another of its class
      function recasts(box, bell) {
        const n = frameNumbers();
        for (const id of Bellframe.gifts(bell.class)) {
          if (id === bell.gift || !n) continue;
          box.append(UI.button('Recast its gift as ' + Defs.get('gift', id).name + ' for ' + n.recast + ' Hum', function () { write(Bellframe.recast(save, bell.uid, id), 'Not enough Hum.'); },
            { class: 'second bf-act', disabled: save.account.hum < n.recast, dataset: { action: 'recast', bell: String(bell.uid), gift: id } }));
        }
      }

      const keyOf = (x) => (x === null ? null : x.kind === 'pit' ? 'pit.' + x.id : x.kind === 'bell' ? 'bell.' + x.id : 'floor');
      const detailBox = h('div', { class: 'bf-detail-box' });

      // choosing moves the marks and tells what is chosen; the controls of the frame stay as they are, so that the
      // control under a finger or the focus is never taken away from it
      function choose(next) {
        if (keyOf(next) === keyOf(chosen)) return;
        chosen = next;
        const key = keyOf(chosen);
        for (const el of root.querySelectorAll('.bf-pit, .bf-floor-btn, .bf-waiting-btn')) el.classList.toggle('is-chosen', el.dataset.key === key);
        const floor = root.querySelector('rect.bf-floor');
        if (floor) floor.classList.toggle('is-chosen', key === 'floor');
        detailBox.replaceChildren(detail());
      }

      // the whole screen, built afresh: when it opens, and after something was done
      function render(after) {
        const heaviest = save.account.frame.bells.reduce((m, b) => Math.max(m, b.weight), 0);
        const tower = h('div', { class: 'bf-tower', style: { '--bf-ratio': FRAME_W + ' / ' + FRAME_H } }, frameArt(save, chosen && chosen.kind === 'floor' ? 'floor' : null));
        for (const pit of pits) {
          const open = save.account.frame.pits.indexOf(pit.id) >= 0, next = !open && Bellframe.openable(save, pit.id), bell = open ? Bellframe.hung(save, pit.id) : null;
          const left = bayLeft(pit.x) + 1, top = bayTop(pit.y) + 1, rung = bell && c && c.bells.indexOf(bell.uid) >= 0;
          const label = next ? h('span', { class: 'bf-price' }, String(Bellframe.price(save, 'pit')), h('small', null, 'Hum'))
            : bell ? h('span', { class: 'bf-name' }, bell.name.split(' ')[0]) : null;
          const b = UI.button([bayArt(save, pit, heaviest), label], function () { choose({ kind: 'pit', id: pit.id }); }, {
            class: ['bf-pit', open ? 'is-open' : 'is-shut', next ? 'is-next' : '', bell ? 'is-hung' : '', rung ? 'is-rung' : '',
              chosen && chosen.kind === 'pit' && chosen.id === pit.id ? 'is-chosen' : ''],
            style: { left: left + '%', top: (top / FRAME_H * 100) + '%', width: (BAY - 2) + '%', height: ((BAY_H - 2) / FRAME_H * 100) + '%' },
            'aria-label': pit.name + ': ' + pitState(save, pit), dataset: { pit: pit.id, key: 'pit.' + pit.id },
          });
          b.addEventListener('focus', function () { choose({ kind: 'pit', id: pit.id }); });
          tower.appendChild(b);
        }
        const most = frameNumbers() ? frameNumbers().placesMost : 8;
        const floor = UI.button(h('span', { class: 'bf-floor-label' }, h('small', null, 'Places'), save.account.frame.places + ' of ' + most), function () { choose({ kind: 'floor' }); }, {
          class: ['bf-floor-btn', chosen && chosen.kind === 'floor' ? 'is-chosen' : ''], style: { top: (FLOOR / FRAME_H * 100) + '%', height: ((FRAME_H - FLOOR) / FRAME_H * 100) + '%' },
          'aria-label': 'The ringing floor: ' + save.account.frame.places + ' ringing places', dataset: { key: 'floor' },
        });
        floor.addEventListener('focus', function () { choose({ kind: 'floor' }); });
        tower.appendChild(floor);
        const waiting = save.account.frame.bells.filter((b) => b.pit === null).map(function (b) {
          const btn = UI.button([svg('svg', { viewBox: '0 0 16 16', class: 'bf-mini', 'aria-hidden': 'true', focusable: 'false' }, bellArt(8, 1, 13, 14)),
            h('span', null, b.name + ' · ' + b.weight)], function () { choose({ kind: 'bell', id: b.uid }); },
          { class: ['second', 'bf-waiting-btn', chosen && chosen.kind === 'bell' && chosen.id === b.uid ? 'is-chosen' : ''], dataset: { bell: String(b.uid), key: 'bell.' + b.uid } });
          btn.addEventListener('focus', function () { choose({ kind: 'bell', id: b.uid }); });
          return btn;
        });
        detailBox.replaceChildren(detail());
        const ring = c ? Bellframe.ring(save.account, c) : null;
        root.replaceChildren(
          h('div', { class: 'ui-stack bf-head' },
            h('p', { class: 'lt-kicker' }, 'Below the Lantern'),
            h('h2', { class: 'ui-heading' }, 'The Bellframe'),
            h('div', { class: 'lt-tally' }, cell('Hum', MONEY(save.account.hum)), cell('Heard', MONEY(save.account.heard)),
              cell('Pits', save.account.frame.pits.length + ' of ' + pits.length, 'pits'), cell('Places', String(save.account.frame.places), 'places'))),
          h('div', { class: 'bf-left' }, tower,
            ring && ring.bells.length ? h('p', { class: 'ui-note bf-rings' }, c.name + ' rings ' + ring.bells.map((b) => b.name).join(', ') +
              (ring.pairs ? ': ' + plural(ring.pairs, 'pair', 'pairs') + ' true' : '') + '.') : null),
          h('div', { class: 'bf-right ui-stack' }, detailBox,
            waiting.length ? h('div', { class: 'bf-waiting' }, h('p', { class: 'ui-note' }, 'Waiting to be hung'), waiting) : null),
          h('div', { class: 'ui-row lt-foot bf-foot' }, UI.button('Back to the Lantern', function () { UI.back(); }, { class: 'second', dataset: { key: 'back' } })));
        // after something was done, focus goes on to what can be done next, else back to what is chosen
        const next = after ? root.querySelector('.bf-act:not([disabled])') || root.querySelector('[data-key="' + keyOf(chosen) + '"]') : null;
        if (next && root.isConnected) next.focus({ preventScroll: true });
      }

      render(false);
      const focusFirst = root.querySelector('[data-key="' + keyOf(chosen) + '"]');
      if (focusFirst) focusFirst.dataset.focus = '';
      return root;
    },
  });

  // ---- the Register ----

  UI.screen('register', {
    open: function () {
      const save = Game.save;
      const head = save ? Progress.headStart(save) : [];
      const warned = head.map(function (w) {
        const body = bodyOf(w.attack), what = body ? withArticle(body.name) + '’s ' + (KIND_WORD[w.kind] || 'harm') : 'an attack of the dead';
        return h('li', { class: 'lt-warned', dataset: { attack: w.attack } }, h('b', null, what.charAt(0).toUpperCase() + what.slice(1)),
          ' shows ' + w.seconds.toFixed(2) + ' s sooner (' + plural(w.deaths, 'death', 'deaths') + (w.deaths >= 3 ? ', the most it counts' : '') + ')');
      });
      const deaths = save ? save.register.slice().reverse().map(function (d) {
        const bell = save.account.frame.bells.find((b) => b.uid === d.bell) || null;
        const where = bell === null ? '' : bell.pit === null ? ' Its bell of ' + plural(bell.weight, 'toll', 'tolls') + ' waits to be hung.'
          : ' Its bell of ' + plural(bell.weight, 'toll', 'tolls') + ' hangs in ' + (Defs.has('pit', bell.pit) ? Defs.get('pit', bell.pit).name : 'the frame') + '.';
        const how = d.how === 'retired' ? 'Retired, and recast as a bell.'
          : 'Killed by ' + killer(d.cause) + ' in ' + zonePhrase(d.zone) + ', at the ' + ordinal(Math.max(1, d.toll)) + ' toll.';
        return h('li', { class: 'game-dead lt-entry', dataset: { char: String(d.uid) } },
          h('span', { class: 'lt-dead-name' }, d.name),
          h('span', { class: 'lt-dead-line' }, nameOfClass(d.class) + ' of level ' + d.level + ' · ' + plural(d.vigils, 'vigil', 'vigils') + ' · ' +
            plural(d.tolls, 'toll', 'tolls') + ' heard'),
          h('span', { class: 'lt-dead-how' }, how + where));
      }) : [];
      return h('div', { class: 'ui-panel ui-stack lt-page lt-register-room' },
        h('p', { class: 'lt-kicker' }, 'The Lantern'),
        h('h2', { class: 'ui-heading' }, 'The Register'),
        h('p', { class: 'ui-sub' }, 'What killed each of the Household. Every attack that killed one is shown sooner to every one who comes after.'),
        warned.length ? h('ul', { class: 'lt-warnings' }, warned) : null,
        deaths.length ? h('ul', { class: 'game-register lt-ledger' }, deaths) : h('p', { class: 'ui-note' }, 'Nobody of the Household has died. The Register is empty.'),
        h('div', { class: 'ui-row lt-foot' }, UI.button('Back to the Lantern', function () { UI.back(); }, { class: 'second' })));
    },
  });

  // ---- the bequests ----

  function leaves(r) {
    const out = [];
    if (r.planPoints) out.push(plural(r.planPoints, 'point', 'points') + ' of the Plan');
    if (r.coin) out.push(r.coin + ' coin');
    if (r.hum) out.push(r.hum + ' Hum');
    if (r.voice && Defs.has('voice', r.voice)) out.push('the voice ' + Defs.get('voice', r.voice).name + ', to the chest');
    if (r.class && Defs.has('class', r.class)) out.push('the ' + Defs.get('class', r.class).name + ', opened');
    if (r.observance && Defs.has('observance', r.observance)) out.push('the observance ' + Defs.get('observance', r.observance).name);
    if (r.base && Defs.has('base', r.base)) out.push(Defs.get('base', r.base).name + ', found from now on');
    if (r.bill && Defs.has('zone', r.bill.zone)) out.push('a Bill of ' + zonePhrase(r.bill.zone));
    return out.join(' · ');
  }

  UI.screen('bequests', {
    open: function (args) {
      const save = Game.save, c = args && args.char ? Char.find(save, args.char.uid) || args.char : Game.char, all = Defs.all('bequest');
      let sealed = 0;
      const item = function (def) {
        if (def.scope === 'character' && c && typeof def.where.class === 'string' && def.where.class !== c.class) return null;   // another class's own
        const st = Progress.status(save, def.scope === 'character' ? c : null, def.id);
        if (def.hidden && !st.done) { sealed++; return null; }
        const shown = Math.min(st.n, st.count);
        return h('li', { class: ['lt-bequest', st.done ? 'is-met' : ''], dataset: { bequest: def.id } },
          h('span', { class: 'lt-bq-name' }, def.name, st.done ? h('span', { class: 'lt-seal' }, 'Met') : null),
          h('span', { class: 'lt-bq-wish' }, def.text),
          h('span', { class: 'lt-bq-bar', role: 'meter', 'aria-valuemin': '0', 'aria-valuemax': String(st.count), 'aria-valuenow': String(shown),
            'aria-label': shown + ' of ' + st.count }, h('span', { class: 'lt-bq-fill', style: { width: (shown / st.count * 100) + '%' } })),
          h('span', { class: 'lt-bq-line' }, shown + ' of ' + st.count + ' · ' + (st.done ? 'it left ' : 'it leaves ') + leaves(def.reward)));
      };
      const own = c ? all.filter((d) => d.scope === 'character').map(item).filter(Boolean) : [];
      const household = all.filter((d) => d.scope === 'account').map(item).filter(Boolean);
      return h('div', { class: 'ui-panel ui-stack lt-page lt-bequests-room' },
        h('p', { class: 'lt-kicker' }, 'The Lantern'),
        h('h2', { class: 'ui-heading' }, 'Bequests'),
        h('p', { class: 'ui-sub' }, 'The last wishes of the city’s dead. Meet one in a vigil, and it leaves what it promised.'),
        h('div', { class: 'lt-bq-cols' },
          c ? h('div', { class: 'lt-bq-col' }, h('p', { class: 'ui-note lt-bq-head' }, c.name + '’s own'), own.length ? h('ul', { class: 'lt-bq-list' }, own) : null) : null,
          h('div', { class: 'lt-bq-col' }, h('p', { class: 'ui-note lt-bq-head' }, 'The Household’s'),
            household.length ? h('ul', { class: 'lt-bq-list' }, household) : null,
            sealed ? h('p', { class: 'ui-note lt-bq-head' }, 'And ' + plural(sealed, 'sealed wish', 'sealed wishes') + ', read only once met.') : null)),
        h('div', { class: 'ui-row lt-foot' }, UI.button('Back to the Lantern', function () { UI.back(); }, { class: 'second' })));
    },
  });

  // ---- the Lantern's music: plain hunt on hand-bells, over the wind round the tower ----

  Music.define('lantern', {
    tonic: 'G4', mode: 'ionian', tempo: 60, div: 2, beats: 3, bells: 6, method: 'plain-hunt', toll: 'G2',
    ring: { octave: 0, weight: 0.06, partials: 7, length: 1.3 },
    layers: [
      {
        id: 'wind', from: 0, level: 0.3, wet: 0.8,
        hold: function (c, out, t) {
          const keep = [];
          Sound.water(c, out, t, { freq: 260, rate: 0.04, attack: 6, hold: 1e5, decay: 2, level: 0.22, keep });
          return keep;
        },
      },
      {
        id: 'hunt', from: 0, level: 0.5, wet: 0.5,
        step: function (c, out, t, m, i) {
          const n = m.bells, span = 2 * n + 1, at = i % span;
          if (at === 2 * n) return 0;                     // the handstroke gap
          const bell = m.row(2 * Math.floor(i / span) + (at >= n ? 1 : 0))[at % n];
          m.ring(c, out, t + (m.rand(i, 7) - 0.5) * 0.03, bell, 0.13 + 0.02 * bell);
          return 1;
        },
      },
    ],
  });

  Plat.on('state', function (state) {
    if (state === 'household' || state === 'lantern') Music.play('lantern', { fade: 3 });
  });
})();
