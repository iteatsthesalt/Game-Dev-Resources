// 66-gfx-gl.js: the 3D view, 'gl'. Figures built of simple solid shapes, lit by one sun and up to 32 point lights,
// with cast shadows, seen from a tilted camera and drawn at low resolution with hard pixels. Plain WebGL2.
// Owns: Gfx (it adds SHAPES, PART_STRIDE and LIGHT_STRIDE, and registers the view 'gl' with Gfx.register)
// Public:
//   Gfx.SHAPES                    Mesh.SHAPES: ['box', 'taper', 'cyl', 'sphere', 'cone']; a shape's id is its index
//   Gfx.PART_STRIDE = 18          a part: a 3 by 4 matrix in rows (m00 m01 m02 m03, m10 m11 m12 m13, m20 m21 m22
//                                 m23) that takes a point of the unit shape to the world, world = M (point, 1);
//                                 then red, green, blue; flash (mixes the colour towards white, for a hit); glow
//                                 (how much the part shines by itself, and feeds the bloom); alpha (below 1 the part
//                                 is drawn through a screen-door pattern, so nothing needs sorting; at 0 it is not
//                                 drawn, and below 0.5 it casts no shadow). Each of the last six runs from 0 to 1.
//   Gfx.LIGHT_STRIDE = 8          a light: x, y on the ground, z its height, radius in metres, red, green, blue,
//                                 strength. It lights what is within its radius, fading smoothly to nothing there.
//   The world of this view: the simulation's ground point (x, y) is the point (x, 0, y), so x runs right, y up and
//   z towards the viewer; the camera looks from the +z side, tilted down. 60-mesh.js has the shapes (each stands
//   on the ground and fits the space from (-0.5, 0, -0.5) to (0.5, 1, 0.5)) and the matrix sums.
//
//   The view 'gl': Gfx.create(canvas, 'gl'), or Gfx.backends.gl(canvas), gives its backend, after the renderer
//   contract of docs/engine.md and 65-gfx.js. A canvas that already serves this view is refused.
//   b.name = 'gl'   b.canvas
//   b.caps = {puppets: true, shadows, lights: true, bloom, maxInstances}    shadows is false at the quality 'low',
//                                 bloom is true only at 'high'; maxInstances: parts of one shape in one frame
//   b.stats = {drawCalls, instances}    what the last frame drew, counted from begin() to end(): instances are
//                                 parts (discs among them), decals and billboards
//   b.resize(cssW, cssH, dpr)     the canvas shows cssW by cssH CSS pixels with dpr device pixels to each, and gets
//                                 that many pixels, scaled down to no more than 2.5 million. The scene is drawn into
//                                 a target a whole number of times smaller, its shorter side 300 to 432 pixels where
//                                 a whole number allows (else as near as one comes), and scaled up to the canvas
//                                 with hard pixels, centred, the spare edge of the last row and column cut off.
//   b.quality(level) -> level     'high' (a shadow map of 1024, bloom, outline), 'medium' (512, outline, no bloom) or
//                                 'low' (no shadow map, no bloom, no outline). Without a level it only answers.
//                                 When frames come more than 20 ms apart for two seconds running, the view steps
//                                 down one level by itself and posts Plat.emit('quality', level). It never steps up.
//                                 Asking for a level starts that count again. The view starts at 'high'.
//   b.begin(cam, env)             starts a frame. cam {x, y, zoom}: the ground point looked at, and a factor on the
//                                 scale. The camera looks down 52 degrees, through a lens of 28 degrees along the
//                                 longer side of the screen, from where at zoom 1 the ground through the point looked
//                                 at is 30 metres across the screen or up it, whichever is more; nearer, where that
//                                 would show ground more than 23.5 metres away in a corner. env, and each part of
//                                 it, may be left out:
//                                   ground   [r, g, b]: plain, with a faint line every 2 metres and a stronger one
//                                            every 10; or a tileset id: the canvas Ground.texture(id) gives,
//                                            repeated every Ground.span(id) metres (plain ground if there is none)
//                                   ambient  [r, g, b]: full on faces turned up, three quarters on upright faces,
//                                            half on faces turned down
//                                   sun      {dir: [x, y, z], color: [r, g, b]}: dir is the way the light travels,
//                                            in the axes of this view, any length (it is kept above the horizon)
//                                   fog      {color: [r, g, b], near, far}: in metres up the screen beyond the point
//                                            looked at, where the fog begins and where it is whole
//   b.parts(shape, buffer, count) count records of Gfx.PART_STRIDE floats, all of one shape (its id or its name)
//   b.decals(buffer, count)       flat marks just above the ground, blended over it in the order given, unlit:
//                                 records of Gfx.DECAL_STRIDE (65-gfx.js says what each float is). A ring, sector
//                                 or bar is its rim (3% of its radius, at most 0.12 m, at least a pixel and a fifth
//                                 of the picture) and its filled part, both in its colour and alpha; fill from
//                                 0 to 1 fills from the middle out, below 0 from the rim in. The shapes: 0 disc
//                                 (filled whole), 1 ring, 2 sector (the ring cut to arc, centred on angle, with its
//                                 two straight sides drawn), 3 bar (from the centre towards angle, radius long and
//                                 arc metres wide, its outline drawn and filled along its length), 4 lee (drawn as
//                                 nothing: the first 64 of a frame, in any call, are what shelters the ground from
//                                 the cut decals), and 8 added to 0 to 3 for a cut decal: its pixels in the lee of
//                                 any lee record, seen from its own centre, are left out, so clean ground shows.
//                                 Lee records count in no stat.
//   b.billboards(buffer, count)   soft squares facing the camera, unlit, records of Gfx.BILLBOARD_STRIDE, drawn after
//                                 the solids and hidden by them, but not hiding anything: glow above 0.5 adds light
//                                 (and feeds the bloom), otherwise the billboard covers what is behind it
//   b.discs(buffer, count)        records of Gfx.DISC_STRIDE, each drawn as an upright 8-sided cylinder as wide as
//                                 the disc and twice its radius tall, in the disc's colour (for the stand-in picture)
//   b.lights(buffer, count)       records of Gfx.LIGHT_STRIDE; the first 32 of a frame are used
//   b.end(post)                   draws the frame. post {outline, bloom, dither, vignette, flash, grey}, each 0 to 1.
//                                 What is left out (all of it, with null) is 1 for outline and bloom and 0 for the
//                                 rest. outline: a dark pixel where the depth jumps, round whatever stands in front;
//                                 bloom: a glow round glowing parts and light-adding billboards (at 'high'); dither:
//                                 an ordered dither down to 5 bits a channel; vignette darkens the corners; flash
//                                 whitens the whole frame; grey takes the colour out of everything that does not
//                                 glow (a part's glow, a billboard that adds light), so lit things keep theirs.
//   Between begin() and end() the other calls come in any number and order. Nothing is drawn before end(). The view
//   copies what it is given before it returns, so a buffer may be refilled at once. Up to maxInstances parts of each
//   shape, 4096 decals, 4096 billboards of each kind and 32 lights count in one frame; the rest is left out.
//   b.worldToScreen(x, y, z, out), b.screenToWorld(sx, sy, out)   through the camera of the last begin(), in CSS
//                                 pixels from the top left corner of the canvas; a screen point goes to where its
//                                 ray meets the ground. out is needed.
//   b.visibleRadius() -> metres   from the point looked at to the farthest point of ground on the screen (under 24
//                                 at zoom 1 on any screen from 390 by 844 to 2560 by 1080)
//   b.readPixels(x, y, w, h) -> Uint8Array    the finished frame, in canvas pixels from the top left corner (the
//                                 canvas's own pixels, whatever its CSS size): w * h * 4 bytes, red, green, blue and
//                                 alpha, in rows from the top. null while the context is lost. For tests.
//   A lost WebGL context stops the drawing, and the view builds itself again when the context comes back. A shader
//   that does not compile or link throws an Error carrying its log, so that Gfx.create goes on to the next view.
(function () {
  'use strict';

  Gfx.SHAPES = Mesh.SHAPES;
  Gfx.PART_STRIDE = 18;
  Gfx.LIGHT_STRIDE = 8;

  const STRIDE = Gfx.PART_STRIDE, LIGHT = Gfx.LIGHT_STRIDE;
  const DECAL = Gfx.DECAL_STRIDE, BOARD = Gfx.BILLBOARD_STRIDE, DISC = Gfx.DISC_STRIDE;
  const SHAPES = Mesh.SHAPES, KINDS = SHAPES.length, CYL = SHAPES.indexOf('cyl');
  const WIDE_DECAL = 11;      // a decal record this long carries, after fill: shape, angle and arc
  const LEE_SHAPE = 4;        // a decal of this shape is a lee record: what shelters the ground from cut decals
  const BELOW = { high: 'medium', medium: 'low', low: 'low' };

  // ---- the camera ----
  const TILT = 52 * Math.PI / 180;     // the camera looks down this far from level
  const LENS = 28 * Math.PI / 180;     // the angle of view along the longer side of the screen
  const SPAN = 30;                     // metres of ground through the point looked at, at zoom 1
  const REACH = 23.5;                  // at zoom 1 no corner of the screen shows ground farther away than this
  const SIN = Math.sin(TILT), COS = Math.cos(TILT);
  const NEAR = 0.3, FAR = 2.5;         // the clipping planes, as shares of the camera's distance

  // ---- sizes ----
  const CAP = 16384;                   // parts of one shape in one frame
  const DECALS = 4096, BOARDS = 4096, DISCS = 2048, LIGHTS = 32, LEES = 64;
  const PIXELS = 2.5e6;                // the canvas holds at most this many device pixels
  const SHORT_LO = 300, SHORT_HI = 432, SHORT_MID = 360;   // the shorter side of the low-resolution target
  const SHADOW_SIZE = { high: 1024, medium: 512, low: 0 };

  // ---- the look ----
  const CASTERS = 6;          // metres: the tallest thing that casts a shadow into the picture
  const SUN_MARGIN = 40;      // metres towards the sun past the picture from which a caster may still cast
  const BIAS = 0.05;          // metres: the shadow test's allowance in depth
  const DISC_TALL = 2;        // a disc's cylinder is its radius times this tall
  const OUTLINE_JUMP = 0.35, OUTLINE_PER_METRE = 0.006, OUTLINE_DARK = 0.7;   // where an outline is drawn, and how dark
  const BLOOM_GAIN = 1.8;
  const SLOW = 20, SLOW_FOR = 2000, PAUSE = 250;   // ms: frames this far apart, for this long, step the quality
                                                  // down; a gap longer than PAUSE is a pause, not a slow frame
  const GROUND = [0.27, 0.28, 0.3], AMBIENT = [0.42, 0.44, 0.5], SUN_DIR = [0.45, -1, -0.35], SUN = [0.95, 0.9, 0.8];
  const FOG = [0.1, 0.11, 0.14], FOG_NEAR = 8, FOG_FAR = 32, TILE_SPAN = 8;
  const POST = { outline: 1, bloom: 1, dither: 0, vignette: 0, flash: 0, grey: 0 };
  const ATTRIBUTES = { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false };

  // ---- the shaders ----
  // Locations: 0 the vertex, 1 its normal, 2 to 6 the part record (three rows, colour and flash, glow and alpha).

  const VS = '#version 300 es\n';
  const FS = '#version 300 es\nprecision highp float;\nprecision highp int;\nprecision highp sampler2D;\n';
  const SHADOWED = '#define SHADOWS\n';

  const BAYER = `
float bayer(ivec2 p) {
  ivec2 a = p & 1, b = (p >> 1) & 1;
  return (float(8 * (a.x ^ a.y) + 4 * a.y + 2 * (b.x ^ b.y) + b.y) + 0.5) / 16.0;
}
`;

  const FOG_GLSL = `
uniform vec3 uFogColor;
uniform vec3 uFog;
float fogAt(float z) {
  float t = clamp((uFog.z - z - uFog.x) / max(uFog.y - uFog.x, 0.001), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}
`;

  const LIT_GLSL = `
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uAmbient;
uniform vec4 uLightPos[${LIGHTS}];
uniform vec4 uLightColor[${LIGHTS}];
uniform int uLights;
#ifdef SHADOWS
uniform highp sampler2DShadow uShadowMap;
uniform float uShadowBias;
#endif
float sunlit(vec3 s) {
#ifdef SHADOWS
  if (s.x <= 0.0 || s.y <= 0.0 || s.x >= 1.0 || s.y >= 1.0 || s.z >= 1.0) return 1.0;
  return textureLod(uShadowMap, vec3(s.xy, s.z - uShadowBias), 0.0);
#else
  return 1.0;
#endif
}
vec3 shade(vec3 p, vec3 n, vec3 s) {
  vec3 light = uAmbient * (0.75 + 0.25 * n.y);
  float sun = dot(n, uSunDir);
  if (sun > 0.0) light += uSunColor * (sun * sunlit(s));
  for (int i = 0; i < ${LIGHTS}; i++) {
    if (i >= uLights) break;
    vec4 at = uLightPos[i];
    vec3 d = at.xyz - p;
    float d2 = dot(d, d), r2 = at.w * at.w;
    if (d2 < r2) {
      float k = 1.0 - d2 / r2;
      float facing = clamp(0.25 + 0.75 * dot(n, d) * inversesqrt(max(d2, 0.0001)), 0.0, 1.0);
      light += uLightColor[i].rgb * (uLightColor[i].a * k * k * facing);
    }
  }
  return light;
}
`;

  const PARTS_VS = `
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec4 aRow0;
layout(location = 3) in vec4 aRow1;
layout(location = 4) in vec4 aRow2;
layout(location = 5) in vec4 aColor;
layout(location = 6) in vec2 aGlow;
uniform mat4 uViewProj;
#ifdef SHADOWS
uniform mat4 uShadowMat;
uniform float uShadowOffset;
#endif
out vec3 vWorld;
out vec3 vShadow;
flat out vec3 vNormal;
flat out vec4 vColor;
flat out vec2 vGlow;
void main() {
  vColor = aColor;
  vGlow = aGlow;
  vWorld = vec3(0.0);
  vShadow = vec3(0.0);
  vNormal = vec3(0.0, 1.0, 0.0);
  if (aGlow.y <= 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  vec4 p = vec4(aPos, 1.0);
  vec3 world = vec3(dot(aRow0, p), dot(aRow1, p), dot(aRow2, p));
  vec3 c0 = vec3(aRow0.x, aRow1.x, aRow2.x), c1 = vec3(aRow0.y, aRow1.y, aRow2.y), c2 = vec3(aRow0.z, aRow1.z, aRow2.z);
  vec3 n = cross(c1, c2) * aNormal.x + cross(c2, c0) * aNormal.y + cross(c0, c1) * aNormal.z;
  n *= inversesqrt(max(dot(n, n), 1e-30));
  vWorld = world;
  vNormal = n;
#ifdef SHADOWS
  vShadow = (uShadowMat * vec4(world + n * uShadowOffset, 1.0)).xyz;
#endif
  gl_Position = uViewProj * vec4(world, 1.0);
}
`;

  const PARTS_FS = FOG_GLSL + LIT_GLSL + BAYER + `
in vec3 vWorld;
in vec3 vShadow;
flat in vec3 vNormal;
flat in vec4 vColor;
flat in vec2 vGlow;
out vec4 outColor;
void main() {
  if (vGlow.y < 1.0 && vGlow.y <= bayer(ivec2(gl_FragCoord.xy))) discard;
  vec3 albedo = vColor.rgb;
  vec3 c = albedo * shade(vWorld, vNormal, vShadow) + albedo * vGlow.x;
  c = mix(c, vec3(1.0), vColor.a);
  float f = fogAt(vWorld.z);
  outColor = vec4(mix(c, uFogColor, f), vGlow.x * (1.0 - f));
}
`;

  const DEPTH_VS = `
layout(location = 0) in vec3 aPos;
layout(location = 2) in vec4 aRow0;
layout(location = 3) in vec4 aRow1;
layout(location = 4) in vec4 aRow2;
layout(location = 6) in vec2 aGlow;
uniform mat4 uLightViewProj;
void main() {
  if (aGlow.y < 0.5) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  vec4 p = vec4(aPos, 1.0);
  gl_Position = uLightViewProj * vec4(dot(aRow0, p), dot(aRow1, p), dot(aRow2, p), 1.0);
}
`;

  const DEPTH_FS = `
void main() {}
`;

  const GROUND_VS = `
layout(location = 0) in vec2 aCorner;
uniform mat4 uViewProj;
uniform vec3 uGroundBox;
#ifdef SHADOWS
uniform mat4 uShadowMat;
#endif
out vec3 vWorld;
out vec3 vShadow;
void main() {
  vec3 world = vec3(uGroundBox.x + aCorner.x * uGroundBox.z, 0.0, uGroundBox.y + aCorner.y * uGroundBox.z);
  vWorld = world;
#ifdef SHADOWS
  vShadow = (uShadowMat * vec4(world, 1.0)).xyz;
#else
  vShadow = vec3(0.0);
#endif
  gl_Position = uViewProj * vec4(world, 1.0);
}
`;

  const GROUND_FS = FOG_GLSL + LIT_GLSL + `
in vec3 vWorld;
in vec3 vShadow;
uniform vec4 uGround;
uniform sampler2D uTile;
uniform float uTileSpan;
out vec4 outColor;
void main() {
  vec3 albedo = uGround.rgb;
  if (uGround.a > 0.5) {
    albedo = texture(uTile, vWorld.xz / uTileSpan).rgb;
  } else {
    vec2 w = vWorld.xz, e = 0.5 * vec2(abs(dFdx(w.x)), abs(dFdy(w.y)));
    bvec2 two = notEqual(floor((w - e) * 0.5), floor((w + e) * 0.5));
    bvec2 ten = notEqual(floor((w - e) * 0.1), floor((w + e) * 0.1));
    float line = any(ten) ? 2.0 : any(two) ? 1.0 : 0.0;
    albedo = albedo * (1.0 + 0.12 * line) + 0.01 * line;
  }
  vec3 c = albedo * shade(vWorld, vec3(0.0, 1.0, 0.0), vShadow);
  outColor = vec4(mix(c, uFogColor, fogAt(vWorld.z)), 0.0);
}
`;

  const DECAL_VS = `
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec4 aDecalA;
layout(location = 2) in vec4 aDecalB;
layout(location = 3) in vec4 aDecalC;
uniform mat4 uViewProj;
out vec2 vLocal;
out float vZ;
flat out vec4 vColor;
flat out vec4 vShape;
flat out vec3 vArc;
void main() {
  // A: x, y, radius, red. B: green, blue, alpha, fill. C: shape (0 disc, 1 ring, 2 sector, 3 bar, 4 lee; 8 added:
  // cut by lee), angle, arc (for a bar, its width in metres). vArc carries the arc and the decal's centre.
  float r = max(aDecalA.z, 0.0), code = aDecalC.x >= 7.5 ? aDecalC.x - 8.0 : aDecalC.x;
  vColor = vec4(aDecalA.w, aDecalB.x, aDecalB.y, aDecalB.z);
  vShape = vec4(r, aDecalB.w, aDecalC.x, aDecalC.y);
  vArc = vec3(aDecalC.z, aDecalA.x, aDecalA.y);
  vLocal = vec2(0.0);
  vZ = 0.0;
  if (code > 3.5) {                      // a lee record is not drawn
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  float reach = code > 2.5 ? sqrt(r * r + 0.25 * aDecalC.z * aDecalC.z) : r;
  vec2 local = aCorner * reach;
  vec3 world = vec3(aDecalA.x + local.x, 0.02, aDecalA.y + local.y);
  vLocal = local;
  vZ = world.z;
  gl_Position = uViewProj * vec4(world, 1.0);
}
`;

  const DECAL_FS = FOG_GLSL + `
in vec2 vLocal;
in float vZ;
flat in vec4 vColor;
flat in vec4 vShape;
flat in vec3 vArc;
uniform vec4 uLee[${LEES}];
uniform int uLees;
out vec4 outColor;
// Whether the point p (from the decal's centre s) lies in the lee of one of the lee records, by the rule of
// Dmg.inLee: the record's circle meets the last reach metres of the line from s to p, and its centre lies short
// of p along that line. A record round s itself casts none.
bool inLee(vec2 s, vec2 p) {
  vec2 sp = p - s;
  float d = length(sp);
  if (d < 1e-4) return false;
  vec2 u = sp / d;
  for (int i = 0; i < ${LEES}; i++) {
    if (i >= uLees) break;
    vec4 c = uLee[i];
    vec2 sc = c.xy - s;
    float along = dot(sc, u);
    if (dot(sc, sc) <= c.z * c.z || along >= d) continue;
    vec2 q = u * max(along, max(d - c.w, 0.0)) - sc;
    if (dot(q, q) <= c.z * c.z) return true;
  }
  return false;
}
void main() {
  float r = vShape.x, fill = clamp(vShape.y, -1.0, 1.0);
  int code = int(vShape.z + 0.5);
  bool cut = code >= 8;
  int shape = cut ? code - 8 : code;
  float px = max(length(dFdx(vLocal)), length(dFdy(vLocal)));
  float rim = max(1.2 * px, min(0.03 * r, 0.12));
  float d = length(vLocal), a = 0.0;
  if (shape == 3) {
    vec2 dir = vec2(cos(vShape.w), sin(vShape.w));
    float along = dot(vLocal, dir), across = abs(dot(vLocal, vec2(-dir.y, dir.x))), side = 0.5 * vArc.x;
    if (along < 0.0 || along > r || across > side) discard;
    bool filled = fill > 0.0 ? along <= r * fill : fill < 0.0 && along >= r * (1.0 + fill);
    a = (along > r - rim || along < rim || across > side - rim || filled) ? 1.0 : 0.0;
  } else {
    if (d > r) discard;
    bool edge = d > r - rim;
    if (shape == 2) {
      float off = abs(mod(atan(vLocal.y, vLocal.x) - vShape.w + 3.14159265, 6.28318531) - 3.14159265);
      if (off > 0.5 * vArc.x) discard;
      edge = edge || d * sin(min(0.5 * vArc.x - off, 1.5707963)) < rim;
    }
    bool filled = fill > 0.0 ? d <= r * fill : fill < 0.0 && d >= r * (1.0 + fill);
    a = shape == 0 || edge || filled ? 1.0 : 0.0;
  }
  if (a <= 0.0) discard;
  if (cut && uLees > 0 && inLee(vArc.yz, vArc.yz + vLocal)) discard;
  outColor = vec4(mix(vColor.rgb, uFogColor, fogAt(vZ)), vColor.a * a);
}
`;

  const BOARD_VS = `
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec4 aPlace;
layout(location = 2) in vec4 aColor;
uniform mat4 uViewProj;
uniform vec3 uRight;
uniform vec3 uUp;
out vec2 vCorner;
out float vZ;
flat out vec4 vColor;
void main() {
  // the place: x, y on the ground, z the height, and the size
  vec3 world = vec3(aPlace.x, aPlace.z, aPlace.y) + (uRight * aCorner.x + uUp * aCorner.y) * (0.5 * aPlace.w);
  vCorner = aCorner;
  vZ = aPlace.y;
  vColor = aColor;
  gl_Position = uViewProj * vec4(world, 1.0);
}
`;

  const BOARD_FS = FOG_GLSL + `
in vec2 vCorner;
in float vZ;
flat in vec4 vColor;
uniform int uAdd;
out vec4 outColor;
void main() {
  float a = vColor.a * (1.0 - smoothstep(0.3, 1.0, length(vCorner)));
  if (a <= 0.004) discard;
  float f = fogAt(vZ);
  outColor = uAdd == 1 ? vec4(vColor.rgb * (1.0 - f), a) : vec4(mix(vColor.rgb, uFogColor, f), a);
}
`;

  const FULL_VS = `
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

  // Half the size: each pixel the mean of four. uGlow 1 weighs each by its alpha, the glow the scene wrote there.
  const HALVE_FS = `
uniform sampler2D uSrc;
uniform ivec2 uSrcSize;
uniform int uGlow;
out vec4 outColor;
vec3 take(ivec2 p) {
  vec4 t = texelFetch(uSrc, min(p, uSrcSize - 1), 0);
  return uGlow == 1 ? t.rgb * t.a : t.rgb;
}
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy) * 2;
  outColor = vec4(0.25 * (take(p) + take(p + ivec2(1, 0)) + take(p + ivec2(0, 1)) + take(p + ivec2(1, 1))), 1.0);
}
`;

  const BLUR_FS = `
