# Byways 09: Release and Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Byways to friends: a tag-triggered GitHub Release with the APK, the extension zips, an optional signed Firefox `.xpi` and a source archive for every emulator component, plus the notices, privacy policy, README, real-device checklist and a version rule that keeps every version number in step.

**Architecture:** One release workflow runs on a `byways-v*` tag and reuses the existing steps (`npm run vendor`, `npm test`, `npm run build`) and Plan 08's Gradle project, which reads the version from `gradle.properties` and signs when it gets a keystore path. Two small Node tools are new: `tools/gpl-sources.js` downloads a source archive for every vendored emulator package, the code built into them and SeaBIOS, each at a pinned commit, and `checkVersions` in `tools/check.js` fails `npm test` when the version numbers disagree. Documents are plain Markdown, and a unit test pins the facts in them that must not drift.

**Tech Stack:** Node 22 (`node:test`, `fetch`, `node:fs/promises`, `node:zlib`), GitHub Actions on `ubuntu-24.04`, the `gh` CLI, `web-ext@10.8.0`, Plan 08's Gradle 9.7.1 / AGP 9.3.2 project, `@playwright/test@1.63.0`.

**Spec:** `docs/superpowers/specs/2026-11-11-byways-design.md` (§11.3, §15, §17.3, §17.5, §19 M5, §20, §21). Shared contract: `docs/superpowers/plans/2026-11-11-byways-00-overview.md`. Research: `docs/superpowers/specs/byways-research/platform-shells.md` (release signing, web-ext, Releases) and `emulators.md` (licences).

## Global Constraints

- Everything in the overview's "Global constraints (every plan)" list applies. These are the ones that bite this plan:
- CI: `ubuntu-24.04`, `actions/checkout@v7`, `actions/setup-node@v4` (Node 22), `actions/setup-java@v6` (Temurin 21), `gradle/actions/setup-gradle@v6` (`cache-provider: basic`, `gradle-version: 9.7.1`). No Gradle wrapper is committed; CI runs `gradle`.
- Release trigger: a `byways-v*` tag. The job has `contents: write`. Friends can download from the Release without a GitHub account.
- Android signing: the release APK is signed "when these secrets exist: `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS` and `KEY_PASSWORD`" (all four). Otherwise attach the debug APK "with a warning that you must uninstall before updating". Plan 08's `app/build.gradle.kts` signs only when `BYWAYS_KEYSTORE_PATH` is set, and the workflow decodes `KEYSTORE_BASE64` into that file (contract, "Version numbers and Android signing").
- Versions: `package.json` `version` is `x.y.z`. `APP_VERSION` (`src/core/version.js`, Plan 01), `byways.versionName` and `byways.versionCode` = `x·10000 + y·100 + z` (`shells/android/gradle.properties`, Plan 08) must agree with it, and the build writes it into both extension manifests (Plan 07). "No environment variable sets the version."
- Firefox: with `AMO_API_KEY` and `AMO_API_SECRET`, run `web-ext sign --channel=unlisted` (pin `web-ext@10.8.0`).
- Source archives: §11.3 says "Each GitHub Release also attaches the upstream source archives of the GPL components at their pinned tags." The contract widens it to "every vendored emulator component and core, whatever the licence, plus SeaBIOS at the ref v86 used", with the component list from `VENDOR_PACKAGES` and the licences from `LICENCE_NOTES` (`tools/vendor.js`, Plan 06). "There is no second licence table."
- Licences, verbatim from §11.3: js-dos GPL-2.0; EmulatorJS GPL-3.0, plus each core's licence (some are non-commercial); v86 BSD-2-Clause; SeaBIOS LGPLv3; Ruffle MIT or Apache-2.0; Atkinson Hyperlegible OFL. Byways' own code: MIT.
- "No ads or payments in the Lab, ever, because some cores have non-commercial licences."
- Privacy: "Nothing goes to a Byways server, because there is none. There are no analytics." `PRIVACY.md` "holds the same table and rules" as §15.1 and §15.2.
- Shared origin: "Every `iteatsthesalt.github.io` project shares one origin. A custom domain would isolate Byways."
- Emulator versions: js-dos 8.5.3, EmulatorJS 4.2.3, v86 0.5.473, Ruffle 0.7.1, fflate 0.8.3.
- Unit tests make no network calls. Live downloads happen only in the release workflow, whose runner has open network.
- No model identifiers in commit messages or code comments.

## Review Focus

1. **Version drift.** Someone bumps `package.json` but forgets the Android `versionCode`. Android then refuses the new APK as an update, or AMO rejects the `.xpi` as a duplicate version. Expected: `npm test` fails and names the file that disagrees. Pinned by `checkVersions flags a versionCode that does not match the version` and `runChecks reports version drift when it gets the app root` (Task 2).
2. **A bad source archive.** Codeload returns an HTML error page or a cut-off body with status 200. Expected: the release fails loudly, rather than attaching a broken "source" file that does not meet the GPL duty. Pinned by `fetchSources rejects a body that is not gzip` and `fetchSources rejects a truncated archive` (Task 1).
3. **Re-running a release for the same tag.** A failed run is re-run, or a finished one is run again. `gh release create` fails because the Release exists, and AMO refuses to sign a version it already signed. Expected: the files are re-uploaded with `--clobber`; signing is the last step that can fail, so a failed download never uses up the signing; and the notes carry the Firefox note only when the Release has no `.xpi` at all. Pinned by `release workflow re-uploads to an existing release` and `release workflow signs the add-on last and keeps going when signing fails` (Task 3).
4. **A nested extension zip.** If the zip holds `chrome/manifest.json`, **Load unpacked** on the unzipped folder fails with "Manifest file is missing". Expected: `manifest.json` sits at the zip root. Pinned by `release workflow checks manifest.json is at the zip root` (Task 3).
5. **An emulator update without new source pins.** Someone moves `versions.json` to js-dos 8.6.0, or to a new v86 commit, and leaves `tools/gpl-sources.js` as it is. Expected: `npm test` fails and names the missing pin, long before a Release attaches the source of the old version. Pinned by `sourceTargets needs a pin for every version it ships` (Task 1).

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `Apps/Byways/tools/gpl-sources.js` | Create | Maps every `VENDOR_PACKAGES` entry, the code built into it, and SeaBIOS to pinned commits; downloads each archive from codeload, checks it, and writes the archives and `SOURCES.txt` |
| `Apps/Byways/tests/unit/gpl-sources.test.js` | Create | Unit tests with a fake `fetch` |
| `Apps/Byways/tools/check.js` | Modify | Adds `checkVersions(appRoot)`; `runChecks` runs it when it gets `appRoot` |
| `Apps/Byways/tools/build.js` | Modify | The `--check` CLI passes `appRoot: APP_ROOT` to `runChecks` |
| `Apps/Byways/tests/unit/versions-agree.test.js` | Create | Tests for `checkVersions`, plus a check that Plan 08's Gradle file reads the version properties |
| `.github/workflows/byways-release.yml` | Create | The tag-triggered release |
| `Apps/Byways/tests/unit/release-workflow.test.js` | Create | Text checks on the workflow, plus a check on Plan 08's Gradle signing block |
| `Apps/Byways/THIRD_PARTY_NOTICES.md` | Modify | Appends the source-code and bundled-code sections to Plan 06's file |
| `Apps/Byways/PRIVACY.md` | Create | The §15.1 table and §15.2 rules, plus origin, voice, keys and analytics notes |
| `Apps/Byways/README.md` | Modify | Replaces Plan 01's stub: what Byways is, install steps per version, one-time setup, cutting a release, local development |
| `Apps/Byways/CHECKLIST.md` | Modify | Adds the rest of the §20 real-device checklist around Plan 07's Firefox section, with Plan 08's Android list |
| `README.md` (repo root) | Modify | A short **Apps** section that links `Apps/Byways/README.md` |
| `Apps/Byways/tests/unit/docs.test.js` | Create | Pins the facts in the four documents |
| `Apps/Byways/tests/e2e/release-smoke.spec.js` | Create | Visits every route and the Lab with mocked network; no page errors |

---

### Task 1: Source archive fetcher

Each Release carries the source of every emulator component it ships, at the exact commit its files were built from. The commits are fixed data in the tool, keyed by the `dir` of each `VENDOR_PACKAGES` entry, so an emulator update without a new pin fails `npm test` instead of attaching the source of the old version.

**Files:**
- Create: `Apps/Byways/tools/gpl-sources.js`
- Test: `Apps/Byways/tests/unit/gpl-sources.test.js`

