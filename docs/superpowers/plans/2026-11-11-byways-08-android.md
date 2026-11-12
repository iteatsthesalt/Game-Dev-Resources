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
- Signing: the release APK is signed when `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS` and `KEY_PASSWORD` exist.
- This machine has no Android SDK and blocks Google Maven downloads. Kotlin steps are verified by the `android` job in `.github/workflows/byways.yml`. Run Gradle locally only when `ANDROID_HOME` is set.

## Review Focus

1. **Hosts that only look local.** `http://192.168.1.5.nip.io`, `http://10.0.0.1@evil.com`, `http://2130706433`, `http://0x7f000001`, `http://[::ffff:8.8.8.8]` and a redirect from an approved LAN host to an unapproved one must all be refused, with no DNS lookup. Pinned by `deniesLookalikeHosts` (Task 3) and `blocksRedirectToUnapprovedHost` (Task 4).
2. **Frames and origins at the bridge.** An Archive embed iframe, a page on another origin, the Lab origin, or a sub-frame of the app must never reach `BywaysNative`. Pinned by `gateRejectsOtherOriginsAndSubframes` (Task 5).
3. **HTTP replies that are not plain 200s.** A 429 with `Retry-After`, a 204, a native network failure and an aborted request must reach `net/http.js` as a real `Response` or the same errors browser `fetch` gives, so the contract's retry logic still works. Pinned by `transport passes 429 and 204 through, maps failures and aborts` (Task 6).
4. **Messy shared text.** Text shared from chat apps carries extra words, trailing punctuation, several links, or no link. Byways share links must import, other links must become a find, and text with no link must show a message instead of crashing. Pinned by `extractSharedLink handles real share text` (Task 6) and `share-in with no link says so` (Task 13).
5. **Rotation and resizing.** Turning the phone or folding it must not reload the WebView and lose the current card or speech mid-sentence. Pinned by `activity keeps the WebView on rotation` (Task 2).

---

## File Structure

All paths are under `Apps/Byways/` unless they start with `.github/`.

**Web side**

| File | Responsibility |
|---|---|
| `tools/build.js` (modify) | `--target android`: copy the web build into `shells/android/app/src/main/assets/www/`, the Lab and vendor into `…/assets/lab/`, and write the Android entry |
| `src/platform/android.js` (create) | `createBridgeClient`, `createAndroidPlatform`, `extractSharedLink`, `labSaveFile` |
| `src/ui/boot.js` (modify) | call `platform.attach?.(app)` once the app is built |
| `src/ui/views/settings/about.js` (modify) | **Check for updates** and **Download update** when `platform.app` exists |
| the Plan 03 settings section that renders the dwell-time control (modify) | the **Go straight to the site** toggle when `platform.caps.inAppSiteView` is true |
| `src/lab/storage-panel.js` (modify) | save through `labSaveFile` when it returns a promise |
| `tests/unit/build-android.test.js`, `tests/unit/android-shell.test.js`, `tests/unit/platform-android.test.js` (create) | Node tests |
| `tests/e2e/helpers/fakes.js` (modify), `tests/e2e/android.spec.js` (create) | fake `BywaysNative` and the Android e2e spec |
| `.github/workflows/byways.yml` (modify) | the `android` job |

**Android project** (`shells/android/`)

| File | Responsibility |
|---|---|
| `settings.gradle.kts`, `build.gradle.kts`, `gradle.properties`, `app/build.gradle.kts` | build setup, versions, signing |
| `app/src/main/AndroidManifest.xml`, `app/src/main/res/xml/network_security_config.xml`, `app/src/main/res/values/strings.xml`, `app/src/main/res/values/themes.xml`, `app/src/main/res/drawable/ic_launcher.xml` | manifest and resources |
| `…/byways/MainActivity.kt` | WebView setup, asset loaders, system behaviour, consent, share-in, lifecycle |
| `…/byways/SiteView.kt` | the second WebView and its toolbar |
| `…/byways/Bridge.kt` | `Bridge` (main listener and channel routing) and `LabBridge` |
| `…/byways/BridgeCodec.kt` | pure: `BridgeCodec`, `BridgeGate` |
| `…/byways/FetchPolicy.kt` | pure: URL policy |
| `…/byways/NativeFetch.kt` | pure JVM: HTTP executor over `HttpURLConnection` |
| `…/byways/LinkPolicy.kt` | pure: what each WebView does with a URL |
| `…/byways/SpeechErrors.kt` | pure: native error code → `VoiceErrorCode` |
| `…/byways/SpeechBridge.kt`, `TtsBridge.kt`, `MediaBridge.kt`, `ShareBridge.kt`, `FilesBridge.kt` | native channel handlers |
| `…/byways/UpdateCheck.kt` | pure: release parsing and version compare |
| `app/src/test/kotlin/io/github/iteatsthesalt/byways/*Test.kt` | JVM tests |

