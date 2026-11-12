# Byways build plan: overview and shared contract

> **For agentic workers:** this file is not a task list. It is the shared contract that every Byways plan builds on: the file layout, module names and signatures, data shapes and global constraints. Read it before any plan task. If a plan disagrees with this file, this file wins. Fix the plan, or change this file and every plan that uses the changed name, in the same commit.

**Spec:** `docs/superpowers/specs/2026-11-11-byways-design.md`. Section numbers below such as "§12.3" refer to it.
**Research notes:** `docs/superpowers/specs/byways-research/`. Each fact there carries a verified, likely, unverified or false mark.

## Plans and order

Run the plans in this order. Each plan ends with green tests and something usable.

| # | Plan file | Builds | Spec milestone |
|---|---|---|---|
| 01 | `2026-11-11-byways-01-foundation.md` | Scaffold, build, test harness, core utilities, storage, network layer, web platform, app shell, Pages and CI | M1 |
| 02 | `2026-11-11-byways-02-discovery.md` | Find model, free sources, probe, seen-set, taste and Tuned, Fate, engine, cards, Stumble, Feed, Rabbit Hole, Saved, share links, backup, first run, starter library | M1 |
| 03 | `2026-11-11-byways-03-hands-free.md` | Voice grammar, web voice engine, read-aloud, listener, hands-free controller, lean-back, media keys, wake lock, key map, accessibility settings | M1 |
| 04 | `2026-11-11-byways-04-vault-daily.md` | Archive client, Vault, gem score, play watchdog, Daily Fate, data job, link check, old web, live probe workflow | M1 |
| 05 | `2026-11-11-byways-05-ai.md` | Provider table and adapters, Claude loop, grounding, model picker, keys and passphrase lock, AI Search, leads, AI team, cost guards | M1 |
| 06 | `2026-11-11-byways-06-lab.md` | Vendoring, Lab page, the four runners, BIOS shelf, saves panel, Licenses screen | M2 |
| 07 | `2026-11-11-byways-07-extension.md` | MV3 manifests, background, side panel/sidebar, Byways tab, mic grant, extension platform | M3 |
| 08 | `2026-11-11-byways-08-android.md` | Gradle project, Activity, WebViews, bridge, nativeFetch, native voice/TTS/media, Lab origin, Android CI | M4 |
| 09 | `2026-11-11-byways-09-release.md` | Release workflow, GPL source archives, notices, privacy, README, real-device checklist | M5 |

Dependencies:

- 01 → 02.
- 02 → 03, 04 and 05, which can run in any order.
- 01 → 06.
- 01–06 → 07 and 08.
- All → 09.

## Working conventions

- **Working directory.** Every command runs in `Apps/Byways/` unless it says otherwise.
- **Language.** JavaScript ES2022 modules, with no TypeScript, no framework and no bundler. Types are JSDoc typedefs in `src/core/types.js`. Kotlin is used only in `shells/android/`.
- **Core boundary.** `src/core/**` must not touch `window`, `document` or `chrome`. It may use web APIs that Node 22 also has: `fetch`, `Response`, `URL`, `TextEncoder`, `crypto.subtle`, `CompressionStream`, `structuredClone` and `AbortController`. Anything else comes in as a parameter, usually through the `Platform` object.
- **Data loading.** Data files (`src/data/*.json`) are never imported by core modules. `ui/boot.js` fetches them and passes them in, and tests read them with `fs`.
- **Forbidden in `src/**`:** `innerHTML`, `outerHTML =`, `insertAdjacentHTML`, `document.write`, `eval(`, `new Function` and remote `<script src="http`. The `--check` build fails on any of them (Plan 01, Task 2).
- **Unit tests:** `node:test`, in `tests/unit/**/*.test.js`, with no network. Run them with `npm test`.
- **End-to-end tests:** `@playwright/test@1.63.0` (it matches the preinstalled Chromium build 1243 in `/opt/pw-browsers`), in `tests/e2e/**/*.spec.js`. Run them with `npm run e2e`. Every non-localhost request is mocked (see "Test helpers").
- **Commits.** Make one commit per task, with an imperative subject naming the change, for example `Add the seen-set with URL hashing`.
- **Copy.** Interface text uses the exact labels in the spec (§5.3, §6.3). Write plain, short sentences.

## Repository layout

These are all the files the plans create. A plan task may add a file only inside this layout, and it must list the file under **Files**.

