# Screen protocol

The screen accepts one JSON document at a time. Each new document replaces the previous one. The computer prepares all the text, and the screen just draws it.

- **Wi-Fi:** `POST http://clawd-desk.local/state` with the JSON as the body
- **USB:** 115200 baud, one JSON document per line
- **Health check:** `GET http://clawd-desk.local/` returns plain text

The fonts cover Latin-1 and Latin Extended-A, which includes most European letters. Emoji and characters like `…` are not drawn, and the companion removes them before sending.

```jsonc
{
  "v": 1,
  "lang": "en",                     // "en" | "tr": language of the fixed labels on the device
  "clock": "14:32",                 // used only if the board has no NTP time yet
  "mode": "working",                // working | waiting | done | idle -> Clawd's mood and the LED
  "home": { "title": "Working", "project": "desk-buddy", "sub": "12m · 47 steps" },
  "limits": [                       // the first two are shown
    { "name": "Claude Code", "short": "Claude", "color": "#D97757",
      "p5": 62, "r5": "1h 48m",     // 5-hour window: percent used + time until reset
      "pw": 41, "rw": "resets Mon 09:00" }   // weekly window
  ],
  "live": {                         // null -> the Live screen leaves the rotation
    "project": "desk-buddy", "elapsed": "12:04", "meta": "Claude Code · Opus 5.5 · context 84k",
    "tag": "EDIT", "target": "src/ui/limits.cpp", "desc": "Polishing the ring chart",
    "steps": [ { "tag": "READ", "text": "src/ui/screens.cpp", "ago": "18s" } ],
    "todo_done": 3, "todo_total": 5
  },
  "attention": {                    // not null -> the screen locks on "Needs approval"
    "title": "Codex wants to run a command", "cmd": "$ npm run build", "meta": "api-server · waiting 2m"
  },
  "done": { "id": 17, "project": "desk-buddy", "meta": "14m · 6 files" },   // each new id shows "Done!" once
  "sessions": [                     // up to 6
    { "name": "desk-buddy", "tool": "Claude Code",
      "status": "working",          // working | waiting | done | idle -> dot color
      "status_label": "Working", "ago": "now",
      "prompt": "Add a ring chart to the limits screen",
      "stats": [["12m","TIME"],["47","STEPS"],["6","FILES"],["84k","TOKENS"]],
      "last": "Moved the ring drawing into one function..." }
  ]
}
```

Tag colors: `EDIT`/`WRITE` orange, `READ`/`FIND` blue, `BASH`/`RUN` yellow, `WEB` green, anything else gray.

If no update arrives for 5 minutes, the top-left corner says `NO CONNECTION` and the LED turns off.
