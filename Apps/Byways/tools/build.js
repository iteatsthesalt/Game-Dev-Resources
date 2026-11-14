import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runChecks } from './check.js';

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export const OUTPUTS = {
  pwa: ['dist/pwa'],
  extension: ['dist/chrome', 'dist/firefox'],
  android: ['shells/android/app/src/main/assets/www', 'shells/android/app/src/main/assets/lab'],
};
const TARGETS = Object.keys(OUTPUTS);
const COPIED = ['core', 'ui', 'platform', 'data', 'assets', 'versions.json', 'lab'];
const SHELL_FILES = ['index.html', 'manifest.webmanifest', 'sw.js'];
const NOT_PRECACHED = new Set(['sw.js', 'build.json']);

const posix = path => path.split(sep).join('/');

function listFiles(dir, base = dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(path, base));
    else files.push(posix(relative(base, path)));
  }
  return files.sort();
}

function buildPwa(dir) {
  for (const name of COPIED) {
    const from = join(APP_ROOT, 'src', name);
    if (existsSync(from)) cpSync(from, join(dir, name), { recursive: true });
  }
  for (const name of SHELL_FILES) cpSync(join(APP_ROOT, 'shells/pwa', name), join(dir, name));
}

function stampServiceWorker(dir, id) {
  const precache = ['./', ...listFiles(dir)
    .filter(f => !NOT_PRECACHED.has(f) && !f.startsWith('lab/') && !f.startsWith('vendor/'))
    .map(f => `./${f}`)];
  const swPath = join(dir, 'sw.js');
  const sw = readFileSync(swPath, 'utf8')
    .replace("'__BUILD_ID__'", () => JSON.stringify(id))
    .replace('["__PRECACHE__"]', () => JSON.stringify(precache));
  writeFileSync(swPath, sw);
}

export async function build({ target, outRoot = APP_ROOT, id = process.env.GITHUB_SHA || 'dev', now = new Date() }) {
  const targets = target === 'all' ? TARGETS : [target];
  for (const t of targets) if (!TARGETS.includes(t)) throw new Error(`unknown target: ${t}`);
  const outputs = [];
  for (const t of targets) {
    for (const rel of OUTPUTS[t]) {
      const dir = join(outRoot, rel);
      rmSync(dir, { recursive: true, force: true });
      mkdirSync(dir, { recursive: true });
      if (t === 'pwa') buildPwa(dir);
      writeFileSync(join(dir, 'build.json'), JSON.stringify({ id, builtAt: now.toISOString() }));
      if (t === 'pwa') stampServiceWorker(dir, id);
      outputs.push(rel);
    }
  }
  return { outputs };
}

const withoutBuildId = text => text.replace(/^const BUILD_ID = .*$/m, '');

function readComparable(path, file) {
  const bytes = readFileSync(join(path, file));
  return file === 'sw.js' ? Buffer.from(withoutBuildId(bytes.toString('utf8'))) : bytes;
}

export function findStale(freshRoot, liveRoot, dirs) {
  const problems = [];
  for (const dir of dirs) {
    const live = join(liveRoot, dir); const fresh = join(freshRoot, dir);
    if (!existsSync(live)) continue;
    const freshFiles = existsSync(fresh) ? listFiles(fresh) : []; const liveFiles = listFiles(live);
    for (const file of new Set([...freshFiles, ...liveFiles])) {
      if (file === 'build.json') continue;
      if (!freshFiles.includes(file) || !liveFiles.includes(file) || !readComparable(fresh, file).equals(readComparable(live, file)))
        problems.push(`${dir}/${file}: stale; run npm run build`);
    }
  }
  return problems.sort();
}

async function check() {
  const tmp = mkdtempSync(join(tmpdir(), 'byways-check-'));
  try {
    const { outputs } = await build({ target: 'all', outRoot: tmp, id: 'check' });
    const problems = [
      ...await runChecks({ srcDir: join(APP_ROOT, 'src'), outputs: outputs.map(d => join(tmp, d)), extraHtml: [join(APP_ROOT, 'shells/pwa/landing/index.html')] }),
      ...findStale(tmp, APP_ROOT, outputs),
    ];
    for (const p of problems) console.log(p);
    if (problems.length) process.exitCode = 1;
    else console.log('check passed');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.includes('--check')) await check();
  else {
    const i = args.indexOf('--target');
    const { outputs } = await build({ target: i >= 0 ? args[i + 1] : 'all' });
    for (const o of outputs) console.log(o);
  }
}
