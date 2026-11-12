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
- **Forbidden in `src/**`:** `innerHTML`, `outerHTML =`, `insertAdjacentHTML`, `document.write`, `eval(`, `new Function` and remote `<script src="http`. The `--check` build fails on any of them (Plan 01, Tasks 8–9: `tools/check.js`, run by `--check`).
- **Unit tests:** `node:test`, in `tests/unit/**/*.test.js`, with no network. Run them with `npm test`.
- **End-to-end tests:** `@playwright/test@1.63.0` (it matches the preinstalled Chromium build 1243 in `/opt/pw-browsers`), in `tests/e2e/**/*.spec.js`. Run them with `npm run e2e`. Every non-localhost request is mocked (see "Test helpers").
- **Commits.** Make one commit per task, with an imperative subject naming the change, for example `Add the seen-set with URL hashing`.
- **Copy.** Interface text uses the exact labels in the spec (§5.3, §6.3). Write plain, short sentences.

## Repository layout

These are all the files the plans create. A plan task may add a file only inside this layout, and it must list the file under **Files**.

```
.github/workflows/
  byways.yml               tests on every change (Plans 01, 07, 08)
  pages.yml                Pages deploy + daily data (Plans 01, 04)
  byways-probe.yml         live probe (Plan 04)
  byways-release.yml       releases (Plan 09)
Apps/Byways/
  package.json  package-lock.json  .gitignore  README.md  LICENSE
  THIRD_PARTY_NOTICES.md  PRIVACY.md  CHECKLIST.md
  src/
    core/
      types.js             JSDoc typedefs only (Find, Taste, Settings, Platform, …)
      version.js           APP_VERSION (hand-edited at a version bump; checked by Plan 09)
      util/hash.js         fnv1a32, mulberry32, hash64, sha256Hex, gumbel
      util/url.js          normalizeUrl, domainOf, isHttpUrl, siteOrigin
      util/text.js         toPlainText, firstSentence, truncate, tokenize
      util/clock.js        realClock, fakeClock (tests), utcDate, nextUtcMidnight
      data.js              loadAppData (Plans 01, 04; used by ui/boot.js and the extension background)
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
      ai/openrouter-pkce.js  startPkce, finishPkce, pkceMode, connectWithIdentity
      keys.js              createKeyring
    ui/
      boot.js  router.js  dom.js  a11y.js  theme.js  keymap.js  toast.js  firstrun.js
      components/card.js  components/generated-image.js
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
    build.js  check.js  serve.js  icons.js  vendor.js  data-job.js  linkcheck.js  probe-live.js  gpl-sources.js
  tests/
    unit/**/*.test.js  unit/helpers/fake-dom.js
    e2e/playwright.config.js  e2e/helpers/net.js  e2e/helpers/app.js  e2e/helpers/axe.js  e2e/helpers/fakes.js  e2e/**/*.spec.js
    fixtures/http/**        recorded responses (JSON, text)
    fixtures/routes.js      URL pattern → fixture file
    fixtures/files/**       tiny test files for the Lab (generated, open licence)
  dist/  vendor/            gitignored
```

Source adapter ids, one per file in `src/core/sources/`:

- **Open tier:** `wikipedia`, `commons`, `inat`, `openlibrary`, `marginalia`, `github`, `apod`, `aic`, `kagi`, `europeana`, `openverse`, `library` (the starter library), `oldweb` (GeoCities through Wayback), `itch`.
- **Probe tier:** `met`, `cleveland`, `nasaimages`, `loc`, `wiby`, `kagirandom`, `smithsonian`, `hn`.
- **Archive (Plan 04):** `ia` for Archive non-game sources, and `vault` for Archive games.
- **Snapshot (Plan 04):** `webring`, for webring and Neocities sites built by the data job.
- **Pseudo-source (no adapter):** `shared`, for links shared into the Android app (Plan 08).

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
 *  @property {{privilegedFetch:boolean, localNetworkHttp:boolean, inAppSiteView:boolean, labHref:string, framesArchive:boolean, leanBack?:boolean}} caps
 *    caps.leanBack: absent means true. The extension sets it to false on the 'panel' surface.
 *    It lives in caps, NOT as a top-level platform.leanBack.
 *  @property {(kinds:Array<'searchTerms'|'browsingActivity'>) => Promise<boolean>} [requestDataCollection]
 *    optional. On Firefox it calls permissions.request({data_collection: kinds}) as its first statement and returns
 *    false on any throw. Absent or true elsewhere. Asked when AI, or "More like this page", is first used.
 *  @property {() => Promise<boolean>} persistStorage
 *  @property {(origins:string[]) => Promise<boolean>} requestOrigins
 *    Called from a button when the user adds a custom endpoint or a model on the local network.
 *    PWA: resolves true (CORS decides). Extension: permissions.request for those origins.
 *    Android: the native per-host approval dialog for http hosts (https needs none).
 *  @property {(app:App) => Promise<void>} [attach]   optional; boot calls `await platform.attach?.(app)` once the app is built
 *  @property {{launchWebAuthFlow(opts:{url:string, interactive:boolean}):Promise<string>}} [identity]
 *    optional; Connect OpenRouter outside the PWA. Extension (Plan 07): chrome.identity / browser.identity,
 *    with the optional "identity" permission. Android (Plan 08): an in-app login WebView that catches the
 *    callback URL. The PWA has none, and uses a redirect to the Pages callback instead.
 *  @property {{version():Promise<{versionName:string, versionCode:number, sdk:number, micConsent:boolean}>,
 *              checkUpdate():Promise<{available:boolean, latest:string|null, url:string|null}>,
 *              openExternal(url:string):Promise<void>}} [app]   Android only
 */
