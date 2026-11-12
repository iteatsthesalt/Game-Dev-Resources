import { APP_VERSION } from '../version.js';

/**
 * The value of the Api-User-Agent and AIC-User-Agent headers. Adapters read it inside functions only:
 * this module imports the adapters, so a top-level read in an adapter would hit the import cycle.
 */
export const IDENT = `Byways/${APP_VERSION} (+https://github.com/iteatsthesalt/Game-Dev-Resources)`;

/**
 * Source ids that never get an `http.register` call. Plan 04's Archive queue alone paces and backs off
 * these sources; a registered source would also get Http's pause after a 429.
 */
export const SELF_PACED = new Set(['ia', 'vault']);

// Each adapter task adds one import above this line and one entry below it.
const ADAPTERS = [];

/** id -> adapter, in the order of ADAPTERS. */
export const SOURCES = Object.fromEntries(ADAPTERS.map(adapter => [adapter.id, adapter]));

/** @returns {object|undefined} */
export function getSource(id) {
  return Object.hasOwn(SOURCES, id) ? SOURCES[id] : undefined;
}

/**
 * The adapters that may serve a Find now. A source is in when its setting says enabled, or when the setting is
 * absent and it needs no required key. A navigate source makes no data calls, so it is never in. On the web app
 * a probe source also needs a passing reachability probe. A privileged source stays in everywhere (the web app
 * reads its daily snapshot instead).
 */
export function enabledSources(settings, probe, platformName, all = Object.values(SOURCES)) {
  return all.filter(adapter => {
    if (adapter.tier === 'navigate') return false;
    const enabled = settings.sources?.[adapter.id]?.enabled;
    if (enabled === false) return false;
    if (enabled !== true && adapter.key === 'required') return false;
    if (adapter.tier === 'probe' && platformName === 'pwa') return probe?.[adapter.id] === 'ok';
    return true;
  });
}
