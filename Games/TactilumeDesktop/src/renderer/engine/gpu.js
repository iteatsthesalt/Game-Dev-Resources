// Getting a WebGPU device, and what the adapter says about itself. Also the shape of a
// compute dispatch, which has to fit the device's limits.

const TWO_GIB = 2 ** 31;
// Optional features worth having where the adapter offers them. Nothing depends on them:
// every shader runs on the core feature set, so integrated GPUs and Apple run the same code.
const WANTED_FEATURES = ['timestamp-query', 'float32-filterable', 'shader-f16'];

// The largest buffers the adapter allows, up to 2 GiB: the particle count depends on them.
export function wantedLimits(adapterLimits) {
  return {
    maxStorageBufferBindingSize: Math.min(adapterLimits.maxStorageBufferBindingSize, TWO_GIB),
    maxBufferSize: Math.min(adapterLimits.maxBufferSize, TWO_GIB),
  };
}

// → { adapter, device, adapterInfo: { vendor, architecture, description, fallback }, features }
// Throws Error('webgpu') when there is no adapter or no device: the caller falls back to
// the classic engine.
export async function requestDevice({ powerPreference = 'high-performance' } = {}) {
  const gpu = typeof navigator !== 'undefined' ? navigator.gpu : undefined;
  if (!gpu) throw new Error('webgpu');
  let adapter = null;
  try { adapter = await gpu.requestAdapter({ powerPreference }); } catch { adapter = null; }
  if (!adapter) throw new Error('webgpu');

  const requiredFeatures = WANTED_FEATURES.filter((f) => adapter.features.has(f));
  let device = null;
  try { device = await adapter.requestDevice({ requiredLimits: wantedLimits(adapter.limits), requiredFeatures }); } catch { device = null; }
  if (!device) throw new Error('webgpu');

  const info = adapter.info || {};
  // isFallbackAdapter moved from the adapter to its info; read the new place when it exists
  const fallback = 'isFallbackAdapter' in info ? info.isFallbackAdapter : adapter.isFallbackAdapter;
  return {
    adapter,
    device,
    adapterInfo: { vendor: info.vendor || '', architecture: info.architecture || '', description: info.description || '', fallback: !!fallback },
    features: [...device.features].sort(),
  };
}

// How to dispatch `count` invocations in workgroups of `size`: as one row when it fits,
// otherwise as rows of at most `maxPerRow` workgroups (a dispatch may have at most 65,535
// along each side; 20 million particles need 78,125). The workgroups are spread evenly over
// the rows, so fewer than one per row is spare: full rows of 65,535 would leave most of the
// last row idle (20 million particles would launch 131,070 workgroups for 78,125). The
// shader works out its particle from the row and column, and skips the few past `count`.
// → [x, y] workgroups, or [0, 0] for nothing to do.
export function workgroupGrid(count, size = 256, maxPerRow = 65535) {
  if (!(count > 0)) return [0, 0];
  const groups = Math.ceil(count / size);
  const widest = Math.max(1, Math.floor(maxPerRow));
  const rows = Math.ceil(groups / widest);
  return [Math.ceil(groups / rows), rows];
}

// How many particles the particle buffer should hold for `n`, given what it holds now
// (`capacity`, 0 for none yet) and the most the GPU allows (`limit`). In steps of `step`.
//   - The first buffer is just big enough.
//   - Growing during play leaves half as much again of room, up to the limit: the governor
//     steps up 10% at a time, and each growth copies the whole buffer (with the old and new
//     both alive meanwhile), so most steps up should find the room already there.
//   - A count that has fallen to half or less gives the memory back.
// → the new capacity, or `capacity` itself when the buffer should stay as it is.
export function particleCapacity(n, capacity, limit, step = 65536) {
  const need = Math.min(Math.ceil(Math.max(n, 1) / step) * step, limit);
  if (need > capacity) {
    if (capacity <= 0) return need;
    return Math.min(limit, Math.max(need, Math.ceil((capacity * 1.5) / step) * step));
  }
  if (capacity > 4 * step && need <= capacity / 2) return need;
  return capacity;
}

// The GPU had no memory for a buffer of `failed` particles while one of `capacity` was
// alive. The two are alive together while the particles are copied across, so the larger
// one alone may well fit: the next try goes halfway, and the limit falls to what is there
// only once the gap is a single step. → the new particle limit.
export function limitAfterNoMemory(capacity, failed, step = 65536) {
  const halfway = Math.floor((capacity + failed) / 2 / step) * step;
  return Math.max(capacity, step, halfway > capacity && halfway < failed ? halfway : capacity);
}
