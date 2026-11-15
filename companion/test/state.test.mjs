import assert from 'node:assert/strict';
import test from 'node:test';
import { deviceSafe, durShort, elapsed } from '../src/format.mjs';
import { setLang } from '../src/i18n.mjs';
import { HookState } from '../src/hooks.mjs';
import { StateBuilder, prettyModel } from '../src/state.mjs';

const fakeSession = (over = {}) => ({
  id: 's1', source: 'claude', name: 'desk-buddy', tool: 'Claude Code', cwd: '/x/desk-buddy',
  mtime: Date.now(), activity: Date.now(), firstTs: Date.now() - 600e3, lastTs: Date.now(), promptTs: Date.now() - 300e3,
  prompt: 'Limit ekranına halka grafik ekle', last: 'Tamam.', model: 'claude-opus-5-5',
  toolCount: 12, files: new Set(['a.cpp']), ctx: 84000, ctxWindow: 200000,
  recent: [{ tag: 'EDIT', text: 'src/a.cpp', ts: Date.now() }], todo: { done: 1, total: 3 },
  turnOpen: true, pending: null, completedTs: 0,
  ...over,
});

test('formatting', () => {
  setLang('en');
  assert.equal(durShort(108 * 60e3), '1h 48m');
  setLang('tr');
  assert.equal(durShort(108 * 60e3), '1sa 48dk');
  setLang('en');
  assert.equal(elapsed(724e3), '12:04');
  assert.equal(deviceSafe('Bitti… 🎉 ğüşıöç'), 'Bitti...  ğüşıöç');
  assert.equal(prettyModel('claude-opus-5-5'), 'Opus 5.5');
});

test('working session fills home and live', () => {
  const st = new StateBuilder().build({ sessions: [fakeSession()], hooks: new HookState(), claudeUsage: { error: 'x' }, codexUsage: { error: 'x' } });
  assert.equal(st.mode, 'working');
  assert.equal(st.live.tag, 'EDIT');
  assert.equal(st.sessions[0].status_label, 'Working');
  assert.equal(st.lang, 'en');
  assert.equal(st.limits[0].r5, '?');
});

test('hook permission -> attention, Stop -> done event', () => {
  const b = new StateBuilder();
  const hooks = new HookState();
  const s = fakeSession();
  hooks.handle({ hook_event_name: 'PreToolUse', session_id: 's1', tool_name: 'Bash', tool_input: { command: 'npm test' } });
  hooks.handle({ hook_event_name: 'Notification', session_id: 's1', message: 'Claude needs your permission to use Bash' });
  let st = b.build({ sessions: [s], hooks });
  assert.equal(st.mode, 'waiting');
  assert.equal(st.attention.cmd, '$ npm test');

  hooks.handle({ hook_event_name: 'Stop', session_id: 's1' });
  st = b.build({ sessions: [s], hooks });
  assert.equal(st.mode, 'done');
  assert.equal(st.done.id, 1);
  assert.equal(st.attention, null);
});