/** @typedef {{get(id:string):Promise<string|null>, set(id:string, value:string):Promise<void>, delete(id:string):Promise<void>, list():Promise<string[]>}} SecretStore */
/** @typedef {{kind:'web-local'|'web-cloud'|'native'|'none', vendor:'google'|'apple'|'microsoft'|'mozilla'|'android'|null, needsDownload:boolean, continuous:boolean, reason:string|null}} VoiceStatus */
/*  VoiceStatus convention for a recogniser that only works in the cloud, before the user opts in:
 *    probe({allowCloud:false}) → {kind:'none', vendor:<the vendor>, reason:'cloud-only', …}.
 *  The UI shows the vendor-named opt-in for exactly this case. After opt-in, probe({allowCloud:true})
 *  returns 'web-cloud' (web) or 'native' with that vendor (Android). */
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
  | `secrets`: the SecretStore every key goes through. `ctx.secrets` is this object | 02 sets it to `platform.secrets`; 05 replaces it with the keyring, which has the same get/set/delete/list, so the passphrase lock covers the `src:*` keys too |
  | `search(text) → Promise<{finds: Find[], note?: string}>`: keyword search through `engine.search`, which injects the results into the queue | 02 |
  | `search`, upgraded to `aiSearch` when an AI provider is set up. The `note` carries the cost line | 05 |
  | `handsFree` | 03 |
  | `ia` | 04 |
  | `keyring`, `budget` | 05 |

- **The Stumble search form (Plan 02).** It has a text field labelled **Search for** and a button **Search**, and submitting calls `app.search(text)`. The `/` key (Plan 03) focuses that field. Plan 05's e2e tests use this same form.
- **AI badges (Plan 02).** `renderCard` shows **Found by <labels>** from `find.foundBy`, and **Team pick** when `find.teamPick` is set. Plan 05 only fills those fields.
- **Rabbit Hole AI hook (Plan 02 defines; Plan 05 uses).** `engine.rabbit.useAi(fn|null)`, where `fn(find) → Promise<Find[]>`. Rabbit Hole mixes those finds in, after the source and local ones. Plan 05 sets it only when `settings.aiInRabbitHole` is on and an AI provider is ready.
- `ui/views/stumble.js` (Plan 02) also exports:
  - `showResult(result)`, which renders a `{find, branch, why}` or `{empty, reason}` result;
  - `getCurrentFind() → Find|null`;
  - `setMode(mode)`.

  The hands-free controller and the AI plan use only these three.

- `data` has the keys `tags`, `library`, `vaultStarter` and `geocities`, and each later plan adds its own.
- **One data loader:** `src/core/data.js` exports `loadAppData({fetchFn, base, dataUrl, http, store}) → Promise<{tags, library, vaultStarter, geocities, loadSnapshot, embedBroken}>`. It is DOM-free.
  - Plan 01 creates it with the four `src/data` files, and `ui/boot.js` calls it.
  - Plan 04 adds `loadSnapshot(name)` (through `dataUrl`) and `embedBroken`.
  - Plan 07's background (`bg.js`) calls the same function instead of repeating it.
- `dataUrl(file) → string` (Plan 01) gives the address of a generated data file such as `daily.json`, `itch.json` or `vault-index.json`. In the PWA it is relative (`data/<file>`). In the extension and Android it is `https://iteatsthesalt.github.io/Game-Dev-Resources/byways/data/<file>`, because those builds do not include the generated files.

**UI conventions (Plan 01):**

- **The routed page.** The router renders each view's `title` as the page's `<h1>`. The DOM is `#app > div.view > h1` (the title) followed by `div.view-body`, which is the container passed to `render`.
  - Views never render their own h1. Settings section pages use an h2.
  - A view that must change its heading text sets `container.closest('.view').querySelector('h1').textContent`. Daily Fate does this to show "Daily Fate (backup pick)".
  - Import keeps the heading "Import" and says "Shared with you" in the body.
