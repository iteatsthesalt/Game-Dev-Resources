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

### Task 6: Web voice engine

**Files:**
- Modify: `src/platform/web-voice.js` (keep Plan 01's `createNoVoice`)
- Test: `tests/unit/web-voice.test.js`

**Interfaces:**
- Consumes: the `VoiceEngine` and `VoiceStatus` shapes.
- Produces: `createWebVoice(win, {lang = 'en-US'} = {}) → VoiceEngine` and `vendorFromUA(ua) → 'google'|'apple'|'microsoft'|'mozilla'`.

`probe({allowCloud})` results. `continuous` is `!/Android/i.test(ua)`; `vendor` is `vendorFromUA(win.navigator.userAgent)` except where shown as `null`:

| Recogniser | `available({langs:[lang], processLocally:true})` | allowCloud | Result |
|---|---|---|---|
| none | — | any | `{kind:'none', vendor:null, needsDownload:false, continuous:false, reason:'This browser has no speech recognition.'}` |
| yes | `'available'` | any | `{kind:'web-local', vendor:null, needsDownload:false, continuous, reason:null}` |
| yes | `'downloadable'` or `'downloading'` | false | `{kind:'none', vendor, needsDownload:true, continuous, reason:'Download offline voice to use voice on this device.'}` |
| yes | `'downloadable'` or `'downloading'` | true | `{kind:'web-cloud', vendor, needsDownload:true, continuous, reason:null}` |
| yes | `'unavailable'`, or no `available` | false | `{kind:'none', vendor, needsDownload:false, continuous, reason:'Voice on this browser is sent to <Vendor>. Turn on cloud voice to use it.'}` |
| yes | `'unavailable'`, or no `available` | true | `{kind:'web-cloud', vendor, needsDownload:false, continuous, reason:null}` |

`<Vendor>` is `Google`, `Apple`, `Microsoft` or `Mozilla`. `kind:'none'` with a non-null `vendor` means "cloud voice would work after the opt-in"; the UI relies on this. The working test start of §6.2 is the listener's `firstTry` rule (Task 2) on the first real start.

- [ ] **Step 1: Write the failing tests**

The test file defines `fakeWin({ua, prefix = 'SpeechRecognition', available, phrases = true})`. Its recogniser class records every instance in `win.instances`, has a writable `quality` property, counts `start()` and `abort()` calls, and offers `inst.fire(type, props)` to dispatch to `on<type>` handlers. `available` (a string) adds the static `available()` and an `install()` that records its argument and resolves `true`. `phrases` adds `win.SpeechRecognitionPhrase = class { constructor(phrase, boost) { Object.assign(this, { phrase, boost }); } }`.

```js
import { createWebVoice, vendorFromUA } from '../../src/platform/web-voice.js';
const UA = {
  chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0',
  firefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:160.0) Gecko/20100101 Firefox/160.0',
  safari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.1 Safari/605.1.15',
  crios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 19_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/142.0 Mobile/15E148 Safari/604.1',
  android: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36',
};

test('vendorFromUA', () => {
  assert.deepEqual(Object.values(UA).map(vendorFromUA), ['google', 'microsoft', 'mozilla', 'apple', 'apple', 'google']);
});

test('probe follows the table', async () => {
  const p = (o, allowCloud) => createWebVoice(fakeWin(o)).probe({ allowCloud });
  assert.equal((await p({ ua: UA.chrome, prefix: null }, true)).reason, 'This browser has no speech recognition.');
  assert.deepEqual(await p({ ua: UA.chrome, available: 'available' }, false),
    { kind: 'web-local', vendor: null, needsDownload: false, continuous: true, reason: null });
  assert.deepEqual(await p({ ua: UA.edge, available: 'downloadable' }, false),
    { kind: 'none', vendor: 'microsoft', needsDownload: true, continuous: true, reason: 'Download offline voice to use voice on this device.' });
  assert.equal((await p({ ua: UA.edge, available: 'downloading' }, true)).kind, 'web-cloud');
  assert.deepEqual(await p({ ua: UA.android, prefix: 'webkitSpeechRecognition' }, false),
    { kind: 'none', vendor: 'google', needsDownload: false, continuous: false,
      reason: 'Voice on this browser is sent to Google. Turn on cloud voice to use it.' });
  assert.deepEqual(await p({ ua: UA.safari, prefix: 'webkitSpeechRecognition' }, true),
    { kind: 'web-cloud', vendor: 'apple', needsDownload: false, continuous: true, reason: null });
});

test('install asks for the on-device pack for the language', async () => {
  const win = fakeWin({ ua: UA.chrome, available: 'downloadable' });
  assert.equal(await createWebVoice(win, { lang: 'en-GB' }).install(), true);
  assert.deepEqual(win.installedWith, { langs: ['en-GB'], processLocally: true });
  assert.equal(await createWebVoice(fakeWin({ ua: UA.android })).install(), false);
});

test('start on-device sets processLocally, command quality and phrases', async () => {
  const win = fakeWin({ ua: UA.chrome, available: 'available' });
  await createWebVoice(win).start({ lang: 'en-US', phrases: ['next', 'go back'], allowCloud: false });
  const r = win.instances[0];
  assert.equal(r.lang, 'en-US'); assert.equal(r.continuous, true); assert.equal(r.interimResults, true);
  assert.equal(r.processLocally, true); assert.equal(r.quality, 'command');
  assert.deepEqual(r.phrases.map((x) => [x.phrase, x.boost]), [['next', 5], ['go back', 5]]);
  assert.equal(r.starts, 1);
});

test('start with no phrases or no phrase support leaves phrases unset', async () => {
  for (const [phrases, list] of [[true, []], [false, ['next']]]) {
    const win = fakeWin({ ua: UA.chrome, available: 'available', phrases });
    await createWebVoice(win).start({ lang: 'en-US', phrases: list, allowCloud: false });
    assert.equal(win.instances[0].phrases, undefined);
  }
});

test('start without allowCloud on a cloud-only browser never constructs a recogniser', async () => {
  for (const o of [{ ua: UA.android }, { ua: UA.safari, prefix: 'webkitSpeechRecognition' }, { ua: UA.edge, available: 'downloadable' }]) {
    const win = fakeWin(o);
    await assert.rejects(createWebVoice(win).start({ lang: 'en-US', phrases: [], allowCloud: false }), /Cloud voice is off/);
    assert.equal(win.instances.length, 0);
  }
});

test('cloud start does not ask for on-device processing', async () => {
  const win = fakeWin({ ua: UA.android });
  await createWebVoice(win).start({ lang: 'en-US', phrases: [], allowCloud: true });
  assert.notEqual(win.instances[0].processLocally, true);
});

test('events map to result, state and error', async () => {
  const win = fakeWin({ ua: UA.chrome, available: 'available' });
  const v = createWebVoice(win), got = [];
  for (const ev of ['result', 'state', 'error']) v.on(ev, (p) => got.push([ev, p]));
  await v.start({ lang: 'en-US', phrases: [], allowCloud: false });
  const r = win.instances[0];
  r.fire('start');
  r.fire('result', { resultIndex: 0, results: [Object.assign([{ transcript: ' Next ' }], { isFinal: true })] });
  r.fire('error', { error: 'network' });
  r.fire('end');
  assert.deepEqual(got, [['state', { listening: true }], ['result', { text: 'Next', final: true }],
    ['error', { code: 'network' }], ['state', { listening: false }]]);
  v.stop();
  assert.equal(r.aborts, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/unit/web-voice.test.js`
Expected: FAIL with `SyntaxError: The requested module '../../src/platform/web-voice.js' does not provide an export named 'createWebVoice'`.

- [ ] **Step 3: Implement `createWebVoice` and `vendorFromUA` in `src/platform/web-voice.js`**

- `vendorFromUA`: `Edg/` → microsoft; `CriOS|FxiOS|EdgiOS|iPhone|iPad` or `Safari/` without `Chrome/` → apple; `Firefox/` → mozilla; else google.
- The recogniser is `win.SpeechRecognition || win.webkitSpeechRecognition`. `start` re-checks `available(...)`: on-device only when it returns `'available'`; otherwise it needs `allowCloud`, or it rejects with `new Error('Cloud voice is off.')` before constructing anything.
- Set `quality = 'command'` only when `'quality' in rec`. Each result from `resultIndex` emits `{text: transcript.trim(), final: isFinal}`. `stop()` calls `abort()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/unit/web-voice.test.js`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/platform/web-voice.js tests/unit/web-voice.test.js
git commit -m "Add the web voice engine with on-device first"
```

### Task 7: Web speech output and media keys

**Files:**
- Modify: `src/platform/web-tts.js`
- Modify: `src/platform/web-media.js` (keep Plan 01's `createWebWakeLock`)
- Test: `tests/unit/web-tts.test.js`, `tests/unit/web-media.test.js`

**Interfaces:**
- Consumes: the `Tts` and `Platform['media']` shapes; `fakeClock`.
- Produces:
  - `createWebTts(speechSynthesis, {Utterance = globalThis.SpeechSynthesisUtterance, clock = realClock} = {}) → Tts`. `speak` also takes `opts.lang` (default `'en-US'`).
  - `createWebMedia(navigator, {silentAudio = false, createAudio, createObjectURL} = {}) → Platform['media']`.
  - `silentWavBlob() → Blob`: 1 s of 8 kHz, mono, 8-bit silence (`audio/wav`, 8044 bytes). A `blob:` URL is used because the CSP's `media-src` has no `data:`.

The TTS tests use `fakeSynth(voiceLists)`: `getVoices()` returns the next list from `voiceLists` on each call (the last one repeats), `speak(u)` pushes `u` onto `spoken`, `cancel()` counts into `cancels`, and `addEventListener('voiceschanged', fn)` stores `fn` for `fireVoicesChanged()` (the method is absent when the test passes `{noEvents:true}`). `FakeUtterance` stores `text` and dispatches `onend` and `onerror`. Voices: `local = {voiceURI:'local-en', name:'Local English', lang:'en-US', localService:true}`, `net = {voiceURI:'net-en', name:'Online English', lang:'en-US', localService:false}`, `fr = {voiceURI:'local-fr', name:'Local French', lang:'fr-FR', localService:true}`.

- [ ] **Step 1: Write the failing tests**

```js
// tests/unit/web-tts.test.js
test('voices lists local voices first', async () => {
  const tts = createWebTts(fakeSynth([[net, local]]), { Utterance: FakeUtterance, clock: fakeClock(0) });
  assert.deepEqual(await tts.voices(), [
    { uri: 'local-en', name: 'Local English', lang: 'en-US', local: true },
    { uri: 'net-en', name: 'Online English', lang: 'en-US', local: false }]);
});

test('voices waits for voiceschanged', async () => {
  const synth = fakeSynth([[], [local]]);
  const p = createWebTts(synth, { Utterance: FakeUtterance, clock: fakeClock(0) }).voices();
  synth.fireVoicesChanged();
  assert.equal((await p).length, 1);
});

test('voices polls every 250 ms when voiceschanged never fires, and gives up at 2 s', async () => {
  const clock = fakeClock(0);
  const p = createWebTts(fakeSynth([[], [], [local]], { noEvents: true }), { Utterance: FakeUtterance, clock }).voices();
  clock.advance(250); await flush(); clock.advance(250); await flush();
  assert.equal((await p).length, 1);
  const c2 = fakeClock(0);
  const q = createWebTts(fakeSynth([[]], { noEvents: true }), { Utterance: FakeUtterance, clock: c2 }).voices();
  for (let i = 0; i < 8; i++) { c2.advance(250); await flush(); }
  assert.deepEqual(await q, []);
});

test('speak prefers a local voice for the language and resolves on end', async () => {
  const synth = fakeSynth([[net, fr, local]]);
  const tts = createWebTts(synth, { Utterance: FakeUtterance, clock: fakeClock(0) });
  const p = tts.speak('Hello.', { lang: 'en-GB' }); await flush();
  const u = synth.spoken[0];
  assert.equal(u.voice.voiceURI, 'local-en'); assert.equal(u.lang, 'en-GB'); assert.equal(u.rate, 1); assert.equal(u.volume, 1);
  u.onend(); await p;
});

test('speak honours voiceURI, rate and volume, and resolves on error', async () => {
  const synth = fakeSynth([[local, net]]);
  const tts = createWebTts(synth, { Utterance: FakeUtterance, clock: fakeClock(0) });
  const p = tts.speak('Hi.', { voiceURI: 'net-en', rate: 1.5, volume: 0.5 }); await flush();
  const u = synth.spoken[0];
  assert.deepEqual([u.voice.voiceURI, u.rate, u.volume], ['net-en', 1.5, 0.5]);
  tts.cancel(); u.onerror({ error: 'interrupted' }); await p;
  assert.equal(synth.cancels, 1);
});

// tests/unit/web-media.test.js
function fakeNav() {
  const handlers = {};
  return { handlers, mediaSession: { playbackState: 'none', setActionHandler: (a, fn) => { handlers[a] = fn; } } };
}

test('setHandlers maps the headset keys', () => {
  const nav = fakeNav(), calls = [];
  createWebMedia(nav).setHandlers({ next: () => calls.push('next'), previous: () => calls.push('back'), playPause: () => calls.push('pp') });
  for (const a of ['nexttrack', 'previoustrack', 'play', 'pause']) nav.handlers[a]();
  assert.deepEqual(calls, ['next', 'back', 'pp', 'pp']);
});

test('setActive sets the playback state; no Media Session is a no-op', () => {
  const nav = fakeNav(), m = createWebMedia(nav);
  m.setActive(true); assert.equal(nav.mediaSession.playbackState, 'playing');
  m.setActive(false); assert.equal(nav.mediaSession.playbackState, 'paused');
  const bare = createWebMedia({});
  bare.setHandlers({ next() {} }); bare.setActive(true);
});

test('the silent-audio fallback plays a looping blob while active', async () => {
  const audio = { plays: 0, pauses: 0, play() { this.plays++; return Promise.resolve(); }, pause() { this.pauses++; } };
  const m = createWebMedia(fakeNav(), { silentAudio: true, createAudio: () => audio, createObjectURL: () => 'blob:x' });
  m.setActive(true);
  assert.deepEqual([audio.src, audio.loop, audio.plays], ['blob:x', true, 1]);
  m.setActive(false); assert.equal(audio.pauses, 1);
  const off = { plays: 0, play() { this.plays++; } };
  createWebMedia(fakeNav(), { createAudio: () => off }).setActive(true);
  assert.equal(off.plays, 0);
});

test('silentWavBlob is a valid 1 s WAV', async () => {
  const b = silentWavBlob(), bytes = new Uint8Array(await b.arrayBuffer());
  assert.equal(b.type, 'audio/wav'); assert.equal(bytes.length, 8044);
  assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), 'RIFF');
  assert.equal(new TextDecoder().decode(bytes.slice(8, 12)), 'WAVE');
  assert.equal(bytes[44], 128); assert.equal(bytes[8043], 128);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/unit/web-tts.test.js tests/unit/web-media.test.js`
Expected: FAIL. `voices lists local voices first` fails on order or shape, and `silentWavBlob` is not exported.

- [ ] **Step 3: Implement the changes**

- `web-tts.js`: `voices()` uses `getVoices()`, then `voiceschanged`, then polling every 250 ms through `clock`, giving up at 2000 ms. The sort is stable, local first. `speak` picks `voiceURI` when it matches, else the first local voice whose `lang` starts with the first two letters of `opts.lang`, else leaves `voice` unset. It resolves on `onend` or `onerror`.
- `web-media.js`: each `setActionHandler` call sits in its own `try`, because unsupported actions throw. The silent audio element is created on the first `setActive(true)` and reused.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/unit/web-tts.test.js tests/unit/web-media.test.js`
Expected: PASS, 5 and 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/platform/web-tts.js src/platform/web-media.js tests/unit/web-tts.test.js tests/unit/web-media.test.js
git commit -m "Prefer local voices and add Media Session keys"
```

### Task 8: Key map

**Files:**
- Create: `src/ui/keymap.js`
- Test: `tests/unit/keymap.test.js`

**Interfaces:**
- Consumes: `COMMANDS` (Task 1).
- Produces:
  - `keyToCommand(e, settings) → string|null`, where `e = {key, target, ctrlKey, altKey, metaKey, repeat}` and `target` may be `null`;
  - `installKeymap({getSettings, dispatch, onTalk, target = document}) → () => void` (uninstall). `onTalk(true)` on V down and `onTalk(false)` on V up, under the same rules as other single keys.

`keymap.js` must not touch `document` at import time, so Node can import it.

- [ ] **Step 1: Write the failing tests**

```js
import { keyToCommand, installKeymap } from '../../src/ui/keymap.js';
import { COMMANDS } from '../../src/core/voice/grammar.js';
const on = { singleKeyShortcuts: true }, off = { singleKeyShortcuts: false };
const k = (key, target = { tagName: 'BODY' }, extra = {}) => ({ key, target, ctrlKey: false, altKey: false, metaKey: false, repeat: false, ...extra });

test('every command key maps to its command', () => {
  for (const c of COMMANDS.filter((c) => c.key)) assert.equal(keyToCommand(k(c.key), on), c.id, c.key);
  assert.equal(keyToCommand(k('x'), on), null);
  assert.equal(keyToCommand(k('v'), on), null);
});

test('letters ignore case; modifiers and repeats are ignored', () => {
  assert.equal(keyToCommand(k('L'), on), 'like');
  assert.equal(keyToCommand(k('l', undefined, { ctrlKey: true }), on), null);
  assert.equal(keyToCommand(k('s', undefined, { metaKey: true }), on), null);
  assert.equal(keyToCommand(k(' ', undefined, { repeat: true }), on), null);
});

test('keys are ignored in text fields and frames, Esc included', () => {
  const fields = [{ tagName: 'INPUT', type: 'text' }, { tagName: 'INPUT', type: 'search' }, { tagName: 'TEXTAREA' },
    { tagName: 'SELECT' }, { tagName: 'DIV', isContentEditable: true }, { tagName: 'IFRAME' }];
  for (const t of fields) for (const key of ['l', ' ', 'Escape', '/']) assert.equal(keyToCommand(k(key, t), on), null);
  assert.equal(keyToCommand(k('l', { tagName: 'INPUT', type: 'range' }), on), 'like');
});

test('Space on a focused control is left to the control', () => {
  const controls = [{ tagName: 'BUTTON' }, { tagName: 'A' }, { tagName: 'SUMMARY' },
    { tagName: 'INPUT', type: 'checkbox' }, { tagName: 'INPUT', type: 'radio' },
    { tagName: 'DIV', getAttribute: (n) => (n === 'role' ? 'button' : null) }];
  for (const t of controls) assert.equal(keyToCommand(k(' ', t), on), null);
  assert.equal(keyToCommand(k('l', { tagName: 'BUTTON' }), on), 'like');
});

test('turning single keys off leaves only Esc', () => {
  for (const c of COMMANDS.filter((c) => c.key && c.key !== 'Escape')) assert.equal(keyToCommand(k(c.key), off), null);
  assert.equal(keyToCommand(k('Escape'), off), 'stop');
});

test('installKeymap dispatches, prevents default and handles hold V', () => {
  const t = new EventTarget(), got = [], talk = [];
  const undo = installKeymap({ getSettings: () => on, dispatch: (id) => got.push(id), onTalk: (v) => talk.push(v), target: t });
  const fire = (type, key, extra = {}) => { const e = Object.assign(new Event(type, { cancelable: true }), { key, ...extra }); t.dispatchEvent(e); return e; };
  assert.equal(fire('keydown', '/').defaultPrevented, true);
  fire('keydown', 'v'); fire('keydown', 'v', { repeat: true }); fire('keyup', 'v');
  assert.deepEqual(got, ['search']); assert.deepEqual(talk, [true, false]);
  undo(); fire('keydown', 'l');
  assert.deepEqual(got, ['search']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/unit/keymap.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/ui/keymap.js`.

- [ ] **Step 3: Implement `src/ui/keymap.js`**

Text fields are `TEXTAREA`, `SELECT`, `isContentEditable`, and `INPUT` of any type except `checkbox`, `radio`, `button`, `submit`, `reset` and `range`. Controls that own Space are `BUTTON`, `A`, `SUMMARY`, checkbox and radio inputs, and `role` values `button`, `checkbox`, `switch`, `menuitem`, `tab` and `option`. A target without `tagName` counts as the page body.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/unit/keymap.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/ui/keymap.js tests/unit/keymap.test.js
git commit -m "Add the single-key map with a text-field guard"
```

### Task 9: Hands-free bar, help card and wiring

**Files:**
- Create: `src/ui/handsfree-ui.js`
- Modify: `src/ui/boot.js`, `src/platform/pwa.js`, `src/ui/views/stumble.js`, `src/ui/styles/app.css`
- Modify: `tests/e2e/helpers/fakes.js`
- Test: `tests/e2e/handsfree.spec.js`

**Interfaces:**
- Consumes: `createHandsFree`, `effectiveListenMode` (Tasks 4–5); `createListener` (Task 2); `createReader`, `cardScript` (Task 3); `COMMANDS`, `commandPhrases` (Task 1); `installKeymap` (Task 8); `createWebVoice` (Task 6); `createWebMedia` (Task 7); `showResult` from `ui/views/stumble.js`; `announce` (`ui/a11y.js`); `h`, `clear` (`ui/dom.js`); `navigate` (`ui/router.js`); `app.search`, `app.collections.has`, `app.platform`, `app.getSettings`, `app.clock`.
- Produces:
  - `installHandsFreeUi(app) → void`. It sets `app.handsFree` at once (with `listener: null`) and replaces it with a freshly wired controller and listener on every **Start** press, so voice settings apply from the next Start.
  - `startHandsFree(app) → Promise<void>`: the Start press routine, also called by the first-run step (Task 10).
  - `SILENT_AUDIO_FALLBACK = false`, exported from `pwa.js` and passed as `createWebMedia(navigator, {silentAudio: SILENT_AUDIO_FALLBACK})`. `pwa.js` also switches `voice` to `createWebVoice(window, {lang: 'en-US'})`.
  - `installFakeSpeech(page, {available = 'available', holdSpeech = false} = {})`, keeping Plan 01's behaviour and adding:
    - the static `SpeechRecognition.available()` resolving `available` (no static when `available` is `null`), and `install()` resolving `true`;
    - a recogniser that fires `start` on `start()` and `end` on `stop()`/`abort()`; `window.__say(text, final = true)`; `window.__voiceError(code)` (fires `error`, then `end`);
    - `window.__spoken` (texts), `window.__speechCancels`, and `window.__endSpeech()`. With `holdSpeech` an utterance ends only on `__endSpeech()` or `cancel()`; otherwise it ends after a microtask. `cancel()` fires `onerror` with `interrupted`;
    - `getVoices()` returning `Local English` (`local-en`, local) and `Online English` (`net-en`, not local), both `en-US`;
    - `window.__wake = {requests, releases}`, `window.__media` (the handlers given to `navigator.mediaSession.setActionHandler`, by action name), and `window.__announcements`: `[regionId, text]` for every text written to `#live-polite` or `#live-assertive`.

Bar contents. `#handsfree` is a `<section aria-label="Hands-free">` outside the routed view, so it is on every screen. Every button is at least 56 px tall.

| Element | Visible text and behaviour |
|---|---|
| Start button | `Start`, shown while idle. Calls `startHandsFree(app)`: probe with `allowCloud: settings.voice.cloudOptIn`, build listener and controller with `getListenMode = () => effectiveListenMode(settings.voice.mode, status)`, `wakeLock.on()`, `media.setActive(true)`, `hf.start()` |
| Turn off button | `Turn off hands-free`, shown when not idle; calls `stop()` |
| Listening indicator `#hf-listening` | `Listening`, `Not listening`, `Hold V to talk` (push mode) or `No voice` (off) |
| Pause/Play | `Pause` while active, `Play` while paused; hidden while idle |
| Stop | text `Stop`, `aria-label="Stop reading"`; calls `command('stop')`. Always visible |
| Mute | `Mute` with `aria-pressed`; calls `setMuted`. Always visible |
| Countdown `#hf-countdown` | `Next find in <n> s`; empty when `countdown(null)` |
| Caption `#hf-caption` | `Heard: <label>` for each voice command, with an 80 ms 660 Hz tone at gain 0.05 from an `AudioContext` made on the Start press |
| Tap to resume | `Tap to resume`, shown when `wake()` returns `false`; calls `wake()` |

Wiring rules:
- `ui.show` navigates to `stumble` first when needed, then calls `showResult`. `ui.act(id)` clicks the first button in `main` whose trimmed text equals the command's label (for `open`, `Open` or `Play`), else announces `No <label> button here`. `ui.recap(shown)` opens a dialog headed `This session` with `You saw <n> finds and saved <m>.` and the saved titles, where saved means `(await app.collections.has(find.id)).length > 0`.
- `ui.openHelp()` opens `<dialog>` headed `What you can say`: one row per `COMMANDS` entry with columns `Say` (the label), `Also` (the other words), `Key` (`Space` for `' '`, `Esc` for `Escape`, else the key in upper case, `—` for none), then the line `Hold V to talk when push to talk is on.` and a `Close` button. It holds `'help'` until closed.
- The keymap dispatches to `app.handsFree.command(id)`, except `search`, which focuses `main input[type="search"]` when there is one, or else opens a dialog with a field labelled `Search for` and a `Search` button that calls `command('search', text)`.
- `hashchange` to any route other than `stumble` calls `hold('view')`; back on `stumble` calls `release('view')`.
- `visibilitychange` to hidden calls `suspend()` when active or paused; to visible calls `wake()`.
- Capture-phase `pointerdown` and `keydown` on `document`, outside `#handsfree`, call `input()`.
- Media handlers: `next` → `command('next')`, `previous` → `command('back')`, `playPause` → `command('pause')`.
- `ui.setState('active')` calls `wakeLock.on()` and `media.setActive(true)`; any other state calls `off()` and `setActive(false)`.
- `stumble.js`: keep the `app` it was rendered with; `showResult` calls `app?.handsFree?.showing(result.find)` after rendering a find; the `open` and `play` actions call `app.handsFree.pause()` when its state is `'active'`; the `read` action calls `app.handsFree.command('read')`.
- `boot.js` imports `handsfree-ui.js` and calls `installHandsFreeUi(app)` after the engine and router start.

- [ ] **Step 1: Write the failing e2e tests**

```js
import { test, expect } from '@playwright/test';
import { mockNet } from './helpers/net.js';
import { installFakeSpeech } from './helpers/fakes.js';

const title = (page) => page.getByRole('main').getByRole('heading', { level: 2 }).first();
const announced = (page, region, text) => page.evaluate(([r, t]) =>
  window.__announcements.filter(([id, x]) => id === r && x === t).length, [region, text]);
async function skipFirstRun(page) {
  const skip = page.getByRole('button', { name: 'Skip' });
  while (await skip.isVisible()) await skip.click();
}
async function start(page, opts) {
  await mockNet(page); await installFakeSpeech(page, opts);
  await page.goto('./#/stumble'); await skipFirstRun(page);
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.locator('#hf-listening')).toHaveText('Listening');
}

test('voice "next" shows a new find and captions it', async ({ page }) => {
  await start(page);
  const t1 = await title(page).textContent();
  await page.evaluate(() => window.__say('next'));
  await expect(title(page)).not.toHaveText(t1);
  await expect(page.locator('#hf-caption')).toHaveText('Heard: Next');
});

test('"search for pixel art" reaches app.search', async ({ page }) => {
  const urls = []; page.on('request', (r) => urls.push(r.url()));
  await start(page);
  await page.evaluate(() => window.__say('search for pixel art'));
  await expect.poll(() => announced(page, 'live-polite', 'Searching for pixel art')).toBe(1);
  await expect.poll(() => urls.some((u) => /pixel(%20|\+| )art/.test(u))).toBe(true);
});

test('Esc stops reading', async ({ page }) => {
  await start(page, { holdSpeech: true });
  await expect.poll(() => page.evaluate(() => window.__spoken.length)).toBe(1);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__speechCancels)).toBeGreaterThan(0);
  await page.evaluate(() => window.__endSpeech());
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__spoken.length)).toBe(1);
});

test('Pause and Play', async ({ page }) => {
  await page.clock.install();
  await start(page);
  const t1 = await title(page).textContent();
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  await page.clock.runFor(60000);
  await expect(title(page)).toHaveText(t1);
  await page.getByRole('button', { name: 'Play' }).click();
  await page.clock.runFor(21000);
  await expect(title(page)).not.toHaveText(t1);
  expect(await announced(page, 'live-polite', 'Lean-back paused')).toBe(1);
  expect(await announced(page, 'live-polite', 'Lean-back on')).toBe(1);
});

test('the countdown announcement is made once per find', async ({ page }) => {
  await page.clock.install();
  await start(page);
  await page.clock.runFor(15000);
  expect(await announced(page, 'live-polite', 'Next find in 10 seconds')).toBe(1);
  await page.keyboard.press('x');
  await page.clock.runFor(15000);
  expect(await announced(page, 'live-polite', 'Next find in 10 seconds')).toBe(1);
  await expect(page.locator('#hf-countdown')).toHaveText('Next find in 5 s');
});

test('headset next track shows a new find', async ({ page }) => {
  await start(page);
  const t1 = await title(page).textContent();
  await page.evaluate(() => window.__media.nexttrack());
  await expect(title(page)).not.toHaveText(t1);
});

test('a blocked mic is announced assertively', async ({ page }) => {
  await start(page);
  await page.evaluate(() => window.__voiceError('not-allowed'));
  await expect(page.locator('#live-assertive')).toHaveText('Microphone blocked');
  await expect(page.locator('#hf-listening')).toHaveText('Not listening');
});

test('Start takes a wake lock; hiding the page stops the mic', async ({ page }) => {
  await start(page);
  expect(await page.evaluate(() => window.__wake.requests)).toBeGreaterThan(0);
  const setVis = (v) => page.evaluate((v) => {
    Object.defineProperty(document, 'visibilityState', { value: v, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }, v);
  await setVis('hidden');
  await expect(page.locator('#hf-listening')).toHaveText('Not listening');
  await setVis('visible');
  await expect(page.locator('#hf-listening')).toHaveText('Listening');
});

test('Stop and Mute are on every screen', async ({ page }) => {
  await mockNet(page); await installFakeSpeech(page);
  await page.goto('./#/stumble'); await skipFirstRun(page);
  for (const r of ['stumble', 'feed', 'saved', 'settings']) {
    await page.goto(`./#/${r}`);
    await expect(page.getByRole('button', { name: 'Stop reading' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mute' })).toBeVisible();
  }
});

test('? opens the help card with every on-screen label', async ({ page }) => {
  await start(page);
  await page.keyboard.press('?');
  const help = page.getByRole('dialog', { name: 'What you can say' });
  await expect(help).toBeVisible();
  for (const label of ['Next', 'Back', 'Like', 'Not for me', 'Save', 'Share', 'Open', 'More like this', 'Read it',
    'Pause', 'Play', 'Stop', 'Stop listening', 'Search', 'Surprise me', 'Daily Fate', 'Help'])
    await expect(help.getByRole('cell', { name: label, exact: true }).first()).toBeVisible();
  await help.getByRole('button', { name: 'Close' }).click();
  await expect(help).toBeHidden();
});

test('/ opens search when the page has no search field', async ({ page }) => {
  await start(page);
  await page.keyboard.press('/');
  await page.getByLabel('Search for').fill('maps');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect.poll(() => announced(page, 'live-polite', 'Searching for maps')).toBe(1);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node tools/build.js --target pwa && npx playwright test -c tests/e2e/playwright.config.js tests/e2e/handsfree.spec.js`
Expected: FAIL. Each test times out waiting for `getByRole('button', { name: 'Start' })` (or `Stop reading`).

- [ ] **Step 3: Implement the fakes, `handsfree-ui.js` and the four modifications**

Build every node with `h()`; all text goes through `textContent`. Add `#handsfree` styles to `app.css`: a sticky bar, 56 px minimum button height, a visible `:focus-visible` ring, and no animation when `html[data-motion="reduce"]`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node tools/build.js --target pwa && npx playwright test -c tests/e2e/playwright.config.js tests/e2e/handsfree.spec.js`
Expected: PASS, 11 tests. Then run `npm test`; expected: PASS, with `--check` finding no forbidden APIs.

- [ ] **Step 5: Commit**

```bash
git add src/ui/handsfree-ui.js src/ui/boot.js src/platform/pwa.js src/ui/views/stumble.js src/ui/styles/app.css tests/e2e/helpers/fakes.js tests/e2e/handsfree.spec.js
git commit -m "Add the hands-free bar, help card and wiring"
```

### Task 10: Voice settings, cloud opt-in and the first-run step

**Files:**
- Create: `src/ui/views/settings/voice.js`
- Modify: `src/ui/handsfree-ui.js`, `src/ui/views/index.js`, `tests/e2e/helpers/fakes.js`
- Test: `tests/e2e/settings-voice.spec.js`

**Interfaces:**
- Consumes: `registerSettingsSection` (`ui/views/settings/index.js`), `registerFirstRunStep` (`ui/firstrun.js`), `startHandsFree(app)` (Task 9), `platform.voice.probe/install`, `platform.tts.voices/speak`, `app.saveSettings(patch)`.
- Produces (all in `handsfree-ui.js`, so `voice.js` imports them without a cycle):
  - `VENDOR_NAMES = {google:'Google', apple:'Apple', microsoft:'Microsoft', mozilla:'Mozilla', android:'Android'}`;
  - `describeEngine(status) → string`, with the copy below;
  - `renderCloudOptIn(container, app, vendor, done(accepted:boolean))`.
  - In `fakes.js`: `window.__utterances`, one `{text, voiceURI, rate, volume}` per `speak`, and `window.__recognizers` (instances constructed) and `window.__recStarts` (calls to `start`).

`describeEngine` copy:

| Status | Text |
|---|---|
| `web-local` | `Voice runs on this device.` |
| `none`, `needsDownload` | `Voice can run on this device after a one-time download.` |
| `web-cloud` | `Voice goes to <Vendor> to be recognised.` |
| `native` | `Voice uses this phone's speech recognition.` |
| `none`, vendor set | `Voice on this browser goes to <Vendor>. It stays off unless you turn on cloud voice.` |
| `none`, no vendor | `No voice on this browser. Keys, touch and headset buttons still work.` |

The opt-in screen: heading `Use <Vendor> cloud voice?`; text `On this browser, voice commands are sent to <Vendor> to be turned into text. Byways never stores your audio. You can turn this off at any time in Settings, Voice.`; buttons `Turn on cloud voice` (saves `voice.cloudOptIn: true`, then `done(true)`) and `Not now` (`done(false)`).

The Voice section (`id:'voice'`, `label:'Voice'`, `order:30`), top to bottom:
- `#voice-engine`: `describeEngine(await platform.voice.probe({allowCloud}))`.
- `Download offline voice`, only when `needsDownload`. Its click calls `platform.voice.install()`, then probes again. When `install()` resolves `false`, it announces `The offline voice could not be downloaded.` assertively.
- `Use <Vendor> cloud voice`, only for `kind:'none'` with a vendor and no opt-in. It shows the opt-in screen in place.
- `Cloud voice (<Vendor>)`, a checkbox, only after opting in. Unchecking saves `cloudOptIn:false`.
- A `Listening` fieldset of radios: `Automatic` (`auto`), `Always on while Byways is open` (`always`), `Push to talk (hold V)` (`push`), `Off` (`off`).
- `Reading voice`, a select: `Automatic (on this device)` (value `''` saves `null`), then each voice name, with ` (online)` appended when it is not local.
- `Speed` (range 0.5–2, step 0.1) and `Volume` (range 0–1, step 0.1).
- `Test voice`, which speaks `This is how Byways sounds.` with the saved voice settings.
- The line `Byways never stores your audio. A microphone grant applies to every page on iteatsthesalt.github.io.`

The first-run step (`id:'handsfree'`, `order:30`): heading `Hands-free`; the text `Byways can read each find aloud, move on by itself and listen for commands such as "next" and "save it". Press Start once each time you open Byways.`; the engine line; `renderCloudOptIn` when the opt-in applies; `Download offline voice` when needed; and a `Start` button that calls `done()` and then `startHandsFree(app)` in the same click.

- [ ] **Step 1: Write the failing e2e tests**

```js
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36';
async function openVoice(page, opts) {
  await mockNet(page); await installFakeSpeech(page, opts);
  await page.goto('./#/stumble'); await skipFirstRun(page);
  await page.goto('./#/settings/voice');
}

test('an on-device browser says so', async ({ page }) => {
  await openVoice(page, { available: 'available' });
  await expect(page.locator('#voice-engine')).toHaveText('Voice runs on this device.');
});

test('Download offline voice calls install from a click', async ({ page }) => {
  await openVoice(page, { available: 'downloadable' });
  await expect(page.locator('#voice-engine')).toHaveText('Voice can run on this device after a one-time download.');
  await page.getByRole('button', { name: 'Download offline voice' }).click();
  await expect(page.locator('#voice-engine')).toHaveText('Voice runs on this device.');
});

test.describe('on a cloud-only browser', () => {
  test.use({ userAgent: ANDROID });

  test('voice stays off until the opt-in that names the vendor', async ({ page }) => {
    await openVoice(page, { available: null });
    await expect(page.locator('#voice-engine')).toHaveText('Voice on this browser goes to Google. It stays off unless you turn on cloud voice.');
    await page.getByRole('button', { name: 'Start' }).click();
    expect(await page.evaluate(() => window.__recognizers)).toBe(0);
    await page.getByRole('button', { name: 'Turn off hands-free' }).click();
    await page.goto('./#/settings/voice');
    await page.getByRole('button', { name: 'Use Google cloud voice' }).click();
    await expect(page.getByRole('heading', { name: 'Use Google cloud voice?' })).toBeVisible();
    await expect(page.getByText('voice commands are sent to Google')).toBeVisible();
    await page.getByRole('button', { name: 'Not now' }).click();
    await expect(page.locator('#voice-engine')).toHaveText('Voice on this browser goes to Google. It stays off unless you turn on cloud voice.');
    await page.getByRole('button', { name: 'Use Google cloud voice' }).click();
    await page.getByRole('button', { name: 'Turn on cloud voice' }).click();
    await expect(page.locator('#voice-engine')).toHaveText('Voice goes to Google to be recognised.');
    await page.reload();
    await expect(page.getByRole('checkbox', { name: 'Cloud voice (Google)' })).toBeChecked();
  });

  test('Automatic means push to talk here', async ({ page }) => {
    await openVoice(page, { available: null });
    await page.getByRole('button', { name: 'Use Google cloud voice' }).click();
    await page.getByRole('button', { name: 'Turn on cloud voice' }).click();
    await page.getByRole('button', { name: 'Start' }).click();
    await expect(page.locator('#hf-listening')).toHaveText('Hold V to talk');
    expect(await page.evaluate(() => window.__recStarts)).toBe(0);
    await page.keyboard.down('v');
    await expect.poll(() => page.evaluate(() => window.__recStarts)).toBe(1);
    await page.keyboard.up('v');
  });
});

test('reading voice, speed and volume are saved and used', async ({ page }) => {
  await openVoice(page);
  await page.getByLabel('Reading voice').selectOption({ label: 'Online English (online)' });
  await page.getByLabel('Speed').fill('1.5');
  await page.getByLabel('Volume').fill('0.5');
  await page.reload();
  await page.getByRole('button', { name: 'Test voice' }).click();
  await expect.poll(() => page.evaluate(() => window.__utterances.at(-1))).toEqual(
    { text: 'This is how Byways sounds.', voiceURI: 'net-en', rate: 1.5, volume: 0.5 });
});

test('the first-run step explains hands-free and its Start starts it', async ({ page }) => {
  await mockNet(page); await installFakeSpeech(page);
  await page.goto('./#/stumble');
  const heading = page.getByRole('heading', { name: 'Hands-free' });
  while (!(await heading.isVisible())) await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page.getByText('Voice runs on this device.')).toBeVisible();
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.locator('#hf-listening')).toHaveText('Listening');
});
```

`skipFirstRun` is the same helper as in Task 9; copy it into this spec.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node tools/build.js --target pwa && npx playwright test -c tests/e2e/playwright.config.js tests/e2e/settings-voice.spec.js`
Expected: FAIL. The first test times out on `#voice-engine`.

- [ ] **Step 3: Implement `voice.js`, the `handsfree-ui.js` additions, the fake counters and the import line in `views/index.js`**

Every control has a visible `<label>`. Each change saves at once with `app.saveSettings({voice: {...}})`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node tools/build.js --target pwa && npx playwright test -c tests/e2e/playwright.config.js tests/e2e/settings-voice.spec.js tests/e2e/handsfree.spec.js`
Expected: PASS, 6 and 11 tests.

- [ ] **Step 5: Commit**

```bash
git add src/ui/views/settings/voice.js src/ui/handsfree-ui.js src/ui/views/index.js tests/e2e/helpers/fakes.js tests/e2e/settings-voice.spec.js
git commit -m "Add voice settings, the cloud opt-in and the hands-free first-run step"
```

### Task 11: Accessibility settings and the vendored font

**Files:**
- Create: `src/ui/views/settings/access.js`
- Create: `src/assets/fonts/atkinson-hyperlegible-latin-400-normal.woff2`, `src/assets/fonts/atkinson-hyperlegible-latin-700-normal.woff2`, `src/assets/fonts/OFL.txt`
- Modify: `package.json`, `package-lock.json`, `src/ui/styles/app.css`, `src/ui/styles/themes.css`, `src/ui/views/index.js`
- Test: `tests/unit/fonts.test.js`, `tests/e2e/settings-access.spec.js`

**Interfaces:**
- Consumes: `registerSettingsSection`, `applyAccessSettings(settings)` (`ui/theme.js`), `clampDwell` (Task 4), `app.saveSettings(patch)`.
- Produces: the settings values `theme: 'contrast'` and `font: 'atkinson'` (besides `'system'`, and Plan 01's `'light'`/`'dark'`), and `motion: 'reduce'|'full'` (besides `'system'`).

The Accessibility section (`id:'access'`, `label:'Accessibility'`, `order:40`). Each change saves and then calls `applyAccessSettings(app.getSettings())`.

| Control | Setting |
|---|---|
| `Text size`, range 100–200 step 10, with an `<output>` showing `<n>%` | `textScale = n / 100` |
| `Theme` select: `Match my device`, `Light`, `Dark`, `High contrast` | `theme`: `system`, `light`, `dark`, `contrast` |
| `Easy-read font (Atkinson Hyperlegible)` checkbox | `font`: `atkinson` or `system` |
| `Motion` select: `Match my device`, `Reduce motion`, `Full motion` | `motion`: `system`, `reduce`, `full` |
| `Screen-reader mode` checkbox, hint `Byways stops reading aloud and sends text to your screen reader instead.` | `screenReaderMode` |
| `Single-key shortcuts` checkbox | `singleKeyShortcuts` |
| Fieldset `Lean-back`: `Seconds on each find` (number, 5–300, saved through `clampDwell` on `change`, the field then shows the clamped value) and `Wait for me` checkbox | `dwellSec`, `dwellWaitForMe` |
| `Session length` select: `Off`, `15 minutes`, `30 minutes`, `45 minutes`, `60 minutes`, `90 minutes` | `sessionLengthMin`: `null`, 15, 30, 45, 60, 90 |
| `Remind me after 45 minutes` checkbox | `exploringCue` |
| `Let AI refill lean-back` checkbox | `leanBackAI` |

CSS: `app.css` gets `@font-face { font-family: 'Atkinson Hyperlegible'; src: url('../../assets/fonts/atkinson-hyperlegible-latin-400-normal.woff2') format('woff2'); font-weight: 400; font-display: swap; }`, the same for 700, and `html[data-font="atkinson"] body { font-family: 'Atkinson Hyperlegible', system-ui, sans-serif; }`. `themes.css` gets an `html[data-theme="contrast"]` block that sets Plan 01's colour custom properties to background `#000000`, text `#ffffff`, links and focus ring `#ffff00`, and borders `#ffffff`.

- [ ] **Step 1: Write the failing tests**

```js
// tests/unit/fonts.test.js
import { readFile } from 'node:fs/promises';
import { sha256Hex } from '../../src/core/util/hash.js';
const FONTS = 'src/assets/fonts/', PKG = 'node_modules/@fontsource/atkinson-hyperlegible/';

test('the font files are the pinned package files', async () => {
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  assert.equal(pkg.devDependencies['@fontsource/atkinson-hyperlegible'], '5.3.0');
  for (const w of ['400', '700']) {
    const name = `atkinson-hyperlegible-latin-${w}-normal.woff2`;
    assert.equal(await sha256Hex(await readFile(FONTS + name)), await sha256Hex(await readFile(PKG + 'files/' + name)));
  }
  assert.equal(await readFile(FONTS + 'OFL.txt', 'utf8'), await readFile(PKG + 'LICENSE', 'utf8'));
  assert.match(await readFile(FONTS + 'OFL.txt', 'utf8'), /SIL Open Font License, Version 1\.1/);
});

test('app.css declares the font with swap', async () => {
  const css = await readFile('src/ui/styles/app.css', 'utf8');
  assert.match(css, /url\('\.\.\/\.\.\/assets\/fonts\/atkinson-hyperlegible-latin-400-normal\.woff2'\) format\('woff2'\)/);
  assert.match(css, /font-display: swap/);
  assert.match(css, /html\[data-font="atkinson"\]/);
});

// tests/e2e/settings-access.spec.js
async function openAccess(page) {
  await mockNet(page); await installFakeSpeech(page);
  await page.goto('./#/stumble'); await skipFirstRun(page);
  await page.goto('./#/settings/access');
}
const html = (page) => page.locator('html');

test('text size, theme, font and motion apply and persist', async ({ page }) => {
  await openAccess(page);
  await page.getByLabel('Text size').fill('150');
  await page.getByLabel('Theme').selectOption({ label: 'High contrast' });
  await page.getByLabel('Easy-read font (Atkinson Hyperlegible)').check();
  await page.getByLabel('Motion').selectOption({ label: 'Reduce motion' });
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.style.getPropertyValue('--text-scale').trim())).toBe('1.5');
  await expect(html(page)).toHaveAttribute('data-theme', 'contrast');
  await expect(html(page)).toHaveAttribute('data-font', 'atkinson');
  await expect(html(page)).toHaveAttribute('data-motion', 'reduce');
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(0, 0, 0)');
  expect(await page.evaluate(async () => (await document.fonts.load('16px "Atkinson Hyperlegible"')).length)).toBeGreaterThan(0);
});

test('the dwell is kept between 5 and 300 seconds', async ({ page }) => {
  await openAccess(page);
  const dwell = page.getByLabel('Seconds on each find');
  await expect(dwell).toHaveValue('20');
  await dwell.fill('3'); await dwell.blur();
  await expect(dwell).toHaveValue('5');
  await dwell.fill('1000'); await dwell.blur();
  await expect(dwell).toHaveValue('300');
  await page.reload();
  await expect(page.getByLabel('Seconds on each find')).toHaveValue('300');
  await expect(page.getByLabel('Let AI refill lean-back')).not.toBeChecked();
});

test('screen-reader mode silences read-aloud and uses the live region', async ({ page }) => {
  await openAccess(page);
  await page.getByLabel('Screen-reader mode').check();
  await page.goto('./#/stumble');
  await page.getByRole('button', { name: 'Start' }).click();
  const t = await page.getByRole('main').getByRole('heading', { level: 2 }).first().textContent();
  await expect.poll(() => page.evaluate((t) =>
    window.__announcements.some(([id, x]) => id === 'live-polite' && x.startsWith(t)), t)).toBe(true);
  expect(await page.evaluate(() => window.__spoken.length)).toBe(0);
});

test('single-key shortcuts can be turned off', async ({ page }) => {
  await openAccess(page);
  await page.getByLabel('Single-key shortcuts').uncheck();
  await page.goto('./#/stumble');
  const title = page.getByRole('main').getByRole('heading', { level: 2 }).first();
  const t1 = await title.textContent();
  await page.keyboard.press('Space');
  await page.waitForTimeout(500);
  await expect(title).toHaveText(t1);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/unit/fonts.test.js`
Expected: FAIL with `undefined !== '5.3.0'` in the first test.

- [ ] **Step 3: Add the package and copy the files**

Run: `npm install --save-dev --save-exact @fontsource/atkinson-hyperlegible@5.3.0`
Then copy the three files:
`cp node_modules/@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-normal.woff2 src/assets/fonts/`
`cp node_modules/@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-700-normal.woff2 src/assets/fonts/`
`cp node_modules/@fontsource/atkinson-hyperlegible/LICENSE src/assets/fonts/OFL.txt`

- [ ] **Step 4: Implement `access.js`, the CSS and the import line in `views/index.js`**

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test tests/unit/fonts.test.js`
Expected: PASS, 2 tests.
Run: `node tools/build.js --target pwa && npx playwright test -c tests/e2e/playwright.config.js tests/e2e/settings-access.spec.js`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/assets/fonts src/ui/views/settings/access.js src/ui/styles/app.css src/ui/styles/themes.css src/ui/views/index.js tests/unit/fonts.test.js tests/e2e/settings-access.spec.js
git commit -m "Add accessibility settings and the Atkinson Hyperlegible font"
```

### Task 12: axe checks on every view

**Files:**
- Modify: `package.json`, `package-lock.json`
- Create: `tests/e2e/axe.spec.js`
- Modify, only if axe flags them: the view or style file that renders each flagged node (from Plans 01–03)

**Interfaces:**
- Consumes: `mockNet`, `installFakeSpeech`; the routes and settings sections registered so far; `AxeBuilder` from `@axe-core/playwright`.
- Produces: `tests/e2e/axe.spec.js`, with a `VIEWS` array at the top. Plans 04–06 append their routes (`#/daily`, `#/vault`, the Lab page) to it.

- [ ] **Step 1: Write the failing test**

```js
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockNet } from './helpers/net.js';
import { installFakeSpeech } from './helpers/fakes.js';

const VIEWS = ['#/stumble', '#/feed', '#/saved', '#/settings'];

async function serious(page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}
async function ready(page) {
  await mockNet(page); await installFakeSpeech(page);
  await page.goto('./#/stumble');
}

test('every first-run step', async ({ page }) => {
  await ready(page);
  const skip = page.getByRole('button', { name: 'Skip' });
  while (await skip.isVisible()) { expect(await serious(page)).toEqual([]); await skip.click(); }
});

test('every view and settings section', async ({ page }) => {
  await ready(page);
  const skip = page.getByRole('button', { name: 'Skip' });
  while (await skip.isVisible()) await skip.click();
  await page.goto('./#/settings');
  const sections = await page.locator('a[href^="#/settings/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  expect(sections).toEqual(expect.arrayContaining(['#/settings/voice', '#/settings/access']));
  for (const hash of [...VIEWS, ...sections]) {
    await page.goto('./' + hash);
    await page.waitForLoadState('networkidle');
    expect(await serious(page), hash).toEqual([]);
  }
});

test('hands-free running, the help card and the high-contrast theme', async ({ page }) => {
  await ready(page);
  const skip = page.getByRole('button', { name: 'Skip' });
  while (await skip.isVisible()) await skip.click();
  await page.getByRole('button', { name: 'Start' }).click();
  expect(await serious(page)).toEqual([]);
  await page.keyboard.press('?');
  expect(await serious(page)).toEqual([]);
  await page.getByRole('button', { name: 'Close' }).click();
  await page.goto('./#/settings/access');
  await page.getByLabel('Theme').selectOption({ label: 'High contrast' });
  await page.goto('./#/stumble');
  expect(await serious(page)).toEqual([]);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx playwright test -c tests/e2e/playwright.config.js tests/e2e/axe.spec.js`
Expected: FAIL with `Cannot find package '@axe-core/playwright'`.

- [ ] **Step 3: Add the package**

Run: `npm install --save-dev --save-exact @axe-core/playwright@4.14.0`

- [ ] **Step 4: Run it and fix what it finds**

Run: `node tools/build.js --target pwa && npx playwright test -c tests/e2e/playwright.config.js tests/e2e/axe.spec.js`
Expected: PASS, 3 tests. If a test lists violations, fix each one in the file that renders the named node (a missing label, low contrast, a duplicate id, a button under 44 px) and run again. Never disable an axe rule.

- [ ] **Step 5: Run the whole suite**

Run: `npm test` and then `npm run e2e`
Expected: PASS for both, with no unmocked requests reported.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tests/e2e/axe.spec.js
git commit -m "Check every view with axe"
```

Before committing, also `git add` each file you changed in Step 4, by its exact path.

---

## Notes for later plans

- Plan 04: the Vault's **Play** (an embed) and the play watchdog call `app.handsFree.pause()` when its state is `'active'`, so lean-back resumes only on an explicit resume (§6.5).
- `voice/grammar.js`, `voice/listener.js`, `voice/reader.js` and `handsfree.js` take the engine, TTS and clock as parameters. The extension and Android plans supply their own `VoiceEngine` and `Tts`, map native error codes onto `VoiceErrorCode`, and reuse `installHandsFreeUi` unchanged.
- `effectiveListenMode` already treats `{kind:'native', continuous:true}` as always-on, and `describeEngine` already has the `native` line.
- `platform-shells.md`: Android WebView has no `speechSynthesis` and no Media Session, so Plan 08 must bridge native TTS and a native media session; the WebView mic grant is limited to `RESOURCE_AUDIO_CAPTURE` on the app's own origin.
