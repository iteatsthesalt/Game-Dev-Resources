// Where each field of a uniform struct sits in its buffer, by WGSL's layout rules, so the
// JavaScript that fills a buffer writes each value where the shader reads it. A mistake here
// is silent on the GPU (a field simply reads the wrong number), so the lists below are
// checked against the structs in the .wgsl files by tests/unit/engine-layout.test.js.
//
// A field is [name, type] or, for an array, [name, type, length]. Types are WGSL's own names.

const BASIC = {
  f32: { align: 4, size: 4 },
  u32: { align: 4, size: 4 },
  i32: { align: 4, size: 4 },
  vec2f: { align: 8, size: 8 },
  vec3f: { align: 16, size: 12 },
  vec4f: { align: 16, size: 16 },
  vec4u: { align: 16, size: 16 },
  mat4x4f: { align: 16, size: 64 },
};

const roundUp = (n, k) => Math.ceil(n / k) * k;

// → { size, align, fields: { name: { offset, type, length } } }, in bytes. Structs named in
// `structs` (already laid out) may be used as field types. In the uniform address space an
// array's elements, and a struct used as a field, start on 16-byte boundaries.
export function layoutOf(fields, structs = {}) {
  let offset = 0;
  let align = 1;
  const out = {};
  for (const [name, type, length] of fields) {
    const t = BASIC[type] || structs[type];
    if (!t) throw new Error(`layoutOf: unknown type ${type} for ${name}`);
    const nested = !BASIC[type];
    const a = length || nested ? roundUp(t.align, 16) : t.align;
    const stride = length ? roundUp(t.size, 16) : t.size;
    offset = roundUp(offset, a);
    out[name] = { offset, type, length: length || 0, stride };
    offset += length ? stride * length : nested ? roundUp(t.size, 16) : t.size;
    align = Math.max(align, a);
  }
  return { size: roundUp(offset, align), align, fields: out };
}

// The uniform structs, in the order of their WGSL declarations.
export const POLE_FIELDS = [['place', 'vec4f'], ['motion', 'vec4f'], ['team', 'vec4f']];
export const POLE = layoutOf(POLE_FIELDS);

export const FRAME_FIELDS = [
  ['viewProj', 'mat4x4f'],
  ['gravity', 'vec4f'],
  ['audio', 'vec4f'],
  ['invRes', 'vec2f'],
  ['teamScale', 'vec2f'],
  ...['dt', 'time', 'strength', 'drag', 'flow', 'depth', 'touch', 'engage', 'aspect', 'onset', 'mix',
    'camDist', 'pointPx', 'dofPx', 'maxPx', 'energy', 'energyCap', 'sparkle', 'high', 'palA', 'palB',
    'palMix', 'hue', 'depthRange', 'teamMix'].map((name) => [name, 'f32']),
  ...['behA', 'behB', 'poleCount', 'form', 'colorBy', 'frame', 'count', 'initFirst', 'initCount'].map((name) => [name, 'u32']),
  ['pulses', 'vec4f', 8],
  ['pulseColors', 'vec4f', 8],
  ['releases', 'vec4f', 4],
  ['poles', 'Pole', 64],
];
export const FRAME = layoutOf(FRAME_FIELDS, { Pole: POLE });

export const LEVEL_FIELDS = [['texel', 'vec2f'], ['radius', 'f32'], ['weight', 'f32'], ['first', 'u32']];
export const LEVEL = layoutOf(LEVEL_FIELDS);

export const EXPOSURE_FIELDS = ['dt', 'base', 'amount', 'guard', 'rise', 'glowGain'].map((name) => [name, 'f32']);
export const EXPOSURE = layoutOf(EXPOSURE_FIELDS);

export const LOOK_FIELDS = [['res', 'vec2f'], ...['glow', 'vignette', 'grain', 'aberration', 'saturation', 'time', 'hdrPeak'].map((name) => [name, 'f32'])];
export const LOOK = layoutOf(LOOK_FIELDS);

// Which .wgsl file declares each struct, for the layout test.
export const STRUCTS = {
  Pole: { file: 'common.wgsl', fields: POLE_FIELDS },
  Frame: { file: 'common.wgsl', fields: FRAME_FIELDS },
  Level: { file: 'bloom.wgsl', fields: LEVEL_FIELDS },
  Exposure: { file: 'adapt.wgsl', fields: EXPOSURE_FIELDS },
  Look: { file: 'composite.wgsl', fields: LOOK_FIELDS },
};

// A CPU copy of one uniform buffer. set(name, value) writes a number, or an array of numbers
// from the field's start; u32 fields are written as integers. `bytes` is what to upload.
// The buffer is a multiple of 16 bytes, which every uniform binding accepts.
export function createUniforms(layout) {
  const bytes = new ArrayBuffer(roundUp(layout.size, 16));
  const f32 = new Float32Array(bytes);
  const u32 = new Uint32Array(bytes);
  return {
    bytes,
    f32,
    u32,
    // the index of a field in f32 / u32
    at(name) {
      const f = layout.fields[name];
      if (!f) throw new Error(`no uniform field ${name}`);
      return f.offset / 4;
    },
    set(name, value) {
      const f = layout.fields[name];
      if (!f) throw new Error(`no uniform field ${name}`);
      const view = f.type === 'u32' || f.type === 'vec4u' ? u32 : f32;
      const i = f.offset / 4;
      if (typeof value === 'number') view[i] = f.type === 'u32' ? Math.max(0, Math.floor(value)) >>> 0 : value;
      else view.set(value, i);
    },
  };
}
