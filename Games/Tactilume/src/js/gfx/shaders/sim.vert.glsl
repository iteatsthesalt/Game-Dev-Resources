#version 300 es
// One step of the particle simulation. Runs once per particle with rasterisation
// off; transform feedback writes vPos/vVel into the other buffer.
precision highp float;
precision highp int;

layout(location = 0) in vec4 aPos;   // xyz position, w heat (how lit-up it is)
layout(location = 1) in vec4 aVel;   // xyz velocity, w life (fountain only)

out vec4 vPos;
out vec4 vVel;

#include common

#define MAX_POLES 32
uniform vec4 uPole[MAX_POLES];    // x, y, weight (power with fade), age
uniform vec4 uPoleV[MAX_POLES];   // vx, vy, raw power, spin sign
uniform int uPoleCount;
uniform vec4 uPulse[8];           // x, y, power, age   (age >= 9 means unused)
uniform vec4 uRelease[4];         // x, y, charge, age  (charge 0 means unused)
uniform int uBehA;
uniform int uBehB;
uniform float uMix;               // 0 = all A, 1 = all B
uniform float uDt;
uniform float uTime;
uniform uint uFrame;
uniform float uStrength;
uniform float uDrag;
uniform float uFlow;
uniform float uDepth;
uniform float uTouch;             // 0..1, how much anyone is touching right now
uniform float uEngage;            // like uTouch but lets go slowly
uniform int uForm;
uniform vec3 uGravity;            // acceleration, already scaled
uniform float uAspect;
uniform vec4 uAudio;              // level, bass, mid, high
uniform float uOnset;
uniform int uInit;                // 1: place every particle in the resting shape

// Behaviour ids, as in core/behaviours.js
#define B_WELL 0
#define B_WHIRL 1
#define B_BURST 2
#define B_HALO 3
#define B_CURRENT 4
#define B_WEAVE 5
#define B_CHIME 6
#define B_STORM 7
#define B_LATTICE 8
#define B_NOVA 9
#define B_MURMUR 10
#define B_FOUNTAIN 11

// Forms, as in core/scene.js FORMS
#define F_NEBULA 0
#define F_DISC 1
#define F_SHELL 2
#define F_RING 3
#define F_LATTICE 4
#define F_NONE 5

vec3 poleAt(int i) { return vec3(uPole[i].xy, 0.0); }

// A point on the lattice: glowing grid lines. Each particle sits on one line.
vec3 latticeHome(vec4 s) {
  float sp = 0.25;
  float ax = uAspect * 1.05;
  float dz = 0.15 + uDepth * 0.75;
  int fam = int(s.w * (uDepth > 0.15 ? 3.0 : 2.0));
  float nx = floor(ax / sp), ny = floor(1.05 / sp), nz = max(1.0, floor(dz / sp));
  float gx = (floor(s.y * (2.0 * nx + 1.0)) - nx) * sp;
  float gy = (floor(s.z * (2.0 * ny + 1.0)) - ny) * sp;
  float gz = (floor(s.z * (2.0 * nz + 1.0)) - nz) * sp;
  float gz2 = (floor(s.y * (2.0 * nz + 1.0)) - nz) * sp;
  float u = s.x * 2.0 - 1.0;
  if (fam == 0) return vec3(u * ax, gy, gz2 * uDepth);
  if (fam == 1) return vec3(gx, u * 1.05, gz * uDepth);
  return vec3(gx, gy, u * dz);
}

