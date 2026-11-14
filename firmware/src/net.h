#pragma once
#include <Arduino.h>

// Wi-Fi (via WiFiManager captive portal), HTTP endpoint POST /state,
// mDNS name clawd-desk.local, NTP clock, and the same JSON over USB serial.
void netBegin();
void netLoop();
bool netConnected();
bool netSetupOpen();                  // setup hotspot is waiting for Wi-Fi details
String netIp();
bool netClock(char* out, size_t n);   // "14:32", false if time not synced yet
void netResetWifi();
