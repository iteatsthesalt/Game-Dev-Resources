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

### Task 4: HTTP client

**Files:**
- Create: `src/core/net/http.js`
- Test: `tests/unit/http.test.js`

**Interfaces:**
- Consumes: `NetError`, `createLimiter`, `parseRetryAfter` (Task 3); `fakeClock` (tests).
- Produces: `createHttp({transport, clock}) → {register(sourceId, {perMinute, concurrent}), request(url, opts) → Promise<Response>, getJson(url, opts), getText(url, opts)}` with `opts = {method='GET', headers, body, source, timeoutMs=8000, privileged=false, signal}`. Constants exported for tests: `RETRY_MAX_MS = 10000`, `DEFAULT_PAUSE_MS = 60000`, `CIRCUIT_FAILS = 3`, `CIRCUIT_MS = 60000`.

- [ ] **Step 1: Write the failing test**

Use a scripted transport: `const calls = []; const transport = { fetch: (url, init) => { calls.push({ url, init }); return next.shift()(init); } };` where each `next` entry returns a `Response` promise or throws. Use `flush` from Task 3.

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
  next = [init => new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(new DOMException('x', 'AbortError'))))];
  const p = http.request('https://a.test/'); await flush(); clock.advance(8000);
  await assert.rejects(p, { kind: 'timeout' });
});
test('a caller abort gives kind aborted', async () => { /* same hanging fetch; ac.abort() */ await assert.rejects(p, { kind: 'aborted' }); });
test('429 with Retry-After of 10 s or less retries once', async () => {
  next = [() => Promise.resolve(new Response('', { status: 429, headers: { 'Retry-After': '2' } })), () => Promise.resolve(new Response('ok'))];
  const p = http.getText('https://a.test/'); await flush(); assert.equal(calls.length, 1);
  clock.advance(2000); assert.equal(await p, 'ok'); assert.equal(calls.length, 2);
});
test('a second 429 in a row is not retried', async () => { /* two 429s with Retry-After 1 */ await assert.rejects(p, { kind: 'http', status: 429 }); assert.equal(calls.length, 2); });
test('503 with Retry-After 30 pauses the source and throws', async () => {
  http.register('s', { perMinute: 60, concurrent: 1 });
  next = [() => Promise.resolve(new Response('', { status: 503, headers: { 'Retry-After': '30' } })), () => Promise.resolve(new Response('ok'))];
  await assert.rejects(http.getText('https://a.test/', { source: 's' }), { status: 503, retryAfterMs: 30000 });
  const p = http.getText('https://a.test/', { source: 's' }); await flush(); assert.equal(calls.length, 1);
  clock.advance(30000); assert.equal(await p, 'ok');
});
test('bad JSON gives kind parse', async () => { /* Response('not json') */ await assert.rejects(http.getJson('https://a.test/'), { kind: 'parse' }); });
test('3 straight network failures open the circuit for 60 s', async () => {
  http.register('s', { perMinute: 60, concurrent: 2 });
  next = [1, 2, 3, 4].map(() => () => { throw new TypeError('x'); });
  for (let i = 0; i < 3; i++) await assert.rejects(http.request('https://a.test/', { source: 's' }), { kind: 'network' });
  await assert.rejects(http.request('https://a.test/', { source: 's' }), { kind: 'circuit' }); assert.equal(calls.length, 3);
  clock.advance(60000);
  await assert.rejects(http.request('https://a.test/', { source: 's' }), { kind: 'network' }); assert.equal(calls.length, 4);
});
```

Each test builds a fresh `clock = fakeClock(Date.UTC(2026,10,11))`, `calls`, and `http = createHttp({ transport, clock })`.

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
  /* set a ttl 10, b ttl 100; advance 50 */ assert.equal(await cache.purgeExpired(), 1); assert.deepEqual(await store.keys('cache'), ['b']);
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
  assert.deepEqual(d.sources, {});
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
  await store.put('settings', 'current', { dwellSec: 9999, textScale: 0.2, theme: 7, voice: null, ai: { team: 'x' },
    sessionLengthMin: 30, sources: { wikipedia: { enabled: false, fateWeight: 9 } }, extra: 'kept' });
  const s = await loadSettings(store);
  assert.equal(s.dwellSec, 300); assert.equal(s.textScale, 1); assert.equal(s.theme, 'system');
  assert.deepEqual(s.voice, DEFAULT_SETTINGS.voice); assert.deepEqual(s.ai.team, DEFAULT_SETTINGS.ai.team);
  assert.equal(s.sessionLengthMin, 30); assert.deepEqual(s.sources.wikipedia, { enabled: false, fateWeight: 3 });
  assert.equal(s.extra, 'kept');
  await store.put('settings', 'current', 'garbage'); assert.deepEqual(await loadSettings(store), DEFAULT_SETTINGS);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/unit/settings.test.js`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 3: Implement `src/core/settings.js`**

`repairSettings(stored)` walks `DEFAULT_SETTINGS`. Where the default is a plain object with keys, it recurses (a non-object stored value gives the default). Where the default is `{}` (`sources`), it keeps a stored plain object. Where the default is `null`, it accepts a string, number, plain object or `null`. Otherwise it keeps the stored value only when its `typeof` matches the default. Keys the defaults do not know are kept as they are. Then it clamps `dwellSec` to 5–300, `textScale` to 1–2, `voice.rate` to 0.5–2, `voice.volume` to 0–1, and each `sources[id].fateWeight` to 0–3. It always returns a new object and never shares references with `DEFAULT_SETTINGS`. `saveSettings` deep-merges `patch` over the loaded settings (plain objects merge; arrays and other values replace), repairs, puts and returns.

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
- Create: `tests/unit/helpers/fake-dom.js` (a tiny element and document fake: `setAttribute`, `addEventListener`, `dispatchEvent`, `click`, `remove`, `append`, `createElement`, `body`)
- Test: `tests/unit/web-tts.test.js`, `tests/unit/web-media.test.js`, `tests/unit/web-voice.test.js`, `tests/unit/pwa.test.js`

**Interfaces:**
- Consumes: `isHttpUrl` (Task 2); `openStore`, `memoryBackend` (Task 5, tests).
- Produces: `createWebTts(speechSynthesis, Utterance = globalThis.SpeechSynthesisUtterance) → Tts`; `createWebMedia(navigator) → Platform['media']`; `createWebWakeLock(navigator, document) → Platform['wakeLock']`; `createNoVoice() → VoiceEngine`; `createPwaPlatform({secretsStore, win = globalThis}) → Platform`, where `secretsStore` is a `Store`; `registerServiceWorker(win, onUpdate) → Promise<ServiceWorkerRegistration|null>`.

