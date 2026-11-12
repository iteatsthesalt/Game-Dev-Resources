// Eye adaptation and the flash guard. One workgroup per frame reads the smallest bloom level
// (a blurred thumbnail of the light) and updates a state that remembers the last frame:
//   x: the adapted scene brightness (slow), which drives auto exposure
//   y: the guarded on-screen brightness, which may only rise so fast
//   z: the exposure multiplier the composite uses
//   w: 1 once the state holds real values
// engine.js puts common.wgsl in front of this file. A port of the mobile edition's ADAPT_FS
// (post.glsl.js); mobile kept the state as float bits in a 1x1 integer texture, which a
// 16-byte storage buffer does exactly here.

struct Exposure {
  dt: f32,          // s since last frame, at least 1 ms
  base: f32,        // the scene's exposure, as a multiplier
  amount: f32,      // 0..1, how strongly to adapt
  guard: f32,       // 1: limit how fast the screen may brighten
  rise: f32,        // the allowed rise, in e-folds per second
  glowGain: f32,    // how much bloom the composite adds on top, so Glow is guarded too
};

@group(0) @binding(0) var<uniform> X: Exposure;
@group(0) @binding(1) var thumbnail: texture_2d<f32>;
@group(0) @binding(3) var<storage, read_write> state: vec4f;

const THREADS = 64u;
var<workgroup> partial: array<f32, 64>;

// The brightness is the mean of every texel of the thumbnail. Mobile sampled 16 fixed points,
// which is fair only while the thumbnail is tiny: the bloom chain stops at 7 levels, so at
// 1440p and 4K the thumbnail is 20x12 to 30x17 texels and 16 points leave whole areas unseen,
// the middle of the screen worst of all, where light gathers. A flash there would pass the
// guard unmeasured. 64 threads share the texels (at most a few thousand) and add up.
@compute @workgroup_size(64)
fn adapt(@builtin(local_invocation_index) i: u32) {
  let size = textureDimensions(thumbnail);
  let count = size.x * size.y;
  var mine = 0.0;
  for (var t = i; t < count; t += THREADS) {
    var c = textureLoad(thumbnail, vec2u(t % max(size.x, 1u), t / max(size.x, 1u)), 0).rgb;
    if (bad3(c)) { c = vec3f(0.0); }
    mine += dot(clamp(c, vec3f(0.0), vec3f(30000.0)), LUMA);
  }
  partial[i] = mine;
  workgroupBarrier();
  for (var stride = THREADS / 2u; stride > 0u; stride = stride / 2u) {
    if (i < stride) { partial[i] += partial[i + stride]; }
    workgroupBarrier();
  }
  if (i != 0u) { return; }
  let L = max(partial[0] / f32(max(count, 1u)), 0.0); // nonzero: at least one texel
  let prev = state;
  // never written (zero), or broken: start afresh
  let first = !(prev.w > 0.5) || badf(prev.w) || bad3(prev.xyz) || prev.z <= 0.0;
  let tau = select(1.3, 0.45, L > prev.x);
  let La = select(prev.x + (L - prev.x) * (1.0 - exp(-X.dt / tau)), L, first); // nonzero: tau is 0.45 or 1.3
  let e = clamp(pow(0.06 / max(La, 0.0005), X.amount), 0.35, 3.5) * X.base; // non-negative: 0.06 over a positive number
  // what reaches the screen includes the bloom the composite adds
  let D = L * (1.0 + X.glowGain) * e;
  let Dg = select(prev.y, D, first);
  let allowed = Dg * exp(X.rise * X.dt) + 0.02 * X.dt;
  let shown = select(D, min(D, allowed), X.guard > 0.5);
  let k = select(1.0, shown / max(D, 1e-6), D > 1e-6);
  var next = vec4f(La, shown, e * k, 1.0);
  // never let a bad value stick: NaN or infinity starts afresh next frame
  if (bad3(next.xyz)) { next = vec4f(0.0); }
  state = next;
}
