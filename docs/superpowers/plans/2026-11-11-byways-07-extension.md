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

<!-- PLAN CONTINUES -->
