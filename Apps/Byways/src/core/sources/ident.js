import { APP_VERSION } from '../version.js';

/**
 * The value of the Api-User-Agent and AIC-User-Agent headers. It lives here, not in index.js, because index.js
 * imports the adapters: an adapter that read it from index.js would hit that import cycle.
 */
export const IDENT = `Byways/${APP_VERSION} (+https://github.com/iteatsthesalt/Game-Dev-Resources)`;
