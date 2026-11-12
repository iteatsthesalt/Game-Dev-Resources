# Byways 02: Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build everything that finds, picks, remembers and shows a find: the Find model, the never-twice seen-set, Back history, taste and Tuned picking, Fate, Rabbit Hole, collections, share links, backup, the free source adapters with their probe, the engine, and the Stumble, Feed, Saved, Import and Settings (taste, sources, data, privacy) screens, plus the first-run interests step and the starter library.

**Architecture:** Pure core modules in `src/core/` (no DOM) hold the state and the rules. Each source is one adapter file that turns a recorded HTTP response into `Find` objects through `makeFind`. `createEngine` owns the candidate pool, up to 3 prepared finds, the injected queue (search now, AI in Plan 05), the seen-set, history, taste and reactions. The UI calls only the engine and the small stores the engine exposes. Plan 04 adds the `ia`, `vault`, `oldweb`, `itch` and `webring` adapters by registering them in `sources/index.js`; the engine has no Archive code beyond skipping the `SELF_PACED` ids when it registers rates.

**Tech Stack:** JavaScript ES2022 modules, no framework or bundler. `node:test` for unit tests, `@playwright/test@1.63.0` (Chromium) for end-to-end tests. `CompressionStream('deflate-raw')` for share links. Everything from Plan 01: `createHttp`, `openStore`/`memoryBackend`, `createCache`, `fakeClock`, `hash64`, `gumbel`, `mulberry32`, the `util/url.js` and `util/text.js` helpers, `utcDate`, `APP_VERSION`, `h`, `clear`, `announce`, `showToast`, the three UI registries, and the e2e helpers (`test`/`expect`/`mockNet`, `gotoApp`/`skipFirstRun`, `expectNoSeriousA11y`, `installFakeSpeech`).

**Spec:** `docs/superpowers/specs/2026-11-11-byways-design.md` (§5, §7, §8, §9.1, §14.1–§14.3, §15.1; the Privacy text also uses §6.2, §11.2, §12.8 and §15.2). Contract: `docs/superpowers/plans/2026-11-11-byways-00-overview.md`. Research: `docs/superpowers/specs/byways-research/free-sources.md`, `landscape.md`, `critic.md`.

## Global Constraints

- Every item in the overview's "Global constraints (every plan)" and "Working conventions" applies. The ones below bite this plan hardest; values are verbatim from the spec.
- **Never twice:** "A permanent seen-set means you never get the same find twice. When a pool is used up, Byways says so instead of quietly repeating."
- **Seen key:** "a 64-bit hash of each normalised URL, with a timestamp" (§14.1), using `hash64(normalizeUrl(url))`.
- **Pacing:** "Back history of 50 finds", "Prefetch at most 3 finds ahead", "Skip any source that takes longer than 8 s, with no error shown", domain cooldown of 10 stumbles.
- **Tuned:** momentum `0.6·(1−s)`, your taste `0.3·(1−s)`, wildcard `0.1 + 0.9·s`; default `s = 0.25`; "until you have made 5 reactions, every pick is a wildcard"; "about 50 candidates are kept warm".
- **Score:** `score = Σ weight(tag) + weight(source) + Gumbel noise`; weights are clamped to −3 … +3.
- **Fate:** "If the find is a miss or already seen, retry, up to 3 times"; weights 0–3, default 1; "It never draws from raw indexes."
- **Feed:** "Each batch is 30 cards … never ranked by engagement. Each batch ends with "That's 30. Stumble on or call it a day"."
- **Share:** `#s=<payload>`, payload `base64url(deflate-raw(JSON))`, "A link is at most 2,000 characters".
- **Card labels:** **Like**, **Not for me**, **Save**, **Share**, **Open**, **More like this**, **Read it**, and a **⋯** menu with **Less of this topic**, **Never this site**, **Broken or spam**, **Why am I seeing this?**. "Like, Not for me, Save and Never this site show a 5-second **Undo**."
- **Images:** "Byways never fetches a site's own preview image (`og:image`), and never uses third-party screenshot or favicon services." "Byways shows images only from items marked open or public domain."
- **Family filter:** "on by default and keeps `mixed` sources out of Fate and lean-back"; §8.3 applies it to every pick. Results of a search the user asked for (origins `'search'` and `'ai'`) keep their `mixed` finds outside lean-back (overview, "Family filter at inject").
- **Headers:** `Api-User-Agent` (Wikimedia) and `AIC-User-Agent` (Art Institute) set to `Byways/<version> (+https://github.com/iteatsthesalt/Game-Dev-Resources)`, never with user details.
- **Rates (§7.3):** iNaturalist and Open Library 1 request per second; Art Institute 60 per minute; GitHub search 10 per minute; Wikimedia about 10 per minute; Library of Congress 10 per minute ("an HTML/CAPTCHA reply counts as a failure"); APOD by key tier with a local daily counter.
- **Archive pacing:** nothing in this plan calls `http.register` for `ia` or `vault`, because Plan 04's Archive queue alone paces and backs off those sources (overview, "Archive pacing"). The engine and the test kit skip the `SELF_PACED` ids (Task 5).
- **Caching (§7.3):** "24 h for searches, 7 days for item details, and a week for the Kagi lists"; GitHub results at least 1 hour.
- **Network (§15.1):** stumbling contacts "Only the enabled sources (§7.2) and the site you open"; the link check contacts "The find's site, before it is shown", and only when **Check links before showing** is on.
- **Shared links:** a find whose `source` is `shared` (a link shared into the Android app, Plan 08) has no adapter. The taste ignores its source weight, Rabbit Hole asks Marginalia's `more()` for it, and `generatedImage` shows **Shared** (overview, Plan 08's "Links shared in"). Tasks 3, 7 and 22 handle it.
- **Keys:** every key is read through `ctx.secrets`, which is `app.secrets` (overview `App` table). The ids are fixed: `src:europeana`, `src:openverse` (JSON `{clientId, clientSecret}`), `src:datagov` (APOD and Smithsonian; `DEMO_KEY` without it), `src:marginalia` and `src:github`. A key never goes into a cache key, a store other than the secrets store, or a log.
- **Styles:** the CSP is `style-src 'self'`, so UI code sets dynamic styles only through CSSOM (`el.style.setProperty`), never a `style` attribute.
- **Console:** app code reports recoverable problems with `console.warn`, never `console.error`; the e2e `test` fixture fails on any console error (Plan 01).
- **Headings:** the router renders each view's `title` as the page's `h1` (overview, UI conventions), so no view in this plan renders an `h1` of its own.

## Review Focus

1. **Hostile text and links in source data.** An Artist field holding `<a href="javascript:…">`, an HN `story_text` with `<script>`, or a `data:` image URL must show as plain text and the bad link or image must be dropped. Pinned by `makeFind drops non-http image urls` (Task 1), `commons turns extmetadata HTML into plain text` (Task 12) and the e2e `card shows markup as plain text` (Task 22).
2. **Double presses.** Pressing Next (or Space, or saying "next") twice fast must give two different finds and add each to the seen-set once. Pinned by `two concurrent next calls return different finds` (Task 20).
3. **Offline versus used up.** With the network down, Stumble must say it can't reach the sources, not that you have seen everything, even with the starter library on, and must never hang. Pinned by `every source failing gives the unreachable message, even with the library on` and `a slow source never holds up a find and is skipped after 8 s` (Task 20).
4. **Broken, old or future share links and backup files.** A truncated `#s=` link, a payload with `v: 2`, or a backup with the wrong `format` must show a clear message and change nothing. Pinned by `decodeShare rejects v2 and garbage` (Task 9), `importBackup rejects a foreign file and writes nothing` (Task 10) and the e2e `a broken share link shows a message` (Task 26).
5. **Injected finds that should never show.** Search or AI results that are already seen, on a blocked domain, duplicated, or tagged with ids not in `tags.json` must be dropped or cleaned before they reach a card. Pinned by `inject drops seen, blocked, duplicate and unknown-tag finds` (Task 20).

---

## File structure

All paths are under `Apps/Byways/`.

| File | Responsibility |
|---|---|
| `src/core/model/find.js` | `makeFind`, `FIND_KINDS`, `SAFETY`: the one way to build a valid `Find` |
| `src/core/seen.js` | Permanent seen-set keyed by `hash64(normalizeUrl(url))` |
| `src/core/history.js` | Back/forward trail of 50 finds, persisted |
| `src/data/tags.json` | The 40-tag vocabulary in four groups |
| `src/core/taste.js` | `DEFAULT_TASTE`, `applyReaction` (§8.2 table), `describeChange` |
| `src/core/pick.js` | Tuned branch maths, scoring, eligibility, `pickNext` |
| `src/core/fate.js` | `fatePull` |
| `src/core/rabbit.js` | `similarLocal` (tags + TF-IDF), `createRabbitHole` |
| `src/core/collections.js` | Collections store, default `saved`, current collection |
| `src/core/share.js` | Share-link codec, `SHARE_BASE`, `MAX_LINK_CHARS`, `payloadFromLink` |
| `src/core/backup.js` | Backup export/import, bookmarks HTML |
| `src/core/liveness.js` | `checkLive` |
| `src/core/sources/index.js` | `SOURCES`, `getSource`, `enabledSources`, `IDENT` |
| `src/core/sources/probe.js` | `probeSource`, `runProbes` |
| `src/core/sources/<id>.js` | 20 adapters: wikipedia, commons, inat, openlibrary, apod, marginalia, github, hn, aic, met, cleveland, nasaimages, loc, smithsonian, europeana, openverse, kagi, kagirandom, wiby, library |
| `src/core/engine.js` | `createEngine`: pool, prefetch, queue, modes, reactions, Rabbit Hole, feed, search |
| `src/data/library.json` | About 300 curated starter finds |
| `src/ui/components/card.js` | `renderCard` with every action |
| `src/ui/components/generated-image.js` | `generatedImage`: initial, hue from `hash64`, source badge |
| `src/ui/views/stumble.js` | Stumble view, modes, Familiar ↔ Strange, search, Back, Rabbit Hole UI, Wiby leap |
| `src/ui/views/feed.js` | Feed batches of 30 |
| `src/ui/views/saved.js` | Collections, share, bookmarks, **Import from link** |
| `src/ui/views/import.js` | `#s=` preview and **Import** |
| `src/ui/views/settings/taste.js` | Your taste section and the first-run interests step |
| `src/ui/views/settings/sources.js` | Sources section and source keys |
| `src/ui/views/settings/data.js` | Backup export/import, reset seen |
| `src/ui/views/settings/privacy.js` | Settings → Privacy: the §15.1 table and the privacy notes |
| `src/ui/boot.js` (modify) | Sets `secrets`, creates `seen`, `history`, `collections`, `engine`, `search` |
| `src/ui/views/index.js` (modify) | Imports this plan's views and settings sections |
| `tests/unit/helpers/fixture-http.js` | `adapterCtx`, `memorySecrets`, `engineFor`: a real `createHttp` over recorded fixtures |
| `tests/fixtures/http/<source>/*.json\|.txt` | Hand-written responses in the documented shapes |
| `tests/fixtures/routes.js` (modify) | One route per endpoint, plus two catch-alls for fixture images and link checks |
| `tests/e2e/helpers/net.js` (modify) | `stageLibrary(page, entries)` |
| `tests/e2e/firstrun.spec.js`, `tests/e2e/smoke.spec.js` (modify) | Step past the new interests step |
| `tests/fixtures/http/library/small.json` | Three-entry library for e2e |

**Adapter conventions (every `sources/<id>.js`).** Each file default-exports one adapter in the contract shape and is added to `ADAPTERS` in `sources/index.js` in the same task. Methods a source does not support return `[]`. Network failures propagate as `NetError` (the engine skips that source silently). Every find is built with `makeFind`, with `source: id`, the adapter's base tags (Task 5 table) and a first `why` chip naming the pool, for example `'Wikipedia: random article'`. Every request goes through `ctx.http` with `source: id`, and keys come only from `ctx.secrets`. `search` responses are cached in `ctx.cache` for 24 h and item details for 7 days (a task names any other cache), keyed by the request URL with its `api_key` parameter removed. **Fixtures** live in `tests/fixtures/http/<id>/`. They are hand-written in the response shapes that `byways-research/free-sources.md` documents, they hold the values the tests assert, and every image URL in them ends in `.jpg` or `.png`. A task lists only the extra items its tests need. `tests/fixtures/routes.js` gets one route per endpoint pattern the adapter calls, including its `probeUrl`, so that the e2e `mockNet` covers every request the app makes.

### Task 1: The Find model

**Files:**
- Create: `src/core/model/find.js`
- Test: `tests/unit/find.test.js`

**Interfaces:**
- Consumes: `hash64(str)` (util/hash.js), `normalizeUrl(u)`, `isHttpUrl(u)` (util/url.js), `toPlainText(html)`, `truncate(text, max)` (util/text.js).
- Produces: `FIND_KINDS = ['site','article','image','game','video','audio','book','project']`, `SAFETY = ['curated','mostly','mixed']`, `makeFind(partial) → Find|null`.

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test'; import assert from 'node:assert/strict';
import { makeFind } from '../../src/core/model/find.js';
import { hash64 } from '../../src/core/util/hash.js';
const base = { source: 'library', kind: 'site', title: 'Tiny Synth', description: 'Make sounds.', url: 'https://www.Example.com/a/?utm_source=x', safety: 'curated' };

