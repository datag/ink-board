#!/usr/bin/env bash
# Convert any image to a 296×128 BMP for ink-board.
#
# Requirements: ImageMagick (convert / magick)
#
# Usage:
#   tools/png2bmp.sh [--4bit|--8bit|--24bit] input.png output.bmp
#
#   --4bit   4-bit indexed, 3-color palette  ~19 KB  (default, preferred)
#   --8bit   8-bit indexed, 256-color palette ~38 KB
#   --24bit  24-bit RGB uncompressed         ~113 KB (legacy)
#
# Upload:
#   curl http://<ip>/update -F "file=@output.bmp;type=image/bmp"

set -euo pipefail

MODE="4bit"

# Parse optional mode flag
if [[ $# -ge 1 && "$1" == --* ]]; then
    case "$1" in
        --4bit)  MODE="4bit"  ;;
        --8bit)  MODE="8bit"  ;;
        --24bit) MODE="24bit" ;;
        *) echo "Unknown option: $1  (use --4bit, --8bit, or --24bit)" >&2; exit 1 ;;
    esac
    shift
fi

if [[ $# -lt 2 ]]; then
    echo "Usage: $0 [--4bit|--8bit|--24bit] <input> <output.bmp>" >&2
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

case "$MODE" in
    4bit)
        # 4-bit indexed BMP: quantize to 3 colors (black/white/red), ~19 KB.
        # -remap maps to an exact 3-color palette so the firmware colorClass[]
        # lookup always works cleanly.
        PALETTE_PNG=$(mktemp /tmp/ink-palette-XXXXXX.png)
        trap 'rm -f "$PALETTE_PNG"' EXIT
        "$CONVERT" -size 3x1 xc:'#000000' xc:'#FFFFFF' xc:'#FF0000' \
            +append "$PALETTE_PNG"
        "$CONVERT" "$INPUT" -resize 296x128! -remap "$PALETTE_PNG" \
            -depth 4 "BMP3:$OUTPUT"
        ;;
    8bit)
        # 8-bit indexed BMP: 256-color palette, uncompressed, ~38 KB.
        "$CONVERT" "$INPUT" -resize 296x128! -colors 256 \
            -compress None "BMP3:$OUTPUT"
        ;;
    24bit)
        # 24-bit RGB uncompressed BMP, ~113 KB (legacy).
        "$CONVERT" "$INPUT" -resize 296x128! -type TrueColor "BMP3:$OUTPUT"
        ;;
esac

echo "Written: $OUTPUT  ($(wc -c < "$OUTPUT") bytes, 296×128 ${MODE} BMP)"
