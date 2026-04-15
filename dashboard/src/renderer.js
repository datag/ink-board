// Renders a layout + data context to a PNG buffer via node-canvas (Cairo).
// ctx.antialias = 'none' disables AA at the engine level — zero gray pixels.
import { createCanvas, registerFont } from 'canvas';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { DISPLAY_WIDTH, DISPLAY_HEIGHT } from './layout.js';

const HERE = dirname(fileURLToPath(import.meta.url));

// Register Press Start 2P — pixel font, renders perfectly with antialias='none'.
// 8px = Adafruit GFX size 1, 16px = Adafruit GFX size 2.
registerFont(resolve(HERE, '../fonts/PressStart2P-Regular.ttf'), { family: 'Press Start 2P' });

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
const escapeXml = s => String(s).replace(/[&<>"']/g, c => ESC[c]);

/**
 * Interpolate {key} placeholders in a text string using the data context.
 * @param {string} template
 * @param {Record<string, string>} data
 */
function interpolate(template, data) {
  return template.replace(/\{(\w+)\}/g, (_, key) => data[key] ?? `{${key}}`);
}

/**
 * Convert a validated layout + data context to an SVG string (for debug.svg).
 * @param {import('./layout.js').Layout} layout
 * @param {Record<string, string>} data
 * @returns {string}
 */
export function layoutToSvg(layout, data) {
  const bg = layout.background ?? '#ffffff';
  const lines = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${DISPLAY_WIDTH}" height="${DISPLAY_HEIGHT}" shape-rendering="crispEdges" text-rendering="optimizeSpeed">`,
    `  <rect x="0" y="0" width="${DISPLAY_WIDTH}" height="${DISPLAY_HEIGHT}" fill="${bg}"/>`,
  ];

  for (const w of layout.widgets) {
    switch (w.type) {
      case 'rect': {
        const fill   = w.fill   ?? 'none';
        const stroke = w.stroke ?? 'none';
        const sw     = w.strokeWidth ?? 1;
        lines.push(
          `  <rect x="${w.x}" y="${w.y}" width="${w.w}" height="${w.h}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`
        );
        break;
      }
      case 'line': {
        const color = w.color ?? '#000000';
        const width = w.width ?? 1;
        lines.push(
          `  <line x1="${w.x1}" y1="${w.y1}" x2="${w.x2}" y2="${w.y2}" stroke="${color}" stroke-width="${width}"/>`
        );
        break;
      }
      case 'text': {
        const color  = w.color ?? '#000000';
        const bold   = w.bold ? 'bold' : 'normal';
        const family = w.fontFamily ?? 'monospace';
        const value  = escapeXml(interpolate(w.text, data));
        lines.push(
          `  <text x="${w.x}" y="${w.y}" font-family="${family}" font-size="${w.fontSize}" font-weight="${bold}" fill="${color}" dominant-baseline="text-before-edge">${value}</text>`
        );
        break;
      }
    }
  }

  lines.push('</svg>');
  return lines.join('\n');
}

/**
 * Render a layout + data context to a PNG Buffer using node-canvas (Cairo).
 * Anti-aliasing is disabled at the Cairo context level.
 * @param {import('./layout.js').Layout} layout
 * @param {Record<string, string>} data
 * @returns {Buffer}
 */
export function layoutToPng(layout, data) {
  const canvas = createCanvas(DISPLAY_WIDTH, DISPLAY_HEIGHT);
  const ctx = canvas.getContext('2d');

  ctx.antialias         = 'none';
  ctx.imageSmoothingEnabled = false;

  // Background
  ctx.fillStyle = layout.background ?? '#ffffff';
  ctx.fillRect(0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT);

  for (const w of layout.widgets) {
    switch (w.type) {
      case 'rect': {
        if (w.fill) {
          ctx.fillStyle = w.fill;
          ctx.fillRect(w.x, w.y, w.w, w.h);
        }
        if (w.stroke) {
          ctx.strokeStyle = w.stroke;
          ctx.lineWidth   = w.strokeWidth ?? 1;
          ctx.strokeRect(w.x, w.y, w.w, w.h);
        }
        break;
      }
      case 'line': {
        ctx.strokeStyle = w.color ?? '#000000';
        ctx.lineWidth   = w.width ?? 1;
        ctx.beginPath();
        ctx.moveTo(w.x1, w.y1);
        ctx.lineTo(w.x2, w.y2);
        ctx.stroke();
        break;
      }
      case 'text': {
        const bold   = w.bold ? 'bold ' : '';
        const family = w.fontFamily ?? 'monospace';
        // Quote family names that contain spaces (CSS font shorthand requirement)
        const quotedFamily = family.includes(' ') ? `"${family}"` : family;
        ctx.font         = `${bold}${w.fontSize}px ${quotedFamily}`;
        ctx.fillStyle    = w.color ?? '#000000';
        ctx.textBaseline = 'top';
        ctx.fillText(interpolate(w.text, data), w.x, w.y);
        break;
      }
    }
  }

  return canvas.toBuffer('image/png');
}
