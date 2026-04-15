# ink-board dashboard renderer

Renders a tri-color e-ink dashboard image and uploads it to an [ink-board](../) device.

## Architecture

```
hot-folder (*.json / *.txt)   ← written by independent data-fetcher programs
         │  staleness check (mtime vs max_age per source)
         ▼
   data context object         ← { btc: "42,350", weather: "12°C", … }
         │  EJS template rendering
         ▼
   HTML string (296×128 px)
         │  Puppeteer headless Chromium screenshot
         ▼
   PNG buffer
         │  firmware/tools/png2bmp.sh --4bit
         ▼
   4-bit indexed BMP (3 colors: black / white / red)
         │  HTTP POST /update (multipart/form-data)
         ▼
   Device display refreshed ✓
```

## Quick start

```bash
cd dashboard/
npm install          # installs Puppeteer (downloads Chromium ~170 MB on first run)

cp dashboard.example.json5 dashboard.json5
# edit dashboard.json5: set device.url, device.data_dir, review sources

node render.js --dry-run --out preview.bmp   # render without uploading
node render.js                               # render and upload
```

## Prerequisites

- **Node.js ≥ 20** (see `.nvmrc` — tested with Node 24 via nvm)
- **ImageMagick** — used by `firmware/tools/png2bmp.sh` for BMP conversion
  ```bash
  sudo apt install imagemagick
  ```

## Config file (`dashboard.json5`)

Copy `dashboard.example.json5` to `dashboard.json5` (which is gitignored) and edit:

```json5
{
  device: {
    url: "http://192.168.1.x",           // ink-board device IP
    data_dir: "/path/to/hot-folder",     // where data files are written
    template: "templates/dashboard.example.html.ejs",
  },
  sources: [
    {
      id: "btc",           // key in the EJS template: data.btc
      file: "btc.json",    // filename inside data_dir
      key: "price",        // dot-path into JSON value (omit for .txt)
      max_age: 300,        // seconds before the value is considered stale
      stale_placeholder: "—",  // shown when stale or file missing
    },
    // … more sources
  ],
}
```

### Source file formats

| Extension | Format | Example |
|-----------|--------|---------|
| `*.json`  | Any JSON; use `key` to select a value by dot-path | `{"price": "42350", "change": "+1.2%"}` |
| `*.txt`   | First non-empty line is the value | `2.4` |

## Template design

Templates are EJS files (`.html.ejs`) that render to a **296×128 px** HTML page.
Puppeteer screenshots this page at device pixel ratio 1.

**Color constraint:** Use only `#000000`, `#ffffff`, and `#ff0000`.
Any other color is quantized by the firmware:
- Red-dominant pixels → red
- Dark pixels (luminance < 128) → black
- Everything else → white

**Previewing in a browser:**
Open the `.html.ejs` template in a browser — it's valid HTML.
To inject mock data, add a `<script>` block at the bottom with `const data = { … }`.
Set the browser viewport (DevTools → device toolbar) to **296 × 128**.

**Template variables:** `data.<source-id>` for each source in the config.

## CLI options

```
node render.js [options]

Options:
  --config <path>   Path to config file (default: dashboard.json5 next to render.js)
  --dry-run         Render and convert to BMP, but do NOT upload to the device
  --out <path>      Save a copy of the generated BMP to <path>
  --help            Show usage
```

## Cron setup

```cron
# Render and upload dashboard every 5 minutes
*/5 * * * * cd /path/to/ink-board/dashboard && node render.js >> /var/log/inkboard.log 2>&1
```

Data-fetcher scripts should write files to `data_dir` on their own schedule:

```bash
# Example: BTC price fetcher (runs every minute via cron)
*/1 * * * * curl -s https://api.coinbase.com/v2/prices/BTC-USD/spot \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps({'price': d['data']['amount']}))" \
  > /path/to/hot-folder/btc.json
```

## Hot-folder conventions

- Each data source writes **one file** per logical value
- Write atomically (write to a `.tmp` file, then `mv` it) to avoid partial reads
- The renderer checks the file modification time (`mtime`) against `max_age`
- Missing or stale files display `stale_placeholder` in the template
