# Ekran protokolü

Ekran tek bir JSON belgesi bekler. Her yeni belge öncekinin yerine geçer. Tüm metinleri bilgisayar hazırlar, ekran sadece çizer.

- **Wi-Fi:** `POST http://clawd-desk.local/state` (gövde = JSON)
- **USB:** 115200 baud, her satıra bir JSON belgesi
- **Durum kontrolü:** `GET http://clawd-desk.local/` adresi düz metin döner

Fontlar Latin-1 ve Latin Extended-A karakterlerini kapsar, Türkçe harflerin hepsi var. Emoji ve `…` gibi karakterler görünmez. Companion bunları kendisi temizler.

```jsonc
{
  "v": 1,
  "clock": "14:32",                 // NTP yoksa bu kullanılır
  "mode": "working",                // working | waiting | done | idle  -> Clawd'ın ruh hâli, LED
  "home": { "title": "Çalışıyor", "project": "desk-buddy", "sub": "12dk · 47 adım" },
  "limits": [                       // ilk ikisi gösterilir
    { "name": "Claude Code", "short": "Claude", "color": "#D97757",
      "p5": 62, "r5": "1sa 48dk",   // 5 saatlik pencere: yüzde + sıfırlanmaya kalan
      "pw": 41, "rw": "Pzt 09:00 sıfırlanır" }   // haftalık
  ],
  "live": {                         // null -> "Canlı oturum" döngüden çıkar
    "project": "desk-buddy", "elapsed": "12:04", "meta": "Claude Code · Opus 5.5 · bağlam 84k",
    "tag": "EDIT", "target": "src/ui/limits.cpp", "desc": "Halka grafiği düzenliyor",
    "steps": [ { "tag": "READ", "text": "src/ui/screens.cpp", "ago": "18s" } ],
    "todo_done": 3, "todo_total": 5
  },
  "attention": {                    // null değilse ekran "Onay bekliyor"a kilitlenir
    "title": "Codex bir komut çalıştırmak istiyor", "cmd": "$ npm run build", "meta": "api-server · 2dk bekliyor"
  },
  "done": { "id": 17, "project": "desk-buddy", "meta": "14dk · 6 dosya" },   // her yeni id bir kez "Bitti!" gösterir
  "sessions": [                     // en fazla 6
    { "name": "desk-buddy", "tool": "Claude Code",
      "status": "working",          // working | waiting | done | idle  -> nokta rengi
      "status_label": "Çalışıyor", "ago": "şimdi",
      "prompt": "Limit ekranına halka grafik ekle",
      "stats": [["12dk","SÜRE"],["47","ADIM"],["6","DOSYA"],["84k","TOKEN"]],
      "last": "Halka grafiği tek fonksiyona topladım..." }
  ]
}
```

Etiket renkleri: `EDIT`/`WRITE` turuncu, `READ`/`FIND` mavi, `BASH`/`RUN` sarı, `WEB` yeşil, diğerleri gri.

Bilgisayardan en az 5 dakika veri gelmezse ekranın sol üstünde `BAĞLANTI YOK` yazar ve LED söner.
