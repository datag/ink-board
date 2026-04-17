// ink-board — WiFi + HTTP /update endpoint
//
// Wiring (hardware SPI, NodeMCU 1.0 / ESP-12E):
//   VCC -> 3V3  GND -> GND
//   DIN -> D7/GPIO13  CLK -> D5/GPIO14  CS -> D8/GPIO15
//   DC  -> D2/GPIO4   RST -> D1/GPIO5   BUSY -> D6/GPIO12

#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <GxEPD2_3C.h>
#include <epd3c/GxEPD2_290_C90c.h>
#include "config.h"

// ── Display ──────────────────────────────────────────────────────────────────
#define EPD_CS   SS   // GPIO15 / D8
#define EPD_DC    4   // GPIO4  / D2
#define EPD_RST   5   // GPIO5  / D1
#define EPD_BUSY 12   // GPIO12 / D6

// page_height=8 keeps the display's internal buffers tiny (256 bytes vs 9472),
// freeing BSS memory for the heap.
GxEPD2_3C<GxEPD2_290_C90c, 8> display(
    GxEPD2_290_C90c(EPD_CS, EPD_DC, EPD_RST, EPD_BUSY));

static const uint16_t EPD_W       = 296;
static const uint16_t EPD_H       = 128;
static const uint16_t PLANE_BYTES = EPD_W / 8 * EPD_H;  // 4736

// ── Web server ────────────────────────────────────────────────────────────────
ESP8266WebServer server(80);

// ── Framebuffers (heap, allocated once at boot) ───────────────────────────────
static uint8_t* black_plane = nullptr;
static uint8_t* red_plane   = nullptr;

// ── Display helpers ───────────────────────────────────────────────────────────

static void renderPlanes() {
    display.setFullWindow();
    display.firstPage();
    do {
        display.fillScreen(GxEPD_WHITE);
        display.drawBitmap(0, 0, black_plane, EPD_W, EPD_H, GxEPD_BLACK);
        display.drawBitmap(0, 0, red_plane,   EPD_W, EPD_H, GxEPD_RED);
    } while (display.nextPage());
}

static void showText(const char* line1, const char* line2 = nullptr,
                     const char* line3 = nullptr) {
    display.setFullWindow();
    display.firstPage();
    do {
        display.fillScreen(GxEPD_WHITE);
        display.setTextColor(GxEPD_BLACK);
        display.setTextSize(2);
        display.setCursor(8, 16);
        display.print(line1);
        if (line2) {
            display.setCursor(8, 52);
            display.print(line2);
        }
        if (line3) {
            display.setCursor(8, 88);
            display.print(line3);
        }
    } while (display.nextPage());
}

static const char* wifiStatusName(uint8_t status) {
    switch (status) {
        case 0:   return "IDLE";
        case 1:   return "NO_SSID_AVAIL";
        case 2:   return "SCAN_DONE";
        case 4:   return "CONNECT_FAILED";
        case 5:   return "CONN_LOST";
        case 6:   return "DISCONNECTED";
        case 255: return "NO_SHIELD";
        default:  return "UNKNOWN";
    }
}

// ── BMP pixel helpers ─────────────────────────────────────────────────────────

static inline void paintPixel(int32_t x, int32_t y, uint8_t r, uint8_t g, uint8_t b) {
    if (x < 0 || x >= EPD_W || y < 0 || y >= EPD_H) return;
    uint32_t idx = (uint32_t)y * (EPD_W / 8) + (uint32_t)x / 8;
    uint8_t  bit = 0x80 >> (x % 8);
    if (r > 180 && g < 80 && b < 80) {
        red_plane[idx] |= bit;
    } else if (0.299f * r + 0.587f * g + 0.114f * b < 128.0f) {
        black_plane[idx] |= bit;
    }
}

// cls: 0 = white (no-op), 1 = black, 2 = red
static inline void paintPixelByClass(int32_t x, int32_t y, uint8_t cls) {
    if (x < 0 || x >= EPD_W || y < 0 || y >= EPD_H) return;
    uint32_t idx = (uint32_t)y * (EPD_W / 8) + (uint32_t)x / 8;
    uint8_t  bit = 0x80 >> (x % 8);
    if      (cls == 2) red_plane[idx]   |= bit;
    else if (cls == 1) black_plane[idx] |= bit;
}

