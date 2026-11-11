#version 300 es
precision highp float;

in vec3 vColor;
in float vSoft;
out vec4 outColor;

void main() {
  // small specks are flat squares; larger ones are soft discs with the same total light
  // (5.14 is 1 / the mean of exp(-4 r^2) over the point's square)
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float shape = mix(1.0, exp(-4.0 * dot(c, c)) * 5.14, vSoft);
  outColor = vec4(vColor * shape, 1.0);
}
