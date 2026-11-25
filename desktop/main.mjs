import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

// Route workspace directory to the operating system's persistent user data folder (%APPDATA%/JobStrider/workspace)
const userDataDir = app.getPath('userData');
const workspaceDir = path.join(userDataDir, 'workspace');
if (!fs.existsSync(workspaceDir)) {
  fs.mkdirSync(workspaceDir, { recursive: true });
}

process.env.JOBSTRIDER_TEST_WORKSPACE = workspaceDir;
process.env.HOST = '127.0.0.1';
process.env.PORT = process.env.PORT || '3001';

// Single-instance lock prevents multiple colliding desktop instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

let mainWindow = null;
let apiServer = null;

async function startBackend() {
  const serverModule = await import('../frontend/server/index.js');
  return serverModule.server;
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

  const appUrl = `http://127.0.0.1:${port}`;
  await mainWindow.loadURL(appUrl);

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
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  try {
    apiServer = await startBackend();
    const port = process.env.PORT || 3001;
    await createWindow(port);
  } catch (err) {
    console.error('Failed to start JobStrider desktop application:', err);
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
