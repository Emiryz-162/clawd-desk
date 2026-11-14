// Parses local Claude Code and Codex session logs into one common shape.
//
//   Claude Code: ~/.claude/projects/<project>/<session-id>.jsonl
//   Codex:       ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl
//
// Files are read incrementally (only new lines on each pass).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { JsonlTail } from './jsonl.mjs';
import { cleanText, clip } from './format.mjs';

export const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
export const CODEX_DIR = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');

const ts = (v) => {
  if (typeof v === 'number') return v < 1e12 ? v * 1000 : v;
  const t = Date.parse(v ?? '');
  return Number.isFinite(t) ? t : 0;
};

/** Short tag + one-line description for a tool call. */
export function describeTool(name, input, cwd) {
  input = input || {};
  const rel = (p) => {
    if (!p) return '';
    try {
      const r = path.relative(cwd || '', p);
      return r && !r.startsWith('..') && !path.isAbsolute(r) ? r.replace(/\\/g, '/') : path.basename(p);
    } catch {
      return path.basename(p);
    }
  };
  const first = (s) => String(s ?? '').split('\n')[0];
  switch (name) {
    case 'Read': return { tag: 'READ', text: rel(input.file_path) };
    case 'Edit': case 'MultiEdit': case 'Write': case 'NotebookEdit':
      return { tag: 'EDIT', text: rel(input.file_path || input.notebook_path) };
    case 'Bash': case 'PowerShell': case 'shell': case 'exec_command':
      return { tag: 'BASH', text: first(input.command || input.cmd) };
    case 'Grep': case 'Glob': return { tag: 'FIND', text: input.pattern || '' };
    case 'WebFetch': case 'WebSearch': return { tag: 'WEB', text: input.url || input.query || '' };
    case 'Agent': case 'Task': return { tag: 'AGENT', text: input.description || '' };
    case 'TodoWrite': return { tag: 'TODO', text: 'görev listesi' };
    default: return { tag: String(name || '?').slice(0, 5).toUpperCase(), text: first(input.description || '') };
  }
}

class BaseSession {
  constructor(file, source) {
    this.file = file;
    this.source = source;           // 'claude' | 'codex'
    this.tail = new JsonlTail(file);
    this.id = path.basename(file, '.jsonl');
    this.cwd = '';
    this.firstTs = 0;
    this.lastTs = 0;
    this.promptTs = 0;
    this.prompt = '';
    this.last = '';
    this.model = '';
    this.toolCount = 0;
    this.files = new Set();
    this.ctx = 0;
    this.ctxWindow = 0;
    this.recent = [];               // [{tag, text, ts}], newest last
    this.todo = null;               // {done, total}
    this.turnOpen = false;          // a request is in progress
    this.pending = null;            // {cmd, ts} approval needed (Codex)
    this.completedTs = 0;
    this.mtime = 0;
  }

  get name() {
    return this.cwd ? path.basename(this.cwd) : this.id.slice(0, 12);
  }

  update() {
    try {
      this.mtime = fs.statSync(this.file).mtimeMs;
    } catch {
      return;
    }
    for (const o of this.tail.read()) {
      const t = ts(o.timestamp);
      if (t) {
        if (!this.firstTs) this.firstTs = t;
        this.lastTs = Math.max(this.lastTs, t);
      }
      try {
        this.feed(o, t);
      } catch {
        /* one odd line should never stop the parser */
      }
    }
  }

  pushTool(name, input, t) {
    this.toolCount++;
    this.recent.push({ ...describeTool(name, input, this.cwd), ts: t || Date.now() });
    if (this.recent.length > 6) this.recent.shift();
  }
}

// ----------------------------------------------------------------- Claude
export class ClaudeSession extends BaseSession {
  constructor(file) {
    super(file, 'claude');
    this.ctxWindow = 200000;
  }