`…/byways/` means `shells/android/app/src/main/kotlin/io/github/iteatsthesalt/byways/`.

## Bridge protocol

Web → native request: `{"id":"<string>","ch":"<channel>","op":"<op>","args":{…}}`. Native reply: `{"id","ok":true,"result":…}` or `{"id","ok":false,"error":{"code","message"}}`. Native → web event: `{"ch","event","data"}`. Ids are decimal strings from a counter that starts at `"1"`.

| Channel | Ops (args → result) | Events (data) |
|---|---|---|
| `app` | `hello` {} → `{versionName, versionCode, sdk, micConsent}`; `checkUpdate` {} → `{available, latest, url}`; `openExternal` {url} → `true`; `openSite` {url, title} → `true`; `closeSite` {} → `true` | `shared` {text}; `siteNext` {} |
| `fetch` | `request` {url, method, headers, body} → `{status, statusText, headers, body, url}`; `abort` {fetchId} → `true`; `approve` {host} → `boolean` | — |
| `voice` | `probe` {allowCloud} → `VoiceStatus`; `install` {} → `boolean`; `start` {lang, phrases, allowCloud} → `true`; `stop` {} → `true` | `result` {text, final}; `state` {listening}; `error` {code} |
| `tts` | `speak` {text, voiceURI, rate, volume} → `true` at the end of the utterance; `cancel` {} → `true`; `voices` {} → `[{uri, name, lang, local}]` | — |
| `media` | `setActive` {on} → `true` | `next`, `previous`, `playPause` (data `{}`) |
| `share` | `send` {title, text, url} → `'shared'` | — |
| `files` | `save` {name, mime, base64} → `'saved'\|'cancelled'` | — |
| `back` | `result` {token, handled} → `true` | `request` {token} |
| `screen` | `keepOn` {on} → `true` | — |

Error codes: `bad-message`, `unknown-channel`, `unknown-op`, `too-large`, `internal`, the `FetchPolicy` and `NativeFetch` codes (Tasks 3–4), and the `VoiceErrorCode` names.

### Task 1: Android build target

**Files:**
- Modify: `tools/build.js`
- Test: `tests/unit/build-android.test.js`

**Interfaces:**
- Consumes: `node tools/build.js --target android|all` and `build.json = {"id": <GITHUB_SHA or "dev">, "builtAt": ISO}` (overview, Plan 01); the PWA entry script that `shells/pwa/index.html` loads, which builds a PWA platform and calls `boot(platform)` (Plan 01).
- Produces: `assets/www/` (the web app, no service worker), `assets/www/android-boot.js`, and `assets/lab/` (a self-contained Lab), all under `shells/android/app/src/main/`. `android-boot.js` imports `createAndroidPlatform` from `./platform/android.js` (Task 6).

- [ ] **Step 1: Write the failing test**

`tests/unit/build-android.test.js` runs `execFileSync('node', ['tools/build.js', '--target', 'android'])` once in `before`, then:

