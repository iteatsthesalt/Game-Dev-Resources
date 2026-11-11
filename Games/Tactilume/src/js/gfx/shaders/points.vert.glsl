#version 300 es
// Draws each particle as a point of light: colour from the palette, size from
// perspective and soft focus, brightness spread so a blurred speck keeps its energy.
precision highp float;
precision highp int;

layout(location = 0) in vec4 aPos;   // xyz, w heat
layout(location = 1) in vec4 aVel;   // xyz velocity, w life

#include common

uniform mat4 uViewProj;
uniform float uCamDist;       // distance from the camera to the touch plane (in focus)
uniform float uPointPx;       // base speck size in pixels, in focus
uniform float uDofPx;         // extra blur in pixels per unit of distance from focus
uniform float uMaxPx;
uniform float uEnergy;        // light per particle (normalised by count and trails)
uniform float uEnergyCap;     // keeps any single pixel well inside half-float range
uniform float uSparkle;
uniform float uHigh;          // treble from the music, makes sparkles busier
uniform float uTime;
uniform int uColorBy;         // core/scene.js COLOR_BY: speed, heat, seed, direction, depth
uniform float uPalA;          // palette rows (texel centres, 0..1)
uniform float uPalB;
uniform float uPalMix;
uniform float uHue;           // radians
uniform float uDepthRange;
uniform sampler2D uLUT;

out vec3 vColor;
out float vSoft;

vec3 hueRotate(vec3 c, float a) {
  const vec3 k = vec3(0.57735027);
  float ca = cos(a);
  return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca);
}

void main() {
  uint id = uint(gl_VertexID);
  vec4 s = seeds(id);
  vec3 p = aPos.xyz;
  vec3 v = aVel.xyz;
  float heat = aPos.w;

  vec4 clip = uViewProj * vec4(p, 1.0);
  gl_Position = clip;

  float dist = max(clip.w, 0.05);
  float persp = uCamDist / dist;
  float base = uPointPx * persp * (0.75 + 0.5 * s.z);
  float blur = uDofPx * abs(dist - uCamDist);
  float size = min(sqrt(base * base + blur * blur), uMaxPx);
  float px = max(size, 1.0);
  gl_PointSize = px;

  // where on the palette this speck sits
  float speed = length(v);
  float t;
  if (uColorBy == 0) t = 1.0 - exp(-speed * 1.1);
  else if (uColorBy == 1) t = 1.0 - exp(-heat * 0.7);
  else if (uColorBy == 2) t = s.x;
  else if (uColorBy == 3) t = 0.5 + 0.5 * sin(atan(v.y, v.x + 1e-6));
  else t = clamp(0.5 + p.z / max(uDepthRange, 0.05) * 0.5, 0.0, 1.0);
  // a touch of per-particle spread keeps flat regions from looking banded
  t = clamp(t * 0.92 + (s.y - 0.5) * 0.08 + 0.04, 0.0, 1.0);
  // The palette texture holds sRGB bytes in a plain RGBA8 texture, decoded here: some phone
  // drivers sample sRGB-format textures wrongly in a vertex shader. textureLod, because a
  // vertex shader has no derivatives to pick a level from.
  vec3 enc = mix(textureLod(uLUT, vec2(t, uPalA), 0.0).rgb, textureLod(uLUT, vec2(t, uPalB), 0.0).rgb, uPalMix);
  vec3 col = mix(enc / 12.92, pow((enc + 0.055) / 1.055, vec3(2.4)), step(0.04045, enc));
  if (uHue != 0.0) col = max(hueRotate(col, uHue), 0.0);
  // partly even out how bright the colours are (a deep red is far darker than a pale
  // yellow), so the palette sets the hue and heat sets the brightness
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col *= min(pow(0.3 / max(lum, 0.004), 0.55), 5.0);

  // hot light burns brighter; resting light glows softly
  float bright = 0.45 + 0.55 * min(heat, 3.0) + 0.25 * min(speed, 2.0);
  // now and then a speck catches the light
  float tw = sin(uTime * (1.3 + s.w * 3.7 + uHigh * 6.0) + s.x * 97.0);
  bright *= 1.0 + uSparkle * pow(max(tw, 0.0), 24.0) * 6.0;

  // the same light spread over a larger disc when out of focus or sub-pixel
  float energy = uEnergy * persp * bright * (base * base) / (px * px);
  vColor = col * min(energy, uEnergyCap);
  vSoft = smoothstep(1.6, 3.6, px);
  // a broken particle draws nothing, off screen, rather than a NaN that would spread
  if (bad3(p) || bad3(vColor) || badf(heat)) {
    vColor = vec3(0.0);
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 1.0;
  }
}
