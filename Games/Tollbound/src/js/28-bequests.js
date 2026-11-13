// 28-bequests.js: the bequests counted in a vigil, the last of the systems of a step (docs/engine.md, "Stage 2
// systems"), so that it hears every event of the step. What the counts come to at the vigil's end is
// Progress.endVigil's (15-progress.js), which Char.end calls.
// Owns: Progress
// Public: no functions. It registers:
//   Defs.allow('event', 'bequest')   so that the event below is a kind of event the game knows
//   Sim.state('bequests', S => slot) the vigil's counts: {on, toll, cls, n, had, known, done}. on: whether the run
//                                    counts at all (a run with a character, and bequests to count); toll: the last
//                                    S.toll counted; cls: the character's class; and by bequest, in the order of
//                                    Progress.compiled().list (Float64Array, Uint8Array): n, what this vigil counted;
//                                    had, the count the record held when the vigil began; known, 1 when that record
//                                    was there to read (a character's own, S.cfg.char.bequests; the Household's,
//                                    S.cfg.account.bequests, the copy Char.begin gives the run); done, 1 when
//                                    it was done before the vigil or met in it
//   Sim.system('bequests', S => ...) once a step: every event of the step (S.events) that a bequest is on and its where
//                                    admits (Progress.counts), and each toll by S.toll rising (a 'toll' event comes
//                                    after the systems' place in the step). The vigil's end is counted by endVigil.
//                                    It allocates nothing, and does nothing in a run without a character.
// Events: 'bequest' (x, y the player; id = the bequest) when one is met in the vigil, as far as its record is known.
// It changes nothing the checksum reads and draws from no stream: a run plays the same with it or without it.
(function () {
  'use strict';

  const floor = Math.floor;

  Defs.allow('event', 'bequest');

  Sim.state('bequests', function (S) {
    const list = Progress.compiled().list, n = list.length, char = S.cfg.char || null, account = S.cfg.account || null;
    const slot = {
      on: char !== null && n > 0, toll: S.toll, cls: char !== null ? char.class : null,
      n: new Float64Array(n), had: new Float64Array(n), known: new Uint8Array(n), done: new Uint8Array(n),
    };
    for (let i = 0; i < n && slot.on; i++) {
      const c = list[i], owner = c.scope === 'account' ? (account && account.bequests ? account.bequests : null) : char.bequests || null;
      if (owner === null) continue;
      slot.known[i] = 1;
      const rec = Object.prototype.hasOwnProperty.call(owner, c.id) ? owner[c.id] : null;
      if (rec === null) continue;
      slot.had[i] = rec.n > 0 ? rec.n : 0;
      if (rec.done === true) slot.done[i] = 1;
    }
    return slot;
  });

  // adds what one event counted; a bequest whose record is known and that this brings to its count is met
  function note(S, q, c, i, amount) {
    if (!(amount > 0)) return;
    q.n[i] += amount;
    if (q.known[i] === 0 || q.done[i] === 1) return;
    const now = c.sum !== 0 ? floor(q.n[i]) : q.n[i], total = c.vigil ? (q.had[i] > now ? q.had[i] : now) : q.had[i] + now;
    if (total < c.count) return;
    q.done[i] = 1;
    Sim.emit(S, 'bequest', S.player.x, S.player.y, 0, 0, c.id);
  }

  Sim.system('bequests', function (S) {
    const q = S.bequests;
    if (!q.on) return;
    const t = Progress.compiled(), list = t.list, byKind = t.byKind, zone = S.zone.id, cls = q.cls;
    const ring = S.events, size = ring.length, heard = S.eventCount, start = S.eventStart;
    for (let i = 0; i < heard; i++) {
      const e = ring[(start + i) % size], idx = byKind[e.k];
      if (idx === undefined) continue;
      for (let j = 0; j < idx.length; j++) note(S, q, list[idx[j]], idx[j], Progress.counts(list[idx[j]], e.k, e.a, e.b, e.id, zone, S.toll, cls));
    }
    while (q.toll < S.toll) {
      const toll = ++q.toll, idx = t.tolls;
      for (let j = 0; j < idx.length; j++) note(S, q, list[idx[j]], idx[j], Progress.counts(list[idx[j]], 'toll', toll, 0, null, zone, toll, cls));
    }
  });
})();
