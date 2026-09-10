/// <reference types="vite/client" />

export {};

type UpdaterEvent = {
  type: string;
  version?: string;
  progress?: number;
  message?: string;
};

declare global {
  interface Window {
    cafestock?: {
      getApiUrl: () => Promise<string>;
      openPath: (filePath: string) => Promise<string>;
      pickBackup: () => Promise<string | null>;
      updater: {
        check: () => Promise<{ ok: boolean; skipped?: boolean; error?: string }>;
        download: () => Promise<{ ok: boolean; skipped?: boolean; error?: string }>;
        install: () => Promise<{ ok: boolean; skipped?: boolean; error?: string }>;
        on: (callback: (event: UpdaterEvent) => void) => () => void;
      };
    };
  }
}
