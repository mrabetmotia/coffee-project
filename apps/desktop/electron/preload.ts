import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('cafestock', {
  getApiUrl: () => ipcRenderer.invoke('get-api-url') as Promise<string>,
  openPath: (filePath: string) => ipcRenderer.invoke('open-path', filePath) as Promise<string>,
  pickBackup: () => ipcRenderer.invoke('pick-backup') as Promise<string | null>,
});
