# Byways 07: Browser Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Byways as an MV3 extension for Chrome/Edge and Firefox. The toolbar Stumble loads a find in your real tab, a side panel (Chrome) or sidebar (Firefox) shows its card, and a full Byways tab runs the whole app.

**Architecture:** One manifest template plus two overlays are merged by `tools/build.js` into `dist/chrome/` and `dist/firefox/`, next to copies of `src/core`, `src/ui`, `src/platform`, `src/data` and `src/assets`. `bg.js` is a thin module that wires browser events to handlers made by `createBackground(deps)`, which drives the shared core engine with an IndexedDB store. `panel.html` and `app.html` both load `panel.js`, which boots the shared UI with `createExtensionPlatform(...)` for its surface.

**Tech Stack:** JavaScript ES2022 modules, WebExtensions MV3 (`globalThis.browser ?? globalThis.chrome`), `node:test`, `@playwright/test@1.63.0` with a Chromium persistent context, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-11-byways-design.md` (§13.3, §4 extension column, §6.2 extension row, §6.3 extension shortcuts, §15.1). Shared contract: `docs/superpowers/plans/2026-11-11-byways-00-overview.md`.

## Global Constraints

- Every item in the overview's "Global constraints (every plan)" and "Working conventions" applies. Commands run in `Apps/Byways/`.
- Extension CSP, exact: `"script-src 'self' 'wasm-unsafe-eval'; object-src 'self';"` in `content_security_policy.extension_pages`.
- Chrome/Edge: `action`, with **no** `openPanelOnActionClick`; `side_panel.default_path: panel.html`; `background: { service_worker: 'bg.js', scripts: ['bg.js'], type: 'module' }`; 4 commands (§6.3).
- Permissions: `storage`, `unlimitedStorage`, `sidePanel`, `contextMenus` and `activeTab`; optional: `tts`, and `identity` (for Connect OpenRouter).
- `host_permissions`: `https://archive.org/*` and `https://*.archive.org/*`; the provider API hosts; the open and probe source hosts; `raw.githubusercontent.com`, `itch.io` and the Pages URL.
- `optional_host_permissions`: `https://*/*`, `http://localhost/*`, `http://127.0.0.1/*` and `http://*/*`, each asked for from a button.
- Firefox overlay: drops `side_panel` and `sidePanel`, adds `sidebar_action.default_panel: panel.html` and `_execute_sidebar_action`; `browser_specific_settings.gecko`: `id: byways@iteatsthesalt`, `strict_min_version: 140.0`; `data_collection_permissions`: `required: ['none']`, `optional: ['searchTerms', 'browsingActivity']`.
- At startup, Byways checks `permissions.contains` and offers **Grant access** if anything was revoked.
- Namespace: `const ext = globalThis.browser ?? globalThis.chrome`. No polyfill.
- Suggested shortcuts: Alt+Shift+S to Stumble, Alt+Shift+B to open the panel, Alt+Shift+V to toggle listening, Alt+Shift+M for "More like this page".
- Toolbar click: the background picks the next find through the core, `tabs.update(tab.id, {url})` loads it, and the find is stored in `storage.session` by tab id.
- Byways tab (`app.html`): the full app UI. Lean-back runs here, and **Open** uses a new tab.
- Voice: the same web engines, only in the side panel, sidebar or Byways tab, after a one-time mic grant on `permission.html`. Never listens while the panel or tab is closed.
- Keys live in `chrome.storage.local`, never in IndexedDB, in the extension.
- **Lab:** the button opens the hosted web Lab, `https://iteatsthesalt.github.io/Game-Dev-Resources/byways/lab/`. The build never copies `src/lab` or `vendor/`.
- **No content scripts in v1.**
- Network (§15.1): only the enabled sources and the site you open, AI only to providers you set up. Requests never send cookies (`credentials: 'omit'`).
- Ollama setup text already lists `chrome-extension://*,moz-extension://*` (§12.9). A 403 from Ollama in the extension is a missing `OLLAMA_ORIGINS` entry.

## Review Focus

1. **A host missing from `host_permissions`.** A source or provider that works in the web app must not silently fail CORS in the extension. Pinned by `every host the adapters and providers call is covered` (Task 1).
2. **Rapid repeated Stumble presses** (toolbar double-click, held Alt+Shift+S). Each press must navigate once, in order, to a different find, with no unhandled rejection. Pinned by `concurrent stumbles run one at a time and never repeat a find` (Task 4).
3. **Stumble with nothing new or while offline.** The engine returns `{empty:true, reason}` or throws. The tab must stay where it is and the toolbar must say why. Pinned by `an empty pool sets the badge and title and does not navigate` and `an engine error sets the badge and does not navigate` (Task 4).
4. **"More like this page" on a non-web tab** (`chrome://newtab/`, `about:addons`, `file:///`). The panel must still open and say it works only on web pages. Pinned by `more like this page on a non-web tab stores a not-web marker` (Task 4) and `the panel explains a not-web page` (Task 6).
5. **Host access revoked after install** (Firefox lets users untick it). The badge must show it and the panel must offer **Grant access**, which clears once granted. Pinned by `checkAccess flags revoked hosts and clears when granted` (Task 4) and `the access banner grants and disappears` (Task 6).

---

## File Structure

