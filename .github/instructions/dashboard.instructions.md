---
applyTo: "dashboard/**"
---


# Copilot instructions for ink-board dashboard

This module renders a tri-color ePaper dashboard image and uploads it to an ink-board device via HTTP.

## Build, run, and test commands
- Install dependencies: `npm install` (from `dashboard/`)
- Render and upload: `node render.js`
- Dry-run (no upload): `node render.js --dry-run`
- Save BMP output: `node render.js --out out.bmp`
- Custom config: `node render.js --config path/to/dashboard.json5`
- No automated tests exist yet.

## High-level architecture
- **Entry point**: `render.js` — parses CLI args, orchestrates the pipeline.
- **Pipeline**: config → data → layout → SVG/PNG (via Cairo / node-canvas) → BMP → HTTP upload.
- **Runtime**: Node.js ≥18, ESM (`"type": "module"`).

### Source files (`src/`)
| File | Responsibility |
|------|----------------|
| `config.js` | Loads and validates `dashboard.json5` |
| `dataLoader.js` | Fetches data from configured sources |
| `layout.js` | Parses the layout JSON5 file referenced by config |
| `renderer.js` | Converts layout + data → SVG string and PNG buffer (node-canvas) |
| `converter.js` | Converts PNG buffer → BMP via `firmware/tools/png2bmp.sh` |
| `uploader.js` | POSTs BMP to the device at `POST /update` |

### Configuration
- `dashboard.json5` (gitignored) is the live config; `dashboard.example.json5` is the committed template.
- Config specifies `device.url`, `device.layout` (path to a layout file), and data sources.
- Layout files live under `layouts/` and define widgets (text, shapes, etc.) and their positions.

### Output image constraints
- Must be exactly **296×128 pixels**, 24-bit uncompressed BMP, to match the Waveshare 2.9" B display.
- Only three colors are meaningful: black, white, red — the firmware quantizes everything else.
- Debug intermediates (`debug.svg`, `debug.png`) are written to the `dashboard/` root on every run.

### Fonts
- Custom fonts are stored under `dashboard/fonts/`.
- Reference them in layout files by filename; `renderer.js` registers them with node-canvas before drawing.

### Key conventions
- All source files use ES modules (`import`/`export`); no CommonJS.
- Prefer `async`/`await` over callbacks or raw Promise chains.
- Keep `render.js` as a thin orchestrator — business logic belongs in `src/`.
- `dashboard.json5` and `dashboard/*.json5` are gitignored; always edit `dashboard.example.json5` to document new config keys.