**Interfaces:**
- Consumes: `VENDOR_PACKAGES(versions) → Array<{name, version, dir, files}>` and `LICENCE_NOTES` (`{name, licence, source, note?}`, keyed by npm name plus `'seabios'`, `'atkinson'` and `'byways'`) from `tools/vendor.js` (Plan 06); `sha256Hex(data) → Promise<string>` from `src/core/util/hash.js` (Plan 01); `src/versions.json`; `node_modules/@emulatorjs/core-<core>/package.json` (its `repository.url`, for example `git+https://github.com/EmulatorJS/libretro-fceumm.git`).
- Produces (all exported from `tools/gpl-sources.js`):
  - `parseRepoUrl(url: string) → string|null`, returning `'owner/name'` for a GitHub URL.
  - `sourceTargets(versions, {readCorePackage: (core) => object}) → Target[]`, where `Target = {id, component, name, licence, repo, ref, tag, note}`. `component` is the `LICENCE_NOTES` key, `name` and `licence` come from that note, `ref` is a 40-character commit, and `tag` and `note` are strings or `null`. Targets come out sorted by `id`.
  - `codeloadUrl(repo, ref) → string`.
  - `fetchSources(targets, {fetch, outDir, writeFile}) → Promise<Result[]>`, where `Result` is the `Target` plus `{file, bytes, sha256}`.
  - `sourcesManifest(results) → string`, the text of `SOURCES.txt`.
  - `main({argv, fetch, root, log}) → Promise<number>`, the body of the CLI `node tools/gpl-sources.js --out <dir>`. It reads `<root>/src/versions.json` and the installed core packages, creates `<dir>`, writes every archive and `<dir>/SOURCES.txt`, and returns 0. On any error it passes the message to `log` and returns 1.

Fixed data inside the file, `SOURCE_PINS` (not exported). Each key is a `VENDOR_PACKAGES` `dir`, or `seabios@<v86 commit>`, and each row is one archive. The `v86` row's commit is `versions.v86.commit`. A row's `component` is the npm name in its key (`js-dos`, `@emulatorjs/emulatorjs`, `@emulatorjs/core-<core>`, `v86`, `@ruffle-rs/ruffle`, `fflate`), or `seabios`. "Core note" is `master when the core was built (2025-06-14)`.

| Key | id | repo | commit | tag | note |
|---|---|---|---|---|---|
| `js-dos@8.5.3` | `js-dos` | `caiiiycuk/js-dos` | `506dfd2a99f56bc4e393a716125ae94e58eb3fba` | `v8.5.3` | |
| | `js-dos-emulators` | `js-dos/emulators` | `6bbf0925d221a7304ea8e0dda1e89b8dc01569b2` | `v8.5.2` | `the emulators package js-dos 8.5.3 ships` |
| | `dosbox` | `js-dos/dosbox` | `528578d5a6f76afd4d5ef4e722b5670826f1183a` | | `native/dosbox in js-dos/emulators v8.5.2` |
| | `dosbox-x` | `js-dos/dosbox-x` | `788fde99d3d451eab3621009186e5abe516f2b9c` | | `native/dosbox-x in js-dos/emulators v8.5.2` |
| `@emulatorjs/emulatorjs@4.2.3` | `emulatorjs` | `EmulatorJS/EmulatorJS` | `e150dc0491ae747028919fb82d6598954976ede6` | `v4.2.3` | |
| | `emulatorjs-retroarch` | `EmulatorJS/RetroArch` | `6dd4353937ef48b6ec0bfbdbb15d1c5992d86927` | | `branch next when the 4.2.3 cores were built (2025-06-14); compiled into every core` |
| | `emulatorjs-build` | `EmulatorJS/build` | `b24e5b535034dc7c3428d76f236d4793881969b6` | | `the scripts that built the 4.2.3 cores` |
| `@emulatorjs/core-fceumm@4.2.3` | `core-fceumm` | `EmulatorJS/libretro-fceumm` | `d9d7e141274d07186b6a871ca2919b6f13cfb2f9` | | core note |
| `@emulatorjs/core-snes9x@4.2.3` | `core-snes9x` | `EmulatorJS/snes9x` | `6ca2343e5f3b0acbea49ca958251e3a0af58a81d` | | core note |
| `@emulatorjs/core-gambatte@4.2.3` | `core-gambatte` | `EmulatorJS/gambatte-libretro` | `4ac2b30d196a842061d6b333ea5e523a7c1a7cce` | | core note |
| `@emulatorjs/core-mgba@4.2.3` | `core-mgba` | `EmulatorJS/mgba` | `1d9dbb1dc8d51ed744fe6be82183f7f5076e549d` | | core note |
| `@emulatorjs/core-genesis_plus_gx@4.2.3` | `core-genesis_plus_gx` | `EmulatorJS/Genesis-Plus-GX` | `594cdf3a666546f65f46391c3615ac5e9550bfc1` | | core note |
| `@emulatorjs/core-stella2014@4.2.3` | `core-stella2014` | `EmulatorJS/stella2014-libretro` | `1f578c36382bb5a86a0fe245973fa557f369738b` | | core note |
| `@emulatorjs/core-pcsx_rearmed@4.2.3` | `core-pcsx_rearmed` | `EmulatorJS/pcsx_rearmed` | `f29871dde1742cafb0ab56ba33636a8600bbbd80` | | core note |
| `v86@0.5.473` | `v86` | `copy/v86` | `versions.v86.commit` | | `holds bios/fetch-and-build-seabios.sh and the SeaBIOS configs` |
| `seabios@315b2b0b758703ef0e6cc7b4088d6068f83f3c20` | `seabios` | `coreboot/seabios` | `ea1b7a0733906b8425d948ae94fba63c32b1d425` | `rel-1.16.2` | `built by v86's bios/fetch-and-build-seabios.sh` |
| `@ruffle-rs/ruffle@0.7.1` | `ruffle` | `ruffle-rs/ruffle` | `89a7049965f3090e706265670df309a5128233ac` | `v0.7.1` | |
| `fflate@0.8.3` | `fflate` | `101arrowz/fflate` | `dcb3714a6c25db3a2748641019c5277413d09714` | `v0.8.3` | |

