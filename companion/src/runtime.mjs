// Are we running from source (`node src/cli.mjs`) or as the single-file
// Windows program (ClawdDesk-Setup.exe / clawd-desk.exe)? Commands that other
// programs run for us (hooks, status line, autostart) depend on it.
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const IS_EXE = !/^node(\.exe)?$/i.test(path.basename(process.execPath));
export const MARK = '--clawd-desk';

// Where the setup program copies itself, so later commands keep working
// even if the downloaded file is deleted.
export const INSTALL_DIR = path.join(
  process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'ClawdDesk',
);
export const INSTALLED_EXE = path.join(INSTALL_DIR, 'clawd-desk.exe');

const srcDir = () => path.dirname(fileURLToPath(import.meta.url)).replace(/\\/g, '/');

/** Command line that runs one of our subcommands (hook, statusline). */
export function commandFor(sub) {
  if (IS_EXE) return `"${INSTALLED_EXE.replace(/\\/g, '/')}" ${sub} ${MARK}`;
  return `node "${srcDir()}/${sub}.mjs" ${MARK}`;
}

/** [program, args] to start the companion, for the autostart launcher. */
export function runCommand(extraArgs = []) {
  if (IS_EXE) return [INSTALLED_EXE, ['run', ...extraArgs]];
  return [process.execPath, [path.join(srcDir(), 'cli.mjs'), 'run', ...extraArgs]];
}
