// Hides the difference between a browser tab and the Tactilume Android app. Inside the
// app the page talks to Kotlin through a WebMessageListener object, TactilumeNative;
// everywhere else it uses the web platform's own features and falls back gently when
// one is missing or refused. Nothing here throws: every result is {ok, ...}.

const APP_ORIGIN = 'https://appassets.androidplatform.net';
// Raw bytes per chunk message. Base64 turns 3 bytes into 4 characters, so 384 KiB of
// bytes becomes exactly 512 KiB of text, the most one message may carry.
const CHUNK_BYTES = 384 * 1024;
// btoa() is fed pieces of a multiple of 3 bytes so no padding lands mid-string and the
// pieces join into one valid base64 text; small pieces keep each call cheap.
const ENCODE_BYTES = 3 * 8192;
const HELLO_WAIT_MS = 1000;
// The app gets at least 20 s to finish a file after the last chunk, plus 2 s per MB,
// which covers slow storage on old phones writing a long video.
const DONE_WAIT_MS = 20000;
const DONE_WAIT_PER_MB = 2000;
const VIBRATE_GAP_MS = 40;
// iOS asks before it downloads; the object URL has to outlive that question.
const REVOKE_AFTER_MS = 120000;
const WAKE_RETRY_MS = 5000;

function findBridge() {
  try {
    const bridge = globalThis.TactilumeNative;
    if (bridge && typeof bridge.postMessage === 'function' && location.origin === APP_ORIGIN) return bridge;
  } catch {
    // reading an injected host object can throw in unusual embeddings; treat as a browser
  }
  return null;
}

function readBytes(blob) {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer().then((b) => new Uint8Array(b));
  // older WebViews have Blob without arrayBuffer()
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result));
    reader.onerror = () => reject(reader.error || new Error('read failed'));
    reader.readAsArrayBuffer(blob);
  });
}

function toBase64(bytes) {
  const parts = [];
  for (let i = 0; i < bytes.length; i += ENCODE_BYTES) {
    parts.push(btoa(String.fromCharCode.apply(null, bytes.subarray(i, i + ENCODE_BYTES))));
  }
  return parts.join('');
}

const isBlob = (b) => !!b && typeof b.size === 'number' && typeof b.slice === 'function';
const optionalString = (v) => (typeof v === 'string' && v ? v : undefined);

function touchFirst() {
  try {
    return matchMedia('(pointer: coarse)').matches;
  } catch {
    return (navigator.maxTouchPoints || 0) > 0;
  }
}

function canShare(data) {
  try {
    return typeof navigator.share === 'function' && (typeof navigator.canShare !== 'function' || navigator.canShare(data));
  } catch {
    return false;
  }
}

// The old copy route: a selected, invisible text area and execCommand('copy').
function legacyCopy(text) {
  if (!document.body) return false;
  const area = document.createElement('textarea');
  const focused = document.activeElement;
  area.value = text;
  area.setAttribute('readonly', '');
  area.setAttribute('aria-hidden', 'true');
  // 16px stops iOS zooming in on focus; off-screen keeps it out of sight
  area.style.cssText = 'position:fixed;top:0;left:-9999px;width:1px;height:1px;opacity:0;font-size:16px;';
  document.body.appendChild(area);
  let ok = false;
  try {
    area.select();
    area.setSelectionRange(0, text.length);
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  area.remove();
  try {
    if (focused && typeof focused.focus === 'function') focused.focus({ preventScroll: true });
  } catch {
    // focus can be refused (element gone); nothing to restore then
  }
  return ok;
}

async function copyText(text) {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // refused (no permission, page not focused): the old route below may still work
  }
  return legacyCopy(text);
}

function download(blob, name) {
  let url = '';
  try {
    url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.rel = 'noopener';
    a.hidden = true;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
    return { ok: true, where: 'downloads' };
  } catch (e) {
    console.warn('Tactilume: could not start the download', e);
    if (url) URL.revokeObjectURL(url);
    return { ok: false, error: 'Could not save the file.' };
  }
}

function fullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

