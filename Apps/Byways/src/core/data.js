// The one data loader. DOM-free, so the extension's background can import it too.
export const DATA_FILES = {
  tags: 'tags.json', library: 'library.json', vaultStarter: 'vault-starter.json', geocities: 'geocities-seeds.json',
};

export const EMPTY_DATA = {
  tags: { v: 1, groups: [] },
  library: { v: 1, entries: [] },
  vaultStarter: { v: 1, entries: [] },
  geocities: { v: 1, urls: [] },
};

const PAGES_URL = 'https://iteatsthesalt.github.io/Game-Dev-Resources/byways/';

/** The PWA ships the generated files beside the app; the other builds read them from GitHub Pages. */
export function dataUrlFor(platformName, file) {
  return (platformName === 'pwa' ? 'data/' : `${PAGES_URL}data/`) + file;
}

async function readJson(fetchFn, base, key, file) {
  try {
    const response = await fetchFn(new URL('data/' + file, base).href);
    if (!response.ok) return structuredClone(EMPTY_DATA[key]);
    return await response.json();
  } catch {
    return structuredClone(EMPTY_DATA[key]);
  }
}

/**
 * Read the four data files. Anything that fails to load or parse becomes its empty shape.
 * `dataUrl` and `store` are accepted for the callers that will need them and are unused for now.
 */
export async function loadAppData({ fetchFn, base, dataUrl, http, store }) {
  http.register('pages', { perMinute: 30, concurrent: 2 });
  const keys = Object.keys(DATA_FILES);
  const values = await Promise.all(keys.map(key => readJson(fetchFn, base, key, DATA_FILES[key])));
  return Object.fromEntries(keys.map((key, i) => [key, values[i]]));
}
