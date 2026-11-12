// The keyboard shortcuts and the gamepad's buttons: what each one does, for the key handler in
// ui.js and for the lists in Settings, kept together so the two cannot disagree. The keys are
// CONTRACTS.md's table, plus a few for the behaviours past the tenth, surprise and sound.

// For the Keys list in Settings: [what to press, what it does].
export const KEY_LIST = Object.freeze([
  ['F', 'Full screen on or off'],
  ['H', 'Hide or show the controls'],
  ['P', 'The phone panel'],
  ['S', 'The sound panel'],
  ['Space', 'A pulse of light in the middle'],
  ['1 – 9, 0', 'Play one behaviour (0 is the tenth)'],
  ['B', 'The next behaviour, through all twelve and Auto (Shift+B goes back)'],
  ['[  ]', 'The previous or next colours'],
  [',  .', 'The previous or next scene'],
  ['N', 'A surprise scene'],
  ['Esc', 'Close the panel, or leave full screen'],
]);

// For the Gamepad list in Settings (gamepad.js does these; CONTRACTS.md, "renderer/input/").
export const PAD_LIST = Object.freeze([
  ['Sticks', 'Move your two points of light'],
  ['Triggers', 'Hold to touch the light; harder is stronger'],
  ['A', 'A pulse of light'],
  ['B', 'The next behaviour'],
  ['X', 'The next colours'],
  ['Y', 'A surprise scene'],
  ['LB  RB', 'The previous or next scene'],
  ['D-pad', 'Up and down: trails. Left and right: size'],
  ['Start', 'Hide or show the controls'],
  ['Back', 'The phone panel'],
]);

// A key press → what it asks for ({ id, ... }), or null when it is not a shortcut. Shortcuts
// leave Ctrl, Alt and the Command key alone, so the system's own keys keep working, but not
// AltGr: some layouts need it to type [ and ].
export function keyAction(e) {
  const altGr = typeof e.getModifierState === 'function' && e.getModifierState('AltGraph');
  if (e.metaKey || ((e.ctrlKey || e.altKey) && !altGr)) return null;
  const key = e.key && e.key.length === 1 ? e.key.toLowerCase() : e.key;
  // by position too, so layouts whose digit row types other characters (AZERTY) still work
  const digit = /^(?:Digit|Numpad)([0-9])$/.exec(e.code || '')?.[1] ?? (/^[0-9]$/.test(key) ? key : null);
  if (digit !== null) return { id: 'behaviour', index: (Number(digit) + 9) % 10 };
  switch (key) {
    case 'f': case 'F11': return { id: 'fullscreen' };
    case 'h': return { id: 'hide' };
    case 'p': return { id: 'phone' };
    case 's': return { id: 'sound' };
    case ' ': return { id: 'pulse' };
    case 'b': return { id: 'nextBehaviour', dir: e.shiftKey ? -1 : 1 };
    case '[': return { id: 'palette', dir: -1 };
    case ']': return { id: 'palette', dir: 1 };
    case ',': return { id: 'preset', dir: -1 };
    case '.': return { id: 'preset', dir: 1 };
    case 'n': return { id: 'surprise' };
    case 'Escape': return { id: 'escape' };
    default: return null;
  }
}
