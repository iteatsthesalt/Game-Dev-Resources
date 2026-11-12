// Gathers every scenarios-<area>.js in this folder, so each part adds its own file without
// touching a shared list. Each file's default export is an array of scenarios:
//   { name, async run(page, h) → checks[], timeout?: ms, viewport?: { width, height } }
// `h` is the helpers object from helpers.js. A scenario opens the page itself, usually with
// `await h.open(page)`, so it can set up fake gamepads or other init scripts first.
//
// A file that cannot be loaded (mid-edit, say) becomes one failing scenario named after it:
// the other files still run, and the run as a whole still fails.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

async function load(file) {
  try {
    const mod = await import(pathToFileURL(path.join(here, file)).href);
    const list = mod.default;
    if (!Array.isArray(list)) throw new Error('its default export must be an array of scenarios');
    for (const s of list) {
      if (!s || typeof s.name !== 'string' || typeof s.run !== 'function') throw new Error('every scenario needs a name and a run(page, h) function');
    }
    return list;
  } catch (e) {
    return [{ name: `${file} could not be loaded`, run: async () => { throw e; } }];
  }
}

const files = fs.readdirSync(here).filter((f) => /^scenarios-[\w-]+\.js$/.test(f)).sort();
const scenarios = (await Promise.all(files.map(load))).flat();

const names = new Set();
for (const s of scenarios) {
  if (names.has(s.name)) throw new Error(`two scenarios are called "${s.name}"; names must be unique so filters pick one`);
  names.add(s.name);
}

export default scenarios;