- [ ] **Step 1: Write the failing tests**

`web-tts.test.js` (a fake synth records `speak(u)` and calls `u.onend` on a microtask; `class FakeUtterance { constructor(t) { this.text = t; } }`):

```js
test('speak sets voice, rate and volume and resolves at the end', async () => {
  const tts = createWebTts(synth, FakeUtterance);
  await tts.speak('Hello', { voiceURI: 'v1', rate: 1.5, volume: 0.5 });
  const u = synth.spoken[0];
  assert.deepEqual([u.text, u.voice.voiceURI, u.rate, u.volume], ['Hello', 'v1', 1.5, 0.5]);
});
test('interrupted and canceled resolve; other errors reject', async () => { /* onerror({error:'interrupted'}) resolves; {error:'synthesis-failed'} */ await assert.rejects(p, /synthesis-failed/); });
test('voices maps fields and waits for voiceschanged when empty', async () => {
  /* getVoices() returns [] until the test fires the voiceschanged listener */
  assert.deepEqual(await p, [{ uri: 'v1', name: 'One', lang: 'en-US', local: true }]);
});
test('with no speechSynthesis it is silent', async () => {
  const tts = createWebTts(undefined); await tts.speak('x'); tts.cancel(); assert.deepEqual(await tts.voices(), []);
});
```

`web-media.test.js`:

```js
test('setHandlers maps to media session actions and survives unsupported ones', () => {
  const set = {}; const nav = { mediaSession: { setActionHandler(a, f) { if (a === 'previoustrack') throw new TypeError('unsupported'); set[a] = f; } } };
  const next = () => {}; const pp = () => {};
  createWebMedia(nav).setHandlers({ next, previous: () => {}, playPause: pp });
  assert.equal(set.nexttrack, next); assert.equal(set.play, pp); assert.equal(set.pause, pp);
});
test('setActive sets playbackState; no mediaSession is a no-op', () => { /* 'playing' then 'none' */ createWebMedia({}).setActive(true); });
test('wake lock re-acquires on visible and stops after off', async () => {
  /* fake navigator.wakeLock.request counts calls and returns a sentinel; fake document has visibilityState and listeners */
  await wl.on(); assert.equal(requests, 1);
  doc.visibilityState = 'visible'; doc.fire('visibilitychange'); await flush(); assert.equal(requests, 2);
  await wl.off(); assert.equal(sentinel.released, true); doc.fire('visibilitychange'); await flush(); assert.equal(requests, 2);
});
test('a refused wake lock resolves quietly', async () => { /* request rejects NotAllowedError */ await wl.on(); });
```

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

`pwa.test.js` (a fake `win` with `navigator`, `document` from `fake-dom.js`, `location`, `open`, `fetch`, `URL.createObjectURL`):

```js
test('name, caps and secrets in the keys store', async () => {
  const p = createPwaPlatform({ secretsStore: await openStore(memoryBackend()), win });
  assert.equal(p.name, 'pwa');
  assert.deepEqual(p.caps, { privilegedFetch: false, localNetworkHttp: false, inAppSiteView: false, labHref: 'lab/', framesArchive: true });
  await p.secrets.set('anthropic', 'k1'); assert.equal(await p.secrets.get('anthropic'), 'k1');
  assert.deepEqual(await p.secrets.list(), ['anthropic']); await p.secrets.delete('anthropic');
  assert.equal(await p.secrets.get('anthropic'), null);
});
test('transport drops privileged and omits credentials', async () => {
  await p.transport.fetch('https://a.test/', { privileged: true, headers: { a: 'b' } });
  assert.equal('privileged' in fetched[0].init, false); assert.equal(fetched[0].init.credentials, 'omit'); assert.deepEqual(fetched[0].init.headers, { a: 'b' });
});
test('share uses navigator.share, then the clipboard', async () => {
  /* share resolves → 'shared'; share rejects AbortError → 'cancelled'; no share → writeText(url) → 'copied'; writeText rejects → 'cancelled' */
});
test('openFind opens only http(s) links, in a new tab with noopener', async () => {
  await p.openFind({ url: 'https://x.org/' }); assert.deepEqual(opened, [['https://x.org/', '_blank', 'noopener']]);
  await p.openFind({ url: 'https://y.org/' }, 'current'); assert.deepEqual(assigned, ['https://y.org/']);
  await assert.rejects(p.openFind({ url: 'javascript:alert(1)' }), /not an http\(s\) link/); assert.equal(opened.length, 1);
});
test('files.save clicks a download link; files.pick returns chosen files', async () => {
  await p.files.save('byways.json', new Blob(['{}']));
  assert.deepEqual([anchor.attrs.download, anchor.attrs.href, anchor.clicked, anchor.removed], ['byways.json', 'blob:x', true, true]);
  const picking = p.files.pick('.json'); input.files = [file]; input.dispatchEvent({ type: 'change' });
  assert.deepEqual(await picking, [file]); assert.deepEqual([input.attrs.type, input.attrs.accept, input.multiple], ['file', '.json', false]);
});
test('persistStorage', async () => { /* persist() → true gives true; missing storage gives false; throwing gives false */ });
test('registerServiceWorker skips the Android shell', async () => {
  win.BywaysNative = {}; assert.equal(await registerServiceWorker(win, () => {}), null); assert.equal(registerCalls, 0);
});
test('registerServiceWorker survives a rejected register', async () => {
  /* navigator.serviceWorker.register rejects */ assert.equal(await registerServiceWorker(win, () => {}), null);
});
test('registerServiceWorker reports a waiting worker', async () => {
  /* register resolves {waiting:{}, addEventListener(){}}; navigator.serviceWorker.controller = {} */
  assert.deepEqual(registerArgs, ['./sw.js']); assert.equal(updates, 1);
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `node --test tests/unit/web-tts.test.js tests/unit/web-media.test.js tests/unit/web-voice.test.js tests/unit/pwa.test.js`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 3: Implement `web-tts.js`, `web-media.js` and `web-voice.js`**

`createWebTts`: when `speechSynthesis` is falsy, return a Tts whose `speak` resolves at once and whose `voices` gives `[]`. Otherwise `speak` picks the voice whose `voiceURI` matches, sets `rate` and `volume` when given, resolves on `end`, resolves on `error` with `interrupted` or `canceled`, and otherwise rejects with `Error(event.error)`. `voices` waits for `voiceschanged` (once) or 1000 ms when the list is empty. Plan 03 adds sentence splitting. `createWebMedia` maps `next → 'nexttrack'`, `previous → 'previoustrack'`, `playPause → 'play'` and `'pause'`, each in its own try/catch; `setActive(on)` sets `playbackState` to `'playing'` or `'none'`. `createWebWakeLock` keeps a `wanted` flag, re-requests `'screen'` on `visibilitychange` when visible and wanted, and swallows request errors. `createNoVoice` keeps listener sets per event; `start` emits `state {listening:false}` and `error {code:'service-not-allowed'}`.

- [ ] **Step 4: Implement `pwa.js`**

`secrets` maps to the `keys` store (`get` returns `null` for a missing key). `transport.fetch(url, init)` removes `privileged` and calls `win.fetch(url, {...rest, credentials: 'omit'})`. `share` tries `navigator.share` when it exists and `navigator.canShare?.(data) !== false`. An `AbortError` gives `'cancelled'`, and any other error falls back to `navigator.clipboard.writeText(url || text || title)`. `openFind(find, how='tab')` throws `Error('not an http(s) link')` unless `isHttpUrl(find.url)`; `'current'` uses `location.assign`, everything else uses `win.open(url, '_blank', 'noopener')`. `files.save` makes an `<a download>` with an object URL, appends, clicks, removes, and revokes the URL after 1000 ms. `files.pick(accept, multiple=false)` makes an `<input type=file>` and resolves on `change` with `Array.from(input.files)` or on `cancel` with `[]`. `persistStorage` returns `false` when `navigator.storage?.persist` is missing or throws. `voice: createNoVoice()`, `tts: createWebTts(win.speechSynthesis)`, `media: createWebMedia(win.navigator)`, `wakeLock: createWebWakeLock(win.navigator, win.document)`.

`registerServiceWorker(win, onUpdate)` returns `null` when `win.BywaysNative` exists, when `navigator.serviceWorker` is missing, or when `register('./sw.js')` rejects. When the registration already has `waiting` and the page has a `controller`, it calls `onUpdate(reg)`. On `updatefound`, it calls `onUpdate(reg)` when the new worker reaches `installed` and a `controller` exists.

- [ ] **Step 5: Run them and see them pass**

Run: `node --test tests/unit/web-tts.test.js tests/unit/web-media.test.js tests/unit/web-voice.test.js tests/unit/pwa.test.js`
Expected: PASS, 18 tests.

- [ ] **Step 6: Commit**

```bash
git add src/platform/web-tts.js src/platform/web-media.js src/platform/web-voice.js src/platform/pwa.js tests/unit/helpers/fake-dom.js tests/unit/web-tts.test.js tests/unit/web-media.test.js tests/unit/web-voice.test.js tests/unit/pwa.test.js
git commit -m "Add the web platform: speech, media, wake lock and the PWA object"
```

### Task 8: Check rules and the static server

**Files:**
- Create: `tools/check.js`, `tools/serve.js`
- Test: `tests/unit/check.test.js`, `tests/unit/serve.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces (`tools/check.js`): `APP_CSP` (the overview string), `LAB_CSP` (`APP_CSP` with `script-src 'self' 'wasm-unsafe-eval' blob:` and `worker-src 'self' blob:`), `findForbidden(file, text) → string[]`, `checkHtml(file, html) → string[]`, `checkRefs(file, text, exists) → string[]`, `checkManifest(file, text) → string[]`, `checkData(name, json, {tagIds}) → string[]`, `checkPrecache(swText, outDir) → string[]`, `runChecks({srcDir, outputs, extraHtml}) → Promise<string[]>`. Every problem string starts with the file path, then `: `. (`tools/serve.js`): `createServer({root, base}) → http.Server`, plus a CLI taking `--root`, `--base` and `--port`.

