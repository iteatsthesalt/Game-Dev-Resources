#version 300 es
precision highp float;
precision highp int;

in vec3 vColor;
in float vSoft;
uniform float uDither;   // 1 on 8-bit targets
uniform uint uSeed;      // changes every frame
out vec4 outColor;

uint pcg(uint v) {
  uint s = v * 747796405u + 2891336453u;
  uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}

void main() {
  // small specks are flat squares; larger ones are soft discs with the same total light
  // (5.14 is 1 / the mean of exp(-4 r^2) over the point's square)
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float shape = mix(1.0, exp(-4.0 * dot(c, c)) * 5.14, vSoft);
  vec3 col = vColor * shape;
  if (uDither > 0.5) {
    // An 8-bit target keeps whole steps of 1/255, so light fainter than half a step would
    // vanish. Rounding up or down at random, with the right odds, keeps it on average:
    // many faint specks still add up to a glow.
    uvec2 q = uvec2(gl_FragCoord.xy);
    float r = float(pcg(q.x ^ pcg(q.y ^ pcg(uSeed))) >> 8u) * (1.0 / 16777216.0);
    col = floor(col * 255.0 + r) / 255.0;
  }
  outColor = vec4(col, 1.0);
}
