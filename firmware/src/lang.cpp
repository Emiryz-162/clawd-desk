#include "lang.h"
#include <Arduino.h>
#include "config.h"
#include "data.h"

static const Lang EN = {
  "LIMITS", "5 HOURS", "WEEKLY", "5h", "LAST STEPS", "Tasks %d/%d",
  "ATTENTION", "NEEDS APPROVAL", "Approve on your computer · tap middle: details",
  "Waiting for your approval",
  "SESSIONS", "%d jobs", "No sessions yet", "SESSION %d/%d", "REQUEST", "LAST MESSAGE",
  "Done!", "Idle", "NO CONNECTION",
  "Hello!", "Connecting to Wi-Fi...",
  "Wi-Fi setup", "On your phone, join the \"%s\" network and pick your home Wi-Fi on the page that opens.",
  "Resetting Wi-Fi", "The device restarts and opens the setup network.",
  "Normal mode", "Auto-rotate", "Face mode",
  false,
};

static const Lang TR = {
  "LİMİTLER", "5 SAAT", "HAFTALIK", "5s", "SON ADIMLAR", "Görevler %d/%d",
  "DİKKAT", "ONAY BEKLİYOR", "Bilgisayardan onayla · ortaya dokun: detay",
  "Bir izin bekleniyor",
  "OTURUMLAR", "%d iş", "Henüz oturum yok", "OTURUM %d/%d", "İSTEK", "SON MESAJ",
  "Bitti!", "Boşta", "BAĞLANTI YOK",
  "Merhaba!", "Wi-Fi'ye bağlanıyorum...",
  "Wi-Fi kurulumu", "Telefonundan \"%s\" ağına bağlan ve açılan sayfadan evdeki Wi-Fi'yi seç.",
  "Wi-Fi sıfırlanıyor", "Cihaz yeniden başlayıp kurulum ağını açacak.",
  "Normal mod", "Otomatik geçiş", "Yüz modu",
  true,
};

const Lang& L() {
  const char* code = jstr(g_state["lang"], CLAWD_LANG);
  if (!strcmp(code, "tr")) return TR;
  return EN;
}

void fmtPct(char* out, int n, int value) {
  snprintf(out, n, L().percentFirst ? "%%%d" : "%d%%", value);
}
