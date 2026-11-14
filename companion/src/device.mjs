// Sends the state JSON to the screen: over Wi-Fi (HTTP POST /state) or over
// USB serial (one JSON document per line; needs the optional `serialport`
// package: `npm install` inside companion/).

export class DeviceLink {
  constructor({ device, serial, log = console.log }) {
    this.device = device;
    this.serial = serial;
    this.log = log;
    this.port = null;
    this.ok = null;
  }

  describe() {
    return this.serial ? `USB ${this.serial}` : `http://${this.device}`;
  }

  async send(state) {
    const body = JSON.stringify(state);
    let ok = false;
    let why = '';
    try {
      if (this.serial) {
        await this.openSerial();
        await new Promise((res, rej) => this.port.write(`${body}\n`, (e) => (e ? rej(e) : res())));
        ok = true;
      } else {
        const r = await fetch(`http://${this.device}/state`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
          signal: AbortSignal.timeout(4000),
        });
        ok = r.ok;
        if (!ok) why = `HTTP ${r.status}`;
      }
    } catch (e) {
      why = e.cause?.code || e.message;
      if (this.port) { try { this.port.close(); } catch { /* ignore */ } this.port = null; }
    }
    if (ok !== this.ok) {
      this.log(ok ? `screen connected: ${this.describe()}` : `cannot reach the screen (${this.describe()}): ${why}`);
      this.ok = ok;
    }
    return ok;
  }

  async openSerial() {
    if (this.port) return;
    let SerialPort;
    try {
      ({ SerialPort } = await import('serialport'));
    } catch {
      throw new Error('For USB, run `npm install` in companion/ first (serialport package)');
    }
    this.port = await new Promise((res, rej) => {
      const p = new SerialPort({ path: this.serial, baudRate: 115200, hupcl: false }, (e) => (e ? rej(e) : res(p)));
    });
    // opening the port resets the ESP32; give it time to boot
    await new Promise((r) => setTimeout(r, 2500));
  }
}