```
.github/workflows/
  byways.yml               tests on every change (Plans 01, 08)
  pages.yml                Pages deploy + daily data (Plans 01, 04)
  byways-probe.yml         live probe (Plan 04)
  byways-release.yml       releases (Plan 09)
Apps/Byways/
  package.json  package-lock.json  .gitignore  README.md  LICENSE
  THIRD_PARTY_NOTICES.md  PRIVACY.md  CHECKLIST.md
  src/
    core/
      types.js             JSDoc typedefs only (Find, Taste, Settings, Platform, …)
      util/hash.js         fnv1a32, mulberry32, hash64, sha256Hex, gumbel
      util/url.js          normalizeUrl, domainOf, isHttpUrl, siteOrigin
      util/text.js         toPlainText, firstSentence, truncate, tokenize
      util/clock.js        realClock, fakeClock (tests), utcDate, nextUtcMidnight
      store/db.js          openStore, idbBackend, memoryBackend, STORE_NAMES
      store/cache.js       createCache
      settings.js          DEFAULT_SETTINGS, loadSettings, saveSettings
      net/errors.js        NetError
      net/ratelimit.js     createLimiter, parseRetryAfter
      net/http.js          createHttp
      model/find.js        makeFind, FIND_KINDS, SAFETY
      seen.js              createSeen
      history.js           createHistory
      taste.js             DEFAULT_TASTE, applyReaction, describeChange
      pick.js              chooseBranch, scoreFind, eligible, pickNext
      fate.js              fatePull
      rabbit.js            similarLocal, createRabbitHole
      collections.js       createCollections
      share.js             encodeShare, decodeShare, buildShareUrl, MAX_LINK_CHARS
      backup.js            exportBackup, importBackup, toBookmarksHtml, fromBookmarksHtml
      liveness.js          checkLive
      engine.js            createEngine
      sources/index.js     SOURCES, getSource, enabledSources
      sources/probe.js     runProbes, probeSource
      sources/<id>.js      one adapter per source (ids below)
      ia/client.js         createIaClient
      ia/vault.js          VAULT_COLLECTIONS, validateCollections, gemScore, gemWhy, gemQuery, vaultFate, iaDocToFind
      daily.js             dailySeed, backupDaily, loadDaily, DAILY_SLOTS
      voice/grammar.js     COMMANDS, parseUtterance, FILLER_WORDS
      voice/listener.js    createListener (restart policy)
      voice/reader.js      cardScript, createReader
      handsfree.js         createHandsFree
      ai/providers.js      PROVIDERS, getProvider, priceFor
      ai/brief.js          buildBrief, SYSTEM_PROMPT, FIND_SCHEMA, REPORT_FINDS_TOOL
      ai/grounding.js      filterGrounded
      ai/cost.js           costOf, estimateRun, createBudget
      ai/errors.js         mapAiError
      ai/adapters/anthropic.js  openai-responses.js  openai-chat.js  gemini.js  mistral.js  chrome-prompt.js
      ai/models.js         listModels, pickDefaultModel
      ai/leads.js          resolveLeads
      ai/team.js           defaultTeam, mergeFinds, runTeam
      ai/search.js         aiSearch
      ai/openrouter-pkce.js  startPkce, finishPkce
      keys.js              createKeyring
    ui/
      boot.js  router.js  dom.js  a11y.js  theme.js  keymap.js  toast.js  firstrun.js
      components/card.js  components/generated-image.js  components/cost-line.js
      views/index.js  stumble.js  feed.js  daily.js  vault.js  saved.js  import.js
      views/settings/index.js  taste.js  sources.js  ai.js  voice.js  access.js  data.js  privacy.js  about.js  licenses.js
      handsfree-ui.js      Start button, listening indicator, Pause/Play, Stop/Mute, help card
      styles/app.css  styles/themes.css
    platform/
      web-voice.js  web-tts.js  web-media.js  pwa.js  extension.js  android.js
    lab/
      index.html  lab.js  lab.css  systems.js  runner-host.js  storage-panel.js  bios-shelf.js
      dos.html dos.js  console.html console.js  pc.html pc.js  soft-keyboard.js  flash.html flash.js
    data/
      tags.json  library.json  vault-starter.json  geocities-seeds.json
    assets/
      icons/ (icon.svg, icon-192.png, icon-512.png, maskable-512.png)  fonts/ (Atkinson Hyperlegible woff2 + OFL.txt)
    versions.json
  shells/
    pwa/       index.html  manifest.webmanifest  sw.js  landing/index.html
    extension/ manifest.base.json  manifest.chrome.json  manifest.firefox.json  bg.js  panel.html  panel.js  app.html  permission.html  permission.js
    android/   settings.gradle.kts  build.gradle.kts  gradle.properties
               app/build.gradle.kts  app/proguard-rules.pro
               app/src/main/AndroidManifest.xml  app/src/main/res/**
               app/src/main/kotlin/io/github/iteatsthesalt/byways/*.kt
               app/src/test/kotlin/io/github/iteatsthesalt/byways/*.kt
  tools/
    build.js  check.js  serve.js  vendor.js  data-job.js  linkcheck.js  probe-live.js  gpl-sources.js
  tests/
    unit/**/*.test.js
    e2e/playwright.config.js  e2e/helpers/net.js  e2e/helpers/fakes.js  e2e/**/*.spec.js
    fixtures/http/**        recorded responses (JSON, text)
    fixtures/routes.js      URL pattern → fixture file
    fixtures/files/**       tiny test files for the Lab (generated, open licence)
  dist/  vendor/            gitignored
```

Source adapter ids, one per file in `src/core/sources/`:

- **Open tier:** `wikipedia`, `commons`, `inat`, `openlibrary`, `marginalia`, `github`, `apod`, `aic`, `kagi`, `europeana`, `openverse`, `library` (the starter library), `oldweb` (GeoCities through Wayback), `itch`.
- **Probe tier:** `met`, `cleveland`, `nasaimages`, `loc`, `wiby`, `kagirandom`, `smithsonian`, `hn`.
- **Archive (Plan 04):** `ia` for Archive non-game sources, and `vault` for Archive games.

## Shared types (`src/core/types.js`)

