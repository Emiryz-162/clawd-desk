// Claude plan usage (5-hour and weekly windows).
//
// Claude Code keeps its login in ~/.claude/.credentials.json. With it we can
// read your own usage from the endpoint Claude Code's /usage screen uses.
// When the short-lived access token expires (if you mostly use the desktop
// app, Claude Code isn't there to renew it), we renew it the same way Claude
// Code does and save it back in the same file, so Claude Code keeps working.
// None of this is a documented public API; if it fails, the screen falls
// back to status line data or shows "?".
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CLAUDE_DIR } from './sessions.mjs';

const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';
const TOKEN_URLS = ['https://console.anthropic.com/v1/oauth/token', 'https://platform.claude.com/v1/oauth/token'];
const CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e'; // Claude Code's public OAuth client
const credPath = () => path.join(CLAUDE_DIR, '.credentials.json');

function readCreds() {
  try {
    const all = JSON.parse(fs.readFileSync(credPath(), 'utf8'));
    return all.claudeAiOauth ? all : null;
  } catch {
    return null;
  }
}

// Write next to the file, then rename, so a crash never leaves it half written.
function writeCreds(all) {
  const p = credPath();
  const tmp = `${p}.clawd-desk.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(all), { mode: 0o600 });
  fs.renameSync(tmp, p);
}

let refreshing = null;

async function renew(all) {
  const o = all.claudeAiOauth;
  if (!o.refreshToken) return { error: 'no refresh token (sign in to Claude Code once)' };
  if (o.refreshTokenExpiresAt && o.refreshTokenExpiresAt < Date.now()) {
    return { error: 'login expired (sign in to Claude Code once)' };
  }
  let lastError = '';
  for (const url of TOKEN_URLS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'clawd-desk' },
        body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: o.refreshToken, client_id: CLIENT_ID }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) { lastError = `renew HTTP ${res.status}`; continue; }
      const j = await res.json();
      if (!j.access_token) { lastError = 'renew: no token in reply'; continue; }
      // Claude Code may have renewed it meanwhile: only write if the file is unchanged
      const now = readCreds();
      if (now?.claudeAiOauth?.refreshToken !== o.refreshToken) return { token: now.claudeAiOauth.accessToken };
      now.claudeAiOauth = {
        ...now.claudeAiOauth,
        accessToken: j.access_token,
        refreshToken: j.refresh_token || o.refreshToken,
        expiresAt: Date.now() + (j.expires_in || 3600) * 1000,
      };
      writeCreds(now);
      return { token: j.access_token, renewed: true };
    } catch (e) {
      lastError = e.name === 'TimeoutError' ? 'renew timeout' : e.message;
    }
  }
  return { error: lastError };
}

async function getToken() {
  const all = readCreds();
  if (!all) return { error: 'no Claude Code login on this computer' };
  const o = all.claudeAiOauth;
  if (o.accessToken && (!o.expiresAt || o.expiresAt - 5 * 60e3 > Date.now())) return { token: o.accessToken };
  refreshing ??= renew(all).finally(() => { refreshing = null; });
  return refreshing;
}

/**
 * @returns {Promise<{p5:number, r5ts:number, pw:number, rwts:number, renewed?:boolean} | {error:string}>}
 */
export async function fetchClaudeUsage() {
  const { token, error, renewed } = await getToken();
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
      renewed,
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
