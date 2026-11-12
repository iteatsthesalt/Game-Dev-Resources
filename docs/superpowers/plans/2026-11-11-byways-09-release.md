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

---

### Task 1: GPL source fetcher

Each Release must carry the upstream source of the GPL parts at pinned refs. js-dos and EmulatorJS get a tag ref, then the commit their npm package was published from. Cores have no tag of their own, so the tool falls back to the default branch, resolved to a commit SHA at release time and named in `SOURCES.txt`.

**Files:**
- Create: `Apps/Byways/tools/gpl-sources.js`
- Test: `Apps/Byways/tests/unit/gpl-sources.test.js`

**Interfaces:**
- Consumes: `sha256Hex(data) → Promise<string>` from `src/core/util/hash.js`; the `src/versions.json` shape from the overview; `node_modules/@emulatorjs/core-<core>/package.json` (its `repository.url`, for example `git+https://github.com/EmulatorJS/libretro-fceumm.git`).
- Produces (all exported from `tools/gpl-sources.js`):
  - `CORE_LICENCES: Object<string,string>` = `{fceumm:'GPL-2.0', snes9x:'Snes9x licence (non-commercial)', gambatte:'GPL-2.0', mgba:'MPL-2.0', genesis_plus_gx:'Genesis Plus GX licence (non-commercial)', stella2014:'GPL-2.0', pcsx_rearmed:'GPL-2.0'}`. Task 4 uses it.
  - `parseRepoUrl(url: string) → string|null`, returning `'owner/name'` for a GitHub URL.
  - `sourceTargets(versions, {readCorePackage: (core) => object}) → Target[]`, where `Target = {id, name, licence, repo, refs: string[], resolveHead: boolean}`.
  - `codeloadUrl(repo, ref) → string`.
  - `fetchSources(targets, {fetch, outDir, writeFile}) → Promise<Result[]>`, where `Result = {id, repo, ref, pinned: 'tag'|'commit'|'head', file, licence, bytes, sha256}`.
  - `sourcesManifest(results) → string`.
  - CLI: `node tools/gpl-sources.js --out <dir>` reads `src/versions.json` and the core packages, creates `<dir>`, writes every archive and `<dir>/SOURCES.txt`, and exits 1 with the error message on any failure.

Fixed data inside the file:

| id | name | repo | refs, in order |
|---|---|---|---|
| `js-dos` | js-dos | `caiiiycuk/js-dos` | `v<ver>`, `<ver>`, then `506dfd2a99f56bc4e393a716125ae94e58eb3fba` only while `versions.jsdos.version === '8.5.3'` |
| `emulatorjs` | EmulatorJS | `EmulatorJS/EmulatorJS` | `v<ver>`, `<ver>`, then `e150dc0491ae747028919fb82d6598954976ede6` only while `versions.emulatorjs.version === '4.2.3'` |
| `core-<core>` | `<core>` core | from `parseRepoUrl(readCorePackage(core).repository.url)` | `v<emulatorjs ver>`, `<emulatorjs ver>`, and `resolveHead: true` |

Cores come from `Object.values(versions.emulatorjs.cores)`, de-duplicated, in first-seen order. Only cores whose `CORE_LICENCES` value starts with `GPL` get a target. The licence of js-dos is `GPL-2.0` and of EmulatorJS `GPL-3.0`.

- [ ] **Step 1: Write the failing tests**

Use a fake `fetch` that looks up `routes[url]` (`{status, body, text}`), records each `{url, headers}` call, and returns `new Response(body, {status})`. A 404 is the default. `GZ = new Uint8Array([0x1f, 0x8b, 8, 0, 1, 2, 3])`. `versions` is the overview's `versions.json` example. `pkg = (core) => ({repository: {url: 'git+https://github.com/EmulatorJS/libretro-' + core + '.git'}})`. `writes` collects `[path, bytes]` from a fake `writeFile`.

