// Compact formatting for a 2.8" screen, in the language chosen in i18n.mjs.
import { T } from './i18n.mjs';

const pad = (n) => String(n).padStart(2, '0');

/** 108 min -> "1h 48m" (en) / "1sa 48dk" (tr) */
export function durShort(ms) {
  const t = T();
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 60) return `${m}${t.min}`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `${h}${t.hour} ${m % 60}${t.min}` : `${h}${t.hour}`;
  return `${Math.floor(h / 24)}${t.day} ${h % 24}${t.hour}`;
}

/** time since -> "now", "12 min", "3 h", "2 d" */
export function ago(ts, now = Date.now()) {
  const t = T();
  const s = (now - ts) / 1000;
  if (s < 60) return t.now;
  if (s < 3600) return t.agoMin(Math.floor(s / 60));
  if (s < 86400) return t.agoHour(Math.floor(s / 3600));
  return t.agoDay(Math.floor(s / 86400));
}

/** time since, very short -> "18s", "4m", "2h" */
export function agoShort(ts, now = Date.now()) {
  const t = T();
  const s = Math.max(0, (now - ts) / 1000);
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}${t.min}`;
  return `${Math.floor(s / 3600)}${t.hour}`;
}

export function clock(d = new Date()) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** -> "Mon 09:00" */
export function weekdayTime(ts) {
  const d = new Date(ts);
  return `${T().days[d.getDay()]} ${clock(d)}`;
}

/** -> "12:04" or "1:12:04" */
export function elapsed(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}

export function tokens(n) {
  if (!n) return '0';
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}

export function clip(s, n) {
  s = String(s ?? '').replace(/\s+/g, ' ').trim();
  return s.length > n ? `${s.slice(0, n - 3).trimEnd()}...` : s;
}

/** Strips system reminders, XML-ish tags and markdown noise from a prompt. */
export function cleanText(t) {
  return String(t ?? '')
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, ' ')
    .replace(/<[^>]{1,80}>/g, ' ')
    .replace(/```[\s\S]*?```/g, ' [kod] ')
    .replace(/[*_`#>]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// The device fonts cover Latin-1 + Latin Extended-A (all Turkish letters).
const REPLACE = {
  '…': '...', '→': '->', '←': '<-', '—': '-', '–': '-', '‘': "'", '’': "'",
  '“': '"', '”': '"', '•': '·', '✓': 'ok', '✔': 'ok', '✗': 'x', '×': 'x',
};

/** Makes a string safe for the device fonts (drops emoji etc.). */
export function deviceSafe(s) {
  let out = '';
  for (const ch of String(s)) {
    if (REPLACE[ch] !== undefined) out += REPLACE[ch];
    else if (ch.codePointAt(0) <= 0x17f) out += ch;
  }
  return out;
}

/** Applies deviceSafe to every string in a JSON-able value. */
export function deviceSafeDeep(v) {
  if (typeof v === 'string') return deviceSafe(v);
  if (Array.isArray(v)) return v.map(deviceSafeDeep);
  if (v && typeof v === 'object') {
    const o = {};
    for (const [k, x] of Object.entries(v)) o[k] = deviceSafeDeep(x);
    return o;
  }
  return v;
}