- [ ] **Step 1: Write the failing tests**

`check.test.js`:

```js
const page = csp => `<!doctype html><meta http-equiv="Content-Security-Policy" content="${csp}"><script type="module" src="ui/boot.js"></script>`;
test('findForbidden flags each banned API once', () => {
  for (const s of ['el.innerHTML = x', 'el.outerHTML = x', 'el.insertAdjacentHTML("a", b)', 'document.write(1)', 'eval(x)', 'new Function("x")', '<script src="https://cdn.x/y.js"></script>'])
    assert.equal(findForbidden('a.js', s).length, 1, s);
  assert.deepEqual(findForbidden('a.js', 'const evaluate = 1; medieval(2); x.innerHTMLish = 3;'), []);
});
test('checkHtml wants the exact CSP and no inline code', () => {
  assert.deepEqual(checkHtml('x.html', page(APP_CSP)), []);
  assert.deepEqual(checkHtml('x.html', '<p>hi</p>'), ['x.html: missing CSP meta']);
  assert.deepEqual(checkHtml('x.html', page("default-src *")), ['x.html: CSP differs from APP_CSP']);
  assert.deepEqual(checkHtml('lab/x.html', page(LAB_CSP)), []);
  assert.deepEqual(checkHtml('x.html', page(APP_CSP) + '<script>1</script>'), ['x.html: inline script']);
  assert.deepEqual(checkHtml('x.html', page(APP_CSP) + '<div style="color:red"></div><style>p{}</style>'), ['x.html: inline style', 'x.html: inline style']);
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
test('checkPrecache wants a stamped id, existing files and under 2 MB', async () => {
  /* temp dir with index.html (10 bytes) and big.bin (2 MB + 1) */
  assert.deepEqual(checkPrecache("const BUILD_ID = '__BUILD_ID__'; const PRECACHE = [\"__PRECACHE__\"];", dir), ['sw.js: build id not stamped', 'sw.js: precache list not written']);
  assert.deepEqual(checkPrecache(`const BUILD_ID = "dev"; const PRECACHE = ["./index.html","./gone.js"];`, dir), ['sw.js: precache missing ./gone.js']);
  assert.match(checkPrecache(`const BUILD_ID = "dev"; const PRECACHE = ["./index.html","./big.bin"];`, dir)[0], /app shell is over 2 MB/);
});
```

Library tags are checked against `tagIds` only when `tagIds` is given.

`serve.test.js` (temp root with `index.html`, `a.wasm`, `sub/index.html`; `server.listen(0)`; raw requests through `node:http` so `..` is not normalised by the client):