| File | Responsibility |
|---|---|
| `shells/extension/manifest.base.json` | Keys shared by both browsers |
| `shells/extension/manifest.chrome.json` | Chrome/Edge overlay: `sidePanel`, `side_panel`, `tts`, the `open-panel` command |
| `shells/extension/manifest.firefox.json` | Firefox overlay: `sidebar_action`, `_execute_sidebar_action`, `browser_specific_settings.gecko` |
| `tools/build.js` (modify) | `mergeManifest`, `extensionManifest`, `buildExtension`; the `extension` target |
| `tools/check.js` (modify) | `checkExtensionDir`: manifest JSON, exact CSP, no remote script URLs, no `lab/` or `vendor/` |
| `src/platform/extension.js` | `createExtensionPlatform`, `gateVoice`, `createExtSecrets` |
| `shells/extension/bg.js` | `createBackground(deps)` handlers, plus the top-level event wiring and the engine loader |
| `shells/extension/panel.html` | Side panel / sidebar page (`data-surface="panel"`) |
| `shells/extension/app.html` | Byways tab page (`data-surface="tab"`) |
| `shells/extension/panel.js` | Boots the shared UI for either surface; panel extras; access banner |
| `shells/extension/permission.html`, `permission.js` | One-time mic grant, then the tab closes |
| `tests/unit/ext-manifest.test.js` | Merge rules, both manifests, host coverage |
| `tests/unit/ext-check.test.js` | `buildExtension` output and `checkExtensionDir` rules |
| `tests/unit/ext-platform.test.js` | `createExtensionPlatform` with a fake `ext` and `win` |
| `tests/unit/ext-bg.test.js` | `createBackground` handlers with a fake `ext` and a fake engine |
| `tests/e2e/helpers/net.js` (modify) | `mockNet` and `unmocked` accept a `BrowserContext` too |
| `tests/e2e/extension.spec.js` | Loads `dist/chrome` in a persistent context; stumble, panel, routes, mic page |
| `tests/fixtures/http/html/find-page.html` | Stand-in page for a stumbled site |
| `.github/workflows/byways.yml` (modify) | Zip both builds as artifacts; `xvfb-run` for the extension spec if headless fails |
| `CHECKLIST.md` (create or modify) | Firefox manual checks |

**Message types** (between `bg.js` and the extension pages, all via `ext.runtime.sendMessage`):

| `type` | From → to | Payload | Reply / effect |
|---|---|---|---|
| `stumble` | page → bg | `{tabId}` | Runs the toolbar Stumble on that tab. Reply `{ok:true, find}` or `{ok:false, reason}` |
| `tabFind` | bg → pages | `{tabId, windowId, find, branch, why}` | Panel in that window shows the card |
| `stateChanged` | page → bg | `{}` | bg drops its cached engine (taste changed) |
| `toggleListening` | bg → pages | `{}` | Panel or tab toggles the mic |
| `rabbit` | bg → pages | `{}` | Panel reads `pendingRabbit` from `storage.session` |
| `openPermission` | page → bg | `{}` | bg opens or focuses `permission.html`. Reply `{tabId}` |
| `micGranted` | permission page → pages | `{granted:boolean}` | Panel or tab announces the result |
| `accessChanged` | bg → pages | `{needsAccess:boolean}` | Pages show or hide the **Grant access** banner |

`storage.session` keys: `find:<tabId>` → `{find, branch, why}`, `pendingRabbit` → `Find` or `{error:'not-web'}`, `permissionTabId` → number. `storage.local` keys: `secret:<id>` → string, `needsAccess` → boolean.

### Task 1: Manifest template, overlays and merge

**Files:**
- Create: `shells/extension/manifest.base.json`, `shells/extension/manifest.chrome.json`, `shells/extension/manifest.firefox.json`
- Modify: `tools/build.js` (add three exports; keep the CLI from running on import)
- Test: `tests/unit/ext-manifest.test.js`

**Interfaces:**
- Consumes: `SOURCES` from `src/core/sources/index.js`; `PROVIDERS` from `src/core/ai/providers.js`; `DEFAULT_SETTINGS` from `src/core/settings.js`; `mulberry32` from `src/core/util/hash.js`; `fakeClock` from `src/core/util/clock.js`.
- Produces (in `tools/build.js`):
  - `mergeManifest(base: object, overlay: object) → object`
  - `extensionManifest(browser: 'chrome'|'firefox', {version: string}) → Promise<object>`
  - `hostCovered(patterns: string[], url: string) → boolean`

- [ ] **Step 1: Write the failing tests** in `tests/unit/ext-manifest.test.js`

```js
const CSP = "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';";
const keys = (c) => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v.suggested_key.default]));

test('mergeManifest deep-merges objects, unions arrays and lets overlay scalars win', () => {
  const base = { a: 1, list: ['x', 'y'], obj: { k: 1, keep: true } };
  const out = mergeManifest(base, { a: 2, list: ['y', 'z'], obj: { k: 3 } });
  assert.deepEqual(out, { a: 2, list: ['x', 'y', 'z'], obj: { k: 3, keep: true } });
  assert.deepEqual(base, { a: 1, list: ['x', 'y'], obj: { k: 1, keep: true } }); // inputs untouched
});

test('chrome manifest', async () => {
  const m = await extensionManifest('chrome', { version: '1.2.3' });
  assert.equal(m.manifest_version, 3);
  assert.equal(m.version, '1.2.3');
  assert.deepEqual(m.background, { service_worker: 'bg.js', scripts: ['bg.js'], type: 'module' });
  assert.equal(m.content_security_policy.extension_pages, CSP);
  assert.deepEqual([...m.permissions].sort(), ['activeTab', 'contextMenus', 'sidePanel', 'storage', 'unlimitedStorage']);
  assert.deepEqual([...m.optional_permissions].sort(), ['identity', 'tts']);
  assert.deepEqual(m.optional_host_permissions, ['https://*/*', 'http://localhost/*', 'http://127.0.0.1/*', 'http://*/*']);
  for (const h of ['https://archive.org/*', 'https://*.archive.org/*', 'https://raw.githubusercontent.com/*',
                   'https://itch.io/*', 'https://iteatsthesalt.github.io/*']) assert.ok(m.host_permissions.includes(h), h);
  assert.deepEqual(m.side_panel, { default_path: 'panel.html' });
  assert.equal(m.action.default_title, 'Stumble');
  assert.equal(m.action.openPanelOnActionClick, undefined);
  assert.equal(m.sidebar_action, undefined);
  assert.equal(m.browser_specific_settings, undefined);
  assert.equal(m.content_scripts, undefined);
  assert.deepEqual(keys(m.commands), { _execute_action: 'Alt+Shift+S', 'open-panel': 'Alt+Shift+B',
    'toggle-listening': 'Alt+Shift+V', 'more-like-page': 'Alt+Shift+M' });
});

test('firefox manifest', async () => {
  const m = await extensionManifest('firefox', { version: '1.2.3' });
  assert.deepEqual(m.background, { service_worker: 'bg.js', scripts: ['bg.js'], type: 'module' });
  assert.equal(m.content_security_policy.extension_pages, CSP);
  assert.equal(m.side_panel, undefined);
  assert.ok(!m.permissions.includes('sidePanel'));
  assert.deepEqual(m.optional_permissions, ['identity']);
  assert.equal(m.sidebar_action.default_panel, 'panel.html');
  assert.deepEqual(m.browser_specific_settings.gecko, { id: 'byways@iteatsthesalt', strict_min_version: '140.0',
    data_collection_permissions: { required: ['none'], optional: ['searchTerms', 'browsingActivity'] } });
  assert.deepEqual(keys(m.commands), { _execute_action: 'Alt+Shift+S', _execute_sidebar_action: 'Alt+Shift+B',
    'toggle-listening': 'Alt+Shift+V', 'more-like-page': 'Alt+Shift+M' });
});

test('hostCovered follows match-pattern rules', () => {
  assert.equal(hostCovered(['https://*.wikipedia.org/*'], 'https://en.wikipedia.org/w/api.php'), true);
  assert.equal(hostCovered(['https://*.archive.org/*'], 'https://archive.org/advancedsearch.php'), true);
  assert.equal(hostCovered(['https://archive.org/*'], 'https://evilarchive.org/'), false);
  assert.equal(hostCovered(['https://itch.io/*'], 'http://itch.io/feed.xml'), false);
});
```

