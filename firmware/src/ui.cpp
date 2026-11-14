// Every screen of the device. Layouts follow the design canvas 1:1
// (320x240, coordinates in pixels, text y = baseline).
#include "ui.h"
#include "config.h"
#include "data.h"
#include "gfx.h"

using namespace gfx;

static const UiCtx* C = nullptr;  // context of the frame being drawn

int uiSessionCount() {
  JsonArrayConst a = g_state["sessions"].as<JsonArrayConst>();
  return a.isNull() ? 0 : min<int>(a.size(), 6);
}

static uint16_t statusColor(const char* st) {
  if (!strcmp(st, "working")) return C_CLAY;
  if (!strcmp(st, "waiting")) return C_AMBER;
  if (!strcmp(st, "done")) return C_GREEN;
  return C_IDLE;
}

static uint16_t tagColor(const char* tag) {
  if (!strcmp(tag, "EDIT") || !strcmp(tag, "WRITE")) return C_CLAY;
  if (!strcmp(tag, "READ") || !strcmp(tag, "FIND")) return C_CODEX;
  if (!strcmp(tag, "BASH") || !strcmp(tag, "RUN")) return C_AMBER;
  if (!strcmp(tag, "WEB")) return C_GREEN;
  return C_MUTED;
}

static void topBar(const char* left, uint16_t color) {
  text(14, 21, left, F_LABEL, color);
  textR(306, 21, C->clock, F_LABEL, color);
}

static void dots() {
  if (C->dotCount < 2) return;
  int total = 0;
  for (int i = 0; i < C->dotCount; i++) total += (i == C->dotActive ? 14 : 5) + (i ? 4 : 0);
  int x = (W - total) / 2;
  for (int i = 0; i < C->dotCount; i++) {
    const int w = (i == C->dotActive) ? 14 : 5;
    rrect(x, 229, w, 5, 2, i == C->dotActive ? C_TEXT : C_DOT_OFF);
    x += w + 4;
  }
}

// ----------------------------------------------------------------- HOME
static void drawHome() {
  topBar(C->status, C_MUTED);
  JsonObjectConst home = g_state["home"];
  clawdDraw(18, 46, 108, C->mood, C->frame, C_CLAY, C_BG);

  textFit(144, 100, jstr(home["title"], "Boşta"), F_XXL, C_TEXT, 162);
  textFit(144, 119, jstr(home["project"]), F_MONO, C_CLAY_LT, 162);
  textFit(144, 136, jstr(home["sub"]), F_BODY, C_MUTED, 162);

  int y = 186;
  for (JsonObjectConst l : g_state["limits"].as<JsonArrayConst>()) {
    char label[24];
    snprintf(label, sizeof(label), "%s 5s", jstr(l["short"], jstr(l["name"])));
    char pct[8];
    snprintf(pct, sizeof(pct), "%%%d", l["p5"].as<int>());
    textFit(14, y + 9, label, F_SMALL, C_MUTED, 72);
    bar(92, y + 3, 172, 7, l["p5"].as<int>(), jcolor(l["color"], C_CLAY), C_TRACK);
    textR(306, y + 10, pct, F_BODY_B, C_TEXT);
    y += 18;
    if (y > 210) break;
  }
  dots();
}

// --------------------------------------------------------------- LIMITS
static void drawLimits() {
  topBar("LİMİTLER", C_MUTED);
  int cx = 12;
  for (JsonObjectConst l : g_state["limits"].as<JsonArrayConst>()) {
    const int cw = 144, cy = 30;
    const uint16_t col = jcolor(l["color"], C_CLAY);
    rrect(cx, cy, cw, 176, 10, C_PANEL);
    circle(cx + 14, cy + 15, 4, col);
    textFit(cx + 23, cy + 19, jstr(l["name"]), F_BODY_B, C_TEXT, cw - 30);

    const int p5 = l["p5"].as<int>();
    ring(cx + 40, cy + 66, 30, 23, p5, col, C_TRACK, C_PANEL);
    char pct[8];
    snprintf(pct, sizeof(pct), "%%%d", p5);
    textC(cx + 40, cy + 71, pct, F_MED, C_TEXT);

    text(cx + 78, cy + 58, "5 SAAT", F_LABEL, C_MUTED);
    textFit(cx + 78, cy + 75, jstr(l["r5"], "-"), F_BODY_B, C_TEXT, cw - 82);

    const int pw = l["pw"].as<int>();
    snprintf(pct, sizeof(pct), "%%%d", pw);
    text(cx + 10, cy + 124, "HAFTALIK", F_LABEL, C_MUTED);
    textR(cx + cw - 10, cy + 124, pct, F_LABEL, C_TEXT);
    bar(cx + 10, cy + 130, cw - 20, 6, pw, col, C_TRACK);
    textFit(cx + 10, cy + 154, jstr(l["rw"]), F_SMALL, C_MUTED, cw - 20);

    cx += cw + 8;
    if (cx > 200) break;
  }
  dots();
}

