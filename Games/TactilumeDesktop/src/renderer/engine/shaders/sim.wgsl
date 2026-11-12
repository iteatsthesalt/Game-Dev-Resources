// One step of the particle simulation, and the placing of particles in their resting shape.
// engine.js puts common.wgsl in front of this file.
//
// A port of the mobile edition's sim.vert.glsl, line by line: the behaviours, forms, flow,
// rings, gravity and audio forces must mean the same in both editions. The differences are
// WebGPU's: a compute shader updates each particle in place (it only ever reads its own),
// poles come from a uniform array of 64, and the dispatch may be two-dimensional, because a
// dispatch has at most 65,535 workgroups along each side.

@group(0) @binding(0) var<uniform> F: Frame;
@group(0) @binding(1) var<storage, read_write> particles: array<Particle>;

// Behaviour ids, as in the mobile edition's core/behaviours.js
const B_WELL = 0u;
const B_WHIRL = 1u;
const B_BURST = 2u;
const B_HALO = 3u;
const B_CURRENT = 4u;
const B_WEAVE = 5u;
const B_CHIME = 6u;
const B_STORM = 7u;
const B_LATTICE = 8u;
const B_NOVA = 9u;
const B_MURMUR = 10u;
const B_FOUNTAIN = 11u;

// Forms, as in core/scene.js FORMS
const F_NEBULA = 0u;
const F_DISC = 1u;
const F_SHELL = 2u;
const F_RING = 3u;
const F_LATTICE = 4u;
const F_NONE = 5u;

const LATTICE_SPACING = 0.25;
const GROUP_SIZE = 256u;

fn poleAt(i: u32) -> vec3f { return vec3f(F.poles[i].place.xy, 0.0); }
fn poleWeight(i: u32) -> f32 { return F.poles[i].place.z; }
fn poleAge(i: u32) -> f32 { return F.poles[i].place.w; }
fn poleVel(i: u32) -> vec2f { return F.poles[i].motion.xy; }
fn polePower(i: u32) -> f32 { return F.poles[i].motion.z; }
fn poleSpin(i: u32) -> f32 { return F.poles[i].motion.w; }

// A point on the lattice: glowing grid lines. Each particle sits on one line.
fn latticeHome(s: vec4f) -> vec3f {
  let ax = F.aspect * 1.05;
  let dz = 0.15 + F.depth * 0.75;
  let fam = i32(s.w * select(2.0, 3.0, F.depth > 0.15));
  let nx = floor(ax / LATTICE_SPACING);
  let ny = floor(1.05 / LATTICE_SPACING);
  let nz = max(1.0, floor(dz / LATTICE_SPACING));
  let gx = (floor(s.y * (2.0 * nx + 1.0)) - nx) * LATTICE_SPACING;
  let gy = (floor(s.z * (2.0 * ny + 1.0)) - ny) * LATTICE_SPACING;
  let gz = (floor(s.z * (2.0 * nz + 1.0)) - nz) * LATTICE_SPACING;
  let gz2 = (floor(s.y * (2.0 * nz + 1.0)) - nz) * LATTICE_SPACING;
  let u = s.x * 2.0 - 1.0;
  if (fam == 0) { return vec3f(u * ax, gy, gz2 * F.depth); }
  if (fam == 1) { return vec3f(gx, u * 1.05, gz * F.depth); }
  return vec3f(gx, gy, u * dz);
}

