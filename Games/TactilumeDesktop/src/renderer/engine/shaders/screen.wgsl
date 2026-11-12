// The vertex shader of every full-screen pass: one triangle that covers the target, with no
// buffers. engine.js puts this file (after common.wgsl) in front of each such pass.

struct Screen {
  @builtin(position) clip: vec4f,
  @location(0) uv: vec2f,   // 0..1 across the target, (0, 0) at the top left like its texels
};

// corners at clip (-1, -1), (3, -1) and (-1, 3)
@vertex
fn screen(@builtin(vertex_index) i: u32) -> Screen {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  var out: Screen;
  out.clip = vec4f(p * 2.0 - 1.0, 0.0, 1.0);
  out.uv = vec2f(p.x, 1.0 - p.y);
  return out;
}
