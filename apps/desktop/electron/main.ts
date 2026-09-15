import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { autoUpdater } from 'electron-updater';

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
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

function getAppIconPath() {
  return app.isPackaged
    ? join(process.resourcesPath, 'icon.ico')
    : join(__dirname, '../../build/icon.ico');
}

function buildSplashHtml() {
  const locale = app.getLocale();
  const isFrench = /^(fr|fr-[A-Z]+)$/i.test(locale || 'en');
  const statusText = isFrench ? 'Démarrage de CaféStock...' : 'Starting CaféStock...';

  return `<!DOCTYPE html>
    <html lang="${isFrench ? 'fr' : 'en'}">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>CaféStock</title>
        <style>
          :root {
            color-scheme: light dark;
            --bg: #f5f1ea;
            --panel: rgba(255,255,255,0.8);
            --panel-border: rgba(91, 64, 38, 0.12);
            --text: #1f1a17;
            --muted: #756a63;
            --primary: #3a7669;
            --primary-soft: rgba(58, 118, 105, 0.12);
            --secondary: #c67b46;
            --shadow: rgba(41, 31, 24, 0.14);
          }

          @media (prefers-color-scheme: dark) {
            :root {
              --bg: #121a1a;
              --panel: rgba(24,31,33,0.88);
              --panel-border: rgba(149, 170, 163, 0.18);
              --text: #edf3f0;
              --muted: #a2b1aa;
              --primary: #74c7b6;
              --primary-soft: rgba(116, 199, 182, 0.12);
              --secondary: #e4a66f;
              --shadow: rgba(2, 6, 10, 0.48);
            }
          }

          * { box-sizing: border-box; }

          html, body {
            margin: 0;
            width: 100%;
            height: 100%;
            background:
              radial-gradient(circle at top, rgba(196, 130, 67, 0.18), transparent 28%),
              linear-gradient(135deg, rgba(58, 118, 105, 0.08), transparent 40%),
              var(--bg);
            font-family: 'Segoe UI', 'Avenir Next', sans-serif;
            color: var(--text);
          }

          body {
            display: grid;
            place-items: center;
            overflow: hidden;
          }

          .splash {
            width: 420px;
            background: var(--panel);
            border: 1px solid var(--panel-border);
            border-radius: 28px;
            box-shadow: 0 18px 54px var(--shadow);
            backdrop-filter: blur(14px);
            -webkit-backdrop-filter: blur(14px);
            padding: 28px 28px 24px;
            transform: scale(0.96);
            opacity: 0;
            animation: intro 700ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
          }

          @keyframes intro {
            0% { opacity: 0; transform: scale(0.94) translateY(12px); }
            100% { opacity: 1; transform: scale(1) translateY(0); }
          }

          .brand {
            display: flex;
            align-items: center;
            gap: 14px;
            justify-content: center;
            margin-bottom: 14px;
          }

          .logo {
            position: relative;
            width: 72px;
            height: 72px;
            border-radius: 22px;
            background: linear-gradient(145deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 68%, white) 100%);
            display: grid;
            place-items: center;
            box-shadow: 0 12px 24px rgba(58, 118, 105, 0.25);
            animation: pulse 2.8s ease-in-out infinite;
          }

          @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.06); }
          }

          .logo::before {
            content: '☕';
            font-size: 28px;
            color: white;
            filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.15));
          }

          .name {
            font-size: 2rem;
            font-weight: 700;
            letter-spacing: -0.06em;
            margin: 0;
          }

          .subtitle {
            text-align: center;
            margin: 0 0 20px;
            font-size: 0.82rem;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: var(--muted);
          }

          .progress {
            width: 100%;
            height: 10px;
            border-radius: 999px;
            background: rgba(128, 128, 128, 0.12);
            overflow: hidden;
            position: relative;
          }

          .progress-bar {
            position: absolute;
            inset: 0 auto 0 0;
            width: 38%;
            border-radius: inherit;
            background: linear-gradient(90deg, var(--primary), var(--secondary));
            box-shadow: 0 0 22px rgba(58, 118, 105, 0.3);
            animation: loading 1.8s ease-in-out infinite;
          }

          @keyframes loading {
            0% { transform: translateX(-35%); }
            50% { transform: translateX(115%); }
            100% { transform: translateX(-35%); }
          }

          .status {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            margin-top: 18px;
            color: var(--muted);
            font-size: 0.94rem;
          }

          .dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: var(--primary);
            opacity: 0.7;
            animation: blink 1.2s ease-in-out infinite;
          }

          .dot:nth-child(2) { animation-delay: 0.2s; }
          .dot:nth-child(3) { animation-delay: 0.4s; }

          @keyframes blink {
            0%, 100% { opacity: 0.25; transform: translateY(0); }
            50% { opacity: 1; transform: translateY(-1px); }
          }
        </style>
      </head>
      <body>
        <div class="splash">
          <div class="brand">
            <div class="logo" aria-hidden="true"></div>
            <h1 class="name">CaféStock</h1>
          </div>
          <p class="subtitle">Coffee • Operations • Insights</p>
          <div class="progress" aria-label="Loading">
            <div class="progress-bar"></div>
          </div>
          <div class="status">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
            <span>${statusText}</span>
          </div>
        </div>
      </body>
    </html>`;
}

