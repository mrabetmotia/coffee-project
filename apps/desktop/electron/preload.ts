import { contextBridge, ipcRenderer } from 'electron';

type UpdateEvent = {
  type: string;
  version?: string;
  progress?: number;
  message?: string;
};

type UpdaterCallback = (event: UpdateEvent) => void;

const updaterListeners = new Set<UpdaterCallback>();

ipcRenderer.on('updater-event', (_event, payload: UpdateEvent) => {
  updaterListeners.forEach((listener) => listener(payload));
});

contextBridge.exposeInMainWorld('cafestock', {
  getApiUrl: () => ipcRenderer.invoke('get-api-url') as Promise<string>,
  openPath: (filePath: string) => ipcRenderer.invoke('open-path', filePath) as Promise<string>,
  pickBackup: () => ipcRenderer.invoke('pick-backup') as Promise<string | null>,
  updater: {
    check: () => ipcRenderer.invoke('updater:check') as Promise<{ ok: boolean; skipped?: boolean; error?: string }>,
    download: () => ipcRenderer.invoke('updater:download') as Promise<{ ok: boolean; skipped?: boolean; error?: string }>,
    install: () => ipcRenderer.invoke('updater:install') as Promise<{ ok: boolean; skipped?: boolean; error?: string }>,
    on: (callback: UpdaterCallback) => {
      updaterListeners.add(callback);
      return () => updaterListeners.delete(callback);
    },
  },
});