```js
test('parseRepoUrl reads npm repository urls', () => {
  assert.equal(parseRepoUrl('git+https://github.com/EmulatorJS/libretro-fceumm.git'), 'EmulatorJS/libretro-fceumm');
  assert.equal(parseRepoUrl('https://github.com/a/b'), 'a/b');
  assert.equal(parseRepoUrl('github:a/b'), 'a/b');
  assert.equal(parseRepoUrl('https://gitlab.com/a/b'), null);
});
test('sourceTargets lists js-dos, EmulatorJS and the GPL cores once each', () => {
  const t = sourceTargets(versions, {readCorePackage: pkg});
  assert.deepEqual(t.map(x => x.id), ['js-dos', 'emulatorjs', 'core-fceumm', 'core-gambatte', 'core-stella2014', 'core-pcsx_rearmed']);
  assert.deepEqual(t[0].refs, ['v8.5.3', '8.5.3', '506dfd2a99f56bc4e393a716125ae94e58eb3fba']);
  assert.equal(t[1].licence, 'GPL-3.0');
  assert.deepEqual(t[2], {id: 'core-fceumm', name: 'fceumm core', licence: 'GPL-2.0',
    repo: 'EmulatorJS/libretro-fceumm', refs: ['v4.2.3', '4.2.3'], resolveHead: true});
});
test('sourceTargets drops the pinned commit when the version moves', () => {
  const v = structuredClone(versions); v.jsdos.version = '8.6.0';
  assert.deepEqual(sourceTargets(v, {readCorePackage: pkg})[0].refs, ['v8.6.0', '8.6.0']);
});
test('sourceTargets throws on a core with no known licence', () => {
  const v = structuredClone(versions); v.emulatorjs.cores.n64 = 'mupen64plus_next';
  assert.throws(() => sourceTargets(v, {readCorePackage: pkg}), /unknown core licence: mupen64plus_next/);
});
test('sourceTargets throws when a core package has no GitHub repository', () => {
  assert.throws(() => sourceTargets(versions, {readCorePackage: () => ({})}), /no GitHub repository for core fceumm/);
});
test('codeloadUrl builds the tarball url', () => {
  assert.equal(codeloadUrl('EmulatorJS/EmulatorJS', 'v4.2.3'), 'https://codeload.github.com/EmulatorJS/EmulatorJS/tar.gz/v4.2.3');
});
test('fetchSources falls back to the next ref on 404', async () => {
  // routes: .../EmulatorJS/tar.gz/v4.2.3 → 404, .../tar.gz/4.2.3 → 200 GZ
  const [r] = await fetchSources([emuTarget], {fetch, outDir: '/out', writeFile});
  assert.equal(r.ref, '4.2.3'); assert.equal(r.pinned, 'tag');
  assert.equal(r.file, 'emulatorjs-4.2.3.tar.gz'); assert.equal(r.bytes, 7);
  assert.equal(writes[0][0], path.join('/out', 'emulatorjs-4.2.3.tar.gz'));
});
test('fetchSources rejects an empty archive', async () => {
  // js-dos v8.5.3 → 200 with an empty body
  await assert.rejects(fetchSources([jsdosTarget], deps), /empty archive for js-dos/);
});
test('fetchSources rejects a body that is not gzip', async () => {
  // js-dos v8.5.3 → 200 with body '<html>busy</html>'
  await assert.rejects(fetchSources([jsdosTarget], deps), /not a gzip archive for js-dos/);
  assert.equal(writes.length, 0);
});
test('fetchSources stops on a server error', async () => {
  // js-dos v8.5.3 → 500
  await assert.rejects(fetchSources([jsdosTarget], deps), /source download failed for js-dos: HTTP 500/);
  assert.equal(calls.length, 1);
});
test('fetchSources resolves the default branch for a core with no tag', async () => {
  // both tag refs → 404; https://api.github.com/repos/EmulatorJS/libretro-fceumm/commits/HEAD → 200 text 'a'.repeat(40) + '\n'
  const [r] = await fetchSources([fceummTarget], deps);
  assert.equal(r.ref, 'a'.repeat(40)); assert.equal(r.pinned, 'head');
  assert.equal(calls[2].headers.Accept, 'application/vnd.github.sha');
  assert.equal(calls[3].url, codeloadUrl('EmulatorJS/libretro-fceumm', 'a'.repeat(40)));
});
test('fetchSources names every ref it tried', async () => {
  await assert.rejects(fetchSources([jsdosTarget], deps),
    /no source archive for js-dos: tried v8\.5\.3, 8\.5\.3, 506dfd2a99f56bc4e393a716125ae94e58eb3fba/);
});
test('sourcesManifest lists file, source, licence and hash', () => {
  const text = sourcesManifest([{id: 'js-dos', repo: 'caiiiycuk/js-dos', ref: 'v8.5.3', pinned: 'tag',
    file: 'js-dos-v8.5.3.tar.gz', licence: 'GPL-2.0', bytes: 7, sha256: 'ab'.repeat(32)}]);
  assert.ok(text.startsWith('# Byways GPL source archives\n'));
  assert.ok(text.includes('js-dos-v8.5.3.tar.gz  https://github.com/caiiiycuk/js-dos/tree/v8.5.3  GPL-2.0  sha256:' + 'ab'.repeat(32)));
});
```

`jsdosTarget`, `emuTarget` and `fceummTarget` are the matching entries of `sourceTargets(versions, {readCorePackage: pkg})`.

- [ ] **Step 2: Run the tests and see them fail**

Run: `node --test tests/unit/gpl-sources.test.js`
Expected: FAIL with `Cannot find module` for `tools/gpl-sources.js`.

- [ ] **Step 3: Implement `tools/gpl-sources.js`**

`codeloadUrl(repo, ref)` returns `https://codeload.github.com/<repo>/tar.gz/<ref>`. In `fetchSources`, for each target, try each ref in order:
- A 404 moves on to the next ref.
- Any other status of 400 or more throws `source download failed for <id>: HTTP <status>`.
- A 200 body with 0 bytes throws `empty archive for <id>`. A body whose first two bytes are not `0x1f 0x8b` throws `not a gzip archive for <id>`.
- On success, write `<outDir>/<id>-<ref>.tar.gz` and record `pinned`: `'tag'` for the first two refs and `'commit'` for the third.

When every ref is a 404 and `resolveHead` is true, GET `https://api.github.com/repos/<repo>/commits/HEAD` with `Accept: application/vnd.github.sha`. The trimmed text must match `/^[0-9a-f]{40}$/`, or the call throws `cannot resolve the default branch of <repo>`. Then download that SHA with the same checks and `pinned: 'head'`. Otherwise throw `no source archive for <id>: tried <refs joined by ', '>`.

`sourcesManifest` writes the header line, then one line per result: `<file>  https://github.com/<repo>/tree/<ref>  <licence>  sha256:<hex>`. A `head` line ends with `  (default branch at release time)`. Run the CLI only when `import.meta.url === pathToFileURL(process.argv[1]).href`.

- [ ] **Step 4: Run the tests and see them pass**