Review Focus 1, in the same file. The recording `http` collects every URL an adapter asks for and fails the call, so no real request happens:

```js
test('every host the adapters and providers call is covered', async () => {
  const m = await extensionManifest('chrome', { version: '1.0.0' });
  const urls = [];
  const fail = async (url) => { urls.push(url); throw new Error('offline'); };
  const http = { register() {}, request: fail, getJson: fail, getText: fail };
  const ctx = { http, rand: mulberry32(1), clock: fakeClock(0), cache: { get: () => undefined, set() {}, purgeExpired() {} },
    settings: DEFAULT_SETTINGS, secrets: { get: async () => 'test-key', set: async () => {}, delete: async () => {}, list: async () => [] },
    data: readData(), platformName: 'extension' };           // readData(): the four src/data files via fs
  for (const a of Object.values(SOURCES)) {
    if (a.tier === 'navigate' || a.tier === 'snapshot') continue;
    await a.random(ctx).catch(() => {});
    await a.search('retro', ctx).catch(() => {});
  }
  for (const p of Object.values(PROVIDERS)) if (p.baseURL?.startsWith('https://')) urls.push(p.baseURL);
  const missing = [...new Set(urls.filter((u) => u.startsWith('https://') && !hostCovered(m.host_permissions, u))
    .map((u) => new URL(u).host))];
  assert.deepEqual(missing, []);
});
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `node --test tests/unit/ext-manifest.test.js`
Expected: FAIL with `SyntaxError: The requested module '../../tools/build.js' does not provide an export named 'mergeManifest'`.

- [ ] **Step 3: Make `tools/build.js` safe to import**

If the CLI runs at module load, wrap it in `if (import.meta.url === pathToFileURL(process.argv[1]).href) { … }` (`pathToFileURL` from `node:url`). `npm run build` must behave as before.

- [ ] **Step 4: Write the three manifest files**

- `manifest.base.json`: `manifest_version: 3`, `name: "Byways"`, `version: "0.0.0"` (the build replaces it), `description: "Press one button and go somewhere you would not have found on your own."`, `icons: {"192": "assets/icons/icon-192.png", "512": "assets/icons/icon-512.png"}`, `action: {"default_title": "Stumble", "default_icon": {"192": "assets/icons/icon-192.png"}}`, the `background` object above, `permissions: ["storage","unlimitedStorage","contextMenus","activeTab"]`, `optional_permissions: ["identity"]`, `host_permissions`, the four `optional_host_permissions` above in that order, `content_security_policy.extension_pages` = the CSP above, and `commands` for `_execute_action` (Alt+Shift+S, "Stumble"), `toggle-listening` (Alt+Shift+V, "Turn listening on or off") and `more-like-page` (Alt+Shift+M, "More like this page"), each as `{"suggested_key": {"default": "…"}, "description": "…"}`.
- `host_permissions` start with `https://archive.org/*`, `https://*.archive.org/*`, `https://raw.githubusercontent.com/*`, `https://itch.io/*`, `https://iteatsthesalt.github.io/*`, the provider hosts `https://api.anthropic.com/*`, `https://api.openai.com/*`, `https://generativelanguage.googleapis.com/*`, `https://openrouter.ai/*`, `https://api.groq.com/*`, `https://api.x.ai/*`, `https://api.mistral.ai/*`, `https://api.deepseek.com/*`, `https://ollama.com/*`. Then add one `https://<host>/*` (or `https://*.<domain>/*` for Wikimedia sites) for each host the coverage test reports as missing.
- `manifest.chrome.json`: `permissions: ["sidePanel"]`, `optional_permissions: ["tts"]`, `side_panel: {"default_path": "panel.html"}`, and command `open-panel` (Alt+Shift+B, "Open the Byways panel").
- `manifest.firefox.json`: `sidebar_action: {"default_panel": "panel.html", "default_title": "Byways", "default_icon": "assets/icons/icon-192.png"}`, command `_execute_sidebar_action` (Alt+Shift+B, "Open the Byways sidebar"), and `browser_specific_settings.gecko` exactly as the Firefox test expects.

- [ ] **Step 5: Implement the three exports in `tools/build.js`**

`mergeManifest`: returns a new object. Plain objects merge key by key, arrays become `[...new Set([...base, ...overlay])]`, anything else takes the overlay value. `extensionManifest(browser, {version})` reads `shells/extension/manifest.base.json` and `manifest.<browser>.json`, merges them and sets `version`. `hostCovered(patterns, url)` parses each pattern as `<scheme>://<host>/<path>`. It needs an equal scheme, and a host that is equal or, for `*.d`, equal to `d` or ending in `.d`. Paths are ignored.

- [ ] **Step 6: Run the tests and see them pass**

