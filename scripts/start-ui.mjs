#!/usr/bin/env node
/**
 * JobStrider UI Cockpit Launcher
 * Starts both the backend API bridge (port 3001) and Vite frontend (port 3000).
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const frontendDir = path.resolve(repoRoot, 'frontend');
const isWindows = process.platform === 'win32';

console.clear();
console.log('============================================================');
console.log('                 JobStrider Web Cockpit');
console.log('   Autonomous AI Job Pipeline & Interactive Control Room');
console.log('============================================================\n');

console.log('⚙️  Initializing backend bridge & embedded zero-db engine...');

// 1. Launch Backend Bridge on port 3001
const serverScript = path.resolve(repoRoot, 'frontend/server/index.js');
const serverProc = spawn(process.execPath, [serverScript], {
  cwd: repoRoot,
  stdio: 'inherit',
  env: { ...process.env, PORT: '3001' }
});

// 2. Launch Vite Frontend on port 3000
const viteBin = path.resolve(frontendDir, 'node_modules/vite/bin/vite.js');
let viteProc;

if (fs.existsSync(viteBin)) {
  viteProc = spawn(process.execPath, [viteBin], {
    cwd: frontendDir,
    stdio: 'inherit',
    env: { ...process.env }
  });
} else {
  const npmCmd = isWindows ? 'npm.cmd' : 'npm';
  viteProc = spawn(npmCmd, ['run', 'dev'], {
    cwd: frontendDir,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env }
  });
}

console.log('\n🚀 Starting services...');
console.log('👉 Dashboard will be available at: http://localhost:3000');
console.log('👉 Press Ctrl + C to stop both servers at any time.\n');

const shutdown = () => {
  console.log('\n🛑 Shutting down JobStrider cockpit...');
  try { serverProc.kill(); } catch {}
  try { viteProc.kill(); } catch {}
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

serverProc.on('error', (err) => {
  console.error('Failed to launch backend bridge:', err.message);
});

viteProc.on('error', (err) => {
  console.error('Failed to launch frontend:', err.message);
});