```js
/** @typedef {'site'|'article'|'image'|'game'|'video'|'audio'|'book'|'project'} FindKind */
/** @typedef {'curated'|'mostly'|'mixed'} Safety */
/** @typedef {Object} Find
 *  @property {string} id            e.g. 'ia:msdos_Whizz_1994', 'wiki:en:Ada_Lovelace', 'url:<hash64 of normalised url>'
 *  @property {string} source        adapter id
 *  @property {FindKind} kind
 *  @property {string} title         ≤ 200 chars, plain text
 *  @property {string} description   ≤ 400 chars, plain text
 *  @property {string} url           http(s) only; what Open goes to
 *  @property {string} [imageUrl]    http(s) only
 *  @property {string} [embedUrl]    only 'https://archive.org/embed/<id>'
 *  @property {string[]} tags        ids from data/tags.json
 *  @property {string} [author]
 *  @property {string} [licence]
 *  @property {string} [attribution]
 *  @property {string[]} why         reason chips shown on the card
 *  @property {string[]} [foundBy]   AI member labels, e.g. 'Scout · claude-opus-5-5'
 *  @property {boolean} [teamPick]
 *  @property {Safety} safety
 *  @property {Object} [meta]        source-specific extras (e.g. {downloads, year, platform})
 */
/** @typedef {'like'|'dislike'|'save'|'lessTopic'|'neverSite'|'broken'|'interest'} Reaction */
/** @typedef {{v:1, tags:Object<string,number>, sources:Object<string,number>, hiddenTags:string[], blockedDomains:string[], strangeness:number, interests:string[], reactions:number}} Taste */
/** @typedef {'tuned'|'fate'|'ai'} Mode */
```

The `Platform`, `VoiceEngine`, `Tts` and `SecretStore` shapes below are the only way core and UI code reach a shell. Plan 01 implements them for the PWA, Plan 07 for the extension and Plan 08 for Android.

```js
/** @typedef {Object} Platform
 *  @property {'pwa'|'extension'|'android'} name
 *  @property {{fetch(url:string, init?:RequestInit & {privileged?:boolean}):Promise<Response>}} transport
 *  @property {VoiceEngine} voice
 *  @property {Tts} tts
 *  @property {(data:{title?:string,text?:string,url?:string}) => Promise<'shared'|'copied'|'cancelled'>} share
 *  @property {(find:Find, how?:'tab'|'current'|'inapp') => Promise<void>} openFind
 *  @property {{save(name:string, blob:Blob):Promise<void>, pick(accept:string, multiple?:boolean):Promise<File[]>}} files
 *  @property {{setHandlers(h:{next?:Function, previous?:Function, playPause?:Function}):void, setActive(on:boolean):void}} media
 *  @property {{on():Promise<void>, off():Promise<void>}} wakeLock
 *  @property {SecretStore} secrets
 *  @property {{privilegedFetch:boolean, localNetworkHttp:boolean, inAppSiteView:boolean, labHref:string, framesArchive:boolean}} caps
 *  @property {() => Promise<boolean>} persistStorage
 */
/** @typedef {{get(id:string):Promise<string|null>, set(id:string, value:string):Promise<void>, delete(id:string):Promise<void>, list():Promise<string[]>}} SecretStore */
/** @typedef {{kind:'web-local'|'web-cloud'|'native'|'none', vendor:'google'|'apple'|'microsoft'|'mozilla'|'android'|null, needsDownload:boolean, continuous:boolean, reason:string|null}} VoiceStatus */
/** @typedef {'no-speech'|'aborted'|'audio-capture'|'network'|'not-allowed'|'service-not-allowed'|'language-not-supported'|'phrases-not-supported'|'busy'|'too-many-requests'} VoiceErrorCode */
/** @typedef {Object} VoiceEngine
 *  @property {(opts:{allowCloud:boolean}) => Promise<VoiceStatus>} probe
 *  @property {() => Promise<boolean>} install          call only from a user gesture
 *  @property {(opts:{lang:string, phrases:string[], allowCloud:boolean}) => Promise<void>} start
 *  @property {() => void} stop
 *  @property {(event:'result'|'state'|'error', fn:Function) => () => void} on
 *    result → {text:string, final:boolean}; state → {listening:boolean}; error → {code:VoiceErrorCode}
 */
/** @typedef {Object} Tts
 *  @property {(text:string, opts?:{voiceURI?:string, rate?:number, volume?:number}) => Promise<void>} speak   resolves at end of utterance
 *  @property {() => void} cancel
 *  @property {() => Promise<Array<{uri:string, name:string, lang:string, local:boolean}>>} voices
 */
```

## Module contract

Every name below is final. Plans use these exact names and signatures. "→" marks the return value.

### Plan 01: foundation

**`util/hash.js`**

- `fnv1a32(str) → number`: unsigned 32-bit, over UTF-8 bytes. Offset basis `0x811c9dc5`, prime `0x01000193`.
- `mulberry32(seed) → () => number`: returns values in [0,1).
- `hash64(str) → string`: 16 lowercase hex characters, FNV-1a 64-bit over UTF-8 using BigInt. Offset basis `0xcbf29ce484222325`, prime `0x100000001b3`.
- `sha256Hex(data: string|ArrayBuffer|Uint8Array) → Promise<string>`.
- `gumbel(rand) → number`.

**`util/url.js`**

- `normalizeUrl(u) → string|null`: the §14.1 rule. Returns `null` for anything that is not http(s).
- `domainOf(u) → string`: the host without `www.`.
- `isHttpUrl(u) → boolean`.
- `siteOrigin(u) → string`.

**`util/text.js`**

- `toPlainText(html) → string`: uses `DOMParser` when it exists, otherwise strips tags and decodes `&amp; &lt; &gt; &quot; &#39; &nbsp;` and numeric entities. It collapses whitespace.
- `firstSentence(text) → string`.
- `truncate(text, max) → string`: adds `…` when it cuts.
- `tokenize(text) → string[]`: lowercase words of at least 3 letters, with a fixed English stop-word list.

**`util/clock.js`**

- `realClock = {now() → number, setTimeout, clearTimeout}`.
- `fakeClock(start) → {now, setTimeout, clearTimeout, advance(ms)}`.
- `utcDate(ms) → 'YYYY-MM-DD'`.
- `nextUtcMidnight(ms) → number`.

**`store/db.js`**

