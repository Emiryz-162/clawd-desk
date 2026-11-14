// Live status from Claude Code hooks.
//
// `clawd-desk install-hooks` adds a tiny hook (src/hook.mjs) to
// ~/.claude/settings.json. Every hook event is forwarded to the companion's
// local server, which turns it into working / waiting / done instantly
// (instead of guessing from log files).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { commandFor, MARK } from './runtime.mjs';
import { CLAUDE_DIR } from './sessions.mjs';

const EVENTS = ['UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Notification', 'Stop', 'SessionEnd'];
const TOOL_EVENTS = new Set(['PreToolUse', 'PostToolUse']);

export class HookState {
  constructor() {
    this.map = new Map();
  }

  get(id) {
    return this.map.get(id);
  }

  handle(evt) {
    const id = evt.session_id;
    if (!id) return false;
    const cur = this.map.get(id) || {};
    let status = cur.status || 'working';
    let toolName = cur.toolName;
    let toolInput = cur.toolInput;
    switch (evt.hook_event_name) {
      case 'UserPromptSubmit':
        status = 'working';
        toolName = toolInput = undefined;
        break;
      case 'PreToolUse':
        status = 'working';
        toolName = evt.tool_name;
        toolInput = evt.tool_input;
        break;
      case 'PostToolUse':
        status = 'working';
        break;
      case 'PermissionRequest':
        status = 'waiting';
        if (evt.tool_name) { toolName = evt.tool_name; toolInput = evt.tool_input; }
        break;
      case 'Notification':
        if (/permission|approv|izin/i.test(evt.message || '')) status = 'waiting';
        else if (status === 'working' || status === 'waiting') status = 'done';
        break;
      case 'Stop':
        status = 'done';
        break;
      case 'SessionEnd':
        status = 'idle';
        break;
      default:
        return false;
    }
    this.map.set(id, { status, ts: Date.now(), toolName, toolInput, cwd: evt.cwd, message: evt.message });
    return true;
  }
}

// ---------------------------------------------------------------- install
const settingsPath = () => path.join(CLAUDE_DIR, 'settings.json');

export function hookCommand() {
  return commandFor('hook');
}

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsPath(), 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return {};
    throw new Error(`Could not read ${settingsPath()}: ${e.message}`);
  }
}

function writeSettings(s) {
  const p = settingsPath();
  if (fs.existsSync(p)) fs.copyFileSync(p, `${p}.clawd-desk.bak`);
  fs.writeFileSync(p, `${JSON.stringify(s, null, 2)}\n`);
}

function stripOurs(settings) {
  const hooks = settings.hooks || {};
  for (const ev of Object.keys(hooks)) {
    hooks[ev] = (hooks[ev] || [])
      .map((m) => ({ ...m, hooks: (m.hooks || []).filter((h) => !String(h.command || '').includes(MARK)) }))
      .filter((m) => m.hooks.length);
    if (!hooks[ev].length) delete hooks[ev];
  }
  settings.hooks = hooks;
  if (!Object.keys(hooks).length) delete settings.hooks;
  return settings;
}

export function installHooks() {
  const s = stripOurs(readSettings());
  s.hooks = s.hooks || {};
  const command = hookCommand();
  for (const ev of EVENTS) {
    const entry = { hooks: [{ type: 'command', command, timeout: 5 }] };
    if (TOOL_EVENTS.has(ev)) entry.matcher = '*';
    s.hooks[ev] = [...(s.hooks[ev] || []), entry];
  }
  writeSettings(s);
  return { path: settingsPath(), command, events: EVENTS };
}

export function uninstallHooks() {
  writeSettings(stripOurs(readSettings()));
  return { path: settingsPath() };
}

// ------------------------------------------------------------- status line
const CHAIN_FILE = path.join(os.homedir(), '.clawd-desk', 'statusline-chain.json');

export function statuslineCommand() {
  return commandFor('statusline');
}

export function installStatusline() {
  const s = readSettings();
  const prev = s.statusLine;
  if (prev?.command && !String(prev.command).includes(MARK)) {
    // keep the user's own status line running through ours
    fs.mkdirSync(path.dirname(CHAIN_FILE), { recursive: true });
    fs.writeFileSync(CHAIN_FILE, JSON.stringify({ command: prev.command, original: prev }, null, 2));
  }
  s.statusLine = { type: 'command', command: statuslineCommand() };
  writeSettings(s);
  return { path: settingsPath(), chained: Boolean(prev?.command && !String(prev.command).includes(MARK)) };
}

export function uninstallStatusline() {
  const s = readSettings();
  if (String(s.statusLine?.command || '').includes(MARK)) {
    let original;
    try { original = JSON.parse(fs.readFileSync(CHAIN_FILE, 'utf8')).original; } catch { /* none */ }
    if (original) s.statusLine = original;
    else delete s.statusLine;
    try { fs.unlinkSync(CHAIN_FILE); } catch { /* none */ }
    writeSettings(s);
  }
  return { path: settingsPath() };
}
