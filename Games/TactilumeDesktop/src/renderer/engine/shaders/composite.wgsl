// The last pass: bloom, exposure, AgX tone mapping, lens fringe, vignette, grain and dither.
// engine.js puts common.wgsl and screen.wgsl in front of this file. A port of the mobile
// edition's COMPOSITE_FS (post.glsl.js).
//
// `sdr` writes the picture an ordinary display shows. `hdr` writes that same picture to a
// second target (photos, tests and the readback are always SDR), and to the first an
// extended-range picture for an HDR canvas (rgba16float, tone mapping "extended"), where 1.0
// is SDR white. It is the SDR picture wherever that is below white, plus the highlights the
// SDR curve had to roll off, up to `hdrPeak` times SDR white. Values on an "srgb" canvas are
// sRGB-encoded, also above 1, so it is encoded the same way.

struct Look {
  res: vec2f,           // the picture's size in pixels
  glow: f32,            // how much of the bloom is added
  vignette: f32,
  grain: f32,
  aberration: f32,
  saturation: f32,
  time: f32,
  hdrPeak: f32,         // the brightest HDR output, in multiples of SDR white (at least 2)
};

@group(0) @binding(0) var<uniform> K: Look;
@group(0) @binding(1) var sceneLight: texture_2d<f32>;
@group(0) @binding(2) var bloomLight: texture_2d<f32>;
@group(0) @binding(3) var linearSampler: sampler;
@group(0) @binding(4) var<storage, read> state: vec4f;

// AgX (Troy Sobotka), in Benjamin Wrensch's compact form: hot light rolls off to white
// gracefully instead of clipping into flat primaries. Matrices are column by column, as in
// the GLSL original.
const AGX_IN = mat3x3f(0.842479062253094, 0.0423282422610123, 0.0423756549057051,
                       0.0784335999999992, 0.878468636469772, 0.0784336,
                       0.0792237451477643, 0.0791661274605434, 0.879142973793104);
const AGX_OUT = mat3x3f(1.19687900512017, -0.0528968517574562, -0.0529716355144438,
                        -0.0980208811401368, 1.15190312990417, -0.0980434501171241,
                        -0.0990297440797205, -0.0989611768448433, 1.15107367264116);
const AGX_LO = -12.47393;
const AGX_RANGE = 16.499999;   // 4.026069 - AGX_LO

fn agxCurve(x: vec3f) -> vec3f {
  let x2 = x * x;
  let x4 = x2 * x2;
  return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
}

fn agx(light: vec3f) -> vec3f {
  var c = AGX_IN * max(light, vec3f(1e-10));
  c = clamp(log2(c), vec3f(AGX_LO), vec3f(AGX_LO + AGX_RANGE));
  c = (c - AGX_LO) / AGX_RANGE;
  c = agxCurve(c);
  // a punchier look than AgX's default, for light on black
  let l = dot(c, LUMA);
  c = l + (c - l) * K.saturation;
  return clamp(AGX_OUT * c, vec3f(0.0), vec3f(1.0));
}