// Where a particle rests in each shape. The shapes turn slowly, so the targets move.
fn formTarget(form: u32, s: vec4f, t: f32) -> vec3f {
  let R = min(F.aspect, 1.0) * 0.86;
  if (form == F_DISC) {
    var r = 0.06 + 0.94 * sqrt(s.x);
    let a = s.y * TAU + t * 0.32 / (0.22 + r); // nonzero: r >= 0.06
    // two soft spiral arms
    r *= 1.0 + 0.07 * sin(2.0 * a - 7.0 * r);
    let z = (s.z - 0.5) * 0.16 * F.depth * (1.0 - 0.7 * r);
    // a little wider than tall on wide screens, so the disc fills them
    return vec3f(cos(a) * r * R * clamp(F.aspect, 1.0, 1.35), sin(a) * r * R, z);
  }
  if (form == F_SHELL) {
    let z = s.x * 2.0 - 1.0;
    let a = s.y * TAU + t * 0.12;
    let rr = sqrt(max(1.0 - z * z, 0.0));
    var p = vec3f(cos(a) * rr, z, sin(a) * rr) * R * 0.92;
    p.z *= F.depth;
    return p + (s.zwx - 0.5) * 0.02;
  }
  if (form == F_RING) {
    let a = s.x * TAU + t * 0.18;
    let b = s.y * TAU;
    let minor = 0.05 + 0.04 * s.z;
    let p = vec3f(cos(a) * (R + minor * cos(b)), sin(a) * (R + minor * cos(b)), minor * sin(b));
    let tilt = F.depth * 1.05;
    let c = cos(tilt);
    let sn = sin(tilt);
    return vec3f(p.x, p.y * c - p.z * sn, p.y * sn + p.z * c);
  }
  if (form == F_LATTICE) { return latticeHome(s); }
  // nebula and none: a soft cloud
  let r1 = sqrt(-2.0 * log(max(s.x, 1e-6)));
  let g = vec3f(r1 * cos(TAU * s.y), r1 * sin(TAU * s.y), (s.z - 0.5) * 2.4);
  return g * vec3f(F.aspect * 0.34, 0.34, 0.32 * F.depth);
}

// ---------------------------------------------------------------------------------------
// The behaviours. Each returns an acceleration and adds to `heat` (how bright it gets).

fn bWell(p: vec3f, v: vec3f, heat: ptr<function, f32>) -> vec3f {
  var acc = vec3f(0.0);
  for (var i = 0u; i < F.poleCount; i++) {
    let w = poleWeight(i);
    let d = poleAt(i) - p;
    let r2 = dot(d, d) + 0.0025;
    let r = sqrt(r2);
    acc += d / r * min(w * 0.6 / r2, 45.0); // nonzero: r2 >= 0.0025, r >= 0.05
    // a sideways pull, so the light settles into discs instead of falling straight through
    acc += vec3f(-d.y, d.x, 0.0) / r * w * 0.85 * poleSpin(i) / (r + 0.14); // nonzero: r >= 0.05
    // a soft core keeps the centre from collapsing to a single point
    acc -= d / r * w * 26.0 * exp(-r2 * 700.0); // nonzero: r >= 0.05
    *heat += w * 0.9 * exp(-r2 * 34.0);
  }
  return acc;
}

fn bWhirl(p: vec3f, v: vec3f, heat: ptr<function, f32>) -> vec3f {
  var field = vec3f(0.0);
  var wsum = 0.0;
  for (var i = 0u; i < F.poleCount; i++) {
    let w = poleWeight(i);
    let d = poleAt(i) - p;
    let r2 = dot(d.xy, d.xy) + 0.004;
    let r = sqrt(r2);
    // a solid core that turns into a 1/r swirl outside: neighbouring touches turn opposite ways
    let turn = select(-1.0, 1.0, i % 2u == 0u);
    var t = vec3f(-d.y, d.x, 0.0) / r * (w * 1.7 * r / (r2 + 0.045)) * turn; // nonzero: r >= 0.063, r2 > 0
    t += d * w * 0.4 / (r + 0.35); // nonzero: r >= 0
    t.z += sin(r * 13.0 - F.time * 2.2 + f32(i)) * 0.22 * w * F.depth;
    let f = exp(-r * 1.1);
    field += t * f;
    wsum += f * w;
    *heat += w * 0.9 * exp(-r2 * 10.0);
  }
  return (field - v * min(wsum, 1.0)) * 2.6;
}

fn bBurst(p: vec3f, v: vec3f, heat: ptr<function, f32>) -> vec3f {
  var acc = vec3f(0.0);
  for (var i = 0u; i < F.poleCount; i++) {
    let w = poleWeight(i);
    let d = p - poleAt(i);
    let r2 = dot(d, d) + 0.003;
    let r = sqrt(r2);
    let n = d / r; // nonzero: r >= 0.054
    // a short-range push keeps a clear space around the touch
    acc += n * w * 0.3 / (r2 + 0.04) * exp(-r * 1.5); // nonzero: r2 > 0
    // rings go out every 0.9 s while held, the first one at touch-down
    let age = poleAge(i);
    let ph = age - 0.9 * floor(age / 0.9);
    let R = ph * 1.5;
    // a square, never pow(x, 2.0): pow is undefined for negative x
    let off = (length(d.xy) - R) / 0.04;
    let band = exp(-off * off) * (1.0 - ph / 0.9);
    acc += n * band * w * 14.0;
    *heat += band * w * 3.0;
    // and the light drifts back in between rings
    acc -= n * w * 0.35 * smoothstep(0.25, 1.2, r);
  }
  return acc;
}

