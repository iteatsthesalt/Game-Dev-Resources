# Byways 04: Vault and Daily Fate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Internet Archive client and Vault (hidden games, gem score, Play with a watchdog), Daily Fate (file plus backup recipe), the old-web and itch.io sources, the daily data job with link check, and the weekly live probe.

**Architecture:** One shared Archive queue (`ia/client.js`) sits on Plan 01's `Http` and serves every Archive caller: the `ia`, `vault` and `oldweb` adapters, the Vault view and the Node tools. Gem logic (`ia/vault.js`) and the Daily recipe (`daily.js`) are pure core modules with injected fetchers, so the browser and `tools/data-job.js` run the same code. The UI adds two views through Plan 01's registries, and the CI jobs run the Node tools with a descriptive User-Agent.

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
- `feature_films` is `mixed`, so the Family filter keeps it out of Fate and lean-back.
- Daily Fate: "The day rolls over at UTC midnight. The view shows the next rollover in local time." The backup is labelled **Daily Fate (backup pick)**. "**Share today's Fate** gives spoiler-free text with a link to `#/daily/YYYY-MM-DD`. Streaks are gentle and never nag."
- Data job: "it sends a descriptive User-Agent with no personal data, and makes light, low-volume requests." "If a data step fails, it keeps the last good file from the live site." Schedule: 00:07 UTC (`'7 0 * * *'`).
- Link check: "A link that fails two days in a row is left out of the next build, and its entry is flagged for review."
- Old web: "Each is opened through `archive.org/wayback/available?url=…&timestamp=2009`, and an empty result counts as a miss."
- Every test mocks the network. Live checks run only in `byways-probe.yml`.

## Review Focus