Run: `node --test tests/unit/ext-manifest.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 7: Commit**

```bash
git add shells/extension/manifest.base.json shells/extension/manifest.chrome.json shells/extension/manifest.firefox.json tools/build.js tests/unit/ext-manifest.test.js
git commit -m "Add the extension manifest template and browser overlays"
```

### Task 2: Extension build target and manifest checks

**Files:**
- Modify: `tools/build.js` (the `extension` target), `tools/check.js`
- Test: `tests/unit/ext-check.test.js`

**Interfaces:**
- Consumes: `extensionManifest` (Task 1).
- Produces:
  - `buildExtension(browser: 'chrome'|'firefox', outDir: string) → Promise<void>` in `tools/build.js`
  - `checkExtensionDir(dir: string, browser: 'chrome'|'firefox') → Promise<string[]>` in `tools/check.js` (empty array = clean)

- [ ] **Step 1: Write the failing tests** in `tests/unit/ext-check.test.js`

```js
let dir;
before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'byways-ext-'));
  await buildExtension('chrome', join(dir, 'chrome'));
  await buildExtension('firefox', join(dir, 'firefox'));
});
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
// copyBuild(): cp(join(dir, 'chrome'), <new tmp dir>, {recursive: true}) and return that dir

for (const b of ['chrome', 'firefox']) test(`buildExtension writes the ${b} manifest, code and data`, async () => {
  const d = join(dir, b);
  assert.deepEqual(JSON.parse(readFileSync(join(d, 'manifest.json'), 'utf8')), await extensionManifest(b, { version: pkg.version }));
  for (const f of ['core/engine.js', 'ui/boot.js', 'platform/extension.js', 'data/library.json', 'assets/icons/icon-192.png'])
    assert.ok(existsSync(join(d, f)), f);
  for (const f of readdirSync('shells/extension').filter((f) => !f.startsWith('manifest.'))) assert.ok(existsSync(join(d, f)), f);
  assert.equal(JSON.parse(readFileSync(join(d, 'build.json'), 'utf8')).id, process.env.GITHUB_SHA ?? 'dev');
});

test('buildExtension never copies the Lab, vendor or manifest parts', () => {
  for (const b of ['chrome', 'firefox']) for (const f of ['lab', 'vendor', 'manifest.base.json', 'manifest.chrome.json'])
    assert.equal(existsSync(join(dir, b, f)), false, `${b}/${f}`);
});

test('checkExtensionDir passes fresh builds', async () => {
  assert.deepEqual(await checkExtensionDir(join(dir, 'chrome'), 'chrome'), []);
  assert.deepEqual(await checkExtensionDir(join(dir, 'firefox'), 'firefox'), []);
});

test('checkExtensionDir reports a changed CSP', async () => {
  const d = await copyBuild();
  const m = JSON.parse(readFileSync(join(d, 'manifest.json'), 'utf8'));
  m.content_security_policy.extension_pages = "script-src 'self';";
  writeFileSync(join(d, 'manifest.json'), JSON.stringify(m));
  assert.deepEqual(await checkExtensionDir(d, 'chrome'), ['manifest.json: extension_pages CSP is not the required string']);
});

test('checkExtensionDir reports invalid JSON', async () => {
  const d = await copyBuild();
  writeFileSync(join(d, 'manifest.json'), '{');
  assert.deepEqual(await checkExtensionDir(d, 'chrome'), ['manifest.json: not valid JSON']);
});

test('checkExtensionDir reports a remote script tag', async () => {
  const d = await copyBuild();
  writeFileSync(join(d, 'extra.html'), '<script type="module" src="https://cdn.example/x.js"></script>');
  assert.deepEqual(await checkExtensionDir(d, 'chrome'), ['extra.html: remote script https://cdn.example/x.js']);
});

test('checkExtensionDir reports a lab folder', async () => {
  const d = await copyBuild();
  mkdirSync(join(d, 'lab'));
  assert.deepEqual(await checkExtensionDir(d, 'chrome'), ['lab/: must not be in the extension build']);
});
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `node --test tests/unit/ext-check.test.js`
Expected: FAIL with `does not provide an export named 'buildExtension'`.

- [ ] **Step 3: Implement `buildExtension(browser, outDir)` in `tools/build.js`**

It removes `outDir`, then copies `src/core`, `src/ui`, `src/platform`, `src/data` and `src/assets` into `outDir` under the same names. It copies every file in `shells/extension/` except `manifest.*.json` to the root of `outDir`. It writes `manifest.json` from `extensionManifest(browser, {version: <package.json version>})` and `build.json` = `{"id": process.env.GITHUB_SHA ?? "dev", "builtAt": new Date().toISOString()}`. It never reads `src/lab`, `src/versions.json` or `vendor/`. The `extension` target (and `all`) calls it for `chrome` → `dist/chrome` and `firefox` → `dist/firefox`.

- [ ] **Step 4: Implement `checkExtensionDir(dir, browser)` in `tools/check.js`**

The rules, in this order, each adding the exact message from the tests:
1. `manifest.json` parses, else `manifest.json: not valid JSON` (and stop).
2. `content_security_policy.extension_pages` equals the CSP string exactly.
3. No `lab/` or `vendor/` folder at the root: `<name>/: must not be in the extension build`.
4. Every `.html` file: each `<script … src=…>` whose value matches `/^(?:https?:)?\/\//i` gives `<file>: remote script <src>`.

The `--check` run builds both browsers into its temporary folder and adds `checkExtensionDir` errors to its failure list.

- [ ] **Step 5: Run the tests and see them pass**

Run: `node --test tests/unit/ext-check.test.js`
Expected: PASS, 7 tests.

- [ ] **Step 6: Run the whole check**

Run: `npm run check`
Expected: exit code 0.

- [ ] **Step 7: Commit**

```bash
git add tools/build.js tools/check.js tests/unit/ext-check.test.js
git commit -m "Build the Chrome and Firefox extensions and check their manifests"
```

### Task 3: Extension platform

**Files:**
- Create: `src/platform/extension.js`
- Test: `tests/unit/ext-platform.test.js`

**Interfaces:**
- Consumes: `createWebVoice(win) → VoiceEngine` and `createNoVoice() → VoiceEngine` (`platform/web-voice.js`); `createWebTts(speechSynthesis) → Tts`; `createWebMedia(navigator)` and `createWebWakeLock(navigator, document)` (`platform/web-media.js`); the `Platform`, `VoiceEngine` and `SecretStore` shapes in `core/types.js`.
- Produces (in `src/platform/extension.js`):
  - `createExtensionPlatform({ext, win, surface: 'background'|'panel'|'tab'}) → Platform`
  - `gateVoice(inner: VoiceEngine, {win, ext}) → VoiceEngine`
  - `createExtSecrets(ext) → SecretStore`

