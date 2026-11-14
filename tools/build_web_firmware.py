#!/usr/bin/env python3
"""Builds one ready-to-flash image per board type for the browser flasher.

    python tools/build_web_firmware.py [version]

For every PlatformIO environment it builds the firmware and writes:

    site/firmware/<env>/manifest.json      ESP Web Tools manifest
    site/firmware/<env>/*.bin              the four parts, flashed separately so
                                           the saved Wi-Fi (NVS) survives updates
    site/firmware/<env>/clawd-desk.bin     everything merged at offset 0, for
                                           release downloads (erases saved Wi-Fi)

Needs PlatformIO (`pip install platformio`). Uses the esptool that ships with
PlatformIO, or the `esptool` Python package if that is installed.
"""
import json
import os
import pathlib
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
FIRMWARE = ROOT / "firmware"
OUT = ROOT / "site" / "firmware"
ENVS = ["cyd", "cyd_inv", "cyd2usb"]
PIO_HOME = pathlib.Path(os.environ.get("PLATFORMIO_CORE_DIR", pathlib.Path.home() / ".platformio"))


def esptool_cmd():
    try:
        import esptool  # noqa: F401
        return [sys.executable, "-m", "esptool"]
    except ImportError:
        path = PIO_HOME / "packages" / "tool-esptoolpy" / "esptool.py"
        if not path.exists():
            sys.exit("esptool not found: run `pip install esptool`")
        return [sys.executable, str(path)]


def main():
    version = sys.argv[1] if len(sys.argv) > 1 else "dev"
    boot_app0 = PIO_HOME / "packages" / "framework-arduinoespressif32" / "tools" / "partitions" / "boot_app0.bin"
    for env in ENVS:
        print(f"== {env}", flush=True)
        subprocess.run([sys.executable, "-m", "platformio", "run", "-d", str(FIRMWARE), "-e", env], check=True)
        build = FIRMWARE / ".pio" / "build" / env
        out = OUT / env
        out.mkdir(parents=True, exist_ok=True)
        parts = [
            (0x1000, build / "bootloader.bin", "bootloader.bin"),
            (0x8000, build / "partitions.bin", "partitions.bin"),
            (0xE000, boot_app0, "boot_app0.bin"),
            (0x10000, build / "firmware.bin", "firmware.bin"),
        ]
        for _, src, name in parts:
            shutil.copyfile(src, out / name)
        merge_args = []
        for offset, src, _ in parts:
            merge_args += [hex(offset), str(src)]
        subprocess.run(
            esptool_cmd() + [
                "--chip", "esp32", "merge_bin", "-o", str(out / "clawd-desk.bin"),
                "--flash_mode", "dio", "--flash_freq", "40m", "--flash_size", "4MB",
            ] + merge_args,
            check=True,
        )
        manifest = {
            "name": "Clawd Desk",
            "version": version,
            "new_install_prompt_erase": True,
            "builds": [{
                "chipFamily": "ESP32",
                "parts": [{"path": name, "offset": offset} for offset, _, name in parts],
            }],
        }
        (out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Images written to {OUT}")


if __name__ == "__main__":
    main()
