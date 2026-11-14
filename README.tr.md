# Clawd Desk (Türkçe)

Masanda duran küçük bir Clawd. 10 dolarlık bir ESP32 dokunmatik ekranda **Claude Code** ve **Codex** limitlerini, ajanının şu an ne yaptığını, onay bekleyen komutları ve son oturumlarını gösterir.

[English](README.md) · Ayrıntılı rehber ve sorun giderme İngilizce README'de.

> Bağımsız bir hayran projesidir. Anthropic veya OpenAI ile bağlantılı değildir.

## Kısaca

- **Ekran kendi kendine döner:** Ana ekran, Limitler ve Canlı oturum arasında her 10 saniyede bir geçer.
- **Olaylar öne çıkar:** Onay bekleyen bir komut varsa ekran o sayfada kalır ve LED sarı yanıp söner. İş bitince Clawd 6 saniye sevinir.
- **Üç büyük dokunma bölgesi var:** sol, orta ve sağ.
- **Gece modu:** Işık sensörü oda kararınca ekranı karartır.
- **BOOT tuşu:** Arkadaki tuş "sonraki" tuşu olarak çalışır.

## Kurulum

1. **Firmware'i yükle:** VS Code'da `firmware` klasörünü aç. PlatformIO menüsünden kartına uygun ortamı seç ve **Upload**'a bas:
   - Çoğu kart için `cyd`
   - Renkler negatif gibi görünüyorsa `cyd_inv`
   - Kartta hem micro USB hem USB-C varsa `cyd2usb`
2. **Wi-Fi'ye bağla:** Telefonundan `ClawdDesk-Setup` ağına bağlan ve açılan sayfadan evdeki Wi-Fi'yi seç.
3. **Bilgisayar tarafını kur:** `companion` klasöründe sırayla şunları çalıştır. Türkçe ekran için `--lang tr` ekliyoruz:

```bash
node src/cli.mjs config --device clawd-desk.local --lang tr
```

```bash
node src/cli.mjs install
```

```bash
node src/cli.mjs run
```

Windows'ta açılışta kendiliğinden başlaması için:

```bash
node src/cli.mjs autostart
```

Claude Code ayarlarına yaptığı değişiklikleri geri almak için:

```bash
node src/cli.mjs uninstall
```

## Lisans

[MIT](LICENSE)
