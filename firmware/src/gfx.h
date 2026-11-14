#pragma once
// Flicker-free drawing on a board without PSRAM.
//
// A full 320x240 frame buffer (150 KB) does not fit next to Wi-Fi, so every
// frame is drawn into one 320x48 strip, pushed, and repeated five times.
// All functions take *screen* coordinates; the strip offset is handled here.
#include <TFT_eSPI.h>
#include <U8g2_for_TFT_eSPI.h>

namespace gfx {

constexpr int W = 320;
constexpr int H = 240;
constexpr int BAND_H = 48;

void begin(TFT_eSPI& tft);
// Calls draw() once per strip; draw() should paint the whole screen.
void frame(uint16_t bg, void (*draw)());

void rect(int x, int y, int w, int h, uint16_t c);
void rrect(int x, int y, int w, int h, int r, uint16_t c);
void rrectLine(int x, int y, int w, int h, int r, uint16_t c);
void circle(int x, int y, int r, uint16_t c);
void hline(int x, int y, int w, uint16_t c);
// Progress ring starting at 12 o'clock, clockwise.
void ring(int cx, int cy, int r, int ir, int pct, uint16_t fg, uint16_t track, uint16_t bg);
void bar(int x, int y, int w, int h, int pct, uint16_t fg, uint16_t track);

// Text: y is the baseline. Strings are UTF-8.
int  textW(const char* s, const uint8_t* font);
void text(int x, int y, const char* s, const uint8_t* font, uint16_t c);
void textR(int xRight, int y, const char* s, const uint8_t* font, uint16_t c);
void textC(int xCenter, int y, const char* s, const uint8_t* font, uint16_t c);
// Cuts the string with "..." if it is wider than maxW.
void textFit(int x, int y, const char* s, const uint8_t* font, uint16_t c, int maxW);
// Word-wraps into at most maxLines lines; returns the number of lines drawn.
int  textWrap(int x, int y, const char* s, const uint8_t* font, uint16_t c,
              int maxW, int lineH, int maxLines);

}  // namespace gfx
