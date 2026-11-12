#!/usr/bin/env node
// Builds dist/ from src/: Electron's main and preload scripts, the desktop renderer, the
// controller page served to phones, and a copy of the mobile edition as the fallback engine.
//   node tools/build.mjs
//
// Esbuild warnings count as errors: each one it reports (an import that does not exist,
// `import.meta` in a CommonJS bundle, a comparison that is always false) is a real bug.
//
// Several people build and test in this tree at once, so every file is written under a
// temporary name and then renamed into place. A test reading dist/ mid-build sees the old
// file or the new one, never half of one.
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const CLASSIC = path.join(root, '..', 'Tactilume', 'Tactilume.html');

const node = { platform: 'node', format: 'cjs', target: 'node22', external: ['electron'] };
const BUNDLES = [
  // A sandboxed preload cannot be an ES module, so both Node-side bundles are CommonJS.
  // ws's optional native speed-ups are left out; ws falls back to plain JavaScript.
  { entry: 'src/main/main.js', out: 'main.cjs', ...node, external: ['electron', 'bufferutil', 'utf-8-validate'] },
  { entry: 'src/preload/preload.js', out: 'preload.cjs', ...node },
  // The renderer runs in Electron's Chromium; its WGSL shaders are imported as strings.
  { entry: 'src/renderer/main.js', out: 'renderer/app.js', platform: 'browser', format: 'esm', target: 'chrome130' },
  // Phones run whatever browser they have, so this one is a classic script for older engines
  // (iOS 15 and Android Chrome 100 onward).
  { entry: 'src/phone/phone.js', out: 'phone/phone.js', platform: 'browser', format: 'iife', target: ['safari15', 'chrome100'] },
];

const COPIES = [
  ['src/renderer/index.html', 'renderer/index.html'],
  ['src/renderer/style.css', 'renderer/style.css'],
  ['src/phone/index.html', 'phone/index.html'],
  ['src/phone/phone.css', 'phone/phone.css'],
];

function writeAtomic(rel, contents) {
  const file = path.join(dist, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, contents);
  fs.renameSync(temp, file);
  return contents.length;
}

async function bundle({ entry, out, ...options }) {
  const result = await build({
    absWorkingDir: root,
    entryPoints: [entry],
    outfile: path.join(dist, out),
    bundle: true,
    write: false,
    loader: { '.wgsl': 'text' },
    charset: 'utf8',
    legalComments: 'none',
    logLevel: 'silent',
    ...options,
  });
  if (result.warnings.length) throw Object.assign(new Error(`${entry} built with warnings`), { warnings: result.warnings });
  return result.outputFiles.map((f) => [path.relative(dist, f.path), f.contents]);
}

async function main() {
  const t0 = Date.now();
  if (!fs.existsSync(CLASSIC)) {
    throw new Error(`The fallback engine is missing: ${CLASSIC}. Build the mobile edition first (cd ../Tactilume && npm run build).`);
  }
  // Bundle everything before writing anything, so a failed build leaves dist/ as it was.
  const outputs = (await Promise.all(BUNDLES.map(bundle))).flat();
  for (const [from, to] of COPIES) outputs.push([to, fs.readFileSync(path.join(root, from))]);
  outputs.push(['classic/index.html', fs.readFileSync(CLASSIC)]);

  const sizes = outputs.map(([rel, contents]) => `${rel} ${(writeAtomic(rel, contents) / 1024).toFixed(0)} KB`);
  console.log(`built dist/ in ${((Date.now() - t0) / 1000).toFixed(1)} s: ${sizes.join(', ')}`);
}

main().catch((e) => {
  // esbuild's messages carry the file, line and text of each problem
  const messages = [...(e.errors || []), ...(e.warnings || [])];
  for (const m of messages) {
    const where = m.location ? `${m.location.file}:${m.location.line}:${m.location.column}: ` : '';
    console.error(`${where}${m.text}${m.location ? `\n    ${m.location.lineText}` : ''}`);
  }
  console.error(`build failed: ${e.message}`);
  process.exit(1);
});
