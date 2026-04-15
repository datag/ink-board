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
#include <pngle.h>
#include "config.h"

// ── Display ──────────────────────────────────────────────────────────────────
#define EPD_CS   SS   // GPIO15 / D8
#define EPD_DC    4   // GPIO4  / D2
#define EPD_RST   5   // GPIO5  / D1
#define EPD_BUSY 12   // GPIO12 / D6

GxEPD2_3C<GxEPD2_290_C90c, GxEPD2_290_C90c::HEIGHT> display(
    GxEPD2_290_C90c(EPD_CS, EPD_DC, EPD_RST, EPD_BUSY));

static const uint16_t EPD_W = 296;
static const uint16_t EPD_H = 128;
static const uint16_t PLANE_BYTES = EPD_W / 8 * EPD_H;  // 4736

// ── Web server ────────────────────────────────────────────────────────────────
ESP8266WebServer server(80);

// ── Framebuffers (heap, allocated once) ──────────────────────────────────────
static uint8_t* black_plane = nullptr;
static uint8_t* red_plane   = nullptr;

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── pngle callbacks ───────────────────────────────────────────────────────────

static void pngle_on_draw(pngle_t* pngle, uint32_t x, uint32_t y,
                           uint32_t w, uint32_t h, const uint8_t rgba[4]) {
    if (x >= EPD_W || y >= EPD_H) return;

    uint8_t r = rgba[0], g = rgba[1], b = rgba[2];
    uint32_t idx = y * (EPD_W / 8) + x / 8;
    uint8_t  bit = 0x80 >> (x % 8);

    if (r > 180 && g < 80 && b < 80) {
        red_plane[idx] |= bit;
    } else {
        float brightness = 0.299f * r + 0.587f * g + 0.114f * b;
        if (brightness < 128.0f) black_plane[idx] |= bit;
    }
}

// ── HTTP handlers ─────────────────────────────────────────────────────────────

void handleUpdate() {
    if (!server.hasArg("plain") || server.arg("plain").length() == 0) {
        server.send(400, "text/plain", "No body");
        return;
    }

    const String& body = server.arg("plain");
    size_t len = body.length();

    memset(black_plane, 0, PLANE_BYTES);
    memset(red_plane,   0, PLANE_BYTES);

    pngle_t* pngle = pngle_new();
    if (!pngle) {
        server.send(500, "text/plain", "OOM");
        return;
    }
    pngle_set_draw_callback(pngle, pngle_on_draw);

    int fed = pngle_feed(pngle, body.c_str(), len);
    pngle_destroy(pngle);

    if (fed < 0) {
        server.send(400, "text/plain", String("PNG error: ") + pngle_error(pngle));
        return;
    }

    Serial.printf("[update] decoded %u bytes, rendering...\n", len);
    renderPlanes();
    Serial.println("[update] done");
    server.send(200, "text/plain", "OK");
}

void handleClear() {
    memset(black_plane, 0, PLANE_BYTES);
    memset(red_plane,   0, PLANE_BYTES);
    display.setFullWindow();
    display.firstPage();
    do { display.fillScreen(GxEPD_WHITE); } while (display.nextPage());
    server.send(200, "text/plain", "Cleared");
}

void handleRoot() {
    server.send(200, "text/plain",
        "ink-board\n"
        "POST /update  — PNG body (296x128, 3-color)\n"
        "POST /clear   — clear display\n");
}

// ── Setup ─────────────────────────────────────────────────────────────────────

void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.println(F("\n--- ink-board boot ---"));

    // Allocate framebuffers
    black_plane = new uint8_t[PLANE_BYTES]();
    red_plane   = new uint8_t[PLANE_BYTES]();

    // Init display
    display.init(115200, true, 2, false);
    display.setRotation(1);  // landscape

    // Show connecting status
    showText("Connecting...", WIFI_SSID);
    Serial.printf("Connecting to %s\n", WIFI_SSID);

    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASS);

    uint32_t t = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - t < 20000) {
        delay(500);
        Serial.print('.');
    }
    Serial.println();

    if (WiFi.status() != WL_CONNECTED) {
        showText("WiFi failed!", "Check config.h");
        Serial.println("WiFi connection failed!");
        return;
    }

    String ip = WiFi.localIP().toString();
    Serial.printf("Connected! IP: %s\n", ip.c_str());
    showText("ink-board ready", ip.c_str());

    // Start server
    server.on("/",       HTTP_GET,  handleRoot);
    server.on("/update", HTTP_POST, handleUpdate);
    server.on("/clear",  HTTP_POST, handleClear);
    server.begin();
    Serial.println("HTTP server started");
}

void loop() {
    server.handleClient();
}
