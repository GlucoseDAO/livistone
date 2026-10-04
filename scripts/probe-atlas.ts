/** WebGPU readbacks pad each row to 256 bytes; atlas files contain only the RGBA half-float pixels. */
export function packProbeAtlas(data: Uint16Array, width: number, height: number): Uint16Array {
  const row = width * 4, packed = new Uint16Array(row * height);
  if (data.length === packed.length) { packed.set(data); return packed; }
  const stride = Math.ceil(row * 2 / 256) * 128;
  if (data.length !== stride * (height - 1) + row) throw new Error('Unexpected reflection readback layout');
  for (let y = 0; y < height; y++) packed.set(data.subarray(y * stride, y * stride + row), y * row);
  return packed;
}
