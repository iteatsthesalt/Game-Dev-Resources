// Build rule checker: CSP strings, banned APIs, references, manifests, data files and the precache list.
// Every problem is a string that starts with the file path, then ': '.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';

export const APP_CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https: data: blob:; media-src 'self' https: blob:; frame-src https://archive.org https://*.archive.org; connect-src 'self' https: http://localhost:* http://127.0.0.1:*; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'";

const LAB_DIRECTIVES = {
  'script-src': "script-src 'self' 'wasm-unsafe-eval' blob:",
  'connect-src': "connect-src 'self' blob:",
  'worker-src': "worker-src 'self' blob:",
};
export const LAB_CSP = APP_CSP.split('; ').map(d => LAB_DIRECTIVES[d.split(' ')[0]] ?? d).join('; ');

const isLabPage = file => file.split(/[\\/]/).slice(-2, -1)[0] === 'lab';

// index.html frames its runner pages; console.html needs style attributes (EmulatorJS 4.2.3).
export function expectedCsp(path) {
  if (!isLabPage(path)) return APP_CSP;
  const name = basename(path);
  if (name === 'index.html') return LAB_CSP.replace('frame-src ', "frame-src 'self' ");
  if (name === 'console.html') return LAB_CSP.replace("style-src 'self';", "style-src 'self'; style-src-attr 'unsafe-inline';");
  return LAB_CSP;
}