fn bHalo(p: vec3f, v: vec3f, s: vec4f, heat: ptr<function, f32>) -> vec3f {
  // Each particle belongs to one touch's halo. (Pulling toward every ring at once would
  // trap the light at the balance point between two touches.)
  let i = min(u32(s.y * f32(F.poleCount)), F.poleCount - 1u);
  let w = poleWeight(i);
  let d = p - poleAt(i);
  let r = length(d) + 1e-4;
  let n = d / r; // nonzero: r >= 1e-4
  // rings within the ring: each particle keeps to its own shell
  let R0 = (0.15 + 0.06 * polePower(i)) * (0.8 + 0.4 * s.z) + 0.025 * sin(poleAge(i) * 2.3 + f32(i));
  var acc = -n * (r - R0) * 14.0 * w;
  acc += vec3f(-n.y, n.x, 0.0) * (0.9 + 0.8 * s.x) * w * poleSpin(i);
  acc -= v * 1.5 * w;
  *heat += w * (0.25 + exp(-abs(r - R0) * 24.0) * 1.1);
  return acc;
}

// The closest point to p on the segment a-b, and the segment's direction.
struct Segment { closest: vec3f, dir: vec3f };

fn closestOnSegment(p: vec3f, a: vec3f, b: vec3f) -> Segment {
  let ab = b - a;
  let L2 = max(dot(ab, ab), 1e-6);
  let t = clamp(dot(p - a, ab) / L2, 0.0, 1.0); // nonzero: L2 >= 1e-6
  return Segment(a + ab * t, ab * inverseSqrt(L2));
}

fn bCurrent(p: vec3f, v: vec3f, s: vec4f, id: u32, heat: ptr<function, f32>) -> vec3f {
  let n = F.poleCount;
  if (s.w > 0.8) { return vec3f(0.0); }   // some light stays loose, as atmosphere
  // each particle swims in its own lane, so the river has width and grain
  let lane3 = bellSeeds(id) * 0.045;
  if (n == 1u) {
    // one touch: a circular river around it
    let w = poleWeight(0u);
    let d = p - poleAt(0u);
    let r = length(d.xy) + 1e-3;
    let tang = vec3f(-d.y, d.x, 0.0) / r; // nonzero: r >= 1e-3
    var goal = tang * 1.3 - d / r * (r - 0.32) * 3.0; // nonzero: r >= 1e-3
    goal.z = -p.z * 1.5;
    let f = w * exp(-abs(r - 0.32) * 3.0);
    *heat += f * 0.8;
    return (goal - v) * 2.4 * f;
  }
  var field = vec3f(0.0);
  var wsum = 0.0;
  var pull = vec3f(0.0);
  for (var i = 0u; i < n; i++) {
    let j = (i + 1u) % n; // nonzero: n >= 2 here
    var a = poleAt(i);
    var b = poleAt(j);
    // with two touches the river runs out on one side and back on the other
    if (n == 2u) {
      let ab = b - a;
      let side = normalize(vec3f(-ab.y, ab.x, 0.0) + 1e-5) * 0.08;
      a += side;
      b += side;
    }
    let seg = closestOnSegment(p, a, b);
    let side = vec3f(-seg.dir.y, seg.dir.x, 0.0);
    let c = seg.closest + side * lane3.x + vec3f(0.0, 0.0, lane3.y * F.depth);
    let dd = p - c;
    let dist2 = dot(dd, dd);
    let w = min(poleWeight(i), poleWeight(j));
    let f = exp(-dist2 / 0.03) * w;
    // faster in the middle of the stream than at its banks
    field += seg.dir * (1.1 + 0.7 * exp(-lane3.x * lane3.x * 600.0)) * f;
    wsum += f;
    pull += -dd / (sqrt(dist2) + 0.05) * 0.7 * exp(-dist2 / 0.2) * w; // nonzero: sqrt(...) + 0.05 >= 0.05
    *heat += f * 0.8;
  }
  return (field - v * min(wsum, 1.0)) * 2.6 + pull;
}

