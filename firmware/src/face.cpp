#include "face.h"
#include "config.h"
#include "gfx.h"

// The screen is a grid of 8 px "pixels": 40 x 30.
static constexpr int U = 8;
static constexpr uint16_t EYE = C_BG;
static constexpr uint16_t FACE = C_CLAY;

enum Look : uint8_t {
  L_OPEN,     // normal eyes (can glance with dx/dy)
  L_BLINK,    // thin lines
  L_FOCUS,    // narrowed, reading code
  L_WIDE,     // surprised
  L_HAPPY,    // ^ ^
  L_WINK,     // one eye closed
  L_HEARTS,   // heart eyes
  L_SLEEP,    // closed + z z
};

static struct {
  Look look = L_OPEN;
  float dx = 0, dy = 0;
  bool spark = false;
  int z = 0;
} f;

// idle pose scheduler
static Look idlePose = L_OPEN;
static float idleDx = 0, idleDy = 0;
static uint32_t poseUntil = 0, nextBlink = 0, blinkUntil = 0;

static uint32_t rnd(uint32_t a, uint32_t b) { return a + esp_random() % (b - a + 1); }

static void pickIdlePose(uint32_t now) {
  // mostly calm eyes with small glances, now and then a cute pose
  const uint32_t r = esp_random() % 100;
  idleDx = idleDy = 0;
  if (idlePose != L_OPEN || r < 45) {
    idlePose = L_OPEN;
    if (r % 3 == 1) idleDx = (esp_random() & 1) ? 3 : -3;
    else if (r % 3 == 2) idleDy = -2;
    poseUntil = now + rnd(3000, 7000);
  } else if (r < 65) {
    idlePose = L_HAPPY;
    poseUntil = now + rnd(1800, 3000);
  } else if (r < 80) {
    idlePose = L_WINK;
    poseUntil = now + 900;
  } else if (r < 92) {
    idlePose = L_HEARTS;
    poseUntil = now + rnd(1800, 2600);
  } else {
    idlePose = L_WIDE;
    poseUntil = now + 1200;
  }
}

void faceUpdate(Mood mood, bool happy, bool night, uint32_t now) {
  f.dx = f.dy = 0;
  f.spark = false;

  if (night) {
    f.look = L_SLEEP;
    f.z = (now / 900) % 3;
    return;
  }
  if (happy || mood == MOOD_HAPPY) {
    f.look = L_HAPPY;
    f.dy = ((now / 300) % 2) ? -1 : 0;  // little bounce
    return;
  }

  // blinking, shared by the open-eye looks
  if (now >= nextBlink) {
    blinkUntil = now + 300;
    nextBlink = now + rnd(2500, 6000);
  }
  const bool blinking = now < blinkUntil;

  if (mood == MOOD_WAITING) {
    f.look = blinking ? L_BLINK : L_WIDE;
    return;
  }
  if (mood == MOOD_WORKING) {
    // reading code: narrowed eyes sliding slowly left and right
    f.look = blinking ? L_BLINK : L_FOCUS;
    f.dx = sinf(now / 1100.0f) * 3.0f;
    f.dy = 1;
    f.spark = (now / 280) % 4 == 0;
    return;
  }

  if (now >= poseUntil) pickIdlePose(now);
  f.look = idlePose;
  f.dx = idleDx;
  f.dy = idleDy;
  if (blinking && (idlePose == L_OPEN || idlePose == L_WIDE)) f.look = L_BLINK;
  if (idlePose == L_HAPPY) f.dy = ((now / 300) % 2) ? -1 : 0;
}

// ---------------------------------------------------------------- drawing
static void block(float x, float y, float w, float h, uint16_t c) {
  const int x0 = lroundf(x * U), y0 = lroundf(y * U);
  gfx::rect(x0, y0, lroundf((x + w) * U) - x0, lroundf((y + h) * U) - y0, c);
}

// eye centers: x 13 and 27, y 13
static void eyePair(float w, float h, float dx, float dy) {
  block(13 - w / 2 + dx, 13 - h / 2 + dy, w, h, EYE);
  block(27 - w / 2 + dx, 13 - h / 2 + dy, w, h, EYE);
}

static void caret(float cx, float cy) {  // ^
  block(cx - 3, cy, 2, 2, EYE);
  block(cx - 1, cy - 2, 2, 2, EYE);
  block(cx + 1, cy, 2, 2, EYE);
}

static void heart(float cx, float cy) {
  static const char* rows[] = {".XX.XX.", "XXXXXXX", "XXXXXXX", ".XXXXX.", "..XXX..", "...X..."};
  for (int r = 0; r < 6; r++)
    for (int c = 0; c < 7; c++)
      if (rows[r][c] == 'X') block(cx - 3.5f + c, cy - 3 + r, 1, 1, EYE);
}

void faceDraw() {
  // the screen itself is the face: fill it with the case color
  gfx::rect(0, 0, gfx::W, gfx::H, FACE);
  switch (f.look) {
    case L_OPEN:  eyePair(4, 8, f.dx, f.dy); break;
    case L_BLINK: eyePair(4, 1, f.dx, f.dy + 1); break;
    case L_FOCUS: eyePair(4, 4, f.dx, f.dy + 1); break;
    case L_WIDE:  eyePair(5, 9, 0, -1); break;
    case L_HAPPY: caret(13, 12 + f.dy); caret(27, 12 + f.dy); break;
    case L_WINK:
      block(11, 9, 4, 8, EYE);
      block(25, 13, 4, 1, EYE);
      break;
    case L_HEARTS: heart(13, 13); heart(27, 13); break;
    case L_SLEEP:
      block(11, 14, 4, 1, EYE);
      block(25, 14, 4, 1, EYE);
      if (f.z >= 1) block(31, 7, 1, 1, C_TEXT);
      if (f.z >= 2) block(33, 4.5f, 1.5f, 1.5f, C_TEXT);
      break;
  }
  if (f.spark) {
    block(19, 4, 1, 1, C_TEXT);
    block(21.5f, 2.5f, 1, 1, C_TEXT);
  }
}
