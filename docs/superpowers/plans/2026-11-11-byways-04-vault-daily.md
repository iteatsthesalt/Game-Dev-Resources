# Byways 04: Vault and Daily Fate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Internet Archive client and Vault (hidden games, gem score, Play with a watchdog), Daily Fate (file plus backup recipe), the old-web, itch.io and webring sources, the daily data job with link check, and the weekly live probe.

**Architecture:** One shared Archive queue (`ia/client.js`) sits on Plan 01's `Http` and serves every Archive caller: the `ia`, `vault` and `oldweb` adapters, the card's **Play** (in every view) and the Node tools. Gem logic (`ia/vault.js`) and the Daily recipe (`daily.js`) are pure core modules with injected fetchers, so the browser and `tools/data-job.js` run the same code. Generated data files are read through `app.dataUrl`, so the extension and Android read them from Pages. The UI adds two views through Plan 01's registries, and the CI jobs run the Node tools with a descriptive User-Agent.

**Tech Stack:** JavaScript ES2022 modules (no framework, no bundler), `node:test`, `@playwright/test@1.63.0` (Chromium), GitHub Actions on `ubuntu-24.04`.

**Spec:** `docs/superpowers/specs/2026-11-11-byways-design.md` (§9.2, §10, §7.2, §7.5, §17.2, §17.4, §20). Contract: `docs/superpowers/plans/2026-11-11-byways-00-overview.md`. Research: `byways-research/internet-archive.md`, `free-sources.md`, `critic.md`.

## Global Constraints

- Everything in the overview's "Global constraints (every plan)" and "Working conventions" applies. Commands run in `Apps/Byways/`.
- Archive queue: "plain anonymous GETs, with no custom headers and `credentials: 'omit'`; 1 request per second and 2 at a time; `Retry-After` honoured; after two 429s in a row, a 5-minute pause." Searches are cached for 24 h and metadata for 7 days.
- Archive search uses `advancedsearch.php` only. Random offsets stay below `min(numFound, 10000)`.
- "Ratings only add a bonus. They never filter a game out."
- The only frame is `<iframe src="https://archive.org/embed/<id>" allow="fullscreen; autoplay; gamepad" allowfullscreen>`, mounted only after **Play**. "A game only starts after **Play**, never automatically. Lean-back pauses while it runs."
- "If the game has not loaded after 15 s, or you tap **Not working**, Byways offers **Open on archive.org** (`/details/<id>`) and marks the item embed-broken on this device. Fate then skips it."
- "Byways never downloads Archive files into the Lab." "Every Archive card shows Archive attribution and links to its details page. Byways never rehosts Archive files."
- Archive thumbnails load only through `<img src="https://archive.org/services/img/<id>">`, never through `fetch` or canvas.
- `feature_films` is `mixed`, so while the Family filter is on the `ia` adapter leaves it out of every call (Fate and lean-back included).
- Daily Fate: "The day rolls over at UTC midnight. The view shows the next rollover in local time." The backup is labelled **Daily Fate (backup pick)**. "**Share today's Fate** gives spoiler-free text with a link to `#/daily/YYYY-MM-DD`. Streaks are gentle and never nag."
- Data job: "it sends a descriptive User-Agent with no personal data, and makes light, low-volume requests." "If a data step fails, it keeps the last good file from the live site." Schedule: 00:07 UTC (`'7 0 * * *'`).
- Link check: "A link that fails two days in a row is left out of the next build, and its entry is flagged for review."
- Old web: "Each is opened through `archive.org/wayback/available?url=…&timestamp=2009`, and an empty result counts as a miss."
- Every test mocks the network. Live checks run only in `byways-probe.yml`.
- Generated data files (`daily.json`, `itch.json`, `vault-index.json`, `webrings.json`, `neocities.json`) are read only at `app.dataUrl(<file>)`: `data/<file>` in the web app, `https://iteatsthesalt.github.io/Game-Dev-Resources/byways/data/<file>` in the extension and Android (contract).
- Sub-collections (§10.1) are not discovered at runtime. The Vault queries its explicit list, and the weekly probe (Task 15) reports each parent's sub-collections so they can be added to `VAULT_COLLECTIONS` by hand.
- Views and `card.js` touch `document`, `window` and `matchMedia` only inside functions, because Node unit tests import `boot.js`, which imports every view.

## Review Focus

1. **The Archive is down or blocked.** Validation must keep the verified collections and must not cache a partial list for 7 days. A failed live load must show "Archive unavailable" and keep the snapshot gems, and **Play** must not mark a game broken while the Archive is only unreachable. Pinned by `validateCollections keeps verified ids and caches nothing when the Archive is unreachable` (Task 2), `shows Archive unavailable when a live shelf load fails` (Task 9) and `an unreachable Archive shows a message instead of a frame` (Task 10).
2. **Archive docs with odd field shapes.** `title`, `creator` and `collection` arrive as a string or an array, `year` as `"1994"`, `"199?"` or missing, `downloads` missing or 0, and `description` as an HTML array. Cards and scores must still work. Pinned by `iaDocToFind and gemScore accept string, array and missing fields` (Task 2).
3. **UTC midnight while the Daily view is open, or a stale `daily.json`.** At 23:59:50 UTC the view must roll to the next day by itself. A file dated yesterday must give the labelled backup, and a service-worker copy from yesterday must not hide today's file. Pinned by `loadDaily uses the backup when the file is from yesterday` (Task 3), and by `rolls over at UTC midnight while open` and `shows today's three picks from daily.json?d=<today>` (Task 11).
4. **Link-check false positives.** Sites that answer `HEAD` with 405, or block robots with 403 or 429, must not be counted as dead, and two runs on one day must count once. Pinned by `HEAD 405 retries with GET, and 401/403/429 do not count as dead` and `a second check on the same UTC day does not count again` (Task 12).
5. **Pressing Play twice, or leaving the Vault while the watchdog runs.** There must be one frame, and a pending watchdog must not mark a game broken after the user has left. Pinned by `Play twice mounts one frame, and leaving clears the watchdog` (Task 10).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/core/ia/client.js` | The one Archive queue: pacing, `Retry-After` hold, 429 pause, caching, `search`, `count`, `metadata`, `wayback`, `luceneEscape`, `sharedIaClient` |
| `src/core/ia/vault.js` | Collections, shelves, labels, gem query and score, why chips, doc → Find, validation, shelf gems, Vault Fate |
| `src/core/daily.js` | Daily seed, backup recipe, file loading, pick → Find mappers |
| `src/core/sources/ia.js` | Archive non-game adapter (films, audio, magazines) |
| `src/core/sources/vault.js` | Archive games adapter, with the snapshot fallback and embed-broken skip |
| `src/core/sources/oldweb.js` | GeoCities seeds through Wayback |
| `src/core/sources/itch.js` | itch.io feeds: live with privileged fetch, else the snapshot; `parseItchRss` |
| `src/core/sources/webring.js` | Webring and Neocities cards from the snapshot extras |
| `src/core/sources/index.js` (modify) | `readSnapshot`; registers `ia`, `vault`, `oldweb`, `itch`, `webring` |
| `src/ui/components/card.js` (modify) | Card heading level, details link, **Keyboard needed** badge, `mountPlayer` and the `play` action |
| `src/ui/views/vault.js` | Vault view and shelves |
| `src/ui/views/daily.js` | Daily Fate view |
| `src/ui/boot.js`, `src/ui/views/index.js` (modify) | `app.dataUrl`, `app.ia`, the embed-broken set, view imports |
| `src/data/vault-starter.json`, `src/data/geocities-seeds.json` (modify) | Curated data |
| `tools/data-job.js` | Writes `daily.json`, `itch.json`, `vault-index.json`, `linkcheck.json` and the snapshot extras |
| `tools/linkcheck.js` | Checks library links and keeps fail streaks |
| `tools/build.js` (modify) | `{"v":1}` placeholders for the generated files; `--linkcheck <file>` drops entries with `failStreak ≥ 2` |
| `tools/probe-live.js` | The §17.4 live checks and Markdown report |
| `.github/workflows/byways-probe.yml`, `.github/workflows/pages.yml`, `README.md` (modify) | Weekly probe; daily data step; the optional `NASA_API_KEY` secret |
| `tests/unit/helpers/fake-fetch.js` | `fakeFetch`, `instantClock` and `readFixture` for unit tests |
| `tests/unit/sources-index.test.js`, `tests/unit/workflows.test.js`, `tests/e2e/axe.spec.js` (modify) | Plan 02's registry table, Plan 01's workflow checks, Plan 03's axe views |
| `tests/fixtures/http/{ia,daily,itch,pages,datajob}/*`, `tests/fixtures/routes.js` (modify) | Hand-written fixtures from the research shapes |

### Task 1: The Archive client and queue

**Files:**
- Create: `src/core/ia/client.js`, `tests/unit/helpers/fake-fetch.js`
- Test: `tests/unit/ia-client.test.js`

**Interfaces:**
- Consumes: `createHttp({transport, clock}) → Http` (`request`, `getJson`); `new NetError(kind, message, {status, retryAfterMs, source})`; `createCache(store, clock)`; `openStore(memoryBackend())`; `fakeClock(start)` with `advance(ms)`.
- Produces: `createIaClient({http, cache, clock}) → IaClient`, where `IaClient = {search({q, fl, sort, rows, page}) → Promise<{numFound, docs}>, count(q) → Promise<number>, metadata(id) → Promise<object|null>, wayback(url, timestamp) → Promise<{url, timestamp}|null>}`. Failures reject with `NetError`; the circuit pause rejects with `kind: 'circuit'`. `sharedIaClient({http, cache, clock}) → IaClient` returns one client per `http` object. Test helpers `fakeFetch(routes, {clock}?) → {fetch(url, init) → Promise<Response>, calls: Array<{url, init, at}>}` (routes are `[RegExp, (url, init) => ({status?, body?, headers?}) | Promise<…>]`; the first match answers; an object body is sent as JSON and a string as text; a responder that throws makes `fetch` reject; unmatched URLs get 404), `instantClock(start = Date.UTC(2026, 10, 11, 12)) → {now, setTimeout, clearTimeout}`, whose `setTimeout(fn, ms)` runs `fn` on `setImmediate` after adding `ms` to `now` (a cleared timer adds nothing), and `readFixture(path) → string`, which reads `tests/fixtures/http/<path>` as UTF-8.

- [ ] **Step 1: Write the helpers, then the failing tests**

Set up each test with `clock = fakeClock(0)`, `cache = createCache(await openStore(memoryBackend()), clock)`, `net = fakeFetch(routes, {clock})`, `http = createHttp({transport: net, clock})` and `ia = createIaClient({http, cache, clock})`. `flush = () => new Promise(r => setImmediate(r))`.

```js
test('search builds the advancedsearch URL with fl[], sort[], rows, page and output=json', async () => {
  // route /advancedsearch/ → {response: {numFound: 2, docs: [{identifier: 'a'}, {identifier: 'b'}]}}
  const r = await ia.search({ q: 'collection:(x)', fl: ['identifier', 'title'], sort: ['downloads asc'], rows: 100, page: 3 });
  const u = new URL(net.calls[0].url);
  assert.equal(u.origin + u.pathname, 'https://archive.org/advancedsearch.php');
  assert.equal(u.searchParams.get('q'), 'collection:(x)');
  assert.deepEqual(u.searchParams.getAll('fl[]'), ['identifier', 'title']);
  assert.deepEqual(u.searchParams.getAll('sort[]'), ['downloads asc']);
  assert.equal(u.searchParams.get('rows'), '100');
  assert.equal(u.searchParams.get('page'), '3');
  assert.equal(u.searchParams.get('output'), 'json');
  assert.deepEqual(r, { numFound: 2, docs: [{ identifier: 'a' }, { identifier: 'b' }] });
});
test('requests carry no custom headers and no credentials', async () => {
  await ia.count('collection:(x)');
  assert.equal([...new Headers(net.calls[0].init.headers ?? {})].length, 0);
  assert.notEqual(net.calls[0].init.credentials, 'include');
});
test('count sends rows=0 and returns numFound', async () => {
  assert.equal(await ia.count('collection:(x)'), 2);
  assert.equal(new URL(net.calls[0].url).searchParams.get('rows'), '0');
});
test('metadata returns the result object, and null for an empty reply', async () => {
  // /metadata/msdos_Whizz_1994/metadata → {result: {mediatype: 'software', emulator: 'dosbox'}}; /metadata/nope/metadata → {}; /metadata/blank/metadata → {result: {}}
  assert.deepEqual(await ia.metadata('msdos_Whizz_1994'), { mediatype: 'software', emulator: 'dosbox' });
  assert.equal(net.calls[0].url, 'https://archive.org/metadata/msdos_Whizz_1994/metadata');
  clock.advance(1000); assert.equal(await ia.metadata('nope'), null);
  clock.advance(1000); assert.equal(await ia.metadata('blank'), null);
});
test('requests start at least 1000 ms apart', async () => {
  const p = ['a', 'b', 'c'].map((q) => ia.count(q));
  await flush(); clock.advance(1000); await flush(); clock.advance(1000); await Promise.all(p);
  assert.deepEqual(net.calls.map((c) => c.at), [0, 1000, 2000]);
});
test('at most 2 requests run at once', async () => {
  // responder returns new Promise(() => {}) (never settles)
  ['a', 'b', 'c'].forEach((q) => ia.count(q).catch(() => {}));
  await flush(); clock.advance(5000); await flush();
  assert.equal(net.calls.length, 2);
});
test('two 429s in a row pause the queue for 5 minutes', async () => {
  // responder: status 429 (no Retry-After) until `ok = true`, then 200
  await assert.rejects(ia.count('a'), { status: 429 }); clock.advance(1000);
  await assert.rejects(ia.count('b'), { status: 429 }); clock.advance(1000);
  const before = net.calls.length;
  await assert.rejects(ia.count('c'), { kind: 'circuit' });
  assert.equal(net.calls.length, before);
  ok = true; clock.advance(300000);
  assert.equal(await ia.count('d'), 2);
});
test('a 429 with Retry-After: 30 holds the queue for 30 s', async () => {
  // responder: the first call answers 429 with Retry-After: 30, later calls 200
  await assert.rejects(ia.count('a'), { status: 429, retryAfterMs: 30000 });
  const p = ia.count('b'); await flush(); clock.advance(29999); await flush();
  assert.equal(net.calls.length, 1);
  clock.advance(1); assert.equal(await p, 2); assert.equal(net.calls.at(-1).at, 30000);
});
test('searches are cached for 24 h and metadata for 7 days', async () => {
  await ia.count('a'); await ia.count('a'); assert.equal(net.calls.length, 1);
  clock.advance(86400001); await ia.count('a'); assert.equal(net.calls.length, 2);
  clock.advance(1000); await ia.metadata('msdos_Whizz_1994'); clock.advance(6 * 86400000); await ia.metadata('msdos_Whizz_1994');
  assert.equal(net.calls.length, 3);
  clock.advance(86400001); await ia.metadata('msdos_Whizz_1994'); assert.equal(net.calls.length, 4);
});
test('wayback returns the closest snapshot as https, and null when archived_snapshots is empty', async () => {
  // url=…Area51/1234/ → {archived_snapshots: {closest: {available: true, status: '200', timestamp: '20091027000000',
  //   url: 'http://web.archive.org/web/20091027000000/http://www.geocities.com/Area51/1234/'}}}; url=…/gone/ → {archived_snapshots: {}}
  const hit = await ia.wayback('http://www.geocities.com/Area51/1234/', '2009');
  const u = new URL(net.calls[0].url);
  assert.equal(u.origin + u.pathname, 'https://archive.org/wayback/available');
  assert.equal(u.searchParams.get('url'), 'http://www.geocities.com/Area51/1234/');
  assert.equal(u.searchParams.get('timestamp'), '2009');
  assert.deepEqual(hit, { url: 'https://web.archive.org/web/20091027000000/http://www.geocities.com/Area51/1234/', timestamp: '20091027000000' });
  clock.advance(1000); assert.equal(await ia.wayback('http://www.geocities.com/gone/', '2009'), null);
});
test('sharedIaClient returns one client per http object', () => {
  assert.equal(sharedIaClient({ http, cache, clock }), sharedIaClient({ http, cache, clock }));
  assert.notEqual(sharedIaClient({ http, cache, clock }), sharedIaClient({ http: createHttp({ transport: net, clock }), cache, clock }));
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test tests/unit/ia-client.test.js`
Expected: FAIL with "Cannot find module '…/src/core/ia/client.js'".

- [ ] **Step 3: Implement `createIaClient` and `sharedIaClient` in `src/core/ia/client.js`**

It sends every request as `http.request(url, {source: 'ia'})` with no headers, and never calls `http.register('ia', …)`: Plan 01's `Http` pauses a registered source for 60 s on a 429 or 503 without `Retry-After`, so this queue alone owns Archive pacing and backoff. Base URL `https://archive.org`. Build query strings with `URLSearchParams.append`, one `fl[]` and one `sort[]` per value. `metadata` and a `{}` or `{result: {}}` reply both give `null`. `wayback` returns `null` unless `closest.available` is true, and rewrites a leading `http://web.archive.org/` to `https://web.archive.org/`. Cache keys: `ia:s:<url>` for 86400000 ms, `ia:m:<id>` and `ia:w:<url>|<timestamp>` for 604800000 ms. A cache hit answers without joining the queue. Only successful replies are cached; errors never are. `sharedIaClient` keeps a `WeakMap` keyed by `http`. `Http` throws a `NetError` for any status of 400 or more, so the queue reads statuses from thrown errors:

```js
// state: lastStart = -Infinity, holdUntil = 0, active = 0, waiting = [], streak = 0, pausedUntil = 0, timer = null
// pump(): if (clock.now() < pausedUntil) { reject every waiting job with new NetError('circuit', 'Archive paused after two 429s in a row', {source: 'ia'}); return }
//         if (active >= 2 || !waiting.length || timer) return
//         wait = max(lastStart + 1000, holdUntil) - clock.now(); if (wait > 0) { timer = clock.setTimeout(() => { timer = null; pump() }, wait); return }
//         lastStart = clock.now(); active++; run the first job (on settle: active--; pump()); pump()
// a job that throws a NetError with status 429: streak++, and at streak === 2 → pausedUntil = clock.now() + 300000, streak = 0. Any other outcome → streak = 0.
// a NetError with status 429 or 503 and retryAfterMs > 0 also sets holdUntil = max(holdUntil, clock.now() + retryAfterMs).
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/unit/ia-client.test.js`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/ia/client.js tests/unit/helpers/fake-fetch.js tests/unit/ia-client.test.js
git commit -m "Add the shared Archive client and request queue"
```

---

### Task 2: Vault collections, gem score and Vault Fate

**Files:**
- Create: `src/core/ia/vault.js`
- Test: `tests/unit/ia-vault.test.js`

**Interfaces:**
- Consumes: `IaClient` (Task 1); `makeFind(partial)`; `toPlainText(html)`.
- Produces: `VAULT_COLLECTIONS = {verified: string[], likely: string[], shelves: Array<{id, label, collections: string[], keyboard: boolean}>}`; `CURATED_COLLECTIONS: Set<string>`; `gemQuery(id, page) → {q, fl, sort, rows, page}`; `gemScore(doc, {currentYear, curated}) → number`; `gemWhy(doc) → string[]`; `iaDocToFind(doc, {kind, safety = 'curated', why}) → Find|null`; `validateCollections(ia, cache, ids = [...verified, ...likely]) → Promise<string[]>`; `shelfGems(ia, shelf, {rand, currentYear, skip = new Set(), valid}) → Promise<Find[]>`; `vaultFate(ia, rand, collections) → Promise<Find|null>`.

Values (verbatim from §10.1):

- `verified`: `softwarelibrary_c64_games`, `softwarelibrary_apple_games`, `zx_spectrum_library_games`, `softwarelibrary_msdos_shareware`.
- `likely`: `softwarelibrary_msdos_games`, `softwarelibrary_win3_games`, `softwarelibrary_amiga`, `softwarelibrary_mac`, `consolelivingroom`, `atari_2600_library`, `internetarcade`, `softwarelibrary_flash`, `softwarelibrary_flash_showcase`, `softwarelibrary_palm`, `malwaremuseum`.
- `shelves` (in this order; `keyboard: true` for the first seven): `dos` "DOS" [`softwarelibrary_msdos_shareware`, `softwarelibrary_msdos_games`]; `win3` "Windows 3.x" [`softwarelibrary_win3_games`]; `c64` "C64" [`softwarelibrary_c64_games`]; `apple2` "Apple II" [`softwarelibrary_apple_games`]; `zx` "ZX Spectrum" [`zx_spectrum_library_games`]; `amiga` "Amiga" [`softwarelibrary_amiga`]; `mac` "Mac" [`softwarelibrary_mac`]; `consoles` "Consoles" [`consolelivingroom`, `atari_2600_library`]; `arcade` "Arcade" [`internetarcade`]; `flash` "Flash" [`softwarelibrary_flash`, `softwarelibrary_flash_showcase`]; `palm` "Palm" [`softwarelibrary_palm`]; `malware` "Malware Museum" [`malwaremuseum`].
- `CURATED_COLLECTIONS = new Set(['softwarelibrary_flash_showcase'])`.
- Collection labels for the why chip (module-internal): MS-DOS Shareware, MS-DOS Games, Windows 3.x Games, C64 Games, Apple II Games, ZX Spectrum Games, Amiga, Macintosh, Console Living Room, Atari 2600, Internet Arcade, Flash, Flash Showcase, Palm, Malware Museum (same order as the ids above, verified first).

- [ ] **Step 1: Write the failing tests**

`seq = (...v) => () => v.shift()`. Each test gets a fresh `cache = createCache(await openStore(memoryBackend()), fakeClock(0))` and a stub `ia = {metadata, count, search}` that answers as the test's comment says and records `metadataCalls` (a count), `countArgs` (each `q`) and `searchArgs` (each params object).

```js
test('collections match the spec and leave out the dropped ids', () => {
  assert.equal(VAULT_COLLECTIONS.verified.length, 4);
  assert.equal(VAULT_COLLECTIONS.likely.length, 11);
  assert.deepEqual(VAULT_COLLECTIONS.shelves.map((s) => s.label), ['DOS', 'Windows 3.x', 'C64', 'Apple II', 'ZX Spectrum', 'Amiga', 'Mac', 'Consoles', 'Arcade', 'Flash', 'Palm', 'Malware Museum']);
  const all = [...VAULT_COLLECTIONS.verified, ...VAULT_COLLECTIONS.likely];
  for (const s of VAULT_COLLECTIONS.shelves) for (const c of s.collections) assert.ok(all.includes(c), c);
  for (const d of ['atari_7800_library', 'handheldhistory', 'softwarelibrary_flash_games', 'softwarelibrary_amiga_games', 'softwarelibrary_win3_shareware']) assert.ok(!all.includes(d));
});
test('gemQuery uses the §10.2 query', () => {
  assert.deepEqual(gemQuery('softwarelibrary_msdos_shareware', 4), {
    q: 'collection:(softwarelibrary_msdos_shareware) AND mediatype:software AND downloads:[20 TO 3000]',
    fl: ['identifier', 'title', 'year', 'creator', 'downloads', 'avg_rating', 'num_reviews', 'subject', 'description', 'collection'],
    sort: ['downloads asc'], rows: 100, page: 4 });
});
test('gemScore matches the formula', () => {
  const s = (d, c = []) => gemScore({ collection: ['softwarelibrary_flash', ...c], ...d }, { currentYear: 2026, curated: CURATED_COLLECTIONS });
  const cur = ['softwarelibrary_flash_showcase'];
  assert.ok(Math.abs(s({ downloads: 312, year: 1994, avg_rating: 4.5, num_reviews: 3 }) - 0.401348) < 1e-6);
  assert.ok(Math.abs(s({ downloads: 3000, year: 2026 }) - 0) < 1e-6);
  assert.ok(Math.abs(s({ downloads: 20, year: 1960, avg_rating: 4, num_reviews: 2 }, cur) - 0.812916) < 1e-6);
  assert.ok(Math.abs(s({ downloads: 100, year: 1990, avg_rating: 5, num_reviews: 1 }, cur) - 0.592406) < 1e-6);
  assert.ok(Math.abs(s({ downloads: 1, year: 1990 }) - 0.68) < 1e-6);
});
test('gemWhy gives the chips, the pool first', () => {
  assert.deepEqual(gemWhy({ downloads: 312, collection: ['softwarelibrary_msdos_shareware'], year: '1994', avg_rating: 4.5, num_reviews: 3 }), ['Internet Archive: MS-DOS Shareware', '312 downloads', '1994', '★4.5 (3)']);
  assert.deepEqual(gemWhy({ downloads: 1, collection: 'softwarelibrary_c64_games', year: 1985 }), ['Internet Archive: C64 Games', '1 download', '1985']);
  assert.deepEqual(gemWhy({ downloads: 1234, collection: [] }), ['Internet Archive', '1,234 downloads']);
});
test('iaDocToFind builds an Archive game find', () => {
  const f = iaDocToFind({ identifier: 'msdos_Whizz_1994', title: 'Whizz', creator: 'Flair', year: '1994', downloads: 312, collection: ['softwarelibrary_msdos_shareware'] }, { kind: 'game' });
  assert.equal(f.id, 'ia:msdos_Whizz_1994'); assert.equal(f.source, 'vault'); assert.equal(f.kind, 'game');
  assert.equal(f.url, 'https://archive.org/details/msdos_Whizz_1994');
  assert.equal(f.embedUrl, 'https://archive.org/embed/msdos_Whizz_1994');
  assert.equal(f.imageUrl, 'https://archive.org/services/img/msdos_Whizz_1994');
  assert.equal(f.author, 'Flair'); assert.equal(f.attribution, 'Internet Archive'); assert.equal(f.safety, 'curated');
  assert.deepEqual(f.tags, ['retro']); assert.deepEqual(f.why, ['Internet Archive: MS-DOS Shareware', '312 downloads', '1994']);
  assert.deepEqual(f.meta, { identifier: 'msdos_Whizz_1994', downloads: 312, year: 1994, collection: 'softwarelibrary_msdos_shareware', platform: 'DOS' });
  assert.equal(iaDocToFind({ identifier: 'bad id/../x', title: 'X' }, { kind: 'game' }), null);
});
test('iaDocToFind and gemScore accept string, array and missing fields', () => {   // Review Focus 2
  const f = iaDocToFind({ identifier: 'x_1', title: ['First', 'Second'], creator: ['A', 'B'], year: '199?', description: ['<p>Fun &amp; games</p>'], collection: 'softwarelibrary_c64_games' }, { kind: 'game' });
  assert.equal(f.title, 'First'); assert.equal(f.author, 'A'); assert.equal(f.description, 'Fun & games');
  assert.equal(f.meta.year, null); assert.equal(f.meta.downloads, null);
  assert.equal(iaDocToFind({ identifier: 'no_title' }, { kind: 'game' }).title, 'no_title');
  assert.ok(Math.abs(gemScore({ downloads: 0, year: 3000 }, { currentYear: 2026, curated: CURATED_COLLECTIONS }) - 0.5) < 1e-6);
  assert.equal(gemScore({}, { currentYear: 2026, curated: CURATED_COLLECTIONS }), 0);
});
test('validateCollections keeps collections and caches the list for 7 days', async () => {
  // stub ia.metadata: 'softwarelibrary_palm' → null, 'malwaremuseum' → {mediatype: 'texts'}, others → {mediatype: 'collection'}
  const ok = await validateCollections(ia, cache);
  assert.equal(ok.length, 13); assert.ok(!ok.includes('softwarelibrary_palm'));
  const n = metadataCalls; await validateCollections(ia, cache); assert.equal(metadataCalls, n);
});
test('validateCollections keeps verified ids and caches nothing when the Archive is unreachable', async () => {   // Review Focus 1
  // stub ia.metadata always throws Object.assign(new Error('down'), {kind: 'network'})
  assert.deepEqual(await validateCollections(ia, cache), VAULT_COLLECTIONS.verified);
  const n = metadataCalls; await validateCollections(ia, cache); assert.ok(metadataCalls > n);
});
test('shelfGems takes a random page and sorts by gem score', async () => {
  // stub count → 250; search → docs {identifier 'big', title 'Big', downloads 3000}, {'mid', 'Mid', 312}, {'tiny', 'Tiny', 20}, all year 1990
  const finds = await shelfGems(ia, VAULT_COLLECTIONS.shelves[0], { rand: seq(0, 0.5), currentYear: 2026, skip: new Set(['ia:big']) });
  assert.equal(searchArgs[0].page, 2);
  assert.ok(searchArgs[0].q.startsWith('collection:(softwarelibrary_msdos_shareware)'));
  assert.deepEqual(finds.map((f) => f.title), ['Tiny', 'Mid']);
});
test('vaultFate counts, then fetches one item at a random offset', async () => {
  // stub count → 250
  const f = await vaultFate(ia, seq(0, 0.5), ['softwarelibrary_c64_games']);
  assert.equal(countArgs[0], 'collection:(softwarelibrary_c64_games) AND mediatype:software');
  assert.deepEqual([searchArgs[0].rows, searchArgs[0].page, searchArgs[0].sort], [1, 126, ['identifier asc']]);
  assert.equal(f.kind, 'game');
});
test('vaultFate narrows by year range above 10,000, and gives null for an empty pool', async () => {
  // stub count: first call 20000, then 400
  await vaultFate(ia, seq(0, 0.5, 0.25), ['softwarelibrary_c64_games']);
  assert.equal(countArgs[1], 'collection:(softwarelibrary_c64_games) AND mediatype:software AND year:[1995 TO 1999]');
  assert.equal(searchArgs[0].page, 101);
  // stub count → 0
  assert.equal(await vaultFate(ia, seq(0), ['softwarelibrary_c64_games']), null);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test tests/unit/ia-vault.test.js`
Expected: FAIL with "Cannot find module '…/src/core/ia/vault.js'".

- [ ] **Step 3: Implement `src/core/ia/vault.js`**

- `gemScore`: `clip = x => Math.min(1, Math.max(0, x))`. `low = clip(1 − ln(max(downloads, 1)) / ln(3000))`, or 0 when `downloads` is missing or not a number. `curated` is 1 when any of the doc's collections is in `curated`. `age = clip((currentYear − year) / 40)`, or 0 without a 4-digit year. `rated` is 1 when `avg_rating ≥ 4` and `num_reviews ≥ 2`. Return `0.5·low + 0.2·curated + 0.2·age + 0.1·rated`.
- Field rules (shared by every function): a value that is an array uses its first item; `year` counts only when it matches `/^\d{4}$/`; the identifier must match `/^[A-Za-z0-9][A-Za-z0-9._-]*$/`, or `iaDocToFind` returns `null`; a missing title falls back to the identifier.
- `gemWhy`: first the pool chip, `'Internet Archive: ' + <label of the first known collection>` or `'Internet Archive'` (Plan 02's first-chip rule, and the §5.3 example "Internet Archive: MS-DOS Shareware · 312 downloads"); then downloads as `n.toLocaleString('en-US') + ' download' + (n === 1 ? '' : 's')`; the year; and `★<avg rounded to 1 decimal, trailing .0 dropped> (<num_reviews>)` when `avg_rating > 0` and `num_reviews ≥ 1`. Leave out any chip after the first whose field is missing.
- `iaDocToFind`: source `'vault'` for `kind: 'game'`, else `'ia'`. Tags `['retro']` for games, else `[]`. `why` defaults to `gemWhy(doc)` for games and `['Internet Archive']` otherwise. `meta.platform` is the label of the shelf that holds `meta.collection`, or `null`.
- `validateCollections`: check ids one at a time with `ia.metadata(id)`, and keep an id when `mediatype === 'collection'`. Cache the list under `'ia:valid:' + ids.join(',')` for 604800000 ms. If any call throws, return the passing ids plus the verified ids among those that threw, and cache nothing.
- `shelfGems`: use the shelf's collections (filtered by `valid` when it is given), pick one with `rand()`, `N = ia.count(gemQuery(id, 1).q)`, and return `[]` when N is 0. Then `page = 1 + floor(rand() · ceil(min(N, 10000) / 100))`. Drop docs whose `'ia:' + identifier` is in `skip`, sort by `gemScore` (highest first, `curated: CURATED_COLLECTIONS`) and map with `iaDocToFind(doc, {kind: 'game'})`.
- `vaultFate`: pick a collection with `rand()`, base query `collection:(<id>) AND mediatype:software`. If N > 10000, `y = 1980 + 5 · floor(rand() · 6)`, add ` AND year:[y TO y+4]` and count again. N = 0 → `null`. `offset = floor(rand() · min(N, 10000))`, then `search({q, fl: gemQuery(id, 1).fl, sort: ['identifier asc'], rows: 1, page: offset + 1})`, and map the doc.

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/unit/ia-vault.test.js`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/ia/vault.js tests/unit/ia-vault.test.js
git commit -m "Add Vault collections, gem score and Vault Fate"
```

---

### Task 3: Daily Fate core

**Files:**
- Create: `src/core/daily.js`, `tests/fixtures/http/daily/library.json`, `tests/fixtures/http/daily/vault-starter.json`, `tests/fixtures/http/daily/wiki-featured.json`, `tests/fixtures/http/daily/apod.json`
- Test: `tests/unit/daily.test.js`

**Interfaces:**
- Consumes: `fnv1a32(str)`, `mulberry32(seed)`; `makeFind(partial)`.
- Produces: `DAILY_SLOTS = ['game','web','wonder']`; `dailySeed(date) → number`; `backupDaily({date, library, vaultStarter, fetchWikiFeatured, fetchApod}) → Promise<DailyFile>`, where `fetchWikiFeatured(date) → Promise<tfa|null>` and `fetchApod(date) → Promise<apod|null>`; `loadDaily({date, fetchDailyFile, backup}) → Promise<{file, backup:boolean}>`; mappers `wikiFeaturedToFind(tfa)`, `apodToFind(apod)`, `libraryEntryToFind(entry)`, `starterToFind(entry)`, each `→ Find|null`. `DailyFile = {v:1, date, picks: Array<{slot, find}>}`.

Fixtures (hand-written from the research shapes):

- `library.json` (`{"v":1,"entries":[…]}`, listed in this order): `lib-0003` "Pixel Weather" (site), `lib-0001` "Paper Toy Garden" (toy), `lib-0006` "The Button Museum" (site), `lib-0004` "Late Arrival" (site, `added` `2026-11-12`), `lib-0002` "A Tiny Handmade Site" (site), `lib-0005` "Moth Radio" (site). Each has `url` `https://<kebab title>.example/`, a one-line `blurb`, `tags: ["web"]` and `added` `2026-11-01` unless stated.
- `vault-starter.json`: `ia:zx_Fixture_Game_1984` "Tape Loader Blues" (ZX Spectrum, 1984), `ia:msdos_Whizz_1994` "Whizz" (DOS, 1994), `ia:apple_Fixture_Game_1983` "Orchard Quest" (Apple II, 1983), `ia:c64_Fixture_Game_1985` "Comet Hopper" (C64, 1985), all `added` `2026-11-01`.
- `wiki-featured.json`: `{tfa: {title: 'Ada_Lovelace', titles: {canonical: 'Ada_Lovelace', normalized: 'Ada Lovelace'}, extract: 'Ada Lovelace was an English mathematician and writer.', content_urls: {desktop: {page: 'https://en.wikipedia.org/wiki/Ada_Lovelace'}}, thumbnail: {source: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Ada.jpg/320px-Ada.jpg'}}, image: {title: 'File:Night moth.jpg', thumbnail: {source: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Night_moth.jpg/640px-Night_moth.jpg'}, file_page: 'https://commons.wikimedia.org/wiki/File:Night_moth.jpg', artist: {text: 'Jane Doe'}, license: {type: 'CC BY-SA 4.0'}, description: {text: 'A moth at night.'}}}`.
- `apod.json`: `{date: '2026-11-14', title: 'Fixture Nebula', explanation: 'A small fixture nebula glows.', media_type: 'image', url: 'https://apod.nasa.gov/apod/image/2611/fixture.jpg', copyright: ' A. Astronomer '}`.

- [ ] **Step 1: Write the failing tests**

`FEED`, `APOD`, `VS` and `LIB` are the four fixtures, parsed from `readFixture('daily/…')`. `backupFor(date, wiki = async () => FEED.tfa, apod = async () => APOD)` calls `backupDaily` with `LIB`, `VS` and fetchers that push each date they get to `wikiCalls` and `apodCalls` (both reset per test) before calling `wiki` or `apod`. `titles = (file) => file.picks.map((p) => p.find.title)`.

```js
test('dailySeed and the PRNG match the test vectors', () => {
  assert.deepEqual(DAILY_SLOTS, ['game', 'web', 'wonder']);
  assert.equal(dailySeed('2026-11-11'), 3348453531);
  assert.equal(dailySeed('2026-11-14'), 3398786388);
  const r = mulberry32(3348453531);   // pins Plan 01's mulberry32 to the standard algorithm
  assert.deepEqual([r(), r(), r()].map((x) => x.toFixed(6)), ['0.300052', '0.364634', '0.339530']);
});
test('backup recipe for 2026-11-11 uses the featured article', async () => {
  const f = await backupFor('2026-11-11');
  assert.deepEqual(wikiCalls, ['2026-11-11']); assert.deepEqual(apodCalls, []);
  assert.deepEqual(f.picks.map((p) => p.slot), ['game', 'web', 'wonder']);
  assert.deepEqual(titles(f), ['Comet Hopper', 'A Tiny Handmade Site', 'Ada Lovelace']);
  assert.equal(f.v, 1); assert.equal(f.date, '2026-11-11');
});
test('backup recipe for 2026-11-12 counts the entry added that day', async () => {
  assert.deepEqual(titles(await backupFor('2026-11-12')), ['Comet Hopper', 'Moth Radio', 'Ada Lovelace']);
});
test('backup recipe for 2026-11-14 uses APOD', async () => {
  const f = await backupFor('2026-11-14');
  assert.deepEqual(apodCalls, ['2026-11-14']);
  assert.deepEqual(titles(f), ['Orchard Quest', 'Paper Toy Garden', 'Fixture Nebula']);
});
test('wonder falls back to the other source, and is left out when both fail', async () => {
  const boom = async () => { throw new Error('down'); };
  assert.equal(titles(await backupFor('2026-11-11', boom))[2], 'Fixture Nebula');
  assert.deepEqual((await backupFor('2026-11-11', boom, async () => null)).picks.map((p) => p.slot), ['game', 'web']);
});
test('mappers build finds with the same fields as the Stumble adapters', () => {
  const w = wikiFeaturedToFind(FEED.tfa);
  assert.deepEqual([w.id, w.source, w.kind, w.title, w.url, w.licence, w.why[0]], ['wiki:en:Ada_Lovelace', 'wikipedia', 'article', 'Ada Lovelace', 'https://en.wikipedia.org/wiki/Ada_Lovelace', 'CC BY-SA 4.0', "Wikipedia: today's featured article"]);
  const a = apodToFind(APOD);
  assert.deepEqual([a.id, a.kind, a.url, a.imageUrl, a.author, a.licence, a.why[0]], ['apod:2026-11-14', 'image', 'https://apod.nasa.gov/apod/ap261114.html', 'https://apod.nasa.gov/apod/image/2611/fixture.jpg', 'A. Astronomer', '© A. Astronomer', 'NASA APOD']);
  const v = apodToFind({ ...APOD, media_type: 'video', copyright: undefined, thumbnail_url: 'https://img.youtube.com/vi/x/0.jpg' });
  assert.deepEqual([v.kind, v.imageUrl, v.licence], ['video', 'https://img.youtube.com/vi/x/0.jpg', 'Public domain (NASA)']);
  const g = starterToFind(VS.entries[1]);
  assert.deepEqual([g.id, g.source, g.kind, g.embedUrl], ['ia:msdos_Whizz_1994', 'vault', 'game', 'https://archive.org/embed/msdos_Whizz_1994']);
  assert.deepEqual([g.why, g.meta], [['Internet Archive', 'DOS', '1994'], { identifier: 'msdos_Whizz_1994', platform: 'DOS', year: 1994 }]);
  const l = libraryEntryToFind(LIB.entries[1]);
  assert.deepEqual([l.id, l.source, l.kind, l.why, l.meta], ['lib:lib-0001', 'library', 'site', ['Starter library'], { libraryKind: 'toy', published: '2026-11-01' }]);
});
test('loadDaily uses the file when it is for today', async () => {
  const file = { v: 1, date: '2026-11-11', picks: [{ slot: 'web', find: {} }] };
  assert.deepEqual(await loadDaily({ date: '2026-11-11', fetchDailyFile: async () => file, backup: async () => 'B' }), { file, backup: false });
});
test('loadDaily uses the backup when the file is from yesterday', async () => {   // Review Focus 3
  const old = { v: 1, date: '2026-11-10', picks: [{ slot: 'web', find: {} }] };
  assert.deepEqual(await loadDaily({ date: '2026-11-11', fetchDailyFile: async () => old, backup: async () => 'B' }), { file: 'B', backup: true });
});
test('loadDaily uses the backup when the file is missing or malformed', async () => {
  const b = async () => 'B';
  assert.equal((await loadDaily({ date: '2026-11-11', fetchDailyFile: async () => { throw new Error('404'); }, backup: b })).backup, true);
  assert.equal((await loadDaily({ date: '2026-11-11', fetchDailyFile: async () => ({ v: 2, date: '2026-11-11', picks: [] }), backup: b })).backup, true);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test tests/unit/daily.test.js`
Expected: FAIL with "Cannot find module '…/src/core/daily.js'".

- [ ] **Step 3: Implement `src/core/daily.js`**

`backupDaily` draws all three numbers before any `await`, so the order is fixed in every shell:

```js
const rand = mulberry32(dailySeed(date));
const rWonder = rand(), rWeb = rand(), rGame = rand();
// wonder: rWonder < 0.5 → fetchWikiFeatured(date), else fetchApod(date); if that throws or gives null, try the other one
// web:  entries with added <= date, sorted by id (plain < compare), index floor(rWeb * n), mapped with libraryEntryToFind
// game: the same over vaultStarter.entries, mapped with starterToFind
// picks follow DAILY_SLOTS order; a slot that cannot be filled is left out
```

The mappers copy the field rules of Plan 02's adapters, so a find looks the same in Daily Fate as in Stumble:

- `wikiFeaturedToFind(tfa)`: Plan 02's Wikipedia summary rules (id `wiki:en:<titles.canonical>`, `extract`, `content_urls.desktop.page`, `thumbnail.source`, `tags: ['education']`, `licence: 'CC BY-SA 4.0'`, `attribution: 'Wikipedia'`), with title `titles.normalized` and `why: ["Wikipedia: today's featured article"]`.
- `apodToFind(apod)`: Plan 02's APOD rules: id `apod:<date>`, page `https://apod.nasa.gov/apod/ap<yymmdd>.html`, `kind` `'image'` or `'video'` from `media_type`, `imageUrl` from `url` (images) or `thumbnail_url` (videos; a video with neither gives `null`), `description` from `explanation`, `author` the trimmed `copyright`, `licence` `'© <author>'` or `'Public domain (NASA)'`, `tags: ['space', 'science']`, `meta.published = date`, `why: ['NASA APOD']`.
- `libraryEntryToFind(entry)`: Plan 02's library rules: id `lib:<entry.id>`, `description` from `blurb`, `tags` from the entry, kind `game` and `article` kept and anything else `site`, `meta: {libraryKind: entry.kind, published: entry.added}`, `why: ['Starter library']`.
- `starterToFind(entry)`: `kind: 'game'`, source `vault`, the three Archive URLs from the identifier, `tags: ['retro']`, `why: ['Internet Archive', platform, String(year)]`, `attribution: 'Internet Archive'`, `meta: {identifier, platform, year}`.

Every mapper sets `safety: 'curated'`. `loadDaily` accepts a file only when `v === 1`, `date` equals `date`, and `picks` is a non-empty array.

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/unit/daily.test.js`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/daily.js tests/unit/daily.test.js tests/fixtures/http/daily
git commit -m "Add the Daily Fate seed, backup recipe and file loader"
```

---

### Task 4: Generated data files: `dataUrl`, `readSnapshot` and placeholders

**Files:**
- Create: `tests/fixtures/http/pages/empty.json` (`{"v":1}`)
- Modify: `src/ui/boot.js`, `src/core/sources/index.js`, `tools/build.js`, `tests/fixtures/routes.js`
- Test: `tests/unit/data-files.test.js`

**Interfaces:**
- Consumes: `SHARE_BASE` (Plan 02 `share.js`); `build({target, outRoot, id})` (Plan 01); `createHttp`, `createCache`, `openStore(memoryBackend())`, `fakeClock`; `fakeFetch` (Task 1).
- Produces: `dataUrlFor(platformName) → (file) => string` exported from `boot.js`, and `app.dataUrl = dataUrlFor(platform.name)`, the contract's `dataUrl` (listed under Plan 01, whose boot does not define it; if it exists when this runs, keep it and add only the test); the `pages` limiter (`app.http.register('pages', {perMinute: 30, concurrent: 2})`); `readSnapshot(ctx, file) → Promise<object|null>` from `sources/index.js`, used by every snapshot reader in this plan; `{"v":1}` placeholders for the five generated files in `dist/pwa/data/`.

- [ ] **Step 1: Write the failing tests**

`DATA = 'https://iteatsthesalt.github.io/Game-Dev-Resources/byways/data/'`. The `readSnapshot` test uses `clock = fakeClock(0)`, `net = fakeFetch([[/data\/itch\.json$/, () => ({ body: { v: 1, feeds: [] } })]], {clock})` and `ctx = {http: createHttp({transport: net, clock}), cache: createCache(await openStore(memoryBackend()), clock), clock, dataUrl: (f) => DATA + f}`.

```js
test('dataUrl is relative in the web app and the Pages URL elsewhere', () => {
  assert.equal(dataUrlFor('pwa')('daily.json'), 'data/daily.json');
  for (const p of ['extension', 'android']) assert.equal(dataUrlFor(p)('itch.json'), DATA + 'itch.json');
});
test('readSnapshot reads through dataUrl, caches for an hour and gives null on any error', async () => {
  assert.deepEqual(await readSnapshot(ctx, 'itch.json'), { v: 1, feeds: [] });
  await readSnapshot(ctx, 'itch.json');
  assert.deepEqual(net.calls.map((c) => c.url), [DATA + 'itch.json']);
  clock.advance(3600001); await readSnapshot(ctx, 'itch.json'); assert.equal(net.calls.length, 2);
  assert.equal(await readSnapshot(ctx, 'neocities.json'), null);
  assert.equal(await readSnapshot({ ...ctx, dataUrl: undefined }, 'itch.json'), null);
});
test('the pwa build ships {"v":1} placeholders for the generated data files', async () => {
  const out = await mkdtemp(join(tmpdir(), 'bw-')); await build({ target: 'pwa', outRoot: out, id: 't' });
  for (const f of ['daily.json', 'itch.json', 'vault-index.json', 'webrings.json', 'neocities.json'])
    assert.deepEqual(JSON.parse(readFileSync(join(out, 'dist/pwa/data', f), 'utf8')), { v: 1 }, f);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test tests/unit/data-files.test.js`
Expected: FAIL with "The requested module '../../src/ui/boot.js' does not provide an export named 'dataUrlFor'".

- [ ] **Step 3: Implement the four changes**

- `boot.js`: `dataUrlFor(name)` gives `(file) => 'data/' + file` for `'pwa'` and `(file) => SHARE_BASE + 'data/' + file` otherwise. Set `app.dataUrl` and register `pages` with the other Plan 01 fields, before the engine is created.
- `readSnapshot(ctx, file)`: `ctx.http.getJson(ctx.dataUrl(file), {source: 'pages'})`, cached in `ctx.cache` under `snap:<file>` for 3600000 ms. Any throw (a 404, bad JSON, a missing `ctx.dataUrl` or `ctx.cache`) gives `null`, and `null` is never cached. Readers treat a missing or wrongly typed field in a snapshot as empty.
- `build.js`: the `pwa` target writes `{"v":1}` to `daily.json`, `itch.json`, `vault-index.json`, `webrings.json` and `neocities.json` under `dist/pwa/data/`, and the data job overwrites them on Pages. The extension and Android outputs get none, because they read Pages. Without the placeholders, every e2e page that reads a snapshot would log a 404, which Plan 01's `test` fixture reports through `pageProblems`.
- `routes.js`: add `{match: /^https:\/\/iteatsthesalt\.github\.io\/Game-Dev-Resources\/byways\/data\//, file: 'pages/empty.json'}`, so the extension and Android e2e runs read empty snapshots instead of making unmocked requests.

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/unit/data-files.test.js tests/unit/boot-data.test.js`
Expected: PASS, 3 tests plus Plan 01's.

- [ ] **Step 5: Commit**

```bash
git add src/ui/boot.js src/core/sources/index.js tools/build.js tests/fixtures/routes.js tests/fixtures/http/pages tests/unit/data-files.test.js
git commit -m "Read generated data files through dataUrl, with build placeholders"
```

---

### Task 5: The `ia` and `vault` source adapters

**Files:**
- Create: `src/core/sources/ia.js`, `src/core/sources/vault.js`, `tests/fixtures/http/ia/meta-collection.json`, `tests/fixtures/http/ia/meta-game.json`, `tests/fixtures/http/ia/count-250.json`, `tests/fixtures/http/ia/search-gems.json`, `tests/fixtures/http/ia/search-film.json`, `tests/fixtures/http/ia/vault-index.json`, `tests/fixtures/http/ia/thumb.svg`
- Modify: `src/core/ia/client.js` (add `luceneEscape`), `src/core/sources/index.js` (append both to `ADAPTERS`), `tests/unit/sources-index.test.js`, `tests/fixtures/routes.js`
- Test: `tests/unit/sources-ia.test.js`

**Interfaces:**
- Consumes: `sharedIaClient`, `VAULT_COLLECTIONS`, `validateCollections`, `vaultFate`, `shelfGems`, `iaDocToFind` (Tasks 1–2); `readSnapshot` (Task 4); the adapter shape and `ctx = {http, rand, clock, cache, settings, secrets, data, platformName, caps, dataUrl}` (contract; Plan 02's engine builds it); `getSource`.
- Produces: default-exported adapters `ia` and `vault`; `IA_COLLECTIONS: Array<{id, label, kind, safety}>` from `sources/ia.js`; `luceneEscape(text) → string` from `ia/client.js`. Both adapters drop finds whose id is in `ctx.data.embedBroken: Set<string>`, which Task 9 adds to `app.data`.

`IA_COLLECTIONS` (in this order): `prelinger` "Prelinger Archives" video; `feature_films` "Feature Films" video, safety `mixed`; `georgeblood` "Great 78 Project" audio; `78rpm` "78 RPMs and Cylinder Recordings" audio; `oldtimeradio` "Old Time Radio" audio; `librivoxaudio` "LibriVox" audio; `etree` "Live Music Archive" audio; `computermagazines` "Computer Magazines" book. Safety is `mostly` unless stated.

Fixtures: `meta-collection.json` = `{"result":{"identifier":"x","mediatype":"collection"}}`; `meta-game.json` = `{"result":{"identifier":"msdos_Whizz_1994","mediatype":"software","emulator":"dosbox","emulator_ext":"zip"}}`; `count-250.json` = `{"responseHeader":{"status":0},"response":{"numFound":250,"start":0,"docs":[]}}`; `search-gems.json` holds three docs in this order: `msdos_Whizz_1994` "Whizz" (312 downloads, year "1994", creator "Flair", avg_rating 4.5, num_reviews 3), `msdos_Tiny_Tunes_1992` "Tiny Tunes" (20, "1992") and `msdos_Big_Blast_1995` "Big Blast" (2900, "1995"), all in `["softwarelibrary_msdos_shareware"]`; `search-film.json` holds `DayAtTheFair1950` "A Day at the Fair" (`mediatype` "movies", collection `["feature_films"]`); `vault-index.json` follows the contract shape with `softwarelibrary_msdos_shareware` (the three gems above) and `softwarelibrary_c64_games` (one gem `c64_Fixture_Game_1985` "Comet Hopper", 40 downloads, 1985); `thumb.svg` is `<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>`.

Add these entries at the top of `tests/fixtures/routes.js`, in this order, so that e2e runs cover every request the two adapters make (Plan 02's convention):

| match | file | headers |
|---|---|---|
| `/^https:\/\/archive\.org\/advancedsearch\.php\?.*[?&]rows=0(&\|$)/` | `ia/count-250.json` | |
| `/^https:\/\/archive\.org\/advancedsearch\.php\?/` | `ia/search-gems.json` | |
| `/^https:\/\/archive\.org\/metadata\/msdos_[^/]+\/metadata$/` | `ia/meta-game.json` | |
| `/^https:\/\/archive\.org\/metadata\/[^/]+\/metadata$/` | `ia/meta-collection.json` | |
| `/^https:\/\/(archive\.org\/services\/img\|upload\.wikimedia\.org\|apod\.nasa\.gov\/apod\/image)\//` | `ia/thumb.svg` | `content-type: image/svg+xml` |

- [ ] **Step 1: Write the failing tests**

Each test gets a fresh `clock = instantClock()`, `net = fakeFetch(routes, {clock})` and `ctx = {http: createHttp({transport: net, clock}), rand, clock, cache: createCache(await openStore(memoryBackend()), clock), settings: DEFAULT_SETTINGS, secrets: null, data: {embedBroken: new Set()}, platformName: 'pwa', caps: {privilegedFetch: false}, dataUrl: (f) => DATA + f}`, with `DATA` as in Task 4 and `seq` as in Task 2. Routes, after a test's own: `/\/metadata\//` → `meta-collection.json`, `/rows=0/` → `count-250.json`, `/advancedsearch/` → `search-gems.json`, `/data\/vault-index\.json$/` → `ia/vault-index.json`.

```js
test('ia adapter declares the contract shape', () => {
  assert.deepEqual([ia.id, ia.name, ia.tier, ia.key, ia.safety, ia.fate], ['ia', 'Internet Archive', 'probe', 'none', 'mostly', true]);
  assert.deepEqual(ia.rate, { perMinute: 60, concurrent: 2 });
  assert.deepEqual(IA_COLLECTIONS.map((c) => c.id), ['prelinger', 'feature_films', 'georgeblood', '78rpm', 'oldtimeradio', 'librivoxaudio', 'etree', 'computermagazines']);
  assert.equal(IA_COLLECTIONS[1].safety, 'mixed');
});
test('ia random picks a validated collection and returns one find with an embed', async () => {
  // Family filter off; /rows=1/ → search-film.json; rand = seq(0.13, 0.5)
  ctx.settings = { ...DEFAULT_SETTINGS, familyFilter: false };
  const [f] = await ia.random(ctx);
  const u = new URL(net.calls.at(-1).url);
  assert.deepEqual([u.searchParams.get('q'), u.searchParams.get('rows'), u.searchParams.get('page'), u.searchParams.getAll('sort[]')[0]], ['collection:(feature_films)', '1', '126', 'identifier asc']);
  assert.deepEqual([f.kind, f.safety, f.source, f.embedUrl], ['video', 'mixed', 'ia', 'https://archive.org/embed/DayAtTheFair1950']);
  assert.deepEqual(f.why, ['Internet Archive: Feature Films']);
  ctx.data.embedBroken.add(f.id); ctx.rand = seq(0.13, 0.5);
  assert.deepEqual(await ia.random(ctx), []);
  ctx.rand = seq(0.9); await ia.more({ meta: { collection: 'feature_films' } }, ctx);
  const s = new URL(net.calls.at(-1).url).searchParams;
  assert.deepEqual([s.get('q'), s.get('page')], ['collection:(feature_films)', '226']);
});
test('with the Family filter on, ia leaves feature_films out', async () => {
  // rand = seq(0.13, 0.5)
  await ia.random(ctx);
  assert.equal(new URL(net.calls.at(-1).url).searchParams.get('q'), 'collection:(prelinger)');
});
test('ia search escapes Lucene characters', async () => {
  await ia.search('C++ (1990)', ctx);
  assert.equal(new URL(net.calls.at(-1).url).searchParams.get('q'), '(C\\+\\+ \\(1990\\)) AND collection:(prelinger OR georgeblood OR 78rpm OR oldtimeradio OR librivoxaudio OR etree OR computermagazines)');
});
test('vault random returns a Vault Fate find and skips embed-broken games', async () => {
  // rand = seq(0, 0.5)
  assert.deepEqual((await vault.random(ctx)).map((f) => f.id), ['ia:msdos_Whizz_1994']);
  ctx.data.embedBroken.add('ia:msdos_Whizz_1994'); ctx.rand = seq(0, 0.5);
  assert.deepEqual(await vault.random(ctx), []);
});
test('vault random falls back to the vault-index snapshot when the Archive fails', async () => {
  // every archive.org responder throws; rand = () => 0.9
  const [f] = await vault.random(ctx);
  assert.deepEqual([f.source, f.title], ['vault', 'Comet Hopper']);
  assert.ok(net.calls.some((c) => c.url === DATA + 'vault-index.json'));
});
test('vault search and more stay inside the Vault collections', async () => {
  // rand = seq(0, 0.5)
  await vault.search('whizz', ctx);
  assert.match(new URL(net.calls.at(-1).url).searchParams.get('q'), /^\(whizz\) AND mediatype:software AND collection:\(softwarelibrary_c64_games OR /);
  ctx.data.embedBroken.add('ia:msdos_Whizz_1994');
  const more = await vault.more({ meta: { collection: 'softwarelibrary_msdos_shareware' } }, ctx);
  assert.ok(new URL(net.calls.at(-1).url).searchParams.get('q').startsWith('collection:(softwarelibrary_msdos_shareware)'));
  assert.deepEqual(more.map((f) => f.title), ['Tiny Tunes', 'Big Blast']);
});
```

Add to Plan 02's `tests/unit/sources-index.test.js`: the `TABLE` rows `ia: ['probe','none','mostly',60,true]` and `vault: ['snapshot','none','curated',60,true]`, and remove `'ia'` and `'vault'` from its `for (const id of ['ia', 'vault', 'oldweb', 'itch'])` loop.

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test tests/unit/sources-ia.test.js tests/unit/sources-index.test.js`
Expected: FAIL with "Cannot find module '…/src/core/sources/ia.js'".

- [ ] **Step 3: Implement both adapters, `luceneEscape` and the registration**

- `luceneEscape` puts a backslash before each of `+ - & | ! ( ) { } [ ] ^ " ~ * ? : \ /` and leaves spaces alone.
- `ia`: `name: 'Internet Archive'`, `kinds: ['video','audio','book']`, `tier: 'probe'`, `key: 'none'`, `safety: 'mostly'`, `rate: {perMinute: 60, concurrent: 2}`, `fate: true`, `probeUrl: 'https://archive.org/advancedsearch.php?q=identifier%3Aprelinger&fl%5B%5D=identifier&rows=1&output=json'`. Every method gets its client from `sharedIaClient({http: ctx.http, cache: ctx.cache, clock: ctx.clock})`, and its collections from `validateCollections(ia, ctx.cache, IA_COLLECTIONS.map(c => c.id))`, minus the `mixed` ones while `ctx.settings.familyFilter` is on. Every method drops a find whose id is in `ctx.data.embedBroken`. `random`: pick a collection with `ctx.rand()`, count `collection:(<id>)`, `offset = floor(ctx.rand() · min(N, 10000))`, then one `rows: 1` search sorted `identifier asc`, with `fl` `identifier,title,creator,year,description,collection,mediatype`. Map it with `iaDocToFind(doc, {kind, safety, why: ['Internet Archive: ' + label]})`. `search(query)`: `q = '(' + luceneEscape(query) + ') AND collection:(' + ids.join(' OR ') + ')'`, 20 rows, no sort; each doc's kind and label come from its first collection in `IA_COLLECTIONS`. `more(find)`: `random` limited to `find.meta.collection` when that is one of the current ids, else plain `random`.
- `vault`: `name: 'Internet Archive games'`, `kinds: ['game']`, `tier: 'snapshot'`, `key: 'none'`, `safety: 'curated'`, `rate: {perMinute: 60, concurrent: 2}`, `fate: true`, no `probeUrl`. `random`: `vaultFate(client, ctx.rand, await validateCollections(client, ctx.cache))`, dropping a find whose id is in `ctx.data.embedBroken`. On any thrown error it uses `readSnapshot(ctx, 'vault-index.json')` instead: it flattens every collection's `gems`, drops broken ids, picks one with `ctx.rand()` (an empty list gives `[]`), and maps it with `iaDocToFind(gem, {kind: 'game'})`. `search(query)`: `(<escaped>) AND mediatype:software AND collection:(<valid ids joined by ' OR '>)`, 20 rows. `more(find)`: `shelfGems` on the shelf holding `find.meta.collection`, with `skip` set to the broken ids and `currentYear` from `ctx.clock.now()` in UTC, first 10.
- `sources/index.js`: import both default exports and append them to `ADAPTERS` (Plan 02).

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/unit/sources-ia.test.js tests/unit/sources-index.test.js`
Expected: PASS, 7 tests plus Plan 02's.

- [ ] **Step 5: Commit**

```bash
git add src/core/sources/ia.js src/core/sources/vault.js src/core/ia/client.js src/core/sources/index.js tests/fixtures/http/ia tests/fixtures/routes.js tests/unit/sources-ia.test.js tests/unit/sources-index.test.js
git commit -m "Add the Archive and Vault source adapters"
```

---

### Task 6: The `oldweb` source adapter

**Files:**
- Create: `src/core/sources/oldweb.js`, `tests/fixtures/http/ia/wayback-hit.json`, `tests/fixtures/http/ia/wayback-empty.json`
- Modify: `src/core/sources/index.js` (append to `ADAPTERS`), `tests/unit/sources-index.test.js`, `tests/fixtures/routes.js` (add `/^https:\/\/archive\.org\/wayback\/available\?/` → `ia/wayback-hit.json` at the top)
- Test: `tests/unit/sources-oldweb.test.js`

**Interfaces:**
- Consumes: `sharedIaClient(...).wayback(url, timestamp)` (Task 1); `makeFind`, `domainOf`; `ctx.data.geocities`.
- Produces: the default-exported `oldweb` adapter.

Fixtures: `wayback-hit.json` = the Task 1 hit body; `wayback-empty.json` = `{"url":"http://www.geocities.com/gone/","archived_snapshots":{}}`.

- [ ] **Step 1: Write the failing tests**

Same `ctx` as Task 5 (fresh for each test, `rand = () => 0` unless a test says otherwise), with `data.geocities = {v: 1, urls: ['http://www.geocities.com/Area51/1234/', 'http://www.geocities.com/Area51/5678/', 'http://www.geocities.com/Tokyo/1/']}` and the route `/wayback\/available/` → `wayback-hit.json` unless a test says otherwise.

```js
test('oldweb random resolves a seed through wayback with timestamp=2009', async () => {
  // rand = seq(0)
  const [f] = await oldweb.random(ctx);
  const u = new URL(net.calls[0].url);
  assert.deepEqual([u.searchParams.get('url'), u.searchParams.get('timestamp')], ['http://www.geocities.com/Area51/1234/', '2009']);
  assert.equal(f.url, 'https://web.archive.org/web/20091027000000/http://www.geocities.com/Area51/1234/');
  assert.equal(f.title, 'geocities.com/Area51/1234');
  assert.equal(f.description, 'A GeoCities page, as the Wayback Machine saved it in 2009.');
  assert.deepEqual([f.source, f.kind, f.why[0]], ['oldweb', 'site', 'Old web: GeoCities']);
});
test('oldweb random counts an empty wayback result as a miss', async () => {
  // /wayback\/available/ → wayback-empty.json
  assert.deepEqual(await oldweb.random(ctx), []);
});
test('oldweb more stays in the same neighbourhood', async () => {
  await oldweb.more({ meta: { original: 'http://www.geocities.com/Area51/1234/' } }, ctx);
  assert.equal(new URL(net.calls[0].url).searchParams.get('url'), 'http://www.geocities.com/Area51/5678/');
});
test('oldweb search resolves up to 3 matching seeds and dates each from its snapshot', async () => {
  // data.geocities.urls adds Area51/2/, Area51/3/ and Area51/4/; /wayback/ → a hit whose timestamp is '20110305000000'
  const finds = await oldweb.search('AREA51', ctx);
  assert.equal(net.calls.length, 3);
  assert.equal(finds[0].description, 'A GeoCities page, as the Wayback Machine saved it in 2011.');
});
```

Add the `TABLE` row `oldweb: ['open','none','mostly',60,false]` to `tests/unit/sources-index.test.js`, and remove `'oldweb'` from its `undefined` loop.

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test tests/unit/sources-oldweb.test.js tests/unit/sources-index.test.js`
Expected: FAIL with "Cannot find module '…/src/core/sources/oldweb.js'".

- [ ] **Step 3: Implement the adapter and the registration**

`oldweb`: `name: 'Old web (GeoCities)'`, `kinds: ['site']`, `tier: 'open'`, `key: 'none'`, `safety: 'mostly'`, `rate: {perMinute: 60, concurrent: 2}`, `fate: false`, `probeUrl: 'https://archive.org/wayback/available?url=geocities.com&timestamp=2009'`. `random`: one seed picked with `ctx.rand()`, one `wayback(seed, '2009')` call; `null` → `[]`. The title is the seed's host without `www.` plus its path without the trailing slash, and the description is `A GeoCities page, as the Wayback Machine saved it in <year>.`, with the year from the snapshot's `timestamp.slice(0, 4)` (Wayback returns the closest snapshot, which may not be from 2009). Set `tags: ['retro']`, `attribution: 'Internet Archive Wayback Machine'`, `meta: {original, timestamp}`, `why: ['Old web: GeoCities']`. `more(find)`: the seeds that share the first path segment with `find.meta.original` (not itself), picked with `ctx.rand()`; with none, plain `random`. `search(query)`: up to 3 seeds whose lowercased URL contains the lowercased query, resolved one by one, with misses dropped. Append the adapter to `ADAPTERS`.

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/unit/sources-oldweb.test.js tests/unit/sources-index.test.js`
Expected: PASS, 4 tests plus Plan 02's.

- [ ] **Step 5: Commit**

```bash
git add src/core/sources/oldweb.js src/core/sources/index.js tests/fixtures/http/ia/wayback-hit.json tests/fixtures/http/ia/wayback-empty.json tests/fixtures/routes.js tests/unit/sources-oldweb.test.js tests/unit/sources-index.test.js
git commit -m "Add the old web source adapter"
```

---

### Task 7: The `itch` source adapter and `parseItchRss`

**Files:**
- Create: `src/core/sources/itch.js`, `tests/fixtures/http/itch/platform-web.xml`, `tests/fixtures/http/itch/itch.json`
- Modify: `src/core/sources/index.js` (append to `ADAPTERS`), `tests/unit/sources-index.test.js`, `tests/fixtures/routes.js` (add at the top: `/^https:\/\/itch\.io\/games\/.+\.xml$/` → `itch/platform-web.xml` with `content-type: application/rss+xml`, and `/^https:\/\/img\.itch\.zone\//` → `ia/thumb.svg` with `content-type: image/svg+xml`)
- Test: `tests/unit/sources-itch.test.js`

**Interfaces:**
- Consumes: `readSnapshot` (Task 4); `makeFind`, `toPlainText`; `ctx.caps.privilegedFetch` (contract).
- Produces: the default-exported `itch` adapter; `ITCH_FEEDS: Array<{url, label}>` and `parseItchRss(xml) → Array<{url, title, description, imageUrl, author, published}>` from `sources/itch.js` (used by Tasks 13 and 15).

`ITCH_FEEDS` (in this order): `https://itch.io/games/free/platform-web.xml` "Free web games"; `https://itch.io/games/free/tag-game-jam.xml` "Free game jam games"; `https://itch.io/games/newest/tag-pico-8.xml` "New PICO-8 games".

Fixtures: `platform-web.xml` is an RSS 2.0 channel with three items: (1) `<title>Moss &amp; Mirrors</title>`, `<plainTitle>Moss &amp; Mirrors</plainTitle>`, `<link>https://mossdev.itch.io/moss-and-mirrors</link>`, `<pubDate>Tue, 10 Nov 2026 18:00:00 GMT</pubDate>`, `<imageurl>https://img.itch.zone/aW1n/315x250%23c/moss.png</imageurl>`, `<description><![CDATA[<p>A short puzzle walk &amp; more.</p>]]></description>`; (2) "Tiny Rocket" at `https://pixelpal.itch.io/tiny-rocket`, no `<imageurl>`, description `<![CDATA[<img src="https://img.itch.zone/cm9j/315x250%23c/rocket.png"/><p>Fly up.</p>]]>`; (3) "Elsewhere" with `<link>http://example.com/x</link>`. `itch.json` follows the contract shape with the first feed URL and items (1) and (2) as parsed.

- [ ] **Step 1: Write the failing tests**

Same `ctx` as Task 5 (fresh for each test, `rand = () => 0`), with the route `/data\/itch\.json$/` → `itch/itch.json`.

```js
test('parseItchRss reads items and drops links outside itch.io', () => {
  const items = parseItchRss(readFixture('itch/platform-web.xml'));
  assert.equal(items.length, 2);
  assert.deepEqual(items[0], { url: 'https://mossdev.itch.io/moss-and-mirrors', title: 'Moss & Mirrors', description: 'A short puzzle walk & more.', imageUrl: 'https://img.itch.zone/aW1n/315x250%23c/moss.png', author: 'mossdev', published: '2026-11-10T18:00:00.000Z' });
  assert.equal(items[1].imageUrl, 'https://img.itch.zone/cm9j/315x250%23c/rocket.png');
  assert.equal(items[1].author, 'pixelpal');
});
test('itch random reads the snapshot without privileged fetch', async () => {
  const finds = await itch.random(ctx);
  assert.deepEqual(net.calls.map((c) => c.url), [DATA + 'itch.json']);
  assert.deepEqual(finds.map((f) => f.title).sort(), ['Moss & Mirrors', 'Tiny Rocket']);
  assert.deepEqual([finds[0].source, finds[0].kind, finds[0].why[0]], ['itch', 'game', 'itch.io: Free web games']);
});
test('itch random reads a feed live through privileged fetch when the platform can', async () => {
  // /itch\.io\/games/ → platform-web.xml as text
  await itch.random({ ...ctx, caps: { privilegedFetch: true } });
  assert.equal(net.calls[0].url, ITCH_FEEDS[0].url);
  assert.equal(net.calls[0].init.privileged, true);
});
```

Add the `TABLE` row `itch: ['open','none','mostly',10,false]` to `tests/unit/sources-index.test.js` and remove `'itch'`, the last id, so the `undefined` loop goes.

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test tests/unit/sources-itch.test.js tests/unit/sources-index.test.js`
Expected: FAIL with "Cannot find module '…/src/core/sources/itch.js'".

- [ ] **Step 3: Implement `parseItchRss`, the adapter and the registration**

- `parseItchRss`: split on `<item>`, read `plainTitle` (else `title`), `link`, `pubDate`, `imageurl` and `description`, unwrap CDATA, and turn HTML into text with `toPlainText`. `imageUrl` is `imageurl`, else the first `<img src>` in the description, else `null`. Keep only `https://<name>.itch.io/…` links; `author` is `<name>`. `published` is `new Date(pubDate).toISOString()`, or `null` when the date is invalid.
- `itch`: `name: 'itch.io'`, `kinds: ['game']`, `tier: 'open'` (the contract's tier: Plan 02's `enabledSources` drops `privileged` sources in the web app, which has the snapshot), `key: 'none'`, `safety: 'mostly'`, `rate: {perMinute: 10, concurrent: 1}`, `fate: false`. It reads live when `ctx.caps?.privilegedFetch` is true (the extension and Android): one feed picked with `ctx.rand()`, fetched with `ctx.http.getText(url, {source: 'itch', privileged: true})` and cached in `ctx.cache` under `itch:<url>` for 86400000 ms. Otherwise it reads `readSnapshot(ctx, 'itch.json')`, and `null` gives `[]`. `random` returns up to 10 items in a `ctx.rand` shuffle, as `kind: 'game'`, `tags: ['indie']`, `why: ['itch.io: ' + feedLabel]`, with `author`, `imageUrl` and `meta.published`. `search(query)` filters every item by title or description. `more` is `random`.
- `sources/index.js`: append the adapter to `ADAPTERS`.

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/unit/sources-itch.test.js tests/unit/sources-index.test.js`
Expected: PASS, 3 tests plus Plan 02's.

- [ ] **Step 5: Commit**

```bash
git add src/core/sources/itch.js src/core/sources/index.js tests/fixtures/http/itch tests/fixtures/routes.js tests/unit/sources-itch.test.js tests/unit/sources-index.test.js
git commit -m "Add the itch.io source adapter"
```

---

### Task 8: Curate the Vault starter list and the GeoCities seeds

**Files:**
- Modify: `src/data/vault-starter.json`, `src/data/geocities-seeds.json` (Plan 01 creates both empty)
- Test: `tests/unit/data-vault.test.js`

**Interfaces:**
- Consumes: the contract shapes for both files; `normalizeUrl`, `utcDate`.
- Produces: the two data files, read by `backupDaily` (Task 3), the `oldweb` adapter (Task 6), the data job (Task 13) and the probe (Task 15).

- [ ] **Step 1: Write the failing schema tests**

```js
const VS = JSON.parse(readFileSync('src/data/vault-starter.json', 'utf8'));
const GEO = JSON.parse(readFileSync('src/data/geocities-seeds.json', 'utf8'));
test('vault-starter has about 60 unique Archive games', () => {
  assert.equal(VS.v, 1);
  assert.ok(VS.entries.length >= 50 && VS.entries.length <= 70, String(VS.entries.length));
  assert.equal(new Set(VS.entries.map((e) => e.id)).size, VS.entries.length);
  for (const e of VS.entries) {
    assert.match(e.id, /^ia:[A-Za-z0-9][A-Za-z0-9._-]*$/);
    assert.ok(['DOS', 'C64', 'Apple II', 'ZX Spectrum'].includes(e.platform), e.id);
    assert.ok(Number.isInteger(e.year) && e.year >= 1977 && e.year <= 2005, e.id);
    assert.ok(e.title.trim().length > 0 && e.title.length <= 200, e.id);
    assert.match(e.added, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(e.added <= utcDate(Date.now()), e.id);
  }
});
test('vault-starter has at least 10 games on each verified platform', () => {
  for (const p of ['DOS', 'C64', 'Apple II', 'ZX Spectrum']) assert.ok(VS.entries.filter((e) => e.platform === p).length >= 10, p);
});
test('geocities seeds are about 100 distinct GeoCities URLs', () => {
  assert.equal(GEO.v, 1);
  assert.ok(GEO.urls.length >= 90 && GEO.urls.length <= 110, String(GEO.urls.length));
  for (const u of GEO.urls) { assert.match(u, /^http:\/\/www\.geocities\.com\/[A-Za-z0-9_.~-]+(\/[^?#]*)?$/, u); }
  assert.equal(new Set(GEO.urls.map(normalizeUrl)).size, GEO.urls.length);
});
test('geocities seeds cover at least 10 neighbourhoods', () => {
  assert.ok(new Set(GEO.urls.map((u) => new URL(u).pathname.split('/')[1])).size >= 10);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test tests/unit/data-vault.test.js`
Expected: FAIL: the counts are wrong (Plan 01's files hold 0 entries).

- [ ] **Step 3: Curate `vault-starter.json` with WebSearch**

Search only; do not fetch archive.org (this machine blocks it, and the probe checks every id live in CI). Use queries such as `"Software Library: MS-DOS Shareware" site:archive.org/details`, `softwarelibrary_c64_games`, `"The Apple II Library: Games"` and `zx_spectrum_library_games`. Take the identifier from each `archive.org/details/<id>` result URL. DOS comes from `softwarelibrary_msdos_shareware`, C64 from `softwarelibrary_c64_games`, Apple II from `softwarelibrary_apple_games` and ZX Spectrum from `zx_spectrum_library_games`. Prefer little-known titles. Take the year from the result title or the identifier's year suffix, and skip an item when neither gives a year. Write 15 per platform (60 in all) with `added` set to today's UTC date, then stop.

- [ ] **Step 4: Curate `geocities-seeds.json` with WebSearch**

Search for GeoCities-era page URLs (for example `"geocities.com/Area51"`, `"geocities.com/SoHo"`, `"geocities.com/Heartland"`, `"geocities.com/TimesSquare"` and `"geocities.com/EnchantedForest"`) and copy the `http://www.geocities.com/…` addresses that the results quote. Spread them over at least 10 neighbourhoods and write about 100, then stop. Leave out pages whose titles suggest adult or hateful content. Wayback misses are fine, because the adapter treats them as misses.

- [ ] **Step 5: Run the tests to see them pass**

Run: `node --test tests/unit/data-vault.test.js`
Expected: PASS, 4 tests. Then run `npm run build && npm run check`; expected: exit 0 (the contract shape checks pass, and the fresh build is not stale).

- [ ] **Step 6: Commit**

```bash
git add src/data/vault-starter.json src/data/geocities-seeds.json tests/unit/data-vault.test.js
git commit -m "Add the Vault starter list and GeoCities seeds"
```

---

### Task 9: The card's Archive extras, boot wiring and the Vault shelves

**Files:**
- Create: `src/ui/views/vault.js`
- Modify: `src/ui/components/card.js`, `src/ui/boot.js`, `src/ui/views/index.js`, `tests/e2e/axe.spec.js` (only when Plan 03 has created it)
- Test: `tests/e2e/vault.spec.js`

**Interfaces:**
- Consumes: `registerView`, `navigate`, `h`, `clear`, `announce`, `renderCard`, `makeActionHandler(app, {advance, whyLine})`, `createCache`, `getSource`; `readSnapshot` (Task 4); `libraryEntryToFind` (Task 3); the `app` fields `store`, `http`, `clock`, `rand`, `platform`, `data`, `engine`, `secrets`, `getSettings`, `dataUrl`; Tasks 1–7.
- Produces: `app.ia: IaClient`; `app.data.embedBroken: Set<string>` of find ids, persisted in the `health` store under `embed-broken:<find id>`; `renderCard(find, {onAction, compact, whyLine, headingLevel = 2})`, which also shows, for a find with `embedUrl`, a **Details on archive.org** link and, on a coarse pointer, a **Keyboard needed** badge.

- [ ] **Step 1: Write the failing e2e tests**

Specs import `test` and `expect` from `./helpers/net.js`, `gotoApp` from `./helpers/app.js`, `expectNoSeriousA11y` from `./helpers/axe.js` (Plan 01) and `devices` from `@playwright/test`. `beforeEach` routes the same-origin data files with `page.route(…, (r) => r.fulfill({path}))`: `**/data/vault-index.json` → `tests/fixtures/http/ia/vault-index.json`, `**/data/itch.json` → `tests/fixtures/http/itch/itch.json`, and `**/data/library.json` → Plan 02's `tests/fixtures/http/library/small.json`. `shelf = (name) => page.getByRole('region', {name})`.

```js
const LABELS = ['DOS', 'Windows 3.x', 'C64', 'Apple II', 'ZX Spectrum', 'Amiga', 'Mac', 'Consoles', 'Arcade', 'Flash', 'Palm', 'Malware Museum'];
test('shows a shelf per platform plus Indie web', async ({ page }) => {
  await gotoApp(page, '#/vault');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Vault');
  await expect(page.locator('main section > h2')).toHaveText([...LABELS, 'Indie web']);
  await expect(shelf('DOS').getByRole('heading', { level: 3, name: 'Whizz' })).toBeVisible();
});
test('gem cards show why chips and a details link, and no frame', async ({ page }) => {
  await gotoApp(page, '#/vault');
  const item = shelf('DOS').getByRole('listitem').filter({ hasText: 'Whizz' });
  for (const chip of ['Internet Archive: MS-DOS Shareware', '312 downloads', '1994', '★4.5 (3)']) await expect(item).toContainText(chip);
  await expect(item.getByRole('link', { name: 'Details on archive.org' })).toHaveAttribute('href', 'https://archive.org/details/msdos_Whizz_1994');
  await expect(page.locator('iframe')).toHaveCount(0);
});
test('More gems loads a shelf live when there is no snapshot', async ({ page }) => {
  await page.route('**/data/vault-index.json', (r) => r.fulfill({ json: { v: 1 } }));
  await gotoApp(page, '#/vault');
  await expect(shelf('C64')).toContainText('No gems loaded yet.');
  await shelf('C64').getByRole('button', { name: 'More gems' }).click();
  await expect(shelf('C64')).toContainText('Whizz', { timeout: 10000 });
});
test.describe('when the Archive fails', () => {
  test.use({ ignoreProblems: [/Failed to load resource/] });   // the 503s below are on purpose
  test('shows Archive unavailable when a live shelf load fails', async ({ page }) => {   // Review Focus 1
    await page.route('**/data/vault-index.json', (r) => r.fulfill({ json: { v: 1 } }));
    await page.route(/archive\.org\/(advancedsearch|metadata)/, (r) => r.fulfill({ status: 503, body: '' }));
    await gotoApp(page, '#/vault');
    await shelf('DOS').getByRole('button', { name: 'More gems' }).click();
    await expect(page.getByRole('heading', { name: 'Archive unavailable' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('The Internet Archive is not answering right now.')).toBeVisible();
    await expect(page.locator('#live-polite')).toContainText('Archive unavailable');
  });
});
test('Indie web shows library and itch.io games, then GitHub and Show HN games', async ({ page }) => {
  await gotoApp(page, '#/vault');
  for (const t of ['Pixel Garden', 'Moss & Mirrors']) await expect(shelf('Indie web')).toContainText(t);
  await shelf('Indie web').getByRole('button', { name: 'More gems' }).click();
  for (const t of ['tiny-jam', 'I made a tiny game']) await expect(shelf('Indie web')).toContainText(t);
  await expect(shelf('Indie web')).not.toContainText('Notes app');
});
test('axe finds no serious issues, and desktop shows no Keyboard needed badge', async ({ page }) => {
  await gotoApp(page, '#/vault'); await expectNoSeriousA11y(page);
  await expect(page.getByText('Keyboard needed')).toHaveCount(0);
});
test.describe('on a touch device', () => {
  const { defaultBrowserType, ...pixel7 } = devices['Pixel 7'];   // a worker option, which a describe group may not set
  test.use(pixel7);
  test('keyboard shelves get a Keyboard needed badge', async ({ page }) => {
    await gotoApp(page, '#/vault');
    await expect(shelf('DOS').getByText('Keyboard needed')).toHaveCount(3);
  });
});
```

The GitHub and Show HN finds come from Plan 02's `github/search.json` and `hn/search.json` routes.

- [ ] **Step 2: Run the tests to see them fail**

Run: `npm run build && npx playwright test -c tests/e2e/playwright.config.js tests/e2e/vault.spec.js`
Expected: FAIL: no shelves (Plan 01's placeholder view says "Nothing here yet.").

- [ ] **Step 3: Wire `boot.js`, `views/index.js` and the axe list**

In `boot.js`, before `createEngine` is called: set `app.ia = sharedIaClient({http: app.http, cache: createCache(app.store, app.clock), clock: app.clock})`, and add `embedBroken` to the existing `app.data` object, filled from the `health` keys that start with `embed-broken:`. Do not replace `app.data`, because the engine's `ctx.data` is the same object. In `views/index.js`, add `import './vault.js';`. If `tests/e2e/axe.spec.js` exists, append `'#/vault'` to its `VIEWS`; the axe test above covers the view either way.

- [ ] **Step 4: Add the Archive extras to `renderCard` in `card.js`**

- `renderCard` takes `headingLevel = 2` and uses `h<headingLevel>` for the title, so cards inside an `h2` section get `h3` titles.
- For a find with `embedUrl`, it adds a link **Details on archive.org** to `https://archive.org/details/<id>` (the id from `embedUrl`), as §10.4 asks of every Archive card. When `matchMedia('(pointer: coarse)').matches` and `find.meta?.platform` is the label of a `VAULT_COLLECTIONS.shelves` entry with `keyboard: true`, it also adds a badge **Keyboard needed**.

- [ ] **Step 5: Implement the shelves in `src/ui/views/vault.js`**

`registerView('vault', {title: 'Vault', render})`. The view renders:

- `h1` "Vault" and the line "Hidden games from the Internet Archive. They play in the Archive's own player."
- One `<section aria-labelledby>` per `VAULT_COLLECTIONS.shelves` entry, with an `h2` label and a `<ul>` of `<li>` items. Each item holds `renderCard(find, {compact: true, headingLevel: 3, onAction})`, plus a badge "Not working here" when `app.data.embedBroken` has the id. Snapshot gems come from `readSnapshot(ctx, 'vault-index.json')` for the shelf's collections. They are mapped with `iaDocToFind(gem, {kind: 'game'})`, sorted by `gemScore` (`currentYear` is the UTC year from `app.clock.now()`) and capped at 12. An empty shelf shows "No gems loaded yet."
- A **More gems** button per shelf. It calls `validateCollections(app.ia, cache, shelf.collections)`, then `shelfGems(app.ia, shelf, {rand: app.rand, currentYear, skip: app.data.embedBroken, valid})`, and adds up to 12 finds that are not shown yet. It loads nothing until it is pressed.
- When a live load throws, it stops and shows (once, above the shelves) an `h2` "Archive unavailable" and the line "The Internet Archive is not answering right now. Gems from the last snapshot are still here, and the other modes keep working." Then it calls `announce('Archive unavailable')`.
- An "Indie web" section: the first 6 library entries with `kind: 'game'` and `added` on or before today's UTC date, newest `added` first (ties by `id`), mapped with `libraryEntryToFind`, plus up to 6 finds from `getSource('itch').random(ctx)`. Its **More gems** button adds the `kind: 'game'` finds from `getSource('github').random(ctx)` and `getSource('hn').search('game', ctx)`, and skips a source the user turned off (`settings.sources[id]?.enabled === false`). Errors are ignored.
- The footer line "Games and media courtesy of the Internet Archive."

`cache` is `createCache(app.store, app.clock)`, and `ctx` is `{http: app.http, rand: app.rand, clock: app.clock, cache, settings: app.getSettings(), secrets: app.secrets, data: app.data, platformName: app.platform.name, caps: app.platform.caps, dataUrl: app.dataUrl}`. Each item's `onAction` is Plan 02's `makeActionHandler(app, {advance})`, wrapped so that its `advance` knows which action called it: after **More like this** it navigates to `stumble`, where the Rabbit Hole runs, and after **Never this site** or **Broken or spam** it removes the item.

- [ ] **Step 6: Run the tests to see them pass**

Run: `npm run build && npx playwright test -c tests/e2e/playwright.config.js tests/e2e/vault.spec.js`
Expected: PASS, 7 tests.

- [ ] **Step 7: Commit**

```bash
git add src/ui/components/card.js src/ui/views/vault.js src/ui/boot.js src/ui/views/index.js tests/e2e/vault.spec.js
git commit -m "Add the Vault shelves, the card's Archive extras and the boot wiring"
```

Before committing, also `git add tests/e2e/axe.spec.js` if Step 3 changed it.

---

### Task 10: Play, the watchdog and embed-broken marks

**Files:**
- Create: `tests/fixtures/http/ia/embed.html`
- Modify: `src/ui/components/card.js`, `tests/fixtures/routes.js` (add `/^https:\/\/archive\.org\/embed\//` → `ia/embed.html` with `content-type: text/html` at the top)
- Test: `tests/e2e/vault-play.spec.js`

**Interfaces:**
- Consumes: `app.ia.metadata`, `app.data.embedBroken`, `app.store`, `app.handsFree` (Plan 03, may be absent), `announce`, `h`; Task 9's card and view.
- Produces: `mountPlayer(slot, find, app) → Promise<{unmount()}|null>` exported from `card.js`. Plan 02's `makeActionHandler` hands `play` to it, so **Play** mounts the Archive player in Stumble, Feed, Saved, the Vault and Daily Fate alike (§10.1). `renderCard` gives a find with `embedUrl` an empty `div.player` and calls `onAction('play', find, {slot})` with it.

`embed.html` is `<!doctype html><title>Archive player stub</title><p>Player stub</p>`.

- [ ] **Step 1: Write the failing e2e tests**

Same imports and `beforeEach` as Task 9, plus `installFakeSpeech` from `./helpers/fakes.js`. `whizz = () => page.getByRole('region', {name: 'DOS'}).getByRole('listitem').filter({hasText: 'Whizz'})`. `hang = () => page.route(/archive\.org\/embed\//, () => {})` (the frame never loads).

```js
test('Play mounts the Archive frame only after Play', async ({ page }) => {
  await gotoApp(page, '#/vault');
  await expect(page.locator('iframe')).toHaveCount(0);
  await whizz().getByRole('button', { name: 'Play' }).click();
  const frame = page.locator('iframe');
  await expect(frame).toHaveAttribute('src', 'https://archive.org/embed/msdos_Whizz_1994');
  await expect(frame).toHaveAttribute('allow', 'fullscreen; autoplay; gamepad');
  await expect(frame).toHaveAttribute('allowfullscreen', '');
  await expect(whizz()).toContainText('MS-DOS · Click the game, then use the keyboard.');
});
test('the watchdog offers Open on archive.org after 15 s', async ({ page }) => {
  await page.clock.install(); await hang();
  await gotoApp(page, '#/vault');
  await whizz().getByRole('button', { name: 'Play' }).click();
  await expect(page.locator('iframe')).toHaveCount(1);
  await page.clock.runFor(14000);
  await expect(page.getByRole('link', { name: 'Open on archive.org' })).toHaveCount(0);
  await page.clock.runFor(1000);
  await expect(page.getByRole('link', { name: 'Open on archive.org' })).toHaveAttribute('href', 'https://archive.org/details/msdos_Whizz_1994');
});
test('Not working marks the game embed-broken on this device', async ({ page }) => {
  await gotoApp(page, '#/vault');
  await whizz().getByRole('button', { name: 'Play' }).click();
  await whizz().getByRole('button', { name: 'Not working' }).click();
  await expect(whizz().getByRole('link', { name: 'Open on archive.org' })).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
  await page.reload(); await gotoApp(page, '#/vault');
  await expect(whizz()).toContainText('Not working here');
});
test('Play twice mounts one frame, and leaving clears the watchdog', async ({ page }) => {   // Review Focus 5
  await page.clock.install(); await hang();
  await gotoApp(page, '#/vault');
  await whizz().getByRole('button', { name: 'Play' }).click();
  await whizz().getByRole('button', { name: 'Play' }).click();
  await expect(page.locator('iframe')).toHaveCount(1);
  await page.goto('#/stumble'); await page.clock.runFor(16000);
  await page.goto('#/vault');
  await expect(whizz()).not.toContainText('Not working here');
});
test('a game with no emulator offers Open on archive.org and no frame', async ({ page }) => {
  await page.route(/metadata\/msdos_Whizz_1994\/metadata/, (r) => r.fulfill({ json: { result: { mediatype: 'software' } } }));
  await gotoApp(page, '#/vault');
  await whizz().getByRole('button', { name: 'Play' }).click();
  await expect(whizz()).toContainText('This game has no player on the Archive.');
  await expect(whizz().getByRole('link', { name: 'Open on archive.org' })).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
});
test.describe('when the Archive does not answer', () => {
  test.use({ ignoreProblems: [/Failed to load resource/] });   // the 503 below is on purpose
  test('an unreachable Archive shows a message instead of a frame', async ({ page }) => {   // Review Focus 1
    await page.route(/metadata\/msdos_Whizz_1994\/metadata/, (r) => r.fulfill({ status: 503, body: '' }));
    await gotoApp(page, '#/vault');
    await whizz().getByRole('button', { name: 'Play' }).click();
    await expect(whizz()).toContainText('The Internet Archive is not answering right now.');
    await expect(page.locator('iframe')).toHaveCount(0);
  });
});
test('Play works the same on a saved Archive find', async ({ page }) => {
  await gotoApp(page, '#/vault');
  await whizz().getByRole('button', { name: 'Save' }).click();
  await page.goto('#/saved');
  await page.getByRole('main').getByRole('button', { name: 'Play' }).click();
  await expect(page.locator('iframe')).toHaveAttribute('src', 'https://archive.org/embed/msdos_Whizz_1994');
});
test('Play pauses a running lean-back', async ({ page }) => {   // runs once Plan 03's hands-free bar exists
  await installFakeSpeech(page); await gotoApp(page, '#/stumble');
  const start = page.locator('#handsfree').getByRole('button', { name: 'Start' });
  test.skip(!(await start.count()), 'hands-free comes with Plan 03');
  await start.click(); await page.goto('#/vault');
  await whizz().getByRole('button', { name: 'Play' }).click();
  await expect(page.locator('#handsfree').getByRole('button', { name: 'Play' })).toBeVisible();
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npm run build && npx playwright test -c tests/e2e/playwright.config.js tests/e2e/vault-play.spec.js`
Expected: FAIL: no iframe after Play (Plan 02's `play` still opens a tab).

- [ ] **Step 3: Implement `mountPlayer` and the `play` action in `card.js`**

- `mountPlayer(slot, find, app)` keeps the pending mount promise per slot (a `WeakMap`) from before its first `await`, and returns it to a second call, so pressing **Play** twice mounts one frame. If `find.embedUrl` is not `https://archive.org/embed/<id>`, it returns `null`.
- It first calls `app.handsFree.pause()` when `app.handsFree?.state === 'active'` (Plan 03's rule), so lean-back stops while a game runs and resumes only on an explicit resume.
- For `kind: 'game'`, it calls `app.ia.metadata(find.meta?.identifier ?? <id from embedUrl>)`. If that throws (the Archive is paused or down), it shows "The Internet Archive is not answering right now." and an **Open on archive.org** link, with no frame and no embed-broken mark. A `null` reply, or one with no `emulator`, shows "This game has no player on the Archive." and the link. Otherwise it shows `<platform> · <hint>`: `dosbox` → "MS-DOS" / "Click the game, then use the keyboard."; `ruffle*` → "Flash" / "Use the mouse."; `mame*` → "Arcade" / "Press 5 to add a coin and 1 to start."; anything else → the emulator value / "Click the game, then use the keyboard."
- It mounts `h('iframe', {src: find.embedUrl, allow: 'fullscreen; autoplay; gamepad', allowfullscreen: '', title: find.title + ', Internet Archive player'})` and a **Not working** button.
- It starts a 15000 ms `setTimeout`, cleared by the frame's `load` event. If the slot has left the document when it fires (the user left the view, or the card was replaced), it does nothing more. When the watchdog fires or **Not working** is pressed, it shows (once) "This one is not loading here." and an **Open on archive.org** link to `https://archive.org/details/<id>` (`target="_blank"`, `rel="noopener"`). Then `app.store.put('health', 'embed-broken:' + find.id, {at: Date.now()})`, add `find.id` to `app.data.embedBroken`, and `announce('Marked as not working on this device')`. **Not working** also removes the frame.
- `makeActionHandler`'s `play` branch calls `mountPlayer(extra.slot, find, app)` in place of Plan 02's `openFind`, and `renderCard` passes the card's `div.player` as `extra.slot`.
- `unmount()` clears the timer and removes the frame.
- **Open on archive.org** uses the same `https://archive.org/details/<id>` URL everywhere.

- [ ] **Step 4: Run the tests to see them pass**

Run: `npm run build && npx playwright test -c tests/e2e/playwright.config.js tests/e2e/vault-play.spec.js tests/e2e/vault.spec.js`
Expected: PASS, 15 tests; `Play pauses a running lean-back` reports as skipped until Plan 03 has run.

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/card.js tests/fixtures/routes.js tests/fixtures/http/ia/embed.html tests/e2e/vault-play.spec.js
git commit -m "Play Archive finds in place, with the watchdog and embed-broken marks"
```

---

### Task 11: The Daily Fate view

**Files:**
- Create: `src/ui/views/daily.js`, `tests/fixtures/http/daily/daily-2026-11-11.json`
- Modify: `src/ui/views/index.js` (add `import './daily.js';`), `tests/e2e/axe.spec.js` (only when Plan 03 has created it: append `'#/daily'` to `VIEWS`)
- Test: `tests/e2e/daily.spec.js`

**Interfaces:**
- Consumes: `loadDaily`, `backupDaily`, mappers (Task 3); `utcDate`, `nextUtcMidnight`; `renderCard`, `makeActionHandler` and the Vault's `onAction` rule (Tasks 9–10); `IDENT` (Plan 02 `sources/index.js`); `SHARE_BASE` (Plan 02 `share.js`); `registerView`, `navigate`, `announce`, `h`, `createCache`; `app.http`, `app.dataUrl`, `app.secrets`, `app.data.library`, `app.data.vaultStarter`, `app.platform.share`, `app.store`, `app.clock`.
- Produces: the `daily` route: `#/daily`, and `#/daily/YYYY-MM-DD` through the router's `params.id`.

`daily-2026-11-11.json` is `{v: 1, date: '2026-11-11', picks: […]}` with `game` = `starterToFind` of the Whizz starter entry, `web` = `libraryEntryToFind` of `lib-0002`, and `wonder` = `wikiFeaturedToFind` of the fixture `tfa`. The spec routes the featured feed and APOD itself, because Plan 02's shared routes answer those URLs with fixtures that have no `tfa` or that list several days.

- [ ] **Step 1: Write the failing e2e tests**

`test.use({locale: 'en-US', timezoneId: 'America/New_York'})`, with the imports of Task 9. `beforeEach` routes `**/data/library.json` → `daily/library.json` and `**/data/vault-starter.json` → `daily/vault-starter.json` (the Task 3 fixtures); `/\/data\/daily\.json(\?|$)/` → `daily/daily-2026-11-11.json` unless a test overrides it; `/en\.wikipedia\.org\/api\/rest_v1\/feed\/featured\//` → `daily/wiki-featured.json`; and `/api\.nasa\.gov\/planetary\/apod\?/` → `daily/apod.json`. Routes added in a test win over `mockNet`'s. It also adds an init script that defines `navigator.share` as `async (d) => { window.__shared = d; }`.

```js
const at = (page, iso) => page.clock.install({ time: new Date(iso) });
const pick = (page, name) => page.getByRole('region', { name, exact: true });
test("shows today's three picks from daily.json?d=<today>", async ({ page }) => {   // Review Focus 3
  await at(page, '2026-11-11T15:00:00Z');
  const asked = page.waitForRequest(/\/data\/daily\.json\?d=2026-11-11$/);
  await gotoApp(page, '#/daily'); await asked;
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Daily Fate');
  for (const [n, t] of [['Game', 'Whizz'], ['Web', 'A Tiny Handmade Site'], ['Wonder', 'Ada Lovelace']]) await expect(pick(page, n).getByRole('heading', { level: 3 })).toHaveText(t);
  await expect(page.getByText('Picks for 2026-11-11 (UTC)')).toBeVisible();
});
test('shows the next rollover in local time', async ({ page }) => {
  await at(page, '2026-11-11T15:00:00Z'); await gotoApp(page, '#/daily');
  await expect(page.getByText('Next Daily Fate: 07:00 PM your time')).toBeVisible();
});
test('falls back to the backup pick with its label', async ({ page }) => {
  await page.route(/\/data\/daily\.json(\?|$)/, (r) => r.fulfill({ json: { v: 1 } }));   // the build's placeholder
  await at(page, '2026-11-11T15:00:00Z'); await gotoApp(page, '#/daily');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Daily Fate (backup pick)');
  for (const t of ['Comet Hopper', 'A Tiny Handmade Site', 'Ada Lovelace']) await expect(page.getByText(t).first()).toBeVisible();
});
test('rolls over at UTC midnight while open', async ({ page }) => {   // Review Focus 3
  await at(page, '2026-11-11T23:59:50Z'); await gotoApp(page, '#/daily');
  await expect(page.getByText('Picks for 2026-11-11 (UTC)')).toBeVisible();
  await page.clock.runFor(15000);
  await expect(page.getByText('Picks for 2026-11-12 (UTC)')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Daily Fate (backup pick)');
  await expect(page.getByText('Moth Radio').first()).toBeVisible();
});
test('the game pick links to its details page and plays in place', async ({ page }) => {
  await at(page, '2026-11-11T15:00:00Z'); await gotoApp(page, '#/daily');
  await expect(pick(page, 'Game').getByRole('link', { name: 'Details on archive.org' })).toHaveAttribute('href', 'https://archive.org/details/msdos_Whizz_1994');
  await pick(page, 'Game').getByRole('button', { name: 'Play' }).click();
  await expect(page.locator('iframe')).toHaveAttribute('src', 'https://archive.org/embed/msdos_Whizz_1994');
});
test("Share today's Fate shares spoiler-free text and the Pages link", async ({ page }) => {
  await at(page, '2026-11-11T15:00:00Z'); await gotoApp(page, '#/daily');
  await page.getByRole('button', { name: "Share today's Fate" }).click();
  expect(await page.evaluate(() => window.__shared)).toEqual({ title: 'Byways Daily Fate', text: 'My Byways Daily Fate for 2026-11-11. No spoilers: open it to see the three picks.', url: 'https://iteatsthesalt.github.io/Game-Dev-Resources/byways/#/daily/2026-11-11' });
});
test("a past day's link shows that day's backup pick", async ({ page }) => {
  await at(page, '2026-11-11T15:00:00Z'); await gotoApp(page, '#/daily/2026-11-10');
  await expect(page.getByText('Picks for 2026-11-10 (UTC)')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Daily Fate (backup pick)');
  await expect(page.getByText(/Next Daily Fate/)).toHaveCount(0);
});
test('malformed and future day links show today', async ({ page }) => {
  await at(page, '2026-11-11T15:00:00Z');
  for (const hash of ['#/daily/2026-13-45', '#/daily/2099-01-01', '#/daily/x']) {
    await gotoApp(page, hash);
    await expect(page.getByText('Picks for 2026-11-11 (UTC)')).toBeVisible();
  }
});
test('the streak counts days in a row and stays quiet on day one', async ({ page }) => {
  await at(page, '2026-11-11T15:00:00Z'); await gotoApp(page, '#/daily');
  await expect(page.getByText(/in a row/)).toHaveCount(0);
  await page.clock.setSystemTime(new Date('2026-11-12T15:00:00Z')); await page.reload(); await gotoApp(page, '#/daily');
  await expect(page.getByText('2 days in a row.')).toBeVisible();
});
test('axe finds no serious issues on Daily Fate', async ({ page }) => {
  await at(page, '2026-11-11T15:00:00Z'); await gotoApp(page, '#/daily'); await expectNoSeriousA11y(page);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npm run build && npx playwright test -c tests/e2e/playwright.config.js tests/e2e/daily.spec.js`
Expected: FAIL: no picks (Plan 01's placeholder view says "Nothing here yet.").

- [ ] **Step 3: Implement `src/ui/views/daily.js`**

- **Date.** Take it from `render(container, app, params)`'s `params.id`, which the router has decoded. Accept it only when it matches `/^\d{4}-\d{2}-\d{2}$/`, `Date.parse(date + 'T00:00:00Z')` is not `NaN`, the result round-trips through `utcDate`, and it is not after today. Otherwise use today, `utcDate(app.clock.now())`.
- **Loading.** `loadDaily({date, fetchDailyFile, backup})`. `fetchDailyFile` is `app.http.getJson(app.dataUrl('daily.json') + '?d=' + date, {source: 'pages'})`. The date in the query gets past a service worker's or browser's copy of yesterday's file, since data files are stale-while-revalidate (§13.2). `backup` is `backupDaily({date, library: app.data.library, vaultStarter: app.data.vaultStarter, fetchWikiFeatured, fetchApod})`. `fetchWikiFeatured(d)` gets `https://en.wikipedia.org/api/rest_v1/feed/featured/YYYY/MM/DD` with `{source: 'wikipedia', headers: {'Api-User-Agent': IDENT}}` and returns `.tfa`. `fetchApod(d)` gets `https://api.nasa.gov/planetary/apod?api_key=<key>&date=<d>&thumbs=true` with `{source: 'apod'}`, where the key is `await app.secrets.get('src:datagov')` or `DEMO_KEY`. With `DEMO_KEY` it follows Plan 02's APOD counter (`apod:count:<today>` in the app cache: no request at 45 or more, one more per request, 50 after a 429). Both fetchers cache their reply per date for 7 days in `createCache(app.store, app.clock)`.
- **Page.** `h1` "Daily Fate", or "Daily Fate (backup pick)" when `backup` is true. Then the lines `Picks for <date> (UTC)` and, for a backup, "This is the backup pick. Friends on another version may see a different game or web pick." Then one `<section aria-labelledby>` per pick with an `h2` "Game", "Web" or "Wonder", holding `renderCard(find, {headingLevel: 3, onAction})` with the Vault's `onAction` rule (Task 9), so **Play** mounts the player in place (Task 10).
- **Rollover.** For today only, show `Next Daily Fate: <time> your time`, where `<time>` is `new Date(nextUtcMidnight(now)).toLocaleTimeString(undefined, {hour: '2-digit', minute: '2-digit'})`. When `params.id` is absent, set a `setTimeout` for `nextUtcMidnight(now) − now + 1000` ms that renders the view again. `leave()` clears it; a mounted player's watchdog stops by itself once its card has left the document (Task 10).
- **Share.** A button "Share today's Fate" calls `app.platform.share({title: 'Byways Daily Fate', text: 'My Byways Daily Fate for <date>. No spoilers: open it to see the three picks.', url: SHARE_BASE + '#/daily/' + date})`, so links shared from the extension or Android open on Pages. Then it calls `announce('Link copied')` for `'copied'` and `announce('Shared')` for `'shared'`.
- **Streak.** Keep the UTC dates of visits on today's view in `health` under `daily:visits` (unique, last 60). Count the run of consecutive days that ends today. When it is 2 or more, show `<n> days in a row.` Show no prompts and no reminders.

- [ ] **Step 4: Run the tests to see them pass**

Run: `npm run build && npx playwright test -c tests/e2e/playwright.config.js tests/e2e/daily.spec.js`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/ui/views/daily.js src/ui/views/index.js tests/fixtures/http/daily/daily-2026-11-11.json tests/e2e/daily.spec.js
git commit -m "Add the Daily Fate view with backup label, rollover and share"
```

Before committing, also `git add tests/e2e/axe.spec.js` if this task changed it.

---

### Task 12: The link check and the build exclusion

**Files:**
- Create: `tools/linkcheck.js`
- Modify: `tools/build.js` (add `excludeDeadLinks` and the `--linkcheck <file>` option)
- Test: `tests/unit/linkcheck.test.js`, `tests/unit/build-linkcheck.test.js`

**Interfaces:**
- Consumes: `fakeFetch` (Task 1); the `library.json` and `linkcheck.json` shapes.
- Produces: `USER_AGENT = 'Byways-data-job/1.0 (+https://github.com/iteatsthesalt/Game-Dev-Resources)'` and `checkLibrary({entries, fetch, previous = null, now, concurrency = 4, timeoutMs = 10000}) → Promise<{v:1, checkedAt, results}>` from `tools/linkcheck.js`; `excludeDeadLinks(library, linkcheck|null) → library` from `tools/build.js`. CLI: `node tools/linkcheck.js [--library src/data/library.json] [--previous <file>] [--out dist/pwa/data/linkcheck.json]`.

- [ ] **Step 1: Write the failing tests**

`run = (responder, previous) => checkLibrary({entries: [{id: 'lib-a', url: 'https://a.example/'}], fetch: fakeFetch([[/a\.example/, responder]]).fetch, previous, now: Date.UTC(2026, 10, 11, 0, 7)})`. `prev = (n, checkedAt = '2026-11-10T00:07:00.000Z') => ({v: 1, checkedAt, results: {'lib-a': {ok: false, status: 404, failStreak: n}}})`.

```js
test('a live link resets its fail streak', async () => {
  assert.deepEqual((await run(() => ({ status: 200 }), prev(1))).results['lib-a'], { ok: true, status: 200, failStreak: 0 });
});
test('a dead link counts up its streak', async () => {
  assert.deepEqual((await run(() => ({ status: 404 }), prev(1))).results['lib-a'], { ok: false, status: 404, failStreak: 2 });
  assert.equal((await run(() => ({ status: 500 }))).results['lib-a'].failStreak, 1);
  assert.deepEqual((await run(() => { throw new Error('ENOTFOUND'); })).results['lib-a'], { ok: false, status: 0, failStreak: 1 });
});
test('HEAD 405 retries with GET, and 401/403/429 do not count as dead', async () => {   // Review Focus 4
  const methods = [];
  const r = await run((url, init) => { methods.push(init.method); return { status: init.method === 'HEAD' ? 405 : 200 }; });
  assert.deepEqual(methods, ['HEAD', 'GET']); assert.equal(r.results['lib-a'].ok, true);
  for (const s of [401, 403, 429]) assert.deepEqual((await run(() => ({ status: s }), prev(1))).results['lib-a'], { ok: true, status: s, failStreak: 0 });
});
test('a second check on the same UTC day does not count again', async () => {   // Review Focus 4
  const today = '2026-11-11T00:01:00.000Z';
  assert.equal((await run(() => ({ status: 404 }), prev(1, today))).results['lib-a'].failStreak, 1);
  assert.equal((await run(() => ({ status: 404 }), prev(0, today))).results['lib-a'].failStreak, 1);
});
test('sends the descriptive User-Agent and stamps checkedAt', async () => {
  const net = fakeFetch([[/a\.example/, () => ({ status: 200 })]]);
  const r = await checkLibrary({ entries: [{ id: 'lib-a', url: 'https://a.example/' }], fetch: net.fetch, now: Date.UTC(2026, 10, 11, 0, 7) });
  assert.equal(new Headers(net.calls[0].init.headers).get('user-agent'), USER_AGENT);
  assert.equal(USER_AGENT, 'Byways-data-job/1.0 (+https://github.com/iteatsthesalt/Game-Dev-Resources)');
  assert.equal(r.checkedAt, '2026-11-11T00:07:00.000Z');
});
// tests/unit/build-linkcheck.test.js
test('excludeDeadLinks drops entries that failed two checks in a row', () => {
  const lib = { v: 1, entries: [{ id: 'lib-a' }, { id: 'lib-b' }, { id: 'lib-c' }] };
  const lc = { v: 1, results: { 'lib-a': { failStreak: 2 }, 'lib-b': { failStreak: 1 } } };
  assert.deepEqual(excludeDeadLinks(lib, lc).entries.map((e) => e.id), ['lib-b', 'lib-c']);
  assert.equal(excludeDeadLinks(lib, null), lib);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test tests/unit/linkcheck.test.js tests/unit/build-linkcheck.test.js`
Expected: FAIL with "Cannot find module '…/tools/linkcheck.js'" and "SyntaxError: The requested module '../../tools/build.js' does not provide an export named 'excludeDeadLinks'".

- [ ] **Step 3: Implement `tools/linkcheck.js` and the `build.js` change**

- `checkLibrary` sends `HEAD` with `redirect: 'follow'`, `headers: {'User-Agent': USER_AGENT}` and `signal: AbortSignal.timeout(timeoutMs)`. On 405 or 501 it repeats the request as `GET`. A link is dead on a network error or timeout (`status: 0`), on 404 or 410, and on any status of 500 or more. `ok` is `!dead`. `failStreak` is 0 when ok. For a dead link it is the previous streak plus 1 when `previous.checkedAt` falls on an earlier UTC date than `now` (or there is no previous result), and `max(previous streak, 1)` on the same date, because `pages.yml` also runs on pushes and by hand ("fails two days in a row", §7.5). It runs at most `concurrency` checks at once.
- The CLI writes the result to `--out` and prints `Checked <n> links; <m> dead; <k> flagged for review (failStreak ≥ 2).`
- `build.js --linkcheck <file>`: when the file exists and parses, every target's `data/library.json` is written through `excludeDeadLinks`, and the build prints `Left out <n> library entries that failed two link checks in a row.` A missing file changes nothing. Plan 01's `build.test.js` already imports `tools/build.js`, so its CLI runs only when the file is run directly; keep that.

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/unit/linkcheck.test.js tests/unit/build-linkcheck.test.js`
Expected: PASS, 6 tests. Then run `npm test`; expected: all unit tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/linkcheck.js tools/build.js tests/unit/linkcheck.test.js tests/unit/build-linkcheck.test.js
git commit -m "Add the daily link check and leave out links that failed twice"
```

---

### Task 13: The daily data job

**Files:**
- Create: `tools/data-job.js`, `tests/fixtures/http/datajob/smallweb.txt`, `tests/fixtures/http/datajob/webring.html`
- Test: `tests/unit/data-job.test.js`

**Interfaces:**
- Consumes: `createHttp`, `createCache`, `openStore(memoryBackend())`, `mulberry32`, `fnv1a32`, `utcDate`, `makeFind`, `toPlainText`, `isHttpUrl`, `siteOrigin`, `domainOf`; `createIaClient` (Task 1); `VAULT_COLLECTIONS`, `gemQuery`, `gemScore`, `CURATED_COLLECTIONS`, `iaDocToFind`, `validateCollections` (Task 2); `dailySeed`, `wikiFeaturedToFind`, `apodToFind`, `libraryEntryToFind` (Task 3); `ITCH_FEEDS`, `parseItchRss` (Task 7); `USER_AGENT`, `checkLibrary` (Task 12) and `excludeDeadLinks` (Task 12, `tools/build.js`).
- Produces: `runDataJob({fetch, clock, date, outDir, srcDir = 'src/data', liveBase, apodKey = 'DEMO_KEY'}) → Promise<{written: string[], kept: string[], failed: string[]}>`; the `webrings.json` and `neocities.json` shapes below (read by Task 14). CLI: `node tools/data-job.js [--out dist/pwa/data] [--live https://iteatsthesalt.github.io/Game-Dev-Resources/byways/] [--date YYYY-MM-DD]` (`npm run data`), with those defaults. The date defaults to today in UTC, and `apodKey` comes from `NASA_API_KEY` or `DEMO_KEY`.

Fixtures: `smallweb.txt` has these lines: `[DEBUG] Cross-domain redirect from x`, `https://alpha.example/feed.xml`, `https://beta.example/rss`, `https://alpha.example/atom.xml`, `https://gamma.example/index.xml`, `not a url`. `webring.html` has six `<li data-lang="en" id="ring<n>"><a href="https://ring<n>.example/">ring<n></a></li>` lines for n = 1–6.

- [ ] **Step 1: Write the failing tests**

`job = (over) => runDataJob({fetch: net.fetch, clock: instantClock(Date.UTC(2026, 10, 11, 0, 7)), date: '2026-11-11', outDir: tmp, srcDir: 'tests/fixtures/http/daily', liveBase: 'https://iteatsthesalt.github.io/Game-Dev-Resources/byways/', ...over})`, with `tmp` a fresh `fs.mkdtemp` folder per test and `net = fakeFetch([...the test's own routes, ...DEFAULTS])`. `DEFAULTS`, as `fakeFetch` pairs where `file(p) = () => ({body: readFixture(p)})`: `/rows=0/` → `file('ia/count-250.json')`, `/advancedsearch/` → `file('ia/search-gems.json')`, `/\/metadata\//` → `file('ia/meta-collection.json')`, `/feed\/featured\//` → `file('daily/wiki-featured.json')`, `/api\.nasa\.gov/` → `file('daily/apod.json')`, `/itch\.io\/games/` → `file('itch/platform-web.xml')`, `/raw\.githubusercontent\.com\/kagisearch/` → `file('datajob/smallweb.txt')`, `/raw\.githubusercontent\.com\/XXIIVV/` → `file('datajob/webring.html')`, `/neocities\.org/` → 404, `/\.example\//` → 200 and `/iteatsthesalt\.github\.io/` → 404. `read = (n) => JSON.parse(readFileSync(join(tmp, n), 'utf8'))`.

```js
test('writes the data files for a date with the main recipe', async () => {
  const r = await job();
  assert.deepEqual(r.written.sort(), ['daily.json', 'itch.json', 'linkcheck.json', 'vault-index.json', 'webrings.json']);
  const d = read('daily.json');
  assert.deepEqual([d.v, d.date, d.picks.map((p) => p.slot)], [1, '2026-11-11', ['game', 'web', 'wonder']]);
  assert.deepEqual(d.picks.map((p) => p.find.title), ['Whizz', 'A Tiny Handmade Site', 'Night moth']);
  const s = new URL(net.calls.find((c) => /[?&]rows=1(&|$)/.test(c.url)).url).searchParams;
  assert.equal(s.get('q'), 'collection:(softwarelibrary_c64_games) AND mediatype:software AND downloads:[20 TO 3000] AND publicdate:[* TO 2026-11-11T00:00:00Z]');
  assert.equal(s.get('page'), '92');
  const vi = read('vault-index.json');
  assert.equal(Object.keys(vi.collections).length, 15);
  assert.equal(vi.collections.softwarelibrary_c64_games.gems[0].identifier, 'msdos_Tiny_Tunes_1992');
  assert.equal(read('itch.json').feeds.length, 3);
});
test('2026-11-16 takes the web pick from the Kagi list and the wonder from APOD', async () => {
  await job({ date: '2026-11-16' });
  assert.deepEqual(read('daily.json').picks.map((p) => p.find.title).slice(1), ['alpha.example', 'Fixture Nebula']);
  const apod = new URL(net.calls.find((c) => c.url.includes('api.nasa.gov')).url).searchParams;
  assert.deepEqual([apod.get('date'), apod.get('api_key')], ['2026-11-16', 'DEMO_KEY']);
});
test('re-runs on the same date write the same daily.json', async () => {
  await job(); const first = readFileSync(join(tmp, 'daily.json'), 'utf8');
  await job(); assert.equal(readFileSync(join(tmp, 'daily.json'), 'utf8'), first);
});
test('every request carries the descriptive User-Agent', async () => {
  await job();
  for (const c of net.calls) assert.equal(new Headers(c.init.headers).get('user-agent'), USER_AGENT, c.url);
});
test('a failing step keeps the last good file from the live site', async () => {
  // /itch\.io\/games/ throws; /byways\/data\/itch\.json$/ → itch/itch.json
  const r = await job();
  assert.deepEqual(read('itch.json'), JSON.parse(readFileSync('tests/fixtures/http/itch/itch.json', 'utf8')));
  assert.deepEqual(r.kept, ['itch.json']);
});
test('a failing step with no live copy writes nothing and reports it', async () => {
  // every archive.org responder throws
  const r = await job();
  assert.ok(!existsSync(join(tmp, 'vault-index.json')));
  assert.ok(r.failed.includes('vault-index.json') && r.failed.includes('daily.json'));
});
test('the snapshot extras are dropped quietly when their lists cannot be read', async () => {
  // /raw\.githubusercontent\.com\/XXIIVV/ → 500
  const r = await job();
  assert.ok(!existsSync(join(tmp, 'webrings.json')));
  assert.ok(!r.failed.includes('webrings.json'));
});
test('the link check carries fail streaks from the live file', async () => {
  // /paper-toy-garden\.example/ → 404; /byways\/data\/linkcheck\.json$/ → {v: 1, results: {'lib-0001': {ok: false, status: 404, failStreak: 1}}}
  await job();
  assert.equal(read('linkcheck.json').results['lib-0001'].failStreak, 2);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test tests/unit/data-job.test.js`
Expected: FAIL with "Cannot find module '…/tools/data-job.js'".

- [ ] **Step 3: Implement `tools/data-job.js`**

Every request goes through one transport that adds `User-Agent: USER_AGENT` to the caller's headers. That transport feeds `createHttp`, then `createIaClient` with a memory-backed cache. Each output is built on its own:

- **`daily.json`.** `rand = mulberry32(dailySeed(date))`. Draw `rCol, rOff, rWebSrc, rWebIdx, rWonder` in that order before any request.
  - Game: `cols = [...VAULT_COLLECTIONS.verified].sort()`, `col = cols[floor(rCol · 4)]`, and `q = gemQuery(col, 1).q + ' AND publicdate:[* TO <date>T00:00:00Z]'`. Count it, take `offset = floor(rOff · min(N, 10000))`, fetch one doc (`rows: 1`, `page: offset + 1`, `sort: ['identifier asc']`) and map it with `iaDocToFind(doc, {kind: 'game'})`.
  - Web: when `rWebSrc < 0.5`, the starter library (entries with `added ≤ date`, sorted by `id`) at `floor(rWebIdx · n)`, mapped with `libraryEntryToFind`. Otherwise use `https://raw.githubusercontent.com/kagisearch/smallweb/main/smallweb.txt`: keep the lines that pass `isHttpUrl`, map them to `siteOrigin`, dedupe and sort, then take `floor(rWebIdx · n)`. Build it with `makeFind({source: 'kagi', kind: 'site', url: origin + '/', title: domainOf(origin), description: 'A personal site from the Kagi Small Web list.', attribution: 'Kagi Small Web (MIT)', why: ['Kagi Small Web'], tags: [], safety: 'mostly'})`.
  - Wonder: `rWonder < 1/3` → `wikiFeaturedToFind(feed.tfa)`. `rWonder < 2/3` → the picture of the day: `makeFind({source: 'commons', kind: 'image', title: image.title without 'File:', url: image.file_page, imageUrl: image.thumbnail.source, description: toPlainText(image.description.text), author: toPlainText(image.artist.text), licence: image.license.type, attribution: 'Wikimedia Commons', why: ['Wikimedia Commons: picture of the day'], safety: 'curated'})`. Otherwise `apodToFind` of `https://api.nasa.gov/planetary/apod?api_key=<apodKey>&date=<date>&thumbs=true`. The feed URL is `https://en.wikipedia.org/api/rest_v1/feed/featured/YYYY/MM/DD`.
  - Any slot that throws or gives `null` fails the whole file.
- **`itch.json`.** Fetch every `ITCH_FEEDS` URL as text and parse it with `parseItchRss`. A feed with no items fails the file. The output is `{v: 1, generatedAt, feeds: [{feed, items}]}`.
- **`vault-index.json`.** Run `validateCollections(ia, cache)`. For each id, use `rand = mulberry32(fnv1a32('vault-index-' + date + '-' + id))` and count `gemQuery(id, 1).q`. Then fetch `gemQuery(id, 1 + floor(rand() · ceil(min(N, 10000) / 100)))`, sort the docs by `gemScore` (`curated: CURATED_COLLECTIONS`, `currentYear` from `date`), and keep the top 24 with the contract's gem fields. A collection that throws is left out. If none succeeds, the file fails.
- **`linkcheck.json`.** `checkLibrary({entries: library.entries, fetch, previous, now: clock.now()})`, where `previous` is the live `data/linkcheck.json` (or `null`).
- **Extras.** `webrings.json` = `{v: 1, generatedAt, ring: 'xxiivv', sites: [{url, title}]}` from `https://raw.githubusercontent.com/XXIIVV/webring/main/index.html`, matching `<li … id="<title>"…>` followed by its first `<a href="<url>">`. `neocities.json` = `{v: 1, generatedAt, sites: [{url}]}` from the unique `https://<name>.neocities.org/` links on `https://neocities.org/browse?sort_by=featured`. Each is written only with 5 or more sites. Otherwise it is skipped, and it is never reported as failed.
- **Fallback.** When one of the four main files fails, fetch `<liveBase>data/<name>`. If it parses with `v === 1`, write it unchanged and add it to `kept`; otherwise add the name to `failed`. `generatedAt` and `checkedAt` come from `clock.now()`.
- **CLI.** Print the three lists. When `GITHUB_STEP_SUMMARY` is set, append `## Byways data job (<date>)`, the lists and a "Flagged for review" list of library ids with `failStreak ≥ 2`. Always exit 0, so the deploy still runs.

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/unit/data-job.test.js`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add tools/data-job.js tests/fixtures/http/datajob tests/unit/data-job.test.js
git commit -m "Add the daily data job with live fallbacks"
```

---

### Task 12: The live probe

**Files:**
- Create: `tools/probe-live.js`
- Test: `tests/unit/probe-live.test.js`

**Interfaces:**
- Consumes: `SOURCES`; `PROVIDERS` from `src/core/ai/providers.js` through a dynamic `import()` (Plan 05 may not have run yet); `VAULT_COLLECTIONS` (Task 2); `IA_COLLECTIONS` (Task 4); `ITCH_FEEDS`, `parseItchRss` (Task 5); `USER_AGENT` (Task 10); `realClock`.
- Produces: `PAGES_ORIGIN = 'https://iteatsthesalt.github.io'`; `buildTargets({sources, providers, vaultStarter}) → Array<{check: 'cors'|'framing'|'collection'|'item'|'endpoint', name, url, requestHeaders?}>`; `runLiveProbe({fetch, targets, clock = realClock}) → Promise<Array<{check, name, url, pass, detail}>>`; `toMarkdown(rows, {date}) → string`. CLI: `node tools/probe-live.js [--out probe-report.md]` (`npm run probe`).

- [ ] **Step 1: Write the failing tests**

```js
const SRC = { a: { id: 'a', tier: 'open', probeUrl: 'https://a.example/x' }, vault: { id: 'vault', tier: 'snapshot' }, itch: { id: 'itch', tier: 'privileged' } };
const PROV = { anthropic: { id: 'anthropic', baseURL: 'https://api.anthropic.com/v1', modelsPath: '/models', auth: { header: 'x-api-key' } } };
const T = buildTargets({ sources: SRC, providers: PROV, vaultStarter: { entries: [{ id: 'ia:msdos_Whizz_1994' }] } });
const of = (c) => T.filter((t) => t.check === c);
test('buildTargets covers sources, providers, framing, collections and endpoints', () => {
  assert.ok(of('cors').some((t) => t.name === 'a' && t.url === 'https://a.example/x'));
  assert.ok(of('cors').some((t) => t.name === 'itch' && t.url === ITCH_FEEDS[0].url));
  assert.ok(!T.some((t) => t.name === 'vault'));
  assert.ok(of('cors').some((t) => t.name === 'provider:anthropic' && t.url === 'https://api.anthropic.com/v1/models' && t.requestHeaders === 'x-api-key,content-type'));
  assert.deepEqual(of('framing').map((t) => t.url), ['https://archive.org/embed/msdos_Scorched_Earth_1991', 'https://archive.org/embed/msdos_Whizz_1994']);
  assert.equal(of('collection').length, 23); assert.equal(of('item').length, 1);
  assert.ok(of('endpoint').some((t) => t.url === 'https://kagi.com/smallweb/api/random'));
  assert.equal(of('endpoint').filter((t) => t.url.startsWith('https://iteatsthesalt.github.io/Game-Dev-Resources/byways/data/')).length, 4);
});
let net;
const probe = (targets, routes) => { net = fakeFetch(routes); return runLiveProbe({ fetch: net.fetch, targets, clock: instantClock() }); };
const acao = (v) => ({ headers: v ? { 'access-control-allow-origin': v } : {} });
const t = (check, name, url) => ({ check, name, url });
test('CORS passes on ACAO * after a preflight sent with Origin', async () => {
  const [row] = await probe([of('cors')[0]], [[/a\.example/, (u, i) => ({ status: i.method === 'OPTIONS' ? 204 : 200, ...acao('*') })]]);
  assert.deepEqual([row.pass, row.detail], [true, 'preflight 204 ACAO=* ACAH=none; GET 200 ACAO=*']);
  const h = new Headers(net.calls[0].init.headers);
  assert.deepEqual([net.calls[0].init.method, h.get('origin'), h.get('access-control-request-method')], ['OPTIONS', PAGES_ORIGIN, 'GET']);
});
test('CORS fails without ACAO, and a provider 401 with ACAO passes', async () => {
  const prov = of('cors').find((x) => x.name === 'provider:anthropic');
  const rows = await probe([of('cors')[0], prov], [[/a\.example/, () => ({ status: 200 })], [/anthropic/, (u, i) => ({ status: i.method === 'OPTIONS' ? 204 : 401, ...acao(PAGES_ORIGIN) })]]);
  assert.deepEqual(rows.map((r) => r.pass), [false, true]);
});
test('framing fails on X-Frame-Options SAMEORIGIN or a closed frame-ancestors', async () => {
  const rows = await probe(['a', 'b', 'c'].map((id) => t('framing', id, 'https://archive.org/embed/' + id)), [
    [/embed\/a$/, () => ({ headers: { 'x-frame-options': 'SAMEORIGIN' } })],
    [/embed\/b$/, () => ({ headers: { 'content-security-policy': "frame-ancestors 'self' https://*.archive.org" } })],
    [/embed\/c$/, () => ({})]]);
  assert.deepEqual(rows.map((r) => r.pass), [false, false, true]);
  assert.equal(rows[0].detail, 'X-Frame-Options=SAMEORIGIN; frame-ancestors=none');
});
test('collections need mediatype collection, and items need an identifier', async () => {
  const m = (id) => 'https://archive.org/metadata/' + id + '/metadata';
  const rows = await probe([t('collection', 'good', m('good')), t('collection', 'bad', m('bad')), t('item', 'x', m('x'))], [
    [/good/, () => ({ body: { result: { mediatype: 'collection' } } })], [/bad/, () => ({ body: {} })], [/\/x\//, () => ({ body: { result: { identifier: 'x' } } })]]);
  assert.deepEqual(rows.map((r) => r.pass), [true, false, true]);
  assert.equal(rows[1].detail, 'mediatype=missing');
});
test('endpoints check the itch format, the Kagi JSON and ACAO on Pages files', async () => {
  const pages = 'https://iteatsthesalt.github.io/Game-Dev-Resources/byways/data/';
  const urls = [ITCH_FEEDS[0].url, 'https://kagi.com/smallweb/api/random', pages + 'daily.json', pages + 'itch.json'];
  const rows = await probe(urls.map((u) => t('endpoint', u, u)), [
    [/itch\.io/, () => ({ body: readFixture('itch/platform-web.xml') })], [/kagi\.com/, () => ({ body: { url: 'https://x.example/' } })],
    [/daily\.json/, () => ({ body: {}, ...acao('*') })], [/itch\.json/, () => ({ body: {} })]]);
  assert.deepEqual(rows.map((r) => r.pass), [true, true, true, false]);
});
test('a network error fails the row', async () => {
  const [row] = await probe([of('cors')[0]], [[/a\.example/, () => { throw new Error('ECONNRESET'); }]]);
  assert.deepEqual([row.pass, row.detail], [false, 'network error: ECONNRESET']);
});
test('toMarkdown writes the report', () => {
  const md = toMarkdown([{ check: 'cors', name: 'a', url: 'u', pass: true, detail: 'ok' }, { check: 'framing', name: 'b', url: 'v', pass: false, detail: 'x|y' }], { date: '2026-11-11' });
  assert.equal(md, '# Byways live probe, 2026-11-11\n\n1 passed, 1 failed.\n\n| Check | Name | Result | Detail |\n|---|---|---|---|\n| cors | a | pass | ok |\n| framing | b | **FAIL** | x\\|y |\n');
});
```

(`readFixture` comes from Task 1's helper file.)

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test tests/unit/probe-live.test.js`
Expected: FAIL with "Cannot find module '…/tools/probe-live.js'".

- [ ] **Step 3: Implement `tools/probe-live.js`**

- **`buildTargets`.**
  - CORS rows: each source with a `probeUrl` (`itch` uses `ITCH_FEEDS[0].url`, and `snapshot`/`navigate` tiers are skipped). Add `archive-metadata` (`https://archive.org/metadata/softwarelibrary_c64_games/metadata`) and `archive-img` (`https://archive.org/services/img/softwarelibrary_c64_games`).
  - Provider rows: each provider with an https `baseURL`, at `baseURL` (trailing slash dropped) + `/` + `modelsPath` (leading slash dropped), with `requestHeaders` = `auth.header` lowercased + `,content-type`.
  - Framing rows: `msdos_Scorched_Earth_1991` and the first Vault starter id.
  - Collection rows: the verified, likely and `IA_COLLECTIONS` ids at `/metadata/<id>/metadata`. Item rows: every Vault starter id.
  - Endpoint rows: `https://kagi.com/smallweb/api/random`, every `ITCH_FEEDS` URL, and `daily.json`, `itch.json`, `vault-index.json` and `library.json` under `https://iteatsthesalt.github.io/Game-Dev-Resources/byways/data/`.
- **`runLiveProbe`.** Every request sends `Origin: PAGES_ORIGIN` and `User-Agent: USER_AGENT`, and waits 1000 ms (`clock.setTimeout`) after any archive.org request.
  - CORS: an `OPTIONS` preflight with `Access-Control-Request-Method: GET` (and `Access-Control-Request-Headers` when given), then a GET. It passes when the GET's `access-control-allow-origin` is `*` or `PAGES_ORIGIN`, whatever the status.
  - Framing: it fails on an `X-Frame-Options` of DENY or SAMEORIGIN, or on a `frame-ancestors` that has neither `*` nor `PAGES_ORIGIN`.
  - Collection: passes on `result.mediatype === 'collection'`. Item: passes on `result.identifier`.
  - Endpoints: Kagi passes on a JSON `url` string; itch passes on at least one parsed item; Pages files pass on ACAO `*`.
  - A thrown error gives `network error: <message>`.
- **`toMarkdown`.** Escape `|` in details as `\|`.
- **CLI.** Load `PROVIDERS` with `import('../src/core/ai/providers.js')`. If that fails, add one failing row `cors | providers | not built yet`. Write the report to `--out` and append it to `GITHUB_STEP_SUMMARY` when that is set. Always exit 0.

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/unit/probe-live.test.js`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add tools/probe-live.js tests/unit/probe-live.test.js
git commit -m "Add the live probe for CORS, framing, collections and endpoints"
```

---

### Task 13: The probe workflow and the daily Pages schedule

**Files:**
- Create: `.github/workflows/byways-probe.yml`
- Modify: `.github/workflows/pages.yml` (from Plan 01)
- Test: `tests/unit/workflows.test.js`

**Interfaces:**
- Consumes: the `tools/data-job.js`, `tools/build.js --linkcheck` and `tools/probe-live.js` CLIs (Tasks 10–12).
- Produces: a weekly and manual live probe with a job summary and an artifact, and a daily 00:07 UTC Pages build that runs the data job.

- [ ] **Step 1: Write the failing test**

```js
const wf = (n) => readFileSync(new URL('../../../../.github/workflows/' + n, import.meta.url), 'utf8');
test('pages.yml runs the data job daily at 00:07 UTC after a link-checked build', () => {
  const y = wf('pages.yml');
  for (const s of ["- cron: '7 0 * * *'", 'workflow_dispatch', '--max-time 20', '--linkcheck linkcheck-prev.json',
    'node tools/data-job.js --out dist/pwa/data --live https://iteatsthesalt.github.io/Game-Dev-Resources/byways/']) assert.ok(y.includes(s), s);
  assert.ok(y.indexOf('tools/data-job.js') > y.indexOf('--linkcheck linkcheck-prev.json'));
});
test('byways-probe.yml runs the probe weekly and on demand and keeps the report', () => {
  const y = wf('byways-probe.yml');
  for (const s of ['workflow_dispatch', "- cron: '41 5 * * 1'", 'runs-on: ubuntu-24.04', 'contents: read', 'actions/checkout@v7', 'actions/setup-node@v4',
    'node tools/probe-live.js --out probe-report.md', 'actions/upload-artifact@v7', 'path: Apps/Byways/probe-report.md']) assert.ok(y.includes(s), s);
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `node --test tests/unit/workflows.test.js`
Expected: FAIL with "ENOENT" for `byways-probe.yml`, and the missing cron string for `pages.yml`.

- [ ] **Step 3: Write `byways-probe.yml` and change `pages.yml`**

`byways-probe.yml` (exact):

```yaml
name: Byways live probe
on:
  workflow_dispatch:
  schedule:
    - cron: '41 5 * * 1'
permissions:
  contents: read
jobs:
  probe:
    runs-on: ubuntu-24.04
    defaults:
      run:
        working-directory: Apps/Byways
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: node tools/probe-live.js --out probe-report.md
      - uses: actions/upload-artifact@v7
        with:
          name: byways-probe-report
          path: Apps/Byways/probe-report.md
```

In `pages.yml`:

1. Add `schedule:` with `- cron: '7 0 * * *'` under `on:`, next to the existing push and `workflow_dispatch` triggers.
2. In the build job, before the web build, add a step "Fetch the last link check" that runs `curl -fsS --max-time 20 -o linkcheck-prev.json https://iteatsthesalt.github.io/Game-Dev-Resources/byways/data/linkcheck.json || rm -f linkcheck-prev.json`.
3. Add `--linkcheck linkcheck-prev.json` to the web build command.
4. After the build, add a step "Daily data" that runs `node tools/data-job.js --out dist/pwa/data --live https://iteatsthesalt.github.io/Game-Dev-Resources/byways/`, before `_site/` is assembled.

Keep the steps in `Apps/Byways/` like the rest of the job.

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/unit/workflows.test.js`
Expected: PASS, 2 tests. Then run `npm test` and `npm run e2e`; expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add ../../.github/workflows/byways-probe.yml ../../.github/workflows/pages.yml tests/unit/workflows.test.js
git commit -m "Add the weekly live probe and the daily data step"
```

After the first probe run, set each adapter's `tier` to match the report (§17.4). That is a follow-up change, not part of this plan.
