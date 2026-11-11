// The full-screen passes. Kept together because each is short and they share the
// one vertex shader (a single triangle that covers the screen, no buffers needed).

// NaN or infinity, tested on the bits (phone GPU compilers may drop isnan()/isinf()).
const BAD = `
bool badf(float x) { return (floatBitsToUint(x) & 0x7f800000u) == 0x7f800000u; }
bool bad3(vec3 v) { return badf(v.x) || badf(v.y) || badf(v.z); }
`;

export const QUAD_VS = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

// The simulation draws nothing (rasterisation is off), but a program needs one.
export const NOTHING_FS = `#version 300 es
precision mediump float;
out vec4 o;
void main() { o = vec4(0.0); }`;

// Multiplies what is already on screen by uKeep (with blending ZERO, SRC_COLOR): trails.
export const FADE_FS = `#version 300 es
precision mediump float;
uniform float uKeep;
out vec4 o;
void main() { o = vec4(uKeep, uKeep, uKeep, 1.0); }`;

// 13-tap downsample (Jimenez, "Next generation post processing in Call of Duty: AW").
// The first pass also removes NaN/infinity and tames single bright pixels
// (a Karis average per block), so one hot speck cannot make the whole bloom flicker.
export const DOWN_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uSrc;
uniform vec2 uTexel;
uniform int uFirst;
out vec4 o;
${BAD}
vec3 tap(vec2 off) {
  vec3 c = texture(uSrc, vUv + uTexel * off).rgb;
  if (uFirst == 1) {
    if (bad3(c)) c = vec3(0.0);
    c = clamp(c, 0.0, 30000.0);
  }
  return c;
}
float kw(vec3 c) { return 1.0 / (1.0 + dot(c, vec3(0.2126, 0.7152, 0.0722))); }
void main() {
  vec3 a = tap(vec2(-2.0, 2.0)), b = tap(vec2(0.0, 2.0)), c = tap(vec2(2.0, 2.0));
  vec3 d = tap(vec2(-2.0, 0.0)), e = tap(vec2(0.0)), f = tap(vec2(2.0, 0.0));
  vec3 g = tap(vec2(-2.0, -2.0)), h = tap(vec2(0.0, -2.0)), i = tap(vec2(2.0, -2.0));
  vec3 j = tap(vec2(-1.0, 1.0)), k = tap(vec2(1.0, 1.0)), l = tap(vec2(-1.0, -1.0)), m = tap(vec2(1.0, -1.0));
  vec3 r;
  if (uFirst == 1) {
    vec3 g0 = (j + k + l + m) * 0.25, g1 = (a + b + d + e) * 0.25, g2 = (b + c + e + f) * 0.25;
    vec3 g3 = (d + e + g + h) * 0.25, g4 = (e + f + h + i) * 0.25;
    float w0 = kw(g0) * 0.5, w1 = kw(g1) * 0.125, w2 = kw(g2) * 0.125, w3 = kw(g3) * 0.125, w4 = kw(g4) * 0.125;
    r = (g0 * w0 + g1 * w1 + g2 * w2 + g3 * w3 + g4 * w4) / (w0 + w1 + w2 + w3 + w4);
  } else {
    r = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  }
  o = vec4(r, 1.0);
}`;

// 3x3 tent upsample, added onto the next larger level (blending ONE, ONE).
export const UP_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uSrc;
uniform vec2 uTexel;
uniform float uRadius;
uniform float uWeight;
out vec4 o;
vec3 tap(vec2 off) { return texture(uSrc, vUv + uTexel * off * uRadius).rgb; }
void main() {
  vec3 r = tap(vec2(0.0)) * 4.0
    + (tap(vec2(-1.0, 0.0)) + tap(vec2(1.0, 0.0)) + tap(vec2(0.0, -1.0)) + tap(vec2(0.0, 1.0))) * 2.0
    + tap(vec2(-1.0, -1.0)) + tap(vec2(1.0, -1.0)) + tap(vec2(-1.0, 1.0)) + tap(vec2(1.0, 1.0));
  o = vec4(r * (uWeight / 16.0), 1.0);
}`;

