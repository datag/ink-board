#include <Arduino.h>

// Simple LED blink demo for NodeMCU v2 (ESP8266)
// Uses LED_BUILTIN; many ESP8266 boards have an active-low built-in LED.

const uint8_t LED_PIN = LED_BUILTIN;
const unsigned long ON_MS = 500;
const unsigned long OFF_MS = 500;

void setup() {
  pinMode(LED_PIN, OUTPUT);
  // Ensure LED is off at startup (active-low)
  digitalWrite(LED_PIN, HIGH);
}

void loop() {
  // Turn LED on (active-low)
  digitalWrite(LED_PIN, LOW);
  delay(ON_MS);
  // Turn LED off
  digitalWrite(LED_PIN, HIGH);
  delay(OFF_MS);
}
