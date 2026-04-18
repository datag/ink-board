// Lightweight 4-bit BMP writer for ink-board
// Exports imageDataToBmp(imageData) -> Buffer

export function imageDataToBmp(imageData) {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data; // Uint8ClampedArray RGBA

  // Fixed palette: index 0 = black, 1 = white, 2 = red. Fill remaining entries with zeros.
  const palette = [
    { r: 0x00, g: 0x00, b: 0x00 }, // black
    { r: 0xff, g: 0xff, b: 0xff }, // white
    { r: 0xff, g: 0x00, b: 0x00 }, // red
  ];

  // Helper: map RGBA to palette index using established rules
  function mapPixel(r, g, b, a) {
    // Respect alpha: fully transparent -> white
    if (a === 0) return 1;
    // Red rule: R>180 && G<80 && B<80 -> red
    if (r > 180 && g < 80 && b < 80) return 2;
    // Luminance < 128 -> black
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum < 128) return 0;
    return 1; // white
  }

  // Row bytes for 4-bit: two pixels per byte
  const rowBytesNoPad = Math.ceil(width / 2);
  const pad = (4 - (rowBytesNoPad % 4)) % 4;
  const rowBytes = rowBytesNoPad + pad;
  const pixelDataSize = rowBytes * height;

  // Palette size: 16 entries * 4 bytes each (BMP palette entries are 4 bytes: B,G,R,0)
  const paletteEntries = 16;
  const paletteSize = paletteEntries * 4;

  const bfOffBits = 14 + 40 + paletteSize; // file header + info header + palette
  const bfSize = bfOffBits + pixelDataSize;

  const buf = Buffer.alloc(bfSize);
  let offset = 0;

  // BITMAPFILEHEADER (14 bytes)
  buf.writeUInt16LE(0x4D42, offset); // bfType 'BM'
  offset += 2;
  buf.writeUInt32LE(bfSize, offset); // bfSize
  offset += 4;
  buf.writeUInt16LE(0, offset); // bfReserved1
  offset += 2;
  buf.writeUInt16LE(0, offset); // bfReserved2
  offset += 2;
  buf.writeUInt32LE(bfOffBits, offset); // bfOffBits
  offset += 4;

  // BITMAPINFOHEADER (40 bytes)
  buf.writeUInt32LE(40, offset); // biSize
  offset += 4;
  buf.writeInt32LE(width, offset); // biWidth
  offset += 4;
  buf.writeInt32LE(height, offset); // biHeight (positive = bottom-up)
  offset += 4;
  buf.writeUInt16LE(1, offset); // biPlanes
  offset += 2;
  buf.writeUInt16LE(4, offset); // biBitCount
  offset += 2;
  buf.writeUInt32LE(0, offset); // biCompression = BI_RGB
  offset += 4;
  buf.writeUInt32LE(pixelDataSize, offset); // biSizeImage
  offset += 4;
  buf.writeInt32LE(2835, offset); // biXPelsPerMeter (~72 DPI)
  offset += 4;
  buf.writeInt32LE(2835, offset); // biYPelsPerMeter
  offset += 4;
  buf.writeUInt32LE(paletteEntries, offset); // biClrUsed
  offset += 4;
  buf.writeUInt32LE(0, offset); // biClrImportant
  offset += 4;

  // Palette (paletteEntries entries)
  for (let i = 0; i < paletteEntries; i++) {
    if (i < palette.length) {
      const p = palette[i];
      buf.writeUInt8(p.b, offset++);
      buf.writeUInt8(p.g, offset++);
      buf.writeUInt8(p.r, offset++);
      buf.writeUInt8(0x00, offset++);
    } else {
      // zero filler
      buf.writeUInt32LE(0, offset);
      offset += 4;
    }
  }

  // Pixel data: bottom-up rows
  // For each row from bottom (y = height-1) to top (y=0)
  for (let y = height - 1; y >= 0; y--) {
    let byteIdx = 0;
    let rowOffset = offset + ( (height - 1 - y) * rowBytes );
    // Build row into temporary buffer to ease padding
    const rowBuf = Buffer.alloc(rowBytes);
    let bpos = 0;
    for (let x = 0; x < width; x += 2) {
      // left pixel
      const base1 = (y * width + x) * 4;
      const r1 = data[base1];
      const g1 = data[base1 + 1];
      const b1 = data[base1 + 2];
      const a1 = data[base1 + 3];
      const idx1 = mapPixel(r1, g1, b1, a1) & 0x0f;

      // right pixel (may be out of range -> use white)
      let idx2 = 1;
      if (x + 1 < width) {
        const base2 = (y * width + (x + 1)) * 4;
        const r2 = data[base2];
        const g2 = data[base2 + 1];
        const b2 = data[base2 + 2];
        const a2 = data[base2 + 3];
        idx2 = mapPixel(r2, g2, b2, a2) & 0x0f;
      }

      const packed = (idx1 << 4) | idx2;
      rowBuf[bpos++] = packed;
    }
    // padding bytes (already zeroed by Buffer.alloc)
    rowBuf.copy(buf, rowOffset, 0, rowBytes);
  }

  return buf;
}

export default imageDataToBmp;
