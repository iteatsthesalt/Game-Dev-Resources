// The only bridge between the sandboxed renderer and the main process: window.tactilume.
// See CONTRACTS.md, "preload/preload.js". The renderer gets these functions and nothing
// else; it never sees ipcRenderer, Node or the network.
//
// The bridge passes arguments through as they are: main checks every one, so a page that
// skipped this file could not do more than a page that uses it. What it guards here is what
// main cannot see: a listener gets the event's data only, never the IPC event object (whose
// `sender` would hand the page ipcRenderer itself).
import { contextBridge, ipcRenderer } from 'electron';

// main.js passes the app version on the command line (webPreferences.additionalArguments)
const versionArg = process.argv.find((a) => a.startsWith('--tactilume-version='));

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('tactilume', {
  version: versionArg ? versionArg.slice('--tactilume-version='.length) : '0.0.0',
  platform: process.platform,
  link: {
    info: () => invoke('link:info'),
    setAllowNew: (on) => invoke('link:allowNew', on),
    rotateToken: () => invoke('link:rotate'),
    send: (player, msg) => invoke('link:send', player, msg),
    // → a function that stops listening
    onEvent(fn) {
      if (typeof fn !== 'function') throw new TypeError('link.onEvent takes a function');
      const listener = (_event, e) => fn(e);
      ipcRenderer.on('link:event', listener);
      return () => { ipcRenderer.removeListener('link:event', listener); };
    },
  },
  app: {
    getSettings: () => invoke('app:settings:get'),
    setSettings: (partial) => invoke('app:settings:set', partial),
    setFullscreen: (on) => invoke('app:fullscreen', on),
    isFullscreen: () => invoke('app:fullscreen'),
    gpuInfo: () => invoke('app:gpu'),
    ready: () => invoke('app:ready'),
    quit: () => invoke('app:quit'),
  },
  audio: {
    systemSupport: () => invoke('audio:support'),
  },
});