How the pins were found. Use the same method when a version moves:
- **Tags:** the commit each tag points at (`git ls-remote --tags https://github.com/<repo>`). Where the npm package has a `gitHead` (js-dos, EmulatorJS, Ruffle), it is the same commit.
- **js-dos:** 8.5.3 ships `dist/emulators/` from the `emulators` package 8.5.2 (js-dos/emulators), whose `native/dosbox` and `native/dosbox-x` submodules hold the DOSBox code. GitHub archives leave submodules out, so each submodule gets its own row, at its commit in tag v8.5.2.
- **EmulatorJS cores:** each core package names its EmulatorJS fork in `repository.url`. The forks have no tags, so the pin is the fork's newest first-parent `master` commit before the core's `reports/<core>.json` `buildStart` (all on 2025-06-14): `git log --first-parent -1 --before=<buildStart> master`. Use `--first-parent`, because in October 2025 the forks merged upstream commits dated June, and a plain date search picks those wrongly. EmulatorJS/build's `build.sh` compiles every core with EmulatorJS/RetroArch branch `next`, so that branch and EmulatorJS/build `main` are pinned the same way, before the first `buildStart` (2025-06-14T17:55:31Z).
- **SeaBIOS:** at the pinned v86 commit, `bios/fetch-and-build-seabios.sh` checks out `rel-1.16.2`, and `bios/seabios.bin` holds the string `rel-1.16.2-0-gea1b7a0`. If a later v86 commit's SeaBIOS ref cannot be found, pin `seabios@<that commit>` to `copy/v86` at that commit, with the note `exact SeaBIOS ref unknown; this archive holds v86's SeaBIOS build script and configs`.

`sourceTargets` walks `VENDOR_PACKAGES(versions)`. A `dir` with no pin throws `no pinned source for <dir>`, and so does a missing `seabios@<versions.v86.commit>`. For each core it compares `parseRepoUrl(readCorePackage(core).repository?.url)` with the pin's repo: `null` throws `no GitHub repository for core <core>`, and another repo throws `core <core> is published from <repo>, but its pin says <pin repo>`.

- [ ] **Step 1: Write the failing tests**

`versions` is the parsed `src/versions.json`. `readInstalled(core)` parses `node_modules/@emulatorjs/core-<core>/package.json`, `targets()` is `sourceTargets(versions, {readCorePackage: readInstalled})`, and `byId(id)` picks one of those. The fake `fetch(url)` pushes `url` onto `calls` and returns `new Response(routes[url].body, {status: routes[url].status})`, or a 404 when `routes` has no entry for `url`. The fake `writeFile(path, bytes)` pushes `[path, bytes.length]` onto `writes`. `deps = {fetch, outDir: '/out', writeFile}`, `log` pushes onto `logs`, and `beforeEach` empties `routes`, `calls`, `writes` and `logs`. `GZ = zlib.gzipSync(Buffer.from('tar'))`, `JSDOS = codeloadUrl('caiiiycuk/js-dos', '506dfd2a99f56bc4e393a716125ae94e58eb3fba')` and `ROOT = fileURLToPath(new URL('../..', import.meta.url))`.

```js
test('parseRepoUrl reads npm repository urls', () => {
  assert.equal(parseRepoUrl('git+https://github.com/EmulatorJS/libretro-fceumm.git'), 'EmulatorJS/libretro-fceumm');
  assert.equal(parseRepoUrl('https://github.com/a/b'), 'a/b');
  assert.equal(parseRepoUrl('github:a/b'), 'a/b');
  assert.equal(parseRepoUrl('https://gitlab.com/a/b'), null);
});
test('sourceTargets lists every vendored package, the code built into them and SeaBIOS', () => {
  const t = targets();
  assert.deepEqual(t.map((x) => x.id), ['core-fceumm', 'core-gambatte', 'core-genesis_plus_gx', 'core-mgba',
    'core-pcsx_rearmed', 'core-snes9x', 'core-stella2014', 'dosbox', 'dosbox-x', 'emulatorjs', 'emulatorjs-build',
    'emulatorjs-retroarch', 'fflate', 'js-dos', 'js-dos-emulators', 'ruffle', 'seabios', 'v86']);
  assert.deepEqual(byId('core-fceumm'), {id: 'core-fceumm', component: '@emulatorjs/core-fceumm',
    name: 'EmulatorJS core fceumm', licence: 'GPL-2.0', repo: 'EmulatorJS/libretro-fceumm',
    ref: 'd9d7e141274d07186b6a871ca2919b6f13cfb2f9', tag: null, note: 'master when the core was built (2025-06-14)'});
  assert.deepEqual(byId('seabios'), {id: 'seabios', component: 'seabios', name: 'SeaBIOS and VGABIOS',
    licence: 'LGPL-3.0', repo: 'coreboot/seabios', ref: 'ea1b7a0733906b8425d948ae94fba63c32b1d425',
    tag: 'rel-1.16.2', note: "built by v86's bios/fetch-and-build-seabios.sh"});
  assert.equal(byId('v86').ref, versions.v86.commit);
  for (const x of t) {
    assert.equal(x.licence, LICENCE_NOTES[x.component].licence, x.id);
    assert.match(x.ref, /^[0-9a-f]{40}$/, x.id);
  }
});
test('sourceTargets needs a pin for every version it ships', () => {   // Review Focus 5
  const v = structuredClone(versions); v.jsdos.version = '8.6.0';
  assert.throws(() => sourceTargets(v, {readCorePackage: readInstalled}), /no pinned source for js-dos@8\.6\.0/);
  const w = structuredClone(versions); w.v86.commit = 'f'.repeat(40);
  assert.throws(() => sourceTargets(w, {readCorePackage: readInstalled}), /no pinned source for seabios@f{40}/);
});
test('sourceTargets checks each core pin against the installed package', () => {
  assert.throws(() => sourceTargets(versions, {readCorePackage: () => ({})}), /no GitHub repository for core fceumm/);
  const elsewhere = () => ({repository: {url: 'git+https://github.com/someone/fork.git'}});
  assert.throws(() => sourceTargets(versions, {readCorePackage: elsewhere}),
    /core fceumm is published from someone\/fork, but its pin says EmulatorJS\/libretro-fceumm/);
});
test('codeloadUrl builds the tarball url', () => {
  assert.equal(codeloadUrl('EmulatorJS/EmulatorJS', 'e150dc0491ae747028919fb82d6598954976ede6'),
    'https://codeload.github.com/EmulatorJS/EmulatorJS/tar.gz/e150dc0491ae747028919fb82d6598954976ede6');
});
test('fetchSources downloads each pinned commit and names the file', async () => {
  const fceumm = codeloadUrl('EmulatorJS/libretro-fceumm', 'd9d7e141274d07186b6a871ca2919b6f13cfb2f9');
  routes[JSDOS] = {status: 200, body: GZ}; routes[fceumm] = {status: 200, body: GZ};
  const rs = await fetchSources([byId('js-dos'), byId('core-fceumm')], deps);
  assert.deepEqual(calls, [JSDOS, fceumm]);
  assert.deepEqual(rs.map((r) => r.file), ['js-dos-v8.5.3.tar.gz', 'core-fceumm-d9d7e141274d.tar.gz']);
  assert.deepEqual(writes, [[path.join('/out', 'js-dos-v8.5.3.tar.gz'), GZ.length],
    [path.join('/out', 'core-fceumm-d9d7e141274d.tar.gz'), GZ.length]]);
  assert.equal(rs[0].bytes, GZ.length);
  assert.equal(rs[0].sha256, await sha256Hex(GZ));
  assert.equal(rs[0].tag, 'v8.5.3');
});
test('fetchSources rejects an empty archive', async () => {
  routes[JSDOS] = {status: 200, body: ''};
  await assert.rejects(fetchSources([byId('js-dos')], deps), /empty archive for js-dos/);
});
test('fetchSources rejects a body that is not gzip', async () => {   // Review Focus 2
  routes[JSDOS] = {status: 200, body: '<html>busy</html>'};
  await assert.rejects(fetchSources([byId('js-dos')], deps), /not a gzip archive for js-dos/);
  assert.equal(writes.length, 0);
});
test('fetchSources rejects a truncated archive', async () => {   // Review Focus 2
  routes[JSDOS] = {status: 200, body: zlib.gzipSync(Buffer.from('x'.repeat(1000))).subarray(0, -8)};
  await assert.rejects(fetchSources([byId('js-dos')], deps), /corrupt archive for js-dos: unexpected end of file/);
  assert.equal(writes.length, 0);
});
test('fetchSources stops at the first HTTP error', async () => {
  routes[codeloadUrl('EmulatorJS/libretro-fceumm', 'd9d7e141274d07186b6a871ca2919b6f13cfb2f9')] = {status: 200, body: GZ};
  await assert.rejects(fetchSources([byId('js-dos'), byId('core-fceumm')], deps),     // JSDOS has no route: 404
    /source download failed for js-dos: HTTP 404/);
  assert.deepEqual(calls, [JSDOS]);
});
test('sourcesManifest lists file, component, licence, commit and hash', () => {
  const text = sourcesManifest([
    {...byId('js-dos'), file: 'js-dos-v8.5.3.tar.gz', bytes: 7, sha256: 'ab'.repeat(32)},
    {...byId('core-fceumm'), file: 'core-fceumm-d9d7e141274d.tar.gz', bytes: 7, sha256: 'cd'.repeat(32)}]);
  assert.ok(text.startsWith('# Byways source archives\n'));
  assert.ok(text.includes('js-dos-v8.5.3.tar.gz  js-dos  GPL-2.0  https://github.com/caiiiycuk/js-dos/tree/'
    + '506dfd2a99f56bc4e393a716125ae94e58eb3fba  sha256:' + 'ab'.repeat(32) + '  tag v8.5.3\n'));
  assert.ok(text.includes('core-fceumm-d9d7e141274d.tar.gz  EmulatorJS core fceumm  GPL-2.0  https://github.com/'
    + 'EmulatorJS/libretro-fceumm/tree/d9d7e141274d07186b6a871ca2919b6f13cfb2f9  sha256:' + 'cd'.repeat(32)
    + '  note: master when the core was built (2025-06-14)\n'));
});
test('main writes every archive and SOURCES.txt', async () => {
  const out = await mkdtemp(path.join(os.tmpdir(), 'byways-src-'));
  const fetchAll = async (url) => { calls.push(url); return new Response(GZ); };
  assert.equal(await main({argv: ['--out', out], fetch: fetchAll, root: ROOT, log}), 0);
  assert.equal(readdirSync(out).filter((f) => f.endsWith('.tar.gz')).length, 18);
  const manifest = readFileSync(path.join(out, 'SOURCES.txt'), 'utf8');
  assert.equal(manifest.split('\n').filter((l) => l.includes('.tar.gz  ')).length, 18);
  assert.deepEqual(logs, []);
});
test('main returns 1 and logs the error when a download fails', async () => {
  const out = await mkdtemp(path.join(os.tmpdir(), 'byways-src-'));
  const busy = async () => new Response('busy', {status: 500});
  assert.equal(await main({argv: ['--out', out], fetch: busy, root: ROOT, log}), 1);
  assert.deepEqual(logs, ['source download failed for core-fceumm: HTTP 500']);
});
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `node --test tests/unit/gpl-sources.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `tools/gpl-sources.js`.

- [ ] **Step 3: Implement `tools/gpl-sources.js`**

Write the four "How the pins were found" rules as a short comment above `SOURCE_PINS`, so the next version bump can follow them without this plan. `codeloadUrl(repo, ref)` returns `https://codeload.github.com/<repo>/tar.gz/<ref>`. `fetchSources` downloads the targets one at a time, in order, and stops at the first problem:
- A status of 400 or more throws `source download failed for <id>: HTTP <status>`.
- A body of 0 bytes throws `empty archive for <id>`. A body whose first two bytes are not `0x1f 0x8b` throws `not a gzip archive for <id>`.
- Then decompress the whole body into a sink that drops the output: `pipeline(Readable.from([body]), zlib.createGunzip(), <a Writable whose write() only calls back>)`. This keeps memory flat for large archives. A failure throws `corrupt archive for <id>: <zlib message>`, and a cut-off body gives `unexpected end of file`.
- On success, call `writeFile(path.join(outDir, file), <the body as a Buffer>)` and record `bytes` and `sha256`. `file` is `<id>-<tag>.tar.gz`, or `<id>-<first 12 characters of ref>.tar.gz` when there is no tag.

