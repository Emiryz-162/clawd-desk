// Screen texts in English and Turkish.
// By default the screen follows your computer's language (English if it's
// one we don't have yet). Override with `config --lang en|tr`.
// Adding a language: copy the `en` block, translate, and add the same
// language to firmware/src/lang.cpp for the fixed labels on the device.

const STRINGS = {
  en: {
    days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    min: 'm', hour: 'h', day: 'd',
    now: 'now', agoMin: (n) => `${n} min`, agoHour: (n) => `${n} h`, agoDay: (n) => `${n} d`,
    status: { working: 'Working', waiting: 'Needs approval', done: 'Done', idle: 'Stopped' },
    homeWorking: 'Working', homeWaiting: 'Waiting', homeDone: 'Done', homeIdle: 'Idle',
    needsApproval: 'approval needed',
    steps: (n) => `${n} steps`,
    tasks: (d, t) => `${d}/${t} tasks`,
    files: (n) => `${n} files`,
    last: (name) => `last: ${name}`,
    justFinished: 'just finished',
    agoSuffix: (a) => `${a} ago`,
    noSessions: 'No sessions yet',
    thinking: 'thinking',
    context: 'context',
    codexAsks: 'Codex wants to run a command',
    claudeAsks: (tool) => `Claude wants to use ${tool}`,
    aTool: 'a tool',
    waitingFor: (a) => `waiting ${a}`,
    stats: ['TIME', 'STEPS', 'FILES', 'TOKENS'],
    noData: 'no data',
    resets: (when) => `resets ${when}`,
    todoList: 'todo list',
  },
  tr: {
    days: ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'],
    min: 'dk', hour: 'sa', day: 'g',
    now: 'şimdi', agoMin: (n) => `${n} dk`, agoHour: (n) => `${n} sa`, agoDay: (n) => `${n} gün`,
    status: { working: 'Çalışıyor', waiting: 'Onay bekliyor', done: 'Bitti', idle: 'Durdu' },
    homeWorking: 'Çalışıyor', homeWaiting: 'Bekliyor', homeDone: 'Bitti', homeIdle: 'Boşta',
    needsApproval: 'onay gerekiyor',
    steps: (n) => `${n} adım`,
    tasks: (d, t) => `${d}/${t} görev`,
    files: (n) => `${n} dosya`,
    last: (name) => `son: ${name}`,
    justFinished: 'az önce bitti',
    agoSuffix: (a) => `${a} önce`,
    noSessions: 'Henüz oturum yok',
    thinking: 'düşünüyor',
    context: 'bağlam',
    codexAsks: 'Codex bir komut çalıştırmak istiyor',
    claudeAsks: (tool) => `Claude ${tool} kullanmak istiyor`,
    aTool: 'bir araç',
    waitingFor: (a) => `${a} bekliyor`,
    stats: ['SÜRE', 'ADIM', 'DOSYA', 'TOKEN'],
    noData: 'veri yok',
    resets: (when) => `${when} sıfırlanır`,
    todoList: 'görev listesi',
  },
};

let current = 'en';

/** The computer's language if we have it, otherwise English. */
export function systemLang() {
  const sys = (Intl.DateTimeFormat().resolvedOptions().locale || process.env.LANG || 'en').slice(0, 2).toLowerCase();
  return STRINGS[sys] ? sys : 'en';
}

export function setLang(lang) {
  current = STRINGS[lang] ? lang : 'en';
}

export function lang() {
  return current;
}

/** The string table of the current language. */
export function T() {
  return STRINGS[current];
}
