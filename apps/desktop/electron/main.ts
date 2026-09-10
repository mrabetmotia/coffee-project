import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { autoUpdater } from 'electron-updater';

let mainWindow: BrowserWindow | null = null;
let latestAvailableVersion = app.getVersion();

type UpdaterEvent =
  | 'checking-for-update'
  | 'update-available'
  | 'update-not-available'
  | 'download-progress'
  | 'update-downloaded'
  | 'update-error';

type UpdaterPayload = {
  version?: string;
  progress?: number;
  message?: string;
};

function emitUpdaterEvent(type: UpdaterEvent, payload: UpdaterPayload = {}) {
  mainWindow?.webContents.send('updater-event', { type, ...payload });
}

function userPaths() {
  const root = app.getPath('userData');
  const backups = join(root, 'backups');
  const invoices = join(root, 'invoices');
  const reports = join(root, 'reports');

  for (const dir of [backups, invoices, reports]) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  return {
    backups,
    invoices,
    reports,
  };
}

function getApiUrl() {
  if (app.isPackaged) {
    return (
      process.env.VITE_API_URL ??
      'https://coffee-project-zltx.onrender.com/api'
    );
  }

  return 'http://127.0.0.1:47821/api';
}

function createWindow() {
  const paths = userPaths();
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'icon.ico')
    : join(__dirname, '../../build/icon.ico');

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    show: false,
    title: 'CaféStock',
    autoHideMenuBar: true,
    icon: iconPath,

    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });

    mainWindow.webContents.on(
      'console-message',
      (_event, level, message, line, sourceId) => {
        console.error(
          `[renderer:${level}] ${message} (${sourceId}:${line})`,
        );
      },
    );

    mainWindow.webContents.on(
      'did-fail-load',
      (_event, errorCode, errorDescription, validatedURL) => {
        console.error(
          `[renderer:load] ${errorCode} ${errorDescription}: ${validatedURL}`,
        );
      },
    );

    mainWindow.webContents.on(
      'render-process-gone',
      (_event, details) => {
        console.error(
          `[renderer:gone] ${details.reason} (exit code ${details.exitCode})`,
        );
      },
    );
  }

  const apiBaseUrl = getApiUrl();

  mainWindow.webContents.once('did-finish-load', () => {
    mainWindow?.webContents.send('api-ready', apiBaseUrl);
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    void mainWindow.loadFile(
      join(__dirname, '../renderer/index.html'),
    );
  }

  ipcMain.handle('get-api-url', () => getApiUrl());

  ipcMain.handle('open-path', (_e, filePath: string) => {
    return shell.openPath(filePath);
  });

  ipcMain.handle('pick-backup', async () => {
    const res = await dialog.showOpenDialog({
      defaultPath: paths.backups,
      filters: [{ name: 'Database', extensions: ['db'] }],
      properties: ['openFile'],
    });

    return res.canceled ? null : res.filePaths[0];
  });

  ipcMain.handle('updater:check', async () => {
    if (!app.isPackaged) return { ok: true, skipped: true };
    try {
      const result = await autoUpdater.checkForUpdates();
      return { ok: true, skipped: false, result };
    } catch (error) {
      console.error('[updater] checkForUpdates failed:', error);
      return { ok: false, skipped: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('updater:download', async () => {
    if (!app.isPackaged) return { ok: true, skipped: true };
    try {
      const result = await autoUpdater.downloadUpdate();
      return { ok: true, result };
    } catch (error) {
      console.error('[updater] downloadUpdate failed:', error);
      return { ok: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('updater:install', async () => {
    if (!app.isPackaged) return { ok: true, skipped: true };
    try {
      autoUpdater.quitAndInstall(false, true);
      return { ok: true };
    } catch (error) {
      console.error('[updater] quitAndInstall failed:', error);
      return { ok: false, error: (error as Error).message };
    }
  });
}

function setupAutoUpdater() {
  if (!app.isPackaged) {
    return;
  }

  const currentVersion = app.getVersion();
  console.log(`[updater] Current version: ${currentVersion}`);

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('checking-for-update', () => {
    console.log('[updater] Checking for updates...');
    emitUpdaterEvent('checking-for-update');
  });

  autoUpdater.on('update-available', (info) => {
    const version = info?.version ?? 'unknown';
    latestAvailableVersion = version;
    console.log(`[updater] Update available: ${version}`);
    emitUpdaterEvent('update-available', { version });
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[updater] Update not available');
    emitUpdaterEvent('update-not-available');
  });

  autoUpdater.on('download-progress', (progressObj) => {
    const percentage = Math.round(progressObj.percent ?? 0);
    console.log(`[updater] Download progress: ${percentage}%`);
    emitUpdaterEvent('download-progress', {
      version: latestAvailableVersion,
      progress: percentage,
      message: `${app.getName()} v${latestAvailableVersion}`,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    const version = info?.version ?? latestAvailableVersion;
    console.log(`[updater] Update downloaded: ${version}`);
    emitUpdaterEvent('update-downloaded', { version });
  });

  autoUpdater.on('error', (error) => {
    console.error('[updater] Update error:', error);
    emitUpdaterEvent('update-error', {
      message: 'The update could not be downloaded.',
    });
  });

  setTimeout(() => {
    void autoUpdater.checkForUpdates();
  }, 1500);
}

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdater();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
