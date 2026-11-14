#!/usr/bin/env node
// Clawd Desk companion.
//
//   node src/cli.mjs run      [--device clawd-desk.local | --serial COM5]
//   node src/cli.mjs demo     [--device ... | --serial ...]   cycles fake screens
//   node src/cli.mjs print    prints the JSON once (no device needed)
//   node src/cli.mjs install | uninstall   Claude Code hooks + status line
//   node src/cli.mjs config --device 192.168.1.42 --lang en   saves settings
//
// Settings live in ~/.clawd-desk/config.json:
//   { "device": "192.168.1.42", "serial": null, "lang": "en", "port": 8787, "interval": 2 }
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { disableAutostart, enableAutostart, logPath } from './autostart.mjs';
import { DEMO_STEPS } from './demo.mjs';
import { DeviceLink } from './device.mjs';
import { setLang, systemLang } from './i18n.mjs';
import { clock } from './format.mjs';
import {
  HookState, installHooks, installStatusline, uninstallHooks, uninstallStatusline,
} from './hooks.mjs';
import { SessionStore } from './sessions.mjs';
import { StateBuilder } from './state.mjs';
import { codexUsage, fetchClaudeUsage, readStatuslineUsage } from './usage.mjs';

const CONFIG_FILE = path.join(os.homedir(), '.clawd-desk', 'config.json');
const r0 = () => path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'settings.json');

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      out[k] = v ?? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true);
    } else out._.push(a);
  }
  return out;
}

function readConfigFile() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function loadConfig(args) {
  const file = readConfigFile();
  return {
    lang: args.lang || process.env.CLAWD_DESK_LANG || file.lang || systemLang(),
    device: args.device || process.env.CLAWD_DESK_DEVICE || file.device || 'clawd-desk.local',
    serial: args.serial || process.env.CLAWD_DESK_SERIAL || file.serial || null,
    port: Number(args.port || process.env.CLAWD_DESK_PORT || file.port || 8787),
    interval: Number(args.interval || file.interval || 2),
  };
}

// logs go to stderr so `print` output stays clean JSON
const log = (...a) => console.error(`[${clock()}]`, ...a);

// ------------------------------------------------------------------- core
function createEngine() {
  const store = new SessionStore();
  const hooks = new HookState();
  const builder = new StateBuilder();
  let apiUsage = { error: 'not fetched yet' };
  let lastApiFetch = 0;
  let lastSource = '';

  return {
    hooks,
    async compute() {
      const sessions = store.refresh();
      // 1) status line data written by Claude Code itself (preferred)
      let claudeUsage = readStatuslineUsage();
      let source = 'status line';
      // 2) otherwise ask the usage endpoint with Claude Code's saved login
      if (claudeUsage.error) {
        if (Date.now() - lastApiFetch > 180e3) {
          lastApiFetch = Date.now();
          const u = await fetchClaudeUsage();
          if (!u.error || apiUsage.error) apiUsage = u;
        }
        claudeUsage = apiUsage;
        source = apiUsage.error ? `none (${apiUsage.error})` : 'oauth';
      }
      if (source !== lastSource) {
        log(`Claude limits source: ${source}`);
        lastSource = source;
      }
      return builder.build({
        sessions,
        hooks,
        claudeUsage,
        codexUsage: codexUsage(store.codexRateLimits()),
      });
    },
  };
}

// ---------------------------------------------------------- local server
const PAGE = `<!doctype html><meta charset="utf-8"><title>Clawd Desk</title>
<style>body{font:14px system-ui;background:#141413;color:#FAF9F5;margin:24px}
pre{background:#1F1E1C;padding:16px;border-radius:8px;overflow:auto}h1{font-size:20px}
.m{color:#A8A49C}</style><h1>Clawd Desk</h1>
<p class="m">Connection check (hooks and status line):</p><pre id="d">...</pre>
<p class="m">Data sent to the screen, refreshed every 2 seconds.</p><pre id="o">...</pre>
<script>async function t(){try{const r=await fetch('/state');document.getElementById('o').textContent=JSON.stringify(await r.json(),null,2);
const d=await fetch('/debug');document.getElementById('d').textContent=JSON.stringify(await d.json(),null,2)}catch(e){}}
t();setInterval(t,2000)</script>`;

function startServer(port, { onHook, getState, getDebug }) {
  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/hook') {
      let body = '';
      req.on('data', (c) => { body += c; if (body.length > 1e5) req.destroy(); });
      req.on('end', () => {
        try { onHook(JSON.parse(body)); } catch { /* ignore */ }
        res.writeHead(204).end();
      });
      return;
    }
    if (req.method === 'GET' && req.url === '/debug') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(getDebug(), null, 2));
      return;
    }
    if (req.method === 'GET' && req.url === '/state') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(getState() ?? {}));
      return;
    }
    if (req.method === 'GET' && req.url === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(PAGE);
      return;
    }
    res.writeHead(404).end();
  });
  server.on('error', (e) => {
    console.error(e.code === 'EADDRINUSE' ? `Port ${port} is in use. The companion is probably already running.` : e.message);
    process.exit(1);
  });
  server.listen(port, '127.0.0.1');
  return server;
}