fn bWeave(p: vec3f, v: vec3f, s: vec4f, heat: ptr<function, f32>) -> vec3f {
  let n = F.poleCount;
  if (s.w > 0.72) { return vec3f(0.0); }   // some light stays loose, as atmosphere
  if (n == 1u) {
    let w = poleWeight(0u);
    let a = s.x * TAU + F.time * 0.6;
    let goal = poleAt(0u) + vec3f(cos(a), sin(a), sin(a * 2.0 + s.y * TAU) * 0.3 * F.depth) * (0.22 + 0.02 * sin(a * 5.0 + F.time * 3.0));
    *heat += w * 0.4;
    return ((goal - p) * 16.0 - v * 3.0) * w;
  }
  // threads: each touch to the next, and (from 4 touches) to the one after that too
  let segs = select(select(2u * n, 3u, n == 3u), 1u, n == 2u);
  let k = min(u32(s.x * f32(segs)), segs - 1u);
  let i = select(k - n, k, k < n);
  let j = select((i + 2u) % n, (i + 1u) % n, k < n); // nonzero: n >= 2 here
  let a = poleAt(i);
  let b = poleAt(j);
  let ab = b - a;
  let L = length(ab) + 1e-4;
  let side = vec3f(-ab.y, ab.x, 0.0) / L; // nonzero: L >= 1e-4
  let tp = fract(s.y + F.time * 0.04 * (s.z - 0.5));
  // the thread vibrates like a plucked string, in its own harmonic
  let harmonic = f32(1u + k % 3u);
  let vib = sin(3.14159 * tp * harmonic) * sin(F.time * (3.0 + harmonic * 1.7) + f32(k)) * 0.05 * min(L, 1.0);
  let jit = (s.zw - 0.5) * 0.022;
  let goal = a + ab * tp + side * (jit.x + vib) + vec3f(0.0, 0.0, jit.y + vib * 0.8 * F.depth);
  let w = min(poleWeight(i), poleWeight(j));
  *heat += w * 0.55;
  return ((goal - p) * 20.0 - v * 3.2) * w;
}

fn bChime(p: vec3f, v: vec3f, id: u32, heat: ptr<function, f32>) -> vec3f {
  // the touches ring like bells; light gathers on the still lines between the waves
  var wave = 0.0;
  var slope = vec3f(0.0);
  let k = 15.0;
  for (var i = 0u; i < F.poleCount; i++) {
    let w = poleWeight(i);
    let d = p - poleAt(i);
    let r = length(d.xy) + 1e-4;
    let ph = k * r - 3.2 * poleAge(i);
    let fall = exp(-r * 0.9);
    wave += w * sin(ph) * fall;
    slope += w * (k * cos(ph) - 0.9 * sin(ph)) * fall * vec3f(d.xy / r, 0.0); // nonzero: r >= 1e-4
  }
  var acc = -wave * slope * 0.1;
  acc.z -= p.z * 5.0 * (1.0 - 0.6 * F.depth);
  // shaken off the moving parts of the plate, like sand
  let shake = rand3(id, F.frame) - 0.5;
  acc += shake * abs(wave) * 3.5;
  *heat += abs(wave) * 0.25 + 0.15 * select(0.0, 1.0, F.poleCount > 0u);
  return acc - v * 1.2;
}

fn bStorm(p: vec3f, v: vec3f, heat: ptr<function, f32>) -> vec3f {
  var near = 0.0;
  var gust = vec3f(0.0);
  var swirl = vec3f(0.0);
  for (var i = 0u; i < F.poleCount; i++) {
    let w = poleWeight(i);
    let d = p - poleAt(i);
    let r2 = dot(d.xy, d.xy);
    let e = exp(-r2 / 0.22);
    near += w * e;
    // a flick throws the air along with it
    gust += vec3f(poleVel(i), 0.0) * w * exp(-r2 / 0.05) * 3.2;
    swirl += vec3f(-d.y, d.x, 0.0) * w * e * 1.8;
  }
  var field = abcFlow(p * 1.35, F.time * 1.6) * (0.35 + near * 2.4) + swirl;
  field.z *= F.depth;
  *heat += near * 0.6 + length(gust) * 0.15;
  return (field - v) * 1.9 + gust;
}

