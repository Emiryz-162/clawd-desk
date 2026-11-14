# Kılıf

İlk sürümde MakerWorld'deki **[clawd-meter](https://makerworld.com/en/models/2906020-clawd-meter)** kılıfı kullanıldı (MIT lisanslı, ESP32-2432S028R için). Turuncu filamentle Bambu Lab A1'de basıldı ve ekran tam oturdu.

Önerilen ayarlar (model sayfasından): 0.2 mm katman, 2 duvar, %15 doluluk.

## Notlar

- Kartın arkasındaki **RGB LED** durum ışığı olarak kullanılıyor. Kılıfın arkasında ince bir duvar ya da küçük bir delik olursa ışığı görürsün.
- **BOOT tuşu** (GPIO0) kartın arkasında, firmware'de "sonraki ekran" tuşu. Kılıfa küçük bir buton uzantısı eklenebilir.
- **Işık sensörü (LDR)** kartın ön yüzünde, ekranın yanında. Kılıf onu kapatırsa gece modu hep açık kalır. Bu durumda `firmware/include/config.h` içinde `NIGHT_ENABLED 0` yap.

## Fikirler

- Blender'da Clawd'ın kollarına BOOT tuşu uzantısı
- İki renkli baskı (AMS Lite): gövde turuncu, ayak uçları krem
