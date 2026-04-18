// Converts a PNG buffer to a 4-bit indexed BMP by calling firmware/tools/png2bmp.sh.
import { execFile } from 'child_process';
import { writeFileSync, readFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import { loadImage, createCanvas } from 'canvas';
import { Canvg } from 'canvg';
import { JSDOM } from 'jsdom';
import { DISPLAY_WIDTH, DISPLAY_HEIGHT } from './layout.js';

const execFileAsync = promisify(execFile);

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PNG2BMP   = join(REPO_ROOT, 'firmware', 'tools', 'png2bmp.sh');

/**
 * Convert a PNG Buffer to a 4-bit indexed BMP Buffer using png2bmp.sh.
 * Returns the BMP as a Buffer (and cleans up temp files).
 * @param {Buffer} pngBuffer
 * @returns {Promise<Buffer>}
 */
export async function pngToBmp(pngBuffer) {
  const tmpPng = join(tmpdir(), `inkboard-${process.pid}-${Date.now()}.png`);
  const tmpBmp = tmpPng.replace('.png', '.bmp');

  writeFileSync(tmpPng, pngBuffer);
  try {
    await execFileAsync('bash', [PNG2BMP, '--4bit', tmpPng, tmpBmp]);
    return readFileSync(tmpBmp);
  } finally {
    for (const f of [tmpPng, tmpBmp]) {
      try { unlinkSync(f); } catch { /* already gone */ }
    }
  }
}

/**
 * Convert an SVG string to a PNG Buffer using node-canvas's SVG image support.
 * @param {string} svgString
 * @returns {Promise<Buffer>}
 */
export async function svgToPng(svgString) {
  const canvas = createCanvas(DISPLAY_WIDTH, DISPLAY_HEIGHT);
  const ctx = canvas.getContext('2d');
  // Disable antialiasing similar to layoutToPng
  ctx.antialias = 'none';
  ctx.imageSmoothingEnabled = false;

  // Use canvg to render the SVG into the canvas context. Provide a DOMParser
  // implementation via svgdom so Canvg can parse the SVG in Node.
  // Provide a DOMParser from jsdom for Canvg to parse SVG in Node.
  try {
    const { window } = new JSDOM('<!doctype html><html><body></body></html>');
    const DOMParser = window.DOMParser;
    const v = await Canvg.fromString(ctx, svgString, { DOMParser });
    await v.render();
    return canvas.toBuffer('image/png');
  } catch (err) {
    // Fallback: rasterise via the image loader (data URL). This worked before
    // but may miss fonts if they are not embedded in the SVG.
    const dataUrl = 'data:image/svg+xml;base64,' + Buffer.from(svgString).toString('base64');
    const img = await loadImage(dataUrl);
    ctx.drawImage(img, 0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT);
    return canvas.toBuffer('image/png');
  }
}
