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

static void showText(const char* line1, const char* line2 = nullptr) {
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
    } while (display.nextPage());
}

// ── BMP pixel helper ──────────────────────────────────────────────────────────

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

// ── BMP upload state machine ──────────────────────────────────────────────────
// Processed chunk-by-chunk via the multipart upload handler, so the
// ESP8266WebServer never tries to buffer the full body in RAM.

static struct {
    uint8_t  hdr[54];       // file header (14 B) + DIB header (40 B)
    uint32_t hdrGot;
    uint32_t pixelOffset;   // byte offset to pixel data within the file
    uint32_t filePos;       // total bytes consumed so far
    int32_t  width, height;
    bool     topDown;
    uint32_t rowStride;     // bytes per row, padded to 4-byte boundary
    int32_t  fileRow;       // next row index to decode
    uint32_t rowGot;        // bytes collected in rowBuf so far
    uint8_t  rowBuf[900];   // buffer for one row (max 300 px × 3)
    bool     ok;
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
                if (bmp.hdr[0] != 'B' || bmp.hdr[1] != 'M') { bmp.ok = false; return; }
                bmp.pixelOffset = (uint32_t)bmp.hdr[10] | ((uint32_t)bmp.hdr[11]<<8)
                                | ((uint32_t)bmp.hdr[12]<<16) | ((uint32_t)bmp.hdr[13]<<24);
                int32_t w = (int32_t)((uint32_t)bmp.hdr[18] | ((uint32_t)bmp.hdr[19]<<8)
                                    | ((uint32_t)bmp.hdr[20]<<16) | ((uint32_t)bmp.hdr[21]<<24));
                int32_t h = (int32_t)((uint32_t)bmp.hdr[22] | ((uint32_t)bmp.hdr[23]<<8)
                                    | ((uint32_t)bmp.hdr[24]<<16) | ((uint32_t)bmp.hdr[25]<<24));
                uint16_t bpp   = (uint16_t)bmp.hdr[28] | ((uint16_t)bmp.hdr[29]<<8);
                uint32_t compr = (uint32_t)bmp.hdr[30] | ((uint32_t)bmp.hdr[31]<<8)
                               | ((uint32_t)bmp.hdr[32]<<16) | ((uint32_t)bmp.hdr[33]<<24);
                if (bpp != 24 || compr != 0) { bmp.ok = false; return; }
                bmp.topDown   = (h < 0);
                bmp.width     = w;
                bmp.height    = bmp.topDown ? -h : h;
                bmp.rowStride = ((uint32_t)w * 3 + 3) & ~3u;
                memset(black_plane, 0, PLANE_BYTES);
                memset(red_plane,   0, PLANE_BYTES);
            }
        } else if (bmp.filePos < bmp.pixelOffset) {
            // ── Skip any extra header bytes beyond 54 ─────────────────────────
            size_t skip = min(len, (size_t)(bmp.pixelOffset - bmp.filePos));
            bmp.filePos += skip; data += skip; len -= skip;
        } else {
            // ── Pixel data: assemble one row at a time ────────────────────────
            if (bmp.fileRow >= bmp.height) break;
            size_t n = min(len, (size_t)(bmp.rowStride - bmp.rowGot));
            memcpy(bmp.rowBuf + bmp.rowGot, data, n);
            bmp.rowGot += n; bmp.filePos += n; data += n; len -= n;

            if (bmp.rowGot == bmp.rowStride) {
                int32_t y = bmp.topDown ? bmp.fileRow : (bmp.height - 1 - bmp.fileRow);
                for (int32_t x = 0; x < bmp.width; x++)
                    paintPixel(x, y, bmp.rowBuf[x*3+2], bmp.rowBuf[x*3+1], bmp.rowBuf[x*3+0]);
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
        bmp.ok = true;
    } else if (up.status == UPLOAD_FILE_WRITE) {
        feedBmpChunk(up.buf, up.currentSize);
    } else if (up.status == UPLOAD_FILE_END) {
        Serial.printf("[upload] %u bytes, %dx%d ok=%d freeHeap=%u\n",
                      up.totalSize, bmp.width, bmp.height, bmp.ok, ESP.getFreeHeap());
    }
}

// Called after the upload completes — send response then refresh display.
void handleUpdate() {
    if (!bmp.ok || bmp.fileRow == 0) {
        server.send(400, "text/plain", "BMP decode error");
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
        "POST /update  — multipart BMP upload (296x128, 24-bit uncompressed)\n"
        "  curl -X POST http://<ip>/update -F file=@image.bmp\n"
        "POST /clear   — clear display\n");
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
        showText("WiFi failed!", "Check config.h");
        Serial.println("WiFi connection failed!");
        return;
    }

    String ip = WiFi.localIP().toString();
    Serial.printf("Connected! IP: %s  freeHeap=%u\n", ip.c_str(), ESP.getFreeHeap());
    showText("ink-board ready", ip.c_str());

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
