#!/usr/bin/env node
// Claude Code hook -> Clawd Desk companion.
// Reads the hook event from stdin and forwards a slim copy to the local
// companion server. Always exits 0 within ~1 s and prints nothing, so it can
// never block or change what Claude Code does.
//
// Runs as `node src/hook.mjs` from source, or `clawd-desk.exe hook`.

function slim(input) {
  if (!input || typeof input !== 'object') return undefined;
  const keep = ['command', 'file_path', 'notebook_path', 'pattern', 'url', 'query', 'description'];
  const out = {};
  for (const k of keep) {
    if (typeof input[k] === 'string') out[k] = input[k].slice(0, 300);
  }
  return out;
}

export function runHook() {
  const port = process.env.CLAWD_DESK_PORT || 8787;
  const quit = () => process.exit(0);
  setTimeout(quit, 1200).unref?.();

  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => { raw += c; });
  process.stdin.on('end', async () => {
    try {
      const o = JSON.parse(raw);
      const body = JSON.stringify({
        source: 'claude',
        hook_event_name: o.hook_event_name,
        session_id: o.session_id,
        cwd: o.cwd,
        tool_name: o.tool_name,
        tool_input: slim(o.tool_input),
        message: typeof o.message === 'string' ? o.message.slice(0, 200) : undefined,
      });
      await fetch(`http://127.0.0.1:${port}/hook`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        signal: AbortSignal.timeout(500),
      });
    } catch {
      /* companion not running: that's fine */
    }
    quit();
  });
}

if (/[\\/]hook\.mjs$/.test(process.argv[1] || '')) runHook();