test('makeFind fills defaults and a url id', () => {
  const f = makeFind(base);
  assert.equal(f.id, 'url:' + hash64('https://example.com/a'));
  assert.deepEqual(f.tags, []); assert.deepEqual(f.why, []);
  assert.equal(makeFind({ ...base, id: 'wiki:en:Ada_Lovelace' }).id, 'wiki:en:Ada_Lovelace');
});
test('makeFind returns null for a bad url, title or kind', () => {
  for (const url of ['javascript:alert(1)', 'ftp://x.org/', '']) assert.equal(makeFind({ ...base, url }), null);
  assert.equal(makeFind({ ...base, title: '   ' }), null);
  assert.equal(makeFind({ ...base, kind: 'toy' }), null);
});
test('makeFind applies the length limits and plain text', () => {
  const f = makeFind({ ...base, title: 'x'.repeat(250), description: '<b>Bold</b> ' + 'y'.repeat(500) });
  assert.equal(f.title.length, 200); assert.ok(f.title.endsWith('…'));
  assert.equal(f.description.length, 400); assert.ok(f.description.startsWith('Bold y'));
});
test('makeFind drops non-http image urls', () => {
  assert.equal(makeFind({ ...base, imageUrl: 'data:image/png;base64,AA' }).imageUrl, undefined);
  assert.equal(makeFind({ ...base, imageUrl: 'javascript:x' }).imageUrl, undefined);
  assert.equal(makeFind({ ...base, embedUrl: 'https://evil.example/embed/x' }).embedUrl, undefined);
  assert.equal(makeFind({ ...base, embedUrl: 'https://archive.org/embed/abc' }).embedUrl, 'https://archive.org/embed/abc');
});
test('makeFind treats an unknown safety as mixed', () => {
  assert.equal(makeFind({ ...base, safety: 'whatever' }).safety, 'mixed');
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/unit/find.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/core/model/find.js`.

- [ ] **Step 3: Implement `makeFind(partial) → Find|null` in `src/core/model/find.js`**

Title and description go through `toPlainText` then `truncate` (200 and 400). `author`, `licence` and `attribution` go through `toPlainText` and `truncate(…, 200)`. `embedUrl` is kept only when it matches `^https://archive\.org/embed/[A-Za-z0-9._-]+$`. `tags` and `why` become de-duplicated string arrays. Unknown keys pass through only for `meta`, `foundBy` and `teamPick`.

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/unit/find.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/model/find.js tests/unit/find.test.js
git commit -m "Add the Find model with url ids and length limits"
```

### Task 2: Seen-set and Back history

**Files:**
- Create: `src/core/seen.js`, `src/core/history.js`
- Test: `tests/unit/seen.test.js`, `tests/unit/history.test.js`

**Interfaces:**
- Consumes: `openStore(backend)`, `memoryBackend()` (store/db.js), `realClock`, `fakeClock`, `hash64`, `normalizeUrl`, `domainOf`, `makeFind` (Task 1).
- Produces: `createSeen(store) → {has(url) → Promise<boolean>, add(url) → Promise<void>, count() → Promise<number>, reset() → Promise<void>}`; values are `{t: <ms>}` under key `hash64(normalizeUrl(url))` in the `seen` store. `createHistory(store, {max = 50, clock = realClock}) → {ready: Promise<void>, push(find), back() → Find|null, forward() → Find|null, current() → Find|null, list() → Find[], recentDomains(n) → string[], reload() → Promise<void>}`. It persists `{items: Array<{find, t}>}` under key `'trail'` in the `history` store; the cursor lives in memory and starts at the newest item. `reload()` reads that key again (Task 29 calls it after a backup import).
- Several engines on one store (overview; the extension runs three): `push` never overwrites another writer. Its chained write re-reads the stored items, merges them with this history's own by find id (the later `t` wins), sorts by `t`, keeps the last `max` and writes them back. The in-memory trail stays this history's own.

- [ ] **Step 1: Write the failing tests**

```js
// tests/unit/seen.test.js
test('seen treats url variants as one find', async () => {
  const store = await openStore(memoryBackend()); const seen = createSeen(store);
  await seen.add('https://www.example.com/a/?utm_source=x#top');
  assert.equal(await seen.has('https://example.com/a'), true);
  assert.equal(await seen.has('https://example.com/b'), false);
  assert.equal(typeof (await store.get('seen', hash64('https://example.com/a'))).t, 'number');
  assert.equal(await seen.count(), 1);
});
test('seen ignores non-http urls and resets', async () => {
  const seen = createSeen(await openStore(memoryBackend()));
  await seen.add('javascript:x'); assert.equal(await seen.count(), 0);
  assert.equal(await seen.has('not a url'), false);
  await seen.add('https://example.org/'); await seen.reset(); assert.equal(await seen.count(), 0);
});
```

```js
// tests/unit/history.test.js  (f(t, url) = makeFind({source:'library',kind:'site',title:t,url,safety:'curated'}))
test('history keeps max finds and walks back and forward', async () => {
  const store = await openStore(memoryBackend()); const h = createHistory(store, { max: 3 }); await h.ready;
  for (const t of ['a','b','c','d']) h.push(f(t, `https://${t}.example.com/`));
  assert.deepEqual(h.list().map(x => x.title), ['b','c','d']);
  assert.equal(h.back().title, 'c'); assert.equal(h.back().title, 'b'); assert.equal(h.back(), null);
  assert.equal(h.forward().title, 'c');
  h.push(f('e', 'https://e.example.com/'));
  assert.deepEqual(h.list().map(x => x.title), ['b','c','e']);
  assert.deepEqual(h.recentDomains(2), ['e.example.com', 'c.example.com']);
});
test('history survives a restart', async () => {
  const store = await openStore(memoryBackend()); const h = createHistory(store); await h.ready;
  h.push(f('a', 'https://a.example.com/')); await new Promise(r => setTimeout(r, 0));
  const h2 = createHistory(store); await h2.ready; assert.equal(h2.current().title, 'a');
  await store.put('history', 'trail', { items: [{ find: f('z', 'https://z.example.com/'), t: 1 }] });
  await h2.reload(); assert.equal(h2.current().title, 'z');
});
test('two histories on one store merge instead of overwriting', async () => {
  const store = await openStore(memoryBackend()); const clock = fakeClock(1000); const tick = () => new Promise((r) => setTimeout(r, 0));
  const h1 = createHistory(store, { clock }); const h2 = createHistory(store, { clock }); await h1.ready; await h2.ready;
  h1.push(f('a', 'https://a.example.com/')); await tick(); clock.advance(1);
  h2.push(f('b', 'https://b.example.com/')); await tick();
  const h3 = createHistory(store, { clock }); await h3.ready; assert.deepEqual(h3.list().map((x) => x.title), ['a', 'b']);
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `node --test tests/unit/seen.test.js tests/unit/history.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement `createSeen` and `createHistory`**

`push` drops entries after the cursor, appends `{find, t: clock.now()}`, trims the oldest beyond `max`, moves the cursor to the end and starts the merging write without awaiting it (writes are chained so they land in order). `recentDomains(n)` reads the last `n` entries up to the cursor, newest first, unique.

- [ ] **Step 4: Run them and see them pass**

Run: `node --test tests/unit/seen.test.js tests/unit/history.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/seen.js src/core/history.js tests/unit/seen.test.js tests/unit/history.test.js
git commit -m "Add the seen-set and the Back history"
```

### Task 3: Tag vocabulary and taste

**Files:**
- Modify: `src/data/tags.json` (Plan 01's empty stub)
- Create: `src/core/taste.js`
- Test: `tests/unit/tags-data.test.js`, `tests/unit/taste.test.js`

**Interfaces:**
- Consumes: `domainOf(u)`.
- Produces: `src/data/tags.json` in the overview shape; `DEFAULT_TASTE`; `applyReaction(taste, find, reaction, extra?) → {taste, change}` (pure, never mutates its input); `describeChange(change, labelOf = (id) => id.replace(/-/g, ' ')) → string`, where the engine passes `labelOf` built from `data.tags`. `extra` is `{tag}` for `interest` and `lessTopic` (default `find.tags[0]`), and `{blockDomain: true}` for `broken`. A find from the pseudo-source `shared` changes no source weight: `sources` stays as it was and `change.sourceDelta` is 0, whatever the reaction (overview).

`tags.json` holds exactly these 40 tags (id, then label), in this group order:

| Group id · label | Tags |
|---|---|
| `tech-science` · Tech & Science | science Science, programming Programming, diy DIY, hardware Hardware, tech Tech, web Web, ai AI, space Space, nature Nature, maths Maths |
| `culture-creative` · Culture & Creative | art Art, design Design, photography Photography, music Music, books Books, film Film, comics Comics, essays Essays, humanities Humanities, history History, culture Culture, oldweb Old web |
| `life-world` · Life & World | food Food, travel Travel, society Society, life Life, politics Politics, economy Economy, education Education, work Work, health Health, sports Sports |
| `games` · Games | retro Retro, indie Indie, puzzle Puzzle, arcade Arcade, adventure Adventure, art-game Art game, jam Jam, toy Toy |

- [ ] **Step 1: Write the failing tests**

```js
// tests/unit/tags-data.test.js  (reads src/data/tags.json with fs)
test('tags.json has 40 unique kebab-case tags in four groups', () => {
  assert.equal(tags.v, 1);
  assert.deepEqual(tags.groups.map(g => g.id), ['tech-science','culture-creative','life-world','games']);
  const ids = tags.groups.flatMap(g => g.tags.map(t => t.id));
  assert.equal(ids.length, 40); assert.equal(new Set(ids).size, 40);
  for (const id of ids) assert.match(id, /^[a-z][a-z0-9-]*$/);
});
```

```js
// tests/unit/taste.test.js  (find = {source:'library', tags:['retro','indie'], url:'https://www.example.com/x'})
test('DEFAULT_TASTE matches the spec', () => assert.deepEqual(DEFAULT_TASTE,
  { v: 1, tags: {}, sources: {}, hiddenTags: [], blockedDomains: [], strangeness: 0.25, interests: [], reactions: 0 }));
test('like adds 1 per tag and 0.5 to the source', () => {
  const { taste, change } = applyReaction(Object.freeze(structuredClone(DEFAULT_TASTE)), find, 'like');
  assert.deepEqual(taste.tags, { retro: 1, indie: 1 }); assert.deepEqual(taste.sources, { library: 0.5 });
  assert.equal(taste.reactions, 1); assert.deepEqual(change.tagDeltas, { retro: 1, indie: 1 }); assert.equal(change.sourceDelta, 0.5);
});
test('save works like like, and weights cap at +3', () => {
  const { taste, change } = applyReaction({ ...DEFAULT_TASTE, tags: { retro: 3 } }, find, 'save');
  assert.equal(taste.tags.retro, 3); assert.equal(change.tagDeltas.retro, 0);
  assert.equal(taste.tags.indie, 1); assert.deepEqual(taste.sources, { library: 0.5 });
});
test('not for me takes 0.5 per tag and 0.25 from the source', () => {
  const { taste } = applyReaction(DEFAULT_TASTE, find, 'dislike');
  assert.deepEqual(taste.tags, { retro: -0.5, indie: -0.5 }); assert.deepEqual(taste.sources, { library: -0.25 });
});
test('a shared link moves the tags but no source weight', () => {
  const shared = { ...find, source: 'shared' }; const { taste, change } = applyReaction(DEFAULT_TASTE, shared, 'like');
  assert.deepEqual(taste.tags, { retro: 1, indie: 1 }); assert.deepEqual(taste.sources, {}); assert.equal(change.sourceDelta, 0);
  assert.deepEqual(applyReaction(DEFAULT_TASTE, shared, 'dislike').taste.sources, {});
});
test('less of this topic takes 2 and hides the tag at -3', () => {
  const once = applyReaction(DEFAULT_TASTE, find, 'lessTopic', { tag: 'retro' }).taste;
  assert.equal(once.tags.retro, -2); assert.deepEqual(once.hiddenTags, []);
  const { taste, change } = applyReaction(once, find, 'lessTopic', { tag: 'retro' });
  assert.equal(taste.tags.retro, -3); assert.deepEqual(taste.hiddenTags, ['retro']); assert.deepEqual(change.hidden, ['retro']);
});
test('never this site blocks the domain', () => {
  const { taste, change } = applyReaction(DEFAULT_TASTE, find, 'neverSite');
  assert.deepEqual(taste.blockedDomains, ['example.com']); assert.deepEqual(change.blocked, ['example.com']);
});
test('an interest adds 2 and does not count as a reaction', () => {
  const { taste } = applyReaction(DEFAULT_TASTE, null, 'interest', { tag: 'space' });
  assert.equal(taste.tags.space, 2); assert.deepEqual(taste.interests, ['space']); assert.equal(taste.reactions, 0);
});
test('broken can block the domain and is not a reaction', () => {
  const { taste } = applyReaction(DEFAULT_TASTE, find, 'broken', { blockDomain: true });
  assert.deepEqual(taste.blockedDomains, ['example.com']); assert.equal(taste.reactions, 0);
});
test('describeChange words each change', () => {
  const c = (o) => ({ tagDeltas: {}, sourceDelta: 0, hidden: [], blocked: [], ...o });
  assert.equal(describeChange(c({ tagDeltas: { retro: 1, indie: 1 } })), 'More retro and indie from now on.');
  assert.equal(describeChange(c({ tagDeltas: { art: 1, music: 1, toy: 1 } })), 'More art, music and toy from now on.');
  assert.equal(describeChange(c({ tagDeltas: { retro: -0.5 } })), 'Less retro from now on.');
  assert.equal(describeChange(c({ hidden: ['art-game'] })), 'Art game is hidden now.');
  assert.equal(describeChange(c({ blocked: ['example.com'] })), "You won't see example.com again.");
  assert.equal(describeChange(c({ sourceDelta: 0.5 })), 'More like this from now on.');
  assert.equal(describeChange(c({})), 'Noted.');
});
test('describeChange uses the tag labels', () => {
  const c = (o) => ({ tagDeltas: {}, sourceDelta: 0, hidden: [], blocked: [], ...o });
  const labelOf = (id) => ({ oldweb: 'Old web', ai: 'AI', retro: 'Retro' })[id];
  assert.equal(describeChange(c({ tagDeltas: { oldweb: 1, ai: 1, retro: 1 } }), labelOf), 'More old web, AI and retro from now on.');
  assert.equal(describeChange(c({ hidden: ['oldweb'] }), labelOf), 'Old web is hidden now.');
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `node --test tests/unit/tags-data.test.js tests/unit/taste.test.js`
Expected: FAIL: the group list of Plan 01's empty `tags.json` is wrong, and `ERR_MODULE_NOT_FOUND` for `taste.js`.

- [ ] **Step 3: Write `tags.json` from the table and implement `taste.js`**

`save` changes the taste exactly as `like` does (§8.2: "Like, or Save"). `like`, `dislike`, `save`, `lessTopic` and `neverSite` add 1 to `reactions`; `interest` and `broken` do not. `describeChange` checks `blocked`, then `hidden`, then tag deltas (positive ones before negative), then `sourceDelta`. A tag is worded as `labelOf(id)`: inside a sentence it is lower-cased unless the label is all capitals (`AI`, `DIY`), and a hidden tag starts the sentence with a capital letter. Zero deltas are left out of the wording.

- [ ] **Step 4: Run them and see them pass**

Run: `node --test tests/unit/tags-data.test.js tests/unit/taste.test.js`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add src/data/tags.json src/core/taste.js tests/unit/tags-data.test.js tests/unit/taste.test.js
git commit -m "Add the tag vocabulary and taste reactions"
```

### Task 4: Tuned picking

**Files:**
- Create: `src/core/pick.js`
- Test: `tests/unit/pick.test.js`

**Interfaces:**
- Consumes: `gumbel(rand)`, `domainOf`, `DEFAULT_TASTE` (Task 3), `makeFind` (Task 1).
- Produces: `chooseBranch(rand, s) → 'momentum'|'taste'|'wildcard'`; `scoreFind(find, taste, rand) → number`; `eligible(find, {seenHas, taste, recentDomains, familyFilter}) → boolean` where `seenHas` is a sync `(url) → boolean`; `pickNext({candidates, current, taste, rand, seenHas, recentDomains, familyFilter}) → {find, branch, why}|null`. `why` is `'wildcard'`, `'similar to <current title>'` or `'matches <tag> +<weight>'` (the find's highest-weighted tag, weight printed like `2` or `1.5`).

- [ ] **Step 1: Write the failing test**

```js
const seq = (...xs) => { let i = 0; return () => xs[i++ % xs.length]; };
const F = (title, tags, extra = {}) => makeFind({ source: 'library', kind: 'site', title, tags, safety: 'curated', url: `https://${title}.example.com/`, ...extra });
const warm = { ...DEFAULT_TASTE, tags: { retro: 2 }, reactions: 5 };
const opts = { seenHas: () => false, recentDomains: [], familyFilter: true };

test('chooseBranch splits 45/22.5/32.5 at s = 0.25', () => {
  assert.equal(chooseBranch(seq(0.449), 0.25), 'momentum');
  assert.equal(chooseBranch(seq(0.451), 0.25), 'taste');
  assert.equal(chooseBranch(seq(0.674), 0.25), 'taste');
  assert.equal(chooseBranch(seq(0.676), 0.25), 'wildcard');
  assert.equal(chooseBranch(seq(0), 1), 'wildcard');
});
test('scoreFind sums tag and source weights plus Gumbel noise', () => {
  const taste = { ...DEFAULT_TASTE, tags: { retro: 2, indie: 1 }, sources: { library: 0.5 } };
  assert.equal(scoreFind(F('a', ['retro', 'indie', 'toy']), taste, () => 0.5), 3.5 + gumbel(() => 0.5));
});
test('eligible applies every always-on filter', () => {
  const t = { ...DEFAULT_TASTE, hiddenTags: ['toy'], blockedDomains: ['b.example.com'] };
  assert.equal(eligible(F('a', []), { ...opts, taste: t }), true);
  assert.equal(eligible(F('a', []), { ...opts, taste: t, seenHas: () => true }), false);
  assert.equal(eligible(F('b', []), { ...opts, taste: t }), false);
  assert.equal(eligible(F('a', []), { ...opts, taste: t, recentDomains: ['a.example.com'] }), false);
  assert.equal(eligible(F('a', ['toy']), { ...opts, taste: t }), false);
  assert.equal(eligible(F('a', [], { safety: 'mixed' }), { ...opts, taste: t }), false);
  assert.equal(eligible(F('a', [], { safety: 'mixed' }), { ...opts, taste: t, familyFilter: false }), true);
});
test('cold start always picks a wildcard', () => {
  const r = pickNext({ ...opts, candidates: [F('a', ['retro'])], current: null, taste: DEFAULT_TASTE, rand: seq(0.1) });
  assert.equal(r.branch, 'wildcard'); assert.equal(r.why, 'wildcard');
});
test('momentum picks a candidate sharing a tag with the current find', () => {
  const r = pickNext({ ...opts, candidates: [F('a', ['puzzle']), F('b', ['retro'])], current: F('cur', ['retro']), taste: warm, rand: seq(0.1, 0.5) });
  assert.equal(r.find.title, 'b'); assert.equal(r.branch, 'momentum'); assert.equal(r.why, 'similar to cur');
});
test('taste picks the best score and says why', () => {
  const r = pickNext({ ...opts, candidates: [F('a', ['puzzle']), F('b', ['retro'])], current: null, taste: warm, rand: seq(0.5) });
  assert.equal(r.find.title, 'b'); assert.equal(r.branch, 'taste'); assert.equal(r.why, 'matches retro +2');
});
test('momentum with no shared tag falls back to taste', () => {
  const r = pickNext({ ...opts, candidates: [F('b', ['retro'])], current: F('cur', ['music']), taste: warm, rand: seq(0.1, 0.5) });
  assert.equal(r.branch, 'taste');
});
test('pickNext returns null when nothing is eligible', () => {
  assert.equal(pickNext({ ...opts, candidates: [F('a', [])], current: null, taste: warm, rand: seq(0.9), seenHas: () => true }), null);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/unit/pick.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement `pick.js`**

`pickNext` first filters with `eligible`. Then it calls `rand` once for the branch (not in cold start, `taste.reactions < 5`), then once per scored candidate (taste branch, and momentum among the tag-sharing set by highest score) or once for the wildcard index (`Math.floor(rand() * n)`). Momentum with no `current` or no tag-sharing candidate falls back to taste. A find without tags has no `matches` reason: its taste `why` is `'matches your taste'`.

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/unit/pick.test.js`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/pick.js tests/unit/pick.test.js
git commit -m "Add Tuned branch maths, scoring and filters"
```

### Task 5: Source registry, probe and the adapter test kit

**Files:**
- Create: `src/core/sources/index.js`, `src/core/sources/probe.js`, `tests/unit/helpers/fixture-http.js`, `tests/fixtures/http/probe/ok.json` (`{"ok":true}`), `tests/fixtures/http/probe/captcha.html` (`<html><body>Are you a robot?</body></html>`)
- Modify: `tests/fixtures/routes.js` (append the probe routes: `/probe-ok\.example\//` → `probe/ok.json`, `/probe-403\.example\//` → `probe/ok.json` with status 403, `/probe-html\.example\//` → `probe/captcha.html` with `content-type: text/html`)
- Test: `tests/unit/sources-index.test.js`, `tests/unit/probe.test.js`

**Interfaces:**
- Consumes: `APP_VERSION` (`src/core/version.js`, Plan 01), `createHttp({transport, clock})`, `createCache(store, clock)`, `openStore`, `memoryBackend`, `fakeClock(start)`, `mulberry32(seed)`, `DEFAULT_SETTINGS`, the `routes` array from `tests/fixtures/routes.js`.
- Produces:
  - ``IDENT = `Byways/${APP_VERSION} (+https://github.com/iteatsthesalt/Game-Dev-Resources)` ``, the value of `Api-User-Agent` and `AIC-User-Agent`. Adapters read it inside functions only (the index imports the adapters, so a top-level read would hit the import cycle).
  - `SOURCES` (id → adapter, in the order of an `ADAPTERS` array that each adapter task extends with one import), `getSource(id) → Adapter|undefined`.
  - `SELF_PACED = new Set(['ia', 'vault'])`: the source ids that never get an `http.register` call. Plan 04's Archive queue alone paces and backs off those sources, and a registered source would also get `Http`'s 60 s pause after a 429 (overview, "Archive pacing"). The engine (Task 20) and the test kit below skip them.
  - `enabledSources(settings, probe, platformName, all = Object.values(SOURCES)) → Adapter[]`. A source is in when `settings.sources[id]?.enabled` is `true`, or is absent and the adapter's `key` is not `'required'`. A `navigate` tier source is never in, on any platform (it makes no data calls). On `'pwa'` a `probe` tier source also needs `probe[id] === 'ok'`. A `privileged` source stays in everywhere, because in the web app it reads its daily snapshot instead (Plan 04's `itch`).
  - `probeSource(adapter, http) → Promise<'ok'|'fail'>`: no `probeUrl` gives `'ok'`. Otherwise it is `'ok'` when `http.getJson(probeUrl, {source: id, timeoutMs: 8000})` resolves, or when it rejects with a `NetError` of kind `http` and a status from 400 to 499 (the host answered with CORS, so a refused `DEMO_KEY` is not a reachability problem). Anything else is `'fail'`.
  - `runProbes(adapters, http, store, clock, platformName = 'pwa') → Promise<Object<string,'ok'|'fail'>>`: reuses `health['probe:<platformName>'] = {at, results}` while it is under 24 h old and covers every adapter id.
  - Test kit: `adapterCtx({settings?, secrets?, data?, seed = 42, now = Date.UTC(2026, 10, 11, 12), extraRoutes = []}) → Promise<{ctx, calls, store}>`. Its transport matches `[...extraRoutes, ...routes]` on every request (so a test may change `extraRoutes` later), reads `tests/fixtures/http/<file>`, records every request as `{url, method, headers, body}` in `calls` (headers as an object with lower-case names), and throws `TypeError('unmatched <url>')` for anything else. It takes the same route fields as `mockNet` (`file`, `body`, `json`, `status`, `headers`) plus `error: true` (throw `TypeError('Failed to fetch')`) and `hang: true` (never settle until `init.signal` aborts, then reject with an `AbortError`). It registers every `SOURCES` adapter's `rate` with `http.register`, except the `SELF_PACED` ids. `ctx` has every contract field: `{http, rand: mulberry32(seed), clock: fakeClock(now), cache, settings, secrets, data, platformName: 'pwa', caps, dataUrl: (f) => 'data/' + f}`, where `caps` is the PWA `caps` of Plan 01 (`privilegedFetch: false`), `secrets` is `memorySecrets(secrets)` and `data.tags` is read from `src/data/tags.json`.
  - `memorySecrets(seed = {}) → SecretStore` in the same kit file: an in-memory store, `get` giving `null` for a missing id.

**Adapter table.** Every adapter task builds its row exactly. Rate is `{perMinute, concurrent}`. Key ids are `SecretStore` ids.

| id | name | tier | key · keyName | safety | rate | fate | kinds | base tags |
|---|---|---|---|---|---|---|---|---|
| wikipedia | Wikipedia | open | none | mostly | 10·1 | yes | article | education |
| commons | Wikimedia Commons | open | none | mixed | 10·1 | no | image | photography |
| inat | iNaturalist | open | none | mostly | 60·1 | yes | image | nature |
| openlibrary | Open Library | open | none | mostly | 60·1 | no | book | books |
| apod | NASA APOD | open | demo · src:datagov | curated | 2·1 | yes | image, video | space, science |
| marginalia | Marginalia | open | optional · src:marginalia | mostly | 20·1 | no | site | web |
| github | GitHub | open | optional · src:github | mostly | 10·1 | no | project, game | indie, programming |
| hn | Show HN | probe | none | mostly | 60·2 | no | project, game | tech, indie |
| aic | Art Institute of Chicago | open | none | curated | 60·1 | yes | image | art |
| met | The Met | probe | none | curated | 60·2 | yes | image | art, history |
| cleveland | Cleveland Museum of Art | probe | none | curated | 60·1 | yes | image | art |
| nasaimages | NASA Images | probe | none | curated | 30·1 | no | image | space |
| loc | Library of Congress | probe | none | curated | 10·1 | no | image | history, photography |
| smithsonian | Smithsonian | probe | required · src:datagov | curated | 30·1 | yes | image | history |
| europeana | Europeana | open | required · src:europeana | mostly | 30·1 | no | image | culture, history |
| openverse | Openverse | open | required · src:openverse | mostly | 20·1 | no | image, audio | photography |
| kagi | Kagi Small Web | open | none | curated | 6·1 | yes | site, video | web, essays |
| kagirandom | Kagi Small Web random | probe | none | curated | 20·1 | yes | site | web, essays |
| wiby | Wiby | probe | none | curated | 10·1 | no | site | oldweb, web |
| library | Starter library | open | none | curated | 600·4 | yes | site, game, article | entry tags |

- [ ] **Step 1: Write the failing tests**

```js
// tests/unit/sources-index.test.js
const fake = (id, tier, key = 'none') => ({ id, tier, key, fate: true, rate: { perMinute: 60, concurrent: 1 }, random: async () => [], search: async () => [], more: async () => [] });
const all = [fake('a', 'open'), fake('k', 'open', 'required'), fake('p', 'probe'), fake('n', 'navigate'), fake('v', 'privileged')];
const ids = (xs) => xs.map(x => x.id);
test('enabledSources applies settings, keys and the probe', () => {
  assert.deepEqual(ids(enabledSources({ sources: {} }, {}, 'pwa', all)), ['a', 'v']);
  assert.deepEqual(ids(enabledSources({ sources: {} }, { p: 'ok' }, 'pwa', all)), ['a', 'p', 'v']);
  assert.deepEqual(ids(enabledSources({ sources: {} }, {}, 'android', all)), ['a', 'p', 'v']);
  assert.deepEqual(ids(enabledSources({ sources: { a: { enabled: false }, k: { enabled: true }, n: { enabled: true } } }, {}, 'pwa', all)), ['k', 'v']);
});
test('IDENT names the app version, and SELF_PACED the Archive ids', () => {
  assert.equal(IDENT, `Byways/${APP_VERSION} (+https://github.com/iteatsthesalt/Game-Dev-Resources)`);
  assert.deepEqual([...SELF_PACED].sort(), ['ia', 'vault']);
});
test('every registered adapter has the contract shape', () => {
  for (const [id, a] of Object.entries(SOURCES)) {
    assert.equal(a.id, id);
    assert.ok(['open','probe','privileged','snapshot','navigate'].includes(a.tier));
    assert.ok(['none','demo','optional','required'].includes(a.key));
    for (const m of ['random', 'search', 'more']) assert.equal(typeof a[m], 'function');
    assert.ok(a.rate.perMinute > 0 && a.rate.concurrent > 0);
  }
});
```

```js
// tests/unit/probe.test.js
const ad = (id, probeUrl) => ({ id, tier: 'probe', probeUrl, rate: { perMinute: 60, concurrent: 1 } });
test('probeSource needs a JSON reply or a 4xx answer', async () => {
  const { ctx } = await adapterCtx();
  assert.equal(await probeSource(ad('x', 'https://probe-ok.example/'), ctx.http), 'ok');
  assert.equal(await probeSource(ad('x', 'https://probe-403.example/'), ctx.http), 'ok');
  assert.equal(await probeSource(ad('x', 'https://probe-html.example/'), ctx.http), 'fail');
  assert.equal(await probeSource(ad('x', 'https://nowhere.invalid/'), ctx.http), 'fail');
  assert.equal(await probeSource({ id: 'x' }, ctx.http), 'ok');
});
test('runProbes stores results and re-runs after 24 h', async () => {
  const { ctx, calls, store } = await adapterCtx();
  const list = [ad('x', 'https://probe-ok.example/'), ad('y', 'https://nowhere.invalid/')];
  assert.deepEqual(await runProbes(list, ctx.http, store, ctx.clock), { x: 'ok', y: 'fail' });
  assert.deepEqual((await store.get('health', 'probe:pwa')).results, { x: 'ok', y: 'fail' });
  const n = calls.length; ctx.clock.advance(3600e3);
  await runProbes(list, ctx.http, store, ctx.clock); assert.equal(calls.length, n);
  ctx.clock.advance(24 * 3600e3); await runProbes(list, ctx.http, store, ctx.clock); assert.ok(calls.length > n);
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `node --test tests/unit/sources-index.test.js tests/unit/probe.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement `sources/index.js`, `sources/probe.js` and `tests/unit/helpers/fixture-http.js`**

`ADAPTERS` starts empty. Probes for a list run in parallel. The kit's responses use `content-type: application/json` for `.json` files and `json` entries, and `text/plain` for `.txt` files and `body` entries, unless the route sets `headers`.

- [ ] **Step 4: Run them and see them pass**

Run: `node --test tests/unit/sources-index.test.js tests/unit/probe.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/sources/index.js src/core/sources/probe.js tests/unit/helpers/fixture-http.js tests/fixtures/http/probe tests/fixtures/routes.js tests/unit/sources-index.test.js tests/unit/probe.test.js
git commit -m "Add the source registry, the runtime probe and the adapter test kit"
```

### Task 6: Fate

**Files:**
- Create: `src/core/fate.js`
- Test: `tests/unit/fate.test.js`

**Interfaces:**
- Consumes: the adapter shape (Task 5).
- Produces: `fatePull({sources, weights, ctx, rand, seenHas, retries = 3, accept = () => true}) → Promise<{find}|{miss: true, reason}>`. `seenHas` is async `(url) → Promise<boolean>`; `accept(find) → boolean` is the engine's always-on filter (blocked domains, hidden tags, the Family filter, the dead set). Only sources with `fate: true` and weight above 0 count; a missing weight is 1. One pull makes at most `retries + 1` `random()` calls. A call that throws, returns `[]` or returns only seen or unaccepted finds is a miss; otherwise the first unseen accepted find wins.
- Reasons (exact): `'Nothing new here. Try again, or turn on more Fate sources.'` and `'No Fate sources are on. Turn some on in Settings → Sources.'`

- [ ] **Step 1: Write the failing test**

```js
const find = (t) => makeFind({ source: 's', kind: 'site', title: t, url: `https://${t}.example.com/`, safety: 'curated' });
const src = (id, outs, extra = {}) => { const calls = []; return { id, fate: true, calls, ...extra,
  random: async () => { calls.push(1); const o = outs.shift(); if (o instanceof Error) throw o; return o ?? []; } }; };
const never = async () => false;
test('fatePull follows the weights', async () => {
  const a = src('a', [[find('a')]]); const b = src('b', [[find('b')]]);
  const r = await fatePull({ sources: [a, b], weights: { a: 0 }, ctx: {}, rand: () => 0.01, seenHas: never });
  assert.equal(r.find.title, 'b'); assert.equal(a.calls.length, 0);
});
test('fatePull skips seen and failed pulls', async () => {
  const a = src('a', [new Error('down'), [find('old')], [find('new')]]);
  const r = await fatePull({ sources: [a], weights: {}, ctx: {}, rand: () => 0.5, seenHas: async (u) => u.includes('old') });
  assert.equal(r.find.title, 'new');
});
test('fatePull gives up after 3 retries', async () => {
  const a = src('a', []);
  const r = await fatePull({ sources: [a], weights: {}, ctx: {}, rand: () => 0.5, seenHas: never });
  assert.deepEqual(r, { miss: true, reason: 'Nothing new here. Try again, or turn on more Fate sources.' });
  assert.equal(a.calls.length, 4);
});
test('fatePull says when no Fate source is on', async () => {
  const r = await fatePull({ sources: [src('a', [], { fate: false })], weights: {}, ctx: {}, rand: () => 0.5, seenHas: never });
  assert.deepEqual(r, { miss: true, reason: 'No Fate sources are on. Turn some on in Settings → Sources.' });
});
test('fatePull skips finds that accept rejects', async () => {
  const a = src('a', [[find('blocked'), find('fine')]]);
  const r = await fatePull({ sources: [a], weights: {}, ctx: {}, rand: () => 0.5, seenHas: never, accept: (f) => !f.url.includes('blocked.') });
  assert.equal(r.find.title, 'fine');
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/unit/fate.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement `fatePull`**

Each attempt draws `rand() * totalWeight` and walks the sources in order to pick one.

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/unit/fate.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/fate.js tests/unit/fate.test.js
git commit -m "Add the Fate pull with weights and retries"
```

### Task 7: Rabbit Hole

**Files:**
- Create: `src/core/rabbit.js`
- Test: `tests/unit/rabbit.test.js`

**Interfaces:**
- Consumes: `tokenize(text)`, `normalizeUrl`, `makeFind`, the adapter shape (Task 5).
- Produces:
  - `similarLocal(find, candidates, k) → Find[]`: score = Jaccard overlap of tags + cosine similarity of TF-IDF vectors over `tokenize(title + ' ' + description)`, with `idf = ln((1 + N) / (1 + df)) + 1` over the candidates plus `find`. It leaves out candidates with the same normalised URL and candidates scoring 0, sorts by score (stable), and returns the top `k`.
  - `createRabbitHole({sources, ctx, seenHas, pool, accept = () => true}) → {start(find), next({ai}?) → Promise<Find|null>, trail() → Find[], climbOut(), useAi(fn|null)}`. `sources` is `Adapter[]` or `() => Adapter[]`; `pool` is an optional `() => Find[]` of cached candidates; `seenHas` is async; `accept(find) → boolean` is the engine's always-on filter, as in Fate. `useAi(fn)` sets or clears the AI hook, `fn(find) → Promise<Find[]>` (overview: Plan 02 defines it, Plan 05 sets it).
  - `next({ai = true} = {})` tries, in order: the `more(last, ctx)` of the last trail find's own source, when that source is in `sources` (the pseudo-source `shared` never is); Marginalia `more(last, ctx)` when Marginalia is in `sources`, is not the last find's source, and `last.kind === 'site'` or `last.source === 'shared'` (overview: a link shared into Android goes to Marginalia whatever its kind); then `similarLocal(last, pool(), 10)`; then, only when a hook is set and `ai` is true, `fn(last)` (lean-back passes `ai: false` through the engine unless **Let AI refill lean-back** is on). The first candidate that is not in the trail (by normalised URL), not seen and accepted is pushed onto the trail and returned. A `more` or `fn` call that throws counts as `[]`. An empty trail gives `null`.

- [ ] **Step 1: Write the failing test**

```js
const F = (t, tags = [], d = '', source = 'library') => makeFind({ source, kind: 'site', title: t, description: d, tags, safety: 'curated', url: `https://${t.replace(/\W/g, '').toLowerCase()}.example.com/` });
const ad = (id, outs) => ({ id, more: async () => { const o = outs.shift() ?? []; if (o instanceof Error) throw o; return o; } });
const never = async () => false;
test('similarLocal ranks by shared tags and words', () => {
  const me = F('Pixel Puzzle', ['retro', 'puzzle'], 'A tiny pixel puzzle game.');
  const out = similarLocal(me, [F('Moth Atlas', ['nature'], 'Pictures of moths.'), F('Puzzle Box', ['puzzle'], 'Slide the pixel tiles.'), F('Pixel Puzzle', ['retro'])], 5);
  assert.deepEqual(out.map(x => x.title), ['Puzzle Box']);
  assert.equal(similarLocal(me, [F('A', ['puzzle']), F('B', ['puzzle']), F('C', ['retro'])], 2).length, 2);
});
test('next uses the source first, then Marginalia, then the local pool', async () => {
  const start = F('Start', ['retro']);
  const hole = createRabbitHole({ sources: [ad('library', [[F('A')], [], []]), ad('marginalia', [[F('M', ['retro'], '', 'marginalia')], []])], ctx: {}, seenHas: never, pool: () => [F('Local', ['retro'])] });
  hole.start(start);
  assert.equal((await hole.next()).title, 'A');
  assert.equal((await hole.next()).title, 'M');
  assert.equal((await hole.next()).title, 'Local');
  assert.deepEqual(hole.trail().map(x => x.title), ['Start', 'A', 'M', 'Local']);
});
test('next skips trail and seen finds and survives a failing source', async () => {
  const start = F('Start');
  const hole = createRabbitHole({ sources: [ad('library', [new Error('down')]), ad('marginalia', [[F('Start'), F('Old'), F('B')]])], ctx: {}, seenHas: async (u) => u.includes('old.') });
  hole.start(start); assert.equal((await hole.next()).title, 'B');
});
test('a shared link asks Marginalia whatever its kind, and an article from a source does not', async () => {
  const asked = []; const marginalia = { id: 'marginalia', more: async (f) => { asked.push(f.source); return [F('Neighbour', [], '', 'marginalia')]; } };
  const page = (source) => makeFind({ source, kind: 'article', title: 'Page', url: 'https://page.example.com/', safety: 'mostly' });
  const hole = (source) => { const h = createRabbitHole({ sources: [ad('library', []), marginalia], ctx: {}, seenHas: never, pool: () => [] }); h.start(page(source)); return h; };
  assert.equal((await hole('shared').next()).title, 'Neighbour');
  assert.equal(await hole('library').next(), null);
  assert.deepEqual(asked, ['shared']);
});
test('climbOut empties the trail', async () => {
  const hole = createRabbitHole({ sources: [], ctx: {}, seenHas: never });
  hole.start(F('Start')); hole.climbOut();
  assert.deepEqual(hole.trail(), []); assert.equal(await hole.next(), null);
});
test('next leaves out candidates that accept rejects', async () => {
  const hole = createRabbitHole({ sources: [ad('library', [[F('Blocked'), F('Hidden', ['secret']), F('Fine')]])], ctx: {}, seenHas: never,
    accept: (f) => !f.url.includes('blocked.') && !f.tags.includes('secret') });
  hole.start(F('Start')); assert.equal((await hole.next()).title, 'Fine');
});
test('the AI hook comes after the sources and the pool, and only while it is set', async () => {
  const hole = createRabbitHole({ sources: [ad('library', [])], ctx: {}, seenHas: never, pool: () => [] });
  hole.start(F('Start')); assert.equal(await hole.next(), null);
  const asked = []; hole.useAi(async (f) => { asked.push(f.title); return [F('Start'), F('AI pick')]; });
  assert.equal(await hole.next({ ai: false }), null); assert.deepEqual(asked, []);
  assert.equal((await hole.next()).title, 'AI pick'); assert.deepEqual(asked, ['Start']);
  hole.useAi(async () => { throw new Error('down'); }); assert.equal(await hole.next(), null);
  hole.useAi(null); assert.equal(await hole.next(), null); assert.equal(asked.length, 1);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/unit/rabbit.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement `rabbit.js`**

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/unit/rabbit.test.js`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/rabbit.js tests/unit/rabbit.test.js
git commit -m "Add Rabbit Hole with source, Marginalia, local and AI steps"
```

### Task 8: Collections

**Files:**
- Create: `src/core/collections.js`
- Test: `tests/unit/collections.test.js`

**Interfaces:**
- Consumes: `openStore`, `memoryBackend`, `fakeClock`, `makeFind`.
- Produces: `createCollections(store, clock) → {list(), get(id), create(name), rename(id, name), remove(id), add(id, find) → Promise<boolean>, removeItem(id, findId), has(findId) → Promise<string[]>, getCurrent() → Promise<string>, setCurrent(id)}`. A record is `{id, name, created, items: [{find, added}]}` in the `collections` store. `list()` always includes `{id: 'saved', name: 'Saved'}` first, then the rest by `created`; keys starting with `@` are not collections. The current collection id lives under key `'@current'` and falls back to `'saved'` when unset or deleted.
- Errors (exact): `create('  ')` throws `'Give the collection a name.'`; `remove('saved')` throws `'Saved cannot be deleted.'`

- [ ] **Step 1: Write the failing test**

```js
const find = makeFind({ source: 'library', kind: 'site', title: 'Tiny Synth', url: 'https://example.com/', safety: 'curated' });
const make = async () => createCollections(await openStore(memoryBackend()), fakeClock(Date.UTC(2026, 10, 11)));
test('Saved exists from the start', async () => {
  const c = await make(); const list = await c.list();
  assert.deepEqual(list.map(x => [x.id, x.name]), [['saved', 'Saved']]);
  assert.equal(await c.getCurrent(), 'saved'); assert.equal(await c.get('nope'), null);
});
test('create, rename, add, has and removeItem', async () => {
  const c = await make(); const id = (await c.create('Games')).id;
  await c.rename(id, 'Old games');
  assert.equal(await c.add(id, find), true); assert.equal(await c.add(id, find), false);
  await c.add('saved', find);
  assert.deepEqual((await c.has(find.id)).sort(), [id, 'saved'].sort());
  await c.removeItem(id, find.id); assert.deepEqual(await c.has(find.id), ['saved']);
  assert.equal((await c.get(id)).name, 'Old games');
});
test('Saved cannot be deleted and the current collection falls back', async () => {
  const c = await make(); const id = (await c.create('Games')).id;
  await assert.rejects(c.remove('saved'), { message: 'Saved cannot be deleted.' });
  await assert.rejects(c.create('  '), { message: 'Give the collection a name.' });
  await c.setCurrent(id); assert.equal(await c.getCurrent(), id);
  await c.remove(id); assert.equal(await c.getCurrent(), 'saved');
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/unit/collections.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement `createCollections`**

New ids are `'c-' + clock.now().toString(36) + '-' + <number of existing collections>`. `added` is `clock.now()`.

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/unit/collections.test.js`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/collections.js tests/unit/collections.test.js
git commit -m "Add collections with Saved as the default"
```

### Task 9: Share links

**Files:**
- Create: `src/core/share.js`
- Test: `tests/unit/share.test.js`

**Interfaces:**
- Consumes: `makeFind`, `truncate`, `hash64` (test only).
- Produces: `MAX_LINK_CHARS = 2000`; `SHARE_BASE = 'https://iteatsthesalt.github.io/Game-Dev-Resources/byways/'`; `encodeShare(payload) → Promise<string>` (`base64url(deflate-raw(JSON))`, no `=` padding, no validation); `decodeShare(str) → Promise<payload>`, which throws `'This link is broken or not from Byways.'` unless the payload is `{v: 1, t: 'c'|'f'|'d', n: string, i: Array<[string, string, string]>}` with at most 500 items; `buildShareUrl(base, payload) → Promise<{url, tooLong}>` with `url = base + '#s=' + encoded` and `tooLong = url.length > MAX_LINK_CHARS`; `shareItem(find) → [find.source, find.url, truncate(find.title, 80)]`; `itemToFind([source, url, title]) → Find|null` (kind `'site'`, safety `'mostly'`, why `['Shared with you']`); `payloadFromLink(text) → string|null` for **Import from link** (§14.3: the extension and Android paste links): it trims `text`, parses it with `new URL` and returns what follows `#s=` when the origin and path equal `SHARE_BASE` (or `SHARE_BASE + 'index.html'`) and that rest is not empty; anything else gives `null`.

- [ ] **Step 1: Write the failing test**

```js
const payload = { v: 1, t: 'c', n: 'Weird toys', i: [['library', 'https://example.com/', 'Tiny Synth'], ['wikipedia', 'https://en.wikipedia.org/wiki/Ada_Lovelace', 'Ada Lovelace'], ['kagi', 'https://example.org/', 'example.org']] };
test('share payloads round-trip', async () => {
  const s = await encodeShare(payload);
  assert.match(s, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(await decodeShare(s), payload);
});
test('buildShareUrl uses the Pages base and flags long links', async () => {
  const short = await buildShareUrl(SHARE_BASE, payload);
  assert.ok(short.url.startsWith(SHARE_BASE + '#s=')); assert.equal(short.tooLong, false);
  const i = Array.from({ length: 150 }, (_, n) => ['library', `https://s${n}.example.org/${hash64(String(n))}`, `Find ${hash64('t' + n)}`]);
  assert.equal((await buildShareUrl(SHARE_BASE, { ...payload, i })).tooLong, true);
});
test('decodeShare rejects v2 and garbage', async () => {
  const msg = { message: 'This link is broken or not from Byways.' };
  await assert.rejects(decodeShare(await encodeShare({ ...payload, v: 2 })), msg);
  await assert.rejects(decodeShare((await encodeShare(payload)).slice(0, -6)), msg);
  await assert.rejects(decodeShare('%%%'), msg);
  await assert.rejects(decodeShare(await encodeShare({ ...payload, i: [['library', 3, 'x']] })), msg);
});
test('itemToFind rebuilds a find and drops bad urls', () => {
  assert.equal(itemToFind(['library', 'https://example.com/', 'Tiny Synth']).title, 'Tiny Synth');
  assert.equal(itemToFind(['library', 'javascript:alert(1)', 'x']), null);
});
test('payloadFromLink reads only Byways share links', async () => {
  const { url } = await buildShareUrl(SHARE_BASE, payload);
  assert.equal(payloadFromLink('  ' + url + '\n'), url.split('#s=')[1]);
  assert.equal(payloadFromLink(SHARE_BASE + 'index.html#s=abc'), 'abc');
  for (const bad of ['https://example.com/#s=abc', SHARE_BASE + '#/stumble', SHARE_BASE + '#s=', 'not a link']) assert.equal(payloadFromLink(bad), null);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/unit/share.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement `share.js`**

Use `new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'))` and the matching `DecompressionStream`; base64url maps `+/` to `-_` and strips `=`.

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/unit/share.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/share.js tests/unit/share.test.js
git commit -m "Add the share-link codec with the 2,000 character limit"
```

### Task 10: Backup and bookmarks

**Files:**
- Create: `src/core/backup.js`
- Test: `tests/unit/backup.test.js`

**Interfaces:**
- Consumes: `loadSettings(store)`, `DEFAULT_TASTE`, `createSeen` (Task 2), `createCollections` (Task 8), `makeFind`, `utcDate`, `toPlainText`.
- Produces:
  - `exportBackup(store, {includeKeys = false, app, clock, secrets}) → Promise<object>`: `{format: 'byways-backup', v: 1, exportedAt: ISO, app, settings, taste, collections, history, seen}`, plus `keys: {id: value}` only when `includeKeys`. `taste` is the `taste` store key `'taste'` (or `DEFAULT_TASTE`), `history` is the `'trail'` items (`{find, t}`), and `seen` is `[[hash, t], …]`.
  - `backupFileName(clock, includeKeys) → 'byways-backup-YYYY-MM-DD.json'` or `'byways-backup-YYYY-MM-DD-with-keys.json'`.
  - `importBackup(store, data, {secrets}) → Promise<{collections, seen, history, keys}>` (counts written). It throws `'This is not a Byways backup file.'` before writing anything unless `format === 'byways-backup'`, `v === 1` and `collections`, `history` and `seen` are arrays. Merge rules: seen hashes are unioned; a collection with a new id is added; one with the same id, name and item ids is skipped; any other clash is added as `<id>-copy` (then `-copy-2`, …) named `<name> (imported)`. Every imported item goes through `makeFind` and is dropped if it returns `null`. History is written only when the local trail is empty (last 50). Taste is written only when there is no local taste or it has `reactions === 0`. Settings in the file are never applied, because they belong to the version that wrote them. Keys are written only when `data.keys` exists. The caller re-reads history and taste afterwards (Task 29).
  - `toBookmarksHtml(collection) → string` (Netscape format: `<!DOCTYPE NETSCAPE-Bookmark-file-1>`, a `<DL><p>` with one `<DT><H3>` for the collection name and one `<DT><A HREF="…">` per item, with `& < > "` escaped), `fromBookmarksHtml(html) → Array<{url, title}>` (every `<A … HREF="…">…</A>`, http(s) only, titles through `toPlainText`).

- [ ] **Step 1: Write the failing test**

```js
const clock = fakeClock(Date.UTC(2026, 10, 11, 12));
const A = makeFind({ source: 'library', kind: 'site', title: 'Tiny Synth', url: 'https://a.example.com/', safety: 'curated' });
const B = makeFind({ source: 'library', kind: 'site', title: 'Pixel Garden', url: 'https://b.example.com/', safety: 'curated' });
const mem = (o = {}) => ({ get: async (k) => o[k] ?? null, set: async (k, v) => { o[k] = v; }, delete: async (k) => { delete o[k]; }, list: async () => Object.keys(o) });
test('exportBackup writes the spec shape and leaves keys out', async () => {
  const store = await openStore(memoryBackend());
  await createSeen(store).add('https://a.example.com/');
  await createCollections(store, clock).add('saved', A);
  const out = await exportBackup(store, { app: 'pwa', clock, secrets: mem({ 'src:europeana': 'k' }) });
  assert.equal(out.format, 'byways-backup'); assert.equal(out.v, 1); assert.equal(out.app, 'pwa');
  assert.equal(out.exportedAt, '2026-11-11T12:00:00.000Z'); assert.equal(out.seen.length, 1);
  assert.equal(out.collections[0].items[0].find.title, 'Tiny Synth'); assert.equal('keys' in out, false);
  const withKeys = await exportBackup(store, { includeKeys: true, app: 'pwa', clock, secrets: mem({ 'src:europeana': 'k' }) });
  assert.deepEqual(withKeys.keys, { 'src:europeana': 'k' });
  assert.equal(backupFileName(clock, true), 'byways-backup-2026-11-11-with-keys.json');
});
test('importBackup merges seen and keeps a copy on a clash', async () => {
  const from = await openStore(memoryBackend());
  await createSeen(from).add('https://a.example.com/'); await createSeen(from).add('https://b.example.com/');
  await createCollections(from, clock).add('saved', B);
  const data = await exportBackup(from, { app: 'android', clock });
  const to = await openStore(memoryBackend());
  await createSeen(to).add('https://a.example.com/'); const cols = createCollections(to, clock); await cols.add('saved', A);
  const counts = await importBackup(to, data, {});
  assert.equal(counts.seen, 1); assert.equal(await createSeen(to).count(), 2);
  assert.equal((await cols.get('saved')).items.length, 1);
  assert.equal((await cols.get('saved-copy')).name, 'Saved (imported)');
});
test('importBackup rejects a foreign file and writes nothing', async () => {
  const to = await openStore(memoryBackend());
  for (const bad of [{ format: 'other' }, { format: 'byways-backup', v: 2, collections: [], history: [], seen: [['x', 1]] }, null])
    await assert.rejects(importBackup(to, bad, {}), { message: 'This is not a Byways backup file.' });
  assert.equal(await createSeen(to).count(), 0);
});
test('bookmarks HTML round-trips and drops bad links', () => {
  const html = toBookmarksHtml({ name: 'Weird & wonderful', items: [{ find: A }] });
  assert.ok(html.startsWith('<!DOCTYPE NETSCAPE-Bookmark-file-1>')); assert.ok(html.includes('Weird &amp; wonderful'));
  assert.deepEqual(fromBookmarksHtml(html), [{ url: 'https://a.example.com/', title: 'Tiny Synth' }]);
  assert.deepEqual(fromBookmarksHtml('<DT><A HREF="javascript:x">x</A><DT><A HREF="https://c.example/">&lt;b&gt;C</A>'), [{ url: 'https://c.example/', title: '<b>C' }]);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/unit/backup.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement `backup.js`**

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/unit/backup.test.js`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/backup.js tests/unit/backup.test.js
git commit -m "Add backup export and merge import, and bookmarks HTML"
```

### Task 11: Link check

**Files:**
- Create: `src/core/liveness.js`
- Test: `tests/unit/liveness.test.js`

**Interfaces:**
- Consumes: `siteOrigin(u)`.
- Produces: `checkLive(url, {transport, privileged = false, timeoutMs = 8000}) → Promise<boolean>`. Privileged: `HEAD url` with `privileged: true`; live when the status is below 400 or is 405. Not privileged: `HEAD siteOrigin(url) + '/'` with `mode: 'no-cors'` and `credentials: 'omit'`; live when the fetch resolves (opaque). An `http:` URL is not fetched in the web check, because the CSP and mixed-content blocking would stop it; it counts as live. A throw or the timeout means not live.

- [ ] **Step 1: Write the failing test**

```js
const tr = (fn) => { const calls = []; return { calls, fetch: (u, init) => { calls.push({ u, init }); return fn(u, init); } }; };
test('the web check only asks whether the site answers', async () => {
  const t = tr(async () => ({ status: 0, type: 'opaque' }));
  assert.equal(await checkLive('https://example.com/a/b?x=1', { transport: t }), true);
  assert.equal(t.calls[0].u, 'https://example.com/'); assert.equal(t.calls[0].init.mode, 'no-cors');
  assert.equal(await checkLive('https://gone.example/', { transport: tr(async () => { throw new TypeError('Failed to fetch'); }) }), false);
});
test('the privileged check reads the status', async () => {
  for (const [status, live] of [[200, true], [405, true], [404, false], [500, false]]) {
    const t = tr(async () => ({ status }));
    assert.equal(await checkLive('https://example.com/a', { transport: t, privileged: true }), live);
    assert.equal(t.calls[0].init.privileged, true);
  }
});
test('a hung site counts as not live', async () => {
  const hang = tr((u, init) => new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(new Error('aborted')))));
  assert.equal(await checkLive('https://slow.example/', { transport: hang, timeoutMs: 20 }), false);
});
test('the web check never fetches an http: site', async () => {
  const t = tr(async () => ({ status: 0, type: 'opaque' }));
  assert.equal(await checkLive('http://0x80.example/feed', { transport: t }), true); assert.equal(t.calls.length, 0);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/unit/liveness.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement `checkLive`** with an `AbortController` and `setTimeout(timeoutMs)`.

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/unit/liveness.test.js`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/liveness.js tests/unit/liveness.test.js
git commit -m "Add the link check for web and privileged fetch"
```

### Task 12: Wikipedia and Wikimedia Commons

**Files:**
- Create: `src/core/sources/wikipedia.js`, `src/core/sources/commons.js`, fixtures under `tests/fixtures/http/wikipedia/` and `tests/fixtures/http/commons/`
- Modify: `src/core/sources/index.js` (add both to `ADAPTERS`), `tests/fixtures/routes.js`
- Test: `tests/unit/src-wikimedia.test.js`

**Interfaces:**
- Consumes: `adapterCtx` and the adapter table (Task 5), `IDENT`, `makeFind`, `toPlainText`, `utcDate`.
- Produces: the `wikipedia` and `commons` adapters. Every request from both sends `Api-User-Agent: IDENT` (§7.3).
  - Wikipedia `random`: `GET https://en.wikipedia.org/api/rest_v1/page/random/summary`; `[]` when `type === 'disambiguation'`. Find: id `wiki:en:<titles.canonical>`, `description = extract`, `url = content_urls.desktop.page`, `imageUrl = thumbnail.source`, `licence 'CC BY-SA 4.0'`, `attribution 'Wikipedia'`, why `['Wikipedia: random article']`.
  - Wikipedia `search(q)` and `more(find)`: `GET https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=<q>&gsrlimit=10&prop=pageimages|extracts|info&inprop=url&piprop=thumbnail&pithumbsize=640&exintro=1&explaintext=1&exlimit=10&format=json&origin=*`; `more` sends `gsrsearch=morelike:<find.title>`. Pages are sorted by `index`; `url = fullurl`. Why `['Wikipedia search']` or `['Wikipedia: more like <title>']`.
  - Commons `random`: today's picture of the day from `GET https://en.wikipedia.org/api/rest_v1/feed/featured/YYYY/MM/DD` (UTC date of `ctx.clock.now()`), field `image`: title from `image.title` without `File:` and the extension, `imageUrl = image.thumbnail.source`, `url = image.file_page`, `author = image.artist.text`, `licence = image.license.type`, `description = image.description.text`, safety `curated` (the adapter itself is `mixed`, so the Family filter drops search images but not the curated picture of the day), why `['Wikimedia Commons: picture of the day']`.
  - Commons `search(q)`: `GET https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=<q>&gsrlimit=10&prop=imageinfo&iiprop=url|mime|size|extmetadata&iiurlwidth=1024&format=json&origin=*`. Keep only `image/jpeg|png|gif|webp` with `width ≥ 400` and a `LicenseShortName`. `title = ObjectName` (else the file name), `description = toPlainText(ImageDescription)`, `author = toPlainText(Artist)`, `attribution = '<author> · <licence> · Wikimedia Commons'`, `imageUrl = thumburl`, `url = descriptionurl`, safety `mixed`, why `['Wikimedia Commons search']`. `more` returns `[]`.

Fixtures, beyond the values the tests assert: `wikipedia/random-disambiguation.json` (`type 'disambiguation'`); `wikipedia/search.json` with its two pages keyed out of `index` order (`"2"` Moth trap, `"1"` Moth); `commons/search.json` with two pages to drop (`File:Clip.webm` as `video/webm`, `File:Tiny.jpg` 100 wide) and the kept `File:Old map.png`, whose `ImageDescription` is `'<p>An <b>old</b> map.</p>'` and `Artist` is `'<a href="javascript:alert(1)">Ann</a>'`. Routes, in this order: `morelike` search → `wikipedia/morelike.json`; other `en.wikipedia.org/w/api.php` → `wikipedia/search.json`; `page/random/summary` → `wikipedia/random-summary.json`; `feed/featured/` → `wikipedia/featured.json`; `commons.wikimedia.org/w/api.php` → `commons/search.json`.

- [ ] **Step 1: Write the failing test**

```js
const disamb = [{ match: /page\/random\/summary/, file: 'wikipedia/random-disambiguation.json' }];
test('wikipedia random reads a summary and sends Api-User-Agent', async () => {
  const { ctx, calls } = await adapterCtx(); const [f] = await wikipedia.random(ctx);
  assert.equal(f.id, 'wiki:en:Ada_Lovelace'); assert.equal(f.kind, 'article');
  assert.equal(f.url, 'https://en.wikipedia.org/wiki/Ada_Lovelace'); assert.equal(f.imageUrl, 'https://upload.wikimedia.org/ada.jpg');
  assert.equal(f.licence, 'CC BY-SA 4.0'); assert.deepEqual(f.why, ['Wikipedia: random article']); assert.deepEqual(f.tags, ['education']);
  assert.equal(calls[0].headers['api-user-agent'], IDENT);
});
test('wikipedia random skips disambiguation pages', async () => {
  const { ctx } = await adapterCtx({ extraRoutes: disamb }); assert.deepEqual(await wikipedia.random(ctx), []);
});
test('wikipedia search uses origin=* and keeps result order', async () => {
  const { ctx, calls } = await adapterCtx(); const out = await wikipedia.search('moth', ctx);
  assert.deepEqual(out.map(f => f.title), ['Moth', 'Moth trap']);
  const u = new URL(calls[0].url); assert.equal(u.searchParams.get('origin'), '*'); assert.equal(u.searchParams.get('gsrsearch'), 'moth');
  assert.equal(calls[0].headers['api-user-agent'], IDENT);
});
test('wikipedia more uses morelike', async () => {
  const { ctx, calls } = await adapterCtx(); const [ada] = await wikipedia.random(ctx);
  const out = await wikipedia.more(ada, ctx);
  assert.equal(new URL(calls[1].url).searchParams.get('gsrsearch'), 'morelike:Ada Lovelace');
  assert.deepEqual(out.map(f => f.title), ['Charles Babbage']);
});
test('commons random is the picture of the day', async () => {
  const { ctx, calls } = await adapterCtx(); const [f] = await commons.random(ctx);
  assert.ok(calls[0].url.endsWith('/api/rest_v1/feed/featured/2026/11/11')); assert.equal(calls[0].headers['api-user-agent'], IDENT);
  assert.equal(f.title, 'Aurora'); assert.equal(f.safety, 'curated'); assert.equal(f.author, 'Jane Doe');
  assert.equal(f.url, 'https://commons.wikimedia.org/wiki/File:Aurora.jpg'); assert.deepEqual(f.why, ['Wikimedia Commons: picture of the day']);
});
test('commons turns extmetadata HTML into plain text', async () => {
  const { ctx, calls } = await adapterCtx(); const out = await commons.search('map', ctx);
  assert.equal(out.length, 1);
  assert.equal(out[0].description, 'An old map.'); assert.equal(out[0].author, 'Ann');
  assert.equal(out[0].attribution, 'Ann · CC BY 4.0 · Wikimedia Commons'); assert.equal(out[0].safety, 'mixed');
  assert.equal(new URL(calls[0].url).searchParams.get('gsrnamespace'), '6'); assert.equal(calls[0].headers['api-user-agent'], IDENT);
  assert.equal(commons.fate, false); assert.equal(commons.safety, 'mixed');
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/unit/src-wikimedia.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Write the fixtures and routes, then implement both adapters**

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/unit/src-wikimedia.test.js tests/unit/sources-index.test.js`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/sources/wikipedia.js src/core/sources/commons.js src/core/sources/index.js tests/fixtures/http/wikipedia tests/fixtures/http/commons tests/fixtures/routes.js tests/unit/src-wikimedia.test.js
git commit -m "Add the Wikipedia and Commons adapters"
```

### Task 13: iNaturalist, Open Library and APOD

**Files:**
- Create: `src/core/sources/inat.js`, `src/core/sources/openlibrary.js`, `src/core/sources/apod.js`, fixtures under `tests/fixtures/http/{inat,openlibrary,apod}/`
- Modify: `src/core/sources/index.js`, `tests/fixtures/routes.js`
- Test: `tests/unit/src-nature-books-space.test.js`

**Interfaces:**
- Consumes: `adapterCtx`, the adapter table, `makeFind`, `utcDate`.
- Produces: the `inat`, `openlibrary` and `apod` adapters.
  - iNat `random`: `GET https://api.inaturalist.org/v1/observations?photos=true&quality_grade=research&photo_license=cc0,cc-by,cc-by-sa&per_page=30&page=<1–100>`; `search(q)` adds `q=<q>` with `page=1`; `more(find)` uses `taxon_id=<find.meta.taxonId>`. Each result needs a photo whose `license_code` is `cc0`, `cc-by` or `cc-by-sa`. Find: id `inat:<id>`, `title = taxon.preferred_common_name || taxon.name`, `imageUrl` = that photo's `url` with `square` replaced by `large`, `url = uri`, `author = user.login`, `attribution = photo.attribution`, `licence` = the code upper-cased with spaces (`'CC BY'`, `'CC0'`), `description = '<taxon.name>, seen in <place_guess> on <observed_on>.'` (each clause left out when missing), `meta: {taxonId, published: observed_on}`, why `['iNaturalist']`.
  - Open Library `search(q)`: `GET https://openlibrary.org/search.json?q=<q>&fields=key,title,author_name,cover_i,first_publish_year&limit=10`. `random`: `GET https://openlibrary.org/subjects/<subject>.json?limit=12&offset=<0–199>` with `subject` from `['science_fiction','poetry','cooking','history','art','travel','puzzles','games','folklore','nature']`; `more(find)` uses `find.meta.subject` (or `[]`). Find: id `ol:<key>`, `url = 'https://openlibrary.org' + key`, `imageUrl = 'https://covers.openlibrary.org/b/id/<cover>-M.jpg'` only when there is a cover, `author` = first author, `description = '<author>, <year>'`, `meta.subject` = the subject for `random` finds, why `['Open Library']`.
  - APOD `random`: `GET https://api.nasa.gov/planetary/apod?api_key=<key>&count=10&thumbs=true` with `key` = secret `src:datagov` or `DEMO_KEY`. With `DEMO_KEY` it keeps a counter in `ctx.cache` under `apod:count:<YYYY-MM-DD>` (24 h): at 45 or more it returns `[]` without a request, and an HTTP 429 sets it to 50 before rethrowing. Find: id `apod:<date>`, `url = 'https://apod.nasa.gov/apod/ap<YYMMDD>.html'`, `kind 'image'|'video'`, `description = explanation`, `author` = trimmed `copyright`, `licence` = `'© <copyright>'` or `'Public domain (NASA)'`, `meta.published = date`, why `['NASA APOD']`. Only a public-domain item (no `copyright`) gets an image (§7.4): `imageUrl = url` for an image and `thumbnail_url` for a video. A copyrighted item keeps its credit and gets the generated image; a video with no `thumbnail_url` is dropped. `search` and `more` return `[]`.

Fixtures, beyond the values the tests assert: iNat result 101 has photo `https://static.inaturalist.org/photos/1/square.jpg` with `license_code 'cc-by'`, and result 102 has `license_code null`; `openlibrary/search.json` holds a second work `/works/OL1W` with no cover, and `openlibrary/subject.json` one work with `cover_id 777` (subject pages name the field `cover_id`); `apod/count.json` holds the image `2025-03-14` with `copyright ' Jane Sky '`, a public-domain video `2024-01-02` with `thumbnail_url 'https://apod.nasa.gov/apod/image/2401/thumb.jpg'`, and a video `2024-01-03` without one.

- [ ] **Step 1: Write the failing test**

```js
test('inat keeps CC photos and credits the observer', async () => {
  const { ctx, calls } = await adapterCtx(); const out = await inat.random(ctx);
  const u = new URL(calls[0].url);
  assert.equal(u.searchParams.get('photo_license'), 'cc0,cc-by,cc-by-sa'); assert.equal(u.searchParams.get('per_page'), '30');
  assert.ok(+u.searchParams.get('page') >= 1 && +u.searchParams.get('page') <= 100);
  assert.equal(out.length, 1); const f = out[0];
  assert.equal(f.title, 'Western Honey Bee'); assert.equal(f.imageUrl, 'https://static.inaturalist.org/photos/1/large.jpg');
  assert.equal(f.author, 'beefan'); assert.equal(f.licence, 'CC BY');
  assert.equal(f.description, 'Apis mellifera, seen in Oslo, Norway on 2026-06-01.');
  await inat.more(f, ctx); assert.equal(new URL(calls[1].url).searchParams.get('taxon_id'), '47219');
});
test('openlibrary search builds book cards', async () => {
  const { ctx, calls } = await adapterCtx(); const [a, b] = await openlibrary.search('le guin', ctx);
  assert.equal(new URL(calls[0].url).searchParams.get('fields'), 'key,title,author_name,cover_i,first_publish_year');
  assert.equal(a.url, 'https://openlibrary.org/works/OL27448W'); assert.equal(a.imageUrl, 'https://covers.openlibrary.org/b/id/12345-M.jpg');
  assert.equal(a.description, 'Ursula K. Le Guin, 1969'); assert.equal(b.imageUrl, undefined);
});
test('openlibrary random reads a subject page', async () => {
  const { ctx, calls } = await adapterCtx(); const [f] = await openlibrary.random(ctx);
  assert.match(calls[0].url, /\/subjects\/[a-z_]+\.json\?limit=12&offset=\d+$/); assert.ok(f.meta.subject);
});
test('apod uses DEMO_KEY and maps images and videos', async () => {
  const { ctx, calls } = await adapterCtx(); const out = await apod.random(ctx);
  const u = new URL(calls[0].url);
  assert.equal(u.searchParams.get('api_key'), 'DEMO_KEY'); assert.equal(u.searchParams.get('count'), '10'); assert.equal(u.searchParams.get('thumbs'), 'true');
  assert.equal(out.length, 2);
  assert.equal(out[0].url, 'https://apod.nasa.gov/apod/ap250314.html'); assert.equal(out[0].licence, '© Jane Sky');
  assert.equal(out[0].author, 'Jane Sky'); assert.equal(out[0].imageUrl, undefined);
  assert.equal(out[1].kind, 'video'); assert.equal(out[1].licence, 'Public domain (NASA)');
  assert.equal(out[1].imageUrl, 'https://apod.nasa.gov/apod/image/2401/thumb.jpg');
});
test('apod uses your api.data.gov key and stops near the DEMO_KEY limit', async () => {
  const keyed = await adapterCtx({ secrets: { 'src:datagov': 'MYKEY' } }); await apod.random(keyed.ctx);
  assert.equal(new URL(keyed.calls[0].url).searchParams.get('api_key'), 'MYKEY');
  const demo = await adapterCtx(); await demo.ctx.cache.set('apod:count:2026-11-11', 45, 864e5);
  assert.deepEqual(await apod.random(demo.ctx), []); assert.equal(demo.calls.length, 0);
});
test('apod stops for the day after a 429', async () => {
  const { ctx } = await adapterCtx({ extraRoutes: [{ match: /api\.nasa\.gov/, file: 'apod/count.json', status: 429 }] });
  await assert.rejects(apod.random(ctx)); assert.equal(await ctx.cache.get('apod:count:2026-11-11'), 50);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/unit/src-nature-books-space.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Write the fixtures and routes, then implement the three adapters**

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/unit/src-nature-books-space.test.js tests/unit/sources-index.test.js`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/sources/inat.js src/core/sources/openlibrary.js src/core/sources/apod.js src/core/sources/index.js tests/fixtures/http/inat tests/fixtures/http/openlibrary tests/fixtures/http/apod tests/fixtures/routes.js tests/unit/src-nature-books-space.test.js
git commit -m "Add the iNaturalist, Open Library and APOD adapters"
```

### Task 14: Marginalia, GitHub and Show HN

**Files:**
- Create: `src/core/sources/marginalia.js`, `src/core/sources/github.js`, `src/core/sources/hn.js`, fixtures under `tests/fixtures/http/{marginalia,github,hn}/`
- Modify: `src/core/sources/index.js`, `tests/fixtures/routes.js`
- Test: `tests/unit/src-indie.test.js`

**Interfaces:**
- Consumes: `adapterCtx`, the adapter table, `makeFind`, `domainOf`, `toPlainText`.
- Produces: the `marginalia`, `github` and `hn` adapters.
  - Marginalia: header `API-Key: <secret src:marginalia or 'public'>`. `search(q)`: `GET https://api2.marginalia-search.com/api/v2/search?query=<q>&count=20`, items from `results` (`url`, `title`, `description`), why `['Marginalia search']`. `more(find)`: `GET https://api2.marginalia-search.com/api/v2/site/<domainOf(find.url)>/similar`; the reply shape is unverified, so items come from `results ?? similar ?? []`, with `url = item.url ?? 'https://' + item.domain + '/'` and `title = item.title ?? item.domain`; why `['Marginalia: similar to <domain>']`. `random` returns `[]`. A 503 propagates as `NetError` with `status 503` (the engine treats it as busy).
  - GitHub: headers `Accept: application/vnd.github+json` and, with secret `src:github`, `Authorization: Bearer <token>`. `random`: `GET https://api.github.com/search/repositories?q=topic:<topic> stars:>20&sort=updated&per_page=100&page=<1–10>` with `topic` from `['game-jam','js13k','pico-8','html5-game','ludum-dare','godot-game']`. `search(q)`: `q=<q> in:name,description,topics stars:>5&per_page=30`. `more(find)`: `q=topic:<find.meta.topics[0]> stars:>5`. Results are cached for 1 hour by URL. Find: `url = homepage` when it is http(s), else `html_url`; `kind 'game'` when the homepage is used, else `'project'`; `title = name`; `author = owner.login`; tags add `jam` when a topic is `game-jam`, `ludum-dare` or `js13k`; why `['GitHub: topic <topic>', '★ <stars>']` (search uses `'GitHub search'`); `meta: {topics, published: updated_at}`. No avatar image.
  - HN: `search(q)`: `GET https://hn.algolia.com/api/v1/search?tags=show_hn&query=<q>&hitsPerPage=20`. `random`: `GET https://hn.algolia.com/api/v1/search_by_date?tags=show_hn&numericFilters=points>20,created_at_i>A,created_at_i<B&hitsPerPage=20`, a 30-day window whose end `B` is a random time in the last 3 years before `ctx.clock.now()`. `probeUrl 'https://hn.algolia.com/api/v1/search?tags=show_hn&hitsPerPage=1'`. Find: `title` without a leading `Show HN:`, `url = hit.url || 'https://news.ycombinator.com/item?id=<objectID>'`, `description = toPlainText(story_text)` or `'<points> points · <num_comments> comments on Hacker News'`, `kind 'game'` when the title matches `/\bgame\b/i`, else `'project'`, why `['Show HN', '<points> points']`, `meta.published` from `created_at_i`. `more` returns `[]`.

Fixtures, beyond the values the tests assert: `marginalia/similar.json` is `{domain 'example.com', similar: [{domain 'neighbour.example.org'}]}` (items with no `url` or `title`); `github/search.json` gives `bob/engine` an empty `homepage`; HN hit `222` ('Show HN: Notes app') has `url ''` and `story_text '<p>Hi <script>alert(1)</script>HN</p>'`. Routes: Marginalia `/similar` before `/search`; GitHub search; HN `search_by_date` and `search` both → `hn/search.json`.

- [ ] **Step 1: Write the failing test**

```js
test('marginalia sends the public key, or yours', async () => {
  const a = await adapterCtx(); const [f] = await marginalia.search('synth', a.ctx);
  assert.equal(a.calls[0].headers['api-key'], 'public'); assert.equal(new URL(a.calls[0].url).searchParams.get('query'), 'synth');
  assert.equal(f.title, 'A synth page'); assert.deepEqual(f.why, ['Marginalia search']); assert.deepEqual(f.tags, ['web']);
  const b = await adapterCtx({ secrets: { 'src:marginalia': 'MYKEY' } }); await marginalia.search('synth', b.ctx);
  assert.equal(b.calls[0].headers['api-key'], 'MYKEY');
});
test('marginalia more finds similar sites by domain', async () => {
  const { ctx, calls } = await adapterCtx();
  const [f] = await marginalia.more({ url: 'https://www.example.com/x', kind: 'site' }, ctx);
  assert.equal(new URL(calls[0].url).pathname, '/api/v2/site/example.com/similar');
  assert.equal(f.url, 'https://neighbour.example.org/'); assert.deepEqual(f.why, ['Marginalia: similar to example.com']);
});
test('marginalia busy is a 503 NetError', async () => {
  const { ctx } = await adapterCtx({ extraRoutes: [{ match: /marginalia/, file: 'marginalia/search.json', status: 503 }] });
  await assert.rejects(marginalia.search('x', ctx), { status: 503 });
});
test('github random searches a jam topic and prefers the homepage', async () => {
  const { ctx, calls } = await adapterCtx(); const [a, b] = await github.random(ctx);
  const u = new URL(calls[0].url);
  assert.match(u.searchParams.get('q'), /^topic:(game-jam|js13k|pico-8|html5-game|ludum-dare|godot-game) stars:>20$/);
  assert.equal(u.searchParams.get('per_page'), '100'); assert.ok(+u.searchParams.get('page') <= 10);
  assert.equal(calls[0].headers.accept, 'application/vnd.github+json'); assert.equal(calls[0].headers.authorization, undefined);
  assert.equal(a.url, 'https://ann.github.io/tiny-jam/'); assert.equal(a.kind, 'game'); assert.ok(a.tags.includes('jam'));
  assert.ok(a.why.includes('★ 42')); assert.equal(b.url, 'https://github.com/bob/engine'); assert.equal(b.kind, 'project');
});
test('github sends your token and caches for an hour', async () => {
  const { ctx, calls } = await adapterCtx({ secrets: { 'src:github': 'TOKEN' } });
  await github.search('synth', ctx); await github.search('synth', ctx);
  assert.equal(calls.length, 1); assert.equal(calls[0].headers.authorization, 'Bearer TOKEN');
});
test('hn reads Show HN and keeps text plain', async () => {
  const { ctx, calls } = await adapterCtx(); const [a, b] = await hn.search('game', ctx);
  assert.equal(new URL(calls[0].url).searchParams.get('tags'), 'show_hn');
  assert.equal(a.title, 'I made a tiny game'); assert.equal(a.kind, 'game');
  assert.equal(a.description, '120 points · 30 comments on Hacker News'); assert.deepEqual(a.why, ['Show HN', '120 points']);
  assert.equal(b.url, 'https://news.ycombinator.com/item?id=222'); assert.equal(b.description.includes('<'), false);
});
test('hn random asks for a 30-day window', async () => {
  const { ctx, calls } = await adapterCtx(); await hn.random(ctx);
  const m = new URL(calls[0].url).searchParams.get('numericFilters').match(/^points>20,created_at_i>(\d+),created_at_i<(\d+)$/);
  assert.equal(+m[2] - +m[1], 30 * 86400); assert.ok(+m[2] <= ctx.clock.now() / 1000);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/unit/src-indie.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Write the fixtures and routes, then implement the three adapters**

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/unit/src-indie.test.js tests/unit/sources-index.test.js`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/sources/marginalia.js src/core/sources/github.js src/core/sources/hn.js src/core/sources/index.js tests/fixtures/http/marginalia tests/fixtures/http/github tests/fixtures/http/hn tests/fixtures/routes.js tests/unit/src-indie.test.js
git commit -m "Add the Marginalia, GitHub and Show HN adapters"
```

### Task 15: Art Institute, the Met and Cleveland

**Files:**
- Create: `src/core/sources/aic.js`, `src/core/sources/met.js`, `src/core/sources/cleveland.js`, fixtures under `tests/fixtures/http/{aic,met,cleveland}/`
- Modify: `src/core/sources/index.js`, `tests/fixtures/routes.js`
- Test: `tests/unit/src-museums.test.js`

**Interfaces:**
- Consumes: `adapterCtx`, the adapter table, `IDENT`, `makeFind`.
- Produces: the `aic`, `met` and `cleveland` adapters. Every find has `licence` set (`'Public domain'` or `'CC0'`).
  - AIC: header `AIC-User-Agent: IDENT`. `random`: `GET https://api.artic.edu/api/v1/artworks/search?query[term][is_public_domain]=true&fields=id,title,image_id,artist_display,date_display,thumbnail&limit=20&page=<1–500>`; `search(q)` adds `q=<q>` with `page=1`. Items without `image_id` are dropped. Find: id `aic:<id>`, `imageUrl = config.iiif_url + '/<image_id>/full/843,/0/default.jpg'`, `url = 'https://www.artic.edu/artworks/<id>'`, `author = artist_display`, `description = thumbnail.alt_text || '<artist_display>, <date_display>'`, why `['Art Institute of Chicago']`. The `thumbnail.lqip` placeholder is a `data:` URL, so it is not used: when an AIC image fails, the card shows the generated image (§7.2 "or skip"). `more` returns `[]`.
  - Met (v1.1 search only; v1 search was retired on 2026-10-01): `random` reads the total once (`GET https://collectionapi.metmuseum.org/public/collection/v1.1/search?hasImages=true&isPublicDomain=true&limit=1&offset=0`, cached 24 h as `met:total`), then the same URL with `offset=<floor(rand × min(total, 10000))>`, then `GET https://collectionapi.metmuseum.org/public/collection/v1/objects/<id>`. `search(q)`: `v1.1/search?q=<q>&hasImages=true&isPublicDomain=true&limit=5`, then each object. Objects with `isPublicDomain !== true` or no `primaryImageSmall` are dropped. Find: id `met:<objectID>`, `url = objectURL`, `imageUrl = primaryImageSmall`, `author = artistDisplayName`, `description = '<artistDisplayName>, <objectDate>'`, why `['The Met']`. `probeUrl 'https://collectionapi.metmuseum.org/public/collection/v1/objects/436535'`.
  - Cleveland: `random` reads `info.total` once (`GET https://openaccess-api.clevelandart.org/api/artworks/?cc=1&has_image=1&limit=1`, cached 7 days as `cleveland:total`), then `?cc=1&has_image=1&limit=10&skip=<floor(rand × total)>`; `search(q)`: `?q=<q>&cc=1&has_image=1&limit=20`. Only `share_license_status === 'CC0'` is kept (trust the returned value). Find: id `cma:<id>`, `url`, `imageUrl = images.web.url`, `author = creators[0].description`, `description = '<creator>, <creation_date>'`, why `['Cleveland Museum of Art']`. `probeUrl 'https://openaccess-api.clevelandart.org/api/artworks/?limit=1'`.

Fixtures, beyond the values the tests assert: `aic/search.json` has `config.iiif_url 'https://www.artic.edu/iiif/2'`, `artist_display 'Georges Seurat\nFrench, 1859–1891'` and a second artwork with `image_id null`; `met/search.json` is `{total: 5000, objectIDs: [436535]}`; `met/object-not-pd.json` is `met/object.json` with `isPublicDomain false`; `cleveland/artworks.json` has `info.total 30000` and a second artwork with `share_license_status 'Copyrighted'`.

- [ ] **Step 1: Write the failing test**

```js
test('aic builds IIIF images and sends AIC-User-Agent', async () => {
  const { ctx, calls } = await adapterCtx(); const out = await aic.random(ctx);
  assert.equal(calls[0].headers['aic-user-agent'], IDENT);
  const u = new URL(calls[0].url); assert.equal(u.searchParams.get('query[term][is_public_domain]'), 'true'); assert.ok(+u.searchParams.get('page') <= 500);
  assert.equal(out.length, 1);
  assert.equal(out[0].imageUrl, 'https://www.artic.edu/iiif/2/2d484387/full/843,/0/default.jpg');
  assert.equal(out[0].url, 'https://www.artic.edu/artworks/27992'); assert.equal(out[0].author, 'Georges Seurat French, 1859–1891');
  assert.equal(out[0].licence, 'Public domain'); assert.equal(out[0].meta?.lqip, undefined);
});
test('met uses v1.1 search and keeps public-domain objects', async () => {
  const { ctx, calls } = await adapterCtx(); const [f] = await met.random(ctx);
  assert.equal(calls.some(c => c.url.includes('/v1/search')), false);
  assert.ok(+new URL(calls[1].url).searchParams.get('offset') < 5000);
  assert.equal(f.title, 'Wheat Field with Cypresses'); assert.equal(f.author, 'Vincent van Gogh');
  const pd = await adapterCtx({ extraRoutes: [{ match: /\/v1\/objects\//, file: 'met/object-not-pd.json' }] });
  assert.deepEqual(await met.random(pd.ctx), []);
});
test('cleveland keeps CC0 only and pages by skip', async () => {
  const { ctx, calls } = await adapterCtx(); const out = await cleveland.random(ctx);
  assert.ok(+new URL(calls[1].url).searchParams.get('skip') < 30000);
  assert.deepEqual(out.map(f => f.title), ['Twilight in the Wilderness']); assert.equal(out[0].licence, 'CC0');
  await cleveland.random(ctx); assert.equal(calls.filter(c => c.url.endsWith('limit=1')).length, 1);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/unit/src-museums.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Write the fixtures and routes, then implement the three adapters**

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/unit/src-museums.test.js tests/unit/sources-index.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/sources/aic.js src/core/sources/met.js src/core/sources/cleveland.js src/core/sources/index.js tests/fixtures/http/aic tests/fixtures/http/met tests/fixtures/http/cleveland tests/fixtures/routes.js tests/unit/src-museums.test.js
git commit -m "Add the Art Institute, Met and Cleveland adapters"
```

### Task 16: NASA Images, Library of Congress and Smithsonian

**Files:**
- Create: `src/core/sources/nasaimages.js`, `src/core/sources/loc.js`, `src/core/sources/smithsonian.js`, fixtures under `tests/fixtures/http/{nasaimages,loc,smithsonian}/`
- Modify: `src/core/sources/index.js`, `tests/fixtures/routes.js`
- Test: `tests/unit/src-archives.test.js`

**Interfaces:**
- Consumes: `adapterCtx`, the adapter table, `makeFind`.
- Produces: the `nasaimages`, `loc` and `smithsonian` adapters. Each `random` searches one seed word picked with `ctx.rand` from its list. `more` returns `[]`.
  - NASA Images: `search(q)`: `GET https://images-api.nasa.gov/search?q=<q>&media_type=image&page_size=20` (`random` adds `page=<1–5>`; words `['nebula','aurora','rover','launch','galaxy','eclipse','saturn','apollo','comet','earth']`). Items from `collection.items[]`: `data[0].{title, description, nasa_id, center, date_created}`, `links[0].href`. Find: id `nasa:<nasa_id>`, `url = 'https://images.nasa.gov/details/<nasa_id>'`, `imageUrl = links[0].href`, `attribution = 'NASA <center>'`, `licence 'Public domain (NASA)'`, why `['NASA Images']`. `probeUrl 'https://images-api.nasa.gov/search?q=moon&media_type=image&page_size=1'`.
  - Library of Congress: `search(q)`: `GET https://www.loc.gov/photos/?q=<q>&fo=json&c=25&sp=1` (`random` uses `sp=<1–5>`; words `['map','poster','bicycle','lighthouse','circus','garden','bridge','train','kite','harbor']`). An HTML reply (the CAPTCHA page) rejects, because `getJson` fails to parse it. Find: `url`, `title`, `description = description[0]`, **no `imageUrl`** (results carry no open-rights flag), why `['Library of Congress']`. `probeUrl 'https://www.loc.gov/photos/?q=map&fo=json&c=1'`.
  - Smithsonian: needs secret `src:datagov`; without it every method returns `[]` with no request. `search(q)`: `GET https://api.si.edu/openaccess/api/v1.0/search?q=<q>&rows=20&api_key=<key>` (`random` adds `start=<0–199>`; words `['quilt','fossil','meteorite','toy','clock','mask','telescope','shell','banjo','kite']`). Rows from `response.rows[]`; `content.descriptiveNonRepeating` gives `record_link` (the url), `data_source` (the attribution) and `metadata_usage.access`; `imageUrl = online_media.media[0].thumbnail` only when access is `'CC0'`, and then `licence 'CC0'`. Why `['Smithsonian Open Access']`. `probeUrl 'https://api.si.edu/openaccess/api/v1.0/search?q=quilt&rows=1&api_key=DEMO_KEY'` (the notes do not confirm that `DEMO_KEY` works there, so a refused key still passes the probe through the 4xx rule of Task 5; it is one request a day).

Fixtures, beyond the values the tests assert: `loc/photos.json` gives its result two `image_url` entries (which stay unused), and `loc/captcha.html` is an HTML page; `smithsonian/search.json` has a second row 'Not open' with `access 'usage conditions apply'` and a thumbnail.

- [ ] **Step 1: Write the failing test**

```js
test('nasaimages builds detail links', async () => {
  const { ctx, calls } = await adapterCtx(); const [f] = await nasaimages.search('nebula', ctx);
  const u = new URL(calls[0].url); assert.equal(u.searchParams.get('media_type'), 'image'); assert.equal(u.searchParams.get('page_size'), '20');
  assert.equal(f.url, 'https://images.nasa.gov/details/PIA123'); assert.equal(f.attribution, 'NASA GSFC');
  assert.equal(f.licence, 'Public domain (NASA)');
});
test('loc reads JSON, shows no image and treats HTML as a failure', async () => {
  const { ctx, calls } = await adapterCtx(); const [f] = await loc.search('map', ctx);
  const u = new URL(calls[0].url); assert.equal(u.pathname, '/photos/'); assert.equal(u.searchParams.get('fo'), 'json'); assert.equal(u.searchParams.get('c'), '25');
  assert.equal(f.title, 'Map of Boston'); assert.equal(f.description, 'An old map.'); assert.equal(f.imageUrl, undefined);
  const html = await adapterCtx({ extraRoutes: [{ match: /loc\.gov/, file: 'loc/captcha.html', headers: { 'content-type': 'text/html' } }] });
  await assert.rejects(loc.search('map', html.ctx));
});
test('smithsonian needs the api.data.gov key, shows CC0 images only and keeps the key out of the cache', async () => {
  const none = await adapterCtx(); assert.deepEqual(await smithsonian.search('quilt', none.ctx), []); assert.equal(none.calls.length, 0);
  const { ctx, calls, store } = await adapterCtx({ secrets: { 'src:datagov': 'MYKEY' } });
  const [a, b] = await smithsonian.search('quilt', ctx);
  assert.equal(new URL(calls[0].url).searchParams.get('api_key'), 'MYKEY');
  assert.equal(a.licence, 'CC0'); assert.ok(a.imageUrl); assert.equal(a.attribution, 'National Museum of American History');
  assert.equal(b.imageUrl, undefined);
  const keys = await store.keys('cache'); assert.ok(keys.length >= 1); assert.equal(keys.some((k) => k.includes('MYKEY')), false);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/unit/src-archives.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Write the fixtures and routes, then implement the three adapters**

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/unit/src-archives.test.js tests/unit/sources-index.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/sources/nasaimages.js src/core/sources/loc.js src/core/sources/smithsonian.js src/core/sources/index.js tests/fixtures/http/nasaimages tests/fixtures/http/loc tests/fixtures/http/smithsonian tests/fixtures/routes.js tests/unit/src-archives.test.js
git commit -m "Add the NASA Images, Library of Congress and Smithsonian adapters"
```

### Task 17: Europeana and Openverse

**Files:**
- Create: `src/core/sources/europeana.js`, `src/core/sources/openverse.js`, fixtures under `tests/fixtures/http/{europeana,openverse}/`
- Modify: `src/core/sources/index.js`, `tests/fixtures/routes.js`
- Test: `tests/unit/src-keyed.test.js`

**Interfaces:**
- Consumes: `adapterCtx`, the adapter table, `makeFind`.
- Produces: the `europeana` and `openverse` adapters. With no credentials, every method returns `[]` and makes no request.
  - Europeana: header `X-Api-Key: <secret src:europeana>` (never the `wskey` parameter). `search(q)`: `GET https://api.europeana.eu/record/v2/search.json?query=<q>&reusability=open&media=true&rows=20`; `random` searches a word from `['map','clock','poster','bird','ship','mask','garden','tile','toy','letter']` with `start=<1–100>`. Find: id `eu:<id>`, `title = title[0]`, `url = edmIsShownAt[0] || guid`, `imageUrl = edmPreview[0]`, `description = dcDescription[0]`, `licence = rights[0]`, `attribution = '<dataProvider[0]> via Europeana'`, why `['Europeana']`. `more` returns `[]`.
  - Openverse: secret `src:openverse` holds the JSON `{clientId, clientSecret}` (overview SecretStore ids). A token comes from `POST https://api.openverse.org/v1/auth_tokens/token/` with `Content-Type: application/x-www-form-urlencoded` and body `grant_type=client_credentials&client_id=<clientId>&client_secret=<clientSecret>`. The token lives in memory only, per `ctx.secrets` object and client id (a `WeakMap`), for `expires_in − 60` seconds; it never goes into `ctx.cache` or any store. Requests send `Authorization: Bearer <token>`. `search(q)`: `GET https://api.openverse.org/v1/images/?q=<q>&mature=false&page_size=20`; `random` searches a word from `['moss','lighthouse','fox','mushroom','tram','kite','owl','fern','lantern','harbour']` with `page=<1–5>`; `more(find)`: `GET https://api.openverse.org/v1/images/<find.meta.ovId>/related/`. Results with `mature === true` are dropped. Find: id `ov:<id>`, `meta.ovId = id`, `url = foreign_landing_url`, `imageUrl = thumbnail || url`, `author = creator`, `attribution` as given, `licence`: `cc0` → `'CC0 1.0'`, `pdm` → `'Public Domain Mark 1.0'`, otherwise `'CC <LICENSE> <license_version>'`; why `['Openverse']`.

Fixtures, beyond the values the tests assert: `openverse/token.json` is `{access_token 'TOK', token_type 'Bearer', expires_in 43200}`; `openverse/images.json` gives `ov1` `license 'by'` and `license_version '2.0'`, and has a second result `ov2` with `mature true`; `openverse/related.json` holds one result `ov3`. Routes: token; `/related/` before `/v1/images/?`.

- [ ] **Step 1: Write the failing test**

```js
const ov = { 'src:openverse': JSON.stringify({ clientId: 'ID', clientSecret: 'SECRET' }) };
test('europeana needs a key and sends it as a header', async () => {
  const none = await adapterCtx(); assert.deepEqual(await europeana.search('vase', none.ctx), []); assert.equal(none.calls.length, 0);
  const { ctx, calls } = await adapterCtx({ secrets: { 'src:europeana': 'EUKEY' } }); const [f] = await europeana.search('vase', ctx);
  const u = new URL(calls[0].url);
  assert.equal(calls[0].headers['x-api-key'], 'EUKEY'); assert.equal(u.searchParams.get('wskey'), null);
  assert.equal(u.searchParams.get('reusability'), 'open'); assert.equal(u.searchParams.get('media'), 'true');
  assert.equal(f.url, 'https://museum.example/vase'); assert.equal(f.attribution, 'Example Museum via Europeana');
});
test('openverse gets a token once and filters mature results', async () => {
  const none = await adapterCtx(); assert.deepEqual(await openverse.search('fox', none.ctx), []);
  const { ctx, calls, store } = await adapterCtx({ secrets: ov });
  const out = await openverse.search('fox', ctx); await openverse.search('fox', ctx);
  assert.equal(calls[0].method, 'POST'); assert.equal(calls[0].headers['content-type'], 'application/x-www-form-urlencoded');
  assert.equal(calls[0].body, 'grant_type=client_credentials&client_id=ID&client_secret=SECRET');
  assert.equal(calls.filter(c => c.url.includes('auth_tokens')).length, 1);
  assert.equal(calls[1].headers.authorization, 'Bearer TOK'); assert.equal(new URL(calls[1].url).searchParams.get('mature'), 'false');
  assert.deepEqual(out.map(f => f.id), ['ov:ov1']); assert.equal(out[0].licence, 'CC BY 2.0'); assert.equal(out[0].url, 'https://www.flickr.com/photos/x/1');
  assert.equal(JSON.stringify(await store.getAll('cache')).includes('TOK'), false);
});
test('openverse more asks for related images', async () => {
  const { ctx, calls } = await adapterCtx({ secrets: ov }); const [f] = await openverse.search('fox', ctx);
  await openverse.more(f, ctx); assert.equal(new URL(calls.at(-1).url).pathname, '/v1/images/ov1/related/');
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/unit/src-keyed.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Write the fixtures and routes, then implement both adapters**

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/unit/src-keyed.test.js tests/unit/sources-index.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/sources/europeana.js src/core/sources/openverse.js src/core/sources/index.js tests/fixtures/http/europeana tests/fixtures/http/openverse tests/fixtures/routes.js tests/unit/src-keyed.test.js
git commit -m "Add the Europeana and Openverse adapters"
```

### Task 18: Kagi Small Web, Kagi random and Wiby

**Files:**
- Create: `src/core/sources/kagi.js`, `src/core/sources/kagirandom.js`, `src/core/sources/wiby.js`, fixtures under `tests/fixtures/http/{kagi,kagirandom,wiby}/`
- Modify: `src/core/sources/index.js`, `tests/fixtures/routes.js`
- Test: `tests/unit/src-smallweb.test.js`

**Interfaces:**
- Consumes: `adapterCtx`, the adapter table, `makeFind`, `isHttpUrl`, `siteOrigin`, `domainOf`.
- Produces: the `kagi`, `kagirandom` and `wiby` adapters, and these `kagi.js` named exports:
  - `KAGI_LISTS = {smallweb: 'https://raw.githubusercontent.com/kagisearch/smallweb/main/smallweb.txt', smallyt: '…/smallyt.txt', smallcomic: '…/smallcomic.txt'}` (same folder).
  - `parseKagiList(text, name) → Array<{url, title}>`: trims each line, drops empty lines and lines starting with `[` or `#`, and takes the first whitespace-separated token, which must pass `isHttpUrl`. For `smallyt` the notes give no line format, so two forms are read: a line with a comment (`<feed url> # <name> <channel url>`) gives the trailing channel URL with the name as title; a bare feed URL gives `https://www.youtube.com/channel/<channel_id>` from its `channel_id` parameter, with the channel id as title. For the other lists the find is `siteOrigin(token) + '/'` with `domainOf(token)` as title. Results are unique by URL.
  - `loadKagiList(ctx, name) → Promise<Array<{url, title}>>`: kept in `ctx.cache` as `kagi:list:<name>` = `{list, fetchedAt}` with a 30-day lifetime. With no list cached it downloads now with `getText(url, {source: 'kagi', timeoutMs: 60000})` (`smallweb.txt` is 1.53 MB). A list older than 7 days is still returned at once while one background refresh runs (60 s timeout, at most one try per list per hour, tracked in memory); only a successful refresh replaces it.
- Kagi `random`: picks a list with `ctx.rand` (`smallweb` below 0.8, `smallyt` below 0.9, else `smallcomic`). When that list is not cached yet, it starts `loadKagiList` without waiting and returns `[]`, so the 8 s source rule never waits on the download. Otherwise it returns up to 5 random entries. Domain-only card: no `imageUrl`; `title` from the parser; `kind 'video'` for `smallyt`, else `'site'`; tags `['web','essays']`, `['film']` for `smallyt` and `['comics']` for `smallcomic`; `description` = `'A small personal site from the Kagi Small Web list.'`, `'A small YouTube channel from the Kagi Small Web list.'` or `'An independent web comic from the Kagi Small Web list.'`; `attribution 'Kagi Small Web list (MIT)'`; why `['Kagi Small Web']`. `search` and `more` return `[]`.
- Kagi random: `GET https://kagi.com/smallweb/api/random` (also its `probeUrl`) → `{url, title, author, domain, categories}`. Tags are the categories that are tag ids in `ctx.data.tags`, else `['web','essays']`; why `['Kagi Small Web: random']`.
- Wiby: `search(q)`: `GET https://wiby.me/json/?q=<q>` → `[{URL, Title, Snippet}]`, why `['Wiby search']`; `random` returns `[]`; `probeUrl 'https://wiby.me/json/?q=games'`. Named export `WIBY_LEAP_URL = 'https://wiby.me/surprise/'` for the navigate-only **Wiby leap** button (Task 24).

Fixtures: `kagi/smallweb.txt`:

```
[DEBUG] Cross-domain redirect: https://apply.example.com -> https://www.example.com/careers, following
http://0x80.example/feed.xml
https://blog.example.net/index.xml

not a url
https://www.blog.example.org/atom.xml
```

`kagi/smallyt.txt` has two lines: `https://www.youtube.com/feeds/videos.xml?channel_id=UCabc # Tom S https://www.youtube.com/channel/UCabc` and `https://www.youtube.com/feeds/videos.xml?channel_id=UCxyz`. `kagi/smallcomic.txt`: `http://comic.example.com/feeds/atom`. `kagirandom/random.json` has `categories ['programming','retro','unknowncat']`. `wiby/search.json` is an array of `{URL, Title, Snippet}`.

- [ ] **Step 1: Write the failing test**

```js
test('parseKagiList drops junk lines and opens the site origin', () => {
  assert.deepEqual(parseKagiList(read('kagi/smallweb.txt'), 'smallweb'), [
    { url: 'http://0x80.example/', title: '0x80.example' },
    { url: 'https://blog.example.net/', title: 'blog.example.net' },
    { url: 'https://www.blog.example.org/', title: 'blog.example.org' }]);
  assert.deepEqual(parseKagiList(read('kagi/smallyt.txt'), 'smallyt'), [
    { url: 'https://www.youtube.com/channel/UCabc', title: 'Tom S' }, { url: 'https://www.youtube.com/channel/UCxyz', title: 'UCxyz' }]);
});
test('the Kagi lists refresh weekly and survive a failed refresh', async () => {
  const extra = []; const { ctx, calls } = await adapterCtx({ extraRoutes: extra });
  await loadKagiList(ctx, 'smallweb'); await loadKagiList(ctx, 'smallweb'); assert.equal(calls.length, 1);
  assert.equal(calls[0].url, KAGI_LISTS.smallweb);
  extra.push({ match: /smallweb\.txt/, error: true }); ctx.clock.advance(7 * 864e5 + 1);
  assert.equal((await loadKagiList(ctx, 'smallweb')).length, 3); await tick(); assert.equal(calls.length, 2);
  assert.equal((await loadKagiList(ctx, 'smallweb')).length, 3);
});
test('kagi random gives domain-only cards, and none before a list is loaded', async () => {
  const { ctx } = await adapterCtx(); assert.deepEqual(await kagi.random(ctx), []);
  for (const name of Object.keys(KAGI_LISTS)) await loadKagiList(ctx, name);
  const out = await kagi.random(ctx);
  assert.ok(out.length >= 1 && out.length <= 5);
  for (const f of out) { assert.equal(f.imageUrl, undefined); assert.equal(f.attribution, 'Kagi Small Web list (MIT)'); assert.deepEqual(f.why, ['Kagi Small Web']); }
});
test('kagirandom keeps known categories as tags', async () => {
  const { ctx, calls } = await adapterCtx(); const [f] = await kagirandom.random(ctx);
  assert.equal(calls[0].url, 'https://kagi.com/smallweb/api/random');
  assert.equal(f.title, 'A small post'); assert.equal(f.author, 'Sam'); assert.deepEqual(f.tags, ['programming', 'retro']);
});
test('wiby searches JSON and leaps by navigation only', async () => {
  const { ctx, calls } = await adapterCtx(); const [f] = await wiby.search('games', ctx);
  assert.equal(calls[0].url, 'https://wiby.me/json/?q=games');
  assert.equal(f.title, 'My old site'); assert.equal(f.description, 'Hand coded since 1999.'); assert.deepEqual(f.tags, ['oldweb', 'web']);
  assert.deepEqual(await wiby.random(ctx), []); assert.equal(WIBY_LEAP_URL, 'https://wiby.me/surprise/');
});
```

(`read(name)` reads `tests/fixtures/http/<name>` with `fs.readFileSync(…, 'utf8')`; `tick = () => new Promise((r) => setTimeout(r, 0))`.)

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/unit/src-smallweb.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Write the fixtures and routes, then implement the three adapters**

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/unit/src-smallweb.test.js tests/unit/sources-index.test.js`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/sources/kagi.js src/core/sources/kagirandom.js src/core/sources/wiby.js src/core/sources/index.js tests/fixtures/http/kagi tests/fixtures/http/kagirandom tests/fixtures/http/wiby tests/fixtures/routes.js tests/unit/src-smallweb.test.js
git commit -m "Add the Kagi Small Web, Kagi random and Wiby adapters"
```

### Task 19: Starter library adapter and the registry check

**Files:**
- Create: `src/core/sources/library.js`
- Modify: `src/core/sources/index.js`, `tests/unit/sources-index.test.js`
- Test: `tests/unit/src-library.test.js`

**Interfaces:**
- Consumes: `adapterCtx`, `similarLocal` (Task 7), `makeFind`, `tokenize`, `utcDate`.
- Produces: the `library` adapter, which makes no network requests and reads `ctx.data.library.entries`. Only entries with `added ≤ utcDate(ctx.clock.now())` count. Entry to find: id `lib:<entry.id>`, `url`, `title`, `description = blurb`, `tags = entry.tags`, `kind`: `game` → `'game'`, `article` → `'article'`, otherwise `'site'`; `meta: {libraryKind: entry.kind, published: entry.added}`; why `['Starter library']`. `random` returns every counted entry in a `ctx.rand` Fisher–Yates shuffle: it is local and costs no quota, and a sample would let a refill miss unseen entries (the engine keeps at most 50). `search(q)` returns up to 20 entries whose title, blurb and tags contain every `tokenize(q)` word. `more(find)` is `similarLocal(find, <all entries as finds>, 10)`.

- [ ] **Step 1: Write the failing tests**

```js
// tests/unit/src-library.test.js
const entries = [
  { id: 'lib-0001', url: 'https://synth.example.com/', title: 'Tiny Synth', blurb: 'Make sounds with a tiny synth.', tags: ['music', 'toy'], kind: 'toy', added: '2026-11-01' },
  { id: 'lib-0002', url: 'https://garden.example.com/', title: 'Pixel Garden', blurb: 'Grow a pixel garden.', tags: ['art', 'toy'], kind: 'game', added: '2026-11-01' },
  { id: 'lib-0003', url: 'https://moth.example.com/', title: 'Moth Atlas', blurb: 'Pictures of moths.', tags: ['nature'], kind: 'site', added: '2026-11-01' },
  { id: 'lib-0004', url: 'https://future.example.com/', title: 'Not Yet', blurb: 'Added later.', tags: ['toy'], kind: 'site', added: '2027-01-01' }];
const data = { library: { v: 1, entries } };
test('library random leaves out future entries and makes no requests', async () => {
  const { ctx, calls } = await adapterCtx({ data }); const out = await library.random(ctx);
  assert.deepEqual(out.map(f => f.id).sort(), ['lib:lib-0001', 'lib:lib-0002', 'lib:lib-0003']);
  assert.equal(calls.length, 0);
  const synth = out.find(f => f.id === 'lib:lib-0001');
  assert.equal(synth.kind, 'site'); assert.equal(synth.meta.libraryKind, 'toy'); assert.deepEqual(synth.why, ['Starter library']);
});
test('library search and more', async () => {
  const { ctx } = await adapterCtx({ data });
  assert.deepEqual((await library.search('tiny synth', ctx)).map(f => f.title), ['Tiny Synth']);
  const [synth] = await library.search('synth', ctx);
  assert.deepEqual((await library.more(synth, ctx)).map(f => f.title), ['Pixel Garden']);
});
```

```js
// add to tests/unit/sources-index.test.js
const TABLE = { wikipedia: ['open','none','mostly',10,true], commons: ['open','none','mixed',10,false], inat: ['open','none','mostly',60,true],
  openlibrary: ['open','none','mostly',60,false], apod: ['open','demo','curated',2,true], marginalia: ['open','optional','mostly',20,false],
  github: ['open','optional','mostly',10,false], hn: ['probe','none','mostly',60,false], aic: ['open','none','curated',60,true],
  met: ['probe','none','curated',60,true], cleveland: ['probe','none','curated',60,true], nasaimages: ['probe','none','curated',30,false],
  loc: ['probe','none','curated',10,false], smithsonian: ['probe','required','curated',30,true], europeana: ['open','required','mostly',30,false],
  openverse: ['open','required','mostly',20,false], kagi: ['open','none','curated',6,true], kagirandom: ['probe','none','curated',20,true],
  wiby: ['probe','none','curated',10,false], library: ['open','none','curated',600,true] };
test('the registry matches the adapter table', () => {
  for (const [id, [tier, key, safety, perMinute, fate]] of Object.entries(TABLE)) {
    const a = getSource(id);
    assert.deepEqual([a.tier, a.key, a.safety, a.rate.perMinute, a.fate], [tier, key, safety, perMinute, fate], id);
    if (tier === 'probe') assert.match(a.probeUrl, /^https:\/\//, id);
  }
  assert.deepEqual(['apod', 'smithsonian', 'europeana', 'openverse', 'marginalia', 'github'].map((id) => getSource(id).keyName),
    ['src:datagov', 'src:datagov', 'src:europeana', 'src:openverse', 'src:marginalia', 'src:github']);
  for (const id of ['ia', 'vault', 'oldweb', 'itch']) assert.equal(getSource(id), undefined);
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `node --test tests/unit/src-library.test.js tests/unit/sources-index.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `library.js`, and the registry test failing on `library`.

- [ ] **Step 3: Implement the `library` adapter and add it to `ADAPTERS`**

- [ ] **Step 4: Run them and see them pass**

Run: `node --test tests/unit/src-library.test.js tests/unit/sources-index.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/sources/library.js src/core/sources/index.js tests/unit/src-library.test.js tests/unit/sources-index.test.js
git commit -m "Add the starter library adapter and check the registry"
```

### Task 20: Engine core

**Files:**
- Create: `src/core/engine.js`
- Modify: `tests/unit/helpers/fixture-http.js` (add `engineFor`)
- Test: `tests/unit/engine.test.js`

**Interfaces:**
- Consumes: `createSeen`, `createHistory` (Task 2), `DEFAULT_TASTE` (Task 3), `pickNext`, `eligible` (Task 4), `enabledSources`, `SOURCES`, `SELF_PACED`, `runProbes`, `adapterCtx`, `memorySecrets` (Task 5), `fatePull` (Task 6), `createCollections` (Task 8), `createCache`, `normalizeUrl`, `hash64`, `domainOf`.
- Produces: `createEngine({store, http, clock, rand, data, platform, settings, seen?, history?, collections?, sources?, secrets?, dataUrl?}) → Promise<Engine>`. `settings` is an object or a getter for the live settings, read on every call. `seen`, `history` and `collections` are created from `store` when not passed. `sources` defaults to `Object.values(SOURCES)`. `secrets` is a `SecretStore` or a getter for the current one (default `platform.secrets`); boot passes `() => app.secrets`, so Plan 05's keyring swap reaches every adapter. `dataUrl` defaults to `(file) => 'data/' + file`.
  - **Start.** It calls `http.register(a.id, a.rate)` once for every adapter in `sources` (Plan 04's included) whose id is not in `SELF_PACED`, so `ia` and `vault` stay with Plan 04's Archive queue. It loads the `broken:*` keys of `health` into the dead set, and starts `runProbes(<enabled probe-tier adapters>, http, store, clock, platform.name)` in the background; until a result says `'ok'`, the web app leaves those sources out.
  - **ctx.** One object serves every call: `{http, rand, clock, cache: createCache(store, clock), settings, secrets, data, platformName: platform.name, caps: platform.caps, dataUrl}`, where `settings` is a getter for the current settings object and `secrets` is a `SecretStore` whose four methods call the same method on the current store. `dataUrl` is only for generated snapshot files, which Plan 04's adapters read through `readSnapshot(ctx, file)` in `sources/index.js`; the library and the tags reach adapters through `data`, which is `app.data`.
  - **Pool.** Unseen candidates from `random(ctx)` of the enabled sources (`enabledSources(settings, probe, platform.name, sources)`), at most 50, never a find already in the pool, the queue or the prepared finds (Task 21). A *network source* is every adapter except `library` and `tier: 'snapshot'` ones. A refill starts when the pool holds fewer than 20 candidates and none is running. It runs rounds of one `random` call per enabled source, with at most 3 network calls in flight (the others start at once), adding each call's finds as soon as it resolves. It runs another round while the pool is under 20, and stops after a round that adds nothing.
  - `next({mode, ai = true, leanBack = false}) → Promise<{find, branch, why}|{empty: true, reason}>`. Calls are serialised, so two at once never return the same find. With `leanBack: true` and the Family filter on, `mixed` finds are skipped, injected ones included (they stay queued for a later call); `ai` reaches the Rabbit Hole (Task 21). Just before handing out a new find (not a history entry) it checks `await seen.has(find.url)` once more and picks again when another engine on the same store has shown it meanwhile (overview, "Several engines on one store"). It serves, in order: the history forward entry if Back was used (`branch 'history'`, why `'seen before'`); the injected queue (`branch` = its origin, why `'search result'` or `'AI find'`); then by mode: `tuned` uses `pickNext` over the pool; `fate` uses `fatePull` over the enabled `fate: true` sources (minus `safety 'mixed'` ones when `familyFilter` is on) with `settings.sources[id]?.fateWeight ?? 1` and `accept` = `eligible` with no domain cooldown (`branch 'fate'`, why `'pure random'`); `ai` serves the injected queue only. It waits only until the pool holds an eligible candidate or the refill ends; the rest of a refill runs in the background. Each find it hands out is added to `seen` and `history` and emitted as `find` with the payload `{find, branch, why}`.
  - `back() → Find|null` (it emits `find` with `{find, branch: 'history', why: 'seen before'}`) and `current() → Find|null`, both from history.
  - `feed(n = 30) → Promise<Find[]>`: up to `n` eligible candidates in random order, refilling until it has `n` or a round adds nothing; each is added to `seen` (not to history).
  - `search(query) → Promise<Find[]>`: `search(query, ctx)` on every enabled source with `Promise.allSettled`; the results are interleaved source by source (the first of each source in `sources` order, then the second of each, and so on), de-duplicated by normalised URL and cut to 30, then injected with origin `'search'`. It resolves to the finds that were queued.
  - `inject(finds, origin) → Promise<number>`: `origin` is `'search'` or `'ai'`; serialised with `next`. It keeps the given order, drops finds that are seen (`await seen.has(url)`), in the dead set, on a blocked domain, hidden-tagged or duplicated (in the batch or the queue), removes tags that are not ids in `data.tags`, and resolves to the number it queued. It does not apply the Family filter, because the user asked for these results (overview); lean-back still skips their `mixed` finds.
  - `taste() → Taste`, `setTaste(t)` (saves to the `taste` store under `'taste'` and emits `taste`), `on(event, fn) → unsubscribe` for `find`, `empty`, `error` (`{source, error}`, never shown) and `taste`; `pool() → Find[]`; `reload() → Promise<void>`, which reads the taste and the dead set from the store again and empties the pool, the queue and the prepared finds (Task 29 calls it after a backup import).
  - Empty reasons (exact, exported as `EMPTY_REASONS`): `exhausted: 'You have seen everything we have right now. Turn on more sources in Settings, or try Fate.'`; `unreachable: "Can't reach any source right now. Check your connection and try again."`, given when a refill ends with no eligible candidate and every network-source call in its last round failed with a `NetError` of kind `network`, `timeout` or `circuit` (an HTTP error or a bad reply means the source was reached); `aiEmpty: 'No search results waiting. Type a search to start.'`; and Fate's own reasons from Task 6.
- Test helper `engineFor({entries = [], settings, transport, extraRoutes, only = ['library'], adapters, secrets}) → Promise<{engine, calls, store, ctx, platform, registered}>`: builds `adapterCtx` with `data.library = {v: 1, entries}`, merges `settings` over `DEFAULT_SETTINGS`, turns off every `SOURCES` id not in `only` (entries in `settings.sources` win), and uses a fake `platform` (`name 'pwa'`, the given `transport` or one that resolves `{status: 0}`, `secrets: ctx.secrets`, `caps` from `ctx.caps`, `persistStorage` that counts calls in `platform.persisted`). `adapters`, when given, become `createEngine`'s `sources` and `only` is ignored. `secrets` (a getter) is passed through. The engine gets `ctx.http` wrapped so that `register` calls are recorded in `registered` (id → rate).

- [ ] **Step 1: Write the failing test**

```js
const lib = (n, extra = {}) => Array.from({ length: n }, (_, i) => ({ id: `lib-${String(i + 1).padStart(4, '0')}`, url: `https://s${i}.example.com/`, title: `Site ${i}`, blurb: `Blurb ${i}.`, tags: ['toy'], kind: 'site', added: '2026-11-01', ...extra }));
const F = (t, tags = ['toy'], source = 'library') => makeFind({ source, kind: 'site', title: t, tags, safety: 'curated', url: `https://${t}.example.org/` });
const fake = (id, extra = {}) => ({ id, name: id, kinds: ['site'], tier: 'open', key: 'none', safety: 'curated', rate: { perMinute: 600, concurrent: 4 }, fate: true,
  random: async () => [], search: async () => [], more: async () => [], ...extra });
const tick = () => new Promise((r) => setTimeout(r, 0));
test('next never repeats and says when the pool is used up', async () => {
  const { engine, calls } = await engineFor({ entries: lib(5) });
  const titles = []; for (let i = 0; i < 5; i++) titles.push((await engine.next({ mode: 'tuned' })).find.title);
  assert.equal(new Set(titles).size, 5);
  assert.deepEqual(await engine.next({ mode: 'tuned' }), { empty: true, reason: EMPTY_REASONS.exhausted });
  assert.equal(calls.length, 0);
});
test('back returns the previous find and next walks forward again', async () => {
  const { engine } = await engineFor({ entries: lib(5) });
  const a = (await engine.next({ mode: 'tuned' })).find; const b = (await engine.next({ mode: 'tuned' })).find;
  assert.equal(engine.back().id, a.id); assert.equal(engine.current().id, a.id);
  const r = await engine.next({ mode: 'tuned' }); assert.equal(r.find.id, b.id); assert.equal(r.branch, 'history');
});
test('two concurrent next calls return different finds', async () => {
  const { engine, store } = await engineFor({ entries: lib(5) });
  const [x, y] = await Promise.all([engine.next({ mode: 'tuned' }), engine.next({ mode: 'tuned' })]);
  assert.notEqual(x.find.id, y.find.id); assert.equal(await createSeen(store).count(), 2);
});
test('every source failing gives the unreachable message, even with the library on', async () => {
  const { engine } = await engineFor({ entries: lib(1), only: ['library', 'wikipedia'], extraRoutes: [{ match: /wikipedia/, error: true }] });
  assert.equal((await engine.next({ mode: 'tuned' })).find.source, 'library');
  assert.deepEqual(await engine.next({ mode: 'tuned' }), { empty: true, reason: EMPTY_REASONS.unreachable });
});
test('a slow source never holds up a find and is skipped after 8 s', async () => {
  const hang = [{ match: /wikipedia/, hang: true }];
  const a = await engineFor({ entries: lib(2), only: ['library', 'wikipedia'], extraRoutes: hang });
  assert.equal((await a.engine.next({ mode: 'tuned' })).find.source, 'library');
  const b = await engineFor({ entries: [], only: ['wikipedia'], extraRoutes: hang });
  const p = b.engine.next({ mode: 'tuned' }); await tick(); b.ctx.clock.advance(8000);
  assert.deepEqual(await p, { empty: true, reason: EMPTY_REASONS.unreachable });
});
test('a source that answers with an error is not "unreachable"', async () => {
  const { engine } = await engineFor({ entries: lib(1), only: ['library', 'wikipedia'], extraRoutes: [{ match: /wikipedia/, file: 'probe/ok.json', status: 500 }] });
  assert.equal((await engine.next({ mode: 'tuned' })).find.source, 'library');
  assert.deepEqual(await engine.next({ mode: 'tuned' }), { empty: true, reason: EMPTY_REASONS.exhausted });
});
test('createEngine registers every rate but the Archive ones and hands adapters the contract ctx', async () => {
  const { registered } = await engineFor({ entries: [] });
  for (const a of Object.values(SOURCES)) assert.deepEqual(registered[a.id], SELF_PACED.has(a.id) ? undefined : a.rate, a.id);
  assert.deepEqual(registered.github, { perMinute: 10, concurrent: 1 });
  const archive = (await engineFor({ adapters: [fake('ia'), fake('vault'), fake('other')] })).registered;
  assert.deepEqual([archive.ia, archive.vault, archive.other], [undefined, undefined, { perMinute: 600, concurrent: 4 }]);
  let got; let current = memorySecrets({ 'src:github': 'A' });
  const { engine } = await engineFor({ adapters: [fake('spy', { random: async (ctx) => { got = ctx; return []; } })], secrets: () => current });
  await engine.next({ mode: 'tuned' });
  assert.deepEqual(Object.keys(got).sort(), ['cache', 'caps', 'clock', 'data', 'dataUrl', 'http', 'platformName', 'rand', 'secrets', 'settings']);
  assert.equal(got.settings.mode, 'tuned'); assert.equal(await got.secrets.get('src:github'), 'A');
  current = memorySecrets({ 'src:github': 'B' }); assert.equal(await got.secrets.get('src:github'), 'B');
});
test('a refill keeps 3 network calls in flight, at most 50 candidates, and no unprobed source on pwa', async () => {
  let inFlight = 0, most = 0, probeTierCalls = 0;
  const many = (id) => Array.from({ length: 20 }, (_, i) => F(`${id}-${i}`));
  const net = (id) => fake(id, { random: async () => { inFlight++; most = Math.max(most, inFlight); await tick(); inFlight--; return many(id); } });
  const unprobed = fake('pr', { tier: 'probe', probeUrl: 'https://nowhere.invalid/', random: async () => { probeTierCalls++; return []; } });
  const { engine } = await engineFor({ adapters: ['n1', 'n2', 'n3', 'n4', 'n5'].map(net).concat(unprobed) });
  await engine.next({ mode: 'tuned' }); for (let i = 0; i < 5; i++) await tick();
  assert.ok(most <= 3, `most ${most}`); assert.ok(engine.pool().length <= 50); assert.equal(probeTierCalls, 0);
});
test('fate pulls at random, respects a zero weight and leaves out blocked sites', async () => {
  const a = await engineFor({ entries: lib(3) });
  const r = await a.engine.next({ mode: 'fate' }); assert.equal(r.branch, 'fate'); assert.equal(r.why, 'pure random');
  const b = await engineFor({ entries: lib(3), settings: { sources: { library: { enabled: true, fateWeight: 0 } } } });
  assert.deepEqual(await b.engine.next({ mode: 'fate' }), { empty: true, reason: 'No Fate sources are on. Turn some on in Settings → Sources.' });
  const c = await engineFor({ entries: lib(2) }); c.engine.setTaste({ ...c.engine.taste(), blockedDomains: ['s0.example.com'] });
  assert.equal((await c.engine.next({ mode: 'fate' })).find.url, 'https://s1.example.com/');
});
test('inject drops seen, blocked, duplicate and unknown-tag finds', async () => {
  const { engine, store } = await engineFor({ entries: lib(2) });
  const shown = (await engine.next({ mode: 'tuned' })).find;
  await createSeen(store).add('https://old.example.org/');
  engine.setTaste({ ...engine.taste(), blockedDomains: ['b.example.org'] });
  assert.equal(await engine.inject([shown, F('b'), F('c'), F('c'), F('d', ['toy', 'nonsense']), F('old')], 'search'), 2);
  const c = await engine.next({ mode: 'tuned' }); assert.equal(c.find.title, 'c'); assert.equal(c.branch, 'search'); assert.equal(c.why, 'search result');
  const d = await engine.next({ mode: 'tuned' }); assert.equal(d.find.title, 'd'); assert.deepEqual(d.find.tags, ['toy']);
  assert.equal((await engine.next({ mode: 'tuned' })).find.source, 'library');
});
test('search results keep mixed finds, and lean-back skips them', async () => {
  const { engine } = await engineFor({ entries: [] });
  const mixed = makeFind({ source: 'commons', kind: 'image', title: 'Old map', url: 'https://map.example.org/', safety: 'mixed' });
  assert.equal(await engine.inject([mixed, F('calm')], 'search'), 2);
  assert.equal((await engine.next({ mode: 'tuned', leanBack: true })).find.title, 'calm');
  assert.equal((await engine.next({ mode: 'tuned' })).find.title, 'Old map');
});
test('two engines on one store never hand out the same find', async () => {
  const one = await engineFor({ entries: lib(2) });
  const two = await createEngine({ store: one.store, http: one.ctx.http, clock: one.ctx.clock, rand: mulberry32(7), data: one.ctx.data,
    platform: one.platform, settings: DEFAULT_SETTINGS, sources: [SOURCES.library] });
  const x = (await two.next({ mode: 'tuned' })).find; const y = (await one.engine.next({ mode: 'tuned' })).find;
  assert.notEqual(x.id, y.id);
  assert.deepEqual(await two.next({ mode: 'tuned' }), { empty: true, reason: EMPTY_REASONS.exhausted });
});
test('AI mode serves only the injected queue', async () => {
  const { engine } = await engineFor({ entries: lib(2) });
  assert.deepEqual(await engine.next({ mode: 'ai' }), { empty: true, reason: EMPTY_REASONS.aiEmpty });
  await engine.inject([F('x')], 'ai'); const r = await engine.next({ mode: 'ai' });
  assert.equal(r.find.title, 'x'); assert.equal(r.branch, 'ai'); assert.equal(r.why, 'AI find');
});
test('search asks every enabled source, queues the results and returns what it queued', async () => {
  const { engine } = await engineFor({ entries: [...lib(2), { ...lib(1)[0], id: 'lib-0099', url: 'https://synth.example.com/', title: 'Tiny Synth' }] });
  assert.deepEqual((await engine.search('synth')).map(f => f.title), ['Tiny Synth']);
  assert.equal((await engine.next({ mode: 'tuned' })).find.title, 'Tiny Synth');
  assert.deepEqual(await engine.search('synth'), []);
});
test('search interleaves the sources', async () => {
  const s = (id, n) => fake(id, { search: async () => Array.from({ length: n }, (_, i) => F(`${id}${i}`)) });
  const { engine } = await engineFor({ adapters: [s('a', 3), s('b', 2)] });
  assert.deepEqual((await engine.search('x')).map(f => f.title), ['a0', 'b0', 'a1', 'b1', 'a2']);
});
test('feed gives batches of 30 unseen finds', async () => {
  const { engine } = await engineFor({ entries: lib(35) });
  const a = await engine.feed(); const b = await engine.feed();
  assert.equal(a.length, 30); assert.equal(b.length, 5); assert.equal(new Set([...a, ...b].map(f => f.id)).size, 35);
  assert.deepEqual(await engine.feed(), []);
});
test('find events carry {find, branch, why} from next and back, and empty fires', async () => {
  const { engine } = await engineFor({ entries: lib(2) }); const ev = [];
  engine.on('find', (e) => ev.push([e.find.title, e.branch, e.why])); engine.on('empty', (e) => ev.push(e.reason));
  const a = (await engine.next({ mode: 'tuned' })).find; await engine.next({ mode: 'tuned' }); engine.back();
  await engine.next({ mode: 'tuned' }); await engine.next({ mode: 'tuned' });
  assert.deepEqual(ev.map((e) => (typeof e === 'string' ? e : e[1])), ['wildcard', 'wildcard', 'history', 'history', EMPTY_REASONS.exhausted]);
  assert.deepEqual(ev[2], [a.title, 'history', 'seen before']);
});
test('reload reads the stored taste again', async () => {
  const { engine, store } = await engineFor({ entries: lib(2) });
  await store.put('taste', 'taste', { ...DEFAULT_TASTE, tags: { space: 2 } }); await engine.reload();
  assert.equal(engine.taste().tags.space, 2);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/unit/engine.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/core/engine.js`.

- [ ] **Step 3: Add `engineFor` and implement the engine core**

`pickNext` gets a sync `seenHas` that checks the hashes shown this session and the session's dead set; the pool itself is filtered through `await seen.has(url)` when candidates arrive. `recentDomains` is `history.recentDomains(10)`. Fate's `accept` is `(f) => eligible(f, {seenHas, taste, recentDomains: [], familyFilter})`. `react`, `rabbit`, link checks and prefetch come in Task 21; leave them out here.

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/unit/engine.test.js`
Expected: PASS, 18 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/engine.js tests/unit/helpers/fixture-http.js tests/unit/engine.test.js
git commit -m "Add the engine with the pool, modes, queue, search and feed"
```

### Task 21: Engine reactions, Rabbit Hole, link checks and prefetch

**Files:**
- Modify: `src/core/engine.js`
- Test: `tests/unit/engine-react.test.js`

**Interfaces:**
- Consumes: `applyReaction`, `describeChange` (Task 3), `eligible` (Task 4), `createRabbitHole` (Task 7), `checkLive` (Task 11), `engineFor` (Task 20).
- Produces, on `Engine`:
  - `react(find, reaction, extra?) → Promise<{message, undo() → Promise<void>}>`. It applies `applyReaction`, saves the taste and emits `taste`. `undo()` restores the taste from before and reverses the side effect. Messages use `describeChange(change, labelOf)` with the `data.tags` labels. Side effects and messages (exact):
    - `like`, `dislike`, `lessTopic`, `neverSite`: `describeChange(change, labelOf)`. `neverSite` also drops that domain from the pool, the queue and the prepared finds.
    - `save`: adds to `extra.collectionId ?? await collections.getCurrent()`; message `'Saved to <collection name>.'`; the first save of the session calls `platform.persistStorage()`.
    - `broken`: writes `health['broken:<hash64(normalizeUrl(url))>'] = {t, url}` and hides the find for good (the engine loads these keys into its dead set at start); message `'Thanks. This find is hidden now.'`, or `'Thanks. ' + describeChange(change, labelOf)` when `extra.blockDomain`.
  - `rabbit`: the engine's wrapper around `createRabbitHole({sources: () => <enabled adapters>, ctx, seenHas, pool: () => engine.pool(), accept})`, where `accept` is Fate's (Task 20). It has the hole's `start(find)`, `trail()`, `climbOut()` and `useAi(fn|null)`, and its `next() → Promise<Find|null>` also adds the find to `seen` and `history` and emits `find` with `{find, branch: 'rabbit', why: 'rabbit hole'}`, so a direct call (Plan 07) behaves like Stumble. `useAi(fn)` hands the hole a wrapped `fn` whose finds are link-checked first when **Check links** is on. While the trail is not empty, `engine.next({ai})` serves the hole right after the history forward entry, passing `ai` on, so `ai: false` skips the AI hook: `{find, branch: 'rabbit', why: 'rabbit hole'}`, or `{empty: true, reason: EMPTY_REASONS.rabbitDry}` with `rabbitDry: 'This Rabbit Hole has run dry. Climb out to stumble on.'`.
  - **Link checks.** When `settings.checkLinks` is on, a find from `kagi` or `kagirandom`, one injected with origin `'ai'`, or one from the Rabbit Hole AI hook is checked with `checkLive(url, {transport: platform.transport, privileged: platform.caps.privilegedFetch})` before `next` or `feed` hands it out. Each URL is checked at most once per session. A dead find goes into the session dead set and the next candidate is tried. With `checkLinks` off, `platform.transport` is never called.
  - **Prefetch** (§7.3, "at most 3 finds ahead"). Each time `next` serves a Tuned pick, the engine prepares up to 3 more Tuned picks in the background (`pickNext` with the last prepared pick as `current`, their domains counted in the cooldown) and link-checks those that need it. After each `inject` it link-checks the first 3 queued finds the same way. A Tuned `next` serves the oldest prepared pick that is still eligible and drops the ineligible ones, so it answers at once when picks are ready. Fate, AI mode and the Rabbit Hole are not prepared ahead.

- [ ] **Step 1: Write the failing test**

```js
// `fake` and `tick` are the helpers from engine.test.js
const lib = (n) => Array.from({ length: n }, (_, i) => ({ id: `lib-${String(i + 1).padStart(4, '0')}`, url: `https://s${i}.example.com/`, title: `Site ${i}`, blurb: 'A toy.', tags: ['toy'], kind: 'site', added: '2026-11-01' }));
const F = (t) => makeFind({ source: 'kagi', kind: 'site', title: t, tags: ['web'], safety: 'curated', url: `https://${t}.example.org/` });
test('like explains itself and undo puts the taste back', async () => {
  const { engine } = await engineFor({ entries: lib(3) }); const { find } = await engine.next({ mode: 'tuned' });
  const r = await engine.react(find, 'like');
  assert.equal(r.message, 'More toy from now on.'); assert.equal(engine.taste().tags.toy, 1); assert.equal(engine.taste().reactions, 1);
  await r.undo(); assert.equal(engine.taste().tags.toy ?? 0, 0); assert.equal(engine.taste().reactions, 0);
});
test('save goes to the current collection and asks for persistent storage once', async () => {
  const { engine, store, platform } = await engineFor({ entries: lib(3) }); const cols = createCollections(store, fakeClock(0));
  const a = (await engine.next({ mode: 'tuned' })).find; const b = (await engine.next({ mode: 'tuned' })).find;
  const r = await engine.react(a, 'save'); await engine.react(b, 'save');
  assert.equal(r.message, 'Saved to Saved.'); assert.equal(platform.persisted, 1);
  assert.deepEqual(await cols.has(a.id), ['saved']);
  await r.undo(); assert.deepEqual(await cols.has(a.id), []);
});
test('never this site keeps that domain out', async () => {
  const { engine } = await engineFor({ entries: [...lib(2), { ...lib(1)[0], id: 'lib-0050', url: 'https://s0.example.com/other' }] });
  const { find } = await engine.next({ mode: 'tuned' });
  assert.equal((await engine.react(find, 'neverSite')).message, `You won't see ${new URL(find.url).hostname} again.`);
  for (let r = await engine.next({ mode: 'tuned' }); !r.empty; r = await engine.next({ mode: 'tuned' }))
    assert.notEqual(new URL(r.find.url).hostname, new URL(find.url).hostname);
});
test('broken hides the find and records it in health', async () => {
  const { engine, store } = await engineFor({ entries: lib(1) }); const { find } = await engine.next({ mode: 'tuned' });
  assert.equal((await engine.react(find, 'broken')).message, 'Thanks. This find is hidden now.');
  assert.ok(await store.get('health', 'broken:' + hash64(normalizeUrl(find.url))));
});
test('a Rabbit Hole serves similar finds until it runs dry', async () => {
  const { engine } = await engineFor({ entries: lib(3) }); const { find } = await engine.next({ mode: 'tuned' });
  engine.rabbit.start(find);
  const r = await engine.next({ mode: 'tuned' }); assert.equal(r.branch, 'rabbit'); assert.equal(r.why, 'rabbit hole');
  await engine.next({ mode: 'tuned' });
  assert.deepEqual(await engine.next({ mode: 'tuned' }), { empty: true, reason: EMPTY_REASONS.rabbitDry });
  engine.rabbit.climbOut(); assert.equal((await engine.next({ mode: 'tuned' })).empty, true);
});
test('rabbit.next on its own records the find and emits it', async () => {
  const { engine, store } = await engineFor({ entries: lib(3) }); const { find } = await engine.next({ mode: 'tuned' });
  const events = []; engine.on('find', (e) => events.push(e.branch));
  engine.rabbit.start(find); const f = await engine.rabbit.next();
  assert.deepEqual(events, ['rabbit']); assert.equal(engine.current().id, f.id); assert.equal(await createSeen(store).has(f.url), true);
});
test('a Rabbit Hole leaves out blocked sites and hidden topics', async () => {
  const e = (id, title, tags) => ({ id, url: `https://${id}.example.com/`, title, blurb: 'Pixel toy.', tags, kind: 'site', added: '2026-11-01' });
  const { engine } = await engineFor({ entries: [e('a', 'Pixel Toy A', ['toy']), e('b', 'Pixel Toy B', ['toy', 'retro']), e('c', 'Pixel Toy C', ['toy']), e('d', 'Pixel Toy D', ['toy'])] });
  engine.setTaste({ ...engine.taste(), hiddenTags: ['retro'], blockedDomains: ['c.example.com'] });
  engine.rabbit.start(makeFind({ source: 'library', kind: 'site', title: 'Pixel Toy A', tags: ['toy'], safety: 'curated', url: 'https://a.example.com/' }));
  assert.equal((await engine.next({ mode: 'tuned' })).find.title, 'Pixel Toy D');
  assert.deepEqual(await engine.next({ mode: 'tuned' }), { empty: true, reason: EMPTY_REASONS.rabbitDry });
});
test('a dry Rabbit Hole asks the AI hook, which is link-checked', async () => {
  const asked = []; const transport = { fetch: async (u) => { asked.push(u); return { status: 0 }; } };
  const { engine } = await engineFor({ entries: lib(1), transport }); const { find } = await engine.next({ mode: 'tuned' });
  engine.rabbit.start(find);
  assert.deepEqual(await engine.next({ mode: 'tuned' }), { empty: true, reason: EMPTY_REASONS.rabbitDry });
  engine.rabbit.useAi(async () => [F('ai-pick')]);
  assert.deepEqual(await engine.next({ mode: 'tuned', ai: false }), { empty: true, reason: EMPTY_REASONS.rabbitDry });
  assert.equal((await engine.next({ mode: 'tuned' })).find.title, 'ai-pick'); assert.deepEqual(asked, ['https://ai-pick.example.org/']);
  engine.rabbit.useAi(null);
  assert.deepEqual(await engine.next({ mode: 'tuned' }), { empty: true, reason: EMPTY_REASONS.rabbitDry });
});
test('AI and Kagi finds are link-checked before they are shown', async () => {
  const asked = [];
  const transport = { fetch: async (u) => { asked.push(u); if (u.includes('dead')) throw new TypeError('Failed to fetch'); return { status: 0 }; } };
  const { engine } = await engineFor({ entries: lib(1), transport });
  await engine.inject([F('dead'), F('alive')], 'ai');
  assert.equal((await engine.next({ mode: 'ai' })).find.title, 'alive');
  assert.deepEqual(asked, ['https://dead.example.org/', 'https://alive.example.org/']);
});
test('with Check links off, nothing is contacted', async () => {
  const asked = []; const transport = { fetch: async (u) => { asked.push(u); return { status: 0 }; } };
  const { engine } = await engineFor({ entries: lib(1), transport, settings: { checkLinks: false } });
  await engine.inject([F('x')], 'ai'); await engine.next({ mode: 'ai' }); assert.deepEqual(asked, []);
});
test('the engine prepares at most 3 finds ahead and serves them without waiting', async () => {
  const asked = []; const transport = { fetch: async (u) => { asked.push(u); return { status: 0 }; } };
  const kagiLike = fake('kagi', { random: async () => Array.from({ length: 10 }, (_, i) => F(`k${i}`)) });
  const { engine } = await engineFor({ adapters: [kagiLike], transport });
  await engine.next({ mode: 'tuned' }); await tick();
  assert.equal(asked.length, 4);
  const ahead = asked.slice(1); const b = (await engine.next({ mode: 'tuned' })).find;
  assert.ok(ahead.includes(new URL(b.url).origin + '/'));
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/unit/engine-react.test.js`
Expected: FAIL with `TypeError: engine.react is not a function`.

- [ ] **Step 3: Add `react`, the `rabbit` wrapper, the link checks and prefetch to `engine.js`**

- [ ] **Step 4: Run both engine tests and see them pass**

Run: `node --test tests/unit/engine.test.js tests/unit/engine-react.test.js`
Expected: PASS, 29 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/engine.js tests/unit/engine-react.test.js
git commit -m "Add reactions with undo, Rabbit Hole, link checks and prefetch to the engine"
```

### Task 22: Boot wiring, the card and the Stumble view

**Files:**
- Create: `src/ui/components/card.js`, `src/ui/components/generated-image.js`, `src/ui/views/stumble.js`, `tests/fixtures/http/library/small.json`
- Modify: `src/ui/boot.js`, `src/ui/views/index.js` (import `./stumble.js`), `tests/e2e/helpers/net.js`, `tests/fixtures/routes.js`
- Test: `tests/e2e/stumble.spec.js`

**Interfaces:**
- Consumes: Plan 01's `App` fields (`dataUrl` among them), `registerView`, `h`, `clear`, `announce`, `mockNet`, `gotoApp`; `createSeen`, `createHistory`, `createCollections`, `createEngine`, `EMPTY_REASONS` (Tasks 2, 8, 20); `getSource`, `domainOf`, `hash64`.
- Produces:
  - `boot.js` adds, after Plan 01's fields and before `runFirstRun` (the interests step of Task 27 uses `app.engine`): `app.secrets = platform.secrets` (Plan 05 later puts its keyring here), `app.seen = createSeen(store)`, `app.history = createHistory(store, {max: 50})` (awaiting `ready`), `app.collections = createCollections(store, clock)`, `app.engine = await createEngine({store, http, clock, rand, data, platform, settings: () => app.getSettings(), seen, history, collections, secrets: () => app.secrets, dataUrl: app.dataUrl})`, and `app.search = async (text) => { const finds = await app.engine.search(text); return finds.length ? {finds} : {finds, note: 'No new finds for "<text>".'}; }`.
  - `generatedImage(find) → HTMLElement`: `div.gen-image` with `aria-hidden="true"`, `data-hue` = `parseInt(hash64(domainOf(find.url)).slice(0, 8), 16) % 360` (also set as CSS `--hue` through `el.style.setProperty`), a `span.initial` with the domain's first letter in upper case, and a `span.badge` reading `'Shared'` for the pseudo-source `shared` (overview), else `getSource(find.source)?.name ?? find.source`.
  - `renderCard(find, {onAction, compact = false, whyLine = (f) => f.why.join(' · ')}) → HTMLElement`: `article.card` (`.compact` when compact) with an `h2` title, an `<img alt="">` for `imageUrl` (on error it is replaced by `generatedImage(find)`) or `generatedImage(find)`, `p.description` (cut to 160 characters when compact), `p.domain` = `find.meta?.displayDomain ?? domainOf(find.url)` (overview; Plan 05 sets it for redirect links), plus `' · by <author>'` when known, `p.why` = `whyLine(find)`, `p.found-by` = `'Found by <foundBy joined with ", ">'` when `foundBy` is not empty, `span.team-pick` = `'Team pick'` when `teamPick` is set (Plan 05 only fills those two fields), and `p.licence` = licence and attribution joined with `' · '`. All text goes in through `text`/`textContent`. Task 23 adds the actions.
  - `views/stumble.js`: `registerView('stumble', {title: 'Stumble', render})` and the exports `showResult(result)`, `getCurrentFind() → Find|null`, `setMode(mode)` (Task 24 fills in `setMode`). The view has a card slot, `p.empty` for empty reasons, and **Back** and **Next** buttons. Its `whyLine` is `(f) => [MODE_LABEL[mode], result.why, ...f.why].join(' · ')` with `MODE_LABEL = {tuned: 'Tuned', fate: 'Fate', ai: 'AI Search'}`. Showing a find announces `'Now showing: <title>'` politely; an empty result shows and announces its reason. On render it calls `engine.next` when a Rabbit Hole has just been started (its trail holds one find, as after **More like this** in the Feed); otherwise it shows `engine.current()` if there is one, else calls `engine.next`. **Back** with no earlier find announces `'This is the first find.'`
  - `stageLibrary(page, entries)` in `net.js`: call it before `gotoApp` (the `page` fixture of Plan 01's `test` has already called `mockNet`). It calls `mockNet(page, {overrides: [{match: /^https?:\/\/(?!localhost:4321\/)/, status: 200, body: '', headers: {'content-type': 'text/plain'}}]})`, because page routes run before context routes and the newest page route wins; mockNet adds the CORS headers. It answers `**/data/library.json` with `{v: 1, entries}`, and the same non-localhost pattern on `page.context()` with an empty `text/html` page, for popups. Every other source then fails fast without a console error (an empty body is a JSON parse error, a probe fails, a list is empty), so the library is the only source with finds.
  - Two catch-all entries at the end of `tests/fixtures/routes.js` (later routes go above them), so that specs which do not stage the library, such as Plan 01's `shell.spec.js` and `smoke.spec.js`, see no unmocked request: fixture images, `{match: /^https:\/\/[^/]+\/\S*\.(jpe?g|png)$/i, body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>', headers: {'content-type': 'image/svg+xml'}}`, and link checks of fixture sites, `{match: /^https?:\/\/(([a-z0-9-]+\.)*example(\.[a-z]+)?|www\.youtube\.com)\/$/, body: ''}`.
- `library/small.json` entries (all `added '2026-11-01'`): `lib-0001` `https://example.com/` 'Tiny Synth' 'Make sounds with a tiny synth.' `['music','art']` toy; `lib-0002` `https://example.net/` 'Pixel Garden' 'Grow a pixel garden.' `['art','toy']` game; `lib-0003` `https://example.org/` 'Moth Atlas' 'Pictures of moths from one back garden.' `['nature','science']` site.

- [ ] **Step 1: Write the failing test**

```js
import { readFileSync } from 'node:fs';
import { test, expect, stageLibrary } from './helpers/net.js';
import { gotoApp, skipFirstRun } from './helpers/app.js';
import { installFakeSpeech } from './helpers/fakes.js';
import { expectNoSeriousA11y } from './helpers/axe.js';
import { hash64 } from '../../src/core/util/hash.js';
const small = JSON.parse(readFileSync(new URL('../fixtures/http/library/small.json', import.meta.url))).entries;
const open = async (page, entries, hash = '#/stumble') => { await stageLibrary(page, entries); await gotoApp(page, hash); };
const title = (page) => page.locator('article.card h2').first();
const mount = (page, partial) => page.evaluate(async (p) => {
  const { makeFind } = await import(new URL('core/model/find.js', document.baseURI).href);
  const { renderCard } = await import(new URL('ui/components/card.js', document.baseURI).href);
  document.querySelector('#main').append(renderCard(makeFind(p), { onAction() {} }));
}, partial);

test('axe finds no serious issues on Stumble', async ({ page }) => { await open(page, small); await expectNoSeriousA11y(page); });

test('shows a library find with a generated image and a why line', async ({ page }) => {
  await open(page, [small[0]]); const card = page.locator('article.card');
  await expect(title(page)).toHaveText('Tiny Synth');
  await expect(card.locator('.domain')).toHaveText('example.com');
  await expect(card.locator('.why')).toHaveText('Tuned · wildcard · Starter library');
  await expect(card.locator('.gen-image')).toHaveAttribute('data-hue', String(parseInt(hash64('example.com').slice(0, 8), 16) % 360));
  await expect(card.locator('.gen-image .initial')).toHaveText('E'); await expect(card.locator('.gen-image .badge')).toHaveText('Starter library');
  await expect(page.locator('#live-polite')).toHaveText('Now showing: Tiny Synth');
});
test('Next, Back and the end of the pool', async ({ page }) => {
  await open(page, small); const seenTitles = [await title(page).textContent()];
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'Next' }).click(); await expect(title(page)).not.toHaveText(seenTitles.at(-1));
    seenTitles.push(await title(page).textContent());
  }
  expect(new Set(seenTitles).size).toBe(3);
  await page.getByRole('button', { name: 'Back' }).click(); await expect(title(page)).toHaveText(seenTitles[1]);
  await page.getByRole('button', { name: 'Next' }).click(); await expect(title(page)).toHaveText(seenTitles[2]);
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.locator('p.empty')).toHaveText('You have seen everything we have right now. Turn on more sources in Settings, or try Fate.');
});
test('card shows markup as plain text', async ({ page }) => {
  await open(page, [{ ...small[0], title: '&lt;b&gt;Bold&lt;/b&gt;', blurb: '&lt;img src=x onerror=alert(1)&gt;Hi' }]);
  await expect(title(page)).toHaveText('<b>Bold</b>');
  await expect(page.locator('article.card b, article.card img[src="x"]')).toHaveCount(0);
});
test('card shows the creator, the licence, the AI badges, a display domain and the Shared badge', async ({ page }) => {
  await open(page, small);
  await mount(page, { source: 'commons', kind: 'image', title: 'Old map', url: 'https://example.com/map', safety: 'mixed', author: 'Ann',
    licence: 'CC BY 4.0', attribution: 'Wikimedia Commons', foundBy: ['Scout · model-a', 'Digger · model-b'], teamPick: true });
  const card = page.locator('article.card').last();
  await expect(card.locator('.domain')).toHaveText('example.com · by Ann');
  await expect(card.locator('.licence')).toHaveText('CC BY 4.0 · Wikimedia Commons');
  await expect(card.locator('.found-by')).toHaveText('Found by Scout · model-a, Digger · model-b');
  await expect(card.locator('.team-pick')).toHaveText('Team pick');
  await mount(page, { source: 'ai', kind: 'site', title: 'Via redirect', url: 'https://redirect.example.net/r/1', safety: 'mostly', meta: { displayDomain: 'moths.example.org' } });
  await expect(page.locator('article.card').last().locator('.domain')).toHaveText('moths.example.org');
  await mount(page, { source: 'shared', kind: 'site', title: 'example.org', url: 'https://example.org/', safety: 'mixed' });
  await expect(page.locator('article.card').last().locator('.gen-image .badge')).toHaveText('Shared');
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx playwright test -c tests/e2e/playwright.config.js tests/e2e/stumble.spec.js`
Expected: FAIL with `SyntaxError: The requested module './helpers/net.js' does not provide an export named 'stageLibrary'`.

- [ ] **Step 3: Add `stageLibrary`, the two catch-all routes, the boot wiring, `generated-image.js`, `card.js` and `stumble.js`**

- [ ] **Step 4: Run it and see it pass, then run the whole suite**

Run: `npm run e2e -- tests/e2e/stumble.spec.js`, then `npm run e2e`
Expected: PASS, 5 tests; the `test` fixture's checks (no unmocked request, no console error, no page error) pass after each. The whole suite passes, Plan 01's specs included.

- [ ] **Step 5: Commit**

```bash
git add src/ui/boot.js src/ui/views/index.js src/ui/components/card.js src/ui/components/generated-image.js src/ui/views/stumble.js tests/e2e/helpers/net.js tests/fixtures/routes.js tests/fixtures/http/library/small.json tests/e2e/stumble.spec.js
git commit -m "Wire the engine into boot and add the card and Stumble view"
```

### Task 23: Card actions

**Files:**
- Modify: `src/ui/components/card.js`, `src/ui/views/stumble.js`
- Test: `tests/e2e/card-actions.spec.js`

**Interfaces:**
- Consumes: `renderCard`, `showResult` (Task 22), `engine.react`, `engine.rabbit` (Task 21), `showToast`, `announce`, `platform.share`, `platform.openFind`, `platform.tts.speak`, `firstSentence`, `domainOf`.
- Produces:
  - The card's buttons, in this order and with these exact labels: **Like**, **Not for me** (both with `aria-pressed`), **Save**, **Share**, **Open** (**Play** instead when `find.embedUrl` is set; action `'play'`), **More like this**, **Read it**, and **⋯** (`aria-label "More actions"`, `aria-haspopup "menu"`, `aria-expanded`) opening a `role="menu"` with `menuitem`s **Less of this topic**, **Never this site**, **Broken or spam** and **Why am I seeing this?**. Each calls `onAction(action, find, extra)` with `like dislike save share open play more read lessTopic neverSite broken why`.
  - Keyboard and Back: the menu opens with focus on its first item; ArrowDown and ArrowUp move between items (wrapping); Esc, or a `byways:back` event on `window` (which it cancels with `preventDefault()`), closes it and puts focus back on **⋯**, and Esc goes no further. The inline confirms (`'Also block <domain>?'` here, and the Delete and Reset confirms of Tasks 26 and 29) close the same way.
  - `makeActionHandler(app, {advance, whyLine = (f) => f.why.join(' · ')}) → (action, find, extra) => Promise<void>` in `card.js`, used by Stumble, Feed and Saved. `advance(action, find)` is called after `more`, `neverSite` and `broken`: Stumble's shows `engine.next({mode})` through `showResult`; Feed's and Saved's (Tasks 25–26) go to Stumble for `more` (`navigate('stumble')`) and remove that card for the other two.
    - `like`, `dislike`, `save`, `neverSite`, `lessTopic` (`extra.tag = find.tags[0]`): `engine.react`, then `showToast(message, {undo})`; the undo runs `r.undo()` and announces `'Undone.'`. `neverSite` then calls `advance`. A find with no tags gives the toast `'This find has no topic to hide.'` for `lessTopic`.
    - `broken`: the card shows `'Also block <domain>?'` with **Block site** and **Just this find**; either one reacts with `{blockDomain}`, shows the toast without undo and calls `advance`.
    - `share`: `platform.share({title, url})`; on `'copied'` the toast is `'Link copied.'`.
    - `open` and `play`: `platform.openFind(find, 'tab')`, then announce `'Opened in a new tab.'` (Plan 04 replaces `play`).
    - `read`: `app.handsFree.command('read', find)` (overview: a card's **Read it** passes its own find) when Plan 03 has set it up, else `platform.tts.speak('<title>. From <domain>. <firstSentence(description)>')`.
    - `more` (§6.3, "Start or continue a Rabbit Hole"): when `find` is the last find of `engine.rabbit.trail()`, it only calls `advance`; otherwise `engine.rabbit.start(find)`, then `advance`.
    - `why`: toggles `div.why-detail` under the card holding `whyLine(find)`.

- [ ] **Step 1: Write the failing test**

```js
// same imports and helpers (`small`, `open`, `mount`) as stumble.spec.js; every test starts with: await open(page, [small[0]]);
const menu = (page) => page.getByRole('button', { name: 'More actions' }).click();
test('the card has every action label', async ({ page }) => {
  for (const name of ['Like', 'Not for me', 'Save', 'Share', 'Open', 'More like this', 'Read it']) await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  await menu(page);
  for (const name of ['Less of this topic', 'Never this site', 'Broken or spam', 'Why am I seeing this?']) await expect(page.getByRole('menuitem', { name })).toBeVisible();
});
test('Like shows a note and Undo reverts it', async ({ page }) => {
  const like = page.getByRole('button', { name: 'Like', exact: true }); await like.click();
  await expect(page.getByText('More music and art from now on.')).toBeVisible(); await expect(like).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('#live-polite')).toHaveText('Undone.'); await expect(like).toHaveAttribute('aria-pressed', 'false');
});
test('Save and Never this site offer Undo', async ({ page }) => {
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Saved to Saved.')).toBeVisible(); await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();
  await menu(page); await page.getByRole('menuitem', { name: 'Never this site' }).click();
  await expect(page.getByText("You won't see example.com again.")).toBeVisible();
});
test('Broken or spam asks about the site', async ({ page }) => {
  await menu(page); await page.getByRole('menuitem', { name: 'Broken or spam' }).click();
  await expect(page.getByText('Also block example.com?')).toBeVisible();
  await page.getByRole('button', { name: 'Just this find' }).click();
  await expect(page.getByText('Thanks. This find is hidden now.')).toBeVisible();
});
test('Share copies the link and Open opens a tab', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Share' }).click(); await expect(page.getByText('Link copied.')).toBeVisible();
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: 'Open' }).click()]);
  expect(popup.url()).toBe('https://example.com/');
});
test('Read it speaks the card and Why explains it', async ({ page }) => {
  // this test calls installFakeSpeech(page) before open(...)
  await page.getByRole('button', { name: 'Read it' }).click();
  await expect.poll(() => page.evaluate(() => window.__spoken)).toContain('Tiny Synth. From example.com. Make sounds with a tiny synth.');
  await menu(page); await page.getByRole('menuitem', { name: 'Why am I seeing this?' }).click();
  await expect(page.locator('.why-detail')).toHaveText('Tuned · wildcard · Starter library');
});
test('the ⋯ menu works by keyboard and closes on Back', async ({ page }) => {
  const more = page.getByRole('button', { name: 'More actions' });
  await more.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem', { name: 'Less of this topic' })).toBeFocused();
  await page.keyboard.press('ArrowDown'); await expect(page.getByRole('menuitem', { name: 'Never this site' })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(page.getByRole('menu')).toBeHidden(); await expect(more).toBeFocused();
  await more.click();
  expect(await page.evaluate(() => !window.dispatchEvent(new CustomEvent('byways:back', { cancelable: true })))).toBe(true);
  await expect(page.getByRole('menu')).toBeHidden();
});
test('a find with an embed shows Play instead of Open', async ({ page }) => {
  await mount(page, { source: 'ia', kind: 'game', title: 'Whizz', url: 'https://archive.org/details/msdos_Whizz_1994',
    embedUrl: 'https://archive.org/embed/msdos_Whizz_1994', safety: 'curated' });
  const card = page.locator('article.card').last();
  await expect(card.getByRole('button', { name: 'Play' })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Open', exact: true })).toHaveCount(0);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx playwright test -c tests/e2e/playwright.config.js tests/e2e/card-actions.spec.js`
Expected: FAIL: no button named `Like`.

- [ ] **Step 3: Add the actions to `card.js` and pass `makeActionHandler` from `stumble.js`**

- [ ] **Step 4: Run it and see it pass, then run the whole suite**

Run: `npm run e2e -- tests/e2e/card-actions.spec.js tests/e2e/stumble.spec.js`, then `npm run e2e`
Expected: PASS, 13 tests, then the whole suite passes.

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/card.js src/ui/views/stumble.js tests/e2e/card-actions.spec.js
git commit -m "Add the card actions, the ⋯ menu and Undo"
```

### Task 24: Modes, Familiar ↔ Strange, search, Rabbit Hole trail and Wiby leap

**Files:**
- Modify: `src/ui/views/stumble.js`
- Test: `tests/e2e/stumble-modes.spec.js`

**Interfaces:**
- Consumes: `app.search`, `app.saveSettings`, `app.getSettings`, `engine.next`, `engine.taste`, `engine.setTaste`, `engine.rabbit` (Tasks 20–21), `WIBY_LEAP_URL` (Task 18), `makeFind`, `announce`.
- Produces, in the Stumble view:
  - A `fieldset` with legend **Mode** and radios **Tuned**, **AI Search** and **Fate** (values `tuned`, `ai`, `fate`), checked from `settings.mode`. `setMode(mode)` checks the radio, saves `{mode}` and, for `ai`, focuses the search field. In `ai` mode with `settings.ai.provider` unset, `p.note` says `'No AI is set up yet, so search uses the free sources.'`
  - While the mode is Tuned, the range **Familiar ↔ Strange** (0–1, step 0.05, §5.2 "a visible Familiar ↔ Strange control") bound to `taste.strangeness` through `engine.setTaste`; it is the same value as in Settings → Your taste (Task 27), and it is hidden in the other modes.
  - The search form of the overview: a text field (`input type="search"`) labelled **Search for** and a button **Search**. Submitting calls `app.search(text)`; with finds it shows the next result, otherwise it shows the `note` in `p.empty`. A `note` that comes with finds (Plan 05's cost line) is shown in `p.note`. Plan 03's `/` key focuses this field.
  - While `engine.rabbit.trail()` is not empty: `nav[aria-label="Rabbit Hole"]` with an `ol` of trail titles and a **Climb out** button, which calls `climbOut()`, hides the trail, announces `'Back to Stumble.'` and shows the next find.
  - A **Wiby leap** button: `platform.openFind(makeFind({source: 'wiby', kind: 'site', title: 'Wiby leap', url: WIBY_LEAP_URL, safety: 'curated'}), 'tab')`. It fetches nothing and is never added to the seen-set.

- [ ] **Step 1: Write the failing test**

```js
// same imports, `small` and `open` helper as stumble.spec.js
// (the Fate pull itself is pinned in Task 28, where the other Fate sources can be set to 0)
test('the mode is saved and survives a reload', async ({ page }) => {
  await open(page, small); await page.getByRole('radio', { name: 'Fate' }).check();
  await page.reload(); await expect(page.getByRole('radio', { name: 'Fate' })).toBeChecked();
});
test('Familiar ↔ Strange shows in Tuned mode and is saved', async ({ page }) => {
  await open(page, small); const range = page.getByRole('slider', { name: 'Familiar ↔ Strange' });
  await range.fill('1'); await page.reload(); await expect(range).toHaveValue('1');
  await page.getByRole('radio', { name: 'Fate' }).check(); await expect(range).toBeHidden();
});
test('search finds a library entry, or says it found nothing', async ({ page }) => {
  await open(page, small); const shown = await page.locator('article.card h2').textContent();
  const target = small.find((e) => e.title !== shown);
  const box = page.getByRole('searchbox', { name: 'Search for' }); const go = page.getByRole('button', { name: 'Search', exact: true });
  await box.fill(target.title.split(' ')[0]); await go.click();
  await expect(page.locator('article.card h2')).toHaveText(target.title);
  await expect(page.locator('article.card .why')).toHaveText('Tuned · search result · Starter library');
  await box.fill('zzzz'); await go.click();
  await expect(page.locator('p.empty')).toHaveText('No new finds for "zzzz".');
});
test('AI Search without AI explains keyword search', async ({ page }) => {
  await open(page, small); await page.getByRole('radio', { name: 'AI Search' }).check();
  await expect(page.locator('p.note')).toHaveText('No AI is set up yet, so search uses the free sources.');
  await expect(page.getByRole('searchbox', { name: 'Search for' })).toBeFocused();
});
test('More like this opens a Rabbit Hole and Climb out leaves it', async ({ page }) => {
  await open(page, small.slice(0, 2)); const first = await page.locator('article.card h2').textContent();
  await page.getByRole('button', { name: 'More like this' }).click();
  const trail = page.getByRole('navigation', { name: 'Rabbit Hole' });
  await expect(trail.locator('li')).toHaveCount(2); await expect(trail.locator('li').first()).toHaveText(first);
  await page.getByRole('button', { name: 'Climb out' }).click();
  await expect(trail).toBeHidden(); await expect(page.locator('#live-polite')).toHaveText('Back to Stumble.');
});
test('More like this inside a hole digs deeper', async ({ page }) => {
  await open(page, small.map((e) => ({ ...e, tags: ['toy'] })));
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'More like this' }).click();
  await expect(page.getByRole('navigation', { name: 'Rabbit Hole' }).locator('li')).toHaveCount(3);
});
test('Wiby leap opens wiby.me/surprise/ in a new tab', async ({ page }) => {
  await open(page, small);
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: 'Wiby leap' }).click()]);
  expect(popup.url()).toBe('https://wiby.me/surprise/');
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx playwright test -c tests/e2e/playwright.config.js tests/e2e/stumble-modes.spec.js`
Expected: FAIL: no radio named `Fate`.

- [ ] **Step 3: Add the mode switch, Familiar ↔ Strange, the search form, the trail and the Wiby leap button to `stumble.js`**

- [ ] **Step 4: Run it and see it pass, then run the whole suite**

Run: `npm run e2e -- tests/e2e/stumble-modes.spec.js tests/e2e/stumble.spec.js`, then `npm run e2e`
Expected: PASS, 12 tests, then the whole suite passes.

- [ ] **Step 5: Commit**

```bash
git add src/ui/views/stumble.js tests/e2e/stumble-modes.spec.js
git commit -m "Add modes, Familiar to Strange, search, the Rabbit Hole trail and Wiby leap to Stumble"
```

### Task 25: Feed

**Files:**
- Create: `src/ui/views/feed.js`
- Modify: `src/ui/views/index.js` (import `./feed.js`)
- Test: `tests/e2e/feed.spec.js`

**Interfaces:**
- Consumes: `engine.feed(30)` (Task 20), `renderCard`, `makeActionHandler` (Tasks 22–23), `EMPTY_REASONS`, `registerView`, `navigate`.
- Produces: `registerView('feed', {title: 'Feed', render})`. The view has a `fieldset` with legend **Order** and radios **Shuffled** (default; the engine's random order) and **Newest first** (the batch sorted by `meta.published`, newest first, finds without a date last), and a `ul.feed` of compact cards whose actions go through `makeActionHandler(app, {advance})`, with Task 23's Feed `advance`. After each batch comes `p.end`: when the batch had 30 finds it reads `"That's 30. Stumble on or call it a day"` and is followed (as a sibling, not inside it) by a **Stumble on** button, which appends the next batch and then goes away; otherwise it reads `EMPTY_REASONS.exhausted` and has no button. Never ranked by engagement.

- [ ] **Step 1: Write the failing test**

```js
// same imports and helpers as stumble.spec.js
const many = (n) => Array.from({ length: n }, (_, i) => ({ id: `lib-${String(i + 1).padStart(4, '0')}`, url: `https://site-${i}.example.com/`,
  title: `Site ${i}`, blurb: `Blurb ${i}.`, tags: ['toy'], kind: 'site', added: `2026-10-${String((i % 28) + 1).padStart(2, '0')}` }));
const cards = (page) => page.locator('ul.feed article.card');
test('axe finds no serious issues on the Feed', async ({ page }) => {
  await open(page, many(3), '#/feed'); await expect(cards(page)).toHaveCount(3); await expectNoSeriousA11y(page);
});
test('the feed comes in batches of 30 with an end', async ({ page }) => {
  await open(page, many(31), '#/feed');
  await expect(cards(page)).toHaveCount(30);
  await expect(page.locator('p.end')).toHaveText("That's 30. Stumble on or call it a day");
  await page.getByRole('button', { name: 'Stumble on' }).click();
  await expect(cards(page)).toHaveCount(31);
  await expect(page.locator('p.end').last()).toHaveText('You have seen everything we have right now. Turn on more sources in Settings, or try Fate.');
});
test('Newest first sorts the batch by date', async ({ page }) => {
  await open(page, many(3), '#/feed');
  await page.getByRole('radio', { name: 'Newest first' }).check();
  await expect(page.locator('ul.feed article.card h2')).toHaveText(['Site 2', 'Site 1', 'Site 0']);
});
test('Never this site removes the card, and More like this goes to Stumble', async ({ page }) => {
  await open(page, many(40), '#/feed'); await expect(cards(page)).toHaveCount(30);
  await cards(page).first().getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'Never this site' }).click(); await expect(cards(page)).toHaveCount(29);
  await cards(page).first().getByRole('button', { name: 'More like this' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Stumble' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Rabbit Hole' }).locator('li')).toHaveCount(2);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx playwright test -c tests/e2e/playwright.config.js tests/e2e/feed.spec.js`
Expected: FAIL: no `ul.feed` cards, because the Feed is still Plan 01's placeholder.

- [ ] **Step 3: Implement `feed.js`**

- [ ] **Step 4: Run it and see it pass, then run the whole suite**

Run: `npm run e2e -- tests/e2e/feed.spec.js`, then `npm run e2e`
Expected: PASS, 4 tests, then the whole suite passes.

- [ ] **Step 5: Commit**

```bash
git add src/ui/views/feed.js src/ui/views/index.js tests/e2e/feed.spec.js
git commit -m "Add the Feed with batches of 30"
```

### Task 26: Saved and Import

**Files:**
- Create: `src/ui/views/saved.js`, `src/ui/views/import.js`
- Modify: `src/ui/views/index.js` (import both)
- Test: `tests/e2e/saved-share.spec.js`

**Interfaces:**
- Consumes: `app.collections` (Task 8), `SHARE_BASE`, `buildShareUrl`, `decodeShare`, `shareItem`, `itemToFind`, `payloadFromLink` (Task 9), `toBookmarksHtml`, `fromBookmarksHtml` (Task 10), `renderCard`, `makeActionHandler`, `platform.share`, `platform.files`, `navigate`, `showToast`, `announce`, `makeFind`.
- Produces:
  - `registerView('saved', {title: 'Saved', render})`: one button per collection labelled `'<name> (<count>)'`; a **New collection** text field with a **Create** button; a **Paste a share link** text field with an **Import from link** button, on every platform (§14.3: the extension and Android open links by paste), which calls `navigate('import', {payload: payloadFromLink(text)})`, or shows and assertively announces `'This link is broken or not from Byways.'` when that gives `null`; for the chosen collection, an `h2` with its name, its finds as compact cards (actions through `makeActionHandler` with Task 23's Saved `advance`) each with a **Remove** button, and the buttons **Rename** (then a name field and **Save name**), **Delete** (not for Saved; asks `'Delete this collection?'` with **Delete** and **Keep**), **Save new finds here** (`setCurrent`; the current one shows `'New finds are saved here.'`), **Share collection**, **Export bookmarks** and **Import bookmarks**.
  - **Share collection**: `buildShareUrl(SHARE_BASE, {v: 1, t: 'c', n: name, i: items.map(x => shareItem(x.find))})`. When `tooLong`: `'This collection is too big for a link. Export a backup file in Settings → Data instead.'` Otherwise `platform.share({title: name, url})`, with the toast `'Link copied.'` on `'copied'`.
  - **Export bookmarks**: `platform.files.save('<collection id>.html', new Blob([toBookmarksHtml(col)], {type: 'text/html'}))`. **Import bookmarks**: `platform.files.pick('.html,text/html')`, then each `{url, title}` becomes `makeFind({source: 'import', kind: 'site', url, title, safety: 'mostly', why: ['Imported bookmark']})` in the chosen collection; toast `'Imported <n> bookmark(s).'` (`bookmark` for 1, else `bookmarks`).
  - `registerView('import', {title: 'Import', render})`: decodes `params.payload` (the router gives it for `#s=<payload>`, and **Import from link** passes it). A failed `decodeShare` shows `'This link is broken or not from Byways.'` (also announced assertively) and a **Go to Stumble** link. Otherwise: `h2 'Shared with you'`, `p.kind` = `'A collection: <n>'` (`t 'c'`), `'A find'` (`'f'`) or `'Daily Fate: <n>'` (`'d'`), a list of titles with domains, and an **Import** button. Import creates a collection named `n` for `'c'`, or uses Saved for `'f'` and `'d'`, adds every `itemToFind` result, toasts `'Imported <k> find(s) into <name>.'` and navigates to `saved`.

- [ ] **Step 1: Write the failing test**

```js
// same imports, `small` and `open` helper as stumble.spec.js, plus `buildShareUrl` and `SHARE_BASE` from '../../src/core/share.js'
test('a saved find shows up in Saved', async ({ page }) => {
  await open(page, [small[0]]); await page.getByRole('button', { name: 'Save' }).click();
  await page.goto('./#/saved'); await page.getByRole('button', { name: 'Saved (1)' }).click();
  await expect(page.locator('article.card h2')).toHaveText('Tiny Synth');
});
test('a new collection can become the current one', async ({ page }) => {
  await open(page, [small[0]]); await page.goto('./#/saved');
  await page.getByRole('textbox', { name: 'New collection' }).fill('Weird toys'); await page.getByRole('button', { name: 'Create' }).click();
  await page.getByRole('button', { name: 'Weird toys (0)' }).click(); await page.getByRole('button', { name: 'Save new finds here' }).click();
  await expect(page.getByText('New finds are saved here.')).toBeVisible();
  await page.goto('./#/stumble'); await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Saved to Weird toys.')).toBeVisible();
});
test('a shared collection link previews and imports', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await open(page, [small[0]]); await page.getByRole('button', { name: 'Save' }).click();
  await page.goto('./#/saved'); await page.getByRole('button', { name: 'Saved (1)' }).click();
  await page.getByRole('button', { name: 'Share collection' }).click(); await expect(page.getByText('Link copied.')).toBeVisible();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link.startsWith('https://iteatsthesalt.github.io/Game-Dev-Resources/byways/#s=')).toBe(true);
  await page.goto('./' + link.slice(link.indexOf('#')));
  await expect(page.getByRole('heading', { name: 'Shared with you' })).toBeVisible();
  await expect(page.locator('p.kind')).toHaveText('A collection: Saved');
  await page.getByRole('button', { name: 'Import', exact: true }).click(); await expect(page.getByText('Imported 1 find into Saved.')).toBeVisible();
});
test('Import from link opens a pasted Byways link and refuses others', async ({ page }) => {
  const { url } = await buildShareUrl(SHARE_BASE, { v: 1, t: 'f', n: '', i: [['library', 'https://example.org/', 'Moth Atlas']] });
  await open(page, [small[0]], '#/saved'); const field = page.getByRole('textbox', { name: 'Paste a share link' });
  await field.fill('https://example.com/#s=abc'); await page.getByRole('button', { name: 'Import from link' }).click();
  await expect(page.getByText('This link is broken or not from Byways.')).toBeVisible();
  await field.fill(url); await page.getByRole('button', { name: 'Import from link' }).click();
  await expect(page.getByRole('heading', { name: 'Shared with you' })).toBeVisible(); await expect(page.locator('p.kind')).toHaveText('A find');
});
test('axe finds no serious issues on Saved and Import', async ({ page }) => {
  await open(page, [small[0]]); await page.goto('./#/saved'); await expectNoSeriousA11y(page);
  await page.goto('./#s=notreal'); await expectNoSeriousA11y(page);
});
test('a broken share link shows a message', async ({ page }) => {
  await open(page, small, '#s=notreal');
  await expect(page.getByRole('heading', { level: 1, name: 'Import' })).toBeVisible();
  await expect(page.getByText('This link is broken or not from Byways.')).toBeVisible();
});
test('bookmarks export and import', async ({ page }) => {
  await open(page, [small[0]]); await page.goto('./#/saved'); await page.getByRole('button', { name: 'Saved (0)' }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export bookmarks' }).click()]);
  expect(download.suggestedFilename()).toBe('saved.html');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Import bookmarks' }).click()]);
  await chooser.setFiles({ name: 'b.html', mimeType: 'text/html', buffer: Buffer.from('<DT><A HREF="https://example.org/">Moths</A>') });
  await expect(page.getByText('Imported 1 bookmark.')).toBeVisible(); await expect(page.locator('article.card h2')).toHaveText('Moths');
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx playwright test -c tests/e2e/playwright.config.js tests/e2e/saved-share.spec.js`
Expected: FAIL: no button named `Saved (1)`.

- [ ] **Step 3: Implement `saved.js` and `import.js`**

- [ ] **Step 4: Run it and see it pass, then run the whole suite**

Run: `npm run e2e -- tests/e2e/saved-share.spec.js`, then `npm run e2e`
Expected: PASS, 7 tests, then the whole suite passes.

- [ ] **Step 5: Commit**

```bash
git add src/ui/views/saved.js src/ui/views/import.js src/ui/views/index.js tests/e2e/saved-share.spec.js
git commit -m "Add Saved with collections, sharing and bookmarks, and the share-link import"
```

### Task 27: Your taste settings and the interests step

**Files:**
- Create: `src/ui/views/settings/taste.js`
- Modify: `src/ui/views/index.js` (import `./settings/taste.js`), `tests/e2e/smoke.spec.js` and `tests/e2e/firstrun.spec.js` (Plan 01's specs, which meet the new step)
- Test: `tests/e2e/settings-taste.spec.js`

**Interfaces:**
- Consumes: `registerSettingsSection`, `registerFirstRunStep` (Plan 01), `app.data.tags`, `engine.taste`, `engine.setTaste` (Task 20), `applyReaction` (Task 3), `SOURCES` (Task 5).
- Produces:
  - `registerSettingsSection({id: 'taste', label: 'Your taste', order: 10, render})`, which lets every part of the §8.1 profile be edited: a range **Familiar ↔ Strange** (0–1, step 0.05) bound to `strangeness`; one `fieldset` per `tags.json` group (legend = group label) with a range per tag (−3 to 3, step 0.5, label = tag label) bound to `tags[id]`; a `fieldset` **Sources** with a range per `SOURCES` adapter (−3 to 3, step 0.5, label = adapter name) bound to `sources[id]`; a `fieldset` **Interests** with a checkbox per `INTEREST_TAGS` tag (label = tag label), checked when the tag is in `interests` (checking applies `applyReaction(taste, null, 'interest', {tag})`; unchecking only removes it from `interests`); **Hidden topics** listing each hidden tag's label with **Show again** (removes it from `hiddenTags` and sets its weight to −2), or `'No hidden topics.'`; **Blocked sites** listing each domain with **Unblock**, or `'No blocked sites.'`. Every change calls `engine.setTaste`.
  - `INTEREST_TAGS = ['science','programming','diy','hardware','web','space','nature','art','design','photography','music','books','film','comics','history','oldweb','food','travel','education','health','retro','indie','puzzle','toy','adventure']` (25).
  - `registerFirstRunStep({id: 'interests', order: 20, render(container, app, done)})`: an `h1` `'What are you into?'` (first-run steps have no router heading), the text `'Pick a few topics. You can change them later in Settings → Your taste.'`, a checkbox per interest grouped by its `tags.json` group, and **Done**, which applies `applyReaction(taste, null, 'interest', {tag})` for each pick, calls `engine.setTaste` and then `done()`.
  - Plan 01's specs: in `smoke.spec.js`, and in the first test of `firstrun.spec.js`, call `skipFirstRun(page)` (from `./helpers/app.js`) right after the **Continue** click, because Welcome is now followed by this step. The second test of `firstrun.spec.js` is left as Plan 01 wrote it: its steps (orders 12, 15 and 18) already sort before `interests` (20), and Plan 01 owns how that test gets past the steps after **Finish b**.

- [ ] **Step 1: Write the failing test**

```js
// same imports, `small` and `open` helper as stumble.spec.js
test('axe finds no serious issues on Your taste', async ({ page }) => {
  await open(page, small); await page.goto('./#/settings/taste'); await expectNoSeriousA11y(page);
});
test('first run offers 25 interests and saves the picks', async ({ page }) => {
  await stageLibrary(page, small); await page.goto('./#/stumble');
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page.getByRole('heading', { name: 'What are you into?' })).toBeVisible(); await expectNoSeriousA11y(page);
  await expect(page.getByRole('checkbox')).toHaveCount(25);
  await page.getByRole('checkbox', { name: 'Space' }).check(); await page.getByRole('checkbox', { name: 'Retro' }).check();
  await page.getByRole('button', { name: 'Done' }).click(); await skipFirstRun(page);
  await page.goto('./#/settings/taste');
  await expect(page.getByRole('slider', { name: 'Space' })).toHaveValue('2');
  await expect(page.getByRole('slider', { name: 'Retro' })).toHaveValue('2');
  await expect(page.getByRole('group', { name: 'Interests' }).getByRole('checkbox', { name: 'Space' })).toBeChecked();
});
test('Familiar ↔ Strange on Stumble is the one in Your taste, and is saved', async ({ page }) => {
  await open(page, small); await page.getByRole('slider', { name: 'Familiar ↔ Strange' }).fill('0.5');
  await page.goto('./#/settings/taste'); const range = page.getByRole('slider', { name: 'Familiar ↔ Strange' });
  await expect(range).toHaveValue('0.5'); await range.fill('1');
  await page.reload(); await expect(range).toHaveValue('1');
});
test('every source has a weight', async ({ page }) => {
  await open(page, small, '#/settings/taste');
  const sources = page.getByRole('group', { name: 'Sources' });
  await expect(sources.getByRole('slider', { name: 'Wikipedia' })).toHaveValue('0');
  await sources.getByRole('slider', { name: 'Wikipedia' }).fill('-1.5');
  await page.reload(); await expect(sources.getByRole('slider', { name: 'Wikipedia' })).toHaveValue('-1.5');
});
test('a blocked site can be unblocked', async ({ page }) => {
  await open(page, [small[0]]); await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'Never this site' }).click();
  await page.goto('./#/settings/taste'); await page.getByRole('button', { name: 'Unblock' }).click();
  await expect(page.getByText('No blocked sites.')).toBeVisible();
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx playwright test -c tests/e2e/playwright.config.js tests/e2e/settings-taste.spec.js`
Expected: FAIL: the heading `What are you into?` never shows.

- [ ] **Step 3: Implement `settings/taste.js` and update Plan 01's two specs**

- [ ] **Step 4: Run it and see it pass, then run the whole suite**

Run: `npm run e2e -- tests/e2e/settings-taste.spec.js tests/e2e/firstrun.spec.js tests/e2e/smoke.spec.js`, then `npm run e2e`
Expected: PASS, 9 tests, then the whole suite passes.

- [ ] **Step 5: Commit**

```bash
git add src/ui/views/settings/taste.js src/ui/views/index.js tests/e2e/settings-taste.spec.js tests/e2e/firstrun.spec.js tests/e2e/smoke.spec.js
git commit -m "Add Your taste settings and the first-run interests step"
```

### Task 28: Sources settings and keys

**Files:**
- Create: `src/ui/views/settings/sources.js`
- Modify: `src/ui/views/index.js` (import it)
- Test: `tests/e2e/settings-sources.spec.js`

**Interfaces:**
- Consumes: `registerSettingsSection`, `app.saveSettings`, `app.getSettings`, `app.store`, `app.secrets` (Task 22), `SOURCES` (Task 5), `showToast`, `announce`. Probe results are read from `health['probe:<platform.name>']`.
- Produces: `registerSettingsSection({id: 'sources', label: 'Sources', order: 20, render})`:
  - Checkboxes **Family filter** (`familyFilter`, hint `'Keeps mixed sources out of Fate and lean-back.'`) and **Check links before showing** (`checkLinks`, hint `'This contacts each site before it is shown.'`).
  - One row per `SOURCES` adapter, carrying `data-source="<id>"`: a checkbox `'Use <name>'` (checked when `settings.sources[id]?.enabled ?? key !== 'required'`), for `fate: true` adapters a select `'Fate weight for <name>'` with options 0–3 (default 1), and a `.status` line: `'Not reachable from the web app. It works in the extension and the Android app.'` for a probe-tier source whose stored probe result is not `'ok'` on `pwa`, or `'Needs a key.'` for a `required` key with no secret in `app.secrets`. Changes save to `settings.sources[id]`.
  - A **Keys** group of password fields, each in an element carrying `data-key="<secret id>"` (Plan 05's key rows use the same attribute) with **Save** and **Delete**: **Europeana key** (`src:europeana`), **Openverse client ID** and **Openverse client secret** (one **Save** stores the JSON `{clientId, clientSecret}` in `src:openverse`), **api.data.gov key (APOD and Smithsonian)** (`src:datagov`), **Marginalia key** (`src:marginalia`) and **GitHub token (read-only)** (`src:github`). Every read and write goes through `app.secrets`. A saved field is cleared and shows `'Saved on this device.'`; a stored key is never put back in a field, which shows `'A key is saved.'` instead. Saving the Europeana, Openverse or api.data.gov key also sets `enabled: true` for `europeana`, `openverse` or `smithsonian`. **Delete** shows `'Deleted.'`

- [ ] **Step 1: Write the failing test**

```js
// same imports, `small` and `open` helper as stumble.spec.js
test('axe finds no serious issues on Sources', async ({ page }) => {
  await open(page, small, '#/settings/sources'); await expectNoSeriousA11y(page);
});
test('a source that is off gets no requests', async ({ page }) => {
  await open(page, small); await page.goto('./#/settings/sources');
  await page.getByRole('checkbox', { name: 'Use Wikipedia' }).uncheck();
  const hits = []; page.on('request', (r) => { if (/en\.wikipedia\.org\/(api\/rest_v1\/page\/random|w\/api\.php)/.test(r.url())) hits.push(r.url()); });
  const refill = page.waitForRequest(/api\.inaturalist\.org/);
  await page.goto('./#/stumble'); await page.getByRole('button', { name: 'Next' }).click(); await refill;
  expect(hits).toEqual([]);
  await page.goto('./#/settings/sources'); await expect(page.getByRole('checkbox', { name: 'Use Wikipedia' })).not.toBeChecked();
});
test('the link check note, the probe note and a key that turns Europeana on', async ({ page }) => {
  await open(page, small); await page.goto('./#/settings/sources');
  await expect(page.getByText('This contacts each site before it is shown.')).toBeVisible();
  await expect(page.locator('[data-source="met"] .status')).toHaveText('Not reachable from the web app. It works in the extension and the Android app.');
  await page.getByLabel('Europeana key').fill('EUKEY'); await page.locator('[data-key="src:europeana"]').getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('[data-key="src:europeana"]')).toContainText('Saved on this device.');
  await expect(page.getByLabel('Europeana key')).toHaveValue('');
  await expect(page.getByRole('checkbox', { name: 'Use Europeana' })).toBeChecked();
});
test('Fate weights of 0 leave the starter library as the only Fate source', async ({ page }) => {
  await open(page, small); await page.goto('./#/settings/sources');
  for (const weight of await page.getByLabel(/^Fate weight for (?!Starter library)/).all()) await weight.selectOption('0');
  await page.goto('./#/stumble'); await page.getByRole('radio', { name: 'Fate' }).check();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.locator('article.card .why')).toHaveText('Fate · pure random · Starter library');
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx playwright test -c tests/e2e/playwright.config.js tests/e2e/settings-sources.spec.js`
Expected: FAIL: no checkbox named `Use Wikipedia`.

- [ ] **Step 3: Implement `settings/sources.js`**

- [ ] **Step 4: Run it and see it pass, then run the whole suite**

Run: `npm run e2e -- tests/e2e/settings-sources.spec.js`, then `npm run e2e`
Expected: PASS, 4 tests, then the whole suite passes.

- [ ] **Step 5: Commit**

```bash
git add src/ui/views/settings/sources.js src/ui/views/index.js tests/e2e/settings-sources.spec.js
git commit -m "Add the Sources settings with source keys and Fate weights"
```

### Task 29: Data settings

**Files:**
- Create: `src/ui/views/settings/data.js`
- Modify: `src/ui/views/index.js` (import it)
- Test: `tests/e2e/settings-data.spec.js`

**Interfaces:**
- Consumes: `registerSettingsSection`, `app.store`, `app.seen`, `app.clock`, `app.secrets`, `app.history.reload` (Task 2), `app.engine.reload` (Task 20), `platform.files`, `exportBackup`, `importBackup`, `backupFileName` (Task 10), `showToast`, `announce`.
- Produces: `registerSettingsSection({id: 'data', label: 'Data', order: 60, render})`: `'You have seen <n> find(s).'`; an **Include keys** checkbox that shows `'Anyone who gets this file can use your keys.'`; **Export backup** (`platform.files.save(backupFileName(clock, includeKeys), <JSON Blob of exportBackup(store, {includeKeys, app: platform.name, clock, secrets: app.secrets})>)`); **Import backup** (`platform.files.pick('.json,application/json')`, then `importBackup(store, data, {secrets: app.secrets})`, then `await app.history.reload()` and `await app.engine.reload()` so the running app uses what was written, then the toast `'Imported <c> collection(s) and <s> seen find(s).'`; any failure shows and assertively announces `'This is not a Byways backup file.'`); **Reset seen**, which asks `'Forget every find you have seen? You may see them again.'` with **Reset** and **Cancel**, then calls `seen.reset()` and toasts `'Seen list cleared.'`

- [ ] **Step 1: Write the failing test**

```js
// same imports, `small` and `open` helper as stumble.spec.js
test('axe finds no serious issues on Data', async ({ page }) => {
  await open(page, small, '#/settings/data'); await expectNoSeriousA11y(page);
});
test('export, reset and import a backup', async ({ page }) => {
  await open(page, [small[0]]); await page.goto('./#/settings/data');
  await expect(page.getByText('You have seen 1 find.')).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export backup' }).click()]);
  expect(download.suggestedFilename()).toMatch(/^byways-backup-\d{4}-\d{2}-\d{2}\.json$/);
  await page.getByRole('button', { name: 'Reset seen' }).click(); await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByText('You have seen 0 finds.')).toBeVisible();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Import backup' }).click()]);
  await chooser.setFiles(await download.path());
  await expect(page.getByText('Imported 0 collections and 1 seen find.')).toBeVisible();
});
test('a wrong file and the keys warning', async ({ page }) => {
  await open(page, small); await page.goto('./#/settings/data');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Import backup' }).click()]);
  await chooser.setFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
  await expect(page.getByText('This is not a Byways backup file.')).toBeVisible();
  await page.getByRole('checkbox', { name: 'Include keys' }).check();
  await expect(page.getByText('Anyone who gets this file can use your keys.')).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export backup' }).click()]);
  expect(download.suggestedFilename()).toMatch(/-with-keys\.json$/);
});
test('an imported taste shows in Your taste', async ({ page }) => {
  await open(page, small, '#/settings/data');
  const file = { format: 'byways-backup', v: 1, exportedAt: '2026-11-11T12:00:00.000Z', app: 'pwa', settings: {}, collections: [], history: [], seen: [],
    taste: { v: 1, tags: { space: 2 }, sources: {}, hiddenTags: [], blockedDomains: [], strangeness: 0.25, interests: [], reactions: 3 } };
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Import backup' }).click()]);
  await chooser.setFiles({ name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
  await expect(page.getByText('Imported 0 collections and 0 seen finds.')).toBeVisible();
  await page.goto('./#/settings/taste'); await expect(page.getByRole('slider', { name: 'Space' })).toHaveValue('2');
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx playwright test -c tests/e2e/playwright.config.js tests/e2e/settings-data.spec.js`
Expected: FAIL: no button named `Export backup`.

- [ ] **Step 3: Implement `settings/data.js`**

- [ ] **Step 4: Run it and see it pass, then run the whole suite**

Run: `npm run e2e -- tests/e2e/settings-data.spec.js`, then `npm run e2e`
Expected: PASS, 4 tests, then the whole suite passes.

- [ ] **Step 5: Commit**

```bash
git add src/ui/views/settings/data.js src/ui/views/index.js tests/e2e/settings-data.spec.js
git commit -m "Add the Data settings with backup export, import and reset"
```

### Task 30: Settings → Privacy

**Files:**
- Create: `src/ui/views/settings/privacy.js`
- Modify: `src/ui/views/index.js` (import it)
- Test: `tests/e2e/settings-privacy.spec.js`

**Interfaces:**
- Consumes: `registerSettingsSection`, `h`, `app.platform.name`.
- Produces: `registerSettingsSection({id: 'privacy', label: 'Privacy', order: 70, render})`, holding the whole Privacy text (overview: Plan 02 owns it and no other plan edits it), in this order:
  - A `table` with the caption `What goes over the network, and when`, the column headers **When** and **To**, and the seven §15.1 rows: `You stumble or browse` → `Only the enabled sources (Settings → Sources) and the site you open`; `Link check (if on)` → `The find's site, before it is shown`; `AI Search or AI team` → `Only the providers you set up, with your query, your tags and recent domains`; `Cloud voice (only if you opted in)` → `Google, Apple or Microsoft, depending on your browser`; `Vault play` → `archive.org`; `Daily data` → `The Byways Pages site (static files)`; `Android update check` → `api.github.com`.
  - The line `Nothing goes to a Byways server, because there is none. There are no analytics.`
  - Voice (§6.2): `Voice commands are recognised on this device when it can do that. Otherwise they need a cloud service from Google, Apple or Microsoft, and Byways asks you first, naming the company.`
  - Keys (§12.8), a list of three items: `Your keys stay on this device and are sent only to their own provider.`, `Use spend-limited keys.` and `Restrict your Gemini key to the Generative Language API.`
  - On `pwa` only, three paragraphs about the shared web address (§12.8, §15.2, §11.2): `Every iteatsthesalt.github.io project shares one origin. A custom domain would isolate Byways.`; `The browser remembers a microphone grant per origin, so allowing the microphone for Byways allows it for every page on iteatsthesalt.github.io.`; and the Lab limit, `The Lab shares this web address with the rest of Byways. Without the passphrase lock, code running in the Lab could read your stored keys. The Lab runs only pinned emulators that ship with Byways, and Flash script access is off.` (the sentence Plan 06's test looks for).

- [ ] **Step 1: Write the failing test**

```js
// same imports, `small` and `open` helper as stumble.spec.js
test('Privacy lists every network use and the privacy notes', async ({ page }) => {
  await open(page, small, '#/settings/privacy');
  const rows = [['You stumble or browse', 'Only the enabled sources (Settings → Sources) and the site you open'],
    ['Link check (if on)', "The find's site, before it is shown"],
    ['AI Search or AI team', 'Only the providers you set up, with your query, your tags and recent domains'],
    ['Cloud voice (only if you opted in)', 'Google, Apple or Microsoft, depending on your browser'], ['Vault play', 'archive.org'],
    ['Daily data', 'The Byways Pages site (static files)'], ['Android update check', 'api.github.com']];
  for (const [when, to] of rows) await expect(page.getByRole('row', { name: `${when} ${to}` })).toBeVisible();
  for (const text of ['Nothing goes to a Byways server, because there is none. There are no analytics.', 'Use spend-limited keys.',
    'Restrict your Gemini key to the Generative Language API.', 'Every iteatsthesalt.github.io project shares one origin. A custom domain would isolate Byways.'])
    await expect(page.getByText(text, { exact: true })).toBeVisible();
  await expect(page.getByText(/microphone grant per origin/)).toBeVisible();
  await expect(page.getByText(/^The Lab shares this web address with the rest of Byways\./)).toBeVisible();
  await expectNoSeriousA11y(page);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx playwright test -c tests/e2e/playwright.config.js tests/e2e/settings-privacy.spec.js`
Expected: FAIL: no row named `You stumble or browse Only the enabled sources (Settings → Sources) and the site you open`.

- [ ] **Step 3: Implement `settings/privacy.js`**

- [ ] **Step 4: Run it and see it pass, then run the whole suite**

Run: `npm run e2e -- tests/e2e/settings-privacy.spec.js`, then `npm run e2e`
Expected: PASS, 1 test, then the whole suite passes.

- [ ] **Step 5: Commit**

```bash
git add src/ui/views/settings/privacy.js src/ui/views/index.js tests/e2e/settings-privacy.spec.js
git commit -m "Add the Privacy settings with the network table and the privacy notes"
```

### Task 31: Curate the starter library

**Files:**
- Modify: `src/data/library.json` (Plan 01's empty stub)
- Test: `tests/unit/library-data.test.js`

**Interfaces:**
- Consumes: `src/data/tags.json` (Task 3), `normalizeUrl`, `domainOf`, `utcDate`.
- Produces: `src/data/library.json` in the overview shape, used by the `library` adapter (Task 19) and by Plan 04's Daily Fate backup and link check.

**How to curate.** Use WebSearch to find about 300 small sites, toys, indie web games, tools and old-web classics. Do not fetch the sites from this machine (most content hosts are blocked); the daily link check in CI (Plan 04) catches dead links. Every entry must meet the §5.7 rules: "personal sites, no ads or undisclosed affiliate links, no pop-ups, small creators, recently active, and no AI content farms". Game Jolt and Newgrounds games may appear here as entries, because they have no adapter. Write each `blurb` in your own words, one or two plain sentences. Use the plain page URL with no tracking parameters. Set `added` to the day you add the entry. Number ids from `lib-0001` with no gaps.

- [ ] **Step 1: Write the failing test**

```js
const lib = JSON.parse(readFileSync('src/data/library.json', 'utf8'));
const tagIds = new Set(JSON.parse(readFileSync('src/data/tags.json', 'utf8')).groups.flatMap(g => g.tags.map(t => t.id)));
test('library.json has the shape and at least 300 entries', () => {
  assert.equal(lib.v, 1); assert.ok(lib.entries.length >= 300, `only ${lib.entries.length}`);
  lib.entries.forEach((e, i) => {
    assert.equal(e.id, `lib-${String(i + 1).padStart(4, '0')}`);
    assert.ok(e.title.trim() && e.title.length <= 200, e.id); assert.ok(e.blurb.trim() && e.blurb.length <= 400, e.id);
    assert.ok(['site', 'game', 'toy', 'tool', 'article'].includes(e.kind), e.id);
    assert.match(e.added, /^\d{4}-\d{2}-\d{2}$/); assert.ok(e.added <= utcDate(Date.now()), e.id);
  });
});
test('every url is https, untracked and unique once normalised', () => {
  const seen = new Set();
  for (const e of lib.entries) {
    assert.ok(e.url.startsWith('https://'), e.id); assert.doesNotMatch(e.url, /[?&](utm_|fbclid|gclid|ref=)/, e.id);
    const n = normalizeUrl(e.url); assert.ok(n && !seen.has(n), `${e.id} duplicates ${n}`); seen.add(n);
  }
});
test('every tag is in tags.json', () => {
  for (const e of lib.entries) { assert.ok(e.tags.length >= 1 && e.tags.length <= 5, e.id); for (const t of e.tags) assert.ok(tagIds.has(t), `${e.id}: ${t}`); }
});
test('at least 80 games or toys, and no domain more than 3 times', () => {
  assert.ok(lib.entries.filter(e => e.kind === 'game' || e.kind === 'toy').length >= 80);
  const per = {}; for (const e of lib.entries) per[domainOf(e.url)] = (per[domainOf(e.url)] ?? 0) + 1;
  for (const [d, n] of Object.entries(per)) assert.ok(n <= 3, `${d} appears ${n} times`);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/unit/library-data.test.js`
Expected: FAIL with `only 0` (Plan 01's stub has no entries).

- [ ] **Step 3: Curate the entries into `src/data/library.json`**

Work in batches of about 50 and run the test after each batch to catch duplicates and bad tags early.

- [ ] **Step 4: Run the test and the full unit suite**

Run: `node --test tests/unit/library-data.test.js`, then `npm test`
Expected: PASS, 4 tests, and `npm test` green, including Plan 01's `--check` data-shape check.

- [ ] **Step 5: Commit**

```bash
git add src/data/library.json tests/unit/library-data.test.js
git commit -m "Add the starter library of about 300 hand-picked finds"
```
