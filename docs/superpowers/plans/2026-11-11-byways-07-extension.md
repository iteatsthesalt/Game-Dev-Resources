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

<!-- PLAN CONTINUES -->
