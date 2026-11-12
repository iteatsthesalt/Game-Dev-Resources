// Bloom: a chain of half-size copies of the light, each blurred a little more, then added
// back up from the smallest. engine.js puts common.wgsl and screen.wgsl in front of this
// file. A port of the mobile edition's DOWN_FS and UP_FS (post.glsl.js).

struct Level {
  texel: vec2f,   // 1 / the source's size in texels
  radius: f32,    // upsample: how far apart the taps are, in source texels
  weight: f32,    // upsample: how much of the smaller level is added
  first: u32,     // downsample: 1 for the first level, read from the light itself
};

@group(0) @binding(0) var<uniform> L: Level;
@group(0) @binding(1) var source: texture_2d<f32>;
@group(0) @binding(2) var linearSampler: sampler;

// The first downsample also removes NaN and infinity, which would otherwise spread.
fn tap(uv: vec2f, off: vec2f) -> vec3f {
  var c = textureSampleLevel(source, linearSampler, uv + L.texel * off, 0.0).rgb;
  if (L.first == 1u) {
    if (bad3(c)) { c = vec3f(0.0); }
    c = clamp(c, vec3f(0.0), vec3f(30000.0));
  }
  return c;
}

// A block's weight in the Karis average: bright blocks count for less, so one hot speck
// cannot make the whole bloom flicker. Only used on the first level, where c >= 0.
fn karis(c: vec3f) -> f32 {
  return 1.0 / (1.0 + dot(c, LUMA)); // nonzero: c >= 0 here, so 1 + its luma >= 1
}

// 13-tap downsample (Jimenez, "Next generation post processing in Call of Duty: AW").
@fragment
fn down(v: Screen) -> @location(0) vec4f {
  let uv = v.uv;
  let a = tap(uv, vec2f(-2.0, 2.0));
  let b = tap(uv, vec2f(0.0, 2.0));
  let c = tap(uv, vec2f(2.0, 2.0));
  let d = tap(uv, vec2f(-2.0, 0.0));
  let e = tap(uv, vec2f(0.0, 0.0));
  let f = tap(uv, vec2f(2.0, 0.0));
  let g = tap(uv, vec2f(-2.0, -2.0));
  let h = tap(uv, vec2f(0.0, -2.0));
  let i = tap(uv, vec2f(2.0, -2.0));
  let j = tap(uv, vec2f(-1.0, 1.0));
  let k = tap(uv, vec2f(1.0, 1.0));
  let l = tap(uv, vec2f(-1.0, -1.0));
  let m = tap(uv, vec2f(1.0, -1.0));
  var r: vec3f;
  if (L.first == 1u) {
    let g0 = (j + k + l + m) * 0.25;
    let g1 = (a + b + d + e) * 0.25;
    let g2 = (b + c + e + f) * 0.25;
    let g3 = (d + e + g + h) * 0.25;
    let g4 = (e + f + h + i) * 0.25;
    let w0 = karis(g0) * 0.5;
    let w1 = karis(g1) * 0.125;
    let w2 = karis(g2) * 0.125;
    let w3 = karis(g3) * 0.125;
    let w4 = karis(g4) * 0.125;
    r = (g0 * w0 + g1 * w1 + g2 * w2 + g3 * w3 + g4 * w4) / (w0 + w1 + w2 + w3 + w4); // nonzero: every weight is > 0
  } else {
    r = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  }
  return vec4f(r, 1.0);
}

fn tapUp(uv: vec2f, off: vec2f) -> vec3f {
  return textureSampleLevel(source, linearSampler, uv + L.texel * off * L.radius, 0.0).rgb;
}

// 3x3 tent upsample, added onto the next larger level (blending one, one).
@fragment
fn up(v: Screen) -> @location(0) vec4f {
  let uv = v.uv;
  let r = tapUp(uv, vec2f(0.0, 0.0)) * 4.0
    + (tapUp(uv, vec2f(-1.0, 0.0)) + tapUp(uv, vec2f(1.0, 0.0)) + tapUp(uv, vec2f(0.0, -1.0)) + tapUp(uv, vec2f(0.0, 1.0))) * 2.0
    + tapUp(uv, vec2f(-1.0, -1.0)) + tapUp(uv, vec2f(1.0, -1.0)) + tapUp(uv, vec2f(-1.0, 1.0)) + tapUp(uv, vec2f(1.0, 1.0));
  return vec4f(r * (L.weight / 16.0), 1.0);
}
