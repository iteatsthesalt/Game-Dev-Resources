// Shared by the simulation, the particle drawing and the team colour field: the per-frame
// uniforms, the test for broken floats, hashing, the fixed random numbers of each particle,
// and the flow that keeps the light moving. engine.js puts this file in front of each of
// those shaders.
//
// Ported from the mobile edition's common.glsl. The hashes and the flow must give the same
// numbers as there, so a scene moves the same way in both editions.

const TAU = 6.28318530718;
const LUMA = vec3f(0.2126, 0.7152, 0.0722);

// One particle, 32 bytes, the same layout as mobile.
struct Particle {
  pos: vec4f,   // xyz position, w heat (how lit up it is)
  vel: vec4f,   // xyz velocity, w life (used by the fountain)
};

// A point of force on the plane z = 0, after the engine has smoothed it (see touch.js).
struct Pole {
  place: vec4f,   // x, y, weight (its power, faded in and out), age in s
  motion: vec4f,  // vx, vy, raw power, spin (+1 or -1)
  team: vec4f,    // its player's colour (linear rgb), and 1 when that colour shows
};

// Everything that changes per frame. layout.js writes it; tests/unit/engine-layout.test.js
// checks that the two agree, field by field.
struct Frame {
  viewProj: mat4x4f,
  gravity: vec4f,       // xyz: acceleration, already scaled by the scene's gravity
  audio: vec4f,         // level, bass, mid, high
  invRes: vec2f,        // 1 / the picture's width and height, in pixels
  teamScale: vec2f,     // world units to team field uv (0.5 / the field's half size)
  dt: f32,              // simulated seconds this frame (scaled by the scene's speed)
  time: f32,            // simulated seconds so far
  strength: f32,
  drag: f32,
  flow: f32,
  depth: f32,
  touch: f32,           // 0..1, how much anyone is touching now
  engage: f32,          // like touch, but lets go slowly
  aspect: f32,          // width / height
  onset: f32,           // a beat in the music, 0..1
  mix: f32,             // the crossfade from behaviour A (0) to B (1), eased
  camDist: f32,         // camera to the touch plane, which is in focus
  pointPx: f32,         // speck size in pixels, in focus
  dofPx: f32,           // extra blur in pixels per unit of distance from the focus
  maxPx: f32,
  energy: f32,          // light per particle, normalised by count, size and trails
  energyCap: f32,
  sparkle: f32,
  high: f32,            // treble in the music, which makes sparkles busier
  palA: f32,            // the two palette rows being crossfaded (texel centres, 0..1)
  palB: f32,
  palMix: f32,
  hue: f32,             // hue shift, radians
  depthRange: f32,
  teamMix: f32,         // 0..1: how much player colours show
  behA: u32,
  behB: u32,
  poleCount: u32,
  form: u32,
  colorBy: u32,
  frame: u32,
  count: u32,           // particles simulated and drawn
  initFirst: u32,       // the particles placed in their resting shape this frame
  initCount: u32,
  pulses: array<vec4f, 8>,       // x, y, power, age (age over 1.6: unused)
  pulseColors: array<vec4f, 8>,  // linear rgb, and 1 when the pulse carries a player's colour
  releases: array<vec4f, 4>,     // x, y, charge, age (charge 0: unused)
  poles: array<Pole, 64>,
};

// NaN or infinity, tested on the bits. WGSL lets compilers assume floats are never NaN, so
// an isNan-style test may be compiled away, and one NaN would spread through the glow and
// the eye adaptation to the whole screen.
fn badf(x: f32) -> bool { return (bitcast<u32>(x) & 0x7f800000u) == 0x7f800000u; }
fn bad3(v: vec3f) -> bool { return badf(v.x) || badf(v.y) || badf(v.z); }

// PCG3D (Jarzynski and Olano, 2020): good, fast integer hashing on any GPU.
fn pcg3d(seed: vec3u) -> vec3u {
  var v = seed * 1664525u + 1013904223u;
  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  v ^= v >> vec3u(16u);
  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  return v;
}

const INV_U32 = 1.0 / 4294967295.0;

// Four fixed random numbers in 0..1 for particle `i`, the same every frame.
fn seeds(i: u32) -> vec4f {
  let a = pcg3d(vec3u(i, 0x9e3779b9u, 0x85ebca6bu));
  let b = pcg3d(vec3u(a.x ^ i, 0xc2b2ae35u, 0x27d4eb2fu));
  return vec4f(vec3f(a), f32(b.x)) * INV_U32;
}

// Three more fixed numbers per particle, roughly bell-shaped around 0 (-1.5..1.5) and
// independent of seeds(): for offsets that should look organic, not gridded.
fn bellSeeds(i: u32) -> vec3f {
  let a = pcg3d(vec3u(i, 0x165667b1u, 0xd3a2646cu));
  let b = pcg3d(a ^ vec3u(0xfd7046c5u, 0xb55a4f09u, i));
  let u = vec3f(a) * INV_U32;
  let v = vec3f(b) * INV_U32;
  let w = vec3f(pcg3d(b + vec3u(i))) * INV_U32;
  return u + v + w - 1.5;
}

// Three random numbers in 0..1 that change with `salt` (for example the frame number).
fn rand3(i: u32, salt: u32) -> vec3f {
  return vec3f(pcg3d(vec3u(i, salt, i ^ (salt * 747796405u)))) * INV_U32;
}

// Arnold-Beltrami-Childress flow in two octaves: divergence-free, so the light never
// bunches up or thins out on its own; smooth and endlessly varied. The second octave runs
// in rotated coordinates and is rotated back, which keeps it divergence-free because the
// rotation is orthonormal.
const ROT = mat3x3f(0.8, 0.6, 0.0, -0.48, 0.64, 0.6, 0.36, -0.48, 0.8);

fn abcFlow(p: vec3f, t: f32) -> vec3f {
  let q = p * 2.1 + vec3f(0.31 * t, -0.23 * t, 0.17 * t);
  let u = vec3f(sin(q.z) + cos(q.y), sin(q.x) + cos(q.z), sin(q.y) + cos(q.x));
  let r = ROT * p * 4.3 + vec3f(-0.13 * t, 0.29 * t, 0.11 * t);
  let w = vec3f(sin(r.z) + cos(r.y), sin(r.x) + cos(r.z), sin(r.y) + cos(r.x));
  return u * 0.62 + (transpose(ROT) * w) * 0.3;
}

// Palette texels hold sRGB bytes; the light is added up in linear light.
fn srgbToLinear(c: vec3f) -> vec3f {
  let lo = c / 12.92;
  let hi = pow((max(c, vec3f(0.0)) + 0.055) / 1.055, vec3f(2.4)); // non-negative: max(c, 0) + 0.055 > 0
  return select(hi, lo, c < vec3f(0.04045));
}
