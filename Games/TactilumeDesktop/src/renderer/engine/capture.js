// Reads a picture back to the CPU: for tests, photos and video. The picture may be rgba8unorm
// or bgra8unorm (what the canvas prefers on most desktops); either way the result is RGBA.

// → Promise<{ width, height, data: Uint8ClampedArray }>, rows top to bottom, RGBA.
export async function readTexture(device, texture) {
  const { width, height } = texture;
  const bgra = texture.format === 'bgra8unorm';
  // a texture-to-buffer copy needs every row to start on a 256-byte boundary
  const bytesPerRow = Math.ceil((width * 4) / 256) * 256;
  const buffer = device.createBuffer({ label: 'readback', size: bytesPerRow * height, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
  try {
    const encoder = device.createCommandEncoder({ label: 'readback' });
    encoder.copyTextureToBuffer({ texture }, { buffer, bytesPerRow }, { width, height });
    device.queue.submit([encoder.finish()]);
    await buffer.mapAsync(GPUMapMode.READ);
    const rows = new Uint8Array(buffer.getMappedRange());
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) data.set(rows.subarray(y * bytesPerRow, y * bytesPerRow + width * 4), y * width * 4);
    buffer.unmap();
    if (bgra) swapRedBlue(data);
    return { width, height, data };
  } finally {
    buffer.destroy();
  }
}

// BGRA bytes → RGBA, in place
export function swapRedBlue(data) {
  for (let i = 0; i < data.length; i += 4) {
    const b = data[i];
    data[i] = data[i + 2];
    data[i + 2] = b;
  }
  return data;
}

// Copies a buffer's first `size` bytes back to the CPU (test and debugging reads).
export async function readBuffer(device, source, size, offset = 0) {
  const buffer = device.createBuffer({ label: 'readback', size, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
  try {
    const encoder = device.createCommandEncoder({ label: 'readback' });
    encoder.copyBufferToBuffer(source, offset, buffer, 0, size);
    device.queue.submit([encoder.finish()]);
    await buffer.mapAsync(GPUMapMode.READ);
    const copy = buffer.getMappedRange().slice(0);
    buffer.unmap();
    return copy;
  } finally {
    buffer.destroy();
  }
}