uniform sampler2D uSrc;
uniform ivec2 uSrcSize;
uniform ivec2 uStep;
out vec4 outColor;
vec3 take(ivec2 p) { return texelFetch(uSrc, clamp(p, ivec2(0), uSrcSize - 1), 0).rgb; }
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec3 s = 0.0625 * (take(p - 2 * uStep) + take(p + 2 * uStep)) + 0.25 * (take(p - uStep) + take(p + uStep)) + 0.375 * take(p);
  outColor = vec4(s, 1.0);
}
`;

  const COMPOSE_FS = BAYER + `
uniform sampler2D uScene;
uniform highp sampler2D uDepth;
uniform sampler2D uBloom;
uniform vec4 uPost;
uniform float uFlash;
uniform float uGrey;
uniform vec4 uDepthInfo;
uniform vec2 uBloomScale;
uniform ivec2 uSize;
out vec4 outColor;
float depthAt(ivec2 p) {
  float d = texelFetch(uDepth, clamp(p, ivec2(0), uSize - 1), 0).r;
  return uDepthInfo.x * uDepthInfo.y / (uDepthInfo.y - d * (uDepthInfo.y - uDepthInfo.x));
}
void main() {
  // uPost: outline, bloom, dither, vignette. uDepthInfo: near, far, the least jump, and the jump per metre of depth.
  // uGrey: how much colour goes out of what does not glow (the scene's alpha holds the glow).
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 scene = texelFetch(uScene, p, 0);
  vec3 c = scene.rgb;
  if (uGrey > 0.0) c = mix(c, vec3(dot(c, vec3(0.3, 0.55, 0.15))), uGrey * (1.0 - clamp(scene.a * 3.0, 0.0, 1.0)));
  if (uPost.x > 0.0) {
    float d = depthAt(p);
    float nearest = min(min(depthAt(p + ivec2(1, 0)), depthAt(p - ivec2(1, 0))), min(depthAt(p + ivec2(0, 1)), depthAt(p - ivec2(0, 1))));
    if (d - nearest > uDepthInfo.z + uDepthInfo.w * d) c *= 1.0 - ${OUTLINE_DARK} * uPost.x;
  }
  if (uPost.y > 0.0) c += texture(uBloom, gl_FragCoord.xy * uBloomScale).rgb * (uPost.y * ${BLOOM_GAIN});
  if (uPost.w > 0.0) {
    vec2 q = gl_FragCoord.xy / vec2(uSize) * 2.0 - 1.0;
    c *= 1.0 - uPost.w * 0.75 * smoothstep(0.3, 1.6, dot(q, q));
  }
  c = mix(c, vec3(1.0), uFlash);
  if (uPost.z > 0.0) {
    float levels = mix(255.0, 31.0, uPost.z);
    c = floor(clamp(c, 0.0, 1.0) * levels + bayer(p)) / levels;
  }
  outColor = vec4(c, 1.0);
}
`;

  const BLIT_FS = `