- `STORE_NAMES = ['settings','taste','collections','history','seen','cache','aiCache','usage','health','keys']`.
- `openStore(backend) → Promise<Store>`, where `Store = {get(name,key), put(name,key,value), delete(name,key), getAll(name) → Promise<Array<{key,value}>>, keys(name), clear(name)}`.
- `idbBackend(dbName = 'byways')` and `memoryBackend()`.

**`store/cache.js`**

- `createCache(store, clock) → {get(key) → value|undefined, set(key, value, ttlMs), purgeExpired()}`. It uses the `cache` object store.

**`settings.js`**

- `DEFAULT_SETTINGS`, with the values below.
- `loadSettings(store) → Promise<Settings>`: deep-merges what is stored over the defaults.
- `saveSettings(store, patch) → Promise<Settings>`.

**`net/errors.js`**

- `class NetError extends Error`, with fields `kind: 'network'|'timeout'|'http'|'parse'|'aborted'|'circuit'`, `status?`, `retryAfterMs?` and `source?`.

**`net/ratelimit.js`**

- `createLimiter({perMinute, concurrent, clock}) → {schedule(fn) → Promise, pauseFor(ms)}`.
- `parseRetryAfter(value, nowMs) → number|null`: accepts seconds or an HTTP date, and returns milliseconds.

**`net/http.js`**

- `createHttp({transport, clock}) → Http`, where `Http` has:
  - `register(sourceId, {perMinute, concurrent})`;
  - `request(url, {method='GET', headers, body, source, timeoutMs=8000, privileged=false, signal}) → Promise<Response>`, which throws `NetError` on a network or timeout failure and on a status ≥ 400. It retries once on 429/503 within `Retry-After` when that is ≤ 10 s, and otherwise calls `pauseFor`.
  - `getJson(url, opts) → Promise<any>`;
  - `getText(url, opts) → Promise<string>`.
- Requests never set `credentials: 'include'`.

**`platform/pwa.js`**

- `createPwaPlatform({secretsStore}) → Platform`.

**`platform/web-tts.js`**

- `createWebTts(speechSynthesis) → Tts`.

**`platform/web-voice.js`**

- Plan 01 adds `createNoVoice() → VoiceEngine`, whose `probe` resolves to `{kind:'none', reason:'not set up yet', …}`. This is a real engine for devices with no recogniser.
- Plan 03 adds `createWebVoice(win)` to the same file and switches `pwa.js` over to it.

**`platform/web-media.js`**

- `createWebMedia(navigator) → Platform['media']` and `createWebWakeLock(navigator, document) → Platform['wakeLock']`.

**`ui/dom.js`**

- `h(tag, props?, ...children) → HTMLElement`. In `props`, `class`, `text` (sets `textContent`), `on<Event>` handlers, `aria-*`, `data-*` and other attributes are set with `setAttribute`. String children become text nodes.
- `clear(el)`.

**`ui/a11y.js`**

- `announce(text, {assertive=false})`: it writes to `#live-polite` or `#live-assertive`.
- `focusMain()`.

**`ui/router.js`**

- `ROUTES = ['stumble','feed','daily','vault','saved','settings','import']`.
- `startRouter(render: (route, params) => void)` and `navigate(route, params?)`.
- The hash forms are `#/stumble`, `#/daily/YYYY-MM-DD`, `#/settings/ai` and `#s=<payload>`, which goes to `import`.

**`ui/theme.js`**

- `applyAccessSettings(settings)`: sets `data-theme`, `data-font`, `data-motion` and `--text-scale` on `<html>`.

**`ui/toast.js`**

- `showToast(message, {undo?: () => Promise<void>, ms=5000})`.

**`ui/boot.js`**

- `boot(platform) → Promise<App>`. It loads data, opens the store and builds the engine and router.
- `App` fields and the plan that adds each:

  | Field | Plan |
  |---|---|
  | `store`, `settings` (a live object, re-read with `app.getSettings()`), `saveSettings(patch)`, `http`, `clock`, `rand`, `platform`, `data` | 01 |
  | `engine`, `seen`, `history`, `collections` | 02 |
  | `search(text) → Promise<{finds: Find[], note?: string}>`: keyword search through `engine.search`, which injects the results into the queue | 02 |
  | `search`, upgraded to `aiSearch` when an AI provider is set up. The `note` carries the cost line | 05 |
  | `handsFree` | 03 |
  | `ia` | 04 |
  | `keyring`, `budget` | 05 |

- `ui/views/stumble.js` (Plan 02) also exports:
  - `showResult(result)`, which renders a `{find, branch, why}` or `{empty, reason}` result;
  - `getCurrentFind() → Find|null`;
  - `setMode(mode)`.

  The hands-free controller and the AI plan use only these three.

- `data` has the keys `tags`, `library`, `vaultStarter` and `geocities`, and each later plan adds its own.

**UI registries (Plan 01).** Later plans add screens only through these, and each plan adds its import lines to `ui/views/index.js`:

- `ui/router.js`: `registerView(route, {title, render(container, app, params) → void|Promise<void>, leave?() → void})`.
- `ui/views/settings/index.js`: `registerSettingsSection({id, label, order, render(container, app)})`, which routes as `#/settings/<id>`.
- `ui/firstrun.js`: `registerFirstRunStep({id, order, render(container, app, done)})` and `runFirstRun(app) → Promise<void>`. Steps run in `order`, and every step shows a **Skip** button.
- `ui/views/index.js`: the one file that imports every view and settings module, so that each one registers itself.

`DEFAULT_SETTINGS`, with every value taken from the spec:

