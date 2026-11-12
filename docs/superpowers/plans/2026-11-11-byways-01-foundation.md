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
- **Contract fix:** on Node 22, `node --test tests/unit/` fails with "Cannot find module …/tests/unit". The `test` script therefore runs `node --test "tests/unit/**/*.test.js"` (Node expands the quoted glob). The overview's script table should be updated to match.
- Commands run from `Apps/Byways/`. Keep every command under 500 characters with at most 10 statement separators.

## Review Focus

1. **A source hands back a `javascript:`, `data:` or `vbscript:` link.** `h('a', {href})` must drop it and never put it in the DOM. Pinned by `dom.spec.js` "h drops unsafe link schemes" (Task 11).
2. **IndexedDB is blocked or throws** (private windows, locked-down profiles). The app must still boot on a memory store and say so in the assertive region. Pinned by `shell.spec.js` "boots on a memory store when IndexedDB is blocked" (Task 12).
3. **A second visit with no network, or a browser that refuses service workers.** The shell must load offline after one online visit, and a rejected `register()` must not stop boot. Pinned by `sw.spec.js` "reloads offline from the cache" (Task 14) and `pwa.test.js` "registerServiceWorker survives a rejected register" (Task 7).
4. **A hand-edited or garbled hash, such as `#/daily/%E0%A4%A`, `#/nope` or `#s=`.** The router must not throw, and unknown routes go to Stumble. Pinned by `router.test.js` "parseHash never throws on malformed input" (Task 12).
5. **Stored settings from an older or broken build** (wrong types, `null` objects, out-of-range numbers). `loadSettings` must fall back per field and clamp ranges. Pinned by `settings.test.js` "loadSettings repairs bad stored values" (Task 6).

---

## File Structure

All paths are under `Apps/Byways/` unless they start with `.github/`.

| File | Responsibility |
|---|---|
| `package.json`, `package-lock.json`, `.gitignore`, `LICENSE`, `README.md` | Scaffold, pinned devDependencies, npm scripts |
| `src/core/types.js` | JSDoc typedefs from the overview, plus `Settings` |
| `src/core/util/hash.js`, `url.js`, `text.js`, `clock.js` | Pure helpers |
| `src/core/store/db.js`, `store/cache.js` | Store over IndexedDB or memory; TTL cache |
| `src/core/settings.js` | Defaults, load with repair, save |
| `src/core/net/errors.js`, `ratelimit.js`, `http.js` | `NetError`, limiter, HTTP client with retry and circuit |
| `src/platform/web-tts.js`, `web-media.js`, `web-voice.js`, `pwa.js` | Web `Platform` pieces and SW registration |
| `src/ui/dom.js`, `a11y.js`, `theme.js`, `toast.js` | DOM builder, live regions, access attributes, toasts |
| `src/ui/router.js`, `views/index.js`, `views/settings/index.js`, `firstrun.js`, `boot.js` | Routing and registries, startup |
| `src/ui/styles/app.css`, `styles/themes.css` | Layout, 56 px targets, focus ring, theme tokens, reduced motion |
| `src/data/tags.json`, `library.json`, `vault-starter.json`, `geocities-seeds.json` | Empty, valid data files; Plans 02 and 04 fill them |
| `src/assets/icons/icon.svg` | App icon |
| `shells/pwa/index.html`, `manifest.webmanifest`, `sw.js`, `landing/index.html` | PWA shell and the Pages-root landing page |
| `tools/build.js`, `tools/check.js`, `tools/serve.js` | Build targets, rule checks, static server |
| `tests/unit/*.test.js` | Unit tests |
| `tests/e2e/playwright.config.js`, `helpers/net.js`, `helpers/fakes.js`, `helpers/axe.js`, `*.spec.js` | E2E harness and specs |
| `tests/fixtures/routes.js`, `tests/fixtures/http/ping.json` | Network fixtures |
| `.github/workflows/byways.yml`, `.github/workflows/pages.yml` | CI and Pages deploy |

`tests/e2e/helpers/axe.js` is a new helper file inside `tests/e2e/**`; later plans import `expectNoSeriousA11y` from it.

**Import-time rule:** no module in `src/ui/` or `src/platform/` touches `window` or `document` at import time, so Node unit tests can import them. Only `bootFromShell()` runs on load, and only when `document.documentElement.dataset.shell` is set.

---

### Task 1: Scaffold, shared types and hashing

**Files:**
- Create: `package.json`, `package-lock.json` (from `npm install`), `.gitignore`, `LICENSE`, `README.md`
- Create: `src/core/types.js`, `src/core/util/hash.js`
- Test: `tests/unit/hash.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `fnv1a32(str) → number`, `mulberry32(seed) → () => number`, `hash64(str) → string`, `sha256Hex(data) → Promise<string>`, `gumbel(rand) → number`; the typedefs `Find, FindKind, Safety, Reaction, Taste, Mode, Platform, SecretStore, VoiceStatus, VoiceErrorCode, VoiceEngine, Tts, Settings` in `types.js`.

- [ ] **Step 1: Write the scaffold files**

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

`src/core/types.js`: the overview's "Shared types" typedef blocks copied exactly, plus `/** @typedef {typeof import('./settings.js').DEFAULT_SETTINGS} Settings */`, and `export {};`.

- [ ] **Step 2: Write the failing test** in `tests/unit/hash.test.js`

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
test('gumbel maps exp(-1) to 0 and stays finite at the edges', () => {
  assert.equal(gumbel(() => Math.exp(-1)), 0);
  assert.ok(Number.isFinite(gumbel(() => 0)));
  assert.ok(Number.isFinite(gumbel(() => 1 - Number.EPSILON / 2)));
});
```

