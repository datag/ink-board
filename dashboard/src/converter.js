// Converts a PNG buffer to a 4-bit indexed BMP by calling firmware/tools/png2bmp.sh.
import { execFile } from 'child_process';
import { writeFileSync, readFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

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
