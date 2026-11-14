// Start the companion when you log in to Windows, without a console window.
// `clawd-desk autostart on` writes a small .vbs launcher to the Startup
// folder; `autostart off` removes it. Logs go to ~/.clawd-desk/companion.log
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runCommand } from './runtime.mjs';

const startupDir = () => path.join(
  process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
  'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup',
);
export const launcherPath = () => path.join(startupDir(), 'clawd-desk-companion.vbs');
export const logPath = () => path.join(os.homedir(), '.clawd-desk', 'companion.log');

export function enableAutostart(extraArgs = []) {
  if (process.platform !== 'win32') throw new Error('autostart is only set up for Windows for now');
  const [program, programArgs] = runCommand(extraArgs);
  fs.mkdirSync(path.dirname(logPath()), { recursive: true });
  // cmd /c lets us redirect output to a log; window style 0 = hidden
  const quoted = [program, ...programArgs].map((a) => (/[\s"]/.test(a) || a.includes('\\') ? `"${a}"` : a)).join(' ');
  const cmd = `cmd /c "${quoted} > "${logPath()}" 2>&1"`;
  const vbs = `' Clawd Desk companion - started at login (remove this file to stop)\r\n`
    + `CreateObject("WScript.Shell").Run "${cmd.replace(/"/g, '""')}", 0, False\r\n`;
  fs.writeFileSync(launcherPath(), vbs);
  return launcherPath();
}

export function disableAutostart() {
  try {
    fs.unlinkSync(launcherPath());
    return true;
  } catch {
    return false;
  }
}
