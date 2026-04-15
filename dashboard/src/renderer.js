// Renders an EJS template to a 296×128 PNG buffer via Puppeteer.
import puppeteer from 'puppeteer';
import ejs from 'ejs';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { resolve, join } from 'path';
import { tmpdir } from 'os';

const DISPLAY_WIDTH  = 296;
const DISPLAY_HEIGHT = 128;

// Fontconfig that tells FreeType to disable all anti-aliasing.
// Chrome on Linux uses the system FreeType stack and respects FONTCONFIG_FILE.
// Must include the system fonts.conf so Chrome can still find system fonts.
const FONTCONFIG_NO_AA = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <include ignore_missing="yes">/etc/fonts/fonts.conf</include>
  <match target="font">
    <edit name="antialias"  mode="assign"><bool>false</bool></edit>
    <edit name="hinting"    mode="assign"><bool>false</bool></edit>
    <edit name="rgba"       mode="assign"><const>none</const></edit>
    <edit name="lcdfilter"  mode="assign"><const>lcdnone</const></edit>
  </match>
</fontconfig>`;

/**
 * Render an EJS template with the given data context and return a PNG Buffer.
 * @param {string} templatePath   absolute path to the .html.ejs file
 * @param {Record<string, string>} data  context passed into the template as `data`
 * @returns {Promise<Buffer>}
 */
export async function renderTemplate(templatePath, data) {
  const templateSrc = readFileSync(resolve(templatePath), 'utf8');
  const html = ejs.render(templateSrc, { data });

  const fontconfigFile = join(tmpdir(), `inkboard-fonts-${process.pid}.conf`);
  writeFileSync(fontconfigFile, FONTCONFIG_NO_AA);

  const browser = await puppeteer.launch({
    headless: true,
    env: { ...process.env, FONTCONFIG_FILE: fontconfigFile },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-lcd-text',
      '--disable-font-subpixel-positioning',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: DISPLAY_WIDTH, height: DISPLAY_HEIGHT, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    return await page.screenshot({ type: 'png' });
  } finally {
    await browser.close();
    try { unlinkSync(fontconfigFile); } catch { /* ignore */ }
  }
}
