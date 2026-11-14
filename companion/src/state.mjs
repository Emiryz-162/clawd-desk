// Turns parsed sessions + hook events + usage into the JSON the device draws.
// Format: docs/protocol.md
import {
  ago, agoShort, clip, clock, deviceSafeDeep, durShort, elapsed, tokens, weekdayTime,
} from './format.mjs';
import { describeTool } from './sessions.mjs';

const H = 3600e3;
const STATUS_LABEL = { working: 'Çalışıyor', waiting: 'Onay bekliyor', done: 'Bitti', idle: 'Durdu' };

export function prettyModel(m) {
  if (!m) return '';
  const c = m.match(/claude-([a-z]+)-(\d+)(?:-(\d+))?/i);
  if (c) return `${c[1][0].toUpperCase()}${c[1].slice(1)} ${c[2]}${c[3] && c[3].length < 3 ? `.${c[3]}` : ''}`;
  return m.replace(/^gpt-/i, 'GPT-');
}

export class StateBuilder {
  constructor() {
    this.prevStatus = new Map();
    this.doneEvent = null;
    this.doneCounter = 0;
  }

  statusOf(s, hooks, now) {
    const h = s.source === 'claude' ? hooks.get(s.id) : null;
    if (h && now - h.ts < 2 * H) {
      if (h.status === 'waiting') return 'waiting';
      // guard against a missed Stop event
      if (h.status === 'working') return now - Math.max(h.ts, s.mtime) < 15 * 60e3 ? 'working' : 'idle';
      if (h.status === 'done') return now - h.ts < 3 * H ? 'done' : 'idle';
      if (h.status === 'idle') return 'idle';
    }
    if (s.pending) return 'waiting';
    if (s.turnOpen && now - s.mtime < (s.source === 'codex' ? 5 : 3) * 60e3) return 'working';
    if (s.completedTs && now - s.completedTs < 3 * H) return 'done';
    return 'idle';
  }

  limit(name, short, color, u, now) {
    if (!u || u.error) return { name, short, color, p5: 0, r5: '?', pw: 0, rw: 'veri yok' };
    return {
      name, short, color,
      p5: Math.max(0, Math.min(100, u.p5)),
      r5: u.r5ts ? durShort(u.r5ts - now) : '-',
      pw: Math.max(0, Math.min(100, u.pw)),
      rw: u.rwts ? `${weekdayTime(u.rwts)} sıfırlanır` : '',
    };
  }

  build({ sessions, hooks, claudeUsage, codexUsage, now = Date.now() }) {
    const list = sessions.slice(0, 6).map((s) => ({ s, status: this.statusOf(s, hooks, now) }));

    // "done" event when a session goes from working/waiting to done
    for (const { s, status } of list) {
      const prev = this.prevStatus.get(s.id);
      if ((prev === 'working' || prev === 'waiting') && status === 'done') {
        const took = s.promptTs ? durShort((s.completedTs || now) - s.promptTs) : '';
        this.doneEvent = {
          id: ++this.doneCounter,
          project: s.name,
          meta: [took, `${s.files.size} dosya`].filter(Boolean).join(' · '),
          ts: now,
        };
      }
      this.prevStatus.set(s.id, status);
    }
    const doneActive = this.doneEvent && now - this.doneEvent.ts < 20000;

    const waiting = list.find((x) => x.status === 'waiting');
    const working = list.find((x) => x.status === 'working');
    const mode = waiting ? 'waiting' : working ? 'working' : doneActive ? 'done' : 'idle';

    // ---- home
    let home;
    if (waiting) {
      home = { title: 'Bekliyor', project: waiting.s.name, sub: 'onay gerekiyor' };
    } else if (working) {
      const s = working.s;
      const parts = [durShort(now - (s.promptTs || s.firstTs)), `${s.toolCount} adım`];
      if (s.todo?.total) parts.push(`${s.todo.done}/${s.todo.total} görev`);
      home = { title: 'Çalışıyor', project: s.name, sub: parts.join(' · ') };
    } else if (doneActive) {
      home = { title: 'Bitti', project: this.doneEvent.project, sub: this.doneEvent.meta };
    } else if (list.length) {
      const s = list[0].s;
      const when = s.completedTs || s.mtime;
      const a = ago(when, now);
      home = { title: 'Boşta', project: `son: ${s.name}`, sub: a === 'şimdi' ? 'az önce bitti' : `${a} önce` };
    } else {
      home = { title: 'Boşta', project: '', sub: 'Henüz oturum yok' };
    }

    // ---- live (the session that is working right now)
    let live = null;
    if (working) {
      const s = working.s;
      const cur = s.recent[s.recent.length - 1] || { tag: '...', text: 'düşünüyor', ts: now };
      const ctx = s.ctxWindow && s.source === 'codex'
        ? `bağlam %${Math.round((s.ctx / s.ctxWindow) * 100)}`
        : `bağlam ${tokens(s.ctx)}`;
      live = {
        project: s.name,
        elapsed: elapsed(now - (s.promptTs || s.firstTs)),
        meta: [s.tool, prettyModel(s.model), ctx].filter(Boolean).join(' · '),
        tag: cur.tag,
        target: clip(cur.text, 60),
        desc: clip(s.last || s.prompt, 70),
        steps: s.recent.slice(0, -1).slice(-3).reverse()
          .map((r) => ({ tag: r.tag, text: clip(r.text, 50), ago: agoShort(r.ts, now) })),
        todo_done: s.todo?.done ?? 0,
        todo_total: s.todo?.total ?? 0,
      };
    }

    // ---- attention (something is waiting for you)
    let attention = null;
    if (waiting) {
      const s = waiting.s;
      const h = hooks.get(s.id);
      let title;
      let cmd = '';
      let since = now;
      if (s.source === 'codex') {
        title = 'Codex bir komut çalıştırmak istiyor';
        cmd = s.pending?.cmd || '';
        since = s.pending?.ts || now;
      } else {
        const tool = h?.toolName || 'bir araç';
        title = `Claude ${tool} kullanmak istiyor`;
        if (h?.toolName) {
          const d = describeTool(h.toolName, h.toolInput, s.cwd);
          cmd = d.tag === 'BASH' ? `$ ${d.text}` : d.text;
        }
        since = h?.ts || now;
      }
      attention = { title, cmd: clip(cmd, 80), meta: `${s.name} · ${agoShort(since, now)} bekliyor` };
    }

    // ---- session list + details
    const out = list.map(({ s, status }) => ({
      name: s.name,
      tool: s.tool,
      status,
      status_label: STATUS_LABEL[status],
      ago: ago(s.mtime, now),
      prompt: clip(s.prompt || '-', 150),
      stats: [
        [s.firstTs ? durShort(s.lastTs - s.firstTs) : '-', 'SÜRE'],
        [String(s.toolCount), 'ADIM'],
        [String(s.files.size), 'DOSYA'],
        [tokens(s.ctx), 'TOKEN'],
      ],
      last: clip(s.last || '-', 240),
    }));

    return deviceSafeDeep({
      v: 1,
      clock: clock(new Date(now)),
      mode,
      home,
      limits: [
        this.limit('Claude Code', 'Claude', '#D97757', claudeUsage, now),
        this.limit('Codex', 'Codex', '#7FA7D9', codexUsage, now),
      ],
      live,
      attention,
      done: doneActive ? { id: this.doneEvent.id, project: this.doneEvent.project, meta: this.doneEvent.meta } : null,
      sessions: out,
    });
  }
}