```js
test('serves the base, MIME types and folder indexes', async () => {
  assert.deepEqual(await get('/Game-Dev-Resources/byways/'), { status: 200, type: 'text/html; charset=utf-8', body: 'home' });
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

- [ ] **Step 2: Run them and see them fail**

Run: `node --test tests/unit/check.test.js tests/unit/serve.test.js`
Expected: FAIL with `Cannot find module`.

- [ ] **Step 3: Implement `tools/check.js`**

Forbidden patterns: `/\binnerHTML\b/`, `/\bouterHTML\s*=/`, `/\binsertAdjacentHTML\b/`, `/\bdocument\.write\b/`, `/\beval\(/`, `/\bnew Function\b/`, `/<script[^>]+src=["']https?:/i`, reported as `<file>: forbidden <name>`. `checkHtml` expects `LAB_CSP` for paths with a `lab/` segment and `APP_CSP` otherwise. A `<script>` with no `src` is inline. A `style=` attribute or a `<style>` tag is inline style. Relative refs are values that do not start with a scheme (`/^[a-z][a-z0-9+.-]*:/i`), `//`, `#` or `/`. Strip `?` and `#` parts, and resolve a value ending in `/` to its `index.html`. JS refs are `from '…'`, bare `import '…'` and `import('…')` string literals starting with `./` or `../`. `checkManifest` checks `start_url` and `scope` equal `./` only for `.webmanifest` files. `checkData` checks `v === 1`, tag ids match `/^[a-z0-9]+(-[a-z0-9]+)*$/` and are unique, library ids match `/^lib-\d{4}$/` with http(s) urls, `kind` in `site|game|toy|tool|article` and `added` as `YYYY-MM-DD`, vault ids start with `ia:` with a numeric `year`, and geocities urls are http(s). `checkPrecache` reads the `BUILD_ID` and `PRECACHE` literals, and sums the sizes of the listed files against 2 × 1024 × 1024. `runChecks` walks each output folder, skipping any `vendor` segment. It runs `findForbidden` and `checkRefs` on `.js` and `.html`, `checkHtml` on `.html` (and on each `extraHtml` path), `checkManifest` on `*.webmanifest` and `manifest*.json`, `checkPrecache` on each output's `sw.js`, and `checkData` on every `srcDir/data/*.json` (passing `tagIds` from `tags.json`).

- [ ] **Step 4: Implement `tools/serve.js`**

Serve only paths under `base`, and redirect `base` without its slash. Decode the path, resolve it under `root`, and return 404 unless the result stays inside `root`. A folder serves its `index.html`. Send `Cache-Control: no-store`. MIME map: `.html` `text/html; charset=utf-8`, `.js`/`.mjs` `text/javascript; charset=utf-8`, `.css` `text/css; charset=utf-8`, `.json` `application/json`, `.webmanifest` `application/manifest+json`, `.svg` `image/svg+xml`, `.png` `image/png`, `.jpg` `image/jpeg`, `.gif` `image/gif`, `.webp` `image/webp`, `.ico` `image/x-icon`, `.wasm` `application/wasm`, `.woff2` `font/woff2`, `.txt` `text/plain; charset=utf-8`, `.xml` `application/xml`, `.zip` `application/zip`, and anything else `application/octet-stream`. The CLI listens on `--port` and logs `Serving <root> at http://localhost:<port><base>`. It starts only when the file is run directly (`import.meta.url === pathToFileURL(process.argv[1]).href`).

- [ ] **Step 5: Run them and see them pass**

Run: `node --test tests/unit/check.test.js tests/unit/serve.test.js`
Expected: PASS, 9 tests.

- [ ] **Step 6: Commit**

```bash
git add tools/check.js tools/serve.js tests/unit/check.test.js tests/unit/serve.test.js
git commit -m "Add the build check rules and the static test server"
```

### Task 9: PWA shell, styles and the build

**Files:**
- Create: `shells/pwa/index.html`, `shells/pwa/manifest.webmanifest`, `shells/pwa/sw.js` (constants only; Task 14 adds the handlers), `shells/pwa/landing/index.html`
- Create: `src/ui/styles/app.css`, `src/ui/styles/themes.css`, `src/assets/icons/icon.svg`, `src/ui/boot.js` (stub: `export async function bootFromShell() {}`; Task 12 fills it)
- Create: `src/data/tags.json` `{"v":1,"groups":[]}`, `src/data/library.json` `{"v":1,"entries":[]}`, `src/data/vault-starter.json` `{"v":1,"entries":[]}`, `src/data/geocities-seeds.json` `{"v":1,"urls":[]}` (Plans 02 and 04 fill them)
- Create: `tools/build.js`
- Test: `tests/unit/build.test.js`

**Interfaces:**
- Consumes: `runChecks`, `APP_CSP` (Task 8).
- Produces: `build({target, outRoot = APP_ROOT, id = process.env.GITHUB_SHA || 'dev', now = new Date()}) → Promise<{outputs: string[]}>`, `OUTPUTS = {pwa: ['dist/pwa'], extension: ['dist/chrome', 'dist/firefox'], android: ['shells/android/app/src/main/assets/www', 'shells/android/app/src/main/assets/lab']}`, `findStale(freshRoot, liveRoot, dirs) → string[]`; the CLI `--target pwa|extension|android|all` and `--check`. The page ids `#app`, `#main`, `#live-polite`, `#live-assertive`, `#hf-bar`, `#toasts`; the attribute values `data-theme` `system|light|dark|high-contrast`, `data-motion` `system|reduced|full`, `data-font` `system|atkinson`.

- [ ] **Step 1: Write the failing test** in `tests/unit/build.test.js`

```js
test('pwa target copies src and the shell and stamps the build', async () => {
  const out = await mkdtemp(join(tmpdir(), 'bw-')); const dir = join(out, 'dist/pwa');
  await build({ target: 'pwa', outRoot: out, id: 'abc123', now: new Date('2026-11-11T00:00:00Z') });
  for (const f of ['index.html', 'manifest.webmanifest', 'sw.js', 'build.json', 'core/util/hash.js', 'ui/boot.js', 'platform/pwa.js', 'data/tags.json', 'assets/icons/icon.svg', 'ui/styles/app.css'])
    assert.ok(existsSync(join(dir, f)), f);
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
  /* build pwa; write dist/pwa/stale.txt; build pwa again */ assert.equal(existsSync(join(dir, 'stale.txt')), false);
});
test('findStale reports changed files and ignores build.json and missing outputs', async () => {
  /* build pwa into A and B with different ids; change B/dist/pwa/index.html */
  assert.deepEqual(findStale(a, b, ['dist/pwa', 'dist/chrome']), ['dist/pwa/index.html: stale; run npm run build']);
  assert.deepEqual(findStale(a, join(b, 'none'), ['dist/pwa']), []);
});
test('the real tree passes every check', async () => {
  const out = await mkdtemp(join(tmpdir(), 'bw-')); await build({ target: 'all', outRoot: out, id: 'dev' });
  const outputs = Object.values(OUTPUTS).flat().map(d => join(out, d));
  assert.deepEqual(await runChecks({ srcDir: 'src', outputs, extraHtml: ['shells/pwa/landing/index.html'] }), []);
});
```

`findStale` compares every file except `build.json`. It treats an output that is missing from `liveRoot` as not stale, and it compares `sw.js` with the `BUILD_ID` line removed.

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
  "icons": [ { "src": "assets/icons/icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any" } ] }
```

`shells/pwa/sw.js` holds only `const BUILD_ID = '__BUILD_ID__';`, `const CACHE = 'byways-' + BUILD_ID;` and `const PRECACHE = ["__PRECACHE__"];`.

`shells/pwa/landing/index.html`: doctype, `lang="en"`, the same CSP meta, `<title>Game-Dev-Resources</title>`, an `<h1>Game-Dev-Resources</h1>`, and a list with one item: `<a href="byways/">Byways</a>` followed by " — a free discovery app with no account." It has no scripts and no styles.

`src/assets/icons/icon.svg`: a `viewBox="0 0 512 512"` rounded square filled `#1d4ed8`, with a white winding path stroke. No text and no external references.

- [ ] **Step 4: Write the styles**

`themes.css` sets the tokens `--bg --fg --muted --surface --border --accent --focus` on `[data-theme="light"]` and on `:root` (light: `#ffffff #1a1a1a #555555 #f3f3f0 #8a8a8a #1d4ed8 #b45309`). The same tokens go on `[data-theme="dark"]` and inside `@media (prefers-color-scheme: dark) { [data-theme="system"] { … } }` (dark: `#121212 #f2f2f2 #bbbbbb #1e1e1e #777777 #93b4ff #fbbf24`), and on `[data-theme="high-contrast"]` (`#000000 #ffffff #ffffff #000000 #ffffff #ffff00 #00ffff`). It also has `[data-font="system"] body { font-family: system-ui, sans-serif; }`.

`app.css` holds:
- `html { font-size: calc(100% * var(--text-scale, 1)); }` and `body` colours from the tokens;
- `button, .btn, nav a { min-height: 56px; min-width: 56px; display: inline-flex; align-items: center; justify-content: center; padding: 0 16px; }`;
- `:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }`;
- `.visually-hidden` (the clip-rect pattern), a `.skip-link` that shows on focus, `[hidden] { display: none !important; }`, and `#toasts` fixed at the bottom centre;
- `@media (prefers-reduced-motion: reduce) { [data-motion="system"] *, [data-motion="system"] *::before, [data-motion="system"] *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; } }`, plus the same rule for `[data-motion="reduced"]` outside the media query.

- [ ] **Step 5: Implement `tools/build.js`**

`build` empties each output folder of the chosen target and writes `build.json` = `{id, builtAt: now.toISOString()}`. For `pwa`, it copies `src/core`, `src/ui`, `src/platform`, `src/data`, `src/assets`, and `src/versions.json` and `src/lab` when they exist, to the same paths under `dist/pwa/`. It copies `index.html`, `manifest.webmanifest` and `sw.js` from `shells/pwa/`. In `sw.js` it replaces `'__BUILD_ID__'` with `JSON.stringify(id)` and `["__PRECACHE__"]` with the JSON list: `'./'` plus every output file as `./<path>`, sorted, leaving out `sw.js`, `build.json` and anything under `lab/` or `vendor/`. `extension` and `android` write an empty output folder and `build.json` until Plan 07/08 adds files. `all` runs the three. The CLI `--check` builds `all` into `fs.mkdtemp(join(os.tmpdir(), 'byways-check-'))`. It then runs `runChecks({srcDir: 'src', outputs, extraHtml: ['shells/pwa/landing/index.html']})` and `findStale(tmp, APP_ROOT, all output dirs)`, prints each problem, and exits 1 when there are any. Otherwise it prints `check passed`. `APP_ROOT` is the folder above `tools/`.

- [ ] **Step 6: Run it and see it pass**

Run: `node --test tests/unit/build.test.js`
Expected: PASS, 5 tests.

Run: `npm test`
Expected: `check passed`, then every unit test passes.

- [ ] **Step 7: Commit**

```bash
git add shells/pwa src/ui/styles src/assets/icons/icon.svg src/ui/boot.js src/data tools/build.js tests/unit/build.test.js
git commit -m "Add the PWA shell, base styles and the build with its check"
```

### Task 10: End-to-end harness

**Files:**
- Create: `tests/e2e/playwright.config.js`, `tests/e2e/helpers/net.js`, `tests/e2e/helpers/fakes.js`, `tests/e2e/helpers/axe.js`
- Create: `tests/fixtures/routes.js`, `tests/fixtures/http/ping.json` (`{"pong": true}`)
- Test: `tests/e2e/harness.spec.js`

**Interfaces:**
- Consumes: the built `dist/pwa/` (Task 9) and `tools/serve.js` (Task 8).
- Produces: `mockNet(page, {overrides?}) → Promise<void>`, `unmocked(page) → string[]`, `pageProblems(page) → string[]`, and `test` / `expect` from `helpers/net.js`. `test` is `@playwright/test`'s `test` extended so that its `page` fixture calls `mockNet(page)` first and, after the test, asserts that `unmocked(page)` and `pageProblems(page)` are both `[]`. Later specs import `test` and `expect` from here. A route or override entry is `{match: RegExp, file?: string, body?: string, json?: any, status?: number, headers?: object}`, where `file` is relative to `tests/fixtures/http/`. Also `installFakeSpeech(page) → Promise<void>` (`helpers/fakes.js`) and `expectNoSeriousA11y(page, {exclude = []} = {}) → Promise<void>` (`helpers/axe.js`).

- [ ] **Step 1: Write `tests/e2e/playwright.config.js`**

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

Service workers are blocked by default because `page.route` cannot see requests a service worker makes. Only `sw.spec.js` turns them on.

- [ ] **Step 2: Write the failing spec** `tests/e2e/harness.spec.js`

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
    const s = await navigator.wakeLock.request('screen'); const a = window.__wakeLock.active; await s.release(); return [a, window.__wakeLock.active];
  })).toEqual([true, false]);
});
base('axe finds no serious issues on the bare shell', async ({ page }) => {
  await mockNet(page); await page.goto('./'); await expectNoSeriousA11y(page);
});
```

- [ ] **Step 3: Run it and see it fail**

Run: `npm run build`, then `npx playwright test -c tests/e2e/playwright.config.js tests/e2e/harness.spec.js`
Expected: FAIL with `Cannot find module` for `./helpers/net.js`.

- [ ] **Step 4: Implement the helpers**

`net.js`: per page, keep `{unmocked: [], problems: []}` in a `WeakMap`. The first `mockNet` call adds a `console` listener (push errors whose text matches `/Content Security Policy/`) and a `pageerror` listener (push `pageerror: <message>`). It also adds a `page.route` for every http(s) URL whose host is not `localhost:4321`: fulfil from the first matching `tests/fixtures/routes.js` entry, or else record the URL and `route.abort('blockedbyclient')`. A call with `overrides` adds another route that fulfils a matching override or calls `route.fallback()`. Playwright runs the newest route first. Fulfil `OPTIONS` with 204. Every fulfilled response gets `access-control-allow-origin: *`, `access-control-allow-headers: *` and `access-control-allow-methods: *`, because the browser still applies CORS to mocked cross-origin responses. The content type comes from the file extension (`.json` `application/json`, `.xml` `application/xml`, `.html` `text/html`, `.txt` `text/plain`, otherwise `application/octet-stream`) or `application/json` for `json`. Entry `headers` override all of these.

`routes.js`: `export default [{ match: /^https:\/\/example\.test\/ping$/, file: 'ping.json' }];`. Later plans append entries.

`fakes.js`: `installFakeSpeech(page)` calls `page.addInitScript` once to define:
- `SpeechRecognition` and `webkitSpeechRecognition`: one `EventTarget` class with `lang`, `continuous`, `interimResults`, `maxAlternatives` and `on<event>` properties. `start()` throws `InvalidStateError` when already started and fires `start`; `stop()` and `abort()` fire `end`. `window.__say(text, {final = true} = {})` fires `result` on every started recogniser with `{resultIndex: 0, results}`, where `results[0]` is `[{transcript: text, confidence: 0.9}]` with `isFinal`. `window.__sayError(code)` fires `error` `{error: code}` then `end`. `window.__recognizers` lists instances.
- `SpeechSynthesisUtterance`: an `EventTarget` class with `text`, `voice`, `rate`, `volume`, `pitch`, `lang` and `on<event>` properties.
- `speechSynthesis` (through `Object.defineProperty` on `window`): it queues utterances and pushes each `text` to `window.__spoken` when it starts. It fires `start` after 0 ms and `end` after 10 ms. `cancel()` empties the queue and fires `error` `{error: 'canceled'}` on the current one. It has `speaking`, `pending`, `paused`, `pause()` and `resume()`, and `getVoices()` returns `[{voiceURI: 'fake-en-US', name: 'Fake English', lang: 'en-US', localService: true, default: true}]`.
- `navigator.wakeLock.request(type)` resolves to an `EventTarget` sentinel with `type`, `released` and `release()`. `window.__wakeLock = {active, requests}` tracks it.

Plan 03 may add the on-device availability methods to the fake.

`axe.js`: run `new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])`, applying `exclude` selectors, and then `expect` the list of `"<id>: <targets>"` for violations with impact `serious` or `critical` to equal `[]`.

- [ ] **Step 5: Run it and see it pass**

Run: `npx playwright test -c tests/e2e/playwright.config.js tests/e2e/harness.spec.js`
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/playwright.config.js tests/e2e/helpers tests/fixtures/routes.js tests/fixtures/http/ping.json tests/e2e/harness.spec.js
git commit -m "Add the Playwright harness with network mocks, speech fakes and axe"
```