// Classify an RGB color into 0=white, 1=black, 2=red
static inline uint8_t classifyColor(uint8_t r, uint8_t g, uint8_t b) {
    if (r > 180 && g < 80 && b < 80) return 2;
    if (0.299f * r + 0.587f * g + 0.114f * b < 128.0f) return 1;
    return 0;
}

// ── BMP upload state machine ──────────────────────────────────────────────────
// Processed chunk-by-chunk via the multipart upload handler, so the
// ESP8266WebServer never tries to buffer the full body in RAM.

static struct {
    uint8_t  hdr[54];           // file header (14 B) + DIB header (40 B)
    uint32_t hdrGot;
    uint32_t pixelOffset;       // byte offset to pixel data within the file
    uint32_t filePos;           // total bytes consumed so far
    int32_t  width, height;
    bool     topDown;
    uint16_t bpp;               // bits per pixel: 4, 8, or 24
    bool     indexed;           // true for 4-bit or 8-bit indexed modes
    uint8_t  colorClass[256];   // pre-classified palette: 0=white, 1=black, 2=red
    uint32_t colorTableGot;     // bytes of color table received so far
    uint32_t colorTableBytes;   // total color table size in bytes
    uint32_t rowStride;         // bytes per row, padded to 4-byte boundary
    int32_t  fileRow;           // next row index to decode
    uint32_t rowGot;            // bytes collected in rowBuf so far
    uint8_t  rowBuf[296];       // buffer for one row (max 296 px × 1 for 8-bit)
    bool     ok;
    const char* error;          // set when ok becomes false
} bmp;