// Where a particle rests in each shape. The shapes turn slowly, so the targets move.
vec3 formTarget(int form, vec4 s, float t) {
  float R = min(uAspect, 1.0) * 0.86;
  if (form == F_DISC) {
    float r = 0.06 + 0.94 * sqrt(s.x);
    float a = s.y * TAU + t * 0.32 / (0.22 + r);
    // two soft spiral arms
    r *= 1.0 + 0.07 * sin(2.0 * a - 7.0 * r);
    float z = (s.z - 0.5) * 0.16 * uDepth * (1.0 - 0.7 * r);
    // a little wider than tall on wide screens, so the disc fills them
    return vec3(cos(a) * r * R * clamp(uAspect, 1.0, 1.35), sin(a) * r * R, z);
  }
  if (form == F_SHELL) {
    float z = s.x * 2.0 - 1.0;
    float a = s.y * TAU + t * 0.12;
    float rr = sqrt(1.0 - z * z);
    vec3 p = vec3(cos(a) * rr, z, sin(a) * rr) * R * 0.92;
    p.z *= uDepth;
    return p + (s.zwx - 0.5) * 0.02;
  }
  if (form == F_RING) {
    float a = s.x * TAU + t * 0.18;
    float b = s.y * TAU;
    float minor = 0.05 + 0.04 * s.z;
    vec3 p = vec3(cos(a) * (R + minor * cos(b)), sin(a) * (R + minor * cos(b)), minor * sin(b));
    float tilt = uDepth * 1.05;
    float c = cos(tilt), sn = sin(tilt);
    p = vec3(p.x, p.y * c - p.z * sn, p.y * sn + p.z * c);
    return p;
  }
  if (form == F_LATTICE) return latticeHome(s);
  // nebula and none: a soft cloud
  float r1 = sqrt(-2.0 * log(max(s.x, 1e-6)));
  vec3 g = vec3(r1 * cos(TAU * s.y), r1 * sin(TAU * s.y), (s.z - 0.5) * 2.4);
  return g * vec3(uAspect * 0.34, 0.34, 0.32 * uDepth);
}

// ---------------------------------------------------------------------------------
// The behaviours. Each returns an acceleration and adds to `heat` (how bright it gets).

vec3 bWell(vec3 p, vec3 v, inout float heat) {
  vec3 acc = vec3(0.0);
  for (int i = 0; i < uPoleCount; i++) {
    float w = uPole[i].z;
    vec3 d = poleAt(i) - p;
    float r2 = dot(d, d) + 0.0025;
    float r = sqrt(r2);
    acc += d / r * min(w * 0.6 / r2, 45.0);
    // a sideways pull, so the light settles into discs instead of falling straight through
    acc += vec3(-d.y, d.x, 0.0) / r * w * 0.85 * uPoleV[i].w / (r + 0.14);
    // a soft core keeps the centre from collapsing to a single point
    acc -= d / r * w * 26.0 * exp(-r2 * 700.0);
    heat += w * 0.9 * exp(-r2 * 34.0);
  }
  return acc;
}

vec3 bWhirl(vec3 p, vec3 v, inout float heat) {
  vec3 field = vec3(0.0);
  float wsum = 0.0;
  for (int i = 0; i < uPoleCount; i++) {
    float w = uPole[i].z;
    vec3 d = poleAt(i) - p;
    float r2 = dot(d.xy, d.xy) + 0.004;
    float r = sqrt(r2);
    // a solid core that turns into a 1/r swirl outside: neighbouring touches turn opposite ways
    float sign = (i % 2 == 0) ? 1.0 : -1.0;
    vec3 t = vec3(-d.y, d.x, 0.0) / r * (w * 1.7 * r / (r2 + 0.045)) * sign;
    t += d * w * 0.4 / (r + 0.35);
    t.z += sin(r * 13.0 - uTime * 2.2 + float(i)) * 0.22 * w * uDepth;
    float f = exp(-r * 1.1);
    field += t * f;
    wsum += f * w;
    heat += w * 0.9 * exp(-r2 * 10.0);
  }
  return (field - v * min(wsum, 1.0)) * 2.6;
}