function createSplashWindow() {
  if (splashWindow) return;

  splashWindow = new BrowserWindow({
    width: 530,
    height: 460,
    minWidth: 530,
    minHeight: 460,
    maxWidth: 530,
    maxHeight: 460,
    frame: false,
    resizable: false,
    movable: false,
    show: false,
    center: true,
    skipTaskbar: true,
    transparent: false,
    alwaysOnTop: true,
    title: 'CaféStock',
    icon: getAppIconPath(),
    backgroundColor: '#f5f1ea',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  splashWindow.on('ready-to-show', () => {
    splashWindow?.show();
  });

  void splashWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(buildSplashHtml())}`,
  );
}

function revealMainWindow() {
  if (!mainWindow) return;

  mainWindow.show();
  mainWindow.focus();

  if (splashWindow) {
    splashWindow.close();
    splashWindow = null;
  }
}

function createWindow() {
  const paths = userPaths();
  const iconPath = getAppIconPath();

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
    if (!splashWindow) {
      mainWindow?.show();
    }
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

    setTimeout(() => {
      revealMainWindow();
    }, 420);
  });

  mainWindow.webContents.once('did-fail-load', () => {
    console.error('[renderer:load] main window failed to load. Showing app anyway.');
    setTimeout(() => {
      revealMainWindow();
    }, 260);
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

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'mrabetmotia',
    repo: 'coffee-project',
    private: false,
    releaseType: 'release',
  });

  autoUpdater.on('checking-for-update', () => {
    emitUpdaterEvent('checking-for-update');
  });

  autoUpdater.on('update-available', (info) => {
    const version = info?.version ?? 'unknown';
    latestAvailableVersion = version;
    emitUpdaterEvent('update-available', { version });
  });

  autoUpdater.on('update-not-available', () => {
    emitUpdaterEvent('update-not-available');
  });

  autoUpdater.on('download-progress', (progressObj) => {
    const percentage = Math.round(progressObj.percent ?? 0);
    emitUpdaterEvent('download-progress', {
      version: latestAvailableVersion,
      progress: percentage,
      message: `${app.getName()} v${latestAvailableVersion}`,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    const version = info?.version ?? latestAvailableVersion;
    emitUpdaterEvent('update-downloaded', { version });
  });

  autoUpdater.on('error', (error) => {
    console.error('[updater] Update error:', error);
    emitUpdaterEvent('update-error', {
      message: 'The update could not be downloaded.',
    });
  });

  setTimeout(() => {
    void autoUpdater.checkForUpdates().catch((error) => {
      console.error('[updater] checkForUpdates startup failed:', error);
      emitUpdaterEvent('update-error', {
        message: error instanceof Error ? error.message : 'Unknown updater error',
      });
    });
  }, 1500);
}

app.whenReady().then(() => {
  createSplashWindow();
  createWindow();
  setupAutoUpdater();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
