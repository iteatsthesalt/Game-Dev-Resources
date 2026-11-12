// Getting a WebGPU device, and what the adapter says about itself.
//
// First version, written by the spine. The engine part owns this file and replaces it.

const TWO_GIB = 2 ** 31;
// Optional features worth having where the adapter offers them.
const WANTED_FEATURES = ['timestamp-query', 'float32-filterable', 'shader-f16'];

// → { adapter, device, adapterInfo: { vendor, architecture, description, fallback }, features }
// Throws Error('webgpu') when there is no adapter or no device: the caller falls back to
// the classic engine.
export async function requestDevice({ powerPreference = 'high-performance' } = {}) {
  const gpu = typeof navigator !== 'undefined' ? navigator.gpu : undefined;
  if (!gpu) throw new Error('webgpu');
  let adapter = null;
  try { adapter = await gpu.requestAdapter({ powerPreference }); } catch { adapter = null; }
  if (!adapter) throw new Error('webgpu');

  // The biggest buffers the adapter allows, up to 2 GiB: the particle count depends on them.
  const requiredLimits = {
    maxStorageBufferBindingSize: Math.min(adapter.limits.maxStorageBufferBindingSize, TWO_GIB),
    maxBufferSize: Math.min(adapter.limits.maxBufferSize, TWO_GIB),
  };
  const requiredFeatures = WANTED_FEATURES.filter((f) => adapter.features.has(f));
  let device = null;
  try { device = await adapter.requestDevice({ requiredLimits, requiredFeatures }); } catch { device = null; }
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
