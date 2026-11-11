// STUB: replaced by the real module. Matches CONTRACTS.md so the app builds.
export function createUI({ root, store, actions, platform, audio, capture }) {
  let open = false;
  return {
    update() {},
    showBehaviour() {},
    toast() {},
    announce() {},
    open() { open = true; },
    close() { open = false; },
    isOpen: () => open,
    back() { if (open) { open = false; return true; } return false; },
    setHidden() {},
  };
}
