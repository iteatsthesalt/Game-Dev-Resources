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
| `src/core/sources/<id>.js` | 20 adapters: wikipedia, commons, inat, openlibrary, apod, marginalia, github, hn, aic, met, cleveland, nasaimages, loc, smithsonian, europeana, openverse, kagi, kagirandom, wiby, library |
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

**Adapter conventions (every `sources/<id>.js`).** Each file default-exports one adapter in the contract shape and is added to `ADAPTERS` in `sources/index.js` in the same task. Its fixtures live in `tests/fixtures/http/<id>/`, and `tests/fixtures/routes.js` gets one route per endpoint pattern it calls, including its `probeUrl`, so that the e2e `mockNet` covers every request the app makes. Methods a source does not support return `[]`. Network failures propagate as `NetError` (the engine skips that source silently). Every find is built with `makeFind`, with `source: id`, the adapter's base tags (Task 5 table) and a first `why` chip naming the pool, for example `'Wikipedia: random article'`. Every request goes through `ctx.http` with `source: id`. Search responses are cached in `ctx.cache` for 24 h and item details for 7 days, keyed by the request URL.

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
- Modify: `tests/fixtures/routes.js` (append the two probe routes: `/probe-ok\.example\//` → `probe/ok.json`, `/probe-html\.example\//` → `probe/captcha.html` with `content-type: text/html`)
- Test: `tests/unit/sources-index.test.js`, `tests/unit/probe.test.js`

**Interfaces:**
- Consumes: `createHttp({transport, clock})`, `createCache(store, clock)`, `openStore`, `memoryBackend`, `fakeClock(start)`, `mulberry32(seed)`, `DEFAULT_SETTINGS`, the `routes` array from `tests/fixtures/routes.js`.
- Produces:
  - `IDENT = 'Byways/1.0 (+https://github.com/iteatsthesalt/Game-Dev-Resources)'`, the value of `Api-User-Agent` and `AIC-User-Agent`. Adapters read it inside functions only (the index imports the adapters, so a top-level read would hit the import cycle).
  - `SOURCES` (id → adapter, in the order of an `ADAPTERS` array that each adapter task extends with one import), `getSource(id) → Adapter|undefined`.
  - `enabledSources(settings, probe, platformName, all = Object.values(SOURCES)) → Adapter[]`. A source is in when `settings.sources[id]?.enabled` is `true`, or is absent and the adapter's `key` is not `'required'`. On `'pwa'`, a `probe` tier source also needs `probe[id] === 'ok'`, and `privileged` and `navigate` tiers are out.
  - `probeSource(adapter, http) → Promise<'ok'|'fail'>`: no `probeUrl` gives `'ok'`; otherwise `'ok'` only when `http.getJson(probeUrl, {source: id, timeoutMs: 8000})` resolves.
  - `runProbes(adapters, http, store, clock, platformName = 'pwa') → Promise<Object<string,'ok'|'fail'>>`: reuses `health['probe:<platformName>'] = {at, results}` while it is under 24 h old and covers every adapter id.
  - Test kit: `adapterCtx({settings?, secrets?, data?, seed = 42, now = Date.UTC(2026, 10, 11, 12), extraRoutes = []}) → Promise<{ctx, calls, store}>`. Its transport matches `[...extraRoutes, ...routes]`, reads `tests/fixtures/http/<file>`, records `{url, method, headers, body}` in `calls` (headers as an object with lower-case names), and throws `TypeError('unmatched <url>')` for anything else. It registers every `SOURCES` adapter's `rate` with `http.register`. `ctx` has every contract field: `secrets` is an in-memory `SecretStore` seeded from `secrets`, and `data.tags` is read from `src/data/tags.json`.

**Adapter table.** Every adapter task builds its row exactly. Rate is `{perMinute, concurrent}`. Key ids are `SecretStore` ids.

