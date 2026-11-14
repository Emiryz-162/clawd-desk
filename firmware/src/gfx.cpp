#include "gfx.h"

namespace gfx {

static TFT_eSprite* spr = nullptr;
static U8g2_for_TFT_eSPI u8f;
static int OY = 0;  // y offset of the strip currently being drawn

static inline bool offBand(int y, int h) { return y + h < OY || y > OY + BAND_H; }

void begin(TFT_eSPI& tft) {
  spr = new TFT_eSprite(&tft);
  spr->setColorDepth(16);
  spr->createSprite(W, BAND_H);
  u8f.begin(*spr);
  u8f.setFontMode(1);       // transparent background
  u8f.setFontDirection(0);
}

void frame(uint16_t bg, void (*draw)()) {
  for (int y = 0; y < H; y += BAND_H) {
    OY = y;
    spr->fillSprite(bg);
    draw();
    spr->pushSprite(0, y);
  }
}

void rect(int x, int y, int w, int h, uint16_t c) {
  if (w <= 0 || h <= 0 || offBand(y, h)) return;
  spr->fillRect(x, y - OY, w, h, c);
}

void rrect(int x, int y, int w, int h, int r, uint16_t c) {
  if (w <= 0 || h <= 0 || offBand(y, h)) return;
  spr->fillRoundRect(x, y - OY, w, h, r, c);
}

void rrectLine(int x, int y, int w, int h, int r, uint16_t c) {
  if (w <= 0 || h <= 0 || offBand(y, h)) return;
  spr->drawRoundRect(x, y - OY, w, h, r, c);
}

void circle(int x, int y, int r, uint16_t c) {
  if (offBand(y - r, 2 * r)) return;
  spr->fillCircle(x, y - OY, r, c);
}

void hline(int x, int y, int w, uint16_t c) {
  if (offBand(y, 1)) return;
  spr->drawFastHLine(x, y - OY, w, c);
}

void ring(int cx, int cy, int r, int ir, int pct, uint16_t fg, uint16_t track, uint16_t bg) {
  if (offBand(cy - r, 2 * r)) return;
  int y = cy - OY;
  spr->drawSmoothArc(cx, y, r, ir, 0, 360, track, bg, false);
  int a = constrain(pct, 0, 100) * 360 / 100;
  if (a <= 0) return;
  // TFT_eSPI angles: 0 = 6 o'clock, clockwise. 180 = 12 o'clock.
  int e = 180 + a;
  if (e <= 360) {
    spr->drawSmoothArc(cx, y, r, ir, 180, e, fg, bg, false);
  } else {
    spr->drawSmoothArc(cx, y, r, ir, 180, 360, fg, bg, false);
    spr->drawSmoothArc(cx, y, r, ir, 0, e - 360, fg, bg, false);
  }
}

void bar(int x, int y, int w, int h, int pct, uint16_t fg, uint16_t track) {
  int r = h / 2;
  rrect(x, y, w, h, r, track);
  int fw = w * constrain(pct, 0, 100) / 100;
  if (fw > 0) rrect(x, y, max(fw, h), h, r, fg);
}

int textW(const char* s, const uint8_t* font) {
  u8f.setFont(font);
  return u8f.getUTF8Width(s ? s : "");
}

void text(int x, int y, const char* s, const uint8_t* font, uint16_t c) {
  if (!s || !*s) return;
  if (y + 12 < OY || y - 64 > OY + BAND_H) return;
  u8f.setFont(font);
  u8f.setForegroundColor(c);
  u8f.drawUTF8(x, y - OY, s);
}

void textR(int xRight, int y, const char* s, const uint8_t* font, uint16_t c) {
  text(xRight - textW(s, font), y, s, font, c);
}

void textC(int xCenter, int y, const char* s, const uint8_t* font, uint16_t c) {
  text(xCenter - textW(s, font) / 2, y, s, font, c);
}

// Removes the last UTF-8 code point from buf (in place).
static void popCodepoint(char* buf) {
  size_t n = strlen(buf);
  if (!n) return;
  n--;
  while (n > 0 && (static_cast<uint8_t>(buf[n]) & 0xC0) == 0x80) n--;
  buf[n] = 0;
}

// Fits buf into maxW, appending "..." when cut (or always, when force is set).
static void fitInto(char* buf, const uint8_t* font, int maxW, bool force) {
  u8f.setFont(font);
  if (!force && u8f.getUTF8Width(buf) <= maxW) return;
  const int dots = u8f.getUTF8Width("...");
  while (*buf && u8f.getUTF8Width(buf) + dots > maxW) popCodepoint(buf);
  size_t n = strlen(buf);
  while (n > 0 && buf[n - 1] == ' ') buf[--n] = 0;
  strcat(buf, "...");
}

void textFit(int x, int y, const char* s, const uint8_t* font, uint16_t c, int maxW) {
  if (!s) return;
  char buf[256];
  strlcpy(buf, s, sizeof(buf) - 4);
  fitInto(buf, font, maxW, false);
  text(x, y, buf, font, c);
}

int textWrap(int x, int y, const char* s, const uint8_t* font, uint16_t c,
             int maxW, int lineH, int maxLines) {
  if (!s) return 0;
  char cand[256];
  char line[256];
  u8f.setFont(font);
  const char* p = s;
  int lines = 0;
  while (*p && lines < maxLines) {
    while (*p == ' ' || *p == '\n') p++;
    if (!*p) break;
    const char* end = p;
    const char* q = p;
    while (true) {
      const char* we = q;
      while (*we && *we != ' ' && *we != '\n') we++;
      size_t n = min<size_t>(we - p, sizeof(cand) - 1);
      memcpy(cand, p, n);
      cand[n] = 0;
      u8f.setFont(font);
      if (end != p && u8f.getUTF8Width(cand) > maxW) break;
      end = we;
      if (!*we || *we == '\n') break;
      q = we;
      while (*q == ' ') q++;
      if (!*q) break;
    }
    size_t n = min<size_t>(end - p, sizeof(line) - 4);
    memcpy(line, p, n);
    line[n] = 0;
    const char* rest = end;
    while (*rest == ' ' || *rest == '\n') rest++;
    const bool lastLine = (lines == maxLines - 1);
    fitInto(line, font, maxW, lastLine && *rest);
    text(x, y + lines * lineH, line, font, c);
    lines++;
    p = end;
  }
  return lines;
}

}  // namespace gfx
