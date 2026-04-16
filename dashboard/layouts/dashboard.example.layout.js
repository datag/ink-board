// ink-board layout — 296×128 px, tri-color (black/white/red)
//
// COLORS: only #000000, #ffffff, #ff0000 are allowed.
// TEXT y: top of the text bounding box (textBaseline = 'top').
//
// Font: Press Start 2P — pixel font, 8px grid.
//   8px  ≈ Adafruit GFX size 1  (labels)
//   16px ≈ Adafruit GFX size 2  (values)
//
// Layout: two columns
//   Left  (0–159 px):  BTC price (top) / Tibber price+power (bottom)
//   Right (160–295 px): weather / power / clock (stacked, 3×42 px rows)

export default {
  background: "#ffffff",

  widgets: [

    // ── Vertical divider ────────────────────────────────────────────────────
    { type: "line", x1: 160, y1: 0, x2: 160, y2: 128, color: "#000000", width: 2 },

    // ── Left column: BTC ────────────────────────────────────────────────────
    { type: "text", x: 8,  y: 8,   text: "BTC",   fontSize: 8,  color: "#000000", fontFamily: "Press Start 2P" },
    { type: "text", x: 8,  y: 26,  text: "$",      fontSize: 16,  color: "#ff0000", fontFamily: "Press Start 2P" },
    { type: "text", x: 30, y: 26,  text: "{btc}",  fontSize: 16, color: "#000000", fontFamily: "Press Start 2P",
      modifier: (widget, vars) => {
        const n = Number(vars.btc);
        return isNaN(n) ? {} : { text: new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(n) };
      }
    },

    { type: "line", x1: 0, y1: 50, x2: 159, y2: 50, color: "#000000", width: 1 },

    // ── Left column: Tibber ─────────────────────────────────────────────────
    { type: "text", x: 8, y: 60,  text: "STROM",         fontSize: 8,  color: "#000000", fontFamily: "Press Start 2P" },
    // Price in cents
    { type: "text", x: 8, y: 75,  text: "\u00a2",         fontSize: 16, color: "#ff0000", fontFamily: "Press Start 2P" },
    { type: "text", x: 30, y: 75, text: "{tibber_price}",  fontSize: 16, color: "#000000", fontFamily: "Press Start 2P",
      modifier: (widget, vars) => {
        const n = Number(vars.tibber_price);
        return isNaN(n) ? {} : { text: (n * 100).toFixed(1) };
      } },
    // Power in watts
    { type: "text", x: 8, y: 100, text: "{tibber_power}", fontSize: 16, color: "#000000", fontFamily: "Press Start 2P",
      modifier: (widget, vars) => {
        const n = Number(vars.tibber_power);
        return isNaN(n) ? {} : { text: new Intl.NumberFormat('de-DE').format(Math.round(n)) + ' W' };
      } },

    // ── Right column dividers ────────────────────────────────────────────────
    { type: "line", x1: 162, y1: 42,  x2: 296, y2: 42,  color: "#000000", width: 1 },
    { type: "line", x1: 162, y1: 84,  x2: 296, y2: 84,  color: "#000000", width: 1 },

    // ── Weather (row 0–41) ───────────────────────────────────────────────────
    { type: "text", x: 167, y: 2,  text: "WETTER",        fontSize: 8,  color: "#000000", fontFamily: "Press Start 2P" },
    { type: "text", x: 167, y: 13, text: "{weather}",     fontSize: 16, color: "#000000", fontFamily: "Press Start 2P",
      modifier: (widget, vars) => {
        const n = Number(vars.weather);
        return isNaN(n) ? {} : { text: `${n}\u00b0C` };
      } },
    { type: "text", x: 167, y: 32, text: "{weather_cond}", fontSize: 8, color: "#000000", fontFamily: "Press Start 2P" },

    // ── Power (row 42–83) ────────────────────────────────────────────────────
    { type: "text", x: 167, y: 48, text: "SOMETHING", fontSize: 8,  color: "#000000", fontFamily: "Press Start 2P" },
    { type: "text", x: 167, y: 64, text: "{power}",    fontSize: 16, color: "#000000", fontFamily: "Press Start 2P" },

    // ── Clock (row 84–127) — inverted ────────────────────────────────────────
    { type: "rect", x: 162, y: 84, w: 134, h: 44, fill: "#000000" },
    { type: "text", x: 167, y: 90,  text: "TIME",    fontSize: 8,  color: "#ffffff", fontFamily: "Press Start 2P" },
    { type: "text", x: 167, y: 106, text: "{clock}", fontSize: 16, color: "#ffffff", fontFamily: "Press Start 2P",
      modifier: () => ({
        text: new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }).format(new Date()),
      }) },

  ],
};
