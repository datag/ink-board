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
//   Left  (0–159 px):  BTC price
//   Right (160–295 px): weather / power / clock (stacked, 3×42 px rows)

export default {
  background: "#ffffff",

  widgets: [

    // ── Vertical divider ────────────────────────────────────────────────────
    { type: "line", x1: 160, y1: 0, x2: 160, y2: 128, color: "#000000", width: 2 },

    // ── Left column: BTC ────────────────────────────────────────────────────
    { type: "text", x: 8,  y: 8,   text: "BTC",   fontSize: 8,  color: "#000000", fontFamily: "Press Start 2P" },
    { type: "text", x: 8,  y: 28,  text: "$",      fontSize: 16,  color: "#ff0000", fontFamily: "Press Start 2P" },
    { type: "text", x: 30, y: 28,  text: "{btc}",  fontSize: 16, color: "#000000", fontFamily: "Press Start 2P",
      modifier: (widget, vars) => ({
        // Parse the raw float string, floor it to a whole number, and return it as the display text.
        text: new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(vars.btc),
      })
    },

    // ── Right column dividers ────────────────────────────────────────────────
    { type: "line", x1: 162, y1: 42,  x2: 296, y2: 42,  color: "#000000", width: 1 },
    { type: "line", x1: 162, y1: 84,  x2: 296, y2: 84,  color: "#000000", width: 1 },

    // ── Weather (row 0–41) ───────────────────────────────────────────────────
    { type: "text", x: 167, y: 6,  text: "WEATHER",   fontSize: 16, color: "#000000", fontFamily: "Press Start 2P" },
    { type: "text", x: 167, y: 22, text: "{weather}", fontSize: 16, color: "#000000", fontFamily: "Press Start 2P" },

    // ── Power (row 42–83) ────────────────────────────────────────────────────
    { type: "text", x: 167, y: 48, text: "POWER (KW)", fontSize: 8,  color: "#000000", fontFamily: "Press Start 2P" },
    { type: "text", x: 167, y: 64, text: "{power}",    fontSize: 16, color: "#000000", fontFamily: "Press Start 2P" },

    // ── Clock (row 84–127) — inverted ────────────────────────────────────────
    { type: "rect", x: 162, y: 84, w: 134, h: 44, fill: "#000000" },
    { type: "text", x: 167, y: 90,  text: "TIME",    fontSize: 8,  color: "#ffffff", fontFamily: "Press Start 2P" },
    { type: "text", x: 167, y: 106, text: "{clock}", fontSize: 16, color: "#ffffff", fontFamily: "Press Start 2P" },

  ],
};