```js
{
  v: 1,
  mode: 'tuned',
  familyFilter: true, checkLinks: true,
  dwellSec: 20, dwellWaitForMe: false,          // range 5–300
  leanBackAI: false, aiInRabbitHole: false,
  singleKeyShortcuts: true, screenReaderMode: false,
  motion: 'system', theme: 'system', font: 'system', textScale: 1,   // textScale 1–2
  goStraightToSite: false,                       // Android site view only
  sessionLengthMin: null, exploringCue: false,
  voice: { mode: 'auto', cloudOptIn: false, voiceURI: null, rate: 1, volume: 1, lang: 'en-US' },
    // mode 'auto' | 'always' | 'push' | 'off'; 'auto' = always on for on-device/native-13+, push elsewhere
  ai: { provider: null, model: null, runCapUsd: 0.5, dailySearchCap: 50, dailySpendCapUsd: 2,
        team: { enabled: false, captain: false, roles: { scout: null, digger: null, wildcard: null, captain: null } } },
        // role value: {provider, model} | null
  sources: {},                                   // {[sourceId]: {enabled:boolean, fateWeight:0..3}}; absent = default
  passphraseLock: false,
  firstRunDone: false
}
```

### Plan 02: discovery

**`model/find.js`**

- `makeFind(partial) → Find|null`: returns `null` when the url is not http(s) or the title is empty. It applies the length limits, defaults `tags` and `why` to `[]`, and sets `id` to `url:` + `hash64(normalizeUrl(url))` when no id is given.

**`seen.js`**

- `createSeen(store) → {has(url) → Promise<boolean>, add(url), count(), reset()}`. It keys on `hash64(normalizeUrl(url))`.

**`history.js`**

- `createHistory(store, {max=50}) → {push(find), back() → Find|null, forward() → Find|null, current() → Find|null, list(), recentDomains(n) → string[]}`. It persists to the `history` object store.

**`taste.js`**

- `DEFAULT_TASTE` and `applyReaction(taste, find, reaction, extra?) → {taste, change}`, using the §8.2 table.
- `change = {tagDeltas: Object<string,number>, sourceDelta: number, hidden: string[], blocked: string[]}`.
- `describeChange(change) → string`.

**`pick.js`**

- `chooseBranch(rand, s) → 'momentum'|'taste'|'wildcard'`.
- `scoreFind(find, taste, rand) → number`.
- `eligible(find, {seenHas, taste, recentDomains, familyFilter}) → boolean`.
- `pickNext({candidates, current, taste, rand, seenHas, recentDomains, familyFilter}) → {find, branch, why}|null`.

**`fate.js`**

- `fatePull({sources, weights, ctx, rand, seenHas, retries=3}) → Promise<{find}|{miss:true, reason}>`.

**`rabbit.js`**

- `similarLocal(find, candidates, k) → Find[]`.
- `createRabbitHole({sources, ctx, seenHas}) → {start(find), next() → Promise<Find|null>, trail() → Find[], climbOut()}`.

**`collections.js`**

- `createCollections(store, clock) → {list(), get(id), create(name), rename(id, name), remove(id), add(id, find), removeItem(id, findId), has(findId) → Promise<string[]>}`. The default collection id is `'saved'`.

**`share.js`**

- `MAX_LINK_CHARS = 2000`.
- `encodeShare(payload) → Promise<string>` and `decodeShare(str) → Promise<payload>`, where `payload = {v:1, t:'c'|'f'|'d', n, i:[[sourceId, idOrUrl, title]]}`.
- `buildShareUrl(base, payload) → Promise<{url, tooLong:boolean}>`.

**`backup.js`**

- `exportBackup(store, {includeKeys, app, clock, secrets}) → Promise<object>`.
- `importBackup(store, data, {secrets}) → Promise<{collections, seen, history, keys}>`.
- `toBookmarksHtml(collection) → string` and `fromBookmarksHtml(html) → Array<{url,title}>`.

**`liveness.js`**

- `checkLive(url, {transport, privileged}) → Promise<boolean>`.

**`sources/index.js`**

- `SOURCES` (id → adapter), `getSource(id)` and `enabledSources(settings, probe, platformName) → Adapter[]`.

**The source adapter shape**, used by every `sources/<id>.js`:

```js
{ id, name, kinds, tier: 'open'|'probe'|'privileged'|'snapshot'|'navigate',
  key: 'none'|'demo'|'optional'|'required', keyName?: string,   // SecretStore id, e.g. 'src:europeana'
  safety, rate: {perMinute, concurrent}, fate: boolean,         // usable in Fate
  probeUrl?: string,
  random(ctx) → Promise<Find[]>, search(query, ctx) → Promise<Find[]>, more(find, ctx) → Promise<Find[]> }
// ctx = {http, rand, clock, cache, settings, secrets, data, platformName}
```

**`sources/probe.js`**

- `probeSource(adapter, http) → Promise<'ok'|'fail'>`.
- `runProbes(adapters, http, store, clock) → Promise<Object<string,'ok'|'fail'>>`. It stores the results in `health` under `probe:<platformName>` and re-runs when they are older than 24 h.

**`engine.js`**

- `createEngine({store, http, clock, rand, data, platform, settings}) → Promise<Engine>`, where `Engine` has:
  - `next({mode}) → Promise<{find, branch, why}|{empty:true, reason}>`, `back() → Find|null` and `current()`;
  - `react(find, reaction, extra?) → Promise<{message, undo() → Promise<void>}>`;
  - `rabbit`: the `createRabbitHole` object;
  - `feed(n=30) → Promise<Find[]>`;
  - `search(query) → Promise<Find[]>`;
  - `inject(finds, origin)`;
  - `taste() → Taste`, `setTaste(t)` and `on(event, fn)`, with events `find`, `empty`, `error` and `taste`.

**`ui/components/card.js`**