Run: `node --test tests/unit/gpl-sources.test.js`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add tools/gpl-sources.js tests/unit/gpl-sources.test.js
git commit -m "Add the GPL source archive fetcher for releases"
```

---

### Task 2: Version agreement rule

One version, `x.y.z` in `package.json`, drives every shell. The Android `versionCode` is derived as `x·10000 + y·100 + z`, so it always grows.

**Files:**
- Modify: `Apps/Byways/tools/check.js` (add `checkVersions`, and call it from the existing check run)
- Modify: `Apps/Byways/shells/android/gradle.properties` (add two properties)
- Modify: `Apps/Byways/shells/android/app/build.gradle.kts` (`defaultConfig` reads them)
- Test: `Apps/Byways/tests/unit/versions-agree.test.js`

**Interfaces:**
- Consumes: `package.json` `version`; `shells/extension/manifest.base.json` `version`; the overlays `manifest.chrome.json` and `manifest.firefox.json`; `shells/android/gradle.properties`.
- Produces: `checkVersions(appRoot: string) → Promise<string[]>`, exported from `tools/check.js`. It returns error strings and an empty array when everything agrees. Gradle properties `byways.versionName` and `byways.versionCode`.

Exact error strings (`<v>` is the `package.json` version):
- `package.json version <v> must be x.y.z with each part below 100`. When this fires, return only this error.
- `shells/extension/manifest.base.json has version <m>, package.json has <v>`
- `shells/extension/manifest.<chrome|firefox>.json must not set version`
- `shells/android/gradle.properties is missing byways.versionName` (or `byways.versionCode`)
- `shells/android/gradle.properties has byways.versionName <n>, package.json has <v>`
- `shells/android/gradle.properties has byways.versionCode <c>, expected <x·10000+y·100+z> for <v>`

- [ ] **Step 1: Write the failing tests**

`writeApp(over)` makes a temp folder with `fs.mkdtemp(path.join(os.tmpdir(), 'byways-ver-'))`. It writes the four files, with defaults `pkg {version:'1.2.3'}`, `base {manifest_version:3, version:'1.2.3'}`, `chrome {}`, `firefox {}` and `gradle 'byways.versionName=1.2.3\nbyways.versionCode=10203\n'`, merges `over`, and returns the folder.

```js
test('checkVersions accepts agreeing versions', async () => {
  assert.deepEqual(await checkVersions(await writeApp({})), []);
});
test('checkVersions flags a manifest that disagrees', async () => {
  assert.deepEqual(await checkVersions(await writeApp({base: {manifest_version: 3, version: '1.2.2'}})),
    ['shells/extension/manifest.base.json has version 1.2.2, package.json has 1.2.3']);
});
test('checkVersions flags a versionCode that does not match the version', async () => {
  assert.deepEqual(await checkVersions(await writeApp({gradle: 'byways.versionName=1.2.3\nbyways.versionCode=10202\n'})),
    ['shells/android/gradle.properties has byways.versionCode 10202, expected 10203 for 1.2.3']);
});
test('checkVersions flags a versionName that disagrees', async () => {
  assert.deepEqual(await checkVersions(await writeApp({gradle: 'byways.versionName=1.2.4\nbyways.versionCode=10203\n'})),
    ['shells/android/gradle.properties has byways.versionName 1.2.4, package.json has 1.2.3']);
});
test('checkVersions flags a missing property', async () => {
  assert.deepEqual(await checkVersions(await writeApp({gradle: 'byways.versionName=1.2.3\n'})),
    ['shells/android/gradle.properties is missing byways.versionCode']);
});
test('checkVersions flags an overlay that sets its own version', async () => {
  assert.deepEqual(await checkVersions(await writeApp({chrome: {version: '9.9.9'}})),
    ['shells/extension/manifest.chrome.json must not set version']);
});
test('checkVersions rejects a version that is not plain x.y.z', async () => {
  for (const v of ['1.2.3-beta', '1.100.0', '1.2']) {
    assert.deepEqual(await checkVersions(await writeApp({pkg: {version: v}})),
      [`package.json version ${v} must be x.y.z with each part below 100`]);
  }
});
test('checkVersions passes on the real app', async () => {
  assert.deepEqual(await checkVersions(fileURLToPath(new URL('../..', import.meta.url))), []);
});
test('the Android build reads its version from gradle.properties', async () => {
  const kts = await readFile(new URL('../../shells/android/app/build.gradle.kts', import.meta.url), 'utf8');
  assert.ok(kts.includes('versionCode = providers.gradleProperty("byways.versionCode").get().toInt()'));
  assert.ok(kts.includes('versionName = providers.gradleProperty("byways.versionName").get()'));
});
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `node --test tests/unit/versions-agree.test.js`
Expected: FAIL with `checkVersions is not a function` (or "does not provide an export named 'checkVersions'").

- [ ] **Step 3: Implement `checkVersions(appRoot)` in `tools/check.js`, and add the Gradle properties**

Parse `gradle.properties` line by line as `key=value`, ignoring `#` comments and blank lines. Call `await checkVersions(appRoot)` inside the existing check run, and add each string to the errors it already reports, so `npm test` fails on drift. Append `byways.versionName=<current package.json version>` and `byways.versionCode=<derived code>` to `gradle.properties`. In `app/build.gradle.kts` `defaultConfig`, replace the existing `versionCode` and `versionName` lines with the two lines the last test asserts. Do not change the version itself in this task.

- [ ] **Step 4: Run the tests, then the full check**