fn bLattice(p: vec3f, v: vec3f, s: vec4f, heat: ptr<function, f32>) -> vec3f {
  var h = latticeHome(s);
  for (var i = 0u; i < F.poleCount; i++) {
    let w = poleWeight(i);
    let q = poleAt(i);
    let dh = h.xy - q.xy;
    let r2 = dot(dh, dh) + 1e-5;
    // each touch is a lens: the lattice bulges and twists around it
    let bulge = w * 0.2 * exp(-r2 / 0.07);
    h = vec3f(h.xy + dh * inverseSqrt(r2) * bulge, h.z);
    let tw = w * 1.1 * exp(-r2 / 0.05) * poleSpin(i);
    let c = cos(tw);
    let sn = sin(tw);
    let rel = h.xy - q.xy;
    h = vec3f(q.xy + vec2f(rel.x * c - rel.y * sn, rel.x * sn + rel.y * c), h.z);
    h.z += bulge * 0.8 * F.depth;
    *heat += bulge * 5.0;
  }
  *heat += 0.1;
  return ((h - p) * 11.0 - v * 2.6) * F.engage;
}

fn bNova(p: vec3f, v: vec3f, heat: ptr<function, f32>) -> vec3f {
  var acc = vec3f(0.0);
  for (var i = 0u; i < F.poleCount; i++) {
    let w = poleWeight(i);
    let d = poleAt(i) - p;
    let r2 = dot(d, d) + 0.002;
    let r = sqrt(r2);
    let charge = min(poleAge(i), 3.0) / 3.0;
    acc += d / r * w * (1.1 + charge * 3.2) / (r + 0.09); // nonzero: r >= 0.044
    acc += vec3f(-d.y, d.x, 0.0) / r * w * 1.6 * poleSpin(i) / (r + 0.2); // nonzero: r >= 0.044
    acc -= v * w * 1.4 * exp(-r * 2.0);
    *heat += w * (0.3 + charge * 2.2) * exp(-r2 * 26.0);
  }
  return acc;
}

fn bMurmur(p: vec3f, v: vec3f, s: vec4f, id: u32, heat: ptr<function, f32>) -> vec3f {
  let n = F.poleCount;
  let m = min(u32(s.y * f32(n)), n - 1u);
  let w = poleWeight(m);
  // five flocks per touch, each following its own leader on a looping path
  let j = floor(s.x * 5.0);
  let dirn = select(-1.0, 1.0, j - 2.0 * floor(j / 2.0) < 0.5);
  let R = 0.2 + 0.1 * j;
  let om = (0.55 + 0.22 * j) * dirn;
  let ph = j * 1.7 + f32(m) * 2.3;
  let t = F.time;
  let c = poleAt(m);
  let lead = c + vec3f(cos(om * t + ph) * R * 1.25, sin(om * t * 1.3 + ph) * R * 0.85, sin(om * t * 0.7 + ph) * R * 0.7 * F.depth);
  let leadV = vec3f(-sin(om * t + ph) * R * 1.25 * om, cos(om * t * 1.3 + ph) * R * 0.85 * om * 1.3, cos(om * t * 0.7 + ph) * R * 0.7 * F.depth * om * 0.7);
  // each bird keeps its own place in the flock: a soft cloud, stretched along the
  // direction of flight
  let b = bellSeeds(id);
  var off = b * vec3f(0.045, 0.035, 0.035 * F.depth);
  let fwd = normalize(leadV + 1e-4);
  off += fwd * b.z * 0.06;
  let goal = lead + off + abcFlow(p * 3.1, t * 0.8) * 0.025;
  let desired = (goal - p) * 3.2 + leadV;
  *heat += w * 0.45;
  return (desired - v) * 2.3 * w;
}

fn bFountain(p: vec3f, v: vec3f, heat: ptr<function, f32>) -> vec3f {
  // gravity pulls the spray down; the floor bounces it
  let g = select(vec3f(0.0, -1.0, 0.0), F.gravity.xyz, length(F.gravity.xyz) > 0.05);
  // (scene gravity is added later for everyone)
  var acc = normalize(g) * 1.9 - F.gravity.xyz;
  for (var i = 0u; i < F.poleCount; i++) {
    let d = p - poleAt(i);
    let r2 = dot(d, d);
    *heat += poleWeight(i) * exp(-r2 * 30.0) * 1.5;
  }
  return acc;
}