```js
const A = 'shells/android/app/src/main/assets';
test('www holds the app without the service worker', () => {
  const html = readFileSync(`${A}/www/index.html`, 'utf8');
  assert.match(html, /<script type="module" src="\.\/android-boot\.js"><\/script>/);
  assert.doesNotMatch(html, /sw\.js/);
  assert.equal(existsSync(`${A}/www/sw.js`), false);
  assert.equal(existsSync(`${A}/www/manifest.webmanifest`), false);
  assert.equal(existsSync(`${A}/www/lab`), false);
  assert.equal(existsSync(`${A}/www/vendor`), false);
  assert.match(readFileSync(`${A}/www/android-boot.js`, 'utf8'), /createAndroidPlatform/);
  assert.match(readFileSync(`${A}/www/android-boot.js`, 'utf8'), /BywaysNative/);
});
test('both outputs carry build.json', () => {
  for (const d of ['www', 'lab']) {
    const b = JSON.parse(readFileSync(`${A}/${d}/build.json`, 'utf8'));
    assert.equal(b.id, process.env.GITHUB_SHA ?? 'dev');
  }
});
test('lab is self-contained', () => {
  assert.ok(existsSync(`${A}/lab/index.html`));
  assert.equal(existsSync(`${A}/lab/vendor`), existsSync('dist/pwa/vendor'));
  for (const f of readdirSync(`${A}/lab`).filter(n => /\.(html|js)$/.test(n)))
    assert.doesNotMatch(readFileSync(`${A}/lab/${f}`, 'utf8'), /["']\.\.\//, f);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test tests/unit/build-android.test.js`
Expected: FAIL on the `android-boot.js` match (or on `ENOENT` for `assets/www/index.html`).

- [ ] **Step 3: Implement the android target in `tools/build.js`**

- Build the PWA output first (the same function `--target pwa` uses), then empty and refill `assets/www/` and `assets/lab/`.
- `assets/www/`: copy `dist/pwa/**` except `sw.js`, `manifest.webmanifest`, `lab/` and `vendor/`. In `index.html`, replace the module entry tag with `<script type="module" src="./android-boot.js"></script>` and drop any service-worker registration markup.
- `assets/www/android-boot.js`: generate it from the PWA entry. It builds the PWA platform exactly as the PWA entry does (call it `base`), skips service-worker registration, then runs `const bridge = globalThis.BywaysNative; boot(bridge ? createAndroidPlatform({ bridge, base }) : base);`.
- `assets/lab/`: copy `dist/pwa/lab/**` to `assets/lab/`, rewriting the leading `../` of every relative `import`, `import()`, `src` and `href` in those files to `./`. Copy `dist/pwa/vendor/**` to `assets/lab/vendor/`. Copy every other file the Lab files reference statically (follow references recursively) to `assets/lab/<its path relative to dist/pwa>`.
- Write `build.json` into both folders. `--target all` includes android, so `--check` checks these outputs too.

- [ ] **Step 4: Run it to see it pass**

Run: `node --test tests/unit/build-android.test.js`, then `npm run check`
Expected: PASS, and the check reports no unresolved references.

- [ ] **Step 5: Commit**

```bash
git add tools/build.js tests/unit/build-android.test.js
git commit -m "Add the Android build target"
```

### Task 2: Gradle project, manifest and the CI job

**Files:**
- Create: `shells/android/settings.gradle.kts`, `shells/android/build.gradle.kts`, `shells/android/gradle.properties`, `shells/android/app/build.gradle.kts`
- Create: `shells/android/app/src/main/AndroidManifest.xml`, `…/res/xml/network_security_config.xml`, `…/res/values/strings.xml`, `…/res/values/themes.xml`, `…/res/drawable/ic_launcher.xml`
- Create: `…/byways/MainActivity.kt`
- Modify: `.gitignore`, `.github/workflows/byways.yml`
- Test: `tests/unit/android-shell.test.js`

**Interfaces:**
- Consumes: the Task 1 assets.
- Produces: `MainActivity` with `companion object { const val APP_HOST = "appassets.androidplatform.net"; const val APP_URL = "https://appassets.androidplatform.net/assets/www/index.html" }` and a `lateinit var webView: WebView`. Gradle reads `BYWAYS_VERSION` (default `"0.1.0"`) for `versionName` and `BYWAYS_VERSION_CODE` (default `1`) for `versionCode`; Plan 09 sets them.

- [ ] **Step 1: Write the failing test**

