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
  - Test kit: `adapterCtx({settings?, secrets?, data?, seed = 42, now = Date.UTC(2026, 10, 11, 12), extraRoutes = []}) → Promise<{ctx, calls, store}>`. Its transport matches `[...extraRoutes, ...routes]`, reads `tests/fixtures/http/<file>`, records `{url, method, headers, body}` in `calls`, and throws `TypeError('unmatched <url>')` for anything else. It registers every `SOURCES` adapter's `rate` with `http.register`. `ctx` has every contract field: `secrets` is an in-memory `SecretStore` seeded from `secrets`, and `data.tags` is read from `src/data/tags.json`.

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
const F = (t, tags = [], d = '', source = 'library') => makeFind({ source, kind: 'site', title: t, description: d, tags, safety: 'curated', url: `https://${t.replace(/\W/g, '')}.example.com/` });
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
  const hole = createRabbitHole({ sources: [ad('library', [[F('A')], [], []]), ad('marginalia', [[F('M', [], '', 'marginalia')], []])], ctx: {}, seenHas: never, pool: () => [F('Local', ['retro'])] });
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

<!-- PLAN CONTINUES -->