`sourcesManifest` writes `# Byways source archives`, a blank line, `Each archive is the source of an emulator component in this release, at the exact commit its files were built from.` and a blank line. Then it writes one line per result: `<file>  <name>  <licence>  https://github.com/<repo>/tree/<ref>  sha256:<hex>`, plus `  tag <tag>` when there is a tag and `  note: <note>` when there is a note. `main` reads `--out <dir>` from `argv`; without it, it logs `usage: node tools/gpl-sources.js --out <dir>` and returns 1. It creates the folder with `mkdir(dir, {recursive: true})` and writes files with `node:fs/promises`. The file calls `process.exitCode = await main({argv: process.argv.slice(2), fetch, root: <the folder above tools/>, log: console.error})` only when `import.meta.url === pathToFileURL(process.argv[1]).href`.

- [ ] **Step 4: Run the tests and see them pass**

Run: `node --test tests/unit/gpl-sources.test.js`
Expected: PASS, 13 tests. These tests read the real `src/versions.json` and `node_modules`. If one throws `no pinned source for <dir>`, check that Plan 06's `src/versions.json` holds the versions and the v86 commit in the table above.

- [ ] **Step 5: Commit**

```bash
git add tools/gpl-sources.js tests/unit/gpl-sources.test.js
git commit -m "Add the source archive fetcher for releases"
```

---

### Task 2: Version agreement rule

One version, `x.y.z` in `package.json`, drives every shell. Plan 01's `APP_VERSION` and Plan 08's `gradle.properties` repeat it by hand, and the Android `versionCode` is derived as `x·10000 + y·100 + z`, so it always grows. The extension manifests need no copy: the build writes the `package.json` version into both.

**Files:**
- Modify: `Apps/Byways/tools/check.js` (add `checkVersions`; `runChecks` runs it when it gets `appRoot`)
- Modify: `Apps/Byways/tools/build.js` (the `--check` CLI passes `appRoot: APP_ROOT` to `runChecks`)
- Test: `Apps/Byways/tests/unit/versions-agree.test.js`

**Interfaces:**
- Consumes:
  - `package.json` `version` (Plan 01) and `APP_VERSION` in `src/core/version.js` (Plan 01), a line of the form `export const APP_VERSION = '0.1.0';`.
  - `shells/extension/manifest.base.json` with `version: "0.0.0"`, and the overlays `manifest.chrome.json` and `manifest.firefox.json` (Plan 07). Plan 07's test `buildExtension writes the <b> manifest, code and data` pins that both built manifests carry the `package.json` version.
  - `byways.versionName` and `byways.versionCode` in `shells/android/gradle.properties`, which `app/build.gradle.kts` reads with `providers.gradleProperty(...)` (Plan 08; contract section "Version numbers and Android signing (Plan 08 creates; Plan 09 uses)").
  - `runChecks({srcDir, outputs, extraHtml}) → Promise<string[]>` in `tools/check.js`, and the `--check` CLI and `APP_ROOT` in `tools/build.js` (Plan 01).
- Produces: `checkVersions(appRoot: string) → Promise<string[]>`, exported from `tools/check.js`. It returns problem strings, or an empty array when everything agrees. `runChecks({srcDir, outputs, extraHtml, appRoot})`: when `appRoot` is given, it appends the problems from `checkVersions(appRoot)`; without it, nothing changes.

Exact problem strings, in this order. `<v>` is the `package.json` version, and each string starts with the file path and `: `, like every problem in `tools/check.js`:
- `package.json: version <v> must be x.y.z with each part below 100`. When this fires, return only this problem.
- `src/core/version.js: no APP_VERSION`, or `src/core/version.js: APP_VERSION is <a>, package.json has <v>`
- `shells/extension/manifest.base.json: version must stay 0.0.0, because the build writes the package.json version`
- `shells/extension/manifest.<chrome|firefox>.json: must not set version`
- `shells/android/gradle.properties: byways.versionName is missing` (the same for `byways.versionCode`)
- `shells/android/gradle.properties: byways.versionName is <n>, package.json has <v>`
- `shells/android/gradle.properties: byways.versionCode is <c>, expected <x·10000+y·100+z> for <v>`

- [ ] **Step 1: Write the failing tests**

`writeApp(over)` makes a temp folder with `fs.mkdtemp(path.join(os.tmpdir(), 'byways-ver-'))` and writes six files in it, each from a key of `over` or its default:
- `package.json` from `pkg`, default `{version: '1.2.3'}`;
- `src/core/version.js` from `versionJs`, default `"export const APP_VERSION = '1.2.3';\n"`;
- `shells/extension/manifest.base.json` from `base`, default `{manifest_version: 3, version: '0.0.0'}`;
- `shells/extension/manifest.chrome.json` and `manifest.firefox.json` from `chrome` and `firefox`, default `{}`;
- `shells/android/gradle.properties` from `gradle`, default `'byways.versionName=1.2.3\nbyways.versionCode=10203\n'`.

It returns the folder.

```js
test('checkVersions accepts agreeing versions', async () => {
  assert.deepEqual(await checkVersions(await writeApp({})), []);
});
test('checkVersions flags an APP_VERSION that disagrees', async () => {
  assert.deepEqual(await checkVersions(await writeApp({versionJs: "export const APP_VERSION = '1.2.2';\n"})),
    ['src/core/version.js: APP_VERSION is 1.2.2, package.json has 1.2.3']);
});
test('checkVersions flags a base manifest that carries a version', async () => {
  assert.deepEqual(await checkVersions(await writeApp({base: {manifest_version: 3, version: '1.2.3'}})),
    ['shells/extension/manifest.base.json: version must stay 0.0.0, because the build writes the package.json version']);
});
test('checkVersions flags an overlay that sets its own version', async () => {
  assert.deepEqual(await checkVersions(await writeApp({chrome: {version: '9.9.9'}})),
    ['shells/extension/manifest.chrome.json: must not set version']);
});
test('checkVersions flags a versionCode that does not match the version', async () => {   // Review Focus 1
  assert.deepEqual(await checkVersions(await writeApp({gradle: 'byways.versionName=1.2.3\nbyways.versionCode=10202\n'})),
    ['shells/android/gradle.properties: byways.versionCode is 10202, expected 10203 for 1.2.3']);
});
test('checkVersions flags a versionName that disagrees', async () => {
  assert.deepEqual(await checkVersions(await writeApp({gradle: 'byways.versionName=1.2.4\nbyways.versionCode=10203\n'})),
    ['shells/android/gradle.properties: byways.versionName is 1.2.4, package.json has 1.2.3']);
});
test('checkVersions flags a missing property', async () => {
  assert.deepEqual(await checkVersions(await writeApp({gradle: '# versions\nbyways.versionName=1.2.3\n'})),
    ['shells/android/gradle.properties: byways.versionCode is missing']);
});
test('checkVersions rejects a version that is not plain x.y.z', async () => {
  for (const v of ['1.2.3-beta', '1.100.0', '1.2', '01.2.3']) {
    assert.deepEqual(await checkVersions(await writeApp({pkg: {version: v}})),
      [`package.json: version ${v} must be x.y.z with each part below 100`]);
  }
});
test('checkVersions passes on the real app', async () => {
  assert.deepEqual(await checkVersions(fileURLToPath(new URL('../..', import.meta.url))), []);
});
test('runChecks reports version drift when it gets the app root', async () => {   // Review Focus 1
  const dir = await writeApp({gradle: 'byways.versionName=1.2.3\nbyways.versionCode=10202\n'});
  assert.deepEqual(await runChecks({srcDir: 'src', outputs: [], extraHtml: [], appRoot: dir}),
    ['shells/android/gradle.properties: byways.versionCode is 10202, expected 10203 for 1.2.3']);
});
test('the Android build reads its version from gradle.properties', async () => {   // checks Plan 08's side of the contract
  const kts = await readFile(new URL('../../shells/android/app/build.gradle.kts', import.meta.url), 'utf8');
  for (const s of ['providers.gradleProperty("byways.versionCode")', 'providers.gradleProperty("byways.versionName")'])
    assert.ok(kts.includes(s), s);
});
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `node --test tests/unit/versions-agree.test.js`
Expected: FAIL with `SyntaxError: The requested module '../../tools/check.js' does not provide an export named 'checkVersions'`.

- [ ] **Step 3: Implement `checkVersions(appRoot)` in `tools/check.js`, and pass the app root from the `--check` CLI**

Read each file under `appRoot` with `node:fs/promises`. The version rule is `/^(0|[1-9]\d?)\.(0|[1-9]\d?)\.(0|[1-9]\d?)$/`. Find `APP_VERSION` with `/\bAPP_VERSION\s*=\s*['"]([^'"]+)['"]/`; a missing file or no match gives the `no APP_VERSION` problem. Parse `gradle.properties` line by line as `key=value`, trimming both sides and skipping blank lines and lines that start with `#`. In `runChecks`, when `appRoot` is set, append `await checkVersions(appRoot)`. In `tools/build.js`, add `appRoot: APP_ROOT` to the `runChecks` call of the `--check` CLI, so `npm test` fails on drift. Do not change any version number in this task.

