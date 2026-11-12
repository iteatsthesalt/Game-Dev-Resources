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

<!-- PLAN CONTINUES -->