// ----------------------------------------------------------------- LIVE
static void drawLive() {
  JsonObjectConst live = g_state["live"];
  circle(18, 18, 4, C_CLAY);
  textFit(27, 23, jstr(live["project"], "-"), F_MED, C_TEXT, 220);
  textR(306, 22, jstr(live["elapsed"]), F_MONO, C_MUTED);
  textFit(14, 38, jstr(live["meta"]), F_SMALL, C_MUTED, 292);

  rrect(14, 45, 292, 46, 8, C_PANEL);
  const char* tag = jstr(live["tag"], "...");
  const int tw = textW(tag, F_LABEL) + 10;
  rrect(22, 52, tw, 14, 3, tagColor(tag));
  text(27, 63, tag, F_LABEL, C_BG);
  textFit(22 + tw + 7, 63, jstr(live["target"]), F_MONO, C_TEXT, 292 - tw - 22);
  textFit(22, 83, jstr(live["desc"]), F_BODY, C_MUTED, 276);

  text(14, 108, "SON ADIMLAR", F_LABEL, C_MUTED);
  int y = 123;
  for (JsonObjectConst s : live["steps"].as<JsonArrayConst>()) {
    const char* st = jstr(s["tag"]);
    text(14, y, st, F_MONO, tagColor(st));
    const char* ago = jstr(s["ago"]);
    const int aw = textW(ago, F_MONO);
    textFit(56, y, jstr(s["text"]), F_MONO, C_TEXT, 250 - aw - 8);
    textR(306, y, ago, F_MONO, C_MUTED);
    y += 15;
    if (y > 170) break;
  }

  const int done = live["todo_done"] | 0, total = live["todo_total"] | 0;
  if (total > 0) {
    char t[24];
    snprintf(t, sizeof(t), "Görevler %d/%d", done, total);
    text(14, 214, t, F_SMALL, C_MUTED);
    bar(100, 208, 206, 6, done * 100 / total, C_CLAY, C_TRACK);
  }
  dots();
}

// ------------------------------------------------------------ ATTENTION
static void drawAttention() {
  JsonObjectConst a = g_state["attention"];
  topBar("DİKKAT", C_BG);
  clawdDraw(14, 66, 92, MOOD_WAITING, C->frame, C_BG, C_CLAY);

  int y = 62;
  text(118, y, "ONAY BEKLİYOR", F_LABEL, C_BG);
  y += 20;
  const int lines = textWrap(118, y, jstr(a["title"], "Bir izin bekleniyor"), F_LARGE, C_BG, 188, 18, 3);
  y += (lines - 1) * 18 + 10;
  const char* cmd = jstr(a["cmd"]);
  if (*cmd) {
    rrect(118, y, 188, 22, 5, C_BG);
    textFit(126, y + 15, cmd, F_MONO, C_TEXT, 172);
    y += 30;
  }
  textFit(118, y + 8, jstr(a["meta"]), F_SMALL, C_BG, 188);

  hline(14, 210, 292, C_CLAY_DK);
  text(14, 226, "Bilgisayardan onayla · ortaya dokun: detay", F_LABEL, C_BG);
}

// ------------------------------------------------------------- SESSIONS
static void drawSessions() {
  const int n = uiSessionCount();
  char right[16];
  snprintf(right, sizeof(right), "%d iş", n);
  text(14, 21, "OTURUMLAR", F_LABEL, C_MUTED);
  textR(306, 21, right, F_LABEL, C_MUTED);
  if (n == 0) {
    textC(160, 120, "Henüz oturum yok", F_BODY, C_MUTED);
    return;
  }
  // Show 4 rows, scrolled so the selection is visible.
  const int first = constrain(C->sel - 3, 0, max(0, n - 4));
  JsonArrayConst arr = g_state["sessions"];
  for (int i = first; i < min(n, first + 4); i++) {
    JsonObjectConst s = arr[i];
    const int y = 30 + (i - first) * 48;
    const bool sel = (i == C->sel);
    rrect(12, y, 296, 44, 8, sel ? C_ROW_SEL : C_ROW);
    rrectLine(12, y, 296, 44, 8, sel ? C_CLAY : C_ROW_LINE);
    circle(27, y + 22, 4, statusColor(jstr(s["status"])));
    const char* ago = jstr(s["ago"]);
    const int aw = textW(ago, F_MONO);
    textFit(40, y + 20, jstr(s["name"]), F_MED, C_TEXT, 250 - aw);
    char sub[64];
    snprintf(sub, sizeof(sub), "%s · %s", jstr(s["status_label"]), jstr(s["tool"]));
    textFit(40, y + 35, sub, F_SMALL, C_MUTED, 250 - aw);
    textR(298, y + 27, ago, F_MONO, C_MUTED);
  }
}