- [ ] **Step 4: Run the tests, then the full check**

Run: `node --test tests/unit/versions-agree.test.js`
Expected: PASS, 11 tests. The last test checks Plan 08's Gradle file. If it fails, Plan 08 has not yet adopted the contract's version properties: fix it there, not here.
Run: `npm run check`
Expected: `check passed` and exit 0.

- [ ] **Step 5: Commit**

```bash
git add tools/check.js tools/build.js tests/unit/versions-agree.test.js
git commit -m "Check that every version number agrees"
```

---

### Task 3: Release workflow

Nothing here can run on this machine: there is no Android SDK, and a workflow runs only in GitHub Actions. So a unit test pins the workflow's text, and the real checks are the branch's `byways.yml` run and the first tag push. Plan 08 owns the Gradle side (the version properties and the release signing config); this task only supplies the keystore path.

**Files:**
- Create: `.github/workflows/byways-release.yml` (at the repo root)
- Test: `Apps/Byways/tests/unit/release-workflow.test.js`

**Interfaces:**
- Consumes:
  - the npm scripts `vendor`, `test` and `build` (overview), and Task 2's version rule, which runs inside `npm test`;
  - the `node tools/gpl-sources.js --out <dir>` CLI (Task 1);
  - the build outputs `dist/chrome/`, `dist/firefox/` and `shells/android/app/build/outputs/apk/{release,debug}/app-{release,debug}.apk`;
  - Plan 08's Gradle project. It reads the version from `gradle.properties`, and it sets up the release `signingConfig` only when `BYWAYS_KEYSTORE_PATH` is set, reading that file with `KEYSTORE_PASSWORD`, `KEY_ALIAS` and `KEY_PASSWORD` (contract section "Version numbers and Android signing (Plan 08 creates; Plan 09 uses)").
- Produces: the "Signed APK" step decodes `KEYSTORE_BASE64` into a file and passes its path to Gradle as `BYWAYS_KEYSTORE_PATH`. Release file names, where `<V>` is the version: `byways-<V>.apk` (signed) or `byways-<V>-debug.apk`, `byways-chrome-<V>.zip`, `byways-firefox-<V>.zip`, `byways-firefox-<V>.xpi` (when signed), the 18 source `*.tar.gz` archives and `SOURCES.txt`. Task 5's README names these files.

- [ ] **Step 1: Write the failing tests**

`wf` is the text of `new URL('../../../../.github/workflows/byways-release.yml', import.meta.url)`. `kts` is the text of Plan 08's `shells/android/app/build.gradle.kts`. `at(s)` asserts that `wf` contains `s` and returns `wf.indexOf(s)`.

```js
const DEBUG_WARNING = '**Warning:** this APK is a debug build. Uninstall any earlier Byways APK before you install it. Export a backup first (Settings → Data), because uninstalling deletes your saved finds.';
const FIREFOX_NOTE = '**Firefox:** there is no signed .xpi in this release. Unzip byways-firefox-$VERSION.zip and load it as a temporary add-on (see the README). It goes away when Firefox restarts.';
test('release workflow runs on byways tags with contents write', () => {
  assert.ok(wf.includes("tags: ['byways-v*']"));
  assert.match(wf, /permissions:\n  contents: write/);
});
test('release workflow pins the CI actions and vendors before the tests', () => {
  for (const s of ['runs-on: ubuntu-24.04', 'actions/checkout@v7', 'actions/setup-node@v4', 'actions/setup-java@v6',
    'gradle/actions/setup-gradle@v6', 'cache-provider: basic', 'gradle-version: 9.7.1']) assert.ok(wf.includes(s), s);
  assert.match(wf, /- run: npm ci\n\s+- run: npm run vendor\n\s+- run: npm test\n\s+- run: npm run build\n/);
});
test('release workflow checks the tag against package.json', () => {
  assert.ok(wf.includes('test "byways-v$V" = "$GITHUB_REF_NAME"'));
});
test('release workflow signs the APK only when all four keystore secrets exist', () => {
  for (const s of ["HAS_KEYSTORE: ${{ secrets.KEYSTORE_BASE64 != '' && secrets.KEYSTORE_PASSWORD != '' && "
      + "secrets.KEY_ALIAS != '' && secrets.KEY_PASSWORD != '' }}",
    "if: env.HAS_KEYSTORE == 'true'", "if: env.HAS_KEYSTORE != 'true'",
    'KEYSTORE_BASE64: ${{ secrets.KEYSTORE_BASE64 }}', 'KEYSTORE_PASSWORD: ${{ secrets.KEYSTORE_PASSWORD }}',
    'KEY_ALIAS: ${{ secrets.KEY_ALIAS }}', 'KEY_PASSWORD: ${{ secrets.KEY_PASSWORD }}',
    'BYWAYS_KEYSTORE_PATH="$RUNNER_TEMP/byways.jks" gradle -p shells/android assembleRelease',
    'gradle -p shells/android assembleDebug']) assert.ok(wf.includes(s), s);
});
test('release workflow warns about the debug APK', () => { assert.ok(wf.includes(DEBUG_WARNING)); });
test('release workflow checks manifest.json is at the zip root', () => {
  for (const b of ['chrome', 'firefox'])
    assert.ok(wf.includes(`unzip -Z1 "dist/release/upload/byways-${b}-$VERSION.zip" | grep -qx manifest.json`), b);
});
test('release workflow signs the add-on last and keeps going when signing fails', () => {   // Review Focus 3
  for (const s of ['npx --yes web-ext@10.8.0 sign', '--channel=unlisted', 'continue-on-error: true',
    'AMO_API_KEY: ${{ secrets.AMO_API_KEY }}', 'AMO_API_SECRET: ${{ secrets.AMO_API_SECRET }}',
    'XPI_OUTCOME: ${{ steps.xpi.outcome }}', `gh release view "$GITHUB_REF_NAME" --json assets --jq '.assets[].name'`,
    FIREFOX_NOTE]) assert.ok(wf.includes(s), s);
  const order = ['name: Signed APK', 'name: Debug APK', 'name: Zip the extensions', 'name: Source archives',
    'name: Sign the Firefox add-on', 'name: Release notes', 'name: Publish'].map(at);
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
});
test('release workflow attaches the source archives', () => {
  assert.ok(wf.includes('node tools/gpl-sources.js --out dist/release/sources'));
  assert.ok(wf.includes('cp dist/release/sources/* dist/release/upload/'));
});
test('release workflow re-uploads to an existing release', () => {   // Review Focus 3
  assert.ok(wf.includes('gh release upload "$GITHUB_REF_NAME" dist/release/upload/* --clobber'));
  assert.ok(wf.includes('gh release create "$GITHUB_REF_NAME" dist/release/upload/*'));
});
test('release workflow keeps the token away from the build steps', () => {
  assert.ok(wf.includes('persist-credentials: false'));
  assert.equal(wf.split('GH_TOKEN: ${{ github.token }}').length - 1, 2);
  assert.ok(wf.indexOf('GH_TOKEN') > at('name: Release notes'));
});
test('release workflow writes no expression inside a flow mapping', () => {
  assert.doesNotMatch(wf, /\{[^}\n]*\$\{\{/);   // `env: { X: ${{ … }} }` does not parse as YAML
});
test('the Android release build takes its keystore from the workflow', () => {   // checks Plan 08's side of the contract
  for (const s of ['"BYWAYS_KEYSTORE_PATH"', '"KEYSTORE_PASSWORD"', '"KEY_ALIAS"', '"KEY_PASSWORD"'])
    assert.ok(kts.includes(s), s);
  assert.ok(!kts.includes('KEYSTORE_BASE64'), 'the workflow decodes the keystore, not Gradle');
});
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `node --test tests/unit/release-workflow.test.js`
Expected: FAIL with `ENOENT` for `byways-release.yml`.

- [ ] **Step 3: Write `.github/workflows/byways-release.yml`**

The job-level `env` turns the secrets into flags, because `if:` cannot read `secrets` directly. Each step's own `env` passes the secret values in. Write every `env:` in block style, with `env:` on its own line and one `NAME: value` per indented line. A `${{ }}` expression inside a `{ … }` flow mapping does not parse, and GitHub then rejects the whole file.

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
      HAS_KEYSTORE: ${{ secrets.KEYSTORE_BASE64 != '' && secrets.KEYSTORE_PASSWORD != '' && secrets.KEY_ALIAS != '' && secrets.KEY_PASSWORD != '' }}
      HAS_AMO: ${{ secrets.AMO_API_KEY != '' && secrets.AMO_API_SECRET != '' }}
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
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
      - run: npm run vendor
      - run: npm test
      - run: npm run build
```