The tests use two fakes, written at the top of the test file:
- `fakeExt()` returns `{calls, messages, local, session, storage, tabs, runtime}`. `storage.local` and `storage.session` keep plain objects (`local`, `session`) with `get(keyOrKeys?)`, `set(obj)` and `remove(keyOrKeys)` as in the WebExtensions API. `tabs.query()` resolves `[{id: 7, windowId: 1}]`. `tabs.update(id, props)` and `tabs.create(props)` push `['tabs.update', id, props]` and `['tabs.create', props]` to `calls`. `runtime.sendMessage(m)` pushes `m` to `messages`. `runtime.getURL(p)` returns `'chrome-extension://test/' + p`.
- `fakeWin({mic = 'granted'})` returns `{calls, fetch, navigator, speechSynthesis}`. `fetch(url, init)` pushes `[url, init]` to `calls` and resolves `new Response('ok')`. `navigator.permissions.query({name})` resolves `{state: mic}`, or rejects when `mic === 'throws'`. `navigator.clipboard.writeText(t)` pushes `['copy', t]`. It has no `share` and no `document`.
- `fakeVoice()` is a `VoiceEngine` whose `start` sets `started = true`, and whose `emit(event, data)` calls the `on` listeners.

- [ ] **Step 1: Write the failing tests**

```js
const find = { id: 'url:1', source: 'library', kind: 'site', title: 'A small site', description: '', url: 'https://small.example/', tags: [], why: [], safety: 'curated' };

test('the extension caps and name', () => {
  const p = createExtensionPlatform({ ext: fakeExt(), win: fakeWin({}), surface: 'tab' });
  assert.equal(p.name, 'extension');
  assert.deepEqual(p.caps, { privilegedFetch: true, localNetworkHttp: true, inAppSiteView: false,
    labHref: 'https://iteatsthesalt.github.io/Game-Dev-Resources/byways/lab/', framesArchive: true });
});

test('transport fetches without cookies and drops the privileged flag', async () => {
  const win = fakeWin({});
  const p = createExtensionPlatform({ ext: fakeExt(), win, surface: 'panel' });
  await p.transport.fetch('https://api.example/x', { headers: { a: '1' }, privileged: true });
  assert.deepEqual(win.calls, [['https://api.example/x', { headers: { a: '1' }, credentials: 'omit' }]]);
});

test('secrets live in storage.local under secret:', async () => {
  const ext = fakeExt();
  ext.local.needsAccess = true;
  const s = createExtSecrets(ext);
  await s.set('anthropic', 'k1');
  assert.equal(ext.local['secret:anthropic'], 'k1');
  assert.equal(await s.get('anthropic'), 'k1');
  assert.deepEqual(await s.list(), ['anthropic']);
  await s.delete('anthropic');
  assert.equal(await s.get('anthropic'), null);
});

test("openFind 'current' loads the active tab and remembers the find", async () => {
  const ext = fakeExt();
  await createExtensionPlatform({ ext, win: fakeWin({}), surface: 'panel' }).openFind(find, 'current');
  assert.deepEqual(ext.calls, [['tabs.update', 7, { url: 'https://small.example/' }]]);
  assert.equal(ext.session['find:7'].find.id, 'url:1');
});

test("openFind 'tab' and 'inapp' open a new tab", async () => {
  const ext = fakeExt();
  const p = createExtensionPlatform({ ext, win: fakeWin({}), surface: 'panel' });
  await p.openFind(find, 'tab');
  await p.openFind(find, 'inapp');
  assert.deepEqual(ext.calls, [['tabs.create', { url: 'https://small.example/' }], ['tabs.create', { url: 'https://small.example/' }]]);
});

test('Open defaults to the current tab in the panel and a new tab in the Byways tab', async () => {
  const a = fakeExt(); await createExtensionPlatform({ ext: a, win: fakeWin({}), surface: 'panel' }).openFind(find);
  const b = fakeExt(); await createExtensionPlatform({ ext: b, win: fakeWin({}), surface: 'tab' }).openFind(find);
  assert.equal(a.calls[0][0], 'tabs.update');
  assert.equal(b.calls[0][0], 'tabs.create');
});

test('share copies the link when there is no share sheet', async () => {
  const win = fakeWin({});
  const r = await createExtensionPlatform({ ext: fakeExt(), win, surface: 'tab' }).share({ url: 'https://small.example/' });
  assert.equal(r, 'copied');
  assert.deepEqual(win.calls, [['copy', 'https://small.example/']]);
});

test('the background has no voice', async () => {
  const p = createExtensionPlatform({ ext: fakeExt(), win: fakeWin({}), surface: 'background' });
  assert.equal((await p.voice.probe({ allowCloud: false })).kind, 'none');
});

test('start asks for the mic page when the mic is not granted', async () => {
  const ext = fakeExt(); const inner = fakeVoice(); const errors = [];
  const v = gateVoice(inner, { win: fakeWin({ mic: 'prompt' }), ext });
  v.on('error', (e) => errors.push(e));
  await v.start({ lang: 'en-US', phrases: [], allowCloud: false });
  assert.equal(inner.started, false);
  assert.deepEqual(ext.messages, [{ type: 'openPermission' }]);
  assert.deepEqual(errors, [{ code: 'not-allowed' }]);
});

test('start goes straight to the engine when the mic is granted', async () => {
  const ext = fakeExt(); const inner = fakeVoice();
  await gateVoice(inner, { win: fakeWin({ mic: 'granted' }), ext }).start({ lang: 'en-US', phrases: [], allowCloud: false });
  assert.equal(inner.started, true);
  assert.deepEqual(ext.messages, []);
});

test('a failing permission query still tries the engine, and a not-allowed error asks for the mic page', async () => {
  const ext = fakeExt(); const inner = fakeVoice(); const errors = [];
  const v = gateVoice(inner, { win: fakeWin({ mic: 'throws' }), ext });
  v.on('error', (e) => errors.push(e));
  await v.start({ lang: 'en-US', phrases: [], allowCloud: false });
  assert.equal(inner.started, true);
  inner.emit('error', { code: 'not-allowed' });
  assert.deepEqual(ext.messages, [{ type: 'openPermission' }]);
  assert.deepEqual(errors, [{ code: 'not-allowed' }]);
});
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `node --test tests/unit/ext-platform.test.js`
Expected: FAIL with `Cannot find module` for `src/platform/extension.js`.

- [ ] **Step 3: Implement `src/platform/extension.js`**

- `createExtSecrets(ext)`: keys are stored as `secret:<id>` in `ext.storage.local`. `get` returns `null` when the key is missing. `list` returns the ids with the prefix removed and ignores other keys.
- `gateVoice(inner, {win, ext})`: `probe`, `install`, `stop` pass through. `on('result'|'state')` subscribe to `inner`. `on('error')` subscribes to the gate's own list, which receives every inner error. `start(opts)` queries `win.navigator.permissions.query({name: 'microphone'})`. On `'granted'`, or when the query rejects, it calls `inner.start(opts)`. Otherwise it sends `{type: 'openPermission'}` and emits `{code: 'not-allowed'}`. An inner `not-allowed` error also sends `{type: 'openPermission'}`.
- `createExtensionPlatform({ext, win, surface})`:
  - `transport.fetch(url, init)` calls `win.fetch(url, {...init without privileged, credentials: 'omit'})`.
  - `voice`: `createNoVoice()` for `'background'`, else `gateVoice(createWebVoice(win), {win, ext})`.
  - `tts`: for `'background'`, a silent `Tts` (`speak` resolves, `voices` resolves `[]`); else `createWebTts(win.speechSynthesis)`.
  - `openFind(find, how)`: `how` defaults to `'current'` for `'panel'` and `'tab'` for the other surfaces. `'current'` queries `{active: true, currentWindow: true}`, calls `ext.tabs.update(tab.id, {url})`, then sets `storage.session['find:<id>'] = {find, branch: null, why: find.why}`. `'tab'` and `'inapp'` call `ext.tabs.create({url})`.
  - `share(data)`: `win.navigator.share` when it exists (`'shared'`, or `'cancelled'` on `AbortError`). Otherwise it copies `data.url ?? data.text` and returns `'copied'`.
  - `files.save(name, blob)` uses an `<a download>` with an object URL. `files.pick(accept, multiple)` uses a hidden `<input type=file>`. Both are only used on page surfaces.
  - `media` and `wakeLock` come from `createWebMedia(win.navigator)` and `createWebWakeLock(win.navigator, win.document)` when `win.document` exists, and are no-ops otherwise.
  - `secrets: createExtSecrets(ext)`, the `caps` above, and `persistStorage` resolves `true` (the manifest has `unlimitedStorage`).

- [ ] **Step 4: Run the tests and see them pass**

Run: `node --test tests/unit/ext-platform.test.js`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add src/platform/extension.js tests/unit/ext-platform.test.js
git commit -m "Add the extension platform with storage.local secrets and a mic gate"
```

