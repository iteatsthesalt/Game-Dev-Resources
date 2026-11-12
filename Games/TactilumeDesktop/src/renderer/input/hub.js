// Every input becomes poles that belong to a player. The hub keeps the players, gives each
// one a colour, and merges everyone's poles into the one list the engine draws each frame.
// See CONTRACTS.md, "renderer/input/".
//
// Players are listed in the order they joined, and each player's poles keep the order the
// input gave them. The engine joins some behaviours' poles up in list order (threads, rivers),
// so a stable order keeps those shapes from jumping between frames.
import { createEmitter } from '../../../../Tactilume/src/js/core/util.js';

// Eight colours that stay distinct for the common kinds of colour-vision deficiency: Okabe
// and Ito's set, with white in place of its black, which would vanish on a dark screen. The
// first four, which most sessions use, are the ones that stay furthest apart.
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

// What to call each colour in words, because colour must never be the only signal.
export const PLAYER_COLOR_NAMES = Object.freeze(['orange', 'sky blue', 'bluish green', 'yellow', 'blue', 'vermilion', 'reddish purple', 'white']);

const KINDS = new Set(['pointer', 'gamepad', 'phone']);
const MAX_NAME = 40;
// How many departed players' colours are remembered, so one that comes back gets its own
// colour again when nobody has taken it meanwhile.
const REMEMBERED = 64;

const finite = (x) => typeof x === 'number' && Number.isFinite(x);

export function createHub({ maxPoles = 64 } = {}) {
  const ev = createEmitter();
  const cap = Number.isInteger(maxPoles) && maxPoles >= 1 ? maxPoles : 64;
  const players = new Map();    // id → { id, kind, name, key, colorIndex, poles }; a Map keeps join order
  const lastColor = new Map();  // key → the colour that key's player had
  let nextId = 1;               // ids are never reused, so a stale id cannot reach a newcomer

  const view = (p) => ({
    id: p.id, kind: p.kind, name: p.name, key: p.key,
    color: [...PLAYER_COLORS[p.colorIndex]],
    colorName: PLAYER_COLOR_NAMES[p.colorIndex],
  });
  const list = () => [...players.values()].map(view);

  // The colour fewest players have, the lowest on a tie: with up to eight players everyone
  // differs, and past eight the repeats spread evenly. A returning key gets its old colour
  // back if that colour is still free.
  function pickColor(key) {
    const uses = new Array(PLAYER_COLORS.length).fill(0);
    for (const p of players.values()) uses[p.colorIndex]++;
    const remembered = key ? lastColor.get(key) : undefined;
    if (remembered !== undefined && uses[remembered] === 0) return remembered;
    let best = 0;
    for (let i = 1; i < uses.length; i++) if (uses[i] < uses[best]) best = i;
    return best;
  }

  // Keeps the poles worth drawing when there are more than `cap`. Each player keeps one pole
  // first (its newest held pole, else its newest), so a crowd of touches on one phone can
  // never silence another player; the room left goes to held poles before lifted ones, and to
  // the newest first. A pole being held is never dropped for one that is only fading out.
  function choose(entries) {
    const rank = (a, b) => (b.held - a.held) || (a.age - b.age) || (a.order - b.order);
    const keep = new Set();
    const firsts = new Map();
    for (const e of entries) {
      const best = firsts.get(e.player);
      if (!best || rank(e, best) < 0) firsts.set(e.player, e);
    }
    for (const e of [...firsts.values()].sort(rank).slice(0, cap)) keep.add(e);
    for (const e of [...entries].sort(rank)) {
      if (keep.size >= cap) break;
      keep.add(e);
    }
    return entries.filter((e) => keep.has(e));
  }

  return {
    // `key` names the source (a pad, a phone's slot): the same key gives back the same player
    addPlayer({ kind, name = '', key = '' } = {}) {
      if (!KINDS.has(kind)) throw new TypeError(`a player's kind is 'pointer', 'gamepad' or 'phone', not ${String(kind)}`);
      const k = typeof key === 'string' ? key : String(key ?? '');
      if (k) for (const p of players.values()) if (p.key === k) return view(p);
      const p = { id: nextId++, kind, name: String(name ?? '').slice(0, MAX_NAME), key: k, colorIndex: pickColor(k), poles: [] };
      players.set(p.id, p);
      ev.emit('players', list());
      return view(p);
    },

    removePlayer(id) {
      const p = players.get(id);
      if (!p) return;
      players.delete(id);
      if (p.key) {
        lastColor.delete(p.key);
        lastColor.set(p.key, p.colorIndex);
        if (lastColor.size > REMEMBERED) lastColor.delete(lastColor.keys().next().value);
      }
      ev.emit('players', list());
    },

    // the player's poles now, replacing the last set; the hub keeps the array, not a copy
    setPoles(id, poles) {
      const p = players.get(id);
      if (p) p.poles = Array.isArray(poles) ? poles : [];
    },

    // Everyone's poles, each a copy tagged with .player, at most maxPoles (see choose).
    poles() {
      const entries = [];
      for (const p of players.values()) {
        for (const pole of p.poles) {
          // a pole the engine could not place is no pole at all
          if (!pole || !finite(pole.x) || !finite(pole.y)) continue;
          entries.push({ pole, player: p.id, held: pole.held ? 1 : 0, age: finite(pole.age) ? pole.age : 0, order: entries.length });
        }
      }
      const kept = entries.length > cap ? choose(entries) : entries;
      return kept.map((e) => ({ ...e.pole, player: e.player }));
    },

    players: list,
    on: ev.on,
  };
}