The remaining steps, in this order. Each step's `name:` is the text in the Step column, and each `run` is written exactly as the tests pin it. Every download that can fail comes before "Sign the Firefox add-on", so a failed run never uses up AMO's one signing of a version. Only the last two steps get the GitHub token.

| Step | `if` / `env` / extras | `run` |
|---|---|---|
| Signed APK | `if: env.HAS_KEYSTORE == 'true'`; `env:` `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS` and `KEY_PASSWORD`, each as `<NAME>: ${{ secrets.<NAME> }}` | `echo "$KEYSTORE_BASE64" \| base64 -d > "$RUNNER_TEMP/byways.jks"`, then `BYWAYS_KEYSTORE_PATH="$RUNNER_TEMP/byways.jks" gradle -p shells/android assembleRelease`, then copy `app-release.apk` to `dist/release/upload/byways-$VERSION.apk` |
| Debug APK | `if: env.HAS_KEYSTORE != 'true'` | `gradle -p shells/android assembleDebug`, then copy `app-debug.apk` to `dist/release/upload/byways-$VERSION-debug.apk` |
| Zip the extensions | none | `(cd dist/chrome && zip -qr "../release/upload/byways-chrome-$VERSION.zip" .)`, the same for `firefox`, then the two `unzip -Z1 … \| grep -qx manifest.json` lines |
| Source archives | none | `node tools/gpl-sources.js --out dist/release/sources`, then `cp dist/release/sources/* dist/release/upload/` |
| Sign the Firefox add-on | `id: xpi`, `if: env.HAS_AMO == 'true'`, `continue-on-error: true`; `env:` `AMO_API_KEY: ${{ secrets.AMO_API_KEY }}` and `AMO_API_SECRET: ${{ secrets.AMO_API_SECRET }}` | `npx --yes web-ext@10.8.0 sign --source-dir dist/firefox --artifacts-dir dist/release/xpi --channel=unlisted --api-key "$AMO_API_KEY" --api-secret "$AMO_API_SECRET"`, then copy `dist/release/xpi/*.xpi` to `dist/release/upload/byways-firefox-$VERSION.xpi` |
| Release notes | `env:` `XPI_OUTCOME: ${{ steps.xpi.outcome }}` and `GH_TOKEN: ${{ github.token }}` | write `dist/release/NOTES.md` (below) |
| Publish | `env:` `GH_TOKEN: ${{ github.token }}` | if `gh release view "$GITHUB_REF_NAME"` succeeds: `gh release upload "$GITHUB_REF_NAME" dist/release/upload/* --clobber`, then `gh release edit "$GITHUB_REF_NAME" --notes-file dist/release/NOTES.md`. Otherwise: `gh release create "$GITHUB_REF_NAME" dist/release/upload/* --title "Byways $VERSION" --notes-file dist/release/NOTES.md` |

`NOTES.md` holds these lines, where `$APK` is `byways-$VERSION.apk` when `HAS_KEYSTORE` is `true` and `byways-$VERSION-debug.apk` otherwise:

```
## Byways $VERSION

- Web app: https://iteatsthesalt.github.io/Game-Dev-Resources/byways/
- Chrome and Edge: unzip byways-chrome-$VERSION.zip, then use Load unpacked. See the README.
- Firefox: byways-firefox-$VERSION.xpi when it is attached, or the zip as a temporary add-on.
- Android: $APK
- Source code for every emulator component: the .tar.gz files, listed in SOURCES.txt.
```

Then add the `DEBUG_WARNING` line when `HAS_KEYSTORE` is not `true`. Add the `FIREFOX_NOTE` line when `XPI_OUTCOME` is not `success` and the Release does not already hold `byways-firefox-$VERSION.xpi`. Check that with `gh release view "$GITHUB_REF_NAME" --json assets --jq '.assets[].name'`; no Release yet counts as not holding it. That covers "no secrets" (`skipped`), "AMO refused" (`failure`), and a second run of a finished release, whose earlier `.xpi` stays attached because `--clobber` removes nothing. Use the exact strings from the test.

- [ ] **Step 4: Run the tests and see them pass**

Run: `node --test tests/unit/release-workflow.test.js`
Expected: PASS, 12 tests. The last test checks Plan 08's Gradle file. If it fails, Plan 08 has not yet adopted the contract's `BYWAYS_KEYSTORE_PATH` signing: fix it there, not here.

- [ ] **Step 5: Commit**

```bash
git add ../../.github/workflows/byways-release.yml tests/unit/release-workflow.test.js
git commit -m "Add the tag-triggered release workflow"
```

- [ ] **Step 6: Check the shared commands in CI before merge**

Push the branch, then run `gh run watch --exit-status` on its `byways.yml` run.
Expected: the `web` and `android` jobs pass. They run the same `npm ci`, `npm run vendor`, `npm test`, build and Gradle commands that the release reuses.

- [ ] **Step 7: Verify in GitHub Actions (the owner, after merge)**

Push a tag `byways-v<version>` that matches `package.json`.
Expected: the `byways-release` run is green, and the Release lists one APK, two zips, the `.xpi` (only when the AMO secrets exist), 18 `.tar.gz` archives and `SOURCES.txt`. If the keystore secrets are absent, the notes carry the debug warning. If the run fails at "Source archives", the log names the archive and the HTTP status or check that failed.

---

### Task 4: Third-party notices and privacy policy

**Files:**
- Modify: `Apps/Byways/THIRD_PARTY_NOTICES.md` (Plan 06 created it)
- Create: `Apps/Byways/PRIVACY.md`
- Test: `Apps/Byways/tests/unit/docs.test.js`

**Interfaces:**
- Consumes: Plan 06's `THIRD_PARTY_NOTICES.md`, whose header and one `## <name>` section per `buildLicenses({versions, target: 'pwa'})` component (with `Version:`, `Licence:`, `Note:` and `Source:` lines) are kept in step with `versions.json` and `LICENCE_NOTES` by Plan 06's `tests/unit/lab-notices.test.js`; `LICENCE_NOTES` in `tools/vendor.js` (Plan 06); the repos and commits in Task 1's `SOURCE_PINS` table, for the licence check.
- Produces: the two documents. The in-app Licenses screen (Plan 06) and the Privacy settings section (Plan 02) keep their own text, so this task does not touch them.

- [ ] **Step 1: Write the failing tests**

`read(rel)` returns the text of `new URL('../../' + rel, import.meta.url)`. Plan 06's test already guards the component sections, so these tests check only what this task adds.

```js
test('notices explain where the source archives are', () => {
  const t = read('THIRD_PARTY_NOTICES.md');
  for (const s of ['## Source code', 'SOURCES.txt', 'the exact commit', 'RetroArch', 'DOSBox-X', 'SeaBIOS rel-1.16.2'])
    assert.ok(t.includes(s), s);
});
test('notices name the code bundled inside EmulatorJS and js-dos', () => {
  const t = read('THIRD_PARTY_NOTICES.md');
  for (const s of ['## Code bundled inside EmulatorJS and js-dos', 'Socket.IO 4.8.1', 'nipplejs', 'UnRAR licence',
    'yarn.lock']) assert.ok(t.includes(s), s);
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
test('privacy holds the rules from the spec', () => {
  const t = read('PRIVACY.md');
  for (const s of ['textContent', 'DOMParser', 'http(s)', '<img>', 'archive.org', 'Play', 'vendored', 'CDN'])
    assert.ok(t.includes(s), s);
});
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `node --test tests/unit/docs.test.js`
Expected: FAIL. The notices tests fail on `## Source code` and `## Code bundled inside EmulatorJS and js-dos`, and the privacy tests fail with `ENOENT` for `PRIVACY.md`.

- [ ] **Step 3: Confirm the licences before the notices name them**

