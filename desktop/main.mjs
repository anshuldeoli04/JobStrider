import { app, BrowserWindow, shell, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// Prevent Chromium disk cache lockups / Access Denied issues on Windows
app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

// Route workspace directory to the operating system's persistent user data folder (%APPDATA%/JobStrider/workspace)
const userDataDir = app.getPath('userData');
const workspaceDir = path.join(userDataDir, 'workspace');
if (!fs.existsSync(workspaceDir)) {
  fs.mkdirSync(workspaceDir, { recursive: true });
}

// Clean stale lockfile or corrupted cache folders from previous crashes
try {
  const lockfile = path.join(userDataDir, 'lockfile');
  if (fs.existsSync(lockfile)) fs.unlinkSync(lockfile);
} catch {}

process.env.JOBSTRIDER_TEST_WORKSPACE = workspaceDir;
process.env.HOST = '127.0.0.1';
process.env.PORT = process.env.PORT || '3001';

// Single-instance lock prevents multiple colliding desktop instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

const logPath = path.join(userDataDir, 'jobstrider.log');
function logDebug(msg) {
  try {
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
  } catch {}
}

process.on('uncaughtException', (err) => {
  logDebug(`[process uncaughtException] ${err?.stack || err}`);
  console.error('[JobStrider uncaughtException]', err);
});
process.on('unhandledRejection', (err) => {
  logDebug(`[process unhandledRejection] ${err?.stack || err}`);
  console.error('[JobStrider unhandledRejection]', err);
});

let mainWindow = null;
let apiServer = null;

async function startBackend() {
  const serverModule = await import('../frontend/server/index.js');
  return serverModule.server;
}

async function waitForServer(port, maxRetries = 40) {
  const url = `http://127.0.0.1:${port}/health`;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // Socket not ready yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

async function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0f172a',
    title: 'JobStrider — Autonomous AI Career Copilot',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    autoHideMenuBar: true,
  });

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    logDebug(`[Renderer L${level}] ${message} (${sourceId}:${line})`);
  });

  const appUrl = `http://127.0.0.1:${port}`;

  // Retry loadURL in case of transient network stack initialization delay
  let loaded = false;
  let lastErr = null;
  for (let attempt = 1; attempt <= 8; attempt++) {
    try {
      await mainWindow.loadURL(appUrl);
      loaded = true;
      break;
    } catch (err) {
      lastErr = err;
      console.warn(`[JobStrider] Navigation attempt ${attempt} failed: ${err.message}`);
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  if (!loaded) {
    throw lastErr || new Error(`Failed to load ${appUrl}`);
  }

  mainWindow.show();
  mainWindow.focus();

  // Open external links (affiliate links, course platforms, job listings) in the user's default system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  try {
    apiServer = await startBackend();
    const port = process.env.PORT || 3001;
    const isReady = await waitForServer(port);
    if (!isReady) {
      throw new Error(`JobStrider backend server failed to bind to port ${port} within 10 seconds.`);
    }
    await createWindow(port);
  } catch (err) {
    console.error('Failed to start JobStrider desktop application:', err);
    dialog.showErrorBox(
      'JobStrider Startup Error',
      `Failed to start backend server:\n\n${err?.stack || err?.message || err}`
    );
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(process.env.PORT || 3001);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (apiServer && typeof apiServer.close === 'function') {
    apiServer.close();
  }
});
