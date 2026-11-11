// ---- shared by the simulation and the point renderer --------------------------

const float TAU = 6.28318530718;

// PCG3D (Jarzynski & Olano 2020): good, fast integer hashing on any GPU.
uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}

// Four fixed random numbers in 0..1 for particle `i`, the same every frame.
vec4 seeds(uint i) {
  uvec3 a = pcg3d(uvec3(i, 0x9e3779b9u, 0x85ebca6bu));
  uvec3 b = pcg3d(uvec3(a.x ^ i, 0xc2b2ae35u, 0x27d4eb2fu));
  return vec4(vec3(a), float(b.x)) * (1.0 / 4294967295.0);
}

// Three more fixed numbers per particle, roughly bell-shaped around 0 (-1.5..1.5),
// independent of seeds(): for offsets that should look organic, not gridded.
vec3 bellSeeds(uint i) {
  uvec3 a = pcg3d(uvec3(i, 0x165667b1u, 0xd3a2646cu));
  uvec3 b = pcg3d(a ^ uvec3(0xfd7046c5u, 0xb55a4f09u, i));
  vec3 u = vec3(a) * (1.0 / 4294967295.0);
  vec3 v = vec3(b) * (1.0 / 4294967295.0);
  vec3 w = vec3(pcg3d(b + i)) * (1.0 / 4294967295.0);
  return u + v + w - 1.5;
}

// Three random numbers in 0..1 that change with `salt` (for example the frame number).
vec3 rand3(uint i, uint salt) {
  return vec3(pcg3d(uvec3(i, salt, i ^ (salt * 747796405u)))) * (1.0 / 4294967295.0);
}

// Arnold-Beltrami-Childress flow in two octaves: divergence-free (so the light
// never bunches up or thins out on its own), smooth and endlessly varied.
// The second octave is evaluated in rotated coordinates and rotated back, which
// keeps it divergence-free because the rotation is orthonormal.
const mat3 ROT = mat3(0.8, 0.6, 0.0, -0.48, 0.64, 0.6, 0.36, -0.48, 0.8);
vec3 abcFlow(vec3 p, float t) {
  vec3 q = p * 2.1 + vec3(0.31 * t, -0.23 * t, 0.17 * t);
  vec3 u = vec3(sin(q.z) + cos(q.y), sin(q.x) + cos(q.z), sin(q.y) + cos(q.x));
  vec3 r = ROT * p * 4.3 + vec3(-0.13 * t, 0.29 * t, 0.11 * t);
  vec3 w = vec3(sin(r.z) + cos(r.y), sin(r.x) + cos(r.z), sin(r.y) + cos(r.x));
  return u * 0.62 + (transpose(ROT) * w) * 0.3;
}