vec3 bBurst(vec3 p, vec3 v, inout float heat) {
  vec3 acc = vec3(0.0);
  for (int i = 0; i < uPoleCount; i++) {
    float w = uPole[i].z;
    vec3 d = p - poleAt(i);
    float r2 = dot(d, d) + 0.003;
    float r = sqrt(r2);
    vec3 n = d / r;
    // a short-range push keeps a clear space around the touch
    acc += n * w * 0.3 / (r2 + 0.04) * exp(-r * 1.5);
    // rings go out every 0.9 s while held, the first one at touch-down
    float ph = mod(uPole[i].w, 0.9);
    float R = ph * 1.5;
    float band = exp(-pow((length(d.xy) - R) / 0.04, 2.0)) * (1.0 - ph / 0.9);
    acc += n * band * w * 14.0;
    heat += band * w * 3.0;
    // and the light drifts back in between rings
    acc -= n * w * 0.35 * smoothstep(0.25, 1.2, r);
  }
  return acc;
}

vec3 bHalo(vec3 p, vec3 v, vec4 s, inout float heat) {
  // Each particle belongs to one touch's halo. (Pulling toward every ring at once
  // would trap the light at the balance point between two touches.)
  int i = min(int(s.y * float(uPoleCount)), uPoleCount - 1);
  float w = uPole[i].z;
  vec3 d = p - poleAt(i);
  float r = length(d) + 1e-4;
  vec3 n = d / r;
  // rings within the ring: each particle keeps to its own shell
  float R0 = (0.15 + 0.06 * uPoleV[i].z) * (0.8 + 0.4 * s.z) + 0.025 * sin(uPole[i].w * 2.3 + float(i));
  vec3 acc = -n * (r - R0) * 14.0 * w;
  acc += vec3(-n.y, n.x, 0.0) * (0.9 + 0.8 * s.x) * w * uPoleV[i].w;
  acc -= v * 1.5 * w;
  heat += w * (0.25 + exp(-abs(r - R0) * 24.0) * 1.1);
  return acc;
}

// closest point on segment a-b to p, and the segment direction
vec3 closestOnSegment(vec3 p, vec3 a, vec3 b, out vec3 dir, out float t) {
  vec3 ab = b - a;
  float L2 = max(dot(ab, ab), 1e-6);
  t = clamp(dot(p - a, ab) / L2, 0.0, 1.0);
  dir = ab * inversesqrt(L2);
  return a + ab * t;
}

vec3 bCurrent(vec3 p, vec3 v, vec4 s, inout float heat) {
  int n = uPoleCount;
  if (s.w > 0.8) return vec3(0.0);   // some light stays loose, as atmosphere
  // each particle swims in its own lane, so the river has width and grain
  vec3 lane3 = bellSeeds(uint(gl_VertexID)) * 0.045;
  if (n == 1) {
    // one touch: a circular river around it
    float w = uPole[0].z;
    vec3 d = p - poleAt(0);
    float r = length(d.xy) + 1e-3;
    vec3 tang = vec3(-d.y, d.x, 0.0) / r;
    vec3 target = tang * 1.3 - d / r * (r - 0.32) * 3.0;
    target.z = -p.z * 1.5;
    float f = w * exp(-abs(r - 0.32) * 3.0);
    heat += f * 0.8;
    return (target - v) * 2.4 * f;
  }
  vec3 field = vec3(0.0);
  float wsum = 0.0;
  vec3 pull = vec3(0.0);
  for (int i = 0; i < n; i++) {
    int j = (i + 1) % n;
    vec3 a = poleAt(i), b = poleAt(j);
    // with two touches the river runs out on one side and back on the other
    if (n == 2) {
      vec3 ab = b - a;
      vec3 side = normalize(vec3(-ab.y, ab.x, 0.0) + 1e-5) * 0.08;
      a += side; b += side;
    }
    vec3 dir; float t;
    vec3 c = closestOnSegment(p, a, b, dir, t);
    vec3 side = vec3(-dir.y, dir.x, 0.0);
    c += side * lane3.x + vec3(0.0, 0.0, lane3.y * uDepth);
    vec3 dd = p - c;
    float dist2 = dot(dd, dd);
    float w = min(uPole[i].z, uPole[j].z);
    float f = exp(-dist2 / 0.03) * w;
    // faster in the middle of the stream than at its banks
    field += dir * (1.1 + 0.7 * exp(-lane3.x * lane3.x * 600.0)) * f;
    wsum += f;
    pull += -dd / (sqrt(dist2) + 0.05) * 0.7 * exp(-dist2 / 0.2) * w;
    heat += f * 0.8;
  }
  return (field - v * min(wsum, 1.0)) * 2.6 + pull;
}