### Task 4: Background handlers and wiring

**Files:**
- Create: `shells/extension/bg.js`
- Test: `tests/unit/ext-bg.test.js`

**Interfaces:**
- Consumes: `buildExtension` (Task 2); `createExtensionPlatform` (Task 3); `openStore`, `idbBackend`; `loadSettings`; `createHttp`; `realClock`; `mulberry32`; `createEngine`; `makeFind`; `isHttpUrl`, `domainOf`. In `dist/<browser>/` these sit at `./core/…` and `./platform/…`, so `bg.js` imports them with those paths.
- Produces: `createBackground({ext, getEngine: () => Promise<{engine: Engine, settings: Settings}>, resetEngine: () => void}) → Background`, exported from `bg.js`, where `Background` has:
  - `stumble(tab) → Promise<{ok: true, find} | {ok: false, reason: string}>`
  - `morePage(tab) → Promise<void>`, `onCommand(command, tab) → Promise<void>`, `onMenuClick(info, tab) → Promise<void>`
  - `onMessage(msg, sender) → Promise<any> | undefined`
  - `checkAccess() → Promise<boolean>`, `openPermission() → Promise<{tabId}>`, `onInstalled(details) → Promise<void>`, `onTabRemoved(tabId) → Promise<void>`

The tests import `createBackground` from a fresh build: `before()` runs `buildExtension('chrome', dir)` into a `mkdtemp` folder and imports `pathToFileURL(join(dir, 'bg.js')).href`. In Node there is no `chrome` global, so the wiring at the bottom of `bg.js` does not run.

Test fakes, written at the top of the test file:
- `fakeExt({granted = true, sidebar = false})` is Task 3's fake plus: `tabs.get(id)` (resolves `tabsById[id]` or rejects `'No tab'`), `action.setBadgeText(o)` → `['badge', o]`, `action.setTitle(o)` → `['title', o]`, `sidePanel.open(o)` → `['sidePanel.open', o]` (or, with `sidebar: true`, no `sidePanel` and `sidebarAction.open()` → `['sidebarAction.open']`), `permissions.contains(q)` → `['contains', q]` and resolves `granted`, `contextMenus.removeAll()` → `['menus.removeAll']`, `contextMenus.create(o)` → `['menus.create', o]`, `runtime.getManifest()` → `{host_permissions: ['https://archive.org/*']}`. Every recorder pushes synchronously, before any `await`.
- `fakeEngine(results)`: `next({mode})` records `mode` in `modes`, waits one macrotask, then returns `results.shift()` (throwing it if it is an `Error`). It tracks `maxInFlight`.
- `bgWith(results, {settings = {mode: 'tuned'}, ...extOpts} = {})` returns `{bg, ext, engine, resets}`.

- [ ] **Step 1: Write the failing tests**

```js
const f = (n) => ({ id: `url:${n}`, source: 'library', kind: 'site', title: `Find ${n}`, description: '', url: `https://s${n}.example/`, tags: [], why: [], safety: 'curated' });
const tab = { id: 5, windowId: 2 };

