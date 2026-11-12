# Byways 02: Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build everything that finds, picks, remembers and shows a find: the Find model, the never-twice seen-set, Back history, taste and Tuned picking, Fate, Rabbit Hole, collections, share links, backup, the free source adapters with their probe, the engine, and the Stumble, Feed, Saved, Import and Settings (taste, sources, data) screens, plus the first-run interests step and the starter library.

**Architecture:** Pure core modules in `src/core/` (no DOM) hold the state and the rules. Each source is one adapter file that turns a recorded HTTP response into `Find` objects through `makeFind`. `createEngine` owns the candidate pool, the injected queue (search now, AI in Plan 05), the seen-set, history, taste and reactions. The UI calls only the engine and the small stores the engine exposes. Plan 04 adds the Archive sources (`ia`, `vault`, `oldweb`, `itch`) by registering adapters in `sources/index.js`; the engine has no Archive code.

**Tech Stack:** JavaScript ES2022 modules, no framework or bundler. `node:test` for unit tests, `@playwright/test@1.63.0` (Chromium) for end-to-end tests. `CompressionStream('deflate-raw')` for share links. Everything from Plan 01: `createHttp`, `openStore`/`memoryBackend`, `createCache`, `fakeClock`, `hash64`, `gumbel`, `mulberry32`, `normalizeUrl`, `domainOf`, `siteOrigin`, `isHttpUrl`, `toPlainText`, `truncate`, `tokenize`, `utcDate`, `h`, `clear`, `announce`, `showToast`, `registerView`, `registerSettingsSection`, `registerFirstRunStep`, `mockNet`, `installFakeSpeech`.

**Spec:** `docs/superpowers/specs/2026-11-11-byways-design.md` (§5, §7, §8, §9.1, §14.1–§14.3, §15.1). Contract: `docs/superpowers/plans/2026-11-11-byways-00-overview.md`. Research: `docs/superpowers/specs/byways-research/free-sources.md`, `landscape.md`, `critic.md`.

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
- **Family filter:** "on by default and keeps `mixed` sources out of Fate and lean-back"; §8.3 applies it to every pick.
- **Headers:** `Api-User-Agent` (Wikimedia) and `AIC-User-Agent` (Art Institute) set to `Byways/<version> (+https://github.com/iteatsthesalt/Game-Dev-Resources)`, never with user details.
- **Rates (§7.3):** iNaturalist and Open Library 1 request per second; Art Institute 60 per minute; GitHub search 10 per minute; Wikimedia about 10 per minute; Library of Congress 10 per minute ("an HTML/CAPTCHA reply counts as a failure"); APOD by key tier with a local daily counter.
- **Caching (§7.3):** "24 h for searches, 7 days for item details, and a week for the Kagi lists"; GitHub results at least 1 hour.
- **Network (§15.1):** stumbling contacts "Only the enabled sources (§7.2) and the site you open"; the link check contacts "The find's site, before it is shown", and only when **Check links before showing** is on.
- **Styles:** the CSP is `style-src 'self'`, so UI code sets dynamic styles only through CSSOM (`el.style.setProperty`), never a `style` attribute.

## Review Focus

1. **Hostile text and links in source data.** An Artist field holding `<a href="javascript:…">`, an HN `story_text` with `<script>`, or a `data:` image URL must show as plain text and the bad link or image must be dropped. Pinned by `makeFind drops non-http image urls` (Task 1), `commons turns extmetadata HTML into plain text` (Task 12) and the e2e `card shows markup as plain text` (Task 22).
2. **Double presses.** Pressing Next (or Space, or saying "next") twice fast must give two different finds and add each to the seen-set once. Pinned by `two concurrent next calls return different finds` (Task 20).
3. **Offline versus used up.** With the network down, Stumble must say it can't reach the sources, not that you have seen everything, and must never hang. Pinned by `every source failing gives the unreachable message` (Task 20).
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
| `src/core/share.js` | Share-link codec, `SHARE_BASE`, `MAX_LINK_CHARS` |
| `src/core/backup.js` | Backup export/import, bookmarks HTML |
| `src/core/liveness.js` | `checkLive` |
| `src/core/sources/index.js` | `SOURCES`, `getSource`, `enabledSources`, `IDENT` |
| `src/core/sources/probe.js` | `probeSource`, `runProbes` |
| `src/core/sources/<id>.js` | 21 adapters: wikipedia, commons, inat, openlibrary, apod, marginalia, github, hn, aic, met, cleveland, nasaimages, loc, smithsonian, europeana, openverse, kagi, kagirandom, wiby, library |
| `src/core/engine.js` | `createEngine`: pool, queue, modes, reactions, Rabbit Hole, feed, search |
| `src/data/library.json` | About 300 curated starter finds |
| `src/ui/components/card.js` | `renderCard` with every action |
| `src/ui/components/generated-image.js` | `generatedImage`: initial, hue from `hash64`, source badge |
| `src/ui/views/stumble.js` | Stumble view, modes, search, Back, Rabbit Hole UI, Wiby leap |
| `src/ui/views/feed.js` | Feed batches of 30 |
| `src/ui/views/saved.js` | Collections, share, bookmarks |
| `src/ui/views/import.js` | `#s=` preview and **Import** |
| `src/ui/views/settings/taste.js` | Your taste section and the first-run interests step |
| `src/ui/views/settings/sources.js` | Sources section and source keys |
| `src/ui/views/settings/data.js` | Backup export/import, reset seen |
| `src/ui/boot.js` (modify) | Creates `seen`, `history`, `collections`, `engine`, `search` |
| `src/ui/views/index.js` (modify) | Imports this plan's views and settings sections |
| `tests/unit/helpers/fixture-http.js` | `adapterCtx`: a real `createHttp` over recorded fixtures |
| `tests/fixtures/http/<source>/*.json\|.txt` | Hand-written responses in the documented shapes |
| `tests/fixtures/routes.js` (modify) | One route per fixture |
| `tests/e2e/helpers/net.js` (modify) | `stageLibrary(page, entries)` |
| `tests/e2e/helpers/fakes.js` (modify) | `skipFirstRun(page)` |
| `tests/fixtures/http/library/small.json` | Three-entry library for e2e |

