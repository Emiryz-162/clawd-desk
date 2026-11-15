#include "hw.h"
#include <SPI.h>
#include <XPT2046_Touchscreen.h>
#include "config.h"

static SPIClass touchSpi(VSPI);
static XPT2046_Touchscreen ts(PIN_TOUCH_CS, PIN_TOUCH_IRQ);
static bool wasTouched = false;
static uint32_t lastTouchMs = 0;

static bool bootDown = false;
static bool bootLongFired = false;
static uint32_t bootDownMs = 0;

static float ldrAvg = -1;

// LEDC channels (0 is left free for anything else)
enum { CH_R = 1, CH_G = 2, CH_B = 3, CH_BL = 4 };

void hwBegin() {
  touchSpi.begin(PIN_TOUCH_CLK, PIN_TOUCH_MISO, PIN_TOUCH_MOSI, PIN_TOUCH_CS);
  ts.begin(touchSpi);
  ts.setRotation(1);

  pinMode(PIN_BOOT, INPUT_PULLUP);
  pinMode(PIN_LDR, INPUT);
  analogSetPinAttenuation(PIN_LDR, ADC_0db);

  // RGB LED is active-low
  ledcSetup(CH_R, 5000, 8); ledcAttachPin(PIN_LED_R, CH_R);
  ledcSetup(CH_G, 5000, 8); ledcAttachPin(PIN_LED_G, CH_G);
  ledcSetup(CH_B, 5000, 8); ledcAttachPin(PIN_LED_B, CH_B);
  hwLed(0, 0, 0);

  ledcSetup(CH_BL, 5000, 8);
  ledcAttachPin(PIN_BACKLIGHT, CH_BL);
  hwBacklight(BL_DAY);
}

Zone hwReadTouch() {
  const bool touched = ts.tirqTouched() && ts.touched();
  Zone z = ZONE_NONE;
  if (touched && !wasTouched && millis() - lastTouchMs > 200) {
    TS_Point p = ts.getPoint();
    int x = map(p.x, TOUCH_X_MIN, TOUCH_X_MAX, 0, 320);
    if (TOUCH_FLIP_X) x = 320 - x;
    x = constrain(x, 0, 319);
    z = x < 107 ? ZONE_LEFT : (x < 213 ? ZONE_MID : ZONE_RIGHT);
    lastTouchMs = millis();
#if TOUCH_DEBUG
    Serial.printf("[touch] raw x=%d y=%d z=%d -> x=%d zone=%d\n", p.x, p.y, p.z, x, z);
#endif
  }
  wasTouched = touched;
  return z;
}

BootPress hwReadBoot() {
  const bool down = digitalRead(PIN_BOOT) == LOW;
  BootPress r = BOOT_NONE;
  if (down && !bootDown) {
    bootDownMs = millis();
    bootLongFired = false;
  } else if (down && !bootLongFired && millis() - bootDownMs > 5000) {
    bootLongFired = true;
    r = BOOT_LONG;
  } else if (!down && bootDown && !bootLongFired) {
    const uint32_t held = millis() - bootDownMs;
    if (held >= 1500) r = BOOT_MEDIUM;
    else if (held > 30) r = BOOT_SHORT;
  }
  bootDown = down;
  return r;
}

int hwReadLdr() {
  const int v = analogRead(PIN_LDR);
  ldrAvg = ldrAvg < 0 ? v : ldrAvg * 0.9f + v * 0.1f;
  return static_cast<int>(ldrAvg);
}

void hwLed(uint8_t r, uint8_t g, uint8_t b) {
  ledcWrite(CH_R, 255 - r);
  ledcWrite(CH_G, 255 - g);
  ledcWrite(CH_B, 255 - b);
}

void hwBacklight(uint8_t level) { ledcWrite(CH_BL, level); }
