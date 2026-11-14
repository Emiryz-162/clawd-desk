#pragma once
// ---------------------------------------------------------------------------
//  Clawd Desk — settings you are most likely to tweak live here.
// ---------------------------------------------------------------------------
#include <Arduino.h>

// Network
#define CLAWD_HOSTNAME   "clawd-desk"          // -> http://clawd-desk.local
#define CLAWD_AP_NAME    "ClawdDesk-Kurulum"   // Wi-Fi setup hotspot name
#define CLAWD_TZ         "<+03>-3"             // POSIX TZ string (Türkiye = UTC+3)

// Timing (milliseconds)
#define ROTATE_MS        10000   // auto-rotation between Home / Limits / Live
#define BACK_HOME_MS     15000   // list & detail fall back to Home after this
#define DONE_SHOW_MS      6000   // "Bitti!" celebration length
#define ANIM_MS            280   // Clawd animation frame time
#define STALE_MS        300000   // no data for 5 min -> "BAĞLANTI YOK"
#define LIMIT_ALERT_PCT     90   // jump to Limits once when a window crosses this

// Night mode via the on-board light sensor (LDR, GPIO34).
// Higher reading = darker room on most CYD boards. Watch the serial monitor
// ("ldr=...") to pick your own threshold.
#define NIGHT_ENABLED        1
#define LDR_NIGHT_ABOVE    350
#define NIGHT_HOLD_MS    10000
#define NIGHT_WAKE_MS    30000   // a tap at night wakes the screen this long
#define BL_DAY             255   // backlight 0..255
#define BL_NIGHT            18

// RGB LED brightness 0..255 (it is bright; keep it low)
#define LED_MAX             60

// Touch: only the X axis matters (three vertical zones), so calibration is
// forgiving. Set TOUCH_DEBUG 1 and read the raw values on the serial monitor.
#define TOUCH_X_MIN        300
#define TOUCH_X_MAX       3800
#define TOUCH_FLIP_X         0
#define TOUCH_DEBUG          0

// Pins (ESP32-2432S028R)
#define PIN_TOUCH_CS        33
#define PIN_TOUCH_IRQ       36
#define PIN_TOUCH_MOSI      32
#define PIN_TOUCH_MISO      39
#define PIN_TOUCH_CLK       25
#define PIN_LED_R            4
#define PIN_LED_G           16
#define PIN_LED_B           17
#define PIN_LDR             34
#define PIN_BOOT             0
#define PIN_BACKLIGHT       21

// ---------------------------------------------------------------------------
//  Palette (same as the design canvas)
// ---------------------------------------------------------------------------
constexpr uint16_t rgb(uint32_t h) {
  return ((h >> 8) & 0xF800) | ((h >> 5) & 0x07E0) | ((h >> 3) & 0x001F);
}
constexpr uint16_t C_BG        = rgb(0x141413);
constexpr uint16_t C_PANEL     = rgb(0x1F1E1C);
constexpr uint16_t C_TRACK     = rgb(0x34322E);
constexpr uint16_t C_TEXT      = rgb(0xFAF9F5);
constexpr uint16_t C_MUTED     = rgb(0xA8A49C);
constexpr uint16_t C_SOFT      = rgb(0xCFCBC2);
constexpr uint16_t C_CLAY      = rgb(0xD97757);
constexpr uint16_t C_CLAY_LT   = rgb(0xE08A6B);
constexpr uint16_t C_CLAY_DK   = rgb(0xA9553A);
constexpr uint16_t C_CODEX     = rgb(0x7FA7D9);
constexpr uint16_t C_AMBER     = rgb(0xF2C14E);
constexpr uint16_t C_GREEN     = rgb(0x8FC27A);
constexpr uint16_t C_IDLE      = rgb(0x6B6862);
constexpr uint16_t C_DOT_OFF   = rgb(0x4A4844);
constexpr uint16_t C_ROW       = rgb(0x1A1917);
constexpr uint16_t C_ROW_SEL   = rgb(0x2A2825);
constexpr uint16_t C_ROW_LINE  = rgb(0x262421);
constexpr uint16_t C_NIGHT_TXT = rgb(0x8A8680);
constexpr uint16_t C_NIGHT_CLD = rgb(0x7A4532);
constexpr uint16_t C_BLACK     = 0x0000;

// Fonts (u8g2 "_te" fonts include Turkish letters: ğ ş ı İ ö ü ç)
#define F_LABEL   u8g2_font_helvB08_te
#define F_SMALL   u8g2_font_helvR08_te
#define F_MONO    u8g2_font_6x12_te
#define F_BODY    u8g2_font_helvR10_te
#define F_BODY_B  u8g2_font_helvB10_te
#define F_MED     u8g2_font_helvB12_te
#define F_LARGE   u8g2_font_helvB14_te
#define F_XL      u8g2_font_helvB18_te
#define F_XXL     u8g2_font_helvB24_te
#define F_CLOCK   u8g2_font_logisoso58_tn