  feed(o, t) {
    if (o.isSidechain) return;
    if (o.cwd && !this.cwd) this.cwd = o.cwd;

    // written regularly, so it also covers huge logs we only read the end of
    if (o.type === 'last-prompt' && o.lastPrompt && !this.prompt) {
      this.prompt = clip(cleanText(o.lastPrompt), 200);
      return;
    }

    if (o.type === 'user' && !o.isMeta) {
      const c = o.message?.content;
      let text = '';
      if (typeof c === 'string') text = c;
      else if (Array.isArray(c) && !c.some((b) => b.type === 'tool_result')) {
        text = c.filter((b) => b.type === 'text').map((b) => b.text).join(' ');
      }
      text = cleanText(text);
      if (text && !text.startsWith('Caveat:')) {
        this.prompt = clip(text, 200);
        this.promptTs = t;
        this.turnOpen = true;
        this.recent = [];
      }
      return;
    }

    if (o.type === 'assistant' && o.message) {
      const m = o.message;
      if (m.model && !m.model.startsWith('<')) this.model = m.model;
      const u = m.usage;
      if (u) this.ctx = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
      for (const b of m.content || []) {
        if (b.type === 'tool_use') {
          this.pushTool(b.name, b.input, t);
          const fp = b.input?.file_path || b.input?.notebook_path;
          if (fp && /Edit|Write/.test(b.name)) this.files.add(fp);
          if (b.name === 'TodoWrite' && Array.isArray(b.input?.todos)) {
            const todos = b.input.todos;
            this.todo = { done: todos.filter((x) => x.status === 'completed').length, total: todos.length };
          }
        } else if (b.type === 'text' && b.text?.trim()) {
          this.last = clip(cleanText(b.text), 320);
        }
      }
      if (m.stop_reason === 'end_turn') {
        this.turnOpen = false;
        this.completedTs = t || Date.now();
      } else if (m.stop_reason === 'tool_use') {
        this.turnOpen = true;
      }
    }
  }

  get tool() { return 'Claude Code'; }
}

// ------------------------------------------------------------------ Codex
export class CodexSession extends BaseSession {
  constructor(file) {
    super(file, 'codex');
    this.rateLimits = null;   // {primary, secondary}
    this.rateLimitsTs = 0;
    this.readMeta();
  }

  // Big logs are read from the end only, so pick the project folder out of
  // the first line (session_meta) separately.
  readMeta() {
    try {
      const fd = fs.openSync(this.file, 'r');
      const buf = Buffer.alloc(4 * 1024 * 1024);
      const n = fs.readSync(fd, buf, 0, buf.length, 0);
      fs.closeSync(fd);
      // only the header and the user's requests: tool calls come from the tail
      const lines = buf.subarray(0, n).toString('utf8').split('\n');
      lines.pop(); // probably cut in half
      for (const line of lines) {
        if (!/"type":"(session_meta|turn_context)"|"role":"user"/.test(line.slice(0, 400))) continue;
        try {
          const o = JSON.parse(line);
          if (o.type === 'session_meta' || o.type === 'turn_context' || o.payload?.role === 'user') {
            this.feed(o, Date.parse(o.timestamp) || 0);
          }
        } catch { /* skip */ }
      }
    } catch {
      /* fine: turn_context lines carry cwd as well */
    }
  }

