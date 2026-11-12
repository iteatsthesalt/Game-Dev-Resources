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
    val ok = setOf("192.168.1.5.nip.io", "10.0.0.1", "2130706433", "0x7f000001", "::ffff:8.8.8.8", "172.32.0.1")
    for (u in listOf("http://192.168.1.5.nip.io/", "http://10.0.0.1@evil.com/", "http://2130706433/",
      "http://0x7f000001/", "http://[::ffff:8.8.8.8]/", "http://172.32.0.1/"))
      assertEquals(u, deny("not-local"), FetchPolicy.check(u, ok))
  }
  @Test fun refusesOtherSchemes() {
    for (u in listOf("ftp://10.0.0.1/", "file:///etc/hosts", "javascript:alert(1)", "intent://x#Intent;end"))
      assertEquals(u, deny("scheme"), FetchPolicy.check(u, setOf("10.0.0.1")))
  }
  @Test fun refusesBadUrls() {
    assertEquals(deny("bad-url"), FetchPolicy.check("not a url", none))
    assertEquals(deny("bad-url"), FetchPolicy.check("http://", none))
  }
  @Test fun capIsTenMegabytes() = assertEquals(10485760, FetchPolicy.MAX_BYTES)
}
```

- [ ] **Step 2: Run it to see it fail**

Run (where `ANDROID_HOME` is set; otherwise read the CI `android` job): `gradle -p shells/android testDebugUnitTest --tests '*FetchPolicyTest'`
Expected: FAIL to compile with `Unresolved reference 'FetchPolicy'`.

- [ ] **Step 3: Implement `FetchPolicy`**

- Parse with `java.net.URI`. A parse error or a missing host gives `bad-url`. Check the scheme first (lower-cased): `https` → `Allow`; anything but `http` → `scheme`.
- For `http`: not `isLocalHost(host)` → `not-local`; host not in `approved` → `not-approved`; else `Allow`. Approval is per host, for any port.
- `isLocalHost` never resolves DNS. It is true only for: `localhost`; an IPv4 literal of exactly four decimal parts, each 0–255, in `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12` or `192.168.0.0/16`; the IPv6 literal `::1`, or one whose first group is `fc00`–`fdff`; a name ending in `.local` with at least one label of `[a-z0-9-]` before it and not ending in a digit-only label.

- [ ] **Step 4: Run it to see it pass**

Run: the Step 2 command. Expected: PASS (8 tests).

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
class NativeFetch(private val approved: () -> Set<String>, private val connectTimeoutMs: Int = 15_000,
                  private val readTimeoutMs: Int = 90_000, private val maxBytes: Int = FetchPolicy.MAX_BYTES) {
  fun execute(req: FetchRequest, cancelled: () -> Boolean = { false }): FetchResponse
}
```

- [ ] **Step 1: Write the failing test**

The test starts `com.sun.net.httpserver.HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)` in `@Before`, with `base = "http://127.0.0.1:${server.address.port}"` and `nf = NativeFetch({ setOf("127.0.0.1") })`. Each test adds the context it needs. `code { … }` runs the block and returns the `FetchError.code` it throws.

