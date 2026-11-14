#pragma once
// The device keeps the latest state pushed by the PC companion as one JSON
// document. Format: docs/protocol.md
#include <ArduinoJson.h>

extern JsonDocument g_state;
extern uint32_t g_stateVersion;   // bumps on every accepted update
extern uint32_t g_lastUpdateMs;   // millis() of the last update from the PC
extern bool g_haveLiveData;       // false while showing the built-in demo

bool applyStateJson(const char* json, size_t len);
void loadDemoState();

// Small helpers for reading the document.
const char* jstr(JsonVariantConst v, const char* def = "");
uint16_t jcolor(JsonVariantConst v, uint16_t def);
