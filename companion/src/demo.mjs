// Fake data that cycles through every screen, for trying the device
// without any real session: `node src/cli.mjs demo`
import { clock } from './format.mjs';
import { lang } from './i18n.mjs';

const EN = {
  working: 'Working', waiting: 'Needs approval', done: 'Done', idle: 'Stopped',
  home: { title: 'Working', project: 'desk-buddy', sub: '12m · 47 steps · 3/5 tasks' },
  r5a: '1h 48m', r5b: '3h 10m', rwa: 'resets Mon 09:00', rwb: 'resets Wed 14:00',
  meta: 'Claude Code · Opus 5.5 · context 84k', desc: 'Polishing the ring chart',
  stats: ['TIME', 'STEPS', 'FILES', 'TOKENS'], m: 'm',
  s1: ['Add a ring chart to the limits screen and show Codex too', 'Moved the ring drawing into one function. Building with PlatformIO now to check the size.'],
  s2: ['Fix the build error and run the tests', 'Fixed the type error. I want to run npm run build to confirm.'],
  s3: ['Make the project cards a single column on mobile', 'Cards are one column below 640px. Checked with a screenshot.'],
  ago: ['now', '2 min', '25 min'],
  attn: { title: 'Codex wants to run a command', cmd: '$ npm run build', meta: 'api-server · waiting 2m' },
  doneMeta: '14m · 6 files', idleHome: { title: 'Idle', project: 'last: desk-buddy', sub: 'just finished' },
  labels: ['Claude working', 'Codex needs approval', 'Job finished', 'Idle, limit almost full'],
};

const TR = {
  working: 'Çalışıyor', waiting: 'Onay bekliyor', done: 'Bitti', idle: 'Durdu',
  home: { title: 'Çalışıyor', project: 'desk-buddy', sub: '12dk · 47 adım · 3/5 görev' },
  r5a: '1sa 48dk', r5b: '3sa 10dk', rwa: 'Pzt 09:00 sıfırlanır', rwb: 'Çar 14:00 sıfırlanır',
  meta: 'Claude Code · Opus 5.5 · bağlam 84k', desc: 'Halka grafiğin çizimini düzenliyor',
  stats: ['SÜRE', 'ADIM', 'DOSYA', 'TOKEN'], m: 'dk',
  s1: ['Limit ekranına halka grafik ekle, Codex verisini de göster', 'Halka grafiği tek fonksiyona topladım. Şimdi PlatformIO ile derleyip boyutu kontrol ediyorum.'],
  s2: ['Build hatasını düzelt ve testleri çalıştır', 'Tip hatasını düzelttim. Doğrulamak için npm run build çalıştırmak istiyorum.'],
  s3: ['Proje kartlarını mobilde tek sütuna indir', 'Kartlar 640px altında tek sütun. Ekran görüntüsüyle kontrol ettim.'],
  ago: ['şimdi', '2 dk', '25 dk'],
  attn: { title: 'Codex bir komut çalıştırmak istiyor', cmd: '$ npm run build', meta: 'api-server · 2dk bekliyor' },
  doneMeta: '14dk · 6 dosya', idleHome: { title: 'Boşta', project: 'son: desk-buddy', sub: 'az önce bitti' },
  labels: ['Claude çalışıyor', 'Codex onay bekliyor', 'İş bitti', 'Boşta, limit dolmak üzere'],
};

const L = () => (lang() === 'tr' ? TR : EN);

const base = () => {
  const t = L();
  const st = (a, b, c, d) => [[a, t.stats[0]], [b, t.stats[1]], [c, t.stats[2]], [d, t.stats[3]]];
  return {
    v: 1,
    lang: lang(),
    clock: clock(),
    mode: 'working',
    home: { ...t.home },
    limits: [
      { name: 'Claude Code', short: 'Claude', color: '#D97757', p5: 62, r5: t.r5a, pw: 41, rw: t.rwa },
      { name: 'Codex', short: 'Codex', color: '#7FA7D9', p5: 18, r5: t.r5b, pw: 33, rw: t.rwb },
    ],
    live: {
      project: 'desk-buddy', elapsed: '12:04', meta: t.meta,
      tag: 'EDIT', target: 'src/ui/limits.cpp', desc: t.desc,
      steps: [
        { tag: 'READ', text: 'src/ui/screens.cpp', ago: '18s' },
        { tag: 'BASH', text: 'pio run -e cyd', ago: '41s' },
        { tag: 'EDIT', text: 'src/net/usage.cpp', ago: `1${t.m}` },
      ],
      todo_done: 3, todo_total: 5,
    },
    attention: null,
    done: null,
    sessions: [
      { name: 'desk-buddy', tool: 'Claude Code', status: 'working', status_label: t.working, ago: t.ago[0],
        prompt: t.s1[0], stats: st(`12${t.m}`, '47', '6', '84k'), last: t.s1[1] },
      { name: 'api-server', tool: 'Codex', status: 'idle', status_label: t.idle, ago: t.ago[1],
        prompt: t.s2[0], stats: st(`8${t.m}`, '21', '3', '31k'), last: t.s2[1] },
      { name: 'portfolio-site', tool: 'Claude Code', status: 'done', status_label: t.done, ago: t.ago[2],
        prompt: t.s3[0], stats: st(`14${t.m}`, '33', '4', '52k'), last: t.s3[1] },
    ],
  };
};

let doneId = 100;

export const DEMO_STEPS = [
  { label: () => L().labels[0], seconds: 25, make: () => base() },
  {
    label: () => L().labels[1],
    seconds: 12,
    make: () => {
      const s = base();
      s.mode = 'waiting';
      s.sessions[1].status = 'waiting';
      s.sessions[1].status_label = L().waiting;
      s.attention = { ...L().attn };
      return s;
    },
  },
  {
    label: () => L().labels[2],
    seconds: 8,
    make: () => {
      const s = base();
      s.mode = 'done';
      s.live = null;
      s.home = { title: L().done, project: 'desk-buddy', sub: L().doneMeta };
      s.sessions[0].status = 'done';
      s.sessions[0].status_label = L().done;
      s.done = { id: ++doneId, project: 'desk-buddy', meta: L().doneMeta };
      return s;
    },
  },
  {
    label: () => L().labels[3],
    seconds: 20,
    make: () => {
      const s = base();
      s.mode = 'idle';
      s.live = null;
      s.home = { ...L().idleHome };
      s.sessions[0].status = 'done';
      s.sessions[0].status_label = L().done;
      s.limits[0].p5 = 93;
      s.limits[0].r5 = `24${L().m}`;
      return s;
    },
  },
];