```kotlin
@Test fun passesStatusHeadersAndBody() {   // /slow → 429, Retry-After: 3, body {"error":"slow"}
  val r = nf.execute(FetchRequest("$base/slow"))
  assertEquals(429, r.status); assertEquals("3", r.headers["retry-after"]); assertEquals("""{"error":"slow"}""", r.body)
}
@Test fun sendsNoCookiesAndKeepsOtherHeaders() {   // /echo records request headers
  nf.execute(FetchRequest("$base/echo", headers = mapOf("Cookie" to "a=1", "X-Api-Key" to "k")))
  assertNull(seen.getFirst("Cookie")); assertEquals("k", seen.getFirst("X-api-key"))
}
@Test fun sendsPostBody() {
  nf.execute(FetchRequest("$base/echo", "POST", mapOf("Content-Type" to "application/json"), """{"q":1}"""))
  assertEquals("""{"q":1}""", seenBody)
}
@Test fun capsResponseSize() {   // /big?n=… returns n bytes
  val small = NativeFetch({ setOf("127.0.0.1") }, maxBytes = 1024)
  assertEquals(1024, small.execute(FetchRequest("$base/big?n=1024")).body.length)
  assertEquals("too-large", code { small.execute(FetchRequest("$base/big?n=1025")) })
}
@Test fun followsSafeRedirects() {   // /a → 302 Location: /b; /b → 200 "ok"
  val r = nf.execute(FetchRequest("$base/a")); assertEquals("ok", r.body); assertTrue(r.url.endsWith("/b"))
}
@Test fun blocksRedirectToUnapprovedHost() {   // /out → http://192.168.77.77/x ; /pub → http://example.com/
  assertEquals("not-approved", code { nf.execute(FetchRequest("$base/out")) })
  assertEquals("not-local", code { nf.execute(FetchRequest("$base/pub")) })
}
@Test fun stopsAfterFiveRedirects() = assertEquals("redirects", code { nf.execute(FetchRequest("$base/loop")) })
@Test fun timesOut() {   // /sleep waits 1500 ms
  assertEquals("timeout", code { NativeFetch({ setOf("127.0.0.1") }, readTimeoutMs = 300).execute(FetchRequest("$base/sleep")) })
}
@Test fun checksPolicyBeforeConnecting() {
  assertEquals("not-approved", code { NativeFetch({ emptySet() }).execute(FetchRequest("$base/echo")) }); assertEquals(0, echoHits)
}
@Test fun honoursCancel() = assertEquals("aborted", code { nf.execute(FetchRequest("$base/echo")) { true } })
```

- [ ] **Step 2: Run it to see it fail**

Run: `gradle -p shells/android testDebugUnitTest --tests '*NativeFetchTest'` (or the CI job).
Expected: FAIL to compile with `Unresolved reference 'NativeFetch'`.

- [ ] **Step 3: Implement `NativeFetch.execute`**

- Check `cancelled()` and `FetchPolicy.check(url, approved())` before every hop. A `Deny` throws `FetchError(deny.code)`.
- `instanceFollowRedirects = false`, `useCaches = false`, the two timeouts. Copy request headers except `cookie`, `cookie2`, `host` and `content-length` (any case). Never install a `CookieHandler`.
- Redirects (301, 302, 303, 307, 308): resolve `Location` against the current URL and loop, at most 5 hops, then `redirects`. 303 always becomes GET without a body, and so do 301 and 302 after a POST. 307 and 308 keep the method and body.
- Read `errorStream` for status ≥ 400. Stop with `too-large` once more than `maxBytes` bytes arrive (or when `Content-Length` says so). Decode with the `charset` from `Content-Type`, else UTF-8.
- Header names are lower-cased, and repeated values are joined with `", "`. The null status-line key is skipped.
- `SocketTimeoutException` → `timeout`; other `IOException` → `network`. Never log a URL, header or body.

- [ ] **Step 4: Run it to see it pass**