uniform sampler2D uSrc;
uniform ivec3 uBlit;
out vec4 outColor;
void main() {
  outColor = vec4(texelFetch(uSrc, (ivec2(gl_FragCoord.xy) + uBlit.xy) / uBlit.z, 0).rgb, 1.0);
}
`;

  const LIT_UNIFORMS = ['uViewProj', 'uSunDir', 'uSunColor', 'uAmbient', 'uLightPos', 'uLightColor', 'uLights', 'uFogColor', 'uFog',
    'uShadowMap', 'uShadowBias', 'uShadowMat', 'uShadowOffset'];
  const UNIT = { src: 0, depth: 1, bloom: 2, shadow: 3, tile: 4 };

  // ---- support ----

  const serving = new WeakSet();   // the canvases that serve a backend of this view
  let supported = null;

  // A canvas of its own: one that has given out a webgl2 context can never give a 2d one.
  function isSupported() {
    if (supported !== null) return supported;
    supported = false;
    try {
      const probe = document.createElement('canvas');
      probe.width = probe.height = 4;
      const gl = probe.getContext('webgl2', ATTRIBUTES);
      if (gl) {
        supported = !gl.isContextLost() && gl.getParameter(gl.MAX_TEXTURE_SIZE) >= 2048 && gl.getParameter(gl.MAX_VERTEX_ATTRIBS) >= 8;
        const lose = gl.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
      }
    } catch (e) {
      supported = false;
    }
    return supported;
  }

  // ---- the view ----

  function makeGl(canvas) {
    Core.assert(canvas && !serving.has(canvas), 'the canvas already serves a 3D view');
    const gl = canvas.getContext('webgl2', ATTRIBUTES);
    Core.assert(gl && !gl.isContextLost(), 'the canvas gives no webgl2 context');

    const caps = { puppets: true, shadows: true, lights: true, bloom: true, maxInstances: CAP };
    const stats = { drawCalls: 0, instances: 0 };
    let R = null;                 // every WebGL object, made by build() and made again after a lost context
    let lost = false;
    let level = 'high';
    let lastBegin = 0, slowFor = 0;

    // sizes: CSS pixels, the canvas, the target and how the one sits on the other
    let cssW = 1, cssH = 1, dpr = 1, W = 1, H = 1, factor = 1, tw = 0, th = 0, ox = 0, oy = 0;
    let hw = 1, hh = 1, qw = 1, qh = 1;
    let cropSX = 1, cropBX = 0, cropSY = 1, cropBY = 0;

    // the camera, in doubles: forward (0, -SIN, -COS), right (1, 0, 0), up (0, COS, -SIN)
    let tx = 0.25, ty = 0.14, D0 = 60, D = 60, zoomNow = 1, reach1 = 0.35, near = 18, far = 150;
    let tgtX = 0, tgtZ = 0, eyeX = 0, eyeY = 0, eyeZ = 0;
    const proj = Mesh.mat4(), viewM = Mesh.mat4(), vp = Mesh.mat4(), vp32 = new Float32Array(16);

    // the sun and its shadow map
    let sunX = 0, sunY = -1, sunZ = 0, sunR = 1, sunG = 1, sunB = 1;
    let shadowSize = 0, shadowKey = -1, side = 40, texel = 0.04, boxX = 0, boxY = 0, boxLo = 0, boxHi = 0, biasDepth = 0;
    const lightView = Mesh.mat4(), lightProj = Mesh.mat4(), lightVP = Mesh.mat4();
    const lightVP32 = new Float32Array(16), shadowMat32 = new Float32Array(16), v4 = new Float64Array(4);

    // the frame being gathered
    const used = new Int32Array(KINDS);
    let decalN = 0, coverN = 0, addN = 0, lightN = 0, leeN = 0;
    const leeData = new Float32Array(LEES * 4);   // the lee records: x, y, radius, reach
    const coverData = new Float32Array(BOARDS * BOARD), addData = new Float32Array(BOARDS * BOARD);
    const discData = new Float32Array(DISCS * STRIDE);
    const lightPos = new Float32Array(LIGHTS * 4), lightCol = new Float32Array(LIGHTS * 4);
    const ground = new Float32Array(4), ambient = new Float32Array(3), fog = new Float32Array(3);
    let fogNear = FOG_NEAR, fogFar = FOG_FAR, tile = null;
    const post = { outline: 1, bloom: 1, dither: 0, vignette: 0, flash: 0, grey: 0 };
    const tiles = new Map();      // tileset id -> {texture, span} | null

    // ---- building ----

    function shader(type, source, name) {
      const s = gl.createShader(type);
      gl.shaderSource(s, source);
      gl.compileShader(s);
      return { s: s, name: name, source: source };
    }

    // Compiles and links every program at once, so the driver may work on them side by side, then checks each.
    function programs(list) {
      const made = list.map((p) => {
        const v = shader(gl.VERTEX_SHADER, VS + (p.shadows ? SHADOWED : '') + p.vs, p.name);
        const f = shader(gl.FRAGMENT_SHADER, FS + (p.shadows ? SHADOWED : '') + p.fs, p.name);
        const program = gl.createProgram();
        gl.attachShader(program, v.s);
        gl.attachShader(program, f.s);
        gl.linkProgram(program);
        return { p: p, program: program, v: v, f: f };
      });
      const out = {};
      for (const m of made) {
        if (!gl.getProgramParameter(m.program, gl.LINK_STATUS) && !gl.isContextLost()) {
          for (const s of [m.v, m.f]) {
            if (!gl.getShaderParameter(s.s, gl.COMPILE_STATUS)) {
              throw new Error('the 3D view: the ' + s.name + ' shader does not compile: ' + gl.getShaderInfoLog(s.s));
            }
          }
          throw new Error('the 3D view: the ' + m.p.name + ' program does not link: ' + gl.getProgramInfoLog(m.program));
        }
        gl.deleteShader(m.v.s);
        gl.deleteShader(m.f.s);
        const u = { program: m.program };
        for (const name of m.p.uniforms) u[name] = gl.getUniformLocation(m.program, name);
        gl.useProgram(m.program);
        for (const name in m.p.units) {
          const at = gl.getUniformLocation(m.program, name);
          if (at) gl.uniform1i(at, m.p.units[name]);
        }
        out[m.p.name] = u;
      }
      return out;
    }

    function arrayBuffer(data, bytes, usage) {
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      if (data) gl.bufferData(gl.ARRAY_BUFFER, data, usage); else gl.bufferData(gl.ARRAY_BUFFER, bytes, usage);
      return b;
    }

    function attrib(loc, size, stride, offset, divisor) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset);
      gl.vertexAttribDivisor(loc, divisor);
    }

    function texture(w, h, format, filter) {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texStorage2D(gl.TEXTURE_2D, 1, format, w, h);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }

    function framebuffer(color, depth, what) {
      const f = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      if (color) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color, 0);
      if (depth) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0);
      if (!color) {
        gl.drawBuffers([gl.NONE]);
        gl.readBuffer(gl.NONE);
      }
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      if (status !== gl.FRAMEBUFFER_COMPLETE && !gl.isContextLost()) throw new Error('the 3D view: the ' + what + ' target is incomplete (' + status + ')');
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return f;
    }

    function build() {
      const lit = (name, shadows, vs, fs, more) => ({
        name: name, shadows: shadows, vs: vs, fs: fs, uniforms: LIT_UNIFORMS.concat(more || []),
        units: { uShadowMap: UNIT.shadow, uTile: UNIT.tile },
      });
      const plain = (name, vs, fs, uniforms, units) => ({ name: name, shadows: false, vs: vs, fs: fs, uniforms: uniforms, units: units || {} });
      const r = programs([
        lit('parts', false, PARTS_VS, PARTS_FS),
        lit('partsShadow', true, PARTS_VS, PARTS_FS),
        lit('ground', false, GROUND_VS, GROUND_FS, ['uGroundBox', 'uGround', 'uTileSpan']),
        lit('groundShadow', true, GROUND_VS, GROUND_FS, ['uGroundBox', 'uGround', 'uTileSpan']),
        plain('depth', DEPTH_VS, DEPTH_FS, ['uLightViewProj']),
        plain('decal', DECAL_VS, DECAL_FS, ['uViewProj', 'uFogColor', 'uFog', 'uLee', 'uLees']),
        plain('board', BOARD_VS, BOARD_FS, ['uViewProj', 'uRight', 'uUp', 'uFogColor', 'uFog', 'uAdd']),
        plain('halve', FULL_VS, HALVE_FS, ['uSrcSize', 'uGlow'], { uSrc: UNIT.src }),
        plain('blur', FULL_VS, BLUR_FS, ['uSrcSize', 'uStep'], { uSrc: UNIT.src }),
        plain('compose', FULL_VS, COMPOSE_FS, ['uPost', 'uFlash', 'uGrey', 'uDepthInfo', 'uBloomScale', 'uSize'],
          { uScene: UNIT.src, uDepth: UNIT.depth, uBloom: UNIT.bloom }),
        plain('blit', FULL_VS, BLIT_FS, ['uBlit'], { uSrc: UNIT.src }),
      ]);

      // the shapes: their triangles, and a buffer of instances each
      r.count = new Int32Array(KINDS);
      r.inst = [];
      r.vao = [];
      for (let s = 0; s < KINDS; s++) {
        const mesh = Mesh.shape(s), bytes = STRIDE * 4;
        r.count[s] = mesh.count;
        const vertices = arrayBuffer(mesh.data, 0, gl.STATIC_DRAW), inst = arrayBuffer(null, CAP * bytes, gl.DYNAMIC_DRAW);
        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
        attrib(0, 3, Mesh.FLOATS * 4, 0, 0);
        attrib(1, 3, Mesh.FLOATS * 4, 12, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, inst);
        attrib(2, 4, bytes, 0, 1);
        attrib(3, 4, bytes, 16, 1);
        attrib(4, 4, bytes, 32, 1);
        attrib(5, 4, bytes, 48, 1);
        attrib(6, 2, bytes, 64, 1);
        r.inst.push(inst);
        r.vao.push(vao);
      }

      // a square of corners at -1 and 1, for the ground, the decals and the billboards
      const square = arrayBuffer(new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), 0, gl.STATIC_DRAW);
      const withSquare = () => {
        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, square);
        attrib(0, 2, 8, 0, 0);
        return vao;
      };
      r.groundVao = withSquare();
      r.decalBuf = arrayBuffer(null, DECALS * DECAL * 4, gl.DYNAMIC_DRAW);
      r.decalVao = withSquare();
      gl.bindBuffer(gl.ARRAY_BUFFER, r.decalBuf);
      attrib(1, 4, DECAL * 4, 0, 1);
      attrib(2, 4, DECAL * 4, 16, 1);
      if (DECAL >= WIDE_DECAL) attrib(3, 3, DECAL * 4, 32, 1);   // shape, angle, arc, once the record carries them
      r.coverBuf = arrayBuffer(null, BOARDS * BOARD * 4, gl.DYNAMIC_DRAW);
      r.coverVao = withSquare();
      gl.bindBuffer(gl.ARRAY_BUFFER, r.coverBuf);
      attrib(1, 4, BOARD * 4, 0, 1);
      attrib(2, 4, BOARD * 4, 16, 1);
      r.addBuf = arrayBuffer(null, BOARDS * BOARD * 4, gl.DYNAMIC_DRAW);
      r.addVao = withSquare();
      gl.bindBuffer(gl.ARRAY_BUFFER, r.addBuf);
      attrib(1, 4, BOARD * 4, 0, 1);
      attrib(2, 4, BOARD * 4, 16, 1);
      r.emptyVao = gl.createVertexArray();
      gl.bindVertexArray(null);

      r.white = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, r.white);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
      r.targets = null;
      r.shadow = null;
      R = r;
      tiles.clear();
      tw = th = 0;
      fit();
      shadowMap();
    }

    // The targets for the scene and the steps after it, at the size of the low-resolution picture.
    function targets() {
      const r = R, old = r.targets;
      if (old) {
        for (const t of old.textures) gl.deleteTexture(t);
        for (const f of old.fbos) gl.deleteFramebuffer(f);
      }
      hw = Math.max(1, Math.ceil(tw / 2));
      hh = Math.max(1, Math.ceil(th / 2));
      qw = Math.max(1, Math.ceil(hw / 2));
      qh = Math.max(1, Math.ceil(hh / 2));
      const t = {
        color: texture(tw, th, gl.RGBA8, gl.NEAREST), depth: texture(tw, th, gl.DEPTH_COMPONENT24, gl.NEAREST),
        final: texture(tw, th, gl.RGBA8, gl.NEAREST), half: texture(hw, hh, gl.RGBA8, gl.LINEAR),
        qa: texture(qw, qh, gl.RGBA8, gl.LINEAR), qb: texture(qw, qh, gl.RGBA8, gl.LINEAR),
      };
      t.sceneFbo = framebuffer(t.color, t.depth, 'scene');
      t.finalFbo = framebuffer(t.final, null, 'final');
      t.halfFbo = framebuffer(t.half, null, 'bloom');
      t.qaFbo = framebuffer(t.qa, null, 'bloom');
      t.qbFbo = framebuffer(t.qb, null, 'bloom');
      t.textures = [t.color, t.depth, t.final, t.half, t.qa, t.qb];
      t.fbos = [t.sceneFbo, t.finalFbo, t.halfFbo, t.qaFbo, t.qbFbo];
      r.targets = t;
    }

    // The shadow map for the quality in force: none at 'low'.
    function shadowMap() {
      const r = R, want = SHADOW_SIZE[level];
      if (r.shadow && r.shadow.size === want) return;
      if (r.shadow) {
        gl.deleteTexture(r.shadow.texture);
        gl.deleteFramebuffer(r.shadow.fbo);
        r.shadow = null;
      }
      shadowSize = want;
      shadowKey = -1;
      if (!want) return;
      const t = texture(want, want, gl.DEPTH_COMPONENT16, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
      r.shadow = { size: want, texture: t, fbo: framebuffer(null, t, 'shadow') };
    }

    // ---- sizes and the camera ----

    // How many canvas pixels to a pixel of the target: the shorter side of the target in the band if a whole
    // number allows it (as near the middle of the band as may be), else as near the band as one comes.
    function factorFor(short) {
      let best = 1, bestMiss = Infinity, bestMid = Infinity;
      for (let f = 1; f <= 16; f++) {
        const s = short / f, miss = s < SHORT_LO ? SHORT_LO - s : s > SHORT_HI ? s - SHORT_HI : 0, mid = Math.abs(s - SHORT_MID);
        if (miss < bestMiss || (miss === 0 && bestMiss === 0 && mid < bestMid)) {
          best = f;
          bestMiss = miss;
          bestMid = mid;
        }
      }
      return best;
    }

    // The farthest ground point under a corner of the screen, for a camera 1 metre from the point looked at.
    function cornerReach() {
      let most = 0;
      for (let c = 0; c < 4; c++) {
        const sx = c & 1 ? 1 : -1, sy = c & 2 ? 1 : -1;
        const dx = sx * tx, dy = -SIN + sy * ty * COS, dz = -COS - sy * ty * SIN;
        const t = SIN / -dy, px = t * dx, pz = COS + t * dz;
        most = Math.max(most, Math.sqrt(px * px + pz * pz));
      }
      return most;
    }

    function lens() {
      const aspect = cssW / cssH, t = Math.tan(LENS / 2);
      if (aspect >= 1) {
        tx = t;
        ty = t / aspect;
      } else {
        ty = t;
        tx = t * aspect;
      }
      const v = Math.atan(ty);
      const across = SPAN / (2 * tx), up = SPAN / (SIN * (1 / Math.tan(TILT - v) - 1 / Math.tan(TILT + v)));
      reach1 = cornerReach();
      D0 = Math.min(across, up);
      if (D0 * reach1 > REACH) D0 = REACH / reach1;
    }

    function fit() {
      W = gl.drawingBufferWidth || canvas.width || 1;
      H = gl.drawingBufferHeight || canvas.height || 1;
      factor = factorFor(Math.min(W, H));
      const nw = Math.ceil(W / factor), nh = Math.ceil(H / factor);
      ox = Math.floor((nw * factor - W) / 2);
      oy = Math.floor((nh * factor - H) / 2);
      cropSX = W / (nw * factor);
      cropBX = (W + 2 * ox) / (nw * factor) - 1;
      cropSY = H / (nh * factor);
      cropBY = (H + 2 * oy) / (nh * factor) - 1;
      lens();
      aim(tgtX, tgtZ, zoomNow);   // the same point and zoom, through the camera of the new size
      shadowKey = -1;
      if (R && !lost && (nw !== tw || nh !== th || !R.targets)) {
        tw = nw;
        th = nh;
        targets();
      }
    }

    function resize(w, h, ratio) {
      cssW = w > 1 ? w : 1;
      cssH = h > 1 ? h : 1;
      dpr = ratio > 0 ? ratio : 1;
      let pw = Math.max(1, Math.round(cssW * dpr)), ph = Math.max(1, Math.round(cssH * dpr));
      if (pw * ph > PIXELS) {
        const k = Math.sqrt(PIXELS / (pw * ph));
        pw = Math.max(1, Math.floor(pw * k));
        ph = Math.max(1, Math.floor(ph * k));
      }
      if (canvas.width !== pw) canvas.width = pw;
      if (canvas.height !== ph) canvas.height = ph;
      fit();
    }

    // The camera for a frame: looking at (x, 0, y) from D metres away.
    function aim(x, y, zoom) {
      zoomNow = zoom;
      D = D0 / zoom;
      tgtX = x;
      tgtZ = y;
      eyeX = x;
      eyeY = D * SIN;
      eyeZ = y + D * COS;
      near = D * NEAR;
      far = D * FAR;
      Mesh.perspective(proj, tx, ty, near, far);
      Mesh.view(viewM, eyeX, eyeY, eyeZ, 0, -SIN, -COS, 0, 1, 0);
      Mesh.multiply(vp, proj, viewM);
      // the target is a little bigger than the canvas: the same view, scaled and moved onto it
      for (let j = 0; j < 16; j += 4) {
        vp32[j] = cropSX * vp[j] + cropBX * vp[j + 3];
        vp32[j + 1] = cropSY * vp[j + 1] + cropBY * vp[j + 3];
        vp32[j + 2] = vp[j + 2];
        vp32[j + 3] = vp[j + 3];
      }
    }

    function worldToScreen(x, y, z, out) {
      const vx = x - eyeX, vy = (z || 0) - eyeY, vz = y - eyeZ;
      const depth = -SIN * vy - COS * vz, across = vx, up = COS * vy - SIN * vz;
      out.x = (across / (depth * tx) + 1) * 0.5 * cssW;
      out.y = (1 - up / (depth * ty)) * 0.5 * cssH;
      return out;
    }

    function screenToWorld(sx, sy, out) {
      const nx = sx / cssW * 2 - 1, ny = 1 - sy / cssH * 2;
      const dx = nx * tx, dz = -COS - ny * ty * SIN;
      const dy = Math.min(-SIN + ny * ty * COS, -1e-6);
      const t = eyeY / -dy;
      out.x = eyeX + t * dx;
      out.y = eyeZ + t * dz;
      return out;
    }

    // ---- the sun and its shadow map ----

    // The box the shadow map covers: round the ground on the screen and what stands on it, in the sun's axes and
    // relative to the point looked at. Made again only when the camera's distance, the sun or the map change, so
    // that from frame to frame the box only moves, in whole texels of the map: the shadows stay where they are.
    function shadowBox() {
      let ux = 0, uy = 1, uz = 0;
      if (Math.abs(sunY) > 0.99) {
        uy = 0;
        uz = -1;
      }
      Mesh.view(lightView, 0, 0, 0, sunX, sunY, sunZ, ux, uy, uz);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (let c = 0; c < 8; c++) {
        const sx = c & 1 ? 1 : -1, sy = c & 2 ? 1 : -1, h = c & 4 ? CASTERS : 0;
        const dx = sx * tx, dy = -SIN + sy * ty * COS, dz = -COS - sy * ty * SIN, t = D * SIN / -dy;
        Mesh.apply(v4, lightView, t * dx, h, D * COS + t * dz, 0);
        x0 = Math.min(x0, v4[0]); x1 = Math.max(x1, v4[0]);
        y0 = Math.min(y0, v4[1]); y1 = Math.max(y1, v4[1]);
        z0 = Math.min(z0, v4[2]); z1 = Math.max(z1, v4[2]);
      }
      side = Math.ceil((Math.max(x1 - x0, y1 - y0) + 2) / 2) * 2;
      texel = side / shadowSize;
      boxX = (x0 + x1) / 2;
      boxY = (y0 + y1) / 2;
      boxLo = z0 - 1;
      boxHi = z1 + SUN_MARGIN;
      biasDepth = BIAS / (boxHi - boxLo);
    }

    function shadowFrame() {
      const key = D * 1000 + sunX * 7 + sunY * 13 + sunZ * 17 + shadowSize;
      if (key !== shadowKey) {
        shadowKey = key;
        shadowBox();
      }
      Mesh.apply(v4, lightView, tgtX, 0, tgtZ, 1);
      const cx = Math.round((v4[0] + boxX) / texel) * texel, cy = Math.round((v4[1] + boxY) / texel) * texel, half = side / 2;
      Mesh.ortho(lightProj, cx - half, cx + half, cy - half, cy + half, -(v4[2] + boxHi), -(v4[2] + boxLo));
      Mesh.multiply(lightVP, lightProj, lightView);
      for (let j = 0; j < 16; j += 4) {
        const w = lightVP[j + 3];
        lightVP32[j] = lightVP[j];
        lightVP32[j + 1] = lightVP[j + 1];
        lightVP32[j + 2] = lightVP[j + 2];
        lightVP32[j + 3] = w;
        shadowMat32[j] = 0.5 * (lightVP[j] + w);
        shadowMat32[j + 1] = 0.5 * (lightVP[j + 1] + w);
        shadowMat32[j + 2] = 0.5 * (lightVP[j + 2] + w);
        shadowMat32[j + 3] = w;
      }
    }

    // ---- the frame ----

    function colour(out, from, fallback) {
      const c = from && from.length >= 3 ? from : fallback;
      out[0] = +c[0] || 0;
      out[1] = +c[1] || 0;
      out[2] = +c[2] || 0;
    }

    function tileOf(id) {
      let entry = tiles.get(id);
      if (entry !== undefined) return entry;
      entry = null;
      const picture = typeof Ground.texture === 'function' ? Ground.texture(id) : null;
      if (picture) {
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, picture);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        const span = typeof Ground.span === 'function' ? +Ground.span(id) : 0;
        entry = { texture: t, span: span > 0 ? span : TILE_SPAN };
      }
      tiles.set(id, entry);
      return entry;
    }

    function readEnv(env) {
      const g = env ? env.ground : null;
      tile = typeof g === 'string' && !lost ? tileOf(g) : null;
      colour(ground, typeof g === 'string' ? null : g, GROUND);
      ground[3] = tile ? 1 : 0;
      colour(ambient, env ? env.ambient : null, AMBIENT);
      const sun = env ? env.sun : null, dir = sun && sun.dir && sun.dir.length >= 3 ? sun.dir : SUN_DIR;
      let x = +dir[0] || 0, y = +dir[1] || 0, z = +dir[2] || 0, len = Math.sqrt(x * x + y * y + z * z);
      if (!(len > 1e-9)) {
        x = SUN_DIR[0]; y = SUN_DIR[1]; z = SUN_DIR[2];
        len = Math.sqrt(x * x + y * y + z * z);
      }
      x /= len; y /= len; z /= len;
      if (y > -0.1) {   // keep the sun above the horizon
        const flat = Math.sqrt(x * x + z * z) || 1, k = Math.sqrt(1 - 0.01) / flat;
        x *= k; z *= k; y = -0.1;
      }
      sunX = x; sunY = y; sunZ = z;
      const c = sun && sun.color && sun.color.length >= 3 ? sun.color : SUN;
      sunR = +c[0] || 0; sunG = +c[1] || 0; sunB = +c[2] || 0;
      const f = env ? env.fog : null;
      colour(fog, f ? f.color : null, FOG);
      fogNear = f && Number.isFinite(f.near) ? f.near : FOG_NEAR;
      fogFar = f && Number.isFinite(f.far) ? f.far : FOG_FAR;
    }

    function share(v, fallback) { return Number.isFinite(v) ? (v < 0 ? 0 : v > 1 ? 1 : v) : fallback; }

    function readPost(p) {
      post.outline = share(p ? p.outline : NaN, POST.outline);
      post.bloom = share(p ? p.bloom : NaN, POST.bloom);
      post.dither = share(p ? p.dither : NaN, POST.dither);
      post.vignette = share(p ? p.vignette : NaN, POST.vignette);
      post.flash = share(p ? p.flash : NaN, POST.flash);
      post.grey = share(p ? p.grey : NaN, POST.grey);
    }

    function setLevel(next) {
      level = next;
      caps.shadows = next !== 'low';
      caps.bloom = next === 'high';
      if (R && !lost) shadowMap();
    }

    // Frames more than SLOW ms apart for SLOW_FOR ms running: one level down.
    function pace() {
      const now = Plat.now();
      if (lastBegin > 0) {
        const gap = now - lastBegin;
        if (gap > PAUSE) slowFor = 0;
        else if (gap > SLOW) slowFor += gap;
        else slowFor = 0;
        if (slowFor >= SLOW_FOR && level !== 'low') {
          slowFor = 0;
          setLevel(BELOW[level]);
          Plat.emit('quality', level);
        }
      }
      lastBegin = now;
    }

    function begin(cam, env) {
      pace();
      stats.drawCalls = 0;
      stats.instances = 0;
      for (let s = 0; s < KINDS; s++) used[s] = 0;
      decalN = coverN = addN = lightN = leeN = 0;
      const x = cam ? +cam.x || 0 : 0, y = cam ? +cam.y || 0 : 0, zoom = cam && cam.zoom > 0 ? +cam.zoom : 1;
      aim(x, y, zoom);
      readEnv(env);
    }

    function parts(shape, buffer, count) {
      const s = typeof shape === 'number' ? shape : SHAPES.indexOf(shape);
      if (!(s >= 0 && s < KINDS) || !(buffer instanceof Float32Array) || !(count > 0) || lost) return;
      const n = Math.min(count | 0, (buffer.length / STRIDE) | 0, CAP - used[s]);
      if (n <= 0) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, R.inst[s | 0]);
      gl.bufferSubData(gl.ARRAY_BUFFER, used[s] * STRIDE * 4, buffer, 0, n * STRIDE);
      used[s] += n;
      stats.instances += n;
    }

    function decals(buffer, count) {
      if (!(buffer instanceof Float32Array) || !(count > 0) || lost) return;
      const n = Math.min(count | 0, (buffer.length / DECAL) | 0, DECALS - decalN);
      if (n <= 0) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, R.decalBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, decalN * DECAL * 4, buffer, 0, n * DECAL);
      decalN += n;
      // lee records are not drawn: they go to the decal shader as what shelters the ground from cut decals
      let lees = 0;
      for (let i = 0, o = 0; DECAL >= WIDE_DECAL && i < n; i++, o += DECAL) {
        if (Math.abs(buffer[o + 8] - LEE_SHAPE) > 0.25) continue;
        lees++;
        if (leeN >= LEES) continue;
        const k = leeN++ * 4;
        leeData[k] = buffer[o]; leeData[k + 1] = buffer[o + 1]; leeData[k + 2] = buffer[o + 2]; leeData[k + 3] = buffer[o + 10];
      }
      stats.instances += n - lees;
    }

    function billboards(buffer, count) {
      if (!buffer || !(count > 0)) return;
      const n = Math.min(count | 0, (buffer.length / BOARD) | 0);
      for (let i = 0, o = 0; i < n; i++, o += BOARD) {
        const add = buffer[o + 8] > 0.5;
        if (add ? addN >= BOARDS : coverN >= BOARDS) continue;
        const into = add ? addData : coverData, at = (add ? addN++ : coverN++) * BOARD;
        for (let k = 0; k < BOARD; k++) into[at + k] = buffer[o + k];
        stats.instances++;
      }
    }

    // Each disc becomes an upright cylinder, its records gathered in a buffer of the view's own.
    function discs(buffer, count) {
      if (!buffer || !(count > 0)) return;
      const n = Math.min(count | 0, (buffer.length / DISC) | 0);
      let m = 0;
      for (let i = 0, d = 0; i < n; i++, d += DISC) {
        const r = buffer[d + 2];
        if (!(r > 0)) continue;
        const o = m * STRIDE;
        discData[o] = 2 * r; discData[o + 1] = 0; discData[o + 2] = 0; discData[o + 3] = buffer[d];
        discData[o + 4] = 0; discData[o + 5] = DISC_TALL * r; discData[o + 6] = 0; discData[o + 7] = 0;
        discData[o + 8] = 0; discData[o + 9] = 0; discData[o + 10] = 2 * r; discData[o + 11] = buffer[d + 1];
        discData[o + 12] = buffer[d + 3]; discData[o + 13] = buffer[d + 4]; discData[o + 14] = buffer[d + 5];
        discData[o + 15] = 0; discData[o + 16] = 0; discData[o + 17] = buffer[d + 6];
        if (++m === DISCS) {
          parts(CYL, discData, m);
          m = 0;
        }
      }
      if (m) parts(CYL, discData, m);
    }

    function lights(buffer, count) {
      if (!buffer || !(count > 0)) return;
      const n = Math.min(count | 0, (buffer.length / LIGHT) | 0);
      for (let i = 0, o = 0; i < n && lightN < LIGHTS; i++, o += LIGHT) {
        const r = buffer[o + 3];
        if (!(r > 0)) continue;
        const k = lightN * 4;
        lightPos[k] = buffer[o];
        lightPos[k + 1] = buffer[o + 2];
        lightPos[k + 2] = buffer[o + 1];
        lightPos[k + 3] = r;
        lightCol[k] = buffer[o + 4];
        lightCol[k + 1] = buffer[o + 5];
        lightCol[k + 2] = buffer[o + 6];
        lightCol[k + 3] = buffer[o + 7];
        lightN++;
      }
    }

    function bind(unit, t) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
    }

    function litUniforms(p, shadows) {
      gl.useProgram(p.program);
      gl.uniformMatrix4fv(p.uViewProj, false, vp32);
      gl.uniform3f(p.uSunDir, -sunX, -sunY, -sunZ);
      gl.uniform3f(p.uSunColor, sunR, sunG, sunB);
      gl.uniform3f(p.uAmbient, ambient[0], ambient[1], ambient[2]);
      gl.uniform3f(p.uFogColor, fog[0], fog[1], fog[2]);
      gl.uniform3f(p.uFog, fogNear, fogFar, tgtZ);
      gl.uniform1i(p.uLights, lightN);
      if (lightN) {
        gl.uniform4fv(p.uLightPos, lightPos, 0, lightN * 4);
        gl.uniform4fv(p.uLightColor, lightCol, 0, lightN * 4);
      }
      if (shadows) {
        gl.uniformMatrix4fv(p.uShadowMat, false, shadowMat32);
        gl.uniform1f(p.uShadowBias, biasDepth);
        gl.uniform1f(p.uShadowOffset, texel);
      }
    }

    function drawShapes() {
      for (let s = 0; s < KINDS; s++) {
        if (!used[s]) continue;
        gl.bindVertexArray(R.vao[s]);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, R.count[s], used[s]);
        stats.drawCalls++;
      }
    }

    function full(fbo, w, h) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, w, h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      stats.drawCalls++;
    }

    function end(p) {
      if (lost || gl.isContextLost() || !R || !R.targets) return;
      readPost(p);
      const r = R, t = r.targets, shadows = level !== 'low' && !!r.shadow;
      let solid = 0;
      for (let s = 0; s < KINDS; s++) solid += used[s];

      // 1. the shadow map, seen from the sun
      if (shadows) {
        shadowFrame();
        gl.bindFramebuffer(gl.FRAMEBUFFER, r.shadow.fbo);
        gl.viewport(0, 0, shadowSize, shadowSize);
        gl.disable(gl.BLEND);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.depthMask(true);
        gl.clearDepth(1);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        if (solid) {
          gl.enable(gl.CULL_FACE);
          gl.cullFace(gl.FRONT);
          gl.enable(gl.POLYGON_OFFSET_FILL);
          gl.polygonOffset(1, 2);
          gl.useProgram(r.depth.program);
          gl.uniformMatrix4fv(r.depth.uLightViewProj, false, lightVP32);
          drawShapes();
          gl.disable(gl.POLYGON_OFFSET_FILL);
        }
        bind(UNIT.shadow, r.shadow.texture);
      }

      // 2. the scene, into the low-resolution target: solids, the ground, decals, billboards
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.sceneFbo);
      gl.viewport(0, 0, tw, th);
      gl.clearColor(fog[0], fog[1], fog[2], 0);
      gl.clearDepth(1);
      gl.depthMask(true);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.disable(gl.BLEND);
      if (solid) {
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
        litUniforms(shadows ? r.partsShadow : r.parts, shadows);
        drawShapes();
      }
      gl.disable(gl.CULL_FACE);
      const g = shadows ? r.groundShadow : r.ground;
      litUniforms(g, shadows);
      gl.uniform3f(g.uGroundBox, tgtX, tgtZ, reach1 * D * 1.2 + 2);
      gl.uniform4f(g.uGround, ground[0], ground[1], ground[2], ground[3]);
      gl.uniform1f(g.uTileSpan, tile ? tile.span : TILE_SPAN);
      bind(UNIT.tile, tile ? tile.texture : r.white);
      gl.bindVertexArray(r.groundVao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      stats.drawCalls++;

      gl.depthMask(false);
      gl.enable(gl.BLEND);
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
      if (decalN) {
        gl.useProgram(r.decal.program);
        gl.uniformMatrix4fv(r.decal.uViewProj, false, vp32);
        gl.uniform3f(r.decal.uFogColor, fog[0], fog[1], fog[2]);
        gl.uniform3f(r.decal.uFog, fogNear, fogFar, tgtZ);
        gl.uniform1i(r.decal.uLees, leeN);
        if (leeN) gl.uniform4fv(r.decal.uLee, leeData, 0, leeN * 4);
        gl.bindVertexArray(r.decalVao);
        if (DECAL < WIDE_DECAL) gl.vertexAttrib4f(3, 1, 0, 2 * Math.PI, 0);   // a ring, until the record says otherwise
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, decalN);
        stats.drawCalls++;
      }
      if (coverN || addN) {
        const b = r.board;
        gl.useProgram(b.program);
        gl.uniformMatrix4fv(b.uViewProj, false, vp32);
        gl.uniform3f(b.uRight, 1, 0, 0);
        gl.uniform3f(b.uUp, 0, COS, -SIN);
        gl.uniform3f(b.uFogColor, fog[0], fog[1], fog[2]);
        gl.uniform3f(b.uFog, fogNear, fogFar, tgtZ);
        if (coverN) {
          gl.bindBuffer(gl.ARRAY_BUFFER, r.coverBuf);
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, coverData, 0, coverN * BOARD);
          gl.uniform1i(b.uAdd, 0);
          gl.bindVertexArray(r.coverVao);
          gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, coverN);
          stats.drawCalls++;
        }
        if (addN) {
          gl.bindBuffer(gl.ARRAY_BUFFER, r.addBuf);
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, addData, 0, addN * BOARD);
          gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ONE, gl.ONE);
          gl.uniform1i(b.uAdd, 1);
          gl.bindVertexArray(r.addVao);
          gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, addN);
          stats.drawCalls++;
        }
      }
      gl.disable(gl.BLEND);
      gl.disable(gl.DEPTH_TEST);
      gl.depthMask(true);

      // 3. bloom: the glow, halved twice and blurred across and up
      gl.bindVertexArray(r.emptyVao);
      const bloom = level === 'high' && post.bloom > 0;
      if (bloom) {
        gl.useProgram(r.halve.program);
        bind(UNIT.src, t.color);
        gl.uniform2i(r.halve.uSrcSize, tw, th);
        gl.uniform1i(r.halve.uGlow, 1);
        full(t.halfFbo, hw, hh);
        bind(UNIT.src, t.half);
        gl.uniform2i(r.halve.uSrcSize, hw, hh);
        gl.uniform1i(r.halve.uGlow, 0);
        full(t.qaFbo, qw, qh);
        gl.useProgram(r.blur.program);
        gl.uniform2i(r.blur.uSrcSize, qw, qh);
        bind(UNIT.src, t.qa);
        gl.uniform2i(r.blur.uStep, 1, 0);
        full(t.qbFbo, qw, qh);
        bind(UNIT.src, t.qb);
        gl.uniform2i(r.blur.uStep, 0, 1);
        full(t.qaFbo, qw, qh);
      }

      // 4. outline, bloom, vignette, flash and dither, into the finished low-resolution picture
      const c = r.compose;
      gl.useProgram(c.program);
      bind(UNIT.src, t.color);
      bind(UNIT.depth, t.depth);
      bind(UNIT.bloom, t.qa);
      gl.uniform4f(c.uPost, level === 'low' ? 0 : post.outline, bloom ? post.bloom : 0, post.dither, post.vignette);
      gl.uniform1f(c.uFlash, post.flash);
      gl.uniform1f(c.uGrey, post.grey);
      gl.uniform4f(c.uDepthInfo, near, far, OUTLINE_JUMP, OUTLINE_PER_METRE);
      gl.uniform2f(c.uBloomScale, 1 / (4 * qw), 1 / (4 * qh));
      gl.uniform2i(c.uSize, tw, th);
      full(t.finalFbo, tw, th);

      // 5. scaled up onto the canvas, a whole number of pixels to each
      gl.useProgram(r.blit.program);
      bind(UNIT.src, t.final);
      gl.uniform3i(r.blit.uBlit, ox, oy, factor);
      full(null, W, H);
      gl.bindVertexArray(null);
    }

    function readPixels(x, y, w, h) {
      if (lost || gl.isContextLost() || !R || !R.targets) return null;
      x = Math.floor(x) || 0;
      y = Math.floor(y) || 0;
      w = Math.max(1, Math.floor(w) || 1);
      h = Math.max(1, Math.floor(h) || 1);
      const col = (cx) => Core.clamp(Math.floor((Core.clamp(cx, 0, W - 1) + ox) / factor), 0, tw - 1);
      const row = (cy) => Core.clamp(Math.floor((H - 1 - Core.clamp(cy, 0, H - 1) + oy) / factor), 0, th - 1);
      const u0 = col(x), u1 = col(x + w - 1), v0 = row(y + h - 1), v1 = row(y);
      const bw = u1 - u0 + 1, bh = v1 - v0 + 1, block = new Uint8Array(bw * bh * 4), out = new Uint8Array(w * h * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, R.targets.finalFbo);
      gl.readPixels(u0, v0, bw, bh, gl.RGBA, gl.UNSIGNED_BYTE, block);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      for (let j = 0; j < h; j++) {
        const v = row(y + j) - v0;
        for (let i = 0; i < w; i++) {
          const from = (v * bw + col(x + i) - u0) * 4, to = (j * w + i) * 4;
          out[to] = block[from];
          out[to + 1] = block[from + 1];
          out[to + 2] = block[from + 2];
          out[to + 3] = block[from + 3];
        }
      }
      return out;
    }

    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();   // without this the context never comes back
      lost = true;
    }, false);
    canvas.addEventListener('webglcontextrestored', function () {
      lost = false;
      try {
        build();
      } catch (err) {
        lost = true;
        console.warn('the 3D view could not build itself again after its context came back', err);
      }
    }, false);

    try {
      build();
    } catch (err) {
      const lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();   // give the context back at once: the next view will want one
      throw err;
    }
    serving.add(canvas);
    setLevel(level);
    resize(canvas.clientWidth || canvas.width || 300, canvas.clientHeight || canvas.height || 150, 1);

    return {
      name: 'gl',
      canvas: canvas,
      caps: caps,
      stats: stats,
      resize: resize,
      quality: function (next) {
        if (next === 'high' || next === 'medium' || next === 'low') {
          slowFor = 0;
          if (next !== level) setLevel(next);
        }
        return level;
      },
      begin: begin,
      parts: parts,
      decals: decals,
      discs: discs,
      billboards: billboards,
      lights: lights,
      end: end,
      worldToScreen: worldToScreen,
      screenToWorld: screenToWorld,
      visibleRadius: function () { return reach1 * D; },
      readPixels: readPixels,
    };
  }

  Gfx.register('gl', makeGl, isSupported);
})();