export function createPlatform() {
  const bridge = findBridge();
  const native = !!bridge;
  let info = Object.freeze({ native });

  // ---- talking to the app ------------------------------------------------------------
  const transfers = new Map(); // id -> { finish(result) }
  let transferCount = 0;
  let queue = Promise.resolve();
  let backHandler = null;
  let helloDone = null;

  function send(msg) {
    try {
      bridge.postMessage(JSON.stringify(msg));
      return true;
    } catch (e) {
      console.warn('Tactilume: the app did not take a message', e);
      return false;
    }
  }

  function answerBack() {
    let result = false;
    try {
      result = backHandler ? backHandler() : false;
    } catch (e) {
      console.warn('Tactilume: the back handler failed', e);
    }
    // a handler may answer later (a promise); the app waits for this reply either way
    Promise.resolve(result).then((handled) => send({ t: 'back', handled: !!handled }), () => send({ t: 'back', handled: false }));
  }

  function onAppMessage(event) {
    let msg = event && event.data;
    if (typeof msg === 'string') {
      try { msg = JSON.parse(msg); } catch { return; }
    }
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'hello') {
      const sdk = Number(msg.sdk);
      info = Object.freeze({
        native: true,
        version: optionalString(msg.version),
        sdk: Number.isFinite(sdk) ? sdk : undefined,
        device: optionalString(msg.device),
      });
      if (helloDone) helloDone(info);
    } else if (msg.t === 'done') {
      const transfer = transfers.get(String(msg.id));
      if (!transfer) return;
      const result = { ok: !!msg.ok };
      if (optionalString(msg.where)) result.where = msg.where;
      if (!result.ok) result.error = optionalString(msg.error) || 'Could not save the file.';
      transfer.finish(result);
    } else if (msg.t === 'back') {
      answerBack();
    }
  }

  // Streams one file to the app: begin, the bytes as base64 chunks in order, end, then
  // waits for the app's done. Slices are read one at a time so a long video never sits
  // in memory as one huge string.
  function transfer(blob, name, mime, action, text) {
    const id = `f${Date.now().toString(36)}${(++transferCount).toString(36)}`;
    return new Promise((resolve) => {
      let settled = false;
      let timer = 0;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        transfers.delete(id);
        resolve(result);
      };
      const fail = (error) => {
        send({ t: 'abort', id });
        finish({ ok: false, error });
      };
      transfers.set(id, { finish });

      (async () => {
        if (!send({ t: 'begin', id, name, mime, size: blob.size })) return fail('Could not reach the app.');
        for (let offset = 0, seq = 0; offset < blob.size; offset += CHUNK_BYTES, seq++) {
          const bytes = await readBytes(blob.slice(offset, offset + CHUNK_BYTES));
          if (settled) return; // the app answered early, for example to refuse the file
          if (!send({ t: 'chunk', id, seq, data: toBase64(bytes) })) return fail('Could not reach the app.');
        }
        const end = { t: 'end', id, action };
        if (text) end.text = String(text);
        if (!send(end)) return fail('Could not reach the app.');
        timer = setTimeout(() => fail('The app did not answer in time.'), DONE_WAIT_MS + (blob.size / 1e6) * DONE_WAIT_PER_MB);
      })().catch((e) => {
        console.warn('Tactilume: could not read the file for the app', e);
        fail('Could not read the file.');
      });
    });
  }

  // one file at a time, so the app never has to untangle two streams
  function queued(fn) {
    const run = queue.then(fn);
    queue = run.catch(() => {});
    return run;
  }

  const ready = native
    ? new Promise((resolve) => {
      helloDone = resolve;
      setTimeout(() => resolve(info), HELLO_WAIT_MS); // an older app may never answer
    })
    : Promise.resolve(info);

  if (native) {
    try {
      if (typeof bridge.addEventListener === 'function') bridge.addEventListener('message', onAppMessage);
      else bridge.onmessage = onAppMessage;
    } catch (e) {
      console.warn('Tactilume: could not listen to the app', e);
    }
    send({ t: 'hello' });
  }

  // ---- keeping the screen on -------------------------------------------------------------
  let wantAwake = false;
  let wakeLock = null;
  let wakeRequest = null;
  let lastWakeTry = -Infinity;

  async function acquireWakeLock() {
    if (!wantAwake || wakeLock || wakeRequest || document.hidden) return;
    if (!navigator.wakeLock || typeof navigator.wakeLock.request !== 'function') return;
    lastWakeTry = performance.now();
    try {
      wakeRequest = navigator.wakeLock.request('screen');
      const lock = await wakeRequest;
      if (!wantAwake) {
        lock.release().catch(() => {});
        return;
      }
      wakeLock = lock;
      // the browser drops the lock by itself when the page is hidden
      lock.addEventListener('release', () => { if (wakeLock === lock) wakeLock = null; });
    } catch {
      // refused (battery saver, permissions policy): the screen just sleeps as usual
    } finally {
      wakeRequest = null;
    }
  }

  function releaseWakeLock() {
    const lock = wakeLock;
    wakeLock = null;
    if (lock) lock.release().catch(() => {});
  }

  if (!native) {
    document.addEventListener('visibilitychange', () => { if (!document.hidden) acquireWakeLock(); });
    // some browsers only grant the lock after a tap, so try again on one (not too often)
    addEventListener('pointerdown', () => {
      if (wantAwake && !wakeLock && performance.now() - lastWakeTry > WAKE_RETRY_MS) acquireWakeLock();
    }, { capture: true, passive: true });
  }

  let lastBuzz = -Infinity;

  return {
    native,
    get info() { return info; },
    // resolves with info once the app has said hello (or after 1 s without an answer)
    ready,

    async saveFile(blob, name, mime) {
      if (!isBlob(blob)) return { ok: false, error: 'There was nothing to save.' };
      const type = mime || blob.type || 'application/octet-stream';
      if (native) return queued(() => transfer(blob, name, type, 'save'));
      return download(blob, name);
    },

    async shareFile(blob, name, mime, text) {
      if (!isBlob(blob)) return { ok: false, error: 'There was nothing to share.' };
      const type = mime || blob.type || 'application/octet-stream';
      if (native) return queued(() => transfer(blob, name, type, 'share', text));
      let file = null;
      try {
        file = new File([blob], name, { type });
      } catch {
        // very old browsers have no File constructor; saving still works
      }
      if (file) {
        const data = { files: [file], title: 'Tactilume' };
        if (text) data.text = String(text);
        if (canShare(data)) {
          try {
            await navigator.share(data);
            return { ok: true };
          } catch (e) {
            if (e && e.name === 'AbortError') return { ok: false, error: 'cancelled' };
            // anything else (no tap to go on, a refusing share target): save instead
          }
        }
      }
      return download(blob, name);
    },

    async shareLink(url, text) {
      const link = String(url);
      // the share sheet suits phones and tablets; on a desktop, copying is what people expect
      if (touchFirst()) {
        const data = { url: link, title: text ? String(text) : 'Tactilume' };
        if (text) data.text = String(text);
        if (canShare(data)) {
          try {
            await navigator.share(data);
            return { ok: true };
          } catch (e) {
            if (e && e.name === 'AbortError') return { ok: false, error: 'cancelled' };
          }
        }
      }
      if (await copyText(link)) return { ok: true, copied: true };
      return { ok: false, error: 'Could not share or copy the link.' };
    },

    vibrate(ms) {
      const duration = Math.round(Number(ms));
      if (!(duration > 0)) return false;
      const now = performance.now();
      if (now - lastBuzz < VIBRATE_GAP_MS) return false;
      lastBuzz = now;
      const d = Math.min(duration, 1000);
      if (native) return send({ t: 'vibrate', ms: d });
      try {
        return typeof navigator.vibrate === 'function' && navigator.vibrate(d) === true;
      } catch {
        return false;
      }
    },

    keepAwake(on) {
      wantAwake = !!on;
      if (native) {
        send({ t: 'awake', on: wantAwake });
        return;
      }
      if (wantAwake) acquireWakeLock();
      else releaseWakeLock();
    },

    // the app is always immersive, so it offers no fullscreen switch of its own
    canFullscreen() {
      if (native) return false;
      return !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
    },

    isFullscreen() {
      return native || !!fullscreenElement();
    },

    // resolves false when the browser cannot or will not do it; the older webkit calls
    // give no answer, so for them true means the request was made
    async setFullscreen(on) {
      if (native) return true;
      const want = !!on;
      if (want === !!fullscreenElement()) return true;
      const el = document.documentElement;
      try {
        if (want) {
          if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
          else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
          else return false;
        } else if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        else return false;
        return true;
      } catch {
        // refused (no tap to go on, or an iframe without permission)
        return false;
      }
    },

    // fn(isFullscreen) whenever fullscreen starts or ends; returns off()
    onFullscreenChange(fn) {
      if (native) return () => {};
      const handler = () => fn(!!fullscreenElement());
      document.addEventListener('fullscreenchange', handler);
      document.addEventListener('webkitfullscreenchange', handler);
      return () => {
        document.removeEventListener('fullscreenchange', handler);
        document.removeEventListener('webkitfullscreenchange', handler);
      };
    },

    // Android Back. In a browser tab Back belongs to the browser, so nothing is hooked.
    onBack(fn) {
      if (!native) return () => {};
      backHandler = fn;
      return () => { if (backHandler === fn) backHandler = null; };
    },

    // opens a web page outside Tactilume; returns false when the address is not allowed
    open(url) {
      let target;
      try {
        target = new URL(String(url), location.href);
      } catch {
        return false;
      }
      if (native) return target.protocol === 'https:' && send({ t: 'open', url: target.href });
      if (!['https:', 'http:', 'mailto:'].includes(target.protocol)) return false;
      try {
        window.open(target.href, '_blank', 'noopener');
        return true;
      } catch {
        return false;
      }
    },
  };
}