`tests/unit/android-shell.test.js` reads the files as text (`const R = p => readFileSync(p, 'utf8')`, with `S = 'shells/android'`):

```js
test('gradle versions match the spec', () => {
  const app = R(`${S}/app/build.gradle.kts`);
  for (const s of ['namespace = "io.github.iteatsthesalt.byways"', 'applicationId = "io.github.iteatsthesalt.byways"',
    'compileSdk = 37', 'targetSdk = 36', 'minSdk = 24', '"androidx.webkit:webkit:1.18.0"',
    '"androidx.activity:activity-ktx:1.11.0"', 'JavaVersion.VERSION_21', '"junit:junit:4.13.2"', '"org.json:json:20240303"'])
    assert.ok(app.includes(s), s);
  assert.doesNotMatch(app + R(`${S}/build.gradle.kts`), /kotlin-android|org\.jetbrains\.kotlin\.android/);
  assert.ok(R(`${S}/build.gradle.kts`).includes('id("com.android.application") version "9.3.2" apply false'));
});
test('release signing reads only the four env vars', () => {
  const app = R(`${S}/app/build.gradle.kts`);
  for (const v of ['KEYSTORE_BASE64', 'KEYSTORE_PASSWORD', 'KEY_ALIAS', 'KEY_PASSWORD']) assert.ok(app.includes(`"${v}"`), v);
});
test('manifest declares permissions, queries and share-in', () => {
  const m = R(`${S}/app/src/main/AndroidManifest.xml`);
  for (const s of ['android.permission.INTERNET', 'android.permission.RECORD_AUDIO', 'android.speech.RecognitionService',
    'android.intent.action.TTS_SERVICE', 'android.intent.action.SEND', 'android:mimeType="text/plain"',
    'android:networkSecurityConfig="@xml/network_security_config"', 'android:launchMode="singleTask"'])
    assert.ok(m.includes(s), s);
});
test('activity keeps the WebView on rotation', () => {
  assert.ok(R(`${S}/app/src/main/AndroidManifest.xml`)
    .includes('android:configChanges="orientation|screenSize|screenLayout|smallestScreenSize|keyboardHidden"'));
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
- `gradle.properties`: `android.useAndroidX=true`, `android.nonTransitiveRClass=true`, `org.gradle.jvmargs=-Xmx3g -Dfile.encoding=UTF-8`.
- `app/build.gradle.kts`: `plugins { id("com.android.application") }`; `android { namespace, compileSdk = 37, defaultConfig { applicationId, minSdk = 24, targetSdk = 36, versionCode, versionName }, compileOptions { sourceCompatibility = JavaVersion.VERSION_21; targetCompatibility = JavaVersion.VERSION_21 }, testOptions { unitTests.isReturnDefaultValues = true } }`. Built-in Kotlin takes its JVM target from `compileOptions`; if CI reports a JVM target mismatch, add `kotlin { jvmToolchain(21) }`. Dependencies: `implementation("androidx.webkit:webkit:1.18.0")`, `implementation("androidx.activity:activity-ktx:1.11.0")`, `testImplementation("junit:junit:4.13.2")`, `testImplementation("org.json:json:20240303")` (android.jar's `org.json` is a stub that throws in JVM tests). If `webkit:1.18.0` does not resolve in CI, use the newest 1.17.x. Bump `activity-ktx` to the newest stable only after a green CI build.
- Release signing, only when all four variables are set:

```kotlin
val ks = listOf("KEYSTORE_BASE64", "KEYSTORE_PASSWORD", "KEY_ALIAS", "KEY_PASSWORD").associateWith { System.getenv(it) }
if (ks.values.all { !it.isNullOrEmpty() }) {
  val file = layout.buildDirectory.file("keystore/release.jks").get().asFile
  file.parentFile.mkdirs(); file.writeBytes(java.util.Base64.getDecoder().decode(ks["KEYSTORE_BASE64"]!!.trim()))
  android.signingConfigs.create("release") { storeFile = file; storePassword = ks["KEYSTORE_PASSWORD"]; keyAlias = ks["KEY_ALIAS"]; keyPassword = ks["KEY_PASSWORD"] }
  android.buildTypes.getByName("release").signingConfig = android.signingConfigs.getByName("release")
}
```

- [ ] **Step 4: Write the manifest and resources**

- Manifest: `<uses-permission>` for `INTERNET` and `RECORD_AUDIO`; `<queries>` with one `<intent>` for action `android.speech.RecognitionService` and one for `android.intent.action.TTS_SERVICE`; `<application android:label="@string/app_name" android:icon="@drawable/ic_launcher" android:theme="@style/Theme.Byways" android:networkSecurityConfig="@xml/network_security_config" android:allowBackup="false">`; one `<activity android:name=".MainActivity" android:exported="true" android:launchMode="singleTask" android:configChanges="orientation|screenSize|screenLayout|smallestScreenSize|keyboardHidden">` with a `MAIN`/`LAUNCHER` filter and a `SEND` filter (`DEFAULT` category, `android:mimeType="text/plain"`).
- `network_security_config.xml`: `<network-security-config><base-config cleartextTrafficPermitted="true" /></network-security-config>`.
- `strings.xml`: `app_name` = `Byways`. `themes.xml`: `Theme.Byways` with parent `android:Theme.DeviceDefault.NoActionBar`. `ic_launcher.xml`: a 108 dp vector, a single path on a solid background.

- [ ] **Step 5: Write the first `MainActivity`**

`class MainActivity : ComponentActivity()`. `onCreate` builds a `FrameLayout` root holding `webView`, and:
- `WebViewAssetLoader.Builder().setDomain(APP_HOST).addPathHandler("/assets/", AssetsPathHandler(this)).build()`, called from `WebViewClient.shouldInterceptRequest(view, request)`.
- `webView.settings`: `javaScriptEnabled = true`, `domStorageEnabled = true`, `mediaPlaybackRequiresUserGesture = false`, `allowFileAccess = false`, `allowContentAccess = false`, `mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW`, `setSupportMultipleWindows(false)`.
- `CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)`.
- `WebChromeClient.onPermissionRequest(request)` calls `request.deny()` for every request.
- `WebView.setWebContentsDebuggingEnabled(true)` only when `applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0`.
- `webView.loadUrl(APP_URL)` when `savedInstanceState == null`.

- [ ] **Step 6: Add the CI job and ignores**

`.gitignore` gains `shells/android/app/src/main/assets/`, `shells/android/.gradle/`, `shells/android/build/`, `shells/android/app/build/` and `shells/android/local.properties`. Add this job to `.github/workflows/byways.yml`:

```yaml
  android:
    runs-on: ubuntu-24.04
    defaults: { run: { working-directory: Apps/Byways } }
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm, cache-dependency-path: Apps/Byways/package-lock.json }
      - run: npm ci
      - run: npm run vendor
      - run: node tools/build.js --target android
      - uses: actions/setup-java@v6
        with: { distribution: temurin, java-version: '21' }
      - uses: gradle/actions/setup-gradle@v6
        with:
          cache-provider: basic
          gradle-version: 9.7.1
      - run: gradle -p shells/android assembleDebug testDebugUnitTest
      - uses: actions/upload-artifact@v7
        with: { name: byways-debug-apk, path: Apps/Byways/shells/android/app/build/outputs/apk/debug/app-debug.apk }
      - if: failure()
        uses: actions/upload-artifact@v7
        with: { name: android-test-reports, path: Apps/Byways/shells/android/app/build/reports/tests/ }
```

- [ ] **Step 7: Run the tests**

Run: `node --test tests/unit/android-shell.test.js`
Expected: PASS (7 tests).

- [ ] **Step 8: Commit, then check CI**

```bash
git add shells/android .gitignore ../../.github/workflows/byways.yml tests/unit/android-shell.test.js
git commit -m "Add the Android project and its CI job"
```

After the branch is pushed, `gh run watch --exit-status` on the `byways.yml` run. Expected: the `android` job passes and uploads `byways-debug-apk`. If AGP 9.3.2 or webkit 1.18.0 does not resolve, apply the fallbacks above and commit `Use the fallback androidx.webkit version`.

<!-- PLAN CONTINUES -->
