// Clawd Desk — a tiny desk buddy for Claude Code and Codex on the
// ESP32-2432S028R ("Cheap Yellow Display").
//
// The screen mostly runs itself:
//   * Home -> Limits -> Live rotate every ROTATE_MS
//   * "waiting for approval" and "done" events jump to the front
//   * the light sensor switches to night mode
// Touch is split into three big vertical zones (left / middle / right),
// and the BOOT button on the back works as a physical "next" button.
#include <Arduino.h>
#include <TFT_eSPI.h>
#include "config.h"
#include "data.h"
#include "hw.h"
#include "net.h"
#include "ui.h"

static TFT_eSPI tft;
static UiCtx ui;

static Screen rot[3];
static int rotN = 0;

static uint32_t seenVersion = 0;
static uint32_t lastRotate = 0, lastTouch = 0, lastFrame = 0;
static uint32_t doneUntil = 0, nightSince = 0, wakeUntil = 0, lastLdrLog = 0;
static int lastDoneId = -1;
static int prevP5[2] = {-1, -1};
static bool night = false;

// ---------------------------------------------------------------- helpers
static const char* mode() { return jstr(g_state["mode"], "idle"); }

static void buildRotation() {
  rotN = 0;
  rot[rotN++] = SCR_HOME;
  rot[rotN++] = SCR_LIMITS;
  if (!g_state["live"].isNull() && !strcmp(mode(), "working")) rot[rotN++] = SCR_LIVE;
}

static int rotIndex(Screen s) {
  for (int i = 0; i < rotN; i++)
    if (rot[i] == s) return i;
  return -1;
}

static void go(Screen s) {
  ui.screen = s;
  lastRotate = millis();
}

static Mood homeMood() {
  const char* m = mode();
  if (!strcmp(m, "working")) return MOOD_WORKING;
  if (!strcmp(m, "waiting")) return MOOD_WAITING;
  if (!strcmp(m, "done")) return MOOD_HAPPY;
  return MOOD_IDLE;
}

static void showMessage(const char* title, const char* body) {
  ui.screen = SCR_MESSAGE;
  ui.msgTitle = title;
  ui.msgBody = body;
  uiRender(ui);
}

// ------------------------------------------------------------ state input
static void onStateChanged() {
  buildRotation();
  if (ui.screen == SCR_LIVE && rotIndex(SCR_LIVE) < 0) go(SCR_HOME);

  // "done" event: fire once per id
  JsonVariantConst d = g_state["done"];
  if (!d.isNull()) {
    const int id = d["id"] | 0;
    if (id != lastDoneId) {
      lastDoneId = id;
      if (ui.screen != SCR_ATTENTION) {
        go(SCR_DONE);
        doneUntil = millis() + DONE_SHOW_MS;
      }
    }
  }

  // jump to Limits once when a 5-hour window crosses LIMIT_ALERT_PCT
  int i = 0;
  for (JsonObjectConst l : g_state["limits"].as<JsonArrayConst>()) {
    if (i >= 2) break;
    const int p = l["p5"] | 0;
    if (g_haveLiveData && prevP5[i] >= 0 && prevP5[i] < LIMIT_ALERT_PCT && p >= LIMIT_ALERT_PCT &&
        rotIndex(ui.screen) >= 0) {
      go(SCR_LIMITS);
    }
    prevP5[i++] = p;
  }

  const int n = uiSessionCount();
  if (n > 0) ui.sel %= n; else ui.sel = 0;
}

// ------------------------------------------------------------ user input
static void handleTap(Zone z) {
  const uint32_t now = millis();
  lastTouch = now;
  const int n = max(1, uiSessionCount());

  if (ui.screen == SCR_NIGHT) {
    night = false;
    nightSince = 0;
    wakeUntil = now + NIGHT_WAKE_MS;
    go(SCR_HOME);
    return;
  }
  if (ui.screen == SCR_DONE) { go(SCR_HOME); return; }

  const int ri = rotIndex(ui.screen);
  if (ri >= 0) {
    if (z == ZONE_LEFT) go(rot[(ri - 1 + rotN) % rotN]);
    else if (z == ZONE_RIGHT) go(rot[(ri + 1) % rotN]);
    else go(SCR_SESSIONS);
    return;
  }
  switch (ui.screen) {
    case SCR_SESSIONS:
      if (z == ZONE_LEFT) ui.sel = (ui.sel - 1 + n) % n;
      else if (z == ZONE_RIGHT) ui.sel = (ui.sel + 1) % n;
      else go(SCR_DETAIL);
      break;
    case SCR_DETAIL:
      if (z == ZONE_LEFT) go(SCR_SESSIONS);
      else if (z == ZONE_RIGHT) ui.sel = (ui.sel + 1) % n;
      else go(SCR_HOME);
      break;
    case SCR_ATTENTION:
      if (z == ZONE_MID) {
        int i = 0;
        for (JsonObjectConst s : g_state["sessions"].as<JsonArrayConst>()) {
          if (!strcmp(jstr(s["status"]), "waiting")) { ui.sel = i; break; }
          i++;
        }
        go(SCR_DETAIL);
      }
      break;
    default:
      go(SCR_HOME);
  }
}

static void handleBoot() {
  lastTouch = millis();
  if (rotIndex(ui.screen) >= 0) handleTap(ZONE_RIGHT);
  else if (ui.screen == SCR_NIGHT) handleTap(ZONE_MID);
  else go(SCR_HOME);
}

