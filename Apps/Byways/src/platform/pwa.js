import { isHttpUrl } from '../core/util/url.js';
import { createNoVoice } from './web-voice.js';
import { createWebTts } from './web-tts.js';
import { createWebMedia, createWebWakeLock } from './web-media.js';

const REVOKE_AFTER_MS = 1000;

/**
 * The Platform the installable web app boots with.
 * @param {{secretsStore: *, win?: *}} deps  secretsStore is a Store; win is the browser window
 * @returns {import('../core/types.js').Platform}
 */
export function createPwaPlatform({ secretsStore, win = globalThis }) {
  const nav = win.navigator;

  async function share(data) {
    if (nav.share && nav.canShare?.(data) !== false) {
      try {
        await nav.share(data);
        return 'shared';
      } catch (e) {
        if (e?.name === 'AbortError') return 'cancelled';
      }
    }
    try {
      await nav.clipboard.writeText(data.url || data.text || data.title);
      return 'copied';
    } catch {
      return 'cancelled';
    }
  }

  async function openFind(find, how = 'tab') {
    if (!isHttpUrl(find.url)) throw new Error('not an http(s) link');
    if (how === 'current') win.location.assign(find.url);
    else win.open(find.url, '_blank', 'noopener');
  }

  const files = {
    async save(name, blob) {
      const url = win.URL.createObjectURL(blob);
      const a = win.document.createElement('a');
      a.href = url;
      a.download = name;
      win.document.body.append(a);
      a.click();
      a.remove();
      win.setTimeout(() => win.URL.revokeObjectURL(url), REVOKE_AFTER_MS);
    },
    pick(accept, multiple = false) {
      return new Promise(resolve => {
        const input = win.document.createElement('input');
        input.type = 'file';
        input.accept = accept;
        input.multiple = multiple;
        input.addEventListener('change', () => resolve(Array.from(input.files)));
        input.addEventListener('cancel', () => resolve([]));
        input.click();
      });
    },
  };

  return {
    name: 'pwa',
    transport: {
      fetch(url, init = {}) {
        const { privileged, ...rest } = init;
        return win.fetch(url, { ...rest, credentials: 'omit' });
      },
    },
    voice: createNoVoice(),
    tts: createWebTts(win.speechSynthesis),
    share,
    openFind,
    files,
    media: createWebMedia(nav),
    wakeLock: createWebWakeLock(nav, win.document),
    secrets: {
      async get(id) { return (await secretsStore.get('keys', id)) ?? null; },
      async set(id, value) { await secretsStore.put('keys', id, value); },
      async delete(id) { await secretsStore.delete('keys', id); },
      list: () => secretsStore.keys('keys'),
    },
    caps: { privilegedFetch: false, localNetworkHttp: false, inAppSiteView: false, labHref: 'lab/', framesArchive: true },
    async persistStorage() {
      try {
        return (await nav.storage?.persist?.()) === true;
      } catch {
        return false;
      }
    },
    async requestOrigins() { return true; },
  };
}

/**
 * Register the service worker and report waiting or newly installed updates. Resolves null when
 * there is no service worker to register (the Android shell, no support, a refused registration).
 * @param {*} win
 * @param {(reg: ServiceWorkerRegistration) => void} onUpdate
 * @returns {Promise<ServiceWorkerRegistration|null>}
 */
export async function registerServiceWorker(win, onUpdate) {
  try {
    if (win.BywaysNative) return null;
    const container = win.navigator.serviceWorker;
    if (!container) return null;
    const reg = await container.register('./sw.js');
    if (!reg) return null;
    if (reg.waiting && container.controller) onUpdate(reg);
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && container.controller) onUpdate(reg);
      });
    });
    return reg;
  } catch {
    return null;
  }
}