test('stumble loads the next find in the tab and remembers it', async () => {
  const { bg, ext } = bgWith([{ find: f(1), branch: 'taste', why: ['w'] }]);
  assert.deepEqual(await bg.stumble(tab), { ok: true, find: f(1) });
  assert.deepEqual(ext.calls.find((c) => c[0] === 'tabs.update'), ['tabs.update', 5, { url: 'https://s1.example/' }]);
  assert.deepEqual(ext.session['find:5'], { find: f(1), branch: 'taste', why: ['w'] });
  assert.deepEqual(ext.messages.at(-1), { type: 'tabFind', tabId: 5, windowId: 2, find: f(1), branch: 'taste', why: ['w'] });
});

test('stumble uses tuned when the saved mode is ai, and passes fate through', async () => {
  const a = bgWith([{ find: f(1), branch: 'taste', why: [] }], { settings: { mode: 'ai' } });
  await a.bg.stumble(tab);
  const b = bgWith([{ find: f(1), branch: 'taste', why: [] }], { settings: { mode: 'fate' } });
  await b.bg.stumble(tab);
  assert.deepEqual([a.engine.modes, b.engine.modes], [['tuned'], ['fate']]);
});

test('concurrent stumbles run one at a time and never repeat a find', async () => {      // Review Focus 2
  const { bg, ext, engine } = bgWith([{ find: f(1), branch: 'taste', why: [] }, { find: f(2), branch: 'taste', why: [] }]);
  const [a, b] = await Promise.all([bg.stumble(tab), bg.stumble(tab)]);
  assert.notEqual(a.find.id, b.find.id);
  assert.equal(engine.maxInFlight, 1);
  assert.deepEqual(ext.calls.filter((c) => c[0] === 'tabs.update').map((c) => c[2].url), ['https://s1.example/', 'https://s2.example/']);
  assert.equal(ext.session['find:5'].find.id, 'url:2');
});

test('an empty pool sets the badge and title and does not navigate', async () => {       // Review Focus 3
  const { bg, ext } = bgWith([{ empty: true, reason: 'Nothing new here' }]);
  assert.deepEqual(await bg.stumble(tab), { ok: false, reason: 'Nothing new here' });
  assert.equal(ext.calls.some((c) => c[0] === 'tabs.update'), false);
  assert.deepEqual(ext.calls.filter((c) => c[0] === 'badge' || c[0] === 'title'),
    [['badge', { tabId: 5, text: '0' }], ['title', { tabId: 5, title: 'Stumble: Nothing new here' }]]);
});

test('an engine error sets the badge and does not navigate', async () => {               // Review Focus 3
  const { bg, ext } = bgWith([new Error('offline')]);
  assert.deepEqual(await bg.stumble(tab), { ok: false, reason: 'error' });
  assert.equal(ext.calls.some((c) => c[0] === 'tabs.update'), false);
  assert.deepEqual(ext.calls.filter((c) => c[0] === 'badge' || c[0] === 'title'),
    [['badge', { tabId: 5, text: '!' }], ['title', { tabId: 5, title: 'Stumble: Byways could not reach its sources. Try again.' }]]);
});

test('more like this page opens the panel before anything else and stores a seed', async () => {
  for (const sidebar of [false, true]) {
    const { bg, ext } = bgWith([], { sidebar });
    await bg.onMenuClick({ menuItemId: 'more-like-page' }, { ...tab, url: 'https://small.example/blog/', title: 'Small blog' });
    assert.deepEqual(ext.calls[0], sidebar ? ['sidebarAction.open'] : ['sidePanel.open', { windowId: 2 }]);
    assert.deepEqual([ext.session.pendingRabbit.source, ext.session.pendingRabbit.kind, ext.session.pendingRabbit.url],
      ['marginalia', 'site', 'https://small.example/blog/']);
    assert.deepEqual(ext.messages.at(-1), { type: 'rabbit' });
  }
});

test('more like this page on a non-web tab stores a not-web marker', async () => {       // Review Focus 4
  for (const url of ['chrome://newtab/', 'about:addons', 'file:///home/a.html', undefined]) {
    const { bg, ext } = bgWith([]);
    await bg.morePage({ ...tab, url });
    assert.deepEqual(ext.calls[0], ['sidePanel.open', { windowId: 2 }]);
    assert.deepEqual(ext.session.pendingRabbit, { error: 'not-web' });
  }
});

test('checkAccess flags revoked hosts and clears when granted', async () => {            // Review Focus 5
  const { bg, ext } = bgWith([], { granted: false });
  assert.equal(await bg.checkAccess(), false);
  assert.deepEqual(ext.calls[0], ['contains', { origins: ['https://archive.org/*'] }]);
  assert.equal(ext.local.needsAccess, true);
  assert.deepEqual(ext.calls.find((c) => c[0] === 'badge'), ['badge', { text: '!' }]);
  assert.deepEqual(ext.messages.at(-1), { type: 'accessChanged', needsAccess: true });
  ext.granted = true;                                     // the fake reads this on each contains()
  assert.equal(await bg.checkAccess(), true);
  assert.equal(ext.local.needsAccess, false);
  assert.deepEqual(ext.calls.at(-1), ['badge', { text: '' }]);
  assert.deepEqual(ext.messages.at(-1), { type: 'accessChanged', needsAccess: false });
});

test('onInstalled recreates the context menu, then checks access', async () => {
  const { bg, ext } = bgWith([]);
  await bg.onInstalled({ reason: 'install' });
  assert.deepEqual(ext.calls.slice(0, 3), [['menus.removeAll'],
    ['menus.create', { id: 'more-like-page', title: 'More like this page', contexts: ['page'] }], ['contains', { origins: ['https://archive.org/*'] }]]);
});

test('commands', async () => {
  const { bg, ext } = bgWith([]);
  await bg.onCommand('toggle-listening', tab);
  await bg.onCommand('open-panel', tab);
  assert.deepEqual(ext.messages, [{ type: 'toggleListening' }]);
  assert.deepEqual(ext.calls, [['sidePanel.open', { windowId: 2 }]]);
});

