// electron.vite.config.ts
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
var __electron_vite_injected_dirname = "D:\\work\\my-project\\apps\\desktop";
var electron_vite_config_default = defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve(__electron_vite_injected_dirname, "electron/main.ts")
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve(__electron_vite_injected_dirname, "electron/preload.ts")
      }
    }
  },
  renderer: {
    root: resolve(__electron_vite_injected_dirname, "renderer"),
    plugins: [react()],
    resolve: {
      alias: {
        "@": resolve(__electron_vite_injected_dirname, "renderer/src"),
        "@cafestock/shared": resolve(__electron_vite_injected_dirname, "../../packages/shared/src")
      }
    },
    build: {
      rollupOptions: {
        input: resolve(__electron_vite_injected_dirname, "renderer/index.html")
      }
    }
  }
});
export {
  electron_vite_config_default as default
};
