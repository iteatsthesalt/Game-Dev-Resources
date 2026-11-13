// 35-knots.js: the knots of Stage 2 (docs/design/04-progression.md, "Voices and knots"), from the clean ideas of the
// pool and from others in the changed forms its notes allow. A knot changes how the voice it is tied into speaks: its
// rule lives in 23-skills.js and 24-archetypes.js ("The knots' rules" in the header of 23-skills.js), and its params
// are the numbers it gives, at the knot's share (a knot wants 6 x its tier of its attribute; Stats.skillSheet). What a
// rule costs is the rule's own and does not shrink. A knot fits a voice that has every tag it requires and none it
// excludes (Stats.fits); addTags are tags the voice then has for modifiers (Heel's harm of voices tagged moving, and
// so on).
// Owns: (none)
// Public: nothing; it only registers definitions with Defs.add, of the kind knot (tier, attribute, what it fits, the
// pool's idea):
//   running-line   1 heel  not still     thumbs-40: faster while the heading holds, silent after a sharp turn
//   open-lead      1 ear                 bells-36: every fourth stroke left out, a beat in which you take less
//   slip-knot      1 heel  not still     thumbs-38, changed: strokes tied to the corners you turn, let go at the stop
//   back-splice    1 hand  not crossing  thumbs-39, changed: speaks from a figure 2 s back that finishes its clump
//   stones-answer  1 hand                thumbs-41: each stroke answered from the nearest stone or post
//   muffle         1 ear   not round     bells-32, changed (Leather): twice as often, every second stroke a faint
//                                        one mirrored through you
//   passes-free    1 hand  not drag      customs-42: the first body let through, the rest struck harder
//   handstroke     1 hand  not drag      customs-38 (Dexter and Sinister, renamed for a ringing word): harder on the
//                                        right hand of your line, weaker on the left
//   louvres        1 knee  not line      bells-33, changed: a cross of lanes hung on the bell-post
//   ringers-fine   1 hand                thumbs-42 (Pawned), changed: a coin flung out with each stroke
//   quartered      2 ear   not timed     thumbs-44: strokes saved and let go together at the quarters
//   resist         2 ear   not drag      water-46: a triple first bite on each body, then nothing on it until the toll
//   clash          2 ear   not drag      customs-40 (Foil), changed: two voices that strike one body together
//   balance        2 knee  thrown        bells-35, changed: thrown things stand at balance until a heavy body tips them
//   unlaid         2 hand  thrown        customs-44 (Indenture), changed and renamed: two strands that fit where they
//                                        strike two bodies side by side
//   second-voice   2 knee  not still     bells-34: standing still lends it the next voice's shape
// Left for the districts that bring water: the pool's Reflected, Twelfths, Lagan and Armed. Left out as another
// part's: Lych-wait (the Organist's rule), Teller (the voice Tellers is the same customs idea's neighbour).
(function () {
  'use strict';

  Defs.add('knot', {
    id: 'running-line', name: 'Running Line', icon: 'knot.running-line', attr: 'heel', tier: 1,
    text: 'While your heading has held within 15° for a second, the voice speaks 60% faster. Any sharper turn silences it for 0.7 s.',
    requires: [], excludes: ['still'], addTags: ['moving'], mods: [], params: { 'line-quick': 60 }, trigger: null, rule: 'running-line',
  });

  Defs.add('knot', {
    id: 'open-lead', name: 'Open Lead', icon: 'knot.open-lead', attr: 'ear', tier: 1,
    text: 'Every fourth stroke is left out: a beat of silence as long as its interval, 1.5 s at most, in which you take 40% less from Blows and Drag and nothing can be laid on you. Two beats falling together damp half as much again.',
    requires: [], excludes: [], addTags: [], mods: [], params: { 'lead-damp': 40 }, trigger: null, rule: 'open-lead',
  });

  Defs.add('knot', {
    id: 'slip-knot', name: 'Slip-knot', icon: 'knot.slip-knot', attr: 'heel', tier: 1,
    text: 'The voice no longer speaks on its own time. While it is ready, each sharp corner you turn ties one stroke to that corner, three at most, and it readies 20% slower. When you stop, every stroke tied lands on its corner, oldest first.',
    requires: [], excludes: ['still'], addTags: ['turn'], mods: [], params: { 'slip-most': 3 }, trigger: null, rule: 'slip-knot',
  });

  Defs.add('knot', {
    id: 'back-splice', name: 'Back-splice', icon: 'knot.back-splice', attr: 'hand', tier: 1,
    text: 'The voice speaks from a figure left where you stood 2 s ago. The figure stays while any of the dead stand within 3 m of it, and only then follows you. The voice readies 15% slower.',
    requires: [], excludes: ['crossing'], addTags: [], mods: [], params: { 'splice-hold': 3 }, trigger: null, rule: 'back-splice',
  });

  Defs.add('knot', {
    id: 'stones-answer', name: 'Stone\'s Answer', icon: 'knot.stones-answer', attr: 'hand', tier: 1,
    text: 'Each stroke is answered 0.3 s later from the nearest stone or post within 6 m of you, at 60%. With none in reach, the stroke itself is 20% weaker.',
    requires: [], excludes: [], addTags: [], mods: [], params: { 'answer-part': 60 }, trigger: null, rule: 'stones-answer',
  });

  Defs.add('knot', {
    id: 'muffle', name: 'Muffle', icon: 'knot.muffle', attr: 'ear', tier: 1,
    text: 'The voice speaks twice as often, but every second stroke is muffled: it lands on the far side of you, opposite where the last landed, at 30%. It reaches 20% less.',
    requires: [], excludes: ['round'], addTags: [], mods: [], params: { 'muffle-pace': 100 }, trigger: null, rule: 'muffle',
  });

  Defs.add('knot', {
    id: 'passes-free', name: 'Passes Free', icon: 'knot.passes-free', attr: 'hand', tier: 1,
    text: 'The first of the dead the voice would strike is let through untouched, and the rest are struck 60% harder. A stroke that finds only one is wasted.',
    requires: [], excludes: ['drag'], addTags: [], mods: [], params: { 'free-more': 60 }, trigger: null, rule: 'passes-free',
  });

  Defs.add('knot', {
    id: 'handstroke', name: 'Handstroke', icon: 'knot.handstroke', attr: 'hand', tier: 1,
    text: 'The dead on the right hand of the line you walk are struck 70% harder, those on your left 70% less. The line follows your thumb a third of a second late, and holds while you stand.',
    requires: [], excludes: ['drag'], addTags: [], mods: [], params: { 'hand-right': 70 }, trigger: null, rule: 'handstroke',
  });

  Defs.add('knot', {
    id: 'louvres', name: 'Louvres', icon: 'knot.louvres', attr: 'knee', tier: 1,
    text: 'The voice stops aiming: each stroke leaves you in a cross of four lanes 2 m wide, one pointing at the bell-post, as long as it reaches, 50% harder. Nothing between the lanes is touched.',
    requires: [], excludes: ['line'], addTags: ['line'], mods: [], params: { 'louvre-more': 50 }, trigger: null, rule: 'louvres',
  });

  Defs.add('knot', {
    id: 'ringers-fine', name: 'Ringer\'s Fine', icon: 'knot.ringers-fine', attr: 'hand', tier: 1,
    text: 'While you carry coin, each stroke flings one coin out where it lands and strikes 50% harder; the coin lies there until the next toll unless you walk back for it. With no coin carried, the voice strikes at half.',
    requires: [], excludes: [], addTags: [], mods: [], params: { 'fine-more': 50 }, trigger: null, rule: 'ringers-fine',
  });

  Defs.add('knot', {
    id: 'quartered', name: 'Quartered', icon: 'knot.quartered', attr: 'ear', tier: 2,
    text: 'The voice no longer speaks by itself. Every stroke it would have made is saved, twenty at most, and all are let go at each quarter of the toll, a tenth of a second apart, from where you stand.',
    requires: [], excludes: ['timed'], addTags: ['timed'], mods: [], params: { 'quarter-most': 20 }, trigger: null, rule: 'quartered',
  });

  Defs.add('knot', {
    id: 'resist', name: 'Resist', icon: 'knot.resist', attr: 'ear', tier: 2,
    text: 'The voice\'s first touch on each of the dead bites three times as hard and leaves a film of wax on it: the voice never harms that body again until the next toll.',
    requires: [], excludes: ['drag'], addTags: [], mods: [], params: { 'resist-bite': 200 }, trigger: null, rule: 'resist',
  });

  Defs.add('knot', {
    id: 'clash', name: 'Clash', icon: 'knot.clash', attr: 'ear', tier: 2,
    text: 'The voice strikes at half its harm and leaves the other half on the body. When another voice with a Clash strikes that body within a quarter of a second, the half left is paid twice over.',
    requires: [], excludes: ['drag'], addTags: [], mods: [], params: { 'clash-pay': 200 }, trigger: null, rule: 'clash',
  });

  Defs.add('knot', {
    id: 'balance', name: 'Balance', icon: 'knot.balance', attr: 'knee', tier: 2,
    text: 'Thrown things that reach the end of their flight stand there mouth-up for 4 s. Each small body that passes rocks one, 20% more; a large body tips it over onto itself for twice the harm. On the way out they strike at half, and twelve stand at most.',
    requires: ['thrown'], excludes: [], addTags: [], mods: [], params: { 'balance-fall': 100, 'balance-rock': 20 }, trigger: null, rule: 'balance',
  });

  Defs.add('knot', {
    id: 'unlaid', name: 'Unlaid', icon: 'knot.unlaid', attr: 'hand', tier: 2,
    text: 'Each thrown thing flies as two strands 40° apart, at half harm each. Where both strike bodies standing within 1.5 m of each other they are laid again: three times the harm on everything within 0.75 m.',
    requires: ['thrown'], excludes: [], addTags: [], mods: [], params: { 'unlaid-fit': 300 }, trigger: null, rule: 'unlaid',
  });

  Defs.add('knot', {
    id: 'second-voice', name: 'Second Voice', icon: 'knot.second-voice', attr: 'knee', tier: 2,
    text: 'While you stand still, the voice takes the shape of the next voice of your loadout, with its own harm. Both voices are at 75%, and the lent one readies 25% slower.',
    requires: [], excludes: ['still'], addTags: [], mods: [], params: { 'second-voice': 100 }, trigger: null, rule: 'second-voice',
  });
})();
