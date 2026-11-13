// 75-finds.js: the Lantern's room of finds (docs/design/04-progression.md, "Finds"): what a character wears and the
// Household's chest, every find's lines readable as the clauses they are with what wrote them, wearing and taking off,
// and the four changes with their prices. css/41-finds.css styles it; the rest is the classes of css/10-ui.css.
// Owns: (none)
// Public: no functions. It registers, while it loads, the screen 'finds' (UI.screen) and the glyphs of the seven slots
// that the bases name as their icons, 'find.tool', 'find.hat', 'find.coat', 'find.hands', 'find.girdle',
// 'find.pattens', 'find.token' (Glyphs.define): one look for every find of a slot, in one colour, since a find is worth
// its notches and nothing on it is a tier.
//   'finds'   opened with {char} (the Lantern's room; Game.ROOMS). Three views, each a column that fits a phone:
//     the list    the eight places the character wears finds in (Char.SLOTS), each with its find or none, and the
//                 finds of the chest (Game.save.chest.finds); the Household's coin, and the attributes the finds'
//                 share is worked from (Items.attrs). A find is a control that opens it.
//     a find      its name, slot, level and notches; what it wants (Items.wants) and the share its lines work at now;
//                 its cooling and its re-walk if it has them; its fixed line, then its eight places: each written line
//                 as its clause, verb, object and condition, with the posture and the toll that wrote it, whether it
//                 was cut backward, and the word the chisel struck; a line is chosen by pressing it. Then the controls:
//                 wear it (Char.equip with the chest; a token into either token place) or take it off (Char.unequip);
//                 strike the chosen line's object or its condition (Items.chisel), re-walk it (Items.rewalk), cut it
//                 away (Items.cut), each with its price (Items.price); and recast, which opens the third view.
//     recast      the other finds of the chest of the same slot; one chosen, the two orders of pouring, each with the
//                 price of both (Items.recast; the new find takes a uid of the save and both poured leave the chest).
//   A change is asked once more in a dialog (UI.confirm) with its price, then paid from Game.save.account.coin and
//   written (Game.write); so is wearing and taking off. What cannot be done says why in the screen's status line
//   (Items.refusal, or the coin it lacks) and changes nothing. Back (Escape, the pad's back, UI.back) goes from recast
//   to the find, from the find to the list, and from the list out of the room. Controls are marked for tests and
//   for focus: data-uid (a find), data-slot (a worn place), data-place (a line), data-act (a control's act: wear,
//   wear-token-1, wear-token-2, off, chisel-object, chisel-condition, rewalk, cut, recast, list, find, pour-first,
//   pour-last, leave), data-partner (a find to pour with); the status line is .fnd-said.
(function () {
  'use strict';

  const floor = Math.floor;
  const SLOT_WORDS = { tool: 'Tool', hat: 'Hat', coat: 'Coat', hands: 'Hands', girdle: 'Girdle', pattens: 'Pattens', token: 'Token',
    'token-1': 'First token', 'token-2': 'Second token' };
  const ATTR_WORDS = { knee: 'Knee', heel: 'Heel', hand: 'Hand', ear: 'Ear' };
  // what each stat is called in a line: read after its amount, "+4% harm", "+0.03 s sooner warning of Swells"
  const STAT_WORDS = {
    knee: ['', 'Knee'], heel: ['', 'Heel'], hand: ['', 'Hand'], ear: ['', 'Ear'],
    'life-max': ['', 'greatest life'], 'wound-term': ['s', 'before a wound scars'], 'wound-join': ['m', 'within which harm joins a wound'],
    'wound-cap': ['', 'open wounds at most'], 'mend-rate': ['', 'mending'], 'mend-reach': ['m', 'of reach to mend'],
    'mend-on-lay': ['%', 'of a wound mended by each of the dead laid in it'], scarring: ['points', 'of the life of an unmended wound that scars'],
    'brace-time': ['s', 'before Brace holds'], 'stride-share': ['points', 'of top speed needed to Stride'],
    'lee-reach': ['m', 'of reach for lee'], 'turn-limit': ['°', 'of turn before you are Wrong-footed'],
    'wrong-foot-taken': ['points', 'of harm taken while Wrong-footed'], 'guard.all': ['', 'to every guard'], taken: ['', 'harm taken'],
    'move-speed': ['', 'top speed'], 'shove-taken': ['', 'to how far shoves move you'],
    'find-weight': ['points', 'of top speed each find carried takes'], 'find-steady': ['points', 'of steadiness each find carried gives'],
    'pickup-reach': ['', 'pickup reach'], 'wake-lag': ['s', 'that the dead lag behind you'], 'wake-length': ['s', 'of wake'],
    'heed-max': ['', 'greatest Heed'], warn: ['s', 'sooner warning of Swells'], 'trade-recharge': ['points', 'of your trade\'s recharge'],
    'heave-recharge': ['s', 'of the heave\'s recharge'], 'heave-harm': ['', 'to the harm of the heave'], 'pull-window': ['s', 'of the window for a pull'],
    'set-time': ['s', 'of stillness to set the bell'], 'wedge-length': ['m', 'of wedge'], 'bar-length': ['m', 'of bar'],
    'lamp-burn': ['s', 'of a lamp\'s burning'], 'chest-size': ['', 'units of wind'], 'dig-rate': ['', 'digging'],
    'procession-cap': ['', 'to the train a voice may count'], 'procession-bonus': ['points', 'of harm to those In Procession'],
    'sound-time': ['s', 'to Sound a large body'], 'xp-gain': ['', 'experience'], 'coin-find': ['', 'coin from the dead'],
    'find-chance': ['', 'finds from the dead'], 'hum-gain': ['', 'Hum'], 'notch-size': ['', 'to the size of notches written'],
    damage: ['', 'harm'], speed: ['', 'to how often voices speak'], area: ['', 'to the size of shapes'], reach: ['', 'to the reach of voices'],
    duration: ['', 'to how long what voices leave lasts'], throws: ['', 'thrown things'], pierce: ['', 'bodies a thrown thing passes'],
    'throw-speed': ['', 'to the speed of thrown things'], shove: ['m', 'of shove on what voices strike'],
    'wrong-foot': ['points', 'of harm to the Wrong-footed'], 'cond-duration': ['', 'to how long the conditions you lay last'],
  };
  const KIND_WORDS = { blow: 'Blow', drag: 'Drag', swell: 'Swell' };
  const GUARD_WORDS = { brace: 'Brace', stride: 'Stride', lee: 'lee' };
  const AILMENT_WORDS = { coined: 'Coined', sealed: 'Sealed', brined: 'Brined' };
  const TAG_WORDS = {
    still: 'voices of standing still', moving: 'voices of moving', timed: 'voices of the clock', thrown: 'thrown voices',
    ground: 'voices laid on the ground', line: 'voices drawn in a line', round: 'voices that ring round you',
    planted: 'voices that stay where they are set', held: 'voices that last', turn: 'voices that answer a turn',
    crossing: 'voices that answer a crossing of your wake', water: 'voices of the water', trade: 'your trade', heave: 'the heave',
    blow: 'Blows', drag: 'Drag', swell: 'Swells', hit: 'what lands at once', dot: 'what bites four times a second', attack: 'attacks',
  };
  const COND_WORDS = {
    braced: ['while Braced', 'while not Braced'], striding: ['while Striding', 'while not Striding'],
    crowded: ['while crowded', 'while not crowded'], 'after-quarter': ['for 8 s after each quarter', 'outside the 8 s after each quarter'],
    'wrong-footed': ['while Wrong-footed', 'while not Wrong-footed'], 'in-water': ['in water', 'out of water'], dry: ['on dry ground', 'off dry ground'],
    'on-wound': ['on a wound', 'off your wounds'], laden: ['while laden', 'while not laden'], scarred: ['once scarred', 'while unscarred'],
    faint: ['while faint', 'while not faint'], 'at-post': ['near the bell-post', 'away from the bell-post'], 'in-light': ['in lamplight', 'out of lamplight'],
    'tolled-for': ['while Tolled-for', 'while not Tolled-for'], 't-braced': ['on the Braced', 'on the unbraced'],
    't-striding': ['on the Striding', 'on the dead not Striding'], 't-large': ['on large bodies', 'on small bodies'], 't-elite': ['on elites', 'on all but elites'],
    't-keeper': ['on keepers', 'on all but keepers'], 't-near': ['on the dead within 3 m', 'on the dead beyond 3 m'],
    't-far': ['on the dead beyond 8 m', 'on the dead within 8 m'], 't-in-water': ['on the dead in water', 'on the dead out of water'],
    't-wrong-footed': ['on the Wrong-footed', 'on all but the Wrong-footed'], 't-in-procession': ['on those In Procession', 'on those not In Procession'],
    't-moored': ['on the Moored', 'on all but the Moored'], 't-sounded': ['on the Sounded', 'on all but the Sounded'],
    't-coiled': ['on the Coiled', 'on all but the Coiled'], 't-mourning': ['on the mourning', 'on all but the mourning'],
    't-coined': ['on the Coined', 'on all but the Coined'], 't-sealed': ['on the Sealed', 'on all but the Sealed'], 't-brined': ['on the Brined', 'on all but the Brined'],
  };
  const REFUSALS = {
    change: 'That is no way to change a find.', place: 'Choose a line first: press one of its lines.', empty: 'There is no line in that place.',
    word: 'The chisel strikes an object or a condition.', struck: 'A word of that line is struck already: one word a line, and it is never put back.',
    all: 'That line works for all already: it has no object to strike.',
    walking: 'A place of this find is struck for a re-walk already. Wear it into a vigil, and the first toll survived writes it anew.',
    same: 'A find cannot be poured into itself.', slot: 'Only finds of one slot pour together.', base: 'That find is of no base the Household knows.',
    worn: 'Take it off first: only finds in the chest are poured.', none: 'The chest holds no other find of this slot to pour with it.',
  };
  const ORDINAL = ['th', 'st', 'nd', 'rd'];

  // ---- words ----

  function amount(v) {
    const a = Math.abs(v), s = a >= 100 ? a.toFixed(0) : a >= 10 ? a.toFixed(1) : a >= 1 ? a.toFixed(2) : a.toFixed(3);
    return s.indexOf('.') < 0 ? s : s.replace(/0+$/, '').replace(/\.$/, '');
  }
  const signed = (v) => (v < 0 ? '−' : '+') + amount(v);
  const ordinal = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ORDINAL[n % 10] || 'th');
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);

  // [unit, noun] of a stat, the families by kind of harm and by condition made from the tables
  function statWords(stat) {
    if (STAT_WORDS[stat] !== undefined) return STAT_WORDS[stat];
    const dot = stat.indexOf('.'), head = stat.slice(0, dot + 1), tail = stat.slice(dot + 1);
    const t = Stats.TYPE[tail], kind = t === undefined ? null : Stats.TYPES[t], guard = kind ? GUARD_WORDS[kind.guard] : null;
    if (head === 'guard.' && guard) return ['', 'to ' + guard + '\'s guard'];
    if (head === 'guard-max.' && guard) return ['', 'to the most ' + guard + ' can guard'];
    if (head === 'through.' && guard) return ['points', 'of the ' + guard + ' of the dead pierced'];
    if (head === 'added.' && kind) return ['', KIND_WORDS[kind.id] + ' harm added to voices'];
    if (head === 'chance.' && AILMENT_WORDS[tail]) return ['%', 'chance on each hit to lay ' + AILMENT_WORDS[tail]];
    if (head === 'flag.') return ['', 'a rule changed'];
    if (head === 'param.') return ['', 'to a voice\'s own measure'];
    return ['', 'a strength without a name'];
  }

  function verbText(stat, op, value) {
    const w = statWords(stat), unit = w[0], noun = w[1];
    if (Array.isArray(value)) return signed(value[0]) + ' to ' + amount(value[1]) + (unit ? ' ' + unit : '') + ' ' + noun;
    if (op === 'more') return '×' + (1 + value / 100).toFixed(2) + ' ' + noun;
    if (op === 'set') return noun + ' set to ' + amount(value) + (unit ? ' ' + unit : '');
    if (op === 'inc') return signed(value) + '% ' + noun;
    return signed(value) + (unit === '%' ? '% ' : unit ? ' ' + unit + ' ' : ' ') + noun;
  }

  function tagText(tags) {
    if (!tags || tags.length === 0) return 'for all';
    return 'for ' + tags.map((t) => TAG_WORDS[t] || (Stats.is('family', t) ? 'a held ' + t : AILMENT_WORDS[t] || 'the ' + t.replace(/-/g, ' '))).join(' and ');
  }

  function condText(cond, not) {
    const list = Array.isArray(cond) ? cond : [cond];
    return list.map((c) => (COND_WORDS[c] ? COND_WORDS[c][not ? 1 : 0] : not ? 'unless it holds' : 'while it holds')).join(' and ');
  }

  // a fixed line (a Mod): its verb, its object, its condition if it has one
  function fixedText(m) {
    let text = verbText(m.stat, m.op, m.value) + ' · ' + tagText(m.tags);
    if (m.cond !== undefined) text += ' · ' + condText(m.cond, false);
    if (m.unless !== undefined) text += ' · ' + condText(m.unless, true);
    return text;
  }

  const baseOf = (find) => (Defs.has('base', find.base) ? Defs.get('base', find.base) : null);
  const nameOf = (find) => { const b = baseOf(find); return b ? b.name : 'A find'; };
  const postureName = (id) => (Defs.has('posture', id) ? Defs.get('posture', id).name : 'A posture');

  // ---- the glyphs of the slots: one bronze shape each, the shape of what is worn there ----

  Glyphs.define('find.tool', function (g) {
    const c = g.c, ink = g.ink || c.bronze;
    g.line(0.24, 0.86, 0.74, 0.14, 0.09, ink);
    g.box(0.62, 0.08, 0.2, 0.14, c.oak);
    g.line(0.3, 0.72, 0.4, 0.58, 0.11, c.red);
  });
  Glyphs.define('find.hat', function (g) {
    const c = g.c, ink = g.ink || c.bronze;
    g.box(0.08, 0.62, 0.84, 0.12, ink);
    g.taper(0.5, 0.3, 0.38, 0.46, 0.34, ink);
    g.box(0.31, 0.56, 0.38, 0.06, c.dark);
  });
  Glyphs.define('find.coat', function (g) {
    const c = g.c, ink = g.ink || c.bronze;
    g.taper(0.5, 0.18, 0.62, 0.46, 0.7, ink);
    g.line(0.5, 0.22, 0.5, 0.86, 0.03, c.dark);
    g.box(0.36, 0.14, 0.28, 0.08, c.boneDim);
  });
  Glyphs.define('find.hands', function (g) {
    const c = g.c, ink = g.ink || c.bronze;
    g.box(0.3, 0.26, 0.38, 0.5, ink);
    g.box(0.14, 0.44, 0.16, 0.2, ink);
    g.box(0.3, 0.72, 0.38, 0.12, c.oak);
  });
  Glyphs.define('find.girdle', function (g) {
    const c = g.c, ink = g.ink || c.bronze;
    g.box(0.06, 0.42, 0.88, 0.16, ink);
    g.ring(0.5, 0.5, 0.13, 0.05, c.bone);
  });
  Glyphs.define('find.pattens', function (g) {
    const c = g.c, ink = g.ink || c.bronze;
    g.box(0.12, 0.34, 0.76, 0.14, ink);
    g.ring(0.5, 0.68, 0.17, 0.06, c.lead);
  });
  Glyphs.define('find.token', function (g) {
    const c = g.c, ink = g.ink || c.bronze;
    g.ring(0.5, 0.52, 0.28, 0.1, ink);
    g.ball(0.5, 0.2, 0.09, c.bone);
  });

  function icon(find) {
    const b = baseOf(find), id = b && typeof b.icon === 'string' ? b.icon : 'mark.find';
    if (typeof Glyphs.icon !== 'function') return null;
    const el = Glyphs.icon({ id, size: 40 });
    el.style.width = el.style.height = '';         // css/41-finds.css sizes it in rem, so that it follows the text
    el.classList.add('fnd-icon');
    el.setAttribute('aria-hidden', 'true');
    return el;
  }

  // the notches as small cuts, for the eye; their number is in the words beside them
  function cuts(n) {
    const marks = [];
    for (let i = 0; i < n; i++) marks.push(UI.h('span', { class: 'fnd-cut' }));
    return UI.h('span', { class: 'fnd-cuts', 'aria-hidden': 'true' }, marks);
  }

  // ---- the open room ----

  let st = null;     // the open room: {char, panel, view, uid, place, partner}

  const save = () => Game.save;
  const chest = () => save().chest;

  // a find of the room by uid: where it is, and the place it is worn in
  function locate(uid) {
    const c = st.char;
    for (let i = 0; i < Char.SLOTS.length; i++) {
      const f = c.worn[Char.SLOTS[i]];
      if (f && f.uid === uid) return { find: f, slot: Char.SLOTS[i] };
    }
    const list = chest().finds;
    for (let i = 0; i < list.length; i++) if (list[i].uid === uid) return { find: list[i], slot: null };
    return null;
  }

  function say(text, good) {
    const line = st.panel.querySelector('.fnd-said');
    if (!line) return;
    line.textContent = text;
    line.classList.toggle('is-done', !!good);
    line.classList.remove('is-note');
  }

  function write() { if (typeof Game.write === 'function') Game.write(); }

  // builds the view the room is in afresh, and puts focus on the control focusAt names (a selector), else on the one
  // marked data-focus, else on the first
  function render(focusAt) {
    const panel = st.panel;
    while (panel.firstChild) panel.removeChild(panel.firstChild);
    const here = st.view !== 'list' && st.uid !== null ? locate(st.uid) : null;
    if (here === null) st.view = 'list';
    if (st.view === 'list') listView(panel);
    else if (st.view === 'find') findView(panel, here);
    else pourView(panel, here);
    const target = (focusAt && panel.querySelector(focusAt)) || panel.querySelector('[data-focus]') || panel.querySelector('button');
    if (target) target.focus();
  }

  function heading(panel, sub) {
    panel.appendChild(UI.h('p', { class: 'ui-note' }, 'The Lantern · ' + st.char.name));
    panel.appendChild(UI.h('h2', { class: 'ui-heading' }, 'Finds'));
    if (sub) panel.appendChild(UI.h('p', { class: 'ui-sub' }, sub));
  }

  function purse() {
    const a = Items.attrs(st.char, save().account), parts = ['Coin ' + floor(save().account.coin)];
    for (let i = 0; i < Stats.PRIMARIES.length; i++) {
      const id = Stats.PRIMARIES[i].id;
      parts.push((ATTR_WORDS[id] || id) + ' ' + floor(a[id] + 1e-9));
    }
    return UI.h('p', { class: 'fnd-purse' }, parts.join('  ·  '));
  }

  // a find in a list: worn (label: its place) or in the chest (its slot first in the note)
  function itemButton(find, label, attrs) {
    const n = Char.notches(find), b = baseOf(find), notes = [];
    if (!label && b) notes.push(SLOT_WORDS[b.slot]);
    notes.push(plural(n, 'notch', 'notches'));
    if (find.level > 1) notes.push('level ' + find.level);
    if (find.cool > 0) notes.push('cooling');
    if (find.walk >= 0) notes.push('on a re-walk');
    return UI.button([icon(find), UI.h('span', { class: 'fnd-item-text' },
      UI.h('span', { class: 'fnd-item-name' }, (label ? label + ': ' : '') + nameOf(find)),
      UI.h('span', { class: 'fnd-item-note' }, notes.join(' · '))), cuts(n)],
    function () { st.view = 'find'; st.uid = find.uid; st.place = -1; st.partner = null; render(); }, Object.assign({ class: 'fnd-item' }, attrs));
  }

  function listView(panel) {
    heading(panel, 'What ' + st.char.name + ' wears, and the Household\'s chest.');
    panel.appendChild(purse());
    panel.appendChild(UI.h('h3', { class: 'fnd-head' }, 'Worn'));
    const worn = Char.SLOTS.map(function (slot) {
      const f = st.char.worn[slot];
      if (!f) return UI.h('div', { class: 'fnd-empty', dataset: { slot } }, SLOT_WORDS[slot] + ': nothing worn');
      return itemButton(f, SLOT_WORDS[slot], { dataset: { uid: String(f.uid), slot } });
    });
    panel.appendChild(UI.h('div', { class: 'fnd-list' }, worn));
    const list = chest().finds;
    panel.appendChild(UI.h('h3', { class: 'fnd-head' }, 'The chest' + (list.length ? ' · ' + plural(list.length, 'find', 'finds') : '')));
    panel.appendChild(list.length ? UI.h('div', { class: 'fnd-list' }, list.map((f) => itemButton(f, null, { dataset: { uid: String(f.uid) } })))
      : UI.h('p', { class: 'ui-note fnd-none' }, 'The chest is empty. Finds banked at a lychgate come here, and the worn finds of the dead.'));
    panel.appendChild(UI.h('p', { class: 'fnd-said', role: 'status' }, ''));
    panel.appendChild(UI.h('div', { class: 'ui-row' }, UI.button('Back to the Lantern', function () { UI.close('finds'); }, { class: 'second', dataset: { act: 'leave' } })));
  }

  // what a find wants, and the share its lines work at now
  function wantsText(find) {
    const w = Items.wants(find);
    if (w === null) return 'Blank: it wants nothing, and gives its fixed line in full.';
    if (w.attr === null) return 'Its lines were written by no posture the Household knows.';
    const have = Items.attrs(st.char, save().account)[w.attr], share = Stats.share(have, w.want);
    return 'Mostly ' + postureName(w.posture).toLowerCase() + ': it wants ' + w.want + ' ' + (ATTR_WORDS[w.attr] || w.attr) + '. With ' + floor(have + 1e-9) +
      (share >= 1 - 1e-9 ? ', its lines work in full.' : ', its lines work at ' + Math.round(share * 100) + '%.');
  }

  function lineRow(find, i) {
    const line = find.lines[i], gone = find.gone.indexOf(i) >= 0;
    const label = 'Line ' + (i + 1);
    if (line === null) {
      const text = gone ? 'gone for good' : find.walk === i ? 'struck for a re-walk: the first toll survived wearing it writes it anew' : 'blank';
      return UI.h('li', { class: ['fnd-place', 'fnd-bare', gone ? 'is-gone' : '', find.walk === i ? 'is-walk' : ''], dataset: { place: String(i) } },
        UI.h('span', { class: 'fnd-n' }, label), ' ', UI.h('span', { class: 'fnd-blank' }, text));
    }
    const verb = UI.h('span', { class: 'fnd-verb' }, verbText(line.stat, line.op, line.value));
    const object = UI.h('span', { class: ['fnd-object', line.struck === 'object' ? 'is-struck' : ''] }, tagText(line.tags));
    const cond = UI.h('span', { class: ['fnd-cond', line.struck === 'condition' ? 'is-struck' : ''] }, condText(line.cond, line.backward));
    const meta = [postureName(line.posture) + ', at the ' + ordinal(line.toll) + ' toll'];
    if (line.backward) meta.push('cut backward: its condition turned round');
    if (line.struck === 'object') meta.push('its object chiselled away: it works for all, at 60%');
    if (line.struck === 'condition') meta.push('its condition chiselled away: it works always, at 60%');
    const chosen = st.place === i;
    const b = UI.button([UI.h('span', { class: 'fnd-n' }, label), ' ', verb, ' · ', object, ' · ', cond, UI.h('span', { class: 'fnd-meta' }, meta.join(' · '))],
      function () { st.place = st.place === i ? -1 : i; render('[data-place="' + i + '"]'); },
      { class: ['fnd-line', chosen ? 'is-chosen' : ''], 'aria-pressed': chosen ? 'true' : 'false', dataset: { place: String(i) } });
    return UI.h('li', { class: 'fnd-place' }, b);
  }

  function priced(label, find, change, act, fn, other) {
    const p = Items.price(find, change, other);
    return UI.button(label + ' · ' + p + ' coin', fn, { class: 'second', dataset: { act } });
  }

  function findView(panel, here) {
    const find = here.find, b = baseOf(find), slot = here.slot, n = Char.notches(find);
    panel.appendChild(UI.button('All finds', function () { back(); }, { class: 'second fnd-up', dataset: { act: 'list' } }));
    panel.appendChild(UI.h('div', { class: 'fnd-title' }, icon(find), UI.h('h3', { class: 'fnd-name' }, nameOf(find))));
    const where = slot ? 'worn as ' + (SLOT_WORDS[slot] || slot).toLowerCase() : 'in the chest';
    panel.appendChild(UI.h('p', { class: 'fnd-meta-line' }, [(b ? SLOT_WORDS[b.slot] : 'A find'), 'level ' + find.level, plural(n, 'notch', 'notches'), where].join(' · ')));
    if (b && b.text) panel.appendChild(UI.h('p', { class: 'ui-sub fnd-text' }, b.text));
    panel.appendChild(UI.h('p', { class: 'fnd-wants' }, wantsText(find)));
    if (find.cool > 0) panel.appendChild(UI.h('p', { class: 'fnd-note' }, 'Cooling: each toll the Household hears raises its weakest line, ' + plural(find.cool, 'step', 'steps') + ' more, until it is first worn.'));
    const rows = [UI.h('li', { class: 'fnd-place fnd-bare fnd-fixed' }, UI.h('span', { class: 'fnd-n' }, 'Fixed'), ' ', UI.h('span', { class: 'fnd-verb' }, fixedText(find.fixed)))];
    for (let i = 0; i < find.lines.length; i++) rows.push(lineRow(find, i));
    panel.appendChild(UI.h('ol', { class: 'fnd-lines' }, rows));
    const acts = [];
    if (slot) acts.push(UI.button('Take it off', function () { takeOff(slot); }, { class: 'second', dataset: { act: 'off' } }));
    else if (b && b.slot === 'token') {
      acts.push(UI.button('Wear as first token', function () { wear(find, 'token-1'); }, { class: 'primary', dataset: { act: 'wear-token-1', focus: '' } }));
      acts.push(UI.button('Wear as second token', function () { wear(find, 'token-2'); }, { class: 'second', dataset: { act: 'wear-token-2' } }));
    } else if (b) acts.push(UI.button('Wear it', function () { wear(find, b.slot); }, { class: 'primary', dataset: { act: 'wear', focus: '' } }));
    panel.appendChild(UI.h('div', { class: 'ui-row fnd-acts' }, acts));
    const chosen = st.place >= 0 ? 'line ' + (st.place + 1) : 'the chosen line';
    panel.appendChild(UI.h('p', { class: 'ui-note fnd-change-note' }, n > 0 ? 'The chisel, the re-walk and the cut act on ' + chosen + '. Press a line to choose it.'
      : 'A blank find has no line for the chisel, the re-walk or the cut.'));
    panel.appendChild(UI.h('div', { class: 'ui-row fnd-acts' },
      n > 0 ? priced('Strike its object', find, 'chisel', 'chisel-object', function () { change(find, 'chisel', 'object'); }) : null,
      n > 0 ? priced('Strike its condition', find, 'chisel', 'chisel-condition', function () { change(find, 'chisel', 'condition'); }) : null,
      n > 0 ? priced('Re-walk it', find, 'rewalk', 'rewalk', function () { change(find, 'rewalk'); }) : null,
      n > 0 ? priced('Cut it away', find, 'cut', 'cut', function () { change(find, 'cut'); }) : null,
      UI.button('Recast with another', function () { toPour(find, slot); }, { class: 'second', dataset: { act: 'recast' } })));
    panel.appendChild(UI.h('p', { class: 'fnd-said', role: 'status' }, ''));
  }

  function partners(find) {
    const b = baseOf(find), list = chest().finds, out = [];
    for (let i = 0; i < list.length; i++) {
      const o = list[i], ob = baseOf(o);
      if (o.uid !== find.uid && b && ob && ob.slot === b.slot) out.push(o);
    }
    return out;
  }

  function pourView(panel, here) {
    const find = here.find, mates = partners(find);
    panel.appendChild(UI.button('Back to the find', function () { back(); }, { class: 'second fnd-up', dataset: { act: 'find' } }));
    panel.appendChild(UI.h('h3', { class: 'fnd-name' }, 'Recast ' + nameOf(find)));
    panel.appendChild(UI.h('p', { class: 'ui-sub fnd-text' }, 'Two finds of one slot are poured into one. The first poured gives its fixed line and lines 1 to 4, the last poured lines 5 to 8, and a place either left blank stays blank. The new find takes the higher level, and until it is first worn each toll the Household hears raises its weakest line.'));
    panel.appendChild(UI.h('div', { class: 'fnd-list' }, mates.map(function (o) {
      const chosen = st.partner === o.uid, n = Char.notches(o);
      return UI.button([icon(o), UI.h('span', { class: 'fnd-item-text' }, UI.h('span', { class: 'fnd-item-name' }, nameOf(o)),
        UI.h('span', { class: 'fnd-item-note' }, plural(n, 'notch', 'notches') + (o.level > 1 ? ' · level ' + o.level : ''))), cuts(n)],
      function () { st.partner = chosen ? null : o.uid; render('[data-partner="' + o.uid + '"]'); },
      { class: ['fnd-item', chosen ? 'is-chosen' : ''], 'aria-pressed': chosen ? 'true' : 'false', dataset: { partner: String(o.uid) } });
    })));
    const other = st.partner === null ? null : locate(st.partner);
    if (other && other.slot === null) {
      const a = find, z = other.find, price = Items.price(a, 'recast', z);
      panel.appendChild(UI.h('div', { class: 'ui-row fnd-acts' },
        UI.button('Pour ' + nameOf(a) + ' first · ' + price + ' coin', function () { pour(a, z); }, { class: 'second', dataset: { act: 'pour-first' } }),
        UI.button('Pour ' + nameOf(z) + ' first · ' + price + ' coin', function () { pour(z, a); }, { class: 'second', dataset: { act: 'pour-last' } })));
    }
    panel.appendChild(UI.h('p', { class: ['fnd-said', mates.length ? 'is-note' : ''], role: 'status' }, mates.length ? 'Choose the find to pour with it.' : REFUSALS.none));
  }

  // ---- what the controls do ----

  function wear(find, slot) {
    const before = st.char.worn[slot];
    if (!Char.equip(st.char, find.uid, slot, chest())) { say('It cannot be worn there.'); return; }
    write();
    render('[data-act="off"]');
    say('Worn as ' + SLOT_WORDS[slot].toLowerCase() + (before ? '; ' + nameOf(before) + ' went back to the chest.' : '.'), true);
  }

  function takeOff(slot) {
    if (!Char.unequip(st.char, slot, chest())) { say('Nothing is worn there.'); return; }
    write();
    render();
    say('Taken off, into the chest.', true);
  }

  function short(coin) { return 'The Household has ' + floor(save().account.coin) + ' coin; this costs ' + coin + '.'; }

  const ASK = {
    chisel: function (find, i, word) {
      return 'Strike the ' + word + ' from line ' + (i + 1) + ' of the ' + nameOf(find) + ' for good? It then works ' + (word === 'object' ? 'for all' : 'always') + ', at 60%.';
    },
    rewalk: function (find, i) { return 'Strike line ' + (i + 1) + ' of the ' + nameOf(find) + ' out? The first toll survived wearing it writes the place anew; a death in that vigil erases it and both its neighbours.'; },
    cut: function (find, i) { return 'Cut line ' + (i + 1) + ' of the ' + nameOf(find) + ' away for good? Every other line rises 10%.'; },
  };
  const DONE = { chisel: 'Struck. The chisel never puts a word back.', rewalk: 'Struck out for a re-walk.', cut: 'Cut away. Every other line rose 10%.' };
  const YES = { chisel: 'Strike it', rewalk: 'Strike it out', cut: 'Cut it' };
  const KEY = { chisel: null, rewalk: '[data-act="rewalk"]', cut: '[data-act="cut"]' };

  async function change(find, kind, word) {
    const why = Items.refusal(find, kind, st.place, word);
    if (why !== null) { say(REFUSALS[why] || REFUSALS.change); return; }
    const price = Items.price(find, kind);
    if (!(save().account.coin >= price)) { say(short(price)); return; }
    const place = st.place, ok = await UI.confirm(ASK[kind](find, place, word) + ' ' + price + ' coin.', { yes: YES[kind], no: 'Keep it' });
    if (!ok || st === null) return;
    const done = kind === 'chisel' ? Items.chisel(find, place, word) : kind === 'rewalk' ? Items.rewalk(find, place) : Items.cut(find, place);
    if (!done) { say(REFUSALS.change); return; }
    save().account.coin -= price;
    write();
    if (kind !== 'chisel') st.place = -1;
    render(KEY[kind] || '[data-act="chisel-' + word + '"]');
    say(DONE[kind] + ' ' + price + ' coin paid.', true);
  }

  function toPour(find, slot) {
    if (slot) { say(REFUSALS.worn); return; }
    if (partners(find).length === 0) { say(REFUSALS.none); return; }
    st.view = 'pour';
    st.partner = null;
    render();
  }

  async function pour(first, last) {
    const why = Items.refusal(first, 'recast', last);
    if (why !== null) { say(REFUSALS[why] || REFUSALS.change); return; }
    const price = Items.price(first, 'recast', last);
    if (!(save().account.coin >= price)) { say(short(price)); return; }
    const ok = await UI.confirm('Pour the ' + nameOf(first) + ' first and the ' + nameOf(last) + ' after it? Both are gone into the new find. ' + price + ' coin.',
      { yes: 'Pour them', no: 'Keep them' });
    if (!ok || st === null) return;
    const made = Items.recast(first, last, SaveData.uid(save()));
    if (made === null) { say(REFUSALS.change); return; }
    const list = chest().finds;
    for (let i = list.length - 1; i >= 0; i--) if (list[i].uid === first.uid || list[i].uid === last.uid) list.splice(i, 1);
    list.push(made);
    save().account.coin -= price;
    write();
    st.view = 'find';
    st.uid = made.uid;
    st.place = -1;
    st.partner = null;
    render();
    say('Recast. ' + price + ' coin paid.', true);
  }

  function back() {
    if (st === null) return;
    if (st.view === 'pour') { st.view = 'find'; render('[data-act="recast"]'); return; }
    if (st.view === 'find') {
      const uid = st.uid;
      st.view = 'list';
      st.place = -1;
      render('[data-uid="' + uid + '"]');
      return;
    }
    UI.close('finds');
  }

  UI.screen('finds', {
    open: function (args) {
      const char = (args && args.char) || Game.char;
      const panel = UI.h('div', { class: 'ui-panel fnd', dataset: { char: char ? String(char.uid) : '' } });
      st = { char, panel, view: 'list', uid: null, place: -1, partner: null };
      if (!char || !save()) {
        panel.appendChild(UI.h('p', { class: 'ui-sub' }, 'Nobody is at the Lantern.'));
        panel.appendChild(UI.button('Back', function () { UI.close('finds'); }, { class: 'second' }));
        return panel;
      }
      listView(panel);
      return panel;
    },
    close: function () { st = null; },
    back: back,
  });
})();