Run: `node --test tests/unit/versions-agree.test.js`
Expected: PASS, 9 tests.
Run: `npm run check`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add tools/check.js shells/android/gradle.properties shells/android/app/build.gradle.kts tests/unit/versions-agree.test.js
git commit -m "Check that every version number agrees"
```

---

### Task 3: Release workflow and Android release signing

Nothing here can run on this machine: there is no Android SDK and no open network. So a unit test pins the workflow's text, and the real check is the first tag push in GitHub Actions.

**Files:**
- Create: `.github/workflows/byways-release.yml` (at the repo root)
- Modify: `Apps/Byways/shells/android/app/build.gradle.kts` (add the `release` signing config)
- Test: `Apps/Byways/tests/unit/release-workflow.test.js`

**Interfaces:**
- Consumes: `npm test` and `npm run build` (overview); the `node tools/gpl-sources.js --out <dir>` CLI (Task 1); the build outputs `dist/chrome/`, `dist/firefox/` and `shells/android/app/build/outputs/apk/{release,debug}/app-{release,debug}.apk`; Task 2's version rule.
- Produces: the environment variable `BYWAYS_KEYSTORE_PATH`, which the Gradle build reads. Release file names, where `<V>` is the version: `byways-<V>.apk` (signed) or `byways-<V>-debug.apk`, `byways-chrome-<V>.zip`, `byways-firefox-<V>.zip`, `byways-firefox-<V>.xpi` (when signed), the GPL `*.tar.gz` archives and `SOURCES.txt`. Task 5's README names these files.

- [ ] **Step 1: Write the failing tests**

`wf` is the text of `new URL('../../../../.github/workflows/byways-release.yml', import.meta.url)`. `kts` is the text of `shells/android/app/build.gradle.kts`.

```js
const DEBUG_WARNING = '**Warning:** this APK is a debug build. Uninstall any earlier Byways APK before you install it. Export a backup first (Settings → Data), because uninstalling deletes your saved finds.';
const FIREFOX_NOTE = '**Firefox:** there is no signed .xpi in this release. Unzip byways-firefox-$VERSION.zip and load it as a temporary add-on (see the README). It goes away when Firefox restarts.';
test('release workflow runs on byways tags with contents write', () => {
  assert.ok(wf.includes("tags: ['byways-v*']"));
  assert.match(wf, /permissions:\n  contents: write/);
});
test('release workflow pins the CI actions', () => {
  for (const s of ['runs-on: ubuntu-24.04', 'actions/checkout@v7', 'actions/setup-node@v4', 'actions/setup-java@v6',
    'gradle/actions/setup-gradle@v6', 'cache-provider: basic', 'gradle-version: 9.7.1']) assert.ok(wf.includes(s), s);
});
test('release workflow checks the tag against package.json', () => {
  assert.ok(wf.includes('test "byways-v$V" = "$GITHUB_REF_NAME"'));
});
test('release workflow signs only when the keystore secrets exist', () => {
  for (const s of ["HAS_KEYSTORE: ${{ secrets.KEYSTORE_BASE64 != '' }}", "if: env.HAS_KEYSTORE == 'true'",
    "if: env.HAS_KEYSTORE != 'true'", 'secrets.KEYSTORE_PASSWORD', 'secrets.KEY_ALIAS', 'secrets.KEY_PASSWORD',
    'gradle -p shells/android assembleRelease', 'gradle -p shells/android assembleDebug']) assert.ok(wf.includes(s), s);
});
test('release workflow warns about the debug APK', () => { assert.ok(wf.includes(DEBUG_WARNING)); });
test('release workflow checks manifest.json is at the zip root', () => {
  for (const b of ['chrome', 'firefox'])
    assert.ok(wf.includes(`unzip -Z1 "dist/release/upload/byways-${b}-$VERSION.zip" | grep -qx manifest.json`), b);
});
test('release workflow keeps going when signing fails', () => {
  for (const s of ['npx --yes web-ext@10.8.0 sign', '--channel=unlisted', 'continue-on-error: true',
    'XPI_OUTCOME: ${{ steps.xpi.outcome }}', FIREFOX_NOTE]) assert.ok(wf.includes(s), s);
});
test('release workflow attaches the GPL sources', () => {
  assert.ok(wf.includes('node tools/gpl-sources.js --out dist/release/sources'));
});
test('release workflow re-uploads to an existing release', () => {
  assert.ok(wf.includes('gh release upload "$GITHUB_REF_NAME" dist/release/upload/* --clobber'));
  assert.ok(wf.includes('gh release create "$GITHUB_REF_NAME" dist/release/upload/*'));
});
test('the Android release build signs from the environment', () => {
  for (const s of ['System.getenv("BYWAYS_KEYSTORE_PATH")', 'System.getenv("KEYSTORE_PASSWORD")',
    'System.getenv("KEY_ALIAS")', 'System.getenv("KEY_PASSWORD")']) assert.ok(kts.includes(s), s);
});
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `node --test tests/unit/release-workflow.test.js`
Expected: FAIL with `ENOENT` for `byways-release.yml`.

- [ ] **Step 3: Write `.github/workflows/byways-release.yml`**

The job-level `env` turns the secrets into flags, because `if:` cannot read `secrets` directly. Each step's own `env` passes the secret values in.

```yaml
name: byways-release
on:
  push:
    tags: ['byways-v*']
permissions:
  contents: write
concurrency:
  group: byways-release-${{ github.ref_name }}
jobs:
  release:
    runs-on: ubuntu-24.04
    defaults:
      run:
        working-directory: Apps/Byways
    env:
      HAS_KEYSTORE: ${{ secrets.KEYSTORE_BASE64 != '' }}
      HAS_AMO: ${{ secrets.AMO_API_KEY != '' && secrets.AMO_API_SECRET != '' }}
      GH_TOKEN: ${{ github.token }}
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm, cache-dependency-path: Apps/Byways/package-lock.json }
      - uses: actions/setup-java@v6
        with: { distribution: temurin, java-version: 21 }
      - uses: gradle/actions/setup-gradle@v6
        with: { cache-provider: basic, gradle-version: 9.7.1 }
      - name: Check the tag matches the version
        run: |
          V=$(node -p "require('./package.json').version")
          test "byways-v$V" = "$GITHUB_REF_NAME"
          echo "VERSION=$V" >> "$GITHUB_ENV"
          mkdir -p dist/release/upload
      - run: npm ci
      - run: npm test
      - run: npm run build
```

The remaining steps, in this order (write each `run` exactly as the tests pin it):

