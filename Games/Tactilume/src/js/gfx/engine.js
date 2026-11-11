// STUB: replaced by the real engine. Matches CONTRACTS.md so the app builds.
export function createEngine(canvas, opts = {}) {
  const gl = canvas.getContext('webgl2');
  if (!gl) throw new Error('webgl2');
  let w = 1, h = 1, dpr = 1, particles = 0, renderScale = 1;
  const engine = {
    caps: { maxParticles: 1 << 18, tier: 'mid', renderer: 'stub', halfFloat: true },
    get aspect() { return w / h; },
    resize(cw, ch, d) { w = cw; h = ch; dpr = d; canvas.width = Math.round(cw * d); canvas.height = Math.round(ch * d); canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px'; },
    setQuality(q) { particles = q.particles; renderScale = q.renderScale; },
    frame(f) { gl.clearColor(0.02, 0.01, 0.03, 1); gl.clear(gl.COLOR_BUFFER_BIT); },
    pulse() {},
    release() {},
    screenToWorld(px, py) { const a = w / h; return { x: (px / w * 2 - 1) * a, y: 1 - py / h * 2 }; },
    worldToScreen(x, y) { const a = w / h; return { px: (x / a + 1) * 0.5 * w, py: (1 - y) * 0.5 * h }; },
    capture(mime = 'image/png') { return new Promise((res) => canvas.toBlob(res, mime)); },
    captureStream(fps) { return canvas.captureStream(fps); },
    get stats() { return { particles, renderScale, width: canvas.width, height: canvas.height }; },
    dispose() {},
  };
  return engine;
}
