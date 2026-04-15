// Renders an EJS template to a 296×128 PNG buffer via Puppeteer.
import puppeteer from 'puppeteer';
import ejs from 'ejs';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const DISPLAY_WIDTH  = 296;
const DISPLAY_HEIGHT = 128;

/**
 * Render an EJS template with the given data context and return a PNG Buffer.
 * @param {string} templatePath   absolute path to the .html.ejs file
 * @param {Record<string, string>} data  context passed into the template as `data`
 * @returns {Promise<Buffer>}
 */
export async function renderTemplate(templatePath, data) {
  const templateSrc = readFileSync(resolve(templatePath), 'utf8');
  const html = ejs.render(templateSrc, { data });

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: DISPLAY_WIDTH, height: DISPLAY_HEIGHT, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pngBuffer = await page.screenshot({ type: 'png' });
    return pngBuffer;
  } finally {
    await browser.close();
  }
}