// Eye adaptation and the flash guard, into a 1x1 target that remembers last frame.
//   r: adapted scene brightness (slow), drives auto exposure
//   g: guarded on-screen brightness, which may only rise so fast
//   b: the exposure multiplier the composite uses
// The state is stored as the exact bits of 32-bit floats in an RGBA32UI target: integer
// targets are renderable in every WebGL2, so the guard works the same on devices that
// cannot render half floats (in 8 bits its slow rise would round away to nothing).
export const ADAPT_FS = `#version 300 es
precision highp float;
uniform sampler2D uLum;     // the smallest bloom level: a blurred thumbnail of the frame
uniform highp usampler2D uPrev;
uniform float uDt;
uniform float uBase;        // the scene's exposure, as a multiplier
uniform float uAuto;        // 0..1, how strongly to adapt
uniform float uGuard;       // 1: limit how fast the screen may brighten
uniform float uRise;        // allowed rise in e-folds per second
uniform float uGlowGain;    // how much bloom will add on top, so Glow is guarded too
out uvec4 o;
${BAD}
void main() {
  float sum = 0.0;
  for (int y = 0; y < 4; y++) for (int x = 0; x < 4; x++) {
    vec3 c = texture(uLum, (vec2(float(x), float(y)) + 0.5) / 4.0).rgb;
    if (bad3(c)) c = vec3(0.0);
    sum += dot(clamp(c, 0.0, 30000.0), vec3(0.2126, 0.7152, 0.0722));
  }
  float L = max(sum / 16.0, 0.0);
  vec4 prev = uintBitsToFloat(texelFetch(uPrev, ivec2(0), 0));
  // cleared to zero bits (0.0), never written, or broken: start afresh
  bool first = !(prev.a > 0.5) || badf(prev.r) || badf(prev.g) || badf(prev.b) || prev.b <= 0.0;
  float La = first ? L : prev.r + (L - prev.r) * (1.0 - exp(-uDt / (L > prev.r ? 0.45 : 1.3)));
  float e = clamp(pow(0.06 / max(La, 0.0005), uAuto), 0.35, 3.5) * uBase;
  // what reaches the screen includes the bloom the composite adds
  float D = L * (1.0 + uGlowGain) * e;
  float Dg = first ? D : prev.g;
  float allowed = Dg * exp(uRise * uDt) + 0.02 * uDt;
  float shown = uGuard > 0.5 ? min(D, allowed) : D;
  float k = D > 1e-6 ? shown / D : 1.0;
  vec4 next = vec4(La, shown, e * k, 1.0);
  // never let a bad value stick: NaN or infinity starts afresh next frame
  if (bad3(next.rgb)) next = vec4(0.0);
  o = floatBitsToUint(next);
}`;

// Bloom, exposure, AgX tone mapping, lens fringe, vignette, grain and dither.
export const COMPOSITE_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform highp usampler2D uAdapt;
uniform float uGlow;
uniform float uVignette;
uniform float uGrain;
uniform float uAberr;
uniform float uSat;
uniform float uTime;
uniform vec2 uRes;
out vec4 o;
${BAD}

// AgX (Troy Sobotka), in Benjamin Wrensch's compact form: hot light rolls off to white
// gracefully instead of clipping into flat primaries.
const mat3 AGX_IN = mat3(0.842479062253094, 0.0423282422610123, 0.0423756549057051,
                         0.0784335999999992, 0.878468636469772, 0.0784336,
                         0.0792237451477643, 0.0791661274605434, 0.879142973793104);
const mat3 AGX_OUT = mat3(1.19687900512017, -0.0528968517574562, -0.0529716355144438,
                          -0.0980208811401368, 1.15190312990417, -0.0980434501171241,
                          -0.0990297440797205, -0.0989611768448433, 1.15107367264116);
vec3 agxCurve(vec3 x) {
  vec3 x2 = x * x, x4 = x2 * x2;
  return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
}
vec3 agx(vec3 c) {
  const float lo = -12.47393, hi = 4.026069;
  c = AGX_IN * max(c, 1e-10);
  c = clamp(log2(c), lo, hi);
  c = (c - lo) / (hi - lo);
  c = agxCurve(c);
  // a punchier look than AgX's default, for light on black
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = l + (c - l) * uSat;
  return clamp(AGX_OUT * c, 0.0, 1.0);
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec2 uv = vUv;
  vec2 cc = uv - 0.5;
  vec3 col;
  vec3 bl;
  if (uAberr > 0.001) {
    // the lens bends red and blue a touch differently, more toward the edges
    vec2 off = cc * uAberr * 0.012;
    col = vec3(texture(uScene, uv - off).r, texture(uScene, uv).g, texture(uScene, uv + off).b);
    bl = vec3(texture(uBloom, uv - off * 2.0).r, texture(uBloom, uv).g, texture(uBloom, uv + off * 2.0).b);
  } else {
    col = texture(uScene, uv).rgb;
    bl = texture(uBloom, uv).rgb;
  }
  if (bad3(col)) col = vec3(0.0);
  if (bad3(bl)) bl = vec3(0.0);
  col = clamp(col, 0.0, 30000.0) + bl * uGlow;

  // the exposure from eye adaptation; if it is ever broken (NaN, zero, absurd) on some
  // GPU, show the light at a plain exposure rather than a black screen
  float ex = uintBitsToFloat(texelFetch(uAdapt, ivec2(0), 0).b);
  if (badf(ex) || ex < 0.02 || ex > 50.0) ex = 1.5;
  col *= ex;
  col = agx(col);

  float aspect = uRes.x / uRes.y;
  float r = length(cc * vec2(aspect, 1.0)) / length(vec2(aspect, 1.0) * 0.5);
  col *= mix(1.0, 1.0 - 0.75 * smoothstep(0.35, 1.15, r), uVignette);

  // film grain, strongest in the mid-tones, and a dither that hides banding in the dark
  float n = hash12(gl_FragCoord.xy + fract(uTime * 13.7) * 341.0) - 0.5;
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col += n * uGrain * 0.09 * (l * (1.0 - l) * 3.0 + 0.05);
  col += (hash12(gl_FragCoord.yx * 1.37 + uTime) - hash12(gl_FragCoord.xy * 0.93 - uTime)) / 255.0;
  o = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;
