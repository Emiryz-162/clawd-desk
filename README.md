# Clawd Desk

Masanda duran küçük bir Clawd. Claude Code ve Codex limitlerini, şu an çalışan işi, onay bekleyen komutları ve son oturumlarını gösterir.

**Donanım:** ESP32-2432S028R ("Cheap Yellow Display", 2.8" 320×240) ve 3D baskı Clawd kılıfı.

> Bağımsız bir hayran projesidir. Anthropic veya OpenAI ile bağlantılı değildir.

## Nasıl çalışır?

```
Claude Code / Codex  ──►  companion (bilgisayarında, Node.js)  ──Wi-Fi veya USB──►  ESP32 ekran
  oturum kayıtları           her 2 sn'de durumu toplar                        çizer, animasyon,
  hook'lar, status line      JSON olarak ekrana gönderir                       dokunma, LED
```

- **Ekran neredeyse hiç dokunma istemez.** Ana ekran, Limitler ve Canlı oturum her 10 saniyede kendi kendine döner.
- **Olaylar öne çıkar.** Onay bekleyen bir komut olunca ekran o sayfaya kilitlenir ve LED sarı yanıp söner. İş bitince Clawd 6 saniye sevinir.
- **Dokunma için üç büyük bölge var.** Sol = önceki, orta = aç, sağ = sonraki. Rezistif ekran isabetsiz olduğu için en küçük hedef ekranın üçte biri.
- **Kartın donanımı da kullanılır.** Işık sensörü oda kararınca gece moduna geçirir. Arkadaki BOOT tuşu fiziksel "sonraki" tuşudur, 5 saniye basılı tutunca Wi-Fi ayarları sıfırlanır.

## Ekranlar

| | Ekran | Ne zaman |
|---|---|---|
| 1 | Ana ekran | Clawd'ın ruh hâli, aktif iş, iki limit çubuğu |
| 2 | Limitler | Claude Code ve Codex: 5 saatlik + haftalık, sıfırlanma zamanı |
| 3 | Canlı oturum | Çalışan bir iş varken: şu anki adım, son adımlar, görevler |
| 4 | Onay bekliyor | Claude ya da Codex izin isteyince |
| 5 | Oturumlar | Ortaya dokununca açılır |
| 6 | Oturum detayı | İstek, süre, adım, dosya, token, son mesaj |
| 7 | Bitti | Bir iş bitince 6 saniye |
| 8 | Gece | Oda karanlıkken: saat ve uyuyan Clawd |

## Kurulum

### 1. Firmware'i yükle

[PlatformIO](https://platformio.org/) gerekiyor (VS Code eklentisi ya da `pio` komutu).

PowerShell'de (PlatformIO VS Code eklentisiyle kurulduysa `pio` PATH'te olmaz, tam yolu kullan):

```powershell
cd firmware
& "$env:USERPROFILE\.platformio\penv\Scripts\pio.exe" run -e cyd -t upload
```

- Ekran fotoğraf negatifi gibi görünüyorsa (beyaz arka plan, turuncu yerine mavi) `-e cyd_inv` kullan.
- Kartında hem micro USB hem USB-C varsa `-e cyd2usb` kullan.
- Yükleme `Connecting.....` aşamasında takılırsa arkadaki BOOT tuşunu basılı tut.

Kartta daha önce kaydedilmiş bir Wi-Fi varsa doğrudan ona bağlanır, kurulum ağı açılmaz. Başka ağa geçmek için BOOT tuşunu 5 saniye basılı tut. Kayıtlı Wi-Fi yoksa ilk açılışta ekran **Wi-Fi kurulumu** der. Telefonundan `ClawdDesk-Kurulum` ağına bağlan ve açılan sayfadan evdeki Wi-Fi'yi seç. Bağlanana kadar ekran demo verisi gösterir, sol üstte `DEMO · <ip>` yazar.

### 2. Bilgisayar tarafını çalıştır

Node.js 18 veya üstü yeterli, ek paket gerekmez.

```bash
cd companion
node src/cli.mjs install
node src/cli.mjs run --device clawd-desk.local
```

- `install` komutu `~/.claude/settings.json` dosyasına Clawd Desk hook'larını ve status line'ı ekler. Önceki dosyanın yedeği `settings.json.clawd-desk.bak` olarak kalır. Eğer zaten bir status line'ın varsa, o da çalışmaya devam eder. Geri almak için: `node src/cli.mjs uninstall`
- `clawd-desk.local` bulunamazsa ekranın sol üstündeki IP'yi kullan: `--device 192.168.1.42`
- USB kablosuyla göndermek için önce `npm install` çalıştır, sonra `--serial COM5` kullan.
- `http://127.0.0.1:8787/` adresinde ekrana giden veriyi canlı görebilirsin.
- Windows açılışında pencere açmadan kendiliğinden başlasın: `node src/cli.mjs autostart`. Kapatmak için: `node src/cli.mjs autostart off`. Kayıtlar `~/.clawd-desk/companion.log` dosyasında.
- Ayarları her seferinde yazmak istemezsen `~/.clawd-desk/config.json` dosyası oluştur: `{ "device": "192.168.1.42" }`

Gerçek veri olmadan bütün ekranları gezmek için: `node src/cli.mjs demo --device clawd-desk.local`

## Veriler nereden geliyor?

| Veri | Kaynak |
|---|---|
| Claude oturumları | `~/.claude/projects/**/*.jsonl` (sadece okunur) |
| Codex oturumları ve limitleri | `~/.codex/sessions/**/rollout-*.jsonl` (sadece okunur) |
| Claude canlı durumu (çalışıyor / onay bekliyor / bitti) | Claude Code hook'ları -> `127.0.0.1:8787/hook` |
| Claude 5 saatlik ve haftalık limit | Claude Code status line'ının `rate_limits` alanı (Pro/Max). Yoksa Claude Code'un kayıtlı girişiyle kullanım endpoint'i denenir. |

Her şey yerel ağında kalır. Companion sadece `127.0.0.1` adresini dinler ve dışarıya istek atmaz. Tek istisna yukarıdaki yedek limit isteğidir, o da sadece status line verisi yoksa yapılır.

**Bilinen sınırlar:**
- Claude limitleri ancak Claude Code bir cevap verdikten sonra görünür, çünkü status line ilk cevaptan sonra güncellenir.
- Codex için "onay bekliyor" durumu, Codex onay isteğini kayıt dosyasına yazdığında görünür.

## Kendi değişikliklerin

- `firmware/include/config.h`: süreler, renkler, gece eşiği, LED parlaklığı, dokunma kalibrasyonu
- `firmware/src/ui.cpp`: bütün ekranların çizimi (koordinatlar tasarımla birebir)
- `firmware/src/clawd.cpp`: Clawd'ın piksel animasyonları
- `companion/src/state.mjs`: ekrana hangi metnin gideceği
- `docs/protocol.md`: ekran ile bilgisayar arasındaki JSON formatı

Ekran kendine bir JSON gönderilmesini bekliyor. Yani Python, Home Assistant ya da istediğin başka bir şeyle de besleyebilirsin.

## Kılıf

[hardware/README.md](hardware/README.md)

## Lisans

MIT