fn behaviour(b: u32, p: vec3f, v: vec3f, s: vec4f, id: u32, heat: ptr<function, f32>) -> vec3f {
  if (F.poleCount == 0u) { return vec3f(0.0); }
  if (b == B_WELL) { return bWell(p, v, heat); }
  if (b == B_WHIRL) { return bWhirl(p, v, heat); }
  if (b == B_BURST) { return bBurst(p, v, heat); }
  if (b == B_HALO) { return bHalo(p, v, s, heat); }
  if (b == B_CURRENT) { return bCurrent(p, v, s, id, heat); }
  if (b == B_WEAVE) { return bWeave(p, v, s, heat); }
  if (b == B_CHIME) { return bChime(p, v, id, heat); }
  if (b == B_STORM) { return bStorm(p, v, heat); }
  if (b == B_LATTICE) { return bLattice(p, v, s, heat); }
  if (b == B_NOVA) { return bNova(p, v, heat); }
  if (b == B_MURMUR) { return bMurmur(p, v, s, id, heat); }
  return bFountain(p, v, heat);
}

// The particle this invocation looks after. Workgroups are laid out in rows of at most
// 65,535, so the row number counts too.
fn particleIndex(group: vec3u, groups: vec3u, local: u32) -> u32 {
  return (group.y * groups.x + group.x) * GROUP_SIZE + local;
}

// Puts particles initFirst .. initFirst + initCount - 1 in the resting shape: at the start,
// after a reset, and for the new particles when the count grows.
@compute @workgroup_size(256)
fn place(@builtin(workgroup_id) group: vec3u, @builtin(num_workgroups) groups: vec3u, @builtin(local_invocation_index) local: u32) {
  let k = particleIndex(group, groups, local);
  if (k >= F.initCount) { return; }
  let id = F.initFirst + k;
  if (id >= arrayLength(&particles)) { return; }
  let s = seeds(id);
  let form = select(F.form, F_NEBULA, F.form == F_NONE);
  particles[id] = Particle(vec4f(formTarget(form, s, F.time), 0.0), vec4f((s.wzy - 0.5) * 0.05, s.x * 3.0));
}

