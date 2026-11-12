# Byways 01: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Byways scaffold: core utilities, storage, the network layer, the web platform, the app shell with its registries, the build, check and serve tools, the test harness, and the Pages and CI workflows, ending in a deployable empty web app.

**Architecture:** Plain ES modules with no bundler. `src/core/**` holds DOM-free code tested with `node:test`. `src/ui/**` and `src/platform/**` hold the browser side, tested with Playwright against the built `dist/pwa/` served under `/Game-Dev-Resources/byways/`. `tools/build.js` copies `src/` and `shells/pwa/` into `dist/pwa/`, stamps the build id into `sw.js`, and writes the precache list. Later plans add screens only through the router, settings and first-run registries.

**Tech Stack:** Node 22, npm 10, `node:test`, `@playwright/test@1.63.0` (Chromium build 1243), `@axe-core/playwright@4.14.0`, `fake-indexeddb@6.2.8`, GitHub Actions, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-11-11-byways-design.md` (§1, §6.7, §13.1, §13.2, §14.1, §15.2, §16, §17.1, §17.2, §17.5, §18). **Contract:** `docs/superpowers/plans/2026-11-11-byways-00-overview.md`. Research: `byways-research/platform-shells.md`, `claude-browser.md`, `hands-free.md`.

## Global Constraints

- Everything in the overview's "Working conventions" and "Global constraints" applies. These bite this plan most:
- Web app CSP, verbatim in every app page's `<meta http-equiv="Content-Security-Policy">`: `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https: data: blob:; media-src 'self' https: blob:; frame-src https://archive.org https://*.archive.org; connect-src 'self' https: http://localhost:* http://127.0.0.1:*; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'`.
- Because `style-src 'self'` blocks inline styles, no HTML has a `style` attribute or `<style>` block, and no code sets the `style` attribute. CSS custom properties are set through `element.style.setProperty`, which CSP allows.
- "It is served at `/Game-Dev-Resources/byways/`, with relative URLs only." "`sw.js` and `manifest.webmanifest` sit in that folder, with `scope` and `start_url` set to `./`."
- "The service worker cache is versioned by the commit SHA, and an "Update available, reload" toast appears when a new version is ready." Cached: "the app shell (under 2 MB); data files (stale-while-revalidate)". "Archive thumbnails: not cached".
- "Text from outside is always rendered with `textContent`." "Links must be `http(s)` only." "Byways never uses `innerHTML`."
- "Targets: buttons are 56 px by default (never below 44 px), with a visible focus ring."
- "Live regions: one polite region (`role=status`) for "Now showing", "Saved" and "Listening paused". One assertive region for errors only."
- "Motion: respects reduced motion, with an in-app motion toggle that overrides the OS. Nothing flashes."
- "Every view is checked with axe-core in end-to-end tests. Any serious or critical issue fails the build."
- Store names: `settings, taste, collections, history, seen, cache, aiCache, usage, health, keys` in one IndexedDB database, `byways`.
- Requests never set `credentials: 'include'`. No test touches the real network: every non-`localhost:4321` request in e2e goes through `mockNet`.
- The `test` script globs `"tests/unit/**/*.test.js"`, because `node --test tests/unit/` fails on Node 22.23 with "Cannot find module …/tests/unit".
- **Contract note:** the overview's working conventions place the forbidden-API check in "Plan 01, Task 2". In this plan it is `tools/check.js` (Task 8), run by `--check` (Task 9).
- "`--check` fails if a build output is stale." Once `dist/` exists, run `npm run build` after a source change and before `npm test`.
- "The router renders each view's `title` as the page's `<h1>`" (Task 13). A view never renders an `h1` of its own.
- App code reports recoverable problems with `console.warn`, never `console.error`: the e2e `test` fixture fails a test on any console error or page error (Task 10).
- Commands run from `Apps/Byways/`, which Task 1 creates. Keep every command under 500 characters with at most 10 statement separators.

## Review Focus

1. **A source hands back a `javascript:`, `data:` or `vbscript:` link.** `h('a', {href})` must drop it and never put it in the DOM. Pinned by `dom.spec.js` "h drops unsafe link schemes" (Task 11).
2. **IndexedDB is blocked or throws** (private windows, locked-down profiles). The app must still boot on a memory store and say so in the assertive region. Pinned by `shell.spec.js` "boots on a memory store when IndexedDB is blocked" (Task 13).
3. **A second visit with no network, or a browser that refuses service workers.** The shell must load offline after one online visit, and a `register()` that rejects or resolves to nothing must not stop boot. Pinned by `sw.spec.js` "reloads offline from the cache" (Task 15) and `pwa.test.js` "registerServiceWorker returns null when register rejects or resolves to nothing" (Task 7).
4. **A hand-edited or garbled hash, such as `#/daily/%E0%A4%A`, `#/nope` or `#s=`.** The router must not throw, and unknown routes go to Stumble. Pinned by `router.test.js` "parseHash never throws on malformed input" (Task 12).
5. **Stored settings from an older or broken build** (wrong types, `null` objects, out-of-range numbers). `loadSettings` must fall back per field and clamp ranges. Pinned by `settings.test.js` "loadSettings repairs bad stored values" (Task 6).

---

## File Structure

All paths are under `Apps/Byways/` unless they start with `.github/`.

| File | Responsibility |
|---|---|
| `package.json`, `package-lock.json`, `.gitignore`, `LICENSE`, `README.md` | Scaffold, pinned devDependencies, npm scripts |
| `src/core/types.js`, `src/core/version.js` | JSDoc typedefs from the overview, plus `Settings` and `App`; `APP_VERSION` |
| `src/core/util/hash.js`, `url.js`, `text.js`, `clock.js` | Pure helpers |
| `src/core/store/db.js`, `store/cache.js` | Store over IndexedDB or memory; TTL cache |
| `src/core/settings.js` | Defaults, load with repair, save |
| `src/core/net/errors.js`, `ratelimit.js`, `http.js` | `NetError`, limiter, HTTP client with retry and circuit |
| `src/platform/web-tts.js`, `web-media.js`, `web-voice.js`, `pwa.js` | Web `Platform` pieces and SW registration |
| `src/ui/dom.js`, `a11y.js`, `theme.js`, `toast.js` | DOM builder, live regions, access attributes, toasts |
| `src/ui/router.js`, `views/index.js`, `views/settings/index.js`, `views/settings/about.js`, `firstrun.js`, `boot.js` | Routing and registries, the About section, startup |
| `src/ui/styles/app.css`, `styles/themes.css` | Layout, 56 px targets, focus ring, theme tokens, reduced motion |
| `src/data/tags.json`, `library.json`, `vault-starter.json`, `geocities-seeds.json` | Empty, valid data files; Plans 02 and 04 fill them |
| `src/assets/icons/icon.svg`, `icon-192.png`, `icon-512.png`, `maskable-512.png` | App icons; `tools/icons.js` renders the PNGs, which are committed |
| `shells/pwa/index.html`, `manifest.webmanifest`, `sw.js`, `landing/index.html` | PWA shell and the Pages-root landing page |
| `tools/build.js`, `tools/check.js`, `tools/serve.js`, `tools/icons.js` | Build targets, rule checks, static server, icon renderer |
| `tests/unit/*.test.js`, `tests/unit/helpers/fake-dom.js`, `tests/unit/helpers/async.js` | Unit tests and their fakes |
| `tests/e2e/playwright.config.js`, `helpers/net.js`, `helpers/app.js`, `helpers/fakes.js`, `helpers/axe.js`, `*.spec.js` | E2E harness and specs |
| `tests/fixtures/routes.js`, `tests/fixtures/http/ping.json` | Network fixtures |
| `.github/workflows/byways.yml`, `.github/workflows/pages.yml` | CI and Pages deploy |

The e2e helpers are the overview's "one set of e2e helpers": `net.js`, `fakes.js` and `axe.js` (Task 10), and `app.js` (Task 13). Later plans import them and define no copies.

**Import-time rule:** no module in `src/ui/` or `src/platform/` touches `window` or `document` at import time, so Node unit tests can import them. Only `bootFromShell()` runs on load, and only when `document.documentElement.dataset.shell` is set.

---

### Task 1: Scaffold, shared types, version and hashing

**Files:**
- Create: `package.json`, `package-lock.json` (from `npm install`), `.gitignore`, `LICENSE`, `README.md`
- Create: `src/core/types.js`, `src/core/version.js`, `src/core/util/hash.js`
- Test: `tests/unit/hash.test.js`, `tests/unit/version.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `fnv1a32(str) → number`, `mulberry32(seed) → () => number`, `hash64(str) → string`, `sha256Hex(data) → Promise<string>`, `gumbel(rand) → number`; `APP_VERSION = '0.1.0'` in `version.js`; the typedefs `Find, FindKind, Safety, Reaction, Taste, Mode, Platform, SecretStore, VoiceStatus, VoiceErrorCode, VoiceEngine, Tts, Settings, App` in `types.js`.

- [ ] **Step 1: Write the scaffold files**

From the repo root, run `mkdir -p Apps/Byways && cd Apps/Byways`. Every later command runs there.

`package.json` (run `npm install` afterwards to make the lockfile):

```json
{
  "name": "byways", "version": "0.1.0", "private": true, "type": "module", "license": "MIT",
  "engines": { "node": ">=22" },
  "scripts": {
    "build": "node tools/build.js --target all",
    "check": "node tools/build.js --check",
    "test": "node tools/build.js --check && node --test \"tests/unit/**/*.test.js\"",
    "e2e": "node tools/build.js --target all && playwright test -c tests/e2e/playwright.config.js"
  },
  "devDependencies": { "@axe-core/playwright": "4.14.0", "@playwright/test": "1.63.0", "fake-indexeddb": "6.2.8" }
}
```

The `vendor`, `data`, `probe` and `linkcheck` scripts are added by the plans that create those tools. `.gitignore` lines: `node_modules/`, `dist/`, `vendor/`, `shells/android/app/src/main/assets/www/`, `shells/android/app/src/main/assets/lab/`. `LICENSE`: the standard MIT text with `Copyright (c) 2026 iteatsthesalt`. `README.md`: a title line `# Byways`, the §1 first paragraph, and the line "Full instructions arrive with the first release."

`src/core/types.js`: the overview's "Shared types" typedef blocks copied exactly, plus `/** @typedef {typeof import('./settings.js').DEFAULT_SETTINGS} Settings */`, an `App` typedef with the Plan 01 fields (`store, settings, getSettings, saveSettings, http, clock, rand, platform, data, dataUrl`; later plans add theirs), and `export {};`.

- [ ] **Step 2: Write the failing tests** in `tests/unit/hash.test.js` and `tests/unit/version.test.js`

```js
test('fnv1a32 matches FNV-1a vectors over UTF-8', () => {
  assert.equal(fnv1a32(''), 0x811c9dc5);
  assert.equal(fnv1a32('a'), 0xe40c292c);
  assert.equal(fnv1a32('foobar'), 0xbf9cf968);
  assert.equal(fnv1a32('é'), 0x1e9de8c1);
  assert.equal(fnv1a32('byways-daily-2026-11-11'), 3348453531);
});
test('hash64 is 16 hex chars of FNV-1a 64', () => {
  assert.equal(hash64(''), 'cbf29ce484222325');
  assert.equal(hash64('a'), 'af63dc4c8601ec8c');
  assert.equal(hash64('foobar'), '85944171f73967e8');
  assert.equal(hash64('é'), '0ac21707b7181e01');
});
test('mulberry32 is deterministic and in [0,1)', () => {
  const r = mulberry32(1);
  assert.deepEqual([r(), r(), r()], [0.6270739405881613, 0.002735721180215478, 0.5274470399599522]);
  assert.equal(mulberry32(0)(), 0.26642920868471265);
});
test('sha256Hex accepts strings and bytes', async () => {
  assert.equal(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(await sha256Hex(new Uint8Array()), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
});
test('gumbel is -log(-log(u)) and stays finite at the edges', () => {
  assert.ok(Math.abs(gumbel(() => Math.exp(-1))) < 1e-12);
  assert.equal(gumbel(() => 0.5).toFixed(6), '0.366513');
  assert.ok(Number.isFinite(gumbel(() => 0)));
  assert.ok(Number.isFinite(gumbel(() => 1 - Number.EPSILON / 2)));
});
```

`gumbel(() => Math.exp(-1))` is `-0`, and `assert.equal` (strict) tells `-0` from `0`, so the test compares the size instead.

`tests/unit/version.test.js` (with `readFileSync` from `node:fs`):

```js
test('APP_VERSION matches package.json', () => {
  assert.equal(APP_VERSION, JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version);
});
```

Every unit test file starts with `import test from 'node:test'; import assert from 'node:assert/strict';` and imports from `../../src/…`.

- [ ] **Step 3: Run them and see them fail**

Run: `node --test tests/unit/hash.test.js tests/unit/version.test.js`
Expected: FAIL with `Cannot find module` for `src/core/util/hash.js` and `src/core/version.js`.

- [ ] **Step 4: Implement `src/core/util/hash.js` and `src/core/version.js`**

`fnv1a32` and `hash64` loop over `new TextEncoder().encode(str)` with the overview's offset bases and primes (`Math.imul(h, 0x01000193) >>> 0` for 32-bit; BigInt masked to 64 bits, `padStart(16,'0')`). `sha256Hex` uses `crypto.subtle.digest('SHA-256', …)`. `gumbel(rand)` is `-Math.log(-Math.log(u))` with `u = rand()` clamped to `[1e-12, 1 - 1e-12]`. `mulberry32` is the standard mulberry32; the Step 2 vectors pin it. `version.js` is the one line `export const APP_VERSION = '0.1.0';`, edited by hand at a version bump.

- [ ] **Step 5: Run them and see them pass**

Run: `node --test tests/unit/hash.test.js tests/unit/version.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .gitignore LICENSE README.md src/core/types.js src/core/version.js src/core/util/hash.js tests/unit/hash.test.js tests/unit/version.test.js
git commit -m "Add the Byways scaffold, shared types, version and hashing"
```

### Task 2: URL and text helpers

**Files:**
- Create: `src/core/util/url.js`, `src/core/util/text.js`
- Test: `tests/unit/url.test.js`, `tests/unit/text.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `normalizeUrl(u) → string|null`, `domainOf(u) → string`, `isHttpUrl(u) → boolean`, `siteOrigin(u) → string`, `toPlainText(html) → string`, `firstSentence(text) → string`, `truncate(text, max) → string`, `tokenize(text) → string[]`, and `STOP_WORDS: Set<string>` (exported from `text.js` for Plan 02's TF-IDF).

- [ ] **Step 1: Write the failing tests**

`tests/unit/url.test.js`:

```js
test('normalizeUrl applies the §14.1 rule', () => {
  assert.equal(normalizeUrl('HTTPS://WWW.Example.COM:443/a/?utm_source=x&b=2&a=1#frag'), 'https://example.com/a?a=1&b=2');
  assert.equal(normalizeUrl('http://example.com:80/'), 'http://example.com/');
  assert.equal(normalizeUrl('https://example.com'), 'https://example.com/');
  assert.equal(normalizeUrl('https://example.com/path/'), 'https://example.com/path');
  assert.equal(normalizeUrl('https://example.com/?fbclid=1&gclid=2&ref=3&utm_medium=4'), 'https://example.com/');
  assert.equal(normalizeUrl('https://example.com:8080/AbC'), 'https://example.com:8080/AbC');
  assert.equal(normalizeUrl('https://www2.example.com/'), 'https://www2.example.com/');
  assert.equal(normalizeUrl('https://example.com/?b=2&a=1&a=0'), 'https://example.com/?a=1&a=0&b=2');
});
test('normalizeUrl returns null for anything that is not http(s)', () => {
  for (const u of ['ftp://x.org/', 'javascript:alert(1)', 'data:text/html,hi', 'not a url', '', null, undefined, 42])
    assert.equal(normalizeUrl(u), null);
});
test('domainOf, isHttpUrl and siteOrigin', () => {
  assert.equal(domainOf('https://www.Example.com/x'), 'example.com');
  assert.equal(domainOf('nope'), '');
  assert.equal(isHttpUrl('HTTP://a.b/'), true);
  assert.equal(isHttpUrl('javascript:alert(1)'), false);
  assert.equal(isHttpUrl('/relative'), false);
  assert.equal(siteOrigin('https://www.example.com/a?b=1'), 'https://www.example.com');
  assert.equal(siteOrigin('mailto:x@y.z'), '');
});
```

The root keeps its slash; a path's trailing slash is dropped. A path of `/` with only dropped parameters becomes `https://example.com/`.

`tests/unit/text.test.js`:

```js
test('toPlainText strips tags and decodes entities without DOMParser', () => {
  assert.equal(toPlainText('<p>Fish &amp; <b>chips</b></p>'), 'Fish & chips');
  assert.equal(toPlainText('&lt;b&gt; &quot;q&quot; &#39;s&#x27; &#8364;&nbsp;x'), '<b> "q" \'s\' € x');
  assert.equal(toPlainText('<script>alert(1)</script><style>p{}</style>ok'), 'ok');
  assert.equal(toPlainText('a<br>b<p>c</p>'), 'a b c');
  assert.equal(toPlainText('un<b>believ</b>able'), 'unbelievable');
  assert.equal(toPlainText('&#x110000; &#0; &#xZZ;'), '� � &#xZZ;');
  assert.equal(toPlainText(null), '');
});
test('firstSentence', () => {
  assert.equal(firstSentence('Hello world. Second one.'), 'Hello world.');
  assert.equal(firstSentence('What? Yes.'), 'What?');
  assert.equal(firstSentence('No stop here'), 'No stop here');
  assert.equal(firstSentence(''), '');
});
test('truncate counts code points and never splits a surrogate pair', () => {
  assert.equal(truncate('hello world again', 12), 'hello world…');
  assert.equal(truncate('abc', 3), 'abc');
  assert.equal(truncate('😀😀😀', 2), '😀…');
  assert.equal([...truncate('x'.repeat(500), 200)].length, 200);
});
test('tokenize keeps lowercase letter words of 3+ and drops stop words', () => {
  assert.deepEqual(tokenize('The Quick brown fox, and the lazy DOG! 1994 an'), ['quick', 'brown', 'fox', 'lazy', 'dog']);
  assert.deepEqual(tokenize('Café crème'), ['café', 'crème']);
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `node --test tests/unit/url.test.js tests/unit/text.test.js`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 3: Implement `src/core/util/url.js`**

Parse with `new URL(String(u).trim())` inside try/catch and keep only `http:`/`https:` (`URL` lower-cases and clears default ports). Strip a leading `www.`, drop the hash, delete params named `utm_*`, `fbclid`, `gclid` or `ref`, call `searchParams.sort()`, and drop one trailing `/` unless the path is `/`.

- [ ] **Step 4: Implement `src/core/util/text.js`**

`toPlainText`: when `globalThis.DOMParser` exists, parse with `parseFromString(html, 'text/html')`, remove every `script`, `style` and `template` element, insert a space text node before each `br` and before and after each `p`, `div`, `li`, `tr` and `h1`–`h6`, and return the collapsed, trimmed `body.textContent`. Without the spaces, `textContent` runs blocks together (`'<p>One.</p><p>Two.</p>'` gives `'One.Two.'`, and `firstSentence` then reads both). Both branches must give the same text; Task 10's `basics.spec.js` checks the DOMParser branch in Chromium. Otherwise remove `<script>…</script>` and `<style>…</style>` blocks, replace `br`, `p`, `div`, `li`, `tr` and `h1`–`h6` tags with a space, remove other tags, decode the named entities `&amp; &lt; &gt; &quot; &#39; &nbsp;` and numeric entities (code point 0, surrogates or above `0x10FFFF` become `�`; unparseable ones stay as written), then collapse whitespace and trim. `firstSentence`: text up to the first `.`, `!` or `?` that is followed by whitespace or the end. `truncate`: work on `Array.from(text)`; when longer than `max`, keep `max - 1` code points, `trimEnd()`, and add `…`. `tokenize`: `text.toLowerCase().match(/\p{L}+/gu)`, keep length ≥ 3, drop `STOP_WORDS`. `STOP_WORDS` is exactly:

`the and for are but not you all any can had her his was one our out has have this that with from they will would there their what about which when your into than then them these those were been also its who how why more some such only over very just`

- [ ] **Step 5: Run them and see them pass**

Run: `node --test tests/unit/url.test.js tests/unit/text.test.js`
Expected: PASS, 7 tests.

- [ ] **Step 6: Commit**

```bash
git add src/core/util/url.js src/core/util/text.js tests/unit/url.test.js tests/unit/text.test.js
git commit -m "Add URL normalisation and plain-text helpers"
```

### Task 3: Clock, errors and the rate limiter