vec3 bWeave(vec3 p, vec3 v, vec4 s, inout float heat) {
  int n = uPoleCount;
  if (s.w > 0.72) return vec3(0.0);   // some light stays loose, as atmosphere
  if (n == 1) {
    float w = uPole[0].z;
    float a = s.x * TAU + uTime * 0.6;
    vec3 target = poleAt(0) + vec3(cos(a), sin(a), sin(a * 2.0 + s.y * TAU) * 0.3 * uDepth) * (0.22 + 0.02 * sin(a * 5.0 + uTime * 3.0));
    heat += w * 0.4;
    return ((target - p) * 16.0 - v * 3.0) * w;
  }
  // threads: each touch to the next, and (from 4 touches) to the one after that too
  int segs = n == 2 ? 1 : (n == 3 ? 3 : 2 * n);
  int k = min(int(s.x * float(segs)), segs - 1);
  int i = k < n ? k : k - n;
  int j = k < n ? (i + 1) % n : (i + 2) % n;
  vec3 a = poleAt(i), b = poleAt(j);
  vec3 ab = b - a;
  float L = length(ab) + 1e-4;
  vec3 side = vec3(-ab.y, ab.x, 0.0) / L;
  float tp = fract(s.y + uTime * 0.04 * (s.z - 0.5));
  // the thread vibrates like a plucked string, in its own harmonic
  float harmonic = float(1 + k % 3);
  float vib = sin(3.14159 * tp * harmonic) * sin(uTime * (3.0 + harmonic * 1.7) + float(k)) * 0.05 * min(L, 1.0);
  vec2 jit = (s.zw - 0.5) * 0.022;
  vec3 target = a + ab * tp + side * (jit.x + vib) + vec3(0.0, 0.0, jit.y + vib * 0.8 * uDepth);
  float w = min(uPole[i].z, uPole[j].z);
  heat += w * 0.55;
  return ((target - p) * 20.0 - v * 3.2) * w;
}

vec3 bChime(vec3 p, vec3 v, uint id, inout float heat) {
  // the touches ring like bells; light gathers on the still lines between the waves
  float F = 0.0;
  vec3 G = vec3(0.0);
  float k = 15.0;
  for (int i = 0; i < uPoleCount; i++) {
    float w = uPole[i].z;
    vec3 d = p - poleAt(i);
    float r = length(d.xy) + 1e-4;
    float ph = k * r - 3.2 * uPole[i].w;
    float fall = exp(-r * 0.9);
    F += w * sin(ph) * fall;
    G += w * (k * cos(ph) - 0.9 * sin(ph)) * fall * vec3(d.xy / r, 0.0);
  }
  vec3 acc = -F * G * 0.1;
  acc.z -= p.z * 5.0 * (1.0 - 0.6 * uDepth);
  // shaken off the moving parts of the plate, like sand
  vec3 shake = rand3(id, uFrame) - 0.5;
  acc += shake * abs(F) * 3.5;
  heat += abs(F) * 0.25 + 0.15 * float(uPoleCount > 0);
  return acc - v * 1.2;
}