| Step | `if` / extras | `run` |
|---|---|---|
| Signed APK | `if: env.HAS_KEYSTORE == 'true'`; `env:` the four `secrets.*` values | `echo "$KEYSTORE_BASE64" \| base64 -d > "$RUNNER_TEMP/byways.jks"`, then `BYWAYS_KEYSTORE_PATH="$RUNNER_TEMP/byways.jks" gradle -p shells/android assembleRelease`, then copy `app-release.apk` to `dist/release/upload/byways-$VERSION.apk` |
| Debug APK | `if: env.HAS_KEYSTORE != 'true'` | `gradle -p shells/android assembleDebug`, then copy `app-debug.apk` to `dist/release/upload/byways-$VERSION-debug.apk` |
| Zip the extensions | none | `(cd dist/chrome && zip -qr "../release/upload/byways-chrome-$VERSION.zip" .)`, the same for `firefox`, then the two `unzip -Z1 … \| grep -qx manifest.json` lines |
| Sign the Firefox add-on | `id: xpi`, `if: env.HAS_AMO == 'true'`, `continue-on-error: true`, `env:` both AMO secrets | `npx --yes web-ext@10.8.0 sign --source-dir dist/firefox --artifacts-dir dist/release/xpi --channel=unlisted --api-key "$AMO_API_KEY" --api-secret "$AMO_API_SECRET"`, then copy `dist/release/xpi/*.xpi` to `dist/release/upload/byways-firefox-$VERSION.xpi` |
| GPL source archives | none | `node tools/gpl-sources.js --out dist/release/sources`, then `cp dist/release/sources/* dist/release/upload/` |
| Release notes | `env: { XPI_OUTCOME: ${{ steps.xpi.outcome }} }` | write `dist/release/NOTES.md` (below) |
| Publish | none | if `gh release view "$GITHUB_REF_NAME"` succeeds: `gh release upload "$GITHUB_REF_NAME" dist/release/upload/* --clobber`, then `gh release edit "$GITHUB_REF_NAME" --notes-file dist/release/NOTES.md`. Otherwise: `gh release create "$GITHUB_REF_NAME" dist/release/upload/* --title "Byways $VERSION" --notes-file dist/release/NOTES.md` |

`NOTES.md` holds these lines, where `$APK` is `byways-$VERSION.apk` when `HAS_KEYSTORE` is `true` and `byways-$VERSION-debug.apk` otherwise:

```
## Byways $VERSION

- Web app: https://iteatsthesalt.github.io/Game-Dev-Resources/byways/
- Chrome and Edge: unzip byways-chrome-$VERSION.zip, then use Load unpacked. See the README.
- Firefox: byways-firefox-$VERSION.xpi when it is attached, or the zip as a temporary add-on.
- Android: $APK
- Source for the GPL parts: the .tar.gz files, listed in SOURCES.txt.
```

Then add the `DEBUG_WARNING` line when `HAS_KEYSTORE` is not `true`, and the `FIREFOX_NOTE` line when `XPI_OUTCOME` is not `success`. That covers both "no secrets" (`skipped`) and "AMO refused" (`failure`). Use the exact strings from the test.

- [ ] **Step 4: Add the release signing config to `shells/android/app/build.gradle.kts`**

Inside `android { }`, add a `signingConfigs { create("release") { … } }` block. When `System.getenv("BYWAYS_KEYSTORE_PATH")` is not null, it sets `storeFile = file(<that path>)`, `storePassword = System.getenv("KEYSTORE_PASSWORD")`, `keyAlias = System.getenv("KEY_ALIAS")` and `keyPassword = System.getenv("KEY_PASSWORD")`. In `buildTypes { release { } }`, set `signingConfig = signingConfigs.getByName("release")` only when that path is set. If Plan 08 already added a release signing config, change it to read these names instead of adding a second one.

- [ ] **Step 5: Run the tests and see them pass**

Run: `node --test tests/unit/release-workflow.test.js`
Expected: PASS, 10 tests.

- [ ] **Step 6: Commit**

```bash
git add ../../.github/workflows/byways-release.yml shells/android/app/build.gradle.kts tests/unit/release-workflow.test.js
git commit -m "Add the tag-triggered release workflow"
```

- [ ] **Step 7: Verify in GitHub Actions (the owner, after merge)**

Push a tag `byways-v<version>` that matches `package.json`.
Expected: the `byways-release` run is green, and the Release lists one APK, two zips, the `.xpi` (only when the AMO secrets exist), 6 `.tar.gz` archives and `SOURCES.txt`. If the keystore secrets are absent, the notes carry the debug warning. If the run fails at "GPL source archives", the log names the component and every ref it tried.

---

### Task 4: Third-party notices and privacy policy

**Files:**
- Modify: `Apps/Byways/THIRD_PARTY_NOTICES.md` (create it if Plan 06 has not)
- Create: `Apps/Byways/PRIVACY.md`
- Test: `Apps/Byways/tests/unit/docs.test.js`

**Interfaces:**
- Consumes: `CORE_LICENCES` from `tools/gpl-sources.js` (Task 1); `src/versions.json`; the `repository.url` of each installed `@emulatorjs/core-<core>` package, for the core source links.
- Produces: the two documents. The in-app Licenses screen (Plan 06) and the Privacy settings section (Plan 01/02) keep their own text, so this task does not touch them.

- [ ] **Step 1: Write the failing tests**

`read(rel)` returns the text of `new URL('../../' + rel, import.meta.url)`. `versions` is the parsed `src/versions.json`.

