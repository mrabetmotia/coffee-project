import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import { join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
import { API_DEFAULT_PORT } from '@cafestock/shared';

const require = createRequire(__filename);

let mainWindow: BrowserWindow | null = null;

function userPaths() {
  const root = app.getPath('userData');
  const data = join(root, 'data');
  const backups = join(root, 'backups');
  const invoices = join(root, 'invoices');
  const reports = join(root, 'reports');
  for (const dir of [data, backups, invoices, reports]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
  return {
    db: join(data, 'cafestock.db'),
    backups,
    invoices,
    reports,
    config: join(root, 'config.json'),
  };
}

function ensureJwtSecret(configPath: string): string {
  if (existsSync(configPath)) {
    const parsed = JSON.parse(readFileSync(configPath, 'utf8')) as { jwtSecret?: string };
    if (parsed.jwtSecret) return parsed.jwtSecret;
  }
  const jwtSecret = `${Date.now()}-${Math.random().toString(36).slice(2)}-${app.getPath('userData')}`;
  writeFileSync(configPath, JSON.stringify({ jwtSecret }, null, 2));
  return jwtSecret;
}

async function startApi(paths: ReturnType<typeof userPaths>): Promise<number> {
  process.env.DATABASE_URL = `file:${paths.db}`;
  process.env.BACKUP_DIR = paths.backups;
  process.env.INVOICE_DIR = paths.invoices;
  process.env.REPORT_DIR = paths.reports;
  process.env.JWT_SECRET = ensureJwtSecret(paths.config);
  process.env.PORT = String(API_DEFAULT_PORT);
  const isDev = !app.isPackaged;
  if (isDev) {
    return API_DEFAULT_PORT;
  }
  const apiMain = join(process.resourcesPath, 'api', 'main.js');
  const mod = require(apiMain) as { bootstrap: (port?: number) => Promise<number> };
  return mod.bootstrap(API_DEFAULT_PORT);
}

function createWindow(apiPort: number) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    show: false,
    title: 'CaféStock',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.on('ready-to-show', () => mainWindow?.show());
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      console.error(`[renderer:${level}] ${message} (${sourceId}:${line})`);
    });
    mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      console.error(`[renderer:load] ${errorCode} ${errorDescription}: ${validatedURL}`);
    });
    mainWindow.webContents.on('render-process-gone', (_event, details) => {
      console.error(`[renderer:gone] ${details.reason} (exit code ${details.exitCode})`);
    });
  }
  const apiBaseUrl = `http://127.0.0.1:${apiPort}/api`;
  mainWindow.webContents.once('did-finish-load', () => {
    mainWindow?.webContents.send('api-ready', apiBaseUrl);
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(async () => {
  const paths = userPaths();
  const port = await startApi(paths);
  createWindow(port);

  ipcMain.handle('get-api-url', () => `http://127.0.0.1:${port}/api`);
  ipcMain.handle('open-path', (_e, filePath: string) => shell.openPath(filePath));
  ipcMain.handle('pick-backup', async () => {
    const res = await dialog.showOpenDialog({
      defaultPath: paths.backups,
      filters: [{ name: 'postgresql', extensions: ['db'] }],
      properties: ['openFile'],
    });
    return res.canceled ? null : res.filePaths[0];
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
