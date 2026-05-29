import { resolve } from "node:path";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import UnoCSS from "unocss/vite";
import { defineConfig } from "vite";

const srcDir = resolve(__dirname, "./src");

export default defineConfig({
  base: "/dashboard/",
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      routesDirectory: resolve(srcDir, "./routes"),
      quoteStyle: "double",
    }),
    devtools({
      removeDevtoolsOnBuild: true,
    }),
    UnoCSS(),
    react(),
  ],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:49160",
    },
  },
});
