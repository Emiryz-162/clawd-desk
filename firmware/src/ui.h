#pragma once
#include <TFT_eSPI.h>
#include "clawd.h"

enum Screen : uint8_t {
  SCR_HOME, SCR_LIMITS, SCR_LIVE,       // auto-rotation
  SCR_ATTENTION, SCR_DONE,              // events
  SCR_SESSIONS, SCR_DETAIL,             // opened by touch
  SCR_NIGHT,                            // light sensor
  SCR_MESSAGE                           // boot / Wi-Fi setup messages
};

struct UiCtx {
  Screen screen = SCR_HOME;
  int sel = 0;                 // selected session
  uint32_t frame = 0;          // animation frame
  Mood mood = MOOD_IDLE;       // Clawd on the home screen
  char clock[8] = "--:--";
  char status[40] = "CLAWD DESK";  // top-left label on the home screen
  int dotCount = 0;            // rotation page dots
  int dotActive = 0;
  bool autoRotate = false;     // colors the active page dot
  const char* toast = nullptr; // short message drawn over the screen
  const char* msgTitle = "";
  const char* msgBody = "";
};

void uiBegin(TFT_eSPI& tft);
void uiRender(const UiCtx& ctx);
int  uiSessionCount();