- `renderCard(find, {onAction, compact=false}) → HTMLElement`.
- `onAction(action, find, extra)` takes an action from `'like','dislike','save','share','open','play','more','read','lessTopic','neverSite','broken','why'`.

### Plan 03: hands-free

**`voice/grammar.js`**

- `COMMANDS: Array<{id, words:string[], key:string|null, label:string}>`. The command ids are `next back like dislike save share open more read pause resume stop stopListening search fate daily help`, and the words and keys come from the §6.3 table.
- `FILLER_WORDS`.
- `parseUtterance(text) → {id, arg?}|null`.

**`voice/listener.js`**

- `createListener(engine: VoiceEngine, {clock, phrases, lang, allowCloud}) → {start(), stop(), on('command'|'state'|'error'|'heard', fn), get listening, setHalfDuplex(on)}`. It holds the §6.2 restart policy and the 10-minute idle stop.

**`voice/reader.js`**

- `cardScript(find) → string[]`.
- `createReader(tts, getSettings) → {read(sentences) → Promise<void>, stop(), pause(), resume(), get speaking}`.

**`handsfree.js`**

- `createHandsFree({engine, listener, reader, clock, getSettings, ui}) → {start(), pause(), resume(), stop(), suspend(), wake(), input(), command(id, arg), get state}`.
- The states are `'idle'|'active'|'paused'|'suspended'`.
- `ui = {show(result), announce(text, opts), setState(state), countdown(secondsLeft|null), openHelp(), navigate(route), search(text)}`.

**`platform/web-voice.js`**

- `createWebVoice(win) → VoiceEngine`.

**`ui/keymap.js`**

- `installKeymap({getSettings, dispatch(commandId)})`. It ignores keys while a text field has focus or the Lab is focused.

### Plan 04: Vault and Daily Fate

**`ia/client.js`**

- `createIaClient({http, cache, clock}) → {search({q, fl, sort, rows, page}) → {numFound, docs}, count(q) → number, metadata(id) → object|null}`.
- The queue runs at 1 request per second and 2 at a time. After two 429s in a row it pauses for 5 minutes. Searches are cached for 24 h and metadata for 7 days.

**`ia/vault.js`**

- `VAULT_COLLECTIONS = {verified:[…], likely:[…], shelves:[{id,label,collections}]}`.
- `validateCollections(ia, cache) → Promise<string[]>`.
- `gemQuery(id, page) → params` and `gemScore(doc, {currentYear, curated:Set}) → number`, using the §10.2 formula.
- `gemWhy(doc) → string[]`.
- `vaultFate(ia, rand, collections) → Promise<Find|null>`.
- `iaDocToFind(doc, {kind}) → Find`.

**`daily.js`**

- `DAILY_SLOTS = ['game','web','wonder']`.
- `dailySeed(date) → number`, computed as `fnv1a32('byways-daily-' + date)`.
- `backupDaily({date, library, vaultStarter, fetchWikiFeatured, fetchApod}) → Promise<DailyFile>`.
- `loadDaily({date, fetchDailyFile, backup}) → Promise<{file, backup:boolean}>`.

### Plan 05: AI

**`ai/providers.js`**

- `PROVIDERS` maps a provider id to `{id, name, adapter, baseURL, auth:{header, prefix}, modelsPath, search:boolean, jsonMode, webApp:'yes'|'probe'|'no', prices:{[model]:{in,out,searchUsd}}, pricesChecked:'2026-11-11'}`.
- The provider ids are `anthropic openai gemini openrouter groq xai mistral deepseek ollama lmstudio ollamaweb nano custom`.
- `getProvider(id)` and `priceFor(providerId, model) → {in,out,searchUsd}|null`.

**`ai/brief.js`**

- `buildBrief({query, taste, recentDomains, exclude}) → Brief`.
- `SYSTEM_PROMPT`, `FIND_SCHEMA` and `REPORT_FINDS_TOOL`.

**`ai/grounding.js`**

- `filterGrounded(rawFinds, groundingUrls:Set<string>) → rawFinds`: compares using `normalizeUrl`.

**`ai/cost.js`**

- `costOf(usage, price) → number`, where `usage = {inputTokens, outputTokens, searches}`.
- `estimateRun(members, prices) → number`.
- `createBudget({store, clock, settings}) → {canRun(estimateUsd) → {ok, reason}, record(providerId, usage, usd), spentToday(), searchesToday(providerId)}`.

**`ai/adapters/<name>.js`** exports:

- `search({provider, key, model, brief, transport, signal}) → Promise<AiResult>`, where `AiResult = {finds: RawFind[], groundingUrls: Set<string>, usage, costUsd, leads?: Lead[]}`.
- `listModels({provider, key, transport}) → Promise<Model[]>`.
- `complete({provider, key, model, system, prompt, schema, transport, signal}) → Promise<{json, usage}>`.

**`ai/models.js`**

- `listModels(providerId, {key, transport, cache}) → Model[]`, where `Model = {id, name, search:boolean, json:boolean}`.
- `pickDefaultModel(providerId, models) → string|null`. For `anthropic` it returns `'claude-opus-5-5'`.

**`ai/leads.js`**

- `resolveLeads(leads, {sources, ctx}) → Promise<Find[]>`.

**`ai/team.js`**

- `defaultTeam(available: Array<{provider, model, search, priceIn}>) → TeamRoles`.
- `mergeFinds(memberResults) → Find[]`: sets `teamPick` and `foundBy`.
- `runTeam({roles, captain, brief, budget, transport, keys, clock}) → Promise<{finds, members:[{role, provider, model, ok, error?, costUsd, searches}], costUsd, searches}>`.

**`ai/search.js`**

- `aiSearch({query, app}) → Promise<{finds, costUsd, searches, members?, errors}>`.

