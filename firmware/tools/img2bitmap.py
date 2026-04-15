#!/usr/bin/env python3
"""
Convert a 296x128 RGB image to two GxEPD2 PROGMEM byte arrays.

Colors in the source image:
  White  (#ffffff or similar bright)  -> background (no bit set in either plane)
  Black  (#000000 or similar dark)    -> set bit in BLACK plane
  Red    (#ff0000 or any red-ish)     -> set bit in RED plane

Usage:
  python3 tools/img2bitmap.py <image.png>

Output: prints C arrays ready to paste into src/main.cpp.
"""

import sys
from PIL import Image

EPD_W, EPD_H = 296, 128

def quantize(r, g, b):
    if r > 180 and g < 80 and b < 80:
        return "red"
    brightness = 0.299 * r + 0.587 * g + 0.114 * b
    return "black" if brightness < 128 else "white"

def image_to_arrays(path):
    img = Image.open(path).convert("RGB")
    if img.size != (EPD_W, EPD_H):
        print(f"[warn] image is {img.size}, resizing to {EPD_W}x{EPD_H}", file=sys.stderr)
        img = img.resize((EPD_W, EPD_H), Image.LANCZOS)

    bytes_per_row = EPD_W // 8
    black_plane = bytearray(bytes_per_row * EPD_H)
    red_plane   = bytearray(bytes_per_row * EPD_H)

    pixels = img.load()
    for y in range(EPD_H):
        for x in range(EPD_W):
            color = quantize(*pixels[x, y])
            byte_idx = y * bytes_per_row + x // 8
            bit_mask = 0x80 >> (x % 8)
            if color == "black":
                black_plane[byte_idx] |= bit_mask
            elif color == "red":
                red_plane[byte_idx]   |= bit_mask

    return black_plane, red_plane

def fmt_array(name, data):
    lines = [f"static const uint8_t PROGMEM {name}[{len(data)}] = {{"]
    row_bytes = EPD_W // 8
    for i in range(0, len(data), row_bytes):
        chunk = data[i : i + row_bytes]
        hex_vals = ", ".join(f"0x{b:02X}" for b in chunk)
        lines.append(f"  {hex_vals},")
    lines[-1] = lines[-1].rstrip(",")
    lines.append("};")
    return "\n".join(lines)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 tools/img2bitmap.py <image.png>")
        sys.exit(1)
    black_plane, red_plane = image_to_arrays(sys.argv[1])
    print(fmt_array("bm_black", black_plane))
    print()
    print(fmt_array("bm_red", red_plane))
    print()
    print(f"// Draw with:")
    print(f"// display.drawBitmap(0, 0, bm_black, {EPD_W}, {EPD_H}, GxEPD_BLACK);")
    print(f"// display.drawBitmap(0, 0, bm_red,   {EPD_W}, {EPD_H}, GxEPD_RED);")
