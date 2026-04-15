// Uploads a BMP buffer to the ink-board device via POST /update.
// Uses a manually-constructed multipart body so fetch sends Content-Length
// (not Transfer-Encoding: chunked), which ESP8266WebServer handles ~10x faster.
const RETRY_COUNT    = 3;
const RETRY_DELAY_MS = 2000;

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Build a multipart/form-data body as a single Buffer with known Content-Length.
 * @param {Buffer} bmpBuffer
 * @returns {{ body: Buffer, contentType: string }}
 */
function buildMultipart(bmpBuffer) {
  const boundary = `----InkBoardBoundary${Date.now()}`;
  const head = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="dashboard.bmp"\r\n` +
    `Content-Type: image/bmp\r\n` +
    `\r\n`
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    body: Buffer.concat([head, bmpBuffer, tail]),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

/**
 * Upload a BMP Buffer to the device.
 * @param {string} deviceUrl   base URL, e.g. "http://192.168.1.x"
 * @param {Buffer} bmpBuffer
 */
export async function uploadBmp(deviceUrl, bmpBuffer) {
  const url = deviceUrl.replace(/\/$/, '') + '/update';
  const { body, contentType } = buildMultipart(bmpBuffer);

  for (let attempt = 1; attempt <= RETRY_COUNT; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body,
    });
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