// ------------------------------------------------------------ night mode
static void updateNight(uint32_t now) {
#if NIGHT_ENABLED
  const int ldr = hwReadLdr();
  if (now - lastLdrLog > 10000) {
    lastLdrLog = now;
    Serial.printf("[hw] ldr=%d (night above %d)\n", ldr, LDR_NIGHT_ABOVE);
  }
  if (ldr > LDR_NIGHT_ABOVE) {
    if (!nightSince) nightSince = now;
    if (now - nightSince > NIGHT_HOLD_MS && now > wakeUntil) night = true;
  } else {
    nightSince = 0;
    night = false;
  }
#endif
}

// ------------------------------------------------------------------- LED
static void updateLed(uint32_t now) {
  const bool stale = g_haveLiveData && now - g_lastUpdateMs > STALE_MS;
  if (ui.screen == SCR_NIGHT || stale) { hwLed(0, 0, 0); return; }
  if (ui.screen == SCR_ATTENTION || !strcmp(mode(), "waiting")) {
    if ((now / 400) % 2) hwLed(LED_MAX, LED_MAX * 55 / 100, 0);
    else hwLed(0, 0, 0);
    return;
  }
  if (ui.screen == SCR_DONE) { hwLed(0, LED_MAX, 0); return; }
  if (!strcmp(mode(), "working")) {
    const float v = 0.35f + 0.65f * (0.5f + 0.5f * sinf(now / 700.0f));
    hwLed(LED_MAX * v, LED_MAX * v * 0.28f, 0);
    return;
  }
  hwLed(0, 0, 0);
}

// ----------------------------------------------------------------- frame
static void fillCtx(uint32_t now) {
  if (!netClock(ui.clock, sizeof(ui.clock))) strlcpy(ui.clock, jstr(g_state["clock"], "--:--"), sizeof(ui.clock));

  if (!g_haveLiveData) snprintf(ui.status, sizeof(ui.status), "DEMO · %s", netIp().c_str());
  else if (now - g_lastUpdateMs > STALE_MS) strlcpy(ui.status, "BAĞLANTI YOK", sizeof(ui.status));
  else strlcpy(ui.status, "CLAWD DESK", sizeof(ui.status));

  ui.mood = homeMood();
  const int ri = rotIndex(ui.screen);
  ui.dotCount = ri >= 0 ? rotN : 0;
  ui.dotActive = ri;
}

// ------------------------------------------------------------ setup/loop
void setup() {
  Serial.begin(115200);
  Serial.setRxBufferSize(16384);
  tft.init();
  tft.setRotation(1);
#ifdef CLAWD_INVERT
  tft.invertDisplay(true);
#endif
  tft.fillScreen(C_BG);
  hwBegin();  // after tft.init(), so the backlight pin stays on PWM
  uiBegin(tft);
  loadDemoState();

  showMessage("Merhaba!", "Wi-Fi'ye bağlanıyorum...");
  netBegin([] {
    showMessage("Wi-Fi kurulumu",
                "Telefonundan \"" CLAWD_AP_NAME "\" ağına bağlan ve açılan sayfadan evdeki Wi-Fi'yi seç.");
  });

  buildRotation();
  go(SCR_HOME);
  Serial.printf("[clawd] ready, ip=%s\n", netIp().c_str());
}

void loop() {
  netLoop();
  const uint32_t now = millis();

  if (g_stateVersion != seenVersion) {
    seenVersion = g_stateVersion;
    onStateChanged();
  }

  const BootPress b = hwReadBoot();
  if (b == BOOT_LONG) {
    showMessage("Wi-Fi sıfırlanıyor", "Cihaz yeniden başlayıp kurulum ağını açacak.");
    delay(1500);
    netResetWifi();
  } else if (b == BOOT_SHORT) {
    handleBoot();
  }
  const Zone z = hwReadTouch();
  if (z != ZONE_NONE) handleTap(z);

  updateNight(now);

  // events and timeouts
  const bool attention = !g_state["attention"].isNull();
  const bool peeking = ui.screen == SCR_DETAIL && now - lastTouch < BACK_HOME_MS;
  if (attention && ui.screen != SCR_ATTENTION && !peeking) go(SCR_ATTENTION);
  if (!attention && ui.screen == SCR_ATTENTION) go(SCR_HOME);
  if (ui.screen == SCR_DONE && now > doneUntil) go(SCR_HOME);
  if ((ui.screen == SCR_SESSIONS || ui.screen == SCR_DETAIL) && now - lastTouch > BACK_HOME_MS) go(SCR_HOME);
  if (night && (rotIndex(ui.screen) >= 0)) go(SCR_NIGHT);
  if (!night && ui.screen == SCR_NIGHT) go(SCR_HOME);

  const int ri = rotIndex(ui.screen);
  if (ri >= 0 && now - lastRotate > ROTATE_MS) go(rot[(ri + 1) % rotN]);

  if (now - lastFrame >= ANIM_MS) {
    lastFrame = now;
    ui.frame++;
    fillCtx(now);
    hwBacklight(ui.screen == SCR_NIGHT ? BL_NIGHT : BL_DAY);
    uiRender(ui);
    updateLed(now);
  }
  delay(2);
}
