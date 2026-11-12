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

<!-- PLAN CONTINUES -->
