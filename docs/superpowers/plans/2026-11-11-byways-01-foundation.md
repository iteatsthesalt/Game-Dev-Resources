# Byways 01: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Byways scaffold: core utilities, storage, the network layer, the web platform, the app shell with its registries, the build, check and serve tools, the test harness, and the Pages and CI workflows, ending in a deployable empty web app.

**Architecture:** Plain ES modules with no bundler. `src/core/**` holds DOM-free code tested with `node:test`. `src/ui/**` and `src/platform/**` hold the browser side, tested with Playwright against the built `dist/pwa/` served under `/Game-Dev-Resources/byways/`. `tools/build.js` copies `src/` and `shells/pwa/` into `dist/pwa/`, stamps the build id into `sw.js`, and writes the precache list. Later plans add screens only through the router, settings and first-run registries.

**Tech Stack:** Node 22, npm 10, `node:test`, `@playwright/test@1.63.0` (Chromium build 1243), `@axe-core/playwright@4.14.0`, `fake-indexeddb@6.2.8`, GitHub Actions, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-11-11-byways-design.md` (§1, §6.7, §13.1, §13.2, §14.1, §15.2, §16, §17.1, §17.2, §17.5, §18). **Contract:** `docs/superpowers/plans/2026-11-11-byways-00-overview.md`. Research: `byways-research/platform-shells.md`, `claude-browser.md`, `hands-free.md`.

## Global Constraints

- Everything in the overview's "Working conventions" and "Global constraints" applies. These bite this plan most:
- Web app CSP, verbatim in every app page's `<meta http-equiv="Content-Security-Policy">`: `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https: data: blob:; media-src 'self' https: blob:; frame-src https://archive.org https://*.archive.org; connect-src 'self' https: http://localhost:* http://127.0.0.1:*; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'`.
- Because `style-src 'self'` blocks inline styles, no HTML has a `style` attribute or `<style>` block, and no code sets the `style` attribute. CSS custom properties are set through `element.style.setProperty`, which CSP allows.
- "It is served at `/Game-Dev-Resources/byways/`, with relative URLs only." "`sw.js` and `manifest.webmanifest` sit in that folder, with `scope` and `start_url` set to `./`."
- "The service worker cache is versioned by the commit SHA, and an "Update available, reload" toast appears when a new version is ready." Cached: "the app shell (under 2 MB); data files (stale-while-revalidate)". "Archive thumbnails: not cached".
- "Text from outside is always rendered with `textContent`." "Links must be `http(s)` only." "Byways never uses `innerHTML`."
- "Targets: buttons are 56 px by default (never below 44 px), with a visible focus ring."
- "Live regions: one polite region (`role=status`) for "Now showing", "Saved" and "Listening paused". One assertive region for errors only."
- "Motion: respects reduced motion, with an in-app motion toggle that overrides the OS. Nothing flashes."
- "Every view is checked with axe-core in end-to-end tests. Any serious or critical issue fails the build."
- Store names: `settings, taste, collections, history, seen, cache, aiCache, usage, health, keys` in one IndexedDB database, `byways`.
- Requests never set `credentials: 'include'`. No test touches the real network: every non-`localhost:4321` request in e2e goes through `mockNet`.
- **Contract fix:** on Node 22, `node --test tests/unit/` fails with "Cannot find module …/tests/unit". The `test` script therefore runs `node --test "tests/unit/**/*.test.js"` (Node expands the quoted glob). The overview's script table should be updated to match.
- Commands run from `Apps/Byways/`. Keep every command under 500 characters with at most 10 statement separators.

## Review Focus

1. **A source hands back a `javascript:`, `data:` or `vbscript:` link.** `h('a', {href})` must drop it and never put it in the DOM. Pinned by `dom.spec.js` "h drops unsafe link schemes" (Task 11).
2. **IndexedDB is blocked or throws** (private windows, locked-down profiles). The app must still boot on a memory store and say so in the assertive region. Pinned by `shell.spec.js` "boots on a memory store when IndexedDB is blocked" (Task 12).
3. **A second visit with no network, or a browser that refuses service workers.** The shell must load offline after one online visit, and a rejected `register()` must not stop boot. Pinned by `sw.spec.js` "reloads offline from the cache" (Task 14) and `pwa.test.js` "registerServiceWorker survives a rejected register" (Task 7).
4. **A hand-edited or garbled hash, such as `#/daily/%E0%A4%A`, `#/nope` or `#s=`.** The router must not throw, and unknown routes go to Stumble. Pinned by `router.test.js` "parseHash never throws on malformed input" (Task 12).
5. **Stored settings from an older or broken build** (wrong types, `null` objects, out-of-range numbers). `loadSettings` must fall back per field and clamp ranges. Pinned by `settings.test.js` "loadSettings repairs bad stored values" (Task 6).

---

## File Structure

All paths are under `Apps/Byways/` unless they start with `.github/`.

| File | Responsibility |
|---|---|
| `package.json`, `package-lock.json`, `.gitignore`, `LICENSE`, `README.md` | Scaffold, pinned devDependencies, npm scripts |
| `src/core/types.js` | JSDoc typedefs from the overview, plus `Settings` |
| `src/core/util/hash.js`, `url.js`, `text.js`, `clock.js` | Pure helpers |
| `src/core/store/db.js`, `store/cache.js` | Store over IndexedDB or memory; TTL cache |
| `src/core/settings.js` | Defaults, load with repair, save |
| `src/core/net/errors.js`, `ratelimit.js`, `http.js` | `NetError`, limiter, HTTP client with retry and circuit |
| `src/platform/web-tts.js`, `web-media.js`, `web-voice.js`, `pwa.js` | Web `Platform` pieces and SW registration |
| `src/ui/dom.js`, `a11y.js`, `theme.js`, `toast.js` | DOM builder, live regions, access attributes, toasts |
| `src/ui/router.js`, `views/index.js`, `views/settings/index.js`, `firstrun.js`, `boot.js` | Routing and registries, startup |
| `src/ui/styles/app.css`, `styles/themes.css` | Layout, 56 px targets, focus ring, theme tokens, reduced motion |
| `src/data/tags.json`, `library.json`, `vault-starter.json`, `geocities-seeds.json` | Empty, valid data files; Plans 02 and 04 fill them |
| `src/assets/icons/icon.svg` | App icon |
| `shells/pwa/index.html`, `manifest.webmanifest`, `sw.js`, `landing/index.html` | PWA shell and the Pages-root landing page |
| `tools/build.js`, `tools/check.js`, `tools/serve.js` | Build targets, rule checks, static server |
| `tests/unit/*.test.js` | Unit tests |
| `tests/e2e/playwright.config.js`, `helpers/net.js`, `helpers/fakes.js`, `helpers/axe.js`, `*.spec.js` | E2E harness and specs |
| `tests/fixtures/routes.js`, `tests/fixtures/http/ping.json` | Network fixtures |
| `.github/workflows/byways.yml`, `.github/workflows/pages.yml` | CI and Pages deploy |

`tests/e2e/helpers/axe.js` is a new helper file inside `tests/e2e/**`; later plans import `expectNoSeriousA11y` from it.

**Import-time rule:** no module in `src/ui/` or `src/platform/` touches `window` or `document` at import time, so Node unit tests can import them. Only `bootFromShell()` runs on load, and only when `document.documentElement.dataset.shell` is set.

---

<!-- PLAN CONTINUES -->
