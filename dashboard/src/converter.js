// Converts SVG -> Canvas / PNG and provides in-memory BMP conversion.
import { loadImage, createCanvas } from 'canvas';
import { Canvg } from 'canvg';
import { JSDOM } from 'jsdom';
import { DISPLAY_WIDTH, DISPLAY_HEIGHT } from './layout.js';
import imageDataToBmp from './bmp-writer.js';

/**
 * Render an SVG string into a Canvas instance. Returns the canvas.
 * @param {string} svgString
 * @returns {Promise<import('canvas').Canvas>}
 */
export async function renderSvgToCanvas(svgString) {
  const canvas = createCanvas(DISPLAY_WIDTH, DISPLAY_HEIGHT);
  const ctx = canvas.getContext('2d');
  // Disable antialiasing similar to layoutToPng
  ctx.antialias = 'none';
  ctx.imageSmoothingEnabled = false;

  try {
    const { window } = new JSDOM('<!doctype html><html><body></body></html>');
    const DOMParser = window.DOMParser;
    const v = await Canvg.fromString(ctx, svgString, { DOMParser });
    await v.render();
    return canvas;
  } catch (err) {
    console.warn(`[warning] canvg or jsdom failed: ${err.message}. Falling back to data-URL rasterisation (may not respect registered fonts)`);
    const dataUrl = 'data:image/svg+xml;base64,' + Buffer.from(svgString).toString('base64');
    const img = await loadImage(dataUrl);
    ctx.drawImage(img, 0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT);
    return canvas;
  }
}

/**
 * Convert a Canvas instance to a PNG Buffer.
 * @param {import('canvas').Canvas} canvas
 * @returns {Buffer}
 */
export function canvasToPng(canvas) {
  return canvas.toBuffer('image/png');
}

/**
 * Convert a Canvas instance to a 4-bit BMP Buffer using the JS bmp-writer.
 * @param {import('canvas').Canvas} canvas
 * @returns {Promise<Buffer>}
 */
export async function canvasToBmp(canvas) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return imageDataToBmp(imageData);
}

/**
 * Convenience: render SVG and return BMP buffer in one call.
 * @param {string} svgString
 * @returns {Promise<Buffer>} BMP buffer
 */
export async function svgToBmp(svgString) {
  const canvas = await renderSvgToCanvas(svgString);
  return canvasToBmp(canvas);
}

/**
 * Convert an SVG string to a PNG Buffer using node-canvas's SVG image support.
 * Kept for compatibility / debug usage.
 * @param {string} svgString
 * @returns {Promise<Buffer>}
 */
export async function svgToPng(svgString) {
  const canvas = await renderSvgToCanvas(svgString);
  return canvasToPng(canvas);
}
