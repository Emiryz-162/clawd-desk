// Fake data that cycles through every screen, for trying the device
// without any real session: `node src/cli.mjs demo`
import { clock } from './format.mjs';

const base = () => ({
  v: 1,
  clock: clock(),
  mode: 'working',
  home: { title: 'Çalışıyor', project: 'desk-buddy', sub: '12dk · 47 adım · 3/5 görev' },
  limits: [
    { name: 'Claude Code', short: 'Claude', color: '#D97757', p5: 62, r5: '1sa 48dk', pw: 41, rw: 'Pzt 09:00 sıfırlanır' },
    { name: 'Codex', short: 'Codex', color: '#7FA7D9', p5: 18, r5: '3sa 10dk', pw: 33, rw: 'Çar 14:00 sıfırlanır' },
  ],
  live: {
    project: 'desk-buddy', elapsed: '12:04', meta: 'Claude Code · Opus 5.5 · bağlam 84k',
    tag: 'EDIT', target: 'src/ui/limits.cpp', desc: 'Halka grafiğin çizimini düzenliyor',
    steps: [
      { tag: 'READ', text: 'src/ui/screens.cpp', ago: '18s' },
      { tag: 'BASH', text: 'pio run -e cyd', ago: '41s' },
      { tag: 'EDIT', text: 'src/net/usage.cpp', ago: '1dk' },
    ],
    todo_done: 3, todo_total: 5,
  },
  attention: null,
  done: null,
  sessions: [
    { name: 'desk-buddy', tool: 'Claude Code', status: 'working', status_label: 'Çalışıyor', ago: 'şimdi',
      prompt: 'Limit ekranına halka grafik ekle, Codex verisini de göster',
      stats: [['12dk', 'SÜRE'], ['47', 'ADIM'], ['6', 'DOSYA'], ['84k', 'TOKEN']],
      last: 'Halka grafiği tek fonksiyona topladım. Şimdi PlatformIO ile derleyip boyutu kontrol ediyorum.' },
    { name: 'api-server', tool: 'Codex', status: 'idle', status_label: 'Durdu', ago: '2 dk',
      prompt: 'Build hatasını düzelt ve testleri çalıştır',
      stats: [['8dk', 'SÜRE'], ['21', 'ADIM'], ['3', 'DOSYA'], ['31k', 'TOKEN']],
      last: 'Tip hatasını düzelttim. Doğrulamak için npm run build çalıştırmak istiyorum.' },
    { name: 'portfolio-site', tool: 'Claude Code', status: 'done', status_label: 'Bitti', ago: '25 dk',
      prompt: 'Proje kartlarını mobilde tek sütuna indir',
      stats: [['14dk', 'SÜRE'], ['33', 'ADIM'], ['4', 'DOSYA'], ['52k', 'TOKEN']],
      last: 'Kartlar 640px altında tek sütun. Ekran görüntüsüyle kontrol ettim.' },
  ],
});

let doneId = 100;

export const DEMO_STEPS = [
  { label: 'Claude çalışıyor', seconds: 25, make: () => base() },
  {
    label: 'Codex onay bekliyor',
    seconds: 12,
    make: () => {
      const s = base();
      s.mode = 'waiting';
      s.sessions[1].status = 'waiting';
      s.sessions[1].status_label = 'Onay bekliyor';
      s.attention = { title: 'Codex bir komut çalıştırmak istiyor', cmd: '$ npm run build', meta: 'api-server · 2dk bekliyor' };
      return s;
    },
  },
  {
    label: 'İş bitti',
    seconds: 8,
    make: () => {
      const s = base();
      s.mode = 'done';
      s.live = null;
      s.home = { title: 'Bitti', project: 'desk-buddy', sub: '14dk · 6 dosya' };
      s.sessions[0].status = 'done';
      s.sessions[0].status_label = 'Bitti';
      s.done = { id: ++doneId, project: 'desk-buddy', meta: '14dk · 6 dosya' };
      return s;
    },
  },
  {
    label: 'Boşta, limitler dolmak üzere',
    seconds: 20,
    make: () => {
      const s = base();
      s.mode = 'idle';
      s.live = null;
      s.home = { title: 'Boşta', project: 'son: desk-buddy', sub: 'az önce bitti' };
      s.sessions[0].status = 'done';
      s.sessions[0].status_label = 'Bitti';
      s.limits[0].p5 = 93;
      s.limits[0].r5 = '24dk';
      return s;
    },
  },
];
