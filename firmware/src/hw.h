#pragma once
#include <Arduino.h>

enum Zone : int8_t { ZONE_NONE = -1, ZONE_LEFT = 0, ZONE_MID = 1, ZONE_RIGHT = 2 };
enum BootPress : uint8_t { BOOT_NONE, BOOT_SHORT, BOOT_LONG };

void hwBegin();
Zone hwReadTouch();          // one event per tap (fires on press)
BootPress hwReadBoot();      // short press, or held for 5 s
int  hwReadLdr();            // smoothed light-sensor value
void hwLed(uint8_t r, uint8_t g, uint8_t b);   // 0..255 each
void hwBacklight(uint8_t level);               // 0..255