**`keys.js`**

- `createKeyring(secrets, {clock}) → {get(id), set(id, v), delete(id), list(), lock(), unlock(passphrase) → Promise<boolean>, enableLock(passphrase), disableLock(passphrase), get locked}`.
- It uses PBKDF2-SHA-256 with 600000 iterations to derive an AES-GCM key. The salt and iv are stored with the ciphertext.

### Plans 06–08

These plans define their own runner, background and bridge protocols inside the plan. They use only the `Platform` shape above to talk to the shared UI.

### Version numbers and Android signing (Plan 08 creates; Plan 09 uses)

**Version numbers.** `shells/android/gradle.properties` holds `byways.versionName=<x.y.z>` and `byways.versionCode=<x*10000 + y*100 + z>`. `app/build.gradle.kts` reads both with `providers.gradleProperty(...)`. The versionName must equal `package.json` `version` and the `version` in both extension manifests.

**Release signing.** `app/build.gradle.kts` sets up a release `signingConfig` only when `BYWAYS_KEYSTORE_PATH` is set. It reads that keystore file with `KEYSTORE_PASSWORD`, `KEY_ALIAS` and `KEY_PASSWORD`. The release workflow decodes the `KEYSTORE_BASE64` secret into a file and exports `BYWAYS_KEYSTORE_PATH`. Without it, only debug builds are signed.

### Plan 09: release

**`tools/check.js`**

- Plan 09 adds `checkVersions(appRoot) → Promise<string[]>`. It returns problems when the version numbers above disagree. The `--check` build runs it.

**`tools/gpl-sources.js`**

- The CLI is `node tools/gpl-sources.js --out <dir>`.
- It exports:
  - `sourceTargets(versions, {readCorePackage}) → Target[]`;
  - `fetchSources(targets, {fetch, outDir, writeFile}) → Promise<Result[]>`;
  - `sourcesManifest(results) → string`, which writes `SOURCES.txt`;
  - `parseRepoUrl(url) → string|null`;
  - `codeloadUrl(repo, ref) → string`;
  - `CORE_LICENCES`, which maps each core id to its licence name. Plan 06's Licenses screen may read it.
- Each Release attaches source archives for every vendored emulator component and core, plus SeaBIOS at the ref v86 used.

## Data file shapes

```js
// src/data/tags.json
{ "v":1, "groups":[ { "id":"tech-science", "label":"Tech & Science", "tags":[{ "id":"retro", "label":"Retro" }] } ] }
//   ~40 tags; ids are lowercase kebab-case; groups: tech-science, culture-creative, life-world, games

// src/data/library.json
{ "v":1, "entries":[ { "id":"lib-0001", "url":"https://…", "title":"…", "blurb":"…", "tags":["…"],
                       "kind":"site|game|toy|tool|article", "added":"2026-11-11" } ] }

// src/data/vault-starter.json
{ "v":1, "entries":[ { "id":"ia:<identifier>", "title":"…", "platform":"DOS", "year":1994, "added":"2026-11-11" } ] }

// src/data/geocities-seeds.json
{ "v":1, "urls":[ "http://www.geocities.com/…" ] }

// dist/pwa/data/daily.json (generated by tools/data-job.js)
{ "v":1, "date":"YYYY-MM-DD", "picks":[ { "slot":"game|web|wonder", "find":{ /* Find */ } } ] }

// dist/pwa/data/itch.json
{ "v":1, "generatedAt":"ISO", "feeds":[ { "feed":"https://itch.io/games/free/platform-web.xml",
  "items":[ { "url","title","description","imageUrl","author","published" } ] } ] }

// dist/pwa/data/vault-index.json
{ "v":1, "generatedAt":"ISO", "collections":{ "<id>":{ "numFound":0,
  "gems":[ { "identifier","title","year","creator","downloads","avg_rating","num_reviews","collection" } ] } } }

// dist/pwa/data/linkcheck.json
{ "v":1, "checkedAt":"ISO", "results":{ "<library entry id>":{ "ok":true, "status":200, "failStreak":0 } } }

// src/versions.json
{ "jsdos":{ "version":"8.5.3" }, "emulatorjs":{ "version":"4.2.3",
  "cores":{ "nes":"fceumm","snes":"snes9x","gb":"gambatte","gba":"mgba","segaMD":"genesis_plus_gx",
            "segaMS":"genesis_plus_gx","segaGG":"genesis_plus_gx","atari2600":"stella2014","psx":"pcsx_rearmed" } },
  "v86":{ "version":"0.5.473", "commit":"<40-char sha>", "bios":{ "seabios.bin":"<sha256>", "vgabios.bin":"<sha256>" } },
  "ruffle":{ "version":"0.7.1" }, "fflate":{ "version":"0.8.3" } }
```

## Build, serve and test harness (built in Plan 01)

**Build:** `node tools/build.js --target pwa|extension|android|all`.

- **Outputs:**
  - `dist/pwa/`;
  - `dist/chrome/` and `dist/firefox/`;
  - `shells/android/app/src/main/assets/www/` and `…/assets/lab/` (gitignored).
- **Contents.** Each output has `build.json` = `{"id": <GITHUB_SHA or "dev">, "builtAt": ISO}`. The PWA's `sw.js` cache name is `byways-<id>`.

**Check:** `node tools/build.js --check`. It builds every target into a temporary folder and runs `tools/check.js`, which:

- finds the forbidden APIs listed above;
- requires a CSP `<meta>` in every HTML page;
- checks that every relative `import` and `src`/`href` resolves;
- checks that the manifests parse;
- checks that `src/data/*.json` follow the shapes above.

