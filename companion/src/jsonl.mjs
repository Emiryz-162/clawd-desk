import fs from 'node:fs';

/**
 * Reads a growing .jsonl file incrementally: each call to read() returns only
 * the complete lines appended since the previous call, already JSON-parsed.
 */
export class JsonlTail {
  constructor(file, { maxInitialBytes = 8 * 1024 * 1024 } = {}) {
    this.file = file;
    this.offset = 0;
    this.rest = Buffer.alloc(0);
    this.maxInitialBytes = maxInitialBytes;
    this.truncatedStart = false;
  }

  read() {
    let st;
    try {
      st = fs.statSync(this.file);
    } catch {
      return [];
    }
    if (st.size < this.offset) {
      // file was rewritten: start over
      this.offset = 0;
      this.rest = Buffer.alloc(0);
    }
    if (this.offset === 0 && st.size > this.maxInitialBytes) {
      this.offset = st.size - this.maxInitialBytes;
      this.truncatedStart = true;
    }
    if (st.size === this.offset) return [];

    const len = st.size - this.offset;
    const buf = Buffer.alloc(len);
    const fd = fs.openSync(this.file, 'r');
    try {
      fs.readSync(fd, buf, 0, len, this.offset);
    } finally {
      fs.closeSync(fd);
    }
    const startedMidFile = this.offset > 0 && this.rest.length === 0 && this.truncatedStart;
    this.offset = st.size;
    let data = Buffer.concat([this.rest, buf]);
    const lastNl = data.lastIndexOf(0x0a);
    if (lastNl < 0) {
      this.rest = data;
      return [];
    }
    this.rest = data.subarray(lastNl + 1);
    data = data.subarray(0, lastNl);

    const lines = data.toString('utf8').split('\n');
    if (startedMidFile) {
      lines.shift(); // first line is probably cut in half
      this.truncatedStart = false;
    }
    const out = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        out.push(JSON.parse(line));
      } catch {
        /* ignore broken lines */
      }
    }
    return out;
  }
}