```js
test('notices list every pinned component at its pinned version', () => {
  const lines = read('THIRD_PARTY_NOTICES.md').split('\n');
  for (const [name, v] of [['js-dos', versions.jsdos.version], ['EmulatorJS', versions.emulatorjs.version],
      ['v86', versions.v86.version], ['Ruffle', versions.ruffle.version], ['fflate', versions.fflate.version]])
    assert.ok(lines.some(l => l.startsWith('| ' + name + ' |') && l.includes('| ' + v + ' |')), name + ' ' + v);
});
test('notices give each core its licence and source', () => {
  const lines = read('THIRD_PARTY_NOTICES.md').split('\n');
  for (const core of new Set(Object.values(versions.emulatorjs.cores)))
    assert.ok(lines.some(l => l.startsWith('| ' + core + ' |') && l.includes(CORE_LICENCES[core]) && l.includes('https://github.com/')), core);
});
test('notices state the licences from the spec', () => {
  const t = read('THIRD_PARTY_NOTICES.md');
  for (const s of ['GPL-2.0', 'GPL-3.0', 'BSD-2-Clause', 'LGPLv3', 'MIT OR Apache-2.0', 'OFL-1.1', versions.v86.commit,
    'No ads or payments in the Lab, ever, because some cores have non-commercial licences.']) assert.ok(t.includes(s), s);
});
const NETWORK = [
  ['You stumble or browse', 'Only the enabled sources and the site you open'],
  ['Link check (if on)', 'The find\'s site, before it is shown'],
  ['AI Search or AI team', 'Only the providers you set up, with your query, your tags and recent domains'],
  ['Cloud voice (only if you opted in)', 'Google, Apple or Microsoft, depending on your browser'],
  ['Vault play', 'archive.org'],
  ['Daily data', 'The Byways Pages site (static files)'],
  ['Android update check', 'api.github.com']];
test('privacy holds the network table from the spec', () => {
  const t = read('PRIVACY.md');
  for (const [when, to] of NETWORK) assert.ok(t.includes(`| ${when} | ${to} |`), when);
});
test('privacy states there is no server and no analytics', () => {
  assert.ok(read('PRIVACY.md').includes('Nothing goes to a Byways server, because there is none. There are no analytics.'));
});
test('privacy explains the shared origin, voice vendors and keys', () => {
  const t = read('PRIVACY.md');
  for (const s of ['Every `iteatsthesalt.github.io` project shares one origin. A custom domain would isolate Byways.',
    'Google, Apple or Microsoft', 'A key is sent only to its own provider\'s host.', '600,000']) assert.ok(t.includes(s), s);
});
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `node --test tests/unit/docs.test.js`
Expected: FAIL. The notices tests fail on the first missing component, and the privacy tests fail with `ENOENT` for `PRIVACY.md`.

- [ ] **Step 3: Write `THIRD_PARTY_NOTICES.md`**

Sections, in order:
1. **Byways**: MIT, with a link to `LICENSE`.
2. **Components**: a table `| Component | Version | Licence | Source |`. The rows are:
   - `js-dos`, `GPL-2.0`, `https://github.com/caiiiycuk/js-dos`;
   - `EmulatorJS`, `GPL-3.0`, `https://github.com/EmulatorJS/EmulatorJS`;
   - `v86`, `BSD-2-Clause`, `https://github.com/copy/v86`;
   - `SeaBIOS and VGABIOS`, version `—`, `LGPLv3`, `https://www.seabios.org/` plus `https://github.com/copy/v86/tree/<v86.commit>/bios`;
   - `Ruffle`, `MIT OR Apache-2.0`, `https://github.com/ruffle-rs/ruffle`;
   - `fflate`, `MIT`, `https://github.com/101arrowz/fflate`;
   - `Atkinson Hyperlegible`, the version in the vendored font's `OFL.txt` or name table, `OFL-1.1`, `https://github.com/googlefonts/atkinson-hyperlegible`.
   
   Each version comes from `versions.json`.
3. **EmulatorJS cores**: a table `| Core | Systems | Licence | Source |`. It has one row per core in `versions.emulatorjs.cores`. The systems are the keys that map to that core, the licence is the `CORE_LICENCES` value, and the source is the core package's `repository.url` as an `https://github.com/…` link.
4. **Non-commercial cores**: snes9x and genesis_plus_gx are under non-commercial licences. Add the exact sentence `No ads or payments in the Lab, ever, because some cores have non-commercial licences.`
5. **Source code**: each GitHub Release attaches the upstream source archives of the GPL components at their pinned tags, and lists them in `SOURCES.txt`. The emulators run unmodified, each inside its own runner page. Licence texts are inside each source archive and on the in-app **Licenses** screen.

- [ ] **Step 4: Write `PRIVACY.md`**

Sections, in order:
1. **The promise**, from §1: "There is no Byways server. Your keys, collections and history are stored only on this device. Network calls go only to the sources and AI providers you turn on."
2. **What goes over the network, and when**: a table `| When | To |` with the seven `NETWORK` rows, worded exactly as in the test, then the sentence `Nothing goes to a Byways server, because there is none. There are no analytics.` Add one line saying there are no ads, no sponsored finds and no ranking by engagement.
3. **What stays on this device**: the one IndexedDB database `byways` and its stores (§14.1). The extension keeps keys in `chrome.storage.local`. The three versions keep separate storage.
4. **Rules**: the five §15.2 bullets in plain words (text through `textContent`; `http(s)` links, images only through `<img>`; only `archive.org` embeds, only after **Play**; pinned, vendored third-party code; no CDN code at runtime).
5. **Keys**: `A key is sent only to its own provider's host.` Keys never go into exports (unless you choose), share links or logs. The optional passphrase lock uses AES-GCM with a PBKDF2-SHA-256 key (600,000 iterations).
6. **Voice**: voice stays on the device where it can (desktop Chrome and Edge 139+, Firefox 160+, and the Android recogniser when it is on-device). Cloud voice goes to Google, Apple or Microsoft only after a consent screen that names the company. The microphone grant is per origin.
7. **The shared origin**: the exact sentence from the test. It also says the Lab shares that origin in the web app, and that the passphrase lock protects keys from it.
8. **Identification header**: Wikimedia and the Art Institute get `Byways/<version> (+https://github.com/iteatsthesalt/Game-Dev-Resources)`, which never carries user details.
9. **Questions**: open an issue on the GitHub repo.