@compute @workgroup_size(256)
fn simulate(@builtin(workgroup_id) group: vec3u, @builtin(num_workgroups) groups: vec3u, @builtin(local_invocation_index) local: u32) {
  let id = particleIndex(group, groups, local);
  if (id >= F.count || id >= arrayLength(&particles)) { return; }
  let s = seeds(id);
  let old = particles[id];
  var p = old.pos.xyz;
  var v = old.vel.xyz;
  var heat = old.pos.w;
  var life = old.vel.w;
  let dt = F.dt;
  var gain = 0.0;

  // --- the touches ---------------------------------------------------------------------
  // Strength (and calm mode, and the music's bass) scales how hard touches push and pull;
  // the clamps further down keep even the springiest behaviours stable at 3x.
  var acc = vec3f(0.0);
  if (F.mix < 0.999) { acc += behaviour(F.behA, p, v, s, id, &gain) * (1.0 - F.mix) * F.strength; }
  if (F.mix > 0.001) { acc += behaviour(F.behB, p, v, s, id, &gain) * F.mix * F.strength; }
  let lead = select(F.behB, F.behA, F.mix < 0.5);

  // fountains respawn spent particles at a touch
  if (lead == B_FOUNTAIN && F.poleCount > 0u && s.w < 0.85) {
    life -= dt * (0.5 + s.y * 0.6);
    if (life <= 0.0) {
      let r = rand3(id, F.frame);
      let m = min(u32(r.x * f32(F.poleCount)), F.poleCount - 1u);
      let tilted = length(F.gravity.xyz) > 0.05;
      let up = select(vec3f(0.0, 1.0, 0.0), -normalize(select(vec3f(0.0, -1.0, 0.0), F.gravity.xyz, tilted)), tilted);
      let side = normalize(cross(up, vec3f(0.0, 0.0, 1.0)) + 1e-5);
      // a spray that arcs over and lands within the screen
      let b = bellSeeds(id ^ F.frame);
      let power = 0.75 + poleWeight(m) * 0.35;
      p = poleAt(m) + vec3f(b.xy * 0.012, b.z * 0.012 * F.depth);
      v = (up * (1.3 + r.z * 0.35) + side * b.x * 0.5 + vec3f(0.0, 0.0, b.y * 0.4 * F.depth)) * power;
      v += vec3f(poleVel(m), 0.0) * 0.4;
      // a random head start within the frame, so each frame's batch does not travel as a band
      p += v * dt * r.y;
      life = 1.4 + s.z * 1.2;
      heat = 0.9;
    }
  }

  // --- rings where a touch lands, and the release of a gathered nova ----------------------
  for (var k = 0u; k < 8u; k++) {
    let pu = F.pulses[k];
    if (pu.w > 1.6) { continue; }
    let d = p.xy - pu.xy;
    let r = length(d) + 1e-4;
    let R = pu.w * 1.25;
    let off = (r - R) / 0.035;
    let band = exp(-off * off) * pu.z * (1.0 - pu.w / 1.6);
    gain += band * 9.0;
    acc = vec3f(acc.xy + d / r * band * 2.5, acc.z); // nonzero: r >= 1e-4
  }
  for (var k = 0u; k < 4u; k++) {
    let re = F.releases[k];
    if (re.z <= 0.0) { continue; }
    let d = p - vec3f(re.xy, 0.0);
    let r = length(d) + 1e-3;
    let e = re.z * exp(-re.w * 5.0) * exp(-r * 1.3);
    acc += d / r * e * 55.0; // nonzero: r >= 1e-3
    gain += e * 14.0;
  }

  // --- the light's own life --------------------------------------------------------------
  // the resting shape, which lets go while someone is touching
  let formPull = (1.0 - 0.88 * F.touch) * select(1.0, 0.0, F.form == F_NONE || F.form == F_NEBULA);
  if (formPull > 0.0) {
    let home = formTarget(F.form, s, F.time);
    acc += ((home - p) * 1.6 - v * 0.6) * formPull;
  }
  // currents that keep everything moving
  var flowV = abcFlow(p, F.time * 0.35) * 0.28;
  flowV.z *= F.depth;
  acc += (flowV - v) * F.flow * (1.0 - 0.6 * F.touch) * 1.2;

  // music: the beat kicks out from the middle
  acc += normalize(p + 1e-4) * F.onset * 1.8;
  gain += F.onset * 1.2 + F.audio.x * 0.4;

  acc += F.gravity.xyz;

  // soft walls just beyond the screen, and a floor of depth
  let lim = vec3f(F.aspect * 1.12, 1.12, 0.2 + F.depth * 1.1);
  let over = max(abs(p) - lim, vec3f(0.0)) * sign(p);
  acc -= over * 40.0;
  // flatten toward the screen as depth goes to zero
  acc.z -= p.z * 9.0 * (1.0 - F.depth);

  let am = length(acc);
  if (am > 90.0) { acc *= 90.0 / am; } // nonzero: am > 90 here

  // semi-implicit Euler with frame-rate-independent drag (spray flies almost freely, so it
  // arcs instead of dropping straight down)
  v += acc * dt;
  let spray = lead == B_FOUNTAIN && s.w < 0.85;
  v *= exp(-dt * select(0.12 + F.drag * 2.6, 0.1 + F.drag * 0.25, spray));
  let sp = length(v);
  if (sp > 4.5) { v *= 4.5 / sp; } // nonzero: sp > 4.5 here
  p += v * dt;

  // fountain spray bounces off the floor
  if (lead == B_FOUNTAIN && p.y < -1.02 && v.y < 0.0) {
    v = vec3f(v.x * 0.8, -v.y * 0.32, v.z * 0.8);
    p.y = -1.02;
    gain += 0.6;
  }

  heat = heat * exp(-dt * 1.7) + gain * dt;
  heat = min(heat, 6.0);

  // anything lost to rounding or flung far away comes back into the shape (tested on the
  // bits: a NaN that survived here would spread through the glow to the whole screen)
  if (bad3(p) || bad3(v) || badf(heat) || badf(life) || dot(p, p) > 64.0) {
    p = formTarget(select(F.form, F_NEBULA, F.form == F_NONE), s, F.time);
    v = vec3f(0.0);
    heat = 0.0;
    life = s.x * 3.0;
  }
  particles[id] = Particle(vec4f(p, heat), vec4f(v, life));
}