| id | name | tier | key · keyName | safety | rate | fate | kinds | base tags |
|---|---|---|---|---|---|---|---|---|
| wikipedia | Wikipedia | open | none | mostly | 10·1 | yes | article | education |
| commons | Wikimedia Commons | open | none | mostly | 10·1 | no | image | photography |
| inat | iNaturalist | open | none | mostly | 60·1 | yes | image | nature |
| openlibrary | Open Library | open | none | mostly | 60·1 | no | book | books |
| apod | NASA APOD | open | demo · src:apidatagov | curated | 2·1 | yes | image, video | space, science |
| marginalia | Marginalia | open | optional · src:marginalia | mostly | 20·1 | no | site | web |
| github | GitHub | open | optional · src:github | mostly | 10·1 | no | project, game | indie, programming |
| hn | Show HN | probe | none | mostly | 60·2 | no | project, game | tech, indie |
| aic | Art Institute of Chicago | open | none | curated | 60·1 | yes | image | art |
| met | The Met | probe | none | curated | 60·2 | yes | image | art, history |
| cleveland | Cleveland Museum of Art | probe | none | curated | 60·1 | yes | image | art |
| nasaimages | NASA Images | probe | none | curated | 30·1 | no | image | space |
| loc | Library of Congress | probe | none | curated | 10·1 | no | image | history, photography |
| smithsonian | Smithsonian | probe | required · src:apidatagov | curated | 30·1 | yes | image | history |
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
  assert.deepEqual(ids(enabledSources({ sources: {} }, {}, 'pwa', all)), ['a']);
  assert.deepEqual(ids(enabledSources({ sources: {} }, { p: 'ok' }, 'pwa', all)), ['a', 'p']);
  assert.deepEqual(ids(enabledSources({ sources: {} }, {}, 'android', all)), ['a', 'p', 'v']);
  assert.deepEqual(ids(enabledSources({ sources: { a: { enabled: false }, k: { enabled: true } } }, {}, 'pwa', all)), ['k']);
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
test('probeSource needs a JSON reply', async () => {
  const { ctx } = await adapterCtx();
  assert.equal(await probeSource(ad('x', 'https://probe-ok.example/'), ctx.http), 'ok');
  assert.equal(await probeSource(ad('x', 'https://probe-html.example/'), ctx.http), 'fail');
  assert.equal(await probeSource(ad('x', 'https://nowhere.example/'), ctx.http), 'fail');
  assert.equal(await probeSource({ id: 'x' }, ctx.http), 'ok');
});
test('runProbes stores results and re-runs after 24 h', async () => {
  const { ctx, calls, store } = await adapterCtx();
  const list = [ad('x', 'https://probe-ok.example/'), ad('y', 'https://nowhere.example/')];
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

`ADAPTERS` starts empty. Probes for a list run in parallel. The kit's responses use `content-type: application/json` for `.json` files and `text/plain` for `.txt`, unless the route sets `headers`.

- [ ] **Step 4: Run them and see them pass**

Run: `node --test tests/unit/sources-index.test.js tests/unit/probe.test.js`
Expected: PASS, 4 tests.

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
- Produces: `fatePull({sources, weights, ctx, rand, seenHas, retries = 3}) → Promise<{find}|{miss: true, reason}>`. `seenHas` is async `(url) → Promise<boolean>`. Only sources with `fate: true` and weight above 0 count; a missing weight is 1. One pull makes at most `retries + 1` `random()` calls. A call that throws, returns `[]` or returns only seen finds is a miss; otherwise the first unseen find wins.
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
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/unit/fate.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement `fatePull`**

Each attempt draws `rand() * totalWeight` and walks the sources in order to pick one.

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/unit/fate.test.js`
Expected: PASS, 4 tests.

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
  - `createRabbitHole({sources, ctx, seenHas, pool}) → {start(find), next() → Promise<Find|null>, trail() → Find[], climbOut()}`. `sources` is `Adapter[]` or `() => Adapter[]`; `pool` is an optional `() => Find[]` of cached candidates; `seenHas` is async.
  - `next()` tries, in order: the last trail find's own source `more(last, ctx)`; Marginalia `more(last, ctx)` when `last.kind === 'site'`, Marginalia is in `sources` and is not the last find's source; then `similarLocal(last, pool(), 10)`. The first candidate that is not in the trail (by normalised URL) and not seen is pushed onto the trail and returned. A `more` call that throws counts as `[]`. An empty trail gives `null`.

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
test('climbOut empties the trail', async () => {
  const hole = createRabbitHole({ sources: [], ctx: {}, seenHas: never });
  hole.start(F('Start')); hole.climbOut();
  assert.deepEqual(hole.trail(), []); assert.equal(await hole.next(), null);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/unit/rabbit.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement `rabbit.js`**

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/unit/rabbit.test.js`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/rabbit.js tests/unit/rabbit.test.js
git commit -m "Add Rabbit Hole with source, Marginalia and local similarity"
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
- Produces: `MAX_LINK_CHARS = 2000`; `SHARE_BASE = 'https://iteatsthesalt.github.io/Game-Dev-Resources/byways/'`; `encodeShare(payload) → Promise<string>` (`base64url(deflate-raw(JSON))`, no `=` padding, no validation); `decodeShare(str) → Promise<payload>`, which throws `'This link is broken or not from Byways.'` unless the payload is `{v: 1, t: 'c'|'f'|'d', n: string, i: Array<[string, string, string]>}` with at most 500 items; `buildShareUrl(base, payload) → Promise<{url, tooLong}>` with `url = base + '#s=' + encoded` and `tooLong = url.length > MAX_LINK_CHARS`; `shareItem(find) → [find.source, find.url, truncate(find.title, 80)]`; `itemToFind([source, url, title]) → Find|null` (kind `'site'`, safety `'mostly'`, why `['Shared with you']`).

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
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/unit/share.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement `share.js`**

Use `new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'))` and the matching `DecompressionStream`; base64url maps `+/` to `-_` and strips `=`.

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/unit/share.test.js`
Expected: PASS, 4 tests.

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
  - `exportBackup(store, {includeKeys = false, app, clock, secrets}) → Promise<object>`: `{format: 'byways-backup', v: 1, exportedAt: ISO, app, settings, taste, collections, history, seen}`, plus `keys: {id: value}` only when `includeKeys`. `taste` is the `taste` store key `'taste'` (or `DEFAULT_TASTE`), `history` is the `'trail'` items, and `seen` is `[[hash, t], …]`.
  - `backupFileName(clock, includeKeys) → 'byways-backup-YYYY-MM-DD.json'` or `'byways-backup-YYYY-MM-DD-with-keys.json'`.
  - `importBackup(store, data, {secrets}) → Promise<{collections, seen, history, keys}>` (counts written). It throws `'This is not a Byways backup file.'` before writing anything unless `format === 'byways-backup'`, `v === 1` and `collections`, `history` and `seen` are arrays. Merge rules: seen hashes are unioned; a collection with a new id is added; one with the same id, name and item ids is skipped; any other clash is added as `<id>-copy` (then `-copy-2`, …) named `<name> (imported)`. Every imported item goes through `makeFind` and is dropped if it returns `null`. History is written only when the local trail is empty (last 50). Taste is written only when there is no local taste or it has `reactions === 0`. Keys are written only when `data.keys` exists.
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
- Produces: `checkLive(url, {transport, privileged = false, timeoutMs = 8000}) → Promise<boolean>`. Privileged: `HEAD url` with `privileged: true`; live when the status is below 400 or is 405. Not privileged: `HEAD siteOrigin(url) + '/'` with `mode: 'no-cors'` and `credentials: 'omit'`; live when the fetch resolves (opaque). A throw or the timeout means not live.

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
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/unit/liveness.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement `checkLive`** with an `AbortController` and `setTimeout(timeoutMs)`.

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/unit/liveness.test.js`
Expected: PASS, 3 tests.

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
- Produces: the `wikipedia` and `commons` adapters.
  - Wikipedia `random`: `GET https://en.wikipedia.org/api/rest_v1/page/random/summary` with `Api-User-Agent: IDENT`; `[]` when `type === 'disambiguation'`. Find: id `wiki:en:<titles.canonical>`, `description = extract`, `url = content_urls.desktop.page`, `imageUrl = thumbnail.source`, `licence 'CC BY-SA 4.0'`, `attribution 'Wikipedia'`, why `['Wikipedia: random article']`.
  - Wikipedia `search(q)` and `more(find)`: `GET https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=<q>&gsrlimit=10&prop=pageimages|extracts|info&inprop=url&piprop=thumbnail&pithumbsize=640&exintro=1&explaintext=1&exlimit=10&format=json&origin=*`; `more` sends `gsrsearch=morelike:<find.title>`. Pages are sorted by `index`; `url = fullurl`. Why `['Wikipedia search']` or `['Wikipedia: more like <title>']`.
  - Commons `random`: today's picture of the day from `GET https://en.wikipedia.org/api/rest_v1/feed/featured/YYYY/MM/DD` (UTC date of `ctx.clock.now()`), field `image`: title from `image.title` without `File:` and the extension, `imageUrl = image.thumbnail.source`, `url = image.file_page`, `author = image.artist.text`, `licence = image.license.type`, `description = image.description.text`, safety `curated`, why `['Wikimedia Commons: picture of the day']`.
  - Commons `search(q)`: `GET https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=<q>&gsrlimit=10&prop=imageinfo&iiprop=url|mime|size|extmetadata&iiurlwidth=1024&format=json&origin=*`. Keep only `image/jpeg|png|gif|webp` with `width ≥ 400` and a `LicenseShortName`. `title = ObjectName` (else the file name), `description = toPlainText(ImageDescription)`, `author = toPlainText(Artist)`, `attribution = '<author> · <licence> · Wikimedia Commons'`, `imageUrl = thumburl`, `url = descriptionurl`, why `['Wikimedia Commons search']`. `more` returns `[]`.

Fixtures (hand-written in the documented shapes; values the tests assert):
- `wikipedia/random-summary.json`: `type 'standard'`, `title 'Ada Lovelace'`, `titles.canonical 'Ada_Lovelace'`, `extract 'Ada Lovelace was an English mathematician. She wrote the first program.'`, `thumbnail.source 'https://upload.wikimedia.org/ada.jpg'`, `content_urls.desktop.page 'https://en.wikipedia.org/wiki/Ada_Lovelace'`. `wikipedia/random-disambiguation.json`: the same with `type 'disambiguation'`, `title 'Mercury'`.
- `wikipedia/search.json`: `query.pages` with `"2": {index: 2, title 'Moth trap', fullurl …/Moth_trap}` and `"1": {index: 1, title 'Moth', fullurl …/Moth, thumbnail}`. `wikipedia/morelike.json`: one page, `title 'Charles Babbage'`.
- `wikipedia/featured.json`: `image` with `title 'File:Aurora.jpg'`, `file_page 'https://commons.wikimedia.org/wiki/File:Aurora.jpg'`, `artist.text 'Jane Doe'`, `license.type 'CC BY-SA 4.0'`, `description.text 'An aurora over a lake.'`, `thumbnail.source`.
- `commons/search.json`: three pages: `File:Old map.png` (`image/png`, width 2000, `ImageDescription '<p>An <b>old</b> map.</p>'`, `Artist '<a href="javascript:alert(1)">Ann</a>'`, `LicenseShortName 'CC BY 4.0'`, `ObjectName 'Old map'`), `File:Clip.webm` (`video/webm`) and `File:Tiny.jpg` (`image/jpeg`, width 100).
- Routes, in this order: `morelike` search → `wikipedia/morelike.json`; other `en.wikipedia.org/w/api.php` → `wikipedia/search.json`; `page/random/summary` → `wikipedia/random-summary.json`; `feed/featured/` → `wikipedia/featured.json`; `commons.wikimedia.org/w/api.php` → `commons/search.json`.

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
});
test('wikipedia more uses morelike', async () => {
  const { ctx, calls } = await adapterCtx(); const [ada] = await wikipedia.random(ctx);
  const out = await wikipedia.more(ada, ctx);
  assert.equal(new URL(calls[1].url).searchParams.get('gsrsearch'), 'morelike:Ada Lovelace');
  assert.deepEqual(out.map(f => f.title), ['Charles Babbage']);
});
test('commons random is the picture of the day', async () => {
  const { ctx, calls } = await adapterCtx(); const [f] = await commons.random(ctx);
  assert.ok(calls[0].url.endsWith('/api/rest_v1/feed/featured/2026/11/11'));
  assert.equal(f.title, 'Aurora'); assert.equal(f.safety, 'curated'); assert.equal(f.author, 'Jane Doe');
  assert.equal(f.url, 'https://commons.wikimedia.org/wiki/File:Aurora.jpg'); assert.deepEqual(f.why, ['Wikimedia Commons: picture of the day']);
});
test('commons turns extmetadata HTML into plain text', async () => {
  const { ctx, calls } = await adapterCtx(); const out = await commons.search('map', ctx);
  assert.equal(out.length, 1);
  assert.equal(out[0].description, 'An old map.'); assert.equal(out[0].author, 'Ann');
  assert.equal(out[0].attribution, 'Ann · CC BY 4.0 · Wikimedia Commons');
  assert.equal(new URL(calls[0].url).searchParams.get('gsrnamespace'), '6');
  assert.equal(commons.fate, false);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/unit/src-wikimedia.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Write the fixtures and routes, then implement both adapters**

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/unit/src-wikimedia.test.js tests/unit/sources-index.test.js`
Expected: PASS.

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
  - Open Library `search(q)`: `GET https://openlibrary.org/search.json?q=<q>&fields=key,title,author_name,cover_i,first_publish_year&limit=10`. `random`: `GET https://openlibrary.org/subjects/<subject>.json?limit=12&offset=<0–199>` with `subject` from `['science_fiction','poetry','cooking','history','art','travel','puzzles','games','folklore','nature']`; `more(find)` uses `find.meta.subject` (or `[]`). Find: id `ol:<key>`, `url = 'https://openlibrary.org' + key`, `imageUrl = 'https://covers.openlibrary.org/b/id/<cover>-M.jpg'` only when there is a cover, `author` = first author, `description = '<author>, <year>'`, why `['Open Library']`.
  - APOD `random`: `GET https://api.nasa.gov/planetary/apod?api_key=<key>&count=10&thumbs=true` with `key` = secret `src:apidatagov` or `DEMO_KEY`. With `DEMO_KEY` it keeps a counter in `ctx.cache` under `apod:count:<YYYY-MM-DD>` (24 h): at 45 or more it returns `[]` without a request, and an HTTP 429 sets it to 50 before rethrowing. Find: id `apod:<date>`, `url = 'https://apod.nasa.gov/apod/ap<YYMMDD>.html'`, `imageUrl = url` for images and `thumbnail_url` for videos (a video with neither is dropped), `kind 'image'|'video'`, `description = explanation`, `author` = trimmed `copyright`, `licence` = `'© <copyright>'` or `'Public domain (NASA)'`, `meta.published = date`, why `['NASA APOD']`. `search` and `more` return `[]`.

Fixtures: `inat/observations.json` with result 101 (`taxon {id 47219, name 'Apis mellifera', preferred_common_name 'Western Honey Bee'}`, `place_guess 'Oslo, Norway'`, `observed_on '2026-06-01'`, `user.login 'beefan'`, photo `https://static.inaturalist.org/photos/1/square.jpg`, `cc-by`, `attribution '(c) beefan, some rights reserved (CC BY)'`) and result 102 with `license_code null`. `openlibrary/search.json` with `/works/OL27448W` ('The Left Hand of Darkness', 'Ursula K. Le Guin', `cover_i 12345`, 1969) and `/works/OL1W` with no cover; `openlibrary/subject.json` with one work (`cover_id 777`). `apod/count.json`: `2025-03-14` image 'Pi Nebula' with `copyright ' Jane Sky '`; `2024-01-02` video with `thumbnail_url`; `2024-01-03` video without one.

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
  assert.equal(out[1].kind, 'video'); assert.equal(out[1].licence, 'Public domain (NASA)');
});
test('apod uses your api.data.gov key and stops near the DEMO_KEY limit', async () => {
  const keyed = await adapterCtx({ secrets: { 'src:apidatagov': 'MYKEY' } }); await apod.random(keyed.ctx);
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
Expected: PASS.

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

Fixtures: `marginalia/search.json` (`results: [{url 'https://synth.example.net/', title 'A synth page', description 'Handmade synths.'}]`), `marginalia/similar.json` (`{domain 'example.com', similar: [{domain 'neighbour.example.org'}]}`). `github/search.json`: `ann/tiny-jam` (`name 'tiny-jam'`, `homepage 'https://ann.github.io/tiny-jam/'`, `stargazers_count 42`, `topics ['game-jam','html5-game']`, `owner.login 'ann'`) and `bob/engine` (`homepage ''`, `html_url 'https://github.com/bob/engine'`, `topics ['godot-game']`). `hn/search.json`: hit `111` ('Show HN: I made a tiny game', url `https://tiny.example.dev/`, 120 points, 30 comments) and hit `222` ('Show HN: Notes app', `url ''`, `story_text '<p>Hi <script>alert(1)</script>HN</p>'`). Routes: Marginalia `/similar` before `/search`; GitHub search; HN `search_by_date` and `search` both → `hn/search.json`.

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
Expected: PASS.

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
  - AIC: header `AIC-User-Agent: IDENT`. `random`: `GET https://api.artic.edu/api/v1/artworks/search?query[term][is_public_domain]=true&fields=id,title,image_id,artist_display,date_display,thumbnail&limit=20&page=<1–500>`; `search(q)` adds `q=<q>` with `page=1`. Items without `image_id` are dropped. Find: id `aic:<id>`, `imageUrl = config.iiif_url + '/<image_id>/full/843,/0/default.jpg'`, `url = 'https://www.artic.edu/artworks/<id>'`, `author = artist_display`, `description = thumbnail.alt_text || '<artist_display>, <date_display>'`, `meta.lqip = thumbnail.lqip` (the card's image fallback), why `['Art Institute of Chicago']`. `more` returns `[]`.
  - Met (v1.1 search only; v1 search was retired on 2026-10-01): `random` reads the total once (`GET https://collectionapi.metmuseum.org/public/collection/v1.1/search?hasImages=true&isPublicDomain=true&limit=1&offset=0`, cached 24 h as `met:total`), then the same URL with `offset=<floor(rand × min(total, 10000))>`, then `GET https://collectionapi.metmuseum.org/public/collection/v1/objects/<id>`. `search(q)`: `v1.1/search?q=<q>&hasImages=true&isPublicDomain=true&limit=5`, then each object. Objects with `isPublicDomain !== true` or no `primaryImageSmall` are dropped. Find: id `met:<objectID>`, `url = objectURL`, `imageUrl = primaryImageSmall`, `author = artistDisplayName`, `description = '<artistDisplayName>, <objectDate>'`, why `['The Met']`. `probeUrl 'https://collectionapi.metmuseum.org/public/collection/v1/objects/436535'`.
  - Cleveland: `random` reads `info.total` once (`GET https://openaccess-api.clevelandart.org/api/artworks/?cc=1&has_image=1&limit=1`, cached 7 days as `cleveland:total`), then `?cc=1&has_image=1&limit=10&skip=<floor(rand × total)>`; `search(q)`: `?q=<q>&cc=1&has_image=1&limit=20`. Only `share_license_status === 'CC0'` is kept (trust the returned value). Find: id `cma:<id>`, `url`, `imageUrl = images.web.url`, `author = creators[0].description`, `description = '<creator>, <creation_date>'`, why `['Cleveland Museum of Art']`. `probeUrl 'https://openaccess-api.clevelandart.org/api/artworks/?limit=1'`.

Fixtures: `aic/search.json` (`config.iiif_url 'https://www.artic.edu/iiif/2'`; artwork 27992 'A Sunday on La Grande Jatte', `image_id '2d484387'`, `artist_display 'Georges Seurat\nFrench, 1859–1891'`, `thumbnail {lqip 'data:image/gif;base64,R0lGOD', alt_text 'A park scene.'}`; artwork 1 with `image_id null`). `met/search.json` (`{total: 5000, objectIDs: [436535]}`), `met/object.json` (436535 'Wheat Field with Cypresses', `primaryImageSmall`, `objectURL`, 'Vincent van Gogh', '1889', `isPublicDomain true`), `met/object-not-pd.json` (the same with `isPublicDomain false`). `cleveland/artworks.json` (`info.total 30000`; artwork 1 'Twilight in the Wilderness', CC0, `images.web.url`, creator 'Frederic Edwin Church (American, 1826–1900)', '1860'; artwork 2 'Copyrighted' with `share_license_status 'Copyrighted'`).

- [ ] **Step 1: Write the failing test**

```js
test('aic builds IIIF images, keeps the lqip and sends AIC-User-Agent', async () => {
  const { ctx, calls } = await adapterCtx(); const out = await aic.random(ctx);
  assert.equal(calls[0].headers['aic-user-agent'], IDENT);
  const u = new URL(calls[0].url); assert.equal(u.searchParams.get('query[term][is_public_domain]'), 'true'); assert.ok(+u.searchParams.get('page') <= 500);
  assert.equal(out.length, 1);
  assert.equal(out[0].imageUrl, 'https://www.artic.edu/iiif/2/2d484387/full/843,/0/default.jpg');
  assert.equal(out[0].url, 'https://www.artic.edu/artworks/27992'); assert.equal(out[0].author, 'Georges Seurat French, 1859–1891');
  assert.ok(out[0].meta.lqip.startsWith('data:image/gif')); assert.equal(out[0].licence, 'Public domain');
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
  await cleveland.random(ctx); assert.equal(calls.filter(c => c.url.includes('limit=1')).length, 1);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/unit/src-museums.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Write the fixtures and routes, then implement the three adapters**

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/unit/src-museums.test.js tests/unit/sources-index.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/sources/aic.js src/core/sources/met.js src/core/sources/cleveland.js src/core/sources/index.js tests/fixtures/http/aic tests/fixtures/http/met tests/fixtures/http/cleveland tests/fixtures/routes.js tests/unit/src-museums.test.js
git commit -m "Add the Art Institute, Met and Cleveland adapters"
```

<!-- PLAN CONTINUES -->
