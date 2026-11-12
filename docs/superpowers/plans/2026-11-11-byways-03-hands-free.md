# Byways 03: Hands-Free and Accessibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One Start press turns Byways into a hands-free stumbler that reads each find aloud, moves on by itself and obeys voice commands and single keys, with the accessibility settings of §6.7.

**Architecture:** Three engine-agnostic core modules (`voice/grammar.js`, `voice/listener.js`, `voice/reader.js`) and one controller (`handsfree.js`) hold every rule and timer, and take a `VoiceEngine`, a `Tts` and a clock as parameters, so Plans 07 and 08 reuse them unchanged. The web shell supplies `createWebVoice`, a refined `createWebTts` and `createWebMedia`. A thin UI layer (`ui/handsfree-ui.js`, `ui/keymap.js`, two settings sections and one first-run step) wires them to the DOM.

**Tech Stack:** ES2022 modules, `node:test` with `fakeClock`, `@playwright/test@1.63.0` with `mockNet` and `installFakeSpeech`, `@axe-core/playwright@4.14.0`, `@fontsource/atkinson-hyperlegible@5.3.0` (vendored files only).

**Spec:** `docs/superpowers/specs/2026-11-11-byways-design.md` (§6 all, §2 items 1–2, §5.6 step 3, §4 voice rows). Research: `byways-research/hands-free.md`, `critic.md` (key map), `platform-shells.md` (WebView, for Plans 07–08).

## Global Constraints

- Every rule in the overview's "Global constraints" and "Working conventions" applies (`docs/superpowers/plans/2026-11-11-byways-00-overview.md`). These bite this plan most:
- "The engine is picked by a working test start, never by guessing from the browser name." (§6.2)
- "That cloud voice is turned on only after you agree to it on a screen that names the company." (§2.2)
- "Restart on `end`, `no-speech` and `aborted` when Byways did not stop it on purpose, at most 10 times a minute. Back off from 1 s up to 30 s on `network`. Stop and show help on `not-allowed`, `service-not-allowed`, `audio-capture` and `language-not-supported`. On `phrases-not-supported`, retry without phrases. After 10 minutes with no recognised command, stop listening and say so." (§6.2)
- "Act only on final results. Interim results count only for **stop** and **pause**." Half-duplex: "while Byways is speaking, and for 400 ms after, it ignores everything except stop and pause." (§6.2)
- "Match the whole utterance after trimming filler words. A command buried in a longer sentence never fires. The one exception is `search for <words>`." "Never send command parsing to an AI." (§6.2)
- "Command words are exactly the visible button labels (WCAG 2.5.3)." (§6.3)
- "Single-key shortcuts can be turned off, and they are ignored while a text field has focus (WCAG 2.1.4)." (§6.3)
- "Each sentence is a separate utterance. Pause works by cancelling and then resuming at the current sentence." (§6.4)
- "A **Stop/Mute** control is visible on every screen, together with Esc and "stop" (WCAG 1.4.2)." (§6.4)
- "Screen-reader mode (a manual toggle): built-in read-aloud goes quiet, and live regions carry the text instead." (§6.4)
- "The dwell time defaults to 20 s. It can be set from 5 to 300 s, or to **wait for me**. The countdown starts after reading ends." "The polite live region announces "Next find in 10 seconds" once per find." (§6.5)
- "Lean-back never opens tabs by itself." "AI never runs during lean-back unless **Let AI refill lean-back** is on. Even then, it makes at most one AI search per 10 finds." (§6.5)
- "One assertive region for errors only, such as "Microphone blocked" (WCAG 4.1.3)." (§6.7)
- "Every view is checked with axe-core in end-to-end tests. Any serious or critical issue fails the build." (§6.7)
- `src/core/**` never touches `window`, `document` or `chrome`; timers come from the injected clock.

## Review Focus