vec3 bStorm(vec3 p, vec3 v, inout float heat) {
  float near = 0.0;
  vec3 gust = vec3(0.0);
  vec3 swirl = vec3(0.0);
  for (int i = 0; i < uPoleCount; i++) {
    float w = uPole[i].z;
    vec3 d = p - poleAt(i);
    float r2 = dot(d.xy, d.xy);
    float e = exp(-r2 / 0.22);
    near += w * e;
    // a flick throws the air along with it
    gust += vec3(uPoleV[i].xy, 0.0) * w * exp(-r2 / 0.05) * 3.2;
    swirl += vec3(-d.y, d.x, 0.0) * w * e * 1.8;
  }
  vec3 field = abcFlow(p * 1.35, uTime * 1.6) * (0.35 + near * 2.4) + swirl;
  field.z *= uDepth;
  heat += near * 0.6 + length(gust) * 0.15;
  return (field - v) * 1.9 + gust;
}

vec3 bLattice(vec3 p, vec3 v, vec4 s, inout float heat) {
  vec3 h = latticeHome(s);
  for (int i = 0; i < uPoleCount; i++) {
    float w = uPole[i].z;
    vec3 q = poleAt(i);
    vec2 dh = h.xy - q.xy;
    float r2 = dot(dh, dh) + 1e-5;
    // each touch is a lens: the lattice bulges and twists around it
    float bulge = w * 0.2 * exp(-r2 / 0.07);
    h.xy += dh * inversesqrt(r2) * bulge;
    float tw = w * 1.1 * exp(-r2 / 0.05) * uPoleV[i].w;
    float c = cos(tw), sn = sin(tw);
    vec2 rel = h.xy - q.xy;
    h.xy = q.xy + vec2(rel.x * c - rel.y * sn, rel.x * sn + rel.y * c);
    h.z += bulge * 0.8 * uDepth;
    heat += bulge * 5.0;
  }
  heat += 0.1;
  return ((h - p) * 11.0 - v * 2.6) * uEngage;
}

vec3 bNova(vec3 p, vec3 v, inout float heat) {
  vec3 acc = vec3(0.0);
  for (int i = 0; i < uPoleCount; i++) {
    float w = uPole[i].z;
    vec3 d = poleAt(i) - p;
    float r2 = dot(d, d) + 0.002;
    float r = sqrt(r2);
    float charge = min(uPole[i].w, 3.0) / 3.0;
    acc += d / r * w * (1.1 + charge * 3.2) / (r + 0.09);
    acc += vec3(-d.y, d.x, 0.0) / r * w * 1.6 * uPoleV[i].w / (r + 0.2);
    acc -= v * w * 1.4 * exp(-r * 2.0);
    heat += w * (0.3 + charge * 2.2) * exp(-r2 * 26.0);
  }
  return acc;
}

vec3 bMurmur(vec3 p, vec3 v, vec4 s, inout float heat) {
  int n = uPoleCount;
  int m = min(int(s.y * float(n)), n - 1);
  float w = uPole[m].z;
  // five flocks per touch, each following its own leader on a looping path
  float j = floor(s.x * 5.0);
  float dirn = mod(j, 2.0) < 0.5 ? 1.0 : -1.0;
  float R = 0.2 + 0.1 * j;
  float om = (0.55 + 0.22 * j) * dirn;
  float ph = j * 1.7 + float(m) * 2.3;
  float t = uTime;
  vec3 c = poleAt(m);
  vec3 lead = c + vec3(cos(om * t + ph) * R * 1.25, sin(om * t * 1.3 + ph) * R * 0.85, sin(om * t * 0.7 + ph) * R * 0.7 * uDepth);
  vec3 leadV = vec3(-sin(om * t + ph) * R * 1.25 * om, cos(om * t * 1.3 + ph) * R * 0.85 * om * 1.3, cos(om * t * 0.7 + ph) * R * 0.7 * uDepth * om * 0.7);
  // each bird keeps its own place in the flock: a soft cloud, stretched along the
  // direction of flight
  vec3 b = bellSeeds(uint(gl_VertexID));
  vec3 off = b * vec3(0.045, 0.035, 0.035 * uDepth);
  vec3 fwd = normalize(leadV + 1e-4);
  off += fwd * b.z * 0.06;
  vec3 target = lead + off + abcFlow(p * 3.1, t * 0.8) * 0.025;
  vec3 desired = (target - p) * 3.2 + leadV;
  heat += w * 0.45;
  return (desired - v) * 2.3 * w;
}

