// Builds dist/ClawdDesk-Setup.exe: the companion as one Windows program, so
// people don't need Node.js. Uses Node's "single executable application"
// feature: bundle the code into one file, then inject it into a copy of
// node.exe.
//
//   npm install
//   npm run build:exe
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const bundle = path.join(dist, 'clawd-desk.cjs');
const blob = path.join(dist, 'sea-prep.blob');
const exe = path.join(dist, 'ClawdDesk-Setup.exe');

if (process.platform !== 'win32') {
  console.error('Build the Windows program on Windows (or in the GitHub release workflow).');
  process.exit(1);
}

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

// 1) one CommonJS file with everything in it
await build({
  entryPoints: [path.join(root, 'src', 'cli.mjs')],
  outfile: bundle,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['serialport'],       // USB is optional and needs native code
  logLevel: 'warning',
});

// 2) the blob Node embeds
const seaConfig = path.join(dist, 'sea-config.json');
fs.writeFileSync(seaConfig, JSON.stringify({
  main: bundle,
  output: blob,
  disableExperimentalSEAWarning: true,
}));
execFileSync(process.execPath, ['--experimental-sea-config', seaConfig], { stdio: 'inherit' });

// 3) a copy of node.exe with the blob injected
fs.copyFileSync(process.execPath, exe);
const postject = path.join(root, 'node_modules', 'postject', 'dist', 'cli.js');
execFileSync(process.execPath, [
  postject, exe, 'NODE_SEA_BLOB', blob,
  '--sentinel-fuse', 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
], { stdio: 'inherit' });

for (const f of [bundle, blob, seaConfig]) fs.rmSync(f);
const mb = (fs.statSync(exe).size / 1e6).toFixed(0);
console.log(`Built ${exe} (${mb} MB)`);