Run: the Step 2 command. Expected: PASS (10 tests).

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
- Consumes: `NativeFetch`, `FetchRequest`, `FetchError` (Task 4); `FetchPolicy.isLocalHost` (Task 3); `MainActivity.webView`, `APP_URL` (Task 2).
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
  fun accepts(allowedOrigin: String, sourceOrigin: String, isMainFrame: Boolean): Boolean
}
// Bridge.kt
fun interface ChannelHandler { fun handle(req: BridgeCodec.Request, reply: Reply) }
class Reply(private val id: String, private val post: (String) -> Unit) { fun ok(result: Any?); fun error(code: String, message: String = code) }
class Bridge(private val webView: WebView, private val handlers: Map<String, ChannelHandler>) {
  fun install(): Boolean                             // false when WEB_MESSAGE_LISTENER is missing
  fun emit(ch: String, event: String, data: Any?)
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
  }
}
```

Add to `tests/unit/android-shell.test.js`:

```js
test('bridge and fetch code never log', () => {
  for (const f of ['Bridge.kt', 'NativeFetch.kt', 'FetchPolicy.kt'])
    assert.doesNotMatch(R(`${S}/app/src/main/kotlin/io/github/iteatsthesalt/byways/${f}`), /\bLog\.[vdiwe]\(|println\(/, f);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/unit/android-shell.test.js` and `gradle -p shells/android testDebugUnitTest --tests '*BridgeCodecTest'` (or the CI job).
Expected: the Node test fails with `ENOENT` on `Bridge.kt`; Gradle fails with `Unresolved reference 'BridgeCodec'`.

- [ ] **Step 3: Implement `BridgeCodec` and `BridgeGate`**

`decode` checks the length first, then parses with `JSONObject`. `id` must be a non-empty string of at most 64 characters, and `op` a non-empty string. `ok` and `event` write `JSONObject.NULL` for `null`. `accepts` is true only when `isMainFrame` and `sourceOrigin == allowedOrigin` exactly.

- [ ] **Step 4: Implement `Bridge`, `Reply` and the core channels**

- `install()`: if `!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)` return false. Otherwise `WebViewCompat.addWebMessageListener(webView, "BywaysNative", setOf(BridgeGate.APP_ORIGIN)) { _, message, sourceOrigin, isMainFrame, proxy -> … }`. Drop the message unless `BridgeGate.accepts(APP_ORIGIN, sourceOrigin.toString(), isMainFrame)`. Keep the latest `proxy` for `emit`. Decode; on `BadMessage` reply with its code when an id can be read, else drop. Route by `ch`. A handler that throws replies `internal`. An unknown op replies `unknown-op`.
- `Reply` sends once (later calls do nothing) and always posts to `proxy.postMessage` on the main thread (`webView.post`). `emit` before the first `hello` queues events and flushes them on `hello`.
- `app` handler: `hello` → `{versionName, versionCode, sdk: Build.VERSION.SDK_INT, micConsent}` (`micConsent` is the `micConsent` boolean in SharedPreferences `byways`, default false); `openExternal {url}` → `ACTION_VIEW` with `CATEGORY_BROWSABLE` for `http(s)` only, else error `scheme`.
- `fetch` handler (a `FetchChannel` class in `Bridge.kt`): `request` runs `NativeFetch.execute` on a 4-thread executor, with `cancelled` reading a per-request flag; `abort {fetchId}` sets the flag of that request id; `approve {host}` replies true when the host is already in the `approvedHosts` string set, false when `!FetchPolicy.isLocalHost(host)`, else shows an `AlertDialog` titled `Allow a local network device?` with the message `Byways wants to reach http://<host> on your network, for a local AI model. Allow it?` and the buttons **Allow** (store and reply true) and **Cancel** (reply false). `FetchError` replies with its code.
- `screen` handler: `keepOn {on}` adds or clears `WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON`.
- In `MainActivity.onCreate`, build the `Bridge` before `loadUrl`. If `install()` is false, load nothing and show a `TextView` saying `This phone's WebView is too old for Byways. Update Android System WebView, then open Byways again.`

- [ ] **Step 5: Run them to see them pass**

Run: the Step 2 commands. Expected: PASS (Node: 8 tests; Gradle: 5 tests).

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
  // → Platform plus app: {version() → Promise<{versionName, versionCode, sdk, micConsent}>,
  //    checkUpdate() → Promise<{available:boolean, latest:string|null, url:string|null}>, openExternal(url) → Promise<void>}
  //    and attach(app) → Promise<void> (Task 13)
export function extractSharedLink(text) // → {kind:'share', hash:string} | {kind:'url', url:string} | null
export function labSaveFile(name, blob, win = globalThis) // → Promise<'saved'|'cancelled'> | null
```

- [ ] **Step 1: Write the failing tests**

`tests/unit/platform-android.test.js` uses a fake port:

```js
function fakePort() {
  const port = { sent: [], onmessage: null, postMessage(s) { port.sent.push(JSON.parse(s)); },
    last() { return port.sent.at(-1); },
    reply(id, result) { port.onmessage({ data: JSON.stringify({ id, ok: true, result }) }); },
    fail(id, code) { port.onmessage({ data: JSON.stringify({ id, ok: false, error: { code, message: code } }) }); },
    emit(ch, event, data = {}) { port.onmessage({ data: JSON.stringify({ ch, event, data }) }); } };
  return port;
}
const win = { location: new URL('https://appassets.androidplatform.net/assets/www/index.html'),
  fetch: async () => new Response('{"v":1}') };
const tick = () => new Promise(r => setTimeout(r, 0));
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
    labHref: 'https://lab.appassets.androidplatform.net/assets/lab/index.html', framesArchive: true });
});
test('API calls go through nativeFetch', async () => {
  const port = fakePort(); const p = createAndroidPlatform({ bridge: port, base: fakeBase(), win });
  const r = p.transport.fetch('https://api.mistral.ai/v1/models', { headers: { Authorization: 'Bearer k' }, privileged: true });
  await tick();
  assert.deepEqual(port.last().args, { url: 'https://api.mistral.ai/v1/models', method: 'GET', headers: { authorization: 'Bearer k' }, body: null });
  port.reply(port.last().id, { status: 200, statusText: 'OK', headers: { 'content-type': 'application/json' }, body: '{"data":[]}', url: 'https://api.mistral.ai/v1/models' });
  const res = await r; assert.equal(res.status, 200); assert.deepEqual(await res.json(), { data: [] });
});
test('same-origin paths use the page fetch', async () => {
  const port = fakePort(); const calls = [];
  const w = { ...win, fetch: async u => { calls.push(u); return new Response('{"v":1}'); } };
  await createAndroidPlatform({ bridge: port, base: fakeBase(), win: w }).transport.fetch('data/tags.json');
  assert.deepEqual(calls, ['data/tags.json']); assert.equal(port.sent.filter(m => m.ch === 'fetch').length, 0);
});
test('transport passes 429 and 204 through, maps failures and aborts', async () => {
  // 429 {retry-after:'3'} → res.status 429, res.headers.get('retry-after') === '3'
  // 204 → res.status 204, res.body === null
  // port.fail(id, 'network') → rejects TypeError with e.code === 'network'
  // AbortController: ctl.abort() after the request is sent → rejects e.name === 'AbortError',
  //   and port.sent contains { ch: 'fetch', op: 'abort', args: { fetchId: <that request id> } }
  // a pre-aborted signal → rejects AbortError and sends no fetch message
  // body: new Blob(['x']) → rejects TypeError, message 'nativeFetch supports string bodies only'
});
test('http to a LAN host asks for approval first', async () => {
  // fetch('http://192.168.1.20:11434/api/tags'): first message { ch:'fetch', op:'approve', args:{ host:'192.168.1.20' } };
  // reply true → next message is fetch.request; reply false → rejects TypeError 'Local network host not approved: 192.168.1.20'
});
test('share, open, files and screen go over the bridge', async () => {
  // share({title:'Ada', url:'https://example.org'}) → args {title:'Ada', text:null, url:'https://example.org'}; reply 'shared' → 'shared'
  // openFind({url:'https://example.org', title:'Ex'}) → {ch:'app', op:'openSite', args:{url:'https://example.org', title:'Ex'}}
  // openFind(find, 'tab') → {ch:'app', op:'openExternal', args:{url:'https://example.org'}}
  // files.save('b.json', new Blob(['{"a":1}'], {type:'application/json'})) → args {name:'b.json', mime:'application/json', base64:'eyJhIjoxfQ=='}
  // wakeLock.on() → {ch:'screen', op:'keepOn', args:{on:true}}; wakeLock.off() → {on:false}
  // checkUpdate() → {ch:'app', op:'checkUpdate', args:{}}; version() resolves to the hello reply
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
test('labSaveFile uses BywaysLabNative only when present', async () => {
  assert.equal(labSaveFile('s.sav', new Blob(['x']), {}), null);
  const port = fakePort(); const p = labSaveFile('s.sav', new Blob(['x']), { BywaysLabNative: port });
  await tick(); assert.deepEqual(port.last(), { id: '1', ch: 'files', op: 'save', args: { name: 's.sav', mime: 'application/octet-stream', base64: 'eA==' } });
  port.reply('1', 'saved'); assert.equal(await p, 'saved');
});
```

Write each commented test as `assert` calls with exactly those values. `fakeBase()` returns `{ secrets: {}, files: { pick: async () => [] }, persistStorage: async () => true }`.

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/unit/platform-android.test.js`
Expected: FAIL with `Cannot find module '…/src/platform/android.js'`.

- [ ] **Step 3: Implement `src/platform/android.js` (bridge client, transport, share, files, links)**

- Client: ids are a counter from `"1"`. `port.onmessage = e => …` parses `e.data`, ignores anything that does not parse or has an unknown id, resolves `{id, ok:true}`, rejects `{id, ok:false}` with `Object.assign(new Error(error.message), { code: error.code })`, and fans `{ch, event, data}` out to listeners.
- `transport.fetch(url, init = {})`: resolve `url` against `win.location.href`; same origin → `win.fetch(url, init)` with `privileged` removed. Otherwise headers become a plain object with lower-case names (through `Headers`), `method` is upper-cased (default `GET`), `body` is a string or `null`. An `http:` URL first awaits `fetch.approve {host}`. Statuses 204, 205 and 304 build `new Response(null, …)`. A native error code `aborted`, or the signal firing, gives `new DOMException('The operation was aborted.', 'AbortError')`; the signal firing also sends `fetch.abort {fetchId}`. Any other native error gives `Object.assign(new TypeError(\`Network request failed (${code})\`), { code })`.
- `share`, `openFind(find, how = 'inapp')`, `files.save` (base64 of `blob.arrayBuffer()`, mime `blob.type || 'application/octet-stream'`), `wakeLock`, `app` as in the bridge table. `files.pick`, `secrets` and `persistStorage` come from `base`.
- `extractSharedLink`: take every `https?://` run up to whitespace, `<`, `>` or a quote. Trim trailing `.,;:!?'"]}` and a trailing `)` when the run has no `(`. A run whose `origin + pathname` is `https://iteatsthesalt.github.io/Game-Dev-Resources/byways/` and whose hash starts with `#s=` wins, as `{kind:'share', hash}`. Otherwise the first run is `{kind:'url', url}`.
- `labSaveFile`: `null` when `win.BywaysLabNative` is missing; otherwise one cached `createBridgeClient(win.BywaysLabNative, { hello: false })` and `call('files', 'save', …)`.

- [ ] **Step 4: Run them to see them pass**

Run: `node --test tests/unit/platform-android.test.js`
Expected: PASS (11 tests).

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
  p.tts.cancel(); assert.deepEqual(port.last(), { id: String(Number(port.last().id)), ch: 'tts', op: 'cancel', args: {} });
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

`voice.stop`, `tts.cancel` and `media.setActive` send and swallow rejections. `speak` sends `voiceURI ?? null`, `rate ?? 1` and `volume ?? 1` and resolves `undefined` on the reply. `media.setHandlers` replaces the stored handlers; events call `next`, `previous` or `playPause` when set.

- [ ] **Step 4: Run them to see them pass**

Run: `node --test tests/unit/platform-android.test.js`
Expected: PASS (14 tests).

- [ ] **Step 5: Commit**

```bash
git add src/platform/android.js tests/unit/platform-android.test.js
git commit -m "Add native voice, speech and media to the Android platform"
```

<!-- PLAN CONTINUES -->
