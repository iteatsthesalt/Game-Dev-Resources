/**
 * Lock-screen and headset controls through the Media Session API.
 * @param {Navigator} navigator
 * @returns {import('../core/types.js').Platform['media']}
 */
export function createWebMedia(navigator) {
  const session = navigator.mediaSession;
  const bind = (action, fn) => {
    try { session.setActionHandler(action, fn); } catch { /* this browser lacks the action */ }
  };
  return {
    setHandlers({ next, previous, playPause }) {
      if (!session) return;
      bind('nexttrack', next);
      bind('previoustrack', previous);
      bind('play', playPause);
      bind('pause', playPause);
    },
    setActive(on) {
      if (session) session.playbackState = on ? 'playing' : 'none';
    },
  };
}

/**
 * Keeps the screen awake while wanted. The browser drops the lock when the page is hidden, so it is
 * requested again when the page becomes visible.
 * @param {Navigator} navigator
 * @param {Document} document
 * @returns {import('../core/types.js').Platform['wakeLock']}
 */
export function createWebWakeLock(navigator, document) {
  let wanted = false;
  let sentinel = null;

  async function acquire() {
    if (!navigator.wakeLock) return;
    try {
      sentinel = await navigator.wakeLock.request('screen');
    } catch { /* refused: the screen may simply sleep */ }
  }

  const needsLock = () => wanted && (!sentinel || sentinel.released);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && needsLock()) acquire();
  });

  return {
    async on() {
      wanted = true;
      if (needsLock()) await acquire();
    },
    async off() {
      wanted = false;
      const held = sentinel;
      sentinel = null;
      try { await held?.release(); } catch { /* already released */ }
    },
  };
}
