// How much light each speck carries, how far it may go above that, and how quickly trails
// fade: the mobile edition's energy normalisation, adapted to the desktop's half-float light.
// Pure, so tests/unit/engine-light.test.js checks the numbers without a GPU.

// The most of last frame's light a frame keeps. Mobile caps the fade at 0.994 to protect its
// 8-bit targets; above about 120 Hz that cap shortened long trails (at 240 Hz, trails at 1
// lasted half as long as at 60 Hz). The light here is rgba16float, which still decays at any
// factor below 1 - 2^-11 (0.99951), so the cap can sit at 0.998: trails last as long up to
// about 360 Hz.
export const KEEP_MAX = 0.998;
export const REF_COUNT = 262144; // the count the mobile edition's energy is tuned around

// → { keep, trailNorm, energy, energyCap, pxScale, basePx }
//   keep       the share of last frame's light kept this frame (0 with no trails)
//   trailNorm  how much light a frame adds, so the trails' total stays even whatever their length
//   energy     the light one resting speck adds this frame
//   energyCap  the most one speck may add (hot light and sparkle peaks reach above energy)
//   pxScale, basePx  the screen's size against 1000 px tall, and a speck's base size in px
export function speckLight({ width, height, count, size = 1, trails = 0.5, dt = 1 / 60, level = 0 }) {
  const W = Math.max(1, width), H = Math.max(1, height), N = Math.max(1, count);
  const pxScale = H / 1000;
  const basePx = Math.max(0.6, 1.45 * pxScale);
  const tau = 0.04 + trails * trails * 1.35;
  const keep = trails > 0.005 ? Math.min(Math.exp(-Math.max(dt, 0) / tau), KEEP_MAX) : 0;
  const trailNorm = Math.pow(1 - keep, 0.8);
  // Each speck carries energy * size^2, spread over the pixels it covers, and energy =
  // k * pixels / (count * size^2) keeps the frame's mean near k whatever the count and
  // resolution; more particles still add a little richness, bigger specks a little light, and
  // long trails are evened out.
  const energy = 0.055 * (W * H) / (N * basePx * basePx) * Math.pow(N / REF_COUNT, 0.3) / Math.max(size, 0.25)
    * trailNorm * (1 + level * 0.6);
  // Mobile caps each speck at 24000 / N, so the whole frame can never overflow a half float.
  // That cap does not shrink as trails lengthen, so on a phone it sits about 25 times above a
  // speck's light at trails 0.5 and 50 times at 0.8: room for hot light (about 2.5 times a
  // resting speck) and sparkle peaks (up to about 7). At desktop counts 24000 / N falls below
  // a resting speck's light, so here a speck may reach twice its light before the trails'
  // evening out (energy / trailNorm): twice at no trails, and growing with them as mobile's
  // does. The ceiling pass guards the overflow.
  const energyCap = Math.max(24000 / N, (2 * energy) / Math.max(trailNorm, 1e-3));
  return { keep, trailNorm, energy, energyCap, pxScale, basePx };
}