  feed(o, t) {
    const p = o.payload || {};
    if (o.type === 'session_meta') {
      this.cwd = p.cwd || this.cwd;
      if (p.id) this.id = p.id;
      return;
    }
    if (o.type === 'turn_context') {
      this.cwd = p.cwd || this.cwd;
      if (p.model) this.model = p.model;
      return;
    }
    if (o.type === 'response_item') {
      if (p.type === 'message' && p.role === 'user') {
        const raw = (p.content || []).map((c) => c.text || '').join(' ')
          .replace(/<(environment_context|user_instructions|turn_aborted|permissions[^>]*)>[\s\S]*?<\/\1>/g, ' ');
        if (!/^\s*(# AGENTS\.md|<)/.test(raw)) this.setPrompt(raw, t);
        return;
      }
      if (['function_call', 'custom_tool_call', 'local_shell_call'].includes(p.type)) {
        let input = {};
        if (typeof p.arguments === 'string') {
          try { input = JSON.parse(p.arguments); } catch { /* keep {} */ }
        } else if (p.action?.command) {
          input = { command: [].concat(p.action.command).join(' ') };
        }
        if (typeof p.input === 'string') {
          const cmd = p.input.match(/cmd\s*:\s*"((?:[^"\\]|\\.)*)"/);
          if (cmd) input = { command: cmd[1].replace(/\\"/g, '"') };
          for (const f of p.input.matchAll(/\*\*\* (?:Update|Add) File: (.+)/g)) this.files.add(f[1].trim());
          if (/apply_patch/.test(p.input) && !cmd) {
            const f = p.input.match(/\*\*\* (?:Update|Add) File: (.+)/);
            this.pushTool('Edit', { file_path: f ? f[1].trim() : '' }, t);
            this.pending = null;
            return;
          }
        }
        if (p.name === 'wait' || p.name === 'write_stdin') return; // plumbing, not a real step
        this.pushTool(input.command ? 'exec_command' : p.name, input, t);
        this.pending = null;
      }
      return;
    }
    if (o.type === 'event_msg') {
      switch (p.type) {
        case 'task_started':
          this.turnOpen = true;
          if (p.model_context_window) this.ctxWindow = p.model_context_window;
          break;
        case 'task_complete':
          this.turnOpen = false;
          this.pending = null;
          this.completedTs = t || Date.now();
          if (p.last_agent_message) this.last = clip(cleanText(p.last_agent_message), 320);
          break;
        case 'turn_aborted':
          this.turnOpen = false;
          this.pending = null;
          break;
        case 'user_message':
          this.setPrompt(p.message, t);
          break;
        case 'item_completed':
          if (p.item?.type === 'UserMessage') {
            this.setPrompt((p.item.content || []).map((c) => c.text || '').join(' '), t);
          } else if (p.item?.type === 'AgentMessage') {
            const txt = (p.item.content || []).map((c) => c.text || '').join(' ');
            if (txt.trim()) this.last = clip(cleanText(txt), 320);
          }
          break;
        case 'agent_message':
          if (p.message) this.last = clip(cleanText(p.message), 320);
          break;
        case 'exec_approval_request':
        case 'apply_patch_approval_request':
          this.pending = { cmd: [].concat(p.command || p.reason || 'apply_patch').join(' '), ts: t || Date.now() };
          break;
        case 'exec_command_begin':
        case 'patch_apply_begin':
          this.pending = null;
          break;
        case 'token_count':
          if (p.info?.last_token_usage) this.ctx = p.info.last_token_usage.input_tokens || this.ctx;
          if (p.info?.model_context_window) this.ctxWindow = p.info.model_context_window;
          if (p.rate_limits) {
            this.rateLimits = p.rate_limits;
            this.rateLimitsTs = t || Date.now();
          }
          break;
        case 'thread_settings_applied':
          if (p.thread_settings?.model) this.model = p.thread_settings.model;
          break;
      }
    }
  }

  setPrompt(text, t) {
    text = cleanText(text);
    if (!text) return;
    this.prompt = clip(text, 200);
    this.promptTs = t;
    this.recent = [];
  }

  get tool() { return 'Codex'; }
}

// ------------------------------------------------------------- discovery
function walk(dir, depth, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (depth > 0 && e.name !== 'subagents') walk(p, depth - 1, out);
    } else if (e.name.endsWith('.jsonl')) {
      out.push(p);
    }
  }
}

/** Newest session files of both tools, modified within maxAgeMs. */
export function findSessionFiles(maxAgeMs = 3 * 86400000, limit = 8) {
  const now = Date.now();
  const files = [];
  const claude = [];
  walk(path.join(CLAUDE_DIR, 'projects'), 1, claude);
  for (const f of claude) files.push({ file: f, source: 'claude' });
  const codex = [];
  walk(path.join(CODEX_DIR, 'sessions'), 3, codex);
  for (const f of codex) files.push({ file: f, source: 'codex' });

  const withTime = [];
  for (const f of files) {
    try {
      const m = fs.statSync(f.file).mtimeMs;
      if (now - m <= maxAgeMs) withTime.push({ ...f, mtime: m });
    } catch { /* gone */ }
  }
  withTime.sort((a, b) => b.mtime - a.mtime);
  return withTime.slice(0, limit);
}

/** Keeps parsers alive between passes so each file is read incrementally. */
export class SessionStore {
  constructor() {
    this.byFile = new Map();
  }

  refresh() {
    const found = findSessionFiles();
    const keep = new Set(found.map((f) => f.file));
    for (const f of found) {
      if (!this.byFile.has(f.file)) {
        this.byFile.set(f.file, f.source === 'claude' ? new ClaudeSession(f.file) : new CodexSession(f.file));
      }
    }
    for (const k of [...this.byFile.keys()]) if (!keep.has(k)) this.byFile.delete(k);
    const list = [...this.byFile.values()];
    for (const s of list) s.update();
    // Codex sessions that never got a user prompt (e.g. empty) are noise
    return list.filter((s) => s.prompt || s.toolCount).sort((a, b) => b.mtime - a.mtime);
  }

  /** Latest Codex rate-limit snapshot across all known Codex sessions. */
  codexRateLimits() {
    let best = null;
    for (const s of this.byFile.values()) {
      if (s.source === 'codex' && s.rateLimits && (!best || s.rateLimitsTs > best.ts)) {
        best = { ...s.rateLimits, ts: s.rateLimitsTs };
      }
    }
    return best;
  }
}