The core packages carry no SPDX licence (their `license` field only names a file), so `LICENCE_NOTES` is hand-kept data. For each row, read the licence file at its pinned commit with `curl -sS --max-time 20 https://raw.githubusercontent.com/<repo>/<commit>/<file> | head -3`, taking the repo and commit from Task 1's table. If this machine cannot reach that host, do this step from the archives of the first green release run instead: `tar -xzOf <archive> --wildcards '*/<file>' | head -3`.

| id | file | what the file says | `LICENCE_NOTES` value |
|---|---|---|---|
| `core-fceumm` | `Copying` | GNU General Public License, Version 2 | `GPL-2.0` |
| `core-snes9x` | `LICENSE` | the Snes9x licence, "for non-commercial purposes" | `Snes9x licence`, note `Non-commercial licence` |
| `core-gambatte` | `COPYING` | GNU General Public License, Version 2 | `GPL-2.0` |
| `core-mgba` | `LICENSE` | Mozilla Public License Version 2.0 | `MPL-2.0` |
| `core-genesis_plus_gx` | `LICENSE.txt` | the Genesis Plus GX licence, "Redistributions may not be sold, nor may they be used in a commercial product or activity" | `Genesis Plus GX licence`, note `Non-commercial licence` |
| `core-stella2014` | `stella/license.txt` | GNU General Public License, Version 2 | `GPL-2.0` |
| `core-pcsx_rearmed` | `COPYING` | GNU General Public License, Version 2 | `GPL-2.0` |
| `js-dos-emulators` | `LICENSE` | GNU General Public License, Version 2 | `GPL-2.0` (the `js-dos` note) |
| `emulatorjs-retroarch` | `COPYING` | GNU General Public License, Version 3 | `GPL-3.0` (the `@emulatorjs/emulatorjs` note) |
| `emulatorjs-build` | `LICENSE` | GNU General Public License, Version 3 | `GPL-3.0` (the `@emulatorjs/emulatorjs` note) |
| `seabios` | `COPYING.LESSER` | GNU Lesser General Public License, Version 3 | `LGPL-3.0` |

Expected: every row matches, as it did when this plan was written, so `LICENCE_NOTES` stays as it is. If a row does not match, stop: correct `LICENCE_NOTES` in Plan 06's `tools/vendor.js` in a task of its own, run Plan 06's tests, then come back.

- [ ] **Step 4: Add this task's sections to `THIRD_PARTY_NOTICES.md`**

Keep Plan 06's header and its `## <name>` sections exactly as they are, including the sentence `No ads or payments in the Lab, ever, because some cores have non-commercial licences.` After them, append:
1. **`## Source code`**: Each GitHub Release attaches a source archive for every emulator component in it, at the exact commit its files were built from, and lists them with their SHA-256 values in `SOURCES.txt`. For the EmulatorJS cores, that includes EmulatorJS's RetroArch fork and its build scripts. For js-dos, it includes its emulators repository and the DOSBox and DOSBox-X code. For the v86 BIOS files, it includes SeaBIOS rel-1.16.2. The emulators run unmodified, each inside its own runner page, and the licence texts are in the archives.
2. **`## Code bundled inside EmulatorJS and js-dos`**: EmulatorJS 4.2.3's `data/` folder, which the Lab ships whole, also holds Socket.IO 4.8.1 (`data/src/socket.io.min.js`, MIT), nipplejs (`data/src/nipplejs.js`, MIT), libunrar.js (`data/compression/libunrar.js` and `libunrar.wasm`, RARLab's UnRAR built for the web, under the UnRAR licence, source `https://github.com/tnikolai2/libunrar-js`) and the zip and 7z extractors `data/compression/extractzip.js` and `extract7z.js`. js-dos 8.5.3's `dist/js-dos.js` bundles its own npm dependencies, which `package.json` and `yarn.lock` in the js-dos source archive list. Before writing the Socket.IO line, run `head -c 120 vendor/@emulatorjs/emulatorjs@4.2.3/data/src/socket.io.min.js`. Expected: `Socket.IO v4.8.1` and `Released under the MIT License.`

- [ ] **Step 5: Write `PRIVACY.md`**

Sections, in order:
1. **The promise**, from §1: "There is no Byways server. Your keys, collections and history are stored only on this device. Network calls go only to the sources and AI providers you turn on."
2. **What goes over the network, and when**: a table `| When | To |` with the seven `NETWORK` rows, worded exactly as in the test, then the sentence `Nothing goes to a Byways server, because there is none. There are no analytics.` Add one line saying there are no ads, no sponsored finds and no ranking by engagement.
3. **What stays on this device**: the one IndexedDB database `byways` and its stores (§14.1). The extension keeps keys in `chrome.storage.local`. The three versions keep separate storage.
4. **Rules**: the five §15.2 bullets in plain words: text through `textContent`, with HTML fields reduced to text by `DOMParser`; `http(s)` links, and images only through `<img>` (in backticks, so Markdown shows it); only `archive.org` embeds, only after **Play**; pinned, vendored third-party code with integrity checks; no CDN code at runtime.
5. **Keys**: `A key is sent only to its own provider's host.` Keys never go into exports (unless you choose), share links or logs. The optional passphrase lock uses AES-GCM with a PBKDF2-SHA-256 key (600,000 iterations).
6. **Voice**: voice stays on the device where it can (desktop Chrome and Edge 139+, Firefox 160+, and the Android recogniser when it is on-device). Cloud voice goes to Google, Apple or Microsoft only after a consent screen that names the company. The microphone grant is per origin.
7. **The shared origin**: the exact sentence from the test. It also says the Lab shares that origin in the web app, and that the passphrase lock protects keys from it.
8. **Identification header**: Wikimedia and the Art Institute get `Byways/<version> (+https://github.com/iteatsthesalt/Game-Dev-Resources)`, which never carries user details.
9. **Questions**: open an issue on the GitHub repo.

- [ ] **Step 6: Run the tests and see them pass**

