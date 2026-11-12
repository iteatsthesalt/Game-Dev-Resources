// Eye adaptation and the flash guard. One invocation per frame reads the smallest bloom level
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
@group(0) @binding(2) var linearSampler: sampler;
@group(0) @binding(3) var<storage, read_write> state: vec4f;

@compute @workgroup_size(1)
fn adapt() {
  var sum = 0.0;
  for (var y = 0; y < 4; y++) {
    for (var x = 0; x < 4; x++) {
      var c = textureSampleLevel(thumbnail, linearSampler, (vec2f(f32(x), f32(y)) + 0.5) * 0.25, 0.0).rgb;
      if (bad3(c)) { c = vec3f(0.0); }
      sum += dot(clamp(c, vec3f(0.0), vec3f(30000.0)), LUMA);
    }
  }
  let L = max(sum / 16.0, 0.0);
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