**Files:**
- Create: `src/core/util/clock.js`, `src/core/net/errors.js`, `src/core/net/ratelimit.js`
- Create: `tests/unit/helpers/async.js`: `flush() → Promise<void>` (resolves on `setImmediate`, after pending microtasks) and `deferred() → {promise, resolve, reject}`
- Test: `tests/unit/clock.test.js`, `tests/unit/ratelimit.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `realClock`, `fakeClock(start=0) → {now, setTimeout, clearTimeout, advance(ms)}`, `utcDate(ms)`, `nextUtcMidnight(ms)`; `class NetError extends Error`, built as `new NetError(kind, message = kind, {status, retryAfterMs, source} = {})` or from one object, `new NetError({kind, message, status, retryAfterMs, source})` (Plan 04 uses that form); `createLimiter({perMinute, concurrent, clock}) → {schedule(fn) → Promise, pauseFor(ms)}`; `parseRetryAfter(value, nowMs) → number|null`; `flush` and `deferred` for unit tests.

- [ ] **Step 1: Write the failing tests**

Write `tests/unit/helpers/async.js` first (the two helpers under **Files**), then `tests/unit/clock.test.js`:

```js
test('fakeClock runs due timers in order and sets now', () => {
  const c = fakeClock(1000); const log = [];
  c.setTimeout(() => log.push('b'), 20);
  c.setTimeout(() => { log.push('a'); c.setTimeout(() => log.push('a2'), 2); }, 10);
  const x = c.setTimeout(() => log.push('x'), 5); c.clearTimeout(x);
  c.advance(15);
  assert.deepEqual(log, ['a', 'a2']); assert.equal(c.now(), 1015);
  c.advance(5); assert.deepEqual(log, ['a', 'a2', 'b']);
});
test('utcDate and nextUtcMidnight', () => {
  assert.equal(utcDate(Date.UTC(2026, 10, 11, 23, 59)), '2026-11-11');
  assert.equal(nextUtcMidnight(Date.UTC(2026, 10, 11, 23, 59)), Date.UTC(2026, 10, 12));
  assert.equal(nextUtcMidnight(Date.UTC(2026, 10, 12)), Date.UTC(2026, 10, 13));
});
test('NetError carries kind, status and source in either form', () => {
  const e = new NetError('http', 'HTTP 503', { status: 503, retryAfterMs: 2000, source: 'wikipedia' });
  assert.ok(e instanceof Error); assert.equal(e.name, 'NetError');
  assert.deepEqual([e.kind, e.message, e.status, e.retryAfterMs, e.source], ['http', 'HTTP 503', 503, 2000, 'wikipedia']);
  const o = new NetError({ kind: 'circuit', source: 'ia' });
  assert.deepEqual([o.kind, o.message, o.status, o.source], ['circuit', 'circuit', undefined, 'ia']);
});
```

`tests/unit/ratelimit.test.js` (imports `flush` and `deferred` from `./helpers/async.js`):

```js
test('runs at most `concurrent` at once', async () => {
  const c = fakeClock(0); const lim = createLimiter({ perMinute: 100, concurrent: 2, clock: c });
  const d = [deferred(), deferred(), deferred()]; let started = 0;
  d.forEach(x => lim.schedule(() => { started++; return x.promise; }));
  await flush(); assert.equal(started, 2);
  d[0].resolve(); await flush(); assert.equal(started, 3);
});
test('keeps to perMinute over a sliding 60 s window', async () => {
  const c = fakeClock(0); const lim = createLimiter({ perMinute: 2, concurrent: 5, clock: c }); let done = 0;
  for (let i = 0; i < 3; i++) lim.schedule(async () => { done++; });
  await flush(); assert.equal(done, 2);
  c.advance(59999); await flush(); assert.equal(done, 2);
  c.advance(1); await flush(); assert.equal(done, 3);
});
test('pauseFor holds new starts', async () => {
  const c = fakeClock(0); const lim = createLimiter({ perMinute: 60, concurrent: 1, clock: c }); let done = 0;
  lim.pauseFor(5000); lim.schedule(async () => { done++; });
  await flush(); assert.equal(done, 0);
  c.advance(5000); await flush(); assert.equal(done, 1);
});
test('a rejection reaches the caller and frees the slot', async () => {
  const c = fakeClock(0); const lim = createLimiter({ perMinute: 60, concurrent: 1, clock: c });
  await assert.rejects(lim.schedule(async () => { throw new Error('boom'); }), /boom/);
  assert.equal(await lim.schedule(async () => 7), 7);
});
test('parseRetryAfter reads seconds and HTTP dates', () => {
  const now = Date.UTC(2026, 10, 11);
  assert.equal(parseRetryAfter('120', now), 120000);
  assert.equal(parseRetryAfter('0', now), 0);
  assert.equal(parseRetryAfter('Wed, 11 Nov 2026 00:00:10 GMT', now), 10000);
  assert.equal(parseRetryAfter('Tue, 10 Nov 2026 00:00:00 GMT', now), 0);
  for (const v of ['soon', '-5', '1.5', '', null, undefined]) assert.equal(parseRetryAfter(v, now), null);
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `node --test tests/unit/clock.test.js tests/unit/ratelimit.test.js`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 3: Implement the three modules**

`fakeClock`: `advance(ms)` runs every timer due by `now + ms`, earliest first (ties in the order they were set), including timers those callbacks add, and sets `now` to each timer's due time before calling it; then `now = now + ms`. `realClock` wraps `Date.now` and the global timers. `utcDate` is `new Date(ms).toISOString().slice(0, 10)`. `NetError` sets `name = 'NetError'`; when its first argument is an object, it reads `kind`, `message` and the other fields from it.

`createLimiter`: a FIFO queue, a `running` count, a list of start times, and `pausedUntil`. `pump()` starts tasks while `running < concurrent`, `now ≥ pausedUntil`, and fewer than `perMinute` starts fall in `(now − 60000, now]`. If the queue is still not empty, it sets one timer (via `clock.setTimeout`) for the earliest moment a slot frees: `pausedUntil`, or the oldest start + 60000. A settled task decrements `running` and pumps. `schedule` pumps on a microtask, so callers see the promise first. `pauseFor(ms)` sets `pausedUntil = max(pausedUntil, now + ms)`.

`parseRetryAfter`: a string matching `/^\d+$/` → seconds × 1000. A string in the HTTP-date (IMF-fixdate) form, `/^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/`, → `max(0, Date.parse(value) − now)`. Anything else → `null`. Never pass other strings to `Date.parse`: V8 reads `'-5'` and `'1.5'` as dates.

- [ ] **Step 4: Run them and see them pass**

Run: `node --test tests/unit/clock.test.js tests/unit/ratelimit.test.js`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/util/clock.js src/core/net/errors.js src/core/net/ratelimit.js tests/unit/helpers/async.js tests/unit/clock.test.js tests/unit/ratelimit.test.js
git commit -m "Add the clock helpers, NetError and the rate limiter"
```

### Task 4: HTTP client

**Files:**
- Create: `src/core/net/http.js`
- Test: `tests/unit/http.test.js`

**Interfaces:**
- Consumes: `NetError`, `createLimiter`, `parseRetryAfter` (Task 3); `fakeClock` and `flush` (tests).
- Produces: `createHttp({transport, clock}) → {register(sourceId, {perMinute, concurrent}), request(url, opts) → Promise<Response>, getJson(url, opts), getText(url, opts)}` with `opts = {method='GET', headers, body, source, timeoutMs=8000, privileged=false, signal}`. Constants exported for tests: `RETRY_MAX_MS = 10000`, `DEFAULT_PAUSE_MS = 60000`, `CIRCUIT_FAILS = 3`, `CIRCUIT_MS = 60000`.

- [ ] **Step 1: Write the failing test**

The file imports `flush` from `./helpers/async.js` and uses a scripted transport, where each `next` entry returns a `Response` promise or throws, and a fetch that only ends on abort:

```js
let calls, next, clock, http;
const transport = { fetch: (url, init) => { calls.push({ url, init }); return next.shift()(init); } };
const hang = init => new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(new DOMException('x', 'AbortError'))));
test.beforeEach(() => { calls = []; next = []; clock = fakeClock(Date.UTC(2026, 10, 11)); http = createHttp({ transport, clock }); });
```

```js
test('getJson parses and passes method, headers and privileged', async () => {
  next = [() => Promise.resolve(Response.json({ ok: 1 }))];
  assert.deepEqual(await http.getJson('https://a.test/x', { headers: { 'Api-User-Agent': 'B' }, privileged: true, source: 's' }), { ok: 1 });
  const { init } = calls[0];
  assert.equal(init.method, 'GET'); assert.equal(init.headers['Api-User-Agent'], 'B');
  assert.equal(init.privileged, true); assert.notEqual(init.credentials, 'include'); assert.ok(init.signal instanceof AbortSignal);
});
test('a status of 400 or more throws NetError http', async () => {
  next = [() => Promise.resolve(new Response('no', { status: 404 }))];
  await assert.rejects(http.getText('https://a.test/', { source: 's' }), { name: 'NetError', kind: 'http', status: 404, source: 's' });
});
test('a fetch TypeError becomes kind network', async () => {
  next = [() => { throw new TypeError('Failed to fetch'); }];
  await assert.rejects(http.request('https://a.test/'), { kind: 'network' });
});
test('timeoutMs aborts with kind timeout', async () => {
  next = [hang]; const p = http.request('https://a.test/'); await flush(); clock.advance(8000);
  await assert.rejects(p, { kind: 'timeout' });
});
test('a caller abort gives kind aborted', async () => {
  next = [hang]; const ac = new AbortController(); const p = http.request('https://a.test/', { signal: ac.signal });
  await flush(); ac.abort(); await assert.rejects(p, { kind: 'aborted' });
});
test('429 with Retry-After of 10 s or less retries once', async () => {
  next = [() => Promise.resolve(new Response('', { status: 429, headers: { 'Retry-After': '2' } })), () => Promise.resolve(new Response('ok'))];
  const p = http.getText('https://a.test/'); await flush(); assert.equal(calls.length, 1);
  clock.advance(2000); assert.equal(await p, 'ok'); assert.equal(calls.length, 2);
});
test('a second 429 in a row is not retried', async () => {
  next = [1, 2].map(() => () => Promise.resolve(new Response('', { status: 429, headers: { 'Retry-After': '1' } })));
  const p = http.getText('https://a.test/'); await flush(); clock.advance(1000);
  await assert.rejects(p, { kind: 'http', status: 429 }); assert.equal(calls.length, 2);
});
test('503 with Retry-After 30 pauses the source and throws', async () => {
  http.register('s', { perMinute: 60, concurrent: 1 });
  next = [() => Promise.resolve(new Response('', { status: 503, headers: { 'Retry-After': '30' } })), () => Promise.resolve(new Response('ok'))];
  await assert.rejects(http.getText('https://a.test/', { source: 's' }), { status: 503, retryAfterMs: 30000 });
  const p = http.getText('https://a.test/', { source: 's' }); await flush(); assert.equal(calls.length, 1);
  clock.advance(30000); assert.equal(await p, 'ok');
});
test('bad JSON gives kind parse', async () => {
  next = [() => Promise.resolve(new Response('not json'))];
  await assert.rejects(http.getJson('https://a.test/'), { kind: 'parse' });
});
test('3 straight network failures open the circuit for 60 s', async () => {
  http.register('s', { perMinute: 60, concurrent: 2 });
  next = [1, 2, 3, 4].map(() => () => { throw new TypeError('x'); });
  for (let i = 0; i < 3; i++) await assert.rejects(http.request('https://a.test/', { source: 's' }), { kind: 'network' });
  await assert.rejects(http.request('https://a.test/', { source: 's' }), { kind: 'circuit' }); assert.equal(calls.length, 3);
  clock.advance(60000);
  await assert.rejects(http.request('https://a.test/', { source: 's' }), { kind: 'network' }); assert.equal(calls.length, 4);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/unit/http.test.js`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 3: Implement `createHttp` in `src/core/net/http.js`**

`request` runs through the source's limiter when one is registered, otherwise directly. It links an `AbortController` to the caller's `signal` and to a `clock.setTimeout(timeoutMs)`, and clears the timer when done. It calls `transport.fetch(url, {method, headers, body, signal, privileged})` and never adds `credentials`. Errors map as follows: caller abort → `aborted`; timer abort → `timeout`; any other throw → `network`. On 429 or 503, `ra = parseRetryAfter(res.headers.get('Retry-After'), clock.now())`. On the first attempt with `ra !== null && ra <= RETRY_MAX_MS`, it waits `ra` on the clock and tries once more. Otherwise it calls the source limiter's `pauseFor(ra ?? DEFAULT_PAUSE_MS)` and throws `NetError('http', …, {status, retryAfterMs: ra, source})`. Any other status ≥ 400 throws `http`. The circuit counts consecutive `network`/`timeout` failures per source. At `CIRCUIT_FAILS` it fails fast with `circuit` until `CIRCUIT_MS` has passed. Any response resets the count. `getJson` wraps `res.json()` failures as `parse`.

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/unit/http.test.js`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/net/http.js tests/unit/http.test.js
git commit -m "Add the HTTP client with timeouts, Retry-After and a circuit breaker"
```

### Task 5: Store and cache

**Files:**
- Create: `src/core/store/db.js`, `src/core/store/cache.js`
- Test: `tests/unit/db.test.js`, `tests/unit/cache.test.js`

**Interfaces:**
- Consumes: `fakeClock` (tests).
- Produces: `STORE_NAMES`, `openStore(backend) → Promise<Store>`, `idbBackend(dbName='byways')`, `memoryBackend()`, `createCache(store, clock) → {get(key) → Promise<value|undefined>, set(key, value, ttlMs) → Promise<void>, purgeExpired() → Promise<number>}`. A backend is `{open(names: string[]) → Promise<{get, put, delete, getAll, keys, clear}>}`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/db.test.js` starts with `import 'fake-indexeddb/auto';`, then runs one suite per backend:

```js
const backends = [['memory', () => memoryBackend()], ['idb', () => idbBackend('t-' + Math.random())]];
for (const [name, make] of backends) {
  test(`${name}: put and get clone values; delete removes`, async () => {
    const s = await openStore(make()); const v = { a: [1] };
    await s.put('settings', 'k', v); v.a.push(2);
    const got = await s.get('settings', 'k'); assert.deepEqual(got, { a: [1] });
    got.a.push(3); assert.deepEqual(await s.get('settings', 'k'), { a: [1] });
    assert.equal(await s.get('settings', 'missing'), undefined);
    await s.delete('settings', 'k'); assert.equal(await s.get('settings', 'k'), undefined);
  });
  test(`${name}: getAll and keys sort by key; clear empties one store`, async () => {
    const s = await openStore(make());
    await s.put('seen', 'b', 2); await s.put('seen', 'a', 1); await s.put('history', 'x', 0);
    assert.deepEqual(await s.getAll('seen'), [{ key: 'a', value: 1 }, { key: 'b', value: 2 }]);
    assert.deepEqual(await s.keys('seen'), ['a', 'b']);
    await s.clear('seen'); assert.deepEqual(await s.getAll('seen'), []); assert.deepEqual(await s.keys('history'), ['x']);
  });
  test(`${name}: every store exists and unknown names reject`, async () => {
    const s = await openStore(make());
    for (const n of STORE_NAMES) { await s.put(n, 'k', n); assert.equal(await s.get(n, 'k'), n); }
    await assert.rejects(s.get('nope', 'k'), /unknown store: nope/);
  });
}
test('STORE_NAMES is the §14.1 list', () => assert.deepEqual(STORE_NAMES, ['settings', 'taste', 'collections', 'history', 'seen', 'cache', 'aiCache', 'usage', 'health', 'keys']));
test('idb data survives reopening', async () => {
  const n = 'p-' + Math.random(); await (await openStore(idbBackend(n))).put('keys', 'k', 'v');
  assert.equal(await (await openStore(idbBackend(n))).get('keys', 'k'), 'v');
});
test('idbBackend rejects when IndexedDB is missing', async () => {
  const saved = globalThis.indexedDB; globalThis.indexedDB = undefined;
  try { await assert.rejects(openStore(idbBackend('x')), /IndexedDB is not available/); } finally { globalThis.indexedDB = saved; }
});
```

`tests/unit/cache.test.js`:

```js
test('cache returns a value until its ttl passes, then deletes it', async () => {
  const c = fakeClock(0); const store = await openStore(memoryBackend()); const cache = createCache(store, c);
  await cache.set('k', { x: 1 }, 1000);
  c.advance(999); assert.deepEqual(await cache.get('k'), { x: 1 });
  c.advance(1); assert.equal(await cache.get('k'), undefined); assert.equal(await store.get('cache', 'k'), undefined);
});
test('purgeExpired removes only expired entries', async () => {
  const c = fakeClock(0); const store = await openStore(memoryBackend()); const cache = createCache(store, c);
  await cache.set('a', 1, 10); await cache.set('b', 2, 100); c.advance(50);
  assert.equal(await cache.purgeExpired(), 1); assert.deepEqual(await store.keys('cache'), ['b']);
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `node --test tests/unit/db.test.js tests/unit/cache.test.js`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 3: Implement `src/core/store/db.js`**

`openStore(backend)` awaits `backend.open(STORE_NAMES)` and wraps each method so an unknown store name rejects with `Error('unknown store: <name>')`. `memoryBackend` keeps a `Map` per store and `structuredClone`s on put and on get. `idbBackend` reads `globalThis.indexedDB` at `open()` time, inside the try block, because some browsers throw from the getter itself. If it is missing, or reading it or `indexedDB.open` throws, or the request fires `error`, it rejects with `Error('IndexedDB is not available')`. It opens version 1 and creates every missing store in `onupgradeneeded` with out-of-line keys. It sets `db.onversionchange = () => db.close()`. Each call runs in its own transaction and resolves on the request's `success`. `getAll` reads `getAllKeys()` and `getAll()` in one `readonly` transaction and zips them.

- [ ] **Step 4: Implement `createCache` in `src/core/store/cache.js`**

Entries are stored in `cache` as `{value, expires: clock.now() + ttlMs}`. An entry with `expires <= clock.now()` counts as expired.

- [ ] **Step 5: Run them and see them pass**

Run: `node --test tests/unit/db.test.js tests/unit/cache.test.js`
Expected: PASS, 11 tests.

- [ ] **Step 6: Commit**

```bash
git add src/core/store/db.js src/core/store/cache.js tests/unit/db.test.js tests/unit/cache.test.js
git commit -m "Add the IndexedDB and memory store and the TTL cache"
```

### Task 6: Settings

**Files:**
- Create: `src/core/settings.js`
- Test: `tests/unit/settings.test.js`

**Interfaces:**
- Consumes: `openStore`, `memoryBackend` (Task 5).
- Produces: `DEFAULT_SETTINGS` (the overview block, verbatim), `loadSettings(store) → Promise<Settings>`, `saveSettings(store, patch) → Promise<Settings>`, `repairSettings(value) → Settings` (pure). Settings live in the `settings` store under the key `'current'`.

- [ ] **Step 1: Write the failing test**

```js
test('DEFAULT_SETTINGS holds the contract values', () => {
  const d = DEFAULT_SETTINGS;
  assert.deepEqual([d.v, d.mode, d.dwellSec, d.textScale, d.firstRunDone], [1, 'tuned', 20, 1, false]);
  assert.deepEqual(d.voice, { mode: 'auto', cloudOptIn: false, voiceURI: null, rate: 1, volume: 1, lang: 'en-US' });
  assert.deepEqual([d.ai.runCapUsd, d.ai.dailySearchCap, d.ai.dailySpendCapUsd], [0.5, 50, 2]);
  assert.deepEqual(d.ai.team, { enabled: false, captain: false, roles: { scout: null, digger: null, wildcard: null, captain: null } });
  assert.deepEqual([d.sources, d.ai.baseUrls], [{}, {}]);
});
test('loadSettings on an empty store returns a fresh copy of the defaults', async () => {
  const store = await openStore(memoryBackend()); const s = await loadSettings(store);
  assert.deepEqual(s, DEFAULT_SETTINGS); s.voice.rate = 2; assert.equal(DEFAULT_SETTINGS.voice.rate, 1);
});
test('saveSettings deep-merges a patch and persists it', async () => {
  const store = await openStore(memoryBackend());
  const s = await saveSettings(store, { voice: { rate: 1.5 }, ai: { team: { roles: { scout: { provider: 'groq', model: 'm' } } } } });
  assert.equal(s.voice.lang, 'en-US');
  const again = await loadSettings(store);
  assert.equal(again.voice.rate, 1.5); assert.deepEqual(again.ai.team.roles.scout, { provider: 'groq', model: 'm' });
  assert.equal(again.ai.team.roles.digger, null);
});
test('loadSettings repairs bad stored values', async () => {
  const store = await openStore(memoryBackend());
  await store.put('settings', 'current', { dwellSec: 9999, textScale: 0.2, theme: 7, voice: null, ai: { team: 'x', baseUrls: { ollama: 'http://localhost:11434' } },
    sessionLengthMin: 30, sources: { wikipedia: { enabled: false, fateWeight: 9 } }, extra: 'kept' });
  const s = await loadSettings(store);
  assert.equal(s.dwellSec, 300); assert.equal(s.textScale, 1); assert.equal(s.theme, 'system');
  assert.deepEqual(s.voice, DEFAULT_SETTINGS.voice); assert.deepEqual(s.ai.team, DEFAULT_SETTINGS.ai.team);
  assert.deepEqual(s.ai.baseUrls, { ollama: 'http://localhost:11434' });
  assert.equal(s.sessionLengthMin, 30); assert.deepEqual(s.sources.wikipedia, { enabled: false, fateWeight: 3 });
  assert.equal(s.extra, 'kept');
  await store.put('settings', 'current', 'garbage'); assert.deepEqual(await loadSettings(store), DEFAULT_SETTINGS);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/unit/settings.test.js`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 3: Implement `src/core/settings.js`**

`repairSettings(stored)` walks `DEFAULT_SETTINGS`. Where the default is a plain object with keys, it recurses (a non-object stored value gives the default). Where the default is `{}` (`sources`, `ai.baseUrls`), it keeps a stored plain object. Where the default is `null`, it accepts a string, number, plain object or `null`. Otherwise it keeps the stored value only when its `typeof` matches the default. Keys the defaults do not know are kept as they are. Then it clamps `dwellSec` to 5–300, `textScale` to 1–2, `voice.rate` to 0.5–2, `voice.volume` to 0–1, and each `sources[id].fateWeight` to 0–3. It always returns a new object and never shares references with `DEFAULT_SETTINGS`. `saveSettings` deep-merges `patch` over the loaded settings (plain objects merge; arrays and other values replace), repairs, puts and returns.

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/unit/settings.test.js`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/settings.js tests/unit/settings.test.js
git commit -m "Add settings defaults with load, repair and save"
```

### Task 7: Web platform

**Files:**
- Create: `src/platform/web-tts.js`, `src/platform/web-media.js`, `src/platform/web-voice.js`, `src/platform/pwa.js`
- Create: `tests/unit/helpers/fake-dom.js`: `fakeDocument() → {document, created}`. `document.createElement(tag)` returns a plain object with an upper-case `tagName`; `setAttribute(k, v)` stores `String(v)` for `getAttribute` and also sets the property `k`; `addEventListener`, `dispatchEvent(event)` (calls the listeners and `on<type>`), `click()` (sets `clicked`, dispatches `click`), `remove()` (sets `removed`) and `append()`. `document.body` is one such element, and `created` lists every element made.
- Test: `tests/unit/web-tts.test.js`, `tests/unit/web-media.test.js`, `tests/unit/web-voice.test.js`, `tests/unit/pwa.test.js`

**Interfaces:**
- Consumes: `isHttpUrl` (Task 2); `openStore`, `memoryBackend` (Task 5, tests); `flush` (Task 3, tests).
- Produces: `createWebTts(speechSynthesis, Utterance = globalThis.SpeechSynthesisUtterance) → Tts`; `createWebMedia(navigator) → Platform['media']`; `createWebWakeLock(navigator, document) → Platform['wakeLock']`; `createNoVoice() → VoiceEngine`; `createPwaPlatform({secretsStore, win = globalThis}) → Platform` (with `requestOrigins` and no `attach`), where `secretsStore` is a `Store`; `registerServiceWorker(win, onUpdate) → Promise<ServiceWorkerRegistration|null>`.

- [ ] **Step 1: Write the failing tests**

`web-tts.test.js`:

```js
class FakeUtterance { constructor(t) { this.text = t; } }
const V1 = { voiceURI: 'v1', name: 'One', lang: 'en-US', localService: true };
const makeSynth = () => ({ spoken: [], list: [], fail: null, on: {}, cancel() {}, getVoices() { return this.list; },
  addEventListener(t, f) { this.on[t] = f; }, removeEventListener() {},
  speak(u) { this.spoken.push(u); queueMicrotask(() => (this.fail ? u.onerror({ error: this.fail }) : u.onend())); } });
test('speak sets voice, rate and volume and resolves at the end', async () => {
  const synth = makeSynth(); synth.list = [V1];
  await createWebTts(synth, FakeUtterance).speak('Hello', { voiceURI: 'v1', rate: 1.5, volume: 0.5 });
  const u = synth.spoken[0];
  assert.deepEqual([u.text, u.voice.voiceURI, u.rate, u.volume], ['Hello', 'v1', 1.5, 0.5]);
});
test('interrupted and canceled resolve; other errors reject', async () => {
  const synth = makeSynth(); const tts = createWebTts(synth, FakeUtterance);
  for (const e of ['interrupted', 'canceled']) { synth.fail = e; await tts.speak('x'); }
  synth.fail = 'synthesis-failed'; await assert.rejects(tts.speak('x'), /synthesis-failed/);
});
test('voices maps fields and waits for voiceschanged when empty', async () => {
  const synth = makeSynth(); const p = createWebTts(synth, FakeUtterance).voices();
  synth.list = [V1]; synth.on.voiceschanged();
  assert.deepEqual(await p, [{ uri: 'v1', name: 'One', lang: 'en-US', local: true }]);
});
test('with no speechSynthesis it is silent', async () => {
  const tts = createWebTts(undefined); await tts.speak('x'); tts.cancel(); assert.deepEqual(await tts.voices(), []);
});
```

`web-media.test.js` (imports `flush` from `./helpers/async.js`):

```js
test('setHandlers maps to media session actions and survives unsupported ones', () => {
  const set = {}; const nav = { mediaSession: { setActionHandler(a, f) { if (a === 'previoustrack') throw new TypeError('unsupported'); set[a] = f; } } };
  const next = () => {}; const pp = () => {};
  createWebMedia(nav).setHandlers({ next, previous: () => {}, playPause: pp });
  assert.equal(set.nexttrack, next); assert.equal(set.play, pp); assert.equal(set.pause, pp);
});
test('setActive sets playbackState; no mediaSession is a no-op', () => {
  const nav = { mediaSession: { playbackState: 'none' } }; const m = createWebMedia(nav);
  m.setActive(true); assert.equal(nav.mediaSession.playbackState, 'playing');
  m.setActive(false); assert.equal(nav.mediaSession.playbackState, 'none');
  createWebMedia({}).setActive(true);
});
test('wake lock re-acquires when the page is visible again and stops after off', async () => {
  const held = []; const nav = { wakeLock: { request: async type => {
    const s = { type, released: false, release: async () => { s.released = true; } }; held.push(s); return s; } } };
  const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' }); const wl = createWebWakeLock(nav, doc);
  await wl.on(); assert.equal(held.length, 1);
  held[0].released = true; doc.dispatchEvent(new Event('visibilitychange')); await flush(); assert.equal(held.length, 2);
  await wl.off(); assert.equal(held[1].released, true);
  doc.dispatchEvent(new Event('visibilitychange')); await flush(); assert.equal(held.length, 2);
});
test('a refused or missing wake lock resolves quietly', async () => {
  await createWebWakeLock({ wakeLock: { request: async () => { throw new DOMException('no', 'NotAllowedError'); } } }, new EventTarget()).on();
  await createWebWakeLock({}, new EventTarget()).on();
});
```

The browser releases the lock when the page is hidden; the test stands for that by setting `released` before the `visibilitychange`.

`web-voice.test.js`:

```js
test('createNoVoice reports none and emits an error on start', async () => {
  const v = createNoVoice();
  assert.deepEqual(await v.probe({ allowCloud: false }), { kind: 'none', vendor: null, needsDownload: false, continuous: false, reason: 'not set up yet' });
  assert.equal(await v.install(), false);
  const errs = []; const off = v.on('error', e => errs.push(e));
  await v.start({ lang: 'en-US', phrases: [], allowCloud: false });
  assert.deepEqual(errs, [{ code: 'service-not-allowed' }]);
  off(); await v.start({ lang: 'en-US', phrases: [], allowCloud: false }); assert.equal(errs.length, 1); v.stop();
});
```

`pwa.test.js` (imports `fakeDocument` from `./helpers/fake-dom.js`):

```js
const makeWin = (navigator = {}) => {
  const opened = [], assigned = [], fetched = []; const { document, created } = fakeDocument();
  const win = { navigator, document, location: { assign: u => assigned.push(u) }, open: (...a) => { opened.push(a); },
    fetch: async (url, init) => { fetched.push({ url, init }); return new Response('ok'); },
    URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} }, setTimeout: fn => fn() };
  return { win, opened, assigned, fetched, created };
};
const platform = async nav => createPwaPlatform({ secretsStore: await openStore(memoryBackend()), win: makeWin(nav).win });
test('name, caps, requestOrigins and secrets in the keys store', async () => {
  const store = await openStore(memoryBackend()); const p = createPwaPlatform({ secretsStore: store, win: makeWin().win });
  assert.equal(p.name, 'pwa'); assert.equal(p.attach, undefined);
  assert.deepEqual(p.caps, { privilegedFetch: false, localNetworkHttp: false, inAppSiteView: false, labHref: 'lab/', framesArchive: true });
  assert.equal(await p.requestOrigins(['http://192.168.1.5:11434']), true);
  await p.secrets.set('ai:anthropic', 'k1'); assert.equal(await store.get('keys', 'ai:anthropic'), 'k1');
  assert.deepEqual(await p.secrets.list(), ['ai:anthropic']); await p.secrets.delete('ai:anthropic');
  assert.equal(await p.secrets.get('ai:anthropic'), null);
});
test('transport drops privileged and omits credentials', async () => {
  const { win, fetched } = makeWin(); const p = createPwaPlatform({ secretsStore: await openStore(memoryBackend()), win });
  await p.transport.fetch('https://a.test/', { privileged: true, headers: { a: 'b' } });
  assert.equal('privileged' in fetched[0].init, false); assert.equal(fetched[0].init.credentials, 'omit'); assert.deepEqual(fetched[0].init.headers, { a: 'b' });
});
test('share uses navigator.share, then the clipboard', async () => {
  const copied = []; const clipboard = { writeText: async t => { copied.push(t); } }; const data = { title: 'T', url: 'https://x.org/' };
  assert.equal(await (await platform({ share: async () => {} })).share(data), 'shared');
  assert.equal(await (await platform({ share: async () => { throw new DOMException('no', 'AbortError'); } })).share(data), 'cancelled');
  assert.equal(await (await platform({ share: async () => { throw new DOMException('no', 'NotAllowedError'); }, clipboard })).share(data), 'copied');
  assert.equal(await (await platform({ clipboard })).share(data), 'copied'); assert.deepEqual(copied, ['https://x.org/', 'https://x.org/']);
  assert.equal(await (await platform({ clipboard: { writeText: async () => { throw new Error('denied'); } } })).share(data), 'cancelled');
});
test('openFind opens only http(s) links, in a new tab with noopener', async () => {
  const { win, opened, assigned } = makeWin(); const p = createPwaPlatform({ secretsStore: await openStore(memoryBackend()), win });
  await p.openFind({ url: 'https://x.org/' }); assert.deepEqual(opened, [['https://x.org/', '_blank', 'noopener']]);
  await p.openFind({ url: 'https://y.org/' }, 'current'); assert.deepEqual(assigned, ['https://y.org/']);
  await assert.rejects(p.openFind({ url: 'javascript:alert(1)' }), /not an http\(s\) link/); assert.equal(opened.length, 1);
});
test('files.save clicks a download link; files.pick returns chosen files', async () => {
  const { win, created } = makeWin(); const p = createPwaPlatform({ secretsStore: await openStore(memoryBackend()), win });
  await p.files.save('byways.json', new Blob(['{}']));
  const a = created.find(e => e.tagName === 'A');
  assert.deepEqual([a.download, a.href, a.clicked, a.removed], ['byways.json', 'blob:x', true, true]);
  const picking = p.files.pick('.json'); const input = created.find(e => e.tagName === 'INPUT');
  input.files = ['f']; input.dispatchEvent({ type: 'change' });
  assert.deepEqual(await picking, ['f']); assert.deepEqual([input.type, input.accept, input.multiple], ['file', '.json', false]);
});
test('persistStorage reports the grant and never throws', async () => {
  assert.equal(await (await platform({ storage: { persist: async () => true } })).persistStorage(), true);
  assert.equal(await (await platform({})).persistStorage(), false);
  assert.equal(await (await platform({ storage: { persist: async () => { throw new Error('x'); } } })).persistStorage(), false);
});
test('registerServiceWorker skips the Android shell', async () => {
  let calls = 0; const { win } = makeWin({ serviceWorker: { register: async () => { calls++; return {}; } } }); win.BywaysNative = {};
  assert.equal(await registerServiceWorker(win, () => {}), null); assert.equal(calls, 0);
});
test('registerServiceWorker returns null when register rejects or resolves to nothing', async () => {
  for (const register of [async () => { throw new Error('no'); }, async () => undefined])
    assert.equal(await registerServiceWorker(makeWin({ serviceWorker: { register } }).win, () => {}), null);
  assert.equal(await registerServiceWorker(makeWin({}).win, () => {}), null);
});
test('registerServiceWorker reports a waiting worker and a newly installed one', async () => {
  const updates = []; let args; const reg = { waiting: {}, addEventListener(t, f) { this[t] = f; } };
  const { win } = makeWin({ serviceWorker: { controller: {}, register: async (...a) => { args = a; return reg; } } });
  assert.equal(await registerServiceWorker(win, r => updates.push(r)), reg);
  assert.deepEqual(args, ['./sw.js']); assert.deepEqual(updates, [reg]);
  reg.installing = { state: 'installing', addEventListener(t, f) { this[t] = f; } };
  reg.updatefound(); reg.installing.state = 'installed'; reg.installing.statechange(); assert.deepEqual(updates, [reg, reg]);
});
```

`register: async () => undefined` is what Playwright's `serviceWorkers: 'block'` installs, so every e2e spec but `sw.spec.js` runs this path.

- [ ] **Step 2: Run them and see them fail**

Run: `node --test tests/unit/web-tts.test.js tests/unit/web-media.test.js tests/unit/web-voice.test.js tests/unit/pwa.test.js`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 3: Implement `web-tts.js`, `web-media.js` and `web-voice.js`**

`createWebTts`: with no `speechSynthesis`, `speak` resolves at once and `voices` gives `[]`. Otherwise `speak` takes the voice whose `voiceURI` matches from `getVoices()`, sets `rate` and `volume` when given, resolves on `end` and on an `error` of `interrupted` or `canceled`, and rejects with `Error(event.error)` on any other error. `voices` maps each voice to `{uri, name, lang, local}`; when the list is empty it adds a `voiceschanged` listener (`addEventListener`) at once and waits for that event or 1000 ms, whichever comes first, then clears the other. Plan 03 adds sentence splitting. `createWebMedia` maps `next → 'nexttrack'`, `previous → 'previoustrack'` and `playPause → 'play'` and `'pause'`, each in its own try/catch. `createWebWakeLock` keeps a `wanted` flag. On `visibilitychange` it requests `'screen'` again when the page is visible, the lock is wanted, and the held sentinel is missing or released. It swallows request errors and does nothing without `navigator.wakeLock`. `createNoVoice` keeps a listener set per event; `start` emits `state {listening: false}` and then `error {code: 'service-not-allowed'}`.

- [ ] **Step 4: Implement `pwa.js`**

`secrets` maps to the `keys` store, keyed by the secret id (`get` gives `null` for a missing key). `transport.fetch(url, init)` removes `privileged` and calls `win.fetch(url, {...rest, credentials: 'omit'})`. `share(data)` tries `navigator.share` when it exists and `navigator.canShare?.(data) !== false`. An `AbortError` gives `'cancelled'`. Any other error, or no `share`, falls back to `navigator.clipboard.writeText(url || text || title)`, which gives `'copied'`, or `'cancelled'` when the clipboard is missing or refuses. `openFind(find, how = 'tab')` throws `Error('not an http(s) link')` unless `isHttpUrl(find.url)`; `'current'` uses `location.assign`, and anything else `win.open(url, '_blank', 'noopener')`. `files.save` makes an `a` with `download` set and an `href` from `win.URL.createObjectURL`, appends it to `body`, clicks and removes it, and revokes the URL 1000 ms later through `win.setTimeout`. `files.pick(accept, multiple = false)` makes an `input` (`type = 'file'`, `accept`, `multiple`), resolves on `change` with `Array.from(input.files)` or on `cancel` with `[]`, then clicks it. `persistStorage` gives `false` when `navigator.storage?.persist` is missing or throws. `requestOrigins` resolves `true`, because CORS decides on the web. There is no `attach`. `voice: createNoVoice()`, `tts: createWebTts(win.speechSynthesis)`, `media: createWebMedia(win.navigator)`, `wakeLock: createWebWakeLock(win.navigator, win.document)`.

`registerServiceWorker(win, onUpdate)` runs its whole body in try/catch and returns `null` when `win.BywaysNative` exists, when `navigator.serviceWorker` is missing, or when `register('./sw.js')` rejects or resolves to a falsy value. When the registration already has `waiting` and the page has a `controller`, it calls `onUpdate(reg)`. On `updatefound`, it watches `reg.installing` and calls `onUpdate(reg)` when that worker's `statechange` leaves it `installed` while a `controller` exists. It returns the registration.

- [ ] **Step 5: Run them and see them pass**

Run: `node --test tests/unit/web-tts.test.js tests/unit/web-media.test.js tests/unit/web-voice.test.js tests/unit/pwa.test.js`
Expected: PASS, 18 tests.

- [ ] **Step 6: Commit**

```bash
git add src/platform/web-tts.js src/platform/web-media.js src/platform/web-voice.js src/platform/pwa.js tests/unit/helpers/fake-dom.js tests/unit/web-tts.test.js tests/unit/web-media.test.js tests/unit/web-voice.test.js tests/unit/pwa.test.js
git commit -m "Add the web platform: speech, media, wake lock and the PWA object"
```

### Task 8: Check rules

**Files:**
- Create: `tools/check.js`
- Test: `tests/unit/check.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces (`tools/check.js`): `APP_CSP` (the overview string), `LAB_CSP` (`APP_CSP` with `script-src 'self' 'wasm-unsafe-eval' blob:` and `worker-src 'self' blob:`), `expectedCsp(path) → string` (the overview's per-page Lab additions), `findForbidden(file, text) → string[]`, `checkHtml(file, html) → string[]`, `checkRefs(file, text, exists) → string[]`, `checkManifest(file, text) → string[]`, `checkData(name, json, {tagIds}) → string[]`, `checkPrecache(swText, outDir) → string[]`, `runChecks({srcDir, outputs, extraHtml}) → Promise<string[]>`. Every problem string starts with the file path, then `: `.

- [ ] **Step 1: Write the failing tests**

`check.test.js` (with `mkdtempSync` and `writeFileSync` from `node:fs`, `join` from `node:path`, `tmpdir` from `node:os`):

```js
const page = csp => `<!doctype html><meta http-equiv="Content-Security-Policy" content="${csp}"><script type="module" src="ui/boot.js"></script>`;
test('findForbidden flags each banned API once', () => {
  for (const s of ['el.innerHTML = x', 'el.outerHTML = x', 'el.insertAdjacentHTML("a", b)', 'document.write(1)', 'eval(x)', 'new Function("x")', '<script src="https://cdn.x/y.js"></script>'])
    assert.equal(findForbidden('a.js', s).length, 1, s);
  assert.deepEqual(findForbidden('a.js', 'const evaluate = 1; medieval(2); x.innerHTMLish = 3;'), []);
});
test('checkHtml wants the expected CSP and no inline code', () => {
  assert.deepEqual(checkHtml('x.html', page(APP_CSP)), []);
  assert.deepEqual(checkHtml('x.html', '<p>hi</p>'), ['x.html: missing CSP meta']);
  assert.deepEqual(checkHtml('x.html', page("default-src *")), ['x.html: wrong CSP']);
  assert.deepEqual(checkHtml('dist/pwa/lab/x.html', page(LAB_CSP)), []);
  assert.deepEqual(checkHtml('dist/pwa/lab/index.html', page(expectedCsp('lab/index.html'))), []);
  assert.deepEqual(checkHtml('dist/pwa/lab/x.html', page(expectedCsp('lab/index.html'))), ['dist/pwa/lab/x.html: wrong CSP']);
  assert.deepEqual(checkHtml('x.html', page(APP_CSP) + '<script>1</script>'), ['x.html: inline script']);
  assert.deepEqual(checkHtml('x.html', page(APP_CSP) + '<div style="color:red"></div><style>p{}</style>'), ['x.html: inline style', 'x.html: inline style']);
});
test('expectedCsp adds only the per-page Lab additions', () => {
  assert.equal(expectedCsp('dist/pwa/index.html'), APP_CSP); assert.equal(expectedCsp('dist/pwa/lab/flash.html'), LAB_CSP);
  assert.equal(expectedCsp('lab/index.html'), LAB_CSP.replace('frame-src ', "frame-src 'self' "));
  for (const f of ['lab/dos.html', 'shells/android/app/src/main/assets/lab/lab/console.html'])
    assert.equal(expectedCsp(f), LAB_CSP.replace('http://127.0.0.1:*;', 'http://127.0.0.1:* blob:;'), f);
});
test('checkRefs reports imports and links that do not resolve', () => {
  const have = new Set(['/out/ui/a.js', '/out/index.html', '/out/ui/styles/app.css']); const exists = p => have.has(p);
  assert.deepEqual(checkRefs('/out/ui/b.js', "import { a } from './a.js'; import x from './gone.js'; export * from '../core/z.js'; const m = import('./lazy.js');", exists),
    ['/out/ui/b.js: missing ./gone.js', '/out/ui/b.js: missing ../core/z.js', '/out/ui/b.js: missing ./lazy.js']);
  assert.deepEqual(checkRefs('/out/index.html', '<a href="#/feed">F</a><a href="https://x.org/">X</a><link href="ui/styles/app.css?v=1"><img src="data:image/png;base64,AA"><a href="./">H</a><script src="ui/nope.js"></script>', exists),
    ['/out/index.html: missing ui/nope.js']);
});
test('checkManifest parses and wants relative scope', () => {
  assert.deepEqual(checkManifest('m.webmanifest', '{'), ['m.webmanifest: not valid JSON']);
  assert.deepEqual(checkManifest('m.webmanifest', '{"start_url":"/","scope":"./"}'), ['m.webmanifest: start_url must be ./']);
  assert.deepEqual(checkManifest('manifest.chrome.json', '{"manifest_version":3}'), []);
});
test('checkData validates the four data file shapes', () => {
  assert.deepEqual(checkData('tags.json', { v: 1, groups: [] }, {}), []);
  assert.match(checkData('tags.json', { v: 1, groups: [{ id: 'g', label: 'G', tags: [{ id: 'Retro Games', label: 'R' }] }] }, {})[0], /bad tag id/);
  const entry = { id: 'lib-0001', url: 'javascript:x', title: 't', blurb: 'b', tags: ['retro'], kind: 'site', added: '2026-11-11' };
  assert.match(checkData('library.json', { v: 1, entries: [entry] }, { tagIds: new Set(['retro']) })[0], /bad url/);
  assert.match(checkData('library.json', { v: 1, entries: [{ ...entry, url: 'https://x.org/', tags: ['nope'] }] }, { tagIds: new Set() })[0], /unknown tag nope/);
  assert.match(checkData('vault-starter.json', { v: 1, entries: [{ id: 'msdos_x', title: 't', platform: 'DOS', year: 1994, added: '2026-11-11' }] }, {})[0], /bad id/);
  assert.match(checkData('geocities-seeds.json', { v: 1, urls: ['ftp://x'] }, {})[0], /bad url/);
  assert.match(checkData('other.json', {}, {})[0], /unknown data file/);
});
test('checkPrecache wants a stamped id, existing files and under 2 MB', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pc-'));
  writeFileSync(join(dir, 'index.html'), '0123456789'); writeFileSync(join(dir, 'big.bin'), Buffer.alloc(2 * 1024 * 1024 + 1));
  assert.deepEqual(checkPrecache("const BUILD_ID = '__BUILD_ID__'; const PRECACHE = [\"__PRECACHE__\"];", dir), ['sw.js: build id not stamped', 'sw.js: precache list not written']);
  assert.deepEqual(checkPrecache(`const BUILD_ID = "dev"; const PRECACHE = ["./index.html","./gone.js"];`, dir), ['sw.js: precache missing ./gone.js']);
  assert.match(checkPrecache(`const BUILD_ID = "dev"; const PRECACHE = ["./index.html","./big.bin"];`, dir)[0], /app shell is over 2 MB/);
});
```

Library tags are checked against `tagIds` only when `tagIds` is given.

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/unit/check.test.js`
Expected: FAIL with `Cannot find module` for `tools/check.js`.

- [ ] **Step 3: Implement `tools/check.js`**

Forbidden patterns: `/\binnerHTML\b/`, `/\bouterHTML\s*=/`, `/\binsertAdjacentHTML\b/`, `/\bdocument\.write\b/`, `/\beval\(/`, `/\bnew Function\b/`, `/<script[^>]+src=["']https?:/i`, reported as `<file>: forbidden <name>`. `checkHtml` reports `<file>: wrong CSP` when the meta's content is not `expectedCsp(file)`. A page is a Lab page when its parent folder is named `lab` (`dist/pwa/lab/` and Android's `assets/lab/lab/`). `expectedCsp` gives `APP_CSP` for other pages; for Lab pages it gives `LAB_CSP`, except that `index.html` adds `'self'` at the start of `frame-src`, and `dos.html` and `console.html` add `blob:` at the end of `connect-src`. If Plan 06 finds that Ruffle needs `style-src 'unsafe-inline'`, it adds that case for `flash.html` here. A `<script>` with no `src` is inline. A `style=` attribute or a `<style>` tag is inline style. Relative refs are values that do not start with a scheme (`/^[a-z][a-z0-9+.-]*:/i`), `//`, `#` or `/`. Strip `?` and `#` parts, and resolve a value ending in `/` to its `index.html`. JS refs are `from '…'`, bare `import '…'` and `import('…')` string literals starting with `./` or `../`. `checkManifest` checks `start_url` and `scope` equal `./` only for `.webmanifest` files. `checkData` checks `v === 1`, tag ids match `/^[a-z0-9]+(-[a-z0-9]+)*$/` and are unique, library ids match `/^lib-\d{4}$/` with http(s) urls, `kind` in `site|game|toy|tool|article` and `added` as `YYYY-MM-DD`, vault ids start with `ia:` with a numeric `year`, and geocities urls are http(s). `checkPrecache` reads the `BUILD_ID` and `PRECACHE` literals, treats `./` as `./index.html`, and sums the sizes of the listed files against 2 × 1024 × 1024. `runChecks` walks each output folder, skipping any `vendor` segment. It runs `findForbidden` and `checkRefs` on `.js` and `.html`, `checkHtml` on `.html` (and on each `extraHtml` path), `checkManifest` on `*.webmanifest` and `manifest*.json`, `checkPrecache` on each output's `sw.js`, and `checkData` on every `srcDir/data/*.json` (passing `tagIds` from `tags.json`).

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/unit/check.test.js`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add tools/check.js tests/unit/check.test.js
git commit -m "Add the build check rules"
```

### Task 9: PWA shell, styles, icons and the build

**Files:**
- Create: `shells/pwa/index.html`, `shells/pwa/manifest.webmanifest`, `shells/pwa/sw.js` (constants only; Task 15 adds the handlers), `shells/pwa/landing/index.html`
- Create: `src/ui/styles/app.css`, `src/ui/styles/themes.css`, `src/ui/boot.js` (stub: `export async function bootFromShell() {}`; Task 13 fills it)
- Create: `src/assets/icons/icon.svg`, `tools/icons.js`, and the committed renders `src/assets/icons/icon-192.png`, `icon-512.png` and `maskable-512.png`
- Create: `src/data/tags.json` `{"v":1,"groups":[]}`, `src/data/library.json` `{"v":1,"entries":[]}`, `src/data/vault-starter.json` `{"v":1,"entries":[]}`, `src/data/geocities-seeds.json` `{"v":1,"urls":[]}` (Plans 02 and 04 fill them)
- Create: `tools/build.js`
- Test: `tests/unit/build.test.js`

**Interfaces:**
- Consumes: `runChecks`, `APP_CSP` (Task 8).
- Produces: `build({target, outRoot = APP_ROOT, id = process.env.GITHUB_SHA || 'dev', now = new Date()}) → Promise<{outputs: string[]}>`, `OUTPUTS = {pwa: ['dist/pwa'], extension: ['dist/chrome', 'dist/firefox'], android: ['shells/android/app/src/main/assets/www', 'shells/android/app/src/main/assets/lab']}`, `findStale(freshRoot, liveRoot, dirs) → string[]`; the CLI `--target pwa|extension|android|all` and `--check`. `renderIcons({svgPath, outDir}) → Promise<string[]>` in `tools/icons.js`, with the CLI `node tools/icons.js`; Plan 07's manifests use `icon-192.png` and `icon-512.png`. The page ids `#app`, `#main`, `#live-polite`, `#live-assertive`, `#hf-bar`, `#toasts`; the attribute values `data-theme` `system|light|dark|high-contrast`, `data-motion` `system|reduced|full`, `data-font` `system|atkinson`.

- [ ] **Step 1: Write the failing test** in `tests/unit/build.test.js`

```js
test('pwa target copies src and the shell and stamps the build', async () => {
  const out = await mkdtemp(join(tmpdir(), 'bw-')); const dir = join(out, 'dist/pwa');
  await build({ target: 'pwa', outRoot: out, id: 'abc123', now: new Date('2026-11-11T00:00:00Z') });
  for (const f of ['index.html', 'manifest.webmanifest', 'sw.js', 'build.json', 'core/util/hash.js', 'core/version.js', 'ui/boot.js', 'platform/pwa.js', 'data/tags.json', 'ui/styles/app.css'])
    assert.ok(existsSync(join(dir, f)), f);
  const icons = JSON.parse(readFileSync(join(dir, 'manifest.webmanifest'), 'utf8')).icons;
  assert.deepEqual(icons.map(i => [i.src, i.sizes, i.purpose]), [['assets/icons/icon.svg', 'any', 'any'], ['assets/icons/icon-192.png', '192x192', 'any'],
    ['assets/icons/icon-512.png', '512x512', 'any'], ['assets/icons/maskable-512.png', '512x512', 'maskable']]);
  for (const i of icons) assert.ok(existsSync(join(dir, i.src)), i.src);
  assert.deepEqual(JSON.parse(readFileSync(join(dir, 'build.json'), 'utf8')), { id: 'abc123', builtAt: '2026-11-11T00:00:00.000Z' });
  const sw = readFileSync(join(dir, 'sw.js'), 'utf8');
  assert.match(sw, /const BUILD_ID = "abc123";/);
  const list = JSON.parse(sw.match(/const PRECACHE = (\[[^\]]*\]);/)[1]);
  for (const f of ['./', './index.html', './manifest.webmanifest', './ui/boot.js', './data/tags.json']) assert.ok(list.includes(f), f);
  for (const f of ['./sw.js', './build.json']) assert.ok(!list.includes(f), f);
  assert.equal(existsSync(join(dir, 'landing')), false);
});
test('extension and android targets write only build.json until Plans 07 and 08', async () => {
  const out = await mkdtemp(join(tmpdir(), 'bw-')); await build({ target: 'all', outRoot: out, id: 'dev' });
  for (const d of [...OUTPUTS.extension, ...OUTPUTS.android]) assert.deepEqual(readdirSync(join(out, d)), ['build.json'], d);
});
test('a rebuild removes files that left src', async () => {
  const out = await mkdtemp(join(tmpdir(), 'bw-')); const dir = join(out, 'dist/pwa');
  await build({ target: 'pwa', outRoot: out, id: 'dev' }); writeFileSync(join(dir, 'stale.txt'), 'x');
  await build({ target: 'pwa', outRoot: out, id: 'dev' }); assert.equal(existsSync(join(dir, 'stale.txt')), false);
});
test('findStale reports changed, added and removed files and ignores build ids and missing outputs', async () => {
  const a = await mkdtemp(join(tmpdir(), 'bw-')); const b = await mkdtemp(join(tmpdir(), 'bw-'));
  await build({ target: 'pwa', outRoot: a, id: 'one' }); await build({ target: 'pwa', outRoot: b, id: 'two' });
  assert.deepEqual(findStale(a, b, ['dist/pwa', 'dist/chrome']), []);
  writeFileSync(join(b, 'dist/pwa/index.html'), 'changed'); writeFileSync(join(b, 'dist/pwa/extra.txt'), 'x'); rmSync(join(b, 'dist/pwa/ui/boot.js'));
  assert.deepEqual(findStale(a, b, ['dist/pwa', 'dist/chrome']), ['dist/pwa/extra.txt', 'dist/pwa/index.html', 'dist/pwa/ui/boot.js'].map(f => `${f}: stale; run npm run build`));
  assert.deepEqual(findStale(a, join(b, 'none'), ['dist/pwa']), []);
});
test('the real tree passes every check', async () => {
  const out = await mkdtemp(join(tmpdir(), 'bw-')); await build({ target: 'all', outRoot: out, id: 'dev' });
  const outputs = Object.values(OUTPUTS).flat().map(d => join(out, d));
  assert.deepEqual(await runChecks({ srcDir: 'src', outputs, extraHtml: ['shells/pwa/landing/index.html'] }), []);
});
test('the committed PNG icons have the sizes the manifest gives', () => {
  for (const [f, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['maskable-512.png', 512]]) {
    const png = readFileSync(new URL(`../../src/assets/icons/${f}`, import.meta.url));
    assert.equal(png.toString('latin1', 1, 4), 'PNG', f);
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [size, size], f);
  }
});
```

The file imports `mkdtemp` from `node:fs/promises`, `existsSync`, `readFileSync`, `readdirSync`, `writeFileSync` and `rmSync` from `node:fs`, `join`, `tmpdir`, and `build`, `OUTPUTS`, `findStale` and `runChecks` from the tools. Bytes 16–23 of a PNG are the IHDR width and height. `findStale` compares each output folder that exists in `liveRoot` with the fresh one, file list and bytes, except `build.json`, and compares `sw.js` without its `BUILD_ID` line. A file in only one of the two trees, or with other bytes, gives `<dir>/<path>: stale; run npm run build`, sorted by path. An output folder missing from `liveRoot` is skipped.

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/unit/build.test.js`
Expected: FAIL with `Cannot find module` for `tools/build.js`.

- [ ] **Step 3: Write the shell files**

`shells/pwa/index.html` is exactly this (the CSP is `APP_CSP`):

```html
<!doctype html>
<html lang="en" data-shell="pwa" data-theme="system" data-motion="system" data-font="system">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https: data: blob:; media-src 'self' https: blob:; frame-src https://archive.org https://*.archive.org; connect-src 'self' https: http://localhost:* http://127.0.0.1:*; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'">
<title>Byways</title>
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="assets/icons/icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="ui/styles/themes.css">
<link rel="stylesheet" href="ui/styles/app.css">
<script type="module" src="ui/boot.js"></script>
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<header class="topbar">
  <nav aria-label="Main">
    <a href="#/stumble">Stumble</a> <a href="#/feed">Feed</a> <a href="#/daily">Daily Fate</a>
    <a href="#/vault">Vault</a> <a href="#/saved">Saved</a> <a href="#/settings">Settings</a>
  </nav>
</header>
<div id="hf-bar" hidden></div>
<main id="main" tabindex="-1"><div id="app"></div></main>
<div id="toasts"></div>
<div id="live-polite" class="visually-hidden" role="status" aria-live="polite"></div>
<div id="live-assertive" class="visually-hidden" aria-live="assertive" aria-atomic="true"></div>
<noscript>Byways needs JavaScript.</noscript>
</body>
</html>
```

`shells/pwa/manifest.webmanifest`:

```json
{ "id": "./", "name": "Byways", "short_name": "Byways",
  "description": "A free discovery app. Press one button and go somewhere you would not have found on your own.",
  "start_url": "./", "scope": "./", "display": "standalone",
  "background_color": "#ffffff", "theme_color": "#1d4ed8",
  "icons": [
    { "src": "assets/icons/icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any" },
    { "src": "assets/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "assets/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "assets/icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" } ] }
```

`shells/pwa/sw.js` holds only `const BUILD_ID = '__BUILD_ID__';`, `const CACHE = 'byways-' + BUILD_ID;` and `const PRECACHE = ["__PRECACHE__"];`.

`shells/pwa/landing/index.html`: doctype, `lang="en"`, the same CSP meta, `<title>Game-Dev-Resources</title>`, an `<h1>Game-Dev-Resources</h1>`, and a list with one item: `<a href="byways/">Byways</a>` followed by " — a free discovery app with no account." It has no scripts and no styles.

- [ ] **Step 4: Write the styles**

`themes.css` sets the tokens `--bg --fg --muted --surface --border --accent --focus` on `[data-theme="light"]` and on `:root` (light: `#ffffff #1a1a1a #555555 #f3f3f0 #8a8a8a #1d4ed8 #b45309`, with `color-scheme: light`). The same tokens go on `[data-theme="dark"]` and inside `@media (prefers-color-scheme: dark) { [data-theme="system"] { … } }` (dark: `#121212 #f2f2f2 #bbbbbb #1e1e1e #777777 #93b4ff #fbbf24`, with `color-scheme: dark`), and on `[data-theme="high-contrast"]` (`#000000 #ffffff #ffffff #000000 #ffffff #ffff00 #00ffff`, with `color-scheme: dark`). It also has `[data-font="system"] body { font-family: system-ui, sans-serif; }`.

`app.css` holds:
- `html { font-size: calc(100% * var(--text-scale, 1)); }` and `body` colours from the tokens;
- `a, a:visited { color: var(--accent); }`. Without it, links keep the browser's `#0000ee`, which gives 1.99:1 on the dark background and 2.23:1 on high contrast, and axe fails both themes;
- `button, .btn, nav a { min-height: 56px; min-width: 56px; display: inline-flex; align-items: center; justify-content: center; padding: 0 16px; }`;
- `:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }`;
- `.visually-hidden` (the clip-rect pattern), a `.skip-link` that shows on focus, `[hidden] { display: none !important; }`, and `#toasts` fixed at the bottom centre; the skip link and each `.toast` use `var(--surface)`, `var(--fg)` and a `var(--border)` border;
- `@media (prefers-reduced-motion: reduce) { [data-motion="system"] *, [data-motion="system"] *::before, [data-motion="system"] *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; } }`, plus the same rule for `[data-motion="reduced"]` outside the media query.

Task 10's `basics.spec.js` checks these rules in Chromium.

- [ ] **Step 5: Draw the icon and render the PNGs**

`src/assets/icons/icon.svg`: a `viewBox="0 0 512 512"` rounded square filled `#1d4ed8`, with a white winding path stroke. No text and no external references.

`tools/icons.js`: `renderIcons({svgPath, outDir})` launches `chromium` from `@playwright/test`. For each icon it opens a page with a `size × size` viewport and `deviceScaleFactor: 1`, sets content that shows the SVG as an `<img>` data URL, awaits `img.decode()`, and saves `page.screenshot({path, omitBackground: true})`. It returns the three paths. `icon-192.png` and `icon-512.png` show the SVG at full size on a transparent background. `maskable-512.png` has a full-bleed `#1d4ed8` background with the SVG drawn at 288 px in the centre: its half-diagonal is 204 px, inside the 204.8 px radius of the maskable safe zone. The CLI renders `src/assets/icons/icon.svg` into `src/assets/icons/` and prints each path.

Run: `node tools/icons.js`
Expected: the three PNG paths are printed. Run it again only when `icon.svg` changes, and commit the PNGs. It is not part of `npm test`, because CI runs `npm test` before it installs Chromium.

- [ ] **Step 6: Implement `tools/build.js`**

`build` empties each output folder of the chosen target and writes `build.json` = `{id, builtAt: now.toISOString()}`. For `pwa`, it copies `src/core`, `src/ui`, `src/platform`, `src/data`, `src/assets`, and `src/versions.json` and `src/lab` when they exist, to the same paths under `dist/pwa/`. It copies `index.html`, `manifest.webmanifest` and `sw.js` from `shells/pwa/`. In `sw.js` it replaces `'__BUILD_ID__'` with `JSON.stringify(id)` and `["__PRECACHE__"]` with the JSON list: `'./'` plus every output file as `./<path>`, sorted, leaving out `sw.js`, `build.json` and anything under `lab/` or `vendor/`. `extension` and `android` write an empty output folder and `build.json` until Plan 07/08 adds files. `all` runs the three. The CLI `--check` builds `all` into `fs.mkdtemp(join(os.tmpdir(), 'byways-check-'))`. It then runs `runChecks({srcDir: 'src', outputs, extraHtml: ['shells/pwa/landing/index.html']})` and `findStale(tmp, APP_ROOT, all output dirs)`, prints each problem, and exits 1 when there are any. Otherwise it prints `check passed`. `APP_ROOT` is the folder above `tools/`. The CLI runs only when the file is run directly (`import.meta.url === pathToFileURL(process.argv[1]).href`), so tests can import `build`; `tools/icons.js` and `tools/serve.js` use the same guard.

- [ ] **Step 7: Run it and see it pass**

Run: `node --test tests/unit/build.test.js`
Expected: PASS, 6 tests.

Run: `npm test`
Expected: `check passed`, then every unit test passes.

- [ ] **Step 8: Commit**

```bash
git add shells/pwa src/ui/styles src/assets/icons src/ui/boot.js src/data tools/build.js tools/icons.js tests/unit/build.test.js
git commit -m "Add the PWA shell, base styles, icons and the build with its check"
```

### Task 10: Test server and end-to-end harness

**Files:**
- Create: `tools/serve.js`, `tests/e2e/playwright.config.js`, `tests/e2e/helpers/net.js`, `tests/e2e/helpers/fakes.js`, `tests/e2e/helpers/axe.js`
- Create: `tests/fixtures/routes.js`, `tests/fixtures/http/ping.json` (`{"pong": true}`)
- Test: `tests/unit/serve.test.js`, `tests/e2e/harness.spec.js`, `tests/e2e/basics.spec.js`

**Interfaces:**
- Consumes: the built `dist/pwa/` (Task 9); `toPlainText` (Task 2), loaded in the page.
- Produces:
  - `tools/serve.js`: `createServer({root, base}) → http.Server`, plus a CLI taking `--root`, `--base` and `--port`.
  - `helpers/net.js`: `mockNet(page, {overrides} = {}) → Promise<void>`, `unmocked(page) → string[]`, and `pageProblems(page, {ignore = []} = {}) → string[]`: `'console: <text>'` for every console error and `'pageerror: <message>'` for every page error, minus those an `ignore` RegExp matches. Also `test` and `expect`: `@playwright/test`'s `test` extended with the option fixture `ignoreProblems: RegExp[]` (default `[]`, set with `test.use({ignoreProblems: [...]})`) and a `page` fixture that calls `mockNet(page)` first and, after the test, expects `unmocked(page)` and `pageProblems(page, {ignore: ignoreProblems})` to be `[]`. Later specs import `test` and `expect` from here. A route or override entry is `{match: RegExp, file?: string, body?: string, json?: any, status?: number, headers?: object}`, where `file` is relative to `tests/fixtures/http/`.
  - `helpers/fakes.js`: `installFakeSpeech(page) → Promise<void>`, with these window hooks for specs: `__say(text, final = true)`, `__voiceError(code)`, `__recognizers`, `__spoken` and `__wake = {requests, releases}`. Plan 03 adds options and hooks to this function and renames none of these.
  - `helpers/axe.js`: `expectNoSeriousA11y(page, {exclude = []} = {}) → Promise<void>`.
  - Service workers are blocked in every spec unless it sets `test.use({ serviceWorkers: 'allow' })`. While blocked, `navigator.serviceWorker.register` resolves to `undefined` and `navigator.serviceWorker.ready` never settles. While allowed, `page.route` does not see the requests a worker makes.

- [ ] **Step 1: Write the failing server test** `tests/unit/serve.test.js`

The file makes a temp root holding `index.html` (`home`), `sub/index.html` (`sub`) and `a.wasm`, and starts `createServer({ root, base: '/Game-Dev-Resources/byways/' }).listen(0)` in `before`. `get(path)` sends a raw `http.get({ port, path })`, so the client does not normalise `..`, and resolves `{status, type, location, body}`.

```js
test('serves the base, MIME types and folder indexes', async () => {
  assert.deepEqual(await get('/Game-Dev-Resources/byways/'), { status: 200, type: 'text/html; charset=utf-8', location: undefined, body: 'home' });
  assert.equal((await get('/Game-Dev-Resources/byways/a.wasm')).type, 'application/wasm');
  assert.equal((await get('/Game-Dev-Resources/byways/sub/')).body, 'sub');
});
test('redirects the bare base and refuses everything else', async () => {
  const r = await get('/Game-Dev-Resources/byways'); assert.equal(r.status, 301); assert.equal(r.location, '/Game-Dev-Resources/byways/');
  assert.equal((await get('/other/')).status, 404);
  assert.equal((await get('/Game-Dev-Resources/byways/..%2f..%2fpackage.json')).status, 404);
  assert.equal((await get('/Game-Dev-Resources/byways/../../etc/passwd')).status, 404);
  assert.equal((await get('/Game-Dev-Resources/byways/missing.js')).status, 404);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/unit/serve.test.js`
Expected: FAIL with `Cannot find module` for `tools/serve.js`.

- [ ] **Step 3: Implement `tools/serve.js`**

Serve only paths under `base`, and redirect `base` without its slash. Decode the path, resolve it under `root`, and return 404 unless the result stays inside `root`. A folder serves its `index.html`. Send `Cache-Control: no-store`. MIME map: `.html` `text/html; charset=utf-8`, `.js`/`.mjs` `text/javascript; charset=utf-8`, `.css` `text/css; charset=utf-8`, `.json` `application/json`, `.webmanifest` `application/manifest+json`, `.svg` `image/svg+xml`, `.png` `image/png`, `.jpg` `image/jpeg`, `.gif` `image/gif`, `.webp` `image/webp`, `.ico` `image/x-icon`, `.wasm` `application/wasm`, `.woff2` `font/woff2`, `.txt` `text/plain; charset=utf-8`, `.xml` `application/xml`, `.zip` `application/zip`, and anything else `application/octet-stream`. The CLI listens on `--port` and logs `Serving <root> at http://localhost:<port><base>`. It starts only when the file is run directly (the Task 9 guard).

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/unit/serve.test.js`
Expected: PASS, 2 tests.

- [ ] **Step 5: Write `tests/e2e/playwright.config.js`**

```js
import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const appRoot = fileURLToPath(new URL('../..', import.meta.url));
const baseURL = 'http://localhost:4321/Game-Dev-Resources/byways/';
export default defineConfig({
  testDir: '.', testMatch: '**/*.spec.js', retries: 0, forbidOnly: !!process.env.CI, reporter: 'list',
  use: { baseURL, trace: 'off', serviceWorkers: 'block' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: { command: 'node tools/serve.js --root dist/pwa --base /Game-Dev-Resources/byways/ --port 4321', cwd: appRoot, url: baseURL, reuseExistingServer: !process.env.CI },
});
```

Service workers are blocked by default, because `page.route` cannot see requests a service worker makes. Only `sw.spec.js` (Task 15) allows them.

- [ ] **Step 6: Write the failing specs** `tests/e2e/harness.spec.js` and `tests/e2e/basics.spec.js`

`harness.spec.js` checks the helpers themselves, so it uses the plain Playwright `test`:

```js
import { test as base, expect } from '@playwright/test';
import { mockNet, unmocked, pageProblems } from './helpers/net.js';
import { installFakeSpeech } from './helpers/fakes.js';
import { expectNoSeriousA11y } from './helpers/axe.js';
base('mockNet serves fixtures, aborts the rest and lists them', async ({ page }) => {
  await mockNet(page); await page.goto('./');
  expect(await page.evaluate(() => fetch('https://example.test/ping').then(r => r.json()))).toEqual({ pong: true });
  expect(await page.evaluate(() => fetch('https://unmatched.test/x').then(() => 'ok', () => 'failed'))).toBe('failed');
  expect(unmocked(page)).toEqual(['https://unmatched.test/x']);
});
base('overrides win over routes.js', async ({ page }) => {
  await mockNet(page); await mockNet(page, { overrides: [{ match: /example\.test\/ping/, json: { pong: 'override' } }] });
  await page.goto('./');
  expect(await page.evaluate(() => fetch('https://example.test/ping').then(r => r.json()))).toEqual({ pong: 'override' });
});
base('pageProblems catches CSP violations', async ({ page }) => {
  await mockNet(page); await page.goto('./');
  await page.evaluate(() => document.body.setAttribute('style', 'color: red'));
  await expect.poll(() => pageProblems(page).join('\n')).toMatch(/Content Security Policy/);
});
base('pageProblems lists console errors and page errors unless ignored', async ({ page }) => {
  await mockNet(page); await page.goto('./');
  await page.evaluate(() => { console.error('boom'); setTimeout(() => { throw new Error('bang'); }); });
  await expect.poll(() => pageProblems(page)).toEqual(['console: boom', 'pageerror: bang']);
  expect(pageProblems(page, { ignore: [/boom/, /bang/] })).toEqual([]);
});
base('installFakeSpeech drives recognition, records speech and fakes the wake lock', async ({ page }) => {
  await mockNet(page); await installFakeSpeech(page); await page.goto('./');
  expect(await page.evaluate(() => new Promise(res => {
    const r = new webkitSpeechRecognition(); r.onresult = e => res([e.results[0][0].transcript, e.results[0].isFinal, e.resultIndex]);
    r.start(); window.__say('next please');
  }))).toEqual(['next please', true, 0]);
  expect(await page.evaluate(() => new Promise(res => {
    const u = new SpeechSynthesisUtterance('Hello'); u.onend = () => res(window.__spoken); speechSynthesis.speak(u);
  }))).toEqual(['Hello']);
  expect(await page.evaluate(async () => {
    const s = await navigator.wakeLock.request('screen'); const held = { ...window.__wake }; await s.release();
    return [held, { ...window.__wake }, s.released];
  })).toEqual([{ requests: 1, releases: 0 }, { requests: 1, releases: 1 }, true]);
});
base('expectNoSeriousA11y passes the bare shell and catches an unnamed button', async ({ page }) => {
  await mockNet(page); await page.goto('./'); await expectNoSeriousA11y(page);
  await page.evaluate(() => document.body.append(document.createElement('button')));
  await expect(expectNoSeriousA11y(page)).rejects.toThrow(/button-name/);
});
```

`basics.spec.js` makes the first browser checks of Task 9's CSS and Task 2's DOMParser branch, through the fixture `test`:

```js
import { test, expect } from './helpers/net.js';
import { expectNoSeriousA11y } from './helpers/axe.js';
test.beforeEach(async ({ page }) => { await page.goto('./'); });
test('nav links are at least 56 px and show a 3 px focus ring', async ({ page }) => {
  for (const link of await page.getByRole('navigation', { name: 'Main' }).getByRole('link').all())
    expect((await link.boundingBox()).height).toBeGreaterThanOrEqual(56);
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  expect(await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return [s.outlineStyle, s.outlineWidth]; })).toEqual(['solid', '3px']);
});
test('the in-app motion setting overrides the OS preference', async ({ page }) => {
  const duration = m => page.evaluate(m => {
    document.documentElement.dataset.motion = m; const el = document.createElement('div'); el.style.setProperty('transition', 'opacity 1s');
    document.body.append(el); const d = getComputedStyle(el).transitionDuration; el.remove(); return d;
  }, m);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect([await duration('system'), await duration('full'), await duration('reduced')]).toEqual(['0s', '1s', '0s']);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  expect([await duration('system'), await duration('reduced')]).toEqual(['1s', '0s']);
});
test('text scale 2 doubles the root font size', async ({ page }) => {
  expect(await page.evaluate(() => { document.documentElement.style.setProperty('--text-scale', '2'); return getComputedStyle(document.documentElement).fontSize; })).toBe('32px');
});
test('axe passes in the light, dark and high-contrast themes', async ({ page }) => {
  for (const theme of ['light', 'dark', 'high-contrast']) {
    await page.evaluate(t => { document.documentElement.dataset.theme = t; }, theme); await expectNoSeriousA11y(page);
  }
});
test('toPlainText gives the same text with DOMParser', async ({ page }) => {
  expect(await page.evaluate(async () => {
    const { toPlainText } = await import(new URL('core/util/text.js', document.baseURI).href);
    return ['<p>Fish &amp; <b>chips</b></p>', 'a<br>b<p>c</p>', '<p>One.</p><p>Two.</p>', 'un<b>believ</b>able', '<script>alert(1)</script><style>p{}</style>ok'].map(toPlainText);
  })).toEqual(['Fish & chips', 'a b c', 'One. Two.', 'unbelievable', 'ok']);
});
test.describe('with ignoreProblems', () => {
  test.use({ ignoreProblems: [/boom/] });
  test('a matching console error does not fail the test', async ({ page }) => { await page.evaluate(() => console.error('boom')); });
});
```

`el.style.setProperty` is CSSOM, which the CSP allows; only `style` attributes and `<style>` blocks are blocked.

- [ ] **Step 7: Run them and see them fail**

Run: `npm run build`, then `npx playwright test -c tests/e2e/playwright.config.js tests/e2e/harness.spec.js tests/e2e/basics.spec.js`
Expected: FAIL with `Cannot find module` for `./helpers/net.js`.

- [ ] **Step 8: Implement the helpers**

`net.js`: per page, keep `{unmocked: [], problems: []}` in a `WeakMap`. The first `mockNet` call adds a `console` listener (push `console: <text>` for every message of type `error`; Chromium reports CSP violations and failed loads this way) and a `pageerror` listener (push `pageerror: <message>`). It also adds a `page.route` for every http(s) URL whose host is not `localhost:4321`: fulfil from the first matching `tests/fixtures/routes.js` entry, or else record the URL and `route.abort('blockedbyclient')`. A call with `overrides` adds another route that fulfils a matching override or calls `route.fallback()`. Playwright runs the newest route first. Fulfil `OPTIONS` with 204. Every fulfilled response gets `access-control-allow-origin: *`, `access-control-allow-headers: *` and `access-control-allow-methods: *`, because the browser still applies CORS to mocked cross-origin responses. The content type comes from the file extension (`.json` `application/json`, `.xml` `application/xml`, `.html` `text/html`, `.txt` `text/plain`, otherwise `application/octet-stream`) or `application/json` for `json`. Entry `headers` override all of these. `pageProblems` filters the page's list through `ignore`. `test` is `base.extend({ ignoreProblems: [[], { option: true }], page })`, where the `page` fixture runs `mockNet(page)`, hands the page to the test, then expects `unmocked(page)` and `pageProblems(page, {ignore: ignoreProblems})` to equal `[]`.

`routes.js`: `export default [{ match: /^https:\/\/example\.test\/ping$/, file: 'ping.json' }];`. Later plans append entries.

`fakes.js`: `installFakeSpeech(page)` calls `page.addInitScript` once to define:
- `SpeechRecognition` and `webkitSpeechRecognition`: one `EventTarget` class with `lang`, `continuous`, `interimResults`, `maxAlternatives` and `on<event>` properties. `start()` throws `InvalidStateError` when already started and fires `start`; `stop()` and `abort()` fire `end`. `window.__say(text, final = true)` fires `result` on every started recogniser with `{resultIndex: 0, results}`, where `results[0]` is `[{transcript: text, confidence: 0.9}]` with `isFinal`. `window.__voiceError(code)` fires `error` `{error: code}` then `end` on every started recogniser. `window.__recognizers` lists instances.
- `SpeechSynthesisUtterance`: an `EventTarget` class with `text`, `voice`, `rate`, `volume`, `pitch`, `lang` and `on<event>` properties.
- `speechSynthesis` (through `Object.defineProperty` on `window`): it queues utterances and pushes each `text` to `window.__spoken` when it starts. It fires `start` and then `end`, each on a later microtask, so `page.clock` does not hold speech back. `cancel()` fires `error` with `interrupted` on the utterance being spoken and `canceled` on each queued one, then empties the queue. It has `speaking`, `pending`, `paused`, `pause()` and `resume()`, and `getVoices()` returns `Local English` (`voiceURI: 'local-en'`, `localService: true`, `default: true`) and `Online English` (`'net-en'`, `localService: false`), both `en-US`.
- `navigator.wakeLock.request(type)` resolves to an `EventTarget` sentinel with `type`, `released` and `release()`. `window.__wake = {requests, releases}` counts the calls.

Plan 03 adds its options (such as the on-device availability methods) to this same fake.

`axe.js`: run `new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])`, applying `exclude` selectors, and then `expect` the list of `"<id>: <targets>"` for violations with impact `serious` or `critical` to equal `[]`.

- [ ] **Step 9: Run them and see them pass**

Run: `npx playwright test -c tests/e2e/playwright.config.js tests/e2e/harness.spec.js tests/e2e/basics.spec.js`
Expected: PASS, 12 tests.

- [ ] **Step 10: Commit**

```bash
git add tools/serve.js tests/unit/serve.test.js tests/e2e/playwright.config.js tests/e2e/helpers tests/fixtures/routes.js tests/fixtures/http/ping.json tests/e2e/harness.spec.js tests/e2e/basics.spec.js
git commit -m "Add the test server and the Playwright harness with network mocks, speech fakes and axe"
```

### Task 11: DOM builder, live regions, theme and toasts

**Files:**
- Create: `src/ui/dom.js`, `src/ui/a11y.js`, `src/ui/theme.js`, `src/ui/toast.js`
- Test: `tests/unit/theme.test.js`, `tests/e2e/dom.spec.js`

**Interfaces:**
- Consumes: `test`, `expect` (Task 10).
- Produces: `h(tag, props?, ...children) → HTMLElement`, `clear(el)`; `announce(text, {assertive = false} = {})`, `focusMain()`; `applyAccessSettings(settings, root = document.documentElement)`; `showToast(message, {undo, ms = 5000, action} = {}) → {close()}`, where `action = {label, run}`. A toast with `ms: 0` is sticky: it stays until its button runs or `close()` is called, and later toasts do not replace it.

In e2e specs, page modules are loaded with `await import(new URL('ui/dom.js', document.baseURI).href)` inside `page.evaluate`. This gives the same module instance the app uses.

- [ ] **Step 1: Write the failing tests**

`tests/unit/theme.test.js`:

```js
test('applyAccessSettings sets data attributes and the text scale', () => {
  const root = { dataset: {}, style: { props: {}, setProperty(k, v) { this.props[k] = v; } } };
  applyAccessSettings({ theme: 'high-contrast', font: 'atkinson', motion: 'reduced', textScale: 1.5 }, root);
  assert.deepEqual({ ...root.dataset }, { theme: 'high-contrast', font: 'atkinson', motion: 'reduced' });
  assert.equal(root.style.props['--text-scale'], '1.5');
  applyAccessSettings({ theme: 'neon', font: 'comic', motion: 'wild', textScale: 5 }, root);
  assert.deepEqual({ ...root.dataset }, { theme: 'system', font: 'system', motion: 'system' });
  assert.equal(root.style.props['--text-scale'], '2');
});
```

`tests/e2e/dom.spec.js` (imports `test`, `expect` from `./helpers/net.js`; each test starts with `await page.goto('./')`):

```js
test('h sets text, attributes and handlers without parsing HTML', async ({ page }) => {
  expect(await page.evaluate(async () => {
    const { h } = await import(new URL('ui/dom.js', document.baseURI).href); let clicks = 0;
    const el = h('button', { class: 'big', text: '<b>hi</b>', 'aria-label': 'Say hi', 'data-id': '7', type: 'button', onClick: () => clicks++ });
    el.click(); const div = h('div', null, 'a', h('span', { text: 'b' }), null, false, ['c', 'd']);
    return [el.className, el.textContent, el.children.length, el.getAttribute('aria-label'), el.dataset.id, clicks, div.textContent, div.childNodes.length];
  })).toEqual(['big', '<b>hi</b>', 0, 'Say hi', '7', 1, 'abcd', 4]);
});
test('h writes aria-* and data-* booleans as text and toggles other boolean attributes', async ({ page }) => {
  expect(await page.evaluate(async () => {
    const { h } = await import(new URL('ui/dom.js', document.baseURI).href);
    const b = h('button', { 'aria-pressed': false, 'aria-expanded': true, 'data-on': false, disabled: true, hidden: false });
    return [b.getAttribute('aria-pressed'), b.getAttribute('aria-expanded'), b.getAttribute('data-on'), b.disabled, b.hasAttribute('hidden')];
  })).toEqual(['false', 'true', 'false', true, false]);
});
test('h drops unsafe link schemes', async ({ page }) => {
  expect(await page.evaluate(async () => {
    const { h } = await import(new URL('ui/dom.js', document.baseURI).href);
    const bad = ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', ' javascript:alert(1)', 'java\tscript:alert(1)', 'data:text/html,<b>x</b>', 'vbscript:x', 'blob:https://evil.example/x']
      .map(u => h('a', { href: u }).hasAttribute('href'));
    return [...bad, h('a', { href: 'https://x.org/' }).getAttribute('href'), h('a', { href: '#/feed' }).hasAttribute('href'),
      h('a', { href: `blob:${location.origin}/x` }).hasAttribute('href'),
      h('img', { src: 'data:image/png;base64,AA' }).hasAttribute('src'), h('iframe', { src: 'data:text/html,x' }).hasAttribute('src')];
  })).toEqual([false, false, false, false, false, false, false, 'https://x.org/', true, true, true, false]);
});
test('h refuses a style prop', async ({ page }) => {
  expect(await page.evaluate(async () => {
    const { h } = await import(new URL('ui/dom.js', document.baseURI).href);
    try { h('div', { style: 'color:red' }); return 'allowed'; } catch (e) { return e.message; }
  })).toBe('h: style is blocked by the CSP; use a class');
});
test('announce writes the polite or the assertive region', async ({ page }) => {
  await page.evaluate(async () => { const { announce } = await import(new URL('ui/a11y.js', document.baseURI).href);
    announce('Saved'); announce('Microphone blocked', { assertive: true }); });
  await expect(page.locator('#live-polite')).toHaveText('Saved');
  await expect(page.locator('#live-assertive')).toHaveText('Microphone blocked');
});
test('showToast offers Undo for 5 seconds, announces politely and keeps a sticky toast', async ({ page }) => {
  await page.clock.install(); await page.goto('./');
  await page.evaluate(async () => { const { showToast } = await import(new URL('ui/toast.js', document.baseURI).href);
    showToast('Saved', { undo: async () => { window.__undone = true; } }); });
  await expect(page.locator('#toasts')).toContainText('Saved'); await expect(page.locator('#live-polite')).toHaveText('Saved');
  await page.getByRole('button', { name: 'Undo' }).click();
  expect(await page.evaluate(() => window.__undone)).toBe(true); await expect(page.locator('#toasts')).toBeEmpty();
  await page.evaluate(async () => (await import(new URL('ui/toast.js', document.baseURI).href)).showToast('Liked'));
  await page.clock.runFor(5000); await expect(page.locator('#toasts')).toBeEmpty();
  await page.evaluate(async () => (await import(new URL('ui/toast.js', document.baseURI).href)).showToast('Update available, reload', { ms: 0, action: { label: 'Reload', run: () => {} } }));
  await page.clock.runFor(60000); await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible();
  await page.evaluate(async () => (await import(new URL('ui/toast.js', document.baseURI).href)).showToast('Liked'));
  await expect(page.locator('#toasts')).toContainText('Liked'); await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible();
  await page.clock.runFor(5000); await expect(page.locator('#toasts')).not.toContainText('Liked');
  await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible();
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `node --test tests/unit/theme.test.js`, then `npm run build` and `npx playwright test -c tests/e2e/playwright.config.js tests/e2e/dom.spec.js`
Expected: FAIL with `Cannot find module` (unit), and every e2e test fails on its dynamic import of `ui/dom.js`, `ui/a11y.js` or `ui/toast.js`.

- [ ] **Step 3: Implement `dom.js` and `a11y.js`**

`h`: props `class` → `className`; `text` → `textContent`; `on<Event>` → `addEventListener(lowercased event, fn)`; `style` → throw `Error('h: style is blocked by the CSP; use a class')`. For `aria-*` and `data-*` props, a boolean is written as `String(value)`, so `{'aria-pressed': false}` gives `aria-pressed="false"` (an empty `aria-pressed` reads as not pressed). For other props, `null`, `undefined` and `false` skip the attribute, `true` sets it empty, and anything else uses `setAttribute`. For `href`, `src`, `action`, `formaction` and `poster`, it removes ASCII whitespace and control characters, resolves the value against `document.baseURI`, and sets it only when the result has the page's origin (which covers the page's own `blob:` URLs), uses `http:` or `https:`, or is `data:` on an `img`. Otherwise it skips the attribute and calls `console.warn('h: dropped unsafe URL')`. Children: arrays flatten, strings and numbers become text nodes, and `null`/`false` are skipped. `announce` sets the region's `textContent` to `''`, then sets `text` 50 ms later, so a repeated message is spoken again. `focusMain` calls `document.getElementById('main').focus()`.

- [ ] **Step 4: Implement `theme.js` and `toast.js`**

`applyAccessSettings`: `theme` in `system|light|dark|high-contrast`, `font` in `system|atkinson` and `motion` in `system|reduced|full`, where any other value gives `'system'`. It sets `--text-scale` to `String(clamp(textScale, 1, 2))`. `showToast` adds a `div.toast` to `#toasts` that holds the message, then an **Undo** button when `undo` is given and an `action.label` button when `action` is given, and calls `announce(message)`. Undo awaits `undo()` and closes; the action button calls `run()` and closes. A toast with `ms: 0` is sticky and replaces only an earlier sticky toast. Any other toast replaces the open non-sticky toast, leaves a sticky one in place, and closes after `ms`. Never pass `Infinity` to `setTimeout`, because it fires at once.

- [ ] **Step 5: Run them and see them pass**

Run: `node --test tests/unit/theme.test.js`, then `npm run build` and `npx playwright test -c tests/e2e/playwright.config.js tests/e2e/dom.spec.js`
Expected: PASS, 1 unit test and 6 e2e tests.

- [ ] **Step 6: Commit**

```bash
git add src/ui/dom.js src/ui/a11y.js src/ui/theme.js src/ui/toast.js tests/unit/theme.test.js tests/e2e/dom.spec.js
git commit -m "Add the DOM builder, live regions, access attributes and toasts"
```

### Task 12: Hash router

**Files:**
- Create: `src/ui/router.js`
- Test: `tests/unit/router.test.js`

**Interfaces:**
- Consumes: `flush` (Task 3, tests).
- Produces: `ROUTES`, `registerView(route, {title, render(container, app, params), leave?})` (a later registration for the same route replaces the earlier one; an unknown route throws `Error('unknown route: <route>')`), `getView(route) → view|undefined`, `parseHash(hash) → {route, params}`, `buildHash(route, params = {}) → string`, `startRouter(render, win = globalThis)`, `navigate(route, params = {})`. `params` is `{id?: string}` for `#/<route>/<id>` (a Daily Fate date or a settings section id) and `{payload: string}` for `#s=<payload>`. `startRouter` also handles the cancelable window event `byways:back` that Plan 08 dispatches: when no listener calls `preventDefault()` and the hash is not the home view (`''`, `'#'`, `'#/'` or `'#/stumble'`), it calls `history.back()`.

- [ ] **Step 1: Write the failing test** `tests/unit/router.test.js`

The file imports `flush` from `./helpers/async.js` and fakes a window with `const fakeWin = hash => Object.assign(new EventTarget(), { location: { hash }, history: { backs: 0, back() { this.backs++; } } });`.

```js
test('parseHash reads the hash forms', () => {
  for (const h of ['', '#', '#/']) assert.deepEqual(parseHash(h), { route: 'stumble', params: {} });
  assert.deepEqual(parseHash('#/feed'), { route: 'feed', params: {} });
  assert.deepEqual(parseHash('#/FEED'), { route: 'feed', params: {} });
  assert.deepEqual(parseHash('#/daily/2026-11-11'), { route: 'daily', params: { id: '2026-11-11' } });
  assert.deepEqual(parseHash('#/settings/a%20b'), { route: 'settings', params: { id: 'a b' } });
  assert.deepEqual(parseHash('#s=abc-_'), { route: 'import', params: { payload: 'abc-_' } });
  assert.deepEqual(parseHash('#/nope'), { route: 'stumble', params: {} });
});
test('parseHash never throws on malformed input', () => {
  for (const h of ['#/daily/%E0%A4%A', '#%', '#/%', '#s=', '#s=%%%', '#/__proto__', '#/constructor/x', null, undefined, '#/' + 'x'.repeat(100000)]) {
    const r = parseHash(h); assert.ok(ROUTES.includes(r.route), String(h).slice(0, 20));
  }
  assert.deepEqual(parseHash('#/daily/%E0%A4%A'), { route: 'daily', params: {} });
  assert.deepEqual(parseHash('#s='), { route: 'stumble', params: {} });
});
test('buildHash writes the hash forms', () => {
  assert.equal(buildHash('stumble'), '#/stumble');
  assert.equal(buildHash('daily', { id: '2026-11-11' }), '#/daily/2026-11-11');
  assert.equal(buildHash('settings', { id: 'a b' }), '#/settings/a%20b');
  assert.equal(buildHash('import', { payload: 'xyz' }), '#s=xyz');
  assert.throws(() => buildHash('nope'), /unknown route: nope/);
});
test('registerView replaces an earlier view and refuses unknown routes', () => {
  const a = { title: 'A', render() {} }, b = { title: 'B', render() {} };
  registerView('vault', a); registerView('vault', b); assert.equal(getView('vault'), b);
  assert.throws(() => registerView('nope', a), /unknown route: nope/); assert.equal(getView('nope'), undefined);
});
test('startRouter renders now and on hashchange; navigate re-renders an unchanged hash', () => {
  const win = fakeWin('#/feed'); const seen = []; startRouter((route, params) => seen.push([route, params]), win);
  win.location.hash = '#/daily/2026-11-11'; win.dispatchEvent(new Event('hashchange'));
  navigate('daily', { id: '2026-11-11' }); navigate('vault');
  assert.deepEqual(seen, [['feed', {}], ['daily', { id: '2026-11-11' }], ['daily', { id: '2026-11-11' }]]);
  assert.equal(win.location.hash, '#/vault');
});
test('byways:back goes back unless a listener cancels it or the view is home', async () => {
  const win = fakeWin('#/feed'); startRouter(() => {}, win);
  const back = () => win.dispatchEvent(new CustomEvent('byways:back', { cancelable: true }));
  back(); await flush(); assert.equal(win.history.backs, 1);
  const cancel = e => e.preventDefault(); win.addEventListener('byways:back', cancel);
  back(); await flush(); assert.equal(win.history.backs, 1);
  win.removeEventListener('byways:back', cancel); win.location.hash = '#/stumble';
  back(); await flush(); assert.equal(win.history.backs, 1);
});
```

The fake `location` fires no `hashchange` of its own, so `navigate('vault')` only changes the hash here.

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/unit/router.test.js`
Expected: FAIL with `Cannot find module` for `src/ui/router.js`.

- [ ] **Step 3: Implement `src/ui/router.js`**

`parseHash`: `#s=<payload>` with a non-empty payload gives `import`. Otherwise it splits `#/route/id`, lower-cases `route` and keeps it only when `ROUTES.includes(route)`; anything else gives `stumble` with no params. It decodes `id` with `decodeURIComponent` inside try/catch, drops the id when decoding fails, and ignores later segments. `buildHash` encodes `id` with `encodeURIComponent`. `startRouter(render, win)` keeps `win` for `navigate`, calls `render(route, params)` for `parseHash(win.location.hash)` at once and on each `hashchange`, and listens for `byways:back`. That listener reads `event.defaultPrevented` on a microtask (`queueMicrotask`), after every listener has run, because panels add their listeners after the router. `navigate` sets `win.location.hash`, and calls `render` directly when the hash is unchanged. The module touches no global at import.

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/unit/router.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/ui/router.js tests/unit/router.test.js
git commit -m "Add the hash router"
```

### Task 13: Boot, views and the About section

**Files:**
- Create: `src/ui/views/index.js`, `src/ui/views/settings/index.js`, `src/ui/views/settings/about.js`, `tests/e2e/helpers/app.js`
- Modify: `src/ui/boot.js` (replace the Task 9 stub)
- Test: `tests/unit/boot-data.test.js`, `tests/e2e/shell.spec.js`

**Interfaces:**
- Consumes: `mulberry32(seed)`, `APP_VERSION` (Task 1); `realClock` (Task 3); `createHttp({transport, clock})` (Task 4); `openStore(backend)`, `idbBackend()`, `memoryBackend()` (Task 5); `loadSettings(store)`, `saveSettings(store, patch)` (Task 6); `createPwaPlatform({secretsStore})`, `registerServiceWorker(win, onUpdate)` (Task 7); `test`, `expect` (Task 10); `h(tag, props, ...children)`, `clear(el)`, `announce(text, opts)`, `focusMain()`, `applyAccessSettings(settings, root)` (Task 11); `registerView`, `getView(route)`, `startRouter(render)` (Task 12).
- Produces:
  - `views/settings/index.js`: `registerSettingsSection({id, label, order, render(container, app)})` (a later registration with the same id replaces the earlier one) and `listSettingsSections() → Array`, sorted by `order`. It registers the `settings` view.
  - `views/settings/about.js`: the `about` section (`order: 90`, label `About`) with the version, the build id and links. Plan 08 adds its update check to this file.
  - `views/index.js`: imports `./settings/index.js` and `./settings/about.js`, then registers a placeholder for each of `stumble feed daily vault saved import` that has no view yet. Later plans add their import lines above the placeholders.
  - `boot.js`: `DATA_FILES = {tags: 'tags.json', library: 'library.json', vaultStarter: 'vault-starter.json', geocities: 'geocities-seeds.json'}`, `EMPTY_DATA` (the empty shapes from Task 9), `loadData(fetchFn, baseUrl) → Promise<object>`, `dataUrlFor(platformName, file) → string`, `STORAGE_OFF_MESSAGE = 'Storage is blocked in this browser. Nothing you save will be kept.'`, `VIEW_FAILED_MESSAGE = 'This view failed to load.'`, `boot(platform) → Promise<App>` with the Plan 01 `App` fields (`store, settings, getSettings, saveSettings, http, clock, rand, platform, data, dataUrl`), and `bootFromShell()`. Plans 07 and 08 add their shells' branches to `bootFromShell`.
  - The routed page: `#app` holds one `div.view`, with the view's `title` as its `h1` and then `div.view-body`, the container passed to `render`. A view never renders an `h1`; one that must change its heading text sets `container.closest('.view').querySelector('h1').textContent`.
  - `tests/e2e/helpers/app.js`: `skipFirstRun(page) → Promise<void>` and `gotoApp(page, hash = '#/stumble') → Promise<void>`.

View titles: `stumble` "Stumble", `feed` "Feed", `daily` "Daily Fate", `vault` "Vault", `saved` "Saved", `settings` "Settings", `import` "Import". A placeholder renders the paragraph "Nothing here yet.".

- [ ] **Step 1: Write the failing unit test** `tests/unit/boot-data.test.js`

```js
test('loadData falls back to empty shapes for missing or broken files', async () => {
  const fetchFn = async url => {
    if (url.endsWith('/data/tags.json')) return Response.json({ v: 1, groups: [{ id: 'g', label: 'G', tags: [] }] });
    if (url.endsWith('/data/library.json')) return new Response('nope', { status: 404 });
    if (url.endsWith('/data/vault-starter.json')) throw new TypeError('offline');
    return new Response('{not json');
  };
  const data = await loadData(fetchFn, 'http://localhost:4321/Game-Dev-Resources/byways/');
  assert.equal(data.tags.groups[0].id, 'g');
  assert.deepEqual([data.library, data.vaultStarter, data.geocities], [EMPTY_DATA.library, EMPTY_DATA.vaultStarter, EMPTY_DATA.geocities]);
  assert.notEqual(data.library, EMPTY_DATA.library);
});
test('dataUrlFor is relative in the PWA and the Pages URL elsewhere', () => {
  assert.equal(dataUrlFor('pwa', 'daily.json'), 'data/daily.json');
  for (const p of ['extension', 'android'])
    assert.equal(dataUrlFor(p, 'itch.json'), 'https://iteatsthesalt.github.io/Game-Dev-Resources/byways/data/itch.json');
});
```

- [ ] **Step 2: Write the failing e2e spec** `tests/e2e/shell.spec.js`

```js
import { test, expect } from './helpers/net.js';
import { gotoApp } from './helpers/app.js';
import { APP_VERSION } from '../../src/core/version.js';
test('routes between the registered views', async ({ page }) => {
  await gotoApp(page); const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(page.getByRole('heading', { level: 1, name: 'Stumble' })).toBeVisible();
  for (const label of ['Feed', 'Daily Fate', 'Vault', 'Saved', 'Settings']) {
    await nav.getByRole('link', { name: label }).click();
    await expect(page.getByRole('heading', { level: 1, name: label })).toBeVisible();
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page).toHaveTitle(`${label} · Byways`);
    await expect(nav.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page');
  }
  await expect(page.locator('#main')).toBeFocused();
});
test('unknown hashes land on Stumble', async ({ page }) => {
  await gotoApp(page, '#/nope'); await expect(page.getByRole('heading', { level: 1, name: 'Stumble' })).toBeVisible();
});
test('settings list their sections in order and route to them', async ({ page }) => {
  await gotoApp(page, '#/settings');
  await page.evaluate(async () => {
    const s = await import(new URL('ui/views/settings/index.js', document.baseURI).href);
    s.registerSettingsSection({ id: 'test', label: 'Test section', order: 5, render: c => c.append('hello') });
    location.hash = '#/feed'; location.hash = '#/settings';
  });
  await expect(page.locator('#app .view-body a')).toHaveText(['Test section', 'About']);
  await page.getByRole('link', { name: 'Test section' }).click();
  await expect(page).toHaveURL(/#\/settings\/test$/);
  await expect(page.getByRole('heading', { level: 2, name: 'Test section' })).toBeVisible();
  await expect(page.locator('#app')).toContainText('hello');
  await expect(page.getByRole('link', { name: 'All settings' })).toHaveAttribute('href', '#/settings');
});
test('About shows the version, the build and the links', async ({ page }) => {
  const { id } = await (await page.request.get('build.json')).json();
  await gotoApp(page, '#/settings/about');
  await expect(page.getByText(`Version ${APP_VERSION}`, { exact: true })).toBeVisible();
  await expect(page.getByText(`Build ${id}`, { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Source code' })).toHaveAttribute('href', 'https://github.com/iteatsthesalt/Game-Dev-Resources');
  await expect(page.getByRole('link', { name: 'Byways web app' })).toHaveAttribute('href', 'https://iteatsthesalt.github.io/Game-Dev-Resources/byways/');
});
test('a view that throws leaves the shell working', async ({ page }) => {
  await gotoApp(page);
  await page.evaluate(async () => {
    const r = await import(new URL('ui/router.js', document.baseURI).href);
    r.registerView('vault', { title: 'Vault', render() { throw new Error('boom'); } }); r.navigate('vault');
  });
  await expect(page.getByRole('heading', { level: 1, name: 'Vault' })).toBeVisible();
  await expect(page.locator('#app')).toContainText('This view failed to load.');
  await expect(page.locator('#live-assertive')).toHaveText('This view failed to load.');
  await page.getByRole('link', { name: 'Feed' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Feed' })).toBeVisible();
});
test('boots on a memory store when IndexedDB is blocked', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'indexedDB', { get() { throw new DOMException('blocked', 'SecurityError'); } }));
  await gotoApp(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Stumble' })).toBeVisible();
  await expect(page.locator('#live-assertive')).toHaveText('Storage is blocked in this browser. Nothing you save will be kept.');
});
```

CI builds with `GITHUB_SHA` as the build id, so the About test reads the id from `build.json` instead of expecting `dev`.

- [ ] **Step 3: Run them and see them fail**

Run: `node --test tests/unit/boot-data.test.js`
Expected: FAIL with `SyntaxError: The requested module '../../src/ui/boot.js' does not provide an export named …`, because `boot.js` is still the Task 9 stub.
Run: `npm run build`, then `npx playwright test -c tests/e2e/playwright.config.js tests/e2e/shell.spec.js`
Expected: FAIL with `Cannot find module` for `./helpers/app.js`.

- [ ] **Step 4: Implement the settings registry, the About section and `views/index.js`**

The settings view's `render(container, app, params)`: with no matching `params.id`, it lists one link per section, `#/settings/<id>` labelled with its `label`, in `order`. For a matching id it renders an `h2` with the section's label, an **All settings** link to `#/settings`, and a `div` that it passes to `await section.render(div, app)`.

`about.js` registers `{id: 'about', label: 'About', order: 90, render}`. `render` appends the paragraph `Version <APP_VERSION>`. Next comes the paragraph `Build <id>`, with `id` read from `build.json` through `app.platform.transport.fetch(new URL('build.json', document.baseURI).href)`, or `Build unknown` on any failure. Last is a list of two links: **Source code** to `https://github.com/iteatsthesalt/Game-Dev-Resources` and **Byways web app** to `https://iteatsthesalt.github.io/Game-Dev-Resources/byways/`.

`views/index.js` imports `./settings/index.js` and `./settings/about.js`, then registers each placeholder whose route `getView` does not know yet.

- [ ] **Step 5: Implement `boot.js`**

`loadData` fetches `new URL('data/' + file, baseUrl).href` for each `DATA_FILES` entry in parallel. A failed fetch, a non-ok status or bad JSON gives `structuredClone(EMPTY_DATA[key])`. `dataUrlFor('pwa', file)` is `'data/' + file`. For any other platform it is `'https://iteatsthesalt.github.io/Game-Dev-Resources/byways/data/' + file`, because those builds hold no generated data files.

`boot(platform)`:
1. Opens `openStore(idbBackend())`. If that rejects, it opens `openStore(memoryBackend())` and, after step 7, calls `announce(STORAGE_OFF_MESSAGE, {assertive: true})`.
2. Loads settings and calls `applyAccessSettings`.
3. Builds `clock = realClock`, `rand = mulberry32(crypto.getRandomValues(new Uint32Array(1))[0])`, `http = createHttp({transport: platform.transport, clock})` and `data = await loadData(platform.transport.fetch, document.baseURI)`.
4. Makes `app = {store, settings, getSettings, saveSettings, http, clock, rand, platform, data, dataUrl}`, where `dataUrl = file => dataUrlFor(platform.name, file)`. `app.saveSettings(patch)` calls the core `saveSettings`, copies the result onto the live `settings` object, and re-applies access settings.
5. Wires the `.skip-link` click to `preventDefault()` and `focusMain()`.
6. Awaits `runFirstRun(app)` (Task 14; until then, skip this step).
7. Calls `startRouter(show)`.
8. Awaits `platform.attach?.(app)` (only Plan 08's Android platform has one), then returns `app`.

`show(route, params)` calls the previous view's `leave?.()`. It replaces `#app`'s children with a fresh `div.view` holding an `h1` with the view's `title` and an empty `div.view-body`, so a slow render from an earlier route writes into a detached node. It sets `document.title` to `<title> · Byways`, and `aria-current="page"` on the matching `nav a[href="#/<route>"]` (removing it from the others). It awaits `view.render(body, app, params)`. On a throw it logs the error with `console.warn`, empties the body, adds the paragraph `VIEW_FAILED_MESSAGE` and calls `announce(VIEW_FAILED_MESSAGE, {assertive: true})`. After the first render it calls `focusMain()` on each route change. `boot.js` imports `./views/index.js` for its side effects.

`bootFromShell()`: when `document.documentElement.dataset.shell === 'pwa'`, it opens a secrets store (IndexedDB, or memory on failure), awaits `boot(createPwaPlatform({secretsStore}))`, then calls `registerServiceWorker(window, onUpdate)` (Task 15 supplies `onUpdate`; until then pass `() => {}`). No rejection escapes it: a boot failure is logged with `console.error`, and a service worker failure with `console.warn`. The last line of the module is `if (globalThis.document?.documentElement?.dataset?.shell) bootFromShell();`.

- [ ] **Step 6: Write `tests/e2e/helpers/app.js`**

`skipFirstRun(page)` first waits until `[data-firstrun]` or `#app .view > h1` is visible, because boot is asynchronous and an earlier check could run before Welcome appears. Then, while a `[data-firstrun]` section is visible, it clicks that section's **Skip** button. `gotoApp(page, hash)` runs `page.goto('./' + hash)`, then `skipFirstRun(page)`, then waits for `#app .view > h1`, the routed view's heading, which the Welcome heading inside `section[data-firstrun]` cannot satisfy.

- [ ] **Step 7: Run them and see them pass**

Run: `node --test tests/unit/boot-data.test.js`
Expected: PASS, 2 tests.
Run: `npm run build`, then `npx playwright test -c tests/e2e/playwright.config.js tests/e2e/shell.spec.js`
Expected: PASS, 6 tests.

- [ ] **Step 8: Commit**

```bash
git add src/ui/views/index.js src/ui/views/settings/index.js src/ui/views/settings/about.js src/ui/boot.js tests/e2e/helpers/app.js tests/unit/boot-data.test.js tests/e2e/shell.spec.js
git commit -m "Add the app boot, the view registries and the About section"
```

### Task 14: First run and the Welcome step

**Files:**
- Create: `src/ui/firstrun.js`
- Modify: `src/ui/boot.js` (await `runFirstRun(app)` before `startRouter`)
- Test: `tests/e2e/firstrun.spec.js`

**Interfaces:**
- Consumes: `h`, `clear` (Task 11); `app.getSettings()`, `app.saveSettings(patch)` (Task 13); `test`, `expect` (Task 10) and `gotoApp` (Task 13).
- Produces: `registerFirstRunStep({id, order, render(container, app, done)})`, `runFirstRun(app) → Promise<void>`, `PRIVACY_PROMISE` = `'There is no Byways server. Your keys, collections and history are stored only on this device. Network calls go only to the sources and AI providers you turn on.'` (the §1 promise, verbatim). Each step renders inside `section[data-firstrun="<id>"]` in `#app`.

- [ ] **Step 1: Write the failing spec** `tests/e2e/firstrun.spec.js`

```js
const PRIVACY = 'There is no Byways server. Your keys, collections and history are stored only on this device. Network calls go only to the sources and AI providers you turn on.';
test('the first visit shows Welcome with the privacy promise, once', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1, name: 'Welcome to Byways' })).toBeVisible();
  await expect(page.getByText(PRIVACY, { exact: true })).toBeVisible();
  for (const name of ['Continue', 'Skip'])
    expect((await page.getByRole('button', { name }).boundingBox()).height).toBeGreaterThanOrEqual(56);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Stumble' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Stumble' })).toBeVisible();
  await expect(page.locator('[data-firstrun]')).toHaveCount(0);
});
test('steps run in order, Skip moves on, and a broken step is passed over', async ({ page }) => {
  await gotoApp(page);
  const done = page.evaluate(async () => {
    const f = await import(new URL('ui/firstrun.js', document.baseURI).href);
    f.registerFirstRunStep({ id: 'b', order: 18, render: (c, app, done) => c.append(Object.assign(document.createElement('button'), { textContent: 'Finish b', onclick: done })) });
    f.registerFirstRunStep({ id: 'boom', order: 15, render: () => { throw new Error('x'); } });
    f.registerFirstRunStep({ id: 'a', order: 12, render: c => c.append('Step a') });
    await f.runFirstRun({ getSettings: () => ({ firstRunDone: false }), saveSettings: async p => { window.__saved = p; } });
    return window.__saved;
  });
  await expect(page.locator('[data-firstrun="welcome"]')).toBeVisible();
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page.locator('[data-firstrun="a"]')).toContainText('Step a');
  await page.getByRole('button', { name: 'Skip' }).click();
  await page.getByRole('button', { name: 'Finish b' }).click();
  expect(await done).toEqual({ firstRunDone: true });
});
```

The spec imports `test`, `expect` from `./helpers/net.js` and `gotoApp` from `./helpers/app.js`. The test steps use orders 12, 15 and 18, so they sort after Welcome (10) without relying on a tie.

- [ ] **Step 2: Run it and see it fail**

Run: `npm run build`, then `npx playwright test -c tests/e2e/playwright.config.js tests/e2e/firstrun.spec.js`
Expected: FAIL: the "Welcome to Byways" heading is not found.

- [ ] **Step 3: Implement `src/ui/firstrun.js` and wire it into boot**

`runFirstRun(app)` returns at once when `app.getSettings().firstRunDone` is true. Otherwise it runs the steps sorted by `order`. For each step it clears `#app` and appends a `section` with `data-firstrun=<id>`. It calls `render(section, app, done)` and appends a **Skip** button. It moves on when `done()` is called or Skip is pressed; each acts once per step. A step whose `render` throws is passed over (logged with `console.warn`). After the last step it clears `#app` and awaits `app.saveSettings({firstRunDone: true})`. The module registers the Welcome step `{id: 'welcome', order: 10}`, which renders an `h1` "Welcome to Byways" (`tabindex="-1"`, focused on show), a paragraph with `PRIVACY_PROMISE`, and a **Continue** button that calls `done`. In `boot.js`, await `runFirstRun(app)` before `startRouter(show)`.

- [ ] **Step 4: Run it and see it pass**

Run: `npm run build`, then `npx playwright test -c tests/e2e/playwright.config.js tests/e2e/firstrun.spec.js tests/e2e/shell.spec.js`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/ui/firstrun.js src/ui/boot.js tests/e2e/firstrun.spec.js
git commit -m "Add the first-run registry with the Welcome step"
```

### Task 15: Service worker and the update toast

**Files:**
- Modify: `shells/pwa/sw.js` (add the handlers below the Task 9 constants)
- Modify: `src/ui/boot.js` (pass the real `onUpdate` to `registerServiceWorker`)
- Test: `tests/e2e/sw.spec.js`

**Interfaces:**
- Consumes: `registerServiceWorker` (Task 7), `showToast` (Task 11), the stamped `BUILD_ID` and `PRECACHE` (Task 9), `gotoApp` (Task 13).
- Produces: the cache name `byways-<id>`; the message `{type: 'skip-waiting'}`; `UPDATE_MESSAGE = 'Update available, reload'` in `boot.js`.

- [ ] **Step 1: Write the failing spec** `tests/e2e/sw.spec.js`

```js
test.use({ serviceWorkers: 'allow' });
const dist = f => fileURLToPath(new URL(`../../dist/pwa/${f}`, import.meta.url));
const swr = dist('data/swr-test.json'); const swFile = dist('sw.js');
test.afterAll(() => rmSync(swr, { force: true }));
async function controlled(page) {
  await gotoApp(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); await page.waitForFunction(() => !!navigator.serviceWorker.controller);
}
test('precaches the shell under byways-<build id>, same-origin only', async ({ page }) => {
  await controlled(page);
  const { id } = await (await page.request.get('build.json')).json();
  expect(await page.evaluate(async name => {
    const c = await caches.open(name); const same = (await c.keys()).every(r => new URL(r.url).origin === location.origin);
    return [await caches.keys(), !!(await c.match('./index.html')), !!(await c.match('./ui/boot.js')), same];
  }, `byways-${id}`)).toEqual([[`byways-${id}`], true, true, true]);
});
test('reloads offline from the cache', async ({ page, context }) => {
  await controlled(page); await context.setOffline(true); await page.reload();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Stumble' })).toBeVisible();
  await context.setOffline(false);
});
test('only the app URL gets the cached shell', async ({ page }) => {
  await controlled(page); await page.goto('build.json');
  expect(await page.evaluate(() => document.contentType)).toBe('application/json');
});
test('data files are stale-while-revalidate', async ({ page }) => {
  writeFileSync(swr, '{"n":1}'); await controlled(page);
  const get = () => page.evaluate(() => fetch('data/swr-test.json').then(r => r.json()));
  expect(await get()).toEqual({ n: 1 });
  await expect.poll(() => page.evaluate(async () => !!(await caches.match('data/swr-test.json')))).toBe(true);
  writeFileSync(swr, '{"n":2}');
  expect(await get()).toEqual({ n: 1 });
  await expect.poll(get).toEqual({ n: 2 });
});
test('a new build shows the update toast and Reload switches to it', async ({ page }) => {
  await controlled(page); const original = readFileSync(swFile, 'utf8');
  try {
    writeFileSync(swFile, original.replace(/const BUILD_ID = "[^"]*";/, 'const BUILD_ID = "next";'));
    await page.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r.update()));
    await expect(page.locator('#toasts')).toContainText('Update available, reload');
    await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Reload' }).click()]);
    expect(await page.evaluate(() => caches.keys())).toEqual(['byways-next']);
  } finally { writeFileSync(swFile, original); }
});
```

`page.route` cannot see service worker requests, so this spec makes only same-origin requests. The spec imports `readFileSync`, `rmSync` and `writeFileSync` from `node:fs`, `fileURLToPath` from `node:url`, `test`, `expect` from `./helpers/net.js` and `gotoApp` from `./helpers/app.js`. The SWR test waits for the first response to reach the cache, which the worker writes inside `waitUntil` after the page already has its answer; otherwise the second read can miss the cache. The update test restores `dist/pwa/sw.js`, so `--check` still finds the build fresh.

- [ ] **Step 2: Run it and see it fail**

Run: `npm run build`, then `npx playwright test -c tests/e2e/playwright.config.js tests/e2e/sw.spec.js`
Expected: FAIL: `caches.keys()` returns `[]`, because `sw.js` has no install handler yet.

- [ ] **Step 3: Implement the handlers in `shells/pwa/sw.js`**

- `install`: `event.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)))`. It does not call `skipWaiting`.
- `activate`: delete every cache whose name starts with `byways-` and is not `CACHE`, then `self.clients.claim()`.
- `message`: `{type: 'skip-waiting'}` calls `self.skipWaiting()`.
- `fetch`: ignore non-GET and cross-origin requests (no `respondWith`, so Archive thumbnails and source APIs are never cached). For a path matching `/\/data\/[^/]+\.json$/`, use stale-while-revalidate: answer from the cache when it has the file, otherwise from the network, and always fetch, putting ok responses in the cache inside `event.waitUntil`; a failed revalidation is caught, so offline use stays quiet. A navigation whose path is the scope path itself, or the scope path plus `index.html` (query and hash ignored), gets the cached `./index.html` (resolved against `self.registration.scope`), else the network. Everything else, other navigations included, uses the cache first, then the network: the Lab at `lab/` is a separate page in the same scope (§11.2) and must not get the app shell.

- [ ] **Step 4: Wire the update toast in `boot.js`**

`onUpdate(reg)` calls `showToast(UPDATE_MESSAGE, {ms: 0, action: {label: 'Reload', run}})`, which is sticky, so later Undo toasts do not hide it. `run` sets a `reloading` flag and posts `{type: 'skip-waiting'}` to `reg.waiting`. A `controllerchange` listener, added in `bootFromShell`, calls `location.reload()` only when `reloading` is set, because `clients.claim()` on a first install also fires `controllerchange`.

- [ ] **Step 5: Run it and see it pass**

Run: `npm run build`, then `npx playwright test -c tests/e2e/playwright.config.js tests/e2e/sw.spec.js`
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add shells/pwa/sw.js src/ui/boot.js tests/e2e/sw.spec.js
git commit -m "Add the offline service worker and the update toast"
```

