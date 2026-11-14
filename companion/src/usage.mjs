// Claude plan usage (5-hour and weekly windows).
//
// Claude Code keeps an OAuth token in ~/.claude/.credentials.json. The same
// token can read your own usage from the endpoint Claude Code's /usage screen
// uses. It is not a documented public API and may change; if it fails the
// screen simply shows "?" for Claude.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CLAUDE_DIR } from './sessions.mjs';

const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';

function readToken() {
  try {
    const raw = fs.readFileSync(path.join(CLAUDE_DIR, '.credentials.json'), 'utf8');
    const o = JSON.parse(raw).claudeAiOauth;
    if (!o?.accessToken) return { error: 'no token' };
    if (o.expiresAt && o.expiresAt < Date.now()) return { error: 'token expired (open Claude Code once)' };
    return { token: o.accessToken };
  } catch {
    return { error: 'no credentials file' };
  }
}

/**
 * @returns {Promise<{p5:number, r5ts:number, pw:number, rwts:number} | {error:string}>}
 */
export async function fetchClaudeUsage() {
  const { token, error } = readToken();
  if (!token) return { error };
  try {
    const res = await fetch(USAGE_URL, {
      headers: {
        Authorization: `Bearer ${token}`,
        'anthropic-beta': 'oauth-2025-04-20',
        'Content-Type': 'application/json',
        'User-Agent': 'clawd-desk',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const j = await res.json();
    const five = j.five_hour || {};
    const week = j.seven_day || {};
    return {
      p5: Math.round(five.utilization ?? 0),
      r5ts: Date.parse(five.resets_at ?? '') || 0,
      pw: Math.round(week.utilization ?? 0),
      rwts: Date.parse(week.resets_at ?? '') || 0,
    };
  } catch (e) {
    return { error: e.name === 'TimeoutError' ? 'timeout' : e.message };
  }
}

/**
 * Claude usage saved by our status line script (src/statusline.mjs).
 * Preferred source: it comes straight from Claude Code, no extra request.
 */
export function readStatuslineUsage(now = Date.now()) {
  try {
    const u = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.clawd-desk', 'claude-usage.json'), 'utf8'));
    if (now - u.ts > 12 * 3600e3) return { error: 'status line data is old' };
    // a window whose reset time has passed is back to 0
    const p5 = u.r5ts && u.r5ts < now ? 0 : u.p5 ?? 0;
    const pw = u.rwts && u.rwts < now ? 0 : u.pw ?? 0;
    return { p5, r5ts: u.r5ts > now ? u.r5ts : 0, pw, rwts: u.rwts > now ? u.rwts : 0, ts: u.ts };
  } catch {
    return { error: 'no status line data yet' };
  }
}

/** Codex rate limits come from its own session logs (no network needed). */
export function codexUsage(rl, now = Date.now()) {
  if (!rl) return { error: 'no Codex session yet' };
  const win = (w) => {
    if (!w) return { p: 0, reset: 0 };
    let reset = w.resets_at ? w.resets_at * 1000 : 0;
    if (!reset && w.resets_in_seconds != null) reset = rl.ts + w.resets_in_seconds * 1000;
    // the window has already rolled over since the snapshot was written
    const p = reset && reset < now ? 0 : Math.round(w.used_percent ?? 0);
    return { p, reset };
  };
  const a = win(rl.primary);
  const b = win(rl.secondary);
  return { p5: a.p, r5ts: a.reset, pw: b.p, rwts: b.reset };
}
