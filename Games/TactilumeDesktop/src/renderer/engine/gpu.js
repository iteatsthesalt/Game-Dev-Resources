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
// along each side; 20 million particles need 78,125). The shader works out its particle
// from the row and column, and skips the few past `count` in the last row.
// → [x, y] workgroups, or [0, 0] for nothing to do.
export function workgroupGrid(count, size = 256, maxPerRow = 65535) {
  if (!(count > 0)) return [0, 0];
  const groups = Math.ceil(count / size);
  const perRow = Math.max(1, Math.min(groups, Math.floor(maxPerRow)));
  return [perRow, Math.ceil(groups / perRow)];
}
