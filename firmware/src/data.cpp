#include "data.h"
#include "config.h"

JsonDocument g_state;
uint32_t g_stateVersion = 0;
uint32_t g_lastUpdateMs = 0;
bool g_haveLiveData = false;

// Shown until the PC companion sends real data. Same sample as the design.
static const char DEMO_JSON[] PROGMEM = R"JSON({
  "v": 1,
  "mode": "working",
  "home": {"title": "Çalışıyor", "project": "desk-buddy", "sub": "12 dk · 47 adım · 3/5 görev"},
  "limits": [
    {"name": "Claude Code", "short": "Claude", "color": "#D97757", "p5": 62, "r5": "1sa 48dk", "pw": 41, "rw": "Pzt 09:00 sıfırlanır"},
    {"name": "Codex", "short": "Codex", "color": "#7FA7D9", "p5": 18, "r5": "3sa 10dk", "pw": 33, "rw": "Çar 14:00 sıfırlanır"}
  ],
  "live": {
    "project": "desk-buddy", "elapsed": "12:04",
    "meta": "Claude Code · Opus · bağlam %38",
    "tag": "EDIT", "target": "src/ui/limits.cpp", "desc": "Halka grafiğin çizimini düzenliyor",
    "steps": [
      {"tag": "READ", "text": "src/ui/screens.cpp", "ago": "18s"},
      {"tag": "BASH", "text": "pio run -e cyd", "ago": "41s"},
      {"tag": "EDIT", "text": "src/net/usage.cpp", "ago": "1dk"}
    ],
    "todo_done": 3, "todo_total": 5
  },
  "attention": null,
  "done": null,
  "sessions": [
    {"name": "desk-buddy", "tool": "Claude Code", "status": "working", "status_label": "Çalışıyor", "ago": "şimdi",
     "prompt": "Limit ekranına halka grafik ekle, Codex verisini de göster",
     "stats": [["12dk", "SÜRE"], ["47", "ADIM"], ["6", "DOSYA"], ["84k", "TOKEN"]],
     "last": "Halka grafiği tek fonksiyona topladım. Şimdi PlatformIO ile derleyip boyutu kontrol ediyorum."},
    {"name": "api-server", "tool": "Codex", "status": "waiting", "status_label": "Onay bekliyor", "ago": "2 dk",
     "prompt": "Build hatasını düzelt ve testleri çalıştır",
     "stats": [["8dk", "SÜRE"], ["21", "ADIM"], ["3", "DOSYA"], ["31k", "TOKEN"]],
     "last": "Tip hatasını düzelttim. Doğrulamak için npm run build çalıştırmak istiyorum."},
    {"name": "portfolio-site", "tool": "Claude Code", "status": "done", "status_label": "Bitti", "ago": "25 dk",
     "prompt": "Proje kartlarını mobilde tek sütuna indir",
     "stats": [["14dk", "SÜRE"], ["33", "ADIM"], ["4", "DOSYA"], ["52k", "TOKEN"]],
     "last": "Kartlar 640px altında tek sütun. Ekran görüntüsüyle kontrol ettim."},
    {"name": "blog-taslak", "tool": "Codex", "status": "idle", "status_label": "Durdu", "ago": "3 sa",
     "prompt": "Taslak yazının yazım hatalarını düzelt",
     "stats": [["4dk", "SÜRE"], ["9", "ADIM"], ["1", "DOSYA"], ["12k", "TOKEN"]],
     "last": "Düzeltmeler hazır, onayını bekliyorum."}
  ]
})JSON";

bool applyStateJson(const char* json, size_t len) {
  JsonDocument tmp;
  DeserializationError err = deserializeJson(tmp, json, len);
  if (err) {
    Serial.printf("[data] bad JSON: %s\n", err.c_str());
    return false;
  }
  if (!tmp.is<JsonObject>()) return false;
  g_state = std::move(tmp);
  g_stateVersion++;
  g_lastUpdateMs = millis();
  g_haveLiveData = true;
  return true;
}

void loadDemoState() {
  deserializeJson(g_state, DEMO_JSON);
  g_stateVersion++;
  g_haveLiveData = false;
}

const char* jstr(JsonVariantConst v, const char* def) {
  const char* s = v.as<const char*>();
  return s ? s : def;
}

uint16_t jcolor(JsonVariantConst v, uint16_t def) {
  const char* s = v.as<const char*>();
  if (!s || s[0] != '#' || strlen(s) != 7) return def;
  return rgb(strtoul(s + 1, nullptr, 16));
}