**Serve:** `node tools/serve.js --root dist/pwa --base /Game-Dev-Resources/byways/ --port 4321`. It serves the build with correct MIME types, including `application/wasm`.

**npm scripts:**

| Script | Runs |
|---|---|
| `build` | `node tools/build.js --target all` |
| `check` | `node tools/build.js --check` |
| `test` | `node tools/build.js --check && node --test tests/unit/` |
| `e2e` | `node tools/build.js --target all && playwright test -c tests/e2e/playwright.config.js` |
| `vendor` | `node tools/vendor.js` |
| `data` | `node tools/data-job.js` |
| `probe` | `node tools/probe-live.js` |
| `linkcheck` | `node tools/linkcheck.js` |

**Test helpers (Plan 01, extended later):**

- **`tests/e2e/helpers/net.js`:** `mockNet(page, {overrides?})`. It routes every request outside `localhost:4321` through `tests/fixtures/routes.js` and aborts anything unmatched. It also gives `unmocked(page) → string[]`, and the `test.afterEach` hook asserts that it is empty.
- **`tests/e2e/helpers/fakes.js`:** `installFakeSpeech(page)`. It adds, through `addInitScript`:
  - a fake `SpeechRecognition` driven by `window.__say(text)`;
  - a fake `speechSynthesis` that records `window.__spoken`;
  - a fake `navigator.wakeLock`.
- **`tests/fixtures/routes.js`:** exports an array of `{match: RegExp, file: string, status?: number, headers?: object}`.

## Global constraints (every plan)

### Hosting

- The web app lives at `https://iteatsthesalt.github.io/Game-Dev-Resources/byways/` and uses only relative URLs. There is a landing page at `/Game-Dev-Resources/`.
- There is no Byways server, no analytics, no ads and no sponsored finds. Nothing ever ranks by engagement.
- No remote code is loaded at runtime. Third-party code is vendored at pinned versions with integrity checks: the npm lockfile, plus SHA-256 values in `versions.json`.

### Rendering and security

- Every third-party string renders through `textContent`. Links and images must be `http(s)`. Only `https://archive.org/embed/<id>` is framed, and only after **Play**.
- **Web app CSP (meta):** `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https: data: blob:; media-src 'self' https: blob:; frame-src https://archive.org https://*.archive.org; connect-src 'self' https: http://localhost:* http://127.0.0.1:*; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'`.
- **Lab pages** add `'wasm-unsafe-eval' blob:` to `script-src` and `blob:` to `worker-src`.
- **Extension CSP:** `"script-src 'self' 'wasm-unsafe-eval'; object-src 'self';"`.
- **Keys** are sent only to their own provider's host. They are never put in exports (unless the user chooses), share links or logs.
- **Identification header:** `Byways/<version> (+https://github.com/iteatsthesalt/Game-Dev-Resources)` in `Api-User-Agent` (Wikimedia) and `AIC-User-Agent` (Art Institute). It never carries user details.

### Hands-free and accessibility

- **Dwell:** 20 s by default, adjustable from 5 to 300 s, or **wait for me**.
- **Listener limits:** an idle stop after 10 minutes, at most 10 restarts a minute, and half-duplex listening for 400 ms after speech.
- **Undo:** 5 seconds.
- **Targets:** 56 px buttons by default, never under 44 px.
- **Live regions:** one polite (`#live-polite`, `role=status`) and one assertive (`#live-assertive`).
- **Lean-back:** never opens tabs and never auto-plays embeds.

### Discovery and the Vault

- **Back history:** 50 finds. **Prefetch:** at most 3 finds ahead. **Source timeout:** 8 s. **Domain cooldown:** 10 stumbles.
- **Tuned branches:** momentum `0.6·(1−s)`, your taste `0.3·(1−s)`, wildcard `0.1+0.9·s`. The default is `s = 0.25`. Cold start lasts until 5 reactions.
- **Feed:** 30 cards per batch. **Share links:** at most 2,000 characters.
- **Archive:** 1 request per second, 2 at a time, and a 5-minute pause after two 429s in a row. Search cached 24 h, metadata 7 days. The play watchdog waits 15 s.

### AI

- **Claude:** the default model is `claude-opus-5-5`. Send `anthropic-version: 2026-10-21` and `anthropic-dangerous-direct-browser-access: true`, with no `temperature`, `top_p` or `top_k`. Use `web_search_20260209` with `max_uses: 3`, and at most 5 `pause_turn` continuations.
- **Caps:** $0.50 per run, 50 searches per provider per day and $2.00 a day in total. AI is off in lean-back by default. Team member timeouts are 45 s for searchers and 20 s for the Captain.

### Emulator versions

- js-dos 8.5.3, EmulatorJS 4.2.3 (non-threaded cores only), v86 0.5.473, Ruffle 0.7.1 and fflate 0.8.3. No COOP/COEP anywhere.

### Android and CI

- **Android:** AGP 9.3.2, Gradle 9.7.1, compileSdk 37, targetSdk 36, minSdk 24, `androidx.webkit:webkit:1.18.0`, JDK 21 and package `io.github.iteatsthesalt.byways`.
- **CI:** `ubuntu-24.04`, `actions/checkout@v7`, `actions/setup-node@v4` (Node 22), `actions/setup-java@v6` (Temurin 21), `gradle/actions/setup-gradle@v6` (`cache-provider: basic`, `gradle-version: 9.7.1`), `actions/upload-artifact@v7`, `actions/configure-pages@v6`, `actions/upload-pages-artifact@v5` and `actions/deploy-pages@v5`.

### Copy and naming

- Model identifiers appear only where the product needs them as data: `providers.js`, `models.js`, their tests, and the spec and plans that define those values. They never appear in commit messages, PR text or code comments.
