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
    { type: "text", x: 4,  y: 4,   text: "\uF108", fontSize: 24,  color: "#ff0000", fontFamily: "iconfont" },
    { type: "text", x: 33, y: 10,  text: "$",  fontSize: 8, color: "#000000", fontFamily: "Press Start 2P" },
    { type: "text", x: 41, y: 10,  text: "{btc}",  fontSize: 16, color: "#000000", fontFamily: "Press Start 2P",
      modifier: (widget, vars) => {
        const n = Number(vars.btc);
        return isNaN(n) ? {} : { text: new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(n) };
      }
    },

    { type: "line", x1: 0, y1: 43, x2: 159, y2: 43, color: "#000000", width: 1 },

    // ── Left column: Tibber ─────────────────────────────────────────────────
    { type: "text", x: 8, y: 60,  text: "STROM",         fontSize: 8,  color: "#000000", fontFamily: "Press Start 2P" },
    // Price background: black-inverted <=0, red-inverted >=28, else white
    { type: "rect", x: 2, y: 72, w: 156, h: 22, fill: "#ffffff",
      modifier: (widget, vars) => {
        const cents = Number(vars.tibber_price) * 100;
        if (isNaN(cents)) return {};
        return { fill: cents <= 0 ? '#000000' : cents >= 28 ? '#ff0000' : '#ffffff' };
      } },
    // Price in cents — suffix ¢; fg: white <=0 or >=28, red >=25, else black
    { type: "text", x: 150, y: 75, text: "{tibber_price}",  fontSize: 16, color: "#000000", fontFamily: "Press Start 2P", textAlign: 'right',
      modifier: (widget, vars) => {
        const n = Number(vars.tibber_price);
        if (isNaN(n)) return {};
        const cents = n * 100;
        const text = cents.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' \u00a2';
        const color = cents <= 0 || cents >= 28 ? '#ffffff' : cents >= 25 ? '#ff0000' : '#000000';
        return { text, color };
      } },
    // Power background: black-inverted <=0, red-inverted >3000, else white
    { type: "rect", x: 2, y: 97, w: 156, h: 22, fill: "#ffffff",
      modifier: (widget, vars) => {
        const n = Number(vars.tibber_power);
        if (isNaN(n)) return {};
        return { fill: n <= 0 ? '#000000' : n > 3000 ? '#ff0000' : '#ffffff' };
      } },
    // Power in watts — positive = consuming from grid, negative = exporting PV surplus
    // fg: white <=0 or >3000, red >1000, else black
    { type: "text", x: 150, y: 100, text: "{tibber_power}", fontSize: 16, color: "#000000", fontFamily: "Press Start 2P", textAlign: "right",
      modifier: (widget, vars) => {
        const n = Number(vars.tibber_power);
        if (isNaN(n)) return {};
        const color = n <= 0 || n > 3000 ? '#ffffff' : n > 1000 ? '#ff0000' : '#000000';
        return {
          text: new Intl.NumberFormat('de-DE').format(Math.round(n)) + ' W',
          color,
        };
      } },

    // ── Right column dividers ────────────────────────────────────────────────
    { type: "line", x1: 162, y1: 60,  x2: 296, y2: 60,  color: "#000000", width: 1 },
    { type: "line", x1: 162, y1: 84,  x2: 296, y2: 84,  color: "#000000", width: 1 },

    // ── Weather ───────────────────────────────────────────────────
    { type: "text", x: 167, y: 8,  text: "WETTER",        fontSize: 8,  color: "#000000", fontFamily: "Press Start 2P" },
    { type: "text", x: 167, y: 24, text: "{weather}",     fontSize: 16, color: "#000000", fontFamily: "Press Start 2P",
      modifier: (widget, vars) => {
        const n = Number(vars.weather);
        return isNaN(n) ? {} : { text: n.toLocaleString('de-DE', { maximumFractionDigits: 1 }) + '\u00b0C' };
      } },
    { type: "text", x: 167, y: 44, text: "{weather_cond}", fontSize: 8, color: "#000000", fontFamily: "Press Start 2P" },

    // ── Clock — inverted ────────────────────────────────────────
    { type: "rect", x: 162, y: 84, w: 100, h: 44, fill: "#000000" },
    { type: "text", x: 167, y: 90,  text: "UPDATED",    fontSize: 8,  color: "#ffffff", fontFamily: "Press Start 2P" },
    { type: "text", x: 167, y: 106, text: "{clock}", fontSize: 16, color: "#ffffff", fontFamily: "Press Start 2P",
      modifier: () => ({
        text: new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }).format(new Date()),
      }) },

    // ── Tests ────────────────────────────────────────────────────
    { type: "text", x: 170, y: 64, text: "[uwxyz{q", fontSize: 16,  color: "#000000", fontFamily: "Yarndings 12" },
    { type: "text", x: 268, y: 95, text: "\uF1BE", fontSize: 24,  color: "#ff0000", fontFamily: "iconfont" },
  ],
};