- [ ] **Step 5: Run the tests and see them pass**

Run: `node --test tests/unit/docs.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add THIRD_PARTY_NOTICES.md PRIVACY.md tests/unit/docs.test.js
git commit -m "Write the third-party notices and the privacy policy"
```

---

### Task 5: README, root README entry and real-device checklist

**Files:**
- Modify: `Apps/Byways/README.md` (create or replace it with the full version)
- Create: `Apps/Byways/CHECKLIST.md`
- Modify: `README.md` at the repo root (add an `## Apps` section between `## Editors and tools` and `## Guides`)
- Modify: `Apps/Byways/tests/unit/docs.test.js` (add tests)

**Interfaces:**
- Consumes: the Release file names (Task 3); the version rule (Task 2); the serve command and npm scripts (overview); `DEBUG_WARNING` wording (Task 3).
- Produces: documents only.

- [ ] **Step 1: Write the failing tests (append to `docs.test.js`)**

`readRoot(rel)` reads from `new URL('../../../../' + rel, import.meta.url)`.

```js
test('readme gives install steps for every version', () => {
  const t = read('README.md');
  for (const s of ['https://iteatsthesalt.github.io/Game-Dev-Resources/byways/', 'Load unpacked', 'byways-chrome-',
    'about:debugging#/runtime/this-firefox', 'Load Temporary Add-on', '.xpi', 'Install unknown apps',
    'Uninstall any earlier Byways APK before you install it.']) assert.ok(t.includes(s), s);
});
test('readme lists the one-time setup', () => {
  const t = read('README.md');
  for (const s of ['Settings → Pages → Build and deployment', 'GitHub Actions', 'KEYSTORE_BASE64', 'KEYSTORE_PASSWORD',
    'KEY_ALIAS', 'KEY_PASSWORD', 'AMO_API_KEY', 'AMO_API_SECRET']) assert.ok(t.includes(s), s);
});
test('readme explains the version bump and the release', () => {
  const t = read('README.md');
  for (const s of ['package.json', 'manifest.base.json', 'byways.versionName', 'byways.versionCode',
    'x·10000 + y·100 + z', 'git tag byways-v', 'npm test', 'npm run e2e',
    'node tools/serve.js --root dist/pwa --base /Game-Dev-Resources/byways/ --port 4321']) assert.ok(t.includes(s), s);
});
test('checklist covers every real-device item from the spec', () => {
  const t = read('CHECKLIST.md');
  for (const h of ['## Desktop Chrome', '## Desktop Edge', '## Firefox', '## Extension (Chrome and Edge)', '## Android phone'])
    assert.ok(t.includes(h), h);
  for (const s of ['Speech output', 'side panel', 'Firefox 160', 'processLocally', 'local network', 'Media Session',
    'Fullscreen', 'segmented', 'module background']) assert.ok(t.includes(s), s);
  assert.ok(t.split('\n').filter(l => l.startsWith('- [ ] ')).length >= 10);
});
test('root readme links Byways', () => {
  const t = readRoot('README.md');
  assert.ok(t.includes('## Apps'));
  assert.ok(t.includes('(./Apps/Byways/README.md)'));
  assert.ok(t.indexOf('## Apps') > t.indexOf('## Editors and tools') && t.indexOf('## Apps') < t.indexOf('## Guides'));
});
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `node --test tests/unit/docs.test.js`
Expected: FAIL on `readme gives install steps for every version` (and on the checklist and root readme tests).

- [ ] **Step 3: Write `Apps/Byways/README.md`**

Sections, in order:
1. **What Byways is**: two or three sentences adapted from §1, the privacy promise with a link to `PRIVACY.md`, and a link to `THIRD_PARTY_NOTICES.md`.
2. **Install**:
   - **Web app**: open the URL. On a phone, use the browser's "Add to Home screen".
   - **Chrome and Edge**: download `byways-chrome-<version>.zip` from the latest Release and unzip it. Open `chrome://extensions` (or `edge://extensions`), turn on Developer mode, choose **Load unpacked** and pick the unzipped folder, the one that holds `manifest.json`. To update, unzip the new version over the same folder, then press reload on the extension card.
   - **Firefox**: when the Release has `byways-firefox-<version>.xpi`, open it in Firefox and confirm. Otherwise unzip `byways-firefox-<version>.zip`, open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on** and pick its `manifest.json`. It goes away when Firefox restarts.
   - **Android**: download the APK on the phone and open it. Allow **Install unknown apps** for the browser or file app when Android asks. Signed builds (`byways-<version>.apk`) update in place. Debug builds (`-debug.apk`) carry the exact warning sentence `Uninstall any earlier Byways APK before you install it.` and the advice to export a backup first. Moving between a debug and a signed build also needs one uninstall.
