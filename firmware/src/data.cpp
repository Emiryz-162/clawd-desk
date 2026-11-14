#include "data.h"
#include "config.h"

JsonDocument g_state;
uint32_t g_stateVersion = 0;
uint32_t g_lastUpdateMs = 0;
bool g_haveLiveData = false;

// Shown until the PC companion sends real data. Same sample as the design.
static const char DEMO_JSON[] PROGMEM = R"JSON({
  "v": 1,
  "lang": "en",
  "mode": "working",
  "home": {
    "title": "Working",
    "project": "desk-buddy",
    "sub": "12m · 47 steps · 3/5 tasks"
  },
  "limits": [
    {
      "name": "Claude Code",
      "short": "Claude",
      "color": "#D97757",
      "p5": 62,
      "r5": "1h 48m",
      "pw": 41,
      "rw": "resets Mon 09:00"
    },
    {
      "name": "Codex",
      "short": "Codex",
      "color": "#7FA7D9",
      "p5": 18,
      "r5": "3h 10m",
      "pw": 33,
      "rw": "resets Wed 14:00"
    }
  ],
  "live": {
    "project": "desk-buddy",
    "elapsed": "12:04",
    "meta": "Claude Code · Opus · context 84k",
    "tag": "EDIT",
    "target": "src/ui/limits.cpp",
    "desc": "Polishing the ring chart",
    "steps": [
      {
        "tag": "READ",
        "text": "src/ui/screens.cpp",
        "ago": "18s"
      },
      {
        "tag": "BASH",
        "text": "pio run -e cyd",
        "ago": "41s"
      },
      {
        "tag": "EDIT",
        "text": "src/net/usage.cpp",
        "ago": "1m"
      }
    ],
    "todo_done": 3,
    "todo_total": 5
  },
  "attention": null,
  "done": null,
  "sessions": [
    {
      "name": "desk-buddy",
      "tool": "Claude Code",
      "status": "working",
      "status_label": "Working",
      "ago": "now",
      "prompt": "Add a ring chart to the limits screen and show Codex too",
      "stats": [
        [
          "12m",
          "TIME"
        ],
        [
          "47",
          "STEPS"
        ],
        [
          "6",
          "FILES"
        ],
        [
          "84k",
          "TOKENS"
        ]
      ],
      "last": "Moved the ring drawing into one function. Building with PlatformIO now to check the size."
    },
    {
      "name": "api-server",
      "tool": "Codex",
      "status": "waiting",
      "status_label": "Needs approval",
      "ago": "2 min",
      "prompt": "Fix the build error and run the tests",
      "stats": [
        [
          "8m",
          "TIME"
        ],
        [
          "21",
          "STEPS"
        ],
        [
          "3",
          "FILES"
        ],
        [
          "31k",
          "TOKENS"
        ]
      ],
      "last": "Fixed the type error. I want to run npm run build to confirm."
    },
    {
      "name": "portfolio-site",
      "tool": "Claude Code",
      "status": "done",
      "status_label": "Done",
      "ago": "25 min",
      "prompt": "Make the project cards a single column on mobile",
      "stats": [
        [
          "14m",
          "TIME"
        ],
        [
          "33",
          "STEPS"
        ],
        [
          "4",
          "FILES"
        ],
        [
          "52k",
          "TOKENS"
        ]
      ],
      "last": "Cards are one column below 640px. Checked with a screenshot."
    },
    {
      "name": "blog-draft",
      "tool": "Codex",
      "status": "idle",
      "status_label": "Stopped",
      "ago": "3 h",
      "prompt": "Fix the typos in the draft post",
      "stats": [
        [
          "4m",
          "TIME"
        ],
        [
          "9",
          "STEPS"
        ],
        [
          "1",
          "FILES"
        ],
        [
          "12k",
          "TOKENS"
        ]
      ],
      "last": "The fixes are ready, waiting for you."
    }
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
