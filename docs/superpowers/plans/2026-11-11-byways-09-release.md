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

<!-- PLAN CONTINUES -->
