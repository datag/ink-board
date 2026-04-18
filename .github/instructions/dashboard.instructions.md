---
applyTo: "dashboard/**"
---


# Copilot instructions for ink-board dashboard

This module renders a tri-color ePaper dashboard image and uploads it to an ink-board device via HTTP.

## Build, run, and test commands
- Install dependencies: `npm install` (from `dashboard/`)
- Render and upload: `node render.js --config dashboard.json5`
- Dry-run (no upload): `node render.js --config dashboard.json5 --dry-run`
- Save BMP output: `node render.js --config dashboard.json5 --out out.bmp`
- Always pass `--config dashboard.json5` explicitly when running render.js.
- **Always add `--debug`** when running render.js as an agent — this bypasses `max_age` staleness checks so data files are read regardless of age (the flag has no other effect; `max_age` is still required in config).
- Fetch all enabled data sources: `node fetch.js`
- Run one data script directly: `node scripts/tibber.js`, `node scripts/binance.js`, `node scripts/weather.js`
- No automated tests exist yet.

## High-level architecture
- **Entry point**: `render.js` — parses CLI args, orchestrates the pipeline.
- **Pipeline**: config → data → layout → SVG → PNG (via canvg + node-canvas) → BMP → HTTP upload. The PNG (debug.png) is now rasterised from the generated SVG by default.
- **Runtime**: Node.js ≥18, ESM (`"type": "module"`).

### Source files (`src/`)
| File | Responsibility |
|------|----------------|
| `config.js` | Loads and validates `dashboard.json5` |
| `dataLoader.js` | Reads hot-folder files from `data_dir`, checks staleness, returns a `vars` dict |
| `layout.js` | Loads and validates the layout file (.js or .json5); compiles modifiers |
| `renderer.js` | Converts layout + data → SVG string (layoutToSvg). Registers fonts used by the SVG renderer. |
| `converter.js` | Converts SVG → PNG (canvg + node-canvas) and PNG → BMP via `firmware/tools/png2bmp.sh` |
| `uploader.js` | POSTs BMP to the device at `POST /update` |

### Data-fetching scripts (`scripts/`)
Each script reads config (`--config` flag, defaults to `dashboard.json5`), fetches from an external API, and writes one or more JSON files to `device.data_dir`. Scripts are enabled via `scripts.{key}.enabled: true` in the config.

| Script | Writes | Key config keys |
|--------|--------|-----------------|
| `tibber.js` | `tibber_price.json`, `tibber_power.json` | `scripts.tibber.access_token` |
| `binance.js` | `binance_{symbol}.json` | `scripts.binance.symbol`, `scripts.binance.api_key` |
| `weather.js` | `weather.json` | `scripts.weather.lat`, `scripts.weather.lon` |

`fetch.js` (project root) iterates `scripts.*` in config order, spawns each enabled script, streams its output, and prints ✓/✗ per script without aborting on failure.

### Configuration
- `dashboard.json5` (gitignored) is the live config; `dashboard.example.json5` is the committed template.
- Config specifies `device.url`, `device.data_dir`, `device.layout`, `sources[]`, and `scripts.*`.
- Always add new config keys to `dashboard.example.json5` — never commit `dashboard.json5`.

### Layout files
- Layout files live under `layouts/` and are referenced by `device.layout` in config.
- **Prefer `.js` (ES module, `export default { background, widgets }`)** — enables native functions.
- `.json5` is also supported for backward compatibility; modifiers must be serialized function strings.
- `loadLayout` is async; always `await` it.

### Output image constraints
- Must be exactly **296×128 pixels** to match the Waveshare 2.9" B display.
- Only three colors are valid: `#000000`, `#ffffff`, `#ff0000` — validated at load time, no others.
- Debug intermediates (`debug.svg`, `debug.png`) are written to `device.data_dir` on every run.

### Widget modifier pattern
Any widget can have an optional `modifier: (widget, vars) => Partial<Widget>` function. It is called at render time with the static widget config and the live data `vars` dict. The return value is shallowly merged onto the widget before rendering. Returning `{}` means no override.

Always guard against stale placeholders — when the raw value is not a number, return `{}`:
```js
modifier: (widget, vars) => {
  const n = Number(vars.my_source);
  return isNaN(n) ? {} : { text: /* formatted value */ };
}
```

### Number formatting convention
Use `de-DE` locale throughout — `.` as thousands separator, `,` as decimal separator:
```js
// Integer with thousands sep
new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(n)
// Fixed decimal
n.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
// Time (Europe/Berlin)
new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }).format(new Date())
```

### Fonts
- Custom fonts live under `dashboard/fonts/`; `renderer.js` registers them with node-canvas at startup.
- **Press Start 2P** is the standard font: 8px ≈ Adafruit GFX size 1 (labels), 16px ≈ size 2 (values).
- `textBaseline = 'top'` — widget `y` is the **top** of the glyph box, not the baseline.

Rendering note:
- SVG → PNG rasterisation uses Canvg (in-process) and will use fonts registered by `renderer.js`. If Canvg or the DOM parser fails, the pipeline falls back to rasterising the SVG via a data-URL and `canvas.loadImage`; a warning is logged when this occurs. The PNG is saved to `device.data_dir/debug.png` on every run.
### Key conventions
- All source files use ES modules (`import`/`export`); no CommonJS.
- Prefer `async`/`await` over callbacks or raw Promise chains.
- Keep `render.js` as a thin orchestrator — business logic belongs in `src/`.
- Each `scripts/*.js` file follows the same pattern: `parseArgs` → `loadConfig` → fetch → `writeFileSync`.
- `dashboard.json5` is gitignored; always edit `dashboard.example.json5` to document new config keys.
