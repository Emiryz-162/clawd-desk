#include "net.h"
#include <ESPmDNS.h>
#include <WebServer.h>
#include <WiFi.h>
#include <WiFiManager.h>
#include <time.h>
#include "config.h"
#include "data.h"

static WebServer server(80);
static bool serverUp = false;
static void (*portalCb)() = nullptr;

static String serialBuf;

static void handleState() {
  if (!server.hasArg("plain")) {
    server.send(400, "application/json", "{\"ok\":false,\"error\":\"empty body\"}");
    return;
  }
  const String& body = server.arg("plain");
  if (applyStateJson(body.c_str(), body.length())) {
    server.send(200, "application/json", "{\"ok\":true}");
  } else {
    server.send(400, "application/json", "{\"ok\":false,\"error\":\"bad json\"}");
  }
}

static void handleRoot() {
  String s = "Clawd Desk\nip: " + WiFi.localIP().toString() +
             "\nstate updates: " + String(g_stateVersion) +
             "\nlive data: " + (g_haveLiveData ? "yes" : "no (demo)") + "\n";
  server.send(200, "text/plain; charset=utf-8", s);
}

void netBegin(void (*onPortal)()) {
  portalCb = onPortal;
  WiFi.mode(WIFI_STA);
  WiFi.setHostname(CLAWD_HOSTNAME);

  WiFiManager wm;
  wm.setConfigPortalTimeout(180);
  wm.setConnectTimeout(20);
  wm.setAPCallback([](WiFiManager*) {
    if (portalCb) portalCb();
  });
  const bool ok = wm.autoConnect(CLAWD_AP_NAME);
  if (!ok) {
    Serial.println("[net] no Wi-Fi, continuing with USB serial only");
    return;
  }
  Serial.printf("[net] connected, ip=%s\n", WiFi.localIP().toString().c_str());

  if (MDNS.begin(CLAWD_HOSTNAME)) MDNS.addService("http", "tcp", 80);
  configTzTime(CLAWD_TZ, "pool.ntp.org", "time.google.com");

  server.on("/", HTTP_GET, handleRoot);
  server.on("/state", HTTP_POST, handleState);
  server.begin();
  serverUp = true;
}

void netLoop() {
  if (serverUp) server.handleClient();

  // Same JSON can arrive over USB serial, one document per line.
  while (Serial.available()) {
    const char ch = static_cast<char>(Serial.read());
    if (ch == '\n') {
      serialBuf.trim();
      if (serialBuf.startsWith("{")) {
        if (applyStateJson(serialBuf.c_str(), serialBuf.length())) Serial.println("{\"ok\":true}");
      }
      serialBuf = "";
    } else if (serialBuf.length() < 16384) {
      serialBuf += ch;
    }
  }
}

bool netConnected() { return WiFi.status() == WL_CONNECTED; }

String netIp() { return netConnected() ? WiFi.localIP().toString() : String("USB"); }

bool netClock(char* out, size_t n) {
  struct tm t;
  if (!getLocalTime(&t, 0)) return false;
  strftime(out, n, "%H:%M", &t);
  return true;
}

void netResetWifi() {
  WiFiManager wm;
  wm.resetSettings();
  delay(200);
  ESP.restart();
}
