# Copilot instructions for ink-board

This file tells Copilot sessions how to build, test, flash, and reason about this repository.

## Build, test, and lint commands
- Build: Use PlatformIO for all builds. From the `firmware/` directory:
  - Full build: `~/.platformio/penv/bin/pio run -e nodemcuv2`
  - Quiet build: `~/.platformio/penv/bin/pio run -e nodemcuv2 --silent`
- Flash/upload to a NodeMCU v2:
  - `~/.platformio/penv/bin/pio run -t upload -e nodemcuv2 --upload-port /dev/ttyUSB0`
- Serial monitor: `~/.platformio/penv/bin/pio device monitor -p /dev/ttyUSB0`
- Tests: No unit tests exist yet. If added under `firmware/test/`, run a single test via:
  - `~/.platformio/penv/bin/pio test -e nodemcuv2 -f <test_name>`
- `pio` is not on PATH; always use `~/.platformio/penv/bin/pio`.

## High-level architecture
- **Target**: ESP8266 (NodeMCU 1.0 / ESP-12E), Arduino framework via PlatformIO (`env:nodemcuv2`).
- **Display**: Waveshare 2.9" ePaper (B) — 296×128 px, tri-color (black/white/red), SPI, driven by `GxEPD2_3C<GxEPD2_290_C90c, 8>` (page_height=8 saves ~9KB BSS) from the GxEPD2 library.
- **Entry point**: `firmware/src/main.cpp` — `setup()` connects to WiFi (credentials in `firmware/include/config.h`, gitignored), shows IP on the display, then starts an HTTP server. `loop()` calls `server.handleClient()`.
- **HTTP endpoints**:
  - `POST /update` — accepts a `multipart/form-data` BMP upload; renders it on the display.
  - `POST /clear` — clears the display to white.
- **Build flow**: PlatformIO compiles `firmware/src/` and links against GxEPD2 + Adafruit GFX Library; output at `firmware/.pio/build/nodemcuv2/firmware.bin`.

## Key conventions and repository-specific patterns

### SPI / display wiring (NodeMCU 1.0 ESP-12E → Waveshare 2.9" B)
| Signal | NodeMCU pin | GPIO |
|--------|-------------|------|
| DIN (MOSI) | D7 | 13 |
| CLK (SCK)  | D5 | 14 |
| CS         | D8 | 15 |
| DC         | D2 |  4 |
| RST        | D1 |  5 |
| BUSY       | D6 | 12 |

Use `SS` (alias for GPIO15/D8) as `EPD_CS` in code to stay portable. GPIO0 (D3) and GPIO2 (D4) are boot-sensitive pins; avoid them for display control lines.

### GxEPD2 usage patterns
- Driver class for this display: `GxEPD2_3C<GxEPD2_290_C90c, 8>` (use page_height=8 to keep BSS small — saves ~9KB vs HEIGHT=296).
- Actual driver: `GxEPD2_290_C90c` (SSD1680 controller), used on Waveshare 2.9" B **V4** and V2.1 boards.
- Include the 3-color driver as `#include <epd3c/GxEPD2_290_C90c.h>`.
- Always wrap drawing calls in a `firstPage() … nextPage()` picture loop; never call `display()` directly on a paged display.
- Use `init(115200, true, 2, false)` for Waveshare V2.1+ boards (shorter reset pulse). Fall back to `init(115200)` if unsure.
- Drawing colors: `GxEPD_WHITE`, `GxEPD_BLACK`, `GxEPD_RED` (aliased to `GxEPD_COLORED`).
- For 3-color bitmaps, call `drawBitmap()` twice inside the page loop — once with `GxEPD_BLACK` and the black plane, once with `GxEPD_RED` and the red plane.
- Store bitmaps in `PROGMEM`; format is MSB-first, 1 bit per pixel, rows padded to byte boundaries.

### platformio.ini is authoritative
Add all build flags, library deps, upload settings, and monitor options to `firmware/platformio.ini`. Current deps:
```
lib_deps =
  zinggjm/GxEPD2
  adafruit/Adafruit GFX Library
```

### WiFi credentials
- Copy `firmware/include/config.h.example` to `firmware/include/config.h` and fill in real credentials.
- `firmware/include/config.h` is gitignored — never commit it.

### BMP upload workflow
The `/update` endpoint accepts `multipart/form-data` to avoid ESP8266WebServer buffering the entire body (which would OOM at 113KB). Use:
```bash
curl http://<IP>/update -F "file=@image.bmp;type=image/bmp"
```
Image requirements:
- 296×128 pixels, 24-bit uncompressed BMP (no compression, no color table)
- Top-down (negative height) or bottom-up — both are handled
- Color quantization: R>180 & G<80 & B<80 → red; luminance < 128 → black; else white

To generate a compatible BMP from any image:
```bash
firmware/tools/png2bmp.sh input.png output.bmp
```

### LED / GPIO
- The previous LED blink demo has been replaced by the ePaper sketch. `LED_BUILTIN` on NodeMCU ESP-12E is GPIO2 (D4, active-low); it is not used by the current firmware.
- Avoid GPIO0 (D3) and GPIO2 (D4) for control signals if possible — they affect boot mode if driven low at power-on.