### Task 11: DOM builder, live regions, theme and toasts

**Files:**
- Create: `src/ui/dom.js`, `src/ui/a11y.js`, `src/ui/theme.js`, `src/ui/toast.js`
- Test: `tests/unit/theme.test.js`, `tests/e2e/dom.spec.js`

**Interfaces:**
- Consumes: `test`, `expect` (Task 10).
- Produces: `h(tag, props?, ...children) → HTMLElement`, `clear(el)`; `announce(text, {assertive = false} = {})`, `focusMain()`; `applyAccessSettings(settings, root = document.documentElement)`; `showToast(message, {undo, ms = 5000, action} = {}) → {close()}`, where `action = {label, run}`, and `ms: 0` means the toast stays until it is closed.

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
test('h drops unsafe link schemes', async ({ page }) => {
  expect(await page.evaluate(async () => {
    const { h } = await import(new URL('ui/dom.js', document.baseURI).href);
    const bad = ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', ' javascript:alert(1)', 'java\tscript:alert(1)', 'data:text/html,<b>x</b>', 'vbscript:x']
      .map(u => h('a', { href: u }).hasAttribute('href'));
    return [...bad, h('a', { href: 'https://x.org/' }).getAttribute('href'), h('a', { href: '#/feed' }).hasAttribute('href'),
      h('img', { src: 'data:image/png;base64,AA' }).hasAttribute('src'), h('iframe', { src: 'data:text/html,x' }).hasAttribute('src')];
  })).toEqual([false, false, false, false, false, false, 'https://x.org/', true, true, false]);
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
test('showToast offers Undo for 5 seconds and announces politely', async ({ page }) => {
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
});
test('nav links are at least 56 px and show a 3 px focus ring', async ({ page }) => {
  for (const link of await page.getByRole('navigation', { name: 'Main' }).getByRole('link').all())
    expect((await link.boundingBox()).height).toBeGreaterThanOrEqual(56);
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  expect(await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return [s.outlineStyle, s.outlineWidth]; })).toEqual(['solid', '3px']);
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `node --test tests/unit/theme.test.js`, then `npm run build` and `npx playwright test -c tests/e2e/playwright.config.js tests/e2e/dom.spec.js`
Expected: FAIL with `Cannot find module` (unit) and failed dynamic imports of `ui/dom.js` (e2e).

- [ ] **Step 3: Implement `dom.js` and `a11y.js`**

`h`: props `class` → `className`; `text` → `textContent`; `on<Event>` → `addEventListener(lowercased event, fn)`; `style` → throw `Error('h: style is blocked by the CSP; use a class')`; `null`, `undefined` and `false` values are skipped; `true` sets an empty attribute; anything else uses `setAttribute`. For `href`, `src`, `action`, `formaction` and `poster`, it removes ASCII whitespace and control characters, resolves the value against `document.baseURI`, and sets it only when the result has the page's origin, or uses the `http:`, `https:` or `blob:` protocol, or is `data:` on an `img`. Otherwise it skips the attribute and calls `console.warn('h: dropped unsafe URL')`. Children: arrays flatten, strings and numbers become text nodes, and `null`/`false` are skipped. `announce` sets the region's `textContent` to `''`, then sets `text` 50 ms later, so a repeated message is spoken again. `focusMain` calls `document.getElementById('main').focus()`.

- [ ] **Step 4: Implement `theme.js` and `toast.js`**

`applyAccessSettings`: `theme` in `system|light|dark|high-contrast`, `font` in `system|atkinson` and `motion` in `system|reduced|full`, where any other value gives `'system'`. It sets `--text-scale` to `String(clamp(textScale, 1, 2))`. `showToast` replaces any open toast in `#toasts` with a `div.toast` that holds the message, then an **Undo** button when `undo` is given and an `action.label` button when `action` is given. It calls `announce(message)`. Undo awaits `undo()` and closes. Action calls `run()` and closes. It closes after `ms` unless `ms` is `0`. Never pass `Infinity` to `setTimeout`, because it fires at once.

- [ ] **Step 5: Run them and see them pass**

Run: `node --test tests/unit/theme.test.js`, then `npm run build` and `npx playwright test -c tests/e2e/playwright.config.js tests/e2e/dom.spec.js`
Expected: PASS, 1 unit test and 6 e2e tests.

- [ ] **Step 6: Commit**

```bash
git add src/ui/dom.js src/ui/a11y.js src/ui/theme.js src/ui/toast.js tests/unit/theme.test.js tests/e2e/dom.spec.js
git commit -m "Add the DOM builder, live regions, access attributes and toasts"
```

### Task 12: Router, view registries and boot

**Files:**
- Create: `src/ui/router.js`, `src/ui/views/index.js`, `src/ui/views/settings/index.js`, `tests/e2e/helpers/app.js`
- Modify: `src/ui/boot.js` (replace the Task 9 stub)
- Test: `tests/unit/router.test.js`, `tests/unit/boot-data.test.js`, `tests/e2e/shell.spec.js`

**Interfaces:**
- Consumes: everything from Tasks 2–11; `createPwaPlatform`, `registerServiceWorker` (Task 7).
- Produces:
  - `router.js`: `ROUTES`, `registerView(route, {title, render(container, app, params), leave?})` (a later registration for the same route replaces the earlier one; an unknown route throws `Error('unknown route: <route>')`), `getView(route) → view|undefined`, `parseHash(hash) → {route, params}`, `buildHash(route, params = {}) → string`, `startRouter(render)`, `navigate(route, params = {})`. `params` is `{id?: string}` for `#/<route>/<id>` (a Daily Fate date or a settings section id) and `{payload: string}` for `#s=<payload>`.
  - `views/settings/index.js`: `registerSettingsSection({id, label, order, render(container, app)})`, `listSettingsSections() → Array` sorted by `order`. It registers the `settings` view.
  - `views/index.js`: imports `./settings/index.js`, then registers a placeholder view for each of `stumble feed daily vault saved import` that has no view yet. Later plans add their import lines above this.
  - `boot.js`: `DATA_FILES = {tags: 'tags.json', library: 'library.json', vaultStarter: 'vault-starter.json', geocities: 'geocities-seeds.json'}`, `EMPTY_DATA` (the empty shapes from Task 9), `loadData(fetchFn, baseUrl) → Promise<object>`, `STORAGE_OFF_MESSAGE = 'Storage is blocked in this browser. Nothing you save will be kept.'`, `VIEW_FAILED_MESSAGE = 'This view failed to load.'`, `boot(platform) → Promise<App>` with the Plan 01 `App` fields plus `getSettings()`, and `bootFromShell()`. Plans 07 and 08 add their shells' branches to `bootFromShell`.
  - `tests/e2e/helpers/app.js`: `gotoApp(page, hash = '#/stumble')`. It loads the page, then clicks **Skip** while a `[data-firstrun]` element is shown, then waits for the `h1`.

View titles: `stumble` "Stumble", `feed` "Feed", `daily` "Daily Fate", `vault` "Vault", `saved` "Saved", `settings` "Settings", `import` "Import". A placeholder renders an `h1` with its title and the paragraph "Nothing here yet.".

- [ ] **Step 1: Write the failing unit tests**

`tests/unit/router.test.js`:

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
```

`tests/unit/boot-data.test.js`:

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
```

- [ ] **Step 2: Write the failing e2e spec** `tests/e2e/shell.spec.js`

```js
test('routes between the registered views', async ({ page }) => {
  await gotoApp(page); const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(page.getByRole('heading', { level: 1, name: 'Stumble' })).toBeVisible();
  for (const label of ['Feed', 'Daily Fate', 'Vault', 'Saved', 'Settings']) {
    await nav.getByRole('link', { name: label }).click();
    await expect(page.getByRole('heading', { level: 1, name: label })).toBeVisible();
    await expect(page).toHaveTitle(`${label} · Byways`);
    await expect(nav.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page');
  }
  await expect(page.locator('#main')).toBeFocused();
});
test('unknown hashes land on Stumble', async ({ page }) => {
  await gotoApp(page, '#/nope'); await expect(page.getByRole('heading', { level: 1, name: 'Stumble' })).toBeVisible();
});
test('settings sections register and route', async ({ page }) => {
  await gotoApp(page, '#/settings');
  await page.evaluate(async () => {
    const s = await import(new URL('ui/views/settings/index.js', document.baseURI).href);
    s.registerSettingsSection({ id: 'test', label: 'Test section', order: 5, render: c => c.append('hello') });
    location.hash = '#/feed'; location.hash = '#/settings';
  });
  await page.getByRole('link', { name: 'Test section' }).click();
  await expect(page).toHaveURL(/#\/settings\/test$/); await expect(page.locator('#app')).toContainText('hello');
  await expect(page.getByRole('link', { name: 'All settings' })).toHaveAttribute('href', '#/settings');
});
test('a view that throws leaves the shell working', async ({ page }) => {
  await gotoApp(page);
  await page.evaluate(async () => {
    const r = await import(new URL('ui/router.js', document.baseURI).href);
    r.registerView('vault', { title: 'Vault', render() { throw new Error('boom'); } }); r.navigate('vault');
  });
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

The spec imports `test`, `expect` from `./helpers/net.js` and `gotoApp` from `./helpers/app.js`.

- [ ] **Step 3: Run them and see them fail**

Run: `node --test tests/unit/router.test.js tests/unit/boot-data.test.js`
Expected: FAIL with `Cannot find module` for `src/ui/router.js` in both files.
Run: `npm run build`, then `npx playwright test -c tests/e2e/playwright.config.js tests/e2e/shell.spec.js`
Expected: FAIL with `Cannot find module` for `./helpers/app.js`.

- [ ] **Step 4: Implement `router.js` and the two registries**

`parseHash`: `#s=<payload>` with a non-empty payload gives `import`. Otherwise it splits `#/route/id`, lower-cases `route`, and checks it with `ROUTES.includes`; an unknown or empty route gives `stumble` with no params. It decodes `id` with `decodeURIComponent` inside try/catch and drops the id when decoding fails. It ignores segments after the id. `buildHash` encodes `id` with `encodeURIComponent`. `startRouter(render)` calls `render(parseHash(location.hash))` with `(route, params)` now and on each `hashchange`. `navigate` sets `location.hash`, and calls `render` directly when the hash is unchanged. The settings view renders an `h1` "Settings" and a list of section links `#/settings/<id>`, or the paragraph "Nothing to set yet." when there are none. For `params.id` matching a section, it renders an `h1` with the section label, an "All settings" link to `#/settings`, and a container passed to `section.render(container, app)`.

- [ ] **Step 5: Implement `boot.js`**

`loadData` fetches `new URL('data/' + file, baseUrl).href` for each `DATA_FILES` entry in parallel. A failed fetch, a non-ok status or bad JSON gives `structuredClone(EMPTY_DATA[key])`.

`boot(platform)`:
1. Opens `openStore(idbBackend())`. If that rejects, it opens `openStore(memoryBackend())` and later calls `announce(STORAGE_OFF_MESSAGE, {assertive: true})`.
2. Loads settings and calls `applyAccessSettings`.
3. Builds `clock = realClock`, `rand = mulberry32(crypto.getRandomValues(new Uint32Array(1))[0])`, `http = createHttp({transport: platform.transport, clock})` and `data = await loadData(platform.transport.fetch, document.baseURI)`.
4. Makes `app = {store, settings, getSettings, saveSettings, http, clock, rand, platform, data}`. `app.saveSettings(patch)` calls the core `saveSettings`, copies the result onto the live `settings` object, and re-applies access settings.
5. Wires the `.skip-link` click to `preventDefault()` and `focusMain()`.
6. Awaits `runFirstRun(app)` (Task 13; until then, skip this step).
7. Calls `startRouter(show)` and returns `app`.

`show(route, params)` calls the previous view's `leave?.()`. It replaces `#app`'s children with a fresh `div.view` (so a slow render from an earlier route writes into a detached node), and sets `document.title` to `<title> · Byways`. It sets `aria-current="page"` on the matching `nav a[href="#/<route>"]` and removes it from the others. It awaits `view.render(div, app, params)`. On a throw it shows an `h1` with the title, the paragraph `VIEW_FAILED_MESSAGE`, and calls `announce(VIEW_FAILED_MESSAGE, {assertive: true})`. After the first render it calls `focusMain()` on each route change. `boot.js` imports `./views/index.js` for its side effects.

`bootFromShell()`: when `document.documentElement.dataset.shell === 'pwa'`, it opens a secrets store (IndexedDB, or memory on failure), calls `boot(createPwaPlatform({secretsStore}))`, then `registerServiceWorker(window, onUpdate)` (Task 14 supplies `onUpdate`; until then pass `() => {}`). The last line of the module is `if (globalThis.document?.documentElement?.dataset?.shell) bootFromShell();`.

- [ ] **Step 6: Run them and see them pass**

Run: `node --test tests/unit/router.test.js tests/unit/boot-data.test.js`
Expected: PASS, 4 tests.
Run: `npm run build`, then `npx playwright test -c tests/e2e/playwright.config.js tests/e2e/shell.spec.js`
Expected: PASS, 5 tests.

- [ ] **Step 7: Commit**

```bash
git add src/ui/router.js src/ui/views/index.js src/ui/views/settings/index.js src/ui/boot.js tests/e2e/helpers/app.js tests/unit/router.test.js tests/unit/boot-data.test.js tests/e2e/shell.spec.js
git commit -m "Add the hash router, view registries and app boot"
```

### Task 13: First run and the Welcome step

**Files:**
- Create: `src/ui/firstrun.js`
- Modify: `src/ui/boot.js` (await `runFirstRun(app)` before `startRouter`)
- Test: `tests/e2e/firstrun.spec.js`

**Interfaces:**
- Consumes: `h`, `clear` (Task 11); `app.getSettings()`, `app.saveSettings(patch)` (Task 12).
- Produces: `registerFirstRunStep({id, order, render(container, app, done)})`, `runFirstRun(app) → Promise<void>`, `PRIVACY_PROMISE` = `'There is no Byways server. Your keys, collections and history are stored only on this device. Network calls go only to the sources and AI providers you turn on.'` (the §1 promise, verbatim). Each step renders inside `section[data-firstrun="<id>"]` in `#app`.

- [ ] **Step 1: Write the failing spec** `tests/e2e/firstrun.spec.js`

```js
const PRIVACY = 'There is no Byways server. Your keys, collections and history are stored only on this device. Network calls go only to the sources and AI providers you turn on.';
test('the first visit shows Welcome with the privacy promise, once', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1, name: 'Welcome to Byways' })).toBeVisible();
  await expect(page.getByText(PRIVACY, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Skip' })).toBeVisible();
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
    f.registerFirstRunStep({ id: 'b', order: 20, render: (c, app, done) => c.append(Object.assign(document.createElement('button'), { textContent: 'Finish b', onclick: done })) });
    f.registerFirstRunStep({ id: 'boom', order: 15, render: () => { throw new Error('x'); } });
    f.registerFirstRunStep({ id: 'a', order: 10, render: c => c.append('Step a') });
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

- [ ] **Step 2: Run it and see it fail**

Run: `npm run build`, then `npx playwright test -c tests/e2e/playwright.config.js tests/e2e/firstrun.spec.js`
Expected: FAIL: the "Welcome to Byways" heading is not found.

- [ ] **Step 3: Implement `src/ui/firstrun.js` and wire it into boot**

`runFirstRun(app)` returns at once when `app.getSettings().firstRunDone` is true. Otherwise it runs the steps sorted by `order`. For each step it clears `#app` and appends a `section` with `data-firstrun=<id>`. It calls `render(section, app, done)` and appends a **Skip** button. It moves on when `done()` is called or Skip is pressed. A step whose `render` throws is passed over. After the last step it awaits `app.saveSettings({firstRunDone: true})`. The module registers the Welcome step `{id: 'welcome', order: 0}`, which renders an `h1` "Welcome to Byways" (`tabindex="-1"`, focused on show), a paragraph with `PRIVACY_PROMISE`, and a **Continue** button that calls `done`. In `boot.js`, await `runFirstRun(app)` before `startRouter(show)`.

- [ ] **Step 4: Run it and see it pass**

Run: `npm run build`, then `npx playwright test -c tests/e2e/playwright.config.js tests/e2e/firstrun.spec.js tests/e2e/shell.spec.js`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/ui/firstrun.js src/ui/boot.js tests/e2e/firstrun.spec.js
git commit -m "Add the first-run registry with the Welcome step"
```

<!-- PLAN CONTINUES -->