fn hash12(p: vec2f) -> f32 {
  var p3 = fract(vec3f(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// sRGB encoding of linear light, continued above 1 for the extended range
fn linearToSrgb(c: vec3f) -> vec3f {
  let lo = c * 12.92;
  let hi = 1.055 * pow(max(c, vec3f(0.0)), vec3f(1.0 / 2.4)) - 0.055;
  return max(select(hi, lo, c < vec3f(0.0031308)), vec3f(0.0));
}

struct Shaded {
  light: vec3f,   // the light after bloom and exposure, before tone mapping (linear)
  shown: vec3f,   // the SDR picture after AgX and the vignette (display-encoded)
  edge: f32,      // the vignette's darkening at this pixel
};

fn shade(v: Screen) -> Shaded {
  let uv = v.uv;
  let cc = uv - 0.5;
  var col: vec3f;
  var bl: vec3f;
  if (K.aberration > 0.001) {
    // the lens bends red and blue a touch differently, more toward the edges
    let off = cc * K.aberration * 0.012;
    col = vec3f(textureSampleLevel(sceneLight, linearSampler, uv - off, 0.0).r,
                textureSampleLevel(sceneLight, linearSampler, uv, 0.0).g,
                textureSampleLevel(sceneLight, linearSampler, uv + off, 0.0).b);
    bl = vec3f(textureSampleLevel(bloomLight, linearSampler, uv - off * 2.0, 0.0).r,
               textureSampleLevel(bloomLight, linearSampler, uv, 0.0).g,
               textureSampleLevel(bloomLight, linearSampler, uv + off * 2.0, 0.0).b);
  } else {
    col = textureSampleLevel(sceneLight, linearSampler, uv, 0.0).rgb;
    bl = textureSampleLevel(bloomLight, linearSampler, uv, 0.0).rgb;
  }
  if (bad3(col)) { col = vec3f(0.0); }
  if (bad3(bl)) { bl = vec3f(0.0); }
  col = clamp(col, vec3f(0.0), vec3f(30000.0)) + max(bl, vec3f(0.0)) * K.glow;

  // the exposure from eye adaptation; if it is ever broken (NaN, zero, absurd) on some GPU,
  // show the light at a plain exposure rather than a black screen
  var ex = state.z;
  if (badf(ex) || ex < 0.02 || ex > 50.0) { ex = 1.5; }
  col *= ex;

  let aspect = K.res.x / max(K.res.y, 1.0);
  let r = length(cc * vec2f(aspect, 1.0)) / length(vec2f(aspect, 1.0) * 0.5); // nonzero: the length of (aspect, 1) / 2 is >= 0.5
  let edge = mix(1.0, 1.0 - 0.75 * smoothstep(0.35, 1.15, r), K.vignette);
  return Shaded(col, agx(col) * edge, edge);
}

// film grain, strongest in the mid-tones, and a dither that hides banding in the dark
fn grain(c: vec3f, pixel: vec2f) -> vec3f {
  let n = hash12(pixel + fract(K.time * 13.7) * 341.0) - 0.5;
  let l = dot(c, LUMA);
  let grained = c + n * K.grain * 0.09 * (clamp(l, 0.0, 1.0) * (1.0 - clamp(l, 0.0, 1.0)) * 3.0 + 0.05);
  return grained + (hash12(pixel.yx * 1.37 + K.time) - hash12(pixel * 0.93 - K.time)) / 255.0;
}

@fragment
fn sdr(v: Screen) -> @location(0) vec4f {
  let s = shade(v);
  return vec4f(clamp(grain(s.shown, v.clip.xy), vec3f(0.0), vec3f(1.0)), 1.0);
}

struct TwoPictures {
  @location(0) extended: vec4f,
  @location(1) standard: vec4f,
};

@fragment
fn hdr(v: Screen) -> TwoPictures {
  let s = shade(v);
  var out: TwoPictures;
  out.standard = vec4f(clamp(grain(s.shown, v.clip.xy), vec3f(0.0), vec3f(1.0)), 1.0);
  // above SDR white, add back what AgX rolled off, softly limited to the peak
  let L = dot(s.light, LUMA) * s.edge;
  let headroom = max(K.hdrPeak - 1.0, 1.0);
  let extra = headroom * (1.0 - exp(-max(L - 1.0, 0.0) / headroom)); // nonzero: headroom >= 1
  let tint = s.light / max(dot(s.light, LUMA), 1e-4);
  let base = srgbToLinear(s.shown);
  // The roll-off above limits brightness, but one channel of saturated light can still go far
  // past the peak (blue counts little toward brightness: pure blue would reach about 14 times
  // it). The display would clip that channel alone and shift the hue, so the whole colour is
  // scaled down until its largest channel is at the peak.
  let hi = base + tint * extra;
  let top = max(max(hi.r, max(hi.g, hi.b)), 1e-4);
  let fitted = hi * min(1.0, max(K.hdrPeak, 1.0) / top); // nonzero: top is at least 1e-4
  out.extended = vec4f(grain(linearToSrgb(fitted), v.clip.xy), 1.0);
  return out;
}
