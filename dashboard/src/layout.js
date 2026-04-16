// Loads and validates a layout file (.js or .json5).
import { readFileSync } from 'fs';
import { resolve, extname } from 'path';
import { pathToFileURL } from 'url';
import JSON5 from 'json5';

export const DISPLAY_WIDTH  = 296;
export const DISPLAY_HEIGHT = 128;
const VALID_COLORS = new Set(['#000000', '#ffffff', '#ff0000']);
const VALID_TYPES  = new Set(['rect', 'line', 'text']);

function assertColor(val, label) {
  if (!VALID_COLORS.has(val?.toLowerCase())) {
    throw new Error(`${label}: color "${val}" is not allowed — use #000000, #ffffff, or #ff0000`);
  }
}

function validateWidget(w, i) {
  const label = `widgets[${i}]`;
  if (!VALID_TYPES.has(w.type)) throw new Error(`${label}: unknown type "${w.type}"`);

  if (w.modifier != null) {
    if (typeof w.modifier === 'function') {
      // Native function from a .js layout — use directly.
      w._modifier = w.modifier;
    } else if (typeof w.modifier === 'string') {
      // String form from a .json5 layout — compile at load time.
      try {
        // eslint-disable-next-line no-new-func
        w._modifier = new Function(`return (${w.modifier})`)();
        if (typeof w._modifier !== 'function') {
          throw new TypeError('modifier did not evaluate to a function');
        }
      } catch (err) {
        throw new Error(`${label}: modifier failed to compile: ${err.message}`);
      }
    } else {
      throw new Error(`${label}: modifier must be a function or a function string`);
    }
  }

  switch (w.type) {
    case 'rect':
      for (const f of ['x', 'y', 'w', 'h']) {
        if (typeof w[f] !== 'number') throw new Error(`${label} rect: missing numeric "${f}"`);
      }
      if (w.fill)   assertColor(w.fill,   `${label} rect.fill`);
      if (w.stroke) assertColor(w.stroke, `${label} rect.stroke`);
      break;

    case 'line':
      for (const f of ['x1', 'y1', 'x2', 'y2']) {
        if (typeof w[f] !== 'number') throw new Error(`${label} line: missing numeric "${f}"`);
      }
      assertColor(w.color ?? '#000000', `${label} line.color`);
      break;

    case 'text':
      for (const f of ['x', 'y', 'text']) {
        if (w[f] == null) throw new Error(`${label} text: missing "${f}"`);
      }
      if (typeof w.fontSize !== 'number') throw new Error(`${label} text: missing numeric "fontSize"`);
      assertColor(w.color ?? '#000000', `${label} text.color`);
      break;
  }
}

/**
 * @typedef {Object} Widget
 * @property {'rect'|'line'|'text'} type
 * @property {((widget: Widget, vars: Record<string, string>) => Partial<Widget>) | string} [modifier]
 *   Optional function (or function string for JSON5 layouts) that receives the widget config and
 *   data variables, and returns an object of property overrides applied before rendering.
 */

/**
 * @typedef {Object} Layout
 * @property {string}   background
 * @property {Widget[]} widgets
 */

/**
 * Load and validate a layout file. Supports .js (ES module) and .json5 formats.
 * @param {string} layoutPath  absolute path to the layout file
 * @returns {Promise<Layout>}
 */
export async function loadLayout(layoutPath) {
  const abs = resolve(layoutPath);
  let layout;

  if (extname(abs) === '.js') {
    const mod = await import(pathToFileURL(abs).href);
    layout = mod.default ?? mod;
  } else {
    const raw = readFileSync(abs, 'utf8');
    layout = JSON5.parse(raw);
  }

  assertColor(layout.background ?? '#ffffff', 'layout.background');

  if (!Array.isArray(layout.widgets) || layout.widgets.length === 0) {
    throw new Error('Layout must have at least one widget');
  }
  layout.widgets.forEach(validateWidget);

  return layout;
}
