import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { autoUpdater } from 'electron-updater';

let mainWindow: BrowserWindow | null = null;

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

  return 'https://coffee-project-zltx.onrender.com/api';
}

function createWindow() {
  const paths = userPaths();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    show: false,
    title: 'CaféStock',
    autoHideMenuBar: true,
    icon: join(__dirname, '../../build/icon.ico'),
    
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
}

function setupAutoUpdater() {
  if (!app.isPackaged) {
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', () => {
    console.log('[updater] Update available');
  });

  autoUpdater.on('update-downloaded', () => {
    console.log('[updater] Update downloaded');
  });

  autoUpdater.on('error', (error) => {
    console.error('[updater] Error:', error);
  });

  void autoUpdater.checkForUpdates();
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
