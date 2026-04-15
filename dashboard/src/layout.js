// Loads and validates a JSON5 layout file.
import { readFileSync } from 'fs';
import { resolve } from 'path';
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
 */

/**
 * @typedef {Object} Layout
 * @property {string}   background
 * @property {Widget[]} widgets
 */

/**
 * Load and validate a JSON5 layout file.
 * @param {string} layoutPath  absolute path to the layout JSON5 file
 * @returns {Layout}
 */
export function loadLayout(layoutPath) {
  const raw = readFileSync(resolve(layoutPath), 'utf8');
  const layout = JSON5.parse(raw);

  assertColor(layout.background ?? '#ffffff', 'layout.background');

  if (!Array.isArray(layout.widgets) || layout.widgets.length === 0) {
    throw new Error('Layout must have at least one widget');
  }
  layout.widgets.forEach(validateWidget);

  return layout;
}
