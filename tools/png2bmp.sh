#!/usr/bin/env bash
# Convert any image to a 296×128 24-bit uncompressed BMP for ink-board.
#
# Requirements: ImageMagick (convert / magick)
#
# Usage:
#   tools/png2bmp.sh input.png output.bmp
#
# What this does:
#   -resize 296x128!   force exact 296×128 (ignores aspect ratio)
#   -type TrueColor    strip alpha channel, keep RGB
#   BMP3:              BITMAPINFOHEADER (40-byte DIB), 24-bit, no compression
#                      — the only variant the ink-board firmware accepts
#
# Then upload with:
#   curl http://<ip>/update -F "file=@output.bmp;type=image/bmp"

set -euo pipefail

if [[ $# -lt 2 ]]; then
    echo "Usage: $0 <input> <output.bmp>" >&2
    exit 1
fi

INPUT="$1"
OUTPUT="$2"

# Prefer ImageMagick 7 (magick), fall back to ImageMagick 6 (convert)
if command -v magick &>/dev/null; then
    CONVERT=magick
elif command -v convert &>/dev/null; then
    CONVERT=convert
else
    echo "Error: ImageMagick not found. Install with: sudo apt install imagemagick" >&2
    exit 1
fi

"$CONVERT" "$INPUT" -resize 296x128! -type TrueColor "BMP3:$OUTPUT"
echo "Written: $OUTPUT  ($(wc -c < "$OUTPUT") bytes, 296×128 24-bit BMP)"