Every unit test file starts with `import test from 'node:test'; import assert from 'node:assert/strict';` and imports from `../../src/…`.

- [ ] **Step 3: Run it and see it fail**

Run: `node --test tests/unit/hash.test.js`
Expected: FAIL with `Cannot find module` for `src/core/util/hash.js`.

- [ ] **Step 4: Implement `src/core/util/hash.js`**

`fnv1a32` and `hash64` loop over `new TextEncoder().encode(str)` with the overview's offset bases and primes (`Math.imul(h, 0x01000193) >>> 0` for 32-bit; BigInt masked to 64 bits, `padStart(16,'0')`). `sha256Hex` uses `crypto.subtle.digest('SHA-256', …)`. `gumbel(rand)` is `-Math.log(-Math.log(u))` with `u` clamped to `[1e-12, 1 - 1e-12]`. `mulberry32` is exactly:

```js
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 5: Run it and see it pass**

Run: `node --test tests/unit/hash.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .gitignore LICENSE README.md src/core/types.js src/core/util/hash.js tests/unit/hash.test.js
git commit -m "Add the Byways scaffold, shared types and hashing"
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

Parse with `new URL(String(u).trim())` inside try/catch. Keep only `http:`/`https:`. Lower-case comes from `URL`. Strip a leading `www.` from the host, and clear the port when it is the default. Drop the hash. Delete params whose name starts with `utm_` or equals `fbclid`, `gclid` or `ref`, then `searchParams.sort()`. Drop one trailing `/` when the path is not `/`.

- [ ] **Step 4: Implement `src/core/util/text.js`**

`toPlainText`: when `globalThis.DOMParser` exists, return the collapsed `body.textContent` of `parseFromString(html,'text/html')`. Otherwise remove `<script>…</script>` and `<style>…</style>` blocks, replace `br`, `p`, `div`, `li`, `tr` and `h1`–`h6` tags with a space, remove other tags, decode the named entities `&amp; &lt; &gt; &quot; &#39; &nbsp;` and numeric entities (code point 0, surrogates or above `0x10FFFF` become `�`; unparseable ones stay as written), then collapse whitespace and trim. `firstSentence`: text up to the first `.`, `!` or `?` that is followed by whitespace or the end. `truncate`: work on `Array.from(text)`; when longer than `max`, keep `max - 1` code points, `trimEnd()`, and add `…`. `tokenize`: `text.toLowerCase().match(/\p{L}+/gu)`, keep length ≥ 3, drop `STOP_WORDS`. `STOP_WORDS` is exactly:

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
- Test: `tests/unit/clock.test.js`, `tests/unit/ratelimit.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `realClock`, `fakeClock(start=0) → {now, setTimeout, clearTimeout, advance(ms)}`, `utcDate(ms)`, `nextUtcMidnight(ms)`; `class NetError extends Error` with constructor `new NetError(kind, message, {status, retryAfterMs, source} = {})`; `createLimiter({perMinute, concurrent, clock}) → {schedule(fn) → Promise, pauseFor(ms)}`; `parseRetryAfter(value, nowMs) → number|null`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/clock.test.js`:

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
test('NetError carries kind, status and source', () => {
  const e = new NetError('http', 'HTTP 503', { status: 503, retryAfterMs: 2000, source: 'wikipedia' });
  assert.ok(e instanceof Error); assert.equal(e.name, 'NetError');
  assert.deepEqual([e.kind, e.status, e.retryAfterMs, e.source], ['http', 503, 2000, 'wikipedia']);
});
```

`tests/unit/ratelimit.test.js` (with `const flush = () => new Promise(r => setImmediate(r));` and a `deferred()` helper returning `{promise, resolve, reject}`):

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

`fakeClock`: a list of `{id, due, seq, fn}`. `advance(ms)` sets `end = now + ms`, then repeatedly takes the earliest timer (by `due`, then `seq`) with `due ≤ end`, sets `now = due`, removes and calls it; finally `now = end`. `realClock` wraps `Date.now` and the global timers. `utcDate` is `new Date(ms).toISOString().slice(0, 10)`. `NetError` sets `name = 'NetError'`.

`createLimiter`: a FIFO queue, a `running` count, a list of start times, and `pausedUntil`. `pump()` starts tasks while `running < concurrent`, `now ≥ pausedUntil`, and fewer than `perMinute` starts fall in `(now − 60000, now]`. If the queue is still not empty, it sets one timer (via `clock.setTimeout`) for the earliest moment a slot frees: `pausedUntil`, or the oldest start + 60000. A settled task decrements `running` and pumps. `schedule` pumps on a microtask, so callers see the promise first. `pauseFor(ms)` sets `pausedUntil = max(pausedUntil, now + ms)`.

`parseRetryAfter`: `/^\d+$/` → seconds × 1000. Otherwise `Date.parse`; NaN → `null`; else `max(0, date − now)`.

- [ ] **Step 4: Run them and see them pass**

Run: `node --test tests/unit/clock.test.js tests/unit/ratelimit.test.js`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/util/clock.js src/core/net/errors.js src/core/net/ratelimit.js tests/unit/clock.test.js tests/unit/ratelimit.test.js
git commit -m "Add the clock helpers, NetError and the rate limiter"
```

<!-- PLAN CONTINUES -->
