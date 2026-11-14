#include "clawd.h"
#include "config.h"
#include "gfx.h"

// One pixel block in sprite units (fractions allowed).
static void px(int ox, int oy, float u, float x, float y, float w, float h, uint16_t c) {
  const int x0 = ox + lroundf(x * u);
  const int y0 = oy + lroundf((y + 3) * u);
  const int x1 = ox + lroundf((x + w) * u);
  const int y1 = oy + lroundf((y + 3 + h) * u);
  gfx::rect(x0, y0, max(1, x1 - x0), max(1, y1 - y0), c);
}

void clawdDraw(int x, int y, int size, Mood mood, uint32_t f, uint16_t body, uint16_t eye) {
  const float u = size / 16.0f;
  const uint16_t spark = C_TEXT;
  float dy = 0;
  float la = 4, ra = 4;  // arm heights

  switch (mood) {
    case MOOD_IDLE:    dy = ((f / 3) % 2) ? -0.25f : 0; break;
    case MOOD_WORKING: dy = (f % 2) ? -0.25f : 0; break;
    case MOOD_WAITING: ra = ((f / 2) % 2) ? 0 : 2; break;
    case MOOD_HAPPY:
      dy = ((f / 2) % 2) ? -1 : 0;
      la = ra = (dy != 0) ? 1 : 3;
      break;
    case MOOD_SLEEP: break;
  }
  // dy is applied to everything, so shift the origin once.
  const int oy = y + lroundf(dy * u);

  // body, arms, legs
  px(x, oy, u, 2, 1, 12, 7, body);
  px(x, oy, u, 0, la, 2, 2, body);
  px(x, oy, u, 14, ra, 2, 2, body);
  for (int lx : {3, 5, 10, 12}) px(x, oy, u, lx, 8, 1, 3, body);

  // face + effects
  switch (mood) {
    case MOOD_IDLE:
      if (f % 14 == 0) {  // blink
        px(x, oy, u, 4, 4, 1, 0.4f, eye);
        px(x, oy, u, 11, 4, 1, 0.4f, eye);
      } else {
        px(x, oy, u, 4, 3, 1, 2, eye);
        px(x, oy, u, 11, 3, 1, 2, eye);
      }
      break;
    case MOOD_WORKING:
      px(x, oy, u, 4, 4, 1, 1.4f, eye);
      px(x, oy, u, 11, 4, 1, 1.4f, eye);
      if (f % 2) {
        px(x, oy, u, 6, -1.5f, 1, 1, spark);
        px(x, oy, u, 9.5f, -2.5f, 1, 1, spark);
      } else {
        px(x, oy, u, 7.5f, -2, 1, 1, spark);
        px(x, oy, u, 5, -2.8f, 0.8f, 0.8f, spark);
      }
      break;
    case MOOD_WAITING:
      px(x, oy, u, 4, 2.5f, 1, 2.5f, eye);
      px(x, oy, u, 11, 2.5f, 1, 2.5f, eye);
      if ((f / 2) % 2 == 0) {  // blinking "!"
        px(x, oy, u, 0.5f, -2.8f, 1, 2.2f, spark);
        px(x, oy, u, 0.5f, 0, 1, 0.8f, spark);
      }
      break;
    case MOOD_HAPPY:  // ^ ^ eyes
      px(x, oy, u, 3, 4, 1, 1, eye);
      px(x, oy, u, 4, 3, 1, 1, eye);
      px(x, oy, u, 5, 4, 1, 1, eye);
      px(x, oy, u, 10, 4, 1, 1, eye);
      px(x, oy, u, 11, 3, 1, 1, eye);
      px(x, oy, u, 12, 4, 1, 1, eye);
      break;
    case MOOD_SLEEP: {
      px(x, oy, u, 3.5f, 4, 2, 0.5f, eye);
      px(x, oy, u, 10.5f, 4, 2, 0.5f, eye);
      const int z = (f / 4) % 3;
      if (z >= 1) px(x, oy, u, 13.5f, -1, 0.9f, 0.9f, C_NIGHT_TXT);
      if (z >= 2) px(x, oy, u, 14.8f, -2.6f, 1.1f, 1.1f, C_NIGHT_TXT);
      break;
    }
  }
}