### Task 16: CI and Pages workflows

**Files:**
- Create: `.github/workflows/byways.yml`, `.github/workflows/pages.yml` (repo root)
- Modify: `README.md` (the §17.5 one-time step)
- Test: `tests/unit/workflows.test.js`

**Interfaces:**
- Consumes: the npm scripts (Task 1), `tools/build.js --target pwa` (Task 9).
- Produces: the `web` job in `byways.yml` (Plan 08 adds an `android` job), and the `build` and `deploy` jobs in `pages.yml` (Plan 04 adds the schedule and the data step between the build and the assembly).

- [ ] **Step 1: Write the failing test** `tests/unit/workflows.test.js`

```js
const wf = name => readFileSync(new URL(`../../../../.github/workflows/${name}`, import.meta.url), 'utf8');
test('byways.yml runs the web job on Byways changes', () => {
  const y = wf('byways.yml');
  for (const s of ["paths: ['Apps/Byways/**', '.github/workflows/byways.yml']", 'runs-on: ubuntu-24.04', 'working-directory: Apps/Byways',
    'actions/checkout@v7', 'actions/setup-node@v4', 'node-version: 22', 'run: npm ci', 'run: npm test',
    'run: npx playwright install --with-deps chromium', 'run: npm run e2e', 'actions/upload-artifact@v7',
    'Apps/Byways/dist/chrome', 'Apps/Byways/dist/firefox']) assert.ok(y.includes(s), s);
  assert.equal((y.match(/paths:/g) || []).length, 2);
});
test('pages.yml builds, assembles _site and deploys', () => {
  const y = wf('pages.yml');
  for (const s of ['branches: [main]', 'workflow_dispatch:', 'contents: read', 'node tools/build.js --target pwa',
    'cp shells/pwa/landing/index.html "$RUNNER_TEMP/_site/index.html"', 'cp -R dist/pwa/. "$RUNNER_TEMP/_site/byways/"',
    'actions/configure-pages@v6', 'actions/upload-pages-artifact@v5', 'path: ${{ runner.temp }}/_site',
    'pages: write', 'id-token: write', 'name: github-pages', 'url: ${{ steps.deployment.outputs.page_url }}', 'group: pages', 'actions/deploy-pages@v5']) assert.ok(y.includes(s), s);
  assert.equal(y.includes('schedule:'), false);
  assert.doesNotMatch(y, /\{[^}\n]*\$\{\{/);
});
```