- **Open dialogs and Android Back.** Before anything else, if a `dialog[open]` exists, the router closes the topmost one and treats Back as handled. So dialogs from any plan need no Back handling of their own.
- **Android Back in the router.** `startRouter` listens for `byways:back` and reads `event.defaultPrevented` on a microtask, after every listener has run. It calls `history.back()` only when nothing prevented the event and the hash is not home (`''`, `'#'`, `'#/'`, `'#/stumble'`). At home, Back leaves the app. Plan 08's `attach` only dispatches the event. It reports `handled = prevented || not home`, and never calls `history.back()` itself.
- **Toasts.** `showToast(message, {undo, ms = 5000, action: {label, run}} = {}) → {close()}`. With `ms: 0` a toast is sticky, and later toasts do not replace it (for example the update toast).
- **`NetError`.** It can be built as `new NetError(kind, message = kind, {status, retryAfterMs, source} = {})` or as `new NetError({kind, message, status, retryAfterMs, source})`.
- **`tools/check.js` CSP rule.** `expectedCsp(path) → string`:
  - Pages in a `lab` folder get `LAB_CSP`.
  - `lab/index.html` adds `'self'` to `frame-src`, and `dos.html` and `console.html` add `blob:` to `connect-src`.
  - If `flash.html` needs `'unsafe-inline'`, Plan 06 adds that case.
- **Other Plan 01 names:**
  - `dataUrlFor(platformName, file)` (boot.js; `app.dataUrl` wraps it);
  - `renderIcons({svgPath, outDir})` (tools/icons.js);
  - `startRouter(render, win)`;
  - the unit helpers `tests/unit/helpers/async.js` (`flush()`, `deferred()`) and `tests/unit/helpers/fake-dom.js` (`fakeDocument() → {document, created}`).
- **Orders.**
  - Settings sections: `taste` 10, `sources` 20, `voice` 30, `access` 40, `ai` 50, `data` 60, `privacy` 70, `about` 90, `licenses` 100.
  - First-run steps: `welcome` 10, `interests` 20, `handsfree` 30, `ai` 40.
