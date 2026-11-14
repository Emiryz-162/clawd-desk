# Case

The first build uses the **[clawd-meter](https://makerworld.com/en/models/2906020-clawd-meter)** case from MakerWorld (MIT licensed, made for the ESP32-2432S028R). It was printed in orange filament on a Bambu Lab A1 and the screen fit perfectly.

Suggested settings (from the model page): 0.2 mm layers, 2 walls, 15% infill.

## Notes

- The **RGB LED** on the back of the board is used as a status light. A thin back wall or a small hole lets you see it.
- The **BOOT button** (GPIO0) is on the back, and the firmware uses it as "next screen". A small button extension in the case would make it easy to reach.
- The **light sensor (LDR)** is on the front, next to the screen. If the case covers it, night mode stays on. In that case, set `NIGHT_ENABLED 0` in `firmware/include/config.h`.

## Ideas

- A BOOT button extension built into Clawd's arm
- Two-color print (AMS Lite): orange body, cream feet
