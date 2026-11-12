// Stand-in picture for the engine's first version: a soft glow at every pole and pulse, so
// the boot path, the readback and the input tests have light to look at before the particle
// engine lands. The engine part replaces this file.

struct Frame {
  aspect: f32,  // width / height of the picture
  count: u32,   // lights in use
  _pad0: f32,
  _pad1: f32,
};

struct Light {
  pos: vec2f,    // world units
  power: f32,    // 0..2
  weight: f32,   // 0..1: fades a released pole or an ageing pulse
  color: vec4f,  // rgb 0..1
};

@group(0) @binding(0) var<uniform> frame: Frame;
@group(0) @binding(1) var<storage, read> lights: array<Light>;

struct Varyings {
  @builtin(position) clip: vec4f,
  @location(0) world: vec2f,
};

// One triangle that covers the screen: corners at (-1, -1), (3, -1) and (-1, 3).
@vertex fn vs(@builtin(vertex_index) i: u32) -> Varyings {
  let corner = vec2f(f32((i << 1u) & 2u), f32(i & 2u)) * 2.0 - 1.0;
  var out: Varyings;
  out.clip = vec4f(corner, 0.0, 1.0);
  out.world = vec2f(corner.x * frame.aspect, corner.y);
  return out;
}

@fragment fn fs(v: Varyings) -> @location(0) vec4f {
  var light = vec3f(0.0);
  let count = min(frame.count, arrayLength(&lights));
  for (var k = 0u; k < count; k++) {
    let l = lights[k];
    let d = v.world - l.pos;
    // falls off with the distance squared; the added constant keeps the centre finite
    light += l.color.rgb * (l.power * l.weight * 0.004 / (dot(d, d) + 0.002)); // nonzero: dot(d, d) >= 0
  }
  // rolls bright light off toward white instead of clipping it
  let shown = light / (light + vec3f(1.0)); // nonzero: light >= 0, so every channel is >= 1
  return vec4f(shown, 1.0);
}