- **Settings section ids and owners:**

  | Sections | Plan |
  |---|---|
  | `about` (version, build id, links) | 01 creates; 08 adds the update check |
  | `taste`, `sources`, `data`, `privacy` | 02 |
  | `voice` and `access` (which holds the dwell time and, on Android, Plan 08's **Go straight to the site** checkbox) | 03 |
  | `ai` | 05 |
  | `licenses` | 06 |

- **Android Back.** Plan 08 dispatches a cancelable `CustomEvent('byways:back')` on `window`. An open panel, menu or help card closes itself and calls `preventDefault()`. If nothing does, the router goes back.

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
    // motion 'system' | 'reduced' | 'full'; theme 'system' | 'light' | 'dark' | 'high-contrast'; font 'system' | 'atkinson'
  goStraightToSite: false,                       // Android site view only
  sessionLengthMin: null, exploringCue: false,
  voice: { mode: 'auto', cloudOptIn: false, voiceURI: null, rate: 1, volume: 1, lang: 'en-US' },
    // mode 'auto' | 'always' | 'push' | 'off'. Per spec §6.2, 'auto' resolves to:
    //   'always' for web-local, for web-cloud after opt-in on browsers that are not Android, and for native continuous (Android 13+);
    //   'push' for Android browsers (each restart beeps) and for native Android 24–32.
  ai: { provider: null, model: null, runCapUsd: 0.5, dailySearchCap: 50, dailySpendCapUsd: 2,
        baseUrls: {},                            // {[providerId]: user-entered base URL} for custom, ollama, lmstudio
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
// ctx = {http, rand, clock, cache, settings, secrets, data, platformName, caps, dataUrl}
//   caps is platform.caps; dataUrl is app.dataUrl (for snapshot files such as itch.json)
```

**SecretStore ids** (fixed, so that backup, settings and adapters agree):

| Id | Holds |
|---|---|
| `src:europeana` | the Europeana key |
| `src:openverse` | JSON `{clientId, clientSecret}` |
| `src:datagov` | the api.data.gov key, used for APOD and Smithsonian. Without it, `DEMO_KEY` is used |
| `src:marginalia` | the Marginalia key |
| `src:github` | a read-only GitHub token |
| `ai:<providerId>` | AI keys, for example `ai:anthropic` and `ai:ollamaweb` |
| `__lock` | the keyring's lock record |

**Router params.** `#/<route>/<segment>` gives `params.id = <segment>`, for example `#/daily/2026-11-11` → `{id:'2026-11-11'}`. `#s=<payload>` gives `{payload}`.

**The Play button.** `renderCard` shows **Play** instead of **Open** when `find.embedUrl` is set, and shows every `find.why` chip as visible text.

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
  - `find` fires every time the engine hands a find to the UI: from `next`, `back`, `rabbit.next`, and the first find after `inject`.
  - **Several engines on one store.** The extension runs up to three engines (background, side panel, Byways tab) on one store, so:
    - `engine.next` checks `await seen.has(find.url)` again for the picked find just before returning it, and pulls again when it is already seen;
    - `history.push` re-reads the stored list before writing, merges by find id, sorts by time and keeps the last 50, so writers do not overwrite each other.

**More Plan 02 additions** (other plans may use these):

- `history.ready` and `collections.getCurrent()` / `setCurrent(id)`.
- `runProbes(adapters, http, store, clock, platformName = 'pwa')`.
- `enabledSources(settings, probe, platformName, all)`.
- `createEngine` takes optional `seen`, `history` and `collections`, and `settings` as an object or a getter. It adds `engine.pool()` and `EMPTY_REASONS`, and also `engine.rabbit.useAi(fn|null)` (above).
- `createRabbitHole({sources, ctx, seenHas, pool})`.
- `renderCard(find, {onAction, compact, whyLine})` and `makeActionHandler(app, {advance, whyLine})`.
- `shareItem` / `itemToFind` and `SHARE_BASE`.
- `backupFileName(clock, includeKeys)`.
- `generatedImage(find)`.
- `INTEREST_TAGS` (25 ids).
- Unit helpers in `tests/unit/helpers/fixture-http.js`: `adapterCtx` and `engineFor`.
- The e2e helper `stageLibrary(page, entries)` in `helpers/net.js`. Its `skipFirstRun` is the one in `helpers/app.js`.

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

- `createHandsFree({engine, listener = null, reader, clock, getSettings, ui, leanBack = true, getListenMode, prepare, dispatch}) → {start(), pause(), resume(), stop(), suspend(), wake(), input(), command(id, arg), get state}`.
  - `start()` awaits `prepare() → Promise<listener|null>`, which probes and returns a fresh listener. That listener replaces the old one, which is stopped and unsubscribed.
  - `dispatch(id, arg)` receives the listener's command events.
- **One controller.** `app.handsFree` is one object for the app's whole life. `boot()` creates it by calling `installHandsFreeUi(app)` (`ui/handsfree-ui.js`) once the engine exists and BEFORE `runFirstRun`, and never replaces it.
  - `app.handsFree.start()` runs the full Start routine: probe, new listener, wake lock, media active, lean-back.
  - Plan 07's toggle and Plan 08's no-touch start call `app.handsFree.start()`.
- **Lean-back flag.** `installHandsFreeUi` reads `app.platform.caps.leanBack`, where absent means `true`, and passes it as `leanBack`. Plan 07 sets `caps.leanBack: false` for the side-panel surface.
- **Engine switches for lean-back.** `engine.next({mode, ai = true, leanBack = false})`:
  - With `ai: false`, `rabbit.next` skips the `useAi` hook. Lean-back passes `ai: settings.leanBackAI`.
  - With `leanBack: true` and the Family filter on, `mixed` finds are skipped, including injected ones.
- **Family filter at inject.** `engine.inject(finds, origin)` does NOT apply the Family filter to finds from a search the user asked for (origins `'search'` and `'ai'`). Tuned picks, Fate and lean-back's own pulls keep it (§7.4).
- **Other Plan 03 names:**
  - `cardScript(find, why = null)`, where `why` is `result.why` from `engine.next`;
  - `Tts.speak(text, {voiceURI, rate, volume, lang})`;
  - `createWebTts(speechSynthesis, Utterance = globalThis.SpeechSynthesisUtterance, {clock} = {})`;
  - `createWebVoice(win, {lang = 'en-US'} = {})`;
  - `createWebMedia(navigator, {silentAudio = false, createAudio, createObjectURL} = {})`;
  - `installKeymap({getSettings, dispatch, onTalk, target = document}) → uninstall()`.
- **Listening on and off.** The controller also has `get listening → boolean` and `setListening(on) → Promise<boolean>`, which turns the mic on or off within the current session. `setListening(false)` is the same as `command('stopListening')`. Plan 07's Alt+Shift+V uses them.
- **Read it on a specific card.** `command('read', find)` reads that find. Card **Read it** buttons (Stumble, Feed, the panel's mini feed) pass their own find. With no find, it reads the current Stumble find.
- **Talk button.** The bar has a **Talk** button in push mode, which works whatever the single-key setting is:
  - a press shorter than 300 ms is a tap, which listens for one command;
  - holding works like V;
  - listening continues for 1.5 s after release, and a turn is capped at 8 s.
- **Cloud-only convention.** It also covers a recogniser that is `downloadable` or `downloading` and has no opt-in: `{kind:'none', vendor, needsDownload:true, reason:'cloud-only'}`. The UI then offers both **Download offline voice** and the vendor-named opt-in.
- **Unit helpers.** `tests/unit/helpers/handsfree-fakes.js` gives `makeHarness` and `makeListener`.
- With `leanBack: false`, Start gives voice commands and read-aloud but no auto-advance. The extension side panel uses this, because §6.5 lists only the Byways tab as a lean-back surface in the extension.
- Plan 03 also gives the controller:
  - the option `getListenMode() → 'always'|'push'|'off'`, and accepts `listener: null` when there is no voice;
  - the methods `showing(find)`, `hold(reason)`, `release(reason)`, `talk(on)`, `setMuted(on)` and `get muted`;
  - the `ui` hooks `act(id)`, which presses the visible card button for that command, and `recap(shown)`.
- **Recap.** It appears when a session ends (Stop, or the session length runs out), and only if something was saved in that session.
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
- `validateCollections(ia, cache, ids = [...verified, ...likely]) → Promise<string[]>`.
- `gemQuery(id, page) → params` and `gemScore(doc, {currentYear, curated:Set}) → number`, using the §10.2 formula.
- `gemWhy(doc) → string[]`.
- `vaultFate(ia, rand, collections) → Promise<Find|null>`.
- `iaDocToFind(doc, {kind, safety = 'curated', why}) → Find|null`. It returns `null` for an invalid identifier.
- Also: `CURATED_COLLECTIONS`, `shelfGems(ia, shelf, opts)`, and a `keyboard` flag on each shelf.

**`ia/client.js`** also gives:

- `sharedIaClient(...)`, which keeps one client per `http` object;
- `IaClient.wayback(url, timestamp) → Promise<{url, timestamp}|null>`;
- `luceneEscape(text)`.

**More Plan 04 names** (from its review):

- **Snapshot reader.** `sources/index.js` exports `readSnapshot(ctx, file) → Promise<object|null>`. It does `ctx.http.getJson(ctx.dataUrl(file), {source: 'pages'})`, caches the result under `snap:<file>` for 1 h, and returns `null` on any error. The vault, itch and webring adapters all use it.
- **The `pages` Http source.** Plan 01's boot registers it as `app.http.register('pages', {perMinute: 30, concurrent: 2})`. `dataUrlFor` is Plan 01's; Plan 04 does not define a second one.
- **Card changes made by Plan 04:**
  - `renderCard(find, {onAction, compact, whyLine, headingLevel = 2})`. Cards inside h2 sections (Vault shelves, Daily picks) use `headingLevel: 3`.
  - A find with `embedUrl` shows a **Details on archive.org** link, a **Keyboard needed** badge on a coarse pointer, and a `div.player` slot.
  - **Play** calls `onAction('play', find, {slot})`.
  - `card.js` exports `mountPlayer(slot, find, app) → Promise<{unmount()}|null>`. `makeActionHandler`'s `play` calls it, so Archive finds play through the embed in Stumble, Feed and Saved too.
- **Archive pacing.** No plan calls `http.register` for `ia` or `vault`, because the IA queue owns Archive pacing and backoff. Plan 02's `adapterCtx` skips those two ids.
- **Urgent lane.** `IaClient` methods take `{urgent: true}`, which puts a call at the front of the queue, still at 1 per second. User actions such as Play, More gems and opening a shelf use it. First-run collection validation does not.
- **`gemWhy`.** Its first chip is the pool chip, `'Internet Archive: <collection label>'` (or `'Internet Archive'`).
- **Placeholder data files.** The PWA build writes `{"v":1}` placeholders for `daily.json`, `itch.json`, `vault-index.json`, `webrings.json` and `neocities.json` into `dist/pwa/data/` when they are missing, so local and e2e runs never 404. The data job overwrites them.
- **Test files.**
  - `tests/fixtures/routes.js` has a catch-all for `https://iteatsthesalt.github.io/Game-Dev-Resources/byways/data/` that returns `pages/empty.json` (`{"v":1}`), plus a route for `img.itch.zone` images.
  - `tests/unit/helpers/fake-fetch.js` gives `fakeFetch`, `instantClock` and `readFixture`.
  - Timed e2e tests (the watchdog, the rollover) use Playwright's `page.clock.install()` with `pauseAt` and `runFor`, so that time does not drift.

**`sources/webring.js`** (Plan 04). A snapshot-tier adapter that reads `webrings.json` and `neocities.json` from `dataUrl`. It returns domain cards, with `fate: true` and safety `mostly`. If neither file exists, it returns nothing and does not throw.

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

**Plan 05 additions** (from its review):

- **Adapter signatures.**
  - `search({provider, key, model, brief, transport, signal, maxUses, maxTokens, modelInfo, baseURL, role, meter})`. `AiResult` adds `unknownPrice`, `searchErrors` and `model`, the model that actually answered.
  - `complete(...)` returns `{json, usage, costUsd}`.
- **Search and team.**
  - `aiSearch({query, app, env, inject = true})` returns `note` too.
  - `runTeam` takes `settings` instead of a run-cap number, plus `resolveUrl` and `modelInfoFor`.
  - `cost.js` adds `cautiousPrice(providerId)`, `planRun(...)` and `createMeter(capUsd)`.
  - `grounding.js` adds `groundedFinds(result, label, {resolveUrl})`.
  - `search.js` adds `aiReady(settings, keyring)`, `syncRabbitAi(app, env)` and `rabbitQuery(find)`.
  - `openrouter-pkce.js` adds `pkceMode(platform)` and `connectWithIdentity({identity, transport})`.
  - `models.js` adds `saveBaseUrl(app, providerId, url)`.
  - `AiError` is built as `new AiError(kind, message, {provider, status, retryAfterMs, hint, setupText})`.
- **`PROVIDERS` row fields.**
  - `adapter`, `baseURL`, `auth` and `modelsPath` may be `null`.
  - New fields: `modelsFallbackPath`, `modelsFromRoot`, `searchTool`, `searchModels` (RegExp), `extraHeaders`, `fallbackModels` and `userBaseURL`.
  - `prices` keys may be `'<prefix>*'`, and a price may carry `over100k: {in, out}`.
  - The Claude row lists every current Claude model price from the claude-api reference, including the fallback targets.
  - OpenRouter and xAI estimates use the prices their model lists return.
- **Claude request details.**
  - `fallbackModels` is the reference's list (Opus 5.5, Sonnet 5.5, Fable 5.2, Fable 5.1 and Opus 5). Requests to those models send `fallbacks: 'default'` and `anthropic-beta: server-side-fallback-2026-07-01`.
  - Cost and **Found by** follow `res.model`.
  - The web search tool version is chosen per model from the reference's list of models that support `web_search_20260209`. Any other model gets `web_search_20250305`.
- **Local models** (Ollama, LM Studio) return leads (§12.5). Nano ranks candidates.
- **The cost note** shows in Plan 02's Stumble `p.note`. There is no `ui/components/cost-line.js`.
- **Test files:** `tests/unit/ai/fake-transport.js`, `tests/e2e/helpers/ai.js` and `tests/fixtures/http/ai/README.md`, which marks unverified fixtures.

**Transport rules every shell honours** (Plans 01, 07, 08):

- `transport.fetch` honours `init.redirect === 'error'`. Plan 05 sends it on every request that carries a key, so a key never follows a redirect to another host.
- With `privileged: true`, the transport reports the final URL after redirects. A browser `Response` has it in `Response.url`. A constructed `Response` (Android `nativeFetch`) carries it in the header `x-byways-final-url`.
- `requestOrigins(origins)` takes plain origins (`scheme://host[:port]`), and each shell maps them to its own permission form.
- `platform.identity` (when present) also has `getRedirectURL() → Promise<string>`, the callback URL its flow catches.
  - In the extension, it first asks for the optional `identity` permission, which must be the first call in the click, and then returns `identity.getRedirectURL()`.
  - Plan 05 passes the result as `callback_url`.
  - There is no `redirectUrl` property.
- Plan 07's `host_permissions` include `https://vertexaisearch.cloud.google.com/*`, for resolving Gemini redirect links.
- `renderCard` (Plan 02) shows `find.meta.displayDomain` in place of `domainOf(url)` when it is set.

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

These plans define their own runner, background and bridge protocols inside the plan. They use only the `Platform` shape above to talk to the shared UI. Their entry points:

- **Plan 07 (extension):**
  - `platform/extension.js`: `createExtensionPlatform({ext, win, surface: 'background'|'panel'|'tab'}) → Platform`.
  - `shells/extension/bg.js`: `createBackground({ext, getEngine, resetEngine})`.
  - `tools/build.js`: `buildExtension(browser, outDir, opts)`.
  - `tools/check.js`: `checkExtensionDir(dir, browser)`.
  - Extension pages use `EXT_PAGE_CSP`, which is the web app CSP with `connect-src 'self' https: http:`.
  - `mockNet` and `unmocked` also accept a `BrowserContext`.
- **Plan 08 (Android):**
  - `platform/android.js`: `createAndroidPlatform({bridge, base, win}) → Platform`, including `app` and `attach`.
  - `labSaveFile(name, blob, win)` and `SAVE_CHUNK_BYTES` (6 MiB). They live in `src/lab/storage-panel.js`, not in `platform/android.js`, so the Lab origin loads no app code. `BywaysLabNative` takes `files.save` and chunked `files.append`.
  - The native side holds events until the web side sends `app.ready`, so a link shared in on a cold start is not lost.
  - **openFind on Android.** Every `how` value (`'tab'`, `'current'`, `'inapp'`, none) opens the in-app site view. Only the site view's **Open in browser** and `platform.app.openExternal` leave the app. The card's Open announcement follows `caps.inAppSiteView`: "Opened in the site view." on Android, "Opened in a new tab." elsewhere.
  - **Links shared in.** They become finds with the pseudo-source `shared`, which has no adapter.
    - The taste profile ignores its source weight.
    - Rabbit Hole uses Marginalia's `more()` for it.
    - `generatedImage` shows "Shared".
    - Plan 02 handles this id in `taste.js`, `rabbit.js` and `generated-image.js`.
  - The build writes the entry `assets/www/android-boot.js`.
  - The test helper `installFakeAndroidBridge(page, opts)` lives in `fakes.js`.

### Settings → Privacy (Plan 02 owns it)

Plan 02 creates `ui/views/settings/privacy.js` with the whole text. No other plan edits it. The text holds:

- the §15.1 network table and the "no Byways server, no analytics" lines;
- the voice-vendor note (§6.2) and the shared-origin microphone note;
- the key advice (§12.8);
- the Lab limit in the web app (§11.2).

### Plan 06: Lab

**`tools/vendor.js`**

- It exports:
  - `VENDOR_PACKAGES(versions) → Array<{name, version, dir, files}>`;
  - `LICENCE_NOTES`: an object of `{name, licence, source, note?}` entries, keyed by npm name plus `'seabios'`, `'atkinson'` and `'byways'`. This is the one licence table, used by the Licenses screen, `THIRD_PARTY_NOTICES.md` and Plan 09;
  - `vendor({root, fetchImpl}) → Promise<manifest>`, which writes `vendor/manifest.json`;
  - `labOutputs(target) → Array<{from, to}>`;
  - `buildLicenses({versions, target}) → {v:1, components}`, written as `licenses.json` at each output's app root.
- Vendored files live in `vendor/<npm name>@<version>/`.
- `npm test` and `npm run e2e` need `vendor/`, and the build stops with `vendor/ is missing. Run npm run vendor first.` CI runs `npm run vendor` after `npm ci`.

**Stopping the Lab.** The Lab opens with `rel=noopener`. App and Lab talk over `BroadcastChannel('byways-lab')`:

- Lab → app: `{type:'running', on:boolean}`;
- app → Lab: `{type:'stop'}`.

`ui/handsfree-ui.js` gains `connectLab({channel, handsFree, announce}) → {get running, stopLab(), close()}`. The channel is same-origin only, so the extension (which opens the hosted Lab) and Android (where the Lab has its own origin) rely on the visible **Exit** button.

**Lab CSP.** The Lab pages extend the web app CSP. On top of the global Lab additions:

- `lab/index.html` adds `'self'` to `frame-src`, so it can frame its runner pages;
- `dos.html` and `console.html` add `blob:` to `connect-src`;
- `flash.html` may add `style-src 'unsafe-inline'`, but only if its e2e test shows Ruffle needs it.

**Other Lab facts:**

- **Android layout:** `assets/lab/{lab/**, vendor/**, versions.json}`. Nothing Lab-related goes in `assets/www`.
- **Licenses screen:** a settings section with `id:'licenses'` and `order:100`.
- **Service worker:** the `byways-vendor` cache holds same-origin GETs under `vendor/` and is never deleted on activate.
- **Test files:** `tests/fixtures/files/make.js` generates the tiny Lab test files.

### Version numbers and Android signing (Plan 08 creates; Plan 09 uses)

**Version numbers.** `shells/android/gradle.properties` holds `byways.versionName=<x.y.z>` and `byways.versionCode=<x*10000 + y*100 + z>`. `app/build.gradle.kts` reads both with `providers.gradleProperty(...)`. The versionName must equal the `package.json` `version`, `APP_VERSION`, and the version in both BUILT extension manifests (see "version wiring" below).

No environment variable sets the version. The release APK asset is named `byways-<version>.apk`, and a debug build is named `byways-<version>-debug.apk`. Android's update check picks the first `.apk` asset of the newest `byways-v*` release.

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
  - `main({argv, fetch, root, log}) → Promise<number>`, the body of the CLI.
- It takes its component list from `VENDOR_PACKAGES` and its licences from `LICENCE_NOTES`, both in `tools/vendor.js`. There is no second licence table.
- **What each Release attaches.** Source archives for every vendored emulator component and core, whatever the licence. Also the code compiled into them that their own repos leave out: EmulatorJS's RetroArch fork and build scripts as of the core build, and js-dos's `emulators` repository with its DOSBox and DOSBox-X submodules. Also SeaBIOS at the ref v86 used (`rel-1.16.2`).

**`tools/check.js`, version wiring**

- `runChecks({srcDir, outputs, extraHtml, appRoot})`. When the optional `appRoot` is given, it also runs `checkVersions(appRoot)`, and the `--check` build passes it.
- `src/core/version.js` is exactly one line: `export const APP_VERSION = '<x.y.z>';`.
- "The version in both extension manifests" means the BUILT manifests, which Plan 07's build writes from `package.json`. `manifest.base.json` keeps `"version": "0.0.0"` and the overlays set no version. `checkVersions` checks both of these.

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

// The data job ALWAYS writes every generated file (daily, itch, vault-index, linkcheck, webrings, neocities).
// If a source fails it keeps the last good file from the live site; if there is none, it writes a valid
// empty shape, so the app never requests a missing file (a 404 would show as a console error).
// dist/pwa/data/webrings.json: { "v":1, "generatedAt":"ISO", "ring":"xxiivv", "sites":[ { "url", "title" } ] }
// dist/pwa/data/neocities.json: { "v":1, "generatedAt":"ISO", "sites":[ { "url", "title"? } ] }
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

**Icons (Plan 01):** `node tools/icons.js` renders `src/assets/icons/icon.svg` to `icon-192.png`, `icon-512.png` and `maskable-512.png` with Playwright's Chromium. The PNGs are committed, and the web manifest lists all four icons.

**Serve:** `node tools/serve.js --root dist/pwa --base /Game-Dev-Resources/byways/ --port 4321`. It serves the build with correct MIME types, including `application/wasm`.

**npm scripts:**

| Script | Runs |
|---|---|
| `build` | `node tools/build.js --target all` |
| `check` | `node tools/build.js --check` |
| `test` | `node tools/build.js --check && node --test "tests/unit/**/*.test.js"` (the bare folder form fails on Node 22.23) |
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
- **The one set of e2e helpers (Plan 01).** Later plans use these and do not define their own versions:
  - **`tests/e2e/helpers/net.js`:**
    - `test` and `expect`: a Playwright `test` whose `page` fixture calls `mockNet` and, after each test, asserts that `unmocked(page)` and `pageProblems(page)` are both empty;
    - the fixture option `ignoreProblems: RegExp[]` (default `[]`), set with `test.use({ignoreProblems: [...]})`, for known harmless console errors such as EmulatorJS's missing `emulator.min.js`;
    - `pageProblems(target, {ignore = []} = {}) → string[]`: page errors and console errors that no pattern matches. `target` may be a Page or a BrowserContext; for a context it uses the `console` and `weberror` events.
  - **`tests/e2e/helpers/app.js`:**
    - `gotoApp(page, hash = '#/stumble') → Promise<void>`: opens the app at the base path and skips first run;
    - `skipFirstRun(page) → Promise<void>`: clicks **Skip** while it is visible.
  - **`tests/e2e/helpers/axe.js`:** `expectNoSeriousA11y(page, {exclude = []} = {}) → Promise<void>`.
  - **`tests/e2e/helpers/fakes.js`:** `installFakeSpeech(page)`. Plan 08 later adds `installFakeAndroidBridge(page, opts)`.
  - **`tests/unit/helpers/fake-dom.js`:** `fakeDocument() → {document, created}`. **`tests/unit/helpers/async.js`:** `flush()` and `deferred()`.
  - **CORS preflights in `mockNet`.** It answers preflights with `access-control-allow-headers` echoing the request's `access-control-request-headers`. `*` does not cover `Authorization`, so tests that send a key would otherwise fail.
  - **Strict console rule.** The e2e fixture fails a test on ANY console error, including 404 "Failed to load resource" messages. Specs must stage or route every same-origin file their views fetch, for example the generated `data/*.json` files, which `dist/pwa` lacks in e2e. For known harmless noise, use `test.use({ignoreProblems: [...]})`. `pageProblems` returns strings of the form `'console: <text>'` and `'pageerror: <message>'`.
  - **Service workers** are blocked in e2e unless a spec sets `test.use({serviceWorkers: 'allow'})`. While blocked, `navigator.serviceWorker.ready` never settles and `page.route` does not see worker requests.
  - **`installFakeSpeech` window hooks:**
    - `__say(text, final = true)`, `__voiceError(code)`, `__recognizers`, `__spoken`, `__wake = {requests, releases}`;
    - `cancel` fires `interrupted` or `canceled`;
    - the fake voices are `local-en` and `net-en`.

    Plan 03 extends it, with `__utterances`, `__speechCancels`, `__endSpeech()`, `__recStarts`, `__media`, `__announcements`, and the options `{available, holdSpeech}`.

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
  - `<version>` is `APP_VERSION` from `src/core/version.js` (Plan 01). That file is edited by hand at a version bump, and Plan 09's `checkVersions` makes sure it matches `package.json`, both extension manifests and `gradle.properties`.
  - `sources/index.js` exports `IDENT`, built from `APP_VERSION`.

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
