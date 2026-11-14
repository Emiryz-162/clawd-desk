// One-step setup: what ClawdDesk-Setup.exe does when you double-click it.
// Also available from source: `node src/cli.mjs setup`.
//
//   1. copies itself to %LOCALAPPDATA%\ClawdDesk (Windows program only)
//   2. finds the screen on your network (or asks for its address)
//   3. connects Claude Code (hooks + status line)
//   4. starts with Windows, and starts right now
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { disableAutostart, enableAutostart, launcherPath, logPath } from './autostart.mjs';
import { installHooks, installStatusline } from './hooks.mjs';
import { INSTALL_DIR, INSTALLED_EXE, IS_EXE } from './runtime.mjs';
import { CLAUDE_DIR, CODEX_DIR } from './sessions.mjs';

const TEXT = {
  en: {
    title: 'Clawd Desk setup',
    copying: 'Installing to',
    looking: 'Looking for your Clawd Desk on the network...',
    found: (d) => `Found it: ${d}`,
    notFound: 'Could not find it automatically.',
    hint: 'Make sure the screen is on and connected to the same Wi-Fi. Its address is in the top-left corner of the screen (e.g. 192.168.1.42).',
    ask: 'Screen address (or press Enter to skip): ',
    noReply: (d) => `No reply from ${d}. Try again.`,
    skipped: 'Skipped. The companion will keep looking for clawd-desk.local.',
    claude: 'Connected Claude Code (hooks + status line).',
    noClaude: 'Claude Code was not found on this computer. Install it and run this setup again to see live Claude status.',
    codex: 'Found Codex. Its sessions and limits will show up too.',
    autostart: 'Starts automatically when you log in to Windows.',
    started: 'Running now. Your screen should show your sessions in a few seconds.',
    notStarted: (log) => `It didn't start. See ${log}`,
    noAutostart: 'To start it automatically on this system, see the README (Step 5).',
    done: 'All set!',
    uninstall: 'To remove it later, run: clawd-desk.exe uninstall (in the folder above).',
    close: 'Press Enter to close.',
  },
  tr: {
    title: 'Clawd Desk kurulumu',
    copying: 'Kuruluyor:',
    looking: 'Clawd Desk ağda aranıyor...',
    found: (d) => `Bulundu: ${d}`,
    notFound: 'Otomatik bulunamadı.',
    hint: 'Ekranın açık ve aynı Wi-Fi\'ye bağlı olduğundan emin ol. Adresi ekranın sol üst köşesinde yazıyor (ör. 192.168.1.42).',
    ask: 'Ekran adresi (geçmek için Enter): ',
    noReply: (d) => `${d} cevap vermedi. Tekrar dene.`,
    skipped: 'Geçildi. Program clawd-desk.local adresini denemeye devam edecek.',
    claude: 'Claude Code bağlandı (hook\'lar + status line).',
    noClaude: 'Bu bilgisayarda Claude Code bulunamadı. Canlı Claude durumu için Claude Code\'u kurup bu kurulumu tekrar çalıştır.',
    codex: 'Codex bulundu. Onun oturumları ve limitleri de görünecek.',
    autostart: 'Windows açılışında otomatik başlayacak.',
    started: 'Şu an çalışıyor. Birkaç saniye içinde ekranında oturumların görünecek.',
    notStarted: (log) => `Başlamadı. Ayrıntılar: ${log}`,
    noAutostart: 'Bu sistemde otomatik başlatma için README\'ye bak (5. adım).',
    done: 'Hazır!',
    uninstall: 'Kaldırmak için yukarıdaki klasörde şunu çalıştır: clawd-desk.exe uninstall',
    close: 'Kapatmak için Enter\'a bas.',
  },
};

async function reachable(device) {
  try {
    const r = await fetch(`http://${device}/`, { signal: AbortSignal.timeout(4000) });
    return r.ok && (await r.text()).includes('Clawd Desk');
  } catch {
    return false;
  }
}

/** Stops companions that are already running (old installs, a source copy). */
export function stopCompanions() {
  if (process.platform !== 'win32') return;
  const ps = `Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne ${process.pid} -and `
    + `(($_.Name -eq 'clawd-desk.exe') -or ($_.Name -eq 'node.exe' -and $_.CommandLine -match 'cli\\.mjs')) -and `
    + `$_.CommandLine -match ' run' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`;
  try {
    execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], { stdio: 'ignore' });
  } catch { /* nothing to stop */ }
}

export async function setup({ lang, port, device: preset, saveConfig }) {
  const t = TEXT[lang] || TEXT.en;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let inputClosed = false;
  rl.on('close', () => { inputClosed = true; });
  // no keyboard (input closed or piped): treat it as pressing Enter
  const ask = async (q) => {
    if (inputClosed) return '';
    try { return await rl.question(q); } catch { return ''; }
  };
  const say = (s = '') => console.log(s);
  const ok = (s) => say(`  ✔ ${s}`);

  say(`\n  ${t.title}\n  ${'─'.repeat(t.title.length)}\n`);

  // 1) put the program somewhere stable
  stopCompanions();
  if (IS_EXE && path.resolve(process.execPath).toLowerCase() !== INSTALLED_EXE.toLowerCase()) {
    fs.mkdirSync(INSTALL_DIR, { recursive: true });
    fs.copyFileSync(process.execPath, INSTALLED_EXE);
    ok(`${t.copying} ${INSTALL_DIR}`);
  }

  // 2) find the screen
  say(`  ${t.looking}`);
  let device = preset || 'clawd-desk.local';
  if (await reachable(device)) {
    ok(t.found(device));
  } else {
    say(`  ${t.notFound}\n  ${t.hint}`);
    device = '';
    for (;;) {
      const answer = (await ask(`  ${t.ask}`)).trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
      if (!answer) { say(`  ${t.skipped}`); break; }
      if (await reachable(answer)) { device = answer; ok(t.found(device)); break; }
      say(`  ${t.noReply(answer)}`);
    }
  }
  saveConfig(device ? { device } : {});

  // 3) Claude Code and Codex
  if (fs.existsSync(CLAUDE_DIR)) {
    installHooks();
    installStatusline();
    ok(t.claude);
  } else {
    say(`  ! ${t.noClaude}`);
  }
  if (fs.existsSync(CODEX_DIR)) ok(t.codex);

  // 4) start with Windows, and now
  if (process.platform === 'win32') {
    disableAutostart();
    enableAutostart();
    ok(t.autostart);
    // started through Explorer so it keeps running after this window closes
    spawn('explorer.exe', [launcherPath()], { detached: true, stdio: 'ignore' }).unref();
    let running = false;
    for (let i = 0; i < 20 && !running; i++) {
      await new Promise((r) => setTimeout(r, 500));
      try {
        running = (await fetch(`http://127.0.0.1:${port}/debug`, { signal: AbortSignal.timeout(1000) })).ok;
      } catch { /* not yet */ }
    }
    say(running ? `  ✔ ${t.started}` : `  ! ${t.notStarted(logPath())}`);
  } else {
    say(`  ${t.noAutostart}`);
  }

  say(`\n  ${t.done}`);
  if (IS_EXE) {
    say(`  ${t.uninstall}`);
    await ask(`\n  ${t.close}`);
  }
  rl.close();
}
