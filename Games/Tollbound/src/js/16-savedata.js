// 16-savedata.js: the save of the Household as versioned JSON: a blank one, the uids it gives out, the migrations from
// older versions, the check that trusts nothing it is given and never throws, and the text of an export. It reads
// and writes no storage: 90-game.js keeps the save through Store (50-platform.js), under SaveData.KEY.
// Owns: SaveData
// Public:
//   SaveData.VERSION = 2              the version this file writes
//   SaveData.KEY = 'save'             the Store key the game keeps the save under (the settings keep their own)
//   SaveData.LIMITS                   the most a save may hold: {chars, register, finds, voices, bells, walk, text,
//                                     errors (the problems one check reports at most)}
//   SaveData.blank() -> Save          a Household with nobody in it yet: no characters, an empty chest, no coin or
//                                     Hum, the tenor pit open (the one pit that opens from none, when there is one) and
//                                     one ringing place
//   SaveData.uid(save) -> number      the next uid of the save: characters, finds, voices and bells share one counter
//   SaveData.clone(value) -> copy     a deep copy, through JSON
//   SaveData.MIGRATIONS               [{from, to, what, up(raw, notes) -> raw}]: each brings a save of one version to
//                                     the next. Version 1 is the first plan's placeholder (docs/plan.md, Appendix B).
//   SaveData.migrate(raw) -> {save, errors, notes}   a copy of raw brought up to VERSION, or save null and why;
//                                     notes tell what a migration had to leave behind
//   SaveData.validate(raw) -> [string]   every problem of a save of this version, each "where: what" (at most
//                                     LIMITS.errors); [] when it is sound. It never throws: whatever raw is, it answers.
//   SaveData.read(raw) -> {save, errors, notes}   migrate, then validate: save is null unless both are clean
//   SaveData.encode(save) -> text     the text of an export: a first line "TOLLBOUND SAVE <v> <check>", then the JSON
//   SaveData.decode(text) -> {save, errors, notes}   an import: the text read (with its check if it has the first
//                                     line; plain JSON is read too), migrated and validated. Never throws.
//
// Save = {
//   v, rev,                    the version, and the writes so far (the game adds 1 at every write)
//   uid,                       the last uid given out
//   chars: [Char],             the standing characters, in the order they were made (14-character.js has the shape)
//   register: [Death],         the dead and the retired, in the order they left: the Register
//   chest: {finds: [Find], voices: [VoiceInst], knots: {[knotId]: n}}   the Household's chest: banked finds, the worn
//                              finds of the dead, and what characters gave it
//   account: {coin, hum, heard, frame: {pits: [pitId], places, bells: [Bell]}, open: {classes, bases, observances,
//             bills: [{zone, causes}]}, bequests: {[id]: {n, done}}}
//                              the Household's money; Hum held, and all Hum ever heard; the Bellframe (open pits, ringing
//                              places bought, every bell cast, hung in a pit or not); what bequests opened; bequests
//   active: uid | null,        the character last chosen
//   away: null | {char, zone, seed, hum, heard, level, tolls}   a vigil under way (Char.begin sets it, Char.end clears
//                              it): the Hum and the level it began with, and the tolls heard by the last checkpoint
// }
// What the check holds a save to beyond each field's type: every uid is unique and no higher than save.uid; every id
// names a definition that exists (a death's and a bell's ids are history and need only be ids); a character's route
// starts at its class's door, steps only between linked nodes, holds a node at most twice and spends no more points
// than it has; a lane on the route has its attribute chosen; a worn find sits in a place its base fits; a voice's rope
// is what its level gives, and each knot tied fits it; the loadout names the character's own voices, each once, and
// none in a place its level has not opened; the observances it keeps are ones it knows; the bells it rang are bells
// of the frame; a bell hangs in an open pit, one bell a pit; every open pit opens from another open one; the active
// character and the one away stand in the Household.
(function () {
  'use strict';

  const VERSION = 2, KEY = 'save';
  const LIMITS = Object.freeze({ chars: 100, register: 5000, finds: 5000, voices: 1000, bells: 5000, walk: 2000, text: 8000000, errors: 50 });
  const ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
  const HEADER = /^TOLLBOUND SAVE (\d+) ([0-9a-f]{8})[ \t]*\r?\n/;
  const BIG = 1e12;
  const OPS = ['flat', 'inc', 'more', 'set'];

  const SAVE_FIELDS = ['v', 'rev', 'uid', 'chars', 'register', 'chest', 'account', 'active', 'away'];
  const CHAR_FIELDS = ['uid', 'name', 'class', 'calling', 'callingPoints', 'callingNodes', 'peals', 'level', 'xp', 'planPoints', 'plan',
    'worn', 'voices', 'loadout', 'knots', 'observances', 'known', 'bells', 'mourning', 'tolls', 'vigils', 'bequests'];
  const FIND_FIELDS = ['uid', 'base', 'level', 'fixed', 'lines', 'gone', 'walk', 'cool'];
  const LINE_FIELDS = ['stat', 'op', 'value', 'tags', 'cond', 'posture', 'toll', 'backward', 'struck', 'band'];
  const VOICE_FIELDS = ['uid', 'id', 'level', 'rope', 'knots', 'tolls'];
  const BELL_FIELDS = ['uid', 'of', 'name', 'class', 'calling', 'weight', 'gift', 'pit', 'double', 'known'];
  const DEATH_FIELDS = ['uid', 'name', 'class', 'calling', 'level', 'tolls', 'vigils', 'zone', 'toll', 'cause', 'how', 'bell'];
  const ACCOUNT_FIELDS = ['coin', 'hum', 'heard', 'frame', 'open', 'bequests'];
  const AWAY_FIELDS = ['char', 'zone', 'seed', 'hum', 'heard', 'level', 'tolls'];

  SaveData.VERSION = VERSION;
  SaveData.KEY = KEY;
  SaveData.LIMITS = LIMITS;

  const clone = (v) => JSON.parse(JSON.stringify(v));
  SaveData.clone = clone;

  function tenorPit() {
    const pits = Defs.all('pit');
    for (let i = 0; i < pits.length; i++) if (pits[i].from === null) return pits[i].id;
    return null;
  }

  SaveData.blank = function () {
    const tenor = tenorPit();
    return {
      v: VERSION, rev: 0, uid: 0, chars: [], register: [],
      chest: { finds: [], voices: [], knots: {} },
      account: {
        coin: 0, hum: 0, heard: 0, frame: { pits: tenor === null ? [] : [tenor], places: 1, bells: [] },
        open: { classes: [], bases: [], observances: [], bills: [] }, bequests: {},
      },
      active: null, away: null,
    };
  };

  SaveData.uid = function (save) {
    save.uid = (save.uid >= 0 ? Math.floor(save.uid) : 0) + 1;
    return save.uid;
  };

  // ---- reading values that may be anything ----

  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  // a plain object: what JSON makes (its prototype is an Object.prototype of some realm, or null)
  function isObj(v) {
    if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
    const p = Object.getPrototypeOf(v);
    return p === null || Object.getPrototypeOf(p) === null;
  }
  const int = (v, lo, hi) => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
  const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
  const isId = (v) => typeof v === 'string' && v.length <= 120 && ID.test(v);
  const ref = (kind, v) => isId(v) && Defs.has(kind, v);
  const join = (path, key) => path + '.' + key;
  function show(v) {
    let s;
    try { s = JSON.stringify(v); } catch (e) { s = undefined; }
    if (typeof s !== 'string') s = typeof v === 'number' ? String(v) : typeof v;
    return s.length > 40 ? s.slice(0, 37) + '...' : s;
  }
  const message = (e) => (e && typeof e.message === 'string' ? e.message : String(e));

  // a plain object with every field of names, and with no others but those of optional. false when a field it needs
  // is missing, so that what is inside is not looked at.
  function shape(v, path, names, say, optional) {
    if (!isObj(v)) { say(path, 'must be an object, not ' + show(v)); return false; }
    let whole = true;
    for (let i = 0; i < names.length; i++) if (!own(v, names[i])) { say(join(path, names[i]), 'is missing'); whole = false; }
    for (const k of Object.keys(v)) if (names.indexOf(k) < 0 && (!optional || optional.indexOf(k) < 0)) say(join(path, k), 'is not a field of this shape');
    return whole;
  }

  function list(v, path, most, say) {
    if (!Array.isArray(v)) { say(path, 'must be a list, not ' + show(v)); return false; }
    if (v.length > most) { say(path, 'holds ' + v.length + ' entries, more than the ' + most + ' a save may hold'); return false; }
    return true;
  }

  function ids(v, path, kind, most, say) {
    if (!list(v, path, most, say)) return;
    for (let i = 0; i < v.length; i++) {
      if (!ref(kind, v[i])) say(path + '[' + i + ']', 'names the ' + kind + ' ' + show(v[i]) + ', and there is none');
      else if (v.indexOf(v[i]) !== i) say(path + '[' + i + ']', 'names ' + show(v[i]) + ' twice');
    }
  }

  // a map from ids of a kind (null: any id) to whole numbers within lo..hi
  function counts(v, path, kind, lo, hi, say) {
    if (!isObj(v)) { say(path, 'must be an object, not ' + show(v)); return; }
    for (const k of Object.keys(v)) {
      if (kind === null ? !isId(k) : !ref(kind, k)) say(join(path, k), '(the key) names no ' + (kind || 'id'));
      else if (!int(v[k], lo, hi)) say(join(path, k), 'must be a whole number from ' + lo + ' to ' + hi + ', not ' + show(v[k]));
    }
  }

  function conds(v) {
    if (typeof v === 'string') return Stats.is('cond', v);
    if (!Array.isArray(v) || v.length < 1 || v.length > 31) return false;
    for (let i = 0; i < v.length; i++) if (!Stats.is('cond', v[i])) return false;
    return true;
  }

  function tags(v) {
    if (!Array.isArray(v) || v.length > 41) return false;
    for (let i = 0; i < v.length; i++) if (!Stats.is('tag', v[i])) return false;
    return true;
  }

  // a value: a number, or [low, high] on a stat that takes a range
  function value(v, stat) {
    if (typeof v === 'number') return Number.isFinite(v) && Math.abs(v) <= BIG;
    const row = Stats.stat(stat);
    return Array.isArray(v) && v.length === 2 && num(v[0], -BIG, BIG) && num(v[1], -BIG, BIG) && v[0] <= v[1] && row !== null && row.range === true;
  }

  // ---- the parts of a save ----

  function checkMod(m, path, say) {
    if (!shape(m, path, ['stat', 'op', 'value'], say, ['tags', 'cond', 'unless'])) return;
    if (typeof m.stat !== 'string' || Stats.stat(m.stat) === null) return say(path + '.stat', show(m.stat) + ' is not a stat');
    if (OPS.indexOf(m.op) < 0) say(path + '.op', show(m.op) + ' is not one of ' + OPS.join(', '));
    if (!value(m.value, m.stat)) say(path + '.value', 'must be a number (or a pair on a range stat), not ' + show(m.value));
    if (own(m, 'tags') && !tags(m.tags)) say(path + '.tags', 'must be a list of tags, not ' + show(m.tags));
    if (own(m, 'cond') && !conds(m.cond)) say(path + '.cond', show(m.cond) + ' is not a condition, or a list of them');
    if (own(m, 'unless') && !conds(m.unless)) say(path + '.unless', show(m.unless) + ' is not a condition, or a list of them');
  }

  function checkLine(l, path, say) {
    if (!shape(l, path, LINE_FIELDS, say)) return;
    if (typeof l.stat !== 'string' || Stats.stat(l.stat) === null) return say(path + '.stat', show(l.stat) + ' is not a stat');
    if (l.op !== 'flat' && l.op !== 'inc') say(path + '.op', 'a written line adds with flat or inc, not ' + show(l.op));
    if (!value(l.value, l.stat)) say(path + '.value', 'must be a number (or a pair on a range stat), not ' + show(l.value));
    if (!tags(l.tags)) say(path + '.tags', 'must be a list of tags, not ' + show(l.tags));
    if (typeof l.cond !== 'string' || !Stats.is('cond', l.cond)) say(path + '.cond', show(l.cond) + ' is not a condition');
    if (!Stats.is('posture', l.posture)) say(path + '.posture', show(l.posture) + ' is not a posture that writes lines');
    if (!int(l.toll, 1, 1e6)) say(path + '.toll', 'must be the toll it was written at, from 1, not ' + show(l.toll));
    if (l.backward !== true && l.backward !== false) say(path + '.backward', 'must be true or false, not ' + show(l.backward));
    if (l.struck !== null && l.struck !== 'object' && l.struck !== 'condition') say(path + '.struck', 'must be null, "object" or "condition", not ' + show(l.struck));
    if (!Array.isArray(l.band) || l.band.length !== 2 || !num(l.band[0], -BIG, BIG) || !num(l.band[1], -BIG, BIG) || l.band[0] > l.band[1]) {
      say(path + '.band', 'must be [low, high], not ' + show(l.band));
    }
  }

  function checkFind(f, path, c, slot) {
    const say = c.say;
    if (!shape(f, path, FIND_FIELDS, say)) return;
    c.uid(f.uid, path + '.uid');
    if (!ref('base', f.base)) return say(path + '.base', 'names the base ' + show(f.base) + ', and there is none');
    const base = Defs.get('base', f.base);
    if (slot !== null && (base.slot === 'token' ? slot !== 'token-1' && slot !== 'token-2' : base.slot !== slot)) {
      say(path + '.base', '"' + f.base + '" is worn in ' + slot + ', but its slot is ' + base.slot);
    }
    if (!int(f.level, 1, 70)) say(path + '.level', 'must be a whole number from 1 to 70, not ' + show(f.level));
    checkMod(f.fixed, path + '.fixed', say);
    if (!Array.isArray(f.lines) || f.lines.length !== 8) return say(path + '.lines', 'must hold 8 places, not ' + show(f.lines));
    for (let i = 0; i < 8; i++) if (f.lines[i] !== null) checkLine(f.lines[i], path + '.lines[' + i + ']', say);
    if (list(f.gone, path + '.gone', 8, say)) {
      for (let i = 0; i < f.gone.length; i++) {
        const g = f.gone[i];
        if (!int(g, 0, 7) || f.gone.indexOf(g) !== i) say(path + '.gone[' + i + ']', 'must be a place from 0 to 7, once, not ' + show(g));
        else if (f.lines[g] !== null) say(path + '.lines[' + g + ']', 'holds a line, but the place is erased for good');
      }
    }
    if (!int(f.walk, -1, 7)) say(path + '.walk', 'must be -1 or a place from 0 to 7, not ' + show(f.walk));
    else if (f.walk >= 0 && Array.isArray(f.gone) && f.gone.indexOf(f.walk) >= 0) say(path + '.walk', 'is a place erased for good');
    if (!int(f.cool, 0, 4)) say(path + '.cool', 'must be a whole number from 0 to 4, not ' + show(f.cool));
  }

  function checkVoice(v, path, c) {
    const say = c.say;
    if (!shape(v, path, VOICE_FIELDS, say)) return;
    c.uid(v.uid, path + '.uid');
    if (!ref('voice', v.id)) return say(path + '.id', 'names the voice ' + show(v.id) + ', and there is none');
    if (!int(v.level, 1, 20)) return say(path + '.level', 'must be a whole number from 1 to 20, not ' + show(v.level));
    if (v.rope !== Char.rope(v.level)) say(path + '.rope', 'must be ' + Char.rope(v.level) + ', the rope of a voice of level ' + v.level + ', not ' + show(v.rope));
    if (!int(v.tolls, 0, BIG)) say(path + '.tolls', 'must be a whole number, not ' + show(v.tolls));
    if (!Array.isArray(v.knots) || v.knots.length !== v.rope) return say(path + '.knots', 'must hold a place for each knot of its rope, not ' + show(v.knots));
    const def = Defs.get('voice', v.id);
    for (let i = 0; i < v.knots.length; i++) {
      const k = v.knots[i];
      if (k === null) continue;
      if (!ref('knot', k)) say(path + '.knots[' + i + ']', 'names the knot ' + show(k) + ', and there is none');
      else if (!Stats.fits(def, Defs.get('knot', k))) say(path + '.knots[' + i + ']', '"' + k + '" does not fit the voice "' + v.id + '"');
    }
  }

  function checkPlan(plan, path, char, say) {
    if (!shape(plan, path, ['walk', 'choice'], say)) return;
    const walk = plan.walk;
    if (list(walk, path + '.walk', LIMITS.walk, say)) {
      let sound = true;
      for (let i = 0; i < walk.length && sound; i++) {
        if (!ref('node', walk[i])) { say(path + '.walk[' + i + ']', 'names the node ' + show(walk[i]) + ', and there is none'); sound = false; }
      }
      if (sound && walk.length > 0) {
        const door = Defs.get('node', walk[0]);
        if (door.kind !== 'door' || door.class !== char.class) say(path + '.walk[0]', '"' + walk[0] + '" is not the door of the ' + char.class);
        for (let i = 1; i < walk.length; i++) {
          if (Defs.get('node', walk[i - 1]).links.indexOf(walk[i]) < 0) say(path + '.walk[' + i + ']', '"' + walk[i] + '" is not linked to "' + walk[i - 1] + '"');
          let n = 0;
          for (let k = 0; k <= i; k++) if (walk[k] === walk[i]) n++;
          if (n === 3) say(path + '.walk[' + i + ']', 'holds "' + walk[i] + '" a third time: a node is doubled once at most');
        }
        if (int(char.level, 1, 70) && int(char.planPoints, 0, 1000) && walk.length - 1 > char.level - 1 + char.planPoints) {
          say(path + '.walk', 'spends ' + (walk.length - 1) + ' points, more than the ' + (char.level - 1 + char.planPoints) + ' it has');
        }
      }
      if (isObj(plan.choice)) {
        for (const k of Object.keys(plan.choice)) {
          const node = ref('node', k) ? Defs.get('node', k) : null;
          if (node === null || walk.indexOf(k) < 0) say(path + '.choice.' + k, '(the key) is not a node of the route');
          else if (node.choice === null || node.choice.indexOf(plan.choice[k]) < 0) say(path + '.choice.' + k, show(plan.choice[k]) + ' is not an attribute that lane offers');
        }
        for (let i = 0; i < walk.length; i++) {
          if (ref('node', walk[i]) && Defs.get('node', walk[i]).choice !== null && !own(plan.choice, walk[i])) say(path + '.choice', 'has no attribute chosen for the lane "' + walk[i] + '"');
        }
      } else say(path + '.choice', 'must be an object, not ' + show(plan.choice));
    }
  }

  function checkChar(ch, path, c) {
    const say = c.say;
    if (!shape(ch, path, CHAR_FIELDS, say)) return;
    c.uid(ch.uid, path + '.uid');
    if (typeof ch.name !== 'string' || ch.name.trim() !== ch.name || ch.name.length < 1 || ch.name.length > 24 || /[\u0000-\u001f\u007f]/.test(ch.name)) {
      say(path + '.name', 'must be a name of 1 to 24 letters, not ' + show(ch.name));
    }
    if (!ref('class', ch.class)) return say(path + '.class', 'names the class ' + show(ch.class) + ', and there is none');
    const cls = Defs.get('class', ch.class);
    let calling = null;
    if (ch.calling !== null) {
      if (!ref('calling', ch.calling) || cls.callings.indexOf(ch.calling) < 0) say(path + '.calling', show(ch.calling) + ' is not a calling of the ' + ch.class);
      else calling = Defs.get('calling', ch.calling);
    }
    if (!int(ch.callingPoints, 0, calling ? calling.points : 0)) say(path + '.callingPoints', 'must be a whole number from 0 to its calling\'s points, not ' + show(ch.callingPoints));
    if (list(ch.callingNodes, path + '.callingNodes', 64, say)) {
      for (let i = 0; i < ch.callingNodes.length; i++) {
        const key = ch.callingNodes[i];
        if (calling === null || !calling.nodes.some((n) => n.key === key) || ch.callingNodes.indexOf(key) !== i) say(path + '.callingNodes[' + i + ']', show(key) + ' is not a node of its calling, once');
      }
    }
    ids(ch.peals, path + '.peals', 'peal', 64, say);
    if (!int(ch.level, 1, 70)) say(path + '.level', 'must be a whole number from 1 to 70, not ' + show(ch.level));
    if (!num(ch.xp, 0, BIG)) say(path + '.xp', 'must be a number of 0 or more, not ' + show(ch.xp));
    if (!int(ch.planPoints, 0, 1000)) say(path + '.planPoints', 'must be a whole number from 0 to 1000, not ' + show(ch.planPoints));
    checkPlan(ch.plan, path + '.plan', ch, say);
    if (shape(ch.worn, path + '.worn', Char.SLOTS, say)) {
      for (let i = 0; i < Char.SLOTS.length; i++) {
        const f = ch.worn[Char.SLOTS[i]];
        if (f !== null) checkFind(f, path + '.worn.' + Char.SLOTS[i], c, Char.SLOTS[i]);
      }
    }
    const mine = [];
    if (list(ch.voices, path + '.voices', 64, say)) {
      for (let i = 0; i < ch.voices.length; i++) {
        checkVoice(ch.voices[i], path + '.voices[' + i + ']', c);
        if (isObj(ch.voices[i])) mine.push(ch.voices[i].uid);
      }
    }
    if (!Array.isArray(ch.loadout) || ch.loadout.length !== 6) say(path + '.loadout', 'must hold its six places, not ' + show(ch.loadout));
    else {
      const open = int(ch.level, 1, 70) ? Char.places(ch) : 6;
      for (let i = 0; i < 6; i++) {
        const u = ch.loadout[i];
        if (u === null) continue;
        if (mine.indexOf(u) < 0) say(path + '.loadout[' + i + ']', 'names ' + show(u) + ', which is none of its voices');
        else if (ch.loadout.indexOf(u) !== i) say(path + '.loadout[' + i + ']', 'names ' + u + ' a second time');
        else if (i >= open) say(path + '.loadout[' + i + ']', 'is a place its level has not opened');
      }
    }
    counts(ch.knots, path + '.knots', 'knot', 1, 9999, say);
    ids(ch.known, path + '.known', 'observance', 64, say);
    ids(ch.observances, path + '.observances', 'observance', 16, say);
    if (Array.isArray(ch.observances) && Array.isArray(ch.known)) {
      let heed = 0;
      for (let i = 0; i < ch.observances.length; i++) {
        if (ch.known.indexOf(ch.observances[i]) < 0) say(path + '.observances[' + i + ']', show(ch.observances[i]) + ' is kept but not known');
        if (ref('observance', ch.observances[i])) heed += Defs.get('observance', ch.observances[i]).heed;
      }
      if (heed > Stats.stat('heed-max').max) say(path + '.observances', 'hold ' + heed + ' Heed, more than any character has');
    }
    if (list(ch.bells, path + '.bells', 8, say)) {
      for (let i = 0; i < ch.bells.length; i++) {
        if (c.bells.indexOf(ch.bells[i]) < 0 || ch.bells.indexOf(ch.bells[i]) !== i) say(path + '.bells[' + i + ']', show(ch.bells[i]) + ' is not a bell of the frame, once');
      }
    }
    if (ch.mourning !== null && (!shape(ch.mourning, path + '.mourning', ['term', 'left'], say) || !int(ch.mourning.term, 1, 7) || !int(ch.mourning.left, 1, ch.mourning.term))) {
      say(path + '.mourning', 'must be null or {term, left}, left from 1 to term, not ' + show(ch.mourning));
    }
    if (!int(ch.tolls, 0, BIG)) say(path + '.tolls', 'must be a whole number, not ' + show(ch.tolls));
    if (!int(ch.vigils, 0, BIG)) say(path + '.vigils', 'must be a whole number, not ' + show(ch.vigils));
    checkBequests(ch.bequests, path + '.bequests', say);
  }

  function checkBequests(b, path, say) {
    if (!isObj(b)) return say(path, 'must be an object, not ' + show(b));
    for (const k of Object.keys(b)) {
      if (!ref('bequest', k)) { say(join(path, k), '(the key) names no bequest'); continue; }
      if (shape(b[k], join(path, k), ['n', 'done'], say) && (!int(b[k].n, 0, BIG) || (b[k].done !== true && b[k].done !== false))) {
        say(join(path, k), 'must be {n: a whole number, done: true or false}, not ' + show(b[k]));
      }
    }
  }

  function checkBell(b, path, c, pits, hung) {
    const say = c.say;
    if (!shape(b, path, BELL_FIELDS, say)) return;
    c.uid(b.uid, path + '.uid');
    if (!int(b.of, 1, BIG)) say(path + '.of', 'must be the uid of the character it was, not ' + show(b.of));
    if (typeof b.name !== 'string' || b.name.length > 24) say(path + '.name', 'must be a name, not ' + show(b.name));
    if (!isId(b.class)) say(path + '.class', 'must be an id, not ' + show(b.class));
    if (b.calling !== null && !isId(b.calling)) say(path + '.calling', 'must be null or an id, not ' + show(b.calling));
    if (!int(b.weight, 0, BIG)) say(path + '.weight', 'must be the tolls it heard, not ' + show(b.weight));
    if (b.gift !== null && !ref('gift', b.gift)) say(path + '.gift', 'names the gift ' + show(b.gift) + ', and there is none');
    if (b.pit !== null) {
      if (pits.indexOf(b.pit) < 0) say(path + '.pit', show(b.pit) + ' is not an open pit');
      else if (hung.indexOf(b.pit) >= 0) say(path + '.pit', '"' + b.pit + '" holds another bell already');
      else hung.push(b.pit);
    }
    if (b.double !== true && b.double !== false) say(path + '.double', 'must be true or false, not ' + show(b.double));
    if (!list(b.known, path + '.known', 64, say)) return;
    for (let i = 0; i < b.known.length; i++) if (!isId(b.known[i])) say(path + '.known[' + i + ']', 'must be an id, not ' + show(b.known[i]));
  }

  function checkDeath(d, path, c) {
    const say = c.say;
    if (!shape(d, path, DEATH_FIELDS, say)) return;
    c.uid(d.uid, path + '.uid');
    if (typeof d.name !== 'string' || d.name.length > 24) say(path + '.name', 'must be a name, not ' + show(d.name));
    if (!isId(d.class)) say(path + '.class', 'must be an id, not ' + show(d.class));
    if (d.calling !== null && !isId(d.calling)) say(path + '.calling', 'must be null or an id, not ' + show(d.calling));
    if (!int(d.level, 1, 70)) say(path + '.level', 'must be a whole number from 1 to 70, not ' + show(d.level));
    if (!int(d.tolls, 0, BIG) || !int(d.vigils, 0, BIG) || !int(d.toll, 0, BIG)) say(path, 'must count its tolls, vigils and the toll it left at in whole numbers');
    if (d.zone !== null && !isId(d.zone)) say(path + '.zone', 'must be null or an id, not ' + show(d.zone));
    if (d.how !== 'died' && d.how !== 'retired') say(path + '.how', 'must be "died" or "retired", not ' + show(d.how));
    if (d.cause !== null && (!shape(d.cause, path + '.cause', ['attack', 'kind'], say) || (d.cause.attack !== null && !isId(d.cause.attack)) || !Stats.is('harm', d.cause.kind))) {
      say(path + '.cause', 'must be null or {attack: an id or null, kind: a kind of harm}, not ' + show(d.cause));
    }
    if (c.bells.indexOf(d.bell) < 0) say(path + '.bell', show(d.bell) + ' is not a bell of the frame');
  }

  function checkAccount(a, path, c) {
    const say = c.say;
    if (!shape(a, path, ACCOUNT_FIELDS, say)) return false;
    for (const k of ['coin', 'hum', 'heard']) if (!num(a[k], 0, BIG)) say(join(path, k), 'must be a number from 0 to ' + BIG + ', not ' + show(a[k]));
    if (shape(a.frame, path + '.frame', ['pits', 'places', 'bells'], say)) {
      const f = a.frame, most = Defs.has('bellframe', 'main') ? Defs.get('bellframe', 'main').placesMost : 8;
      ids(f.pits, path + '.frame.pits', 'pit', 1000, say);
      if (Array.isArray(f.pits)) {
        for (let i = 0; i < f.pits.length; i++) {
          if (!ref('pit', f.pits[i])) continue;
          const from = Defs.get('pit', f.pits[i]).from;
          if (from !== null && f.pits.indexOf(from) < 0) say(path + '.frame.pits[' + i + ']', '"' + f.pits[i] + '" opens from "' + from + '", which is not open');
        }
      }
      if (!int(f.places, 1, most)) say(path + '.frame.places', 'must be a whole number from 1 to ' + most + ', not ' + show(f.places));
      if (list(f.bells, path + '.frame.bells', LIMITS.bells, say)) {
        const pits = Array.isArray(f.pits) ? f.pits : [], hung = [];
        for (let i = 0; i < f.bells.length; i++) {
          checkBell(f.bells[i], path + '.frame.bells[' + i + ']', c, pits, hung);
          if (isObj(f.bells[i])) c.bells.push(f.bells[i].uid);
        }
      }
    }
    if (shape(a.open, path + '.open', ['classes', 'bases', 'observances', 'bills'], say)) {
      ids(a.open.classes, path + '.open.classes', 'class', 100, say);
      ids(a.open.bases, path + '.open.bases', 'base', 5000, say);
      ids(a.open.observances, path + '.open.observances', 'observance', 500, say);
      if (list(a.open.bills, path + '.open.bills', 500, say)) {
        for (let i = 0; i < a.open.bills.length; i++) {
          const b = a.open.bills[i], at = path + '.open.bills[' + i + ']';
          if (!shape(b, at, ['zone', 'causes'], say)) continue;
          if (!ref('zone', b.zone)) say(at + '.zone', 'names the zone ' + show(b.zone) + ', and there is none');
          if (!Array.isArray(b.causes) || b.causes.length < 1 || b.causes.length > 4) say(at + '.causes', 'must hold one to four causes, not ' + show(b.causes));
          else ids(b.causes, at + '.causes', 'cause', 4, say);
        }
      }
    }
    checkBequests(a.bequests, path + '.bequests', say);
    return true;
  }

  function checkSave(s, say) {
    if (!shape(s, 'save', SAVE_FIELDS, say)) return;
    if (s.v !== VERSION) return say('save.v', 'must be ' + VERSION + ', not ' + show(s.v));
    if (!int(s.rev, 0, BIG)) say('save.rev', 'must be a whole number, not ' + show(s.rev));
    const top = int(s.uid, 0, BIG) ? s.uid : 0;
    if (!int(s.uid, 0, BIG)) say('save.uid', 'must be a whole number, not ' + show(s.uid));
    const seen = new Map();
    const c = {
      say, bells: [],
      uid: function (v, path) {
        if (!int(v, 1, top)) say(path, 'must be a whole number from 1 to save.uid (' + top + '), not ' + show(v));
        else if (seen.has(v)) say(path, 'is ' + v + ', the uid of ' + seen.get(v) + ' as well');
        else seen.set(v, path);
      },
    };
    checkAccount(s.account, 'save.account', c);
    const standing = [];
    if (list(s.chars, 'save.chars', LIMITS.chars, say)) {
      for (let i = 0; i < s.chars.length; i++) {
        checkChar(s.chars[i], 'save.chars[' + i + ']', c);
        if (isObj(s.chars[i])) standing.push(s.chars[i].uid);
      }
    }
    if (list(s.register, 'save.register', LIMITS.register, say)) for (let i = 0; i < s.register.length; i++) checkDeath(s.register[i], 'save.register[' + i + ']', c);
    if (shape(s.chest, 'save.chest', ['finds', 'voices', 'knots'], say)) {
      if (list(s.chest.finds, 'save.chest.finds', LIMITS.finds, say)) for (let i = 0; i < s.chest.finds.length; i++) checkFind(s.chest.finds[i], 'save.chest.finds[' + i + ']', c, null);
      if (list(s.chest.voices, 'save.chest.voices', LIMITS.voices, say)) for (let i = 0; i < s.chest.voices.length; i++) checkVoice(s.chest.voices[i], 'save.chest.voices[' + i + ']', c);
      counts(s.chest.knots, 'save.chest.knots', 'knot', 1, 99999, say);
    }
    if (s.active !== null && standing.indexOf(s.active) < 0) say('save.active', show(s.active) + ' is no standing character');
    if (s.away !== null && shape(s.away, 'save.away', AWAY_FIELDS, say)) {
      const w = s.away;
      if (standing.indexOf(w.char) < 0) say('save.away.char', show(w.char) + ' is no standing character');
      if (!ref('zone', w.zone)) say('save.away.zone', 'names the zone ' + show(w.zone) + ', and there is none');
      if (!(num(w.seed, -BIG * 1e3, BIG * 1e3) || (typeof w.seed === 'string' && w.seed.length <= 200))) say('save.away.seed', 'must be a number or a short text, not ' + show(w.seed));
      if (!num(w.hum, 0, BIG) || !num(w.heard, 0, BIG)) say('save.away', 'must hold the Hum the vigil began with');
      if (!int(w.level, 1, 70)) say('save.away.level', 'must be a level, not ' + show(w.level));
      if (!int(w.tolls, 0, BIG)) say('save.away.tolls', 'must be a whole number, not ' + show(w.tolls));
    }
  }

  SaveData.validate = function (raw) {
    const errors = [];
    const say = (path, problem) => { if (errors.length < LIMITS.errors) errors.push(path + ' ' + problem); };
    try {
      checkSave(raw, say);
    } catch (e) {
      errors.push('the save could not be read: ' + message(e));
    }
    return errors;
  };

  // ---- migrations ----

  // Version 1: the first plan's placeholder shape (docs/plan.md, Appendix B). No build ever wrote one; this brings
  // over what has a successor and notes what does not.
  function fromFirstPlan(old, notes) {
    const s = SaveData.blank(), account = isObj(old.account) ? old.account : {}, legacy = isObj(account.legacy) ? account.legacy : {};
    const amount = (v) => (num(v, 0, BIG) ? v : 0);
    s.rev = int(old.rev, 0, BIG) ? old.rev : 0;
    s.account.coin = amount(account.gold);
    s.account.hum = s.account.heard = amount(legacy.echoes);
    if (isObj(account.unlocks) && Array.isArray(account.unlocks.classes)) {
      for (const id of account.unlocks.classes) if (ref('class', id) && s.account.open.classes.indexOf(id) < 0) s.account.open.classes.push(id);
    }
    if (isObj(account.deeds)) {
      for (const id of Object.keys(account.deeds)) {
        const d = account.deeds[id];
        if (ref('bequest', id) && isObj(d)) s.account.bequests[id] = { n: int(d.n, 0, BIG) ? d.n : 0, done: d.done === true };
      }
    }
    if (Array.isArray(account.stash) && account.stash.length > 0) notes.push('the ' + account.stash.length + ' items of the old stash have no written lines, and were left behind');
    const uids = new Map();                          // an old character's uid -> its new one
    for (const c of Array.isArray(old.chars) ? old.chars : []) {
      if (!isObj(c) || !ref('class', c.class)) { notes.push('a character of the class ' + show(isObj(c) ? c.class : c) + ' was left behind: there is no such class'); continue; }
      const name = typeof c.name === 'string' && c.name.trim() !== '' ? c.name.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 24) : 'Ringer';
      const made = Char.create(s, c.class, name || 'Ringer', []);
      if (made === null) { notes.push('the character ' + show(c.name) + ' could not be made again'); continue; }
      if (int(c.uid, 1, BIG)) uids.set(c.uid, made.uid);
      made.level = int(c.level, 1, 70) ? c.level : 1;
      made.xp = num(c.xp, 0, BIG) ? c.xp : 0;
      made.planPoints = int(c.bonusPoints, 0, 1000) ? c.bonusPoints : 0;
      if (Array.isArray(c.tree) && c.tree.length > 0) notes.push(made.name + ': the first plan\'s tree is not the Plan; its points are free to walk again');
      const voices = [], loadout = [null, null, null, null, null, null];
      for (const sg of Array.isArray(c.sigils) ? c.sigils : []) {
        if (!isObj(sg) || !ref('voice', sg.id)) continue;
        const v = Char.voice(SaveData.uid(s), sg.id), level = int(sg.level, 1, 20) ? sg.level : 1;
        v.level = level;
        v.tolls = (level - 1) * 8;
        v.rope = Char.rope(level);
        while (v.knots.length < v.rope) v.knots.push(null);
        voices.push(v);
        if (Array.isArray(c.loadout)) { const at = c.loadout.indexOf(sg.uid); if (at >= 0 && at < 6) loadout[at] = v.uid; }
      }
      if (voices.length > 0) {
        made.voices = voices;
        made.loadout = loadout.map((u, i) => (i < Char.places(made) ? u : null));
      }
      if (isObj(c.bindings)) for (const id of Object.keys(c.bindings)) if (ref('knot', id) && int(c.bindings[id], 1, 9999)) made.knots[id] = c.bindings[id];
      if (isObj(c.vows)) for (const id of Object.keys(c.vows)) Char.learn(made, id);
      if (Array.isArray(c.activeVows)) for (const id of c.activeVows) if (made.known.indexOf(id) >= 0 && made.observances.indexOf(id) < 0) made.observances.push(id);
    }
    for (const f of Array.isArray(old.fallen) ? old.fallen : []) {
      if (!isObj(f)) continue;
      const of = SaveData.uid(s), cls = isId(f.class) ? f.class : 'unknown', name = typeof f.name === 'string' ? f.name.slice(0, 24) : 'Ringer';
      const bell = {
        uid: SaveData.uid(s), of, name, class: cls, calling: isId(f.calling) ? f.calling : null, weight: int(f.tolls, 0, BIG) ? f.tolls : 0,
        gift: null, pit: null, double: false, known: [],
      };
      s.account.frame.bells.push(bell);
      s.register.push({
        uid: of, name, class: cls, calling: bell.calling, level: int(f.level, 1, 70) ? f.level : 1, tolls: bell.weight, vigils: 0,
        zone: isId(f.zone) ? f.zone : null, toll: 0, cause: null, how: 'died', bell: bell.uid,
      });
    }
    s.active = uids.has(old.active) ? uids.get(old.active) : null;
    if (isObj(old.gauntlet)) notes.push('a run of the old gauntlet was under way, and was left behind');
    return s;
  }

  SaveData.MIGRATIONS = Object.freeze([
    Object.freeze({ from: 1, to: 2, what: 'the first plan\'s placeholders become the Household of docs/design/04-progression.md', up: fromFirstPlan }),
  ]);

  SaveData.migrate = function (raw) {
    const notes = [];
    try {
      if (!isObj(raw)) return { save: null, errors: ['the save must be an object, not ' + show(raw)], notes };
      let v = raw.v, cur = clone(raw);
      if (!int(v, 1, 1e6)) return { save: null, errors: ['the save has no version it can be read by (v is ' + show(v) + ')'], notes };
      if (v > VERSION) return { save: null, errors: ['the save is of version ' + v + ', newer than this game reads (' + VERSION + ')'], notes };
      while (v < VERSION) {
        const m = SaveData.MIGRATIONS.find((x) => x.from === v);
        if (m === undefined) return { save: null, errors: ['there is no way from version ' + v + ' to ' + VERSION], notes };
        cur = m.up(cur, notes);
        cur.v = m.to;
        v = m.to;
      }
      return { save: cur, errors: [], notes };
    } catch (e) {
      return { save: null, errors: ['the save could not be brought up to date: ' + message(e)], notes };
    }
  };

  SaveData.read = function (raw) {
    const m = SaveData.migrate(raw);
    if (m.save === null) return m;
    const errors = SaveData.validate(m.save);
    return errors.length > 0 ? { save: null, errors, notes: m.notes } : m;
  };

  // ---- the text of an export ----

  const hex = (n) => ('00000000' + (n >>> 0).toString(16)).slice(-8);

  SaveData.encode = function (save) {
    const body = JSON.stringify(save);
    return 'TOLLBOUND SAVE ' + save.v + ' ' + hex(Core.hashStr(body)) + '\n' + body + '\n';
  };

  SaveData.decode = function (text) {
    const fail = (why) => ({ save: null, errors: [why], notes: [] });
    try {
      if (typeof text !== 'string') return fail('the save must be given as text');
      if (text.length > LIMITS.text) return fail('the text is longer than any save can be');
      let body = text.replace(/^﻿/, '').trim();
      const head = HEADER.exec(body + '\n');
      if (head !== null) {
        body = body.slice(head[0].length).trim();
        if (hex(Core.hashStr(body)) !== head[2]) return fail('the save text was changed or cut short: its check does not match');
      }
      let raw;
      try { raw = JSON.parse(body); } catch (e) { return fail('the text is not a save: ' + message(e)); }
      return SaveData.read(raw);
    } catch (e) {
      return fail('the text could not be read: ' + message(e));
    }
  };
})();