test('openPermission opens one mic tab and focuses it the second time', async () => {
  const { bg, ext } = bgWith([]);
  assert.deepEqual(await bg.openPermission(), { tabId: 99 });             // tabs.create resolves {id: 99}
  ext.tabsById[99] = { id: 99, windowId: 2 };
  assert.deepEqual(await bg.openPermission(), { tabId: 99 });
  assert.deepEqual(ext.calls.filter((c) => c[0].startsWith('tabs.')),
    [['tabs.create', { url: 'chrome-extension://test/permission.html' }], ['tabs.update', 99, { active: true }]]);
});

test('messages', async () => {
  const { bg, ext, resets } = bgWith([{ find: f(1), branch: 'taste', why: [] }]);
  ext.tabsById[7] = { id: 7, windowId: 1 };
  assert.equal((await bg.onMessage({ type: 'stumble', tabId: 7 }, {})).ok, true);
  assert.deepEqual(await bg.onMessage({ type: 'stateChanged' }, {}), { ok: true });
  assert.equal(resets.count, 1);
  assert.deepEqual(await bg.onMessage({ type: 'checkAccess' }, {}), { needsAccess: false });
  assert.equal(bg.onMessage({ type: 'tabFind' }, {}), undefined);
});

test('a closed tab forgets its find', async () => {
  const { bg, ext } = bgWith([]);
  ext.session['find:5'] = { find: f(1) };
  await bg.onTabRemoved(5);
  assert.equal('find:5' in ext.session, false);
});
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `node --test tests/unit/ext-bg.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `bg.js` in the build folder.

- [ ] **Step 3: Implement `createBackground` in `shells/extension/bg.js`**

- `stumble` chains each call on one promise, so calls run one at a time and a failure does not break the chain. Each run: `getEngine()`, then `engine.next({mode: settings.mode === 'ai' ? 'tuned' : settings.mode})`. On a find, in this order: `tabs.update(tab.id, {url})`, `setBadgeText({tabId, text: ''})` and `setTitle({tabId, title: 'Stumble'})`, set `storage.session['find:<id>'] = {find, branch, why}`, then send `tabFind`. On `{empty}`: badge `'0'` and title `'Stumble: <reason>'`. On a throw: badge `'!'` and title `'Stumble: Byways could not reach its sources. Try again.'`, and the reply reason is `'error'`. Badge and title calls come before any other call in those two paths.
- `openPanel(tab)` (internal) runs **synchronously** and is never awaited: `ext.sidePanel.open({windowId: tab.windowId})` when `ext.sidePanel` exists, else `ext.sidebarAction.open()`. Both browsers only allow this inside the user-action handler, so `morePage` and `onCommand('open-panel')` call it before any `await`. Its promise gets a `.catch(() => {})`.
- `morePage(tab)`: `openPanel(tab)`, then `pendingRabbit` = `makeFind({source: 'marginalia', kind: 'site', url: tab.url, title: tab.title || domainOf(tab.url)})` when `isHttpUrl(tab.url ?? '')`, else `{error: 'not-web'}`. Then send `{type: 'rabbit'}`.
- `onMenuClick(info, tab)` runs `morePage` for `info.menuItemId === 'more-like-page'`. `onCommand`: `'open-panel'` → `openPanel`, `'toggle-listening'` → send `{type: 'toggleListening'}`, `'more-like-page'` → `morePage`. When Firefox gives no `tab`, `morePage` opens the sidebar first and then reads `tabs.query({active: true, currentWindow: true})`.
- `checkAccess()`: `permissions.contains({origins: runtime.getManifest().host_permissions})`, then `storage.local.needsAccess = !ok`, badge `'!'` or `''` (no tabId), then send `accessChanged`.
- `openPermission()`: if `storage.session.permissionTabId` names a tab that `tabs.get` finds, `tabs.update(id, {active: true})`; otherwise `tabs.create({url: runtime.getURL('permission.html')})` and store its id.
- `onMessage`: `stumble` → `tabs.get(msg.tabId)` then `stumble`; `stateChanged` → `resetEngine()` and `{ok: true}`; `checkAccess` → `{needsAccess: !(await checkAccess())}`; `openPermission` → `openPermission()`; anything else → `undefined`.
- `onInstalled`: `contextMenus.removeAll()`, `contextMenus.create({id: 'more-like-page', title: 'More like this page', contexts: ['page']})`, then `checkAccess()`. `onTabRemoved(id)` removes `find:<id>`.
- Sending a message with no page open rejects, so every send ends in `.catch(() => {})`.

- [ ] **Step 4: Add the engine loader and the wiring at the bottom of `bg.js`**

- `getEngine()` opens one `openStore(idbBackend())` per worker life, calls `loadSettings(store)` each time, and rebuilds the engine when `JSON.stringify(settings)` differs from the cached one or after `resetEngine()`. A build fetches `ext.runtime.getURL('data/tags.json' | 'data/library.json' | 'data/vault-starter.json' | 'data/geocities-seeds.json')` into `data = {tags, library, vaultStarter, geocities}`. It uses `platform = createExtensionPlatform({ext, win: globalThis, surface: 'background'})`, `http = createHttp({transport: platform.transport, clock: realClock})`, and `createEngine({store, http, clock: realClock, rand: mulberry32(crypto.getRandomValues(new Uint32Array(1))[0]), data, platform, settings})`.
- Wiring, only when `const ext = globalThis.browser ?? globalThis.chrome` has `runtime?.id`: all listeners are added at the top level, in the first turn. `action.onClicked` → `stumble`; `commands.onCommand`; `contextMenus.onClicked`; `runtime.onInstalled`; `runtime.onStartup` → `checkAccess`; `permissions.onAdded` and `onRemoved` → `checkAccess`; `tabs.onRemoved`. `runtime.onMessage` uses `(msg, sender, sendResponse)`. When `onMessage` returns a promise, it calls `sendResponse` with the result (or `{ok: false, reason: String(e)}`) and returns `true`. Otherwise it returns `false`.
- No state lives in module globals except the engine cache and the stumble chain. Everything a page needs is in `storage.session` or `storage.local`.

- [ ] **Step 5: Run the tests and see them pass**

Run: `node --test tests/unit/ext-bg.test.js`
Expected: PASS, 13 tests.

- [ ] **Step 6: Commit**

```bash
git add shells/extension/bg.js tests/unit/ext-bg.test.js
git commit -m "Add the extension background: toolbar Stumble, commands, menu and access checks"
```

<!-- PLAN CONTINUES -->
