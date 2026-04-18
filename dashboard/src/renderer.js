// Renders a layout + data context to a PNG buffer via node-canvas (Cairo).
// ctx.antialias = 'none' disables AA at the engine level — zero gray pixels.
import { createCanvas, registerFont } from 'canvas';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { DISPLAY_WIDTH, DISPLAY_HEIGHT } from './layout.js';

const HERE = dirname(fileURLToPath(import.meta.url));

// Register fonts
registerFont(resolve(HERE, '../fonts/Press_Start_2P/PressStart2P-Regular.ttf'), { family: 'Press Start 2P' });
registerFont(resolve(HERE, '../fonts/Yarndings_12/Yarndings12-Regular.ttf'), { family: 'Yarndings 12' });
registerFont(resolve(HERE, '../fonts/Pixel_Icon_Library/iconfont.ttf'), { family: 'iconfont' });

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
const escapeXml = s => String(s).replace(/[&<>"']/g, c => ESC[c]);

/**
 * Apply a widget's compiled modifier (if any) to produce a resolved widget config.
 * Returns a shallow-merged copy with any overrides the modifier returns.
 * Falls back to the original widget on error.
 * @param {import('./layout.js').Widget} widget
 * @param {Record<string, string>} data
 * @returns {import('./layout.js').Widget}
 */
function applyModifier(widget, data) {
  if (!widget._modifier) return widget;
  try {
    const overrides = widget._modifier(widget, data);
    return { ...widget, ...overrides };
  } catch (err) {
    console.warn(`[ink-board] modifier error on widget (type=${widget.type}): ${err.message}`);
    return widget;
  }
}

/**
 * Interpolate {key} placeholders in a text string using the data context.
 * @param {string} template
 * @param {Record<string, string>} data
 */
function interpolate(template, data) {
  return template.replace(/\{(\w+)\}/g, (_, key) => data[key] ?? `{${key}}`);
}

/**
 * Map canvas textAlign to SVG text-anchor.
 * @param {string} textAlign - Canvas textAlign value ('start', 'center', 'right')
 * @returns {string} SVG text-anchor value ('start', 'middle', 'end')
 */
function canvasAlignToSvgAnchor(textAlign) {
  const mapping = {
    'start': 'start',
    'center': 'middle',
    'right': 'end'
  };
  return mapping[textAlign] ?? 'start';
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
    const widget = applyModifier(w, data);
    switch (widget.type) {
      case 'rect': {
        const fill   = widget.fill   ?? 'none';
        const stroke = widget.stroke ?? 'none';
        const sw     = widget.strokeWidth ?? 1;
        lines.push(
          `  <rect x="${widget.x}" y="${widget.y}" width="${widget.w}" height="${widget.h}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`
        );
        break;
      }
      case 'line': {
        const color = widget.color ?? '#000000';
        const width = widget.width ?? 1;
        lines.push(
          `  <line x1="${widget.x1}" y1="${widget.y1}" x2="${widget.x2}" y2="${widget.y2}" stroke="${color}" stroke-width="${width}"/>`
        );
        break;
      }
      case 'text': {
        const color  = widget.color ?? '#000000';
        const bold   = widget.bold ? 'bold' : 'normal';
        const family = widget.fontFamily ?? 'monospace';
        const textAlign = canvasAlignToSvgAnchor(widget.textAlign ?? 'start');
        const value  = escapeXml(interpolate(widget.text, data));
        lines.push(
          `  <text x="${widget.x}" y="${widget.y}" font-family="${family}" font-size="${widget.fontSize}" font-weight="${bold}" fill="${color}" dominant-baseline="text-before-edge" text-anchor="${textAlign}">${value}</text>`
        );
        break;
      }
    }
  }

  lines.push('</svg>');
  return lines.join('\n');
}
