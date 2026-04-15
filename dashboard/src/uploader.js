// Uploads a BMP buffer to the ink-board device via POST /update.
const RETRY_COUNT   = 3;
const RETRY_DELAY_MS = 2000;

/**
 * @param {number} ms
 */
const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Upload a BMP Buffer to the device.
 * @param {string} deviceUrl   base URL, e.g. "http://192.168.1.x"
 * @param {Buffer} bmpBuffer
 */
export async function uploadBmp(deviceUrl, bmpBuffer) {
  const url = deviceUrl.replace(/\/$/, '') + '/update';

  for (let attempt = 1; attempt <= RETRY_COUNT; attempt++) {
    const form = new FormData();
    form.append('file', new Blob([bmpBuffer], { type: 'image/bmp' }), 'dashboard.bmp');

    const res = await fetch(url, { method: 'POST', body: form });
    if (res.ok) {
      const text = await res.text();
      console.log(`[upload] OK — device responded: ${text.trim()}`);
      return;
    }

    const errText = await res.text().catch(() => '(no body)');
    console.error(`[upload] attempt ${attempt}/${RETRY_COUNT} failed: HTTP ${res.status} — ${errText}`);
    if (attempt < RETRY_COUNT) await sleep(RETRY_DELAY_MS);
  }

  throw new Error(`Upload failed after ${RETRY_COUNT} attempts`);
}
