// STUB: replaced by the real module. Matches CONTRACTS.md so the app builds.
export function createPlatform() {
  return {
    native: false,
    info: { native: false },
    async saveFile() { return { ok: false, error: 'not built yet' }; },
    async shareFile() { return { ok: false, error: 'not built yet' }; },
    async shareLink() { return { ok: false, error: 'not built yet' }; },
    vibrate() {},
    keepAwake() {},
    canFullscreen: () => false,
    isFullscreen: () => false,
    setFullscreen() {},
    onBack() {},
  };
}
