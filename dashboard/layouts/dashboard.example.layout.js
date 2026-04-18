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

import { lookupWeatherIcon, pickCodePoint } from "../src/weatherIconMap.js";

export default {
  background: "#ffffff",

  widgets: [

    // ── Vertical divider ────────────────────────────────────────────────────
    { type: "line", x1: 160, y1: 0, x2: 160, y2: 128, color: "#000000", width: 2 },

    // ── Left column: Tibber ─────────────────────────────────────────────────
    { type: "text", x: 2, y: 3, text: "\uF26A" /* \uF172 */, fontSize: 24,  color: "#000000", fontFamily: "iconfont" },
    // Price background: black-inverted <=0, red-inverted >=28, else white
    { type: "rect", x: 50, y: 6, w: 108, h: 22, fill: "#ffffff",
      modifier: (widget, vars) => {
        const cents = Number(vars.tibber_price) * 100;
        if (isNaN(cents)) return {};
        return { fill: cents <= 0 ? '#000000' : cents >= 28 ? '#ff0000' : '#ffffff' };
      } },
    // Price in cents — suffix ¢; fg: white <=0 or >=28, red >=25, else black
    { type: "text", x: 152, y: 9, text: "{tibber_price}",  fontSize: 16, color: "#000000", fontFamily: "Press Start 2P", textAnchor: 'end',
      modifier: (widget, vars) => {
        const n = Number(vars.tibber_price);
        if (isNaN(n)) return {};
        const cents = n * 100;
        const text = cents.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' \u00a2';
        const color = cents <= 0 || cents >= 28 ? '#ffffff' : cents >= 25 ? '#ff0000' : '#000000';
        return { text, color };
      } },
    // Power background: black-inverted <=0, red-inverted >3000, else white
    { type: "rect", x: 2, y: 31, w: 156, h: 22, fill: "#ffffff",
      modifier: (widget, vars) => {
        const n = Number(vars.tibber_power);
        if (isNaN(n)) return {};
        return { fill: n <= 0 ? '#000000' : n > 3000 ? '#ff0000' : '#ffffff' };
      } },
    // Power in watts — positive = consuming from grid, negative = exporting PV surplus
    // fg: white <=0 or >3000, red >1000, else black
    { type: "text", x: 152, y: 34, text: "{tibber_power}", fontSize: 16, color: "#000000", fontFamily: "Press Start 2P", textAnchor: "end",
      modifier: (widget, vars) => {
        const n = Number(vars.tibber_power);
        if (isNaN(n)) return {};
        const color = n <= 0 || n > 3000 ? '#ffffff' : n > 1000 ? '#ff0000' : '#000000';
        return {
          text: new Intl.NumberFormat('de-DE').format(Math.round(n)) + ' W',
          color,
        };
      } },

    { type: "line", x1: 0, y1: 59, x2: 159, y2: 59, color: "#000000", width: 1 },

    // ── Temperatures of hot water and stove ─────────────────────────────────────────────────
    { type: "rect", x: 2, y: 67, w: 70, h: 22, fill: "#ffffff",
      modifier: (widget, vars) => {
        const t = Number(vars.mcu_hot_water_temp);
        if (isNaN(t)) return {};
        if (t >= 75) return { fill: '#ff0000' };
        if (t <= 40) return { fill: '#000000' };
        return { fill: '#ffffff' };
      } },
    { type: "text", x: 2, y: 67, text: "\uF1F1" /* or \uF14A */, fontSize: 24,  color: "#000000", fontFamily: "iconfont" },
    { type: "text", x: 72, y: 76,  text: "{mcu_hot_water_temp} °C", fontSize: 8,  color: "#000000", fontFamily: "Press Start 2P", textAnchor: 'end',
      modifier: (widget, vars) => {
        const t = Number(vars.mcu_hot_water_temp);
        if (isNaN(t)) return {};
        const color = (t >= 75 || t <= 40) ? '#ffffff' : '#000000';
        return { text: t.toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' °C', color };
      } },

    { type: "rect", x: 80, y: 67, w: 79, h: 22, fill: "#ffffff",
      modifier: (widget, vars) => {
        const t = Number(vars.mcu_stove_temp);
        if (isNaN(t)) return {};
        return t >= 92 ? { fill: '#ff0000' } : { fill: '#ffffff' };
      } },
    { type: "text", x: 80, y: 67, text: "\uF1C5", fontSize: 24,  color: "#000000", fontFamily: "iconfont" },
    { type: "text", x: 153, y: 76,  text: "{mcu_stove_temp} °C", fontSize: 8,  color: "#000000", fontFamily: "Press Start 2P", textAnchor: 'end',
      modifier: (widget, vars) => {
        const t = Number(vars.mcu_stove_temp);
        if (isNaN(t)) return {};
        if (t >= 92) return { text: t.toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' °C', color: '#ffffff' };
        if (t >= 65) return { text: t.toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' °C', color: '#ff0000' };
        return { text: t.toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' °C', color: '#000000' };
      } },

    { type: "line", x1: 0, y1: 98, x2: 159, y2: 98, color: "#000000", width: 1 },

    // ── Binance ────────────────────────────────────────────────────
    { type: "text", x: 4,  y: 102,   text: "\uF108", fontSize: 24,  color: "#000000", fontFamily: "iconfont" },
    { type: "text", x: 33, y: 108,  text: "$",  fontSize: 8, color: "#000000", fontFamily: "Press Start 2P" },
    { type: "text", x: 153, y: 108,  text: "{btc}",  fontSize: 16, color: "#000000", fontFamily: "Press Start 2P", textAnchor: "end",
      modifier: (widget, vars) => {
        const n = Number(vars.btc);
        return isNaN(n) ? {} : { text: new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(n) };
      }
    },

    // ── Weather ───────────────────────────────────────────────────
    { type: "text", x: 294, y: 1, text: "\uF07B" /* N/A */, fontSize: 20,  color: "#000000", fontFamily: "Weather Icons", textAnchor: "end",
      modifier: (widget, vars) => {
        const errorData = { text: "\uF07B" /* N/A */, color: '#ff0000' };
        const codeNum = Number(vars.weather_code);
        if (isNaN(codeNum)) return errorData;
        const entry = lookupWeatherIcon(codeNum);
        if (!entry) return errorData;
        const { codePoint, isNight, isDangerous } = pickCodePoint(entry, new Date(), 'Europe/Berlin');
        if (!codePoint) return errorData;
        if (isDangerous) return { text: codePoint, color: '#ff0000' };
        return { text: codePoint };
      }
    },
    { type: "text", x: 165, y: 15, text: "{weather_temp} \u00b0C",     fontSize: 16, color: "#000000", fontFamily: "Press Start 2P",
      modifier: (widget, vars) => {
        const n = Number(vars.weather_temp);
        return isNaN(n) ? {} : { text: n.toLocaleString('de-DE', { maximumFractionDigits: 1 }) + '\u00b0C' };
      } },
    { type: "text", x: 167, y: 40, text: "{weather_cond}", fontSize: 8, color: "#000000", fontFamily: "Press Start 2P" },

    // ── Right column dividers ────────────────────────────────────────────────
    { type: "line", x1: 160, y1: 59,  x2: 296, y2: 59,  color: "#000000", width: 1 },

    // ── Last update ────────────────────────────────────────
    { type: "rect", x: 227, y: 110, w: 67, h: 17, fill: "#000000" },
    { type: "text", x: 232, y: 110, text: "Z", fontSize: 16,  color: "#ffffff", fontFamily: "Yarndings 12" },
    { type: "text", x: 289, y: 115, text: "{clock}", fontSize: 8, color: "#ffffff", fontFamily: "Press Start 2P", textAnchor: "end",
      modifier: () => ({
        text: new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }).format(new Date()),
      }) },

    // ── Tests ────────────────────────────────────────────────────
    { type: "text", x: 170, y: 69, text: "[uwxyz{q", fontSize: 16,  color: "#000000", fontFamily: "Yarndings 12" },
    { type: "text", x: 180, y: 95, text: "\uF1BE", fontSize: 24,  color: "#ff0000", fontFamily: "iconfont" },
  ],
};
