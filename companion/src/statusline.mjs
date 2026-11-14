#!/usr/bin/env node
// Claude Code status line -> Clawd Desk.
//
// Claude Code runs this after each reply and passes the session info on
// stdin, including `rate_limits.five_hour` / `rate_limits.seven_day` for
// Pro / Max subscribers. We save those to ~/.clawd-desk/claude-usage.json
// for the companion, then print a short status line.
//
// If you already had a status line, `install-statusline` remembers it in
// ~/.clawd-desk/statusline-chain.json and this script runs it and prints its
// output instead, so nothing changes for you.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DIR = path.join(os.homedir(), '.clawd-desk');

// Runs as `node src/statusline.mjs` from source, or `clawd-desk.exe statusline`.
export function runStatusline() {
let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { raw += c; });
process.stdin.on('end', () => {
  let o = {};
  try { o = JSON.parse(raw); } catch { /* keep {} */ }

  const rl = o.rate_limits || {};
  const five = rl.five_hour;
  const week = rl.seven_day;
  if (five || week) {
    try {
      fs.mkdirSync(DIR, { recursive: true });
      fs.writeFileSync(path.join(DIR, 'claude-usage.json'), JSON.stringify({
        ts: Date.now(),
        p5: five ? Math.round(five.used_percentage) : null,
        r5ts: five?.resets_at ? five.resets_at * 1000 : 0,
        pw: week ? Math.round(week.used_percentage) : null,
        rwts: week?.resets_at ? week.resets_at * 1000 : 0,
      }));
    } catch { /* never break the status line */ }
  }

  // previous status line, if there was one
  try {
    const chain = JSON.parse(fs.readFileSync(path.join(DIR, 'statusline-chain.json'), 'utf8'));
    if (chain?.command) {
      const r = spawnSync(chain.command, { input: raw, shell: true, encoding: 'utf8', timeout: 4000 });
      process.stdout.write(r.stdout || '');
      return;
    }
  } catch { /* no chain */ }

  const parts = [o.model?.display_name || 'Claude'];
  if (five) parts.push(`5h ${Math.round(five.used_percentage)}%`);
  if (week) parts.push(`week ${Math.round(week.used_percentage)}%`);
  if (o.context_window?.used_percentage != null) parts.push(`ctx ${Math.round(o.context_window.used_percentage)}%`);
  process.stdout.write(parts.join(' · '));
});
}

if (/[\\/]statusline\.mjs$/.test(process.argv[1] || '')) runStatusline();
