# Byways 08: Android App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap the Byways web app in a sideloadable Android app with native voice, speech, media keys, networking, share-in, an in-app site view and the Lab on its own origin.

**Architecture:** One Kotlin Activity hosts a main WebView that serves the web build from APK assets through `WebViewAssetLoader`, plus a second bridge-less WebView for sites. The web layer talks to Kotlin only through `addWebMessageListener` with a small JSON codec, and `src/platform/android.js` turns that bridge into the contract's `Platform` object. Logic that can be tested without a device (URL policy, HTTP executor, codec, error map, link policy, update compare) lives in plain Kotlin classes with JVM tests that run in GitHub Actions.

**Tech Stack:** Kotlin (AGP 9.3.2 built-in Kotlin), Gradle 9.7.1 (no wrapper), `androidx.webkit:webkit:1.18.0`, `androidx.activity:activity-ktx:1.11.0`, JUnit 4.13.2, `org.json:json:20240303` (tests only), JavaScript ES2022 modules, `node:test`, `@playwright/test@1.63.0`.

**Spec:** `docs/superpowers/specs/2026-11-11-byways-design.md` (§13.4, §4 Android column, §6.2, §6.4, §6.6, §14.3, §17.1, §17.3, §20). Contract: `docs/superpowers/plans/2026-11-11-byways-00-overview.md`. Notes: `docs/superpowers/specs/byways-research/platform-shells.md`, `hands-free.md`, `other-providers.md`.

## Global Constraints

- Everything in the overview's "Global constraints (every plan)" and "Working conventions" applies. These are the lines that bite this plan, verbatim from the spec:
- **Package:** `io.github.iteatsthesalt.byways`.
- AGP 9.3.2 with built-in Kotlin (no `kotlin-android` plugin); Gradle 9.7.1; compileSdk 37, targetSdk 36, minSdk 24; `androidx.webkit:webkit:1.18.0` (fall back to 1.17.x if it does not resolve) and `androidx.activity`; JDK 21.
- No Gradle wrapper is committed; CI runs `gradle`.
- A **main WebView** for the Byways UI, served by `WebViewAssetLoader` at `https://appassets.androidplatform.net/assets/www/`.
- A **site view** WebView for opening finds full screen inside the app, with **Back to Byways**, **Next** and **Open in browser**. It has no bridge and no file access. `intent:` links open outside the app.
- The Lab, served by a second asset loader on its own origin, `https://lab.appassets.androidplatform.net/`. It gets no main bridge, only a small `BywaysLabNative` with `files.save`.
- WebView settings: JavaScript and DOM storage on; `mediaPlaybackRequiresUserGesture=false`; third-party cookies on for the main WebView, so Archive embeds behave; file and content access off; mixed content never allowed; all WebView permission requests denied, because the mic goes through the native recogniser.
- Bridge: `WebViewCompat.addWebMessageListener(webView, "BywaysNative", setOf("https://appassets.androidplatform.net"))`. It accepts main-frame messages only. `addJavascriptInterface` is never used. It checks `WebViewFeature.WEB_MESSAGE_LISTENER` at startup.
- `nativeFetch`: Any `https` URL is allowed. `http` is allowed only to hosts you approved that are loopback, private-range IPs or `.local` names (for local models). It sends no cookies, has timeouts and caps responses at 10 MB. Keys are sent per request and never logged. All JSON API calls go through it. Images and embeds load normally. `network_security_config` allows cleartext, and the bridge code enforces the host rules.
- Manifest: `INTERNET` and `RECORD_AUDIO`; `<queries>` entries for `android.speech.RecognitionService` and `android.intent.action.TTS_SERVICE`; an `ACTION_SEND text/plain` intent filter.
- Voice runs only in the foreground and stops in `onPause`. Recogniser calls go through a main-thread handler. The first-run consent screen requests `RECORD_AUDIO`. Start: "No touch after first-run consent (Android 13+)".
- Android native voice: on-device recogniser when available, with `EXTRA_PREFER_OFFLINE`; on 13+ `EXTRA_SEGMENTED_SESSION` plus `EXTRA_AUDIO_SOURCE`; `EXTRA_LANGUAGE_MODEL=web_search` and `EXTRA_BIASING_STRINGS`. "Always on (13+). Tap to talk on 24–32."
- Read-aloud: "Android uses native `TextToSpeech` through the bridge, because WebView has no speech output." Network voices are marked "online".
- Wake lock: `FLAG_KEEP_SCREEN_ON` on Android. Headset: "Android uses a native media session."
- Lean-back runs in "the Android card view, or the Android site view when **Go straight to the site** is on (off by default)". "Lean-back never opens tabs by itself."
- Updates: "Settings → About checks `api.github.com/repos/iteatsthesalt/Game-Dev-Resources/releases/latest` and offers **Download update**."
- **Versions (contract):** `shells/android/gradle.properties` holds `byways.versionName=<package.json version>` and `byways.versionCode=<x*10000 + y*100 + z>`, and `app/build.gradle.kts` reads both with `providers.gradleProperty(...)`. No environment variable sets the version.
- **Signing (contract):** the release `signingConfig` exists only when `BYWAYS_KEYSTORE_PATH` is set, and reads that file with `KEYSTORE_PASSWORD`, `KEY_ALIAS` and `KEY_PASSWORD`. Plan 09's release workflow decodes `KEYSTORE_BASE64` into the file. Release assets are `byways-<version>.apk` and `byways-<version>-debug.apk`.
- **Generated data (contract):** on Android, `app.dataUrl(file)` is `https://iteatsthesalt.github.io/Game-Dev-Resources/byways/data/<file>`, fetched through `nativeFetch`, with the backup recipe as the fallback.
- This machine has no Android SDK and blocks Google Maven downloads. Run Gradle locally only when `ANDROID_HOME` is set; otherwise every Kotlin red and green step uses **CI checks** below.

**CI checks** (the `android` job in `.github/workflows/byways.yml`). Red: commit the new Kotlin test files alone (`Add the failing <TestName>`), push, then run
`sha=$(git rev-parse HEAD); until id=$(gh run list -w byways.yml -c "$sha" -L 1 --json databaseId -q '.[0].databaseId') && [ -n "$id" ]; do sleep 10; done; gh run watch "$id" --exit-status`.
Expected: exit 1, and the `android` job log shows `:app:compileDebugUnitTestKotlin` failing on the step's `Unresolved reference`. Green: make the task's commit, push, and run the same command. Expected: exit 0.

## Review Focus

1. **Hosts that only look local, and keys on redirects.** `http://192.168.1.5.nip.io`, `http://10.0.0.1@evil.com`, `http://2130706433`, `http://0x7f000001`, `http://010.0.0.1`, `http://[::ffff:8.8.8.8]` and a redirect from an approved LAN host to an unapproved one must all be refused, with no DNS lookup. A redirect to another origin must not carry the API key headers. Pinned by `deniesLookalikeHosts` (Task 3), `blocksRedirectToUnapprovedHost` and `dropsKeysOnCrossOriginRedirect` (Task 4).
2. **Frames and origins at the bridge.** An Archive embed iframe, a page on another origin, the Lab origin, or a sub-frame of the app must never reach `BywaysNative`. Pinned by `gateRejectsOtherOriginsAndSubframes` (Task 5).
3. **HTTP replies that are not plain 200s.** A 429 with `Retry-After`, a 204, a native network failure and an aborted request must reach `net/http.js` as a real `Response` or the same errors browser `fetch` gives, so the contract's retry logic still works. Pinned by `transport passes 429 and 204 through, maps failures and aborts` (Task 6).
4. **Messy shared text.** Text shared from chat apps carries extra words, trailing punctuation, several links, or no link. Byways share links must import, other links must become a find, and text with no link must show a message instead of crashing. Pinned by `extractSharedLink handles real share text` (Task 6) and `share-in with no link says so` (Task 14).
5. **Recreation and cold starts.** Rotating, folding, a dark-mode or font-size change, or a share that launches Byways must not leave a blank WebView, cut speech off or lose the shared link. Pinned by `activity keeps the WebView on configuration changes` (Task 2) and `a share that launches Byways is shown` (Task 14).

---

## File Structure

All paths are under `Apps/Byways/` unless they start with `.github/`.

**Web side**

| File | Responsibility |
|---|---|
| `tools/build.js` (modify) | `--target android`: copy the app into `shells/android/app/src/main/assets/www/` and write its `index.html` and `android-boot.js`. Plan 06's `labOutputs('android')` already fills `…/assets/lab/` |
| `src/platform/android.js` (create) | `createBridgeClient`, `createAndroidPlatform` (with `requestOrigins`, `identity`, `app`, `attach`), `extractSharedLink` |
| `src/ui/boot.js` (modify) | call `platform.attach?.(app)` once the app is built |
| `src/ui/components/card.js` (modify) | **Open** announces the site view on Android; the **⋯** menu closes on `byways:back` |
| `src/ui/handsfree-ui.js` (modify) | its dialogs close on `byways:back`; **Tap to talk** on Android |
| `src/ui/views/settings/about.js` (modify) | **Check for updates** and **Download update** when `platform.app` exists |
| `src/ui/views/settings/access.js` (modify) | the **Go straight to the site** checkbox in its `Lean-back` fieldset when `platform.caps.inAppSiteView` is true |
| `src/ui/views/settings/voice.js` (modify) | the Android line that says why voice is limited |
| `src/lab/storage-panel.js`, `src/lab/pc.js` (modify) | `labSaveFile` (native save, sent in parts) for exports and **Download state** |
| `tests/unit/build-android.test.js`, `tests/unit/android-shell.test.js`, `tests/unit/platform-android.test.js` (create), `tests/unit/build.test.js` (modify) | Node tests |
| `tests/e2e/helpers/fakes.js` (modify), `tests/e2e/android.spec.js` (create) | fake `BywaysNative` and the Android e2e spec |
| `.github/workflows/byways.yml` (modify) | the `android` job |

**Android project** (`shells/android/`)

| File | Responsibility |
|---|---|
| `settings.gradle.kts`, `build.gradle.kts`, `gradle.properties`, `app/build.gradle.kts`, `app/proguard-rules.pro` | build setup, versions, signing |
| `app/src/main/AndroidManifest.xml`, `app/src/main/res/xml/network_security_config.xml`, `app/src/main/res/values/strings.xml`, `app/src/main/res/values/themes.xml`, `app/src/main/res/drawable/ic_launcher.xml` | manifest and resources |
| `…/byways/MainActivity.kt` | WebView setup, asset loaders, system behaviour, consent, share-in, lifecycle |
| `…/byways/SiteView.kt` | the second WebView and its toolbar |
| `…/byways/Bridge.kt` | `Bridge` (main listener and channel routing) and `LabBridge` |
| `…/byways/BridgeCodec.kt` | pure: `BridgeCodec`, `BridgeGate` |
| `…/byways/FetchPolicy.kt` | pure: URL policy |
| `…/byways/NativeFetch.kt` | pure JVM: HTTP executor over `HttpURLConnection` |
| `…/byways/LinkPolicy.kt` | pure: what each WebView does with a URL |
| `…/byways/SpeechErrors.kt`, `VoiceProbe.kt`, `TtsChoice.kt` | pure: native error code → `VoiceErrorCode`; the voice probe table; which TTS voice to use |
| `…/byways/SpeechBridge.kt`, `TtsBridge.kt`, `MediaBridge.kt`, `ShareBridge.kt`, `FilesBridge.kt` | native channel handlers |
| `…/byways/UpdateCheck.kt` | pure: release parsing and version compare |
| `app/src/test/kotlin/io/github/iteatsthesalt/byways/*Test.kt` | JVM tests |

`…/byways/` means `shells/android/app/src/main/kotlin/io/github/iteatsthesalt/byways/`.

## Bridge protocol

Web → native request: `{"id":"<string>","ch":"<channel>","op":"<op>","args":{…}}`. Native reply: `{"id","ok":true,"result":…}` or `{"id","ok":false,"error":{"code","message"}}`. Native → web event: `{"ch","event","data"}`. Ids are decimal strings from a counter that starts at `"1"`.

| Channel | Ops (args → result) | Events (data) |
|---|---|---|
| `app` | `hello` {} → `{versionName, versionCode, sdk, micConsent}`; `ready` {} → `true`; `checkUpdate` {} → `{available, latest, url}`; `openExternal` {url} → `true`; `openSite` {url, title} → `true`; `closeSite` {} → `true`; `siteControls` {state} → `true`; `auth` {url} → the callback URL | `shared` {text}; `siteNext`, `sitePause`, `siteStop`, `siteClosed`, `paused`, `resumed` (data `{}`) |
| `fetch` | `request` {url, method, headers, body} → `{status, statusText, headers, body, url}`; `abort` {fetchId} → `true`; `approve` {host} → `boolean` (host without IPv6 brackets) | — |
| `voice` | `probe` {allowCloud} → `VoiceStatus`; `install` {} → `boolean`; `start` {lang, phrases, allowCloud} → `true`; `stop` {} → `true` | `result` {text, final}; `state` {listening}; `error` {code} |
| `tts` | `speak` {text, voiceURI, rate, volume} → `true` at the end of the utterance; `cancel` {} → `true`; `voices` {} → `[{uri, name, lang, local}]` | — |
| `media` | `setActive` {on} → `true` | `next`, `previous`, `playPause` (data `{}`) |
| `share` | `send` {title, text, url} → `'shared'` | — |
| `files` | `save` {name, mime, base64} or {name, mime, saveId} → `'saved'\|'cancelled'`; `append` {saveId, base64} → `true` | — |
| `back` | `state` {canHandle} → `true`; `result` {token, handled} → `true` | `request` {token} |
| `screen` | `keepOn` {on} → `true` | — |

Native holds every event until the page sends `app.ready`, and holds them again from each main-frame page start. Error codes: `bad-message`, `unknown-channel`, `unknown-op`, `too-large`, `internal`, `cancelled`, `scheme`, the `FetchPolicy` and `NativeFetch` codes (Tasks 3–4), and the `VoiceErrorCode` names.

### Task 1: Android build target