// --------------------------------------------------------------- commands
async function cmdRun(cfg) {
  const engine = createEngine();
  const link = new DeviceLink({ device: cfg.device, serial: cfg.serial, log });
  let state = null;
  let lastSentKey = '';
  let lastSentAt = 0;
  let busy = false;
  let again = false;

  const tick = async () => {
    if (busy) { again = true; return; }
    busy = true;
    try {
      state = await engine.compute();
      // send when something changed (ignoring the clock) or every 20 s
      const key = JSON.stringify({ ...state, clock: undefined });
      if (key !== lastSentKey || Date.now() - lastSentAt > 20e3) {
        if (await link.send(state)) {
          lastSentKey = key;
          lastSentAt = Date.now();
        }
      }
    } catch (e) {
      log('error:', e.message);
    } finally {
      busy = false;
      if (again) { again = false; setTimeout(tick, 50); }
    }
  };

  let hookTimer = null;
  const hookStats = { count: 0, last: null };
  startServer(cfg.port, {
    getDebug: () => ({
      hooks_received: hookStats.count,
      last_hook: hookStats.last,
      claude_usage_from_status_line: readStatuslineUsage(),
    }),
    onHook: (evt) => {
      hookStats.count++;
      hookStats.last = { event: evt.hook_event_name, at: clock() };
      if (engine.hooks.handle(evt)) {
        clearTimeout(hookTimer);
        hookTimer = setTimeout(tick, 150);   // react quickly to hook events
      }
    },
    getState: () => state,
  });

  log(`Clawd Desk companion running -> ${link.describe()}`);
  log(`Preview: http://127.0.0.1:${cfg.port}/`);
  await tick();
  setInterval(tick, cfg.interval * 1000);
}

async function cmdDemo(cfg) {
  const link = new DeviceLink({ device: cfg.device, serial: cfg.serial, log });
  log(`Demo -> ${link.describe()} (Ctrl+C to stop)`);
  for (let i = 0; ; i = (i + 1) % DEMO_STEPS.length) {
    const step = DEMO_STEPS[i];
    log(`scenario: ${step.label()}`);
    const s = step.make();
    const until = Date.now() + step.seconds * 1000;
    while (Date.now() < until) {
      s.clock = clock();
      await link.send(s);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

async function cmdPrint() {
  const engine = createEngine();
  const state = await engine.compute();
  console.log(JSON.stringify(state, null, 2));
}

function help() {
  console.log(`Clawd Desk companion

  node src/cli.mjs config --device <ip|host> [--lang en|tr] [--serial COM5]
                                    save your settings once
  node src/cli.mjs run              send live data to the screen
  node src/cli.mjs demo             cycle through every screen with fake data
  node src/cli.mjs print            print the screen data once (no device needed)
  node src/cli.mjs install          add Claude Code hooks + status line
  node src/cli.mjs uninstall        remove both again
  node src/cli.mjs autostart [off]  start hidden at Windows login

Any command also takes --device, --serial, --lang and --port.

Config file: ${CONFIG_FILE}`);
}

const args = parseArgs(process.argv.slice(2));
const cfg = loadConfig(args);
setLang(cfg.lang);
switch (args._[0]) {
  case 'config': {
    const next = { ...readConfigFile() };
    for (const k of ['device', 'serial', 'lang', 'port']) if (args[k] !== undefined) next[k] = args[k];
    fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
    fs.writeFileSync(CONFIG_FILE, `${JSON.stringify(next, null, 2)}\n`);
    console.log(`Saved ${CONFIG_FILE}:\n${JSON.stringify(next, null, 2)}`);
    break;
  }
  case 'run': await cmdRun(cfg); break;
  case 'demo': await cmdDemo(cfg); break;
  case 'print': await cmdPrint(); break;
  case 'install':
  case 'install-hooks':
  case 'install-statusline': {
    const which = args._[0];
    if (which !== 'install-statusline') {
      const r = installHooks();
      console.log(`Hooks added (${r.events.join(', ')}) -> ${r.path}`);
    }
    if (which !== 'install-hooks') {
      const r = installStatusline();
      console.log(`Status line added${r.chained ? ' (your previous status line still runs)' : ''} -> ${r.path}`);
    }
    console.log(`Backup of your previous settings: ${r0()}.clawd-desk.bak`);
    break;
  }
  case 'autostart': {
    if (args._[1] === 'off') {
      console.log(disableAutostart() ? 'Autostart turned off.' : 'Autostart was already off.');
    } else {
      const extra = [];
      if (args.device) extra.push('--device', args.device);
      if (args.serial) extra.push('--serial', args.serial);
      if (args.lang) extra.push('--lang', args.lang);
      const p = enableAutostart(extra);
      console.log(`Will start at Windows login: ${p}\nLog file: ${logPath()}`);
    }
    break;
  }
  case 'uninstall': {
    uninstallHooks();
    const r = uninstallStatusline();
    console.log(`Clawd Desk hooks and status line removed: ${r.path}`);
    break;
  }
  default: help();
}
