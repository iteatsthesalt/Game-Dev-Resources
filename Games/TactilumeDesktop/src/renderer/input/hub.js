// Every input becomes poles that belong to a player. The hub keeps the players, gives each
// one a colour, and merges everyone's poles into the one list the engine draws each frame.
//
// First version, written by the spine. The input-audio part owns this file and replaces it.
import { createEmitter } from '../../../../Tactilume/src/js/core/util.js';

// Eight colours that stay distinct for the common kinds of colour-vision deficiency: Okabe
// and Ito's set, with white in place of its black, which would vanish on a dark screen.
export const PLAYER_COLORS = Object.freeze([
  [0.902, 0.624, 0.0],   // orange
  [0.337, 0.706, 0.914], // sky blue
  [0.0, 0.620, 0.451],   // bluish green
  [0.941, 0.894, 0.259], // yellow
  [0.0, 0.447, 0.698],   // blue
  [0.835, 0.369, 0.0],   // vermilion
  [0.800, 0.475, 0.655], // reddish purple
  [1.0, 1.0, 1.0],       // white
].map((c) => Object.freeze(c)));

export function createHub({ maxPoles = 64 } = {}) {
  const ev = createEmitter();
  const players = new Map(); // id → { id, kind, name, key, colorIndex, poles }
  let nextId = 1;

  const view = (p) => ({ id: p.id, kind: p.kind, name: p.name, color: [...PLAYER_COLORS[p.colorIndex]], key: p.key });
  const list = () => [...players.values()].map(view);
  // the first colour nobody has; with more than eight players colours repeat
  function freeColor() {
    const used = new Set([...players.values()].map((p) => p.colorIndex));
    for (let i = 0; i < PLAYER_COLORS.length; i++) if (!used.has(i)) return i;
    return (nextId - 1) % PLAYER_COLORS.length;
  }

  return {
    // `key` names the source (a pad's index, a phone's slot): the same key gives back the same player
    addPlayer({ kind, name = '', key = '' }) {
      for (const p of players.values()) if (key && p.key === key) return view(p);
      const p = { id: nextId++, kind, name, key, colorIndex: freeColor(), poles: [] };
      players.set(p.id, p);
      ev.emit('players', list());
      return view(p);
    },
    removePlayer(id) {
      if (players.delete(id)) ev.emit('players', list());
    },
    setPoles(id, poles) {
      const p = players.get(id);
      if (p) p.poles = Array.isArray(poles) ? poles : [];
    },
    // Everyone's poles, each tagged with .player. Over maxPoles, every player keeps their
    // newest pole and the remaining room goes to the newest of the rest, so a crowd of
    // touches on one phone can never silence another player.
    poles() {
      const all = [];
      const newestOf = new Map();
      for (const p of players.values()) {
        for (const pole of p.poles) {
          const tagged = { ...pole, player: p.id };
          all.push(tagged);
          const best = newestOf.get(p.id);
          if (!best || (tagged.age ?? 0) < (best.age ?? 0)) newestOf.set(p.id, tagged);
        }
      }
      if (all.length <= maxPoles) return all;
      const keep = new Set([...newestOf.values()].slice(0, maxPoles));
      for (const pole of [...all].sort((a, b) => (a.age ?? 0) - (b.age ?? 0))) {
        if (keep.size >= maxPoles) break;
        keep.add(pole);
      }
      return all.filter((pole) => keep.has(pole));
    },
    players: list,
    on: ev.on,
  };
}