static void feedBmpChunk(const uint8_t* data, size_t len) {
    if (!bmp.ok) return;

    while (len > 0) {
        if (bmp.hdrGot < 54) {
            // ── Collect 54-byte combined file+DIB header ──────────────────────
            size_t n = min(len, (size_t)(54 - bmp.hdrGot));
            memcpy(bmp.hdr + bmp.hdrGot, data, n);
            bmp.hdrGot += n; bmp.filePos += n; data += n; len -= n;

            if (bmp.hdrGot == 54) {
                if (bmp.hdr[0] != 'B' || bmp.hdr[1] != 'M') { bmp.ok = false; bmp.error = "not a BMP file"; return; }
                bmp.pixelOffset = (uint32_t)bmp.hdr[10] | ((uint32_t)bmp.hdr[11]<<8)
                                | ((uint32_t)bmp.hdr[12]<<16) | ((uint32_t)bmp.hdr[13]<<24);
                int32_t w = (int32_t)((uint32_t)bmp.hdr[18] | ((uint32_t)bmp.hdr[19]<<8)
                                    | ((uint32_t)bmp.hdr[20]<<16) | ((uint32_t)bmp.hdr[21]<<24));
                int32_t h = (int32_t)((uint32_t)bmp.hdr[22] | ((uint32_t)bmp.hdr[23]<<8)
                                    | ((uint32_t)bmp.hdr[24]<<16) | ((uint32_t)bmp.hdr[25]<<24));
                uint16_t bpp   = (uint16_t)bmp.hdr[28] | ((uint16_t)bmp.hdr[29]<<8);
                uint32_t compr = (uint32_t)bmp.hdr[30] | ((uint32_t)bmp.hdr[31]<<8)
                               | ((uint32_t)bmp.hdr[32]<<16) | ((uint32_t)bmp.hdr[33]<<24);
                if ((bpp != 4 && bpp != 8 && bpp != 24) || compr != 0) {
                    bmp.ok = false;
                    bmp.error = "need 4-bit, 8-bit, or 24-bit uncompressed BMP";
                    return;
                }
                bmp.topDown  = (h < 0);
                bmp.width    = w;
                bmp.height   = bmp.topDown ? -h : h;
                bmp.bpp      = bpp;
                bmp.indexed  = (bpp == 4 || bpp == 8);
                if      (bpp == 24) bmp.rowStride = ((uint32_t)w * 3 + 3) & ~3u;
                else if (bpp == 8)  bmp.rowStride = ((uint32_t)w     + 3) & ~3u;
                else                bmp.rowStride = (((uint32_t)w + 1) / 2 + 3) & ~3u;
                bmp.colorTableBytes = bmp.indexed ? (bmp.pixelOffset - 54) : 0;
                memset(black_plane, 0, PLANE_BYTES);
                memset(red_plane,   0, PLANE_BYTES);
            }
        } else if (bmp.indexed && bmp.colorTableGot < bmp.colorTableBytes) {
            // ── Read color table, pre-classify each 4-byte BGRA entry ─────────
            while (len > 0 && bmp.colorTableGot < bmp.colorTableBytes) {
                uint32_t entryIdx   = bmp.colorTableGot / 4;
                uint32_t byteInEntry = bmp.colorTableGot % 4;
                // rowBuf used as 4-byte scratch — safe, always within bounds
                bmp.rowBuf[byteInEntry] = *data++;
                bmp.colorTableGot++; bmp.filePos++; len--;
                if (byteInEntry == 3 && entryIdx < 256) {
                    // rowBuf layout: [0]=B [1]=G [2]=R [3]=reserved
                    bmp.colorClass[entryIdx] = classifyColor(bmp.rowBuf[2], bmp.rowBuf[1], bmp.rowBuf[0]);
                }
            }
        } else if (bmp.filePos < bmp.pixelOffset) {
            // ── Skip any extra bytes between color table and pixel data ────────
            size_t skip = min(len, (size_t)(bmp.pixelOffset - bmp.filePos));
            bmp.filePos += skip; data += skip; len -= skip;
        } else if (bmp.bpp == 24) {
            // ── 24-bit pixels: process one pixel (3 bytes) at a time ──────────
            // rowBuf[0..2] used as a 3-byte pixel accumulator; no full-row buffer
            // needed, so rowBuf[296] is sufficient even for 24-bit.
            uint32_t pixBytes = (uint32_t)bmp.width * 3;
            while (len > 0 && bmp.fileRow < bmp.height) {
                if (bmp.rowGot < pixBytes) {
                    uint32_t byteInPix = bmp.rowGot % 3;
                    bmp.rowBuf[byteInPix] = *data++;
                    bmp.rowGot++; bmp.filePos++; len--;
                    if (byteInPix == 2) {
                        int32_t y = bmp.topDown ? bmp.fileRow : (bmp.height - 1 - bmp.fileRow);
                        int32_t x = (int32_t)(bmp.rowGot / 3) - 1;
                        paintPixel(x, y, bmp.rowBuf[2], bmp.rowBuf[1], bmp.rowBuf[0]);
                    }
                } else {
                    // Skip row padding bytes (0–3 bytes to reach 4-byte boundary)
                    size_t skip = min(len, (size_t)(bmp.rowStride - bmp.rowGot));
                    bmp.rowGot += skip; bmp.filePos += skip; data += skip; len -= skip;
                }
                if (bmp.rowGot == bmp.rowStride) { bmp.fileRow++; bmp.rowGot = 0; }
            }
        } else {
            // ── Indexed pixels (4-bit / 8-bit): buffer full row then decode ────
            if (bmp.fileRow >= bmp.height) break;
            size_t n = min(len, (size_t)(bmp.rowStride - bmp.rowGot));
            memcpy(bmp.rowBuf + bmp.rowGot, data, n);
            bmp.rowGot += n; bmp.filePos += n; data += n; len -= n;

            if (bmp.rowGot == bmp.rowStride) {
                int32_t y = bmp.topDown ? bmp.fileRow : (bmp.height - 1 - bmp.fileRow);
                if (bmp.bpp == 8) {
                    for (int32_t x = 0; x < bmp.width; x++)
                        paintPixelByClass(x, y, bmp.colorClass[bmp.rowBuf[x]]);
                } else {  // 4-bit: two pixels per byte, high nibble first
                    for (int32_t x = 0; x < bmp.width; x++) {
                        uint8_t b  = bmp.rowBuf[x / 2];
                        uint8_t idx = (x & 1) ? (b & 0x0F) : (b >> 4);
                        paintPixelByClass(x, y, bmp.colorClass[idx]);
                    }
                }
                bmp.fileRow++;
                bmp.rowGot = 0;
            }
        }
    }
}

// ── HTTP handlers ─────────────────────────────────────────────────────────────

