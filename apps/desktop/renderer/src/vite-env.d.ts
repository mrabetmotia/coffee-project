export {};

declare global {
  interface Window {
    cafestock?: {
      getApiUrl: () => Promise<string>;
      openPath: (filePath: string) => Promise<string>;
      pickBackup: () => Promise<string | null>;
    };
  }
}