1. **An interim "pause" followed by the final "pause" of the same utterance.** The person expects one toggle, not pause-then-resume. Pinned by `an interim command does not fire again on its final result` (Task 2).
2. **Space pressed on a focused button, link or checkbox.** A keyboard user expects the focused control to activate, not a Stumble. Pinned by `Space on a focused control is left to the control` (Task 8).
3. **A cloud-only browser (Android Chrome, Safari) with no cloud opt-in.** The person expects that no audio leaves the device, even after pressing Start. Pinned by `start without allowCloud on a cloud-only browser never constructs a recogniser` (Task 6).
4. **The pool runs dry or the source fails during lean-back.** The person expects lean-back to stop and say why, not to spin on requests every dwell. Pinned by `an empty result pauses lean-back and announces the reason` (Task 5).
5. **A dwell shorter than 10 s (5–9 s).** The person expects one correct countdown announcement, not "Next find in 10 seconds" for a 5-second wait. Pinned by `a 5 s dwell announces Next find in 5 seconds once` (Task 5).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/core/voice/grammar.js` | `COMMANDS`, `FILLER_WORDS`, `parseUtterance`, `commandPhrases` |
| `src/core/voice/listener.js` | `createListener`: restart policy, backoff, idle stop, half-duplex, interim rules |
| `src/core/voice/reader.js` | `cardScript`, `createReader`: one utterance per sentence, pause = cancel + resume |
| `src/core/handsfree.js` | `createHandsFree` state machine and lean-back loop, `effectiveListenMode`, `clampDwell` |
| `src/platform/web-voice.js` | Modify: add `createWebVoice` and `vendorFromUA` next to Plan 01's `createNoVoice` |
| `src/platform/web-tts.js` | Modify: local voices first, `voiceschanged` plus polling, `lang` option |
| `src/platform/web-media.js` | Modify: Media Session handlers, `setActive`, silent-audio fallback behind a flag |
| `src/platform/pwa.js` | Modify: use `createWebVoice` and the media flag |
| `src/ui/keymap.js` | `keyToCommand` (pure) and `installKeymap` |
| `src/ui/handsfree-ui.js` | `installHandsFreeUi`: the bar on every screen, help card, captions, first-run step, `describeEngine` |
| `src/ui/views/settings/voice.js` | The Voice settings section, including the cloud opt-in screen |
| `src/ui/views/settings/access.js` | The Accessibility settings section |
| `src/ui/views/stumble.js` | Modify: tell hands-free when a find is shown, opened or read |
| `src/ui/boot.js`, `src/ui/views/index.js` | Modify: create `app.handsFree`; import the two settings sections |
| `src/ui/styles/app.css`, `src/ui/styles/themes.css` | Modify: bar styles, `@font-face`, contrast theme |
| `src/assets/fonts/` | Vendored Atkinson Hyperlegible woff2 (400, 700) and `OFL.txt` |
| `tests/e2e/helpers/fakes.js` | Modify: extra fake speech controls |
| `tests/unit/*.test.js`, `tests/e2e/*.spec.js` | Tests named in each task |

Unit tests that drive async code with `fakeClock` use this helper at the top of the file: `const flush = () => new Promise((r) => setImmediate(r));`. Call `await flush()` after each `clock.advance(ms)`.

### Task 1: Voice grammar

**Files:**
- Create: `src/core/voice/grammar.js`
- Test: `tests/unit/voice-grammar.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `COMMANDS: Array<{id, words:string[], key:string|null, label:string}>`, `FILLER_WORDS: string[]`, `parseUtterance(text) → {id, arg?}|null`, `commandPhrases() → string[]` (every command word plus `'Byways','stumble','rabbit hole','fate'`, for recogniser biasing).

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { COMMANDS, FILLER_WORDS, parseUtterance, commandPhrases } from '../../src/core/voice/grammar.js';

const byId = Object.fromEntries(COMMANDS.map((c) => [c.id, c]));

test('COMMANDS follow the §6.3 table exactly', () => {
  assert.deepEqual(COMMANDS.map((c) => c.id),
    ['next','back','like','dislike','save','share','open','more','read','pause','resume','stop','stopListening','search','fate','daily','help']);
  assert.deepEqual(COMMANDS.map((c) => [c.id, c.words, c.key, c.label]), [
    ['next', ['next','next one'], ' ', 'Next'],
    ['back', ['back','go back'], 'b', 'Back'],
    ['like', ['like','i like it'], 'l', 'Like'],
    ['dislike', ['not for me','dislike'], 'd', 'Not for me'],
    ['save', ['save','save it'], 's', 'Save'],
    ['share', ['share','share it'], null, 'Share'],
    ['open', ['open','open it'], 'o', 'Open'],
    ['more', ['more like this','rabbit hole'], 'm', 'More like this'],
    ['read', ['read it','read'], 'r', 'Read it'],
    ['pause', ['pause'], 'k', 'Pause'],
    ['resume', ['resume','play'], null, 'Play'],
    ['stop', ['stop','quiet'], 'Escape', 'Stop'],
    ['stopListening', ['stop listening'], null, 'Stop listening'],
    ['search', ['search for','find me'], '/', 'Search'],
    ['fate', ['surprise me','fate'], 'f', 'Surprise me'],
    ['daily', ['daily fate'], null, 'Daily Fate'],
    ['help', ['help','what can i say'], '?', 'Help'],
  ]);
});

test('every visible label parses to its own command', () => {
  for (const c of COMMANDS) if (c.id !== 'search') assert.ok(parseUtterance(c.label)?.id === c.id, c.label);
});

test('whole utterances match after trimming filler words and punctuation', () => {
  assert.deepEqual(parseUtterance('Next.'), { id: 'next' });
  assert.deepEqual(parseUtterance('okay, next one please'), { id: 'next' });
  assert.deepEqual(parseUtterance('Please go back now'), { id: 'back' });
  assert.deepEqual(parseUtterance('I like it!'), { id: 'like' });
  assert.deepEqual(parseUtterance('Hey Byways, what can I say?'), { id: 'help' });
  assert.deepEqual(parseUtterance('STOP LISTENING'), { id: 'stopListening' });
  assert.deepEqual(parseUtterance('stop'), { id: 'stop' });
});

test('a command inside a longer sentence never fires', () => {
  assert.equal(parseUtterance('I think we should go next'), null);
  assert.equal(parseUtterance('next time'), null);
  assert.equal(parseUtterance('do not save'), null);
  assert.equal(parseUtterance(''), null);
  assert.equal(parseUtterance('   '), null);
});

test('search for and find me take the rest of the sentence', () => {
  assert.deepEqual(parseUtterance('search for pixel art please'), { id: 'search', arg: 'pixel art' });
  assert.deepEqual(parseUtterance('OK find me old maps of Paris'), { id: 'search', arg: 'old maps of paris' });
  assert.equal(parseUtterance('search for'), null);
  assert.equal(parseUtterance('please search for please'), null);
});

test('filler words and phrases', () => {
  assert.deepEqual(FILLER_WORDS, ['please','ok','okay','um','uh','er','hey','byways','so','just','now']);
  const p = commandPhrases();
  for (const w of ['next one','go back','rabbit hole','Byways','stumble','fate']) assert.ok(p.includes(w), w);
  assert.equal(new Set(p).size, p.length);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/unit/voice-grammar.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/core/voice/grammar.js`.

- [ ] **Step 3: Implement `src/core/voice/grammar.js`**

Normalise with: lowercase, replace `[.,!?;:"“”]` with spaces, collapse whitespace, trim. Drop `FILLER_WORDS` from the start. If what is left starts with `search for ` or `find me `, the rest (with trailing filler dropped) is `arg`; an empty `arg` gives `null`. Otherwise drop trailing filler and compare the whole string with each command's `words`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/unit/voice-grammar.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/voice/grammar.js tests/unit/voice-grammar.test.js
git commit -m "Add the voice command grammar"
```

### Task 2: Listener restart policy

**Files:**
- Create: `src/core/voice/listener.js`
- Test: `tests/unit/voice-listener.test.js`

**Interfaces:**
- Consumes: `parseUtterance(text)` (Task 1); the `VoiceEngine` shape; `fakeClock(start)` from `src/core/util/clock.js`.
- Produces: `createListener(engine, {clock, phrases, lang, allowCloud}) → {start() → Promise<void>, stop(), on(event, fn) → unsubscribe, get listening, setHalfDuplex(on)}`. Events:
  - `command` → `{id, arg?, text}`;
  - `heard` → `{text, id: string|null}` for every final transcript;
  - `state` → `{listening:boolean, reason?: 'stopped'|'idle'|'error'}`;
  - `error` → `{code: VoiceErrorCode, fatal:boolean, firstTry?:true}`.

The test file builds a fake engine: `fakeEngine()` returns a `VoiceEngine` whose `start(opts)` pushes `opts` onto `starts`, and that exposes `emit(event, payload)` so a test can fire `result`, `state` and `error`. "End" in the tests means `emit('state', {listening:false})`. An error is always followed by an end, as the web API does.

- [ ] **Step 1: Write the failing tests**

```js
// helpers in the test file: fakeEngine(), flush(), and
async function setup(opts = {}) {
  const clock = fakeClock(0), engine = fakeEngine();
  const l = createListener(engine, { clock, phrases: ['next'], lang: 'en-US', allowCloud: false, ...opts });
  const log = { command: [], state: [], error: [], heard: [] };
  for (const k of Object.keys(log)) l.on(k, (e) => log[k].push(e));
  await l.start();
  engine.emit('state', { listening: true });
  return { clock, engine, l, log };
}
const say = (engine, text, final = true) => engine.emit('result', { text, final });
const end = (engine) => engine.emit('state', { listening: false });

test('restarts on end, no-speech and aborted', async () => {
  const { clock, engine } = await setup();
  say(engine, 'next'); end(engine); clock.advance(0); await flush();
  engine.emit('error', { code: 'no-speech' }); end(engine); clock.advance(0); await flush();
  engine.emit('error', { code: 'aborted' }); end(engine); clock.advance(0); await flush();
  assert.equal(engine.starts.length, 4);
  assert.deepEqual(engine.starts[0], { lang: 'en-US', phrases: ['next'], allowCloud: false });
});

test('at most 10 restarts a minute', async () => {
  const { clock, engine } = await setup();
  say(engine, 'next');
  for (let i = 0; i < 11; i++) { end(engine); clock.advance(0); await flush(); }
  assert.equal(engine.starts.length, 11);
  clock.advance(59999); await flush();
  assert.equal(engine.starts.length, 11);
  clock.advance(1); await flush();
  assert.equal(engine.starts.length, 12);
});

test('backs off 1 s to 30 s on network, then gives up', async () => {
  const { clock, engine, log } = await setup();
  say(engine, 'next');
  for (const wait of [1000, 2000, 4000, 8000, 16000, 30000]) {
    const before = engine.starts.length;
    engine.emit('error', { code: 'network' }); end(engine);
    clock.advance(wait - 1); await flush();
    assert.equal(engine.starts.length, before);
    clock.advance(1); await flush();
    assert.equal(engine.starts.length, before + 1);
  }
  engine.emit('error', { code: 'network' }); end(engine);
  clock.advance(60000); await flush();
  assert.deepEqual(log.error.at(-1), { code: 'network', fatal: true });
  assert.equal(engine.starts.length, 7);
});

test('a result resets the network backoff', async () => {
  const { clock, engine } = await setup();
  say(engine, 'next');
  engine.emit('error', { code: 'network' }); end(engine); clock.advance(1000); await flush();
  engine.emit('error', { code: 'network' }); end(engine); clock.advance(2000); await flush();
  say(engine, 'back');
  engine.emit('error', { code: 'network' }); end(engine); clock.advance(1000); await flush();
  assert.equal(engine.starts.length, 4);
});

test('network on the first try means voice is unavailable', async () => {
  const { clock, engine, log } = await setup();
  engine.emit('error', { code: 'network' }); end(engine); clock.advance(60000); await flush();
  assert.deepEqual(log.error, [{ code: 'network', fatal: true, firstTry: true }]);
  assert.equal(engine.starts.length, 1);
});

for (const code of ['not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported']) {
  test(`stops for good on ${code}`, async () => {
    const { clock, engine, log, l } = await setup();
    say(engine, 'next');
    engine.emit('error', { code }); end(engine); clock.advance(60000); await flush();
    assert.equal(engine.starts.length, 1);
    assert.deepEqual(log.error.at(-1), { code, fatal: true });
    assert.deepEqual(log.state.at(-1), { listening: false, reason: 'error' });
    assert.equal(l.listening, false);
  });
}

test('phrases-not-supported retries once without phrases', async () => {
  const { clock, engine, log } = await setup();
  engine.emit('error', { code: 'phrases-not-supported' }); end(engine); clock.advance(0); await flush();
  assert.deepEqual(engine.starts[1].phrases, []);
  assert.equal(log.error.length, 0);
});

test('stops after 10 minutes with no recognised command', async () => {
  const { clock, engine, log } = await setup();
  clock.advance(5 * 60000); say(engine, 'next'); await flush();
  clock.advance(10 * 60000 - 1); say(engine, 'hello there'); await flush();
  assert.equal(log.state.some((s) => s.reason === 'idle'), false);
  clock.advance(1); await flush();
  assert.deepEqual(log.state.at(-1), { listening: false, reason: 'idle' });
  assert.equal(engine.stops, 1);
});

test('stop() is on purpose: no restart', async () => {
  const { clock, engine, l, log } = await setup();
  l.stop(); end(engine); clock.advance(60000); await flush();
  assert.equal(engine.starts.length, 1);
  assert.deepEqual(log.state.at(-1), { listening: false, reason: 'stopped' });
});

test('only final results fire, except stop and pause', async () => {
  const { engine, log } = await setup();
  say(engine, 'next', false); say(engine, 'stop', false);
  assert.deepEqual(log.command.map((c) => c.id), ['stop']);
  say(engine, 'search for maps');
  assert.deepEqual(log.command.at(-1), { id: 'search', arg: 'maps', text: 'search for maps' });
  assert.deepEqual(log.heard.at(-1), { text: 'search for maps', id: 'search' });
});

test('an interim command does not fire again on its final result', async () => {
  const { engine, log } = await setup();
  say(engine, 'pause', false); say(engine, 'pause', false); say(engine, 'pause', true);
  assert.deepEqual(log.command.map((c) => c.id), ['pause']);
  say(engine, 'pause', true);
  assert.deepEqual(log.command.map((c) => c.id), ['pause', 'pause']);
});

test('half-duplex ignores all but stop and pause while speaking and for 400 ms after', async () => {
  const { clock, engine, l, log } = await setup();
  l.setHalfDuplex(true);
  say(engine, 'next'); say(engine, 'pause');
  l.setHalfDuplex(false);
  clock.advance(399); say(engine, 'like');
  clock.advance(1); say(engine, 'save');
  assert.deepEqual(log.command.map((c) => c.id), ['pause', 'save']);
});
```

`fakeEngine` also counts `stops` (calls to `stop()`).

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/unit/voice-listener.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/core/voice/listener.js`.

- [ ] **Step 3: Implement `createListener` in `src/core/voice/listener.js`**

- Every restart goes through `clock.setTimeout(…, delay)`; delay 0 for `end`, `no-speech` and `aborted`.
- Keep the start times of the last 60 s. When 10 restarts already fall in that window, schedule the next at `oldest + 60000`.
- Treat `network`, `busy` and `too-many-requests` as backoff codes: consecutive failure n (1–6) waits `min(1000 · 2^(n−1), 30000)`; the 7th gives the fatal `network` error. Reset n on any result.
- `firstTry` applies to a `network` error before the listener has ever received a result.
- The idle timer is 600000 ms, reset by every final result that parses to a command (acted on or not).
- `state` fires only when the listener's own on/off value changes: `{listening:true}` from `start()`, and `{listening:false, reason}` when it stops for good. Engine restarts fire nothing. `listening` returns that value.
- Non-fatal errors fire no `error` event.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/unit/voice-listener.test.js`
Expected: PASS, 15 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/voice/listener.js tests/unit/voice-listener.test.js
git commit -m "Add the voice listener with its restart policy"
```

### Task 3: Read-aloud

**Files:**
- Create: `src/core/voice/reader.js`
- Test: `tests/unit/voice-reader.test.js`

**Interfaces:**
- Consumes: `firstSentence(text)` (`util/text.js`), `domainOf(u)` (`util/url.js`), `getSource(id)` (`sources/index.js`, Plan 02); the `Tts` shape.
- Produces: `cardScript(find) → string[]` and `createReader(tts, getSettings) → {read(sentences) → Promise<void>, stop(), pause(), resume(), get speaking}`. `read` resolves when the last sentence ends or on `stop()`. It stays pending while paused.

`cardScript` rules (§6.4): one string per sentence, each ending in `.`, `!` or `?` (add `.` when missing), empty parts left out:
1. the title;
2. `From <source>`, where `<source>` is `domainOf(find.url)` for kind `'site'`, else `getSource(find.source)?.name ?? domainOf(find.url)`;
3. `firstSentence(find.description)`;
4. `find.why[0]`;
5. for finds with `foundBy`: `Found by <models>`, the part after ` · ` of each label, de-duplicated and joined with ` and `.

- [ ] **Step 1: Write the failing tests**

```js
import { cardScript, createReader } from '../../src/core/voice/reader.js';
import { getSource } from '../../src/core/sources/index.js';

const site = { id: 'url:1', source: 'library', kind: 'site', title: 'The Toaster Museum',
  description: 'A tiny site about toasters. It has 300 photos.', url: 'https://www.toasters.example/a',
  tags: [], why: ['Tuned · matches retro +2'], safety: 'curated' };

test('cardScript reads title, domain, first sentence and why', () => {
  assert.deepEqual(cardScript(site), ['The Toaster Museum.', 'From toasters.example.',
    'A tiny site about toasters.', 'Tuned · matches retro +2.']);
});

test('cardScript names the source for non-site finds and the models for AI finds', () => {
  const art = { ...site, source: 'wikipedia', kind: 'article', title: 'Ada Lovelace?', description: '', why: [],
    foundBy: ['Scout · model-a', 'Digger · model-b', 'Captain · model-a'] };
  assert.deepEqual(cardScript(art), ['Ada Lovelace?', `From ${getSource('wikipedia').name}.`,
    'Found by model-a and model-b.']);
});

function fakeTts() {
  const t = { spoken: [], opts: [], cancels: 0, pending: null };
  t.speak = (text, o) => { t.spoken.push(text); t.opts.push(o); return new Promise((r) => { t.pending = r; }); };
  t.cancel = () => { t.cancels++; t.pending?.(); };
  t.finish = () => t.pending?.();
  return t;
}
const settings = { voice: { voiceURI: 'local-en', rate: 1.2, volume: 0.8, lang: 'en-US' }, screenReaderMode: false };

test('one utterance per sentence, with voice settings', async () => {
  const tts = fakeTts(), r = createReader(tts, () => settings);
  const done = r.read(['A.', 'B.']);
  assert.equal(r.speaking, true);
  tts.finish(); await flush(); tts.finish(); await done;
  assert.deepEqual(tts.spoken, ['A.', 'B.']);
  assert.deepEqual(tts.opts[0], { voiceURI: 'local-en', rate: 1.2, volume: 0.8, lang: 'en-US' });
  assert.equal(r.speaking, false);
});

test('pause cancels and resume restarts the current sentence', async () => {
  const tts = fakeTts(), r = createReader(tts, () => settings);
  let resolved = false;
  const done = r.read(['A.', 'B.', 'C.']).then(() => { resolved = true; });
  tts.finish(); await flush();
  r.pause(); await flush();
  assert.equal(tts.cancels, 1); assert.equal(resolved, false);
  r.resume(); await flush();
  tts.finish(); await flush(); tts.finish(); await done;
  assert.deepEqual(tts.spoken, ['A.', 'B.', 'B.', 'C.']);
});

test('stop ends the read and nothing more is spoken', async () => {
  const tts = fakeTts(), r = createReader(tts, () => settings);
  const done = r.read(['A.', 'B.']);
  r.stop(); await done;
  assert.deepEqual(tts.spoken, ['A.']); assert.equal(tts.cancels, 1);
});

test('a new read replaces the current one', async () => {
  const tts = fakeTts(), r = createReader(tts, () => settings);
  const first = r.read(['A.', 'B.']);
  const second = r.read(['X.']);
  await first; tts.finish(); await second;
  assert.deepEqual(tts.spoken, ['A.', 'X.']);
});

test('screen-reader mode speaks nothing', async () => {
  const tts = fakeTts(), r = createReader(tts, () => ({ ...settings, screenReaderMode: true }));
  await r.read(['A.']);
  assert.deepEqual(tts.spoken, []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/unit/voice-reader.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/core/voice/reader.js`.

- [ ] **Step 3: Implement `src/core/voice/reader.js`**

`read` calls `tts.speak` for the first sentence before its first `await`, and passes `{voiceURI, rate, volume, lang}` from `getSettings().voice`. Keep a generation counter. `read` and `stop` bump it (a new `read` also calls `tts.cancel()`), and the loop leaves when its generation is stale. `pause` cancels the TTS and makes the loop await a resume promise without moving the sentence index. `tts.speak` resolving after `cancel()` is not a sentence end.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/unit/voice-reader.test.js`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/voice/reader.js tests/unit/voice-reader.test.js
git commit -m "Add read-aloud with sentence-level pause"
```

### Task 4: Hands-free state machine and commands

**Files:**
- Create: `src/core/handsfree.js`
- Create: `tests/unit/helpers/handsfree-fakes.js`
- Test: `tests/unit/handsfree.test.js`

**Interfaces:**
- Consumes: `cardScript(find)` (Task 3); the `createListener` and `createReader` objects (Tasks 2–3); `Engine.next({mode})`, `Engine.back()`, `Engine.current()` (Plan 02); `fakeClock`.
- Produces:
  - `createHandsFree({engine, listener, reader, clock, getSettings, ui, getListenMode}) → HandsFree`. `listener` may be `null`. `getListenMode() → 'always'|'push'|'off'`.
  - `HandsFree = {start() → Promise<void>, pause(), resume(), stop(), suspend(), wake() → Promise<boolean>, input(), command(id, arg?) → Promise<void>, showing(find), hold(reason), release(reason), talk(on), setMuted(on), get muted, get state}`.
  - `ui` gains two fields beyond the contract: `act(id) → Promise<void>` (press the visible card button for that command) and `recap(shown: Find[])`.
  - `effectiveListenMode(voiceMode, status: VoiceStatus) → 'always'|'push'|'off'`.
  - `clampDwell(value) → number`: rounds to an integer in 5–300; anything not a finite number gives 20.

`tests/unit/helpers/handsfree-fakes.js` exports `makeHarness(settingsPatch = {})`. It returns `{hf, clock, engine, listener, reader, ui, settings, finds}` where:
- `finds` is an endless generator of `{id:'f<n>', kind:'site', url:'https://s<n>.example/', title:'Find <n>', description:'', why:[], tags:[], source:'library', safety:'curated'}`;
- `engine.next(opts)` records `opts` in `engine.calls` and resolves `{find, branch:'taste', why:[]}`; `engine.emptyNext = reason` makes the next call resolve `{empty:true, reason}`; `engine.failNext = true` makes it reject; `engine.current()` returns the last find it gave (or `null`), and `engine.back()` returns `null`;
- `listener` records `starts`, `stops` and `halfDuplex` (an array of booleans), and has `emit(event, payload)`; `listener.failStart = true` makes `start()` reject;
- `reader.read(s)` records `s` in `reader.reads` and resolves at once unless `reader.hold = true`, when `reader.finish()` resolves it; it counts `stops`, `pauses`, `resumes`;
- every `ui` method records its arguments in `ui.log` as `[name, ...args]`; `ui.search` resolves `{finds:[]}`;
- `settings` is `DEFAULT_SETTINGS` deep-merged with `settingsPatch`, and `getListenMode` returns `settings.listenMode ?? 'always'`.

- [ ] **Step 1: Write the failing tests**

```js
import { effectiveListenMode, clampDwell } from '../../src/core/handsfree.js';
import { makeHarness } from './helpers/handsfree-fakes.js';
const said = (ui) => ui.log.filter((l) => l[0] === 'announce').map((l) => l[1]);

test('effectiveListenMode', () => {
  const s = (kind, continuous, vendor = null) => ({ kind, continuous, vendor, needsDownload: false, reason: null });
  assert.equal(effectiveListenMode('auto', s('web-local', true)), 'always');
  assert.equal(effectiveListenMode('auto', s('native', true, 'android')), 'always');
  assert.equal(effectiveListenMode('auto', s('native', false, 'android')), 'push');
  assert.equal(effectiveListenMode('auto', s('web-cloud', false, 'google')), 'push');
  assert.equal(effectiveListenMode('auto', s('web-cloud', true, 'apple')), 'always');
  assert.equal(effectiveListenMode('always', s('web-cloud', false, 'google')), 'always');
  assert.equal(effectiveListenMode('push', s('web-local', true)), 'push');
  assert.equal(effectiveListenMode('off', s('web-local', true)), 'off');
  assert.equal(effectiveListenMode('always', s('none', false)), 'off');
});

test('clampDwell', () => {
  assert.deepEqual([3, 1000, 20.4, 'abc', NaN, 5, 300].map(clampDwell), [5, 300, 20, 20, 20, 5, 300]);
});

test('start goes active, listens once and shows a find', async () => {
  const { hf, listener, engine, ui, reader } = makeHarness();
  await hf.start(); await hf.start();
  assert.equal(hf.state, 'active');
  assert.equal(listener.starts, 1);
  assert.deepEqual(engine.calls, [{ mode: 'tuned' }]);
  assert.deepEqual(ui.log.find((l) => l[0] === 'setState'), ['setState', 'active']);
  assert.deepEqual(reader.reads[0], ['Find 1.', 'From s1.example.']);
});

test('push and off modes do not start the mic', async () => {
  for (const listenMode of ['push', 'off']) {
    const { hf, listener } = makeHarness({ listenMode });
    await hf.start();
    assert.equal(listener.starts, 0);
  }
});

test('pause, the pause toggle and resume', async () => {
  const { hf, ui, reader } = makeHarness();
  await hf.start();
  hf.pause();
  assert.equal(hf.state, 'paused'); assert.equal(reader.pauses, 1);
  assert.deepEqual(ui.log.filter((l) => l[0] === 'countdown').at(-1), ['countdown', null]);
  await hf.command('pause');
  assert.equal(hf.state, 'active'); assert.equal(reader.resumes, 1);
  await hf.command('pause'); await hf.command('resume');
  assert.deepEqual(said(ui).slice(-4), ['Lean-back paused', 'Lean-back on', 'Lean-back paused', 'Lean-back on']);
});

test('stop goes idle and shows the recap', async () => {
  const { hf, listener, reader, ui } = makeHarness();
  await hf.start(); await hf.command('next');
  hf.stop();
  assert.equal(hf.state, 'idle'); assert.equal(listener.stops, 1); assert.ok(reader.stops >= 1);
  assert.deepEqual(ui.log.find((l) => l[0] === 'recap')[1].map((f) => f.id), ['f1', 'f2']);
});

test('suspend and wake', async () => {
  const { hf, listener, reader } = makeHarness();
  await hf.start();
  hf.suspend();
  assert.equal(hf.state, 'suspended'); assert.equal(listener.stops, 1); assert.equal(reader.pauses, 1);
  assert.equal(await hf.wake(), true);
  assert.equal(hf.state, 'active'); assert.equal(listener.starts, 2); assert.equal(reader.resumes, 1);
});

test('wake stays suspended when the mic cannot restart', async () => {
  const { hf, listener } = makeHarness();
  await hf.start(); hf.suspend();
  listener.failStart = true;
  assert.equal(await hf.wake(), false);
  assert.equal(hf.state, 'suspended');
});

test('commands route to the engine, the card and the UI', async () => {
  const { hf, engine, ui, reader, listener } = makeHarness({ mode: 'ai' });
  await hf.command('next');
  await hf.command('fate');
  assert.deepEqual(engine.calls, [{ mode: 'tuned' }, { mode: 'fate' }]);
  for (const id of ['like', 'dislike', 'save', 'share', 'more']) await hf.command(id);
  assert.deepEqual(ui.log.filter((l) => l[0] === 'act').map((l) => l[1]), ['like', 'dislike', 'save', 'share', 'more']);
  await hf.command('read');
  assert.deepEqual(reader.reads.at(-1), ['Find 2.', 'From s2.example.']);
  await hf.command('stop');
  assert.ok(reader.stops >= 1);
  await hf.command('daily'); await hf.command('help');
  assert.ok(ui.log.some((l) => l[0] === 'navigate' && l[1] === 'daily'));
  assert.ok(ui.log.some((l) => l[0] === 'openHelp'));
  await hf.command('stopListening');
  assert.equal(listener.stops, 1); assert.equal(said(ui).at(-1), 'Listening off');
});

test('back shows the previous find', async () => {
  const { hf, engine, ui } = makeHarness();
  const prev = { id: 'p', title: 'Prev', url: 'https://p.example/', kind: 'site', why: ['x'] };
  engine.back = () => prev;
  await hf.command('back');
  assert.deepEqual(ui.log.find((l) => l[0] === 'show')[1], { find: prev, branch: null, why: ['x'] });
});

test('open presses Open and pauses lean-back', async () => {
  const { hf, ui } = makeHarness();
  await hf.start(); await hf.command('open');
  assert.ok(ui.log.some((l) => l[0] === 'act' && l[1] === 'open'));
  assert.equal(hf.state, 'paused');
});

test('search announces, searches, then shows the next find', async () => {
  const { hf, ui, engine } = makeHarness();
  await hf.command('search', 'pixel art');
  assert.equal(said(ui)[0], 'Searching for pixel art');
  assert.deepEqual(ui.log.find((l) => l[0] === 'search'), ['search', 'pixel art']);
  assert.equal(engine.calls.length, 1);
});

test('listener events become commands and messages', async () => {
  const { hf, listener, ui, engine } = makeHarness();
  await hf.start();
  listener.emit('command', { id: 'next', text: 'next' }); await flush();
  assert.equal(engine.calls.length, 2);
  const msgs = { 'not-allowed': 'Microphone blocked', 'service-not-allowed': 'Microphone blocked',
    'audio-capture': 'No microphone found', 'language-not-supported': 'Voice does not support this language',
    network: 'Voice is not available right now' };
  for (const [code, text] of Object.entries(msgs)) {
    listener.emit('error', { code, fatal: true });
    assert.deepEqual(ui.log.filter((l) => l[0] === 'announce').at(-1), ['announce', text, { assertive: true }]);
  }
  listener.emit('state', { listening: false, reason: 'idle' });
  assert.equal(said(ui).at(-1), 'Listening paused after 10 minutes with no command.');
});

test('mute stops reading and keeps later finds silent', async () => {
  const { hf, reader } = makeHarness();
  await hf.start();
  hf.setMuted(true);
  assert.equal(hf.muted, true); assert.ok(reader.stops >= 1);
  await hf.command('next');
  assert.equal(reader.reads.length, 1);
});

test('talk starts the mic and stops it 1.5 s after release', async () => {
  const { hf, listener, clock } = makeHarness({ listenMode: 'push' });
  await hf.start();
  hf.talk(true); hf.talk(false);
  clock.advance(1499); assert.equal(listener.stops, 0);
  clock.advance(1); assert.equal(listener.stops, 1);
  assert.equal(listener.starts, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/unit/handsfree.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/core/handsfree.js`.

- [ ] **Step 3: Implement `src/core/handsfree.js` (state machine and command routing)**

Rules the tests do not spell out:
- `engine.next` always gets `{mode: settings.mode === 'ai' ? 'tuned' : settings.mode}`, or `{mode:'fate'}` for `fate`. AI runs only through `ui.search`.
- `command(id)` calls `input()` first for every id except `pause`, `resume`, `stop`, `stopListening` and `help`.
- `command('pause')` toggles between active and paused; `command('resume')` only resumes.
- `showing(find)` is a no-op when `find.id` is the find already on screen. Otherwise it records the find for the recap, stops the reader, and in the active state reads `cardScript(find)` (Task 5 adds the dwell).
- Status messages go to `ui.announce(text)` (polite): `Lean-back paused`, `Lean-back on`, `Listening off`, `Searching for <words>` and the idle message. Errors add `{assertive:true}`.
- `say(text)` is for spoken cues only (Task 5): `ui.announce(text)` when muted or in screen-reader mode, otherwise `reader.read([text])`.
- `suspend()` calls `reader.pause()` and remembers the previous state; `wake()` calls `reader.resume()` and returns to it. The reader ignores both when it is not reading.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/unit/handsfree.test.js`
Expected: PASS, 15 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/handsfree.js tests/unit/helpers/handsfree-fakes.js tests/unit/handsfree.test.js
git commit -m "Add the hands-free state machine and command routing"
```

### Task 5: Lean-back loop

**Files:**
- Modify: `src/core/handsfree.js`
- Test: `tests/unit/handsfree-leanback.test.js`

**Interfaces:**
- Consumes: everything from Task 4.
- Produces: no new names. Adds the dwell, the countdown, holds, the AI refill rule, the session length, the 45-minute cue and the recap on session end.

The tests use `tick(clock, ms)`, which advances one second at a time and flushes after each: `for (let t = 0; t < ms; t += 1000) { clock.advance(1000); await flush(); }`.

- [ ] **Step 1: Write the failing tests**

```js
const count = (ui, text) => ui.log.filter((l) => l[0] === 'announce' && l[1] === text).length;

test('the dwell starts after reading ends and advances at 0', async () => {
  const { hf, clock, engine, reader, ui } = makeHarness();
  reader.hold = true;
  await hf.start();
  await tick(clock, 30000);
  assert.equal(engine.calls.length, 1);
  reader.finish(); await flush();
  assert.deepEqual(ui.log.filter((l) => l[0] === 'countdown').at(-1), ['countdown', 20]);
  reader.hold = false;
  await tick(clock, 19000);
  assert.equal(engine.calls.length, 1);
  await tick(clock, 1000);
  assert.equal(engine.calls.length, 2);
});

test('Next find in 10 seconds is announced once per find', async () => {
  const { hf, clock, ui } = makeHarness();
  await hf.start();
  await tick(clock, 12000);
  hf.input();
  await tick(clock, 12000);
  assert.equal(count(ui, 'Next find in 10 seconds'), 1);
  await tick(clock, 8000);
  await tick(clock, 12000);
  assert.equal(count(ui, 'Next find in 10 seconds'), 2);
});

test('a 5 s dwell announces Next find in 5 seconds once', async () => {
  const { hf, clock, ui, engine } = makeHarness({ dwellSec: 5 });
  await hf.start();
  await tick(clock, 4000);
  assert.equal(count(ui, 'Next find in 5 seconds'), 1);
  assert.equal(count(ui, 'Next find in 10 seconds'), 0);
  await tick(clock, 1000);
  assert.equal(engine.calls.length, 2);
});

test('input restarts the dwell from the full time', async () => {
  const { hf, clock, engine } = makeHarness();
  await hf.start();
  await tick(clock, 15000); hf.input();
  await tick(clock, 19000);
  assert.equal(engine.calls.length, 1);
  await tick(clock, 1000);
  assert.equal(engine.calls.length, 2);
});

test('wait for me never advances', async () => {
  const { hf, clock, engine, ui } = makeHarness({ dwellWaitForMe: true });
  await hf.start();
  await tick(clock, 600000);
  assert.equal(engine.calls.length, 1);
  assert.deepEqual(ui.log.filter((l) => l[0] === 'countdown').at(-1), ['countdown', null]);
});

test('holds stop the countdown; the last release restarts it', async () => {
  const { hf, clock, engine } = makeHarness();
  await hf.start();
  hf.hold('view'); hf.hold('help');
  await tick(clock, 60000);
  hf.release('view');
  await tick(clock, 60000);
  assert.equal(engine.calls.length, 1);
  hf.release('help');
  await tick(clock, 20000);
  assert.equal(engine.calls.length, 2);
});

test('suspend keeps the seconds left', async () => {
  const { hf, clock, engine } = makeHarness();
  await hf.start();
  await tick(clock, 15000); hf.suspend();
  await tick(clock, 60000);
  await hf.wake();
  await tick(clock, 4000);
  assert.equal(engine.calls.length, 1);
  await tick(clock, 1000);
  assert.equal(engine.calls.length, 2);
});

test('an empty result pauses lean-back and announces the reason', async () => {
  const { hf, clock, engine, ui } = makeHarness();
  await hf.start();
  engine.emptyNext = 'You have seen every find in this pool.';
  await tick(clock, 20000);
  assert.equal(hf.state, 'paused');
  assert.equal(count(ui, 'You have seen every find in this pool.'), 1);
  await tick(clock, 120000);
  assert.equal(engine.calls.length, 2);
});

test('a failed next pauses lean-back with an error', async () => {
  const { hf, clock, engine, ui } = makeHarness();
  await hf.start();
  engine.failNext = true;
  await tick(clock, 20000);
  assert.equal(hf.state, 'paused');
  assert.deepEqual(ui.log.filter((l) => l[0] === 'announce').at(-1),
    ['announce', 'Could not load the next find.', { assertive: true }]);
});

test('no AI in lean-back unless Let AI refill lean-back is on', async () => {
  const { hf, clock, engine, ui } = makeHarness({ mode: 'ai', dwellSec: 5 });
  await hf.start(); await hf.command('search', 'maps');
  await tick(clock, 25 * 5000);
  assert.equal(ui.log.filter((l) => l[0] === 'search').length, 1);
  assert.ok(engine.calls.every((c) => c.mode !== 'ai'));
});

test('with refill on, at most one AI search per 10 finds', async () => {
  const { hf, clock, ui } = makeHarness({ mode: 'ai', dwellSec: 5, leanBackAI: true });
  await hf.start(); await hf.command('search', 'maps');
  await tick(clock, 20 * 5000);
  assert.deepEqual(ui.log.filter((l) => l[0] === 'search').map((l) => l[1]), ['maps', 'maps', 'maps']);
});

test('the session length ends the session with a recap', async () => {
  const { hf, clock, ui } = makeHarness({ sessionLengthMin: 30, dwellWaitForMe: true });
  await hf.start();
  clock.advance(30 * 60000 - 1); await flush();
  assert.equal(hf.state, 'active');
  clock.advance(1); await flush();
  assert.equal(hf.state, 'idle');
  assert.ok(ui.log.some((l) => l[0] === 'recap'));
});

test('the 45-minute cue is said once and only when on', async () => {
  for (const exploringCue of [true, false]) {
    const { hf, clock, reader } = makeHarness({ exploringCue, dwellWaitForMe: true });
    await hf.start();
    clock.advance(90 * 60000); await flush();
    const cues = reader.reads.filter((r) => r[0] === "You've been exploring for 45 minutes.").length;
    assert.equal(cues, exploringCue ? 1 : 0);
  }
});

test('screen-reader mode sends the card to the live region instead', async () => {
  const { hf, reader, ui } = makeHarness({ screenReaderMode: true });
  await hf.start();
  assert.equal(reader.reads.length, 0);
  assert.equal(count(ui, 'Find 1. From s1.example.'), 1);
});

test('half-duplex is on while reading', async () => {
  const { hf, listener } = makeHarness();
  await hf.start();
  assert.deepEqual(listener.halfDuplex, [true, false]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/unit/handsfree-leanback.test.js`
Expected: FAIL. The first test reports `1 !== 2`, because nothing advances yet.

- [ ] **Step 3: Implement the lean-back loop in `src/core/handsfree.js`**

- After `cardScript` is read (or announced in screen-reader mode, or skipped when muted), and only while active with no holds, start the dwell: `clampDwell(settings.dwellSec)` seconds, or `ui.countdown(null)` when `dwellWaitForMe` is on.
- Tick with `clock.setTimeout(…, 1000)`. Call `ui.countdown(left)` at the start and on each tick.
- Announce `Next find in 10 seconds` when `left` reaches 10. When the dwell is 10 s or less, announce `Next find in <dwell> seconds` at the start instead. Keep a per-find flag, so `input()` and holds never repeat it.
- At 0, advance: count the find; when `leanBackAI` is on, a search text exists and 10 finds have passed since the last search, call `ui.search(text)` first and reset the count. Then `engine.next`. An `{empty}` result pauses and announces `reason`. A rejection pauses and announces `Could not load the next find.` assertively.
- `start()` sets `clock.setTimeout` for the session length (`Session over.`, then `stop()`) and, when `exploringCue` is on, for 45 minutes (`You've been exploring for 45 minutes.`). Both go through `say`. `stop()` clears them.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/unit/handsfree-leanback.test.js tests/unit/handsfree.test.js`
Expected: PASS, 15 tests in each file.

- [ ] **Step 5: Commit**

```bash
git add src/core/handsfree.js tests/unit/handsfree-leanback.test.js
git commit -m "Add the lean-back loop with dwell, cue and session length"
```

<!-- PLAN CONTINUES -->