// Upload callback: receives the BMP in 1460-byte (max) chunks via multipart.
// ESP8266WebServer uses isForm=true for multipart, so it never buffers the body.
void handleUpload() {
    HTTPUpload& up = server.upload();
    if (up.status == UPLOAD_FILE_START) {
        memset(&bmp, 0, sizeof(bmp));
        bmp.ok    = true;
        bmp.error = nullptr;
    } else if (up.status == UPLOAD_FILE_WRITE) {
        feedBmpChunk(up.buf, up.currentSize);
    } else if (up.status == UPLOAD_FILE_END) {
        Serial.printf("[upload] %u bytes, %dx%d ok=%d freeHeap=%u\n",
                      up.totalSize, bmp.width, bmp.height, bmp.ok, ESP.getFreeHeap());
    }
}

// Called after the upload completes — send response then refresh display.
void handleUpdate() {
    if (!bmp.ok) {
        String msg = "BMP format error: ";
        msg += bmp.error ? bmp.error : "unknown";
        server.send(400, "text/plain", msg);
        return;
    }
    if (bmp.fileRow == 0) {
        server.send(400, "text/plain", "BMP decode error: no rows decoded (truncated upload?)");
        return;
    }
    server.send(200, "text/plain", "OK");
    server.client().flush();
    renderPlanes();
}

void handleClear() {
    memset(black_plane, 0, PLANE_BYTES);
    memset(red_plane,   0, PLANE_BYTES);
    server.send(200, "text/plain", "Clearing...");
    server.client().flush();
    display.setFullWindow();
    display.firstPage();
    do { display.fillScreen(GxEPD_WHITE); } while (display.nextPage());
}

void handleRoot() {
    server.send(200, "text/plain",
        "ink-board\n"
        "POST /update  — multipart BMP upload (296x128, 4/8/24-bit uncompressed)\n"
        "POST /clear   — clear display\n"
        "\n"
        "Convert PNG to compatible BMP (requires ImageMagick):\n"
        "  # 4-bit indexed ~19KB (preferred):\n"
        "  tools/png2bmp.sh input.png output.bmp\n"
        "  # 8-bit indexed ~38KB:\n"
        "  tools/png2bmp.sh --8bit input.png output.bmp\n"
        "  # 24-bit ~113KB (legacy):\n"
        "  tools/png2bmp.sh --24bit input.png output.bmp\n"
        "\n"
        "Upload:\n"
        "  curl http://<ip>/update -F \"file=@output.bmp;type=image/bmp\"\n");
}

// ── Setup ─────────────────────────────────────────────────────────────────────

void setup() {
    Serial.begin(115200);
    delay(500);

    black_plane = new uint8_t[PLANE_BYTES]();
    red_plane   = new uint8_t[PLANE_BYTES]();

    display.init(115200, true, 2, false);
    display.setRotation(1);

    showText("Connecting...", WIFI_SSID);
    Serial.printf("Connecting to %s\n", WIFI_SSID);

    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASS);

    uint32_t t = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - t < 20000) {
        delay(500); Serial.print('.');
    }
    Serial.println();

    if (WiFi.status() != WL_CONNECTED) {
        uint8_t st = (uint8_t)WiFi.status();
        char errBuf[32];
        snprintf(errBuf, sizeof(errBuf), "Err %d: %s", st, wifiStatusName(st));
        showText("WiFi failed!", errBuf);
        Serial.println("WiFi connection failed!");
        return;
    }

    String ip = WiFi.localIP().toString();
    char infoBuf[24];
    snprintf(infoBuf, sizeof(infoBuf), "%d dBm  CH%d", WiFi.RSSI(), WiFi.channel());
    Serial.printf("Connected! IP: %s  RSSI: %d dBm  CH%d  freeHeap=%u\n",
                  ip.c_str(), WiFi.RSSI(), WiFi.channel(), ESP.getFreeHeap());
    showText("ink-board ready", ip.c_str(), infoBuf);

    server.collectHeaders("Content-Length", "Content-Type");
    server.on("/",       HTTP_GET,  handleRoot);
    server.on("/update", HTTP_POST, handleUpdate, handleUpload);
    server.on("/clear",  HTTP_POST, handleClear);
    server.begin();
    Serial.println("HTTP server started");
}

void loop() {
    server.handleClient();
}
