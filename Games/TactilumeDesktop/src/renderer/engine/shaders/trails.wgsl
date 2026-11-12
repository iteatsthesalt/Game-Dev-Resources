// The two draws that start each frame of light on top of the last one. engine.js puts
// common.wgsl and screen.wgsl in front of this file.
//
// fade: drawn with blending (zero, constant), so the light already there is multiplied by
//   the blend constant: that is how the trails fade, as on mobile.
// ceiling: drawn with a min blend, so no pixel stays above 30,000. A half float overflows at
//   65,504, and an infinity would then stay in the trails for good. (Mobile instead capped
//   each speck at 24,000 / count, which at desktop counts would dim every speck alike.)

@fragment
fn fade(v: Screen) -> @location(0) vec4f {
  return vec4f(0.0);
}

@fragment
fn ceiling(v: Screen) -> @location(0) vec4f {
  return vec4f(30000.0, 30000.0, 30000.0, 1.0);
}