Run: `node --test tests/unit/docs.test.js tests/unit/lab-notices.test.js`
Expected: PASS, 7 tests (6 here, plus Plan 06's notices test, which shows its sections are intact).

- [ ] **Step 7: Commit**

```bash
git add THIRD_PARTY_NOTICES.md PRIVACY.md tests/unit/docs.test.js
git commit -m "Write the third-party notices and the privacy policy"
```

---

### Task 5: README, root README entry and real-device checklist

**Files:**
- Modify: `Apps/Byways/README.md` (replace Plan 01's stub with the full version)
- Modify: `Apps/Byways/CHECKLIST.md` (Plan 07 created it with its `## Firefox extension (manual)` section; add the rest around it)
- Modify: `README.md` at the repo root (add an `## Apps` section between `## Editors and tools` and `## Guides`)
- Modify: `Apps/Byways/tests/unit/docs.test.js` (add tests)

**Interfaces:**
- Consumes: the Release file names (Task 3); the version rule (Task 2); the serve command and npm scripts (overview); `DEBUG_WARNING` wording (Task 3); Plan 07's `## Firefox extension (manual)` section in `CHECKLIST.md`; the 16 items under Plan 08's `## Real-device checklist (Android)`, which Plan 08 hands to this plan.
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
    'KEY_ALIAS', 'KEY_PASSWORD', 'AMO_API_KEY', 'AMO_API_SECRET', 'base64 -w0 byways.jks', 'base64 -i byways.jks',
    'the same password you gave keytool']) assert.ok(t.includes(s), s);
});
test('readme explains the version bump and the release', () => {
  const t = read('README.md');
  for (const s of ['package.json', 'src/core/version.js', 'APP_VERSION', 'byways.versionName', 'byways.versionCode',
    'x·10000 + y·100 + z', 'git tag byways-v', 'AMO signs each version once', 'npm ci', 'npm run vendor', 'npm test',
    'npm run e2e', 'node tools/serve.js --root dist/pwa --base /Game-Dev-Resources/byways/ --port 4321'])
    assert.ok(t.includes(s), s);
});
test('checklist covers every real-device item from the spec', () => {
  const t = read('CHECKLIST.md');
  for (const h of ['## Before you tag', '## Desktop Chrome', '## Desktop Edge', '## Firefox web app',
    '## Firefox extension (manual)', '## Extension (Chrome and Edge)', '## Android phone']) assert.ok(t.includes(h), h);
  for (const s of ['byways-probe', 'Speech output', 'Media Session', 'Test connection', 'processLocally', 'Firefox 160',
    'side panel', 'local network', 'Connect OpenRouter', 'Load Temporary Add-on', 'module background', 'Fullscreen',
    'segmented', 'own origin', 'PKCE', 'Predictive back']) assert.ok(t.includes(s), s);
  assert.ok(t.split('\n').filter((l) => l.startsWith('- [ ] ')).length >= 28);
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
Expected: FAIL on `readme gives install steps for every version` (and on the checklist test, at `## Before you tag`, and the root readme test).

- [ ] **Step 3: Write `Apps/Byways/README.md`**

Sections, in order:
1. **What Byways is**: two or three sentences adapted from §1, the privacy promise with a link to `PRIVACY.md`, and a link to `THIRD_PARTY_NOTICES.md`.
2. **Install**:
   - **Web app**: open the URL. On a phone, use the browser's "Add to Home screen".
   - **Chrome and Edge**: download `byways-chrome-<version>.zip` from the latest Release and unzip it. Open `chrome://extensions` (or `edge://extensions`), turn on Developer mode, choose **Load unpacked** and pick the unzipped folder, the one that holds `manifest.json`. To update, unzip the new version over the same folder, then press reload on the extension card.
   - **Firefox**: when the Release has `byways-firefox-<version>.xpi`, open it in Firefox and confirm. Otherwise unzip `byways-firefox-<version>.zip`, open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on** and pick its `manifest.json`. It goes away when Firefox restarts.
   - **Android**: download the APK on the phone and open it. Allow **Install unknown apps** for the browser or file app when Android asks. Signed builds (`byways-<version>.apk`) update in place. Debug builds (`-debug.apk`) carry the exact warning sentence `Uninstall any earlier Byways APK before you install it.` and the advice to export a backup first. Moving between a debug and a signed build also needs one uninstall.
3. **One-time setup (repo owner)**: the three §17.5 steps verbatim, naming all four keystore secrets and both AMO secrets. Add the keystore commands: `keytool -genkeypair -v -keystore byways.jks -alias byways -keyalg RSA -keysize 4096 -validity 10000`, then `base64 -w0 byways.jks` (Linux) or `base64 -i byways.jks` (macOS), whose one-line output becomes `KEYSTORE_BASE64`. Add the exact sentence `KEY_ALIAS is byways, and KEY_PASSWORD is the same password you gave keytool for the keystore.` (keytool's default PKCS12 keystores have one password, and different values make signing fail.) Keep the `.jks` file out of git, and back it up, because losing it means friends must uninstall to update.
4. **Cut a release**: (1) choose `x.y.z`, with each part below 100; (2) run `npm version x.y.z --no-git-tag-version`, set `APP_VERSION` in `src/core/version.js` to the same `x.y.z`, and in `shells/android/gradle.properties` set `byways.versionName` to it and `byways.versionCode` to `x·10000 + y·100 + z`; leave the extension manifests alone, because the build writes the version into both; (3) run `npm test`, which names any file that disagrees and any emulator version that has no source pin yet; (4) fill in `CHECKLIST.md`; (5) commit and merge to `main`; (6) run `git tag byways-vx.y.z` and `git push origin byways-vx.y.z`; (7) check the Release page and its notes. Then add: `AMO signs each version once.` If a run signed the add-on and then failed, its re-run attaches no new `.xpi`, so bump the version to get one.
5. **Local development**: `npm ci`, then `npm run vendor` (it downloads the two v86 BIOS files, so it needs network), `npm test`, `npm run e2e`, `npm run build`, and the serve command (then open `http://localhost:4321/Game-Dev-Resources/byways/`). Add **Load unpacked** from `dist/chrome`. Android builds run in GitHub Actions, or locally with an Android SDK through `gradle -p shells/android assembleDebug`. `npm run probe` needs open network.

- [ ] **Step 4: Add the rest of `Apps/Byways/CHECKLIST.md`**

Keep Plan 07's `## Firefox extension (manual)` section word for word. Above everything, put `# Byways real-device checklist` and a line to fill in: `Version: ____  Date: ____  Tester: ____`. Then add these sections in this order, with Plan 07's section between `## Firefox web app` and `## Extension (Chrome and Edge)`. Each item is `- [ ] ` plus what to try and what passing looks like, then `Fallback:` and the spec's fallback where §20 names one.
- **`## Before you tag`** (2 items): the latest `byways-probe` run is green, or its report has been read; and, when `src/versions.json` changed since the last release, `npm test` passes, so `tools/gpl-sources.js` has a pin for each new version, and each changed component's licence file at its new pin still matches `LICENCE_NOTES` in `tools/vendor.js`.
- **`## Desktop Chrome`** (3): Speech output (does read-aloud need a press on each launch?); Media Session without a media element (headset and media keys with only speech playing; fallback: the silent audio element); Settings → AI → **Test connection** with your own Claude key passes in the web app (fallback: the extension, Android or OpenRouter).
- **`## Desktop Edge`** (1): Edge on-device voice (does Edge honour `processLocally`? Turn off the network and say "next").
- **`## Firefox web app`** (1): Firefox 160 voice in the web app page (press **Start** and say "next"). Plan 07's section already covers the sidebar voice and the module background, so do not repeat them.
- **`## Extension (Chrome and Edge)`** (4): microphone in the side panel (can it show the mic prompt? Fallback: `permission.html`); models on your local network (`http://` models on another computer; fallback: this-computer-only models in the extension, and network models on Android); Media Session in the Byways tab; **Connect OpenRouter** completes in the extension, in Chrome and in the Firefox sidebar (fallback: paste a key).
- **`## Android phone`** (17): Plan 08's 16 items, word for word, then one more: installing this signed release over the previous signed release keeps your saved finds.

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

This task checks the whole app the way a friend first meets it. Every route and the Lab load with mocked network and show no page error, console error or unmocked request. Then the full unit and e2e suites run green. This task changes no product module: a failure is fixed where it belongs, in a task of its own.

**Files:**
- Create: `Apps/Byways/tests/e2e/release-smoke.spec.js`

**Interfaces:**
- Consumes:
  - `test` and `expect` from `tests/e2e/helpers/net.js` (Plan 01). Their `page` fixture calls `mockNet(page)`, and after each test it fails on any `unmocked(page)` URL or `pageProblems(page)` entry (page errors and console errors).
  - `gotoApp(page, hash)` from `tests/e2e/helpers/app.js`, which opens the app at the base path and skips first run; `installFakeSpeech(page)` from `tests/e2e/helpers/fakes.js` (Plan 01).
  - Plan 04's fixtures for the snapshots that only the data job writes: `tests/fixtures/http/daily/daily-2026-11-11.json`, `tests/fixtures/http/itch/itch.json` and `tests/fixtures/http/ia/vault-index.json`.
  - `ROUTES` (overview); the settings section ids `taste sources ai voice access data privacy about licenses`; Plan 06's Lab page and its `Pick a file` input; the `baseURL` in `tests/e2e/playwright.config.js` (`http://localhost:4321/Game-Dev-Resources/byways/`).
- Produces: nothing new.

- [ ] **Step 1: Write the smoke spec**

```js
import { test, expect } from './helpers/net.js';
import { gotoApp } from './helpers/app.js';
import { installFakeSpeech } from './helpers/fakes.js';
const PAGES = ['#/stumble', '#/feed', '#/daily', '#/vault', '#/saved', '#/settings',
  ...['taste', 'sources', 'ai', 'voice', 'access', 'data', 'privacy', 'about', 'licenses'].map((id) => '#/settings/' + id)];
const SNAPSHOTS = {'daily.json': 'daily/daily-2026-11-11.json', 'itch.json': 'itch/itch.json', 'vault-index.json': 'ia/vault-index.json'};
test.beforeEach(async ({page}) => {
  await installFakeSpeech(page);
  for (const [file, fixture] of Object.entries(SNAPSHOTS))
    await page.route('**/data/' + file, (r) => r.fulfill({path: 'tests/fixtures/http/' + fixture}));
});
for (const hash of PAGES) {
  test(`release smoke: ${hash} loads cleanly`, async ({page}) => {
    await gotoApp(page, hash);
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('#live-polite')).toHaveAttribute('role', 'status');
  });
}
test('release smoke: the Lab loads cleanly', async ({page}) => {
  await page.goto('./lab/index.html');
  await expect(page.getByLabel('Pick a file')).toBeVisible();
});
```

The fixture's own checks after each test catch page errors, console errors and unmocked requests, so the spec repeats none of them.

- [ ] **Step 2: Run the smoke spec**

Run: `npm run e2e -- tests/e2e/release-smoke.spec.js` (it builds first, so it tests the current code)
Expected: `16 passed`. A failing test's title names the route, and the fixture's message names the console error or the unmocked URL. Do not change other files in this task: stop, fix the failure in the owning module in a task of its own (a failing regression test in that module's test file first, then the fix, then its own commit), and run this task again.

- [ ] **Step 3: Run the full unit suite**

Run: `npm test`
Expected: `check passed` (the check now includes `checkVersions`), and `node --test` reports `fail 0`. Handle a failure as in Step 2.

- [ ] **Step 4: Run the full e2e suite**

Run: `npm run e2e`
Expected: every spec passes (`0 failed`), and no test reports an unmocked request. Handle a failure as in Step 2.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/release-smoke.spec.js
git commit -m "Add the whole-app release smoke test"
```