// --------------------------------------------------------------- DETAIL
static void drawDetail() {
  const int n = uiSessionCount();
  if (n == 0) { drawSessions(); return; }
  JsonObjectConst s = g_state["sessions"][C->sel % n];
  char hdr[24];
  snprintf(hdr, sizeof(hdr), "OTURUM %d/%d", C->sel % n + 1, n);
  topBar(hdr, C_MUTED);

  const char* tool = jstr(s["tool"]);
  const int toolW = textW(tool, F_SMALL);
  const char* label = jstr(s["status_label"]);
  const int chipW = textW(label, F_LABEL) + 10;
  const int nameMax = 292 - toolW - chipW - 16;
  const char* name = jstr(s["name"]);
  textFit(14, 44, name, F_LARGE, C_TEXT, nameMax);
  const int nameW = min(textW(name, F_LARGE), nameMax);
  rrect(14 + nameW + 8, 33, chipW, 14, 3, statusColor(jstr(s["status"])));
  text(19 + nameW + 8, 44, label, F_LABEL, C_BG);
  textR(306, 43, tool, F_SMALL, C_MUTED);

  text(14, 63, "İSTEK", F_LABEL, C_MUTED);
  textWrap(14, 78, jstr(s["prompt"], "-"), F_BODY, C_TEXT, 292, 14, 2);

  int x = 14;
  for (JsonArrayConst kv : s["stats"].as<JsonArrayConst>()) {
    rrect(x, 100, 69, 36, 6, C_PANEL);
    textFit(x + 6, 119, jstr(kv[0]), F_LARGE, C_TEXT, 60);
    textFit(x + 6, 131, jstr(kv[1]), F_SMALL, C_MUTED, 60);
    x += 74;
    if (x > 250) break;
  }

  text(14, 154, "SON MESAJ", F_LABEL, C_MUTED);
  textWrap(14, 169, jstr(s["last"], "-"), F_BODY, C_SOFT, 292, 14, 4);
}

// ----------------------------------------------------------------- DONE
static void drawDone() {
  JsonObjectConst d = g_state["done"];
  clawdDraw(104, 22, 112, MOOD_HAPPY, C->frame, C_CLAY, C_BG);
  textC(160, 160, "Bitti!", F_XXL, C_GREEN);
  char line[96];
  const char* meta = jstr(d["meta"]);
  snprintf(line, sizeof(line), "%s%s%s", jstr(d["project"]), *meta ? " · " : "", meta);
  textC(160, 182, line, F_MONO, C_MUTED);
}

// ---------------------------------------------------------------- NIGHT
static void drawNight() {
  textC(160, 112, C->clock, F_CLOCK, C_NIGHT_TXT);
  char line[64] = "";
  int n = 0;
  for (JsonObjectConst l : g_state["limits"].as<JsonArrayConst>()) {
    n += snprintf(line + n, sizeof(line) - n, "%s%s %%%d", n ? " · " : "",
                  jstr(l["short"], jstr(l["name"])), l["p5"].as<int>());
    if (n >= static_cast<int>(sizeof(line)) - 1) break;
  }
  const int tw = textW(line, F_MONO);
  const int x0 = (W - (52 + 10 + tw)) / 2;
  clawdDraw(x0, 136, 52, MOOD_SLEEP, C->frame, C_NIGHT_CLD, C_BLACK);
  text(x0 + 62, 172, line, F_MONO, C_NIGHT_TXT);
}

// -------------------------------------------------------------- MESSAGE
static void drawMessage() {
  clawdDraw(124, 26, 72, MOOD_IDLE, C->frame, C_CLAY, C_BG);
  textC(160, 136, C->msgTitle, F_XL, C_TEXT);
  textWrap(24, 160, C->msgBody, F_BODY, C_MUTED, 272, 15, 4);
}

// ----------------------------------------------------------------------
static void drawCurrent() {
  switch (C->screen) {
    case SCR_HOME:      drawHome(); break;
    case SCR_LIMITS:    drawLimits(); break;
    case SCR_LIVE:      drawLive(); break;
    case SCR_ATTENTION: drawAttention(); break;
    case SCR_SESSIONS:  drawSessions(); break;
    case SCR_DETAIL:    drawDetail(); break;
    case SCR_DONE:      drawDone(); break;
    case SCR_NIGHT:     drawNight(); break;
    case SCR_MESSAGE:   drawMessage(); break;
  }
}

void uiBegin(TFT_eSPI& tft) { gfx::begin(tft); }

void uiRender(const UiCtx& ctx) {
  C = &ctx;
  uint16_t bg = C_BG;
  if (ctx.screen == SCR_ATTENTION) bg = C_CLAY;
  if (ctx.screen == SCR_NIGHT) bg = C_BLACK;
  gfx::frame(bg, drawCurrent);
}
