// The force behaviours: what the light does around your touches.
//
// `id` is the number the simulation shader switches on, and the digit saved in
// share links. Ids are append-only: never renumber or reuse one, or saved scenes
// change meaning. A new behaviour takes the next id and goes at the end.
//
// `blurb` is shown to people in the behaviour picker, so keep it plain.

export const BEHAVIOURS = [
  { id: 0, key: 'well', name: 'Well', blurb: 'Light falls toward each touch and settles into orbit.' },
  { id: 1, key: 'whirl', name: 'Whirl', blurb: 'Each touch spins the field. Neighbouring touches spin opposite ways.' },
  { id: 2, key: 'burst', name: 'Burst', blurb: 'Touches push the light away and send out rings.' },
  { id: 3, key: 'halo', name: 'Halo', blurb: 'Light gathers into a ring around each touch.' },
  { id: 4, key: 'current', name: 'Current', blurb: 'Light streams from one touch to the next.' },
  { id: 5, key: 'weave', name: 'Weave', blurb: 'Threads of light stretch between your touches.' },
  { id: 6, key: 'chime', name: 'Chime', blurb: 'Touches ring like bells. Light settles on the still lines between the waves.' },
  { id: 7, key: 'storm', name: 'Storm', blurb: 'Touches stir the air. Flick to throw a gust.' },
  { id: 8, key: 'lattice', name: 'Lattice', blurb: 'Light holds a pattern. Touches bend it like a lens.' },
  { id: 9, key: 'nova', name: 'Nova', blurb: 'Hold to gather light, let go to release it.' },
  { id: 10, key: 'murmur', name: 'Murmur', blurb: 'Light flocks around your touches like starlings.' },
  { id: 11, key: 'fountain', name: 'Fountain', blurb: 'Light pours out of each touch.' },
];

export const BEHAVIOUR_KEYS = BEHAVIOURS.map((b) => b.key);

const BY_KEY = new Map(BEHAVIOURS.map((b) => [b.key, b]));
const BY_ID = new Map(BEHAVIOURS.map((b) => [b.id, b]));

export const behaviourByKey = (key) => BY_KEY.get(key) || null;
export const behaviourById = (id) => BY_ID.get(id) || null;

// The number of touches picks the behaviour. Slot 0 is one touch, slot 9 is ten.
export const MAX_FINGERS = 10;
export const DEFAULT_CHORDS = ['well', 'current', 'weave', 'halo', 'whirl', 'chime', 'storm', 'murmur', 'lattice', 'nova'];

// Which behaviour is in play for a scene and a number of touches.
// `scene.lock` other than 'auto' overrides the chord table: every touch count plays that one.
export function behaviourFor(scene, fingers) {
  if (scene.lock && scene.lock !== 'auto') {
    const locked = BY_KEY.get(scene.lock);
    if (locked) return locked;
  }
  const slot = Math.min(Math.max(fingers | 0, 1), MAX_FINGERS) - 1;
  return BY_KEY.get(scene.chords[slot]) || BEHAVIOURS[0];
}