3. **One-time setup (repo owner)**: the three §17.5 steps verbatim, naming all four keystore secrets and both AMO secrets. Add the keystore commands: `keytool -genkeypair -v -keystore byways.jks -alias byways -keyalg RSA -keysize 4096 -validity 10000`, then `base64 -w0 byways.jks`, whose output becomes `KEYSTORE_BASE64`. Keep the `.jks` file out of git, and back it up, because losing it means friends must uninstall to update.
4. **Cut a release**: (1) choose `x.y.z`, with each part below 100; (2) run `npm version x.y.z --no-git-tag-version`, set the same version in `shells/extension/manifest.base.json` and `byways.versionName`, and set `byways.versionCode` to `x·10000 + y·100 + z` in `shells/android/gradle.properties`; (3) run `npm test`, which names any file that disagrees; (4) fill in `CHECKLIST.md`; (5) commit and merge to `main`; (6) run `git tag byways-vx.y.z` and `git push origin byways-vx.y.z`; (7) check the Release page and its notes.
5. **Local development**: `npm ci`, `npm test`, `npm run e2e`, `npm run build`, and the serve command (then open `http://localhost:4321/Game-Dev-Resources/byways/`). Add **Load unpacked** from `dist/chrome`. Android builds run in GitHub Actions, or locally with an Android SDK through `gradle -p shells/android assembleDebug`. `npm run probe` needs open network.

- [ ] **Step 4: Write `Apps/Byways/CHECKLIST.md`**

Start with a line to fill in: `Version: ____  Date: ____  Tester: ____`. Each item is `- [ ] ` plus what to try and what passing looks like. Then add `Fallback:` with the spec's fallback.
- **Before you tag**: the latest `byways-probe` run is green, or its report has been read.
- **Desktop Chrome**: Speech output (does it need a press on each launch?); Media Session without a media element (headset and media keys with only speech playing; fallback: the silent audio element).
- **Desktop Edge**: Edge on-device voice (does Edge honour `processLocally`? Turn off the network and say "next").
- **Firefox**: Firefox 160 voice in the web app page and in the sidebar; Firefox module background (toolbar Stumble works with the module `bg.js`).
- **Extension (Chrome and Edge)**: microphone in the side panel (can it show the mic prompt? Fallback: `permission.html`); local network (`http://` models on another computer on your network; fallback: this-computer-only models in the extension and network models on Android); Media Session in the Byways tab.
- **Android phone**: Fullscreen for Archive embeds in the WebView; Android voice (the on-device recogniser and segmented sessions on 13+ with no beeps, and tap to talk on 24–32); installing a signed release over the previous signed release keeps your data.

- [ ] **Step 5: Add the root `README.md` entry**

Insert, between `## Editors and tools` and `## Guides`:

```markdown
## Apps

- [Byways](./Apps/Byways/README.md): a free discovery app for the small web, little-known games and odd museum finds, with hands-free voice. A web app, a browser extension and an Android APK. No account and no server. MIT; the bundled emulators keep their own licences.
```

- [ ] **Step 6: Run the tests and see them pass**

Run: `node --test tests/unit/docs.test.js`
Expected: PASS, 11 tests.

- [ ] **Step 7: Commit**

```bash
git add README.md CHECKLIST.md tests/unit/docs.test.js ../../README.md
git commit -m "Write the Byways README and real-device checklist"
```

---

### Task 6: Whole-app release pass

This task checks the whole app the way a friend first meets it. Every route and the Lab load with mocked network and throw no page errors. Then the full unit and e2e suites run green.

**Files:**
- Create: `Apps/Byways/tests/e2e/release-smoke.spec.js`
- Modify: only the files a failure points to, each in the module its plan owns

**Interfaces:**
- Consumes: `mockNet(page)` and `unmocked(page) → string[]` from `tests/e2e/helpers/net.js`; `installFakeSpeech(page)` from `tests/e2e/helpers/fakes.js`; `ROUTES` (overview); the settings section ids, which are the file names in `ui/views/settings/` (`taste sources ai voice access data privacy about licenses`); the `baseURL` set in `tests/e2e/playwright.config.js` (`http://localhost:4321/Game-Dev-Resources/byways/`); first-run steps that each show **Skip**.
- Produces: nothing new.

- [ ] **Step 1: Write the smoke spec**

```js
const PAGES = ['#/stumble', '#/feed', '#/daily', '#/vault', '#/saved', '#/settings',
  ...['taste', 'sources', 'ai', 'voice', 'access', 'data', 'privacy', 'about', 'licenses'].map(id => '#/settings/' + id)];
test.beforeEach(async ({page}) => { await mockNet(page); await installFakeSpeech(page); });
for (const hash of PAGES) {
  test(`release smoke: ${hash} loads cleanly`, async ({page}) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('./' + hash);
    for (let i = 0; i < 6 && await page.getByRole('button', {name: 'Skip'}).isVisible(); i++)
      await page.getByRole('button', {name: 'Skip'}).click();
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('#live-polite')).toHaveAttribute('role', 'status');
    expect(errors).toEqual([]);
    expect(unmocked(page)).toEqual([]);
  });
}
test('release smoke: the Lab loads cleanly', async ({page}) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('./lab/index.html');
  await expect(page.locator('main')).toBeVisible();
  expect(errors).toEqual([]);
  expect(unmocked(page)).toEqual([]);
});
```

- [ ] **Step 2: Run the smoke spec**

Run: `npx playwright test -c tests/e2e/playwright.config.js tests/e2e/release-smoke.spec.js`
Expected: `16 passed`. A failure names the route. Fix it in the owning module, not in this spec. An unmocked URL means a fixture is missing: add it to `tests/fixtures/routes.js` with a hand-written fixture in `tests/fixtures/http/`, shaped from the research notes.

- [ ] **Step 3: Run the full unit suite**

Run: `npm test`
Expected: the check passes (including `checkVersions`), and `node --test` reports `fail 0`.

- [ ] **Step 4: Run the full e2e suite**

Run: `npm run e2e`
Expected: every spec passes (`0 failed`), and no test reports an unmocked request.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/release-smoke.spec.js
git commit -m "Add the whole-app release smoke test"
```

If Steps 2–4 needed fixes, commit each fix on its own, adding exactly the files `git status --short` lists for it, with a subject that names the fix (for example `Fix the console error on the Vault view`).

