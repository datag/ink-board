# Copilot instructions for ink-board

This file tells Copilot sessions how to build, test, flash, and reason about this repository.

## Build, test, and lint commands
- Build: Use PlatformIO for all builds. From the repository root:
  - Full build: `~/.platformio/penv/bin/pio run -e nodemcuv2`
  - Quiet build: `~/.platformio/penv/bin/pio run -e nodemcuv2 --silent`
- Flash/upload to a NodeMCU v2:
  - `~/.platformio/penv/bin/pio run -t upload -e nodemcuv2 --upload-port /dev/ttyUSB0`
- Serial monitor: `~/.platformio/penv/bin/pio device monitor -p /dev/ttyUSB0`
- Tests: No unit tests exist yet. If added under `test/`, run a single test via:
  - `~/.platformio/penv/bin/pio test -e nodemcuv2 -f <test_name>`
- `pio` is not on PATH; always use `~/.platformio/penv/bin/pio`.

## High-level architecture
- **Target**: ESP8266 (NodeMCU 1.0 / ESP-12E), Arduino framework via PlatformIO (`env:nodemcuv2`).
- **Display**: Waveshare 2.9" ePaper (B) — 296×128 px, tri-color (black/white/red), SPI, driven by `GxEPD2_3C<GxEPD2_290c, …>` from the GxEPD2 library.
- **Entry point**: `src/main.cpp` — `setup()` initializes the display and renders a full-screen bitmap; `loop()` is intentionally empty (ePaper is static).
- **Build flow**: PlatformIO compiles `src/` and links against GxEPD2 + Adafruit GFX Library; output at `.pio/build/nodemcuv2/firmware.bin`.

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
- Driver class for this display: `GxEPD2_3C<GxEPD2_290c, GxEPD2_290c::HEIGHT>`.
- Include the 3-color driver as `#include <epd3c/GxEPD2_290c.h>` (it lives under `src/epd3c/` inside the library; the top-level `GxEPD2_290c.h` does not exist).
- Always wrap drawing calls in a `firstPage() … nextPage()` picture loop; never call `display()` directly on a paged display.
- Use `init(115200, true, 2, false)` for Waveshare boards with the "clever" reset circuit (shorter reset pulse). Fall back to `init(115200)` if unsure.
- Drawing colors: `GxEPD_WHITE`, `GxEPD_BLACK`, `GxEPD_RED` (aliased to `GxEPD_COLORED`).
- For 3-color bitmaps, call `drawBitmap()` twice inside the page loop — once with `GxEPD_BLACK` and the black plane, once with `GxEPD_RED` and the red plane.
- Store bitmaps in `PROGMEM`; format is MSB-first, 1 bit per pixel, rows padded to byte boundaries.

### platformio.ini is authoritative
Add all build flags, library deps, upload settings, and monitor options there. Current deps:
```
lib_deps =
  zinggjm/GxEPD2
  adafruit/Adafruit GFX Library
```

### LED / GPIO
- The previous LED blink demo has been replaced by the ePaper sketch. `LED_BUILTIN` on NodeMCU ESP-12E is GPIO2 (D4, active-low); it is not used by the current firmware.
- Avoid GPIO0 (D3) and GPIO2 (D4) for control signals if possible — they affect boot mode if driven low at power-on.