**Files:**
- Modify: `tools/build.js` (the `android` branch of `build()`), `tests/unit/build.test.js` (Plan 01's placeholder test)
- Test: `tests/unit/build-android.test.js`

**Interfaces:**
- Consumes: `build({target, outRoot, id, now})` and `OUTPUTS.android = ['shells/android/app/src/main/assets/www', 'shells/android/app/src/main/assets/lab']` (Plan 01 Task 9); `shells/pwa/index.html`, whose root is `data-shell="pwa"` so that `ui/boot.js`'s last line runs `bootFromShell()`, which boots only `'pwa'` and registers the service worker (Plan 01 Task 12); `openStore`, `idbBackend`, `memoryBackend` (`core/store/db.js`), `createPwaPlatform({secretsStore})` (`platform/pwa.js`); Plan 06's `labOutputs('android')` copies and `licenses.json`.
- Produces: under `shells/android/app/src/main/assets/`, `www/` (the app with no service worker, no manifest and nothing from the Lab) holding `www/index.html` and the entry `www/android-boot.js`. The entry imports `createAndroidPlatform` from `./platform/android.js` (Task 6).

- [ ] **Step 1: Write the failing test**

`tests/unit/build-android.test.js` runs `await build({ target: 'android', outRoot: out, id: 'abc123' })` once in `before`, with `out = await mkdtemp(join(tmpdir(), 'bw-'))`, `A = join(out, 'shells/android/app/src/main/assets')` and `R = p => readFileSync(join(A, p), 'utf8')`:

```js
test('www holds the app with the Android entry', () => {
  const html = R('www/index.html');
  assert.match(html, /<html lang="en" data-shell="android"/);
  assert.match(html, /<script type="module" src="android-boot\.js"><\/script>/);
  assert.doesNotMatch(html, /rel="manifest"|ui\/boot\.js|sw\.js/);
  for (const f of ['ui/boot.js', 'platform/android.js', 'platform/pwa.js', 'core/store/db.js', 'data/tags.json', 'assets/icons/icon.svg'])
    assert.ok(existsSync(join(A, 'www', f)), f);
  for (const f of ['sw.js', 'manifest.webmanifest', 'lab', 'vendor', 'versions.json']) assert.equal(existsSync(join(A, 'www', f)), false, f);
  const boot = R('www/android-boot.js');
  for (const s of ['createAndroidPlatform', 'createPwaPlatform', 'idbBackend', 'BywaysNative']) assert.ok(boot.includes(s), s);
  assert.doesNotMatch(boot, /registerServiceWorker/);
});
test('both outputs carry build.json and the Lab keeps the Plan 06 layout', () => {
  for (const d of ['www', 'lab']) assert.equal(JSON.parse(R(`${d}/build.json`)).id, 'abc123');
  for (const f of ['lab/index.html', 'vendor/manifest.json', 'versions.json']) assert.ok(existsSync(join(A, 'lab', f)), f);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test tests/unit/build-android.test.js`
Expected: FAIL with `ENOENT` for `www/index.html`.

- [ ] **Step 3: Implement the `android` branch of `build()` in `tools/build.js`**

- Write everything under `join(outRoot, …)`, like the other branches, so that `--check` sees fresh files. Plan 06's `labOutputs('android')` copies and `licenses.json` stay as they are.
- `www/`: copy `src/core`, `src/ui`, `src/platform`, `src/data` and `src/assets` under the same names, as Plan 07's `buildExtension` does. Nothing from `src/lab`, `src/versions.json` or `vendor/`.
- `www/index.html`: `shells/pwa/index.html` with three changes: `data-shell="pwa"` becomes `data-shell="android"` (so `bootFromShell()` does nothing), the `<link rel="manifest" href="manifest.webmanifest">` line is removed, and `<script type="module" src="ui/boot.js"></script>` becomes `<script type="module" src="android-boot.js"></script>`.
- `www/android-boot.js` (fixed text): import `boot`, `createPwaPlatform`, `openStore`/`idbBackend`/`memoryBackend` and `createAndroidPlatform`; `const secretsStore = await openStore(idbBackend()).catch(() => openStore(memoryBackend()))` (the store `bootFromShell` opens); then `boot(createAndroidPlatform({ bridge: globalThis.BywaysNative, base: createPwaPlatform({ secretsStore }) }))`. It never registers a service worker.
- `tests/unit/build.test.js`: delete Plan 01's placeholder `android target writes only build.json until Plan 08`. If Plan 07 has not run yet, the placeholder is still `extension and android targets write only build.json until Plans 07 and 08`: rename it `extension targets write only build.json until Plan 07` and loop over `OUTPUTS.extension` only.

- [ ] **Step 4: Run it to see it pass**

Run: `node --test tests/unit/build-android.test.js tests/unit/build.test.js`, then `npm run check`
Expected: PASS, and `check passed`.

- [ ] **Step 5: Commit**

```bash
git add tools/build.js tests/unit/build-android.test.js tests/unit/build.test.js
git commit -m "Add the Android build target"
```

### Task 2: Gradle project, manifest and the CI job

**Files:**
- Create: `shells/android/settings.gradle.kts`, `shells/android/build.gradle.kts`, `shells/android/gradle.properties`, `shells/android/app/build.gradle.kts`, `shells/android/app/proguard-rules.pro`
- Create: `shells/android/app/src/main/AndroidManifest.xml`, `…/res/xml/network_security_config.xml`, `…/res/values/strings.xml`, `…/res/values/themes.xml`, `…/res/drawable/ic_launcher.xml`
- Create: `…/byways/MainActivity.kt`
- Modify: `.gitignore`, `.github/workflows/byways.yml`
- Test: `tests/unit/android-shell.test.js`

**Interfaces:**
- Consumes: the Task 1 assets; `package.json` `version`.
- Produces: `MainActivity` with `companion object { const val APP_HOST = "appassets.androidplatform.net"; const val APP_URL = "https://appassets.androidplatform.net/assets/www/index.html" }` and a `lateinit var webView: WebView`. The Gradle properties `byways.versionName` and `byways.versionCode`, and the release signing inputs `BYWAYS_KEYSTORE_PATH`, `KEYSTORE_PASSWORD`, `KEY_ALIAS` and `KEY_PASSWORD`, which Plan 09 uses.

- [ ] **Step 1: Write the failing test**

`tests/unit/android-shell.test.js` reads the files as text (`const R = p => readFileSync(p, 'utf8')`, with `S = 'shells/android'`):

```js
test('gradle versions match the spec', () => {
  const app = R(`${S}/app/build.gradle.kts`);
  for (const s of ['namespace = "io.github.iteatsthesalt.byways"', 'applicationId = "io.github.iteatsthesalt.byways"',
    'compileSdk = 37', 'targetSdk = 36', 'minSdk = 24', '"androidx.activity:activity-ktx:1.11.0"', 'JavaVersion.VERSION_21',
    '"junit:junit:4.13.2"', '"org.json:json:20240303"', 'isMinifyEnabled = false'])
    assert.ok(app.includes(s), s);
  assert.match(app, /"androidx\.webkit:webkit:1\.1[78]\.\d+"/);
  assert.doesNotMatch(app + R(`${S}/build.gradle.kts`), /kotlin-android|org\.jetbrains\.kotlin\.android/);
  assert.ok(R(`${S}/build.gradle.kts`).includes('id("com.android.application") version "9.3.2" apply false'));
});
test('the version comes only from gradle.properties', () => {
  const app = R(`${S}/app/build.gradle.kts`), lines = R(`${S}/gradle.properties`).split('\n').map(l => l.trim());
  const v = JSON.parse(R('package.json')).version, [x, y, z] = v.split('.').map(Number);
  assert.ok(app.includes('versionCode = providers.gradleProperty("byways.versionCode").get().toInt()'));
  assert.ok(app.includes('versionName = providers.gradleProperty("byways.versionName").get()'));
  assert.ok(lines.includes(`byways.versionName=${v}`)); assert.ok(lines.includes(`byways.versionCode=${x * 10000 + y * 100 + z}`));
  assert.doesNotMatch(app, /BYWAYS_VERSION/);
});
test('release signing reads the keystore path and three secrets', () => {
  const app = R(`${S}/app/build.gradle.kts`);
  for (const v of ['BYWAYS_KEYSTORE_PATH', 'KEYSTORE_PASSWORD', 'KEY_ALIAS', 'KEY_PASSWORD']) assert.ok(app.includes(`System.getenv("${v}")`), v);
  assert.doesNotMatch(app, /KEYSTORE_BASE64|Base64/);
});
test('manifest declares permissions, queries and share-in', () => {
  const m = R(`${S}/app/src/main/AndroidManifest.xml`);
  for (const s of ['android.permission.INTERNET', 'android.permission.RECORD_AUDIO', 'android.speech.RecognitionService',
    'android.intent.action.TTS_SERVICE', 'android.intent.action.SEND', 'android:mimeType="text/plain"',
    'android:networkSecurityConfig="@xml/network_security_config"', 'android:launchMode="singleTask"'])
    assert.ok(m.includes(s), s);
});
test('activity keeps the WebView on configuration changes', () => {
  const m = R(`${S}/app/src/main/kotlin/io/github/iteatsthesalt/byways/MainActivity.kt`);
  assert.ok(R(`${S}/app/src/main/AndroidManifest.xml`).includes('android:configChanges="orientation|screenSize|screenLayout|smallestScreenSize|keyboardHidden|keyboard|navigation|density|fontScale|locale|layoutDirection|uiMode"'));
  assert.match(m, /webView\.loadUrl\(APP_URL\)/); assert.doesNotMatch(m, /savedInstanceState == null/);
});
test('the main WebView settings follow §13.4', () => {
  const m = R(`${S}/app/src/main/kotlin/io/github/iteatsthesalt/byways/MainActivity.kt`);
  for (const s of ['javaScriptEnabled = true', 'domStorageEnabled = true', 'mediaPlaybackRequiresUserGesture = false', 'allowFileAccess = false',
    'allowContentAccess = false', 'MIXED_CONTENT_NEVER_ALLOW', 'setAcceptThirdPartyCookies(webView, true)', 'request.deny()'])
    assert.ok(m.includes(s), s);
});
test('network config allows cleartext', () => {
  assert.match(R(`${S}/app/src/main/res/xml/network_security_config.xml`), /cleartextTrafficPermitted="true"/);
});
test('CI builds and tests the Android app', () => {
  const y = R('../../.github/workflows/byways.yml');
  for (const s of ['node tools/build.js --target android', "java-version: '21'", 'gradle-version: 9.7.1',
    'cache-provider: basic', 'gradle -p shells/android assembleDebug testDebugUnitTest', 'app-debug.apk'])
    assert.ok(y.includes(s), s);
});
test('Kotlin never uses addJavascriptInterface', () => {
  const dir = `${S}/app/src/main/kotlin/io/github/iteatsthesalt/byways`;
  for (const f of readdirSync(dir)) assert.doesNotMatch(R(`${dir}/${f}`), /addJavascriptInterface/, f);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test tests/unit/android-shell.test.js`
Expected: FAIL with `ENOENT` on `shells/android/app/build.gradle.kts`.

- [ ] **Step 3: Write the Gradle files**

- `settings.gradle.kts`: `pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }`, `dependencyResolutionManagement { repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS); repositories { google(); mavenCentral() } }`, `rootProject.name = "byways"`, `include(":app")`.
- `build.gradle.kts`: `plugins { id("com.android.application") version "9.3.2" apply false }`.
- `gradle.properties`: `android.useAndroidX=true`, `android.nonTransitiveRClass=true`, `org.gradle.jvmargs=-Xmx3g -Dfile.encoding=UTF-8`, `byways.versionName=0.1.0` and `byways.versionCode=100` (the `package.json` version and `0*10000 + 1*100 + 0`).
- `app/build.gradle.kts`: `plugins { id("com.android.application") }`; `android { namespace, compileSdk = 37, defaultConfig { applicationId, minSdk = 24, targetSdk = 36, versionCode = providers.gradleProperty("byways.versionCode").get().toInt(), versionName = providers.gradleProperty("byways.versionName").get() }, compileOptions { sourceCompatibility = JavaVersion.VERSION_21; targetCompatibility = JavaVersion.VERSION_21 }, testOptions { unitTests.isReturnDefaultValues = true } }`. Built-in Kotlin takes its JVM target from `compileOptions`; if CI reports a JVM target mismatch, add `kotlin { jvmToolchain(21) }`. Dependencies: `implementation("androidx.webkit:webkit:1.18.0")`, `implementation("androidx.activity:activity-ktx:1.11.0")`, `testImplementation("junit:junit:4.13.2")`, `testImplementation("org.json:json:20240303")` (android.jar's `org.json` is a stub that throws in JVM tests). If `webkit:1.18.0` does not resolve in CI, use the newest 1.17.x; the test accepts both.
- Release build and signing: `signingConfigs { create("release") { … } }` is filled only when `System.getenv("BYWAYS_KEYSTORE_PATH")` is not null: `storeFile = file(<that path>)`, `storePassword = System.getenv("KEYSTORE_PASSWORD")`, `keyAlias = System.getenv("KEY_ALIAS")`, `keyPassword = System.getenv("KEY_PASSWORD")`. `buildTypes { release { isMinifyEnabled = false; proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro") } }` sets `signingConfig = signingConfigs.getByName("release")` only when that path is set. Gradle never decodes Base64. `app/proguard-rules.pro` holds one comment: `# Byways does not minify. Rules go here if that changes.`

- [ ] **Step 4: Write the manifest and resources**

- Manifest: `<uses-permission>` for `INTERNET` and `RECORD_AUDIO`; `<queries>` with one `<intent>` for action `android.speech.RecognitionService` and one for `android.intent.action.TTS_SERVICE`; `<application android:label="@string/app_name" android:icon="@drawable/ic_launcher" android:theme="@style/Theme.Byways" android:networkSecurityConfig="@xml/network_security_config" android:allowBackup="false">`; one `<activity android:name=".MainActivity" android:exported="true" android:launchMode="singleTask" android:configChanges="orientation|screenSize|screenLayout|smallestScreenSize|keyboardHidden|keyboard|navigation|density|fontScale|locale|layoutDirection|uiMode">` with a `MAIN`/`LAUNCHER` filter and a `SEND` filter (`DEFAULT` category, `android:mimeType="text/plain"`).
- `network_security_config.xml`: `<network-security-config><base-config cleartextTrafficPermitted="true" /></network-security-config>`.
- `strings.xml`: `app_name` = `Byways`. `themes.xml`: `Theme.Byways` with parent `android:Theme.DeviceDefault.NoActionBar`. `ic_launcher.xml`: a 108 dp vector, a single path on a solid background.

- [ ] **Step 5: Write the first `MainActivity`**

`class MainActivity : ComponentActivity()`. `onCreate` builds a `FrameLayout` root holding `webView`, and:
- `WebViewAssetLoader.Builder().setDomain(APP_HOST).addPathHandler("/assets/", AssetsPathHandler(this)).build()`, called from `WebViewClient.shouldInterceptRequest(view, request)`.
- `webView.settings`: `javaScriptEnabled = true`, `domStorageEnabled = true`, `mediaPlaybackRequiresUserGesture = false`, `allowFileAccess = false`, `allowContentAccess = false`, `mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW`, `setSupportMultipleWindows(false)`.
- `CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)`.
- `WebChromeClient.onPermissionRequest(request)` calls `request.deny()` for every request.
- `WebView.setWebContentsDebuggingEnabled(true)` only when `applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0`.
- `webView.loadUrl(APP_URL)` on every `onCreate`, because a recreated activity has a new, empty WebView and all state lives in IndexedDB. Tasks 5 and 8 put the bridge install and the consent screen in front of this load.

- [ ] **Step 6: Add the CI job and ignores**

`.gitignore` gains `shells/android/app/src/main/assets/`, `shells/android/.gradle/`, `shells/android/build/`, `shells/android/app/build/` and `shells/android/local.properties`. Add an `android` job to `.github/workflows/byways.yml`: `runs-on: ubuntu-24.04` and `defaults: { run: { working-directory: Apps/Byways } }`; then `actions/checkout@v7`; `actions/setup-node@v4` with `node-version: 22`, `cache: npm` and `cache-dependency-path: Apps/Byways/package-lock.json`; `npm ci`; `npm run vendor`; `node tools/build.js --target android`; `actions/setup-java@v6` with `distribution: temurin` and `java-version: '21'`; `gradle/actions/setup-gradle@v6` with `cache-provider: basic` and `gradle-version: 9.7.1`; `gradle -p shells/android assembleDebug testDebugUnitTest`; `actions/upload-artifact@v7` of `Apps/Byways/shells/android/app/build/outputs/apk/debug/app-debug.apk` named `byways-debug-apk`; and, with `if: failure()`, `actions/upload-artifact@v7` of `Apps/Byways/shells/android/app/build/reports/tests/` named `android-test-reports`.

- [ ] **Step 7: Run the tests**

Run: `node --test tests/unit/android-shell.test.js`
Expected: PASS (9 tests).

- [ ] **Step 8: Commit, then check CI**

```bash
git add shells/android .gitignore ../../.github/workflows/byways.yml tests/unit/android-shell.test.js
git commit -m "Add the Android project and its CI job"
```

Push and run the **CI checks** command. Expected: exit 0, and the run lists the artifact `byways-debug-apk`. If `webkit:1.18.0` does not resolve, use the newest 1.17.x and commit `Use the fallback androidx.webkit version`. If AGP 9.3.2 or Gradle 9.7.1 does not resolve, stop and report it: the spec gives no fallback for them.

### Task 3: The nativeFetch URL policy

**Files:**
- Create: `…/byways/FetchPolicy.kt`
- Test: `shells/android/app/src/test/kotlin/io/github/iteatsthesalt/byways/FetchPolicyTest.kt`

**Interfaces:**
- Produces (pure Kotlin, no Android imports):

```kotlin
object FetchPolicy {
  const val MAX_BYTES = 10 * 1024 * 1024
  sealed interface Verdict { data object Allow : Verdict; data class Deny(val code: String) : Verdict }
  fun check(url: String, approved: Set<String>): Verdict   // codes: "bad-url", "scheme", "not-local", "not-approved"
  fun hostOf(url: String): String?                          // lowercase, IPv6 without brackets
  fun isLocalHost(host: String): Boolean
}
```

- [ ] **Step 1: Write the failing test**

```kotlin
class FetchPolicyTest {
  private val none = emptySet<String>()
  private fun deny(c: String) = FetchPolicy.Verdict.Deny(c)
  private val allow = FetchPolicy.Verdict.Allow
  @Test fun allowsAnyHttps() = assertEquals(allow, FetchPolicy.check("https://api.mistral.ai/v1/models", none))
  @Test fun refusesHttpToPublicHosts() = assertEquals(deny("not-local"), FetchPolicy.check("http://example.com/", setOf("example.com")))
  @Test fun needsApprovalForLanHosts() {
    assertEquals(deny("not-approved"), FetchPolicy.check("http://192.168.1.20:11434/v1/models", none))
    assertEquals(allow, FetchPolicy.check("http://192.168.1.20:11434/v1/models", setOf("192.168.1.20")))
  }
  @Test fun acceptsLoopbackPrivateAndLocalNames() {
    val ok = setOf("localhost", "::1", "fd12:3456::1", "printer.local", "172.31.255.1", "10.1.2.3", "127.0.0.1")
    for (u in listOf("HTTP://LocalHost:1234/v1/models", "http://[::1]:11434/", "http://[fd12:3456::1]/",
      "http://printer.local/", "http://172.31.255.1/", "http://10.1.2.3/", "http://127.0.0.1:11434/api/tags"))
      assertEquals(u, allow, FetchPolicy.check(u, ok))
  }
  @Test fun deniesLookalikeHosts() {
    val ok = setOf("192.168.1.5.nip.io", "10.0.0.1", "2130706433", "0x7f000001", "::ffff:8.8.8.8", "172.32.0.1", "010.0.0.1")
    for (u in listOf("http://192.168.1.5.nip.io/", "http://10.0.0.1@evil.com/", "http://2130706433/",
      "http://0x7f000001/", "http://[::ffff:8.8.8.8]/", "http://172.32.0.1/", "http://010.0.0.1/"))
      assertEquals(u, deny("not-local"), FetchPolicy.check(u, ok))
  }
  @Test fun refusesOtherSchemes() {
    for (u in listOf("ftp://10.0.0.1/", "file:///etc/hosts", "javascript:alert(1)", "intent://x#Intent;end"))
      assertEquals(u, deny("scheme"), FetchPolicy.check(u, setOf("10.0.0.1")))
  }
  @Test fun refusesBadUrls() {
    assertEquals(deny("bad-url"), FetchPolicy.check("not a url", none))
    assertEquals(deny("bad-url"), FetchPolicy.check("http://", none))
    assertEquals(deny("bad-url"), FetchPolicy.check("https:///x", none))
  }
  @Test fun capIsTenMegabytes() = assertEquals(10485760, FetchPolicy.MAX_BYTES)
}
```

- [ ] **Step 2: Run it to see it fail**

Run: `gradle -p shells/android testDebugUnitTest --tests '*FetchPolicyTest'` where `ANDROID_HOME` is set; otherwise the red half of **CI checks**.
Expected: FAIL to compile with `Unresolved reference 'FetchPolicy'`.

- [ ] **Step 3: Implement `FetchPolicy`**

- In this order: a `java.net.URI` parse error → `bad-url`; a scheme (lower-cased) other than `http` or `https` → `scheme`; a null or empty host → `bad-url`; `https` → `Allow`; for `http`, not `isLocalHost(host)` → `not-local`, host not in `approved` → `not-approved`, else `Allow`. Approval is per host, for any port.
- `isLocalHost` never resolves DNS. It is true only for: `localhost`; an IPv4 literal of exactly four decimal parts, each 0–255 with no leading zero, in `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12` or `192.168.0.0/16`; the IPv6 literal `::1`, or one whose first group is `fc00`–`fdff`; a name ending in `.local` with at least one label of `[a-z0-9-]` before it.

- [ ] **Step 4: Run it to see it pass**

Run: the Step 2 command, or the green half of **CI checks** after Step 5. Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add shells/android/app/src/main/kotlin/io/github/iteatsthesalt/byways/FetchPolicy.kt shells/android/app/src/test/kotlin/io/github/iteatsthesalt/byways/FetchPolicyTest.kt
git commit -m "Add the native fetch URL policy"
```

### Task 4: The native HTTP executor

**Files:**
- Create: `…/byways/NativeFetch.kt`
- Test: `shells/android/app/src/test/kotlin/io/github/iteatsthesalt/byways/NativeFetchTest.kt`

**Interfaces:**
- Consumes: `FetchPolicy.check`, `FetchPolicy.MAX_BYTES` (Task 3).
- Produces (pure JVM, `java.net.HttpURLConnection` only):

```kotlin
data class FetchRequest(val url: String, val method: String = "GET", val headers: Map<String, String> = emptyMap(), val body: String? = null)
data class FetchResponse(val status: Int, val statusText: String, val headers: Map<String, String>, val body: String, val url: String)
class FetchError(val code: String) : Exception(code)   // policy codes, "timeout", "network", "too-large", "redirects", "aborted"
class FetchCall { val isCancelled: Boolean; fun cancel() }   // cancel() also disconnects the open connection
class NativeFetch(private val approved: () -> Set<String>, private val connectTimeoutMs: Int = 15_000,
                  private val readTimeoutMs: Int = 90_000, private val maxBytes: Int = FetchPolicy.MAX_BYTES) {
  fun execute(req: FetchRequest, call: FetchCall = FetchCall()): FetchResponse
}
```

- [ ] **Step 1: Write the failing test**

`com.sun.net.httpserver` is not in `android.jar`, so the test runs its own server on `java.net.ServerSocket(0, 50, InetAddress.getByName("127.0.0.1"))`, started in `@Before` and closed in `@After`. Each connection gets its own thread, reads the request line, headers and a `Content-Length` body, and answers with `Connection: close`. It records the last `/echo` request's headers in `seen: Map<String, String>` (names lower-cased), its body in `seenBody` and the count in `echoHits`. `base = "http://127.0.0.1:$port"`, `nf = NativeFetch({ setOf("127.0.0.1", "localhost") })`, and `code { … }` runs the block and returns the `FetchError.code` it throws. Routes:

| Path | Answer |
|---|---|
| `/slow` | 429, `Retry-After: 3`, body `{"error":"slow"}` |
| `/echo` | 200 `ok`, after recording the request |
| `/big?n=<n>` | 200 with `n` bytes of `a` |
| `/a`, `/b` | 302 `Location: /b`; 200 `ok` |
| `/out`, `/pub` | 302 `Location: http://192.168.77.77/x`; 302 `Location: http://example.com/` |
| `/loop` | 302 `Location: /loop` |
| `/hop` | 302 `Location: http://localhost:$port/echo` (same server, another origin) |
| `/sleep` | waits 1500 ms, then 200 `ok` |

```kotlin
@Test fun passesStatusHeadersAndBody() {
  val r = nf.execute(FetchRequest("$base/slow"))
  assertEquals(429, r.status); assertEquals("3", r.headers["retry-after"]); assertEquals("""{"error":"slow"}""", r.body)
}
@Test fun sendsNoCookiesAndKeepsOtherHeaders() {
  nf.execute(FetchRequest("$base/echo", headers = mapOf("Cookie" to "a=1", "X-Api-Key" to "k")))
  assertNull(seen["cookie"]); assertEquals("k", seen["x-api-key"])
}
@Test fun dropsKeysOnCrossOriginRedirect() {
  val keys = mapOf("Authorization" to "Bearer k", "X-Api-Key" to "k", "x-goog-api-key" to "k", "Api-Key" to "k", "Accept" to "text/plain")
  nf.execute(FetchRequest("$base/hop", headers = keys))
  for (h in listOf("authorization", "x-api-key", "x-goog-api-key", "api-key")) assertNull(h, seen[h])
  assertEquals("text/plain", seen["accept"])
}
@Test fun sendsPostBody() {
  nf.execute(FetchRequest("$base/echo", "POST", mapOf("Content-Type" to "application/json"), """{"q":1}"""))
  assertEquals("""{"q":1}""", seenBody)
}
@Test fun capsResponseSize() {
  val small = NativeFetch({ setOf("127.0.0.1") }, maxBytes = 1024)
  assertEquals(1024, small.execute(FetchRequest("$base/big?n=1024")).body.length)
  assertEquals("too-large", code { small.execute(FetchRequest("$base/big?n=1025")) })
}
@Test fun followsSafeRedirects() {
  val r = nf.execute(FetchRequest("$base/a")); assertEquals("ok", r.body); assertTrue(r.url.endsWith("/b"))
}
@Test fun blocksRedirectToUnapprovedHost() {
  assertEquals("not-approved", code { nf.execute(FetchRequest("$base/out")) })
  assertEquals("not-local", code { nf.execute(FetchRequest("$base/pub")) })
}
@Test fun stopsAfterFiveRedirects() = assertEquals("redirects", code { nf.execute(FetchRequest("$base/loop")) })
@Test fun timesOut() {
  assertEquals("timeout", code { NativeFetch({ setOf("127.0.0.1") }, readTimeoutMs = 300).execute(FetchRequest("$base/sleep")) })
}
@Test fun checksPolicyBeforeConnecting() {
  assertEquals("not-approved", code { NativeFetch({ emptySet() }).execute(FetchRequest("$base/echo")) }); assertEquals(0, echoHits)
}
@Test fun honoursCancel() {
  assertEquals("aborted", code { nf.execute(FetchRequest("$base/echo"), FetchCall().apply { cancel() }) }); assertEquals(0, echoHits)
}
@Test fun cancelDisconnectsAnOpenRequest() {
  val call = FetchCall(); val t0 = System.nanoTime()
  thread { Thread.sleep(100); call.cancel() }
  assertEquals("aborted", code { nf.execute(FetchRequest("$base/sleep"), call) })
  assertTrue((System.nanoTime() - t0) / 1_000_000 < 1000)
}
```

- [ ] **Step 2: Run it to see it fail**

Run: `gradle -p shells/android testDebugUnitTest --tests '*NativeFetchTest'` where `ANDROID_HOME` is set; otherwise the red half of **CI checks**.
Expected: FAIL to compile with `Unresolved reference 'NativeFetch'`.

- [ ] **Step 3: Implement `NativeFetch.execute`**

- Check `call.isCancelled` and `FetchPolicy.check(url, approved())` before every hop. A `Deny` throws `FetchError(deny.code)`.
- `instanceFollowRedirects = false`, `useCaches = false`, the two timeouts. Copy request headers except `cookie`, `cookie2`, `host` and `content-length` (any case). Never install a `CookieHandler`.
- Redirects (301, 302, 303, 307, 308): resolve `Location` against the current URL and loop, at most 5 hops, then `redirects`. 303 always becomes GET without a body, and so do 301 and 302 after a POST. 307 and 308 keep the method and body. On a hop whose origin (scheme, host and port) differs from the original URL's, drop `authorization`, `proxy-authorization`, `x-api-key`, `x-goog-api-key` and `api-key`, because keys go only to their own provider's host.
- The open `HttpURLConnection` is held by `call`; `cancel()` calls its `disconnect()`, and any `IOException` after a cancel becomes `aborted`.
- Read `errorStream` for status ≥ 400. Stop with `too-large` once more than `maxBytes` bytes arrive (or when `Content-Length` says so). Decode with the `charset` from `Content-Type`, else UTF-8.
- Header names are lower-cased, and repeated values are joined with `", "`. The null status-line key is skipped.
- `SocketTimeoutException` → `timeout`; other `IOException` → `network`. Never log a URL, header or body.

- [ ] **Step 4: Run it to see it pass**

Run: the Step 2 command, or the green half of **CI checks** after Step 5. Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add shells/android/app/src/main/kotlin/io/github/iteatsthesalt/byways/NativeFetch.kt shells/android/app/src/test/kotlin/io/github/iteatsthesalt/byways/NativeFetchTest.kt
git commit -m "Add the native HTTP executor with redirect checks and a size cap"
```

### Task 5: Bridge codec, origin gate and the core channels

**Files:**
- Create: `…/byways/BridgeCodec.kt`, `…/byways/Bridge.kt`
- Modify: `…/byways/MainActivity.kt`, `tests/unit/android-shell.test.js`
- Test: `shells/android/app/src/test/kotlin/io/github/iteatsthesalt/byways/BridgeCodecTest.kt`

**Interfaces:**
- Consumes: `NativeFetch`, `FetchRequest`, `FetchError`, `FetchCall` (Task 4); `FetchPolicy.isLocalHost` (Task 3); `MainActivity.webView`, `APP_URL` (Task 2).
- Produces:

```kotlin
object BridgeCodec {
  val CHANNELS = setOf("voice", "tts", "media", "share", "fetch", "files", "back", "app", "screen")
  const val MAX_MESSAGE_CHARS = 16 * 1024 * 1024
  data class Request(val id: String, val ch: String, val op: String, val args: JSONObject)
  class BadMessage(val code: String) : Exception(code)     // "bad-message", "unknown-channel", "too-large"
  fun decode(raw: String): Request
  fun ok(id: String, result: Any?): String
  fun error(id: String, code: String, message: String): String
  fun event(ch: String, event: String, data: Any?): String
}
object BridgeGate {
  const val APP_ORIGIN = "https://appassets.androidplatform.net"
  const val LAB_ORIGIN = "https://lab.appassets.androidplatform.net"
  fun accepts(allowedOrigin: String, sourceOrigin: String, isMainFrame: Boolean, allowSubframes: Boolean = false): Boolean
}
// Bridge.kt
fun interface ChannelHandler { fun handle(req: BridgeCodec.Request, reply: Reply) }
class Reply(private val id: String, private val post: (String) -> Unit) { fun ok(result: Any?); fun error(code: String, message: String = code) }
class Bridge(private val webView: WebView, private val handlers: Map<String, ChannelHandler>) {
  fun install(): Boolean                             // false when WEB_MESSAGE_LISTENER is missing
  fun emit(ch: String, event: String, data: Any?)   // held until the page sends app.ready
  fun pageStarted()                                  // a new main-frame page: hold events again
}
```

- [ ] **Step 1: Write the failing tests**

```kotlin
class BridgeCodecTest {
  @Test fun decodesARequest() {
    val r = BridgeCodec.decode("""{"id":"7","ch":"tts","op":"speak","args":{"text":"Hi"}}""")
    assertEquals("7", r.id); assertEquals("tts", r.ch); assertEquals("speak", r.op); assertEquals("Hi", r.args.getString("text"))
  }
  @Test fun missingArgsBecomeEmpty() = assertEquals(0, BridgeCodec.decode("""{"id":"1","ch":"app","op":"hello"}""").args.length())
  @Test fun rejectsBadMessages() {
    for ((raw, code) in listOf("nope" to "bad-message", """{"ch":"app","op":"hello"}""" to "bad-message",
      """{"id":"1","ch":"app"}""" to "bad-message", """{"id":"1","ch":"camera","op":"x"}""" to "unknown-channel",
      "x".repeat(BridgeCodec.MAX_MESSAGE_CHARS + 1) to "too-large"))
      assertEquals(raw.take(20), code, assertThrows(BridgeCodec.BadMessage::class.java) { BridgeCodec.decode(raw) }.code)
  }
  @Test fun encodesReplies() {
    assertEquals(JSONObject("""{"id":"7","ok":true,"result":{"a":1}}""").toString(), JSONObject(BridgeCodec.ok("7", JSONObject("""{"a":1}"""))).toString())
    assertTrue(JSONObject(BridgeCodec.ok("8", null)).isNull("result"))
    val e = JSONObject(BridgeCodec.error("9", "not-approved", "Host not approved"))
    assertFalse(e.getBoolean("ok")); assertEquals("not-approved", e.getJSONObject("error").getString("code"))
    val ev = JSONObject(BridgeCodec.event("voice", "result", JSONObject("""{"text":"next","final":true}""")))
    assertEquals("voice", ev.getString("ch")); assertEquals("result", ev.getString("event")); assertEquals("next", ev.getJSONObject("data").getString("text"))
  }
  @Test fun gateRejectsOtherOriginsAndSubframes() {
    val app = BridgeGate.APP_ORIGIN
    assertTrue(BridgeGate.accepts(app, "https://appassets.androidplatform.net", true))
    assertFalse(BridgeGate.accepts(app, "https://appassets.androidplatform.net", false))
    assertFalse(BridgeGate.accepts(app, "https://archive.org", true))
    assertFalse(BridgeGate.accepts(app, BridgeGate.LAB_ORIGIN, true))
    assertFalse(BridgeGate.accepts(app, "https://appassets.androidplatform.net.evil.com", true))
    assertFalse(BridgeGate.accepts(app, "null", true))
    assertTrue(BridgeGate.accepts(BridgeGate.LAB_ORIGIN, "https://lab.appassets.androidplatform.net", true))
    assertTrue(BridgeGate.accepts(BridgeGate.LAB_ORIGIN, BridgeGate.LAB_ORIGIN, false, allowSubframes = true))
    assertFalse(BridgeGate.accepts(BridgeGate.LAB_ORIGIN, "https://archive.org", false, allowSubframes = true))
  }
}
```

Add to `tests/unit/android-shell.test.js`:

```js
test('bridge and fetch code never log', () => {
  for (const f of ['Bridge.kt', 'NativeFetch.kt', 'FetchPolicy.kt'])
    assert.doesNotMatch(R(`${S}/app/src/main/kotlin/io/github/iteatsthesalt/byways/${f}`), /\bLog\.[vdiwe]\(|println\(/, f);
});
test('the bridge checks WEB_MESSAGE_LISTENER and the screen stays on natively', () => {
  const k = f => R(`${S}/app/src/main/kotlin/io/github/iteatsthesalt/byways/${f}`);
  assert.ok(k('Bridge.kt').includes('WebViewFeature.WEB_MESSAGE_LISTENER'));
  assert.ok((k('Bridge.kt') + k('MainActivity.kt')).includes('FLAG_KEEP_SCREEN_ON'));
  assert.match(k('Bridge.kt'), /newCachedThreadPool/);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/unit/android-shell.test.js`, and `gradle -p shells/android testDebugUnitTest --tests '*BridgeCodecTest'` where `ANDROID_HOME` is set (otherwise the red half of **CI checks**).
Expected: the Node test fails with `ENOENT` on `Bridge.kt`; Gradle fails with `Unresolved reference 'BridgeCodec'`.

- [ ] **Step 3: Implement `BridgeCodec` and `BridgeGate`**

`decode` checks the length first, then parses with `JSONObject`. `id` must be a non-empty string of at most 64 characters, and `op` a non-empty string. `ok` and `event` write `JSONObject.NULL` for `null`. `accepts` is true only when `sourceOrigin == allowedOrigin` exactly and either `isMainFrame` or `allowSubframes`.

- [ ] **Step 4: Implement `Bridge`, `Reply` and the core channels**

- `install()`: if `!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)` return false. Otherwise `WebViewCompat.addWebMessageListener(webView, "BywaysNative", setOf(BridgeGate.APP_ORIGIN)) { _, message, sourceOrigin, isMainFrame, proxy -> … }`. Drop the message unless `BridgeGate.accepts(APP_ORIGIN, sourceOrigin.toString(), isMainFrame)`. Keep the latest `proxy`. Decode; on `BadMessage` reply with its code when an id can be read, else drop. Route by `ch`. A handler that throws replies `internal`. An unknown op replies `unknown-op`.
- `Reply` sends once (later calls do nothing) and always posts to `proxy.postMessage` on the main thread (`webView.post`).
- `emit` holds events in a queue until the page sends `app.ready`, which `Bridge` answers itself (`true`) before flushing the queue in order. `pageStarted()`, called from the main WebView's `onPageStarted`, clears `ready` and the kept `proxy`, so events never go to a page that is gone.
- `app` handler: `hello` → `{versionName, versionCode, sdk: Build.VERSION.SDK_INT, micConsent}` (the two versions from `packageManager.getPackageInfo(packageName, 0)` with `PackageInfoCompat.getLongVersionCode`; `micConsent` is the `micConsent` boolean in SharedPreferences `byways`, default false); `openExternal {url}` → `ACTION_VIEW` with `CATEGORY_BROWSABLE` for `http(s)` only, else error `scheme`.
- `fetch` handler (a `FetchChannel` class in `Bridge.kt`): `request` runs `NativeFetch.execute` with a new `FetchCall` on `Executors.newCachedThreadPool()`, so a slow AI team member never starves other requests; `abort {fetchId}` calls `cancel()` on that request's `FetchCall`; `approve {host}` (only `requestOrigins` sends it; hosts arrive without IPv6 brackets) replies true when the host is already in the `approvedHosts` string set, false when `!FetchPolicy.isLocalHost(host)`, else shows an `AlertDialog` titled `Allow a local network device?` with the message `Byways wants to reach http://<host> on your network, for a local AI model. Allow it?` and the buttons **Allow** (store and reply true) and **Cancel** (reply false). `FetchError` replies with its code.
- `screen` handler: `keepOn {on}` adds or clears `WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON`.
- In `MainActivity.onCreate`, build the `Bridge` before `loadUrl`. If `install()` is false, load nothing and show a `TextView` saying `This phone's WebView is too old for Byways. Update Android System WebView, then open Byways again.`

- [ ] **Step 5: Run them to see them pass**

Run: the Step 2 commands (Gradle: or the green half of **CI checks** after Step 6). Expected: PASS (Node: 11 tests; Gradle: 5 tests).

- [ ] **Step 6: Commit**

```bash
git add shells/android/app/src/main/kotlin/io/github/iteatsthesalt/byways shells/android/app/src/test/kotlin/io/github/iteatsthesalt/byways/BridgeCodecTest.kt tests/unit/android-shell.test.js
git commit -m "Add the native bridge with an origin gate and the fetch channel"
```

### Task 6: The Android platform: bridge client, transport, share, files and links

**Files:**
- Create: `src/platform/android.js`
- Test: `tests/unit/platform-android.test.js`

**Interfaces:**
- Consumes: the `Platform` typedef (overview); a `base` PWA platform from `createPwaPlatform` (Plan 01), whose `secrets`, `files.pick` and `persistStorage` are reused; the bridge protocol table above.
- Produces:

```js
export function createBridgeClient(port, { hello = true } = {})
  // → {call(ch, op, args = {}) → Promise<any> (the promise carries the request id as .id),
  //    on(ch, event, fn) → () => void, hello: Promise<{versionName, versionCode, sdk, micConsent}>|null}
export function createAndroidPlatform({ bridge, base, win = globalThis })
  // → Platform, including requestOrigins(origins) → Promise<boolean> and
  //    identity: {launchWebAuthFlow({url, interactive}) → Promise<string>}, plus
  //    app: {version() → Promise<{versionName, versionCode, sdk, micConsent}>,
  //    checkUpdate() → Promise<{available:boolean, latest:string|null, url:string|null}>, openExternal(url) → Promise<void>}
  //    and attach(app) → Promise<void> (Task 14)
export function extractSharedLink(text) // → {kind:'share', hash:string} | {kind:'url', url:string} | null
```

`requestOrigins` is the only thing that asks for a local network host: Plan 05's settings call it from the button that adds a local-network model, and `transport.fetch` never prompts. `identity.launchWebAuthFlow` resolves with the first URL on `https://appassets.androidplatform.net/` that the login view reaches, so Plan 05's `redirectUri = location.origin + location.pathname` works unchanged; it rejects with code `cancelled` when the person closes the view.

- [ ] **Step 1: Write the failing tests**

`tests/unit/platform-android.test.js` uses a fake port:

```js
function fakePort() {
  const port = { sent: [], onmessage: null, postMessage(s) { port.sent.push(JSON.parse(s)); },
    last() { return port.sent.at(-1); },
    async nth(n) { while (port.sent.length < n) await tick(); return port.sent[n - 1]; },
    reply(id, result) { port.onmessage({ data: JSON.stringify({ id, ok: true, result }) }); },
    fail(id, code) { port.onmessage({ data: JSON.stringify({ id, ok: false, error: { code, message: code } }) }); },
    emit(ch, event, data = {}) { port.onmessage({ data: JSON.stringify({ ch, event, data }) }); } };
  return port;
}
const win = { location: new URL('https://appassets.androidplatform.net/assets/www/index.html'),
  fetch: async () => new Response('{"v":1}') };
const tick = () => new Promise(r => setTimeout(r, 0));
const HELLO = { versionName: '0.1.0', versionCode: 100, sdk: 34, micConsent: false };
```

Tests and their assertions:

```js
test('hello is sent first', () => {
  const port = fakePort(); createBridgeClient(port);
  assert.deepEqual(port.sent[0], { id: '1', ch: 'app', op: 'hello', args: {} });
});
test('calls resolve, reject with a code, and ignore junk', async () => {
  const port = fakePort(); const c = createBridgeClient(port, { hello: false });
  const p = c.call('tts', 'voices'); assert.equal(p.id, '1');
  port.onmessage({ data: 'not json' }); port.onmessage({ data: '{"id":"99","ok":true}' });
  port.reply('1', [{ uri: 'en-us-x-sfg', name: 'en-us-x-sfg', lang: 'en-US', local: true }]);
  assert.deepEqual(await p, [{ uri: 'en-us-x-sfg', name: 'en-us-x-sfg', lang: 'en-US', local: true }]);
  const q = c.call('fetch', 'approve', { host: 'x' }); port.fail(q.id, 'not-approved');
  await assert.rejects(q, e => e.code === 'not-approved');
});
test('events reach listeners until they unsubscribe', () => {
  const port = fakePort(); const c = createBridgeClient(port, { hello: false }); const got = [];
  const off = c.on('voice', 'result', d => got.push(d));
  port.emit('voice', 'result', { text: 'next', final: true }); off(); port.emit('voice', 'result', { text: 'back', final: true });
  assert.deepEqual(got, [{ text: 'next', final: true }]);
});
test('caps are fixed', () => {
  const p = createAndroidPlatform({ bridge: fakePort(), base: fakeBase(), win });
  assert.equal(p.name, 'android');
  assert.deepEqual(p.caps, { privilegedFetch: true, localNetworkHttp: true, inAppSiteView: true,
    labHref: 'https://lab.appassets.androidplatform.net/lab/index.html', framesArchive: true });
});
test('API calls go through nativeFetch', async () => {
  const port = fakePort(); const p = createAndroidPlatform({ bridge: port, base: fakeBase(), win });
  const r = p.transport.fetch('https://api.mistral.ai/v1/models', { headers: { Authorization: 'Bearer k' }, privileged: true });
  await tick();
  assert.deepEqual(port.last().args, { url: 'https://api.mistral.ai/v1/models', method: 'GET', headers: { authorization: 'Bearer k' }, body: null });
  port.reply(port.last().id, { status: 200, statusText: 'OK', headers: { 'content-type': 'application/json' }, body: '{"data":[]}', url: 'https://api.mistral.ai/v1/models' });
  const res = await r; assert.equal(res.status, 200); assert.deepEqual(await res.json(), { data: [] });
  assert.equal(res.url, 'https://api.mistral.ai/v1/models'); assert.equal(res.redirected, false);
  const g = p.transport.fetch('https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc', { method: 'HEAD', privileged: true });
  await tick(); port.reply(port.last().id, { status: 200, statusText: 'OK', headers: {}, body: '', url: 'https://real.example/page' });
  const moved = await g; assert.equal(moved.url, 'https://real.example/page'); assert.equal(moved.redirected, true);
  p.transport.fetch('https://iteatsthesalt.github.io/Game-Dev-Resources/byways/data/daily.json'); await tick();
  assert.deepEqual([port.last().op, port.last().args.url], ['request', 'https://iteatsthesalt.github.io/Game-Dev-Resources/byways/data/daily.json']);
});
test('same-origin paths use the page fetch', async () => {
  const port = fakePort(); const calls = [];
  const w = { ...win, fetch: async u => { calls.push(u); return new Response('{"v":1}'); } };
  await createAndroidPlatform({ bridge: port, base: fakeBase(), win: w }).transport.fetch('data/tags.json');
  assert.deepEqual(calls, ['data/tags.json']); assert.equal(port.sent.filter(m => m.ch === 'fetch').length, 0);
});
test('transport passes 429 and 204 through, maps failures and aborts', async () => {
  const port = fakePort(); const p = createAndroidPlatform({ bridge: port, base: fakeBase(), win });
  const get = init => p.transport.fetch('https://api.example/x', init);
  const answer = async (n, r) => port.reply((await port.nth(n)).id, { statusText: '', headers: {}, body: '', url: 'https://api.example/x', ...r });
  let r = get(); await answer(2, { status: 429, headers: { 'retry-after': '3' } });
  r = await r; assert.equal(r.status, 429); assert.equal(r.headers.get('retry-after'), '3');
  r = get(); await answer(3, { status: 204 }); assert.equal((await r).body, null);
  r = get(); port.fail((await port.nth(4)).id, 'network'); await assert.rejects(r, { name: 'TypeError', code: 'network' });
  const ctl = new AbortController(); r = get({ signal: ctl.signal }); const sent = await port.nth(5); ctl.abort();
  await assert.rejects(r, { name: 'AbortError' }); assert.deepEqual([port.last().op, port.last().args], ['abort', { fetchId: sent.id }]);
  const n = port.sent.length, pre = new AbortController(); pre.abort();
  await assert.rejects(get({ signal: pre.signal }), { name: 'AbortError' }); assert.equal(port.sent.length, n);
  await assert.rejects(get({ method: 'POST', body: new Blob(['x']) }), { name: 'TypeError', message: 'nativeFetch supports string bodies only' });
});
test('http to an unapproved LAN host fails clearly and never prompts', async () => {
  const port = fakePort(); const p = createAndroidPlatform({ bridge: port, base: fakeBase(), win });
  const r = p.transport.fetch('http://192.168.1.20:11434/api/tags'); const m = await port.nth(2);
  assert.equal(m.op, 'request'); port.fail(m.id, 'not-approved');
  await assert.rejects(r, { name: 'TypeError', message: 'Local network host not approved: 192.168.1.20', code: 'not-approved' });
  assert.equal(port.sent.some(x => x.op === 'approve'), false);
});
test('requestOrigins asks natively for http hosts only', async () => {
  const port = fakePort(); const p = createAndroidPlatform({ bridge: port, base: fakeBase(), win });
  assert.equal(await p.requestOrigins(['https://api.mistral.ai']), true); assert.equal(port.sent.length, 1);
  const ok = p.requestOrigins(['https://api.x.ai', 'http://192.168.1.20:11434', 'http://[fd12:3456::1]:8080']);
  let m = await port.nth(2); assert.deepEqual([m.op, m.args], ['approve', { host: '192.168.1.20' }]); port.reply(m.id, true);
  m = await port.nth(3); assert.deepEqual(m.args, { host: 'fd12:3456::1' }); port.reply(m.id, true);
  assert.equal(await ok, true);
  const no = p.requestOrigins(['http://10.0.0.5']); m = await port.nth(4); port.reply(m.id, false);
  assert.equal(await no, false);
});
test('share, open, files and screen go over the bridge', async () => {
  const port = fakePort(); const p = createAndroidPlatform({ bridge: port, base: fakeBase(), win });
  const last = () => [port.last().ch, port.last().op, port.last().args];
  const s = p.share({ title: 'Ada', url: 'https://example.org' });
  assert.deepEqual(last(), ['share', 'send', { title: 'Ada', text: null, url: 'https://example.org' }]);
  port.reply(port.last().id, 'shared'); assert.equal(await s, 'shared');
  for (const how of [undefined, 'tab', 'current', 'inapp']) {
    const o = p.openFind({ url: 'https://example.org', title: 'Ex' }, how);
    assert.deepEqual(last(), ['app', 'openSite', { url: 'https://example.org', title: 'Ex' }], String(how));
    port.reply(port.last().id, true); await o;
  }
  await assert.rejects(p.openFind({ url: 'javascript:alert(1)', title: 'x' }), /not an http\(s\) link/);
  p.app.openExternal('https://example.org'); assert.deepEqual(last(), ['app', 'openExternal', { url: 'https://example.org' }]);
  const n = port.sent.length; p.files.save('b.json', new Blob(['{"a":1}'], { type: 'application/json' })); await port.nth(n + 1);
  assert.deepEqual(last(), ['files', 'save', { name: 'b.json', mime: 'application/json', base64: 'eyJhIjoxfQ==' }]);
  p.wakeLock.on(); assert.deepEqual(last(), ['screen', 'keepOn', { on: true }]);
  p.wakeLock.off(); assert.deepEqual(last(), ['screen', 'keepOn', { on: false }]);
  p.app.checkUpdate(); assert.deepEqual(last(), ['app', 'checkUpdate', {}]);
  port.reply('1', HELLO); assert.deepEqual(await p.app.version(), HELLO);
});
test('identity opens the login view and returns the callback URL', async () => {
  const port = fakePort(); const p = createAndroidPlatform({ bridge: port, base: fakeBase(), win });
  const cb = 'https://appassets.androidplatform.net/assets/www/index.html?code=c1';
  const a = p.identity.launchWebAuthFlow({ url: 'https://openrouter.ai/auth?code_challenge=x', interactive: true });
  assert.deepEqual([port.last().op, port.last().args], ['auth', { url: 'https://openrouter.ai/auth?code_challenge=x' }]);
  port.reply(port.last().id, cb); assert.equal(await a, cb);
  const b = p.identity.launchWebAuthFlow({ url: 'https://openrouter.ai/auth', interactive: true });
  port.fail(port.last().id, 'cancelled'); await assert.rejects(b, { code: 'cancelled' });
});
test('extractSharedLink handles real share text', () => {
  const S = 'https://iteatsthesalt.github.io/Game-Dev-Resources/byways/';
  assert.deepEqual(extractSharedLink('Look at this https://example.org/a?b=1 so good'), { kind: 'url', url: 'https://example.org/a?b=1' });
  assert.deepEqual(extractSharedLink(`${S}#s=AbC-_9).`), { kind: 'share', hash: '#s=AbC-_9' });
  assert.deepEqual(extractSharedLink(`see https://a.example/x and ${S}#s=Q1`), { kind: 'share', hash: '#s=Q1' });
  assert.deepEqual(extractSharedLink('two https://a.example/x and https://b.example/y'), { kind: 'url', url: 'https://a.example/x' });
  assert.deepEqual(extractSharedLink('end https://example.org/page.'), { kind: 'url', url: 'https://example.org/page' });
  assert.deepEqual(extractSharedLink('https://en.wikipedia.org/wiki/Mercury_(planet)'), { kind: 'url', url: 'https://en.wikipedia.org/wiki/Mercury_(planet)' });
  assert.deepEqual(extractSharedLink('(see https://example.org/a)'), { kind: 'url', url: 'https://example.org/a' });
  assert.deepEqual(extractSharedLink('http://example.org'), { kind: 'url', url: 'http://example.org' });
  assert.equal(extractSharedLink('no link here'), null);
  assert.equal(extractSharedLink('javascript:alert(1)'), null);
  assert.equal(extractSharedLink(''), null);
});
```

`fakeBase()` returns `{ secrets: {}, files: { pick: async () => [] }, persistStorage: async () => true }`.

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/unit/platform-android.test.js`
Expected: FAIL with `Cannot find module '…/src/platform/android.js'`.

- [ ] **Step 3: Implement `src/platform/android.js` (bridge client, transport, share, files, links)**

- Client: ids are a counter from `"1"`. `port.onmessage = e => …` parses `e.data`, ignores anything that does not parse or has an unknown id, resolves `{id, ok:true}`, rejects `{id, ok:false}` with `Object.assign(new Error(error.message), { code: error.code })`, and fans `{ch, event, data}` out to listeners.
- `transport.fetch(url, init = {})`: resolve `url` against `win.location.href`; same origin → `win.fetch(url, init)` with `privileged` removed. Otherwise headers become a plain object with lower-case names (through `Headers`), `method` is upper-cased (default `GET`), `body` is a string or `null`, and `fetch.request` goes out at once, `http:` included. Statuses 204, 205 and 304 build `new Response(null, …)`. Then `Object.defineProperty` gives the `Response` an own `url` (the reply's) and `redirected` (`reply.url !== <request url>`), because the constructor cannot set them. A native error code `aborted`, or the signal firing, gives `new DOMException('The operation was aborted.', 'AbortError')`; the signal firing also sends `fetch.abort {fetchId}`. `not-approved` gives `Object.assign(new TypeError(\`Local network host not approved: ${host}\`), { code })`; any other native error gives `Object.assign(new TypeError(\`Network request failed (${code})\`), { code })`.
- `requestOrigins(origins)`: `https:` origins need nothing. Each `http:` origin, one at a time, sends `fetch.approve {host}` with `new URL(origin).hostname` minus IPv6 brackets. It resolves `true` only when every one is approved.
- `openFind(find, how)`: every `how` (none, `'tab'`, `'current'`, `'inapp'`) sends `app.openSite {url, title}`, because Android shows finds in the site view (§4). A non-http(s) url rejects with `not an http(s) link`, as the PWA's does. The way out to the browser is `app.openExternal` and the site view's **Open in browser**.
- `share`, `files.save` (base64 of `blob.arrayBuffer()`, mime `blob.type || 'application/octet-stream'`), `wakeLock` and `app` as in the bridge table; `identity.launchWebAuthFlow({url})` sends `app.auth {url}`. `files.pick`, `secrets` and `persistStorage` come from `base`.
- `extractSharedLink`: take every `https?://` run up to whitespace, `<`, `>` or a quote. Trim trailing `.,;:!?'"]}` and a trailing `)` when the run has no `(`. A run whose `origin + pathname` is `https://iteatsthesalt.github.io/Game-Dev-Resources/byways/` and whose hash starts with `#s=` wins, as `{kind:'share', hash}`. Otherwise the first run is `{kind:'url', url}`.

- [ ] **Step 4: Run them to see them pass**

Run: `node --test tests/unit/platform-android.test.js`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add src/platform/android.js tests/unit/platform-android.test.js
git commit -m "Add the Android platform bridge client and native transport"
```

### Task 7: Android platform voice, speech and media

**Files:**
- Modify: `src/platform/android.js`
- Test: `tests/unit/platform-android.test.js`

**Interfaces:**
- Consumes: `createBridgeClient` (Task 6); the `VoiceEngine`, `Tts` and `media` shapes (overview).
- Produces: `platform.voice`, `platform.tts` and `platform.media` over the `voice`, `tts` and `media` channels.

- [ ] **Step 1: Write the failing tests**

```js
test('voice goes over the bridge', async () => {
  const port = fakePort(); const p = createAndroidPlatform({ bridge: port, base: fakeBase(), win });
  const st = p.voice.probe({ allowCloud: false });
  assert.deepEqual(port.last(), { id: '2', ch: 'voice', op: 'probe', args: { allowCloud: false } });
  const status = { kind: 'native', vendor: 'android', needsDownload: false, continuous: true, reason: null };
  port.reply('2', status); assert.deepEqual(await st, status);
  p.voice.start({ lang: 'en-US', phrases: ['next', 'go back'], allowCloud: false });
  assert.deepEqual(port.last().args, { lang: 'en-US', phrases: ['next', 'go back'], allowCloud: false });
  const got = []; p.voice.on('result', d => got.push(d)); p.voice.on('error', d => got.push(d));
  port.emit('voice', 'result', { text: 'next one', final: true }); port.emit('voice', 'error', { code: 'no-speech' });
  assert.deepEqual(got, [{ text: 'next one', final: true }, { code: 'no-speech' }]);
  p.voice.stop(); assert.equal(port.last().op, 'stop');
});
test('speak resolves only when native finishes', async () => {
  const port = fakePort(); const p = createAndroidPlatform({ bridge: port, base: fakeBase(), win });
  let done = false; const s = p.tts.speak('Hello.', { rate: 1.2 }).then(() => { done = true; });
  assert.deepEqual(port.last().args, { text: 'Hello.', voiceURI: null, rate: 1.2, volume: 1 });
  await tick(); assert.equal(done, false);
  port.reply(port.last().id, true); await s; assert.equal(done, true);
  p.tts.cancel(); assert.deepEqual([port.last().ch, port.last().op, port.last().args], ['tts', 'cancel', {}]);
});
test('media buttons call the handlers', () => {
  const port = fakePort(); const p = createAndroidPlatform({ bridge: port, base: fakeBase(), win }); const calls = [];
  p.media.setHandlers({ next: () => calls.push('next'), previous: () => calls.push('previous'), playPause: () => calls.push('playPause') });
  port.emit('media', 'next'); port.emit('media', 'previous'); port.emit('media', 'playPause');
  assert.deepEqual(calls, ['next', 'previous', 'playPause']);
  p.media.setActive(true); assert.deepEqual(port.last().args, { on: true });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/unit/platform-android.test.js`
Expected: the three new tests FAIL with `TypeError: Cannot read properties of undefined (reading 'probe')`.

- [ ] **Step 3: Implement `voice`, `tts` and `media`**

`voice.stop`, `tts.cancel` and `media.setActive` send and swallow rejections. `speak` sends `voiceURI ?? null`, `rate ?? 1` and `volume ?? 1` and resolves `undefined` on the reply. `media.setHandlers` replaces the stored handlers; events call `next`, `previous` or `playPause` when set. `voice.probe` passes native's `VoiceStatus` through unchanged, including the contract's cloud-only form (Task 8).

- [ ] **Step 4: Run them to see them pass**

Run: `node --test tests/unit/platform-android.test.js`
Expected: PASS (15 tests).

- [ ] **Step 5: Commit**

```bash
git add src/platform/android.js tests/unit/platform-android.test.js
git commit -m "Add native voice, speech and media to the Android platform"
```

### Task 8: Native voice and the first-run consent

**Files:**
- Create: `…/byways/SpeechErrors.kt`, `…/byways/VoiceProbe.kt`, `…/byways/SpeechBridge.kt`
- Modify: `…/byways/MainActivity.kt`, `tests/unit/android-shell.test.js`
- Test: `shells/android/app/src/test/kotlin/io/github/iteatsthesalt/byways/SpeechErrorsTest.kt`, `…/VoiceProbeTest.kt` (same folder)

**Interfaces:**
- Consumes: `ChannelHandler`, `Reply`, `Bridge.emit` (Task 5); the `VoiceStatus` and `VoiceErrorCode` shapes and the cloud-only convention (overview).
- Produces:

```kotlin
object SpeechErrors { fun toCode(error: Int): String }     // always a VoiceErrorCode name
object VoiceProbe {                                         // pure: the probe decision table
  fun status(sdk: Int, hasMic: Boolean, onDevice: Boolean, anyRecogniser: Boolean, servicePackage: String?,
             allowCloud: Boolean, langInstalled: Boolean?): Map<String, Any?>   // a VoiceStatus
}
class SpeechBridge(private val activity: ComponentActivity, private val emit: (event: String, data: Any?) -> Unit) : ChannelHandler {
  fun stopNow()                                            // called from onPause
  fun resumed()                                            // called from onResume; runs a held start
}
```

- [ ] **Step 1: Write the failing tests**

```kotlin
class SpeechErrorsTest {
  @Test fun mapsEveryNativeCode() {   // the constants are inlined at compile time, so no Android runtime is needed
    val table = mapOf(
      SpeechRecognizer.ERROR_NO_MATCH to "no-speech", SpeechRecognizer.ERROR_SPEECH_TIMEOUT to "no-speech",
      SpeechRecognizer.ERROR_RECOGNIZER_BUSY to "busy", SpeechRecognizer.ERROR_TOO_MANY_REQUESTS to "too-many-requests",
      SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS to "not-allowed", SpeechRecognizer.ERROR_NETWORK to "network",
      SpeechRecognizer.ERROR_NETWORK_TIMEOUT to "network", SpeechRecognizer.ERROR_SERVER to "network",
      SpeechRecognizer.ERROR_SERVER_DISCONNECTED to "network", SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED to "language-not-supported",
      SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE to "language-not-supported", SpeechRecognizer.ERROR_AUDIO to "audio-capture",
      SpeechRecognizer.ERROR_CLIENT to "aborted", SpeechRecognizer.ERROR_CANNOT_CHECK_SUPPORT to "service-not-allowed",
      SpeechRecognizer.ERROR_CANNOT_LISTEN_TO_DOWNLOAD_EVENTS to "service-not-allowed")
    for ((code, name) in table) assertEquals("code $code", name, SpeechErrors.toCode(code))
  }
  @Test fun unknownCodesAreAborted() = assertEquals("aborted", SpeechErrors.toCode(999))
  @Test fun onlyContractNames() {
    val names = setOf("no-speech", "aborted", "audio-capture", "network", "not-allowed", "service-not-allowed",
      "language-not-supported", "phrases-not-supported", "busy", "too-many-requests")
    for (c in -1..20) assertTrue(SpeechErrors.toCode(c) in names)
  }
}
```

Add to `tests/unit/android-shell.test.js`:

```js
test('speech uses the spec extras and stops in onPause', () => {
  const k = f => R(`${S}/app/src/main/kotlin/io/github/iteatsthesalt/byways/${f}`);
  for (const s of ['EXTRA_PREFER_OFFLINE', 'EXTRA_SEGMENTED_SESSION', 'EXTRA_AUDIO_SOURCE', 'LANGUAGE_MODEL_WEB_SEARCH',
    'EXTRA_BIASING_STRINGS', 'createOnDeviceSpeechRecognizer', 'Looper.getMainLooper()']) assert.ok(k('SpeechBridge.kt').includes(s), s);
  assert.match(k('MainActivity.kt'), /override fun onPause\(\)[\s\S]*stopNow\(\)/);
  assert.ok(k('MainActivity.kt').includes('Manifest.permission.RECORD_AUDIO'));
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/unit/android-shell.test.js` and `gradle -p shells/android testDebugUnitTest --tests '*SpeechErrorsTest'` (or the CI job).
Expected: Node fails with `ENOENT` on `SpeechBridge.kt`; Gradle fails with `Unresolved reference 'SpeechErrors'`.

- [ ] **Step 3: Implement `SpeechErrors.toCode`** as the table above, with every other value giving `aborted`.

- [ ] **Step 4: Implement `SpeechBridge`**

Every recogniser call is posted to `Handler(Looper.getMainLooper())`.

- `probe {allowCloud}`:
  - Without `RECORD_AUDIO`: `{kind:'none', vendor:null, needsDownload:false, continuous:false, reason:'Microphone permission is off. Turn it on in Android settings.'}`.
  - `onDevice` = API ≥ 31 and `SpeechRecognizer.isOnDeviceRecognitionAvailable(ctx)`. Neither that nor `isRecognitionAvailable(ctx)`: kind `none`, reason `This phone has no speech recogniser.`
  - `onDevice`: `{kind:'native', vendor:'android', needsDownload, continuous: API ≥ 33, reason:null}`. On API 33+, `needsDownload` is true when `checkRecognitionSupport` (3 s limit) does not list the language as installed.
  - Cloud only: `vendor` is `'google'` when the first `RecognitionService` package starts with `com.google`, else `'android'`. With `allowCloud`: kind `native`, `continuous:false`. Without it: kind `none`, reason `This phone only has cloud voice. Turn on cloud voice in Settings → Voice.`
- `install {}`: API ≥ 33 calls `triggerModelDownload(intent)` and replies true; otherwise false.
- `start {lang, phrases, allowCloud}`: no permission → error `not-allowed`; cloud only without `allowCloud` → error `service-not-allowed`. Create `createOnDeviceSpeechRecognizer` when `onDevice`, else `createSpeechRecognizer`. The intent sets `EXTRA_LANGUAGE_MODEL = LANGUAGE_MODEL_WEB_SEARCH`, `EXTRA_LANGUAGE = lang`, `EXTRA_PARTIAL_RESULTS = true`, `EXTRA_MAX_RESULTS = 1`, and `EXTRA_PREFER_OFFLINE = true` when `onDevice`. On API 33+ it adds `EXTRA_BIASING_STRINGS = ArrayList(phrases)`. When also `onDevice`, it adds `EXTRA_SEGMENTED_SESSION = RecognizerIntent.EXTRA_AUDIO_SOURCE`, `EXTRA_AUDIO_SOURCE` (the read end of `ParcelFileDescriptor.createPipe()`), `EXTRA_AUDIO_SOURCE_CHANNEL_COUNT = 1`, `EXTRA_AUDIO_SOURCE_ENCODING = AudioFormat.ENCODING_PCM_16BIT` and `EXTRA_AUDIO_SOURCE_SAMPLING_RATE = 16000`. A thread copies an `AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, 16000, CHANNEL_IN_MONO, ENCODING_PCM_16BIT, …)` into the write end until stop. Confirm the `EXTRA_SEGMENTED_SESSION` value type against the API 33 `RecognizerIntent` docs.
- Listener: `onReadyForSpeech` replies to `start` once and emits `state {listening:true}`. `onPartialResults` emits `result {text, final:false}`. `onResults` and `onSegmentResults` emit `result {text, final:true}` with the first `RESULTS_RECOGNITION` entry. `onResults`, `onEndOfSegmentedSession` and `onError` emit `state {listening:false}`. `onError(code)` emits `error {code: SpeechErrors.toCode(code)}` (and rejects a pending `start`), except `ERROR_CLIENT` right after our own stop.
- `stop {}` and `stopNow()`: `cancel()`, close the pipe and `AudioRecord`, `destroy()` the recogniser, emit `state {listening:false}`.

- [ ] **Step 5: Add the consent screen and lifecycle to `MainActivity`**

- On first launch (SharedPreferences `byways`, `consentShown` false), before `loadUrl`, show a non-cancelable `AlertDialog`. Title: `Hands-free voice`. Message: `Byways can listen for commands like “next one” and “save it”, and read finds aloud. It needs the microphone for that. You can change this later in Android settings.` Buttons: **Allow microphone** (runs `registerForActivityResult(ActivityResultContracts.RequestPermission())` for `Manifest.permission.RECORD_AUDIO`, then stores `micConsent` = granted) and **Not now** (stores `micConsent` false). Both set `consentShown` true and then load `APP_URL`.
- Register `"voice" to speechBridge` in the bridge handlers, with `emit = { e, d -> bridge.emit("voice", e, d) }`.
- `override fun onPause()` calls `speechBridge.stopNow()` after `super.onPause()`.

- [ ] **Step 6: Run them to see them pass**

Run: the Step 2 commands. Expected: PASS (Node: 9 tests; Gradle: 3 new tests).

- [ ] **Step 7: Commit**

```bash
git add shells/android/app/src/main/kotlin/io/github/iteatsthesalt/byways shells/android/app/src/test/kotlin/io/github/iteatsthesalt/byways/SpeechErrorsTest.kt tests/unit/android-shell.test.js
git commit -m "Add native voice commands and the microphone consent screen"
```

### Task 9: Native read-aloud, media session, share and file save

**Files:**
- Create: `…/byways/TtsBridge.kt`, `…/byways/MediaBridge.kt`, `…/byways/ShareBridge.kt`, `…/byways/FilesBridge.kt`
- Modify: `…/byways/MainActivity.kt`, `tests/unit/android-shell.test.js`

**Interfaces:**
- Consumes: `ChannelHandler`, `Reply`, `Bridge.emit` (Task 5).
- Produces: `class TtsBridge(ctx: Context) : ChannelHandler` with `fun shutdown()`; `class MediaBridge(ctx: Context, emit: (String, Any?) -> Unit) : ChannelHandler` with `fun release()`; `class ShareBridge(activity: ComponentActivity) : ChannelHandler`; `class FilesBridge(activity: ComponentActivity) : ChannelHandler` (constructed in `onCreate`, before the activity starts, because it registers an activity-result launcher). `LabBridge` (Task 13) reuses `FilesBridge`.

- [ ] **Step 1: Write the failing test**

```js
test('speech, media, share and files use the native APIs', () => {
  const k = f => R(`${S}/app/src/main/kotlin/io/github/iteatsthesalt/byways/${f}`);
  for (const s of ['UtteranceProgressListener', 'isNetworkConnectionRequired', 'KEY_PARAM_VOLUME', 'setSpeechRate'])
    assert.ok(k('TtsBridge.kt').includes(s), s);
  for (const s of ['MediaSession', 'onSkipToNext', 'onSkipToPrevious', 'ACTION_PLAY_PAUSE']) assert.ok(k('MediaBridge.kt').includes(s), s);
  for (const s of ['Intent.ACTION_SEND', 'Intent.createChooser', '"text/plain"']) assert.ok(k('ShareBridge.kt').includes(s), s);
  assert.ok(k('FilesBridge.kt').includes('CreateDocument'));
  for (const s of ['"tts" to', '"media" to', '"share" to', '"files" to']) assert.ok(k('MainActivity.kt').includes(s), s);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test tests/unit/android-shell.test.js`
Expected: FAIL with `ENOENT` on `TtsBridge.kt`.

- [ ] **Step 3: Implement `TtsBridge`**

- Create `TextToSpeech(ctx) { status -> … }` once. Requests that arrive before init finishes wait for it. Init failure replies `service-not-allowed`.
- `speak {text, voiceURI, rate, volume}`: when `voiceURI` is set, `setVoice` to the voice with that `name`. `setSpeechRate(rate)`, a params `Bundle` with `KEY_PARAM_VOLUME = volume`, then `speak(text, QUEUE_ADD, params, <request id>)`. The `UtteranceProgressListener` `onDone`, `onError` and `onStop` for that id reply `true` on the main thread.
- `cancel {}`: `stop()`, reply `true` to every pending `speak`, then reply `true`.
- `voices {}`: `voices` sorted by name, as `{uri: name, name, lang: locale.toLanguageTag(), local: !isNetworkConnectionRequired}`.

- [ ] **Step 4: Implement `MediaBridge`, `ShareBridge` and `FilesBridge`**

- `MediaBridge`: one `android.media.session.MediaSession(ctx, "Byways")`. The callback's `onSkipToNext`, `onSkipToPrevious`, and both `onPlay` and `onPause`, emit `next`, `previous` and `playPause`. `setActive {on}` sets `isActive` and a `PlaybackState` with `ACTION_SKIP_TO_NEXT or ACTION_SKIP_TO_PREVIOUS or ACTION_PLAY_PAUSE or ACTION_PLAY or ACTION_PAUSE`, in `STATE_PLAYING` when on and `STATE_PAUSED` when off.
- `ShareBridge.send {title, text, url}`: an `Intent.ACTION_SEND` of type `"text/plain"` whose `EXTRA_TEXT` is the non-null parts of `text` and `url` joined by a space, with `EXTRA_SUBJECT = title`. Start `Intent.createChooser(intent, "Share")` and reply `'shared'`.
- `FilesBridge.save {name, mime, base64}`: a `CreateDocument("*/*")` subclass whose `createIntent` sets the intent type to the requested `mime`. A `null` result replies `'cancelled'`. Otherwise decode and write on a background thread, then reply `'saved'`. A second save while one is open replies `busy`.

- [ ] **Step 5: Wire them in `MainActivity`**

Add `"tts" to tts`, `"media" to media`, `"share" to share` and `"files" to files` to the handler map. `onDestroy` calls `tts.shutdown()` and `media.release()`.

- [ ] **Step 6: Run it to see it pass**

Run: `node --test tests/unit/android-shell.test.js`
Expected: PASS (10 tests). CI `assembleDebug` compiles the new files.

- [ ] **Step 7: Commit**

```bash
git add shells/android/app/src/main/kotlin/io/github/iteatsthesalt/byways tests/unit/android-shell.test.js
git commit -m "Add native read-aloud, media buttons, share and file save"
```

### Task 10: Link and asset rules, and the site view

**Files:**
- Create: `…/byways/LinkPolicy.kt`, `…/byways/SiteView.kt`
- Modify: `…/byways/MainActivity.kt`
- Test: `shells/android/app/src/test/kotlin/io/github/iteatsthesalt/byways/LinkPolicyTest.kt`

**Interfaces:**
- Consumes: `Bridge.emit` (Task 5); `MainActivity.APP_HOST` (Task 2); `BridgeGate.LAB_ORIGIN` (Task 5).
- Produces:

```kotlin
object LinkPolicy {
  enum class Action { LOAD, SITE, EXTERNAL, BLOCK }
  fun forMainView(url: String): Action   // app or Lab origin → LOAD; other http(s) → SITE
  fun forSiteView(url: String): Action   // http(s) → LOAD
}                                         // both: intent, market, mailto, tel, sms, geo → EXTERNAL; anything else → BLOCK
object AssetRules {
  fun mimeFor(path: String): String
  fun safeAssetPath(dir: String, suffix: String): String?   // "<dir>/<suffix>", or null for "", "..", "\" or a leading "/"
}
fun openOutside(activity: ComponentActivity, url: String, fallback: (String) -> Unit)   // in SiteView.kt
class SiteView(private val activity: ComponentActivity, private val host: FrameLayout, private val onNext: () -> Unit,
               private val onClosed: () -> Unit) {
  val isOpen: Boolean
  fun open(url: String, title: String)   // the same URL as the one showing does not reload
  fun close()
  fun goBack(): Boolean                  // true when the site view went back a page
}
```

- [ ] **Step 1: Write the failing test**

```kotlin
class LinkPolicyTest {
  @Test fun mainViewKeepsOnlyItsOwnOrigins() {
    assertEquals(LOAD, LinkPolicy.forMainView("https://appassets.androidplatform.net/assets/www/index.html#/feed"))
    assertEquals(LOAD, LinkPolicy.forMainView("https://lab.appassets.androidplatform.net/assets/lab/index.html"))
    assertEquals(SITE, LinkPolicy.forMainView("https://appassets.androidplatform.net.evil.com/"))
    assertEquals(SITE, LinkPolicy.forMainView("http://appassets.androidplatform.net/assets/www/index.html"))
    assertEquals(SITE, LinkPolicy.forMainView("https://example.org/"))
    assertEquals(EXTERNAL, LinkPolicy.forMainView("mailto:a@b.example"))
    assertEquals(BLOCK, LinkPolicy.forMainView("javascript:alert(1)"))
  }
  @Test fun siteViewLoadsWebAndSendsAppLinksOut() {
    assertEquals(LOAD, LinkPolicy.forSiteView("https://example.org"))
    assertEquals(LOAD, LinkPolicy.forSiteView("http://old.example/"))
    assertEquals(EXTERNAL, LinkPolicy.forSiteView("intent://scan/#Intent;scheme=zxing;end"))
    assertEquals(EXTERNAL, LinkPolicy.forSiteView("market://details?id=x"))
    for (u in listOf("javascript:alert(1)", "file:///sdcard/x", "content://x/y", "data:text/html,hi", "about:blank"))
      assertEquals(u, BLOCK, LinkPolicy.forSiteView(u))
  }
  @Test fun assetTypes() {
    val t = mapOf("a.wasm" to "application/wasm", "a.js" to "text/javascript", "a.mjs" to "text/javascript",
      "index.html" to "text/html", "a.css" to "text/css", "d.json" to "application/json", "i.svg" to "image/svg+xml",
      "i.png" to "image/png", "f.woff2" to "font/woff2", "x.zip" to "application/zip", "x.weird" to "application/octet-stream")
    for ((p, m) in t) assertEquals(p, m, AssetRules.mimeFor(p))
  }
  @Test fun assetPathsStayInTheirFolder() {
    assertEquals("lab/vendor/js-dos/js-dos.js", AssetRules.safeAssetPath("lab", "vendor/js-dos/js-dos.js"))
    for (s in listOf("", "../www/index.html", "a/../../x", "/etc/hosts", "a\\b")) assertNull(s, AssetRules.safeAssetPath("lab", s))
  }
}
```

- [ ] **Step 2: Run it to see it fail**

Run: `gradle -p shells/android testDebugUnitTest --tests '*LinkPolicyTest'` (or the CI job).
Expected: FAIL to compile with `Unresolved reference 'LinkPolicy'`.

- [ ] **Step 3: Implement `LinkPolicy` and `AssetRules`**

Parse with `java.net.URI`; compare scheme and host exactly (lower-cased). A URL that does not parse is `BLOCK`. `safeAssetPath` rejects any `..` segment.

- [ ] **Step 4: Implement `SiteView` and `openOutside`**

- The site view is a vertical `LinearLayout` over the main WebView: a 56 dp toolbar with three buttons, **Back to Byways** (`close()`), **Next** (`onNext()`) and **Open in browser** (`openOutside` with the current URL); then a one-line `TextView` showing the current host; then a `WebView` created on the first `open`.
- Its settings: JavaScript and DOM storage on, `allowFileAccess = false`, `allowContentAccess = false`, `MIXED_CONTENT_NEVER_ALLOW`, `setSupportMultipleWindows(false)`. It has no message listener, no file chooser and no download listener, and `onPermissionRequest` calls `request.deny()`.
- `shouldOverrideUrlLoading` acts on main-frame requests only: `LOAD` → false; `EXTERNAL` → `openOutside`, true; `BLOCK` → true.
- `close()` destroys the WebView, removes the layout and calls `onClosed()`.
- `openOutside`: `intent:` URLs go through `Intent.parseUri(url, Intent.URI_INTENT_SCHEME)`, others through `Intent(ACTION_VIEW, Uri.parse(url))`. Add `CATEGORY_BROWSABLE` and set `component = null` and `selector = null`. On `ActivityNotFoundException`, an `https` `browser_fallback_url` extra goes to `fallback`; otherwise show the toast `No app on this phone can open this link.`

- [ ] **Step 5: Wire it in `MainActivity`**

- The `app` handler gains `openSite {url, title}` (`http(s)` only, else error `scheme`; replies `true`) and `closeSite {}`.
- `onNext` emits `app` `siteNext {}`, and `onClosed` emits `app` `siteClosed {}`.
- The main WebView's `shouldOverrideUrlLoading` (main frame only) uses `LinkPolicy.forMainView`: `LOAD` → false; `SITE` → `siteView.open(url, "")`, true; `EXTERNAL` → `openOutside`, true; `BLOCK` → true.

- [ ] **Step 6: Run it to see it pass**

Run: the Step 2 command. Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add shells/android/app/src/main/kotlin/io/github/iteatsthesalt/byways shells/android/app/src/test/kotlin/io/github/iteatsthesalt/byways/LinkPolicyTest.kt
git commit -m "Add the in-app site view with link rules"
```

### Task 11: System behaviour: full screen, file chooser, Back, insets and share-in

**Files:**
- Modify: `…/byways/MainActivity.kt`, `tests/unit/android-shell.test.js`

**Interfaces:**
- Consumes: `Bridge.emit` and the handler map (Task 5); `SiteView.isOpen`, `goBack`, `close` (Task 10); `MainActivity.APP_URL` (Task 2); `BridgeGate.LAB_ORIGIN` (Task 5).
- Produces: the `back` channel (`result {token, handled}`) and the events `back` `request {token}` and `app` `shared {text}`.

- [ ] **Step 1: Write the failing test**

```js
test('activity handles full screen, files, back, insets and share-in', () => {
  const m = R(`${S}/app/src/main/kotlin/io/github/iteatsthesalt/byways/MainActivity.kt`);
  for (const s of ['onShowCustomView', 'onHideCustomView', 'onShowFileChooser', '"*/*"', 'EXTRA_ALLOW_MULTIPLE',
    'OnBackPressedCallback', 'enableEdgeToEdge', 'setOnApplyWindowInsetsListener', 'onNewIntent', 'Intent.EXTRA_TEXT', '"back" to'])
    assert.ok(m.includes(s), s);
});
test('WebView permission requests are always denied', () => {
  const dir = `${S}/app/src/main/kotlin/io/github/iteatsthesalt/byways`;
  for (const f of readdirSync(dir)) assert.doesNotMatch(R(`${dir}/${f}`), /\.grant\(/, f);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test tests/unit/android-shell.test.js`
Expected: FAIL with `onShowCustomView`.

- [ ] **Step 3: Implement the behaviours in `MainActivity`**

- **Full screen:** `onShowCustomView(view, callback)` adds `view` to a black, match-parent `FrameLayout` above everything and hides the system bars with `WindowInsetsControllerCompat(window, view)` (`BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE`). `onHideCustomView` removes it, shows the bars and calls `callback.onCustomViewHidden()`.
- **File chooser:** `onShowFileChooser(view, callback, params)` first sends `null` to any earlier callback still waiting, then keeps the new one. It launches `ACTION_GET_CONTENT` with `CATEGORY_OPENABLE`, type `"*/*"`, and `EXTRA_ALLOW_MULTIPLE = params.mode == FileChooserParams.MODE_OPEN_MULTIPLE`, through a `StartActivityForResult` launcher registered in `onCreate`. The result's `clipData` URIs, else its `data` URI, else `null`, go to the callback. Return `true`.
- **Back:** an `OnBackPressedCallback(true)` handles, in order:
  1. a custom view showing → hide it;
  2. the site view open → `goBack()`, or else `close()`;
  3. the main WebView on the Lab origin → `goBack()` when it can, else `loadUrl(APP_URL)`;
  4. otherwise increment `backToken`, emit `back` `request {token}` and wait up to 500 ms for the `back` `result {token, handled}` with that token.

  When `handled` is false or the wait times out, set `isEnabled = false`, call `onBackPressedDispatcher.onBackPressed()`, then set `isEnabled = true`.
- **Insets:** `enableEdgeToEdge()`, then `ViewCompat.setOnApplyWindowInsetsListener(root)` pads `root` with the union of `systemBars()`, `ime()` and `displayCutout()` and returns `WindowInsetsCompat.CONSUMED`.
- **Share-in:** `handleShare(intent)` runs from `onCreate` and `onNewIntent`. For `ACTION_SEND` with type `text/plain`, it emits `app` `shared {text}` with `EXTRA_TEXT` (or `EXTRA_SUBJECT` when the text is missing), cut to 10,000 characters. `Bridge.emit` queues it until the page says `hello`.

- [ ] **Step 4: Run it to see it pass**

Run: `node --test tests/unit/android-shell.test.js`
Expected: PASS (12 tests). CI `assembleDebug` compiles the activity.

- [ ] **Step 5: Commit**

```bash
git add shells/android/app/src/main/kotlin/io/github/iteatsthesalt/byways/MainActivity.kt tests/unit/android-shell.test.js
git commit -m "Add full screen, file picking, predictive back, insets and share-in"
```

### Task 12: The update check

**Files:**
- Create: `…/byways/UpdateCheck.kt`
- Modify: `…/byways/MainActivity.kt` (the `app` handler)
- Test: `shells/android/app/src/test/kotlin/io/github/iteatsthesalt/byways/UpdateCheckTest.kt`

**Interfaces:**
- Consumes: `NativeFetch`, `FetchRequest` (Task 4).
- Produces (pure Kotlin):

```kotlin
object UpdateCheck {
  const val LATEST_URL = "https://api.github.com/repos/iteatsthesalt/Game-Dev-Resources/releases/latest"
  const val LIST_URL = "https://api.github.com/repos/iteatsthesalt/Game-Dev-Resources/releases?per_page=30"
  data class Release(val version: String, val url: String)
  fun versionOf(tag: String): String?               // "byways-v1.2.0" → "1.2.0"; any other tag → null
  fun isNewer(candidate: String, current: String): Boolean
  fun fromLatest(json: String): Release?            // null when the tag is not byways-v*
  fun fromList(json: String): Release?              // first non-draft, non-prerelease byways-v* release
}
```

The `app` op `checkUpdate {}` replies `{available, latest, url}`.

- [ ] **Step 1: Write the failing test**

```kotlin
class UpdateCheckTest {
  private val apk = "https://github.com/iteatsthesalt/Game-Dev-Resources/releases/download/byways-v1.3.0/byways-1.3.0.apk"
  @Test fun readsByWaysTagsOnly() {
    assertEquals("1.2.0", UpdateCheck.versionOf("byways-v1.2.0"))
    assertNull(UpdateCheck.versionOf("cinderdeep-v2.0.0")); assertNull(UpdateCheck.versionOf("v1.2.0"))
  }
  @Test fun comparesNumerically() {
    assertTrue(UpdateCheck.isNewer("1.10.0", "1.9.3")); assertTrue(UpdateCheck.isNewer("1.2.1", "1.2"))
    assertTrue(UpdateCheck.isNewer("0.1.1", "0.1.0")); assertFalse(UpdateCheck.isNewer("1.2.0", "1.2.0"))
    assertFalse(UpdateCheck.isNewer("1.2", "1.2.0")); assertFalse(UpdateCheck.isNewer("2.0.0-beta", "1.0.0"))
  }
  @Test fun picksTheApkAsset() {
    val j = """{"tag_name":"byways-v1.3.0","html_url":"https://github.com/r/1.3.0","assets":[
      {"name":"byways-chrome.zip","browser_download_url":"https://x/c.zip"},{"name":"byways-1.3.0.apk","browser_download_url":"$apk"}]}"""
    assertEquals(UpdateCheck.Release("1.3.0", apk), UpdateCheck.fromLatest(j))
  }
  @Test fun fallsBackToTheReleasePage() =
    assertEquals(UpdateCheck.Release("1.3.0", "https://github.com/r/1.3.0"),
      UpdateCheck.fromLatest("""{"tag_name":"byways-v1.3.0","html_url":"https://github.com/r/1.3.0","assets":[]}"""))
  @Test fun ignoresOtherProjectsReleases() =
    assertNull(UpdateCheck.fromLatest("""{"tag_name":"cinderdeep-v2.0.0","html_url":"https://x","assets":[]}"""))
  @Test fun listSkipsDraftsPrereleasesAndOtherTags() {
    val j = """[{"tag_name":"byways-v1.4.0","draft":true,"prerelease":false,"html_url":"a","assets":[]},
      {"tag_name":"byways-v1.3.5","draft":false,"prerelease":true,"html_url":"b","assets":[]},
      {"tag_name":"cinderdeep-v1.0.0","draft":false,"prerelease":false,"html_url":"c","assets":[]},
      {"tag_name":"byways-v1.3.0","draft":false,"prerelease":false,"html_url":"d","assets":[]}]"""
    assertEquals(UpdateCheck.Release("1.3.0", "d"), UpdateCheck.fromList(j))
  }
}
```

- [ ] **Step 2: Run it to see it fail**

Run: `gradle -p shells/android testDebugUnitTest --tests '*UpdateCheckTest'` (or the CI job).
Expected: FAIL to compile with `Unresolved reference 'UpdateCheck'`.

- [ ] **Step 3: Implement `UpdateCheck`**

`isNewer` splits both on `.`, pads missing parts with 0 and compares them as integers. It returns false when any part of either version is not a plain number. The release URL is the first asset whose `name` ends in `.apk`, else `html_url`.

- [ ] **Step 4: Add `checkUpdate` to the `app` handler**

On the fetch executor, GET `LATEST_URL` with `Accept: application/vnd.github+json` and `User-Agent: Byways/<versionName> (+https://github.com/iteatsthesalt/Game-Dev-Resources)`. A 200 goes to `fromLatest`. If that gives `null`, GET `LIST_URL` and use `fromList`. Reply `{available: release != null && isNewer(release.version, versionName), latest: release?.version, url: release?.url}`. A non-200 status or a `FetchError` replies the error `network`.

- [ ] **Step 5: Run it to see it pass**

Run: the Step 2 command. Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add shells/android/app/src/main/kotlin/io/github/iteatsthesalt/byways shells/android/app/src/test/kotlin/io/github/iteatsthesalt/byways/UpdateCheckTest.kt
git commit -m "Add the GitHub release update check"
```

### Task 13: The Lab on its own origin

**Files:**
- Modify: `…/byways/MainActivity.kt`, `…/byways/Bridge.kt`, `src/lab/storage-panel.js`, `tests/unit/android-shell.test.js`

**Interfaces:**
- Consumes: `AssetRules` (Task 10); `BridgeGate` and `BridgeCodec` (Task 5); `FilesBridge` (Task 9); `labSaveFile` (Task 6); the Task 1 `assets/lab/` layout.
- Produces: `class LabBridge(webView: WebView, files: FilesBridge) { fun install(): Boolean }`, listening as `BywaysLabNative` for `https://lab.appassets.androidplatform.net` with only `files.save`. Both asset loaders serve one folder each.

- [ ] **Step 1: Write the failing test**

```js
test('each origin serves only its own folder, and the Lab gets only files.save', () => {
  const k = f => R(`${S}/app/src/main/kotlin/io/github/iteatsthesalt/byways/${f}`);
  const m = k('MainActivity.kt');
  assert.ok(m.includes('"lab.appassets.androidplatform.net"'));
  assert.ok(m.includes('safeAssetPath("www"') && m.includes('safeAssetPath("lab"'));
  assert.doesNotMatch(m, /AssetsPathHandler/);
  assert.ok(k('Bridge.kt').includes('"BywaysLabNative"'));
  assert.match(R('src/lab/storage-panel.js'), /labSaveFile/);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test tests/unit/android-shell.test.js`
Expected: FAIL on `"lab.appassets.androidplatform.net"`.

- [ ] **Step 3: Replace the asset loader in `MainActivity`**

Two loaders: domain `APP_HOST` with a path handler at `/assets/www/`, and domain `lab.appassets.androidplatform.net` with one at `/assets/lab/`. Each handler is a `WebViewAssetLoader.PathHandler` that maps the suffix through `AssetRules.safeAssetPath("www"|"lab", suffix)`. It answers `null` for a rejected path and otherwise returns `WebResourceResponse(AssetRules.mimeFor(path), null, assets.open(path))` (`null` on `IOException`). `shouldInterceptRequest` tries the app loader, then the Lab loader. Remove `AssetsPathHandler`. This keeps the Lab files off the app origin, where the main bridge lives.

- [ ] **Step 4: Add `LabBridge` to `Bridge.kt` and install it**

`WebViewCompat.addWebMessageListener(webView, "BywaysLabNative", setOf(BridgeGate.LAB_ORIGIN))`. Accept only `BridgeGate.accepts(LAB_ORIGIN, origin, isMainFrame)`. Decode with `BridgeCodec`. Only `ch == "files" && op == "save"` reaches `files.handle`; anything else replies `unknown-op`. Install it next to `Bridge` in `onCreate`.

- [ ] **Step 5: Save Lab files natively in `src/lab/storage-panel.js`**

Import `labSaveFile` from `../platform/android.js`. Where the panel starts a browser download of a save or export, first run `const native = labSaveFile(name, blob); if (native) { await native; return; }`.

- [ ] **Step 6: Run the tests**

Run: `node --test tests/unit/android-shell.test.js` and `npm test`
Expected: PASS (13 shell tests), and the Lab tests from Plan 06 still pass.

- [ ] **Step 7: Commit**

```bash
git add shells/android/app/src/main/kotlin/io/github/iteatsthesalt/byways src/lab/storage-panel.js tests/unit/android-shell.test.js
git commit -m "Serve the Lab on its own origin with a save-only bridge"
```

### Task 14: Wire the Android platform into the app

**Files:**
- Modify: `src/platform/android.js`, `src/ui/boot.js`, `src/ui/views/settings/about.js`, the Plan 03 settings section that renders the dwell-time control (find it in `src/ui/views/settings/`)
- Modify: `tests/e2e/helpers/fakes.js`
- Create: `tests/e2e/android.spec.js`

**Interfaces:**
- Consumes: `boot(platform) → Promise<App>` and the `App` fields `engine`, `getSettings()`, `saveSettings(patch)`, `handsFree`, `platform` (overview); `navigate(route)` (`ui/router.js`); `showResult(result)` (`ui/views/stumble.js`); `makeFind(partial)` (`core/model/find.js`); `domainOf(u)` (`core/util/url.js`); `showToast(message)` (`ui/toast.js`); `createHandsFree(…).start()` and `.state`; `mockNet(page)` and `tests/fixtures/routes.js` (Plan 01); `extractSharedLink`, `platform.app` (Task 6).
- Produces:
  - `platform.attach(app) → Promise<void>`. `boot()` calls `await platform.attach?.(app)` once the app is built. Only the Android platform defines it.
  - The window event `byways:back`: a cancelable `CustomEvent` that `attach` dispatches on Back. Any open panel, card menu or help card that closes itself calls `event.preventDefault()`.
  - `installFakeAndroidBridge(page, {hello?, update?}) → Promise<{native: () => Promise<object[]>, emit(ch, event, data), unmatched: string[]}>` in `tests/e2e/helpers/fakes.js`.

- [ ] **Step 1: Add the fake bridge helper**

`installFakeAndroidBridge` exposes a binding `__nativeFetch(req)` that answers from `tests/fixtures/routes.js`, reading the fixture with the same path rule `mockNet` uses. It returns `{status, statusText, headers, body, url}`, or `{error: 'network'}` after pushing the URL to `unmatched`. Through `addInitScript` it defines `window.BywaysNative = {onmessage: null, postMessage(s)}`, which records every message in `window.__native` and replies:

| Message | Reply |
|---|---|
| `app.hello` | `hello`, default `{versionName:'0.1.0', versionCode:1, sdk:34, micConsent:false}` |
| `app.checkUpdate` | `update`, default `{available:false, latest:'0.1.0', url:null}`; `update:'error'` replies `{ok:false, error:{code:'network'}}` |
| `fetch.request` | `await window.__nativeFetch(args)`, as a result or a `network` error |
| `fetch.approve` | `true` |
| `voice.probe` | `{kind:'none', vendor:null, needsDownload:false, continuous:false, reason:'test'}` |
| `tts.voices` | `[]` |
| anything else | `true` |

`emit(ch, event, data)` runs `BywaysNative.onmessage({data: JSON.stringify({ch, event, data})})` in the page.

- [ ] **Step 2: Write the failing e2e spec**

`tests/e2e/android.spec.js`. `beforeEach`: `await mockNet(page)`; then `page.route('https://appassets.androidplatform.net/assets/www/**', …)` fulfils each request from `shells/android/app/src/main/assets/www/<path>` (`index.html` for the bare folder); then `fake = await installFakeAndroidBridge(page, opts)`; then `page.goto('https://appassets.androidplatform.net/assets/www/index.html')` and press **Skip** until the **Like** button shows. `afterEach` asserts `fake.unmatched` is empty. `ops = async () => (await fake.native()).map(m => \`${m.ch}.${m.op}\`)`.

```js
test('boots on the Android origin with native fetch and no service worker', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Like' })).toBeVisible();
  expect(await page.evaluate(() => navigator.serviceWorker.getRegistrations().then(r => r.length))).toBe(0);
  expect(await ops()).toContain('app.hello'); expect(await ops()).toContain('fetch.request');
});
test('Open shows the find in the site view', async ({ page }) => {
  await page.getByRole('button', { name: 'Open' }).click();
  const m = (await fake.native()).find(x => x.ch === 'app' && x.op === 'openSite');
  expect(m.args.url).toMatch(/^https?:\/\//);
});
test('site view Next loads the next find there', async ({ page }) => {
  await page.getByRole('button', { name: 'Open' }).click(); await fake.emit('app', 'siteNext', {});
  await expect.poll(async () => new Set((await fake.native()).filter(x => x.op === 'openSite').map(x => x.args.url)).size).toBe(2);
});
test('share-in of a link shows it as a find', async ({ page }) => {
  await fake.emit('app', 'shared', { text: 'Look https://example.org/a so good' });
  await expect(page.getByText('Shared to Byways')).toBeVisible(); await expect(page.getByText('example.org')).toBeVisible();
});
test('share-in of a Byways link opens Import', async ({ page }) => {
  const payload = await page.evaluate(async () => (await import('./core/share.js'))
    .encodeShare({ v: 1, t: 'f', n: 'One', i: [['library', 'https://example.org/', 'Example']] }));
  await fake.emit('app', 'shared', { text: `Try https://iteatsthesalt.github.io/Game-Dev-Resources/byways/#s=${payload}.` });
  await expect(page.getByRole('button', { name: 'Import' })).toBeVisible();
});
test('share-in with no link says so', async ({ page }) => {
  await fake.emit('app', 'shared', { text: 'hello there' });
  await expect(page.getByText('That share had no link in it.')).toBeVisible();
});
test('Back leaves a view first, then lets the app close', async ({ page }) => {
  await page.evaluate(() => { location.hash = '#/saved'; });
  await fake.emit('back', 'request', { token: 1 });
  await expect.poll(async () => (await fake.native()).find(m => m.ch === 'back' && m.args.token === 1)?.args.handled).toBe(true);
  await page.evaluate(() => { location.hash = '#/stumble'; });
  await fake.emit('back', 'request', { token: 2 });
  await expect.poll(async () => (await fake.native()).find(m => m.ch === 'back' && m.args.token === 2)?.args.handled).toBe(false);
});
test('Settings offers Go straight to the site and keeps it', async ({ page }) => {
  await page.evaluate(id => { location.hash = `#/settings/${id}`; }, DWELL_SECTION_ID);
  await page.getByLabel('Go straight to the site').check(); await page.reload();
  await page.evaluate(id => { location.hash = `#/settings/${id}`; }, DWELL_SECTION_ID);
  await expect(page.getByLabel('Go straight to the site')).toBeChecked();
});
test('About offers Download update', async ({ page }) => {
  // opts.update = { available: true, latest: '9.9.9', url: U } with
  // U = 'https://github.com/iteatsthesalt/Game-Dev-Resources/releases/download/byways-v9.9.9/byways-9.9.9.apk'
  await page.evaluate(() => { location.hash = '#/settings/about'; });
  await page.getByRole('button', { name: 'Check for updates' }).click();
  await expect(page.getByText('Version 9.9.9 is available.')).toBeVisible();
  await page.getByRole('button', { name: 'Download update' }).click();
  expect((await fake.native()).find(m => m.op === 'openExternal').args.url).toBe(U);
});
test('About says when the check fails', async ({ page }) => {   // opts.update = 'error'
  await page.evaluate(() => { location.hash = '#/settings/about'; });
  await page.getByRole('button', { name: 'Check for updates' }).click();
  await expect(page.getByText('Could not check for updates. Try again later.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download update' })).toHaveCount(0);
});
```

Also add one test that loads the PWA build at `localhost:4321` without the fake and expects `page.getByLabel('Go straight to the site')` to have count 0 on the same settings section. `DWELL_SECTION_ID` is the id that section registers.

- [ ] **Step 3: Run it to see it fail**

Run: `npm run build`, then `npx playwright test -c tests/e2e/playwright.config.js tests/e2e/android.spec.js`
Expected: FAIL. The share-in, Back, Settings, About and site-view `Next` tests time out waiting for `Shared to Byways`, `Import`, `That share had no link in it.`, the `back` result, the checkbox, **Check for updates** and the second `openSite`.

- [ ] **Step 4: Implement `attach(app)` in `src/platform/android.js`**

`attach` loads its UI imports with dynamic `import()`, so the Node tests of Tasks 6–7 stay DOM-free. It then:

- **Share-in:** handles `app` `shared {text}` with `extractSharedLink`.
  - `null` → `showToast('That share had no link in it.')`.
  - `share` → `win.location.hash = hash`; the router opens Import.
  - `url` → `navigate('stumble')`, then `showResult({find, branch: 'shared', why: ['Shared to Byways']})`. The find is `makeFind({url, title: domainOf(url), source: 'marginalia', kind: 'site', why: ['Shared to Byways'], safety: 'mixed'})`, so **More like this** uses Marginalia similar sites.
- **Back:** handles `back` `request {token}`. Dispatch `new CustomEvent('byways:back', {cancelable: true})` on `win`. If it was cancelled, `handled = true`. Otherwise, when the hash is not `''`, `'#'` or `'#/stumble'`, call `win.history.back()` and `handled = true`. Otherwise `handled = false`. Send `back.result {token, handled}`.
- **Site view:**
  - `openSite` sets `siteOpen = true`, and `app` `siteClosed` sets it false.
  - `app` `siteNext` runs `await app.engine.next({mode: app.getSettings().mode})`, then `showResult(result)`, then `openFind(result.find, 'inapp')` when there is a find.
  - `app.engine.on('find', find => …)` opens the find in the site view when `siteOpen`, or when `getSettings().goStraightToSite && app.handsFree?.state === 'active'`.
- **Hands-free start:** when `hello.micConsent && hello.sdk >= 33 && settings.firstRunDone && ['auto', 'always'].includes(settings.voice.mode)`, call `app.handsFree?.start()` with no touch.

- [ ] **Step 5: Wire boot, About and the setting**

- `src/ui/boot.js`: call `await platform.attach?.(app)` after the app object is complete, just before it is returned.
- `about.js`: when `app.platform.app` exists, show `Version <versionName>` and a **Check for updates** button.
  - On click, call `checkUpdate()`.
  - `available` → the text `Version <latest> is available.` and a **Download update** button that calls `app.platform.app.openExternal(url)`.
  - Not available → `You have the latest version (<versionName>).`
  - A rejection → `Could not check for updates. Try again later.`
  - Each status line also goes through `announce`.
- The dwell section: when `app.platform.caps.inAppSiteView`, add a checkbox labelled `Go straight to the site`, with the hint `In lean-back, show each find's real site instead of its card.` It is bound to `goStraightToSite` through `app.saveSettings({goStraightToSite})`.

- [ ] **Step 6: Run it to see it pass**

Run: `npm run build`, then `npx playwright test -c tests/e2e/playwright.config.js tests/e2e/android.spec.js`, then `npm test`
Expected: PASS (11 e2e tests), and all unit tests still pass.

- [ ] **Step 7: Commit**

```bash
git add src/platform/android.js src/ui/boot.js src/ui/views/settings tests/e2e/helpers/fakes.js tests/e2e/android.spec.js
git commit -m "Wire share-in, Back, the site view and updates into the Android app"
```

---

## Real-device checklist (Android)

Plan 09 copies this list into `CHECKLIST.md`. Fill it in by hand on a real phone before each release. These are the §20 items for Android that no test here can cover.

- [ ] **First CI build:** AGP 9.3.2, `androidx.webkit` 1.18.0 and Gradle 9.7.1 resolve. If not, note the 1.17.x fallback that was used.
- [ ] **Android voice, 13+:** after consent, launch starts listening with no touch. "next one", "go back" and "save it" work with the on-device recogniser, in a segmented session with no beeps. **Download offline voice** appears when the language is missing.
- [ ] **Android voice, 24–32:** tap to talk works, and Settings says why it is not always on.
- [ ] **No recogniser or no Google speech:** Settings says why, and keyboard, touch and headset buttons still work.
- [ ] **Read-aloud:** native voices are listed, network voices are marked "online", and Stop stops mid-sentence.
- [ ] **Headset and media keys:** next, previous and play/pause work through the native media session while lean-back runs, with the screen on and off.
- [ ] **Keep the screen on** during lean-back, and off again after Stop.
- [ ] **Fullscreen for Archive embeds:** Play, then the embed's full-screen button fills the screen, and Back leaves full screen first.
- [ ] **Site view:** **Back to Byways**, **Next** and **Open in browser** work. An `intent:` link opens outside. **Go straight to the site** follows lean-back.
- [ ] **Predictive back:** Back closes panels, then leaves views, then closes the app. The back preview animation shows.
- [ ] **Rotation and folding:** the current card stays, and speech does not restart.
- [ ] **The Lab on its own origin:** a DOS and a console file run, saves export through **BywaysLabNative**, and the Lab cannot see the app's keys. The fallback is serving it from the same origin, with the passphrase lock recommended.
- [ ] **OpenRouter PKCE in the Android WebView.** The fallback is pasting a key.
- [ ] **Local network models:** an Ollama on another computer (`OLLAMA_HOST=0.0.0.0`, `https://appassets.androidplatform.net` in `OLLAMA_ORIGINS`) asks for approval once, then lists models.
- [ ] **Share-in:** sharing a link from a browser and a Byways link from a chat app both work.
- [ ] **Update:** with an older APK installed, **Download update** opens the newer release APK. A signed build installs over the last signed build.

