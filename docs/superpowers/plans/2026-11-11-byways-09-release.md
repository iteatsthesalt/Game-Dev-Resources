# Byways 09: Release and Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Byways to friends: a tag-triggered GitHub Release with the APK, the extension zips, an optional signed Firefox `.xpi` and the GPL source archives, plus the notices, privacy policy, README, real-device checklist and a version rule that keeps every version number in step.

**Architecture:** One release workflow runs on a `byways-v*` tag. It reuses the existing build (`npm run build`) and the Android Gradle project, and adds two small Node tools: `tools/gpl-sources.js` fetches pinned upstream source archives, and a new `checkVersions` rule in `tools/check.js` fails `npm test` when the version numbers disagree. Documents are plain Markdown, and a unit test pins the facts in them that must not drift.

**Tech Stack:** Node 22 (`node:test`, `fetch`, `node:fs/promises`), GitHub Actions on `ubuntu-24.04`, the `gh` CLI, `web-ext@10.8.0`, Gradle 9.7.1 with AGP 9.3.2, `@playwright/test@1.63.0`.

**Spec:** `docs/superpowers/specs/2026-11-11-byways-design.md` (§11.3, §15, §17.3, §17.5, §19 M5, §20, §21). Shared contract: `docs/superpowers/plans/2026-11-11-byways-00-overview.md`. Research: `docs/superpowers/specs/byways-research/platform-shells.md` (release signing, web-ext, Releases) and `emulators.md` (licences).

## Global Constraints

- Everything in the overview's "Global constraints (every plan)" list applies. These are the ones that bite this plan:
- CI: `ubuntu-24.04`, `actions/checkout@v7`, `actions/setup-node@v4` (Node 22), `actions/setup-java@v6` (Temurin 21), `gradle/actions/setup-gradle@v6` (`cache-provider: basic`, `gradle-version: 9.7.1`). No Gradle wrapper is committed; CI runs `gradle`.
- Release trigger: a `byways-v*` tag. The job has `contents: write`. Friends can download from the Release without a GitHub account.
- Android signing secrets, exact names: `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS` and `KEY_PASSWORD`. Without them, attach the debug APK "with a warning that you must uninstall before updating".
- Firefox: with `AMO_API_KEY` and `AMO_API_SECRET`, run `web-ext sign --channel=unlisted` (pin `web-ext@10.8.0`).
- GPL source: "Each GitHub Release also attaches the upstream source archives of the GPL components at their pinned tags."
- Licences, verbatim from §11.3: js-dos GPL-2.0; EmulatorJS GPL-3.0, plus each core's licence (some are non-commercial); v86 BSD-2-Clause; SeaBIOS LGPLv3; Ruffle MIT or Apache-2.0; Atkinson Hyperlegible OFL. Byways' own code: MIT.
- "No ads or payments in the Lab, ever, because some cores have non-commercial licences."
- Privacy: "Nothing goes to a Byways server, because there is none. There are no analytics." `PRIVACY.md` "holds the same table and rules" as §15.1 and §15.2.
- Shared origin: "Every `iteatsthesalt.github.io` project shares one origin. A custom domain would isolate Byways."
- Emulator versions: js-dos 8.5.3, EmulatorJS 4.2.3, v86 0.5.473, Ruffle 0.7.1, fflate 0.8.3.
- Unit tests make no network calls. Live downloads happen only in the release workflow, whose runner has open network.
- No model identifiers in commit messages or code comments.

## Review Focus

1. **Version drift.** Someone bumps `package.json` but forgets the Android `versionCode`. Android then refuses the new APK as an update, or AMO rejects the `.xpi` as a duplicate version. Expected: `npm test` fails and names the file that disagrees. Pinned by `checkVersions flags a versionCode that does not match the version` (Task 2).
2. **A bad source archive.** Codeload returns an HTML error page or a cut-off body with status 200. Expected: the release fails loudly, rather than attaching a broken "source" file that does not meet the GPL duty. Pinned by `fetchSources rejects a body that is not gzip` (Task 1).
3. **Re-running a release for the same tag.** A failed run is re-run. `gh release create` fails because the Release exists, or AMO refuses to sign a version it already signed. Expected: the files are re-uploaded with `--clobber`, and a failed signing leaves a Release with a clear Firefox note instead of no Release. Pinned by `release workflow re-uploads to an existing release` and `release workflow keeps going when signing fails` (Task 3).
4. **A nested extension zip.** If the zip holds `chrome/manifest.json`, **Load unpacked** on the unzipped folder fails with "Manifest file is missing". Expected: `manifest.json` sits at the zip root. Pinned by `release workflow checks manifest.json is at the zip root` (Task 3).
5. **Stale notices after a version bump.** `versions.json` moves to a new emulator version, but `THIRD_PARTY_NOTICES.md` still lists the old one. Expected: `npm test` fails. Pinned by `notices list every pinned component at its pinned version` (Task 4).

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `Apps/Byways/tools/gpl-sources.js` | Create | Maps each GPL component in `versions.json` to an upstream repo and a pinned ref, downloads the archive from codeload, checks it, writes `dist/release/sources/` and `SOURCES.txt` |
| `Apps/Byways/tests/unit/gpl-sources.test.js` | Create | Unit tests with a fake `fetch` |
| `Apps/Byways/tools/check.js` | Modify | Adds `checkVersions(appRoot)` and runs it inside the existing check |
| `Apps/Byways/shells/android/gradle.properties` | Modify | Adds `byways.versionName` and `byways.versionCode` |
| `Apps/Byways/shells/android/app/build.gradle.kts` | Modify | Reads the two properties; adds the env-driven release signing config |
| `Apps/Byways/tests/unit/versions-agree.test.js` | Create | Tests for `checkVersions` |
| `.github/workflows/byways-release.yml` | Create | The tag-triggered release |
| `Apps/Byways/tests/unit/release-workflow.test.js` | Create | Text checks on the workflow and the Gradle signing block |
| `Apps/Byways/THIRD_PARTY_NOTICES.md` | Create or replace | Every shipped component: version, licence, source link, core notes |
| `Apps/Byways/PRIVACY.md` | Create | The §15.1 table and §15.2 rules, plus origin, voice, keys and analytics notes |
| `Apps/Byways/README.md` | Create or replace | What Byways is, install steps per version, one-time setup, cutting a release, local development |
| `Apps/Byways/CHECKLIST.md` | Create | The §20 real-device checklist as checkboxes grouped by device |
| `README.md` (repo root) | Modify | A short **Apps** section that links `Apps/Byways/README.md` |
| `Apps/Byways/tests/unit/docs.test.js` | Create | Pins the facts in the four documents |
| `Apps/Byways/tests/e2e/release-smoke.spec.js` | Create | Visits every route and the Lab with mocked network; no page errors |

<!-- PLAN CONTINUES -->
