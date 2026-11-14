# Clawd Desk

A tiny Clawd for your desk. It shows your **Claude Code** and **Codex** usage limits, what your agent is doing right now, commands waiting for your approval, and your recent sessions, on a $10 ESP32 touchscreen.

[Türkçe](README.tr.md)

> An independent fan project. Not affiliated with, endorsed by or sponsored by Anthropic or OpenAI.

**What makes it different:** you almost never have to touch it.

- It **rotates by itself** between Home, Limits and the live session every 10 seconds.
- When something needs you, it **jumps to the front**. If a command is waiting for approval, the screen stays there and the LED blinks yellow. When a job finishes, Clawd celebrates for 6 seconds.
- When you do want to tap, there are just **three big touch zones** (left, middle, right), so the board's imprecise resistive touch never misses.
- The **light sensor** dims it at night, and the **BOOT button** on the back works as a "next" button.

---

## What you need

| | |
|---|---|
| **The board** | ESP32-2432S028R, also called "Cheap Yellow Display" or CYD (2.8", 320×240). About $10–15 online. |
| **A USB data cable** | Some cables only charge. If your computer doesn't see the board, try another cable. |
| **A case** (optional) | The [clawd-meter case on MakerWorld](https://makerworld.com/en/models/2906020-clawd-meter) fits this board. Print it in orange. See [hardware/](hardware/README.md). |
| **A computer** | Windows, macOS or Linux, with Claude Code and/or Codex. You need [Node.js](https://nodejs.org) 18 or newer. |
| **PlatformIO** | Used to put the firmware on the board. The easiest way is the [PlatformIO extension for VS Code](https://platformio.org/install/ide?install=vscode). |

## How it works

```
Claude Code / Codex           companion (Node.js, on your computer)      Clawd Desk (ESP32)
  session logs        ──►     reads them every 2 seconds        ──Wi-Fi──►  draws the screens,
  hooks, status line          builds a small JSON                or USB     animates Clawd,
                                                                            touch, LED
```

Everything stays on your computer and your home network. The companion reads files that Claude Code and Codex already write. It never sends your prompts anywhere except to the screen.

---

## Setup (about 15 minutes)

### Step 1: Get the code

Click **Code → Download ZIP** on GitHub and unzip it, or:

```bash
git clone https://github.com/Emiryz-162/clawd-desk.git
```

### Step 2: Put the firmware on the board

1. Plug the board into your computer with the USB cable.
2. In VS Code, open the `firmware` folder. PlatformIO downloads what it needs the first time, which takes a few minutes.
3. Click the PlatformIO icon in the left bar and pick your board type under **Project Tasks**:

   | Your board | Pick |
   |---|---|
   | Most boards (one micro USB port) | `cyd` |
   | Colors look like a photo negative (white background, blue instead of orange) | `cyd_inv` |
   | Board with both micro USB and USB-C | `cyd2usb` |

4. Click **Upload**. If it hangs on `Connecting.....`, hold the **BOOT** button on the back of the board until the upload starts.

Not sure which board you have? Start with `cyd`. If the colors look wrong, upload `cyd_inv` instead. Nothing breaks either way.

<details>
<summary>Using the terminal instead of VS Code</summary>

```bash
cd firmware
pio run -e cyd -t upload
```

On Windows with the VS Code extension, `pio` is not on your PATH. Use the full path instead:

```powershell
& "$env:USERPROFILE\.platformio\penv\Scripts\pio.exe" run -e cyd -t upload
```
</details>

### Step 3: Connect the board to Wi-Fi

1. The board restarts and shows **Wi-Fi setup**.
2. On your phone, join the Wi-Fi network called **`ClawdDesk-Setup`**.
3. A page opens. If it doesn't, go to `192.168.4.1` in your browser. Pick your home Wi-Fi and enter its password.
4. The board connects and shows sample data. The top-left corner says `DEMO · 192.168.x.x`. That's the board's address.

> If the board was used before and remembers a Wi-Fi network, it skips the setup and connects right away. To switch networks, hold **BOOT** for 5 seconds.

### Step 4: Start the companion on your computer

Open a terminal in the `companion` folder:

```bash
cd companion
```

Tell it where the screen is. `clawd-desk.local` works on most networks. If it doesn't, use the address from the screen's top-left corner, for example `--device 192.168.1.42`:

```bash
node src/cli.mjs config --device clawd-desk.local
```

Try it with fake data first. You should see every screen in turn:

```bash
node src/cli.mjs demo
```

Press `Ctrl+C` to stop the demo. Then connect Claude Code. This adds two small things to `~/.claude/settings.json` and saves a backup first:

```bash
node src/cli.mjs install
```

Finally, start it for real:

```bash
node src/cli.mjs run
```

That's it. Open <http://127.0.0.1:8787/> to see exactly what is being sent to the screen.

### Step 5 (optional): Start it automatically

**Windows:** this starts it hidden every time you log in. To undo it, run `node src/cli.mjs autostart off`.

```bash
node src/cli.mjs autostart
```

**macOS / Linux:** add a line to your crontab (`crontab -e`). Replace both paths: the project folder, and your Node.js (run `which node` to find it):

```bash
@reboot cd /path/to/clawd-desk/companion && /path/to/node src/cli.mjs run >> ~/.clawd-desk/companion.log 2>&1
```

---

## Using it

### Screens

| | Screen | When it shows |
|---|---|---|
| 1 | **Home** | Clawd's mood, the current job and two limit bars |
| 2 | **Limits** | Claude Code and Codex: 5-hour and weekly usage, with reset times |
| 3 | **Live session** | While a job is running: the current step, the last steps and the task list |
| 4 | **Needs approval** | When Claude or Codex asks for permission. It stays until you answer on your computer |
| 5 | **Sessions** | Your recent sessions. Tap the middle of the screen to open |
| 6 | **Session details** | Your request, time, steps, files, tokens and the last message |
| 7 | **Done!** | For 6 seconds when a job finishes |
| 8 | **Night** | When the room is dark: a big clock and a sleeping Clawd |

Screens 1–3 rotate on their own. 4, 7 and 8 appear when something happens. 5 and 6 only open when you tap.

### Touch zones

| | Left third | Middle third | Right third |
|---|---|---|---|
| Rotating screens | previous | open sessions | next |
| Session list | up | open details | down |
| Session details | back to list | home | next session |

If you don't touch anything for 15 seconds, it goes back to Home.

### LED and buttons

- **LED (on the back):** orange breathing = working, blinking yellow = needs approval, green = done.
- **BOOT button:** press for "next". Hold for 5 seconds to forget the Wi-Fi.

### Language

Screens are in English by default. Turkish is built in:

```bash
node src/cli.mjs config --lang tr
```

Adding another language takes two small files: `companion/src/i18n.mjs` and `firmware/src/lang.cpp`.

---

## Where the data comes from

| What | Source |
|---|---|
| Claude Code sessions | `~/.claude/projects/**/*.jsonl` (read only) |
| Codex sessions and limits | `~/.codex/sessions/**/rollout-*.jsonl` (read only) |
| Live status: working, needs approval, done | Claude Code hooks, sent to `127.0.0.1:8787` |
| Claude 5-hour and weekly limits | The `rate_limits` field Claude Code passes to its status line (Pro and Max plans). If that's missing, the companion asks Claude Code's usage endpoint with your saved login. |

The companion only listens on `127.0.0.1`. Its only network traffic is to your screen, plus that fallback limits request.

To undo the Claude Code changes at any time:

```bash
node src/cli.mjs uninstall
```

---

## Troubleshooting

<details>
<summary><b>Colors look wrong (white background, blue Clawd)</b></summary>

Upload the `cyd_inv` firmware instead of `cyd`.
</details>

<details>
<summary><b>"cannot reach the screen" / clawd-desk.local doesn't work</b></summary>

Use the IP address shown in the top-left corner of the screen:

```bash
node src/cli.mjs config --device 192.168.1.42
```

Your computer and the board must be on the same Wi-Fi network. Guest networks often block this.
</details>

<details>
<summary><b>Claude limits show "?"</b></summary>

Claude Code sends its limits to the status line only after it has answered at least once, and only on Pro and Max plans. In our testing, **the Claude desktop app didn't run the status line**. If you mostly use the desktop app, run `claude` in a terminal once and send any message. The limits stay valid for 12 hours.

Open <http://127.0.0.1:8787/> and check `claude_usage_from_status_line`.
</details>

<details>
<summary><b>The board isn't found when uploading</b></summary>

- Try another USB cable. Many cables only charge.
- On Windows, the board appears in Device Manager as `USB-SERIAL CH340`. If it doesn't, install the CH340 driver from WCH (search for "CH341SER").
- Hold BOOT while the upload says `Connecting.....`.
</details>

<details>
<summary><b>Touch zones are swapped, or night mode never turns off</b></summary>

Both are settings in `firmware/include/config.h`:

- Swapped zones: set `TOUCH_FLIP_X 1`.
- Night mode stuck on: your case may cover the light sensor. Set `NIGHT_ENABLED 0`, or raise `LDR_NIGHT_ABOVE`. The serial monitor prints the current reading (`ldr=...`) every 10 seconds.
</details>

<details>
<summary><b>The clock is in the wrong time zone</b></summary>

Change `CLAWD_TZ` in `firmware/include/config.h`. There are examples next to it.
</details>

---

## Make it yours

| File | What's in it |
|---|---|
| `firmware/include/config.h` | Timings, colors, time zone, night mode, LED brightness, touch calibration |
| `firmware/src/ui.cpp` | How every screen is drawn |
| `firmware/src/clawd.cpp` | Clawd's pixel-art animations |
| `companion/src/state.mjs` | What text goes to the screen |
| [`docs/protocol.md`](docs/protocol.md) | The JSON the screen accepts |

The screen just waits for JSON on `POST /state`, so you can also feed it from Python, Home Assistant or anything else.

## Credits

- Case: [clawd-meter](https://makerworld.com/en/models/2906020-clawd-meter) on MakerWorld (MIT)
- Inspired by [Clawdmeter](https://github.com/HermannBjorgvin/Clawdmeter), [clawd-mochi](https://github.com/yousifamanuel/clawd-mochi) and Anthropic's [claude-desktop-buddy](https://github.com/anthropics/claude-desktop-buddy)
- Clawd is the mascot of Claude Code. This project is not affiliated with Anthropic.

## License

[MIT](LICENSE)