1. **The Archive is down or blocked at first run.** Validation must keep the verified collections, must not cache a partial list for 7 days, and the Vault must show "Archive unavailable" rather than empty shelves. Pinned by `validateCollections keeps verified ids and caches nothing when the Archive is unreachable` (Task 2) and `shows Archive unavailable when a live shelf load fails` (Task 7).
2. **Archive docs with odd field shapes.** `title`, `creator` and `collection` arrive as a string or an array, `year` as `"1994"`, `"199?"` or missing, `downloads` missing or 0, and `description` as an HTML array. Cards and scores must still work. Pinned by `iaDocToFind and gemScore accept string, array and missing fields` (Task 2).
3. **UTC midnight while the Daily view is open, or a stale cached `daily.json`.** At 23:59:50 UTC the view must roll to the next day by itself, and a file dated yesterday must give the labelled backup. Pinned by `loadDaily uses the backup when the file is from yesterday` (Task 3) and `rolls over at UTC midnight while open` (Task 9).
4. **Link-check false positives.** Sites that answer `HEAD` with 405, or block robots with 403 or 429, must not be counted as dead and dropped from the build. Pinned by `HEAD 405 retries with GET, and 401/403/429 do not count as dead` (Task 10).
5. **Pressing Play twice, or leaving the Vault while the watchdog runs.** There must be one frame, and a pending watchdog must not mark a game broken after the user has left. Pinned by `Play twice mounts one frame, and leaving clears the watchdog` (Task 8).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/core/ia/client.js` | The one Archive queue: pacing, 429 pause, caching, `search`, `count`, `metadata`, `wayback`, `sharedIaClient` |
| `src/core/ia/vault.js` | Collections, shelves, labels, gem query and score, why chips, doc → Find, validation, shelf gems, Vault Fate |
| `src/core/daily.js` | Daily seed, backup recipe, file loading, pick → Find mappers |
| `src/core/sources/ia.js` | Archive non-game adapter (films, audio, magazines) |
| `src/core/sources/vault.js` | Archive games adapter, with the snapshot fallback and embed-broken skip |
| `src/core/sources/oldweb.js` | GeoCities seeds through Wayback |
| `src/core/sources/itch.js` | itch.io feeds: live when privileged, else the snapshot; `parseItchRss` |
| `src/core/sources/index.js` (modify) | Registers `ia`, `vault`, `oldweb`, `itch` |
| `src/ui/views/vault.js` | Vault view, shelves, gem cards, player and watchdog |
| `src/ui/views/daily.js` | Daily Fate view |
| `src/ui/boot.js`, `src/ui/views/index.js` (modify) | `app.ia`, snapshot loader, embed-broken set, view imports |
| `src/data/vault-starter.json`, `src/data/geocities-seeds.json` | Curated data |
| `tools/data-job.js` | Writes `daily.json`, `itch.json`, `vault-index.json`, `linkcheck.json` and the snapshot extras |
| `tools/linkcheck.js` | Checks library links and keeps fail streaks |
| `tools/build.js` (modify) | `--linkcheck <file>` drops entries with `failStreak ≥ 2` |
| `tools/probe-live.js` | The §17.4 live checks and Markdown report |
| `.github/workflows/byways-probe.yml`, `.github/workflows/pages.yml` (modify) | Weekly probe; daily data step |
| `tests/unit/helpers/fake-fetch.js` | `fakeFetch` and `instantClock` for unit tests |
| `tests/fixtures/http/ia/*`, `tests/fixtures/http/daily/*`, `tests/fixtures/http/itch/*`, `tests/fixtures/routes.js` (modify) | Hand-written fixtures from the research shapes |

### Task 1: The Archive client and queue

**Files:**
- Create: `src/core/ia/client.js`, `tests/unit/helpers/fake-fetch.js`
- Test: `tests/unit/ia-client.test.js`

**Interfaces:**
- Consumes: `createHttp({transport, clock}) → Http` (`register`, `request`, `getJson`); `NetError` (`kind`, `status`); `createCache(store, clock)`; `openStore(memoryBackend())`; `fakeClock(start)` with `advance(ms)`.
- Produces: `createIaClient({http, cache, clock}) → IaClient`, where `IaClient = {search({q, fl, sort, rows, page}) → Promise<{numFound, docs}>, count(q) → Promise<number>, metadata(id) → Promise<object|null>, wayback(url, timestamp) → Promise<{url, timestamp}|null>}`. `sharedIaClient({http, cache, clock}) → IaClient` returns one client per `http` object. Test helpers `fakeFetch(routes, {clock}?) → {fetch(url, init) → Promise<Response>, calls: Array<{url, init, at}>}` (routes are `[RegExp, (url, init) => ({status?, body?, headers?}) | Promise<…>]`; an object body is sent as JSON; a responder that throws makes `fetch` reject; unmatched URLs get 404) and `instantClock(start = Date.UTC(2026, 10, 11, 12)) → {now, setTimeout, clearTimeout}`, whose `setTimeout(fn, ms)` adds `ms` to `now` and runs `fn` on `setImmediate`.

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
  assert.equal(await ia.metadata('nope'), null);
  assert.equal(await ia.metadata('blank'), null);
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
test('searches are cached for 24 h and metadata for 7 days', async () => {
  await ia.count('a'); await ia.count('a'); assert.equal(net.calls.length, 1);
  clock.advance(86400001); await ia.count('a'); assert.equal(net.calls.length, 2);
  await ia.metadata('msdos_Whizz_1994'); clock.advance(6 * 86400000); await ia.metadata('msdos_Whizz_1994');
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
  assert.equal(await ia.wayback('http://www.geocities.com/gone/', '2009'), null);
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

It calls `http.register('ia', {perMinute: 60, concurrent: 2})` and sends every request as `http.request(url, {source: 'ia'})` with no headers. Base URL `https://archive.org`. Build query strings with `URLSearchParams.append`, one `fl[]` and one `sort[]` per value. `metadata` and a `{}` or `{result: {}}` reply both give `null`. `wayback` returns `null` unless `closest.available` is true, and rewrites a leading `http://web.archive.org/` to `https://web.archive.org/`. Cache keys: `ia:s:<url>` for 86400000 ms, `ia:m:<id>` and `ia:w:<url>|<timestamp>` for 604800000 ms. Only successful replies are cached; errors never are. `sharedIaClient` keeps a `WeakMap` keyed by `http`. The queue:

```js
// state: lastStart = -Infinity, active = 0, waiting = [], streak = 0, pausedUntil = 0, timer = null
// pump(): if (clock.now() < pausedUntil) reject every waiting job with new NetError({kind: 'circuit', source: 'ia'}); return
//         if (active >= 2 || !waiting.length || timer) return
//         wait = lastStart + 1000 - clock.now(); if (wait > 0) { timer = clock.setTimeout(() => { timer = null; pump() }, wait); return }
//         lastStart = clock.now(); active++; run the first job; on settle: active--; pump()
// on a reply: status 429 → streak++, and when streak === 2 → pausedUntil = clock.now() + 300000, streak = 0. Any other reply → streak = 0.
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/unit/ia-client.test.js`
Expected: PASS, 10 tests.

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

`seq = (...v) => () => v.shift()`. A stub `ia` records `count` and `search` arguments.

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
test('gemWhy gives the chips', () => {
  assert.deepEqual(gemWhy({ downloads: 312, collection: ['softwarelibrary_msdos_shareware'], year: '1994', avg_rating: 4.5, num_reviews: 3 }), ['312 downloads', 'MS-DOS Shareware', '1994', '★4.5 (3)']);
  assert.deepEqual(gemWhy({ downloads: 1, collection: 'softwarelibrary_c64_games', year: 1985 }), ['1 download', 'C64 Games', '1985']);
  assert.deepEqual(gemWhy({ downloads: 1234, collection: [] }), ['1,234 downloads']);
});
test('iaDocToFind builds an Archive game find', () => {
  const f = iaDocToFind({ identifier: 'msdos_Whizz_1994', title: 'Whizz', creator: 'Flair', year: '1994', downloads: 312, collection: ['softwarelibrary_msdos_shareware'] }, { kind: 'game' });
  assert.equal(f.id, 'ia:msdos_Whizz_1994'); assert.equal(f.source, 'vault'); assert.equal(f.kind, 'game');
  assert.equal(f.url, 'https://archive.org/details/msdos_Whizz_1994');
  assert.equal(f.embedUrl, 'https://archive.org/embed/msdos_Whizz_1994');
  assert.equal(f.imageUrl, 'https://archive.org/services/img/msdos_Whizz_1994');
  assert.equal(f.author, 'Flair'); assert.equal(f.attribution, 'Internet Archive'); assert.equal(f.safety, 'curated');
  assert.deepEqual(f.tags, ['retro']); assert.deepEqual(f.why, ['312 downloads', 'MS-DOS Shareware', '1994']);
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
  // stub count → 250; search → docs with downloads 3000, 312, 20 (titles 'Big', 'Mid', 'Tiny'), all year 1990
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
- `gemWhy`: downloads as `n.toLocaleString('en-US') + ' download' + (n === 1 ? '' : 's')`; the label of the first known collection; the year; and `★<avg rounded to 1 decimal, trailing .0 dropped> (<num_reviews>)` when `avg_rating > 0` and `num_reviews ≥ 1`. Leave out any chip whose field is missing.
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

<!-- PLAN CONTINUES -->
