// 76-voices.js: the Lantern's room of voices (docs/design/04-progression.md, "Voices and knots" and "Observances and
// Heed"): the loadout's six places and the voice in each, each voice's rope with the knots tied in it, the voices and
// knots the character holds, the Household's chest, and the observances it knows and keeps against its Heed, with the
// free Heed told as the warning it gives. Everything is changed through Char and written with Game.write().
// css/42-voices.css styles what is its own (vc-*); the rest is the classes of css/10-ui.css.
// Owns: (none)
// Public: no functions. It registers, while it loads, the screen 'voices' (UI.screen):
//   'voices'  opened with {char} (the Lantern's room, Game.ROOMS). Three views, each a column that fits a phone:
//     the room      the loadout: its six places in order (the pull rings the first), each open place with its voice (a
//                   control that chooses another; focus starts on the first) and that voice's rope, a control for each
//                   place of it (the knot tied there, or empty), and each place its level has not opened with the level
//                   that opens it; the voices held in no place and the knots held untied, each with "To the chest"
//                   (Char.give); the chest's voices and knots, each with "Take" (Char.take); then Heed: a bar of what
//                   each observance kept holds, in its own colour, and the free part, the warning the free Heed gives
//                   (Observances.warning), every observance the character knows with "Keep" (Char.hold) or "Let it go"
//                   (Char.release), and those the Household has opened that it does not know yet, with "Learn"
//                   (Char.learn)
//     a place       the voices that may stand there (Char.place: one standing in another place swaps with it), and
//                   "Leave it empty"
//     a knot place  the knots held that fit the voice (Stats.fits), each with the share it would work at, to tie there
//                   (Char.tie: a knot tied there is untied first), those that do not fit with the reason, and "Untie"
//                   when one is tied (Char.untie)
//   A voice and a knot tell the share they work at: what they want of their attribute (10 and 6 x their tier) against
//   what the character has (its sheet at the Lantern, Char.sheet). What cannot be done says why in the status line
//   (.vc-said) and changes nothing; every change is written (Game.write). Back (Escape, the pad's back, UI.back) goes
//   from a view to the room and from the room out of it. Controls are marked for tests and for focus: data-place (a
//   loadout place, 0 to 5), data-rope ("place:at", a knot place), data-voice (a voice's uid), data-knot (a knot's id),
//   data-obs (an observance's id), data-act (what a control does: voice, rope, place, empty, tie, untie, give, take,
//   keep, release, learn, back); data-key names a control so that focus returns to it when the room is drawn again.
(function () {
  'use strict';

  const h = UI.h;
  const KIND = { blow: 'Blow', drag: 'Drag', swell: 'Swell' };
  const ATTR = { knee: 'Knee', heel: 'Heel', hand: 'Hand', ear: 'Ear' };
  const TONES = 6;               // the observances' colours, --vc-obs-0 to --vc-obs-5 (css/42-voices.css)
  const VOICES_MOST = 64;        // the voices a character may hold (16-savedata.js holds a save to it)
  const pct = (k) => Math.round(k * 100) + '%';
  // a dataset without the entries left undefined (UI.h would write them as the word)
  function ds(o) {
    const out = {};
    for (const k in o) if (o[k] !== undefined && o[k] !== null) out[k] = o[k];
    return out;
  }

  let room = null;               // the room open now: {back()} for the screen's back

  // ---- words ----

  const nameOf = (kind, id) => (Defs.has(kind, id) ? Defs.get(kind, id).name : id);
  const kindOf = (def) => KIND[Object.keys(def.damage)[0]] || '';
  const tagWord = (tag) => (KIND[tag] ? 'a voice of ' + KIND[tag] : 'a voice tagged ' + tag);

  // why a knot does not fit a voice, or null when it does
  function misfit(voice, knot) {
    for (let i = 0; i < knot.requires.length; i++) if (voice.tags.indexOf(knot.requires[i]) < 0) return 'it wants ' + tagWord(knot.requires[i]);
    for (let i = 0; i < knot.excludes.length; i++) if (voice.tags.indexOf(knot.excludes[i]) >= 0) return 'not for ' + tagWord(knot.excludes[i]);
    return null;
  }

  // ---- the room ----

  function open(args) {
    const save = Game.save, start = args && args.char ? args.char : Game.char;
    const root = h('div', { class: 'ui-panel ui-stack vc-room' });
    if (!save || !start) {
      root.append(h('p', { class: 'ui-sub' }, 'Nobody stands in the Household.'), UI.button('Back', () => UI.back(), { class: 'primary', dataset: { focus: '' } }));
      return root;
    }
    const state = { view: 'room', place: 0, uid: 0, at: 0, said: '', focus: null };
    const fresh = () => Char.find(save, start.uid) || start;

    function draw() {
      const c = fresh(), sheet = Char.sheet(c, save.account), prim = sheet.primaries;
      const parts = state.view === 'place' ? placeView(c, prim) : state.view === 'rope' ? ropeView(c, prim) : roomView(c, prim);
      root.replaceChildren(...parts.filter((p) => p !== null && p !== undefined && p !== false));   // as UI.h skips them
      const key = state.focus, el = key ? root.querySelector('[data-key="' + key + '"]') : null;
      const target = el || root.querySelector('[data-focus]') || root.querySelector('button');
      if (target && root.isConnected) target.focus({ preventScroll: el === null });
      state.focus = null;
    }

    // does fn, which says true when it was done or why it was not; written when done
    function act(fn, key, done) {
      const got = fn();
      if (got === true) { Game.write(); state.said = done || ''; } else state.said = typeof got === 'string' ? got : 'That cannot be done.';
      state.focus = key;
      draw();
    }
    // another view, focus on the control named key, and what the status line says
    function go(view, key, more, words) {
      state.view = view;
      Object.assign(state, more || {});
      state.said = words || '';
      state.focus = key;
      draw();
    }
    room = {
      back: function () {
        if (state.view === 'room') { UI.close('voices'); return; }
        go('room', state.view === 'place' ? 'place-' + state.place : 'rope-' + state.place + '-' + state.at);
      },
    };

    const said = () => h('p', { class: 'vc-said', role: 'status' }, state.said);
    const share = (prim, attr, want) => Stats.share(prim[attr], want);

    function voiceLine(v, prim) {
      const def = Defs.get('voice', v.id);
      return kindOf(def) + ' · ' + ATTR[def.attr] + ' ' + pct(share(prim, def.attr, Stats.WANTS.voice * def.tier)) + ' · tier ' + def.tier + ' · level ' + v.level;
    }
    function knotLine(def, prim) {
      return ATTR[def.attr] + ' ' + pct(share(prim, def.attr, Stats.WANTS.knot * def.tier)) + ' · tier ' + def.tier;
    }

    function roomView(c, prim) {
      const open = Char.places(c), placed = c.loadout;
      const places = [];
      for (let i = 0; i < placed.length; i++) {
        if (i >= open) {
          places.push(h('div', { class: 'vc-place vc-locked', dataset: { lockedPlace: String(i) } },
            h('span', { class: 'vc-num', 'aria-hidden': 'true' }, String(i + 1)), h('p', { class: 'vc-lock' }, 'Opens at level ' + Char.PLACES[i])));
          continue;
        }
        const v = placed[i] === null ? null : c.voices.find((x) => x.uid === placed[i]) || null;
        const first = i === 0 ? '' : undefined;
        const head = v === null
          ? UI.button(h('span', null, 'Empty place'), () => go('place', null, { place: i }), {
            class: 'vc-voice vc-empty', dataset: ds({ act: 'voice', place: String(i), key: 'place-' + i, focus: first }),
          })
          : UI.button([h('b', null, nameOf('voice', v.id)), h('small', null, voiceLine(v, prim))], () => go('place', null, { place: i }), {
            class: 'vc-voice', dataset: ds({ act: 'voice', place: String(i), voice: String(v.uid), key: 'place-' + i, focus: first }),
          });
        const rope = [];
        for (let at = 0; v !== null && at < v.rope; at++) {
          const k = v.knots[at];
          rope.push(UI.button(k ? nameOf('knot', k) : 'Empty', () => go('rope', null, { place: i, uid: v.uid, at }), {
            class: ['vc-knot', k ? '' : 'vc-empty'], 'aria-label': 'Knot place ' + (at + 1) + ' of ' + nameOf('voice', v.id) + ': ' + (k ? nameOf('knot', k) : 'empty'),
            dataset: ds({ act: 'rope', rope: i + ':' + at, knot: k || undefined, key: 'rope-' + i + '-' + at }),
          }));
        }
        places.push(h('div', { class: 'vc-place', dataset: { placeCard: String(i) } },
          h('div', { class: 'vc-place-head' }, h('span', { class: 'vc-num', 'aria-hidden': 'true' }, String(i + 1)), head),
          v !== null ? h('div', { class: 'vc-rope', role: 'group', 'aria-label': 'The rope of ' + nameOf('voice', v.id) }, rope) : null));
      }

      const held = c.voices.filter((v) => placed.indexOf(v.uid) < 0);
      const knots = Object.keys(c.knots).filter((id) => c.knots[id] > 0 && Defs.has('knot', id));
      const chest = save.chest, chestKnots = Object.keys(chest.knots).filter((id) => chest.knots[id] > 0 && Defs.has('knot', id));
      const row = (text, sub, button) => h('div', { class: 'vc-row' }, h('div', { class: 'vc-row-text' }, h('b', null, text), sub ? h('small', null, sub) : null), button);

      const heldRows = held.map((v) => row(nameOf('voice', v.id), voiceLine(v, prim), UI.button('To the chest', () => act(() => {
        if (chest.voices.length >= SaveData.LIMITS.voices) return 'The chest is full.';
        return Char.give(c, chest, { voice: v.uid });
      }, 'give-voice', nameOf('voice', v.id) + ' is in the chest.'), { class: 'second', dataset: { act: 'give', voice: String(v.uid), key: 'give-voice' } })));
      const knotRows = knots.map((id) => row(nameOf('knot', id) + (c.knots[id] > 1 ? ' × ' + c.knots[id] : ''), knotLine(Defs.get('knot', id), prim),
        UI.button('To the chest', () => act(() => Char.give(c, chest, { knot: id }), 'give-knot', nameOf('knot', id) + ' is in the chest.'),
          { class: 'second', dataset: { act: 'give', knot: id, key: 'give-knot' } })));
      const chestRows = chest.voices.filter((v) => Defs.has('voice', v.id)).map((v) => row(nameOf('voice', v.id), voiceLine(v, prim), UI.button('Take', () => act(() => {
        if (c.voices.length >= VOICES_MOST) return 'It holds as many voices as it can.';
        return Char.take(c, chest, { voice: v.uid });
      }, 'take-voice', 'Taken from the chest.'), { class: 'second', dataset: { act: 'take', voice: String(v.uid), key: 'take-voice' } })))
        .concat(chestKnots.map((id) => row(nameOf('knot', id) + (chest.knots[id] > 1 ? ' × ' + chest.knots[id] : ''), knotLine(Defs.get('knot', id), prim),
          UI.button('Take', () => act(() => Char.take(c, chest, { knot: id }), 'take-knot', 'Taken from the chest.'),
            { class: 'second', dataset: { act: 'take', knot: id, key: 'take-knot' } }))));

      return [
        h('p', { class: 'ui-note' }, 'The Lantern'),
        h('h2', { class: 'ui-heading' }, 'Voices'),
        h('p', { class: 'ui-sub' }, c.name + ' · ' + nameOf('class', c.class) + ', level ' + c.level),
        said(),
        h('section', { class: 'vc-section', 'aria-label': 'The loadout' },
          h('h3', { class: 'vc-title' }, 'The loadout'),
          h('p', { class: 'ui-note vc-note' }, 'Your voices speak by themselves. Knots tied in a voice\'s rope change how it speaks.'),
          places),
        h('section', { class: 'vc-section', 'aria-label': 'Held' },
          h('h3', { class: 'vc-title' }, 'Held'),
          heldRows.length || knotRows.length ? [heldRows, knotRows] : h('p', { class: 'ui-note' }, 'No voice stands idle and no knot lies untied.')),
        h('section', { class: 'vc-section', 'aria-label': 'The chest' },
          h('h3', { class: 'vc-title' }, 'The Household\'s chest'),
          chestRows.length ? chestRows : h('p', { class: 'ui-note' }, 'No voice or knot lies in the chest.')),
        heedSection(c),
        UI.button('Back to the Lantern', () => UI.close('voices'), { class: 'second vc-wide', dataset: { act: 'back', key: 'back' } }),
      ];
    }

    function heedSection(c) {
      const heed = Char.heed(c, save.account), warn = Observances.warning(c, save.account), all = Defs.all('observance');
      const tone = (id) => 'vc-tone-' + (Math.max(0, all.findIndex((o) => o.id === id)) % TONES);
      const bar = h('div', { class: 'vc-heed', role: 'img', 'aria-label': 'Heed: ' + Math.round(heed.held) + ' held of ' + Math.round(heed.max) },
        c.observances.filter((id) => Defs.has('observance', id)).map((id) => h('span', { class: ['vc-held', tone(id)], style: { flexGrow: String(Defs.get('observance', id).heed) } })),
        heed.free > 0 ? h('span', { class: 'vc-free', style: { flexGrow: String(heed.free) } }) : null);
      const opened = save.account.open.observances.filter((id) => Defs.has('observance', id) && c.known.indexOf(id) < 0);
      const card = (id, known) => {
        const def = Defs.get('observance', id), kept = c.observances.indexOf(id) >= 0;
        const button = !known ? UI.button('Learn', () => act(() => Char.learn(c, id), 'obs-' + id, 'Learned: ' + def.name + '.'),
          { class: 'second', dataset: { act: 'learn', obs: id, key: 'obs-' + id } })
          : kept ? UI.button('Let it go', () => act(() => Char.release(c, id), 'obs-' + id, def.name + ' is let go: its Heed is free.'),
            { class: 'second', dataset: { act: 'release', obs: id, key: 'obs-' + id } })
            : UI.button('Keep', () => act(() => Char.hold(c, id, save.account) ||
              'It holds ' + def.heed + ' Heed, and ' + Math.round(Char.heed(c, save.account).free) + ' is free.', 'obs-' + id, 'Kept: ' + def.name + '.'),
            { class: 'primary', dataset: { act: 'keep', obs: id, key: 'obs-' + id } });
        return h('div', { class: ['vc-obs', kept ? 'vc-kept' : ''], dataset: { obsCard: id } },
          h('div', { class: 'vc-obs-head' }, h('span', { class: ['vc-swatch', tone(id)], 'aria-hidden': 'true' }), h('b', null, def.name),
            h('small', null, (kept ? 'keeps ' : 'holds ') + def.heed + ' Heed')),
          h('p', { class: 'vc-obs-text' }, def.text), button);
      };
      return h('section', { class: 'vc-section', 'aria-label': 'Heed' },
        h('h3', { class: 'vc-title' }, 'Heed'),
        bar,
        h('p', { class: 'vc-heed-text' }, 'Heed ' + Math.round(heed.max) + ': ' + Math.round(heed.held) + ' held, ' + Math.round(heed.free) + ' free. Every Swell aimed at you shows ' +
          warn.toFixed(2) + ' s sooner.'),
        c.known.length ? c.known.filter((id) => Defs.has('observance', id)).map((id) => card(id, true))
          : h('p', { class: 'ui-note' }, 'It knows no observance yet: they are learned from bequests and from the bells it rings.'),
        opened.map((id) => card(id, false)));
    }

    function placeView(c, prim) {
      const i = state.place, now = c.loadout[i], choices = c.voices.slice().sort((a, b) => (a.uid === now ? -1 : b.uid === now ? 1 : 0));
      return [
        h('h2', { class: 'ui-heading' }, 'Place ' + (i + 1)),
        h('p', { class: 'ui-sub' }, i === 0 ? 'The first place: the pull rings the voice that stands here.' : 'Which voice stands here.'),
        said(),
        h('div', { class: 'vc-section' }, choices.map((v) => {
          const def = Defs.get('voice', v.id), where = c.loadout.indexOf(v.uid), here = v.uid === now;
          return h('div', { class: ['vc-choice', here ? 'vc-here' : ''] },
            h('div', { class: 'vc-row-text' }, h('b', null, def.name), h('small', null, voiceLine(v, prim) + (where >= 0 && !here ? ' · in place ' + (where + 1) : '')),
              h('p', { class: 'vc-obs-text' }, def.text)),
            here ? h('p', { class: 'ui-note' }, 'Stands here') : UI.button(where >= 0 ? 'Swap here' : 'Put here', () => {
              if (Char.place(c, v.uid, i)) { Game.write(); go('room', 'place-' + i, null, def.name + ' stands in place ' + (i + 1) + '.'); }
              else act(() => 'That voice cannot stand here.', 'put-' + v.uid);
            }, { class: 'primary', dataset: { act: 'place', voice: String(v.uid), key: 'put-' + v.uid, focus: '' } }));
        })),
        now !== null ? UI.button('Leave it empty', () => { if (Char.place(c, null, i)) { Game.write(); go('room', 'place-' + i, null, 'Place ' + (i + 1) + ' is empty.'); } },
          { class: 'second vc-wide', dataset: { act: 'empty', key: 'empty' } }) : null,
        UI.button('Back', () => room.back(), { class: 'second vc-wide', dataset: { act: 'back', key: 'back' } }),
      ];
    }

    function ropeView(c, prim) {
      const v = c.voices.find((x) => x.uid === state.uid);
      if (!v) { state.view = 'room'; return roomView(c, prim); }
      const voice = Defs.get('voice', v.id), tied = v.knots[state.at];
      const knots = Object.keys(c.knots).filter((id) => c.knots[id] > 0 && Defs.has('knot', id));
      const fit = knots.filter((id) => Stats.fits(voice, Defs.get('knot', id))), unfit = knots.filter((id) => fit.indexOf(id) < 0);
      const back = 'rope-' + state.place + '-' + state.at;
      return [
        h('h2', { class: 'ui-heading' }, voice.name),
        h('p', { class: 'ui-sub' }, 'Knot place ' + (state.at + 1) + ' of its rope of ' + v.rope + '.'),
        said(),
        tied ? h('div', { class: 'vc-choice vc-here' },
          h('div', { class: 'vc-row-text' }, h('b', null, nameOf('knot', tied)), h('small', null, Defs.has('knot', tied) ? knotLine(Defs.get('knot', tied), prim) : ''),
            h('p', { class: 'vc-obs-text' }, Defs.has('knot', tied) ? Defs.get('knot', tied).text : '')),
          UI.button('Untie', () => { if (Char.untie(c, v.uid, state.at)) { Game.write(); go('room', back, null, nameOf('knot', tied) + ' is untied.'); } },
            { class: 'second', dataset: ds({ act: 'untie', knot: tied, key: 'untie', focus: fit.length ? undefined : '' }) })) : null,
        h('div', { class: 'vc-section' },
          fit.length ? fit.map((id) => {
            const def = Defs.get('knot', id);
            return h('div', { class: 'vc-choice' },
              h('div', { class: 'vc-row-text' }, h('b', null, def.name + (c.knots[id] > 1 ? ' × ' + c.knots[id] : '')), h('small', null, knotLine(def, prim)),
                h('p', { class: 'vc-obs-text' }, def.text)),
              UI.button(tied ? 'Tie it instead' : 'Tie', () => {
                if (Char.tie(c, v.uid, state.at, id)) { Game.write(); go('room', back, null, def.name + ' is tied into ' + voice.name + '.'); }
                else act(() => 'It cannot be tied here.', 'tie-' + id);
              }, { class: 'primary', dataset: { act: 'tie', knot: id, key: 'tie-' + id, focus: '' } }));
          }) : h('p', { class: 'ui-note' }, knots.length ? 'No knot it holds fits this voice.' : 'It holds no knot untied: the great dead leave them.'),
          unfit.map((id) => h('div', { class: 'vc-choice vc-unfit' },
            h('div', { class: 'vc-row-text' }, h('b', null, nameOf('knot', id)), h('small', null, 'Does not fit: ' + misfit(voice, Defs.get('knot', id)) + '.'))))),
        UI.button('Back', () => room.back(), { class: 'second vc-wide', dataset: { act: 'back', key: 'back' } }),
      ];
    }

    draw();
    return root;
  }

  UI.screen('voices', {
    open: open,
    close: function () { room = null; },
    back: function () { if (room !== null) room.back(); else UI.close('voices'); },
  });
})();
