#pragma once
// Fixed labels drawn by the device. Everything else (session names, times,
// statuses) is already translated by the companion.
//
// The language follows the "lang" field the companion sends ("en" / "tr").
// Before the first update, CLAWD_LANG from config.h is used.
// Adding a language: add a block in lang.cpp and a case in L().

struct Lang {
  const char* limits;        // LIMITS screen title
  const char* fiveHours;     // label next to the ring
  const char* weekly;
  const char* fiveShort;     // home screen bar label suffix ("Claude 5h")
  const char* lastSteps;
  const char* tasksFmt;      // "Tasks %d/%d"
  const char* attention;     // top bar of the approval screen
  const char* needsApproval;
  const char* approvalHint;
  const char* approvalDefault;
  const char* sessions;
  const char* jobsFmt;       // "%d jobs"
  const char* noSessions;
  const char* sessionFmt;    // "SESSION %d/%d"
  const char* request;
  const char* lastMessage;
  const char* done;
  const char* idle;
  const char* noConnection;
  const char* hello;
  const char* connecting;
  const char* wifiSetup;
  const char* wifiSetupBody; // %s = hotspot name
  const char* wifiReset;
  const char* wifiResetBody;
  const char* autoOn;
  const char* autoOff;
  bool percentFirst;         // "%62" (tr) or "62%" (en)
};

const Lang& L();
// Formats a percentage the way the current language writes it.
void fmtPct(char* out, int n, int value);
