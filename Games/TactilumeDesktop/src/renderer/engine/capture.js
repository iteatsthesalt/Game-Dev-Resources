// Reads an rgba8unorm texture back to the CPU: the picture for tests, photos and video.
//
// First version, written by the spine. The engine part owns this file and replaces it.

// → Promise<{ width, height, data: Uint8ClampedArray }>, rows top to bottom, RGBA.
export async function readTexture(device, texture) {
  const { width, height } = texture;
  // a texture-to-buffer copy needs every row to start on a 256-byte boundary
  const bytesPerRow = Math.ceil((width * 4) / 256) * 256;
  const buffer = device.createBuffer({ size: bytesPerRow * height, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
  try {
    const encoder = device.createCommandEncoder();
    encoder.copyTextureToBuffer({ texture }, { buffer, bytesPerRow }, { width, height });
    device.queue.submit([encoder.finish()]);
    await buffer.mapAsync(GPUMapMode.READ);
    const rows = new Uint8Array(buffer.getMappedRange());
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) data.set(rows.subarray(y * bytesPerRow, y * bytesPerRow + width * 4), y * width * 4);
    buffer.unmap();
    return { width, height, data };
  } finally {
    buffer.destroy();
  }
}