vec3 bFountain(vec3 p, vec3 v, inout float heat) {
  vec3 acc = vec3(0.0);
  // gravity pulls the spray down; the floor bounces it
  vec3 g = length(uGravity) > 0.05 ? uGravity : vec3(0.0, -1.0, 0.0);
  acc += normalize(g) * 1.9 - uGravity;   // (scene gravity is added later for everyone)
  for (int i = 0; i < uPoleCount; i++) {
    vec3 d = p - poleAt(i);
    float r2 = dot(d, d);
    heat += uPole[i].z * exp(-r2 * 30.0) * 1.5;
  }
  return acc;
}

vec3 behaviour(int b, vec3 p, vec3 v, vec4 s, uint id, inout float heat) {
  if (uPoleCount == 0) return vec3(0.0);
  if (b == B_WELL) return bWell(p, v, heat);
  if (b == B_WHIRL) return bWhirl(p, v, heat);
  if (b == B_BURST) return bBurst(p, v, heat);
  if (b == B_HALO) return bHalo(p, v, s, heat);
  if (b == B_CURRENT) return bCurrent(p, v, s, heat);
  if (b == B_WEAVE) return bWeave(p, v, s, heat);
  if (b == B_CHIME) return bChime(p, v, id, heat);
  if (b == B_STORM) return bStorm(p, v, heat);
  if (b == B_LATTICE) return bLattice(p, v, s, heat);
  if (b == B_NOVA) return bNova(p, v, heat);
  if (b == B_MURMUR) return bMurmur(p, v, s, heat);
  return bFountain(p, v, heat);
}

