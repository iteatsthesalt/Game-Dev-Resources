// 17-bellframe.js: the Bellframe (docs/design/04-progression.md, "The Bellframe and Hum"): the permanent tree shared
// by every character, a frame of pits branching from the tenor pit. What it gives a character; opening its pits and
// buying ringing places with Hum; hanging the bells of the dead in open pits; recasting a bell's gift. Every function
// takes and changes plain data (the save, 16-savedata.js; a run's account, 14-character.js) and keeps nothing.
// Owns: Bellframe
// Public:
//   Bellframe.mods(account, char, out) -> out
//                                    what the Bellframe gives a character (Char.mods calls it at every rebuild):
//                                    account is the save's account, a run's {frame, open, warned}, or null (then
//                                    nothing). The grant of every open pit, and the gift of every bell the character
//                                    rang when it was made (char.bells, found in account.frame.bells) at the bell's
//                                    level, 1 + floor(weight / weighPer) and 20 at most, its values times (1 + trueGain /
//                                    100 x Char.trueRing(the weights rung)), and twice for a bell that rings double. A
//                                    bell with no gift, or one that is not in the frame, gives nothing.
//   Bellframe.level(bell) -> 1..20   the level a bell's gift works at, by its weight
//   Bellframe.ring(account, char) -> {bells, pairs, gain}   the bells a character rings (the Bell objects found in the
//                                    frame, in the order it rang them), the neighbouring pairs that ring true, and
//                                    what every gift is multiplied by for it (1 + trueGain / 100 x pairs)
//   Bellframe.price(save, what) -> Hum   what the next one costs, in whole Hum: 'pit', pitFirst x pitGrowth ^ (the
//                                    pits open beyond the tenor); 'place', placeFirst x placeGrowth ^ (places - 1).
//                                    Infinity when there is none to buy (every pit open; placesMost bought) or what
//                                    is neither.
//   Bellframe.openable(save, pitId) -> boolean   the pit is closed and the pit it opens from is open
//   Bellframe.open(save, pitId) -> boolean   opens an openable pit, paid from save.account.hum
//   Bellframe.place(save) -> boolean  buys the next ringing place, up to placesMost, paid from save.account.hum
//   Bellframe.hung(save, pitId) -> bell | null   the bell hanging in a pit
//   Bellframe.hang(save, bellUid, pitId) -> boolean   hangs a bell not yet hung in an open, empty pit (free)
//   Bellframe.gifts(classId) -> [giftId]   the gifts of a class, in the order they were defined
//   Bellframe.recast(save, bellUid, giftId) -> boolean   recasts a bell's gift to another gift of the bell's class, for
//                                    the bellframe's recast Hum
// Each of open, place, hang and recast returns false and changes nothing when it cannot be done: an id that is not
// there, too little Hum, or a vigil under way (save.away set: the vigil's checkpoints write the Hum it began with,
// so nothing is bought while one is out). The game writes the save after a change (Game.write).
// The numbers are the bellframe 'main' (44-bellframe.js); without one, 14-character.js's (Char's FRAME): the true
// ring 10% to 30%, +5%, a level every 8 tolls; nothing can be bought without one.
(function () {
  'use strict';

  const floor = Math.floor, round = Math.round, pow = Math.pow, min = Math.min;
  const FALLBACK = Object.freeze({ trueLow: 10, trueHigh: 30, trueGain: 5, weighPer: 8 });
  const NONE = Object.freeze([]);

  const numbers = () => (Defs.has('bellframe', 'main') ? Defs.get('bellframe', 'main') : null);
  const frameOf = (account) => (account && account.frame && typeof account.frame === 'object' ? account.frame : null);

  function bellIn(frame, uid) {
    const bells = frame && Array.isArray(frame.bells) ? frame.bells : NONE;
    for (let i = 0; i < bells.length; i++) if (bells[i].uid === uid) return bells[i];
    return null;
  }

  Bellframe.level = function (bell) {
    const n = numbers() || FALLBACK, w = bell && bell.weight > 0 ? bell.weight : 0;
    return min(Stats.LEVEL_MAX, 1 + floor(w / n.weighPer));
  };

  Bellframe.ring = function (account, char) {
    const frame = frameOf(account), bells = [];
    const rung = char && Array.isArray(char.bells) ? char.bells : NONE;
    for (let i = 0; i < rung.length && frame !== null; i++) {
      const b = bellIn(frame, rung[i]);
      if (b !== null) bells.push(b);
    }
    const weights = [];
    for (let i = 0; i < bells.length; i++) weights.push(bells[i].weight);
    const pairs = bells.length > 1 ? Char.trueRing(weights) : 0, n = numbers() || FALLBACK;
    return { bells, pairs, gain: 1 + n.trueGain / 100 * pairs };
  };

  // a modifier with its value times k (a pair on a range stat, both ends)
  function times(m, k) {
    if (k === 1) return m;
    const v = m.value;
    return Object.assign({}, m, { value: Array.isArray(v) ? [v[0] * k, v[1] * k] : v * k });
  }

  Bellframe.mods = function (account, char, out) {
    const frame = frameOf(account);
    if (frame === null) return out;
    const pits = Array.isArray(frame.pits) ? frame.pits : NONE;
    for (let i = 0; i < pits.length; i++) {
      if (!Defs.has('pit', pits[i])) continue;
      const grant = Defs.get('pit', pits[i]).grant;
      for (let k = 0; k < grant.length; k++) out.push(grant[k]);
    }
    const ring = Bellframe.ring(account, char);
    for (let i = 0; i < ring.bells.length; i++) {
      const b = ring.bells[i];
      if (b.gift === null || !Defs.has('gift', b.gift)) continue;
      const list = Stats.resolve(Defs.get('gift', b.gift).mods, Bellframe.level(b)), k = ring.gain * (b.double ? 2 : 1);
      for (let j = 0; j < list.length; j++) out.push(times(list[j], k));
    }
    return out;
  };

  // ---- buying with Hum ----

  function tenorOpen(frame) {
    for (let i = 0; i < frame.pits.length; i++) if (Defs.has('pit', frame.pits[i]) && Defs.get('pit', frame.pits[i]).from === null) return true;
    return false;
  }

  Bellframe.price = function (save, what) {
    const n = numbers(), frame = save && save.account ? save.account.frame : null;
    if (n === null || frame === null) return Infinity;
    if (what === 'pit') {
      const open = frame.pits.length;
      if (open >= Defs.all('pit').length) return Infinity;
      return round(n.pitFirst * pow(n.pitGrowth, tenorOpen(frame) ? open - 1 : open));
    }
    if (what === 'place') {
      if (frame.places >= n.placesMost) return Infinity;
      return round(n.placeFirst * pow(n.placeGrowth, frame.places - 1));
    }
    return Infinity;
  };

  // Hum is spent only from a save with no vigil under way: a vigil's checkpoints write the Hum it began with
  function spend(save, price) {
    if (!(price < Infinity) || save.away !== null || !(save.account.hum >= price)) return false;
    save.account.hum -= price;
    return true;
  }

  Bellframe.openable = function (save, pitId) {
    if (typeof pitId !== 'string' || !Defs.has('pit', pitId)) return false;
    const pits = save.account.frame.pits, from = Defs.get('pit', pitId).from;
    return pits.indexOf(pitId) < 0 && (from === null || pits.indexOf(from) >= 0);
  };

  Bellframe.open = function (save, pitId) {
    if (!Bellframe.openable(save, pitId)) return false;
    if (Defs.get('pit', pitId).from === null) {      // the tenor pit opens from none, and is open from the first
      if (save.away !== null) return false;
    } else if (!spend(save, Bellframe.price(save, 'pit'))) return false;
    save.account.frame.pits.push(pitId);
    return true;
  };

  Bellframe.place = function (save) {
    if (!spend(save, Bellframe.price(save, 'place'))) return false;
    save.account.frame.places++;
    return true;
  };

  // ---- the bells of the dead ----

  Bellframe.hung = function (save, pitId) {
    const bells = save.account.frame.bells;
    for (let i = 0; i < bells.length; i++) if (bells[i].pit === pitId) return bells[i];
    return null;
  };

  Bellframe.hang = function (save, uid, pitId) {
    const frame = save.account.frame, bell = bellIn(frame, uid);
    if (save.away !== null || bell === null || bell.pit !== null || typeof pitId !== 'string') return false;
    if (frame.pits.indexOf(pitId) < 0 || Bellframe.hung(save, pitId) !== null) return false;
    bell.pit = pitId;
    return true;
  };

  Bellframe.gifts = function (classId) {
    const all = Defs.all('gift'), out = [];
    for (let i = 0; i < all.length; i++) if (all[i].class === classId) out.push(all[i].id);
    return out;
  };

  Bellframe.recast = function (save, uid, giftId) {
    const n = numbers(), bell = bellIn(save.account.frame, uid);
    if (n === null || bell === null || typeof giftId !== 'string' || !Defs.has('gift', giftId)) return false;
    if (giftId === bell.gift || Defs.get('gift', giftId).class !== bell.class) return false;
    if (!spend(save, n.recast)) return false;
    bell.gift = giftId;
    return true;
  };
})();