const FORBIDDEN = [
  ['innerHTML', /\binnerHTML\b/],
  ['outerHTML', /\bouterHTML\s*=/],
  ['insertAdjacentHTML', /\binsertAdjacentHTML\b/],
  ['document.write', /\bdocument\.write\b/],
  ['eval', /\beval\(/],
  ['new Function', /\bnew Function\b/],
  ['remote script', /<script[^>]+src=["']https?:/i],
];

export function findForbidden(file, text) {
  return FORBIDDEN.filter(([, re]) => re.test(text)).map(([name]) => `${file}: forbidden ${name}`);
}

export function checkHtml(file, html) {
  const problems = [];
  const meta = html.match(/<meta\b[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/i);
  const content = meta && meta[0].match(/\bcontent="([^"]*)"/i);
  if (!content) problems.push(`${file}: missing CSP meta`);
  else if (content[1] !== expectedCsp(file)) problems.push(`${file}: wrong CSP`);
  for (const _ of html.matchAll(/<script\b(?![^>]*\bsrc\s*=)[^>]*>/gi)) problems.push(`${file}: inline script`);
  for (const _ of html.matchAll(/<style\b|<[a-z][^>]*\sstyle\s*=/gi)) problems.push(`${file}: inline style`);
  return problems;
}

const isRelativeRef = value => value !== '' && !/^[a-z][a-z0-9+.-]*:/i.test(value) && !/^(\/|#)/.test(value);

export function checkRefs(file, text, exists) {
  const refs = [];
  if (extname(file) === '.html') {
    for (const m of text.matchAll(/(?<![\w-])(?:src|href)\s*=\s*(["'])(.*?)\1/gi)) refs.push(m[2]);
  } else {
    for (const m of text.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)(["'])(\.{1,2}\/[^"']+)\1/g)) refs.push(m[2]);
  }
  const problems = [];
  for (const raw of refs) {
    if (!isRelativeRef(raw)) continue;
    const ref = raw.replace(/[?#].*$/, '');
    if (ref === '') continue;
    const target = join(dirname(file), ref.endsWith('/') ? `${ref}index.html` : ref);
    if (!exists(target)) problems.push(`${file}: missing ${ref}`);
  }
  return problems;
}

export function checkManifest(file, text) {
  let json;
  try { json = JSON.parse(text); } catch { return [`${file}: not valid JSON`]; }
  if (!file.endsWith('.webmanifest')) return [];
  return ['start_url', 'scope'].filter(key => json[key] !== './').map(key => `${file}: ${key} must be ./`);
}

const TAG_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const KINDS = new Set(['site', 'game', 'toy', 'tool', 'article']);
const isWebUrl = value => {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
};

function checkTags(name, json) {
  const problems = []; const seen = new Set();
  for (const group of json.groups ?? []) for (const tag of group.tags ?? []) {
    if (!TAG_ID.test(tag.id)) problems.push(`${name}: bad tag id ${tag.id}`);
    else if (seen.has(tag.id)) problems.push(`${name}: duplicate tag id ${tag.id}`);
    seen.add(tag.id);
  }
  return problems;
}

function checkLibrary(name, json, tagIds) {
  const problems = [];
  for (const e of json.entries ?? []) {
    if (!/^lib-\d{4}$/.test(e.id)) problems.push(`${name}: bad id ${e.id}`);
    if (!isWebUrl(e.url)) problems.push(`${name}: bad url ${e.url}`);
    if (!KINDS.has(e.kind)) problems.push(`${name}: bad kind ${e.kind}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.added)) problems.push(`${name}: bad date ${e.added}`);
    if (tagIds) for (const tag of e.tags ?? []) if (!tagIds.has(tag)) problems.push(`${name}: unknown tag ${tag}`);
  }
  return problems;
}

function checkVault(name, json) {
  const problems = [];
  for (const e of json.entries ?? []) {
    if (typeof e.id !== 'string' || !e.id.startsWith('ia:')) problems.push(`${name}: bad id ${e.id}`);
    if (!Number.isInteger(e.year)) problems.push(`${name}: bad year ${e.year}`);
  }
  return problems;
}

function checkSeeds(name, json) {
  return (json.urls ?? []).filter(u => !isWebUrl(u)).map(u => `${name}: bad url ${u}`);
}

const DATA_CHECKS = {
  'tags.json': (name, json) => checkTags(name, json),
  'library.json': (name, json, tagIds) => checkLibrary(name, json, tagIds),
  'vault-starter.json': (name, json) => checkVault(name, json),
  'geocities-seeds.json': (name, json) => checkSeeds(name, json),
};

export function checkData(name, json, { tagIds } = {}) {
  const check = DATA_CHECKS[basename(name)];
  if (!check) return [`${name}: unknown data file`];
  const problems = json?.v === 1 ? [] : [`${name}: v must be 1`];
  return problems.concat(check(name, json ?? {}, tagIds));
}

const MAX_SHELL_BYTES = 2 * 1024 * 1024;

export function checkPrecache(swText, outDir) {
  const problems = [];
  const buildId = swText.match(/\bBUILD_ID\s*=\s*(["'])(.*?)\1/)?.[2];
  if (buildId === undefined || buildId === '__BUILD_ID__') problems.push('sw.js: build id not stamped');
  let list;
  try { list = JSON.parse(swText.match(/\bPRECACHE\s*=\s*(\[[^\]]*\])/)?.[1]); } catch { list = null; }
  if (!Array.isArray(list) || list.includes('__PRECACHE__')) return [...problems, 'sw.js: precache list not written'];
  let bytes = 0;
  for (const entry of list) {
    const path = join(outDir, entry === './' ? './index.html' : entry);
    if (existsSync(path)) bytes += statSync(path).size;
    else problems.push(`sw.js: precache missing ${entry}`);
  }
  if (bytes > MAX_SHELL_BYTES) problems.push(`sw.js: app shell is over 2 MB (${bytes} bytes)`);
  return problems;
}

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (entry.name === 'vendor') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(path));
    else files.push(path);
  }
  return files;
}

const isManifest = file => file.endsWith('.webmanifest') || /^manifest.*\.json$/.test(basename(file));

function checkOutput(outDir) {
  const problems = [];
  for (const file of walk(outDir)) {
    const ext = extname(file);
    if (ext === '.js' || ext === '.html') {
      const text = readFileSync(file, 'utf8');
      problems.push(...findForbidden(file, text), ...checkRefs(file, text, existsSync));
      if (ext === '.html') problems.push(...checkHtml(file, text));
    } else if (isManifest(file)) problems.push(...checkManifest(file, readFileSync(file, 'utf8')));
  }
  const sw = join(outDir, 'sw.js');
  if (existsSync(sw)) problems.push(...checkPrecache(readFileSync(sw, 'utf8'), outDir).map(p => p.replace(/^sw\.js/, sw)));
  return problems;
}

function checkDataDir(dataDir) {
  if (!existsSync(dataDir)) return [];
  const problems = []; const parsed = new Map();
  const files = readdirSync(dataDir).filter(f => f.endsWith('.json')).sort();
  for (const f of files) {
    const path = join(dataDir, f);
    try { parsed.set(f, JSON.parse(readFileSync(path, 'utf8'))); } catch { problems.push(`${path}: not valid JSON`); }
  }
  const groups = parsed.get('tags.json')?.groups;
  const tagIds = Array.isArray(groups) ? new Set(groups.flatMap(g => (g.tags ?? []).map(t => t.id))) : undefined;
  for (const [f, json] of parsed) problems.push(...checkData(join(dataDir, f), json, { tagIds }));
  return problems;
}

export async function runChecks({ srcDir, outputs = [], extraHtml = [] }) {
  const problems = [];
  for (const outDir of outputs) problems.push(...checkOutput(outDir));
  for (const file of extraHtml) problems.push(...checkHtml(file, readFileSync(file, 'utf8')));
  problems.push(...checkDataDir(join(srcDir, 'data')));
  return problems;
}
