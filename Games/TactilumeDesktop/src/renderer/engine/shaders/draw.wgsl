// Draws each particle as a speck of light: colour from the palette (or a player's colour
// near their touches), size from perspective and soft focus, and brightness spread so a
// blurred speck keeps its energy. engine.js puts common.wgsl in front of this file.
//
// A port of the mobile edition's points.vert.glsl and points.frag.glsl. Mobile draws GL
// points; WebGPU points are always one pixel, so here every particle is a quad that covers
// the same square a point sprite would. A quad never shrinks below one pixel: smaller ones
// could miss every pixel centre and vanish.
//
// The quads are instanced in batches: each instance draws BATCH particles, from a shared
// index buffer of BATCH quads (4 corners and 6 indices each). One instance per particle
// would cost a fixed amount per instance, which some GPUs (and the software one the tests
// use, 20 µs each) pay dearly for four vertices.

@group(0) @binding(0) var<uniform> F: Frame;
@group(0) @binding(1) var<storage, read> particles: array<Particle>;
@group(0) @binding(2) var palette: texture_2d<f32>;
@group(0) @binding(3) var linearSampler: sampler;
@group(0) @binding(4) var teamField: texture_2d<f32>;

struct Speck {
  @builtin(position) clip: vec4f,
  @location(0) color: vec3f,
  @location(1) corner: vec2f,   // -1..1 across the quad
  @location(2) soft: f32,       // 0: a flat square (small specks), 1: a soft disc
};

fn hueRotate(c: vec3f, a: f32) -> vec3f {
  let k = vec3f(0.57735027);
  let ca = cos(a);
  return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca);
}

const BATCH = 64u;   // particles per instance; engine.js uses the same number

@vertex
fn speck(@builtin(vertex_index) vertex: u32, @builtin(instance_index) batch: u32) -> Speck {
  let id = batch * BATCH + vertex / 4u;
  let corner = vertex % 4u;
  let pt = particles[min(id, arrayLength(&particles) - 1u)];
  let s = seeds(id);
  let p = pt.pos.xyz;
  let v = pt.vel.xyz;
  let heat = pt.pos.w;

  let clip = F.viewProj * vec4f(p, 1.0);
  let dist = max(clip.w, 0.05);
  let persp = F.camDist / dist; // nonzero: dist >= 0.05
  let base = F.pointPx * persp * (0.75 + 0.5 * s.z);
  let blur = F.dofPx * abs(dist - F.camDist);
  let size = min(sqrt(base * base + blur * blur), F.maxPx);
  let px = max(size, 1.0);

  // where on the palette this speck sits
  let speed = length(v);
  var t: f32;
  if (F.colorBy == 0u) { t = 1.0 - exp(-speed * 1.1); }
  else if (F.colorBy == 1u) { t = 1.0 - exp(-heat * 0.7); }
  else if (F.colorBy == 2u) { t = s.x; }
  else if (F.colorBy == 3u) { t = 0.5 + 0.5 * sin(atan2(v.y, v.x + 1e-6)); }
  else { t = clamp(0.5 + p.z / max(F.depthRange, 0.05) * 0.5, 0.0, 1.0); }
  // a touch of per-particle spread keeps flat regions from looking banded
  t = clamp(t * 0.92 + (s.y - 0.5) * 0.08 + 0.04, 0.0, 1.0);
  let encA = textureSampleLevel(palette, linearSampler, vec2f(t, F.palA), 0.0).rgb;
  let encB = textureSampleLevel(palette, linearSampler, vec2f(t, F.palB), 0.0).rgb;
  var col = srgbToLinear(mix(encA, encB, F.palMix));

  // With two or more players, light near a player's touches takes on that player's colour.
  // The field is a small picture of where each colour reaches, made once per frame
  // (team.wgsl), so each particle looks it up once instead of visiting every touch.
  if (F.teamMix > 0.0) {
    let uv = vec2f(0.5 + p.x * F.teamScale.x, 0.5 - p.y * F.teamScale.y);
    let team = textureSampleLevel(teamField, linearSampler, uv, 0.0);
    col = mix(col, team.rgb, clamp(team.a * F.teamMix, 0.0, 1.0));
  }
  if (F.hue != 0.0) { col = max(hueRotate(col, F.hue), vec3f(0.0)); }
  // partly even out how bright the colours are (a deep red is far darker than a pale
  // yellow), so the palette sets the hue and heat sets the brightness
  let lum = dot(col, LUMA);
  col *= min(pow(0.3 / max(lum, 0.004), 0.55), 5.0); // non-negative: 0.3 over a positive number

  // hot light burns brighter; resting light glows softly
  var bright = 0.45 + 0.55 * min(heat, 3.0) + 0.25 * min(speed, 2.0);
  // now and then a speck catches the light
  let tw = sin(F.time * (1.3 + s.w * 3.7 + F.high * 6.0) + s.x * 97.0);
  bright *= 1.0 + F.sparkle * pow(max(tw, 0.0), 24.0) * 6.0;

  // the same light spread over a larger square when out of focus or below a pixel
  let energy = F.energy * persp * bright * (base * base) / (px * px); // nonzero: px >= 1
  let color = col * min(energy, F.energyCap);

  // the quad's corners: (-1,-1) (1,-1) (-1,1) (1,1)
  let c = vec2f(f32(corner & 1u), f32(corner >> 1u)) * 2.0 - 1.0;
  var out: Speck;
  // px pixels across: half of it each way, and one pixel is 2 / width in clip space
  out.clip = vec4f(clip.xy + c * px * F.invRes * clip.w, clip.z, clip.w);
  out.color = color;
  out.corner = c;
  out.soft = smoothstep(1.6, 3.6, px);
  // the last batch's spare quads, and a broken particle, draw nothing: off screen, rather
  // than a NaN that would spread
  if (id >= F.count || bad3(p) || bad3(color) || badf(heat)) {
    out.clip = vec4f(2.0, 2.0, 2.0, 1.0);
    out.color = vec3f(0.0);
  }
  return out;
}

@fragment
fn light(frag: Speck) -> @location(0) vec4f {
  // small specks are flat squares; larger ones are soft discs with the same total light
  // (5.14 is 1 / the mean of exp(-4 r^2) over the square)
  let shape = mix(1.0, exp(-4.0 * dot(frag.corner, frag.corner)) * 5.14, frag.soft);
  return vec4f(frag.color * shape, 0.0);
}