void main() {
  uint id = uint(gl_VertexID);
  vec4 s = seeds(id);
  vec3 p = aPos.xyz;
  vec3 v = aVel.xyz;
  float heat = aPos.w;
  float life = aVel.w;

  if (uInit == 1) {
    vPos = vec4(formTarget(uForm == F_NONE ? F_NEBULA : uForm, s, uTime), 0.0);
    vVel = vec4((s.wzy - 0.5) * 0.05, s.x * 3.0);
    return;
  }

  float dt = uDt;
  float gain = 0.0;

  // --- the touches -------------------------------------------------------------
  // Strength (and calm mode, and the music's bass) scales how hard touches push and pull;
  // the clamps further down keep even the springiest behaviours stable at 3x.
  vec3 acc = vec3(0.0);
  if (uMix < 0.999) acc += behaviour(uBehA, p, v, s, id, gain) * (1.0 - uMix) * uStrength;
  if (uMix > 0.001) acc += behaviour(uBehB, p, v, s, id, gain) * uMix * uStrength;
  int lead = uMix < 0.5 ? uBehA : uBehB;

  // fountains respawn spent particles at a touch
  if (lead == B_FOUNTAIN && uPoleCount > 0 && s.w < 0.85) {
    life -= dt * (0.5 + s.y * 0.6);
    if (life <= 0.0) {
      vec3 r = rand3(id, uFrame);
      int m = min(int(r.x * float(uPoleCount)), uPoleCount - 1);
      vec3 up = length(uGravity) > 0.05 ? -normalize(uGravity) : vec3(0.0, 1.0, 0.0);
      vec3 side = normalize(cross(up, vec3(0.0, 0.0, 1.0)) + 1e-5);
      // a spray that arcs over and lands within the screen
      vec3 b = bellSeeds(id ^ uFrame);
      float power = 0.75 + uPole[m].z * 0.35;
      p = poleAt(m) + vec3(b.xy * 0.012, b.z * 0.012 * uDepth);
      v = (up * (1.3 + r.z * 0.35) + side * b.x * 0.5 + vec3(0.0, 0.0, b.y * 0.4 * uDepth)) * power;
      v += vec3(uPoleV[m].xy, 0.0) * 0.4;
      // a random head start within the frame, so each frame's batch does not travel as a band
      p += v * dt * r.y;
      life = 1.4 + s.z * 1.2;
      heat = 0.9;
    }
  }

  // --- rings where a touch lands, and the release of a gathered nova --------------
  for (int k = 0; k < 8; k++) {
    vec4 pu = uPulse[k];
    if (pu.w > 1.6) continue;
    vec2 d = p.xy - pu.xy;
    float r = length(d) + 1e-4;
    float R = pu.w * 1.25;
    float band = exp(-pow((r - R) / 0.035, 2.0)) * pu.z * (1.0 - pu.w / 1.6);
    gain += band * 9.0;
    acc.xy += d / r * band * 2.5;
  }
  for (int k = 0; k < 4; k++) {
    vec4 re = uRelease[k];
    if (re.z <= 0.0) continue;
    vec3 d = p - vec3(re.xy, 0.0);
    float r = length(d) + 1e-3;
    float e = re.z * exp(-re.w * 5.0) * exp(-r * 1.3);
    acc += d / r * e * 55.0;
    gain += e * 14.0;
  }

  // --- the light's own life --------------------------------------------------------
  // the resting shape, which lets go while someone is touching
  float formPull = (1.0 - 0.88 * uTouch) * (uForm == F_NONE || uForm == F_NEBULA ? 0.0 : 1.0);
  if (formPull > 0.0) {
    vec3 home = formTarget(uForm, s, uTime);
    acc += ((home - p) * 1.6 - v * 0.6) * formPull;
  }
  // currents that keep everything moving
  vec3 flowV = abcFlow(p, uTime * 0.35) * 0.28;
  flowV.z *= uDepth;
  acc += (flowV - v) * uFlow * (1.0 - 0.6 * uTouch) * 1.2;

  // music: the beat kicks out from the middle
  acc += normalize(p + 1e-4) * uOnset * 1.8;
  gain += uOnset * 1.2 + uAudio.x * 0.4;

  acc += uGravity;

  // soft walls just beyond the screen, and a floor of depth
  vec3 lim = vec3(uAspect * 1.12, 1.12, 0.2 + uDepth * 1.1);
  vec3 over = max(abs(p) - lim, 0.0) * sign(p);
  acc -= over * 40.0;
  // flatten toward the screen as depth goes to zero
  acc.z -= p.z * 9.0 * (1.0 - uDepth);

  float am = length(acc);
  if (am > 90.0) acc *= 90.0 / am;

  // semi-implicit Euler with frame-rate-independent drag (spray flies almost freely,
  // so it arcs instead of dropping straight down)
  v += acc * dt;
  bool spray = lead == B_FOUNTAIN && s.w < 0.85;
  v *= exp(-dt * (spray ? 0.1 + uDrag * 0.25 : 0.12 + uDrag * 2.6));
  float sp = length(v);
  if (sp > 4.5) v *= 4.5 / sp;
  p += v * dt;

  // fountain spray bounces off the floor
  if (lead == B_FOUNTAIN && p.y < -1.02 && v.y < 0.0) { v.y = -v.y * 0.32; v.xz *= 0.8; p.y = -1.02; gain += 0.6; }

  heat = heat * exp(-dt * 1.7) + gain * dt;
  heat = min(heat, 6.0);

  // anything lost to rounding or flung far away comes back into the shape
  if (any(isnan(p)) || any(isinf(p)) || any(isnan(v)) || dot(p, p) > 64.0) {
    p = formTarget(uForm == F_NONE ? F_NEBULA : uForm, s, uTime);
    v = vec3(0.0);
    heat = 0.0;
  }
  vPos = vec4(p, heat);
  vVel = vec4(v, life);
}