The last assertion catches `${{ … }}` inside a YAML flow mapping such as `{ name: x, url: ${{ … }} }`, where the braces are flow indicators and the file no longer parses. Step 5 also runs a real YAML parser over both files.

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/unit/workflows.test.js`
Expected: FAIL with `ENOENT` for `byways.yml`.

- [ ] **Step 3: Write `.github/workflows/byways.yml`**

`name: Byways`. On `push` and `pull_request`, each with `paths: ['Apps/Byways/**', '.github/workflows/byways.yml']`. Top-level `permissions: contents: read`. Job `web` on `ubuntu-24.04` with `defaults.run.working-directory: Apps/Byways` runs these steps: `actions/checkout@v7`; `actions/setup-node@v4` with `node-version: 22`, `cache: npm` and `cache-dependency-path: Apps/Byways/package-lock.json`; `run: npm ci`; `run: npm test`; `run: npx playwright install --with-deps chromium`; `run: npm run e2e`; then `actions/upload-artifact@v7` with `name: byways-extensions` and a multi-line `path` of `Apps/Byways/dist/chrome` and `Apps/Byways/dist/firefox`. Artifact paths are relative to the workspace, not to `working-directory`.

- [ ] **Step 4: Write `.github/workflows/pages.yml`**

`name: Pages`. Triggers are `push` with `branches: [main]` and `paths: ['Apps/Byways/**', '.github/workflows/pages.yml']`, plus `workflow_dispatch:`. Top-level `permissions: contents: read` and `concurrency: { group: pages, cancel-in-progress: false }`. Job `build` (`ubuntu-24.04`, working directory `Apps/Byways`) runs: checkout@v7; setup-node@v4 (22, npm cache); `npm ci`; `node tools/build.js --target pwa`; `mkdir -p "$RUNNER_TEMP/_site/byways"`; `cp shells/pwa/landing/index.html "$RUNNER_TEMP/_site/index.html"`; `cp -R dist/pwa/. "$RUNNER_TEMP/_site/byways/"`; `actions/configure-pages@v6`; and `actions/upload-pages-artifact@v5` with `path: ${{ runner.temp }}/_site`. Job `deploy` has `needs: build`, runs on `ubuntu-24.04`, and sets `permissions: { pages: write, id-token: write }`. Its `environment` is a block mapping, because `${{ … }}` cannot sit inside a flow mapping:

```yaml
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
```

Its one step is `id: deployment`, `uses: actions/deploy-pages@v5`.

Add to `README.md` the §17.5 one-time step, verbatim: "In **Settings → Pages → Build and deployment**, set **Source** to **GitHub Actions**."

- [ ] **Step 5: Run it and see it pass**

Run: `node --test tests/unit/workflows.test.js`
Expected: PASS, 2 tests.

Run: `npx --yes js-yaml@4.1.0 ../../.github/workflows/byways.yml > /dev/null && npx --yes js-yaml@4.1.0 ../../.github/workflows/pages.yml > /dev/null && echo ok`
Expected: `ok`. A parse error prints the line and column instead.

- [ ] **Step 6: Commit**

```bash
git add ../../.github/workflows/byways.yml ../../.github/workflows/pages.yml tests/unit/workflows.test.js README.md
git commit -m "Add the Byways CI and Pages deploy workflows"
```

### Task 17: End-to-end smoke test

**Files:**
- Test: `tests/e2e/smoke.spec.js`
- Modify (only if axe flags colour contrast): `src/ui/styles/app.css`, `src/ui/styles/themes.css`

**Interfaces:**
- Consumes: `test`, `expect` (Task 10), `expectNoSeriousA11y` (Task 10), the shell (Tasks 9–15).
- Produces: nothing new. This is the Plan 01 acceptance test.

- [ ] **Step 1: Write the smoke spec** `tests/e2e/smoke.spec.js`

```js
const PRIVACY = 'There is no Byways server. Your keys, collections and history are stored only on this device. Network calls go only to the sources and AI providers you turn on.';
test('the app loads at the base path, welcomes, routes and passes axe', async ({ page }) => {
  await page.goto('./');
  await expect(page).toHaveURL('http://localhost:4321/Game-Dev-Resources/byways/');
  await expect(page.getByRole('heading', { level: 1, name: 'Welcome to Byways' })).toBeVisible();
  await expect(page.getByText(PRIVACY, { exact: true })).toBeVisible();
  await expectNoSeriousA11y(page);
  await page.getByRole('button', { name: 'Continue' }).click();
  const nav = page.getByRole('navigation', { name: 'Main' });
  for (const label of ['Stumble', 'Feed', 'Daily Fate', 'Vault', 'Saved', 'Settings']) {
    await nav.getByRole('link', { name: label }).click();
    await expect(page.getByRole('heading', { level: 1, name: label })).toBeVisible();
    await expect(nav.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page');
    await expectNoSeriousA11y(page);
  }
  for (const theme of ['dark', 'high-contrast']) {
    await page.evaluate(t => { document.documentElement.dataset.theme = t; }, theme);
    await expectNoSeriousA11y(page);
  }
  await expect(page.locator('#live-polite')).toHaveAttribute('role', 'status');
  await expect(page.locator('#live-assertive')).toHaveAttribute('aria-live', 'assertive');
});
test('the manifest is served with relative scope', async ({ page }) => {
  const r = await page.request.get('manifest.webmanifest');
  expect(r.headers()['content-type']).toBe('application/manifest+json');
  expect(await r.json()).toMatchObject({ start_url: './', scope: './' });
});
```

The spec imports `test`, `expect` from `./helpers/net.js` and `expectNoSeriousA11y` from `./helpers/axe.js`. The `test` fixture fails either test on any unmocked request, console error (CSP violations included) or page error.

- [ ] **Step 2: Run it**

Run: `npm run build`, then `npx playwright test -c tests/e2e/playwright.config.js tests/e2e/smoke.spec.js`
Expected: PASS, 2 tests. If axe reports colour contrast in a theme, fix the colour rule in Task 9's `app.css` (the `a` rule) or the token in `themes.css`, not the test, and add that file to this commit.

- [ ] **Step 3: Run the whole suite**

Run: `npm test`, then `npm run e2e`
Expected: `check passed`, every unit test passes, and every e2e spec passes with 0 retries.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/smoke.spec.js
git commit -m "Add the Plan 01 end-to-end smoke test"
```