**Adapter conventions (every `sources/<id>.js`).** Each file default-exports one adapter in the contract shape. Methods a source does not support return `[]`. Network failures propagate as `NetError` (the engine skips that source silently). Every find is built with `makeFind`, with `source: id`, the adapter's base tags (Task 5 table) and a first `why` chip naming the pool, for example `'Wikipedia: random article'`. Every request goes through `ctx.http` with `source: id`. Search responses are cached in `ctx.cache` for 24 h and item details for 7 days, keyed by the request URL.

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
- Consumes: `openStore(backend)`, `memoryBackend()` (store/db.js), `hash64`, `normalizeUrl`, `domainOf`, `makeFind` (Task 1).
- Produces: `createSeen(store) → {has(url) → Promise<boolean>, add(url) → Promise<void>, count() → Promise<number>, reset() → Promise<void>}`; values are `{t: <ms>}` under key `hash64(normalizeUrl(url))` in the `seen` store. `createHistory(store, {max=50}) → {ready: Promise<void>, push(find), back() → Find|null, forward() → Find|null, current() → Find|null, list() → Find[], recentDomains(n) → string[]}`; it persists `{items, cursor}` under key `'trail'` in the `history` store.

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
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `node --test tests/unit/seen.test.js tests/unit/history.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement `createSeen` and `createHistory`**

`push` drops entries after the cursor, appends, trims the oldest beyond `max`, moves the cursor to the end and writes to the store without awaiting (writes are chained so they land in order). `recentDomains(n)` reads the last `n` entries up to the cursor, newest first, unique.

- [ ] **Step 4: Run them and see them pass**

Run: `node --test tests/unit/seen.test.js tests/unit/history.test.js`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/seen.js src/core/history.js tests/unit/seen.test.js tests/unit/history.test.js
git commit -m "Add the seen-set and the Back history"
```

### Task 3: Tag vocabulary and taste

**Files:**
- Create (or replace Plan 01's stub): `src/data/tags.json`
- Create: `src/core/taste.js`
- Test: `tests/unit/tags-data.test.js`, `tests/unit/taste.test.js`

**Interfaces:**
- Consumes: `domainOf(u)`.
- Produces: `src/data/tags.json` in the overview shape; `DEFAULT_TASTE`; `applyReaction(taste, find, reaction, extra?) → {taste, change}` (pure, never mutates its input); `describeChange(change) → string`. `extra` is `{tag}` for `interest` and `lessTopic` (default `find.tags[0]`), and `{blockDomain: true}` for `broken`.

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
test('weights cap at +3', () => {
  const { taste, change } = applyReaction({ ...DEFAULT_TASTE, tags: { retro: 3 } }, find, 'save');
  assert.equal(taste.tags.retro, 3); assert.equal(change.tagDeltas.retro, 0);
});
test('not for me takes 0.5 per tag and 0.25 from the source', () => {
  const { taste } = applyReaction(DEFAULT_TASTE, find, 'dislike');
  assert.deepEqual(taste.tags, { retro: -0.5, indie: -0.5 }); assert.deepEqual(taste.sources, { library: -0.25 });
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
```

- [ ] **Step 2: Run them and see them fail**

Run: `node --test tests/unit/tags-data.test.js tests/unit/taste.test.js`
Expected: FAIL (`ENOENT` or a wrong tag count for `tags.json`, `ERR_MODULE_NOT_FOUND` for `taste.js`).

- [ ] **Step 3: Write `tags.json` from the table and implement `taste.js`**

`like`, `dislike`, `save`, `lessTopic` and `neverSite` add 1 to `reactions`; `interest` and `broken` do not. `describeChange` checks `blocked`, then `hidden`, then tag deltas (positive ones before negative), then `sourceDelta`; a tag id is written with hyphens as spaces, and a hidden tag starts with a capital letter. Zero deltas are left out of the wording.

- [ ] **Step 4: Run them and see them pass**

Run: `node --test tests/unit/tags-data.test.js tests/unit/taste.test.js`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/data/tags.json src/core/taste.js tests/unit/tags-data.test.js tests/unit/taste.test.js
git commit -m "Add the tag vocabulary and taste reactions"
```

<!-- PLAN CONTINUES -->
