// The team colour field: a small picture, in world space, of where each player's colour
// reaches. Each texel holds the players' colours blended by how near their touches are
// (rgb) and how strongly any colour reaches it (a). The particles look it up once each
// (draw.wgsl) instead of each visiting every touch. engine.js puts common.wgsl and
// screen.wgsl in front of this file.
//
// This is the desktop edition's own: the mobile edition has a single player.

@group(0) @binding(0) var<uniform> F: Frame;

// how far a touch's colour reaches: exp(-distance^2 * REACH), so about 0.3 world units
const REACH = 12.0;

@fragment
fn field(v: Screen) -> @location(0) vec4f {
  // the texel's place on the touch plane; teamScale maps world units to uv
  let world = vec2f((v.uv.x - 0.5) / max(F.teamScale.x, 1e-3), (0.5 - v.uv.y) / max(F.teamScale.y, 1e-3));
  var sum = vec3f(0.0);
  var weight = 0.0;
  for (var i = 0u; i < F.poleCount; i++) {
    let pole = F.poles[i];
    if (pole.team.w <= 0.0) { continue; }
    let d = world - pole.place.xy;
    let e = pole.place.z * pole.team.w * exp(-dot(d, d) * REACH);
    sum += pole.team.rgb * e;
    weight += e;
  }
  // a pulse from a player spreads that player's colour along its ring
  for (var k = 0u; k < 8u; k++) {
    let pu = F.pulses[k];
    let tint = F.pulseColors[k];
    if (pu.w > 1.6 || tint.w <= 0.0) { continue; }
    let off = (length(world - pu.xy) - pu.w * 1.25) / 0.08;
    let e = tint.w * pu.z * exp(-off * off) * (1.0 - pu.w / 1.6);
    sum += tint.rgb * e;
    weight += e;
  }
  return vec4f(sum / max(weight, 1e-5), 1.0 - exp(-weight * 4.0));
}
