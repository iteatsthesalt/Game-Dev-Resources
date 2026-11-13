// 15-progress.js: bequests (docs/design/04-progression.md, "Bills and bequests"): the last wishes of the city's dead,
// each a quest-like goal counted in vigils, and what each opens or gives when it is met; the end of a vigil for them;
// and the head start the Register gives. 28-bequests.js counts them in a vigil; this file reads the counts at its end.
// Every function takes and changes plain data and keeps nothing between calls but a table built from the definitions.
// Owns: Progress
// Public:
//   Progress.endVigil(save, S, report)   Char.end calls it last (14-character.js). The vigil's counts (S.bequests, the
//                                    slot of 28-bequests.js; the tolls it had not yet seen and the vigil's end are
//                                    counted here) join the Household's (save.account.bequests, scope 'account') and
//                                    the character's (char.bequests, scope 'character': the character report.char,
//                                    if it still stands; a dead character's own count goes with it). A bequest of
//                                    where.vigil keeps the most one vigil counted; any other adds them up. Each one
//                                    met pays its reward (Progress.pay) and report.bequests lists the ids met, in
//                                    the order they were defined; the Hum it pays is added to report.hum, which is
//                                    then what the vigil brought the Household.
//   Progress.pay(save, bequestId, char, gain = 1) -> hum   what a bequest leaves: a class, a base or an observance
//                                    opened (save.account.open; an observance is also learnt by char, Char.learn), a
//                                    Bill added to open.bills, a named voice into the chest (Char.voice, with a uid
//                                    of the save), Plan points to char (char.planPoints, to 1000), coin, and Hum times
//                                    gain (account.hum and heard: all Hum is multiplied by hum-gain, and endVigil
//                                    gives the vigil's); char may be null. A reward naming content this build does
//                                    not have is left out, so that the save never names it. Returns the Hum it paid.
//   Progress.status(save, char, bequestId) -> {n, count, done, scope}   how far a bequest has come: the Household's
//                                    record, or char's (none: n 0, not done)
//   Progress.compiled() -> {list, byKind, tolls, ends, byId}   the bequests as the counting reads them, built once
//                                    from the definitions: list[i] = {def, id, on, scope, count, zone, ids, rank, least,
//                                    is, toll, vigil, sum, cls} in the order they were defined; byKind[k], the indices
//                                    of those counted on events of kind k ('toll' and 'end' left out); tolls and ends,
//                                    the indices of those on 'toll' and on 'end'; byId[id], the index of one
//   Progress.counts(c, k, a, b, id, zone, toll, cls) -> amount   what one event of kind k (fields a, b, id), heard in
//                                    the district zone at the toll toll by a character of the class cls, counts for
//                                    the bequest c (an entry of compiled().list): 0 when its where does not admit it;
//                                    else 1, or its a or b for a bequest of where.sum. Allocates nothing.
//   Progress.admits(bequestId, event, ctx) -> amount   the same for {k, a, b, id} and ctx {zone, toll, cls}
//   Progress.WHERE                   the fields a bequest's where may hold (below)
//   Progress.headStart(save) -> [{attack, kind, deaths, seconds}]   the Register's head start: for each attack that
//                                    killed a character of the Household, the deaths it dealt (three at most) and the
//                                    seconds sooner it is shown to every later character (0.15 a death), the most
//                                    first. Deaths with no attack (a press, a rider, the ground) give none.
//
// A bequest (01-defs.js) is done when `count` events of kind `on` that its `where` admits have come, in the
// Household (scope 'account') or to one character (scope 'character'). Its where (any field may be left out):
//   zone: id             only in that district
//   id: id | [id]        the event's id is this one, or one of these: a kill, the body's def; 'end', the outcome
//                        ('left', 'spared', 'died'); 'mend', 'whole' when a wound closed; a favour taken, its id
//   rank: n              a kill of a body of rank n or above (the kill's a: 1 an elite, 3 a keeper)
//   least: n, is: n      the event's a is at least n, or exactly n: 'toll' the toll's number, 'grow' the level
//                        reached, 'pull' the times the voice spoke, 'stroke' the stroke
//   toll: n              from the nth toll of the vigil on
//   vigil: true          all within one vigil: the bequest keeps the most any one vigil counted
//   sum: 'a' | 'b'       each event counts its a or its b (a stroke's b: the coin it banked) in place of 1
//   class: id            only for a character of that class
// The tolls are counted one for each toll heard (its a is the toll's number), and the end of a vigil once, as an
// event of kind 'end' (a the tolls, b the dead laid, id the outcome) when the vigil ends. A count kept in the save
// is a whole number: what a sum adds is rounded down at the end of the vigil. A vigil the page left unfinished
// (Char.abandoned) counts nothing.
(function () {
  'use strict';

  const floor = Math.floor, min = Math.min, max = Math.max;
  const MOST = 1e12, PLAN_MOST = 1000;
  const REGISTER_EARLY = 0.15, REGISTER_MOST = 3;     // the Register: 0.15 s sooner a death, three deaths at most
  const WHERE = Object.freeze(['zone', 'id', 'rank', 'least', 'is', 'toll', 'vigil', 'sum', 'class']);
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  Progress.WHERE = WHERE;

  // ---- the bequests as the counting reads them ----

  let table = null, built = -1;

  function compile(def, index) {
    const w = def.where || {};
    const ids = typeof w.id === 'string' ? [w.id] : Array.isArray(w.id) ? w.id.slice() : null;
    return {
      def, id: def.id, index, on: def.on, scope: def.scope, count: def.count,
      zone: typeof w.zone === 'string' ? w.zone : null,
      ids,
      rank: typeof w.rank === 'number' ? w.rank : -Infinity,
      least: typeof w.least === 'number' ? w.least : -Infinity,
      is: typeof w.is === 'number' ? w.is : null,
      toll: typeof w.toll === 'number' ? w.toll : 0,
      vigil: w.vigil === true,
      sum: w.sum === 'a' ? 1 : w.sum === 'b' ? 2 : 0,
      cls: typeof w.class === 'string' ? w.class : null,
    };
  }

  Progress.compiled = function () {
    const all = Defs.all('bequest');
    if (table !== null && built === all.length) return table;
    const list = [], byKind = Object.create(null), byId = Object.create(null), tolls = [], ends = [];
    for (let i = 0; i < all.length; i++) {
      const c = compile(all[i], i);
      list.push(c);
      byId[c.id] = i;
      if (c.on === 'toll') tolls.push(i);
      else if (c.on === 'end') ends.push(i);
      else (byKind[c.on] || (byKind[c.on] = [])).push(i);
    }
    table = { list, byKind, byId, tolls, ends };
    built = all.length;
    return table;
  };

  Progress.counts = function (c, k, a, b, id, zone, toll, cls) {
    if (c.zone !== null && c.zone !== zone) return 0;
    if (c.cls !== null && c.cls !== cls) return 0;
    if (toll < c.toll || a < c.least || (c.is !== null && a !== c.is)) return 0;
    if (k === 'kill' && a < c.rank) return 0;
    if (c.ids !== null && c.ids.indexOf(id) < 0) return 0;
    const amount = c.sum === 1 ? a : c.sum === 2 ? b : 1;
    return amount > 0 ? amount : 0;
  };

  Progress.admits = function (bequestId, event, ctx) {
    const t = Progress.compiled(), i = t.byId[bequestId], x = ctx || {};
    if (i === undefined || !event || event.k !== t.list[i].on) return 0;
    return Progress.counts(t.list[i], event.k, event.a || 0, event.b || 0, event.id === undefined ? null : event.id,
      x.zone === undefined ? null : x.zone, x.toll || 0, x.cls === undefined ? null : x.cls);
  };

  // ---- the records ----

  function ownerOf(save, char, scope) {
    if (scope === 'account') return save.account.bequests;
    return char && char.bequests ? char.bequests : null;
  }

  Progress.status = function (save, char, id) {
    const def = Defs.get('bequest', id), owner = ownerOf(save, char, def.scope), rec = owner !== null && own(owner, id) ? owner[id] : null;
    return { n: rec ? rec.n : 0, count: def.count, done: !!(rec && rec.done), scope: def.scope };
  };

  // ---- what a bequest leaves ----

  function opens(list, id) { if (list.indexOf(id) < 0) list.push(id); }

  // a reward names content of another kind: what is not in this build is left out, so that the save never names it
  const there = (kind, id) => typeof id === 'string' && Defs.has(kind, id);

  Progress.pay = function (save, id, char, gain) {
    const r = Defs.get('bequest', id).reward, open = save.account.open;
    if (there('class', r.class)) opens(open.classes, r.class);
    if (there('base', r.base)) opens(open.bases, r.base);
    if (there('observance', r.observance)) {
      opens(open.observances, r.observance);
      if (char) Char.learn(char, r.observance);
    }
    if (r.bill && there('zone', r.bill.zone) && r.bill.causes.every((c) => there('cause', c))) open.bills.push({ zone: r.bill.zone, causes: r.bill.causes.slice() });
    if (there('voice', r.voice)) save.chest.voices.push(Char.voice(SaveData.uid(save), r.voice));
    if (r.planPoints > 0 && char) char.planPoints = min(PLAN_MOST, char.planPoints + r.planPoints);
    if (r.coin > 0) save.account.coin = min(MOST, save.account.coin + r.coin);
    let hum = 0;
    if (r.hum > 0) {
      hum = r.hum * (gain >= 0 ? gain : 1);
      save.account.hum = min(MOST, save.account.hum + hum);
      save.account.heard = min(MOST, save.account.heard + hum);
    }
    return hum;
  };

  // ---- the end of a vigil ----

  Progress.endVigil = function (save, S, report) {
    const t = Progress.compiled(), list = t.list, met = [];
    report.bequests = met;
    if (list.length === 0 || !S) return report;
    const slot = S.bequests && S.bequests.n && S.bequests.n.length === list.length ? S.bequests : null;
    const run = S.cfg && S.cfg.char ? S.cfg.char : null, cls = run ? run.class : null;
    const zone = S.zone ? S.zone.id : S.result ? S.result.zone : null, tolls = S.toll > 0 ? S.toll : 0;
    const got = [];
    for (let i = 0; i < list.length; i++) got.push(slot !== null ? slot.n[i] : 0);
    // the tolls the vigil's system had not yet heard (all of them without it), and the end
    for (let toll = (slot !== null ? slot.toll : 0) + 1; toll <= tolls; toll++) {
      for (let j = 0; j < t.tolls.length; j++) got[t.tolls[j]] += Progress.counts(list[t.tolls[j]], 'toll', toll, 0, null, zone, toll, cls);
    }
    if (S.result) {
      const kills = S.kills > 0 ? S.kills : 0;
      for (let j = 0; j < t.ends.length; j++) got[t.ends[j]] += Progress.counts(list[t.ends[j]], 'end', tolls, kills, S.result.outcome, zone, tolls, cls);
    }
    const char = typeof report.char === 'number' ? Char.find(save, report.char) : null;
    const gain = S.sheet && S.sheet.stats ? S.sheet.stats['hum-gain'] / 100 : 1;
    for (let i = 0; i < list.length; i++) {
      const c = list[i], owner = ownerOf(save, char, c.scope), n = floor(got[i]);
      if (owner === null || (!(n > 0) && !own(owner, c.id))) continue;
      const rec = own(owner, c.id) ? owner[c.id] : (owner[c.id] = { n: 0, done: false });
      if (n > 0) rec.n = min(MOST, c.vigil ? max(rec.n, n) : rec.n + n);
      if (rec.done || rec.n < c.count) continue;
      rec.done = true;
      report.hum += Progress.pay(save, c.id, char, gain);
      met.push(c.id);
    }
    return report;
  };

  // ---- the Register ----

  Progress.headStart = function (save) {
    const by = Object.create(null), out = [];
    for (let i = 0; i < save.register.length; i++) {
      const d = save.register[i];
      if (d.how !== 'died' || d.cause === null || typeof d.cause.attack !== 'string') continue;
      const k = d.cause.attack;
      if (by[k] === undefined) { by[k] = { attack: k, kind: d.cause.kind, deaths: 0, seconds: 0 }; out.push(by[k]); }
      if (by[k].deaths < REGISTER_MOST) by[k].deaths++;
    }
    for (let i = 0; i < out.length; i++) out[i].seconds = out[i].deaths * REGISTER_EARLY;
    out.sort((x, y) => y.deaths - x.deaths);
    return out;
  };
})();
